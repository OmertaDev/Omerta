import crypto from 'node:crypto';
import { GameError } from './game.js';

export const RESOURCE_MAX = 1000000000000;
export const resourceMode = () => process.env.RESOURCE_PAYMENTS_MODE === 'live' ? 'live' : 'test';
export const resourceEnabled = () => process.env.RESOURCE_ECONOMY === 'on';
export const resourceError = (code, message) => new GameError(`resource_${code}`, message);
export function resourceInt(value, name, minimum = 1, maximum = RESOURCE_MAX) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
    throw resourceError('terms', `${name} must be a bounded integer.`);
  return value;
}
export function resourceKey(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value))
    throw resourceError('key', 'Use a bounded, unique request identifier.');
  return value;
}
export function resourceIntake() {
  if (!resourceEnabled()) throw resourceError('disabled', 'External resource intake is disabled.');
}
export async function resourceTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
export async function lockResourceTreasury(client, accountId) {
  await client.query('INSERT INTO resource_treasuries(account_id,mode) VALUES($1,$2) ON CONFLICT(account_id) DO NOTHING', [accountId, resourceMode()]);
  const row = (await client.query('SELECT * FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [accountId])).rows[0];
  if (!row || row.mode !== resourceMode()) throw resourceError('mode', 'This treasury belongs to another payment environment.');
  return row;
}
export async function lockResourceTreasuries(client, accounts) {
  for (const id of [...new Set(accounts)].sort()) await lockResourceTreasury(client, id);
}
// Callers acquire all participating treasuries in account-id order first. Values
// are exact USD micro-units, never game cash, OMR or a promised exchange rate.
export async function moveResourceMoney(client, accountId, availableDelta, reservedDelta, kind, eventKey, authorizedUsdMicros = null) {
  resourceInt(Math.abs(availableDelta), 'available delta', 0);
  resourceInt(Math.abs(reservedDelta), 'reserved delta', 0);
  const row = (await client.query('SELECT * FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [accountId])).rows[0];
  if (!row) throw resourceError('treasury', 'Resource treasury is missing.');
  const available = Number(row.available_usd_micros) + availableDelta;
  const reserved = Number(row.reserved_usd_micros) + reservedDelta;
  resourceInt(available, 'available balance', 0); resourceInt(reserved, 'reserved balance', 0);
  resourceInt(available + reserved, 'total resource balance', 0);
  const authorized = authorizedUsdMicros ?? (['compute_reserve', 'auction_reserve', 'job_reserve'].includes(kind) ? -availableDelta : 0);
  resourceInt(authorized, 'authorized amount', 0);
  await client.query('INSERT INTO resource_ledger(id,account_id,event_key,kind,available_delta,reserved_delta,authorized_usd_micros) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [crypto.randomUUID(), accountId, eventKey, kind, availableDelta, reservedDelta, authorized]);
  await client.query('UPDATE resource_treasuries SET available_usd_micros=$2,reserved_usd_micros=$3 WHERE account_id=$1', [accountId, available, reserved]);
  return { availableUsdMicros: available, reservedUsdMicros: reserved, mode: row.mode };
}
export async function authorizeResourceSpend(client, accountId, { providerId, amountUsdMicros, storedResponses = false, held = false }) {
  resourceInt(amountUsdMicros, 'spend');
  const treasury = await lockResourceTreasury(client, accountId);
  if (treasury.frozen) throw resourceError('frozen', 'External payment recovery has frozen new spending.');
  const policy = (await client.query('SELECT * FROM resource_compute_policies WHERE account_id=$1 FOR UPDATE', [accountId])).rows[0];
  if (!policy?.enabled || new Date(policy.expires_at).getTime() <= Date.now()
      || !policy.providers.includes(providerId) || storedResponses && !policy.allow_stored_responses)
    throw resourceError('authority', 'This purchase requires current owner authorization for this provider and retention policy.');
  const day = new Date(); day.setUTCHours(0, 0, 0, 0);
  // Refunds never replenish daily authority; policy revisions do not erase it.
  const reservations = (await client.query('SELECT authorized_usd_micros FROM resource_ledger WHERE account_id=$1 AND created_at >= $2', [accountId, day])).rows;
  const committed = reservations.reduce((n, row) => n + Number(row.authorized_usd_micros), 0);
  if (amountUsdMicros > Number(policy.max_per_call) || committed + amountUsdMicros > Number(policy.max_per_day)
      || Number(treasury.available_usd_micros) - (held ? 0 : amountUsdMicros) < Number(policy.minimum_reserve))
    throw resourceError('budget', 'The purchase exceeds an owner spending limit or minimum reserve.');
  return policy;
}
export async function setResourcePolicy(pool, accountId, body) {
  resourceIntake();
  if (typeof body?.enabled !== 'boolean' || typeof body.allowStoredResponses !== 'boolean'
      || !Array.isArray(body.providers) || body.providers.length > 20 || new Set(body.providers).size !== body.providers.length
      || !body.providers.every(id => typeof id === 'string' && /^[a-zA-Z0-9:_.-]{1,128}$/.test(id)))
    throw resourceError('policy', 'Set explicit duties, provider allowlist and retention permission.');
  resourceInt(body.maxPerCallUsdMicros, 'per-call limit', 0); resourceInt(body.maxPerDayUsdMicros, 'daily limit', 0);
  resourceInt(body.minimumReserveUsdMicros, 'minimum reserve', 0); resourceInt(body.expiresInSeconds, 'expiry', 60, 604800);
  return resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, accountId);
    const previous = (await client.query('SELECT * FROM resource_compute_policies WHERE account_id=$1 FOR UPDATE', [accountId])).rows[0];
    if (body.expectedRevision !== Number(previous?.revision || 0)) throw resourceError('revision', 'Refresh the owner policy revision.');
    const revision = Number(previous?.revision || 0) + 1; resourceInt(revision, 'revision', 1, 2147483647);
    const values = [accountId, revision, body.enabled, JSON.stringify(body.providers), body.maxPerCallUsdMicros, body.maxPerDayUsdMicros,
      body.minimumReserveUsdMicros, body.allowStoredResponses, new Date(Date.now() + body.expiresInSeconds * 1000)];
    if (previous) await client.query('UPDATE resource_compute_policies SET revision=$2,enabled=$3,providers=$4,max_per_call=$5,max_per_day=$6,minimum_reserve=$7,allow_stored_responses=$8,expires_at=$9 WHERE account_id=$1', values);
    else await client.query('INSERT INTO resource_compute_policies(account_id,revision,enabled,providers,max_per_call,max_per_day,minimum_reserve,allow_stored_responses,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', values);
    return { resourceAction: 'policy', policy: (await client.query('SELECT * FROM resource_compute_policies WHERE account_id=$1', [accountId])).rows[0] };
  });
}
export async function resourceAccounting(pool, accountId) {
  return resourceTransaction(pool, async pool => {
  const row = (await pool.query('SELECT * FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [accountId])).rows[0];
  if (!row) return { mode: resourceMode(), availableUsdMicros: 0, reservedUsdMicros: 0, ledgerDriftUsdMicros: 0 };
  const entries = (await pool.query('SELECT kind,available_delta,reserved_delta FROM resource_ledger WHERE account_id=$1', [accountId])).rows;
  const sum = key => Number(entries.reduce((n, entry) => n + BigInt(entry[key]), 0n));
  const amount = kinds => Number(entries.filter(entry => kinds.includes(entry.kind)).reduce((n, entry) => n + BigInt(entry.available_delta) + BigInt(entry.reserved_delta), 0n));
  const calls = (await pool.query('SELECT status,cap_usd_micros,provider_cost_usd_micros,simulated FROM resource_calls WHERE account_id=$1', [accountId])).rows;
  const bids = (await pool.query("SELECT maximum_usd_micros FROM resource_bids WHERE account_id=$1 AND status IN ('sealed','revealed')", [accountId])).rows;
  const credits = (await pool.query("SELECT price_usd_micros FROM resource_credits WHERE account_id=$1 AND status='unused'", [accountId])).rows;
  const jobs = (await pool.query("SELECT price_usd_micros FROM resource_jobs WHERE buyer_account=$1 AND state IN ('open','claimed','submitted','disputed')", [accountId])).rows;
  const held = calls.filter(call => ['reserved','sending','unknown'].includes(call.status)).map(call => call.cap_usd_micros)
    .concat(bids.map(bid => bid.maximum_usd_micros), credits.map(credit => credit.price_usd_micros), jobs.map(job => job.price_usd_micros));
  const liabilities = Number(held.reduce((total, value) => total + BigInt(value), 0n));
  return { mode: row.mode, availableUsdMicros: Number(row.available_usd_micros), reservedUsdMicros: Number(row.reserved_usd_micros),
    ledgerDriftUsdMicros: Math.abs(Number(row.available_usd_micros) - sum('available_delta')) + Math.abs(Number(row.reserved_usd_micros) - sum('reserved_delta')),
    liabilityDriftUsdMicros: Math.abs(Number(row.reserved_usd_micros) - liabilities),
    ownerCapitalUsdMicros: amount(['capital']), customerRevenueUsdMicros: amount(['customer_revenue']),
    externalCustomerRevenueUsdMicros: row.mode === 'live' ? amount(['customer_revenue']) : 0,
    providerCostsUsdMicros: Number(calls.reduce((total, call) => total + BigInt(call.provider_cost_usd_micros || 0), 0n)),
    unresolvedCalls: calls.filter(call => ['sending','unknown'].includes(call.status)).length,
    operatingCostsUsdMicros: -amount(['compute_settle', 'job_payment', 'hosting_cost', 'payment_fee']),
    outsideCostsComplete: false, profitabilityBasis: 'Settled ledger only; hosting and payment processing fees must be separately reconciled. Test funding is not external revenue.' };
  });
}
