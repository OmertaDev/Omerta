// Scoped code upgrade/rollback rehearsal. Only a new loopback database is writable.
// The two source checkouts remain immutable; no existing database is restored over.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, fork } from 'node:child_process';
import { Pool } from 'pg';
import { setTimeout as delay } from 'node:timers/promises';
import { canonicalDatabaseSnapshot, canonicalJson, sha256 } from './rc1-native-proof.js';
import { sourceInventory } from './rc1-qualification.mjs';

const option = (name, fallback) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? process.env[fallback];
const accounts = ['rc1-pair-predecessor', 'rc1-pair-candidate'];
export const SOURCE_PAIR_COMMAND_WINDOW = Object.freeze({ periodMs: 600000, minimumCampaignMs: 240000, schedulingHeadroomMs: 30000, waitSliceMs: 30000 });
export function sourcePairCommandWindow(at) {
  assert(Number.isSafeInteger(at) && at >= 0, 'Invalid source-pair wall clock');
  const expires = (Math.floor(at / SOURCE_PAIR_COMMAND_WINDOW.periodMs) + 1) * SOURCE_PAIR_COMMAND_WINDOW.periodMs;
  return { scheduledAt: new Date(at).toISOString(), scheduledExpiresAt: new Date(expires).toISOString(), remainingMs: expires - at,
    ready: expires - at >= SOURCE_PAIR_COMMAND_WINDOW.minimumCampaignMs + SOURCE_PAIR_COMMAND_WINDOW.schedulingHeadroomMs };
}
export async function waitForSourcePairCommandWindow({ now = Date.now, sleep = delay, onWait = () => {} } = {}) {
  for (;;) {
    const window = sourcePairCommandWindow(now());
    if (window.ready) return window;
    const waitMs = Math.min(SOURCE_PAIR_COMMAND_WINDOW.waitSliceMs, window.remainingMs);
    onWait({ ...window, waitMs }); await sleep(waitMs);
  }
}
export function assertSourcePairCommandWindow(expiresAt, at, label) {
  assert(Number.isSafeInteger(at) && at >= 0 && Number.isFinite(Date.parse(expiresAt)), 'Invalid source-pair command deadline');
  assert(at < Date.parse(expiresAt), `${label}: actual issued command-board window expired; strict no-cache-write rehearsal failed`);
  return { label, at: new Date(at).toISOString(), expiresAt, remainingMs: Date.parse(expiresAt) - at };
}
const additiveOwnedFiles = new Set(['tools/rc1-source-pair.js', 'test/rc1-source-pair-additive.js', 'docs/rc1-source-pair-additive-review.md']);
// Derivative review outputs, not runtime, fixture or schema authority. Keep this literal closed
// list; full checkout inventories retain their bytes and repository knowledge checks qualify them.
export const ADDITIVE_KNOWLEDGE_OUTPUTS = Object.freeze([
  'knowledge/generated/contracts.md', 'knowledge/generated/documents.md', 'knowledge/generated/github-history.md',
  'knowledge/generated/graph-summary.md', 'knowledge/generated/graph.json', 'knowledge/generated/graph.mmd',
  'knowledge/generated/inventory.md', 'knowledge/generated/modules.md', 'knowledge/generated/routes.md', 'knowledge/generated/schema.md',
]);
const additiveEvidenceOutputs = new Set(ADDITIVE_KNOWLEDGE_OUTPUTS);
export function sourcePairReviewedTreeHash(records) {
  const reviewed = records.filter(line => {
    const file = line.slice(line.indexOf('\t') + 1);
    return !additiveOwnedFiles.has(file) && !additiveEvidenceOutputs.has(file);
  }).sort();
  return sha256(JSON.stringify(reviewed));
}
export const FIRST_FIVE_ADDITIVE_PAIR = Object.freeze({
  predecessor: 'f254c64a54a019665d7a516d382d56b46f2dcd82', reviewedCandidate: '0270f3aeb139c4ce5204c63bb5e6a25b7cea7746',
  predecessorTree: '1a5b5c2f649bc025b9a5bd22b0fb73e5636aab3e7f4f3cfb77a3422b7385a4fd',
  candidateTree: 'fe4913ffa8b9d7fe6f4bdebb5ccaee91721c9a65af92651279c15d0705ddeeda',
  predecessorSchema: 'd45c84e1b364d82f0834975f08a58675c8e3930dc35f0dd47534c5bed4741c9f',
  candidateSchema: '220780ae48a8a6ce9a3a1970110c4d420720c777c80217811c7166cf53e36390',
  predecessorCatalog: '2b809acfc18a556e42ef0a144523ff3e69253623e7c5a24895f3743dd8d120e8',
  candidateCatalog: '028af7ab65761f08dfd10e3cb6ef0f213fe8db723796d0b41df9652733e12cb7',
  candidateTableCatalog: '78354a849868506028c69d05681ded8f3721c86b3e017241f9b546b348c633b4',
  tables: Object.freeze(['company_production_receipts', 'company_specialization_requests', 'company_specialization_runs',
    'company_specializations', 'item_durability_birth_quality', 'item_durability_states', 'item_durability_uses']),
});
export const SECOND_BATCH_ADDITIVE_PAIR = Object.freeze({
  "predecessor": "18e28bda62759c4d18aaefea461a407b43c0b62f",
  "reviewedCandidate": "960e5ac8444313fdc2dfcd0930cccbb27dacc1fd",
  "predecessorTree": "ed274fc227b2353ec54e77c057f8bc8464abaff429c0edb8b9cb869c1268acad",
  "predecessorSchema": "220780ae48a8a6ce9a3a1970110c4d420720c777c80217811c7166cf53e36390",
  "predecessorCatalog": "028af7ab65761f08dfd10e3cb6ef0f213fe8db723796d0b41df9652733e12cb7",
  "candidateTree": "5467d89cb23dcc88e35d68e6849a3555338c163b4784e3ac0db21ae0ddf5b3ae",
  "candidateSchema": "0f84bd62550030d065621637241e62e21d8f51820a57bd6cfb1e0bc4182e609a",
  "candidateCatalog": "e60fc7a581bb21276c5176a2851e96fbc1d6a6bf429485a4510f36819e3a44b2",
  "candidateTableCatalog": "d87064c8762a49597826647a46474541f9581790063a488bbba28581a7c08f20",
  "tables": Object.freeze([
    "commercial_negotiation_requests",
    "commercial_negotiations",
    "contract_auction_bids",
    "contract_auction_requests",
    "contract_auctions",
    "equipment_maintenance_offers",
    "equipment_maintenance_repairs",
    "equipment_maintenance_requests",
    "equipment_rental_leases",
    "equipment_rental_offers",
    "equipment_rental_requests",
    "service_subscription_cycles",
    "service_subscription_requests",
    "service_subscriptions"
  ])
});
export const THIRD_BATCH_ADDITIVE_PAIR = Object.freeze({
  "predecessor": "7cd8476ee7cf0b2dba66cb86928f43487cbfaa5f",
  "reviewedCandidate": "9583e8ef4ca71112ff18efb2e74045756d390188",
  "predecessorTree": "5467d89cb23dcc88e35d68e6849a3555338c163b4784e3ac0db21ae0ddf5b3ae",
  "predecessorSchema": "0f84bd62550030d065621637241e62e21d8f51820a57bd6cfb1e0bc4182e609a",
  "predecessorCatalog": "e60fc7a581bb21276c5176a2851e96fbc1d6a6bf429485a4510f36819e3a44b2",
  "candidateTree": "525583c263db1d473f8f397b9bb758165d08f89de6efeae0874fa5ce3e9715d5",
  "candidateSchema": "9eead996764ec9b0a7211cb28eefb3588e1f2e100d28cd28e05a39f340e558dd",
  "candidateCatalog": "2f3eea769c954f038c6b0b77120f6d371a6449b6f7a3fb90ca7854add514eaaa",
  "candidateTableCatalog": "9f282d4df739f9baeb5eca7e92ec17f148136d5a37b2bb2d3794d2831e43acdd",
  "constraints": 104,
  "notNull": 121,
  "tables": Object.freeze([
    "business_partnership_contributions",
    "business_partnership_distributions",
    "business_partnership_requests",
    "business_partnerships",
    "company_acquisition_requests",
    "company_acquisitions",
    "company_governance",
    "company_governance_proposals",
    "company_governance_requests",
    "company_governance_votes",
    "employment_organization_courses",
    "employment_organization_requests",
    "employment_organizations",
    "worker_training_courses",
    "worker_training_requests",
    "worker_training_sessions"
  ])
});
export const FOURTH_BATCH_ADDITIVE_PAIR = Object.freeze({
  "predecessor": "fe4a75a8b21fc41fd3d3bc75cf7720612c581463",
  "reviewedCandidate": "8bfd960f62f295cc4022a0f7faa81f22053dacc8",
  "predecessorTree": "525583c263db1d473f8f397b9bb758165d08f89de6efeae0874fa5ce3e9715d5",
  "predecessorSchema": "9eead996764ec9b0a7211cb28eefb3588e1f2e100d28cd28e05a39f340e558dd",
  "predecessorCatalog": "2f3eea769c954f038c6b0b77120f6d371a6449b6f7a3fb90ca7854add514eaaa",
  "candidateTree": "d936c15e8a2e6af2a66be9c82c9f1e053c98c86a379283cc5a1ec8bf331b562a",
  "candidateSchema": "c24abb3e7a3863dabeecbb683671a12e95c447918a2b385b38cc36691fbb9dc9",
  "candidateCatalog": "15183087db6e3b3436e63da45cc60f2a24740bd22f9ca8f122cf9b497aa9dff3",
  "candidateTableCatalog": "1a12c38682fcff48a077fc226b8c44ddce5e0fc987a45759c1ce8dbd2c04342b",
  "constraints": 132,
  "notNull": 114,
  "tables": Object.freeze([
    "commercial_dispute_requests",
    "commercial_disputes",
    "company_restructuring_plans",
    "company_restructuring_requests",
    "equipment_insurance_claims",
    "equipment_insurance_policies",
    "equipment_insurance_requests",
    "infrastructure_concession_requests",
    "infrastructure_concessions",
    "territory_economics_payments",
    "territory_economics_profiles",
    "territory_economics_requests",
    "territory_economics_sources"
  ])
});
// Separate main-branch composition; all four historical profiles remain unchanged.
export const COMMERCIAL_MAIN_ADDITIVE_PAIR = Object.freeze({
  "predecessor": "5c18acaaf47c84851729b82354340c4d56734dd9",
  "reviewedCandidate": "279dc5e93a246daf1e1c422de262e7f2a0a0b4d2",
  "predecessorTree": "c85dedb8f78e6e8c919bf779b9b011b73c6b3f52773312b97143364520f2de0f",
  "predecessorSchema": "29b33ee417443a32b5c3a8b73dc5d7f27b518ed66f746e343da530c1768b9d42",
  "predecessorCatalog": "2f3eea769c954f038c6b0b77120f6d371a6449b6f7a3fb90ca7854add514eaaa",
  "candidateTree": "66df6c4b0ffb3f88724b2e6682c2466d4fe9f73081ce5897022833db798cd8ce",
  "candidateSchema": "03aecb8a4a997b22732e2a5190fec2dcef3acda8a2744e4369b59cd4228f85db",
  "candidateCatalog": "15183087db6e3b3436e63da45cc60f2a24740bd22f9ca8f122cf9b497aa9dff3",
  "candidateTableCatalog": "1a12c38682fcff48a077fc226b8c44ddce5e0fc987a45759c1ce8dbd2c04342b",
  "constraints": 132,
  "notNull": 114,
  "tables": Object.freeze([
    "commercial_dispute_requests",
    "commercial_disputes",
    "company_restructuring_plans",
    "company_restructuring_requests",
    "equipment_insurance_claims",
    "equipment_insurance_policies",
    "equipment_insurance_requests",
    "infrastructure_concession_requests",
    "infrastructure_concessions",
    "territory_economics_payments",
    "territory_economics_profiles",
    "territory_economics_requests",
    "territory_economics_sources"
  ])
});

