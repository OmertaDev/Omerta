import crypto from 'node:crypto';
import { GameError } from './game.js';
import * as Items from './items.js';
import { assertEquipmentUsable } from './itemdurability.js';
import { assertEstateResolutionScope } from './social/estate.js';
import { assertEquipmentRentalDeathScope } from './equipmentrentals.js';

export const ATOMIC_BARTER = Object.freeze({ templateId: 'item:precision_lock_tool', activeLimit: 3, maximumSeconds: 3600 });
export const atomicBarterDDL = `CREATE TABLE IF NOT EXISTS atomic_barter_requests (
 account_id TEXT NOT NULL, request_key TEXT NOT NULL, request_hash TEXT NOT NULL, run_id TEXT NOT NULL UNIQUE,
 receipt JSONB, account_ref TEXT REFERENCES accounts(id), actor_ref TEXT REFERENCES characters(id),
 PRIMARY KEY(account_id,request_key), CHECK(char_length(request_key) BETWEEN 1 AND 128),
 CHECK(char_length(request_hash)=64), CHECK((receipt IS NULL AND account_ref IS NULL AND actor_ref IS NULL)
 OR(receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND actor_ref IS NOT NULL)));
CREATE TABLE IF NOT EXISTS atomic_barter_offers (
 id TEXT PRIMARY KEY, maker_account TEXT NOT NULL REFERENCES accounts(id), taker_account TEXT NOT NULL REFERENCES accounts(id),
 maker_character TEXT NOT NULL REFERENCES characters(id), taker_character TEXT NOT NULL REFERENCES characters(id),
 offered_item TEXT NOT NULL REFERENCES item_instances(id), requested_item TEXT NOT NULL REFERENCES item_instances(id),
 expires_at TIMESTAMPTZ NOT NULL, state TEXT NOT NULL CHECK(state IN ('offered','completed','cancelled','expired','party_dead')),
 receipt JSONB, CHECK(maker_account<>taker_account AND maker_character<>taker_character AND offered_item<>requested_item),
 CHECK((state='completed')=(receipt IS NOT NULL)));
CREATE INDEX IF NOT EXISTS atomic_barter_maker ON atomic_barter_offers(maker_character,state);
CREATE INDEX IF NOT EXISTS atomic_barter_taker ON atomic_barter_offers(taker_character,state);`;

const fail = reason => { throw new GameError('atomic_barter', reason); };
const id = value => { if (typeof value !== 'string' || !value.length || value.length > 128) fail('terms'); return value; };
const exact = (body, keys) => body && typeof body === 'object' && !Array.isArray(body)
  && Object.keys(body).sort().join(',') === [...keys].sort().join(',');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function clock(client) { return new Date((await client.query('SELECT clock_timestamp() AS observed')).rows[0].observed); }
function terms(action, body) {
  if (action === 'create') {
    if (!exact(body, ['counterpartyCharacter','offeredItemId','requestedItemId','expiresInSeconds'])
      || !Number.isSafeInteger(body.expiresInSeconds) || body.expiresInSeconds < 60 || body.expiresInSeconds > ATOMIC_BARTER.maximumSeconds) fail('terms');
    return { action, counterpartyCharacter: id(body.counterpartyCharacter), offeredItemId: id(body.offeredItemId),
      requestedItemId: id(body.requestedItemId), expiresInSeconds: body.expiresInSeconds };
  }
  if (!['accept','cancel'].includes(action) || !exact(body, action === 'accept' ? ['offerId','consent'] : ['offerId'])
    || (action === 'accept' && body.consent !== true)) fail('terms');
  return { action, offerId: id(body.offerId), ...(action === 'accept' ? { consent: true } : {}) };
}
async function parties(client, ids) {
  if (ids[0] === ids[1]) fail('self');
  const rows = [];
  for (const character of [...ids].sort()) {
    const row = (await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [character])).rows[0];
    if (!row?.alive || row.is_npc || !row.account_id) fail('original_party');
    rows.push(row);
  }
  if (rows[0].account_id === rows[1].account_id) fail('self');
  for (const account of rows.map(row => row.account_id).sort()) {
    if ((await client.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE', [account])).rows[0]?.status !== 'active') fail('account');
    const current = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [account])).rows;
    if (current.length !== 1 || !ids.includes(current[0].id)) fail('original_party');
  }
  return rows;
}
async function tools(client, offer) {
  if (offer.offered_item === offer.requested_item) fail('self');
  for (const itemId of [offer.offered_item, offer.requested_item].sort()) {
    const row = (await client.query('SELECT id,template_id,owner_scope,owner_id,state FROM item_instances WHERE id=$1 FOR UPDATE', [itemId])).rows[0];
    const account = itemId === offer.offered_item ? offer.maker_account : offer.taker_account;
    if (!row || row.template_id !== ATOMIC_BARTER.templateId || row.state !== 'active' || row.owner_scope !== 'account' || row.owner_id !== account) fail('item_custody');
  }
  for (const itemId of [offer.offered_item, offer.requested_item].sort()) {
    await assertEquipmentUsable(client, { itemId, owner: { scope: 'account', id: itemId === offer.offered_item ? offer.maker_account : offer.taker_account } });
  }
}
function restore(client, row) {
  const original = [row.id, row.state, row.receipt];
  Items.registerItemTransactionUndo(client, () => client.query('UPDATE atomic_barter_offers SET state=$2,receipt=$3 WHERE id=$1', original));
}
const dto = row => ({ offerId: row.id, makerCharacter: row.maker_character, takerCharacter: row.taker_character,
  offeredItemId: row.offered_item, requestedItemId: row.requested_item, expiresAt: new Date(row.expires_at).toISOString(), state: row.state });

