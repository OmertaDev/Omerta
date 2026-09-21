import assert from 'node:assert/strict';
import { exactConcentration, actionDistribution, summarizeWorldDiagnostics, collectWorldDiagnostics } from '../tools/rc1-world-diagnostics.js';

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
    assert(report.semantic.worldRows.length > 300);
    assert(report.physicalDiagnostics.relationBytes.every((row) => /^\d+$/.test(row.bytes)));
    assert.equal((await canonicalDatabaseSnapshot(database.pool)).stateSha256, before.stateSha256,
      'Diagnostic observer changed authoritative state');
    console.log(JSON.stringify({ status: 'PASS_SCOPED', tables: report.semantic.worldRows.length,
      exactDecimalPreserved: true, canonicalStateUnchanged: true }));
  } finally { await database.cleanup(database.pool); }
}
