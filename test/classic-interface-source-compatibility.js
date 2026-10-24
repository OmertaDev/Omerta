// Current physical source transfer is separate from the immutable classic/F92 proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as source from '../tools/commerce-current-enterprise-source-compatibility.js';
import {ECONOMY_HARDENING_BINDING_DOMAINS,ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION,
 ECONOMY_HARDENING_BINDING_SUCCESSOR_TREE,ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,
 ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR_TREE,ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS,
 economyHardeningSourceBaseline} from '../tools/economy-hardening-source-transfer.js';
import {ACTION_READINESS_SOURCE,qualifyActionReadinessSource,actionReadinessHistoricalInput} from '../tools/action-readiness-source-compatibility.js';
import {ECONOMY_READINESS_MERGE_SOURCE,qualifyEconomyReadinessMergeSource,
 economyReadinessMergeHistoricalInput,qualifyEconomyHardeningMergeSource,
 economyHardeningMergeHistoricalInput} from '../tools/economy-readiness-merge-source-compatibility.js';
assert.equal(typeof source.qualifyRebuildInterfaceSource, 'function', 'Exact rebuilt-interface transfer must exist');
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8',maxBuffer:32*1024*1024});
const pin=source.REBUILD_INTERFACE_SOURCE,sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(pin.status,'SEALED');
for(const [revision,tree]of [[pin.revision,pin.tree],[pin.targetRevision,pin.targetTree]])assert.equal(git('rev-parse',revision+'^{tree}').trim(),tree);
git('merge-base','--is-ancestor',pin.targetRevision,pin.revision);
const packageBindingRevision='73b6f85cd87d234c7983319a9e0b0c58b013f38f';
const packageBindingTree='025067916e37232d041263604fdf52fefdb08041';
assert.equal(git('rev-parse',packageBindingRevision+'^{tree}').trim(),packageBindingTree);
git('merge-base','--is-ancestor',pin.revision,packageBindingRevision);
git('merge-base','--is-ancestor',packageBindingRevision,'HEAD');
const packageBinding=ECONOMY_HARDENING_BINDING_DOMAINS['package.json'];
assert.equal(git('ls-tree',packageBindingRevision,'--','package.json').trim(),'100644 blob '+packageBinding.currentBlob+'\tpackage.json');
const fixtureFile='test/lib/rc1-historical-source-fixture.js';
assert.equal(ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION,'66b4c6008e6b9c192ae20006c59bc591be82a27a');
assert.equal(ECONOMY_HARDENING_BINDING_SUCCESSOR_TREE,'38d87c3be5fdd4890ab5a9cdc7309a4332b50a14');
assert.equal(ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,'c94bb20cf84de303a34730f4723cff17192d6923');
assert.equal(ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR_TREE,'e0f65c75eab02d2cbdc69d1da13047217d6651ce');
assert.equal(git('rev-parse',ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION+'^{tree}').trim(),ECONOMY_HARDENING_BINDING_SUCCESSOR_TREE);
assert.equal(git('rev-parse',ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR+'^{tree}').trim(),ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR_TREE);
git('merge-base','--is-ancestor',ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION);
git('merge-base','--is-ancestor',packageBindingRevision,ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION);
git('merge-base','--is-ancestor',ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION,'HEAD');
const fixtureSuccessor=ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS[fixtureFile];
assert.deepEqual(Object.keys(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS),[fixtureFile]);
assert.equal(git('ls-tree',ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION,'--',fixtureFile).trim(),fixtureSuccessor.mode+' blob '+fixtureSuccessor.currentBlob+'\t'+fixtureFile);
assert.equal(git('ls-tree',ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,'--',fixtureFile).trim(),fixtureSuccessor.mode+' blob '+fixtureSuccessor.baselineBlob+'\t'+fixtureFile);
assert.equal(sha(git('show',ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION+':'+fixtureFile)),fixtureSuccessor.currentSha256);
assert.equal(sha(git('show',ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR+':'+fixtureFile)),fixtureSuccessor.baselineSha256);
let positives=0,refusals=0;
for(const row of pin.files){
 const current=git('show',pin.revision+':'+row.file),target=git('show',pin.targetRevision+':'+row.file);
 assert.equal(git('ls-tree',pin.revision,'--',row.file).trim(),row.mode+' blob '+row.currentBlob+'\t'+row.file);
 assert.equal(git('ls-tree',pin.targetRevision,'--',row.file).trim(),row.mode+' blob '+row.targetBlob+'\t'+row.file);
 const committedInput=actionReadinessHistoricalInput(row.file,
   economyReadinessMergeHistoricalInput(row.file,git('show','HEAD:'+row.file)));
 const physicalInput=actionReadinessHistoricalInput(row.file,
   economyReadinessMergeHistoricalInput(row.file,fs.readFileSync(row.file,'utf8')));
 assert.equal(economyHardeningSourceBaseline(row.file,committedInput),current,'Current committed source transfers exactly to the frozen rebuilt interface');
 assert.equal(economyHardeningSourceBaseline(row.file,physicalInput).replaceAll('\r\n','\n'),current,'Physical authored source transfers exactly to the frozen rebuilt interface');
 for(const input of [current,current.replaceAll('\n','\r\n')]){assert.equal(source.qualifyRebuildInterfaceSource(row.file,input).baselineText,target);assert.equal(source.classicInterfaceHistoricalInput(row.file,input),source.classicInterfaceHistoricalInput(row.file,target));positives++;}
 for(const input of [current+'\n',current.slice(1),'\ufeff'+current,current+'\0',current.replace('\n','\r\n'),current.replace('\n','\r'),Buffer.from(current),null]){assert.throws(()=>source.qualifyRebuildInterfaceSource(row.file,input));refusals++;}
 for(const input of [current+'\n// future arbitrary edit\n',current.slice(1)])assert.equal(source.classicInterfaceHistoricalInput(row.file,input),input,'Future arbitrary edits never receive a historical inverse');
 for(const inverse of row.inverses)for(const input of [current.replace(inverse.current,''),current.replace(inverse.current,()=>inverse.current+inverse.current),current.replace(inverse.current,()=>inverse.baseline)]){assert.throws(()=>source.qualifyRebuildInterfaceSource(row.file,input));refusals++;}
 assert.throws(()=>source.qualifyRebuildInterfaceSource(row.file,current,Object.freeze({...pin})));refusals++;
 assert.equal(sha(current),row.currentSha256);
}
assert.throws(()=>source.qualifyRebuildInterfaceSource('../package.json','x'));
console.log(JSON.stringify({phase:'EXACT_REBUILD_INTERFACE_SOURCE_ONLY',positives,refusals,native:false,runtime:false}));

