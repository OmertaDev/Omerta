import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const COVERAGE_SOURCE_REVIEWED_REVISION = "c92d5d401f140890f91be6e58b993109082f65a8";
export const COVERAGE_SOURCE_PREDECESSOR_REVISION = "320a27836704a1ec04d7ff79a9c88e301fde1563";
export const COVERAGE_SOURCE_CURRENT_PINS = Object.freeze({
  "src/db.js": "abaa10fd7e25ff0be9c204fc6c18e300b97ba7fe32d9d8fc61654293eebf4a46",
  "src/depotbook.js": "c832e2e6a26e173336e7fe1a02a29d8a11deef1f9bfa61254ea33182310ebe60",
  "src/server.js": "61466e32e1ad34e62f61d611f655235a8bd8e5b132c43afdf7cb1674a615b9e9",
  "src/invariants.js": "25cdb23a5a102e7a1a26e6ae311b3fa92889f4f5d0fa75759846636a8ceaa0c8"
});
export const COVERAGE_SOURCE_BASELINE_PINS = Object.freeze({
  "src/db.js": "9c43ed14a026c378ec4768d39a52cc66840b63396e3b6218075cc4797bdfcd81",
  "src/depotbook.js": "98c51a8609b5a144e8c3f1e59d05151d11927fa85760898319ee9777547072ec",
  "src/server.js": "a3a4ca0ec758c6b004737ac7be2c894e4410f5adbc60f1979570b2cfd80e6e69",
  "src/invariants.js": "c9b4de1c12760e5148f03cf69ad46d59513ea2debc8b4084e39ad567c007afa9"
});
export const COVERAGE_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/db.js": "e99e39679503978ea1e79a56a1b2a2f4776b8029",
  "src/depotbook.js": "b49426bb0edb0d12b866099a703d929f370c2527",
  "src/server.js": "b5c144c986d4f80e899b56fba0b604f1cb2b871f",
  "src/invariants.js": "6de7334aeef4bb73b907c07af418c35ddc2d8ad7"
});
export const COVERAGE_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/db.js": "1e8948060d907b08382d4b5769aa0b08a647c0a1",
  "src/depotbook.js": "fb25e0ac80787efdc2497531e400cb7b59c2a4a7",
  "src/server.js": "acb31436b99a464a62754942582871f118af14da",
  "src/invariants.js": "475dbed2d6747ac0274f7d8dfbf048c55f41f235"
});
export const COVERAGE_SOURCE_INVERSES = Object.freeze({
  "src/db.js": [
    {
      "current": "// whose semantics pg-mem is known to mis-execute.\nexport const dbCaps = { skipLocked: false, indexedTextArrayAny: false };\n\n// Register only the PostgreSQL built-ins that the schema and custody journals need and pg-mem omits. Callers\n// that create a raw pg-mem database for schema tests must opt in before applying schema.sql; the\n// real-Postgres branch never calls this compatibility registrar.\nexport function registerPgMemCompatibility(mem, DataType) {\n  mem.public.registerFunction({\n    name: 'clock_timestamp', args: [], returns: DataType.timestamptz, impure: true,\n    implementation: () => new Date(),\n  });\n  mem.public.registerFunction({\n    name: 'mod', args: [DataType.bigint, DataType.integer], returns: DataType.bigint,\n    implementation: (value, divisor) => value % divisor,\n",
      "baseline": "// whose semantics pg-mem is known to mis-execute.\nexport const dbCaps = { skipLocked: false, indexedTextArrayAny: false };\n\n// Register only the PostgreSQL built-ins that H1's literal schema needs and pg-mem omits. Callers\n// that create a raw pg-mem database for schema tests must opt in before applying schema.sql; the\n// real-Postgres branch never calls this compatibility registrar.\nexport function registerPgMemCompatibility(mem, DataType) {\n  mem.public.registerFunction({\n    name: 'mod', args: [DataType.bigint, DataType.integer], returns: DataType.bigint,\n    implementation: (value, divisor) => value % divisor,\n"
    }
  ],
  "src/depotbook.js": [
    {
      "current": "  const leaseSequence = leaseId ? Number((await client.query(\n    'SELECT MAX(lease_sequence) sequence FROM business_depot_journal WHERE lease_id=$1', [leaseId])).rows[0].sequence || 0) + 1 : null;\n  const journalId = crypto.randomUUID();\n  await client.query(\"INSERT INTO business_depot_journal (id,depot_id,reason,cash_delta,stock_delta,cost_delta,expense,order_id,policy_id,customer_character,stock_after,lease_id,lease_stock_delta,lease_stock_after,warehouse_rent_lease_id,lease_sequence,source_journal_id,franchise_license_id,event_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,CASE WHEN $3='warehouse_tenant_death' THEN clock_timestamp() ELSE NULL END)\",\n    [journalId, row.id, reason, cash, stock, cost, expense, orderId, policyId, customerId, next.stock,\n      leaseId, leaseStock, leaseStockAfter, reason === 'warehouse_rent' ? leaseId : null, leaseSequence, sourceJournalId, franchiseLicenseId]);\n  row.treasury = next.cash; row.stock = next.stock; row.stock_cost = next.cost;\n",
      "baseline": "  const leaseSequence = leaseId ? Number((await client.query(\n    'SELECT MAX(lease_sequence) sequence FROM business_depot_journal WHERE lease_id=$1', [leaseId])).rows[0].sequence || 0) + 1 : null;\n  const journalId = crypto.randomUUID();\n  await client.query('INSERT INTO business_depot_journal (id,depot_id,reason,cash_delta,stock_delta,cost_delta,expense,order_id,policy_id,customer_character,stock_after,lease_id,lease_stock_delta,lease_stock_after,warehouse_rent_lease_id,lease_sequence,source_journal_id,franchise_license_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',\n    [journalId, row.id, reason, cash, stock, cost, expense, orderId, policyId, customerId, next.stock,\n      leaseId, leaseStock, leaseStockAfter, reason === 'warehouse_rent' ? leaseId : null, leaseSequence, sourceJournalId, franchiseLicenseId]);\n  row.treasury = next.cash; row.stock = next.stock; row.stock_cost = next.cost;\n"
    }
  ],
  "src/server.js": [
    {
      "current": "import { register as registerCrewLogistics } from './routes/crewlogistics.js';\nimport { register as registerFranchises } from './routes/franchises.js';\nimport { register as registerIntelForecasts } from './routes/intelforecasts.js';\nimport { register as registerLogisticsCoverage } from './routes/logisticscoverage.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerCrewLogistics } from './routes/crewlogistics.js';\nimport { register as registerFranchises } from './routes/franchises.js';\nimport { register as registerIntelForecasts } from './routes/intelforecasts.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerCrewLogistics(app, { pool, auth });\n  registerFranchises(app, { pool, auth });\n  registerIntelForecasts(app, { pool, auth });\n  registerLogisticsCoverage(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerCrewLogistics(app, { pool, auth });\n  registerFranchises(app, { pool, auth });\n  registerIntelForecasts(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "// in the transactions ledger. Any drift beyond $1 (or one unit) — or any ledger\n// row with a reason outside the known vocabulary — is an alert.\nimport crypto from 'node:crypto';\nimport { logisticsCoverageFaults } from './logisticscoverageinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "// in the transactions ledger. Any drift beyond $1 (or one unit) — or any ledger\n// row with a reason outside the known vocabulary — is an alert.\nimport crypto from 'node:crypto';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "    // the pool and proven a redistribution by `exchange pool backed` (paid <= funded) in exchange.js.\n    // `window:` not `exchange:` — the M3 cb/ammo barter board already owns that prefix.\n    'window:',\n    'gang:contract', 'bodyguard:', 'territory:', 'business:', 'depot:', 'warehouse:rent', 'coverage:reserve:', 'coverage:premium:', 'coverage:claim:', 'coverage:refund:', 'pilot:capital', 'path:', 'casino:', 'convoy:', 'market:', 'underworld:',\n    'law:', 'world:', 'pen:', 'loan:', 'speakeasy:', 'boxing:', 'race:', 'port:', 'stable:', 'family:',\n    // FIVE PILLARS: `sov:` — pure treasury sinks (build/upgrade/upkeep/siege, gang-level, no faucet);\n    // `campaign:` — the authored-chain reward, a once-per-street-per-chain character_id'd faucet\n",
      "baseline": "    // the pool and proven a redistribution by `exchange pool backed` (paid <= funded) in exchange.js.\n    // `window:` not `exchange:` — the M3 cb/ammo barter board already owns that prefix.\n    'window:',\n    'gang:contract', 'bodyguard:', 'territory:', 'business:', 'depot:', 'warehouse:rent', 'pilot:capital', 'path:', 'casino:', 'convoy:', 'market:', 'underworld:',\n    'law:', 'world:', 'pen:', 'loan:', 'speakeasy:', 'boxing:', 'race:', 'port:', 'stable:', 'family:',\n    // FIVE PILLARS: `sov:` — pure treasury sinks (build/upgrade/upkeep/siege, gang-level, no faucet);\n    // `campaign:` — the authored-chain reward, a once-per-street-per-chain character_id'd faucet\n"
    },
    {
      "current": "    push(`operating policy budget:${policy.id}`, Math.max(0, Number(policy.spent) - Number(policy.max_spend)), 0, 0);\n  }\n\n  push('logistics coverage escrow', await logisticsCoverageFaults(pool), 0, 0);\n\n  // (f4) LOAN ESCROW (loan sharking): an OPEN offer holds the principal in escrow (the bounty-escrow\n  // twin). escrow == offered − taken (escrow → borrower) − refunded (cancel/expiry) − deathBurned.\n  // repay/collect are transfers (character rows, in check (a)); the vig is the only value that LEAVES\n",
      "baseline": "    push(`operating policy budget:${policy.id}`, Math.max(0, Number(policy.spent) - Number(policy.max_spend)), 0, 0);\n  }\n\n  // (f4) LOAN ESCROW (loan sharking): an OPEN offer holds the principal in escrow (the bounty-escrow\n  // twin). escrow == offered − taken (escrow → borrower) − refunded (cancel/expiry) − deathBurned.\n  // repay/collect are transfers (character rows, in check (a)); the vig is the only value that LEAVES\n"
    }
  ]
});
const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const COVERAGE_SOURCE_TRANSFER = Object.freeze({ sourceRevision: COVERAGE_SOURCE_REVIEWED_REVISION,
  predecessorRevision: COVERAGE_SOURCE_PREDECESSOR_REVISION, currentPins: COVERAGE_SOURCE_CURRENT_PINS, baselinePins: COVERAGE_SOURCE_BASELINE_PINS,
  currentBlobs: COVERAGE_SOURCE_CURRENT_BLOBS, baselineBlobs: COVERAGE_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(COVERAGE_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-logistics-coverage-source-compatibility.js', phase: 'exact source compatibility; financial activation disabled',
  scope: 'Only exact unique Git diff hunks for the compatibility clock built-in, post-lock warehouse journal clock, route registration and coverage invariant wiring reconstruct complete prior sources. Historical pins and qualifications remain scoped to those unchanged bytes. Coverage reserve, consent, accounting, event clocks and account recovery require separate current-source native proof; no historical runtime, native, deployment or financial qualification is expanded. This review-only transfer supplies no worker or activation qualification.' });

export function assertCoverageSourceTransfer(file, input) {
  assert(Object.hasOwn(COVERAGE_SOURCE_CURRENT_PINS, file), 'Unknown Coverage source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, COVERAGE_SOURCE_CURRENT_PINS[file], 'Coverage source changed: ' + file);
  let baselineText = text;
  for (const chunk of COVERAGE_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Coverage source inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = COVERAGE_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Coverage source differs beyond exact reviewed hunks: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: COVERAGE_SOURCE_INVERSES[file].length,
    sourceRevision: COVERAGE_SOURCE_REVIEWED_REVISION, sourceBlob: COVERAGE_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: COVERAGE_SOURCE_PREDECESSOR_REVISION, predecessorBlob: COVERAGE_SOURCE_BASELINE_BLOBS[file],
    evidence: COVERAGE_SOURCE_TRANSFER.evidence, phase: COVERAGE_SOURCE_TRANSFER.phase, scope: COVERAGE_SOURCE_TRANSFER.scope };
}
export function qualifyCoverageSource(file, input) {
  assert(Object.hasOwn(COVERAGE_SOURCE_BASELINE_PINS, file), 'Unknown Coverage source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === COVERAGE_SOURCE_BASELINE_PINS[file])
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: COVERAGE_SOURCE_PREDECESSOR_REVISION, sourceBlob: COVERAGE_SOURCE_BASELINE_BLOBS[file],
      evidence: COVERAGE_SOURCE_TRANSFER.evidence, phase: COVERAGE_SOURCE_TRANSFER.phase, scope: COVERAGE_SOURCE_TRANSFER.scope };
  return assertCoverageSourceTransfer(file, text);
}

// Compose only the exact current coverage blob. Earlier revisions and unknown
// bytes still reach the existing closed historical guard unchanged.
export function coverageSourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(COVERAGE_SOURCE_CURRENT_PINS, file) && hash(text) === COVERAGE_SOURCE_CURRENT_PINS[file]
    ? qualifyCoverageSource(file, text).baselineText : text;
}
