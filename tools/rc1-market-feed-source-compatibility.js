import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const MARKET_FEED_SOURCE_REVIEWED_REVISION = "eb4fdfbdf911b560ab927da9ef54b74f8ebb0fec";
export const MARKET_FEED_SOURCE_PREDECESSOR_REVISION = "f07f6eec06f6356fcb93850de52d90794a04ed28";
export const MARKET_FEED_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "f19a8c9855b07acbfb220ab5e510f1bb51ba18cd34ea5754d06c6a7791505a05"
});
export const MARKET_FEED_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "5dd7006ef19f6e05ead2371d70428dd758ec7d39d908ea0324fb36daedc1a100"
});
export const MARKET_FEED_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "5b1d2b43ffac10930625c914ecc638de64506453"
});
export const MARKET_FEED_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "b7a754a7c11af484d884fd7dd35e7b99b5e0de8a"
});
export const MARKET_FEED_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerLogisticsCoverage } from './routes/logisticscoverage.js';\nimport { register as registerStrategyLicenses } from './routes/strategylicenses.js';\nimport { register as registerCompanySuccession } from './routes/companysuccession.js';\nimport { register as registerMarketFeed } from './routes/marketfeed.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerLogisticsCoverage } from './routes/logisticscoverage.js';\nimport { register as registerStrategyLicenses } from './routes/strategylicenses.js';\nimport { register as registerCompanySuccession } from './routes/companysuccession.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerLogisticsCoverage(app, { pool, auth });\n  registerStrategyLicenses(app, { pool, auth });\n  registerCompanySuccession(app, { pool, auth });\n  registerMarketFeed(app, { pool });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerLogisticsCoverage(app, { pool, auth });\n  registerStrategyLicenses(app, { pool, auth });\n  registerCompanySuccession(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ]
});
const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const MARKET_FEED_SOURCE_TRANSFER = Object.freeze({ sourceRevision: MARKET_FEED_SOURCE_REVIEWED_REVISION,
  predecessorRevision: MARKET_FEED_SOURCE_PREDECESSOR_REVISION, currentPins: MARKET_FEED_SOURCE_CURRENT_PINS, baselinePins: MARKET_FEED_SOURCE_BASELINE_PINS,
  currentBlobs: MARKET_FEED_SOURCE_CURRENT_BLOBS, baselineBlobs: MARKET_FEED_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(MARKET_FEED_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-market-feed-source-compatibility.js', phase: 'exact source compatibility; financial activation disabled',
  sourceReview: 'docs/market-feed-security-review.md',
  scope: 'Only exact unique Git diff hunks for public market feed route registration reconstruct complete predecessor sources, preserving the already reviewed company succession, strategy and coverage integrations. Historical pins and qualifications remain scoped to unchanged predecessor bytes. Public projection privacy, digest provenance and single-block capture require separate current-source native proof; no historical runtime, native, deployment or financial qualification is expanded. This review-only transfer supplies no worker or activation qualification.' });

export function assertMarketFeedSourceTransfer(file, input) {
  assert(Object.hasOwn(MARKET_FEED_SOURCE_CURRENT_PINS, file), 'Unknown Market Feed source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, MARKET_FEED_SOURCE_CURRENT_PINS[file], 'Market Feed source changed: ' + file);
  let baselineText = text;
  for (const chunk of MARKET_FEED_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Market Feed source inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = MARKET_FEED_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Market Feed source differs beyond exact reviewed hunks: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: MARKET_FEED_SOURCE_INVERSES[file].length,
    sourceRevision: MARKET_FEED_SOURCE_REVIEWED_REVISION, sourceBlob: MARKET_FEED_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: MARKET_FEED_SOURCE_PREDECESSOR_REVISION, predecessorBlob: MARKET_FEED_SOURCE_BASELINE_BLOBS[file],
    evidence: MARKET_FEED_SOURCE_TRANSFER.evidence, phase: MARKET_FEED_SOURCE_TRANSFER.phase, scope: MARKET_FEED_SOURCE_TRANSFER.scope };
}
export function qualifyMarketFeedSource(file, input) {
  assert(Object.hasOwn(MARKET_FEED_SOURCE_BASELINE_PINS, file), 'Unknown Market Feed source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === MARKET_FEED_SOURCE_BASELINE_PINS[file])
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: MARKET_FEED_SOURCE_PREDECESSOR_REVISION, sourceBlob: MARKET_FEED_SOURCE_BASELINE_BLOBS[file],
      evidence: MARKET_FEED_SOURCE_TRANSFER.evidence, phase: MARKET_FEED_SOURCE_TRANSFER.phase, scope: MARKET_FEED_SOURCE_TRANSFER.scope };
  return assertMarketFeedSourceTransfer(file, text);
}

// Compose only the exact current market feed blob. Earlier revisions and unknown
// bytes still reach the existing closed historical guard unchanged.
export function marketFeedSourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(MARKET_FEED_SOURCE_CURRENT_PINS, file) && hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS[file]
    ? qualifyMarketFeedSource(file, text).baselineText : text;
}
