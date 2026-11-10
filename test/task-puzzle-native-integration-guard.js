// Current entrypoints must refuse unauthorized callers before touching a backend.
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { commerceCurrentDeedSources } from '../tools/commerce-deed-release-phase2-native-catalog.js';
import { ageRemovalHistoricalInput } from '../tools/age-removal-source-transfer.js';
import { deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';
import { questingCatalogSource } from '../tools/questing-enterprise-catalog.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as immutablePredecessor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as immutablePredecessorHash } from '../tools/enterprise-native-contract-release-inputs.js';
// The current delta reader must avoid fetching unrelated catalog rows on each recheck.
const scopedQuest=await import('../tools/questing-ux-release-phase2-native-catalog.js');
assert.equal(typeof scopedQuest.readTaskPuzzleDeltaMetadata,'function','Current586 requires a scoped, uncached delta reader');
const scopedAddition=`export async function readTaskPuzzleDeltaMetadata(queryable){
  assert.equal(arguments.length,1);
  const restricted={query:async(sql,values)=>{
    assert(values===undefined||Array.isArray(values)&&values.length===0,'Closed task delta query parameters');
    if(sql===catalogQueries[0])return queryable.query(sql,values);
    const field=catalogFields.get(sql);assert(field,'Closed task delta metadata query');
    const anchor='WHERE n.nspname=current_schema()';assert.equal(sql.split(anchor).length,2);
    return queryable.query(sql.replace(anchor,anchor+' AND '+(field==='relations'?'c':'t')+'.relname IN ($1,$2,$3)'),
      ['characters','task_puzzles','task_puzzles_issue_order_seq']);
  }};
  return {...await original.readCommerceReleasePhase2Metadata(restricted),sequences:await readTaskPuzzleSequenceMetadata(queryable)};
}
`;
const scopedBefore='const metadata={...await original.readCommerceReleasePhase2Metadata(queryable),sequences:await readTaskPuzzleSequenceMetadata(queryable)};',
  scopedAfter='const metadata=await readTaskPuzzleDeltaMetadata(queryable);';
const scopedSource=fs.readFileSync('tools/questing-ux-release-phase2-native-catalog.js','utf8').replaceAll('\r\n','\n');
const scopedPredecessor=execFileSync('git',['--no-replace-objects','show','0992cf178fdd31144cc9758b22e06ac847e1000f:tools/questing-ux-release-phase2-native-catalog.js'],{encoding:'utf8',windowsHide:true,maxBuffer:32e6});
// Undo only the two measured formatting edits before any existing historical conservation.
const compactEdits={
  'tools/task-puzzle-native-catalog.js':[
    ["import assert from 'node:assert/strict';\n","import assert from 'node:assert/strict';\nimport { isDeepStrictEqual } from 'node:util';\n"],
    ["assert.deepEqual(metadata,reference,'Complete current586 catalog')","assert(isDeepStrictEqual(metadata,reference),'Complete current586 catalog')"],
  ],
  'tools/questing-ux-release-phase2-native-catalog.js':[
    ["  TASK_PUZZLE_DDL_CONTROLS } from './task-puzzle-native-catalog.js';\nconst taskStates","  TASK_PUZZLE_DDL_CONTROLS } from './task-puzzle-native-catalog.js';\nimport { isDeepStrictEqual } from 'node:util';\nconst taskStates"],
    ["assert.deepEqual(await taskMetadata(client),originalMetadata)","assert(isDeepStrictEqual(await taskMetadata(client),originalMetadata),'Complete current task DDL metadata')"],
  ],
};
const compactBase=new Map(Object.keys(compactEdits).map(file=>[file,execFileSync('git',['--no-replace-objects','show','8c448ee48934137d8d6c14cf80cc0d5d07118bed:'+file],{encoding:'utf8',windowsHide:true,maxBuffer:32e6})]));
const restoreCompactSource=(file,input)=>{
  assert.equal(typeof input,'string');let text=input.replaceAll('\r\n','\n');assert(!text.includes('\r')&&(input===text||input===text.replaceAll('\n','\r\n')));
  assert(Object.hasOwn(compactEdits,file));
  for(const[before,after]of compactEdits[file].toReversed()){assert.equal(text.split(after).length,2,'One exact compact comparison edit');text=text.replace(after,()=>before);}
  assert.equal(text,compactBase.get(file),'Only compact assertion rendering changes; every original query, field, control and equality remains exact');return text;
};
let compactConservationRefusals=0;
for(const file of Object.keys(compactEdits)){
  const text=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');restoreCompactSource(file,text);restoreCompactSource(file,text.replaceAll('\n','\r\n'));
  const edits=compactEdits[file],candidates=[...edits.flatMap(([before,after])=>[text.replace(after,before),text.replace(after,after+after)]),
    text.replace('assert(isDeepStrictEqual(','assert(!isDeepStrictEqual('),text.replace('assert(isDeepStrictEqual(','assert(Boolean('),
    text.replace('import { isDeepStrictEqual }', 'import { isDeepStrictEqual as unknown }'),text+'\n',text.replace('\n','\r\n')];
  assert.equal(new Set(candidates).size,candidates.length,'Every compact conservation candidate is distinct');
  for(const changed of candidates){assert.notEqual(changed,text);assert.throws(()=>restoreCompactSource(file,changed));compactConservationRefusals++;}
}
console.log(JSON.stringify({phase:'TASK_PUZZLE_COMPACT_CONSERVATION',files:2,compactConservationRefusals,nativeAttempts:0}));

const restoreScopedHelper=input=>{
  assert.equal(typeof input,'string');let text=input.replaceAll('\r\n','\n');assert(!text.includes('\r')&&(input===text||input===text.replaceAll('\n','\r\n')));
  text=restoreCompactSource('tools/questing-ux-release-phase2-native-catalog.js',text);
  assert.equal(text.split(scopedAddition).length,2,'One complete scoped reader insertion');
  assert.equal(text.split(scopedAfter).length,2,'One scoped acquisition replacement');assert.equal(text.split(scopedBefore).length,1);
  text=text.replace(scopedAddition,'').replace(scopedAfter,scopedBefore);
  assert.equal(text,scopedPredecessor,'Only the finite scoped acquisition edit; every original qualifier, query, control and deadline remains exact');return text;
};
restoreScopedHelper(scopedSource);restoreScopedHelper(scopedSource.replaceAll('\n','\r\n'));
let scopedConservationRefusals=0;
for(const changed of [scopedSource.replace(scopedAddition,''),scopedSource.replace(scopedAddition,scopedAddition+scopedAddition),
  scopedSource.replace(scopedAfter,scopedBefore),scopedSource.replace(scopedAfter,scopedAfter+scopedAfter),
  scopedSource.replace("['characters','task_puzzles','task_puzzles_issue_order_seq']","['characters','task_puzzles']"),
  scopedSource.replace('assert(values===undefined','assert(values!==undefined'),
  scopedSource.replace('verifyTaskPuzzleCatalogDelta(metadata,version,profile,false);return metadata;','return metadata;'),
  scopedSource.replace('const result=await queryable.query(sql,values);if(!field)return result;','const result={rows:[]};if(!field)return result;'),
  scopedSource+'\n',scopedSource.replace('\n','\r\n')]){
  assert.notEqual(changed,scopedSource,'Every scoped conservation refusal changes actual bytes');assert.throws(()=>restoreScopedHelper(changed));scopedConservationRefusals++;
}
// Actual current readers/verifiers execute against a SQL-only double; no native admission is claimed.
{
  const original=await import('../tools/commerce-deed-release-phase2-native-catalog.js');
  const delta=await import('../tools/task-puzzle-native-catalog.js');
  const sqlCalls=fn=>{const calls=[];const visit=node=>{if(!node||typeof node!=='object')return;
    if(node.type==='CallExpression'&&node.callee?.property?.name==='query'){
      const argument=node.arguments[0];assert(argument.type==='Literal'||argument.type==='TemplateLiteral'&&argument.expressions.length===0);
      calls.push(argument.type==='Literal'?argument.value:argument.quasis[0].value.cooked);
    }for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
  };visit(parse(fn.toString(),{ecmaVersion:'latest'}));return calls;};
  const queries=sqlCalls(original.readCommerceReleasePhase2Metadata),sequenceQueries=sqlCalls(delta.readTaskPuzzleSequenceMetadata);
  assert.equal(queries.length,5);assert.equal(sequenceQueries.length,3);
  const catalogFields=new Map(queries.slice(1).map((sql,i)=>[sql,['relations','constraints','columns','indexes'][i]]));
  const anchor='WHERE n.nspname=current_schema()',names=['characters','task_puzzles','task_puzzles_issue_order_seq'];
  const scopedQueries=queries.slice(1).map((sql,i)=>sql.replace(anchor,anchor+' AND '+(i===0?'c':'t')+'.relname IN ($1,$2,$3)'));
  const schema='release_phase2_ref_0123456789abcdef',calls=[];
  const fields=['relations','columns','constraints','indexes'];
  const column=(table_name,column_name,ordinal,type,not_null,default_expression)=>({table_name,column_name,ordinal,type,typmod:-1,default_expression,not_null,identity:'',generated:'',collation_schema:type==='text'?'pg_catalog':null,collation_name:type==='text'?'default':null});
  const constraint=(table_name,name,type,definition,columns)=>({table_name,name,type,validated:true,deferrable:false,deferred:false,definition,match_type:' ',update_action:' ',delete_action:' ',referenced_schema:null,referenced_table:null,columns,referenced_columns:[]});
  const initial='id account_id name generation alive respect energy nerve health cash bank muscle cunning speed jail_until hosp_until loc path title streak checkin_day lc_crime ammo cb heat trade_rep gta_at gun vest shoot_cd_until busts lab crew crew_paid_at heist_at season minted season_kills honor npchit_at safe_until guard_price fade_limit poker_limit wash_used wash_at safehouse_used safehouse_at bust_used bust_at refill_used refill_at rwa_used rwa_at respec_at guarded_by guarded_until racket_credit_ms bank_credit_ms bank_intransit bank_intransit_at heat_exposure indicted_at retainer_until jury_bought witpro_until world_raid_at pen_safe_until hole_until pen_faction shank_at train_at mission_at street_action_at crew_sale_credit_ms welsher wanted_until envelope_until wire_until wire_tier disinfo_until active_at race_at port_used port_at contraband berths is_npc npc_seed last_accrued_at created_at'.split(' ');
  const trailing='shipment duel_elo duel_limit duel_at clue_at duel_style family_raid_at heist_loot lab_purity lab_yield lab_stealth path_at statuse_used statuse_at car_stolen_at trunk_robbed_at sabotaged_at paper_at lfg lfg_at seeking_mentor seeking_mentor_at bio aha_stage aha_rival aha_rival_name forged'.split(' ');
  const sort=metadata=>{metadata.relations.sort((a,b)=>a.name.localeCompare(b.name,'en'));for(const key of ['constraints','indexes'])metadata[key].sort((a,b)=>a.table_name.localeCompare(b.table_name,'en')||a.name.localeCompare(b.name,'en'));return metadata;};
  const fixture=(version,profile)=>{
    const legacy=initial.filter(name=>!['street_action_at','crew_sale_credit_ms'].includes(name));
    const oldNames=['phase2','director'].includes(profile)?[...legacy,...trailing,'street_action_at','crew_sale_credit_ms']:[...initial,...trailing];
    const currentNames=profile==='fresh'?[...initial,'crime_puzzle_revision',...trailing]:profile==='upgrade585'?[...oldNames,'crime_puzzle_revision']:[...legacy,...trailing,'crime_puzzle_revision','street_action_at','crew_sale_credit_ms'];
    const baseline=sort({relations:[{name:'accounts',kind:'r',persistence:'p'},{name:'characters',kind:'r',persistence:'p'}],columns:[column('accounts','id',1,'text',true,null),...oldNames.map((name,i)=>column('characters',name,i+1,'text',true,null))],constraints:[constraint('accounts','accounts_pkey','p','PRIMARY KEY (id)',['id'])],indexes:[{table_name:'accounts',name:'accounts_pkey',definition:'CREATE UNIQUE INDEX accounts_pkey ON $self.accounts USING btree (id)',unique:true,primary:true,valid:true,ready:true,live:true,nulls_not_distinct:false,predicate:null}]});
    const live={...structuredClone(baseline),columns:[baseline.columns[0],...currentNames.map((name,i)=>name==='crime_puzzle_revision'?column('characters',name,i+1,'bigint',true,'0'):{...baseline.columns.find(row=>row.column_name===name&&row.table_name==='characters'),ordinal:i+1})],sequences:{definition:[{name:'task_puzzles_issue_order_seq',type:'bigint',start:'1',increment:'1',minimum:'1',maximum:'9223372036854775807',cache:'1',cycle:false,owner_matches:true}],ownership:[{name:'task_puzzles_issue_order_seq',schema:'$self',table_name:'task_puzzles',column_name:'issue_order',dependency:'a'}],bindings:[{table_name:'task_puzzles',column_name:'issue_order',schema:'$self',sequence:'task_puzzles_issue_order_seq',dependency:'n'}]}};
    live.relations.push({name:'task_puzzles',kind:'r',persistence:'p'},{name:'task_puzzles_issue_order_seq',kind:'S',persistence:'p'});
    const specs=[['id','text',true,null],['issue_order','bigint',true,"nextval('task_puzzles_issue_order_seq'::regclass)"],['character_id','text',true,null],['scope','text',true,null],['target_id','text',true,null],['context_key','text',true,null],['version','integer',true,null],['kind','text',true,null],['structural_signature','text',true,null],['puzzle','jsonb',true,null],['issued_at','timestamp with time zone',true,'now()'],['consumed_at','timestamp with time zone',false,null]];
    live.columns.push(...specs.map(([name,type,required,value],i)=>column('task_puzzles',name,i+1,type,required,value)));
    live.constraints.push(constraint('task_puzzles','task_puzzles_pkey','p','PRIMARY KEY (id)',['id']),
      {...constraint('task_puzzles','task_puzzles_character_id_fkey','f','FOREIGN KEY (character_id) REFERENCES characters(id)',['character_id']),match_type:'s',update_action:'a',delete_action:'a',referenced_schema:'$self',referenced_table:'characters',referenced_columns:['id']},
      constraint('task_puzzles','task_puzzles_version_check','c','CHECK (version >= 1)',['version']),constraint('task_puzzles','task_puzzles_character_id_scope_target_id_context_key_key','u','UNIQUE (character_id, scope, target_id, context_key)',['character_id','scope','target_id','context_key']));
    if(version===18){for(const [name,,required]of specs)if(required)live.constraints.push(constraint('task_puzzles',`task_puzzles_${name}_not_null`,'n',`NOT NULL ${name}`,[name]));live.constraints.push(constraint('characters','characters_crime_puzzle_revision_not_null','n','NOT NULL crime_puzzle_revision',['crime_puzzle_revision']));}
    for(const[name,cols,unique,primary]of[['task_puzzles_pkey','id',true,true],['task_puzzles_character_id_scope_target_id_context_key_key','character_id, scope, target_id, context_key',true,false],['ix_task_puzzles_recent','character_id, issue_order DESC',false,false]])live.indexes.push({table_name:'task_puzzles',name,definition:`CREATE ${unique?'UNIQUE ':''}INDEX ${name} ON $self.task_puzzles USING btree (${cols})`,unique,primary,valid:true,ready:true,live:true,nulls_not_distinct:false,predicate:null});
    return {baseline,live:sort(live)};
  };
  let state,rollbackState,releases=0;
  const backend=id=>({query:async(sql,values)=>{
    calls.push({id,sql,values});let rows;
    if(sql===queries[0]){assert.equal(values,undefined);rows=[{schema,database:'omerta_check',role:'pilot_runner'}];}
    else if(sql==='ROLLBACK'){state=structuredClone(rollbackState);rows=[];}
    else if(sql==='SELECT ordinary'){assert.deepEqual(values,[7]);rows=[{ordinary:7}];}
    else if(sequenceQueries.includes(sql)){assert.equal(values,undefined);rows=state.sequences[['definition','ownership','bindings'][sequenceQueries.indexOf(sql)]];}
    else{const i=scopedQueries.indexOf(sql),field=i<0?catalogFields.get(sql):['relations','constraints','columns','indexes'][i];assert(field,'The actual reader sends only exact known catalog SQL');
      if(i<0)assert.equal(values,undefined);else assert.deepEqual(values,names,'Exact closed query scope');
      rows=state[field].filter(row=>i<0||names.includes(field==='relations'?row.name:row.table_name));
      if(field==='indexes')rows=rows.map(row=>({...row,definition:row.definition.replace(' ON $self.',' ON '+schema+'.')}));
    }return {rows:structuredClone(rows),rowCount:rows.length,marker:'original-result'};
  },release:()=>{releases++;}});
  const expectRead=(offset,id)=>{assert.deepEqual(calls.slice(offset).map(call=>[call.id,call.sql,call.values]),
    [[id,queries[0],undefined],...scopedQueries.map(sql=>[id,sql,names]),...sequenceQueries.map(sql=>[id,sql,undefined])],'Every read issues all five scoped catalog and three same-client sequence queries');};
  let reads=0;
  for(const version of [16,18])for(const profile of ['fresh','upgrade585','phase2','director']){
    const {live}=fixture(version,profile);state=structuredClone(live);const queryable=backend(profile),offset=calls.length;
    const actual=await scopedQuest.readTaskPuzzleDeltaMetadata(queryable);expectRead(offset,profile);reads++;
    const expected={...Object.fromEntries(fields.map(field=>[field,live[field].filter(row=>names.includes(field==='relations'?row.name:row.table_name))])),sequences:live.sequences};
    assert.deepEqual(actual,expected,'Every selected field and complete character profile survives unchanged');delta.verifyTaskPuzzleCatalogDelta(actual,version,profile,false);
    assert.equal(actual.columns.filter(row=>row.table_name==='characters').length,119);
    state.columns.find(row=>row.column_name==='crime_puzzle_revision').default_expression='9';state.sequences.definition[0].cache='2';
    const mutatedOffset=calls.length,mutated=await scopedQuest.readTaskPuzzleDeltaMetadata(queryable);expectRead(mutatedOffset,profile);reads++;
    assert.equal(mutated.columns.find(row=>row.column_name==='crime_puzzle_revision').default_expression,'9');assert.equal(mutated.sequences.definition[0].cache,'2');
    assert.throws(()=>delta.verifyTaskPuzzleCatalogDelta(mutated,version,profile,false));
    state=structuredClone(live);const restoredOffset=calls.length,restored=await scopedQuest.readTaskPuzzleDeltaMetadata(queryable);expectRead(restoredOffset,profile);reads++;
    assert.deepEqual(restored,expected,'A fresh reread observes restored fields and sequence, never the mutated snapshot');delta.verifyTaskPuzzleCatalogDelta(restored,version,profile,false);
  }
  // Isolate exact current function bodies only for otherwise unreachable private contracts.
  // The native entrypoint is never reconstructed. All positive readers/verifiers above are real imports.
  const nodes=parse(scopedSource,{ecmaVersion:'latest',sourceType:'module'}).body;
  const body=name=>{const node=nodes.map(n=>n.type==='ExportNamedDeclaration'?n.declaration:n).find(n=>n?.type==='FunctionDeclaration'&&n.id.name===name);assert(node);return scopedSource.slice(node.start,node.end);};
  const readerWith=(read,fieldMap=catalogFields)=>new Function('assert','original','catalogQueries','catalogFields','readTaskPuzzleSequenceMetadata',body('readTaskPuzzleDeltaMetadata')+';return readTaskPuzzleDeltaMetadata;')(assert,{readCommerceReleasePhase2Metadata:read},queries,fieldMap,delta.readTaskPuzzleSequenceMetadata);
  let queryRefusals=0;
  const arityOffset=calls.length;await assert.rejects(()=>scopedQuest.readTaskPuzzleDeltaMetadata(backend('forbidden'),{}),error=>error?.code==='ERR_ASSERTION');assert.equal(calls.length,arityOffset);queryRefusals++;
  for(const [sql,values]of [['SELECT unknown',undefined],['SELECT 1 '+anchor,undefined],[queries[0]+' ',undefined],[queries[1]+' ',undefined],...queries.flatMap(sql=>[[sql,[1]],[sql,null],[sql,{}],[sql,'bad']])]){
    const offset=calls.length;await assert.rejects(()=>readerWith(q=>q.query(sql,values))(backend('forbidden')),error=>error?.code==='ERR_ASSERTION');assert.equal(calls.length,offset);queryRefusals++;
  }
  for(const sql of ['SELECT no_anchor',anchor+' '+anchor]){const offset=calls.length;await assert.rejects(()=>readerWith(q=>q.query(sql),new Map([[sql,'columns']]))(backend('forbidden')),error=>error?.code==='ERR_ASSERTION');assert.equal(calls.length,offset);queryRefusals++;}
  const makeProjected=new Function('assert','original','catalogQueries','catalogFields','readTaskPuzzleDeltaMetadata','verifyTaskPuzzleCatalogDelta','taskPuzzleComparisonMetadata',body('taskProjectedCaller')+';return taskProjectedCaller;')(assert,original,queries,catalogFields,scopedQuest.readTaskPuzzleDeltaMetadata,delta.verifyTaskPuzzleCatalogDelta,delta.taskPuzzleComparisonMetadata);
  const {live,baseline}=fixture(18,'phase2');state=structuredClone(live);rollbackState=structuredClone(live);
  const pool=backend('pool'),client=backend('transaction');pool.connect=async()=>client;
  let offset=calls.length;const projected=await makeProjected(pool,18,'phase2');assert.equal(calls.length-offset,9);
  offset=calls.length;assert.deepEqual(await original.readCommerceReleasePhase2Metadata(projected),baseline,'Every unrelated full original row and predecessor ordinal remains intact');assert.equal(calls.length-offset,45);
  for(let i=0;i<5;i++){const group=calls.slice(offset+9*i,offset+9*(i+1));assert.deepEqual(group.slice(0,8).map(row=>row.sql),[queries[0],...scopedQueries,...sequenceQueries]);assert.equal(group[8].sql,queries[i]);assert.equal(group[8].values,undefined);assert(group.every(row=>row.id==='pool'));}
  offset=calls.length;const result=await projected.query(queries[1]);assert.equal(calls.length-offset,9);assert.deepEqual(result.rows,baseline.relations);assert.equal(result.marker,'original-result');assert.equal(result.rowCount,live.relations.length);
  offset=calls.length;assert.deepEqual((await projected.query('SELECT ordinary',[7])).rows,[{ordinary:7}]);assert.equal(calls.length-offset,1,'Non-catalog SQL still passes untouched, without general interception');
  offset=calls.length;const transaction=await projected.connect();assert.equal(calls.length-offset,9);assert(calls.slice(offset).every(row=>row.id==='transaction'));
  state.sequences.definition[0].cache='2';offset=calls.length;await assert.rejects(()=>transaction.query(queries[1]),error=>error?.code==='ERR_ASSERTION');expectRead(offset,'transaction');
  await transaction.query('ROLLBACK');offset=calls.length;assert.deepEqual(await original.readCommerceReleasePhase2Metadata(transaction),baseline);assert.equal(calls.length-offset,45);assert(calls.slice(offset).every(row=>row.id==='transaction'));transaction.release();assert.equal(releases,1);
  // Execute the exact private control body with a SQL-only backend, never native admission.
  const makeTaskDdl=assertions=>new Function('assert','taskMetadata','verifyTaskPuzzleCatalogDelta','TASK_PUZZLE_DDL_CONTROLS','isDeepStrictEqual',
    body('taskDdlControls')+';return taskDdlControls;')(assertions,readDdlMetadata,verifyDdlDelta,delta.TASK_PUZZLE_DDL_CONTROLS,isDeepStrictEqual);
  assert.equal(delta.TASK_PUZZLE_DDL_CONTROLS.length,47);
  let ddlState,ddlOriginal,ddlClient,ddlTrace,ddlIndex,ddlTransaction,ddlFailure,ddlRejections,ddlReads,ddlVerifications,ddlReleases;
  const readDdlMetadata=async client=>{
    assert.equal(client,ddlClient,'Every metadata read stays on the connected transaction client');
    const stage=ddlTransaction?'mutated':ddlIndex<0?'before':'restored';ddlTrace.push('read:'+stage);ddlReads++;
    if(ddlFailure==='read:'+stage)throw Error('injected '+ddlFailure);
    return structuredClone(ddlState);
  };
  const verifyDdlDelta=(metadata,version,profile,flags)=>{
    ddlTrace.push('verify');ddlVerifications++;
    return delta.verifyTaskPuzzleCatalogDelta(metadata,version,profile,flags);
  };
  const ddlAssert=Object.assign((...args)=>assert(...args),assert,{rejects:async(fn,predicate)=>{
    let refusal;await assert.rejects(async()=>{try{return await fn();}catch(error){refusal=error;throw error;}},predicate);
    assert.equal(refusal.code,'ERR_ASSERTION');assert.equal(refusal.actual,false,'Live DDL refusals must not render whole catalog objects');assert.equal(refusal.expected,true);
    ddlTrace.push('reject');ddlRejections++;
  }});
  const runDdl=async(version,profile,failure=null)=>{
    ddlOriginal=fixture(version,profile).live;ddlState=structuredClone(ddlOriginal);ddlTrace=[];ddlIndex=-1;ddlTransaction=false;ddlFailure=failure;
    ddlRejections=ddlReads=ddlVerifications=ddlReleases=0;
    if(failure==='initial-delta')ddlState.sequences.definition[0].cache='2';
    ddlClient={query:async(sql,values)=>{
      assert.equal(values,undefined);ddlTrace.push(sql);
      if(failure===sql)throw Error('injected '+sql);
      if(sql==='BEGIN'){assert.equal(ddlTransaction,false);ddlTransaction=true;}
      else if(sql==='ROLLBACK'){assert.equal(ddlTransaction,true);ddlTransaction=false;ddlState=structuredClone(ddlOriginal);
        if(failure==='rollback-drift')ddlState.columns.find(row=>row.column_name==='generation').default_expression='42';}
      else{assert(ddlTransaction);ddlIndex++;assert.equal(sql,delta.TASK_PUZZLE_DDL_CONTROLS[ddlIndex]);
        if(failure==='ddl')throw Error('injected ddl');
        if(failure!=='unchanged')ddlState.columns.find(row=>row.column_name==='generation').default_expression='changed:'+ddlIndex;}
      return {rows:[]};
    },release:()=>{ddlTrace.push('release');ddlReleases++;}};
    const pool={connect:async()=>{ddlTrace.push('connect');return ddlClient;},query:()=>assert.fail('No pool query may replace the same client')};
    return makeTaskDdl(ddlAssert)(pool,version,profile);
  };
  let ddlProfiles=0;
  for(const version of [16,18])for(const profile of ['fresh','upgrade585','phase2','director']){
    assert.equal(await runDdl(version,profile),47);ddlProfiles++;
    assert.equal(ddlRejections,47);assert.equal(ddlReads,95);assert.equal(ddlVerifications,48);assert.equal(ddlReleases,1);assert.equal(ddlTransaction,false);
    assert.deepEqual(ddlState,ddlOriginal);
    assert.deepEqual(ddlTrace,['connect','read:before','verify',...delta.TASK_PUZZLE_DDL_CONTROLS.flatMap(sql=>
      ['BEGIN',sql,'read:mutated','reject','ROLLBACK','read:restored','verify']),'release'],'All47 original controls, rejection and rollback rereads run in exact order');
  }
  let ddlFailurePaths=0;
  for(const failure of ['read:before','initial-delta','BEGIN','ddl','read:mutated','unchanged','ROLLBACK','read:restored','rollback-drift']){
    let caught;try{await runDdl(18,'fresh',failure);}catch(error){caught=error;}assert(caught,'Injected failure must not pass: '+failure);
    assert.equal(ddlReleases,1);assert.equal(ddlTrace.at(-1),'release');
    const entered=!['read:before','initial-delta','BEGIN'].includes(failure);
    assert.equal(ddlTrace.filter(value=>value==='ROLLBACK').length,entered?1:0);
    if(failure!=='ROLLBACK')assert.equal(ddlTransaction,false);
    if(failure==='unchanged')assert.match(caught.message,/Missing expected rejection/);
    else if(failure==='rollback-drift'){assert.equal(caught.code,'ERR_ASSERTION');assert.equal(typeof caught.actual,'object','Positive full rollback equality remains unchanged');}
    else if(failure==='initial-delta')assert.equal(caught.code,'ERR_ASSERTION');
    else if(failure==='read:mutated'){assert.equal(caught.code,'ERR_ASSERTION');assert.match(caught.message,/Error: injected read:mutated/);}
    else assert.equal(caught.message,'injected '+failure);
    ddlFailurePaths++;
  }
  console.log(JSON.stringify({phase:'TASK_PUZZLE_COMPACT_DDL',ddlProfiles,controlsPerProfile:47,metadataReadsPerProfile:95,ddlFailurePaths,sameClientRollback:true,nativeAttempts:0}));

  console.log(JSON.stringify({phase:'TASK_PUZZLE_SCOPED_READER',profiles:8,reads,queriesPerRead:8,queryRefusals,scopedConservationRefusals,projectedQueriesPerRead:45,sameClientRollback:true,nativeAttempts:0}));
}
// Historical source comparison may evolve only above the unchanged native helpers.
// Verify all60 original immutable records before the public reader regression.
const roundGit=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8',windowsHide:true,maxBuffer:32e6});
const commerceFile='tools/commerce-deed-release-phase2-native-catalog.js';
const immutableFile='tools/enterprise-native-contract-release-inputs.js';
assert.equal(fs.readFileSync(immutableFile,'utf8').replaceAll('\r\n','\n'),roundGit('show','0992cf178fdd31144cc9758b22e06ac847e1000f:'+immutableFile),'The complete original immutable definition, including its pin set, is retained');
const immutableSha=value=>crypto.createHash('sha256').update(value).digest('hex');
assert.equal(immutableSha(JSON.stringify(immutablePredecessor)),immutablePredecessorHash);
const immutableInputs=immutablePredecessor.files.filter(({file})=>/^tools\/[^/]*native[^/]*\.js$/.test(file)||/^test\/lib\/[^/]*native[^/]*\.js$/.test(file)||file==='test/enterprise-native-guard.js');
assert.equal(immutableInputs.length,60,'The original closed predecessor protection is not reduced');
const immutableRecord=(pin,input)=>{
  assert.equal(input.head,pin.mode+' blob '+pin.blob+'\t'+pin.file,'Original immutable HEAD record: '+pin.file);
  assert.equal(input.index,pin.mode+' '+pin.blob+' 0\t'+pin.file,'Original immutable index record: '+pin.file);
  assert.equal(input.regular,true);assert.equal(input.symbolic,false);
  const lf=input.physical.replaceAll('\r\n','\n');assert(!lf.includes('\r')&&(input.physical===lf||input.physical===lf.replaceAll('\n','\r\n')));
  assert.equal(immutableSha(lf),pin.sha256,'Original immutable physical SHA: '+pin.file);
  assert.equal(crypto.createHash('sha1').update('blob '+Buffer.byteLength(lf)+'\0').update(lf).digest('hex'),pin.blob);
};
let immutableRefusals=0;
for(const pin of [...immutableInputs,{file:'tools/enterprise-deed-release-phase2-migration-catalog.js',mode:'100644',blob:'f72928e9f6db7c23601bdffdfe842a8a82124962',sha256:'d9ce65cc618b419f7be1efca0c7926d7f72cd28a21abbdc4e7f86a0f14672ef7'}]){
  const stat=fs.lstatSync(pin.file),input={head:roundGit('ls-tree','HEAD','--',pin.file).trim(),index:roundGit('ls-files','--stage','--',pin.file).trim(),physical:fs.readFileSync(pin.file,'utf8'),regular:stat.isFile(),symbolic:stat.isSymbolicLink()};
  immutableRecord(pin,input);immutableRecord(pin,{...input,physical:input.physical.replaceAll('\r\n','\n').replaceAll('\n','\r\n')});
  for(const changed of [{...input,physical:input.physical+'\n'},{...input,head:input.head.replace(pin.blob,'0'.repeat(40))},{...input,index:input.index.replace(pin.mode,'120000')},{...input,symbolic:true}]){assert.throws(()=>immutableRecord(pin,changed));immutableRefusals++;}
}
assert.equal(restoreScopedHelper(fs.readFileSync('tools/questing-ux-release-phase2-native-catalog.js','utf8')),roundGit('show','0992cf178fdd31144cc9758b22e06ac847e1000f:tools/questing-ux-release-phase2-native-catalog.js'),'Undo only the obsolete round1 enclosing view; every reviewed current586 byte is retained');
console.log(JSON.stringify({phase:'TASK_PUZZLE_ORIGINAL_NATIVE_RECORDS',immutableRecords:immutableInputs.length,restoredHelpers:2,immutableRefusals,nativeAttempts:0}));
const commerceSource=roundGit('show','52c582d7859843e02f45ed5d5c2377c996dd43da:schema.sql');
assert.equal(crypto.createHash('sha256').update(commerceSource).digest('hex'),'833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335');
for(const input of [commerceSource,commerceSource.replaceAll('\n','\r\n')])assert.equal(commerceCurrentDeedSources(input).current,commerceSource);
let commerceSourceRefusals=0;
for(const input of [commerceSource+'\n',commerceSource.slice(1),'\ufeff'+commerceSource,commerceSource.replace('\n','\r\n'),commerceSource.replace('DEFAULT 0','DEFAULT 42'),fs.readFileSync('schema.sql','utf8'),roundGit('cat-file','blob','86b671c5d6f6928ff3e66f1ad0fca5f46a7364e3'),null]){
  assert.throws(()=>commerceCurrentDeedSources(input),error=>error?.code==='ERR_ASSERTION');commerceSourceRefusals++;
}
// Execute the actual private comparison with a read-only file double for mutation controls.
// Its complete source is conserved above; imports, raw SQL and native admission are untouched.
const commerceText=fs.readFileSync(commerceFile,'utf8').replaceAll('\r\n','\n');
const commerceNodes=parse(commerceText,{ecmaVersion:'latest',sourceType:'module'}).body;
const protectedNode=commerceNodes.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='assertCommerceDeedProtectedSources');
const uniformNode=commerceNodes.find(node=>node.type==='VariableDeclaration'&&node.declarations.some(row=>row.id.name==='commerceDeedUniform'));
assert(protectedNode&&uniformNode);
const protectedPins=JSON.parse(commerceText.match(/const COMMERCE_DEED_PROTECTED=(\{.*\});/)[1]);assert.equal(Object.keys(protectedPins).length,8);
const protectedUrls=new Map(Object.keys(protectedPins).map(file=>[new URL('../'+file,import.meta.url).href,file]));
const runProtected=(target,transform)=>{
  const readOnly={readFileSync(url,encoding){assert.equal(encoding,'utf8');const file=protectedUrls.get(url.href);assert(file,'Only the eight exact protected source reads');const value=fs.readFileSync(file,encoding);return file===target?transform(value.replaceAll('\r\n','\n')):value;}};
  const body=commerceText.slice(uniformNode.start,uniformNode.end)+'\n'+commerceText.slice(protectedNode.start,protectedNode.end).replaceAll('import.meta.url',JSON.stringify(new URL('../'+commerceFile,import.meta.url).href))+'\nassertCommerceDeedProtectedSources();';
  new Function('assert','COMMERCE_DEED_PROTECTED','fs','URL','hash','deedQuestSourceBaseline',body)(assert,protectedPins,readOnly,URL,value=>crypto.createHash('sha256').update(value).digest('hex'),deedQuestSourceBaseline);
};
runProtected();let protectedSourceRefusals=0;
for(const file of Object.keys(protectedPins)){
  runProtected(file,input=>input);runProtected(file,input=>input.replaceAll('\n','\r\n'));
  for(const transform of [input=>input+'\n',input=>input.slice(1),input=>'\ufeff'+input,input=>input.replace('\n','\r\n'),input=>input.slice(0,-1),input=>input+'// unreviewed\n']){
    assert.throws(()=>runProtected(file,transform),error=>error?.code==='ERR_ASSERTION');protectedSourceRefusals++;
  }
}
console.log(JSON.stringify({phase:'TASK_PUZZLE_COMMERCE_READER_REGRESSION',publicPositives:2,commerceSourceRefusals,immutableRecords:immutableInputs.length,restoredHelpers:2,immutableRefusals,protectedInputs:8,protectedSourceRefusals,nativeAttempts:0}));
// Keep the public regression independently observable before metadata-dependent module checks.
const quest=await import('../tools/questing-ux-release-phase2-native-catalog.js');
const raw=fs.readFileSync('schema.sql','utf8');assert.throws(()=>questingCatalogSource(raw));
assert.equal(typeof quest.assertTaskPuzzlePhase2SourceInputs,'function','Current Phase2 needs a separate586 admission');
const enterprise=await import('../tools/task-puzzle-enterprise-catalog.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND'&&error.url?.endsWith('/tools/task-puzzle-enterprise-catalog.js'))return {};throw error;});
assert.equal(typeof enterprise.verifyTaskPuzzleEnterpriseCatalog,'function','Current Enterprise needs a separate586 catalog lane');
let nativeAttempts=0,refusals=0;const forbidden={query(){nativeAttempts++;throw Error('No backend may be queried by pure guards');},connect(){nativeAttempts++;throw Error('No connection may be opened by pure guards');}};
for(const fn of [()=>quest.assertTaskPuzzlePhase2SourceInputs(),()=>quest.assertTaskPuzzlePhase2SourceInputs({}),()=>quest.assertQuestingPhase2SourceInputs()]){assert.throws(fn,error=>error?.code==='ERR_ASSERTION');refusals++;}
for(const fn of [()=>enterprise.verifyTaskPuzzleEnterpriseCatalog(forbidden,'postgres://pilot_runner@127.0.0.1:35439/enterprise_native_catalog_test_123456789abc',raw),
  ()=>enterprise.verifyTaskPuzzleEnterpriseCatalog(forbidden,'postgres://pilot_runner@127.0.0.1:5432/production',raw),
  ()=>quest.createTaskPuzzleReleasePhase2MigrationCatalog(forbidden,'postgres://pilot_runner@127.0.0.1:35439/omerta_check',raw,{legacyProfile:'phase2',includeNotNull:true}),
  ()=>quest.verifyTaskPuzzleNativeBranches(forbidden,'postgres://pilot_runner@127.0.0.1:35439/omerta_check'),
  ()=>quest.verifyTaskPuzzleReleasePhase2CausalNegatives(forbidden,{},[],()=>{}),
  ()=>quest.createCommerceReleasePhase2MigrationCatalog(forbidden,'postgres://pilot_runner@127.0.0.1:35439/omerta_check',raw,{legacyProfile:'phase2',includeNotNull:true})]){await assert.rejects(fn,error=>error?.code==='ERR_ASSERTION');refusals++;}