// Separate successor proof. The classic/F92 bindings and their refusal cases above remain frozen.
const successor=ACTION_READINESS_SOURCE;
assert.equal(successor.targetRevision,'9f39df80598d38507c9f6b4ea2414312eb8e7700');
assert.deepEqual(successor.files.map(row=>row.file),['public/index.html','public/player-experience.js','test/player-experience-client.js','tools/mobile.js']);
for(const [revision,tree]of [[successor.revision,successor.tree],[successor.targetRevision,successor.targetTree]])
 assert.equal(git('rev-parse',revision+'^{tree}').trim(),tree);
git('merge-base','--is-ancestor',successor.targetRevision,successor.revision);
git('merge-base','--is-ancestor',successor.revision,'HEAD');
const inverseHunks=diff=>{
 const rows=[];let hunk=null;
 for(const line of diff.split('\n')){
  if(line.startsWith('@@')){hunk={current:'',baseline:''};rows.push(hunk);}
  else if(hunk&&/^[ +\-]/.test(line)){
   if(line[0]!=='-')hunk.current+=line.slice(1)+'\n';
   if(line[0]!=='+')hunk.baseline+=line.slice(1)+'\n';
  }
 }
 return rows;
};
let successorPositives=0,successorRefusals=0;
for(const row of successor.files){
 const current=git('show',successor.revision+':'+row.file),target=git('show',successor.targetRevision+':'+row.file);
 for(const [revision,expectedBlob]of [[successor.revision,row.currentBlob],[successor.targetRevision,row.targetBlob]])
  assert.equal(git('ls-tree',revision,'--',row.file).trim(),row.mode+' blob '+expectedBlob+'\t'+row.file);
 const committed=economyReadinessMergeHistoricalInput(row.file,git('show','HEAD:'+row.file));
 const physical=economyReadinessMergeHistoricalInput(row.file,fs.readFileSync(row.file,'utf8')),stat=fs.lstatSync(row.file);
 assert(stat.isFile()&&!stat.isSymbolicLink(),'Physical successor source is a regular file');
 assert.equal(committed,current,'Current committed successor source remains exact after the sealed merge bridge');
 assert(physical===current||physical===current.replaceAll('\n','\r\n'),'Physical successor source remains exact');
 assert.deepEqual(row.inverses,inverseHunks(git('diff','--no-ext-diff','--unified=3',successor.targetRevision,successor.revision,'--',row.file)));
 for(const input of [physical,current,current.replaceAll('\n','\r\n')]){
  const proof=qualifyActionReadinessSource(row.file,input);
  assert.equal(proof.baselineText,target);assert.equal(proof.sourceRevision,successor.revision);
  assert.equal(proof.sourceOnly,true);assert.equal(proof.native,false);assert.equal(proof.runtime,false);
  assert.equal(actionReadinessHistoricalInput(row.file,input),row.file==='public/index.html'?target:input);
  successorPositives++;
 }
 for(const input of [current+'\n',current.slice(1),'\ufeff'+current,current+'\0',current.replace('\n','\r\n'),current.replace('\n','\r'),Buffer.from(current),null]){
  assert.throws(()=>qualifyActionReadinessSource(row.file,input));successorRefusals++;
 }
 for(const input of [current+'\n// future arbitrary edit\n',current.slice(1),target])
  assert.equal(actionReadinessHistoricalInput(row.file,input),input,'Unknown and historical bytes never receive a successor inverse');
 for(const inverse of row.inverses)for(const input of [current.replace(inverse.current,''),current.replace(inverse.current,()=>inverse.current+inverse.current),current.replace(inverse.current,()=>inverse.baseline)]){
  assert.throws(()=>qualifyActionReadinessSource(row.file,input));successorRefusals++;
 }
 assert.throws(()=>qualifyActionReadinessSource(row.file,current,Object.freeze({...successor})));successorRefusals++;
 if(row.file==='public/index.html'){
  assert.deepEqual(actionReadinessHistoricalInput(row.file,Buffer.from(current)),Buffer.from(target));
  assert.throws(()=>actionReadinessHistoricalInput(row.file,Buffer.concat([Buffer.from(current),Buffer.from([0xff])])),/lossless UTF-8/);
  assert.equal(source.classicInterfaceHistoricalInput(row.file,current),source.classicInterfaceHistoricalInput(row.file,target));
 }
}
for(const file of ['../public/index.html','__proto__','constructor','unknown']){
 assert.throws(()=>qualifyActionReadinessSource(file,'x'));assert.equal(actionReadinessHistoricalInput(file,'x'),'x');successorRefusals++;
}
console.log(JSON.stringify({phase:'EXACT_ACTION_READINESS_SOURCE_ONLY',source:successor.revision,predecessor:successor.targetRevision,
 positives:successorPositives,refusals:successorRefusals,native:false,runtime:false}));

