// B1 — unit test for endGame().
// endGame(reason) must set screen to 'gameover' and gameoverReason to the passed-in reason.
import { describe, it, expect, beforeEach } from 'vitest';
import { endGame, gameState } from '../gameState.js';

describe('endGame()', () => {
  beforeEach(() => {
    gameState.screen = 'route';
    gameState.gameoverReason = null;
  });

  it('sets screen to gameover and gameoverReason to the given reason', () => {
    endGame('out of gas');
    expect(gameState.screen).toBe('gameover');
    expect(gameState.gameoverReason).toBe('out of gas');
  });
});