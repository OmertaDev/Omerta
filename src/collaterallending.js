import crypto from 'node:crypto';
import * as G from './game.js';
import * as I from './items.js';
import * as Loans from './loans.js';
import { dbCaps } from './db.js';
import { LOAN, loanOwed } from './rules.js';
import { assertEquipmentUsable, precisionToolConditionRead } from './itemdurability.js';
import { COLLATERAL_LENDING, collateralStable as stable, collateralHash as hash, collateralDate as date, collateralPledgeSource, collateralTerminalSource } from './collaterallending-schema.js';
import { collectCollateralLendingIssues, collectCollateralLendingPledgeIssues, verifyCollateralLendingTerminal } from './collaterallending-invariants.js';

const finalizations = new WeakMap();
const terminalFinalizations = new WeakMap();
const fail = reason => { throw new G.GameError('collateral_lending', reason); };
const id = value => { if (typeof value !== 'string' || !/^[!-~]{1,128}$/.test(value)) fail('identity'); return value; };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (body, keys) => body && typeof body === 'object' && !Array.isArray(body)
  && Object.keys(body).sort().join(',') === [...keys].sort().join(',');
const clock = async client => new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now);
const title = account => ({ scope: 'account', id: account });
const readJson = value => typeof value === 'string' ? JSON.parse(value) : value;
const sourceHash = row => hash(collateralPledgeSource(row));
const dto = row => ({ pledgeId: row.id, sourceHash: row.source_hash, loanId: row.loan_id, itemId: row.item_id,
  state: row.state, principal: Number(row.principal), owed: loanOwed(row.principal, row.rate), dueAt: date(row.due_at),
  collateralTitle: 'original_borrower_account', liquidationAvailable: false });

