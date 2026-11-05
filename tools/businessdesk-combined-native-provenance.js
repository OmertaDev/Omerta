// DATA-only pin relations. The caller admits actual current/authored raw bytes first.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BUSINESS_DESK_COMBINED_NATIVE_PARENTS as parents, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256 as parentsSha } from './businessdesk-combined-native-parents.js';
import { BUSINESS_DESK_COMBINED_NATIVE, BUSINESS_DESK_COMBINED_NATIVE_SHA256 } from './businessdesk-combined-native-data.js';
import { BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256 } from './businessdesk-combined-source-data.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as desk, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as deskSha } from './businessdesk-desk-parent-native-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as monitor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as monitorSha } from './businessdesk-monitor-parent-native-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as wiki, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as wikiSha } from './businessdesk-wiki-parent-native-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as current } from './enterprise-native-deed-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as previous } from './enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as qualifiedUx } from './enterprise-native-ux-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as deedNative } from './businessdesk-deed-native-inputs.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';
import { NOIR_UI_SOURCE } from './noir-ui-source-data.js';
import { BUSINESS_DESK_NOIR_SOURCE } from './businessdesk-noir-source-data.js';
import { ECONOMY_DEED_MERGE_NATIVE_PROVENANCE } from './economy-deed-merge-source-data.js';
import { WIKI_MEDIA_SOURCE, WIKI_MEDIA_MERGE_SOURCE, WIKI_MEDIA_NOIR_MERGE_SOURCE } from './wiki-media-source-data.js';

export const BUSINESS_DESK_COMBINED_NATIVE_PARENT_OBJECTS=Object.freeze({desk,monitor,wiki});
const profiles=Object.freeze(['desk','monitor','wiki']);
const catalogs=Object.freeze({deed:DEED_ALLOCATION_SOURCE_DOMAINS,noir:NOIR_UI_SOURCE,deskNoir:BUSINESS_DESK_NOIR_SOURCE,
  monitor:ECONOMY_DEED_MERGE_NATIVE_PROVENANCE,wiki:WIKI_MEDIA_SOURCE,wikiMerge:WIKI_MEDIA_MERGE_SOURCE,wikiNoir:WIKI_MEDIA_NOIR_MERGE_SOURCE});
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keys=(value,names)=>assert.deepEqual(Object.keys(value).sort(),[...names].sort(),'Closed combined native record');
const same=(a,b)=>!!a&&!!b&&a.file===b.file&&a.mode===b.mode&&a.blob===b.blob&&a.sha256===b.sha256;
const pin=(file,mode,blob,sha256)=>({file,mode,blob,sha256});
const named=(file,row,kind)=>pin(file,row[kind+'Mode'],row[kind+'Blob'],row[kind+'Sha256']);
const wikiPin=(file,row)=>pin(file,row.mode,row.lf.blob,row.lf.sha256);
const checkPin=row=>{keys(row,['file','mode','blob','sha256']);assert.equal(typeof row.file,'string');assert(['100644','100755'].includes(row.mode));assert.match(row.blob,/^[a-f0-9]{40}$/);assert.match(row.sha256,/^[a-f0-9]{64}$/);assert(Object.isFrozen(row));};
const relation='exact-reviewed-monitor-wiki-desk-native-pin-provenance-only';
// These imported catalogs are deeply frozen. Cache only after complete validation;
// strict caller object identity is checked before any cached result is returned.
let parentsValidated=false,sourceValidated=false,nativeValidated=false;

function knownEdge(kind,file){
  if(kind==='desk-noir-combined') {const row=BUSINESS_DESK_NOIR_SOURCE.files.find(r=>r.file===file);assert(row,'Exact Desk/Noir source domain');return [pin(file,row.mode,row.currentBlob,row.currentSha256),named(file,row,'target')];}
  if(kind==='noir') {const row=NOIR_UI_SOURCE.files.find(r=>r.file===file);assert(row&&!row.predecessorAbsent);return [pin(file,row.mode,row.currentBlob,row.currentSha256),named(file,row,'predecessor')];}
  if(kind==='business') {const row=parents.businessPins[file];assert(row,'Exact original Business pin snapshot');return [row.current,row.baseline];}
  if(kind==='deed') {const row=DEED_ALLOCATION_SOURCE_DOMAINS[file];assert(row,'Exact original Deed domain');return [named(file,row,'current'),named(file,row,'baseline')];}
  if(kind==='monitor56') {const row=ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.files.find(r=>r.file===file);assert(row,'Closed original Monitor relation');return [row.current,row.predecessor];}
  if(kind==='wiki-noir-merge') {const row=WIKI_MEDIA_NOIR_MERGE_SOURCE.files[file];assert(row&&!row.wiki.absent);return [wikiPin(file,row.current),wikiPin(file,row.wiki)];}
  if(kind==='wiki-merge') {const row=WIKI_MEDIA_MERGE_SOURCE.files[file];assert(row&&!row.main.absent);return [wikiPin(file,row.current),wikiPin(file,row.main)];}
  assert.fail('Unknown combined parent pin edge: '+kind);
}

