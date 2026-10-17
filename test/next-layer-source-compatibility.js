import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';
import {enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import {marketOperationsSourceBaseline} from '../tools/market-operations-source-compatibility.js';
import {deedOverMarketSourceBaseline} from '../tools/deed-market-source-compatibility.js';
// Only the exact market-source inverse precedes this unchanged historical source proof. Native admission stays raw.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deedQuestSourceBaseline} from '../tools/deed-quest-source-transfer.js';
import {execFileSync} from 'node:child_process';
import {NEXT_LAYER_SOURCE_REVISION,NEXT_LAYER_SOURCE_PREDECESSOR,NEXT_LAYER_SOURCE_PHASE,
  NEXT_LAYER_SOURCE_DOMAINS,assertNextLayerSourceTransfer,nextLayerSourceBaseline} from '../tools/next-layer-source-compatibility.js';
import {releasePhase2MigrationPredecessor,nextFiveNativePredecessor} from '../tools/next-five-release-phase2-migration-catalog.js';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32e6});
assert.equal(NEXT_LAYER_SOURCE_PHASE,'exact-source-transfer-only; no native, migration, financial or deployment clearance');
assert.equal(NEXT_LAYER_SOURCE_REVISION,'3c6a1c7cdd747ef80ae8ad246126019f4c18afd0');
assert.equal(NEXT_LAYER_SOURCE_PREDECESSOR,'2a057d375cb8f8d94ec30c8e4559832b5be63011');
assert.deepEqual(Object.keys(NEXT_LAYER_SOURCE_DOMAINS),['package.json','schema.sql','src/agentgateway.js','src/depotacquisitionruntime.js','src/equipmentrentals.js','src/invariants.js','src/server.js','src/social/estate.js','test/lib/phase2-architecture-upgrade-catalog.json','test/phase2-postgres.js','test/director-migration.js','.github/workflows/ci.yml','test/gates.js','test/coldstart.js','src/workertraining.js','test/company-workforce-contracts.js']);
let negatives=0,hunks=0;
for(const[file,pin]of Object.entries(NEXT_LAYER_SOURCE_DOMAINS)){
  const current=git('show',NEXT_LAYER_SOURCE_REVISION+':'+file),prior=git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file);
  assert.equal(marketOperationsSourceBaseline(file,deedQuestSourceBaseline(file,deedOverMarketSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')))))).replaceAll('\r\n','\n'),current,'Complete actual source is independently pinned');
  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_REVISION+':'+file).trim(),pin.currentBlob);
  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file).trim(),pin.baselineBlob);
  const actual=[];let chunk;
  for(const line of git('diff','--no-ext-diff','--unified='+pin.contextLines,pin.baselineBlob,pin.currentBlob).split('\n')){
    if(line.startsWith('@@')){chunk={current:'',baseline:''};actual.push(chunk);}
    else if(chunk&&/^[ +\-]/.test(line)){if(line[0]!=='-')chunk.current+=line.slice(1)+'\n';if(line[0]!=='+')chunk.baseline+=line.slice(1)+'\n';}
  }
  assert.deepEqual(actual,pin.inverses,'Only actual whole Git diff contexts may be reversed');
  for(const text of[current,current.replaceAll('\n','\r\n')]){
    assert.equal(assertNextLayerSourceTransfer(file,text).baselineText,prior);
    assert.equal(nextLayerSourceBaseline(file,text),prior);
  }
  const reject=text=>{assert.notEqual(text,current);assert.throws(()=>assertNextLayerSourceTransfer(file,text));assert.equal(nextLayerSourceBaseline(file,text),text);negatives++;};
  for(const text of[current+'\n// unknown\n',current.slice(1),'\ufeff'+current,current.replace(/\S/,'?'),current.replace('\n','\r\n')])reject(text);
  for(const h of pin.inverses){
    reject(current.replace(h.current,''));reject(current.replace(h.current,()=>h.current+h.current));
    reject(current.replace(h.current,()=>h.baseline));reject(current.replace(h.current,()=>h.current.replace(/\S/,'?')));hunks++;
  }
  if(pin.inverses.length>1){const[a,b]=pin.inverses;reject(current.replace(a.current,'@@next-layer-test@@').replace(b.current,a.current).replace('@@next-layer-test@@',b.current));}
}
for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){
  const text='unknown\r\nbytes\n';assert.throws(()=>assertNextLayerSourceTransfer(file,text));assert.equal(nextLayerSourceBaseline(file,text),text);negatives++;
}
const file='test/lib/phase2-architecture-upgrade-catalog.json',current=JSON.parse(marketOperationsSourceBaseline(file,enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8'))));
const prior=JSON.parse(git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file));
assert.equal(prior.added.length,1243);assert.equal(current.added.length,1332);
assert.deepEqual(current.added.slice(0,1243),prior.added);assert.deepEqual(current.removed,prior.removed);
for(const[table,columns]of Object.entries(prior.notNullColumns))assert.deepEqual(current.notNullColumns[table],columns);
const added=Object.keys(current.notNullColumns).filter(name=>!Object.hasOwn(prior.notNullColumns,name));
assert.equal(added.length,8);assert.equal(added.reduce((n,name)=>n+current.notNullColumns[name].length,0),78);
const schema=fs.readFileSync('schema.sql','utf8');
assert.throws(()=>releasePhase2MigrationPredecessor(schema),'Raw536 source does not enter the old528 native profile');
assert.throws(()=>nextFiveNativePredecessor(schema),'Source transfer never creates historical native admission');
console.log(`Next-layer source-only proof PASS:16 full domains/${hunks} immutable inverses/${negatives} refusals; all1243 prior rows preserved plus89/78; native admission remains separate`);
