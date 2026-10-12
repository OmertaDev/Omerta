import { BUSINESS_SEASON_SOURCE_CURRENT_PINS, assertBusinessSeasonSourceTransfer } from './rc1-business-season-source-compatibility.js';
import { COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS, assertCompanyOpportunitySourceTransfer } from './rc1-company-opportunity-source-compatibility.js';
import { BUYER_COOPERATIVE_SOURCE_CURRENT_PINS, assertBuyerCooperativeSourceTransfer } from './rc1-buyer-cooperative-source-compatibility.js';
import { COMPANY_BANK_SOURCE_CURRENT_PINS, assertCompanyBankSourceTransfer } from './rc1-company-bank-source-compatibility.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { COMPANY_OPERATOR_SOURCE_CURRENT_PINS, assertCompanyOperatorSourceTransfer } from './rc1-company-operator-source-compatibility.js';
import { COMPANY_WORKFLOW_SOURCE_CURRENT_PINS, assertCompanyWorkflowSourceTransfer } from './rc1-company-workflow-source-compatibility.js';

export const INTEL_SOURCE_REVIEWED_REVISION = 'a752ce8743aab9c0027a06a2ce06a95161dceef3';
export const INTEL_SOURCE_PREDECESSOR_REVISION = 'e6669079acf97c01b24dc7a6926ecea0b7797b8b';
export const INTEL_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "9b968fc85aab3666b0a9e1d1e22ab38647b883bc3039e8bd11dbec4e50dfd5f3",
  "src/worker.js": "fd3acb85be133917dd933cd74acd112452aacddd6de5f59f2c98c6fca414d51c",
  "src/social/estate.js": "0cbeb5125f2cc7ba542db6ad3d357cb010dc4aff8330c628256687fba7ae45b6",
  "src/invariants.js": "5f66d3ef90645eeaed7c84e5604249d94db4c32884dc7f6e8c758f54600a66a1"
});
export const INTEL_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "aa03980dbba6a9f5f0a8da96e69c94031f930ffb75950851e166d5db51d288d2",
  "src/worker.js": "7072264895a874fbcc1f068c85a8668c4cc34819918868459d71194c5f1eabf6",
  "src/social/estate.js": "5d39208e155fb81ef450640f7d4d44d4fb62e3c564b2d6588bee55b07f4671cc",
  "src/invariants.js": "10d8f60e89dab8ffc1494cbe3953fe0a5c18106722b84e1e7817294ac6fa0016"
});
export const INTEL_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "cb1b1a2acf90fcd702c0cf31b26705477e1f72c1",
  "src/worker.js": "f0c808dc5e48364e2286b1ce1a2670b77ba85192",
  "src/social/estate.js": "e1b23d51ae0e9b77534e06e6df72a4a2f2357cea",
  "src/invariants.js": "cc8bd5324ceffb9b37371682c5cedac64b5f4e92"
});
export const INTEL_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "6fc8c1d21e4b346d52d9e8214ce723f7a92d7a7a",
  "src/worker.js": "90210e2c06228251f123614ed5d5c45a14830887",
  "src/social/estate.js": "1230efc72779eb839292d82dc1bf0e7a34f04b51",
  "src/invariants.js": "31084671f54e09e03c2b366d0e053ef74fb2d27d"
});
export const INTEL_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    "import { register as registerIntelForecasts } from './routes/intelforecasts.js';\n",
    "  registerIntelForecasts(app, { pool, auth });\n"
  ],
  "src/worker.js": [
    "import { expireIntelForecastJobs } from './intelforecastjobs.js';\n",
    "    await safe('intel forecast refund sweep', () => expireIntelForecastJobs(pool));\n"
  ],
  "src/social/estate.js": [
    "import { voidIntelForecastJobsAtDeath } from '../intelforecastjobs.js';\n",
    "  const intel = await voidIntelForecastJobsAtDeath(client, victim.id, opts.killerCh, estateLootRate);\n  if (opts.killerCh && intel.looted) report.intelForecastLoot = intel.looted;\n"
  ],
  "src/invariants.js": [
    "import { intelForecastAccounting } from './intelforecastinvariants.js';\n",
    "    'intel_job:',\n",
    "  const intelForecasts = await intelForecastAccounting(pool);\n  push('intel forecast escrow', intelForecasts.escrow, intelForecasts.expected, 0);\n  push('intel forecast receipts', intelForecasts.invalid, 0, 0);\n\n"
  ]
});
const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const INTEL_SOURCE_TRANSFER = Object.freeze({ sourceRevision: INTEL_SOURCE_REVIEWED_REVISION,
  predecessorRevision: INTEL_SOURCE_PREDECESSOR_REVISION, currentPins: INTEL_SOURCE_CURRENT_PINS, baselinePins: INTEL_SOURCE_BASELINE_PINS,
  currentBlobs: INTEL_SOURCE_CURRENT_BLOBS, baselineBlobs: INTEL_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(INTEL_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-intel-source-compatibility.js', phase: 'exact source compatibility; financial activation disabled',
  scope: 'Only exact Intel route registration, hourly refund sweep, buyer estate hook and invariant additions are removed to reconstruct complete predecessor sources. Historical qualifications remain scoped to those unchanged bytes. Intel cash, authorization, consent, expiry, death and outcome behavior requires separate current-source native proof; no historical runtime, native, deployment or financial qualification is expanded.' });

export function assertIntelSourceTransfer(file, input) {
  if (file === 'src/worker.js' && hash(normalize(input)) === BUSINESS_SEASON_SOURCE_CURRENT_PINS[file]) {
    const season = assertBusinessSeasonSourceTransfer(file, input), predecessor = assertIntelSourceTransfer(file, season.baselineText);
    return { ...predecessor, actualSha256: season.actualSha256, businessSeasonSourceTransfer: season };
  }
  if (file === 'src/worker.js' && hash(normalize(input)) === COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS[file]) {
    const opportunity = assertCompanyOpportunitySourceTransfer(file, input), predecessor = assertIntelSourceTransfer(file, opportunity.baselineText);
    return { ...predecessor, actualSha256: opportunity.actualSha256, companyOpportunitySourceTransfer: opportunity };
  }
  if (file === 'src/worker.js' && hash(normalize(input)) === BUYER_COOPERATIVE_SOURCE_CURRENT_PINS[file]) {
    const cooperative = assertBuyerCooperativeSourceTransfer(file, input), predecessor = assertIntelSourceTransfer(file, cooperative.baselineText);
    return { ...predecessor, actualSha256: cooperative.actualSha256, buyerCooperativeSourceTransfer: cooperative };
  }
  if (file === 'src/worker.js' && hash(normalize(input)) === COMPANY_BANK_SOURCE_CURRENT_PINS[file]) {
    const bank = assertCompanyBankSourceTransfer(file, input), predecessor = assertIntelSourceTransfer(file, bank.baselineText);
    return { ...predecessor, actualSha256: bank.actualSha256, companyBankSourceTransfer: bank };
  }
  const workflow = file === 'src/worker.js' && hash(normalize(input)) === COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file] ? assertCompanyWorkflowSourceTransfer(file, input) : null;
  const operatorInput = workflow?.baselineText || input;
  if (file === 'src/worker.js' && hash(normalize(operatorInput)) === COMPANY_OPERATOR_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertCompanyOperatorSourceTransfer(file, operatorInput);
    const predecessor = assertIntelSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: workflow?.actualSha256 || transfer.actualSha256, companyOperatorSourceTransfer: transfer, ...(workflow ? { companyWorkflowSourceTransfer: workflow } : {}) };
  }
  assert(Object.hasOwn(INTEL_SOURCE_CURRENT_PINS, file), 'Unknown Intel source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, INTEL_SOURCE_CURRENT_PINS[file], 'Intel source changed: ' + file);
  let baselineText = text;
  for (const chunk of INTEL_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk).length, 2, 'Intel source inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk, '');
  }
  const baselineSha256 = INTEL_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Intel source differs beyond exact reviewed additions: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: INTEL_SOURCE_INVERSES[file].length,
    sourceRevision: INTEL_SOURCE_REVIEWED_REVISION, sourceBlob: INTEL_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: INTEL_SOURCE_PREDECESSOR_REVISION, predecessorBlob: INTEL_SOURCE_BASELINE_BLOBS[file],
    evidence: INTEL_SOURCE_TRANSFER.evidence, phase: INTEL_SOURCE_TRANSFER.phase, scope: INTEL_SOURCE_TRANSFER.scope };
}
// Unchanged historical source is accepted without expanding its original scope.
export function qualifyIntelSource(file, input) {
  assert(Object.hasOwn(INTEL_SOURCE_BASELINE_PINS, file), 'Unknown Intel source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === INTEL_SOURCE_BASELINE_PINS[file])
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: INTEL_SOURCE_PREDECESSOR_REVISION, sourceBlob: INTEL_SOURCE_BASELINE_BLOBS[file],
      evidence: INTEL_SOURCE_TRANSFER.evidence, phase: INTEL_SOURCE_TRANSFER.phase, scope: INTEL_SOURCE_TRANSFER.scope };
  return assertIntelSourceTransfer(file, text);
}