// Separate exact relation for autonomy after the reviewed main/commercial merge.
export const AUTONOMY_MAIN_ADDITIVE_PAIR = Object.freeze({
  "predecessor": "226f62c566280b8da59fd7f77b295707975f99eb",
  "reviewedCandidate": "63f96fff489418f8f4bb21f9235c7dcbc6b25ae0",
  "predecessorTree": "66df6c4b0ffb3f88724b2e6682c2466d4fe9f73081ce5897022833db798cd8ce",
  "predecessorSchema": "03aecb8a4a997b22732e2a5190fec2dcef3acda8a2744e4369b59cd4228f85db",
  "predecessorCatalog": "15183087db6e3b3436e63da45cc60f2a24740bd22f9ca8f122cf9b497aa9dff3",
  "candidateTree": "606d73e3bbfba170e206b7eb40645c2c83a4df1b172afe43d02069f8f910f2ef",
  "candidateSchema": "38989e8533280ba5ef7998255712639083c883fa63f4e30fed4fbc74c24e67d1",
  "candidateCatalog": "bd9e9a5ba67d706ccf3b5892fbf61a0c1edb1d850e82ae8bc8511fb3948b0d8e",
  "candidateTableCatalog": "b9058463f72e0b694211f5d82ea0ea9eb39e117ce70edd4cf64ce44277a62b5d",
  "constraints": 105,
  "notNull": 152,
  "tables": Object.freeze([
    "agent_operating_memory_facts",
    "agent_operating_memory_policies",
    "agent_operating_memory_requests",
    "economic_intelligence_publications",
    "economic_intelligence_purchases",
    "economic_intelligence_requests",
    "funded_external_work_events",
    "funded_external_work_jobs",
    "funded_external_work_requests",
    "management_team_autonomy_grants",
    "management_team_plans",
    "management_team_requests",
    "management_teams",
    "strategy_laboratories",
    "strategy_laboratory_arms",
    "strategy_laboratory_requests",
    "strategy_laboratory_sources"
  ])
});

export const FIFTH_BATCH_ADDITIVE_PAIR = Object.freeze({
  "predecessor": "0c72a29748df6b1c6955ebcb648efe5f20fec6a1",
  "reviewedCandidate": "94ae0cf067939d05e18f997aef7ddd7b3fd18615",
  "predecessorTree": "d936c15e8a2e6af2a66be9c82c9f1e053c98c86a379283cc5a1ec8bf331b562a",
  "predecessorSchema": "c24abb3e7a3863dabeecbb683671a12e95c447918a2b385b38cc36691fbb9dc9",
  "predecessorCatalog": "15183087db6e3b3436e63da45cc60f2a24740bd22f9ca8f122cf9b497aa9dff3",
  "candidateTree": "83da348182a2a26fdb06b13dbfaf81284268c9ae2ae7cf88c0c26df177ca35e5",
  "candidateSchema": "a1d078109ccd50394e30871e4ccff8b5c2df976fcba72a5fedc2168e6404270c",
  "candidateCatalog": "bd9e9a5ba67d706ccf3b5892fbf61a0c1edb1d850e82ae8bc8511fb3948b0d8e",
  "candidateTableCatalog": "b9058463f72e0b694211f5d82ea0ea9eb39e117ce70edd4cf64ce44277a62b5d",
  "constraints": 105,
  "notNull": 152,
  "tables": Object.freeze([
    "agent_operating_memory_facts",
    "agent_operating_memory_policies",
    "agent_operating_memory_requests",
    "economic_intelligence_publications",
    "economic_intelligence_purchases",
    "economic_intelligence_requests",
    "funded_external_work_events",
    "funded_external_work_jobs",
    "funded_external_work_requests",
    "management_team_autonomy_grants",
    "management_team_plans",
    "management_team_requests",
    "management_teams",
    "strategy_laboratories",
    "strategy_laboratory_arms",
    "strategy_laboratory_requests",
    "strategy_laboratory_sources"
  ])
});
const load = (file) => import(pathToFileURL(path.resolve(file)).href);
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const outside = (root, target) => { const relative = path.relative(root, target); return relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative); };

export async function sourcePairIdentity(root) {
  root = await fs.realpath(root);
  assert.equal(await fs.realpath(git(root, 'rev-parse', '--show-toplevel')), root, 'Use the Git checkout root');
  assert.equal(git(root, 'status', '--porcelain', '--untracked-files=normal'), '', `Dirty source: ${root}`);
  const source = git(root, 'rev-parse', 'HEAD'), prior = process.cwd();
  let expected;
  // sourceInventory performs synchronous Git calls. Restore cwd before any await.
  try { process.chdir(root); expected = sourceInventory(source); } finally { process.chdir(prior); }
  const sourceFiles = [];
  for (const file of expected.files) {
    const resolved = await fs.realpath(path.join(root, file.path));
    assert(!outside(root, resolved) && resolved !== root, `Source path escapes checkout: ${file.path}`);
    const actual = sha256(await fs.readFile(resolved));
    assert(file.accepted.includes(actual), `Source bytes differ from Git blob: ${file.path}`);
    sourceFiles.push({ ...file, sha256: actual });
  }
  const inventory = [];
  for (const file of git(root, 'ls-files', '-z').split('\0').filter(Boolean))
    inventory.push([file, sha256(await fs.readFile(path.join(root, file)))]);
  const reviewedTree = git(root, 'ls-tree', '-r', '-z', 'HEAD').split('\0').filter(Boolean);
  const tracked = new Set(inventory.map(([file]) => file));
  const schemaBlob = tracked.has('schema.sql') ? execFileSync('git', ['-C', root, 'show', 'HEAD:schema.sql']) : null;
  const catalogBlob = tracked.has('test/lib/phase2-architecture-upgrade-catalog.json')
    ? execFileSync('git', ['-C', root, 'show', 'HEAD:test/lib/phase2-architecture-upgrade-catalog.json']) : null;
  const catalog = catalogBlob ? JSON.parse(catalogBlob) : null;
  const additiveSource = { tree: sourcePairReviewedTreeHash(reviewedTree), schema: schemaBlob ? sha256(schemaBlob) : null,
    catalog: catalogBlob ? sha256(catalogBlob) : null,
    catalogTables: catalog ? Object.fromEntries(FIRST_FIVE_ADDITIVE_PAIR.tables.map(name => [name, {
      constraints: catalog.added.filter(row => row.table_name === name), notNullColumns: catalog.notNullColumns[name] ?? null,
    }])) : {} };
  return { source, gitTree: expected.tree, checkoutSha256: sha256(canonicalJson(inventory)), inventory, sourceFiles, additiveSource, secondBatchAdditiveSource: { tree: additiveSource.tree, schema: additiveSource.schema, catalog: additiveSource.catalog, catalogTables: catalog ? Object.fromEntries(SECOND_BATCH_ADDITIVE_PAIR.tables.map(name => [name, { constraints: catalog.added.filter(row => row.table_name === name), notNullColumns: catalog.notNullColumns[name] ?? null }])) : {} },
    thirdBatchAdditiveSource: { tree: additiveSource.tree, schema: additiveSource.schema, catalog: additiveSource.catalog, catalogTables: catalog ? Object.fromEntries(THIRD_BATCH_ADDITIVE_PAIR.tables.map(name => [name, { constraints: catalog.added.filter(row => row.table_name === name), notNullColumns: catalog.notNullColumns[name] ?? null }])) : {} },
    fourthBatchAdditiveSource: { tree: additiveSource.tree, schema: additiveSource.schema, catalog: additiveSource.catalog, catalogTables: catalog ? Object.fromEntries(FOURTH_BATCH_ADDITIVE_PAIR.tables.map(name => [name, { constraints: catalog.added.filter(row => row.table_name === name), notNullColumns: catalog.notNullColumns[name] ?? null }])) : {} },
    fifthBatchAdditiveSource: { tree: additiveSource.tree, schema: additiveSource.schema, catalog: additiveSource.catalog, catalogTables: catalog ? Object.fromEntries(FIFTH_BATCH_ADDITIVE_PAIR.tables.map(name => [name, { constraints: catalog.added.filter(row => row.table_name === name), notNullColumns: catalog.notNullColumns[name] ?? null }])) : {} },
    lockfileSha256: sha256(await fs.readFile(path.join(root, 'package-lock.json'))) };
}

