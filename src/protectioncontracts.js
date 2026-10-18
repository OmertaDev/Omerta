import crypto from 'node:crypto';
import * as G from './game.js';
import { dbCaps } from './db.js';
import { assertItemTransaction, itemTransactionIdentity, poisonItemTransaction,
  registerItemTransactionUndo, withItemRead } from './items.js';
import { PROTECTION_CONTRACTS, protectionContractTerms } from './protectioncontracts-contracts.js';

export const PROTECTION_CONTRACT_REVISION = 'funded_protection_v1';
const completions = new WeakMap();
const stable = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : entry);
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const fail = reason => { throw new G.GameError('protection_contract', reason); };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('identity'); return value; };
const clock = async c => new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const keyHash = (account, key) => {
  if (typeof key !== 'string' || !/^[!-~]{1,128}$/.test(key)) fail('identity');
  return hash(['protection-contract-request', id(account), key]);
};
function terms(action, body) {
  try { return protectionContractTerms(action, body); } catch (error) {
    if (error instanceof TypeError) fail('terms');
    throw error;
  }
}
async function current(c, account) {
  const rows = (await c.query('SELECT * FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [id(account)])).rows;
  if (rows.length !== 1 || rows[0].is_npc
    || (await c.query('SELECT status FROM accounts WHERE id=$1', [account])).rows[0]?.status !== 'active') fail('original_actor');
  return rows[0];
}
function view(row) {
  return { contractId: row.id, sourceHash: row.source_hash, campaignId: row.campaign_id,
    campaignSourceHash: row.campaign_source_hash, courierId: row.courier_id, courierSourceHash: row.courier_source_hash,
    itemId: row.item_id, leg: row.leg, state: row.state, service: PROTECTION_CONTRACTS.service,
    payerAccount: row.payer_account, payerOriginal: row.payer_character,
    protectedOriginal: row.protected_character, guardAccount: row.guard_account, guardOriginal: row.guard_character,
    priceCash: Number(row.price_cash), reservedCash: Number(row.remaining_cash), paidCash: Number(row.paid_cash),
    refundedCash: Number(row.refunded_cash), expiresAt: new Date(row.expires_at).toISOString(),
    coverageUntil: row.coverage_until ? new Date(row.coverage_until).toISOString() : null,
    closureReason: row.closure_reason, executionAuthority: false, gameCashOnly: true,
    evidence: row.state === 'activated' ? 'purchased_bodyguard_coverage' : null };
}
const mutable = ['state', 'remaining_cash', 'paid_cash', 'refunded_cash', 'release_transaction', 'refund_transaction',
  'guard_payer_journal', 'guard_payee_journal', 'coverage_until', 'coverage_proof', 'accepted_at', 'activated_at', 'closed_at', 'closure_reason'];
async function save(c, before, changes) {
  const row = { ...before, ...changes }, assignment = mutable.map((column, i) => column + '=$' + (i + 2)).join(',');
  registerItemTransactionUndo(c, () => c.query('UPDATE protection_contracts SET ' + assignment + ' WHERE id=$1',
    [before.id, ...mutable.map(column => before[column])]));
  if ((await c.query('UPDATE protection_contracts SET ' + assignment + ' WHERE id=$1 AND state=$16 AND remaining_cash=$17',
    [before.id, ...mutable.map(column => row[column]), before.state, before.remaining_cash])).rowCount !== 1) fail('source_changed');
  return row;
}
async function immutable(c, contractId, expectedHash, lock = true) {
  const row = (await c.query('SELECT * FROM protection_contracts WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [id(contractId)])).rows[0];
  if (!row || row.source_hash !== expectedHash || hash([PROTECTION_CONTRACT_REVISION, row.id, row.source_snapshot]) !== expectedHash) fail('source');
  const s = row.source_snapshot, original = terms('fund', s?.request);
  const expected = { revision: PROTECTION_CONTRACT_REVISION, service: PROTECTION_CONTRACTS.service,
    campaignId: row.campaign_id, campaignSourceHash: row.campaign_source_hash,
    courierId: row.courier_id, courierSourceHash: row.courier_source_hash, itemId: row.item_id, leg: row.leg,
    payerAccount: row.payer_account, payerCharacter: row.payer_character,
    guardAccount: row.guard_account, guardCharacter: row.guard_character, priceCash: Number(row.price_cash),
    createdAt: new Date(row.created_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(), request: original };
  if (stable(s) !== stable(expected) || row.protected_account !== row.payer_account || row.protected_character !== row.payer_character
    || row.payer_account === row.guard_account || row.payer_character === row.guard_character
    || original.campaignId !== row.campaign_id || original.campaignSourceHash !== row.campaign_source_hash
    || original.priceCash !== Number(row.price_cash)
    || +new Date(row.expires_at) > +new Date(row.created_at) + original.lifetimeSeconds * 1000) fail('source');
  return row;
}
// Both source-owned functions return only immutable references and observed
// canonical state. Neither constructs a receipt, proof, actor root or authority.
async function eligible(c, account, campaignId, campaignHash) {
  const E = await import('./commercialcampaigns.js'), Courier = await import('./multihopcourier.js');
  const campaign = await E.commercialProtectionSource(c, id(account), id(campaignId), campaignHash);
  const leg = await Courier.multiHopProtectionSource(c, campaign.courierId, campaign.courierSourceHash, account);
  if (leg.itemId !== campaign.itemId || leg.ownerAccount !== campaign.ownerAccount || leg.ownerOriginal !== campaign.ownerOriginal
    || leg.firstAccount !== campaign.firstAccount || leg.firstOriginal !== campaign.firstOriginal
    || leg.secondAccount !== campaign.secondAccount || leg.secondOriginal !== campaign.secondOriginal) fail('courier_source');
  const payer = await current(c, account), guard = await current(c, campaign.guardAccount);
  if (payer.id !== leg.protectedOriginal || guard.id !== campaign.guardOriginal || payer.id === guard.id
    || !Number.isSafeInteger(Number(guard.guard_price))) fail('original_source');
  return { campaign, leg, payer, guard };
}
async function live(c, row, checkScope = null) {
  if (+await clock(c) >= +new Date(row.expires_at)) fail('expired');
  const actual = await eligible(c, row.payer_account, row.campaign_id, row.campaign_source_hash);
  if (actual.payer.id !== row.payer_character || actual.guard.id !== row.guard_character
    || actual.guard.account_id !== row.guard_account || Number(actual.guard.guard_price) !== Number(row.price_cash)
    || actual.leg.courierId !== row.courier_id || actual.leg.courierSourceHash !== row.courier_source_hash
    || actual.leg.itemId !== row.item_id || actual.leg.leg !== row.leg
    || +new Date(row.expires_at) > +new Date(actual.leg.expiresAt)
    || +new Date(row.expires_at) > +new Date(actual.campaign.expiresAt)) fail('source_changed');
  if (checkScope) {
    const scope = await (await import('./equipmentrentals.js')).assertEquipmentRentalDeathScope(c, row.payer_character, checkScope);
    for (const original of [actual.leg.ownerOriginal, actual.leg.firstOriginal, actual.leg.secondOriginal, row.guard_character])
      if (!scope.ids.has(original)) throw new G.GameError('contention', 'Protection source changed; retry the whole action.');
  }
  return actual;
}
async function replay(c, account, action, body, key) {
  const row = (await c.query('SELECT * FROM protection_contract_requests WHERE account_id=$1 AND key_hash=$2', [account, keyHash(account, key)])).rows[0];
  if (!row) return null;
  if (row.action !== action || row.body_hash !== hash([action, body])) fail('request_conflict');
  if ((await current(c, account)).id !== row.original_character) fail('original_actor');
  return row.receipt;
}
async function remember(c, actor, action, body, key, row, sourceProof = null) {
  const receipt = { ok: true, contract: view(row) }, kh = keyHash(actor.account_id, key), bh = hash([action, body]);
  registerItemTransactionUndo(c, () => c.query('DELETE FROM protection_contract_requests WHERE account_id=$1 AND key_hash=$2', [actor.account_id, kh]));
  await c.query('INSERT INTO protection_contract_requests(account_id,key_hash,action,body_hash,original_character,contract_id,receipt,acknowledged_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [actor.account_id, kh, action, bh, actor.id, row.id, receipt, await clock(c)]);
  completions.set(receipt, { client: c, transaction: itemTransactionIdentity(c), account: actor.account_id, actor: actor.id,
    action, keyHash: kh, bodyHash: bh, contractId: row.id, sourceHash: row.source_hash, state: row.state,
    cash: Number(actor.cash), receiptHash: hash(receipt), sourceProof });
  return receipt;
}
async function cash(c, actor, amount, reason, contractId) {
  const before = Number(actor.cash);
  if (!actor.alive || !Number.isSafeInteger(before + amount) || before + amount < 0) fail('cash');
  registerItemTransactionUndo(c, () => c.query('UPDATE characters SET cash=$2 WHERE id=$1', [actor.id, before]));
  if ((await c.query('UPDATE characters SET cash=cash+$2 WHERE id=$1 AND alive=true AND cash+$2>=0', [actor.id, amount])).rowCount !== 1) fail('cash');
  const journal = await G.ledger(c, { characterId: actor.id, currency: 'cash', amount, reason, counterparty: contractId },
    { beforeInsert: key => registerItemTransactionUndo(c, () => c.query('DELETE FROM transactions WHERE id=$1', [key])) });
  actor.cash = before + amount;
  return journal;
}
async function journal(c, row, field, amount, reason) {
  const actual = (await c.query('SELECT * FROM transactions WHERE id=$1', [row[field]])).rows[0];
  if (!actual || actual.character_id !== row.payer_character || actual.account_id != null || actual.currency !== 'cash'
    || Number(actual.amount) !== amount || actual.reason !== reason || actual.counterparty !== row.id) fail('funding_source');
}
async function accounting(c, row) {
  await journal(c, row, 'reserve_transaction', -Number(row.price_cash), 'protection:reserve');
  if (row.release_transaction) await journal(c, row, 'release_transaction', Number(row.price_cash), 'protection:release');
  if (row.refund_transaction) await journal(c, row, 'refund_transaction', Number(row.price_cash), 'protection:refund');
  const entries = (await c.query("SELECT id FROM transactions WHERE counterparty=$1 AND reason IN ('protection:reserve','protection:release','protection:refund') ORDER BY id", [row.id])).rows;
  const expected = [row.reserve_transaction, row.release_transaction, row.refund_transaction].filter(Boolean).sort();
  if (stable(entries.map(value => value.id).sort()) !== stable(expected)
    || Number(row.remaining_cash) + Number(row.paid_cash) + Number(row.refunded_cash) !== Number(row.price_cash)) fail('funding_source');
}
async function acceptance(c, row) {
  const accepted = (await c.query('SELECT * FROM protection_contract_acceptances WHERE contract_id=$1', [row.id])).rows[0];
  if (!accepted || accepted.guard_account !== row.guard_account || accepted.guard_character !== row.guard_character
    || accepted.source_hash !== row.source_hash || +new Date(accepted.consented_at) !== +new Date(row.accepted_at)) fail('acceptance_source');
  const request = (await c.query('SELECT * FROM protection_contract_requests WHERE account_id=$1 AND key_hash=$2', [row.guard_account, accepted.request_key_hash])).rows[0];
  const body = { contractId: row.id, sourceHash: row.source_hash, consent: true };
  if (!request || request.action !== 'accept' || request.original_character !== row.guard_character || request.contract_id !== row.id
    || request.body_hash !== hash(['accept', body])
    || stable(request.receipt) !== stable({ ok: true, contract: view({ ...row, state: 'accepted', remaining_cash: row.price_cash,
      paid_cash: 0, refunded_cash: 0, coverage_until: null, closure_reason: null }) })) fail('acceptance_source');
}
async function block(c, row, reason) {
  return save(c, row, { state: 'blocked', closed_at: await clock(c), closure_reason: reason });
}
async function refund(c, row, actor, state, reason) {
  if (row.payer_account !== actor.account_id || row.payer_character !== actor.id
    || !['funded', 'accepted', 'blocked'].includes(row.state) || Number(row.remaining_cash) !== Number(row.price_cash)) fail('payer_reserve');
  await accounting(c, row);
  const tx = await cash(c, actor, Number(row.remaining_cash), 'protection:refund', row.id);
  return save(c, row, { state, remaining_cash: 0, refunded_cash: Number(row.price_cash), refund_transaction: tx,
    closed_at: await clock(c), closure_reason: reason });
}
async function retireGuardSlot(c, guard) {
  const rows = (await c.query("SELECT * FROM protection_contracts WHERE guard_account=$1 AND state='accepted' ORDER BY id LIMIT 2 FOR UPDATE", [guard.account_id])).rows;
  if (rows.length > 1) fail('guard_capacity');
  if (!rows.length) return;
  const row = await immutable(c, rows[0].id, rows[0].source_hash);
  let stale = row.guard_character !== guard.id;
  if (!stale) {
    try { await live(c, row); } catch (error) {
      if (!(error instanceof G.GameError) || !['commercial_campaign', 'multi_hop_courier', 'protection_contract'].includes(error.code)) throw error;
      stale = true;
    }
  }
  if (!stale) fail('guard_capacity');
  await block(c, row, 'stale_source');
}
async function runSolo(pool, account, action, body, key) {
  const result = await G.withCharacter(pool, account, async (actor, c) => {
    try {
      const old = await replay(c, account, action, body, key);
      if (old) return old;
      if ((await current(c, account)).id !== actor.id) fail('original_actor');
      let row;
      if (action === 'fund') {
        const existing = (await c.query('SELECT id FROM protection_contracts WHERE payer_account=$1 AND remaining_cash>0 ORDER BY id LIMIT 2', [account])).rows;
        if (existing.length) fail('payer_capacity');
        const source = await eligible(c, account, body.campaignId, body.campaignSourceHash), now = await clock(c);
        if (source.payer.id !== actor.id || Number(source.guard.guard_price) !== body.priceCash) fail('guard_quote');
        const expires = new Date(Math.min(+now + body.lifetimeSeconds * 1000, +new Date(source.campaign.expiresAt), +new Date(source.leg.expiresAt)));
        if (+expires - +now < PROTECTION_CONTRACTS.minimumSeconds * 1000) fail('purchase_window');
        row = { id: 'pc_' + hash([account, keyHash(account, key)]).slice(0, 48),
          campaign_id: body.campaignId, campaign_source_hash: body.campaignSourceHash,
          courier_id: source.leg.courierId, courier_source_hash: source.leg.courierSourceHash,
          item_id: source.leg.itemId, leg: source.leg.leg, payer_account: account, payer_character: actor.id,
          protected_account: account, protected_character: actor.id,
          guard_account: source.guard.account_id, guard_character: source.guard.id,
          state: 'funded', price_cash: body.priceCash, remaining_cash: body.priceCash, paid_cash: 0, refunded_cash: 0,
          created_at: now, expires_at: expires, accepted_at: null, activated_at: null, closed_at: null, closure_reason: null,
          release_transaction: null, refund_transaction: null, guard_payer_journal: null, guard_payee_journal: null,
          coverage_until: null, coverage_proof: null };
        row.source_snapshot = { revision: PROTECTION_CONTRACT_REVISION, service: PROTECTION_CONTRACTS.service,
          campaignId: row.campaign_id, campaignSourceHash: row.campaign_source_hash, courierId: row.courier_id,
          courierSourceHash: row.courier_source_hash, itemId: row.item_id, leg: row.leg,
          payerAccount: account, payerCharacter: actor.id, guardAccount: row.guard_account, guardCharacter: row.guard_character,
          priceCash: row.price_cash, createdAt: now.toISOString(), expiresAt: expires.toISOString(), request: body };
        row.source_hash = hash([PROTECTION_CONTRACT_REVISION, row.id, row.source_snapshot]);
        row.reserve_transaction = await cash(c, actor, -row.price_cash, 'protection:reserve', row.id);
        const columns = Object.keys(row);
        registerItemTransactionUndo(c, () => c.query('DELETE FROM protection_contracts WHERE id=$1', [row.id]));
        await c.query('INSERT INTO protection_contracts(' + columns.join(',') + ') VALUES(' + columns.map((_, i) => '$' + (i + 1)).join(',') + ')', columns.map(column => row[column]));
      } else {
        row = await immutable(c, body.contractId, body.sourceHash);
        if (action === 'accept') {
          if (row.guard_account !== account || row.guard_character !== actor.id || row.state !== 'funded') fail('guard_original');
          await live(c, row);
          await retireGuardSlot(c, actor);
          row = await save(c, row, { state: 'accepted', accepted_at: await clock(c) });
          const receipt = await remember(c, actor, action, body, key, row);
          registerItemTransactionUndo(c, () => c.query('DELETE FROM protection_contract_acceptances WHERE contract_id=$1', [row.id]));
          await c.query('INSERT INTO protection_contract_acceptances(contract_id,guard_account,guard_character,request_key_hash,source_hash,consented_at) VALUES($1,$2,$3,$4,$5,$6)',
            [row.id, account, actor.id, keyHash(account, key), row.source_hash, row.accepted_at]);
          return receipt;
        }
        if (action === 'withdraw') {
          if (row.guard_account !== account || row.guard_character !== actor.id || row.state !== 'accepted') fail('guard_original');
          await acceptance(c, row);
          row = await block(c, row, 'guard_withdraw');
        } else if (action === 'refund' || action === 'expire') {
          if (action === 'expire' && +await clock(c) < +new Date(row.expires_at)) fail('not_expired');
          row = await refund(c, row, actor, action === 'expire' ? 'expired' : 'refunded', action === 'expire' ? 'source_expiry' : 'payer_refund');
        } else fail('action');
      }
      return remember(c, actor, action, body, key, row);
    } catch (error) { poisonItemTransaction(c, error); throw error; }
  });
  const { character, ...receipt } = result;
  return receipt;
}
async function runActivate(pool, account, body, key) {
  const target = await withItemRead(pool, async c => {
    const old = await replay(c, account, 'activate', body, key);
    if (old) return { old };
    const row = await immutable(c, body.contractId, body.sourceHash, false);
    if (row.payer_account !== account || row.state !== 'accepted') fail('accepted_original');
    await acceptance(c, row);
    return { guard: row.guard_character };
  });
  if (target.old) return target.old;
  const result = await G.withTwoCharacters(pool, account, target.guard, async (payer, guard, c, h) => {
    try {
      const old = await replay(c, account, 'activate', body, key);
      if (old) return old;
      let row = await immutable(c, body.contractId, body.sourceHash);
      if (row.state !== 'accepted' || row.payer_account !== account || row.payer_character !== payer.id
        || row.guard_character !== guard.id || row.guard_account !== guard.account_id
        || Number(row.remaining_cash) !== Number(row.price_cash)) fail('accepted_original');
      await acceptance(c, row);
      await live(c, row, h.rentalDeathScope);
      await accounting(c, row);
      const released = await cash(c, payer, Number(row.remaining_cash), 'protection:release', row.id);
      const Defense = await import('./social/defense.js');
      const canonical = await Defense.hireBodyguard(payer, guard, c, h);
      const actual = Defense.inspectProtectionGuard(c, canonical), now = await clock(c);
      if (actual.price !== Number(row.price_cash) || actual.payer !== row.payer_character || actual.guard !== row.guard_character) fail('coverage_source');
      row = await save(c, row, { state: 'activated', remaining_cash: 0, paid_cash: Number(row.price_cash), release_transaction: released,
        guard_payer_journal: actual.payerJournal, guard_payee_journal: actual.guardJournal,
        coverage_until: actual.until, coverage_proof: actual, activated_at: now, closed_at: now, closure_reason: 'service_purchased' });
      return remember(c, payer, 'activate', body, key, row, { canonical, actualHash: hash(actual) });
    } catch (error) { poisonItemTransaction(c, error); throw error; }
  }, { requireKnown: true });
  const { character, ...receipt } = result;
  return receipt;
}
// Fixed solo/pair Game hooks call this only after their actual character/account
// ACKs. An ordinary, replayed or caller-created result has no private witness.
export async function finalizeProtectionContract(c, result) {
  const proof = result && typeof result === 'object' ? completions.get(result) : null;
  if (!proof) return;
  completions.delete(result);
  try {
    assertItemTransaction(c);
    if (proof.client !== c || proof.transaction !== itemTransactionIdentity(c)) fail('completion_scope');
    const saved = (await c.query('SELECT * FROM protection_contract_requests WHERE account_id=$1 AND key_hash=$2', [proof.account, proof.keyHash])).rows[0];
    const actor = await current(c, proof.account), row = await immutable(c, proof.contractId, proof.sourceHash);
    if (!saved || saved.action !== proof.action || saved.body_hash !== proof.bodyHash || saved.original_character !== proof.actor
      || saved.contract_id !== row.id || hash(saved.receipt) !== proof.receiptHash || hash(result) !== proof.receiptHash
      || actor.id !== proof.actor || Number(actor.cash) !== proof.cash || row.state !== proof.state) fail('completion_ack');
    await accounting(c, row);
    if (['fund', 'accept', 'activate'].includes(proof.action)) await live(c, row);
    if (['accept', 'activate', 'withdraw'].includes(proof.action)) await acceptance(c, row);
    if (proof.sourceProof) {
      const actual = await (await import('./social/defense.js')).consumeProtectionGuard(c, proof.sourceProof.canonical);
      if (hash(actual) !== proof.sourceProof.actualHash || hash(row.coverage_proof) !== hash(actual)
        || row.state !== 'activated' || Number(row.remaining_cash) !== 0 || Number(row.paid_cash) !== actual.price
        || row.guard_payer_journal !== actual.payerJournal || row.guard_payee_journal !== actual.guardJournal
        || new Date(row.coverage_until).toISOString() !== actual.until) fail('coverage_final_ack');
    }
  } catch (error) { poisonItemTransaction(c, error); throw error; }
}
export async function protectionContractReady() {
  if (!dbCaps.skipLocked || G.protectionContractCompletionRevision !== PROTECTION_CONTRACT_REVISION) return false;
  const Defense = await import('./social/defense.js'), E = await import('./commercialcampaigns.js'), Courier = await import('./multihopcourier.js');
  return Defense.protectionContractCompletionRevision === PROTECTION_CONTRACT_REVISION
    && E.protectionContractSourceRevision === PROTECTION_CONTRACT_REVISION
    && Courier.protectionContractSourceRevision === PROTECTION_CONTRACT_REVISION;
}
export async function protectionContractAction(pool, account, action, body, key) {
  id(account); keyHash(account, key);
  const normalized = terms(action, body);
  if (!['refund', 'expire', 'withdraw'].includes(action) && !await protectionContractReady())
    throw Object.assign(new G.GameError('protection_contract_unavailable', 'Complete canonical native protection graph required.'), { statusCode: 503 });
  const old = await withItemRead(pool, c => replay(c, account, action, normalized, key));
  if (old) return old;
  return action === 'activate' ? runActivate(pool, account, normalized, key) : runSolo(pool, account, action, normalized, key);
}
export async function protectionContractBoard(c, account, after = '') {
  id(account); if (after) id(after);
  const rows = (await c.query('SELECT * FROM protection_contracts WHERE (payer_account=$1 OR guard_account=$1) AND id>$2 ORDER BY id LIMIT 21', [account, after])).rows;
  const contracts = [];
  for (const hint of rows.slice(0, 20)) {
    const row = await immutable(c, hint.id, hint.source_hash, false);
    let blockedReason = null;
    if (['funded', 'accepted'].includes(row.state)) {
      try { await live(c, row); } catch (error) {
        if (!(error instanceof G.GameError)) throw error;
        blockedReason = error.code + ':' + error.message;
      }
    }
    contracts.push({ ...view(row), blockedReason,
      recoveryActions: Number(row.remaining_cash) > 0 && row.payer_account === account ? ['refund', 'expire']
        : row.state === 'accepted' && row.guard_account === account ? ['withdraw'] : [] });
  }
  return { contracts, next: rows.length > 20 ? rows[19].id : null, gameCashOnly: true };
}
export async function recoverProtectionContractsAtEstateStart(c, victim, rentalScope, estateScope) {
  assertItemTransaction(c);
  try {
    const estate = await (await import('./social/estate.js')).assertEstateResolutionScope(c, id(victim.id), estateScope);
    const scope = await (await import('./equipmentrentals.js')).assertEquipmentRentalDeathScope(c, victim.id, rentalScope);
    if (!victim.alive || victim.account_id !== estate.accountId || !scope.ids.has(victim.id)) fail('estate_scope');
    const own = (await c.query('SELECT * FROM protection_contracts WHERE payer_account=$1 AND remaining_cash>0 ORDER BY id LIMIT 2 FOR UPDATE', [victim.account_id])).rows;
    const accepted = (await c.query("SELECT * FROM protection_contracts WHERE guard_account=$1 AND state='accepted' ORDER BY id LIMIT 2 FOR UPDATE", [victim.account_id])).rows;
    if (own.length > 1 || accepted.length > 1) fail('estate_census');
    const outcomes = [];
    for (const hint of own) {
      const row = await immutable(c, hint.id, hint.source_hash);
      if (row.payer_character !== victim.id) fail('estate_original');
      const next = await refund(c, row, victim, 'refunded', 'payer_estate');
      outcomes.push({ contractId: row.id, ownRefundCash: Number(next.refunded_cash), metadataOnly: false });
    }
    for (const hint of accepted) {
      const row = await immutable(c, hint.id, hint.source_hash);
      if (row.guard_character !== victim.id || row.state !== 'accepted') fail('estate_original');
      await acceptance(c, row);
      await block(c, row, 'guard_death');
      outcomes.push({ contractId: row.id, ownRefundCash: 0, metadataOnly: true });
    }
    return outcomes;
  } catch (error) { poisonItemTransaction(c, error); throw error; }
}

// Original-source history only. These readers cannot brand a completion, buy
// coverage, acquire actors, or infer current UID custody from a past purchase.
const protectionHistoryExact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const protectionHistoryRequire = (value, reason) => { if (!value) fail('history_' + reason); };
const protectionHistoryTime = value => {
  protectionHistoryRequire(value instanceof Date || typeof value === 'string', 'time');
  const at = +new Date(value); protectionHistoryRequire(Number.isFinite(at), 'time'); return at;
};
const protectionHistoryCash = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
async function protectionHistorySource(c, row) {
  const campaign = (await c.query('SELECT * FROM commercial_campaigns WHERE id=$1', [row.campaign_id])).rows[0];
  protectionHistoryRequire(campaign && campaign.source_hash === row.campaign_source_hash, 'campaign');
  const books = await (await import('./commercialcampaignruntime.js')).inspectCommercialCampaignBusinessHistory(c, campaign.business_id);
  protectionHistoryRequire(books.historyVersion === 'commercial_campaign_v1' && books.executionAuthority === false
    && Array.isArray(books.issues) && !books.issues.some(issue => issue.campaignId === row.campaign_id), 'campaign_history');
  const stages = (await c.query('SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 ORDER BY kind', [row.campaign_id])).rows;
  const made = stages.find(stage => stage.kind === 'manufacture'), courier = stages.find(stage => stage.kind === 'courier');
  const network = (await c.query('SELECT * FROM multi_hop_couriers WHERE id=$1', [row.courier_id])).rows[0];
  const item = (await c.query('SELECT id,template_id FROM item_instances WHERE id=$1', [row.item_id])).rows[0];
  const first = row.leg === 'first_leg';
  protectionHistoryRequire(stages.length === 4 && made?.state === 'completed' && made.output_item_id === row.item_id
    && courier?.courier_network_id === row.courier_id && courier.proof_json?.sourceHash === row.courier_source_hash
    && network?.source_hash === row.courier_source_hash && network.item_id === row.item_id
    && item?.id === row.item_id && item.template_id === 'item:precision_lock_tool'
    && network.owner_account === campaign.owner_account && network.owner_character === campaign.owner_character
    && network.first_account === campaign.first_carrier_account && network.first_character === campaign.first_carrier_character
    && network.second_account === campaign.second_carrier_account && network.second_character === campaign.second_carrier_character
    && row.payer_account === (first ? network.first_account : network.second_account)
    && row.payer_character === (first ? network.first_character : network.second_character)
    && row.guard_account === campaign.guard_account && row.guard_character === campaign.guard_character, 'typed_source');
}
async function protectionHistoryCoverage(c, row) {
  const p = row.coverage_proof;
  protectionHistoryRequire(protectionHistoryExact(p, ['family','evidence','payer','payerAccount','guard','guardAccount',
    'price','net','fee','tax','payerJournal','guardJournal','until','payerCash','guardCash','taxPool'])
    && p.family === 'protection_guard' && p.evidence === 'purchased_bodyguard_coverage'
    && p.payer === row.payer_character && p.payerAccount === row.payer_account
    && p.guard === row.guard_character && p.guardAccount === row.guard_account
    && p.price === Number(row.price_cash) && p.fee === Math.ceil(p.price * .01) && p.tax === Math.ceil(p.price * .01)
    && p.net === p.price - p.fee - p.tax && protectionHistoryCash(p.payerCash) && protectionHistoryCash(p.guardCash)
    && Number.isFinite(p.taxPool) && p.taxPool >= p.tax
    && p.payerJournal === row.guard_payer_journal && p.guardJournal === row.guard_payee_journal
    && p.payerJournal !== p.guardJournal && protectionHistoryTime(p.until) === protectionHistoryTime(row.coverage_until)
    && protectionHistoryTime(row.coverage_until) > protectionHistoryTime(row.activated_at), 'coverage');
  for (const [key, character, amount, other] of [[p.payerJournal,p.payer,-p.price,p.guard], [p.guardJournal,p.guard,p.net,p.payer]]) {
    const actual = (await c.query('SELECT * FROM transactions WHERE id=$1', [key])).rows[0];
    protectionHistoryRequire(actual && actual.character_id === character && actual.account_id == null
      && actual.currency === 'cash' && Number(actual.amount) === amount && actual.reason === 'bodyguard:hire'
      && actual.counterparty === other, 'coverage_journal');
  }
}
async function protectionHistoryRequests(c, row) {
  const requests = (await c.query('SELECT * FROM protection_contract_requests WHERE contract_id=$1 ORDER BY account_id,key_hash', [row.id])).rows;
  const accepted = (await c.query('SELECT * FROM protection_contract_acceptances WHERE contract_id=$1', [row.id])).rows;
  const created = protectionHistoryTime(row.created_at), expires = protectionHistoryTime(row.expires_at);
  protectionHistoryRequire(requests.filter(r => r.action === 'fund').length === 1 && accepted.length <= 1, 'request_census');
  if (row.accepted_at == null) protectionHistoryRequire(!accepted.length && !requests.some(r => ['accept','withdraw','activate'].includes(r.action)), 'unsigned');
  else { protectionHistoryRequire(accepted.length === 1, 'acceptance_missing'); await acceptance(c, row); }
  const count = action => requests.filter(r => r.action === action).length;
  for (const request of requests) {
    const action = request.action, guard = action === 'accept' || action === 'withdraw';
    const body = action === 'fund' ? row.source_snapshot.request : { contractId: row.id, sourceHash: row.source_hash, consent: true };
    protectionHistoryRequire(PROTECTION_CONTRACTS && ['fund','accept','activate','refund','expire','withdraw'].includes(action)
      && /^[a-f0-9]{64}$/.test(request.key_hash) && request.contract_id === row.id
      && request.account_id === (guard ? row.guard_account : row.payer_account)
      && request.original_character === (guard ? row.guard_character : row.payer_character)
      && request.body_hash === hash([action, body]) && protectionHistoryTime(request.acknowledged_at) >= created, 'request');
    let snapshot = row;
    if (action === 'fund' || action === 'accept' || action === 'withdraw') snapshot = { ...row,
      state: action === 'fund' ? 'funded' : action === 'accept' ? 'accepted' : 'blocked',
      remaining_cash: row.price_cash, paid_cash: 0, refunded_cash: 0, coverage_until: null,
      closure_reason: action === 'withdraw' ? 'guard_withdraw' : null };
    protectionHistoryRequire(stable(request.receipt) === stable({ ok: true, contract: view(snapshot) }), 'request_receipt');
    if (action === 'fund') protectionHistoryRequire(row.id === 'pc_' + hash([row.payer_account, request.key_hash]).slice(0, 48), 'fund_identity');
    if (['fund','accept','activate'].includes(action)) protectionHistoryRequire(protectionHistoryTime(request.acknowledged_at) < expires, 'request_expiry');
    if (action === 'accept') protectionHistoryRequire(protectionHistoryTime(request.acknowledged_at) >= protectionHistoryTime(row.accepted_at), 'acceptance_time');
    if (action === 'activate') protectionHistoryRequire(row.state === 'activated'
      && protectionHistoryTime(request.acknowledged_at) >= protectionHistoryTime(row.activated_at), 'activation_ack');
    if (action === 'refund' || action === 'expire') protectionHistoryRequire(row.state === (action === 'refund' ? 'refunded' : 'expired')
      && protectionHistoryTime(request.acknowledged_at) >= protectionHistoryTime(row.closed_at), 'refund_ack');
  }
  protectionHistoryRequire(count('accept') === accepted.length && count('withdraw') <= 1 && count('activate') <= 1
    && count('refund') + count('expire') <= 1, 'request_duplicates');
  if (row.state === 'activated') protectionHistoryRequire(count('activate') === 1 && !count('withdraw') && !count('refund') && !count('expire'), 'paid_ack');
  else protectionHistoryRequire(!count('activate'), 'unpaid_ack');
  if (['funded','accepted'].includes(row.state)) protectionHistoryRequire(!count('withdraw') && !count('refund') && !count('expire'), 'open_ack');
  if (row.state === 'blocked') protectionHistoryRequire(!count('refund') && !count('expire')
    && count('withdraw') === (row.closure_reason === 'guard_withdraw' ? 1 : 0), 'blocked_ack');
  if (row.state === 'refunded' || row.state === 'expired') protectionHistoryRequire(count('refund') + count('expire')
    === (row.closure_reason === 'payer_estate' ? 0 : 1), 'closed_ack');
}
async function protectionHistoryRow(c, supplied) {
  const row = await immutable(c, supplied.id, supplied.source_hash, false), created = protectionHistoryTime(row.created_at);
  protectionHistoryRequire(['funded','accepted','blocked','activated','refunded','expired'].includes(row.state)
    && [row.remaining_cash,row.paid_cash,row.refunded_cash].every(protectionHistoryCash), 'state');
  await accounting(c, row); await protectionHistoryRequests(c, row); await protectionHistorySource(c, row);
  if (row.accepted_at != null) protectionHistoryRequire(protectionHistoryTime(row.accepted_at) >= created
    && protectionHistoryTime(row.accepted_at) < protectionHistoryTime(row.expires_at), 'accepted_time');
  if (row.state === 'funded') protectionHistoryRequire(row.accepted_at == null && row.closed_at == null && row.closure_reason == null, 'funded_state');
  if (row.state === 'accepted') protectionHistoryRequire(row.accepted_at != null && row.closed_at == null && row.closure_reason == null, 'accepted_state');
  if (row.state === 'blocked') protectionHistoryRequire(row.accepted_at != null && protectionHistoryTime(row.closed_at) >= protectionHistoryTime(row.accepted_at)
    && ['guard_withdraw','guard_death','stale_source'].includes(row.closure_reason), 'blocked_state');
  if (['funded','accepted','blocked'].includes(row.state)) protectionHistoryRequire(Number(row.remaining_cash) === Number(row.price_cash)
    && Number(row.paid_cash) === 0 && Number(row.refunded_cash) === 0 && row.release_transaction == null && row.refund_transaction == null, 'reserved_state');
  if (row.state === 'activated') {
    protectionHistoryRequire(Number(row.remaining_cash) === 0 && Number(row.paid_cash) === Number(row.price_cash) && Number(row.refunded_cash) === 0
      && row.release_transaction != null && row.refund_transaction == null && row.accepted_at != null
      && protectionHistoryTime(row.activated_at) >= protectionHistoryTime(row.accepted_at)
      && protectionHistoryTime(row.activated_at) < protectionHistoryTime(row.expires_at)
      && protectionHistoryTime(row.closed_at) === protectionHistoryTime(row.activated_at) && row.closure_reason === 'service_purchased', 'paid_state');
    await protectionHistoryCoverage(c, row);
  } else protectionHistoryRequire(row.coverage_proof == null && row.coverage_until == null && row.guard_payer_journal == null
    && row.guard_payee_journal == null && row.activated_at == null, 'unpaid_coverage');
  if (row.state === 'refunded' || row.state === 'expired') protectionHistoryRequire(Number(row.remaining_cash) === 0 && Number(row.paid_cash) === 0
    && Number(row.refunded_cash) === Number(row.price_cash) && row.release_transaction == null && row.refund_transaction != null
    && protectionHistoryTime(row.closed_at) >= created && (row.state === 'expired'
      ? row.closure_reason === 'source_expiry' && protectionHistoryTime(row.closed_at) >= protectionHistoryTime(row.expires_at)
      : ['payer_refund','payer_estate'].includes(row.closure_reason)), 'refunded_state');
  return Object.freeze({ contractId: row.id, sourceHash: row.source_hash, itemId: row.item_id,
    campaignId: row.campaign_id, courierId: row.courier_id, state: row.state,
    reservedCash: Number(row.remaining_cash), signedGuardMembership: row.state === 'accepted',
    itemHold: false, executionAuthority: false, gameCashOnly: true });
}
export async function inspectProtectionContractHistory(c, contractId, sourceHash) {
  id(contractId); if (typeof sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(sourceHash)) fail('history_source');
  return protectionHistoryRow(c, { id: contractId, source_hash: sourceHash });
}
export async function inspectProtectionContractUidReference(c, contractId, sourceHash, itemId) {
  id(itemId); const result = await inspectProtectionContractHistory(c, contractId, sourceHash);
  protectionHistoryRequire(result.itemId === itemId, 'uid_reference'); return result;
}
export async function protectionContractAccounting(c) {
  const rows = (await c.query('SELECT * FROM protection_contracts ORDER BY id')).rows, issues = [];
  const requests = (await c.query('SELECT * FROM protection_contract_requests ORDER BY account_id,key_hash')).rows;
  const acceptances = (await c.query('SELECT * FROM protection_contract_acceptances ORDER BY contract_id')).rows;
  const known = new Set(rows.map(row => row.id));
  for (const row of requests) if (!known.has(row.contract_id)) issues.push({ contractId: row.contract_id, reason: 'history_orphan_request' });
  for (const row of acceptances) if (!known.has(row.contract_id)) issues.push({ contractId: row.contract_id, reason: 'history_orphan_acceptance' });
  const journals = (await c.query("SELECT id,character_id,account_id,currency,amount,reason,counterparty FROM transactions WHERE reason IN ('protection:reserve','protection:release','protection:refund') ORDER BY id")).rows;
  const expectedJournals = new Map(), observedJournals = new Map();
  for (const row of rows) for (const [field, reason, direction] of [
    ['reserve_transaction', 'protection:reserve', -1],
    ['release_transaction', 'protection:release', 1],
    ['refund_transaction', 'protection:refund', 1]
  ]) {
    const journalId = row[field];
    if (journalId == null && field !== 'reserve_transaction') continue;
    if (typeof journalId !== 'string' || !journalId.length) {
      issues.push({ contractId: row.id, reason: 'history_journal_reference' }); continue;
    }
    if (expectedJournals.has(journalId)) {
      issues.push({ contractId: row.id, journalId, reason: 'history_duplicate_journal_reference' }); continue;
    }
    expectedJournals.set(journalId, { contractId: row.id, characterId: row.payer_character,
      amount: direction * Number(row.price_cash), reason });
  }
  for (const journal of journals) {
    observedJournals.set(journal.id, (observedJournals.get(journal.id) ?? 0) + 1);
    const expected = expectedJournals.get(journal.id);
    if (!known.has(journal.counterparty)) issues.push({ journalId: journal.id, reason: 'history_orphan_journal' });
    if (!expected) issues.push({ journalId: journal.id, reason: 'history_unreferenced_journal' });
    else if (journal.counterparty !== expected.contractId || journal.character_id !== expected.characterId
      || journal.account_id != null || journal.currency !== 'cash' || journal.reason !== expected.reason
      || Number(journal.amount) !== expected.amount)
      issues.push({ contractId: expected.contractId, journalId: journal.id, reason: 'history_journal_identity' });
  }
  for (const [journalId, expected] of expectedJournals) if (observedJournals.get(journalId) !== 1)
    issues.push({ contractId: expected.contractId, journalId, reason: 'history_journal_census' });
  const payers = new Map(), guards = new Map();
  let reservedCash = 0;
  for (const row of rows) {
    if (protectionHistoryCash(row.remaining_cash)) {
      reservedCash += Number(row.remaining_cash);
      if (row.remaining_cash > 0) payers.set(row.payer_account, (payers.get(row.payer_account) ?? 0) + 1);
    }
    else issues.push({ contractId: row.id, reason: 'history_reserve' });
    if (row.state === 'accepted') guards.set(row.guard_account, (guards.get(row.guard_account) ?? 0) + 1);
    try { await protectionHistoryRow(c, row); } catch (error) {
      if (!(error instanceof G.GameError) || error.code !== 'protection_contract') throw error;
      issues.push({ contractId: row.id, reason: error.message });
    }
  }
  for (const [accountId, count] of payers) if (count > PROTECTION_CONTRACTS.outstandingPerPayer)
    issues.push({ accountId, reason: 'history_payer_capacity' });
  for (const [accountId, count] of guards) if (count > PROTECTION_CONTRACTS.acceptedPerGuard)
    issues.push({ accountId, reason: 'history_guard_capacity' });
  protectionHistoryRequire(Number.isSafeInteger(reservedCash), 'reserve_total');
  return { reservedCash, issues, contractCount: rows.length, executionAuthority: false, gameCashOnly: true };
}
