// Leaderboard storage — tries the backend API first, falls back to localStorage.
const API_BASE = '/api';
const STORAGE_PREFIX = 'btc_run:';

async function tryApi(path, opts) {
  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (res.ok) return await res.json();
  } catch { /* server unreachable — use localStorage fallback */ }
  return null;
}

export async function saveRun() {
  const { gameState } = await import('./gameStateAndRules.js');
  const run = {
    name: gameState.playerName || 'Anon',
    btc: gameState.btc,
    btcValue: Math.round(gameState.btc * gameState.btcPrice),
    pp: Math.round(gameState.purchasingPower),
    days: gameState.days,
  };

  // try backend first
  const remote = await tryApi('/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(run),
  });
  if (remote) return;

  // fall back to localStorage
  try {
    localStorage.setItem(STORAGE_PREFIX + Date.now(), JSON.stringify(run));
  } catch (e) {
    console.warn('leaderboard save failed', e);
  }
}

export async function topRuns(n = 10) {
  // try backend first
  const remote = await tryApi(`/runs?n=${n}`);
  if (remote && Array.isArray(remote)) return remote;

  // fall back to localStorage
  try {
    const runs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (raw) runs.push(JSON.parse(raw));
      } catch { /* skip corrupt entries */ }
    }
    return runs.sort((a, b) => b.btcValue - a.btcValue).slice(0, n);
  } catch (e) {
    console.warn('leaderboard read failed', e);
    return [];
  }
}
