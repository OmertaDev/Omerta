import assert from 'node:assert/strict';
import { exactConcentration, actionDistribution, latencyDistribution, summarizeWorldDiagnostics, collectWorldDiagnostics,
  operationLifecycleDiagnostics, worldObjectiveInventory } from '../tools/rc1-world-diagnostics.js';

assert.equal(exactConcentration([]).largestShare, null);
assert.equal(exactConcentration([{ quantity: '0' }]).gini, null);
assert.deepEqual(exactConcentration([{ quantity: '1.25' }, { quantity: '1.25' }]).gini,
  { numerator: '0', denominator: '500' });
assert.deepEqual(exactConcentration([{ quantity: '0' }, { quantity: '9007199254740993.01' }]).largestShare,
  { numerator: '900719925474099301', denominator: '900719925474099301' });
assert.throws(() => exactConcentration([{ quantity: '-1' }]), /nonnegative/);
const activity = actionDistribution(['active', 'absent'], { active: 4 });
assert.equal(activity.inactivePlayers, 1); assert.equal(activity.perPlayer[1].actions, 0);
assert.throws(() => actionDistribution(['active'], { outsider: 1 }), /undeclared/);
const latency = latencyDistribution(['active', 'absent'], { read: [1, 2, 1000], command: [0] },
  { read: ['active', 'active', null], command: ['active'] });
assert.equal(latency.totals.read.p95Ms, 1000);
assert.equal(latency.perPlayer[0].read.p95Ms, 2);
assert.equal(latency.perPlayer[1].command.p99Ms, null);
assert.equal(latency.unattributed.read.count, 1);
assert.equal(latency.perPlayer[0].command.p50Ms, 0);
assert.throws(() => latencyDistribution(['active'], { read: [1], command: [] }, { read: [], command: [] }), /attribution/);
assert.throws(() => latencyDistribution(['active'], { read: [1], command: [] }, { read: ['foreign'], command: [] }), /Undeclared/);
const rows = Object.fromEntries(['characters', 'familyMembers', 'families', 'campaigns', 'situations',
  'operations', 'participants', 'claims', 'grants', 'inventory', 'uniqueItems', 'lots', 'ledger'].map((name) => [name, []]));
rows.characters.push({ id: 'c', account_id: 'active', alive: true, is_npc: false });
rows.families.push({ id: 'f', npc_flag: false, treasury: '0', omr_reserve: '0' });
rows.familyMembers.push({ gang_id: 'f', character_id: 'c' });
rows.campaigns.push({ id: 'expired', status: 'active', expires_at: new Date(10) });
rows.claims.push({ id: 'secret', owner_account_id: 'active' });
rows.grants.push({ recipient_kind: 'family', active: true });
rows.inventory.push({ owner_scope: 'character', owner_id: 'c', template_id: 'material', quality: 'standard', quantity: '7' });
const summary = summarizeWorldDiagnostics(rows, { logicalAt: 20, roster: ['active', 'absent'], actorActions: { active: 4 } });
assert.equal(summary.knowledge.ownedClaimsPerDeclaredActor[1].ownedClaims, 0);
assert.equal(summary.knowledge.authorizedAccessibleClaims, null);
assert.deepEqual(summary.director.overdueActiveCampaignIds, ['expired']);
assert.equal(summary.inventory.stacks[0].concentration.total, '7');
assert.equal(summary.families.perFamily[0].livingDeclaredMembers, 1);
assert.equal(summary.unresolved.length, 4);
assert.equal(summary.coordination.lifecycle.complete, false);
assert.equal(summary.coordination.lifecycle.orphanedOperations, null, 'Absent observer tables cannot mean zero');

const lifecycleRows = { ...structuredClone(rows), accounts: [{ id: 'active', status: 'active' }], operations: [], participants: [],
  operationContributions: [], operationCommitments: [], operationCapital: [], operationEscrow: [], operationItems: [], operationLots: [], inventory: [],
  mysteries: [], discoveries: [], crewObjectives: [] };
