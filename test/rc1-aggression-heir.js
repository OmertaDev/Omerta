// Bounded canonical lethal-combat/estate exercise. This is not a 70% actor policy.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';

assert(process.argv.includes('--postgres'), 'Explicit native PostgreSQL exercise only');
const output = process.env.RC1_HEIR_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and explicit local PostgreSQL required');
const source = await sourceIdentity();
const database = planOwnedWorldDatabase({ controlUrl, runId: 'aggression-heir-native', sourceRevision: source.revision });
for (const key of ['SEARCH_MS', 'SHOOT_CD_MS', 'SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL',
  'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL'])
  assert(!process.env[key], `Undeclared timing/external override: ${key}`);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), seasonMs = 28 * 86400000;
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'scoped-aggression-canonical-death-heir', seed: 'rc1-alpha', sourcePins: WORKER_SOURCE_PINS,
  database: database.descriptor, epoch: new Date(epoch).toISOString(), expectedDormant,
  initialization: { actors: 2, shooterLevel: 250, victimLevel: 10, stats: 'Default5/5/5',
    resources: 'Schema-default cash500/ammo25/cb0. Shooter owns one declared legal Rusty .25 fixture. No earned acquisition history is claimed for fixture respect or weapon.',
    funding: 'One ordinary check-in each; shooter buys40 original $2,000/50-round boxes. Victim posts a $2,000 order with original4h TTL.',
    exclusions: 'No account privilege, paid mint, revive insurance, family membership, status/deadline or resource-balance fixtures.' },
  clocks: 'Shared application and SQL logical clocks; execute every due original local worker callback across original3h search. No wall-time equivalence or timer compression.',
  workload: 'One early canonical searching denial, one fixed2,000-round fire after own/public projections permit it, exact retry, same-account heir reads and up to5 ordinary pickpocket attempts until first win.',
  resourceCoverage: 'Current exact observer equations and55 canonical invariants; unknown receipt and ownership lineages remain explicit, never upgraded to full-resource clearance.',
  excludedIntegrations: ['chain watcher without configured RPC', 'disabled liquidity automation', 'unavailable external RWA registry', 'population spawning disabled'],
  exclusions: ['Full high-aggression selection policy for search/fire', '70% mixed-choice proof', 'naturally earned initial progression and weapon',
    'full13resource lineage', 'same-seed world replay', 'all death/ownership branches', '90days/225runs', 'production and real-player qualification'] };
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
  COORDINATION_ACCOUNT_IDS: '', LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '',
  RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId: 'aggression-heir-native',
  seed: configuration.seed, scenarioId: configuration.scenario, population: 2 });
