import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { observedPool } from './collateralauction-fixture.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';

// Separate historical-fixture phase, not a fresh-fixture guard exception. These
// exact receipts preserve genuinely consented, funded one-hour predecessor loans.
const inheritedSource = '8b5879ffb640d704723bf31fae3ac13b26fd3e7e';
const preservedHash = '8918a67b95eb9ef4d66102b153d7e820d621b8cbd1181a423ad22b3881d15158';
const completedPriorHash = '34a73cc336bf8c843b450f69a0d3d7c566680e99f1d88c7f85f67cd400f7d47f';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
assert.deepEqual(process.argv.slice(2), ['--postgres', '--inherited-default']);
assert(!process.env.DATABASE_URL && !process.env.NODE_OPTIONS && !process.env.NODE_PATH);
assert(!Object.keys(process.env).some(key => /^PG[A-Z_]/.test(key) && process.env[key]));
const readProof = (file, expected) => {
  assert(path.isAbsolute(file)); const bytes = fs.readFileSync(file); assert.equal(hash(bytes), expected); return JSON.parse(bytes);
};
const preserved = readProof(process.env.COLLATERAL_AUCTION_INHERITED_PROOF_PATH, preservedHash);
const prior = readProof(process.env.COLLATERAL_AUCTION_PRIOR_PHASE_RESULT_PATH, completedPriorHash);
assert.equal(prior.source, inheritedSource); assert.equal(prior.status, 1); assert.deepEqual(prior.sessions, []);
// This exact predecessor is retained as a partial FAIL at the native outer-join
// estate lock. The separately preserved pre-default source rows remain genuine;
// this successor must prove the repaired effects instead of promoting that FAIL.
assert.equal(prior.database, preserved.originalSourceDatabase); assert.equal(preserved.source, inheritedSource);
assert.equal(preserved.sourceDatabase, 'collateral_auction_test_fe12c2d63aea');
assert.equal(preserved.ancestorReceiptSha256, '2bf77650070782a3cc1a6abc223b52b97b29bd86d06742e7bae2bc6b302dfa8d');
assert.equal(preserved.cloneCreated, true); assert.deepEqual(preserved.naturalSessions, []); assert.deepEqual(preserved.precloneSessions, []);
assert.deepEqual(preserved.finalSessions, []); assert.equal(preserved.cloneGameplayProbes, 0);
assert.match(preserved.cloneDatabase, /^collateral_auction_test_[a-f0-9]{12}$/);
const endpoint = 'postgres://pilot_runner@127.0.0.1:35439/' + preserved.cloneDatabase;
assert.equal(process.env.COLLATERAL_AUCTION_TEST_DATABASE_URL, endpoint);
const proofDirectory = process.env.COLLATERAL_AUCTION_FINALACK_PROOFS;
assert(path.isAbsolute(proofDirectory)); fs.mkdirSync(proofDirectory);
const pg = (await import('pg')).default, pre = new pg.Pool({ connectionString: endpoint, max: 1 });
try {
  const identity = (await pre.query(`SELECT current_user AS role,current_database() AS database,
    pg_get_userbyid(datdba) AS owner,current_setting('server_version') AS version,
    current_setting('data_directory') AS directory FROM pg_database WHERE datname=current_database()`)).rows[0];
  assert.equal(identity.role, 'pilot_runner'); assert.equal(identity.owner, 'pilot_runner'); assert.equal(identity.database, preserved.cloneDatabase);
  assert.match(identity.version, /^18\.4\b/); assert.equal(identity.directory.replaceAll('\\', '/').toLowerCase(),
    'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184');
  const actual = await canonicalDatabaseSnapshot(pre); assert.equal(actual.stateSha256, preserved.stateSha256);
  assert.equal(Object.keys(actual.tables).length, preserved.tables); assert.deepEqual(actual.sequences, preserved.sequenceValues);
  fs.writeFileSync(path.join(proofDirectory, 'inherited-admission.json'), JSON.stringify({ identity, preservedHash, completedPriorHash, actual }, null, 2) + '\n');
} finally { await pre.end(); }
process.env.DATABASE_URL = endpoint;
Object.assign(process.env, { RESOURCE_ECONOMY: 'off', RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'off', DEPOT_PILOT: 'on',
  LEGAL_PROFILE_DEFER: 'on', JWT_SECRET: 'equipment-collateral-fixture-only', MOD_KEY: 'equipment-collateral-fixture-only', MARKET_SEED: 'equipment-collateral-fixture-only' });