export function sourcePairStateDifference(a, b) {
  const left = Object.keys(a.tables), right = Object.keys(b.tables);
  const added = right.filter(name => !Object.hasOwn(a.tables, name)).sort();
  const removed = left.filter(name => !Object.hasOwn(b.tables, name)).sort();
  const changed = left.filter(name => Object.hasOwn(b.tables, name) && canonicalJson(a.tables[name]) !== canonicalJson(b.tables[name])).sort();
  const names = [...new Set([...a.sequences, ...b.sequences].map(row => row.sequencename))].sort();
  const sequences = names.filter(name => canonicalJson(a.sequences.filter(row => row.sequencename === name)) !== canonicalJson(b.sequences.filter(row => row.sequencename === name)));
  return { added, removed, changed, sequences, sequenceStateEqual: canonicalJson(a.sequences) === canonicalJson(b.sequences) };
}

// A source-pinned migration relation, not snapshot normalization. Raw snapshots and
// their unequal hashes remain evidence; this grants no validity to new authority.
export function qualifyFirstFiveAdditiveBootstrap(a, b, predecessor, candidate) {
  const pin = FIRST_FIVE_ADDITIVE_PAIR;
  assert.equal(predecessor.source, pin.predecessor, 'Additive predecessor is not the reviewed source');
  assert(/^[a-f0-9]{40}$/.test(candidate.source), 'Additive candidate source identity is invalid');
  for (const [identity, tree, schema, catalog] of [
    [predecessor, pin.predecessorTree, pin.predecessorSchema, pin.predecessorCatalog],
    [candidate, pin.candidateTree, pin.candidateSchema, pin.candidateCatalog],
  ]) {
    assert.equal(identity.additiveSource?.tree, tree, 'Unrelated source changed outside the three owned qualification files and closed derivative outputs');
    assert.equal(identity.additiveSource?.schema, schema, 'Additive schema definitions differ from reviewed source');
    assert.equal(identity.additiveSource?.catalog, catalog, 'Frozen inverse/source catalog differs from reviewed evidence');
  }
  assert.equal(sha256(canonicalJson(candidate.additiveSource.catalogTables)), pin.candidateTableCatalog,
    'Seven-table definition/NN catalog evidence differs from reviewed source');
  for (const name of pin.tables) {
    const evidence = candidate.additiveSource.catalogTables[name];
    assert(evidence?.constraints?.length && Array.isArray(evidence.notNullColumns) && evidence.notNullColumns.length,
      `Missing frozen definition/NN catalog evidence: ${name}`);
  }
  const delta = sourcePairStateDifference(a, b);
  assert.deepEqual(delta.added, pin.tables, 'Missing expected or unlisted additive tables');
  assert.deepEqual(delta.removed, [], 'Predecessor table removed');
  assert.deepEqual(delta.changed, [], 'Pre-existing row/table changed');
  assert(delta.sequenceStateEqual, 'Sequence state changed');
  for (const name of pin.tables) assert.deepEqual(b.tables[name], [], `New table is not empty: ${name}`);
  return { relation: 'REVIEWED_SEVEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP', reviewedCandidate: pin.reviewedCandidate,
    addedEmptyTables: [...pin.tables], predecessorRowsExact: true, allSequencesExact: true,
    beforeNormalizedSha256: sha256(canonicalJson(a)), afterNormalizedSha256: sha256(canonicalJson(b)),
    excludedClaim: 'No new-authority or native-schema validity is established by empty tables' };
}

export function qualifySecondBatchAdditiveBootstrap(a, b, predecessor, candidate) {
  const pin = SECOND_BATCH_ADDITIVE_PAIR;
  assert.equal(predecessor.source, pin.predecessor, 'Additive predecessor is not the reviewed source');
  assert(/^[a-f0-9]{40}$/.test(candidate.source), 'Additive candidate source identity is invalid');
  for (const [identity, tree, schema, catalog] of [
    [predecessor, pin.predecessorTree, pin.predecessorSchema, pin.predecessorCatalog],
    [candidate, pin.candidateTree, pin.candidateSchema, pin.candidateCatalog],
  ]) {
    assert.equal(identity.secondBatchAdditiveSource?.tree, tree, 'Unrelated source changed outside the three owned qualification files and closed derivative outputs');
    assert.equal(identity.secondBatchAdditiveSource?.schema, schema, 'Additive schema definitions differ from reviewed source');
    assert.equal(identity.secondBatchAdditiveSource?.catalog, catalog, 'Frozen inverse/source catalog differs from reviewed evidence');
  }
  assert.equal(sha256(canonicalJson(candidate.secondBatchAdditiveSource.catalogTables)), pin.candidateTableCatalog,
    'Fourteen-table definition/NN catalog evidence differs from reviewed source');
  for (const name of pin.tables) {
    const evidence = candidate.secondBatchAdditiveSource.catalogTables[name];
    assert(evidence?.constraints?.length && Array.isArray(evidence.notNullColumns) && evidence.notNullColumns.length,
      `Missing frozen definition/NN catalog evidence: ${name}`);
  }
  const delta = sourcePairStateDifference(a, b);
  assert.deepEqual(delta.added, pin.tables, 'Missing expected or unlisted additive tables');
  assert.deepEqual(delta.removed, [], 'Predecessor table removed');
  assert.deepEqual(delta.changed, [], 'Pre-existing row/table changed');
  assert(delta.sequenceStateEqual, 'Sequence state changed');
  for (const name of pin.tables) assert.deepEqual(b.tables[name], [], `New table is not empty: ${name}`);
  return { relation: 'REVIEWED_FOURTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP', reviewedCandidate: pin.reviewedCandidate,
    addedEmptyTables: [...pin.tables], predecessorRowsExact: true, allSequencesExact: true,
    beforeNormalizedSha256: sha256(canonicalJson(a)), afterNormalizedSha256: sha256(canonicalJson(b)),
    excludedClaim: 'No new-authority or native-schema validity is established by empty tables' };
}

export function qualifyThirdBatchAdditiveBootstrap(a, b, predecessor, candidate) {
  const pin = THIRD_BATCH_ADDITIVE_PAIR;
  assert.equal(predecessor.source, pin.predecessor, 'Additive predecessor is not the reviewed source');
  assert(/^[a-f0-9]{40}$/.test(candidate.source), 'Additive candidate source identity is invalid');
  for (const [identity, tree, schema, catalog] of [
    [predecessor, pin.predecessorTree, pin.predecessorSchema, pin.predecessorCatalog],
    [candidate, pin.candidateTree, pin.candidateSchema, pin.candidateCatalog],
  ]) {
    assert.equal(identity.thirdBatchAdditiveSource?.tree, tree, 'Unrelated source changed outside the three owned qualification files and closed derivative outputs');
    assert.equal(identity.thirdBatchAdditiveSource?.schema, schema, 'Additive schema definitions differ from reviewed source');
    assert.equal(identity.thirdBatchAdditiveSource?.catalog, catalog, 'Frozen inverse/source catalog differs from reviewed evidence');
  }
  assert.equal(sha256(canonicalJson(candidate.thirdBatchAdditiveSource.catalogTables)), pin.candidateTableCatalog,
    'Sixteen-table definition/NN catalog evidence differs from reviewed source');
  for (const name of pin.tables) {
    const evidence = candidate.thirdBatchAdditiveSource.catalogTables[name];
    assert(evidence?.constraints?.length && Array.isArray(evidence.notNullColumns) && evidence.notNullColumns.length,
      `Missing frozen definition/NN catalog evidence: ${name}`);
  }
  assert.equal(Object.values(candidate.thirdBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.constraints.length, 0), pin.constraints, 'Exact 104 native constraints required');
  assert.equal(Object.values(candidate.thirdBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.notNullColumns.length, 0), pin.notNull, 'Exact 121 NOT NULL bindings required');
  for (const name of pin.tables) assert(Array.isArray(b.tables[name]), `New table snapshot type invalid: ${name}`);
  const delta = sourcePairStateDifference(a, b);
  assert.deepEqual(delta.added, pin.tables, 'Missing expected or unlisted additive tables');
  assert.deepEqual(delta.removed, [], 'Predecessor table removed');
  assert.deepEqual(delta.changed, [], 'Pre-existing row/table changed');
  assert(delta.sequenceStateEqual, 'Sequence state changed');
  for (const name of pin.tables) assert.deepEqual(b.tables[name], [], `New table is not empty: ${name}`);
  return { relation: 'REVIEWED_SIXTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP', reviewedCandidate: pin.reviewedCandidate,
    addedEmptyTables: [...pin.tables], predecessorRowsExact: true, allSequencesExact: true,
    beforeNormalizedSha256: sha256(canonicalJson(a)), afterNormalizedSha256: sha256(canonicalJson(b)),
    excludedClaim: 'No new-authority or native-schema validity is established by empty tables' };
}

