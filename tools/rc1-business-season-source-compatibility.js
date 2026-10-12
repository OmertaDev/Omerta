import { combinedEconomySourceBaseline } from './rc1-economy-gui-combined-source-compatibility.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const BUSINESS_SEASON_SOURCE_REVIEWED_REVISION = '0ab4a3a5ad349d8ac7c01e2a5beb96b6ad156ae5';
export const BUSINESS_SEASON_SOURCE_PREDECESSOR_REVISION = 'bcd22b9176186713749908aae5bd334d0362f040';
export const BUSINESS_SEASON_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "e0090465696793006f50496af54e7cea6146456b85d3c63a37de3844792a5536",
  "src/worker.js": "61ba29e1cd6fdf6391515a2be7e6031c85e5d76707012eb9d3248aca53e3ff3a",
  "src/invariants.js": "c2879af55021696e1bc358e34bb95794737b3846a54de22be393c29101c68743",
  "src/social/estate.js": "6db50d8cd63eb0341971c4447b2b2c4b7c4bc82b8c8a98abd6232ab361a92498",
  "src/market.js": "542653aab9034940a6624389f502c841908ebade121fe08b6975d6987349df7e"
});
export const BUSINESS_SEASON_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "a1fc248158913d5ac668dde30184952911f28aa4d2bad350c29e191dee1e660f",
  "src/worker.js": "8f3c0bbcbd7a6ff82280dce3120e4dd84fc7fbfd1a7ad71bdde3a6f99c799f0a",
  "src/invariants.js": "c2879af55021696e1bc358e34bb95794737b3846a54de22be393c29101c68743",
  "src/social/estate.js": "6db50d8cd63eb0341971c4447b2b2c4b7c4bc82b8c8a98abd6232ab361a92498",
  "src/market.js": "542653aab9034940a6624389f502c841908ebade121fe08b6975d6987349df7e"
});
export const BUSINESS_SEASON_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "4a33da610db9260f191c22ed678b4f9f2b68afdb",
  "src/worker.js": "7cb2ad75443d6fccc0ff93d5a594fa0b2e317775",
  "src/invariants.js": "26ec65e64aa0c76519c2995df377c9529713fef4",
  "src/social/estate.js": "3c1adee020c5804f871a9daffba3f01db185c12b",
  "src/market.js": "34d9bb0dac36f554b26e97218d019372d529d1a8"
});
export const BUSINESS_SEASON_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "82c0fc43ac81172ca736125925d27618d1143d30",
  "src/worker.js": "3ea6f8f97371148487c94c1a7e29de7fd2cc9851",
  "src/invariants.js": "26ec65e64aa0c76519c2995df377c9529713fef4",
  "src/social/estate.js": "3c1adee020c5804f871a9daffba3f01db185c12b",
  "src/market.js": "34d9bb0dac36f554b26e97218d019372d529d1a8"
});
export const BUSINESS_SEASON_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCompanyOpportunities } from './routes/companyopportunities.js';\nimport { register as registerCommercialReputation } from './routes/commercialreputation.js';\nimport { register as registerBusinessSeasons } from './routes/businessseasons.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerCompanyLogisticsHubs } from './routes/companylogisticshubs.js';\n",
      "baseline": "import { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCompanyOpportunities } from './routes/companyopportunities.js';\nimport { register as registerCommercialReputation } from './routes/commercialreputation.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerCompanyLogisticsHubs } from './routes/companylogisticshubs.js';\n"
    },
    {
      "current": "  registerCompanyWorkflows(app, { pool, auth });\n  registerCompanyOpportunities(app, { pool, auth });\n  registerCommercialReputation(app, { pool, auth });\n  registerBusinessSeasons(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n  registerCompanyLogisticsHubs(app, { pool, auth });\n",
      "baseline": "  registerCompanyWorkflows(app, { pool, auth });\n  registerCompanyOpportunities(app, { pool, auth });\n  registerCommercialReputation(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n  registerCompanyLogisticsHubs(app, { pool, auth });\n"
    }
  ],
  "src/worker.js": [
    {
      "current": "import { runCompanyOperators } from './companyoperatorrunner.js';\nimport { runCompanyWorkflows } from './companyworkflowrunner.js';\nimport { runCompanyOpportunities } from './companyopportunityrunner.js';\nimport { runBusinessSeasons } from './businessseasonrunner.js';\nimport { runCompanyBankPortfolios } from './companybankportfoliorunner.js';\nimport { expireBuyerCooperativeFunding } from './buyercooperativerunner.js';\nimport { sweepLaw } from './law.js';\n",
      "baseline": "import { runCompanyOperators } from './companyoperatorrunner.js';\nimport { runCompanyWorkflows } from './companyworkflowrunner.js';\nimport { runCompanyOpportunities } from './companyopportunityrunner.js';\nimport { runCompanyBankPortfolios } from './companybankportfoliorunner.js';\nimport { expireBuyerCooperativeFunding } from './buyercooperativerunner.js';\nimport { sweepLaw } from './law.js';\n"
    },
    {
      "current": "      await safe('company bank portfolios', () => runCompanyBankPortfolios(pool, 20));\n      await safe('buyer cooperative funding expiry', () => expireBuyerCooperativeFunding(pool, 20));\n      await safe('company opportunities', () => runCompanyOpportunities(pool, 25));\n      await safe('business seasons', () => runBusinessSeasons(pool, 25));\n    }\n    finally { companyTicking = false; }\n  };\n",
      "baseline": "      await safe('company bank portfolios', () => runCompanyBankPortfolios(pool, 20));\n      await safe('buyer cooperative funding expiry', () => expireBuyerCooperativeFunding(pool, 20));\n      await safe('company opportunities', () => runCompanyOpportunities(pool, 25));\n    }\n    finally { companyTicking = false; }\n  };\n"
    }
  ],
  "src/invariants.js": [],
  "src/social/estate.js": [],
  "src/market.js": []
});
export const BUSINESS_SEASON_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: BUSINESS_SEASON_SOURCE_REVIEWED_REVISION,
  predecessorRevision: BUSINESS_SEASON_SOURCE_PREDECESSOR_REVISION,
  currentPins: BUSINESS_SEASON_SOURCE_CURRENT_PINS, baselinePins: BUSINESS_SEASON_SOURCE_BASELINE_PINS,
  currentBlobs: BUSINESS_SEASON_SOURCE_CURRENT_BLOBS, baselineBlobs: BUSINESS_SEASON_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(BUSINESS_SEASON_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-business-season-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: "Only five complete frozen server, worker, invariant, estate and Market Git blobs and four exact unique season registration and bounded existing-clock runner Git hunks reconstruct complete N09 predecessors. Invariant, estate and Market bytes remain unchanged. Every prior pin, negative control and source qualification retains its scope. Season provenance, score derivation, ranking privacy, agent API and expiry behavior require separate current-source proofs. This adapter adds no world-soak, native financial, accounting audit clearance, deployment or onchain qualification."
});
export function assertBusinessSeasonSourceTransfer(file, input) {
  assert(Object.hasOwn(BUSINESS_SEASON_SOURCE_CURRENT_PINS, file), 'Unknown Business Season source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, BUSINESS_SEASON_SOURCE_CURRENT_PINS[file], 'Business Season source changed: ' + file);
  assert.equal(blob(text), BUSINESS_SEASON_SOURCE_CURRENT_BLOBS[file], 'Business Season full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of BUSINESS_SEASON_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Business Season inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = BUSINESS_SEASON_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Business Season source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), BUSINESS_SEASON_SOURCE_BASELINE_BLOBS[file], 'Business Season complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: BUSINESS_SEASON_SOURCE_INVERSES[file].length,
    sourceRevision: BUSINESS_SEASON_SOURCE_REVIEWED_REVISION, sourceBlob: BUSINESS_SEASON_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: BUSINESS_SEASON_SOURCE_PREDECESSOR_REVISION, predecessorBlob: BUSINESS_SEASON_SOURCE_BASELINE_BLOBS[file],
    evidence: BUSINESS_SEASON_SOURCE_TRANSFER.evidence, phase: BUSINESS_SEASON_SOURCE_TRANSFER.phase, scope: BUSINESS_SEASON_SOURCE_TRANSFER.scope };
}
export function qualifyBusinessSeasonSource(file, input) {
  assert(Object.hasOwn(BUSINESS_SEASON_SOURCE_BASELINE_PINS, file), 'Unknown Business Season source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === BUSINESS_SEASON_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), BUSINESS_SEASON_SOURCE_BASELINE_BLOBS[file], 'Business Season complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: BUSINESS_SEASON_SOURCE_PREDECESSOR_REVISION, sourceBlob: BUSINESS_SEASON_SOURCE_BASELINE_BLOBS[file],
      evidence: BUSINESS_SEASON_SOURCE_TRANSFER.evidence, phase: BUSINESS_SEASON_SOURCE_TRANSFER.phase, scope: BUSINESS_SEASON_SOURCE_TRANSFER.scope };
  }
  return assertBusinessSeasonSourceTransfer(file, text);
}
// Unknown bytes are retained for their original rejecting source guard, never stripped by pattern.
export function businessSeasonSourceBaseline(file, input) {
  const text = normalize(combinedEconomySourceBaseline(file, input));
  return Object.hasOwn(BUSINESS_SEASON_SOURCE_CURRENT_PINS, file) && hash(text) === BUSINESS_SEASON_SOURCE_CURRENT_PINS[file]
    ? assertBusinessSeasonSourceTransfer(file, text).baselineText : text;
}
