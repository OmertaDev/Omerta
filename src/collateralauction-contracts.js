import { COLLATERAL_AUCTION } from './collateralauction-schema.js';
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const id = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[!-~]+$' }, digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const integer = minimum => ({ type: 'integer', minimum }), yes = { const: true }, no = { const: false }, stamp = { type: 'string', format: 'date-time' };
const ids = { type: 'array', maxItems: 2, items: id };
const agreement = object({ agreementId: id, sourceHash: digest, loanId: id, itemId: id, approved: { type: 'boolean' }, reserve: integer(5000), auctionSeconds: integer(60) });
const bid = object({ bidId: id, amount: integer(5000), state: { enum: ['held', 'spent', 'refunded'] }, mine: { type: 'boolean' } });
const auction = object({ auctionId: id, itemId: id, sourceHash: digest, state: { enum: ['open', 'settled', 'cancelled'] }, reserve: integer(5000), closesAt: stamp, settleUntil: stamp, sealed: { type: 'boolean' }, bids: { type: 'array', maxItems: 2, items: bid } });
const result = { oneOf: [
  object({ ok: yes, agreementId: id, sourceHash: digest, approved: { type: 'boolean' } }),
  object({ ok: yes, auctionId: id, agreementId: id, sourceHash: digest, closesAt: stamp, settleUntil: stamp, reserve: integer(5000), ranking: { const: COLLATERAL_AUCTION.ranking } }),
  object({ ok: yes, auctionId: id, bidId: id, sourceHash: digest, escrowedCash: integer(5000) }),
  object({ ok: yes, auctionId: id, winningBidId: id, itemId: id, paid: integer(5000), debtPaid: integer(5000), borrowerSurplus: integer(0), saleEvent: id, releaseEvent: id, refundedBids: ids }),
  object({ ok: yes, auctionId: id, cancelled: yes, refundedBids: ids }),
  object({ ok: yes, auctionId: id, bidId: id, refundedCash: integer(5000), refundedBids: ids })
] };
const availability = object({ available: { type: 'boolean' }, nativeOnly: yes, financialActivation: no, currency: { const: 'game_cash' }, cryptoAvailable: no });
const board = object({ agreements: { type: 'array', maxItems: 25, items: agreement }, auctions: { type: 'array', maxItems: 25, items: auction },
  limits: object(Object.fromEntries(Object.entries(COLLATERAL_AUCTION).map(([key, value]) => [key, { const: value }]))) });
const ref = object({ auctionId: id, sourceHash: digest, consent: yes });
const base = '/v1/loans/equipment/auctions';
export const COLLATERAL_AUCTION_SCHEMAS = Object.freeze({ CollateralAuctionAvailability: availability, CollateralAuctionBoard: board, CollateralAuctionResult: result });
export const COLLATERAL_AUCTION_CONTRACTS = Object.freeze({
  ['GET ' + base + '/availability']: { responseSchema: availability }, ['GET ' + base]: { responseSchema: board },
  ['POST ' + base + '/prepare']: { requestSchema: object({ loanId: id, itemId: id, quoteHash: digest, reserve: integer(5000), auctionSeconds: { type: 'integer', minimum: 60, maximum: 3600 }, consent: yes }), responseSchema: result },
  ['POST ' + base + '/approve']: { requestSchema: object({ agreementId: id, sourceHash: digest, consent: yes }), responseSchema: result },
  ['POST ' + base + '/open']: { requestSchema: object({ agreementId: id, pledgeId: id, sourceHash: digest, consent: yes }), responseSchema: result },
  ['POST ' + base + '/bid']: { requestSchema: object({ auctionId: id, sourceHash: digest, amount: { type: 'integer', minimum: 5000, maximum: 2000000 }, consent: yes }), responseSchema: result },
  ['POST ' + base + '/settle']: { requestSchema: object({ auctionId: id, sourceHash: digest, winningBidId: id, consent: yes }), responseSchema: result },
  ['POST ' + base + '/refund']: { requestSchema: ref, responseSchema: result }, ['POST ' + base + '/cancel']: { requestSchema: ref, responseSchema: result }
});
