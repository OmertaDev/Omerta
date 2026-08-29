// THE BELLINI RESTORATION — production contract for the first authored supply-chain adapter.
// Exact-hash lots, finite global sources, FIFO consumption, and inert outputs are enforced end to end.
process.env.MOD_KEY = 'test-mod-key';

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildServer } from '../src/server.js';
import {
  compileContentPack,
  validateCraftingContentPack,
  validateRuntimeContentPack,
} from '../src/content/compiler.js';

const NAMESPACE = 'omerta.workshop.bellini-lockbox';
const PLATE_SOURCE = 'foundry-plate-salvage';
const BINDING_SOURCE = 'archive-binding-salvage';
const RECIPE = 'restore-bellini-lockbox';
const PLATE = 'ledger-plate';
const BINDING = 'charred-binding';
const LOCKBOX = 'bellini-lockbox';
const BAD_HASH = '0'.repeat(64);

const source = JSON.parse(await readFile(
  new URL('../content/packs/bellini-lockbox/pack.json', import.meta.url),
  'utf8',
));
const bundle = compileContentPack(source);
assert.equal(validateCraftingContentPack(bundle), bundle,
  'the production pack belongs to the strict crafting capability profile');
assert.throws(() => validateRuntimeContentPack(bundle), /runtime manifest is required/,
  'an economy-only bundle does not acquire narrative runtime authority');

const malformed = (label, change, pattern) => {
  const copy = structuredClone(source);
  change(copy);
  assert.throws(() => validateCraftingContentPack(compileContentPack(copy)), pattern, label);
};
malformed('manifest fields are closed', (pack) => { pack.crafting.executeAnything = true; },
  /crafting manifest has unknown fields/);
malformed('profile references are closed', (pack) => { pack.crafting.nodeIds.pop(); },
  /crosses nodeIds/);
malformed('source kinds are allowlisted', (pack) => {
  pack.nodes.find((node) => node.id === PLATE_SOURCE).payload.sourceKind = 'arbitrary_faucet';
}, /unsupported sourceKind/);
malformed('one account gets one source claim per epoch', (pack) => {
  pack.nodes.find((node) => node.id === PLATE_SOURCE).payload.claimLimitPerEpoch = 2;
}, /claimLimitPerEpoch must be 1/);
malformed('authored inventory cannot add gameplay power', (pack) => {
  pack.nodes.find((node) => node.id === LOCKBOX).payload.gameplayPower = 'combat';
}, /gameplayPower none/);
malformed('authored inventory cannot become tradeable', (pack) => {
  pack.nodes.find((node) => node.id === LOCKBOX).payload.tradeable = true;
}, /tradeable false/);
malformed('the first adapter cannot open export authority', (pack) => {
  pack.nodes.find((node) => node.id === LOCKBOX).payload.exportPolicy = {
    mode: 'owner_initiated_optional', gameplayEffect: 'none',
    identityPolicy: 'escrow_single_identity', metadataPolicy: 'hash_pinned',
    chainProfile: 'allowlisted_profile',
  };
}, /cannot enable export/);

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
  return { token, id, accountId };
};
const moveToFoundry = (player) => pool.query(
  "UPDATE characters SET loc='foundry' WHERE id=$1", [player.id],
);
const collect = (player, sourceId, contentHash = bundle.contentHash) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/sources/${sourceId}/collect`,
  { token: player.token, body: { expectedContentHash: contentHash } },
);
const craft = (player, contentHash = bundle.contentHash) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/recipes/${RECIPE}/craft`,
  { token: player.token, body: { expectedContentHash: contentHash } },
);
const quantities = async (accountId, contentHash = bundle.contentHash) => Object.fromEntries(
  (await pool.query(
    `SELECT item_id, SUM(quantity_remaining)::int AS qty
       FROM content_inventory_lots
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3
      GROUP BY item_id ORDER BY item_id`,
    [accountId, NAMESPACE, contentHash],
  )).rows.map((row) => [row.item_id, Number(row.qty)]),
);
const economy = async (player) => {
  const character = (await pool.query(
    'SELECT cash, cb, ammo FROM characters WHERE id=$1', [player.id],
  )).rows[0];
  const account = (await pool.query(
    'SELECT omr FROM account_persistent WHERE account_id=$1', [player.accountId],
  )).rows[0];
  const transactions = (await pool.query(
    'SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [player.id],
  )).rows[0];
  return {
    cash: Number(character.cash), cb: Number(character.cb), ammo: Number(character.ammo),
    omr: Number(account.omr), transactions: Number(transactions.n),
  };
};
const workshopOf = (board) => board.body.crafting.find((entry) => entry.namespace === NAMESPACE);

