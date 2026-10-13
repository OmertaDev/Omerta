import assert from 'node:assert/strict';
assert(!process.env.DATABASE_URL, 'Refuse ambient endpoints');
const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.GAME_ITEM_BOUNDARY_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1'); assert(!url.search && !url.hash);
  assert.match(url.pathname, /^\/game_item_boundary_test_[a-z0-9_]+$/);
  const local = url.port === '35449' && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci);
  const { default: pg } = await import('pg'), probe = new pg.Pool({ connectionString: url.href });
  try {
    assert.match((await probe.query('SHOW server_version')).rows[0].server_version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await probe.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
  } finally { await probe.end(); }
  process.env.DATABASE_URL = url.href;
}
const { makeDb } = await import('../src/db.js'), G = await import('../src/game.js'), I = await import('../src/items.js');
const pool = await makeDb();
try {
  for (const id of ['one', 'two']) {
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [id, 'game-item-fixture']);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc,last_accrued_at) VALUES($1,$2,$1,1,'foundry',$3)", [id + '-actor', id, new Date(Date.now() + 3600000)]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  }
  const owner = { scope: 'account', id: 'one' };
  const rows = async () => {
    const values = await Promise.all([
      pool.query('SELECT * FROM item_stacks ORDER BY owner_scope,owner_id,template_id,quality'),
      pool.query('SELECT * FROM item_events ORDER BY sequence'),
      pool.query('SELECT * FROM item_mutation_guards ORDER BY idempotency_key'),
    ]);
    return values.map(result => result.rows);
  };
  const initial = await rows();
  let released;
  await G.withCharacter(pool, 'one', async (ch, client) => {
    assert.equal(ch.id, 'one-actor'); I.assertItemTransaction(client); released = client;
    await I.grantStack(client, owner, 'mat:salvage_parts', 2, 'standard', 'owned boundary fixture', 'game-item-success');
    return { completed: true };
  });
  assert.equal((await pool.query('SELECT quantity FROM item_stacks WHERE owner_id=$1', ['one'])).rows[0].quantity, 2);
  assert.throws(() => I.assertItemTransaction(released), /active withItemTransaction/);
  assert.notDeepEqual(await rows(), initial);
  const committed = await rows();
  await assert.rejects(G.withCharacter(pool, 'one', async (_, client) => {
    await I.grantStack(client, owner, 'mat:salvage_parts', 3, 'standard', 'late rollback fixture', 'game-item-late');
    throw new G.GameError('boundary_fixture_failure', 'late boundary failure');
  }), /late boundary failure/);
  assert.deepEqual(await rows(), committed, 'Late action failure rolls back item state, provenance and replay guard');
  await assert.rejects(G.withTwoCharacters(pool, 'one', 'two-actor', async (_, __, client) => {
    I.assertItemTransaction(client);
    await I.grantStack(client, owner, 'mat:salvage_parts', 1, 'standard', 'pair rollback fixture', 'game-item-pair');
    try { await I.grantStack(client, owner, 'mat:salvage_parts', 0, 'standard', 'caught leaf', 'game-item-caught'); } catch { /* outer boundary must refuse commit */ }
    return { shouldNotCommit: true };
  }), /positive whole number/);
  assert.deepEqual(await rows(), committed, 'Caught leaf poison cannot commit through a game wrapper');
  const beforeCash = (await pool.query('SELECT cash FROM characters WHERE id=$1', ['one-actor'])).rows[0].cash;
  await assert.rejects(G.withCharacter(pool, 'one', async (ch, client) => {
    ch.cash = Number(ch.cash) + 123;
    try { await I.grantStack(client, owner, 'mat:salvage_parts', 0, 'standard', 'caught before actor persist', 'game-item-caught-actor'); } catch { /* cannot persist the in-memory actor */ }
    return { shouldNotCommit: true };
  }), /positive whole number/);
  assert.equal((await pool.query('SELECT cash FROM characters WHERE id=$1', ['one-actor'])).rows[0].cash, beforeCash);
  const raw = await pool.connect();
  try { assert.throws(() => I.assertItemTransaction(raw), /active withItemTransaction/); } finally { raw.release(); }
  console.log(JSON.stringify({ status: 'PASS', native, checks: ['canonical single and pair brand', 'released and raw clients refused', 'late item rollback', 'caught leaf poison rolls back', 'phase-one settlement remains separate'] }));
} finally { await pool.end(); }
