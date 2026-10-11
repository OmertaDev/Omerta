import assert from 'node:assert/strict';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const value = process.env.INTEL_FORECAST_TEST_DATABASE_URL;
  if (!value) throw new Error('Set INTEL_FORECAST_TEST_DATABASE_URL to a fresh isolated local database.');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1'
      || !/^\/intel_forecasts_[a-zA-Z0-9_]+$/.test(url.pathname)
      || !((url.port === '35439' && url.username === 'pilot_runner') || (url.port === '5432' && url.username === 'postgres')))
    throw new Error('Intel API proof requires a dedicated loopback intel_forecasts_ database and test role.');
  const { Pool } = await import('pg'); const check = new Pool({ connectionString: value });
  try { assert.equal((await check.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0, 'native test database must be empty'); }
  finally { await check.end(); }
  process.env.DATABASE_URL = value;
} else if (process.env.DATABASE_URL) throw new Error('Memory proof refuses an existing DATABASE_URL.');
process.env.RATE_LIMIT = 'off'; process.env.DEPOT_PILOT = 'on'; process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.JWT_SECRET = 'isolated-intel-api-test-secret-not-production'; process.env.MOD_KEY = 'isolated-intel-api-test-mod';
process.env.MARKET_SEED = 'isolated-intel-api-seed-for-local-native-proof';
// A deterministic wall clock advances native routes through the observation
// window without changing job identities, accepted terms or client timestamps.
const RealDate = Date;
let clock = Math.floor(RealDate.now() / 14400000) * 14400000 + 3600000;
class TestDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return clock; }
}
globalThis.Date = TestDate;
const { buildServer } = await import('../src/server.js');
const G = await import('../src/game.js');
const Intel = await import('../src/intelforecastjobs.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const app = await buildServer();
let sequence = 0;
const call = async (method, url, token, payload, key = `intel-api-${++sequence}`) => {
  const response = await app.inject({ method, url, payload, headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key === null ? {} : { 'idempotency-key': key }),
  } });
  return { code: response.statusCode, body: response.json() };
};
const ok = response => { assert.equal(response.code, 200, JSON.stringify(response.body)); return response.body; };
async function player(name) {
  const owner = ok(await call('POST', '/v1/auth/guest')).token;
  ok(await call('POST', '/v1/character', owner, { name }));
  const character = ok(await call('GET', '/v1/me', owner)).character;
  const agent = ok(await call('POST', '/v1/auth/agent-key', owner)).token;
  const accountId = JSON.parse(Buffer.from(owner.split('.')[1], 'base64url').toString()).sub;
  await app.pool.query('UPDATE characters SET cash=50000.5,bank=0 WHERE id=$1', [character.id]);
  await G.ledger(app.pool, { characterId: character.id, currency: 'cash', amount: 50000.5 - Number(character.cash) - Number(character.bank), reason: 'crime:intel-api-fixture' });
  return { id: character.id, accountId, owner, agent };
}
const cash = async p => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.id])).rows[0].cash);
const row = async id => (await app.pool.query('SELECT * FROM intel_forecast_jobs WHERE id=$1', [id])).rows[0];
const receipts = async id => (await app.pool.query("SELECT character_id,amount,reason,counterparty FROM transactions WHERE reason LIKE 'intel_job:%' AND counterparty=$1", [id])).rows;
const terms = changes => ({ districtId: 'docks', minimumStock: 10, feeCash: 50, targetAt: new Date(clock + 600000).toISOString(), ...changes });
const create = async (buyer, reporter, body = terms(), key) => call('POST', `/v1/intel-forecasts/reporters/${reporter.id}/jobs`, buyer, body, key);
const report = async (job, token, predictsAvailable = true, key) => call('POST', `/v1/intel-forecasts/${job}/report`, token, { predictsAvailable }, key);
const resolve = async (job, token, key) => call('POST', `/v1/intel-forecasts/${job}/resolve`, token, {}, key);
const kill = async p => {
  const response = await app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: p.id }, headers: { 'x-mod-key': process.env.MOD_KEY } });
  assert.equal(response.statusCode, 200, response.body);
};
try {
  const buyer = await player('Intel Human Buyer'), reporter = await player('Intel Agent Reporter'), stranger = await player('Intel Stranger');
  assert.equal((await call('GET', '/v1/intel-forecasts')).code, 401);
  assert.equal((await create(undefined, reporter)).code, 401);
  const body = terms(), beforeBuyer = await cash(buyer), beforeReporter = await cash(reporter);
  const created = ok(await create(buyer.owner, reporter, body, 'intel-create-exact')).job;
  assert.equal(created.status, 'open'); assert.equal(created.feeCash, 50); assert.equal(await cash(buyer), beforeBuyer - 50);
  const creationReplay = ok(await create(buyer.owner, reporter, body, 'intel-create-exact')).job;
  assert.equal(creationReplay.id, created.id); assert.equal(await cash(buyer), beforeBuyer - 50);
  const mismatch = await create(buyer.owner, reporter, { ...body, feeCash: 51 }, 'intel-create-exact');
  assert.equal(mismatch.code, 422); assert.equal(mismatch.body.error, 'idempotency_key_reuse');
  assert.equal((await report(created.id, stranger.agent)).body.error, 'intel_forecast');
  assert.equal((await call('POST', `/v1/intel-forecasts/${created.id}/cancel`, stranger.owner, {})).body.error, 'intel_forecast');
  assert.equal((await resolve(created.id, stranger.owner)).body.error, 'intel_forecast');
  const buyerBoard = ok(await call('GET', '/v1/intel-forecasts', buyer.agent));
  const reporterBoard = ok(await call('GET', '/v1/intel-forecasts', reporter.owner));
  assert.equal(buyerBoard.jobs.length, 1); assert.equal(reporterBoard.jobs.length, 1);
  assert.deepEqual(ok(await call('GET', '/v1/intel-forecasts', stranger.agent)).jobs, []);
  assert.equal(buyerBoard.outcomeDefinition, 'first_server_snapshot_in_window'); assert.equal(buyerBoard.accuracyDeterminesPayment, false);
  const disclosed = JSON.stringify(buyerBoard.jobs);
  for (const hidden of [buyer.accountId, reporter.accountId, stranger.accountId, 'provider', 'cashBalance']) assert(!disclosed.includes(hidden), `private DTO leaked ${hidden}`);
  await app.pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1', [buyer.id, new Date(clock + 3600000)]);
  const paid = ok(await report(created.id, reporter.agent, false, 'intel-report-exact')).job;
  await app.pool.query('UPDATE characters SET jail_until=NULL WHERE id=$1', [buyer.id]);
  assert.equal(paid.status, 'reported'); assert.equal(paid.predictsAvailable, false); assert.equal(paid.outcome, null);
  assert.equal(await cash(reporter), beforeReporter + 50, 'timely report earns the full fixed fee, independent of later accuracy');
  assert.equal((await cash(reporter)) % 1, 0.5, 'fixed fee preserves fractional native game cash');
  assert.equal(ok(await report(created.id, reporter.agent, false, 'intel-report-exact')).job.id, created.id);
  assert.equal(ok(await report(created.id, reporter.owner, false, 'intel-report-new-key')).job.id, created.id, 'domain replay under another key remains receipt-only');
  assert.equal((await report(created.id, reporter.owner, true)).body.error, 'intel_forecast');
  assert.equal(await cash(reporter), beforeReporter + 50);
  assert.equal(ok(await resolve(created.id, buyer.agent)).pending, true);
  clock = Date.parse(created.targetAt) + 20000;
  const scored = ok(await resolve(created.id, buyer.owner, 'intel-score-first')).job;
  assert.equal(scored.outcome, 'incorrect'); assert.equal(scored.sampledAt, new Date(clock).toISOString());
  assert.equal(scored.windowEndsAt, new Date(Date.parse(created.targetAt) + 30000).toISOString());
  assert.equal(scored.sample.stock, 500); assert.equal(await cash(reporter), beforeReporter + 50, 'accuracy never re-prices paid reports');
  clock += 1000;
  const scoredAgain = ok(await resolve(created.id, reporter.agent, 'intel-score-again')).job;
  assert.deepEqual(scoredAgain, scored, 'first server sample and outcome are immutable');
  const paidReceipts = await receipts(created.id);
  assert.equal(paidReceipts.filter(r => r.reason === 'intel_job:post').length, 1);
  assert.equal(paidReceipts.filter(r => r.reason === 'intel_job:pay').length, 1);
  assert.equal(paidReceipts.reduce((sum, r) => sum + Number(r.amount), 0), 0);
  const intelChecks = async () => (await runLedgerInvariants(app.pool, { alert: false })).checks.filter(c => c.name.startsWith('intel forecast '));
  const clean = async () => {
    const checks = await intelChecks(); assert.equal(checks.length, 2);
    assert.deepEqual(checks.filter(c => !c.ok), [], 'actual forecast escrow and receipts must reconcile');
  };
  await clean();
  const pay = (await app.pool.query("SELECT id,reason,character_id,counterparty FROM transactions WHERE reason='intel_job:pay' AND counterparty=$1", [created.id])).rows[0];
  const corrupt = async (write, restore) => {
    await write();
    try { assert((await intelChecks()).some(c => !c.ok), 'actual forecast invariants must detect this corruption'); }
    finally { await restore(); }
    await clean();
  };
  await corrupt(() => app.pool.query('UPDATE transactions SET character_id=$2 WHERE id=$1', [pay.id, stranger.id]),
    () => app.pool.query('UPDATE transactions SET character_id=$2 WHERE id=$1', [pay.id, pay.character_id]));
  await corrupt(() => app.pool.query("UPDATE transactions SET reason='crime:intel-hidden-pay' WHERE id=$1", [pay.id]),
    () => app.pool.query('UPDATE transactions SET reason=$2 WHERE id=$1', [pay.id, pay.reason]));
  await corrupt(() => app.pool.query("UPDATE transactions SET counterparty='orphan-intel-job' WHERE id=$1", [pay.id]),
    () => app.pool.query('UPDATE transactions SET counterparty=$2 WHERE id=$1', [pay.id, pay.counterparty]));
  await corrupt(() => app.pool.query("UPDATE transactions SET reason='intel_job:unknown' WHERE id=$1", [pay.id]),
    () => app.pool.query('UPDATE transactions SET reason=$2 WHERE id=$1', [pay.id, pay.reason]));
  await corrupt(() => app.pool.query("UPDATE intel_forecast_jobs SET outcome='correct' WHERE id=$1", [created.id]),
    () => app.pool.query("UPDATE intel_forecast_jobs SET outcome='incorrect' WHERE id=$1", [created.id]));

  // Reversing human/agent credentials uses the same cash settlement primitives.
  const reverseBuyer = await cash(reporter), reverseReporter = await cash(buyer);
  const reverse = ok(await create(reporter.agent, buyer, terms({ feeCash: 51 }))).job;
  await app.pool.query('UPDATE characters SET safe_until=$2 WHERE id=$1', [reporter.id, new Date(clock + 3600000)]);
  ok(await report(reverse.id, buyer.owner));
  await app.pool.query('UPDATE characters SET safe_until=NULL WHERE id=$1', [reporter.id]);
  assert.equal(await cash(reporter), reverseBuyer - 51); assert.equal(await cash(buyer), reverseReporter + 51);
  clock = Date.parse(reverse.targetAt) + 30001;
  const late = ok(await resolve(reverse.id, buyer.agent)).job;
  assert.equal(late.outcome, 'unknown'); assert.equal(late.sample, null); assert.equal(late.sampledAt, null);
  assert.equal(late.accuracyDeterminesPayment, false);

  const balance = await cash(buyer);
  const cancel = ok(await create(buyer.agent, reporter)).job;
  assert.equal(await cash(buyer), balance - cancel.feeCash);
  process.env.DEPOT_PILOT = 'off';
  assert.equal((await create(buyer.owner, reporter)).body.error, 'intel_forecast');
  const cancelled = ok(await call('POST', `/v1/intel-forecasts/${cancel.id}/cancel`, buyer.agent, {})).job;
  assert.equal(cancelled.status, 'cancelled'); assert.equal(await cash(buyer), balance);
  ok(await call('POST', `/v1/intel-forecasts/${cancel.id}/cancel`, buyer.owner, {})); assert.equal(await cash(buyer), balance);
  process.env.DEPOT_PILOT = 'on';

  // A paid reporter's original account can recover its stored receipt after the
  // buyer estate runs, then after reporter succession, without any fresh fee.
  const old = ok(await create(buyer.owner, reporter)).job;
  ok(await report(old.id, reporter.agent, true)); const earned = await cash(reporter);
  await kill(buyer);
  assert.equal(ok(await report(old.id, reporter.owner, true)).job.id, old.id); assert.equal(await cash(reporter), earned);
  const history = ok(await call('GET', '/v1/intel-forecasts', reporter.agent));
  assert(history.jobs.some(job => job.id === old.id));
  const unreportedOldReporter = ok(await create(stranger.owner, reporter)).job;
  await kill(reporter);
  const heir = ok(await call('GET', '/v1/me', reporter.owner)).character;
  assert.notEqual(heir.id, reporter.id, 'canonical estate created a replacement character');
  const heirCash = Number(heir.cash);
  const heirBoard = ok(await call('GET', '/v1/intel-forecasts', reporter.agent));
  assert(heirBoard.jobs.some(job => job.id === old.id && job.reporterId === reporter.id), 'own account history preserves original reporter identity after succession');
  assert(!ok(await call('GET', '/v1/intel-forecasts', stranger.owner)).jobs.some(job => job.id === old.id), 'another account never gains foreign historical reports');
  assert.equal(ok(await report(old.id, reporter.agent, true)).job.id, old.id);
  assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [heir.id])).rows[0].cash), heirCash, 'replacement reporter may recover history but never re-earn predecessor fee');
  assert.equal((await receipts(old.id)).filter(r => r.reason === 'intel_job:pay').length, 1);
  assert.equal((await report(unreportedOldReporter.id, reporter.agent)).body.error, 'intel_forecast', 'replacement reporter cannot fulfill predecessor work as fresh income');
  assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [heir.id])).rows[0].cash), heirCash);
  ok(await call('POST', `/v1/intel-forecasts/${unreportedOldReporter.id}/cancel`, stranger.owner, {}));

  // A reporter death leaves unpaid work refundable to its original buyer.
  const recoveryBuyer = await player('Intel Recovery Buyer'), recoveryReporter = await player('Intel Recovery Reporter');
  const recoveryBefore = await cash(recoveryBuyer), recover = ok(await create(recoveryBuyer.agent, recoveryReporter)).job;
  await kill(recoveryReporter);
  assert.equal((await row(recover.id)).status, 'open');
  process.env.DEPOT_PILOT = 'off';
  assert.equal((await Intel.expireIntelForecastJobs(app.pool)).refunded, 1, 'canonical recovery worker refunds a dead reporter without enabling new intake');
  assert.equal((await row(recover.id)).status, 'expired');
  assert.equal((await Intel.expireIntelForecastJobs(app.pool)).refunded, 0, 'worker recovery never repeats refund');
  ok(await call('POST', `/v1/intel-forecasts/${recover.id}/cancel`, recoveryBuyer.agent, {}));
  assert.equal(await cash(recoveryBuyer), recoveryBefore); process.env.DEPOT_PILOT = 'on';

  // Actual canonical buyer estate burns its unreported fee exactly once.
  const estateBuyer = await player('Intel Estate Buyer'), estateReporter = await player('Intel Estate Reporter');
  const estate = ok(await create(estateBuyer.owner, estateReporter, terms({ feeCash: 101 }))).job;
  await kill(estateBuyer);
  assert.equal((await row(estate.id)).status, 'buyer_dead');
  const burned = (await receipts(estate.id)).filter(r => r.reason === 'intel_job:death');
  assert.equal(burned.length, 1); assert.equal(Number(burned[0].amount), -101);
  assert.equal((await receipts(estate.id)).filter(r => r.reason === 'intel_job:pay').length, 0);
  const lootBuyer = await player('Intel Loot Buyer'), lootReporter = await player('Intel Loot Reporter'), killer = await player('Intel Estate Killer');
  const lootJob = ok(await create(lootBuyer.owner, lootReporter, terms({ feeCash: 131 }))).job;
  const { runEstate } = await import('../src/social/estate.js');
  await G.withTwoCharacters(app.pool, killer.accountId, lootBuyer.id, (ch, victim, client, h) =>
    runEstate(client, h, victim, ch.name, { loot: true, killerCh: ch }));
  assert.equal((await row(lootJob.id)).status, 'buyer_dead');
  const lootReceipts = await receipts(lootJob.id);
  const looted = -Number(lootReceipts.find(r => r.reason === 'intel_job:loot')?.amount);
  const deathBurn = -Number(lootReceipts.find(r => r.reason === 'intel_job:death')?.amount);
  assert(looted > 0 && looted <= 65 && deathBurn > 0); assert.equal(looted + deathBurn, 131, 'canonical estate loot plus burn consumes exactly original fee');
  const killerCredits = (await app.pool.query("SELECT amount FROM transactions WHERE character_id=$1 AND counterparty=$2 AND reason='whack:loot'", [killer.id, lootBuyer.id])).rows;
  assert(killerCredits.some(r => Number(r.amount) === looted), 'native estate gives the fee share to its actual killer with a real character ledger receipt');
  const attacker = await player('Intel Quota Attacker'), victim = await player('Intel Quota Victim');
  const legitimate = await player('Intel Quota Client'), independent = await player('Intel Quota Supplier');
  const unsolicited = [];
  for (let i = 0; i < 3; i++) unsolicited.push(ok(await create(attacker.agent, victim)).job);
  const victimBefore = await cash(victim);
  const ownWork = ok(await create(victim.agent, independent)).job;
  assert.equal(ownWork.buyerId, victim.id, 'three incoming requests cannot reserve the target reporter capacity');
  assert.equal(await cash(victim), victimBefore - ownWork.feeCash);
  const chosen = ok(await create(legitimate.owner, victim)).job;
  ok(await report(chosen.id, victim.agent));
  assert.equal(await cash(victim), victimBefore, 'victim may voluntarily fulfill a legitimate report despite unsolicited requests');
  ok(await report(unsolicited[0].id, victim.owner));
  const atCapacity = await cash(victim);
  assert.equal((await report(unsolicited[1].id, victim.agent)).body.error, 'intel_forecast', 'three consent-owned active jobs bound voluntary new submission');
  assert.equal(await cash(victim), atCapacity, 'capacity refusal pays no additional fee');
  assert.equal((await row(unsolicited[1].id)).status, 'open');
  assert.equal((await receipts(unsolicited[1].id)).filter(r => r.reason === 'intel_job:pay').length, 0);
  await clean();
  console.log(`intel API ${postgres ? 'PostgreSQL' : 'memory'} PASS: auth/private account history, human-agent fixed fractional cash, exact header/body replay, first sampled window/unknown late, funded buyer jail/safe, disabled recovery, canonical buyer estate loot/burn and reporter succession, invariant tamper controls, consent-owned quota; no external financial activation`);
} finally { await app.close(); globalThis.Date = RealDate; }
