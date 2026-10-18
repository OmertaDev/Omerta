import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fixture } from './collateralauction-fixture.js';
import { collateralAuctionTerms } from '../src/collateralauction.js';
import { COLLATERAL_AUCTION_CONTRACTS } from '../src/collateralauction-contracts.js';
const hash = 'a'.repeat(64), ref = { auctionId: 'auction', sourceHash: hash, consent: true };
const samples = {
  prepare: { loanId: 'loan', itemId: 'item', quoteHash: hash, reserve: 5250, auctionSeconds: 60, consent: true },
  approve: { agreementId: 'agreement', sourceHash: hash, consent: true },
  open: { agreementId: 'agreement', pledgeId: 'pledge', sourceHash: hash, consent: true },
  bid: { ...ref, amount: 6000 }, settle: { ...ref, winningBidId: 'bid' }, refund: ref, cancel: ref
};
for (const [action, body] of Object.entries(samples)) {
  assert.deepEqual(collateralAuctionTerms(action, body), body);
  assert.equal(JSON.stringify(collateralAuctionTerms(action, Object.fromEntries(Object.entries(body).reverse()))),
    JSON.stringify(collateralAuctionTerms(action, body)), 'Request field ordering cannot change the canonical consent guard');
  for (const changed of [{ ...body, consent: false }, { ...body, actorIds: ['borrower', 'lender', 'winner'] }, { ...body, financialActivation: true }])
    assert.throws(() => collateralAuctionTerms(action, changed), /terms/);
  for (const key of Object.keys(body)) { const missing = { ...body }; delete missing[key]; assert.throws(() => collateralAuctionTerms(action, missing)); }
}
for (const amount of [NaN, Infinity, 1.5, 4999, 2000001, '6000']) assert.throws(() => collateralAuctionTerms('bid', { ...samples.bid, amount }));
for (const auctionSeconds of [0, 59, 3601, 1.1, '60']) assert.throws(() => collateralAuctionTerms('prepare', { ...samples.prepare, auctionSeconds }));
assert.equal(Object.keys(COLLATERAL_AUCTION_CONTRACTS).length, 9);
const f = await fixture();
try {
  const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
  const spec = (await f.app.inject({ method: 'GET', url: '/openapi.json' })).json();
  for (const [key, contract] of Object.entries(COLLATERAL_AUCTION_CONTRACTS)) {
    const [method, route] = key.split(' '), operation = spec.paths[route]?.[method.toLowerCase()];
    assert(operation, key); assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    assert.deepEqual(operation.responses['200'].content['application/json'].schema, contract.responseSchema);
    if (contract.requestSchema) assert.deepEqual(operation.requestBody.content['application/json'].schema, contract.requestSchema);
    assert.equal((await f.call(null, method, route, method === 'POST' ? {} : undefined)).statusCode, 401);
  }
  const actor = await f.player(), borrower = await f.player(), tool = await f.makeTool(borrower), loan = await f.offer(actor, borrower);
  const q = await f.quote(borrower, loan, tool);
  assert.equal(q.principal, 5000); assert.equal(q.owed, 5250);
  const prepared = { ...samples.prepare, loanId: loan.id, itemId: tool, quoteHash: q.sourceHash };
  const before = await f.state();
  for (const agent of [false, true]) {
    const availability = await f.ok(borrower, 'GET', '/v1/loans/equipment/auctions/availability', undefined, f.key('availability'), agent);
    assert.equal(availability.available, false); assert.equal(availability.nativeOnly, true); assert.equal(availability.financialActivation, false);
    const board = await f.ok(borrower, 'GET', '/v1/loans/equipment/auctions', undefined, f.key('board'), agent);
    for (const [path, value] of [['/availability', availability], ['', board]]) assert(ajv.compile(COLLATERAL_AUCTION_CONTRACTS['GET /v1/loans/equipment/auctions' + path].responseSchema)(value), JSON.stringify(ajv.errors));
    assert.deepEqual(board.agreements, []); assert.deepEqual(board.auctions, []); assert.equal(board.limits.maximumBids, 2);
    const refused = await f.call(borrower, 'POST', '/v1/loans/equipment/auctions/prepare', prepared, f.key('native-only'), agent);
    assert.equal(refused.statusCode, 400, refused.body); assert.equal(refused.json().error, 'collateral_auction_unavailable');
  }
  assert.deepEqual(await f.state(), before, 'Portable driver cannot manufacture a positive cash/title auction');
  await assert.rejects(() => f.tx(client => f.Auction.assertCollateralAuctionRepayment(client, Object.freeze({}))), /repayment_authority/);
  await assert.rejects(() => f.tx(client => f.Auction.assertCollateralAuctionDisposal(client, {}, { id: 'fake', item_id: tool, borrower_account: borrower.account })), /disposal_authority/);
  await assert.rejects(() => f.tx(client => f.Auction.recoverCollateralAuctionFromLoan(client, Object.freeze({}))), /loan_recovery_proof/);
  await f.tx(client => f.Auction.finalizeCollateralAuction(client, { ok: true, auctionId: 'unbranded' }));
  await f.books();
  assert.equal((await f.call(null, 'GET', '/v1/loans/equipment/auctions')).statusCode, 401);
  assert.equal((await f.call(borrower, 'GET', '/v1/loans/equipment/auctions?actorIds=all')).statusCode, 400);
  console.log('✓ N24 terms, actual ordinary quote, closed human/agent DTO, native-only financial/custody guard, private authority negatives and books');
} finally { await f.app.close(); }
