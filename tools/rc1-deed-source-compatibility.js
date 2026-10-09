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
// Exact inverse transfer of the additive depot/delivery checks and webhook formatting.
// Historical deed evidence is reconstructed, not extended to the new economy.
export const AGENT_ECONOMY_INVARIANT_PIN = 'cd46343ec94dfb570c99fcd0e5618fe0631eb6d73557ddb8b53980983dc40150';
const economyInvariantChanges = [
  [
    "    'gang:contract', 'bodyguard:', 'territory:', 'business:', 'depot:', 'pilot:capital', 'path:', 'casino:', 'convoy:', 'market:', 'underworld:',\n",
    "    'gang:contract', 'bodyguard:', 'territory:', 'business:', 'path:', 'casino:', 'convoy:', 'market:', 'underworld:',\n"
  ],
  [
    "  const deliveryRows = (await pool.query(\"SELECT * FROM delivery_commitments WHERE status='accepted' AND deadline>now()\")).rows;\n  const deliveryOrders = (await pool.query(\"SELECT id,qty,price,seller_character,depot_id,good_id,district,status,expires_at FROM market_listings WHERE kind='order'\")).rows;\n  for (const id of [...new Set(deliveryRows.map((c) => c.order_id))]) {\n    const contracts = deliveryRows.filter((c) => c.order_id === id), order = deliveryOrders.find((o) => o.id === id);\n    const reserved = contracts.reduce((n, c) => n + Number(c.remaining), 0);\n    push(`delivery capacity:${id}`, Math.max(0, reserved - Number(order?.qty || 0)), 0, 0);\n    const mismatch = contracts.filter((c) => !order || order.status !== 'live' || order.depot_id !== c.depot_id\n      || order.seller_character !== c.buyer_character || order.good_id !== c.good_id || order.district !== c.district\n      || Number(order.price) !== Number(c.unit_price) || new Date(c.deadline) > new Date(order.expires_at)\n      || Number(c.spent) > Number(c.spend_limit)).length;\n    push(`delivery terms:${id}`, mismatch, 0, 0);\n  }\n\n  // Pilot business custody is independently journaled. Cash funding/withdrawals and\n  // customer receipts must also reconcile with the existing character ledger.\n  const depots = (await pool.query('SELECT id,treasury,stock,stock_cost FROM business_depots')).rows;\n  const depotJournal = (await pool.query('SELECT depot_id,reason,cash_delta,stock_delta,cost_delta FROM business_depot_journal')).rows;\n  const depotOrders = (await pool.query(\"SELECT depot_id,qty,filled_qty,status FROM market_listings WHERE depot_id IS NOT NULL AND (status='live' OR filled_qty>0)\")).rows;\n  for (const depot of depots) {\n    const entries = depotJournal.filter((entry) => entry.depot_id === depot.id);\n    for (const [column, delta] of [['treasury', 'cash_delta'], ['stock', 'stock_delta'], ['stock_cost', 'cost_delta']])\n      push(`depot ${column}:${depot.id}`, Number(depot[column]), entries.reduce((n, entry) => n + Number(entry[delta]), 0), 0);\n    const promised = Number(depot.stock) + depotOrders.filter((order) => order.depot_id === depot.id)\n      .reduce((n, order) => n + Number(order.filled_qty) + (order.status === 'live' ? Number(order.qty) : 0), 0);\n    push(`depot capacity:${depot.id}`, Math.max(0, promised - 40), 0, 0);\n  }\n  const depotCash = (reason) => depotJournal.filter((entry) => entry.reason === reason).reduce((n, entry) => n + Number(entry.cash_delta), 0);\n  push('depot funding', depotCash('fund'), -(await sum(pool, \"currency='cash' AND reason='depot:fund' AND character_id IS NOT NULL\")), 0);\n  push('depot withdrawals', -depotCash('withdraw'), await sum(pool, \"currency='cash' AND reason='depot:withdraw' AND character_id IS NOT NULL\"), 0);\n  push('depot sales', depotCash('sale'), -(await sum(pool, \"currency='cash' AND reason='depot:buy'\")) + await sum(pool, \"currency='cash' AND reason='depot:take'\"), 0);\n  push('depot procurement', -depotCash('restock_escrow'), -(await sum(pool, \"currency='cash' AND reason='market:order' AND character_id IS NULL\")), 0);\n  push('depot refunds', depotCash('restock_refund'), await sum(pool, \"currency='cash' AND reason='market:refund' AND character_id IS NULL\"), 0);\n  push('depot listing fees', -depotCash('restock_fee'), -(await sum(pool, \"currency='cash' AND reason='market:list' AND character_id IS NULL\")), 0);\n  push('depot death burn', -depotCash('death'), -(await sum(pool, \"currency='cash' AND reason='depot:death'\")), 0);\n  const policyRows = (await pool.query('SELECT id,spent,max_spend FROM business_operating_policies')).rows;\n  const policyJournal = (await pool.query(\"SELECT policy_id,cash_delta FROM business_depot_journal WHERE policy_id IS NOT NULL AND reason IN ('restock_escrow','restock_fee')\")).rows;\n  for (const policy of policyRows) {\n    push(`operating policy spend:${policy.id}`, Number(policy.spent), -policyJournal.filter((j) => j.policy_id === policy.id)\n      .reduce((n, j) => n + Number(j.cash_delta), 0), 0);\n    push(`operating policy budget:${policy.id}`, Math.max(0, Number(policy.spent) - Number(policy.max_spend)), 0, 0);\n  }\n",
    ""
  ],
  [
    "    if (Array.isArray(f.mismatches)) {\n      const details = f.mismatches.map((m) => `  • ${m.what}: on-chain ${m.onchain} vs backend ${m.backend}`);\n      return [`• ${f.name || 'check'}`, ...details, ...(f.note ? [`  ${f.note}`] : [])].join('\\n');\n    }\n    const rest = Object.entries(f).filter(([k]) => k !== 'name')\n      .map(([k, v]) => `${k}=${v !== null && typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');\n",
    "    const rest = Object.entries(f).filter(([k]) => k !== 'name').map(([k, v]) => `${k}=${v}`).join(', ');\n"
  ]
];
export function assertDeedBacklogCompatibility(file, text) {
  if (file === 'src/invariants.js' && hash(text) === AGENT_ECONOMY_INVARIANT_PIN) {
    let prior = text;
    for (const [current, original] of economyInvariantChanges) {
      assert.equal(prior.split(current).length, 2, 'Economy invariant transfer is not exact and unique');
      prior = prior.replace(current, original);
    }
    assert.equal(hash(prior), DEED_BACKLOG_CURRENT_PINS[file], 'Invariant source differs beyond exact economy additions');
    const proof = assertDeedBacklogCompatibility(file, prior);
    return { ...proof, actualSha256: hash(text), economyTransfer: { predecessorSha256: hash(prior), inverseChunks: economyInvariantChanges.length } };
  }
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
export const GENESIS_SNAPSHOT_SERVER_PIN = 'cf17311eeea98729ba277c722eb18426cdbfd1da863859684fdeec31a793dc97';
export const GENESIS_SNAPSHOT_REVIEWED_REVISION = 'ebb5c217e62d200d64fc0c9143e9625f7e301119';
export const GENESIS_SNAPSHOT_MODULE_PINS = Object.freeze({
  "src/genesisrpc.js": "53d43570c74883449002df25921cc394cffb376e2ede6c1fbea292c775a6ac44",
  "src/routes/genesisauction.js": "fd288a9fa75993f6cd31e3fda9f5de9102056b74d050272e9d70fe974cf5a212",
  "src/genesisauction.js": "7fe75323e9ce4e3e5047d653b858f440db13ffc4b4ad7f9f58f8b88988f9b39e",
  "public/genesis-snapshot-rpc.js": "d284be80c7df6231eaccb2da27a273448be767de6e62016d798d09f018b31667",
  "public/genesis-deploy-client.js": "3c8e2e19ddab7df96c77bb332bda35161e1be242913481b6504539f183d1d2ad",
  "tools/genesis-auction-preflight.js": "829a17c59ec768cc1d67dab1a006878c241bdba4c393962af95e1ca86c2c461a"
});
const genesisSnapshotRoute = "  app.get('/genesis-snapshot-rpc.js', reviewedModule('genesis-snapshot-rpc.js'));\n";
export function assertGenesisSnapshotServerCompatibility(text) {
  if (hash(text) === CITY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertCitySourceTransfer('src/server.js', text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySourceTransfer: transfer };
  }
  if (hash(text) === ECONOMY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertEconomySourceTransfer('src/server.js', text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), economyTransfer: transfer };
  }
  const actualSha256 = hash(text);
  if (actualSha256 === GENESIS_SERVER_WRAPPER_PIN) return { actualSha256, priorText: text, snapshotModuleTransfer: null };
  assert.equal(actualSha256, GENESIS_SNAPSHOT_SERVER_PIN, 'Recovery rule source changed: src/server.js');
  assert.equal(text.split(genesisSnapshotRoute).length, 2, 'Snapshot module registration is not exact and unique');
  const priorText = text.replace(genesisSnapshotRoute, '');
  assert.equal(hash(priorText), GENESIS_SERVER_WRAPPER_PIN, 'Server differs beyond the reviewed static snapshot module route');
  return { actualSha256, priorText, snapshotModuleTransfer: { sourceRevision: GENESIS_SNAPSHOT_REVIEWED_REVISION,
    predecessorSha256: GENESIS_SERVER_WRAPPER_PIN, inverseChunks: 1, publicGetRoutes: 1, modulePins: GENESIS_SNAPSHOT_MODULE_PINS } };
}
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
  if (hash(text) === CITY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertCitySourceTransfer('src/server.js', text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySourceTransfer: transfer };
  }
  if (hash(text) === ECONOMY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertEconomySourceTransfer('src/server.js', text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), economyTransfer: transfer };
  }
  const actualSha256 = hash(text);
  if (actualSha256 === HTTP_RECEIPT_SERVER_PIN) return { actualSha256, priorText: text, genesisWrapperTransfer: null };
  const snapshot = assertGenesisSnapshotServerCompatibility(text);
  text = snapshot.priorText;
  let priorText = text;
  for (const chunk of genesisWrapperChanges) {
    assert.equal(priorText.split(chunk).length, 2, 'Genesis routing transfer is not exact and unique');
    priorText = priorText.replace(chunk, '');
  }
  assert.equal(hash(priorText), HTTP_RECEIPT_SERVER_PIN, 'Server differs beyond exact genesis routing wrappers');
  return { actualSha256, priorText, genesisWrapperTransfer: { sourceRevision: GENESIS_SERVER_WRAPPER_SOURCE_REVISION,
    actualSha256: GENESIS_SERVER_WRAPPER_PIN, predecessorSha256: HTTP_RECEIPT_SERVER_PIN, inverseChunks: 3, publicGetRoutes: 12 },
    snapshotModuleTransfer: snapshot.snapshotModuleTransfer };
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
  if (hash(text) === CITY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertCitySourceTransfer('src/server.js', text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySourceTransfer: transfer };
  }
  if (hash(text) === ECONOMY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertEconomySourceTransfer('src/server.js', text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), economyTransfer: transfer };
  }
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
  if (hash(text) === CITY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertCitySourceTransfer('src/server.js', text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySourceTransfer: transfer };
  }
  if (hash(text) === ECONOMY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertEconomySourceTransfer('src/server.js', text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), economyTransfer: transfer };
  }
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

