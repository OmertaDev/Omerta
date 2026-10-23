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
 assert.equal(economyHardeningSourceBaseline(row.file,git('show','HEAD:'+row.file)),current,'Current committed source transfers exactly to the frozen rebuilt interface');
 assert.equal(economyHardeningSourceBaseline(row.file,fs.readFileSync(row.file,'utf8')).replaceAll('\r\n','\n'),current,'Physical authored source transfers exactly to the frozen rebuilt interface');
 for(const input of [current,current.replaceAll('\n','\r\n')]){assert.equal(source.qualifyRebuildInterfaceSource(row.file,input).baselineText,target);assert.equal(source.classicInterfaceHistoricalInput(row.file,input),source.classicInterfaceHistoricalInput(row.file,target));positives++;}
 for(const input of [current+'\n',current.slice(1),'\ufeff'+current,current+'\0',current.replace('\n','\r\n'),current.replace('\n','\r'),Buffer.from(current),null]){assert.throws(()=>source.qualifyRebuildInterfaceSource(row.file,input));refusals++;}
 for(const input of [current+'\n// future arbitrary edit\n',current.slice(1)])assert.equal(source.classicInterfaceHistoricalInput(row.file,input),input,'Future arbitrary edits never receive a historical inverse');
 for(const inverse of row.inverses)for(const input of [current.replace(inverse.current,''),current.replace(inverse.current,()=>inverse.current+inverse.current),current.replace(inverse.current,()=>inverse.baseline)]){assert.throws(()=>source.qualifyRebuildInterfaceSource(row.file,input));refusals++;}
 assert.throws(()=>source.qualifyRebuildInterfaceSource(row.file,current,Object.freeze({...pin})));refusals++;
 assert.equal(sha(current),row.currentSha256);
}
assert.throws(()=>source.qualifyRebuildInterfaceSource('../package.json','x'));
console.log(JSON.stringify({phase:'EXACT_REBUILD_INTERFACE_SOURCE_ONLY',positives,refusals,native:false,runtime:false}));
