// Independent pure fixtures. These prove validators, not PostgreSQL execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { questingCatalogSource } from '../tools/questing-enterprise-catalog.js';
const current = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
assert.throws(() => questingCatalogSource(current), /Exact complete actual quest585/);
const module = await import('../tools/task-puzzle-native-catalog.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url?.endsWith('/tools/task-puzzle-native-catalog.js')) return {};
  throw error;
});
assert.equal(typeof module.taskPuzzleCatalogSource, 'function', 'Current586 needs a distinct exact source qualifier');
const { taskPuzzleCatalogSource, taskPuzzleCatalogProjection, verifyTaskPuzzleCatalogDelta, verifyTaskPuzzleSequenceMetadata, taskPuzzleComparisonConstraints } = module;
const source = taskPuzzleCatalogSource(current);
const old = execFileSync('git', ['cat-file', 'blob', '86b671c5d6f6928ff3e66f1ad0fca5f46a7364e3'], { encoding:'utf8', maxBuffer:32e6 });
assert.equal(source.current, current.replaceAll('\r\n','\n')); assert.equal(source.predecessor, old);
assert.equal(source.actualTables,586); assert.equal(source.baselineTables,585);
assert.deepEqual([source.sourceOnly,source.nativeAdmission,source.priorResultsTransferred],[true,false,false]);
assert.equal(taskPuzzleCatalogSource(source.current.replaceAll('\n','\r\n')).current, source.current);
assert.equal(questingCatalogSource(old).actualTables,585);
let refusals=0; const reject=fn=>{assert.throws(fn,error=>error?.code==='ERR_ASSERTION');refusals++;};
for(const input of [old,source.current+'\n',source.current.slice(1),'\ufeff'+source.current,source.current.replace('\n','\r\n'),
  source.current.replace('crime_puzzle_revision BIGINT','crime_puzzle_revision INT'),source.current.replace('issue_order BIGSERIAL','issue_order BIGINT'),
  source.current.replace('version >= 1','version >= 0'),source.current.replace('issue_order DESC','issue_order ASC')]) reject(()=>taskPuzzleCatalogSource(input));
