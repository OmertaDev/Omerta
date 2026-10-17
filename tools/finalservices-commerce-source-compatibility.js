// Pure closed S→C TEST source projection. No runtime/native admission, filesystem access or backend.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {FINAL_SERVICES_COMMERCE_SOURCE_BINDING} from './finalservices-commerce-source-data.js';
export {FINAL_SERVICES_COMMERCE_SOURCE_BINDING} from './finalservices-commerce-source-data.js';
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const blob=text=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
const phase='EXACT_FINAL_SERVICES_OVER_COMMERCE_SOURCE_ONLY';
const own=(object,key)=>Object.hasOwn(object,key);
function pathKey(file){return typeof file==='string'&&file.length>0&&file.length<256&&!file.includes('\\')&&!file.includes('\0')&&!file.startsWith('/')&&file.split('/').every(part=>part&&part!=='.'&&part!=='..')&&!['__proto__','constructor','toString'].includes(file);}
function keys(value,names){assert(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));assert.deepEqual(Object.keys(value).sort(),[...names].sort());assert(Object.isFrozen(value),'Static source data must be immutable');}
function binding(){
  const value=FINAL_SERVICES_COMMERCE_SOURCE_BINDING;
  assert(value,'UNBOUND final-services Commerce source data');
  keys(value,['version','phase','sourceRevision','predecessorRevision','records']);
  assert.equal(value.version,1);assert.equal(value.phase,phase);
  for(const revision of [value.sourceRevision,value.predecessorRevision])assert.match(revision,/^[a-f0-9]{40}$/);
  assert.notEqual(value.sourceRevision,value.predecessorRevision);
  assert(value.records&&typeof value.records==='object'&&!Array.isArray(value.records)&&[Object.prototype,null].includes(Object.getPrototypeOf(value.records))&&Object.isFrozen(value.records));
  assert(Object.keys(value.records).length>0&&Object.keys(value.records).length<=256);
  assert(Object.keys(value.records).every(pathKey),'Closed repository paths only');
  return value;
}
function canonical(input){
  assert.equal(typeof input,'string','String source only');
  assert(!input.includes('\ufeff')&&!input.includes('\0'),'BOM/NUL source refuses');
  const text=input.replaceAll('\r\n','\n');
  assert(!text.includes('\r')&&(input===text||input===text.replaceAll('\n','\r\n')),'Uniform LF or whole uniform CRLF source only');
  return text;
}
export function hasFinalServicesCommerceSource(file){const data=binding();return pathKey(file)&&own(data.records,file);}
export function assertFinalServicesCommerceSourceTransfer(file,input){
  const data=binding();assert(pathKey(file)&&own(data.records,file),'Unknown final-services Commerce source path');
  const record=data.records[file];
  keys(record,['kind','currentSha256','currentBlob','currentMode','baselineSha256','baselineBlob','baselineMode','baselineText','contextLines','inverses']);
  assert(['domain','identity'].includes(record.kind));assert.equal(record.contextLines,3);
  for(const mode of [record.currentMode,record.baselineMode])assert(['100644','100755'].includes(mode),'Pinned regular Git modes only');
  for(const name of ['currentSha256','baselineSha256'])assert.match(record[name],/^[a-f0-9]{64}$/);
  for(const name of ['currentBlob','baselineBlob'])assert.match(record[name],/^[a-f0-9]{40}$/);
  assert(Array.isArray(record.inverses)&&Object.isFrozen(record.inverses));
  let baselineText=canonical(input);
  assert.equal(hash(baselineText),record.currentSha256,'Whole actual S source changed');
  assert.equal(blob(baselineText),record.currentBlob,'Whole actual S Git blob changed');
  if(record.kind==='identity'){assert.equal(record.inverses.length,0);assert.equal(record.currentSha256,record.baselineSha256);assert.equal(record.currentBlob,record.baselineBlob);assert.equal(record.currentMode,record.baselineMode);}
  else assert(record.inverses.length>0,'A changed domain requires complete context3 inverses');
  for(const inverse of record.inverses){keys(inverse,['current','baseline']);assert.equal(typeof inverse.current,'string');assert(inverse.current.length>0);assert.equal(typeof inverse.baseline,'string');assert.equal(baselineText.split(inverse.current).length,2,'Complete unique S→C inverse context required');baselineText=baselineText.replace(inverse.current,()=>inverse.baseline);}
  assert.equal(canonical(record.baselineText),record.baselineText,'Canonical full C target bytes required');
  assert.equal(hash(baselineText),record.baselineSha256,'Whole actual C target changed');
  assert.equal(blob(baselineText),record.baselineBlob,'Whole actual C target Git blob changed');
  assert.equal(baselineText,record.baselineText,'Complete actual C bytes must reconstruct');
  return Object.freeze({baselineText,sourceRevision:data.sourceRevision,predecessorRevision:data.predecessorRevision,phase,sourceOnly:true,nativeAdmission:false});
}
export function finalServicesOverCommerceSourceBaseline(file,input){return assertFinalServicesCommerceSourceTransfer(file,input).baselineText;}
