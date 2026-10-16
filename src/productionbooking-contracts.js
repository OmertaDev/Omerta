export const PRODUCTION_BOOKING = Object.freeze({ recipeId: 'recipe:precision_lock_tool', quantity: 1,
  maximumCash: 1000, maximumSeconds: 1200, offerSeconds: 300, maximumActivePerOriginal: 1,
  minimumCondition: 80, members: 2, resource: 'actual_quality_tool_and_workshop_next_run' });

export const productionBookingDDL = `
CREATE TABLE IF NOT EXISTS production_booking_offers (
 id TEXT PRIMARY KEY, maker_account TEXT NOT NULL REFERENCES accounts(id), maker_character TEXT NOT NULL REFERENCES characters(id),
 customer_account TEXT NOT NULL REFERENCES accounts(id), customer_character TEXT NOT NULL REFERENCES characters(id),
 business_id TEXT NOT NULL REFERENCES business_depots(id), tool_item TEXT NOT NULL REFERENCES item_instances(id),
 source_json JSONB NOT NULL, source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), created_at TIMESTAMPTZ NOT NULL,
 offer_expires_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 fee_cash INT NOT NULL CHECK(fee_cash BETWEEN 1 AND 1000), bonus_cash INT NOT NULL CHECK(bonus_cash BETWEEN 1 AND 1000),
 lifetime_seconds INT NOT NULL CHECK(lifetime_seconds BETWEEN 60 AND 1200),
 state TEXT NOT NULL CHECK(state IN ('offered','accepted','cancelled','expired')), closed_at TIMESTAMPTZ,
 CHECK(maker_account<>customer_account AND maker_character<>customer_character));
CREATE UNIQUE INDEX IF NOT EXISTS production_booking_one_offer ON production_booking_offers(maker_character) WHERE state='offered';
CREATE TABLE IF NOT EXISTS production_booking_runs (
 id TEXT PRIMARY KEY REFERENCES production_booking_offers(id), business_id TEXT NOT NULL REFERENCES business_depots(id),
 maker_account TEXT NOT NULL REFERENCES accounts(id), maker_character TEXT NOT NULL REFERENCES characters(id),
 customer_account TEXT NOT NULL REFERENCES accounts(id), customer_character TEXT NOT NULL REFERENCES characters(id),
 tool_item TEXT NOT NULL REFERENCES item_instances(id),
 commission_id TEXT NOT NULL UNIQUE REFERENCES commissioned_crafting_contracts(id),
 commission_source_hash TEXT NOT NULL CHECK(char_length(commission_source_hash)=64),
 reservation_id TEXT NOT NULL UNIQUE REFERENCES production_slot_reservations(id), reservation_source_hash TEXT NOT NULL CHECK(char_length(reservation_source_hash)=64),
 state TEXT NOT NULL CHECK(state IN ('active','completed','refunded')),
 bonus_cash INT NOT NULL CHECK(bonus_cash BETWEEN 1 AND 1000), remaining_cash INT NOT NULL CHECK(remaining_cash BETWEEN 0 AND 1000),
 paid_cash INT NOT NULL DEFAULT 0 CHECK(paid_cash BETWEEN 0 AND 1000), refunded_cash INT NOT NULL DEFAULT 0 CHECK(refunded_cash BETWEEN 0 AND 1000),
 reserve_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id), release_transaction TEXT UNIQUE REFERENCES transactions(id),
 accepted_at TIMESTAMPTZ NOT NULL, deadline TIMESTAMPTZ NOT NULL, closed_at TIMESTAMPTZ, outcome JSONB,
 CHECK(bonus_cash=remaining_cash+paid_cash+refunded_cash),
 CHECK((state='active' AND remaining_cash=bonus_cash AND release_transaction IS NULL AND closed_at IS NULL AND outcome IS NULL) OR
       (state<>'active' AND remaining_cash=0 AND release_transaction IS NOT NULL AND closed_at IS NOT NULL AND outcome IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS production_booking_one_business ON production_booking_runs(business_id) WHERE state='active';
CREATE UNIQUE INDEX IF NOT EXISTS production_booking_one_tool ON production_booking_runs(tool_item) WHERE state='active';
CREATE TABLE IF NOT EXISTS production_booking_positions (
 booking_id TEXT NOT NULL REFERENCES production_booking_runs(id), original_account TEXT NOT NULL REFERENCES accounts(id),
 original_character TEXT NOT NULL REFERENCES characters(id), role TEXT NOT NULL CHECK(role IN ('maker','customer')),
 state TEXT NOT NULL CHECK(state IN ('held','released')), PRIMARY KEY(booking_id,original_character), UNIQUE(booking_id,role));
CREATE UNIQUE INDEX IF NOT EXISTS production_booking_one_original ON production_booking_positions(original_character) WHERE state='held';
CREATE TABLE IF NOT EXISTS production_booking_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL, action TEXT NOT NULL CHECK(action IN ('offer','accept','complete','cancel','expire')),
 identity JSONB NOT NULL, request_hash TEXT NOT NULL CHECK(char_length(request_hash)=64), receipt JSONB NOT NULL,
 PRIMARY KEY(account_id,request_key));`;

