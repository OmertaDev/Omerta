import assert from 'node:assert/strict';
import { CREW_LOGISTICS, validateCrewLogisticsTarget, crewLogisticsSourceView, publishCrewLogisticsLink, revokeCrewLogisticsLink, crewLogisticsBoard } from '../src/crewlogistics.js';
const now = new Date('2026-10-11T12:00:00Z'), future = new Date(now.getTime() + 1000);
const actor = { id: 'actor', account_id: 'owner', generation: 1, alive: true, name: 'Public Alias' };
const warehouse = { id: 'lease', district: 'Docks', good_id: 'gin', tenant_character: actor.id, units: 10, held_qty: 7, status: 'active', expires_at: future,
  cash_per_unit_day: 90000, fee_cash: 900000, provider_key: 'SECRET', private_inventory: 'SECRET' };
assert.equal(CREW_LOGISTICS.termMs, 86400000); assert.equal(CREW_LOGISTICS.memberLimit, 8); assert.equal(CREW_LOGISTICS.crewLimit, 32);
for (const kind of ['tender', 'delivery_commitment', 'warehouse_claim']) assert.deepEqual(validateCrewLogisticsTarget({ kind, targetId: 'safe-id' }), { kind, targetId: 'safe-id' });
for (const body of [null, [], {}, { kind: 'unknown', targetId: 'a' }, { kind: 'tender', targetId: '../a' }, { kind: 'tender', targetId: 'a'.repeat(129) }, { kind: 'tender', targetId: 'a', authority: true }]) assert.throws(() => validateCrewLogisticsTarget(body), e => e.code === 'crew_logistics');
const publicWarehouse = crewLogisticsSourceView('warehouse_claim', warehouse, actor.id, now);
assert.deepEqual(Object.keys(publicWarehouse).sort(), ['kind','targetId','good','district','status','deadline'].sort());
assert(!JSON.stringify(publicWarehouse).includes('SECRET')); assert(!Object.hasOwn(publicWarehouse, 'heldQty')); assert(!Object.hasOwn(publicWarehouse, 'units'));
assert.equal(crewLogisticsSourceView('warehouse_claim', { ...warehouse, expires_at: now }, actor.id, now).status, 'expired');
assert.equal(crewLogisticsSourceView('warehouse_claim', { ...warehouse, status: 'landlord_closed' }, actor.id, now).status, 'landlord_closed');
const delivery = { id: 'delivery', district: 'Docks', supplier_character: actor.id, good_id: 'gin', status: 'accepted', quantity: 10, remaining: 3, deadline: future, spent: 70000, spend_limit: 100000 };
assert.equal(crewLogisticsSourceView('delivery_commitment', delivery, actor.id, now).quantityDelivered, 7);
assert.equal(crewLogisticsSourceView('delivery_commitment', { ...delivery, deadline: now }, actor.id, now).status, 'expired');
const tender = { id: 'tender', order_good: 'gin', buyer_character: actor.id, district: 'Docks', status: 'open', qty: 4, offers_close_at: future, unit_price: 100000 };
assert.equal(crewLogisticsSourceView('tender', tender, actor.id, now).status, 'open');
assert.equal(crewLogisticsSourceView('tender', { ...tender, offers_close_at: now }, actor.id, now).status, 'expired');
for (const [kind, row] of [['tender', tender], ['delivery_commitment', delivery], ['warehouse_claim', warehouse]]) {
  assert.throws(() => crewLogisticsSourceView(kind, row, 'foreign', now));
  assert.throws(() => crewLogisticsSourceView(kind, { ...row, status: 'invented' }, actor.id, now));
  assert.throws(() => crewLogisticsSourceView(kind, { ...row, id: 'x'.repeat(129) }, actor.id, now));
  assert.throws(() => crewLogisticsSourceView(kind, { ...row, id: '../target' }, actor.id, now));
  assert.throws(() => crewLogisticsSourceView(kind, { ...row, good_id: 'unexpected', order_good: 'unexpected' }, actor.id, now));
  assert.throws(() => crewLogisticsSourceView(kind, row, 'x'.repeat(129), now));
}
assert.throws(() => crewLogisticsSourceView('delivery_commitment', { ...delivery, remaining: 11 }, actor.id, now));
assert.throws(() => crewLogisticsSourceView('warehouse_claim', { ...warehouse, held_qty: 11 }, actor.id, now));

