import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { reconcileWorldResources, verifyResourceTableChanges } from '../../tools/rc1-world-resource-observer.js';
export function verifyNpcFamilyBoundary(input, expected = 1) {
  const journal = reconcileWorldResources(input.before, input.after, { identity: input.event, npcFamilyProvenance: input.provenance, includeRestrictedChanges: true });
  assert.equal(journal.familyEntry.movements.filter(row => row.kind === 'npc-family-formation-cash-sink').length, expected);
  if (expected) assert.equal(journal.unsupported.length, 0, JSON.stringify(journal.unsupported));
  assert.equal(journal.qualifyingFullResourcePass, false); return journal;
}
export function npcFamilyCorruptions(input) {
  verifyNpcFamilyBoundary(input);
  const family = value => value.after.tables.gangs.find(row => !value.before.tables.gangs.some(old => old.id === row.id));
  const receipt = value => value.after.tables.transactions.find(row => !value.before.tables.transactions.some(old => old.id === row.id));
  const mutations = [
    ['missing-provenance', value => { value.provenance = null; }],
    ['wrong-source-pin', value => { value.provenance.sourcePins['src/population.js'] = '0'.repeat(64); }],
    ['missing-source-caller', value => { value.provenance.statements[11].callerFrames = []; }],
    ['wrong-returned-war-pool', value => { value.provenance.statements[11].parameters[1]++; }],
    ['wrong-returned-target', value => { value.provenance.statements[11].parameters[0] = 'other-family'; }],
    ['no-row-updated', value => { value.provenance.statements[11].rowCount = 0; }],
    ['missing-standing-statement', value => { value.provenance.statements.splice(11, 1); }],
    ['duplicate-standing-statement', value => { value.provenance.statements.splice(11, 0, structuredClone(value.provenance.statements[11])); }],
    ['wrong-statement-order', value => { [value.provenance.statements[10], value.provenance.statements[11]] = [value.provenance.statements[11], value.provenance.statements[10]]; }],
    ['stale-transaction-binding', value => { value.provenance.boundary.transactionId++; }],
    ['rolled-back-provenance', value => { value.provenance.outcome = 'ROLLED_BACK'; }],
    ['wrong-authority-context', value => { value.event.context.authority = 'player.execute'; value.provenance.boundary.context.authority = 'player.execute'; }],
    ['wrong-locked-founder', value => { value.provenance.statements[4].rows[0].account_id = 'other-owner'; }],
    ['missing-actual-shortlist', value => { value.provenance.statements[3].rows = []; }],
    ['wrong-returned-fee-receipt', value => { value.provenance.statements[9].parameters[0] = 'stale-ledger-id'; }],
    ['wrong-standing', value => { family(value).war_pool = '120001'; }],
    ['wrong-standing-clock', value => { family(value).war_pool_at = new Date(Date.parse(family(value).war_pool_at) + 1).toISOString(); }],
    ['standing-as-cash-credit', value => { family(value).treasury = '120000'; }],
    ['missing-cash-fee', value => { const r = receipt(value); value.after.tables.transactions = value.after.tables.transactions.filter(row => row.id !== r.id); }],
    ['stale-cash-fee', value => { value.before.tables.transactions.push(structuredClone(receipt(value))); }],
    ['duplicate-cash-fee', value => { value.after.tables.transactions.push({ ...receipt(value), id: 'duplicate' }); }],
  ];
  const results = mutations.map(([name, mutate]) => {
    const value = structuredClone(input); mutate(value);
    if (value.provenance) { const { sha256, ...body } = value.provenance; value.provenance.sha256 = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'); }
    let rejection; try { verifyNpcFamilyBoundary(value); } catch (error) { rejection = error.message; }
    assert(rejection, `${name} escaped`); return { name, input: value, rejection };
  });
  const unknown = structuredClone(input); family(unknown).future_npc_state = 'unclassified';
  const journal = reconcileWorldResources(unknown.before, unknown.after, { identity: unknown.event, npcFamilyProvenance: unknown.provenance, includeRestrictedChanges: true });
  assert(journal.unsupported.some(row => row.kind === 'family-lineage'));
  assert(verifyResourceTableChanges(unknown.before, unknown.after, journal.restrictedChanges));
  return results;
}
