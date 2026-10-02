// Mid-run checkpoint. Separate from the leaderboard key, and guarded the same
// way: some embedded browsers throw when localStorage is touched.
import { gameState } from './gameState.js';

const STORAGE_KEY = 'btc-road-trip-checkpoint';

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function saveCheckpoint() {
  const ls = storage();
  if (!ls) return false;
  try {
    const snap = {};
    for (const key of Object.keys(gameState)) {
      const value = gameState[key];
      snap[key] = Array.isArray(value) ? value.slice() : value;
    }
    ls.setItem(STORAGE_KEY, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
}

export function loadCheckpoint() {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const snap = JSON.parse(raw);
    if (!snap || snap.screen !== 'playing' || typeof snap.miles !== 'number') return null;
    return snap;
  } catch {
    return null;
  }
}

export function clearCheckpoint() {
  const ls = storage();
  if (!ls) return;
  try { ls.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function restoreCheckpoint(snap) {
  if (!snap) return false;
  Object.assign(gameState, snap);
  gameState.btcPriceHistory = Array.isArray(snap.btcPriceHistory) ? snap.btcPriceHistory.slice() : [gameState.btcPrice];
  gameState.recentEventTitles = Array.isArray(snap.recentEventTitles) ? snap.recentEventTitles.slice() : [];
  return true;
}
