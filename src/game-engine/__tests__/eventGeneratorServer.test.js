// Test the server event-generation path of eventGenerator.js.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockGameState = {
  screen: 'playing',
  currentCity: 'Los Angeles',
  currentCountry: 'USA',
  biome: 'california',
  miles: 0,
  gas: 100,
  suvHealth: 100,
  vibes: 5,
  cash: 800,
  purchasingPower: 100,
  btc: 0.05,
  btcPrice: 64000,
  days: 0,
  recentEventTitles: [],
};

vi.mock('../gameStateAndRules.js', () => ({
  DEV_MODE: false,
  gameState: mockGameState,
}));

describe('getEvent server path', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns server event on success', async () => {
    const { getEvent } = await import('../../events/eventGenerator.js');
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        headline: 'Server Event',
        dateline: 'SERVER — Day 0',
        description: 'From the server.',
        canFight: false,
        choices: [{ label: 'OK', consequence: 'Fine.', effects: {} }],
      }),
    });
    const ev = await getEvent();
    expect(ev.headline).toBe('Server Event');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/event', expect.objectContaining({ method: 'POST' }));
  });

  it('falls back to mock event on server error', async () => {
    const { getEvent } = await import('../../events/eventGenerator.js');
    globalThis.fetch.mockRejectedValue(new Error('network error'));
    const ev = await getEvent();
    expect(ev.headline).toBeTruthy();
    expect(Array.isArray(ev.choices)).toBe(true);
  });

  it('falls back to mock event on invalid shape', async () => {
    const { getEvent } = await import('../../events/eventGenerator.js');
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ headline: 'Bad' }), // missing choices
    });
    const ev = await getEvent();
    expect(ev.headline).toBeTruthy();
    expect(Array.isArray(ev.choices)).toBe(true);
  });
});
