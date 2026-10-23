import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const sourceRevision='cf726acb75d2bf416aeeeecdb7af284be095c392';
const targetRevision='3569313536dc5cc0bdb4beece6fd031abb2eb902';
const file='public/index.html';
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
const current=content(sourceRevision),baseline=content(targetRevision);
const inverses=inverseHunks(git('diff','--no-ext-diff','--unified=3',targetRevision,sourceRevision,'--',file));
assert(inverses.length>0);
let restored=current;
for(const inverse of inverses){
  assert(inverse.current.length>0);
  assert.equal(restored.split(inverse.current).length,2,'Each merge inverse must occur exactly once');
  restored=restored.replace(inverse.current,()=>inverse.baseline);
}
assert.equal(restored,baseline);
const data={version:1,status:'SEALED',phase:'EXACT_ECONOMY_READINESS_MERGE_SOURCE_ONLY',
  revision:sourceRevision,tree:tree(sourceRevision),targetRevision,targetTree:tree(targetRevision),contextLines:3,
  files:[{file,mode:'100644',currentBlob:blob(current),currentSha256:sha(current),currentBytes:Buffer.byteLength(current),
    targetBlob:blob(baseline),targetSha256:sha(baseline),targetBytes:Buffer.byteLength(baseline),inverses}]};
const digest=sha(JSON.stringify(data));
const output=`// Exact source-only bridge for the economy hardening + action readiness merge.\n`
  +`const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};\n`
  +`export const ECONOMY_READINESS_MERGE_SOURCE=freeze(${JSON.stringify(data,null,2)});\n`
  +`export const ECONOMY_READINESS_MERGE_SOURCE_SHA256=${JSON.stringify(digest)};\n`;
fs.writeFileSync(new URL('./economy-readiness-merge-source-data.js',import.meta.url),output);
console.log(JSON.stringify({sourceRevision,targetRevision,file,inverses:inverses.length,digest}));