// Source-specific inverse transfers for the reviewed City assets, UI reads, recipes and mystery routes.
// This preserves predecessor recovery guards only: GUI, RPG, exploration and new projection authority are not
// inherited from historical execution evidence. Complete current and predecessor bytes stay pinned.
export const CITY_SOURCE_REVIEWED_REVISION = '3e825926d8d78aad8634bb865ee12dbc99fef2e6';
export const CITY_SOURCE_PREDECESSOR_REVISION = '46341d551fa5626c13d0662b6f93c06319b83555';
export const CITY_SOURCE_CURRENT_PINS = Object.freeze({
  'src/server.js': '647908de3e63520de306e91e8c34ff1152364fe0c7b3f97f9807cfddf2e016b8',
  'src/operations.js': '175882731792bfd24f2cb7ff0ecd62dc3bb7273b817a77b8bcd5cb7817fdf679',
  'src/mysteries.js': '6fa63eb5239eb22a7a8fb7545a8310ed66dcc80506c893871d332d835c42ad49',
  'src/crafting.js': 'a96d3117c5d03b47573eb4a2de7af769b29ade82e5e8a9e9f54300472073d5be',
  'src/routes/worldgraph.js': 'bfec86de2c0fac2132308115c366b30e0eda057fbe6570d46ac0afa01bfb938a',
});
export const CITY_SOURCE_PREDECESSOR_PINS = Object.freeze({
  'src/server.js': '2a8f9eb10ccebed5f5304230435f33cd1e39241c616a7cb4c442097002530d57',
  'src/operations.js': '689b0e9f9274fd26128c0067ca133a95361587a0aa4bce4b94f4869fc858d70f',
  'src/mysteries.js': 'c520c727c15bd5829c1b2467511260c61e01b73038bce42ba9a48a8a55c6d070',
  'src/crafting.js': '2eeaa2eb1378fdc2c237727226d132a85b8b009d0890485e18fa7b6290251012',
  'src/routes/worldgraph.js': '5a96afa156930a5cb6cd6656fe1fb92fc716eeddd5243d954a46cf5a619b96c7',
});
const cityStaticAssets =
  '  // City scenes are optional local assets; gameplay remains authoritative through the API.\n'
  + '  for (const [file, type] of [\n'
  + "    ['city-scene.js', 'application/javascript'], ['city-scene.css', 'text/css'],\n"
  + "    ['world-fieldwork.js', 'application/javascript'], ['world-fieldwork.css', 'text/css'],\n"
  + "    ['vendor/phaser.js', 'application/javascript'], ['vendor/phaser.js.LICENSE.txt', 'text/plain'],\n"
  + '  ]) {\n'
  + '    let asset = null;\n'
  + "    try { asset = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', file)); } catch { /* headless */ }\n"
  + "    app.get('/' + file, async (req, reply) => asset\n"
  + "      ? reply.type(type + '; charset=utf-8').header('cache-control', 'no-cache').send(asset)\n"
  + "      : reply.code(404).send({ error: 'asset_unavailable' }));\n"
  + '  }\n';
