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
const deedImport = "import * as DeedUpgrades from './deed-upgrades.js';\n";
const deedRoute = "  app.post('/v1/deeds/upgrade', { preHandler: auth }, async (req) =>\n"
  + '    G.withCharacter(pool, req.user.sub, (ch, client, h) => DeedUpgrades.upgradeDeed(ch, req.body, client, h)));\n';
export function assertDeedServerCompatibility(text) {
  const actualSha256 = hash(text);
  if (actualSha256 === DEED_SERVER_BASELINE_PIN) return { actualSha256, baselineSha256: actualSha256, baselineText: text };
  assert.equal(actualSha256, DEED_SERVER_CURRENT_PIN, 'Recovery rule source changed: src/server.js');
  assert(text.startsWith(deedImport), 'Approved deed namespace import is not the exact prefix');
  assert.equal(text.split(deedImport).length, 2, 'Approved deed import is not unique');
  assert.equal(text.split(deedRoute).length, 2, 'Approved authenticated deed route is not exact and unique');
  const baselineText = text.slice(deedImport.length).replace(deedRoute, '');
  assert.equal(hash(baselineText), DEED_SERVER_BASELINE_PIN, 'Server differs from frozen baseline beyond approved deed route');
  return { actualSha256, baselineSha256: DEED_SERVER_BASELINE_PIN, baselineText };
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
