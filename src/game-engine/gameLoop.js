// Game loop: owns requestAnimationFrame, physics/state ticks, event scheduling,
// city-stop detection, and arrival detection. It reads from gameState and calls
// back into the controller for UI state changes and audio reactions.

import { gameState, tick, CONFIG } from './gameStateAndRules.js';
import { ROUTE } from '../map-data/citiesAndRoute.js';
import {
  setPaused, setScreen, setLastStopIndex,
  setBiomeCity,
} from './gameActions.js';

export function createGameLoop({ scene, onEventFire, onCityStop, onArrival, onAudioReact }) {
  let raf = null;
  let last = performance.now();
  let eventTimer = scheduleNextEvent();

  function scheduleNextEvent() {
    return CONFIG.EVENT_MIN_MS + Math.random() * (CONFIG.EVENT_MAX_MS - CONFIG.EVENT_MIN_MS);
  }

  function handleCityStops() {
    if (gameState.screen !== 'playing') return;
    for (let i = ROUTE.length - 1; i > gameState.lastStopIndex; i--) {
      if (gameState.miles >= ROUTE[i].mile) {
        const stop = ROUTE[i];
        setLastStopIndex(i);
        setBiomeCity(stop.biome, stop.name, stop.country);
        if (i < ROUTE.length - 1) {
          setPaused(true);
          onCityStop(stop, i);
        }
        break;
      }
    }
  }

  function handleArrival() {
    if (gameState.screen === 'playing' && gameState.miles >= CONFIG.TOTAL_MILES) {
      setScreen('arrival');
      if (onArrival) onArrival();
    }
  }

  function update(dt) {
    tick(dt);
    handleCityStops();
    if (gameState.screen === 'playing' && !gameState.paused) {
      eventTimer -= dt * 1000;
      if (eventTimer <= 0) { onEventFire(); eventTimer = scheduleNextEvent(); }
    }
    handleArrival();
    if (onAudioReact) onAudioReact();

    scene.update(dt);
  }

  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    raf = requestAnimationFrame(step);
  }

  function start() {
    last = performance.now();
    eventTimer = scheduleNextEvent();
    raf = requestAnimationFrame(step);
  }

  function stop() {
    cancelAnimationFrame(raf);
  }

  // Test-only: advance the loop by a fixed dt without using requestAnimationFrame.
  function tickOnce(dt) {
    last += dt * 1000;
    update(dt);
  }

  return { start, stop, tickOnce, resetEventTimer: () => { eventTimer = scheduleNextEvent(); } };
}
