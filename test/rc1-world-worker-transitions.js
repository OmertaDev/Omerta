import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reconcileWorkerTransitions } from '../tools/rc1-world-worker-transitions.js';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';

const empty = () => ({ format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) });
const at = Date.parse('2026-09-24T11:00:00.000Z');
const identity = { outcome: 'COMMITTED', context: { authority: 'original-worker', logicalAt: at } };
const before = empty();
before.tables.street_tax = [{ id: 1, pool: '95', fund: '0', last_buyback: '2026-09-23T23:00:00.000Z' }];
before.tables.exchange_pool = [{ id: 1, balance: '12', lifetime_funded: '16', lifetime_paid: '4' }];
const after = structuredClone(before);
Object.assign(after.tables.street_tax[0], { pool: '0', last_buyback: '2026-09-24T11:00:00.000Z' });
Object.assign(after.tables.exchange_pool[0], { balance: '107', lifetime_funded: '111' });
assert(reconcileWorkerTransitions(before, after, { identity }).exchange);
assert(!reconcileWorldResources(before, after, { identity }).unsupported.some(row => row.table === 'exchange_pool'));
for (const mutate of [
  s => { s.tables.street_tax[0].pool = '1'; },
  s => { s.tables.exchange_pool[0].balance = '106'; },
  s => { s.tables.exchange_pool[0].lifetime_funded = '110'; },
  s => { s.tables.exchange_pool[0].lifetime_paid = '5'; },
  s => { s.tables.street_tax[0].fund = '1'; },
  s => { s.tables.street_tax[0].last_buyback = '2026-09-24T11:01:00.000Z'; },
]) { const changed = structuredClone(after); mutate(changed); assert.throws(() => reconcileWorkerTransitions(before, changed, { identity })); }
assert(!reconcileWorkerTransitions(before, after, { identity: { ...identity, context: { ...identity.context, authority: 'player' } } }).exchange);
const early = structuredClone(before); early.tables.street_tax[0].last_buyback = '2026-09-24T10:00:00.000Z';
assert.throws(() => reconcileWorkerTransitions(early, after, { identity }));

const familyBefore = empty();
familyBefore.tables.gangs = [{ id: 'family', season: 739, season_tribute: '0', season_wars: 0, treasury: '77', omr_reserve: '0', ammo_bank: 0, weekly_progress: '0', weekly_week: null, weekly_done: false }];
const familyAfter = structuredClone(familyBefore); familyAfter.tables.gangs[0].season = 740;
assert(reconcileWorkerTransitions(familyBefore, familyAfter, { identity }).familyFields.get('family').has('season'));
assert(!reconcileWorldResources(familyBefore, familyAfter, { identity }).unsupported.some(row => row.kind === 'family-lineage'));
const diverted = structuredClone(familyAfter); diverted.tables.gangs[0].treasury = '76';
assert(!reconcileWorkerTransitions(familyBefore, diverted, { identity }).familyFields.has('family'));
familyBefore.tables.gang_members = [{ gang_id: 'family', character_id: 'member' }];
const weeklyAfter = structuredClone(familyBefore);
Object.assign(weeklyAfter.tables.gangs[0], { weekly_progress: '1', weekly_week: 2959 });
const crime = { id: 'crime-receipt', character_id: 'member', currency: 'cash', amount: '1775', reason: 'crime:test' };
const crimeIdentity = { ...identity, context: { authority: 'canonical-crime', logicalAt: Date.parse('2026-09-23T23:00:00.000Z') } };
assert(reconcileWorkerTransitions(familyBefore, weeklyAfter, { identity: crimeIdentity, receipts: [crime] }).familyFields.has('family'));
assert.throws(() => reconcileWorkerTransitions(familyBefore, weeklyAfter, { identity: crimeIdentity, receipts: [{ ...crime, character_id: 'outsider' }] }));
const twice = structuredClone(weeklyAfter); twice.tables.gangs[0].weekly_progress = '2';
assert.throws(() => reconcileWorkerTransitions(familyBefore, twice, { identity: crimeIdentity, receipts: [crime] }));
assert.throws(() => reconcileWorkerTransitions(familyBefore, weeklyAfter, { identity: crimeIdentity, receipts: [crime, { ...crime, id: 'duplicate' }] }));

// Optional retained changed-row proof: every actually changed table is included.
// Unchanged rows are omitted in both sides; this is not a fresh full-world pass.
const retained = process.argv.find(arg => arg.startsWith('--retained='))?.slice('--retained='.length);
let retainedCount = 0;
if (retained) {
  for (const file of fs.readdirSync(retained).filter(file => /^restricted-resource-change-.*\.json$/.test(file))) {
    const evidence = JSON.parse(fs.readFileSync(`${retained}/${file}`, 'utf8'));
    const changes = evidence.restrictedChanges.tables;
    const exchange = changes.some(row => row.table === 'exchange_pool');
    const season = changes.length === 1 && changes[0].table === 'gangs'
      && changes[0].beforeRows.length === 1 && changes[0].afterRows.length === 1
      && changes[0].beforeRows[0].season !== changes[0].afterRows[0].season;
    if (!exchange && !season) continue;
    const a = empty(), b = empty();
    for (const change of changes) { a.tables[change.table] = change.beforeRows; b.tables[change.table] = change.afterRows; }
    const proof = reconcileWorkerTransitions(a, b, { identity: evidence.event });
    assert(exchange ? proof.exchange : proof.familyFields.size === 1, `Retained transition not classified: ${file}`);
    retainedCount++;
  }
  assert.equal(retainedCount, 8, 'Retained exchange/season class coverage changed');
}
console.log(JSON.stringify({ status: 'PASS', retainedCount, scope: 'Tax transfer, Family seasonal counters, incomplete crime-task progress; no full-world qualification' }));
