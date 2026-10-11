import assert from 'node:assert/strict';
import * as L from '../src/logisticscoverage.js';
const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.LOGISTICS_COVERAGE_TEST_DATABASE_URL || 'http://missing');
  assert.equal(url.protocol, 'postgresql:'); assert.equal(url.hostname, '127.0.0.1');
  assert((url.port === '35439' && url.username === 'pilot_runner') || (url.port === '5432' && url.username === 'postgres'));
  assert(/^\/logistics_coverage_[A-Za-z0-9_]+$/.test(url.pathname));
  process.env.DATABASE_URL = url.href; process.env.MARKET_SEED = 'logistics-coverage-local-test-seed';
} else assert(!process.env.DATABASE_URL, 'Memory proof refuses ambient DATABASE_URL');
process.env.DEPOT_PILOT = 'on'; process.env.RATE_LIMIT = 'off'; process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.JWT_SECRET = 'coverage-module-local-test-secret-only'; process.env.MOD_KEY = 'coverage-local-test-mod';
const { buildServer } = await import('../src/server.js');
const G = await import('../src/game.js'), D = await import('../src/depot.js'), W = await import('../src/warehouseleases.js');
const { runEstate } = await import('../src/social/estate.js');
const app = await buildServer();
let serial = 0;
async function player() {
  const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const name = `Coverage ${++serial}`;
  const result = await app.inject({ method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${token}`, 'idempotency-key': name }, payload: { name } });
  assert.equal(result.statusCode, 200, result.body);
  const account = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
  const ch = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
  await app.pool.query('UPDATE characters SET cash=100000.25,last_accrued_at=$2 WHERE id=$1', [ch.id, new Date(Date.now() + 3600000)]);
  return { id: ch.id, account };
}
const single = (who, fn) => G.withCharacter(app.pool, who.account, fn);
const pair = (actor, target, fn) => G.withTwoCharacters(app.pool, actor.account, target.id, fn, { meet: false });
const balance = async who => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [who.id])).rows[0].cash);
const row = async policy => (await app.pool.query('SELECT * FROM logistics_coverage_policies WHERE id=$1', [policy.id || policy])).rows[0];
const ledger = async policy => (await app.pool.query("SELECT character_id,amount,reason FROM transactions WHERE reason LIKE $1 ORDER BY reason,id", [`coverage:%:${policy.id || policy}`])).rows;
const current = async who => ({ account: who.account, id: (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [who.account])).rows[0].id });
async function death(killer, victim) {
  const beforePolicies = (await app.pool.query('SELECT id,escrow_cash FROM logistics_coverage_policies')).rows;
  const result = await pair(await current(killer), await current(victim), (ch, target, client, h) => runEstate(client, h, target, 'coverage native fixture'));
  assert.deepEqual((await app.pool.query('SELECT id,escrow_cash FROM logistics_coverage_policies')).rows, beforePolicies, 'estate never spends coverage reserves');
  const heir = { account: victim.account, id: result.heirId };
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [heir.id, new Date(Date.now() + 3600000)]);
  return heir;
}
let owner, depot;
async function fixture({ units = 4, duration = 60000, premium = 10 } = {}) {
  const insurer = await player(), tenant = await player();
  const leased = await pair(tenant, owner, (ch, landlord, client, h) => W.leaseWarehouse(ch, landlord, depot.id,
    { units: 4, expectedOfferRevision: 1, maxTotalCash: 100 }, client, h));
  const leaseId = leased.lease.id;
  await app.pool.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',4)", [tenant.id]);
  await single(tenant, (ch, client, h) => W.depositWarehouseCargo(ch, leaseId, 4, client, h));
  const offer = { leaseId, coveredUnits: units, cashPerUnit: 50, premiumCash: premium, expiresAt: new Date(Date.now() + duration).toISOString() };
  const before = [await balance(insurer), await balance(tenant)];
  const offered = await pair(insurer, tenant, (ch, target, client, h) => L.offerCoverage(ch, target, offer, 'fixture', client, h));
  assert.deepEqual([await balance(insurer), await balance(tenant)], before, 'offer has no death vault or cash movement');
  assert.equal((await row(offered.policy)).terms, null); assert.equal(Number((await row(offered.policy)).escrow_cash), 0);
  const replay = await pair(insurer, tenant, (ch, target, client, h) => L.offerCoverage(ch, target, offer, 'fixture', client, h));
  assert(replay.replayed); assert.equal(replay.policy.id, offered.policy.id);
  const accept = () => pair(tenant, insurer, (ch, target, client, h) => L.acceptCoverage(ch, target, offered.policy.id, client, h));
  return { insurer, tenant, offer, policy: offered.policy, before, accept };
}
async function funded(f) {
  await f.accept();
  assert.equal(await balance(f.insurer), f.before[0] - f.offer.coveredUnits * 50 + f.offer.premiumCash);
  assert.equal(await balance(f.tenant), f.before[1] - f.offer.premiumCash);
  const receipts = await ledger(f.policy);
  assert.equal(receipts.filter(r => r.reason.startsWith('coverage:reserve:')).length, 1);
  assert.equal(receipts.filter(r => r.reason.startsWith('coverage:premium:')).reduce((sum, r) => sum + Number(r.amount), 0), 0);
  assert.equal(receipts.reduce((sum, r) => sum + Number(r.amount), 0) + Number((await row(f.policy)).escrow_cash), 0);
}
const claim = (who, policy) => single(who, (ch, client, h) => L.claimCoverage(ch, policy.id, client, h));
const refund = (who, policy) => single(who, (ch, client, h) => L.refundCoverage(ch, policy.id, client, h));
// Canonical native transactions may abort a race with retryable contention.
// Await every original attempt before retrying only those aborted operations;
// never turn an authority/state refusal into a successful client retry.
async function raceWithContentionReplay(tasks) {
  const outcomes = await Promise.allSettled(tasks.map(task => task()));
  for (let i = 0; i < outcomes.length; i++) {
    for (let attempt = 0; outcomes[i].status === 'rejected' && outcomes[i].reason?.code === 'contention' && attempt < 3; attempt++) {
      console.log(`coverage race client retry: operation ${i}, contention attempt ${attempt + 1}`);
      try { outcomes[i] = { status: 'fulfilled', value: await tasks[i]() }; }
      catch (reason) { outcomes[i] = { status: 'rejected', reason }; }
    }
  }
  return outcomes;
}
try {
  owner = await player(); depot = await single(owner, (ch, client, h) => D.openDepot(ch, { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 }, client, h));
  await single(owner, (ch, client) => W.configureWarehouseOffer(ch, depot.id, { expectedRevision: 0, enabled: true, slots: 40, cashPerUnitDay: 25 }, client));
  const f = await fixture();
  await app.pool.query('UPDATE characters SET cash=199.25 WHERE id=$1', [f.insurer.id]);
  await assert.rejects(f.accept(), { code: 'logistics_coverage' });
  assert.equal((await row(f.policy)).state, 'offered'); assert.equal((await ledger(f.policy)).length, 0);
  await app.pool.query('UPDATE characters SET cash=$2 WHERE id=$1', [f.insurer.id, f.before[0]]);
  process.env.DEPOT_PILOT = 'off'; await assert.rejects(f.accept(), { code: 'logistics_coverage' }); process.env.DEPOT_PILOT = 'on';
  if (native) {
    const accepted = await raceWithContentionReplay([f.accept, f.accept]); assert(accepted.every(r => r.status === 'fulfilled'));
    assert.equal(accepted.filter(r => r.value.replayed).length, 1);
  } else await f.accept();
  assert.equal(Number((await row(f.policy)).escrow_cash), 200);
  assert.equal((await ledger(f.policy)).filter(r => r.reason.startsWith('coverage:reserve:')).length, 1);
  await assert.rejects(pair(f.insurer, f.tenant, (ch, target, client, h) => L.offerCoverage(ch, target,
    { ...f.offer, beneficiaryAccountId: owner.account }, 'forged', client, h)), { code: 'logistics_coverage' });
  const extraOffer = key => pair(f.insurer, f.tenant, (ch, target, client, h) => L.offerCoverage(ch, target, f.offer, key, client, h));
  await extraOffer('extra1'); await extraOffer('extra2'); const extra = await extraOffer('extra3');
  await assert.rejects(extraOffer('extra4'), { code: 'logistics_coverage' });
  await assert.rejects(pair(f.tenant, f.insurer, (ch, target, client, h) => L.acceptCoverage(ch, target, extra.policy.id, client, h)), { code: 'logistics_coverage' });
  assert.equal(Number((await row(f.policy)).escrow_cash), 200);
  await assert.rejects(refund(f.insurer, f.policy), { code: 'logistics_coverage' });
  const heir = await death(f.insurer, f.tenant);
  const event = (await app.pool.query("SELECT * FROM business_depot_journal WHERE lease_id=$1 AND reason='warehouse_tenant_death'", [f.offer.leaseId])).rows[0];
  assert(event.event_at); assert.equal(Number(event.lease_stock_delta), -4);
  process.env.DEPOT_PILOT = 'off';
  const cashBefore = await balance(heir);
  if (native) {
    const outcomes = await raceWithContentionReplay([
      () => claim(heir, f.policy), () => claim(heir, f.policy), () => refund(f.insurer, f.policy)]);
    assert(outcomes.every(result => result.status === 'fulfilled'), 'All races settle through success or documented contention retry');
    assert.equal(outcomes.slice(0, 2).filter(r => r.value.replayed).length, 1);
  } else { await claim(heir, f.policy); await refund(f.insurer, f.policy); }
  assert.equal(await balance(heir), cashBefore + 200); assert.equal(Number((await row(f.policy)).escrow_cash), 0);
  assert.equal((await ledger(f.policy)).filter(r => r.reason.startsWith('coverage:claim:')).length, 1);
  const nextHeir = await death(f.insurer, heir); const nextBefore = await balance(nextHeir);
  assert((await claim(nextHeir, f.policy)).replayed); assert.equal(await balance(nextHeir), nextBefore);
  process.env.DEPOT_PILOT = 'on';

  const partial = await fixture({ duration: 10000 }); await funded(partial);
  await single(partial.tenant, (ch, client, h) => W.withdrawWarehouseCargo(ch, partial.offer.leaseId, 2, client, h));
  const partialHeir = await death(partial.insurer, partial.tenant);
  const partialInsurerHeir = await death(owner, partial.insurer);
  process.env.DEPOT_PILOT = 'off';
  const acceptedReplay = await single(partialHeir, (ch, client, h) => L.acceptCoverage(ch, null, partial.policy.id, client, h));
  assert(acceptedReplay.replayed); assert.equal(acceptedReplay.policy.id, partial.policy.id);
  assert.equal(Number((await row(partial.policy)).escrow_cash), 200);
  process.env.DEPOT_PILOT = 'on';
  // Settlement after expiry still reserves the complete tenant-owed portion.
  await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(partial.offer.expiresAt) - Date.now() + 20)));
  const refunded = await refund(partialInsurerHeir, partial.policy); assert.equal(refunded.refundCash, 100); assert.equal(refunded.heldCash, 100);
  assert.equal((await row(partial.policy)).state, 'claimable');
  assert.equal((await claim(partialHeir, partial.policy)).benefitCash, 100);
  assert.equal(Number((await row(partial.policy)).escrow_cash), 0);
  assert.equal((await ledger(partial.policy)).reduce((sum, r) => sum + Number(r.amount), 0), 0);

  const unknown = await fixture({ duration: 10000 }); await funded(unknown); const unknownHeir = await death(unknown.insurer, unknown.tenant);
  await app.pool.query("UPDATE business_depot_journal SET event_at=NULL WHERE lease_id=$1 AND reason='warehouse_tenant_death'", [unknown.offer.leaseId]);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(unknown.offer.expiresAt) - Date.now() + 20)));
  await assert.rejects(refund(unknown.insurer, unknown.policy), e => e.code === 'logistics_coverage' && e.reason === 'coverage_unknown');
  await assert.rejects(claim(unknownHeir, unknown.policy), { code: 'logistics_coverage' });
  assert.equal(Number((await row(unknown.policy)).escrow_cash), 200);

  const cancelled = await fixture(); process.env.DEPOT_PILOT = 'off';
  await single(cancelled.insurer, (ch, client, h) => L.cancelCoverage(ch, cancelled.policy.id, client, h));
  assert.equal((await row(cancelled.policy)).state, 'cancelled'); assert.equal((await ledger(cancelled.policy)).length, 0);
  process.env.DEPOT_PILOT = 'on';
  await assert.rejects(single(owner, (ch, client, h) => L.claimCoverage(ch, unknown.policy.id, client, h)), { code: 'logistics_coverage' });
  assert((await L.coverageBoard(app.pool, unknown.tenant.account)).some(p => p.id === unknown.policy.id));
  assert(!(await L.coverageBoard(app.pool, owner.account)).some(p => p.id === unknown.policy.id));

  if (native) {
    const competition = await fixture();
    const competing = await pair(competition.insurer, competition.tenant, (ch, target, client, h) => L.offerCoverage(ch, target, competition.offer, 'competing', client, h));
    const contenders = await raceWithContentionReplay([competition.accept, () => pair(competition.tenant, competition.insurer,
      (ch, target, client, h) => L.acceptCoverage(ch, target, competing.policy.id, client, h))]);
    assert.equal(contenders.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(contenders.find(r => r.status === 'rejected').reason.code, 'logistics_coverage');
    assert.equal((await app.pool.query('SELECT id FROM logistics_coverage_policies WHERE lease_id=$1 AND accepted_at IS NOT NULL', [competition.offer.leaseId])).rows.length, 1);
    const acceptanceRollback = await fixture();
    await app.pool.query("CREATE FUNCTION coverage_reject_reserve() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason LIKE 'coverage:reserve:%' THEN RAISE EXCEPTION 'injected reserve failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER coverage_reject_reserve BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION coverage_reject_reserve()');
    await assert.rejects(acceptanceRollback.accept(), /injected reserve failure/);
    assert.equal(await balance(acceptanceRollback.insurer), acceptanceRollback.before[0]);
    assert.equal(await balance(acceptanceRollback.tenant), acceptanceRollback.before[1]);
    assert.equal((await row(acceptanceRollback.policy)).state, 'offered');
    assert.equal(Number((await row(acceptanceRollback.policy)).escrow_cash), 0);
    assert.equal((await ledger(acceptanceRollback.policy)).length, 0);
    await app.pool.query('DROP TRIGGER coverage_reject_reserve ON transactions'); await app.pool.query('DROP FUNCTION coverage_reject_reserve()');
    await acceptanceRollback.accept();
    const rollback = await fixture(); await funded(rollback); const rollbackHeir = await death(rollback.insurer, rollback.tenant);
    await app.pool.query("CREATE FUNCTION coverage_reject_claim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason LIKE 'coverage:claim:%' THEN RAISE EXCEPTION 'injected claim failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER coverage_reject_claim BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION coverage_reject_claim()');
    const priorCash = await balance(rollbackHeir);
    await assert.rejects(claim(rollbackHeir, rollback.policy), /injected claim failure/);
    assert.equal(await balance(rollbackHeir), priorCash); assert.equal((await row(rollback.policy)).state, 'active');
    assert.equal(Number((await row(rollback.policy)).escrow_cash), 200); assert.equal((await row(rollback.policy)).event_id, null);
    await app.pool.query('DROP TRIGGER coverage_reject_claim ON transactions'); await app.pool.query('DROP FUNCTION coverage_reject_claim()');
    await claim(rollbackHeir, rollback.policy);
  }
  const outside = await fixture({ duration: 2000 }); await funded(outside);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(outside.offer.expiresAt) - Date.now() + 20)));
  const lateHeir = await death(outside.insurer, outside.tenant);
  const lateBurn = (await app.pool.query("SELECT event_at FROM business_depot_journal WHERE lease_id=$1 AND reason='warehouse_tenant_death'", [outside.offer.leaseId])).rows[0];
  assert(+new Date(lateBurn.event_at) >= Date.parse(outside.offer.expiresAt));
  assert.equal((await refund(outside.insurer, outside.policy)).refundCash, 200);
  assert.equal((await row(outside.policy)).state, 'expired');
  await assert.rejects(claim(lateHeir, outside.policy), { code: 'logistics_coverage' });
  const landlord = await fixture(); await funded(landlord);
  await death(landlord.insurer, owner);
  const closedLease = (await app.pool.query('SELECT status,held_qty FROM business_warehouse_leases WHERE id=$1', [landlord.offer.leaseId])).rows[0];
  assert.equal(closedLease.status, 'landlord_closed'); assert.equal(Number(closedLease.held_qty), 4);
  await assert.rejects(refund(landlord.insurer, landlord.policy), { code: 'logistics_coverage' });
  const landlordTenantHeir = await death(landlord.insurer, landlord.tenant);
  assert.equal((await claim(landlordTenantHeir, landlord.policy)).benefitCash, 200, 'landlord closure preserves accepted tenant-death coverage');
  console.log(JSON.stringify({ status: 'PASS', database: native ? 'PostgreSQL' : 'memory',
    scope: 'Per-policy cash/escrow accounting and actual estate successor recovery only; full ledger sweep integration pending. Native runs prove actor/asset locking, replay/concurrent allocation and trigger rollback; memory does not.' }));
} finally { await app.close(); }
