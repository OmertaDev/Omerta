import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertDeedServerCompatibility, assertHttpReceiptServerCompatibility, DEED_SERVER_BASELINE_PIN,
  DEED_SERVER_CURRENT_PIN, HTTP_RECEIPT_SERVER_PIN, HTTP_RECEIPT_HELPER_PIN } from '../tools/rc1-deed-source-compatibility.js';
import { assertGenesisWrapperServerCompatibility, GENESIS_SERVER_WRAPPER_PIN,
  GENESIS_SERVER_WRAPPER_SOURCE_REVISION, assertGenesisSnapshotServerCompatibility,
  GENESIS_SNAPSHOT_SERVER_PIN, GENESIS_SNAPSHOT_MODULE_PINS,
  GENESIS_SNAPSHOT_REVIEWED_REVISION } from '../tools/rc1-deed-source-compatibility.js';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { verifyWorldRecoverySources, canonicalRecoveryWitnesses, joinWorldCheckpointAssertions,
  evaluateWorldDuration, WORLD_RECOVERY_REVIEW, WORLD_DURATION_CANDIDATES } from '../tools/rc1-world-qualification.js';

const hash = value => sha256(canonicalJson(value)), clone = value => structuredClone(value), DAY = 86400000;
const serverText = (await fs.readFile('src/server.js', 'utf8')).replaceAll('\r\n', '\n');
const serverProof = assertDeedServerCompatibility(serverText);
assert.equal(serverProof.actualSha256, GENESIS_SNAPSHOT_SERVER_PIN);
const snapshotProof = assertGenesisSnapshotServerCompatibility(serverText);
assert.equal(sha256(snapshotProof.priorText), GENESIS_SERVER_WRAPPER_PIN);
assert.equal(snapshotProof.snapshotModuleTransfer.inverseChunks, 1);
assert.equal(snapshotProof.snapshotModuleTransfer.publicGetRoutes, 1);
assert.equal(snapshotProof.snapshotModuleTransfer.sourceRevision, GENESIS_SNAPSHOT_REVIEWED_REVISION);
assert.equal(assertGenesisSnapshotServerCompatibility(snapshotProof.priorText).snapshotModuleTransfer, null);
const snapshotRoute = "  app.get('/genesis-snapshot-rpc.js', reviewedModule('genesis-snapshot-rpc.js'));\n";
assert.equal(serverText.split(snapshotRoute).length, 2);
for (const changed of [serverText.replace(snapshotRoute, snapshotRoute + snapshotRoute),
  serverText.replace(snapshotRoute, snapshotRoute.replace('app.get(', 'app.post(')),
  serverText.replace(snapshotRoute, snapshotRoute.replace("reviewedModule('genesis-snapshot-rpc.js')", "reviewedModule(req.query.path)")),
  serverText.replace(".header('cache-control', 'no-store').send(code)", ".header('cache-control', 'public').send(code)")]) {
  assert.notEqual(changed, serverText);
  assert.throws(() => assertGenesisSnapshotServerCompatibility(changed), /source changed/);
}
const wrapperProof = assertGenesisWrapperServerCompatibility(serverText);
assert.equal(sha256(wrapperProof.priorText), HTTP_RECEIPT_SERVER_PIN);
assert.equal(wrapperProof.genesisWrapperTransfer.inverseChunks, 3);
assert.equal(wrapperProof.genesisWrapperTransfer.publicGetRoutes, 12);
assert.equal(wrapperProof.genesisWrapperTransfer.sourceRevision, GENESIS_SERVER_WRAPPER_SOURCE_REVISION);
for (const changed of [
  serverText.replace('  registerGenesisAuction(app, { auth });', '  registerGenesisAuction(app, { auth: null });'),
  serverText.replace("app.get('/genesis-deploy.html', genesisdeployPage);", "app.get('/unreviewed', genesisdeployPage);"),
  serverText.replace("import { register as registerGenesisAuction } from './routes/genesisauction.js';", ''),
  serverText.replace('  registerGenesisAuction(app, { auth });', '  registerGenesisAuction(app, { auth });\n  registerGenesisAuction(app, { auth });'),
  serverText + '\n// unrelated server change\n',
]) assert.throws(() => assertGenesisWrapperServerCompatibility(changed), /source changed/);
const receiptProof = assertHttpReceiptServerCompatibility(serverText);
assert.equal(assertDeedServerCompatibility(receiptProof.priorText).actualSha256, DEED_SERVER_CURRENT_PIN);
assert.equal(assertDeedServerCompatibility(serverProof.baselineText).actualSha256, DEED_SERVER_BASELINE_PIN);
assert.throws(() => assertDeedServerCompatibility(serverText.replace("app.post('/v1/deeds/upgrade', { preHandler: auth }", "app.post('/v1/deeds/upgrade', { preHandler: null }")), /source changed/);
assert.throws(() => assertDeedServerCompatibility(serverProof.baselineText + "\napp.post('/unsupported', async () => ({}));\n"), /source changed/);
const source = await verifyWorldRecoverySources({ readFile: file => fs.readFile(file), sourceRevision: WORLD_RECOVERY_REVIEW.reviewedRevision });
assert.equal(source.sourceFiles['src/server.js'], GENESIS_SNAPSHOT_SERVER_PIN);
assert.equal(source.sourceFiles['src/http-idempotency.js'], HTTP_RECEIPT_HELPER_PIN);
assert.equal(WORLD_RECOVERY_REVIEW.version, 5);
assert.equal(WORLD_RECOVERY_REVIEW.genesisSnapshotSourceTransfer.predecessorServerSha256, GENESIS_SERVER_WRAPPER_PIN);
for (const [file, pin] of Object.entries(GENESIS_SNAPSHOT_MODULE_PINS)) {
  assert.equal(source.sourceFiles[file], pin, 'Actual reviewed genesis module digest must be attested');
  const text = await fs.readFile(file, 'utf8');
  await assert.rejects(verifyWorldRecoverySources({ sourceRevision: source.sourceRevision,
    readFile: async candidate => candidate === file ? text + '\n// unreviewed module drift\n' : fs.readFile(candidate) }), /source changed/);
}
for (const [file, before, after] of [
  ['src/routes/genesisauction.js', 'auth ? { preHandler: auth } : {}', 'auth ? { preHandler: null } : {}'],
  ['public/genesis-snapshot-rpc.js', "'eth_call'", "'eth_sendRawTransaction'"],
  ['public/genesis-snapshot-rpc.js', 'requireCanonical: true', 'requireCanonical: false'],
  ['src/genesisrpc.js', 'resolved.request(args, ...rest)', 'resolved.request({ method: "eth_sendRawTransaction" }, ...rest)']]) {
  const text = await fs.readFile(file, 'utf8'); assert(text.includes(before));
  await assert.rejects(verifyWorldRecoverySources({ sourceRevision: source.sourceRevision,
    readFile: async candidate => candidate === file ? text.replace(before, after) : fs.readFile(candidate) }), /source changed/);
}
assert.equal(WORLD_RECOVERY_REVIEW.genesisWrapperSourceTransfer.predecessorServerSha256, HTTP_RECEIPT_SERVER_PIN);
for (const [before, after] of [['row.response === reservationToken', 'true'],
  ['if (row.status === 0) req._idem', 'if (true) req._idem'],
  ["preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => G.checkin", "preHandler: null }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => G.checkin"]]) {
  assert(serverText.includes(before), 'Mutation must target an actual server guard');
  assert.throws(() => assertDeedServerCompatibility(serverText.replace(before, after)), /source changed/);
}
const receiptHelper = await fs.readFile('src/http-idempotency.js', 'utf8');
for (const [before, after] of [['AND response=$6', ''], ['attempt < 3', 'attempt < 30'], ['!isDbDown(error)', 'false']]) {
  assert(receiptHelper.includes(before));
  await assert.rejects(verifyWorldRecoverySources({ sourceRevision: source.sourceRevision,
    readFile: async file => file === 'src/http-idempotency.js' ? receiptHelper.replace(before, after) : fs.readFile(file) }), /source changed/);
}
const carCatalog = await fs.readFile('src/rules.generated.js', 'utf8');
assert(carCatalog.includes('melt: 28, val: 900'), 'Car value rejection control must modify an actual car catalog row');
await assert.rejects(verifyWorldRecoverySources({ sourceRevision: source.sourceRevision,
  readFile: async file => file === 'src/rules.generated.js' ? carCatalog.replace('melt: 28, val: 900', 'melt: 28, val: 901') : fs.readFile(file) }), /source changed/);
