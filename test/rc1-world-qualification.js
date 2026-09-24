import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { verifyWorldRecoverySources, canonicalRecoveryWitnesses, joinWorldCheckpointAssertions,
  evaluateWorldDuration, WORLD_RECOVERY_REVIEW, WORLD_DURATION_CANDIDATES } from '../tools/rc1-world-qualification.js';

const hash = value => sha256(canonicalJson(value)), clone = value => structuredClone(value), DAY = 86400000;
const source = await verifyWorldRecoverySources({ readFile: file => fs.readFile(file), sourceRevision: '92f09bb4'.padEnd(40, '0') });
for (const ending of ['\n', '\r\n']) assert.deepEqual(await verifyWorldRecoverySources({ sourceRevision: source.sourceRevision,
  readFile: async file => (await fs.readFile(file, 'utf8')).replace(/\r?\n/g, ending) }), source);
await assert.rejects(verifyWorldRecoverySources({ sourceRevision: source.sourceRevision,
  readFile: async file => file === 'src/game.js' ? Buffer.from('changed source') : fs.readFile(file) }), /source changed/);
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
console.log('PASS rc1-world-qualification: source pins, exact checkpoint subjects, canonical cash/ammo/Family guards, unknown preservation, lifecycle executions, distinct season boundaries and reviewed window joins; no native-world qualification');