function fake({ links = [], leader = actor.account_id, sourceRow = { ...warehouse, expires_at: new Date(Date.now() + 100000) }, hasMember = true } = {}) {
  const writes = [], queries = [];
  const client = { async query(sql, values) {
    queries.push({ sql, values });
    if (/^SELECT m\.crew_id/.test(sql)) return { rows: hasMember ? [{ crew_id: 'crew', leader_account: leader }] : [] };
    if (/^SELECT l\.\*,d\.district/.test(sql)) return { rows: [sourceRow] };
    if (/^SELECT l\.\*/.test(sql)) return { rows: links };
    if (/^SELECT \* FROM crew_logistics_links/.test(sql)) return { rows: links.filter(l => l.id === values[0] && l.crew_id === values[1]) };
    if (/^(INSERT|UPDATE)/.test(sql)) { writes.push({ sql, values }); return { rows: [] }; }
    assert.fail(`unexpected fake query: ${sql}`);
  } };
  return { client, writes, queries };
}
const f = fake(); const published = await publishCrewLogisticsLink(actor, { kind: 'warehouse_claim', targetId: 'lease' }, f.client);
assert.equal(new Date(published.link.expiresAt) - new Date(published.link.createdAt), 86400000);
assert.equal(f.writes.filter(w => w.sql.startsWith('INSERT')).length, 1);
assert(f.writes.every(w => /crew_logistics_links/.test(w.sql)), 'consent only: no canonical source, treasury or cargo writes');
assert(!JSON.stringify(published).includes('SECRET')); assert.equal(published.link.publisher, actor.name);
const link = { id: 'link', crew_id: 'crew', publisher_account_id: actor.account_id, publisher_character_id: actor.id, generation: 1, kind: 'warehouse_claim', target_id: 'lease',
  created_at: new Date(), expires_at: new Date(Date.now() + 100000), revoked_at: null, publisher_name: actor.name };
const duplicate = fake({ links: [link] });
assert.equal((await publishCrewLogisticsLink(actor, { kind: 'warehouse_claim', targetId: 'lease' }, duplicate.client)).link.id, 'link');
assert(!duplicate.writes.some(w => w.sql.startsWith('INSERT')), 'same-source publication never extends the fixed display term');
for (const [links, code] of [[Array.from({ length: 8 }, (_, i) => ({ ...link, target_id: `other${i}` })), 'crew_logistics_limit'],
  [Array.from({ length: 32 }, (_, i) => ({ ...link, publisher_account_id: `other${i}`, target_id: `other${i}` })), 'crew_logistics_limit']]) {
  const x = fake({ links }); await assert.rejects(publishCrewLogisticsLink(actor, { kind: 'warehouse_claim', targetId: 'lease' }, x.client), e => e.code === code);
  assert(!x.writes.some(w => w.sql.startsWith('INSERT')));
}
for (const changes of [{ alive: false }, { generation: 0 }, { is_npc: true }]) { const x = fake(); await assert.rejects(publishCrewLogisticsLink({ ...actor, ...changes }, { kind: 'warehouse_claim', targetId: 'lease' }, x.client)); assert.equal(x.writes.length, 0); }
await assert.rejects(publishCrewLogisticsLink(actor, { kind: 'warehouse_claim', targetId: 'lease' }, fake({ hasMember: false }).client), e => e.code === 'no_crew');
await assert.rejects(publishCrewLogisticsLink(actor, { kind: 'warehouse_claim', targetId: 'lease' }, fake({ sourceRow: { ...warehouse, tenant_character: 'foreign' } }).client));
const outsider = { ...link, publisher_account_id: 'other' };
const leader = fake({ links: [outsider] }); assert.deepEqual(await revokeCrewLogisticsLink(actor, 'link', leader.client), { revoked: 'link' }); assert.equal(leader.writes.length, 1);
const nonleader = fake({ links: [outsider], leader: 'boss' }); await assert.rejects(revokeCrewLogisticsLink(actor, 'link', nonleader.client)); assert.equal(nonleader.writes.length, 0);
const own = fake({ links: [link], leader: 'boss' }); await revokeCrewLogisticsLink(actor, 'link', own.client); assert.equal(own.writes.length, 1);
const board = await crewLogisticsBoard(fake({ links: [link] }).client, actor);
assert.equal(board.links.length, 1); assert.equal(board.sharedExecutionAuthority, false); assert.equal(board.causalEffect, null); assert(!JSON.stringify(board).includes('SECRET'));
const filteredSql = fake({ links: [link] }); await crewLogisticsBoard(filteredSql.client, actor);
assert(filteredSql.queries.some(q => /c\.alive/.test(q.sql) && /c\.generation=l\.generation/.test(q.sql) && /JOIN crew_members/.test(q.sql)), 'query pins current membership and living original actor; real DB evidence pending');
// Seed 3919, 200 bounded privacy/progress projection cases, no native concurrency claim.
let seed = 3919; const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let i = 0; i < 200; i++) { const quantity = random() % 40 + 1, remaining = random() % (quantity + 1);
  const projected = crewLogisticsSourceView('delivery_commitment', { ...delivery, quantity, remaining, key: 'SECRET', cash: random() }, actor.id, now);
  assert.equal(projected.quantityDelivered, quantity - remaining); assert(!JSON.stringify(projected).includes('SECRET')); assert(!Object.hasOwn(projected, 'cash')); }
console.log('crewlogistics: pure + fake-query consent/limits/privacy/current-state PASS; seed3919 200 cases; native membership/rejoin/lock races and canonical storage integration unproven');
