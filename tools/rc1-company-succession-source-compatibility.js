import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const COMPANY_SUCCESSION_SOURCE_REVIEWED_REVISION = "f07f6eec06f6356fcb93850de52d90794a04ed28";
export const COMPANY_SUCCESSION_SOURCE_PREDECESSOR_REVISION = "4e3c48d38294ec9c359011c12cd46f9df0b6b645";
export const COMPANY_SUCCESSION_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "5dd7006ef19f6e05ead2371d70428dd758ec7d39d908ea0324fb36daedc1a100",
  "src/invariants.js": "49f27d61054a80ce778f6faddbc9061a9176cb06787816777f8fa7456bb96f68"
});
export const COMPANY_SUCCESSION_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "2b16fd5d42c28c9cdd2b7c2c462625d74de630c7d39d29f5822ed48382a1d93a",
  "src/invariants.js": "3ceaff3032e5613501a898a28f77545d0d33c4e39ef142ff8e87d522a7eb5ccb"
});
export const COMPANY_SUCCESSION_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "b7a754a7c11af484d884fd7dd35e7b99b5e0de8a",
  "src/invariants.js": "7904dff8586ceeb1a6899d71681442a77eff5f15"
});
export const COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "66f818defce9381a96f60790e24b22cb81921c14",
  "src/invariants.js": "e3124c477cae913b88dce463da1ed194e0d7a84f"
});
export const COMPANY_SUCCESSION_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerIntelForecasts } from './routes/intelforecasts.js';\nimport { register as registerLogisticsCoverage } from './routes/logisticscoverage.js';\nimport { register as registerStrategyLicenses } from './routes/strategylicenses.js';\nimport { register as registerCompanySuccession } from './routes/companysuccession.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerIntelForecasts } from './routes/intelforecasts.js';\nimport { register as registerLogisticsCoverage } from './routes/logisticscoverage.js';\nimport { register as registerStrategyLicenses } from './routes/strategylicenses.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerIntelForecasts(app, { pool, auth });\n  registerLogisticsCoverage(app, { pool, auth });\n  registerStrategyLicenses(app, { pool, auth });\n  registerCompanySuccession(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerIntelForecasts(app, { pool, auth });\n  registerLogisticsCoverage(app, { pool, auth });\n  registerStrategyLicenses(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "import crypto from 'node:crypto';\nimport { logisticsCoverageFaults } from './logisticscoverageinvariants.js';\nimport { strategyLicenseFaults } from './strategylicenseinvariants.js';\nimport { companySuccessionFaults } from './companysuccessioninvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "import crypto from 'node:crypto';\nimport { logisticsCoverageFaults } from './logisticscoverageinvariants.js';\nimport { strategyLicenseFaults } from './strategylicenseinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "  push('logistics coverage bindings', await logisticsCoverageFaults(pool), 0, 0);\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n\n  // (f4) LOAN ESCROW (loan sharking): an OPEN offer holds the principal in escrow (the bounty-escrow\n  // twin). escrow == offered − taken (escrow → borrower) − refunded (cancel/expiry) − deathBurned.\n",
      "baseline": "  push('logistics coverage bindings', await logisticsCoverageFaults(pool), 0, 0);\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n\n  // (f4) LOAN ESCROW (loan sharking): an OPEN offer holds the principal in escrow (the bounty-escrow\n  // twin). escrow == offered − taken (escrow → borrower) − refunded (cancel/expiry) − deathBurned.\n"
    }
  ]
});
const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const COMPANY_SUCCESSION_SOURCE_TRANSFER = Object.freeze({ sourceRevision: COMPANY_SUCCESSION_SOURCE_REVIEWED_REVISION,
  predecessorRevision: COMPANY_SUCCESSION_SOURCE_PREDECESSOR_REVISION, currentPins: COMPANY_SUCCESSION_SOURCE_CURRENT_PINS, baselinePins: COMPANY_SUCCESSION_SOURCE_BASELINE_PINS,
  currentBlobs: COMPANY_SUCCESSION_SOURCE_CURRENT_BLOBS, baselineBlobs: COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(COMPANY_SUCCESSION_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-company-succession-source-compatibility.js', phase: 'exact source compatibility; financial activation disabled',
  sourceReview: 'docs/company-succession-security-review.md',
  scope: 'Only exact unique Git diff hunks for company succession route registration and binding invariant wiring reconstruct complete predecessor sources, preserving the already reviewed strategy and coverage integrations. Historical pins and qualifications remain scoped to unchanged predecessor bytes. Company consent, estate eligibility, canonical opening, accounting and durable receipt recovery require separate current-source native proof; no historical runtime, native, deployment or financial qualification is expanded. This review-only transfer supplies no worker or activation qualification.' });

export function assertCompanySuccessionSourceTransfer(file, input) {
  assert(Object.hasOwn(COMPANY_SUCCESSION_SOURCE_CURRENT_PINS, file), 'Unknown Company Succession source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file], 'Company Succession source changed: ' + file);
  let baselineText = text;
  for (const chunk of COMPANY_SUCCESSION_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Company Succession source inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = COMPANY_SUCCESSION_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Company Succession source differs beyond exact reviewed hunks: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: COMPANY_SUCCESSION_SOURCE_INVERSES[file].length,
    sourceRevision: COMPANY_SUCCESSION_SOURCE_REVIEWED_REVISION, sourceBlob: COMPANY_SUCCESSION_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: COMPANY_SUCCESSION_SOURCE_PREDECESSOR_REVISION, predecessorBlob: COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS[file],
    evidence: COMPANY_SUCCESSION_SOURCE_TRANSFER.evidence, phase: COMPANY_SUCCESSION_SOURCE_TRANSFER.phase, scope: COMPANY_SUCCESSION_SOURCE_TRANSFER.scope };
}
export function qualifyCompanySuccessionSource(file, input) {
  assert(Object.hasOwn(COMPANY_SUCCESSION_SOURCE_BASELINE_PINS, file), 'Unknown Company Succession source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === COMPANY_SUCCESSION_SOURCE_BASELINE_PINS[file])
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: COMPANY_SUCCESSION_SOURCE_PREDECESSOR_REVISION, sourceBlob: COMPANY_SUCCESSION_SOURCE_BASELINE_BLOBS[file],
      evidence: COMPANY_SUCCESSION_SOURCE_TRANSFER.evidence, phase: COMPANY_SUCCESSION_SOURCE_TRANSFER.phase, scope: COMPANY_SUCCESSION_SOURCE_TRANSFER.scope };
  return assertCompanySuccessionSourceTransfer(file, text);
}

// Compose only the exact current company succession blob. Earlier revisions and unknown
// bytes still reach the existing closed historical guard unchanged.
export function companySuccessionSourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(COMPANY_SUCCESSION_SOURCE_CURRENT_PINS, file) && hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file]
    ? qualifyCompanySuccessionSource(file, text).baselineText : text;
}
