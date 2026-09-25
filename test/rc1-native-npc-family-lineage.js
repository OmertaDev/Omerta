import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import pg from 'pg';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker } from '../tools/rc1-native-worker.js';
import { createNpcFamilyCommitObserver, NPC_FAMILY_SOURCE_PINS } from '../tools/rc1-npc-family-provenance.js';
assert(process.argv.includes('--postgres'));
const source = await sourceIdentity(), seed = 'rc1-alpha', epoch = Date.parse('2026-09-24T00:00:00Z');
const runId = `npc-family-${source.revision.slice(0, 8)}-${crypto.randomBytes(4).toString('hex')}`;
const output = process.env.RC1_NPC_FAMILY_OUTPUT || path.join(os.tmpdir(), runId);
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
const configuration = { scope: 'Original worker NPC Family fee and nonmonetary war-pool creation with actual statement provenance', sourcePins: NPC_FAMILY_SOURCE_PINS,
  seed, epoch: new Date(epoch).toISOString(), maximumHours: 8, fixtures: '25 initial ordinary accounts/characters with authored birth defaults; no NPC resource, membership, progression, status or deadline fixture',
  fault: 'Declared prebaseline AFTER UPDATE trigger aborts NPC standing write after verifying Family/member/fee and exact personal cash-ledger persistence; remove after first eligible attempt for the next original hourly retry',
  exclusions: ['NPC seed/car/other ecology lineage', 'Recruitment, dissolution, war-pool regeneration/combat/payout', 'HTTP entry/natural player progression', 'Full world/matrix/backing/deployment qualification'] };
