import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const COMPANY_OPPORTUNITY_SOURCE_REVIEWED_REVISION = '5aadb5267bba9060716ddd82660e59f6aec89ea3';
export const COMPANY_OPPORTUNITY_SOURCE_PREDECESSOR_REVISION = '4fbf49d01e011118a1b64bbac2b9912cf97e7276';
export const COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "f6f797b01206c09e081612e573f6b2f0da2b7667ae5ac8bbc13dcd321373da40",
  "src/worker.js": "8f3c0bbcbd7a6ff82280dce3120e4dd84fc7fbfd1a7ad71bdde3a6f99c799f0a",
  "src/invariants.js": "c2879af55021696e1bc358e34bb95794737b3846a54de22be393c29101c68743",
  "src/social/estate.js": "6db50d8cd63eb0341971c4447b2b2c4b7c4bc82b8c8a98abd6232ab361a92498",
  "src/market.js": "542653aab9034940a6624389f502c841908ebade121fe08b6975d6987349df7e"
});
export const COMPANY_OPPORTUNITY_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "711ae89162729555c52b8033ab28d39708f73b89c6e3ef10ef851416daf59c0f",
  "src/worker.js": "8ca31fc0b53ed0868de5f762f35805bab99989f93c7f76f4f7864cdae3f71312",
  "src/invariants.js": "c2879af55021696e1bc358e34bb95794737b3846a54de22be393c29101c68743",
  "src/social/estate.js": "6db50d8cd63eb0341971c4447b2b2c4b7c4bc82b8c8a98abd6232ab361a92498",
  "src/market.js": "542653aab9034940a6624389f502c841908ebade121fe08b6975d6987349df7e"
});
export const COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "cae0d2135adb4385c4ca71d46b6830e010631574",
  "src/worker.js": "3ea6f8f97371148487c94c1a7e29de7fd2cc9851",
  "src/invariants.js": "26ec65e64aa0c76519c2995df377c9529713fef4",
  "src/social/estate.js": "3c1adee020c5804f871a9daffba3f01db185c12b",
  "src/market.js": "34d9bb0dac36f554b26e97218d019372d529d1a8"
});
export const COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "1b2b37ecc8ef58a3100b2e4f8acdac215ff74cc9",
  "src/worker.js": "a22472d88c3ed638df0e209007f35a703568e687",
  "src/invariants.js": "26ec65e64aa0c76519c2995df377c9529713fef4",
  "src/social/estate.js": "3c1adee020c5804f871a9daffba3f01db185c12b",
  "src/market.js": "34d9bb0dac36f554b26e97218d019372d529d1a8"
});
export const COMPANY_OPPORTUNITY_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCompanyOpportunities } from './routes/companyopportunities.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerCompanyLogisticsHubs } from './routes/companylogisticshubs.js';\n",
      "baseline": "import { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerCompanyLogisticsHubs } from './routes/companylogisticshubs.js';\n"
    },
    {
      "current": "  registerCompanyOperators(app, { pool, auth });\n  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n  registerCompanyOpportunities(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n  registerCompanyLogisticsHubs(app, { pool, auth });\n",
      "baseline": "  registerCompanyOperators(app, { pool, auth });\n  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n  registerCompanyLogisticsHubs(app, { pool, auth });\n"
    }
  ],
  "src/worker.js": [
    {
      "current": "import { runPopulation, runResidentBehaviour } from './population.js';\nimport { runCompanyOperators } from './companyoperatorrunner.js';\nimport { runCompanyWorkflows } from './companyworkflowrunner.js';\nimport { runCompanyOpportunities } from './companyopportunityrunner.js';\nimport { runCompanyBankPortfolios } from './companybankportfoliorunner.js';\nimport { expireBuyerCooperativeFunding } from './buyercooperativerunner.js';\nimport { sweepLaw } from './law.js';\n",
      "baseline": "import { runPopulation, runResidentBehaviour } from './population.js';\nimport { runCompanyOperators } from './companyoperatorrunner.js';\nimport { runCompanyWorkflows } from './companyworkflowrunner.js';\nimport { runCompanyBankPortfolios } from './companybankportfoliorunner.js';\nimport { expireBuyerCooperativeFunding } from './buyercooperativerunner.js';\nimport { sweepLaw } from './law.js';\n"
    },
    {
      "current": "      await safe('company workflows', () => runCompanyWorkflows(pool, 20));\n      await safe('company bank portfolios', () => runCompanyBankPortfolios(pool, 20));\n      await safe('buyer cooperative funding expiry', () => expireBuyerCooperativeFunding(pool, 20));\n      await safe('company opportunities', () => runCompanyOpportunities(pool, 25));\n    }\n    finally { companyTicking = false; }\n  };\n",
      "baseline": "      await safe('company workflows', () => runCompanyWorkflows(pool, 20));\n      await safe('company bank portfolios', () => runCompanyBankPortfolios(pool, 20));\n      await safe('buyer cooperative funding expiry', () => expireBuyerCooperativeFunding(pool, 20));\n    }\n    finally { companyTicking = false; }\n  };\n"
    }
  ],
  "src/invariants.js": [],
  "src/social/estate.js": [],
  "src/market.js": []
});
export const COMPANY_OPPORTUNITY_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: COMPANY_OPPORTUNITY_SOURCE_REVIEWED_REVISION,
  predecessorRevision: COMPANY_OPPORTUNITY_SOURCE_PREDECESSOR_REVISION,
  currentPins: COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS, baselinePins: COMPANY_OPPORTUNITY_SOURCE_BASELINE_PINS,
  currentBlobs: COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS, baselineBlobs: COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(COMPANY_OPPORTUNITY_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-company-opportunity-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: "Only five complete frozen server, worker, invariant, estate and Market Git blobs and four exact unique opportunity registration and bounded existing-clock runner Git hunks reconstruct complete N07 predecessors. Invariant, estate and Market bytes remain unchanged. Every prior pin, negative control and source qualification retains its scope. Opportunity owner consent, source attribution, agent API, budgets, retries and execution require separate current-source proofs. This adapter adds no world-soak, native financial, accounting audit clearance, deployment or onchain qualification."
});
export function assertCompanyOpportunitySourceTransfer(file, input) {
  assert(Object.hasOwn(COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS, file), 'Unknown Company Opportunity source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS[file], 'Company Opportunity source changed: ' + file);
  assert.equal(blob(text), COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS[file], 'Company Opportunity full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of COMPANY_OPPORTUNITY_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Company Opportunity inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = COMPANY_OPPORTUNITY_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Company Opportunity source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS[file], 'Company Opportunity complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: COMPANY_OPPORTUNITY_SOURCE_INVERSES[file].length,
    sourceRevision: COMPANY_OPPORTUNITY_SOURCE_REVIEWED_REVISION, sourceBlob: COMPANY_OPPORTUNITY_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: COMPANY_OPPORTUNITY_SOURCE_PREDECESSOR_REVISION, predecessorBlob: COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS[file],
    evidence: COMPANY_OPPORTUNITY_SOURCE_TRANSFER.evidence, phase: COMPANY_OPPORTUNITY_SOURCE_TRANSFER.phase, scope: COMPANY_OPPORTUNITY_SOURCE_TRANSFER.scope };
}
export function qualifyCompanyOpportunitySource(file, input) {
  assert(Object.hasOwn(COMPANY_OPPORTUNITY_SOURCE_BASELINE_PINS, file), 'Unknown Company Opportunity source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === COMPANY_OPPORTUNITY_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS[file], 'Company Opportunity complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: COMPANY_OPPORTUNITY_SOURCE_PREDECESSOR_REVISION, sourceBlob: COMPANY_OPPORTUNITY_SOURCE_BASELINE_BLOBS[file],
      evidence: COMPANY_OPPORTUNITY_SOURCE_TRANSFER.evidence, phase: COMPANY_OPPORTUNITY_SOURCE_TRANSFER.phase, scope: COMPANY_OPPORTUNITY_SOURCE_TRANSFER.scope };
  }
  return assertCompanyOpportunitySourceTransfer(file, text);
}
// Unknown bytes are retained for their original rejecting source guard, never stripped by pattern.
export function companyOpportunitySourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS, file) && hash(text) === COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS[file]
    ? assertCompanyOpportunitySourceTransfer(file, text).baselineText : text;
}