for (const ending of ['\n', '\r\n']) assert.deepEqual(await verifyWorldRecoverySources({ sourceRevision: source.sourceRevision,
  readFile: async file => (await fs.readFile(file, 'utf8')).replace(/\r?\n/g, ending) }), source);
for (const changedFile of ['src/game.js', 'src/server.js']) await assert.rejects(verifyWorldRecoverySources({ sourceRevision: source.sourceRevision,
  readFile: async file => file === changedFile ? Buffer.from('changed source') : fs.readFile(file) }), /source changed/);
const manifest = JSON.parse(await fs.readFile('docs/release/readiness-work/scenario-manifest.json', 'utf8'));
assert.deepEqual(manifest.deadWorldAssertions, WORLD_RECOVERY_REVIEW.assertions);
const evidence = path => ({ path, sha256: hash(path) }), configurationSha256 = hash('test configuration');
const logicalAt = Date.parse('2026-09-24T12:00:00Z'), today = Math.floor(logicalAt / DAY);
const data = { accounts: [{ id: 'a', status: 'active' }], account_persistent: [{ account_id: 'a' }],
  characters: [{ id: 'c', account_id: 'a', alive: true, is_npc: false, cash: 0, ammo: 0, respect: 0, streak: 1,
    checkin_day: today, jail_until: new Date(logicalAt + DAY).toISOString() }], gangs: [], gang_members: [] };
