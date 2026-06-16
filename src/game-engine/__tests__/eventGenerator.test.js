// A7 — unit test for event de-duplication in DEV_MODE.
// getEvent() must not return a headline already in recentEventTitles when an
// unused alternative still exists.
import { describe, it, expect, beforeEach } from 'vitest';
import { getEvent } from '../../events/eventGenerator.js';
import { gameState } from '../gameState.js';

// discover the full set of mock headlines by sampling with an empty "recent" list
async function discoverHeadlines() {
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    gameState.recentEventTitles = [];
    seen.add((await getEvent()).headline);
  }
  return [...seen];
}

describe('getEvent de-duplication (DEV_MODE)', () => {
  beforeEach(() => { gameState.recentEventTitles = []; gameState.days = 3; });

  it('never repeats a recent headline while an alternative exists', async () => {
    const all = await discoverHeadlines();
    expect(all.length).toBeGreaterThan(1);

    // mark every headline except one as recently seen; only that one remains valid
    const keep = all[all.length - 1];
    gameState.recentEventTitles = all.slice(0, -1);

    for (let i = 0; i < 25; i++) {
      expect((await getEvent()).headline).toBe(keep);
    }
  });
});
