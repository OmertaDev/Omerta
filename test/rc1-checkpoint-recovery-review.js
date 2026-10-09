import { WORLD_RECOVERY_REVIEW } from '../tools/rc1-world-qualification.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { CHECKPOINT_RECOVERY_REVIEW, verifyCheckpointRecoverySources, recoveryCatalog, historicalRecoveryCatalog,
  reviewCanonicalCheckpoint } from '../tools/rc1-checkpoint-recovery-review.js';
import { CITY_SOURCE_CURRENT_PINS, CITY_SOURCE_PREDECESSOR_PINS, assertCitySourceTransfer } from '../tools/rc1-deed-source-compatibility.js';
import { coreProgressionContent } from '../src/content/core-progression.js';

const flags = { CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on',
  COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE' };
const previous = Object.fromEntries(Object.keys(flags).map(key => [key, process.env[key]]));
Object.assign(process.env, flags); const catalog = recoveryCatalog(coreProgressionContent());
for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
const hash = value => sha256(canonicalJson(value)), clone = value => structuredClone(value);
const source = await verifyCheckpointRecoverySources({ readFile: file => fs.readFile(file), sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision });
for (const ending of ['\n', '\r\n']) assert.deepEqual(await verifyCheckpointRecoverySources({ sourceRevision: source.sourceRevision,
  readFile: async file => (await fs.readFile(file, 'utf8')).replace(/\r?\n/g, ending) }), source);
await assert.rejects(verifyCheckpointRecoverySources({ readFile: file => file === 'src/mysteries.js' ? Buffer.from('changed') : fs.readFile(file), sourceRevision: source.sourceRevision }));
const extensionFiles = ['src/mysteries.js', 'src/crafting.js', 'src/routes/worldgraph.js'];
assert.deepEqual(CHECKPOINT_RECOVERY_REVIEW.citySourceReviewTransfer.sourcePins,
  Object.fromEntries(extensionFiles.map(file => [file, CITY_SOURCE_CURRENT_PINS[file]])));
assert.deepEqual(CHECKPOINT_RECOVERY_REVIEW.citySourceReviewTransfer.predecessorPins,
  Object.fromEntries(extensionFiles.map(file => [file, CITY_SOURCE_PREDECESSOR_PINS[file]])));
assert.match(CHECKPOINT_RECOVERY_REVIEW.citySourceReviewTransfer.scope, /New GUI, RPG and exploration authority or reachability.*not inherited/);
const sourceTexts = Object.fromEntries(await Promise.all(extensionFiles.map(async file =>
  [file, (await fs.readFile(file, 'utf8')).replaceAll('\r\n', '\n')])));
for (const [file, before, after] of [
  ['src/mysteries.js', 'row.account_id !== context.accountId', 'false'],
  ['src/mysteries.js', 'existing.choice_id !== choiceId', 'false'],
  ['src/mysteries.js', "!['public', 'role_private'].includes(node.visibility)", "node.visibility !== 'public'"],
  ['src/mysteries.js', "action: 'explore', graph: graphIdentity(authority.pkg)", "action: 'complete', graph: graphIdentity(authority.pkg)"],
  ['src/mysteries.js', 'const instance = await lockedActionInstance(client, authority, context);', 'const instance = authority.instance;'],
  ['src/mysteries.js', 'export async function exploreMystery(', 'export async function exploreUnreviewedMystery('],
  ['src/crafting.js', 'actor.character.id !== h.expectedCharacterId', 'false'],
  ['src/crafting.js', 'actor.character.cash < cashCost', 'false'],
  ['src/crafting.js', 'recipeScarcityAvailable(client, recipe, context, asOf)', 'Promise.resolve(true)'],
  ['src/crafting.js', 'await reserveRecipeScarcity(client, recipe, actor, asOf);', '// removed scarcity mutation guard'],
  ['src/crafting.js', 'normalized.listed || normalized.pledged || normalized.mintedOnchain', 'false'],
  ['src/crafting.js', "blocker.adapter === 'discovery'", 'false'],
  ['src/crafting.js', "available: entry.available, blockedBy: entry.blockedBy", 'available: true, blockedBy: []'],
  ['src/routes/worldgraph.js', "return { scope: 'character', id: row.id };", "return { scope: 'account', id: accountId };"],
  ['src/routes/worldgraph.js', "app.post('/v1/worldgraph/mysteries/:graphId/explore', mutationOptions(auth)", "app.get('/v1/worldgraph/mysteries/:graphId/explore', mutationOptions(auth)"],
  ['src/routes/worldgraph.js', "app.post('/v1/worldgraph/mysteries/:graphId/explore', mutationOptions(auth)", "app.post('/v1/worldgraph/mysteries/:graphId/explore', mutationOptions(null)"],
  ['src/routes/worldgraph.js', "app.post('/v1/worldgraph/mysteries/:graphId/cancel', mutationOptions(auth, MYSTERY_CANCEL_BODY)", "app.post('/v1/worldgraph/mysteries/:graphId/cancel', mutationOptions(null, MYSTERY_CANCEL_BODY)"],
  ['src/routes/worldgraph.js', "innerIdempotencyKey(req.user.sub, req.headers['idempotency-key'])", "innerIdempotencyKey(req.user.sub, 'fixed-key')"],
]) {
  const text = sourceTexts[file], changed = text.replace(before, after);
  assert.notEqual(changed, text, 'Negative control must alter real owner, choice, recipe, exploration or route bytes: ' + before);
  assert.throws(() => assertCitySourceTransfer(file, changed), /source changed/);
  await assert.rejects(verifyCheckpointRecoverySources({ sourceRevision: source.sourceRevision,
    readFile: candidate => candidate === file ? changed : fs.readFile(candidate) }), /source changed/);
}
for (const file of extensionFiles) {
  const text = sourceTexts[file];
  assert.throws(() => assertCitySourceTransfer(file, text + '\n// unsupported authority change\n'), /source changed/);
}
{
  const file = 'src/mysteries.js', text = sourceTexts[file];
  const start = text.indexOf('export async function exploreMystery(');
  const end = text.indexOf('/** Read a safe board.', start);
  assert(start > 0 && end > start);
  const block = text.slice(start, end);
  assert.throws(() => assertCitySourceTransfer(file, text.replace(block, block + block)), /source changed/);
}
const historicalCatalog = historicalRecoveryCatalog(catalog);
assert.equal(hash(catalog), CHECKPOINT_RECOVERY_REVIEW.cityCatalogTransfer.actualSha256);
assert.equal(hash(historicalCatalog), CHECKPOINT_RECOVERY_REVIEW.catalogSha256,
  'Exact additive City catalog inverse retains the complete independently reviewed historical catalog hash.');
assert.equal(catalog.nodes.length - historicalCatalog.nodes.length, 9);
assert.equal(hash(catalog.nodes.filter(node => node.packageId === 'neighborhood-initiation')),
  CHECKPOINT_RECOVERY_REVIEW.cityCatalogTransfer.addedNodesSha256);
assert.equal(historicalRecoveryCatalog(historicalCatalog), historicalCatalog);
assert(!historicalCatalog.nodes.some(node => node.packageId === 'neighborhood-initiation'));
assert.equal(hash(catalog), CHECKPOINT_RECOVERY_REVIEW.cityCatalogTransfer.actualSha256,
  'The catalog inverse must not mutate the current content catalog.');
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
{
  const historical = fixture(data); historical.catalog = historicalCatalog;
  assert.deepEqual(reviewCanonicalCheckpoint(historical).joined, reviewed.joined,
    'The exact City catalog inverse preserves all prior reviewed original subjects.');
  const changed = clone(data);
  changed.mystery_instances.push({ id: 'new-rpg', graph_id: 'neighborhood-initiation', graph_version: 1,
    owner_scope: 'character', owner_id: 'c0', authority_account_id: 'a0', status: 'active' });
  const result = reviewCanonicalCheckpoint(fixture(changed));
  assert.equal(result.witnesses.find(row => row.id === 'mystery:new-rpg').status, 'UNKNOWN');
  assert.match(result.details.find(row => row.id === 'mystery:new-rpg').reason, /outside the historical sufficient-path review/);
  for (const scope of ['objectives', 'resources', 'knowledge']) assert.equal(result.joined.scopes[scope].status, 'UNKNOWN',
    'New RPG authority cannot inherit historical ' + scope + ' coverage.');
  assert.equal(result.witnesses.find(row => row.id === 'mystery:m1').status, 'REACHABLE');
}
for (const mutate of [
  changed => changed.nodes.find(node => node.packageId === 'neighborhood-initiation').metadata.description = 'tampered dialogue',
  changed => changed.nodes.push(clone(changed.nodes.find(node => node.packageId === 'neighborhood-initiation'))),
  changed => changed.nodes.push({ ...clone(changed.nodes[0]), id: 'unreviewed:node', packageId: 'unreviewed-package' }),
  changed => changed.nodes[0].version++,
  changed => changed.operations.push({ id: 'unreviewed-operation' }),
]) {
  const changed = clone(catalog); mutate(changed);
  assert.notEqual(hash(changed), hash(catalog));
  assert.equal(historicalRecoveryCatalog(changed), changed, 'Unfamiliar catalogs must not receive a partial allowlist inverse.');
  const input = fixture(data); input.catalog = changed;
  const result = reviewCanonicalCheckpoint(input);
  assert.equal(result.catalogApplicable, false);
  assert.equal(result.joined.scopes.knowledge.status, 'UNKNOWN', 'Unreviewed content remains outside sufficient-path coverage.');
}
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
  const result = reviewCanonicalCheckpoint(fixture(changed)); assert.equal(result.joined.scopes.resources.status, 'SATISFIED');
  assert(result.supplemental.results.some(row => row.scope === 'resources' && row.status === 'UNKNOWN'));
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
  assert(reviewCanonicalCheckpoint(fixture(changed)).supplemental.results.some(row => row.scope === 'knowledge' && row.status === 'UNKNOWN'), 'Actual actor-visible batch bound must remain enforced for the applicable optional branch');
  changed.coordination_claims.forEach(row => { row.domain = 'unrelated-query'; });
  assert.equal(reviewCanonicalCheckpoint(fixture(changed)).joined.scopes.knowledge.status, 'SATISFIED', 'Same-graph unrelated queries do not consume the evidence union');
}
{
  const changed = clone(data); changed.characters.forEach(row => row.heat = 95);
  assert(reviewCanonicalCheckpoint(fixture(changed)).supplemental.results.some(row => row.scope === 'knowledge' && row.status === 'UNKNOWN'), 'Optional quiet-progression paths need current Law disposition');
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
{
  const changed = rows(100);
  changed.mystery_instances = changed.accounts.map((account, index) => ({ ...data.mystery_instances[0], id: 'm' + index,
    owner_id: 'c' + index, authority_account_id: account.id }));
  const result = reviewCanonicalCheckpoint(fixture(changed));
  assert.equal(result.joined.scopes.resources.status, 'SATISFIED', 'Legal retirement does not demand100 optional fresh keys against the global64 cap');
  assert.equal(result.joined.scopes.knowledge.status, 'SATISFIED');
  assert(result.supplemental.results.some(row => row.scope === 'resources' && row.status === 'UNKNOWN'), 'Optional scarce paths remain visibly unproved');
  const full = rows(); full.coordination_claims = Array.from({ length: 2048 }, (_, i) => ({ id: 'owned-' + i, owner_account_id: 'a0' }));
  assert.equal(reviewCanonicalCheckpoint(fixture(full)).joined.scopes.knowledge.status, 'UNKNOWN', 'Actual owned issuance bound is not waived');
}
console.log('PASS rc1-checkpoint-recovery-review: exact source and catalog inverses; owner/choice/exploration/recipe/route tamper rejection; new RPG UNKNOWN boundary; native checkpoint/configuration joins; original material/Knowledge prerequisites; all5 populations; no native world run');
