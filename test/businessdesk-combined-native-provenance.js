import { ENTERPRISE_NATIVE_UX_INPUTS as acceptedNative } from '../tools/enterprise-native-economic-release-inputs.js';
// Source/pin qualification only. No PostgreSQL, historical workload execution or release transfer.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BUSINESS_DESK_COMBINED_NATIVE_PARENTS as parents, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256 as parentSha } from '../tools/businessdesk-combined-native-parents.js';
import { BUSINESS_DESK_COMBINED_NATIVE as data, BUSINESS_DESK_COMBINED_NATIVE_SHA256 as dataSha } from '../tools/businessdesk-combined-native-data.js';
import { BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256 } from '../tools/businessdesk-combined-source-data.js';
import { BUSINESS_DESK_COMBINED_NATIVE_PARENT_OBJECTS, assertBusinessDeskCombinedNativeParents,
  assertBusinessDeskCombinedNativeDefinition, businessDeskCombinedNativeProvenance } from '../tools/businessdesk-combined-native-provenance.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as current } from '../tools/enterprise-native-deed-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as previous } from '../tools/enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as activeNative, assertEnterpriseUxTrackedInput } from '../tools/enterprise-native-ux.js';
import { economicReleaseNativeProvenance } from '../tools/economic-release-native-provenance.js';

