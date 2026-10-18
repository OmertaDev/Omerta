import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertEnterpriseNativeMode,assertEnterpriseDirectoryEntries} from './enterprise-native.js';
import {ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS} from './enterprise-native-inputs.js';
import {captureCommerceCurrentSource,verifyCommerceCurrentSource} from './commerce-current-native-guard.js';
import {FINAL_SERVICES_COMMERCE_SOURCE_BINDING} from './finalservices-commerce-source-data.js';
import {assertFinalServicesCommerceSourceTransfer} from './finalservices-commerce-source-compatibility.js';
import {FINAL_SERVICES_CURRENT_SCHEMA_SHA256} from './finalservices-current-native-data.js';
import {finalservicesCurrentSchemaTables} from './finalservices-current-native-guard.js';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const git=(...args)=>execFileSync('git',['--no-optional-locks','--no-replace-objects',...args],{cwd:ROOT,windowsHide:true,timeout:30000,maxBuffer:64*1024*1024});
const text=(...args)=>git(...args).toString('utf8').trim();
const contexts=new WeakSet(),captures=new WeakSet();
const SELECTORS=Object.freeze(['SERVICES_ENTERPRISE_EXECUTION_SOURCE','SERVICES_ENTERPRISE_POSTGRES','SERVICES_ENTERPRISE_SERVICE_ID']);
const additiveOwnedFiles=new Set(['tools/rc1-source-pair.js','test/rc1-source-pair-additive.js','docs/rc1-source-pair-additive-review.md']);
const ADDITIVE_KNOWLEDGE_OUTPUTS=Object.freeze([
 'knowledge/generated/contracts.md','knowledge/generated/documents.md','knowledge/generated/github-history.md',
 'knowledge/generated/graph-summary.md','knowledge/generated/graph.json','knowledge/generated/graph.mmd',
 'knowledge/generated/inventory.md','knowledge/generated/modules.md','knowledge/generated/routes.md','knowledge/generated/schema.md',
]);
const additiveEvidenceOutputs=new Set(ADDITIVE_KNOWLEDGE_OUTPUTS);

// Exact existing reviewed-tree algorithm; all Git records remain untrimmed until NUL separation.
export function sourcePairReviewedTreeHash(records) {
  const reviewed = records.filter(line => {
    const file = line.slice(line.indexOf('\t') + 1);
    return !additiveOwnedFiles.has(file) && !additiveEvidenceOutputs.has(file);
  }).sort();
  return sha256(JSON.stringify(reviewed));
}
// Exact existing canonical JSON algorithm for the owned twenty-six-table definition catalog.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${Array.from(value, canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date)) return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  assert(typeof value !== 'number' || Number.isFinite(value), 'Canonical evidence cannot encode nonfinite numbers');
  const encoded = JSON.stringify(value);
  assert.equal(typeof encoded, 'string', 'Canonical evidence requires explicit JSON values; omit absent optional properties');
  return encoded;
}
const keys=(value,names)=>assert.deepEqual(Object.keys(value).sort(),[...names].sort(),'Closed Services enterprise evidence keys');
const hash=(value,length=64)=>assert(typeof value==='string'&&new RegExp('^[a-f0-9]{'+length+'}$').test(value));

