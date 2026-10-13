import crypto from 'node:crypto';
import { GameError, ledger } from './game.js';
import { jailed, safeHoused } from './rules.js';
import { assertItemTransaction, itemTransactionIdentity, withItemMutation, escrowItem, relayEscrowCustody, releaseEscrow, poisonItemTransaction, registerItemTransactionUndo } from './items.js';
import { assertEquipmentUsable } from './itemdurability.js';

export const EQUIPMENT_RENTALS = Object.freeze({ templateId: 'item:precision_lock_tool', offers: 5, leases: 3, maximumCash: 100000, maximumSeconds: 3600 });
export const equipmentRentalDDL = `CREATE TABLE IF NOT EXISTS equipment_rental_requests (
 account_id TEXT NOT NULL, request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128),
 run_id TEXT NOT NULL UNIQUE, identity JSONB NOT NULL, receipt JSONB, account_ref TEXT REFERENCES accounts(id),
 original_character TEXT REFERENCES characters(id), PRIMARY KEY(account_id,request_key),
 CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL) OR
 (receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND original_character IS NOT NULL)));
CREATE TABLE IF NOT EXISTS equipment_rental_offers (
 id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES item_instances(id), landlord_account TEXT NOT NULL REFERENCES accounts(id),
 landlord_character TEXT NOT NULL REFERENCES characters(id), rent_cash INT NOT NULL CHECK(rent_cash BETWEEN 1 AND 100000),
 deposit_cash INT NOT NULL CHECK(deposit_cash BETWEEN 0 AND 100000), duration_seconds INT NOT NULL CHECK(duration_seconds BETWEEN 60 AND 3600),
 published BOOLEAN NOT NULL, expires_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','leased','cancelled')));
CREATE UNIQUE INDEX IF NOT EXISTS equipment_rental_one_open_offer ON equipment_rental_offers(item_id) WHERE status='open';
CREATE TABLE IF NOT EXISTS equipment_rental_leases (
 id TEXT PRIMARY KEY, offer_id TEXT NOT NULL UNIQUE REFERENCES equipment_rental_offers(id), item_id TEXT NOT NULL REFERENCES item_instances(id),
 landlord_account TEXT NOT NULL REFERENCES accounts(id), landlord_character TEXT NOT NULL REFERENCES characters(id),
 borrower_account TEXT NOT NULL REFERENCES accounts(id), borrower_character TEXT NOT NULL REFERENCES characters(id),
 rent_cash INT NOT NULL CHECK(rent_cash BETWEEN 1 AND 100000), deposit_cash INT NOT NULL CHECK(deposit_cash BETWEEN 0 AND 100000),
 deposit_remaining INT NOT NULL CHECK(deposit_remaining BETWEEN 0 AND deposit_cash), starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL CHECK(ends_at>starts_at),
 status TEXT NOT NULL CHECK(status IN ('active','returned','death_ended')), ended_at TIMESTAMPTZ,
 CHECK(landlord_account<>borrower_account AND landlord_character<>borrower_character),
 CHECK((status='active' AND ended_at IS NULL) OR (status<>'active' AND ended_at IS NOT NULL AND deposit_remaining=0)));
CREATE UNIQUE INDEX IF NOT EXISTS equipment_rental_one_live_tool ON equipment_rental_leases(item_id) WHERE status='active';`;
const fail = reason => { throw new GameError('equipment_rental', reason); };
const id = value => { if (typeof value !== 'string' || !/^[!-~]{1,128}$/.test(value)) fail('identity'); return value; };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const integer = (n, low, high) => Number.isSafeInteger(n) && n >= low && n <= high;
const stable = value => JSON.stringify(value, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
const clock = async client => new Date((await client.query('SELECT clock_timestamp() AS observed')).rows[0].observed);

async function request(client, accountId, action, terms, key, execute) {
  assertItemTransaction(client); id(accountId); id(key);
  const identity = { action, terms }, prior = (await client.query('SELECT identity,receipt FROM equipment_rental_requests WHERE account_id=$1 AND request_key=$2', [accountId, key])).rows[0];
  if (prior) { if (stable(prior.identity) !== stable(identity)) fail('request_conflict'); if (!prior.receipt) fail('in_progress'); return prior.receipt; }
  const runId = crypto.randomUUID();
  registerItemTransactionUndo(client, () => client.query('DELETE FROM equipment_rental_requests WHERE account_id=$1 AND request_key=$2 AND run_id=$3', [accountId, key, runId]));
  await client.query('INSERT INTO equipment_rental_requests(account_id,request_key,run_id,identity) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,request_key) DO NOTHING', [accountId, key, runId, identity]);
  const root = (await client.query('SELECT run_id,identity,receipt FROM equipment_rental_requests WHERE account_id=$1 AND request_key=$2 FOR UPDATE', [accountId, key])).rows[0];
  if (stable(root.identity) !== stable(identity)) fail('request_conflict'); if (root.receipt) return root.receipt; if (root.run_id !== runId) fail('in_progress');
  const value = await execute(runId);
  const completed = await client.query('UPDATE equipment_rental_requests SET receipt=$4,account_ref=$1,original_character=$5 WHERE account_id=$1 AND request_key=$2 AND run_id=$3 AND receipt IS NULL', [accountId, key, runId, value.receipt, value.actorId]);
  if (completed.rowCount !== 1) fail('receipt_changed');
  return value.receipt;
}
async function current(client, accountId) {
  const rows = (await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE account_id=$1 AND alive ORDER BY id LIMIT 2', [accountId])).rows;
  if (rows.length !== 1 || rows[0].is_npc) fail('actor'); return rows[0];
}
async function actors(client, ids) {
  const rows = [];
  for (const characterId of [...new Set(ids)].sort()) {
    const row = (await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [characterId])).rows[0]; if (!row || row.is_npc) fail('actor'); rows.push(row);
  }
  for (const accountId of [...new Set(rows.map(row => row.account_id))].sort()) {
    if ((await client.query('SELECT id,status FROM accounts WHERE id=$1 FOR UPDATE', [accountId])).rows[0]?.status !== 'active') fail('account');
  }
  return rows;
}
async function cash(client, row, delta, reason, counterparty) {
  const before = Number(row.cash); if (!row.alive || !Number.isFinite(before) || before + delta < 0) fail('cash');
  registerItemTransactionUndo(client, () => client.query('UPDATE characters SET cash=$2 WHERE id=$1', [row.id, before]));
  const updated = await client.query('UPDATE characters SET cash=cash+$2 WHERE id=$1 AND alive AND cash+$2>=0 RETURNING cash', [row.id, delta]); if (updated.rowCount !== 1) fail('cash');
  const journalId = await ledger(client, { characterId: row.id, currency: 'cash', amount: delta, reason, counterparty }, {
    beforeInsert: transactionId => registerItemTransactionUndo(client, () => client.query('DELETE FROM transactions WHERE id=$1', [transactionId])) });
  row.cash = Number(updated.rows[0].cash);
  return journalId;
}
async function burn(client, amount, leaseId) {
  if (!amount) return;
  await ledger(client, { currency: 'cash', amount: -amount, reason: 'equipment_rental:deposit_burn', counterparty: leaseId }, {
    beforeInsert: transactionId => registerItemTransactionUndo(client, () => client.query('DELETE FROM transactions WHERE id=$1', [transactionId])) });
}
async function capacity(client, accountId) {
  const rows = (await client.query("SELECT id FROM equipment_rental_leases WHERE status='active' AND (landlord_account=$1 OR borrower_account=$1) LIMIT 3", [accountId])).rows;
  if (rows.length >= EQUIPMENT_RENTALS.leases) fail('lease_limit');
}
function offerTerms(body) {
  if (!exact(body, ['itemId', 'rentCash', 'depositCash', 'durationSeconds', 'offerSeconds', 'published']) || !integer(body.rentCash, 1, 100000)
      || !integer(body.depositCash, 0, 100000) || !integer(body.durationSeconds, 60, 3600) || !integer(body.offerSeconds, 60, 3600) || typeof body.published !== 'boolean') fail('terms');
  return { itemId: id(body.itemId), rentCash: body.rentCash, depositCash: body.depositCash, durationSeconds: body.durationSeconds, offerSeconds: body.offerSeconds, published: body.published };
}
async function createOffer(client, accountId, body, key) {
  const terms = offerTerms(body);
  return request(client, accountId, 'offer', terms, key, async offerId => {
    const hint = await current(client, accountId), [owner] = await actors(client, [hint.id]); if (!owner.alive || owner.account_id !== accountId) fail('actor');
    const offers = (await client.query("SELECT id FROM equipment_rental_offers WHERE landlord_account=$1 AND status='open' LIMIT 5", [accountId])).rows; if (offers.length >= 5) fail('offer_limit');
    const equipment = await assertEquipmentUsable(client, { itemId: terms.itemId, owner: { scope: 'account', id: accountId } });
    if ((await client.query("SELECT id FROM equipment_rental_offers WHERE item_id=$1 AND status='open'", [terms.itemId])).rows.length) fail('offer_exists');
    const now = await clock(client), expires = new Date(+now + terms.offerSeconds * 1000);
    await client.query("INSERT INTO equipment_rental_offers(id,item_id,landlord_account,landlord_character,rent_cash,deposit_cash,duration_seconds,published,expires_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'open')", [offerId, terms.itemId, accountId, owner.id, terms.rentCash, terms.depositCash, terms.durationSeconds, terms.published, expires]);
    registerItemTransactionUndo(client, () => client.query('DELETE FROM equipment_rental_offers WHERE id=$1', [offerId]));
    return { actorId: owner.id, receipt: { ok: true, offerId, itemId: terms.itemId, rentCash: terms.rentCash, depositCash: terms.depositCash, expiresAt: expires.toISOString(), condition: equipment.remaining } };
  });
}
async function cancelOffer(client, accountId, body, key) {
  if (!exact(body, ['offerId'])) fail('terms'); const offerId = id(body.offerId);
  return request(client, accountId, 'cancel', { offerId }, key, async () => {
    const hint = await current(client, accountId), [actor] = await actors(client, [hint.id]);
    const offer = (await client.query('SELECT * FROM equipment_rental_offers WHERE id=$1 FOR UPDATE', [offerId])).rows[0];
    if (!actor.alive || !offer || offer.landlord_account !== accountId || offer.status !== 'open') fail('offer');
    await client.query("UPDATE equipment_rental_offers SET status='cancelled' WHERE id=$1", [offer.id]);
    registerItemTransactionUndo(client, () => client.query("UPDATE equipment_rental_offers SET status='open' WHERE id=$1", [offer.id]));
    return { actorId: actor.id, receipt: { ok: true, offerId, cancelled: true } };
  });
}
async function accept(client, accountId, body, key) {
  if (!exact(body, ['offerId', 'maxRentCash', 'maxDepositCash', 'consent']) || body.consent !== true || !integer(body.maxRentCash, 1, 100000) || !integer(body.maxDepositCash, 0, 100000)) fail('terms');
  const terms = { offerId: id(body.offerId), maxRentCash: body.maxRentCash, maxDepositCash: body.maxDepositCash, consent: true };
  return request(client, accountId, 'accept', terms, key, async leaseId => {
    const hint = (await client.query('SELECT landlord_account,landlord_character FROM equipment_rental_offers WHERE id=$1', [terms.offerId])).rows[0]; if (!hint || hint.landlord_account === accountId) fail('offer');
    const borrowerHint = await current(client, accountId), locked = await actors(client, [borrowerHint.id, hint.landlord_character]);
    const borrower = locked.find(row => row.id === borrowerHint.id), landlord = locked.find(row => row.id === hint.landlord_character);
    if (!borrower?.alive || borrower.account_id !== accountId || !landlord?.alive || landlord.account_id !== hint.landlord_account) fail('actor');
    if (jailed(borrower) || safeHoused(borrower)) fail('mobile');
    const offer = (await client.query('SELECT * FROM equipment_rental_offers WHERE id=$1 FOR UPDATE', [terms.offerId])).rows[0];
    if (!offer?.published || offer.status !== 'open' || offer.landlord_character !== landlord.id || offer.landlord_account !== landlord.account_id) fail('offer');
    await capacity(client, accountId); await capacity(client, landlord.account_id);
    await assertEquipmentUsable(client, { itemId: offer.item_id, owner: { scope: 'account', id: landlord.account_id } });
    const now = await clock(client); if (+now >= +new Date(offer.expires_at)) fail('offer_expired');
    if (offer.rent_cash > terms.maxRentCash || offer.deposit_cash > terms.maxDepositCash) fail('price');
    const ends = new Date(+now + offer.duration_seconds * 1000), owner = { scope: 'account', id: landlord.account_id };
    const receipt = await withItemMutation(client, owner, 'operation_action', `equipment-rental:${leaseId}:accept`, { leaseId, itemId: offer.item_id,
      borrowerAccount: accountId, borrowerCharacter: borrower.id, itemAuthority: { operations: [leaseId] } }, async mutation => {
      await escrowItem(client, owner, leaseId, offer.item_id, 'equipment rental original-owner custody', mutation, 'used_in_operation');
      const rentDebit = await cash(client, borrower, -Number(offer.rent_cash), 'equipment_rental:rent_pay', landlord.id);
      const rentCredit = await cash(client, landlord, Number(offer.rent_cash), 'equipment_rental:rent_receive', borrower.id);
      const depositDebit = offer.deposit_cash ? await cash(client, borrower, -Number(offer.deposit_cash), 'equipment_rental:deposit', leaseId) : null;
      await client.query("INSERT INTO equipment_rental_leases(id,offer_id,item_id,landlord_account,landlord_character,borrower_account,borrower_character,rent_cash,deposit_cash,deposit_remaining,starts_at,ends_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,'active')", [leaseId, offer.id, offer.item_id, landlord.account_id, landlord.id, accountId, borrower.id, offer.rent_cash, offer.deposit_cash, now, ends]);
      registerItemTransactionUndo(client, () => client.query('DELETE FROM equipment_rental_leases WHERE id=$1', [leaseId]));
      await client.query("UPDATE equipment_rental_offers SET status='leased' WHERE id=$1", [offer.id]);
      registerItemTransactionUndo(client, () => client.query("UPDATE equipment_rental_offers SET status='open' WHERE id=$1", [offer.id]));
      return { ok: true, leaseId, itemId: offer.item_id, landlordAccount: landlord.account_id, landlordCharacter: landlord.id,
        borrowerCharacter: borrower.id, rentCash: Number(offer.rent_cash), depositCash: Number(offer.deposit_cash), rentDebit, rentCredit, depositDebit, endsAt: ends.toISOString(), title: 'original_landlord_account' };
    });
    return { actorId: borrower.id, receipt };
  });
}
async function finish(client, lease, locked, status, mutationKey) {
  const borrower = locked.find(row => row.id === lease.borrower_character), owner = { scope: 'account', id: lease.landlord_account };
  const physical = (await client.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [lease.item_id])).rows[0];
  let heldMystery = null;
  if (physical?.owner_scope === 'operation' && physical.owner_id !== lease.id) {
    const instance = (await client.query('SELECT * FROM mystery_instances WHERE id=$1 FOR UPDATE', [physical.owner_id])).rows[0];
    if (!instance || instance.graph_id !== 'belladonna-demo' || Number(instance.graph_version) !== 1
        || instance.owner_scope !== 'character' || instance.owner_id !== lease.borrower_character || instance.authority_account_id !== lease.borrower_account) fail('custody');
    await paidEquipmentRentalWitness(client, lease);
    const events = (await client.query("SELECT e.id,g.owner_scope,g.owner_id,g.mutation_kind FROM item_events e JOIN item_mutation_guards g ON g.idempotency_key=e.idempotency_key WHERE e.item_id=$1 AND e.event_kind='escrow_relayed' AND e.from_owner_scope='operation' AND e.from_owner_id=$2 AND e.to_owner_scope='operation' AND e.to_owner_id=$3 ORDER BY e.sequence DESC LIMIT 1", [lease.item_id, lease.id, instance.id])).rows;
    if (events.length !== 1 || events[0].owner_scope !== 'character' || events[0].owner_id !== lease.borrower_character || events[0].mutation_kind !== 'mystery_action') fail('custody');
    heldMystery = instance.id;
  }
  return withItemMutation(client, owner, 'operation_action', mutationKey, { leaseId: lease.id, status,
    itemAuthority: { operations: [lease.id, ...(heldMystery ? [heldMystery] : [])], destinations: [owner] } }, async mutation => {
    if (heldMystery) await relayEscrowCustody(client, heldMystery, lease.id, lease.item_id, 'Rental recovery restores original lease custody', mutation);
    await releaseEscrow(client, lease.id, owner, lease.item_id, 'equipment rental return to original landlord', mutation);
    const deposit = Number(lease.deposit_remaining);
    if (borrower?.alive) { if (deposit) await cash(client, borrower, deposit, 'equipment_rental:deposit_refund', lease.id); }
    else await burn(client, deposit, lease.id);
    const now = await clock(client);
    const updated = await client.query('UPDATE equipment_rental_leases SET status=$2,deposit_remaining=0,ended_at=$3 WHERE id=$1 AND status=$4', [lease.id, status, now, 'active']);
    if (updated.rowCount !== 1) fail('lease_changed');
    registerItemTransactionUndo(client, () => client.query("UPDATE equipment_rental_leases SET status='active',deposit_remaining=$2,ended_at=NULL WHERE id=$1", [lease.id, deposit]));
    return { ok: true, leaseId: lease.id, itemId: lease.item_id, borrowerCharacter: lease.borrower_character, status, refunded: borrower?.alive ? deposit : 0, burned: borrower?.alive ? 0 : deposit, title: 'original_landlord_account' };
  });
}
async function end(client, accountId, body, key) {
  if (!exact(body, ['leaseId'])) fail('terms'); const leaseId = id(body.leaseId);
  return request(client, accountId, 'end', { leaseId }, key, async runId => {
    const hint = (await client.query('SELECT * FROM equipment_rental_leases WHERE id=$1', [leaseId])).rows[0]; if (!hint || ![hint.landlord_account, hint.borrower_account].includes(accountId)) fail('lease');
    const caller = await current(client, accountId), locked = await actors(client, [caller.id, hint.landlord_character, hint.borrower_character]);
    if (!locked.find(row => row.id === caller.id)?.alive) fail('actor');
    const lease = (await client.query('SELECT * FROM equipment_rental_leases WHERE id=$1 FOR UPDATE', [leaseId])).rows[0]; if (lease.status !== 'active') fail('lease_ended');
    const observed = await clock(client);
    if (accountId === lease.landlord_account && +observed < +new Date(lease.ends_at)) fail('lease_not_due');
    const receipt = await finish(client, lease, locked, 'returned', `equipment-rental:${runId}:end`);
    return { actorId: caller.id, receipt };
  });
}
async function toolAuthority(client, { accountId, characterId, itemId }) {
  assertItemTransaction(client); id(accountId); id(characterId); id(itemId);
  const lease = (await client.query("SELECT * FROM equipment_rental_leases WHERE item_id=$1 AND status='active' ORDER BY id LIMIT 2 FOR UPDATE", [itemId])).rows;
  if (lease.length !== 1 || lease[0].borrower_account !== accountId || lease[0].borrower_character !== characterId) fail('borrower');
  const row = lease[0], actor = (await client.query('SELECT id,account_id,alive FROM characters WHERE id=$1', [characterId])).rows[0];
  if (!actor?.alive || actor.account_id !== accountId) fail('actor');
  const item = (await client.query('SELECT id,template_id,definition_hash,owner_scope,owner_id,state FROM item_instances WHERE id=$1 FOR UPDATE', [itemId])).rows[0];
  const custody = (await client.query('SELECT operation_id,depositor_scope,depositor_id FROM operation_escrow WHERE item_id=$1 FOR UPDATE', [itemId])).rows[0];
  if (!item || item.template_id !== EQUIPMENT_RENTALS.templateId || item.definition_hash !== null || item.owner_scope !== 'operation' || item.state !== 'escrowed'
      || !custody || custody.operation_id !== item.owner_id || custody.depositor_scope !== 'account' || custody.depositor_id !== row.landlord_account) fail('custody');
  if (item.owner_id !== row.id) {
    const instance = (await client.query('SELECT owner_scope,owner_id,authority_account_id,status,graph_id,graph_version FROM mystery_instances WHERE id=$1', [item.owner_id])).rows[0];
    if (!instance || instance.owner_scope !== 'character' || instance.owner_id !== characterId || instance.authority_account_id !== accountId || instance.status !== 'active' || instance.graph_id !== 'belladonna-demo' || Number(instance.graph_version) !== 1) fail('custody');
  }
  const now = await clock(client); if (+now >= +new Date(row.ends_at)) fail('expired');
  return Object.freeze({ leaseId: row.id, itemId, operationId: item.owner_id, originalOwner: Object.freeze({ scope: 'account', id: row.landlord_account }),
    borrowerAccount: accountId, borrowerCharacter: characterId, endsAt: new Date(row.ends_at).toISOString(), title: 'original_landlord_account' });
}
export async function equipmentRentalDeathCounterparts(client, characterId) {
  const rows = (await client.query("SELECT landlord_character,borrower_character FROM equipment_rental_leases WHERE status='active' AND (landlord_character=$1 OR borrower_character=$1) ORDER BY id LIMIT 4", [id(characterId)])).rows;
  if (rows.length > 3) fail('death_limit'); return [...new Set(rows.flatMap(row => [row.landlord_character, row.borrower_character]).filter(value => value !== characterId))].sort();
}
// A death action discovers the complete finite rental union BEFORE taking any
// actor lock. The opaque scope belongs only to this transaction/client; recovery
// cannot discover and acquire a new actor after another subsystem's row locks.
const deathScopes = new WeakMap();
export async function prelockEquipmentRentalDeathActors(client, characterIds) {
  assertItemTransaction(client);
  if (!Array.isArray(characterIds) || characterIds.length < 1 || characterIds.length > 2) fail('death_scope');
  const subjects = [...new Set(characterIds.map(id))].sort(), ids = new Set(subjects);
  for (const subject of subjects) for (const counterpart of await equipmentRentalDeathCounterparts(client, subject)) ids.add(counterpart);
  const ordered = [...ids].sort(), locked = [];
  for (const characterId of ordered) {
    const row = (await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [characterId])).rows[0];
    if (row) locked.push(row);
  }
  const accounts = [...new Set(locked.filter(row => !row.is_npc).map(row => row.account_id))].sort();
  for (const accountId of accounts) await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [accountId]);
  const scope = Object.freeze({});
  deathScopes.set(scope, { client, transaction: itemTransactionIdentity(client), subjects, ids: new Set(ordered) });
  await assertEquipmentRentalDeathScope(client, subjects[0], scope);
  for (const subject of subjects.slice(1)) await assertEquipmentRentalDeathScope(client, subject, scope);
  return { scope, characters: locked };
}
export async function assertEquipmentRentalDeathScope(client, characterId, scope) {
  assertItemTransaction(client);
  try {
  const state = deathScopes.get(scope);
  if (!state || state.client !== client || state.transaction !== itemTransactionIdentity(client) || !state.subjects.includes(characterId)) fail('death_scope');
  for (const counterpart of await equipmentRentalDeathCounterparts(client, characterId)) {
    if (!state.ids.has(counterpart)) throw new GameError('contention', 'Rental counterpart changed; retry the whole action.');
  }
  return state;
  } catch (error) { poisonItemTransaction(client, error); throw error; }
}
export async function recoverEquipmentRentalsAtDeath(client, characterId, scope) {
  assertItemTransaction(client);
  try {
    const state = await assertEquipmentRentalDeathScope(client, characterId, scope);
    const hints = (await client.query("SELECT id,landlord_character,borrower_character FROM equipment_rental_leases WHERE status='active' AND (landlord_character=$1 OR borrower_character=$1) ORDER BY id LIMIT 4", [id(characterId)])).rows;
    if (hints.length > 3) fail('death_limit'); const locked = [];
    for (const actorId of [...new Set(hints.flatMap(row => [row.landlord_character, row.borrower_character]))].sort()) {
      if (!state.ids.has(actorId)) throw new GameError('contention', 'Rental counterpart changed; retry the whole action.');
      // Already locked in the pre-actor phase. Re-read death/cash, never lock late.
      const row = (await client.query('SELECT * FROM characters WHERE id=$1', [actorId])).rows[0];
      if (!row) fail('death_actor'); locked.push(row);
    }
    const victim = locked.find(row => row.id === characterId);
    if (hints.length && (!victim || victim.alive)) fail('death_required');
    const results = [];
    for (const hint of hints) { const lease = (await client.query('SELECT * FROM equipment_rental_leases WHERE id=$1 FOR UPDATE', [hint.id])).rows[0];
      if (lease.landlord_character !== hint.landlord_character || lease.borrower_character !== hint.borrower_character) fail('death_source_changed');
      const landlord = locked.find(row => row.id === lease.landlord_character), borrower = locked.find(row => row.id === lease.borrower_character);
      if (!landlord || !borrower || landlord.is_npc || borrower.is_npc || landlord.account_id !== lease.landlord_account || borrower.account_id !== lease.borrower_account) fail('death_source_changed');
      if (lease.status === 'active') results.push(await finish(client, lease, locked, 'death_ended', `equipment-rental:${lease.id}:death:${characterId}`)); }
    return results;
  } catch (error) { poisonItemTransaction(client, error); throw error; }
}
export async function equipmentRentalBoard(client, accountId) {
  id(accountId);
  const leases = (await client.query('SELECT id,item_id,landlord_account,landlord_character,borrower_account,borrower_character,rent_cash,deposit_cash,deposit_remaining,ends_at,status FROM equipment_rental_leases WHERE landlord_account=$1 OR borrower_account=$1 ORDER BY id LIMIT 20', [accountId])).rows;
  const offers = (await client.query('SELECT id,item_id,rent_cash,deposit_cash,duration_seconds,published,expires_at,status FROM equipment_rental_offers WHERE landlord_account=$1 ORDER BY id LIMIT 20', [accountId])).rows;
  const quotes = (await client.query("SELECT o.id,o.rent_cash,o.deposit_cash,o.duration_seconds,o.expires_at,c.name FROM equipment_rental_offers o JOIN characters c ON c.id=o.landlord_character JOIN item_instances i ON i.id=o.item_id WHERE o.published=true AND o.status='open' AND o.expires_at>clock_timestamp() AND c.alive=true AND i.owner_scope='account' AND i.owner_id=o.landlord_account AND i.state='active' ORDER BY o.id LIMIT 20")).rows;
  return { leases, offers, quotes, depositPolicy: 'full_refund_on_canonical_return; original_borrower_death_burn', rentalFee: 'flat_earned_at_acceptance' };
}
export async function collectEquipmentRentalIssues(client) {
  const held = Number((await client.query('SELECT COALESCE(SUM(deposit_remaining),0) n FROM equipment_rental_leases')).rows[0].n);
  const rows = (await client.query("SELECT reason,COALESCE(SUM(amount),0) n FROM transactions WHERE currency='cash' AND reason IN ('equipment_rental:deposit','equipment_rental:deposit_refund','equipment_rental:deposit_burn','equipment_rental:rent_pay','equipment_rental:rent_receive') GROUP BY reason")).rows;
  const values = Object.fromEntries(rows.map(row => [row.reason, Number(row.n)])); const issues = [];
  if (held !== -(values['equipment_rental:deposit'] || 0) - (values['equipment_rental:deposit_refund'] || 0) + (values['equipment_rental:deposit_burn'] || 0)) issues.push({ reason: 'deposit_conservation', held });
  if ((values['equipment_rental:rent_pay'] || 0) + (values['equipment_rental:rent_receive'] || 0) !== 0) issues.push({ reason: 'rent_transfer' });
  const leases = (await client.query("SELECT id,item_id,landlord_account,borrower_account,borrower_character FROM equipment_rental_leases WHERE status='active' ORDER BY id")).rows;
  for (const lease of leases) {
    const custody = (await client.query('SELECT operation_id,depositor_scope,depositor_id FROM operation_escrow WHERE item_id=$1', [lease.item_id])).rows[0];
    if (!custody || custody.depositor_scope !== 'account' || custody.depositor_id !== lease.landlord_account) issues.push({ reason: 'landlord_title', leaseId: lease.id });
    const item = (await client.query('SELECT owner_scope,owner_id,state,template_id FROM item_instances WHERE id=$1', [lease.item_id])).rows[0];
    if (!item || item.owner_scope !== 'operation' || item.state !== 'escrowed' || item.template_id !== EQUIPMENT_RENTALS.templateId || item.owner_id !== custody?.operation_id) issues.push({ reason: 'canonical_custody', leaseId: lease.id });
    else if (item.owner_id !== lease.id) {
      const mystery = (await client.query('SELECT owner_scope,owner_id,authority_account_id,status,graph_id,graph_version FROM mystery_instances WHERE id=$1', [item.owner_id])).rows[0];
      if (!mystery || mystery.owner_scope !== 'character' || mystery.owner_id !== lease.borrower_character || mystery.authority_account_id !== lease.borrower_account || mystery.status !== 'active' || mystery.graph_id !== 'belladonna-demo' || Number(mystery.graph_version) !== 1) issues.push({ reason: 'borrower_custody', leaseId: lease.id });
    }
  }
  return issues;
}
const guarded = fn => async (client, ...args) => { assertItemTransaction(client); try { return await fn(client, ...args); } catch (error) { poisonItemTransaction(client, error); throw error; } };
export const createEquipmentRentalOffer = guarded(createOffer);
export const cancelEquipmentRentalOffer = guarded(cancelOffer);
export const acceptEquipmentRental = guarded(accept);
export const endEquipmentRental = guarded(end);

