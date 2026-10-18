import assert from 'node:assert/strict';
import { nativeFixture } from './performanceemployment-native-fixture.js';
const f = await nativeFixture();
try {
  const job = await f.create(), body = { employmentId: job.employmentId, minimumUnits: 4, bonusCash: 50, consent: true };
  const beforeFund = await f.balance('employer');
  const rider = await f.ok('employer', 'POST', '/v1/company/performance-employment', body, 'native-fund', true);
  assert.equal(beforeFund - await f.balance('employer'), 100); assert.equal(rider.reservedBonusCash, 100);
  assert.deepEqual(await f.ok('employer', 'POST', '/v1/company/performance-employment', body, 'native-fund'), rider);
  const com = await f.commitment(), accepted = await f.ok('worker', 'POST', '/v1/company/employment/' + job.employmentId + '/accept',
    { commitmentId: com.id, consent: true }, 'native-accept', true);
  assert.equal(accepted.performanceBonus.bonusCash, 50);
  await assert.rejects(f.claim(job, com), /evidence/); await f.deliver(com, 1); await f.deliver(com, 3);
  const assigned = (await f.pool.query('SELECT * FROM performance_employment_assignments WHERE assignment_id=$1', [accepted.assignmentId])).rows[0];
  assert.equal(assigned.delivered_units, 4); assert.equal(assigned.fills.length, 2);
  for (const fill of assigned.fills) {
    const rows = (await f.pool.query('SELECT * FROM transactions WHERE id=$1 OR id=$2', [fill.payoutTransaction, fill.takeTransaction])).rows;
    assert.equal(rows.length, 2); assert.equal(Number(rows.find(row => row.id === fill.payoutTransaction).amount), fill.netCash);
    assert.equal(Number(rows.find(row => row.id === fill.takeTransaction).amount), -fill.takeCash);
  }
  const beforeClaim = await f.balance('worker'), keys = ['native-claim-one', 'native-claim-two'];
  const outcomes = await Promise.all(keys.map((key, i) => f.http('worker', 'POST', '/v1/company/employment/' + job.employmentId + '/claim',
    { commitmentId: com.id }, key, Boolean(i))));
  assert.equal(outcomes.filter(row => row.statusCode === 200).length, 1);
  assert.equal(outcomes.filter(row => row.statusCode === 400).length, 1);
  const winner = outcomes.findIndex(row => row.statusCode === 200), paid = outcomes[winner].json();
  assert.equal(paid.wageCash, 100); assert.equal(paid.performanceBonus.bonusCash, 50);
  assert.equal(await f.balance('worker'), beforeClaim + 150);
  const replayBefore = await f.snapshot('before-claim-http-replay');
  const replay = await f.http('worker', 'POST', '/v1/company/employment/' + job.employmentId + '/claim', { commitmentId: com.id }, keys[winner], !winner);
  assert.equal(replay.statusCode, 200); assert.equal(replay.headers['x-idempotent-replay'], 'true'); assert.deepEqual(replay.json(), paid);
  f.same(replayBefore, await f.snapshot('after-claim-http-replay'));
  const receiptBefore = await f.snapshot('before-canonical-claim-receipt-replay');
  const receiptReplay = await f.E.replayEmploymentRequest('worker', 'claim', { employmentId: job.employmentId, commitmentId: com.id }, keys[winner], f.pool);
  assert.equal(receiptReplay.replayed, true); assert.deepEqual(receiptReplay.performanceBonus, paid.performanceBonus);
  f.same(receiptBefore, await f.snapshot('after-canonical-claim-receipt-replay'));
  const closed = await f.single('employer', (ch, c, h) => f.E.closeEmployment(ch, job.employmentId, 'native-close', c, h));
  assert.equal(closed.refundedCash, 100); assert.equal(closed.performanceBonus.refundedBonusCash, 50); await f.books();
  await f.restock(); const plain = await f.create({ slots: 1 }), plainCom = await f.commitment('other');
  const ordinary = await f.accept(plain, plainCom, 'other'); assert(!ordinary.performanceBonus);
  await f.deliver(plainCom, 4, 'other'); const beforeOrdinary = await f.balance('other'), original = await f.claim(plain, plainCom, 'other');
  assert.equal(original.wageCash, 100); assert(!original.performanceBonus); assert.equal(await f.balance('other'), beforeOrdinary + 100);
  assert.equal((await f.pool.query('SELECT * FROM performance_employment_contracts WHERE employment_id=$1', [plain.employmentId])).rows.length, 0);
  await f.single('employer', (ch, c, h) => f.E.closeEmployment(ch, plain.employmentId, 'plain-close', c, h));
  await f.restock(); const retiring = await f.create(), unfunded = await f.create(), old = await f.fund(retiring, { key: 'retiring-fund' });
  await f.single('employer', (ch, c, h) => f.D.cancelDepotOrder(ch, f.depot.id, f.order.id, c, h));
  await f.single('employer', (ch, c, h) => f.D.closeDepot(ch, f.depot.id, c, h));
  await assert.rejects(f.fund(unfunded), /employer/);
  assert.deepEqual(await f.fund(retiring, { key: 'retiring-fund' }), old);
  const recovered = await f.single('employer', (ch, c, h) => f.E.closeEmployment(ch, retiring.employmentId, 'retired-source-refund', c, h));
  assert.equal(recovered.refundedCash, 200); assert.equal(recovered.performanceBonus.refundedBonusCash, 100);
  await f.single('employer', (ch, c, h) => f.E.closeEmployment(ch, unfunded.employmentId, 'plain-retired-refund', c, h));
  await f.books(); await f.snapshot('final-native-canonical-replay-retirement');
  f.proof('outcomes', { concurrentClaim: outcomes.map(row => ({ status: row.statusCode, body: row.json() })), actualSourceRetirement: 'canonical_depot_close', paid, recovered });
  console.log('PASS native N26 actual bought-gin fills, capped prefunded wages/bonus, concurrent once-only human/agent claim, exact replay, ordinary F12 and retired-source original refunds; financialOFF');
} finally { await f.close(); }
