// A6 — unit tests for the leaderboard localStorage fallback.
// When the backend is unreachable, topRuns() reads localStorage, returns runs
// sorted by btcValue descending, and respects the n limit.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { topRuns } from '../leaderboardStorage.js';

// minimal localStorage stand-in (the test runs in Node, where there is none)
function makeLocalStorage(entries) {
  const store = new Map(Object.entries(entries));
  return {
    get length() { return store.size; },
    key(i) { return [...store.keys()][i] ?? null; },
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
  };
}

describe('topRuns localStorage fallback', () => {
  beforeEach(() => {
    // force the fallback path: backend unreachable
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no server'))));
    vi.stubGlobal('localStorage', makeLocalStorage({
      'btc_run:1': JSON.stringify({ name: 'A', btcValue: 100 }),
      'btc_run:2': JSON.stringify({ name: 'B', btcValue: 300 }),
      'btc_run:3': JSON.stringify({ name: 'C', btcValue: 200 }),
      'other:x':  JSON.stringify({ name: 'ignore-me', btcValue: 999 }),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns runs sorted by btcValue descending', async () => {
    const runs = await topRuns();
    expect(runs.map(r => r.btcValue)).toEqual([300, 200, 100]);
  });

  it('respects the n limit', async () => {
    const runs = await topRuns(2);
    expect(runs.map(r => r.btcValue)).toEqual([300, 200]);
  });

  it('ignores keys without the btc_run: prefix', async () => {
    const runs = await topRuns();
    expect(runs.some(r => r.btcValue === 999)).toBe(false);
  });
});
