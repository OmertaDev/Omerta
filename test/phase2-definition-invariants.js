import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { baseLibrary, compileFixture, database, deferred, forwardPool, schema,
  activationRequest as request,seedLegacyCompatibility,snapshotLegacyCompatibility,probeInvariantReadFailure } from './lib/phase2-definition-fixtures.js';
import { storeSealedBundle, activateStoredBundle } from '../src/content/artifacts.js';
import { createActivationPolicy } from '../src/content/activation-policy.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { definitionByHash } from '../src/itemdefinitions.js';

const names = ['content_artifact_integrity', 'item_definition_integrity', 'content_membership_integrity',
  'content_activation_chain_integrity', 'content_selection_integrity',
  'content_activation_history_policy', 'content_activation_policy_drift'];
const policy = createActivationPolicy({ environment: 'test', allowedProfiles: ['phase2_economy'] });
const a = compileFixture(baseLibrary({ definitions: [
  { id: 'one', definitionVersion: 1, kind: 'concept' }, { id: 'two', definitionVersion: 1, kind: 'concept' }] }));
const b = compileFixture(baseLibrary({ version: 2, definitions: [{ id: 'one', definitionVersion: 1, kind: 'concept' }] }));
const check = (report, name) => {
  const result = report.checks.find((row) => row.name === name);
  assert(result, `ledger report must include ${name}`);
  return result;
};
function assertClean(report) {
  for (const name of names) assert.equal(check(report, name).ok, true, name);
  assert.equal(report.ok, true, 'existing ledger checks remain coherent');
}
const run = (pool, activationPolicy = policy) => runLedgerInvariants(pool, { alert: false, activationPolicy });

// Omitting the collector used to silently report a selected registry healthy without policy.
{
  const { pool } = await database();
  try {
    assertClean(await run(pool, null));
    await storeSealedBundle(pool, a.request);
    assertClean(await run(pool, null));
    await activateStoredBundle(pool, request(a), policy);
    assertClean(await run(pool));
    for (const invalid of [null, {}, { environment: 'test', allowedProfiles: ['phase2_economy'] },
      createActivationPolicy({ environment: 'test', allowedProfiles: [] })]) {
      const report = await run(pool, invalid);
      assert.deepEqual(report.checks.filter((row) => !row.ok).map((row) => row.name), ['content_activation_policy_drift']);
      assert.equal(check(report, 'content_activation_history_policy').ok, true);
    }
  } finally { await pool.end(); }
}
console.log('phase2-definition-invariants: legacy, register-only, selected policy and historical/current separation pass');

// A failed verifier SQL query is an unavailable audit, not evidence of corrupt stored data.
{
  const { pool } = await database();
  const target = compileFixture(baseLibrary({ definitions: [{ id: 'only', definitionVersion: 1, kind: 'concept' }] }));
  try {
    await storeSealedBundle(pool, target.request);
    await activateStoredBundle(pool, request(target), policy);
    for (const boundary of ['artifact', 'membership', 'intrinsic']) {
      for (const [code, expected] of [['40001', 'contention'], ['40P01', 'contention'], ['55P03', 'contention'],
        ['57014', 'internal'], ['08006', 'internal'], ['ECONNRESET', 'internal'], ['23505', 'content_registry_corrupt'],
        ['unexpected_read_failure', 'unexpected_read_failure'], ['bad_content_request', 'bad_content_request'], [null, 'internal']]) {
        await probeInvariantReadFailure(pool, target, { boundary, code, expected });
      }
    }
  } finally { await pool.end(); }
}
console.log('phase2-definition-invariants: 30 operational/unexpected verifier read refusals preserve safe owner errors, no alerts, state and gate usability');

