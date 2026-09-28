import { gameState } from './gameState.js';

// Leaderboard storage — tries the backend API first, then localStorage, then an
// in-memory buffer. Storage access is guarded because some embedded browsers
// throw when localStorage is touched.
const API_BASE = '/api';

// In-memory fallback when both the backend and localStorage are unavailable.
const fallbackRuns = [];
const STORAGE_KEY = 'btc-road-trip-runs';

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readLocal() {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

function writeLocal(runs) {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(runs.slice(-100)));
    return true;
  } catch {
    return false;
  }
}

// Test-only helper to reset fallback storage between tests.
export function __resetFallbackRuns() {
  fallbackRuns.length = 0;
  try { storage()?.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// Test-only: drop the memory buffer without touching localStorage.
export function __clearMemoryRuns() {
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

  const entry = { ...run, ts: Date.now() };
  const existing = readLocal() ?? [];
  if (writeLocal([...existing, entry].slice(-100))) return;

  fallbackRuns.push(entry);
  if (fallbackRuns.length > 100) fallbackRuns.shift();
}

export async function topRuns(n = 10) {
  // try backend first
  const remote = await tryApi(`/runs?n=${n}`);
  if (remote && Array.isArray(remote)) return remote;

  const local = readLocal();
  const source = local ?? fallbackRuns;
  return source
    .slice()
    .sort((a, b) => b.btcValue - a.btcValue)
    .slice(0, n);
}
