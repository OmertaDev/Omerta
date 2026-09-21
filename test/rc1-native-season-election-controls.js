import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { createNativeCommitObserver } from '../tools/rc1-native-commit-observer.js';
import { createSeasonElectionProbe, snapshotElectionCandidates, verifyColdSeasonElection } from '../tools/rc1-season-election-provenance.js';

assert(process.argv.includes('--postgres')); assert(!process.argv[1].endsWith('server.js') && !process.argv[1].endsWith('worker.js'));
const output = process.env.RC1_ELECTION_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL, childMode = process.argv.includes('--restart-child');
assert(output && controlUrl); const source = await sourceIdentity();
const owned = childMode ? null : planOwnedWorldDatabase({ controlUrl, runId: 'cold-election', sourceRevision: source.revision });
const url = childMode ? process.env.RC1_ELECTION_EXISTING_DATABASE : owned.url;
assert(['localhost','127.0.0.1'].includes(new URL(url).hostname));
const proof = await createProofRecorder({ directory: output, source, runId: childMode ? 'cold-election-restart' : 'cold-election', seed: 'native',
  scenarioId: 'cold-election-provenance', population: childMode ? 4 : 3,
  configuration: { database: owned?.descriptor || { borrowedOwnedParentDatabase: new URL(url).pathname.slice(1) },
    scope: childMode ? 'New-process memo recomputation and exact saved-intent retry; no worker or makeDb restart claim' : 'Ordinary HTTP entrants, actual original election, warm-cache exclusion and process restart',
    initialization: 'Three ordinary guest/character entries, then one additional ordinary entry after the first election; no progression/status/balance edits',
    exclusions: ['Full ranking/Family taxonomy','Elapsed seasons','Concurrent elections','Full worker restart','Matrix qualification'] } });
