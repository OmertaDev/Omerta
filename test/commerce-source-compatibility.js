import {hasFinalServicesCommerceSource,finalServicesOverCommerceSourceBaseline} from '../tools/finalservices-commerce-source-compatibility.js';
const selectFinalServicesCommerceTestSource=(file,input)=>hasFinalServicesCommerceSource(file)?finalServicesOverCommerceSourceBaseline(file,input):input;
// Generated from actual committed Commerce source and its genuine Enterprise predecessor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {COMMERCE_ENTERPRISE_SOURCE_REVISION,COMMERCE_ENTERPRISE_SOURCE_PREDECESSOR,COMMERCE_ENTERPRISE_SOURCE_DOMAINS,COMMERCE_ENTERPRISE_IDENTITY_SOURCES,COMMERCE_ENTERPRISE_OWNED_CURRENT_SOURCES,assertCommerceEnterpriseSourceTransfer,assertCommerceEnterpriseOwnedSource} from '../tools/commerce-enterprise-source-compatibility.js';
import {COMMERCE_ENTERPRISE_CALLER_WIRING_REVISION} from '../tools/commerce-enterprise-source-data.js';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {COMMERCE_SOURCE_REVISION,COMMERCE_SOURCE_PREDECESSOR,COMMERCE_SOURCE_PHASE,COMMERCE_SOURCE_DOMAINS,COMMERCE_OWNED_CURRENT_SOURCE_REVISION,COMMERCE_OWNED_CURRENT_SOURCES,assertCommerceSourceTransfer,assertCommerceOwnedSource,commerceSourceBaseline} from '../tools/commerce-source-compatibility.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024}),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(COMMERCE_SOURCE_REVISION,'da2d9bb64c5fb2fd3409a64d2b0e277421ce281c');
assert.equal(COMMERCE_SOURCE_PREDECESSOR,'dadcfde398c44d7634d709354aabde1d67b724e5');
assert.equal(COMMERCE_OWNED_CURRENT_SOURCE_REVISION,'29598e24bf93813541730aaafb5a556066f7d637');
assert.equal(Object.keys(COMMERCE_SOURCE_DOMAINS).length,30);
assert.equal(Object.keys(COMMERCE_OWNED_CURRENT_SOURCES).length,23);
assert.match(COMMERCE_SOURCE_PHASE,/no native, migration, financial, release or deployment clearance/);
git('merge-base','--is-ancestor',COMMERCE_SOURCE_PREDECESSOR,COMMERCE_SOURCE_REVISION);
git('merge-base','--is-ancestor',COMMERCE_SOURCE_REVISION,COMMERCE_OWNED_CURRENT_SOURCE_REVISION);
let projections=0,owned=0,refusals=0;
for(const[file,p]of Object.entries(COMMERCE_SOURCE_DOMAINS)){
 const raw=git('show',COMMERCE_SOURCE_REVISION+':'+file),current=git('show',COMMERCE_SOURCE_REVISION+':'+file),baseline=git('show',COMMERCE_SOURCE_PREDECESSOR+':'+file);
 assert(raw===current||raw===current.replaceAll('\n','\r\n'),'Historical complete source required: '+file);
 assert.equal(sha(current),p.currentSha256);assert.equal(sha(baseline),p.baselineSha256);assert.equal(p.contextLines,3);assert(p.inverses.length>0);
 for(const input of[raw,current,current.replaceAll('\n','\r\n')]){const proof=assertCommerceSourceTransfer(file,input);assert.equal(proof.baselineText,baseline);assert.equal(proof.sourceRevision,COMMERCE_SOURCE_REVISION);assert.equal(proof.predecessorRevision,COMMERCE_SOURCE_PREDECESSOR);assert.equal(commerceSourceBaseline(file,input),baseline);projections++;}
 assert.equal(commerceSourceBaseline(file,baseline),baseline);
 for(const input of[current+'\n',current.slice(1),'\ufeff'+current,current.replace('\n','\r\n'),current.replace('\n','\r')]){assert.throws(()=>assertCommerceSourceTransfer(file,input));refusals++;}
 for(const h of p.inverses)for(const input of[current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current),current.replace(h.current,()=>h.baseline)]){assert.throws(()=>assertCommerceSourceTransfer(file,input));refusals++;}
 assert(Object.isFrozen(p)&&Object.isFrozen(p.inverses)&&p.inverses.every(Object.isFrozen));assert.throws(()=>{p.currentSha256='0'.repeat(64);},TypeError);refusals++;
}
for(const[file,p]of Object.entries(COMMERCE_OWNED_CURRENT_SOURCES)){
 const raw=selectFinalServicesCommerceTestSource(file,fs.readFileSync(path.join(root,file),'utf8')),current=git('show',COMMERCE_OWNED_CURRENT_SOURCE_REVISION+':'+file);assert.equal(sha(current),p.currentSha256);
 for(const input of[raw,current,current.replaceAll('\n','\r\n')]){assert.equal(assertCommerceOwnedSource(file,input).sourceRevision,COMMERCE_OWNED_CURRENT_SOURCE_REVISION);owned++;}
 for(const input of[current+'\n',current.replace('\n','\r\n')]){assert.throws(()=>assertCommerceOwnedSource(file,input));refusals++;}
 assert.throws(()=>assertCommerceSourceTransfer(file,current));assert(Object.isFrozen(p));refusals++;
}
for(const file of['__proto__','constructor','toString','../schema.sql','src/unknown.js']){assert.throws(()=>assertCommerceSourceTransfer(file,'x'));assert.throws(()=>assertCommerceOwnedSource(file,'x'));assert.equal(commerceSourceBaseline(file,'x'),'x');refusals+=2;}
assert(Object.isFrozen(COMMERCE_SOURCE_DOMAINS)&&Object.isFrozen(COMMERCE_OWNED_CURRENT_SOURCES));
console.log(JSON.stringify({phase:'PASS_SCOPED_COMMERCE_SOURCE_TRANSFER_ONLY',source:COMMERCE_SOURCE_REVISION,predecessor:COMMERCE_SOURCE_PREDECESSOR,ownedCurrentSource:COMMERCE_OWNED_CURRENT_SOURCE_REVISION,domains:30,currentOnlyOwned:23,projections,owned,refusals,nativeAdmission:false}));

