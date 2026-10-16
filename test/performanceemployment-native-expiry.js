import assert from 'node:assert/strict';
import { nativeFixture, observedPool } from './performanceemployment-native-fixture.js';
const f = await nativeFixture();
try {
  const started = Date.now(), jobDeadline = new Date(started + 90000).toISOString();
  const earned = await f.create({ slots: 1, expiresAt: new Date(started + 120000).toISOString() }); await f.fund(earned);
  const earnedCom = await f.commitment('worker', 4, 60); await f.accept(earned, earnedCom); await f.deliver(earnedCom, 4);
  await f.restock();
  const expired = await f.create({ slots: 1, expiresAt: jobDeadline }), late = await f.create({ slots: 1, expiresAt: jobDeadline });
  await f.fund(expired); const com = await f.commitment('other', 4, 60); await f.accept(expired, com, 'other');
  await f.single('other', (ch, c, h) => f.Economy.buyGood(ch, 'gin', 4, c, h));
  const immutable = (await f.pool.query('SELECT id,deadline FROM delivery_commitments WHERE id=$1 OR id=$2 ORDER BY id', [com.id, earnedCom.id])).rows;
  const deadline = Math.max(...immutable.map(row => +new Date(row.deadline)));
  assert(deadline < Date.parse(jobDeadline) - 500, 'Genuine delivery and job deadlines retain a separate final-ACK window');
  await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now() + 75)));
  const beforeEarned = await f.balance('worker'), paid = await f.claim(earned, earnedCom);
  assert.equal(await f.balance('worker'), beforeEarned + 150);
  assert(+new Date(paid.performanceBonus.completedAt) < +new Date(immutable.find(row => row.id === earnedCom.id).deadline));
  assert(Date.now() > +new Date(immutable.find(row => row.id === earnedCom.id).deadline));
  let refusedBefore;
  await assert.rejects(f.single('other', async (ch, c, h) => {
    refusedBefore = await f.snapshot('expired-delivery-admission'); return f.Delivery.deliverCommitment(ch, com.id, 4, c, h);
  }), error => error.code === 'no_commitment');
  f.same(refusedBefore, await f.snapshot('expired-delivery-refused'));
  const beforeLate = await f.snapshot('late-funded-ACK-admission'); let observed = false, events = 0;
  const delayed = observedPool(f.pool, async (_client, sql, values) => {
    if (/INSERT INTO item_events\b/.test(sql)) events++;
    if (!observed && sql.startsWith('INSERT INTO performance_employment_requests') && values?.[1] === 'real-late-native-ACK') {
      observed = true; await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(jobDeadline) - Date.now() + 75)));
    }
  });
  await assert.rejects(f.fund(late, { key: 'real-late-native-ACK' }, delayed), /funding_window/);
  assert(observed); assert.equal(events, 0); f.same(beforeLate, await f.snapshot('late-funded-ACK-refused'));
  assert.deepEqual((await f.pool.query('SELECT id,deadline FROM delivery_commitments WHERE id=$1 OR id=$2 ORDER BY id', [com.id, earnedCom.id])).rows, immutable);
  const closed = await f.single('employer', (ch, c, h) => f.E.closeEmployment(ch, expired.employmentId, 'expired-original-refund', c, h));
  assert.equal(closed.refundedCash, 100); assert.equal(closed.performanceBonus.refundedBonusCash, 50);
  for (const job of [earned, late]) await f.single('employer', (ch, c, h) => f.E.closeEmployment(ch, job.employmentId, f.key('remaining-close'), c, h));
  await f.books(); await f.snapshot('final-real-expiry-recovery');
  f.proof('actual-clocks', { startedAt: new Date(started).toISOString(), immutable, jobDeadline, endedAt: new Date().toISOString(), elapsedMs: Date.now() - started,
    actualEarnedClaimAfterDeliveryDeadline: true, delayedFundedACKObserved: true, clockOrDeadlineMutations: 0, financialActivation: false });
  console.log('PASS native N26 genuine60-second delivery/90-second job clocks: earned pre-deadline completion claims later, expired new fill refuses, delayed actual funding ACK undoes every row/sequence, original wages/bonus recover');
} finally { await f.close(); }
