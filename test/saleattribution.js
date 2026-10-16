import assert from 'node:assert/strict';
import { fixture } from './saleattribution-fixture.js';
const f = await fixture(), { pool, tx, Ads, act, ref, attributionRef, list, state, books } = f;
try {
  const sale = await list(), initial = await state();
  let count = 0;
  for (const bad of [{ ...sale.open, commissionCash: 0 }, { ...sale.open, commissionCash: 92 },
    { ...sale.open, publisherAccountId: 'owner' }, { ...sale.open, publisherAccountId: 'host' },
    { ...sale.open, unexpected: true }, { ...sale.open, consent: false }]) {
    await assert.rejects(act('owner', 'open', bad, 'bad-' + (++count)), /terms|commission|self/);
    assert.deepEqual(await state(), initial, 'invalid offer has no custody, cash or metadata effect');
  }
  await assert.rejects(act('buyer', 'open', sale.open, 'foreign-seller'), /merchant/);
  const campaign = await act('owner', 'open', sale.open, 'open');
  assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE id='owner-actor'")).rows[0].cash), 9983);
  assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [sale.itemId])).rows[0].owner_id, sale.offer.consignmentId);
  await books();
  const reserved = await state();
  await assert.rejects(act('buyer', 'attribute', ref(campaign), 'before-consent'), /buyer/);
  await assert.rejects(act('owner', 'accept', ref(campaign), 'merchant-as-publisher'), /publisher/);
  await assert.rejects(act('owner', 'open', sale.open, 'duplicate-campaign'), /already_advertised/);
  assert.deepEqual(await state(), reserved);
  await act('other', 'accept', ref(campaign), 'publisher-consent');
  await assert.rejects(act('other', 'attribute', ref(campaign), 'self-publisher'), /self|buyer/);
  await assert.rejects(act('owner', 'attribute', ref(campaign), 'self-merchant'), /self|buyer/);
  await assert.rejects(act('host', 'attribute', ref(campaign), 'self-host'), /buyer/);
  const attribution = await act('buyer', 'attribute', ref(campaign), 'attribution');
  assert.deepEqual(await act('buyer', 'attribute', ref(campaign), 'attribution'), attribution);
  await assert.rejects(act('buyer', 'attribute', ref(campaign), 'new-attribution-key'), /immutable_attribution/);
  const beforeSale = await state();
  await assert.rejects(tx(async c => { await Ads.saleAttributionAction(c, 'buyer', 'buy', attributionRef(attribution), 'late-fault'); throw Error('late fault'); }), /late fault/);
  assert.deepEqual(await state(), beforeSale, 'actual UID transfer, all four cash legs and receipts roll back');
  await assert.rejects(tx(async c => { try { await Ads.saleAttributionAction(c, 'buyer', 'buy', { ...attributionRef(attribution), sourceHash: '0'.repeat(64) }, 'caught'); } catch {} return 'cannot commit'; }), /attribution_source/);
  assert.deepEqual(await state(), beforeSale);
  await assert.rejects(act('other', 'buy', attributionRef(attribution), 'publisher-as-buyer'), /buyer/);
  const bought = await act('buyer', 'buy', attributionRef(attribution), 'buy');
  assert.equal(bought.state, 'paid'); assert.equal(bought.commissionCash, 17);
  assert.equal(bought.sale.paid, 101); assert.equal(bought.sale.hostFee, 10); assert.equal(bought.sale.transactionIds.length, 3);
  assert.deepEqual((await pool.query("SELECT id,cash FROM characters ORDER BY id")).rows.map(row => [row.id, Number(row.cash)]),
    [['buyer-actor', 9899], ['host-actor', 10010], ['other-actor', 10017], ['owner-actor', 10074]]);
  const saleLegs = (await pool.query('SELECT id,character_id,amount,reason FROM transactions WHERE counterparty=$1 ORDER BY reason', [sale.offer.consignmentId])).rows;
  assert.deepEqual(saleLegs.map(row => Number(row.amount)), [10, 91, -101]);
  assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [sale.itemId])).rows[0].owner_id, 'buyer');
  const settled = await state();
  assert.deepEqual(await act('buyer', 'buy', attributionRef(attribution), 'buy'), bought);
  await assert.rejects(act('buyer', 'buy', attributionRef(attribution), 'buy-again'), /publisher|closed/);
  await assert.rejects(act('buyer', 'buy', { ...attributionRef(attribution), sourceHash: '0'.repeat(64) }, 'buy'), /request_conflict/);
  assert.deepEqual(await state(), settled); await books();
  const publicBoard = await tx(c => Ads.saleAttributionBoard(c, 'buyer'));
  assert(!JSON.stringify(publicBoard).includes(sale.itemId)); assert(!JSON.stringify(publicBoard).includes('owner-actor'));
  assert(!JSON.stringify(publicBoard).includes('buyer-actor'));

  const ordinary = await list(), unpaid = await act('owner', 'open', ordinary.open, 'ordinary-open');
  await act('other', 'accept', ref(unpaid), 'ordinary-consent');
  await f.invoke('buyConsignment', 'buyer', f.consignmentRef(ordinary.offer), 'ordinary-buy');
  assert.equal((await tx(c => Ads.saleAttributionBoard(c, 'buyer'))).rows.find(row => row.campaignId === unpaid.campaignId).available, false, 'ordinary sale removes advertised availability immediately');
  await assert.rejects(act('buyer', 'attribute', ref(unpaid), 'retroactive'), /expired/);
  const ordinaryBefore = (await pool.query('SELECT * FROM transactions WHERE counterparty=$1 ORDER BY id', [ordinary.offer.consignmentId])).rows;
  const refunded = await act('owner', 'cancel', ref(unpaid), 'ordinary-refund'); assert.equal(refunded.refundedCash, 17);
  assert.deepEqual((await pool.query('SELECT * FROM transactions WHERE counterparty=$1 ORDER BY id', [ordinary.offer.consignmentId])).rows, ordinaryBefore);
  await books();

  // Paid physical UID cannot generate another commission even after a real canonical resale.
  const relisted = await f.invoke('createConsignment', 'buyer', f.terms(sale.itemId), 'resale');
  await f.invoke('acceptConsignment', 'host', f.consignmentRef(relisted), 'resale-host');
  await assert.rejects(act('buyer', 'open', { ...f.consignmentRef(relisted), publisherAccountId: 'other', commissionCash: 17, lifetimeSeconds: 60 }, 'repeat-uid'), /already_advertised/);
  await f.invoke('cancelConsignment', 'buyer', f.consignmentRef(relisted), 'resale-cancel');
  await books();
  const cancelledSale = await list(), cancelled = await act('owner', 'open', cancelledSale.open, 'cancel-open');
  const beforeCancel = await state();
  await assert.rejects(tx(async c => { await Ads.saleAttributionAction(c, 'owner', 'cancel', ref(cancelled), 'cancel-fault'); throw Error('refund failure'); }), /refund failure/);
  assert.deepEqual(await state(), beforeCancel);
  await pool.query("UPDATE accounts SET status='banned' WHERE id='owner'");
  const cancelledResult = await act('owner', 'cancel', ref(cancelled), 'cancel'); assert.equal(cancelledResult.refundedCash, 17);
  await pool.query("UPDATE accounts SET status='active' WHERE id='owner'");
  await books();
  let queries = 0;
  await assert.rejects(Ads.saleAttributionAction({ query: async () => { queries++; return { rows: [] }; } }, 'owner', 'open', sale.open, 'fake-client'), /active withItemTransaction/);
  assert.equal(queries, 0);
  await assert.rejects(tx(c => Ads.assertSaleAttributionPurchaseScope(c, {}, sale.offer.consignmentId, sale.offer.sourceHash, 'buyer')), /purchase_scope/);
  await assert.rejects(tx(c => Ads.recoverSaleAttributionAtEstateStart(c, 'owner-actor', {}, {})), error => error.code === 'estate_scope');
  await assert.rejects(tx(c => f.C.assertFreshConsignmentSaleProof(c, {}, { attributionContext: {} })), /fresh_sale_proof/);
  await assert.rejects(tx(c => f.C.buyConsignmentWithEconomyContext(c, 'buyer', f.consignmentRef(ordinary.offer), 'ordinary-buy', { attributionContext: {} })), /fresh_sale_required/);
  await pool.query("UPDATE transactions SET amount=16 WHERE id=$1", [bought.commissionJournal]);
  assert((await Ads.collectSaleAttributionIssues(pool)).some(issue => issue.reason === 'cash_legs'));
  await pool.query("UPDATE transactions SET amount=17 WHERE id=$1", [bought.commissionJournal]);
  await pool.query("UPDATE sale_attribution_requests SET receipt=NULL,account_ref=NULL,original_character=NULL,campaign_ref=NULL WHERE run_id=$1", [attribution.attributionId]);
  assert((await Ads.collectSaleAttributionIssues(pool)).some(issue => issue.reason === 'attribution_receipt'));
  await pool.query('UPDATE sale_attribution_requests SET receipt=$2,account_ref=$3,original_character=$4,campaign_ref=$5 WHERE run_id=$1', [attribution.attributionId, attribution, 'buyer', 'buyer-actor', campaign.campaignId]);
  await books();
  console.log('Sale attribution actual N01 memory proof PASS: funded reserve, explicit consent, immutable attribution, exact three sale legs + separate commission, rollback/poison/replay/retroactive/self/repeat UID/refund/private-scope controls.');
} finally { await pool.end(); }
