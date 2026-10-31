// Run only against the owned fixture selected by the coordinator. Every mutation
// after fixture.baseline is actual HTTP; no SQL/domain action completes a leg.
import assert from 'node:assert/strict';
import { businessDeskFixture, SALVAGE_RECIPE, courierReference, consignmentReference } from './lib/business-control-desk-fixture.js';

const f = await businessDeskFixture([{ label: 'human', credential: 'human' }, { label: 'agent', credential: 'agent' }]);
try {
  for (const s of f.scenarios) {
    const { maker, seller, first, second, host, buyer, outsider } = s.actors;
    const before = await f.snapshot(), prefix = `desk-loop-${s.label}`;
    const post = (actor, path, body, stage) => f.replay(actor, 'POST', path, body, `${prefix}-${stage}`);
    const buyPath = `/v1/market/${s.inputs[0].listingId}/buy`;
    const secondBuyPath = `/v1/market/${s.inputs[1].listingId}/buy`;
    assert.equal((await f.refused({ ...maker, token: s.delegatedToken, credential: 'human' }, 'POST', buyPath, {})).status, 401,
      'An opaque preparation-only gateway connection cannot become player mutation authority.');
    await f.refused(seller, 'POST', buyPath, {});
    await f.refused(maker, 'POST', secondBuyPath, {});
    await f.refused(outsider, 'POST', '/v1/company/production/run', s.production);
    await f.refused(maker, 'POST', '/v1/company/specializations', { ...s.grantBody, expectedRevision: 1 }, undefined, 'agent');

    // Two genuine network requests contend for one global HTTP key. The mounted
    // handler, not a mocked dispatcher, owns the source car and cash settlement.
    const buyKey = `${prefix}-buy-input`, cashBefore = await f.cash(maker);
    const competing = await Promise.all([
      f.request(maker, 'POST', buyPath, {}, buyKey),
      f.request(maker, 'POST', buyPath, {}, buyKey),
    ]);
    assert(competing.some(response => response.status === 200), JSON.stringify(competing));
    for (const response of competing) {
      assert([200, 409].includes(response.status), response.text);
      if (response.status === 409) { assert.equal(response.body.error, 'in_progress'); assert.equal(response.headers['retry-after'], '1'); }
    }
    const bought = await f.replay(maker, 'POST', buyPath, {}, buyKey);
    assert.equal(bought.carId, s.inputs[0].carId); assert.equal(bought.paid, 1000);
    assert.equal(await f.cash(maker), cashBefore - 1000, 'Concurrent delivery and exact retries debit the purchase only once.');
    const purchased = await f.snapshot();
    assert.equal(purchased.cars.find(row => row.id === bought.carId)?.character_id, maker.id);
    // The failed next leg cannot erase the already committed purchase.
    await f.refused(maker, 'POST', '/v1/company/production/run', s.production);
    assert.deepEqual(await f.snapshot(), purchased);
    await f.refused(outsider, 'POST', SALVAGE_RECIPE + bought.carId, {});
    await post(maker, SALVAGE_RECIPE + bought.carId, {}, 'salvage');
    assert.equal((await f.snapshot()).cars.some(row => row.id === bought.carId), false);
    await f.refused(maker, 'POST', SALVAGE_RECIPE + bought.carId, {});

    // One salvage supplies exactly one tool. A second tool in the same batch
    // fails after the first two canonical crafts; all batch effects roll back,
    // while the earlier paid car purchase and salvage remain committed.
    const salvaged = await f.snapshot();
    await f.refused(maker, 'POST', '/v1/company/production/run', { businessId: s.businessId,
      steps: [{ recipeId: 'recipe:hardened_steel', repeat: 1 }, { recipeId: 'recipe:precision_lock_tool', repeat: 2 }] });
    assert.deepEqual(await f.snapshot(), salvaged);
    const produced = await post(maker, '/v1/company/production/run', s.production, 'produce');
    assert.equal(produced.totalCrafts, 2); assert.equal(produced.totalCashCost, 300);
    const toolId = produced.crafts.at(-1).receipt.outputs[0].id;
    assert(toolId); assert.equal((await f.item(toolId)).owner_id, maker.account);
    if (s.credential === 'agent') assert.equal(produced.crafts[0].admission.grant, 'explicit_owner_game_grant');

    const terms = { itemId: toolId, firstCarrier: first.account, secondCarrier: second.account,
      origin: 'foundry', handoff: 'docks', destination: 'neon', firstFee: 30, secondFee: 40, expiresInSeconds: 3600, consent: true };
    await f.refused(outsider, 'POST', '/v1/company/courier-networks/publish', terms);
    const network = await post(maker, '/v1/company/courier-networks/publish', terms, 'courier-publish');
    const reference = courierReference(network);
    await f.refused(maker, 'POST', '/v1/company/courier-networks/dispatch', reference);
    await f.refused(outsider, 'POST', '/v1/company/courier-networks/consent', reference);
    await post(first, '/v1/company/courier-networks/consent', reference, 'first-consent');
    await post(second, '/v1/company/courier-networks/consent', reference, 'second-consent');
    await post(maker, '/v1/company/courier-networks/dispatch', reference, 'dispatch');
    let custody = await f.item(toolId); assert.equal(custody.owner_scope, 'operation'); assert.equal(custody.owner_id, network.networkId + ':first');
    await f.refused(second, 'POST', '/v1/company/courier-networks/arrive', reference);
    await post(first, '/v1/company/courier-networks/travel', reference, 'first-travel');
    await post(first, '/v1/company/courier-networks/handoff', reference, 'handoff');
    custody = await f.item(toolId); assert.equal(custody.owner_id, network.networkId + ':second');
    await post(maker, '/v1/travel/neon', {}, 'maker-travel');
    await post(second, '/v1/company/courier-networks/travel', reference, 'second-travel');
    await f.refused(outsider, 'POST', '/v1/company/courier-networks/arrive', reference);
    assert.equal((await post(second, '/v1/company/courier-networks/arrive', reference, 'arrive')).status, 'completed');
    custody = await f.item(toolId); assert.equal(custody.owner_scope, 'account'); assert.equal(custody.owner_id, maker.account);

    const saleTerms = { itemId: toolId, hostAccountId: host.account, price: 10000, hostFeeBps: 1000, lifetimeSeconds: 3600, consent: true };
    await f.refused(outsider, 'POST', '/v1/consignments/create', saleTerms);
    const offer = await post(maker, '/v1/consignments/create', saleTerms, 'sale-create');
    const saleReference = consignmentReference(offer);
    await f.refused(outsider, 'POST', '/v1/consignments/accept', saleReference);
    await post(host, '/v1/consignments/accept', saleReference, 'sale-accept');
    await f.refused(maker, 'POST', '/v1/consignments/buy', saleReference);
    assert(await f.cash(maker) < s.inputs[1].price, 'Existing funds alone cannot finance the second input.');
    await f.refused(maker, 'POST', secondBuyPath, {});
    const sale = await post(buyer, '/v1/consignments/buy', saleReference, 'sale-buy');
    assert.equal(sale.itemId, toolId); assert.equal(sale.paid, 10000); assert.equal(sale.hostFee, 1000);
    assert(await f.cash(maker) >= s.inputs[1].price, 'A genuinely funded counterparty supplied the settled proceeds.');
    const reinvested = await post(maker, secondBuyPath, {}, 'reinvest');
    assert.equal(reinvested.carId, s.inputs[1].carId); assert.equal(reinvested.paid, 5000);
    await f.assertFinished(s, toolId, before);
    console.log(`business desk ${s.label} PASS: real HTTP auth, bought car → conserved salvage → canonical batch → consented custody → funded UID sale → reinvestment; global gzip ACK/replay, changed-key refusal, competing purchase and failed-prefix preservation`);
  }
} finally { await f.close(); }