assert.deepEqual(process.argv.slice(2),[],'Bare source-only entrypoint required');
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{windowsHide:true,maxBuffer:64*1024*1024});
const text=(...args)=>git(...args).toString('utf8');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>a&&b&&a.mode===b.mode&&a.blob===b.blob&&a.sha256===b.sha256;
const tree=revision=>new Map(text('ls-tree','-r','-z',revision).split('\0').filter(Boolean).map(line=>{
  const at=line.indexOf('\t'),[mode,type,blob]=line.slice(0,at).split(' ');return[line.slice(at+1),Object.freeze({mode,type,blob})];
}));
// Read literal JSON data without evaluating a historical module or workload.
function literal(source,name){
  const declaration=source.indexOf('export const '+name);assert(declaration>=0,'Known literal data export');
  const start=source.indexOf('{',declaration);assert(start>=0);let depth=0,string=false,escaped=false;
  for(let at=start;at<source.length;at++){
    const c=source[at];if(string){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')string=false;continue;}
    if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(source.slice(start,at+1));
  }
  assert.fail('Incomplete literal data object');
}
let checks=0,refusals=0;
const refuse=run=>{assert.throws(run);refusals++;};
assertBusinessDeskCombinedNativeParents();assertBusinessDeskCombinedNativeDefinition();
assert.equal(sha(JSON.stringify(parents)),parentSha);assert.equal(sha(JSON.stringify(data)),dataSha);
assert.equal(data.topSourceDefinitionSha256,BUSINESS_DESK_COMBINED_SOURCE_SHA256);
assert.equal(data.parentRegistryDefinitionSha256,parentSha);
assert.equal(current.version,6);assert.equal(current.phase,'ACTUAL_ENTERPRISE_MONITOR_WIKI_DESK_NATIVE_INPUTS');
assert.equal(data.sourceOnly,true);assert.equal(data.nativeAdmission,false);assert.equal(data.priorResultsTransferred,false);
for(const clone of [{...parents},structuredClone(parents)])refuse(()=>assertBusinessDeskCombinedNativeParents(clone));
for(const clone of [{...data},structuredClone(data)])refuse(()=>assertBusinessDeskCombinedNativeDefinition(clone));
assert.equal(text('rev-parse',data.sourceRevision+'^{tree}').trim(),data.sourceTree);
git('merge-base','--is-ancestor',BUSINESS_DESK_COMBINED_SOURCE.sourceRevision,data.sourceRevision);
git('merge-base','--is-ancestor',data.sourceRevision,'HEAD');
const head=tree('HEAD'),authored=tree(activeNative.authoredRevision),priorRows=new Map(previous.files.map(row=>[row.file,row]));
const immutableRecord=file=>{const bytes=git('show','HEAD:'+file),row=head.get(file),stat=fs.lstatSync(file),physical=fs.readFileSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());assert(physical.equals(bytes)||physical.equals(Buffer.from(bytes.toString().replaceAll('\n','\r\n'))),'Raw physical source matches actual HEAD before any historical view');return{bytes,row};};
for(const profile of ['desk','monitor','wiki']){
  const p=parents.profiles[profile];assert.equal(p.provisional,false);assert.equal(text('rev-parse',p.revision+'^{tree}').trim(),p.tree);
  git('merge-base','--is-ancestor',parents.commonRevision,p.revision);git('merge-base','--is-ancestor',p.revision,data.sourceRevision);
  const original=git('show',p.revision+':'+p.original.file),actual=immutableRecord(p.archiveFile);
  assert(actual.bytes.equals(original),'Archive is an exact ordinary raw Git copy of the frozen parent descriptor');
  assert.equal(actual.row.mode,p.original.mode);assert.equal(actual.row.blob,p.original.blob);assert.equal(sha(actual.bytes),p.original.rawSha256);
  const rawObject=literal(original.toString(),'ENTERPRISE_NATIVE_UX_INPUTS');
  assert.deepEqual(rawObject,BUSINESS_DESK_COMBINED_NATIVE_PARENT_OBJECTS[profile]);assert.equal(sha(JSON.stringify(rawObject)),p.definitionSha256);
  const captured=current.files.find(row=>row.file===p.archiveFile);assert(captured);assert.equal(captured.blob,p.original.blob);assert.equal(captured.sha256,p.original.rawSha256);
  const transitions=rawObject.files.filter(row=>{const old=priorRows.get(row.file);return old&&!same(row,old);}).map(row=>row.file).sort();
  assert.deepEqual(parents.parentPaths[profile].map(row=>row.file),transitions,'No archived existing-input relation is skipped');
  for(const row of parents.parentPaths[profile]){assert.deepEqual(row.current,rawObject.files.find(pin=>pin.file===row.file));assert.deepEqual(row.predecessor,priorRows.get(row.file));assert(row.edges.length>0);checks++;}
  assert.equal(assertEnterpriseUxTrackedInput(p.archiveFile,actual.row,authored.get(p.archiveFile),actual.bytes),null,'An ordinary addition invents no B35 transition');
  refuse(()=>assertEnterpriseUxTrackedInput(p.archiveFile,actual.row,authored.get(p.archiveFile),Buffer.concat([actual.bytes,Buffer.from('\n')])));
  checks++;
}
for(const record of Object.values(parents.immutable)){
  const actual=immutableRecord(record.file);assert.equal(actual.row.mode,record.mode);assert.equal(actual.row.blob,record.blob);assert.equal(sha(actual.bytes),record.rawSha256);
  assert.equal(sha(JSON.stringify(literal(actual.bytes.toString(),'ENTERPRISE_NATIVE_UX_INPUTS'))),record.definitionSha256);checks++;
}
for(const record of Object.values(parents.catalogs)){
  const original=git('show',record.revision+':'+record.source.file);assert.equal(sha(original),record.source.rawSha256);
  const row=tree(record.revision).get(record.source.file);assert.equal(row.mode,record.source.mode);assert.equal(row.blob,record.source.blob);
  const object=literal(original.toString(),record.exportName);assert.equal(sha(JSON.stringify(object)),record.definitionSha256,'Original data definition remains bound to frozen Git');
  if(record.exportName==='BUSINESS_DESK_DOMAINS'){
    assert.deepEqual(Object.keys(object),Object.keys(parents.businessPins));
    for(const[file,pin]of Object.entries(object))assert.deepEqual(parents.businessPins[file],{
      current:{file,mode:pin.mode,blob:pin.currentBlob,sha256:pin.currentSha256},
      baseline:{file,mode:pin.baselineMode,blob:pin.baselineBlob,sha256:pin.baselineSha256},
    },'Pure Business pin snapshot matches the original literal; no HistoricalInput import');
  }
  checks++;
}
let currentRelations=0,sample;
for(const row of data.files){
  const before=priorRows.get(row.file),expected=current.files.find(pin=>pin.file===row.file);assert(before&&expected);
  assert.equal(row.profile,parents.ownerByFile[row.file]);assert.deepEqual(row.current,expected);
  const proof=businessDeskCombinedNativeProvenance(row.file,before,expected);
  assert(Object.isFrozen(proof)&&Object.isFrozen(proof.current));
  assert.deepEqual(Object.keys(proof).sort(),['file','current','predecessor','predecessorRevision','relation','nativeAdmission','priorResultsTransferred'].sort());
  assert.strictEqual(proof.predecessor,before);assert.equal(proof.predecessorRevision,previous.authoredRevision);
  assert.equal(proof.relation,'exact-reviewed-monitor-wiki-desk-native-pin-provenance-only');
  assert.deepEqual(proof.current,{mode:expected.mode,blob:expected.blob,sha256:expected.sha256});assert.equal(proof.nativeAdmission,false);assert.equal(proof.priorResultsTransferred,false);
  refuse(()=>businessDeskCombinedNativeProvenance(row.file,Object.freeze({...before}),expected));
  refuse(()=>businessDeskCombinedNativeProvenance(row.file,before,Object.freeze({...expected})));
  for(const archive of Object.values(BUSINESS_DESK_COMBINED_NATIVE_PARENT_OBJECTS)){
    const parent=archive.files.find(pin=>pin.file===row.file);if(parent)refuse(()=>businessDeskCombinedNativeProvenance(row.file,before,parent));
  }
  const bytes=git('show','HEAD:'+row.file),now=head.get(row.file),anchor=authored.get(row.file);
  const actualExpected=activeNative.files.find(pin=>pin.file===row.file);assert(actualExpected);
  assert.equal(sha(bytes),actualExpected.sha256);
  const admitted=assertEnterpriseUxTrackedInput(row.file,now,anchor,bytes);
  assert.strictEqual(admitted.current,actualExpected);
  const accepted=acceptedNative.files.find(pin=>pin.file===row.file);assert(accepted);
  assert.strictEqual(admitted.intermediate,accepted);
  assert.equal(sha(git('show',current.authoredRevision+':'+row.file)),expected.sha256);
  assert.deepEqual(economicReleaseNativeProvenance(row.file,accepted),admitted.prior);
  refuse(()=>economicReleaseNativeProvenance(row.file,Object.freeze({...accepted})));
  refuse(()=>economicReleaseNativeProvenance(row.file,Object.freeze({...accepted,sha256:'0'.repeat(64)})));
  refuse(()=>economicReleaseNativeProvenance(row.file,expected));
  refuse(()=>economicReleaseNativeProvenance(row.file,actualExpected));
  assert.strictEqual(admitted.predecessor,before);assert.deepEqual(admitted.prior.deskProvenance??admitted.prior,proof);
  if(actualExpected.blob!==expected.blob)refuse(()=>assertEnterpriseUxTrackedInput(row.file,now,anchor,git('show',current.authoredRevision+':'+row.file)));
  assert.equal(admitted.nativeAdmission,false);assert.equal(admitted.priorResultsTransferred,false);
  for(const raw of [Buffer.concat([bytes,Buffer.from('\n')]),bytes.subarray(1),bytes.toString(),Buffer.from(bytes.toString().replaceAll('\n','\r\n'))])refuse(()=>assertEnterpriseUxTrackedInput(row.file,now,anchor,raw));
  refuse(()=>assertEnterpriseUxTrackedInput(row.file,{...now,mode:now.mode==='100644'?'100755':'100644'},anchor,bytes));
  refuse(()=>assertEnterpriseUxTrackedInput(row.file,now,{...anchor,blob:'0'.repeat(40)},bytes));
  refuse(()=>assertEnterpriseUxTrackedInput(row.file,now,anchor,bytes,Object.freeze({...current})));
  refuse(()=>{proof.nativeAdmission=true;});refuse(()=>{proof.current.blob='0'.repeat(40);});
  sample||={row,before,expected,now,anchor,bytes};currentRelations++;
}
assert(currentRelations>0&&sample);
const packageRow=data.files.find(row=>row.file==='package.json');assert(packageRow,'The combined package exercises a shared three-parent source transition');
for(const profile of ['desk','monitor','wiki']){
  const raw=git('show',parents.profiles[profile].revision+':package.json'),now=head.get('package.json'),anchor=authored.get('package.json');
  assert(!raw.equals(git('show','HEAD:package.json')),'Combined package retains a distinct actual current source');
  refuse(()=>assertEnterpriseUxTrackedInput('package.json',now,anchor,raw));
}
for(const unknown of ['unknown','__proto__','constructor','../src/server.js',null,undefined,1,Symbol('domain'),Object.freeze({toString(){throw Error('No coercion');}})])assert.equal(businessDeskCombinedNativeProvenance(unknown,sample.before,sample.expected),null);
const addition=current.files.find(row=>!priorRows.has(row.file));assert(addition);assert.equal(businessDeskCombinedNativeProvenance(addition.file,undefined,addition),null);
refuse(()=>{data.files.push({file:'unreviewed'});});refuse(()=>{parents.ownerByFile['package.json']='wiki';});
console.log(JSON.stringify({phase:'BUSINESS_DESK_COMBINED_NATIVE_SOURCE_GUARDS',source:current.authoredRevision,sourceCatalog:data.sourceRevision,
  parentTransitions:Object.fromEntries(Object.entries(parents.parentPaths).map(([name,rows])=>[name,rows.length])),currentRelations,checks,refusals,
  ordinaryArchives:3,nativeExecution:false,postgresImportsOrConnections:0,nativeAdmission:false,priorResultsTransferred:false}));
