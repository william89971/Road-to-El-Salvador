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
  startBtc: 0.05,             // stack at the start of this run (for the scorecard)
  cityStopIndex: -1,          // -1 = on the road; >= 0 = shop open at that stop

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
  btcExact: 64000,          // unrounded walk; the HUD prints btcPrice in steps
  btcPrinted: 64000,        // last price this walk published
  btcPriceHistory: [64000], // last 60 values, for sparkline
  purchasingPower: 100,     // 100 -> shrinks toward 1

  recentEventTitles: [],
  lastStopIndex: -1,
  enemiesDefeated: 0,
  eventsSurvived: 0,
  gameoverReason: '',
  paidLastGallonInSats: false,
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
    cash, startCash: cash, btc: lo.btc, startBtc: lo.btc,
    btcPrice: CONFIG.START_BTC_PRICE, btcExact: CONFIG.START_BTC_PRICE, btcPrinted: CONFIG.START_BTC_PRICE,
    btcPriceHistory: [CONFIG.START_BTC_PRICE],
    purchasingPower: 100, recentEventTitles: [], lastStopIndex: -1, cityStopIndex: -1,
    enemiesDefeated: 0, eventsSurvived: 0, gameoverReason: '',
    paidLastGallonInSats: false,
  });
}

export function endGame(reason) {
  gameState.gameoverReason = reason;
  gameState.screen = 'gameover';
}
