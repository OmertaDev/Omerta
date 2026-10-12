import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION = '34611834437ccaf8d2427f4766d80d95670efc9b';
export const COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION = '14ba455061b39720c6cee238f42700c431d0229c';
export const COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "35134b856e2b7a62efe63c8334c2684f1813e93469d42f0e456b71e4c6928b1d",
  "src/invariants.js": "c271e1b5fea11fe5f117c5d2283ce346271cb5a849aea07ccd4eecb26bc675d0",
  "src/social/estate.js": "ad1e2ac1d41b0fcc4542717d75e433a572da69deeffe13788a36a3646e14d702"
});
export const COMMERCIAL_PREMISES_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "50acd3201643b7894118b09bc205c2111e7ef3412e2577da038e5d91c4144799",
  "src/invariants.js": "80c0505cdc977a0e03384a6c693951b77ea70f18a3100a56a9415492794962da",
  "src/social/estate.js": "f1fd519c369a72db8c5f01ab23dab185a2d5dc4456cde17997f56683972856d8"
});
export const COMMERCIAL_PREMISES_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "68b4f7c94cb3710e6eff5debb6ef26f01c279613",
  "src/invariants.js": "48c231af05551bb5f4507f39beee0592b2426c08",
  "src/social/estate.js": "425cd1e0b8172d283e8c867523c13f4261c685a8"
});
export const COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "6a33f252ac499d32f1bc4ef2d78613819097c3f8",
  "src/invariants.js": "693a2e0d8ac7c297848b7e004d8932cad988892b",
  "src/social/estate.js": "17aa4d3c03f95c9a956dd408fd7b3784494ce153"
});
export const COMMERCIAL_PREMISES_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerCompanyOperators(app, { pool, auth });\n  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n  registerCommercialPremises(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerCompanyOperators(app, { pool, auth });\n  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "import { strategyLeagueFaults } from './strategyleagueinvariants.js';\nimport { employmentCashInvariant } from './gameemploymentinvariants.js';\nimport { runCompanyWorkflowInvariants } from './companyworkflowinvariants.js';\nimport { commercialPremisesInvariant } from './commercialpremisesinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "import { strategyLeagueFaults } from './strategyleagueinvariants.js';\nimport { employmentCashInvariant } from './gameemploymentinvariants.js';\nimport { runCompanyWorkflowInvariants } from './companyworkflowinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "    // by the per-character check (a) AND its own `favor escrow` identity below.\n    'favor:',\n    'intel_job:', 'employment:reserve:', 'employment:wage:', 'employment:refund:', 'employment:estate:loot:',\n    'commercial_premises:rent:pay', 'commercial_premises:rent:receive',\n    // COMMISSION step three: proposal deposits — treasury→escrow (`commission:proposal`, NULL char),\n    // refunded on an enacted motion (`commission:refund`) or forfeited to the confiscation pool\n    // (`commission:forfeit`) — reconciled by the treasury check (b) + the commission-escrow check\n",
      "baseline": "    // by the per-character check (a) AND its own `favor escrow` identity below.\n    'favor:',\n    'intel_job:', 'employment:reserve:', 'employment:wage:', 'employment:refund:', 'employment:estate:loot:',\n    // COMMISSION step three: proposal deposits — treasury→escrow (`commission:proposal`, NULL char),\n    // refunded on an enacted motion (`commission:refund`) or forfeited to the confiscation pool\n    // (`commission:forfeit`) — reconciled by the treasury check (b) + the commission-escrow check\n"
    },
    {
      "current": "  push('game employment loot ledger', employment.lootedCash, employment.lootedCash - employment.lootDelta, 0);\n  const workflows = await runCompanyWorkflowInvariants(pool);\n  push('company workflow provenance', workflows.issues.length, 0, 0, { issues: workflows.issues });\n  const premises = await commercialPremisesInvariant(pool);\n  push(premises.name, premises.defects.length, 0, 0, { defects: premises.defects });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n",
      "baseline": "  push('game employment loot ledger', employment.lootedCash, employment.lootedCash - employment.lootDelta, 0);\n  const workflows = await runCompanyWorkflowInvariants(pool);\n  push('company workflow provenance', workflows.issues.length, 0, 0, { issues: workflows.issues });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n"
    }
  ],
  "src/social/estate.js": [
    {
      "current": "import { voidIntelForecastJobsAtDeath } from '../intelforecastjobs.js';\nimport { voidEmploymentAtDeath } from '../gameemployment.js';\nimport { closeCompanyWorkflowsAtDeath } from '../companyworkflows.js';\nimport { voidCommercialPremisesAtDeath } from '../commercialpremises.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n",
      "baseline": "import { voidIntelForecastJobsAtDeath } from '../intelforecastjobs.js';\nimport { voidEmploymentAtDeath } from '../gameemployment.js';\nimport { closeCompanyWorkflowsAtDeath } from '../companyworkflows.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n"
    },
    {
      "current": "  const employment = await voidEmploymentAtDeath(client, h, victim, opts.killerCh, estateLootRate);\n  if (employment.lootedCash) report.employmentLoot = employment.lootedCash;\n  await closeCompanyWorkflowsAtDeath(client, victim.id);\n  await voidCommercialPremisesAtDeath(client, victim);\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n",
      "baseline": "  const employment = await voidEmploymentAtDeath(client, h, victim, opts.killerCh, estateLootRate);\n  if (employment.lootedCash) report.employmentLoot = employment.lootedCash;\n  await closeCompanyWorkflowsAtDeath(client, victim.id);\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n"
    }
  ]
});
export const COMMERCIAL_PREMISES_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION,
  predecessorRevision: COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION,
  currentPins: COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS, baselinePins: COMMERCIAL_PREMISES_SOURCE_BASELINE_PINS,
  currentBlobs: COMMERCIAL_PREMISES_SOURCE_CURRENT_BLOBS, baselineBlobs: COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(COMMERCIAL_PREMISES_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-commercial-premises-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: "Only three complete frozen server, invariant and estate Git blobs and seven exact unique premises registration, rent reconciliation and estate hook Git hunks reconstruct complete N03 predecessors. Worker bytes remain unchanged. All prior pins, controls and historical qualifications retain their scope. Rent, slots, JWT, books, rollback, expiry and estate behavior require separate current-source premises proofs. This adapter adds no world-soak, native, financial, deployment or onchain qualification."
});
export function assertCommercialPremisesSourceTransfer(file, input) {
  assert(Object.hasOwn(COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS, file), 'Unknown Commercial Premises source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS[file], 'Commercial Premises source changed: ' + file);
  assert.equal(blob(text), COMMERCIAL_PREMISES_SOURCE_CURRENT_BLOBS[file], 'Commercial Premises full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of COMMERCIAL_PREMISES_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Commercial Premises inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = COMMERCIAL_PREMISES_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Commercial Premises source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS[file], 'Commercial Premises complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: COMMERCIAL_PREMISES_SOURCE_INVERSES[file].length,
    sourceRevision: COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION, sourceBlob: COMMERCIAL_PREMISES_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION, predecessorBlob: COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS[file],
    evidence: COMMERCIAL_PREMISES_SOURCE_TRANSFER.evidence, phase: COMMERCIAL_PREMISES_SOURCE_TRANSFER.phase, scope: COMMERCIAL_PREMISES_SOURCE_TRANSFER.scope };
}
export function qualifyCommercialPremisesSource(file, input) {
  assert(Object.hasOwn(COMMERCIAL_PREMISES_SOURCE_BASELINE_PINS, file), 'Unknown Commercial Premises source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === COMMERCIAL_PREMISES_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS[file], 'Commercial Premises complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION, sourceBlob: COMMERCIAL_PREMISES_SOURCE_BASELINE_BLOBS[file],
      evidence: COMMERCIAL_PREMISES_SOURCE_TRANSFER.evidence, phase: COMMERCIAL_PREMISES_SOURCE_TRANSFER.phase, scope: COMMERCIAL_PREMISES_SOURCE_TRANSFER.scope };
  }
  return assertCommercialPremisesSourceTransfer(file, text);
}
// Unknown bytes are retained for their original rejecting source guard, never stripped by pattern.
export function commercialPremisesSourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS, file) && hash(text) === COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS[file]
    ? assertCommercialPremisesSourceTransfer(file, text).baselineText : text;
}