export const rentalToolAuthority = guarded(toolAuthority);

/** Exact original acceptance evidence; legacy receipts without IDs cannot authorize borrowing. */
export async function paidEquipmentRentalWitness(client, lease) {
  const request = (await client.query('SELECT account_id,original_character,receipt FROM equipment_rental_requests WHERE run_id=$1', [lease.id])).rows[0];
  const receipt = request?.receipt;
  if (!receipt || request.account_id !== lease.borrower_account || request.original_character !== lease.borrower_character
      || receipt.leaseId !== lease.id || receipt.itemId !== lease.item_id || receipt.landlordAccount !== lease.landlord_account
      || receipt.landlordCharacter !== lease.landlord_character || receipt.borrowerCharacter !== lease.borrower_character
      || receipt.rentCash !== Number(lease.rent_cash) || receipt.depositCash !== Number(lease.deposit_cash)
      || +new Date(receipt.endsAt) !== +new Date(lease.ends_at)) fail('paid_lease');
  const offer = (await client.query('SELECT * FROM equipment_rental_offers WHERE id=$1', [lease.offer_id])).rows[0];
  const guard = (await client.query('SELECT mutation_kind,owner_scope,owner_id,result_json FROM item_mutation_guards WHERE idempotency_key=$1', [`equipment-rental:${lease.id}:accept`])).rows[0];
  if (!offer || offer.item_id !== lease.item_id || offer.landlord_account !== lease.landlord_account || offer.landlord_character !== lease.landlord_character
      || Number(offer.rent_cash) !== Number(lease.rent_cash) || Number(offer.deposit_cash) !== Number(lease.deposit_cash)
      || +new Date(lease.ends_at) - +new Date(lease.starts_at) !== Number(offer.duration_seconds) * 1000
      || guard?.mutation_kind !== 'operation_action' || guard.owner_scope !== 'account' || guard.owner_id !== lease.landlord_account
      || !guard.result_json || stable(JSON.parse(guard.result_json)) !== stable(receipt)) fail('paid_lease');
  const expected = [[receipt.rentDebit, lease.borrower_character, lease.borrower_account, -Number(lease.rent_cash), 'equipment_rental:rent_pay', lease.landlord_character],
    [receipt.rentCredit, lease.landlord_character, lease.landlord_account, Number(lease.rent_cash), 'equipment_rental:rent_receive', lease.borrower_character]];
  if (Number(lease.deposit_cash)) expected.push([receipt.depositDebit, lease.borrower_character, lease.borrower_account, -Number(lease.deposit_cash), 'equipment_rental:deposit', lease.id]);
  else if (receipt.depositDebit !== null) fail('paid_lease');
  if (new Set(expected.map(row => row[0])).size !== expected.length) fail('paid_lease');
  for (const [journalId, character, account, amount, reason, counterparty] of expected) {
    const journal = (await client.query('SELECT * FROM transactions WHERE id=$1', [id(journalId)])).rows[0];
    const original = (await client.query('SELECT account_id FROM characters WHERE id=$1', [character])).rows[0];
    if (!journal || original?.account_id !== account || journal.character_id !== character || (journal.account_id !== null && journal.account_id !== account) || journal.currency !== 'cash'
        || Number(journal.amount) !== amount || journal.reason !== reason || journal.counterparty !== counterparty) fail('paid_lease');
  }
  const events = (await client.query("SELECT * FROM item_events WHERE item_id=$1 AND idempotency_key=$2 AND event_kind='escrowed' ORDER BY sequence LIMIT 2", [lease.item_id, `equipment-rental:${lease.id}:accept`])).rows;
  if (events.length !== 1 || events[0].from_owner_scope !== 'account' || events[0].from_owner_id !== lease.landlord_account
      || events[0].to_owner_scope !== 'operation' || events[0].to_owner_id !== lease.id || events[0].provenance_kind !== 'used_in_operation') fail('paid_lease');
  return lease;
}

