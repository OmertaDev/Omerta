import { GameError } from './game.js';

export const BUSINESS_DESK = Object.freeze({ defaultLimit: 20, maximumLimit: 50,
  scope: 'current_character_selected_business_and_travel', totalsScope: 'returned_rows' });
const categories = Object.freeze({
  'market:list': 'market', 'market:bid': 'market', 'market:refund': 'market',
  'market:sale': 'market', 'market:order': 'market', 'market:fill': 'market',
  'craft:recipe:hardened_steel': 'production',
  'multi_hop_courier:reserve': 'courier', 'multi_hop_courier:fee': 'courier', 'multi_hop_courier:refund': 'courier',
  'consignment:purchase': 'consignment', 'consignment:proceeds': 'consignment', 'consignment:host_fee': 'consignment',
  'depot:open': 'business_transfer', 'depot:fund': 'business_transfer', 'depot:withdraw': 'business_transfer',
  travel: 'travel',
});
const fail = reason => { throw new GameError('business_desk', reason); };

export function businessDeskLimit(query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)
      || Object.keys(query).some(key => key !== 'limit')) fail('terms');
  const value = query.limit === undefined ? BUSINESS_DESK.defaultLimit : query.limit;
  if ((typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9][0-9]?$/.test(value)))
      || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > BUSINESS_DESK.maximumLimit) fail('terms');
  return Number(value);
}

// PostgreSQL NUMERIC is decimal text. Sum only the returned rows without Number
// conversion, rounding, or treating escrow/refunds as accounting revenue/expense.
function decimal(value) {
  if (typeof value !== 'string' || !/^-?[0-9]+(?:\.[0-9]+)?$/.test(value)) fail('metrics');
  const negative = value.startsWith('-'), [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  return { units: BigInt(whole + fraction) * (negative ? -1n : 1n), scale: fraction.length };
}
function formatted(units, scale) {
  if (!units) return '0';
  const negative = units < 0n, digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  if (!scale) return (negative ? '-' : '') + digits;
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return (negative ? '-' : '') + digits.slice(0, -scale) + (fraction ? '.' + fraction : '');
}
function totals(rows) {
  const values = rows.map(row => decimal(row.amount)), scale = Math.max(0, ...values.map(value => value.scale));
  let income = 0n, outflow = 0n;
  for (const value of values) {
    const units = value.units * 10n ** BigInt(scale - value.scale);
    if (units > 0n) income += units;
    else outflow -= units;
  }
  return { income: formatted(income, scale), outflow: formatted(outflow, scale), netCashflow: formatted(income - outflow, scale) };
}

// The route supplies the authenticated living actor and the canonical read-only
// client. Character-only rows exclude house cash legs and earlier generations.
export async function businessDesk(client, ch, limit = BUSINESS_DESK.defaultLimit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > BUSINESS_DESK.maximumLimit) fail('terms');
  const balance = (await client.query(`SELECT cash::text AS cash,bank::text AS bank,clock_timestamp() AS observed_at
    FROM characters WHERE id=$1 AND account_id=$2 AND alive=true`, [ch.id, ch.account_id])).rows[0];
  if (!balance) fail('character');
  decimal(balance.cash); decimal(balance.bank);
  const selected = (await client.query(`SELECT id,at,amount::text AS amount,reason,counterparty FROM transactions
    WHERE character_id=$1 AND currency='cash' AND reason IN (
      'market:list','market:bid','market:refund','market:sale','market:order','market:fill',
      'craft:recipe:hardened_steel',
      'multi_hop_courier:reserve','multi_hop_courier:fee','multi_hop_courier:refund',
      'consignment:purchase','consignment:proceeds','consignment:host_fee',
      'depot:open','depot:fund','depot:withdraw','travel')
    ORDER BY at DESC,id DESC LIMIT $2`, [ch.id, limit + 1])).rows;
  const rows = selected.slice(0, limit).map(row => ({ id: row.id, at: new Date(row.at).toISOString(),
    amount: row.amount, reason: row.reason, category: categories[row.reason], counterparty: row.counterparty }));
  return { ok: true, currency: 'game_cash', observedAt: new Date(balance.observed_at).toISOString(),
    character: { id: ch.id, name: ch.name, cash: balance.cash, bank: balance.bank },
    cashflow: { scope: BUSINESS_DESK.scope, totalsScope: BUSINESS_DESK.totalsScope,
      limit, returned: rows.length, hasMore: selected.length > limit, ...totals(rows), rows,
      measurement: 'Selected cash movements for this character, including refunds, escrow and treasury transfers. Totals cover only the returned rows; they are not accounting profit or a reconciliation of the current cash balance.' } };
}