export function collateralLendingTerms(action, body) {
  if (action === 'quote') {
    if (!exact(body, ['loanId', 'itemId'])) fail('terms');
    return { loanId: id(body.loanId), itemId: id(body.itemId) };
  }
  const fields = action === 'pledge' ? ['loanId', 'itemId', 'sourceHash', 'consent'] : ['pledgeId', 'sourceHash', 'consent'];
  if (!['pledge', 'repay', 'release'].includes(action) || !exact(body, fields) || !digest(body.sourceHash) || body.consent !== true) fail('terms');
  return action === 'pledge' ? { loanId: id(body.loanId), itemId: id(body.itemId), sourceHash: body.sourceHash, consent: true }
    : { pledgeId: id(body.pledgeId), sourceHash: body.sourceHash, consent: true };
}
async function original(client, character, account, alive = true) {
  const row = (await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE id=$1', [character])).rows[0];
  if (!row || row.account_id !== account || row.is_npc || (alive && !row.alive)) fail('original_actor');
  if (alive) {
    const current = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [account])).rows;
    if (current.length !== 1 || current[0].id !== character
      || (await client.query('SELECT status FROM accounts WHERE id=$1', [account])).rows[0]?.status !== 'active') fail('original_actor');
  }
  return row;
}
// Ordinary cash repayment/collection may reach a restricted counterparty account.
// Validate its original living street without adding a new cash-party status gate.
async function cashParty(client, character, account) {
  const row = await original(client, character, account, false);
  const current = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [account])).rows;
  if (!row.alive || current.length !== 1 || current[0].id !== character) fail('original_actor');
  return row;
}
function loanTerms(loan) {
  if (!loan || !Number.isSafeInteger(Number(loan.principal)) || Number(loan.principal) < LOAN.MIN || Number(loan.principal) > LOAN.MAX
    || !(Number(loan.rate) > 0 && Number(loan.rate) <= LOAN.RATE_MAX) || !Number.isInteger(Number(loan.hours))
    || Number(loan.hours) < LOAN.TERM_MIN_H || Number(loan.hours) > LOAN.TERM_MAX_H
    || Number(loan.collateral_min) !== 0 || Number(loan.collateral_omr) !== 0 || loan.collateral_car) fail('loan_terms');
  return { principal: Number(loan.principal), rate: Number(loan.rate), hours: Number(loan.hours), offeredAt: date(loan.offered_at) };
}
async function tool(client, account, itemId) {
  const health = await assertEquipmentUsable(client, { itemId, owner: title(account) });
  if (health.maximum !== 100 || health.remaining < 10) fail('unsupported_tool');
  const births = (await client.query("SELECT id,idempotency_key FROM item_events WHERE item_id=$1 AND event_kind='created' AND provenance_kind='crafted' ORDER BY sequence LIMIT 2", [itemId])).rows;
  if (births.length !== 1) fail('birth_source');
  const condition = (await client.query('SELECT revision FROM item_durability_states WHERE item_id=$1', [itemId])).rows[0];
  return { itemId, birthEvent: births[0].id, birthMutation: births[0].idempotency_key,
    condition: health.remaining, conditionRevision: Number(condition?.revision || 0) };
}
function quoteSource(loan, borrower, lender, item) {
  return { kind: 'collateral-lending-directed-offer-v1', loanId: loan.id, ...loanTerms(loan),
    borrowerAccount: borrower.account_id, borrowerCharacter: borrower.id, lenderAccount: lender.account_id, lenderCharacter: lender.id, item };
}
async function lockedQuote(client, account, terms, pair = null) {
  const current = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [account])).rows;
  if (current.length !== 1) fail('original_actor');
  const hint = (await client.query('SELECT * FROM loans WHERE id=$1', [terms.loanId])).rows[0];
  if (!hint || hint.offered_to !== current[0].id || hint.lender_character === current[0].id || hint.lender_character === 'HOUSE') fail('directed_offer');
  let borrower, lender;
  if (pair) {
    [borrower, lender] = pair;
    if (borrower.id !== current[0].id || lender.id !== hint.lender_character) fail('loan_holder_changed');
  } else {
    const R = await import('./equipmentrentals.js');
    const scope = await R.prelockEquipmentRentalDeathActors(client, [current[0].id, hint.lender_character]);
    borrower = scope.characters.find(row => row.id === current[0].id);
    lender = scope.characters.find(row => row.id === hint.lender_character);
  }
  if (!borrower || !lender || borrower.account_id === lender.account_id) fail('distinct_originals');
  await original(client, borrower.id, account);
  await original(client, lender.id, lender.account_id);
  const loan = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [terms.loanId])).rows[0];
  if (!loan || loan.status !== 'open' || loan.lender_character !== lender.id || loan.offered_to !== borrower.id || loan.borrower_character) fail('directed_offer');
  const item = await tool(client, account, terms.itemId), source = quoteSource(loan, borrower, lender, item), observed = await clock(client);
  if (+observed < +new Date(loan.offered_at) || +observed >= +new Date(loan.offered_at) + LOAN.OFFER_TTL_MS) fail('offer_expired');
  return { loan, borrower, lender, item, source, sourceHash: hash(source), observed };
}
export async function collateralLendingQuote(pool, account, body) {
  id(account); const terms = collateralLendingTerms('quote', body);
  return I.withItemTransaction(pool, async client => {
    try {
      const q = await lockedQuote(client, account, terms);
      return { ok: true, loanId: q.loan.id, itemId: terms.itemId, sourceHash: q.sourceHash,
        principal: Number(q.loan.principal), owed: loanOwed(q.loan.principal, q.loan.rate), hours: Number(q.loan.hours),
        offerExpiresAt: new Date(+new Date(q.loan.offered_at) + LOAN.OFFER_TTL_MS).toISOString(),
        collateralTitle: 'original_borrower_account', liquidationAvailable: false };
    } catch (error) { I.poisonItemTransaction(client, error); throw error; }
  });
}
async function checkRow(client, row) {
  if (!row || row.source_hash !== sourceHash(row)) fail('pledge_source');
  const birth = (await client.query('SELECT item_id,idempotency_key,event_kind,provenance_kind FROM item_events WHERE id=$1', [row.birth_event])).rows[0];
  if (!birth || birth.item_id !== row.item_id || birth.idempotency_key !== row.birth_mutation
    || birth.event_kind !== 'created' || birth.provenance_kind !== 'crafted') fail('birth_source');
  return row;
}
function sameDebt(row, loan) {
  if (!loan || loan.id !== row.loan_id || loan.borrower_character !== row.borrower_character || loan.offered_to !== row.borrower_character
    || stable(loanTerms(loan)) !== stable({ principal: Number(row.principal), rate: Number(row.rate), hours: Number(row.hours), offeredAt: date(row.offered_at) })
    || date(loan.due_at) !== date(row.due_at)) fail('loan_source');
}
async function held(client, row) {
  const item = (await client.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1 FOR UPDATE', [row.item_id])).rows[0];
  const custody = (await client.query('SELECT operation_id,depositor_scope,depositor_id FROM operation_escrow WHERE item_id=$1 FOR UPDATE', [row.item_id])).rows[0];
  if (row.state !== 'held' || item?.owner_scope !== 'operation' || item.owner_id !== row.id || item.state !== 'escrowed'
    || custody?.operation_id !== row.id || custody.depositor_scope !== 'account' || custody.depositor_id !== row.borrower_account) fail('collateral_custody');
  const condition = await precisionToolConditionRead(client, row.item_id);
  const revision = Number((await client.query('SELECT revision FROM item_durability_states WHERE item_id=$1', [row.item_id])).rows[0]?.revision || 0);
  if (condition.maximum !== 100 || condition.remaining !== Number(row.initial_condition) || revision !== Number(row.initial_condition_revision)) fail('collateral_condition');
}
async function event(client, itemId, kind, mutationKey) {
  const rows = (await client.query('SELECT * FROM item_events WHERE item_id=$1 AND event_kind=$2 AND idempotency_key=$3 ORDER BY sequence LIMIT 2', [itemId, kind, mutationKey])).rows;
  if (rows.length !== 1) fail('custody_event'); return rows[0];
}
async function release(client, row, kind, run, estate = false) {
  await held(client, row);
  const mutationKey = 'collateral-lending:' + run + ':release';
  await I.withItemMutation(client, title(row.borrower_account), 'operation_action', mutationKey,
    { pledgeId: row.id, loanId: row.loan_id, itemId: row.item_id, kind,
      itemAuthority: { operations: [row.id], destinations: [title(row.borrower_account)] } }, mutation =>
      I.releaseEscrow(client, row.id, title(row.borrower_account), row.item_id, 'equipment loan collateral returns only to its original depositor', mutation));
  const receipt = await event(client, row.item_id, 'released', mutationKey), stamp = await clock(client);
  I.registerItemTransactionUndo(client, () => client.query("UPDATE collateral_lending_pledges SET state='held',released_at=NULL,release_event=NULL,release_kind=NULL WHERE id=$1", [row.id]));
  if ((await client.query('UPDATE collateral_lending_pledges SET state=$2,released_at=$3,release_event=$4,release_kind=$5 WHERE id=$1 AND state=$6',
    [row.id, estate ? 'estate_released' : 'released', stamp, receipt.id, kind, 'held'])).rowCount !== 1) fail('pledge_changed');
  return { ...row, state: estate ? 'estate_released' : 'released', released_at: stamp, release_event: receipt.id, release_kind: kind };
}
async function prior(client, account, key, identity) {
  const row = (await client.query('SELECT body_hash,receipt FROM collateral_lending_requests WHERE account_id=$1 AND request_key=$2', [account, key])).rows[0];
  if (!row) return null;
  if (row.body_hash !== identity) fail('request_conflict');
  if (!row.receipt) fail('in_progress');
  return readJson(row.receipt);
}
async function perform(client, account, action, terms, key, borrower, lender, h) {
  I.assertItemTransaction(client);
  try {
    const identity = hash([action, terms]), old = await prior(client, account, key, identity);
    if (old) return old;
    await original(client, borrower.id, account);
    const run = crypto.randomUUID();
    I.registerItemTransactionUndo(client, () => client.query('DELETE FROM collateral_lending_requests WHERE account_id=$1 AND request_key=$2 AND run_id=$3', [account, key, run]));
    await client.query('INSERT INTO collateral_lending_requests(account_id,request_key,run_id,action,body_hash,request_json) VALUES($1,$2,$3,$4,$5,$6)', [account, key, run, action, identity, terms]);
    let row, loan, ordinary = null;
    if (action === 'pledge') {
      const q = await lockedQuote(client, account, terms, [borrower, lender]);
      if (q.sourceHash !== terms.sourceHash) fail('quote_source');
      if ((await client.query("SELECT id FROM collateral_lending_pledges WHERE borrower_character=$1 AND state='held' LIMIT 1", [borrower.id])).rows.length) fail('pledge_capacity');
      const mutationKey = 'collateral-lending:' + run + ':pledge';
      await I.withItemMutation(client, title(account), 'operation_action', mutationKey,
        { pledgeId: run, loanId: q.loan.id, itemId: terms.itemId, itemAuthority: { operations: [run] } }, mutation =>
          I.escrowItem(client, title(account), run, terms.itemId, 'voluntary existing cash-loan equipment collateral', mutation, 'used_in_operation'));
      const before = new Set((await client.query("SELECT id FROM transactions WHERE character_id=$1 AND currency='cash' AND reason='loan:take'", [borrower.id])).rows.map(value => value.id));
      ordinary = await Loans.takeLoan(borrower, q.loan.id, null, client, h);
      loan = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [q.loan.id])).rows[0];
      const journals = (await client.query("SELECT id,amount,counterparty FROM transactions WHERE character_id=$1 AND currency='cash' AND reason='loan:take'", [borrower.id])).rows.filter(value => !before.has(value.id));
      if (journals.length !== 1 || Number(journals[0].amount) !== Number(q.loan.principal) || journals[0].counterparty !== lender.id
        || loan?.status !== 'active' || loan.borrower_character !== borrower.id || loan.lender_character !== lender.id
        || ordinary.principal !== Number(q.loan.principal) || ordinary.owed !== loanOwed(q.loan.principal, q.loan.rate)) fail('loan_witness');
      row = { id: run, loan_id: loan.id, item_id: terms.itemId, borrower_account: account, borrower_character: borrower.id,
        original_lender_account: lender.account_id, original_lender_character: lender.id, principal: Number(loan.principal), rate: Number(loan.rate),
        hours: Number(loan.hours), offered_at: loan.offered_at, due_at: loan.due_at, birth_event: q.item.birthEvent,
        birth_mutation: q.item.birthMutation, initial_condition: q.item.condition, initial_condition_revision: q.item.conditionRevision,
        take_journal: journals[0].id, escrow_event: (await event(client, terms.itemId, 'escrowed', mutationKey)).id,
        created_at: await clock(client), state: 'held' };
      row.source_hash = sourceHash(row);
      const columns = Object.keys(row);
      I.registerItemTransactionUndo(client, () => client.query('DELETE FROM collateral_lending_pledges WHERE id=$1', [run]));
      await client.query('INSERT INTO collateral_lending_pledges(' + columns.join(',') + ') VALUES(' + columns.map((_, index) => '$' + (index + 1)).join(',') + ')', columns.map(column => row[column]));
    } else {
      const hint = (await client.query('SELECT loan_id FROM collateral_lending_pledges WHERE id=$1', [terms.pledgeId])).rows[0];
      if (!hint) fail('pledge_source');
      loan = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [hint.loan_id])).rows[0];
      row = await checkRow(client, (await client.query('SELECT * FROM collateral_lending_pledges WHERE id=$1 FOR UPDATE', [terms.pledgeId])).rows[0]);
      if (row.source_hash !== terms.sourceHash || row.borrower_account !== account || row.borrower_character !== borrower.id) fail('original_borrower');
      sameDebt(row, loan); await held(client, row);
      if (action === 'repay') {
        if (loan.status !== 'active' || !lender || lender.id !== loan.lender_character) fail('loan_holder_changed');
        await cashParty(client, lender.id, lender.account_id);
        ordinary = await Loans.repayLoan(borrower, lender, loan.id, client, h);
        loan = (await client.query('SELECT * FROM loans WHERE id=$1', [loan.id])).rows[0];
        if (loan.status !== 'repaid' || ordinary.paid !== loanOwed(row.principal, row.rate)) fail('repayment_source');
      } else if (!['repaid', 'collected'].includes(loan.status)) fail('debt_not_terminal');
      const terminal = await verifyCollateralLendingTerminal(client, row);
      if (terminal.kind !== loan.status || terminal.holder_character !== loan.lender_character) fail('terminal_source');
      row = await release(client, row, loan.status, run);
    }
    const receipt = { ok: true, pledge: dto(row), ...(ordinary ? { loan: ordinary } : {}) };
    if ((await client.query('UPDATE collateral_lending_requests SET receipt=$4,account_ref=$1,original_character=$5,pledge_id=$6 WHERE account_id=$1 AND request_key=$2 AND run_id=$3 AND receipt IS NULL',
      [account, key, run, receipt, borrower.id, row.id])).rowCount !== 1) fail('receipt_source');
    finalizations.set(receipt, { client, transaction: I.itemTransactionIdentity(client), account, key, run, identity, row,
      loanStatus: loan.status, lenderId: loan.lender_character, characters: [borrower, ...(lender ? [lender] : [])].map(person => ({ id: person.id, account: person.account_id, cash: Number(person.cash) })),
      action, terms, done: false });
    return receipt;
  } catch (error) { I.poisonItemTransaction(client, error); throw error; }
}