export async function atomicBarterCommand(client, accountId, action, body, key) {
  Items.assertItemTransaction(client);
  try {
    id(accountId); id(key); const normalized = terms(action, body), requestHash = hash(normalized);
    const old = (await client.query('SELECT request_hash,receipt FROM atomic_barter_requests WHERE account_id=$1 AND request_key=$2', [accountId,key])).rows[0];
    if (old) { if (old.request_hash !== requestHash) fail('request_conflict'); if (!old.receipt) fail('in_progress'); return old.receipt; }
    const run = crypto.randomUUID();
    Items.registerItemTransactionUndo(client, () => client.query('DELETE FROM atomic_barter_requests WHERE account_id=$1 AND request_key=$2 AND run_id=$3', [accountId,key,run]));
    await client.query('INSERT INTO atomic_barter_requests(account_id,request_key,request_hash,run_id) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,request_key) DO NOTHING', [accountId,key,requestHash,run]);
    const reserved = (await client.query('SELECT run_id,request_hash,receipt FROM atomic_barter_requests WHERE account_id=$1 AND request_key=$2 FOR UPDATE', [accountId,key])).rows[0];
    if (reserved.request_hash !== requestHash) fail('request_conflict'); if (reserved.receipt) return reserved.receipt; if (reserved.run_id !== run) fail('in_progress');
    let offer, caller;
    if (action === 'create') {
      const current = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [accountId])).rows;
      if (current.length !== 1) fail('original_party');
      const people = await parties(client, [current[0].id, normalized.counterpartyCharacter]);
      caller = people.find(row => row.id === current[0].id);
      const target = people.find(row => row.id === normalized.counterpartyCharacter);
      offer = { id: crypto.randomUUID(), maker_account: accountId, taker_account: target.account_id, maker_character: caller.id,
        taker_character: target.id, offered_item: normalized.offeredItemId, requested_item: normalized.requestedItemId, state: 'offered', receipt: null };
      // Only the author spends a slot. An unsolicited offer grants no custody
      // and cannot consume the target's authority or finite death lock scope.
      const active = (await client.query("SELECT id FROM atomic_barter_offers WHERE maker_character=$1 AND state='offered' AND expires_at>clock_timestamp() ORDER BY id LIMIT 4", [caller.id])).rows;
      if (active.length >= ATOMIC_BARTER.activeLimit) fail('active_limit');
      await tools(client, offer); offer.expires_at = new Date(+await clock(client) + normalized.expiresInSeconds * 1000);
      Items.registerItemTransactionUndo(client, () => client.query('DELETE FROM atomic_barter_offers WHERE id=$1', [offer.id]));
      await client.query("INSERT INTO atomic_barter_offers(id,maker_account,taker_account,maker_character,taker_character,offered_item,requested_item,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'offered')", [offer.id,accountId,target.account_id,caller.id,target.id,offer.offered_item,offer.requested_item,offer.expires_at]);
    } else {
      const hint = (await client.query('SELECT * FROM atomic_barter_offers WHERE id=$1', [normalized.offerId])).rows[0];
      if (!hint || ![hint.maker_account,hint.taker_account].includes(accountId)) fail('offer');
      const people = await parties(client, [hint.maker_character,hint.taker_character]);
      caller = people.find(row => row.account_id === accountId);
      offer = (await client.query('SELECT * FROM atomic_barter_offers WHERE id=$1 FOR UPDATE', [hint.id])).rows[0];
      if (offer.maker_account !== people.find(row => row.id === offer.maker_character)?.account_id
        || offer.taker_account !== people.find(row => row.id === offer.taker_character)?.account_id || offer.state !== 'offered') fail('original_party');
      if (action === 'cancel') {
        if (accountId !== offer.maker_account) fail('maker');
        restore(client, offer); await client.query("UPDATE atomic_barter_offers SET state='cancelled' WHERE id=$1", [offer.id]); offer.state = 'cancelled';
      } else {
        if (accountId !== offer.taker_account) fail('taker');
        await tools(client, offer); if (+await clock(client) >= +new Date(offer.expires_at)) fail('expired');
        const maker = { scope: 'account', id: offer.maker_account }, taker = { scope: 'account', id: offer.taker_account };
        const first = await Items.transferItem(client, maker, taker, offer.offered_item, 'atomic barter', 'barter:' + run + ':0');
        const second = await Items.transferItem(client, taker, maker, offer.requested_item, 'atomic barter', 'barter:' + run + ':1');
        if (+await clock(client) >= +new Date(offer.expires_at)) fail('expired');
        restore(client, offer); offer.state = 'completed'; offer.receipt = { ...dto(offer), items: [
          { itemId: first.id, templateId: first.templateId, ownerCharacter: offer.taker_character },
          { itemId: second.id, templateId: second.templateId, ownerCharacter: offer.maker_character },
        ] };
        const changed = await client.query("UPDATE atomic_barter_offers SET state='completed',receipt=$2 WHERE id=$1 AND state='offered'", [offer.id,offer.receipt]);
        if (changed.rowCount !== 1) fail('offer_changed');
      }
    }
    const receipt = offer.receipt || dto(offer);
    const saved = await client.query('UPDATE atomic_barter_requests SET receipt=$4,account_ref=$1,actor_ref=$5 WHERE account_id=$1 AND request_key=$2 AND run_id=$3 AND receipt IS NULL', [accountId,key,run,receipt,caller.id]);
    if (saved.rowCount !== 1) fail('receipt_changed');
    return receipt;
  } catch (error) { Items.poisonItemTransaction(client,error); throw error; }
}
export const atomicBarterAction = (pool, accountId, action, body, key) => Items.withItemTransaction(pool, client => atomicBarterCommand(client, accountId, action, body, key));
export async function ownAtomicBarterBoard(pool, accountId) {
  id(accountId);
  return Items.withItemRead(pool, async client => ({ offers: (await client.query('SELECT * FROM atomic_barter_offers WHERE maker_account=$1 OR taker_account=$1 ORDER BY id LIMIT 50', [accountId])).rows.map(dto) }));
}
export async function atomicBarterCounterparts(pool, characterId) {
  id(characterId); const rows = (await pool.query("SELECT maker_character,taker_character FROM atomic_barter_offers WHERE maker_character=$1 AND state='offered' AND expires_at>clock_timestamp() ORDER BY id LIMIT 4", [characterId])).rows;
  if (rows.length > ATOMIC_BARTER.activeLimit) fail('active_limit');
  return rows.flatMap(row => [row.maker_character,row.taker_character]).filter((value,index,all) => value !== characterId && all.indexOf(value) === index).sort();
}
export async function voidAtomicBartersAtDeath(client, victim) {
  Items.assertItemTransaction(client);
  try {
    const dead = (await client.query('SELECT alive,account_id FROM characters WHERE id=$1', [id(victim.id)])).rows[0];
    if (!dead || dead.alive !== false || dead.account_id !== victim.account_id) fail('death_required');
    // Incoming offers hold no assets and require no maker actor lock. Retire
    // their metadata after the victim lock, without an attacker-controlled cap.
    const rows = (await client.query("SELECT * FROM atomic_barter_offers WHERE (maker_character=$1 OR taker_character=$1) AND state='offered' ORDER BY id FOR UPDATE", [victim.id])).rows;
    for (const row of rows) { restore(client,row); await client.query("UPDATE atomic_barter_offers SET state='party_dead' WHERE id=$1", [row.id]); }
    return { retired: rows.length };
  } catch (error) { Items.poisonItemTransaction(client,error); throw error; }
}

// Actual estate only: adopt an already locked private union; never acquire actors late.
export async function recoverAtomicBartersInEstate(client, victim, prelockScope, estateScope) {
  Items.assertItemTransaction(client);
  try {
    await assertEstateResolutionScope(client, victim.id, estateScope);
    const locked = await assertEquipmentRentalDeathScope(client, victim.id, prelockScope);
    for (const counterpart of await atomicBarterCounterparts(client, victim.id))
      if (!locked.ids.has(counterpart)) throw new GameError('contention', 'Barter counterpart changed; retry the whole action.');
    return await voidAtomicBartersAtDeath(client, victim);
  } catch (error) { Items.poisonItemTransaction(client, error); throw error; }
}
