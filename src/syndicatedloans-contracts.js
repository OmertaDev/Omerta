// Component contract proposal. Authentication and these schemas do not install canonical execution capability.
const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const id={type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'},hash={type:'string',pattern:'^[a-f0-9]{64}$'},yes={const:true},no={const:false},n=(minimum,maximum)=>({type:'integer',minimum,maximum}),nullable=x=>({anyOf:[x,{type:'null'}]});
const leg=object({loanId:id,originalLender:id,currentLender:nullable(id),status:{enum:['open','active','repaid','cancelled','collected','canonical_source_removed']},principal:n(5000,500000)});
const facility=object({id,borrowerCharacter:id,lenderCharacters:{type:'array',items:id,minItems:2,maxItems:2,uniqueItems:true},principalPerLender:n(5000,500000),totalPrincipal:n(10000,1000000),rateBps:n(1,5000),termHours:n(1,72),termsHash:hash,state:{enum:['funding','funded','active','repaid','cancelled','retired']},expiresAt:{type:'string',format:'date-time'},legs:{type:'array',items:leg,maxItems:2},fullRepaymentOnly:yes,defaultRecovery:{const:'canonical_individual_legs_not_proportional'},executionAuthority:no});
export const SYNDICATED_LOAN_SCHEMAS={SyndicatedLoanAvailability:object({available:{type:'boolean'},currency:{const:'game_cash'},lenders:{const:2},fullRepaymentOnly:yes,pooledFunds:no,cryptoAvailable:no}),SyndicatedLoanFacility:facility,SyndicatedLoanBoard:object({facilities:{type:'array',items:facility,maxItems:20},historyTruncated:{type:'boolean'},currency:{const:'game_cash'},executionAuthority:no}),SyndicatedLoanReceipt:object({ok:yes,facility,executionAuthority:no,replayed:yes},['ok','facility','executionAuthority'])};
const contract=(operationId,response,requestSchema)=>({operationId,responseSchema:{$ref:'#/components/schemas/'+response},...(requestSchema?{requestSchema,requestParameters:[{in:'header',name:'Idempotency-Key',required:true,schema:id}]}:{})});
const current=object({facilityId:id,termsHash:hash,consent:yes});
export const SYNDICATED_LOAN_CONTRACTS={
  'GET /v1/company/syndicated-loans/availability':contract('syndicatedLoanAvailability','SyndicatedLoanAvailability'),
  'GET /v1/company/syndicated-loans':contract('syndicatedLoanBoard','SyndicatedLoanBoard'),
  'POST /v1/company/syndicated-loans/propose':contract('proposeSyndicatedLoan','SyndicatedLoanReceipt',object({lenderCharacters:{type:'array',items:id,minItems:2,maxItems:2,uniqueItems:true},principalPerLender:n(5000,500000),rateBps:n(1,5000),termHours:n(1,72),expiresInSeconds:n(60,3600),consent:yes})),
  'POST /v1/company/syndicated-loans/fund':contract('fundSyndicatedLoan','SyndicatedLoanReceipt',current),
  'POST /v1/company/syndicated-loans/take':contract('takeSyndicatedLoan','SyndicatedLoanReceipt',current),
  'POST /v1/company/syndicated-loans/repay':contract('repaySyndicatedLoan','SyndicatedLoanReceipt',current),
  'POST /v1/company/syndicated-loans/cancel':contract('cancelSyndicatedLoan','SyndicatedLoanReceipt',current),
};
