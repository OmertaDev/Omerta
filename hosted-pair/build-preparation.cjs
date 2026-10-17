'use strict';
// Preparation builder: builtins and file bytes only; never imports packet/application code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=__dirname,CP='C:/Users/Jorge/.codex/visualizations/2026/10/08/01a118f5-257a-7ea0-9c7e-471785acde84/agent-economy-state/team-evidence/component-review';
const parent=CP+'/rootd8-bg-hosted-registered-workflow-successor-20261017',peer=CP+'/rootd8-bg-hosted-materializer-independent-20261017';
const gui='C:/Users/Jorge/AppData/Local/Temp/omerta-dashboard-strict-gui-observer-deadline-successor-699325d0-9fbf-4d87-8024-ab797e761632';
const guardRoot='C:/Users/Jorge/AppData/Local/Temp/omerta-dashboard-hosted-source-guard-preparation-879ce748-d847-4446-a040-d268faef9a90';
const adapterRoot='C:/Users/Jorge/AppData/Local/Temp/omerta-dashboard-hosted-source-proof-adapter-preparation-4774d2ca-49b0-4799-a282-d43ba3456878';
const proofRoot='C:/Users/Jorge/AppData/Local/Temp/omerta-dashboard-hosted-proof-validation-8f0c7466-b334-4cc9-b0cd-b15ba23ee2c5';
const mapRoot='C:/Users/Jorge/AppData/Local/Temp/omerta-dashboard-strict-gui-materializer-map-7e240fc1-edd4-4354-b7f6-59b6238b2ba0';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),serial=o=>Buffer.from(JSON.stringify(o,null,2)+'\n');
const put=(name,b)=>fs.writeFileSync(path.join(root,name),b,{flag:'wx'}),read=name=>fs.readFileSync(path.join(root,name));
const copies=[];
function copy(from,to,digest){const bytes=fs.readFileSync(from);if(digest)assert.equal(sha(bytes),digest);put(to,bytes);copies.push({file:to,origin:from,bytes:bytes.length,sha256:sha(bytes)});return bytes;}
copy(parent+'/materialize-hosted.cjs','provenance/parent-materialize-hosted.cjs','f5f731f0ece24a110f22b6284a8a921c3366ea8f33a88b45613ec42027edde61');
copy(parent+'/manifest.json','provenance/parent-registered-manifest.json','3355d6d2942cd726994d649c74c0e4929e31b7aed7b9282b8214c86247ee2fce');
copy(peer+'/manifest.json','provenance/parent-materializer-independent-manifest.json','6e261f6037162e521b072f046c5a8e1868d896f72fee31e95c2e5e48ef04754b');
copy(peer+'/REVIEW.md','provenance/parent-materializer-independent-REVIEW.md');
for(const name of ['registered-path-edits.json','registered-workflow-finding.json'])copy(parent+'/'+name,'provenance/'+name);
for(const name of ['rc1-ci-retain.d8.mjs','linux-dependencies-manifest.json','git-author-manifest.json'])copy(parent+'/provenance/'+name,'provenance/'+name);
copy(parent+'/install-approved-runtime.sh','install-approved-runtime.sh','766f977fe691a837bf092edcaf270999bf6c6c6a7ab038f0e488619d4d397932');
for(const name of ['driver-and-boot.reference.json','phosphor-embedded.reference.json','pino-embedded.reference.json','expected-dependencies-linux-x64.json','expected-runtime-git.json','node-runtime-provenance.json','root-git-acceptance.json'])copy(parent+'/inputs/'+name,'inputs/'+name);
copy(gui+'/manifest.json','provenance/gui-corrected-observer-manifest.json','c876e75d91dcd15d0d533bf76ea765980132519238690d71192b9243c40126a3');
copy(gui+'/source-pins.json','inputs/source-pins.json','2154e64e93b31776c4fff2f417f68e98f54e39bfc795cb7430abbf2fbd00680b');
copy(gui+'/source-binding.template.json','source-binding.template.json','8523320c6ef6b26ff7998320a6b608866ab23eb93cba56d90e6d5489660c2bde');
copy(gui+'/hosted-binding.json','hosted-binding.UNBOUND.json','066dfbad5608afbb183554bcc685524f9812ecc8a3b6b3124d05199ad3943b31');
copy(gui+'/proof-contract.json','inputs/proof-contract.json','77acfe2a27ca8e088a1ce1dd9aa7b24c09c280eac41559d28689bd7f356d9ace');
for(const [from,name,digest]of [[guardRoot,'source-guard','6bc7271cd7042ab54a9094a5b9365c4fcb8b1e3ff782be254bcbd9dc252ef1e0'],[adapterRoot,'strict-adapter','3c1c15eddd04779f2911f8aeaf115570a153dfae99fbee4ef2dd094a038fa188'],[proofRoot,'proof-validator','ff8551c21d58186f580a00e4498402c9d50493110ec01396e1045260e25ffa51']])copy(from+'/manifest.json','provenance/'+name+'-manifest.json',digest);
const REVIEW_PINS={originalDisabledStatic:'f1ec6697e1bfa473d98a06ddd26873ee19ccecf1ca8052fbecc58648895165e1',startupCorrectionStatic:'7df98531a079d6bb2f36776dfa79b271c760596890a4bb28f8330210eea7d7cf',correctedSynthetic:'8ba6bc914a08be991d32e5db45f4af22b9cdb0c97d9eded019af6feb561f330f'};
copy('C:/Users/Jorge/AppData/Local/Temp/omerta-dashboard-strict-gui-observer-static-review-c8eeb4c9-adcb-4278-b301-700a2394155f/review-receipt.json','provenance/gui-original-disabled-static-review.json',REVIEW_PINS.originalDisabledStatic);
copy('C:/Users/Jorge/.codex/worktrees/city-world-hud/Omerta/output/security/dashboard-game-parity-19f17454-strict-gui-startup-deadline-static-review.json','provenance/gui-startup-correction-static-review.json',REVIEW_PINS.startupCorrectionStatic);
copy('C:/Users/Jorge/AppData/Local/Temp/omerta-dashboard-strict-gui-deadline-synthetic-3379e04d-7913-455e-a97f-961c263f7194/test-receipt.json','provenance/gui-corrected-observer-synthetic-receipt.json',REVIEW_PINS.correctedSynthetic);
for(const name of ['manifest.json','ADAPTATION.md','scoped-review.json','static-joins.json','closed-input-verification.json'])copy(mapRoot+'/'+name,'provenance/adaptation-map-'+name);
const definitions=[
 ['observer',gui+'/hosted-observer.cjs','inputs/hosted-observer-PREPARATION.cjs','postimages/hosted-observer.EXECUTABLE.cjs','hosted-observer.cjs','a6e7cb13e2d31aa9fa7bcdb54b1f806e7a1fc0d228a9132a75072aad49e81720'],
 ['guard',guardRoot+'/hosted-source-guard.mjs','inputs/hosted-source-guard-PREPARATION.mjs','postimages/hosted-source-guard.EXECUTABLE.mjs','hosted-source-guard.mjs','f83f3ff71614b4ce0772bdf6943806e8b61b6053232db1f873df588b77868d93'],
 ['adapter',adapterRoot+'/strict-source-proof-adapter.mjs','inputs/strict-source-proof-adapter-PREPARATION.mjs','postimages/strict-source-proof-adapter.EXECUTABLE.mjs','strict-source-proof-adapter.mjs','7c4152c97a4de9ffa10adae82a0a18a9000720eba37dc023155bf27c3576fd9b'],
 ['proofValidator',proofRoot+'/proof-validator.mjs','inputs/proof-validator-PREPARATION.mjs','postimages/proof-validator.EXECUTABLE.mjs','proof-validator.mjs','daceafac88fc1f122dba6079bcbc2af621f6000f780651ee6b74441ae5627956'],
];
const MODULES={};
for(const[name,from,preparation,postimage,output,digest]of definitions){const raw=copy(from,preparation,digest),text=raw.toString('utf8');assert(Buffer.from(text).equals(raw));const matches=[...text.matchAll(/^throw new Error\([^\r\n]+\);/gm)];assert.equal(matches.length,1);const barrierLiteral=matches[0][0],barrierOffset=Buffer.byteLength(text.slice(0,matches[0].index)),barrier=Buffer.from(barrierLiteral);assert.equal(matches[0].index,name==='observer'?text.indexOf('\n')+1:0);const post=Buffer.concat([raw.subarray(0,barrierOffset),raw.subarray(barrierOffset+barrier.length)]);assert(Buffer.concat([post.subarray(0,barrierOffset),barrier,post.subarray(barrierOffset)]).equals(raw));put(postimage,post);MODULES[name]={preparation,postimage,output,before:{bytes:raw.length,sha256:sha(raw)},after:{bytes:post.length,sha256:sha(post)},barrierLiteral,barrierOffset};}
assert.equal(MODULES.guard.after.sha256,'b044281889a3b7b01f47b36abc58e6a816e3c15b5416679ea4d57d1fd6b247f0');
put('module-barrier-inverses.json',serial({phase:'EXACT_PREPARATION_ONLY_POSTIMAGES_NO_OPERATIONAL_APPROVAL',modules:MODULES,allOriginalFilesPreserved:true,removedLiteralCount:4,wholeByteInverses:true,codeOutsideEachBarrierUnchanged:true}));
const sourceTemplate=JSON.parse(read('source-binding.template.json')),SOURCE=sourceTemplate.sides.candidate.source,PRED=sourceTemplate.sides.predecessor.source;
const SIDES=Object.fromEntries(Object.entries(sourceTemplate.sides).map(([name,s])=>[name,{source:s.source,tree:s.tree,expectedSchema:s.expectedSchema}]));
let code=read('provenance/parent-materialize-hosted.cjs').toString('utf8');
function once(before,after){assert.equal(code.split(before).length,2,'Exact replacement anchor');code=code.replace(before,after);}
function replaceFunction(name,nextName,replacement){const first=code.indexOf('function '+name+'('),last=code.indexOf('function '+nextName+'(',first);assert(first>=0&&last>first);code=code.slice(0,first)+replacement+'\n'+code.slice(last);}
once("const SOURCE='d8e9f2e1feaf1df1f64584268069ba9917e30849',PRED='b8fcce7baaa91b29661921a17e5510a47e9f725a';",`const SOURCE='${SOURCE}',PRED='${PRED}';`);
once("const DEPS_SHA='f94d2897c9f035cd5f35a941a9778d1a257dc1bbc88c4f01639f4ec87a183ac7',GUARD_SHA='f83f3ff71614b4ce0772bdf6943806e8b61b6053232db1f873df588b77868d93',OBSERVER_SHA='b90ee561c293bee7be59e293ee7d4370ccd4d049827bf0bdcc1f670f19ab40c2';",`const DEPS_SHA='f94d2897c9f035cd5f35a941a9778d1a257dc1bbc88c4f01639f4ec87a183ac7',CONTRACT_SHA='77acfe2a27ca8e088a1ce1dd9aa7b24c09c280eac41559d28689bd7f356d9ace';\nconst MODULES=Object.freeze(${JSON.stringify(MODULES)});\nconst OBSERVER_REVIEWS=Object.freeze(${JSON.stringify(REVIEW_PINS)});`);
const barrierLine=code.split('\n').find(l=>l.startsWith('const BARRIER='));once(barrierLine,'');
const sideLine=code.split('\n').find(l=>l.startsWith('const SIDES='));once(sideLine,`const SIDES=Object.freeze(${JSON.stringify(SIDES)});`);
replaceFunction('removeBarrier','admission',`function removeBarrier(name,input){const s=MODULES[name];assert(s,'Unknown reviewed module');assert.equal(input.length,s.before.bytes);assert.equal(sha(input),s.before.sha256);const text=input.toString('utf8');assert(Buffer.from(text).equals(input));assert.equal(text.split(s.barrierLiteral).length,2);const barrier=Buffer.from(s.barrierLiteral);assert(input.subarray(s.barrierOffset,s.barrierOffset+barrier.length).equals(barrier));const post=Buffer.concat([input.subarray(0,s.barrierOffset),input.subarray(s.barrierOffset+barrier.length)]);assert(Buffer.concat([post.subarray(0,s.barrierOffset),barrier,post.subarray(s.barrierOffset)]).equals(input));assert.equal(post.length,s.after.bytes);assert.equal(sha(post),s.after.sha256);return post;}`);
once("assert.equal(a.schema,'omerta.rootd8-bg-hosted-materialization.v1');","assert.equal(a.schema,'omerta.gui19f-d8-hosted-materialization.v1');");
once("assert.equal(a.scope,'NODE_GIT_SIBLING_SOURCES_SCHEMAS_DEPENDENCIES_DRIVER139');","assert.equal(a.scope,'STRICT_GUI19F_D8_NODE_GIT_SCHEMA_LOCK_VERSION_DEPENDENCIES_DRIVER139');");
once("assert.equal(a.observerSHA256,OBSERVER_SHA);assert.equal(a.observerPeerSHA256,'e680de44704fb2cd366de0be58fe811dca3187cc6a053fd9ce6e63ac24aee70b');", "assert.equal(a.observerSHA256,MODULES.observer.after.sha256);assert.equal(a.observerPeerSHA256,a.independentReviewSHA256);assert.deepEqual(a.observerReviews,OBSERVER_REVIEWS);assert.equal(a.proofContractSHA256,CONTRACT_SHA);for(const[name,s]of Object.entries(MODULES)){assert.deepEqual(a.modulePreimages?.[name],s.before);assert.deepEqual(a.modulePostimages?.[name],s.after);}");
once("assert.equal(env.GITHUB_JOB,'rootd8-bg-pair');","assert.equal(env.GITHUB_JOB,'gui19f-d8-pair');");
once("referenceSourcesOnly:{root:SOURCE,bg:PRED,historicalGUI:'f4d796e258db8713a91ce48190f9747aa0ea1ea5',actualGUIFinal:null}","referenceSourcesOnly:{expectedPredecessor:PRED,actualGUIFinal:SOURCE,actualDeployedPredecessor:null}");
once('dependencyInventorySHA256:DEPS_SHA,scope:a.scope','dependencyInventorySHA256:DEPS_SHA,modulePreimages:a.modulePreimages,modulePostimages:a.modulePostimages,proofContractSHA256:CONTRACT_SHA,observerReviews:a.observerReviews,scope:a.scope');
const prepareStart=code.indexOf('function prepare('),prepareEnd=code.indexOf('function verifyRuntime(',prepareStart);assert(prepareStart>=0&&prepareEnd>prepareStart);
code=code.slice(0,prepareStart)+`function observerConfig(a,binding,modules,contract){admission(a,null);for(const[name,s]of Object.entries(MODULES)){const r=modules[name];assert(r&&path.isAbsolute(r.path));assert.equal(r.bytes,s.after.bytes);assert.equal(r.sha256,s.after.sha256);}assert(contract&&path.isAbsolute(contract.path));assert.equal(contract.sha256,CONTRACT_SHA);assert.equal(contract.bytes,1670);return{enabled:true,source:SOURCE,predecessor:PRED,guiBindingSchemaReviewed:true,workflowCommit:a.workflowCommit,repository:a.repository,workflowRef:a.privateWorkflowRef,guardModule:modules.guard,guardBinding:binding,adapterModule:modules.adapter,proofModule:modules.proofValidator,proofContract:contract,actualServiceIdentity:null,actualWorkflowContext:null,actualRuntimeDependencyEvidence:null,actualAdmission:null,actualResult:null,actualRetention:null};}
function prepare(file,digest,env=process.env){
  const{a,ref:approvalRef}=rootApproval(file,digest);admission(a,env,process.execArgv);const job=jobPaths(env),bundle=__dirname;
  const manifest=json(pinned(path.join(bundle,'manifest.json'),a.packageManifestSHA256));assert.equal(manifest.phase,'GUI_SOURCE_ONLY_HOSTED_MATERIALIZATION_PREPARATION');
  for(const r of manifest.files){const raw=pinned(path.join(bundle,r.file),r.sha256);assert.equal(raw.length,r.bytes);}
  const output=job.temporary+'/rc1-hosted-controls';assert(!fs.existsSync(output),'Fresh materialization only');fs.mkdirSync(output,{mode:0o700});
  const runtimeOutput=job.temporary+'/rc1-hosted-runtime-reference';assert(!fs.existsSync(runtimeOutput));fs.mkdirSync(runtimeOutput,{mode:0o700});pinned(job.nodeArchive,NODE_ARCHIVE);
  cp.execFileSync('tar',['--extract','--same-permissions','--gzip','--file',job.nodeArchive,'--directory',runtimeOutput],{timeout:60000,maxBuffer:65536});
  const runtime=runtimeCheck(job,runtimeOutput+'/node-v22.23.3-linux-x64');put(output,'runtime-before.json',serial(runtime));
  const deps=put(output,'expected-dependencies-linux-x64.json',pinned(path.join(bundle,'inputs/expected-dependencies-linux-x64.json'),DEPS_SHA));assert.equal(deps.bytes,239089);
  const nodeProvenance=put(output,'node-runtime-provenance.json',bytes(path.join(bundle,'inputs/node-runtime-provenance.json'))),gitAcceptance=put(output,'root-git-acceptance.json',bytes(path.join(bundle,'inputs/root-git-acceptance.json')));
  put(output,'expected-runtime-git.json',pinned(path.join(bundle,'inputs/expected-runtime-git.json'),'1625dc4323716c8b48e8cc9f5568b51fe69dba3311640da89155346f6d1ca7f9'));
  const retainedApproval=put(output,'root-approval.json',pinned(file,digest));
  const rendered=renderBinding(a,job,{expectedDependencies:deps,nodeProvenance,rootApproval:retainedApproval,gitAcceptance});
  const modules={};for(const[name,s]of Object.entries(MODULES)){const original=pinned(path.join(bundle,s.preparation),s.before.sha256),post=removeBarrier(name,original);assert(post.equals(pinned(path.join(bundle,s.postimage),s.after.sha256)));put(output,path.basename(s.preparation),original);modules[name]=put(output,s.output,post);}
  for(const[name,digest]of Object.entries(REFS))put(output,name,pinned(path.join(bundle,'inputs/'+name),digest));
  const contract=put(output,'proof-contract.json',pinned(path.join(bundle,'inputs/proof-contract.json'),CONTRACT_SHA));
  for(const name of['module-barrier-inverses.json','source-binding.template.json'])put(output,name,bytes(path.join(bundle,name)));
  for(const name of['gui-original-disabled-static-review.json','gui-startup-correction-static-review.json','gui-corrected-observer-synthetic-receipt.json'])put(output,name,bytes(path.join(bundle,'provenance/'+name)));
  rendered.binding.independentApproval.receipt=put(output,'independent-input-approval.json',serial(rendered.inputReceipt));
  const binding=put(output,'guard-binding.json',serial(rendered.binding));
  const config=observerConfig(a,binding,modules,contract);
  put(output,'hosted-binding.json',serial(config));put(output,'materialization-receipt.json',serial({phase:'ROOT_APPROVED_GUI_JOB_INPUTS_MATERIALIZED_NO_PAIR_RESULT',approval:retainedApproval,modules,binding,proofContract:contract,runtime,source:SOURCE,predecessor:PRED,workflowCommit:a.workflowCommit,independentReviewSHA256:a.independentReviewSHA256}));
  return{output,complete:true,phase:'GUI_JOB_INPUT_MATERIALIZATION_ONLY'};
}
`+code.slice(prepareEnd);
once("assert.equal(a.schema,'omerta.rootd8-bg-workflow-template.v1');","assert.equal(a.schema,'omerta.gui19f-d8-workflow-template.v1');");
once('DEPS_SHA,GUARD_SHA,OBSERVER_SHA,BARRIER,sha','DEPS_SHA,CONTRACT_SHA,MODULES,OBSERVER_REVIEWS,sha');
once('jobPaths,prepare,verifyRuntime','jobPaths,observerConfig,prepare,verifyRuntime');
put('materialize-hosted.cjs',Buffer.from(code));
const approval={schema:'omerta.gui19f-d8-hosted-materialization.v1',enabled:false,source:SOURCE,predecessor:PRED,scope:'STRICT_GUI19F_D8_NODE_GIT_SCHEMA_LOCK_VERSION_DEPENDENCIES_DRIVER139',materializerSHA256:null,packageManifestSHA256:null,independentReviewSHA256:null,rootConfigReviewSHA256:null,observerSHA256:MODULES.observer.after.sha256,observerPeerSHA256:null,observerReviews:REVIEW_PINS,modulePreimages:Object.fromEntries(Object.entries(MODULES).map(([k,s])=>[k,s.before])),modulePostimages:Object.fromEntries(Object.entries(MODULES).map(([k,s])=>[k,s.after])),proofContractSHA256:'77acfe2a27ca8e088a1ce1dd9aa7b24c09c280eac41559d28689bd7f356d9ace',repository:null,workflowCommit:null,workflowPath:'.github/workflows/rc1-recovery.yml',proofRef:null,privateWorkflowRef:null,checkoutActionSHA:null,uploadActionSHA:null,actualRunner:null,actualService:null,actualBinding:null,actualResult:null,actualRetention:null};
put('root-approval.UNBOUND.json',serial(approval));
put('workflow-refs.UNBOUND.json',serial({schema:'omerta.gui19f-d8-workflow-template.v1',enabled:false,source:SOURCE,predecessor:PRED,operationalAuthority:false,rootTemplateReviewSHA256:null,checkoutActionSHA:null,uploadActionSHA:null}));
let workflow=fs.readFileSync(parent+'/workflow.yml.template','utf8');
workflow=workflow.replaceAll('d8e9f2e1feaf1df1f64584268069ba9917e30849','__ORIGINAL_CANDIDATE__').replaceAll('b8fcce7baaa91b29661921a17e5510a47e9f725a',PRED).replaceAll('__ORIGINAL_CANDIDATE__',SOURCE);
workflow=workflow.replaceAll('Root d8 BG isolated canonical M6 proof','Strict GUI19f d8 isolated canonical proof').replaceAll('never mutate d8 or BG','never mutate GUI19f or d8').replaceAll('root-d8-bg-hosted-sourcepair','gui19f-d8-hosted-sourcepair').replaceAll('rootd8-bg-pair','gui19f-d8-pair').replaceAll('rootd8-bg-sourcepair','gui19f-d8-sourcepair').replaceAll('Original canonical M6 under byte-exact reviewed observer','Unchanged strict canonical proof under reviewed GUI observer').replaceAll('HOSTED_PAIR_ENABLED','GUI_HOSTED_PAIR_ENABLED').replaceAll('HOSTED_PAIR_APPROVAL_JSON','GUI_HOSTED_PAIR_APPROVAL_JSON').replaceAll('HOSTED_PAIR_APPROVAL_SHA256','GUI_HOSTED_PAIR_APPROVAL_SHA256');
// Root run39003881167 failed before checkout: explicit NONE trips runner service health inspection.
// Preserve observer healthcheck-absence assertions and owned readiness; remove only this template line.
assert.equal(workflow.split('        options: --no-healthcheck\n').length,2);
workflow=workflow.replace('        options: --no-healthcheck\n','');
put('workflow.yml.template',Buffer.from(workflow));
put('copied-input-origins.json',serial({phase:'COPIED_INPUTS_WITHOUT_SCRIPT_EXECUTION',files:copies,allCopiesExactAtCreation:true,initialPreparationDiagnostic:'An initial inline PowerShell copy-list expression joined the first source/destination strings and failed before copying any file. Corrected by this builtin-only explicit preparation builder; no parent/frozen/product file changed.'}));
console.log(JSON.stringify({phase:'DISABLED_GUI_PREPARATION_MATERIALIZED_ONLY',copiedInputs:copies.length,modulePostimages:Object.fromEntries(Object.entries(MODULES).map(([k,s])=>[k,s.after])),source:SOURCE,predecessor:PRED,allOperationalApprovalsUnbound:true}));
