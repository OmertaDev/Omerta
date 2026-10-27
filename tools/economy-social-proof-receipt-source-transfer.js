// Generated exact source-only envelope for the social-proof receipt retention repair.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const ECONOMY_SOCIAL_RECEIPT_REVISION = "5318589c8e8fd7fa64e6e714e6f69111fb0dca0a";
export const ECONOMY_SOCIAL_RECEIPT_TREE = "e8e101ced146970e50de67daf6d20aa18d247674";
export const ECONOMY_SOCIAL_RECEIPT_PREDECESSOR = "011930200e9f4266d92b7a8f77646013d96b697b";
export const ECONOMY_SOCIAL_RECEIPT_PREDECESSOR_TREE = "c93de09b0c1aa13ddc05159b429a20c7bd3f1098";
export const ECONOMY_SOCIAL_RECEIPT_PHASE = 'exact-social-proof-receipt-retention-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_SOCIAL_RECEIPT_DOMAINS = {
  "src/db.js": {
    "mode": "100644",
    "currentSha256": "b4d3342961d6b61f533a4c210a13e475c853b701068d0e71af498ceaf5dcb51b",
    "currentBlob": "1b9cf4ce26d46f0d5efb4b54d1880a0078867920",
    "currentBytes": 80563,
    "baselineSha256": "e496deb018d9f8073172e4a0149ac5fd86f913741ceb2908f39aff3b39859f14",
    "baselineBlob": "5e9913bd0e358b20a0cfefa23b861b4db52969a3",
    "baselineBytes": 79823,
    "contextLines": 3,
    "inverses": [
      {
        "current": "    const migrationId = 'social-proof-receipts-2026-10-23';\n    const alreadyApplied = (await q.query(\n      'SELECT 1 FROM economy_migrations WHERE id=$1', [migrationId])).rowCount > 0;\n    // R4 repeated only a two-day telemetry tail after this marker existed. Paid claim rows live for\n    // seven days, so a predecessor payout followed by a delayed restart could be swept before the\n    // tail saw it. R5 consumes the full retained telemetry history once; the receipt-aware sweep in\n    // growth.js closes the deletion side of the gap for every later payout.\n    const retentionRepairId = 'social-proof-receipt-retention-2026-10-27';\n    const retentionRepairApplied = (await q.query(\n      'SELECT 1 FROM economy_migrations WHERE id=$1', [retentionRepairId])).rowCount > 0;\n    const claimRows = (await q.query(\n      'SELECT DISTINCT proof FROM social_claims WHERE paid AND proof IS NOT NULL')).rows;\n    // Paid rows are intentionally swept after seven days, but their same-transaction social_task\n    // telemetry survives for 180 days. The first upgrade consumes that retained payout evidence too;\n    // later boots need only the cutover window because the durable receipts now cover older proofs.\n    const telemetryRows = alreadyApplied && retentionRepairApplied ? (await q.query(\n      \"SELECT props FROM telemetry WHERE event='social_task' AND at >= $1\",\n      [new Date(Date.now() - 2 * 86400000)])).rows : (await q.query(\n      \"SELECT props FROM telemetry WHERE event='social_task'\")).rows;\n",
        "baseline": "    const migrationId = 'social-proof-receipts-2026-10-23';\n    const alreadyApplied = (await q.query(\n      'SELECT 1 FROM economy_migrations WHERE id=$1', [migrationId])).rowCount > 0;\n    const claimRows = (await q.query(\n      'SELECT DISTINCT proof FROM social_claims WHERE paid AND proof IS NOT NULL')).rows;\n    // Paid rows are intentionally swept after seven days, but their same-transaction social_task\n    // telemetry survives for 180 days. The first upgrade consumes that retained payout evidence too;\n    // later boots need only the cutover window because the durable receipts now cover older proofs.\n    const telemetryRows = alreadyApplied ? (await q.query(\n      \"SELECT props FROM telemetry WHERE event='social_task' AND at >= $1\",\n      [new Date(Date.now() - 2 * 86400000)])).rows : (await q.query(\n      \"SELECT props FROM telemetry WHERE event='social_task'\")).rows;\n"
      },
      {
        "current": "    for (const accountId of receiptAccounts)\n      if (await takeAccountDailyClaim(q, accountId, 0, 'social-proof', 'used')) inserted++;\n    await q.query('INSERT INTO economy_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', [migrationId]);\n    await q.query('INSERT INTO economy_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING',\n      [retentionRepairId]);\n    await q.query('COMMIT');\n    return { applied: !alreadyApplied, scanned: proofs.length, canonical: receiptAccounts.size, inserted };\n  } catch (error) {\n",
        "baseline": "    for (const accountId of receiptAccounts)\n      if (await takeAccountDailyClaim(q, accountId, 0, 'social-proof', 'used')) inserted++;\n    await q.query('INSERT INTO economy_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING', [migrationId]);\n    await q.query('COMMIT');\n    return { applied: !alreadyApplied, scanned: proofs.length, canonical: receiptAccounts.size, inserted };\n  } catch (error) {\n"
      }
    ]
  },
  "src/growth.js": {
    "mode": "100644",
    "currentSha256": "ca36617afe5b50362bc30959518f5094d77c64ab5a448cedb0c112a61bf04b77",
    "currentBlob": "71dccf65c7cccb831261b62a8a5a04afda10e00c",
    "currentBytes": 82891,
    "baselineSha256": "51f30dd2f9f7f6d6594bf3649ecc6a583606fe223df12747c9222e450ea16292",
    "baselineBlob": "a84ff062d4221f94fbc68005aa6b9bd59e7e25ad",
    "baselineBytes": 81734,
    "contextLines": 3,
    "inverses": [
      {
        "current": "import { accountDailyClaimRows, resolvedBoundedClaimIds, takeAccountDailyClaim,\n  takeBoundedAccountDailyClaim } from './accountdaily.js';\nimport { dbCaps } from './db.js';\nimport { normalizeLegacyPaidSocialPostProof } from './socialproof.js';\n\n\n// ── PATHS (§5.1): first pick $10,000 at level ≥5; switching burns PATH_SWITCH_OMR ──\n",
        "baseline": "import { accountDailyClaimRows, resolvedBoundedClaimIds, takeAccountDailyClaim,\n  takeBoundedAccountDailyClaim } from './accountdaily.js';\nimport { dbCaps } from './db.js';\n\n\n// ── PATHS (§5.1): first pick $10,000 at level ≥5; switching burns PATH_SWITCH_OMR ──\n"
      },
      {
        "current": "export async function sweepSocialClaims(pool) {\n  const paidCut = new Date(Date.now() - 7 * 24 * 3600000);\n  const pendCut = new Date(Date.now() - SOCIAL_PENDING_TTL);\n  const client = await pool.connect();\n  try {\n    await client.query('BEGIN');\n    // A predecessor process can commit a paid proof without the permanent provider/id latch. Never\n    // delete that last row of evidence first: reserve the idempotent receipt in the same transaction,\n    // then prune. Current-format payouts already own the receipt, so their inserts are clean no-ops.\n    const paidRows = (await client.query(\n      `SELECT account_id, day, task_id, proof FROM social_claims\n        WHERE paid AND posted_at < $1 AND proof IS NOT NULL\n        ORDER BY account_id, day, task_id FOR UPDATE`, [paidCut])).rows;\n    for (const row of paidRows) {\n      const normalized = normalizeLegacyPaidSocialPostProof(row.proof);\n      if (normalized)\n        await takeAccountDailyClaim(client, socialProofReceiptAccount(normalized), SOCIAL_PROOF_EPOCH,\n          SOCIAL_PROOF_SCOPE, SOCIAL_PROOF_CLAIM);\n    }\n    const r = await client.query(\n      'DELETE FROM social_claims WHERE (paid AND posted_at < $1) OR (NOT paid AND posted_at < $2)',\n      [paidCut, pendCut]);\n    await client.query('COMMIT');\n    return { swept: r.rowCount || 0 };\n  } catch (error) {\n    await client.query('ROLLBACK').catch(() => {});\n    throw error;\n  } finally {\n    client.release();\n  }\n}\n\n// WALLET LINK is SIWE now — see chain.js walletChallenge/walletVerify. The legacy\n",
        "baseline": "export async function sweepSocialClaims(pool) {\n  const paidCut = new Date(Date.now() - 7 * 24 * 3600000);\n  const pendCut = new Date(Date.now() - SOCIAL_PENDING_TTL);\n  const r = await pool.query(\n    'DELETE FROM social_claims WHERE (paid AND posted_at < $1) OR (NOT paid AND posted_at < $2)',\n    [paidCut, pendCut]);\n  return { swept: r.rowCount || 0 };\n}\n\n// WALLET LINK is SIWE now — see chain.js walletChallenge/walletVerify. The legacy\n"
      }
    ]
  },
  "test/growth.js": {
    "mode": "100644",
    "currentSha256": "c7776b569d617f8d39e72c78ff951f74dd0d369184642a250afbbef8f399c964",
    "currentBlob": "3e728a10d6e0f5ef6c85b9252273d20575658eaa",
    "currentBytes": 203989,
    "baselineSha256": "8051ccb38b62961ebf82e185dfcd048c6388740de69acb210151efcbd639d674",
    "baselineBlob": "f4798a3377031edfc09af0fbe31f3f696899e77f",
    "baselineBytes": 202164,
    "contextLines": 3,
    "inverses": [
      {
        "current": "    assert.equal((await migrateSocialProofReceipts(pool)).inserted, 0,\n      'reapplying the historical receipt repair after cutover is idempotent');\n\n    // R5 retention repair: R4's repeat pass read only two telemetry days after its marker existed,\n    // while paid claim rows were swept at day seven. Model an R4-era sweep that already removed the\n    // row; the new one-time full retained-history pass must still recover the permanent proof latch.\n    const delayedProof = 'https://x.com/legacy/status/00012345678901246';\n    const delayedAt = new Date(Date.now() - 8 * 86400000);\n    await pool.query(\"DELETE FROM economy_migrations WHERE id='social-proof-receipt-retention-2026-10-27'\");\n    await pool.query(\n      `INSERT INTO telemetry (id, at, account_id, event, props) VALUES\n       ('legacy-social-proof-retention-gap',$1,$2,'social_task',$3)`,\n      [delayedAt, legacy.accountId, JSON.stringify({ task: 'sw_post', proof: delayedProof })]);\n    await pool.query(\n      `INSERT INTO social_claims (account_id, day, task_id, posted_at, paid, proof)\n       VALUES ($1,$2,'sw_boost',$3,true,$4)`,\n      [legacy.accountId, legacyDay - 7, delayedAt, delayedProof]);\n    await pool.query('DELETE FROM social_claims WHERE account_id=$1 AND day=$2 AND task_id=$3',\n      [legacy.accountId, legacyDay - 7, 'sw_boost']); // predecessor sweep, before receipt-aware R5\n    assert.equal((await migrateSocialProofReceipts(pool)).inserted, 1,\n      'the retention repair recovers a predecessor payout after its seven-day claim row was swept');\n    assert.equal(Number((await pool.query(\n      `SELECT COUNT(*) n FROM account_daily_claims\n        WHERE account_id=$1 AND day=0 AND scope='social-proof' AND claim_id='used'`,\n      ['social-proof:x:12345678901246'])).rows[0].n), 1,\n    'the delayed predecessor proof is permanently spent');\n    assert.equal((await migrateSocialProofReceipts(pool)).inserted, 0,\n      'the retention catch-up marker and receipt are idempotent');\n\n    const legacyReuser = await mk('Legacy Proof Reuser');\n    await pool.query(\"UPDATE accounts SET auth_provider='x', auth_subject='778' WHERE id=$1\", [legacyReuser.accountId]);\n    assert.equal((await call('POST', '/v1/social/sw_post/claim', { token: legacyReuser.token,\n",
        "baseline": "    assert.equal((await migrateSocialProofReceipts(pool)).inserted, 0,\n      'reapplying the historical receipt repair after cutover is idempotent');\n\n    const legacyReuser = await mk('Legacy Proof Reuser');\n    await pool.query(\"UPDATE accounts SET auth_provider='x', auth_subject='778' WHERE id=$1\", [legacyReuser.accountId]);\n    assert.equal((await call('POST', '/v1/social/sw_post/claim', { token: legacyReuser.token,\n"
      }
    ]
  },
  "test/sweeps.js": {
    "mode": "100644",
    "currentSha256": "749136b4d1277cd7a8cbcd64d3196048dfe205c537f42a47ee5b097e653831be",
    "currentBlob": "8a90a1d529bdbf2205510fa3c5ba6a3f5edcdb5e",
    "currentBytes": 30865,
    "baselineSha256": "b3393e2bf056bb34b6029abcf5902810f3aeaa5569e2340c72e076c79b4808e4",
    "baselineBlob": "8d894df879883b52b0db0fc14273b0b3494a6d00",
    "baselineBytes": 28871,
    "contextLines": 3,
    "inverses": [
      {
        "current": "  const oldPending = new Date(Date.now() - 3 * 86400000);   // > 48h SOCIAL_PENDING_TTL\n  const fresh = new Date(Date.now() - 3600000);\n  await pool.query(\"INSERT INTO social_claims (account_id, day, task_id, posted_at, paid) VALUES ($1, 1, 'sw_post', $2, true)\", [acc, oldPaid]);\n  await pool.query(\"INSERT INTO social_claims (account_id, day, task_id, posted_at, paid, proof) VALUES ($1, 4, 'sw_post', $2, true, $3)\",\n    [acc, oldPaid, 'https://twitter.com/legacy/statuses/12345678909999']);\n  await pool.query(\"INSERT INTO social_claims (account_id, day, task_id, posted_at, paid, proof) VALUES ($1, 5, 'sw_post', $2, true, $3)\",\n    [acc, oldPaid, 'legacy trust prose']);\n  await pool.query(\"INSERT INTO social_claims (account_id, day, task_id, posted_at, paid) VALUES ($1, 2, 'sw_invite', $2, false)\", [acc, oldPending]);\n  await pool.query(\"INSERT INTO social_claims (account_id, day, task_id, posted_at, paid) VALUES ($1, 3, 'sw_boost', $2, false)\", [acc, fresh]);\n  const r = await sweepSocialClaims(pool);\n  assert.equal(r.swept, 4, 'spent paid rows and the lapsed pending row are dropped');\n  assert.equal((await pool.query(\"SELECT COUNT(*)::int n FROM social_claims WHERE account_id=$1\", [acc])).rows[0].n, 1, 'the fresh registration survives');\n  assert.equal(Number((await pool.query(\n    `SELECT COUNT(*) n FROM account_daily_claims\n      WHERE account_id='social-proof:x:12345678909999' AND day=0\n        AND scope='social-proof' AND claim_id='used'`)).rows[0].n), 1,\n  'the paid canonical proof is permanently receipted before its row is deleted');\n  assert.equal(Number((await pool.query(\n    \"SELECT COUNT(*) n FROM account_daily_claims WHERE account_id='social-proof:x:legacy trust prose'\"\n  )).rows[0].n), 0, 'malformed predecessor trust prose never becomes a synthetic X receipt');\n  assert.equal((await sweepSocialClaims(pool)).swept, 0, 'idempotent');\n\n  const rollbackProof = 'https://x.com/legacy/status/12345678910000';\n  await pool.query(\"INSERT INTO social_claims (account_id, day, task_id, posted_at, paid, proof) VALUES ($1, 6, 'sw_post', $2, true, $3)\",\n    [acc, oldPaid, rollbackProof]);\n  const failingPool = { connect: async () => {\n    const client = await pool.connect();\n    return {\n      query: (sql, params) => {\n        if (/INSERT INTO account_daily_claims/.test(String(sql))) throw new Error('injected receipt failure');\n        return client.query(sql, params);\n      },\n      release: () => client.release(),\n    };\n  } };\n  await assert.rejects(sweepSocialClaims(failingPool), /injected receipt failure/,\n    'a receipt failure aborts the sweep');\n  assert.equal((await pool.query(\n    'SELECT COUNT(*)::int n FROM social_claims WHERE account_id=$1 AND day=6 AND task_id=$2',\n    [acc, 'sw_post'])).rows[0].n, 1, 'receipt failure rolls back deletion of the paid evidence');\n  assert.equal((await sweepSocialClaims(pool)).swept, 1, 'the retained row is recoverable on the next sweep');\n  console.log('✅ sweepSocialClaims drops spent/lapsed rows, keeps live registrations, idempotent');\n}\n\n",
        "baseline": "  const oldPending = new Date(Date.now() - 3 * 86400000);   // > 48h SOCIAL_PENDING_TTL\n  const fresh = new Date(Date.now() - 3600000);\n  await pool.query(\"INSERT INTO social_claims (account_id, day, task_id, posted_at, paid) VALUES ($1, 1, 'sw_post', $2, true)\", [acc, oldPaid]);\n  await pool.query(\"INSERT INTO social_claims (account_id, day, task_id, posted_at, paid) VALUES ($1, 2, 'sw_invite', $2, false)\", [acc, oldPending]);\n  await pool.query(\"INSERT INTO social_claims (account_id, day, task_id, posted_at, paid) VALUES ($1, 3, 'sw_boost', $2, false)\", [acc, fresh]);\n  const r = await sweepSocialClaims(pool);\n  assert.equal(r.swept, 2, 'the spent-paid and the lapsed-pending rows are both dropped');\n  assert.equal((await pool.query(\"SELECT COUNT(*)::int n FROM social_claims WHERE account_id=$1\", [acc])).rows[0].n, 1, 'the fresh registration survives');\n  assert.equal((await sweepSocialClaims(pool)).swept, 0, 'idempotent');\n  console.log('✅ sweepSocialClaims drops spent/lapsed rows, keeps live registrations, idempotent');\n}\n\n"
      }
    ]
  }
};
for (const pin of Object.values(ECONOMY_SOCIAL_RECEIPT_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(ECONOMY_SOCIAL_RECEIPT_DOMAINS);
const lf = text => text.replaceAll('\r\n', '\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));

export function assertEconomySocialReceiptSourceTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_SOCIAL_RECEIPT_DOMAINS, file), 'Unknown social-receipt repair source domain');
  assert(uniform(input), 'Uniform whole social-receipt repair LF/CRLF source text required');
  const pin = ECONOMY_SOCIAL_RECEIPT_DOMAINS[file], text = lf(input);
  assert.equal(sha256(text), pin.currentSha256, 'Complete social-receipt repair source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete social-receipt repair blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate social-receipt repair inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256,
    'Complete social-receipt repair predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete social-receipt repair predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return { file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_SOCIAL_RECEIPT_REVISION,
    predecessorRevision: ECONOMY_SOCIAL_RECEIPT_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_SOCIAL_RECEIPT_PHASE,
    sourceOnly: true, runtime: false, native: false };
}

export function economySocialReceiptHistoricalInput(file, input) {
  if (!Object.hasOwn(ECONOMY_SOCIAL_RECEIPT_DOMAINS, file)) return input;
  const pin = ECONOMY_SOCIAL_RECEIPT_DOMAINS[file];
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only');
  if (!uniform(text) || sha256(lf(text)) !== pin.currentSha256) return input;
  const baseline = assertEconomySocialReceiptSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
