const id={type:'string',minLength:1,maxLength:128,pattern:'^\\S(?:[\\s\\S]*\\S)?(?![\\s\\S])'},digest={type:'string',pattern:'^[a-f0-9]{64}$'},date={type:'string',format:'date-time'};
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties}),integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const license={licenseId:id,sourceHash:digest,licensorCharacterId:id,licenseeCharacterId:id,licensorBusinessId:id,licenseeBusinessId:{anyOf:[id,{type:'null'}]},recipeId:{const:'recipe:precision_lock_tool'},repeat:{const:1},feeCash:integer(1,10000),maximumRuns:integer(1,8),completedRuns:integer(0,8),expiresAt:date,status:{enum:['offered','accepted','cancelled','exhausted']},rights:{const:'voluntary_instruction_package_only'}};
function licensed(extra={}){return {...object({...license,...extra}),allOf:[{oneOf:Array.from({length:8},(_,i)=>({properties:{maximumRuns:{const:i+1}},oneOf:[
 {properties:{status:{const:'offered'},completedRuns:{const:0},licenseeBusinessId:{type:'null'}}},
 {properties:{status:{const:'accepted'},completedRuns:integer(0,i),licenseeBusinessId:id}},
 {properties:{status:{const:'cancelled'},completedRuns:integer(0,i)},oneOf:[{properties:{completedRuns:{const:0}}},...(i?[{properties:{completedRuns:integer(1,i),licenseeBusinessId:id}}]:[])]},
 {properties:{status:{const:'exhausted'},completedRuns:{const:i+1},licenseeBusinessId:id}},
 ]}))}]};}
const reference={licenseId:id,sourceHash:digest},receipt=licensed({ok:{const:true},status:{enum:['offered','accepted','cancelled']}}),production=object({runId:id,businessId:id,originalCharacterId:id,outputItemId:id,totalCrafts:{const:1},totalCashCost:{const:0}});
const key=[{name:'Idempotency-Key',in:'header',required:true,schema:id}];
export const MANUFACTURING_LICENSE_SCHEMAS={
 ManufacturingLicense:licensed(),ManufacturingLicenseReceipt:receipt,
 ManufacturingLicenseRunReceipt:licensed({ok:{const:true},status:{enum:['accepted','exhausted']},production,royaltyPaid:integer(1,10000)}),
 ManufacturingLicenseBoard:object({licenses:{type:'array',maxItems:20,items:licensed()},limits:object({recipeId:{const:'recipe:precision_lock_tool'},templateId:{const:'item:precision_lock_tool'},maxRuns:{const:8},maxFee:{const:10000},maxSeconds:{const:86400},maxOffered:{const:8},maxAccepted:{const:4}}),exclusiveRecipeRights:{const:false}}),
};
const post=(operationId,requestSchema,response='ManufacturingLicenseReceipt')=>({operationId,requestSchema,requestParameters:key,responseSchema:{$ref:'#/components/schemas/'+response}});
export const MANUFACTURING_LICENSE_CONTRACTS={
 'GET /v1/company/manufacturing-licenses':{operationId:'readOwnManufacturingLicenses',responseSchema:{$ref:'#/components/schemas/ManufacturingLicenseBoard'}},
 'POST /v1/company/manufacturing-licenses/publish':post('publishManufacturingInstructionLicense',object({businessId:id,productionKey:id,licenseeCharacterId:id,feeCash:integer(1,10000),maximumRuns:integer(1,8),lifetimeSeconds:integer(60,86400),consent:{const:true}})),
 'POST /v1/company/manufacturing-licenses/accept':post('acceptManufacturingInstructionLicense',object({...reference,businessId:id,consent:{const:true}})),
 'POST /v1/company/manufacturing-licenses/run':post('executeLicensedManufacturing',object(reference),'ManufacturingLicenseRunReceipt'),
 'POST /v1/company/manufacturing-licenses/cancel':post('cancelManufacturingInstructionLicense',object(reference)),
};
