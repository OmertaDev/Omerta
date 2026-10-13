import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as O from '../tools/rc1-fourth-batch-source-compatibility.js';
import { verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';
import { firstBatchSourceBaseline } from '../tools/rc1-first-batch-source-compatibility.js';
import { secondBatchSourceBaseline } from '../tools/rc1-second-batch-source-compatibility.js';
import { thirdBatchSourceBaseline } from '../tools/rc1-third-batch-source-compatibility.js';
import { assertCitySourceTransfer, assertDeedBacklogCompatibility, assertFranchiseSourceTransfer } from '../tools/rc1-deed-source-compatibility.js';
import { equipmentEconomyMigrationProjection, EQUIPMENT_EVENT_KIND_CURRENT } from './lib/equipment-economy-migration-catalog.js';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
const files=['package.json','schema.sql','src/agentgateway.js','src/invariants.js','src/market.js','src/server.js','src/social/estate.js','src/worker.js'];
assert.deepEqual(Object.keys(O.FOURTH_BATCH_SOURCE_DOMAINS).filter(f=>f!=='src/delivery.js'),files);
assert.deepEqual(Object.keys(O.FOURTH_BATCH_SOURCE_DOMAINS),[...files,'src/delivery.js']);
assert.equal(O.FOURTH_BATCH_SOURCE_REVISION,'565a0ccdcdc8c68a7df4af1a396ed99921682ec9');assert.equal(O.FOURTH_BATCH_SOURCE_PREDECESSOR,'90fed962b73a6e20717af4c89f4691d42fb70a1b');
let negatives=0,hunks=0;
for(const [file,d] of Object.entries(O.FOURTH_BATCH_SOURCE_DOMAINS).filter(([f])=>f!=='src/delivery.js')){
 const current=git('show',O.FOURTH_BATCH_SOURCE_REVISION+':'+file),prior=git('show',O.FOURTH_BATCH_SOURCE_PREDECESSOR+':'+file);
 for(const text of [current,current.replaceAll('\n','\r\n')]){
  assert.equal(O.assertFourthBatchSourceTransfer(file,text).baselineText,prior);
  assert.equal(O.fourthBatchSourceBaseline(file,text),prior);
  for(const baseline of [firstBatchSourceBaseline,secondBatchSourceBaseline,thirdBatchSourceBaseline])assert.equal(baseline(file,text),baseline(file,prior));
 }
 const actual=[];let chunk=null;
 for(const line of git('diff','--no-ext-diff','--unified=3',O.FOURTH_BATCH_SOURCE_PREDECESSOR,O.FOURTH_BATCH_SOURCE_REVISION,'--',file).split('\n')){
  if(line.startsWith('@@')){chunk={current:'',baseline:''};actual.push(chunk);}else if(chunk){if(line[0]==='+')chunk.current+=line.slice(1)+'\n';else if(line[0]==='-')chunk.baseline+=line.slice(1)+'\n';else if(line[0]===' '){chunk.current+=line.slice(1)+'\n';chunk.baseline+=line.slice(1)+'\n';}}
 }
 assert.deepEqual(d.inverses,actual,'Actual immutable Git inverse hunks only');
 const reject=(text,chain=false)=>{assert.throws(()=>O.assertFourthBatchSourceTransfer(file,text));assert.equal(O.fourthBatchSourceBaseline(file,text),text);if(chain)for(const baseline of [firstBatchSourceBaseline,secondBatchSourceBaseline,thirdBatchSourceBaseline])assert.equal(baseline(file,text),text);if(chain)for(const guard of [assertCitySourceTransfer,assertDeedBacklogCompatibility,assertFranchiseSourceTransfer])assert.throws(()=>guard(file,text));negatives++;};
 for(const bad of [current+'\n// drift\n',current.slice(1),current.replace(/\S/,'?'),'\ufeff'+current,current.replace('\n','\r\n')])reject(bad,true);
 for(const h of d.inverses){hunks++;reject(current.replace(h.current,''));reject(current.replace(h.current,()=>h.current+h.current));reject(current.replace(h.current,()=>h.baseline));reject(current.replace(h.current,()=>h.current.replace(/\S/,'?')));const lines=h.current.trimEnd().split('\n');if(lines.length>1)reject(current.replace(h.current,()=>lines.reverse().join('\n')+'\n'));}
 if(d.inverses.length>1){const a=d.inverses[0].current,b=d.inverses[1].current;reject(current.replace(a,'@@fourth-test@@').replace(b,a).replace('@@fourth-test@@',b));}
}
for(const file of ['src/unknown.js','schema.sql.extra','test/lib/phase2-architecture-upgrade-catalog.json','knowledge/generated/graph.json']){const text='unknown\r\nbytes\n';assert.throws(()=>O.assertFourthBatchSourceTransfer(file,text));assert.equal(O.fourthBatchSourceBaseline(file,text),text);negatives++;}
const schema=git('show',O.FOURTH_BATCH_SOURCE_REVISION+':schema.sql'),metadata={constraints:[{table_name:'item_events',name:'item_event_kind',type:'c',validated:true}]};
for(const text of [schema,schema.replaceAll('\n','\r\n')]){const p=equipmentEconomyMigrationProjection(text,metadata);const rows=[{table_name:'item_events',name:'item_event_kind',definition:EQUIPMENT_EVENT_KIND_CURRENT},{table_name:'territory_economics_sources',name:'retained',definition:'UNIQUE (id)'}];assert.deepEqual(p.normalize(rows).slice(1),rows.slice(1));}
for(const bad of [schema+'\n','\ufeff'+schema,schema.replace('\n','\r\n'),schema.replace('commercial_disputes','unknown_disputes')]){assert.equal(O.fourthBatchMigrationSchema(bad),bad);assert.throws(()=>equipmentEconomyMigrationProjection(bad,metadata));negatives++;}
const catalog=JSON.parse(fs.readFileSync('test/lib/phase2-architecture-upgrade-catalog.json'));const tables=['commercial_dispute_requests','commercial_disputes','company_restructuring_plans','company_restructuring_requests','equipment_insurance_claims','equipment_insurance_policies','equipment_insurance_requests','infrastructure_concession_requests','infrastructure_concessions','territory_economics_payments','territory_economics_profiles','territory_economics_requests','territory_economics_sources'];
assert.equal(catalog.added.filter(r=>tables.includes(r.table_name)).length,132);assert.equal(tables.reduce((n,t)=>n+catalog.notNullColumns[t].length,0),114);assert.equal(catalog.added.length,1048);
console.log('FOURTH source transfer PASS: 8 literal domains, '+hunks+' actual Git inverse hunks, '+negatives+' negative controls; complete FIRST/SECOND/THIRD composition and actual City/Deed/Franchise rejection; 13/132/114 native bindings retained, source-only');

// Legacy EOL normalization is intentionally unchanged; substantive full-caller drift must still refuse.
const worldFiles=['src/server.js','src/worker.js'];
const worldRead=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
await verifyWorldRecoverySources({sourceRevision:O.FOURTH_BATCH_SOURCE_REVISION,readFile:worldRead});
let worldNegatives=0;
for(const file of worldFiles){const text=worldRead(file),d=O.FOURTH_BATCH_SOURCE_DOMAINS[file];const bads=[text+'\n// unknown substantive change\n',text.slice(1),text.replace(/\S/,'?')];for(const h of d.inverses)bads.push(text.replace(h.current,''),text.replace(h.current,()=>h.current+h.current),text.replace(h.current,()=>h.current.replace(/\S/,'?')));for(const bad of bads){await assert.rejects(()=>verifyWorldRecoverySources({sourceRevision:O.FOURTH_BATCH_SOURCE_REVISION,readFile:f=>f===file?bad:worldRead(f)}),file+' substantive mutation index '+bads.indexOf(bad));worldNegatives++;}}
console.log('Actual world recovery substantive rejection PASS: '+worldNegatives+' changed/unknown/missing/duplicate-context controls; pre-existing mixed-EOL normalization limit retained.');

const packageSource=git('show',O.FOURTH_BATCH_SOURCE_REVISION+':package.json');
for(const altered of [packageSource.replace('node test/rc1-fourth-batch-source-compatibility.js && ',''),packageSource.replace('node test/rc1-fourth-batch-source-compatibility.js','node test/unknown-command.js'),packageSource.replace('node test/rc1-fourth-batch-source-compatibility.js','node test/rc1-fourth-batch-source-compatibility.js --bypass'),packageSource+'\n// unknown package command\n']){assert.notEqual(altered,packageSource);assert.throws(()=>O.assertFourthBatchSourceTransfer('package.json',altered));assert.equal(O.fourthBatchSourceBaseline('package.json',altered),altered);}
console.log('FOURTH package repin PASS: removed mandatory prefix, unknown command, unsupported argument and appended drift refuse.');

// Independently added Delivery envelope; the original eight-domain controls above retain their exact counts.
{
 const file='src/delivery.js',d=O.FOURTH_BATCH_SOURCE_DOMAINS[file],current=git('show',O.FOURTH_BATCH_SOURCE_REVISION+':'+file),prior=git('show',O.FOURTH_BATCH_SOURCE_PREDECESSOR+':'+file);
 for(const text of [current,current.replaceAll('\n','\r\n')]){assert.equal(O.assertFourthBatchSourceTransfer(file,text).baselineText,prior);assert.equal(O.fourthBatchSourceBaseline(file,text),prior);for(const baseline of [firstBatchSourceBaseline,secondBatchSourceBaseline,thirdBatchSourceBaseline])assert.equal(baseline(file,text),prior);}
 const actual=[];let chunk=null;for(const line of git('diff','--no-ext-diff','--unified=3',O.FOURTH_BATCH_SOURCE_PREDECESSOR,O.FOURTH_BATCH_SOURCE_REVISION,'--',file).split('\n')){if(line.startsWith('@@')){chunk={current:'',baseline:''};actual.push(chunk);}else if(chunk){if(line[0]==='+')chunk.current+=line.slice(1)+'\n';else if(line[0]==='-')chunk.baseline+=line.slice(1)+'\n';else if(line[0]===' '){chunk.current+=line.slice(1)+'\n';chunk.baseline+=line.slice(1)+'\n';}}}
 assert.deepEqual(d.inverses,actual);assert.equal(d.inverses.length,6);
 const {invoiceSourceBaseline,qualifyInvoiceSource,INVOICE_SOURCE_BASELINE_BLOBS}=await import('../tools/rc1-invoice-source-compatibility.js');
 assert.equal(invoiceSourceBaseline(file,current),git('cat-file','blob',INVOICE_SOURCE_BASELINE_BLOBS[file]),'Actual complete Invoice caller preserves its original frozen predecessor');
 let deliveryNegatives=0;const reject=text=>{assert.throws(()=>O.assertFourthBatchSourceTransfer(file,text));assert.equal(O.fourthBatchSourceBaseline(file,text),text);for(const baseline of [firstBatchSourceBaseline,secondBatchSourceBaseline,thirdBatchSourceBaseline])assert.equal(baseline(file,text),text);assert.throws(()=>qualifyInvoiceSource(file,invoiceSourceBaseline(file,text)));deliveryNegatives++;};
 for(const bad of [current+'\n// unknown Delivery suffix\n',current.slice(1),current.replace(/\S/,'?'),'\ufeff'+current])reject(bad);
 const mixed=current.replace('\n','\r\n');assert.throws(()=>O.assertFourthBatchSourceTransfer(file,mixed));assert.equal(O.fourthBatchSourceBaseline(file,mixed),mixed);for(const baseline of [firstBatchSourceBaseline,secondBatchSourceBaseline,thirdBatchSourceBaseline])assert.equal(baseline(file,mixed),mixed);deliveryNegatives++;
 for(const h of d.inverses){reject(current.replace(h.current,''));reject(current.replace(h.current,()=>h.current+h.current));reject(current.replace(h.current,()=>h.current.replace(/\S/,'?')));const lines=h.current.trimEnd().split('\n');reject(current.replace(h.current,()=>lines.reverse().join('\n')+'\n'));}
 const a=d.inverses[0].current,b=d.inverses[1].current;reject(current.replace(a,'@@delivery-envelope-test@@').replace(b,a).replace('@@delivery-envelope-test@@',b));
 console.log('FOURTH additional Delivery envelope PASS: full LF/CRLF bytes,6 actual inverse hunks,'+deliveryNegatives+' separate negatives and actual unchanged Invoice caller; legacy EOL caller limit retained.');
}
