// Phase 1 conserved inventory primitives: fungible stacks, permanent unique-item identity,
// operation custody, append-only provenance, and logical-mutation replay protection.
import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import {
  consumeItem,
  consumeStack,
  createItem,
  escrowItem,
  grantStack,
  inventoryBoard,
  releaseEscrow,
  transferItem,
  withItemMutation,
} from '../src/items.js';

const pool = await makeDb();
const characterA = { scope: 'character', id: 'character-a' };
const characterB = { scope: 'character', id: 'character-b' };
const accountA = { scope: 'account', id: 'account-a' };

const inTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

try {
  // Grant/consume conservation and exact replay.
  const firstGrant = await inTransaction((client) => grantStack(
    client, characterA, 'mat:scrap_steel', 10, 'standard', 'test grant', 'grant-1',
  ));
  const replayedGrant = await inTransaction((client) => grantStack(
    client, characterA, 'mat:scrap_steel', 10, 'standard', 'test grant', 'grant-1',
  ));
  assert.deepEqual(replayedGrant, firstGrant, 'an exact logical replay returns its prior result');
  let board = await inventoryBoard(pool, characterA);
  assert.equal(board.stacks.find((stack) => stack.templateId === 'mat:scrap_steel').qty, 10,
    'replaying a grant cannot duplicate materials');

  await inTransaction((client) => consumeStack(
    client, characterA, 'mat:scrap_steel', 4, 'standard', 'test consume', 'consume-1',
  ));
  board = await inventoryBoard(pool, characterA);
  assert.equal(board.stacks.find((stack) => stack.templateId === 'mat:scrap_steel').qty, 6,
    'a stack decrement leaves the exact conserved remainder');
  await assert.rejects(
    inTransaction((client) => consumeStack(
      client, characterA, 'mat:scrap_steel', 7, 'standard', 'overdraw', 'consume-2',
    )),
    (error) => error?.code === 'materials',
    'a stack cannot go negative',
  );

  // A key is globally bound to its complete mutation identity. It cannot silently replay for a
  // different owner or amount, even when the operation kind happens to match.
  await assert.rejects(
    inTransaction((client) => grantStack(
      client, characterB, 'mat:scrap_steel', 10, 'standard', 'test grant', 'grant-1',
    )),
    (error) => error?.code === 'idempotency_conflict',
    'a logical key cannot collide across owners',
  );
  await assert.rejects(
    inTransaction((client) => grantStack(
      client, characterA, 'mat:scrap_steel', 11, 'standard', 'test grant', 'grant-1',
    )),
    (error) => error?.code === 'idempotency_conflict',
    'a logical key cannot be reused for a changed mutation',
  );

  // Strict server-side input validation keeps malformed authorities and quantities out of SQL.
  await assert.rejects(
    inTransaction((client) => grantStack(
      client, { scope: 'crew', id: 'crew-a' }, 'mat:scrap_steel', 1,
      'standard', 'bad owner', 'bad-owner-1',
    )),
    (error) => error?.code === 'bad_item_owner',
  );
  await assert.rejects(
    inTransaction((client) => grantStack(
      client, { scope: 'account', id: '   ' }, 'mat:scrap_steel', 1,
      'standard', 'bad owner', 'bad-owner-2',
    )),
    (error) => error?.code === 'bad_item_owner',
  );
  await assert.rejects(
    inTransaction((client) => grantStack(
      client, characterA, 'mat:scrap_steel', 0, 'standard', 'bad qty', 'bad-qty-1',
    )),
    (error) => error?.code === 'qty',
  );
  await assert.rejects(
    grantStack(
      { query: pool.query.bind(pool) }, characterA, 'mat:scrap_steel', 1,
      'standard', 'autocommit', 'bad-client-1',
    ),
    (error) => error?.code === 'item_transaction_required',
    'mutation primitives fail closed on an unowned query/autocommit handle',
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO item_instances (id,template_id,owner_scope,owner_id,state)
       VALUES ('bad-operation-item','item:bad','operation','operation-0','active')`,
    ),
    /item_instance_escrow_owner/i,
    'storage rejects operation ownership outside escrow state',
  );

  // Unique instances keep one permanent row and append provenance for each successful transition.
  const created = await inTransaction((client) => createItem(
    client, characterA, 'item:precision_lock_tool', 'crafted', 'item-create-1',
  ));
  const replayedCreate = await inTransaction((client) => createItem(
    client, characterA, 'item:precision_lock_tool', 'crafted', 'item-create-1',
  ));
  assert.deepEqual(replayedCreate, created, 'create replay returns the original permanent item ID');
  assert.match(created.id, /^[0-9a-f-]{36}$/i);
  await assert.rejects(
    inTransaction((client) => createItem(
      client, { scope: 'operation', id: 'operation-bypass' },
      'item:bypass', 'crafted', 'item-bypass-create',
    )),
    (error) => error?.code === 'bad_item_owner',
    'unique items cannot be created directly into operation custody',
  );
  await assert.rejects(
    inTransaction((client) => transferItem(
      client, characterA, { scope: 'operation', id: 'operation-bypass' }, created.id,
      'bypass', 'item-bypass-transfer',
    )),
    (error) => error?.code === 'bad_item_owner',
    'ordinary transfers cannot bypass the escrow authority',
  );

  const transferred = await inTransaction((client) => transferItem(
    client, characterA, characterB, created.id, 'gifted', 'item-transfer-1',
  ));
  assert.equal(transferred.owner.id, characterB.id);
  assert.equal((await inventoryBoard(pool, characterA)).items.length, 0,
    'the former owner no longer sees a transferred instance');
  assert.deepEqual((await inventoryBoard(pool, characterB)).items.map((item) => item.id), [created.id],
    'the destination is the sole active owner');

  // Escrow changes authoritative custody to exactly one operation. It is not also counted in the
  // depositor inventory, and a different operation cannot release it.
  const escrowed = await inTransaction((client) => escrowItem(
    client, characterB, 'operation-1', created.id, 'mystery contribution', 'item-escrow-1',
  ));
  assert.equal(escrowed.state, 'escrowed');
  assert.deepEqual(escrowed.owner, { scope: 'operation', id: 'operation-1' });
  assert.equal((await inventoryBoard(pool, characterB)).items.length, 0,
    'escrow is not double-counted under the depositor');
  const operationBoard = await inventoryBoard(pool, { scope: 'operation', id: 'operation-1' });
  assert.equal(operationBoard.items.length, 1);
  assert.equal(operationBoard.items[0].escrowed, true,
    'the operation sees the single authoritative escrow custody row once');
  await assert.rejects(
    inTransaction((client) => releaseEscrow(
      client, 'operation-2', accountA, created.id, 'wrong operation', 'item-release-wrong',
    )),
    (error) => error?.code === 'item_not_escrowed',
    'release requires the matching operation',
  );

  const released = await inTransaction((client) => releaseEscrow(
    client, 'operation-1', accountA, created.id, 'operation returned item', 'item-release-1',
  ));
  assert.equal(released.state, 'active');
  assert.deepEqual(released.owner, accountA);
  assert.equal((await inventoryBoard(pool, { scope: 'operation', id: 'operation-1' })).items.length, 0);
  assert.deepEqual((await inventoryBoard(pool, accountA)).items.map((item) => item.id), [created.id]);

  const consumed = await inTransaction((client) => consumeItem(
    client, accountA, created.id, 'recipe input', 'item-consume-1',
  ));
  assert.equal(consumed.state, 'consumed');
  assert.equal((await inventoryBoard(pool, accountA)).items.length, 0,
    'consumed instances remain permanent but leave spendable inventory');
  await assert.rejects(
    inTransaction((client) => transferItem(
      client, accountA, characterA, created.id, 'impossible transfer', 'item-transfer-2',
    )),
    (error) => error?.code === 'item_unavailable',
    'consumed items cannot transfer',
  );
  await assert.rejects(
    inTransaction((client) => escrowItem(
      client, accountA, 'operation-3', created.id, 'impossible escrow', 'item-escrow-2',
    )),
    (error) => error?.code === 'item_unavailable',
    'consumed items cannot enter escrow',
  );

  const rows = (await pool.query(
    'SELECT event_kind FROM item_events WHERE item_id=$1 ORDER BY sequence', [created.id],
  )).rows.map((row) => row.event_kind);
  assert.deepEqual(rows, ['created', 'transferred', 'escrowed', 'released', 'consumed'],
    'every successful unique-item mutation appends one provenance event and replays append none');
  assert.equal(Number((await pool.query(
    'SELECT COUNT(*) AS n FROM item_instances WHERE id=$1', [created.id],
  )).rows[0].n), 1, 'the permanent unique item ID is never duplicated or deleted');

  // Compound game actions share one opaque logical guard across every leaf mutation. This is the
  // Task 4+ composition seam: replay skips the callback and returns its complete aggregate result.
  await inTransaction((client) => grantStack(
    client, characterA, 'mat:hardened_steel', 3, 'standard', 'fixture', 'compound-grant-1',
  ));
  let compoundExecutions = 0;
  const runCraft = (client) => withItemMutation(
    client, characterA, 'craft', 'compound-craft-1',
    { recipeId: 'recipe:precision_lock_tool', version: 1 },
    async (mutation) => {
      compoundExecutions += 1;
      const stack = await consumeStack(
        client, characterA, 'mat:hardened_steel', 2, 'standard',
        'recipe input', mutation,
      );
      const item = await createItem(
        client, characterA, 'item:compound_tool', 'crafted', mutation,
      );
      return { stack, item };
    },
  );
  const compound = await inTransaction(runCraft);
  const compoundReplay = await inTransaction(runCraft);
  assert.deepEqual(compoundReplay, compound);
  assert.equal(compoundExecutions, 1, 'a compound replay does not re-enter its mutation callback');
  assert.equal((await inventoryBoard(pool, characterA)).stacks
    .find((stack) => stack.templateId === 'mat:hardened_steel').qty, 1);
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_instances WHERE template_id='item:compound_tool'",
  )).rows[0].n), 1, 'a compound replay cannot duplicate its unique output');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key='compound-craft-1'",
  )).rows[0].n), 1, 'the complete craft owns one logical mutation guard');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) AS n FROM item_events WHERE idempotency_key='compound-craft-1'",
  )).rows[0].n), 2, 'multiple ordinal provenance events attach to that one compound guard');
  const provenance = (await pool.query(
    'SELECT provenance_kind FROM item_events WHERE item_id=$1', [compound.item.id],
  )).rows[0];
  assert.equal(provenance.provenance_kind, 'crafted',
    'created-item provenance uses the approved structured vocabulary');

  const socialItem = await inTransaction((client) => createItem(
    client, characterA, 'item:social_contribution', 'awarded', 'social-item-create-1',
  ));
  await assert.rejects(
    inTransaction((client) => escrowItem(
      client, characterA, 'operation-social', socialItem.id,
      'social contribution', 'social-item-escrow-bad', 'arbitrary_use',
    )),
    (error) => error?.code === 'bad_item_provenance',
    'escrow semantic provenance is caller-selected from a closed vocabulary',
  );
  await inTransaction((client) => escrowItem(
    client, characterA, 'operation-social', socialItem.id,
    'social contribution', 'social-item-escrow-1', 'used_in_operation',
  ));
  assert.equal((await pool.query(
    "SELECT provenance_kind FROM item_events WHERE item_id=$1 AND event_kind='escrowed'",
    [socialItem.id],
  )).rows[0].provenance_kind, 'used_in_operation',
  'generic escrow does not misclassify social-operation custody as mystery use');

  console.log('✅ test/items.js — conserved stacks, permanent unique items, single-custody operation escrow, provenance, and conflict-safe logical replay');
} finally {
  await pool.end();
}
