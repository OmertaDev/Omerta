const id={type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'},hash={type:'string',pattern:'^[a-f0-9]{64}$'},yes={const:true};
const n=(min,max)=>({type:'integer',minimum:min,maximum:max}),object=p=>({type:'object',additionalProperties:false,required:Object.keys(p),properties:p});
export const PERFORMANCE_EMPLOYMENT_SCHEMAS={
 PerformanceEmploymentFund:object({ok:yes,employmentId:id,sourceHash:hash,minimumUnits:n(1,40),bonusCash:n(1,10000),reservedBonusCash:n(1,50000),expiresAt:{type:'string',format:'date-time'},wagesUnchanged:yes}),
 PerformanceEmploymentBoard:object({contracts:{type:'array',maxItems:30,items:object({employmentId:id,sourceHash:hash,minimumUnits:n(1,40),bonusCash:n(1,10000),maximumBonusCash:n(1,50000),reservedBonusCash:n(0,50000),paidBonusCash:n(0,50000),refundedBonusCash:n(0,50000),state:{enum:['open','closed']},expiresAt:{type:'string',format:'date-time'}})},fundedGameCashOnly:yes,wagesUnchanged:yes})
};
export const PERFORMANCE_EMPLOYMENT_CONTRACTS={
 'GET /v1/company/performance-employment':{operationId:'performanceEmploymentBoard',responseSchema:{$ref:'#/components/schemas/PerformanceEmploymentBoard'}},
 'POST /v1/company/performance-employment':{operationId:'fundPerformanceEmployment',responseSchema:{$ref:'#/components/schemas/PerformanceEmploymentFund'},requestSchema:object({employmentId:id,minimumUnits:n(1,40),bonusCash:n(1,10000),consent:yes}),requestParameters:[{name:'Idempotency-Key',in:'header',required:true,schema:id}]}
};
