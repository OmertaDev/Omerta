const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const id={type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'},hash={type:'string',pattern:'^[a-f0-9]{64}$'},integer=(minimum,maximum)=>({type:'integer',minimum,maximum}),yes={const:true},no={const:false},date={type:'string',format:'date-time'};
const event=object({eventId:id,sourceHash:hash,district:id,shopId:id,campaigns:{type:'array',minItems:1,maxItems:3,items:object({campaignId:id,sourceHash:hash})},vendorCharacter:id,rewardCash:integer(1,100000),slots:integer(1,3),state:{enum:['offered','active','suspended','closed','expired','party_dead']},expiresAt:date});
const participant=object({participationId:id,sourceHash:hash,eventId:id,state:{enum:['joined','visited','completed','left','expired','party_dead']},rewardCash:integer(0,100000),ginPaid:integer(0,1000000),uidPaid:integer(0,1000000)});
export const EVENT_MARKET_SCHEMAS={EventMarketAvailability:object({available:{type:'boolean'},currency:{const:'game_cash'},vendorLimit:{const:1},participantLimit:{const:3},requiresNativeTransactions:yes,venueConsentRequired:yes,vendorActiveLimit:{const:1},pickupActiveLimit:{const:1},cryptoAvailable:no}),EventMarket:event,EventMarketParticipant:participant,EventMarketBoard:object({events:{type:'array',items:event,maxItems:20},participants:{type:'array',items:participant,maxItems:20},historyTruncated:{type:'boolean'},executionAuthority:no}),EventMarketReceipt:object({ok:yes,event,participant,refundedCash:integer(0,300000),replayed:yes,executionAuthority:no},['ok','event','executionAuthority'])};
const ref=object({eventId:id,sourceHash:hash,consent:yes}),part=object({participationId:id,sourceHash:hash,consent:yes}),key={in:'header',name:'Idempotency-Key',required:true,schema:id},contract=(operationId,response,requestSchema)=>({operationId,responseSchema:{$ref:'#/components/schemas/'+response},...(requestSchema?{requestSchema,requestParameters:[key]}:{})});
export const EVENT_MARKET_CONTRACTS={
 'GET /v1/events/markets/availability':contract('eventMarketAvailability','EventMarketAvailability'),
 'GET /v1/events/markets':contract('eventMarketBoard','EventMarketBoard'),
 'POST /v1/events/markets/fund':contract('fundEventMarket','EventMarketReceipt',object({shopId:id,shopHash:hash,campaigns:{type:'array',minItems:1,maxItems:3,items:object({campaignId:id,sourceHash:hash})},rewardCash:integer(1,100000),lifetimeSeconds:integer(60,3600),consent:yes})),
 'POST /v1/events/markets/enroll':contract('enrollEventMarketVendor','EventMarketReceipt',ref),
 'POST /v1/events/markets/venue':contract('consentEventMarketVenue','EventMarketReceipt',ref),
 'POST /v1/events/markets/withdraw':contract('withdrawEventMarketProvider','EventMarketReceipt',ref),
 'POST /v1/events/markets/join':contract('joinEventMarket','EventMarketReceipt',object({eventId:id,sourceHash:hash,attributionId:id,attributionHash:hash,consent:yes})),
 'POST /v1/events/markets/leave':contract('leaveEventMarket','EventMarketReceipt',part),
 'POST /v1/events/markets/visit':contract('visitEventMarket','EventMarketReceipt',part),
 'POST /v1/events/markets/finish':contract('finishEventMarket','EventMarketReceipt',part),
 'POST /v1/events/markets/cancel':contract('cancelEventMarket','EventMarketReceipt',ref),
 'POST /v1/events/markets/expire':contract('expireEventMarket','EventMarketReceipt',ref),
};