const operationReadInverse = [
  ['async function conditionBlocker(client, actor, operation, states, condition, interactionId, { lock = true } = {}) {\n',
    'async function conditionBlocker(client, actor, operation, states, condition, interactionId) {\n'],
  [
    '    let row;\n    if (lock) row = (await client.query(\n'
      + "      `SELECT 1 FROM item_instances WHERE owner_scope='account' AND owner_id=$1\n"
      + "        AND template_id=$2 AND state='active' AND definition_hash IS NULL LIMIT 1 FOR UPDATE`,\n"
      + '      [actor.accountId, normalized.templateId],\n    )).rows[0];\n'
      + '    else row = (await client.query(\n'
      + "      `SELECT 1 FROM item_instances WHERE owner_scope='account' AND owner_id=$1\n"
      + "        AND template_id=$2 AND state='active' AND definition_hash IS NULL LIMIT 1`,\n"
      + '      [actor.accountId, normalized.templateId],\n    )).rows[0];\n',
    '    const row = (await client.query(\n'
      + "      `SELECT 1 FROM item_instances WHERE owner_scope='account' AND owner_id=$1\n"
      + "        AND template_id=$2 AND state='active' AND definition_hash IS NULL LIMIT 1 FOR UPDATE`,\n"
      + '      [actor.accountId, normalized.templateId],\n    )).rows[0];\n',
  ],
  [
    '    let row;\n    if (lock) row = (await client.query(\n'
      + "      `SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1\n"
      + '        AND template_id=$2 AND quality=$3 FOR UPDATE`,\n'
      + '      [actor.accountId, normalized.templateId, normalized.quality],\n    )).rows[0];\n'
      + '    else row = (await client.query(\n'
      + "      `SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1\n"
      + '        AND template_id=$2 AND quality=$3`,\n'
      + '      [actor.accountId, normalized.templateId, normalized.quality],\n    )).rows[0];\n',
    '    const row = (await client.query(\n'
      + "      `SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1\n"
      + '        AND template_id=$2 AND quality=$3 FOR UPDATE`,\n'
      + '      [actor.accountId, normalized.templateId, normalized.quality],\n    )).rows[0];\n',
  ],
];
const operationUiStart = '// Snapshot eligibility for the human client. This does not reserve a role, mutate lifecycle state,\n';
const operationUiEnd = '/** Safe shared projection: role slots and public progress, never account/character/Crew identities. */\n';
const operationUiPin = 'd063c9e975a4d595a830b59b970a636c2d478f4574240030e9e31f3e9c870423';
// Exact reviewed diff hunks retain unchanged context; every inverse must match once.
const cityExtensionInverse = {
  "src/mysteries.js": [
    [
      "    type: node.type,\n    title: node.metadata?.title || node.id,\n    ...(typeof node.metadata?.description === 'string' ? { description: node.metadata.description } : {}),\n    ...(typeof node.metadata?.lore === 'string' ? { dialogue: node.metadata.lore } : {}),\n    status,\n    available: actionable && status !== 'excluded' && status !== 'failed'\n      && status !== 'completed' && blockers.length === 0,\n",
      "    type: node.type,\n    title: node.metadata?.title || node.id,\n    ...(typeof node.metadata?.description === 'string' ? { description: node.metadata.description } : {}),\n    status,\n    available: actionable && status !== 'excluded' && status !== 'failed'\n      && status !== 'completed' && blockers.length === 0,\n"
    ],
    [
      "  return projection;\n}\n\n// Eligible undiscovered leads are selected server-side; a GET never publishes their identifiers.\nasync function readyDiscoveries({ client, context, owner, actor, instance, states, lock = false, knowledgeResolved = false }) {\n  if (!actor || instance.status !== 'active') return [];\n  const candidates = [...context.registry.nodes.values()].filter(node => {\n    const state = states.get(node.id);\n    return node.packageId === instance.graph_id && !['public', 'role_private'].includes(node.visibility)\n      && ['mystery_step', 'world_gate', 'choice'].includes(node.type) && !state?.discovered_at\n      && !['completed', 'excluded', 'failed'].includes(state?.state);\n  });\n  // Preserve the newest engine's one sorted knowledge/prerequisite proof for the entire request.\n  if (!knowledgeResolved) await resolveMysteryKnowledge(client, context, actor, candidates, { readOnly: !lock });\n  const ready = [];\n  for (const node of candidates) {\n    const interactions = (node.conditions || []).map(condition => normalizeMysteryCondition(\n      context.registry, node, condition, { timeWindows: context.timeWindows },\n    )).filter(condition => condition.adapter === 'explicit_interaction').map(condition => condition.target);\n    if (new Set(interactions).size > 1) continue;\n    const interactionId = interactions[0] || null;\n    const blockers = await nodeBlockers({ client, context, owner, actor, instance, states, node,\n      interactionId, lock, knowledgeResolved: true });\n    if (!blockers.length) ready.push({ node, interactionId });\n  }\n  return ready;\n}\n\nexport async function exploreMystery(client, contextValue, ownerValue, graphIdValue, optionsValue) {\n  const context = contextOf(contextValue), owner = ownerOf(ownerValue);\n  const graphId = canonical(graphIdValue, 'Mystery graph id'), options = mutationOptions(optionsValue);\n  const authority = await actionAuthority(client, context, owner, graphId);\n  return withItemMutation(client, owner, 'mystery_action', options.idempotencyKey, {\n    action: 'explore', graph: graphIdentity(authority.pkg),\n    itemAuthority: { operations: [authority.instance.id] },\n  }, async () => {\n    const actor = await actorOf(client, context, owner);\n    const instance = await lockedActionInstance(client, authority, context);\n    const candidates = await readyDiscoveries({ client, context, owner, actor, instance,\n      states: stateMap(await stateRows(client, instance.id)), lock: true });\n    const candidate = candidates[0];\n    if (!candidate) fail('mystery_node_unavailable', 'There is no new lead to investigate right now.');\n    const row = await setNodeState(client, instance.id, candidate.node.id, 'discovered');\n    return { ok: true, instanceId: instance.id,\n      node: { id: candidate.node.id, status: 'discovered', discoveredAt: dateString(row.discovered_at) } };\n  });\n}\n\n/** Read a safe board. Hidden nodes require discovery; role-private nodes belong to Task 6. */\nexport async function mysteryBoard(client, contextValue, ownerValue, graphIdValue) {\n  return withItemRead(client, async (reader) => (await prepareMysteryBoard(reader, contextValue, ownerValue, graphIdValue)).render());\n",
      "  return projection;\n}\n\n/** Read a safe board. Hidden nodes require discovery; role-private nodes belong to Task 6. */\nexport async function mysteryBoard(client, contextValue, ownerValue, graphIdValue) {\n  return withItemRead(client, async (reader) => (await prepareMysteryBoard(reader, contextValue, ownerValue, graphIdValue)).render());\n"
    ],
    [
      "    nodes,\n    choices,\n    ...(affordances ? { actions } : {}),\n    explorationAvailable: (await readyDiscoveries({ client, context, owner, actor: readActor,\n      instance, states, knowledgeResolved: true })).length > 0,\n  };\n  } };\n}\n",
      "    nodes,\n    choices,\n    ...(affordances ? { actions } : {}),\n  };\n  } };\n}\n"
    ]
  ],
  "src/crafting.js": [
    [
      "    });\n}\n\n/** Safe UI choices include exact eligible garage cars; consuming a car still requires salvageCar. */\nexport function recipeActionCatalog(ctx = {}, craftingContext = DEFAULT_CRAFTING_CONTEXT) {\n  const runtime = contextOf(craftingContext), preview = previewContext(ctx);\n  return recipeCatalog(ctx, craftingContext).map(entry => {\n    if (entry.blockedBy.some(blocker => blocker.adapter === 'discovery')) return { ...entry, actions: [] };\n    const recipe = CRAFTING_DEFINITIONS.get(runtime).get(entry.id);\n    const base = '/v1/worldgraph/recipes/' + encodeURIComponent(entry.id);\n    const cars = inputsOf(recipe).some(input => input.assetType === 'car');\n    let actions;\n    if (cars) {\n      actions = preview.cars.filter(car => !recipeBlockers(recipe, preview, { selectedCarId: car.id })\n        .some(blocker => blocker.adapter === 'owns_car')).map(car => {\n        const blockedBy = [...entry.blockedBy.filter(blocker => blocker.adapter !== 'owns_car'),\n          ...recipeBlockers(recipe, preview, { selectedCarId: car.id })\n            .filter(blocker => blocker.adapter === 'owns_car')];\n        return { id: 'salvage:' + car.id, label: 'Salvage ' + car.modelId,\n          method: 'POST', path: base + '/salvage/' + encodeURIComponent(car.id), body: {},\n          available: blockedBy.length === 0, blockedBy,\n          consequence: 'This permanently consumes this exact car and the listed costs. It cannot be undone.' };\n      });\n    } else actions = [{ id: 'craft:' + entry.id, label: 'Craft this recipe', method: 'POST',\n      path: base + '/craft', body: {}, available: entry.available, blockedBy: entry.blockedBy,\n      consequence: 'This consumes the listed materials and cash to produce the listed output.' }];\n    return { ...entry, actions };\n  });\n}\n\nasync function actorContext(client, accountId) {\n  const character = (await client.query(\n    `SELECT id, account_id, loc, respect, cash, alive\n",
      "    });\n}\n\nasync function actorContext(client, accountId) {\n  const character = (await client.query(\n    `SELECT id, account_id, loc, respect, cash, alive\n"
    ],
    [
      "  const inventory = await inventoryBoard(client, actor.owner);\n  actor.inventory = inventory;\n  const selected = new Set(recipes.map((recipe) => recipe.id));\n  const catalog = recipeCatalog(actor, context);\n  return catalog.filter((recipe) => selected.has(recipe.id));\n}\n\n/** Execute one non-salvage recipe inside an active `withItemTransaction` callback. */\n",
      "  const inventory = await inventoryBoard(client, actor.owner);\n  actor.inventory = inventory;\n  const selected = new Set(recipes.map((recipe) => recipe.id));\n  return recipeCatalog(actor, context).filter((recipe) => selected.has(recipe.id));\n}\n\n/** Execute one non-salvage recipe inside an active `withItemTransaction` callback. */\n"
    ]
  ],
  "src/routes/worldgraph.js": [
    [
      "import * as G from '../game.js';\nimport {\n  createCraftingContext,\n  recipeActionCatalog,\n  craftWorldGraphRecipe,\n  salvageCar,\n} from '../crafting.js';\n",
      "import * as G from '../game.js';\nimport {\n  createCraftingContext,\n  recipeCatalog,\n  craftWorldGraphRecipe,\n  salvageCar,\n} from '../crafting.js';\n"
    ],
    [
      "  completeNode,\n  createMysteryContext,\n  discoverNode,\n  exploreMystery,\n  mysteryBoard,\n  startMystery,\n} from '../mysteries.js';\n",
      "  completeNode,\n  createMysteryContext,\n  discoverNode,\n  mysteryBoard,\n  startMystery,\n} from '../mysteries.js';\n"
    ],
    [
      "  createOperationContext,\n  openOperation,\n  operationBoard,\n  operationUiActions,\n  operationDefinitions,\n  roleBoard,\n} from '../operations.js';\nimport { loadAndValidatePhase1WorldGraph } from '../content/phase1-validation.js';\nimport { coreProgressionContent } from '../content/core-progression.js';\nimport { compileWorldObjects } from '../world-kernel.js';\nimport { issuedAction, inventoryUi, mysteryStartActions, mysteryUi, segment } from '../worldgraph-ui.js';\n\n// Module initialization is the server boot boundary: the same complete graph, executable adapter,\n// and economy-policy gate used by CI must pass before these routes can be registered.\n",
      "  createOperationContext,\n  openOperation,\n  operationBoard,\n  operationDefinitions,\n  roleBoard,\n} from '../operations.js';\nimport { loadAndValidatePhase1WorldGraph } from '../content/phase1-validation.js';\nimport { coreProgressionContent } from '../content/core-progression.js';\nimport { compileWorldObjects } from '../world-kernel.js';\n\n// Module initialization is the server boot boundary: the same complete graph, executable adapter,\n// and economy-policy gate used by CI must pass before these routes can be registered.\n"
    ],
    [
      "  registry: PHASE1_WORLD_GRAPH, accountId, now: new Date().toISOString(),\n});\n\nasync function withOperationActions(client, accountId, operationId, board) {\n  const issued = await operationUiActions(client, operationContext(accountId), operationId,\n    { visibleNodeIds: board.nodes.map(node => node.id) });\n  const nodes = new Map(issued.nodes.map(node => [node.id, node]));\n  const roles = new Map(issued.roles.map(role => [role.roleId, role]));\n  return { ...board, actions: issued.actions,\n    nodes: board.nodes.map(node => ({ ...node, ...(nodes.get(node.id) || {}) })),\n    ...(board.roles ? { roles: board.roles.map(role => ({ ...role, actions: roles.get(role.roleId)?.actions || [] })) } : {}) };\n}\n\nasync function mutate(pool, reply, action, { allowPrivateEvidence = false } = {}) {\n  try {\n    const receipt = await withItemTransaction(pool, action);\n",
      "  registry: PHASE1_WORLD_GRAPH, accountId, now: new Date().toISOString(),\n});\n\nasync function mutate(pool, reply, action, { allowPrivateEvidence = false } = {}) {\n  try {\n    const receipt = await withItemTransaction(pool, action);\n"
    ],
    [
      "    )));\n\n  app.get('/v1/worldgraph/inventory', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (ch, client) => {\n      const account = inventoryUi(await inventoryBoard(client, { scope: 'account', id: req.user.sub }),\n        registryFor(req.user.sub), { assignable: true });\n      const carried = inventoryUi(await inventoryBoard(client, { scope: 'character', id: ch.id }), registryFor(req.user.sub));\n      return { ...account, currentCharacterItems: carried.items, currentCharacterStacks: carried.stacks };\n    }));\n\n  app.get('/v1/worldgraph/recipes', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (ch, client, h) => ({\n      recipes: recipeActionCatalog({\n        character: ch,\n        cash: Number(ch.cash),\n        owned: h.owned,\n",
      "    )));\n\n  app.get('/v1/worldgraph/inventory', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (_ch, client) => safeInventory(\n      await inventoryBoard(client, { scope: 'account', id: req.user.sub }),\n    )));\n\n  app.get('/v1/worldgraph/recipes', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (ch, client, h) => ({\n      recipes: recipeCatalog({\n        character: ch,\n        cash: Number(ch.cash),\n        owned: h.owned,\n"
    ],
    [
      "    )));\n\n  app.get('/v1/worldgraph/mysteries', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (ch, client) => {\n      const historicalInstances = (await client.query(\n        `SELECT id,graph_id,graph_version,status FROM mystery_instances\n         WHERE authority_account_id=$1 AND owner_scope='character' AND owner_id<>$2 ORDER BY created_at DESC`,\n        [req.user.sub, ch.id],\n      )).rows.map(row => ({ instanceId: row.id, graphId: row.graph_id, version: Number(row.graph_version),\n        status: row.status, title: row.graph_id,\n        actions: row.status === 'active' ? [issuedAction('cancel:' + row.id, 'Recover held items and close',\n          '/v1/worldgraph/mysteries/' + segment(row.graph_id) + '/cancel', { instanceId: row.id }, [],\n          'Closes this historical quest. Held items return to their exact original depositor; they do not pass to your heir.')] : [] }));\n      return { mysteries: (await mysteryDiscovery(client, req.user.sub, ch.id, registryFor(req.user.sub))).map(mysteryStartActions),\n        historicalInstances };\n    }));\n\n  app.post('/v1/worldgraph/mysteries/:graphId/start', mutationOptions(auth), async (req, reply) =>\n    mutate(pool, reply, async (client) => {\n",
      "    )));\n\n  app.get('/v1/worldgraph/mysteries', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (ch, client) => ({\n      mysteries: await mysteryDiscovery(client, req.user.sub, ch.id, registryFor(req.user.sub)),\n    })));\n\n  app.post('/v1/worldgraph/mysteries/:graphId/start', mutationOptions(auth), async (req, reply) =>\n    mutate(pool, reply, async (client) => {\n"
    ],
    [
      "    if (progressionFor(req.user.sub)) {\n      reply.header('cache-control', 'no-store');\n      try {\n        return await withItemRead(pool, async (client) => safeValue(mysteryUi(await mysteryBoard(client,\n          mysteryContext(req.user.sub), await currentCharacterOwner(client, req.user.sub), req.params.graphId), registryFor(req.user.sub))));\n      } catch (error) { throw publicError(error); }\n    }\n    return readForPlayer(pool, req.user.sub, async (ch, client) => safeValue(mysteryUi(await mysteryBoard(\n      client, mysteryContext(req.user.sub), { scope: 'character', id: ch.id }, req.params.graphId,\n    ), registryFor(req.user.sub))), { locked: true });\n  });\n\n  app.post('/v1/worldgraph/mysteries/:graphId/explore', mutationOptions(auth), async (req, reply) =>\n    mutate(pool, reply, async (client) => exploreMystery(client, mysteryContext(req.user.sub),\n      await currentCharacterOwner(client, req.user.sub), req.params.graphId,\n      { idempotencyKey: innerIdempotencyKey(req.user.sub, req.headers['idempotency-key']) })));\n\n  app.post('/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/discover',\n    mutationOptions(auth, INTERACTION_BODY), async (req, reply) => mutate(pool, reply, async (client) => {\n      const owner = await currentCharacterOwner(client, req.user.sub);\n",
      "    if (progressionFor(req.user.sub)) {\n      reply.header('cache-control', 'no-store');\n      try {\n        return await withItemRead(pool, async (client) => safeValue(await mysteryBoard(client,\n          mysteryContext(req.user.sub), await currentCharacterOwner(client, req.user.sub), req.params.graphId)));\n      } catch (error) { throw publicError(error); }\n    }\n    return readForPlayer(pool, req.user.sub, async (ch, client) => safeValue(await mysteryBoard(\n      client, mysteryContext(req.user.sub), { scope: 'character', id: ch.id }, req.params.graphId,\n    )), { locked: true });\n  });\n\n  app.post('/v1/worldgraph/mysteries/:graphId/nodes/:nodeId/discover',\n    mutationOptions(auth, INTERACTION_BODY), async (req, reply) => mutate(pool, reply, async (client) => {\n      const owner = await currentCharacterOwner(client, req.user.sub);\n"
    ],
    [
      "    }));\n\n  app.get('/v1/worldgraph/operations', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (ch, client) => {\n      const operations = (await operationDiscovery(client, req.user.sub, ch.id)).map(entry => ({ ...entry,\n        actions: entry.operationId ? [] : [issuedAction('open:' + entry.operationNodeId, 'Open this crew operation',\n          '/v1/worldgraph/operations/' + segment(entry.graphId) + '/' + segment(entry.operationNodeId) + '/open',\n          {}, entry.blockedBy, 'This opens an operation for your current crew. Each role needs a different account.')] }));\n      const visible = new Set(operations.map(entry => entry.operationId));\n      const recoverableOperations = (await client.query(\n        `SELECT id,graph_id,graph_version,status FROM world_operations\n         WHERE opened_by_account_id=$1 AND status IN ('forming','active') ORDER BY created_at DESC`, [req.user.sub],\n      )).rows.filter(row => !visible.has(row.id)).map(row => ({ operationId: row.id, graphId: row.graph_id,\n        version: Number(row.graph_version), status: row.status, title: row.graph_id,\n        actions: [issuedAction('cancel:' + row.id, 'Close this operation and recover held items',\n          '/v1/worldgraph/operations/' + segment(row.id) + '/cancel', {}, [],\n          'Only its original opener can cancel. Held items return to their recorded depositors, even after crew or character changes.')] }));\n      return { operations, recoverableOperations };\n    }));\n\n  app.post('/v1/worldgraph/operations/:graphId/:operationNodeId/open', mutationOptions(auth),\n    async (req, reply) => mutate(pool, reply, (client) => {\n",
      "    }));\n\n  app.get('/v1/worldgraph/operations', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (ch, client) => ({\n      operations: await operationDiscovery(client, req.user.sub, ch.id),\n    })));\n\n  app.post('/v1/worldgraph/operations/:graphId/:operationNodeId/open', mutationOptions(auth),\n    async (req, reply) => mutate(pool, reply, (client) => {\n"
    ],
    [
      "  app.get('/v1/worldgraph/operations/:operationId', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (_ch, client) => {\n      await requireCurrentCrewOperation(client, req.user.sub, req.params.operationId);\n      const board = await operationBoard(\n        client, operationContext(req.user.sub), req.params.operationId,\n      );\n      return safeValue(await withOperationActions(client, req.user.sub, req.params.operationId, board));\n    }));\n\n  app.get('/v1/worldgraph/operations/:operationId/role', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (_ch, client) => {\n      await requireCurrentCrewOperation(client, req.user.sub, req.params.operationId);\n      const board = await roleBoard(\n        client, operationContext(req.user.sub), req.params.operationId,\n      );\n      return safeValue(await withOperationActions(client, req.user.sub, req.params.operationId, board), { allowPrivateEvidence: true });\n    }));\n\n  app.post('/v1/worldgraph/operations/:operationId/roles/:roleId', mutationOptions(auth),\n",
      "  app.get('/v1/worldgraph/operations/:operationId', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (_ch, client) => {\n      await requireCurrentCrewOperation(client, req.user.sub, req.params.operationId);\n      return safeValue(await operationBoard(\n        client, operationContext(req.user.sub), req.params.operationId,\n      ));\n    }));\n\n  app.get('/v1/worldgraph/operations/:operationId/role', { preHandler: auth }, async (req) =>\n    readForPlayer(pool, req.user.sub, async (_ch, client) => {\n      await requireCurrentCrewOperation(client, req.user.sub, req.params.operationId);\n      return safeValue(await roleBoard(\n        client, operationContext(req.user.sub), req.params.operationId,\n      ), { allowPrivateEvidence: true });\n    }));\n\n  app.post('/v1/worldgraph/operations/:operationId/roles/:roleId', mutationOptions(auth),\n"
    ]
  ]
};
export function assertCitySourceTransfer(file, text) {
  assert(Object.hasOwn(CITY_SOURCE_CURRENT_PINS, file), 'Unknown City transfer source');
  assert.equal(hash(text), CITY_SOURCE_CURRENT_PINS[file], 'City transfer source changed: ' + file);
  let baselineText = text;
  if (file === 'src/server.js') {
    assert.equal(text.split(cityStaticAssets).length, 2, 'City asset registration is not exact and unique');
    baselineText = text.replace(cityStaticAssets, '');
  } else if (file === 'src/operations.js') {
    for (const [current, original] of operationReadInverse) {
      assert.equal(baselineText.split(current).length, 2, 'Operation read-path inverse is not exact and unique');
      baselineText = baselineText.replace(current, original);
    }
    // Bound the large projection by unique exact anchors and its complete digest, never a loose
    // regex/function-name deletion. The reconstructed whole predecessor digest is checked below.
    assert.equal(baselineText.split(operationUiStart).length, 2, 'Operation UI projection start is not exact and unique');
    assert.equal(baselineText.split(operationUiEnd).length, 2, 'Operation UI projection end is not exact and unique');
    const start = baselineText.indexOf(operationUiStart), end = baselineText.indexOf(operationUiEnd, start);
    assert(end > start, 'Operation UI projection boundaries changed');
    const projection = baselineText.slice(start, end);
    assert.equal(hash(projection), operationUiPin, 'Operation UI projection source changed');
    baselineText = baselineText.slice(0, start) + baselineText.slice(end);
  } else {
    for (const [current, original] of cityExtensionInverse[file]) {
      assert.equal(baselineText.split(current).length, 2, 'City extension inverse is not exact and unique');
      baselineText = baselineText.replace(current, original);
    }
  }
  assert.equal(hash(baselineText), CITY_SOURCE_PREDECESSOR_PINS[file], 'Source differs beyond exact City changes');
  return { baselineText, baselineSha256: CITY_SOURCE_PREDECESSOR_PINS[file], actualSha256: hash(text),
    sourceRevision: CITY_SOURCE_REVIEWED_REVISION, predecessorRevision: CITY_SOURCE_PREDECESSOR_REVISION,
    inverseChunks: file === 'src/server.js' ? 1 : file === 'src/operations.js' ? 4 : cityExtensionInverse[file].length,
    ...(file === 'src/server.js' ? { publicGetRoutes: 6 } : file === 'src/operations.js'
      ? { projectionSha256: operationUiPin, mutationLockDefault: true } : {}) };
}

