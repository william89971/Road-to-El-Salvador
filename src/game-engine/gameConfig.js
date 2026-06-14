// Game-wide constants and configuration.
// These never change at runtime.

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

// Starting loadouts (chosen on the start screen). cash is the base; the
// difficulty multiplier still applies on top of it.
export const LOADOUTS = {
  backpacker:   { id: 'backpacker',   label: 'Backpacker',   cash: 400,  btc: 0.08, gas: 80,  blurb: 'Lean on cash, heavy on BTC.' },
  road_warrior: { id: 'road_warrior', label: 'Road Warrior', cash: 800,  btc: 0.05, gas: 100, blurb: 'Balanced. The intended way.' },
  cash_king:    { id: 'cash_king',    label: 'Cash King',    cash: 1400, btc: 0.01, gas: 100, blurb: 'Rich in fiat, poor in BTC — the hard way.' },
};
