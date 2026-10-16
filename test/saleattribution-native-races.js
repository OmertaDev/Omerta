import assert from 'node:assert/strict';
import { nativeFixture } from './saleattribution-native-fixture.js';
import { runEstate } from '../src/social/estate.js';
const f = await nativeFixture(), traces = [], results = [];
const buy = async (attribution, key) => f.tx(async c => {
  const query = c.query, locks = []; traces.push({ key, locks });
  c.query = function (...args) {
    if (/^SELECT \* FROM characters WHERE id=\$1 FOR UPDATE$/.test(args[0] || '')) locks.push(args[1][0]);
    return query.apply(this, args);
  };
  try { return await f.Ads.saleAttributionAction(c, 'buyer', 'buy', f.attributionRef(attribution), key); }
  finally { c.query = query; }
});
const settlement = async campaign => {
  const row = (await f.pool.query('SELECT * FROM sale_attribution_campaigns WHERE id=$1', [campaign.campaignId])).rows[0];
  assert.equal(Number(row.escrow_cash), 0); assert.equal(Number(row.paid_cash) + Number(row.refunded_cash), 17);
  const legs = (await f.pool.query("SELECT reason,amount FROM transactions WHERE counterparty=$1 AND reason LIKE 'sale_attribution:%' ORDER BY reason", [campaign.campaignId])).rows;
  assert.equal(legs.length, 2); assert.equal(legs.reduce((n, row) => n + Number(row.amount), 0), 0);
  await f.books(); return row;
};
const refused = values => values.filter(row => row.status === 'rejected').map(row => {
  assert.equal(row.reason.code, 'sale_attribution', 'A transport, deadlock or test error cannot count as a valid race refusal');
  assert(['source_changed', 'publisher', 'closed', 'original_actor'].includes(row.reason.message), row.reason.message);
  return row.reason.message;
});
try {
  {
    const p = await f.prepare(), values = await Promise.all([buy(p.attribution, 'same-key'), buy(p.attribution, 'same-key')]);
    assert.deepEqual(values[0], values[1]); assert.equal((await settlement(p.campaign)).state, 'paid');
    results.push({ race: 'same key buys', committedSale: 1, identicalAcknowledgements: 2 });
  }
  {
    const p = await f.prepare(), values = await Promise.allSettled([buy(p.attribution, 'different-a'), buy(p.attribution, 'different-b')]);
    assert.equal(values.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await settlement(p.campaign)).state, 'paid');
    results.push({ race: 'different key buys', winners: 1, refusals: refused(values) });
  }
  {
    const p = await f.prepare(), values = await Promise.allSettled([buy(p.attribution, 'buy-v-cancel'), f.act('owner', 'cancel', f.ref(p.campaign), 'cancel-v-buy')]);
    assert.equal(values.filter(r => r.status === 'fulfilled').length, 1);
    const row = await settlement(p.campaign); assert(['paid', 'cancelled'].includes(row.state));
    const title = (await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [p.sale.itemId])).rows[0].owner_id;
    assert.equal(title, row.state === 'paid' ? 'buyer' : p.sale.offer.consignmentId);
    results.push({ race: 'buy versus original merchant refund', winner: row.state, refusals: refused(values) });
  }
  {
    const p = await f.prepare(), death = () => f.G.withTwoCharacters(f.pool, 'buyer', 'owner-actor',
      (_actor, victim, c, h) => runEstate(c, h, victim, 'N16 actual concurrent merchant estate'), { meet: false });
    const values = await Promise.allSettled([buy(p.attribution, 'buy-v-estate'), death()]);
    assert.equal(values[1].status, 'fulfilled', values[1].reason?.message);
    const row = await settlement(p.campaign); assert(['paid', 'party_dead'].includes(row.state));
    assert.equal(values[0].status === 'fulfilled', row.state === 'paid');
    assert.equal((await f.pool.query("SELECT alive FROM characters WHERE id='owner-actor'")).rows[0].alive, false);
    const title = (await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [p.sale.itemId])).rows[0].owner_id;
    assert.equal(title, row.state === 'paid' ? 'buyer' : 'owner');
    results.push({ race: 'four-root buy versus genuine public estate', winner: row.state, refusals: refused(values) });
  }
  for (const { locks } of traces) if (locks.length) {
    assert.deepEqual(locks.slice(0, 4), ['buyer-actor', 'host-actor', 'other-actor', 'owner-actor']);
    assert(locks.every(id => ['buyer-actor', 'host-actor', 'other-actor', 'owner-actor'].includes(id)));
  }
  assert(traces.some(row => row.locks.length >= 4));
  console.log(JSON.stringify({ proof: 'N16 actual four-original PostgreSQL contention, canonical sale/refund/estate and exact replay', results, traces, checks: await f.books() }));
} finally { await f.pool.end(); }
