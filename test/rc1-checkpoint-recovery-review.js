import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { verifyCheckpointRecoverySources, recoveryCatalog, reviewCanonicalCheckpoint } from '../tools/rc1-checkpoint-recovery-review.js';
import { coreProgressionContent } from '../src/content/core-progression.js';

const flags = { CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on',
  COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE' };
const previous = Object.fromEntries(Object.keys(flags).map(key => [key, process.env[key]]));
Object.assign(process.env, flags); const catalog = recoveryCatalog(coreProgressionContent());
for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
const hash = value => sha256(canonicalJson(value)), clone = value => structuredClone(value);
const source = await verifyCheckpointRecoverySources({ readFile: file => fs.readFile(file), sourceRevision: '92f09bb436d9e7cacb874adb60f7238c0b1d709d' });
for (const ending of ['\n', '\r\n']) assert.deepEqual(await verifyCheckpointRecoverySources({ sourceRevision: source.sourceRevision,
  readFile: async file => (await fs.readFile(file, 'utf8')).replace(/\r?\n/g, ending) }), source);
await assert.rejects(verifyCheckpointRecoverySources({ readFile: file => file === 'src/mysteries.js' ? Buffer.from('changed') : fs.readFile(file), sourceRevision: source.sourceRevision }));
const manifest = JSON.parse(await fs.readFile('docs/release/readiness-work/scenario-manifest.json', 'utf8'));
const logicalAt = Date.parse('2026-09-24T00:00:00Z'), configurationSha256 = hash('effective isolated configuration');
const ref = path => ({ path, sha256: hash(path) });
function rows(population = 2) {
  const accounts = Array.from({ length: population }, (_, i) => ({ id: 'a' + i, status: 'active' }));
  return { accounts, account_persistent: accounts.map(row => ({ account_id: row.id })),
    characters: accounts.map((row, i) => ({ id: 'c' + i, account_id: row.id, alive: true, is_npc: false,
      name: 'Player ' + i, cash: 0, respect: 0, checkin_day: 20719, streak: 1, ammo: 25, energy: 70, speed: 3, cunning: 3,
      loc: 'docks', gta_at: null, jail_until: null })), gangs: [{ id: 'g', npc_flag: true }], gang_members: [], cars: [], crews: [], crew_members: [],
    mystery_instances: [], mystery_node_state: [], coordination_instances: [], coordination_definitions: [], operation_escrow: [], world_recipe_usage: [],
    coordination_claims: [], coordination_claim_grants: [], world_kernel_objects: [], loans: [], soldiers: [] };
}
function fixture(data) {
  const snapshot = { tables: Object.fromEntries(Object.entries(data).map(([name, entries]) => [name, entries.map(JSON.stringify).sort()])), sequences: [] };
  snapshot.stateSha256 = hash(snapshot); const checkpoint = { stateSha256: snapshot.stateSha256, configurationSha256, logicalAt };
  const binding = { sourceRevision: source.sourceRevision, ...checkpoint };
  const diagnostics = { logicalAt, objectiveInventory: { tablesComplete: true, subjects: [
    ...data.mystery_instances.map(row => ({ type: 'mystery', id: row.id })), ...data.coordination_instances.map(row => ({ type: 'discovery', id: row.id }))] },
    coordination: { lifecycle: { complete: true, structuralOrphanOperations: 0 } } };
  return { manifest, source, checkpoint, snapshot, diagnostics, diagnosticEvidence: { ...ref('diagnostics.json'), binding, contentSha256: hash(diagnostics) },
    roster: data.accounts.map(row => row.id), catalog,
    configurationEvidence: { binding: { sourceRevision: source.sourceRevision, configurationSha256 }, coreProgression: true,
      coordination: true, knowledge: true, sharing: true, unrestrictedCohort: true },
    inventoryEvidence: ref('inventories.json'), reviewEvidence: ref('source-review.json') };
}
const data = rows();
data.mystery_instances.push({ id: 'm1', graph_id: 'furnace-archive-inspection', graph_version: 1, owner_scope: 'character',
  definition_hash: catalog.graphs.find(row => row.id === 'omerta.coordination.furnace-archive').nodes.find(row => row.id === 'manifest-source').admission[0].requirement.definitionHash,
  owner_id: 'c0', authority_account_id: 'a0', status: 'active' });
for (const [id, graphId, owner] of [['d1', 'omerta.coordination.canal-register', '0'], ['d2', 'omerta.coordination.informant-review', '1']]) {
  const graph = catalog.graphs.find(row => row.id === graphId); const { contentHash, ...definition } = graph;
  data.coordination_definitions.push({ graph_id: graph.id, graph_version: graph.version, content_hash: contentHash, definition_json: JSON.stringify(definition) });
  data.coordination_instances.push({ id, graph_id: graph.id, graph_version: graph.version, content_hash: contentHash, owner_account_id: 'a' + owner,
    owner_character_id: 'c' + owner, revision: 0, status: 'active', state_json: '{"discovered":[],"completed":[]}' });
}
const input = fixture(data), unchanged = JSON.stringify(input.snapshot), reviewed = reviewCanonicalCheckpoint(input);
assert.equal(JSON.stringify(input.snapshot), unchanged, 'Observer changed native state');
assert.deepEqual(reviewed.joined.assertions.map(row => row.status), ['SATISFIED', 'SATISFIED', 'SATISFIED', 'SATISFIED', 'UNKNOWN']);
assert.equal(reviewed.joined.permanentDeadlocks, null);
assert.equal(reviewed.matrixQualifying, false);
assert(reviewed.details.some(row => row.id === 'resource:a0:item:furnace_archive_key' && row.status === 'REACHABLE'));
assert(reviewed.details.some(row => row.id === 'shared-canal-path' && row.ok));
for (const mutate of [
  changed => changed.mystery_instances[0].authority_account_id = 'a1',
  changed => changed.operation_escrow.push({ operation_id: 'm1', item_id: 'held' }),
  changed => changed.coordination_definitions[0].definition_json = '{}',
  changed => changed.coordination_instances[0].revision = 2147483647,
]) {
  const changed = clone(data); mutate(changed); assert.equal(reviewCanonicalCheckpoint(fixture(changed)).joined.scopes.objectives.status, 'UNKNOWN');
}
{
  const changed = clone(data); changed.world_recipe_usage.push({ recipe_id: 'recipe:furnace_archive_key', scope: 'global', period_kind: 'lifetime', used: 64 });
  const result = reviewCanonicalCheckpoint(fixture(changed)); assert.equal(result.joined.scopes.resources.status, 'UNKNOWN');
  assert.equal(result.joined.scopes.objectives.status, 'SATISFIED', 'Optional exhausted completion must retain legal retirement');
}
{
  const changed = fixture(data); changed.configurationEvidence.knowledge = false;
  assert.equal(reviewCanonicalCheckpoint(changed).joined.scopes.knowledge.status, 'UNKNOWN');
  changed.configurationEvidence.binding.configurationSha256 = hash('other'); assert.throws(() => reviewCanonicalCheckpoint(changed));
}
for (const population of [25, 50, 100, 250, 1000]) {
  const result = reviewCanonicalCheckpoint(fixture(rows(population)));
  assert.equal(result.inventories.actors.obligations.length, population);
  assert.equal(result.inventories.family.obligations.length, population);
  assert.equal(result.joined.scopes.actors.status, 'SATISFIED');
}
{
  const changed = clone(data);
  changed.coordination_claims = Array.from({ length: 1000 }, (_, index) => ({ id: 'unrelated-' + index, owner_account_id: 'other-' + index,
    content_hash: 'other-content', domain: 'other', proposition: 'other', source_root: 'other' }));
  assert.equal(reviewCanonicalCheckpoint(fixture(changed)).joined.scopes.knowledge.status, 'SATISFIED', 'Global claim count is not an account candidate cap');
  const graph = catalog.graphs.find(row => row.id === 'omerta.coordination.informant-review');
  for (let index = 0; index < 257; index++) changed.coordination_claims.push({ id: 'visible-' + index, owner_account_id: 'a1', content_hash: graph.contentHash,
    domain: graph.nodes.find(node => node.claim).claim.domain, proposition: graph.nodes.find(node => node.claim).claim.proposition,
    source_root: graph.nodes.find(node => node.claim).claim.sourceRoot });
  assert.equal(reviewCanonicalCheckpoint(fixture(changed)).joined.scopes.knowledge.status, 'UNKNOWN', 'Actual actor-visible batch bound must remain enforced');
  changed.coordination_claims.forEach(row => { row.domain = 'unrelated-query'; });
  assert.equal(reviewCanonicalCheckpoint(fixture(changed)).joined.scopes.knowledge.status, 'SATISFIED', 'Same-graph unrelated queries do not consume the evidence union');
}
{
  const changed = clone(data); changed.characters.forEach(row => row.heat = 95);
  assert.equal(reviewCanonicalCheckpoint(fixture(changed)).joined.scopes.knowledge.status, 'UNKNOWN', 'Law liabilities need their own recovery path');
  const closure = fixture(data); closure.catalog = clone(catalog); closure.catalog.nodes[0].version++;
  assert.equal(reviewCanonicalCheckpoint(closure).catalogApplicable, false);
}
{
  const changed = clone(data), graph = catalog.graphs.find(row => row.id === 'omerta.coordination.furnace-archive');
  changed.coordination_instances.push({ id: 'closed-furnace', graph_id: graph.id, graph_version: graph.version, content_hash: graph.contentHash,
    owner_account_id: 'a0', owner_character_id: 'c0', revision: 0, status: 'cancelled', state_json: '{"discovered":[],"completed":[]}' });
  const result = reviewCanonicalCheckpoint(fixture(changed));
  assert.equal(result.witnesses.find(row => row.id === 'resource:a0:item:furnace_archive_key').status, 'UNKNOWN', 'Fresh recipe cannot bypass a closed source graph');
}
{
  const changed = clone(data), objectId = 'infrastructure:canal_supply_depot';
  const definitionHash = catalog.nodes.flatMap(node => node.conditions || []).find(condition => condition.requirement?.objectId === objectId).requirement.definitionHash;
  changed.world_kernel_objects.push({ id: objectId, definition_hash: definitionHash, state: 'market_open' });
  const result = reviewCanonicalCheckpoint(fixture(changed)), path = result.details.find(row => row.id === 'shared-canal-path');
  assert(path.ok); assert.equal(path.path.filter(row => row.startsWith('Family operation ')).length, 1);
  assert(path.path.some(row => row.includes('Family operation expose_market')));
}
console.log('PASS rc1-checkpoint-recovery-review: exact native checkpoint/configuration/source joins; owner/definition/revision/custody recovery; original material/Knowledge prerequisites; unknown preservation; all5 populations; no native world run');
