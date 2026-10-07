// Pure test-only source transfer guards; no product modules or runtime effects.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const DEED_RULES_CURRENT_PIN = '83b05a40c16eaa43d383fdf5c7ee1a7794e0b3b5c0be92fa20af19ced99699fb';
export const DEED_SERVER_BASELINE_PIN = '12e8aeefcef09b1a8ef48433792c7c5bbc69e563f0c5a141cec05b447f2fc9ff';
export const DEED_SERVER_CURRENT_PIN = 'bbbeb137b8b1baeff09985331bc70a57670ddb723925057ffa858f840880e453';
export const DEED_SOURCE_REVIEWED_REVISION = '7222b0964606e944326da2e2cd0ac8c0e4d02b36';
export const DEED_BACKLOG_BASELINE_PINS = Object.freeze({
  'src/chain.js': 'ce26f5bdc6b9ac0a6f448b973bd47ad58b94675f58a3ba5576d7cf25a7532381',
  'src/invariants.js': 'ffbaae96e4ff8f9a62a0d8329020c13853a50ccc69a197f5c0b4c6a04bc7e9c4',
});
export const DEED_BACKLOG_CURRENT_PINS = Object.freeze({
  'src/chain.js': '182ec8bbd6caef02e6c9084f6ec755333a0e40b554cad2367686865c4d52eae1',
  'src/invariants.js': 'c1f9e4cc88ee7e7f4b78b3d2165eb0c3ae03e36232f8e98645867cac95900339',
});
const chainChanges = [
  ["    if (row) await client.query('UPDATE street_deeds SET onchain_owner=$2, ownership_since_day=$3 WHERE onchain_token_id=$1', [String(tokenId), owner, dayOf() + 1]);\n",
   "    if (row) await client.query('UPDATE street_deeds SET onchain_owner=$2 WHERE onchain_token_id=$1', [String(tokenId), owner]);\n"],
  ['       corner_at=now(), shakedown_at=NULL, sale_price=NULL, ownership_since_day=$3 WHERE account_id=$1`, [onchainOwner, acct.account_id, dayOf() + 1]);\n',
   '       corner_at=now(), shakedown_at=NULL, sale_price=NULL WHERE account_id=$1`, [onchainOwner, acct.account_id]);\n'],
  ["    await pool.query('UPDATE account_persistent SET wallet_address=$2, reward_wallet_since_day=CASE WHEN lower(wallet_address)=lower($2) THEN reward_wallet_since_day ELSE $3 END WHERE account_id=$1', [accountId, addr, dayOf() + 1]);\n",
   "    await pool.query('UPDATE account_persistent SET wallet_address=$2 WHERE account_id=$1', [accountId, addr]);\n"],
];
const invariantChanges = [["    'window:', 'yield:', 'desk:', 'made:', 'rarity:', 'brokers:', 'deed:upgrade',\n",
  "    'window:', 'yield:', 'desk:', 'made:', 'rarity:', 'brokers:',\n"]];
