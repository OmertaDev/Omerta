import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as O from '../tools/rc1-commercial-reputation-source-compatibility.js';
import * as C from '../tools/rc1-company-opportunity-source-compatibility.js';
import * as D from '../tools/rc1-deed-source-compatibility.js';
import { qualifyIntelSource } from '../tools/rc1-intel-source-compatibility.js';
import { invoiceSourceBaseline } from '../tools/rc1-invoice-source-compatibility.js';
import { WORLD_RECOVERY_REVIEW, verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';
const lf=t=>t.replaceAll('\r\n','\n'),git=(...a)=>lf(execFileSync('git',a,{encoding:'utf8',maxBuffer:8*1024*1024}));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex'),blob=t=>crypto.createHash('sha1').update(`blob ${Buffer.byteLength(t)}\0`).update(t).digest('hex');
let texts=0,hashes=0,blobs=0,negatives=0,hunks=0;
const entire=(a,b)=>{assert.equal(a,b);texts++;};
const files=['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js','src/market.js'];
assert.deepEqual(Object.keys(O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS),files);
for(const file of files){
 const current=lf(fs.readFileSync(file,'utf8')),prior=git('show',`${O.COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION}:${file}`);
 entire(current,git('show',`${O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS[file]));entire(prior,git('show',`5aadb5267bba9060716ddd82660e59f6aec89ea3:${file}`));
 for(const [text,pins,bs]of [[current,O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS,O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS],[prior,O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_PINS,O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS]]){assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}
 assert.equal(hash(prior),C.COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS[file]);hashes++;assert.equal(blob(prior),C.COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS[file]);blobs++;
 const chunks=[];let h;for(const line of git('diff','--no-ext-diff','--unified=3',O.COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION,O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION,'--',file).split('\n')){if(line.startsWith('@@ ')){h={current:'',baseline:''};chunks.push(h);continue;}if(!h)continue;if(line.startsWith(' ')){h.current+=line.slice(1)+'\n';h.baseline+=line.slice(1)+'\n';}else if(line.startsWith('+'))h.current+=line.slice(1)+'\n';else if(line.startsWith('-'))h.baseline+=line.slice(1)+'\n';}
 assert.deepEqual(chunks,O.COMMERCIAL_REPUTATION_SOURCE_INVERSES[file]);assert.equal(chunks.length,file==='src/server.js'?2:0);hunks+=chunks.length;
 const proof=O.assertCommercialReputationSourceTransfer(file,current);
 entire(proof.baselineText,prior);entire(O.commercialReputationSourceBaseline(file,current),prior);entire(O.qualifyCommercialReputationSource(file,current).baselineText,prior);entire(O.qualifyCommercialReputationSource(file,prior).baselineText,prior);entire(O.assertCommercialReputationSourceTransfer(file,current.replaceAll('\n','\r\n')).baselineText,prior);entire(O.qualifyCommercialReputationSource(file,prior.replaceAll('\n','\r\n')).baselineText,prior);
 assert.equal(proof.sourceRevision,O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION);assert.equal(proof.predecessorRevision,O.COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION);assert.equal(proof.sourceBlob,O.COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS[file]);assert.equal(proof.predecessorBlob,O.COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS[file]);assert.equal(proof.inverseChunks,chunks.length);assert.equal(proof.evidence,O.COMMERCIAL_REPUTATION_SOURCE_TRANSFER.evidence);assert.equal(proof.phase,O.COMMERCIAL_REPUTATION_SOURCE_TRANSFER.phase);assert.equal(proof.scope,O.COMMERCIAL_REPUTATION_SOURCE_TRANSFER.scope);
 const changes=['// unknown\n'+current,current+'\n// unknown\n'];
 for(const c of chunks){assert.equal(current.split(c.current).length,2);changes.push(current.replace(c.current,c.baseline),current.replace(c.current,c.current+c.current),current.replace(c.current,'// context drift\n'+c.current.slice(c.current.indexOf('\n')+1)));}
 if(chunks.length){changes.push(current.replace(chunks[0].current,'__FIRST__').replace(chunks[1].current,chunks[0].current).replace('__FIRST__',chunks[1].current));assert.throws(()=>O.assertCommercialReputationSourceTransfer(file,prior));}
 else entire(current,prior);
 if(file==='src/server.js')changes.push(current.replace('registerCommercialReputation(app, { pool, auth });','registerCommercialReputation(app, { pool });'),current.replace("from './routes/commercialreputation.js'","from './routes/unknown.js'"),current.replace('registerBuyerCooperatives(app, { pool, auth });','registerBuyerCooperatives(app, { pool });'));
 else if(file==='src/worker.js')changes.push(current.replace('runCompanyOpportunities(pool, 25)','runCompanyOpportunities(pool, 26)'),current.replace('setInterval(guardedCompanyTick, 30000);','setInterval(guardedCompanyTick, 60000);'),current.replace("      await safe('buyer cooperative funding expiry', () => expireBuyerCooperativeFunding(pool, 20));\n      await safe('company opportunities', () => runCompanyOpportunities(pool, 25));","      await safe('company opportunities', () => runCompanyOpportunities(pool, 25));\n      await safe('buyer cooperative funding expiry', () => expireBuyerCooperativeFunding(pool, 20));"));
 else if(file==='src/invariants.js')changes.push(current.replace('cooperatives.issues.length','0'));
 else if(file==='src/social/estate.js')changes.push(current.replace('recoverBuyerCooperativesAtDeath(client, victim.id','recoverBuyerCooperativesAtDeath(client, null'));
 else changes.push(current.replace('settleBuyerCooperativeOrder(client, l.id, ledger, { cancel: true })','settleBuyerCooperativeOrder(client, l.id, ledger, { cancel: false })'));
 for(const changed of changes){assert.notEqual(changed,current);entire(O.commercialReputationSourceBaseline(file,changed),changed);entire(C.companyOpportunitySourceBaseline(file,changed),changed);entire(invoiceSourceBaseline(file,changed),changed);assert.throws(()=>O.assertCommercialReputationSourceTransfer(file,changed));assert.throws(()=>O.qualifyCommercialReputationSource(file,changed));assert.throws(()=>O.assertCommercialReputationSourceTransfer(file,changed.replaceAll('\n','\r\n')));if(file==='src/server.js')assert.throws(()=>D.assertDeedServerCompatibility(changed));if(file==='src/worker.js')assert.throws(()=>qualifyIntelSource(file,changed));negatives++;}
 if(file==='src/server.js')for(const guard of ['assertGenesisSnapshotServerCompatibility','assertGenesisWrapperServerCompatibility','assertHttpReceiptServerCompatibility','assertDeedServerCompatibility']){const actual=D[guard](current),old=D[guard](prior);assert.deepEqual(actual.commercialReputationSourceTransfer,proof);for(const key of ['companyOpportunitySourceTransfer','buyerCooperativeSourceTransfer','companyLogisticsHubSourceTransfer','companyBankSourceTransfer','commercialPremisesSourceTransfer','companyWorkflowSourceTransfer','gameEmploymentSourceTransfer','companyOperatorSourceTransfer'])assert.deepEqual(actual[key],old[key]);}
 if(file==='src/worker.js'){assert.deepEqual(qualifyIntelSource(file,current),qualifyIntelSource(file,prior));}
}
for(const file of ['src/companyopportunities.js','src/game.js','toString']){assert.throws(()=>O.assertCommercialReputationSourceTransfer(file,''));assert.throws(()=>O.qualifyCommercialReputationSource(file,''));}
assert.deepEqual(WORLD_RECOVERY_REVIEW.commercialReputationSourceReviewTransfer,O.COMMERCIAL_REPUTATION_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyOpportunitySourceReviewTransfer,C.COMPANY_OPPORTUNITY_SOURCE_TRANSFER);
assert.deepEqual(await verifyWorldRecoverySources({sourceRevision:O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION,readFile:file=>fs.readFileSync(file)}),await verifyWorldRecoverySources({sourceRevision:O.COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION,readFile:file=>files.includes(file)?git('show',`${O.COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION}:${file}`):fs.readFileSync(file)}));
console.log(`rc1-commercial-reputation-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata and four unchanged full-file domains; source-only scope`);
