// Current typed source/data proof only. This does not qualify native/migration/gameplay/release execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ENTERPRISE_CURRENT_SOURCE_REVISION,ENTERPRISE_ROOT_PREDECESSOR,ENTERPRISE_CURRENT_LEGACY_PREDECESSOR,ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES,ENTERPRISE_CURRENT_LEGACY6B_DOMAINS,enterpriseOverRootSourceBaseline,enterpriseCurrentHistorical6bSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
assert.deepEqual(process.argv.slice(2),[],'Complete source-only current unit; no native flags');
const hash=t=>crypto.createHash('sha256').update(t).digest('hex'),blob=t=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex'),git=(rev,file)=>execFileSync('git',['show',rev+':'+file],{encoding:'utf8',maxBuffer:64*1024*1024}),lf=t=>t.replaceAll('\r\n','\n');
let positives=0,refusals=0;const pins={...ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,...ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES};
assert.equal(Object.keys(ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS).length,31);
for(const[file,p]of Object.entries(pins)){
  const raw=fs.readFileSync(file,'utf8'),current=git(ENTERPRISE_CURRENT_SOURCE_REVISION,file),root=git(ENTERPRISE_ROOT_PREDECESSOR,file);
  assert.equal(hash(lf(raw)),p.currentSha256,'Actual current input must match the current phase, not merely a Root baseline');assert.equal(blob(lf(raw)),p.currentBlob);assert.equal(lf(raw),current);
  for(const input of [raw,current,current.replaceAll('\n','\r\n'),root]){assert.equal(enterpriseOverRootSourceBaseline(file,input),root);positives++;}
  for(const input of [current+'\n// unknown\n',current.slice(1),'\ufeff'+current,current.replace('\n','\r\n'),current.replace('\n','\r'),Buffer.from(current)]){assert.throws(()=>enterpriseOverRootSourceBaseline(file,input));refusals++;}
  for(const h of p.inverses)for(const input of [current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current)]){assert.throws(()=>enterpriseOverRootSourceBaseline(file,input));refusals++;}
  assert(Object.isFrozen(p)&&Object.isFrozen(p.inverses)&&p.inverses.every(Object.isFrozen));
}
for(const[file,p]of Object.entries(ENTERPRISE_CURRENT_LEGACY6B_DOMAINS)){
  const current=git(ENTERPRISE_CURRENT_SOURCE_REVISION,file),root=git(ENTERPRISE_ROOT_PREDECESSOR,file),prior=git(ENTERPRISE_CURRENT_LEGACY_PREDECESSOR,file);
  for(const input of [current,current.replaceAll('\n','\r\n'),root,prior]){assert.equal(enterpriseCurrentHistorical6bSourceBaseline(file,input),prior);positives++;}
  for(const input of [current+'\n// unknown\n',root+'\n// unknown\n','\ufeff'+current,current.replace('\n','\r\n')]){assert.throws(()=>enterpriseCurrentHistorical6bSourceBaseline(file,input));refusals++;}
  assert.equal(hash(prior),p.baselineSha256);assert.equal(blob(prior),p.baselineBlob);
}
for(const file of ['__proto__','constructor','toString','src/unknown.js','schema.sql.extra','../schema.sql'])for(const fn of [enterpriseOverRootSourceBaseline,enterpriseCurrentHistorical6bSourceBaseline]){assert.throws(()=>fn(file,'unknown'));refusals++;}
console.log(JSON.stringify({phase:'CURRENT_TYPED_ENTERPRISE_SOURCE_ONLY',source:ENTERPRISE_CURRENT_SOURCE_REVISION,root:ENTERPRISE_ROOT_PREDECESSOR,legacy:ENTERPRISE_CURRENT_LEGACY_PREDECESSOR,positives,refusals,postgres:false,native:false,release:false}));

// Exact two-file authored-union witness; old GUI3217/HG source proofs remain separate.
import {ENTERPRISE_GUI_SOURCE_REVISION,ENTERPRISE_GUI_PREDECESSOR,ENTERPRISE_OVER_GUI_SOURCE_DOMAINS,enterpriseOverGuiSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import {qualifyCityActivityMarketSource} from '../tools/rc1-city-activity-market-source-compatibility.js';
assert.deepEqual(Object.keys(ENTERPRISE_OVER_GUI_SOURCE_DOMAINS),['src/server.js','package.json']);
let guiPositives=0,guiRefusals=0;
for(const[file,p]of Object.entries(ENTERPRISE_OVER_GUI_SOURCE_DOMAINS)){
  const raw=fs.readFileSync(file,'utf8'),current=git(ENTERPRISE_GUI_SOURCE_REVISION,file),gui=git(ENTERPRISE_GUI_PREDECESSOR,file);
  assert.equal(lf(raw),current,'Actual union input must match the distinct GUI witness');assert.equal(hash(current),p.currentSha256);assert.equal(blob(current),p.currentBlob);assert.equal(hash(gui),p.baselineSha256);assert.equal(blob(gui),p.baselineBlob);
  for(const input of [raw,current,current.replaceAll('\n','\r\n')]){const selected=enterpriseOverGuiSourceBaseline(file,input);assert.equal(selected,gui);assert.equal(qualifyCityActivityMarketSource(file,selected).baselineText,git('b6be98c7e0233c4b35a74467828e24080b16b0eb',file));assert.equal(hash(input),p.currentRawSha256[input.includes('\r\n')?'crlf':'lf']);guiPositives++;}
  for(const input of [gui,current+'\n// unknown\n',current.slice(1),'\ufeff'+current,current+'\0',current.replace('\n','\r\n'),current.replace('\n','\r'),Buffer.from(current)]){assert.throws(()=>enterpriseOverGuiSourceBaseline(file,input));guiRefusals++;}
  for(const h of p.inverses)for(const input of [current.replace(h.current,''),current.replace(h.current,()=>h.current+h.current)]){assert.throws(()=>enterpriseOverGuiSourceBaseline(file,input));guiRefusals++;}
  assert(Object.isFrozen(p)&&Object.isFrozen(p.currentRawSha256)&&Object.isFrozen(p.inverses)&&p.inverses.every(Object.isFrozen));
}
for(const file of ['__proto__','constructor','toString','schema.sql','src/unknown.js','../src/server.js']){assert.throws(()=>enterpriseOverGuiSourceBaseline(file,'unknown'));guiRefusals++;}
console.log(JSON.stringify({phase:'DISTINCT_ENTERPRISE_TO_GUI_SOURCE_ONLY',source:ENTERPRISE_GUI_SOURCE_REVISION,gui:ENTERPRISE_GUI_PREDECESSOR,positives:guiPositives,refusals:guiRefusals,native:false,postgres:false,release:false}));
