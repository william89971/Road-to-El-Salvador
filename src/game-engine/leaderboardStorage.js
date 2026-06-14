const STORAGE_PREFIX = 'btc_run:';

export async function saveRun() {
  try {
    const { gameState } = await import('./gameStateAndRules.js');
    const run = {
      name: gameState.playerName || 'Anon',
      btc: gameState.btc,
      btcValue: Math.round(gameState.btc * gameState.btcPrice),
      pp: Math.round(gameState.purchasingPower),
      days: gameState.days,
    };
    const key = STORAGE_PREFIX + Date.now();
    localStorage.setItem(key, JSON.stringify(run));
  } catch (e) {
    console.warn('leaderboard save failed', e);
  }
}

export async function topRuns(n = 10) {
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
