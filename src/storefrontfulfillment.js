// Quotes are selection hints only. Execution must revalidate the commitment and
// lock both characters before using the canonical depot purchase mutation.
export function chooseStorefrontPurchase({ businesses, characterId, district, good,
  maxQuantity, cargoSpace, cash, reserveCash, maxSpend, maxUnitPrice }) {
  const whole = (n) => Number.isSafeInteger(n) && n >= 0;
  if (!Array.isArray(businesses) || businesses.length > 100
      || ![characterId, district, good].every((s) => typeof s === 'string' && s.length > 0)
      || ![maxQuantity, cargoSpace, cash, reserveCash, maxSpend, maxUnitPrice].every(whole)) return null;
  const budget = Math.min(maxSpend, Math.max(0, cash - reserveCash));
  let best = null;
  for (const row of businesses) {
    if (!row || typeof row.id !== 'string' || !row.id.length
        || typeof row.ownerCharacterId !== 'string' || !row.ownerCharacterId.length
        || row.ownerCharacterId === characterId || row.district !== district || row.good !== good
        || !whole(row.stock) || !whole(row.unitPrice) || row.unitPrice < 1
        || row.unitPrice > maxUnitPrice) continue;
    const quantity = Math.min(maxQuantity, cargoSpace, row.stock, Math.floor(budget / row.unitPrice));
    const totalCash = quantity * row.unitPrice;
    if (!quantity || !Number.isSafeInteger(totalCash) || totalCash > budget) continue;
    const quote = { depotId: row.id, quantity, unitPrice: row.unitPrice, totalCash };
    if (!best || quantity > best.quantity || (quantity === best.quantity
        && (quote.unitPrice < best.unitPrice || (quote.unitPrice === best.unitPrice && quote.depotId < best.depotId)))) best = quote;
  }
  return best;
}
