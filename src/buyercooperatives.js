import crypto from 'node:crypto';
import { GameError, trunkCap } from './game.js';
import { jailed, safeHoused } from './rules.js';
import { postOrder, orderCashQuote } from './market.js';
import { buyerCooperativeApportion, buyerCooperativeJournal, cancelBuyerCooperativeFunding, settleBuyerCooperativeOrder } from './buyercooperativecustody.js';

export const BUYER_COOPERATIVE = Object.freeze({ maxMembers: 3, maxUnits: 8, maxActiveRights: 3, maxPrice: 100000, maxFeeCap: 10000, cashReserve: 1000 });
const fail = reason => { const error = new GameError('buyer_cooperative', `Buyer cooperative refused: ${reason}.`); error.reason = reason; throw error; };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('terms'); return value; };
const exact = (body, keys) => { if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).sort().join(',') !== keys.sort().join(',')) fail('terms'); };
const integer = (value, min, max) => { if (!Number.isSafeInteger(value) || value < min || value > max) fail('terms'); return value; };
const actor = ch => { if (!ch?.alive || ch.is_npc) fail('actor'); return id(ch.account_id); };
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const requestKey = key => { if (typeof key !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(key)) fail('terms'); return key; };
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
export function buyerCooperativeTerms(body) {
  exact(body, ['members', 'unitPrice', 'feeCap', 'fundingSeconds', 'orderHours', 'published', 'partialPolicy']);
  if (!Array.isArray(body.members) || body.members.length < 1 || body.members.length > 3 || typeof body.published !== 'boolean' || body.partialPolicy !== 'proportional') fail('terms');
  const members = body.members.map(member => { exact(member, ['accountId', 'units']); return { accountId: id(member.accountId), units: integer(member.units, 1, 8) }; }).sort((a, b) => a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0);
  if (new Set(members.map(m => m.accountId)).size !== members.length || members.reduce((sum, m) => sum + m.units, 0) > 8) fail('terms');
  return { members, unitPrice: integer(body.unitPrice, 50, 100000), feeCap: integer(body.feeCap, 1, 10000), fundingSeconds: integer(body.fundingSeconds, 60, 21600), orderHours: integer(body.orderHours, 1, 24), published: body.published, partialPolicy: 'proportional' };
}
async function replay(client, account, key, identity) {
  const row = (await client.query('SELECT identity,receipt FROM buyer_cooperative_receipts WHERE account_id=$1 AND request_key=$2', [account, key])).rows[0];
  if (!row) return null; if (stable(row.identity) !== stable(identity)) fail('request_conflict'); return { ...row.receipt, replayed: true };
}
async function save(client, account, key, identity, receipt) {
  await client.query('INSERT INTO buyer_cooperative_receipts(account_id,request_key,identity,receipt) VALUES($1,$2,$3,$4)', [account, key, identity, receipt]); return receipt;
}
async function locked(client, cooperativeId) {
  const hint = (await client.query('SELECT order_id FROM buyer_cooperatives WHERE id=$1', [cooperativeId])).rows[0]; if (!hint) fail('not_found');
  if (hint.order_id) await client.query('SELECT id FROM market_listings WHERE id=$1 FOR UPDATE', [hint.order_id]);
  const row = (await client.query('SELECT * FROM buyer_cooperatives WHERE id=$1 FOR UPDATE', [cooperativeId])).rows[0];
  if (!row || row.order_id !== hint.order_id) fail('source_changed');
  const members = (await client.query('SELECT * FROM buyer_cooperative_members WHERE cooperative_id=$1 ORDER BY position FOR UPDATE', [row.id])).rows;
  const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  return { row, members, now };
}
function own(ch, members, { funded = false } = {}) {
  const member = members.find(m => m.account_id === ch.account_id);
  if (!member || member.original_character !== ch.id || member.is_dead || (funded && Number(member.funded_cash) <= 0)) fail('original_member'); return member;
}
function projection(row, member = null) {
  return { id: row.id, status: row.status, district: row.district, good: 'gin', totalUnits: row.units, unitPrice: row.unit_price, feeCap: row.fee_cap, termsHash: row.terms_hash,
    partialPolicy: 'proportional', fundingDeadline: new Date(row.funding_deadline).toISOString(), orderId: row.order_id,
    ...(member ? { ownShare: { units: member.unit_share, maximumCash: member.funding_required, fundedCash: member.funded_cash, dead: member.is_dead, cashClaimable: member.is_dead ? 0 : Number(member.cash_entitlement) - Number(member.cash_claimed), ginClaimable: member.is_dead ? 0 : Number(member.gin_entitlement) - Number(member.gin_claimed) } } : {}) };
}
export async function createBuyerCooperative(ch, body, key, client) {
  const account = actor(ch), terms = buyerCooperativeTerms(body);
  // Allocation rank is canonical, but request-array identity remains exact on replay.
  const identity = { action: 'create', terms: { ...terms, members: body.members.map(member => ({ accountId: member.accountId, units: member.units })) } }; requestKey(key);
  const prior = await replay(client, account, key, identity); if (prior) return prior;
  if (!terms.members.some(m => m.accountId === account) || jailed(ch) || safeHoused(ch)) fail('organizer');
  if ((await client.query("SELECT id FROM buyer_cooperatives WHERE organizer_account=$1 AND status IN ('funding','live') LIMIT 3", [account])).rows.length >= 3) fail('active_limit');
  const original = [];
  for (const member of terms.members) {
    const current = (await client.query('SELECT id,alive,is_npc FROM characters WHERE account_id=$1 AND alive', [member.accountId])).rows[0];
    if (!current || current.is_npc) fail('member'); original.push({ ...member, characterId: current.id });
  }
  const fixed = { ...terms, members: original, district: ch.loc, cashRefundPolicy: 'proportional_funded_cash', ginAllocationPolicy: 'proportional_unit_share', memberCancelAllowed: true, organizerCancelAllowed: true };
  const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now, cooperativeId = crypto.randomUUID();
  const units = terms.members.reduce((sum, m) => sum + m.units, 0), feeShares = buyerCooperativeApportion(terms.feeCap, original.map(m => m.units));
  const row = { id: cooperativeId, status: 'funding', district: ch.loc, units, unit_price: terms.unitPrice, fee_cap: terms.feeCap, terms_hash: hash(fixed), funding_deadline: new Date(new Date(now).getTime() + terms.fundingSeconds * 1000), order_id: null };
  await client.query('INSERT INTO buyer_cooperatives(id,organizer_account,organizer_character,district,units,unit_price,fee_cap,terms,terms_hash,published,funding_deadline) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [cooperativeId, account, ch.id, ch.loc, units, terms.unitPrice, terms.feeCap, fixed, row.terms_hash, terms.published, row.funding_deadline]);
  for (let n = 0; n < original.length; n++) await client.query('INSERT INTO buyer_cooperative_members(cooperative_id,account_id,original_character,position,unit_share,funding_required) VALUES($1,$2,$3,$4,$5,$6)', [cooperativeId, original[n].accountId, original[n].characterId, n, original[n].units, original[n].units * terms.unitPrice + feeShares[n]]);
  return save(client, account, key, identity, { ok: true, cooperative: projection(row), funded: 0 });
}
export async function fundBuyerCooperative(ch, cooperativeId, body, key, client, h) {
  const account = actor(ch); id(cooperativeId); exact(body, ['consent', 'termsHash', 'maxCash']);
  if (body.consent !== true || typeof body.termsHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.termsHash)) fail('consent'); integer(body.maxCash, 1, 810000);
  const identity = { action: 'fund', cooperativeId, terms: { consent: true, termsHash: body.termsHash, maxCash: body.maxCash } }; requestKey(key);
  const prior = await replay(client, account, key, identity); if (prior) return prior;
  const { row, members, now } = await locked(client, cooperativeId), member = own(ch, members);
  if (row.status !== 'funding' || member.funded_cash || new Date(row.funding_deadline) <= new Date(now)) fail('funding_state');
  if (jailed(ch) || safeHoused(ch) || body.termsHash !== row.terms_hash || body.maxCash !== member.funding_required) fail('consent');
  const active = (await client.query("SELECT m.cooperative_id FROM buyer_cooperative_members m JOIN buyer_cooperatives c ON c.id=m.cooperative_id WHERE m.account_id=$1 AND m.funded_cash>0 AND m.is_dead=false AND (c.status IN ('funding','live') OR m.cash_entitlement>m.cash_claimed OR m.gin_entitlement>m.gin_claimed) LIMIT 3", [account])).rows.length;
  if (active >= 3) fail('active_limit');
  const amount = Number(member.funding_required), cash = Number(ch.cash);
  if (!Number.isFinite(cash) || cash > Number.MAX_SAFE_INTEGER || cash - amount < 1000) fail('reserve');
  ch.cash = cash - amount;
  const debit = await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -amount, reason: 'buyer_cooperative:fund', counterparty: row.id });
  await client.query('UPDATE buyer_cooperatives SET cash_balance=$2 WHERE id=$1', [row.id, Number(row.cash_balance) + amount]);
  await client.query('UPDATE buyer_cooperative_members SET funded_cash=$3 WHERE cooperative_id=$1 AND account_id=$2', [row.id, account, amount]);
  await buyerCooperativeJournal(client, row.id, 'fund', amount, 0, [debit], null, account);
  return save(client, account, key, identity, { ok: true, funded: amount, cooperative: projection(row, { ...member, funded_cash: amount }) });
}
export async function launchBuyerCooperative(ch, cooperativeId, body, key, client, h) {
  const account = actor(ch); id(cooperativeId); exact(body, ['termsHash']);
  if (typeof body.termsHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.termsHash)) fail('terms');
  const identity = { action: 'launch', cooperativeId, terms: { termsHash: body.termsHash } }; requestKey(key);
  const prior = await replay(client, account, key, identity); if (prior) return prior;
  const { row, members, now } = await locked(client, cooperativeId); const member = own(ch, members);
  if (!member.funded_cash && row.organizer_character !== ch.id) fail('original_member');
  if (row.organizer_character !== ch.id || row.status !== 'funding' || row.terms_hash !== body.termsHash || new Date(row.funding_deadline) <= new Date(now) || ch.loc !== row.district) fail('launch');
  if (members.some(m => m.is_dead || Number(m.funded_cash) !== Number(m.funding_required)) || members.reduce((sum, m) => sum + Number(m.funded_cash), 0) !== Number(row.cash_balance)) fail('not_fully_funded');
  for (const member of members) if (!(await client.query('SELECT id FROM characters WHERE id=$1 AND alive', [member.original_character])).rows.length) fail('dead_member');
  const quote = orderCashQuote(row.units, row.unit_price, h);
  if (quote.fee > row.fee_cap || quote.total > Number(row.cash_balance)) fail('fee_cap');
  // The existing Depot.restockDepot adapter pattern, backed by locked real joint funds.
  // No organizer pocket credit or debit is performed; canonical market fees/escrow execute once.
  const payer = { ...ch, cash: Number(row.cash_balance) }, ledgerIds = [];
  const helper = { ...h, ledger: async (c, entry) => { const ledgerId = await h.ledger(c, { ...entry, characterId: null, counterparty: row.id }); ledgerIds.push(ledgerId); return ledgerId; } };
  const result = await postOrder(payer, { goodId: 'gin', qty: row.units, price: row.unit_price, hours: row.terms.orderHours }, client, helper);
  if (result.escrow !== row.units * row.unit_price || result.fee !== quote.fee || payer.cash !== Number(row.cash_balance) - quote.total) fail('canonical_order');
  await client.query('INSERT INTO buyer_cooperative_orders(order_id,cooperative_id) VALUES($1,$2)', [result.id, row.id]);
  await client.query("UPDATE buyer_cooperatives SET order_id=$2,status='live',cash_balance=$3,fee_paid=$4 WHERE id=$1", [row.id, result.id, payer.cash, result.fee]);
  await buyerCooperativeJournal(client, row.id, 'post_order', -quote.total, 0, ledgerIds, result.id);
  return save(client, account, key, identity, { ok: true, orderId: result.id, canonical: result, organizerPocketDebit: 0 });
}
export async function settleBuyerCooperative(ch, cooperativeId, body, key, client, h) {
  const account = actor(ch); id(cooperativeId); exact(body, ['cancel']); if (typeof body.cancel !== 'boolean') fail('terms');
  const identity = { action: 'settle', cooperativeId, terms: { cancel: body.cancel } }; requestKey(key);
  const prior = await replay(client, account, key, identity); if (prior) return prior;
  const { row, members, now } = await locked(client, cooperativeId), member = own(ch, members);
  if (!member.funded_cash && row.organizer_character !== ch.id) fail('original_member');
  let result;
  if (row.status === 'funding') {
    if (!body.cancel && new Date(now) < new Date(row.funding_deadline)) fail('not_ready'); result = await cancelBuyerCooperativeFunding(client, row.id);
  } else if (row.status === 'live') result = await settleBuyerCooperativeOrder(client, row.order_id, h.ledger, body);
  else result = { ok: true, alreadySettled: true };
  return save(client, account, key, identity, result);
}
export async function claimBuyerCooperative(ch, cooperativeId, body, key, client, h) {
  const account = actor(ch); id(cooperativeId); exact(body, ['cash', 'ginQty']); if (typeof body.cash !== 'boolean') fail('terms'); integer(body.ginQty, 0, 8);
  const identity = { action: 'claim', cooperativeId, terms: { cash: body.cash, ginQty: body.ginQty } }; requestKey(key);
  const prior = await replay(client, account, key, identity); if (prior) return prior;
  const { row, members } = await locked(client, cooperativeId), member = own(ch, members, { funded: true });
  if (!['settled', 'cancelled'].includes(row.status)) fail('not_settled');
  const cash = body.cash ? Number(member.cash_entitlement) - Number(member.cash_claimed) : 0, gin = body.ginQty;
  if (cash < 0 || cash > Number(row.cash_balance) || gin > Number(member.gin_entitlement) - Number(member.gin_claimed) || gin > Number(row.gin_balance)) fail('entitlement');
  const carried = Object.values(h.owned.cargo).reduce((sum, value) => sum + Number(value), 0);
  if (gin && (jailed(ch) || ch.loc !== row.district || !Number.isSafeInteger(carried) || carried + gin > trunkCap(h))) fail('cargo');
  const ids = [];
  if (cash) { ch.cash = Number(ch.cash) + cash; if (!Number.isFinite(ch.cash) || ch.cash > Number.MAX_SAFE_INTEGER) fail('cash'); ids.push(await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: cash, reason: 'buyer_cooperative:refund', counterparty: row.id })); }
  if (gin) {
    const next = Number(h.owned.cargo.gin || 0) + gin;
    await client.query("DELETE FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [ch.id]);
    await client.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',$2)", [ch.id, next]); h.owned.cargo.gin = next;
    ids.push(await h.ledger(client, { characterId: ch.id, currency: 'gin', amount: gin, reason: 'buyer_cooperative:claim', counterparty: row.id }));
  }
  await client.query('UPDATE buyer_cooperatives SET cash_balance=$2,gin_balance=$3 WHERE id=$1', [row.id, Number(row.cash_balance) - cash, Number(row.gin_balance) - gin]);
  await client.query('UPDATE buyer_cooperative_members SET cash_claimed=$3,gin_claimed=$4 WHERE cooperative_id=$1 AND account_id=$2', [row.id, account, Number(member.cash_claimed) + cash, Number(member.gin_claimed) + gin]);
  await buyerCooperativeJournal(client, row.id, 'claim', -cash, -gin, ids, row.order_id, account);
  return save(client, account, key, identity, { ok: true, refunded: cash, claimedGin: gin });
}
export async function buyerCooperativeBoard(client, account) {
  id(account); const rows = (await client.query('SELECT c.*,m.unit_share,m.funding_required,m.funded_cash,m.is_dead,m.cash_entitlement,m.cash_claimed,m.gin_entitlement,m.gin_claimed FROM buyer_cooperatives c JOIN buyer_cooperative_members m ON m.cooperative_id=c.id WHERE m.account_id=$1 ORDER BY c.created_at DESC,c.id LIMIT 100', [account])).rows;
  return rows.map(row => projection(row, row));
}
export async function publicBuyerCooperatives(client) {
  return (await client.query("SELECT id,status,district,units,unit_price FROM buyer_cooperatives WHERE published=true AND status IN ('funding','live') ORDER BY created_at DESC,id LIMIT 100")).rows.map(row => ({ id: row.id, status: row.status, district: row.district, units: row.units, unitPrice: row.unit_price, good: 'gin' }));
}
export async function buyerCooperativeDueCandidates(client, limit = 20) {
  integer(limit, 1, 100);
  return (await client.query("SELECT c.id,c.organizer_account,c.organizer_character FROM buyer_cooperatives c JOIN characters ch ON ch.id=c.organizer_character AND ch.account_id=c.organizer_account AND ch.alive AND ch.is_npc=false WHERE c.status='funding' AND c.funding_deadline<=clock_timestamp() ORDER BY c.funding_deadline,c.id LIMIT $1", [limit])).rows;
}