export function readServicesEnterpriseProfile(input){
 assert.equal(typeof input,'string');
 const marker='export const FINALSERVICES_ADDITIVE_PAIR = Object.freeze(';
 assert.equal(input.split(marker).length,2,'One actual owned Services profile declaration');
 const start=input.indexOf(marker)+marker.length,end=input.indexOf('\n});',start);assert(end>start);
 const literal=input.slice(start,end+2),tail=literal.match(/  tables: Object\.freeze\((\[[^\n]*\])\)\n\}$/);
 assert(tail,'Exact finite literal Services profile, never execute the PG-importing pair module');
 const profile=JSON.parse(literal.slice(0,tail.index)+'  "tables": '+tail[1]+'\n}');
 keys(profile,['predecessor','reviewedCandidate','predecessorTree','predecessorSchema','predecessorCatalog','candidateTree','candidateSchema','candidateCatalog','constraints','notNull','candidateTableCatalog','tables']);
 for(const name of ['predecessor','reviewedCandidate'])hash(profile[name],40);
 for(const name of ['predecessorTree','predecessorSchema','predecessorCatalog','candidateTree','candidateSchema','candidateCatalog','candidateTableCatalog'])hash(profile[name]);
 assert.equal(profile.constraints,332);assert.equal(profile.notNull,283);assert.equal(profile.tables.length,26);
 assert.equal(new Set(profile.tables).size,26);for(const name of profile.tables)assert(/^[a-z][a-z_0-9]+$/.test(name));
 return Object.freeze(profile);
}

export function validateServicesEnterpriseHosted(meta,observation){
 keys(meta,['phase','serverURL','repository','repositoryId','ownerId','eventName','eventSHA','source','workflowSHA','workflowRef','ref','headRef','baseRef','runId','runAttempt','jobId','postgres','serviceId','eventFileSHA256']);
 assert.equal(meta.phase,'GHA_SERVICES_ENTERPRISE16_CURRENT_CI');assert.equal(meta.serverURL,'https://github.com');
 assert.equal(meta.repository,'OmertaDev/Omerta');assert.equal(meta.jobId,'pgcheck_enterprise');
 for(const name of ['repositoryId','ownerId','runId','runAttempt'])assert(/^[1-9][0-9]{0,19}$/.test(meta[name]));
 for(const name of ['eventSHA','source','workflowSHA'])hash(meta[name],40);hash(meta.serviceId);hash(meta.eventFileSHA256);
 assert(['16','18.4'].includes(meta.postgres));assert.equal(meta.workflowRef,meta.repository+'/.github/workflows/ci.yml@'+meta.ref);
 keys(observation,['source','tree','parents','eventParents','nodeVersion','clean','root','workspace','cwd','workflowFileSHA256','executionWorkflowFileSHA256','event']);
 assert.equal(observation.source,meta.source);hash(observation.tree,40);assert(Array.isArray(observation.parents));observation.parents.forEach(p=>hash(p,40));
 assert.equal(observation.clean,true);assert.match(observation.nodeVersion,/^v22\./);
 assert.equal(observation.root,observation.workspace);assert.equal(observation.root,observation.cwd);
 hash(observation.workflowFileSHA256);assert.equal(observation.workflowFileSHA256,observation.executionWorkflowFileSHA256,'Actual reviewed head supplies the same workflow used by this run');
 const event=observation.event;assert.equal(event.repository?.full_name,meta.repository);assert.equal(String(event.repository.id),meta.repositoryId);assert.equal(String(event.repository.owner?.id),meta.ownerId);
 if(meta.eventName==='pull_request'){
  assert(Number.isSafeInteger(event.number)&&event.number>0,'Actual positive hosted PR number');
  const pr=event.pull_request;assert(pr);assert.equal(pr.head.repo.full_name,meta.repository);assert.equal(pr.base.repo.full_name,meta.repository);
  assert.equal(pr.head.sha,meta.source);hash(pr.base.sha,40);assert.equal(meta.headRef,pr.head.ref);assert.equal(meta.baseRef,pr.base.ref);
  assert.equal(meta.ref,'refs/pull/'+event.number+'/merge');assert.deepEqual(observation.eventParents,[pr.base.sha,pr.head.sha],'Authentic ordered base/head workflow merge parents');
 }else{
  assert.equal(meta.eventName,'push');assert.equal(meta.source,meta.eventSHA);assert.equal(event.after,meta.source);assert.equal(event.ref,meta.ref);assert(/^refs\/heads\/[A-Za-z0-9_./-]+$/.test(meta.ref));assert.equal(meta.headRef,'');assert.equal(meta.baseRef,'');
 }
 return true;
}

