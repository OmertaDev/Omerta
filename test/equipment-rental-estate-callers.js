import assert from 'node:assert/strict';
assert(!process.env.DATABASE_URL, 'Refuse ambient endpoint');
const native = process.argv.includes('--postgres');
if (native) {
  const u = new URL(process.env.EQUIPMENT_RENTAL_ESTATE_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(u.protocol)); assert.equal(u.hostname, '127.0.0.1');
  assert.match(u.pathname, /^\/equipment_rental_estate_test_[a-z0-9_]+$/); assert(!u.search && !u.hash);
  const local = ['35439', '35449'].includes(u.port) && u.username === 'pilot_runner' && !u.password;
  const ci = u.port === '5432' && u.username === 'postgres' && u.password === 'pgcheck';
  assert(local || ci, 'Fresh owned fixture endpoint only');
  const { default: pg } = await import('pg'), p = new pg.Pool({ connectionString: u.href });
  try {
    const version = (await p.query('SHOW server_version')).rows[0].server_version;
    assert.match(version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
    assert.equal((await p.query('SELECT current_user AS role')).rows[0].role, local ? 'pilot_runner' : 'postgres');
    console.log('Owned empty native fixture:', u.pathname, version);
  } finally { await p.end(); }
  process.env.DATABASE_URL = u.href;
}
Object.assign(process.env, { RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'off',
  JWT_SECRET: 'rental-estate-callers-fixture', MARKET_SEED: 'rental-estate-callers-fixture',
  PEN_YARD_EVENT: 'quiet', SHANK_P: '1', WANTED_HUNT_P: '1' });
const { buildServer } = await import('../src/server.js');
const I = await import('../src/items.js'), C = await import('../src/crafting.js'), G = await import('../src/game.js');
const R = await import('../src/equipmentrentals.js'), Q = await import('../src/itemdurability.js');
const { huntWanted } = await import('../src/social/combat.js');
const { NPC_HITMEN } = await import('../src/rules.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const app = await buildServer(), pool = app.pool;
let serial = 0;
const call = (p, method, url, payload, key = 'rental-estate-' + (++serial)) => app.inject({ method, url, payload,
  headers: { ...(p ? { authorization: 'Bearer ' + p.token } : {}), 'idempotency-key': key } });
const ok = async (...args) => { const r = await call(...args); assert.equal(r.statusCode, 200, r.body); return r.json(); };
const row = async p => (await pool.query('SELECT * FROM characters WHERE id=$1', [p.id])).rows[0];
async function player() {
  const p = { token: (await ok(null, 'POST', '/v1/auth/guest')).token };
  await ok(p, 'POST', '/v1/character', { name: 'Rental Estate ' + (++serial) });
  p.account = app.jwt.verify(p.token).sub;
  p.id = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [p.account])).rows[0].id;
  const before = Number((await row(p)).cash);
  // Explicit ledger-balanced opening fixture cash and eligibility, not earned performance.
  await pool.query("UPDATE characters SET cash=1000000,respect=10000,loc='foundry' WHERE id=$1", [p.id]);
  await G.ledger(pool, { characterId: p.id, currency: 'cash', amount: 1000000 - before, reason: 'crime:rental-estate-fixture' });
  await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')", [p.id]);
  return p;
}
async function rental(landlord, borrower) {
  const owner = { scope: 'account', id: landlord.account }, key = 'rental-estate-craft-' + (++serial);
  const tool = await I.withItemTransaction(pool, async c => {
    await I.grantStack(c, owner, 'mat:hardened_steel', 1, 'standard', 'explicit material fixture', key + '-steel');
    await I.grantStack(c, owner, 'mat:salvage_parts', 2, 'standard', 'explicit material fixture', key + '-parts');
    return (await C.craftWorldGraphRecipe(c, { accountId: landlord.account }, 'recipe:precision_lock_tool', key)).outputs[0].id;
  });
  const offer = await ok(landlord, 'POST', '/v1/equipment/rentals/offers', { itemId: tool, rentCash: 100,
    depositCash: 250, durationSeconds: 3600, offerSeconds: 3600, published: true });
  const receipt = await ok(borrower, 'POST', '/v1/equipment/rentals/accept', { offerId: offer.offerId,
    maxRentCash: 100, maxDepositCash: 250, consent: true });
  assert(receipt.rentDebit && receipt.rentCredit && receipt.depositDebit);
  const source = (await pool.query('SELECT * FROM equipment_rental_leases WHERE id=$1', [receipt.leaseId])).rows[0];
  await R.paidEquipmentRentalWitness(pool, source);
  const title = (await pool.query('SELECT depositor_scope,depositor_id FROM operation_escrow WHERE item_id=$1', [tool])).rows[0];
  assert.deepEqual(title, { depositor_scope: 'account', depositor_id: landlord.account });
  return { tool, receipt, source };
}
try {
  for (const path of ['pen', 'npc', 'hunter']) for (const role of ['borrower', 'landlord']) {
    const landlord = await player(), borrower = await player();
    const victim = role === 'borrower' ? borrower : landlord, actor = role === 'landlord' ? borrower : await player();
    const lease = await rental(landlord, borrower), before = Number((await row(borrower)).cash);
    let outcome;
    if (path === 'pen') {
      await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1', [actor.id, new Date(Date.now() + 1800000)]);
      await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1', [victim.id, new Date(Date.now() + 1800000)]);
      await ok(actor, 'POST', '/v1/pen/buy/shiv');
      outcome = await ok(actor, 'POST', '/v1/pen/shank/' + victim.id);
      assert.equal(outcome.kill, true); assert(outcome.estate.heirId);
    } else if (path === 'npc') {
      await ok(actor, 'POST', '/v1/streets/' + victim.id + '/meet');
      const random = Math.random;
      try { Math.random = () => 0; outcome = await ok(actor, 'POST', '/v1/streets/' + victim.id + '/npchit', { tier: NPC_HITMEN[0].id }); }
      finally { Math.random = random; }
      assert.equal(outcome.killed, true);
    } else {
      await pool.query('UPDATE characters SET wanted_until=$2 WHERE id=$1', [victim.id, new Date(Date.now() + 3600000)]);
      outcome = await huntWanted(pool); assert.equal(outcome.killed, 1);
    }
    assert.equal((await row(victim)).alive, false);
    const current = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [victim.account])).rows;
    assert.equal(current.length, 1); assert.notEqual(current[0].id, victim.id);
    const ended = (await pool.query('SELECT status,deposit_remaining FROM equipment_rental_leases WHERE id=$1', [lease.receipt.leaseId])).rows[0];
    assert.equal(ended.status, 'death_ended'); assert.equal(Number(ended.deposit_remaining), 0);
    assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [lease.tool])).rows[0],
      { owner_scope: 'account', owner_id: landlord.account, state: 'active' });
    assert.equal((await pool.query('SELECT item_id FROM operation_escrow WHERE item_id=$1', [lease.tool])).rows.length, 0);
    const legs = (await pool.query("SELECT character_id,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('equipment_rental:deposit_refund','equipment_rental:deposit_burn')", [lease.receipt.leaseId])).rows;
    assert.equal(legs.length, 1); assert.equal(Number(legs[0].amount), role === 'borrower' ? -250 : 250);
    assert.equal(legs[0].reason, 'equipment_rental:deposit_' + (role === 'borrower' ? 'burn' : 'refund'));
    if (role === 'landlord') {
      assert.equal(legs[0].character_id, borrower.id);
      const fee = path === 'npc' ? outcome.cost : path === 'pen' ? Number((await pool.query("SELECT amount FROM transactions WHERE character_id=$1 AND reason='pen:commissary' LIMIT 2", [borrower.id])).rows[0]?.amount || 0) * -1 : 0;
      assert.equal(Number((await row(borrower)).cash), before + 250 - fee, 'Refund survives real caller in-memory actor persistence');
    }
    assert.equal(await R.borrowedPrecisionTool(pool, { accountId: victim.account, characterId: current[0].id }), null);
    const retry = await call(borrower, 'POST', '/v1/equipment/rentals/end', { leaseId: lease.receipt.leaseId });
    assert.notEqual(retry.statusCode, 200, 'Historical ended source cannot refund again');
    assert.deepEqual(await R.collectEquipmentRentalIssues(pool), []);
    assert.deepEqual(await Q.collectItemConditionIssues(pool), []);
    const books = await runLedgerInvariants(pool); assert(books.ok, JSON.stringify(books.checks.filter(c => !c.ok)));
    console.log(path, role, 'actual estate caller PASS:', books.checks.length, 'global checks');
  }
  console.log('equipment rental estate callers', native ? 'native' : 'memory', 'PASS: six actual caller/role paths, paid original deposits, same UID/title, heir denial, no duplicate refund and global books');
} finally { await app.close(); }



