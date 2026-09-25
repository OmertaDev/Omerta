import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources, verifyResourceTableChanges } from '../tools/rc1-world-resource-observer.js';
import { exactSum, negate } from '../tools/rc1-resource-journal.js';
import { sourceIdentity, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { omrRequestHash } from '../tools/rc1-omr-journal.js';
import { verifyFamilyEntryBoundary } from './lib/rc1-family-entry-controls.js';

export function verifyFamilyDissolutionBoundary(input, { expected = null } = {}) {
  // Reuse the established completed-request binding and ordinary-entry verifier.
  // It claims no leave authorization; that terminal binding is explicit below.
  const journal = verifyFamilyEntryBoundary({ ...input, commands: (input.commands || []).filter(row => row.method === 'POST') });
  const fresh = (input.commands || []).filter(row => row.status === 200 && !row.replayed && row.url === '/v1/gangs/leave');
  const dissolved = fresh.filter(row => row.body.dissolved === true), used = new Set();
  assert.equal(journal.familyDissolution.movements.length, dissolved.length, 'Terminal movement lacks unique successful leave response');
  for (const movement of journal.familyDissolution.movements) {
    for (const member of movement.originalMembers) {
      const commands = fresh.filter(row => row.accountId === member.accountId); assert.equal(commands.length, 1, 'Original member lacks authorized leave');
    }
    const command = dissolved.filter(row => !used.has(row) && movement.originalMembers.some(member => member.accountId === row.accountId));
    assert.equal(command.length, 1, 'Dissolution response belongs to another Family owner'); used.add(command[0]);
    assert.equal(command[0].method, 'POST'); assert.equal(command[0].payload, null);
  }
  if (expected !== null) {
    assert.equal(journal.familyDissolution.movements.length, expected, 'Expected Family terminal is missing');
    assert.equal(journal.unsupported.length, 0, `Terminal boundary remains unsupported: ${JSON.stringify(journal.unsupported)}`);
  }
  return journal;
}

export function familyDissolutionCorruptions(input) {
  const good = verifyFamilyDissolutionBoundary(input, { expected: 1 }), movement = good.familyDissolution.movements[0];
  const otherFamily = input.before.tables.gangs.find(row => row.id !== movement.familyId);
  const otherOwner = input.before.tables.account_persistent.find(row => !movement.originalMembers.some(member => member.accountId === row.account_id));
  const freshRows = value => value.after.tables.transactions.filter(row => !value.before.tables.transactions.some(old => old.id === row.id));
  const mutations = [];
  for (const currency of ['cash', 'ammo', 'omr']) {
    const find = value => freshRows(value).find(row => row.reason === 'gang:dissolved' && row.currency === currency); assert(find(input));
    mutations.push([`${currency}-missing-disposal`, value => { const row = find(value); value.after.tables.transactions = value.after.tables.transactions.filter(item => item.id !== row.id); }]);
    mutations.push([`${currency}-duplicate-disposal`, value => { const row = find(value); value.after.tables.transactions.push({ ...row, id: `duplicate-${currency}` }); }]);
    mutations.push([`${currency}-stale-disposal`, value => { value.before.tables.transactions.push(structuredClone(find(value))); }]);
    mutations.push([`${currency}-wrong-personal-owner`, value => { find(value).account_id = otherOwner.account_id; }]);
    mutations.push([`${currency}-wrong-Family`, value => { find(value).counterparty = otherFamily?.id || 'absent-Family'; }]);
    mutations.push([`${currency}-wrong-exact-amount`, value => { const row = find(value); row.amount = exactSum([row.amount, currency === 'omr' ? '0.000001' : '1']); }]);
  }
  const recycled = value => freshRows(value).find(row => row.reason === 'desk:recycle');
  mutations.push(['missing-recycle-receipt', value => { const row = recycled(value); value.after.tables.transactions = value.after.tables.transactions.filter(item => item.id !== row.id); }]);
  mutations.push(['duplicate-recycle-receipt', value => { value.after.tables.transactions.push({ ...recycled(value), id: 'duplicate-recycle' }); }]);
  mutations.push(['stale-recycle-receipt', value => { value.before.tables.transactions.push(structuredClone(recycled(value))); }]);
  mutations.push(['wrong-recycle-reason', value => { recycled(value).counterparty = 'vanity:gang:seal'; }]);
  mutations.push(['missing-desk-lifetime-credit', value => { value.after.tables.desk_inventory[0].lifetime_in = value.before.tables.desk_inventory[0].lifetime_in; }]);
  mutations.push(['balanced-reserve-to-wrong-owner', value => {
    const reserve = value.before.tables.gangs.find(row => row.id === movement.familyId).omr_reserve;
    value.after.tables.desk_inventory[0].balance = exactSum([value.after.tables.desk_inventory[0].balance, negate(reserve)]);
    const account = value.after.tables.account_persistent.find(row => row.account_id === otherOwner.account_id); account.omr = exactSum([account.omr, reserve]);
  }]);
  mutations.push(['retained-membership', value => { value.after.tables.gang_members.push(structuredClone(value.before.tables.gang_members.find(row => row.gang_id === movement.familyId))); }]);
  mutations.push(['retained-Family-custody', value => { value.after.tables.gangs.push(structuredClone(value.before.tables.gangs.find(row => row.id === movement.familyId))); }]);
  mutations.push(['wrong-authorized-owner', value => { value.commands.find(row => row.status === 200 && !row.replayed).accountId = otherOwner.account_id; }]);
  mutations.push(['missing-durable-receipt', value => { value.durable = []; }]);
  mutations.push(['duplicate-durable-receipt', value => { value.durable.push(structuredClone(value.durable[0])); }]);
  mutations.push(['wrong-durable-body-hash', value => { value.durable.find(row => row.key === value.commands[0].key).body_hash = '0'.repeat(64); }]);
  return mutations.map(([name, mutate]) => { const corrupt = structuredClone(input); mutate(corrupt); let rejection;
    try { verifyFamilyDissolutionBoundary(corrupt, { expected: 1 }); } catch (error) { rejection = error.message; }
    assert(rejection, `${name} escaped`); return { name, input: corrupt, rejection }; });
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const at = '2026-09-20T12:00:00.000Z';
  const before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
  before.tables.characters = ['one', 'two'].map(id => ({ id, account_id: `account-${id}`, alive: true, cash: '500', bank: '0', ammo: 25, cb: 0 }));
  before.tables.account_persistent = before.tables.characters.map(row => ({ account_id: row.account_id, omr: '100', staked: '0', unbonding: '0' }));
  before.tables.gangs = [{ id: 'A', treasury: '123', ammo_bank: 17, omr_reserve: '6.125' }, { id: 'B', treasury: '150', ammo_bank: 10, omr_reserve: '10' }];
  before.tables.gang_members = [{ gang_id: 'A', character_id: 'one', role: 'boss' }, { gang_id: 'B', character_id: 'two', role: 'boss' }];
  before.tables.desk_inventory = [{ id: 1, balance: '17', lifetime_in: '20', lifetime_sold: '3', lifetime_bought: '0' }];
  const after = structuredClone(before); after.tables.gangs.shift(); after.tables.gang_members.shift();
  after.tables.transactions = [['cash', '-123'], ['ammo', '-17'], ['omr', '-6.125']].map(([currency, amount]) => ({ id: currency, character_id: null, account_id: null, currency, amount, reason: 'gang:dissolved', counterparty: 'A', at }));
  after.tables.transactions.push({ id: 'recycle', character_id: null, account_id: null, currency: 'omr', amount: '6.125', reason: 'desk:recycle', counterparty: 'gang:dissolved', at });
  after.tables.desk_inventory[0].balance = '23.125'; after.tables.desk_inventory[0].lifetime_in = '26.125';
  const command = { accountId: 'account-one', method: 'POST', url: '/v1/gangs/leave', payload: null, key: 'last-leave', status: 200, replayed: false, body: { ok: true, dissolved: true } };
  const input = { before, after, commands: [command], durable: [{ account_id: command.accountId, key: command.key, status: 200, body_hash: omrRequestHash(command), response: JSON.stringify(command.body) }] };
  assert.equal(verifyFamilyDissolutionBoundary(input, { expected: 1 }).qualifyingFullResourcePass, false);
  const replay = { ...structuredClone(input), before: after, commands: [{ ...command, replayed: true }] };
  assert.equal(verifyFamilyDissolutionBoundary(replay, { expected: 0 }).familyDissolution.movements.length, 0);
  const controls = familyDissolutionCorruptions(input);
  const compound = structuredClone(input); compound.after.tables.characters[0].alive = false;
  const unknown = reconcileWorldResources(compound.before, compound.after, { includeRestrictedChanges: true });
  assert(unknown.unsupported.some(row => row.kind === 'family-dissolution-compound')); verifyResourceTableChanges(compound.before, compound.after, unknown.restrictedChanges);
  const zero = structuredClone(input); for (const field of ['treasury', 'ammo_bank', 'omr_reserve']) zero.before.tables.gangs[0][field] = '0';
  zero.after.tables.transactions = []; zero.after.tables.desk_inventory = structuredClone(zero.before.tables.desk_inventory);
  assert.equal(verifyFamilyDissolutionBoundary(zero, { expected: 1 }).familyDissolution.movements[0].disposition.length, 0);
  const zeroDesk = structuredClone(zero); zeroDesk.after.tables.desk_inventory[0].lifetime_in = '21';
  assert.throws(() => verifyFamilyDissolutionBoundary(zeroDesk, { expected: 1 }), /Zero-reserve/);
  const empty = structuredClone(input); empty.before.tables.gang_members.shift(); assert.throws(() => verifyFamilyDissolutionBoundary(empty, { expected: 1 }), /original owners/);
  const directory = process.argv.find(value => value.startsWith('--evidence='))?.slice(11);
  if (directory) {
    const run = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8')); await verifyArtifactIndex(directory, run);
    assert.deepEqual(run.source, await sourceIdentity()); assert.equal(run.status, 'PASS_SCOPED');
    let boundaries = 0, terminals = 0, nativeControls = 0; const unsupported = {};
    for (const artifact of run.artifacts.filter(row => /^family-terminal-boundary-\d+\.json$/.test(row.path))) {
      const value = JSON.parse(await fs.readFile(path.join(directory, artifact.path), 'utf8'));
      const journal = verifyFamilyDissolutionBoundary(value, { expected: value.expected }); boundaries++; terminals += journal.familyDissolution.movements.length;
      for (const row of journal.unsupported) unsupported[`${row.kind}:${row.table || row.reason || ''}`] = (unsupported[`${row.kind}:${row.table || row.reason || ''}`] || 0) + 1;
    }
    for (const artifact of run.artifacts.filter(row => /^family-terminal-control-\d+\.json$/.test(row.path))) {
      const value = JSON.parse(await fs.readFile(path.join(directory, artifact.path), 'utf8')); assert.throws(() => verifyFamilyDissolutionBoundary(value.input, { expected: 1 })); nativeControls++;
    }
    console.log(JSON.stringify({ status: 'PASS_SCOPED', source: run.source.revision, boundaries, terminals, nativeControls, pureControls: controls.length, unsupported, fullResourceCoverage: false }));
  } else console.log(JSON.stringify({ status: 'PASS_PURE_CONTROLS', controls: controls.length, fullResourceCoverage: false }));
}