export function qualifyFourthBatchAdditiveBootstrap(a, b, predecessor, candidate) {
  const pin = FOURTH_BATCH_ADDITIVE_PAIR;
  assert.equal(predecessor.source, pin.predecessor, 'Additive predecessor is not the reviewed source');
  assert(/^[a-f0-9]{40}$/.test(candidate.source), 'Additive candidate source identity is invalid');
  for (const [identity, tree, schema, catalog] of [
    [predecessor, pin.predecessorTree, pin.predecessorSchema, pin.predecessorCatalog],
    [candidate, pin.candidateTree, pin.candidateSchema, pin.candidateCatalog],
  ]) {
    assert.equal(identity.fourthBatchAdditiveSource?.tree, tree, 'Unrelated source changed outside the three owned qualification files and closed derivative outputs');
    assert.equal(identity.fourthBatchAdditiveSource?.schema, schema, 'Additive schema definitions differ from reviewed source');
    assert.equal(identity.fourthBatchAdditiveSource?.catalog, catalog, 'Frozen inverse/source catalog differs from reviewed evidence');
  }
  assert.equal(sha256(canonicalJson(candidate.fourthBatchAdditiveSource.catalogTables)), pin.candidateTableCatalog,
    'Thirteen-table definition/NN catalog evidence differs from reviewed source');
  for (const name of pin.tables) {
    const evidence = candidate.fourthBatchAdditiveSource.catalogTables[name];
    assert(evidence?.constraints?.length && Array.isArray(evidence.notNullColumns) && evidence.notNullColumns.length,
      `Missing frozen definition/NN catalog evidence: ${name}`);
  }
  assert.equal(Object.values(candidate.fourthBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.constraints.length, 0), pin.constraints, 'Exact 132 native constraints required');
  assert.equal(Object.values(candidate.fourthBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.notNullColumns.length, 0), pin.notNull, 'Exact 114 NOT NULL bindings required');
  for (const name of pin.tables) assert(Array.isArray(b.tables[name]), `New table snapshot type invalid: ${name}`);
  const delta = sourcePairStateDifference(a, b);
  assert.deepEqual(delta.added, pin.tables, 'Missing expected or unlisted additive tables');
  assert.deepEqual(delta.removed, [], 'Predecessor table removed');
  assert.deepEqual(delta.changed, [], 'Pre-existing row/table changed');
  assert(delta.sequenceStateEqual, 'Sequence state changed');
  for (const name of pin.tables) assert.deepEqual(b.tables[name], [], `New table is not empty: ${name}`);
  return { relation: 'REVIEWED_THIRTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP', reviewedCandidate: pin.reviewedCandidate,
    addedEmptyTables: [...pin.tables], predecessorRowsExact: true, allSequencesExact: true,
    beforeNormalizedSha256: sha256(canonicalJson(a)), afterNormalizedSha256: sha256(canonicalJson(b)),
    excludedClaim: 'No new-authority or native-schema validity is established by empty tables' };
}

export function qualifyCommercialMainAdditiveBootstrap(a, b, predecessor, candidate) {
  const pin = COMMERCIAL_MAIN_ADDITIVE_PAIR;
  assert.equal(predecessor.source, pin.predecessor, 'Additive predecessor is not the reviewed source');
  assert(/^[a-f0-9]{40}$/.test(candidate.source), 'Additive candidate source identity is invalid');
  for (const [identity, tree, schema, catalog] of [
    [predecessor, pin.predecessorTree, pin.predecessorSchema, pin.predecessorCatalog],
    [candidate, pin.candidateTree, pin.candidateSchema, pin.candidateCatalog],
  ]) {
    assert.equal(identity.fourthBatchAdditiveSource?.tree, tree, 'Unrelated source changed outside the three owned qualification files and closed derivative outputs');
    assert.equal(identity.fourthBatchAdditiveSource?.schema, schema, 'Additive schema definitions differ from reviewed source');
    assert.equal(identity.fourthBatchAdditiveSource?.catalog, catalog, 'Frozen inverse/source catalog differs from reviewed evidence');
  }
  assert.equal(sha256(canonicalJson(candidate.fourthBatchAdditiveSource.catalogTables)), pin.candidateTableCatalog,
    'Thirteen-table definition/NN catalog evidence differs from reviewed source');
  for (const name of pin.tables) {
    const evidence = candidate.fourthBatchAdditiveSource.catalogTables[name];
    assert(evidence?.constraints?.length && Array.isArray(evidence.notNullColumns) && evidence.notNullColumns.length,
      `Missing frozen definition/NN catalog evidence: ${name}`);
  }
  assert.equal(Object.values(candidate.fourthBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.constraints.length, 0), pin.constraints, 'Exact 132 native constraints required');
  assert.equal(Object.values(candidate.fourthBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.notNullColumns.length, 0), pin.notNull, 'Exact 114 NOT NULL bindings required');
  for (const name of pin.tables) assert(Array.isArray(b.tables[name]), `New table snapshot type invalid: ${name}`);
  const delta = sourcePairStateDifference(a, b);
  assert.deepEqual(delta.added, pin.tables, 'Missing expected or unlisted additive tables');
  assert.deepEqual(delta.removed, [], 'Predecessor table removed');
  assert.deepEqual(delta.changed, [], 'Pre-existing row/table changed');
  assert(delta.sequenceStateEqual, 'Sequence state changed');
  for (const name of pin.tables) assert.deepEqual(b.tables[name], [], `New table is not empty: ${name}`);
  return { relation: 'REVIEWED_COMMERCIAL_MAIN_THIRTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP', reviewedCandidate: pin.reviewedCandidate,
    addedEmptyTables: [...pin.tables], predecessorRowsExact: true, allSequencesExact: true,
    beforeNormalizedSha256: sha256(canonicalJson(a)), afterNormalizedSha256: sha256(canonicalJson(b)),
    excludedClaim: 'No new-authority or native-schema validity is established by empty tables' };
}

// Only source-declared bootstrap differences are normalized. In particular a
// populated resident turn remains authority state and must compare exactly.
export function qualifyFifthBatchAdditiveBootstrap(a, b, predecessor, candidate) {
  const pin = FIFTH_BATCH_ADDITIVE_PAIR;
  assert.equal(predecessor.source, pin.predecessor, 'Additive predecessor is not the reviewed source');
  assert(/^[a-f0-9]{40}$/.test(candidate.source), 'Additive candidate source identity is invalid');
  for (const [identity, tree, schema, catalog] of [
    [predecessor, pin.predecessorTree, pin.predecessorSchema, pin.predecessorCatalog],
    [candidate, pin.candidateTree, pin.candidateSchema, pin.candidateCatalog],
  ]) {
    assert.equal(identity.fifthBatchAdditiveSource?.tree, tree, 'Unrelated source changed outside the three owned qualification files and closed derivative outputs');
    assert.equal(identity.fifthBatchAdditiveSource?.schema, schema, 'Additive schema definitions differ from reviewed source');
    assert.equal(identity.fifthBatchAdditiveSource?.catalog, catalog, 'Frozen inverse/source catalog differs from reviewed evidence');
  }
  assert.equal(sha256(canonicalJson(candidate.fifthBatchAdditiveSource.catalogTables)), pin.candidateTableCatalog,
    'Seventeen-table definition/NN catalog evidence differs from reviewed source');
  for (const name of pin.tables) {
    const evidence = candidate.fifthBatchAdditiveSource.catalogTables[name];
    assert(evidence?.constraints?.length && Array.isArray(evidence.notNullColumns) && evidence.notNullColumns.length,
      `Missing frozen definition/NN catalog evidence: ${name}`);
  }
  assert.equal(Object.values(candidate.fifthBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.constraints.length, 0), pin.constraints, 'Exact 105 native constraints required');
  assert.equal(Object.values(candidate.fifthBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.notNullColumns.length, 0), pin.notNull, 'Exact 152 NOT NULL bindings required');
  for (const name of pin.tables) assert(Array.isArray(b.tables[name]), `New table snapshot type invalid: ${name}`);
  const delta = sourcePairStateDifference(a, b);
  assert.deepEqual(delta.added, pin.tables, 'Missing expected or unlisted additive tables');
  assert.deepEqual(delta.removed, [], 'Predecessor table removed');
  assert.deepEqual(delta.changed, [], 'Pre-existing row/table changed');
  assert(delta.sequenceStateEqual, 'Sequence state changed');
  for (const name of pin.tables) assert.deepEqual(b.tables[name], [], `New table is not empty: ${name}`);
  return { relation: 'REVIEWED_SEVENTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP', reviewedCandidate: pin.reviewedCandidate,
    addedEmptyTables: [...pin.tables], predecessorRowsExact: true, allSequencesExact: true,
    beforeNormalizedSha256: sha256(canonicalJson(a)), afterNormalizedSha256: sha256(canonicalJson(b)),
    excludedClaim: 'No new-authority or native-schema validity is established by empty tables' };
}

