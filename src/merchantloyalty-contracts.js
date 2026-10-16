import { CONSIGNMENT_SCHEMAS } from './consignment-contracts.js';
const id={type:'string',pattern:'^[!-~]{1,128}$'},digest={type:'string',pattern:'^[a-f0-9]{64}$'},date={type:'string',format:'date-time'},integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const program={programId:id,programSourceHash:digest,requiredPurchases:integer(2,5),discountBps:integer(1,2000),maximumDiscountCash:integer(1,100000),maximumUses:integer(1,20),usedCount:integer(0,20),expiresAt:date,status:{enum:['active','closed']}};
const quote={quoteId:id,quoteSourceHash:digest,programId:id,consignmentId:id,grossPrice:integer(1,1000000),buyerPaid:integer(1,1000000),hostFee:integer(0,200000),sellerPaid:integer(0,1000000),discountCash:integer(1,100000),expiresAt:date,status:{enum:['quoted','consumed']}};
const loyalty=object({programId:id,programSourceHash:digest,quoteId:id,quoteSourceHash:digest,discountCash:integer(1,100000)});
const oldSale=CONSIGNMENT_SCHEMAS.ConsignmentResult.oneOf[1],sale=object({...oldSale.properties,loyalty});
export const MERCHANT_LOYALTY_SCHEMAS={MerchantLoyaltyProgram:object(program),MerchantLoyaltyQuote:object(quote),MerchantLoyaltyProgramReceipt:object({ok:{const:true},...program}),MerchantLoyaltyQuoteReceipt:object({ok:{const:true},...quote}),MerchantLoyaltyPurchaseReceipt:object({ok:{const:true},...quote,status:{const:'consumed'},sale}),MerchantLoyaltyBoard:object({programs:{type:'array',maxItems:25,items:object(program)},quotes:{type:'array',maxItems:25,items:object(quote)}})};
const create=object({requiredPurchases:integer(2,5),discountBps:integer(1,2000),maximumDiscountCash:integer(1,100000),maximumUses:integer(1,20),lifetimeSeconds:integer(60,86400),consent:{const:true}}),close=object({programId:id,programSourceHash:digest,consent:{const:true}}),quoteRequest=object({programId:id,programSourceHash:digest,consignmentId:id,sourceHash:digest,qualifyingSaleIds:{type:'array',minItems:2,maxItems:5,uniqueItems:true,items:id},consent:{const:true}}),buy=object({quoteId:id,quoteSourceHash:digest,consent:{const:true}});
const mutation=(operationId,requestSchema,response)=>({operationId,requestSchema,responseSchema:{$ref:'#/components/schemas/'+response},requestParameters:[{name:'Idempotency-Key',in:'header',required:true,schema:id}]});
export const MERCHANT_LOYALTY_CONTRACTS={
 'GET /v1/items/merchant-loyalty':{operationId:'readMerchantLoyalty',requestParameters:[{name:'sellerAccountId',in:'query',required:false,schema:id}],responseSchema:{$ref:'#/components/schemas/MerchantLoyaltyBoard'}},
 'POST /v1/items/merchant-loyalty/create':mutation('createMerchantLoyaltyProgram',create,'MerchantLoyaltyProgramReceipt'),
 'POST /v1/items/merchant-loyalty/close':mutation('closeMerchantLoyaltyProgram',close,'MerchantLoyaltyProgramReceipt'),
 'POST /v1/items/merchant-loyalty/quote':mutation('quoteRepeatPurchaseDiscount',quoteRequest,'MerchantLoyaltyQuoteReceipt'),
 'POST /v1/items/merchant-loyalty/buy':mutation('buyWithMerchantLoyalty',buy,'MerchantLoyaltyPurchaseReceipt'),
};
