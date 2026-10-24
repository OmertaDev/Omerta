import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const sourceRevision='cf726acb75d2bf416aeeeecdb7af284be095c392';
const targetRevision='3569313536dc5cc0bdb4beece6fd031abb2eb902';
const hardeningTargetRevision='14a75c7f7ae1988b5d35cc38bf02df6bc3294b92';
const file='public/index.html';
const hardeningSuccessorRevision='241ab9a100fdde6195e7c34197042751c46faa6d';
const hardeningSuccessorTargetRevision='f049821202a93b95bb1b92bc8e7e4ded0cafd1fd';
const hardeningSuccessorFile='test/continuous-city-source-compatibility.js';
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{encoding:'utf8',maxBuffer:32*1024*1024});
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const blob=text=>crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const tree=revision=>git('rev-parse',`${revision}^{tree}`).trim();
const content=revision=>git('show',`${revision}:${file}`);
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

git('merge-base','--is-ancestor',targetRevision,sourceRevision);
git('merge-base','--is-ancestor',hardeningTargetRevision,sourceRevision);
const current=content(sourceRevision),baseline=content(targetRevision);
const inverses=inverseHunks(git('diff','--no-ext-diff','--unified=3',targetRevision,sourceRevision,'--',file));
const hardeningBaseline=content(hardeningTargetRevision);
const hardeningInverses=inverseHunks(git('diff','--no-ext-diff','--unified=3',hardeningTargetRevision,sourceRevision,'--',file));
assert(inverses.length>0);
let restored=current;
for(const inverse of inverses){
  assert(inverse.current.length>0);
  assert.equal(restored.split(inverse.current).length,2,'Each merge inverse must occur exactly once');
  restored=restored.replace(inverse.current,()=>inverse.baseline);
}
assert.equal(restored,baseline);
let hardeningRestored=current;
for(const inverse of hardeningInverses){
  assert(inverse.current.length>0);
  assert.equal(hardeningRestored.split(inverse.current).length,2,'Each hardening-parent inverse must occur exactly once');
  hardeningRestored=hardeningRestored.replace(inverse.current,()=>inverse.baseline);
}
assert.equal(hardeningRestored,hardeningBaseline);
git('merge-base','--is-ancestor',hardeningSuccessorTargetRevision,hardeningSuccessorRevision);
const successorCurrent=git('show',`${hardeningSuccessorRevision}:${hardeningSuccessorFile}`);
const successorTarget=git('show',`${hardeningSuccessorTargetRevision}:${hardeningSuccessorFile}`);
const successorInverses=inverseHunks(git('diff','--no-ext-diff','--unified=3',hardeningSuccessorTargetRevision,
  hardeningSuccessorRevision,'--',hardeningSuccessorFile));
let successorRestored=successorCurrent;
for(const inverse of successorInverses){
  assert(inverse.current.length>0);
  assert.equal(successorRestored.split(inverse.current).length,2,'Each hardening-successor inverse must occur exactly once');
  successorRestored=successorRestored.replace(inverse.current,()=>inverse.baseline);
}
assert.equal(successorRestored,successorTarget);
const data={version:1,status:'SEALED',phase:'EXACT_ECONOMY_READINESS_MERGE_SOURCE_ONLY',
  revision:sourceRevision,tree:tree(sourceRevision),targetRevision,targetTree:tree(targetRevision),
  hardeningTargetRevision,hardeningTargetTree:tree(hardeningTargetRevision),contextLines:3,
  files:[{file,mode:'100644',currentBlob:blob(current),currentSha256:sha(current),currentBytes:Buffer.byteLength(current),
    targetBlob:blob(baseline),targetSha256:sha(baseline),targetBytes:Buffer.byteLength(baseline),inverses,
    hardeningTargetBlob:blob(hardeningBaseline),hardeningTargetSha256:sha(hardeningBaseline),
    hardeningTargetBytes:Buffer.byteLength(hardeningBaseline),hardeningInverses}],
  hardeningSuccessor:{revision:hardeningSuccessorRevision,tree:tree(hardeningSuccessorRevision),
    targetRevision:hardeningSuccessorTargetRevision,targetTree:tree(hardeningSuccessorTargetRevision),file:hardeningSuccessorFile,mode:'100644',
    currentBlob:blob(successorCurrent),currentSha256:sha(successorCurrent),currentBytes:Buffer.byteLength(successorCurrent),
    targetBlob:blob(successorTarget),targetSha256:sha(successorTarget),targetBytes:Buffer.byteLength(successorTarget),
    inverses:successorInverses}};
const digest=sha(JSON.stringify(data));
const output=`// Exact source-only bridge for the economy hardening + action readiness merge.\n`
  +`const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};\n`
  +`export const ECONOMY_READINESS_MERGE_SOURCE=freeze(${JSON.stringify(data,null,2)});\n`
  +`export const ECONOMY_READINESS_MERGE_SOURCE_SHA256=${JSON.stringify(digest)};\n`;
fs.writeFileSync(new URL('./economy-readiness-merge-source-data.js',import.meta.url),output);
console.log(JSON.stringify({sourceRevision,targetRevision,hardeningTargetRevision,file,inverses:inverses.length,
  hardeningInverses:hardeningInverses.length,hardeningSuccessorRevision,
  hardeningSuccessorInverses:successorInverses.length,digest}));
