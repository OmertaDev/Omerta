import assert from 'node:assert/strict';
import { nativeFixture, observeItemAllocations, assertExactRollback } from "./saleattribution-current-native-fixture.js";
import { runEstate } from '../src/social/estate.js';
const f = await nativeFixture();
try {
  const p = await f.prepare(), events = []; let before;
  await assert.rejects(f.G.withTwoCharacters(f.pool, 'buyer', 'owner-actor', (_actor, victim, c, h) =>
    observeItemAllocations(c, events, async () => {
      await runEstate(c, h, victim, 'N16 native actual late estate rollback');
      throw new Error('N16 genuine estate late fault');
    }), { meet: false, withActionScope: async (_c, _account, execute) => { before = await f.snapshot(); return execute(); } }), /N16 genuine estate late fault/);
  assert(before); assert(events.length > 0); assert(events.some(row => row.item_id === p.sale.itemId && row.event_kind === 'released'));
  assertExactRollback(before, await f.snapshot(), events); await f.books();
  let merchantBefore, peerBefore;
  await f.G.withTwoCharacters(f.pool, 'buyer', 'owner-actor', async (_actor, victim, c, h) => {
    merchantBefore = Number(victim.cash) + Number(victim.bank);
    peerBefore = (await c.query("SELECT id,cash FROM characters WHERE id IN ('buyer-actor','host-actor','other-actor') ORDER BY id")).rows;
    return runEstate(c, h, victim, 'N16 native original merchant estate');
  }, { meet: false });
  const row = (await f.pool.query('SELECT * FROM sale_attribution_campaigns WHERE id=$1', [p.campaign.campaignId])).rows[0];
  assert.equal(row.state, 'party_dead'); assert.equal(Number(row.refunded_cash), 17); assert.equal(Number(row.escrow_cash), 0); assert.equal(Number(row.paid_cash), 0);
  const refunds = (await f.pool.query("SELECT character_id,amount FROM transactions WHERE counterparty=$1 AND reason='sale_attribution:refund'", [p.campaign.campaignId])).rows;
  assert.deepEqual(refunds.map(r => [r.character_id, Number(r.amount)]), [['owner-actor', 17]]);
  const death = (await f.pool.query("SELECT amount FROM transactions WHERE character_id='owner-actor' AND reason='death:estate' AND currency='cash'")).rows;
  assert.equal(death.length, 1); assert.equal(Number(death[0].amount), -(merchantBefore + 17));
  assert.deepEqual((await f.pool.query("SELECT id,cash FROM characters WHERE id IN ('buyer-actor','host-actor','other-actor') ORDER BY id")).rows, peerBefore, 'Own reserve cannot be credited to publisher, buyer or storefront host');
  assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [p.sale.itemId])).rows[0].owner_id, 'owner');
  const stable = await f.snapshot();
  assert.deepEqual(await f.act('owner', 'open', p.sale.open, p.openKey), p.campaign, 'Only the original exact open ACK may survive estate');
  assertExactRollback(stable, await f.snapshot(), []);
  await assert.rejects(f.act('buyer', 'buy', f.attributionRef(p.attribution), 'heir-cannot-sell'), /original_actor/);
  assertExactRollback(stable, await f.snapshot(), []);
  await assert.rejects(f.tx(c => f.Ads.recoverSaleAttributionAtEstateStart(c, 'owner-actor', {}, {})), error => error.code === 'estate_scope');
  assertExactRollback(stable, await f.snapshot(), []);
  console.log(JSON.stringify({ proof: 'N16 native full-world genuine estate rollback, observed allocations, exact own refund and no peer cash', events, merchantBefore, checks: await f.books() }));
} finally { await f.pool.end(); }
