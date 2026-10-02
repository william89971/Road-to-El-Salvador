// One gallon, two prices. Dollars inflate with purchasing power. Sats are that
// same dollar price divided by the bitcoin price. The spread is the lesson.

export const GALLON_BASE = 40;

export function dollarPrice(base, purchasingPower) {
  const pp = Math.max(1, purchasingPower || 1);
  return Math.round(base / (pp / 100));
}

export function satsForDollars(dollars, btcPrice) {
  if (!btcPrice || btcPrice <= 0) return 0;
  return Math.max(0, Math.round((dollars / btcPrice) * 1e8));
}

export function gallonQuote(purchasingPower, btcPrice, base = GALLON_BASE) {
  const dollars = dollarPrice(base, purchasingPower);
  return { dollars, sats: satsForDollars(dollars, btcPrice) };
}
