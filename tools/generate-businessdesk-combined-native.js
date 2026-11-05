// Explicit maintainer compilation only. Never invoked by tests, guards or runtime.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BUSINESS_DESK_COMBINED_NATIVE_PARENTS as parents, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256 } from './businessdesk-combined-native-parents.js';
import { BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256 } from './businessdesk-combined-source-data.js';
import { assertBusinessDeskCombinedNativeParents, buildBusinessDeskCombinedNativeRow } from './businessdesk-combined-native-provenance.js';
import { ENTERPRISE_NATIVE_FILES } from './enterprise-native.js';
import { enterpriseUxClosure, ENTERPRISE_UX_SUPPORT, ENTERPRISE_UX_ASSETS } from './enterprise-native-ux.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as previous } from './enterprise-native-ux-b35-inputs.js';

const revision=process.argv[2];
assert.equal(process.argv.length,4,'Usage: node tools/generate-businessdesk-combined-native.js <authored-full-SHA> --write');
assert.equal(process.argv[3],'--write');assert.match(revision||'',/^[a-f0-9]{40}$/);
const git=(args,input)=>execFileSync('git',['--no-replace-objects',...args],{input,windowsHide:true,maxBuffer:256*1024*1024});
const text=(...args)=>git(args).toString('utf8');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(text('rev-parse','HEAD').trim(),revision,'Bind only the exact current authored source');
assert.equal(text('status','--porcelain','--untracked-files=all').trim(),'','Commit the entire authored source before compilation');
assertBusinessDeskCombinedNativeParents();
assert.equal(BUSINESS_DESK_COMBINED_SOURCE.status,'SEALED','Bind and commit the top source catalog first');
assert.equal(sha(Buffer.from(JSON.stringify(BUSINESS_DESK_COMBINED_SOURCE))),BUSINESS_DESK_COMBINED_SOURCE_SHA256);
git(['merge-base','--is-ancestor',BUSINESS_DESK_COMBINED_SOURCE.sourceRevision,revision]);
assert.equal(text('rev-parse',BUSINESS_DESK_COMBINED_SOURCE.sourceRevision+'^{tree}').trim(),BUSINESS_DESK_COMBINED_SOURCE.sourceTree);
for(const profile of ['desk','monitor','wiki']){
  const record=parents.profiles[profile];assert.equal(record.provisional,false);
  assert.equal(text('rev-parse',record.revision+'^{tree}').trim(),record.tree);
  git(['merge-base','--is-ancestor',record.revision,revision]);
  const actual=git(['show',revision+':'+record.archiveFile]),original=git(['show',record.revision+':'+record.original.file]);
  assert(actual.equals(original),'Ordinary parent archive is an exact raw Git copy: '+profile);
  assert.equal(sha(actual),record.original.rawSha256);
  assert.equal(text('ls-tree',revision,'--',record.archiveFile).trim(),`${record.original.mode} blob ${record.original.blob}\t${record.archiveFile}`);
}
const records=new Map(text('ls-tree','-r','-z',revision).split('\0').filter(Boolean).map(line=>{
  const at=line.indexOf('\t'),[mode,type,blob]=line.slice(0,at).split(' ');return[line.slice(at+1),{mode,type,blob}];
}));
const roots=new Set([...ENTERPRISE_NATIVE_FILES,...ENTERPRISE_UX_SUPPORT,...ENTERPRISE_UX_ASSETS]);
const requested=[...records].filter(([file,row])=>row.type==='blob'&&(/\.(?:js|mjs|cjs)$/.test(file)||roots.has(file)));
const cache=new Map();
// Git --batch preserves binary/raw bytes and avoids thousands of separate Windows Git processes.
for(let offset=0;offset<requested.length;offset+=200){
  const group=requested.slice(offset,offset+200),buffer=git(['cat-file','--batch'],Buffer.from(group.map(([,row])=>row.blob).join('\n')+'\n'));let at=0;
  for(const[file,row]of group){const end=buffer.indexOf(10,at);assert(end>=at);const header=buffer.subarray(at,end).toString('ascii').match(/^([a-f0-9]{40}) blob ([0-9]+)$/);assert(header&&header[1]===row.blob);const size=Number(header[2]);assert(Number.isSafeInteger(size));at=end+1;const bytes=buffer.subarray(at,at+size);assert.equal(bytes.length,size);at+=size;assert.equal(buffer[at++],10);cache.set(file,bytes);}
  assert.equal(at,buffer.length);
}
const read=file=>{const row=records.get(file);assert(row&&row.type==='blob'&&['100644','100755'].includes(row.mode),'Actual regular authored native input: '+file);if(!cache.has(file))cache.set(file,git(['show',revision+':'+file]));return cache.get(file);};
const nativeClosure=enterpriseUxClosure(ENTERPRISE_NATIVE_FILES,read);
const actual=nativeClosure.map(file=>{const row=records.get(file),bytes=read(file);return{file,mode:row.mode,blob:row.blob,sha256:sha(bytes)};});
const prior=new Map(previous.files.map(row=>[row.file,row]));
const changed=actual.filter(row=>{const old=prior.get(row.file);return old&&(old.mode!==row.mode||old.blob!==row.blob||old.sha256!==row.sha256);}).sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
const files=changed.map(row=>buildBusinessDeskCombinedNativeRow(row.file,row));
const data={version:1,status:'SEALED',phase:'EXACT_MONITOR_WIKI_DESK_NATIVE_PROVENANCE_ONLY',sourceRevision:revision,
  sourceTree:text('rev-parse',revision+'^{tree}').trim(),topSourceDefinitionSha256:BUSINESS_DESK_COMBINED_SOURCE_SHA256,
  parentRegistryDefinitionSha256:BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256,nativeClosure,reviewedFiles:parents.reviewedFiles,
  files,sourceOnly:true,nativeAdmission:false,priorResultsTransferred:false};
const digest=sha(Buffer.from(JSON.stringify(data)));
const output='// Exact current source-provenance data only. Native admission executes actual untransformed source.\n'
  +"const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};\n"
  +`export const BUSINESS_DESK_COMBINED_NATIVE=freeze(${JSON.stringify(data,null,2)});\n`
  +`export const BUSINESS_DESK_COMBINED_NATIVE_SHA256=${JSON.stringify(digest)};\n`;
const destination=new URL('./businessdesk-combined-native-data.js',import.meta.url),temporary=new URL('./businessdesk-combined-native-data.js.tmp',import.meta.url);
fs.writeFileSync(temporary,output,{flag:'wx'});fs.renameSync(temporary,destination);
console.log(JSON.stringify({phase:data.phase,source:revision,tree:data.sourceTree,nativeClosure:nativeClosure.length,existingNativeRelations:files.length,
  deterministicOwners:Object.fromEntries(['desk','monitor','wiki'].map(p=>[p,files.filter(r=>r.profile===p).length])),digest,nativeAdmission:false,priorResultsTransferred:false}));
