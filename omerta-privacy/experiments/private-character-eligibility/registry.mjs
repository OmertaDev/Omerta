// A NEW typed-root schema. Frozen opaque roots are never reinterpreted by it.
import {keccak256,toHex} from 'viem';
import {SOURCE_CATALOG} from './schema-catalog.mjs';

export const VERSION=1;
export const FIELD=21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const TAG=Object.freeze({program:2033000n,registry:2033001n,value:2033002n,scalarLeaf:2033003n,
 relationRow:2033004n,relationRoot:2033005n,selectedRoot:2033006n,padding:2033007n});
export const TYPE=Object.freeze({BOOLEAN:1,INT:2,BIGINT:3,NUMERIC:4,TEXT:5,TIMESTAMPTZ:6,RELATION:7});
export const ROOT_KIND=Object.freeze({lifeStateRoot:1,progressionRoot:2});
export const ROOT_CAPACITY=32;
export const RELATION_MAX_ROWS=65536;
export const MAX_TEXT_BYTES=1048576;
export const PG_TIMESTAMP=Object.freeze({epoch:'2000-01-01T00:00:00Z',unit:'microseconds',encoding:'signed-int64 network-order8bytes',
 minimumFinite:'-211813488000000000',endFiniteExclusive:'9223371331200000000',negativeInfinity:'-9223372036854775808',positiveInfinity:'9223372036854775807',
 source:'https://github.com/postgres/postgres/blob/REL_18_0/src/include/datatype/timestamp.h'});
export const SOURCE_DATE_PROJECTION=Object.freeze({version:1,profile:'SOURCE_PG8_ISO_ORDINARY_YEAR_UNIX_MS',
 minimumUtcInclusive:'0100-01-02T00:00:00.000Z',endUtcExclusive:'9999-12-30T00:00:00.000Z',
 minimumUnixMillis:'-59011372800000',endUnixMillisExclusive:'253402128000000',
 minimumPgMicros:'-59958057600000000',endPgMicrosExclusive:'252455443200000000',
 precondition:'Pinned source pg8 ISO text date parser/session output; not a universal raw-instant/source-Date equivalence proof',
 unsupported:'Outside range, infinities or unresolved source session/parser admission must halt projection/import; preserve raw value, never truncate/default'});

// Every physical characters column has exactly one primary home. Header/book
// representations listed below are qualified aliases, not independent values.
const homes={
 lifeStateRoot:'id account_id name generation alive energy nerve health loc title heat season minted honor bank_intransit_at is_npc last_accrued_at created_at lfg lfg_at seeking_mentor seeking_mentor_at bio forged',
 progressionRoot:'respect muscle cunning speed streak checkin_day lc_crime trade_rep busts season_kills refill_used refill_at duel_elo duel_style path path_at aha_stage aha_rival aha_rival_name',
 lifeBooksRoot:'cash bank bank_intransit bank_credit_ms racket_credit_ms crew_sale_credit_ms',
 lifeInventoryRoot:'ammo cb gun vest contraband heist_loot shipment',
 worldRefsRoot:'lab lab_purity lab_yield lab_stealth crew guard_price guarded_by guarded_until fade_limit poker_limit duel_limit berths',
 accrualContextRoot:'crew_paid_at npc_seed',
 lawCooldownRoot:'jail_until hosp_until gta_at shoot_cd_until heist_at npchit_at safe_until wash_used wash_at safehouse_used safehouse_at bust_used bust_at rwa_used rwa_at respec_at heat_exposure indicted_at retainer_until jury_bought witpro_until world_raid_at pen_safe_until hole_until pen_faction shank_at train_at mission_at street_action_at welsher wanted_until envelope_until wire_until wire_tier disinfo_until active_at race_at port_used port_at duel_at clue_at family_raid_at statuse_used statuse_at car_stolen_at trunk_robbed_at sabotaged_at paper_at',
};
const ownership=new Map();
for(const[home,names]of Object.entries(homes))for(const name of names.split(' ')){
 if(ownership.has(name))throw new Error('Duplicate primary field '+name);ownership.set(name,home);
}
if(ownership.size!==118||SOURCE_CATALOG.characters.columns.length!==118)throw new Error('Review source field addition/removal');
export const PARTITION=Object.freeze(SOURCE_CATALOG.characters.columns.map((column,index)=>{
 const home=ownership.get(column.name);if(!home||!TYPE[column.sqlType])throw new Error('Unassigned source field '+column.name);
 return Object.freeze({id:index+1,table:'characters',name:column.name,sqlType:column.sqlType,type:TYPE[column.sqlType],nullable:column.nullable,
  home,persistedByWrapper:SOURCE_CATALOG.persisted.includes(column.name),primaryRepresentation:column.sqlType==='TIMESTAMPTZ'?'PG2000_US_I64':column.sqlType==='NUMERIC'?'SIGNED_C256_SCALE512':column.sqlType==='TEXT'?'EXACT_UTF8':column.sqlType==='BOOLEAN'?'BOOL':column.sqlType==='BIGINT'?'SIGNED_I64':'SIGNED_I32'});
}));
for(const name of ownership.keys())if(!PARTITION.some(p=>p.name===name))throw new Error('Unknown registry field '+name);
export const RELATIONS=Object.freeze(SOURCE_CATALOG.relations.map((relation,index)=>Object.freeze({
 id:1001+index,kind:TYPE.RELATION,name:relation.name,home:'progressionRoot',primaryKey:[...relation.primaryKey],
 columns:relation.columns.map((column,position)=>Object.freeze({...column,id:(1001+index)*100+position+1,type:TYPE[column.sqlType]})),
 maxRows:RELATION_MAX_ROWS,ordering:'lexicographic canonical encoded complete primary-key tuple',
 foreignKey:'character_id must equal the SAME source characters.id; row hash includes its complete typed value commitment',
})));
export const SELECTED=Object.freeze(Object.fromEntries(Object.keys(ROOT_KIND).map(home=>{
 const scalars=PARTITION.filter(f=>f.home===home);
 const fields=[...scalars,...RELATIONS.filter(r=>r.home===home).map(r=>({id:r.id,table:r.name,name:r.name,sqlType:'RELATION',type:TYPE.RELATION,nullable:false,home,relation:r.name}))];
 if(fields.length>ROOT_CAPACITY)throw new Error('Root capacity exceeded');
 return[home,Object.freeze(fields.map((f,index)=>Object.freeze({...f,index})))];
})));
if(SELECTED.lifeStateRoot.length!==24||SELECTED.progressionRoot.length!==26)throw new Error('Unexpected selected root layout');