const { buildServer } = await import('./server-fixture.js'), app = await buildServer(), pool = app.pool;
const Auction = await import('../src/collateralauction.js'), Lending = await import('../src/collaterallending-invariants.js');
const Books = await import('../src/collateralauction-invariants.js'), G = await import('../src/game.js');
let serial = 0;
const key = label => 'N24-finalack-' + label + '-' + ++serial;
const snapshot = async label => {
  const value = await canonicalDatabaseSnapshot(pool); fs.writeFileSync(path.join(proofDirectory, label + '.json'), JSON.stringify(value, null, 2) + '\n'); return value;
};
const books = async () => {
  assert.deepEqual(await Lending.collectCollateralLendingIssues(pool), []); assert.deepEqual(await Books.collectCollateralAuctionIssues(pool), []);
  assert.deepEqual((await (await import('../src/invariants.js')).runLedgerInvariants(pool, { alert: false })).checks.filter(check => !check.ok), []);
};
try {
  assert.equal((await Auction.collateralAuctionAvailability()).available, true);
  const AS = await import('../src/collateralauction-schema.js'), CS = await import('../src/collaterallending-schema.js');
  const inheritedHashes = [];
  for (const row of (await pool.query('SELECT * FROM collateral_auction_agreements ORDER BY id')).rows) {
    assert.equal(AS.auctionHash(AS.collateralAuctionTermsSource(row)), row.source_hash); inheritedHashes.push({ kind: 'agreement', id: row.id, sourceHash: row.source_hash });
    const p = (await pool.query('SELECT * FROM collateral_lending_pledges WHERE loan_id=$1', [row.loan_id])).rows[0];
    assert.equal(Lending.collateralPledgeQuoteHash(p), row.quote_hash, 'The exact original directed-loan/UID quote remains valid without runtime aliases');
  }
  for (const row of (await pool.query('SELECT * FROM collateral_lending_pledges ORDER BY id')).rows) {
    assert.equal(CS.collateralHash(CS.collateralPledgeSource(row)), row.source_hash); inheritedHashes.push({ kind: 'pledge', id: row.id, sourceHash: row.source_hash });
  }
  fs.writeFileSync(path.join(proofDirectory, 'unchanged-inherited-source-hashes.json'), JSON.stringify(inheritedHashes, null, 2) + '\n');
  const original = preserved.primed.loans.find(loan => loan.label === 'sale');
  const agreement = (await pool.query('SELECT * FROM collateral_auction_agreements WHERE loan_id=$1', [original.loanId])).rows[0];
  const debt = (await pool.query('SELECT * FROM loans WHERE id=$1', [original.loanId])).rows[0];
  assert.equal(debt.status, 'active'); assert.equal(new Date(debt.due_at).toISOString(), original.dueAt);
  assert(+new Date((await pool.query('SELECT clock_timestamp() AS now')).rows[0].now) >= +new Date(original.dueAt));
  const lender = (await pool.query('SELECT id,account_id FROM characters WHERE id=$1', [debt.lender_character])).rows[0];
  const borrower = (await pool.query('SELECT id,account_id FROM characters WHERE id=$1', [debt.borrower_character])).rows[0];
  const call = async (token, method, url, payload, requestKey = key('http')) => {
    const response = await app.inject({ method, url, payload, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), 'idempotency-key': requestKey } });
    assert.equal(response.statusCode, 200, response.body); return response.json();
  };
  async function player(label) {
    const token = (await call(null, 'POST', '/v1/auth/guest')).token;
    await call(token, 'POST', '/v1/character', { name: 'N24F ' + ++serial + ' ' + label.slice(0, 12) });
    const account = app.jwt.verify(token).sub, actor = (await pool.query('SELECT id,cash,bank FROM characters WHERE account_id=$1 AND alive=true', [account])).rows[0];
    await pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry',respect=10000 WHERE id=$1", [actor.id]);
    await G.ledger(pool, { characterId: actor.id, currency: 'cash', amount: 100000 - Number(actor.cash) - Number(actor.bank), reason: 'crime:collateral_fixture_endowment' });
    const agent = (await call(token, 'POST', '/v1/auth/agent-key')).token; return { id: actor.id, account, token, agent };
  }
  const bidders = [await player('bidder'), await player('bidder')];
  const auction = await Auction.collateralAuctionAction(pool, lender.account_id, 'open', { agreementId: agreement.id, pledgeId: original.pledgeId, sourceHash: agreement.source_hash, consent: true }, key('open'));
  const ref = { auctionId: auction.auctionId, sourceHash: agreement.source_hash, consent: true }, bids = [];
  const Rules = await import('../src/rules.js'), gated = [];
  for (const mode of ['paid-safehouse', 'jailed-fixture-state']) {
    const actor = await player('gated-' + mode);
    if (mode === 'paid-safehouse') await call(actor.token, 'POST', '/v1/safehouse', {});
    else await pool.query("UPDATE characters SET jail_until=clock_timestamp()+interval '5 minutes' WHERE id=$1", [actor.id]);
    const beforeActor = (await pool.query('SELECT * FROM characters WHERE id=$1', [actor.id])).rows[0];
    assert(mode === 'paid-safehouse' ? Rules.safeHoused(beforeActor) : Rules.jailed(beforeActor));
    const cash = Number(beforeActor.cash), journals = (await pool.query("SELECT id FROM transactions WHERE reason='collateral-auction:bid' ORDER BY id")).rows;
    const requestKey = key('gated-' + mode), response = await app.inject({ method: 'POST', url: '/v1/loans/equipment/auctions/bid',
      payload: { ...ref, amount: 7000 }, headers: { authorization: 'Bearer ' + (mode === 'paid-safehouse' ? actor.agent : actor.token), 'idempotency-key': requestKey } });
    assert.equal(response.statusCode, 400, response.body); assert.equal(response.json().error, mode === 'paid-safehouse' ? 'safe' : 'jailed');
    assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [actor.id])).rows[0].cash), cash);
    assert.deepEqual((await pool.query("SELECT id FROM transactions WHERE reason='collateral-auction:bid' ORDER BY id")).rows, journals);
    assert.equal((await pool.query('SELECT request_key FROM collateral_auction_requests WHERE account_id=$1 AND request_key=$2', [actor.account, requestKey])).rows.length, 0);
    gated.push({ mode, actualPredicate: true, response: response.json(), cashUnchanged: true, noBidJournalOrAck: true });
  }
  fs.writeFileSync(path.join(proofDirectory, 'corrected-bid-status-guards.json'), JSON.stringify(gated, null, 2) + '\n');
  for (let i = 0; i < 2; i++) bids.push(await call(i ? bidders[i].agent : bidders[i].token, 'POST', '/v1/loans/equipment/auctions/bid', { ...ref, amount: i ? 6500 : 7000 }));
  let observedClose;
  for (;;) {
    const now = +new Date((await pool.query('SELECT clock_timestamp() AS now')).rows[0].now), left = +new Date(auction.closesAt) - now;
    if (left <= 0) { observedClose = now; break; } await new Promise(resolve => setTimeout(resolve, Math.min(59000, left + 25)));
  }
  const clocks = (await pool.query('SELECT opened_at,closes_at FROM collateral_auctions WHERE id=$1', [auction.auctionId])).rows[0];
  assert.equal(+new Date(clocks.closes_at) - +new Date(clocks.opened_at), 60000);
  assert(observedClose >= +new Date(clocks.closes_at), 'The genuine sixty-second auction clock elapses without replacement');
  const terms = { ...ref, winningBidId: bids[0].bidId };
  for (const fault of ['after-request-ack', 'request-receipt', 'post-Game-cash']) {
    let baseline, ack = false, changed = false, events = 0, persisted = false;
    const requestKey = key(fault);
    const observed = observedPool(pool, async (client, sql, values) => {
      if (!baseline && sql === 'SELECT clock_timestamp() AS now') baseline = await snapshot(fault + '-admission');
      if (/INSERT INTO item_events\b/.test(sql)) events++;
      if (sql.startsWith('INSERT INTO collateral_auction_requests(') && values?.[1] === requestKey) {
        ack = true;
        assert.equal((await client.query("SELECT state FROM collateral_auction_bids WHERE id=$1", [bids[1].bidId])).rows[0].state, 'refunded', 'Real losing-bid refund precedes the outer ACK');
        assert.equal((await client.query('SELECT status FROM loans WHERE id=$1', [original.loanId])).rows[0].status, 'repaid');
        assert.equal((await client.query('SELECT owner_id FROM item_instances WHERE id=$1', [original.itemId])).rows[0].owner_id, bidders[0].account);
        if (fault === 'after-request-ack') { changed = true; throw Error('N24-after-outer-request-ACK'); }
        if (fault === 'request-receipt') {
          const counterfeit = structuredClone(values[9]); counterfeit.paid++;
          await client.query('UPDATE collateral_auction_requests SET receipt=$3 WHERE account_id=$1 AND request_key=$2', [lender.account_id, requestKey, counterfeit]); changed = true;
        }
      }
      if (ack && fault === 'post-Game-cash' && !changed && sql.startsWith('UPDATE characters SET ') && values?.[0] === borrower.id) {
        persisted = true; await client.query('UPDATE characters SET cash=cash+1 WHERE id=$1', [borrower.id]); changed = true;
      }
    });
    await assert.rejects(Auction.collateralAuctionAction(observed, lender.account_id, 'settle', terms, requestKey),
      fault === 'after-request-ack' ? /N24-after-outer-request-ACK/ : fault === 'request-receipt' ? /receipt_source/ : /cash_persistence/);
    assert(baseline && ack && changed); if (fault === 'post-Game-cash') assert(persisted);
    const after = await snapshot(fault + '-undone'); assert.deepEqual(after.tables, baseline.tables, 'Every exact canonical row undoes including actual loser refund, request ACK, debt, title and persisted cash');
    assert.equal(events, 2, 'Only the actual original release and UID sale events were attempted');
    const before = new Map(baseline.sequences.map(row => [row.sequencename, row.last_value]));
    for (const sequence of after.sequences) if (sequence.sequencename === 'item_events_sequence_seq') assert.equal(BigInt(sequence.last_value) - BigInt(before.get(sequence.sequencename)), BigInt(events));
    else assert.equal(sequence.last_value, before.get(sequence.sequencename));
    await books(); console.log('PASS actual N24 final-ACK causal control ' + fault + ': all tables undone, actual two-event allocator advance');
  }
  const receipt = await Auction.collateralAuctionAction(pool, lender.account_id, 'settle', terms, key('valid-final-ack'));
  assert.deepEqual([receipt.paid, receipt.debtPaid, receipt.borrowerSurplus, receipt.refundedBids.length], [7000, 5250, 1750, 1]);
  await books(); await snapshot('final-valid-settlement');
  const Loans = await import('../src/loans.js'), Collateral = await import('../src/collaterallending.js');
  async function setupRace(label, fund = true) {
    const source = preserved.primed.loans.find(loan => loan.label === label);
    const a = (await pool.query('SELECT * FROM collateral_auction_agreements WHERE loan_id=$1', [source.loanId])).rows[0];
    const l = (await pool.query('SELECT * FROM loans WHERE id=$1', [source.loanId])).rows[0];
    const owner = (await pool.query('SELECT id,account_id FROM characters WHERE id=$1', [l.lender_character])).rows[0];
    const debtor = (await pool.query('SELECT id,account_id FROM characters WHERE id=$1', [l.borrower_character])).rows[0];
    const auction = await Auction.collateralAuctionAction(pool, owner.account_id, 'open',
      { agreementId: a.id, pledgeId: source.pledgeId, sourceHash: a.source_hash, consent: true }, key('race-open'));
    const ref = { auctionId: auction.auctionId, sourceHash: a.source_hash, consent: true };
    const bidders = [await player('race-bidder'), await player('race-bidder')], trader = await player('paper-buyer'), bids = [];
    if (fund) for (let i = 0; i < 2; i++) bids.push(await call(i ? bidders[i].agent : bidders[i].token, 'POST', '/v1/loans/equipment/auctions/bid', { ...ref, amount: i ? 6500 : 7000 }));
    await G.withCharacter(pool, owner.account_id, (ch, client, h) => Loans.sellPaper(ch, source.loanId, { price: 5000 }, client, h));
    return { source, a, l, owner, debtor, auction, ref, bidders, trader, bids };
  }
  const buy = race => call(race.trader.token, 'POST', '/v1/loans/' + race.source.loanId + '/buy', {});
  async function repay(race) {
    const p = (await pool.query('SELECT source_hash FROM collateral_lending_pledges WHERE id=$1', [race.source.pledgeId])).rows[0];
    await Collateral.collateralLendingAction(pool, race.debtor.account_id, 'repay', { pledgeId: race.source.pledgeId, sourceHash: p.source_hash, consent: true }, key('race-repay'));
  }
  async function cancelled(race) {
    assert.equal((await pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [race.auction.auctionId])).rows[0].state, 'cancelled');
    assert.equal((await pool.query("SELECT id FROM collateral_auction_bids WHERE auction_id=$1 AND state='held'", [race.auction.auctionId])).rows.length, 0);
    assert.equal((await pool.query('SELECT lender_character FROM loans WHERE id=$1', [race.source.loanId])).rows[0].lender_character, race.trader.id);
    assert.equal((await pool.query('SELECT state FROM collateral_lending_pledges WHERE id=$1', [race.source.pledgeId])).rows[0].state, 'held');
  }
  const bidRace = await setupRace('ordinary-terminal', false);
  const bidOutcomes = await Promise.allSettled([buy(bidRace), call(bidRace.bidders[0].agent, 'POST', '/v1/loans/equipment/auctions/bid', { ...bidRace.ref, amount: 7000 })]);
  assert.equal(bidOutcomes[0].status, 'fulfilled'); await cancelled(bidRace);
  assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [bidRace.bidders[0].id])).rows[0].cash), 100000,
    'A race-admitted genuine bid is refunded by actual claim transfer; a post-transfer bid cannot spend');
  await repay(bidRace); await books(); await snapshot('paper-buy-vs-bid');
  const settleRace = await setupRace('paper');
  for (;;) {
    const now = +new Date((await pool.query('SELECT clock_timestamp() AS now')).rows[0].now), left = +new Date(settleRace.auction.closesAt) - now;
    if (left <= 0) break; await new Promise(resolve => setTimeout(resolve, Math.min(59000, left + 25)));
  }
  const settlementOutcomes = await Promise.allSettled([buy(settleRace), Auction.collateralAuctionAction(pool, settleRace.owner.account_id, 'settle',
    { ...settleRace.ref, winningBidId: settleRace.bids[0].bidId }, key('paper-race-settle'))]);
  assert.equal(settlementOutcomes.filter(result => result.status === 'fulfilled').length, 1, 'Exactly one genuine paper transfer or paid settlement commits');
  if (settlementOutcomes[0].status === 'fulfilled') { await cancelled(settleRace); await repay(settleRace); }
  else {
    assert.equal((await pool.query('SELECT status FROM loans WHERE id=$1', [settleRace.source.loanId])).rows[0].status, 'repaid');
    assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [settleRace.source.itemId])).rows[0].owner_id, settleRace.bidders[0].account);
  }
  await books(); await snapshot('paper-buy-vs-settlement');
  const estateRace = await setupRace('bidder-estate'), observer = await player('estate-observer');
  const Pen = await import('../src/pen.js'), oldShank = process.env.SHANK_P, oldYard = process.env.PEN_YARD_EVENT;
  process.env.SHANK_P = '1'; process.env.PEN_YARD_EVENT = 'quiet';
  // Existing test-only Pen RNG seam; the actual public purchase, shank, estate
  // and source-defined Game/Items roots still execute. No private death token.
  for (const actor of [observer, estateRace.bidders[0]]) await pool.query("UPDATE characters SET jail_until=clock_timestamp()+interval '30 minutes' WHERE id=$1", [actor.id]);
  await call(observer.token, 'POST', '/v1/pen/buy/shiv');
  let estateBaseline, shankDone = false, estateFault = false, estateEvents = 0; const estateAccounts = new Set();
  const lateEstate = observedPool(pool, async (_client, sql, values) => {
    if (!estateBaseline && sql === 'SELECT clock_timestamp() AS now') estateBaseline = await snapshot('public-estate-Game-ACK-admission');
    if (/INSERT INTO item_events\b/.test(sql)) estateEvents++;
    if (shankDone && sql.startsWith('UPDATE account_persistent SET ') && [observer.account, estateRace.bidders[0].account].includes(values?.[0])) {
      estateAccounts.add(values[0]); if (estateAccounts.size === 2) { estateFault = true; throw Error('N24-after-public-estate-Game-ACK'); }
    }
  });
  await assert.rejects(G.withTwoCharacters(lateEstate, observer.account, estateRace.bidders[0].id, async (actor, victim, client, h) => {
    const result = await Pen.shank(actor, victim, client, h); assert.equal(result.kill, true); shankDone = true; return result;
  }, { meet: false }), /N24-after-public-estate-Game-ACK/);
  assert(estateBaseline && shankDone && estateFault); const estateUndone = await snapshot('public-estate-Game-ACK-undone');
  assert.deepEqual(estateUndone.tables, estateBaseline.tables, 'The actual public shank leaf, original refunds, heir, metadata and all final Game account ACK rows undo');
  assert.equal(estateEvents, 0, 'This actual bidder estate owns no UID; no item event allocation is attempted');
  assert.deepEqual(estateUndone.sequences, estateBaseline.sequences); await books();
  const estateOutcomes = await Promise.allSettled([buy(estateRace), call(observer.token, 'POST', '/v1/pen/shank/' + estateRace.bidders[0].id)]);
  if (oldShank === undefined) delete process.env.SHANK_P; else process.env.SHANK_P = oldShank;
  if (oldYard === undefined) delete process.env.PEN_YARD_EVENT; else process.env.PEN_YARD_EVENT = oldYard;
  assert(estateOutcomes.every(result => result.status === 'fulfilled'), 'Original bidder estate and paper purchase serialize through actual source-defined prelocks');
  await cancelled(estateRace); assert.equal(estateOutcomes[1].value.kill, true);
  assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1', [estateRace.bidders[0].id])).rows[0].alive, false);
  assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [estateRace.bidders[0].id])).rows[0].cash), 0, 'Real bid refund follows ordinary original estate cash; no new heir grant');
  await repay(estateRace); await books(); await snapshot('paper-buy-vs-original-bidder-estate');
  const recovery = await setupRace('borrower-estate');
  const shelterRecovery = await call(recovery.bidders[0].token, 'POST', '/v1/safehouse', {});
  await pool.query("UPDATE characters SET jail_until=clock_timestamp()+interval '5 minutes' WHERE id=$1", [recovery.bidders[1].id]);
  await repay(recovery);
  assert.equal((await pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [recovery.auction.auctionId])).rows[0].state, 'cancelled');
  assert.equal((await pool.query("SELECT id FROM collateral_auction_bids WHERE auction_id=$1 AND state='held'", [recovery.auction.auctionId])).rows.length, 0);
  const protectedBidder = (await pool.query('SELECT * FROM characters WHERE id=$1', [recovery.bidders[0].id])).rows[0];
  const jailedBidder = (await pool.query('SELECT * FROM characters WHERE id=$1', [recovery.bidders[1].id])).rows[0];
  assert(Rules.safeHoused(protectedBidder)); assert.equal(Number(protectedBidder.cash), 100000 - Number(shelterRecovery.cost));
  assert(Rules.jailed(jailedBidder)); assert.equal(Number(jailedBidder.cash), 100000);
  await books(); await snapshot('ordinary-recovery-preserves-sheltered-and-jailed-original-refunds');
  async function publicEstate(victim, label) {
    const killer = await player('public-estate-' + label), previousShank = process.env.SHANK_P, previousYard = process.env.PEN_YARD_EVENT;
    process.env.SHANK_P = '1'; process.env.PEN_YARD_EVENT = 'quiet';
    try {
      for (const actor of [killer, victim]) await pool.query("UPDATE characters SET jail_until=clock_timestamp()+interval '30 minutes' WHERE id=$1", [actor.id]);
      await call(killer.token, 'POST', '/v1/pen/buy/shiv');
      assert.equal((await call(killer.token, 'POST', '/v1/pen/shank/' + victim.id)).kill, true);
    } finally {
      if (previousShank === undefined) delete process.env.SHANK_P; else process.env.SHANK_P = previousShank;
      if (previousYard === undefined) delete process.env.PEN_YARD_EVENT; else process.env.PEN_YARD_EVENT = previousYard;
    }
  }
  const borrowerEstate = await setupRace('holder-estate');
  await publicEstate({ id: borrowerEstate.debtor.id }, 'borrower');
  assert.equal((await pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [borrowerEstate.auction.auctionId])).rows[0].state, 'cancelled');
  assert.equal((await pool.query('SELECT state FROM collateral_lending_pledges WHERE id=$1', [borrowerEstate.source.pledgeId])).rows[0].state, 'estate_released');
  assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [borrowerEstate.source.itemId])).rows[0].owner_id, borrowerEstate.debtor.account_id);
  await books(); await snapshot('actual-public-original-borrower-estate');
  const distinct = await setupRace('paper-distinct-roots'), buyerExisting = await setupRace('buyer-existing-auction');
  // The genuine buyer already has its own different live, funded auction. The
  // source-defined union of both roots is locked; ordinary ownership is uncapped.
  await G.withTwoCharacters(pool, buyerExisting.owner.account_id, distinct.owner.id,
    (actor, seller, client, h) => Loans.buyPaper(actor, seller, distinct.source.loanId, client, h));
  assert.equal((await pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [distinct.auction.auctionId])).rows[0].state, 'cancelled');
  assert.equal((await pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [buyerExisting.auction.auctionId])).rows[0].state, 'open');
  assert.equal((await pool.query('SELECT lender_character FROM loans WHERE id=$1', [distinct.source.loanId])).rows[0].lender_character, buyerExisting.owner.id);
  await books(); await snapshot('actual-paper-two-distinct-root-relationships');
  await publicEstate({ id: buyerExisting.owner.id }, 'current-holder');
  assert.equal((await pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [buyerExisting.auction.auctionId])).rows[0].state, 'cancelled');
  const heir = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [buyerExisting.owner.account_id])).rows[0];
  assert.notEqual(heir.id, buyerExisting.owner.id);
  for (const race of [distinct, buyerExisting]) {
    assert.equal((await pool.query('SELECT lender_character FROM loans WHERE id=$1', [race.source.loanId])).rows[0].lender_character, heir.id);
    await repay(race);
  }
  await books(); await snapshot('actual-public-holder-estate-and-genuine-heir-claims');
  fs.writeFileSync(path.join(proofDirectory, 'race-outcomes.json'), JSON.stringify({
    bid: bidOutcomes.map(result => ({ status: result.status, reason: result.reason?.message })),
    settlement: settlementOutcomes.map(result => ({ status: result.status, reason: result.reason?.message })),
    estate: estateOutcomes.map(result => ({ status: result.status, reason: result.reason?.message })) }, null, 2) + '\n');
  console.log('PASS actual paper-buy races with bid, settlement and original bidder estate; genuine original refunds, unchanged claim/UID rights and canonical books');
  console.log('PASS actual paid-safehouse/jailed new-bid refusals with zero debit/ACK; existing legally escrowed original refunds remain recoverable in both states');
  console.log('PASS separate inherited genuine one-hour default phase: actual final request/loser-refund ACK and persisted Game cash causal refusals, exact original debt/proceeds/UID settlement; financialOFF');
} finally { await app.close(); }
