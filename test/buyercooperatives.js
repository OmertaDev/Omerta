import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Cooperative from '../src/buyercooperatives.js';
import * as Custody from '../src/buyercooperativecustody.js';
import { runBuyerCooperativeInvariants } from '../src/buyercooperativeinvariants.js';
import * as Market from '../src/market.js';
import * as Delivery from '../src/delivery.js';
import * as G from '../src/game.js';

assert(!process.env.DATABASE_URL, 'Refuse ambient database endpoints');
const native = process.argv.includes('--postgres'); let pool;
if (native) {
  const url = new URL(process.env.BUYER_COOPERATIVE_TEST_DATABASE_URL || 'http://missing');
  assert.equal(url.protocol, 'postgresql:'); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '35439'); assert.equal(url.username, 'pilot_runner'); assert.equal(url.password, '');
  assert(/^\/buyer_cooperative_[a-z0-9_]+$/.test(url.pathname)); assert(!url.search && !url.hash);
  const { default: pg } = await import('pg'); pool = new pg.Pool({ connectionString: url.href });
  const client = await pool.connect(); await client.query('BEGIN READ ONLY'); assert.equal((await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
  console.log((await client.query('SELECT version(),current_user,current_database()')).rows[0]); assert.match((await client.query('SELECT version()')).rows[0].version, /PostgreSQL 18\.4/); await client.query('ROLLBACK'); client.release();
} else {
  const { newDb, DataType } = await import('pg-mem'), { registerPgMemCompatibility } = await import('../src/db.js');
  const mem = newDb(); registerPgMemCompatibility(mem, DataType); pool = new (mem.adapters.createPg().Pool)();
}
await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
let serial = 0;
const blank = async () => {};
async function tx(actor, execute, peer = null) {
  const client = await pool.connect();
  const originalQuery = client.query;
  try {
    await client.query('BEGIN'); for (const id of [...new Set([actor.id, peer?.id].filter(Boolean))].sort()) await client.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE', [id]);
    const ch = (await client.query('SELECT * FROM characters WHERE id=$1', [actor.id])).rows[0]; await client.query('SELECT account_id FROM account_persistent WHERE account_id=$1 FOR UPDATE', [ch.account_id]);
    const other = peer ? (await client.query('SELECT * FROM characters WHERE id=$1', [peer.id])).rows[0] : null;
    const cargo = Object.fromEntries((await client.query('SELECT good_id,qty FROM character_cargo WHERE character_id=$1', [ch.id])).rows.map(row => [row.good_id, Number(row.qty)]));
    const h = { ledger: G.ledger, notify: blank, track: blank, acct: { omr: 0 }, owned: { cargo, cars: [], skills: new Set(), npc: {}, assets: [], disciplines: {} } };
    const result = await execute(ch, client, h, other);
    for (const character of [ch, other].filter(Boolean)) await client.query('UPDATE characters SET cash=$2 WHERE id=$1', [character.id, character.cash]);
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.query = originalQuery; client.release(); }
}
async function fixture({ feeCap = 12, published = false } = {}) {
  const prefix = `coop${++serial}`, members = [];
  for (let n = 0; n < 4; n++) {
    const id = `${prefix}_c${n}`, account = `${prefix}_a${n}`;
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'guest',$1)", [account]); await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await pool.query("INSERT INTO characters(id,account_id,name,season,cash,loc) VALUES($1,$2,$1,1,10000,'docks')", [id, account]); members.push((await pool.query('SELECT * FROM characters WHERE id=$1', [id])).rows[0]);
  }
  const seller = members.pop(); await pool.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',8)", [seller.id]);
  const terms = { members: members.map((member, n) => ({ accountId: member.account_id, units: [4, 3, 1][n] })), unitPrice: 100, feeCap, fundingSeconds: 3600, orderHours: 1, published, partialPolicy: 'proportional' };
  const created = await tx(members[0], (ch, c) => Cooperative.createBuyerCooperative(ch, terms, 'create', c));
  return { prefix, members, seller, terms, id: created.cooperative.id, termsHash: created.cooperative.termsHash };
}
const own = async (f, member) => (await Cooperative.buyerCooperativeBoard(pool, member.account_id)).find(row => row.id === f.id).ownShare;
const fund = async (f, member, key = 'fund') => {
  const share = await own(f, member);
  return tx(member, (ch, c, h) => Cooperative.fundBuyerCooperative(ch, f.id, { consent: true, termsHash: f.termsHash, maxCash: share.maximumCash }, key, c, h));
};
const launch = f => tx(f.members[0], (ch, c, h) => Cooperative.launchBuyerCooperative(ch, f.id, { termsHash: f.termsHash }, 'launch', c, h));
const full = async f => { for (const member of f.members) await fund(f, member); return launch(f); };
const fill = (f, orderId, qty) => tx(f.seller, (ch, c, h) => Market.fillOrder(ch, orderId, qty, c, h));
const settle = (f, cancel = false) => tx(f.members[1], (ch, c, h) => Cooperative.settleBuyerCooperative(ch, f.id, { cancel }, 'settle', c, h));
const claim = async (f, member, key = 'claim') => { const share = await own(f, member); return tx(member, (ch, c, h) => Cooperative.claimBuyerCooperative(ch, f.id, { cash: true, ginQty: share.ginClaimable }, key, c, h)); };
const cash = async member => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [member.id])).rows[0].cash);
const count = async table => Number((await pool.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
async function assertWaitingForLock(pid) {
  for (let n = 0; n < 50; n++) {
    if ((await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0]?.wait_event_type === 'Lock') return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Native proof did not reach an actual PostgreSQL source-lock wait');
}
async function conservation(f, { burnedCash = 0, burnedGin = 0 } = {}) {
  const row = (await pool.query('SELECT * FROM buyer_cooperatives WHERE id=$1', [f.id])).rows[0];
  const order = row.order_id ? (await pool.query('SELECT * FROM market_listings WHERE id=$1', [row.order_id])).rows[0] : null;
  let pockets = 0, cargo = 0;
  for (const member of [...f.members, f.seller]) { pockets += await cash(member); cargo += Number((await pool.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [member.id])).rows[0]?.qty || 0); }
  const fee = Number(row.fee_paid), orderEscrow = order?.status === 'live' ? Number(order.qty) * Number(order.price) : 0;
  // Isolate canonical seller take via actually delivered units in this fixture; no other fixture runs overlap.
  const delivered = row.status === 'live' ? Number(order?.filled_qty || 0) : Number(row.purchased_units);
  assert.equal(pockets + Number(row.cash_balance) + orderEscrow, 40000 - fee - Math.ceil(delivered * row.unit_price * 200 / 10000) - burnedCash);
  assert.equal(cargo + Number(row.gin_balance) + Number(order?.filled_qty || 0) + burnedGin, 8);
  assert.equal((await runBuyerCooperativeInvariants(pool)).ok, true);
}
try {
  const f = await fixture({ published: true });
  await assert.rejects(tx(f.members[0], (ch, c) => Cooperative.createBuyerCooperative(ch, { ...f.terms, members: [...f.terms.members].reverse() }, 'create', c)), e => e.reason === 'request_conflict');
  await assert.rejects(launch(f), e => ['not_fully_funded', 'original_member'].includes(e.reason));
  await fund(f, f.members[0]); assert.equal((await fund(f, f.members[0])).replayed, true);
  const beforeReplay = await cash(f.members[0]); assert.equal((await fund(f, f.members[0])).funded, 406); assert.equal(await cash(f.members[0]), beforeReplay);
  await assert.rejects(tx(f.members[0], (ch, c, h) => Cooperative.fundBuyerCooperative(ch, f.id, { consent: true, termsHash: f.termsHash, maxCash: 407 }, 'fund', c, h)), e => e.reason === 'request_conflict');
  await fund(f, f.members[1]); await fund(f, f.members[2]); await conservation(f);
  const pocket = await cash(f.members[0]), posted = await launch(f); assert.equal(await cash(f.members[0]), pocket); assert.equal(posted.canonical.escrow, 800); assert.equal(posted.canonical.fee, 10); assert.equal(posted.organizerPocketDebit, 0);
  const previousDeliveryFlag = process.env.DELIVERY_CONTRACTS; process.env.DELIVERY_CONTRACTS = 'on';
  try { await assert.rejects(tx(f.seller, (ch, c) => Delivery.acceptDelivery(ch, posted.orderId, { qty: 1, maxProcurementCash: 1000, deadlineSeconds: 60, unitPrice: 100 }, c)), e => e.code === 'no_order'); }
  finally { if (previousDeliveryFlag === undefined) delete process.env.DELIVERY_CONTRACTS; else process.env.DELIVERY_CONTRACTS = previousDeliveryFlag; }
  assert.equal((await pool.query('SELECT depot_id FROM market_listings WHERE id=$1', [posted.orderId])).rows[0].depot_id, null); assert.equal(await count('delivery_commitments'), 0);
  assert.equal((await launch(f)).replayed, true); await conservation(f);
  const goods = await fill(f, posted.orderId, 8); assert.equal(goods.delivered, 8); await conservation(f);
  const captured = await settle(f); assert.equal(captured.captured, 8); assert.equal(captured.marketRefund, 0); await conservation(f);
  await assert.rejects(tx(f.members[0], async (ch, c, h) => { await c.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',7)", [ch.id]); h.owned.cargo.gin = 7; return Cooperative.claimBuyerCooperative(ch, f.id, { cash: true, ginQty: 4 }, 'cargooverflow', c, h); }), e => e.reason === 'cargo');
  if (!native) await pool.query("DELETE FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [f.members[0].id]); // pg-mem rollback is not PostgreSQL atomicity evidence.
  for (const member of f.members) { const received = await claim(f, member); assert.equal(received.claimedGin, [4, 3, 1][f.members.indexOf(member)]); assert.equal((await tx(member, (ch, c, h) => Cooperative.claimBuyerCooperative(ch, f.id, { cash: true, ginQty: received.claimedGin }, 'claim', c, h))).replayed, true); }
  await conservation(f);
  const publics = await Cooperative.publicBuyerCooperatives(pool); assert(!JSON.stringify(publics).includes(f.members[1].account_id));
  const privateBoard = await Cooperative.buyerCooperativeBoard(pool, f.members[0].account_id); assert(!JSON.stringify(privateBoard).includes(f.members[1].account_id));
  assert.deepEqual(await Cooperative.buyerCooperativeBoard(pool, f.seller.account_id), []);
  const partial = await fixture(), p = await full(partial); await fill(partial, p.orderId, 5); const cancelled = await settle(partial, true); assert.equal(cancelled.marketRefund, 300); assert.equal(cancelled.captured, 5);
  assert.deepEqual(await Promise.all(partial.members.map(async member => (await own(partial, member)).cashClaimable)), [151, 113, 38]);
  assert.deepEqual(await Promise.all(partial.members.map(async member => (await own(partial, member)).ginClaimable)), [2, 2, 1]);
  for (const member of partial.members) await claim(partial, member); await conservation(partial);
  const fees = await fixture({ feeCap: 1 }); for (const member of fees.members) await fund(fees, member);
  await assert.rejects(launch(fees), e => e.reason === 'fee_cap'); assert.equal((await pool.query('SELECT order_id FROM buyer_cooperatives WHERE id=$1', [fees.id])).rows[0].order_id, null);
  const expired = await fixture(); await fund(expired, expired.members[1]); await pool.query('UPDATE buyer_cooperatives SET funding_deadline=clock_timestamp() WHERE id=$1', [expired.id]);
  await tx(expired.members[0], (ch, c, h) => Cooperative.settleBuyerCooperative(ch, expired.id, { cancel: false }, 'expire', c, h)); assert.equal((await claim(expired, expired.members[1])).refunded, 305); await conservation(expired);
  const dead = await fixture(), d = await full(dead); await fill(dead, d.orderId, 3);
  const originalPockets = await Promise.all(dead.members.map(cash));
  const death = await tx(dead.members[0], async (ch, c, h, killer) => { const result = await Custody.recoverBuyerCooperativesAtDeath(c, ch.id, h.ledger, killer, 0.5); await c.query('UPDATE characters SET alive=false WHERE id=$1', [ch.id]); return result; }, dead.seller);
  assert.deepEqual(death, { looted: 125, burnedCash: 126, burnedGin: 2 }); assert.deepEqual(await Promise.all(dead.members.map(cash)), originalPockets, 'Joint source never credits organizer or touches another member pocket');
  for (const member of dead.members.slice(1)) await claim(dead, member); await conservation(dead, death);
  const heir = { ...dead.members[0], id: `${dead.prefix}_heir`, generation: 2 }; await pool.query('INSERT INTO characters(id,account_id,name,season,generation,cash) VALUES($1,$2,$1,1,2,10000)', [heir.id, heir.account_id]);
  const maxCash = (await own(dead, heir)).maximumCash;
  assert.equal((await tx(heir, (ch, c, h) => Cooperative.fundBuyerCooperative(ch, dead.id, { consent: true, termsHash: dead.termsHash, maxCash }, 'fund', c, h))).replayed, true);
  await assert.rejects(tx(heir, (ch, c, h) => Cooperative.claimBuyerCooperative(ch, dead.id, { cash: true, ginQty: 0 }, 'heirwealth', c, h)), e => e.reason === 'original_member');
  const deadMember = await fixture(); await fund(deadMember, deadMember.members[0]); await fund(deadMember, deadMember.members[1]);
  const memberDeath = await tx(deadMember.members[1], (ch, c, h) => Custody.recoverBuyerCooperativesAtDeath(c, ch.id, h.ledger)); assert.equal(memberDeath.burnedCash, 305); assert.equal((await claim(deadMember, deadMember.members[0])).refunded, 406); await conservation(deadMember, memberDeath);
  if (native) {
    const concurrent = await fixture(); const paid = await Promise.all(concurrent.members.map(m => fund(concurrent, m))); assert.equal(paid.reduce((sum, r) => sum + r.funded, 0), 812);
    const [a, b] = await Promise.all([launch(concurrent), launch(concurrent)]); assert.equal(a.orderId, b.orderId); assert.equal([a, b].filter(r => r.replayed).length, 1);
    await fill(concurrent, a.orderId, 8); await settle(concurrent);
    const racingMember = concurrent.members[0], share = await own(concurrent, racingMember);
    const claims = await Promise.all([tx(racingMember, (ch, c, h) => Cooperative.claimBuyerCooperative(ch, concurrent.id, { cash: true, ginQty: share.ginClaimable }, 'sameclaim', c, h)), tx(racingMember, (ch, c, h) => Cooperative.claimBuyerCooperative(ch, concurrent.id, { cash: true, ginQty: share.ginClaimable }, 'sameclaim', c, h))]);
    assert.equal(claims.filter(r => r.replayed).length, 1); for (const member of concurrent.members.slice(1)) await claim(concurrent, member); await conservation(concurrent);
    const rollback = await fixture(), ledgers = await count('transactions'), journals = await count('buyer_cooperative_journal');
    await assert.rejects(tx(rollback.members[0], async (ch, c, h) => { const ownShare = await own(rollback, ch); await Cooperative.fundBuyerCooperative(ch, rollback.id, { consent: true, termsHash: rollback.termsHash, maxCash: ownShare.maximumCash }, 'rollback', c, h); throw new Error('forced rollback'); }), /forced rollback/);
    assert.equal(await cash(rollback.members[0]), 10000); assert.equal(await count('transactions'), ledgers); assert.equal(await count('buyer_cooperative_journal'), journals);
    const orderRollback = await fixture(); for (const member of orderRollback.members) await fund(orderRollback, member);
    const beforeOrders = await count('market_listings'), beforeOrderLedger = await count('transactions'), beforeBindings = await count('buyer_cooperative_orders');
    await assert.rejects(tx(orderRollback.members[0], async (ch, c, h) => { await Cooperative.launchBuyerCooperative(ch, orderRollback.id, { termsHash: orderRollback.termsHash }, 'rolledbackorder', c, h); throw new Error('forced order rollback'); }), /forced order rollback/);
    assert.equal(await count('market_listings'), beforeOrders); assert.equal(await count('transactions'), beforeOrderLedger); assert.equal(await count('buyer_cooperative_orders'), beforeBindings); assert.equal((await pool.query('SELECT cash_balance FROM buyer_cooperatives WHERE id=$1', [orderRollback.id])).rows[0].cash_balance, 812);
    const budget = await fixture(), another = await tx(budget.members[0], (ch, c) => Cooperative.createBuyerCooperative(ch, budget.terms, 'otherplan', c));
    await pool.query('UPDATE characters SET cash=1500 WHERE id=$1', [budget.members[0].id]);
    const budgetRace = await Promise.allSettled([fund(budget, budget.members[0], 'onebudget'), fund({ ...budget, id: another.cooperative.id, termsHash: another.cooperative.termsHash }, budget.members[0], 'otherbudget')]);
    assert.equal(budgetRace.filter(r => r.status === 'fulfilled').length, 1); assert.equal(budgetRace.filter(r => r.status === 'rejected' && r.reason.reason === 'reserve').length, 1); assert.equal(await cash(budget.members[0]), 1094);
    const waiting = await fixture(), blocked = await pool.connect(); await blocked.query('BEGIN'); await blocked.query('SELECT id FROM buyer_cooperatives WHERE id=$1 FOR UPDATE', [waiting.id]);
    let reached; const arrived = new Promise(resolve => { reached = resolve; }); let waitingPid;
    const waitingShare = await own(waiting, waiting.members[0]);
    const funding = tx(waiting.members[0], async (ch, c, h) => { const query = c.query.bind(c); c.query = (...args) => { if (args[0] === 'SELECT * FROM buyer_cooperatives WHERE id=$1 FOR UPDATE') { waitingPid = c.processID; reached(); } return query(...args); }; return Cooperative.fundBuyerCooperative(ch, waiting.id, { consent: true, termsHash: waiting.termsHash, maxCash: waitingShare.maximumCash }, 'blockedfunding', c, h); });
    await arrived; await assertWaitingForLock(waitingPid); await blocked.query('UPDATE buyer_cooperatives SET funding_deadline=clock_timestamp() WHERE id=$1', [waiting.id]); await blocked.query('COMMIT'); blocked.release(); await assert.rejects(funding, e => e.reason === 'funding_state'); assert.equal(await cash(waiting.members[0]), 10000);
    const deathRace = await fixture(); for (const member of deathRace.members) await fund(deathRace, member);
    let postedSignal, finishLaunch; const staged = new Promise(resolve => { postedSignal = resolve; }), finish = new Promise(resolve => { finishLaunch = resolve; });
    const stagedLaunch = tx(deathRace.members[0], async (ch, c, h) => { const result = await Cooperative.launchBuyerCooperative(ch, deathRace.id, { termsHash: deathRace.termsHash }, 'racinglaunch', c, h); postedSignal(); await finish; return result; }); await staged;
    let deathReached, deathPid; const deathArrived = new Promise(resolve => { deathReached = resolve; });
    const blockedDeath = tx(deathRace.members[1], async (ch, c, h) => { const query = c.query.bind(c); c.query = (...args) => { if (args[0] === 'SELECT * FROM buyer_cooperatives WHERE id=$1 FOR UPDATE') { deathPid = c.processID; deathReached(); } return query(...args); }; return Custody.recoverBuyerCooperativesAtDeath(c, ch.id, h.ledger); });
    await deathArrived; await assertWaitingForLock(deathPid); finishLaunch(); await stagedLaunch;
    await assert.rejects(blockedDeath, e => e.reason === 'source_changed'); assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1', [deathRace.members[1].id])).rows[0].alive, true);
    const retried = await tx(deathRace.members[1], (ch, c, h) => Custody.recoverBuyerCooperativesAtDeath(c, ch.id, h.ledger)); assert.equal(retried.burnedCash, 301);
    await claim(deathRace, deathRace.members[0]); await claim(deathRace, deathRace.members[2]); await conservation(deathRace, retried);
  }
  let seed = 1947;
  for (let n = 0; n < 500; n++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const weights = [seed % 8 + 1, (seed >>> 4) % 8 + 1, (seed >>> 8) % 8 + 1], total = seed % 810001; const allocation = Custody.buyerCooperativeApportion(total, weights); assert.equal(allocation.reduce((sum, v) => sum + v, 0), total); assert.deepEqual(Custody.buyerCooperativeApportion(total, weights), allocation); assert(allocation.every(v => Number.isSafeInteger(v) && v >= 0)); }
  assert.equal((await runBuyerCooperativeInvariants(pool)).ok, true);
  for (const change of [{ members: f.terms.members.map(m => ({ ...m, units: 8 })) }, { unitPrice: '100' }, { feeCap: 0 }, { url: 'https://example.com' }, { partialPolicy: 'code' }]) assert.throws(() => Cooperative.buyerCooperativeTerms({ ...f.terms, ...change }));
  console.log(`buyercooperatives: PASS ${native ? 'PostgreSQL18.4 multi-funder/replay/claim contention/rollback/post-lock expiry' : 'memory'}; canonical funded order/fill; full+partial deterministic cash/GIN claims; original-member burn/loot; heir replay no wealth; private/opt-in projection; seed1947 500 conservation allocations. Root market/estate integration remains separately required.`);
} finally { await pool.end(); }