assert.equal(operationLifecycleDiagnostics(lifecycleRows, 20).orphanedOperations, 0);
lifecycleRows.mysteries.push({ id: 'mystery-custody', status: 'active', owner_scope: 'character', owner_id: 'c' });
lifecycleRows.operationEscrow.push({ operation_id: 'mystery-custody', item_id: 'mystery-item', depositor_scope: 'character', depositor_id: 'c' });
lifecycleRows.operationItems.push({ id: 'mystery-item', owner_id: 'mystery-custody', state: 'escrowed' });
assert.equal(operationLifecycleDiagnostics(lifecycleRows, 20).structuralOrphanOperations, 0,
  'A canonical Mystery instance is a valid parent in the shared operation custody namespace');
lifecycleRows.mysteries = []; lifecycleRows.operationEscrow = []; lifecycleRows.operationItems = [];
for (const status of ['draft', 'recruiting', 'committed', 'ready', 'executing', 'resolving']) lifecycleRows.operations.push({
  id: status, status, coordination_mode: 'family', opened_by_account_id: 'active', expires_at: new Date(10) });
let lifecycle = operationLifecycleDiagnostics(lifecycleRows, 20);
assert.equal(lifecycle.overdueOpenOperationIds.length, 6, 'All Family open statuses count');
assert.equal(lifecycle.orphanedOperations, null, 'Overdue is not proof of unrecoverability');
assert.equal(lifecycle.structuralOrphanOperations, 0);
assert.equal(worldObjectiveInventory(lifecycleRows).subjects.filter((row) => row.type === 'operation').length, 6);
lifecycleRows.operations = [{ id: 'finished', coordination_mode: 'family', status: 'completed', opened_by_account_id: 'active' }];
lifecycleRows.operationItems.push({ id: 'consumed', owner_id: 'finished', state: 'consumed' });
lifecycleRows.characters[0].alive = false;
lifecycleRows.participants.push({ operation_id: 'finished', role_id: 'old-seat', account_id: 'active', character_id: 'c' });
assert.equal(operationLifecycleDiagnostics(lifecycleRows, 20).orphanedOperations, 0,
  'Dead historical participants and consumed item provenance are not orphaned custody');
lifecycleRows.operationEscrow.push({ operation_id: 'finished', item_id: 'held', depositor_scope: 'account', depositor_id: 'active' });
lifecycleRows.operationItems.push({ id: 'held', owner_id: 'finished', state: 'escrowed' });
lifecycle = operationLifecycleDiagnostics(lifecycleRows, 20);
assert.equal(lifecycle.orphanedOperations, 1, 'Count affected operations, not issue rows');
assert(lifecycle.issues.some((row) => row.kind === 'terminal-held-custody-or-promise'));
assert(lifecycle.issues.some((row) => row.kind === 'item:unbound-deposit'));
lifecycleRows.operationEscrow.push({ operation_id: 'missing', item_id: 'lost', depositor_scope: 'character', depositor_id: 'missing-character' });
lifecycleRows.operationCapital.push({ operation_id: 'missing', account_id: 'active', character_id: 'wrong-generation', role_id: 'r', requirement_id: 'capital', state: 'held', amount: '9' });
lifecycleRows.inventory.push({ owner_scope: 'operation', owner_id: 'missing', template_id: 'material', quality: 'standard', quantity: '9' });
lifecycle = operationLifecycleDiagnostics(lifecycleRows, 20);
assert.equal(lifecycle.structuralOrphanOperations, 2);
for (const kind of ['escrow:missing-operation', 'escrow:missing-return-owner', 'escrow:missing-or-mismatched-item',
  'capital:missing-operation', 'capital:missing-or-mismatched-principal', 'resource:missing-operation'])
  assert(lifecycle.issues.some((row) => row.kind === kind), kind);
const heldRows = { ...lifecycleRows, operations: [{ id: 'op', coordination_mode: 'family', status: 'ready', opened_by_account_id: 'active' }],
  participants: [{ operation_id: 'op', role_id: 'r', account_id: 'active', character_id: 'c' }], operationContributions: [],
  operationEscrow: [], operationItems: [], operationCapital: [], operationCommitments: [], inventory: [] };