export function assertBusinessDeskCombinedNativeParents(registry=parents){
  assert.strictEqual(registry,parents,'Only the imported combined parent registry');
  if(parentsValidated)return registry;
  keys(registry,['version','status','phase','commonRevision','profiles','catalogs','immutable','businessPins','reviewedFiles','ownerByFile','sharedOverrides','parentPaths','sourceOnly','nativeAdmission','priorResultsTransferred']);
  assert.equal(registry.status,'SEALED','Parent registry is UNBOUND; provisional parents cannot authorize a binding');
  assert.equal(registry.version,1);assert.equal(registry.phase,'EXACT_MONITOR_WIKI_DESK_NATIVE_PARENTS');
  assert.equal(sha(registry),parentsSha);assert(Object.isFrozen(registry));
  assert.match(registry.commonRevision,/^[a-f0-9]{40}$/);
  assert(Object.isFrozen(registry.profiles)&&Object.isFrozen(registry.parentPaths)&&Object.isFrozen(registry.ownerByFile)&&Object.isFrozen(registry.businessPins));
  assert.deepEqual(Object.keys(registry.profiles),profiles);assert.deepEqual(Object.keys(registry.parentPaths),profiles);
  for(const profile of profiles){
    const record=registry.profiles[profile],archive=BUSINESS_DESK_COMBINED_NATIVE_PARENT_OBJECTS[profile];
    keys(record,['revision','tree','archiveFile','original','definitionSha256','authoredRevision','version','phase','provisional']);
    keys(record.original,['file','mode','blob','rawSha256']);
    assert.equal(record.original.mode,'100644');assert.match(record.original.blob,/^[a-f0-9]{40}$/);assert.match(record.original.rawSha256,/^[a-f0-9]{64}$/);
    assert.equal(record.provisional,false,'An explicitly accepted parent is required');
    assert.equal(record.original.file,'tools/enterprise-native-deed-inputs.js');
    assert.equal(record.archiveFile,'tools/businessdesk-'+profile+'-parent-native-inputs.js');
    assert.match(record.revision,/^[a-f0-9]{40}$/);assert.match(record.tree,/^[a-f0-9]{40}$/);
    assert.equal(archive.status,'SEALED');assert.equal(archive.authoredRevision,record.authoredRevision);
    assert.equal(archive.version,record.version);assert.equal(archive.phase,record.phase);
    assert.equal(sha(archive),record.definitionSha256);
    assert.equal(record.definitionSha256,{desk:deskSha,monitor:monitorSha,wiki:wikiSha}[profile]);
    assert(Object.isFrozen(archive)&&Object.isFrozen(archive.files));
    const changed=archive.files.filter(row=>{const old=previous.files.find(p=>p.file===row.file);return old&&!same(row,old);}).map(r=>r.file).sort();
    const rows=registry.parentPaths[profile];assert.deepEqual(rows.map(r=>r.file),changed,'Every changed existing parent input has an exact path');
    const order={desk:['desk-noir-combined','noir','business','deed'],monitor:['monitor56','deed'],wiki:['wiki-noir-merge','wiki-merge','deed']}[profile];
    for(const row of rows){
      keys(row,['file','current','predecessor','edges']);checkPin(row.current);checkPin(row.predecessor);
      assert.deepEqual(row.current,archive.files.find(r=>r.file===row.file));
      assert.deepEqual(row.predecessor,previous.files.find(r=>r.file===row.file));
      assert(row.edges.length>0);let cursor=row.current,last=-1;
      for(const edge of row.edges){
        keys(edge,['kind','from','to']);checkPin(edge.from);checkPin(edge.to);
        const at=order.indexOf(edge.kind);assert(at>last,'Closed ordered parent path, no retries or fallback');last=at;
        assert.deepEqual(edge.from,cursor);const [from,to]=knownEdge(edge.kind,row.file);
        assert.deepEqual(edge.from,from);assert.deepEqual(edge.to,to);cursor=edge.to;
      }
      assert.deepEqual(cursor,row.predecessor,'Every parent path ends at the exact original B35 input');
    }
  }
  for(const [name,data] of Object.entries(catalogs)){assert(Object.isFrozen(data));assert.equal(sha(data),registry.catalogs[name].definitionSha256,'Immutable original source definition: '+name);}
  assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.files.length,57,'The reviewed frozen Monitor successor retains all 56 prior paths plus the exact identity pending-state correction');
  for(const [name,data] of Object.entries({b35:previous,ux:qualifiedUx,deed:deedNative})){
    assert.equal(data.status,'SEALED');assert.equal(sha(data),registry.immutable[name].definitionSha256);assert.equal(data.authoredRevision,registry.immutable[name].authoredRevision);
  }
  const reviewed=[...new Set(Object.values(registry.parentPaths).flatMap(rows=>rows.map(r=>r.file)))].sort();
  assert.deepEqual(registry.reviewedFiles,reviewed);assert.deepEqual(Object.keys(registry.ownerByFile),reviewed);
  for(const file of reviewed){const profile=registry.ownerByFile[file];assert(profiles.includes(profile));assert(BUSINESS_DESK_COMBINED_NATIVE_PARENT_OBJECTS[profile].files.some(r=>r.file===file),'The deterministic owner has an actual archived input');}
  assert.equal(registry.sourceOnly,true);assert.equal(registry.nativeAdmission,false);assert.equal(registry.priorResultsTransferred,false);
  parentsValidated=true;return registry;
}

