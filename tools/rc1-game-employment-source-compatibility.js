import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION = 'ad19f1c98263e15566105380e580bf87eebca4df';
export const GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION = '4bd478a866d36b4fa645c82a9855c551f7816d85';
export const GAME_EMPLOYMENT_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "4c846a3c298b79326247f0c4f8d1c93b96ed0517bc46a4a8f8116c975bf65ffe",
  "src/invariants.js": "d258b398bea2a6df93cff40d57f9d589edf4f4eaad0e5258ec2c0c13e7598c80",
  "src/social/estate.js": "d5eeac4dbd2634c46066cc094d90fbba64431c3f4c656053af1191e02875807f"
});
export const GAME_EMPLOYMENT_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "b14c214336686192ab44fa84a1aec991b628ec551fcec129f8f584238b4a1068",
  "src/invariants.js": "842de0a3927272aace7a262d56159336a0576079f855ae05f7ae111521373bc2",
  "src/social/estate.js": "0cbeb5125f2cc7ba542db6ad3d357cb010dc4aff8330c628256687fba7ae45b6"
});
export const GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "1b1320617f4c5a15d2b4648e50dc0a0355536d96",
  "src/invariants.js": "fd01b04d0304280379f83e2f79d92d4c7e7dbee5",
  "src/social/estate.js": "77460c876a854ceb979f80d4033c70bb2e20f6bb"
});
export const GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "e0786401d991101ed47d949747b8603b512ec882",
  "src/invariants.js": "03644c4b806b972d93d2500afd1da69c6823abbc",
  "src/social/estate.js": "e1b23d51ae0e9b77534e06e6df72a4a2f2357cea"
});
export const GAME_EMPLOYMENT_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerMarketFeed } from './routes/marketfeed.js';\nimport { register as registerStrategyLeagues } from './routes/strategyleagues.js';\nimport { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerMarketFeed } from './routes/marketfeed.js';\nimport { register as registerStrategyLeagues } from './routes/strategyleagues.js';\nimport { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerMarketFeed(app, { pool });\n  registerStrategyLeagues(app, { pool, auth });\n  registerCompanyOperators(app, { pool, auth });\n  registerGameEmployment(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerMarketFeed(app, { pool });\n  registerStrategyLeagues(app, { pool, auth });\n  registerCompanyOperators(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "import { strategyLicenseFaults } from './strategylicenseinvariants.js';\nimport { companySuccessionFaults } from './companysuccessioninvariants.js';\nimport { strategyLeagueFaults } from './strategyleagueinvariants.js';\nimport { employmentCashInvariant } from './gameemploymentinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "import { strategyLicenseFaults } from './strategylicenseinvariants.js';\nimport { companySuccessionFaults } from './companysuccessioninvariants.js';\nimport { strategyLeagueFaults } from './strategyleagueinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "    // `favor:refund` cancel/expiry, `favor:loot`/`favor:death` the dead poster's escrow. Reconciled\n    // by the per-character check (a) AND its own `favor escrow` identity below.\n    'favor:',\n    'intel_job:', 'employment:reserve:', 'employment:wage:', 'employment:refund:', 'employment:estate:loot:',\n    // COMMISSION step three: proposal deposits — treasury→escrow (`commission:proposal`, NULL char),\n    // refunded on an enacted motion (`commission:refund`) or forfeited to the confiscation pool\n    // (`commission:forfeit`) — reconciled by the treasury check (b) + the commission-escrow check\n",
      "baseline": "    // `favor:refund` cancel/expiry, `favor:loot`/`favor:death` the dead poster's escrow. Reconciled\n    // by the per-character check (a) AND its own `favor escrow` identity below.\n    'favor:',\n    'intel_job:',\n    // COMMISSION step three: proposal deposits — treasury→escrow (`commission:proposal`, NULL char),\n    // refunded on an enacted motion (`commission:refund`) or forfeited to the confiscation pool\n    // (`commission:forfeit`) — reconciled by the treasury check (b) + the commission-escrow check\n"
    },
    {
      "current": "  const coverageEscrow = await one(pool, 'SELECT COALESCE(SUM(escrow_cash),0) s FROM logistics_coverage_policies');\n  push('logistics coverage escrow', coverageEscrow, -(await sum(pool, \"currency='cash' AND reason LIKE 'coverage:%'\")), 0);\n  push('logistics coverage bindings', await logisticsCoverageFaults(pool), 0, 0);\n  const employment = await employmentCashInvariant(pool);\n  push('game employment escrow', employment.actual, employment.expected, 0);\n  push('game employment loot ledger', employment.lootedCash, employment.lootedCash - employment.lootDelta, 0);\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n",
      "baseline": "  const coverageEscrow = await one(pool, 'SELECT COALESCE(SUM(escrow_cash),0) s FROM logistics_coverage_policies');\n  push('logistics coverage escrow', coverageEscrow, -(await sum(pool, \"currency='cash' AND reason LIKE 'coverage:%'\")), 0);\n  push('logistics coverage bindings', await logisticsCoverageFaults(pool), 0, 0);\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n"
    }
  ],
  "src/social/estate.js": [
    {
      "current": "import { voidLoansAtDeath } from '../loans.js';\nimport { voidFavorsAtDeath } from '../favors.js';\nimport { voidIntelForecastJobsAtDeath } from '../intelforecastjobs.js';\nimport { voidEmploymentAtDeath } from '../gameemployment.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n",
      "baseline": "import { voidLoansAtDeath } from '../loans.js';\nimport { voidFavorsAtDeath } from '../favors.js';\nimport { voidIntelForecastJobsAtDeath } from '../intelforecastjobs.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n"
    },
    {
      "current": "  if (opts.killerCh && fv.looted) report.favorLoot = fv.looted;\n  const intel = await voidIntelForecastJobsAtDeath(client, victim.id, opts.killerCh, estateLootRate);\n  if (opts.killerCh && intel.looted) report.intelForecastLoot = intel.looted;\n  const employment = await voidEmploymentAtDeath(client, h, victim, opts.killerCh, estateLootRate);\n  if (employment.lootedCash) report.employmentLoot = employment.lootedCash;\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n",
      "baseline": "  if (opts.killerCh && fv.looted) report.favorLoot = fv.looted;\n  const intel = await voidIntelForecastJobsAtDeath(client, victim.id, opts.killerCh, estateLootRate);\n  if (opts.killerCh && intel.looted) report.intelForecastLoot = intel.looted;\n  if (h.victimOwned.gangId) await removeMember(client, h.victimOwned.gangId, victim.id);\n\n  victim.alive = false;\n"
    }
  ]
});
export const GAME_EMPLOYMENT_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION,
  predecessorRevision: GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION,
  currentPins: GAME_EMPLOYMENT_SOURCE_CURRENT_PINS, baselinePins: GAME_EMPLOYMENT_SOURCE_BASELINE_PINS,
  currentBlobs: GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS, baselineBlobs: GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(GAME_EMPLOYMENT_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-game-employment-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: 'Only complete frozen server, invariant and estate Git blobs and exact unique employment import/registration, ledger reason/reconciliation and estate import/hook Git hunks reconstruct complete N01 predecessors. Original operator and every older historical pin, negative control and source qualification remain scoped to their unchanged bytes. Employment consent, payroll, work authority, API and estate behavior require separate current-source employment proofs. This adapter adds no worker, world-soak, native, financial, deployment or onchain qualification.'
});
export function assertGameEmploymentSourceTransfer(file, input) {
  assert(Object.hasOwn(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS, file), 'Unknown Game Employment source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file], 'Game Employment source changed: ' + file);
  assert.equal(blob(text), GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[file], 'Game Employment full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of GAME_EMPLOYMENT_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Game Employment inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Game Employment source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file], 'Game Employment complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: GAME_EMPLOYMENT_SOURCE_INVERSES[file].length,
    sourceRevision: GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION, sourceBlob: GAME_EMPLOYMENT_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION, predecessorBlob: GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file],
    evidence: GAME_EMPLOYMENT_SOURCE_TRANSFER.evidence, phase: GAME_EMPLOYMENT_SOURCE_TRANSFER.phase, scope: GAME_EMPLOYMENT_SOURCE_TRANSFER.scope };
}
export function qualifyGameEmploymentSource(file, input) {
  assert(Object.hasOwn(GAME_EMPLOYMENT_SOURCE_BASELINE_PINS, file), 'Unknown Game Employment source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === GAME_EMPLOYMENT_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file], 'Game Employment complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION, sourceBlob: GAME_EMPLOYMENT_SOURCE_BASELINE_BLOBS[file],
      evidence: GAME_EMPLOYMENT_SOURCE_TRANSFER.evidence, phase: GAME_EMPLOYMENT_SOURCE_TRANSFER.phase, scope: GAME_EMPLOYMENT_SOURCE_TRANSFER.scope };
  }
  return assertGameEmploymentSourceTransfer(file, text);
}
// Unknown bytes are retained for their original rejecting source guard, never stripped by pattern.
export function gameEmploymentSourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS, file) && hash(text) === GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file]
    ? assertGameEmploymentSourceTransfer(file, text).baselineText : text;
}
