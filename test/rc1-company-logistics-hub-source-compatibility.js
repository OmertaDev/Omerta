import { buyerCooperativeSourceBaseline } from '../tools/rc1-buyer-cooperative-source-compatibility.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as P from '../tools/rc1-company-logistics-hub-source-compatibility.js';
import * as W from '../tools/rc1-company-bank-source-compatibility.js';
import { gameEmploymentSourceBaseline } from '../tools/rc1-game-employment-source-compatibility.js';
import { invoiceSourceBaseline } from '../tools/rc1-invoice-source-compatibility.js';
import * as D from '../tools/rc1-deed-source-compatibility.js';
import { WORLD_RECOVERY_REVIEW, verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';
const lf=t=>t.replaceAll('\r\n','\n');
const git=(...a)=>lf(execFileSync('git',a,{encoding:'utf8',maxBuffer:8*1024*1024}));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const blob=t=>crypto.createHash('sha1').update(`blob ${Buffer.byteLength(t)}\0`).update(t).digest('hex');
let texts=0,hashes=0,blobs=0,negatives=0,hunks=0;
const entire=(a,b)=>{assert.equal(a,b);texts++;};
assert.deepEqual(Object.keys(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS),['src/server.js','src/invariants.js','src/social/estate.js']);
for(const file of Object.keys(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS)) {
 const current=buyerCooperativeSourceBaseline(file,fs.readFileSync(file,'utf8')),prior=git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:${file}`);
 entire(current,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`880f494311b3aad625ce06af99fcb245b146a351:${file}`));
 entire(current,git('show',P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS[file]));
 for(const [text,pins,bs]of [[current,P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS,P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS],[prior,P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_PINS,P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}
 const chunks=[];let h;for(const line of git('diff','--no-ext-diff','--unified=3',P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION,P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION,'--',file).split('\n')) {if(line.startsWith('@@ ')){h={current:'',baseline:''};chunks.push(h);continue;}if(!h)continue;if(line.startsWith(' ')){h.current+=line.slice(1)+'\n';h.baseline+=line.slice(1)+'\n';}else if(line.startsWith('+'))h.current+=line.slice(1)+'\n';else if(line.startsWith('-'))h.baseline+=line.slice(1)+'\n';}
 assert.deepEqual(chunks,P.COMPANY_LOGISTICS_HUB_SOURCE_INVERSES[file]);assert.equal(chunks.length,2);hunks+=chunks.length;
 const proof=P.assertCompanyLogisticsHubSourceTransfer(file,current);
 entire(proof.baselineText,prior);entire(P.companyLogisticsHubSourceBaseline(file,current),prior);entire(P.qualifyCompanyLogisticsHubSource(file,current).baselineText,prior);entire(P.qualifyCompanyLogisticsHubSource(file,prior).baselineText,prior);entire(P.assertCompanyLogisticsHubSourceTransfer(file,current.replaceAll('\n','\r\n')).baselineText,prior);entire(P.qualifyCompanyLogisticsHubSource(file,prior.replaceAll('\n','\r\n')).baselineText,prior);
 assert.equal(proof.sourceRevision,P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION);assert.equal(proof.predecessorRevision,P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION);assert.equal(proof.sourceBlob,P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS[file]);assert.equal(proof.predecessorBlob,P.COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS[file]);assert.equal(proof.inverseChunks,chunks.length);assert.equal(proof.phase,P.COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER.phase);assert.equal(proof.scope,P.COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER.scope);assert.equal(proof.evidence,P.COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER.evidence);
 assert.equal(hash(prior),W.COMPANY_BANK_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(prior),W.COMPANY_BANK_SOURCE_CURRENT_BLOBS[file]);blobs++;
 assert.equal(P.qualifyCompanyLogisticsHubSource(file,prior).inverseChunks,0);assert.throws(()=>P.assertCompanyLogisticsHubSourceTransfer(file,prior));assert.throws(()=>W.assertCompanyBankSourceTransfer(file,current));
 const changes=['// unknown\n'+current,current+'\n// unknown\n'];
 for(const c of chunks){assert.equal(current.split(c.current).length,2);changes.push(current.replace(c.current,c.baseline),current.replace(c.current,c.current+c.current),current.replace(c.current,'// changed context\n'+c.current.slice(c.current.indexOf('\n')+1)));}
 changes.push(current.replace(chunks[0].current,'__FIRST__').replace(chunks[1].current,chunks[0].current).replace('__FIRST__',chunks[1].current));
 if(file==='src/server.js') changes.push(current.replace('registerCompanyLogisticsHubs(app, { pool, auth });','registerCompanyLogisticsHubs(app, { pool });'),current.replace("from './routes/companylogisticshubs.js'","from './routes/unknown.js'"),current.replace('registerCompanyWorkflows(app, { pool, auth });','registerCompanyWorkflows(app, { pool });'));
 else if(file==='src/invariants.js') changes.push(current.replace('await logisticsHubInvariant(pool)','await logisticsHubInvariant(null)'),current.replace('hubs.defects.length','0'));
 else changes.push(current.replace('await voidLogisticsHubsAtDeath(client, victim)','await voidLogisticsHubsAtDeath(client, opts.killerCh)'),current.replace('await closeCompanyWorkflowsAtDeath(client, victim.id)','await closeCompanyWorkflowsAtDeath(client, opts.killerCh.id)'));
 for(const changed of changes){assert.notEqual(changed,current);entire(P.companyLogisticsHubSourceBaseline(file,changed),changed);entire(W.companyBankSourceBaseline(file,changed),changed);entire(gameEmploymentSourceBaseline(file,changed),changed);entire(invoiceSourceBaseline(file,changed),changed);assert.throws(()=>P.assertCompanyLogisticsHubSourceTransfer(file,changed));assert.throws(()=>P.qualifyCompanyLogisticsHubSource(file,changed));assert.throws(()=>P.assertCompanyLogisticsHubSourceTransfer(file,changed.replaceAll('\n','\r\n')));if(file==='src/server.js')assert.throws(()=>D.assertDeedServerCompatibility(changed));if(file==='src/invariants.js')assert.throws(()=>D.assertFranchiseSourceTransfer(file,changed));negatives++;}
 if(file==='src/server.js')for(const guard of ['assertGenesisSnapshotServerCompatibility','assertGenesisWrapperServerCompatibility','assertHttpReceiptServerCompatibility','assertDeedServerCompatibility']){const actual=D[guard](current),old=D[guard](prior);assert.deepEqual(actual.companyLogisticsHubSourceTransfer,proof);for(const key of ['companyBankSourceTransfer','commercialPremisesSourceTransfer','companyWorkflowSourceTransfer','gameEmploymentSourceTransfer','companyOperatorSourceTransfer'])assert.deepEqual(actual[key],old[key]);}
 if(file==='src/invariants.js')for(const guard of ['assertFranchiseSourceTransfer','assertDeedBacklogCompatibility']){const actual=D[guard](file,current),old=D[guard](file,prior);assert.deepEqual(actual.companyLogisticsHubSourceTransfer,proof);assert.deepEqual(actual.companyBankSourceTransfer,old.companyBankSourceTransfer);assert.deepEqual(actual.commercialPremisesSourceTransfer,old.commercialPremisesSourceTransfer);assert.deepEqual(actual.companyWorkflowSourceTransfer,old.companyWorkflowSourceTransfer);assert.deepEqual(actual.gameEmploymentSourceTransfer,old.gameEmploymentSourceTransfer);}
}
for(const file of ['src/worker.js','src/companylogisticshubs.js','toString']){assert.throws(()=>P.assertCompanyLogisticsHubSourceTransfer(file,''));assert.throws(()=>P.qualifyCompanyLogisticsHubSource(file,''));}
const worker=buyerCooperativeSourceBaseline('src/worker.js',fs.readFileSync('src/worker.js','utf8'));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:src/worker.js`));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}:src/worker.js`));entire(P.companyLogisticsHubSourceBaseline('src/worker.js',worker),worker);
assert.deepEqual(WORLD_RECOVERY_REVIEW.companyLogisticsHubSourceReviewTransfer,P.COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyBankSourceReviewTransfer,W.COMPANY_BANK_SOURCE_TRANSFER);
const currentReader=file=>fs.readFileSync(file,'utf8'),priorReader=file=>Object.hasOwn(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);
assert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}));
console.log(`rc1-company-logistics-hub-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and unchanged worker; source-only scope`);
