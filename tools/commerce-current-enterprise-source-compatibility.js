// Separate current-E text namespace. Historical C-to-E helpers and maps stay independent.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {COMMERCE_CURRENT_ENTERPRISE_SOURCE_REVISION,COMMERCE_CURRENT_ENTERPRISE_SOURCE_PREDECESSOR,COMMERCE_CURRENT_ENTERPRISE_SOURCE_PHASE,COMMERCE_CURRENT_ENTERPRISE_SOURCE_DOMAINS,COMMERCE_CURRENT_ENTERPRISE_IDENTITY_SOURCES} from './commerce-current-enterprise-source-data.js';
export {COMMERCE_CURRENT_ENTERPRISE_SOURCE_REVISION,COMMERCE_CURRENT_ENTERPRISE_SOURCE_PREDECESSOR,COMMERCE_CURRENT_ENTERPRISE_SOURCE_PHASE,COMMERCE_CURRENT_ENTERPRISE_SOURCE_DOMAINS,COMMERCE_CURRENT_ENTERPRISE_IDENTITY_SOURCES};
const hash=text=>crypto.createHash('sha256').update(text).digest('hex'),blob=text=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
function bound(){
 assert.match(COMMERCE_CURRENT_ENTERPRISE_SOURCE_REVISION,/^[a-f0-9]{40}$/,'Current Commerce source is unbound');assert.match(COMMERCE_CURRENT_ENTERPRISE_SOURCE_PREDECESSOR,/^[a-f0-9]{40}$/,'Active Enterprise source is unbound');
 const domains=Object.keys(COMMERCE_CURRENT_ENTERPRISE_SOURCE_DOMAINS),identities=Object.keys(COMMERCE_CURRENT_ENTERPRISE_IDENTITY_SOURCES);assert.equal(domains.length+identities.length,62,'Exactly62 active Enterprise inputs');assert(domains.every(file=>!Object.hasOwn(COMMERCE_CURRENT_ENTERPRISE_IDENTITY_SOURCES,file)),'Current namespace membership cannot overlap');assert(Object.isFrozen(COMMERCE_CURRENT_ENTERPRISE_SOURCE_DOMAINS)&&Object.isFrozen(COMMERCE_CURRENT_ENTERPRISE_IDENTITY_SOURCES));
}
function uniform(input){assert.equal(typeof input,'string','Current projection accepts source text only');assert(!input.includes('\0')&&!input.startsWith('\ufeff'),'Current source refuses NUL/BOM');const text=input.replaceAll('\r\n','\n');assert(!text.includes('\r')&&(input===text||input===text.replaceAll('\n','\r\n')),'Uniform whole LF/CRLF only');return text;}
export function hasCommerceCurrentEnterpriseSource(file){return typeof file==='string'&&(Object.hasOwn(COMMERCE_CURRENT_ENTERPRISE_SOURCE_DOMAINS,file)||Object.hasOwn(COMMERCE_CURRENT_ENTERPRISE_IDENTITY_SOURCES,file));}
export function assertCommerceCurrentEnterpriseSourceTransfer(file,input){
 bound();assert(hasCommerceCurrentEnterpriseSource(file),'Unknown current C-to-active-E input');const domain=Object.hasOwn(COMMERCE_CURRENT_ENTERPRISE_SOURCE_DOMAINS,file),p=domain?COMMERCE_CURRENT_ENTERPRISE_SOURCE_DOMAINS[file]:COMMERCE_CURRENT_ENTERPRISE_IDENTITY_SOURCES[file];
 assert.deepEqual(Object.keys(p).sort(),['currentSha256','currentBlob','currentMode','baselineSha256','baselineBlob','baselineMode','context','inverses'].sort());assert(Object.isFrozen(p)&&Object.isFrozen(p.inverses)&&p.inverses.every(Object.isFrozen));assert.equal(p.context,3);for(const key of['currentSha256','baselineSha256'])assert.match(p[key],/^[a-f0-9]{64}$/);for(const key of['currentBlob','baselineBlob'])assert.match(p[key],/^[a-f0-9]{40}$/);assert(['100644','100755'].includes(p.currentMode)&&['100644','100755'].includes(p.baselineMode),'Modes are recorded metadata; actual Git proof is separate');
 let baselineText=uniform(input);assert.equal(hash(baselineText),p.currentSha256,'Whole actual current Commerce source drift');assert.equal(blob(baselineText),p.currentBlob,'Whole actual current Commerce blob drift');
 if(domain)assert(p.inverses.length>0,'Changed current domain requires exact inverse');else{assert.equal(p.inverses.length,0);assert.equal(p.currentSha256,p.baselineSha256);assert.equal(p.currentBlob,p.baselineBlob);}
 for(const h of p.inverses){assert.deepEqual(Object.keys(h).sort(),['current','baseline'].sort());assert.equal(typeof h.current,'string');assert(h.current);assert.equal(typeof h.baseline,'string');assert.equal(baselineText.split(h.current).length,2,'Unique whole current inverse required');baselineText=baselineText.replace(h.current,()=>h.baseline);}
 assert.equal(hash(baselineText),p.baselineSha256,'Whole genuine active Enterprise source drift');assert.equal(blob(baselineText),p.baselineBlob,'Whole genuine active Enterprise blob drift');return{baselineText,sourceRevision:COMMERCE_CURRENT_ENTERPRISE_SOURCE_REVISION,predecessorRevision:COMMERCE_CURRENT_ENTERPRISE_SOURCE_PREDECESSOR,phase:COMMERCE_CURRENT_ENTERPRISE_SOURCE_PHASE,modeVerified:false};
}
export function commerceOverCurrentEnterpriseSourceBaseline(file,input){return assertCommerceCurrentEnterpriseSourceTransfer(file,classicInterfaceHistoricalInput(file,input)).baselineText;}

