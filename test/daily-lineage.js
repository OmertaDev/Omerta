// Character death must not reset same-day cash/token reward ceilings. Work progress may die with the
// street, but the account's right to be paid for Daily Contracts, Corner jobs, and the Hustle does not.
import assert from 'node:assert/strict';

// Default to pg-mem, but allow an explicit disposable loopback PostgreSQL run for the
// concurrency/death replay proof. Never inherit DATABASE_URL implicitly from a developer shell.
const lineageDatabaseUrl = process.env.DAILY_LINEAGE_TEST_DATABASE_URL || '';
if (lineageDatabaseUrl) {
  const endpoint = new URL(lineageDatabaseUrl);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname),
    'Only disposable loopback PostgreSQL is allowed');
  assert(endpoint.port && endpoint.port !== '5432',
    'Use a disposable PostgreSQL server on an explicit nondefault port');
  assert(/^\/daily_lineage_test(?:_[a-z0-9]+)?$/.test(endpoint.pathname),
    'Use a database named daily_lineage_test');
}
process.env.DATABASE_URL = lineageDatabaseUrl;
process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'daily-lineage-test-secret';
process.env.MOD_KEY = 'daily-lineage-mod-key';
process.env.MARKET_SEED = 'daily-lineage-market-seed-1-20261021';
process.env.NODE_ENV = 'test';
if (lineageDatabaseUrl) Object.assign(process.env, {
  LEGAL_OPERATOR_NAME: 'Daily lineage test operator',
  LEGAL_POSTAL_ADDRESS: '1 Fixture Street',
  PRIVACY_CONTACT_EMAIL: 'privacy@example.test',
  DMCA_AGENT_NAME: 'Fixture agent',
  DMCA_AGENT_EMAIL: 'copyright@example.test',
  DMCA_AGENT_ADDRESS: '1 Fixture Street',
  DMCA_AGENT_PHONE: '+1 202 555 0100',
  DMCA_AGENT_REGISTERED: 'true',
  PAYMENT_REFUND_POLICY: 'Isolated test fixture; no payments.',
  SOCIAL_VERIFY_MODE: 'off',
});

const realNow = Date.now;
Date.now = () => Date.parse('2026-10-21T12:00:00Z');

const { buildServer } = await import('./server-fixture.js');
const { CORNER, dayOf, dailyJobsOf, cornerTasksOf, hustleOf } = await import('../src/rules.js');
const { loadOwned } = await import('../src/game.js');
const { takeBoundedAccountDailyClaim } = await import('../src/accountdaily.js');
const { migrateEconomyDailyClaims } = await import('../src/db.js');
const app = await buildServer();
const pool = app.pool;
const today = dayOf();
if (lineageDatabaseUrl) {
  const index = (await pool.query(
    "SELECT indexdef FROM pg_indexes WHERE schemaname=current_schema() AND indexname='ix_tx_currency_reason_at'"
  )).rows[0];
  assert(index, 'native schema installs the bounded cutover reconciliation index');
  assert.match(index.indexdef, /\(currency, reason, at\)$/,
    'the native cutover index puts time behind both exact ledger filters');
}

const call = async (method, url, { token, body, mod = false } = {}) => {
  const res = await app.inject({ method, url, payload: body, headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(mod ? { 'x-mod-key': process.env.MOD_KEY } : {}),
  } });
  return { code: res.statusCode, body: res.json() };
};
const create = async (name) => {
  const auth = await call('POST', '/v1/auth/guest');
  assert.equal(auth.code, 200);
  const token = auth.body.token;
  assert.equal((await call('POST', '/v1/character', { token, body: { name } })).code, 200);
  const character = (await call('GET', '/v1/me', { token })).body.character;
  const accountId = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [character.id])).rows[0].account_id;
  return { token, id: character.id, accountId };
};
const kill = async (id) => {
  const result = await call('POST', '/v1/mod/kill', { mod: true, body: { characterId: id, reason: 'lineage-test' } });
  assert.equal(result.code, 200, JSON.stringify(result.body));
  return result.body.heirId;
};
const setCounters = async (characterId, counters) => pool.query(
  `INSERT INTO daily_progress (character_id, day, counters) VALUES ($1,$2,$3)
   ON CONFLICT (character_id,day) DO UPDATE SET counters=$3`,
  [characterId, today, JSON.stringify(counters)]);
