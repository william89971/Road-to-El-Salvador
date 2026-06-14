// Game rules: the per-frame tick and event-effect application.
import { CONFIG } from './gameConfig.js';
import { gameState, clamp, endGame } from './gameState.js';

export function applyEffects(e) {
  if (!e) return;
  gameState.gas = clamp(gameState.gas + (e.gas || 0), 0, 100);
  gameState.suvHealth = clamp(gameState.suvHealth + (e.suvHealth || 0), 0, 100);
  gameState.vibes = clamp(gameState.vibes + (e.vibes || 0), 0, 5);
  gameState.cash = clamp(gameState.cash + (e.cash || 0), 0, 99999);
  gameState.btc = clamp(gameState.btc + (e.btc || 0), 0, 99);
  gameState.purchasingPower = clamp(gameState.purchasingPower + (e.purchasingPower || 0), 1, 100);
}

// call once per animation frame with delta seconds
export function tick(dt) {
  if (gameState.paused || gameState.screen !== 'playing') return;
  gameState.miles = clamp(gameState.miles + CONFIG.MILES_PER_SECOND * dt, 0, CONFIG.TOTAL_MILES);
  gameState.gas = clamp(gameState.gas - 1.2 * dt, 0, 100);
  gameState.timeOfDay = (gameState.timeOfDay + dt / 120) % 1; // 2-min day
  gameState.days = Math.floor(gameState.miles / 40);
  gameState.purchasingPower = clamp(
    gameState.purchasingPower * Math.pow(CONFIG.PP_DECAY_PER_TICK, dt * 60),
    1,
    100,
  );

  // BTC random walk, upward drift, ~once per simulated day
  if (Math.random() < dt * 0.5) {
    gameState.btcPrice = Math.max(1000, Math.round(gameState.btcPrice + (Math.random() - 0.46) * 1800));
    gameState.btcPriceHistory.push(gameState.btcPrice);
    if (gameState.btcPriceHistory.length > 60) gameState.btcPriceHistory.shift();
  }

  // loss conditions
  if (gameState.gas <= 0) endGame('Ran out of gas in the middle of nowhere.');
  if (gameState.suvHealth <= 0) endGame('The SUV finally died. No way forward.');
  if (gameState.vibes <= 0) endGame('The crew lost faith and flew home.');
}
