// A6 — unit tests for the leaderboard in-memory fallback.
// When the backend is unreachable, topRuns() reads the in-memory buffer,
// returns runs sorted by btcValue descending, and respects the n limit.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { topRuns, saveRun, __resetFallbackRuns, __clearMemoryRuns } from '../leaderboardStorage.js';
import { gameState } from '../gameState.js';

describe('topRuns in-memory fallback', () => {
  beforeEach(() => {
    __resetFallbackRuns();
    // force the fallback path: backend unreachable
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no server'))));
    gameState.playerName = 'Tester';
    gameState.btc = 0.05;
    gameState.btcPrice = 64000;
    gameState.purchasingPower = 80;
    gameState.days = 5;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns runs sorted by btcValue descending', async () => {
    gameState.btc = 0.01; gameState.btcPrice = 10000; await saveRun(); // 100
    gameState.btc = 0.03; gameState.btcPrice = 10000; await saveRun(); // 300
    gameState.btc = 0.02; gameState.btcPrice = 10000; await saveRun(); // 200

    const runs = await topRuns();
    expect(runs.map((r) => r.btcValue)).toEqual([300, 200, 100]);
  });

  it('respects the n limit', async () => {
    gameState.btc = 0.03; gameState.btcPrice = 10000; await saveRun();
    gameState.btc = 0.02; gameState.btcPrice = 10000; await saveRun();
    gameState.btc = 0.01; gameState.btcPrice = 10000; await saveRun();

    const runs = await topRuns(2);
    expect(runs.map((r) => r.btcValue)).toEqual([300, 200]);
  });

  it('reloads saved runs from localStorage after the memory buffer is cleared', async () => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
    __resetFallbackRuns();
    gameState.btc = 0.04;
    gameState.btcPrice = 10000;
    await saveRun();
    __clearMemoryRuns();
    const runs = await topRuns();
    expect(runs.map((r) => r.btcValue)).toEqual([400]);
  });

  it('ignores entries from other test runs by relying on module-level buffer', async () => {
    // The in-memory buffer persists across calls within the same process,
    // which is exactly what we want for the fallback. We verify sorting only.
    gameState.btc = 0.02; gameState.btcPrice = 10000; await saveRun();
    const runs = await topRuns(1);
    expect(runs[0].btcValue).toBe(200);
  });
});
