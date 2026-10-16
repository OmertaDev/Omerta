import crypto from 'node:crypto';
import { collateralStable as stable, collateralHash as hash, collateralDate as date, collateralPledgeSource, collateralTerminalSource } from './collaterallending-schema.js';
import { loanOwed, loanVig } from './rules.js';

const fail = reason => { throw Object.assign(Error(reason), { code: 'collateral_lending_invariant' }); };
const json = value => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { fail('request_source'); } };
const mutationHash = (account, request) => crypto.createHash('sha256').update(JSON.stringify({ kind: 'operation_action', owner: { scope: 'account', id: account }, request })).digest('hex');
export function collateralPledgeQuoteHash(row) {
  return hash({ kind: 'collateral-lending-directed-offer-v1', loanId: row.loan_id, principal: Number(row.principal),
    rate: Number(row.rate), hours: Number(row.hours), offeredAt: date(row.offered_at), borrowerAccount: row.borrower_account,
    borrowerCharacter: row.borrower_character, lenderAccount: row.original_lender_account, lenderCharacter: row.original_lender_character,
    item: { itemId: row.item_id, birthEvent: row.birth_event, birthMutation: row.birth_mutation,
      condition: Number(row.initial_condition), conditionRevision: Number(row.initial_condition_revision) } });
}
async function custodyEvent(client, row, eventId, kind, mutationKey, request) {
  const event = (await client.query('SELECT * FROM item_events WHERE id=$1', [eventId])).rows[0];
  if (!event || event.item_id !== row.item_id || event.template_id !== 'item:precision_lock_tool' || event.quality !== 'standard'
    || event.event_kind !== kind || event.idempotency_key !== mutationKey) fail('custody_event');
  const from = kind === 'escrowed' ? ['account', row.borrower_account] : ['operation', row.id];
  const to = kind === 'escrowed' ? ['operation', row.id] : ['account', row.borrower_account];
  if (event.from_owner_scope !== from[0] || event.from_owner_id !== from[1] || event.to_owner_scope !== to[0] || event.to_owner_id !== to[1]
    || event.provenance_kind !== (kind === 'escrowed' ? 'used_in_operation' : 'transferred')) fail('custody_event');
  const guard = (await client.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1', [mutationKey])).rows[0];
  const result = json(guard?.result_json);
  if (!guard?.completed_at || guard.envelope_version !== 1 || guard.owner_scope !== 'account' || guard.owner_id !== row.borrower_account
    || guard.mutation_kind !== 'operation_action' || guard.request_hash !== mutationHash(row.borrower_account, request)
    || result?.id !== row.item_id || result.templateId !== 'item:precision_lock_tool' || result.owner?.scope !== to[0]
    || result.owner.id !== to[1] || result.state !== (kind === 'escrowed' ? 'escrowed' : 'active')) fail('custody_guard');
}
function normalRequest(request, row) {
  const body = json(request.request_json), receipt = json(request.receipt);
  const keys = request.action === 'pledge' ? ['consent', 'itemId', 'loanId', 'sourceHash'] : ['consent', 'pledgeId', 'sourceHash'];
  if (!body || Array.isArray(body) || Object.keys(body).sort().join(',') !== keys.join(',') || body.consent !== true
    || request.account_id !== row.borrower_account || request.account_ref !== row.borrower_account
    || request.original_character !== row.borrower_character || request.pledge_id !== row.id
    || request.body_hash !== hash([request.action, body]) || receipt?.ok !== true || receipt.pledge?.pledgeId !== row.id
    || receipt.pledge.sourceHash !== row.source_hash || receipt.pledge.loanId !== row.loan_id || receipt.pledge.itemId !== row.item_id
    || receipt.pledge.principal !== Number(row.principal) || receipt.pledge.liquidationAvailable !== false
    || receipt.pledge.collateralTitle !== 'original_borrower_account') fail('request_source');
  const expectedPledge = { pledgeId: row.id, sourceHash: row.source_hash, loanId: row.loan_id, itemId: row.item_id,
    state: request.action === 'pledge' ? 'held' : 'released', principal: Number(row.principal), owed: loanOwed(row.principal, row.rate),
    dueAt: date(row.due_at), collateralTitle: 'original_borrower_account', liquidationAvailable: false };
  if (stable(receipt.pledge) !== stable(expectedPledge)
    || Object.keys(receipt).sort().join(',') !== (request.action === 'release' ? 'ok,pledge' : 'loan,ok,pledge')) fail('request_source');
  if (request.action === 'pledge') {
    if (request.run_id !== row.id || body.loanId !== row.loan_id || body.itemId !== row.item_id
      || body.sourceHash !== collateralPledgeQuoteHash(row) || receipt.pledge.state !== 'held'
      || receipt.loan?.principal !== Number(row.principal) || receipt.loan?.owed !== loanOwed(row.principal, row.rate)
      || receipt.loan.ok !== true || receipt.loan.collateral !== false || receipt.loan.pledgedOmr !== 0
      || !Number.isInteger(receipt.loan.dueSeconds) || receipt.loan.dueSeconds < 0 || receipt.loan.dueSeconds > Number(row.hours) * 3600
      || Object.keys(receipt.loan).sort().join(',') !== 'collateral,dueSeconds,ok,owed,pledgedOmr,principal') fail('pledge_consent');
  } else if (!['repay', 'release'].includes(request.action) || body.pledgeId !== row.id || body.sourceHash !== row.source_hash
    || receipt.pledge.state !== 'released') fail('release_consent');
  if (request.action === 'repay') {
    const paid = loanOwed(row.principal, row.rate), vig = loanVig(paid);
    if (stable(receipt.loan) !== stable({ ok: true, paid, toLender: paid - vig, vig, pledgeReturned: 0 })) fail('repayment_source');
  }
  return { body, receipt };
}
export async function verifyCollateralLendingTerminal(client, pledge) {
  const terminal = (await client.query('SELECT * FROM collateral_lending_terminals WHERE pledge_id=$1', [pledge.id])).rows[0];
  if (!terminal || terminal.loan_id !== pledge.loan_id || terminal.borrower_character !== pledge.borrower_character
    || terminal.source_hash !== hash(collateralTerminalSource(terminal)) || !['repaid', 'collected'].includes(terminal.kind)
    || +new Date(terminal.created_at) < +new Date(pledge.created_at)) fail('terminal_source');
  const holder = (await client.query('SELECT account_id FROM characters WHERE id=$1', [terminal.holder_character])).rows[0];
  if (holder?.account_id !== terminal.holder_account || terminal.holder_character === pledge.borrower_character) fail('terminal_holder');
  const paid = Number(terminal.paid_cash), received = Number(terminal.received_cash), vig = Number(terminal.vig_cash), owed = loanOwed(pledge.principal, pledge.rate);
  const receipt = json(terminal.receipt);
  if (!Number.isSafeInteger(paid) || paid < 0 || paid > owed || vig !== loanVig(paid) || received !== paid - vig
    || receipt?.ok !== true || receipt.toLender !== received || receipt.vig !== vig) fail('terminal_amount');
  if (terminal.kind === 'repaid') {
    if (paid !== owed || receipt.paid !== owed || receipt.pledgeReturned !== 0) fail('terminal_amount');
  } else if (receipt.seized !== paid || receipt.shortfall !== owed - paid || receipt.carSeized !== null
    || receipt.omrSeized !== 0 || receipt.wanted !== true) fail('terminal_amount');
  if (paid) {
    if (!terminal.pay_journal || !terminal.receive_journal || terminal.pay_journal === terminal.receive_journal) fail('terminal_journals');
    const journals = (await client.query('SELECT * FROM transactions WHERE id=$1 OR id=$2', [terminal.pay_journal, terminal.receive_journal])).rows;
    const reason = terminal.kind === 'repaid' ? 'loan:repay' : 'loan:collect';
    for (const [journalId, character, counterparty, amount] of [[terminal.pay_journal, pledge.borrower_character, terminal.holder_character, -paid],
      [terminal.receive_journal, terminal.holder_character, pledge.borrower_character, received]]) {
      const row = journals.find(value => value.id === journalId);
      if (!row || row.character_id !== character || row.account_id !== null || row.currency !== 'cash' || row.reason !== reason
        || row.counterparty !== counterparty || Number(row.amount) !== amount || +new Date(row.at) < +new Date(pledge.created_at)
        || +new Date(row.at) > +new Date(terminal.created_at)) fail('terminal_journals');
    }
    if (journals.length !== 2) fail('terminal_journals');
  } else if (terminal.pay_journal !== null || terminal.receive_journal !== null) fail('terminal_journals');
  const payload = JSON.parse(stable(collateralTerminalSource(terminal)));
  const guard = (await client.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1', [terminal.mutation_key])).rows[0];
  if (terminal.mutation_key !== 'collateral-lending-terminal:' + pledge.loan_id || guard?.owner_scope !== 'account'
    || guard.owner_id !== pledge.borrower_account || guard.mutation_kind !== 'operation_action' || guard.envelope_version !== 1
    || !guard.completed_at || guard.request_hash !== mutationHash(pledge.borrower_account, payload)
    || stable(json(guard.result_json)) !== stable({ ok: true, loanId: pledge.loan_id, kind: terminal.kind, sourceHash: terminal.source_hash })) fail('terminal_guard');
  return terminal;
}

async function audit(client, rows, requests) {
  const issues = [];
  for (const row of rows) {
    try {
      if (row.source_hash !== hash(collateralPledgeSource(row)) || row.borrower_account === row.original_lender_account
        || row.borrower_character === row.original_lender_character) fail('pledge_source');
      const borrower = (await client.query('SELECT account_id,alive FROM characters WHERE id=$1', [row.borrower_character])).rows[0];
      const lender = (await client.query('SELECT account_id FROM characters WHERE id=$1', [row.original_lender_character])).rows[0];
      if (borrower?.account_id !== row.borrower_account || lender?.account_id !== row.original_lender_account) fail('original_identity');
      const birth = (await client.query('SELECT * FROM item_events WHERE id=$1', [row.birth_event])).rows[0];
      if (!birth || birth.item_id !== row.item_id || birth.template_id !== 'item:precision_lock_tool' || birth.quality !== 'standard'
        || birth.event_kind !== 'created' || birth.provenance_kind !== 'crafted' || birth.idempotency_key !== row.birth_mutation) fail('birth_source');
      const take = (await client.query('SELECT * FROM transactions WHERE id=$1', [row.take_journal])).rows[0];
      if (!take || take.character_id !== row.borrower_character || take.account_id !== null || take.currency !== 'cash'
        || take.reason !== 'loan:take' || take.counterparty !== row.original_lender_character || Number(take.amount) !== Number(row.principal)
        || +new Date(take.at) < +new Date(row.offered_at) || +new Date(take.at) > +new Date(row.created_at)) fail('take_witness');
      const loan = (await client.query('SELECT * FROM loans WHERE id=$1', [row.loan_id])).rows[0];
      if (loan && (loan.borrower_character !== row.borrower_character || loan.offered_to !== row.borrower_character
        || Number(loan.principal) !== Number(row.principal) || Number(loan.rate) !== Number(row.rate) || Number(loan.hours) !== Number(row.hours)
        || date(loan.offered_at) !== date(row.offered_at) || date(loan.due_at) !== date(row.due_at)
        || loan.collateral_car || Number(loan.collateral_min) !== 0 || Number(loan.collateral_omr) !== 0
        || !['active', 'repaid', 'collected'].includes(loan.status))) fail('loan_source');
      if (loan?.status === 'active') {
        const holder = (await client.query('SELECT account_id,alive,is_npc FROM characters WHERE id=$1', [loan.lender_character])).rows[0];
        if (!holder?.alive || holder.is_npc || holder.account_id === row.borrower_account) fail('loan_holder');
      }
      const terminalRows = (await client.query('SELECT pledge_id FROM collateral_lending_terminals WHERE pledge_id=$1', [row.id])).rows;
      if (loan && ['repaid', 'collected'].includes(loan.status)) {
        const terminal = await verifyCollateralLendingTerminal(client, row);
        if (terminal.kind !== loan.status || terminal.holder_character !== loan.lender_character) fail('terminal_holder');
      } else if (terminalRows.length) {
        if (row.state !== 'estate_released') fail('terminal_source');
        await verifyCollateralLendingTerminal(client, row);
      }
      const actions = requests.filter(request => request.pledge_id === row.id);
      const pledges = actions.filter(request => request.action === 'pledge');
      if (pledges.length !== 1) fail('pledge_consent');
      for (const request of actions) normalRequest(request, row);
      await custodyEvent(client, row, row.escrow_event, 'escrowed', 'collateral-lending:' + row.id + ':pledge',
        { pledgeId: row.id, loanId: row.loan_id, itemId: row.item_id });
      const item = (await client.query('SELECT * FROM item_instances WHERE id=$1', [row.item_id])).rows[0];
      if (!item || item.template_id !== 'item:precision_lock_tool' || item.definition_hash !== null) fail('item_source');
      if (row.state === 'held') {
        if (!loan || !borrower.alive || row.released_at !== null || row.release_event !== null || row.release_kind !== null) fail('held_debt');
        const custody = (await client.query('SELECT * FROM operation_escrow WHERE item_id=$1', [row.item_id])).rows[0];
        if (item.owner_scope !== 'operation' || item.owner_id !== row.id || item.state !== 'escrowed' || custody?.operation_id !== row.id
          || custody.depositor_scope !== 'account' || custody.depositor_id !== row.borrower_account) fail('collateral_custody');
        const condition = (await client.query('SELECT * FROM item_durability_states WHERE item_id=$1', [row.item_id])).rows[0];
        if (Number(condition?.remaining ?? 100) !== Number(row.initial_condition)
          || Number(condition?.revision || 0) !== Number(row.initial_condition_revision)
          || (condition && condition.creation_event !== row.birth_event)) fail('collateral_condition');
        if (actions.length !== 1) fail('release_consent');
      } else {
        let run;
        if (row.state === 'released') {
          const releases = actions.filter(request => ['repay', 'release'].includes(request.action));
          if (!loan || !['repaid', 'collected'].includes(loan.status) || row.release_kind !== loan.status || releases.length !== 1) fail('terminal_debt');
          run = releases[0].run_id;
        } else if (row.state === 'estate_released') {
          if (borrower.alive || (loan && !['repaid', 'collected'].includes(loan.status)) || row.release_kind !== 'borrower_estate' || actions.length !== 1) fail('estate_source');
          run = 'estate-' + hash([row.id, row.borrower_character]);
        } else fail('state');
        if (!row.released_at || !row.release_event) fail('release_source');
        await custodyEvent(client, row, row.release_event, 'released', 'collateral-lending:' + run + ':release',
          { pledgeId: row.id, loanId: row.loan_id, itemId: row.item_id, kind: row.release_kind });
        // Current account-title disposal or a later unrelated canonical escrow must not rewrite this historical release.
      }
    } catch (error) {
      if (error.code !== 'collateral_lending_invariant') throw error;
      issues.push({ id: row.id, reason: error.message });
    }
  }
  for (const request of requests) {
    try {
      const row = rows.find(value => value.id === request.pledge_id);
      if (!row) fail('orphan_request');
      normalRequest(request, row);
    } catch (error) {
      if (error.code !== 'collateral_lending_invariant') throw error;
      issues.push({ id: request.run_id, reason: error.message });
    }
  }
  return issues;
}
export async function collectCollateralLendingIssues(client) {
  const rows = (await client.query('SELECT * FROM collateral_lending_pledges ORDER BY id')).rows;
  const issues = await audit(client, rows, (await client.query('SELECT * FROM collateral_lending_requests ORDER BY account_id,request_key')).rows);
  for (const terminal of (await client.query('SELECT pledge_id,loan_id FROM collateral_lending_terminals ORDER BY pledge_id')).rows) {
    if (!rows.some(row => row.id === terminal.pledge_id && row.loan_id === terminal.loan_id)) issues.push({ id: terminal.pledge_id, reason: 'orphan_terminal' });
  }
  return issues;
}
/** Local finalization uses only its already-locked source; the global book never applies this filter. */
export async function collectCollateralLendingPledgeIssues(client, pledgeId) {
  const rows = (await client.query('SELECT * FROM collateral_lending_pledges WHERE id=$1', [pledgeId])).rows;
  if (rows.length !== 1) return [{ id: pledgeId, reason: 'pledge_source' }];
  return audit(client, rows, (await client.query('SELECT * FROM collateral_lending_requests WHERE pledge_id=$1 ORDER BY account_id,request_key', [pledgeId])).rows);
}