const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
export const PROJECTIONS=deepFreeze([
 {source:'characters.id',primaryHome:'lifeStateRoot',alias:'header.lifeScope',relation:'source-admission identity/scoping attestation',constraintStatus:'UNRESOLVED_SOURCE_ADMISSION',preimageRetained:true},
 {source:'characters.account_id',primaryHome:'lifeStateRoot',alias:'header.accountScope',relation:'source-admission identity/scoping attestation',constraintStatus:'UNRESOLVED_SOURCE_ADMISSION',preimageRetained:true},
 {source:'characters.generation',primaryHome:'lifeStateRoot',alias:'header.lifeGeneration',relation:'exact signed I32 equals enrolled nonnegative U64; unsupported negative source generation is retained but cannot satisfy this header relation',constraintStatus:'HOST_CHECK_ONLY'},
 ...['energy','nerve','health','heat'].map(name=>({source:'characters.'+name,primaryHome:'lifeStateRoot',alias:'header.packedResources.'+name,
  relation:'exact raw SQL decimal VALUE -> source Number projection -> exact nonnegative finite binary64 bits',constraintStatus:'HOST_CHECK_ONLY_FROZEN_PARSE_PRIMITIVE_NOT_COMPOSED'})),
 {source:'characters.last_accrued_at',primaryHome:'lifeStateRoot',alias:'header.sharedLastAccruedAtMs',relation:'raw PG2000_US_I64 -> source driver Date UNIX_MS; no raw timestamp replacement',constraintStatus:'HOST_CHECK_ONLY_SOURCE_DRIVER_CONFORMANCE_REQUIRED'},
 {source:'characters.last_accrued_at',primaryHome:'lifeStateRoot',alias:'lifeBooksRoot.last_accrued_at',relation:'existing book UNIX_MS mirror must equal the SAME header projection',constraintStatus:'HOST_CHECK_ONLY_NO_SECOND_CLOCK_AUTHORITY'},
 {source:'characters.bank_intransit_at',primaryHome:'lifeStateRoot',alias:'lifeBooksRoot.bank_intransit_at',relation:'raw PG2000_US_I64/NULL -> existing nullable source Date UNIX_MS projection',constraintStatus:'HOST_CHECK_ONLY_SOURCE_DRIVER_CONFORMANCE_REQUIRED'},
 {source:'characters.minted',primaryHome:'lifeStateRoot',alias:'account policy minted status',relation:'source stores an actual life-side mirror; preserve it, do not infer account policy truth',constraintStatus:'NO_ACCOUNT_POLICY_AUTHORITY'},
 {source:'characters.checkin_day/streak',primaryHome:'progressionRoot',alias:'account daily claim state',relation:'preserve physical life projections; these cannot reopen account claims',constraintStatus:'NO_ACCOUNT_DAILY_AUTHORITY'},
]);
export const POLICY=SOURCE_CATALOG.policy;
export const REGISTRY=deepFreeze({version:VERSION,namespace:'omerta:private-character-eligibility:typed-roots:v1',
 sourceSchema:SOURCE_CATALOG.source,characterColumns:PARTITION,relations:RELATIONS,selectedRoots:SELECTED,qualifiedProjections:PROJECTIONS,
 rootCapacity:ROOT_CAPACITY,relationMaxRows:RELATION_MAX_ROWS,maxTextBytes:MAX_TEXT_BYTES,
 timestamp:PG_TIMESTAMP,sourceDateProjectionProfile:SOURCE_DATE_PROJECTION,policy:POLICY,numeric:'exact signed finite C256/scale[-512,512] canonical VALUE; unsupported values rejected before Number',
 text:'exact valid PostgreSQL UTF8 bytes, no NUL, no Unicode normalization/trimming/case folding',
 noImplicitRowsOrFields:true,noOpaqueRemainder:true,frozenRootReinterpretation:false,
 scope:'full selected-root representation and selective private source predicate, not source admission or state mutation authority'});
export const REGISTRY_HASH=keccak256(toHex(JSON.stringify(REGISTRY)));
export const fieldsFor=home=>{const fields=SELECTED[home];if(!fields)throw new TypeError('Unselected root');return fields;};