export async function collateralLendingAvailability() {
  const Estate = await import('./social/estate.js'), Books = await import('./invariants.js');
  const getters = [G.getCollateralLendingFinalizer, Estate.getCollateralLendingEstateRecovery, Books.getCollateralLendingBookCollector];
  const canonicalHooks = getters.every(value => typeof value === 'function')
    && await getters[0]() === finalizeCollateralLendingAction && await getters[1]() === recoverCollateralLendingInEstate
    && await getters[2]() === collectCollateralLendingIssues && typeof Loans.getCollateralLendingTerminalVerifier === 'function'
    && typeof Loans.assertCollateralLendingTerminalProof === 'function'
    && await Loans.getCollateralLendingTerminalVerifier() === Loans.assertCollateralLendingTerminalProof;
  return { available: canonicalHooks && dbCaps.skipLocked === true, nativeOnly: true,
    requiresCanonicalEstateBooksAndFinalization: true, currency: 'game_cash', cryptoAvailable: false };
}
export async function collateralLendingAction(pool, account, action, body, key) {
  id(account); id(key); const terms = collateralLendingTerms(action, body), identity = hash([action, terms]);
  const previous = await I.withItemRead(pool, client => prior(client, account, key, identity));
  if (previous) return previous;
  if (!(await collateralLendingAvailability()).available) throw Object.assign(new G.GameError('collateral_lending_unavailable', 'Canonical native custody, estate, book and final-persistence integration required.'), { statusCode: 503 });
  let result;
  if (action === 'release') {
    result = await G.withCharacter(pool, account, (borrower, client, h) => perform(client, account, action, terms, key, borrower, null, h));
  } else {
    const hint = action === 'pledge' ? (await pool.query('SELECT lender_character FROM loans WHERE id=$1', [terms.loanId])).rows[0]
      : (await pool.query('SELECT l.lender_character FROM collateral_lending_pledges p JOIN loans l ON l.id=p.loan_id WHERE p.id=$1', [terms.pledgeId])).rows[0];
    if (!hint || hint.lender_character === 'HOUSE') fail('loan_source');
    result = await G.withTwoCharacters(pool, account, hint.lender_character,
      (borrower, lender, client, h) => perform(client, account, action, terms, key, borrower, lender, h), { meet: false });
  }
  const { character, ...receipt } = result;
  return receipt;
}

