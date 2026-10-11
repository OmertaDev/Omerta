import { LOAN, loanOwed, loanVig, DISTRICTS, jailed, safeHoused } from './rules.js';
import { trunkCap } from './game.js';
import { DELIVERY } from './delivery.js';

const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const whole = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const number = value => typeof value === 'number' ? value
  : typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
const time = value => value instanceof Date ? value.getTime()
  : typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value ? Date.parse(value) : NaN;
const rejected = reason => ({ eligible: false, reason, fundsReserved: false, guaranteedIncome: false });

export function deliveryFinanceTerms(body) {
  const fields = ['supplierId', 'lenderId', 'commitmentId', 'principal', 'rate', 'hours'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || ![null, Object.prototype].includes(Object.getPrototypeOf(body))
      || Reflect.ownKeys(body).length !== fields.length || Reflect.ownKeys(body).some(field => !fields.includes(field))
      || fields.some(field => !Object.hasOwn(Object.getOwnPropertyDescriptor(body, field), 'value'))
      || !key(body.supplierId) || !key(body.lenderId) || !key(body.commitmentId) || body.supplierId === body.lenderId
      || !whole(body.principal, LOAN.MIN, LOAN.MAX) || typeof body.rate !== 'number' || !Number.isFinite(body.rate)
      || body.rate <= 0 || body.rate > LOAN.RATE_MAX || !whole(body.hours, LOAN.TERM_MIN_H, LOAN.TERM_MAX_H))
    throw new TypeError('Provide exact bounded delivery finance request terms.');
  return { supplierId: body.supplierId, lenderId: body.lenderId, commitmentId: body.commitmentId,
    principal: body.principal, rate: body.rate, hours: body.hours };
}

// This pure eligibility quote trusts the caller's canonical source observations. It
// authenticates nobody, reserves no money and creates no debt/receivable/payment claim.
export function deliveryFinanceQuote(body, context, now = Date.now()) {
  const terms = deliveryFinanceTerms(body);
  try {
    if (!Number.isSafeInteger(now) || now < 0 || !Number.isFinite(new Date(now).getTime())) return rejected('clock');
    const { supplier, lender, buyer, commitment: c, order, owned, acct = {} } = context || {};
    const parties = [supplier, lender, buyer];
    if (parties.some(p => !p?.alive || p.is_npc || !key(p.id) || !key(p.account_id))) return rejected('parties');
    if (new Set(parties.map(p => p.id)).size !== 3 || new Set(parties.map(p => p.account_id)).size !== 3
        || supplier.id !== terms.supplierId || lender.id !== terms.lenderId) return rejected('independent_parties');
    if (supplier.welsher) return rejected('welsher');
    if (jailed(lender) || safeHoused(lender) || jailed(supplier)) return rejected('status');
    if (!c || !order || c.id !== terms.commitmentId || c.supplier_character !== supplier.id || c.buyer_character !== buyer.id
        || c.status !== 'accepted' || c.good_id !== 'gin' || !key(c.order_id) || !key(c.depot_id)
        || order.id !== c.order_id || order.kind !== 'order' || order.status !== 'live' || order.good_id !== c.good_id
        || order.depot_id !== c.depot_id || order.seller_character !== buyer.id || order.district !== c.district
        || !DISTRICTS.some(d => d.id === c.district)) return rejected('source_terms');
    const quantity = number(c.quantity), remaining = number(c.remaining), unitPrice = number(c.unit_price), takeBps = number(c.take_bps);
    const budget = number(c.spend_limit), spent = number(c.spent), orderQty = number(order.qty), deadline = time(c.deadline), expires = time(order.expires_at);
    if (!whole(quantity, 1, DELIVERY.maxUnits) || remaining !== quantity || spent !== 0) return rejected('untouched_full_delivery');
    if (!whole(unitPrice, 50, 1000000) || number(order.price) !== unitPrice || !whole(takeBps, 0, 10000)
        || !whole(orderQty, quantity, DELIVERY.maxUnits) || !whole(budget, 1, DELIVERY.maxSpend)) return rejected('source_terms');
    if (!Number.isFinite(deadline) || !Number.isFinite(expires) || deadline <= now || expires < deadline) return rejected('deadline');
    if (terms.principal > budget) return rejected('procurement_budget');
    if (!owned || !Array.isArray(owned.assets) || !owned.cargo || typeof owned.cargo !== 'object' || Array.isArray(owned.cargo)) return rejected('trunk');
    const capacity = trunkCap({ owned, acct }), cargo = Object.entries(owned.cargo);
    if (!Number.isSafeInteger(capacity) || capacity < 0 || cargo.some(([,qty]) => !whole(number(qty), 0, Number.MAX_SAFE_INTEGER))) return rejected('trunk');
    const otherLoad = cargo.filter(([good]) => good !== 'gin').reduce((sum, [,qty]) => sum + number(qty), 0);
    if (quantity + otherLoad > capacity) return rejected('trunk');
    const availableCash = number(lender.cash);
    if (!Number.isFinite(availableCash) || availableCash < terms.principal || availableCash > Number.MAX_SAFE_INTEGER) return rejected('lender_cash');
    // An untouched commitment has zero previously delivered units. Match fillOrder's
    // cumulative ceil(new gross take)-ceil(previous gross take), NOT per-unit rounding.
    const gross = quantity * unitPrice, take = Math.ceil(gross * takeBps / 10000) - Math.ceil(0 * takeBps / 10000);
    const fullSettlementNet = gross - take, owed = loanOwed(terms.principal, terms.rate), vig = loanVig(owed);
    if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(owed) || fullSettlementNet < owed) return rejected('settlement_too_small');
    return { eligible: true, ...terms, buyerId: buyer.id, orderId: order.id, good: 'gin', districtId: c.district,
      quantity, unitPrice, takeBps, gross, take, fullSettlementNet, owed, vig, projectedLenderReceipt: owed - vig,
      projectedCashRemainder: fullSettlementNet - owed, deadline: new Date(deadline).toISOString(), trunkCapacity: capacity,
      maxActiveLoans: LOAN.MAX_ACTIVE, fundsReserved: false, guaranteedIncome: false,
      scope: 'Admission and locked-term settlement arithmetic only. Native consent, funded reserve, actual cargo sale and loan repayment must be revalidated; this is no backing, payout or profit guarantee.' };
  } catch { return rejected('source_terms'); }
}
