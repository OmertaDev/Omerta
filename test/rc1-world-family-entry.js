import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources, verifyResourceTableChanges } from '../tools/rc1-world-resource-observer.js';
import { omrRequestHash } from '../tools/rc1-omr-journal.js';
import { dayOf } from '../src/rules.js';
import { sourceIdentity, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { verifyFamilyEntryBoundary, familyEntryCorruptions } from './lib/rc1-family-entry-controls.js';
const at = '2026-09-20T12:00:00.000Z';
const before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
before.tables.characters = ['one', 'two', 'other'].map(id => ({ id, account_id: `account-${id}`, alive: true, cash: '50000', bank: '0', ammo: 25, cb: 0, respect: '10000' }));
before.tables.account_persistent = before.tables.characters.map(row => ({ account_id: row.account_id, omr: '100', staked: '0', unbonding: '0' }));
const family = id => ({ id, name: `Family ${id}`, tag: `F${id}`, npc_flag: false, treasury: '0', ammo_bank: 0, omr_reserve: '0',
  lifetime_tribute: '0', season_tribute: '0', season: Math.floor(dayOf(Date.parse(at)) / 28), created_at: at });
const member = (character_id, gang_id) => ({ character_id, gang_id, role: 'boss', joined_at: at, post: null, post_at: null });
before.tables.gangs = [family('B')]; before.tables.gang_members = [member('two', 'B')];
function input(before, after, url, payload, body) {
  const command = { accountId: 'account-one', method: 'POST', url, key: `key-${url}`, payload, status: 200, replayed: false, body };
  return { before, after, commands: [command], durable: [{ account_id: command.accountId, key: command.key, status: 200, body_hash: omrRequestHash(command), response: JSON.stringify(body) }] };
}
const found = structuredClone(before); found.tables.gangs.push(family('A')); found.tables.gang_members.push(member('one', 'A'));
found.tables.characters[0].cash = '25000'; found.tables.transactions.push({ id: 'found', character_id: 'one', account_id: null, currency: 'cash', amount: '-25000', reason: 'gang:found', counterparty: null, at });
const formed = input(before, found, '/v1/gangs', { name: 'Family A', tag: 'FA' }, { ok: true, gangId: 'A' });
const cash = structuredClone(found); cash.tables.characters[0].cash = '24877';
Object.assign(cash.tables.gangs[1], { treasury: '123', lifetime_tribute: '123', season_tribute: '123' });
cash.tables.transactions.push({ id: 'cash', character_id: 'one', account_id: null, currency: 'cash', amount: '-123', reason: 'gang:tribute', counterparty: 'A', at });
const paidCash = input(found, cash, '/v1/gangs/tribute', { amount: '123.99' }, { ok: true, amount: 123, currency: 'cash' });
const omr = structuredClone(found); omr.tables.account_persistent[0].omr = '94'; omr.tables.gangs[1].omr_reserve = '6';
omr.tables.transactions.push({ id: 'omr', character_id: null, account_id: 'account-one', currency: 'omr', amount: '-6', reason: 'gang:tribute', counterparty: 'A', at });
const paidOmr = input(found, omr, '/v1/gangs/tribute/omr', { amount: 6.99 }, { ok: true, amount: 6, currency: 'omr' });
const controls = [];
for (const item of [formed, paidCash, paidOmr]) {
  const journal = verifyFamilyEntryBoundary(item, { expected: 1 }); assert.equal(journal.qualifyingFullResourcePass, false);
  controls.push(...familyEntryCorruptions(item));
  const replay = { ...structuredClone(item), before: item.after, commands: item.commands.map(row => ({ ...row, replayed: true })) };
  assert.equal(verifyFamilyEntryBoundary(replay, { expected: 0 }).familyEntry.movements.length, 0);
}
const ammo = structuredClone(paidCash); ammo.after.tables.gangs[1].ammo_bank = 1;
assert.throws(() => verifyFamilyEntryBoundary(ammo, { expected: 1 }), /Family.ammo_bank/);
const unearned = structuredClone(paidCash); unearned.after.tables.gangs[1].season_tribute = '124';
assert.throws(() => verifyFamilyEntryBoundary(unearned, { expected: 1 }), /Family.season_tribute/);
const pocket = structuredClone(paidCash); pocket.after.tables.characters[0].bank = '1'; pocket.after.tables.characters[0].cash = '24876';
assert.throws(() => verifyFamilyEntryBoundary(pocket, { expected: 1 }), /bank custody/);
controls.push(...['missing-ammo-no-change', 'wrong-standing', 'pocket-diversion'].map(name => ({ name, rejection: 'asserted' })));
function unknown(name, state, kind) { const journal = reconcileWorldResources(found, state, { includeRestrictedChanges: true });
  assert(journal.unsupported.some(row => row.kind === kind), name); verifyResourceTableChanges(found, state, journal.restrictedChanges); }
const season = structuredClone(found); season.tables.gangs[1].season++;
unknown('season reset stays unknown', season, 'family-lineage');
const joined = structuredClone(found); joined.tables.gang_members.push({ ...member('other', 'A'), role: 'soldier' });
unknown('joined member remains unknown', joined, 'observed-table-change');
const unsupportedAmmo = structuredClone(found); unsupportedAmmo.tables.gangs[1].ammo_bank = 1;
unknown('unattributed ammo funding remains unknown', unsupportedAmmo, 'family-lineage');
const future = structuredClone(formed); future.after.tables.gangs[1].future_custody = '10';
assert(reconcileWorldResources(future.before, future.after).unsupported.some(row => row.kind === 'family-lineage'), 'New Family columns must never disappear');
const compound = structuredClone(paidCash); compound.after.tables.gangs[1].weekly_progress = '123';
assert(reconcileWorldResources(compound.before, compound.after).unsupported.some(row => row.kind === 'family-entry-compound'));

const directory = process.argv.find(value => value.startsWith('--evidence='))?.slice(11);
if (directory) {
  const run = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8')); await verifyArtifactIndex(directory, run);
  assert.deepEqual(run.source, await sourceIdentity()); assert.equal(run.status, 'PASS_SCOPED');
  let boundaries = 0, nativeControls = 0; const movements = {}, unsupported = {};
  for (const artifact of run.artifacts.filter(row => /^family-entry-boundary-\d+\.json$/.test(row.path))) {
    const item = JSON.parse(await fs.readFile(path.join(directory, artifact.path), 'utf8'));
    const journal = verifyFamilyEntryBoundary(item, { expected: item.expected }); boundaries++;
    for (const row of journal.familyEntry.movements) movements[row.kind] = (movements[row.kind] || 0) + 1;
    for (const row of journal.unsupported) unsupported[`${row.kind}:${row.table || ''}`] = (unsupported[`${row.kind}:${row.table || ''}`] || 0) + 1;
  }
  for (const artifact of run.artifacts.filter(row => /^family-entry-control-\d+\.json$/.test(row.path))) {
    const item = JSON.parse(await fs.readFile(path.join(directory, artifact.path), 'utf8')); assert.throws(() => verifyFamilyEntryBoundary(item.input, { expected: 1 })); nativeControls++;
  }
  console.log(JSON.stringify({ status: 'PASS_SCOPED', source: run.source.revision, boundaries, movements, nativeControls, pureControls: controls.length, unsupported, fullResourceCoverage: false }));
} else console.log(JSON.stringify({ status: 'PASS_PURE_CONTROLS', controls: controls.length, fullResourceCoverage: false }));
