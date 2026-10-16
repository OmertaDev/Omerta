const text={type:'string',minLength:1,maxLength:128};
const integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const job={jobId:text,tenantCharacter:text,providerCharacter:text,leaseId:text,quantity:integer(1,10),feeCash:integer(1,1000),sourceHash:{type:'string',pattern:'^[a-f0-9]{64}$'},good:{const:'gin'},expiresAt:{type:'string',format:'date-time'}};
const boardJob=object({...job,state:{enum:['requested','accepted','fulfilled','cancelled','party_dead']}});
export const PICKING_PACKING_SCHEMAS={PickingPackingBoard:object({jobs:{type:'array',maxItems:50,items:boardJob}}),PickingPackingResult:{oneOf:[
 object({...job,state:{const:'requested'},expiresInSeconds:integer(60,3600)}),
 object({...job,state:{enum:['accepted','cancelled','party_dead']}}),
 object({...job,state:{const:'fulfilled'},warehouseJournal:text,debit:text,credit:text,heldBefore:integer(1,10),heldAfter:integer(0,10),cargoBefore:integer(0,1000000000),cargoAfter:integer(1,1000000000)})]}};
const key={name:'Idempotency-Key',in:'header',required:true,schema:text};
const action=(operationId,requestSchema)=>({operationId,requestSchema,requestParameters:[key],responseSchema:{$ref:'#/components/schemas/PickingPackingResult'}});
export const PICKING_PACKING_CONTRACTS={
 'GET /v1/company/picking-packing':{operationId:'getPickingPacking',requestParameters:[],responseSchema:{$ref:'#/components/schemas/PickingPackingBoard'}},
 'POST /v1/company/picking-packing/create':action('createPickingPacking',object({leaseId:text,quantity:integer(1,10),feeCash:integer(1,1000),expiresInSeconds:integer(60,3600),consent:{const:true}})),
 'POST /v1/company/picking-packing/accept':action('acceptPickingPacking',object({jobId:text,consent:{const:true}})),
 'POST /v1/company/picking-packing/fulfill':action('fulfillPickingPacking',object({jobId:text})),
 'POST /v1/company/picking-packing/cancel':action('cancelPickingPacking',object({jobId:text})),
};
