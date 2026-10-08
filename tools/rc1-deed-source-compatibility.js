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

// Exact routing/quote inverse guards preserve historical personal-recovery and
// car-melt evidence; they grant no depot, supplier or agent authority coverage.
export const ECONOMY_SOURCE_CURRENT_PINS = Object.freeze({
  "src/economy.js": "c47bdfc17770ab3f47f9f5396547bdc408902fa3bdec1ba9ceb2e0934df0651b",
  "src/server.js": "bede99f055c871f8f73382f1eb68a2ce4fdf1f0418777739406ff45448742f4d"
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
 const scope = economySourceInverse[file]; assert(scope, 'Unknown economy transfer source');
 if (hash(text) === scope.baseline) return { baselineText: text, baselineSha256: scope.baseline, actualSha256: hash(text), inverseChunks: 0 };
 assert.equal(hash(text), ECONOMY_SOURCE_CURRENT_PINS[file], 'Economy transfer source changed: ' + file);
 let baselineText = text;
 for (const [current, original] of scope.changes) { assert.equal(baselineText.split(current).length, 2, 'Economy source chunk is not exact and unique'); baselineText = baselineText.replace(current, original); }
 assert.equal(hash(baselineText), scope.baseline, 'Source differs beyond exact economy changes');
 return { baselineText, baselineSha256: scope.baseline, actualSha256: hash(text), inverseChunks: scope.changes.length };
}
