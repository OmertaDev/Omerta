// Native stored-award attribution; initial winner selection stays unsupported.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { createNativeCommitObserver } from '../tools/rc1-native-commit-observer.js';

assert(process.argv.includes('--postgres'), 'Real PostgreSQL required');
assert(!process.argv[1].endsWith('server.js') && !process.argv[1].endsWith('worker.js'),
  'Native test entry must not match original server/worker main suffix guards');
const output = process.env.RC1_CROWN_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and explicit local PostgreSQL required');
const source = await sourceIdentity();
const db = planOwnedWorldDatabase({ controlUrl, runId: 'stored-crown-observer', sourceRevision: source.revision });
const proof = await createProofRecorder({ directory: output, source, runId: 'stored-crown-observer', seed: 'none',
  scenarioId: 'stored-season-crown-observer', population: 1, configuration: { database: db.descriptor,
    initialization: 'One ordinary authenticated guest and character; no balances/progression/status grants',
    authority: 'Original runSeasonRollover using its existing explicit season option; per-native-boundary observation after initialization',
    faultScope: 'Native PostgreSQL BEFORE account crown UPDATE then BEFORE crown notice INSERT errors; same durable pending record retried',
    exclusions: ['Initial winner selection attribution', 'Elapsed seasonal duration', 'Concurrent scheduling', 'Complete resource taxonomy', 'Matrix qualification'] } });
