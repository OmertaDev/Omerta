import {hasFinalServicesCommerceSource,finalServicesOverCommerceSourceBaseline} from '../tools/finalservices-commerce-source-compatibility.js';
import {hasCommerceEnterpriseSource as hasFinalServicesTestCommerceSource,commerceOverEnterpriseSourceBaseline as finalServicesTestCommerceOverEnterprise} from '../tools/commerce-enterprise-source-compatibility.js';
const selectFinalServicesCommerceTestSource=(file,input)=>hasFinalServicesCommerceSource(file)?finalServicesOverCommerceSourceBaseline(file,input):input;
const selectFinalServicesEnterpriseTestSource=(file,input)=>{const commerce=selectFinalServicesCommerceTestSource(file,input);return hasFinalServicesTestCommerceSource(file)?finalServicesTestCommerceOverEnterprise(file,commerce):commerce;};
import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';
import { thirdBatchSourceBaseline } from '../tools/rc1-third-batch-source-compatibility.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as O from '../tools/rc1-second-batch-source-compatibility.js';
const lf=t=>t.replaceAll('\r\n','\n'),git=(...a)=>lf(execFileSync('git',a,{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex'),blob=t=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex');
const files=['schema.sql','src/server.js','src/invariants.js','src/items.js','src/mysteries.js','src/game.js','src/itemdurability.js','src/social/estate.js','src/social/combat.js','src/worker.js','src/routes/modtools.js','src/agentgateway.js','src/company-economy-contracts.js','package.json'];
assert.equal(O.SECOND_BATCH_SOURCE_REVISION,'f9767e4eda3c0863d740c0b557c3e2d6a4606f04');
assert.equal(O.SECOND_BATCH_SOURCE_PREDECESSOR,'9adc01bea4963b89f12419126bd91bb5e7d57a55');
assert.deepEqual(Object.keys(O.SECOND_BATCH_SOURCE_DOMAINS),files);
let texts=0,hashes=0,blobs=0,hunks=0,negatives=0;
const entire=(a,b)=>{assert.equal(a,b);texts++;};
const reject=(f,t)=>{assert.throws(()=>O.assertSecondBatchSourceTransfer(f,t));negatives++;entire(O.secondBatchSourceBaseline(f,t),lf(t));};
for(const [file,d] of Object.entries(O.SECOND_BATCH_SOURCE_DOMAINS)){
 const current=thirdBatchSourceBaseline(file,lf(cityActivitySourceBaseline(file,(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,selectFinalServicesEnterpriseTestSource(file,fs.readFileSync(file,'utf8'))):fs.readFileSync(file,'utf8'))))),prior=git('show',O.SECOND_BATCH_SOURCE_PREDECESSOR+':'+file);
 entire(current,git('show',O.SECOND_BATCH_SOURCE_REVISION+':'+file));entire(current,git('cat-file','blob',d.currentBlob));
 assert.equal(hash(current),d.currentSha256);hashes++;assert.equal(blob(current),d.currentBlob);blobs++;
 entire(prior,git('cat-file','blob',d.baselineBlob));assert.equal(hash(prior),d.baselineSha256);hashes++;assert.equal(blob(prior),d.baselineBlob);blobs++;
 const proof=O.assertSecondBatchSourceTransfer(file,current);entire(proof.baselineText,prior);entire(O.secondBatchSourceBaseline(file,current),prior);
 entire(O.assertSecondBatchSourceTransfer(file,current.replaceAll('\n','\r\n')).baselineText,prior);
 const actual=[];let chunk=null;
 for(const line of git('diff','--no-ext-diff','--unified=3',O.SECOND_BATCH_SOURCE_PREDECESSOR,O.SECOND_BATCH_SOURCE_REVISION,'--',file).split('\n')){
  if(line.startsWith('@@')){chunk={current:'',baseline:''};actual.push(chunk);}else if(chunk){if(line[0]==='+')chunk.current+=line.slice(1)+'\n';else if(line[0]==='-')chunk.baseline+=line.slice(1)+'\n';else if(line[0]===' '){chunk.current+=line.slice(1)+'\n';chunk.baseline+=line.slice(1)+'\n';}}
 }
 assert.deepEqual(d.inverses,actual,'Only actual complete Git diff contexts');assert(d.inverses.length>0);
 reject(file,current+'\n// unknown full-file drift\n');reject(file,current.slice(1));reject(file,current.replace(/\S/,'?'));
 reject(file,prior);
 for(const h of d.inverses){hunks++;assert.equal(current.split(h.current).length-1,1);reject(file,current.replace(h.current,()=>''));reject(file,current.replace(h.current,()=>h.current+h.current));reject(file,current.replace(h.current,()=>h.baseline));reject(file,current.replace(h.current,()=>h.current.replace(/\S/,'?')));
  const lines=h.current.trimEnd().split('\n');if(lines.length>1)reject(file,current.replace(h.current,()=>lines.reverse().join('\n')+'\n'));
 }
 if(d.inverses.length>1){const a=d.inverses[0].current,b=d.inverses[1].current;reject(file,current.replace(a,'@@second-batch-test@@').replace(b,a).replace('@@second-batch-test@@',b));}
}
for(const file of ['src/unknown.js','src/equipment-economy-contracts.js','src/equipmentrentals.js','package.json.unreviewed','test/lib/phase2-architecture-upgrade-catalog.json','src/generated.js','src/server.js.extra']){
 const raw=fs.existsSync(file)?lf(fs.readFileSync(file,'utf8')):'unknown';const text=thirdBatchSourceBaseline(file,raw);reject(file,text);
}
console.log(`Second-batch source compatibility PASS: ${files.length} literal domains, ${texts} full-text/${hashes} SHA256/${blobs} Gitblob comparisons, ${hunks} actual inverse hunks, ${negatives} negative controls; source transfer only`);