function fixture(rows = data) {
  const snapshot = { tables: Object.fromEntries(Object.entries(rows).map(([table, values]) => [table, values.map(value => JSON.stringify(value)).sort()])), sequences: [] };
  snapshot.stateSha256 = hash(snapshot);
  return { source, checkpoint: { stateSha256: snapshot.stateSha256, configurationSha256, logicalAt }, snapshot, roster: ['a'],
    resourceRequirements: [{ id: 'ammo-prerequisite', accountId: 'a', resource: 'ammo', quantity: 50, goal: 'ammo>=50' },
      { id: 'omr-prerequisite', accountId: 'a', resource: 'omr', quantity: 1, goal: 'omr>=1' }] };
}
const input = fixture(), first = canonicalRecoveryWitnesses(input), byId = id => first.witnesses.find(row => row.id === id);
const historicalSource = clone(input);
historicalSource.source.sourceFiles['src/server.js'] = DEED_SERVER_CURRENT_PIN;
delete historicalSource.source.sourceFiles['src/http-idempotency.js'];
assert.throws(() => canonicalRecoveryWitnesses(historicalSource),
  'Historical source attestations cannot be relabeled as the receipt review');
const historicalReview = clone(input); historicalReview.source.reviewSha256 = '0'.repeat(64);
assert.throws(() => canonicalRecoveryWitnesses(historicalReview),
  'Historical review identities cannot inherit the current receipt review');
assert.equal(byId('actor:a').status, 'BOUNDED_WAIT'); assert.equal(byId('actor:a').dueAt, (today + 1) * DAY);
assert.equal(byId('ammo-prerequisite').status, 'UNKNOWN', 'Repeated faucet availability does not prove savings through unavoidable intervening losses');
assert.equal(byId('family:a').status, 'UNKNOWN'); assert.equal(byId('omr-prerequisite').status, 'UNKNOWN');
assert.equal(first.matrixQualifying, false);
const altered = clone(input); altered.snapshot.tables.characters[0] += ' '; assert.throws(() => canonicalRecoveryWitnesses(altered));