// A finite physical-reader adapter for the classic interface restoration. Historical C/E and GUI maps above remain strict and unchanged.
const CLASSIC_INTERFACE_FILES = Object.freeze(['package.json', 'public/index.html', 'test/commerce-source-compatibility.js', 'test/enterprise-current-source-compatibility.js']);
const classicSourceFreeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(classicSourceFreeze); Object.freeze(value); }
  return value;
};
// BEGIN CURRENT CLASSIC INTERFACE BINDING
export const CLASSIC_INTERFACE_OVER_F92 = classicSourceFreeze({
  version: 1, status: 'UNSEALED', phase: 'EXACT_CLASSIC_INTERFACE_OVER_F92_TEST_SOURCE_ONLY',
  revision: null, tree: null, targetRevision: '92e9e3428721c89a878041a57b75448d5f492dc6', targetTree: null,
  contextLines: 3, files: [],
});
export const CLASSIC_INTERFACE_OVER_F92_SHA256 = null;
// END CURRENT CLASSIC INTERFACE BINDING
function classicSourceKeys(value, names) {
  assert(value && typeof value === 'object' && !Array.isArray(value) && Object.isFrozen(value), 'Frozen finite source binding required');
  assert([Object.prototype, null].includes(Object.getPrototypeOf(value)));
  assert.deepEqual(Reflect.ownKeys(value).sort(), names.slice().sort());
  for (const property of Object.values(Object.getOwnPropertyDescriptors(value))) assert(Object.hasOwn(property, 'value'), 'Source binding accessors refuse');
}
function classicSourceBinding(pin) {
  classicSourceKeys(pin, ['version', 'status', 'phase', 'revision', 'tree', 'targetRevision', 'targetTree', 'contextLines', 'files']);
  assert.equal(pin.status, 'SEALED', 'Classic interface physical sources remain UNSEALED until their actual authored commit is bound');
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_CLASSIC_INTERFACE_OVER_F92_TEST_SOURCE_ONLY');
  assert.equal(pin.targetRevision, '92e9e3428721c89a878041a57b75448d5f492dc6');
  for (const key of ['revision', 'tree', 'targetRevision', 'targetTree']) assert.match(pin[key], /^[a-f0-9]{40}$/);
  assert.equal(pin.contextLines, 3);
  assert.match(CLASSIC_INTERFACE_OVER_F92_SHA256 || '', /^[a-f0-9]{64}$/, 'Classic interface binding remains unbound');
  assert.equal(hash(JSON.stringify(pin)), CLASSIC_INTERFACE_OVER_F92_SHA256, 'Only the exact reviewed classic-interface binding is admitted');
  assert(Array.isArray(pin.files) && Object.isFrozen(pin.files));
  assert.deepEqual(Reflect.ownKeys(pin.files), CLASSIC_INTERFACE_FILES.map((_, index) => String(index)).concat('length'));
  assert.deepEqual(pin.files.map(row => row.file), CLASSIC_INTERFACE_FILES);
  for (const row of pin.files) {
    classicSourceKeys(row, ['file', 'mode', 'currentBlob', 'currentSha256', 'currentRawSha256', 'currentBytes', 'targetBlob', 'targetSha256', 'targetBytes', 'inverses']);
    assert.equal(row.mode, '100644'); classicSourceKeys(row.currentRawSha256, ['lf', 'crlf']);
    for (const key of ['currentBlob', 'targetBlob']) assert.match(row[key], /^[a-f0-9]{40}$/);
    for (const key of ['currentSha256', 'targetSha256']) assert.match(row[key], /^[a-f0-9]{64}$/);
    assert.equal(row.currentRawSha256.lf, row.currentSha256); assert.match(row.currentRawSha256.crlf, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(row.currentBytes) && row.currentBytes > 0 && Number.isSafeInteger(row.targetBytes) && row.targetBytes > 0);
    assert(Array.isArray(row.inverses) && Object.isFrozen(row.inverses) && row.inverses.length > 0);
    assert.deepEqual(Reflect.ownKeys(row.inverses), row.inverses.map((_, index) => String(index)).concat('length'));
    for (const inverse of row.inverses) classicSourceKeys(inverse, ['current', 'baseline']);
  }
}
function classicSourceText(input) {
  assert.equal(typeof input, 'string', 'Classic interface source must be a UTF8 String');
  assert.equal(Buffer.from(input, 'utf8').toString('utf8'), input, 'Lossless UTF8 source only');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'BOM/NUL source refuses');
  const canonical = input.replaceAll('\r\n', '\n');
  assert(!canonical.includes('\r') && (input === canonical || input === canonical.replaceAll('\n', '\r\n')), 'Uniform whole LF or CRLF only');
  return canonical;
}
export function qualifyClassicInterfaceSource(file, input, pin = CLASSIC_INTERFACE_OVER_F92) {
  assert(CLASSIC_INTERFACE_FILES.includes(file), 'Unknown classic-interface source domain');
  classicSourceBinding(pin);
  const row = pin.files.find(item => item.file === file), canonical = classicSourceText(input);
  assert.equal(hash(input), row.currentRawSha256[input === canonical ? 'lf' : 'crlf'], 'Whole actual classic-interface raw source changed');
  assert.equal(hash(canonical), row.currentSha256); assert.equal(blob(canonical), row.currentBlob); assert.equal(Buffer.byteLength(canonical), row.currentBytes);
  let restored = canonical, end = -1;
  for (const inverse of row.inverses) {
    assert.equal(typeof inverse.current, 'string'); assert(inverse.current.length > 0); assert.equal(typeof inverse.baseline, 'string');
    assert.equal(canonical.split(inverse.current).length, 2, 'Each complete current context occurs once');
    const at = canonical.indexOf(inverse.current); assert(at >= end, 'Current contexts remain ordered and nonoverlapping'); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(restored), row.targetSha256); assert.equal(blob(restored), row.targetBlob); assert.equal(Buffer.byteLength(restored), row.targetBytes);
  return Object.freeze({ baselineText: restored, sourceRevision: pin.revision, targetRevision: pin.targetRevision, sourceOnly: true, native: false, runtime: false });
}
export function classicInterfaceHistoricalInput(file, input) {
  if (!CLASSIC_INTERFACE_FILES.includes(file)) return input;
  classicSourceBinding(CLASSIC_INTERFACE_OVER_F92);
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text, 'utf8').equals(input), 'Classic interface physical input must be lossless UTF-8');
  const canonical = classicSourceText(text), row = CLASSIC_INTERFACE_OVER_F92.files.find(item => item.file === file);
  if (hash(canonical) === row.targetSha256 && blob(canonical) === row.targetBlob && Buffer.byteLength(canonical) === row.targetBytes) return input;
  // Older historical inputs and unknown bytes stay raw for their existing strict namespace; only the exact new source gets an inverse.
  if (hash(canonical) !== row.currentSha256) return input;
  const restored = qualifyClassicInterfaceSource(file, text).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
