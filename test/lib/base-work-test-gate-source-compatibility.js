// TEST namespace only: genuine committed Gate comparison, never runtime source or executable input.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
export const BASE_WORK_TEST_GATE_SOURCE = 'a144a8ee803ba7557b3bb0b15f7091d2f9c19280';
export const BASE_WORK_TEST_GATE_PREDECESSOR = '8fe7faf28007107611bd98f3728d1e00d984e5d4';
export const BASE_WORK_TEST_GATE_PHASE = 'exact TEST Gate comparison only; no runtime, native, current-source capture, deployment, finance or activation authority';
export const BASE_WORK_TEST_GATE_DOMAINS = {
  "test/gates.js": {
    "sourceMode": "100644",
    "sourceBlob": "8cff5b6a9b5a02cbec33bad390636cc165e66de3",
    "sourceSha256": "65354047b4987b0f5983d005f3738965f492078bd8d4014be551755413cff184",
    "baselineMode": "100644",
    "baselineBlob": "62b1a98610ad6b0bd870b7cc83ffa10269e420af",
    "baselineSha256": "3f5a95181527e7fd2b81764de5e57a9322a5f07268573d56ea78e153cc1cc4ab",
    "contextLines": 3,
    "inverses": [
      {
        "current": "  const autonomyScripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts;\n  assert.equal(autonomyScripts['test:company-autonomy:postgres'],'node tools/company-autonomy-native.js');\n  const expectedArtifactCommand=\"mkdir -p omerta-contracts/lib/openzeppelin-contracts && curl --fail --location https://github.com/OpenZeppelin/openzeppelin-contracts/archive/refs/tags/v5.6.1.tar.gz | tar xz -C omerta-contracts/lib/openzeppelin-contracts --strip-components=1 && forge build --root omerta-contracts src/market-v2/OmertaWorkEscrowV2.sol\";\n  const baseArtifactCommand=expectedArtifactCommand+' && node tools/build-funded-work-base-artifact.mjs';\n  assert.equal(autonomyScripts['build:funded-work-artifact'],baseArtifactCommand,'Genuine pinned ETH and frozen Base artifact builds only');\n  const artifactAdmits=(job,command)=>job.includes('      - uses: foundry-rs/foundry-toolchain@v1\\n        with:\\n          version: v1.7.1')&&job.includes('        run: npm run build:funded-work-artifact')&&(command===expectedArtifactCommand||command===baseArtifactCommand);\n  assert(artifactAdmits(suites.replaceAll('\\r\\n','\\n'),expectedArtifactCommand));assert(artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n'),expectedArtifactCommand));\n  for(const bad of [expectedArtifactCommand.replace('v5.6.1','master'),'cp retained-artifact.json omerta-contracts/out/OmertaWorkEscrowV2.json','echo synthetic'])assert(!artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n'),bad));\n  assert(!artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n').replace('version: v1.7.1','version: stable'),expectedArtifactCommand));\n",
        "baseline": "  const autonomyScripts=JSON.parse(fs.readFileSync('package.json','utf8')).scripts;\n  assert.equal(autonomyScripts['test:company-autonomy:postgres'],'node tools/company-autonomy-native.js');\n  const expectedArtifactCommand=\"mkdir -p omerta-contracts/lib/openzeppelin-contracts && curl --fail --location https://github.com/OpenZeppelin/openzeppelin-contracts/archive/refs/tags/v5.6.1.tar.gz | tar xz -C omerta-contracts/lib/openzeppelin-contracts --strip-components=1 && forge build --root omerta-contracts src/market-v2/OmertaWorkEscrowV2.sol\";\n  assert.equal(autonomyScripts['build:funded-work-artifact'],expectedArtifactCommand,'Genuine pinned OZ/compiler build only');\n  const artifactAdmits=(job,command)=>job.includes('      - uses: foundry-rs/foundry-toolchain@v1\\n        with:\\n          version: v1.7.1')&&job.includes('        run: npm run build:funded-work-artifact')&&command===expectedArtifactCommand;\n  assert(artifactAdmits(suites.replaceAll('\\r\\n','\\n'),expectedArtifactCommand));assert(artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n'),expectedArtifactCommand));\n  for(const bad of [expectedArtifactCommand.replace('v5.6.1','master'),'cp retained-artifact.json omerta-contracts/out/OmertaWorkEscrowV2.json','echo synthetic'])assert(!artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n'),bad));\n  assert(!artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n').replace('version: v1.7.1','version: stable'),expectedArtifactCommand));\n"
      }
    ]
  }
};
for (const pin of Object.values(BASE_WORK_TEST_GATE_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(BASE_WORK_TEST_GATE_DOMAINS);
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
function candidate(file, input) {
  if (!Object.hasOwn(BASE_WORK_TEST_GATE_DOMAINS, file) || (typeof input !== 'string' && !Buffer.isBuffer(input))) return null;
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : input;
  if (Buffer.isBuffer(input) && !Buffer.from(text, 'utf8').equals(input)) return null;
  const lf = text.replaceAll('\r\n', '\n');
  if (text !== lf && text !== lf.replaceAll('\n', '\r\n')) return null;
  const pin = BASE_WORK_TEST_GATE_DOMAINS[file];
  return hash(lf) === pin.sourceSha256 && blob(lf) === pin.sourceBlob ? lf : null;
}
export function assertBaseWorkHistoricalTestGateTransfer(file, input) {
  assert(Object.hasOwn(BASE_WORK_TEST_GATE_DOMAINS, file), 'Unknown TEST Gate comparison domain');
  const text = candidate(file, input);
  assert.notEqual(text, null, 'Complete TEST Gate comparison source changed');
  const pin = BASE_WORK_TEST_GATE_DOMAINS[file];
  let baseline = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length && baseline.split(inverse.current).length === 2, 'Missing or duplicate complete TEST Gate inverse');
    baseline = baseline.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  return { file, baselineText: baseline, sourceRevision: BASE_WORK_TEST_GATE_SOURCE, predecessorRevision: BASE_WORK_TEST_GATE_PREDECESSOR,
    sourceMode: pin.sourceMode, baselineMode: pin.baselineMode, inverseChunks: pin.inverses.length, phase: BASE_WORK_TEST_GATE_PHASE };
}
export function baseWorkHistoricalTestGateBaseline(file, input) {
  if (candidate(file, input) === null) return input;
  const baseline = assertBaseWorkHistoricalTestGateTransfer(file, input).baselineText;
  return Buffer.isBuffer(input) ? Buffer.from(baseline, 'utf8') : baseline;
}
