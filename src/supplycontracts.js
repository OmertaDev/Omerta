import crypto from 'node:crypto';
import { GameError } from './game.js';
import { latestPolicy, policyLive, policyTermsMatch } from './operatingpolicy.js';

const fail = (message) => { throw new GameError('supply_contract', message); };
const whole = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
export async function latestSupplyContract(client, depotId, lock = false) {
  const result = lock
    ? await client.query('SELECT * FROM business_supply_contracts WHERE depot_id=$1 ORDER BY revision DESC LIMIT 1 FOR UPDATE', [depotId])
    : await client.query('SELECT * FROM business_supply_contracts WHERE depot_id=$1 ORDER BY revision DESC LIMIT 1', [depotId]);
  return result.rows[0] || null;
}
export function supplyDue(row, now = Date.now()) {
  return !!row?.enabled && Number.isFinite(now) && now < new Date(row.expires_at).getTime()
    && Number(row.dispatched) < Number(row.max_cycles) && now >= new Date(row.next_dispatch_at).getTime();
}
export function supplyContractView(row) {
  if (!row) return null;
  return { id: row.id, revision: Number(row.revision), policyId: row.policy_id, enabled: row.enabled,
    intervalSeconds: Number(row.interval_seconds), maxCycles: Number(row.max_cycles), dispatched: Number(row.dispatched),
    remainingCycles: Number(row.max_cycles) - Number(row.dispatched), nextDispatchAt: new Date(row.next_dispatch_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(), lastOrderId: row.last_order_id || null, gameCashOnly: true };
}
export async function setSupplyContract(ch, depotId, body, client) {
  const depot = (await client.query("SELECT * FROM business_depots WHERE id=$1 AND owner_character=$2 AND status='open' FOR UPDATE", [depotId, ch.id])).rows[0];
  if (!depot) throw new GameError('not_yours', 'No open business of yours.');
  const previous = await latestSupplyContract(client, depotId, true);
  if (!whole(body?.expectedRevision, 0, Number.MAX_SAFE_INTEGER - 1) || body.expectedRevision !== Number(previous?.revision || 0))
    fail('Refresh the current supply contract revision before changing its cadence.');
  if (typeof body.enabled !== 'boolean' || !whole(body.intervalSeconds, 3600, 604800)
      || !whole(body.maxCycles, 1, 100) || !whole(body.expiresInSeconds, 3600, 604800))
    fail('Provide an explicit enabled flag, bounded hourly–weekly cadence and expiry, and 1–100 cycles.');
  const policy = await latestPolicy(client, depotId, true);
  if (body.enabled && (!policyLive(policy) || !policy.allow_restock || !policyTermsMatch(policy, depot)))
    fail('Authorize current procurement terms before enabling a supply cadence.');
  const now = Date.now(), id = crypto.randomUUID();
  if (previous) await client.query('UPDATE business_supply_contracts SET enabled=false WHERE id=$1', [previous.id]);
  await client.query('INSERT INTO business_supply_contracts (id,depot_id,revision,policy_id,enabled,interval_seconds,max_cycles,next_dispatch_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [id, depotId, Number(previous?.revision || 0) + 1, policy?.id || null, body.enabled, body.intervalSeconds, body.maxCycles,
      new Date(now), new Date(now + body.expiresInSeconds * 1000)]);
  return { ok: true, contract: supplyContractView(await latestSupplyContract(client, depotId)) };
}
export async function requireSupplyContract(client, depot, policyId, now = Date.now()) {
  const row = await latestSupplyContract(client, depot.id, true);
  if (!row?.enabled) return null;
  if (row.policy_id !== policyId) fail('Owner procurement authority changed; update the supply contract.');
  if (!supplyDue(row, now)) fail('This supply contract is not due, expired or has exhausted its cycles.');
  return row;
}
// Called only after restockDepot created a real funded order, under the same depot,
// policy and cadence locks/transaction. Existing procurement owns all cash accounting.
export async function recordSupplyDispatch(client, row, result, now = Date.now()) {
  if (!row) return;
  if (!supplyDue(row, now) || result?.kind !== 'order' || result.depotId !== row.depot_id
      || typeof result.id !== 'string' || !result.id || !whole(result.escrow, 1, Number.MAX_SAFE_INTEGER)
      || !whole(result.fee, 0, Number.MAX_SAFE_INTEGER)) fail('A supply cycle requires an actual funded procurement order.');
  if (row.last_order_id === result.id) fail('This procurement was already recorded.');
  const next = new Date(now + Number(row.interval_seconds) * 1000);
  await client.query('UPDATE business_supply_contracts SET dispatched=dispatched+1,next_dispatch_at=$2,last_order_id=$3 WHERE id=$1', [row.id, next, result.id]);
  row.dispatched = Number(row.dispatched) + 1; row.next_dispatch_at = next; row.last_order_id = result.id;
}
