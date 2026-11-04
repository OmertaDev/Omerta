// Exact historical source transfer only. Runtime and native checks use the physical source.
import assert from 'node:assert/strict';
import {combinedEconomicTermsInput} from './combined-economic-deed-source-transfer.js';
import {createHash} from 'node:crypto';
import {economicTermsPin} from './current-economic-terms-source-data.js';

function deepFreeze(value) {
  for (const part of Object.values(value)) if (part && typeof part === 'object') deepFreeze(part);
  return Object.freeze(value);
}
const sha = text => createHash('sha256').update(text).digest('hex');
assert.equal(sha(JSON.stringify(economicTermsPin)),'a259f3e80382f61fced3bc6e58eaa91f7b30e470529aef1ba82bc737506a1ab3',
  'Reviewed economic-terms source envelope changed');
export const currentEconomicTermsPin = deepFreeze(economicTermsPin);

function verify(text,pin) {
  assert.equal(Buffer.byteLength(text),pin.bytes);
  assert.equal(sha(text),pin.sha256);
  assert.equal(createHash('sha1').update('blob '+pin.bytes+'\0').update(text).digest('hex'),pin.blob);
}

export function currentEconomicTermsBaseline(file,input) {
  const files=currentEconomicTermsPin.files;
  if (!Object.hasOwn(files,file)) return input;
  input=combinedEconomicTermsInput(file,input);
  const isBuffer=Buffer.isBuffer(input), text=isBuffer ? input.toString('utf8') : input;
  if (isBuffer) assert(Buffer.from(text).equals(input),'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (typeof text!=='string') return input;
  const lf=text.replaceAll('\r\n','\n'), row=files[file];
  if (lf.includes('\r') || lf!==text && text!==lf.replaceAll('\n','\r\n') || sha(lf)!==row.current.sha256) return input;
  verify(lf,row.current);
  let baseline=lf;
  for (const {at,current,baseline:replacement} of row.inverses.toReversed()) {
    assert.equal(baseline.slice(at,at+current.length),current,'Reviewed economic source hunk changed: '+file);
    baseline=baseline.slice(0,at)+replacement+baseline.slice(at+current.length);
  }
  verify(baseline,row.baseline);
  return isBuffer ? Buffer.from(baseline) : baseline;
}
