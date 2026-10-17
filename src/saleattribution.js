import crypto from 'node:crypto';
import { GameError, ledger } from './game.js';
import * as Consignments from './consignments.js';
import { assertItemTransaction, assertItemTransactionHealthy, itemTransactionIdentity,
  poisonItemTransaction, registerItemTransactionUndo } from './items.js';

export const SALE_ATTRIBUTION = Object.freeze({ merchantLimit: 3, buyerLimit: 3, maximumCommission: 1000000 });
const fail = reason => { throw new GameError('sale_attribution', reason); };
const id = value => { if (typeof value !== 'string' || !/^[!-~]{1,128}$/.test(value)) fail('identity'); return value; };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const whole = (value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const stable = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : entry);
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const clock = async c => new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const pending = row => ['offered', 'active'].includes(row.state);
const purchaseScopes = new WeakMap();

function terms(action, body) {
  if (action === 'open') {
    if (!exact(body, ['consignmentId', 'sourceHash', 'publisherAccountId', 'commissionCash', 'lifetimeSeconds', 'consent'])
      || body.consent !== true || !digest(body.sourceHash) || !whole(body.commissionCash, 1, SALE_ATTRIBUTION.maximumCommission)
      || !whole(body.lifetimeSeconds, 60, 86400)) fail('terms');
    return { action, consignmentId: id(body.consignmentId), sourceHash: body.sourceHash,
      publisherAccountId: id(body.publisherAccountId), commissionCash: body.commissionCash,
      lifetimeSeconds: body.lifetimeSeconds, consent: true };
  }
  const identity = action === 'buy' ? 'attributionId' : 'campaignId';
  if (!['accept', 'attribute', 'buy', 'cancel', 'expire'].includes(action)
    || !exact(body, [identity, 'sourceHash', 'consent']) || body.consent !== true || !digest(body.sourceHash)) fail('terms');
  return { action, [identity]: id(body[identity]), sourceHash: body.sourceHash, consent: true };
}
function admission() {
  // These must be genuine canonical N01 leaves, never caller supplied adapters.
  for (const name of ['consignmentEconomyListing', 'buyConsignmentWithEconomyContext', 'assertFreshConsignmentSaleProof']) {
    if (typeof Consignments[name] !== 'function') fail('admission_unavailable');
  }
}
function campaignSource(row) {
  return { id: row.id, consignmentId: row.consignment_id, consignmentHash: row.consignment_hash, itemId: row.item_id,
    merchantAccount: row.merchant_account, merchantCharacter: row.merchant_character,
    hostAccount: row.host_account, hostCharacter: row.host_character,
    publisherAccount: row.publisher_account, publisherCharacter: row.publisher_character,
    commissionCash: Number(row.commission_cash), expiresAt: new Date(row.expires_at).toISOString() };
}
function attributionSource(row) {
  return { id: row.id, campaignId: row.campaign_id, campaignHash: row.campaign_hash,
    buyerAccount: row.buyer_account, buyerCharacter: row.buyer_character, createdAt: new Date(row.created_at).toISOString() };
}
const campaignDto = row => ({ campaignId: row.id, sourceHash: row.source_hash, consignmentId: row.consignment_id,
  consignmentHash: row.consignment_hash, commissionCash: Number(row.commission_cash),
  expiresAt: new Date(row.expires_at).toISOString(), state: row.state });
const attributionDto = row => ({ attributionId: row.id, sourceHash: row.source_hash,
  campaignId: row.campaign_id, campaignHash: row.campaign_hash, createdAt: new Date(row.created_at).toISOString() });
