import { CONSTANTS, DISTRICTS, GOODS, jailed, safeHoused } from './rules.js';

// Continuation of an already accepted delivery, not authorization to accept a new one.
// Cargo remains in the supplier's ordinary trunk; execution rechecks the native commitment.
export function planCommittedCargo(ch, owned, commitment, policy, now = Date.now()) {
  if (!commitment || commitment.status !== 'accepted' || commitment.supplierId !== ch?.id) return null;
  const blocked = (blockedReason) => ({ blockedReason });
  const whole = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
  if (!Number.isFinite(now) || !Number.isFinite(new Date(commitment.deadline).getTime())
      || new Date(commitment.deadline).getTime() <= now) return blocked('deadline');
  if (jailed(ch, now) || safeHoused(ch, now)) return blocked('status');
  if (typeof commitment.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(commitment.id)
      || !GOODS.some((g) => g.id === commitment.good)
      || !DISTRICTS.some((d) => d.id === commitment.district)
      || !DISTRICTS.some((d) => d.id === ch.loc)
      || !whole(commitment.quantity, 1, 40) || !whole(commitment.remaining, 1, commitment.quantity)
      || !whole(commitment.unitPrice, 1, 1000000) || !whole(commitment.takeBps, 0, 10000)
      || !whole(commitment.maxProcurementCash, 1, 100000) || !whole(commitment.spent, 0, commitment.maxProcurementCash)
      || !whole(Number(ch.cash), 0, Number.MAX_SAFE_INTEGER)
      || !whole(policy?.cashReserve, 1000, Number.MAX_SAFE_INTEGER)) return blocked('terms');
  const cargo = Number(owned?.cargo?.[commitment.good] || 0);
  if (!whole(cargo, 0, Number.MAX_SAFE_INTEGER)) return blocked('cargo');
  const qty = Math.min(cargo, commitment.remaining);
  if (!qty) return null;
  const done = commitment.quantity - commitment.remaining;
  const gross = qty * commitment.unitPrice;
  const take = Math.ceil((done + qty) * commitment.unitPrice * commitment.takeBps / 10000)
    - Math.ceil(done * commitment.unitPrice * commitment.takeBps / 10000);
  const net = gross - take;
  const travelCash = ch.loc === commitment.district ? 0 : CONSTANTS.TRAVEL_COST;
  if (!Number.isSafeInteger(Number(ch.cash) - travelCash + net)) return blocked('cash_capacity');
  if (travelCash && commitment.spent + travelCash > commitment.maxProcurementCash) return blocked('budget');
  if (travelCash && Number(ch.cash) - travelCash < policy.cashReserve) return blocked('reserve');
  if (net - travelCash <= 0) return blocked('incremental_cash');
  return {
    kind: travelCash ? 'delivery_travel' : 'delivery_deliver',
    body: travelCash ? { commitmentId: commitment.id, district: commitment.district }
      : { commitmentId: commitment.id, qty },
    quantity: qty, gross, take, net, travelCash, incrementalCash: net - travelCash,
    inventory: { good: commitment.good, quantity: qty },
    basis: 'Existing committed payout after cumulative market take and required travel. Cargo value is separate; arrival and profit are not guaranteed.',
  };
}
