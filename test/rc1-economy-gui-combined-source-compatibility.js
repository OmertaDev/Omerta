import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as C from '../tools/rc1-economy-gui-combined-source-compatibility.js';
import * as G from '../tools/rc1-city-gameplay-source-compatibility.js';
import * as S from '../tools/rc1-business-season-source-compatibility.js';
import * as D from '../tools/rc1-deed-source-compatibility.js';
import { invoiceSourceBaseline } from '../tools/rc1-invoice-source-compatibility.js';
import { WORLD_RECOVERY_REVIEW, verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';
const lf=t=>t.replaceAll('\r\n','\n'),git=(...a)=>lf(execFileSync('git',a,{encoding:'utf8',maxBuffer:32*1024*1024}));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex'),blob=t=>crypto.createHash('sha1').update(`blob ${Buffer.byteLength(t)}\0`).update(t).digest('hex');
let texts=0,hashes=0,blobs=0,negatives=0;const hunks={economy:0,gui:0};
const entire=(a,b)=>{assert.equal(a,b);texts++;};
function gitChunks(from,to,file){
 const chunks=[];let h,last;
 for(const line of git('diff','--no-ext-diff','--unified=3',from,to,'--',file).split('\n')){
  if(line.startsWith('@@ ')){h={current:'',baseline:''};chunks.push(h);continue;}if(!h)continue;
  if(line.startsWith(' ')){h.current+=line.slice(1)+'\n';h.baseline+=line.slice(1)+'\n';last='both';}
  else if(line.startsWith('+')){h.current+=line.slice(1)+'\n';last='current';}else if(line.startsWith('-')){h.baseline+=line.slice(1)+'\n';last='baseline';}
  else if(line.startsWith('\\ No newline')){if(last==='both'||last==='current')h.current=h.current.slice(0,-1);if(last==='both'||last==='baseline')h.baseline=h.baseline.slice(0,-1);}
 }
 return chunks;
}
const files=[...Object.keys(G.CITY_GAMEPLAY_SOURCE_CURRENT_PINS),'src/worker.js','src/market.js'];
assert.equal(files.length,19);assert.deepEqual(Object.keys(C.COMBINED_SOURCE_CURRENT_PINS),files);assert.deepEqual(Object.keys(C.COMBINED_SOURCE_BASELINES),['economy','gui']);
assert.equal(C.COMBINED_SOURCE_REVIEWED_REVISION,'1a2c80a5ce2b0482e613b2f4eb48007a4b0b32dd');
assert.equal(C.COMBINED_SOURCE_AUTHORED_REVISION,'361a16c90faf63980a96de380f22350d4bcbea9f');
assert.equal(C.COMBINED_SOURCE_BASELINES.economy.revision,'2d80e58654af9af58b6318f13c9700bf1f42a9cb');assert.equal(C.COMBINED_SOURCE_BASELINES.gui.revision,'c3da29067508933acaa7bbfdbf4dbf99ce5c2f7c');
const currents=new Map(),baselines={economy:new Map(),gui:new Map()};
for(const file of files){
 const current=lf(fs.readFileSync(file,'utf8'));currents.set(file,current);
 entire(current,git('show',`${C.COMBINED_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',C.COMBINED_SOURCE_CURRENT_BLOBS[file]));assert.equal(hash(current),C.COMBINED_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(current),C.COMBINED_SOURCE_CURRENT_BLOBS[file]);blobs++;
 const authored=git('show',`${C.COMBINED_SOURCE_AUTHORED_REVISION}:${file}`);assert.equal(hash(authored),C.COMBINED_SOURCE_AUTHORED_PINS[file]);hashes++;assert.equal(blob(authored),C.COMBINED_SOURCE_AUTHORED_BLOBS[file]);blobs++;
 assert.deepEqual(C.COMBINED_SOURCE_WIRE_INVERSES[file],gitChunks(C.COMBINED_SOURCE_AUTHORED_REVISION,C.COMBINED_SOURCE_REVIEWED_REVISION,file));
 let wireText=current;
 for(const chunk of C.COMBINED_SOURCE_WIRE_INVERSES[file]){assert.equal(wireText.split(chunk.current).length,2);wireText=wireText.replace(chunk.current,()=>chunk.baseline);for(const changed of [current.replace(chunk.current,()=>chunk.baseline),current.replace(chunk.current,()=>chunk.current+chunk.current),current.replace(chunk.current,()=>chunk.current+'// altered mandatory wire\n')]){assert.notEqual(changed,current);for(const target of ['economy','gui'])assert.throws(()=>C.assertCombinedSourceTransfer(target,file,changed),/Combined source changed/);negatives++;}}
 assert.equal(C.COMBINED_SOURCE_WIRE_INVERSES[file].length,file==='package.json'?1:0);entire(wireText,authored);
 for(const target of ['economy','gui']){
  const pinned=C.COMBINED_SOURCE_BASELINES[target],baseline=git('show',`${pinned.revision}:${file}`);baselines[target].set(file,baseline);
  entire(baseline,git('show',pinned.blobs[file]));assert.equal(hash(baseline),pinned.pins[file]);hashes++;assert.equal(blob(baseline),pinned.blobs[file]);blobs++;
  const chunks=[];let h,last;
  for(const line of git('diff','--no-ext-diff','--unified=3',pinned.revision,C.COMBINED_SOURCE_AUTHORED_REVISION,'--',file).split('\n')){
   if(line.startsWith('@@ ')){h={current:'',baseline:''};chunks.push(h);continue;}if(!h)continue;
   if(line.startsWith(' ')){h.current+=line.slice(1)+'\n';h.baseline+=line.slice(1)+'\n';last='both';}
   else if(line.startsWith('+')){h.current+=line.slice(1)+'\n';last='current';}else if(line.startsWith('-')){h.baseline+=line.slice(1)+'\n';last='baseline';}
   else if(line.startsWith('\\ No newline')){if(last==='both'||last==='current')h.current=h.current.slice(0,-1);if(last==='both'||last==='baseline')h.baseline=h.baseline.slice(0,-1);}
  }
  assert.deepEqual(chunks,C.COMBINED_SOURCE_INVERSES[target][file]);hunks[target]+=chunks.length;
  const currentChunks=file==='package.json'?gitChunks(pinned.revision,C.COMBINED_SOURCE_REVIEWED_REVISION,file):chunks;
  const proof=C.assertCombinedSourceTransfer(target,file,current);entire(proof.baselineText,baseline);entire(C.combinedSourceBaseline(target,file,current),baseline);entire(C.assertCombinedSourceTransfer(target,file,current.replaceAll('\n','\r\n')).baselineText,baseline);assert.equal(proof.wireInverseChunks,file==='package.json'?1:0);assert.equal(proof.authoredRevision,C.COMBINED_SOURCE_AUTHORED_REVISION);assert.equal(proof.authoredBlob,C.COMBINED_SOURCE_AUTHORED_BLOBS[file]);
  assert.equal(proof.target,target);assert.equal(proof.file,file);assert.equal(proof.actualSha256,C.COMBINED_SOURCE_CURRENT_PINS[file]);assert.equal(proof.baselineSha256,pinned.pins[file]);assert.equal(proof.sourceBlob,C.COMBINED_SOURCE_CURRENT_BLOBS[file]);assert.equal(proof.predecessorBlob,pinned.blobs[file]);assert.equal(proof.sourceRevision,C.COMBINED_SOURCE_REVIEWED_REVISION);assert.equal(proof.predecessorRevision,pinned.revision);assert.equal(proof.inverseChunks,chunks.length);assert.equal(proof.evidence,C.COMBINED_SOURCE_TRANSFER.evidence);assert.equal(proof.phase,C.COMBINED_SOURCE_TRANSFER.phase);assert.equal(proof.scope,C.COMBINED_SOURCE_TRANSFER.scope);
  const changes=['// unknown prefix\n'+current,current+'\n// unknown suffix\n',current.endsWith('\n')?current.slice(0,-1):current+'\n'];
  for(const chunk of currentChunks){assert.equal(current.split(chunk.current).length,2);changes.push(current.replace(chunk.current,()=>chunk.baseline),current.replace(chunk.current,()=>chunk.current+chunk.current),current.replace(chunk.current,()=>'// protected context changed\n'+chunk.current.slice(chunk.current.indexOf('\n')+1)));}
  if(currentChunks.length>1){assert(!current.includes('\0COMBINED_FIRST\0'));changes.push(current.replace(currentChunks[0].current,()=> '\0COMBINED_FIRST\0').replace(currentChunks[1].current,()=>currentChunks[0].current).replace('\0COMBINED_FIRST\0',()=>currentChunks[1].current));}
  for(const changed of changes){assert.notEqual(changed,current);entire(C.combinedSourceBaseline(target,file,changed),changed);assert.throws(()=>C.assertCombinedSourceTransfer(target,file,changed),/Combined source changed/);assert.throws(()=>C.assertCombinedSourceTransfer(target,file,changed.replaceAll('\n','\r\n')),/Combined source changed/);negatives++;}
  if(Object.hasOwn(G.CITY_GAMEPLAY_SOURCE_CURRENT_PINS,file)&&target==='gui'){
   assert.equal(hash(baseline),G.CITY_GAMEPLAY_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(baseline),G.CITY_GAMEPLAY_SOURCE_CURRENT_BLOBS[file]);blobs++;
   const old=G.qualifyCityGameplaySource(file,baseline),actual=G.qualifyCityGameplaySource(file,C.combinedGuiSourceBaseline(file,current));assert.deepEqual(actual,old);entire(actual.baselineText,git('show',G.CITY_GAMEPLAY_SOURCE_PARENT_BLOBS[file]));
  }
  if(Object.hasOwn(S.BUSINESS_SEASON_SOURCE_CURRENT_PINS,file)&&target==='economy'){
   assert.equal(hash(baseline),S.BUSINESS_SEASON_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(baseline),S.BUSINESS_SEASON_SOURCE_CURRENT_BLOBS[file]);blobs++;entire(S.businessSeasonSourceBaseline(file,current),S.assertBusinessSeasonSourceTransfer(file,baseline).baselineText);
  }
 }
 entire(G.cityGameplaySourceBaseline(file,current),G.cityGameplaySourceBaseline(file,baselines.economy.get(file)));
 for(const changed of [current+'\n// both historical routes must refuse\n']){entire(C.combinedEconomySourceBaseline(file,changed),changed);entire(C.combinedGuiSourceBaseline(file,changed),changed);entire(G.cityGameplaySourceBaseline(file,changed),changed);entire(invoiceSourceBaseline(file,changed),changed);negatives++;}
}
for(const target of ['economy','gui'])for(const file of ['src/city-home-interiors.js','src/companyopportunities.js','toString']){assert.throws(()=>C.assertCombinedSourceTransfer(target,file,''),/Unknown combined source file/);entire(C.combinedSourceBaseline(target,file,'unknown bytes'),'unknown bytes');negatives++;}
for(const target of ['toString','__proto__','GUI',{},null])assert.throws(()=>C.assertCombinedSourceTransfer(target,'src/server.js',''));
assert.throws(()=>C.assertCombinedSourceTransfer('gui',{},''));assert.throws(()=>C.assertCombinedSourceTransfer('gui','src/server.js',{}));
const server=currents.get('src/server.js'),ecoServer=baselines.economy.get('src/server.js'),serverProof=C.assertCombinedSourceTransfer('economy','src/server.js',server);
for(const guard of ['assertGenesisSnapshotServerCompatibility','assertGenesisWrapperServerCompatibility','assertHttpReceiptServerCompatibility','assertDeedServerCompatibility']){const actual=D[guard](server),old=D[guard](ecoServer);assert.deepEqual(actual.combinedSourceTransfer,serverProof);for(const key of ['businessSeasonSourceTransfer','commercialReputationSourceTransfer','companyOpportunitySourceTransfer','buyerCooperativeSourceTransfer','companyLogisticsHubSourceTransfer','companyBankSourceTransfer','commercialPremisesSourceTransfer','companyWorkflowSourceTransfer','gameEmploymentSourceTransfer','companyOperatorSourceTransfer'])assert.deepEqual(actual[key],old[key]);}
for(const guard of ['assertFranchiseSourceTransfer','assertDeedBacklogCompatibility']){const file='src/invariants.js',actual=D[guard](file,currents.get(file)),old=D[guard](file,baselines.economy.get(file));assert.deepEqual(actual.combinedSourceTransfer,C.assertCombinedSourceTransfer('economy',file,currents.get(file)));assert.deepEqual(actual.buyerCooperativeSourceTransfer,old.buyerCooperativeSourceTransfer);}
assert.deepEqual(WORLD_RECOVERY_REVIEW.combinedSourceReviewTransfer,C.COMBINED_SOURCE_TRANSFER);
const current=await verifyWorldRecoverySources({sourceRevision:C.COMBINED_SOURCE_REVIEWED_REVISION,readFile:file=>fs.readFileSync(file)});
for(const target of ['economy','gui']){const previous=await verifyWorldRecoverySources({sourceRevision:C.COMBINED_SOURCE_REVIEWED_REVISION,readFile:file=>baselines[target].get(file)||fs.readFileSync(file)});assert.deepEqual(current,previous);}
console.log(`rc1-economy-gui-combined-source-compatibility: PASS closed19 dual-route Git hunks economy=${hunks.economy}, gui=${hunks.gui}; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; literal dollar tokens, exact EOF/LF/CRLF, GUI17 and SG10/history scope preserved`);
