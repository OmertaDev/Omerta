import { commercialPremisesSourceBaseline } from './rc1-commercial-premises-source-compatibility.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION = '14ba455061b39720c6cee238f42700c431d0229c';
export const COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION = 'ad19f1c98263e15566105380e580bf87eebca4df';
export const COMPANY_WORKFLOW_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "50acd3201643b7894118b09bc205c2111e7ef3412e2577da038e5d91c4144799",
  "src/worker.js": "90fa69c5a267c8f3077ca50aafbed54bace56ee09995ed0741a115baa51a2e79",
  "src/invariants.js": "80c0505cdc977a0e03384a6c693951b77ea70f18a3100a56a9415492794962da",
  "src/social/estate.js": "f1fd519c369a72db8c5f01ab23dab185a2d5dc4456cde17997f56683972856d8"
});
export const COMPANY_WORKFLOW_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "4c846a3c298b79326247f0c4f8d1c93b96ed0517bc46a4a8f8116c975bf65ffe",
  "src/worker.js": "0b854f2da5f8e118408fac5c6570b4d64de5a9c854d2b06a1f47dcb6d57aec1a",
  "src/invariants.js": "d258b398bea2a6df93cff40d57f9d589edf4f4eaad0e5258ec2c0c13e7598c80",
  "src/social/estate.js": "d5eeac4dbd2634c46066cc094d90fbba64431c3f4c656053af1191e02875807f"
});
export const COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "6a33f252ac499d32f1bc4ef2d78613819097c3f8",
  "src/worker.js": "11afe18bb1e5db0d58f9bd0aef9a708c83c63c44",
  "src/invariants.js": "693a2e0d8ac7c297848b7e004d8932cad988892b",
  "src/social/estate.js": "17aa4d3c03f95c9a956dd408fd7b3784494ce153"
});
export const COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "1b1320617f4c5a15d2b4648e50dc0a0355536d96",
  "src/worker.js": "c0281af8d4bc0101b805e082e5f0a3a04b7a4517",
  "src/invariants.js": "fd01b04d0304280379f83e2f79d92d4c7e7dbee5",
  "src/social/estate.js": "77460c876a854ceb979f80d4033c70bb2e20f6bb"
});
export const COMPANY_WORKFLOW_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerStrategyLeagues } from './routes/strategyleagues.js';\nimport { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerStrategyLeagues } from './routes/strategyleagues.js';\nimport { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerStrategyLeagues(app, { pool, auth });\n  registerCompanyOperators(app, { pool, auth });\n  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerStrategyLeagues(app, { pool, auth });\n  registerCompanyOperators(app, { pool, auth });\n  registerGameEmployment(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/worker.js": [
    {
      "current": "import { spawnNpcConvoys, despawnArrivedNpc, sweepConvoyHauls } from './convoy.js';\nimport { runPopulation, runResidentBehaviour } from './population.js';\nimport { runCompanyOperators } from './companyoperatorrunner.js';\nimport { runCompanyWorkflows } from './companyworkflowrunner.js';\nimport { sweepLaw } from './law.js';\nimport { sweepLoans } from './loans.js';\nimport { sweepAuctions, sweepConsignments } from './auction.js';\n",
      "baseline": "import { spawnNpcConvoys, despawnArrivedNpc, sweepConvoyHauls } from './convoy.js';\nimport { runPopulation, runResidentBehaviour } from './population.js';\nimport { runCompanyOperators } from './companyoperatorrunner.js';\nimport { sweepLaw } from './law.js';\nimport { sweepLoans } from './loans.js';\nimport { sweepAuctions, sweepConsignments } from './auction.js';\n"
    },
    {
      "current": "  const guardedCompanyTick = async () => {\n    if (companyTicking) return;\n    companyTicking = true;\n    try {\n      await safe('company operators', () => runCompanyOperators(pool, 20));\n      await safe('company workflows', () => runCompanyWorkflows(pool, 20));\n    }\n    finally { companyTicking = false; }\n  };\n  setInterval(guardedCompanyTick, 30000);\n",
      "baseline": "  const guardedCompanyTick = async () => {\n    if (companyTicking) return;\n    companyTicking = true;\n    try { await safe('company operators', () => runCompanyOperators(pool, 20)); }\n    finally { companyTicking = false; }\n  };\n  setInterval(guardedCompanyTick, 30000);\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "import { companySuccessionFaults } from './companysuccessioninvariants.js';\nimport { strategyLeagueFaults } from './strategyleagueinvariants.js';\nimport { employmentCashInvariant } from './gameemploymentinvariants.js';\nimport { runCompanyWorkflowInvariants } from './companyworkflowinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "import { companySuccessionFaults } from './companysuccessioninvariants.js';\nimport { strategyLeagueFaults } from './strategyleagueinvariants.js';\nimport { employmentCashInvariant } from './gameemploymentinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "  const employment = await employmentCashInvariant(pool);\n  push('game employment escrow', employment.actual, employment.expected, 0);\n  push('game employment loot ledger', employment.lootedCash, employment.lootedCash - employment.lootDelta, 0);\n  const workflows = await runCompanyWorkflowInvariants(pool);\n  push('company workflow provenance', workflows.issues.length, 0, 0, { issues: workflows.issues });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n",
      "baseline": "  const employment = await employmentCashInvariant(pool);\n  push('game employment escrow', employment.actual, employment.expected, 0);\n  push('game employment loot ledger', employment.lootedCash, employment.lootedCash - employment.lootDelta, 0);\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n"
    }
  ],
  "src/social/estate.js": [
    {
      "current": "import { voidFavorsAtDeath } from '../favors.js';\nimport { voidIntelForecastJobsAtDeath } from '../intelforecastjobs.js';\nimport { voidEmploymentAtDeath } from '../gameemployment.js';\nimport { closeCompanyWorkflowsAtDeath } from '../companyworkflows.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n",
      "baseline": "import { voidFavorsAtDeath } from '../favors.js';\nimport { voidIntelForecastJobsAtDeath } from '../intelforecastjobs.js';\nimport { voidEmploymentAtDeath } from '../gameemployment.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n"
    },
    {
      "current": "  if (opts.killerCh && intel.looted) report.intelForecastLoot = intel.looted;\n  const employment = await voidEmploymentAtDeath(client, h, victim, opts.killerCh, estateLootRate);\n  if (employment.lootedCash) report.employmentLoot = employment.lootedCash;\n  await closeCompanyWorkflowsAtDeath(client, victim.id);\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n",
      "baseline": "  if (opts.killerCh && intel.looted) report.intelForecastLoot = intel.looted;\n  const employment = await voidEmploymentAtDeath(client, h, victim, opts.killerCh, estateLootRate);\n  if (employment.lootedCash) report.employmentLoot = employment.lootedCash;\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n"
    }
  ]
});
export const COMPANY_WORKFLOW_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION,
  predecessorRevision: COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION,
  currentPins: COMPANY_WORKFLOW_SOURCE_CURRENT_PINS, baselinePins: COMPANY_WORKFLOW_SOURCE_BASELINE_PINS,
  currentBlobs: COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS, baselineBlobs: COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(COMPANY_WORKFLOW_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-company-workflow-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: "Only complete frozen server, worker, invariant and estate Git blobs and eight exact unique workflow registration, bounded existing-clock runner, provenance reconciliation and estate hook Git hunks reconstruct complete N02 predecessors. Every Employment/N01/older pin, negative control and historical source qualification stays scoped to unchanged bytes. Workflow consent, source/payment provenance, private API, worker authority, retries, concurrency and estate behavior require separate current-source workflow proofs. This adapter adds no world-soak, native, financial, deployment or onchain qualification."
});
export function assertCompanyWorkflowSourceTransfer(file, input) {
  assert(Object.hasOwn(COMPANY_WORKFLOW_SOURCE_CURRENT_PINS, file), 'Unknown Company Workflow source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file], 'Company Workflow source changed: ' + file);
  assert.equal(blob(text), COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS[file], 'Company Workflow full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of COMPANY_WORKFLOW_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Company Workflow inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = COMPANY_WORKFLOW_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Company Workflow source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file], 'Company Workflow complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: COMPANY_WORKFLOW_SOURCE_INVERSES[file].length,
    sourceRevision: COMPANY_WORKFLOW_SOURCE_REVIEWED_REVISION, sourceBlob: COMPANY_WORKFLOW_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION, predecessorBlob: COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file],
    evidence: COMPANY_WORKFLOW_SOURCE_TRANSFER.evidence, phase: COMPANY_WORKFLOW_SOURCE_TRANSFER.phase, scope: COMPANY_WORKFLOW_SOURCE_TRANSFER.scope };
}
export function qualifyCompanyWorkflowSource(file, input) {
  assert(Object.hasOwn(COMPANY_WORKFLOW_SOURCE_BASELINE_PINS, file), 'Unknown Company Workflow source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === COMPANY_WORKFLOW_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file], 'Company Workflow complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: COMPANY_WORKFLOW_SOURCE_PREDECESSOR_REVISION, sourceBlob: COMPANY_WORKFLOW_SOURCE_BASELINE_BLOBS[file],
      evidence: COMPANY_WORKFLOW_SOURCE_TRANSFER.evidence, phase: COMPANY_WORKFLOW_SOURCE_TRANSFER.phase, scope: COMPANY_WORKFLOW_SOURCE_TRANSFER.scope };
  }
  return assertCompanyWorkflowSourceTransfer(file, text);
}
// Unknown bytes are retained for their original rejecting source guard, never stripped by pattern.
export function companyWorkflowSourceBaseline(file, input) {
  const text = commercialPremisesSourceBaseline(file, input);
  return Object.hasOwn(COMPANY_WORKFLOW_SOURCE_CURRENT_PINS, file) && hash(text) === COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]
    ? assertCompanyWorkflowSourceTransfer(file, text).baselineText : text;
}
