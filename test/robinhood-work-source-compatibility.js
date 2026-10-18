import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { ROBINHOOD_WORK_SOURCE,ROBINHOOD_WORK_PREDECESSOR,ROBINHOOD_WORK_PHASE,ROBINHOOD_WORK_DOMAINS,
 assertRobinhoodWorkSourceTransfer,robinhoodWorkSourceBaseline } from './lib/robinhood-work-source-compatibility.js';
import { BASE_WORK_HISTORICAL_PREDECESSOR,BASE_WORK_HISTORICAL_DOMAINS,baseWorkHistoricalSourceBaseline } from './lib/base-work-source-compatibility.js';

assert.deepEqual(process.argv.slice(2),[],'Fixed two-domain TEST comparison only');
const git=(...args)=>execFileSync('git',['--no-optional-locks','--no-replace-objects',...args],{encoding:'utf8',maxBuffer:8*1024*1024});
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const blob=text=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
assert.equal(ROBINHOOD_WORK_SOURCE,'3ed66e2341bf2dbda93b7a39005040212abe1083');
assert.equal(ROBINHOOD_WORK_PREDECESSOR,'798f2f0623941d3f26413767b9c2ae3941ecf6af');
assert.match(ROBINHOOD_WORK_PHASE,/TEST historical two-domain comparison only; no runtime, native, current-source capture/);
assert.deepEqual(Object.keys(ROBINHOOD_WORK_DOMAINS),['package.json','src/server.js']);
assert(Object.isFrozen(ROBINHOOD_WORK_DOMAINS));
let positives=0,refusals=0,inverseRefusals=0;
for(const[file,pin]of Object.entries(ROBINHOOD_WORK_DOMAINS)){
 assert(Object.isFrozen(pin)&&Object.isFrozen(pin.inverses));assert.equal(pin.inverses.length,2);
 const current=git('show',ROBINHOOD_WORK_SOURCE+':'+file),baseline=git('show',ROBINHOOD_WORK_PREDECESSOR+':'+file);
 for(const[source,mode,oid,text]of[[ROBINHOOD_WORK_SOURCE,pin.sourceMode,pin.sourceBlob,current],[ROBINHOOD_WORK_PREDECESSOR,pin.baselineMode,pin.baselineBlob,baseline]]){
  assert.equal(mode,'100644');assert.equal(git('ls-tree',source,'--',file).trim(),'100644 blob '+oid+'\t'+file);assert.equal(blob(text),oid);
 }
 assert.equal(hash(current),pin.sourceSha256);assert.equal(hash(baseline),pin.baselineSha256);assert.equal(pin.contextLines,3);
 for(const value of[current,current.replaceAll('\n','\r\n'),Buffer.from(current),Buffer.from(current.replaceAll('\n','\r\n'))]){
  const checked=assertRobinhoodWorkSourceTransfer(file,value),projected=robinhoodWorkSourceBaseline(file,value);
  assert.equal(checked.baselineText,baseline);assert.equal(checked.sourceRevision,ROBINHOOD_WORK_SOURCE);assert.equal(checked.predecessorRevision,ROBINHOOD_WORK_PREDECESSOR);assert.equal(checked.sourceOnly,true);assert.equal(checked.nativeAdmission,false);
  assert.equal(Buffer.isBuffer(projected),Buffer.isBuffer(value));assert.equal(projected.toString(),baseline);
  const final=baseWorkHistoricalSourceBaseline(file,value);assert.equal(final.toString(),git('show',BASE_WORK_HISTORICAL_PREDECESSOR+':'+file));positives++;
 }
 assert.strictEqual(robinhoodWorkSourceBaseline(file,baseline),baseline);assert.equal(baseWorkHistoricalSourceBaseline(file,baseline).toString(),git('show',BASE_WORK_HISTORICAL_PREDECESSOR+':'+file));positives++;
 const reject=value=>{assert.strictEqual(robinhoodWorkSourceBaseline(file,value),value);assert.throws(()=>assertRobinhoodWorkSourceTransfer(file,value));refusals++;};
 const mutations=[current+'\n// unknown source',current.slice(1),'\ufeff'+current,current+'\0',current.replace('\n','\r\n'),current.replace('\n','\r'),current.replace(current[0],'\ud800'),Buffer.concat([Buffer.from([0xff]),Buffer.from(current)]),null,undefined,42,{},[],baseline];
 for(const h of pin.inverses){assert(Object.isFrozen(h));assert.equal(current.split(h.current).length,2);mutations.push(current.replace(h.current,()=>h.baseline));mutations.push(current+h.current);}
 for(const value of mutations)reject(value);
 assert.throws(()=>{pin.sourceSha256='f'.repeat(64);});refusals++;
 // Test inverse guards of the actual assertion after its exact-source precondition.
 // These mutable records are confined to this isolated TEST model; production pins stay frozen.
 const checkedInverse=mutate=>{const model=JSON.parse(JSON.stringify(ROBINHOOD_WORK_DOMAINS));mutate(model[file]);const actual=vm.runInNewContext('('+assertRobinhoodWorkSourceTransfer.toString()+')',{
  assert,Buffer,ROBINHOOD_WORK_DOMAINS:model,ROBINHOOD_WORK_SOURCE,ROBINHOOD_WORK_PREDECESSOR,ROBINHOOD_WORK_PHASE,hash,blob,
  candidate:(domain,input)=>{assert.equal(domain,file);assert.equal(input,current);return current;}
 },{timeout:1000});assert.throws(()=>actual(file,current));inverseRefusals++;};
 for(const mutate of[p=>{p.inverses[0].current='';},p=>{p.inverses[0].current+='not-present';},p=>{p.inverses[0].baseline+='unknown';},p=>{p.inverses.pop();},p=>{p.inverses.push({...p.inverses[0]});},p=>{p.baselineSha256='f'.repeat(64);},p=>{p.baselineBlob='f'.repeat(40);}])checkedInverse(mutate);
 const historical=git('show',BASE_WORK_HISTORICAL_PREDECESSOR+':'+file);
 assert.equal(BASE_WORK_HISTORICAL_DOMAINS[file].baselineSha256,hash(historical));
 assert.equal(BASE_WORK_HISTORICAL_DOMAINS[file].baselineBlob,blob(historical));
}
for(const file of['src/worker.js','../src/server.js','SRC/server.js','package.json?']){const input='unknown';assert.strictEqual(robinhoodWorkSourceBaseline(file,input),input);assert.throws(()=>assertRobinhoodWorkSourceTransfer(file,input));refusals++;}
console.log('robinhood-work-source-compatibility PASS',JSON.stringify({positives,refusals,inverseRefusals,domains:2,source:ROBINHOOD_WORK_SOURCE,predecessor:ROBINHOOD_WORK_PREDECESSOR,sourceOnly:true,nativeAdmission:false,reconstructedSourceExecuted:false,network:0,PG:0,financialActivation:false}));