// A deliberate disposable corruption schema removes only Phase 2 constraints. It does not
// replace direct constraint rejection tests, and each mutation is restored from a real baseline.
{
  const corruptionSchema = schema.replace(/^  CONSTRAINT p2_.* (?:FOREIGN KEY|CHECK) .*\r?\n/gm, '').replace(/,\s*\);/g, '\n);');
  const { pool, mem } = await database({ schemaText: corruptionSchema });
  try {
    await storeSealedBundle(pool, a.request); await storeSealedBundle(pool, b.request);
    await activateStoredBundle(pool, request(a), policy);
    await activateStoredBundle(pool, request(b, 1, a), policy);
    const baseline = await run(pool);
    const backup = mem.backup();
    const cases = [
      ['artifact bytes', 'content_artifact_integrity', 'UPDATE content_bundle_artifacts SET canonical_bytes=$1', [Buffer.from('private-corruption-marker')]],
      ['artifact hash', 'content_artifact_integrity', "UPDATE content_bundle_artifacts SET source_hash='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'"],
      ['artifact metadata', 'content_artifact_integrity', "UPDATE content_bundle_artifacts SET compiler_version='wrong'"],
      ['report map', 'content_artifact_integrity', "UPDATE content_bundle_artifacts SET report_hashes_json='{}'"],
      ['definition preimage', 'item_definition_integrity', 'UPDATE item_definition_versions SET canonical_definition_bytes=$1', [Buffer.from('{}')]],
      ['definition projection', 'item_definition_integrity', "UPDATE item_definition_versions SET family='wrong'"],
      ...[['uppercase', 'A'.repeat(64)], ['nonhex', 'z'.repeat(64)], ['wrong length', 'a'.repeat(63)]].map(([label,hash]) =>
        [`definition hash ${label}`, 'item_definition_integrity', 'UPDATE item_definition_versions SET definition_hash=$1 WHERE definition_hash=$2',
          [hash,a.expectedDefinitions[0].definitionHash]]),
      ['missing membership', 'content_membership_integrity', 'DELETE FROM content_bundle_item_definitions WHERE bundle_hash=$1', [a.identity.bundleHash]],
      ['extra membership', 'content_membership_integrity', 'INSERT INTO content_bundle_item_definitions SELECT $1,logical_item_id,definition_hash,1 FROM content_bundle_item_definitions WHERE bundle_hash=$2 AND ordinal=1', [b.identity.bundleHash, a.identity.bundleHash]],
      ['membership order', 'content_membership_integrity', 'UPDATE content_bundle_item_definitions SET ordinal=ordinal+10'],
      ['definition count', 'content_membership_integrity', 'UPDATE content_bundle_artifacts SET definition_count=0'],
      ...['bundle_hash','dependency_lock_hash','previous_dependency_lock_hash'].map((column) =>
        [column, 'content_activation_chain_integrity', `UPDATE content_activation_events SET ${column}=$1 WHERE activation_revision=2`, ['a'.repeat(64)]]),
      ...[['bundle_version','9'],['compiler_version',"'wrong'"],['ir_version','2'],['profile',"'wrong'"],['report_hashes_json',"'{}'"]].map(([column,value]) =>
        [column, 'content_activation_chain_integrity', `UPDATE content_activation_events SET ${column}=${value} WHERE activation_revision=2`]),
      ['noncanonical policy', 'content_activation_history_policy', 'UPDATE content_activation_events SET policy_snapshot_json=$1',
        [JSON.stringify({allowedProfiles:['phase2_economy'],environment:'test'},null,2)]],
      ['unknown policy key', 'content_activation_history_policy', 'UPDATE content_activation_events SET policy_snapshot_json=$1', ['{"allowedProfiles":["phase2_economy"],"environment":"test","extra":true}']],
      ['missing revision', 'content_activation_chain_integrity', 'DELETE FROM content_activation_events WHERE activation_revision=1'],
      ['wrong predecessor', 'content_activation_chain_integrity', 'UPDATE content_activation_events SET previous_bundle_hash=$1 WHERE activation_revision=2', [b.identity.bundleHash]],
      ['missing pointer', 'content_activation_chain_integrity', 'DELETE FROM content_bundle_activations'],
      ['pointer event', 'content_activation_chain_integrity', 'UPDATE content_bundle_activations SET last_event_id=999'],
      ['missing selection', 'content_selection_integrity', 'DELETE FROM item_definition_activations'],
      ['missing selected event', 'content_selection_integrity', 'DELETE FROM content_activation_events WHERE activation_revision=2'],
      ['extra selection', 'content_selection_integrity', 'INSERT INTO item_definition_activations SELECT logical_item_id,definition_hash,$1,bundle_hash,1,1 FROM content_bundle_item_definitions WHERE bundle_hash=$2 AND ordinal=1', [a.identity.packageId,a.identity.bundleHash]],
      ['foreign selection', 'content_selection_integrity', "UPDATE item_definition_activations SET package_id='omerta.foreign'"],
      ['old generation', 'content_selection_integrity', 'UPDATE item_definition_activations SET activation_revision=1'],
      ['fixture selected', 'content_activation_policy_drift', "UPDATE content_bundle_artifacts SET authority_profile='fixture', package_kind='fixture',activatable=false"],
      ['fixture selection integrity', 'content_selection_integrity', "UPDATE content_bundle_artifacts SET authority_profile='fixture', package_kind='fixture',activatable=false"],
    ];
    for (const [label, name, sql, values] of cases) {
      backup.restore(); await pool.query(sql, values);
      let report;
      await assert.doesNotReject(async () => { report = await run(pool); }, `${label}: stored corruption must retain the full audit`);
      assert.equal(check(report, name).ok, false, label);
      for (const required of names) check(report, required);
      const output = JSON.stringify(report);
      assert(!output.includes('private-corruption-marker') && !output.includes('canonical_definition_bytes'), label);
      assert.equal(report.checks.length, baseline.checks.length, 'complete audit must survive corruption');
      assert.deepEqual(report.checks.filter((row) => !names.includes(row.name)),
        baseline.checks.filter((row) => !names.includes(row.name)), 'legacy checks must survive corruption unchanged');
      for (const required of names) {
        const issues = check(report,required).issues;
        assert(issues.length <= 20 && issues.every((value) => /^row:\d+$/.test(value)), 'diagnostics stay bounded and positional');
      }
    }
    backup.restore(); assertClean(await run(pool));
    for(let i=0;i<25;i++) await pool.query(`INSERT INTO content_bundle_activations
      (namespace,bundle_hash,last_event_id,activated_by,activated_at,activation_revision)
      VALUES ($1,$2,999,'bounded-diagnostic',now(),1)`,[`omerta.broken${i}`,'a'.repeat(64)]);
    const bounded=check(await run(pool),'content_activation_policy_drift');
    assert.equal(bounded.drift,25);assert.equal(bounded.issues.length,20);
    console.log(`phase2-definition-invariants: ${cases.length} independently restored corruption cases pass`);
  } finally { await pool.end(); }
}

