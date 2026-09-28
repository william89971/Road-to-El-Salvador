// Explicit action functions for mutating gameState.
// Keeping the state object mutable preserves compatibility with the existing
// game loop and Three.js scene, while giving components a single place to
// perform state changes (easier to test and reason about).

import { gameState, clamp } from './gameStateAndRules.js';

export function setScreen(screen) { gameState.screen = screen; }
export function setPaused(paused) { gameState.paused = paused; }
export function togglePause() { gameState.paused = !gameState.paused; }

export function spendCash(amount) {
  gameState.cash = clamp(gameState.cash - amount, 0, 99999);
}
export function addCash(amount) {
  gameState.cash = clamp(gameState.cash + amount, 0, 99999);
}

export function consumeGas(amount) {
  gameState.gas = clamp(gameState.gas - amount, 0, 100);
}
export function refuel() {
  gameState.gas = 100;
}

export function damageSUV(amount) {
  gameState.suvHealth = clamp(gameState.suvHealth - amount, 0, 100);
}
export function repairSUV() {
  gameState.suvHealth = 100;
}

export function adjustVibes(delta) {
  gameState.vibes = clamp(gameState.vibes + delta, 0, 5);
}

export function setCurrentStop(index) {
  gameState.cityStopIndex = index;
}
export function clearStop() {
  gameState.cityStopIndex = -1;
}

export function setBiomeCity(biome, city, country) {
  gameState.biome = biome;
  gameState.currentCity = city;
  gameState.currentCountry = country;
}

export function setLastStopIndex(index) {
  gameState.lastStopIndex = index;
}

export function incrementEventsSurvived() {
  gameState.eventsSurvived++;
}
export function incrementEnemiesDefeated() {
  gameState.enemiesDefeated++;
}

export function rememberEventTitle(title) {
  if (!title) return;
  gameState.recentEventTitles.push(title);
  if (gameState.recentEventTitles.length > 8) gameState.recentEventTitles.shift();
}

export function setPurchasingPower(pp) {
  gameState.purchasingPower = clamp(pp, 1, 100);
}

export function adjustPurchasingPower(delta) {
  gameState.purchasingPower = clamp(gameState.purchasingPower + delta, 1, 100);
}

export function adjustBTC(delta) {
  gameState.btc = clamp(gameState.btc + delta, 0, 99);
}
