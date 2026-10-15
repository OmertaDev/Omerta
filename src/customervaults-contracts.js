// Component discovery proposal only; these schemas grant no execution or estate authority.
const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,required,properties});
const id={type:'string',pattern:'^[!-~]{1,128}$'},hash={type:'string',pattern:'^[a-f0-9]{64}$'},date={type:'string',format:'date-time'};
const n=(minimum,maximum)=>({type:'integer',minimum,maximum}),yes={const:true},no={const:false},nullable=x=>({anyOf:[x,{type:'null'}]}),array=(items,maxItems)=>({type:'array',items,maxItems});
const service=object({id,depotId:id,operatorCharacter:id,feeCash:n(0,1000),sourceHash:hash,state:{enum:['open','draining','closed']},expiresAt:date,principalTitle:{const:'original_customer'},fullyReserved:yes,noYield:yes});
const position={allOf:[object({id,serviceId:id,operatorCharacter:id,customerCharacter:id,principal:n(1,100000),remaining:n(0,100000),feeCash:n(0,1000),sourceHash:hash,state:{enum:['funded','withdrawn','estate_refunded']},reserveDebit:id,feeDebit:nullable(id),feeCredit:nullable(id),releaseCredit:nullable(id),createdAt:date,releasedAt:nullable(date),principalTitle:{const:'original_customer'},executionAuthority:no}),
 {oneOf:[{properties:{feeCash:{const:0},feeDebit:{type:'null'},feeCredit:{type:'null'}}},{properties:{feeCash:n(1,1000),feeDebit:id,feeCredit:id}}]},
 {oneOf:[{properties:{state:{const:'funded'},remaining:n(1,100000),releaseCredit:{type:'null'},releasedAt:{type:'null'}}},{properties:{state:{enum:['withdrawn','estate_refunded']},remaining:{const:0},releaseCredit:id,releasedAt:date}}]}]};
const serviceReceipt=object({ok:yes,service,executionAuthority:no,replayed:yes},['ok','service','executionAuthority']),positionReceipt=object({ok:yes,position,executionAuthority:no,replayed:yes},['ok','position','executionAuthority']);
export const CUSTOMER_VAULT_SCHEMAS={CustomerVaultService:service,CustomerVaultPosition:position,CustomerVaultServiceReceipt:serviceReceipt,CustomerVaultPositionReceipt:positionReceipt,
 CustomerVaultAvailability:object({available:{type:'boolean'},currency:{const:'game_cash'},custody:{const:'fully_reserved_original_customer'},requiresEstateAndCashbookIntegration:yes,cryptoAvailable:no}),
 CustomerVaultBoard:object({status:{const:'verified'},services:array(service,20),positions:array(position,20),historyTruncated:{type:'boolean'},executionAuthority:no}),
 CustomerVaultOffers:object({offers:array(service,20),executionAuthority:no})};
const key={name:'Idempotency-Key',in:'header',required:true,schema:id};
const contract=(operationId,response,requestSchema)=>({operationId,responseSchema:{$ref:'#/components/schemas/'+response},...(requestSchema?{requestSchema,requestParameters:[key]}:{})});
export const CUSTOMER_VAULT_CONTRACTS={
 'GET /v1/company/vaults/availability':contract('getCustomerVaultAvailability','CustomerVaultAvailability'),
 'GET /v1/company/vaults':contract('getCustomerVaultBoard','CustomerVaultBoard'),
 'GET /v1/company/vaults/offers':contract('getCustomerVaultOffers','CustomerVaultOffers'),
 'POST /v1/company/vaults/open':contract('openCustomerVault','CustomerVaultServiceReceipt',object({depotId:id,feeCash:n(0,1000),lifetimeSeconds:n(60,86400),consent:yes})),
 'POST /v1/company/vaults/deposit':contract('depositCustomerVault','CustomerVaultPositionReceipt',object({serviceId:id,sourceHash:hash,principal:n(1,100000),maxFeeCash:n(0,1000),consent:yes})),
 'POST /v1/company/vaults/withdraw':contract('withdrawCustomerVault','CustomerVaultPositionReceipt',object({positionId:id,sourceHash:hash,consent:yes})),
 'POST /v1/company/vaults/close':contract('closeCustomerVault','CustomerVaultServiceReceipt',object({serviceId:id,sourceHash:hash,consent:yes}))};
