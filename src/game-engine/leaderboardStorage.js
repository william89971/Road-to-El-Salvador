import { gameState } from './gameState.js';

// Leaderboard storage — tries the backend API first, falls back to an in-memory
// buffer. We intentionally do not use localStorage/sessionStorage because some
// environments (e.g., Claude artifacts) block them.
const API_BASE = '/api';

// In-memory fallback when the backend is unreachable. Not persisted across
// page reloads, which matches the original design contract.
const fallbackRuns = [];

// Test-only helper to reset the in-memory fallback between tests.
export function __resetFallbackRuns() {
  fallbackRuns.length = 0;
}

async function tryApi(path, opts) {
  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (res.ok) return await res.json();
  } catch { /* server unreachable — use in-memory fallback */ }
  return null;
}

export async function saveRun() {
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

  // in-memory fallback
  fallbackRuns.push({ ...run, ts: Date.now() });
  // cap fallback size to avoid unbounded growth
  if (fallbackRuns.length > 100) fallbackRuns.shift();
}

export async function topRuns(n = 10) {
  // try backend first
  const remote = await tryApi(`/runs?n=${n}`);
  if (remote && Array.isArray(remote)) return remote;

  // in-memory fallback
  return fallbackRuns
    .slice()
    .sort((a, b) => b.btcValue - a.btcValue)
    .slice(0, n);
}
