// Original operation definitions and deadlines; only the declared initial social roster is a fixture.
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { snapshotCapitalResources, reconcileCapitalLifecycle, capitalStateHash } from '../tools/rc1-capital-lifecycle-journal.js';
import { exactSum } from '../tools/rc1-resource-journal.js';

assert(process.argv.includes('--postgres'), 'Real PostgreSQL required');
const argument = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = await sourceIdentity(), seed = argument('seed') || 'rc1-capital-alpha';
const runId = `capital-lifecycles-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(argument('output') || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
const controlUrl = process.env.RC1_RESOURCE_DATABASE_URL; assert(controlUrl);
for (const name of ['CHAIN_RPC_URL', 'INVARIANT_WEBHOOK_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL']) assert(!process.env[name], `External integration excluded: ${name}`);
const database = planOwnedWorldDatabase({ controlUrl, runId, sourceRevision: source.revision });
const env = { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
  COORDINATION_ACCOUNT_IDS: '', LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', POPULATION_OFF: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off' };
const priorEnv = Object.fromEntries(Object.keys(env).map(name => [name, process.env[name]])); Object.assign(process.env, env);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), duration = 86400000;
const configuration = { epoch: new Date(epoch).toISOString(), logicalHours: 24, sourcePins: WORKER_SOURCE_PINS,
  authority: 'Unchanged COORDINATION_OPERATION_PILOT plus createFamilyOperations commands and canonical runEstate',
  clocks: 'Shared application/PostgreSQL logical clock; every original local callback runs through24h. No persisted deadline/status rewrites.',
  expiryAuthority: 'No production Family-operation expiry worker exists; the canonical expire command performs recovery after the untouched deadline.',
  fixtures: ['Four default-birth characters:500 cash and25 ammunition each, no extra resource/progression/material grant',
    'Initial zero-treasury Family and four-member crew with boss/officer membership', 'Population deploy switch off for this focused fixture world'],
  exclusions: ['Natural Family/crew formation and entry', 'Combat-earned death (trusted canonical estate invocation)',
    'Material acquisition/execution/spend branches already covered by the separate short proof, not re-executed here',
    'HTTP/authentication and Player Command dispatcher', 'Concurrent scheduling, process crash/recovery and full matrix',
    'Literal24h wall-time or deployed timing equivalence', 'Independent installed-dependency attestation'],
  databaseIsolation: database.descriptor, qualifyingFullResourcePass: false };
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'original-operation-capital-lifecycles', population: 4 });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_worker_capital_${process.pid}`, seam = installWorkerInstrumentation(controller, { namespace });
const base = new pg.Pool({ connectionString: database.url });
const readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace}`, max: 1 });
const nativeConsole = { log: console.log, warn: console.warn, error: console.error };
const actors = { boss: 'capital-boss', live: 'capital-live', other: 'capital-other', reader: 'capital-reader' };
const character = role => `${actors[role]}-character`, cases = [], operations = {}, terminal = [];
let pool, api, kernel, worldRegistry, worldObjects, definitions, result, firstFailure = false, ordinal = 0, boundaries = 0, equations = 0, invariantCount = 0, heir;
const unchanged = ({ before, after }) => assert.equal(capitalStateHash(after), capitalStateHash(before), 'Replay/refusal/abort changed authoritative custody');
async function observe(name, work, validate = () => {}) {
  const before = await snapshotCapitalResources(readPool); let after, value, journal;
  try {
    value = await work(); after = await snapshotCapitalResources(readPool); journal = reconcileCapitalLifecycle(before, after, { logicalAt: at });
    await validate({ before, after, result: value, journal });
    const inputArtifact = `capital-boundary-${String(++boundaries).padStart(5, '0')}.json`;
    await proof.artifact(inputArtifact, { name, logicalAt: at, before, after, result: value ?? null });
    equations += journal.equations.length; await proof.record({ kind: 'capital-resource-boundary', name, logicalAt: at, journal, inputArtifact });
    return value;
  } catch (error) {
    if (!firstFailure) { firstFailure = true; if (!after) try { after = await snapshotCapitalResources(readPool); } catch { /* retain first inputs */ }
      await proof.artifact('first-resource-failure.json', { name, logicalAt: at, before, after: after ?? null, result: value ?? null,
        journal: journal ?? null, error: { code: error.code || null, message: error.message, stack: error.stack } }); }
    throw error;
  }
}
const key = name => `original-capital:${name}`;
async function command(role, operation, action, input = {}, token = key(`${operation?.name || 'create'}:${action}:${++ordinal}`), service = api, expectedCharacterId = null) {
  return proof.invoke('canonical-family-operation', { accountId: actors[role], operationId: operation?.id || null, action, input, key: token, logicalAt: at },
    () => action === 'create' ? service.create(actors[role], input, token)
      : service.command(actors[role], operation.id, action, input, token, expectedCharacterId));
}
async function rejected(name, work, code) { return observe(name, async () => { await assert.rejects(work, { code }); return { expectedRefusal: code }; }, unchanged); }
async function fault(reason, work) {
  assert(['deposit', 'refund', 'forfeit'].includes(reason));
  await pool.query(`CREATE FUNCTION rc1_capital_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='coordination:capital:${reason}' THEN RAISE EXCEPTION 'RC1_CAPITAL_ABORT' USING ERRCODE='RCC01'; END IF; RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER rc1_capital_abort BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION rc1_capital_abort()');
  try { await work(); } finally { await pool.query('DROP TRIGGER rc1_capital_abort ON transactions'); await pool.query('DROP FUNCTION rc1_capital_abort()'); }
}
async function draft(name, depositor) {
  const operation = operations[name] = { name, depositor };
  const created = await observe(`${name}:create`, () => command('boss', null, 'create', { definitionId: definitions[0].id }, key(`${name}:create`)));
  operation.id = created.operationId;
  await observe(`${name}:publish`, () => command('boss', operation, 'publish'));
  await observe(`${name}:join-capital-role`, () => command(depositor, operation, 'join', { roleId: 'organizer' }));
  await observe(`${name}:commit-capital`, () => command(depositor, operation, 'commit', { requirementId: 'funding' }));
  const depositKey = key(`${name}:deposit`);
  if (name === 'withdrawal') await fault('deposit', () => rejected('deposit:late-rollback', () => command(depositor, operation, 'contribute', { requirementId: 'funding' }, depositKey), 'RCC01'));
  const deposited = await observe(`${name}:deposit`, () => command(depositor, operation, 'contribute', { requirementId: 'funding' }, depositKey));
  await observe(`${name}:deposit-exact-replay`, async () => { assert.deepEqual(await command(depositor, operation, 'contribute', { requirementId: 'funding' }, depositKey), deposited); return deposited; }, unchanged);
  return operation;
}
async function close(operation, role, action, disposition) {
  const input = action === 'withdraw' ? { requirementId: 'funding' } : {}, token = key(`${operation.name}:${action}`);
  await fault(disposition === 'refunded' ? 'refund' : 'forfeit', () => rejected(`${operation.name}:${action}:late-rollback`, () => command(role, operation, action, input, token), 'RCC01'));
  const closed = await observe(`${operation.name}:${action}`, () => command(role, operation, action, input, token), ({ before, after }) => {
    const row = after.world_operation_capital.find(row => row.operation_id === operation.id); assert.equal(row.state, disposition);
    if (disposition === 'forfeited') {
      assert.equal(row.character_id, character('boss')); assert.equal(row.account_id, actors.boss);
      assert.equal(after.characters.find(row => row.id === heir).cash, before.characters.find(row => row.id === heir).cash, 'Replacement receives no original capital');
    }
  });
  await observe(`${operation.name}:${action}:exact-replay`, async () => { assert.deepEqual(await command(role, operation, action, input, token), closed); return closed; }, unchanged);
  cases.push({ operation: operation.name, action, disposition, originalLifetimeSeconds: 86400, logicalAt: at, outcome: 'PASS' });
  terminal.push({ operation, role, action, input, token, response: closed });
  return closed;
}
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query(`CREATE SCHEMA ${namespace}`);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  await proof.record({ kind: 'database-version', ...(await pool.query('SELECT version() AS version')).rows[0] });
  const [{ createFamilyOperations }, world, pilot, { runLedgerInvariants }, game, { runEstate }] = await Promise.all([
    import('../src/coordination/operations.js'), import('../src/content/world-kernel-pilot.js'), import('../src/content/coordination-operation-pilot.js'),
    import('../src/invariants.js'), import('../src/game.js'), import('../src/social/estate.js')]);
  const { createWorldKernel } = await import('../src/world-kernel.js');
  worldRegistry = world.WORLD_KERNEL_REGISTRY; worldObjects = world.WORLD_KERNEL_OBJECTS; definitions = pilot.COORDINATION_OPERATION_PILOT;
  assert.equal(definitions[0].lifetimeSeconds, 86400);
  const makeService = selected => {
    kernel = createWorldKernel({ pool: selected, registry: worldRegistry, objects: worldObjects, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
    return createFamilyOperations({ pool: selected, registry: worldRegistry, kernel, definitions, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  };
  api = makeService(pool);
  for (const [role, account] of Object.entries(actors)) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$2,$3,'foundry')", [character(role), account, Math.floor(epoch / (28 * 86400000))]);
  }
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('capital-family','Capital Family','CAP')");
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('capital-crew','Capital Crew',$1)", [actors.boss]);
  for (const [role, account] of Object.entries(actors)) {
    await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('capital-family',$1,$2)", [character(role), role === 'boss' ? 'boss' : 'soldier']);
    await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('capital-crew',$1,$1)", [account]);
  }
  const invariant = async label => { const value = await runLedgerInvariants(pool, { alert: false }); invariantCount++;
    await proof.record({ kind: 'canonical-invariants', label, logicalAt: at, value }); assert(value.ok, `Canonical invariant failed: ${label}`); };
  await invariant('initial'); await proof.artifact('initial-resources.json', { state: await snapshotCapitalResources(readPool), definitions: api.definitions, fixtureWritesEndHere: true });
  await observe('original-worker-bootstrap', () => bootOriginalWorker(controller).then(() => ({ booted: true })));
  const withdrawal = await draft('withdrawal', 'boss'); await close(withdrawal, 'boss', 'withdraw', 'refunded'); await observe('withdrawal:cancel-empty', () => command('boss', withdrawal, 'cancel'));
  const cancellation = await draft('cancellation', 'boss'); await close(cancellation, 'boss', 'cancel', 'refunded');
  for (const name of ['live-expiry-a', 'live-expiry-b']) await draft(name, 'live');
  for (const name of ['dead-withdrawal', 'dead-cancellation', 'dead-expiry-a', 'dead-expiry-b']) await draft(name, 'boss');
  for (const operation of Object.values(operations).filter(row => row.name.includes('expiry')))
    await rejected(`${operation.name}:initial-early-expire-denied`, () => command('reader', operation, 'expire'), 'coordination_operation_forbidden');
  await invariant('all-capital-held');
  await observe('canonical-estate-and-replacement', async () => {
    const q = await pool.connect(); try { await q.query('BEGIN');
      const victim = (await q.query('SELECT * FROM characters WHERE id=$1 AND alive FOR UPDATE', [character('boss')])).rows[0];
      const victimAcct = (await q.query('SELECT * FROM account_persistent WHERE account_id=$1 FOR UPDATE', [actors.boss])).rows[0];
      const victimOwned = await game.loadOwned(q, victim);
      const estate = await runEstate(q, { ledger: game.ledger, notify: game.notify, victimAcct, victimOwned }, victim, 'RC1 original capital proof');
      await game.persistAccountFields(q, actors.boss, victimAcct, game.ESTATE_ACCOUNT_FIELDS); await q.query('COMMIT'); heir = estate.heirId; return { heirId: heir };
    } catch (error) { await q.query('ROLLBACK'); throw error; } finally { q.release(); }
  }, ({ after }) => { assert(after.characters.find(row => row.id === heir)?.alive); assert.equal(after.world_operation_capital.filter(row => row.state === 'held').length, 6); });
  await rejected('replacement:stale-character-fenced', () => command('boss', operations['dead-cancellation'], 'cancel', {}, key('stale-character'), api, character('boss')), 'coordination_operation_forbidden');
  await close(operations['dead-withdrawal'], 'boss', 'withdraw', 'forfeited');
  await observe('dead-withdrawal:cancel-empty', () => command('boss', operations['dead-withdrawal'], 'cancel'));
  await close(operations['dead-cancellation'], 'boss', 'cancel', 'forfeited');
  await invariant('replacement-forfeits');
  const advance = async deadline => observe(`original-workers-until:${deadline - epoch}`, async () => {
    await controller.advanceTo(deadline, async (_at, label) => { if (label === 'guardedTick') await invariant(`worker-hour:${(at - epoch) / 3600000}`); }); return { logicalAt: at };
  });
  await advance(epoch + duration - 1);
  for (const operation of Object.values(operations).filter(row => row.name.includes('expiry')))
    await rejected(`${operation.name}:last-ms-early-expire-denied`, () => command('reader', operation, 'expire'), 'coordination_operation_forbidden');
  await advance(epoch + duration);
  assert.equal(new Date((await pool.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime(), epoch + duration);
  const pending = await snapshotCapitalResources(readPool);
  for (const operation of Object.values(operations).filter(row => row.name.includes('expiry'))) {
    const row = pending.world_operations.find(row => row.id === operation.id); assert.equal(row.status, 'recruiting');
    assert.equal(Date.parse(row.expires_at), epoch + duration); assert.equal(pending.world_operation_capital.find(row => row.operation_id === operation.id).state, 'held');
  }
  for (const name of ['live-expiry-a', 'live-expiry-b']) await close(operations[name], 'reader', 'expire', 'refunded');
  for (const name of ['dead-expiry-a', 'dead-expiry-b']) await close(operations[name], 'boss', 'expire', 'forfeited');
  const reopened = makeService(new controller.Pool({ connectionString: database.url, options: '', max: 2 }));
  for (const replay of terminal) await observe(`${replay.operation.name}:new-pool-exact-replay`, async () => {
    const value = await command(replay.role, replay.operation, replay.action, replay.input, replay.token, reopened); assert.deepEqual(value, replay.response); return value;
  }, unchanged);
  for (const operation of Object.values(operations).filter(row => row.name.includes('expiry')))
    await rejected(`${operation.name}:new-key-terminal-denial`, () => command('reader', operation, 'expire'), 'coordination_operation_closed');
  await invariant('final'); const final = await snapshotCapitalResources(readPool);
  const dispositions = Object.fromEntries(['held', 'refunded', 'spent', 'forfeited'].map(state => [state,
    exactSum(final.world_operation_capital.filter(row => row.state === state).map(row => row.amount))]));
  assert.deepEqual(dispositions, { held: '0', refunded: '400', spent: '0', forfeited: '400' });
  assert.equal(final.world_operation_capital.length, 8);
  const schedule = controller.diagnostic(); assert.equal(schedule.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map(label => [label, schedule.events.filter(row => row.kind === 'timer.fire' && row.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: 288, guardedTick: 24, guardedSeasonTick: 24, 'health-boundary': 288 });
  await proof.artifact('final-resources.json', final); await proof.artifact('worker-schedule.json', schedule); await proof.artifact('random-tape.json', runtime.tape);
  result = { status: 'PASS_SCOPED', logicalHours: 24, boundaries, equations, invariantCount, cases, dispositions, timerCounts,
    originalDefinitionHash: api.definitions[0].contentHash, qualifyingFullResourcePass: false, gateStatus: 'OPEN_REQUIRED_PROOF' };
} catch (error) {
  result = { status: 'FAIL', logicalAt: at, boundaries, equations, invariantCount, cases, error: error.message };
  await proof.record({ kind: 'failure', message: error.message, stack: error.stack, logicalAt: at });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic()); await proof.artifact('failure-random-tape.json', runtime.tape);
  if (pool) try { await proof.artifact('failure-resources.json', await snapshotCapitalResources(readPool)); } catch (capture) { await proof.record({ kind: 'failure-capture-error', message: capture.message }); }
  process.exitCode = 1;
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = nativeConsole[level];
  await controller.close(); await readPool.end(); await base.end(); await proof.record({ kind: 'database-retained', descriptor: database.descriptor });
  seam.restore(); runtime.restore(); for (const [name, value] of Object.entries(priorEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify({ runId, output, source: source.revision, status: result.status, boundaries, equations, matrixQualifying: false }));
