// Backward-compatible barrel — re-exports from single-responsibility modules.
// New code should import directly from the specific module:
//   import { CONFIG, LOADOUTS } from './gameConfig.js';
//   import { gameState, resetGame, clamp, endGame } from './gameState.js';
//   import { tick, applyEffects } from './gameRules.js';
export { DEV_MODE, CONFIG, LOADOUTS } from './gameConfig.js';
export { gameState, resetGame, clamp, endGame } from './gameState.js';
export { applyEffects, tick } from './gameRules.js';
