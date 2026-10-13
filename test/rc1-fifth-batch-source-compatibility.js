import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as O from '../tools/rc1-fifth-batch-source-compatibility.js';
import { verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';
import { firstBatchSourceBaseline } from '../tools/rc1-first-batch-source-compatibility.js';
import { secondBatchSourceBaseline } from '../tools/rc1-second-batch-source-compatibility.js';
import { fourthBatchSourceBaseline } from '../tools/rc1-fourth-batch-source-compatibility.js';
import { thirdBatchSourceBaseline } from '../tools/rc1-third-batch-source-compatibility.js';
import { assertCitySourceTransfer, assertDeedBacklogCompatibility, assertFranchiseSourceTransfer } from '../tools/rc1-deed-source-compatibility.js';
import { equipmentEconomyMigrationProjection, EQUIPMENT_EVENT_KIND_CURRENT } from './lib/equipment-economy-migration-catalog.js';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
const files=['schema.sql','src/agentgateway.js','src/invariants.js','src/server.js','src/social/estate.js','src/worker.js'];
assert.deepEqual(Object.keys(O.FIFTH_BATCH_SOURCE_DOMAINS),files);
assert.equal(O.FIFTH_BATCH_SOURCE_REVISION,'78d4a1ee0cec79ed296c37f5043197fcdc9836ab');assert.equal(O.FIFTH_BATCH_SOURCE_PREDECESSOR,'af4fc044926471457f71071e49045c4a8ccb781e');
let negatives=0,hunks=0;
for(const [file,d] of Object.entries(O.FIFTH_BATCH_SOURCE_DOMAINS)){
 const current=git('show',O.FIFTH_BATCH_SOURCE_REVISION+':'+file),prior=git('show',O.FIFTH_BATCH_SOURCE_PREDECESSOR+':'+file);
 for(const text of [current,current.replaceAll('\n','\r\n')]){
  assert.equal(O.assertFifthBatchSourceTransfer(file,text).baselineText,prior);
  assert.equal(O.fifthBatchSourceBaseline(file,text),prior);
  for(const baseline of [firstBatchSourceBaseline,secondBatchSourceBaseline,thirdBatchSourceBaseline,fourthBatchSourceBaseline])assert.equal(baseline(file,text),baseline(file,prior));
 }
 const actual=[];let chunk=null;
 for(const line of git('diff','--no-ext-diff','--unified=3',O.FIFTH_BATCH_SOURCE_PREDECESSOR,O.FIFTH_BATCH_SOURCE_REVISION,'--',file).split('\n')){
  if(line.startsWith('@@')){chunk={current:'',baseline:''};actual.push(chunk);}else if(chunk){if(line[0]==='+')chunk.current+=line.slice(1)+'\n';else if(line[0]==='-')chunk.baseline+=line.slice(1)+'\n';else if(line[0]===' '){chunk.current+=line.slice(1)+'\n';chunk.baseline+=line.slice(1)+'\n';}}
 }
 assert.deepEqual(d.inverses,actual,'Actual immutable Git inverse hunks only');
 const reject=(text,chain=false)=>{assert.throws(()=>O.assertFifthBatchSourceTransfer(file,text));assert.equal(O.fifthBatchSourceBaseline(file,text),text);if(chain)for(const baseline of [firstBatchSourceBaseline,secondBatchSourceBaseline,thirdBatchSourceBaseline,fourthBatchSourceBaseline])assert.equal(baseline(file,text),text);if(chain)for(const guard of [assertCitySourceTransfer,assertDeedBacklogCompatibility,assertFranchiseSourceTransfer])assert.throws(()=>guard(file,text));negatives++;};
 for(const bad of [current+'\n// drift\n',current.slice(1),current.replace(/\S/,'?'),'\ufeff'+current,current.replace('\n','\r\n')])reject(bad,true);
 for(const h of d.inverses){hunks++;reject(current.replace(h.current,''));reject(current.replace(h.current,()=>h.current+h.current));reject(current.replace(h.current,()=>h.baseline));reject(current.replace(h.current,()=>h.current.replace(/\S/,'?')));const lines=h.current.trimEnd().split('\n');if(lines.length>1)reject(current.replace(h.current,()=>lines.reverse().join('\n')+'\n'));}
 if(d.inverses.length>1){const a=d.inverses[0].current,b=d.inverses[1].current;reject(current.replace(a,'@@fifth-test@@').replace(b,a).replace('@@fifth-test@@',b));}
}
for(const file of ['src/unknown.js','schema.sql.extra','test/lib/phase2-architecture-upgrade-catalog.json','knowledge/generated/graph.json']){const text='unknown\r\nbytes\n';assert.throws(()=>O.assertFifthBatchSourceTransfer(file,text));assert.equal(O.fifthBatchSourceBaseline(file,text),text);negatives++;}
const schema=git('show',O.FIFTH_BATCH_SOURCE_REVISION+':schema.sql'),metadata={constraints:[{table_name:'item_events',name:'item_event_kind',type:'c',validated:true}]};
for(const text of [schema,schema.replaceAll('\n','\r\n')]){const p=equipmentEconomyMigrationProjection(text,metadata);const rows=[{table_name:'item_events',name:'item_event_kind',definition:EQUIPMENT_EVENT_KIND_CURRENT},{table_name:'territory_economics_sources',name:'retained',definition:'UNIQUE (id)'}];assert.deepEqual(p.normalize(rows).slice(1),rows.slice(1));}
for(const bad of [schema+'\n','\ufeff'+schema,schema.replace('\n','\r\n'),schema.replace('commercial_disputes','unknown_disputes')]){assert.equal(O.fifthBatchMigrationSchema(bad),bad);assert.throws(()=>equipmentEconomyMigrationProjection(bad,metadata));negatives++;}
const catalog=JSON.parse(fs.readFileSync('test/lib/phase2-architecture-upgrade-catalog.json'));const tables=["economic_intelligence_publications","economic_intelligence_purchases","economic_intelligence_requests","agent_operating_memory_policies","agent_operating_memory_facts","agent_operating_memory_requests","funded_external_work_jobs","funded_external_work_events","funded_external_work_requests","management_teams","management_team_plans","management_team_requests","management_team_autonomy_grants","strategy_laboratories","strategy_laboratory_arms","strategy_laboratory_sources","strategy_laboratory_requests"];
assert.equal(catalog.added.filter(r=>tables.includes(r.table_name)).length,105);assert.equal(tables.reduce((n,t)=>n+catalog.notNullColumns[t].length,0),152);assert.equal(catalog.added.length,1153);
console.log('FIFTH source transfer PASS: 6 literal domains, '+hunks+' actual Git inverse hunks, '+negatives+' negative controls; complete FIRST/SECOND/THIRD composition and actual City/Deed/Franchise rejection; 17/105/152 native bindings retained, source-only');

// Legacy EOL normalization is intentionally unchanged; substantive full-caller drift must still refuse.
const worldFiles=['src/server.js','src/worker.js'];
const worldRead=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
await verifyWorldRecoverySources({sourceRevision:O.FIFTH_BATCH_SOURCE_REVISION,readFile:worldRead});
let worldNegatives=0;
for(const file of worldFiles){const text=worldRead(file),d=O.FIFTH_BATCH_SOURCE_DOMAINS[file];const bads=[text+'\n// unknown substantive change\n',text.slice(1),text.replace(/\S/,'?')];for(const h of d.inverses)bads.push(text.replace(h.current,''),text.replace(h.current,()=>h.current+h.current),text.replace(h.current,()=>h.current.replace(/\S/,'?')));for(const bad of bads){await assert.rejects(()=>verifyWorldRecoverySources({sourceRevision:O.FIFTH_BATCH_SOURCE_REVISION,readFile:f=>f===file?bad:worldRead(f)}),file+' substantive mutation index '+bads.indexOf(bad));worldNegatives++;}}
console.log('Actual world recovery substantive rejection PASS: '+worldNegatives+' changed/unknown/missing/duplicate-context controls; pre-existing mixed-EOL normalization limit retained.');

const priorCatalog=JSON.parse(git('show',O.FIFTH_BATCH_SOURCE_PREDECESSOR+':test/lib/phase2-architecture-upgrade-catalog.json'));
assert.equal(priorCatalog.added.length,1048);assert.deepEqual(catalog.added.slice(0,1048),priorCatalog.added);for(const [table,columns] of Object.entries(priorCatalog.notNullColumns))assert.deepEqual(catalog.notNullColumns[table],columns);
console.log('FIFTH native catalog binding PASS: all prior1048 constraint rows and every original NOT NULL definition unchanged; exact17/105/152 additions retained. Package final pin remains coordinator-pending.');