assert.equal(nativeAttempts,0);
// Original strict585 catalog engine and pins are not silently rewritten.
const retained=execFileSync('git',['show','73d8d41dd7aec4768bd0aee9118d2a3930844aa6:tools/questing-enterprise-catalog.js']);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('tools/questing-enterprise-catalog.js','utf8').replaceAll('\r\n','\n')).digest('hex'),crypto.createHash('sha256').update(retained).digest('hex'));
console.log(JSON.stringify({phase:'TASK_PUZZLE586_ENTRY_REFUSALS',refusals,nativeAttempts,priorResultsTransferred:false}));

// Exact outer conservation is tested independently of regenerated source metadata.
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8',maxBuffer:32e6});
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const helperFile='tools/questing-ux-release-phase2-native-catalog.js';
const helperEdits=[
  ["export function assertQuestingPhase2SourceInputs() {\n  assert.equal(arguments.length, 0);", "export function assertQuestingPhase2SourceInputs() {\n  assert.equal(arguments.length, 0); return phase2SourceInputs(false);\n}\nexport function assertTaskPuzzlePhase2SourceInputs() {\n  assert.equal(arguments.length, 0); return phase2SourceInputs(true);\n}\nfunction phase2SourceInputs(taskPuzzle) {"],
  ["'tools/questing-enterprise-catalog.js', 'test/questing-ux-release-phase2-native-catalog-guard.js', caller];", "'tools/questing-enterprise-catalog.js', 'test/questing-ux-release-phase2-native-catalog-guard.js', caller,\n    ...(taskPuzzle ? ['tools/task-puzzle-native-catalog.js', 'tools/task-puzzle-enterprise-catalog.js',\n      'test/task-puzzle-native-catalog-guard.js', 'test/task-puzzle-native-integration-guard.js'] : [])];"],
  ['  assert.equal(questSha(raw), QUESTING_CATALOG_SOURCE.sha256);','  if (taskPuzzle) taskPuzzleCatalogSource(raw);\n  else assert.equal(questSha(raw), QUESTING_CATALOG_SOURCE.sha256);'],
  ['  const actual = questActualInput(input);\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);','  const actual = questActualInput(input);\n  return createQuestCatalogComparison(pool, endpoint, actual, options);\n}\nasync function createQuestCatalogComparison(pool, endpoint, actual, options) {\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);'],
  ["  const actual = questActualInput(fs.readFileSync(path.join(questRoot, 'schema.sql'), 'utf8'));\n  await assertNativeCaller(pool, endpoint, 'fresh', true);", "  const actual = questActualInput(fs.readFileSync(path.join(questRoot, 'schema.sql'), 'utf8'));\n  return verifyQuestCatalogComparison(pool, endpoint, actual);\n}\nasync function verifyQuestCatalogComparison(pool, endpoint, actual) {\n  await assertNativeCaller(pool, endpoint, 'fresh', true);"],
];
const readerImport="import { ageRemovalHistoricalInput, ageRemovalHistoricalEntry } from '../../tools/age-removal-source-transfer.js';\n";
const readerOuter="  // Actual whole bytes and Git entry qualify above; only this pure comparison uses the outer view.\n  input = ageRemovalHistoricalInput(file, input);\n  entry = ageRemovalHistoricalEntry(file, entry, 'tree');\n";
const preservedFiles=[helperFile,'test/lib/questing-ux-native-reader-source-compatibility.js','test/lib/questing-ux-director-reader-source-compatibility.js','test/lib/questing-ux-enterprise-reader-source-compatibility.js'];
let conserved=0,conservationRefusals=0;
for(const file of preservedFiles){
  const old=git('show','73d8d41dd7aec4768bd0aee9118d2a3930844aa6:'+file),text=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
  const restore=input=>{
    assert.equal(typeof input,'string');let source=input.replaceAll('\r\n','\n');assert(!source.includes('\r')&&(input===source||input===source.replaceAll('\n','\r\n')));
    if(file===helperFile){
      source=restoreScopedHelper(source);
      const marker='\n// Distinct current586 admission;';assert.equal(source.split(marker).length,2);const at=source.indexOf(marker);
      assert.equal(sha(source.slice(at)),'2f8b604cd3c6980d0a62ad11cb4bb0ebca2edfed73ecb06bf3ed4bbb1689b6e2','Exact added current admission, same-client comparison and rollback implementation');source=source.slice(0,at);
      for(const[before,after]of helperEdits.toReversed()){assert.equal(source.split(after).length,2);source=source.replace(after,()=>before);}
    }else{
      assert(source.startsWith(readerImport));source=source.slice(readerImport.length);assert.equal(source.split(readerOuter).length,2);source=source.replace(readerOuter,'');
    }
    assert.equal(source,old,'Every prior byte and protected585 assertion survives only the literal outer bridge');return true;
  };
  assert(restore(text));assert(restore(text.replaceAll('\n','\r\n')));conserved++;
  for(const bad of [text+'\n',text.slice(1),'\ufeff'+text,text.replace('\n','\r\n'),text.replace('assert.equal','assert.notEqual')]){assert.throws(()=>restore(bad));conservationRefusals++;}
}
const nativeFile='tools/enterprise-native-questing.js',oldNative=git('show','73d8d41dd7aec4768bd0aee9118d2a3930844aa6:'+nativeFile);
const support="  'tools/task-puzzle-native-catalog.js', 'tools/task-puzzle-enterprise-catalog.js',\n  'test/task-puzzle-native-catalog-guard.js', 'test/task-puzzle-native-integration-guard.js',\n";
const native=fs.readFileSync(nativeFile,'utf8').replaceAll('\r\n','\n');assert.equal(native.split(support).length,2);assert.equal(native.replace(support,''),oldNative,'All16 native tuples, ordering, capture, deadlines and cleanup remain byte-exact');
console.log(JSON.stringify({phase:'TASK_PUZZLE586_OUTER_CONSERVATION',conserved,conservationRefusals,nativeAttempts:0}));

const frozenFile='tools/enterprise-deed-release-phase2-migration-catalog.js';
const frozenRaw=fs.readFileSync(frozenFile,'utf8').replaceAll('\r\n','\n');
const frozenView=input=>deedQuestSourceBaseline(frozenFile,ageRemovalHistoricalInput(frozenFile,input));
assert.equal(sha(frozenView(frozenRaw)),'8ed9ee0e08e9bbbc25bc921ea5ec96e4de495121454b0e21857a7d318f31a49e','The missing outer reader restores exactly the unchanged historical guard hash');
for(const bad of [frozenRaw+'\n',frozenRaw.slice(1),'\ufeff'+frozenRaw,frozenRaw.replace('\n','\r\n')])assert.notEqual(sha(frozenView(bad)),'8ed9ee0e08e9bbbc25bc921ea5ec96e4de495121454b0e21857a7d318f31a49e');
console.log(JSON.stringify({phase:'TASK_PUZZLE_FROZEN_READER_BOUNDARY',positives:1,refusals:4,nativeAttempts:0}));