// A tail-only read wait lets a writer splice generations after the first collection query.
{
  const { pool } = await database();
  try {
    await storeSealedBundle(pool, a.request); await storeSealedBundle(pool, b.request);
    await activateStoredBundle(pool, request(a), policy);
    const entered = deferred(), release = deferred(); let first = true;
    const reader = forwardPool(pool, { after: async (sql) => {
      if (first && sql.includes('FROM content_bundle_artifacts')) {
        first = false;
        assert.equal((await definitionByHash(reader, a.expectedDefinitions[0].definitionHash)).definitionVersion, 1);
        entered.resolve(); await release.promise;
      }
    } });
    // The nested helper uses the callback's exact queryable in pg-mem (the forwarding pool).
    const reading = run(reader); await entered.promise;
    let completed = false;
    const writing = activateStoredBundle(new Proxy(pool, {}), request(b, 1, a), policy).then((value) => { completed = true; return value; });
    await pause(30); assert.equal(completed, false);
    release.resolve(); assertClean(await reading); await writing; assertClean(await run(pool));
    for (const fail of [false,true]) {
      const locked = deferred(), proceed = deferred(); let paused = false;
      const writer = forwardPool(pool, { after: async (sql) => {
        if (!paused && sql.startsWith('INSERT INTO content_activation_events')) {
          paused = true; locked.resolve(); await proceed.promise; if (fail) throw Error('injected');
        }
      } });
      const target = fail ? b : a;
      const revision = fail ? 3 : 2, previous = fail ? a : b;
      const mutation = activateStoredBundle(writer, request(target,revision,previous),policy).then(() => 'committed', (error) => error.code);
      await locked.promise;
      let readDone = false; const pending = run(new Proxy(pool, {})).then((value) => { readDone = true; return value; });
      await pause(30); assert.equal(readDone,false); proceed.resolve();
      assert.equal(await mutation,fail ? 'internal' : 'committed'); assertClean(await pending);
    }
  } finally { await pool.end(); }
}
console.log('phase2-definition-invariants: whole-callback cross-alias reads and commit/compensation interleavings pass');

{
  const {pool}=await database();
  try {
    const {r1,activate}=await seedLegacyCompatibility(pool);
    const before=await snapshotLegacyCompatibility(pool);
    await assert.rejects(activate(r1),(error)=>error.code==='content_version_regression'
      && error.message==='An older content version cannot replace an active newer version.');
    const unchanged=async()=>assert.deepEqual(await snapshotLegacyCompatibility(pool),before);
    await unchanged();
    const a=compileFixture(baseLibrary({packageId:r1.namespace,definitions:[{id:'note',definitionVersion:1,kind:'concept'}]}));
    const b=compileFixture(baseLibrary({packageId:r1.namespace,version:2,definitions:[]}));
    for(const artifact of [a,b]){await storeSealedBundle(pool,artifact.request);await unchanged();}
    for(const [target,revision,previous] of [[a,0,null],[b,1,a],[a,2,b]]){
      await activateStoredBundle(pool,request(target,revision,previous),policy);await unchanged();
    }
    assertClean(await run(pool));await unchanged();
    console.log('phase2-definition-invariants: populated legacy R2 refusal, pinned R1, Bellini lots/jobs/skill/tool/exchange, Phase 1 custody/replay and ledger equal after every Phase 2 boundary');
  }finally{await pool.end();}
}

// Alert queries may start a new Phase 2 callback only after the read gate has been released.
{
  const {pool}=await database();const original=console.error;
  try{
    await storeSealedBundle(pool,a.request);await activateStoredBundle(pool,request(a),policy);
    let delivered=false;
    const alertPool=forwardPool(pool,{before:async(sql)=>{
      if(sql.startsWith('INSERT INTO telemetry')){await storeSealedBundle(pool,b.request);delivered=true;}
    }});
    console.error=()=>{};
    const report=await runLedgerInvariants(alertPool,{activationPolicy:null});
    assert.equal(report.ok,false);assert.equal(delivered,true);
  }finally{console.error=original;await pool.end();}
}
console.log('phase2-definition-invariants: alert delivery occurs after gate release');