/** Only actual owned callback results carry this private brand; old game actions are untouched. */
export async function finalizeCollateralLendingAction(client, result) {
  await finalizeTerminal(client, result);
  if (result?.loan) await finalizeTerminal(client, result.loan);
  const scope = result && finalizations.get(result);
  if (!scope) return;
  try {
    I.assertItemTransaction(client); I.assertItemTransactionHealthy(client);
    if (scope.done || scope.client !== client || scope.transaction !== I.itemTransactionIdentity(client)) fail('finalization_scope');
    const row = await checkRow(client, (await client.query('SELECT * FROM collateral_lending_pledges WHERE id=$1', [scope.row.id])).rows[0]);
    if (stable(collateralPledgeSource(row)) !== stable(collateralPledgeSource(scope.row))) fail('pledge_source');
    if (row.state !== scope.row.state || row.release_event !== (scope.row.release_event || null) || row.release_kind !== (scope.row.release_kind || null)
      || (row.released_at ? date(row.released_at) : null) !== (scope.row.released_at ? date(scope.row.released_at) : null)) fail('release_source');
    const request = (await client.query('SELECT * FROM collateral_lending_requests WHERE account_id=$1 AND request_key=$2', [scope.account, scope.key])).rows[0];
    if (!request || request.run_id !== scope.run || request.body_hash !== scope.identity || request.action !== scope.action
      || stable(readJson(request.request_json)) !== stable(scope.terms) || request.account_ref !== scope.account
      || request.original_character !== row.borrower_character || request.pledge_id !== row.id || stable(readJson(request.receipt)) !== stable(result)) fail('receipt_source');
    const loan = (await client.query('SELECT * FROM loans WHERE id=$1', [row.loan_id])).rows[0];
    sameDebt(row, loan);
    if (loan.status !== scope.loanStatus || loan.lender_character !== scope.lenderId) fail('loan_holder_changed');
    for (const person of scope.characters) {
      if (scope.action === 'pledge' || person.account === scope.account) await original(client, person.id, person.account);
      else await cashParty(client, person.id, person.account);
      if (Number((await client.query('SELECT cash FROM characters WHERE id=$1', [person.id])).rows[0].cash) !== person.cash) fail('persisted_cash');
    }
    if (row.state === 'held') await held(client, row);
    else {
      const item = (await client.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [row.item_id])).rows[0];
      if (item?.owner_scope !== 'account' || item.owner_id !== row.borrower_account || item.state !== 'active'
        || (await client.query('SELECT item_id FROM operation_escrow WHERE item_id=$1', [row.item_id])).rows.length) {
        const Auction = await import('./collateralauction.js');
        await Auction.assertCollateralAuctionDisposal(client, result, row);
      }
    }
    if ((await collectCollateralLendingPledgeIssues(client, row.id)).length) fail('collateral_books');
    if (scope.action === 'pledge' && +await clock(client) >= +new Date(row.offered_at) + LOAN.OFFER_TTL_MS) fail('offer_expired');
    I.assertItemTransactionHealthy(client); scope.done = true;
  } catch (error) { I.poisonItemTransaction(client, error); throw error; }
}

