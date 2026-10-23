// Current physical source transfer is separate from the immutable classic/F92 proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as source from '../tools/commerce-current-enterprise-source-compatibility.js';
import {ACTION_READINESS_SOURCE,qualifyActionReadinessSource,actionReadinessHistoricalInput} from '../tools/action-readiness-source-compatibility.js';
assert.equal(typeof source.qualifyRebuildInterfaceSource, 'function', 'Exact rebuilt-interface transfer must exist');
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8',maxBuffer:32*1024*1024});
const pin=source.REBUILD_INTERFACE_SOURCE,sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(pin.status,'SEALED');
for(const [revision,tree]of [[pin.revision,pin.tree],[pin.targetRevision,pin.targetTree]])assert.equal(git('rev-parse',revision+'^{tree}').trim(),tree);
git('merge-base','--is-ancestor',pin.targetRevision,pin.revision);
let positives=0,refusals=0;
for(const row of pin.files){
 const current=git('show',pin.revision+':'+row.file),target=git('show',pin.targetRevision+':'+row.file);
 assert.equal(git('ls-tree',pin.revision,'--',row.file).trim(),row.mode+' blob '+row.currentBlob+'\t'+row.file);
 assert.equal(git('ls-tree',pin.targetRevision,'--',row.file).trim(),row.mode+' blob '+row.targetBlob+'\t'+row.file);
 assert.equal(actionReadinessHistoricalInput(row.file,git('show','HEAD:'+row.file)),current,'Current committed source transfers exactly to the frozen rebuilt interface');
 assert.equal(actionReadinessHistoricalInput(row.file,fs.readFileSync(row.file,'utf8')).replaceAll('\r\n','\n'),current,'Physical authored source transfers exactly to the frozen rebuilt interface');
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
 const physical=fs.readFileSync(row.file,'utf8'),stat=fs.lstatSync(row.file);
 assert(stat.isFile()&&!stat.isSymbolicLink(),'Physical successor source is a regular file');
 assert.equal(git('show','HEAD:'+row.file),current,'Current committed successor source remains exact');
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
