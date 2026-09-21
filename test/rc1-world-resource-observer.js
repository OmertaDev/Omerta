import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources, snapshotWorldResources, createWorldResourceObserver,
  resourceTableChanges, verifyResourceTableChanges } from '../tools/rc1-world-resource-observer.js';

const empty = () => ({ format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) });
const person = { id: 'a', cash: '900719925474099312345678.123456789', bank: '0', ammo: 25, cb: 0 };
const initial = empty(); initial.tables.characters.push(person);
const earned = structuredClone(initial); earned.tables.characters[0].cash = '900719925474099312345678.123456790';
earned.tables.transactions.push({ id: 'cash-receipt', character_id: 'a', currency: 'cash', amount: '0.000000001', reason: 'crime:pick' });
assert.equal(reconcileWorldResources(initial, earned).status, 'PASS_SCOPED_PARITY');
const unbacked = structuredClone(earned); unbacked.tables.transactions = [];
assert.throws(() => reconcileWorldResources(initial, unbacked), /Unexplained cash/);
const rewritten = structuredClone(earned); rewritten.tables.transactions[0].amount = '2';
assert.throws(() => reconcileWorldResources(earned, rewritten), /Immutable transactions/);
const removed = structuredClone(earned); removed.tables.transactions = [];
assert.throws(() => reconcileWorldResources(earned, removed), /Immutable transactions/);
const unsupported = structuredClone(earned); unsupported.tables.transactions[0].reason = 'future:unknown';
assert.equal(reconcileWorldResources(initial, unsupported).unsupported[0].reason, 'future:unknown');

const omr = empty(); omr.tables.account_persistent.push({ account_id: 'a', omr: '100', staked: '0', unbonding: '0', rewards: '999999' });
omr.tables.desk_inventory.push({ id: 1, balance: '0' });
const omrAfter = structuredClone(omr); omrAfter.tables.account_persistent[0].omr = '90'; omrAfter.tables.desk_inventory[0].balance = '10';
const omrJournal = reconcileWorldResources(omr, omrAfter);
assert.equal(omrJournal.checks.find(row => row.resource === 'omr').before, '100', 'Reward claims must not count twice');
assert(omrJournal.unsupported.some(row => row.kind === 'omr-owner-lineage'), 'Equal totals are not complete owner lineage');
omrAfter.tables.desk_inventory[0].balance = '10.000000001';
assert.throws(() => reconcileWorldResources(omr, omrAfter), /Unexplained omr/);

const stackBefore = empty(), stackAfter = empty();
const completedGuard = (idempotency_key, mutation_id = null) => ({ idempotency_key, mutation_id, completed_at: '2026-09-21T00:00:00.000Z', result_json: '{}' });
stackAfter.tables.item_stacks.push({ owner_scope: 'account', owner_id: 'a:b', template_id: 'c', quality: 'standard', quantity: 3 });
stackAfter.tables.item_events.push({ id: 'stack-event', sequence: '1', event_kind: 'stack_granted', template_id: 'c', quality: 'standard',
  idempotency_key: 'stack', to_owner_scope: 'account', to_owner_id: 'a:b', quantity_before: 0, quantity_delta: 3, quantity_after: 3 });
stackAfter.tables.item_mutation_guards.push(completedGuard('stack'));
assert.equal(reconcileWorldResources(stackBefore, stackAfter).checks.find(row => row.resource === 'stack').after, '3');
const collision = structuredClone(stackAfter); collision.tables.item_stacks[0].owner_id = 'a'; collision.tables.item_stacks[0].template_id = 'b:c';
assert.throws(() => reconcileWorldResources(stackBefore, collision), /Unexplained stack/);
const badEvent = structuredClone(stackAfter); badEvent.tables.item_events[0].quantity_after = 4;
assert.throws(() => reconcileWorldResources(stackBefore, badEvent), /internal quantity/);

const lotBefore = empty(), lotAfter = empty();
lotAfter.tables.item_lots.push({ lot_id: 'lot', owner_scope: 'account', owner_id: 'a', remaining_quantity: 4 });
lotAfter.tables.item_events.push({ id: 'lot-event', sequence: '1', lot_id: 'lot', item_id: null, event_kind: 'lot_granted', event_branch: 'lot',
  mutation_id: 'm', idempotency_key: 'lot-key', event_ordinal: 0, definition_hash: 'd', snapshot_json: '{}', quantity_before: 0, quantity_delta: 4, quantity_after: 4, to_owner_scope: 'account', to_owner_id: 'a' });