function hostedObservation(meta){
 assert.equal(process.env.CI,'true');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
 assert.equal(fs.realpathSync(ROOT),fs.realpathSync(process.env.GITHUB_WORKSPACE));assert.equal(fs.realpathSync(ROOT),fs.realpathSync(process.cwd()));
 const eventPath=process.env.GITHUB_EVENT_PATH;assert(path.isAbsolute(eventPath));const eventReal=fs.realpathSync(eventPath),eventStat=fs.lstatSync(eventPath);assert(eventStat.isFile()&&!eventStat.isSymbolicLink());assert(!eventReal.startsWith(fs.realpathSync(ROOT)+path.sep),'Event file must be the external hosted event document');
 const eventBytes=fs.readFileSync(eventPath);assert.equal(sha256(eventBytes),meta.eventFileSHA256);const event=JSON.parse(eventBytes);
 const mapping={serverURL:'GITHUB_SERVER_URL',repository:'GITHUB_REPOSITORY',repositoryId:'GITHUB_REPOSITORY_ID',ownerId:'GITHUB_REPOSITORY_OWNER_ID',eventName:'GITHUB_EVENT_NAME',eventSHA:'GITHUB_SHA',workflowSHA:'GITHUB_WORKFLOW_SHA',workflowRef:'GITHUB_WORKFLOW_REF',ref:'GITHUB_REF',headRef:'GITHUB_HEAD_REF',baseRef:'GITHUB_BASE_REF',runId:'GITHUB_RUN_ID',runAttempt:'GITHUB_RUN_ATTEMPT',jobId:'GITHUB_JOB',source:'SERVICES_ENTERPRISE_EXECUTION_SOURCE',postgres:'SERVICES_ENTERPRISE_POSTGRES',serviceId:'SERVICES_ENTERPRISE_SERVICE_ID'};
 for(const[key,name]of Object.entries(mapping))assert.equal(process.env[name]??'',meta[key],'Fixed current hosted context changed: '+name);
 assert.equal(text('remote','get-url','origin').replace(/\.git$/,''),'https://github.com/OmertaDev/Omerta');
 return{source:text('rev-parse','HEAD'),tree:text('rev-parse','HEAD^{tree}'),parents:text('show','-s','--format=%P','HEAD').split(' ').filter(Boolean),eventParents:text('show','-s','--format=%P',meta.eventSHA).split(' ').filter(Boolean),nodeVersion:process.version,clean:text('status','--porcelain=v1','--untracked-files=all')==='',root:fs.realpathSync(ROOT),workspace:fs.realpathSync(process.env.GITHUB_WORKSPACE),cwd:fs.realpathSync(process.cwd()),workflowFileSHA256:sha256(git('show',meta.workflowSHA+':.github/workflows/ci.yml')),executionWorkflowFileSHA256:sha256(git('show',meta.source+':.github/workflows/ci.yml')),event};
}

export function createServicesEnterpriseContext(){
 assert.equal(assertEnterpriseNativeMode(process.argv,process.env,process.execArgv),'ci','Services enterprise has no local or fallback mode');
 for(const key of Object.keys(process.env))if(/^SERVICES_ENTERPRISE_/i.test(key))assert(SELECTORS.includes(key),'Unknown Services enterprise selector');
 if(Object.hasOwn(process.env,'RESOURCE_COMPUTE'))assert.equal(process.env.RESOURCE_COMPUTE,'off');
 const e=process.env,event=fs.readFileSync(e.GITHUB_EVENT_PATH),meta=Object.freeze({phase:'GHA_SERVICES_ENTERPRISE16_CURRENT_CI',serverURL:e.GITHUB_SERVER_URL,repository:e.GITHUB_REPOSITORY,repositoryId:e.GITHUB_REPOSITORY_ID,ownerId:e.GITHUB_REPOSITORY_OWNER_ID,eventName:e.GITHUB_EVENT_NAME,eventSHA:e.GITHUB_SHA,source:e.SERVICES_ENTERPRISE_EXECUTION_SOURCE,workflowSHA:e.GITHUB_WORKFLOW_SHA,workflowRef:e.GITHUB_WORKFLOW_REF,ref:e.GITHUB_REF,headRef:e.GITHUB_HEAD_REF??'',baseRef:e.GITHUB_BASE_REF??'',runId:e.GITHUB_RUN_ID,runAttempt:e.GITHUB_RUN_ATTEMPT,jobId:e.GITHUB_JOB,postgres:e.SERVICES_ENTERPRISE_POSTGRES,serviceId:e.SERVICES_ENTERPRISE_SERVICE_ID,eventFileSHA256:sha256(event)});
 const observation=hostedObservation(meta);validateServicesEnterpriseHosted(meta,observation);const context=Object.freeze({meta,source:meta.source,tree:observation.tree});contexts.add(context);return context;
}