function assertTopSource(){
  if(sourceValidated)return;
  assert.equal(BUSINESS_DESK_COMBINED_SOURCE.status,'SEALED','Top-level source binding must be sealed first');
  assert.equal(BUSINESS_DESK_COMBINED_SOURCE.version,1);
  assert.equal(BUSINESS_DESK_COMBINED_SOURCE.phase,'EXACT_MONITOR_WIKI_DESK_SOURCE_ONLY');
  assert(Object.isFrozen(BUSINESS_DESK_COMBINED_SOURCE)&&Object.isFrozen(BUSINESS_DESK_COMBINED_SOURCE.profiles));
  assert.equal(sha(BUSINESS_DESK_COMBINED_SOURCE),BUSINESS_DESK_COMBINED_SOURCE_SHA256);
  assert.deepEqual(Object.keys(BUSINESS_DESK_COMBINED_SOURCE.profiles),profiles);
  for(const profile of profiles)assert.deepEqual(BUSINESS_DESK_COMBINED_SOURCE.profiles[profile],{revision:parents.profiles[profile].revision,tree:parents.profiles[profile].tree});
  assert.equal(BUSINESS_DESK_COMBINED_SOURCE.sourceOnly,true);assert.equal(BUSINESS_DESK_COMBINED_SOURCE.runtime,false);assert.equal(BUSINESS_DESK_COMBINED_SOURCE.native,false);
  sourceValidated=true;
}

export function buildBusinessDeskCombinedNativeRow(file,actual){
  assertBusinessDeskCombinedNativeParents();
  assertTopSource();
  const profile=parents.ownerByFile[file];assert(profile,'No reviewed deterministic native owner: '+file);
  const parent=BUSINESS_DESK_COMBINED_NATIVE_PARENT_OBJECTS[profile].files.find(row=>row.file===file);
  const old=previous.files.find(row=>row.file===file);assert(parent&&old);
  const path=[];
  if(!same(actual,parent)){
    const row=BUSINESS_DESK_COMBINED_SOURCE.files.find(r=>r.file===file),target=row?.parents[profile];
    assert(row&&target,'UNREVIEWED_COMBINED_SOURCE_EDGE: '+profile+':'+file);
    assert.deepEqual(actual,pin(file,row.current.mode,row.current.blob,row.current.sha256),'Exact combined source current pin');
    assert.deepEqual(parent,pin(file,target.mode,target.blob,target.sha256),'Exact selected archived parent pin');
    path.push({kind:'combined-source',from:actual,to:parent});
  }
  const prior=parents.parentPaths[profile].find(r=>r.file===file);
  if(prior){assert.deepEqual(prior.current,parent);path.push(...prior.edges);}
  else assert.deepEqual(parent,old,'No invented relation for an unchanged original parent');
  return {file,current:actual,profile,parent,path};
}

