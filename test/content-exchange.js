// THE BELLINI MATERIAL EXCHANGE — exact-hash, cashless, whole-lot authored barter.
process.env.MOD_KEY = 'test-mod-key';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildServer } from '../src/server.js';
import { compileContentPack, validateCraftingContentPack } from '../src/content/compiler.js';

const NAMESPACE = 'omerta.workshop.bellini-lockbox';
const PLATE_SOURCE = 'foundry-plate-salvage';
const BINDING_SOURCE = 'archive-binding-salvage';
const PLATE = 'ledger-plate';
const BINDING = 'charred-binding';
const BAD_HASH = '0'.repeat(64);

const source = JSON.parse(await readFile(
  new URL('../content/packs/bellini-lockbox-v4/pack.json', import.meta.url), 'utf8',
));
const bundle = compileContentPack(source);
assert.equal(validateCraftingContentPack(bundle), bundle,
  'Bellini v4 belongs to the strict authored crafting + exchange capability');
assert.deepEqual(bundle.crafting.exchange, {
  itemIds: [PLATE, BINDING], listingTtlHours: 24, maxOpenListingsPerAccount: 5,
});

const malformed = (label, change, pattern) => {
  const copy = structuredClone(source);
  change(copy);
  assert.throws(() => validateCraftingContentPack(compileContentPack(copy)), pattern, label);
};
malformed('exchange manifest fields are closed', (pack) => {
  pack.crafting.exchange.cashSettlement = true;
}, /exchange requires/);
malformed('exchange needs two distinct authored materials', (pack) => {
  pack.crafting.exchange.itemIds = [PLATE];
}, /at least two unique itemIds/);
malformed('listing lifetime is compiler bounded', (pack) => {
  pack.crafting.exchange.listingTtlHours = 1000;
}, /listingTtlHours 1-168/);
malformed('listing count is compiler bounded', (pack) => {
  pack.crafting.exchange.maxOpenListingsPerAccount = 0;
}, /maxOpenListingsPerAccount 1-20/);
malformed('undeclared authored items cannot become tradeable', (pack) => {
  pack.nodes.find((node) => node.id === 'trued-ledger-plate').payload.tradeable = true;
}, /requires tradeable false unless declared/);
malformed('keepsakes cannot enter the exchange', (pack) => {
  pack.crafting.exchange.itemIds[1] = 'bellini-lockbox';
  pack.nodes.find((node) => node.id === BINDING).payload.tradeable = false;
  pack.nodes.find((node) => node.id === 'bellini-lockbox').payload.tradeable = true;
}, /stackable inert authored material/);
malformed('tools cannot enter the exchange', (pack) => {
  pack.crafting.exchange.itemIds[1] = 'restoration-press-item';
  pack.nodes.find((node) => node.id === BINDING).payload.tradeable = false;
  pack.nodes.find((node) => node.id === 'restoration-press-item').payload.tradeable = true;
}, /stackable inert authored material|non-tradeable authored_tool/);

const app = await buildServer();
const pool = app.pool;
const call = async (method, url, { token, body, mod = false } = {}) => {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (mod) headers['x-mod-key'] = 'test-mod-key';
  const response = await app.inject({ method, url, headers, payload: body });
  return { code: response.statusCode, body: response.json() };
};
const makePlayer = async (name) => {
  let response = await call('POST', '/v1/auth/guest');
  assert.equal(response.code, 200);
  const token = response.body.token;
  response = await call('POST', '/v1/character', { token, body: { name } });
  assert.equal(response.code, 200);
  const me = await call('GET', '/v1/me', { token });
  const id = me.body.character.id;
  const accountId = (await pool.query(
    'SELECT account_id FROM characters WHERE id=$1', [id],
  )).rows[0].account_id;
  await pool.query("UPDATE characters SET loc='foundry' WHERE id=$1", [id]);
  return { token, id, accountId, name };
};
const collect = (player, sourceId) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/sources/${sourceId}/collect`,
  { token: player.token, body: { expectedContentHash: bundle.contentHash } },
);
const board = (player) => call('GET', '/v1/content', { token: player.token });
const workshopOf = (response) => response.body.crafting.find((entry) => entry.namespace === NAMESPACE);
const list = (player, offeredItemId, offeredQuantity, requestedItemId, requestedQuantity, hash = bundle.contentHash) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/exchange/list`,
  { token: player.token, body: {
    expectedContentHash: hash, offeredItemId, offeredQuantity, requestedItemId, requestedQuantity,
  } },
);
const cancel = (player, listingId, hash = bundle.contentHash) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/exchange/${listingId}/cancel`,
  { token: player.token, body: { expectedContentHash: hash } },
);
const fill = (player, listingId, hash = bundle.contentHash) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/exchange/${listingId}/fill`,
  { token: player.token, body: { expectedContentHash: hash } },
);
const quantities = async (accountId) => Object.fromEntries((await pool.query(
  `SELECT item_id, SUM(quantity_remaining)::int AS qty
     FROM content_inventory_lots
    WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND quantity_remaining>0
    GROUP BY item_id ORDER BY item_id`,
  [accountId, NAMESPACE, bundle.contentHash],
)).rows.map((row) => [row.item_id, Number(row.qty)]));
const economicState = async (player) => {
  const character = (await pool.query(
    'SELECT cash, cb, ammo FROM characters WHERE id=$1', [player.id],
  )).rows[0];
  const account = (await pool.query(
    'SELECT omr FROM account_persistent WHERE account_id=$1', [player.accountId],
  )).rows[0];
  const transactions = Number((await pool.query(
    'SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [player.id],
  )).rows[0].n);
  return {
    cash: Number(character.cash), cb: Number(character.cb), ammo: Number(character.ammo),
    omr: Number(account.omr), transactions,
  };
};
const cityTotals = async () => Object.fromEntries((await pool.query(
  `SELECT item_id, SUM(qty)::int AS qty FROM (
     SELECT item_id, quantity_remaining AS qty
       FROM content_inventory_lots
      WHERE namespace=$1 AND content_hash=$2
     UNION ALL
     SELECT offered_item_id AS item_id, offered_quantity AS qty
       FROM content_exchange_listings
      WHERE namespace=$1 AND content_hash=$2 AND status='live'
   ) holdings GROUP BY item_id ORDER BY item_id`,
  [NAMESPACE, bundle.contentHash],
)).rows.map((row) => [row.item_id, Number(row.qty)]));