lotAfter.tables.item_mutation_guards.push(completedGuard('lot-key', 'm'));
lotAfter.tables.item_mutation_outputs.push({ event_id: 'lot-event', mutation_id: 'm', output_ordinal: 0, definition_hash: 'd', snapshot_json: '{}', lot_id: 'lot', item_id: null, quantity: 4 });
assert(reconcileWorldResources(lotBefore, lotAfter).checks.some(row => row.resource === 'item_lots'));
const lostLot = structuredClone(lotAfter); lostLot.tables.item_lots[0].remaining_quantity = 5;
assert.throws(() => reconcileWorldResources(lotBefore, lostLot), /Item final quantity/);
const badOutput = structuredClone(lotAfter); badOutput.tables.item_mutation_outputs[0].quantity = 5;
assert.throws(() => reconcileWorldResources(lotBefore, badOutput), /Output quantity/);
const missingOutput = structuredClone(lotAfter); missingOutput.tables.item_mutation_outputs = [];
assert.throws(() => reconcileWorldResources(lotBefore, missingOutput), /exactly one matching/);

const capitalBefore = empty(); capitalBefore.tables.characters.push({ id: 'a', cash: '500', bank: '0', ammo: 25, cb: 0 });
const capitalAfter = structuredClone(capitalBefore); capitalAfter.tables.characters[0].cash = '400';
capitalAfter.tables.world_operation_capital.push({ operation_id: 'op', role_id: 'role', requirement_id: 'funding', state: 'held', amount: 100 });
capitalAfter.tables.transactions.push({ id: 'capital', character_id: 'a', currency: 'cash', amount: '-100', reason: 'coordination:capital:deposit', counterparty: 'op' });
assert(reconcileWorldResources(capitalBefore, capitalAfter).checks.some(row => row.owner === 'operation:op' && row.after === '100'));
capitalAfter.tables.world_operation_capital[0].amount = 101;
assert.throws(() => reconcileWorldResources(capitalBefore, capitalAfter), /Unexplained cash.*operation/);
const oldCar = empty(), movedCar = empty();
oldCar.tables.cars = [{ id: 'car', character_id: 'owner-before', pledged: true, listed: false, minted_onchain: false }];
movedCar.tables.cars = [{ id: 'car', character_id: 'owner-after', pledged: false, listed: false, minted_onchain: false }];
const changes = resourceTableChanges(oldCar, movedCar); assert(verifyResourceTableChanges(oldCar, movedCar, changes));
const diagnostic = reconcileWorldResources(oldCar, movedCar, { includeRestrictedChanges: true });
assert.equal(diagnostic.status, 'PASS_PARITY_WITH_UNSUPPORTED_LINEAGE'); assert(diagnostic.unsupported.some(row => row.table === 'cars'));
assert.deepEqual(diagnostic.restrictedChanges, changes);
assert.equal(reconcileWorldResources(oldCar, movedCar).restrictedChanges, undefined, 'Raw ownership rows require explicit restricted-evidence opt-in');
const lostOwner = structuredClone(changes); delete lostOwner.tables[0].afterRows[0].character_id;
assert.throws(() => verifyResourceTableChanges(oldCar, movedCar, lostOwner), /owner\/custody\/value detail was lost/);
const lostCustody = structuredClone(changes); delete lostCustody.tables[0].beforeRows[0].pledged;
assert.throws(() => verifyResourceTableChanges(oldCar, movedCar, lostCustody), /Missing exact before row/);
const lostTable = structuredClone(changes); lostTable.tables = [];
assert.throws(() => verifyResourceTableChanges(oldCar, movedCar, lostTable), /Missing changed table/);
const duplicateBefore = empty(), duplicateAfter = empty(); duplicateBefore.tables.cars = [oldCar.tables.cars[0], oldCar.tables.cars[0]];
duplicateAfter.tables.cars = [oldCar.tables.cars[0]];
const duplicateDelta = resourceTableChanges(duplicateBefore, duplicateAfter);
assert.equal(duplicateDelta.tables[0].beforeRows.length, 1); assert(verifyResourceTableChanges(duplicateBefore, duplicateAfter, duplicateDelta));
const fractionalBefore = empty(), fractionalAfter = empty();
fractionalBefore.tables.gangs = [{ id: 'g', treasury: '9007199254740993123.123456789', omr_reserve: '0', ammo_bank: 0 }];
fractionalAfter.tables.gangs = [{ ...fractionalBefore.tables.gangs[0], treasury: '9007199254740993123.123456788' }];
const fractionalDelta = resourceTableChanges(fractionalBefore, fractionalAfter);
assert.equal(fractionalDelta.tables[0].afterRows[0].treasury, '9007199254740993123.123456788');
assert(verifyResourceTableChanges(fractionalBefore, fractionalAfter, fractionalDelta));
console.log('PASS: exact resource parity, immutable receipts, unsupported status and lossless restricted ownership/custody diagnostics');

