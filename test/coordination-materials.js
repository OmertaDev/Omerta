// Operation material transfers conserve exact template/quality quantities across every
// recipient, including the mutation's root owner. No new material authority comes from replay.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { grantStack, consumeStack, withItemMutation, withItemTransaction } from '../src/items.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup;
if (postgres) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
  const { Pool } = await import('pg');
  const base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `coordination_materials_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true });
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID();
const A = { scope: 'account', id: 'materials-a' }, B = { scope: 'account', id: 'materials-b' };
const operation = { scope: 'operation', id: 'materials-operation' };
const wire = 'mat:wire', steel = 'mat:scrap_steel';
const tx = (fn) => withItemTransaction(pool, fn);
const snapshot = async () => Object.fromEntries(await Promise.all(['item_stacks', 'item_events', 'item_mutation_guards', 'transactions']
  .map(async (table) => [table, (await pool.query(`SELECT * FROM ${table}`)).rows
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
const total = async (templateId = wire, quality = 'standard') => (await pool.query(
  'SELECT quantity FROM item_stacks WHERE template_id=$1 AND quality=$2', [templateId, quality])).rows
  .reduce((sum, row) => sum + Number(row.quantity), 0);
const qty = async (owner, templateId = wire, quality = 'standard') => Number((await pool.query(
  'SELECT quantity FROM item_stacks WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4',
  [owner.scope, owner.id, templateId, quality])).rows[0]?.quantity ?? 0);
const use = (action, { requestKey = key(), operations = [operation.id], destinations = [B], root = A } = {}) =>
  tx((client) => withItemMutation(client, root, 'operation_action', requestKey,
    { action: 'material-transfer', itemAuthority: { operations, destinations } }, (mutation) => action(client, mutation)));
const consume = (client, mutation, owner, amount, templateId = wire, quality = 'standard') =>
  consumeStack(client, owner, templateId, amount, quality, 'coordination material input', mutation);
const grant = (client, mutation, owner, amount, templateId = wire, quality = 'standard') =>
  grantStack(client, owner, templateId, amount, quality, 'coordination material destination', mutation);
async function denied(action, code = 'item_mutation_authority') {
  const before = await snapshot();
  await assert.rejects(action, { code });
  assert.deepEqual(await snapshot(), before, 'Rejected transfer restores all material balances, exact audit rows and root guard');
}

try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  await tx((client) => grantStack(client, A, wire, 100, 'standard', 'fixture material source', key()));
  await tx((client) => grantStack(client, A, steel, 12, 'standard', 'fixture material source', key()));
  await tx((client) => grantStack(client, A, wire, 8, 'fine', 'fixture material source', key()));
  await denied(() => use((client, mutation) => grant(client, mutation, A, 1)));
  await denied(() => use((client, mutation) => grant(client, mutation, B, 1)));
  const transferKey = key();
  const transfer = () => use(async (client, mutation) => {
    await consume(client, mutation, A, 10);
    return grant(client, mutation, operation, 10);
  }, { requestKey: transferKey });
  const deposits = await Promise.all([transfer(), transfer()]);
  assert.deepEqual(deposits[0], deposits[1]);
  assert.equal(await qty(A), 90); assert.equal(await qty(operation), 10); assert.equal(await total(), 100);
  const committed = await snapshot();
  assert.deepEqual(await transfer(), deposits[0]); assert.deepEqual(await snapshot(), committed);

  await denied(() => use((client, mutation) => consume(client, mutation, operation, 1), { operations: [] }));
  await denied(() => use(async (client, mutation) => {
    await consume(client, mutation, A, 1);
    await grant(client, mutation, operation, 1);
  }, { operations: [] }));
  await denied(() => use(async (client, mutation) => {
    await consume(client, mutation, operation, 1);
    await grant(client, mutation, B, 1);
  }, { destinations: [] }));

  // Regression: root-owner refunds must debit the same credit pool as other recipients.
  // Otherwise these two grants used to turn one operation input into twice the output.
  for (const targets of [[A, B], [B, A]]) {
    await denied(() => use(async (client, mutation) => {
      await consume(client, mutation, operation, 10);
      await grant(client, mutation, targets[0], 10);
      await grant(client, mutation, targets[1], 10);
    }));
  }
  await denied(() => use(async (client, mutation) => {
    await consume(client, mutation, operation, 2);
    await grant(client, mutation, B, 2, steel);
  }));
  await denied(() => use(async (client, mutation) => {
    await consume(client, mutation, operation, 2);
    await grant(client, mutation, B, 2, wire, 'fine');
  }));
  await denied(() => use(async (client, mutation) => {
    await consume(client, mutation, operation, 2);
    try { await grant(client, mutation, B, 3); } catch { /* caught error must poison the complete root */ }
    return { incorrectlyCommitted: true };
  }));
  assert.equal(await total(), 100);

  const refundKey = key();
  const distribute = () => use(async (client, mutation) => {
    await consume(client, mutation, operation, 10);
    const left = await grant(client, mutation, A, 4);
    const right = await grant(client, mutation, B, 6);
    return [left, right];
  }, { requestKey: refundKey });
  const refunds = await Promise.all([distribute(), distribute()]);
  assert.deepEqual(refunds[0], refunds[1]);
  assert.equal(await qty(A), 94); assert.equal(await qty(B), 6); assert.equal(await qty(operation), 0);
  assert.equal(await total(), 100);

  // An operation can explicitly consume deposited materials as a sink, but that
  // spent credit disappears with the root and cannot authorize a later grant.
  await use(async (client, mutation) => {
    await consume(client, mutation, A, 3);
    await grant(client, mutation, operation, 3);
    await consume(client, mutation, operation, 3);
    return { consumed: 3 };
  });
  assert.equal(await total(), 97);
  await denied(() => use((client, mutation) => grant(client, mutation, B, 3)));
  assert.equal(await total(steel), 12); assert.equal(await total(wire, 'fine'), 8);
  assert.equal((await pool.query('SELECT id FROM transactions')).rows.length, 0, 'Material coordination cannot move cash or OMR');
  console.log(`coordination-materials: conserved mixed-owner deposit/refund, exact identity, root-owner double-grant refusal, atomic rollback and concurrent replay pass (${postgres ? 'postgres' : 'pg-mem'})`);
} finally {
  await cleanup();
}
