import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION = '1d49ba542f98ac7aff8c171ea0d307e5e7609fa6';
export const COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION = '727df2f02b2d0e5031b4c5a4516144de67aba0a8';
export const COMPANY_OPERATOR_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "b14c214336686192ab44fa84a1aec991b628ec551fcec129f8f584238b4a1068",
  "src/worker.js": "0b854f2da5f8e118408fac5c6570b4d64de5a9c854d2b06a1f47dcb6d57aec1a"
});
export const COMPANY_OPERATOR_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "8cc6baca8f1c019bb507afb45d1f62838749e0208d4d61bb05b23d28ebc84b55",
  "src/worker.js": "fd3acb85be133917dd933cd74acd112452aacddd6de5f59f2c98c6fca414d51c"
});
export const COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "e0786401d991101ed47d949747b8603b512ec882",
  "src/worker.js": "c0281af8d4bc0101b805e082e5f0a3a04b7a4517"
});
export const COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "c90f24dcea1a29e5ca257ae3ec365f8b022785f5",
  "src/worker.js": "f0c808dc5e48364e2286b1ce1a2670b77ba85192"
});
export const COMPANY_OPERATOR_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerCompanySuccession } from './routes/companysuccession.js';\nimport { register as registerMarketFeed } from './routes/marketfeed.js';\nimport { register as registerStrategyLeagues } from './routes/strategyleagues.js';\nimport { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerCompanySuccession } from './routes/companysuccession.js';\nimport { register as registerMarketFeed } from './routes/marketfeed.js';\nimport { register as registerStrategyLeagues } from './routes/strategyleagues.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerCompanySuccession(app, { pool, auth });\n  registerMarketFeed(app, { pool });\n  registerStrategyLeagues(app, { pool, auth });\n  registerCompanyOperators(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerCompanySuccession(app, { pool, auth });\n  registerMarketFeed(app, { pool });\n  registerStrategyLeagues(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/worker.js": [
    {
      "current": "import { sweepDispatch } from './dispatch.js';\nimport { spawnNpcConvoys, despawnArrivedNpc, sweepConvoyHauls } from './convoy.js';\nimport { runPopulation, runResidentBehaviour } from './population.js';\nimport { runCompanyOperators } from './companyoperatorrunner.js';\nimport { sweepLaw } from './law.js';\nimport { sweepLoans } from './loans.js';\nimport { sweepAuctions, sweepConsignments } from './auction.js';\n",
      "baseline": "import { sweepDispatch } from './dispatch.js';\nimport { spawnNpcConvoys, despawnArrivedNpc, sweepConvoyHauls } from './convoy.js';\nimport { runPopulation, runResidentBehaviour } from './population.js';\nimport { sweepLaw } from './law.js';\nimport { sweepLoans } from './loans.js';\nimport { sweepAuctions, sweepConsignments } from './auction.js';\n"
    },
    {
      "current": "  // through the in-flight guard's own warning above. The health clock hoists for the same reason.\n  setInterval(guardedTick, 3600 * 1000);\n\n  // Owner-consented game operations have their own bounded clock, independent\n  // of network/RPC work on the hourly tick. Register before its first invocation.\n  let companyTicking = false;\n  const guardedCompanyTick = async () => {\n    if (companyTicking) return;\n    companyTicking = true;\n    try { await safe('company operators', () => runCompanyOperators(pool, 20)); }\n    finally { companyTicking = false; }\n  };\n  setInterval(guardedCompanyTick, 30000);\n  void guardedCompanyTick();\n\n  // H1 operational health is its own fixed five-minute clock. JavaScript time chooses only when to\n  // wake; sweepRwaHealth derives every authoritative slot/timestamp from PostgreSQL. Recomputing the\n  // next wall boundary after each run avoids completion-relative drift, and the local guard prevents\n",
      "baseline": "  // through the in-flight guard's own warning above. The health clock hoists for the same reason.\n  setInterval(guardedTick, 3600 * 1000);\n\n  // H1 operational health is its own fixed five-minute clock. JavaScript time chooses only when to\n  // wake; sweepRwaHealth derives every authoritative slot/timestamp from PostgreSQL. Recomputing the\n  // next wall boundary after each run avoids completion-relative drift, and the local guard prevents\n"
    }
  ]
});

export const COMPANY_OPERATOR_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION,
  predecessorRevision: COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION,
  currentPins: COMPANY_OPERATOR_SOURCE_CURRENT_PINS, baselinePins: COMPANY_OPERATOR_SOURCE_BASELINE_PINS,
  currentBlobs: COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS, baselineBlobs: COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(COMPANY_OPERATOR_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-company-operator-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: 'Only complete frozen server and worker Git blobs and exact unique operator import/registration plus independent bounded 30-second scheduler hunks reconstruct the complete 727 predecessor. Historical League/Home/Feed/Succession and older guards transfer only for those unchanged bytes. Owner consent, account/depot replay identity, runner authority, cadence, concurrency and recovery require separate current-source operator proofs. This adapter adds no world-soak, native, financial, deployment or onchain qualification.'
});
export function assertCompanyOperatorSourceTransfer(file, input) {
  assert(Object.hasOwn(COMPANY_OPERATOR_SOURCE_CURRENT_PINS, file), 'Unknown Company Operator source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, COMPANY_OPERATOR_SOURCE_CURRENT_PINS[file], 'Company Operator source changed: ' + file);
  assert.equal(blob(text), COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS[file], 'Company Operator full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of COMPANY_OPERATOR_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Company Operator inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = COMPANY_OPERATOR_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Company Operator source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file], 'Company Operator complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: COMPANY_OPERATOR_SOURCE_INVERSES[file].length,
    sourceRevision: COMPANY_OPERATOR_SOURCE_REVIEWED_REVISION, sourceBlob: COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION, predecessorBlob: COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file],
    evidence: COMPANY_OPERATOR_SOURCE_TRANSFER.evidence, phase: COMPANY_OPERATOR_SOURCE_TRANSFER.phase, scope: COMPANY_OPERATOR_SOURCE_TRANSFER.scope };
}
export function qualifyCompanyOperatorSource(file, input) {
  assert(Object.hasOwn(COMPANY_OPERATOR_SOURCE_BASELINE_PINS, file), 'Unknown Company Operator source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === COMPANY_OPERATOR_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file], 'Company Operator complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: COMPANY_OPERATOR_SOURCE_PREDECESSOR_REVISION, sourceBlob: COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS[file],
      evidence: COMPANY_OPERATOR_SOURCE_TRANSFER.evidence, phase: COMPANY_OPERATOR_SOURCE_TRANSFER.phase, scope: COMPANY_OPERATOR_SOURCE_TRANSFER.scope };
  }
  return assertCompanyOperatorSourceTransfer(file, text);
}
// Unknown bytes pass through unchanged to closed historical guards; never strip by pattern.
export function companyOperatorSourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(COMPANY_OPERATOR_SOURCE_CURRENT_PINS, file) && hash(text) === COMPANY_OPERATOR_SOURCE_CURRENT_PINS[file]
    ? assertCompanyOperatorSourceTransfer(file, text).baselineText : text;
}