// The merge bridge is independently exact and applies only to the combined public index source.
const bridge=ECONOMY_READINESS_MERGE_SOURCE,bridgeRow=bridge.files[0];
for(const [revision,tree]of [[bridge.revision,bridge.tree],[bridge.targetRevision,bridge.targetTree]])
 assert.equal(git('rev-parse',revision+'^{tree}').trim(),tree);
git('merge-base','--is-ancestor',bridge.targetRevision,bridge.revision);
git('merge-base','--is-ancestor',bridge.revision,'HEAD');
const bridgeCurrent=git('show',bridge.revision+':'+bridgeRow.file),bridgeTarget=git('show',bridge.targetRevision+':'+bridgeRow.file);
const hardeningBridgeTarget=git('show',bridge.hardeningTargetRevision+':'+bridgeRow.file);
assert.deepEqual(bridgeRow.inverses,inverseHunks(git('diff','--no-ext-diff','--unified=3',bridge.targetRevision,bridge.revision,'--',bridgeRow.file)));
for(const input of [bridgeCurrent,bridgeCurrent.replaceAll('\n','\r\n')]){
 const proof=qualifyEconomyReadinessMergeSource(bridgeRow.file,input);
 assert.equal(proof.baselineText,bridgeTarget);assert.equal(proof.sourceRevision,bridge.revision);
}
for(const input of [bridgeCurrent+'\n',bridgeCurrent.slice(1),'\ufeff'+bridgeCurrent,bridgeCurrent+'\0',bridgeCurrent.replace('\n','\r'),Buffer.from(bridgeCurrent),null])
 assert.throws(()=>qualifyEconomyReadinessMergeSource(bridgeRow.file,input));