const id = { type: 'string', pattern: '^[A-Za-z0-9_-]{1,128}$' }, hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const n = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const ref = { bookingId: id, sourceHash: hash, consent: { const: true } };
const date={type:'string',format:'date-time'},cash=n(0,1000);
const offerView=object({bookingId:id,sourceHash:hash,state:{enum:['offered','accepted','cancelled','expired']},businessId:id,makerCharacterId:id,customerCharacterId:id,
  toolItemId:id,feeCash:n(1,1000),bonusCash:n(1,1000),profileRevision:n(1,2147483647),floorRevision:n(1,2147483647),toolCondition:n(80,150),toolRevision:n(0,2147483647),
  offerExpiresAt:date,expiresAt:date,resourcesHeld:{const:false},recipeId:{const:PRODUCTION_BOOKING.recipeId},quantity:{const:1}});
const bookingView=object({bookingId:id,state:{enum:['active','completed','refunded']},businessId:id,commissionId:id,reservationId:id,toolItemId:id,
  bonusCash:n(1,1000),reservedBonusCash:cash,paidBonusCash:cash,refundedBonusCash:cash,acceptedAt:date,deadline:date,closedAt:{type:['string','null'],format:'date-time'},resourcesHeld:{type:'boolean'}});
const receipt=properties=>({...object(properties),properties:{...properties,replayed:{const:true}}});
export const PRODUCTION_BOOKING_SCHEMAS = Object.freeze({
  ProductionBookingOfferBody: object({ businessId: id, customerCharacterId: id, feeCash: n(1,1000), bonusCash: n(1,1000), lifetimeSeconds: n(60,1200), consent: { const: true } }),
  ProductionBookingAcceptBody: object({ ...ref, feeCash: n(1,1000), bonusCash: n(1,1000) }),
  ProductionBookingReferenceBody: object(ref),
  ProductionBookingOffer:offerView,ProductionBooking:bookingView,
  ProductionBookingOfferResult:receipt({offer:offerView}),
  ProductionBookingAcceptResult:receipt({offer:offerView,booking:bookingView}),
  ProductionBookingCompleteResult:receipt({booking:bookingView,outputItemId:id,paidFee:n(1,1000),paidBonusCash:n(1,1000)}),
  ProductionBookingEndResult:{oneOf:[receipt({offer:offerView,refundedBonusCash:{const:0}}),receipt({booking:bookingView,refundedBonusCash:n(1,1000)})]},
  ProductionBookingBoard:object({offers:{type:'array',maxItems:50,items:offerView},bookings:{type:'array',maxItems:50,items:bookingView},recipeId:{const:PRODUCTION_BOOKING.recipeId},quantity:{const:1}}),
});
export const PRODUCTION_BOOKING_CONTRACTS={'GET /v1/company/production-bookings':{operationId:'productionBookingBoard',description:'Own original-party production bookings. First admission requires an existing owned estate with a real quality tool bench and service slot.',responseSchema:{$ref:'#/components/schemas/ProductionBookingBoard'}}};
for(const action of ['offer','accept','complete','cancel','expire']){
  const body=action==='offer'?'ProductionBookingOfferBody':action==='accept'?'ProductionBookingAcceptBody':'ProductionBookingReferenceBody';
  const result=action==='offer'?'Offer':action==='accept'?'Accept':action==='complete'?'Complete':'End';
  PRODUCTION_BOOKING_CONTRACTS['POST /v1/company/production-bookings/'+action]={operationId:'productionBooking'+action[0].toUpperCase()+action.slice(1),requestParameters:[{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:1,maxLength:200}}],requestSchema:{$ref:'#/components/schemas/'+body},responseSchema:{$ref:'#/components/schemas/ProductionBooking'+result+'Result'}};
}
