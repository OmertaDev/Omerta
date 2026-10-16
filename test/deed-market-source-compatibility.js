// Pure source junction proof. No game runtime, DB adapter or PG import.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
 DEED_MARKET_SOURCE_REVISION,DEED_OVER_MARKET_SOURCE_PREDECESSOR,MARKET_OVER_DEED_SOURCE_PREDECESSOR,
 DEED_MARKET_SOURCE_PHASE,DEED_OVER_MARKET_SOURCE_DOMAINS,MARKET_OVER_DEED_SOURCE_DOMAINS,DEED_MARKET_PRESERVED_FAMILIES,
 assertDeedOverMarketSourceTransfer,deedOverMarketSourceBaseline,isDeedOverMarketSource,
 assertMarketOverDeedSourceTransfer,marketOverDeedSourceBaseline,isMarketOverDeedSource
} from '../tools/deed-market-source-compatibility.js';
assert.equal(process.argv.length,2,'Source-only default unit has no filtered/native mode');
assert.match(DEED_MARKET_SOURCE_REVISION,/^[a-f0-9]{40}$/,'UNBOUND generator output is required');
const ROOT=fileURLToPath(new URL('../',import.meta.url)),git=(...args)=>execFileSync('git',['-C',ROOT,...args],{windowsHide:true,encoding:'utf8',maxBuffer:16*1024*1024,timeout:30000});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),blob=s=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const deedFiles=['package.json','schema.sql','src/agentgateway.js','src/content/phase1.js','src/content/phase1-policy.js','src/content/city-quest-presentation.js','src/db.js','src/deeds.js','src/explore.js','tools/release-source-transfer.js','test/gates.js','.github/workflows/ci.yml','test/phase2-postgres.js'];
const marketFiles=['package.json','schema.sql','src/agentgateway.js','src/commissionedcrafting.js','src/companylogisticshubs.js','src/companyproduction.js','src/depotacquisitionruntime.js','src/equipmentrentals.js','src/invariants.js','src/multihopcourier.js','src/server.js','src/social/estate.js','test/lib/phase2-architecture-upgrade-catalog.json','test/phase2-postgres.js','test/director-migration.js','.github/workflows/ci.yml','test/gates.js','tools/graph.js','tools/next-layer-graph-helpers.js','test/migrate.js'];
const families=[
 [DEED_OVER_MARKET_SOURCE_DOMAINS,DEED_OVER_MARKET_SOURCE_PREDECESSOR,deedFiles,assertDeedOverMarketSourceTransfer,deedOverMarketSourceBaseline,isDeedOverMarketSource],
 [MARKET_OVER_DEED_SOURCE_DOMAINS,MARKET_OVER_DEED_SOURCE_PREDECESSOR,marketFiles,assertMarketOverDeedSourceTransfer,marketOverDeedSourceBaseline,isMarketOverDeedSource]
];
let inverses=0,refusals=0;
for(const[domains,predecessor,files,transfer,baseline,isSource]of families){
 assert.deepEqual(Object.keys(domains),files);assert(Object.isFrozen(domains));git('merge-base','--is-ancestor',predecessor,DEED_MARKET_SOURCE_REVISION);
 for(const[file,pin]of Object.entries(domains)){
  const current=git('show',DEED_MARKET_SOURCE_REVISION+':'+file),prior=git('show',predecessor+':'+file);
  assert.equal(sha(current),pin.currentSha256);assert.equal(blob(current),pin.currentBlob);assert.equal(sha(prior),pin.baselineSha256);assert.equal(blob(prior),pin.baselineBlob);
  assert.equal(git('rev-parse',DEED_MARKET_SOURCE_REVISION+':'+file),pin.currentBlob+'\n');assert.equal(git('rev-parse',predecessor+':'+file),pin.baselineBlob+'\n');
  assert.equal(git('ls-tree',DEED_MARKET_SOURCE_REVISION,'--',file).split(' ')[0],pin.currentMode);assert.equal(git('ls-tree',predecessor,'--',file).split(' ')[0],pin.baselineMode);assert.equal(pin.currentMode,pin.baselineMode);
  assert.equal(pin.contextLines,3);assert(Object.isFrozen(pin)&&Object.isFrozen(pin.inverses)&&pin.inverses.every(Object.isFrozen));
  const actual=[];let h=null,last=null;
  for(const line of git('diff','--no-ext-diff','--no-renames','--unified=3',pin.baselineBlob,pin.currentBlob).split('\n')){
   if(line.startsWith('@@')){h={current:'',baseline:''};actual.push(h);last=null;continue;}if(!h)continue;
   if(line==='\\ No newline at end of file'){assert(last);if(last===' '||last==='+')h.current=h.current.slice(0,-1);if(last===' '||last==='-')h.baseline=h.baseline.slice(0,-1);continue;}if(!line.length)continue;
   const p=line[0];assert([' ','+','-'].includes(p));if(p===' '||p==='+')h.current+=line.slice(1)+'\n';if(p===' '||p==='-')h.baseline+=line.slice(1)+'\n';last=p;
  }
  assert.deepEqual(pin.inverses,actual);let reconstructed=current;
  for(const inverse of pin.inverses){assert.equal(reconstructed.split(inverse.current).length,2);reconstructed=reconstructed.replace(inverse.current,()=>inverse.baseline);inverses++;}
  assert.equal(reconstructed,prior);
  for(const input of[current,current.replaceAll('\n','\r\n')]){
   assert(isSource(file,input));assert.equal(baseline(file,input),prior);
   assert.deepEqual(transfer(file,input),{baselineText:prior,sourceRevision:DEED_MARKET_SOURCE_REVISION,predecessorRevision:predecessor,phase:DEED_MARKET_SOURCE_PHASE});
  }
  const changed=[current+'\n','\ufeff'+current,'tampered'+current,current+'\r',current.replace('\n','\r\n')];
  for(const input of changed){if(input===current||input===current.replaceAll('\n','\r\n'))continue;assert.equal(isSource(file,input),false);assert.equal(baseline(file,input),input);assert.throws(()=>transfer(file,input));refusals++;}
  if(prior!==current){assert.equal(isSource(file,prior),false);assert.equal(baseline(file,prior),prior);assert.throws(()=>transfer(file,prior));refusals++;}
 }
 for(const input of['unknown\r\nmixed\n',{},null]){
  assert.equal(isSource('unknown-domain',input),false);assert.equal(baseline('unknown-domain',input),input);assert.throws(()=>transfer('unknown-domain',input));refusals++;
 }
}
for(const[own,other,transfer,baseline,isSource]of[
 [deedFiles,marketFiles,assertDeedOverMarketSourceTransfer,deedOverMarketSourceBaseline,isDeedOverMarketSource],
 [marketFiles,deedFiles,assertMarketOverDeedSourceTransfer,marketOverDeedSourceBaseline,isMarketOverDeedSource]
])for(const file of other.filter(f=>!own.includes(f))){
 const input=git('show',DEED_MARKET_SOURCE_REVISION+':'+file);
 assert.equal(isSource(file,input),false);assert.equal(baseline(file,input),input);assert.throws(()=>transfer(file,input));refusals++;
}
const overlap=deedFiles.filter(f=>marketFiles.includes(f));
assert.deepEqual(overlap,['package.json','schema.sql','src/agentgateway.js','test/gates.js','.github/workflows/ci.yml','test/phase2-postgres.js']);
for(const file of overlap){
 const current=git('show',DEED_MARKET_SOURCE_REVISION+':'+file);
 assert.equal(DEED_OVER_MARKET_SOURCE_DOMAINS[file].currentSha256,MARKET_OVER_DEED_SOURCE_DOMAINS[file].currentSha256);
 assert.equal(assertDeedOverMarketSourceTransfer(file,current).baselineText,git('show',DEED_OVER_MARKET_SOURCE_PREDECESSOR+':'+file));
 assert.equal(assertMarketOverDeedSourceTransfer(file,current).baselineText,git('show',MARKET_OVER_DEED_SOURCE_PREDECESSOR+':'+file));
}
for(const p of DEED_MARKET_PRESERVED_FAMILIES){
 const old=git('show',p.revision+':'+p.file),current=git('show',DEED_MARKET_SOURCE_REVISION+':'+p.file);
 assert.equal(sha(old),p.sha256);assert.equal(blob(old),p.blob);assert.equal(current,old,'Complete old family module/data/functions remain unchanged');
}
console.log(JSON.stringify({phase:'PASS_EXACT_SOURCE_ONLY_DEED_MARKET_JUNCTION',source:DEED_MARKET_SOURCE_REVISION,domains:[13,20],simultaneousOverlap:6,inverses,refusals,PG:false,native:false}));
