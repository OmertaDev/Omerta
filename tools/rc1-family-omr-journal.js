// Exact, read-only Family OMR custody subset. No adjustments and no inferred mint.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { OMR_TABLES, omrUnits, omrText, omrBuckets, omrRequestHash } from './rc1-omr-journal.js';
import { FAMILY_YIELD, GANG_SEALS, FOUNDATION, FAMILY_CHARTER } from '../src/rules.js';
export const FAMILY_OMR_TABLES = [...OMR_TABLES, 'gang_members', 'commission_votes', 'commission_vetoes', 'commission_overrides', 'commission_proposals'];
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const index = (rows, key = row => row.id) => { const found = new Map(); for (const row of rows) { const id = key(row); assert(!found.has(id)); found.set(id, row); } return found; };
const requestKey = row => `${row.account_id}/${row.key}`;
const added = (before, after, key = row => row.id) => { const old = index(before, key), now = index(after, key);
  for (const [id, row] of old) assert.deepEqual(now.get(id), row, `Missing/rewritten immutable receipt ${id}`);
  return after.filter(row => !old.has(key(row))); };
export async function snapshotFamilyOmr(pool) {
  const client = await pool.connect();
  try { await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const state = {};
    for (const table of FAMILY_OMR_TABLES) state[table] = (await client.query(`SELECT * FROM ${table}`)).rows
      .map(row => JSON.parse(JSON.stringify(row))).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    await client.query('COMMIT'); return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export const familyOmrCustodyHash = state => hash({ buckets: omrBuckets(state), gangs: state.gangs, members: state.gang_members,
  transactions: state.transactions, requests: state.idempotency, characters: state.characters.map(row => ({ id: row.id, account: row.account_id,
    cash: row.cash, bank: row.bank, alive: row.alive, ammo: row.ammo })) });
export const FAMILY_OMR_EXCLUSIONS = ['Weekly contract OMR reward, legacy pool merges and Commission Levy redirection',
  'Dissolution via death/kick and yield races with dissolution/ranking changes', 'Full cash/ammo/war/turf custody and unrelated OMR systems',
  'Natural account/progression/resource acquisition, provider/local-chain backing, deployment, installed-dependency attestation and full simulation matrix'];

// Original descending rank weights and cent-sized payouts, with the necessary
// exact backing invariant: no rounded share may spend more than the actual pot.
// A sub-cent remainder stays owned by the pool; it is never rounded away.
export function familyYieldPlan(balance, families) {
  const total = families.reduce((sum, _, i) => sum + BigInt(FAMILY_YIELD.WEIGHTS[i] ?? 1), 0n);
  const units = omrUnits(balance), cent = 10000n; let remaining = units;
  assert(units >= 0n, 'Family yield pot is negative'); if (units < cent || !total) return [];
  return families.map((family, rank) => {
    const numerator = units * BigInt(FAMILY_YIELD.WEIGHTS[rank] ?? 1), denominator = total * cent;
    const rounded = (2n * numerator + denominator) / (2n * denominator) * cent;
    const spendable = remaining / cent * cent, amount = rounded < spendable ? rounded : spendable;
    remaining -= amount; return { family: family.id, rank: rank + 1, amount };
  }).filter(row => row.amount >= cent);
}
export function reconcileFamilyOmr(before, after, { commands = [], logicalAt, yieldAuthority = false } = {}) {
  assert(Number.isSafeInteger(logicalAt));
  const receipts = added(before.transactions, after.transactions), durable = added(before.idempotency, after.idempotency, requestKey);
  const oldFamilies = index(before.gangs), families = index(after.gangs), chars = index(before.characters), accounts = index(before.account_persistent, row => row.account_id);
  assert.deepEqual([...accounts.keys()].sort(), after.account_persistent.map(row => row.account_id).sort());
  const requests = [], stored = index(after.idempotency, requestKey);
  for (const row of durable) {
    const command = commands.find(item => item.status === 200 && item.accountId === row.account_id && item.key === row.key && omrRequestHash(item) === row.body_hash);
    assert(command, 'Durable receipt lacks exact route/body/owner'); assert.equal(row.status, 200); const response = JSON.parse(row.response);
    assert.deepEqual(command.body, response); requests.push({ command, response, row });
  }
  for (const command of commands.filter(row => row.status === 200 && row.key)) {
    const row = stored.get(`${command.accountId}/${command.key}`); assert(row && row.body_hash === omrRequestHash(command));
    assert.deepEqual(JSON.parse(row.response), command.body, 'Durable replay does not match');
  }
  const memberKey = row => `${row.gang_id}/${row.character_id}`, oldMembers = index(before.gang_members, memberKey), members = index(after.gang_members, memberKey);
  const ownerOfCharacter = id => { const row = chars.get(id); assert(row?.alive); return row.account_id; };
  for (const [id, family] of families) if (!oldFamilies.has(id)) {
    const founded = requests.filter(row => row.command.url === '/v1/gangs' && row.response.gangId === id); assert.equal(founded.length, 1, 'Unexplained new Family');
    assert.equal(omrUnits(family.omr_reserve), 0n); assert.equal(after.gang_members.filter(row => row.gang_id === id && row.role === 'boss'
      && ownerOfCharacter(row.character_id) === founded[0].command.accountId).length, 1);
  }
  for (const [key, membership] of oldMembers) {
    const now = members.get(key);
    if (!now) assert(requests.some(row => row.command.url === '/v1/gangs/leave' && row.command.accountId === ownerOfCharacter(membership.character_id)), 'Unexplained Family departure');
    else if (JSON.stringify(now) !== JSON.stringify(membership)) {
      for (const field of Object.keys(membership)) if (field !== 'role') assert.deepEqual(now[field], membership[field]);
      const promoted = requests.find(row => row.command.url === '/v1/gangs/promote' && row.command.payload.characterId === membership.character_id && row.command.payload.role === now.role
        && before.gang_members.some(old => old.gang_id === membership.gang_id && old.role === 'boss' && ownerOfCharacter(old.character_id) === row.command.accountId));
      const oldBossLeft = before.gang_members.some(old => old.gang_id === membership.gang_id && old.role === 'boss' && !members.has(memberKey(old)));
      const successor = before.gang_members.filter(old => old.gang_id === membership.gang_id && members.has(memberKey(old)))
        .sort((a, b) => (({ underboss: 0, capo: 1 }[a.role] ?? 2) - ({ underboss: 0, capo: 1 }[b.role] ?? 2)) || (a.character_id < b.character_id ? -1 : 1))[0];
      assert(promoted || (oldBossLeft && now.role === 'boss' && successor?.character_id === membership.character_id), 'Unexplained Family role change');
    }
  }
  for (const [key, membership] of members) if (!oldMembers.has(key)) {
    const owner = ownerOfCharacter(membership.character_id);
    assert(requests.some(row => row.command.accountId === owner && (row.command.url === `/v1/gangs/${membership.gang_id}/join` && membership.role === 'soldier'
      || row.command.url === '/v1/gangs' && row.response.gangId === membership.gang_id && membership.role === 'boss')), 'Unexplained Family membership');
  }
  const member = accountId => {
    const living = before.characters.filter(row => row.alive && row.account_id === accountId); assert.equal(living.length, 1);
    const memberships = before.gang_members.filter(row => row.character_id === living[0].id); assert.equal(memberships.length, 1, 'No unique original Family membership');
    return memberships[0];
  };
  const account = id => { assert(accounts.has(id)); return `account_persistent/${id}/omr`; }, reserve = id => `gangs/${id}/omr_reserve`;
  const used = new Set(), deltas = new Map(), lineage = [], statuses = [];
  const match = (reason, amount, accountId, counterparty) => {
    const rows = receipts.filter(row => !used.has(row.id) && row.currency === 'omr' && row.reason === reason && row.account_id === accountId
      && row.character_id === null && row.counterparty === counterparty && omrUnits(row.amount) === amount);
    assert(rows.length, `Missing exact owner/reason/amount receipt ${reason}`); used.add(rows[0].id); return rows[0].id;
  };
  const move = (from, to, amount, authority) => { assert(amount > 0n); deltas.set(from, (deltas.get(from) || 0n) - amount);
    deltas.set(to, (deltas.get(to) || 0n) + amount); lineage.push({ from, to, amount: omrText(amount), authority }); };
  const recycle = (from, amount, reason, accountId, counterparty, authority) => {
    const debit = match(reason, -amount, accountId, counterparty), credit = match('desk:recycle', amount, null, reason);
    move(from, 'desk_inventory/1/balance', amount, { ...authority, debit, credit,
      pairing: 'Exact reason/amount multiset within boundary; no fabricated cross-receipt FK' });
  };
  for (const { command, response, row } of requests) {
    const authority = { request: requestKey(row), bodyHash: row.body_hash };
    if (command.url === '/v1/gangs/tribute/omr') {
      const membership = member(command.accountId), amount = BigInt(Math.floor(Number(command.payload.amount))) * 1000000n;
      assert.equal(omrUnits(response.amount), amount); assert.equal(response.currency, 'omr');
      move(account(command.accountId), reserve(membership.gang_id), amount,
        { ...authority, membership, receipt: match('gang:tribute', -amount, command.accountId, membership.gang_id) });
    } else if (['/v1/gangs/vanity/seal', '/v1/gangs/foundation'].includes(command.url)) {
      const membership = member(command.accountId), prior = oldFamilies.get(membership.gang_id), current = families.get(membership.gang_id);
      const isSeal = command.url.endsWith('/seal'), field = isSeal ? 'seal' : 'foundation', tiers = isSeal ? GANG_SEALS : FOUNDATION.TIERS;
      assert(isSeal ? membership.role === 'boss' : ['boss', 'underboss'].includes(membership.role));
      const next = tiers.find(tier => tier.tier === Number(prior[field]) + 1); assert(next); assert.equal(current[field], next.tier); assert.equal(response[field].tier, next.tier);
      recycle(reserve(prior.id), omrUnits(next.omr), isSeal ? 'vanity:gang:seal' : 'foundation:tier', null, prior.id, authority);
      statuses.push({ kind: field, family: prior.id, tier: next.tier });
    } else if (command.url.startsWith('/v1/gangs/charter/')) {
      const membership = member(command.accountId), prior = oldFamilies.get(membership.gang_id), current = families.get(membership.gang_id);
      assert.equal(membership.role, 'boss'); assert.equal(current.charter, command.url.split('/').at(-1)); assert.equal(response.charter.id, current.charter);
      const amount = prior.charter ? omrUnits(FAMILY_CHARTER.CHANGE_OMR) : 0n; assert.equal(omrUnits(response.cost), amount);
      if (amount) { assert.equal(Date.parse(current.charter_at), logicalAt); recycle(reserve(prior.id), amount, 'vanity:charter', null, prior.id, authority); }
      statuses.push({ kind: 'charter', family: prior.id, from: prior.charter, to: current.charter, cost: omrText(amount) });
    } else if (command.url === '/v1/window/redeem') {
      const gross = omrUnits(command.payload.amount), cut = (gross * BigInt(FAMILY_YIELD.FUND_BPS) + 5000n) / 10000n;
      assert.equal(omrUnits(response.spent), gross); assert.equal(omrUnits(response.familyCut), cut); assert.equal(omrUnits(response.burned), gross - cut);
      if (cut) move(account(command.accountId), 'family_yield_pool/1/balance', cut,
        { ...authority, receipt: match('yield:window', -cut, command.accountId, null) });
      recycle(account(command.accountId), gross - cut, 'window:burn', command.accountId, null, authority);
    }
  }
  for (const [id, prior] of oldFamilies) if (!families.has(id)) {
    const originalMembers = before.gang_members.filter(row => row.gang_id === id); assert(originalMembers.length);
    for (const membership of originalMembers) {
      const owner = chars.get(membership.character_id)?.account_id; assert(owner);
      assert(requests.some(row => row.command.url === '/v1/gangs/leave' && row.command.accountId === owner), 'Family disappeared without all canonical departures');
    }
    assert.equal(after.gang_members.filter(row => row.gang_id === id).length, 0);
    assert.equal(requests.filter(row => row.command.url === '/v1/gangs/leave' && row.response.dissolved && originalMembers.some(member => chars.get(member.character_id)?.account_id === row.command.accountId)).length, 1);
    const amount = omrUnits(prior.omr_reserve); if (amount) recycle(reserve(id), amount, 'gang:dissolved', null, id, { family: id, originalMembers });
    statuses.push({ kind: 'dissolution', family: id, reserve: omrText(amount) });
  }
  const yieldReceipts = receipts.filter(row => row.currency === 'omr' && row.reason === 'yield:family');
  if (yieldReceipts.length) {
    assert(yieldAuthority, 'Yield lacks observed original job authority');
    assert(before.commission_votes.length === 0 && after.commission_votes.length === 0, 'Commission Levy ranking outside this proof');
    const ranked = before.gangs.filter(row => !row.npc_flag).map(row => ({ id: row.id, standing: BigInt(row.season_tribute) + 10000n * BigInt(row.season_wars) }))
      .sort((a, b) => a.standing === b.standing ? (a.id < b.id ? -1 : 1) : a.standing > b.standing ? -1 : 1).slice(0, FAMILY_YIELD.SEATS).filter(row => row.standing > 0n);
    assert.deepEqual(before.gangs.map(row => row.id).sort(), after.gangs.map(row => row.id).sort(), 'Yield/dissolution race outside this bounded journal');
    const paid = yieldReceipts.reduce((sum, row) => sum + omrUnits(row.amount), 0n), backing = omrUnits(before.family_yield_pool[0].balance);
    assert(paid <= backing, `Family yield exceeds exact backing: ${omrText(paid)} > ${omrText(backing)}`);
    const plan = familyYieldPlan(before.family_yield_pool[0].balance, ranked); assert.equal(plan.length, yieldReceipts.length);
    for (const row of plan) move('family_yield_pool/1/balance', reserve(row.family), row.amount,
      { ranking: ranked.map(item => ({ id: item.id, standing: String(item.standing) })), rank: row.rank,
        receipt: match('yield:family', row.amount, null, row.family), logicalAt, source: 'original hourly family yield job or explicit canonical replay' });
    assert.equal(omrUnits(after.family_yield_pool[0].lifetime_paid) - omrUnits(before.family_yield_pool[0].lifetime_paid), paid);
  }
  for (const row of receipts.filter(row => row.currency === 'omr')) assert(used.has(row.id), `Unclassified OMR receipt ${row.reason}`);
  const oldBuckets = index(omrBuckets(before), row => row.key), buckets = index(omrBuckets(after), row => row.key), equations = [];
  for (const key of new Set([...oldBuckets.keys(), ...buckets.keys(), ...deltas.keys()])) {
    const initial = omrUnits(oldBuckets.get(key)?.amount || 0), final = omrUnits(buckets.get(key)?.amount || 0), change = deltas.get(key) || 0n;
    assert.equal(final, initial + change, `Unexplained exact owner/custody movement ${key}`); assert(final >= 0n, `Negative custody ${key}`);
    equations.push({ key, before: omrText(initial), change: omrText(change), after: omrText(final) });
  }
  const deskChange = deltas.get('desk_inventory/1/balance') || 0n;
  assert.equal(omrUnits(after.desk_inventory[0].lifetime_in) - omrUnits(before.desk_inventory[0].lifetime_in), deskChange);
  const funding = receipts.filter(row => row.currency === 'omr' && row.reason === 'yield:window').reduce((sum, row) => sum - omrUnits(row.amount), 0n);
  assert.equal(omrUnits(after.family_yield_pool[0].lifetime_funded) - omrUnits(before.family_yield_pool[0].lifetime_funded), funding);
  return { version: 1, lineage, statuses, equations, receiptIds: [...used], unknown: FAMILY_OMR_EXCLUSIONS, fullResourceCoverage: false };
}
