export const DEV_MODE = true; // true = no API key needed, uses mock events

export const CONFIG = {
  TOTAL_MILES: 2800,
  MILES_PER_SECOND: 3.5,        // base travel speed
  START_CASH: 800,
  START_BTC: 0.05,
  START_BTC_PRICE: 64000,
  PP_DECAY_PER_TICK: 0.99985,   // purchasing-power multiplier each tick (~0.5%/day feel)
  EVENT_MIN_MS: 45000,
  EVENT_MAX_MS: 90000,
};

// starting loadouts (chosen on the start screen). cash is the base; the
// difficulty multiplier still applies on top of it.
export const LOADOUTS = {
  backpacker:   { id: 'backpacker',   label: 'Backpacker',   cash: 400,  btc: 0.08, gas: 80,  blurb: 'Lean on cash, heavy on BTC.' },
  road_warrior: { id: 'road_warrior', label: 'Road Warrior', cash: 800,  btc: 0.05, gas: 100, blurb: 'Balanced. The intended way.' },
  cash_king:    { id: 'cash_king',    label: 'Cash King',    cash: 1400, btc: 0.01, gas: 100, blurb: 'Rich in fiat, poor in BTC — the hard way.' },
};

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

export function resetGame(name, difficulty, loadout = LOADOUTS.road_warrior, suvColor = '#7a8c6e') {
  const mult = difficulty === 'satoshi' ? 0.5 : difficulty === 'tourist' ? 1.5 : 1;
  const lo = loadout || LOADOUTS.road_warrior;
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

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function applyEffects(e) {
  if (!e) return;
  gameState.gas = clamp(gameState.gas + (e.gas||0), 0, 100);
  gameState.suvHealth = clamp(gameState.suvHealth + (e.suvHealth||0), 0, 100);
  gameState.vibes = clamp(gameState.vibes + (e.vibes||0), 0, 5);
  gameState.cash = clamp(gameState.cash + (e.cash||0), 0, 99999);
  gameState.btc = clamp(gameState.btc + (e.btc||0), 0, 99);
  gameState.purchasingPower = clamp(gameState.purchasingPower + (e.purchasingPower||0), 1, 100);
}

// call once per animation frame with delta seconds
export function tick(dt) {
  if (gameState.paused || gameState.screen !== 'playing') return;
  gameState.miles = clamp(gameState.miles + CONFIG.MILES_PER_SECOND * dt, 0, CONFIG.TOTAL_MILES);
  gameState.gas = clamp(gameState.gas - 1.2 * dt, 0, 100);
  gameState.timeOfDay = (gameState.timeOfDay + dt / 120) % 1; // 2-min day
  gameState.days = Math.floor(gameState.miles / 40);
  gameState.purchasingPower = clamp(gameState.purchasingPower * Math.pow(CONFIG.PP_DECAY_PER_TICK, dt*60), 1, 100);

  // BTC random walk, upward drift, ~once per simulated day
  if (Math.random() < dt * 0.5) {
    gameState.btcPrice = Math.max(1000, Math.round(gameState.btcPrice + (Math.random() - 0.46) * 1800));
    gameState.btcPriceHistory.push(gameState.btcPrice);
    if (gameState.btcPriceHistory.length > 60) gameState.btcPriceHistory.shift();
  }

  // loss conditions
  if (gameState.gas <= 0)        endGame('Ran out of gas in the middle of nowhere.');
  if (gameState.suvHealth <= 0)  endGame('The SUV finally died. No way forward.');
  if (gameState.vibes <= 0)      endGame('The crew lost faith and flew home.');
}

export function endGame(reason) {
  gameState.gameoverReason = reason;
  gameState.screen = 'gameover';
}
