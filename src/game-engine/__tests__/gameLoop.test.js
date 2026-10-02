// Unit tests for the game loop orchestration.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createGameLoop } from '../gameLoop.js';
import { gameState, resetGame } from '../gameState.js';
import { CONFIG } from '../gameConfig.js';

describe.sequential('createGameLoop', () => {
  let loop;
  let rafId = 0;

  const mockScene = {
    update: vi.fn(),
  };

  beforeEach(() => {
    resetGame('Tester', 'road_warrior');
    rafId = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => { rafId += 1; return rafId; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    if (loop) loop.stop();
    vi.unstubAllGlobals();
  });

  it('ticks game state and updates the scene', () => {
    loop = createGameLoop({ scene: mockScene, onEventFire: vi.fn(), onCityStop: vi.fn() });
    const milesBefore = gameState.miles;
    loop.tickOnce(1); // 1 second
    expect(gameState.miles).toBeGreaterThan(milesBefore);
    expect(mockScene.update).toHaveBeenCalled();
  });

  it('fires an event after the timer elapses', () => {
    const onEventFire = vi.fn(() => { gameState.paused = true; });
    loop = createGameLoop({ scene: mockScene, onEventFire, onCityStop: vi.fn() });
    // Skip all city stops so the event timer can run down.
    gameState.lastStopIndex = 10;
    // Step enough time to exhaust the event timer (max 90s).
    for (let i = 0; i < 120; i++) {
      loop.tickOnce(1);
      if (onEventFire.mock.calls.length > 0) break;
    }
    expect(onEventFire).toHaveBeenCalled();
    expect(gameState.paused).toBe(true);
  });

  it('triggers arrival when miles reach TOTAL_MILES', () => {
    loop = createGameLoop({ scene: mockScene, onEventFire: vi.fn(), onCityStop: vi.fn(), onArrival: vi.fn() });
    gameState.miles = CONFIG.TOTAL_MILES;
    loop.tickOnce(0.016);
    expect(gameState.screen).toBe('arrival');
  });

  it('calls onCityStop when a city is reached', () => {
    const onCityStop = vi.fn();
    loop = createGameLoop({ scene: mockScene, onEventFire: vi.fn(), onCityStop });
    gameState.lastStopIndex = 0; // already passed LA
    gameState.miles = 130; // Tijuana
    loop.tickOnce(0.016);
    expect(onCityStop).toHaveBeenCalled();
    expect(gameState.paused).toBe(true);
  });

  it('resets the event timer', () => {
    const onEventFire = vi.fn();
    loop = createGameLoop({ scene: mockScene, onEventFire, onCityStop: vi.fn() });
    gameState.lastStopIndex = 99; // don't let a city stop pause the clock
    loop.resetEventTimer();
    const steps = Math.floor(CONFIG.EVENT_MIN_MS / 1000) - 1;
    for (let i = 0; i < steps; i++) loop.tickOnce(1);
    expect(onEventFire).not.toHaveBeenCalled();
  });
});