export async function recoverCollateralLendingInEstate(client, victimId, rentalScope, estateScope) {
  I.assertItemTransaction(client);
  try {
    const Estate = await import('./social/estate.js'), R = await import('./equipmentrentals.js');
    const estate = await Estate.assertEstateResolutionScope(client, id(victimId), estateScope);
    await R.assertEquipmentRentalDeathScope(client, victimId, rentalScope);
    const victim = (await client.query('SELECT account_id,alive FROM characters WHERE id=$1', [victimId])).rows[0];
    if (!victim || victim.alive !== false || victim.account_id !== estate.accountId) fail('estate_phase');
    const rows = (await client.query("SELECT * FROM collateral_lending_pledges WHERE borrower_character=$1 AND state='held' ORDER BY id LIMIT 2 FOR UPDATE", [victimId])).rows;
    if (rows.length > 1) fail('pledge_capacity');
    const receipts = [];
    for (const row of rows) {
      await checkRow(client, row);
      const debt = (await client.query('SELECT * FROM loans WHERE id=$1', [row.loan_id])).rows[0];
      if (row.borrower_account !== victim.account_id || (debt && !['repaid', 'collected'].includes(debt.status))) fail('estate_cash_debt_not_resolved');
      if (debt) sameDebt(row, debt);
      const released = await release(client, row, 'borrower_estate', 'estate-' + hash([row.id, victimId]), true);
      if ((await collectCollateralLendingPledgeIssues(client, row.id)).length) fail('estate_source');
      receipts.push(dto(released));
    }
    return receipts;
  } catch (error) { I.poisonItemTransaction(client, error); throw error; }
}
export async function collateralLendingBoard(pool, account) {
  id(account);
  return I.withItemRead(pool, async client => ({ pledges: (await client.query('SELECT * FROM collateral_lending_pledges WHERE borrower_account=$1 OR original_lender_account=$1 ORDER BY created_at DESC,id DESC LIMIT 25', [account])).rows.map(dto), limits: COLLATERAL_LENDING }));
}

