import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const STRATEGY_LEAGUE_SOURCE_REVIEWED_REVISION = "8b7406dbc58b539f046f9b2a5dd7ce878b487090";
export const STRATEGY_LEAGUE_SOURCE_PREDECESSOR_REVISION = "9f6f63c4141705d46352c1cfe28ee17c024c5514";
export const STRATEGY_LEAGUE_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "3a2ab0d0f74c1ab34aed8afb87265a3c8e2196fbaa05c119d170e51c026abf3f",
  "src/invariants.js": "842de0a3927272aace7a262d56159336a0576079f855ae05f7ae111521373bc2"
});
export const STRATEGY_LEAGUE_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "f19a8c9855b07acbfb220ab5e510f1bb51ba18cd34ea5754d06c6a7791505a05",
  "src/invariants.js": "49f27d61054a80ce778f6faddbc9061a9176cb06787816777f8fa7456bb96f68"
});
export const STRATEGY_LEAGUE_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "920092d78aa4ac21eee34548c1c858e4d5b4a1f1",
  "src/invariants.js": "03644c4b806b972d93d2500afd1da69c6823abbc"
});
export const STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "5b1d2b43ffac10930625c914ecc638de64506453",
  "src/invariants.js": "7904dff8586ceeb1a6899d71681442a77eff5f15"
});
export const STRATEGY_LEAGUE_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerStrategyLicenses } from './routes/strategylicenses.js';\nimport { register as registerCompanySuccession } from './routes/companysuccession.js';\nimport { register as registerMarketFeed } from './routes/marketfeed.js';\nimport { register as registerStrategyLeagues } from './routes/strategyleagues.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerStrategyLicenses } from './routes/strategylicenses.js';\nimport { register as registerCompanySuccession } from './routes/companysuccession.js';\nimport { register as registerMarketFeed } from './routes/marketfeed.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerStrategyLicenses(app, { pool, auth });\n  registerCompanySuccession(app, { pool, auth });\n  registerMarketFeed(app, { pool });\n  registerStrategyLeagues(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerStrategyLicenses(app, { pool, auth });\n  registerCompanySuccession(app, { pool, auth });\n  registerMarketFeed(app, { pool });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "import { logisticsCoverageFaults } from './logisticscoverageinvariants.js';\nimport { strategyLicenseFaults } from './strategylicenseinvariants.js';\nimport { companySuccessionFaults } from './companysuccessioninvariants.js';\nimport { strategyLeagueFaults } from './strategyleagueinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "import { logisticsCoverageFaults } from './logisticscoverageinvariants.js';\nimport { strategyLicenseFaults } from './strategylicenseinvariants.js';\nimport { companySuccessionFaults } from './companysuccessioninvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n  push('strategy league bindings', await strategyLeagueFaults(pool), 0, 0);\n\n  // (f4) LOAN ESCROW (loan sharking): an OPEN offer holds the principal in escrow (the bounty-escrow\n  // twin). escrow == offered − taken (escrow → borrower) − refunded (cancel/expiry) − deathBurned.\n",
      "baseline": "  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n\n  // (f4) LOAN ESCROW (loan sharking): an OPEN offer holds the principal in escrow (the bounty-escrow\n  // twin). escrow == offered − taken (escrow → borrower) − refunded (cancel/expiry) − deathBurned.\n"
    }
  ]
});
const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const STRATEGY_LEAGUE_SOURCE_TRANSFER = Object.freeze({ sourceRevision: STRATEGY_LEAGUE_SOURCE_REVIEWED_REVISION,
  predecessorRevision: STRATEGY_LEAGUE_SOURCE_PREDECESSOR_REVISION, currentPins: STRATEGY_LEAGUE_SOURCE_CURRENT_PINS, baselinePins: STRATEGY_LEAGUE_SOURCE_BASELINE_PINS,
  currentBlobs: STRATEGY_LEAGUE_SOURCE_CURRENT_BLOBS, baselineBlobs: STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(STRATEGY_LEAGUE_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-strategy-league-source-compatibility.js', phase: 'exact source compatibility; financial activation disabled',
  scope: 'Only exact unique Git diff hunks for league route registration and benchmark invariant wiring reconstruct complete prior sources. Historical pins and qualifications remain scoped to those unchanged bytes. Private version consent, account recovery, common prospective observation and first-sample outcomes require separate current-source native proof; no historical runtime, native, deployment or financial qualification is expanded. External prize funding remains disabled and unqualified; this review-only transfer supplies no worker or activation qualification.' });

export function assertStrategyLeagueSourceTransfer(file, input) {
  assert(Object.hasOwn(STRATEGY_LEAGUE_SOURCE_CURRENT_PINS, file), 'Unknown Strategy League source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file], 'Strategy League source changed: ' + file);
  let baselineText = text;
  for (const chunk of STRATEGY_LEAGUE_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Strategy League source inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = STRATEGY_LEAGUE_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Strategy League source differs beyond exact reviewed hunks: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: STRATEGY_LEAGUE_SOURCE_INVERSES[file].length,
    sourceRevision: STRATEGY_LEAGUE_SOURCE_REVIEWED_REVISION, sourceBlob: STRATEGY_LEAGUE_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: STRATEGY_LEAGUE_SOURCE_PREDECESSOR_REVISION, predecessorBlob: STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS[file],
    evidence: STRATEGY_LEAGUE_SOURCE_TRANSFER.evidence, phase: STRATEGY_LEAGUE_SOURCE_TRANSFER.phase, scope: STRATEGY_LEAGUE_SOURCE_TRANSFER.scope };
}
export function qualifyStrategyLeagueSource(file, input) {
  assert(Object.hasOwn(STRATEGY_LEAGUE_SOURCE_BASELINE_PINS, file), 'Unknown Strategy League source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === STRATEGY_LEAGUE_SOURCE_BASELINE_PINS[file])
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: STRATEGY_LEAGUE_SOURCE_PREDECESSOR_REVISION, sourceBlob: STRATEGY_LEAGUE_SOURCE_BASELINE_BLOBS[file],
      evidence: STRATEGY_LEAGUE_SOURCE_TRANSFER.evidence, phase: STRATEGY_LEAGUE_SOURCE_TRANSFER.phase, scope: STRATEGY_LEAGUE_SOURCE_TRANSFER.scope };
  return assertStrategyLeagueSourceTransfer(file, text);
}

// Compose only the exact current strategy league blob. Earlier revisions and unknown
// bytes still reach the existing closed historical guard unchanged.
export function strategyLeagueSourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(STRATEGY_LEAGUE_SOURCE_CURRENT_PINS, file) && hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file]
    ? qualifyStrategyLeagueSource(file, text).baselineText : text;
}