export async function borrowedPrecisionTool(client, { accountId, characterId, lock = false }) {
  id(accountId); id(characterId);
  const rows = lock
    ? (await client.query("SELECT * FROM equipment_rental_leases WHERE borrower_account=$1 AND borrower_character=$2 AND status='active' ORDER BY id LIMIT 4 FOR UPDATE", [accountId, characterId])).rows
    : (await client.query("SELECT * FROM equipment_rental_leases WHERE borrower_account=$1 AND borrower_character=$2 AND status='active' ORDER BY id LIMIT 4", [accountId, characterId])).rows;
  if (rows.length > 3) fail('lease_limit');
  for (const lease of rows) {
    const item = lock
      ? (await client.query('SELECT * FROM item_instances WHERE id=$1 FOR UPDATE', [lease.item_id])).rows[0]
      : (await client.query('SELECT * FROM item_instances WHERE id=$1', [lease.item_id])).rows[0];
    const custody = (await client.query('SELECT * FROM operation_escrow WHERE item_id=$1', [lease.item_id])).rows[0];
    const actor = (await client.query('SELECT account_id,alive,is_npc FROM characters WHERE id=$1', [characterId])).rows[0];
    const landlord = (await client.query('SELECT account_id,alive,is_npc FROM characters WHERE id=$1', [lease.landlord_character])).rows[0];
    const accounts = (await client.query('SELECT id,status FROM accounts WHERE id IN ($1,$2)', [accountId, lease.landlord_account])).rows;
    const now = await clock(client);
    if (!actor?.alive || actor.is_npc || actor.account_id !== accountId || !landlord?.alive || landlord.is_npc || landlord.account_id !== lease.landlord_account
        || accounts.length !== 2 || accounts.some(row => row.status !== 'active') || +now >= +new Date(lease.ends_at)) continue;
    if (!item || item.template_id !== EQUIPMENT_RENTALS.templateId || item.definition_hash !== null
        || item.owner_scope !== 'operation' || item.owner_id !== lease.id || item.state !== 'escrowed'
        || custody?.operation_id !== lease.id || custody.depositor_scope !== 'account' || custody.depositor_id !== lease.landlord_account) continue;
    await paidEquipmentRentalWitness(client, lease);
    return lease;
  }
  return null;
}
