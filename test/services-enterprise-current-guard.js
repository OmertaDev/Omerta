// Source-only unit: exercise installed validators; never obtain a hosted context or connect to PG.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {parse} from 'acorn';
import {
  sourcePairReviewedTreeHash,
  readServicesEnterpriseProfile,
  validateServicesEnterpriseHosted,
  assertServicesEnterpriseCIEndpoint,
  assertServicesEnterpriseChildClosed,
  createServicesEnterpriseContext,
} from '../tools/services-enterprise-current-guard.js';
import {runServicesEnterpriseNative} from '../tools/services-enterprise-native.js';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const fixture=name=>crypto.createHash('sha1').update('INERT_NOT_A_CURRENT_COMMIT_'+name).digest('hex');
const clone=value=>structuredClone(value);
let positives=0,refusals=0;
const pass=call=>{call();positives++;};
const refuse=(call,expected)=>{assert.throws(call,expected);refusals++;};
const pair=fs.readFileSync(new URL('../tools/rc1-source-pair.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const guard=fs.readFileSync(new URL('../tools/services-enterprise-current-guard.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const driver=fs.readFileSync(new URL('../tools/services-enterprise-native.js',import.meta.url),'utf8').replaceAll('\r\n','\n');

const profile=readServicesEnterpriseProfile(pair);
pass(()=>{assert(Object.isFrozen(profile));assert.equal(profile.tables.length,26);assert.equal(profile.constraints,332);assert.equal(profile.notNull,283);});
const marker='export const FINALSERVICES_ADDITIVE_PAIR = Object.freeze(',start=pair.indexOf(marker),end=pair.indexOf('\n});',start)+5,owned=pair.slice(start,end);
assert(start>=0&&end>start);
const changeOwned=(before,after)=>{assert.equal(owned.split(before).length,2);return pair.slice(0,start)+owned.replace(before,()=>after)+pair.slice(end);};
for(const input of[
  pair+'\n'+owned,
  changeOwned('tables: Object.freeze([','tables: Object.freeze(makeTables(['),
  changeOwned('"constraints": 332,','"constraints": 332,\n  "unknown": true,'),
  changeOwned('"constraints": 332,','"constraints": 331,'),
  changeOwned('"notNull": 283,','"notNull": 282,'),
  changeOwned('"candidateTableCatalog": "'+profile.candidateTableCatalog,'"candidateTableCatalog": "gggg'),
  Buffer.from(pair),null,
])refuse(()=>readServicesEnterpriseProfile(input));

// Exact exclusions are fixtures, not a second fingerprint implementation.
const exclusions=['tools/rc1-source-pair.js','test/rc1-source-pair-additive.js','docs/rc1-source-pair-additive-review.md',
  'knowledge/generated/contracts.md','knowledge/generated/documents.md','knowledge/generated/github-history.md',
  'knowledge/generated/graph-summary.md','knowledge/generated/graph.json','knowledge/generated/graph.mmd',
  'knowledge/generated/inventory.md','knowledge/generated/modules.md','knowledge/generated/routes.md','knowledge/generated/schema.md'];
const excludedRows=exclusions.map((file,i)=>'100644 blob '+fixture('excluded-'+i)+'\t'+file);
const includedRows=[
  '100644 blob '+fixture('kept')+'\tsrc/inert-fixture.js',
  '100755 blob '+fixture('unknown')+'\ttools/rc1-source-pair.js-extra',
  '100644 blob '+fixture('trailing')+'\tknowledge/generated/graph.json ',
  ' 100644 blob '+fixture('leading')+'\tsrc/space-fixture.js',
];
const nul=Buffer.from([...excludedRows,...includedRows].join('\0')+'\0'),records=nul.toString('utf8').split('\0');assert.equal(records.pop(),'');
pass(()=>assert.equal(sourcePairReviewedTreeHash(records),hash(JSON.stringify([...includedRows].sort()))));
pass(()=>assert.equal(sourcePairReviewedTreeHash([...records].reverse()),sourcePairReviewedTreeHash(records)));
for(const line of includedRows)assert.notEqual(sourcePairReviewedTreeHash(records.filter(row=>row!==line)),sourcePairReviewedTreeHash(records),'Unknown and whitespace-bearing rows stay authoritative');
for(const line of excludedRows)assert.equal(sourcePairReviewedTreeHash(records.filter(row=>row!==line)),sourcePairReviewedTreeHash(records));
assert.notEqual(sourcePairReviewedTreeHash(records.map(row=>row.trim())),sourcePairReviewedTreeHash(records),'Never trim complete Git records');

const meta={phase:'GHA_SERVICES_ENTERPRISE16_CURRENT_CI',serverURL:'https://github.com',repository:'OmertaDev/Omerta',repositoryId:'1',ownerId:'2',eventName:'pull_request',eventSHA:fixture('merge'),source:fixture('head'),workflowSHA:fixture('merge'),workflowRef:'OmertaDev/Omerta/.github/workflows/ci.yml@refs/pull/123/merge',ref:'refs/pull/123/merge',headRef:'codex/inert-fixture',baseRef:'main',runId:'3',runAttempt:'1',jobId:'pgcheck_enterprise',postgres:'18.4',serviceId:hash('inert service'),eventFileSHA256:hash('inert event')};
const event={number:123,repository:{full_name:meta.repository,id:1,owner:{id:2}},pull_request:{head:{sha:meta.source,ref:meta.headRef,repo:{full_name:meta.repository}},base:{sha:fixture('base'),ref:'main',repo:{full_name:meta.repository}}}};
const observation={source:meta.source,tree:fixture('tree'),parents:[fixture('parent')],eventParents:[event.pull_request.base.sha,meta.source],nodeVersion:'v22.20.0',clean:true,root:'/INERT_ROOT',workspace:'/INERT_ROOT',cwd:'/INERT_ROOT',workflowFileSHA256:hash('inert workflow'),executionWorkflowFileSHA256:hash('inert workflow'),event};
pass(()=>assert.equal(validateServicesEnterpriseHosted(meta,observation),true));
const pushMeta={...meta,eventName:'push',source:meta.eventSHA,ref:'refs/heads/main',workflowRef:'OmertaDev/Omerta/.github/workflows/ci.yml@refs/heads/main',headRef:'',baseRef:''};
const pushObservation={...observation,source:pushMeta.source,event:{repository:event.repository,ref:pushMeta.ref,after:pushMeta.source}};
pass(()=>assert.equal(validateServicesEnterpriseHosted(pushMeta,pushObservation),true));
for(const mutate of[
  m=>{m.jobId='pgcheck_finalservices';},m=>{m.repository='Foreign/Repo';},
  (m,o)=>{o.event.pull_request.head.repo.full_name='Foreign/Repo';},
  (m,o)=>{o.event.pull_request.head.sha=fixture('other');},(m,o)=>{o.source=fixture('other');},
  (m,o)=>{o.eventParents.reverse();},(m,o)=>{o.executionWorkflowFileSHA256=hash('other');},
  m=>{m.workflowRef+='x';},m=>{m.ref='refs/heads/main';},(m,o)=>{o.event.number=0;},
  (m,o)=>{o.clean=false;},(m,o)=>{o.nodeVersion='v24.19.0';},(m,o)=>{o.workspace='/OTHER';},(m,o)=>{o.cwd='/OTHER';},
  m=>{m.extra=true;},m=>{m.serviceId='';},m=>{m.postgres='17';},
  (m,o)=>{o.event.repository.id=9;},m=>{m.source='main';},m=>{m.eventName='workflow_dispatch';},
]){const m=clone(meta),o=clone(observation);mutate(m,o);refuse(()=>validateServicesEnterpriseHosted(m,o));}
for(const mutate of[(m,o)=>{o.event.after=fixture('other');},(m,o)=>{o.event.ref='refs/heads/other';},m=>{m.headRef='not-empty';},m=>{m.ref='refs/tags/v1';}]){const m=clone(pushMeta),o=clone(pushObservation);mutate(m,o);refuse(()=>validateServicesEnterpriseHosted(m,o));}

const endpoint='postgresql://postgres:pgcheck@127.0.0.1:5432/postgres';
pass(()=>assert.equal(assertServicesEnterpriseCIEndpoint('ci',5432,endpoint),true));
for(const [profile,port,url]of[['local',5432,endpoint],['ci',35439,endpoint],['ci',5432,endpoint.replace('127.0.0.1','192.0.2.1')],['ci',5432,endpoint.replace(/\/postgres$/,'/customer')],['ci',5432,endpoint.replace(':pgcheck@',':other@')],['ci',5432,endpoint+'?options=x']])refuse(()=>assertServicesEnterpriseCIEndpoint(profile,port,url));
const closed={file:'INERT_NOT_NATIVE',closed:true,exitObserved:true,exitCode:0,exitSignal:null,code:0,signal:null,error:null,deadlineFired:false,logClosed:true,logSHA256:hash('inert closed log')};
pass(()=>assert.equal(assertServicesEnterpriseChildClosed(closed),true));
for(const [key,value]of[['closed',false],['exitObserved',false],['exitCode',1],['code',1],['exitSignal','SIGTERM'],['signal','SIGTERM'],['error','ENOENT'],['deadlineFired',true],['logClosed',false],['logSHA256',null],['extra',true]])refuse(()=>assertServicesEnterpriseChildClosed({...closed,[key]:value}));

const ast=source=>parse(source,{ecmaVersion:'latest',sourceType:'module'});
const functionNode=(source,name)=>{const matches=ast(source).body.map(n=>n.declaration??n).filter(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.equal(matches.length,1);return matches[0];};
const functionText=(source,name)=>{const node=functionNode(source,name);return source.slice(node.start,node.end);};
pass(()=>assert.equal(functionText(guard,'sourcePairReviewedTreeHash'),functionText(pair,'sourcePairReviewedTreeHash'),'Use the actual canonical untrimmed fingerprint algorithm'));
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const[key,value]of Object.entries(node))if(key!=='start'&&key!=='end'){if(Array.isArray(value))value.forEach(child=>walk(child,visit));else if(value&&typeof value==='object')walk(value,visit);}}
const authority=functionNode(guard,'assertServicesAuthority'),transfers=[];
walk(authority,node=>{if(node.type==='CallExpression'&&node.callee.type==='Identifier'&&node.callee.name==='assertFinalServicesCommerceSourceTransfer')transfers.push(node);});
pass(()=>{assert.equal(transfers.length,1);const input=transfers[0].arguments[1];assert.equal(input.type,'CallExpression');assert.equal(input.callee.type,'MemberExpression');assert.equal(input.callee.object.name,'fs');assert.equal(input.callee.property.name,'readFileSync');assert.equal(input.arguments.length,2);assert.equal(input.arguments[1].type,'Literal');assert.equal(input.arguments[1].value,'utf8','Authority must pass UTF8 strings to the real transfer dependency');});
const run=functionNode(driver,'runServicesEnterpriseNative'),contextCalls=[],pgImports=[];
walk(run,node=>{if(node.type==='CallExpression'&&node.callee.type==='Identifier'&&node.callee.name==='createServicesEnterpriseContext')contextCalls.push(node);if(node.type==='ImportExpression'&&node.source.value==='pg')pgImports.push(node);});
assert.equal(contextCalls.length,1);assert.equal(pgImports.length,1);assert(contextCalls[0].start<pgImports[0].start,'Actual hosted context is required before the PG import');

// Invoke actual ingress exports only on paths that must refuse before event-file/PG access.
const scopedKey=key=>/DATABASE_URL$|^PG|^RC1|^P2_TEST|^ENTERPRISE_NATIVE_|^SERVICES_ENTERPRISE_|^NODE_OPTIONS$|^NODE_PATH$|^NODE_PG_FORCE_NATIVE$|^LEGAL_PROFILE_DEFER$|^GENESIS_AUCTION_MANIFEST_(?:PATH|SHA256)$/.test(key.toUpperCase())||['CHAIN_ENABLED','RESOURCE_ECONOMY','RESOURCE_COMPUTE'].includes(key);
async function withIngressEnvironment(patch,call){const saved=Object.fromEntries(Object.entries(process.env).filter(([key])=>scopedKey(key)));for(const key of Object.keys(process.env))if(scopedKey(key))delete process.env[key];Object.assign(process.env,{CHAIN_ENABLED:'off',RESOURCE_ECONOMY:'off',RESOURCE_COMPUTE:'off'},patch);try{await call();}finally{for(const key of Object.keys(process.env))if(scopedKey(key))delete process.env[key];Object.assign(process.env,saved);}}
const ci={ENTERPRISE_NATIVE_PROFILE:'ci',ENTERPRISE_NATIVE_CI_ADMIN_DATABASE_URL:endpoint};
const local={ENTERPRISE_NATIVE_PROFILE:'local',ENTERPRISE_NATIVE_ADMIN39_DATABASE_URL:'postgresql://pilot_runner@127.0.0.1:35439/postgres',ENTERPRISE_NATIVE_ADMIN49_DATABASE_URL:'postgresql://pilot_runner@127.0.0.1:35449/postgres'};
for(const [patch,expected]of[
  [{},/Explicit closed local or ci profile required/],
  [local,/Services enterprise has no local or fallback mode/],
  [{...ci,SERVICES_ENTERPRISE_OVERRIDE:'x'},/Unknown Services enterprise selector/],
  [{...ci,services_enterprise_execution_source:'x'},/Unknown Services enterprise selector/],
  [{...ci,PGHOST:'192.0.2.1'},/ambient backend/],
  [{...ci,NODE_OPTIONS:'--import inert'},/ambient backend/],
  [{...ci,RESOURCE_COMPUTE:'on'},error=>error.code==='ERR_ASSERTION'&&error.actual==='on'&&error.expected==='off'],
  [{...ci,ENTERPRISE_NATIVE_CI_ADMIN_DATABASE_URL:endpoint.replace('127.0.0.1','192.0.2.1')},error=>error.code==='ERR_ASSERTION'&&error.actual.includes('192.0.2.1')&&error.expected===endpoint],
])await withIngressEnvironment(patch,()=>refuse(()=>createServicesEnterpriseContext(),expected));
for(const patch of[{},local])await withIngressEnvironment(patch,async()=>{await assert.rejects(runServicesEnterpriseNative(),patch===local?/Services enterprise has no local or fallback mode/:/Explicit closed local or ci profile required/);refusals++;});

console.log(JSON.stringify({phase:'SOURCE_ONLY_SERVICES_ENTERPRISE_ACTUAL_EXPORT_UNIT',positives,refusals,hostedAndClosureFixtures:'inert; no current CI or native qualification',validHostedContextCreated:false,nativeRunStarted:false,PGConnections:0,sourceCaptureExecuted:false}));