async function current(c, account) {
  const rows = (await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [account])).rows;
  if (rows.length !== 1) fail('original_actor'); return rows[0].id;
}
async function actors(c, ids, returning = false) {
  // Only private action code supplies these fixed, source-resolved roots. This grants no G/R scope.
  const keys = [...new Set(ids.map(id))].sort();
  if (keys.length !== ids.length || keys.length < 1 || keys.length > 4) fail('self');
  const rows = [];
  for (const key of keys) {
    const row = (await c.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [key])).rows[0];
    if (!row || !row.alive || row.is_npc) fail('original_actor'); rows.push(row);
  }
  if (new Set(rows.map(row => row.account_id)).size !== keys.length) fail('self');
  for (const account of rows.map(row => row.account_id).sort()) {
    const status = (await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE', [account])).rows[0]?.status;
    if (!status || (!returning && status !== 'active')) fail('account');
  }
  for (const row of rows) if (await current(c, row.account_id) !== row.id) fail('original_actor');
  return rows;
}
async function campaign(c, campaignId, sourceHash) {
  const row = (await c.query('SELECT * FROM sale_attribution_campaigns WHERE id=$1 FOR UPDATE', [campaignId])).rows[0];
  if (!row || row.source_hash !== sourceHash || hash(campaignSource(row)) !== row.source_hash) fail('source'); return row;
}
async function cash(c, actor, amount, reason, campaignId) {
  const before = Number(actor.cash);
  if (!actor.alive || !whole(before) || !whole(before + amount)) fail('cash');
  registerItemTransactionUndo(c, () => c.query('UPDATE characters SET cash=$2 WHERE id=$1', [actor.id, before]));
  if ((await c.query('UPDATE characters SET cash=cash+$2 WHERE id=$1 AND alive=true AND cash+$2>=0', [actor.id, amount])).rowCount !== 1) fail('cash');
  const journal = await ledger(c, { characterId: actor.id, accountId: actor.account_id, currency: 'cash', amount, reason, counterparty: campaignId },
    { beforeInsert: tx => registerItemTransactionUndo(c, () => c.query('DELETE FROM transactions WHERE id=$1', [tx])) });
  actor.cash = before + amount; return journal;
}
async function backing(c, row) {
  const journals = (await c.query("SELECT id,character_id,account_id,currency,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('sale_attribution:reserve','sale_attribution:commission','sale_attribution:refund') ORDER BY id", [row.id])).rows;
  if (!pending(row) || Number(row.escrow_cash) !== Number(row.commission_cash) || Number(row.paid_cash) !== 0
    || Number(row.refunded_cash) !== 0 || journals.length !== 1 || journals[0].id !== row.reserve_journal
    || journals[0].character_id !== row.merchant_character || journals[0].account_id !== row.merchant_account
    || journals[0].currency !== 'cash' || journals[0].reason !== 'sale_attribution:reserve'
    || Number(journals[0].amount) !== -Number(row.commission_cash)) fail('reserve_source');
}
async function publisherConsent(c, row) {
  const requests = (await c.query("SELECT account_id,account_ref,original_character,body_hash,request_json,receipt FROM sale_attribution_requests WHERE campaign_ref=$1 AND original_character=$2 AND request_json->>'action'='accept' ORDER BY run_id LIMIT 2", [row.id, row.publisher_character])).rows;
  const expected = { action: 'accept', campaignId: row.id, sourceHash: row.source_hash, consent: true };
  if (!row.accepted_at || requests.length !== 1 || requests[0].account_id !== row.publisher_account
    || requests[0].account_ref !== row.publisher_account || requests[0].body_hash !== hash(expected)
    || stable(requests[0].request_json) !== stable(expected)
    || stable(requests[0].receipt) !== stable({ ok: true, ...campaignDto({ ...row, state: 'active' }) })) fail('publisher_consent');
}
async function attributionReceipt(c, row) {
  const request = (await c.query('SELECT account_id,account_ref,original_character,campaign_ref,body_hash,request_json,receipt FROM sale_attribution_requests WHERE run_id=$1', [row.id])).rows[0];
  const expected = { action: 'attribute', campaignId: row.campaign_id, sourceHash: row.campaign_hash, consent: true };
  if (!request || request.account_id !== row.buyer_account || request.account_ref !== row.buyer_account
    || request.original_character !== row.buyer_character || request.campaign_ref !== row.campaign_id
    || request.body_hash !== hash(expected) || stable(request.request_json) !== stable(expected)
    || stable(request.receipt) !== stable({ ok: true, ...attributionDto(row) })) fail('attribution_receipt');
}
async function change(c, row, state, { paid = 0, refunded = 0, settlement = null } = {}) {
  registerItemTransactionUndo(c, () => c.query('UPDATE sale_attribution_campaigns SET state=$2,escrow_cash=$3,paid_cash=$4,refunded_cash=$5,accepted_at=$6,settlement=$7 WHERE id=$1',
    [row.id, row.state, row.escrow_cash, row.paid_cash, row.refunded_cash, row.accepted_at, row.settlement]));
  if ((await c.query('UPDATE sale_attribution_campaigns SET state=$2,escrow_cash=$3,paid_cash=$4,refunded_cash=$5,settlement=$6 WHERE id=$1 AND state=$7',
    [row.id, state, ['offered', 'active'].includes(state) ? row.escrow_cash : 0, paid, refunded, settlement, row.state])).rowCount !== 1) fail('source_changed');
}
async function refund(c, row, merchant, state) {
  await backing(c, row); const amount = Number(row.escrow_cash);
  const journal = await cash(c, merchant, amount, 'sale_attribution:refund', row.id);
  const receipt = { ok: true, ...campaignDto({ ...row, state }), refundedCash: amount, refundJournal: journal };
  await change(c, row, state, { refunded: amount, settlement: receipt }); return receipt;
}
function sameListing(row, listing) {
  if (listing.consignmentId !== row.consignment_id || listing.sourceHash !== row.consignment_hash || listing.itemId !== row.item_id
    || listing.seller.accountId !== row.merchant_account || listing.seller.characterId !== row.merchant_character
    || listing.host.accountId !== row.host_account || listing.host.characterId !== row.host_character) fail('sale_source');
}
async function open(c, account, t, run) {
  const hint = await Consignments.consignmentEconomyListing(c, t.consignmentId, t.sourceHash);
  const publisherId = await current(c, t.publisherAccountId);
  const locked = await actors(c, [hint.seller.characterId, hint.host.characterId, publisherId]);
  const listing = await Consignments.consignmentEconomyListing(c, t.consignmentId, t.sourceHash);
  if (stable(hint) !== stable(listing) || listing.seller.accountId !== account || listing.status !== 'active') fail('merchant');
  const merchant = locked.find(row => row.id === listing.seller.characterId);
  if (merchant?.account_id !== account || locked.find(row => row.id === listing.host.characterId)?.account_id !== listing.host.accountId) fail('original_actor');
  if (locked.find(row => row.id === publisherId)?.account_id !== t.publisherAccountId) fail('original_actor');
  if (t.commissionCash > listing.grossPrice - listing.hostFee) fail('commission');
  // Pending offers occupy only the consenting merchant's own funded slots.
  if ((await c.query("SELECT id FROM sale_attribution_campaigns WHERE merchant_character=$1 AND state IN ('offered','active') ORDER BY id LIMIT 4", [merchant.id])).rows.length >= 3) fail('merchant_limit');
  if ((await c.query('SELECT id FROM sale_attribution_campaigns WHERE consignment_id=$1 LIMIT 1', [t.consignmentId])).rows.length
    || (await c.query("SELECT id FROM sale_attribution_campaigns WHERE item_id=$1 AND state='paid' LIMIT 1", [listing.itemId])).rows.length) fail('already_advertised');
  const observed = await clock(c), expiry = new Date(Math.min(+observed + t.lifetimeSeconds * 1000, +new Date(listing.expiresAt)));
  if (+expiry <= +observed) fail('expired');
  const row = { id: run, consignment_id: listing.consignmentId, consignment_hash: listing.sourceHash, item_id: listing.itemId,
    merchant_account: account, merchant_character: merchant.id, host_account: listing.host.accountId, host_character: listing.host.characterId,
    publisher_account: t.publisherAccountId, publisher_character: publisherId, commission_cash: t.commissionCash,
    escrow_cash: t.commissionCash, state: 'offered', expires_at: expiry };
  row.source_hash = hash(campaignSource(row));
  const reserve = await cash(c, merchant, -t.commissionCash, 'sale_attribution:reserve', run);
  registerItemTransactionUndo(c, () => c.query('DELETE FROM sale_attribution_campaigns WHERE id=$1', [run]));
  await c.query("INSERT INTO sale_attribution_campaigns(id,consignment_id,consignment_hash,item_id,merchant_account,merchant_character,host_account,host_character,publisher_account,publisher_character,commission_cash,escrow_cash,expires_at,source_hash,reserve_journal,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14,'offered')",
    [run, row.consignment_id, row.consignment_hash, row.item_id, account, merchant.id, row.host_account, row.host_character,
      row.publisher_account, publisherId, t.commissionCash, expiry, row.source_hash, reserve]);
  if (+await clock(c) >= +expiry) fail('expired');
  return { actorId: merchant.id, receipt: { ok: true, ...campaignDto(row), reserveJournal: reserve } };
}
async function campaignAction(c, account, t, run) {
  const hint = (await c.query('SELECT merchant_character,publisher_character FROM sale_attribution_campaigns WHERE id=$1', [t.campaignId])).rows[0];
  if (!hint) fail('source');
  const callerId = await current(c, account);
  // Refund locks only the merchant who owns the reserve: no publisher custody or earned liability exists.
  const returning = ['cancel', 'expire'].includes(t.action);
  const ids = returning ? [hint.merchant_character] : t.action === 'attribute'
    ? [hint.merchant_character, hint.publisher_character, callerId] : [hint.merchant_character, hint.publisher_character];
  const locked = await actors(c, ids, returning), row = await campaign(c, t.campaignId, t.sourceHash);
  if (row.merchant_character !== hint.merchant_character || row.publisher_character !== hint.publisher_character) fail('source_changed');
  const caller = locked.find(actor => actor.id === callerId && actor.account_id === account);
  if (!caller) fail('original_actor');
  if (!pending(row)) fail('closed'); await backing(c, row);
  if (returning) {
    if (caller.id !== row.merchant_character || account !== row.merchant_account) fail('merchant');
    if (t.action === 'expire' && +await clock(c) < +new Date(row.expires_at)) fail('not_expired');
    return { actorId: caller.id, receipt: await refund(c, row, caller, t.action === 'expire' ? 'expired' : 'cancelled') };
  }
  const listing = await Consignments.consignmentEconomyListing(c, row.consignment_id, row.consignment_hash); sameListing(row, listing);
  if (listing.status !== 'active' || +await clock(c) >= +new Date(row.expires_at)) fail('expired');
  if (t.action === 'accept') {
    if (caller.id !== row.publisher_character || account !== row.publisher_account || row.state !== 'offered') fail('publisher');
    registerItemTransactionUndo(c, () => c.query('UPDATE sale_attribution_campaigns SET state=$2,accepted_at=$3 WHERE id=$1', [row.id, row.state, row.accepted_at]));
    if ((await c.query("UPDATE sale_attribution_campaigns SET state='active',accepted_at=clock_timestamp() WHERE id=$1 AND state='offered'", [row.id])).rowCount !== 1) fail('source_changed');
    if (+await clock(c) >= +new Date(row.expires_at)) fail('expired');
    return { actorId: caller.id, receipt: { ok: true, ...campaignDto({ ...row, state: 'active' }) } };
  }
  if (row.state !== 'active' || !row.accepted_at || [row.merchant_account, row.host_account, row.publisher_account].includes(account)) fail('buyer');
  await publisherConsent(c, row);
  if ((await c.query('SELECT id FROM sale_attributions WHERE campaign_id=$1 AND buyer_account=$2 LIMIT 1', [row.id, account])).rows.length) fail('immutable_attribution');
  if ((await c.query("SELECT a.id FROM sale_attributions a JOIN sale_attribution_campaigns p ON p.id=a.campaign_id WHERE a.buyer_character=$1 AND p.state='active' AND p.expires_at>clock_timestamp() ORDER BY a.id LIMIT 4", [caller.id])).rows.length >= 3) fail('buyer_limit');
  const attribution = { id: run, campaign_id: row.id, campaign_hash: row.source_hash, buyer_account: account,
    buyer_character: caller.id, created_at: await clock(c) };
  attribution.source_hash = hash(attributionSource(attribution));
  registerItemTransactionUndo(c, () => c.query('DELETE FROM sale_attributions WHERE id=$1', [run]));
  await c.query('INSERT INTO sale_attributions(id,campaign_id,campaign_hash,buyer_account,buyer_character,created_at,source_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [run, row.id, row.source_hash, account, caller.id, attribution.created_at, attribution.source_hash]);
  if (+await clock(c) >= +new Date(row.expires_at)) fail('expired');
  return { actorId: caller.id, receipt: { ok: true, ...attributionDto(attribution) } };
}
async function purchaseSource(c, attributionId, sourceHash) {
  const attribution = (await c.query('SELECT * FROM sale_attributions WHERE id=$1', [attributionId])).rows[0];
  if (!attribution || attribution.source_hash !== sourceHash || hash(attributionSource(attribution)) !== sourceHash) fail('attribution_source');
  const row = (await c.query('SELECT * FROM sale_attribution_campaigns WHERE id=$1', [attribution.campaign_id])).rows[0];
  if (!row || attribution.campaign_hash !== row.source_hash || hash(campaignSource(row)) !== row.source_hash) fail('source');
  await publisherConsent(c, row); await attributionReceipt(c, attribution);
  return { row, attribution };
}
/** Only N01 can verify the opaque context. No ids array, callback or capability can create one. */
export async function assertSaleAttributionPurchaseScope(c, token, consignmentId, sourceHash, buyerAccount) {
  assertItemTransaction(c); const scope = purchaseScopes.get(token);
  if (!scope?.active || scope.c !== c || scope.transaction !== itemTransactionIdentity(c)
    || scope.consignmentId !== consignmentId || scope.consignmentHash !== sourceHash || scope.buyerAccount !== buyerAccount) fail('purchase_scope');
  const currentSource = await purchaseSource(c, scope.attributionId, scope.attributionHash);
  if (stable(currentSource) !== scope.source || currentSource.row.state !== 'active') fail('purchase_scope_changed');
  for (const actor of scope.actors) {
    const row = (await c.query('SELECT account_id,alive,is_npc FROM characters WHERE id=$1', [actor.id])).rows[0];
    if (!row?.alive || row.is_npc || row.account_id !== actor.account_id || await current(c, actor.account_id) !== actor.id
      || (await c.query('SELECT status FROM accounts WHERE id=$1', [actor.account_id])).rows[0]?.status !== 'active') fail('original_actor');
  }
  if (+await clock(c) >= +new Date(currentSource.row.expires_at)) fail('expired');
  return Object.freeze({ campaignId: scope.campaignId, buyerCharacter: scope.buyerCharacter });
}
async function buy(c, account, t, run) {
  const hint = await purchaseSource(c, t.attributionId, t.sourceHash), p = hint.row, a = hint.attribution;
  if (a.buyer_account !== account) fail('buyer');
  const locked = await actors(c, [p.merchant_character, p.host_character, p.publisher_character, a.buyer_character]);
  const row = await campaign(c, p.id, p.source_hash);
  const attribution = (await c.query('SELECT * FROM sale_attributions WHERE id=$1 FOR UPDATE', [a.id])).rows[0];
  if (stable({ row, attribution }) !== stable(hint)) fail('source_changed');
  if (row.state !== 'active' || !row.accepted_at || +new Date(row.accepted_at) > +new Date(attribution.created_at)) fail('publisher');
  const merchant = locked.find(actor => actor.id === row.merchant_character), publisher = locked.find(actor => actor.id === row.publisher_character);
  if (merchant.account_id !== row.merchant_account || publisher.account_id !== row.publisher_account
    || locked.find(actor => actor.id === row.host_character)?.account_id !== row.host_account
    || locked.find(actor => actor.id === a.buyer_character)?.account_id !== account) fail('original_actor');
  await backing(c, row);
  const listing = await Consignments.consignmentEconomyListing(c, row.consignment_id, row.consignment_hash); sameListing(row, listing);
  if (listing.status !== 'active' || +await clock(c) >= +new Date(row.expires_at)) fail('expired');
  if ((await c.query("SELECT id FROM sale_attribution_campaigns WHERE item_id=$1 AND state='paid' LIMIT 1", [row.item_id])).rows.length) fail('already_paid');
  const eventSession=eventPurchaseSessions.get(itemTransactionIdentity(c));let eventIssuer=null,eventToken=null,eventBuyerCash=null;
  if(eventSession){const d=eventSession.descriptor;if(d.account!==account||d.attributionId!==attribution.id||d.attributionHash!==attribution.source_hash||d.campaignId!==row.id||d.campaignHash!==row.source_hash)fail('event_source');eventIssuer=Object.freeze({});const root={account,input:d.input,key:d.key,buyer:locked.find(a=>a.id===attribution.buyer_character),merchant,publisher,host:locked.find(a=>a.id===row.host_character),attributionId:attribution.id,attributionHash:attribution.source_hash,campaignId:row.id,campaignHash:row.source_hash};eventPurchaseRoots.set(eventIssuer,{active:true,c,transaction:itemTransactionIdentity(c),root,token:null});eventSession.issuer=eventIssuer;eventToken=await(await Events()).beginEventAttributionCompletion(c,eventIssuer);eventPurchaseRoots.get(eventIssuer).token=eventToken;eventBuyerCash=Number(root.buyer.cash);}
  await(await Events()).assertEventMarketIngress(c,account,'uid',attribution.id,eventToken);
  const token = Object.freeze({}), scope = { active: true, c, transaction: itemTransactionIdentity(c), source: stable({ row, attribution }),
    campaignId: row.id, attributionId: attribution.id, attributionHash: attribution.source_hash, consignmentId: row.consignment_id,
    consignmentHash: row.consignment_hash, buyerAccount: account, buyerCharacter: attribution.buyer_character, actors: locked };
  purchaseScopes.set(token, scope);
  try {
    await assertSaleAttributionPurchaseScope(c, token, row.consignment_id, row.consignment_hash, account);
    const result = await Consignments.buyConsignmentWithEconomyContext(c, account,
      { consignmentId: row.consignment_id, sourceHash: row.consignment_hash, consent: true }, 'sale-attribution:' + run, { attributionContext: token });
    const witness = await Consignments.assertFreshConsignmentSaleProof(c, result.saleProof, { attributionContext: token });
    if (witness.consignmentId !== row.consignment_id || witness.sourceHash !== row.consignment_hash || witness.itemId !== row.item_id
      || witness.seller.accountId !== row.merchant_account || witness.seller.characterId !== row.merchant_character
      || witness.host.accountId !== row.host_account || witness.host.characterId !== row.host_character
      || witness.buyer.accountId !== account || witness.buyer.characterId !== attribution.buyer_character
      || !whole(witness.sellerPaid, Number(row.commission_cash)) || +new Date(witness.observedAt) < +new Date(attribution.created_at)) fail('sale_proof');
    assertItemTransactionHealthy(c);
    const journal = await cash(c, publisher, Number(row.escrow_cash), 'sale_attribution:commission', row.id);
    if (+await clock(c) >= +new Date(row.expires_at)) fail('expired');
    const receipt = { ok: true, ...campaignDto({ ...row, state: 'paid' }), attributionId: attribution.id,
      commissionCash: Number(row.escrow_cash), commissionJournal: journal, sale: result.receipt };
    await change(c, row, 'paid', { paid: Number(row.escrow_cash), settlement: receipt });
    if(eventIssuer)eventFreshSales.set(eventIssuer,{c,transaction:itemTransactionIdentity(c),token:eventToken,used:false,buyerCashBefore:eventBuyerCash,witness:stable(witness),receipt:stable(receipt)});
    return { actorId: attribution.buyer_character, receipt };
  } finally { scope.active = false; }
}
export async function saleAttributionAction(c, account, action, body, key) {
  assertItemTransaction(c);
  try {
    id(account); id(key); const t = terms(action, body), bodyHash = hash(t), keyHash = hash([account, key]);
    const prior = (await c.query('SELECT body_hash,receipt FROM sale_attribution_requests WHERE account_id=$1 AND key_hash=$2', [account, keyHash])).rows[0];
    if (prior) { if (prior.body_hash !== bodyHash) fail('request_conflict'); if (!prior.receipt) fail('in_progress'); return prior.receipt; }
    admission(); const run = crypto.randomUUID();
    registerItemTransactionUndo(c, () => c.query('DELETE FROM sale_attribution_requests WHERE account_id=$1 AND key_hash=$2 AND run_id=$3', [account, keyHash, run]));
    await c.query('INSERT INTO sale_attribution_requests(account_id,key_hash,body_hash,run_id,request_json) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,key_hash) DO NOTHING', [account, keyHash, bodyHash, run, t]);
    const request = (await c.query('SELECT body_hash,run_id,receipt FROM sale_attribution_requests WHERE account_id=$1 AND key_hash=$2 FOR UPDATE', [account, keyHash])).rows[0];
    if (request.body_hash !== bodyHash) fail('request_conflict'); if (request.receipt) return request.receipt; if (request.run_id !== run) fail('in_progress');
    const result = action === 'open' ? await open(c, account, t, run) : action === 'buy'
      ? await buy(c, account, t, run) : await campaignAction(c, account, t, run);
    assertItemTransactionHealthy(c);
    registerItemTransactionUndo(c, () => c.query('UPDATE sale_attribution_requests SET receipt=NULL,account_ref=NULL,original_character=NULL,campaign_ref=NULL WHERE account_id=$1 AND key_hash=$2 AND run_id=$3', [account, keyHash, run]));
    if ((await c.query('UPDATE sale_attribution_requests SET receipt=$4,account_ref=$1,original_character=$5,campaign_ref=$6 WHERE account_id=$1 AND key_hash=$2 AND run_id=$3 AND receipt IS NULL',
      [account, keyHash, run, result.receipt, result.actorId, result.receipt.campaignId])).rowCount !== 1) fail('receipt');
    return result.receipt;
  } catch (error) { poisonItemTransaction(c, error); throw error; }
}
export async function saleAttributionBoard(c, account, after = '') {
  id(account); if (after !== '') id(after);
  const rows = (await c.query("SELECT * FROM sale_attribution_campaigns WHERE id>$1 AND (state='active' OR merchant_account=$2 OR publisher_account=$2) ORDER BY id LIMIT 25", [after, account])).rows;
  const observed = await clock(c), projected = [];
  for (const row of rows) {
    let available = row.state === 'active' && +new Date(row.expires_at) > +observed && hash(campaignSource(row)) === row.source_hash;
    if (available) {
      const listing = (await c.query('SELECT status,source_hash FROM consignments WHERE id=$1', [row.consignment_id])).rows[0];
      available = listing?.status === 'active' && listing.source_hash === row.consignment_hash;
      for (const [character, owner] of [[row.merchant_character, row.merchant_account], [row.host_character, row.host_account], [row.publisher_character, row.publisher_account]]) {
        const actor = (await c.query('SELECT alive,is_npc,account_id FROM characters WHERE id=$1', [character])).rows[0];
        if (!actor?.alive || actor.is_npc || actor.account_id !== owner
          || (await c.query('SELECT status FROM accounts WHERE id=$1', [owner])).rows[0]?.status !== 'active') available = false;
      }
    }
    projected.push({ ...campaignDto(row), available, ...(row.merchant_account === account ? { reservedCash: Number(row.escrow_cash) } : {}) });
  }
  return { observedAt: observed.toISOString(), rows: projected, next: rows.length === 25 ? rows.at(-1).id : null };
}
export async function recoverSaleAttributionAtEstateStart(c, characterId, rentalScope, estateScope) {
  assertItemTransaction(c);
  try {
    const { assertEstateResolutionScope } = await import('./social/estate.js');
    const { assertEquipmentRentalDeathScope } = await import('./equipmentrentals.js');
    const estate = await assertEstateResolutionScope(c, characterId, estateScope);
    const locked = await assertEquipmentRentalDeathScope(c, characterId, rentalScope);
    if (!locked.ids.has(characterId)) fail('death_scope');
    const merchant = (await c.query('SELECT * FROM characters WHERE id=$1', [id(characterId)])).rows[0];
    if (!merchant?.alive || merchant.account_id !== estate.accountId) fail('death_scope');
    const rows = (await c.query("SELECT * FROM sale_attribution_campaigns WHERE merchant_character=$1 AND state IN ('offered','active') ORDER BY id LIMIT 4 FOR UPDATE", [characterId])).rows;
    if (rows.length > 3) fail('merchant_limit'); const results = [];
    for (const row of rows) {
      if (row.merchant_account !== estate.accountId || hash(campaignSource(row)) !== row.source_hash) fail('death_source');
      const receipt = await refund(c, row, merchant, 'party_dead');
      results.push({ merchantCharacter: characterId, refundedCash: receipt.refundedCash });
    }
    return results;
  } catch (error) { poisonItemTransaction(c, error); throw error; }
}
export const saleAttributionEscrowQuery = 'SELECT COALESCE(SUM(escrow_cash),0) AS cash FROM sale_attribution_campaigns';
export async function collectSaleAttributionIssues(c) {
  const issues = [], rows = (await c.query('SELECT * FROM sale_attribution_campaigns ORDER BY id')).rows;
  for (const row of rows) {
    if (hash(campaignSource(row)) !== row.source_hash) issues.push({ id: row.id, reason: 'source_hash' });
    if (row.accepted_at) { try { await publisherConsent(c, row); } catch (error) { if (error.code !== 'sale_attribution') throw error; issues.push({ id: row.id, reason: 'publisher_consent' }); } }
    const escrow = Number(row.escrow_cash), paid = Number(row.paid_cash), refunded = Number(row.refunded_cash), amount = Number(row.commission_cash);
    if (![escrow, paid, refunded, amount].every(value => whole(value)) || escrow + paid + refunded !== amount
      || (pending(row) ? escrow !== amount : escrow !== 0)) issues.push({ id: row.id, reason: 'reserve_conservation' });
    const legs = (await c.query("SELECT id,character_id,account_id,currency,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('sale_attribution:reserve','sale_attribution:commission','sale_attribution:refund') ORDER BY reason", [row.id])).rows;
    const expected = [{ id: row.reserve_journal, character: row.merchant_character, account: row.merchant_account, amount: -amount, reason: 'sale_attribution:reserve' }];
    if (row.state === 'paid') expected.push({ id: row.settlement?.commissionJournal, character: row.publisher_character, account: row.publisher_account, amount, reason: 'sale_attribution:commission' });
    else if (!pending(row)) expected.push({ id: row.settlement?.refundJournal, character: row.merchant_character, account: row.merchant_account, amount, reason: 'sale_attribution:refund' });
    expected.sort((a, b) => a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0);
    if (legs.length !== expected.length || expected.some((leg, i) => legs[i]?.id !== leg.id || legs[i]?.character_id !== leg.character
      || legs[i]?.account_id !== leg.account || legs[i]?.currency !== 'cash' || Number(legs[i]?.amount) !== leg.amount || legs[i]?.reason !== leg.reason)) issues.push({ id: row.id, reason: 'cash_legs' });
    if (row.state === 'paid') {
      try {
        if (typeof Consignments.consignmentEconomySaleWitness !== 'function') fail('admission_unavailable');
        const sale = await Consignments.consignmentEconomySaleWitness(c, row.consignment_id);
        sameListing(row, sale);
        const attribution = (await c.query('SELECT * FROM sale_attributions WHERE id=$1', [row.settlement?.attributionId])).rows[0];
        if (!attribution || attribution.campaign_id !== row.id || attribution.campaign_hash !== row.source_hash
          || hash(attributionSource(attribution)) !== attribution.source_hash || attribution.buyer_account !== sale.buyer.accountId
          || attribution.buyer_character !== sale.buyer.characterId || !whole(sale.sellerPaid, amount)
          || stable(sale.receipt) !== stable(row.settlement.sale) || !row.accepted_at
          || +new Date(row.accepted_at) > +new Date(attribution.created_at)
          || +new Date(attribution.created_at) > +new Date(sale.observedAt)) fail('sale_source');
      } catch (error) { if (error.code !== 'sale_attribution' && error.code !== 'consignment') throw error; issues.push({ id: row.id, reason: 'qualifying_sale' }); }
    }
  }
  const attributions = (await c.query('SELECT * FROM sale_attributions ORDER BY id')).rows;
  for (const row of attributions) {
    if (hash(attributionSource(row)) !== row.source_hash) issues.push({ id: row.id, reason: 'attribution_hash' });
    try { await attributionReceipt(c, row); } catch (error) { if (error.code !== 'sale_attribution') throw error; issues.push({ id: row.id, reason: 'attribution_receipt' }); }
  }
  return issues;
}

// N19 fixed four-original purchase leaf. No arity, callback or caller-installed authority.
export const eventMarketHookRevision='event_market_v1';
const eventPurchaseSessions=new WeakMap(),eventPurchaseRoots=new WeakMap(),eventFreshSales=new WeakMap();
const Events=()=>import('./eventmarkets.js');
export async function eventMarketCampaignReference(c,campaignId,sourceHash){assertItemTransaction(c);return eventMarketCampaignHistoryReference(c,campaignId,sourceHash);}
export async function eventMarketCampaignHistoryReference(c,campaignId,sourceHash){
  const r=(await c.query('SELECT * FROM sale_attribution_campaigns WHERE id=$1',[id(campaignId)])).rows[0];if(!r||r.source_hash!==sourceHash||hash(campaignSource(r))!==sourceHash)fail('source');if(r.accepted_at)await publisherConsent(c,r);const listing=await Consignments.consignmentEconomyEventHistoryReference(c,r.consignment_id,r.consignment_hash);sameListing(r,listing);if(pending(r))await backing(c,r);else if(r.state==='paid')await Consignments.consignmentEconomySaleWitness(c,r.consignment_id);if((await collectSaleAttributionIssues(c)).some(x=>x.id===r.id))fail('event_campaign');
  return{campaignId:r.id,sourceHash:r.source_hash,consignmentId:r.consignment_id,consignmentHash:r.consignment_hash,itemId:r.item_id,merchant:{accountId:r.merchant_account,characterId:r.merchant_character},publisher:{accountId:r.publisher_account,characterId:r.publisher_character},host:{accountId:r.host_account,characterId:r.host_character},pickupDistrict:listing.pickupDistrict,expiresAt:new Date(r.expires_at).toISOString(),consignmentExpiresAt:listing.expiresAt,state:r.state};
}
export async function eventMarketAttributionReference(c,attributionId,sourceHash){const s=await purchaseSource(c,attributionId,sourceHash);return{attributionId:s.attribution.id,sourceHash:s.attribution.source_hash,campaignId:s.row.id,campaignHash:s.row.source_hash,buyer:{accountId:s.attribution.buyer_account,characterId:s.attribution.buyer_character}};}
export async function assertEventAttributionRoot(c,issuer,phase){assertItemTransaction(c);const s=eventPurchaseRoots.get(issuer);if(!['admission','current'].includes(phase)||!s?.active||s.c!==c||s.transaction!==itemTransactionIdentity(c))fail('event_root');for(const a of [s.root.buyer,s.root.merchant,s.root.publisher,s.root.host]){const row=(await c.query('SELECT account_id,alive,is_npc FROM characters WHERE id=$1',[a.id])).rows[0];if(!row?.alive||row.is_npc||row.account_id!==a.account_id||await current(c,a.account_id)!==a.id||(await c.query('SELECT status FROM accounts WHERE id=$1',[a.account_id])).rows[0]?.status!=='active')fail('original_actor');}return s.root;}
export async function eventMarketCompletedSaleWitness(c,attributionId,sourceHash){const s=await purchaseSource(c,attributionId,sourceHash);if(s.row.state!=='paid'||s.row.settlement?.attributionId!==attributionId||(await collectSaleAttributionIssues(c)).some(x=>x.id===s.row.id||x.id===attributionId))fail('event_paid_source');return Consignments.consignmentEconomySaleWitness(c,s.row.consignment_id);}
export async function consumeEventAttributionSale(c,issuer,token){assertItemTransaction(c);const s=eventFreshSales.get(issuer),root=await assertEventAttributionRoot(c,issuer,'current');if(!s||s.used||s.c!==c||s.transaction!==itemTransactionIdentity(c)||s.token!==token)fail('event_fresh_sale');await(await Events()).assertEventAttributionScope(c,token);const witness=await eventMarketCompletedSaleWitness(c,root.attributionId,root.attributionHash);if(stable(witness)!==s.witness)fail('event_fresh_sale');s.used=true;return{witness,buyerCashBefore:s.buyerCashBefore};}
export async function assertEventAttributionCompletion(c,issuer,token,receipt){const s=eventFreshSales.get(issuer),root=await assertEventAttributionRoot(c,issuer,'current');if(!s?.used||s.token!==token||stable(receipt)!==s.receipt)fail('event_completion');const q=(await c.query('SELECT receipt FROM sale_attribution_requests WHERE account_id=$1 AND key_hash=$2',[root.account,hash([root.account,'event-finish:'+root.key])])).rows[0];if(!q||stable(q.receipt)!==s.receipt||stable(await eventMarketCompletedSaleWitness(c,root.attributionId,root.attributionHash))!==s.witness)fail('event_completion');}
export async function runEventMarketPurchase(pool,account,body,key){const{withItemRead,withItemTransaction}=await import('./items.js'),E=await Events(),d=await withItemRead(pool,c=>E.eventMarketPurchaseDescriptor(c,account,body,key));if(d.prior)return d.prior;return withItemTransaction(pool,async c=>{const tx=itemTransactionIdentity(c);if(eventPurchaseSessions.has(tx))fail('event_nested');const s={descriptor:d,issuer:null};eventPurchaseSessions.set(tx,s);try{const receipt=await saleAttributionAction(c,account,'buy',{attributionId:d.attributionId,sourceHash:d.attributionHash,consent:true},'event-finish:'+key);if(!s.issuer)fail('event_fresh_sale');const r=eventPurchaseRoots.get(s.issuer);await E.completeEventAttribution(c,r.token);return await E.finalizeEventAttributionCompletion(c,r.token,receipt);}catch(e){poisonItemTransaction(c,e);throw e;}finally{eventPurchaseSessions.delete(tx);const r=s.issuer&&eventPurchaseRoots.get(s.issuer);if(r)r.active=false;}});}
