// Exact task-puzzle586 source and catalog delta. Historical585 admission stays separate.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { questingCatalogSource, QUESTING_CATALOG_SOURCE } from './questing-enterprise-catalog.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const blob=value=>crypto.createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const fields=['relations','columns','constraints','indexes'];
const shape=(value,keys)=>assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),'Closed complete catalog shape');
export const TASK_PUZZLE_CATALOG_SOURCE=freeze({file:'schema.sql',mode:'100755',blob:'511950e2a68d50cebebe6139098a5dbb609117c9',sha256:'b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de'});
const counterDdl=`-- A durable crime occurrence, including failed attempts. Direct SQL prevents a
-- stale character snapshot from clobbering it; prepared answers never bind to clocks.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS crime_puzzle_revision BIGINT NOT NULL DEFAULT 0;

`;
const puzzleDdl=`
-- Durable gameplay task puzzles. Private payloads and consumed receipts are retained;
-- trusted adapters bind occurrences and consume under the job's character transaction.
-- Issuance history survives estate cleanup under its original character ID, never as heir authority.
CREATE TABLE IF NOT EXISTS task_puzzles (
  id TEXT PRIMARY KEY,
  issue_order BIGSERIAL NOT NULL,
  character_id TEXT NOT NULL REFERENCES characters(id),
  scope TEXT NOT NULL,
  target_id TEXT NOT NULL,
  context_key TEXT NOT NULL,
  version INT NOT NULL CHECK (version >= 1),
  kind TEXT NOT NULL,
  structural_signature TEXT NOT NULL,
  puzzle JSONB NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  UNIQUE (character_id, scope, target_id, context_key)
);
CREATE INDEX IF NOT EXISTS ix_task_puzzles_recent ON task_puzzles(character_id, issue_order DESC);
`;
export function taskPuzzleCatalogSource(input){
  assert.equal(arguments.length,1);assert.equal(typeof input,'string');const current=input.replaceAll('\r\n','\n');
  assert(!current.includes('\r')&&(input===current||input===current.replaceAll('\n','\r\n')),'Whole uniform LF/CRLF only');
  assert.equal(sha(current),TASK_PUZZLE_CATALOG_SOURCE.sha256,'Exact complete current task-puzzle586 schema');assert.equal(blob(current),TASK_PUZZLE_CATALOG_SOURCE.blob);
  const predecessor=execFileSync('git',['--no-replace-objects','cat-file','blob',QUESTING_CATALOG_SOURCE.blob],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:32e6});
  const quest=questingCatalogSource(predecessor);
  const anchor='-- ── Indexes & integrity (audit hardening) — after all tables exist ──\n';assert.equal(predecessor.split(anchor).length,2);
  assert.equal(current,predecessor.replace(anchor,counterDdl+anchor)+puzzleDdl,'Only the two reviewed complete source hunks');
  assert.equal((current.match(/^CREATE TABLE IF NOT EXISTS /gm)||[]).length,586);
  return freeze({current,predecessor,quest,actualTables:586,baselineTables:585,sourceOnly:true,nativeAdmission:false,priorResultsTransferred:false});
}
const initial='id account_id name generation alive respect energy nerve health cash bank muscle cunning speed jail_until hosp_until loc path title streak checkin_day lc_crime ammo cb heat trade_rep gta_at gun vest shoot_cd_until busts lab crew crew_paid_at heist_at season minted season_kills honor npchit_at safe_until guard_price fade_limit poker_limit wash_used wash_at safehouse_used safehouse_at bust_used bust_at refill_used refill_at rwa_used rwa_at respec_at guarded_by guarded_until racket_credit_ms bank_credit_ms bank_intransit bank_intransit_at heat_exposure indicted_at retainer_until jury_bought witpro_until world_raid_at pen_safe_until hole_until pen_faction shank_at train_at mission_at street_action_at crew_sale_credit_ms welsher wanted_until envelope_until wire_until wire_tier disinfo_until active_at race_at port_used port_at contraband berths is_npc npc_seed last_accrued_at created_at'.split(' ');
const trailing='shipment duel_elo duel_limit duel_at clue_at duel_style family_raid_at heist_loot lab_purity lab_yield lab_stealth path_at statuse_used statuse_at car_stolen_at trunk_robbed_at sabotaged_at paper_at lfg lfg_at seeking_mentor seeking_mentor_at bio aha_stage aha_rival aha_rival_name forged'.split(' ');
const legacyInitial=initial.filter(name=>!['street_action_at','crew_sale_credit_ms'].includes(name));
const legacy=[...legacyInitial,...trailing,'crime_puzzle_revision','street_action_at','crew_sale_credit_ms'];
export const TASK_PUZZLE_CHARACTER_PROFILES=freeze({fresh:[...initial,'crime_puzzle_revision',...trailing],upgrade585:[...initial,...trailing,'crime_puzzle_revision'],phase2:[...legacy],director:[...legacy]});
const specs=freeze([
  ['id','text',true,null],['issue_order','bigint',true,"nextval('task_puzzles_issue_order_seq'::regclass)"],
  ['character_id','text',true,null],['scope','text',true,null],['target_id','text',true,null],['context_key','text',true,null],
  ['version','integer',true,null],['kind','text',true,null],['structural_signature','text',true,null],['puzzle','jsonb',true,null],
  ['issued_at','timestamp with time zone',true,'now()'],['consumed_at','timestamp with time zone',false,null],
]);
const column=(table_name,column_name,ordinal,type,not_null,default_expression)=>({table_name,column_name,ordinal,type,typmod:-1,default_expression,not_null,identity:'',generated:'',collation_schema:type==='text'?'pg_catalog':null,collation_name:type==='text'?'default':null});
const constraint=(table_name,name,type,definition,columns,flags)=>({table_name,name,type,validated:true,deferrable:false,deferred:false,definition,match_type:' ',update_action:' ',delete_action:' ',referenced_schema:null,referenced_table:null,columns,referenced_columns:[],...(flags?{no_inherit:['p','u','f'].includes(type),is_local:true,inheritance_count:0}:{})});
const order=(a,b)=>a.table_name<b.table_name?-1:a.table_name>b.table_name?1:a.name<b.name?-1:a.name>b.name?1:0;
const isCounter=row=>row.table_name==='characters'&&(row.column_name==='crime_puzzle_revision'||row.name==='characters_crime_puzzle_revision_not_null'||row.columns?.includes('crime_puzzle_revision'));
const isPuzzle=(field,row)=>field==='relations'?['task_puzzles','task_puzzles_issue_order_seq'].includes(row.name):['task_puzzles','task_puzzles_issue_order_seq'].includes(row.table_name)||isCounter(row);
function expected(version,profile,flags){
  assert(version===16||version===18);assert(Object.hasOwn(TASK_PUZZLE_CHARACTER_PROFILES,profile));assert.equal(typeof flags,'boolean');
  const columns=[column('characters','crime_puzzle_revision',TASK_PUZZLE_CHARACTER_PROFILES[profile].indexOf('crime_puzzle_revision')+1,'bigint',true,'0'),...specs.map(([name,type,required,value],i)=>column('task_puzzles',name,i+1,type,required,value))];
  const constraints=[constraint('task_puzzles','task_puzzles_pkey','p','PRIMARY KEY (id)',['id'],flags),
    {...constraint('task_puzzles','task_puzzles_character_id_fkey','f','FOREIGN KEY (character_id) REFERENCES characters(id)',['character_id'],flags),match_type:'s',update_action:'a',delete_action:'a',referenced_schema:'$self',referenced_table:'characters',referenced_columns:['id']},
    constraint('task_puzzles','task_puzzles_version_check','c','CHECK (version >= 1)',['version'],flags),
    constraint('task_puzzles','task_puzzles_character_id_scope_target_id_context_key_key','u','UNIQUE (character_id, scope, target_id, context_key)',['character_id','scope','target_id','context_key'],flags)];
  if(version===18)for(const row of columns)if(row.not_null)constraints.push(constraint(row.table_name,`${row.table_name}_${row.column_name}_not_null`,'n',`NOT NULL ${row.column_name}`,[row.column_name],flags));
  const indexes=[['task_puzzles_pkey','id',true,true],['task_puzzles_character_id_scope_target_id_context_key_key','character_id, scope, target_id, context_key',true,false],['ix_task_puzzles_recent','character_id, issue_order DESC',false,false]].map(([name,keys,unique,primary])=>({table_name:'task_puzzles',name,definition:`CREATE ${unique?'UNIQUE ':''}INDEX ${name} ON $self.task_puzzles USING btree (${keys})`,unique,primary,valid:true,ready:true,live:true,nulls_not_distinct:false,predicate:null}));
  return {relations:[{name:'task_puzzles',kind:'r',persistence:'p'},{name:'task_puzzles_issue_order_seq',kind:'S',persistence:'p'}],columns,constraints:constraints.sort(order),indexes:indexes.sort(order)};
}
export function verifyTaskPuzzleSequenceMetadata(sequence){
  assert.equal(arguments.length,1);
  assert.deepEqual(sequence,{definition:[{name:'task_puzzles_issue_order_seq',type:'bigint',start:'1',increment:'1',minimum:'1',maximum:'9223372036854775807',cache:'1',cycle:false,owner_matches:true}],ownership:[{name:'task_puzzles_issue_order_seq',schema:'$self',table_name:'task_puzzles',column_name:'issue_order',dependency:'a'}],bindings:[{table_name:'task_puzzles',column_name:'issue_order',schema:'$self',sequence:'task_puzzles_issue_order_seq',dependency:'n'}]},'Exact BIGSERIAL sequence definition, owned column and nextval dependency');return true;
}
export function verifyTaskPuzzleCatalogDelta(metadata,version,profile,flags){
  assert.equal(arguments.length,4);shape(metadata,[...fields,'sequences']);
  const wanted=expected(version,profile,flags);
  for(const field of fields){assert(Array.isArray(metadata[field]));assert.deepEqual(metadata[field].filter(row=>isPuzzle(field,row)),wanted[field],`Every current puzzle ${field} field before comparison`);}
  assert.deepEqual(metadata.columns.filter(row=>row.table_name==='characters').map(({column_name,ordinal})=>({column_name,ordinal})),TASK_PUZZLE_CHARACTER_PROFILES[profile].map((column_name,i)=>({column_name,ordinal:i+1})),'Complete literal character profile; no generic ordinal normalization');
  verifyTaskPuzzleSequenceMetadata(metadata.sequences);return true;
}
export function taskPuzzleComparisonMetadata(metadata,version,profile,flags){
  verifyTaskPuzzleCatalogDelta(metadata,version,profile,flags);
  const ordinal=TASK_PUZZLE_CHARACTER_PROFILES[profile].indexOf('crime_puzzle_revision')+1;
  return Object.fromEntries(fields.map(field=>[field,metadata[field].filter(row=>!isPuzzle(field,row)).map(row=>field==='columns'&&row.table_name==='characters'&&row.ordinal>ordinal?{...row,ordinal:row.ordinal-1}:row)]));
}
export function taskPuzzleComparisonConstraints(rows,version,includeNotNull,profile){
  assert(Array.isArray(rows));assert.equal(typeof includeNotNull,'boolean');
  const selected=rows.filter(row=>isPuzzle('constraints',row));
  assert.deepEqual(selected,expected(version,profile,false).constraints.filter(row=>includeNotNull||row.type!=='n').map(({table_name,name,definition})=>({table_name,name,definition})),'Exact current constraint view before historical comparison');
  return rows.filter(row=>!isPuzzle('constraints',row));
}
export function taskPuzzleCatalogProjection(reference,baseline,version,profile,flags){
  assert.equal(arguments.length,5);shape(baseline,fields);
  assert.deepEqual(taskPuzzleComparisonMetadata(reference,version,profile,flags),baseline,'Every retained585 field equals independently compiled reference');
  freeze(reference);freeze(baseline);
  return Object.freeze({reference,baseline,verify:metadata=>{verifyTaskPuzzleCatalogDelta(metadata,version,profile,flags);assert.deepEqual(metadata,reference,'Complete current586 catalog');return true;},projectMetadata:metadata=>{const result=taskPuzzleComparisonMetadata(metadata,version,profile,flags);assert.deepEqual(result,baseline,'Every retained585 field remains exact');return result;},projectConstraints:rows=>taskPuzzleComparisonConstraints(rows,version,true,profile),sourceOnly:true,nativeAdmission:false,priorResultsTransferred:false});
}
export async function readTaskPuzzleSequenceMetadata(queryable){
  const definition=(await queryable.query(`SELECT c.relname::text AS name,format_type(s.seqtypid,NULL) AS type,
    s.seqstart::text AS start,s.seqincrement::text AS increment,s.seqmin::text AS minimum,s.seqmax::text AS maximum,s.seqcache::text AS cache,s.seqcycle AS cycle,
    c.relowner=t.relowner AS owner_matches FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_class t ON t.relnamespace=n.oid AND t.relname='task_puzzles' WHERE n.nspname=current_schema() AND c.relname='task_puzzles_issue_order_seq' ORDER BY c.relname`)).rows;
  const ownership=(await queryable.query(`SELECT s.relname::text AS name,CASE WHEN tn.nspname=current_schema() THEN '$self' ELSE tn.nspname END::text AS schema,
    t.relname::text AS table_name,a.attname::text AS column_name,d.deptype::text AS dependency
    FROM pg_class s JOIN pg_namespace n ON n.oid=s.relnamespace JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=s.oid AND d.refclassid='pg_class'::regclass
    JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace tn ON tn.oid=t.relnamespace LEFT JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
    WHERE n.nspname=current_schema() AND s.relname='task_puzzles_issue_order_seq' ORDER BY t.relname,a.attname,d.deptype`)).rows;
  const bindings=(await queryable.query(`SELECT t.relname::text AS table_name,a.attname::text AS column_name,CASE WHEN sn.nspname=current_schema() THEN '$self' ELSE sn.nspname END::text AS schema,
    s.relname::text AS sequence,d.deptype::text AS dependency FROM pg_attrdef ad JOIN pg_class t ON t.oid=ad.adrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ad.adnum JOIN pg_depend d ON d.classid='pg_attrdef'::regclass AND d.objid=ad.oid AND d.refclassid='pg_class'::regclass
    JOIN pg_class s ON s.oid=d.refobjid AND s.relkind='S' JOIN pg_namespace sn ON sn.oid=s.relnamespace
    WHERE n.nspname=current_schema() AND t.relname='task_puzzles' ORDER BY a.attnum,sn.nspname,s.relname,d.deptype`)).rows;
  return {definition,ownership,bindings};
}

