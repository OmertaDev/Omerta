const text={type:'string',pattern:'^[!-~]{1,128}$'},hash={type:'string',pattern:'^[a-f0-9]{64}$'},date={type:'string',format:'date-time'},cash={type:'integer',minimum:0,maximum:1000000},nullable=v=>({anyOf:[v,{type:'null'}]});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const quote={layawayId:text,sourceHash:hash,itemId:text,sellerOriginal:text,buyerOriginal:text,priceCash:{...cash,minimum:1},paidCash:cash,remainingPrice:cash,installmentCount:{type:'integer',minimum:0,maximum:8},status:{enum:['offered','active','completed','cancelled','expired','party_dead']},expiresAt:date};
export const CUSTOMER_LAYAWAY_SCHEMAS={CustomerLayawayResult:{oneOf:[object({ok:{const:true},...quote,status:{const:'offered'}}),object({ok:{const:true},...quote,status:{enum:['active','completed']},installmentCash:{...cash,minimum:1},reserveTransaction:text,proceedsTransaction:nullable(text)}),object({ok:{const:true},...quote,status:{enum:['cancelled','expired','party_dead']},refundedCash:cash,buyerCharacter:text,itemReturned:{type:'boolean'},refundTransaction:nullable(text)})]},CustomerLayawayBoard:object({agreements:{type:'array',maxItems:20,items:object(quote)},next:nullable(text)})};
const key={name:'Idempotency-Key',in:'header',required:true,schema:text},reference={layawayId:text,sourceHash:hash,consent:{const:true}},action=(operationId,requestSchema)=>({operationId,requestSchema,requestParameters:[key],responseSchema:{$ref:'#/components/schemas/CustomerLayawayResult'}});
export const CUSTOMER_LAYAWAY_CONTRACTS={
 'GET /v1/customer/layaway':{operationId:'customerLayawayBoard',requestParameters:[{name:'after',in:'query',required:false,schema:text}],responseSchema:{$ref:'#/components/schemas/CustomerLayawayBoard'}},
 'POST /v1/customer/layaway/offer':action('offerCustomerLayaway',object({itemId:text,buyerAccountId:text,priceCash:{...cash,minimum:1},lifetimeSeconds:{type:'integer',minimum:60,maximum:86400},consent:{const:true}})),
 'POST /v1/customer/layaway/pay':action('payCustomerLayaway',object({...reference,amountCash:{...cash,minimum:1}})),
 'POST /v1/customer/layaway/cancel':action('cancelCustomerLayaway',object(reference)),
 'POST /v1/customer/layaway/expire':action('expireCustomerLayaway',object(reference)),
};
