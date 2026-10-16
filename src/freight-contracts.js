const id={type:'string',pattern:'^[A-Za-z0-9_-]{1,128}$'},digest={type:'string',pattern:'^[a-f0-9]{64}$'},date={type:'string',format:'date-time'},bool={type:'boolean'};
const integer=(minimum=0,maximum=Number.MAX_SAFE_INTEGER)=>({type:'integer',minimum,maximum});
const object=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const array=(items,minItems,maxItems)=>({type:'array',items,minItems,maxItems});
const entry=object({commitmentId:id,orderId:id,depotId:id,buyerCharacter:id,quantity:integer(1,8),allocatedTravelCash:integer(),unitPrice:integer(),takeBps:integer(0,10000),spendLimit:integer(),spent:integer(),deadline:date,orderExpiry:date});
const travel=object({ok:{const:true},loc:id,cost:integer(),chargedCommitmentId:id});
const fill=object({ok:{const:true},delivered:integer(1,8),earned:integer(),gross:integer(),take:integer(),remaining:integer(),good:{const:'gin'}});
const handoff=object({orderId:id,commitmentId:id,quantity:integer(1,8),receipt:fill});
const completed={ok:{const:true},batchId:id,manifestHash:digest,revision:integer(1),state:{const:'completed'},travel,handoffs:array(handoff,2,2),totalDelivered:integer(2,8),earned:integer()};
const optionalReplay={character:{type:['object','null'],description:'Unchanged canonical authenticated self G projection; not freight authority.'},replayed:{const:true},historicalAcknowledgement:{const:true}};
const result=(fields)=>object({...fields,...optionalReplay},Object.keys(fields));
const base={ok:{const:true},batchId:id,manifestHash:digest,revision:integer(1)};
const create=result({...base,state:{const:'proposed'},expiresAt:date,quantity:integer(2,8),travelCost:integer()});
const accept=result({...base,state:{enum:['proposed','ready']}});
const cancel=result({ok:{const:true},batchId:id,state:{const:'cancelled'},revision:integer(1),releasedCash:{const:0},releasedGoods:{const:0},canonicalObligationsUnchanged:{const:true}});
const limits=object({orders:{const:2},maxUnits:{const:8},maxSeconds:{const:600},maxSupplierBatches:{const:1},maxBuyerBatches:{const:3},financing:{const:'unsupported'},newEscrow:{const:false}});
export const FREIGHT_SCHEMAS={FreightResult:{oneOf:[create,accept,result(completed),cancel]},FreightBoard:object({batches:array(object({id,state:{enum:['proposed','ready','completed','cancelled','retired']},revision:integer(1),manifestHash:digest,expiresAt:date,role:{enum:['supplier','buyer']},orderCount:{const:2},quantity:integer(2,8),origin:id,destination:id,travelCost:integer(),expired:bool,entries:array(entry,1,2),receipt:{anyOf:[object(completed),{type:'null'}]}}),0,20),limits})};
const key={name:'Idempotency-Key',in:'header',required:true,schema:id},path={name:'id',in:'path',required:true,schema:id};
const action=(operationId,requestSchema,withPath=true)=>({operationId,requestSchema,requestParameters:withPath?[key,path]:[key],responseSchema:{$ref:'#/components/schemas/FreightResult'}});
const reference={expectedRevision:integer(1),manifestHash:digest};
export const FREIGHT_CONTRACTS={
 'GET /v1/company/freight':{operationId:'freightConsolidationBoard',responseSchema:{$ref:'#/components/schemas/FreightBoard'}},
 'POST /v1/company/freight':action('createFreightConsolidation',object({commitmentIds:{...array(id,2,2),uniqueItems:true},consent:{const:true},expiresInSeconds:integer(60,600)}),false),
 'POST /v1/company/freight/:id/accept':action('acceptFreightConsolidation',object({...reference,consent:{const:true}})),
 'POST /v1/company/freight/:id/run':action('runFreightConsolidation',object(reference)),
 'POST /v1/company/freight/:id/cancel':action('cancelFreightConsolidation',object(reference)),
};