export function assertDeedBacklogCompatibility(file, text) {
  const actualSha256 = hash(text), baselineSha256 = DEED_BACKLOG_BASELINE_PINS[file];
  assert(baselineSha256, 'Unknown backlog compatibility source');
  if (actualSha256 === baselineSha256) return { actualSha256, baselineSha256, baselineText: text };
  assert.equal(actualSha256, DEED_BACKLOG_CURRENT_PINS[file], 'Backlog reviewer source changed: ' + file);
  let baselineText = text;
  for (const [current, original] of file === 'src/chain.js' ? chainChanges : invariantChanges) {
    assert.equal(baselineText.split(current).length, 2, 'Approved backlog addition is not exact and unique: ' + file);
    baselineText = baselineText.replace(current, original);
  }
  assert.equal(hash(baselineText), baselineSha256, 'Backlog source differs beyond approved deed changes: ' + file);
  return { actualSha256, baselineSha256, baselineText };
}
export const HTTP_RECEIPT_SERVER_PIN = '111d8de4b7a8aa96ed025d643e2c7831248302ae6eecee344a1d9e5eea3bfe88';
export const HTTP_RECEIPT_HELPER_PIN = '2edeb237aa8c52c2655ac4821553d073fd6c90736600d0d34c092c4f567861fb';
export const HTTP_RECEIPT_REVIEWED_REVISION = '7da453e05036cc18bb60533aadcad8e7818020cc';
export const GENESIS_SERVER_WRAPPER_PIN = '8acb53225230920a2b6509636d51d3156acdddc53ed249391b620ffc8a695810';
export const GENESIS_SERVER_WRAPPER_SOURCE_REVISION = '0e2fef3f3c0269ecfe1f70b76274d692d6462e0e';
// A separate, source-specific routing transfer; it does not extend the historical HTTP/deed
// semantic review to the new genesis API or wallet modules. Exactly undo only these three chunks.
const genesisWrapperChanges = [
  "import { register as registerGenesisAuction } from './routes/genesisauction.js';\n",
  '  registerGenesisAuction(app, { auth });\n',
  '  // Explicit public pages and reviewed deployment modules: no user-controlled file path.\n'
    + "  const defiPage = servePage(readFileSync(pub('defi.html'), 'utf8'));\n"
    + "  app.get('/defi', defiPage);\n"
    + "  app.get('/defi.html', defiPage);\n"
    + "  const feeflowsPage = servePage(readFileSync(pub('fee-flows.html'), 'utf8'));\n"
    + "  app.get('/fee-flows', feeflowsPage);\n"
    + "  app.get('/fee-flows.html', feeflowsPage);\n"
    + "  const genesisdeployPage = servePage(readFileSync(pub('genesis-deploy.html'), 'utf8'));\n"
    + "  app.get('/genesis-deploy', genesisdeployPage);\n"
    + "  app.get('/genesis-deploy.html', genesisdeployPage);\n"
    + '  const reviewedModule = name => {\n'
    + "    const code = readFileSync(pub(name), 'utf8');\n"
    + "    return async (req, reply) => reply.type('application/javascript; charset=utf-8')\n"
    + "      .header('cache-control', 'no-store').send(code);\n"
    + '  };\n'
    + "  app.get('/genesis-deploy-client.js', reviewedModule('genesis-deploy-client.js'));\n"
    + "  app.get('/genesis-deploy-artifact.js', reviewedModule('genesis-deploy-artifact.js'));\n"
    + "  app.get('/genesis-deploy-vendor/sha3.js', reviewedModule('genesis-deploy-vendor/sha3.js'));\n"
    + "  app.get('/genesis-deploy-vendor/_u64.js', reviewedModule('genesis-deploy-vendor/_u64.js'));\n"
    + "  app.get('/genesis-deploy-vendor/utils.js', reviewedModule('genesis-deploy-vendor/utils.js'));\n"
    + "  app.get('/genesis-deploy-vendor/crypto.js', reviewedModule('genesis-deploy-vendor/crypto.js'));\n",
];
export function assertGenesisWrapperServerCompatibility(text) {
  const actualSha256 = hash(text);
  if (actualSha256 === HTTP_RECEIPT_SERVER_PIN) return { actualSha256, priorText: text, genesisWrapperTransfer: null };
  assert.equal(actualSha256, GENESIS_SERVER_WRAPPER_PIN, 'Recovery rule source changed: src/server.js');
  let priorText = text;
  for (const chunk of genesisWrapperChanges) {
    assert.equal(priorText.split(chunk).length, 2, 'Genesis routing transfer is not exact and unique');
    priorText = priorText.replace(chunk, '');
  }
  assert.equal(hash(priorText), HTTP_RECEIPT_SERVER_PIN, 'Server differs beyond exact genesis routing wrappers');
  return { actualSha256, priorText, genesisWrapperTransfer: { sourceRevision: GENESIS_SERVER_WRAPPER_SOURCE_REVISION,
    actualSha256, predecessorSha256: HTTP_RECEIPT_SERVER_PIN, inverseChunks: 3, publicGetRoutes: 12 } };
}
// Exact inverse literals for the reviewed HTTP transport change only.
const receiptChanges = [
  [
    "import { finalizeHttpIdempotency, readHttpIdempotency } from './http-idempotency.js';\n",
    ""
  ],
  [
    "        const reservationToken = crypto.randomUUID();\n",
    ""
  ],
  [
    "            [req.user.sub, key, bodyHash, reservationToken]);\n",
    "            [req.user.sub, key, bodyHash, '']);\n"
  ],
  [
    "        } catch (error) {\n          if (error?.code !== '23505' && !isDbDown(error)) throw error;\n          // A lost INSERT acknowledgement is safe to recognize only by this\n          // attempt's token. Other owners and ambiguous old rows stay guarded.\n        }\n        if (reserved) { req._idem = { key, bodyHash, reservationToken }; return; }\n        const row = (await readHttpIdempotency(pool, req.user.sub, key)).rows[0];\n",
    "        } catch { /* PK conflict → the key already exists */ }\n        if (reserved) { req._idem = { key, bodyHash }; return; }\n        const row = (await pool.query('SELECT status, body_hash, response FROM idempotency WHERE account_id=$1 AND key=$2',\n          [req.user.sub, key])).rows[0];\n"
  ],
  [
    "        if (row.status === 0 && row.response === reservationToken) {\n          req._idem = { key, bodyHash, reservationToken };\n          return;\n        }\n",
    ""
  ],
  [
    "          if (row.status === 0) req._idem = { key, bodyHash, reservationToken: row.response };\n",
    "          req._idem = { key, bodyHash };\n"
  ],
  [
    "          req._idem = { key, bodyHash, reservationToken: row.response };\n",
    "          req._idem = { key, bodyHash };\n"
  ],
  [
    "    const { key, bodyHash, reservationToken } = req._idem;\n    const reservation = { accountId: req.user.sub, key, bodyHash, reservationToken };\n",
    "    const { key, bodyHash } = req._idem;\n"
  ],
  [
    "      await finalizeHttpIdempotency(pool, reservation, { status: reply.statusCode, response: storedPayload })\n",
    "      await pool.query('UPDATE idempotency SET status=$3, response=$4 WHERE account_id=$1 AND key=$2 AND body_hash=$5 AND status=0',\n        [req.user.sub, key, reply.statusCode, storedPayload, bodyHash])\n"
  ],
  [
    "      await finalizeHttpIdempotency(pool, reservation, { status: reply.statusCode })\n        .catch((e) => console.error('idempotency: release DELETE failed — key left in-progress', e?.message));\n",
    "      await pool.query('DELETE FROM idempotency WHERE account_id=$1 AND key=$2 AND status=0 AND body_hash=$3',\n        [req.user.sub, key, bodyHash]).catch(() => {});\n"
  ]
];
export function assertHttpReceiptServerCompatibility(text) {
  const actualSha256 = hash(text);
  if (actualSha256 === DEED_SERVER_CURRENT_PIN) return { actualSha256, priorText: text };
  const wrapper = assertGenesisWrapperServerCompatibility(text);
  let priorText = wrapper.priorText;
  for (const [current, original] of receiptChanges) {
    assert.equal(priorText.split(current).length, 2, 'Reviewed receipt change is not exact and unique');
    priorText = priorText.replace(current, original);
  }
  assert.equal(hash(priorText), DEED_SERVER_CURRENT_PIN, 'Server differs beyond reviewed receipt changes');
  return { actualSha256, priorText, genesisWrapperTransfer: wrapper.genesisWrapperTransfer };
}
const deedImport = "import * as DeedUpgrades from './deed-upgrades.js';\n";
const deedRoute = "  app.post('/v1/deeds/upgrade', { preHandler: auth }, async (req) =>\n"
  + '    G.withCharacter(pool, req.user.sub, (ch, client, h) => DeedUpgrades.upgradeDeed(ch, req.body, client, h)));\n';