export function qualifyAutonomyMainAdditiveBootstrap(a, b, predecessor, candidate) {
  const pin = AUTONOMY_MAIN_ADDITIVE_PAIR;
  assert.equal(predecessor.source, pin.predecessor, 'Additive predecessor is not the reviewed source');
  assert(/^[a-f0-9]{40}$/.test(candidate.source), 'Additive candidate source identity is invalid');
  for (const [identity, tree, schema, catalog] of [
    [predecessor, pin.predecessorTree, pin.predecessorSchema, pin.predecessorCatalog],
    [candidate, pin.candidateTree, pin.candidateSchema, pin.candidateCatalog],
  ]) {
    assert.equal(identity.fifthBatchAdditiveSource?.tree, tree, 'Unrelated source changed outside the three owned qualification files and closed derivative outputs');
    assert.equal(identity.fifthBatchAdditiveSource?.schema, schema, 'Additive schema definitions differ from reviewed source');
    assert.equal(identity.fifthBatchAdditiveSource?.catalog, catalog, 'Frozen inverse/source catalog differs from reviewed evidence');
  }
  assert.equal(sha256(canonicalJson(candidate.fifthBatchAdditiveSource.catalogTables)), pin.candidateTableCatalog,
    'Seventeen-table definition/NN catalog evidence differs from reviewed source');
  for (const name of pin.tables) {
    const evidence = candidate.fifthBatchAdditiveSource.catalogTables[name];
    assert(evidence?.constraints?.length && Array.isArray(evidence.notNullColumns) && evidence.notNullColumns.length,
      `Missing frozen definition/NN catalog evidence: ${name}`);
  }
  assert.equal(Object.values(candidate.fifthBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.constraints.length, 0), pin.constraints, 'Exact 105 native constraints required');
  assert.equal(Object.values(candidate.fifthBatchAdditiveSource.catalogTables).reduce((n, row) => n + row.notNullColumns.length, 0), pin.notNull, 'Exact 152 NOT NULL bindings required');
  for (const name of pin.tables) assert(Array.isArray(b.tables[name]), `New table snapshot type invalid: ${name}`);
  const delta = sourcePairStateDifference(a, b);
  assert.deepEqual(delta.added, pin.tables, 'Missing expected or unlisted additive tables');
  assert.deepEqual(delta.removed, [], 'Predecessor table removed');
  assert.deepEqual(delta.changed, [], 'Pre-existing row/table changed');
  assert(delta.sequenceStateEqual, 'Sequence state changed');
  for (const name of pin.tables) assert.deepEqual(b.tables[name], [], `New table is not empty: ${name}`);
  return { relation: 'REVIEWED_AUTONOMY_MAIN_SEVENTEEN_EMPTY_TABLE_ADDITIVE_BOOTSTRAP', reviewedCandidate: pin.reviewedCandidate,
    addedEmptyTables: [...pin.tables], predecessorRowsExact: true, allSequencesExact: true,
    beforeNormalizedSha256: sha256(canonicalJson(a)), afterNormalizedSha256: sha256(canonicalJson(b)),
    excludedClaim: 'No new-authority or native-schema validity is established by empty tables' };
}

export function normalizeSourcePairBootstrap(snapshot, { schema, appVersion, predecessorSchema, candidateSchema }) {
  assert([predecessorSchema, candidateSchema].includes(schema), 'Snapshot schema is not one of the pinned source pair');
  const statement = 'ALTER TABLE population_state ADD COLUMN IF NOT EXISTS behaviour_turn JSONB;';
  const declaresTurn = text => text.replaceAll('\r\n', '\n').split('\n').includes(statement);
  const additiveTurn = !/\bbehaviour_turn\b/.test(predecessorSchema) && declaresTurn(candidateSchema);
  assert.equal(snapshot.tables.schema_meta.length, 1, 'Expected one source schema stamp');
  const stamp = JSON.parse(snapshot.tables.schema_meta[0]);
  assert.equal(stamp.id, 1); assert.equal(stamp.app_version, appVersion, 'Schema app version differs from booted source');
  assert.equal(stamp.schema_sha, sha256(schema).slice(0, 16), 'Schema stamp differs from booted source bytes');
  assert(typeof stamp.applied_at === 'string' && Number.isFinite(Date.parse(stamp.applied_at)), 'Invalid schema observation timestamp');
  stamp.schema_sha = '<validated-source-schema>'; stamp.applied_at = '<bootstrap-observation>';
  const population = snapshot.tables.population_state.map(raw => {
    const row = JSON.parse(raw);
    if (declaresTurn(schema)) assert(Object.hasOwn(row, 'behaviour_turn'), 'Declared resident turn column is missing');
    if (additiveTurn && Object.hasOwn(row, 'behaviour_turn') && row.behaviour_turn === null) delete row.behaviour_turn;
    return canonicalJson(row);
  });
  return { tables: { ...snapshot.tables, schema_meta: [canonicalJson(stamp)], population_state: population }, sequences: snapshot.sequences };
}

export async function createPrivateOutput(directory, roots) {
  const parent = await fs.realpath(path.dirname(path.resolve(directory)));
  const resolved = path.join(parent, path.basename(directory));
  const realRoots = await Promise.all(roots.map((root) => fs.realpath(root)));
  for (const root of realRoots) assert(outside(root, resolved), 'Keep private evidence outside source checkouts');
  await fs.mkdir(resolved, { recursive: false, mode: 0o700 });
  const real = await fs.realpath(resolved);
  for (const root of realRoots) assert(outside(root, real), 'Evidence path changed into a source checkout');
  assert.equal(real, resolved, 'Evidence path changed during creation');
  return real;
}

export function validateMysteryResult(result, key, replayed) {
  assert.match(key, /^[a-f0-9]{64}\.[a-f0-9]{64}$/);
  assert.equal(result?.schemaVersion, 1, 'Missing command schema');
  assert.equal(result.executionId, key, 'Response execution identity differs');
  assert.equal(result.status, 'COMPLETED', 'Command did not complete');
  assert.equal(result.replayed, replayed);
  assert(Object.hasOwn(result, 'result') && result.result !== null && typeof result.result === 'object'
    && !Array.isArray(result.result), 'Missing command result object');
  if (Object.hasOwn(result.result, 'instanceId')) assert.match(result.result.instanceId, /^[a-f0-9-]{36}$/, 'Invalid mystery instance');
  assert.equal(result.feedback?.immediateResult?.status, 'COMPLETED', 'Missing completion feedback');
  assert(typeof result.feedback.immediateResult.label === 'string' && result.feedback.immediateResult.label.length > 0);
}

export async function assertFreshMysteryStart(pool, account, graphId) {
  assert(typeof graphId === 'string' && graphId.length > 0);
  const rows = (await pool.query('SELECT id FROM mystery_instances WHERE authority_account_id=$1 AND graph_id=$2', [account, graphId])).rows;
  assert.equal(rows.length, 0, 'Fresh command must start with no matching mystery instance');
  return rows.length;
}

export async function assertDurableMystery(pool, receipt) {
  const { account, graphId, key, result } = receipt;
  assert(typeof graphId === 'string' && graphId.length > 0);
  const rows = (await pool.query('SELECT * FROM mystery_instances WHERE authority_account_id=$1 AND graph_id=$2', [account, graphId])).rows;
  assert.equal(rows.length, 1, 'Acknowledged command must create exactly one matching mystery instance');
  const instance = rows[0];
  if (Object.hasOwn(result.result, 'instanceId')) assert.equal(result.result.instanceId, instance.id, 'API mystery instance differs');
  assert.equal(instance.authority_account_id, account, 'Mystery authority differs');
  assert.equal(instance.graph_id, graphId, 'Mystery graph differs');
  assert.equal(instance.owner_scope, 'character');
  const owners = (await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [instance.owner_id, account])).rows;
  assert.equal(owners.length, 1, 'Mystery character is not owned by the actor');
  const guardKey = `player-command:${sha256(canonicalJson(key))}`;
  const guards = (await pool.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1', [guardKey])).rows;
  assert.equal(guards.length, 1, 'Acknowledged durable mutation receipt is missing');
  const guard = guards[0];
  assert.equal(guard.mutation_kind, 'mystery_action');
  assert.equal(guard.owner_scope, 'character'); assert.equal(guard.owner_id, instance.owner_id);
  assert(guard.completed_at && guard.result_json, 'Mutation receipt is not complete');
  const durable = JSON.parse(guard.result_json);
  assert.equal(durable.ok, true); assert.equal(durable.instanceId, instance.id, 'Durable mystery instance differs');
  assert.deepEqual(durable.owner, { scope: instance.owner_scope, id: instance.owner_id }, 'Durable mystery owner differs');
  assert.equal(durable.graph?.id, instance.graph_id, 'Durable mystery graph differs');
  assert.equal(durable.graph.version, Number(instance.graph_version), 'Durable mystery graph version differs');
  return { instance, guard };
}

const waitFor = async (promise, ms) => {
  let timer;
  try { return await Promise.race([promise, new Promise((resolve) => { timer = setTimeout(() => resolve(null), ms); })]); }
  finally { clearTimeout(timer); }
};
export function stopSourcePairChild(state, { graceMs = 15000, termMs = 3000, killMs = 3000 } = {}) {
  if (state.stopping) return state.stopping;
  state.stopping = (async () => {
    if (state.child.connected) { try { state.child.send('close', () => {}); } catch { /* Exit will establish status. */ } }
    let result = await waitFor(state.exit, graceMs), forced = false;
    for (const [signal, timeout] of [['SIGTERM', termMs], ['SIGKILL', killMs]]) {
      if (result) break;
      forced = true; state.child.kill(signal); result = await waitFor(state.exit, timeout);
    }
    assert(result, `Child did not exit after SIGKILL: ${state.label}, pid=${state.child.pid}`);
    assert(!forced && result.code === 0 && result.signal === null,
      `Child shutdown failed: ${state.label}; forced=${forced}, code=${result.code}, signal=${result.signal}`);
    return result;
  })();
  return state.stopping;
}