for (const [kind, requirement_id, quantity, template_id] of [['capital', 'cash', 9, null], ['resource', 'material', 7, 'parts']])
  heldRows.operationCommitments.push({ operation_id: 'op', role_id: 'r', requirement_id, kind, quantity, template_id,
    account_id: 'active', character_id: 'c', state: 'fulfilled' });
lifecycle = operationLifecycleDiagnostics(heldRows, 20);
assert(lifecycle.issues.some((row) => row.kind === 'capital:missing-deposit'));
assert(lifecycle.issues.some((row) => row.kind === 'resource:missing-deposit'));
heldRows.operationCapital.push({ ...heldRows.operationCommitments[0], amount: '9', state: 'held' });
heldRows.inventory.push({ owner_scope: 'operation', owner_id: 'op', template_id: 'parts', quality: 'standard', quantity: '7' });
assert.equal(operationLifecycleDiagnostics(heldRows, 20).structuralOrphanOperations, 0);
heldRows.operationCapital[0].amount = '8'; heldRows.inventory[0].quality = 'wrong';
lifecycle = operationLifecycleDiagnostics(heldRows, 20);
assert(lifecycle.issues.some((row) => row.kind === 'capital:unbound-deposit'));
assert(lifecycle.issues.some((row) => row.kind === 'resource:unbound-deposit'));
lifecycleRows.mysteries.push({ id: 'old-mystery', status: 'active' });
lifecycleRows.discoveries.push({ id: 'lead', status: 'active' });
lifecycleRows.crewObjectives.push({ crew_id: 'old-crew', week: 1, done: false });
assert.equal(worldObjectiveInventory(lifecycleRows).subjects.filter((row) => ['mystery', 'discovery', 'crew_objective'].includes(row.type)).length, 3,
  'Historical unresolved objectives need an explicit canonical disposition');
console.log('PASS: exact large-decimal concentration, absent actors, separated inventory, and bounded diagnostic semantics');

if (process.argv.includes('--postgres')) {
  const { commandDatabase, addPlayer } = await import('./lib/player-command-support.js');
  const { canonicalDatabaseSnapshot } = await import('../tools/rc1-native-proof.js');
  const database = await commandDatabase('world_diagnostics');
  try {
    // Declared observer-only precision fixture; no gameplay result is claimed.
    await addPlayer(database.pool, 'observer-actor');
    await database.pool.query(`INSERT INTO transactions(id,account_id,currency,amount,reason)
      VALUES('precision-fixture','observer-actor','cash',9007199254740993.01,'observer:precision-fixture')`);
    const before = await canonicalDatabaseSnapshot(database.pool);
    const report = await collectWorldDiagnostics(database.pool, { logicalAt: Date.now(),
      roster: ['observer-actor', 'absent-actor'], actorActions: { 'observer-actor': 1 } });
    assert.equal(report.semantic.ledgerActivity.byActorCurrencyReason[0].gross, '9007199254740993.01');
    assert.equal(report.semantic.population.livingDeclaredCharacters, 1);
    assert.equal(report.semantic.actions.inactivePlayers, 1);
    assert.equal(report.semantic.coordination.lifecycle.complete, true);
    assert.equal(report.semantic.coordination.lifecycle.orphanedOperations, 0);
    assert.equal(report.semantic.objectiveInventory.tablesComplete, true);
    assert(report.semantic.worldRows.length > 300);
    assert(report.physicalDiagnostics.relationBytes.every((row) => /^\d+$/.test(row.bytes)));
    assert.equal((await canonicalDatabaseSnapshot(database.pool)).stateSha256, before.stateSha256,
      'Diagnostic observer changed authoritative state');
    console.log(JSON.stringify({ status: 'PASS_SCOPED', tables: report.semantic.worldRows.length,
      exactDecimalPreserved: true, canonicalStateUnchanged: true }));
  } finally { await database.cleanup(database.pool); }
}
