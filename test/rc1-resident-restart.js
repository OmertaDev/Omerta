// Bounded native reproduction of the retained alliance restart's extra resident turn.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase } from '../tools/rc1-native-worker.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, restoreCheckpoint, canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = arg('output'), retained = arg('retained'), mode = arg('mode');
assert(output && retained && process.env.COORDINATION_TEST_DATABASE_URL);
if (!mode) {
  const modes = arg('reference') ? ['interrupted','recovered'] : ['uninterrupted','restarted'];
  for (const step of modes) execFileSync(process.execPath,
    [fileURLToPath(import.meta.url), `--output=${output}`, `--retained=${retained}`, `--mode=${step}`,
      ...(arg('reference') ? [`--reference=${arg('reference')}`] : [])], { stdio: 'inherit' });
} else {
  const source = await sourceIdentity(), directory = path.join(output, mode);
  const read = async (base, file) => JSON.parse(await fs.readFile(path.join(base, file), 'utf8'));
  const reference = arg('reference') || path.join(output,'uninterrupted');
  const parent = mode === 'uninterrupted' ? retained : mode === 'recovered' ? path.join(output,'interrupted') : reference;
  const label = mode === 'uninterrupted' ? 'alliance-hour24' : mode === 'recovered' ? 'partial' : 'resident-checkpoint';
  const checkpoint = await read(parent, `${label}-checkpoint.json`);
  const saved = mode === 'uninterrupted' ? await read(parent, `${label}-continuation.json`) : await read(parent, 'resident-cursor.json');
  const tape = mode === 'uninterrupted' ? (await read(parent, `${label}-random-tape.json`)).draws : saved.draws;
  const seed = 'rc1-alpha', start = saved.logicalAt;
  const database = planOwnedWorldDatabase({ controlUrl: process.env.COORDINATION_TEST_DATABASE_URL,
    runId: `resident-${mode}`, sourceRevision: source.revision });
  const proof = await createProofRecorder({ directory, source, runId: `resident-${mode}`, seed,
    scenarioId: 'retained-resident-restart', population: 25,
    configuration: { retainedCheckpoint: checkpoint, mode, scope: 'Original resident-turn transition only; all tables and sequences compared. No whole-worker or matrix claim.' } });
  const runtime = installSerialRuntime(seed, new Date(start).toISOString());
  let at = start; runtime.bindClock(() => at); runtime.restoreTape(tape);
  const controller = createWorkerSchedule({ start, setClock: value => { at = value; } });
  const seam = installWorkerInstrumentation(controller, { namespace: checkpoint.schema });
  process.env.DATABASE_URL = database.url;
  let pool, result = { status: 'FAIL' };
  try {
    await proof.record({ kind: 'database-created', ...await database.create() });
    pool = await restoreCheckpoint(checkpoint, path.join(parent, `${label}.dump`), database.url, { poolFactory: seam.clock.poolFactory });
    const { runResidentBehaviour } = await import('../src/population.js');
    if (mode === 'interrupted') {
      at += 3600000;
      let connections = 0;
      // Stop between native commits: the first resident effect is durable; the other five aren't.
      const interrupted = { ...pool, connect: async () => {
        if (++connections === 3) throw Error('bounded process interruption');
        return pool.connect();
      } };
      await assert.rejects(runResidentBehaviour(interrupted),/bounded process interruption/);
      const pending = (await pool.query('SELECT behaviour_turn FROM population_state WHERE id=1')).rows[0].behaviour_turn;
      assert.equal(pending.pending.length,5);
      await proof.checkpoint(pool,'partial',database.url);
      await proof.artifact('resident-cursor.json',{logicalAt:at,draws:runtime.tape});
      result={status:'PASS_SCOPED',mode,committedResidents:1,pendingResidents:5};
    } else {
    if (mode === 'uninterrupted') {
      // Apply the real additive schema migration to the exact retained native checkpoint.
      const migrated = await makeWorkerDatabase(controller); await migrated.end();
      const first = await runResidentBehaviour(pool); assert(first.acted > 0);
      await proof.artifact('first-turn.json', first);
      await proof.checkpoint(pool, 'resident-checkpoint', database.url);
      await proof.artifact('resident-cursor.json', { logicalAt: at, draws: runtime.tape });
    } else if (mode === 'restarted') {
      const before = await canonicalDatabaseSnapshot(pool), draws = runtime.tape.length;
      const duplicate = await runResidentBehaviour(pool);
      assert.deepEqual(duplicate, { acted: 0, actions: {} });
      assert.equal(runtime.tape.length, draws, 'Restart consumed authoritative randomness');
      assert.equal((await canonicalDatabaseSnapshot(pool)).stateSha256, before.stateSha256, 'Restart added a resident effect');
      await proof.artifact('duplicate-control.json', { unchangedStateSha256: before.stateSha256, newRandomDraws: 0, duplicate });
    }
    if(mode !== 'recovered') at += 3600000;
    const next = await runResidentBehaviour(pool); assert(next.acted > 0);
    const final = await proof.snapshot(pool, 'final');
    await proof.artifact('random-tape.json', { draws: runtime.tape });
    if (mode === 'restarted' || mode === 'recovered') {
      assert.equal(final.stateSha256, (await read(reference, 'final.json')).stateSha256, 'Authoritative continuation differs');
      assert.deepEqual(runtime.tape, (await read(reference, 'random-tape.json')).draws, 'Continuation randomness differs');
    }
    if(mode === 'recovered') {
      at += 3600000; let failed = false;
      const failOne = { ...pool, connect: async () => {
        const client = await pool.connect();
        return new Proxy(client,{get(target,key){
          if(key==='query') return async(sql,values) => {
            if(!failed && sql.startsWith('SELECT id, cash, loc') && sql.includes('WHERE id=$1')) {
              failed=true; throw Error('one isolated resident failure');
            }
            return client.query(sql,values);
          };
          return typeof target[key] === 'function' ? target[key].bind(target) : target[key];
        }});
      }};
      const previousError=console.error; const errors=[]; console.error=(...args)=>errors.push(args.map(String));
      let completed;
      try { completed=await runResidentBehaviour(failOne); } finally {console.error=previousError;}
      assert(failed);assert.equal(errors.length,1);assert.equal(completed.acted,5);
      assert.deepEqual((await pool.query('SELECT behaviour_turn FROM population_state WHERE id=1')).rows[0].behaviour_turn.pending,[]);
      assert.deepEqual(await runResidentBehaviour(pool),{acted:0,actions:{}});
      at += 3600000; assert((await runResidentBehaviour(pool)).acted>0,'A failed resident starved the next hour');
      await proof.artifact('caught-failure-isolation.json',{failedResidents:1,otherResidentsCompleted:5,nextHourProgress:true});
    }
    result = { status: 'PASS_SCOPED', mode, finalStateSha256: final.stateSha256,
      comparedTables: Object.keys(final.tables).length, canonicalExclusions: [], next,
      restartedEqual: mode === 'restarted' || mode === 'recovered', randomDraws: runtime.tape.length };
    }
  } catch (error) {
    result = { status: 'FAIL', mode, error: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
    await proof.record({ kind: 'database-cleanup', ...await database.close() });
    seam.restore(); runtime.restore();
    await verifyArtifactIndex(directory, await proof.finish(result));
  }
  console.log(JSON.stringify(result));
}
