// Current physical source transfer is separate from the immutable classic/F92 proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as source from '../tools/commerce-current-enterprise-source-compatibility.js';
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
 assert.equal(git('show','HEAD:'+row.file),current,'Current committed source remains exact');
 assert.equal(fs.readFileSync(row.file,'utf8').replaceAll('\r\n','\n'),current,'Physical authored source remains exact');
 for(const input of [current,current.replaceAll('\n','\r\n')]){assert.equal(source.qualifyRebuildInterfaceSource(row.file,input).baselineText,target);assert.equal(source.classicInterfaceHistoricalInput(row.file,input),source.classicInterfaceHistoricalInput(row.file,target));positives++;}
 for(const input of [current+'\n',current.slice(1),'\ufeff'+current,current+'\0',current.replace('\n','\r\n'),current.replace('\n','\r'),Buffer.from(current),null]){assert.throws(()=>source.qualifyRebuildInterfaceSource(row.file,input));refusals++;}
 for(const input of [current+'\n// future arbitrary edit\n',current.slice(1)])assert.equal(source.classicInterfaceHistoricalInput(row.file,input),input,'Future arbitrary edits never receive a historical inverse');
 for(const inverse of row.inverses)for(const input of [current.replace(inverse.current,''),current.replace(inverse.current,()=>inverse.current+inverse.current),current.replace(inverse.current,()=>inverse.baseline)]){assert.throws(()=>source.qualifyRebuildInterfaceSource(row.file,input));refusals++;}
 assert.throws(()=>source.qualifyRebuildInterfaceSource(row.file,current,Object.freeze({...pin})));refusals++;
 assert.equal(sha(current),row.currentSha256);
}
assert.throws(()=>source.qualifyRebuildInterfaceSource('../package.json','x'));
console.log(JSON.stringify({phase:'EXACT_REBUILD_INTERFACE_SOURCE_ONLY',positives,refusals,native:false,runtime:false}));
