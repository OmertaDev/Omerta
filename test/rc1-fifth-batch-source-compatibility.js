import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';
import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import {nextFiveSourceBaseline} from '../tools/next-five-source-compatibility.js';
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
const files=['schema.sql','src/agentgateway.js','src/invariants.js','src/server.js','src/social/estate.js','src/worker.js','package.json'];
assert.deepEqual(Object.keys(O.FIFTH_BATCH_SOURCE_DOMAINS),files);
assert.equal(O.FIFTH_BATCH_SOURCE_REVISION,'ce717fa30b35395eb38bbca9ea5dc06dd4aeb8a4');assert.equal(O.FIFTH_BATCH_SOURCE_PREDECESSOR,'bc7a40f3fe56d980724f695a52ef3b559911e4a4');
let negatives=0,hunks=0,packageNegatives=0,packageHunks=0;
const oldHelper=git('show','ce717fa30b35395eb38bbca9ea5dc06dd4aeb8a4:tools/rc1-fifth-batch-source-compatibility.js');
const oldMaps=JSON.parse(oldHelper.slice(oldHelper.indexOf('Object.freeze(')+'Object.freeze('.length,oldHelper.indexOf('\n});\nexport function assertFifthBatchSourceTransfer')+2));
assert.deepEqual(Object.fromEntries(Object.entries(O.FIFTH_BATCH_SOURCE_DOMAINS).filter(([file])=>file!=='package.json')),oldMaps,'All six historical maps/inverse hunks/pins remain unchanged');
for(const [file,d] of Object.entries(O.FIFTH_BATCH_SOURCE_DOMAINS)){
 const beforeNegatives=negatives,beforeHunks=hunks;
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
 if(file==='package.json'){packageNegatives=negatives-beforeNegatives;packageHunks=hunks-beforeHunks;}
}
for(const file of ['src/unknown.js','schema.sql.extra','test/lib/phase2-architecture-upgrade-catalog.json','knowledge/generated/graph.json']){const text='unknown\r\nbytes\n';assert.throws(()=>O.assertFifthBatchSourceTransfer(file,text));assert.equal(O.fifthBatchSourceBaseline(file,text),text);negatives++;}
const schema=git('show',O.FIFTH_BATCH_SOURCE_REVISION+':schema.sql'),metadata={constraints:[{table_name:'item_events',name:'item_event_kind',type:'c',validated:true}]};
for(const text of [schema,schema.replaceAll('\n','\r\n')]){const p=equipmentEconomyMigrationProjection(text,metadata);const rows=[{table_name:'item_events',name:'item_event_kind',definition:EQUIPMENT_EVENT_KIND_CURRENT},{table_name:'territory_economics_sources',name:'retained',definition:'UNIQUE (id)'}];assert.deepEqual(p.normalize(rows).slice(1),rows.slice(1));}
for(const bad of [schema+'\n','\ufeff'+schema,schema.replace('\n','\r\n'),schema.replace('commercial_disputes','unknown_disputes')]){assert.equal(O.fifthBatchMigrationSchema(bad),bad);assert.throws(()=>equipmentEconomyMigrationProjection(bad,metadata));negatives++;}
const catalog=JSON.parse(nextFiveSourceBaseline('test/lib/phase2-architecture-upgrade-catalog.json',fs.readFileSync('test/lib/phase2-architecture-upgrade-catalog.json','utf8')));const tables=["economic_intelligence_publications","economic_intelligence_purchases","economic_intelligence_requests","agent_operating_memory_policies","agent_operating_memory_facts","agent_operating_memory_requests","funded_external_work_jobs","funded_external_work_events","funded_external_work_requests","management_teams","management_team_plans","management_team_requests","management_team_autonomy_grants","strategy_laboratories","strategy_laboratory_arms","strategy_laboratory_sources","strategy_laboratory_requests"];
assert.equal(catalog.added.filter(r=>tables.includes(r.table_name)).length,105);assert.equal(tables.reduce((n,t)=>n+catalog.notNullColumns[t].length,0),152);assert.equal(catalog.added.length,1153);
console.log('FIFTH source transfer PASS: 7 literal domains, '+hunks+' actual Git inverse hunks, '+negatives+' negative controls; complete FIRST/SECOND/THIRD composition and actual City/Deed/Franchise rejection; 17/105/152 native bindings retained, source-only');

