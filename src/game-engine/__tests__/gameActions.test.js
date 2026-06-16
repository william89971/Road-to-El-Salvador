// Unit tests for explicit state-action helpers.
import { describe, it, expect, beforeEach } from 'vitest';
import { gameState, resetGame } from '../gameState.js';
import {
  setScreen, setPaused, togglePause, spendCash, addCash,
  consumeGas, refuel, damageSUV, repairSUV, adjustVibes,
  setCurrentStop, clearStop, setLastStopIndex, setBiomeCity,
  incrementEventsSurvived, incrementEnemiesDefeated, rememberEventTitle,
  setPurchasingPower, adjustPurchasingPower, adjustBTC,
} from '../gameActions.js';

function startPlaying() {
  resetGame('Tester', 'road_warrior');
}

describe('gameActions', () => {
  beforeEach(() => startPlaying());

  it('setScreen updates the screen', () => {
    setScreen('gameover');
    expect(gameState.screen).toBe('gameover');
  });

  it('setPaused and togglePause update paused', () => {
    setPaused(true);
    expect(gameState.paused).toBe(true);
    togglePause();
    expect(gameState.paused).toBe(false);
  });

  it('spendCash subtracts and clamps at 0', () => {
    spendCash(500);
    expect(gameState.cash).toBe(300);
    spendCash(99999);
    expect(gameState.cash).toBe(0);
  });

  it('addCash adds and clamps at 99999', () => {
    addCash(1000);
    expect(gameState.cash).toBe(1800);
    addCash(999999);
    expect(gameState.cash).toBe(99999);
  });

  it('consumeGas and refuel manage gas', () => {
    consumeGas(50);
    expect(gameState.gas).toBe(50);
    refuel();
    expect(gameState.gas).toBe(100);
    consumeGas(999);
    expect(gameState.gas).toBe(0);
  });

  it('damageSUV and repairSUV manage SUV health', () => {
    damageSUV(40);
    expect(gameState.suvHealth).toBe(60);
    repairSUV();
    expect(gameState.suvHealth).toBe(100);
    damageSUV(999);
    expect(gameState.suvHealth).toBe(0);
  });

  it('adjustVibes clamps between 0 and 5', () => {
    adjustVibes(-2);
    expect(gameState.vibes).toBe(3);
    adjustVibes(10);
    expect(gameState.vibes).toBe(5);
    adjustVibes(-10);
    expect(gameState.vibes).toBe(0);
  });

  it('setCurrentStop and clearStop manage cityStopIndex', () => {
    setCurrentStop(3);
    expect(gameState.cityStopIndex).toBe(3);
    clearStop();
    expect(gameState.cityStopIndex).toBe(-1);
  });

  it('setLastStopIndex updates lastStopIndex', () => {
    setLastStopIndex(2);
    expect(gameState.lastStopIndex).toBe(2);
  });

  it('setBiomeCity updates biome, city, and country', () => {
    setBiomeCity('baja', 'Tijuana', 'Mexico');
    expect(gameState.biome).toBe('baja');
    expect(gameState.currentCity).toBe('Tijuana');
    expect(gameState.currentCountry).toBe('Mexico');
  });

  it('incrementEventsSurvived and incrementEnemiesDefeated increment counters', () => {
    incrementEventsSurvived();
    expect(gameState.eventsSurvived).toBe(1);
    incrementEnemiesDefeated();
    expect(gameState.enemiesDefeated).toBe(1);
  });

  it('rememberEventTitle pushes titles and caps at 3', () => {
    rememberEventTitle('A');
    rememberEventTitle('B');
    rememberEventTitle('C');
    rememberEventTitle('D');
    expect(gameState.recentEventTitles).toEqual(['B', 'C', 'D']);
    rememberEventTitle('');
    expect(gameState.recentEventTitles).toEqual(['B', 'C', 'D']);
  });

  it('setPurchasingPower and adjustPurchasingPower clamp between 1 and 100', () => {
    setPurchasingPower(50);
    expect(gameState.purchasingPower).toBe(50);
    adjustPurchasingPower(-60);
    expect(gameState.purchasingPower).toBe(1);
    adjustPurchasingPower(200);
    expect(gameState.purchasingPower).toBe(100);
  });

  it('adjustBTC clamps between 0 and 99', () => {
    adjustBTC(0.05);
    expect(gameState.btc).toBe(0.1);
    adjustBTC(-10);
    expect(gameState.btc).toBe(0);
    adjustBTC(200);
    expect(gameState.btc).toBe(99);
  });
});