for (const key of ['POPULATION_OFF', 'SEASON_MOD', 'SEASON_PHASE', 'LAW_BUST_P', 'CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'REDIS_URL']) assert(!process.env[key], `Undeclared override ${key}`);
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on',
  COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE', LIQUIDITY_AUTOMATION_ENABLED: 'off', SOCIAL_VERIFY_MODE: 'off',
  RATE_LIMIT: 'off', INVITE_MODE: 'off', JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'npc-family-lineage', population: 25 });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_npc_family_${process.pid}`, base = new pg.Pool({ connectionString: database.url });
const readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace},pg_catalog -c default_transaction_read_only=on`, max: 1 });
let snapshotWorldResources, reconcileWorldResources, worldResourceHash, verifyNpcFamilyBoundary, npcFamilyCorruptions, previous, firstError, result, pool;
let boundaryCount = 0, candidateCount = 0, committedCount = 0, rollbackCount = 0, faultInstalled = true;
const candidates = [], controls = [], expectedFaults = [], unknown = {}, nativeConsole = { log: console.log, warn: console.warn, error: console.error };
const commitObserver = createNpcFamilyCommitObserver({ context: () => ({ authority: 'original-worker', logicalAt: at }), onBoundary: async (event, car, provenance) => {
  assert.equal(car, undefined);
  if (firstError) throw firstError;
  const before = previous, after = await snapshotWorldResources(readPool);
  try {
    if (['ROLLED_BACK','STATEMENT_ABORTED'].includes(event.outcome)) assert.equal(worldResourceHash(after), worldResourceHash(before), 'Aborted SQL changed committed resource state');
    const journal = reconcileWorldResources(before, after, { identity: event, npcFamilyProvenance: provenance, includeRestrictedChanges: true });
    if (provenance) {
      const input = { before, after, event, provenance }; candidateCount++;
      await proof.artifact(`npc-candidate-${String(candidateCount).padStart(3, '0')}.json`, input); candidates.push(input);
      if (event.outcome === 'COMMITTED') { verifyNpcFamilyBoundary(input); committedCount++; }
      if (event.outcome === 'ROLLED_BACK') { verifyNpcFamilyBoundary(input, 0); rollbackCount++; }
    }
    for (const item of journal.unsupported) unknown[item.kind] = (unknown[item.kind] || 0) + 1;
    await proof.record({ kind: 'resource-commit-boundary', event, journal }); boundaryCount++; previous = after;
  } catch (error) { firstError = error; await proof.artifact('first-resource-failure.json', { before, after, event, provenance, error: { message: error.message, stack: error.stack } }); throw error; }
} });
const seam = installWorkerInstrumentation(controller, { namespace, commitObserver });
try {
  for (const key of ['log','warn','error']) console[key] = (...args) => {
    if (faultInstalled && key === 'error' && args[0] === '[population] found family failed' && String(args[1]).includes('RC1_NPC_FORMATION_ABORT')) { expectedFaults.push({ logicalAt: at, message: args[1] }); return; }
    controller.log(key, args);
  };
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  ({ snapshotWorldResources, reconcileWorldResources, worldResourceHash } = await import('../tools/rc1-world-resource-observer.js'));
  ({ verifyNpcFamilyBoundary, npcFamilyCorruptions } = await import('./lib/rc1-npc-family-controls.js'));
  const { runLedgerInvariants } = await import('../src/invariants.js');
  for (let i = 0; i < 25; i++) { const id = `npc-proof-human-${i}`;
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
    await pool.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$3,$4,$5)', [id+'-character',id,id,Math.floor(epoch/86400000/28),'docks']);
  }
  const fault = `CREATE FUNCTION rc1_npc_abort() RETURNS trigger LANGUAGE plpgsql AS $fault$ BEGIN
    IF NEW.npc_flag AND NOT OLD.npc_flag THEN
      IF NEW.war_pool <> 120000 OR NOT EXISTS(SELECT 1 FROM gang_members m JOIN transactions t ON t.character_id=m.character_id JOIN characters c ON c.id=m.character_id
        WHERE m.gang_id=NEW.id AND m.role='boss' AND t.reason='gang:found' AND t.amount=-25000 AND c.cash+c.bank=500+COALESCE((SELECT SUM(amount) FROM transactions WHERE character_id=c.id AND currency='cash'),0))
      THEN RAISE EXCEPTION 'NPC fault predecessors missing' USING ERRCODE='RNF02'; END IF;
      RAISE EXCEPTION 'RC1_NPC_FORMATION_ABORT after original cash fee and standing write' USING ERRCODE='RNF01'; END IF; RETURN NEW; END $fault$`;
  await pool.query(fault); await pool.query('CREATE TRIGGER rc1_npc_abort AFTER UPDATE ON gangs FOR EACH ROW EXECUTE FUNCTION rc1_npc_abort()');
  await proof.artifact('initialization.json', { configuration, fault, gameplayFixturesAfterBaseline: false });
  assert((await runLedgerInvariants(pool,{alert:false})).ok);
  // TOOL52: reproduce the raw error hidden by the canonical registry mapper.
  const clockErrors=[];
  const rawInvariantPool={query:readPool.query.bind(readPool),connect:async()=>{
    const client=await readPool.connect();return new Proxy(client,{get(target,key){
      if(key==='query')return async(...args)=>{try{return await target.query(...args);}catch(error){clockErrors.push({sql:args[0],code:error.code,message:error.message});throw error;}};
      const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
    }});
  }};
  await assert.rejects(()=>runLedgerInvariants(rawInvariantPool,{alert:false}));
  assert(clockErrors.some(row=>row.code==='42704' && row.message.includes('rc1.transaction_time')));
  await proof.artifact('raw-invariant-clock-error.json',{scope:'Explicit prebaseline reproduction; raw snapshot connection is uninstrumented',errors:clockErrors});
  await proof.snapshot(pool,'initial');
  await bootOriginalWorker(controller, { beforeCallbacks: async () => { previous = await snapshotWorldResources(readPool); commitObserver.arm(); } });
  const afterCallback = async () => {
    if (faultInstalled && expectedFaults.length) {
      assert.equal(expectedFaults.length,1); assert.equal(rollbackCount,1); assert.equal(committedCount,0);
      await base.query(`SET search_path=${namespace},pg_catalog`); await base.query('DROP TRIGGER rc1_npc_abort ON gangs'); await base.query('DROP FUNCTION rc1_npc_abort()'); faultInstalled=false;
      await proof.record({kind:'diagnostic-trigger-removed',logicalAt:at,gameplayMutation:false});
    }
    const inv=await runLedgerInvariants(pool,{alert:false}); assert(inv.ok); await proof.record({kind:'canonical-invariants',logicalAt:at,checks:inv.checks});
  };
  await afterCallback();
  for(let hour=1;hour<=configuration.maximumHours && committedCount<2;hour++) await controller.advanceTo(epoch+hour*3600000,afterCallback);
  assert.equal(expectedFaults.length,1);
  commitObserver.assertComplete(); assert.equal(firstError,undefined); assert.equal(committedCount,2); assert.equal(rollbackCount,1);
  for (const input of candidates.filter(row => row.event.outcome==='COMMITTED')) for (const control of npcFamilyCorruptions(input)) {
    const filename=`npc-control-${String(controls.length+1).padStart(3,'0')}.json`; await proof.artifact(filename,control); controls.push({name:control.name,artifact:filename});
  }
  commitObserver.disarm(); await proof.snapshot(pool,'final'); await proof.artifact('worker-schedule.json',controller.diagnostic()); await proof.artifact('commit-observer.json',commitObserver.diagnostic());
  await proof.artifact('random-tape.json',{draws:runtime.tape}); await proof.artifact('expected-faults.json',expectedFaults);
  result={status:'PASS_SCOPED',boundaryCount,candidateCount,committedCount,rollbackCount,controls:controls.length,unknown,logicalHours:(at-epoch)/3600000,nonmonetaryWarPoolNotCurrency:true,fullResourceCoverage:false};
} catch(error) {
  result={status:'FAIL',message:error.message,stack:error.stack,boundaryCount,candidateCount,committedCount,rollbackCount};process.exitCode=1;
  await proof.record({kind:'failure',...result}); await proof.artifact('failure-worker-schedule.json',controller.diagnostic()); await proof.artifact('failure-commit-observer.json',commitObserver.diagnostic());
} finally {
  for(const key of ['log','warn','error'])console[key]=nativeConsole[key];
  for(const close of [async()=>{try{commitObserver.disarm();}catch{}},()=>controller.close(),()=>readPool.end(),()=>base.end(),async()=>proof.record({kind:'database-cleanup',...await database.close()})])
    try{await close();}catch(error){result.status='FAIL';result.cleanupFailure=error.message;process.exitCode=1;}
  seam.restore();runtime.restore();const run=await proof.finish(result);await verifyArtifactIndex(output,run);
}
console.log(JSON.stringify(result));
