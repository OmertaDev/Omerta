import assert from 'node:assert/strict';
import { fixture } from './saleattribution-fixture.js';
import { runEstate } from '../src/social/estate.js';
const f = await fixture(), { pool, tx, Ads, act, list, ref, attributionRef, state, books, G } = f;
try {
  const sale = await list(), campaign = await act('owner', 'open', sale.open, 'estate-open');
  await act('other', 'accept', ref(campaign), 'estate-consent');
  const attribution = await act('buyer', 'attribute', ref(campaign), 'estate-attribution');
  if (f.native) {
    const { canonicalDatabaseSnapshot } = await import('../tools/rc1-native-proof.js'); let before;
    await assert.rejects(G.withTwoCharacters(pool, 'buyer', 'owner-actor', async (_actor, victim, c, h) => {
      await runEstate(c, h, victim, 'actual advertising late fault'); throw Error('after genuine estate');
    }, { meet: false, withActionScope: async (_c, _a, execute) => { before = await canonicalDatabaseSnapshot(pool); return execute(); } }), /after genuine estate/);
    const after = await canonicalDatabaseSnapshot(pool);
    assert.deepEqual(after.tables, before.tables, 'all canonical estate rows roll back');
    assert.deepEqual(after.sequences, before.sequences.map(row => row.sequencename === 'item_events_sequence_seq'
      ? { ...row, last_value: String(BigInt(row.last_value) + 1n) } : row), 'one attempted escrow-release allocator advance only');
  }
  const merchantCash = Number((await pool.query("SELECT cash FROM characters WHERE id='owner-actor'")).rows[0].cash);
  await G.withTwoCharacters(pool, 'buyer', 'owner-actor', (_actor, victim, c, h) => runEstate(c, h, victim, 'actual advertising merchant death'), { meet: false });
  const row = (await pool.query('SELECT * FROM sale_attribution_campaigns WHERE id=$1', [campaign.campaignId])).rows[0];
  assert.equal(row.state, 'party_dead'); assert.equal(Number(row.refunded_cash), 17); assert.equal(Number(row.escrow_cash), 0);
  assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [sale.itemId])).rows[0].owner_id, 'owner');
  const death = (await pool.query("SELECT amount FROM transactions WHERE character_id='owner-actor' AND reason='death:estate' AND currency='cash'")).rows;
  assert.equal(death.length, 1); assert.equal(Number(death[0].amount), -(merchantCash + 17));
  assert.deepEqual(await act('owner', 'open', sale.open, 'estate-open'), campaign, 'historical ACK only after original dies');
  await assert.rejects(act('buyer', 'buy', attributionRef(attribution), 'dead-merchant-sale'), /original_actor/);
  await assert.rejects(act('owner', 'cancel', ref(campaign), 'new-dead-request'), /original_actor/);
  const heirs = (await pool.query("SELECT id FROM characters WHERE account_id='owner' AND alive=true")).rows;
  assert.equal(heirs.length, 1); assert.notEqual(heirs[0].id, 'owner-actor');
  await assert.rejects(act('owner', 'cancel', ref(campaign), 'heir-request'), /original_actor/);
  await assert.rejects(tx(c => Ads.recoverSaleAttributionAtEstateStart(c, heirs[0].id, {}, {})), error => error.code === 'estate_scope');
  await books();
  console.log('Sale attribution actual private estate PASS: own reserve refund before exactCash, canonical UID recovery, dead/replaced original refusal and historical ACK without new value. Native full-world late-fault rollback ' + (f.native ? 'PASS' : 'NOT RUN; memory is not native rollback evidence') + '.');
} finally { await pool.end(); }