for (const kind of ['vacancy', 'npc-vacancy', 'member', 'formation', 'characterless']) {
  const rows = clone(data);
  if (['vacancy', 'npc-vacancy', 'member'].includes(kind)) rows.gangs.push({ id: 'g', npc_flag: kind === 'npc-vacancy', name: 'Existing', tag: 'EX' });
  if (kind === 'member') rows.gang_members.push({ character_id: 'c', gang_id: 'g' });
  if (kind === 'formation') { rows.characters[0].cash = 25000; rows.characters[0].respect = 160; }
  if (kind === 'characterless') rows.characters[0].alive = false;
  const witnesses = canonicalRecoveryWitnesses(fixture(rows)).witnesses, family = witnesses.find(row => row.scope === 'family');
  assert.equal(family.status, kind === 'characterless' ? 'UNKNOWN' : 'REACHABLE');
  if (kind === 'member') assert.equal(family.canonicalActions[0].path, '/v1/gangs/leave');
  if (kind === 'npc-vacancy') assert.equal(family.canonicalActions[0].path, '/v1/gangs/g/join');
  if (kind === 'formation') assert.equal(family.canonicalActions[0].path, '/v1/gangs');
  if (kind === 'formation') assert.equal(witnesses.find(row => row.id === 'ammo-prerequisite').canonicalActions.at(-1).path, '/v1/armory/ammo');
}
{
  const rows = clone(data); rows.gangs = [{ id: 'g', npc_flag: false, tag: 'FULL', name: 'Full' }];
  rows.gang_members = Array.from({ length: 20 }, (_, index) => ({ gang_id: 'g', character_id: 'other-' + index }));
  assert.equal(canonicalRecoveryWitnesses(fixture(rows)).witnesses.find(row => row.scope === 'family').status, 'UNKNOWN');
  rows.characters[0].checkin_day = today + 1;
  assert.equal(canonicalRecoveryWitnesses(fixture(rows)).witnesses.find(row => row.scope === 'actors').status, 'UNKNOWN');
}

function joinFixture() {
  const bound = { sourceRevision: source.sourceRevision, ...input.checkpoint };
  const diagnostics = { logicalAt, objectiveInventory: { tablesComplete: true, subjects: [{ type: 'operation', id: 'op1' }] },
    coordination: { lifecycle: { complete: true, structuralOrphanOperations: 0, recoveryRequiredOperationIds: ['op1'] } } };
  const inventories = Object.fromEntries(['actors', 'resources', 'objectives', 'family', 'knowledge'].map(scope => [scope, {
    binding: bound, complete: true, evidence: evidence('enumeration-' + scope), obligations: [],
  }]));
  inventories.actors.obligations = [{ id: 'actor:a', goal: 'meaningful-action-or-legal-wait' }];
  inventories.resources.obligations = [{ id: 'ammo-prerequisite', goal: 'ammo>=50' }];
  inventories.family.obligations = [{ id: 'family:a', goal: 'family-access-or-legal-exit' }];
  inventories.objectives.obligations = [{ id: 'operation:op1', goal: 'operation.completed-or-custody-recovered' }];
  const native = (id, scope, goal) => ({ ...bound, id, scope, goal, status: 'REACHABLE', method: 'source-pinned-review', evidence: evidence(id) });
  return { manifest, source, checkpoint: input.checkpoint, diagnostics, roster: ['a'], inventories,
    diagnosticEvidence: { ...evidence('world-diagnostics.json'), binding: bound, contentSha256: hash(diagnostics) },
    witnesses: [...first.witnesses.filter(row => row.scope === 'actors'), native('ammo-prerequisite', 'resources', 'ammo>=50'),
      native('family:a', 'family', 'family-access-or-legal-exit'), native('operation:op1', 'objectives', 'operation.completed-or-custody-recovered')],
    lifecycleWindows: { sourceRevision: source.sourceRevision, configurationSha256, backlogStatus: 'SATISFIED', finalCheckpoint: input.checkpoint } };
}
{
  const join = joinFixture(), result = joinWorldCheckpointAssertions(join);
  assert(result.complete); assert.equal(result.permanentDeadlocks, 0); assert.equal(result.matrixQualifying, false);
  delete join.inventories.knowledge; const unknown = joinWorldCheckpointAssertions(join);
  assert(!unknown.complete && unknown.permanentDeadlocks === null); assert.equal(unknown.assertions[3].status, 'UNKNOWN');
}
for (const change of [
  value => { value.inventories.objectives.obligations = []; },
  value => { value.witnesses.at(-1).id = 'operation:another'; value.inventories.objectives.obligations[0].id = 'operation:another'; },
  value => { value.witnesses.at(-1).goal = 'operation.completed'; },
  value => { value.witnesses.at(-1).stateSha256 = hash('different snapshot'); },
  value => { value.diagnostics.objectiveInventory.subjects = []; },
  value => { value.witnesses.push(clone(value.witnesses[0])); },
]) {
  const join = joinFixture(); change(join); assert.throws(() => joinWorldCheckpointAssertions(join));
}
{
  const join = joinFixture(); join.witnesses.pop(); const result = joinWorldCheckpointAssertions(join);
  assert.equal(result.assertions[2].status, 'UNKNOWN'); assert.equal(result.permanentDeadlocks, null);
  join.diagnostics.coordination.lifecycle.structuralOrphanOperations = 1;
  join.diagnosticEvidence.contentSha256 = hash(join.diagnostics);
  assert.equal(joinWorldCheckpointAssertions(join).assertions[2].status, 'FAILED');
}

