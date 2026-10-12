import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as P from '../tools/rc1-company-bank-source-compatibility.js';
import * as Q from '../tools/rc1-commercial-premises-source-compatibility.js';
import { qualifyIntelSource } from '../tools/rc1-intel-source-compatibility.js';
import * as W from '../tools/rc1-company-workflow-source-compatibility.js';
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
assert.deepEqual(Object.keys(P.COMPANY_BANK_SOURCE_CURRENT_PINS),['src/server.js','src/worker.js','src/invariants.js','src/social/estate.js']);
for(const file of Object.keys(P.COMPANY_BANK_SOURCE_CURRENT_PINS)) {
 const current=lf(fs.readFileSync(file,'utf8')),prior=git('show',`${P.COMPANY_BANK_SOURCE_PREDECESSOR_REVISION}:${file}`);
 entire(current,git('show',`${P.COMPANY_BANK_SOURCE_REVIEWED_REVISION}:${file}`));entire(current,git('show',`c0dfd2b56db4991bd56d4a5ce1ce29d7fe24e5d1:${file}`));
 entire(current,git('show',P.COMPANY_BANK_SOURCE_CURRENT_BLOBS[file]));entire(prior,git('show',P.COMPANY_BANK_SOURCE_BASELINE_BLOBS[file]));
 for(const [text,pins,bs]of [[current,P.COMPANY_BANK_SOURCE_CURRENT_PINS,P.COMPANY_BANK_SOURCE_CURRENT_BLOBS],[prior,P.COMPANY_BANK_SOURCE_BASELINE_PINS,P.COMPANY_BANK_SOURCE_BASELINE_BLOBS]]) {assert.equal(hash(text),pins[file]);hashes++;assert.equal(blob(text),bs[file]);blobs++;}
 const chunks=[];let h;for(const line of git('diff','--no-ext-diff','--unified=3',P.COMPANY_BANK_SOURCE_PREDECESSOR_REVISION,P.COMPANY_BANK_SOURCE_REVIEWED_REVISION,'--',file).split('\n')) {if(line.startsWith('@@ ')){h={current:'',baseline:''};chunks.push(h);continue;}if(!h)continue;if(line.startsWith(' ')){h.current+=line.slice(1)+'\n';h.baseline+=line.slice(1)+'\n';}else if(line.startsWith('+'))h.current+=line.slice(1)+'\n';else if(line.startsWith('-'))h.baseline+=line.slice(1)+'\n';}
 assert.deepEqual(chunks,P.COMPANY_BANK_SOURCE_INVERSES[file]);assert.equal(chunks.length,2);hunks+=chunks.length;
 const proof=P.assertCompanyBankSourceTransfer(file,current);
 entire(proof.baselineText,prior);entire(P.companyBankSourceBaseline(file,current),prior);entire(P.qualifyCompanyBankSource(file,current).baselineText,prior);entire(P.qualifyCompanyBankSource(file,prior).baselineText,prior);entire(P.assertCompanyBankSourceTransfer(file,current.replaceAll('\n','\r\n')).baselineText,prior);entire(P.qualifyCompanyBankSource(file,prior.replaceAll('\n','\r\n')).baselineText,prior);
 assert.equal(proof.sourceRevision,P.COMPANY_BANK_SOURCE_REVIEWED_REVISION);assert.equal(proof.predecessorRevision,P.COMPANY_BANK_SOURCE_PREDECESSOR_REVISION);assert.equal(proof.sourceBlob,P.COMPANY_BANK_SOURCE_CURRENT_BLOBS[file]);assert.equal(proof.predecessorBlob,P.COMPANY_BANK_SOURCE_BASELINE_BLOBS[file]);assert.equal(proof.inverseChunks,chunks.length);assert.equal(proof.phase,P.COMPANY_BANK_SOURCE_TRANSFER.phase);assert.equal(proof.scope,P.COMPANY_BANK_SOURCE_TRANSFER.scope);assert.equal(proof.evidence,P.COMPANY_BANK_SOURCE_TRANSFER.evidence);
 assert.equal(hash(prior),(file==='src/worker.js'?W.COMPANY_WORKFLOW_SOURCE_CURRENT_PINS:Q.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS)[file]);hashes++;assert.equal(blob(prior),(file==='src/worker.js'?W.COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS:Q.COMMERCIAL_PREMISES_SOURCE_CURRENT_BLOBS)[file]);blobs++;
 assert.equal(P.qualifyCompanyBankSource(file,prior).inverseChunks,0);assert.throws(()=>P.assertCompanyBankSourceTransfer(file,prior));assert.throws(()=>W.assertCompanyWorkflowSourceTransfer(file,current));
 const changes=['// unknown\n'+current,current+'\n// unknown\n'];
 for(const c of chunks){assert.equal(current.split(c.current).length,2);changes.push(current.replace(c.current,c.baseline),current.replace(c.current,c.current+c.current),current.replace(c.current,'// changed context\n'+c.current.slice(c.current.indexOf('\n')+1)));}
 changes.push(current.replace(chunks[0].current,'__FIRST__').replace(chunks[1].current,chunks[0].current).replace('__FIRST__',chunks[1].current));
 if(file==='src/server.js') changes.push(current.replace('registerCompanyBankPortfolios(app, { pool, auth });','registerCompanyBankPortfolios(app, { pool });'),current.replace("from './routes/companybankportfolios.js'","from './routes/unknown.js'"),current.replace('registerCompanyWorkflows(app, { pool, auth });','registerCompanyWorkflows(app, { pool });'));
 else if(file==='src/worker.js') changes.push(current.replace('runCompanyBankPortfolios(pool, 20)','runCompanyBankPortfolios(pool, 21)'),current.replace('setInterval(guardedCompanyTick, 30000);','setInterval(guardedCompanyTick, 60000);'),current.replace("      await safe('company workflows', () => runCompanyWorkflows(pool, 20));\n      await safe('company bank portfolios', () => runCompanyBankPortfolios(pool, 20));","      await safe('company bank portfolios', () => runCompanyBankPortfolios(pool, 20));\n      await safe('company workflows', () => runCompanyWorkflows(pool, 20));"));
 else if(file==='src/invariants.js') changes.push(current.replace('await runCompanyBankPortfolioInvariants(pool)','await runCompanyBankPortfolioInvariants(null)'),current.replace('bankPortfolios.issues.length','0'));
 else changes.push(current.replace('await closeCompanyBankPortfoliosAtDeath(client, victim.id)','await closeCompanyBankPortfoliosAtDeath(client, opts.killerCh.id)'),current.replace('await closeCompanyWorkflowsAtDeath(client, victim.id)','await closeCompanyWorkflowsAtDeath(client, opts.killerCh.id)'));
 for(const changed of changes){assert.notEqual(changed,current);entire(P.companyBankSourceBaseline(file,changed),changed);entire(W.companyWorkflowSourceBaseline(file,changed),changed);entire(gameEmploymentSourceBaseline(file,changed),changed);entire(invoiceSourceBaseline(file,changed),changed);assert.throws(()=>P.assertCompanyBankSourceTransfer(file,changed));assert.throws(()=>P.qualifyCompanyBankSource(file,changed));assert.throws(()=>P.assertCompanyBankSourceTransfer(file,changed.replaceAll('\n','\r\n')));if(file==='src/server.js')assert.throws(()=>D.assertDeedServerCompatibility(changed));if(file==='src/invariants.js')assert.throws(()=>D.assertFranchiseSourceTransfer(file,changed));if(file==='src/worker.js')assert.throws(()=>qualifyIntelSource(file,changed));negatives++;}
 if(file==='src/server.js')for(const guard of ['assertGenesisSnapshotServerCompatibility','assertGenesisWrapperServerCompatibility','assertHttpReceiptServerCompatibility','assertDeedServerCompatibility']){const actual=D[guard](current),old=D[guard](prior);assert.deepEqual(actual.companyBankSourceTransfer,proof);for(const key of ['commercialPremisesSourceTransfer','companyWorkflowSourceTransfer','gameEmploymentSourceTransfer','companyOperatorSourceTransfer'])assert.deepEqual(actual[key],old[key]);}
 if(file==='src/invariants.js')for(const guard of ['assertFranchiseSourceTransfer','assertDeedBacklogCompatibility']){const actual=D[guard](file,current),old=D[guard](file,prior);assert.deepEqual(actual.companyBankSourceTransfer,proof);assert.deepEqual(actual.commercialPremisesSourceTransfer,old.commercialPremisesSourceTransfer);assert.deepEqual(actual.companyWorkflowSourceTransfer,old.companyWorkflowSourceTransfer);assert.deepEqual(actual.gameEmploymentSourceTransfer,old.gameEmploymentSourceTransfer);}
 if(file==='src/worker.js'){const actual=qualifyIntelSource(file,current),old=qualifyIntelSource(file,prior);assert.deepEqual(actual.companyBankSourceTransfer,proof);assert.deepEqual(actual.companyWorkflowSourceTransfer,old.companyWorkflowSourceTransfer);assert.deepEqual(actual.companyOperatorSourceTransfer,old.companyOperatorSourceTransfer);entire(actual.baselineText,old.baselineText);}
}
for(const file of ['src/companybankportfolios.js','src/game.js','toString']){assert.throws(()=>P.assertCompanyBankSourceTransfer(file,''));assert.throws(()=>P.qualifyCompanyBankSource(file,''));}
assert.deepEqual(WORLD_RECOVERY_REVIEW.companyBankSourceReviewTransfer,P.COMPANY_BANK_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer,W.COMPANY_WORKFLOW_SOURCE_TRANSFER);
const currentReader=file=>fs.readFileSync(file,'utf8'),priorReader=file=>Object.hasOwn(P.COMPANY_BANK_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMPANY_BANK_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);
assert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMPANY_BANK_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMPANY_BANK_SOURCE_REVIEWED_REVISION}));
console.log(`rc1-company-bank-source-compatibility: PASS ${hunks} exact Git hunks; ${texts} complete text, ${hashes} SHA256, ${blobs} Git blob comparisons; ${negatives} adversarial controls; CRLF, prior metadata, worker cap/cadence/ordering; source-only scope`);