function records(source){const bytes=git('ls-tree','-rz','--full-tree',source);assert(bytes.length&&bytes.at(-1)===0,'Untrimmed complete NUL inventory');return bytes.toString('utf8').split('\0').filter(Boolean);}
function tracked(source,file){const rows=git('ls-tree','-z',source,'--',file).toString('utf8').split('\0').filter(Boolean);assert.equal(rows.length,1);const at=rows[0].indexOf('\t'),[mode,type,blob]=rows[0].slice(0,at).split(' ');assert.equal(rows[0].slice(at+1),file);assert.equal(type,'blob');assert(['100644','100755'].includes(mode));return{mode,blob};}

function assertServicesAuthority(context,capture){
 assert(contexts.has(context),'Only actual loaded enterprise-job context');assert.equal(capture.source,context.source);assert.equal(capture.tree,context.tree);
 const profile=readServicesEnterpriseProfile(fs.readFileSync(path.join(ROOT,'tools/rc1-source-pair.js'),'utf8').replaceAll('\r\n','\n'));
 const binding=FINAL_SERVICES_COMMERCE_SOURCE_BINDING;assert.equal(binding.predecessorRevision,profile.predecessor);assert.equal(Object.keys(binding.records).length,150);
 assert.notEqual(profile.predecessor,context.source);for(const source of [profile.predecessor,profile.reviewedCandidate,binding.sourceRevision])git('merge-base','--is-ancestor',source,context.source);
 assert.equal(sourcePairReviewedTreeHash(records(context.source)),profile.candidateTree,'Current complete reviewed source identity, not table count');
 assert.equal(sourcePairReviewedTreeHash(records(profile.reviewedCandidate)),profile.candidateTree,'Genuine reviewed source ancestor');
 assert.equal(sourcePairReviewedTreeHash(records(profile.predecessor)),profile.predecessorTree,'Genuine frozen Commerce predecessor');
 for(const[file,r]of Object.entries(binding.records)){
  const current=tracked(context.source,file),before=tracked(profile.predecessor,file);assert.equal(current.mode,r.currentMode);assert.equal(current.blob,r.currentBlob);assert.equal(before.mode,r.baselineMode);assert.equal(before.blob,r.baselineBlob);
  const proof=assertFinalServicesCommerceSourceTransfer(file,fs.readFileSync(path.join(ROOT,file),'utf8'));assert.equal(proof.predecessorRevision,profile.predecessor);assert.equal(proof.sourceRevision,binding.sourceRevision);assert.equal(proof.sourceOnly,true);assert.equal(proof.nativeAdmission,false);
  assert.equal(proof.baselineText,git('show',profile.predecessor+':'+file).toString('utf8'),'Direct complete actual Commerce bytes');
 }
 const schema=git('show',context.source+':schema.sql'),catalog=git('show',context.source+':test/lib/phase2-architecture-upgrade-catalog.json');
 assert.equal(sha256(schema),profile.candidateSchema);assert.equal(profile.candidateSchema,FINAL_SERVICES_CURRENT_SCHEMA_SHA256);assert.equal(sha256(catalog),profile.candidateCatalog);
 assert.deepEqual(capture.canonicalTables,finalservicesCurrentSchemaTables(schema.toString('utf8')));
 assert.equal(sha256(git('show',profile.predecessor+':schema.sql')),profile.predecessorSchema);assert.equal(sha256(git('show',profile.predecessor+':test/lib/phase2-architecture-upgrade-catalog.json')),profile.predecessorCatalog);
 const definitions=JSON.parse(catalog),tables=Object.fromEntries(profile.tables.map(name=>[name,{constraints:definitions.added.filter(row=>row.table_name===name),notNullColumns:definitions.notNullColumns[name]??null}]));
 assert.equal(sha256(canonicalJson(tables)),profile.candidateTableCatalog);assert.equal(Object.values(tables).reduce((n,r)=>n+r.constraints.length,0),332);assert.equal(Object.values(tables).reduce((n,r)=>n+r.notNullColumns.length,0),283);
 return Object.freeze({predecessor:profile.predecessor,reviewedCandidate:profile.reviewedCandidate,reviewedTree:profile.candidateTree,schema:profile.candidateSchema,catalog:profile.candidateCatalog,source150Revision:binding.sourceRevision,sourceOnly:true,nativeQualified:false});
}

