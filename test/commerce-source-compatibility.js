// Generated from actual committed Commerce source and its genuine Enterprise predecessor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {COMMERCE_SOURCE_REVISION,COMMERCE_SOURCE_PREDECESSOR,COMMERCE_SOURCE_PHASE,COMMERCE_SOURCE_DOMAINS,COMMERCE_OWNED_CURRENT_SOURCES,assertCommerceSourceTransfer,assertCommerceOwnedSource,commerceSourceBaseline} from '../tools/commerce-source-compatibility.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024}),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(COMMERCE_SOURCE_REVISION,'da2d9bb64c5fb2fd3409a64d2b0e277421ce281c');
assert.equal(COMMERCE_SOURCE_PREDECESSOR,'dadcfde398c44d7634d709354aabde1d67b724e5');
assert.equal(Object.keys(COMMERCE_SOURCE_DOMAINS).length,30);
assert.equal(Object.keys(COMMERCE_OWNED_CURRENT_SOURCES).length,23);
assert.match(COMMERCE_SOURCE_PHASE,/no native, migration, financial, release or deployment clearance/);
git('merge-base','--is-ancestor',COMMERCE_SOURCE_PREDECESSOR,COMMERCE_SOURCE_REVISION);
let projections=0,owned=0,refusals=0;
for(const[file,p]of Object.entries(COMMERCE_SOURCE_DOMAINS)){
 const raw=fs.readFileSync(path.join(root,file),'utf8'),current=git('show',COMMERCE_SOURCE_REVISION+':'+file),baseline=git('show',COMMERCE_SOURCE_PREDECESSOR+':'+file);
 assert(raw===current||raw===current.replaceAll('\n','\r\n'),'Physical complete source required: '+file);
 assert.equal(sha(current),p.currentSha256);assert.equal(sha(baseline),p.baselineSha256);assert.equal(p.contextLines,3);assert(p.inverses.length>0);
 for(const input of[raw,current,current.replaceAll('\n','\r\n')]){const proof=assertCommerceSourceTransfer(file,input);assert.equal(proof.baselineText,baseline);assert.equal(proof.sourceRevision,COMMERCE_SOURCE_REVISION);assert.equal(proof.predecessorRevision,COMMERCE_SOURCE_PREDECESSOR);assert.equal(commerceSourceBaseline(file,input),baseline);projections++;}
 assert.equal(commerceSourceBaseline(file,baseline),baseline);
 for(const input of[current+'\n',current.slice(1),'\ufeff'+current,current.replace('\n','\r\n'),current.replace('\n','\r')]){assert.throws(()=>assertCommerceSourceTransfer(file,input));refusals++;}
 for(const h of p.inverses)for(const input of[current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current),current.replace(h.current,()=>h.baseline)]){assert.throws(()=>assertCommerceSourceTransfer(file,input));refusals++;}
 assert(Object.isFrozen(p)&&Object.isFrozen(p.inverses)&&p.inverses.every(Object.isFrozen));assert.throws(()=>{p.currentSha256='0'.repeat(64);},TypeError);refusals++;
}
for(const[file,p]of Object.entries(COMMERCE_OWNED_CURRENT_SOURCES)){
 const raw=fs.readFileSync(path.join(root,file),'utf8'),current=git('show',COMMERCE_SOURCE_REVISION+':'+file);assert.equal(sha(current),p.currentSha256);
 for(const input of[raw,current,current.replaceAll('\n','\r\n')]){assert.equal(assertCommerceOwnedSource(file,input).sourceRevision,COMMERCE_SOURCE_REVISION);owned++;}
 for(const input of[current+'\n',current.replace('\n','\r\n')]){assert.throws(()=>assertCommerceOwnedSource(file,input));refusals++;}
 assert.throws(()=>assertCommerceSourceTransfer(file,current));assert(Object.isFrozen(p));refusals++;
}
for(const file of['__proto__','constructor','toString','../schema.sql','src/unknown.js']){assert.throws(()=>assertCommerceSourceTransfer(file,'x'));assert.throws(()=>assertCommerceOwnedSource(file,'x'));assert.equal(commerceSourceBaseline(file,'x'),'x');refusals+=2;}
assert(Object.isFrozen(COMMERCE_SOURCE_DOMAINS)&&Object.isFrozen(COMMERCE_OWNED_CURRENT_SOURCES));
console.log(JSON.stringify({phase:'PASS_SCOPED_COMMERCE_SOURCE_TRANSFER_ONLY',source:COMMERCE_SOURCE_REVISION,predecessor:COMMERCE_SOURCE_PREDECESSOR,domains:30,currentOnlyOwned:23,projections,owned,refusals,nativeAdmission:false}));