export function assertBusinessDeskCombinedNativeDefinition(data=BUSINESS_DESK_COMBINED_NATIVE){
  assert.strictEqual(data,BUSINESS_DESK_COMBINED_NATIVE,'Only the exact imported current source-provenance catalog');
  if(nativeValidated)return data;
  assert.equal(data.status,'SEALED','Combined native source paths are UNBOUND');
  keys(data,['version','status','phase','sourceRevision','sourceTree','topSourceDefinitionSha256','parentRegistryDefinitionSha256','nativeClosure','reviewedFiles','files','sourceOnly','nativeAdmission','priorResultsTransferred']);
  assert.equal(data.version,1);assert.equal(data.phase,'EXACT_MONITOR_WIKI_DESK_NATIVE_PROVENANCE_ONLY');
  assert.match(data.sourceRevision,/^[a-f0-9]{40}$/);assert.match(data.sourceTree,/^[a-f0-9]{40}$/);
  assert.equal(sha(data),BUSINESS_DESK_COMBINED_NATIVE_SHA256);
  assert.equal(data.topSourceDefinitionSha256,BUSINESS_DESK_COMBINED_SOURCE_SHA256);
  assert.equal(data.parentRegistryDefinitionSha256,parentsSha);assertBusinessDeskCombinedNativeParents();
  assert.deepEqual(data.reviewedFiles,parents.reviewedFiles);
  assert.equal(current.version,6);assert.equal(current.phase,'ACTUAL_ENTERPRISE_MONITOR_WIKI_DESK_NATIVE_INPUTS');assert.equal(current.status,'SEALED');
  assert.deepEqual(data.nativeClosure,current.files.map(row=>row.file),'Complete actual current native closure');
  const changed=current.files.filter(row=>{const old=previous.files.find(p=>p.file===row.file);return old&&!same(row,old);}).sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
  assert.deepEqual(data.files.map(row=>row.file),changed.map(row=>row.file),'All and only changed existing current native inputs');
  for(const row of data.files){
    assert(Object.isFrozen(row)&&Object.isFrozen(row.path));keys(row,['file','current','profile','parent','path']);checkPin(row.current);checkPin(row.parent);
    const actual=current.files.find(r=>r.file===row.file);assert.deepEqual(row.current,actual);
    assert.deepEqual(row,buildBusinessDeskCombinedNativeRow(row.file,actual),'Closed deterministic current/parent/B35 path');
  }
  for(const profile of profiles){const record=parents.profiles[profile],actual=current.files.find(r=>r.file===record.archiveFile);assert(actual,'Every frozen parent descriptor is an ordinary captured input');assert.equal(actual.mode,record.original.mode);assert.equal(actual.blob,record.original.blob);assert.equal(actual.sha256,record.original.rawSha256);}
  assert.equal(data.sourceOnly,true);assert.equal(data.nativeAdmission,false);assert.equal(data.priorResultsTransferred,false);
  nativeValidated=true;return data;
}

export function businessDeskCombinedNativeProvenance(file,before,expected){
  if(typeof file!=='string')return null;
  const original=previous.files.find(row=>row.file===file);if(!original)return null;
  const actual=current.files.find(row=>row.file===file);if(!actual)return null;
  assert.strictEqual(before,original,'Only the immutable original B35 row');
  assert.strictEqual(expected,actual,'Only the immutable actual current row');
  if(same(actual,original))return null;
  assertBusinessDeskCombinedNativeDefinition();
  const row=BUSINESS_DESK_COMBINED_NATIVE.files.find(r=>r.file===file);assert(row,'No reviewed combined source provenance: '+file);
  return Object.freeze({file,current:Object.freeze({mode:expected.mode,blob:expected.blob,sha256:expected.sha256}),
    predecessor:before,predecessorRevision:previous.authoredRevision,relation,nativeAdmission:false,priorResultsTransferred:false});
}
