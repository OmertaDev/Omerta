import { companyLogisticsHubSourceBaseline } from './rc1-company-logistics-hub-source-compatibility.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const COMPANY_BANK_SOURCE_REVIEWED_REVISION = 'bf2e9220508a2a02e516f9c2c4df1e3674848414';
export const COMPANY_BANK_SOURCE_PREDECESSOR_REVISION = '34611834437ccaf8d2427f4766d80d95670efc9b';
export const COMPANY_BANK_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "1f56493505048a92fb42811884f314b461e8aba967edf9fafa338a6724c2d67b",
  "src/worker.js": "2b1fd07f9a05759a5f926a46732da1d12678a5e9e7878dda44d99f888847b6f7",
  "src/invariants.js": "535e33fba36b10ff14b68a5effca8b291af73af6542aabc1ab7726f6f9a7239e",
  "src/social/estate.js": "478d367b8185d60068747cbdff0b5575c039109cdb5722eb914eaad0a468d4e3"
});
export const COMPANY_BANK_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "35134b856e2b7a62efe63c8334c2684f1813e93469d42f0e456b71e4c6928b1d",
  "src/worker.js": "90fa69c5a267c8f3077ca50aafbed54bace56ee09995ed0741a115baa51a2e79",
  "src/invariants.js": "c271e1b5fea11fe5f117c5d2283ce346271cb5a849aea07ccd4eecb26bc675d0",
  "src/social/estate.js": "ad1e2ac1d41b0fcc4542717d75e433a572da69deeffe13788a36a3646e14d702"
});
export const COMPANY_BANK_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "37ff4d78e07e8dbbd2eaf95307153d2b1f1facc4",
  "src/worker.js": "474b0b1dc0879354db82f5158977a13a3e05e670",
  "src/invariants.js": "7e679b8e605e8403c8976eb5199e73efd8c8ff97",
  "src/social/estate.js": "4d951b92c26ab4dd037a42aeb2cf4d06398e2904"
});
export const COMPANY_BANK_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "68b4f7c94cb3710e6eff5debb6ef26f01c279613",
  "src/worker.js": "11afe18bb1e5db0d58f9bd0aef9a708c83c63c44",
  "src/invariants.js": "48c231af05551bb5f4507f39beee0592b2426c08",
  "src/social/estate.js": "425cd1e0b8172d283e8c867523c13f4261c685a8"
});
export const COMPANY_BANK_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/worker.js": [
    {
      "current": "import { runPopulation, runResidentBehaviour } from './population.js';\nimport { runCompanyOperators } from './companyoperatorrunner.js';\nimport { runCompanyWorkflows } from './companyworkflowrunner.js';\nimport { runCompanyBankPortfolios } from './companybankportfoliorunner.js';\nimport { sweepLaw } from './law.js';\nimport { sweepLoans } from './loans.js';\nimport { sweepAuctions, sweepConsignments } from './auction.js';\n",
      "baseline": "import { runPopulation, runResidentBehaviour } from './population.js';\nimport { runCompanyOperators } from './companyoperatorrunner.js';\nimport { runCompanyWorkflows } from './companyworkflowrunner.js';\nimport { sweepLaw } from './law.js';\nimport { sweepLoans } from './loans.js';\nimport { sweepAuctions, sweepConsignments } from './auction.js';\n"
    },
    {
      "current": "    try {\n      await safe('company operators', () => runCompanyOperators(pool, 20));\n      await safe('company workflows', () => runCompanyWorkflows(pool, 20));\n      await safe('company bank portfolios', () => runCompanyBankPortfolios(pool, 20));\n    }\n    finally { companyTicking = false; }\n  };\n",
      "baseline": "    try {\n      await safe('company operators', () => runCompanyOperators(pool, 20));\n      await safe('company workflows', () => runCompanyWorkflows(pool, 20));\n    }\n    finally { companyTicking = false; }\n  };\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "import { employmentCashInvariant } from './gameemploymentinvariants.js';\nimport { runCompanyWorkflowInvariants } from './companyworkflowinvariants.js';\nimport { commercialPremisesInvariant } from './commercialpremisesinvariants.js';\nimport { runCompanyBankPortfolioInvariants } from './companybankportfolioinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "import { employmentCashInvariant } from './gameemploymentinvariants.js';\nimport { runCompanyWorkflowInvariants } from './companyworkflowinvariants.js';\nimport { commercialPremisesInvariant } from './commercialpremisesinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "  push('company workflow provenance', workflows.issues.length, 0, 0, { issues: workflows.issues });\n  const premises = await commercialPremisesInvariant(pool);\n  push(premises.name, premises.defects.length, 0, 0, { defects: premises.defects });\n  const bankPortfolios = await runCompanyBankPortfolioInvariants(pool);\n  push('company bank portfolio authority and lifetime budget', bankPortfolios.issues.length, 0, 0, { issues: bankPortfolios.issues });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n",
      "baseline": "  push('company workflow provenance', workflows.issues.length, 0, 0, { issues: workflows.issues });\n  const premises = await commercialPremisesInvariant(pool);\n  push(premises.name, premises.defects.length, 0, 0, { defects: premises.defects });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n"
    }
  ],
  "src/social/estate.js": [
    {
      "current": "import { voidEmploymentAtDeath } from '../gameemployment.js';\nimport { closeCompanyWorkflowsAtDeath } from '../companyworkflows.js';\nimport { voidCommercialPremisesAtDeath } from '../commercialpremises.js';\nimport { closeCompanyBankPortfoliosAtDeath } from '../companybankportfolios.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n",
      "baseline": "import { voidEmploymentAtDeath } from '../gameemployment.js';\nimport { closeCompanyWorkflowsAtDeath } from '../companyworkflows.js';\nimport { voidCommercialPremisesAtDeath } from '../commercialpremises.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n"
    },
    {
      "current": "  if (employment.lootedCash) report.employmentLoot = employment.lootedCash;\n  await closeCompanyWorkflowsAtDeath(client, victim.id);\n  await voidCommercialPremisesAtDeath(client, victim);\n  await closeCompanyBankPortfoliosAtDeath(client, victim.id);\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n",
      "baseline": "  if (employment.lootedCash) report.employmentLoot = employment.lootedCash;\n  await closeCompanyWorkflowsAtDeath(client, victim.id);\n  await voidCommercialPremisesAtDeath(client, victim);\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n"
    }
  ]
});
export const COMPANY_BANK_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: COMPANY_BANK_SOURCE_REVIEWED_REVISION,
  predecessorRevision: COMPANY_BANK_SOURCE_PREDECESSOR_REVISION,
  currentPins: COMPANY_BANK_SOURCE_CURRENT_PINS, baselinePins: COMPANY_BANK_SOURCE_BASELINE_PINS,
  currentBlobs: COMPANY_BANK_SOURCE_CURRENT_BLOBS, baselineBlobs: COMPANY_BANK_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(COMPANY_BANK_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-company-bank-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: "Only four complete frozen server, worker, invariant and estate Git blobs and eight exact unique bank registration, bounded existing-clock runner, budget reconciliation and estate hook Git hunks reconstruct complete N04 predecessors. All prior pins, controls and historical qualifications retain their scope. Owner consent, agent loans, worker authority, budget, cash, rollback and estate behavior require separate current-source bank proofs. This adapter adds no world-soak, native, financial, deployment or onchain qualification."
});
export function assertCompanyBankSourceTransfer(file, input) {
  assert(Object.hasOwn(COMPANY_BANK_SOURCE_CURRENT_PINS, file), 'Unknown Company Bank source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, COMPANY_BANK_SOURCE_CURRENT_PINS[file], 'Company Bank source changed: ' + file);
  assert.equal(blob(text), COMPANY_BANK_SOURCE_CURRENT_BLOBS[file], 'Company Bank full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of COMPANY_BANK_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Company Bank inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = COMPANY_BANK_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Company Bank source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), COMPANY_BANK_SOURCE_BASELINE_BLOBS[file], 'Company Bank complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: COMPANY_BANK_SOURCE_INVERSES[file].length,
    sourceRevision: COMPANY_BANK_SOURCE_REVIEWED_REVISION, sourceBlob: COMPANY_BANK_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: COMPANY_BANK_SOURCE_PREDECESSOR_REVISION, predecessorBlob: COMPANY_BANK_SOURCE_BASELINE_BLOBS[file],
    evidence: COMPANY_BANK_SOURCE_TRANSFER.evidence, phase: COMPANY_BANK_SOURCE_TRANSFER.phase, scope: COMPANY_BANK_SOURCE_TRANSFER.scope };
}
export function qualifyCompanyBankSource(file, input) {
  assert(Object.hasOwn(COMPANY_BANK_SOURCE_BASELINE_PINS, file), 'Unknown Company Bank source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === COMPANY_BANK_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), COMPANY_BANK_SOURCE_BASELINE_BLOBS[file], 'Company Bank complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: COMPANY_BANK_SOURCE_PREDECESSOR_REVISION, sourceBlob: COMPANY_BANK_SOURCE_BASELINE_BLOBS[file],
      evidence: COMPANY_BANK_SOURCE_TRANSFER.evidence, phase: COMPANY_BANK_SOURCE_TRANSFER.phase, scope: COMPANY_BANK_SOURCE_TRANSFER.scope };
  }
  return assertCompanyBankSourceTransfer(file, text);
}
// Unknown bytes are retained for their original rejecting source guard, never stripped by pattern.
export function companyBankSourceBaseline(file, input) {
  const text = companyLogisticsHubSourceBaseline(file, input);
  return Object.hasOwn(COMPANY_BANK_SOURCE_CURRENT_PINS, file) && hash(text) === COMPANY_BANK_SOURCE_CURRENT_PINS[file]
    ? assertCompanyBankSourceTransfer(file, text).baselineText : text;
}
