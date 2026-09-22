// The retained selected player command, all real startup callbacks, and two resident continuations.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker } from '../tools/rc1-native-worker.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, restoreCheckpoint, canonicalDatabaseSnapshot, sha256 } from '../tools/rc1-native-proof.js';
import { compareAllianceStates } from '../tools/rc1-alliance-continuation.js';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = arg('output'), checkpointDirectory = arg('checkpoint'), retained = arg('retained'), mode = arg('mode');
assert(output && checkpointDirectory && retained && process.env.COORDINATION_TEST_DATABASE_URL);
if (!mode) {
  for (const step of ['uninterrupted', 'restarted']) execFileSync(process.execPath,
    [fileURLToPath(import.meta.url), `--output=${output}`, `--checkpoint=${checkpointDirectory}`, `--retained=${retained}`, `--mode=${step}`], { stdio: 'inherit' });
} else {
  const source = await sourceIdentity(), directory = path.join(output, mode);
  const read = async (base, file) => JSON.parse(await fs.readFile(path.join(base, file), 'utf8'));
  const checkpoint = await read(checkpointDirectory, 'resident-checkpoint-checkpoint.json');
  const saved = await read(checkpointDirectory, 'resident-cursor.json');
  const policy = await read(retained, 'alliance-hour24-policy.json');
  const seed = 'rc1-alpha', start = saved.logicalAt;
  for (const key of ['CHAIN_RPC_URL','INVARIANT_WEBHOOK_URL','LIQUIDITY_RPC_URL','LIQUIDITY_RPC_FALLBACK_URL']) assert(!process.env[key]);
  const database = planOwnedWorldDatabase({ controlUrl: process.env.COORDINATION_TEST_DATABASE_URL,
    runId: `worker-restart-${mode}`, sourceRevision: source.revision });
  const proof = await createProofRecorder({ directory, source, runId: `worker-restart-${mode}`, seed,
    scenarioId: 'retained-worker-restart-equivalence', population: 25,
    configuration: { checkpoint, mode, scope: 'Exact retained selected command plus all original startup callbacks and two hourly resident turns; no full world or matrix.' } });
  const runtime = installSerialRuntime(seed, new Date(start).toISOString());
  let at = start; runtime.bindClock(() => at); runtime.restoreTape(saved.draws);
  const controller = createWorkerSchedule({ start, setClock: value => { at = value; },
    expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
  const seam = installWorkerInstrumentation(controller, { namespace: checkpoint.schema });
  Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION:'on', WORLD_GRAPH_KERNEL:'on', COORDINATION_ENGINE:'on',
    COORDINATION_KNOWLEDGE:'on', COORDINATION_KNOWLEDGE_SHARING:'on', COORDINATION_OPERATIONS:'on', COORDINATION_ACCOUNT_IDS:'',
    LIVING_WORLD_DIRECTOR:'LIVE', DIRECTOR_ACCOUNT_IDS:'', POPULATION_OFF:'off', LIQUIDITY_AUTOMATION_ENABLED:'off',
    RATE_LIMIT:'off', INVITE_MODE:'off', SOCIAL_VERIFY_MODE:'off', JWT_SECRET:sha256('rc1-isolated-alliance-world-jwt:'+seed),
    MARKET_SEED:sha256('rc1-isolated-alliance-market:'+seed), MOD_KEY:sha256('rc1-isolated-alliance-mod:'+seed) });
  const consoles = { log: console.log, warn: console.warn, error: console.error };
  let pool, app, result = { status:'FAIL' };
  try {
    await proof.record({ kind:'database-created', ...await database.create() });
    pool = await restoreCheckpoint(checkpoint, path.join(checkpointDirectory,'resident-checkpoint.dump'), database.url, { poolFactory:seam.clock.poolFactory });
    for (const level of Object.keys(consoles)) console[level] = (...args) => controller.log(level,args);
    const { buildServer } = await import('../src/server.js'); app = await buildServer();
    const before = await proof.snapshot(pool,'before-startup'), draws = runtime.tape.length;
    if (mode === 'restarted') await bootOriginalWorker(controller);
    const after = await proof.snapshot(pool,'after-startup');
    const startup = compareAllianceStates(before,after);
    await proof.artifact('startup-difference.json', startup);
    await proof.artifact('startup-random-draws.json', { draws:runtime.tape.slice(draws) });
    // Preserve the exact metadata row. A new backup diagnostic is the only allowed startup effect.
    for (const table of startup.changed) {
      assert.equal(table.table,'telemetry'); assert.equal(table.removed.length,0);
      assert(table.added.every(row => JSON.parse(row).event === 'backup_invariant_drift'));
    }
    assert.equal(startup.sequences,null);
    const pending = policy.allianceAdapter.payload.state.pending;
    const actor = policy.allianceActors.find(row => row.accountId === pending.accountId), request = pending.decision.request;
    let complete; const completed = new Promise(resolve => { complete=resolve; });
    app.addHook('onResponse',async () => { complete(); });
    const response = await app.inject({ method:request.method,url:request.path,
      headers:{authorization:'Bearer '+actor.token,'idempotency-key':request.idempotencyKey},payload:request.body });
    await completed; assert.equal(response.statusCode,200,response.body);
    await proof.artifact('selected-command.json',{ request, response:response.json() });
    const { runResidentBehaviour } = await import('../src/population.js');
    const turns=[];
    for (let hour=1;hour<=2;hour++) { at=start+hour*3600000; turns.push(await runResidentBehaviour(pool)); }
    const final=await proof.snapshot(pool,'final');
    await proof.artifact('random-tape.json',{draws:runtime.tape});
    let comparison=null;
    if (mode==='restarted') {
      const reference=path.join(output,'uninterrupted');
      comparison=compareAllianceStates(await read(reference,'final.json'),final);
      await proof.artifact('continuation-difference.json',comparison);
      // No gameplay fields, identities, resource journals or timestamps are normalized.
      for (const table of comparison.changed) {
        assert.equal(table.table,'telemetry','Authoritative continuation differs in '+table.table);
        assert.equal(table.removed.length,0);
        assert(table.added.every(row=>JSON.parse(row).event==='backup_invariant_drift'));
      }
      assert.equal(comparison.sequences,null);
      assert.deepEqual((await read(reference,'selected-command.json')),await read(directory,'selected-command.json'));
    }
    result={status:'PASS_SCOPED',mode,comparedTables:Object.keys(final.tables).length,turns,
      startupTables:startup.changed.map(t=>t.table),startupRandomDraws:runtime.tape.slice(draws,draws+(mode==='restarted'?1:0)),
      authoritativeEqual:mode==='restarted',classifiedNonAuthoritativeDifferences:comparison?.changed.map(t=>t.table)||[]};
  } catch(error) { result={status:'FAIL',mode,error:error.message,stack:error.stack};process.exitCode=1; }
  finally {
    if(app) await app.close();
    if(pool) await pool.end();
    // Fastify owns its pool; the worker owns every other pool recorded by the loader.
    for(const managed of controller.pools) if(managed!==app?.pool) await managed.end();
    await proof.record({kind:'database-cleanup',...await database.close()});
    for(const level of Object.keys(consoles)) console[level]=consoles[level];
    seam.restore();runtime.restore();
    await verifyArtifactIndex(directory,await proof.finish(result));
  }
  console.log(JSON.stringify(result));
}
