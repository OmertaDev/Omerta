'use strict';
// Builtin-only isolated tests. Packet code sees denied or synthetic capabilities.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,read=name=>fs.readFileSync(path.join(root,name)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inverses=JSON.parse(read('module-barrier-inverses.json')),files={};
const names=['materialize-hosted.cjs','root-approval.UNBOUND.json','workflow-refs.UNBOUND.json','workflow.yml.template','source-binding.template.json','module-barrier-inverses.json','hosted-binding.UNBOUND.json','provenance/parent-materialize-hosted.cjs','provenance/parent-workflow.yml.template','install-approved-runtime.sh'];
for(const spec of Object.values(inverses.modules))names.push(spec.preparation,spec.postimage);
for(const name of fs.readdirSync(path.join(root,'inputs')))names.push('inputs/'+name);
for(const name of ['gui-original-disabled-static-review.json','gui-startup-correction-static-review.json','gui-corrected-observer-synthetic-receipt.json'])names.push('provenance/'+name);
for(const name of [...new Set(names)])files[name]=read(name).toString('base64');
const attempts={unexpectedFilesystem:0,unexpectedProcess:0,unexpectedImport:0,dynamicImport:0},deny=key=>new Proxy({}, {get(){return()=>{attempts[key]++;throw new Error('Denied real capability: '+key);};}});
const syntheticRequire=name=>{if(name==='node:fs')return deny('unexpectedFilesystem');if(name==='node:child_process')return deny('unexpectedProcess');if(name==='node:path')return path.posix;if(name==='node:crypto')return crypto;if(name==='node:assert/strict')return assert;if(name==='node:url')return require('node:url');if(name==='node:module')return{createRequire:()=>()=>{attempts.unexpectedImport++;throw new Error('Denied application import');}};attempts.unexpectedImport++;throw new Error('Unexpected require '+name);};
const context=vm.createContext({Buffer,URL,URLSearchParams,structuredClone,require:syntheticRequire,console:{log(){}},setTimeout(){throw new Error('Denied real timer');},clearTimeout(){}});
vm.runInContext('const INPUT_FILES='+JSON.stringify(files)+'; const capabilityAttempts='+JSON.stringify(attempts)+'; const process={platform:"linux",arch:"x64",execPath:"/job/temp/rc1-hosted-runtime/node-v22.23.3-linux-x64/bin/node",version:"v22.23.3",execArgv:[],argv:[],env:{}};',context);
function load(source,label){context.__sourceText=source;context.__sourceName=label;return vm.runInContext(`(()=>{const module={exports:{}};const fn=new Function('require','module','exports','__dirname','__filename',__sourceText);fn(require,module,module.exports,'/packet','/packet/'+__sourceName);return module.exports;})()`,context);}
context.m=load(read('materialize-hosted.cjs').toString(),'materialize-hosted.cjs');
context.o=load(read('postimages/hosted-observer.EXECUTABLE.cjs').toString(),'hosted-observer.cjs');
new vm.Script(read('synthetic-cases.js').toString(),{filename:'synthetic-cases.js'}).runInContext(context,{timeout:30000});
const result=JSON.parse(vm.runInContext('JSON.stringify(TEST_RESULT)',context));
result.realCapabilityAttempts=attempts;
assert.deepEqual(attempts,{unexpectedFilesystem:0,unexpectedProcess:0,unexpectedImport:0,dynamicImport:0});
result.packetSourceSHA256={materializer:sha(read('materialize-hosted.cjs')),observerPostimage:sha(read('postimages/hosted-observer.EXECUTABLE.cjs'))};
result.limitations=['Only builtins loaded by the test harness; materializer and observer exported helpers evaluated in a VM with denied fs/process/import capabilities.','prepare() orchestration ran solely against an in-memory filesystem, mocked tar/runtime observations and synthetic authority. No actual runner input approval or binding was written.','Runtime checker used an extracted actual function with synthetic file/hash/tree inputs. No Node/Git archive installation or real dependency observation.','Workflow validation is exact accepted-template transformation and structural assertions, not a newly installed YAML parser.','No application, dependency, guard capture, canonical CLI, PostgreSQL, Docker, CIM, network, ports, Git command, workflow publication, repository variable or dispatch occurred.'];
fs.writeFileSync(path.join(root,'synthetic-results.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({phase:result.phase,counts:result.counts,realCapabilityAttempts:attempts}));
