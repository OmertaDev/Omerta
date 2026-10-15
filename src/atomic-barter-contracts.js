const text={type:'string',minLength:1,maxLength:128};
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const offer={offerId:text,makerCharacter:text,takerCharacter:text,offeredItemId:text,requestedItemId:text,
 expiresAt:{type:'string',format:'date-time'}};
const result={oneOf:[object({...offer,state:{enum:['offered','cancelled','expired','party_dead']}}),
 object({...offer,state:{const:'completed'},items:{type:'array',minItems:2,maxItems:2,items:object({itemId:text,
 templateId:{const:'item:precision_lock_tool'},ownerCharacter:text})}})]};
export const ATOMIC_BARTER_SCHEMAS={AtomicBarterResult:result,AtomicBarterBoard:object({offers:{type:'array',maxItems:50,
 items:object({...offer,state:{enum:['offered','completed','cancelled','expired','party_dead']}})}})};
const key={name:'Idempotency-Key',in:'header',required:true,schema:text};
const action=(operationId,requestSchema)=>({operationId,requestSchema,requestParameters:[key],responseSchema:{$ref:'#/components/schemas/AtomicBarterResult'}});
export const ATOMIC_BARTER_CONTRACTS={
 'GET /v1/items/barter':{operationId:'getAtomicBarter',requestParameters:[],responseSchema:{$ref:'#/components/schemas/AtomicBarterBoard'}},
 'POST /v1/items/barter/create':action('createAtomicBarter',object({counterpartyCharacter:text,offeredItemId:text,requestedItemId:text,expiresInSeconds:{type:'integer',minimum:60,maximum:3600}})),
 'POST /v1/items/barter/accept':action('acceptAtomicBarter',object({offerId:text,consent:{const:true}})),
 'POST /v1/items/barter/cancel':action('cancelAtomicBarter',object({offerId:text})),
};
