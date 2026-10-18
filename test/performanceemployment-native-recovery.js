import assert from 'node:assert/strict';
import { nativeFixture, observedPool } from './performanceemployment-native-fixture.js';
const f = await nativeFixture();
try {
  const job = await f.create(); await f.fund(job);
  const beforeForgery = await f.snapshot('before-private-forgeries');
  await assert.rejects(f.I.withItemTransaction(f.pool, c => f.P.performanceEmploymentHook(c, 'claim', { job: { id: job.employmentId } }, {})), /canonical_scope/);
  await assert.rejects(f.I.withItemTransaction(f.pool, c => f.P.recordPerformanceEmploymentFill(c, { commitment: { id: 'not-a-proof' } }, {})), /canonical_fill_scope/);
  f.same(beforeForgery, await f.snapshot('after-private-forgeries'));
  const com = await f.commitment(); await f.accept(job, com);
  await f.single('worker', (ch, c, h) => f.Economy.buyGood(ch, 'gin', 4, c, h));
  let marketBefore, marketObserved = false, marketEvents = 0;
  const market = observedPool(f.pool, async (client, sql) => {
    if (/INSERT INTO item_events\b/.test(sql)) marketEvents++;
    if (sql.startsWith('UPDATE performance_employment_assignments SET delivered_units=')) {
      marketObserved = true;
      assert.equal((await client.query('SELECT delivered_units FROM performance_employment_assignments WHERE commitment_id=$1', [com.id])).rows[0].delivered_units, 2);
      throw Error('N26-after-actual-market-outcome');
    }
  });
  await assert.rejects(f.single('worker', async (ch, c, h) => {
    marketBefore = await f.snapshot('actual-market-admission'); return f.Delivery.deliverCommitment(ch, com.id, 2, c, h);
  }, market), /N26-after-actual-market-outcome/);
  assert(marketObserved); assert.equal(marketEvents, 0); f.same(marketBefore, await f.snapshot('actual-market-undone')); await f.books();
  await f.deliver(com, 2); await f.deliver(com, 2);
  for (const fault of ['after-request', 'corrupt-receipt', 'after-Game-persist']) {
    let baseline, worker, beforeCash, ack = false, changed = false, events = 0; const accounts = new Set(), requestKey = f.key(fault);
    const observed = observedPool(f.pool, async (client, sql, values) => {
      if (/INSERT INTO item_events\b/.test(sql)) events++;
      if (sql.startsWith('INSERT INTO game_employment_requests(') && values?.[1] === 'claim' && values?.[2] === requestKey) {
        ack = true;
        const outcome = (await client.query('SELECT * FROM performance_employment_assignments WHERE commitment_id=$1', [com.id])).rows[0];
        assert.equal(outcome.state, 'paid'); assert.equal(outcome.bonus_cash, 50); assert(outcome.wage_transaction && outcome.bonus_transaction);
        assert.equal(Number(worker.cash), beforeCash + 150);
        if (fault === 'after-request') { changed = true; throw Error('N26-after-real-claim-request'); }
        if (fault === 'corrupt-receipt') {
          const counterfeit = structuredClone(values[4]); counterfeit.performanceBonus.bonusCash++;
          await client.query('UPDATE game_employment_requests SET receipt=$4 WHERE account_id=$1 AND action=$2 AND request_key=$3', ['worker', 'claim', requestKey, counterfeit]); changed = true;
        }
      }
      if (ack && fault === 'after-Game-persist' && sql.startsWith('UPDATE account_persistent SET ') && ['worker', 'employer'].includes(values?.[0])) {
        accounts.add(values[0]); if (accounts.size === 2) {
          assert.equal(Number((await client.query('SELECT cash FROM characters WHERE id=$1', [worker.id])).rows[0].cash), beforeCash + 150);
          changed = true; throw Error('N26-after-real-Game-account-ACKs');
        }
      }
    });
    await assert.rejects(f.pair('worker', 'employer', async (ch, owner, c, h) => {
      worker = ch; beforeCash = Number(ch.cash); baseline = await f.snapshot(fault + '-admission');
      return f.E.claimEmployment(ch, owner, job.employmentId, com.id, requestKey, c, h);
    }, observed), fault === 'after-request' ? /N26-after-real-claim-request/ : fault === 'corrupt-receipt' ? /canonical_receipt/ : /N26-after-real-Game-account-ACKs/);
    assert(ack && changed && baseline); assert.equal(events, 0); f.same(baseline, await f.snapshot(fault + '-undone')); await f.books();
  }
  const paid = await f.claim(job, com); assert.equal(paid.performanceBonus.bonusCash, 50);
  await f.single('employer', (ch, c, h) => f.E.closeEmployment(ch, job.employmentId, 'close-complete-job', c, h));
  await f.restock(); const estateJob = await f.create(), rider = await f.fund(estateJob, { key: 'estate-original-fund' });
  const estateCom = await f.commitment(); await f.accept(estateJob, estateCom);
  const { runEstate } = await import('../src/social/estate.js');
  assert.equal((await f.pool.query('SELECT account_id FROM street_deeds WHERE account_id=$1', ['employer'])).rows.length, 0);
  let estateBefore, estateDone = false, faulted = false, estateEvents = 0; const persisted = new Set();
  const estate = observedPool(f.pool, async (_client, sql, values) => {
    if (/INSERT INTO item_events\b/.test(sql)) estateEvents++;
    if (estateDone && sql.startsWith('UPDATE account_persistent SET ') && ['other', 'employer'].includes(values?.[0])) {
      persisted.add(values[0]); if (persisted.size === 2) { faulted = true; throw Error('N26-after-real-estate-Game-ACKs'); }
    }
  });
  await assert.rejects(f.pair('other', 'employer', async (ch, target, c, h) => {
    estateBefore = await f.snapshot('estate-admission'); const result = await runEstate(c, h, target, 'performance native causal estate', { killerCh: ch, loot: true });
    estateDone = true; return result;
  }, estate), /N26-after-real-estate-Game-ACKs/);
  assert(estateDone && faulted); assert.equal(estateEvents, 0); f.same(estateBefore, await f.snapshot('estate-undone')); await f.books();
  const actualEstate = await f.pair('other', 'employer', (ch, target, c, h) => runEstate(c, h, target, 'performance native genuine estate', { killerCh: ch, loot: true }));
  const reserve = (await f.pool.query('SELECT * FROM performance_employment_contracts WHERE employment_id=$1', [estateJob.employmentId])).rows[0];
  assert.equal(reserve.state, 'closed'); assert.equal(Number(reserve.escrow_cash), 0); assert.equal(Number(reserve.burned_cash) + Number(reserve.looted_cash), 100);
  assert.deepEqual(await f.P.replayPerformanceEmployment(f.pool, 'employer', { employmentId: estateJob.employmentId, minimumUnits: 4, bonusCash: 50, consent: true }, 'estate-original-fund'), rider);
  await assert.rejects(f.fund(estateJob), /employer/); await assert.rejects(f.claim(estateJob, estateCom), error => error.code === 'no_target');
  await f.books(); await f.snapshot('final-genuine-estate'); f.proof('estate-receipt', { actualEstate, reserve });
  console.log('PASS native N26 real market/receipt/final Game persistence and genuine estate ACK faults restore every canonical row/sequence; actual scopes, original reserve recovery/history and no heir execution authority');
} finally { await f.close(); }