try {
  let response = await call('GET', '/openapi.json');
  assert.equal(response.code, 200);
  const paths = response.body.paths;
  const sourcePath = paths['/v1/content/{namespace}/sources/{sourceId}/collect']?.post;
  const recipePath = paths['/v1/content/{namespace}/recipes/{recipeId}/craft']?.post;
  for (const operation of [sourcePath, recipePath]) {
    assert(operation, 'the direct crafting mutation is machine-discoverable');
    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    const schema = operation.requestBody.content['application/json'].schema;
    assert.deepEqual(schema.required, ['expectedContentHash']);
    assert.equal(schema.additionalProperties, false);
  }

  response = await call('POST', '/v1/mod/content/activate', {
    mod: true, body: { bundle, expectedHash: bundle.contentHash },
  });
  assert.equal(response.code, 200, 'the operator can activate an economy-only exact-hash bundle');

  const maker = await makePlayer('Foundry Maker');
  const baseline = await economy(maker);
  response = await call('GET', '/v1/content', { token: maker.token });
  assert.equal(response.code, 200);
  assert.equal(response.body.experiences.some((entry) => entry.namespace === NAMESPACE), false,
    'an economy-only bundle never pretends to be a narrative experience');
  let workshop = workshopOf(response);
  assert(workshop, 'the active authored workshop is discoverable');
  assert.equal(workshop.title, 'The Bellini Restoration');
  assert.equal(workshop.contentHash, bundle.contentHash);
  assert.equal(workshop.sources.length, 2);
  assert.equal(workshop.recipes.length, 1);
  assert(workshop.sources.every((entry) => !entry.eligible));
  assert(workshop.sources.every((entry) => entry.blockedBy.some((gate) => gate.kind === 'at_location')));

  response = await collect(maker, PLATE_SOURCE);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'wrong_location');
  assert.equal(response.body.location.districtId, 'foundry');

  await moveToFoundry(maker);
  response = await call('GET', '/v1/content', { token: maker.token });
  workshop = workshopOf(response);
  assert(workshop.sources.every((entry) => entry.eligible));
  assert.equal(workshop.recipes[0].craftable, false);
  assert.deepEqual(workshop.recipes[0].missing, [
    { itemId: BINDING, title: 'Charred Binding', required: 2, owned: 0 },
    { itemId: PLATE, title: 'Ledger Plate', required: 3, owned: 0 },
  ]);

  response = await collect(maker, PLATE_SOURCE, BAD_HASH);
  assert.equal(response.code, 409);
  assert.equal(response.body.error, 'stale_content');
  assert.equal(response.body.workshop.contentHash, bundle.contentHash);

  response = await call(
    'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/sources/${PLATE_SOURCE}/collect`,
    { token: maker.token, body: { expectedContentHash: bundle.contentHash, quantity: 999 } },
  );
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'bad_request', 'clients cannot nominate source quantities');

  response = await collect(maker, PLATE_SOURCE);
  assert.equal(response.code, 200);
  assert.equal(response.body.receipt.kind, 'source');
  assert.deepEqual(response.body.receipt.outputs, [{ itemId: PLATE, title: 'Ledger Plate', quantity: 3 }]);
  response = await collect(maker, PLATE_SOURCE);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'already_collected');

  response = await collect(maker, BINDING_SOURCE);
  assert.equal(response.code, 200);
  assert.deepEqual(await quantities(maker.accountId), { [BINDING]: 2, [PLATE]: 3 });

  response = await craft(maker);
  assert.equal(response.code, 200);
  assert.equal(response.body.receipt.kind, 'recipe');
  assert.deepEqual(response.body.receipt.inputs, [
    { itemId: BINDING, title: 'Charred Binding', quantity: 2 },
    { itemId: PLATE, title: 'Ledger Plate', quantity: 3 },
  ]);
  assert.deepEqual(response.body.receipt.outputs,
    [{ itemId: LOCKBOX, title: 'Restored Bellini Lockbox', quantity: 1 }]);
  assert.deepEqual(await quantities(maker.accountId), { [BINDING]: 0, [LOCKBOX]: 1, [PLATE]: 0 });
  response = await craft(maker);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'owned_limit');
  assert.deepEqual(await economy(maker), baseline,
    'source and recipe actions move no cash, crates, ammo, OMR, or transaction-ledger value');

  const holder = await makePlayer('Version Holder');
  await moveToFoundry(holder);
  assert.equal((await collect(holder, PLATE_SOURCE)).code, 200);
  assert.equal((await collect(holder, BINDING_SOURCE)).code, 200);

  const exhausted = await makePlayer('Last at the Bin');
  await moveToFoundry(exhausted);
  await pool.query(
    `UPDATE content_source_epochs SET units_issued=299
      WHERE namespace=$1 AND content_hash=$2 AND source_id=$3`,
    [NAMESPACE, bundle.contentHash, PLATE_SOURCE],
  );
  response = await collect(exhausted, PLATE_SOURCE);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'source_exhausted');
  assert.deepEqual(await quantities(exhausted.accountId), {},
    'an exhausted global source grants no partial inventory');

  const sourceV2 = structuredClone(source);
  sourceV2.version = 2;
  sourceV2.crafting.title = 'The Bellini Restoration — Second Ledger';
  const bundleV2 = compileContentPack(sourceV2);
  response = await call('POST', '/v1/mod/content/activate', {
    mod: true, body: { bundle: bundleV2, expectedHash: bundleV2.contentHash },
  });
  assert.equal(response.code, 200);

  response = await craft(holder, bundleV2.contentHash);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'materials',
    'a new active hash cannot reinterpret old-version material lots');
  response = await collect(holder, PLATE_SOURCE, bundle.contentHash);
  assert.equal(response.code, 409);
  assert.equal(response.body.error, 'stale_content');

  response = await call('GET', '/v1/content', { token: maker.token });
  workshop = workshopOf(response);
  assert.equal(workshop.version, 2);
  assert.equal(workshop.inventory.find((item) => item.id === LOCKBOX).quantity, 0);
  assert(workshop.recipes[0].blockedBy.some((gate) => gate.kind === 'inventory_cap'),
    'a version bump cannot bypass the cross-version non-stackable keepsake cap');
  assert.deepEqual(workshop.archivedInventory, [{
    version: 1,
    contentHash: bundle.contentHash,
    itemId: LOCKBOX,
    title: 'Restored Bellini Lockbox',
    quantity: 1,
  }], 'old exact-hash items remain durable and visible without entering the new recipe pool');

  const receipts = (await pool.query(
    `SELECT action_kind, action_id, content_hash, inputs_json, outputs_json
       FROM content_supply_receipts WHERE account_id=$1 ORDER BY created_at, id`,
    [maker.accountId],
  )).rows;
  assert.deepEqual(receipts.map((row) => [row.action_kind, row.action_id]), [
    ['source', PLATE_SOURCE], ['source', BINDING_SOURCE], ['recipe', RECIPE],
  ]);
  assert(receipts.every((row) => row.content_hash === bundle.contentHash));
  assert(receipts.every((row) => Array.isArray(JSON.parse(row.outputs_json))));
} finally {
  await app.close();
}

console.log('✅ The Bellini Restoration authored crafting and supply-chain contract passed');