const claimsOf = async (accountId) => (await pool.query(
  `SELECT scope, claim_id FROM account_daily_claims WHERE account_id=$1 AND day=$2
    ORDER BY scope, claim_id`, [accountId, today])).rows.map((row) => `${row.scope}:${row.claim_id}`).sort();

try {
  const jobs = dailyJobsOf(today);
  const completedCounters = Object.fromEntries(jobs.map((job) => [job.k, job.n]));

  // Upgrade state: the old build already paid and killed this character before account/day latches
  // existed. Durable ledger/activity rows and the dead character mirror must be backfilled at boot,
  // otherwise the already-created heir can immediately draw the full envelope and check-in again.
  const upgraded = await create('Pre Upgrade Line');
  const upgradedHeir = 'pre-upgrade-heir';
  await pool.query('UPDATE characters SET alive=false, checkin_day=$2, streak=6 WHERE id=$1',
    [upgraded.id, today]);
  await pool.query(
    `INSERT INTO characters (id, account_id, name, generation, alive, season)
     VALUES ($1,$2,'Pre Upgrade Line',2,true,$3)`, [upgradedHeir, upgraded.accountId, Math.floor(today / 28)]);
  await pool.query(
    'UPDATE account_persistent SET checkin_day=0, checkin_streak=0, checkins_lifetime=3, omr=3 WHERE account_id=$1',
    [upgraded.accountId]);
  const paidAt = new Date(today * 86400000 + 12 * 3600000);
  const upgradedCornerTask = cornerTasksOf('docks', today)[0];
  const legacyLedger = [
    ['upgrade-checkin', 'checkin', 350],
    ['upgrade-checkin-replay-1', 'checkin', 350],
    ['upgrade-checkin-replay-2', 'checkin', 350],
    ...jobs.map((job, i) => [`upgrade-daily-${i}`, `daily:${job.id}`, 200]),
    ['upgrade-corner', 'corner:job', 400],
    ['upgrade-hustle', 'hustle:payoff', 600],
  ];
  for (const [id, reason, amount] of legacyLedger) await pool.query(
    `INSERT INTO transactions (id, at, character_id, currency, amount, reason)
     VALUES ($1,$2,$3,'cash',$4,$5)`, [id, paidAt, upgraded.id, amount, reason]);
  await pool.query(
    `INSERT INTO telemetry (id, at, account_id, event, props)
     VALUES ('upgrade-corner-telemetry',$1,$2,'corner',$3)`,
    [paidAt, upgraded.accountId, JSON.stringify({ kind: upgradedCornerTask.kind, district: 'docks' })]);
  await pool.query(
    "INSERT INTO activity_log (account_id, day, tag, n) VALUES ($1,$2,'yardtale',1)",
    [upgraded.accountId, today]);

  // Pre-latch death replay could pay the same semantic Daily card more than once. Three historical
  // base payouts A,A,B must consume all three account slots: the duplicate cannot collapse onto A's
  // primary key and leave C available as a fourth base reward (plus a fresh full-envelope payout).
  const duplicateLegacy = await create('Duplicate Legacy Daily');
  const duplicateHeir = 'duplicate-legacy-daily-heir';
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [duplicateLegacy.id]);
  await pool.query(
    `INSERT INTO characters (id, account_id, name, generation, alive, season)
     VALUES ($1,$2,'Duplicate Legacy Daily',2,true,$3)`,
  [duplicateHeir, duplicateLegacy.accountId, Math.floor(today / 28)]);
  const duplicateReasons = [jobs[0].id, jobs[0].id, jobs[1].id];
  for (let i = 0; i < duplicateReasons.length; i++) await pool.query(
    `INSERT INTO transactions (id, at, character_id, currency, amount, reason)
     VALUES ($1,$2,$3,'cash',200,$4)`,
  [`duplicate-daily-${i}`, paidAt, duplicateLegacy.id, `daily:${duplicateReasons[i]}`]);

  await pool.query("DELETE FROM economy_migrations WHERE id='account-daily-lineage-2026-10-21'");
  assert.deepEqual(await migrateEconomyDailyClaims(pool, today), { applied: true });
  const upgradedAccount = (await pool.query(
    'SELECT checkin_day, checkin_streak, checkins_lifetime, omr FROM account_persistent WHERE account_id=$1',
    [upgraded.accountId])).rows[0];
  assert.equal(Number(upgradedAccount.checkin_day), today);
  assert.equal(Number(upgradedAccount.checkin_streak), 6);
  assert.equal(Number(upgradedAccount.checkins_lifetime), 1,
    'first cutover replaces replay-inflated lifetime progress with distinct paid check-in days');
  assert.equal(Number(upgradedAccount.omr), 3, 'migration moves no value');
  assert.equal((await claimsOf(upgraded.accountId)).filter((id) => id === 'checkin:claim').length, 1,
    'same-day legacy check-in replays restore one durable account/day latch');
  assert.equal((await call('POST', '/v1/checkin', { token: upgraded.token })).body.error, 'done');
  await setCounters(upgradedHeir, completedCounters);
  for (const job of jobs)
    assert.equal((await call('POST', `/v1/daily/${job.id}/claim`, { token: upgraded.token })).body.error, 'claimed');
  assert((await claimsOf(upgraded.accountId)).includes('hustle:payoff'));
  assert((await claimsOf(upgraded.accountId)).includes('pen:talk'));
  assert.equal((await claimsOf(upgraded.accountId)).filter((id) => id.startsWith('corner:')).length, 1);
  assert((await claimsOf(upgraded.accountId)).includes(`corner:${upgradedCornerTask.kind}`),
    'boot migration recovers the paid corner kind from durable telemetry, rather than only an anonymous slot');
  const upgradedBeforeReplay = (await pool.query(
    'SELECT cash, respect FROM characters WHERE id=$1', [upgradedHeir])).rows[0];
  assert.equal((await call('POST', `/v1/corner/${upgradedCornerTask.slot}/accept`, { token: upgraded.token })).body.error,
    'done_kind', 'an already-created heir cannot repeat the exact pre-upgrade corner kind');
  assert.deepEqual((await pool.query(
    'SELECT cash, respect FROM characters WHERE id=$1', [upgradedHeir])).rows[0], upgradedBeforeReplay,
  'the rejected pre-upgrade replay changes no heir value');
  assert.equal(Number((await pool.query(
    `SELECT COUNT(*) n FROM transactions t JOIN characters c ON c.id=t.character_id
      WHERE c.account_id=$1 AND t.reason='corner:job'`, [upgraded.accountId])).rows[0].n), 1,
  'the lineage retains exactly one ledgered corner payout');

  const duplicateClaimRows = (await pool.query(
    `SELECT claim_id FROM account_daily_claims
      WHERE account_id=$1 AND day=$2 AND scope='daily' ORDER BY claim_id`,
  [duplicateLegacy.accountId, today])).rows.map((row) => row.claim_id);
  assert.equal(duplicateClaimRows.length, 3,
    'three legacy base payouts consume three durable slots even when two share one semantic id');
  assert(duplicateClaimRows.includes(jobs[0].id) && duplicateClaimRows.includes(jobs[1].id),
    'migration restores every distinct semantic id before allocating anonymous duplicate slots');
  assert.equal(duplicateClaimRows.filter((id) => id.startsWith('legacy:duplicate-daily-')).length, 1,
    'the excess duplicate ledger row receives one anonymous slot');
  assert.equal(Number((await pool.query(
    `SELECT COUNT(*) n FROM account_daily_claims
      WHERE account_id=$1 AND day=$2 AND scope='daily-envelope' AND claim_id='all'`,
  [duplicateLegacy.accountId, today])).rows[0].n), 1,
  'three recovered base payouts close the full envelope before serving the heir');

  // A rolling deploy can take its first snapshot while one old API request is still in flight. The
  // old revision may then pay and erase character-scoped progress before its container exits. A
  // later process startup must reconcile durable evidence even though the first-run marker exists.
  const lateLegacy = await create('Late Rolling Claim');
  const lateLegacyHeir = 'late-rolling-claim-heir';
  await pool.query('UPDATE characters SET alive=false, checkin_day=$2, streak=7 WHERE id=$1',
    [lateLegacy.id, today]);
  await pool.query(
    `UPDATE account_persistent
        SET checkins_lifetime=checkins_lifetime+1, checkin_day=0, checkin_streak=0
      WHERE account_id=$1`, [lateLegacy.accountId]);
  await pool.query(
    `INSERT INTO characters (id, account_id, name, generation, alive, season)
     VALUES ($1,$2,'Late Rolling Claim',2,true,$3)`,
  [lateLegacyHeir, lateLegacy.accountId, Math.floor(today / 28)]);
  await pool.query(
    `INSERT INTO transactions (id, at, character_id, currency, amount, reason)
     VALUES ('late-rolling-daily',$1,$2,'cash',200,$3)`,
  [paidAt, lateLegacy.id, `daily:${jobs[0].id}`]);
  await pool.query(
    `INSERT INTO transactions (id, at, character_id, currency, amount, reason)
     VALUES ('late-rolling-checkin',$1,$2,'cash',350,'checkin')`,
  [paidAt, lateLegacy.id]);
  await pool.query(
    `INSERT INTO transactions (id, at, character_id, currency, amount, reason)
     VALUES ('late-rolling-corner',$1,$2,'cash',400,'corner:job')`,
  [paidAt, lateLegacy.id]);
  await pool.query(
    `INSERT INTO telemetry (id, at, account_id, event, props)
     VALUES ('late-rolling-corner-telemetry',$1,$2,'corner',$3)`,
  [paidAt, lateLegacy.accountId, JSON.stringify({ kind: upgradedCornerTask.kind, district: 'docks' })]);
  assert.deepEqual(await claimsOf(lateLegacy.accountId), [],
    'the simulated old revision leaves no account latch after its post-snapshot death');
  assert.deepEqual(await migrateEconomyDailyClaims(pool, today), { applied: false },
    'an existing marker records history but does not suppress cutover reconciliation');
  assert.deepEqual(await claimsOf(lateLegacy.accountId), [
    'checkin:claim', `corner:${upgradedCornerTask.kind}`, `daily:${jobs[0].id}`,
  ].sort(), 'the next process startup recovers claims settled after the first snapshot');
  assert.deepEqual((await pool.query(
    `SELECT checkin_day, checkin_streak, checkins_lifetime
       FROM account_persistent WHERE account_id=$1`, [lateLegacy.accountId])).rows[0], {
    checkin_day: today, checkin_streak: 7, checkins_lifetime: 1,
  }, 'bounded cutover reconciliation restores exact check-in day/streak and preserves lifetime');
  assert.equal((await call('POST', '/v1/checkin', { token: lateLegacy.token })).body.error, 'done',
    'the heir cannot replay a check-in settled after the first snapshot');
  await setCounters(lateLegacyHeir, completedCounters);
  assert.equal((await call('POST', `/v1/daily/${jobs[0].id}/claim`, {
    token: lateLegacy.token,
  })).body.error, 'claimed', 'the heir cannot replay a post-snapshot legacy payout');
  const upgradedClaimsBeforeRepeat = await claimsOf(upgraded.accountId);
  const lateClaimsBeforeRepeat = await claimsOf(lateLegacy.accountId);
  assert.deepEqual(await migrateEconomyDailyClaims(pool, today), { applied: false });
  assert.deepEqual(await claimsOf(upgraded.accountId), upgradedClaimsBeforeRepeat,
    'repeat reconciliation does not allocate a second slot for an already-latched corner claim');
  assert.deepEqual(await claimsOf(lateLegacy.accountId), lateClaimsBeforeRepeat,
    'repeat reconciliation is idempotent for late rolling-deploy evidence');

  await setCounters(duplicateHeir, completedCounters);
  const duplicateBefore = {
    character: (await pool.query('SELECT cash, energy FROM characters WHERE id=$1', [duplicateHeir])).rows[0],
    omr: Number((await pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [duplicateLegacy.accountId])).rows[0].omr),
    ledger: Number((await pool.query(
      `SELECT COUNT(*) n FROM transactions t JOIN characters c ON c.id=t.character_id
        WHERE c.account_id=$1 AND t.reason LIKE 'daily:%'`, [duplicateLegacy.accountId])).rows[0].n),
  };
  for (const job of jobs)
    assert.equal((await call('POST', `/v1/daily/${job.id}/claim`, { token: duplicateLegacy.token })).body.error,
      'claimed', `legacy duplicate slots keep ${job.id} closed to the heir`);
  const duplicateAfter = {
    character: (await pool.query('SELECT cash, energy FROM characters WHERE id=$1', [duplicateHeir])).rows[0],
    omr: Number((await pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [duplicateLegacy.accountId])).rows[0].omr),
    ledger: Number((await pool.query(
      `SELECT COUNT(*) n FROM transactions t JOIN characters c ON c.id=t.character_id
        WHERE c.account_id=$1 AND t.reason LIKE 'daily:%'`, [duplicateLegacy.accountId])).rows[0].n),
  };
  assert.deepEqual(duplicateAfter, duplicateBefore,
    'postdeploy replay adds no fourth base reward, cash, energy, $OMR, or envelope ledger row');

  // Stable database slots enforce board-wide limits even if identifiers rotate in a same-day deploy.
  const rotated = await create('Rotated Board');
  for (const id of ['old-a', 'old-b', 'old-c'])
    assert.equal(await takeBoundedAccountDailyClaim(pool, rotated.accountId, today, 'daily', id, 3), true);
  assert.equal(await takeBoundedAccountDailyClaim(pool, rotated.accountId, today, 'daily', 'new-a', 3), false,
    'three paid slots remain the ceiling when a deployment changes job ids');
  await setCounters(rotated.id, completedCounters);
  assert((await call('GET', '/v1/daily', { token: rotated.token })).body.jobs.every((job) => job.claimed),
    'three old-board slots render the replacement board fully consumed instead of offering impossible claims');

  const partialRotation = await create('Partial Rotation');
  assert.equal(await takeBoundedAccountDailyClaim(
    pool, partialRotation.accountId, today, 'daily', 'old-board-id', 3), true);
  await setCounters(partialRotation.id, completedCounters);
  const rotatedBoard = (await call('GET', '/v1/daily', { token: partialRotation.token })).body.jobs;
  assert.equal(rotatedBoard.filter((job) => job.claimed).length, 1,
    'one old-board payout consumes exactly one visible replacement card');
  const rotatedOpen = rotatedBoard.filter((job) => !job.claimed);
  const rotatedFirst = await call('POST', `/v1/daily/${rotatedOpen[0].id}/claim`, { token: partialRotation.token });
  assert.equal(rotatedFirst.code, 200, JSON.stringify(rotatedFirst.body));
  assert.equal(rotatedFirst.body.all, false);
  const rotatedFinal = await call('POST', `/v1/daily/${rotatedOpen[1].id}/claim`, { token: partialRotation.token });
  assert.equal(rotatedFinal.code, 200, JSON.stringify(rotatedFinal.body));
  assert.equal(rotatedFinal.body.all, true, 'the third occupied slot pays the full envelope across board ids');
  assert((await call('GET', '/v1/daily', { token: partialRotation.token })).body.jobs.every((job) => job.claimed),
    'the rotated board and mutation agree once all slots are occupied');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM account_daily_claims WHERE account_id=$1 AND day=$2 AND scope='daily-envelope'",
    [partialRotation.accountId, today])).rows[0].n), 1, 'the full envelope has its own once-per-account/day latch');

  // A mixed-version process can leave a paid character claim after the one-time boot repair has
  // already run. The next current mutation must materialize that legacy claim into an account slot
  // before paying, so death cannot reopen it and the third total payout still awards the envelope.
  const mixedVersion = await create('Mixed Version Daily');
  await setCounters(mixedVersion.id, completedCounters);
  await pool.query('UPDATE daily_progress SET claimed=$3 WHERE character_id=$1 AND day=$2',
    [mixedVersion.id, today, JSON.stringify([jobs[0].id])]);
  const mixedSecond = await call('POST', `/v1/daily/${jobs[1].id}/claim`, { token: mixedVersion.token });
  assert.equal(mixedSecond.code, 200, JSON.stringify(mixedSecond.body));
  assert.equal(mixedSecond.body.all, false);
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM account_daily_claims WHERE account_id=$1 AND day=$2 AND scope='daily'",
    [mixedVersion.accountId, today])).rows[0].n), 2, 'mutation bridges the character-only paid claim before paying');
  const mixedFinal = await call('POST', `/v1/daily/${jobs[2].id}/claim`, { token: mixedVersion.token });
  assert.equal(mixedFinal.code, 200, JSON.stringify(mixedFinal.body));
  assert.equal(mixedFinal.body.all, true, 'the third total payout still wins one full envelope');

  const player = await create('Daily Lineage');
  await pool.query('UPDATE street_tax SET fund=100 WHERE id=1');
  const counters = { ...completedCounters };
  await setCounters(player.id, counters);
  for (const job of jobs) {
    const result = await call('POST', `/v1/daily/${job.id}/claim`, { token: player.token });
    assert.equal(result.code, 200, `${job.id}: ${JSON.stringify(result.body)}`);
  }
  assert.equal(Number((await pool.query(
    "SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE character_id=$1 AND reason LIKE 'daily:%' AND currency='cash'",
    [player.id])).rows[0].s) > 0, true, 'daily board paid cash');

  const cornerTask = cornerTasksOf('docks', today)[0];
  assert.equal((await call('POST', `/v1/corner/${cornerTask.slot}/accept`, { token: player.token })).code, 200);
  counters[cornerTask.kind] = Number(counters[cornerTask.kind] || 0) + 1;
  await setCounters(player.id, counters);
  const cornerPaid = await call('POST', `/v1/corner/${cornerTask.slot}/claim`, { token: player.token });
  assert.equal(cornerPaid.code, 200, JSON.stringify(cornerPaid.body));
  assert(cornerPaid.body.cash > 0);

  const hustle = hustleOf(player.id, today);
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [player.id, hustle.stops[0]]);
  assert.equal((await call('POST', '/v1/hustle/advance', { token: player.token })).code, 200);
  counters[hustle.leg.kind] = Number(counters[hustle.leg.kind] || 0) + 1;
  await setCounters(player.id, counters);
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [player.id, hustle.stops[1]]);
  assert.equal((await call('POST', '/v1/hustle/advance', { token: player.token })).code, 200);
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [player.id, hustle.stops[2]]);
  const hustlePaid = await call('POST', '/v1/hustle/advance', { token: player.token });
  assert.equal(hustlePaid.code, 200, JSON.stringify(hustlePaid.body));
  assert(hustlePaid.body.pay > 0);

  await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1',
    [player.id, new Date(Date.now() + 3600000)]);
  const penTalk = await call('POST', '/v1/pen/talk', { token: player.token });
  assert.equal(penTalk.code, 200, JSON.stringify(penTalk.body));
  assert.equal(penTalk.body.effect, 'story', 'the pinned day exercises the account-level yardtale activity path');
  const yardActivity = Number((await pool.query(
    "SELECT n FROM activity_log WHERE account_id=$1 AND day=$2 AND tag='yardtale'",
    [player.accountId, today])).rows[0].n);

  const expectedClaims = [
    ...jobs.map((job) => `daily:${job.id}`),
    'daily-envelope:all',
    `corner:${cornerTask.kind}`,
    'hustle:payoff',
    'pen:talk',
  ].sort();
  assert.deepEqual(await claimsOf(player.accountId), expectedClaims,
    'every positive-value daily board writes an account/day latch in the paying transaction');

  const heirId = await kill(player.id);
  const omrAfterDeath = Number((await pool.query(
    'SELECT omr FROM account_persistent WHERE account_id=$1', [player.accountId])).rows[0].omr);
  await setCounters(heirId, counters);
  await pool.query('UPDATE characters SET cash=777, energy=0, loc=$2 WHERE id=$1', [heirId, 'docks']);

  const dailyBoard = (await call('GET', '/v1/daily', { token: player.token })).body;
  assert(dailyBoard.jobs.every((job) => job.claimed), 'the heir board retains every account claim');
  const heirRow = (await pool.query('SELECT * FROM characters WHERE id=$1', [heirId])).rows[0];
  const inheritedWork = (await loadOwned(pool, heirRow)).work;
  assert.deepEqual(new Set(inheritedWork.dailyClaimedIds), new Set(jobs.map((job) => job.id)),
    'the coach snapshot sees inherited daily claims');
  assert.equal(inheritedWork.hustleStep, 3, 'the coach snapshot sees the inherited hustle payoff');
  assert.deepEqual(inheritedWork.cornerOpen, [], 'the coach snapshot does not advertise an account-paid corner kind');
  for (const job of jobs) {
    const replay = await call('POST', `/v1/daily/${job.id}/claim`, { token: player.token });
    assert.equal(replay.body.error, 'claimed', `heir cannot replay ${job.id}`);
  }
  const cornerBoard = (await call('GET', '/v1/corner', { token: player.token })).body;
  const inheritedCorner = cornerBoard.tasks.find((task) => task.kind === cornerTask.kind);
  assert.equal(inheritedCorner.claimed, true);
  assert.equal(inheritedCorner.canAccept, false);
  assert.equal((await call('POST', `/v1/corner/${inheritedCorner.slot}/accept`, { token: player.token })).body.error, 'done_kind');
  assert.equal((await call('GET', '/v1/hustle', { token: player.token })).body.done, true);
  assert.equal((await call('POST', '/v1/hustle/advance', { token: player.token })).body.error, 'done');
  await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1',
    [heirId, new Date(Date.now() + 3600000)]);
  assert.equal((await call('GET', '/v1/pen', { token: player.token })).body.yardLife.talked, true);
  assert.equal((await call('POST', '/v1/pen/talk', { token: player.token })).body.error, 'talked');
  assert.equal(Number((await pool.query(
    "SELECT n FROM activity_log WHERE account_id=$1 AND day=$2 AND tag='yardtale'",
    [player.accountId, today])).rows[0].n), yardActivity,
  'heir replay cannot multiply account-level broker activity');

  const heirState = (await pool.query('SELECT cash, energy FROM characters WHERE id=$1', [heirId])).rows[0];
  assert.equal(Number(heirState.cash), 777, 'rejected heir claims mint no cash');
  assert.equal(Number(heirState.energy), 0, 'rejected full-envelope replay refills no energy');
  assert.equal(Number((await pool.query(
    'SELECT omr FROM account_persistent WHERE account_id=$1', [player.accountId])).rows[0].omr), omrAfterDeath,
  'rejected full-envelope replay draws no additional event-fund OMR');
  assert.equal(Number((await pool.query(
    `SELECT COUNT(*) n FROM transactions WHERE character_id=$1
      AND (reason LIKE 'daily:%' OR reason='corner:job' OR reason='hustle:payoff')`, [heirId])).rows[0].n), 0,
  'the heir creates no duplicate faucet rows');

  // Partial boards retain their exact semantics: two claims before death plus the final distinct
  // claim on the heir pay the full-envelope bonus once, rather than losing it or paying it twice.
  const partial = await create('Partial Daily');
  await setCounters(partial.id, counters);
  for (const job of jobs.slice(0, 2))
    assert.equal((await call('POST', `/v1/daily/${job.id}/claim`, { token: partial.token })).code, 200);
  const partialHeir = await kill(partial.id);
  await setCounters(partialHeir, counters);
  await pool.query('UPDATE characters SET energy=0 WHERE id=$1', [partialHeir]);
  const finalClaim = await call('POST', `/v1/daily/${jobs[2].id}/claim`, { token: partial.token });
  assert.equal(finalClaim.code, 200, JSON.stringify(finalClaim.body));
  assert.equal(finalClaim.body.all, true);
  assert.equal(finalClaim.body.energyRefilled, true);
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM transactions WHERE account_id=$1 AND reason='daily:all'",
    [partial.accountId])).rows[0].n), 1, 'the full-envelope OMR transfer lands once across the lineage');
  assert.equal((await call('POST', `/v1/daily/${jobs[2].id}/claim`, { token: partial.token })).body.error, 'claimed');

  // The account-wide corner ceiling is independent of which character accepted the work.
  const capTask = cornerTasksOf('docks', today)[0];
  for (let i = 0; i < CORNER.MAX_DAY; i++) await pool.query(
    "INSERT INTO account_daily_claims (account_id, day, scope, claim_id) VALUES ($1,$2,'corner',$3)",
    [partial.accountId, today, `cap-${i}`]);
  await pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [partialHeir]);
  assert.equal((await call('POST', `/v1/corner/${capTask.slot}/accept`, { token: partial.token })).code, 200);
  const partialProgress = (await pool.query(
    'SELECT counters FROM daily_progress WHERE character_id=$1 AND day=$2', [partialHeir, today])).rows[0];
  const partialCounters = JSON.parse(partialProgress.counters);
  partialCounters[capTask.kind] = Number(partialCounters[capTask.kind] || 0) + 1;
  await setCounters(partialHeir, partialCounters);
  const cashAtCap = Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [partialHeir])).rows[0].cash);
  assert.equal((await call('POST', `/v1/corner/${capTask.slot}/claim`, { token: partial.token })).body.error, 'capped');
  assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [partialHeir])).rows[0].cash), cashAtCap,
    'a sixth account/day envelope mints no cash');

  // pg-mem does not serialize row locks: with four envelopes already paid, three simultaneous
  // distinct claims must still share the single remaining database slot.
  const cornerRace = await create('Corner Slot Race');
  await pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [cornerRace.id]);
  for (let slot = 1; slot < CORNER.MAX_DAY; slot++) await pool.query(
    `INSERT INTO account_daily_claims (account_id, day, scope, claim_id, slot)
     VALUES ($1,$2,'corner',$3,$4)`, [cornerRace.accountId, today, `prior-${slot}`, slot]);
  const raceTasks = cornerTasksOf('docks', today);
  for (const task of raceTasks)
    assert.equal((await call('POST', `/v1/corner/${task.slot}/accept`, { token: cornerRace.token })).code, 200);
  const raceCounters = {};
  for (const task of raceTasks) raceCounters[task.kind] = 1;
  await setCounters(cornerRace.id, raceCounters);
  const raced = await Promise.all(raceTasks.map((task) =>
    call('POST', `/v1/corner/${task.slot}/claim`, { token: cornerRace.token })));
  assert.equal(raced.filter((result) => result.code === 200).length, 1,
    'only the one remaining corner slot can pay under concurrent requests');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM account_daily_claims WHERE account_id=$1 AND day=$2 AND scope='corner'",
    [cornerRace.accountId, today])).rows[0].n), CORNER.MAX_DAY);
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM transactions t JOIN characters c ON c.id=t.character_id WHERE c.account_id=$1 AND t.reason='corner:job'",
    [cornerRace.accountId])).rows[0].n), 1, 'losing concurrent claims create no ledger faucet row');

  // Migration bridge: claims made before account_daily_claims existed are copied before estate wipe.
  const legacy = await create('Legacy Daily');
  await pool.query(
    'INSERT INTO daily_progress (character_id, day, counters, claimed) VALUES ($1,$2,$3,$4)',
    [legacy.id, today, '{}', JSON.stringify([jobs[0].id])]);
  await pool.query(
    `INSERT INTO corner_jobs (character_id, day, district, slot, baseline, claimed)
     VALUES ($1,$2,'docks',$3,'{}',true)`, [legacy.id, today, cornerTask.slot]);
  await pool.query(
    "INSERT INTO hustles (character_id, day, step, baseline) VALUES ($1,$2,3,'{}')",
    [legacy.id, today]);
  await pool.query('INSERT INTO pen_talks (character_id, day) VALUES ($1,$2)', [legacy.id, today]);
  await kill(legacy.id);
  assert.deepEqual(await claimsOf(legacy.accountId), [
    `corner:${cornerTask.kind}`, `daily:${jobs[0].id}`, 'hustle:payoff', 'pen:talk',
  ].sort(), 'estate preserves pre-migration paid rows before deleting character progress');

  console.log('✅ Daily lineage regression passed — contracts, corner envelopes, hustle payoff, yardtale activity, full-envelope energy/OMR, and legacy paid rows stay capped per account/day through repeated heirs');
} finally {
  Date.now = realNow;
  await app.close();
}
