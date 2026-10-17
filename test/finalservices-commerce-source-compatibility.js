// Dedicated actual S→C source proof. No native/runtime/release qualification and no fallback data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {FINAL_SERVICES_COMMERCE_SOURCE_BINDING,hasFinalServicesCommerceSource,assertFinalServicesCommerceSourceTransfer,finalServicesOverCommerceSourceBaseline} from '../tools/finalservices-commerce-source-compatibility.js';
assert.deepEqual(process.argv.slice(2),[],'Complete source-only unit; no operational flags');
assert(FINAL_SERVICES_COMMERCE_SOURCE_BINDING,'UNBOUND S→C data; Root must author A/C and data-only B');
const data=FINAL_SERVICES_COMMERCE_SOURCE_BINDING;
const git=(...args)=>execFileSync('git',['--no-replace-objects','-c','core.longpaths=true',...args],{encoding:'utf8',maxBuffer:64*1024*1024});
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const blob=text=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
git('merge-base','--is-ancestor',data.predecessorRevision,data.sourceRevision);
const record=(revision,file)=>{const rows=git('ls-tree','-z',revision,'--',file).split('\0');assert.equal(rows.length,2);assert.equal(rows[1],'');const match=rows[0].match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);assert(match);assert.equal(match[3],file);return{mode:match[1],blob:match[2]};};
let domains=0,identities=0,positives=0,refusals=0;
for(const[file,pin]of Object.entries(data.records)){
  assert(hasFinalServicesCommerceSource(file));
  const current=git('cat-file','blob',data.sourceRevision+':'+file),baseline=git('cat-file','blob',data.predecessorRevision+':'+file),raw=fs.readFileSync(file,'utf8');
  assert.equal(hash(current),pin.currentSha256);assert.equal(blob(current),pin.currentBlob);assert.equal(record(data.sourceRevision,file).mode,pin.currentMode);
  assert.equal(hash(baseline),pin.baselineSha256);assert.equal(blob(baseline),pin.baselineBlob);assert.equal(record(data.predecessorRevision,file).mode,pin.baselineMode);assert.equal(baseline,pin.baselineText);
  const actual=[];let hunk=null;
  for(const line of git('diff','--no-ext-diff','--unified=3',pin.baselineBlob,pin.currentBlob).split('\n')){
    if(line.startsWith('@@')){hunk={current:'',baseline:''};actual.push(hunk);}
    else if(hunk&&/^[ +\-]/.test(line)){if(line[0]!=='-')hunk.current+=line.slice(1)+'\n';if(line[0]!=='+')hunk.baseline+=line.slice(1)+'\n';}
    else if(line==='\\ No newline at end of file')assert.fail('Source no-newline context requires separate reviewed representation');
  }
  assert.deepEqual(pin.inverses,actual,'Only full genuine Git context3 inverse families');
  for(const input of [raw,current,current.replaceAll('\n','\r\n')]){const proof=assertFinalServicesCommerceSourceTransfer(file,input);assert.equal(proof.baselineText,baseline);assert.equal(proof.sourceRevision,data.sourceRevision);assert.equal(proof.predecessorRevision,data.predecessorRevision);assert.equal(proof.nativeAdmission,false);assert.equal(finalServicesOverCommerceSourceBaseline(file,input),baseline);positives++;}
  for(const input of [current+'\n// unknown\n',current.slice(1),'\ufeff'+current,current+'\0',current.replace('\n','\r\n'),current.replace('\n','\r'),Buffer.from(current)]){assert.throws(()=>assertFinalServicesCommerceSourceTransfer(file,input));refusals++;}
  for(const h of pin.inverses)for(const input of [current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current)]){assert.throws(()=>assertFinalServicesCommerceSourceTransfer(file,input));refusals++;}
  if(pin.kind==='domain')domains++;else{assert.equal(current,baseline);identities++;}
}
for(const file of ['__proto__','constructor','toString','../schema.sql','schema.sql.extra','src/unknown.js']){assert.equal(hasFinalServicesCommerceSource(file),false);assert.throws(()=>assertFinalServicesCommerceSourceTransfer(file,'unknown'));assert.throws(()=>finalServicesOverCommerceSourceBaseline(file,'unknown'));refusals+=2;}
console.log(JSON.stringify({phase:'EXACT_FINAL_SERVICES_OVER_COMMERCE_SOURCE_ONLY',source:data.sourceRevision,predecessor:data.predecessorRevision,domains,identities,positives,refusals,postgres:false,native:false,release:false}));
