import assert from 'node:assert/strict';
import { reconcileWorldResources } from '../../tools/rc1-world-resource-observer.js';
import { omrRequestHash } from '../../tools/rc1-omr-journal.js';

// A completed HTTP boundary supplies the body/route information which a ledger
// row alone cannot reconstruct. The shared per-commit observer stays read-only.
export function verifyFamilyEntryBoundary(input, { expected = null } = {}) {
  const journal = reconcileWorldResources(input.before, input.after, { includeRestrictedChanges: true });
  const commands = input.commands || [], durable = input.durable || [];
  assert.equal(new Set(durable.map(row => JSON.stringify([row.account_id, row.key]))).size, durable.length, 'Duplicate durable account/key receipt');
  const successful = commands.filter(row => row.status === 200 && !row.replayed && ['/v1/gangs', '/v1/gangs/tribute', '/v1/gangs/tribute/omr'].includes(row.url));
  for (const command of commands.filter(row => row.status === 200)) {
    const saved = durable.filter(row => row.account_id === command.accountId && row.key === command.key);
    assert.equal(saved.length, 1, 'Missing unique durable request receipt'); assert.equal(saved[0].status, 200);
    assert.equal(saved[0].body_hash, omrRequestHash(command), 'Durable route/body/owner mismatch');
    assert.deepEqual(JSON.parse(saved[0].response), command.body, 'Durable response differs from actual completion');
  }
  assert.equal(journal.familyEntry.movements.length, successful.length, 'Fresh Family movement lacks a unique authorized command');
  const used = new Set();
  for (const movement of journal.familyEntry.movements) {
    const path = movement.kind === 'family-formation-sink' ? '/v1/gangs' : movement.currency === 'cash' ? '/v1/gangs/tribute' : '/v1/gangs/tribute/omr';
    const matching = successful.filter(row => !used.has(row) && row.accountId === movement.accountId && row.url === path
      && (path === '/v1/gangs' ? row.body.gangId === movement.familyId : String(Math.floor(Number(row.payload.amount))) === movement.amount));
    assert.equal(matching.length, 1, 'Family movement differs from authorized owner/amount/route'); const command = matching[0]; used.add(command);
    if (path === '/v1/gangs') { const family = input.after.tables.gangs.find(row => row.id === movement.familyId);
      assert.equal(family.name, command.payload.name); assert.equal(family.tag, String(command.payload.tag).trim().toUpperCase()); }
    else { assert.equal(String(command.body.amount), movement.amount); assert.equal(command.body.currency, movement.currency); }
  }
  if (expected !== null) {
    assert.equal(journal.familyEntry.movements.length, expected, 'Expected scoped Family movement is missing');
    assert.equal(journal.unsupported.length, 0, `Scoped Family boundary remains unsupported: ${JSON.stringify(journal.unsupported)}`);
  }
  return journal;
}

export function familyEntryCorruptions(input) {
  const baseline = verifyFamilyEntryBoundary(input), movement = baseline.familyEntry.movements[0]; assert(movement);
  const others = input.before.tables.characters.filter(row => row.id !== movement.characterId && row.alive);
  const family = input.after.tables.gangs.find(row => row.id !== movement.familyId);
  const mutations = [
    ['missing-receipt', value => { value.after.tables.transactions = value.after.tables.transactions.filter(row => row.id !== movement.authority[0].id); }],
    ['duplicate-receipt', value => { const row = value.after.tables.transactions.find(row => row.id === movement.authority[0].id); value.after.tables.transactions.push({ ...row, id: `duplicate-${row.id}` }); }],
    ['stale-receipt', value => { value.before.tables.transactions.push(structuredClone(value.after.tables.transactions.find(row => row.id === movement.authority[0].id))); }],
    ['wrong-receipt-owner', value => { const row = value.after.tables.transactions.find(row => row.id === movement.authority[0].id); row[movement.currency === 'omr' ? 'account_id' : 'character_id'] = movement.currency === 'omr' ? others[0].account_id : others[0].id; }],
    ['wrong-authorized-owner', value => { value.commands[0].accountId = others[0].account_id; }],
    ['missing-durable-receipt', value => { value.durable = []; }],
    ['duplicate-durable-receipt', value => { value.durable.push(structuredClone(value.durable[0])); }],
    ['wrong-durable-body-hash', value => { value.durable.find(row => row.key === value.commands[0].key).body_hash = '0'.repeat(64); }],
  ];
  if (movement.kind === 'family-formation-sink') {
    mutations.push(['missing-sink', value => { value.after.tables.characters.find(row => row.id === movement.characterId).cash = value.before.tables.characters.find(row => row.id === movement.characterId).cash; }]);
    mutations.push(['wrong-founder-membership', value => { value.after.tables.gang_members.find(row => row.character_id === movement.characterId).character_id = others[0].id; }]);
  } else {
    mutations.push(['missing-custody-credit', value => { const field = movement.currency === 'cash' ? 'treasury' : 'omr_reserve'; value.after.tables.gangs.find(row => row.id === movement.familyId)[field] = value.before.tables.gangs.find(row => row.id === movement.familyId)[field]; }]);
    mutations.push(['wrong-authorized-amount', value => { value.commands[0].payload.amount = Number(movement.amount) + 1; }]);
    if (family) mutations.push(['balanced-wrong-Family', value => {
      const field = movement.currency === 'cash' ? 'treasury' : 'omr_reserve', source = value.after.tables.gangs.find(row => row.id === movement.familyId), target = value.after.tables.gangs.find(row => row.id === family.id);
      const original = value.before.tables.gangs.find(row => row.id === movement.familyId); source[field] = original[field];
      // The tests use bounded integral fixture values. Production checks retain NUMERIC strings.
      target[field] = String(Number(target[field]) + Number(movement.amount));
    }]);
    if (movement.currency === 'omr') mutations.push(['balanced-wrong-account-debit', value => {
      const owner = value.after.tables.account_persistent.find(row => row.account_id === movement.accountId), other = value.after.tables.account_persistent.find(row => row.account_id === others[0].account_id);
      owner.omr = value.before.tables.account_persistent.find(row => row.account_id === movement.accountId).omr;
      other.omr = String(Number(other.omr) - Number(movement.amount));
    }]);
  }
  return mutations.map(([name, mutate]) => { const corrupt = structuredClone(input); mutate(corrupt); let rejection;
    try { verifyFamilyEntryBoundary(corrupt, { expected: baseline.familyEntry.movements.length }); } catch (error) { rejection = error.message; }
    assert(rejection, `${movement.kind}/${name} escaped`); return { name: `${movement.kind}/${name}`, input: corrupt, rejection }; });
}
