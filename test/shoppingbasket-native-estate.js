import assert from 'node:assert/strict';
import { nativeFixture, observeItemAllocations, assertExactRollback } from './shoppingbasket-native-fixture.js';
import { runEstate } from '../src/social/estate.js';
const f = await nativeFixture();
try {
  const paid = await f.prepare(), receipt = await f.act('buyer', 'checkout', f.ref(paid.quote), 'native-estate-history'), pending = await f.prepare();
  const faults = [];
  for (const stage of ['after-estate', 'after-G-account-persist']) {
    const events = []; let before, wrapped, query, reached = 0;
    try {
      await assert.rejects(f.G.withTwoCharacters(f.pool, 'host-two', 'seller-a-actor', async (_actor, victim, c, h) => {
        if (stage === 'after-G-account-persist') {
          wrapped = c; query = c.query;
          c.query = async function (...args) {
            const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text, result = await query.apply(this, args);
            if (/^\s*INSERT INTO item_events\b/.test(sql || '')) {
              const row = (await query.call(this, 'SELECT id,sequence,event_kind,item_id FROM item_events WHERE id=$1', [args[1][0]])).rows[0];
              assert(row); events.push({ ...row, sequence: String(row.sequence) });
            }
            if (/^UPDATE account_persistent SET /.test(sql || '') && args[1]?.length > 10) {
              assert.equal(result.rowCount, 1); reached++;
              assert.equal((await query.call(this, 'SELECT alive FROM characters WHERE id=$1', ['seller-a-actor'])).rows[0].alive, false);
              throw Error('N18 actual post-G-account-persist rollback');
            }
            return result;
          };
          return runEstate(c, h, victim, 'N18 final G persistence fault');
        }
        return observeItemAllocations(c, events, async () => { await runEstate(c, h, victim, 'N18 after actual estate fault'); reached++; throw Error('N18 after-estate rollback'); });
      }, { meet: false, withActionScope: async (_c, _a, execute) => { before = await f.snapshot(); return execute(); } }), /N18 (?:actual post-G-account-persist|after-estate) rollback/);
    } finally { if (wrapped) wrapped.query = query; }
    assert.equal(reached, 1); assert(before); assert(events.some(e => e.event_kind === 'released' && e.item_id === pending.lines.find(l => l.seller === 'seller-a').itemId));
    assertExactRollback(before, await f.snapshot(), events); faults.push({ stage, events }); await f.books();
  }
  let originalCash, peers;
  const estate = await f.G.withTwoCharacters(f.pool, 'host-two', 'seller-a-actor', async (_actor, victim, c, h) => {
    originalCash = Number(victim.cash) + Number(victim.bank);
    peers = (await c.query("SELECT id,cash FROM characters WHERE id IN ('buyer-actor','seller-b-actor','host-actor','other-actor') ORDER BY id")).rows;
    return runEstate(c, h, victim, 'N18 genuine original seller estate');
  }, { meet: false });
  assert(estate.heirId); assert.notEqual(estate.heirId, 'seller-a-actor');
  const line = pending.lines.find(l => l.seller === 'seller-a');
  assert.equal((await f.pool.query('SELECT status FROM consignments WHERE id=$1', [line.offer.consignmentId])).rows[0].status, 'party_dead');
  assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [line.itemId])).rows[0].owner_id, 'seller-a');
  assert.deepEqual((await f.pool.query("SELECT id,cash FROM characters WHERE id IN ('buyer-actor','seller-b-actor','host-actor','other-actor') ORDER BY id")).rows, peers);
  const death = (await f.pool.query("SELECT amount FROM transactions WHERE character_id='seller-a-actor' AND currency='cash' AND reason='death:estate'")).rows;
  assert.equal(death.length, 1); assert.equal(Number(death[0].amount), originalCash === 0 ? 0 : -originalCash);
  const stable = await f.snapshot(); await assert.rejects(f.act('buyer', 'checkout', f.ref(pending.quote), 'native-dead-original'), /original_actor/); assertExactRollback(stable, await f.snapshot(), []);
  assert.deepEqual(await f.act('buyer', 'checkout', f.ref(paid.quote), 'native-estate-history'), receipt); assertExactRollback(stable, await f.snapshot(), []);
  assert.equal((await f.act('buyer', 'cancel', f.ref(pending.quote), 'native-metadata-recovery')).status, 'cancelled');
  console.log(JSON.stringify({ proof: 'N18 genuine original seller estate and final G account-persist rollback, unpaid UID recovery only, no basket reserve/peer cash and immutable checkout history', faults, originalCash, checks: await f.books() }));
} finally { await f.pool.end(); }
