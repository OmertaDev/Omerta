// Reconstruct historical Deed source only for complete reviewed combined postimages.
// The separate native table describes actual bytes and has no inverse or runtime authority.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {combinedEconomicDeedSource} from './combined-economic-deed-source-data.js';

const hash = text => createHash('sha256').update(text).digest('hex');
assert.equal(hash(JSON.stringify(combinedEconomicDeedSource)),'782b41ced211d4e7caad40dbd61b486aeb6933db9ef9f9041b5b4c7fc35f7617','Reviewed combined economic and Deed source envelope changed');
function freeze(value) {
  for(const item of Object.values(value)) if(item && typeof item==='object') freeze(item);
  return Object.freeze(value);
}
export const combinedEconomicDeedPin=freeze(combinedEconomicDeedSource);
function verify(text,pin) {
  assert.equal(Buffer.byteLength(text),pin.bytes);
  assert.equal(hash(text),pin.sha256);
  assert.equal(createHash('sha1').update('blob '+pin.bytes+'\0').update(text).digest('hex'),pin.blob);
}
function historical(files,file,input) {
  if(typeof file!=='string' || !Object.hasOwn(files,file)) return input;
  const buffer=Buffer.isBuffer(input), original=buffer?input.toString('utf8'):input;
  if(buffer) assert(Buffer.from(original).equals(input),'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if(typeof original!=='string') return input;
  const lf=original.replaceAll('\r\n','\n'), row=files[file];
  if(lf.includes('\r') || (lf!==original && original!==lf.replaceAll('\n','\r\n')) || hash(lf)!==row.current.sha256)
    return input;
  verify(lf,row.current);
  let restored=lf;
  for(const {at,current,baseline} of row.inverses.toReversed()) {
    assert.equal(restored.slice(at,at+current.length),current,'Reviewed combined inverse: '+file);
    restored=restored.slice(0,at)+baseline+restored.slice(at+current.length);
  }
  verify(restored,row.baseline);
  return buffer?Buffer.from(restored):restored;
}


export function combinedEconomicDeedInput(file,input) {
  return historical(combinedEconomicDeedPin.files,file,input);
}
export function combinedEconomicTermsInput(file,input) {
  return historical(combinedEconomicDeedPin.economicFiles,file,input);
}
export function combinedEconomicFixtureInput(file,input) {
  return historical(combinedEconomicDeedPin.fixtureFiles,file,input);
}
export function combinedNoirUiInput(file,input) {
  return historical(combinedEconomicDeedPin.noirFiles,file,input);
}
