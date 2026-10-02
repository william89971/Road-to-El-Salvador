// The gallon is one purchase priced twice. Falling purchasing power raises the
// dollar price. A bitcoin price that rises faster than that pulls the sats price down.
import { describe, it, expect } from 'vitest';
import { gallonQuote } from '../money.js';
import { CONFIG } from '../gameConfig.js';

describe('gallon quoted in dollars and sats', () => {
  it('a falling purchasing power and a rising bitcoin price make the sats price fall while the dollar price rises', () => {
    const early = gallonQuote(100, CONFIG.START_BTC_PRICE);
    const late = gallonQuote(CONFIG.PP_END_RATIO * 100, CONFIG.START_BTC_PRICE * CONFIG.BTC_END_MULTIPLE);

    expect(late.dollars).toBeGreaterThan(early.dollars);
    expect(late.sats).toBeLessThan(early.sats);
    expect(early.dollars).toBe(40);
    expect(late.dollars).toBe(160);
  });
});
