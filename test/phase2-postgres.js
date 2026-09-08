import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { makeDb, dbCaps, verifyPhase2DefinitionSchema, migrateSchemaUnderLock } from '../src/db.js';
import { baseLibrary, compileFixture, materialSource, schema, TABLES, deferred, forwardPool,
  snapshotPhase2, activationRequest as request, probeInvariantReadFailure } from './lib/phase2-definition-fixtures.js';
import { storeSealedBundle, activateStoredBundle } from '../src/content/artifacts.js';
import { definitionByHash,activeDefinition } from '../src/itemdefinitions.js';
import { createActivationPolicy } from '../src/content/activation-policy.js';
import { runLedgerInvariants } from '../src/invariants.js';

function endpoint() {
  assert(process.argv.length === 3 && ['--definitions', '--lots'].includes(process.argv[2]),
    'explicit --definitions or --lots required; unknown options refused');
  assert(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL is required; no default or skip');
  let url;
  try { url = new URL(process.env.TEST_DATABASE_URL); } catch { throw Error('invalid explicit PostgreSQL test endpoint'); }
  assert(['postgres:','postgresql:'].includes(url.protocol) && url.hostname && url.pathname.length > 1,
    'explicit PostgreSQL scheme, host and database are required');
  return url;
}
const ownedName = (name) => { assert.match(name, /^p2_definitions_[0-9a-f]{32}$/); return name; };
const policy = createActivationPolicy({ environment: 'postgres-test', allowedProfiles: ['phase2_economy'] });
const concept = (id = 'note', version = 1) => ({ id, definitionVersion: version, kind: 'concept' });
const fixture = (name,version = 1,definitions = [concept()]) => compileFixture(baseLibrary({ packageId: `omerta.pg.${name}`, version, definitions }));
const rejects = (promise,code) => assert.rejects(promise,(error) => error.code === code,`expected ${code}`);
const safeError = (error) => {
  if (error?.code !== 'ERR_ASSERTION') return `code: ${/^[a-zA-Z0-9_]{1,64}$/.test(error?.code ?? '') ? error.code : 'test_failed'}`;
  const location = String(error.stack ?? '').match(/(?:test[\\/])?(phase2-[a-z-]+\.js:\d+:\d+)/)?.[1] ?? 'unknown assertion location';
  const scalar = (value) => value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
    ? JSON.stringify(value) : '[redacted non-scalar]';
  return `assertion at ${location}; actual=${scalar(error.actual)} expected=${scalar(error.expected)}; ${String(error.operator ?? '').replace(/[^a-zA-Z]/g, '').slice(0, 32)}`;
};

// Only the already verified native child can allocate these per-block schemas. The locally retained
// exact name grants cleanup ownership only after CREATE is positively acknowledged. An ambiguous
// CREATE or a pre-existing name fails without claiming/dropping that schema.
function lotFixtureFactory(parentPool, verifiedChildUrl) {
  return async () => {
    const fixtureName = ownedName('p2_definitions_' + randomUUID().replaceAll('-', ''));
    let created = false, fixturePool = null, disposed = false;
    const dispose = async () => {
      if (disposed) return;
      if (fixturePool) { await fixturePool.end(); fixturePool = null; }
      if (created) {
        await parentPool.query(`DROP SCHEMA "${ownedName(fixtureName)}" CASCADE`);
        created = false;
      }
      disposed = true;
    };
    try {
      const prior = await parentPool.query('SELECT nspname FROM pg_namespace WHERE nspname=$1', [fixtureName]);
      assert.equal(prior.rows.length, 0, 'fresh native lot fixture schema must not pre-exist');
      await parentPool.query(`CREATE SCHEMA "${fixtureName}"`); created = true;
      const fixtureUrl = new URL(verifiedChildUrl.toString());
      fixtureUrl.searchParams.set('options', `-c search_path=${fixtureName} -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000`);
      fixturePool = new pg.Pool({ connectionString: fixtureUrl.toString(), max: 12 });
      const settings = (await fixturePool.query(`SELECT current_schema() AS schema,
        current_setting('statement_timeout') AS timeout,current_setting('lock_timeout') AS lock_timeout,
        current_setting('idle_in_transaction_session_timeout') AS idle_timeout,current_database() AS database,current_user AS role`)).rows[0];
      const parentSettings = (await parentPool.query('SELECT current_database() AS database,current_user AS role')).rows[0];
      assert.equal(settings.schema, fixtureName); assert.equal(settings.timeout, '30s');
      assert.equal(settings.lock_timeout, '5s'); assert.equal(settings.idle_timeout, '30s');
      assert.equal(settings.database, parentSettings.database); assert.equal(settings.role, parentSettings.role);
      await fixturePool.query(schema);
      return { pool: fixturePool, dispose };
    } catch (error) {
      try { await dispose(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'native fixture setup and cleanup failed'); }
      throw error;
    }
  };
}

async function parent(url) {
  // An admin connection creates/drops only names generated and retained by this invocation.
  url.searchParams.set('options', '-c search_path=pg_catalog -c statement_timeout=30000 -c lock_timeout=5000');
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    for (const mode of process.argv[2] === '--lots' ? ['lots-boundary', 'lots', 'lots-upgrade'] : ['clean','upgrade','scalar','missing-unique']) {
      const name = ownedName('p2_definitions_'+randomUUID().replaceAll('-',''));
      await admin.query(`CREATE SCHEMA "${name}"`);
      try {
        const childUrl = new URL(url);
        childUrl.searchParams.set('options', `-c search_path=${name} -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000`);
        const result = spawnSync(process.execPath,[fileURLToPath(import.meta.url),process.argv[2]], {
          env: { ...process.env, TEST_DATABASE_URL: childUrl.toString(), DATABASE_URL: childUrl.toString(),
            P2_TEST_SCHEMA: name, P2_TEST_CHILD: mode, INVARIANT_WEBHOOK_URL: '', PG_POOL_MAX: '12' },
          encoding: 'utf8', timeout: 240000, maxBuffer: 8*1024*1024, windowsHide: true,
        });
        process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
        assert.equal(result.status,0,`isolated ${mode} child must pass (status ${result.status}, signal ${result.signal}, spawn ${result.error?.code ?? 'none'})`);
      } finally { await admin.query(`DROP SCHEMA "${ownedName(name)}" CASCADE`); }
    }
  } finally { await admin.end(); }
}
async function child(url) {
  const name = ownedName(process.env.P2_TEST_SCHEMA);
  assert.equal(url.searchParams.get('options'), `-c search_path=${name} -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000`);
  // The independent preflight connection verifies the exact child-scoped DSN before ANY DDL.
  const preflight = new pg.Client({ connectionString: url.toString() });
  await preflight.connect();
  const settings = (await preflight.query("SELECT current_schema() AS schema,current_setting('statement_timeout') AS timeout,current_setting('lock_timeout') AS lock_timeout,current_setting('server_version_num') AS server_version_num,version() AS version")).rows[0];
  assert.equal(settings.schema,name); assert.equal(settings.timeout,'30s'); assert.equal(settings.lock_timeout,'5s');
  const mode = process.env.P2_TEST_CHILD;
  let before, oldConstraints;
  if (mode === 'lots-upgrade') {
    const { seedPre41ItemGuards } = await import('./lib/phase2-item-fixtures.js');
    before = await seedPre41ItemGuards(preflight);
  }
  const legacy = schema.slice(0,schema.indexOf('-- Phase 2 sealed definition plane;'));
  if (mode === 'upgrade') {
    await preflight.query(legacy);
    await preflight.query("INSERT INTO content_bundles(namespace,version,schema_version,content_hash,bundle_json,registered_by) VALUES ('omerta.pg.legacy',2,1,$1,'{}','legacy')", ['b'.repeat(64)]);
    await preflight.query("INSERT INTO content_activations(namespace,version,content_hash,activated_by) VALUES ('omerta.pg.legacy',2,$1,'legacy')", ['b'.repeat(64)]);
    await preflight.query(`INSERT INTO content_instances(id,namespace,version,content_hash,experience_id,root_node_id,
      scope_kind,scope_id,created_by_account) VALUES ($1,'omerta.pg.legacy',2,$2,'legacy-case','legacy-case','crew','legacy-crew',$3)`,
    [randomUUID(),'b'.repeat(64),randomUUID()]);
    before = await legacySnapshot(preflight);
    oldConstraints = await legacyConstraints(preflight);
  }
  if (mode === 'scalar' || mode === 'missing-unique') {
    const artifactDdl = schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS content_bundle_artifacts'),schema.indexOf('CREATE TABLE IF NOT EXISTS item_definition_versions'));
    const omitted = mode === 'scalar' ? 'p2_artifact_definition_count_ck' : 'p2_artifact_namespace_hash_lock_uq';
    await preflight.query(artifactDdl.replace(new RegExp(`^  CONSTRAINT ${omitted}.*\\r?\\n`,'m'),'').replace(/,\s*\);/g,'\n);'));
    let verifierReached = false, stamped = false;
    const trace = { query: async (sql,values) => {
      if (sql.includes('FROM pg_class c JOIN pg_namespace')) verifierReached = true;
      if (sql.startsWith('INSERT INTO schema_meta')) stamped = true;
      return preflight.query(sql,values);
    } };
    // The boot seam is exercised while holding the same session lock used by makeDb.
    await preflight.query('SELECT pg_advisory_lock($1)',[918273645]);
    try { await rejects(migrateSchemaUnderLock(trace),mode === 'scalar' ? 'content_registry_schema_invalid' : '42830'); }
    finally { await preflight.query('SELECT pg_advisory_unlock($1)',[918273645]); }
    assert.equal(verifierReached,mode === 'scalar'); assert.equal(stamped,false);
    await preflight.end();
    console.log(`phase2-postgres: ${mode} fails before startup stamp (${mode === 'scalar' ? 'content_registry_schema_invalid' : '42830'}), verifier reached=${verifierReached}`);
    return;
  }
  await preflight.end();
  process.env.DATABASE_URL = url.toString();
  const pool = await makeDb();
  try {
    assert.equal(dbCaps.skipLocked,true); assert.equal((await pool.query('SELECT current_schema() AS schema')).rows[0].schema,name);
    if (mode === 'lots-upgrade') {
      const { verifyPre41ItemGuardUpgrade } = await import('./lib/phase2-item-fixtures.js');
      await verifyPre41ItemGuardUpgrade(pool, before);
      const second = await makeDb();
      try { await verifyPre41ItemGuardUpgrade(second, before); } finally { await second.end(); }
      console.log(`phase2-postgres: ${settings.version}`);
      console.log('phase2-postgres: populated pre-4.1 guards survive two real boots with exact raw v1/null-ID replay; null-ID v2 SQL refused');
      return;
    }
    if (mode === 'lots-boundary') {
      const { runLotBoundary } = await import('./phase2-lot-boundary.js');
      await runLotBoundary(pool);
      console.log(`phase2-postgres: exact item boundary on ${settings.version}`);
      return;
    }
    if (mode === 'lots') {
      const { runLots } = await import('./phase2-lots.js');
      const fixtureFactory = lotFixtureFactory(pool, url);
      let fixtureCount = 0;
      await runLots(async () => { fixtureCount++; return fixtureFactory(); });
      assert.equal(fixtureCount, 6, 'every native root lot fixture block executed in its own fresh schema');
      await lotRaces(pool);
      const residue = (await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'p2_definitions_%' AND nspname<>$1", [name])).rows;
      assert.equal(residue.length, 0, 'native fixture schemas leave no residue');
      console.log(`phase2-postgres: exact lots on ${settings.version}`);
      return;
    }
    const second = await makeDb(); await second.end();
    await verifyPhase2DefinitionSchema(pool,{ compatibility: 'postgres' });
    const catalog = (await pool.query(`SELECT t.relname::text AS table_name,c.conname::text AS name,c.contype::text AS type,
      pg_get_constraintdef(c.oid,true) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() AND t.relname IN ($1,$2,$3,$4,$5,$6)
      ORDER BY t.relname,c.conname`,TABLES)).rows;
    assert.equal(new Set(catalog.map((row) => row.table_name)).size,6);
    const membership = catalog.find((row) => row.name === 'p2_selection_membership_fk');
    assert.equal(membership.definition,'FOREIGN KEY (bundle_hash, logical_item_id, definition_hash) REFERENCES content_bundle_item_definitions(bundle_hash, logical_item_id, definition_hash)');
    console.log(`phase2-postgres: backend ${settings.version}`);
    console.log(`phase2-postgres: ${mode} twice-applied migration, real capabilities and ${catalog.length} backend catalog constraints pass`);
    console.log('phase2-postgres: constraint catalog available; '+catalog.filter((row)=>row.name.startsWith('p2_')).length+' explicit p2 constraints');
    if(mode==='clean') console.log('phase2-postgres: named catalog '+JSON.stringify(catalog.filter((row)=>row.name.startsWith('p2_'))));
    if (mode === 'upgrade') {
      assert.deepEqual(await legacySnapshot(pool),before);
      const upgradedConstraints = await legacyConstraints(pool);
      verifyUpgradeConstraintCatalog(oldConstraints,upgradedConstraints,Number(settings.server_version_num));
      verifyUpgradeConstraintCausalNegatives(oldConstraints,upgradedConstraints,Number(settings.server_version_num));
      console.log('phase2-postgres: populated legacy hashes/pointer and complete legacy constraint catalog unchanged except exact lot/IO additions and two branch-aware replacements');
      console.log('phase2-postgres: seven upgrade catalog causal negatives reject unrelated/replacement/new removal or alteration and unexpected addition');
      return;
    }
    const failureTarget = fixture('read-failure');
    await storeSealedBundle(pool, failureTarget.request); await activateStoredBundle(pool, request(failureTarget), policy);
    for (const boundary of ['artifact', 'membership', 'intrinsic']) {
      for (const [code, expected, server] of [['40001', 'contention', false], ['ECONNRESET', 'internal', false],
        [null, 'internal', false], ['22012', 'internal', true]]) {
        await probeInvariantReadFailure(pool, failureTarget, { boundary, code, expected, server, real: true });
      }
    }
    console.log('phase2-postgres: 12 operational verifier refusals (including real server 22012) rollback/release before rejection, no alerts, unchanged rows and usable reads');
    await constraints(pool);
    await races(pool);
    await rollbackAndRecovery(pool);
    await serverFailures(pool);
    await snapshotEvidence(pool);
    await queryPlans(pool);
  } finally { await pool.end(); }
}
async function legacySnapshot(q) {
  return { bundles: (await q.query('SELECT * FROM content_bundles ORDER BY namespace,version')).rows,
    activations: (await q.query('SELECT * FROM content_activations ORDER BY namespace')).rows,
    pins: (await q.query('SELECT * FROM content_instances ORDER BY id')).rows };
}
async function legacyConstraints(q) {
  return (await q.query(`SELECT t.relname::text AS table_name,c.conname::text AS name,pg_get_constraintdef(c.oid,true) AS definition
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname=current_schema() AND t.relname NOT IN ($1,$2,$3,$4,$5,$6) ORDER BY t.relname,c.conname`,TABLES)).rows;
}
const constraintRow = (table_name,name,definition) => ({ table_name,name,definition });
const replacedUpgradeConstraints = [
  {
    before: constraintRow('item_events','item_event_kind',`CHECK (event_kind = ANY (ARRAY['stack_granted'::text, 'stack_consumed'::text, 'created'::text, 'transferred'::text, 'consumed'::text, 'escrowed'::text, 'released'::text]))`),
    after: constraintRow('item_events','item_event_kind',`CHECK (event_branch = 'legacy'::text AND (event_kind = ANY (ARRAY['stack_granted'::text, 'stack_consumed'::text, 'created'::text, 'transferred'::text, 'consumed'::text, 'escrowed'::text, 'released'::text])) OR event_branch = 'lot'::text AND (event_kind = ANY (ARRAY['lot_granted'::text, 'lot_consumed'::text, 'lot_split_debit'::text, 'lot_split_output'::text, 'lot_escrowed'::text, 'lot_released'::text, 'lot_escrow_consumed'::text])) OR event_branch = 'unique'::text AND (event_kind = ANY (ARRAY['unique_granted'::text, 'unique_escrowed'::text, 'unique_released'::text, 'unique_transferred'::text, 'unique_consumed'::text])) OR event_branch = 'observation'::text AND event_kind = 'migration_origin'::text)`),
  },
  {
    before: constraintRow('item_events','item_event_quantities',`CHECK ((event_kind = ANY (ARRAY['stack_granted'::text, 'stack_consumed'::text])) AND item_id IS NULL AND provenance_kind IS NULL AND quantity_delta IS NOT NULL AND quantity_delta <> 0 AND quantity_before IS NOT NULL AND quantity_before >= 0 AND quantity_after IS NOT NULL AND quantity_after >= 0 AND quantity_after = (quantity_before + quantity_delta) OR (event_kind <> ALL (ARRAY['stack_granted'::text, 'stack_consumed'::text])) AND item_id IS NOT NULL AND provenance_kind IS NOT NULL AND quantity_delta IS NULL AND quantity_before IS NULL AND quantity_after IS NULL)`),
    after: constraintRow('item_events','item_event_quantities',`CHECK (event_branch = 'legacy'::text AND ((event_kind = ANY (ARRAY['stack_granted'::text, 'stack_consumed'::text])) AND item_id IS NULL AND provenance_kind IS NULL AND quantity_delta IS NOT NULL AND quantity_delta <> 0 AND quantity_before IS NOT NULL AND quantity_before >= 0 AND quantity_after IS NOT NULL AND quantity_after >= 0 AND quantity_after = (quantity_before + quantity_delta) OR (event_kind <> ALL (ARRAY['stack_granted'::text, 'stack_consumed'::text])) AND item_id IS NOT NULL AND provenance_kind IS NOT NULL AND quantity_delta IS NULL AND quantity_before IS NULL AND quantity_after IS NULL) OR (event_branch = ANY (ARRAY['lot'::text, 'unique'::text])) AND provenance_kind IS NULL AND (event_branch = 'lot'::text AND item_id IS NULL OR event_branch = 'unique'::text AND item_id IS NOT NULL) AND quantity_delta IS NOT NULL AND quantity_before IS NOT NULL AND quantity_before >= 0 AND quantity_after IS NOT NULL AND quantity_after >= 0 AND quantity_after = (quantity_before + quantity_delta) AND ((event_kind = ANY (ARRAY['lot_granted'::text, 'lot_split_output'::text, 'unique_granted'::text])) AND quantity_before = 0 AND quantity_delta > 0 OR (event_kind = ANY (ARRAY['lot_consumed'::text, 'lot_split_debit'::text, 'lot_escrow_consumed'::text, 'unique_consumed'::text])) AND quantity_before > 0 AND quantity_delta < 0 OR (event_kind = ANY (ARRAY['lot_escrowed'::text, 'lot_released'::text, 'unique_escrowed'::text, 'unique_released'::text, 'unique_transferred'::text])) AND quantity_before > 0 AND quantity_delta = 0) AND (event_branch <> 'unique'::text OR (quantity_before = ANY (ARRAY[0, 1])) AND (quantity_after = ANY (ARRAY[0, 1]))) OR event_branch = 'observation'::text AND item_id IS NOT NULL AND provenance_kind IS NULL AND quantity_delta IS NOT NULL AND quantity_delta = 0 AND quantity_before IS NOT NULL AND (quantity_before = ANY (ARRAY[0, 1])) AND quantity_after IS NOT NULL AND quantity_after = quantity_before)`),
  },
];
// Independent expected pg_get_constraintdef output: this is intentionally not parsed from schema.sql.
const requiredUpgradeConstraints = [
  constraintRow('item_events','item_event_branch_ck',`CHECK (event_branch = 'legacy'::text AND mutation_id IS NULL AND event_ordinal IS NULL AND lot_id IS NULL AND definition_hash IS NULL AND snapshot_json IS NULL OR event_branch = 'lot'::text AND mutation_id IS NOT NULL AND event_ordinal IS NOT NULL AND event_ordinal >= 0 AND lot_id IS NOT NULL AND definition_hash IS NOT NULL AND snapshot_json IS NOT NULL OR (event_branch = ANY (ARRAY['unique'::text, 'observation'::text])) AND mutation_id IS NOT NULL AND event_ordinal IS NOT NULL AND event_ordinal >= 0 AND lot_id IS NULL AND item_id IS NOT NULL AND definition_hash IS NOT NULL AND snapshot_json IS NOT NULL)`),
  constraintRow('item_events','item_event_lot_fk',`FOREIGN KEY (lot_id, definition_hash) REFERENCES item_lots(lot_id, definition_hash)`),
  constraintRow('item_events','item_event_mutation_fk',`FOREIGN KEY (mutation_id) REFERENCES item_mutation_guards(mutation_id)`),
  constraintRow('item_events','item_event_unique_fk',`FOREIGN KEY (item_id, definition_hash) REFERENCES item_instances(id, definition_hash)`),
  constraintRow('item_instances','item_unique_attachment_ck',`CHECK (definition_hash IS NULL AND logical_item_id IS NULL AND quality_band IS NULL AND quality_state_digest IS NULL AND trade_policy_hash IS NULL AND condition_summary IS NULL AND export_policy IS NULL AND provenance_class IS NULL AND provenance_digest IS NULL AND mutation_id IS NULL AND output_ordinal IS NULL OR definition_hash IS NOT NULL AND logical_item_id IS NOT NULL AND trade_policy_hash IS NOT NULL AND trade_policy_hash = definition_hash AND condition_summary IS NULL AND export_policy IS NOT NULL AND export_policy = 'ineligible'::text AND provenance_class IS NOT NULL AND (provenance_class = ANY (ARRAY['crafted'::text, 'salvaged'::text, 'awarded'::text, 'imported'::text, 'migration_origin'::text])) AND provenance_digest IS NOT NULL AND char_length(provenance_digest) = 64 AND provenance_digest = lower(provenance_digest) AND translate(provenance_digest, '0123456789abcdef'::text, ''::text) = ''::text AND mutation_id IS NOT NULL AND output_ordinal IS NOT NULL AND output_ordinal >= 0 AND (quality_band IS NULL OR char_length(quality_band) >= 1 AND char_length(quality_band) <= 80) AND (quality_state_digest IS NULL OR char_length(quality_state_digest) = 64 AND quality_state_digest = lower(quality_state_digest) AND translate(quality_state_digest, '0123456789abcdef'::text, ''::text) = ''::text))`),
  constraintRow('item_instances','item_unique_definition_fk',`FOREIGN KEY (logical_item_id, definition_hash) REFERENCES item_definition_versions(logical_item_id, definition_hash)`),
  constraintRow('item_instances','item_unique_mutation_fk',`FOREIGN KEY (mutation_id) REFERENCES item_mutation_guards(mutation_id)`),
  constraintRow('item_lots','item_lot_attachment_uq',`UNIQUE (lot_id, definition_hash, mutation_id, output_ordinal, original_quantity)`),
  constraintRow('item_lots','item_lot_custody_ck',`CHECK (state = 'exhausted'::text AND custody_state IS NULL AND custody_scope IS NULL AND custody_id IS NULL AND depositor_scope IS NULL AND depositor_id IS NULL OR state = 'active'::text AND custody_state IS NOT NULL AND custody_state = 'direct'::text AND custody_scope IS NULL AND custody_id IS NULL AND depositor_scope IS NULL AND depositor_id IS NULL AND (owner_scope = ANY (ARRAY['character'::text, 'account'::text])) OR state = 'escrowed'::text AND custody_state IS NOT NULL AND custody_state = 'escrowed'::text AND custody_scope IS NOT NULL AND custody_scope = 'operation'::text AND custody_id IS NOT NULL AND owner_scope = 'operation'::text AND custody_id = owner_id AND depositor_scope IS NOT NULL AND (depositor_scope = ANY (ARRAY['character'::text, 'account'::text])) AND depositor_id IS NOT NULL AND char_length(depositor_id) >= 1 AND char_length(depositor_id) <= 200)`),
  constraintRow('item_lots','item_lot_definition_fk',`FOREIGN KEY (logical_item_id, definition_hash) REFERENCES item_definition_versions(logical_item_id, definition_hash)`),
  constraintRow('item_lots','item_lot_identity_uq',`UNIQUE (lot_id, definition_hash)`),
  constraintRow('item_lots','item_lot_mutation_fk',`FOREIGN KEY (mutation_id) REFERENCES item_mutation_guards(mutation_id)`),
  constraintRow('item_lots','item_lot_ordinal_ck',`CHECK (output_ordinal >= 0 AND (source_input_ordinal IS NULL OR source_input_ordinal >= 0 AND source_input_ordinal < output_ordinal))`),
  constraintRow('item_lots','item_lot_owner_ck',`CHECK ((owner_scope = ANY (ARRAY['character'::text, 'account'::text, 'operation'::text])) AND char_length(owner_id) >= 1 AND char_length(owner_id) <= 200)`),
  constraintRow('item_lots','item_lot_policy_ck',`CHECK (trade_policy_hash = definition_hash)`),
  constraintRow('item_lots','item_lot_provenance_ck',`CHECK ((provenance_class = ANY (ARRAY['crafted'::text, 'salvaged'::text, 'awarded'::text, 'imported'::text, 'migration_origin'::text])) AND char_length(provenance_digest) = 64 AND provenance_digest = lower(provenance_digest) AND translate(provenance_digest, '0123456789abcdef'::text, ''::text) = ''::text)`),
  constraintRow('item_lots','item_lot_quality_ck',`CHECK (quality_band IS NULL OR char_length(quality_band) >= 1 AND char_length(quality_band) <= 80)`),
  constraintRow('item_lots','item_lot_quality_digest_ck',`CHECK (quality_state_digest IS NULL OR char_length(quality_state_digest) = 64 AND quality_state_digest = lower(quality_state_digest) AND translate(quality_state_digest, '0123456789abcdef'::text, ''::text) = ''::text)`),
  constraintRow('item_lots','item_lot_quantity_ck',`CHECK (original_quantity >= 1 AND original_quantity <= 1000000 AND remaining_quantity >= 0 AND remaining_quantity <= original_quantity)`),
  constraintRow('item_lots','item_lot_state_ck',`CHECK (state = 'active'::text AND custody_state = 'direct'::text AND remaining_quantity > 0 OR state = 'escrowed'::text AND custody_state = 'escrowed'::text AND remaining_quantity > 0 OR state = 'exhausted'::text AND remaining_quantity = 0)`),
  constraintRow('item_lots','item_lots_pkey',`PRIMARY KEY (lot_id)`),
  constraintRow('item_mutation_inputs','item_input_branch_ck',`CHECK (event_branch = 'lot'::text AND lot_id IS NOT NULL AND item_id IS NULL AND (transition_kind = ANY (ARRAY['consume'::text, 'split'::text, 'escrow'::text, 'release'::text, 'consume_escrow_lot'::text])) OR event_branch = 'unique'::text AND lot_id IS NULL AND item_id IS NOT NULL AND quantity_before = 1 AND attachment_quantity = 1 AND (transition_kind = ANY (ARRAY['escrow'::text, 'release'::text, 'transfer_unique'::text, 'consume_unique'::text])))`),
  constraintRow('item_mutation_inputs','item_input_event_fk',`FOREIGN KEY (event_id, mutation_id, input_ordinal, event_branch, definition_hash) REFERENCES item_events(id, mutation_id, event_ordinal, event_branch, definition_hash)`),
  constraintRow('item_mutation_inputs','item_input_lot_attachment_fk',`FOREIGN KEY (lot_id, definition_hash, attachment_mutation_id, attachment_output_ordinal, attachment_quantity) REFERENCES item_lots(lot_id, definition_hash, mutation_id, output_ordinal, original_quantity)`),
  constraintRow('item_mutation_inputs','item_input_lot_event_fk',`FOREIGN KEY (event_id, mutation_id, input_ordinal, event_branch, definition_hash, lot_id) REFERENCES item_events(id, mutation_id, event_ordinal, event_branch, definition_hash, lot_id)`),
  constraintRow('item_mutation_inputs','item_input_lot_fk',`FOREIGN KEY (lot_id, definition_hash) REFERENCES item_lots(lot_id, definition_hash)`),
  constraintRow('item_mutation_inputs','item_input_pk',`PRIMARY KEY (mutation_id, input_ordinal)`),
  constraintRow('item_mutation_inputs','item_input_quantity_ck',`CHECK (input_ordinal >= 0 AND quantity_before >= removed_quantity AND quantity_before > 0 AND quantity_after = (quantity_before - removed_quantity) AND ((transition_kind = ANY (ARRAY['escrow'::text, 'release'::text, 'transfer_unique'::text])) AND removed_quantity = 0 OR (transition_kind = ANY (ARRAY['consume'::text, 'split'::text, 'consume_unique'::text, 'consume_escrow_lot'::text])) AND removed_quantity > 0) AND attachment_output_ordinal >= 0 AND attachment_quantity >= 1 AND attachment_quantity <= 1000000)`),
  constraintRow('item_mutation_inputs','item_input_split_uq',`UNIQUE (mutation_id, input_ordinal, definition_hash, removed_quantity, transition_kind)`),
  constraintRow('item_mutation_inputs','item_input_unique_attachment_fk',`FOREIGN KEY (item_id, definition_hash, attachment_mutation_id, attachment_output_ordinal) REFERENCES item_instances(id, definition_hash, mutation_id, output_ordinal)`),
  constraintRow('item_mutation_inputs','item_input_unique_event_fk',`FOREIGN KEY (event_id, mutation_id, input_ordinal, event_branch, definition_hash, item_id) REFERENCES item_events(id, mutation_id, event_ordinal, event_branch, definition_hash, item_id)`),
  constraintRow('item_mutation_outputs','item_output_branch_ck',`CHECK (event_branch = 'lot'::text AND lot_id IS NOT NULL AND item_id IS NULL AND ((transition_kind = ANY (ARRAY['grant'::text, 'escrow'::text, 'release'::text])) AND source_input_ordinal IS NULL AND source_transition_kind IS NULL OR transition_kind = 'split'::text AND source_input_ordinal IS NOT NULL AND source_input_ordinal >= 0 AND source_input_ordinal < output_ordinal AND source_transition_kind = 'split'::text) OR event_branch = 'unique'::text AND lot_id IS NULL AND item_id IS NOT NULL AND quantity = 1 AND attachment_quantity = 1 AND (transition_kind = ANY (ARRAY['grant'::text, 'escrow'::text, 'release'::text, 'transfer_unique'::text])) AND source_input_ordinal IS NULL AND source_transition_kind IS NULL OR event_branch = 'observation'::text AND lot_id IS NULL AND item_id IS NOT NULL AND quantity = 0 AND attachment_quantity = 1 AND transition_kind = 'migration_origin'::text AND source_input_ordinal IS NULL AND source_transition_kind IS NULL AND attachment_mutation_id = mutation_id AND attachment_output_ordinal = output_ordinal)`),
  constraintRow('item_mutation_outputs','item_output_event_fk',`FOREIGN KEY (event_id, mutation_id, output_ordinal, event_branch, definition_hash) REFERENCES item_events(id, mutation_id, event_ordinal, event_branch, definition_hash)`),
  constraintRow('item_mutation_outputs','item_output_lot_event_fk',`FOREIGN KEY (event_id, mutation_id, output_ordinal, event_branch, definition_hash, lot_id) REFERENCES item_events(id, mutation_id, event_ordinal, event_branch, definition_hash, lot_id)`),
  constraintRow('item_mutation_outputs','item_output_lot_fk',`FOREIGN KEY (lot_id, definition_hash, attachment_mutation_id, attachment_output_ordinal, attachment_quantity) REFERENCES item_lots(lot_id, definition_hash, mutation_id, output_ordinal, original_quantity)`),
  constraintRow('item_mutation_outputs','item_output_pk',`PRIMARY KEY (mutation_id, output_ordinal)`),
  constraintRow('item_mutation_outputs','item_output_quantity_ck',`CHECK (output_ordinal >= 0 AND (event_branch = 'observation'::text AND quantity = 0 OR event_branch <> 'observation'::text AND quantity >= 1 AND quantity <= 1000000) AND attachment_output_ordinal >= 0 AND attachment_quantity >= quantity AND attachment_quantity <= 1000000 AND ((transition_kind <> ALL (ARRAY['grant'::text, 'split'::text])) OR attachment_mutation_id = mutation_id AND attachment_output_ordinal = output_ordinal AND attachment_quantity = quantity))`),
  constraintRow('item_mutation_outputs','item_output_split_fk',`FOREIGN KEY (mutation_id, source_input_ordinal, definition_hash, quantity, source_transition_kind) REFERENCES item_mutation_inputs(mutation_id, input_ordinal, definition_hash, removed_quantity, transition_kind)`),
  constraintRow('item_mutation_outputs','item_output_unique_event_fk',`FOREIGN KEY (event_id, mutation_id, output_ordinal, event_branch, definition_hash, item_id) REFERENCES item_events(id, mutation_id, event_ordinal, event_branch, definition_hash, item_id)`),
  constraintRow('item_mutation_outputs','item_output_unique_fk',`FOREIGN KEY (item_id, definition_hash, attachment_mutation_id, attachment_output_ordinal) REFERENCES item_instances(id, definition_hash, mutation_id, output_ordinal)`),
];
// PostgreSQL 18 promotes NOT NULL metadata into pg_constraint; earlier supported backends do not.
const upgradeNotNullColumns = {
  item_events: ['event_branch'],
  item_lots: ['created_at','definition_hash','logical_item_id','lot_id','mutation_id','original_quantity','output_ordinal','owner_id','owner_scope','provenance_class','provenance_coalescing_class','provenance_digest','remaining_quantity','state','trade_policy_hash','updated_at'],
  item_mutation_inputs: ['attachment_mutation_id','attachment_output_ordinal','attachment_quantity','definition_hash','event_branch','event_id','input_ordinal','mutation_id','quantity_after','quantity_before','removed_quantity','snapshot_json','transition_kind'],
  item_mutation_outputs: ['attachment_mutation_id','attachment_output_ordinal','attachment_quantity','definition_hash','event_branch','event_id','mutation_id','output_ordinal','quantity','snapshot_json','transition_kind'],
};
const catalogIdentity = (row) => `${row.table_name}\0${row.name}`;
const orderedCatalog = (rows) => [...rows].sort((left,right) => catalogIdentity(left) < catalogIdentity(right) ? -1 : catalogIdentity(left) > catalogIdentity(right) ? 1 : 0);
function expectedUpgradeConstraintCatalog(before,serverVersionNum) {
  const replacements = new Map(replacedUpgradeConstraints.map(({ before: prior,after }) => [catalogIdentity(prior),{ prior,after }]));
  for (const { prior } of replacements.values()) assert.deepEqual(before.find((row) => catalogIdentity(row) === catalogIdentity(prior)),prior);
  const additions = [...requiredUpgradeConstraints,...replacedUpgradeConstraints.map(({ after }) => after)];
  if (serverVersionNum >= 180000) for (const [table,columns] of Object.entries(upgradeNotNullColumns)) {
    for (const column of columns) additions.push(constraintRow(table,`${table}_${column}_not_null`,`NOT NULL ${column}`));
  }
  return orderedCatalog([...before.filter((row) => !replacements.has(catalogIdentity(row))),...additions]);
}
function verifyUpgradeConstraintCatalog(before,after,serverVersionNum) {
  assert.deepEqual(orderedCatalog(after),expectedUpgradeConstraintCatalog(before,serverVersionNum));
}
function verifyUpgradeConstraintCausalNegatives(before,after,serverVersionNum) {
  const mutate = (table,name,change) => {
    const candidate = after.map((row) => ({ ...row })), index = candidate.findIndex((row) => row.table_name === table && row.name === name);
    assert(index >= 0,`causal fixture target ${table}.${name} exists`); change(candidate,index); return candidate;
  };
  const rejected = (label,candidate) => assert.throws(() => verifyUpgradeConstraintCatalog(before,candidate,serverVersionNum),
    (error) => error?.code === 'ERR_ASSERTION',label);
  rejected('unrelated removal',mutate('item_events','item_event_key',(rows,index) => rows.splice(index,1)));
  rejected('unrelated alteration',mutate('item_events','item_event_key',(rows,index) => { rows[index].definition += ' altered'; }));
  rejected('replacement removal',mutate('item_events','item_event_kind',(rows,index) => rows.splice(index,1)));
  rejected('replacement alteration',mutate('item_events','item_event_quantities',(rows,index) => { rows[index].definition += ' altered'; }));
  rejected('required addition removal',mutate('item_lots','item_lot_quantity_ck',(rows,index) => rows.splice(index,1)));
  rejected('required addition alteration',mutate('item_lots','item_lot_quantity_ck',(rows,index) => { rows[index].definition += ' altered'; }));
  rejected('unexpected addition',[...after,constraintRow('item_events','unexpected_upgrade_constraint','CHECK (true)')]);
}
async function constraints(pool) {
  console.log('phase2-postgres: beginning direct constraints');
  const target = compileFixture(materialSource()); await storeSealedBundle(pool,target.request);
  await activateStoredBundle(pool,request(target),policy);
  const c = await pool.connect();
  try {
    // A direct invalid INSERT proves rejection independently from drift-detection fixtures.
    await c.query('BEGIN');
    try { await assert.rejects(c.query("INSERT INTO content_bundle_activations(namespace,activation_revision) VALUES ('omerta.pg.invalid-insert',-1)"),
      (error)=>error.code==='23514'&&error.constraint==='p2_pointer_activation_revision_ck'); }
    finally { await c.query('ROLLBACK'); }
    for (const [table,column,value,name,code = '23514'] of [
      ...['A'.repeat(64),'g'.repeat(64)].map((v) => ['content_bundle_artifacts','source_hash',v,'p2_artifact_source_hash_ck']),
      ...['0','9007199254740992'].map((v) => ['content_bundle_artifacts','bundle_version',v,'p2_artifact_bundle_version_ck']),
      ['item_definition_versions','maximum_lot_quantity',0,'p2_definition_quantity_ck'],
      ['item_definition_versions','maximum_lot_quantity',1000001,'p2_definition_quantity_ck'],
      ['item_definition_versions','family',null,'p2_definition_required_ck'],
      ['item_definition_versions','owner_scopes_json','["project","account"]','p2_definition_scopes_ck'],
      ['item_definition_versions','owner_scopes_json','["account","account"]','p2_definition_scopes_ck'],
      ['item_definition_versions','trade_policy_hash',null,'p2_definition_trade_ck'],
      ['content_bundle_item_definitions','ordinal',-1,'p2_membership_ordinal_ck'],
      ['content_activation_events','dependency_lock_hash','0'.repeat(64),'p2_event_artifact_fk','23503'],
      ['item_definition_activations','definition_hash','0'.repeat(64),'p2_selection_membership_fk','23503'],
      ['item_definition_activations','package_id','omerta.foreign','p2_selection_event_fk','23503'],
      ['content_bundle_activations','last_event_id',99999,'p2_pointer_event_fk','23503'],
    ]) {
      await c.query('BEGIN');
      try {
        if (name === 'p2_definition_trade_ck') await c.query("UPDATE item_definition_versions SET definition_kind='concept'");
        await assert.rejects(c.query(`UPDATE ${table} SET ${column}=$1`,[value]),(error) => error.code === code && error.constraint === name,name);
      }
      finally { await c.query('ROLLBACK'); }
    }
    // Concept absent semantics are SQL-null; material economic tuple is mandatory.
    const optional = fixture('concept'); await storeSealedBundle(pool,optional.request);
    const row = (await c.query('SELECT * FROM item_definition_versions WHERE definition_hash=$1',[optional.expectedDefinitions[0].definitionHash])).rows[0];
    for (const column of ['family','tags_json','rarity','stackable','trade_mode','transferable','trade_policy_hash','owner_scopes_json','quality_mode','maximum_lot_quantity','conservation_class','metadata_json']) assert.equal(row[column],null,column);
    assert.equal(typeof row.definition_version,'string');
    await c.query('BEGIN');
    try {
      for(let mask=0;mask<16;mask++) {
        const scopes=['account','character','organization','project'].filter((_scope,index)=>mask&(1<<index));
        await c.query('UPDATE item_definition_versions SET owner_scopes_json=$1',[JSON.stringify(scopes)]);
      }
    }finally{await c.query('ROLLBACK');}
  } finally { c.release(); }
  const large=fixture('bigint',2147483648,[concept('note',2147483648)]);
  const maximum=fixture('bigint',Number.MAX_SAFE_INTEGER,[concept('note',Number.MAX_SAFE_INTEGER)]);
  for(const artifact of [large,maximum]) {
    const stored=await storeSealedBundle(pool,artifact.request);
    assert.equal(stored.bundleVersion,artifact.identity.packageVersion);
    assert.equal((await definitionByHash(pool,artifact.expectedDefinitions[0].definitionHash)).definitionVersion,artifact.identity.packageVersion);
  }
  const selected=await activateStoredBundle(pool,request(maximum),policy);assert.equal(typeof selected.eventId,'string');
  console.log('phase2-postgres: named SQLSTATE/constraint rejection, BIGINT bounds, nullable concept and mandatory material tuples pass');
}
async function concurrent(pool,left,right) {
  const entered = deferred(), release = deferred(),contender=deferred(); let first = true;
  const alias = forwardPool(pool,{ after: async (sql) => {
    if (first && sql.startsWith('SELECT') && sql.includes('FOR UPDATE')) { first = false; entered.resolve(); await release.promise; }
  } });
  const one = left(alias).then((value) => ({ok:true,value}),(error) => ({ok:false,code:error.code}));
  await entered.promise;
  const second=forwardPool(pool,{before:async(sql)=>{
    if(sql.startsWith('INSERT INTO content_bundle_activations')||sql.includes('FOR UPDATE'))contender.resolve();
  }});
  const two = right(second).then((value) => ({ok:true,value}),(error) => ({ok:false,code:error.code}));
  await contender.promise;
  release.resolve();
  return Promise.all([one,two]);
}
async function lotRaces(pool) {
  const { withItemFixture, lotRequest } = await import('./lib/phase2-item-fixtures.js');
  const { withItemTransaction, withLotMutation } = await import('../src/items.js');
  const { grantLot, consumeExactLot, withCompleteItemCandidates } = await import('../src/itemlots.js');
  const { lotOutput, lotLeafPrivateCases } = await import('./phase2-lots.js');
  const { createItemLockTrace } = await import('../src/item-lock-trace.js');
  await withItemFixture(async ({ accountOwner: owner, definition, snapshot }) => {
    const overlap = async (pattern, waitingTable, left, right) => {
      const entered = deferred(), release = deferred(); let paused = false;
      const first = forwardPool(pool, { after: async (sql) => {
        if (!paused && pattern.test(sql)) { paused = true; entered.resolve(); await release.promise; }
      } });
      const second = forwardPool(pool);
      const settle = (promise) => promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, code: error.code }));
      const one = settle(left(first));
      await Promise.race([entered.promise, one.then(() => { throw Error('first lot contender did not reach its lock barrier'); })]);
      const two = settle(right(second));
      let waiting = false;
      try {
        const deadline = Date.now() + 4000;
        while (Date.now() < deadline) {
          const result = await pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
            AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE $1`, [`%${waitingTable}%`]);
          if (result.rows.length) { waiting = true; break; }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      } finally { release.resolve(); }
      const outcomes = await Promise.all([one, two]);
      assert.equal(waiting, true, 'second native connection actually waits on the held SQL lock');
      assert.equal([...first.statements, ...second.statements].filter((sql) =>
        /^DELETE FROM item_(lots|events|mutation_inputs|mutation_outputs|mutation_guards)/.test(sql)).length, 0,
      'native race rollback never emits compensation SQL');
      return outcomes;
    };
    const grantRequest = lotRequest(owner, definition);
    const grant = (target) => withItemTransaction(target, (q) => withLotMutation(q, grantRequest,
      (token) => grantLot(q, token, definition, lotOutput(owner, definition))));
    const grants = await overlap(/^INSERT INTO item_mutation_guards /, 'item_mutation_guards', grant, grant);
    assert(grants.every((outcome) => outcome.ok)); assert.deepEqual(grants[0].value, grants[1].value);
    assert.equal((await pool.query('SELECT * FROM item_lots')).rowCount, 1, 'same scoped key grants one physical lot');
    const lotId = grants[0].value.lotId;
    const consume = (target, request, quantity) => withItemTransaction(target, (q) => withLotMutation(q, request,
      (token) => withCompleteItemCandidates(q, token, createItemLockTrace(), { root: { owner, authority: request.request.authority },
        requirements: [{ kind: 'lot_exact', lotId, quantity }] }, () => consumeExactLot(q, token, lotId, quantity))));
    const first = lotRequest(owner, definition), second = lotRequest(owner, definition);
    const consumers = await overlap(/FROM item_lots WHERE lot_id=\$1 FOR UPDATE/, 'item_lots',
      (target) => consume(target, first, 7), (target) => consume(target, second, 7));
    assert.equal(consumers[0].ok, true); assert.equal(consumers[1].code, 'contention');
    const afterRace = await snapshot();
    await rejects(consume(pool, second, 7), 'materials');
    assert.deepEqual(await snapshot(), afterRace, 'losing same-key retry recomputes shortage without a committed guard');
    assert.equal((await pool.query('SELECT remaining_quantity FROM item_lots WHERE lot_id=$1', [lotId])).rows[0].remaining_quantity, 3);
    const { materialSource, compileFixture } = await import('./lib/phase2-definition-fixtures.js');
    const uniqueSource = materialSource({ kind: 'item', stackable: false, maximumLotQuantity: 1, definitionVersion: 2 });
    uniqueSource.version = 2;
    const uniqueArtifact = compileFixture(uniqueSource); await storeSealedBundle(pool, uniqueArtifact.request);
    const uniqueDefinition = await definitionByHash(pool, uniqueArtifact.expectedDefinitions[0].definitionHash);
    const lotLeaves = await import('../src/itemlots.js');
    for (const [name, invoke] of lotLeafPrivateCases(lotLeaves, owner, definition, uniqueDefinition)) {
      const before = await snapshot(), entered = deferred(), release = deferred(); let otherClient, otherToken;
      const cleanup = Object.assign(new Error('Close deliberately held private root.'), { code: 'fixture_close' });
      const held = withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, definition), async (token) => {
        otherClient = q; otherToken = token; entered.resolve(); await release.promise; throw cleanup;
      }));
      const heldSettled = held.then(() => null, (error) => error);
      try {
        await Promise.race([entered.promise, heldSettled.then(() => { throw Error('private root barrier not reached'); })]);
        await assert.rejects(() => withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, definition), async () => {
          assert.notEqual(q, otherClient, 'two distinct native item clients remain active');
          return invoke(q, otherToken);
        })), { code: 'item_transaction_required' }, `${name}/other-active-client-token`);
      } finally { release.resolve(); }
      assert.equal(await heldSettled, cleanup);
      assert.deepEqual(await snapshot(), before, `${name}/cross-client rolls back both roots without effects`);
    }
    console.log('phase2-postgres: five lot leaves reject another simultaneously active native client token with unchanged snapshots PASS');
    const invariant = await runLedgerInvariants(pool, { alert: false });
    assert.equal(invariant.ok, true, JSON.stringify(invariant.checks.filter((check) => !check.ok)));
    console.log('phase2-postgres: lot same-key grant/replay and competing exact consumption: actual SQL lock wait, one winner, contention then materials, zero compensation PASS');
  }, pool);
}
async function races(pool) {
  const cases = [
    ['same artifact',fixture('same'),null,'replay'],
    ['same version different bytes',fixture('collision'),fixture('collision',1,[concept('different')]),'content_bundle_version_conflict'],
    ['shared intrinsic',fixture('reuse'),fixture('reuse',2),'both'],
    ['v1 then v2',fixture('ascending'),fixture('ascending',2,[concept('note',2)]),'both'],
    ['v2 then v1',fixture('descending',2,[concept('note',2)]),fixture('descending'),'item_definition_conflict'],
  ];
  for (const [label,a,b,expected] of cases) {
    const outcomes = await concurrent(pool,(q) => storeSealedBundle(q,a.request),(q) => storeSealedBundle(q,(b ?? a).request));
    assert.equal(outcomes[0].ok,true,label);
    if (expected === 'both' || expected === 'replay') assert.equal(outcomes[1].ok,true,label);
    else assert.equal(outcomes[1].code,expected,label);
    if (expected === 'replay') assert.equal(outcomes[1].value.replayed,true);
    const counts = await namespaceCounts(pool,a.identity.packageId);
    assert.equal(counts.artifacts,expected === 'both' ? 2 : 1,label); assert.equal(counts.pointers,1,label);
    assert.equal(counts.members,counts.artifacts,label);
    assert.equal(counts.definitions,label === 'v1 then v2' ? 2 : 1,label);
    console.log('phase2-postgres: race '+label+' '+JSON.stringify({disposition:outcomes.map((v) => v.ok ? (v.value.replayed ? 'replay':'success') : v.code),counts}));
  }
  const old = fixture('existing'), newer = fixture('existing',3,[concept('note',2)]), reuse = fixture('existing',2);
  await storeSealedBundle(pool,old.request);
  const existing = await concurrent(pool,(q) => storeSealedBundle(q,newer.request),(q) => storeSealedBundle(q,reuse.request));
  assert(existing.every((v) => v.ok)); assert.equal((await namespaceCounts(pool,old.identity.packageId)).definitions,2);
  for (const different of [false,true]) {
    const a = fixture(different ? 'selectdifferent':'selectsame'),
      b = fixture(different ? 'selectdifferent':'selectsame',2,[concept('note',2)]);
    await storeSealedBundle(pool,a.request); await storeSealedBundle(pool,b.request);
    const outcomes = await concurrent(pool,(q) => activateStoredBundle(q,request(a),policy),(q) => activateStoredBundle(q,request(different ? b:a),policy));
    assert(outcomes[0].ok);
    if (different) assert.equal(outcomes[1].code,'content_activation_conflict'); else assert.equal(outcomes[1].value.replayed,true);
    assert.equal((await namespaceCounts(pool,a.identity.packageId)).events,1);
    const oldProjection = await definitionByHash(pool,a.expectedDefinitions[0].definitionHash);
    assert.notEqual(a.expectedDefinitions[0].definitionHash,b.expectedDefinitions[0].definitionHash);
    await activateStoredBundle(pool,request(b,1,a),policy);
    const activeB = await activeDefinition(pool,b.expectedDefinitions[0].logicalItemId);
    assert.equal(activeB.definitionHash,b.expectedDefinitions[0].definitionHash);
    assert.equal(activeB.definitionVersion,2); assert.equal(activeB.activationRevision,2);
    assert.equal(activeB.bundleHash,b.identity.bundleHash);
    assert.deepEqual(await definitionByHash(pool,a.expectedDefinitions[0].definitionHash),oldProjection,
      'complete safe old definition remains readable while a distinct newer intrinsic is selected');
    await activateStoredBundle(pool,request(a,2,b),policy);
    await rejects(activateStoredBundle(pool,request(a),policy),'content_activation_conflict');
    assert.equal((await namespaceCounts(pool,a.identity.packageId)).events,3);
    assert.deepEqual(await definitionByHash(pool,a.expectedDefinitions[0].definitionHash),oldProjection);
    const activeA = await activeDefinition(pool,a.expectedDefinitions[0].logicalItemId);
    assert.equal(activeA.definitionHash,oldProjection.definitionHash); assert.equal(activeA.activationRevision,3);
    console.log(`phase2-postgres: selection ${different ? 'different target winner/conflict':'same target one event/replay'}, distinct v2 active at revision 2, complete retired-v1 projection unchanged during B and after CAS rollback, ABA conflict pass`);
  }
  // A paused namespace must not hold a JavaScript global gate on PostgreSQL.
  const a = fixture('independenta'),b = fixture('independentb');
  await storeSealedBundle(pool,a.request); await storeSealedBundle(pool,b.request);
  const entered = deferred(),release = deferred();
  const alias = forwardPool(pool,{ after: async (sql) => { if (sql.includes('FOR UPDATE')) { entered.resolve(); await release.promise; } } });
  const one = activateStoredBundle(alias,request(a),policy); await entered.promise;
  try { assert.equal((await activateStoredBundle(pool,request(b),policy)).activationRevision,1); }
  finally { release.resolve(); }
  await one;
  console.log('phase2-postgres: old existing intrinsic reuse/new registration and independent namespaces pass');
}
async function namespaceCounts(pool,namespace) {
  const result = {};
  for (const [key,sql] of Object.entries({
    artifacts:'SELECT COUNT(*) AS n FROM content_bundle_artifacts WHERE namespace=$1',
    definitions:'SELECT COUNT(*) AS n FROM item_definition_versions WHERE package_id=$1',
    members:'SELECT COUNT(*) AS n FROM content_bundle_item_definitions m JOIN content_bundle_artifacts a ON a.bundle_hash=m.bundle_hash WHERE a.namespace=$1',
    pointers:'SELECT COUNT(*) AS n FROM content_bundle_activations WHERE namespace=$1',
    events:'SELECT COUNT(*) AS n FROM content_activation_events WHERE namespace=$1',
  })) result[key] = Number((await pool.query(sql,[namespace])).rows[0].n);
  return result;
}
async function rollbackAndRecovery(pool) {
  for (const kind of ['store','activation']) {
    const original=fixture(`rollback${kind}`,1,[concept('kept'),concept('removed')]);
    const target = kind==='store'?original:fixture(`rollback${kind}`,2,[concept('kept'),concept('added')]);
    if (kind === 'activation') {
      await storeSealedBundle(pool,original.request);await storeSealedBundle(pool,target.request);
      await activateStoredBundle(pool,request(original),policy);
    }
    const action = (q) => kind === 'store' ? storeSealedBundle(q,target.request) : activateStoredBundle(q,request(target,1,original),policy);
    let writeCount = 0;
    // Discover write count by rolling back after the last write at the COMMIT boundary.
    const trace = forwardPool(pool,{before: async (sql) => { if (sql === 'COMMIT') { const e = Error(); e.code='23514'; throw e; } },
      after: async (sql) => { if (/^(INSERT|UPDATE|DELETE) /.test(sql)) writeCount++; } });
    const baseline = await snapshotPhase2(pool);
    await rejects(action(trace),'content_registry_corrupt'); assert.deepEqual(await snapshotPhase2(pool),baseline);
    for (let cut=1;cut<=writeCount;cut++) {
      let writes=0;
      const failing=forwardPool(pool,{after: async(sql) => { if (/^(INSERT|UPDATE|DELETE) /.test(sql) && ++writes===cut) throw Error('injected client failure'); } });
      await rejects(action(failing),'internal');
      assert.deepEqual(await snapshotPhase2(pool),baseline,`${kind} write ${cut}`);
      assert.equal(failing.statements.slice(failing.statements.indexOf('ROLLBACK')+1).filter((sql)=>/^(INSERT|UPDATE|DELETE) /.test(sql)).length,0);
    }
    const server = forwardPool(pool,{after: async(sql,_values,_result,q) => { if (sql.startsWith(kind === 'store' ? 'INSERT INTO content_bundle_item_definitions':'UPDATE content_bundle_activations')) {
      // A server error aborts the SAME owned transaction, not an unrelated pool query.
      await q.query('SELECT 1/0');
    } } });
    await rejects(action(server),'internal'); assert.deepEqual(await snapshotPhase2(pool),baseline);
    const lost=forwardPool(pool,{after: async(sql) => {if(sql==='COMMIT')throw Error('lost acknowledgement');} });
    await rejects(action(lost),'content_commit_unknown');
    assert.equal((await action(pool)).replayed,true);
    console.log(`phase2-postgres: ${kind} all ${writeCount} writes rollback exactly, zero compensation, lost COMMIT reconciles by exact replay`);
  }
}
async function serverFailures(pool) {
  for (const [mode,want] of [['statement','contention'],['unknown-unique','content_registry_corrupt']]) {
    const target=fixture(`failure-${mode}`),before=await snapshotPhase2(pool);
    let state,constraint; const trace=forwardPool(pool,{after:async(sql,_values,_result,q)=>{
      if(sql.startsWith('INSERT INTO content_bundle_item_definitions')) {
        try {
          if(mode==='statement') { await q.query("SET LOCAL statement_timeout='50ms'");await q.query('SELECT pg_sleep(1)'); }
          else await q.query('INSERT INTO content_bundle_activations(namespace) VALUES ($1)',[target.identity.packageId]);
        } catch(error) { state=error.code;constraint=error.constraint;throw error; }
      }
    }});
    await rejects(storeSealedBundle(trace,target.request),want);
    assert.equal(state,mode==='statement'?'57014':'23505');
    if(mode==='unknown-unique')assert.equal(constraint,'p2_pointer_pk');
    assert.deepEqual(await snapshotPhase2(pool),before);
    assert.equal(trace.statements.at(-1),'ROLLBACK');
    console.log(`phase2-postgres: actual ${state} -> ${want}, rollback/reuse and no partial rows pass`);
  }
  const target=fixture('locktimeout');await storeSealedBundle(pool,target.request);
  const before=await snapshotPhase2(pool),holder=await pool.connect();
  await holder.query('BEGIN');await holder.query('SELECT * FROM content_bundle_activations WHERE namespace=$1 FOR UPDATE',[target.identity.packageId]);
  let lockState;
  const locked=forwardPool(pool,{after:async(sql,_values,_result,q)=>{if(sql==='BEGIN')await q.query("SET LOCAL lock_timeout='50ms'");}});
  const instrument={...locked,connect:async()=>{
    const c=await locked.connect();return {query:async(sql,values)=>{try{return await c.query(sql,values);}catch(error){lockState=error.code;throw error;}},release:(...args)=>c.release(...args)};
  }};
  try{await rejects(activateStoredBundle(instrument,request(target),policy),'contention');assert.equal(lockState,'55P03');}
  finally{await holder.query('ROLLBACK');holder.release();}
  assert.deepEqual(await snapshotPhase2(pool),before);assert.equal(locked.statements.at(-1),'ROLLBACK');
  console.log('phase2-postgres: held namespace actual 55P03 -> contention after rollback, reusable connection');

  const serial=fixture('serialization');await storeSealedBundle(pool,serial.request);
  const baseline=await snapshotPhase2(pool),observed=deferred(),changed=deferred();
  const concurrentWriter=observed.promise.then(async()=>{
    await pool.query('UPDATE content_bundle_activations SET activation_revision=activation_revision WHERE namespace=$1',[serial.identity.packageId]);changed.resolve();
  });
  let serialState;
  const serialPool={query:pool.query.bind(pool),connect:async()=>{
    const c=await pool.connect();return {release:(...args)=>c.release(...args),query:async(sql,values)=>{
      try {
        if(sql==='BEGIN') {
          const result=await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
          await c.query('SELECT * FROM content_bundle_activations WHERE namespace=$1',[serial.identity.packageId]);
          observed.resolve();await changed.promise;return result;
        }
        return await c.query(sql,values);
      }catch(error){serialState=error.code;throw error;}
    }};
  }};
  await rejects(activateStoredBundle(serialPool,request(serial),policy),'contention');await concurrentWriter;
  assert.equal(serialState,'40001');assert.deepEqual(await snapshotPhase2(pool),baseline);
  console.log('phase2-postgres: actual snapshot update serialization 40001 -> contention, rolled back/reusable');

  const da=fixture('deadlocka'),db=fixture('deadlockb');
  await storeSealedBundle(pool,da.request);await storeSealedBundle(pool,db.request);
  const barrier=deferred();let arrivals=0;
  const deadlockCodes=[];
  const wrap=(other)=>forwardPool(pool,{after:async(sql,_values,_result,q)=>{
    if(sql.includes('FOR UPDATE')) {
      if(++arrivals===2)barrier.resolve();await barrier.promise;
      try { await q.query('SELECT * FROM content_bundle_activations WHERE namespace=$1 FOR UPDATE',[other.identity.packageId]); }
      catch(error){deadlockCodes.push(error.code);throw error;}
    }
  }});
  const outcomes=await Promise.allSettled([activateStoredBundle(wrap(db),request(da),policy),activateStoredBundle(wrap(da),request(db),policy)]);
  assert.equal(outcomes.filter((v)=>v.status==='fulfilled').length,1);
  assert.equal(outcomes.find((v)=>v.status==='rejected').reason.code,'contention');
  assert.deepEqual(deadlockCodes,['40P01']);
  const counts=await Promise.all([namespaceCounts(pool,da.identity.packageId),namespaceCounts(pool,db.identity.packageId)]);
  assert.deepEqual(counts.map((v)=>v.events).sort(),[0,1]);
  assert.equal((await runLedgerInvariants(pool,{alert:false,activationPolicy:policy})).ok,true);
  console.log('phase2-postgres: deterministic two-lock actual 40P01 -> one commit/one contention; no partial event/selection/pointer, reusable clients');
}
async function snapshotEvidence(pool) {
  const a=fixture('mvcc'),b=fixture('mvcc',2,[]);
  await storeSealedBundle(pool,a.request);await storeSealedBundle(pool,b.request);await activateStoredBundle(pool,request(a),policy);
  let first=true; const entered=deferred();
  const writer=entered.promise.then(()=>activateStoredBundle(pool,request(b,1,a),policy));
  const alias=forwardPool(pool,{after:async(sql)=>{
    if(first&&sql.startsWith('SELECT * FROM content_bundle_artifacts ORDER')) {
      first=false; entered.resolve(); await writer;
    }
  }});
  assert.equal((await runLedgerInvariants(alias,{alert:false,activationPolicy:policy})).ok,true);
  assert.equal((await runLedgerInvariants(pool,{alert:false,activationPolicy:policy})).ok,true);
  const raw=await pool.connect();let released=false; const statements=[];
  const refused={query:async()=>{throw Error('pool fallback forbidden');},connect:async()=>({
    query:async(sql,values)=>{statements.push(sql);if(sql.startsWith('BEGIN ISOLATION'))throw Object.assign(Error(),{code:'snapshot_refused'});return raw.query(sql,values);},
    release:()=>{released=true;raw.release();},
  })};
  await rejects(runLedgerInvariants(refused,{alert:false,activationPolicy:policy}),'snapshot_refused');
  assert.deepEqual(statements,['BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY','ROLLBACK']);assert(released);
  let activeClients=0,alerted=false;const original=console.error;
  const alertAlias={query:async(sql,values)=>{
    if(sql.startsWith('INSERT INTO telemetry')){assert.equal(activeClients,0,'alert after snapshot client release');alerted=true;}
    return pool.query(sql,values);
  },connect:async()=>{
    const client=await pool.connect();activeClients++;
    return {query:client.query.bind(client),release:(...args)=>{activeClients--;client.release(...args);}};
  }};
  try {console.error=()=>{};assert.equal((await runLedgerInvariants(alertAlias,{activationPolicy:null})).ok,false);assert(alerted);}
  finally {console.error=original;}
  console.log('phase2-postgres: repeatable-read MVCC writer proceeds between reads; next snapshot coherent; refused BEGIN never collects/falls back and releases client');
}

async function queryPlans(pool) {
  const target=fixture('plantemplate');await storeSealedBundle(pool,target.request);await activateStoredBundle(pool,request(target),policy);
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    const indexes=(await c.query(`SELECT t.relname::text AS table_name,i.relname::text AS name,
      ARRAY(SELECT a.attname::text FROM unnest(x.indkey) WITH ORDINALITY k(num,ord)
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num ORDER BY k.ord) AS columns
      FROM pg_index x JOIN pg_class t ON t.oid=x.indrelid JOIN pg_class i ON i.oid=x.indexrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() AND t.relname IN ($1,$2,$3,$4,$5,$6)`,TABLES)).rows;
    const ns="'omerta.pg.plan'||g",hash="lpad(to_hex(g),64,'0')",dh="lpad(to_hex(g+1000000),64,'0')",id=`(${ns})||'::note'`;
    // Planner-only synthetic rows clone valid scalar/tuple shapes. They deliberately are not
    // signed semantic artifacts; no verifier claim is made about them and all are rolled back.
    const overrides={
      content_bundle_artifacts:{bundle_hash:hash,namespace:ns},
      item_definition_versions:{definition_hash:dh,logical_item_id:id,package_id:ns},
      content_bundle_item_definitions:{bundle_hash:hash,logical_item_id:id,definition_hash:dh},
      content_activation_events:{id:'g+100000',namespace:ns,bundle_hash:hash},
      content_bundle_activations:{namespace:ns,bundle_hash:hash,last_event_id:'g+100000'},
      item_definition_activations:{logical_item_id:id,definition_hash:dh,package_id:ns,bundle_hash:hash,event_id:'g+100000'},
    };
    const where={content_bundle_artifacts:'namespace',item_definition_versions:'package_id',content_bundle_item_definitions:'bundle_hash',
      content_activation_events:'namespace',content_bundle_activations:'namespace',item_definition_activations:'package_id'};
    for(const table of TABLES) {
      const row=(await c.query(`SELECT * FROM ${table} WHERE ${where[table]}=$1`,[table==='content_bundle_item_definitions'?target.identity.bundleHash:target.identity.packageId])).rows[0];
      const values=[],columns=Object.keys(row);
      const expressions=columns.map((column)=>{if(overrides[table][column])return overrides[table][column];values.push(row[column]);return `$${values.length}`;});
      await c.query(`INSERT INTO ${table} (${columns.join(',')}) SELECT ${expressions.join(',')} FROM generate_series(1,4096) AS g`,values);
      await c.query(`ANALYZE ${table}`);
    }
    const observed=forwardPool(pool);await activeDefinition(observed,target.expectedDefinitions[0].logicalItemId);
    const exactJoin=observed.statements.find((sql)=>sql.startsWith('SELECT s.*'));
    const qns='omerta.pg.plan2048',qid=qns+'::note',qh=(2048).toString(16).padStart(64,'0');
    const queries=[
      ['bundle hash','SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1',[qh],'p2_artifact_pk',['bundle_hash']],
      ['namespace/version','SELECT * FROM content_bundle_artifacts WHERE namespace=$1 AND bundle_version=$2',[qns,1],'p2_artifact_namespace_version_uq',['namespace','bundle_version']],
      ['intrinsic maximum','SELECT MAX(definition_version) FROM item_definition_versions WHERE logical_item_id=$1',[qid],'p2_definition_id_version_uq',['logical_item_id','definition_version']],
      ['membership','SELECT * FROM content_bundle_item_definitions WHERE bundle_hash=$1 ORDER BY ordinal',[qh],'p2_membership_ordinal_uq',['bundle_hash','ordinal']],
      ['event revision','SELECT * FROM content_activation_events WHERE namespace=$1 AND activation_revision=$2',[qns,1],'p2_event_revision_uq',['namespace','activation_revision']],
      ['selection package','SELECT * FROM item_definition_activations WHERE package_id=$1 ORDER BY logical_item_id',[qns],'p2_selection_package_idx',['package_id','logical_item_id']],
      ['selected exact join',exactJoin,[qid],'p2_selection_pk',['logical_item_id']],
      ['current namespace integrity','SELECT * FROM item_definition_activations WHERE package_id=$1 OR logical_item_id LIKE $2 ORDER BY logical_item_id',[qns,qns+'::%'],'p2_selection_package_idx',['package_id','logical_item_id']],
    ];
    for(const [label,sql,values,index,leading] of queries){
      assert.deepEqual(indexes.find((row)=>row.name===index)?.columns.slice(0,leading.length),leading,label);
      const result=(await c.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+sql,values)).rows[0]['QUERY PLAN'][0];
      console.log(`phase2-postgres: plan ${label} ${JSON.stringify(result)}`);
    }
    console.log('phase2-postgres: plans measured with 4096 extra scalar/tuple-valid rows per registry table, leading index columns verified; synthetic rows rolled back');
  } finally{await c.query('ROLLBACK');c.release();}
}

try { const url=endpoint(); if(process.env.P2_TEST_CHILD) await child(url); else await parent(url); }
catch(error) { console.error('phase2-postgres: FAIL '+safeError(error)); process.exitCode=1; }