try {
  let response = await call('POST', '/v1/mod/content/activate', {
    mod: true, body: { bundle, expectedHash: bundle.contentHash },
  });
  assert.equal(response.code, 200);

  const seller = await makePlayer('Bellini Seller');
  const buyer = await makePlayer('Bellini Buyer');
  for (const player of [seller, buyer]) {
    assert.equal((await collect(player, PLATE_SOURCE)).code, 200);
    assert.equal((await collect(player, BINDING_SOURCE)).code, 200);
  }
  // Put the seller at the compiled plate cap so escrow accounting can be observed after listing.
  await pool.query(
    `INSERT INTO content_inventory_lots
       (id, account_id, namespace, version, content_hash, item_id,
        quantity_initial, quantity_remaining, acquired_via, authority_id)
     VALUES ($1,$2,$3,$4,$5,$6,6,6,'source','test-cap')`,
    [crypto.randomUUID(), seller.accountId, NAMESPACE, bundle.version, bundle.contentHash, PLATE],
  );
  const economyBefore = {
    seller: await economicState(seller), buyer: await economicState(buyer),
  };
  const totalsBefore = await cityTotals();

  response = await list(seller, PLATE, 2, BINDING, 1, BAD_HASH);
  assert.equal(response.code, 409, 'creating from a stale active hash returns the replacement workshop');
  assert.equal(response.body.error, 'stale_content');
  assert.equal(response.body.workshop.contentHash, bundle.contentHash);

  response = await call(
    'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/exchange/list`,
    { token: seller.token, body: {
      expectedContentHash: bundle.contentHash, offeredItemId: PLATE, offeredQuantity: 2,
      requestedItemId: BINDING, requestedQuantity: 1, cash: 500,
    } },
  );
  assert.equal(response.code, 400, 'strict listing input rejects undeclared cash authority');

  response = await list(seller, PLATE, 2, BINDING, 1);
  assert.equal(response.code, 200);
  assert.equal(response.body.receipt.kind, 'exchange_list');
  const firstListing = response.body.receipt.id;
  let workshop = response.body.workshop;
  const plateInventory = workshop.inventory.find((item) => item.id === PLATE);
  assert.equal(plateInventory.quantity, 10, 'listing moves the exact offered quantity out of spendable lots');
  assert.equal(plateInventory.escrowed, 2, 'the workshop names the exact quantity held in authored escrow');
  assert.equal(plateInventory.ownedAcrossVersions, 12, 'escrow remains inside ownership-cap accounting');
  assert(workshop.sources.find((entry) => entry.id === PLATE_SOURCE).blockedBy
    .some((gate) => gate.kind === 'inventory_cap'),
  'an escrowed lot cannot hide ownership and reopen a finite source cap');

  response = await board(buyer);
  workshop = workshopOf(response);
  assert.equal(workshop.exchange.kind, 'authored_barter');
  assert.equal(workshop.exchange.settlement, 'item_for_item');
  assert.deepEqual(workshop.exchange.items.map((item) => item.itemId), [PLATE, BINDING]);
  let projected = workshop.exchange.listings.find((entry) => entry.id === firstListing);
  assert.equal(projected.fillable, true);
  assert.deepEqual(projected.action.body, { expectedContentHash: bundle.contentHash });
  assert.equal(projected.action.kind, 'fill');
  assert.equal(projected.seller, seller.name);

  response = await cancel(buyer, firstListing);
  assert.equal(response.code, 400, 'another account cannot pull the seller\'s escrow');
  assert.equal(response.body.error, 'no_listing');
  assert.equal((await pool.query(
    'SELECT status FROM content_exchange_listings WHERE id=$1', [firstListing],
  )).rows[0].status, 'live');

  response = await fill(buyer, firstListing);
  assert.equal(response.code, 200);
  assert.equal(response.body.receipt.kind, 'exchange_fill');
  assert.deepEqual(await quantities(seller.accountId), { [BINDING]: 4, [PLATE]: 10 });
  assert.deepEqual(await quantities(buyer.accountId), { [BINDING]: 2, [PLATE]: 8 });
  assert.deepEqual(await cityTotals(), totalsBefore, 'both exact-hash item totals are conserved across fill');
  assert.deepEqual(await economicState(seller), economyBefore.seller,
    'seller cash, OMR, ordinary inventory, and transaction count do not move');
  assert.deepEqual(await economicState(buyer), economyBefore.buyer,
    'buyer cash, OMR, ordinary inventory, and transaction count do not move');
  assert.deepEqual((await pool.query(
    `SELECT event_kind FROM content_exchange_events WHERE listing_id=$1 ORDER BY created_at, event_kind`,
    [firstListing],
  )).rows.map((row) => row.event_kind), ['list', 'fill'],
  'listing and fill leave append-only exchange evidence');
  assert.equal(Number((await pool.query(
    `SELECT COUNT(*) AS n FROM content_inventory_lots
      WHERE authority_id=$1 AND acquired_via='exchange_fill'`, [firstListing],
  )).rows[0].n), 2, 'both transferred legs receive explicit exchange provenance lots');

  response = await list(seller, BINDING, 1, PLATE, 1);
  assert.equal(response.code, 200);
  const cancelledListing = response.body.receipt.id;
  const beforeCancel = await quantities(seller.accountId);
  response = await cancel(seller, cancelledListing);
  assert.equal(response.code, 200);
  assert.equal(response.body.receipt.kind, 'exchange_cancel');
  assert.deepEqual(await quantities(seller.accountId), {
    ...beforeCancel, [BINDING]: Number(beforeCancel[BINDING] || 0) + 1,
  }, 'cancellation restores exactly the escrowed offered leg');
  assert.equal((await pool.query(
    'SELECT status FROM content_exchange_listings WHERE id=$1', [cancelledListing],
  )).rows[0].status, 'cancelled');

  response = await list(seller, BINDING, 1, PLATE, 1);
  assert.equal(response.code, 200);
  const expiredListing = response.body.receipt.id;
  await pool.query(
    "UPDATE content_exchange_listings SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [expiredListing],
  );
  const buyerBeforeExpired = await quantities(buyer.accountId);
  response = await fill(buyer, expiredListing);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'exchange_expired');
  assert.deepEqual(await quantities(buyer.accountId), buyerBeforeExpired,
    'an expired fill consumes no buyer materials');
  response = await board(seller);
  projected = workshopOf(response).exchange.listings.find((entry) => entry.id === expiredListing);
  assert.equal(projected.expired, true);
  assert.equal(projected.action.kind, 'cancel', 'the owner can always recover an expired escrow lot');
  assert.equal((await cancel(seller, expiredListing)).code, 200);

  response = await list(seller, BINDING, 1, PLATE, 1);
  assert.equal(response.code, 200);
  const racedListing = response.body.receipt.id;
  const secondBuyer = await makePlayer('Bellini Second Buyer');
  assert.equal((await collect(secondBuyer, PLATE_SOURCE)).code, 200);
  assert.equal((await collect(secondBuyer, BINDING_SOURCE)).code, 200);
  const raced = await Promise.all([fill(buyer, racedListing), fill(secondBuyer, racedListing)]);
  assert.deepEqual(raced.map((entry) => entry.code).sort((a, b) => a - b), [200, 400],
    'the listing row lock permits exactly one whole-lot fill');
  assert.equal(Number((await pool.query(
    `SELECT COUNT(*) AS n FROM content_exchange_events
      WHERE listing_id=$1 AND event_kind='fill'`, [racedListing],
  )).rows[0].n), 1, 'the raced offer has one fill receipt');

  console.log('✅ exact-hash authored material exchange contract passed');
} finally {
  await app.close();
}
