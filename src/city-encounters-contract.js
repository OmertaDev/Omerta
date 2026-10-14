const object=(properties,required=Object.keys(properties))=>({type:'object',additionalProperties:false,required,properties});
const text={type:'string',maxLength:1000},id={type:'string',minLength:1,maxLength:200};
const integer={type:'integer',minimum:0},positive={type:'integer',minimum:1};
const ref=name=>({$ref:'#/components/schemas/'+name});
const viewer={characterId:id,generation:positive,district:id};
export const CITY_ENCOUNTER_BODIES=Object.freeze({
  start:object({...viewer,scenarioId:{type:'string',enum:['docks-patrol','neon-patrol','foundry-patrol','brick-patrol','canal-patrol','cathedral-patrol',
    'docks-mastery-v1','neon-mastery-v1','foundry-mastery-v1','brick-mastery-v1','canal-mastery-v1','cathedral-mastery-v1']}}),
  turn:object({...viewer,expectedRevision:positive,move:{type:'string',enum:['strike','guard','feint','negotiate','retreat']}}),
});
export const CITY_ENCOUNTER_SCHEMAS=Object.freeze({
  CityEncounterViewer:object(viewer),
  CityEncounterAction:object({id,label:text,method:{const:'POST'},path:{type:'string',pattern:'^/v1/city/encounters/(start|[^/]+/turn)$'},
    body:{oneOf:[CITY_ENCOUNTER_BODIES.start,CITY_ENCOUNTER_BODIES.turn]},available:{type:'boolean'},
    blockedBy:{type:'array',maxItems:2,items:object({code:id})}}),
  CityEncounter:object({id,scenarioId:id,name:text,district:id,revision:positive,
    status:{type:'string',enum:['active','won','truce','lost','retreated','stalemate']},turn:{...integer,maximum:12},roundLimit:{const:12},
    health:integer,maxHealth:positive,stamina:{...integer,maximum:10},enemyHealth:integer,enemyMaxHealth:positive,
    intent:{anyOf:[{type:'string',enum:['strike','brace','pressure']},{type:'null'}]},last:text,
    clue:{anyOf:[text,{type:'null'}]},actions:{type:'array',maxItems:5,items:ref('CityEncounterAction')},
    mastery:object({challenge:text,achieved:{type:'boolean'}})},
    ['id','scenarioId','name','district','revision','status','turn','roundLimit','health','maxHealth','stamina','enemyHealth','enemyMaxHealth','intent','last','clue','actions']),
  CityEncounterBoard:object({viewer:ref('CityEncounterViewer'),mode:{const:'district-drill'},description:text,
    scenarios:{type:'array',maxItems:2,items:object({id,district:id,name:text,description:text,action:ref('CityEncounterAction'),challenge:text},['id','district','name','description','action'])},
    active:{anyOf:[ref('CityEncounter'),{type:'null'}]},history:{type:'array',maxItems:16,items:ref('CityEncounter')},
    clues:{type:'array',maxItems:12,items:object({scenarioId:id,title:text,text})}}),
  CityEncounterAck:object({ok:{const:true},viewer:ref('CityEncounterViewer'),encounter:ref('CityEncounter'),message:text}),
});
export const CITY_ENCOUNTER_CONTRACTS=Object.freeze({
  'GET /v1/city/encounters':{operationId:'readCityEncounters',responseSchema:ref('CityEncounterBoard')},
  'POST /v1/city/encounters/start':{operationId:'startCityEncounter',requestSchema:CITY_ENCOUNTER_BODIES.start,responseSchema:ref('CityEncounterAck'),
    requestParameters:[{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:1,maxLength:128}}]},
  'POST /v1/city/encounters/:id/turn':{operationId:'takeCityEncounterTurn',requestSchema:CITY_ENCOUNTER_BODIES.turn,responseSchema:ref('CityEncounterAck'),
    requestParameters:[{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:1,maxLength:128}}]},
});