// Native reference compilation is separately admitted; no synthetic fixture grants execution.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import * as compiler from './commerce-deed-release-phase2-native-catalog.js';
import { captureQuestingEnterpriseSource, assertQuestingEnterpriseStable } from './enterprise-native-questing.js';
import { questingCatalogProjection, questingCasinoCatalogProjection, QUESTING_CASINO_DDL_CONTROLS } from './questing-enterprise-catalog.js';
export async function readTaskPuzzleNativeMetadata(client){
  const metadata=await compiler.readCommerceReleasePhase2Metadata(client);
  const flags=(await client.query(`SELECT t.relname::text AS table_name,c.conname::text AS name,c.connoinherit AS no_inherit,c.conislocal AS is_local,c.coninhcount AS inheritance_count
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() ORDER BY t.relname,c.conname`)).rows;
  assert.equal(flags.length,metadata.constraints.length);
  return {...metadata,constraints:metadata.constraints.map((row,i)=>{assert.equal(flags[i].table_name,row.table_name);assert.equal(flags[i].name,row.name);shape(flags[i],['table_name','name','no_inherit','is_local','inheritance_count']);return {...row,no_inherit:flags[i].no_inherit,is_local:flags[i].is_local,inheritance_count:flags[i].inheritance_count};}),sequences:await readTaskPuzzleSequenceMetadata(client)};
}
export const TASK_PUZZLE_DDL_CONTROLS=Object.freeze([
  ...specs.flatMap(([name])=>[`ALTER TABLE task_puzzles DROP COLUMN ${name} CASCADE`,`ALTER TABLE task_puzzles ALTER COLUMN ${name} SET DEFAULT NULL`].filter((_,i)=>i===0||['issue_order','issued_at'].includes(name))),
  ...specs.filter(([, ,required])=>required).map(([name])=>`ALTER TABLE task_puzzles ALTER COLUMN ${name} DROP NOT NULL`).filter(ddl=>!ddl.includes('COLUMN id ')),
  'ALTER TABLE task_puzzles ALTER COLUMN consumed_at SET NOT NULL',
  'ALTER TABLE task_puzzles ALTER COLUMN scope TYPE varchar',
  'ALTER TABLE task_puzzles ADD COLUMN unknown TEXT',
  'ALTER TABLE characters DROP COLUMN crime_puzzle_revision',
  'ALTER TABLE characters ALTER COLUMN crime_puzzle_revision SET DEFAULT 1',
  'ALTER TABLE characters ALTER COLUMN crime_puzzle_revision DROP NOT NULL',
  'ALTER TABLE characters ALTER COLUMN crime_puzzle_revision TYPE integer',
  ...['task_puzzles_pkey','task_puzzles_character_id_fkey','task_puzzles_version_check','task_puzzles_character_id_scope_target_id_context_key_key'].map(name=>`ALTER TABLE task_puzzles DROP CONSTRAINT ${name}`),
  'ALTER TABLE task_puzzles ALTER CONSTRAINT task_puzzles_character_id_fkey DEFERRABLE',
  'DROP INDEX ix_task_puzzles_recent',
  'ALTER SEQUENCE task_puzzles_issue_order_seq OWNED BY NONE',
  'ALTER SEQUENCE task_puzzles_issue_order_seq INCREMENT BY 2',
  'ALTER SEQUENCE task_puzzles_issue_order_seq START WITH 2',
  'ALTER SEQUENCE task_puzzles_issue_order_seq MINVALUE 0',
  'ALTER SEQUENCE task_puzzles_issue_order_seq MAXVALUE 10000',
  'ALTER SEQUENCE task_puzzles_issue_order_seq CACHE 2',
  'ALTER SEQUENCE task_puzzles_issue_order_seq CYCLE',
  'ALTER SEQUENCE task_puzzles_issue_order_seq AS integer',
  'CREATE SEQUENCE unknown_sequence',
  'ALTER TABLE characters ALTER COLUMN generation SET DEFAULT 42',
]);
const questDdl=Object.freeze([
  ...['quest_workshop_mysteries','quest_workshop_plays','quest_reading_room'].map(table=>`ALTER TABLE ${table} ADD COLUMN unreviewed TEXT`),
  ...[['quest_workshop_mysteries','author_account_id'],['quest_workshop_plays','mystery_id'],['quest_workshop_plays','account_id'],['quest_reading_room','account_id']].map(([table,column])=>`ALTER TABLE ${table} DROP CONSTRAINT ${table}_${column}_fkey`),
  'ALTER TABLE quest_workshop_mysteries DROP CONSTRAINT quest_workshop_mysteries_status_check',
  'ALTER TABLE quest_workshop_plays DROP CONSTRAINT quest_workshop_plays_stars_check',
  'ALTER TABLE quest_workshop_mysteries ALTER COLUMN author_credit DROP NOT NULL',
  'ALTER TABLE quest_workshop_plays ALTER COLUMN attempts SET DEFAULT 42',
  'DROP INDEX ix_quest_workshop_author','DROP INDEX ix_quest_workshop_published',
]);
async function ownedCompile(pool,address,sources,inspect){
  const name='release_phase2_ref_'+crypto.randomBytes(8).toString('hex');let created=false,client,failure;
  try{
    assert.deepEqual((await pool.query('SELECT nspname FROM pg_namespace WHERE nspname=$1',[name])).rows,[]);
    await pool.query(`CREATE SCHEMA ${name}`);created=true;
    const url=new URL(address);url.searchParams.set('options',`-c search_path=${name} -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000`);
    client=new pg.Client({connectionString:url.href});await client.connect();
    const row=(await client.query("SELECT current_schema() AS schema,current_database() AS database,current_user AS role,current_setting('statement_timeout') AS timeout,current_setting('lock_timeout') AS lock_timeout,current_setting('idle_in_transaction_session_timeout') AS idle_timeout")).rows[0];
    assert.deepEqual(row,{schema:name,database:address.pathname.slice(1),role:address.username,timeout:'30s',lock_timeout:'5s',idle_timeout:'30s'});
    for(const source of sources)await client.query(source);
    const metadata=await readTaskPuzzleNativeMetadata(client);
    assert.deepEqual(metadata.relations.filter(row=>['r','p'].includes(row.kind)).map(row=>row.name).sort(),[...sources.at(-1).matchAll(/^CREATE TABLE IF NOT EXISTS (\w+)/gm)].map(row=>row[1]).sort(),'Complete actual source table inventory');
    if(inspect)await inspect(client,metadata);return metadata;
  }catch(error){failure=error;throw error;}
  finally{
    const failures=[];try{await client?.end();}catch(error){failures.push(error);}
    try{if(created){assert.equal((await pool.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1',[name])).rows[0]?.mine,true);await pool.query(`DROP SCHEMA ${name} CASCADE`);assert.deepEqual((await pool.query('SELECT nspname FROM pg_namespace WHERE nspname=$1',[name])).rows,[]);}}catch(error){failures.push(error);}
    if(failures.length){if(!failure)throw new AggregateError(failures,'Owned current catalog cleanup failed');failure.cleanupFailures=failures.map(error=>error.message);}
  }
}
function onlyPrior(metadata){assert.deepEqual(metadata.sequences,{definition:[],ownership:[],bindings:[]},'Pinned585 contains no puzzle sequence or default');const {sequences,...prior}=metadata;return prior;}
export async function verifyTaskPuzzleNativeReferences(pool,endpoint,raw){
  assert.equal(arguments.length,3);assert.equal(process.execArgv.length,0);assert.equal(process.argv.length,3);
  const caller=path.resolve(process.argv[1]),enterprise=caller===path.join(root,'test','enterprise-release-phase2-migration-catalog.js'),phase2=caller===path.join(root,'test','phase2-postgres.js'),director=caller===path.join(root,'test','director-migration.js');
  assert(enterprise||phase2||director,'Only real canonical native callers');assert(phase2?['--definitions','--lots'].includes(process.argv[2]):process.argv[2]==='--postgres');
  const source=taskPuzzleCatalogSource(raw),physical=fs.readFileSync(path.join(root,'schema.sql'),'utf8');assert.equal(source.current,physical.replaceAll('\r\n','\n'),'Complete raw physical586 input');
  const capture=captureQuestingEnterpriseSource(),address=new URL(endpoint);
  assert(['postgres:','postgresql:'].includes(address.protocol)&&address.hostname==='127.0.0.1'&&!address.search&&!address.hash);
  const local=['35439','35449'].includes(address.port)&&address.username==='pilot_runner'&&!address.password;
  assert(local||address.port==='5432'&&address.username==='postgres'&&address.password==='pgcheck');
  if(enterprise){assert.match(address.pathname,/^\/enterprise_native_catalog_test_[a-f0-9]{12}$/);assert.equal(new URL(process.env.ENTERPRISE_NATIVE_CATALOG_TEST_DATABASE_URL).href,address.href);}
  else assert(['/omerta_check','/omerta_query'].includes(address.pathname));
  const backend=(await pool.query("SELECT current_user AS role,current_database() AS database,current_schema() AS schema,current_setting('server_version') AS version,current_setting('data_directory') AS directory,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0];
  assert.equal(backend.role,address.username);assert.equal(backend.owner,address.username);assert.equal('/'+backend.database,address.pathname);assert.match(backend.version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
  if(local)assert.equal(backend.directory.replaceAll('\\','/').toLowerCase(),{'35439':'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184','35449':'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof'}[address.port]);
  if(enterprise)assert.equal(backend.schema,'public');else if(director)assert.match(backend.schema,/^director_migration_[a-f0-9]{16}$/);else{assert.match(backend.schema,/^p2_definitions_[a-f0-9]{32}$/);assert.equal(backend.schema,process.env.P2_TEST_SCHEMA);assert.equal(process.env.P2_TEST_CHILD,process.argv[2]==='--definitions'?'upgrade':'lots-catalog');}
  const version=Number(backend.version.split('.')[0]);
  const baseline=onlyPrior(await ownedCompile(pool,address,[source.predecessor]));
  const questBaseline=onlyPrior(await ownedCompile(pool,address,[source.quest.baseline]));
  const archivedBaseline=onlyPrior(await ownedCompile(pool,address,[source.quest.archivedBaseline]));
  const priorQuest=questingCatalogProjection(baseline,questBaseline,version);
  assert.deepEqual(questingCasinoCatalogProjection(questBaseline,version,'fresh',true),archivedBaseline);
  let puzzleDdlCausal=0,questDdlCausal=0,casinoDdlCausal=0,idempotent=0;
  const inspect=profile=>async(client,metadata)=>{
    const proof=taskPuzzleCatalogProjection(metadata,baseline,version,profile,true);
    for(const [group,ddls]of [['puzzle',TASK_PUZZLE_DDL_CONTROLS],['quest',questDdl],['casino',QUESTING_CASINO_DDL_CONTROLS]])for(const ddl of ddls){
      await client.query('BEGIN');try{await client.query(ddl);await assert.rejects(async()=>proof.verify(await readTaskPuzzleNativeMetadata(client)),error=>error?.code==='ERR_ASSERTION');if(group==='puzzle')puzzleDdlCausal++;else if(group==='quest')questDdlCausal++;else casinoDdlCausal++;}finally{await client.query('ROLLBACK');}
      proof.verify(await readTaskPuzzleNativeMetadata(client));
    }
    await client.query(source.current);proof.verify(await readTaskPuzzleNativeMetadata(client));idempotent++;
  };
  const current=await ownedCompile(pool,address,[source.current],inspect('fresh'));
  const upgraded=await ownedCompile(pool,address,[source.predecessor,source.current],inspect('upgrade585'));
  const freshProof=taskPuzzleCatalogProjection(current,baseline,version,'fresh',true),upgradeProof=taskPuzzleCatalogProjection(upgraded,baseline,version,'upgrade585',true);
  assert.deepEqual(freshProof.projectMetadata(current),upgradeProof.projectMetadata(upgraded),'Both independently validated profiles retain every585 field');
  priorQuest.verify(baseline);assertQuestingEnterpriseStable(capture);
  return freeze({current,upgraded,baseline,questBaseline,archivedBaseline,actualTables:586,baselineTables:585,version,puzzleDdlCausal,questDdlCausal,casinoDdlCausal,idempotent,priorQuestCausal:priorQuest.causal,native:true,priorResultsTransferred:false});
}
