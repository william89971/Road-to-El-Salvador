// B2 — tick() must end the game when gas or SUV health is depleted.
import { describe, it, expect, beforeEach } from 'vitest';
import { tick } from '../gameRules.js';
import { gameState } from '../gameState.js';

function startPlaying(overrides = {}) {
  Object.assign(gameState, {
    screen: 'playing', paused: false,
    miles: 0, days: 0, timeOfDay: 0.5,
    gas: 100, suvHealth: 100, vibes: 5,
    purchasingPower: 100, btcPrice: 64000, btcPriceHistory: [64000],
    ...overrides,
  });
}

describe('tick() loss conditions', () => {
  beforeEach(() => startPlaying());

  it('ends the game when gas runs out', () => {
    startPlaying({ gas: 1 });
    tick(2); // gas -= 1.2 * 2 → clamped to 0
    expect(gameState.gas).toBe(0);
    expect(gameState.screen).toBe('gameover');
  });

  it('ends the game when SUV health hits 0', () => {
    startPlaying({ gas: 100, suvHealth: 0 });
    tick(0.1);
    expect(gameState.screen).toBe('gameover');
  });
});