if (process.argv.includes('--postgres')) {
  const development = process.argv.includes('--development');
  const { sourceIdentity, assertSourceUnchanged } = await import('../tools/rc1-native-proof.js');
  const source = development ? { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), development: true } : await sourceIdentity();
  assert(process.env.RC1_RESOURCE_DATABASE_URL, 'Explicit isolated local PostgreSQL endpoint required');
  const endpoint = new URL(process.env.RC1_RESOURCE_DATABASE_URL); assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname));
  const runId = `world-resource-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
  const output = path.resolve(process.env.RC1_RESOURCE_OUTPUT || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
  fs.mkdirSync(output, { recursive: true }); assert(!fs.existsSync(path.join(output, 'result.json')), 'Never overwrite evidence');
  const report = { runId, source, evidenceClass: development ? 'DEVELOPMENT_DIAGNOSTIC' : 'NATIVE_FIXTURE_ASSISTED',
    outcome: 'FAIL', startedAt: new Date().toISOString(), fixture: 'One account/character with declared initial cash100000 and respect10000; no progression claim',
    command: 'node test/rc1-world-resource-observer.js --postgres', qualifyingFullResourcePass: false,
    exclusions: ['Original worker integration', 'Per-commit proxy hook', 'Full resource taxonomy and matrix', 'Real deployment and chain backing', 'Native lot/capital branches in this focused invocation'] };
  const save = () => fs.writeFileSync(path.join(output, 'result.json'), json(report) + '\n');
  const json = value => JSON.stringify(value, null, 2); save();
  const { Pool } = await import('pg'); const admin = new Pool({ connectionString: endpoint.toString() });
  const database = `rc1_world_resource_${crypto.randomBytes(8).toString('hex')}`; let pool;
  try {
    await admin.query(`CREATE DATABASE ${database}`); endpoint.pathname = `/${database}`; process.env.DATABASE_URL = endpoint.toString();
    const { makeDb } = await import('../src/db.js'); pool = await makeDb();
    report.databaseVersion = (await pool.query('SELECT version() AS version')).rows[0].version;
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('observer-account','test','observer-account')");
    await pool.query("INSERT INTO account_persistent(account_id) VALUES('observer-account')");
    await pool.query("INSERT INTO characters(id,account_id,name,season,cash,respect) VALUES('observer-character','observer-account','Observer',1,100000,10000)");
    const before = await snapshotWorldResources(pool); fs.writeFileSync(path.join(output, 'initial-state.json'), json(before));
    const retained = [];
    const observer = createWorldResourceObserver({ pool, record: async entry => { retained.push(entry); fs.appendFileSync(path.join(output, 'movements.ndjson'), JSON.stringify(entry) + '\n'); } });
    const { withCharacter, doCrime } = await import('../src/game.js');
    const { offerLoan, cancelLoan } = await import('../src/loans.js');
    const { createGang } = await import('../src/social/gangs.js');
    const { grantStack, consumeStack, createItem, transferItem, consumeItem, withItemTransaction } = await import('../src/items.js');
    const a = { scope: 'account', id: 'observer-account' }, b = { scope: 'character', id: 'observer-character' };
    const watch = (name, work) => observer.observe({ authority: 'native-canonical-domain', name }, work);
    const loan = await watch('loan-offer', () => withCharacter(pool, a.id, (ch, client, h) => offerLoan(ch, { amount: 5000, rate: .1, hours: 1 }, client, h)));
    await watch('loan-refund', () => withCharacter(pool, a.id, (ch, client, h) => cancelLoan(ch, loan.id, client, h)));
    const familyBefore = await observer.snapshot();
    await watch('canonical-family-found', () => withCharacter(pool, a.id, (ch, client, h) => createGang(ch, 'Observer Family', 'ROBS', client, h)));
    const familyAfter = await observer.snapshot(), familyJournal = reconcileWorldResources(familyBefore, familyAfter, { includeRestrictedChanges: true });
    assert(familyJournal.unsupported.some(row => row.kind === 'family-lineage'));
    assert(verifyResourceTableChanges(familyBefore, familyAfter, familyJournal.restrictedChanges));
    fs.writeFileSync(path.join(output, 'restricted-family-row-changes.json'), json(familyJournal.restrictedChanges));
    report.restrictedDiagnostics = { nativeBranch: 'canonical Family formation', hash: familyJournal.restrictedChangesSha256,
      reconstructedExact: true, unsupportedStatusPreserved: true, publicRowsIncluded: false };
    await watch('crime', () => withCharacter(pool, a.id, (ch, client, h) => doCrime(ch, 'pick', client, h, 'standard')));
    const grant = () => withItemTransaction(pool, client => grantStack(client, a, 'mat:scrap_steel', 10, 'standard', 'declared observer test grant', 'observer-stack-grant'));
    await watch('canonical-stack-grant', grant); await watch('stack-exact-replay', grant);
    await watch('canonical-stack-consume', () => withItemTransaction(pool, client => consumeStack(client, a, 'mat:scrap_steel', 4, 'standard', 'observer consume', 'observer-stack-consume')));
    await assert.rejects(watch('stack-refusal', () => withItemTransaction(pool, client => consumeStack(client, a, 'mat:scrap_steel', 99, 'standard', 'observer refuse', 'observer-stack-refuse'))), error => error.code === 'materials');
    const unique = await watch('unique-create', () => withItemTransaction(pool, client => createItem(client, a, 'observer:trophy', 'awarded', 'observer-unique-create')));
    await watch('unique-transfer', () => withItemTransaction(pool, client => transferItem(client, a, b, unique.id, 'observer transfer', 'observer-unique-transfer')));
    await watch('unique-consume', () => withItemTransaction(pool, client => consumeItem(client, b, unique.id, 'observer consume', 'observer-unique-consume')));
    report.canonicalBoundaries = retained.filter(row => row.kind === 'world-resource-boundary').length;
    report.parityChecks = retained.filter(row => row.kind === 'world-resource-boundary').flatMap(row => row.journal.checks).length;
    fs.writeFileSync(path.join(output, 'pre-injection-state.json'), json(await snapshotWorldResources(pool)));
    // Negative control intentionally leaves the impossible committed change in its
    // private database. Never restore it and call the resulting history clean.
    await assert.rejects(watch('deliberate-unexplained-cash', () => pool.query("UPDATE characters SET cash=cash+0.000000001 WHERE id='observer-character'")), /Unexplained cash/);
    const failed = retained.filter(row => row.kind === 'world-resource-failure' && row.identity.name === 'deliberate-unexplained-cash');
    assert.equal(failed.length, 1); assert(failed[0].before && failed[0].after);
    report.negativeControl = { outcome: 'REJECTED_WITH_RETAINED_BEFORE_AFTER', quantity: '0.000000001' };
    report.outcome = 'SCOPED_PASS'; report.sourceImmutable = development ? null : true;
  } catch (error) { report.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
  finally {
    if (pool) await pool.end(); await admin.end();
    if (!development) try { await assertSourceUnchanged(source); report.sourceImmutable = true; }
    catch (error) { report.sourceImmutable = false; report.outcome = 'FAIL'; report.error = { message: error.message }; process.exitCode = 1; }
    report.endedAt = new Date().toISOString(); report.artifacts = fs.readdirSync(output).filter(file => file !== 'result.json').map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') })); save();
    console.log(JSON.stringify({ runId, outcome: report.outcome, output, source: source.revision, error: report.error?.message }));
  }
}
