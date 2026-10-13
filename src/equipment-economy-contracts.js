// Closed equipment-economy payloads. Authority remains in the canonical registrars.
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, required, properties });
const integer = (minimum, maximum = Number.MAX_SAFE_INTEGER) => ({ type: 'integer', minimum, maximum });
const id = { type: 'string', minLength: 1, maxLength: 200 };
const shortId = { ...id, maxLength: 128 };
const canonicalId = { ...shortId, pattern: '^[A-Za-z0-9_-]{1,128}$' };
const printableId = { ...shortId, pattern: '^[!-~]{1,128}$' };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const date = { type: 'string', format: 'date-time' };
const nullable = value => ({ anyOf: [value, { type: 'null' }] });
const array = (items, maxItems) => ({ type: 'array', items, ...(maxItems === undefined ? {} : { maxItems }) });
const ref = name => ({ $ref: '#/components/schemas/' + name });
const truth = { const: true }, zero = { const: 0 }, boolean = { type: 'boolean' }, cash = integer(0);
// This existing G projection is not a new receipt or an equipment authority grant.
const character = { type: ['object', 'null'], description: 'Unchanged canonical G character projection; null after a post-commit render refusal.' };
const receipt = (properties, optional = []) => object(properties, Object.keys(properties).filter(key => !optional.includes(key)));
const gReceipt = properties => receipt({ character, ...properties }, ['character']);
const replayReceipt = properties => receipt({ ...properties, replayed: truth }, ['replayed']);
const emptyBody = { type: ['object', 'null'], additionalProperties: false, properties: {} };
const key = { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', pattern: '^[!-~]{1,128}$' } };
const contract = (operationId, responseSchema, requestSchema) => ({ operationId, responseSchema,
  ...(requestSchema ? { requestSchema, requestParameters: [key] } : {}) });
const negotiationTerms = object({ qty: integer(1, 40), unitPrice: integer(50, 1000000), maxProcurementCash: integer(1, 100000), deadlineSeconds: integer(120, 21600) });
const negotiationState = { enum: ['offered', 'accepted', 'withdrawn', 'expired'] };
const negotiationProperties = { id: canonicalId, orderId: canonicalId, depotId: canonicalId, buyerCharacter: canonicalId,
  supplierCharacter: canonicalId, revision: integer(1, 3), state: negotiationState, terms: negotiationTerms, termsHash: hash,
  lastOfferCharacter: canonicalId, expiresAt: date, deliveryDeadline: date, commitmentId: nullable(canonicalId), gameCashOnly: truth,
  priceRule: { const: 'existing_funded_order_fixed_unit_price' }, deadlineRule: { const: 'fixed_at_original_offer' },
  negotiableFields: { type: 'array', items: { enum: ['qty', 'maxProcurementCash'] }, minItems: 2, maxItems: 2, uniqueItems: true }, acceptancePaysNothing: truth };
const ranking = { const: 'shortest_delivery_seconds_then_lowest_procurement_cash_ceiling_then_server_bid_id' };
const originalTitle = { const: 'original_landlord_account' };

export const EQUIPMENT_ECONOMY_SCHEMAS = {
  EquipmentRentalBoard: object({
    leases: array(object({ id, item_id: id, landlord_account: id, landlord_character: id, borrower_account: id, borrower_character: id,
      rent_cash: integer(1, 100000), deposit_cash: integer(0, 100000), deposit_remaining: integer(0, 100000), ends_at: date,
      status: { enum: ['active', 'returned', 'death_ended'] } }), 20),
    offers: array(object({ id, item_id: id, rent_cash: integer(1, 100000), deposit_cash: integer(0, 100000), duration_seconds: integer(60, 3600),
      published: boolean, expires_at: date, status: { enum: ['open', 'leased', 'cancelled'] } }), 20),
    quotes: array(object({ id, rent_cash: integer(1, 100000), deposit_cash: integer(0, 100000), duration_seconds: integer(60, 3600), expires_at: date, name: { type: 'string' } }), 20),
    depositPolicy: { const: 'full_refund_on_canonical_return; original_borrower_death_burn' }, rentalFee: { const: 'flat_earned_at_acceptance' },
  }),
  EquipmentRentalOfferReceipt: object({ ok: truth, offerId: id, itemId: id, rentCash: integer(1, 100000), depositCash: integer(0, 100000), expiresAt: date, condition: integer(10, 150) }),
  EquipmentRentalCancelReceipt: object({ ok: truth, offerId: id, cancelled: truth }),
  EquipmentRentalAcceptReceipt: { ...receipt({ ok: truth, leaseId: id, itemId: id, landlordAccount: id, landlordCharacter: id, borrowerCharacter: id,
    rentCash: integer(1, 100000), depositCash: integer(0, 100000), endsAt: date, title: originalTitle,
    rentDebit: id, rentCredit: id, depositDebit: nullable(id) }, ['rentDebit', 'rentCredit', 'depositDebit']),
    dependencies: { rentDebit: ['rentCredit', 'depositDebit'], rentCredit: ['rentDebit', 'depositDebit'], depositDebit: ['rentDebit', 'rentCredit'] } },
  EquipmentRentalEndReceipt: receipt({ ok: truth, leaseId: id, itemId: id, status: { const: 'returned' },
    refunded: integer(0, 100000), burned: integer(0, 100000), title: originalTitle, borrowerCharacter: id }, ['borrowerCharacter']),
  EquipmentMaintenanceOwnBoard: array(object({ id: shortId, revision: integer(1), enabled: boolean, fee_cash: integer(1, 1000), expires_at: date }), 50),
  EquipmentMaintenancePublicBoard: array(object({ id: shortId, revision: integer(1), fee_cash: integer(1, 1000), expires_at: date, district: { type: 'string' } }), 50),
  EquipmentMaintenanceOfferReceipt: replayReceipt({ offerId: shortId, revision: integer(1), enabled: boolean, feeCash: integer(1, 1000), expiresAt: date }),
  EquipmentMaintenanceRepairReceipt: replayReceipt({ repairId: shortId, itemId: shortId, offerId: shortId, feeCash: integer(1, 1000), remaining: integer(10, 150), maximum: { enum: [100, 150] } }),
  CommercialNegotiation: object(negotiationProperties),
  CommercialNegotiationBoard: object({ negotiations: array(object({ ...negotiationProperties, effectiveState: { enum: ['offered', 'accepted', 'withdrawn', 'expired', 'party_dead'] } }), 30), maxRounds: { const: 3 } }),
  CommercialNegotiationReceipt: gReceipt({ ok: truth, negotiation: ref('CommercialNegotiation'), paid: zero }),
  ServiceSubscriptionBoard: array(object({ id: shortId, payer_account: shortId, payer_character: shortId, provider_account: shortId, provider_character: shortId,
    offer_id: shortId, item_id: shortId, fee_ceiling: integer(1, 1000), max_cycles: integer(1, 12), interval_seconds: integer(300, 86400),
    cycles_completed: integer(0, 12), expires_at: date, next_run_at: date, revision: integer(1), state: { enum: ['active', 'closed'] },
    close_reason: nullable({ enum: ['expired', 'cancelled', 'completed', 'payer_death'] }), initial_cash: integer(1, 12000), escrow_cash: integer(0, 12000),
    spent_cash: integer(0, 12000), refunded_cash: integer(0, 12000), burned_cash: integer(0, 12000) }), 50),
  ServiceSubscriptionCreateReceipt: replayReceipt({ subscriptionId: shortId, escrowCash: integer(1, 12000), maxCycles: integer(1, 12), feeCeiling: integer(1, 1000) }),
  ServiceSubscriptionCloseReceipt: replayReceipt({ subscriptionId: shortId, refundedCash: integer(0, 12000), closed: truth }),
  ContractAuctionBoard: object({ own: array(receipt({ id: printableId, quantity: integer(1, 40), fixedUnitPayout: integer(50, 1000000), quoteHash: hash,
    closesAt: date, awardUntil: date, state: { enum: ['open', 'awarded', 'cancelled', 'buyer_dead'] }, winningBidId: nullable(printableId), commitmentId: nullable(printableId),
    bids: array(receipt({ id: printableId, supplier_character: printableId, deadline_seconds: integer(60, 21600), max_procurement_cash: integer(1, 100000) }, ['supplier_character']), 8), observedExpired: boolean }, ['winningBidId', 'commitmentId']), 20),
    quotes: array(object({ id: printableId, quantity: integer(1, 40), unit_price: integer(50, 1000000), quote_hash: hash, closes_at: date, award_until: date }), 20),
    payout: { const: 'fixed_canonical_order_price' }, ranking, performance: { const: 'promises_not_measured_results' } }),
  ContractAuctionCreateReceipt: gReceipt({ ok: truth, auctionId: printableId, quoteHash: hash, quantity: integer(1, 40), fixedUnitPayout: integer(50, 1000000),
    closesAt: date, awardUntil: date, ranking, cashMoved: zero }),
  ContractAuctionBidReceipt: gReceipt({ ok: truth, auctionId: printableId, bidId: printableId, deadlineSeconds: integer(60, 21600), maxProcurementCash: integer(1, 100000),
    fixedUnitPayout: integer(50, 1000000), quantity: integer(1, 40), irrevocableUntil: date, cashMoved: zero }),
  ContractAuctionDelivery: object({ ok: truth, id: printableId, quantity: integer(1, 40), district: { type: 'string' }, unitPrice: integer(50, 1000000),
    takeBps: integer(0, 10000), netPayout: cash, deadline: date, maxProcurementCash: integer(1, 100000) }),
  ContractAuctionAwardReceipt: gReceipt({ ok: truth, auctionId: printableId, winningBidId: printableId, commitmentId: printableId,
    delivery: ref('ContractAuctionDelivery'), cashMoved: zero, fulfillment: { const: 'not_yet_delivered' } }),
  ContractAuctionCancelReceipt: gReceipt({ ok: truth, auctionId: printableId, cancelled: truth, cashMoved: zero }),
};

export const EQUIPMENT_ECONOMY_CONTRACTS = {
  'GET /v1/equipment/rentals': contract('getEquipmentRentals', ref('EquipmentRentalBoard')),
  'POST /v1/equipment/rentals/offers': contract('createEquipmentRentalOffer', ref('EquipmentRentalOfferReceipt'), object({ itemId: id, rentCash: integer(1, 100000), depositCash: integer(0, 100000), durationSeconds: integer(60, 3600), offerSeconds: integer(60, 3600), published: boolean })),
  'POST /v1/equipment/rentals/offers/cancel': contract('cancelEquipmentRentalOffer', ref('EquipmentRentalCancelReceipt'), object({ offerId: id })),
  'POST /v1/equipment/rentals/accept': contract('acceptEquipmentRental', ref('EquipmentRentalAcceptReceipt'), object({ offerId: id, maxRentCash: integer(1, 100000), maxDepositCash: integer(0, 100000), consent: truth })),
  'POST /v1/equipment/rentals/end': contract('endEquipmentRental', ref('EquipmentRentalEndReceipt'), object({ leaseId: id })),
  'GET /v1/company/maintenance': contract('getOwnEquipmentMaintenance', ref('EquipmentMaintenanceOwnBoard')),
  'GET /v1/company/maintenance/offers': contract('getPublicEquipmentMaintenanceOffers', ref('EquipmentMaintenancePublicBoard')),
  'POST /v1/company/maintenance': contract('setEquipmentMaintenanceOffer', ref('EquipmentMaintenanceOfferReceipt'), object({ depotId: shortId, enabled: boolean, expectedRevision: integer(0), expiresInSeconds: integer(60, 86400), feeCash: integer(1, 1000) })),
  'POST /v1/company/maintenance/repair': contract('repairEquipment', ref('EquipmentMaintenanceRepairReceipt'), object({ expectedRevision: integer(1), itemId: shortId, offerId: shortId })),
  'GET /v1/company/negotiations': contract('getCommercialNegotiations', ref('CommercialNegotiationBoard')),
  'POST /v1/company/negotiations': contract('createCommercialNegotiation', ref('CommercialNegotiationReceipt'), object({ orderId: canonicalId, supplierCharacter: canonicalId, expiresInSeconds: integer(60, 3600), terms: negotiationTerms })),
  'POST /v1/company/negotiations/:id/act': { ...contract('actCommercialNegotiation', ref('CommercialNegotiationReceipt'), { oneOf: [
    object({ action: { const: 'counter' }, expectedRevision: integer(1, 3), terms: negotiationTerms }),
    object({ action: { enum: ['accept', 'withdraw'] }, expectedRevision: integer(1, 3), termsHash: hash })], required: ['action', 'expectedRevision'] }), pathSchemas: { id: canonicalId } },
  'POST /v1/company/negotiations/:id/expire': { ...contract('expireCommercialNegotiation', ref('CommercialNegotiationReceipt'), emptyBody), pathSchemas: { id: canonicalId } },
  'GET /v1/company/service-subscriptions': contract('getServiceSubscriptions', ref('ServiceSubscriptionBoard')),
  'POST /v1/company/service-subscriptions': contract('createServiceSubscription', ref('ServiceSubscriptionCreateReceipt'), object({ expectedOfferRevision: integer(1, 2147483647), expiresInSeconds: integer(300, 604800), feeCeiling: integer(1, 1000), intervalSeconds: integer(300, 86400), itemId: shortId, maxCycles: integer(1, 12), offerId: shortId })),
  'POST /v1/company/service-subscriptions/:id/close': { ...contract('closeServiceSubscription', ref('ServiceSubscriptionCloseReceipt'), emptyBody), pathSchemas: { id: shortId } },
  'GET /v1/company/auctions': contract('getContractAuctions', ref('ContractAuctionBoard')),
  'POST /v1/company/auctions': contract('createContractAuction', ref('ContractAuctionCreateReceipt'), object({ depotId: printableId, orderId: printableId, quantity: integer(1, 40), offersSeconds: integer(5, 3600), awardSeconds: integer(60, 3600) })),
  'POST /v1/company/auctions/bid': contract('bidContractAuction', ref('ContractAuctionBidReceipt'), object({ auctionId: printableId, quoteHash: hash, deadlineSeconds: integer(60, 21600), maxProcurementCash: integer(1, 100000), consent: truth })),
  'POST /v1/company/auctions/award': contract('awardContractAuction', ref('ContractAuctionAwardReceipt'), object({ auctionId: printableId, expectedWinningBidId: printableId })),
  'POST /v1/company/auctions/cancel': contract('cancelContractAuction', ref('ContractAuctionCancelReceipt'), object({ auctionId: printableId })),
};
