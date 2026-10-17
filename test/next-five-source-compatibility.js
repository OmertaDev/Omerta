import {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from "../tools/commerce-current-enterprise-source-compatibility.js";
import {enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';
import {nextLayerSourceBaseline} from '../tools/next-layer-source-compatibility.js';
import fs from 'node:fs';
import { deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {NEXT_FIVE_SOURCE_REVISION,NEXT_FIVE_SOURCE_PREDECESSOR,NEXT_FIVE_SOURCE_PHASE,
 NEXT_FIVE_SOURCE_DOMAINS,assertNextFiveSourceTransfer,nextFiveSourceBaseline} from '../tools/next-five-source-compatibility.js';
import {fifthBatchMigrationSchema} from '../tools/rc1-fifth-batch-source-compatibility.js';
import {equipmentEconomyMigrationProjection} from './lib/equipment-economy-migration-catalog.js';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32e6});
assert.equal(NEXT_FIVE_SOURCE_PHASE,'exact-source-transfer-only; no native, migration, financial or deployment clearance');
assert.deepEqual(Object.keys(NEXT_FIVE_SOURCE_DOMAINS),['package.json','schema.sql','src/agentgateway.js','src/companyrestructuring.js','src/depotacquisitionruntime.js','src/equipmentrentals.js','src/invariants.js','src/server.js','src/social/estate.js','test/lib/phase2-architecture-upgrade-catalog.json']);
let negatives=0,hunks=0;
for(const[file,pin]of Object.entries(NEXT_FIVE_SOURCE_DOMAINS)){
 const current=git('show',NEXT_FIVE_SOURCE_REVISION+':'+file),prior=git('show',NEXT_FIVE_SOURCE_PREDECESSOR+':'+file);
 assert.equal(nextLayerSourceBaseline(file,deedQuestSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseOverRootSourceBaseline(file,(hasCommerceCurrentEnterpriseSource(file)?commerceOverCurrentEnterpriseSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):fs.readFileSync(file,'utf8')))))).replaceAll('\r\n','\n'),current,'Complete actual first-five source is independently pinned');
 const actual=[];let chunk;
 for(const line of git('diff','--no-ext-diff','--unified='+pin.contextLines,pin.baselineBlob,pin.currentBlob).split('\n')){
  if(line.startsWith('@@')){chunk={current:'',baseline:''};actual.push(chunk);}
  else if(chunk&&/^[ +\-]/.test(line)){if(line[0]!=='-')chunk.current+=line.slice(1)+'\n';if(line[0]!=='+')chunk.baseline+=line.slice(1)+'\n';}
 }
 assert.deepEqual(actual,pin.inverses,'Only independently recomputed actual Git inverses');
 for(const text of[current,current.replaceAll('\n','\r\n')]){
  assert.equal(assertNextFiveSourceTransfer(file,text).baselineText,prior);
  assert.equal(nextFiveSourceBaseline(file,text),prior);
 }
 const reject=text=>{assert.notEqual(text,current);assert.throws(()=>assertNextFiveSourceTransfer(file,text));assert.equal(nextFiveSourceBaseline(file,text),text);negatives++;};
 for(const text of[current+'\n// drift\n',current.slice(1),'\ufeff'+current,current.replace(/\S/,'?'),current.replace('\n','\r\n')])reject(text);
 for(const inverse of pin.inverses){
  reject(current.replace(inverse.current,''));reject(current.replace(inverse.current,()=>inverse.current+inverse.current));
  reject(current.replace(inverse.current,()=>inverse.baseline));reject(current.replace(inverse.current,()=>inverse.current.replace(/\S/,'?')));hunks++;
 }
 if(pin.inverses.length>1){const[a,b]=pin.inverses;reject(current.replace(a.current,'@@first-five-test@@').replace(b.current,a.current).replace('@@first-five-test@@',b.current));}
}
for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){
 const text='unknown\r\nbytes\n';assert.throws(()=>assertNextFiveSourceTransfer(file,text));assert.equal(nextFiveSourceBaseline(file,text),text);negatives++;
}
const file='test/lib/phase2-architecture-upgrade-catalog.json',currentCatalog=JSON.parse(nextLayerSourceBaseline(file,enterpriseOverRootSourceBaseline(file,(hasCommerceCurrentEnterpriseSource(file)?commerceOverCurrentEnterpriseSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):fs.readFileSync(file,'utf8')))));
const oldCatalog=JSON.parse(git('show',NEXT_FIVE_SOURCE_PREDECESSOR+':'+file));
assert.equal(oldCatalog.added.length,1153);assert.equal(currentCatalog.added.length,1243);
assert.deepEqual(currentCatalog.added.slice(0,1153),oldCatalog.added);assert.deepEqual(currentCatalog.removed,oldCatalog.removed);
for(const[table,columns]of Object.entries(oldCatalog.notNullColumns))assert.deepEqual(currentCatalog.notNullColumns[table],columns);
const added=Object.keys(currentCatalog.notNullColumns).filter(name=>!Object.hasOwn(oldCatalog.notNullColumns,name));
assert.equal(added.length,11);assert.equal(added.reduce((n,name)=>n+currentCatalog.notNullColumns[name].length,0),90);
const schema=fs.readFileSync('schema.sql','utf8');
assert.equal(fifthBatchMigrationSchema(schema),schema,'Source-only reconstruction never admits raw new source to historical native entry');
assert.throws(()=>equipmentEconomyMigrationProjection(schema,{constraints:[]}),'Actual new native adapter must prove all eleven new tables first');
console.log(`First-five exact source-only envelope PASS: ${Object.keys(NEXT_FIVE_SOURCE_DOMAINS).length} full domains, ${hunks} immutable inverse hunks, ${negatives} rejecting controls; historical1153 retained plus90/90 literal catalog bindings; no native/release/activation clearance`);