for(const inverse of bridgeRow.inverses)for(const input of [bridgeCurrent.replace(inverse.current,''),
 bridgeCurrent.replace(inverse.current,()=>inverse.current+inverse.current),bridgeCurrent.replace(inverse.current,()=>inverse.baseline)])
 assert.throws(()=>qualifyEconomyReadinessMergeSource(bridgeRow.file,input));
assert.equal(economyReadinessMergeHistoricalInput(bridgeRow.file,bridgeTarget),bridgeTarget);
assert.equal(git('rev-parse',bridge.hardeningTargetRevision+'^{tree}').trim(),bridge.hardeningTargetTree);
assert.deepEqual(bridgeRow.hardeningInverses,inverseHunks(git('diff','--no-ext-diff','--unified=3',
 bridge.hardeningTargetRevision,bridge.revision,'--',bridgeRow.file)));
for(const input of [bridgeCurrent,bridgeCurrent.replaceAll('\n','\r\n')]){
 const proof=qualifyEconomyHardeningMergeSource(bridgeRow.file,input);
 assert.equal(proof.baselineText,hardeningBridgeTarget);assert.equal(proof.targetRevision,bridge.hardeningTargetRevision);
 assert.equal(economyHardeningMergeHistoricalInput(bridgeRow.file,input),hardeningBridgeTarget);
}
for(const input of [bridgeCurrent+'\n',bridgeCurrent.slice(1),'\ufeff'+bridgeCurrent,bridgeCurrent+'\0',bridgeCurrent.replace('\n','\r'),Buffer.from(bridgeCurrent),null])
 assert.throws(()=>qualifyEconomyHardeningMergeSource(bridgeRow.file,input));
for(const inverse of bridgeRow.hardeningInverses)for(const input of [bridgeCurrent.replace(inverse.current,''),
 bridgeCurrent.replace(inverse.current,()=>inverse.current+inverse.current),bridgeCurrent.replace(inverse.current,()=>inverse.baseline)])
 assert.throws(()=>qualifyEconomyHardeningMergeSource(bridgeRow.file,input));
assert.equal(economyHardeningMergeHistoricalInput(bridgeRow.file,hardeningBridgeTarget),hardeningBridgeTarget);
assert.throws(()=>qualifyEconomyHardeningMergeSource(bridgeRow.file,bridgeCurrent,Object.freeze({...bridge})));
assert.throws(()=>qualifyEconomyReadinessMergeSource(bridgeRow.file,bridgeCurrent,Object.freeze({...bridge})));
console.log(JSON.stringify({phase:bridge.phase,source:bridge.revision,predecessor:bridge.targetRevision,
 inverses:bridgeRow.inverses.length,hardeningParent:bridge.hardeningTargetRevision,
 hardeningInverses:bridgeRow.hardeningInverses.length,native:false,runtime:false}));
