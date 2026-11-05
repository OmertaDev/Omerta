// Reproduce the source-only proof from the two immutable parent/merge trees.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {economicTermsPin} from './current-economic-terms-source-data.js';
import {DEED_ALLOCATION_SOURCE_DOMAINS} from './deed-allocation-source-data.js';
import {ENTERPRISE_NATIVE_UX_INPUTS} from './enterprise-native-deed-inputs.js';

const source = '3785994c91797a68c6bbc8673d56f314651858e5';
const predecessor = '4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364';
const git = (...args) => execFileSync('git',['--no-replace-objects',...args],{
  encoding:'utf8', maxBuffer:32*1024*1024, windowsHide:true,
});
const digest = text => createHash('sha256').update(text).digest('hex');
const tree = rev => git('rev-parse',rev+'^{tree}').trim();
const lines = text => [0,...Array.from(text.matchAll(/\n/g), match => match.index+1)];

function record(rev,file) {
  const text = git('show',rev+':'+file);
  const [mode,type,blob] = git('ls-tree',rev,'--',file).trim().split(/\s+/);
  assert(type==='blob' && ['100644','100755'].includes(mode));
  return {text,pin:{mode,blob,sha256:digest(text),bytes:Buffer.byteLength(text)}};
}

// Git supplies line boundaries. Retaining only the changed part of each hunk keeps the giant
// npm script on one line from duplicating tens of thousands of unrelated characters in the proof.
function changes(file,current,baseline) {
  const offsets=lines(current), priorOffsets=lines(baseline), inverses=[];
  const diff=git('diff','--no-ext-diff','--no-textconv','--unified=0',predecessor,source,'--',file);
  for (const match of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const oldCount=Number(match[2]??1), newCount=Number(match[4]??1);
    const oldLine=Number(match[1])-(oldCount?1:0), newLine=Number(match[3])-(newCount?1:0);
    const prior=baseline.slice(priorOffsets[oldLine],priorOffsets[oldLine+oldCount]);
    const actual=current.slice(offsets[newLine],offsets[newLine+newCount]);
    let prefix=0,suffix=0; const limit=Math.min(actual.length,prior.length);
    while(prefix<limit && actual[prefix]===prior[prefix]) prefix++;
    while(suffix<limit-prefix && actual[actual.length-1-suffix]===prior[prior.length-1-suffix]) suffix++;
    inverses.push({at:offsets[newLine]+prefix,current:actual.slice(prefix,actual.length-suffix),baseline:prior.slice(prefix,prior.length-suffix)});
  }
  let restored=current;
  for(const h of inverses.toReversed()) {
    assert.equal(restored.slice(h.at,h.at+h.current.length),h.current);
    restored=restored.slice(0,h.at)+h.baseline+restored.slice(h.at+h.current.length);
  }
  assert.equal(restored,baseline,'Complete reviewed Deed predecessor: '+file);
  return inverses;
}

assert.deepEqual(process.argv.slice(2),['--write']);
git('merge-base','--is-ancestor',source,'HEAD');
git('merge-base','--is-ancestor',predecessor,source);
for (const file of ['tools/deed-allocation-source-data.js','tools/enterprise-native-deed-inputs.js'])
  assert.equal(readFileSync(file,'utf8').replaceAll('\r\n','\n'),git('show',predecessor+':'+file),'Immutable Deed domain listing: '+file);
const changed=git('diff','--name-only','-z',predecessor,source).split('\0').filter(Boolean);
const native = new Map(ENTERPRISE_NATIVE_UX_INPUTS.files.map(row=>[row.file,row]));
const files={}, economicFiles={}, fixtureFiles={}, nativeFiles={};
for (const file of changed) {
  const deed=Object.hasOwn(DEED_ALLOCATION_SOURCE_DOMAINS,file)?DEED_ALLOCATION_SOURCE_DOMAINS[file]:null;
  const physical=native.get(file);
  const economic=Object.hasOwn(economicTermsPin.files,file)?economicTermsPin.files[file]:null;
  if (!deed && !physical && !economic) continue;
  const actual=record(source,file), prior=record(predecessor,file);
  if(deed) {
    assert.equal(prior.pin.blob,deed.currentBlob,'Exact reviewed Deed source: '+file);
    files[file]={current:actual.pin,baseline:prior.pin,inverses:changes(file,actual.text,prior.text)};
  }
  if (!deed && economic && actual.pin.blob!==economic.current.blob) {
    assert.equal(prior.pin.blob,economic.baseline.blob,'Exact prior economic source: '+file);
    economicFiles[file]={current:actual.pin,baseline:prior.pin,inverses:changes(file,actual.text,prior.text)};
  }
  if(physical) {
    for(const field of ['mode','sha256','blob']) assert.equal(prior.pin[field],physical[field],'Exact native input: '+file);
    nativeFiles[file]={current:actual.pin,baseline:prior.pin};
  }
  if(file==='test/lib/rc1-historical-source-fixture.js')
    fixtureFiles[file]={current:actual.pin,baseline:prior.pin,inverses:changes(file,actual.text,prior.text)};
}
const pin={source,sourceTree:tree(source),predecessor,predecessorTree:tree(predecessor),files,economicFiles,fixtureFiles,nativeFiles};
writeFileSync(new URL('./combined-economic-deed-source-data.js',import.meta.url),
  '// Generated from exact reviewed combined and Deed trees. Native records contain original byte identities only.\n'
  +'export const combinedEconomicDeedSource = '+JSON.stringify(pin,null,2)+';\n');
console.log('Combined proof data SHA-256',digest(JSON.stringify(pin)));
