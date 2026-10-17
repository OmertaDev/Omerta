const identity={type:'string',minLength:1,maxLength:128};
const shop={type:'object',additionalProperties:false,required:['shopId','sellerCharacterId','listingId','district','good','initialQuantity','remainingQuantity','unitPrice','sourceHash','expiresAt','status'],properties:{shopId:identity,sellerCharacterId:identity,listingId:identity,district:identity,good:{const:'gin'},initialQuantity:{type:'integer',minimum:1,maximum:10},remainingQuantity:{type:'integer',minimum:0,maximum:10},unitPrice:{type:'integer',minimum:1,maximum:1000000},sourceHash:{type:'string',pattern:'^[a-f0-9]{64}$'},expiresAt:{type:'string',format:'date-time'},status:{enum:['active','cancelled','sold','estate_scattered']}}};
export const MOBILE_SHOP_BOARD={type:'object',additionalProperties:false,required:['shops','next'],properties:{shops:{type:'array',maxItems:20,items:{...shop,required:[...shop.required,'available'],properties:{...shop.properties,available:{type:'boolean'}}}},next:{anyOf:[identity,{type:'null'}]}}};
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const result=(action,extra)=>object({ok:{const:true},action:{const:action},shop,...extra});
export const MOBILE_SHOP_RECEIPT={oneOf:[result('open',{listingFee:{type:'integer',minimum:0}}),result('buy',{quantity:{type:'integer',minimum:1,maximum:10},paid:{type:'integer',minimum:1,maximum:1000000}}),result('close',{returnedQuantity:{type:'integer',minimum:0,maximum:10}}),result('expire',{returnedQuantity:{type:'integer',minimum:0,maximum:10}})]};
export const MOBILE_SHOP_SCHEMAS=Object.freeze({MobileShopBoard:MOBILE_SHOP_BOARD,MobileShopResult:MOBILE_SHOP_RECEIPT});
const key={name:'Idempotency-Key',in:'header',required:true,schema:identity};
const reference={shopId:identity,sourceHash:{type:'string',pattern:'^[a-f0-9]{64}$'},consent:{const:true}};
const action=(operationId,body)=>({operationId,requestSchema:object(body),requestParameters:[key],responseSchema:{$ref:'#/components/schemas/MobileShopResult'}});
export const MOBILE_SHOP_CONTRACTS=Object.freeze({
  'GET /v1/mobile-shops':{operationId:'mobileShopBoard',responseSchema:{$ref:'#/components/schemas/MobileShopBoard'},requestParameters:[{name:'after',in:'query',required:false,schema:{type:'string',maxLength:128}}]},
  'POST /v1/mobile-shops/open':action('openMobileShop',{quantity:{type:'integer',minimum:1,maximum:10},unitPrice:{type:'integer',minimum:1,maximum:1000000},lifetimeSeconds:{type:'integer',minimum:60,maximum:3600},consent:{const:true}}),
  'POST /v1/mobile-shops/buy':action('buyMobileShop',{...reference,quantity:{type:'integer',minimum:1,maximum:10}}),
  'POST /v1/mobile-shops/close':action('closeMobileShop',reference),
  'POST /v1/mobile-shops/expire':action('expireMobileShop',reference),
});
