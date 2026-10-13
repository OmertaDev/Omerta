import { buyerCooperativeSourceBaseline } from './rc1-buyer-cooperative-source-compatibility.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION = '880f494311b3aad625ce06af99fcb245b146a351';
export const COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION = 'bf2e9220508a2a02e516f9c2c4df1e3674848414';
export const COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "d09fa63bcd6a97db0678b50e721ea02268ddabf5c2f597ca8e258c4ea87e57e7",
  "src/invariants.js": "5c8fb1cb138b725b9f1751f35c2c647c2518c9e46499a75c9de5fa3a746a28cd",
  "src/social/estate.js": "f77948b134fb954543d7508040e34dc6263de69ce0b0712676f57c63ce4a901f"
});
export const COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "1f56493505048a92fb42811884f314b461e8aba967edf9fafa338a6724c2d67b",
  "src/invariants.js": "535e33fba36b10ff14b68a5effca8b291af73af6542aabc1ab7726f6f9a7239e",
  "src/social/estate.js": "478d367b8185d60068747cbdff0b5575c039109cdb5722eb914eaad0a468d4e3"
});
export const COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "cd572e3608fb1718d528bac54f09b98847e18201",
  "src/invariants.js": "eb9db8489d11149b77c2c442700daa24a3a2148c",
  "src/social/estate.js": "dc1dfba22e5c34e276612ad387d9271b84e11755"
});
export const COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "37ff4d78e07e8dbbd2eaf95307153d2b1f1facc4",
  "src/invariants.js": "7e679b8e605e8403c8976eb5199e73efd8c8ff97",
  "src/social/estate.js": "4d951b92c26ab4dd037a42aeb2cf4d06398e2904"
});
export const COMPANY_LOGISTICS_HUB_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerCompanyLogisticsHubs } from './routes/companylogisticshubs.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerCompanyWorkflows(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n  registerCompanyLogisticsHubs(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerCompanyWorkflows(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "import { runCompanyWorkflowInvariants } from './companyworkflowinvariants.js';\nimport { commercialPremisesInvariant } from './commercialpremisesinvariants.js';\nimport { runCompanyBankPortfolioInvariants } from './companybankportfolioinvariants.js';\nimport { logisticsHubInvariant } from './companylogisticshubsinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "import { runCompanyWorkflowInvariants } from './companyworkflowinvariants.js';\nimport { commercialPremisesInvariant } from './commercialpremisesinvariants.js';\nimport { runCompanyBankPortfolioInvariants } from './companybankportfolioinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "  push(premises.name, premises.defects.length, 0, 0, { defects: premises.defects });\n  const bankPortfolios = await runCompanyBankPortfolioInvariants(pool);\n  push('company bank portfolio authority and lifetime budget', bankPortfolios.issues.length, 0, 0, { issues: bankPortfolios.issues });\n  const hubs = await logisticsHubInvariant(pool);\n  push(hubs.name, hubs.defects.length, 0, 0, { defects: hubs.defects });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n",
      "baseline": "  push(premises.name, premises.defects.length, 0, 0, { defects: premises.defects });\n  const bankPortfolios = await runCompanyBankPortfolioInvariants(pool);\n  push('company bank portfolio authority and lifetime budget', bankPortfolios.issues.length, 0, 0, { issues: bankPortfolios.issues });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n"
    }
  ],
  "src/social/estate.js": [
    {
      "current": "import { closeCompanyWorkflowsAtDeath } from '../companyworkflows.js';\nimport { voidCommercialPremisesAtDeath } from '../commercialpremises.js';\nimport { closeCompanyBankPortfoliosAtDeath } from '../companybankportfolios.js';\nimport { voidLogisticsHubsAtDeath } from '../companylogisticshubs.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n",
      "baseline": "import { closeCompanyWorkflowsAtDeath } from '../companyworkflows.js';\nimport { voidCommercialPremisesAtDeath } from '../commercialpremises.js';\nimport { closeCompanyBankPortfoliosAtDeath } from '../companybankportfolios.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n"
    },
    {
      "current": "  await closeCompanyWorkflowsAtDeath(client, victim.id);\n  await voidCommercialPremisesAtDeath(client, victim);\n  await closeCompanyBankPortfoliosAtDeath(client, victim.id);\n  await voidLogisticsHubsAtDeath(client, victim);\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n",
      "baseline": "  await closeCompanyWorkflowsAtDeath(client, victim.id);\n  await voidCommercialPremisesAtDeath(client, victim);\n  await closeCompanyBankPortfoliosAtDeath(client, victim.id);\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n"
    }
  ]
});
export const COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION,
  predecessorRevision: COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION,
  currentPins: COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS, baselinePins: COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_PINS,
  currentBlobs: COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS, baselineBlobs: COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(COMPANY_LOGISTICS_HUB_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-company-logistics-hub-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: "Only three complete frozen server, invariant and estate Git blobs and six exact unique hub registration, reconciliation and estate hook Git hunks reconstruct complete N05 predecessors. Worker bytes remain unchanged. All prior pins, controls and historical qualifications retain their scope. Paid premises, custody, finance, active limits, agent API, recovery and estate behavior require separate current-source hub proofs. This adapter adds no world-soak, native, financial, deployment or onchain qualification."
});
export function assertCompanyLogisticsHubSourceTransfer(file, input) {
  assert(Object.hasOwn(COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS, file), 'Unknown Company Logistics Hub source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS[file], 'Company Logistics Hub source changed: ' + file);
  assert.equal(blob(text), COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS[file], 'Company Logistics Hub full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of COMPANY_LOGISTICS_HUB_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Company Logistics Hub inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Company Logistics Hub source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS[file], 'Company Logistics Hub complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: COMPANY_LOGISTICS_HUB_SOURCE_INVERSES[file].length,
    sourceRevision: COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION, sourceBlob: COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION, predecessorBlob: COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS[file],
    evidence: COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER.evidence, phase: COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER.phase, scope: COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER.scope };
}
export function qualifyCompanyLogisticsHubSource(file, input) {
  assert(Object.hasOwn(COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_PINS, file), 'Unknown Company Logistics Hub source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS[file], 'Company Logistics Hub complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION, sourceBlob: COMPANY_LOGISTICS_HUB_SOURCE_BASELINE_BLOBS[file],
      evidence: COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER.evidence, phase: COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER.phase, scope: COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER.scope };
  }
  return assertCompanyLogisticsHubSourceTransfer(file, text);
}
// Unknown bytes are retained for their original rejecting source guard, never stripped by pattern.
export function companyLogisticsHubSourceBaseline(file, input) {
  const text = buyerCooperativeSourceBaseline(file, input);
  return Object.hasOwn(COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS, file) && hash(text) === COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS[file]
    ? assertCompanyLogisticsHubSourceTransfer(file, text).baselineText : text;
}
