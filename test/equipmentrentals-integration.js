import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { buildOpenApi } from '../src/agentgateway.js';
assert(!process.env.DATABASE_URL, 'Refuse ambient endpoint');
const native = process.argv.includes('--postgres');
if (native) {
  const u = new URL(process.env.EQUIPMENT_RENTAL_INTEGRATION_TEST_DATABASE_URL);
  assert.equal(u.hostname, '127.0.0.1'); assert(['postgres:', 'postgresql:'].includes(u.protocol));
  assert.match(u.pathname, /^\/equipment_rental_integration_test_[a-z0-9_]+$/); assert(!u.search && !u.hash);
  assert(['35439', '35449'].includes(u.port) && u.username === 'pilot_runner' && !u.password);
  const { default: pg } = await import('pg'), p = new pg.Pool({ connectionString: u.href });
  try { assert.match((await p.query('SHOW server_version')).rows[0].server_version, /^18\.4\b/);
    assert.equal((await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
    assert.equal((await p.query('SELECT current_user AS role')).rows[0].role, 'pilot_runner');
  } finally { await p.end(); }
  process.env.DATABASE_URL = u.href;
}
Object.assign(process.env, { RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'off',
  JWT_SECRET: 'rental-integration-fixture-secret', MARKET_SEED: 'rental-integration-fixture-market', MOD_KEY: 'rental-integration-fixture-moderator' });
const { buildServer } = await import('../src/server.js');
const I = await import('../src/items.js'), C = await import('../src/crafting.js'), R = await import('../src/equipmentrentals.js'),
  Q = await import('../src/itemdurability.js'), G = await import('../src/game.js');
const Inv = await import('../src/invariants.js');
const app = await buildServer(), pool = app.pool, tx = fn => I.withItemTransaction(pool, fn);
let serial = 0;
const call = (p, method, url, body, key = 'rental-integration-' + (++serial)) => app.inject({ method, url, payload: body,
  headers: { ...(p ? { authorization: 'Bearer ' + p.token } : {}), 'idempotency-key': key } });
const ok = async (...args) => { const r = await call(...args); assert.equal(r.statusCode, 200, r.body); return r.json(); };
const cash = async p => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [p.id])).rows[0].cash);
const custody = async item => (await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [item])).rows[0];
const root = '/v1/worldgraph/mysteries/belladonna-demo';
const spec = buildOpenApi([{ method: 'GET', url: '/v1/worldgraph/mysteries/:graphId', hasAuth: true, isMod: false }], { baseUrl: 'https://example.test', version: 'rental-proposal' });
const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
const validateBoard = ajv.compile({ $ref: '#/components/schemas/WorldGraphMysteryBoard', components: { schemas: spec.components.schemas } });
try {
  async function player() {
    const p = { token: (await ok(null, 'POST', '/v1/auth/guest')).token };
    await ok(p, 'POST', '/v1/character', { name: 'Rental Integration ' + (++serial) });
    p.account = app.jwt.verify(p.token).sub;
    p.id = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [p.account])).rows[0].id;
    const before = await cash(p);
    await pool.query("UPDATE characters SET cash=10000,loc='foundry',respect=10000 WHERE id=$1", [p.id]);
    await G.ledger(pool, { characterId: p.id, currency: 'cash', amount: 10000 - before, reason: 'crime:rental-integration-fixture' });
    await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')", [p.id]);
    return p;
  }
  const landlord = await player(), borrower = await player(), temperedBorrower = await player(), foreign = await player();
  const owner = { scope: 'account', id: landlord.account };
  await tx(async c => {
    await I.grantStack(c, owner, 'mat:scrap_steel', 12, 'standard', 'explicit fixture input', 'rental-integration-steel');
    await I.grantStack(c, owner, 'mat:salvage_parts', 6, 'standard', 'explicit fixture input', 'rental-integration-parts');
    for (let n = 0; n < 3; n++) await C.craftWorldGraphRecipe(c, { accountId: landlord.account }, 'recipe:hardened_steel', 'rental-integration-paid-steel-' + n);
  });
  const tools = [];
  for (const [p, recipe, maximum] of [[borrower, 'recipe:precision_lock_tool', 100], [temperedBorrower, 'recipe:tempered_precision_lock_tool', 150]]) {
    const tool = (await tx(c => C.craftWorldGraphRecipe(c, { accountId: landlord.account }, recipe, 'rental-integration-craft-' + maximum))).outputs[0].id;
    const offer = await ok(landlord, 'POST', '/v1/equipment/rentals/offers', { itemId: tool, rentCash: 100, depositCash: 250, durationSeconds: 3600, offerSeconds: 3600, published: true });
    const lease = await ok(p, 'POST', '/v1/equipment/rentals/accept', { offerId: offer.offerId, maxRentCash: 100, maxDepositCash: 250, consent: true });
    assert(lease.rentDebit && lease.rentCredit && lease.depositDebit);
    const sourceLease = (await pool.query('SELECT * FROM equipment_rental_leases WHERE id=$1', [lease.leaseId])).rows[0];
    await assert.rejects(R.paidEquipmentRentalWitness(pool, { ...sourceLease, rent_cash: 101 }), /paid_lease/);
    await assert.rejects(R.paidEquipmentRentalWitness(pool, { ...sourceLease, borrower_account: foreign.account }), /paid_lease/);
    await assert.rejects(R.paidEquipmentRentalWitness(pool, { ...sourceLease, ends_at: new Date(Date.now() + 86400000) }), /paid_lease/);
    assert.equal(await R.borrowedPrecisionTool(pool, { accountId: foreign.account, characterId: foreign.id }), null);
    await ok(p, 'POST', root + '/start');
    await ok(p, 'POST', root + '/nodes/mystery:belladonna-trace/complete', { interactionId: 'inspect_belladonna_stamp' });
    await ok(p, 'POST', root + '/nodes/mystery:belladonna-lock/discover');
    const board = await ok(p, 'GET', root);
    assert(validateBoard(board), JSON.stringify(validateBoard.errors));
    assert(!validateBoard({ ...board, borrowedEquipment: { ...board.borrowedEquipment, title: 'borrower_owner' } }));
    assert(!validateBoard({ ...board, borrowedEquipment: { ...board.borrowedEquipment, amount: 1 } }));
    assert(!validateBoard({ ...board, borrowedEquipment: { ...board.borrowedEquipment, maximum: 200 } }));
    assert.equal(board.borrowedEquipment.itemId, tool); assert.equal(board.borrowedEquipment.maximum, maximum);
    assert.equal(board.borrowedEquipment.usable, true);
    const beforeCustody = await custody(tool);
    const wrong = await call(p, 'POST', root + '/nodes/mystery:belladonna-lock/complete', { interactionId: 'forged' });
    assert.equal(wrong.statusCode, 400); assert.deepEqual(await custody(tool), beforeCustody);
    assert.equal((await call(p, 'POST', root + '/nodes/mystery:belladonna-lock/complete', { interactionId: 'set_precision_tumblers', leaseId: lease.leaseId })).statusCode, 400, 'Caller cannot select rental custody authority');
    const key = 'rental-integration-lock-' + maximum;
    const completeBody = { interactionId: 'set_precision_tumblers' }, completeUrl = root + '/nodes/mystery:belladonna-lock/complete';
    if (native && maximum === 100) {
      await pool.query("CREATE FUNCTION rental_integration_late_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.node_id='mystery:belladonna-lock' AND NEW.result_json IS NOT NULL THEN RAISE EXCEPTION 'rental integration late fault'; END IF; RETURN NEW; END $$");
      await pool.query('CREATE TRIGGER rental_integration_late_fault BEFORE UPDATE ON mystery_node_state FOR EACH ROW EXECUTE FUNCTION rental_integration_late_fault()');
      assert.equal((await call(p, 'POST', completeUrl, completeBody, key + '-fault')).statusCode, 500);
      assert.deepEqual(await custody(tool), beforeCustody);
      assert.equal((await pool.query('SELECT event_id FROM item_durability_uses WHERE item_id=$1', [tool])).rows.length, 0);
      assert.equal((await pool.query("SELECT id FROM item_events WHERE item_id=$1 AND event_kind='escrow_relayed'", [tool])).rows.length, 0);
      await pool.query('DROP TRIGGER rental_integration_late_fault ON mystery_node_state');
      await pool.query('DROP FUNCTION rental_integration_late_fault()');
      // Wait behind physical custody, then re-read the lease deadline. No expired use or wear.
      await pool.query('UPDATE equipment_rental_leases SET ends_at=$2 WHERE id=$1', [lease.leaseId, new Date(Date.now() + 250)]);
      const blocker = await pool.connect(); await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM item_instances WHERE id=$1 FOR UPDATE', [tool]);
      const waiting = call(p, 'POST', completeUrl, completeBody, key + '-expiry');
      await new Promise(resolve => setTimeout(resolve, 350)); await blocker.query('COMMIT'); blocker.release();
      assert.equal((await waiting).statusCode, 400);
      assert.deepEqual(await custody(tool), beforeCustody);
      assert.equal((await pool.query('SELECT event_id FROM item_durability_uses WHERE item_id=$1', [tool])).rows.length, 0);
      await pool.query('UPDATE equipment_rental_leases SET ends_at=$2 WHERE id=$1', [lease.leaseId, new Date(lease.endsAt)]);
    }
    const completions = native ? await Promise.all([call(p, 'POST', completeUrl, completeBody, key), call(p, 'POST', completeUrl, completeBody, key + '-concurrent')]) : [await call(p, 'POST', completeUrl, completeBody, key)];
    for (const response of completions) assert.equal(response.statusCode, 200, response.body);
    const result = completions[0].json();
    assert.equal(result.node.status, 'completed');
    assert.deepEqual(await custody(tool), { owner_scope: 'operation', owner_id: lease.leaseId, state: 'escrowed' }, 'Immediate same-UID lease return before result');
    assert.equal((await pool.query('SELECT remaining FROM item_durability_states WHERE item_id=$1', [tool])).rows[0].remaining, maximum - 10);
    assert.equal((await pool.query('SELECT event_id FROM item_durability_uses WHERE item_id=$1', [tool])).rows.length, 1);
    const relays = (await pool.query("SELECT from_owner_id,to_owner_id FROM item_events WHERE item_id=$1 AND event_kind='escrow_relayed' ORDER BY sequence", [tool])).rows;
    assert.equal(relays.length, 2); assert.equal(relays[0].from_owner_id, lease.leaseId); assert.equal(relays[1].to_owner_id, lease.leaseId);
    assert.deepEqual(await ok(p, 'POST', root + '/nodes/mystery:belladonna-lock/complete', { interactionId: 'set_precision_tumblers' }, key), result);
    assert.equal((await pool.query('SELECT event_id FROM item_durability_uses WHERE item_id=$1', [tool])).rows.length, 1);
    await ok(p, 'POST', root + '/cancel', { instanceId: result.instanceId });
    assert.deepEqual(await custody(tool), beforeCustody, 'Mystery cancel gives no landlord-title transfer');
    tools.push({ p, tool, lease, maximum });
  }
  assert.equal((await ok(foreign, 'GET', '/v1/equipment/rentals')).leases.length, 0);
  await assert.rejects(tx(async c => { try { await R.assertEquipmentRentalDeathScope(c, foreign.id, {}); } catch {} }), /death_scope/, 'Caught forged scope poisons the actual item transaction');
  let priorScope;
  await tx(async c => { priorScope = (await R.prelockEquipmentRentalDeathActors(c, [foreign.id])).scope; });
  await assert.rejects(tx(c => R.assertEquipmentRentalDeathScope(c, foreign.id, priorScope)), /death_scope/, 'Scope cannot carry into another transaction on a reused client');
  if (native) {
    await assert.rejects(tx(async c => {
      const scope = (await R.prelockEquipmentRentalDeathActors(c, [foreign.id])).scope;
      await c.query('UPDATE equipment_rental_leases SET borrower_character=$2,borrower_account=$3 WHERE id=$1', [tools[0].lease.leaseId, foreign.id, foreign.account]);
      try { await R.assertEquipmentRentalDeathScope(c, foreign.id, scope); } catch {}
    }), /Rental counterpart changed/, 'New discovery aborts the whole transaction, even after caught refusal');
    assert.equal((await pool.query('SELECT borrower_character FROM equipment_rental_leases WHERE id=$1', [tools[0].lease.leaseId])).rows[0].borrower_character, borrower.id);
  }
  assert.deepEqual(await R.collectEquipmentRentalIssues(pool), []); assert.deepEqual(await Q.collectItemConditionIssues(pool), []);
  const books = await Inv.runLedgerInvariants(pool);
  assert.equal(books.ok, true, JSON.stringify(books.checks.filter(check => !check.ok)));
  console.log('Independent canonical books:', books.checks.length, 'checks, zero drift');
  // A production registrar, actual estate and heir creation; dead borrower deposit burns.
  const deadBorrower = tools[1], deadCash = await cash(deadBorrower.p);
  const death = await app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: deadBorrower.p.id }, headers: { 'x-mod-key': process.env.MOD_KEY } });
  assert.equal(death.statusCode, 200, death.body); assert(death.json().heirId);
  assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1', [deadBorrower.p.id])).rows[0].alive, false);
  assert.equal((await pool.query('SELECT deposit_remaining,status FROM equipment_rental_leases WHERE id=$1', [deadBorrower.lease.leaseId])).rows[0].status, 'death_ended');
  assert.equal((await custody(deadBorrower.tool)).owner_id, landlord.account);
  assert.equal(Number((await pool.query("SELECT amount FROM transactions WHERE reason='equipment_rental:deposit_burn' AND counterparty=$1", [deadBorrower.lease.leaseId])).rows[0].amount), -250);
  assert(deadCash > 0);
  // Actual registered G-pair fire: borrowed refund must survive the killer's
  // later character persistence, including loot already accumulated in memory.
  await pool.query('UPDATE characters SET cb=cb+1,cash=cash+250000 WHERE id=$1', [borrower.id]);
  await G.ledger(pool, { characterId: borrower.id, currency: 'cb', amount: 1, reason: 'crime:rental-integration-fixture' });
  await G.ledger(pool, { characterId: borrower.id, currency: 'cash', amount: 250000, reason: 'crime:rental-integration-fixture' });
  await ok(borrower, 'POST', '/v1/armory/gun/pocket22/buy');
  for (let box = 0; box < 100; box++) await ok(borrower, 'POST', '/v1/armory/ammo');
  await ok(borrower, 'POST', `/v1/streets/${landlord.id}/meet`);
  await ok(borrower, 'POST', `/v1/streets/${landlord.id}/search`);
  await pool.query('UPDATE searches SET started_at=$2 WHERE hunter=$1', [borrower.id, new Date(0)]);
  const liveBefore = await cash(borrower);
  const landlordDeath = await ok(borrower, 'POST', `/v1/streets/${landlord.id}/fire`, { rounds: 5000 }, 'rental-integration-fire');
  assert.equal(landlordDeath.kill, true);
  const loot = (await pool.query("SELECT amount FROM transactions WHERE character_id=$1 AND reason='whack:loot' AND currency='cash' AND counterparty=$2", [borrower.id, landlord.id])).rows;
  assert.equal(loot.length, 1); assert(Number(loot[0].amount) > 0);
  assert.equal(await cash(borrower), liveBefore + Number(loot[0].amount) + 250, 'Verified refund DELTA preserves actual killer loot');
  assert.deepEqual(await ok(borrower, 'POST', `/v1/streets/${landlord.id}/fire`, { rounds: 5000 }, 'rental-integration-fire'), landlordDeath);
  assert.equal((await custody(tools[0].tool)).owner_id, landlord.account);
  assert.deepEqual(await R.collectEquipmentRentalIssues(pool), []); assert.deepEqual(await Q.collectItemConditionIssues(pool), []);
  const finalBooks = await Inv.runLedgerInvariants(pool);
  assert.equal(finalBooks.ok, true, JSON.stringify(finalBooks.checks.filter(check => !check.ok)));
  console.log('Post-estate independent canonical books:', finalBooks.checks.length, 'checks, zero drift');
  console.log(`equipment rental integration ${native ? 'native18.4' : 'memory'} PASS: actual shared rental/Mystery/mod estate/fire registrars; real paid leases, 100/150 birth, same UID relay back, once wear, cancel/replay/privacy, actual killer loot+refund and dead borrower burn${native ? '; two-key contention, post-item-wait expiry and full native late-fault rollback' : '; native concurrency/rollback not claimed by memory'}.`);
} finally { await app.close(); }