const runtime = installSerialRuntime(configuration.seed, configuration.epoch); let at = epoch;
runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
const namespace = `rc1_worker_heir_${process.pid}_${Math.floor(performance.now())}`;
const base = new pg.Pool({ connectionString: database.url });
const seam = installWorkerInstrumentation(controller, { namespace });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
let app, result, resourceSequence = 0, invariantBoundaries = 0;
const unsupported = [], resourceSummaries = [];
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() });
  await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 });
  await seam.clock.initialize(bootstrap);
  // Install the source-pinned loader before any production import can cache db.js.
  const [{ buildServer }, { PACING, CONSTANTS, M3, levelOf }, { runLedgerInvariants }, observer] = await Promise.all([
    import('../src/server.js'), import('../src/rules.js'), import('../src/invariants.js'), import('../tools/rc1-world-resource-observer.js')]);
  assert.equal(CONSTANTS.SEARCH_MS, 10800000); assert.equal(CONSTANTS.SHOOT_CD_MS, 7200000);
  app = await buildServer();
  const pool = app.pool;
  for (const [accountId, level] of [['heir-shooter', 250], ['heir-victim', 10]]) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accountId]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accountId]);
    await pool.query('INSERT INTO characters(id,account_id,name,season,respect) VALUES($1,$2,$2,$3,$4)',
      [`${accountId}-character`, accountId, Math.floor(epoch / seasonMs), PACING.LEVEL_DIVISOR * (level - 1) ** 2]);
  }
  await pool.query("INSERT INTO character_guns(character_id,gun_id) VALUES('heir-shooter-character','lastresort')");
  // Owned weapon selection remains an ordinary authenticated action below.
  const tokens = Object.fromEntries(['heir-shooter', 'heir-victim'].map((id) => [id, app.jwt.sign({ sub: id, tv: 0 })]));
  const invariants = async (label) => {
    const report = await runLedgerInvariants(pool, { alert: false }); assert(report.ok, JSON.stringify(report));
    invariantBoundaries++; await proof.record({ kind: 'canonical-invariants', label, logicalAt: at, checks: report.checks });
    return report.checks.length;
  };
  async function reconcile(before, after, identity) {
    const journal = observer.reconcileWorldResources(before, after, { identity, includeRestrictedChanges: true });
    const label = `resource-${resourceSequence++}`;
    await proof.artifact(`${label}.json`, journal);
    unsupported.push(...journal.unsupported.map((entry) => ({ boundary: label, ...entry })));
    resourceSummaries.push({ label, identity, beforeHash: journal.beforeHash, afterHash: journal.afterHash,
      status: journal.status, checks: journal.checks.length, unsupported: journal.unsupported.length });
    await proof.record({ kind: 'resource-boundary', ...resourceSummaries.at(-1) });
  }
  async function observed(identity, work) {
    const before = await observer.snapshotWorldResources(pool); let value, actionError;
    try { value = await work(); } catch (error) { actionError = error; }
    const after = await observer.snapshotWorldResources(pool);
    try { await reconcile(before, after, identity); }
    catch (error) {
      await proof.artifact(`resource-failure-${resourceSequence++}.json`, { identity, before, after, error: error.message }); throw error;
    }
    if (actionError) throw actionError; return value;
  }
  async function invoke(accountId, method, path, body, key, expectedStatus = 200) {
    const identity = { accountId, method, path, logicalAt: at,
      ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) };
    const response = await observed(identity, () => proof.invoke('authenticated-http', identity, async () => {
      const raw = await app.inject({ method, url: path, headers: { authorization: `Bearer ${tokens[accountId]}`,
        ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
      return { status: raw.statusCode, replayed: raw.headers['x-idempotent-replay'] === 'true', body: raw.json() };
    }));
    assert.equal(response.status, expectedStatus, JSON.stringify(response));
    if (method !== 'GET') await invariants(path);
    return response;
  }
  const shooter = 'heir-shooter', victim = 'heir-victim', oldId = `${victim}-character`;
  const initialInvariantChecks = await invariants('fixture');
  await proof.record({ kind: 'measured-initialization', fixture: configuration.initialization, fixtureWritesAfterThisRecord: false });
  await proof.snapshot(pool, 'initial');
  for (const account of [shooter, victim]) await invoke(account, 'POST', '/v1/checkin', {}, `checkin-${account}`);
  await invoke(shooter, 'POST', '/v1/armory/gun/lastresort/equip', {}, 'equip-fixture-weapon');
  for (let box = 0; box < 40; box++) await invoke(shooter, 'POST', '/v1/armory/ammo', {}, `buy-ammo-${box}`);
  const order = await invoke(victim, 'POST', '/v1/market/order', { goodId: 'gin', qty: 1, price: 2000, hours: 4 }, 'victim-custody-order');
  assert.equal(order.body.escrow, 2000); assert.equal(order.body.expiresSeconds, 14400);
  const own = (await invoke(shooter, 'GET', '/v1/me')).body.character;
  const board = (await invoke(shooter, 'GET', '/v1/streets')).body.streets;
  const target = board.find((entry) => entry.id === oldId); assert(target);
  assert.equal(target.loc, own.loc); assert.equal(target.jailed, false); assert.equal(target.hospitalized, false);
  assert.equal(own.ammo, 2025); assert.equal(own.gun, 'lastresort'); assert(own.energy >= M3.FIRE_ENERGY);
  const search = await invoke(shooter, 'POST', `/v1/streets/${target.id}/search`, {}, 'original-search');
  const deadline = Date.parse(search.body.placedAt); assert.equal(deadline - at, CONSTANTS.SEARCH_MS);
  const early = await invoke(shooter, 'POST', `/v1/streets/${target.id}/fire`, { rounds: 2000 }, 'early-fire', 400);
  assert.equal(early.body.error, 'searching');
  const notReady = (await invoke(shooter, 'GET', '/v1/me')).body.character;
  assert.equal(notReady.ammo, own.ammo); assert.equal(notReady.energy, own.energy);
  await proof.snapshot(pool, 'search-pending');
  await observed({ authority: 'original-worker-boot', logicalAt: at }, () => bootOriginalWorker(controller));
  await invariants('worker-boot');
  let previousResources = await observer.snapshotWorldResources(pool);
  await controller.advanceTo(deadline, async (logicalAt, label) => {
    const after = await observer.snapshotWorldResources(pool);
    await reconcile(previousResources, after, { authority: 'original-worker-callback', label, logicalAt });
    previousResources = after; await invariants(`worker:${label}`);
  });
  const clock = (await pool.query('SELECT now() AS tx,clock_timestamp() AS statement')).rows[0];
  assert.equal(clock.tx.getTime(), at); assert.equal(clock.statement.getTime(), at);
  const ready = (await invoke(shooter, 'GET', '/v1/me')).body.character;
  assert.equal(ready.hunt?.targetId, target.id); assert.equal(ready.hunt?.placedSeconds, 0);
  assert.equal(ready.gun, 'lastresort'); assert(ready.ammo >= 2000); assert(ready.energy >= M3.FIRE_ENERGY);
  const targetAgain = (await invoke(shooter, 'GET', '/v1/streets')).body.streets.find((entry) => entry.id === target.id);
  assert(targetAgain && targetAgain.loc === ready.loc && !targetAgain.jailed && !targetAgain.hospitalized);
  const estateBefore = (await pool.query('SELECT * FROM market_listings WHERE id=$1', [order.body.id])).rows[0];
  assert.equal(estateBefore.status, 'live'); assert.equal(estateBefore.seller_character, oldId);
  assert(new Date(estateBefore.expires_at).getTime() > at);
  await proof.snapshot(pool, 'before-fatal-fire');
  const killed = await invoke(shooter, 'POST', `/v1/streets/${target.id}/fire`, { rounds: 2000 }, 'fatal-fire');
  assert.equal(killed.body.kill, true); assert.equal(killed.body.fired, 2000); assert.equal(killed.body.shootCdSeconds, 7200);
  assert.equal(killed.body.lootable, true); assert(killed.body.loot > 0); assert(killed.body.orderLoot > 0);
  const heirId = killed.body.estate.heirId; assert(heirId && heirId !== oldId);
  const deathSnapshot = await proof.snapshot(pool, 'after-fatal-fire');
  const replay = await invoke(shooter, 'POST', `/v1/streets/${target.id}/fire`, { rounds: 2000 }, 'fatal-fire');
  assert.equal(replay.replayed, true); assert.deepEqual(replay.body, killed.body);
  const replaySnapshot = await proof.snapshot(pool, 'after-fatal-replay'); assert.equal(replaySnapshot.stateSha256, deathSnapshot.stateSha256);
  const dead = (await pool.query('SELECT * FROM characters WHERE id=$1', [oldId])).rows[0];
  assert.equal(dead.alive, false); for (const field of ['cash', 'bank', 'cb', 'ammo']) assert.equal(Number(dead[field]), 0);
  assert.equal((await pool.query('SELECT 1 FROM market_listings WHERE id=$1', [order.body.id])).rowCount, 0);
  const account = (await pool.query('SELECT prestige,deaths FROM account_persistent WHERE account_id=$1', [victim])).rows[0];
  assert.equal(Number(account.deaths), 1); assert.equal(Number(account.prestige), 5);
  const heirs = (await pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [victim])).rows;
  assert.equal(heirs.length, 1); const heir = heirs[0]; assert.equal(heir.id, heirId); assert.equal(heir.name, victim);
  assert.equal(heir.generation, 2); assert.equal(levelOf(Number(heir.respect)), 1);
  assert.equal(Number(heir.cash), 1000); assert.equal(Number(heir.ammo), 25);
  const estateLedger = (await pool.query("SELECT * FROM transactions WHERE reason IN ('death:estate','death:legacy','whack:loot','market:loot','market:death') ORDER BY id")).rows;
  assert(estateLedger.some((entry) => entry.character_id === heirId && entry.reason === 'death:legacy' && Number(entry.amount) === 500));
  const escrowOut = estateLedger.filter((entry) => entry.counterparty === oldId && ['market:loot', 'market:death'].includes(entry.reason));
  assert.equal(escrowOut.reduce((sum, entry) => sum + Number(entry.amount), 0), -2000);
  assert(escrowOut.some((entry) => entry.reason === 'market:loot')); assert(escrowOut.some((entry) => entry.reason === 'market:death'));
  await proof.artifact('estate-loss-and-lineage.json', { dead, heir, account, originalOrder: estateBefore, estateLedger,
    replacementAuthority: 'Canonical runEstate inside authenticated fire; no harness birth/status/resource edits' });
  const session = await invoke(victim, 'GET', '/v1/session'); assert.equal(session.body.character.id, heirId);
  const heirView = (await invoke(victim, 'GET', '/v1/me')).body.character; assert.equal(heirView.id, heirId);
  assert.equal(heirView.generation, 2); assert.equal(heirView.cash, 1000);
  const checkin = await invoke(victim, 'POST', '/v1/checkin', {}, 'heir-checkin'); assert.equal(checkin.body.character.id, heirId);
  const crimeOutcomes = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await invoke(victim, 'POST', '/v1/crimes/pick', { approach: 'standard' }, `heir-crime-${attempt}`);
    assert.equal(response.body.character.id, heirId); crimeOutcomes.push(response.body);
    if (response.body.success) break;
  }
  assert(crimeOutcomes.some((entry) => entry.success), 'Bounded heir recovery did not achieve a successful ordinary crime');
  const recovered = (await invoke(victim, 'GET', '/v1/me')).body.character;
  assert.equal(recovered.id, heirId); assert(recovered.respect > 0); assert(recovered.cash > 1000);
  const trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map((label) =>
    [label, trace.events.filter((entry) => entry.kind === 'timer.fire' && entry.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: 36, guardedTick: 3, guardedSeasonTick: 3, 'health-boundary': 36 });
  await invariants('final'); const final = await proof.snapshot(pool, 'final');
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('resource-summary.json', { resourceSummaries, unsupported, qualifyingFullResourcePass: false });
  for (const line of (await fs.readFile(`${output}/history.jsonl`, 'utf8')).trim().split('\n')) JSON.parse(line);
  result = { status: 'PASS_SCOPED', searchLogicalMs: deadline - epoch, elapsedWallTimeClaim: false, timerCounts,
    invariantChecks: initialInvariantChecks, invariantBoundaries, resourceBoundaries: resourceSummaries.length,
    unsupportedResourceClassifications: unsupported.length, qualifyingFullResourcePass: false,
    canonicalDeaths: 1, canonicalHeirs: 1, heirGeneration: 2, sameAccount: true, exactFireRetries: 1,
    originalEscrow: 2000, heirLegacyCash: 1000, heirCrimeOutcomes: crimeOutcomes.map(({ success, take, rep }) => ({ success,
      ...(take === undefined ? {} : { take }), ...(rep === undefined ? {} : { rep }) })),
    postgres: (await pool.query('SELECT version() AS version')).rows[0].version,
    finalStateSha256: final.stateSha256, matrixQualifying: false, exclusions: configuration.exclusions };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, logicalAt: at }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-random-tape.json', { draws: runtime.tape });
  await proof.artifact('failure-resource-summary.json', { resourceSummaries, unsupported });
  if (app) await proof.snapshot(app.pool, 'failure');
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = originalConsole[level];
  for (const close of [async () => { if (app) await app.close(); }, () => controller.close(), () => base.end(),
    async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); }
    catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1; await proof.record({ kind: 'cleanup-failure', message: error.message }); }
  }
  seam.restore(); runtime.restore();
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify(result));
