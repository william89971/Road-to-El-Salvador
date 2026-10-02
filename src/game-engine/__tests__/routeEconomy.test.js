// A full tank used to die in the desert: 100 gas lasted ~292 miles, and the
// Hermosillo → Mexico City gap is 780. Inflation then priced refuels out of
// reach. These tests lock the mile-based economy so a careful player finishes
// and a player who never buys gas does not.
import { describe, it, expect, beforeEach } from 'vitest';
import { CONFIG, LOADOUTS } from '../gameConfig.js';
import { gameState, resetGame } from '../gameState.js';
import { tick } from '../gameRules.js';
import { ROUTE } from '../../map-data/citiesAndRoute.js';

const REFUEL_BASE = 40;

function driveTo(targetMiles) {
  let guard = 0;
  while (gameState.miles < targetMiles - 0.05) {
    tick(0.05);
    if (gameState.screen !== 'playing') return false;
    if (++guard > 200000) return false;
  }
  return gameState.screen === 'playing';
}

function refuelIfShort(nextMile) {
  const gap = nextMile - gameState.miles;
  const range = gameState.gas / CONFIG.GAS_PER_MILE;
  if (range >= gap + 20) return 'skip';
  const price = Math.round(REFUEL_BASE / (gameState.purchasingPower / 100));
  if (gameState.cash < price) return 'broke';
  gameState.cash -= price;
  gameState.gas = 100;
  return 'bought';
}

describe('route economy', () => {
  beforeEach(() => {
    resetGame('Driver', 'road_warrior', LOADOUTS.road_warrior);
  });

  it('lets every loadout and difficulty finish by refueling only when the next leg is out of range', () => {
    for (const loadout of Object.values(LOADOUTS)) {
      for (const difficulty of ['tourist', 'road_warrior', 'satoshi']) {
        resetGame('Driver', difficulty, loadout);
        let failed = null;
        for (let i = 0; i < ROUTE.length - 1; i++) {
          const decision = refuelIfShort(ROUTE[i + 1].mile);
          if (decision === 'broke') {
            failed = `${loadout.id}/${difficulty} cannot afford fuel at ${ROUTE[i].name} with $${Math.round(gameState.cash)}`;
            break;
          }
          if (!driveTo(ROUTE[i + 1].mile)) {
            failed = `${loadout.id}/${difficulty} stranded before ${ROUTE[i + 1].name} at mile ${Math.round(gameState.miles)} (${gameState.gameoverReason})`;
            break;
          }
        }
        expect(failed, failed ?? '').toBeNull();
        expect(gameState.miles).toBeGreaterThanOrEqual(CONFIG.TOTAL_MILES - 0.05);
        expect(gameState.gas).toBeGreaterThan(0);
      }
    }
  });

  it('strands a driver who never refuels', () => {
    let reachedEnd = true;
    for (let i = 0; i < ROUTE.length - 1; i++) {
      if (!driveTo(ROUTE[i + 1].mile)) { reachedEnd = false; break; }
    }
    expect(reachedEnd).toBe(false);
    expect(gameState.screen).toBe('gameover');
    expect(gameState.gameoverReason).toMatch(/gas/i);
    expect(gameState.miles).toBeLessThan(CONFIG.TOTAL_MILES);
  });

  it('still has some purchasing power at the border, and less than at the start', () => {
    for (let i = 0; i < ROUTE.length - 1; i++) {
      refuelIfShort(ROUTE[i + 1].mile);
      driveTo(ROUTE[i + 1].mile);
    }
    expect(gameState.purchasingPower).toBeLessThan(40);
    expect(gameState.purchasingPower).toBeGreaterThan(15);
  });
});
