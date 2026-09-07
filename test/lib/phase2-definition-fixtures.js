import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    await before(normalized, values);
    const result = await q.query(sql, values);
    await after(normalized, values, result);
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