// Legacy EOL normalization is intentionally unchanged; substantive full-caller drift must still refuse.
const worldFiles=['src/server.js','src/worker.js'];
const worldRead=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String(continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8')))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))).replaceAll('\r\n','\n');
await verifyWorldRecoverySources({sourceRevision:O.FIFTH_BATCH_SOURCE_REVISION,readFile:worldRead});
let worldNegatives=0;
for(const file of worldFiles){const text=worldRead(file),d=O.FIFTH_BATCH_SOURCE_DOMAINS[file];const bads=[text+'\n// unknown substantive change\n',text.slice(1),text.replace(/\S/,'?')];for(const h of d.inverses)bads.push(text.replace(h.current,''),text.replace(h.current,()=>h.current+h.current),text.replace(h.current,()=>h.current.replace(/\S/,'?')));for(const bad of bads){await assert.rejects(()=>verifyWorldRecoverySources({sourceRevision:O.FIFTH_BATCH_SOURCE_REVISION,readFile:f=>f===file?bad:worldRead(f)}),file+' substantive mutation index '+bads.indexOf(bad));worldNegatives++;}}
console.log('Actual world recovery substantive rejection PASS: '+worldNegatives+' changed/unknown/missing/duplicate-context controls; pre-existing mixed-EOL normalization limit retained.');

const priorCatalog=JSON.parse(git('show',O.FIFTH_BATCH_SOURCE_PREDECESSOR+':test/lib/phase2-architecture-upgrade-catalog.json'));
assert.equal(priorCatalog.added.length,1048);assert.deepEqual(catalog.added.slice(0,1048),priorCatalog.added);for(const [table,columns] of Object.entries(priorCatalog.notNullColumns))assert.deepEqual(catalog.notNullColumns[table],columns);
console.log('FIFTH native catalog binding PASS: all prior1048 constraint rows and every original NOT NULL definition unchanged; exact17/105/152 additions retained. Exact reviewed pending predecessor package transfer retained; deployed predecessor remains coordinator-owned.');

assert.equal(hunks-packageHunks,16);assert.equal(negatives-packageNegatives,124,'All original six-domain negatives retained');assert.equal(worldNegatives,18);
const packageCurrent=git('show',O.FIFTH_BATCH_SOURCE_REVISION+':package.json'),packagePrior=git('show',O.FIFTH_BATCH_SOURCE_PREDECESSOR+':package.json'),scripts=JSON.parse(packageCurrent).scripts;
assert.equal(scripts['test:company-autonomy:postgres'],'node tools/company-autonomy-native.js');
assert.equal(scripts['test:company-autonomy'].split(' && ').filter(command=>!command.includes('rc1-fifth-batch-source-compatibility')).length,14);
assert(scripts['build:funded-work-artifact'].includes('v5.6.1.tar.gz'));
// Preserve the immutable historical package evidence, including its repaired defect.
assert(scripts['build:funded-work-artifact'].endsWith('forge build --root omerta-contracts omerta-contracts/src/market-v2/OmertaWorkEscrowV2.sol'));
const actualScripts=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).scripts;
assert(actualScripts['build:funded-work-artifact'].endsWith('forge build --root omerta-contracts src/market-v2/OmertaWorkEscrowV2.sol'));
assert(!actualScripts['build:funded-work-artifact'].includes('omerta-contracts omerta-contracts/'));
const packageMutations=[
 packageCurrent.replace('node test/rc1-fourth-batch-source-compatibility.js','node test/unknown-command.js'),
 packageCurrent.replace('node test/rc1-fifth-batch-source-compatibility.js && ',''),
 packageCurrent.replace('node test/company-autonomy-fixture-guards.js && ',''),
 packageCurrent.replace('node test/fundedworkescrowadapter.js && ',''),
 packageCurrent.replace('node test/company-autonomy-contracts.js --laboratories','node test/company-autonomy-contracts.js'),
 packageCurrent.replace('node tools/company-autonomy-native.js','node tools/company-autonomy-native.js --tail'),
 packageCurrent.replace('node tools/company-autonomy-native.js','node tools/company-autonomy-native.js --skip-refill'),
 packageCurrent.replace('v5.6.1.tar.gz','master.tar.gz'),
 packageCurrent.replace('forge build --root omerta-contracts','cp fake-artifact.json omerta-contracts/out'),
 packageCurrent.replace('node test/gates.js','node test/gates.js --waive-refill'),
];
for(const bad of packageMutations){assert.notEqual(bad,packageCurrent);assert.throws(()=>O.assertFifthBatchSourceTransfer('package.json',bad));for(const normalize of [O.fifthBatchSourceBaseline,fourthBatchSourceBaseline,thirdBatchSourceBaseline,secondBatchSourceBaseline,firstBatchSourceBaseline])assert.equal(normalize('package.json',bad),bad,'Unknown or incomplete command/refill admission remains untouched');}
for(const normalize of [fourthBatchSourceBaseline,thirdBatchSourceBaseline,secondBatchSourceBaseline,firstBatchSourceBaseline])assert.equal(normalize('package.json',packageCurrent),normalize('package.json',packagePrior));
console.log('Exact package transfer PASS: two Git hunks, fulltext/SHA/blob current/pendingIV; preserved6/16/124/world18 plus16 package corpus and10 command/compiler/refill negatives, all old package compositions');

for(const[normalize,predecessor]of [
 [fourthBatchSourceBaseline,'90fed962b73a6e20717af4c89f4691d42fb70a1b'],
 [thirdBatchSourceBaseline,'62954ecd2f64899641af41f1d2d047d0ed07efa4'],
 [secondBatchSourceBaseline,'9adc01bea4963b89f12419126bd91bb5e7d57a55'],
 [firstBatchSourceBaseline,'f254c64a54a019665d7a516d382d56b46f2dcd82'],
])assert.equal(normalize('package.json',packageCurrent),git('show',predecessor+':package.json'),'Complete immutable predecessor package at every historical hop');
console.log('Package full predecessor reconstruction PASS at every immutable FOURTH/THIRD/SECOND/FIRST hop.');
