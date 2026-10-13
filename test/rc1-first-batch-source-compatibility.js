import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as O from '../tools/rc1-first-batch-source-compatibility.js';
const lf=t=>t.replaceAll('\r\n','\n'),git=(...a)=>lf(execFileSync('git',a,{encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex'),blob=t=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex');
let texts=0,hashes=0,blobs=0,negatives=0,hunks=0;const entire=(a,b)=>{assert.equal(a,b);texts++;},reject=(f,t)=>{assert.throws(()=>O.assertFirstBatchSourceTransfer(f,t));negatives++;};
assert.equal(O.FIRST_BATCH_SOURCE_PREDECESSOR,'f254c64a54a019665d7a516d382d56b46f2dcd82','The combined envelope reconstructs the complete authored main, not the older economy baseline');
assert.equal(O.FIRST_BATCH_SOURCE_REVISION,'066808b48500c2132207e851f1a998e788f4e7a2','Current metadata pins the frozen combined runtime');
assert.deepEqual(Object.keys(O.FIRST_BATCH_SOURCE_DOMAINS),['schema.sql','src/server.js','src/invariants.js','src/items.js','src/mysteries.js','src/crafting.js','src/content/phase1.js','src/content/phase1-policy.js','package.json','src/market.js','src/worker.js','src/social/estate.js','src/content/company-production-quality.js','src/agentgateway.js','src/company-economy-contracts.js']);
for(const[file,d]of Object.entries(O.FIRST_BATCH_SOURCE_DOMAINS)){
 const revision=d.currentRevision??O.FIRST_BATCH_SOURCE_REVISION;
 assert.equal(d.currentRevision??null,file==='package.json'?'b34c79f9e43bd2960801f3ecc9a3426af5907d3a':null,'Only the two reviewed recovery script additions use a separate exact package revision');
 const current=lf(fs.readFileSync(file,'utf8')),pinned=git('show',revision+':'+file);entire(current,pinned);entire(current,git('show',d.currentBlob));assert.equal(hash(current),d.currentSha256);hashes++;assert.equal(blob(current),d.currentBlob);blobs++;
 const proof=O.assertFirstBatchSourceTransfer(file,current);assert.equal(proof.sourceRevision,revision);entire(O.assertFirstBatchSourceTransfer(file,current.replaceAll('\n','\r\n')).baselineText,proof.baselineText);
 const actualHunks=[];let chunk=null;for(const line of git('diff','--no-ext-diff','--unified=3',O.FIRST_BATCH_SOURCE_PREDECESSOR,revision,'--',file).split('\n')){if(line.startsWith('@@')){chunk={current:'',baseline:''};actualHunks.push(chunk);}else if(chunk){if(line[0]==='+')chunk.current+=line.slice(1)+'\n';else if(line[0]==='-')chunk.baseline+=line.slice(1)+'\n';else if(line[0]===' '){chunk.current+=line.slice(1)+'\n';chunk.baseline+=line.slice(1)+'\n';}}}assert.deepEqual(d.inverses,d.predecessorAbsent?[]:actualHunks,'Only complete actual Git diff contexts are reversible');
 if(d.predecessorAbsent){assert(['src/content/company-production-quality.js','src/company-economy-contracts.js'].includes(file));assert.throws(()=>git('show',O.FIRST_BATCH_SOURCE_PREDECESSOR+':'+file));assert.equal(proof.baselineText,null);assert.equal(d.baselineSha256,null);assert.equal(d.baselineBlob,null);assert.deepEqual(d.inverses,[]);entire(O.firstBatchSourceBaseline(file,current),current);}
 else{const prior=git('show',O.FIRST_BATCH_SOURCE_PREDECESSOR+':'+file);entire(proof.baselineText,prior);entire(prior,git('show',d.baselineBlob));assert.equal(hash(prior),d.baselineSha256);hashes++;assert.equal(blob(prior),d.baselineBlob);blobs++;entire(O.firstBatchSourceBaseline(file,current),prior);if(d.inverses.length===0)entire(current,prior);}
 reject(file,current+'\n// unknown full-file drift\n');reject(file,current.slice(1));reject(file,current.replace(/\S/,'?'));entire(O.firstBatchSourceBaseline(file,current+'\n// unknown\n'),current+'\n// unknown\n');
 for(const h of d.inverses){hunks++;assert.equal(current.split(h.current).length-1,1);reject(file,current.replace(h.current,()=>''));reject(file,current.replace(h.current,()=>h.current+h.current));reject(file,current.replace(h.current,()=>h.baseline));reject(file,current.replace(h.current,()=>h.current.replace(/\S/,'?')));const lines=h.current.trimEnd().split('\n');if(lines.length>1)reject(file,current.replace(h.current,()=>lines.reverse().join('\n')+'\n'));}
 if(d.inverses.length>1){const a=d.inverses[0].current,b=d.inverses[1].current;reject(file,current.replace(a,'@@first-batch-test@@').replace(b,a).replace('@@first-batch-test@@',b));}
}
reject('src/unknown.js','unknown');console.log(`First-batch source compatibility PASS: ${Object.keys(O.FIRST_BATCH_SOURCE_DOMAINS).length} closed domains, ${texts} complete-text/${hashes} SHA256/${blobs} Gitblob comparisons, ${hunks} exact inverse hunks, ${negatives} negative controls; source transfer only`);
