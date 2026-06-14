// A5 — unit tests for resetGame difficulty multipliers.
// Starting cash scales by difficulty: tourist ×1.5, road_warrior ×1, satoshi ×0.5.
import { describe, it, expect } from 'vitest';
import { resetGame, gameState } from '../gameState.js';

const loadout = { id: 'test', cash: 1000, btc: 0.05, gas: 100 };

describe('resetGame difficulty multipliers', () => {
  it('road_warrior keeps base cash (×1)', () => {
    resetGame('P', 'road_warrior', loadout);
    expect(gameState.cash).toBe(1000);
    expect(gameState.startCash).toBe(1000);
  });

  it('tourist gives 1.5× cash', () => {
    resetGame('P', 'tourist', loadout);
    expect(gameState.cash).toBe(1500);
  });

  it('satoshi gives 0.5× cash', () => {
    resetGame('P', 'satoshi', loadout);
    expect(gameState.cash).toBe(500);
  });

  it('btc and gas come from the loadout, unscaled by difficulty', () => {
    resetGame('P', 'tourist', loadout);
    expect(gameState.btc).toBe(loadout.btc);
    expect(gameState.gas).toBe(loadout.gas);
  });
});
