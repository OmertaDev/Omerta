import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources, verifyResourceTableChanges } from '../tools/rc1-world-resource-observer.js';
import { sourceIdentity, assertSourceUnchanged } from '../tools/rc1-native-proof.js';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value), at = '2026-09-24T00:00:00.000Z';
function verify(input) {
  const journal = reconcileWorldResources(input.before, input.after, { includeRestrictedChanges: true });
  assert.equal(journal.familyEntry.movements.length, 0, 'NPC formation must not become player formation coverage');
  assert.equal(journal.qualifyingFullResourcePass, false);
  for (const kind of ['family-npc-formation', 'receipt-reason', 'family-lineage']) assert(journal.unsupported.some(row => row.kind === kind));
  assert(journal.unsupported.some(row => row.table === 'gang_members'));
  assert(journal.checks.some(row => row.kind === 'NPC-formation-cash-parity-only'));
  assert(verifyResourceTableChanges(input.before, input.after, journal.restrictedChanges));
  const changed = journal.restrictedChanges.tables.find(row => row.table === 'gangs'); assert(changed);
  for (const family of input.after.tables.gangs.filter(row => !input.before.tables.gangs.some(old => old.id === row.id))) {
    assert.deepEqual(changed.afterRows.find(row => row.id === family.id), family, 'NPC/war-pool fields lost from restricted evidence');
  }
  return journal;
}
function controls(input) {
  const fresh = value => value.after.tables.transactions.find(row => row.reason === 'gang:found' && !value.before.tables.transactions.some(old => old.id === row.id));
  const founder = value => value.after.tables.characters.find(row => row.id === fresh(value).character_id);
  const family = value => value.after.tables.gangs.find(row => !value.before.tables.gangs.some(old => old.id === row.id));
  const mutations = [
    ['missing-debit', value => { const person = founder(value); person.cash = value.before.tables.characters.find(row => row.id === person.id).cash; }],
    ['balanced-wrong-fee', value => { founder(value).cash = String(Number(founder(value).cash) + 1); fresh(value).amount = '-24999'; }],
    ['wrong-account-owner', value => { founder(value).account_id = 'wrong-owner'; }],
    ['wrong-receipt-account', value => { fresh(value).account_id = founder(value).account_id; }],
    ['wrong-receipt-counterparty', value => { fresh(value).counterparty = family(value).id; }],
    ['missing-founder-membership', value => { const id = founder(value).id; value.after.tables.gang_members = value.after.tables.gang_members.filter(row => row.character_id !== id); }],
    ['wrong-founder-role', value => { value.after.tables.gang_members.find(row => row.character_id === founder(value).id).role = 'soldier'; }],
    ['missing-NPC-origin', value => { value.before.tables.characters.find(row => row.id === founder(value).id).is_npc = false; }],
    ['missing-NPC-Family-flag', value => { family(value).npc_flag = false; }],
    ['stale-formation-receipt', value => { value.before.tables.transactions.push(copy(fresh(value))); }],
    ['duplicate-formation-receipt', value => { const receipt = fresh(value); founder(value).cash = String(Number(founder(value).cash) + Number(receipt.amount)); value.after.tables.transactions.push({ ...receipt, id: 'duplicate' }); }],
    ['bank-diversion', value => { const person = founder(value); person.cash = String(Number(person.cash) + 1); person.bank = String(Number(person.bank) - 1); }],
    ...['treasury', 'ammo_bank', 'omr_reserve'].map(field => [`unexplained-Family-${field}`, value => { family(value)[field] = '1'; }]),
    ['balanced-wrong-NPC-founder', value => {
      const first = founder(value), other = value.after.tables.characters.find(row => row.id !== first.id && row.is_npc && row.alive && Number(row.cash) >= 25000);
      assert(other, 'Native fixture lacks second eligible balance for wrong-owner control');
      first.cash = String(Number(first.cash) + 25000); other.cash = String(Number(other.cash) - 25000); fresh(value).character_id = other.id;
    }],
  ];
  return mutations.map(([name, mutate]) => {
    const value = copy(input); mutate(value); let rejection;
    try { verify(value); } catch (error) { rejection = error.message; }
    assert(rejection, `${name} escaped`); return { name, input: value, rejection };
  });
}
const before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
before.tables.characters = ['one', 'two'].map(id => ({ id, account_id: `account-${id}`, alive: true, is_npc: true, respect: '10000', cash: '50000', bank: '100', ammo: 25, cb: 0 }));
before.tables.account_persistent = before.tables.characters.map(row => ({ account_id: row.account_id, npc_flag: true, omr: '0', staked: '0', unbonding: '0' }));
const after = copy(before); after.tables.characters[0].cash = '25000';
after.tables.gangs.push({ id: 'NPC-Family', npc_flag: true, treasury: '0', ammo_bank: 0, omr_reserve: '0', war_pool: '120000', war_pool_at: at });
after.tables.gang_members.push({ character_id: 'one', gang_id: 'NPC-Family', role: 'boss', joined_at: at });
after.tables.transactions.push({ id: 'found-receipt', character_id: 'one', account_id: null, currency: 'cash', amount: '-25000', reason: 'gang:found', counterparty: null, at });
const pure = { before, after }; verify(pure); const pureControls = controls(pure);
const unknown = copy(pure); unknown.after.tables.gangs[0].future_standing = '17'; verify(unknown);
const lost = verify(pure); delete lost.restrictedChanges.tables.find(row => row.table === 'gangs').afterRows[0].war_pool;
assert.throws(() => verifyResourceTableChanges(before, after, lost.restrictedChanges), 'Lost war-pool standing must be rejected by restricted evidence verifier');

const failures = process.argv.filter(value => value.startsWith('--failure=')).map(value => value.slice(10));
const output = process.argv.find(value => value.startsWith('--output='))?.slice(9);
assert(!failures.length || output, 'Retained failure verification requires fresh private output');
if (output) {
  const source = await sourceIdentity(); await fs.mkdir(output, { recursive: false });
  const artifacts = [], samples = [];
  const save = async (name, value) => { const bytes = JSON.stringify(value, null, 2) + '\n'; await fs.writeFile(path.join(output, name), bytes); artifacts.push({ path: name, sha256: sha(bytes) }); };
  for (const [index, filename] of failures.entries()) {
    const bytes = await fs.readFile(filename), input = JSON.parse(bytes), journal = verify(input), negatives = controls(input);
    await save(`original-failure-${index + 1}.json`, input); await save(`reconciled-failure-${index + 1}.json`, journal);
    for (const [n, control] of negatives.entries()) await save(`native-control-${index + 1}-${n + 1}.json`, control);
    samples.push({ originalSha256: sha(bytes), originalError: input.error.message, event: input.event,
      correctedStatus: journal.status, unsupported: journal.unsupported.map(({ kind, table, reason }) => ({ kind, table, reason })),
      supportedFamilyMovements: journal.familyEntry.movements.length, negativeControls: negatives.length });
  }
  await assertSourceUnchanged(source);
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ status: 'PASS_SCOPED_RETAINED_INPUTS', source, samples, pureControls: pureControls.length,
    lostRestrictedFieldRejected: true, artifacts, fullResourceCoverage: false, nativeFreshWorkerStatus: 'SEPARATE_REQUIRED_RUN' }, null, 2) + '\n');
}
console.log(JSON.stringify({ status: 'PASS_SCOPED_CONTROLS', pureControls: pureControls.length, retainedNativeInputs: failures.length, fullResourceCoverage: false }));
