import { fourthBatchSourceBaseline } from '../tools/rc1-fourth-batch-source-compatibility.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as O from '../tools/rc1-third-batch-source-compatibility.js';
const lf=t=>t.replaceAll('\r\n','\n'),git=(...a)=>lf(execFileSync('git',a,{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex'),blob=t=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex');
const files=["schema.sql","src/server.js","src/invariants.js","src/social/estate.js","src/agentgateway.js","package.json"];
assert.equal(O.THIRD_BATCH_SOURCE_REVISION,'f0545f315f12f5d8312190e8c45912855d81e116');
assert.equal(O.THIRD_BATCH_SOURCE_PREDECESSOR,'62954ecd2f64899641af41f1d2d047d0ed07efa4');
assert.deepEqual(Object.keys(O.THIRD_BATCH_SOURCE_DOMAINS),files);
let texts=0,hashes=0,blobs=0,hunks=0,negatives=0;
const entire=(a,b)=>{assert.equal(a,b);texts++;};
const reject=(f,t)=>{assert.throws(()=>O.assertThirdBatchSourceTransfer(f,t));negatives++;entire(O.thirdBatchSourceBaseline(f,t),lf(t));};
for(const [file,d] of Object.entries(O.THIRD_BATCH_SOURCE_DOMAINS)){
 const current=fourthBatchSourceBaseline(file,fs.readFileSync(file,'utf8')),prior=git('show',O.THIRD_BATCH_SOURCE_PREDECESSOR+':'+file);
 entire(current,git('show',O.THIRD_BATCH_SOURCE_REVISION+':'+file));entire(current,git('cat-file','blob',d.currentBlob));
 assert.equal(hash(current),d.currentSha256);hashes++;assert.equal(blob(current),d.currentBlob);blobs++;
 entire(prior,git('cat-file','blob',d.baselineBlob));assert.equal(hash(prior),d.baselineSha256);hashes++;assert.equal(blob(prior),d.baselineBlob);blobs++;
 const proof=O.assertThirdBatchSourceTransfer(file,current);entire(proof.baselineText,prior);entire(O.thirdBatchSourceBaseline(file,current),prior);
 entire(O.assertThirdBatchSourceTransfer(file,current.replaceAll('\n','\r\n')).baselineText,prior);
 const actual=[];let chunk=null;
 for(const line of git('diff','--no-ext-diff','--unified=3',O.THIRD_BATCH_SOURCE_PREDECESSOR,O.THIRD_BATCH_SOURCE_REVISION,'--',file).split('\n')){
  if(line.startsWith('@@')){chunk={current:'',baseline:''};actual.push(chunk);}else if(chunk){if(line[0]==='+')chunk.current+=line.slice(1)+'\n';else if(line[0]==='-')chunk.baseline+=line.slice(1)+'\n';else if(line[0]===' '){chunk.current+=line.slice(1)+'\n';chunk.baseline+=line.slice(1)+'\n';}}
 }
 assert.deepEqual(d.inverses,actual,'Only actual complete Git diff contexts');assert(d.inverses.length>0);
 reject(file,current+'\n// unknown full-file drift\n');reject(file,current.slice(1));reject(file,current.replace(/\S/,'?'));
 reject(file,prior);
 for(const h of d.inverses){hunks++;assert.equal(current.split(h.current).length-1,1);reject(file,current.replace(h.current,()=>''));reject(file,current.replace(h.current,()=>h.current+h.current));reject(file,current.replace(h.current,()=>h.baseline));reject(file,current.replace(h.current,()=>h.current.replace(/\S/,'?')));
  const lines=h.current.trimEnd().split('\n');if(lines.length>1)reject(file,current.replace(h.current,()=>lines.reverse().join('\n')+'\n'));
 }
 if(d.inverses.length>1){const a=d.inverses[0].current,b=d.inverses[1].current;reject(file,current.replace(a,'@@third-batch-test@@').replace(b,a).replace('@@third-batch-test@@',b));}
}
for(const file of ['src/unknown.js','src/equipment-economy-contracts.js','src/equipmentrentals.js','package.json.unreviewed','test/lib/phase2-architecture-upgrade-catalog.json','src/generated.js','src/server.js.extra']){
 const text=fs.existsSync(file)?lf(fs.readFileSync(file,'utf8')):'unknown';reject(file,text);
}
console.log(`Third-batch source compatibility PASS: ${files.length} literal domains, ${texts} full-text/${hashes} SHA256/${blobs} Gitblob comparisons, ${hunks} actual inverse hunks, ${negatives} negative controls; source transfer only`);

const schema=git('show',O.THIRD_BATCH_SOURCE_REVISION+':schema.sql'),priorSchema=git('show',O.THIRD_BATCH_SOURCE_PREDECESSOR+':schema.sql');
assert.equal(O.thirdBatchMigrationSchema(schema),priorSchema);
assert.equal(O.thirdBatchMigrationSchema(schema.replaceAll('\n','\r\n')),priorSchema);
const {equipmentEconomyMigrationProjection,EQUIPMENT_EVENT_KIND_CURRENT,EQUIPMENT_ECONOMY_MIGRATION_TABLES}=await import('./lib/equipment-economy-migration-catalog.js');
const metadata={constraints:[{table_name:'item_events',name:'item_event_kind',type:'c',validated:true}]};
for(const bad of [schema+'\n',schema.replace('\n','\r\n'),'\ufeff'+schema,schema.replace('worker_training_courses','unsupported_training'),schema.replace("'escrow_relayed'","'unexpected_relay'")]){
 assert.equal(O.thirdBatchMigrationSchema(bad),bad,'Unknown native schema remains raw for the strict original rejection');
 assert.throws(()=>equipmentEconomyMigrationProjection(bad,metadata));
}
const projection=equipmentEconomyMigrationProjection(schema,metadata),catalog=JSON.parse(fs.readFileSync('test/lib/phase2-architecture-upgrade-catalog.json'));
const tables=['worker_training_courses','worker_training_requests','worker_training_sessions','employment_organizations','employment_organization_requests','employment_organization_courses','business_partnerships','business_partnership_requests','business_partnership_contributions','business_partnership_distributions','company_governance','company_governance_proposals','company_governance_votes','company_governance_requests','company_acquisitions','company_acquisition_requests'];
const retained=[...EQUIPMENT_ECONOMY_MIGRATION_TABLES,...tables].map(table_name=>({table_name,name:'unchanged_metadata_witness',definition:'UNIQUE (id)'}));
const kind={table_name:'item_events',name:'item_event_kind',definition:EQUIPMENT_EVENT_KIND_CURRENT};
assert.deepEqual(projection.normalize([kind,...retained]).slice(1),retained,'All14 earlier and16 new table rows remain visible to the original native oracle');
assert.equal(catalog.added.filter(r=>tables.includes(r.table_name)).length,104);
assert.equal(tables.reduce((n,t)=>n+catalog.notNullColumns[t].length,0),121);
console.log('Third native schema admission PASS: exact LF/CRLF transfer only; mixed/unknown raw bytes rejected, all30 new-family tables and independent104/121 native bindings remain visible');
