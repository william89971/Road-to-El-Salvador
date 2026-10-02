import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { gameState, resetGame } from '../gameState.js';
import { LOADOUTS } from '../gameConfig.js';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, restoreCheckpoint } from '../runSave.js';

describe('run checkpoint', () => {
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
    resetGame('Ada', 'road_warrior', LOADOUTS.road_warrior);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('round-trips a playing run and copies the arrays', () => {
    gameState.miles = 490;
    gameState.currentCity = 'Hermosillo';
    gameState.btcPriceHistory = [64000, 70000];
    gameState.recentEventTitles = ['Radiator Blows in the Desert'];
    gameState.cityStopIndex = 2;
    gameState.paused = true;

    expect(saveCheckpoint()).toBe(true);
    const snap = loadCheckpoint();
    expect(snap.currentCity).toBe('Hermosillo');
    expect(snap.miles).toBe(490);

    resetGame('Other', 'tourist', LOADOUTS.cash_king);
    expect(restoreCheckpoint(snap)).toBe(true);
    expect(gameState.playerName).toBe('Ada');
    expect(gameState.currentCity).toBe('Hermosillo');
    expect(gameState.screen).toBe('playing');

    gameState.btcPriceHistory.push(80000);
    gameState.recentEventTitles.push('extra');
    expect(snap.btcPriceHistory).toEqual([64000, 70000]);
    expect(snap.recentEventTitles).toEqual(['Radiator Blows in the Desert']);
  });

  it('ignores a checkpoint that is not an active drive', () => {
    gameState.screen = 'gameover';
    gameState.miles = 100;
    saveCheckpoint();
    expect(loadCheckpoint()).toBeNull();
  });

  it('clears the saved run', () => {
    saveCheckpoint();
    clearCheckpoint();
    expect(loadCheckpoint()).toBeNull();
  });

  it('survives a localStorage that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(saveCheckpoint()).toBe(false);
    expect(loadCheckpoint()).toBeNull();
    expect(() => clearCheckpoint()).not.toThrow();
  });
});
