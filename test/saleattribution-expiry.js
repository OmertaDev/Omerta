import assert from 'node:assert/strict';
import { fixture } from './saleattribution-fixture.js';
const f = await fixture(), { pool, act, list, ref, attributionRef, state, books } = f;
try {
  const campaigns = [];
  for (let n = 0; n < 3; n++) {
    const sale = await list(), campaign = await act('owner', 'open', sale.open, 'cap-' + n);
    await act('other', 'accept', ref(campaign), 'accept-' + n);
    const attribution = await act('buyer', 'attribute', ref(campaign), 'attr-' + n);
    campaigns.push({ sale, campaign, attribution });
  }
  const overflow = await list(), capped = await state();
  await assert.rejects(act('owner', 'open', overflow.open, 'over-cap'), /merchant_limit/);
  assert.deepEqual(await state(), capped);
  await assert.rejects(act('owner', 'expire', ref(campaigns[0].campaign), 'too-early'), /not_expired/);
  const deadline = Math.max(...campaigns.map(({ campaign }) => +new Date(campaign.expiresAt)));
  const wait = Math.max(0, deadline - Date.now() + 100);
  console.log('Waiting genuine bounded campaign deadline milliseconds', wait);
  await new Promise(resolve => setTimeout(resolve, wait));
  const expired = await state();
  await assert.rejects(act('buyer', 'buy', attributionRef(campaigns[0].attribution), 'late-purchase'), /expired/);
  assert.deepEqual(await state(), expired, 'elapsed deadline produces no sale/commission/receipt');
  for (let n = 0; n < campaigns.length; n++) {
    const receipt = await act('owner', 'expire', ref(campaigns[n].campaign), 'expire-' + n);
    assert.equal(receipt.refundedCash, 17); assert.equal(receipt.state, 'expired');
  }
  assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE id='owner-actor'")).rows[0].cash), 10000);
  await books();
  console.log('Sale attribution real-clock expiry/cap PASS: three funded slots, exact overflow rollback, no late sale, own17x3 refunds, no source/backdate manipulation.');
} finally { await pool.end(); }
