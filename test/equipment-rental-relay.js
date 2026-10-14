import assert from 'node:assert/strict';
assert(!process.env.DATABASE_URL, 'Refuse ambient endpoint');
const native = process.argv.includes('--postgres');
if (native) {
  const u = new URL(process.env.EQUIPMENT_RENTAL_RELAY_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(u.protocol)); assert.equal(u.hostname, '127.0.0.1'); assert(!u.search && !u.hash);
  assert.match(u.pathname, /^\/equipment_rental_relay_test_[a-z0-9_]+$/);
  const local = u.port === '35449' && u.username === 'pilot_runner' && !u.password;
  const ci = u.port === '5432' && u.username === 'postgres' && u.password === 'pgcheck'; assert(local || ci);
  const { default: pg } = await import('pg'), probe = new pg.Pool({ connectionString: u.href });
  try {
    assert.match((await probe.query('SHOW server_version')).rows[0].server_version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await probe.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
  } finally { await probe.end(); }
  process.env.DATABASE_URL = u.href;
}
const { makeDb } = await import('../src/db.js'), I = await import('../src/items.js'), C = await import('../src/crafting.js');
const R = await import('../src/equipmentrentals.js'), G = await import('../src/game.js'), { runLedgerInvariants } = await import('../src/invariants.js');
const pool = await makeDb(), tx = fn => I.withItemTransaction(pool, fn);
try {
  for (const account of ['landlord', 'borrower']) {
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [account, 'relay-fixture']);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$1,1,'foundry',10000,10000)", [account + '-actor', account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')", [account + '-actor']);
    await G.ledger(pool, { characterId: account + '-actor', currency: 'cash', amount: 9500, reason: 'crime:relay-fixture' });
  }
  const owner = { scope: 'account', id: 'landlord' };
  await tx(async client => {
    await I.grantStack(client, owner, 'mat:hardened_steel', 1, 'standard', 'owned relay fixture input', 'relay-steel');
    await I.grantStack(client, owner, 'mat:salvage_parts', 2, 'standard', 'owned relay fixture input', 'relay-parts');
  });
  const itemId = (await tx(client => C.craftWorldGraphRecipe(client, { accountId: 'landlord' }, 'recipe:precision_lock_tool', 'relay-craft'))).outputs[0].id;
  const offer = await tx(client => R.createEquipmentRentalOffer(client, 'landlord', { itemId, rentCash: 100, depositCash: 250, durationSeconds: 60, offerSeconds: 60, published: true }, 'relay-offer'));
  const lease = await tx(client => R.acceptEquipmentRental(client, 'borrower', { offerId: offer.offerId, maxRentCash: 100, maxDepositCash: 250, consent: true }, 'relay-accept'));
  const custody = async () => (await pool.query('SELECT * FROM operation_escrow WHERE item_id=$1', [itemId])).rows[0];
  const original = await custody(), borrower = { scope: 'character', id: 'borrower-actor' }, target = 'primitive-relay-target';
  const relay = (client, mutation, from, to) => I.relayEscrowCustody(client, from, to, itemId, 'owned primitive relay fixture', mutation);
  await assert.rejects(tx(client => relay(client, 'standalone-string-key', lease.leaseId, target)), /active private root token/);
  await assert.rejects(tx(client => relay(client, {}, lease.leaseId, target)), /active private root token/);
  await assert.rejects(tx(client => I.withItemMutation(client, borrower, 'mystery_action', 'relay-unbound', { itemAuthority: { operations: [lease.leaseId] } }, m => relay(client, m, lease.leaseId, target))), /bind both custody/);
  const beforeEvents = (await pool.query('SELECT id FROM item_events ORDER BY sequence')).rows;
  await assert.rejects(tx(client => I.withItemMutation(client, borrower, 'mystery_action', 'relay-late', { itemAuthority: { operations: [lease.leaseId, target] } }, async m => {
    await relay(client, m, lease.leaseId, target);
    throw new G.GameError('relay_fixture_failure', 'late relay failure');
  })), /late relay failure/);
  assert.deepEqual(await custody(), original);
  assert.deepEqual((await pool.query('SELECT id FROM item_events ORDER BY sequence')).rows, beforeEvents);
  const execute = () => tx(client => I.withItemMutation(client, borrower, 'mystery_action', 'relay-round-trip', { itemAuthority: { operations: [lease.leaseId, target] } }, async m => {
    await relay(client, m, lease.leaseId, target);
    const held = (await client.query('SELECT * FROM operation_escrow WHERE item_id=$1', [itemId])).rows[0];
    assert.equal(held.operation_id, target); assert.equal(held.depositor_id, 'landlord'); assert.equal(held.depositor_scope, 'account');
    assert.deepEqual(held.created_at, original.created_at);
    await assert.rejects(I.releaseEscrow(client, target, { scope: 'account', id: 'borrower' }, itemId, 'forbidden borrower disposal', m), /recorded depositor/);
    // A caught failing leaf poisons this whole transaction; this fixture must not return success.
    return { badCommit: true };
  }));
  await assert.rejects(execute(), /recorded depositor/);
  assert.deepEqual(await custody(), original);
  const roundTrip = () => tx(client => I.withItemMutation(client, borrower, 'mystery_action', 'relay-success', { itemAuthority: { operations: [lease.leaseId, target] } }, async m => {
    await relay(client, m, lease.leaseId, target); await relay(client, m, target, lease.leaseId);
    return { itemId, leaseId: lease.leaseId };
  }));
  const receipt = await roundTrip(); assert.deepEqual(await roundTrip(), receipt);
  assert.deepEqual(await custody(), original);
  assert.equal((await pool.query("SELECT id FROM item_events WHERE item_id=$1 AND event_kind='escrow_relayed'", [itemId])).rows.length, 2);
  await tx(client => R.endEquipmentRental(client, 'borrower', { leaseId: lease.leaseId }, 'relay-end'));
  assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [itemId])).rows[0].owner_id, 'landlord');
  assert.deepEqual(await R.collectEquipmentRentalIssues(pool), []);
  const report = await runLedgerInvariants(pool);
  assert.equal(report.ok, true, JSON.stringify(report.checks.filter(row => !row.ok)));
  assert.equal(report.checks.filter(row => /item .*|inventory .*|equipment/.test(row.name) && row.drift !== 0).length, 0, JSON.stringify(report.checks.filter(row => /item .*|inventory .*|equipment/.test(row.name))));
  console.log(JSON.stringify({ status: 'PASS', native, scope: 'canonical primitive custody relay; actual Mystery/estate integration remains separate', checks: ['immutable landlord depositor and custody timestamp', 'private bound operations only', 'late and caught-leaf rollback', 'one replayed round trip', 'original landlord return', 'global item history and condition'] }));
} finally { await pool.end(); }
