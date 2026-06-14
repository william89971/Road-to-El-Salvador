// Mutable game state and state-management functions.
import { CONFIG } from './gameConfig.js';

export const gameState = {
  screen: 'start',     // 'start' | 'playing' | 'gameover' | 'arrival' | 'victory'
  paused: false,
  playerName: '',
  difficulty: 'road_warrior', // 'tourist' | 'road_warrior' | 'satoshi'
  suvColor: '#7a8c6e',        // chosen SUV paint
  loadoutId: 'road_warrior',  // chosen starting loadout
  startCash: 800,             // cash at the start of this run (for the HUD baseline)

  miles: 0,
  days: 0,
  currentCity: 'Los Angeles',
  currentCountry: 'USA',
  biome: 'california',
  timeOfDay: 0.35,     // 0..1, drives day/night (0.35 = midday so LA starts sunny)

  gas: 100,
  suvHealth: 100,
  vibes: 5,
  cash: 800,
  btc: 0.05,

  btcPrice: 64000,
  btcPriceHistory: [64000], // last 60 values, for sparkline
  purchasingPower: 100,     // 100 -> shrinks toward 1

  recentEventTitles: [],
  lastStopIndex: -1,
  enemiesDefeated: 0,
  eventsSurvived: 0,
  gameoverReason: '',
};

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function resetGame(name, difficulty, loadout, suvColor = '#7a8c6e') {
  const mult = difficulty === 'satoshi' ? 0.5 : difficulty === 'tourist' ? 1.5 : 1;
  const lo = loadout || { cash: 800, btc: 0.05, gas: 100, id: 'road_warrior' };
  const cash = Math.round(lo.cash * mult);
  Object.assign(gameState, {
    screen: 'playing', paused: false, playerName: name, difficulty, suvColor, loadoutId: lo.id,
    miles: 0, days: 0, currentCity: 'Los Angeles', currentCountry: 'USA',
    biome: 'california', timeOfDay: 0.35,
    gas: lo.gas, suvHealth: 100, vibes: 5,
    cash, startCash: cash, btc: lo.btc,
    btcPrice: CONFIG.START_BTC_PRICE, btcPriceHistory: [CONFIG.START_BTC_PRICE],
    purchasingPower: 100, recentEventTitles: [], lastStopIndex: -1,
    enemiesDefeated: 0, eventsSurvived: 0, gameoverReason: '',
  });
}

export function endGame(reason) {
  gameState.gameoverReason = reason;
  gameState.screen = 'gameover';
}