function directoryMemberships(){return ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS.map(r=>({directory:r.directory,eligibleNames:assertEnterpriseDirectoryEntries(r.directory,fs.readdirSync(path.join(ROOT,r.directory)))}));}

export function captureServicesEnterpriseSource(context,manifestPath){
 assert(contexts.has(context));assert(path.isAbsolute(manifestPath));assert.equal(path.dirname(manifestPath),path.join(ROOT,'output'));assert(!fs.existsSync(manifestPath));
 validateServicesEnterpriseHosted(context.meta,hostedObservation(context.meta));const capture=captureCommerceCurrentSource(context.source),authority=assertServicesAuthority(context,capture);
 const bytes=Buffer.from(JSON.stringify(capture,null,2)+'\n');fs.writeFileSync(manifestPath,bytes,{flag:'wx'});
 const files=Object.fromEntries(capture.records.map(r=>[r.file,{sha256:r.rawSHA256,gitSha256:r.gitSHA256,bytes:r.rawBytes,blob:r.blob,binary:!r.text}]));
 const source=Object.freeze({revision:context.source,tree:context.tree,phase:'SERVICES_CURRENT_ENTERPRISE16_CI_ONLY',files,directoryMemberships:directoryMemberships(),authority});
 const bound=Object.freeze({context,source,manifestPath,manifestSHA256:sha256(bytes)});captures.add(bound);assertServicesEnterpriseStable(bound);return bound;
}

export function assertServicesEnterpriseStable(bound){
 assert(captures.has(bound),'Only genuine current capture admitted before PG');assert(contexts.has(bound.context));
 validateServicesEnterpriseHosted(bound.context.meta,hostedObservation(bound.context.meta));
 const capture=verifyCommerceCurrentSource(bound.source.revision,bound.manifestPath,bound.manifestSHA256);assert.equal(capture.tree,bound.source.tree);
 assert.deepEqual(directoryMemberships(),bound.source.directoryMemberships);return true;
}

export function assertServicesEnterpriseChildClosed(row){
 keys(row,['file','closed','exitObserved','exitCode','exitSignal','code','signal','error','deadlineFired','logClosed','logSHA256']);
 assert.equal(typeof row.file,'string');for(const key of ['closed','exitObserved','logClosed'])assert.equal(row[key],true);assert.equal(row.deadlineFired,false);
 assert.equal(row.code,0);assert.equal(row.exitCode,0);assert.equal(row.signal,null);assert.equal(row.exitSignal,null);assert.equal(row.error,null);hash(row.logSHA256);return true;
}

export function assertServicesEnterpriseCIEndpoint(profile,port,url){
 assert.equal(profile,'ci');assert.equal(port,5432);assert.equal(url,'postgresql://postgres:pgcheck@127.0.0.1:5432/postgres');return true;
}