function durationFixture() {
  const startAt = 0, endAt = 180 * DAY, bound = { sourceRevision: source.sourceRevision, configurationSha256 };
  const lifecycles = WORLD_DURATION_CANDIDATES.map(row => ({ ...row,
    applicability: ['season', 'stake-lock-quarter'].includes(row.id) ? 'APPLICABLE' : 'NOT_APPLICABLE',
    applicabilityEvidence: evidence('applicability-' + row.id) }));
  const windows = [0, 1].map(index => ({ fromLogicalAt: index * 90 * DAY, throughLogicalAt: (index + 1) * 90 * DAY,
    checkpoint: { stateSha256: hash('window-' + index), configurationSha256, logicalAt: (index + 1) * 90 * DAY },
    complete: true, unresolvedBacklog: 0, liveStateOrphans: 0, evidence: evidence('window-' + index) }));
  return { manifest, source, configurationSha256, startAt, endAt,
    lifecycleReview: { binding: bound, complete: true, lifecycles, stabilizationWindowLifecycleId: 'stake-lock-quarter', evidence: evidence('lifecycle-review') },
    executions: [0, 1].map(index => ({ lifecycleId: 'stake-lock-quarter', cycleId: 'cycle-' + index,
      startedAt: index * 90 * DAY, dueAt: (index + 1) * 90 * DAY, completedAt: (index + 1) * 90 * DAY,
      authority: 'canonical-expiry-predicate', openingEvidence: evidence('activation-' + index), completionEvidence: evidence('expiry-' + index) })),
    seasonalRollovers: [1, 2].map(season => ({ season, logicalAt: season * 28 * DAY, authority: 'original-worker', evidence: evidence('season-' + season) })),
    workerCoverage: { binding: bound, fromLogicalAt: startAt, throughLogicalAt: endAt, complete: true, evidence: evidence('worker-coverage') },
    windows, stabilizationReview: { binding: bound, evidence: evidence('series-review'), windowEvidence: windows.map(row => row.evidence),
      axes: ['concentration', 'backlog', 'reachability'], criterion: 'Retained source-phase review of exact successive window series; no fabricated numerical tolerance', conclusion: 'STABLE' } };
}
assert.equal(WORLD_DURATION_CANDIDATES.find(row => row.id === 'stake-lock-quarter').durationMs, 90 * DAY);
assert(evaluateWorldDuration(durationFixture()).complete);
for (const change of [
  value => { value.executions = []; },
  value => { value.stabilizationReview = null; },
  value => { value.workerCoverage.complete = false; },
  value => { value.lifecycleReview.complete = false; },
  value => { value.lifecycleReview.lifecycles.find(row => row.id === 'made-membership').applicability = 'UNKNOWN'; },
  value => { value.windows[1].unresolvedBacklog = 1; },
]) { const value = durationFixture(); change(value); assert(!evaluateWorldDuration(value).complete); }
for (const change of [
  value => { value.executions[0].dueAt--; },
  value => { value.executions[0].startedAt = -1; },
  value => { value.seasonalRollovers.push(clone(value.seasonalRollovers[0])); },
  value => { value.lifecycleReview.lifecycles.pop(); },
  value => { value.windows[1].fromLogicalAt++; },
  value => { value.stabilizationReview.windowEvidence.reverse(); },
]) { const value = durationFixture(); change(value); assert.throws(() => evaluateWorldDuration(value)); }
{
  const value = durationFixture(); value.endAt = 90 * DAY; value.executions.length = 1; value.windows.length = 1;
  value.workerCoverage.throughLogicalAt = value.endAt; value.stabilizationReview = null;
  const result = evaluateWorldDuration(value); assert(result.minimumDaysMet && !result.cyclesMet && !result.complete);
}
{
  const value = durationFixture(); value.windows[0].backlogSamples = [];
  assert.throws(() => evaluateWorldDuration(value), /opening and closing/);
}
console.log('PASS rc1-world-qualification: source pins, exact checkpoint subjects, canonical cash/ammo/Family guards, unknown preservation, lifecycle executions, distinct season boundaries and reviewed window joins; no native-world qualification');
