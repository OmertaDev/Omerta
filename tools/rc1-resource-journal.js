// Read-only proof observer. The game's ledgers and receipts remain authoritative.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const sha256 = (value) => crypto.createHash('sha256').update(typeof value === 'string'
  ? value : JSON.stringify(value)).digest('hex');

// NUMERIC cash is not restricted to cents. Preserve every decimal digit returned
// by PostgreSQL instead of rounding a disagreement out of the evidence.
export function exactDecimal(value) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));
  assert(match, `Nondecimal resource quantity: ${value}`);
  return { coefficient: BigInt(`${match[1]}${match[2]}${match[3] || ''}`), scale: (match[3] || '').length };
}
export function exactSum(values) {
  const decimals = values.map(exactDecimal), scale = Math.max(0, ...decimals.map((v) => v.scale));
  const sum = decimals.reduce((n, value) => n + value.coefficient * 10n ** BigInt(scale - value.scale), 0n);
  const sign = sum < 0n ? '-' : '', digits = (sum < 0n ? -sum : sum).toString().padStart(scale + 1, '0');
  const result = scale ? `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}` : `${sign}${digits}`;
  return result.includes('.') ? result.replace(/0+$/, '').replace(/\.$/, '') : result;
}
export const negate = (value) => String(value).startsWith('-') ? String(value).slice(1) : `-${value}`;
export function equation({ resource, owner, before, after, created = '0', destroyed = '0', transferredIn = '0', transferredOut = '0', authority }) {
  assert(authority?.length, 'Every movement needs an authoritative receipt or existing rule');
  const expected = exactSum([before, created, negate(destroyed), transferredIn, negate(transferredOut)]);
  const row = { resource, owner, before: exactSum([before]), after: exactSum([after]), created: exactSum([created]),
    destroyed: exactSum([destroyed]), transferredIn: exactSum([transferredIn]), transferredOut: exactSum([transferredOut]), expected,
    drift: exactSum([after, negate(expected)]), authority };
  assert.equal(row.drift, '0', `Unreconciled resource movement: ${JSON.stringify(row)}`);
  return row;
}

const QUERIES = {
  characters: 'SELECT id,account_id,cash::text,bank::text,shipment,alive FROM characters ORDER BY id',
  accounts: 'SELECT account_id,omr::text,staked::text,rewards::text,unbonding::text FROM account_persistent ORDER BY account_id',
  transactions: 'SELECT id,character_id,account_id,currency,amount::text,reason,counterparty FROM transactions ORDER BY id',
  stacks: 'SELECT owner_scope,owner_id,template_id,quality,quantity FROM item_stacks ORDER BY owner_scope,owner_id,template_id,quality',
  items: 'SELECT id,template_id,owner_scope,owner_id,state FROM item_instances ORDER BY id',
  itemEvents: 'SELECT * FROM item_events ORDER BY sequence',
  guards: 'SELECT idempotency_key,mutation_kind,result_json FROM item_mutation_guards ORDER BY idempotency_key',
  cars: 'SELECT id,character_id,model_id,rarity,minted_onchain FROM cars ORDER BY id',
  families: 'SELECT id,treasury::text,omr_reserve::text,ammo_bank FROM gangs ORDER BY id',
  desk: 'SELECT id,balance::text,lifetime_in::text,lifetime_sold::text,lifetime_bought::text FROM desk_inventory ORDER BY id',
  loans: 'SELECT * FROM loans ORDER BY id',
  streetTax: 'SELECT id,pool::text FROM street_tax ORDER BY id',
  loanHouse: 'SELECT id,pool::text FROM loan_house ORDER BY id',
  shipmentDays: 'SELECT * FROM shipment_days ORDER BY day',
  shipmentTakes: 'SELECT * FROM shipment_takes ORDER BY day,character_id',
  pieces: 'SELECT * FROM bespoke_pieces ORDER BY commission_id,serial',
  serials: 'SELECT * FROM bespoke_serials ORDER BY commission_id',
  campaigns: 'SELECT * FROM campaign_progress ORDER BY character_id,campaign_id',
};

// All buckets and receipts share one committed snapshot. Call after an isolated
// serial command, or once after the complete concurrently submitted batch.
export async function resourceSnapshot(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = {};
    for (const [name, sql] of Object.entries(QUERIES)) result[name] = (await client.query(sql)).rows;
    result.databaseBoundary = (await client.query('SELECT pg_current_snapshot()::text AS snapshot')).rows[0].snapshot;
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export const stateWithoutBoundary = ({ databaseBoundary, ...state }) => state;
export function addedRows(before, after, identity = 'id') {
  const previous = new Set(before.map((row) => row[identity]));
  return after.filter((row) => !previous.has(row[identity]));
}

export function reconcileStacks(before, after) {
  const events = addedRows(before.itemEvents, after.itemEvents, 'id');
  const key = (row) => `${row.owner_scope}/${row.owner_id}/${row.template_id}/${row.quality}`;
  const prior = new Map(before.stacks.map((row) => [key(row), row]));
  const final = new Map(after.stacks.map((row) => [key(row), row]));
  return [...new Set([...prior.keys(), ...final.keys()])].sort().map((identity) => {
    const row = final.get(identity) || prior.get(identity);
    const owned = events.filter((event) => event.template_id === row.template_id && event.quality === row.quality
      && ((event.to_owner_scope === row.owner_scope && event.to_owner_id === row.owner_id)
        || (event.from_owner_scope === row.owner_scope && event.from_owner_id === row.owner_id)) && event.quantity_delta != null);
    for (const event of owned) assert.equal(exactSum([event.quantity_before, event.quantity_delta]), String(event.quantity_after), 'Internal item-event equation');
    return equation({ resource: `${row.template_id}/${row.quality}`, owner: `${row.owner_scope}/${row.owner_id}`,
      before: prior.get(identity)?.quantity || 0, after: final.get(identity)?.quantity || 0,
      created: exactSum(owned.filter((e) => e.event_kind === 'stack_granted').map((e) => e.quantity_delta)),
      destroyed: exactSum(owned.filter((e) => e.event_kind === 'stack_consumed').map((e) => negate(e.quantity_delta))),
      authority: owned.length ? owned.map((event) => ({ table: 'item_events', id: event.id, key: event.idempotency_key, reason: event.reason }))
        : [{ rule: 'No committed item event; quantity must remain unchanged' }] });
  });
}