// Distinct S→C→E selected-source proof. Actual S input is separately verified by the dedicated S→C unit; the historical da2→DAD block stays unchanged.
{
 const currentBlob=t=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex');
 const actualRecord=(revision,file)=>{const value=git('ls-tree',revision,'--',file).trim(),m=value.match(/^(100644|100755) blob ([a-f0-9]{40})\t/);assert(m,'Actual committed regular file only: '+file);return{mode:m[1],blob:m[2]};};
 let currentDomains=0,currentIdentities=0,currentOwned=0,currentRefusals=0;
 for(const [kind,records]of [['domain',COMMERCE_ENTERPRISE_SOURCE_DOMAINS],['identity',COMMERCE_ENTERPRISE_IDENTITY_SOURCES]])for(const[file,p]of Object.entries(records)){
  const raw=selectFinalServicesCommerceTestSource(file,fs.readFileSync(path.join(root,file),'utf8')),current=git('show',COMMERCE_ENTERPRISE_SOURCE_REVISION+':'+file),baseline=git('show',COMMERCE_ENTERPRISE_SOURCE_PREDECESSOR+':'+file);
  assert(raw===current||raw===current.replaceAll('\n','\r\n'),'Exact selected C source required after explicit S→C: '+file);
  assert.equal(sha(current),p.currentSha256);assert.equal(currentBlob(current),p.currentBlob);assert.equal(actualRecord(COMMERCE_ENTERPRISE_SOURCE_REVISION,file).mode,p.currentMode);
  assert.equal(sha(baseline),p.baselineSha256);assert.equal(currentBlob(baseline),p.baselineBlob);assert.equal(actualRecord(COMMERCE_ENTERPRISE_SOURCE_PREDECESSOR,file).mode,p.baselineMode);
  for(const input of [raw,current,current.replaceAll('\n','\r\n')]){const proof=assertCommerceEnterpriseSourceTransfer(file,input);assert.equal(proof.baselineText,baseline);assert.equal(proof.sourceRevision,COMMERCE_ENTERPRISE_SOURCE_REVISION);assert.equal(proof.predecessorRevision,COMMERCE_ENTERPRISE_SOURCE_PREDECESSOR);}
  for(const input of [current+'\n// changed\n',current.slice(1),'\ufeff'+current,current.replace('\n','\r\n'),current.replace('\n','\r'),current+'\0',Buffer.from(current)]){assert.throws(()=>assertCommerceEnterpriseSourceTransfer(file,input));currentRefusals++;}
  for(const h of p.inverses??[])for(const input of [current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current)]){assert.throws(()=>assertCommerceEnterpriseSourceTransfer(file,input));currentRefusals++;}
  assert(Object.isFrozen(p));if(kind==='domain')currentDomains++;else{assert.equal(current,baseline);currentIdentities++;}
 }
 for(const[file,p]of Object.entries(COMMERCE_ENTERPRISE_OWNED_CURRENT_SOURCES)){
  const raw=selectFinalServicesCommerceTestSource(file,fs.readFileSync(path.join(root,file),'utf8')),current=git('show',COMMERCE_ENTERPRISE_SOURCE_REVISION+':'+file);assert.equal(git('ls-tree',COMMERCE_ENTERPRISE_SOURCE_PREDECESSOR,'--',file),'','Actual E absence, never a fabricated empty baseline');
  assert(raw===current||raw===current.replaceAll('\n','\r\n'));assert.equal(sha(current),p.currentSha256);assert.equal(actualRecord(COMMERCE_ENTERPRISE_SOURCE_REVISION,file).mode,p.currentMode);
  for(const input of [raw,current,current.replaceAll('\n','\r\n')])assert.equal(assertCommerceEnterpriseOwnedSource(file,input).sourceRevision,COMMERCE_ENTERPRISE_SOURCE_REVISION);
  assert.throws(()=>assertCommerceEnterpriseOwnedSource(file,current+'x'));assert.throws(()=>assertCommerceEnterpriseSourceTransfer(file,current));currentRefusals+=2;assert(Object.isFrozen(p));currentOwned++;
 }
 for(const file of ['__proto__','constructor','toString','../schema.sql','src/unknown.js']){assert.throws(()=>assertCommerceEnterpriseSourceTransfer(file,'unknown'));assert.throws(()=>assertCommerceEnterpriseOwnedSource(file,'unknown'));currentRefusals+=2;}
 console.log(JSON.stringify({phase:'PASS_SCOPED_DISTINCT_S_TO_C_TO_E_SELECTED_SOURCE_MAP',source:COMMERCE_ENTERPRISE_SOURCE_REVISION,predecessor:COMMERCE_ENTERPRISE_SOURCE_PREDECESSOR,callerWiringSource:COMMERCE_ENTERPRISE_CALLER_WIRING_REVISION,currentDomains,currentIdentities,currentOnlyOwned:currentOwned,currentRefusals,nativeAdmission:false,releaseQualified:false}));
}
