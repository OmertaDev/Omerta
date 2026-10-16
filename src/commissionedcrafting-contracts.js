const text={type:'string',pattern:'^[!-~]{1,128}$'},digest={type:'string',pattern:'^[a-f0-9]{64}$'},cash={type:'integer',minimum:0},date={type:'string',format:'date-time'};
const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const input=object({templateId:{enum:['mat:hardened_steel','mat:salvage_parts']},quantity:{type:'integer',minimum:1,maximum:2},quality:{const:'standard'}});
const moved=object({...input.properties,beforeSource:cash,beforeDestination:cash,afterSource:cash,afterDestination:cash});
const quote={commissionId:text,sourceHash:digest,status:{enum:['funded','accepted','completed','refunded']},recipeId:{const:'recipe:precision_lock_tool'},feeCash:{type:'integer',minimum:1,maximum:100000},expiresAt:date};
const plain=object({ok:{const:true},...quote,status:{const:'accepted'}});const funded=object({ok:{const:true},...quote,status:{const:'funded'},reserveTransaction:text,inputs:{type:'array',minItems:2,maxItems:2,items:input}});
const complete=object({ok:{const:true},...quote,status:{const:'completed'},outputItemId:text,paidFee:cash,feeTransaction:text,production:object({originalCharacterId:text,businessId:text,recipeId:{const:'recipe:precision_lock_tool'},totalCrafts:{const:1},totalCashCost:{const:0},outputItemId:text}),transferredInputs:{type:'array',minItems:2,maxItems:2,items:input}});
const refund=object({ok:{const:true},...quote,status:{const:'refunded'},customerCharacter:text,refundedFee:cash,refundTransaction:text,returnedInputs:{type:'array',minItems:2,maxItems:2,items:input}});
export const COMMISSION_SCHEMAS={CommissionResult:{oneOf:[funded,plain,complete,refund]},CommissionBoard:object({contracts:{type:'array',maxItems:20,items:object({...quote,businessId:text,customerOriginal:text,makerOriginal:text,remainingFee:cash})},next:{anyOf:[text,{type:'null'}]}})};
const key={name:'Idempotency-Key',in:'header',required:true,schema:text},reference=object({commissionId:text,sourceHash:digest,consent:{const:true}});
const action=(operationId,requestSchema)=>({operationId,requestSchema,requestParameters:[key],responseSchema:{$ref:'#/components/schemas/CommissionResult'}});
export const COMMISSION_CONTRACTS={
 'GET /v1/company/commissions':{operationId:'commissionedCraftingBoard',requestParameters:[{name:'after',in:'query',required:false,schema:text}],responseSchema:{$ref:'#/components/schemas/CommissionBoard'}},
 'POST /v1/company/commissions/fund':action('fundCommission',object({businessId:text,feeCash:{type:'integer',minimum:1,maximum:100000},lifetimeSeconds:{type:'integer',minimum:60,maximum:86400},consent:{const:true}})),
 'POST /v1/company/commissions/accept':action('acceptCommission',reference),
 'POST /v1/company/commissions/complete':action('completeCommission',reference),
 'POST /v1/company/commissions/refund':action('refundCommission',reference),
};