/** Consumes only a private, consume-once proof minted inside the two actual canonical Loans terminal leaves. */
export async function recordCollateralLendingTerminal(client, token) {
  I.assertItemTransaction(client);
  try {
    if (typeof Loans.assertCollateralLendingTerminalProof !== 'function' || typeof Loans.getCollateralLendingTerminalVerifier !== 'function'
      || await Loans.getCollateralLendingTerminalVerifier() !== Loans.assertCollateralLendingTerminalProof) fail('terminal_integration_required');
    const proof = await Loans.assertCollateralLendingTerminalProof(client, token);
    const matches = (await client.query('SELECT * FROM collateral_lending_pledges WHERE loan_id=$1 FOR UPDATE', [proof.loan.id])).rows;
    if (!matches.length) return;
    if (matches.length !== 1 || dbCaps.skipLocked !== true) fail('native_terminal_required');
    const pledge = await checkRow(client, matches[0]);
    if (pledge.state !== 'held' || proof.borrower.id !== pledge.borrower_character || proof.borrower.account_id !== pledge.borrower_account
      || proof.loan.borrower_character !== proof.borrower.id || proof.loan.lender_character !== proof.holder.id
      || proof.holder.id === pledge.borrower_character || !['repaid', 'collected'].includes(proof.kind)) fail('terminal_source');
    sameDebt(pledge, proof.loan);
    await cashParty(client, proof.borrower.id, proof.borrower.account_id);
    await cashParty(client, proof.holder.id, proof.holder.account_id);
    await held(client, pledge);
    const loan = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [pledge.loan_id])).rows[0];
    sameDebt(pledge, loan);
    if (loan.status !== proof.kind || loan.lender_character !== proof.holder.id) fail('terminal_holder');
    const terminal = { pledge_id: pledge.id, loan_id: pledge.loan_id, borrower_character: pledge.borrower_character,
      holder_character: proof.holder.id, holder_account: proof.holder.account_id, kind: proof.kind,
      paid_cash: proof.paid, received_cash: proof.received, vig_cash: proof.vig,
      pay_journal: proof.payJournal, receive_journal: proof.receiveJournal, receipt: proof.receipt,
      created_at: await clock(client), mutation_key: 'collateral-lending-terminal:' + pledge.loan_id };
    terminal.source_hash = hash(collateralTerminalSource(terminal));
    const payload = JSON.parse(stable(collateralTerminalSource(terminal)));
    await I.withItemMutation(client, title(pledge.borrower_account), 'operation_action', terminal.mutation_key, payload, async () => {
      const columns = Object.keys(terminal), values = columns.map(column => column === 'receipt' ? JSON.stringify(terminal[column]) : terminal[column]);
      I.registerItemTransactionUndo(client, () => client.query('DELETE FROM collateral_lending_terminals WHERE pledge_id=$1', [pledge.id]));
      await client.query('INSERT INTO collateral_lending_terminals(' + columns.join(',') + ') VALUES(' + columns.map((_, index) => '$' + (index + 1)).join(',') + ')', values);
      return { ok: true, loanId: pledge.loan_id, kind: proof.kind, sourceHash: terminal.source_hash };
    });
    await verifyCollateralLendingTerminal(client, pledge);
    terminalFinalizations.set(proof.receipt, { client, transaction: I.itemTransactionIdentity(client), pledgeId: pledge.id,
      sourceHash: terminal.source_hash, kind: proof.kind, holderId: proof.holder.id, done: false,
      people: [proof.borrower, proof.holder].map(person => ({ id: person.id, account: person.account_id,
        cash: Number(person.cash), bank: Number(person.bank), inTransit: Number(person.bank_intransit || 0) })) });
  } catch (error) { I.poisonItemTransaction(client, error); throw error; }
}
// Fixed N24 leaves reuse the original quote and actual ordinary repayment/release path.
export const getCollateralAuctionOfferWitness = () => collateralLendingAuctionOfferWitness;
export const getCollateralAuctionRepayer = () => repayCollateralLendingForAuction;
export async function collateralLendingAuctionOfferWitness(client, account, terms, pair) {
  I.assertItemTransaction(client);
  const q = await lockedQuote(client, account, terms, pair);
  return { sourceHash: q.sourceHash, principal: Number(q.loan.principal), owed: loanOwed(q.loan.principal, q.loan.rate), offeredAt: date(q.loan.offered_at) };
}
export async function repayCollateralLendingForAuction(client, token) {
  I.assertItemTransaction(client);
  const Auction = await import('./collateralauction.js');
  const proof = await Auction.assertCollateralAuctionRepayment(client, token);
  const h = { ...proof.h, acct: proof.h.victimAcct, owned: proof.h.victimOwned,
    victimAcct: proof.h.acct, victimOwned: proof.h.owned, actorCh: proof.borrower, accountId: proof.borrower.account_id };
  return perform(client, proof.borrower.account_id, 'repay',
    { pledgeId: proof.pledgeId, sourceHash: proof.pledgeHash, consent: true }, proof.repaymentKey, proof.borrower, proof.holder, h);
}
async function finalizeTerminal(client, result) {
  const scope = result && terminalFinalizations.get(result);
  if (!scope) return;
  try {
    I.assertItemTransaction(client); I.assertItemTransactionHealthy(client);
    if (scope.done || scope.client !== client || scope.transaction !== I.itemTransactionIdentity(client)) fail('terminal_finalization_scope');
    const pledge = await checkRow(client, (await client.query('SELECT * FROM collateral_lending_pledges WHERE id=$1', [scope.pledgeId])).rows[0]);
    const terminal = await verifyCollateralLendingTerminal(client, pledge);
    const loan = (await client.query('SELECT * FROM loans WHERE id=$1', [pledge.loan_id])).rows[0];
    sameDebt(pledge, loan);
    if (terminal.source_hash !== scope.sourceHash || terminal.kind !== scope.kind || terminal.holder_character !== scope.holderId
      || stable(readJson(terminal.receipt)) !== stable(result) || loan.status !== scope.kind || loan.lender_character !== scope.holderId) fail('terminal_source');
    for (const person of scope.people) {
      await cashParty(client, person.id, person.account);
      const persisted = (await client.query('SELECT cash,bank,bank_intransit FROM characters WHERE id=$1', [person.id])).rows[0];
      if (Number(persisted.cash) !== person.cash || Number(persisted.bank) !== person.bank || Number(persisted.bank_intransit || 0) !== person.inTransit) fail('terminal_persistence');
    }
    if ((await collectCollateralLendingPledgeIssues(client, pledge.id)).length) fail('collateral_books');
    scope.done = true;
  } catch (error) { I.poisonItemTransaction(client, error); throw error; }
}
