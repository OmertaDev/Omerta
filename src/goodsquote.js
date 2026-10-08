import { goodPriceOf } from './rules.js';

// Shared by procurement observations and settlement: round the turf-adjusted unit price
// first, then round each of the two cash takes independently.
export function goodsBuyQuote(good, district, quantity, owned) {
  const controlled = [...(owned.held || []), ...(owned.deedPerk || [])].includes(district);
  const unit = Math.round(goodPriceOf(good, district) * (controlled ? 0.95 : 1));
  const subtotal = unit * quantity;
  const fee = Math.ceil(subtotal * 0.01);
  const tax = Math.ceil(subtotal * 0.01);
  return { unit, subtotal, fee, tax, total: subtotal + fee + tax };
}
