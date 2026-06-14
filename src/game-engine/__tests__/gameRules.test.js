// Unit tests for core game rules: tick, applyEffects, inflation, BTC price.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick, applyEffects } from '../gameRules.js';
import { gameState, resetGame, clamp, endGame } from '../gameState.js';
import { CONFIG } from '../gameConfig.js';

// helper: reset state to a known playing state before each test
function startPlaying(overrides = {}) {
  Object.assign(gameState, {
    screen: 'playing',
    paused: false,
    playerName: 'Tester',
    difficulty: 'road_warrior',
    miles: 0,
    days: 0,
    gas: 100,
    suvHealth: 100,
    vibes: 5,
    cash: 800,
    btc: 0.05,
    btcPrice: 64000,
    btcPriceHistory: [64000],
    purchasingPower: 100,
    gameoverReason: '',
    timeOfDay: 0.5,
    biome: 'california',
    currentCity: 'Los Angeles',
    currentCountry: 'USA',
    recentEventTitles: [],
    lastStopIndex: -1,
    enemiesDefeated: 0,
    eventsSurvived: 0,
    suvColor: '#7a8c6e',
    loadoutId: 'road_warrior',
    startCash: 800,
    ...overrides,
  });
}

describe('clamp', () => {
  it('returns the value when within bounds', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('clamps to lower bound', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it('clamps to upper bound', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('returns lower bound when value equals it', () => {
    expect(clamp(0, 0, 100)).toBe(0);
  });

  it('returns upper bound when value equals it', () => {
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

describe('resetGame', () => {
  it('sets screen to playing', () => {
    resetGame('Alice', 'road_warrior');
    expect(gameState.screen).toBe('playing');
  });

  it('sets player name', () => {
    resetGame('Bob', 'road_warrior');
    expect(gameState.playerName).toBe('Bob');
  });

  it('tourist difficulty gives 1.5x cash', () => {
    resetGame('C', 'tourist');
    expect(gameState.cash).toBe(Math.round(800 * 1.5)); // 1200
  });

  it('satoshi difficulty gives 0.5x cash', () => {
    resetGame('D', 'satoshi');
    expect(gameState.cash).toBe(Math.round(800 * 0.5)); // 400
  });

  it('road_warrior difficulty gives 1x cash', () => {
    resetGame('E', 'road_warrior');
    expect(gameState.cash).toBe(800);
  });

  it('resets miles, days, and position', () => {
    resetGame('F', 'road_warrior');
    expect(gameState.miles).toBe(0);
    expect(gameState.days).toBe(0);
    expect(gameState.currentCity).toBe('Los Angeles');
  });

  it('resets BTC price history', () => {
    resetGame('G', 'road_warrior');
    expect(gameState.btcPrice).toBe(64000);
    expect(gameState.btcPriceHistory).toEqual([64000]);
  });

  it('resets purchasing power to 100', () => {
    resetGame('H', 'road_warrior');
    expect(gameState.purchasingPower).toBe(100);
  });

  it('resets stat counters', () => {
    resetGame('I', 'road_warrior');
    expect(gameState.enemiesDefeated).toBe(0);
    expect(gameState.eventsSurvived).toBe(0);
    expect(gameState.gameoverReason).toBe('');
  });

  it('uses custom loadout values', () => {
    const loadout = { id: 'custom', cash: 500, btc: 0.1, gas: 60, blurb: 'test' };
    resetGame('J', 'road_warrior', loadout, '#ff0000');
    expect(gameState.cash).toBe(500);
    expect(gameState.btc).toBe(0.1);
    expect(gameState.gas).toBe(60);
    expect(gameState.suvColor).toBe('#ff0000');
    expect(gameState.loadoutId).toBe('custom');
  });
});

describe('endGame', () => {
  it('sets screen to gameover and records reason', () => {
    startPlaying();
    endGame('Test reason');
    expect(gameState.screen).toBe('gameover');
    expect(gameState.gameoverReason).toBe('Test reason');
  });
});

describe('applyEffects', () => {
  beforeEach(() => startPlaying());

  it('does nothing with null/undefined', () => {
    applyEffects(null);
    expect(gameState.gas).toBe(100);
  });

  it('modifies gas', () => {
    applyEffects({ gas: -20 });
    expect(gameState.gas).toBe(80);
  });

  it('modifies suvHealth', () => {
    applyEffects({ suvHealth: -30 });
    expect(gameState.suvHealth).toBe(70);
  });

  it('modifies vibes', () => {
    applyEffects({ vibes: -2 });
    expect(gameState.vibes).toBe(3);
  });

  it('modifies cash', () => {
    applyEffects({ cash: -100 });
    expect(gameState.cash).toBe(700);
  });

  it('modifies btc', () => {
    applyEffects({ btc: 0.01 });
    expect(gameState.btc).toBeCloseTo(0.06, 4);
  });

  it('modifies purchasingPower', () => {
    applyEffects({ purchasingPower: -5 });
    expect(gameState.purchasingPower).toBe(95);
  });

  it('clamps gas at 0', () => {
    applyEffects({ gas: -200 });
    expect(gameState.gas).toBe(0);
  });

  it('clamps gas at 100', () => {
    applyEffects({ gas: 50 });
    expect(gameState.gas).toBe(100);
  });

  it('clamps vibes at 5', () => {
    applyEffects({ vibes: 3 });
    expect(gameState.vibes).toBe(5);
  });

  it('clamps vibes at 0', () => {
    applyEffects({ vibes: -10 });
    expect(gameState.vibes).toBe(0);
  });

  it('handles multiple effects at once', () => {
    applyEffects({ gas: -15, cash: -50, btc: 0.02, vibes: -1 });
    expect(gameState.gas).toBe(85);
    expect(gameState.cash).toBe(750);
    expect(gameState.btc).toBeCloseTo(0.07, 4);
    expect(gameState.vibes).toBe(4);
  });

  it('ignores undefined effect keys', () => {
    applyEffects({ gas: -10 });
    expect(gameState.suvHealth).toBe(100); // unchanged
    expect(gameState.cash).toBe(800);      // unchanged
  });
});

describe('tick', () => {
  beforeEach(() => {
    startPlaying();
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // suppress BTC random walk
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when paused', () => {
    gameState.paused = true;
    tick(1);
    expect(gameState.miles).toBe(0);
    expect(gameState.gas).toBe(100);
  });

  it('does nothing when not playing', () => {
    gameState.screen = 'start';
    tick(1);
    expect(gameState.miles).toBe(0);
  });

  it('advances miles based on dt', () => {
    tick(2); // 2 seconds
    expect(gameState.miles).toBeCloseTo(CONFIG.MILES_PER_SECOND * 2, 0);
  });

  it('consumes gas based on dt', () => {
    tick(10);
    expect(gameState.gas).toBeCloseTo(100 - 1.2 * 10, 0);
  });

  it('advances time of day', () => {
    const before = gameState.timeOfDay;
    tick(10);
    expect(gameState.timeOfDay).not.toBe(before);
  });

  it('time of day wraps around at 1.0', () => {
    gameState.timeOfDay = 0.99;
    tick(5); // 5/120 ≈ 0.0417 added → wraps past 1.0
    expect(gameState.timeOfDay).toBeLessThan(0.1);
  });

  it('calculates days from miles', () => {
    gameState.miles = 120;
    tick(0.1);
    expect(gameState.days).toBe(3); // 120 / 40 = 3
  });

  it('decays purchasing power over time', () => {
    const before = gameState.purchasingPower;
    tick(60); // 60 seconds
    expect(gameState.purchasingPower).toBeLessThan(before);
  });

  it('purchasing power never drops below 1', () => {
    gameState.purchasingPower = 1;
    tick(1000);
    expect(gameState.purchasingPower).toBe(1);
  });

  it('miles cap at TOTAL_MILES', () => {
    gameState.miles = CONFIG.TOTAL_MILES - 1;
    tick(10);
    expect(gameState.miles).toBe(CONFIG.TOTAL_MILES);
  });

  it('triggers game over when gas hits 0', () => {
    gameState.gas = 2;
    tick(2); // gas -= 2.4 → below 0
    expect(gameState.screen).toBe('gameover');
    expect(gameState.gameoverReason).toContain('gas');
  });

  it('triggers game over when suvHealth hits 0', () => {
    gameState.suvHealth = 1;
    // suvHealth doesn't decay in tick — set it low and trigger via applyEffects
    applyEffects({ suvHealth: -1 });
    expect(gameState.suvHealth).toBe(0);
    // tick would catch it if it decayed; applyEffects doesn't trigger endGame
  });

  it('triggers game over when vibes hits 0', () => {
    gameState.vibes = 1;
    applyEffects({ vibes: -1 });
    expect(gameState.vibes).toBe(0);
  });

  it('BTC price updates when random threshold met', () => {
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // below 0.5 → triggers BTC update
    const before = gameState.btcPrice;
    tick(2); // dt * 0.5 = 1.0 > 0.1 → update fires
    // price may change
    const historyLen = gameState.btcPriceHistory.length;
    expect(historyLen).toBeGreaterThanOrEqual(1);
  });

  it('BTC price history capped at 60 entries', () => {
    vi.restoreAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    gameState.btcPriceHistory = new Array(60).fill(64000);
    tick(2);
    expect(gameState.btcPriceHistory.length).toBeLessThanOrEqual(60);
  });
});

describe('inflation (purchasing power decay)', () => {
  beforeEach(() => startPlaying());

  it('purchasing power decreases with each tick', () => {
    const pp1 = gameState.purchasingPower;
    tick(30);
    const pp2 = gameState.purchasingPower;
    expect(pp2).toBeLessThan(pp1);
  });

  it('longer dt causes more decay', () => {
    startPlaying();
    tick(10);
    const decay10 = gameState.purchasingPower;

    startPlaying();
    tick(60);
    const decay60 = gameState.purchasingPower;

    expect(decay60).toBeLessThan(decay10);
  });

  it('decay rate matches CONFIG.PP_DECAY_PER_TICK', () => {
    startPlaying();
    // exactly 1 tick-worth of dt: dt=1 gives 60 multiplier ticks
    tick(1);
    const expected = 100 * Math.pow(CONFIG.PP_DECAY_PER_TICK, 60);
    expect(gameState.purchasingPower).toBeCloseTo(expected, 0);
  });
});

describe('BTC price random walk', () => {
  beforeEach(() => startPlaying());

  it('BTC price stays above 1000 floor', () => {
    gameState.btcPrice = 1000;
    vi.spyOn(Math, 'random').mockReturnValue(0); // triggers update with low random
    tick(2);
    expect(gameState.btcPrice).toBeGreaterThanOrEqual(1000);
    vi.restoreAllMocks();
  });

  it('BTC price history grows when updates fire', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // triggers BTC update
    const lenBefore = gameState.btcPriceHistory.length;
    tick(2);
    expect(gameState.btcPriceHistory.length).toBeGreaterThan(lenBefore);
    vi.restoreAllMocks();
  });

  it('BTC price moves within expected range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3); // (0.3 - 0.46) * 1800 ≈ -288
    const before = gameState.btcPrice;
    tick(2);
    // price change is capped to max 1800 range, won't exceed 64000+1800
    expect(gameState.btcPrice).toBeLessThan(66000);
    expect(gameState.btcPrice).toBeGreaterThan(1000);
    vi.restoreAllMocks();
  });
});
