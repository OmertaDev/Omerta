'use strict';
// Root-owned late materialization only. Importing this module performs no observations.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const SOURCE='d8e9f2e1feaf1df1f64584268069ba9917e30849',PRED='b8fcce7baaa91b29661921a17e5510a47e9f725a';
const NODE_ARCHIVE='1084aa36196bba4c3a5e69a1ee388a6e4ff729dad09445fbcd434b28fe3c24af',NODE_SHA='fde6a4bf8d0562f7751d1a2d6cb9b417c4cfe107bbcb0aa3e9a24e125e348f48',NPM_SHA='8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7',GIT_SHA='d4d2ba562243015206d4248edfec871a74786499292d00ed072dbca2f5ae8073';
const DEPS_SHA='f94d2897c9f035cd5f35a941a9778d1a257dc1bbc88c4f01639f4ec87a183ac7',GUARD_SHA='f83f3ff71614b4ce0772bdf6943806e8b61b6053232db1f873df588b77868d93',OBSERVER_SHA='b90ee561c293bee7be59e293ee7d4370ccd4d049827bf0bdcc1f670f19ab40c2';
const BARRIER="throw new Error('PREPARATION ONLY: independently bind and review a separate executable successor before use');";
const SIDES=Object.freeze({candidate:{source:SOURCE,tree:'c9a572fb40d0b89c716919624a1cdd228c0f2a48',expectedSchema:{blob:'1809d354c1876cdef832792e0047586d209baaae',rawSHA256:'ee531119833166dd64e2316d23576248fbbaf8ca0a90bfc297b220eaf4b0282b',rawBytes:589940,mode:'100755'}},predecessor:{source:PRED,tree:'2f2a73b57b928fd383c8ae58e4fedefa025a3dbb',expectedSchema:{blob:'cc1c70bc78ce29546e01a97fe4026471ec7e3a06',rawSHA256:'1fbe97d1f971d908623d5cd7cbd7aab4e2411844c1d8be2688cdbaaba558f137',rawBytes:583823,mode:'100755'}}});
const REFS=Object.freeze({'driver-and-boot.reference.json':'f40e92b119b30b203542011bc16859762680cccd9f7ec138eed4f2c9e647e0ca','phosphor-embedded.reference.json':'195b285bde26866e8cd20fbb0dbd88bd82ea41371376b3b55c31b37f1aff5e76','pino-embedded.reference.json':'719775f96ad413f00f7d0f2df9377b0c30ffbf3c5e55c2acb65f67383405ac85'});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(b.toString('utf8'));
const serial=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
function physical(file,directory=false){assert(path.isAbsolute(file)&&path.resolve(file)===file);assert.equal(fs.realpathSync(file),file,'Physical canonical path required');const s=fs.lstatSync(file);assert(!s.isSymbolicLink()&&(directory?s.isDirectory():s.isFile()));return s;}
function bytes(file){physical(file);return fs.readFileSync(file);}
function descriptor(file){const b=bytes(file);return{path:file,bytes:b.length,sha256:sha(b)};}
function pinned(file,digest){const b=bytes(file);assert.equal(sha(b),digest);return b;}
function put(folder,name,b){const file=path.join(folder,name);fs.writeFileSync(file,b,{flag:'wx',mode:0o600});return descriptor(file);}
function removeBarrier(input){assert.equal(sha(input),GUARD_SHA);const text=input.toString('utf8');assert(Buffer.from(text).equals(input));assert(text.startsWith(BARRIER));assert.equal(text.split(BARRIER).length,2);const post=Buffer.from(text.slice(BARRIER.length));assert(Buffer.concat([Buffer.from(BARRIER),post]).equals(input));return post;}
function admission(a,env,execArgv=[]){
  assert.equal(a.enabled,true,'UNBOUND: Root approval is required before materialization');assert.deepEqual(execArgv,[]);
  assert.equal(a.schema,'omerta.rootd8-bg-hosted-materialization.v1');assert.equal(a.source,SOURCE);assert.equal(a.predecessor,PRED);
  assert.equal(a.scope,'NODE_GIT_SIBLING_SOURCES_SCHEMAS_DEPENDENCIES_DRIVER139');
  assert.match(a.materializerSHA256,/^[a-f0-9]{64}$/);assert.match(a.packageManifestSHA256,/^[a-f0-9]{64}$/);
  assert.match(a.independentReviewSHA256,/^[a-f0-9]{64}$/);assert.match(a.rootConfigReviewSHA256,/^[a-f0-9]{64}$/);
  assert.equal(a.observerSHA256,OBSERVER_SHA);assert.equal(a.observerPeerSHA256,'e680de44704fb2cd366de0be58fe811dca3187cc6a053fd9ce6e63ac24aee70b');
  assert.match(a.repository,/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);assert.match(a.workflowCommit,/^[a-f0-9]{40}$/);assert(![SOURCE,PRED].includes(a.workflowCommit));
  assert.equal(a.workflowPath,'.github/workflows/rc1-recovery.yml');assert.equal(a.privateWorkflowRef,a.repository+'/'+a.workflowPath+'@'+a.proofRef);assert.match(a.proofRef,/^refs\/heads\/codex\/[A-Za-z0-9_.\/-]+$/);
  for(const key of['checkoutActionSHA','uploadActionSHA'])assert.match(a[key],/^[a-f0-9]{40}$/);
  if(env){assert.equal(env.GITHUB_SHA,a.workflowCommit);assert.equal(env.GITHUB_WORKFLOW_REF,a.privateWorkflowRef);assert.equal(env.GITHUB_REPOSITORY,a.repository);assert.equal(env.GITHUB_JOB,'rootd8-bg-pair');assert.match(env.GITHUB_RUN_ID,/^[0-9]+$/);assert.match(env.GITHUB_RUN_ATTEMPT,/^[0-9]+$/);assert.match(env.HOSTED_PAIR_SERVICE_ID,/^[a-f0-9]{64}$/);assert.equal(env.CHAIN_ENABLED,'off');assert.equal(env.RESOURCE_ECONOMY,'off');for(const k of Object.keys(env))assert(!/DATABASE_URL$|^PG|^RC1|^NODE_OPTIONS$|^NODE_PATH$|^NODE_PG_FORCE_NATIVE$|^GENESIS_AUCTION_MANIFEST_|^NEXT_LAYER_NATIVE_|^MARKET_OPERATIONS_NATIVE_/i.test(k),'Ambient selector by presence: '+k);}
  return a;
}
function renderBinding(a,job,refs){
  admission(a,job.env);const workspace=job.workspace,temp=job.temporary;assert(path.posix.isAbsolute(workspace)&&path.posix.isAbsolute(temp));assert.equal(job.node,job.runtimeRoot+'/bin/node');assert.equal(job.npmCli,job.runtimeRoot+'/lib/node_modules/npm/bin/npm-cli.js');assert.equal(job.git,job.gitRoot+'/usr/bin/git');
  const runtime={node:{path:job.node,version:'v22.23.3',sha256:NODE_SHA,provenance:refs.nodeProvenance},git:{path:job.git,sha256:GIT_SHA},npmCli:{path:job.npmCli,sha256:NPM_SHA},path:[path.posix.dirname(job.node),path.posix.dirname(job.git),'/usr/bin','/bin'].join(':')};
  const sides={};for(const name of['candidate','predecessor'])sides[name]={...SIDES[name],directory:workspace+'/'+name,expectedDependencies:refs.expectedDependencies};
  const inputReceipt={phase:'INDEPENDENTLY_REVIEWED_HOSTED_SOURCE_PAIR_INPUTS',runtimeNodeSHA256:NODE_SHA,driverReferenceSHA256:REFS['driver-and-boot.reference.json'],sides:Object.fromEntries(Object.entries(sides).map(([name,s])=>[name,{source:s.source,tree:s.tree,schema:s.expectedSchema,expectedDependencies:s.expectedDependencies}])),authority:{rootApproval:refs.rootApproval,packageManifestSHA256:a.packageManifestSHA256,independentReviewSHA256:a.independentReviewSHA256,rootConfigReviewSHA256:a.rootConfigReviewSHA256,gitAcceptance:refs.gitAcceptance,dependencyInventorySHA256:DEPS_SHA,scope:a.scope},limitation:'Path rendering records previously reviewed inputs; it is not an observed runtime or PAIR result.'};
  return{runtime,sides,inputReceipt,binding:{schema:'omerta.hosted-source-pair-binding.v1',phase:'ROOT_APPROVED_JOB_BOUND_INPUTS',platform:'linux',arch:'x64',runtime,independentApproval:{driverReferenceSHA256:REFS['driver-and-boot.reference.json'],receipt:null},sides,referenceSourcesOnly:{root:SOURCE,bg:PRED,historicalGUI:'f4d796e258db8713a91ce48190f9747aa0ea1ea5',actualGUIFinal:null}}};
}
function tree(root){physical(root,true);const result=[];function walk(dir,rel=''){for(const name of fs.readdirSync(dir).sort()){const file=path.join(dir,name),at=rel+name,s=fs.lstatSync(file);if(s.isSymbolicLink()){const target=fs.readlinkSync(file);assert(!path.isAbsolute(target));const resolved=path.resolve(path.dirname(file),target);assert(resolved.startsWith(root+path.sep));result.push({path:at,type:'link',target});}else if(s.isDirectory()){result.push({path:at,type:'directory',mode:s.mode&0o777});walk(file,at+'/');}else{assert(s.isFile());const b=fs.readFileSync(file);result.push({path:at,type:'file',mode:s.mode&0o777,bytes:b.length,sha256:sha(b)});}}}walk(root);return result;}
function compareNpm(expected,actual){assert.deepEqual(actual,expected,'Whole bundled npm tree differs from the hash-verified complete official Node archive');return true;}
function runtimeCheck(job,referenceRoot){
  assert.equal(process.platform,'linux');assert.equal(process.arch,'x64');assert.equal(process.execPath,job.node);assert.equal(process.version,'v22.23.3');assert.deepEqual(process.execArgv,[]);
  pinned(job.nodeArchive,NODE_ARCHIVE);pinned(job.gitArchive,'6238a37c11c1bd4b18a5194f766ccfcb2f26c116e7d8ecd07bac143863b69498');
  pinned(job.node,NODE_SHA);pinned(job.npmCli,NPM_SHA);pinned(job.git,GIT_SHA);
  const installed=tree(job.runtimeRoot+'/lib/node_modules/npm'),expected=tree(referenceRoot+'/lib/node_modules/npm');compareNpm(expected,installed);
  return{phase:'VERIFIED_APPROVED_NODE_ARCHIVE_AND_BUNDLED_NPM_TREE',node:descriptor(job.node),git:descriptor(job.git),npmCli:descriptor(job.npmCli),nodeArchive:descriptor(job.nodeArchive),gitArchive:descriptor(job.gitArchive),npmTreeSHA256:sha(serial(installed)),npmEntries:installed.length,scope:'Only approved Node/npm distribution and Git binary; no OS-wide library attestation'};
}
function rootApproval(file,digest){assert.match(digest,/^[a-f0-9]{64}$/);const raw=pinned(file,digest),a=json(raw);admission(a,null);assert.equal(a.materializerSHA256,sha(bytes(__filename)));return{a,ref:descriptor(file)};}
function jobPaths(env){const temp=env.RUNNER_TEMP,workspace=env.GITHUB_WORKSPACE;assert(path.posix.isAbsolute(temp)&&path.posix.isAbsolute(workspace));return{temporary:temp,workspace,env,runtimeRoot:temp+'/rc1-hosted-runtime/node-v22.23.3-linux-x64',gitRoot:temp+'/rc1-hosted-runtime/git',node:temp+'/rc1-hosted-runtime/node-v22.23.3-linux-x64/bin/node',npmCli:temp+'/rc1-hosted-runtime/node-v22.23.3-linux-x64/lib/node_modules/npm/bin/npm-cli.js',git:temp+'/rc1-hosted-runtime/git/usr/bin/git',nodeArchive:temp+'/rc1-hosted-runtime/node.tar.gz',gitArchive:temp+'/rc1-hosted-runtime/git.deb'};}
function prepare(file,digest,env=process.env){
  const{a,ref:approvalRef}=rootApproval(file,digest);admission(a,env,process.execArgv);const job=jobPaths(env),bundle=__dirname;
  const manifest=json(pinned(path.join(bundle,'manifest.json'),a.packageManifestSHA256));assert.equal(manifest.phase,'SOURCE_ONLY_HOSTED_MATERIALIZATION_PREPARATION');
  for(const r of manifest.files)pinned(path.join(bundle,r.file),r.sha256);
  const output=job.temporary+'/rc1-hosted-controls';assert(!fs.existsSync(output),'Fresh materialization only');fs.mkdirSync(output,{mode:0o700});
  const runtimeOutput=job.temporary+'/rc1-hosted-runtime-reference';assert(!fs.existsSync(runtimeOutput));fs.mkdirSync(runtimeOutput,{mode:0o700});pinned(job.nodeArchive,NODE_ARCHIVE);
  cp.execFileSync('tar',['--extract','--same-permissions','--gzip','--file',job.nodeArchive,'--directory',runtimeOutput],{timeout:60000,maxBuffer:65536});
  const runtime=runtimeCheck(job,runtimeOutput+'/node-v22.23.3-linux-x64');put(output,'runtime-before.json',serial(runtime));
  const deps=put(output,'expected-dependencies-linux-x64.json',pinned(path.join(bundle,'inputs/expected-dependencies-linux-x64.json'),DEPS_SHA));
  const nodeProvenance=put(output,'node-runtime-provenance.json',bytes(path.join(bundle,'inputs/node-runtime-provenance.json'))),gitAcceptance=put(output,'root-git-acceptance.json',bytes(path.join(bundle,'inputs/root-git-acceptance.json')));
  const retainedApproval=put(output,'root-approval.json',pinned(file,digest));
  const rendered=renderBinding(a,job,{expectedDependencies:deps,nodeProvenance,rootApproval:retainedApproval,gitAcceptance});
  const guard=put(output,'hosted-source-guard.mjs',removeBarrier(pinned(path.join(bundle,'inputs/hosted-source-guard-PREPARATION.mjs'),GUARD_SHA)));
  for(const[name,digest]of Object.entries(REFS))put(output,name,pinned(path.join(bundle,'inputs/'+name),digest));
  rendered.binding.independentApproval.receipt=put(output,'independent-input-approval.json',serial(rendered.inputReceipt));
  const binding=put(output,'guard-binding.json',serial(rendered.binding));
  put(output,'hosted-observer.cjs',pinned(path.join(bundle,'inputs/hosted-observer.cjs'),OBSERVER_SHA));
  const config={enabled:true,source:SOURCE,predecessor:PRED,guiBindingSchemaReviewed:true,workflowCommit:a.workflowCommit,repository:a.repository,workflowRef:a.privateWorkflowRef,guardModule:guard,guardBinding:binding,actualServiceIdentity:null,actualWorkflowContext:null,actualRuntimeDependencyEvidence:null,actualAdmission:null,actualResult:null,actualRetention:null};
  put(output,'hosted-binding.json',serial(config));put(output,'materialization-receipt.json',serial({phase:'ROOT_APPROVED_JOB_INPUTS_MATERIALIZED_NO_PAIR_RESULT',approval:retainedApproval,guard,binding,observerSHA256:OBSERVER_SHA,runtime,source:SOURCE,predecessor:PRED,workflowCommit:a.workflowCommit}));
  return{output,complete:true,phase:'JOB_INPUT_MATERIALIZATION_ONLY'};
}
function verifyRuntime(file,digest,env=process.env){const{a}=rootApproval(file,digest);admission(a,env,process.execArgv);const job=jobPaths(env),out=job.temporary+'/rc1-hosted-controls';physical(out,true);const after=runtimeCheck(job,job.temporary+'/rc1-hosted-runtime-reference/node-v22.23.3-linux-x64');assert.deepEqual(after,json(bytes(out+'/runtime-before.json')));return put(out,'runtime-after.json',serial(after));}
function workflowAdmission(a){assert.equal(a.schema,'omerta.rootd8-bg-workflow-template.v1');assert.equal(a.enabled,true,'UNBOUND workflow refs: Root static review required');assert.equal(a.source,SOURCE);assert.equal(a.predecessor,PRED);assert.equal(a.operationalAuthority,false);assert.match(a.rootTemplateReviewSHA256,/^[a-f0-9]{64}$/);for(const key of['checkoutActionSHA','uploadActionSHA'])assert.match(a[key],/^[a-f0-9]{40}$/);return a;}
function renderWorkflow(a,template){workflowAdmission(a);assert.equal(template.split('__CHECKOUT_SHA__').length,6);assert.equal(template.split('__UPLOAD_SHA__').length,2);return template.replaceAll('__CHECKOUT_SHA__',a.checkoutActionSHA).replaceAll('__UPLOAD_SHA__',a.uploadActionSHA);}
module.exports={SOURCE,PRED,SIDES,REFS,NODE_ARCHIVE,NODE_SHA,NPM_SHA,GIT_SHA,DEPS_SHA,GUARD_SHA,OBSERVER_SHA,BARRIER,sha,serial,removeBarrier,admission,renderBinding,tree,compareNpm,runtimeCheck,rootApproval,jobPaths,prepare,verifyRuntime,workflowAdmission,renderWorkflow};
if(require.main===module){try{const[mode,file,digest,output]=process.argv.slice(2);assert(['workflow','prepare','verify-runtime'].includes(mode));assert(file&&digest);if(mode==='workflow'){assert(output&&process.argv.length===6);const a=json(pinned(file,digest));fs.writeFileSync(output,renderWorkflow(a,bytes(path.join(__dirname,'workflow.yml.template')).toString('utf8')),{flag:'wx',mode:0o600});}else{assert(!output&&process.argv.length===5);console.log(JSON.stringify(mode==='prepare'?prepare(file,digest):verifyRuntime(file,digest)));}}catch(e){console.error(e.message);process.exitCode=1;}}
