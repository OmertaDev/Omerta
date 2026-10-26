import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {ECONOMY_READINESS_MERGE_SOURCE,ECONOMY_READINESS_MERGE_SOURCE_SHA256} from './economy-readiness-merge-source-data.js';
import {economyUxMergeCandidateHistoricalInput} from './economy-ux-merge-source-compatibility.js';

export {ECONOMY_READINESS_MERGE_SOURCE};
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const blob=text=>crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const normalize=input=>{
  assert.equal(typeof input,'string');
  const text=input.replaceAll('\r\n','\n');
  assert(!text.includes('\r')&&(input===text||input===text.replaceAll('\n','\r\n')),'Only whole LF or uniform CRLF source');
  return text;
};

export function qualifyEconomyReadinessMergeSource(file,input,pin=ECONOMY_READINESS_MERGE_SOURCE){
  assert.equal(pin,ECONOMY_READINESS_MERGE_SOURCE,'Only the exact frozen merge source binding');
  assert.equal(sha(JSON.stringify(pin)),ECONOMY_READINESS_MERGE_SOURCE_SHA256);
  assert.equal(pin.version,1);assert.equal(pin.status,'SEALED');
  assert.equal(pin.phase,'EXACT_ECONOMY_READINESS_MERGE_SOURCE_ONLY');
  assert.equal(file,'public/index.html','Closed merge source domain');
  const row=pin.files[0],current=normalize(input);
  assert.equal(sha(current),row.currentSha256);assert.equal(blob(current),row.currentBlob);
  assert.equal(Buffer.byteLength(current),row.currentBytes);
  let restored=current,end=-1;
  for(const inverse of row.inverses){
    assert(inverse.current.length>0);assert.equal(current.split(inverse.current).length,2);
    const at=current.indexOf(inverse.current);assert(at>=end);end=at+inverse.current.length;
    assert.equal(restored.split(inverse.current).length,2);restored=restored.replace(inverse.current,()=>inverse.baseline);
  }
  assert.equal(sha(restored),row.targetSha256);assert.equal(blob(restored),row.targetBlob);
  assert.equal(Buffer.byteLength(restored),row.targetBytes);
  return Object.freeze({baselineText:restored,sourceRevision:pin.revision,targetRevision:pin.targetRevision,
    sourceOnly:true,native:false,runtime:false});
}

export function economyReadinessMergeHistoricalInput(file,input){
  input=economyUxMergeCandidateHistoricalInput(file,input);
  if(file!=='public/index.html')return input;
  const buffer=Buffer.isBuffer(input),text=buffer?input.toString('utf8'):input;
  if(buffer)assert(Buffer.from(text).equals(input),'lossless UTF-8 physical source only');
  if(typeof text!=='string'||sha(text.replaceAll('\r\n','\n'))!==ECONOMY_READINESS_MERGE_SOURCE.files[0].currentSha256)return input;
  const restored=qualifyEconomyReadinessMergeSource(file,text).baselineText;
  return buffer?Buffer.from(restored):restored;
}

export function qualifyEconomyHardeningMergeSource(file,input,pin=ECONOMY_READINESS_MERGE_SOURCE){
  assert.equal(pin,ECONOMY_READINESS_MERGE_SOURCE,'Only the exact frozen merge source binding');
  assert.equal(sha(JSON.stringify(pin)),ECONOMY_READINESS_MERGE_SOURCE_SHA256);
  assert.equal(pin.version,1);assert.equal(pin.status,'SEALED');
  assert.equal(pin.phase,'EXACT_ECONOMY_READINESS_MERGE_SOURCE_ONLY');
  assert.equal(file,'public/index.html','Closed merge source domain');
  const row=pin.files[0],current=normalize(input);
  assert.equal(sha(current),row.currentSha256);assert.equal(blob(current),row.currentBlob);
  assert.equal(Buffer.byteLength(current),row.currentBytes);
  let restored=current,end=-1;
  for(const inverse of row.hardeningInverses){
    assert(inverse.current.length>0);assert.equal(current.split(inverse.current).length,2);
    const at=current.indexOf(inverse.current);assert(at>=end);end=at+inverse.current.length;
    assert.equal(restored.split(inverse.current).length,2);restored=restored.replace(inverse.current,()=>inverse.baseline);
  }
  assert.equal(sha(restored),row.hardeningTargetSha256);assert.equal(blob(restored),row.hardeningTargetBlob);
  assert.equal(Buffer.byteLength(restored),row.hardeningTargetBytes);
  return Object.freeze({baselineText:restored,sourceRevision:pin.revision,
    targetRevision:pin.hardeningTargetRevision,sourceOnly:true,native:false,runtime:false});
}

export function economyHardeningMergeHistoricalInput(file,input){
  input=economyUxMergeCandidateHistoricalInput(file,input);
  const buffer=Buffer.isBuffer(input),text=buffer?input.toString('utf8'):input;
  if(buffer)assert(Buffer.from(text).equals(input),'lossless UTF-8 physical source only');
  if(typeof text!=='string')return input;
  const normalized=text.replaceAll('\r\n','\n');
  let restored;
  if(file==='public/index.html'&&sha(normalized)===ECONOMY_READINESS_MERGE_SOURCE.files[0].currentSha256)
    restored=qualifyEconomyHardeningMergeSource(file,text).baselineText;
  else if(file===ECONOMY_READINESS_MERGE_SOURCE.hardeningSuccessor.file
    &&sha(normalized)===ECONOMY_READINESS_MERGE_SOURCE.hardeningSuccessor.currentSha256)
    restored=qualifyEconomyHardeningSuccessorSource(file,text).baselineText;
  else return input;
  return buffer?Buffer.from(restored):restored;
}

export function qualifyEconomyHardeningSuccessorSource(file,input,pin=ECONOMY_READINESS_MERGE_SOURCE){
  assert.equal(pin,ECONOMY_READINESS_MERGE_SOURCE,'Only the exact frozen merge source binding');
  assert.equal(sha(JSON.stringify(pin)),ECONOMY_READINESS_MERGE_SOURCE_SHA256);
  assert.equal(pin.version,1);assert.equal(pin.status,'SEALED');
  const row=pin.hardeningSuccessor,current=normalize(input);
  assert.equal(file,row.file,'Closed hardening-successor source domain');
  assert.equal(sha(current),row.currentSha256);assert.equal(blob(current),row.currentBlob);
  assert.equal(Buffer.byteLength(current),row.currentBytes);
  let restored=current,end=-1;
  for(const inverse of row.inverses){
    assert(inverse.current.length>0);assert.equal(current.split(inverse.current).length,2);
    const at=current.indexOf(inverse.current);assert(at>=end);end=at+inverse.current.length;
    assert.equal(restored.split(inverse.current).length,2);restored=restored.replace(inverse.current,()=>inverse.baseline);
  }
  assert.equal(sha(restored),row.targetSha256);assert.equal(blob(restored),row.targetBlob);
  assert.equal(Buffer.byteLength(restored),row.targetBytes);
  return Object.freeze({baselineText:restored,sourceRevision:row.revision,targetRevision:row.targetRevision,
    sourceOnly:true,native:false,runtime:false});
}
