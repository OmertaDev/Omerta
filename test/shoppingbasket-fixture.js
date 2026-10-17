import assert from 'node:assert/strict';
import { shoppingBasketDDL } from '../src/shoppingbasket-schema.js';
import { ensureComponentDDL } from './lib/company-middle-five-fixture-schema.js';

export async function fixture(api = false) {
  assert(!process.env.DATABASE_URL, 'Refuse ambient endpoint'); const native = process.argv.includes('--postgres');
  if (native) {
    const u = new URL(process.env.SHOPPING_BASKET_TEST_DATABASE_URL);
    assert(['postgres:', 'postgresql:'].includes(u.protocol)); assert.equal(u.hostname, '127.0.0.1'); assert(!u.hash && !u.search);
    assert.match(u.pathname, /^\/shopping_basket_test_[a-f0-9]{12}$/);
    const local = u.port === '35439' && u.username === 'pilot_runner' && !u.password;
    const ci = u.port === '5432' && u.username === 'postgres' && u.password === 'pgcheck'; assert(local || ci);
    const { default: pg } = await import('pg'), client = new pg.Client({ connectionString: u.href });
    try {
      await client.connect(); await client.query('BEGIN READ ONLY');
      const server = (await client.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version")).rows[0];
      assert.equal(server.role, u.username); assert.equal(server.database, u.pathname.slice(1)); assert.match(server.version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
      if (local) assert.equal((await client.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\', '/'), 'C:/Users/Jorge/AppData/Local/Temp/omerta-economy-oct15-pg184');
      assert.equal((await client.query("SELECT COUNT(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')")).rows[0].n, 0);
      await client.query('ROLLBACK');
    } finally { await client.end(); }
    process.env.DATABASE_URL = u.href;
  }
  Object.assign(process.env, { RESOURCE_ECONOMY: 'off', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off', JWT_SECRET: 'shopping-basket-component-only', MOD_KEY: 'shopping-basket-component-moderator-only', MARKET_SEED: 'shopping-basket-component-only' });
  const { makeDb } = await import('../src/db.js'), I = await import('../src/items.js'), C = await import('../src/consignments.js'),
    B = await import('../src/shoppingbasket.js'), Craft = await import('../src/crafting.js'), G = await import('../src/game.js');
  const app = api ? await (await import('../src/server.js')).buildServer() : null, pool = app?.pool || await makeDb();
  await ensureComponentDDL(pool, shoppingBasketDDL, ['shopping_baskets', 'shopping_basket_requests']);
  const tx = fn => I.withItemTransaction(pool, fn);
  for (const account of ['seller-a', 'seller-b', 'host', 'buyer', 'other', 'host-two']) {
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [account, 'shopping-basket-fixture']);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$1,1,'foundry',10000,10000)", [account + '-actor', account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')", [account + '-actor']);
    await G.ledger(pool, { characterId: account + '-actor', currency: 'cash', amount: 9500, reason: 'crime:shopping_basket_fixture' });
  }
  let serial = 0;
  const listing = async (seller = 'seller-a', price = 101, host = 'host', accept = true) => {
    const n = ++serial, owner = { scope: 'account', id: seller };
    await tx(async c => { await I.grantStack(c, owner, 'mat:hardened_steel', 1, 'standard', 'explicit basket material fixture', 'basket-steel-' + n); await I.grantStack(c, owner, 'mat:salvage_parts', 2, 'standard', 'explicit basket material fixture', 'basket-parts-' + n); });
    const itemId = (await tx(c => Craft.craftWorldGraphRecipe(c, { accountId: seller }, 'recipe:precision_lock_tool', 'basket-craft-' + n))).outputs[0].id;
    const offer = await tx(c => C.createConsignment(c, seller, { itemId, hostAccountId: host, price, hostFeeBps: 1000, lifetimeSeconds: 86400, consent: true }, 'basket-listing-' + n));
    const body = { consignmentId: offer.consignmentId, sourceHash: offer.sourceHash, consent: true };
    if (accept) await tx(c => C.acceptConsignment(c, host, body, 'basket-host-' + n));
    return { itemId, offer, body, seller, host, n };
  };
  const pair = async () => [await listing(), await listing('seller-b', 203)];
  const quoteBody = lines => ({ lines: lines.map(line => ({ consignmentId: line.offer.consignmentId, sourceHash: line.offer.sourceHash })), consent: true });
  const ref = q => ({ basketId: q.basketId, sourceHash: q.sourceHash, consent: true });
  const act = (account, action, body, key = 'basket-action-' + (++serial)) => tx(c => B.shoppingBasketAction(c, account, action, body, key));
  const state = async () => {
    const tables = {};
    for (const name of ['characters', 'transactions', 'item_stacks', 'item_instances', 'item_events', 'item_mutation_guards', 'item_mutation_inputs', 'item_mutation_outputs', 'operation_escrow', 'item_durability_states', 'consignments', 'consignment_requests', 'shopping_baskets', 'shopping_basket_requests']) {
      tables[name] = (await pool.query('SELECT * FROM ' + name)).rows.sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
    }
    return tables;
  };
  const books = async () => { assert.deepEqual(await B.collectShoppingBasketIssues(pool), []); assert.deepEqual(await C.collectConsignmentIssues(pool), []); };
  return { app, pool, tx, I, C, B, G, native, listing, pair, quoteBody, ref, act, state, books };
}
