// Exact successor source transfer only. Runtime and native qualification use actual current bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {uxHistoricalInput} from './ux-source-compatibility.js';
import {ACTION_READINESS_SOURCE,ACTION_READINESS_SOURCE_SHA256} from './action-readiness-source-data.js';
export {ACTION_READINESS_SOURCE};
const files=Object.freeze(['public/index.html','public/player-experience.js','test/player-experience-client.js','tools/mobile.js']);
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const blob=text=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
export function qualifyActionReadinessSource(file,input,pin=ACTION_READINESS_SOURCE){
 assert.equal(pin,ACTION_READINESS_SOURCE,'Only the exact frozen action-readiness source binding');
 assert.equal(sha(JSON.stringify(pin)),ACTION_READINESS_SOURCE_SHA256);
 assert.equal(pin.version,1);assert.equal(pin.status,'SEALED');assert.equal(pin.phase,'EXACT_ACTION_READINESS_SOURCE_ONLY');
 assert.equal(pin.contextLines,3);assert.deepEqual(pin.files.map(row=>row.file),files);
 assert(Object.isFrozen(pin)&&Object.isFrozen(pin.files));
 const row=pin.files.find(item=>item.file===file);assert(row,'Unknown action-readiness source');
 assert(Object.isFrozen(row)&&Object.isFrozen(row.inverses)&&row.inverses.every(Object.isFrozen));
 assert.equal(typeof input,'string','Complete source text required');
 assert.equal(Buffer.from(input).toString('utf8'),input);assert(!input.includes('\ufeff')&&!input.includes('\0'));
 const current=input.replaceAll('\r\n','\n');
 assert(!current.includes('\r')&&(input===current||input===current.replaceAll('\n','\r\n')),'Uniform whole LF/CRLF only');
 assert.equal(sha(current),row.currentSha256,'Whole action-readiness source changed');
 assert.equal(blob(current),row.currentBlob);assert.equal(Buffer.byteLength(current),row.currentBytes);
 assert(row.inverses.length>0,'Changed source requires exact inverses');
 let restored=current,end=-1;
 for(const inverse of row.inverses){
  assert(inverse.current.length);assert.equal(current.split(inverse.current).length,2);
  const at=current.indexOf(inverse.current);assert(at>=end);end=at+inverse.current.length;
  assert.equal(restored.split(inverse.current).length,2);restored=restored.replace(inverse.current,()=>inverse.baseline);
 }
 assert.equal(sha(restored),row.targetSha256);assert.equal(blob(restored),row.targetBlob);
 assert.equal(Buffer.byteLength(restored),row.targetBytes);
 return Object.freeze({baselineText:restored,sourceRevision:pin.revision,targetRevision:pin.targetRevision,
  sourceOnly:true,native:false,runtime:false});
}
export function actionReadinessHistoricalInput(file,input){
 input=uxHistoricalInput(file,input);
 // Only index.html crosses an existing historical reader; other successor files stay current.
 if(file!=='public/index.html')return input;
 const buffer=Buffer.isBuffer(input),text=buffer?input.toString('utf8'):input;
 if(buffer)assert(Buffer.from(text).equals(input),'lossless UTF-8 physical source only');
 const row=ACTION_READINESS_SOURCE.files.find(item=>item.file===file);
 if(typeof text!=='string'||sha(text.replaceAll('\r\n','\n'))!==row.currentSha256)return input;
 const restored=qualifyActionReadinessSource(file,text).baselineText;
 return buffer?Buffer.from(restored):restored;
}