// Exact routing/quote inverse guards preserve historical personal-recovery and
// car-melt evidence; they grant no depot, supplier or agent authority coverage.
export const ECONOMY_SOURCE_CURRENT_PINS = Object.freeze({
  "src/economy.js": "c47bdfc17770ab3f47f9f5396547bdc408902fa3bdec1ba9ceb2e0934df0651b",
  "src/server.js": "2a8f9eb10ccebed5f5304230435f33cd1e39241c616a7cb4c442097002530d57"
});
const economySourceInverse = {
  "src/economy.js": {
    "baseline": "f563ee157adf73627e0c457be43a262151aa9ae92132aa6468ef9b63b285e835",
    "changes": [
      [
        "import { goodsBuyQuote } from './goodsquote.js';\n",
        ""
      ],
      [
        "  const { unit, subtotal: cost, fee, tax } = goodsBuyQuote(goodId, ch.loc, n, h.owned);\n",
        "  const unit = Math.round(goodPriceOf(goodId, ch.loc) * turfMult([...(h.owned.held || []), ...(h.owned.deedPerk || [])], ch.loc, 'buy'));\n  const cost = unit * n, fee = Math.ceil(cost * 0.01), tax = Math.ceil(cost * 0.01);\n"
      ]
    ]
  },
  "src/server.js": {
    "baseline": "cf17311eeea98729ba277c722eb18426cdbfd1da863859684fdeec31a793dc97",
    "changes": [
      ["import { register as registerResources } from './routes/resources.js';\n",""],
      ["  registerResources(app, { pool, auth, modAuth });\n",""],
      [
        "import * as Depot from './depot.js';\nimport * as Delivery from './delivery.js';\nimport { register as registerDelivery } from './routes/delivery.js';\nimport { register as registerDepot } from './routes/depot.js';\n",
        ""
      ],
      [
        "  registerDepot(app, { pool, auth });\n  registerDelivery(app, { pool, auth });\n",
        ""
      ],
      [
        "      case 'restock_buy':\n",
        ""
      ],
      [
        "      case 'restock_travel':\n      case 'depot_travel':\n",
        ""
      ],
      [
        "      case 'depot_restock': return Depot.restockDepot(ch, tail('/v1/depot/').replace(/\\/restock$/, ''), client, h,\n        { automated: true, policyId: action.body.policyId });\n      case 'delivery_accept': return Delivery.acceptDelivery(ch, action.body.orderId, action.body, client);\n      case 'delivery_deliver': return Delivery.deliverCommitment(ch, action.body.commitmentId, action.body.qty, client, h);\n      case 'delivery_buy':\n      case 'delivery_travel': return Delivery.deliveryStep(ch, action.body.commitmentId, action.kind, action.body, client, h);\n      case 'depot_receive': {\n        const [id, order] = tail('/v1/depot/').split('/orders/');\n        return Depot.receiveDepot(ch, id, order.replace(/\\/receive$/, ''), client, { automated: true, policyId: action.body.policyId });\n      }\n",
        ""
      ]
    ]
  }
};
export function assertEconomySourceTransfer(file, text) {
 if (file === 'src/server.js' && hash(text) === CITY_SOURCE_CURRENT_PINS[file]) {
  const city = assertCitySourceTransfer(file, text), predecessor = assertEconomySourceTransfer(file, city.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + city.inverseChunks, citySourceTransfer: city };
 }
 const scope = economySourceInverse[file]; assert(scope, 'Unknown economy transfer source');
 if (hash(text) === scope.baseline) return { baselineText: text, baselineSha256: scope.baseline, actualSha256: hash(text), inverseChunks: 0 };
 assert.equal(hash(text), ECONOMY_SOURCE_CURRENT_PINS[file], 'Economy transfer source changed: ' + file);
 let baselineText = text;
 for (const [current, original] of scope.changes) { assert.equal(baselineText.split(current).length, 2, 'Economy source chunk is not exact and unique'); baselineText = baselineText.replace(current, original); }
 assert.equal(hash(baselineText), scope.baseline, 'Source differs beyond exact economy changes');
 return { baselineText, baselineSha256: scope.baseline, actualSha256: hash(text), inverseChunks: scope.changes.length };
}