let app, pool, readPool, prior, observer, result, activeCase = childMode ? 'fresh-process-retry' : 'initialization';
const captures = []; let boundaries = 0, fullBefore;
const probe = createSeasonElectionProbe({ snapshot: () => snapshotElectionCandidates(readPool) });
const seam = probe.install();
try {
  if (owned) await proof.record({ kind: 'database-created', ...await owned.create() });
  Object.assign(process.env, { DATABASE_URL: url, RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
    SOCIAL_VERIFY_MODE: 'off', LIVING_WORLD_DIRECTOR: 'DIRECTOR_DISABLED', JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
  const { recordReckoning } = await import('../src/season.js');
  const resources = await import('../tools/rc1-world-resource-observer.js');
  const { runLedgerInvariants } = await import('../src/invariants.js');
  let request, actor;
  if (!childMode) {
    const { buildServer } = await import('../src/server.js'); app = await buildServer(); pool = app.pool;
    const completions = new Map(); let sequence = 0;
    app.addHook('onResponse', async req => { const key = req.headers['x-rc1-response-completion'], done = completions.get(key); assert(done); completions.delete(key); done(); });
    request = async options => {
      const key = String(++sequence); let timer;
      const complete = new Promise((resolve,reject) => { completions.set(key,resolve); timer=setTimeout(()=>reject(Error('Original response hooks did not settle')),60000); });
      try { const response=await app.inject({...options,headers:{...options.headers,'x-rc1-response-completion':key}}); await complete;
        assert.equal(response.statusCode,200,response.body); return response.json(); } finally {clearTimeout(timer);}
    };
    for(let n=0;n<3;n++) await proof.invoke('ordinary-entry',{index:n},async()=>{
      const guest=await request({method:'POST',url:'/v1/auth/guest'});
      const born=await request({method:'POST',url:'/v1/character',headers:{authorization:`Bearer ${guest.token}`,'idempotency-key':`cold-entry-${n}`},payload:{name:`Cold Election ${n}`}});
      return {characterId:born.id};
    });
    actor=(await pool.query('SELECT id,account_id,season FROM characters ORDER BY name LIMIT 1')).rows[0];
  } else {
    pool=new pg.Pool({connectionString:url}); actor={season:Number(process.env.RC1_ELECTION_SEASON)};
  }
  readPool=new pg.Pool({connectionString:url});
  prior=await resources.snapshotWorldResources(readPool);
  observer=createNativeCommitObserver({context:()=>({authority:'recordReckoning',case:activeCase}),
    onAttempt:event=>proof.record({kind:'native-query-attempt',event}),
    async onBoundary(event){
      const after=await resources.snapshotWorldResources(readPool), witness=await probe.boundary(event);
      const journal=resources.reconcileWorldResources(prior,after,{identity:event,includeRestrictedChanges:true,seasonElectionProvenance:witness});
      if(witness){const id=captures.length+1;await proof.artifact(`election-witness-${id}.json`,witness);
        await proof.artifact(`election-before-${id}.json`,prior);await proof.artifact(`election-after-${id}.json`,after);
        captures.push({witness,before:prior,after,journal});}
      await proof.record({kind:'resource-commit-boundary',event,journal});prior=after;boundaries++;
    }});
  const observedPool={async connect(){const client=await pool.connect(),query=observer.wrapQuery(client,client.query.bind(client));
    return new Proxy(client,{get(target,key){if(key==='query')return query;const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});},
    async query(sql,values){const client=await this.connect();try{return await client.query(sql,values);}finally{client.release();}}};
  const invoke=async label=>{activeCase=label;prior=await resources.snapshotWorldResources(readPool);observer.arm();
    try{return await proof.invoke('original-recordReckoning',{season:Number(actor.season),label},()=>recordReckoning(observedPool,Number(actor.season)));}
    finally{observer.assertComplete();observer.disarm();}};
  fullBefore=await proof.snapshot(pool,'initial');
  if(childMode){
    assert.equal(await invoke('fresh-process-retry'),null);
    const after=await proof.snapshot(pool,'final');assert.equal(after.stateSha256,fullBefore.stateSha256);
    assert.deepEqual(after.tables,fullBefore.tables);assert.deepEqual(after.sequences,fullBefore.sequences);
    assert.equal(captures.length,1);assert.equal(captures[0].witness.scores.length,1);
    assert.equal(captures[0].witness.scores[0].input.length,4);assert.equal(captures[0].journal.seasonCrowns.elections.length,0);
    result={status:'PASS_SCOPED',cache:'Fresh process recomputed all four entrants',fullStateExactRetry:true,appliedElections:0,boundaries,matrixQualifying:false};
  }else{
    assert(await invoke('cold-election'));assert.equal(captures.length,1);
    const positive=captures[0];assert.equal(positive.witness.scores.length,1);assert.equal(positive.witness.scores[0].input.length,3);
    assert.equal(positive.journal.seasonCrowns.elections.length,1);assert.equal(positive.journal.unsupported.length,0);
    const first=await proof.snapshot(pool,'first-election');
    await proof.invoke('additional-ordinary-entry',{index:3},async()=>{
      const guest=await request({method:'POST',url:'/v1/auth/guest'});
      const born=await request({method:'POST',url:'/v1/character',headers:{authorization:`Bearer ${guest.token}`,'idempotency-key':'cold-entry-3'},payload:{name:'Cold Election 3'}});
      return{characterId:born.id};
    });
    const warmBefore=await proof.snapshot(pool,'warm-before');assert.equal(await invoke('warm-cache-exact-retry'),null);
    const warm=captures[1];assert(warm);assert.equal(warm.witness.scores.length,0,'Warm-cache control must actually hit original memo');
    assert.match(verifyColdSeasonElection(warm.before,warm.after,warm.witness).unsupported,/cache-hit/);
    const warmAfter=await proof.snapshot(pool,'warm-after');assert.deepEqual(warmAfter.tables,warmBefore.tables);assert.deepEqual(warmAfter.sequences,warmBefore.sequences);
    const failures=[];
    for(const [label,mutate] of [
      ['wrong eligibility',w=>{for(const state of [w.before,w.after])state.tables.accounts[0].status='banned';}],
      ['wrong tie order',w=>{w.scores[0].output.reverse();}],
      ['missing input',w=>{w.queries[0].rows.pop();}],
      ['duplicate input',w=>{w.queries[0].rows.push(structuredClone(w.queries[0].rows[0]));}],
      ['wrong saved winner',w=>{w.queries.at(-1).parameters[2]='foreign';}],
    ]){const corrupted=structuredClone(positive.witness);mutate(corrupted);
      assert.throws(()=>verifyColdSeasonElection(positive.before,positive.after,corrupted));failures.push(label);}
    await proof.artifact('native-corruption-controls.json',{scope:'Corruptions of exact captured native evidence, not gameplay mutations',rejected:failures});
    const invariants=await runLedgerInvariants(pool,{alert:false});assert(invariants.ok);await proof.record({kind:'canonical-invariants',checks:invariants.checks});
    await app.close();await pool.end();app=null;pool=null;await readPool.end();readPool=null;
    const restart=path.join(output,'restart'), fd=await fs.open(path.join(output,'restart-output.txt'),'wx');
    const child=spawnSync(process.execPath,[process.argv[1],'--postgres','--restart-child'],{env:{...process.env,RC1_ELECTION_OUTPUT:restart,
      RC1_ELECTION_EXISTING_DATABASE:url,RC1_ELECTION_SEASON:String(actor.season)},stdio:['ignore',fd.fd,fd.fd],timeout:120000,windowsHide:true});await fd.close();
    assert.equal(child.status,0,child.error?.message);const restarted=JSON.parse(await fs.readFile(path.join(restart,'run.json'),'utf8'));
    await verifyArtifactIndex(restart,restarted);assert.equal(restarted.status,'PASS_SCOPED');
    await proof.artifact('restart-link.json',{source:restarted.source,manifest:restarted,statement:'Separate child evidence retained; original database remains owned by this parent'});
    result={status:'PASS_SCOPED',originalNativeElection:true,eligibleZeroStandingActors:3,preservedActualTiedOrder:true,
      positiveCrown:1,warmCacheExplicitlyUnsupported:true,freshProcessRecomputedActors:4,fullStateExactRetry:true,
      nativeEvidenceCorruptionsRejected:failures.length,boundaries,initialStateSha256:fullBefore.stateSha256,firstElectionStateSha256:first.stateSha256,
      invariantChecks:55,matrixQualifying:false};
  }
}catch(error){result={status:'FAIL',error:error.message,stack:error.stack};process.exitCode=1;
  await proof.record({kind:'first-failure',...result});if(pool)await proof.snapshot(pool,'failure');
}finally{
  await proof.artifact('election-probe-final.json',probe.diagnostic());if(observer)await proof.artifact('commit-observer-final.json',observer.diagnostic());
  if(app)await app.close();if(pool)await pool.end();if(readPool)await readPool.end();seam.restore();
  if(owned)try{await proof.record({kind:'database-cleanup',...await owned.close()});}catch(error){result.status='FAIL';result.cleanupError=error.message;process.exitCode=1;}
  const sealed=await proof.finish(result);await verifyArtifactIndex(output,sealed);
}
console.log(JSON.stringify(result));
