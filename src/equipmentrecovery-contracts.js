const id={type:'string',minLength:1,maxLength:128},hash={type:'string',pattern:'^[a-f0-9]{64}$'};
export const EQUIPMENT_RECOVERY_INSPECTION={type:'object',additionalProperties:false,required:['businessId','itemId','originalCharacterId','remaining','maximum','revision','sourceHash','eligible'],properties:{businessId:id,itemId:id,originalCharacterId:id,remaining:{type:'integer',minimum:0,maximum:100},maximum:{const:100},revision:{type:'integer',minimum:0},sourceHash:hash,eligible:{type:'boolean'}}};
export const EQUIPMENT_RECOVERY_RECEIPT={type:'object',additionalProperties:false,required:['ok','businessId','itemId','originalCharacterId','sourceHash','recovered','destroyed'],properties:{ok:{const:true},businessId:id,itemId:id,originalCharacterId:id,sourceHash:hash,destroyed:{const:true},recovered:{type:'object',additionalProperties:false,required:['templateId','quantity','quality'],properties:{templateId:{const:'mat:salvage_parts'},quantity:{const:1},quality:{const:'standard'}}}}};
export const EQUIPMENT_RECOVERY_SCHEMAS={EquipmentRecoveryInspection:EQUIPMENT_RECOVERY_INSPECTION,EquipmentRecoveryReceipt:EQUIPMENT_RECOVERY_RECEIPT};
export const EQUIPMENT_RECOVERY_CONTRACTS={
 'GET /v1/equipment-recovery':{operationId:'inspectOwnWornEquipmentRecovery',requestParameters:[
  {name:'businessId',in:'query',required:true,schema:id},{name:'itemId',in:'query',required:true,schema:id}],
  responseSchema:{$ref:'#/components/schemas/EquipmentRecoveryInspection'}},
 'POST /v1/equipment-recovery':{operationId:'recoverOwnWornEquipment',requestParameters:[{name:'Idempotency-Key',in:'header',required:true,schema:id}],
  requestSchema:{type:'object',additionalProperties:false,required:['businessId','itemId','originalCharacterId','sourceHash','consent'],properties:{businessId:id,itemId:id,originalCharacterId:id,sourceHash:hash,consent:{const:true}}},
  responseSchema:{$ref:'#/components/schemas/EquipmentRecoveryReceipt'}},
};
