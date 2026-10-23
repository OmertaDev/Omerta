// Exact successor source proof only. Native capture always checks actual runtime bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {REBUILD_INTERFACE_SOURCE,REBUILD_INTERFACE_SOURCE_SHA256} from './classic-interface-source-data.js';
export {REBUILD_INTERFACE_SOURCE};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const blob=s=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
export function qualifyRebuildInterfaceSource(file,input,pin=REBUILD_INTERFACE_SOURCE){
 assert.equal(pin,REBUILD_INTERFACE_SOURCE,'Only exact frozen rebuilt-interface binding');
 assert.equal(sha(JSON.stringify(pin)),REBUILD_INTERFACE_SOURCE_SHA256);assert.equal(pin.status,'SEALED');
 const row=pin.files.find(r=>r.file===file);assert(row,'Unknown rebuilt-interface source');
 assert.equal(typeof input,'string');assert.equal(Buffer.from(input).toString('utf8'),input);assert(!input.includes('\ufeff')&&!input.includes('\0'));
 const current=input.replaceAll('\r\n','\n');assert(!current.includes('\r')&&(input===current||input===current.replaceAll('\n','\r\n')),'Uniform whole LF/CRLF only');
 assert.equal(sha(current),row.currentSha256,'Whole rebuilt-interface source changed');assert.equal(blob(current),row.currentBlob);assert.equal(Buffer.byteLength(current),row.currentBytes);
 let restored=current,end=-1;
 for(const inverse of row.inverses){assert(inverse.current.length);assert.equal(current.split(inverse.current).length,2);const at=current.indexOf(inverse.current);assert(at>=end);end=at+inverse.current.length;assert.equal(restored.split(inverse.current).length,2);restored=restored.replace(inverse.current,()=>inverse.baseline);}
 assert.equal(sha(restored),row.targetSha256);assert.equal(blob(restored),row.targetBlob);assert.equal(Buffer.byteLength(restored),row.targetBytes);
 return Object.freeze({baselineText:restored,sourceRevision:pin.revision,targetRevision:pin.targetRevision,sourceOnly:true,native:false,runtime:false});
}
export function rebuildInterfaceHistoricalInput(file,input){
 const row=REBUILD_INTERFACE_SOURCE.files.find(r=>r.file===file);if(!row)return input;
 const buffer=Buffer.isBuffer(input),text=buffer?input.toString('utf8'):input;
 if(buffer)assert(Buffer.from(text).equals(input),'lossless UTF-8 physical source only');
 if(typeof text!=='string'||sha(text.replaceAll('\r\n','\n'))!==row.currentSha256)return input;
 const restored=qualifyRebuildInterfaceSource(file,text).baselineText;return buffer?Buffer.from(restored):restored;
}