let app, readPool, observer, prior, current = 'initialization', result, resourceBoundaries = 0, rollbacks = 0;
const movements = [], unsupported = [], resourceHash = crypto.createHash('sha256'); let positivePair;
try {
  await proof.record({ kind: 'database-created', ...await db.create() });
  Object.assign(process.env, { DATABASE_URL: db.url, RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
    SOCIAL_VERIFY_MODE: 'off', LIVING_WORLD_DIRECTOR: 'DIRECTOR_DISABLED', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
  const [{ buildServer }, { runSeasonRollover }, { runLedgerInvariants }, resources, { reconcileStoredSeasonCrowns }, { Pool }] = await Promise.all([
    import('../src/server.js'), import('../src/worker.js'), import('../src/invariants.js'), import('../tools/rc1-world-resource-observer.js'),
    import('../tools/rc1-season-crown-journal.js'), import('pg')]);
  app = await buildServer();
  const responseCompletions = new Map(); let responseSequence = 0;
  app.addHook('onResponse', async request => {
    const key = request.headers['x-rc1-response-completion'], resolve = responseCompletions.get(key);
    assert(resolve, 'Untracked response'); responseCompletions.delete(key); resolve();
  });
  const request = async options => {
    const key = String(++responseSequence); let timer;
    const complete = new Promise((resolve, reject) => { responseCompletions.set(key, resolve);
      timer = setTimeout(() => reject(Error('Original response hooks did not finish')), 60000); });
    try { const response = await app.inject({ ...options, headers: { ...options.headers, 'x-rc1-response-completion': key } });
      await complete; return { statusCode: response.statusCode, body: response.json() }; } finally { clearTimeout(timer); }
  };
  const guest = await proof.invoke('http.guest', {}, () => request({ method: 'POST', url: '/v1/auth/guest' })); assert.equal(guest.statusCode, 200);
  const born = await proof.invoke('http.character', { name: 'Stored Crown Observer', key: 'stored-crown-birth' }, () => request({ method: 'POST', url: '/v1/character',
    headers: { authorization: `Bearer ${guest.body.token}`, 'idempotency-key': 'stored-crown-birth' }, payload: { name: 'Stored Crown Observer' } }));
  assert.equal(born.statusCode, 200); assert.equal(responseCompletions.size, 0);
  const actor = (await app.pool.query('SELECT id,account_id,season,is_npc FROM characters WHERE name=$1', ['Stored Crown Observer'])).rows[0];
  assert(actor && !actor.is_npc); const season = Number(actor.season) + 1;
  readPool = new Pool({ connectionString: db.url });
  prior = await resources.snapshotWorldResources(readPool); await proof.artifact('resource-initial.json', prior);
  observer = createNativeCommitObserver({ context: () => ({ authority: 'original-runSeasonRollover', case: current, season }),
    onAttempt: event => proof.record({ kind: 'native-query-attempt', event }),
    async onBoundary(event) {
      const after = await resources.snapshotWorldResources(readPool);
      let journal;
      try {
        journal = resources.reconcileWorldResources(prior, after, { identity: event, includeRestrictedChanges: true });
        if (['ROLLED_BACK', 'STATEMENT_ABORTED'].includes(event.outcome)) {
          assert.equal(resources.worldResourceHash(after), resources.worldResourceHash(prior), 'Aborted native boundary changed resources'); rollbacks++;
        }
      } catch (error) {
        await proof.artifact('first-resource-failure.json', { event, before: prior, after, error: error.message }); throw error;
      }
      const { restrictedChanges, ...publicJournal } = journal;
      if (restrictedChanges) await proof.artifact(`resource-restricted-${resourceBoundaries + 1}.json`, { event, restrictedChanges });
      if (journal.seasonCrowns.movements.length) {
        assert(!positivePair, 'Expected exactly one admitted crown'); positivePair = { before: prior, after };
        await proof.artifact('positive-crown-before.json', prior); await proof.artifact('positive-crown-after.json', after);
      }
      movements.push(...journal.seasonCrowns.movements); unsupported.push(...journal.unsupported);
      resourceHash.update(canonicalJson({ event, journal: publicJournal }) + '\n'); resourceBoundaries++;
      await proof.record({ kind: 'resource-commit-boundary', event, journal: publicJournal }); prior = after;
    } });
  const observedPool = {
    async connect() { const client = await app.pool.connect(), query = observer.wrapQuery(client, client.query.bind(client));
      return new Proxy(client, { get(target, key) { if (key === 'query') return query;
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } }); },
    async query(sql, values) { const client = await this.connect(); try { return await client.query(sql, values); } finally { client.release(); } },
  };
  const invariant = async label => { const value = await runLedgerInvariants(app.pool, { alert: false }); assert(value.ok, JSON.stringify(value));
    await proof.record({ kind: 'canonical-invariants', label, checks: value.checks }); };
  const state = async () => ({ account: (await app.pool.query('SELECT * FROM account_persistent WHERE account_id=$1', [actor.account_id])).rows[0],
    record: (await app.pool.query('SELECT * FROM season_records WHERE season=$1', [season - 1])).rows[0],
    notices: (await app.pool.query("SELECT * FROM notifications WHERE character_id=$1 AND type='season_crown'", [actor.id])).rows });
  const installFault = async (table, event, condition = '') => {
    const sql = "CREATE FUNCTION rc1_crown_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected crown observer fault' USING ERRCODE='RCC01'; END $$";
    await app.pool.query(sql); await app.pool.query(`CREATE TRIGGER rc1_crown_fault BEFORE ${event} ON ${table} FOR EACH ROW ${condition} EXECUTE FUNCTION rc1_crown_fault()`);
    await proof.record({ kind: 'fault-installed', table, event, condition, sql, sqlstate: 'RCC01' });
  };
  const removeFault = async table => { await app.pool.query(`DROP TRIGGER rc1_crown_fault ON ${table}`); await app.pool.query('DROP FUNCTION rc1_crown_fault()'); };
  const rollover = async label => { current = label; observer.arm();
    try { return await proof.invoke('runSeasonRollover', { season, label }, () => runSeasonRollover(observedPool, { season })); }
    finally { observer.assertComplete(); observer.disarm(); } };
  await invariant('ordinary-entry');
  await installFault('account_persistent', 'UPDATE OF season_crowns');
  assert.equal((await rollover('account-update-fault')).converted, 1);
  let value = await state(); assert.equal(value.account.season_crowns, 0); assert.equal(value.notices.length, 0);
  assert.equal(value.record.crowned, false); assert.equal(value.record.champion_account, actor.account_id);
  await proof.snapshot(app.pool, 'account-fault-pending'); await invariant('account-fault-pending'); await removeFault('account_persistent');
  await installFault('notifications', 'INSERT', "WHEN (NEW.type = 'season_crown')");
  const beforeFailure = await proof.snapshot(app.pool, 'notice-fault-before');
  assert.equal((await rollover('notification-insert-fault')).converted, 0);
  value = await state(); assert.equal(value.account.season_crowns, 0); assert.equal(value.notices.length, 0); assert.equal(value.record.crowned, false);
  assert.equal((await proof.snapshot(app.pool, 'notice-fault-after')).stateSha256, beforeFailure.stateSha256);
  await invariant('notice-fault-pending'); await removeFault('notifications');
  assert.equal((await rollover('saved-pending-retry')).converted, 0);
  value = await state(); assert.equal(value.account.season_crowns, 1); assert.equal(value.notices.length, 1); assert.equal(value.record.crowned, true);
  assert.equal(movements.length, 1); assert.equal(movements[0].accountId, actor.account_id); assert.equal(movements[0].crownDelta, 1);
  const committed = await proof.snapshot(app.pool, 'crown-committed');
  assert.equal((await rollover('exact-replay')).reckoning, null);
  assert.equal((await proof.snapshot(app.pool, 'crown-exact-replay')).stateSha256, committed.stateSha256); await invariant('replay');
  const projected = [];
  for (const [label, mutate] of [
    ['missing crown', after => { after.tables.account_persistent.find(row => row.account_id === actor.account_id).season_crowns--; }],
    ['duplicate crown', after => { after.tables.account_persistent.find(row => row.account_id === actor.account_id).season_crowns++; }],
    ['missing notice', after => { after.tables.notifications = after.tables.notifications.filter(row => row.type !== 'season_crown'); }],
    ['duplicate notice', after => { after.tables.notifications.push({ ...after.tables.notifications.find(row => row.type === 'season_crown'), id: 'corrupt-duplicate' }); }],
    ['foreign notice owner', after => { after.tables.notifications.find(row => row.type === 'season_crown').character_id = 'foreign'; }],
    ['wrong saved standing', after => { after.tables.notifications.find(row => row.type === 'season_crown').payload = JSON.stringify({ season: season - 1, standing: 999 }); }],
  ]) {
    const corrupted = structuredClone(positivePair.after); mutate(corrupted);
    assert.throws(() => reconcileStoredSeasonCrowns(positivePair.before, corrupted)); projected.push(label);
  }
  await proof.artifact('native-positive-projection-controls.json', { scope: 'Corruptions of exact captured native inputs; not gameplay mutations', rejected: projected });
  assert(unsupported.some(row => row.kind === 'season-standing-selection')); assert(rollbacks >= 2);
  result = { status: 'PASS_SCOPED', actualPlayerCrowns: 1, movements, resourceBoundaries, rollbacks,
    observedTables: resources.WORLD_RESOURCE_TABLES.length, resourceStreamSha256: resourceHash.digest('hex'), unsupported,
    fullStateExactReplay: true, noticeFaultFullStateRollback: true, nativeInputCorruptionsRejected: projected.length,
    invariantChecks: 55, postgres: (await app.pool.query('SELECT version() AS version')).rows[0].version, matrixQualifying: false };
} catch (error) {
  process.exitCode = 1; result = { status: 'FAIL', error: error.message, stack: error.stack };
  await proof.record({ kind: 'first-failure', ...result }); if (app) await proof.snapshot(app.pool, 'failure');
} finally {
  if (observer) await proof.artifact('commit-observer-final.json', observer.diagnostic());
  if (readPool) await readPool.end();
  if (app) { try { await app.close(); } finally { await app.pool.end(); } }
  try { await proof.record({ kind: 'database-cleanup', ...await db.close() }); }
  catch (error) { result.status = 'FAIL'; result.cleanupError = error.message; process.exitCode = 1; }
  const sealed = await proof.finish(result); await verifyArtifactIndex(output, sealed);
}
console.log(JSON.stringify(result));
