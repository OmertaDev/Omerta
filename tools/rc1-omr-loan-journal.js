// Focused read-only loan collateral lineage; never adjusts balances or infers a
// movement from aggregate drift. Other currencies are retained but not classified.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { OMR_TABLES, omrUnits, omrText, omrBuckets, omrRequestHash, OMR_SCALE } from './rc1-omr-journal.js';
import { LOAN, M3, paperTake } from '../src/rules.js';
export const OMR_LOAN_TABLES = [...OMR_TABLES, 'kill_log', 'notifications', 'searches'];
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const index = (rows, key = row => row.id) => { const result = new Map(); for (const row of rows) {
  const id = key(row); assert(!result.has(id), `Duplicate identity ${id}`); result.set(id, row); } return result; };
const requestKey = row => `${row.account_id}/${row.key}`;
const added = (before, after, key) => { const old = index(before, key), now = index(after, key);
  for (const [id, row] of old) assert.deepEqual(now.get(id), row, `Missing/rewritten immutable receipt ${id}`);
  return after.filter(row => !old.has((key || (item => item.id))(row))); };
export async function snapshotOmrLoans(pool) {
  const client = await pool.connect();
  try { await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const state = {};
    for (const table of OMR_LOAN_TABLES) state[table] = (await client.query(`SELECT * FROM ${table}`)).rows
      .map(row => JSON.parse(JSON.stringify(row))).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    await client.query('COMMIT'); return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export const omrLoanCustodyHash = state => hash({ buckets: omrBuckets(state), loans: state.loans, transactions: state.transactions,
  idempotency: state.idempotency, kill_log: state.kill_log, characters: state.characters.map(row => ({ id: row.id,
    account_id: row.account_id, alive: row.alive, cash: row.cash, bank: row.bank, ammo: row.ammo })) });
export const OMR_LOAN_EXCLUSIONS = ['Full cash, ammo, death and Wanted ecology (canonical invariants checked separately)',
  'No-heir lender fallback: runEstate always creates an heir', 'House loans, car collateral, loan/paper races against death or grace sweep',
  'Natural entry, rat/protection acquisition and combat equipment progression', 'Unrelated OMR mint, reward, auction, Family and external backing',
  'Literal wall time, browser/network/deployed or simulation matrix coverage'];
export function reconcileOmrLoans(before, after, { commands = [], logicalAt, worker = false } = {}) {
  assert(Number.isSafeInteger(logicalAt));
  const receipts = added(before.transactions, after.transactions), durable = added(before.idempotency, after.idempotency, requestKey);
  const kills = added(before.kill_log, after.kill_log), oldCharacters = index(before.characters), characters = index(after.characters);
  const oldLoans = index(before.loans), loans = index(after.loans), oldAccounts = index(before.account_persistent, row => row.account_id);
  assert.deepEqual([...oldAccounts.keys()].sort(), after.account_persistent.map(row => row.account_id).sort(), 'Account ownership set changed');
  for (const [id, row] of oldCharacters) { assert(characters.has(id)); assert.equal(characters.get(id).account_id, row.account_id); }
  const requests = [], stored = index(after.idempotency, requestKey);
  for (const row of durable) {
    const command = commands.find(item => item.status === 200 && item.accountId === row.account_id && item.key === row.key && omrRequestHash(item) === row.body_hash);
    assert(command, 'New durable receipt lacks observed route/body/owner'); assert.equal(row.status, 200);
    const response = JSON.parse(row.response); assert.deepEqual(response, command.body); requests.push({ command, response, row });
  }
  for (const command of commands.filter(item => item.status === 200 && item.key)) {
    const row = stored.get(`${command.accountId}/${command.key}`); assert(row && row.body_hash === omrRequestHash(command));
    assert.deepEqual(JSON.parse(row.response), command.body, 'Durable retry body mismatch');
  }
  const request = (url, owner) => {
    const matches = requests.filter(item => item.command.url === url && (!owner || item.command.accountId === owner));
    assert.equal(matches.length, 1, `Missing/duplicate canonical request ${url}`); return matches[0];
  };
  const owner = id => { const row = oldCharacters.get(id) || characters.get(id); assert(row && oldAccounts.has(row.account_id), `Unknown owner ${id}`); return row.account_id; };
  const account = id => `account_persistent/${id}/omr`, escrow = id => `loans/${id}/collateral_omr`;
  const changes = new Map(), lineage = [], statuses = [], used = new Set();
  const receipt = (reason, accountId, amount, counterparty) => {
    const matches = receipts.filter(row => row.currency === 'omr' && row.reason === reason && row.account_id === accountId
      && row.character_id === null && row.counterparty === counterparty && omrUnits(row.amount) === amount && !used.has(row.id));
    assert(matches.length, `Missing exact ${reason} receipt for ${accountId}`); const row = matches[0]; used.add(row.id); return row.id;
  };
  const move = (from, to, amount, authority) => { assert(amount > 0n); changes.set(from, (changes.get(from) || 0n) - amount);
    changes.set(to, (changes.get(to) || 0n) + amount); lineage.push({ from, to, omr: omrText(amount), units: String(amount), authority }); };
  const deaths = new Map();
  for (const prior of before.characters.filter(row => row.alive && characters.get(row.id)?.alive === false)) {
    const heirs = after.characters.filter(row => row.alive && row.account_id === prior.account_id && !oldCharacters.has(row.id));
    assert.equal(heirs.length, 1); assert.equal(heirs[0].generation, prior.generation + 1);
    const fire = requests.find(item => item.command.url === `/v1/streets/${prior.id}/fire` && item.response.kill);
    const mod = commands.find(item => item.url === '/v1/mod/kill' && item.status === 200 && item.payload.characterId === prior.id);
    assert(Boolean(fire) !== Boolean(mod), 'Death lacks exactly one supported canonical authority');
    let killer = null;
    if (fire) {
      killer = oldCharacters.get(fire.response.character.id); assert(killer?.alive); assert.equal(killer.account_id, fire.command.accountId);
      assert.equal(fire.response.estate.heirId, heirs[0].id);
      assert.equal(kills.filter(row => row.killer_account === killer.account_id && row.victim_account === prior.account_id).length, 1);
    } else assert.equal(mod.body.heirId, heirs[0].id);
    // This bounded fixture leaves no liquid/unbonding/staked OMR on a victim.
    // That excludes rather than silently reclassifies duty and other estate loot.
    for (const field of ['omr', 'unbonding', 'staked']) assert.equal(omrUnits(oldAccounts.get(prior.account_id)[field]), 0n, `Unsupported estate ${field}`);
    deaths.set(prior.id, { victim: prior.id, accountId: prior.account_id, heir: heirs[0].id, killer: killer?.id || null,
      source: fire ? requestKey(fire.row) : 'observed privileged mod request; no durable idempotency contract' });
  }
  for (const [id, loan] of loans) if (!oldLoans.has(id)) {
    const r = request('/v1/loans', owner(loan.lender_character)); assert.equal(r.response.id, id); assert.equal(loan.status, 'open');
    for (const [field, input] of [['principal', 'amount'], ['rate', 'rate'], ['hours', 'hours'], ['collateral_omr', 'collateralOmr']])
      assert.equal(String(loan[field]), String(r.command.payload[input]));
    assert.equal(loan.offered_to, r.command.payload.to); assert.equal(loan.borrower_character, null);
    statuses.push({ kind: 'offer', id, request: requestKey(r.row) });
  }
  for (const [id, prior] of oldLoans) {
    const current = loans.get(id), amount = omrUnits(prior.collateral_omr);
    if (current) {
      const mutable = new Set(['lender_character', 'for_sale', 'status']);
      if (prior.status === 'open' && current.status === 'active') for (const key of ['borrower_character', 'due_at', 'collateral_car']) mutable.add(key);
      for (const field of new Set([...Object.keys(prior), ...Object.keys(current)])) if (!mutable.has(field))
        assert.deepEqual(current[field], prior[field], `Unsupported loan row rewrite ${id}/${field}`);
    }
    if (current) for (const field of ['id', 'principal', 'rate', 'hours', 'collateral_min', 'collateral_omr', 'offered_to', 'created_at'])
      assert.deepEqual(current[field], prior[field], `Loan terms rewritten ${id}/${field}`);
    if (current && prior.status !== 'open') for (const field of ['borrower_character', 'due_at', 'collateral_car'])
      assert.deepEqual(current[field], prior[field], `Active loan authority rewritten ${id}/${field}`);
    if (!current) {
      assert.equal(prior.status, 'active'); const death = deaths.get(prior.borrower_character); assert(death, 'Loan disappeared without supported borrower estate');
      const loot = death.killer ? (amount / OMR_SCALE * BigInt(Math.round(M3.OMR_LOOT_IDLE * 10000)) / 10000n) * OMR_SCALE : 0n;
      const authority = { loan: id, death, matching: 'Exact reason/account/counterparty/amount multiset within boundary; ledger has no loan-id FK' };
      if (loot) move(escrow(id), account(owner(death.killer)), loot, { ...authority, receipt: receipt('loan:pledge:loot', owner(death.killer), loot, prior.borrower_character) });
      if (amount - loot) move(escrow(id), account(owner(prior.lender_character)), amount - loot,
        { ...authority, receipt: receipt('loan:seize:omr', owner(prior.lender_character), amount - loot, prior.borrower_character) });
      statuses.push({ kind: 'borrower-death', id, ...death }); continue;
    }
    if (prior.lender_character !== current.lender_character) {
      assert.equal(prior.status, 'active'); assert.equal(current.status, 'active');
      const death = deaths.get(prior.lender_character);
      if (death) {
        assert.equal(current.lender_character, death.heir); assert.equal(current.for_sale, prior.for_sale);
        const notices = after.notifications.filter(row => !before.notifications.some(old => old.id === row.id)
          && row.character_id === prior.borrower_character && row.type === 'loan_inherited');
        assert.equal(notices.length, 1); statuses.push({ kind: 'lender-inheritance', id, death, notification: notices[0].id });
      } else {
        const r = request(`/v1/loans/${id}/buy`, owner(current.lender_character)); assert(prior.for_sale !== null); assert.equal(current.for_sale, null);
        const price = BigInt(prior.for_sale), take = BigInt(paperTake(Number(price))), net = price - take;
        assert.equal(BigInt(r.response.price), price); assert.equal(BigInt(r.response.take), take); assert.equal(BigInt(r.response.toSeller), net);
        const paper = receipts.filter(row => row.currency === 'cash' && row.reason === 'loan:paper'); assert.equal(paper.length, 3);
        for (const [character, counterparty, value] of [[current.lender_character, prior.lender_character, -price], [prior.lender_character, current.lender_character, net], [null, null, -take]])
          assert.equal(paper.filter(row => row.character_id === character && row.counterparty === counterparty && BigInt(row.amount) === value).length, 1);
        for (const [character, value] of [[current.lender_character, -price], [prior.lender_character, net]])
          assert.equal(BigInt(characters.get(character).cash) - BigInt(oldCharacters.get(character).cash), value);
        assert.equal(BigInt(after.street_tax[0].pool) - BigInt(before.street_tax[0].pool), take);
        statuses.push({ kind: 'paper-sale', id, from: prior.lender_character, to: current.lender_character, price: String(price), take: String(take), request: requestKey(r.row) });
      }
    } else if (prior.for_sale !== current.for_sale) {
      const r = request(`/v1/loans/${id}/${current.for_sale === null ? 'unsell' : 'sell'}`, owner(prior.lender_character));
      if (current.for_sale !== null) assert.equal(String(current.for_sale), String(r.command.payload.price));
      statuses.push({ kind: 'paper-listing', id, request: requestKey(r.row) });
    }
    if (prior.status === current.status) continue;
    const borrower = owner(current.borrower_character), lender = owner(current.lender_character);
    if (prior.status === 'open' && current.status === 'active') {
      const r = request(`/v1/loans/${id}/take`, borrower); assert.equal(current.lender_character, prior.lender_character);
      assert.equal(Date.parse(current.due_at), logicalAt + current.hours * 3600000); assert.equal(omrUnits(r.response.pledgedOmr), amount);
      if (amount) move(account(borrower), escrow(id), amount, { loan: id, request: requestKey(r.row), receipt: receipt('loan:pledge', borrower, -amount, current.lender_character) });
    } else if (prior.status === 'active' && current.status === 'repaid') {
      const r = request(`/v1/loans/${id}/repay`, borrower); assert.equal(omrUnits(r.response.pledgeReturned), amount);
      if (amount) move(escrow(id), account(borrower), amount, { loan: id, request: requestKey(r.row), receipt: receipt('loan:pledge:return', borrower, amount, prior.lender_character) });
    } else if (prior.status === 'active' && current.status === 'collected') {
      const r = requests.find(item => item.command.url === `/v1/loans/${id}/collect` && item.command.accountId === lender);
      if (r) { assert(logicalAt >= Date.parse(prior.due_at), 'Manual collection before due'); assert.equal(omrUnits(r.response.omrSeized), amount); }
      else {
        assert(worker, 'Collection lacks canonical command or observed original sweep'); assert(logicalAt > Date.parse(prior.due_at) + LOAN.GRACE_MS, 'Grace requires strict past-due equality');
        for (const character of [prior.lender_character, prior.borrower_character]) assert.equal(after.notifications.filter(row => !before.notifications.some(old => old.id === row.id)
          && row.character_id === character && row.type === 'loan_forfeited' && omrUnits(row.payload.omr) === amount).length, 1);
      }
      if (amount) move(escrow(id), account(lender), amount, { loan: id, mode: r ? 'manual-due' : 'original-worker-grace',
        dueAt: prior.due_at, logicalAt, request: r ? requestKey(r.row) : null, receipt: receipt('loan:seize:omr', lender, amount, prior.borrower_character) });
    } else assert.fail(`Unsupported loan terminal ${prior.status}->${current.status}`);
  }
  for (const row of receipts.filter(row => row.currency === 'omr')) assert(used.has(row.id), `Unsupported/unexplained OMR receipt ${row.reason}`);
  const oldBuckets = index(omrBuckets(before), row => row.key), buckets = index(omrBuckets(after), row => row.key), equations = [];
  for (const key of new Set([...oldBuckets.keys(), ...buckets.keys(), ...changes.keys()])) {
    const initial = omrUnits(oldBuckets.get(key)?.amount || 0), final = omrUnits(buckets.get(key)?.amount || 0), delta = changes.get(key) || 0n;
    assert.equal(final, initial + delta, `Unexplained exact owner/custody movement ${key}`); assert(final >= 0n);
    equations.push({ key, before: omrText(initial), change: omrText(delta), after: omrText(final) });
  }
  return { version: 1, scope: 'Exact OMR loan collateral and paper-sale cash subset', lineage, statuses, equations,
    receiptIds: [...used], deaths: [...deaths.values()], unknown: OMR_LOAN_EXCLUSIONS, fullResourceCoverage: false };
}
