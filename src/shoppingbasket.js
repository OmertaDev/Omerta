import crypto from 'node:crypto';
import { GameError } from './game.js';
import * as I from './items.js';
import * as C from './consignments.js';

export const SHOPPING_BASKET = Object.freeze({ lines: 2, originals: 4, maximumQuotes: 3, quoteSeconds: 60, templateId: 'item:precision_lock_tool' });
const fail = reason => { throw new GameError('shopping_basket', reason); };
const id = value => { if (typeof value !== 'string' || !/^[!-~]{1,128}$/.test(value)) fail('identity'); return value; };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const whole = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const stable = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : entry);
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const date = value => new Date(value).toISOString();
const clock = async c => new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const purchaseScopes = new WeakMap();

function hooks() {
  for (const name of ['consignmentEconomyListing', 'consignmentEconomySaleWitness', 'buyConsignmentWithBasketContext', 'assertFreshConsignmentBasketProof']) {
    if (typeof C[name] !== 'function') fail('integration_required');
  }
}
function terms(action, body) {
  if (action === 'quote') {
    if (!exact(body, ['lines', 'consent']) || body.consent !== true || !Array.isArray(body.lines) || body.lines.length !== 2) fail('terms');
    const lines = body.lines.map(line => {
      if (!exact(line, ['consignmentId', 'sourceHash']) || !digest(line.sourceHash)) fail('terms');
      return { consignmentId: id(line.consignmentId), sourceHash: line.sourceHash };
    }).sort((a, b) => a.consignmentId < b.consignmentId ? -1 : 1);
    if (lines[0].consignmentId === lines[1].consignmentId) fail('distinct_lines');
    return { action, lines, consent: true };
  }
  if (!['checkout', 'cancel'].includes(action) || !exact(body, ['basketId', 'sourceHash', 'consent']) || body.consent !== true || !digest(body.sourceHash)) fail('terms');
  return { action, basketId: id(body.basketId), sourceHash: body.sourceHash, consent: true };
}
function listingSource(line) {
  return { consignmentId: line.consignmentId, sourceHash: line.sourceHash, itemId: line.itemId,
    grossPrice: line.grossPrice, hostFee: line.hostFee, seller: line.seller, host: line.host, expiresAt: date(line.expiresAt) };
}
function source(row) {
  return { id: row.id, buyerAccount: row.buyer_account, buyerCharacter: row.buyer_character,
    hostAccount: row.host_account, hostCharacter: row.host_character, lines: row.lines,
    totalCash: Number(row.total_cash), observedAt: date(row.observed_at), expiresAt: date(row.expires_at) };
}
const dto = row => ({ basketId: row.id, sourceHash: row.source_hash, status: row.status, totalCash: Number(row.total_cash),
  observedAt: date(row.observed_at), expiresAt: date(row.expires_at),
  lines: row.lines.map(line => ({ consignmentId: line.consignmentId, sourceHash: line.sourceHash, price: line.grossPrice, hostFee: line.hostFee })) });
