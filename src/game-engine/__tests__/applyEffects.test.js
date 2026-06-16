// B3 — unit test for applyEffects clamping bounds.
// applyEffects must clamp vibes 0–5, purchasingPower 1–100, cash 0–99999, btc 0–99, gas/suvHealth 0–100.
import { describe, it, expect, beforeEach } from 'vitest';
import { applyEffects } from '../gameRules.js';
import { gameState } from '../gameState.js';

describe('applyEffects() clamping bounds', () => {
  beforeEach(() => {
    // Reset gameState to baseline values
    gameState.vibes = 3;
    gameState.purchasingPower = 50;
    gameState.cash = 50000;
    gameState.btc = 10;
    gameState.gas = 50;
    gameState.suvHealth = 50;
  });

  it('clamps a large positive vibes effect to 5', () => {
    applyEffects({ vibes: 100 });
    expect(gameState.vibes).toBe(5);
  });

  it('clamps a large negative cash effect to 0', () => {
    applyEffects({ cash: -100000 });
    expect(gameState.cash).toBe(0);
  });
});