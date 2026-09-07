import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newDb, DataType } from 'pg-mem';
import { registerPgMemCompatibility } from '../../src/db.js';
import { discoverContentPackages } from '../../src/content/discovery.js';
import { compileContentCorpus, sealedBundleBytes } from '../../src/content/corpus.js';

export const TABLES = ['content_bundle_artifacts', 'item_definition_versions',
  'content_bundle_item_definitions', 'content_activation_events',
  'content_bundle_activations', 'item_definition_activations'];
export const schema = fs.readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');
export function baseLibrary(overrides = {}) {
  return { packageId: 'omerta.phase2.registry', version: 1, kind: 'library',
    profile: 'phase2_economy', definitions: [], nodes: [], edges: [], exports: [],
    dependencies: [], imports: [], ...overrides };
}
export function compileFixture(source = baseLibrary(), options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-registry-test-'));
  try {
    fs.mkdirSync(path.join(root, 'package'));
    fs.writeFileSync(path.join(root, 'package', 'pack.json'), JSON.stringify(source));
    const packages = discoverContentPackages({ rootDir: root,
      ...(options.fixture ? { fixtureRoots: [root] } : {}), ...options.discovery });
    const bundle = compileContentCorpus({ packages, compilerVersion: 'phase2a.1',
      dependencyCatalog: { bundles: (options.dependencies ?? []).map(({ bundle }) => ({
        bundle, authorityProfile: bundle.package.authorityProfile,
        expectedHashes: { bundleHash: bundle.hashes.bundleHash,
          dependencyLockHash: bundle.hashes.dependencyLockHash },
      })) } }).bundles[0];
    const bytes = sealedBundleBytes(bundle, { authorityProfile: bundle.package.authorityProfile });
    const identity = { packageId: bundle.package.id, packageVersion: bundle.package.version,
      authorityProfile: bundle.package.authorityProfile, bundleHash: bundle.hashes.bundleHash,
      dependencyLockHash: bundle.hashes.dependencyLockHash };
    const expectedDefinitions = source.definitions.map(({ id, definitionVersion, ...semantic }) => {
      const definitionHash = bundle.hashes.definitionHashById[`${source.packageId}::${id}`];
      return { logicalItemId: `${source.packageId}::${id}`, definitionVersion, definitionHash,
        packageId: source.packageId, ...structuredClone(semantic),
        tradePolicyHash: Object.hasOwn(semantic, 'tradePolicy') ? definitionHash : null };
    });
    return { bundle, bytes, identity, expectedDefinitions, request: { canonicalBytes: bytes,
      expectedIdentity: identity, operatorId: 'registry-test' } };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
export function materialSource(overrides = {}) {
  const source = JSON.parse(fs.readFileSync(new URL('../fixtures/phase2/compiler/valid-core/pack.json', import.meta.url), 'utf8'));
  source.definitions[0] = { ...source.definitions[0], kind: 'material', family: 'metal', tags: [],
    rarity: 'common', stackable: true, tradePolicy: { mode: 'ordinary', transferable: true },
    ownerScopes: ['account'], qualityMode: 'none', maximumLotQuantity: 1000000,
    conservationClass: 'renewable', ...overrides };
  return source;
}
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export function activationRequest(target, revision = 0, previous = null, operatorId = 'activation operator') {
  return { namespace: target.identity.packageId, bundleHash: target.identity.bundleHash,
    expectedRevision: revision, expectedPreviousBundleHash: previous?.identity?.bundleHash ?? previous, operatorId };
}
export function forwardPool(pool, { before = async () => {}, after = async () => {}, acquire = async () => {} } = {}) {
  const statements = [];
  async function query(q, sql, values) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    statements.push(normalized);
    await before(normalized, values, q);
    const result = await q.query(sql, values);
    await after(normalized, values, result, q);
    return result;
  }
  return { statements, query: (sql, values) => query(pool, sql, values),
    async connect() {
      await acquire();
      const client = await pool.connect();
      return { query: (sql, values) => query(client, sql, values), release: (...args) => client.release(...args) };
    } };
}
export async function database({ schemaText = schema } = {}) {
  const mem = newDb({ noAstCoverageCheck: true });
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(schemaText);
  return { pool, mem };
}
export async function snapshotPhase2(pool) {
  const { withPhase2Read } = await import('../../src/content/phase2-transactions.js');
  return withPhase2Read(pool, async (q) => {
    const result = {};
    const primaryKeys = { content_bundle_artifacts: ['bundle_hash'], item_definition_versions: ['definition_hash'],
      content_bundle_item_definitions: ['bundle_hash', 'logical_item_id'], content_activation_events: ['id'],
      content_bundle_activations: ['namespace'], item_definition_activations: ['logical_item_id'] };
    for (const table of TABLES) {
      const rows = (await q.query(`SELECT * FROM ${table}`)).rows;
      result[table] = rows.map((row) => JSON.parse(JSON.stringify(row))).sort((a, b) =>
        JSON.stringify(primaryKeys[table].map((key) => a[key])).localeCompare(JSON.stringify(primaryKeys[table].map((key) => b[key]))));
    }
    return result;
  });
}

export async function snapshotLegacyCompatibility(pool) {
  const tables = ['content_bundles','content_activations','content_instances','content_instance_members',
    'content_instance_nodes','content_instance_facts','content_instance_effects','content_story_flags',
    'content_inventory_lots','content_source_epochs','content_source_claims','content_supply_receipts',
    'content_work_order_runs','content_skill_progress','content_tool_states','content_tool_events',
    'content_exchange_listings','content_exchange_events','item_stacks','item_instances','operation_escrow',
    'item_mutation_guards','item_events','characters','account_persistent','transactions'];
  const result = {};
  for (const table of tables) result[table] = (await pool.query(`SELECT * FROM ${table}`)).rows
    .map((row) => JSON.parse(JSON.stringify(row))).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return result;
}

// Public legacy/Phase 1 boundaries create the state; SQL is limited to identity, clock and
// coherent starting-ledger setup. No root suite is imported for its top-level side effects.
export async function seedLegacyCompatibility(pool) {
  const { compileContentPack } = await import('../../src/content/compiler.js');
  const { activateContentBundle, createContentInstance } = await import('../../src/content/runtime.js');
  const { withCharacter } = await import('../../src/game.js');
  const { collectContentSource,startContentWorkOrder,finishContentWorkOrder,craftContentRecipe } = await import('../../src/content/crafting.js');
  const { createContentExchangeListing } = await import('../../src/content/exchange.js');
  const { withItemTransaction,grantStack,createItem,escrowItem } = await import('../../src/items.js');
  const accountId=randomUUID(),characterId=randomUUID(),crewId=randomUUID();
  await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ($1,$2,$3)',[accountId,'guest',accountId]);
  await pool.query('INSERT INTO account_persistent(account_id,agent_flag) VALUES ($1,true)',[accountId]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES ($1,$2,'Compatibility',1,'foundry')",[characterId,accountId]);
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES ($1,'Compatibility Crew',$2)",[crewId,accountId]);
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES ($1,$2,'Compatibility')",[crewId,accountId]);
  const as=(fn)=>withCharacter(pool,accountId,fn);
  const source=JSON.parse(fs.readFileSync(new URL('../fixtures/content/runtime-minimal.json',import.meta.url),'utf8'));
  const r1=compileContentPack(source),r2=compileContentPack({...structuredClone(source),version:2});
  const activate=(bundle)=>activateContentBundle(pool,{bundle,expectedHash:bundle.contentHash,operatorId:'compatibility'});
  await activate(r1);
  await as((ch,q,h)=>createContentInstance(ch,r1.namespace,{scopeKind:'crew',roleId:'investigator',consent:true},q,h));
  await activate(r2);
  const bellini=compileContentPack(JSON.parse(fs.readFileSync(new URL('../../content/packs/bellini-lockbox-v4/pack.json',import.meta.url),'utf8')));
  await activate(bellini);const ns=bellini.namespace,opts={expectedContentHash:bellini.contentHash};
  for(const id of ['foundry-plate-salvage','archive-binding-salvage']) await as((ch,q,h)=>collectContentSource(ch,ns,id,opts,q,h));
  const started=await as((ch,q,h)=>startContentWorkOrder(ch,ns,'true-ledger-plate',opts,q,h));
  await pool.query("UPDATE content_work_order_runs SET ready_at=now()-interval '1 second' WHERE id=$1",[started.run.id]);
  await as((ch,q,h)=>finishContentWorkOrder(ch,ns,'true-ledger-plate',opts,q,h));
  await as((ch,q,h)=>craftContentRecipe(ch,ns,'assemble-restoration-press',opts,q,h));
  await as((ch,q,h)=>startContentWorkOrder(ch,ns,'stitch-fireproof-binding',opts,q,h));
  await as((ch,q,h)=>createContentExchangeListing(ch,ns,{...opts,offeredItemId:'ledger-plate',offeredQuantity:1,
    requestedItemId:'charred-binding',requestedQuantity:1},q,h));
  const owner={scope:'character',id:characterId};
  await withItemTransaction(pool,(q)=>grantStack(q,owner,'mat:scrap_steel',2,'standard','compatibility','compatibility-grant'));
  const item=await withItemTransaction(pool,(q)=>createItem(q,owner,'item:precision_lock_tool','crafted','compatibility-create'));
  await withItemTransaction(pool,(q)=>escrowItem(q,owner,'compatibility-operation',item.id,'compatibility','compatibility-escrow'));
  await pool.query('UPDATE characters SET cash=cash+25 WHERE id=$1',[characterId]);
  await pool.query("INSERT INTO transactions(id,character_id,account_id,currency,amount,reason) VALUES ($1,$2,$3,'cash',25,'crime:compatibility')",[randomUUID(),characterId,accountId]);
  const state=await snapshotLegacyCompatibility(pool);
  for(const table of ['content_instances','content_inventory_lots','content_skill_progress','content_tool_states',
    'content_tool_events','content_exchange_listings','item_stacks','item_instances','operation_escrow','item_events','item_mutation_guards','transactions']) assert(state[table].length>0,table);
  assert.deepEqual(state.content_work_order_runs.map((row)=>row.status).sort(),['active','collected']);
  return {r1,r2,activate};
}

// Exercise the public invariant owner, including its real SQL and cleanup, while injecting
// only a boundary failure. A sole definition isolates the standalone intrinsic read (second
// exact intrinsic SELECT) from the earlier membership-verification read.
export async function probeInvariantReadFailure(pool, target, { boundary, code, expected, server = false, real = false }) {
  const { runLedgerInvariants } = await import('../../src/invariants.js');
  const { createActivationPolicy } = await import('../../src/content/activation-policy.js');
  const activationPolicy = createActivationPolicy({ environment: 'failure-probe', allowedProfiles: ['phase2_economy'] });
  const before = await snapshotPhase2(pool);
  const telemetry = (await pool.query("SELECT COUNT(*) AS n FROM telemetry WHERE event='invariant_drift'")).rows[0].n;
  const trace = []; let injected = false, intrinsicReads = 0, releases = 0, alerts = 0, serverCode;
  const originalError = console.error;
  async function query(q, sql, values) {
    const normalized = sql.replace(/\s+/g, ' ').trim(); trace.push(normalized);
    const artifact = normalized === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1'
      && values[0] === target.identity.bundleHash;
    const membership = normalized === 'SELECT * FROM content_bundle_item_definitions WHERE bundle_hash=$1 ORDER BY ordinal'
      && values[0] === target.identity.bundleHash;
    const intrinsic = normalized === 'SELECT * FROM item_definition_versions WHERE definition_hash=$1'
      && values[0] === target.expectedDefinitions[0].definitionHash && ++intrinsicReads === 2;
    if (!injected && ({ artifact, membership, intrinsic })[boundary]) {
      injected = true;
      if (server) {
        try { await q.query('SELECT 1/0'); } catch (error) { serverCode = error.code; throw error; }
        assert.fail('server division-by-zero must fail');
      }
      const error = Error('private operational probe marker');
      if (code !== null) error.code = code;
      throw error;
    }
    return q.query(sql, values);
  }
  const alias = { query: (sql, values) => query(pool, sql, values), connect: async () => {
    const client = await pool.connect();
    return { query: (sql, values) => query(client, sql, values), release: (...args) => {
      releases++; trace.push('RELEASE'); client.release(...args);
    } };
  } };
  try {
    console.error = () => { alerts++; };
    await assert.rejects(runLedgerInvariants(alias, { activationPolicy }), (error) => {
      assert.equal(error.code, expected, `${boundary}/${code ?? 'unexpected'} classification`);
      assert(!error.message.includes('private operational probe marker'));
      if (real) assert.deepEqual(trace.slice(-2), ['ROLLBACK', 'RELEASE'], 'cleanup precedes rejection');
      return true;
    }, `${boundary}/${code ?? 'unexpected'} must reject, never return an integrity report`);
  } finally { console.error = originalError; }
  assert.equal(injected, true, 'the selected verifier SQL boundary must be reached');
  if (server) assert.equal(serverCode, '22012');
  assert.equal(alerts, 0, 'operational failure must not alert integrity drift');
  assert.equal(releases, real ? 1 : 0);
  assert.equal(trace.includes('COMMIT'), false);
  assert.equal((await pool.query("SELECT COUNT(*) AS n FROM telemetry WHERE event='invariant_drift'")).rows[0].n, telemetry);
  assert.deepEqual(await snapshotPhase2(pool), before);
  assert.equal((await runLedgerInvariants(pool, { alert: false, activationPolicy })).ok, true, 'subsequent read remains usable');
}