export function assertDeedServerCompatibility(text) {
  const actualSha256 = hash(text);
  if (actualSha256 === DEED_SERVER_BASELINE_PIN) return { actualSha256, baselineSha256: actualSha256, baselineText: text };
  const receiptTransfer = assertHttpReceiptServerCompatibility(text);
  text = receiptTransfer.priorText;
  assert(text.startsWith(deedImport), 'Approved deed namespace import is not the exact prefix');
  assert.equal(text.split(deedImport).length, 2, 'Approved deed import is not unique');
  assert.equal(text.split(deedRoute).length, 2, 'Approved authenticated deed route is not exact and unique');
  const baselineText = text.slice(deedImport.length).replace(deedRoute, '');
  assert.equal(hash(baselineText), DEED_SERVER_BASELINE_PIN, 'Server differs from frozen baseline beyond approved deed route');
  return { actualSha256, baselineSha256: DEED_SERVER_BASELINE_PIN, baselineText,
    genesisWrapperTransfer: receiptTransfer.genesisWrapperTransfer };
}
export const CAR_MELT_BASELINE_RULES_PIN = 'ee6bdee29f049fcac9c3530729cbdca3039ea87a18b873cf7a6d548f0af1abed';
const deedSinkLine = "    'megaproject:omr', 'bond:%', 'business:spec%', 'death:duty', 'window:burn', 'made:%', 'brokers:%', 'deed:upgrade',\n";
const baselineSinkLine = "    'megaproject:omr', 'bond:%', 'business:spec%', 'death:duty', 'window:burn', 'made:%', 'brokers:%',\n";
const deedUpgradeLiteral = '\n// Permanent deed-bound bonuses; gameplay and funding remain required.\n'
  + 'export const DEED_UPGRADES = [\n'
  + '  { level: 1, costOmr: 150, bonusBps: 500, minRenown: 5 },\n'
  + '  { level: 2, costOmr: 450, bonusBps: 1000, minRenown: 20 },\n'
  + '  { level: 3, costOmr: 1200, bonusBps: 1500, minRenown: 50 },\n'
  + '  { level: 4, costOmr: 3000, bonusBps: 2000, minRenown: 80 },\n'
  + '  { level: 5, costOmr: 9000, bonusBps: 2500, minRenown: 120 },\n'
  + '];\n';
// Compatibility proves the complete frozen source survives exactly two known
// additions. Current witnesses still attest the actual complete-file digest.
export function assertCarMeltRulesCompatibility(text) {
  const actualSha256 = hash(text);
  if (actualSha256 === CAR_MELT_BASELINE_RULES_PIN) return { actualSha256, baselineSha256: actualSha256, baselineText: text };
  assert.equal(actualSha256, DEED_RULES_CURRENT_PIN, 'Car melt provenance source changed: src/rules.tail.js');
  assert.equal(text.split(deedSinkLine).length, 2, 'Approved deed sink addition is not exact and unique');
  assert.equal(text.split(deedUpgradeLiteral).length, 2, 'Approved deed upgrade literal is not exact and unique');
  assert(text.endsWith(deedUpgradeLiteral), 'Approved deed upgrade literal is not the exact suffix');
  const baselineText = text.slice(0, -deedUpgradeLiteral.length).replace(deedSinkLine, baselineSinkLine);
  assert.equal(hash(baselineText), CAR_MELT_BASELINE_RULES_PIN, 'Car rules differ from frozen baseline beyond approved deed additions');
  return { actualSha256, baselineSha256: CAR_MELT_BASELINE_RULES_PIN, baselineText };
}
