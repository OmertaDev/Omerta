import { cityEventOf, goodPriceOf, pathFx, priceBlock, seasonModOf } from './rules.js';

// NPC shops quote a real bid/ask spread. Without a resale basis, the +5% turf
// buy edge and +5% turf sell edge cross even before the event/path/season
// multipliers: buying and immediately selling the same freight mints cash. The
// 70% bid retains wide geographic arbitrage while keeping every current legal
// modifier stack below the local ask.
export const GOODS_RESALE_BPS = 7000;

const cashTerms = (subtotal) => {
  const fee = Math.ceil(subtotal * 0.01);
  const tax = Math.ceil(subtotal * 0.01);
  return { fee, tax };
};

// Shared by procurement observations and settlement: round the turf-adjusted unit price
// first, then round each of the two cash takes independently.
export function goodsBuyQuote(good, district, quantity, owned = {}, block = priceBlock()) {
  const controlled = [...(owned.held || []), ...(owned.deedPerk || [])].includes(district);
  const unit = Math.round(goodPriceOf(good, district, block) * (controlled ? 0.95 : 1));
  const subtotal = unit * quantity;
  const { fee, tax } = cashTerms(subtotal);
  return { unit, subtotal, fee, tax, total: subtotal + fee + tax };
}

const sellNetAt = (unit, quantity) => {
  const gross = unit * quantity;
  const { fee, tax } = cashTerms(gross);
  return { gross, fee, tax, net: gross - fee - tax };
};

// The block fixes both the deterministic reference price and its UTC day. Callers
// may inject multiplier terms for exhaustive property tests; production derives
// the legal event/path/season terms from the same block and character state.
export function goodsSellQuote(good, district, quantity, owned = {}, ch = {}, block = priceBlock(), terms = {}) {
  const controlled = [...(owned.held || []), ...(owned.deedPerk || [])].includes(district);
  const day = Math.floor(block / 6);
  const eventMult = terms.eventMult ?? (cityEventOf(day).tradeMult || 1);
  const pathMult = terms.pathMult ?? pathFx(ch, 'goodsSell');
  const seasonMult = terms.seasonMult ?? (seasonModOf(Math.floor(day / 28)).tradeSellMult || 1);
  const rawUnit = Math.round(goodPriceOf(good, district, block)
    * GOODS_RESALE_BPS / 10000
    * (controlled ? 1.05 : 1)
    * eventMult * pathMult * seasonMult);
  // Cap the BID below the cheapest local ASK per unit (the turf-controlled ask), before either
  // side's separately-rounded takes. Using the seller's own turf state would leave a multi-account
  // seam: one account could buy with turf, transfer freight, and let a non-turf account sell against
  // a higher cap. A same-quantity exact-net clamp is also insufficient: buying 500 in one request
  // minimizes buy rounding, while selling 500 one at a time can exploit a higher quantity-specific
  // bid. The strict per-unit ordering proves every possible actor and request partition loses cash:
  // sell net <= (askUnit - 1) * Q < askUnit * Q <= buy total.
  const minimumAskUnit = goodsBuyQuote(good, district, quantity, { held: [district] }, block).unit;
  const unit = Math.min(rawUnit, Math.max(0, minimumAskUnit - 1));
  return { unit, ...sellNetAt(unit, quantity), basisBps: GOODS_RESALE_BPS, capped: unit < rawUnit };
}