async function childMain() {
  assert(process.send && process.env.RC1_PAIR_CHILD === 'isolated-loopback');
  const endpoint = new URL(process.env.DATABASE_URL);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname));
  assert(/^\/rc1_pair_[a-f0-9]+$/.test(endpoint.pathname));
  const { buildServer } = await load('src/server.js');
  const app = await buildServer();
  if (process.argv.includes('--fixture')) {
    const { addPlayer } = await load('test/lib/player-command-support.js');
    for (const account of accounts) await addPlayer(app.pool, account);
  }
  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  process.send({ origin });
  process.on('message', async (message) => {
    const { flushWorldTelemetry } = await load('src/world-telemetry.js');
    await flushWorldTelemetry(app.pool);
    if (message === 'flush') { process.send('flushed'); return; }
    assert.equal(message, 'close');
    await app.close(); await app.pool.end(); process.exit(0);
  });
}

export async function runSourcePair() {
  const cwd = await fs.realpath(process.cwd());
  const previousInput = option('predecessor-directory', 'RC1_PAIR_PREDECESSOR_DIRECTORY');
  const expectedPrevious = option('predecessor', 'RC1_PAIR_PREDECESSOR_SHA');
  const outputInput = option('output', 'RC1_PAIR_OUTPUT');
  assert(previousInput, '--predecessor-directory or RC1_PAIR_PREDECESSOR_DIRECTORY is required');
  assert(outputInput, '--output or RC1_PAIR_OUTPUT must identify new private storage');
  const previous = await fs.realpath(path.resolve(previousInput));
  const output = await createPrivateOutput(path.resolve(outputInput), [cwd, previous]);
  const put = (name, value) => syncFs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const update = (name, value) => {
    const temporary = path.join(output, `${name}.pending`);
    syncFs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    syncFs.renameSync(temporary, path.join(output, name));
  };
  const report = { format: 1, status: 'RUNNING', scope: 'local fixture-assisted source-pair compatibility',
    phase: 'preflight', startedAt: new Date().toISOString(), node: process.version, platform: process.platform, assertions: [],
    arguments: { candidateDirectory: cwd, predecessorDirectory: previous, predecessor: expectedPrevious, output,
      supplied: { predecessorDirectory: previousInput, output: outputInput } },
    normalization: { excludedFields: ['schema_meta.applied_at'],
      validatedFields: ['schema_meta.schema_sha must equal the booted source schema bytes; app_version must equal its package version'],
      additiveFields: ['Only behaviour_turn:null may match an absent predecessor column, when the pinned predecessor has no declaration and the candidate has the exact nullable JSONB ADD COLUMN statement. Non-null turns remain compared.'],
      excludedRows: 'Only world_command/completed/replayed:true telemetry observations matching an actual recorded replay, with empty consequences. Raw rows remain retained; non-replay telemetry remains compared.',
      reason: 'stampSchema updates timestamp and source schema hash on bootstrap. Validate the source stamp before comparing data; retain both raw snapshots and source descriptors.',
      retained: 'All other rows, values, sequences, generated IDs, deadlines, balances, state and receipts.' },
    receiptComparison: 'Validate completed command schema and database instance/owner/graph/mutation receipt, then compare durable result, identity and immediate feedback. Fresh projection/asOf and differential feedback are retained but not byte-compared.',
    commandWindowPolicy: { ...SOURCE_PAIR_COMMAND_WINDOW, rule: 'FIRST board issuance waits for a real-clock scheduling window; actual stored board expiry bounds every subsequent replay and measured snapshot. No clock/TTL override or refreshed original board.',
      scope: 'Strict no-cache-write comparison only inside the same actual ten-minute command-board window. Expired-board ACK legitimately issues a new projection on both versions and is not qualified by this rehearsal; all rows/sequences remain strict.' },
    additiveBootstrapPolicy: { predecessor: FIRST_FIVE_ADDITIVE_PAIR.predecessor, reviewedCandidate: FIRST_FIVE_ADDITIVE_PAIR.reviewedCandidate,
      stages: ['upgrade preserves acknowledged state', 'upgrade replay creates no new effect'], tables: FIRST_FIVE_ADDITIVE_PAIR.tables,
      sourceRule: 'All reviewed Git blobs remain frozen except this tool, its dedicated additive test/scoped review and the ten literal derivative knowledge outputs; full checkout inventories retain all bytes',
      derivativeEvidenceOutputs: ADDITIVE_KNOWLEDGE_OUTPUTS,
      dataRule: 'Every predecessor row/table and all sequences remain exact; seven reviewed added tables must be empty; raw unequal hashes retained',
      excludedClaim: 'Empty added tables do not establish new authority or native schema validity' },
    secondBatchAdditiveBootstrapPolicy: { predecessor: SECOND_BATCH_ADDITIVE_PAIR.predecessor, reviewedCandidate: SECOND_BATCH_ADDITIVE_PAIR.reviewedCandidate, stages: ['upgrade preserves acknowledged state', 'upgrade replay creates no new effect'], tables: SECOND_BATCH_ADDITIVE_PAIR.tables, sourceRule: 'Exact three owned qualification files and ten literal derivative outputs only; catalog/schema/runtime/CI remain frozen', dataRule: 'Fourteen reviewed tables EMPTY; all prior and unknown rows/tables/sequences exact; rollback/replay/reupgrade full equality', excludedClaim: 'No populated authority, full-world, deployed recovery or backing validity' },
    thirdBatchAdditiveBootstrapPolicy: { predecessor: THIRD_BATCH_ADDITIVE_PAIR.predecessor, reviewedCandidate: THIRD_BATCH_ADDITIVE_PAIR.reviewedCandidate, stages: ['upgrade preserves acknowledged state', 'upgrade replay creates no new effect'], tables: THIRD_BATCH_ADDITIVE_PAIR.tables, constraints: 104, notNull: 121, sourceRule: 'Unchanged three qualification files and closed ten derivative outputs only; all other complete source/catalog/schema bytes pinned', dataRule: 'Sixteen declared tables EMPTY; every prior/unknown row/table and every sequence exact; rollback/replay/reupgrade strict full equality', excludedClaim: 'No populated authority, financial backing, deployed predecessor or full-world recovery qualification' },
    fourthBatchAdditiveBootstrapPolicy: { predecessor: FOURTH_BATCH_ADDITIVE_PAIR.predecessor, reviewedCandidate: FOURTH_BATCH_ADDITIVE_PAIR.reviewedCandidate, stages: ['upgrade preserves acknowledged state', 'upgrade replay creates no new effect'], tables: FOURTH_BATCH_ADDITIVE_PAIR.tables, constraints: 132, notNull: 114, sourceRule: 'Unchanged three qualification files and closed ten derivative outputs only; whole RootIV runtime/schema/catalog/source frozen', dataRule: 'Thirteen declared tables EMPTY; every old/unknown row/table and every sequence exact; rollback/replay/reupgrade strict full equality', excludedClaim: 'Provisional prerelease predecessor; no populated authority, backing, deployed predecessor or full-world recovery qualification' },
    autonomyMainAdditiveBootstrapPolicy: { predecessor: AUTONOMY_MAIN_ADDITIVE_PAIR.predecessor, reviewedCandidate: AUTONOMY_MAIN_ADDITIVE_PAIR.reviewedCandidate, stages: ['upgrade preserves acknowledged state', 'upgrade replay creates no new effect'], tables: AUTONOMY_MAIN_ADDITIVE_PAIR.tables, constraints: 105, notNull: 152, sourceRule: 'Unchanged three qualification files and closed ten derivative outputs only; whole merged runtime/schema/catalog/source frozen', dataRule: 'Seventeen declared tables EMPTY; every old/unknown row/table and every sequence exact; rollback/replay/reupgrade strict full equality', excludedClaim: 'No populated authority, backing, native validity, deployed predecessor or full-world recovery qualification' },
    fifthBatchAdditiveBootstrapPolicy: { predecessor: FIFTH_BATCH_ADDITIVE_PAIR.predecessor, reviewedCandidate: FIFTH_BATCH_ADDITIVE_PAIR.reviewedCandidate, stages: ['upgrade preserves acknowledged state', 'upgrade replay creates no new effect'], tables: FIFTH_BATCH_ADDITIVE_PAIR.tables, constraints: 105, notNull: 152, sourceRule: 'Unchanged three qualification files and closed ten derivative outputs only; whole RootV runtime/schema/catalog/source frozen', dataRule: 'Seventeen declared tables EMPTY; every old/unknown row/table and every sequence exact; rollback/replay/reupgrade strict full equality', excludedClaim: 'Provisional prerelease predecessor; no populated authority, backing, deployed predecessor or full-world recovery qualification' },
    coverageExclusions: ['Not deployed Render recovery', 'No worker or Linux application-signal rehearsal in this tool',
      'Two fixture accounts and mystery.start only; not full resource or journey coverage',
      'No backup restore or recovery-point claim', 'Installed dependencies must independently match their lockfile'] };
  put('run-reserved.json', report); update('result.json', report);
  const event = (value) => syncFs.appendFileSync(path.join(output, 'history.jsonl'),
    JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n', { mode: 0o600 });
  const phase = (value) => { report.phase = value; event({ phase: value }); update('result.json', report); };
  const checkCommandWindow = (label) => {
    if (!report.commandWindow?.firstBoardExpiresAt) return;
    const checked = assertSourcePairCommandWindow(report.commandWindow.firstBoardExpiresAt, Date.now(), label);
    report.commandWindow.checks.push(checked); update('result.json', report);
  };
  const receipts = [], replays = [], children = [];
  update('receipts.json', receipts); update('replays.json', replays);
  let candidate, predecessor, admin, pool, env, running, count = 0, requests = 0, hardStopTimer;
  const schemas = new Map();
  let predecessorSchema, candidateSchema;
  const abort = new AbortController();
  const interrupted = (promise) => {
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(abort.signal.reason);
      abort.signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(promise).then(resolve, reject).finally(() => abort.signal.removeEventListener('abort', onAbort));
      if (abort.signal.aborted) onAbort();
    });
  };
  const failure = (error) => {
    report.status = 'FAIL'; process.exitCode = 1;
    report.failure ??= { message: String(error.message).slice(0, 4000), stack: error.stack?.slice(0, 5000) };
    update('result.json', report);
  };
  const onSignal = (signal) => {
    if (abort.signal.aborted) return;
    const error = new Error(`Source-pair interrupted by ${signal}`);
    report.interruptedBy = signal; failure(error); event({ signal }); abort.abort(error);
    for (const child of children) void stopSourcePairChild(child, { graceMs: 3000 }).catch(() => {});
    // Even a hung native call cannot keep an interrupted parent alive indefinitely.
    hardStopTimer = setTimeout(() => {
      report.hardStop = true; report.endedAt = new Date().toISOString(); report.status = 'FAIL';
      for (const child of children) { try { child.child.kill('SIGKILL'); } catch { /* Record PID below. */ } }
      report.children = children.map(({ label, child, result }) => ({ label, pid: child.pid, result: result || null }));
      update('result.json', report); process.exit(1);
    }, 30000);
  };
  const signalHandlers = Object.fromEntries(['SIGINT', 'SIGTERM'].map((signal) => [signal, () => onSignal(signal)]));
  for (const [signal, handler] of Object.entries(signalHandlers)) process.on(signal, handler);
  async function start(root, fixture = false) {
    abort.signal.throwIfAborted();
    const label = `${++count}-${root === previous ? 'predecessor' : 'candidate'}`;
    phase(`bootstrap-${label}`);
    const logPath = path.join(output, `${label}.log`);
    syncFs.writeFileSync(logPath, '', { flag: 'wx', mode: 0o600 });
    const child = fork(fileURLToPath(import.meta.url), ['--child', ...(fixture ? ['--fixture'] : [])], { cwd: root, env, silent: true });
    const state = { child, label, sourceRoot: root }; children.push(state); running = state;
    event({ kind: 'child-start', label, pid: child.pid, root, fixture });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => syncFs.appendFileSync(logPath, chunk));
    state.exit = new Promise((resolve) => child.once('close', (code, signal) => {
      state.result = { code, signal }; event({ kind: 'child-exit', label, pid: child.pid, ...state.result }); resolve(state.result);
    }));
    state.origin = await interrupted(new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Bootstrap timed out: ${label}`)), 60000);
      const clear = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', clear); };
      child.once('message', (message) => {
        clear();
        try { const url = new URL(message?.origin); assert.equal(url.hostname, '127.0.0.1'); resolve(url.origin); }
        catch (error) { reject(error); }
      });
      child.once('error', (error) => { clear(); reject(error); });
      child.once('exit', (code) => { clear(); reject(new Error(`Bootstrap exited ${code}: ${syncFs.readFileSync(logPath, 'utf8').slice(-3000)}`)); });
      abort.signal.addEventListener('abort', clear, { once: true });
    }));
    return state;
  }
  async function stop() {
    if (!running) return;
    const state = running; running = null; phase(`stop-${state.label}`);
    await stopSourcePairChild(state);
  }
  const token = (account) => {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: account, tv: 0, iat: Math.floor(Date.now() / 1000) })}`;
    return `${body}.${crypto.createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url')}`;
  };
  const request = async (account, method, route, payload, key) => {
    abort.signal.throwIfAborted();
    const id = `request-${String(++requests).padStart(4, '0')}`;
    put(`${id}-start.json`, { account, method, route, payload, key, phase: report.phase, at: new Date().toISOString() });
    try {
      const response = await fetch(running.origin + route, { method,
        headers: { authorization: `Bearer ${token(account)}`, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]) });
      const body = await response.text();
      put(`${id}-response.json`, { status: response.status, body, at: new Date().toISOString() });
      assert.equal(response.status, 200, body);
      return JSON.parse(body);
    } catch (error) { put(`${id}-failure.json`, { message: error.message, at: new Date().toISOString() }); throw error; }
  };
  async function execute(account) {
    phase(`execute-${account}`);
    checkCommandWindow(`before issuance ${account}`);
    const board = await request(account, 'GET', '/v1/commands');
    const command = board.commands.find((row) => row.commandType === 'mystery.start' && row.availability === 'AVAILABLE');
    assert(command, 'Expected ordinary issued mystery.start command');
    const key = command.executionIdentity.executionId, payload = { executionId: key, confirmed: true };
    const issued = (await interrupted(pool.query('SELECT expires_at FROM player_command_boards WHERE id=$1 AND account_id=$2', [key.split('.')[0], account]))).rows[0];
    assert(issued, 'Actual issued command board missing');
    const expiresAt = new Date(issued.expires_at).toISOString();
    if (!report.commandWindow.firstBoardExpiresAt) {
      assert.equal(expiresAt, report.commandWindow.scheduledExpiresAt, 'First issuance crossed the scheduled real window');
      assert(Date.parse(expiresAt) - Date.now() >= SOURCE_PAIR_COMMAND_WINDOW.minimumCampaignMs, 'Actual board has insufficient measured campaign margin');
      report.commandWindow.firstBoardExpiresAt = expiresAt; report.commandWindow.firstExecutionId = key;
    } else assert.equal(expiresAt, report.commandWindow.firstBoardExpiresAt, 'Later issuance crossed the actual original window');
    checkCommandWindow(`issued ${account}`);
    const graphId = command.parameters.graphId;
    const preCommandInstances = await interrupted(assertFreshMysteryStart(pool, account, graphId));
    put(`before-command-${receipts.length + 1}.json`, { account, graphId, preCommandInstances, key });
    const result = await request(account, 'POST', '/v1/commands/execute', payload, key);
    checkCommandWindow(`executed ${account}`);
    validateMysteryResult(result, key, false);
    const receipt = { account, graphId, preCommandInstances, key, payload, result };
    receipt.durable = await interrupted(assertDurableMystery(pool, receipt));
    receipts.push(receipt); update('receipts.json', receipts);
    return result;
  }
  async function replayAll(label) {
    phase(label);
    for (const receipt of receipts) {
      checkCommandWindow(`before ${label}: ${receipt.account}`);
      const result = await request(receipt.account, 'POST', '/v1/commands/execute', receipt.payload, receipt.key);
      replays.push({ label, account: receipt.account, result }); update('replays.json', replays);
      checkCommandWindow(`after ${label}: ${receipt.account}`);
      validateMysteryResult(result, receipt.key, true);
      const durable = await interrupted(assertDurableMystery(pool, { ...receipt, result }));
      assert.deepEqual(durable, receipt.durable, `${label}: durable database receipt changed`);
      for (const key of ['schemaVersion', 'executionId', 'status', 'result'])
        assert.deepEqual(result[key], receipt.result[key], `${label}: durable receipt ${key} changed`);
      assert.deepEqual(result.feedback.immediateResult, receipt.result.feedback.immediateResult, `${label}: completion feedback changed`);
    }
    report.assertions.push({ id: label, receipts: receipts.length, status: 'PASS' }); update('result.json', report);
  }
  const normalized = (snapshot) => {
    assert(running && schemas.has(running.sourceRoot), 'Missing active source schema binding');
    const value = normalizeSourcePairBootstrap(snapshot, { ...schemas.get(running.sourceRoot), predecessorSchema, candidateSchema });
    value.tables.telemetry = snapshot.tables.telemetry.filter((raw) => {
      const row = JSON.parse(raw), props = JSON.parse(row.props);
      if (row.event !== 'world_command' || props.phase !== 'completed' || props.replayed !== true) return true;
      assert(replays.some((replay) => replay.account === row.account_id && sha256(replay.result.executionId) === props.execution), 'Unexplained replay observation');
      assert.deepEqual(props.consequences, [], 'Replay telemetry must not count a new consequence'); return false;
    });
    return value;
  };
  async function snapshot(label) {
    phase(label);
    if (running) await interrupted(new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Telemetry flush timed out')), 10000);
      const clear = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', clear); };
      running.child.once('message', (message) => { clear(); message === 'flushed' ? resolve() : reject(new Error('Invalid flush response')); });
      running.child.send('flush', (error) => { if (error) { clear(); reject(error); } });
      abort.signal.addEventListener('abort', clear, { once: true });
    }));
    const raw = await interrupted(canonicalDatabaseSnapshot(pool)); put(`${label}.json`, raw);
    checkCommandWindow(`measured ${label}`);
    const value = normalized(raw), hash = sha256(canonicalJson(value));
    report.assertions.push({ id: label, stateSha256: hash, rawStateSha256: raw.stateSha256 }); update('result.json', report); return value;
  }
  const equal = (a, b, label, additive = false) => {
    const delta = sourcePairStateDifference(a, b);
    if (additive && canonicalJson(a) !== canonicalJson(b)) {
      assert(['upgrade preserves acknowledged state', 'upgrade replay creates no new effect'].includes(label), 'Additive qualification is not allowed in this phase');
      const qualified = predecessor.source === AUTONOMY_MAIN_ADDITIVE_PAIR.predecessor
        ? qualifyAutonomyMainAdditiveBootstrap(a, b, predecessor, candidate)
        : predecessor.source === FIFTH_BATCH_ADDITIVE_PAIR.predecessor
        ? qualifyFifthBatchAdditiveBootstrap(a, b, predecessor, candidate)
        : predecessor.source === COMMERCIAL_MAIN_ADDITIVE_PAIR.predecessor
        ? qualifyCommercialMainAdditiveBootstrap(a, b, predecessor, candidate)
        : predecessor.source === FOURTH_BATCH_ADDITIVE_PAIR.predecessor
        ? qualifyFourthBatchAdditiveBootstrap(a, b, predecessor, candidate)
        : predecessor.source === THIRD_BATCH_ADDITIVE_PAIR.predecessor
        ? qualifyThirdBatchAdditiveBootstrap(a, b, predecessor, candidate)
        : predecessor.source === SECOND_BATCH_ADDITIVE_PAIR.predecessor
        ? qualifySecondBatchAdditiveBootstrap(a, b, predecessor, candidate)
        : qualifyFirstFiveAdditiveBootstrap(a, b, predecessor, candidate);
      report.assertions.push({ id: label, status: 'PASS_ADDITIVE_BOOTSTRAP_ONLY', ...qualified }); update('result.json', report); return;
    }
    assert(canonicalJson(a) === canonicalJson(b), `${label}; added tables: ${delta.added.join(', ')}; removed tables: ${delta.removed.join(', ')}; changed tables: ${delta.changed.join(', ')}; changed sequences: ${delta.sequences.join(', ')}; sequence state equal: ${delta.sequenceStateEqual}`);
    report.assertions.push({ id: label, status: 'PASS' }); update('result.json', report);
  };
  try {
    assert(/^[a-f0-9]{40}$/.test(expectedPrevious || ''), '--predecessor must be a full Git SHA');
    candidate = await interrupted(sourcePairIdentity(cwd)); predecessor = await interrupted(sourcePairIdentity(previous));
    report.candidate = candidate.source; report.predecessor = predecessor.source;
    put('candidate-source.json', candidate); put('predecessor-source.json', predecessor);
    assert.equal(predecessor.source, expectedPrevious, 'Predecessor checkout mismatch');
    assert.equal(candidate.lockfileSha256, predecessor.lockfileSha256, 'This rehearsal requires identical dependency lockfiles; install and attest separate dependencies otherwise');
    const endpoint = new URL(process.env.RC1_PAIR_DATABASE_URL || '');
    assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Use a disposable loopback PostgreSQL instance');
    admin = new Pool({ connectionString: endpoint.toString(), connectionTimeoutMillis: 5000, query_timeout: 20000 });
    const database = `rc1_pair_${crypto.randomBytes(8).toString('hex')}`;
    report.database = { name: database, created: 'unknown until CREATE acknowledgement', retainedForReproduction: true };
    phase('create-database');
    await interrupted(admin.query(`CREATE DATABASE ${database}`)); report.database.created = true;
    endpoint.pathname = `/${database}`;
    pool = new Pool({ connectionString: endpoint.toString(), connectionTimeoutMillis: 5000, query_timeout: 20000 });
    env = { ...process.env, DATABASE_URL: endpoint.toString(), RC1_PAIR_CHILD: 'isolated-loopback',
      NODE_ENV: 'test', JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'),
      MOD_KEY: crypto.randomBytes(32).toString('hex'), RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'on',
      CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on',
      COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
      LIVING_WORLD_DIRECTOR: 'DIRECTOR_DISABLED', CHAIN_ENABLED: 'off' };
    for (const key of Object.keys(env)) if (/WEBHOOK|RPC_URL|PRIVATE_KEY/.test(key)) delete env[key];
    put('configuration.json', { arguments: report.arguments, candidate: candidate.source, predecessor: predecessor.source,
      database: { host: endpoint.hostname, port: endpoint.port || '5432', name: database },
      flags: Object.fromEntries(Object.entries(env).filter(([key]) =>
        ['NODE_ENV', 'RATE_LIMIT', 'SOCIAL_VERIFY_MODE', 'INVITE_MODE', 'CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL',
          'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS',
          'LIVING_WORLD_DIRECTOR', 'CHAIN_ENABLED'].includes(key))),
      secrets: 'Fresh test-only random JWT_SECRET/MARKET_SEED/MOD_KEY shared across the four processes; values omitted',
      fixture: { accounts, helper: 'predecessor test/lib/player-command-support.js:addPlayer', measuredTransitions: 'Canonical HTTP Player Commands after initial fixtures' } });
    report.postgres = (await interrupted(pool.query('SELECT version() AS version'))).rows[0].version;
    for (const [root, identity] of [[previous, predecessor], [cwd, candidate]]) {
      const schema = await fs.readFile(path.join(root, 'schema.sql'), 'utf8');
      const packageBytes = await fs.readFile(path.join(root, 'package.json'));
      assert.equal(sha256(schema), identity.inventory.find(([file]) => file === 'schema.sql')?.[1], 'Schema source bytes changed');
      assert.equal(sha256(packageBytes), identity.inventory.find(([file]) => file === 'package.json')?.[1], 'Package source bytes changed');
      schemas.set(root, { schema, appVersion: JSON.parse(packageBytes).version || '0.0.0' });
      const commandBytes = await fs.readFile(path.join(root, 'src/player-commands.js'));
      assert.equal(sha256(commandBytes), identity.inventory.find(([file]) => file === 'src/player-commands.js')?.[1], 'Command source bytes changed');
      assert(commandBytes.toString('utf8').replaceAll('\r\n', '\n').split('\n').includes('const LIFETIME_MS = 10 * 60 * 1000;'), 'Unsupported command-board lifetime source');
    }
    predecessorSchema = schemas.get(previous).schema; candidateSchema = schemas.get(cwd).schema;
    put('schema-comparison.json', { predecessor: { source: predecessor.source, schemaSha256: sha256(predecessorSchema), appVersion: schemas.get(previous).appVersion },
      candidate: { source: candidate.source, schemaSha256: sha256(candidateSchema), appVersion: schemas.get(cwd).appVersion }, normalization: report.normalization });
    await start(previous, true); await snapshot('fixture');
    phase('schedule-first-command-real-window');
    report.commandWindow = { ...await waitForSourcePairCommandWindow({
      sleep: (ms) => delay(ms, undefined, { signal: abort.signal }),
      onWait: (value) => { event({ kind: 'command-window-wait', ...value }); console.log(JSON.stringify({ phase: 'command-window-wait', waitMs: value.waitMs, remainingMs: value.remainingMs })); },
    }), checks: [] };
    update('result.json', report); await execute(accounts[0]);
    const oldCommitted = await snapshot('predecessor-committed'); await stop();
    await start(cwd); equal(oldCommitted, await snapshot('upgraded'), 'upgrade preserves acknowledged state', true);
    await replayAll('predecessor receipt after upgrade'); equal(oldCommitted, await snapshot('upgrade-replayed'), 'upgrade replay creates no new effect', true);
    await execute(accounts[1]); const newCommitted = await snapshot('candidate-committed'); await stop();
    await start(previous); equal(newCommitted, await snapshot('rolled-back'), 'rollback preserves acknowledged state');
    await replayAll('both receipts after rollback'); equal(newCommitted, await snapshot('rollback-replayed'), 'rollback replay creates no new effect'); await stop();
    await start(cwd); await replayAll('both receipts after second upgrade');
    equal(newCommitted, await snapshot('re-upgraded'), 'second upgrade preserves acknowledged state'); await stop();
    assert.deepEqual(await interrupted(sourcePairIdentity(cwd)), candidate, 'Candidate bytes changed');
    assert.deepEqual(await interrupted(sourcePairIdentity(previous)), predecessor, 'Predecessor bytes changed');
    abort.signal.throwIfAborted(); report.status = 'PASS_SCOPED';
  } catch (error) {
    failure(error);
    if (pool && !abort.signal.aborted) try { put('failure-state.json', await canonicalDatabaseSnapshot(pool)); }
    catch (captureError) { report.failureStateCaptureError = captureError.message; update('result.json', report); }
  }
  finally {
    for (const child of children) {
      try { await stopSourcePairChild(child); }
      catch (error) { report.shutdownFailures ??= []; report.shutdownFailures.push(error.message); failure(error); }
    }
    for (const connection of [pool, admin].filter(Boolean)) {
      try { assert(await waitFor(connection.end().then(() => true), 5000), 'Database close timed out'); }
      catch (error) { failure(error); }
    }
    report.children = children.map(({ label, child, result }) => ({ label, pid: child.pid, result: result || null }));
    report.endedAt = new Date().toISOString(); report.durationMs = Date.parse(report.endedAt) - Date.parse(report.startedAt);
    if (report.status === 'RUNNING') report.status = 'FAIL';
    event({ kind: 'finished', status: report.status }); update('result.json', report);
    const index = [];
    for (const file of (await fs.readdir(output)).sort()) index.push({ file, sha256: sha256(await fs.readFile(path.join(output, file))) });
    put('sha256-index.json', index);
    clearTimeout(hardStopTimer);
    for (const [signal, handler] of Object.entries(signalHandlers)) process.removeListener(signal, handler);
    console.log(JSON.stringify({ status: report.status, candidate: report.candidate, predecessor: report.predecessor, output, failure: report.failure?.message }));
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--child')) await childMain();
  else { await runSourcePair(); if (process.exitCode) process.exit(process.exitCode); }
}
