// Game-wide constants and configuration.
// These never change at runtime.

export const DEV_MODE = true; // true = no API key needed, uses mock events

// A full tank covers 1,400 miles. The longest single gap is Hermosillo →
// Mexico City (780), so one fill always reaches the next city, but not two
// long legs back to back. Purchasing power is tied to miles, not frame rate,
// and lands near PP_END_RATIO at the border — cash still works, it just hurts.
const TOTAL_MILES = 2800;
const PP_END_RATIO = 0.25;

export const CONFIG = {
  TOTAL_MILES,
  MILES_PER_SECOND: 8,          // ~6 minutes of driving for the full route
  TANK_RANGE_MILES: 1400,
  GAS_PER_MILE: 100 / 1400,
  SUV_WEAR_PER_MILE: 12 / TOTAL_MILES, // the rig ages; events do the real damage
  SONORA_HEAT_PER_MILE: 0.04, // desert leg dents a healthy truck, it does not kill it
  START_CASH: 800,
  START_BTC: 0.05,
  START_BTC_PRICE: 64000,
  // By the border the coin has outrun the dollar, so the same gallon costs fewer sats.
  BTC_END_MULTIPLE: 5,
  BTC_DRIFT_PER_MILE: Math.log(5) / TOTAL_MILES,
  PP_END_RATIO,
  PP_DECAY_PER_MILE: -Math.log(PP_END_RATIO) / TOTAL_MILES,
  EVENT_MIN_MS: 28000,
  EVENT_MAX_MS: 52000,
};

// Starting loadouts (chosen on the start screen). cash is the base; the
// difficulty multiplier still applies on top of it.
export const LOADOUTS = {
  backpacker:   { id: 'backpacker',   label: 'Backpacker',   cash: 400,  btc: 0.08, gas: 80,  blurb: 'Lean on cash, heavy on BTC.' },
  road_warrior: { id: 'road_warrior', label: 'Road Warrior', cash: 800,  btc: 0.05, gas: 100, blurb: 'Balanced. The intended way.' },
  cash_king:    { id: 'cash_king',    label: 'Cash King',    cash: 1400, btc: 0.01, gas: 100, blurb: 'Rich in fiat, poor in BTC — the hard way.' },
};