function check(row) {
  if (!row || !Array.isArray(row.lines) || row.lines.length !== 2 || hash(source(row)) !== row.source_hash) fail('basket_source');
  const [a, b] = row.lines;
  for (const line of row.lines) {
    if (!exact(line, ['consignmentId', 'sourceHash', 'itemId', 'grossPrice', 'hostFee', 'seller', 'host', 'expiresAt'])
      || !digest(line.sourceHash) || !whole(line.grossPrice, 1, 1000000) || !whole(line.hostFee, 0, Math.floor(line.grossPrice / 5))
      || !exact(line.seller, ['accountId', 'characterId']) || !exact(line.host, ['accountId', 'characterId'])) fail('basket_source');
    for (const value of [line.consignmentId, line.itemId, line.seller.accountId, line.seller.characterId, line.host.accountId, line.host.characterId]) id(value);
  }
  if (a.consignmentId >= b.consignmentId || a.itemId === b.itemId || stable(a.host) !== stable(b.host)
    || a.host.accountId !== row.host_account || a.host.characterId !== row.host_character
    || new Set([a.seller.accountId, b.seller.accountId, row.host_account, row.buyer_account]).size !== 4
    || new Set([a.seller.characterId, b.seller.characterId, row.host_character, row.buyer_character]).size !== 4
    || Number(row.total_cash) !== a.grossPrice + b.grossPrice || !whole(Number(row.total_cash), 2, 2000000)
    || +new Date(row.expires_at) !== Math.min(+new Date(row.observed_at) + 60000, ...row.lines.map(line => +new Date(line.expiresAt)))
    || +new Date(row.expires_at) <= +new Date(row.observed_at)) fail('basket_source');
  return row;
}
async function current(c, account) {
  const rows = (await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [account])).rows;
  if (rows.length !== 1) fail('original_actor'); return rows[0].id;
}
async function lockOriginals(c, lines, account, buyerId) {
  const ids = [lines[0].seller.characterId, lines[1].seller.characterId, lines[0].host.characterId, buyerId];
  if (new Set(ids).size !== 4) fail('distinct_originals');
  const rows = [];
  for (const key of [...ids].sort()) {
    const row = (await c.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [id(key)])).rows[0];
    if (!row?.alive || row.is_npc) fail('original_actor'); rows.push(row);
  }
  if (new Set(rows.map(row => row.account_id)).size !== 4) fail('distinct_originals');
  for (const owner of rows.map(row => row.account_id).sort()) {
    if ((await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE', [owner])).rows[0]?.status !== 'active') fail('account');
  }
  const expected = [...lines.map(line => line.seller), lines[0].host, { accountId: account, characterId: buyerId }];
  for (const party of expected) if (rows.find(row => row.id === party.characterId)?.account_id !== party.accountId
    || await current(c, party.accountId) !== party.characterId) fail('original_actor');
  return rows;
}
async function snapshots(c, references) {
  const rows = [];
  for (const ref of references) rows.push(await C.consignmentEconomyListing(c, ref.consignmentId, ref.sourceHash));
  if (rows.length !== 2 || rows.some(row => row.status !== 'active') || stable(rows[0].host) !== stable(rows[1].host)
    || rows[0].seller.accountId === rows[1].seller.accountId || rows[0].itemId === rows[1].itemId) fail('consenting_lines');
  return rows.map(listingSource);
}
async function authoredQuote(c, row) {
  const request = (await c.query('SELECT account_id,account_ref,original_character,basket_ref,body_hash,request_json,receipt FROM shopping_basket_requests WHERE run_id=$1', [row.id])).rows[0];
  const expected = { action: 'quote', lines: row.lines.map(line => ({ consignmentId: line.consignmentId, sourceHash: line.sourceHash })), consent: true };
  if (!request || request.account_id !== row.buyer_account || request.account_ref !== row.buyer_account
    || request.original_character !== row.buyer_character || request.basket_ref !== row.id || request.body_hash !== hash(expected)
    || stable(request.request_json) !== stable(expected) || stable(request.receipt) !== stable({ ok: true, ...dto({ ...row, status: 'quoted' }) })) fail('quote_receipt');
}
async function quote(c, account, t, run) {
  const before = await snapshots(c, t.lines), buyerId = await current(c, account);
  await lockOriginals(c, before, account, buyerId);
  for (const line of before) await c.query('SELECT id FROM consignments WHERE id=$1 FOR UPDATE', [line.consignmentId]);
  const after = await snapshots(c, t.lines); if (stable(before) !== stable(after)) fail('listing_changed');
  const now = await clock(c);
  if ((await c.query("SELECT id FROM shopping_baskets WHERE buyer_character=$1 AND status='quoted' AND expires_at>$2 ORDER BY id LIMIT 3", [buyerId, now])).rows.length >= 3) fail('quote_limit');
  const row = { id: run, buyer_account: account, buyer_character: buyerId, host_account: after[0].host.accountId,
    host_character: after[0].host.characterId, lines: after, total_cash: after.reduce((sum, line) => sum + line.grossPrice, 0),
    observed_at: now, expires_at: new Date(Math.min(+now + 60000, ...after.map(line => +new Date(line.expiresAt)))), status: 'quoted' };
  row.source_hash = hash(source(row)); check(row);
  if (+await clock(c) >= +row.expires_at) fail('expired');
  I.registerItemTransactionUndo(c, () => c.query('DELETE FROM shopping_baskets WHERE id=$1', [run]));
  await c.query("INSERT INTO shopping_baskets(id,buyer_account,buyer_character,host_account,host_character,lines,total_cash,observed_at,expires_at,source_hash,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'quoted')",
    [run, account, buyerId, row.host_account, row.host_character, JSON.stringify(after), row.total_cash, now, row.expires_at, row.source_hash]);
  if (+await clock(c) >= +row.expires_at) fail('expired');
  return { actorId: buyerId, receipt: { ok: true, ...dto(row) } };
}
async function scopeSource(c, scope) {
  const row = check((await c.query('SELECT * FROM shopping_baskets WHERE id=$1', [scope.basketId])).rows[0]);
  if (stable(source(row)) !== scope.source || row.status !== 'quoted' || +await clock(c) >= +new Date(row.expires_at)) fail('purchase_scope_changed');
  await authoredQuote(c, row);
  for (const actor of scope.originals) {
    const fresh = (await c.query('SELECT account_id,alive,is_npc FROM characters WHERE id=$1', [actor.id])).rows[0];
    if (!fresh?.alive || fresh.is_npc || fresh.account_id !== actor.account_id || await current(c, actor.account_id) !== actor.id
      || (await c.query('SELECT status FROM accounts WHERE id=$1', [actor.account_id])).rows[0]?.status !== 'active') fail('original_actor');
  }
  for (let index = 0; index < row.lines.length; index++) {
    const line = row.lines[index], actual = await C.consignmentEconomyListing(c, line.consignmentId, line.sourceHash);
    if (stable(listingSource(actual)) !== stable(line) || (index < scope.index ? actual.status !== 'sold'
      : index > scope.index ? actual.status !== 'active' : !['active', 'sold'].includes(actual.status))) fail('listing_changed');
    if (index < scope.index) {
      const witness = await C.consignmentEconomySaleWitness(c, line.consignmentId);
      if (stable(witness) !== stable(scope.completed[index])) fail('completed_line_changed');
    }
  }
  return row;
}
/** Verification only. The fixed-purpose four-original context is never returned by a public action. */
export async function assertShoppingBasketPurchaseScope(c, token, consignmentId, sourceHash, buyerAccount) {
  I.assertItemTransaction(c); I.assertItemTransactionHealthy(c); const scope = token && purchaseScopes.get(token);
  if (!scope?.active || scope.client !== c || scope.transaction !== I.itemTransactionIdentity(c) || scope.buyerAccount !== buyerAccount
    || scope.lines[scope.index]?.consignmentId !== consignmentId || scope.lines[scope.index]?.sourceHash !== sourceHash) fail('purchase_scope');
  await scopeSource(c, scope); return Object.freeze({ basketId: scope.basketId, lineIndex: scope.index });
}
function matches(row, index, witness) {
  const line = row.lines[index];
  if (witness.consignmentId !== line.consignmentId || witness.sourceHash !== line.sourceHash || witness.itemId !== line.itemId
    || witness.grossPrice !== line.grossPrice || witness.buyerPaid !== line.grossPrice || witness.hostFee !== line.hostFee
    || witness.sellerPaid !== line.grossPrice - line.hostFee || stable(witness.seller) !== stable(line.seller)
    || stable(witness.host) !== stable(line.host) || stable(witness.buyer) !== stable({ accountId: row.buyer_account, characterId: row.buyer_character })
    || witness.receipt?.loyalty || +new Date(witness.observedAt) < +new Date(row.observed_at)) fail('sale_witness');
}
async function perform(c, account, t, run) {
  const hint = check((await c.query('SELECT * FROM shopping_baskets WHERE id=$1', [t.basketId])).rows[0]);
  if (hint.source_hash !== t.sourceHash || hint.buyer_account !== account) fail('buyer');
  const originals = t.action === 'cancel' ? await C.lockConsignmentParties(c, [hint.buyer_character])
    : await lockOriginals(c, hint.lines, account, hint.buyer_character);
  const row = check((await c.query('SELECT * FROM shopping_baskets WHERE id=$1 FOR UPDATE', [hint.id])).rows[0]);
  if (stable(source(row)) !== stable(source(hint)) || row.source_hash !== t.sourceHash || row.status !== 'quoted') fail('closed');
  if (await current(c, account) !== row.buyer_character || originals.find(actor => actor.id === row.buyer_character)?.account_id !== account) fail('original_actor');
  await authoredQuote(c, row);
  if (t.action === 'cancel') {
    I.registerItemTransactionUndo(c, () => c.query('UPDATE shopping_baskets SET status=$2 WHERE id=$1', [row.id, row.status]));
    if ((await c.query("UPDATE shopping_baskets SET status='cancelled' WHERE id=$1 AND status='quoted'", [row.id])).rowCount !== 1) fail('basket_source');
    return { actorId: row.buyer_character, receipt: { ok: true, ...dto({ ...row, status: 'cancelled' }) } };
  }
  for (const line of row.lines) await c.query('SELECT id FROM consignments WHERE id=$1 FOR UPDATE', [line.consignmentId]);
  const currentLines = await snapshots(c, row.lines);
  if (stable(currentLines) !== stable(row.lines)) fail('listing_changed');
  if (+await clock(c) >= +new Date(row.expires_at)) fail('expired');
  const buyer = originals.find(actor => actor.id === row.buyer_character);
  if (!whole(Number(buyer.cash)) || Number(buyer.cash) < Number(row.total_cash)) fail('cash');
  const token = Object.freeze({}), scope = { active: true, client: c, transaction: I.itemTransactionIdentity(c), basketId: row.id,
    buyerAccount: account, lines: row.lines, originals, source: stable(source(row)), index: 0, completed: [] };
  purchaseScopes.set(token, scope);
  try {
    const sales = [];
    for (let index = 0; index < row.lines.length; index++) {
      scope.index = index; const line = row.lines[index];
      await assertShoppingBasketPurchaseScope(c, token, line.consignmentId, line.sourceHash, account);
      const result = await C.buyConsignmentWithBasketContext(c, account,
        { consignmentId: line.consignmentId, sourceHash: line.sourceHash, consent: true }, 'shopping-basket:' + run + ':' + index, token);
      const witness = await C.assertFreshConsignmentBasketProof(c, result.saleProof, token); matches(row, index, witness);
      if (stable(result.receipt) !== stable(witness.receipt)) fail('sale_witness');
      scope.completed.push(witness); sales.push(result.receipt);
    }
    if (new Set(scope.completed.flatMap(witness => witness.transactionIds)).size !== 6) fail('sale_journals');
    if (+await clock(c) >= +new Date(row.expires_at)) fail('expired'); I.assertItemTransactionHealthy(c);
    const receipt = { ok: true, ...dto({ ...row, status: 'completed' }), sales };
    I.registerItemTransactionUndo(c, () => c.query('UPDATE shopping_baskets SET status=$2,settlement=$3 WHERE id=$1', [row.id, row.status, row.settlement]));
    if ((await c.query("UPDATE shopping_baskets SET status='completed',settlement=$2 WHERE id=$1 AND status='quoted'", [row.id, receipt])).rowCount !== 1) fail('basket_source');
    return { actorId: row.buyer_character, receipt };
  } finally { scope.active = false; }
}
async function validatePersistedAction(c, account, t, keyHash, run, result) {
  const row = check((await c.query('SELECT * FROM shopping_baskets WHERE id=$1 FOR UPDATE', [result.receipt.basketId])).rows[0]);
  const ack = (await c.query('SELECT body_hash,run_id,receipt,account_ref,original_character,basket_ref FROM shopping_basket_requests WHERE account_id=$1 AND key_hash=$2', [account, keyHash])).rows[0];
  if (!ack || ack.body_hash !== hash(t) || ack.run_id !== run || ack.account_ref !== account || ack.original_character !== result.actorId
    || ack.basket_ref !== row.id || stable(ack.receipt) !== stable(result.receipt) || row.buyer_account !== account
    || row.buyer_character !== result.actorId || row.source_hash !== result.receipt.sourceHash) fail('receipt_source');
  await authoredQuote(c, row);
  if (t.action === 'cancel') {
    if (row.status !== 'cancelled' || await current(c, account) !== row.buyer_character
      || (await c.query('SELECT status FROM accounts WHERE id=$1', [account])).rows[0]?.status !== 'active') fail('original_actor');
    return;
  }
  // These are the same four original rows already locked before either sale.
  await lockOriginals(c, row.lines, account, row.buyer_character);
  if (t.action === 'quote') {
    if (row.status !== 'quoted' || stable(await snapshots(c, row.lines)) !== stable(row.lines)) fail('listing_changed');
  } else {
    if (row.status !== 'completed' || stable(row.settlement) !== stable(result.receipt)) fail('settlement');
    const witnesses = [];
    for (let index = 0; index < row.lines.length; index++) {
      const witness = await C.consignmentEconomySaleWitness(c, row.lines[index].consignmentId); matches(row, index, witness); witnesses.push(witness);
      const item = (await c.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [row.lines[index].itemId])).rows[0];
      if (item?.owner_scope !== 'account' || item.owner_id !== account || item.state !== 'active') fail('sale_custody');
    }
    if (new Set(witnesses.flatMap(witness => witness.transactionIds)).size !== 6
      || stable(witnesses.map(witness => witness.receipt)) !== stable(result.receipt.sales)) fail('sale_witness');
  }
  if (+await clock(c) >= +new Date(row.expires_at)) fail('expired');
  I.assertItemTransactionHealthy(c);
}
export async function shoppingBasketAction(c, account, action, body, key) {
  I.assertItemTransaction(c);
  try {
    id(account); id(key); const t = terms(action, body), bodyHash = hash(t), keyHash = hash([account, key]);
    const prior = (await c.query('SELECT body_hash,receipt FROM shopping_basket_requests WHERE account_id=$1 AND key_hash=$2', [account, keyHash])).rows[0];
    if (prior) { if (prior.body_hash !== bodyHash) fail('request_conflict'); if (!prior.receipt) fail('in_progress'); return prior.receipt; }
    hooks(); const run = crypto.randomUUID();
    I.registerItemTransactionUndo(c, () => c.query('DELETE FROM shopping_basket_requests WHERE account_id=$1 AND key_hash=$2 AND run_id=$3', [account, keyHash, run]));
    await c.query('INSERT INTO shopping_basket_requests(account_id,key_hash,body_hash,run_id,request_json) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,key_hash) DO NOTHING', [account, keyHash, bodyHash, run, t]);
    const reserved = (await c.query('SELECT body_hash,run_id,receipt FROM shopping_basket_requests WHERE account_id=$1 AND key_hash=$2 FOR UPDATE', [account, keyHash])).rows[0];
    if (reserved.body_hash !== bodyHash) fail('request_conflict'); if (reserved.receipt) return reserved.receipt; if (reserved.run_id !== run) fail('in_progress');
    const result = action === 'quote' ? await quote(c, account, t, run) : await perform(c, account, t, run);
    I.assertItemTransactionHealthy(c);
    I.registerItemTransactionUndo(c, () => c.query('UPDATE shopping_basket_requests SET receipt=NULL,account_ref=NULL,original_character=NULL,basket_ref=NULL WHERE account_id=$1 AND key_hash=$2 AND run_id=$3', [account, keyHash, run]));
    if ((await c.query('UPDATE shopping_basket_requests SET receipt=$4,account_ref=$1,original_character=$5,basket_ref=$6 WHERE account_id=$1 AND key_hash=$2 AND run_id=$3 AND receipt IS NULL', [account, keyHash, run, result.receipt, result.actorId, result.receipt.basketId])).rowCount !== 1) fail('receipt');
    await validatePersistedAction(c, account, t, keyHash, run, result);
    return result.receipt;
  } catch (error) { I.poisonItemTransaction(c, error); throw error; }
}
export async function shoppingBasketBoard(c, account) {
  id(account); const rows = (await c.query('SELECT * FROM shopping_baskets WHERE buyer_account=$1 ORDER BY observed_at DESC,id DESC LIMIT 25', [account])).rows;
  return { baskets: rows.map(dto) };
}
export async function collectShoppingBasketIssues(c) {
  const issues = [], rows = (await c.query('SELECT * FROM shopping_baskets ORDER BY id')).rows;
  for (const row of rows) {
    try {
      check(row); await authoredQuote(c, row);
      if (row.status === 'completed') {
        const witnesses = [];
        for (let index = 0; index < 2; index++) { const witness = await C.consignmentEconomySaleWitness(c, row.lines[index].consignmentId); matches(row, index, witness); witnesses.push(witness); }
        if (new Set(witnesses.flatMap(w => w.transactionIds)).size !== 6 || stable(row.settlement) !== stable({ ok: true, ...dto(row), sales: witnesses.map(w => w.receipt) })) fail('settlement');
        const requests = (await c.query("SELECT account_id,original_character,body_hash,request_json,receipt FROM shopping_basket_requests WHERE basket_ref=$1 AND request_json->>'action'='checkout' ORDER BY run_id LIMIT 2", [row.id])).rows;
        const expected = { action: 'checkout', basketId: row.id, sourceHash: row.source_hash, consent: true };
        if (requests.length !== 1 || requests[0].account_id !== row.buyer_account || requests[0].original_character !== row.buyer_character
          || requests[0].body_hash !== hash(expected) || stable(requests[0].request_json) !== stable(expected) || stable(requests[0].receipt) !== stable(row.settlement)) fail('checkout_receipt');
      }
    } catch (error) { if (!(error instanceof GameError)) throw error; issues.push({ id: row.id, reason: error.message }); }
  }
  const requests = (await c.query('SELECT * FROM shopping_basket_requests ORDER BY account_id,key_hash')).rows;
  for (const request of requests) {
    try {
      const body = request.request_json, normalized = terms(body?.action, Object.fromEntries(Object.entries(body || {}).filter(([key]) => key !== 'action')));
      const row = rows.find(value => value.id === request.basket_ref);
      if (!row || stable(normalized) !== stable(body) || request.body_hash !== hash(normalized) || request.account_id !== row.buyer_account
        || request.account_ref !== request.account_id || request.original_character !== row.buyer_character || !request.receipt) fail('request_binding');
      if (body.action === 'quote' && (request.run_id !== row.id || stable(request.receipt) !== stable({ ok: true, ...dto({ ...row, status: 'quoted' }) }))) fail('request_binding');
      if (body.action !== 'quote' && (body.basketId !== row.id || body.sourceHash !== row.source_hash)) fail('request_binding');
      if (body.action === 'checkout' && (row.status !== 'completed' || stable(request.receipt) !== stable(row.settlement))) fail('request_binding');
      if (body.action === 'cancel' && (row.status !== 'cancelled' || stable(request.receipt) !== stable({ ok: true, ...dto(row) }))) fail('request_binding');
    } catch (error) { if (!(error instanceof GameError)) throw error; issues.push({ id: request.run_id, reason: error.message }); }
  }
  return issues;
}
