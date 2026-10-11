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

// Actual repository storage and lifecycle tests. Native mode requires a disposable local DB.
const native = process.argv.includes('--postgres');
if (native) {
  const dbUrl = new URL(process.env.CREW_LOGISTICS_TEST_DATABASE_URL || 'http://missing');
  if (dbUrl.protocol !== 'postgresql:' || dbUrl.hostname !== '127.0.0.1' || !/^\/crew_logistics_[A-Za-z0-9_]+$/.test(dbUrl.pathname)) throw new Error('Use an isolated local crew_logistics_ PostgreSQL database.');
  process.env.DATABASE_URL = dbUrl.href; process.env.MARKET_SEED = 'crew-logistics-local-test-seed';
}
process.env.MOD_KEY = 'crew-logistics-local-test-mod'; process.env.RATE_LIMIT = 'off'; process.env.JWT_SECRET = 'crew-logistics-module-local-secret'; process.env.SOCIAL_VERIFY_MODE = 'off'; process.env.DEPOT_PILOT = 'on';
const { buildServer } = await import('../src/server.js');
const G = await import('../src/game.js');
const C = await import('../src/crew.js');
const D = await import('../src/depot.js');
const app = await buildServer();
async function createPlayer(name) {
  const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const response = await app.inject({ method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${token}`, 'idempotency-key': name }, payload: { name } });
  assert.equal(response.statusCode, 200, response.body);
  const accountId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
  const row = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [accountId])).rows[0];
  await app.pool.query('UPDATE characters SET respect=100000,cash=100000 WHERE id=$1', [row.id]);
  return { accountId, id: row.id, name };
}
const mutate = (p, fn) => G.withCharacter(app.pool, p.accountId, fn, C.CREW_FIRST_CHARACTER_LOCKS);
const readBoard = p => G.withCharacterReadLocked(app.pool, p.accountId, (ch, client) => crewLogisticsBoard(client, ch), C.CREW_FIRST_CHARACTER_LOCKS);
try {
  const boss = await createPlayer('Crew Logistics Boss'), member = await createPlayer('Crew Logistics Member');
  const formed = await G.withCharacter(app.pool, boss.accountId, (ch, client, h) => C.createCrew(ch, 'Logistics Consent Crew', client, h));
  const join = async (joining = member) => {
    await mutate(boss, (ch, client, h) => C.inviteToCrew(ch, joining.name, client, h));
    await G.withCharacter(app.pool, joining.accountId, (ch, client, h) => C.acceptInvite(ch, formed.id, client, h));
  };
  await join();
  const depot = await G.withCharacter(app.pool, boss.accountId, (ch, client, h) => D.openDepot(ch, { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 }, client, h));
  const created = new Date(), expires = new Date(created.getTime() + 86400000);
  const claimId = 'canonical-warehouse-claim';
  await app.pool.query("INSERT INTO business_warehouse_leases(id,depot_id,landlord_character,tenant_character,good_id,units,held_qty,cash_per_unit_day,fee_cash,offer_revision,created_at,expires_at,status) VALUES($1,$2,$3,$4,'gin',1,0,1,1,1,$5,$6,'active')", [claimId, depot.id, boss.id, member.id, created, expires]);
  const publish = (p = member, targetId = claimId, kind = 'warehouse_claim') => mutate(p, (ch, client) => publishCrewLogisticsLink(ch, { kind, targetId }, client));
  const consent = await publish();
  assert.equal((await readBoard(boss)).links.length, 1);
  const duplicateConsent = await publish(); assert.equal(duplicateConsent.link.id, consent.link.id); assert.equal(duplicateConsent.link.expiresAt, consent.link.expiresAt);
  await assert.rejects(publish(boss), e => e.code === 'crew_logistics', 'leader cannot publish for tenant');
  // A genuinely overdue accrual clock must remain untouched by the read boundary.
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [boss.id, new Date(Date.now() - 7200000)]);
  const snapshot = async () => ({ character: (await app.pool.query('SELECT * FROM characters WHERE id=$1', [boss.id])).rows[0],
    persistent: (await app.pool.query('SELECT * FROM account_persistent WHERE account_id=$1', [boss.accountId])).rows[0],
    cashRows: (await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n });
  const beforeRead = await snapshot(); await readBoard(boss); assert.deepEqual(await snapshot(), beforeRead, 'private GET does not accrue, persist or post ledger rows');
  for (const sql of ['UPDATE characters SET cash=0', 'SELECT * FROM business_depots FOR UPDATE', 'SELECT * FROM business_depots FOR SHARE', 'SELECT * FROM business_depots FOR KEY SHARE', 'SELECT * FROM business_depots FOR NO KEY UPDATE', 'SELECT 1; DELETE FROM crew_logistics_links']) {
    await assert.rejects(G.withCharacterReadLocked(app.pool, boss.accountId, (_ch, client) => client.query(sql), C.CREW_FIRST_CHARACTER_LOCKS), /read path attempted a write/);
  }
  assert.deepEqual(await snapshot(), beforeRead);
  await mutate(member, (ch, client, h) => C.leaveCrew(ch, client, h));
  assert((await app.pool.query('SELECT revoked_at FROM crew_logistics_links WHERE id=$1', [consent.link.id])).rows[0].revoked_at);
  await assert.rejects(readBoard(member), e => e.code === 'no_crew');
  await join(); assert.equal((await readBoard(boss)).links.length, 0, 'leave/rejoin never revives old consent');
  const renewed = await publish(); assert.notEqual(renewed.link.id, consent.link.id);
  await mutate(boss, (ch, client, h) => C.kickMember(ch, member.id, client, h));
  assert((await app.pool.query('SELECT revoked_at FROM crew_logistics_links WHERE id=$1', [renewed.link.id])).rows[0].revoked_at);
  await join(); assert.equal((await readBoard(boss)).links.length, 0, 'kick/rejoin never revives old consent');
  const currentConsent = await publish();
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [member.id]);
  assert.equal((await readBoard(boss)).links.length, 0, 'dead publisher character cannot reveal old source');
  const originalGeneration = Number((await app.pool.query('SELECT generation FROM characters WHERE id=$1', [member.id])).rows[0].generation);
  await app.pool.query('UPDATE characters SET alive=true,generation=$2 WHERE id=$1', [member.id, originalGeneration + 1]);
  assert.equal((await readBoard(boss)).links.length, 0, 'heir generation never inherits prior display consent');
  await app.pool.query('UPDATE characters SET generation=$2 WHERE id=$1', [member.id, originalGeneration]);
  assert.equal((await readBoard(boss)).links.length, 1);
  const expiredAt = new Date(Date.now() - 1000);
  await app.pool.query('UPDATE crew_logistics_links SET created_at=$2,expires_at=$3 WHERE id=$1', [currentConsent.link.id, new Date(expiredAt.getTime() - 86400000), expiredAt]);
  assert.equal((await readBoard(boss)).links.length, 0, 'expired display consent disappears without touching cargo');
  const finalConsent = await publish(); assert.notEqual(finalConsent.link.id, currentConsent.link.id);
  await mutate(boss, (ch, client) => revokeCrewLogisticsLink(ch, finalConsent.link.id, client));
  assert.equal((await readBoard(boss)).links.length, 0);
  // Seed canonical table-shaped references to exercise the domain's display cap, not delivery acceptance/funding.
  for (let i = 0; i < 9; i++) await app.pool.query("INSERT INTO delivery_commitments(id,order_id,depot_id,buyer_character,supplier_character,good_id,district,unit_price,take_bps,quantity,remaining,spend_limit,spent,status,deadline) VALUES($1,$2,$3,$4,$5,'gin',$6,50,0,1,1,50,0,'accepted',$7)",
    [`crew-delivery-${i}`, 'fixture-order', depot.id, boss.id, member.id, depot.district, expires]);
  for (let i = 0; i < 7; i++) await publish(member, `crew-delivery-${i}`, 'delivery_commitment');
  if (native) {
    const lastSlot = await Promise.allSettled([publish(member, 'crew-delivery-7', 'delivery_commitment'), publish(member, 'crew-delivery-8', 'delivery_commitment')]);
    assert.equal(lastSlot.filter(r => r.status === 'fulfilled').length, 1);
    const refused = lastSlot.find(r => r.status === 'rejected'); assert.equal(refused.reason.code, 'crew_logistics_limit');
  } else {
    await publish(member, 'crew-delivery-7', 'delivery_commitment');
    await assert.rejects(publish(member, 'crew-delivery-8', 'delivery_commitment'), e => e.code === 'crew_logistics_limit');
  }
  assert.equal((await readBoard(boss)).links.length, 8);
  assert.equal((await app.pool.query('SELECT held_qty FROM business_warehouse_leases WHERE id=$1', [claimId])).rows[0].held_qty, 0, 'display transitions never change native custody');
  // Link a genuinely funded local tender using its unchanged native business authority.
  const T = await import('../src/supplytenders.js');
  await G.withCharacter(app.pool, boss.accountId, (ch, client, h) => D.fundDepot(ch, depot.id, 4000, client, h));
  const ordered = await G.withCharacter(app.pool, boss.accountId, (ch, client, h) => D.restockDepot(ch, depot.id, client, h));
  const canonicalOrder = (await app.pool.query("SELECT id,qty,price FROM market_listings WHERE depot_id=$1 AND status='live'", [depot.id])).rows[0];
  assert(ordered.ok && canonicalOrder);
  const fundedTender = await G.withCharacter(app.pool, boss.accountId, (ch, client) => T.publishSupplyTender(ch, depot.id, canonicalOrder.id,
    { qty: Number(canonicalOrder.qty), unitPrice: Number(canonicalOrder.price), offersCloseAt: new Date(Date.now() + 300000).toISOString() }, client));
  const tenderConsent = await publish(boss, fundedTender.tender.id, 'tender');
  assert.equal(tenderConsent.link.source.good, 'gin'); assert(!Object.hasOwn(tenderConsent.link.source, 'unitPrice'));
  await assert.rejects(publish(member, fundedTender.tender.id, 'tender'), e => e.code === 'crew_logistics');
  // Four consented Crew members reach the exact bounded32-row board; no source custody is shared.
  const third = await createPlayer('Crew Logistics Third'), fourth = await createPlayer('Crew Logistics Fourth');
  await join(third); await join(fourth);
  for (const [who, count] of [[boss, 7], [third, 8], [fourth, 8]]) {
    for (let i = 0; i < count; i++) {
      const reference = `crew-display-${who.id}-${i}`;
      await app.pool.query("INSERT INTO delivery_commitments(id,order_id,depot_id,buyer_character,supplier_character,good_id,district,unit_price,take_bps,quantity,remaining,spend_limit,spent,status,deadline) VALUES($1,$2,$3,$4,$5,'gin',$6,50,0,1,1,50,0,'accepted',$7)",
        [reference, 'fixture-order', depot.id, member.id, who.id, depot.district, expires]);
      await publish(who, reference, 'delivery_commitment');
    }
  }
  assert.equal((await readBoard(boss)).links.length, 32, 'four members share only bounded explicit consented source summaries');
  if (native) {
    async function waitForHold(held, read) {
      let timer;
      try {
        await Promise.race([held, read.then(() => assert.fail('board read completed before hold')),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('board hold observation timed out')), 5000); })]);
      } finally { clearTimeout(timer); }
    }
    // Isolate the Crew race from phase-one accrual, which locks the character first.
    await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [member.id, new Date(Date.now() + 60000)]);
    let releaseRead, readHeld; const held = new Promise(resolve => { readHeld = resolve; });
    const hold = new Promise(resolve => { releaseRead = resolve; });
    const boardRead = G.withCharacterReadLocked(app.pool, member.accountId, async (ch, client) => { readHeld(); await hold; return crewLogisticsBoard(client, ch); }, C.CREW_FIRST_CHARACTER_LOCKS);
    let backendPid, leaving;
    const observedPool = { query: (...params) => app.pool.query(...params), async connect() {
      const client = await app.pool.connect();
      backendPid = (await client.query('SELECT pg_backend_pid() pid')).rows[0].pid;
      await client.query("SET lock_timeout='5s'");
      await client.query("SET statement_timeout='8s'");
      return { release: () => client.release(), query: (...params) => client.query(...params) };
    } };
    let blocked = false, authorizedBeforeLeave;
    try {
      await waitForHold(held, boardRead);
      leaving = G.withCharacter(observedPool, member.accountId, (ch, client, h) => C.leaveCrew(ch, client, h), C.CREW_FIRST_CHARACTER_LOCKS);
      leaving.catch(() => {});
      for (let i = 0; i < 150; i++) {
        const activity = backendPid && (await app.pool.query('SELECT wait_event_type,query FROM pg_stat_activity WHERE pid=$1', [backendPid])).rows[0];
        if (activity?.wait_event_type === 'Lock' && /FROM\s+crews\b[\s\S]*FOR\s+UPDATE/i.test(activity.query)) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert(blocked, 'real leave must wait at Crew lock while private board holds membership boundary');
      releaseRead(); authorizedBeforeLeave = await boardRead; await leaving;
    } finally {
      releaseRead();
      await Promise.allSettled([boardRead, leaving].filter(Boolean));
    }
    assert.equal(authorizedBeforeLeave.links.length, 32); await assert.rejects(readBoard(member), e => e.code === 'no_crew');
    assert.equal((await readBoard(boss)).links.length, 24);
    console.log('crewlogistics PostgreSQL: observed leave Lock wait behind read Crew boundary; authorized old snapshot then removal rejects subsequent read PASS');
    // Due accrual commits in its own transaction before the Crew-first action.
    // Exercise its character wait too, rather than masking it with the fixture above.
    await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [third.id, new Date(Date.now() - 60000)]);
    let releaseDueRead, dueReadHeld, dueLeaving;
    const dueHeld = new Promise(resolve => { dueReadHeld = resolve; });
    const dueHold = new Promise(resolve => { releaseDueRead = resolve; });
    const dueBoardRead = G.withCharacterReadLocked(app.pool, third.accountId, async (ch, client) => { dueReadHeld(); await dueHold; return crewLogisticsBoard(client, ch); }, C.CREW_FIRST_CHARACTER_LOCKS);
    backendPid = undefined;
    try {
      await waitForHold(dueHeld, dueBoardRead);
      dueLeaving = G.withCharacter(observedPool, third.accountId, (ch, client, h) => C.leaveCrew(ch, client, h), C.CREW_FIRST_CHARACTER_LOCKS);
      dueLeaving.catch(() => {});
      let dueBlocked = false;
      for (let i = 0; i < 150; i++) {
        const activity = backendPid && (await app.pool.query('SELECT wait_event_type,query FROM pg_stat_activity WHERE pid=$1', [backendPid])).rows[0];
        if (activity?.wait_event_type === 'Lock' && /FROM\s+characters\b[\s\S]*FOR\s+UPDATE/i.test(activity.query)) { dueBlocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert(dueBlocked, 'overdue leave must wait at phase-one character lock before Crew action');
      releaseDueRead(); assert.equal((await dueBoardRead).links.length, 24); await dueLeaving;
    } finally {
      releaseDueRead(); await Promise.allSettled([dueBoardRead, dueLeaving].filter(Boolean));
    }
    await assert.rejects(readBoard(third), e => e.code === 'no_crew');
    assert.equal((await readBoard(boss)).links.length, 16);
    console.log('crewlogistics PostgreSQL: observed due-accrual character Lock wait; release permits accrual and leave; removed member read rejects PASS');
  }
  console.log(`crewlogistics actual ${native ? 'PostgreSQL' : 'memory'}: canonical reference ownership, no-accrual GET, source write/lock guard, leave/kick rejoin revocation, death/generation/expiry privacy and member cap PASS; references do not prove tender funding or delivery execution`);
} finally { await app.close(); }
