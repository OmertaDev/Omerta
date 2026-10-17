'use strict';
// Static, one-shot author recipe. Only this separate copied packet is written.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=__dirname,PARENT='C:/Users/Jorge/AppData/Local/Temp/omerta-dashboard-strict-gui-reference-permissions-successor-f4d397e8-f582-45b2-a2d3-a02c85ee26b2';
const OLD_S='19f174540b0b65870800317ed98085ef36696976',OLD_T='c04003a12493eea9b725daa016a32159ec5e64b4';
const S='2b10efe7c087e5d048719cd35c1ad0c626760631',T='b027f5f075a59e1d844dfdf503a8431cbebcf35f',PRED='d8e9f2e1feaf1df1f64584268069ba9917e30849';
const PARENT_SHA='0bc6a13a86ee7f3c48517657cd29f680f24fc65ab5c8431f464be06fce7e4fee';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(path.join(ROOT,f)),json=f=>JSON.parse(read(f));
const desc=b=>({bytes:b.length,sha256:sha(b)}),serial=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const manifestBytes=read('manifest.json');assert.equal(sha(manifestBytes),PARENT_SHA);assert.equal(sha(fs.readFileSync(path.join(PARENT,'manifest.json'))),PARENT_SHA);
const parent=JSON.parse(manifestBytes),pins=json('inputs/source-pins.json'),source=json('source-rebind-source-verification.json');
assert.equal(source.candidate,S);assert.equal(source.tree,T);assert.equal(source.expectedPredecessor,PRED);assert.equal(source.allFourPinnedFilesUnchanged,true);assert.equal(source.ancestry.mergeBase,PRED);assert.equal(source.ancestry.isAncestorExitCode,0);
for(const row of parent.files){for(const root of[ROOT,PARENT]){const file=path.join(root,row.file),st=fs.lstatSync(file),b=fs.readFileSync(file);assert(st.isFile()&&!st.isSymbolicLink());assert.deepEqual(desc(b),{bytes:row.bytes,sha256:row.sha256});}}
const history='provenance/prior-source';fs.mkdirSync(path.join(ROOT,history),{recursive:true});
function preserve(file){const out=path.join(ROOT,history,file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(ROOT,file),out,fs.constants.COPYFILE_EXCL);}
for(const file of['manifest.json','HANDOFF.md','preparation-review.json','validation-receipt.json','syntax-check.json'])preserve(file);
const edits=[],patches=[];
function change(file,substitutions){
  const before=read(file);let text=before.toString('utf8');assert(Buffer.from(text).equals(before));
  for(const [from,to,count]of substitutions){assert.notEqual(from,to);assert.equal(text.split(from).length-1,count,file+' substitution count');text=text.split(from).join(to);}
  const after=Buffer.from(text);let inverse=text;for(const[from,to,count]of substitutions.slice().reverse()){assert.equal(inverse.split(to).length-1,count,file+' inverse count');inverse=inverse.split(to).join(from);}assert(Buffer.from(inverse).equals(before));
  preserve(file);fs.writeFileSync(path.join(ROOT,file),after);
  edits.push({file,before:desc(before),after:desc(after),substitutions:substitutions.map(([from,to,count])=>({from,to,count})),wholeByteInverse:true});
  const a=before.toString('utf8').split('\n'),b=text.split('\n');assert.equal(a.length,b.length);const hunks=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])hunks.push('@@ -'+(i+1)+',1 +'+(i+1)+',1 @@\n-'+a[i]+'\n+'+b[i]+'\n');patches.push('--- a/'+file+'\n+++ b/'+file+'\n'+hunks.join(''));
}
change('inputs/source-pins.json',[[OLD_S,S,2],[OLD_T,T,1],[pins.createdAt,source.verifiedAt,1]]);
change('source-binding.template.json',[[OLD_S,S,2],[OLD_T,T,1]]);
change('inputs/proof-contract.json',[[OLD_S,S,1]]);
const contract=desc(read('inputs/proof-contract.json')),oldContract=parent.proofContract.sha256;
assert.equal(contract.bytes,1670);
const oldModules=json('module-barrier-inverses.json').modules;
change('inputs/hosted-observer-PREPARATION.cjs',[[OLD_S,S,2],[OLD_T,T,2]]);
change('postimages/hosted-observer.EXECUTABLE.cjs',[[OLD_S,S,2],[OLD_T,T,2]]);
const observerBefore=desc(read(oldModules.observer.preparation)),observerAfter=desc(read(oldModules.observer.postimage));
assert.equal(observerBefore.bytes,27019);assert.equal(observerAfter.bytes,26901);
change('module-barrier-inverses.json',[[oldModules.observer.before.sha256,observerBefore.sha256,1],[oldModules.observer.after.sha256,observerAfter.sha256,1]]);
change('materialize-hosted.cjs',[[OLD_S,S,2],[OLD_T,T,1],[oldContract,contract.sha256,1],[oldModules.observer.before.sha256,observerBefore.sha256,1],[oldModules.observer.after.sha256,observerAfter.sha256,1]]);
assert.equal(read('materialize-hosted.cjs').length,19004);
assert.equal(read('materialize-hosted.cjs').toString('utf8').split("['--extract','--same-permissions','--gzip','--file',job.nodeArchive,'--directory'").length,2);
change('root-approval.UNBOUND.json',[[OLD_S,S,1],[oldModules.observer.before.sha256,observerBefore.sha256,1],[oldModules.observer.after.sha256,observerAfter.sha256,2],[oldContract,contract.sha256,1]]);
change('hosted-binding.UNBOUND.json',[[OLD_S,S,1]]);
change('workflow-refs.UNBOUND.json',[[OLD_S,S,1]]);
change('workflow.yml.template',[[OLD_S,S,3]]);
const modules=json('module-barrier-inverses.json').modules,barriers=[];
for(const[name,m]of Object.entries(modules)){
  const before=read(m.preparation),after=read(m.postimage),barrier=Buffer.from(m.barrierLiteral);
  assert.deepEqual(desc(before),m.before);assert.deepEqual(desc(after),m.after);assert(before.subarray(m.barrierOffset,m.barrierOffset+barrier.length).equals(barrier));
  assert(Buffer.concat([before.subarray(0,m.barrierOffset),before.subarray(m.barrierOffset+barrier.length)]).equals(after));
  assert(Buffer.concat([after.subarray(0,m.barrierOffset),barrier,after.subarray(m.barrierOffset)]).equals(before));
  if(name!=='observer'){assert.deepEqual(m,oldModules[name]);assert(read(m.preparation).equals(fs.readFileSync(path.join(PARENT,m.preparation))));assert(read(m.postimage).equals(fs.readFileSync(path.join(PARENT,m.postimage))));}
  barriers.push({name,before:m.before,after:m.after,barrierBytes:barrier.length,barrierOffset:m.barrierOffset,forwardAndWholeInverse:true});
}
const peer='C:/Users/Jorge/AppData/Local/Temp/omerta-gui-reference-permissions-independent-review-fdd13eed-28b1-4b84-a08e-ab105b9046e8';
const peerManifest=fs.readFileSync(path.join(peer,'manifest.json'));assert.equal(sha(peerManifest),'d9ff02cf4ae8014483b1e0f0a246c887fa95304b282fef679e142f754f9b2083');
const peerIndex=JSON.parse(peerManifest);const peerFile=peerIndex.files.find(r=>r.sha256==='a0a9680163717fcb0b7639da07c1cfb8982542d4b02260da53ea3192025db5a7');assert(peerFile);
const peerReceipt=fs.readFileSync(path.join(peer,peerFile.file));assert.equal(sha(peerReceipt),peerFile.sha256);assert.equal(peerReceipt.length,peerFile.bytes);
fs.writeFileSync(path.join(ROOT,history,'independent-manifest.json'),peerManifest,{flag:'wx'});fs.writeFileSync(path.join(ROOT,history,'independent-review-receipt.json'),peerReceipt,{flag:'wx'});
const edited=new Set(edits.map(r=>r.file));const unchanged=parent.files.filter(r=>!edited.has(r.file)&&!['HANDOFF.md','preparation-review.json','validation-receipt.json','syntax-check.json'].includes(r.file));
for(const row of unchanged)assert.deepEqual(desc(read(row.file)),{bytes:row.bytes,sha256:row.sha256});
const receipt={phase:'PASS_EXACT_DISABLED_SOURCE_REBIND_AUTHOR_RECIPE',createdAt:new Date().toISOString(),parentManifestSHA256:PARENT_SHA,parentPeerManifestSHA256:sha(peerManifest),retiredCandidate:OLD_S,retiredTree:OLD_T,candidate:S,tree:T,expectedPredecessor:PRED,sourceVerification:desc(read('source-rebind-source-verification.json')),sourceEdits:edits,sourceEditFiles:edits.length,barriers,unchangedParentFilesOutsideDeclaredCurrentMetadata:unchanged,unchangedParentFileCount:unchanged.length,historicalBuilderAndMocksUnchanged:true,referencePermissionArgumentPreserved:true,allOperationalApprovalTemplatesDisabled:true,operationalApproval:null,actualRuntime:null,actualExecution:null,actualResult:null};
assert.equal(edits.length,11);assert.equal(unchanged.length,103);for(const f of['root-approval.UNBOUND.json','hosted-binding.UNBOUND.json','workflow-refs.UNBOUND.json'])assert.equal(json(f).enabled,false);
fs.writeFileSync(path.join(ROOT,'source-rebind-inverse.json'),serial(receipt),{flag:'wx'});fs.writeFileSync(path.join(ROOT,'source-rebind.patch'),patches.join('\n'),{flag:'wx'});
process.stdout.write(JSON.stringify({phase:receipt.phase,candidate:S,tree:T,edits:edits.length,unchangedParentFiles:unchanged.length,controller:desc(read('materialize-hosted.cjs')),observerBefore,observerAfter,contract,allFourBarrierInverses:true})+'\n');