const initial = 'id account_id name generation alive respect energy nerve health cash bank muscle cunning speed jail_until hosp_until loc path title streak checkin_day lc_crime ammo cb heat trade_rep gta_at gun vest shoot_cd_until busts lab crew crew_paid_at heist_at season minted season_kills honor npchit_at safe_until guard_price fade_limit poker_limit wash_used wash_at safehouse_used safehouse_at bust_used bust_at refill_used refill_at rwa_used rwa_at respec_at guarded_by guarded_until racket_credit_ms bank_credit_ms bank_intransit bank_intransit_at heat_exposure indicted_at retainer_until jury_bought witpro_until world_raid_at pen_safe_until hole_until pen_faction shank_at train_at mission_at street_action_at crew_sale_credit_ms welsher wanted_until envelope_until wire_until wire_tier disinfo_until active_at race_at port_used port_at contraband berths is_npc npc_seed last_accrued_at created_at'.split(' ');
const trailing = 'shipment duel_elo duel_limit duel_at clue_at duel_style family_raid_at heist_loot lab_purity lab_yield lab_stealth path_at statuse_used statuse_at car_stolen_at trunk_robbed_at sabotaged_at paper_at lfg lfg_at seeking_mentor seeking_mentor_at bio aha_stage aha_rival aha_rival_name forged'.split(' ');
const fields=['relations','columns','constraints','indexes'];
const column=(table_name,column_name,ordinal,type,not_null,default_expression)=>({table_name,column_name,ordinal,type,typmod:-1,default_expression,not_null,identity:'',generated:'',collation_schema:type==='text'?'pg_catalog':null,collation_name:type==='text'?'default':null});
const constraint=(table_name,name,type,definition,columns,flags)=>({table_name,name,type,validated:true,deferrable:false,deferred:false,definition,match_type:' ',update_action:' ',delete_action:' ',referenced_schema:null,referenced_table:null,columns,referenced_columns:[],...(flags?{no_inherit:['p','f','u'].includes(type),is_local:true,inheritance_count:0}:{})});
const sequence=()=>({definition:[{name:'task_puzzles_issue_order_seq',type:'bigint',start:'1',increment:'1',minimum:'1',maximum:'9223372036854775807',cache:'1',cycle:false,owner_matches:true}],ownership:[{name:'task_puzzles_issue_order_seq',schema:'$self',table_name:'task_puzzles',column_name:'issue_order',dependency:'a'}],bindings:[{table_name:'task_puzzles',column_name:'issue_order',schema:'$self',sequence:'task_puzzles_issue_order_seq',dependency:'n'}]});
const sort=metadata=>{metadata.relations.sort((a,b)=>a.name.localeCompare(b.name,'en'));for(const key of ['constraints','indexes'])metadata[key].sort((a,b)=>a.table_name.localeCompare(b.table_name,'en')||a.name.localeCompare(b.name,'en'));return metadata;};
function fixture(version,profile,flags){
  const legacyInitial=initial.filter(name=>!['street_action_at','crew_sale_credit_ms'].includes(name));
  const oldNames=['phase2','director'].includes(profile)?[...legacyInitial,...trailing,'street_action_at','crew_sale_credit_ms']:[...initial,...trailing];
  const names=profile==='fresh'?[...initial,'crime_puzzle_revision',...trailing]:profile==='upgrade585'?[...oldNames,'crime_puzzle_revision']:[...legacyInitial,...trailing,'crime_puzzle_revision','street_action_at','crew_sale_credit_ms'];
  const baseline=sort({relations:[{name:'characters',kind:'r',persistence:'p'}],columns:oldNames.map((name,i)=>column('characters',name,i+1,'text',true,null)),constraints:[],indexes:[]});
  const live={...structuredClone(baseline),columns:names.map((name,i)=>name==='crime_puzzle_revision'?column('characters',name,i+1,'bigint',true,'0'):{...baseline.columns.find(row=>row.column_name===name),ordinal:i+1}),sequences:sequence()};
  live.relations.push({name:'task_puzzles',kind:'r',persistence:'p'},{name:'task_puzzles_issue_order_seq',kind:'S',persistence:'p'});
  const specs=[['id','text',true,null],['issue_order','bigint',true,"nextval('task_puzzles_issue_order_seq'::regclass)"],['character_id','text',true,null],['scope','text',true,null],['target_id','text',true,null],['context_key','text',true,null],['version','integer',true,null],['kind','text',true,null],['structural_signature','text',true,null],['puzzle','jsonb',true,null],['issued_at','timestamp with time zone',true,'now()'],['consumed_at','timestamp with time zone',false,null]];
  live.columns.push(...specs.map(([name,type,required,value],i)=>column('task_puzzles',name,i+1,type,required,value)));
  live.constraints.push(constraint('task_puzzles','task_puzzles_pkey','p','PRIMARY KEY (id)',['id'],flags),
    {...constraint('task_puzzles','task_puzzles_character_id_fkey','f','FOREIGN KEY (character_id) REFERENCES characters(id)',['character_id'],flags),match_type:'s',update_action:'a',delete_action:'a',referenced_schema:'$self',referenced_table:'characters',referenced_columns:['id']},
    constraint('task_puzzles','task_puzzles_version_check','c','CHECK (version >= 1)',['version'],flags),
    constraint('task_puzzles','task_puzzles_character_id_scope_target_id_context_key_key','u','UNIQUE (character_id, scope, target_id, context_key)',['character_id','scope','target_id','context_key'],flags));
  if(version===18){for(const [name,,required]of specs)if(required)live.constraints.push(constraint('task_puzzles',`task_puzzles_${name}_not_null`,'n',`NOT NULL ${name}`,[name],flags));live.constraints.push(constraint('characters','characters_crime_puzzle_revision_not_null','n','NOT NULL crime_puzzle_revision',['crime_puzzle_revision'],flags));}
  for(const[name,cols,unique,primary]of[['task_puzzles_pkey','id',true,true],['task_puzzles_character_id_scope_target_id_context_key_key','character_id, scope, target_id, context_key',true,false],['ix_task_puzzles_recent','character_id, issue_order DESC',false,false]])live.indexes.push({table_name:'task_puzzles',name,definition:`CREATE ${unique?'UNIQUE ':''}INDEX ${name} ON $self.task_puzzles USING btree (${cols})`,unique,primary,valid:true,ready:true,live:true,nulls_not_distinct:false,predicate:null});
  return {baseline,live:sort(live)};
}
let profiles=0;
for(const version of [16,18])for(const profile of ['fresh','upgrade585','phase2','director'])for(const flags of [false,true]){
  const {baseline,live}=fixture(version,profile,flags), proof=taskPuzzleCatalogProjection(live,baseline,version,profile,flags);
  assert(proof.verify(structuredClone(live)));assert.deepEqual(proof.projectMetadata(live),baseline);verifyTaskPuzzleCatalogDelta(live,version,profile,flags);profiles++;
  for(const includeNotNull of [true,false]){
    const retained={table_name:'accounts',name:'accounts_pkey',definition:'PRIMARY KEY (id)'},rows=[retained,...live.constraints.filter(row=>includeNotNull||row.type!=='n').map(({table_name,name,definition})=>({table_name,name,definition}))];
    assert.deepEqual(taskPuzzleComparisonConstraints(rows,version,includeNotNull,profile),[retained]);
    reject(()=>taskPuzzleComparisonConstraints([...rows,{table_name:'task_puzzles',name:'unknown',definition:'CHECK (true)'}],version,includeNotNull,profile));
  }
  assert.equal(live.columns.find(r=>r.column_name==='crime_puzzle_revision').ordinal,profile==='fresh'?92:profile==='upgrade585'?119:117);
  for(const field of fields)for(const[i,row]of live[field].entries()){
    const relevant=field==='relations'?row.name.startsWith('task_puzzles'):row.table_name==='task_puzzles'||row.column_name==='crime_puzzle_revision'||row.name==='characters_crime_puzzle_revision_not_null';
    if(!relevant)continue;
    for(const mutate of [v=>v[field].splice(i,1),v=>v[field].push({...row}),v=>{v[field][i].unknown=true;},...Object.keys(row).map(key=>v=>{v[field][i][key]=typeof row[key]==='boolean'?!row[key]:typeof row[key]==='number'?row[key]+1:'changed';})]){
      const bad=structuredClone(live);mutate(bad);reject(()=>proof.verify(bad));reject(()=>verifyTaskPuzzleCatalogDelta(bad,version,profile,flags));
    }
  }
  for(const section of ['definition','ownership','bindings'])for(const key of Object.keys(live.sequences[section][0])){
    const bad=structuredClone(live);bad.sequences[section][0][key]=typeof bad.sequences[section][0][key]==='boolean'?!bad.sequences[section][0][key]:'changed';reject(()=>proof.verify(bad));reject(()=>verifyTaskPuzzleSequenceMetadata(bad.sequences));
  }
  for(const section of ['definition','ownership','bindings'])for(const mutate of [v=>v[section].pop(),v=>v[section].push({...v[section][0]}),v=>{v[section][0].unknown=true;}]){const bad=sequence();mutate(bad);reject(()=>verifyTaskPuzzleSequenceMetadata(bad));}
  for(const other of ['fresh','upgrade585','phase2','director'].filter(x=>x!==profile&&!['phase2','director'].every(y=>[x,profile].includes(y))))reject(()=>verifyTaskPuzzleCatalogDelta(live,version,other,flags));
  for(const mutate of [v=>{v.columns[0].ordinal++;},v=>{v.columns[0].type='unknown';},v=>v.columns.push(column('characters','unknown',120,'text',false,null)),v=>v.relations.push({name:'unknown',kind:'S',persistence:'p'})]){const bad=structuredClone(live);mutate(bad);reject(()=>proof.verify(bad));}
  reject(()=>taskPuzzleCatalogProjection(live,{...baseline,columns:baseline.columns.slice(1)},version,profile,flags));
  reject(()=>verifyTaskPuzzleCatalogDelta(live,version===16?18:16,profile,flags));
}
console.log(JSON.stringify({phase:'TASK_PUZZLE586_PURE_CATALOG',profiles,refusals,nativeAttempts:0,priorResultsTransferred:false}));
