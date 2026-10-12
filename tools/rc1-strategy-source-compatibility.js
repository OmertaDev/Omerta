import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const STRATEGY_SOURCE_REVIEWED_REVISION = "4e3c48d38294ec9c359011c12cd46f9df0b6b645";
export const STRATEGY_SOURCE_PREDECESSOR_REVISION = "1a29ff10ecfa30989fdd7ada3238499ea4c85e0f";
export const STRATEGY_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "2b16fd5d42c28c9cdd2b7c2c462625d74de630c7d39d29f5822ed48382a1d93a",
  "src/invariants.js": "3ceaff3032e5613501a898a28f77545d0d33c4e39ef142ff8e87d522a7eb5ccb"
});
export const STRATEGY_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "61466e32e1ad34e62f61d611f655235a8bd8e5b132c43afdf7cb1674a615b9e9",
  "src/invariants.js": "a767d216a726c7d1c0d2b48062997282cf053a1adbcbfa4ba8f894ef58b9fc3f"
});
export const STRATEGY_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "66f818defce9381a96f60790e24b22cb81921c14",
  "src/invariants.js": "e3124c477cae913b88dce463da1ed194e0d7a84f"
});
export const STRATEGY_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "b5c144c986d4f80e899b56fba0b604f1cb2b871f",
  "src/invariants.js": "b6c9f4903b907238567c49c18134d79fa0f45d76"
});
export const STRATEGY_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerFranchises } from './routes/franchises.js';\nimport { register as registerIntelForecasts } from './routes/intelforecasts.js';\nimport { register as registerLogisticsCoverage } from './routes/logisticscoverage.js';\nimport { register as registerStrategyLicenses } from './routes/strategylicenses.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerFranchises } from './routes/franchises.js';\nimport { register as registerIntelForecasts } from './routes/intelforecasts.js';\nimport { register as registerLogisticsCoverage } from './routes/logisticscoverage.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerFranchises(app, { pool, auth });\n  registerIntelForecasts(app, { pool, auth });\n  registerLogisticsCoverage(app, { pool, auth });\n  registerStrategyLicenses(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerFranchises(app, { pool, auth });\n  registerIntelForecasts(app, { pool, auth });\n  registerLogisticsCoverage(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "// row with a reason outside the known vocabulary — is an alert.\nimport crypto from 'node:crypto';\nimport { logisticsCoverageFaults } from './logisticscoverageinvariants.js';\nimport { strategyLicenseFaults } from './strategylicenseinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "// row with a reason outside the known vocabulary — is an alert.\nimport crypto from 'node:crypto';\nimport { logisticsCoverageFaults } from './logisticscoverageinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "    // the pool and proven a redistribution by `exchange pool backed` (paid <= funded) in exchange.js.\n    // `window:` not `exchange:` — the M3 cb/ammo barter board already owns that prefix.\n    'window:',\n    'gang:contract', 'bodyguard:', 'territory:', 'business:', 'depot:', 'warehouse:rent', 'coverage:reserve:', 'coverage:premium:', 'coverage:claim:', 'coverage:refund:', 'strategy:buy:', 'strategy:sell:', 'pilot:capital', 'path:', 'casino:', 'convoy:', 'market:', 'underworld:',\n    'law:', 'world:', 'pen:', 'loan:', 'speakeasy:', 'boxing:', 'race:', 'port:', 'stable:', 'family:',\n    // FIVE PILLARS: `sov:` — pure treasury sinks (build/upgrade/upkeep/siege, gang-level, no faucet);\n    // `campaign:` — the authored-chain reward, a once-per-street-per-chain character_id'd faucet\n",
      "baseline": "    // the pool and proven a redistribution by `exchange pool backed` (paid <= funded) in exchange.js.\n    // `window:` not `exchange:` — the M3 cb/ammo barter board already owns that prefix.\n    'window:',\n    'gang:contract', 'bodyguard:', 'territory:', 'business:', 'depot:', 'warehouse:rent', 'coverage:reserve:', 'coverage:premium:', 'coverage:claim:', 'coverage:refund:', 'pilot:capital', 'path:', 'casino:', 'convoy:', 'market:', 'underworld:',\n    'law:', 'world:', 'pen:', 'loan:', 'speakeasy:', 'boxing:', 'race:', 'port:', 'stable:', 'family:',\n    // FIVE PILLARS: `sov:` — pure treasury sinks (build/upgrade/upkeep/siege, gang-level, no faucet);\n    // `campaign:` — the authored-chain reward, a once-per-street-per-chain character_id'd faucet\n"
    },
    {
      "current": "  const coverageEscrow = await one(pool, 'SELECT COALESCE(SUM(escrow_cash),0) s FROM logistics_coverage_policies');\n  push('logistics coverage escrow', coverageEscrow, -(await sum(pool, \"currency='cash' AND reason LIKE 'coverage:%'\")), 0);\n  push('logistics coverage bindings', await logisticsCoverageFaults(pool), 0, 0);\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n\n  // (f4) LOAN ESCROW (loan sharking): an OPEN offer holds the principal in escrow (the bounty-escrow\n  // twin). escrow == offered − taken (escrow → borrower) − refunded (cancel/expiry) − deathBurned.\n",
      "baseline": "  const coverageEscrow = await one(pool, 'SELECT COALESCE(SUM(escrow_cash),0) s FROM logistics_coverage_policies');\n  push('logistics coverage escrow', coverageEscrow, -(await sum(pool, \"currency='cash' AND reason LIKE 'coverage:%'\")), 0);\n  push('logistics coverage bindings', await logisticsCoverageFaults(pool), 0, 0);\n\n  // (f4) LOAN ESCROW (loan sharking): an OPEN offer holds the principal in escrow (the bounty-escrow\n  // twin). escrow == offered − taken (escrow → borrower) − refunded (cancel/expiry) − deathBurned.\n"
    }
  ]
});
const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const STRATEGY_SOURCE_TRANSFER = Object.freeze({ sourceRevision: STRATEGY_SOURCE_REVIEWED_REVISION,
  predecessorRevision: STRATEGY_SOURCE_PREDECESSOR_REVISION, currentPins: STRATEGY_SOURCE_CURRENT_PINS, baselinePins: STRATEGY_SOURCE_BASELINE_PINS,
  currentBlobs: STRATEGY_SOURCE_CURRENT_BLOBS, baselineBlobs: STRATEGY_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(STRATEGY_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-strategy-source-compatibility.js', phase: 'exact source compatibility; financial activation disabled',
  scope: 'Only exact unique Git diff hunks for strategy route registration and cash invariant wiring reconstruct complete prior sources. Historical pins and qualifications remain scoped to those unchanged bytes. Strategy license payments, account consent, private access, finite rules and prospective holdout outcomes require separate current-source native proof; no historical runtime, native, deployment or financial qualification is expanded. This review-only transfer supplies no worker or activation qualification.' });

export function assertStrategySourceTransfer(file, input) {
  assert(Object.hasOwn(STRATEGY_SOURCE_CURRENT_PINS, file), 'Unknown Strategy source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, STRATEGY_SOURCE_CURRENT_PINS[file], 'Strategy source changed: ' + file);
  let baselineText = text;
  for (const chunk of STRATEGY_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Strategy source inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = STRATEGY_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Strategy source differs beyond exact reviewed hunks: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: STRATEGY_SOURCE_INVERSES[file].length,
    sourceRevision: STRATEGY_SOURCE_REVIEWED_REVISION, sourceBlob: STRATEGY_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: STRATEGY_SOURCE_PREDECESSOR_REVISION, predecessorBlob: STRATEGY_SOURCE_BASELINE_BLOBS[file],
    evidence: STRATEGY_SOURCE_TRANSFER.evidence, phase: STRATEGY_SOURCE_TRANSFER.phase, scope: STRATEGY_SOURCE_TRANSFER.scope };
}
export function qualifyStrategySource(file, input) {
  assert(Object.hasOwn(STRATEGY_SOURCE_BASELINE_PINS, file), 'Unknown Strategy source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === STRATEGY_SOURCE_BASELINE_PINS[file])
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: STRATEGY_SOURCE_PREDECESSOR_REVISION, sourceBlob: STRATEGY_SOURCE_BASELINE_BLOBS[file],
      evidence: STRATEGY_SOURCE_TRANSFER.evidence, phase: STRATEGY_SOURCE_TRANSFER.phase, scope: STRATEGY_SOURCE_TRANSFER.scope };
  return assertStrategySourceTransfer(file, text);
}

// Compose only the exact current strategy blob. Earlier revisions and unknown
// bytes still reach the existing closed historical guard unchanged.
export function strategySourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(STRATEGY_SOURCE_CURRENT_PINS, file) && hash(text) === STRATEGY_SOURCE_CURRENT_PINS[file]
    ? qualifyStrategySource(file, text).baselineText : text;
}
