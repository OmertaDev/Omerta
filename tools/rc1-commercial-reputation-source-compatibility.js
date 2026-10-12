import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION = 'bcd22b9176186713749908aae5bd334d0362f040';
export const COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION = '5aadb5267bba9060716ddd82660e59f6aec89ea3';
export const COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "a1fc248158913d5ac668dde30184952911f28aa4d2bad350c29e191dee1e660f",
  "src/worker.js": "8f3c0bbcbd7a6ff82280dce3120e4dd84fc7fbfd1a7ad71bdde3a6f99c799f0a",
  "src/invariants.js": "c2879af55021696e1bc358e34bb95794737b3846a54de22be393c29101c68743",
  "src/social/estate.js": "6db50d8cd63eb0341971c4447b2b2c4b7c4bc82b8c8a98abd6232ab361a92498",
  "src/market.js": "542653aab9034940a6624389f502c841908ebade121fe08b6975d6987349df7e"
});
export const COMMERCIAL_REPUTATION_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "f6f797b01206c09e081612e573f6b2f0da2b7667ae5ac8bbc13dcd321373da40",
  "src/worker.js": "8f3c0bbcbd7a6ff82280dce3120e4dd84fc7fbfd1a7ad71bdde3a6f99c799f0a",
  "src/invariants.js": "c2879af55021696e1bc358e34bb95794737b3846a54de22be393c29101c68743",
  "src/social/estate.js": "6db50d8cd63eb0341971c4447b2b2c4b7c4bc82b8c8a98abd6232ab361a92498",
  "src/market.js": "542653aab9034940a6624389f502c841908ebade121fe08b6975d6987349df7e"
});
export const COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "82c0fc43ac81172ca736125925d27618d1143d30",
  "src/worker.js": "3ea6f8f97371148487c94c1a7e29de7fd2cc9851",
  "src/invariants.js": "26ec65e64aa0c76519c2995df377c9529713fef4",
  "src/social/estate.js": "3c1adee020c5804f871a9daffba3f01db185c12b",
  "src/market.js": "34d9bb0dac36f554b26e97218d019372d529d1a8"
});
export const COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "cae0d2135adb4385c4ca71d46b6830e010631574",
  "src/worker.js": "3ea6f8f97371148487c94c1a7e29de7fd2cc9851",
  "src/invariants.js": "26ec65e64aa0c76519c2995df377c9529713fef4",
  "src/social/estate.js": "3c1adee020c5804f871a9daffba3f01db185c12b",
  "src/market.js": "34d9bb0dac36f554b26e97218d019372d529d1a8"
});
export const COMMERCIAL_REPUTATION_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCompanyOpportunities } from './routes/companyopportunities.js';\nimport { register as registerCommercialReputation } from './routes/commercialreputation.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerCompanyLogisticsHubs } from './routes/companylogisticshubs.js';\n",
      "baseline": "import { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCompanyOpportunities } from './routes/companyopportunities.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerCompanyLogisticsHubs } from './routes/companylogisticshubs.js';\n"
    },
    {
      "current": "  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n  registerCompanyOpportunities(app, { pool, auth });\n  registerCommercialReputation(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n  registerCompanyLogisticsHubs(app, { pool, auth });\n",
      "baseline": "  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n  registerCompanyOpportunities(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n  registerCompanyLogisticsHubs(app, { pool, auth });\n"
    }
  ],
  "src/worker.js": [],
  "src/invariants.js": [],
  "src/social/estate.js": [],
  "src/market.js": []
});
export const COMMERCIAL_REPUTATION_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION,
  predecessorRevision: COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION,
  currentPins: COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS, baselinePins: COMMERCIAL_REPUTATION_SOURCE_BASELINE_PINS,
  currentBlobs: COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS, baselineBlobs: COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(COMMERCIAL_REPUTATION_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-commercial-reputation-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: "Only five complete frozen server, worker, invariant, estate and Market Git blobs and two exact unique reputation registration Git hunks reconstruct complete N08 predecessors. Worker, invariant, estate and Market bytes remain unchanged. Every prior pin, negative control and source qualification retains its scope. Reputation provenance, aggregate privacy and agent API behavior require separate current-source proofs. This adapter adds no world-soak, native financial, accounting audit clearance, deployment or onchain qualification."
});
export function assertCommercialReputationSourceTransfer(file, input) {
  assert(Object.hasOwn(COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS, file), 'Unknown Commercial Reputation source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS[file], 'Commercial Reputation source changed: ' + file);
  assert.equal(blob(text), COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS[file], 'Commercial Reputation full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of COMMERCIAL_REPUTATION_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Commercial Reputation inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = COMMERCIAL_REPUTATION_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Commercial Reputation source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS[file], 'Commercial Reputation complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: COMMERCIAL_REPUTATION_SOURCE_INVERSES[file].length,
    sourceRevision: COMMERCIAL_REPUTATION_SOURCE_REVIEWED_REVISION, sourceBlob: COMMERCIAL_REPUTATION_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION, predecessorBlob: COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS[file],
    evidence: COMMERCIAL_REPUTATION_SOURCE_TRANSFER.evidence, phase: COMMERCIAL_REPUTATION_SOURCE_TRANSFER.phase, scope: COMMERCIAL_REPUTATION_SOURCE_TRANSFER.scope };
}
export function qualifyCommercialReputationSource(file, input) {
  assert(Object.hasOwn(COMMERCIAL_REPUTATION_SOURCE_BASELINE_PINS, file), 'Unknown Commercial Reputation source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === COMMERCIAL_REPUTATION_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS[file], 'Commercial Reputation complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: COMMERCIAL_REPUTATION_SOURCE_PREDECESSOR_REVISION, sourceBlob: COMMERCIAL_REPUTATION_SOURCE_BASELINE_BLOBS[file],
      evidence: COMMERCIAL_REPUTATION_SOURCE_TRANSFER.evidence, phase: COMMERCIAL_REPUTATION_SOURCE_TRANSFER.phase, scope: COMMERCIAL_REPUTATION_SOURCE_TRANSFER.scope };
  }
  return assertCommercialReputationSourceTransfer(file, text);
}
// Unknown bytes are retained for their original rejecting source guard, never stripped by pattern.
export function commercialReputationSourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS, file) && hash(text) === COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS[file]
    ? assertCommercialReputationSourceTransfer(file, text).baselineText : text;
}
