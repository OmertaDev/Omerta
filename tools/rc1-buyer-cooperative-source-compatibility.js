import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

export const BUYER_COOPERATIVE_SOURCE_REVIEWED_REVISION = 'ac843ad2c444784a78cae377ab3b99aebb9f8a8f';
export const BUYER_COOPERATIVE_SOURCE_PREDECESSOR_REVISION = '880f494311b3aad625ce06af99fcb245b146a351';
export const BUYER_COOPERATIVE_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "711ae89162729555c52b8033ab28d39708f73b89c6e3ef10ef851416daf59c0f",
  "src/worker.js": "8ca31fc0b53ed0868de5f762f35805bab99989f93c7f76f4f7864cdae3f71312",
  "src/invariants.js": "c2879af55021696e1bc358e34bb95794737b3846a54de22be393c29101c68743",
  "src/social/estate.js": "6db50d8cd63eb0341971c4447b2b2c4b7c4bc82b8c8a98abd6232ab361a92498",
  "src/market.js": "542653aab9034940a6624389f502c841908ebade121fe08b6975d6987349df7e"
});
export const BUYER_COOPERATIVE_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "d09fa63bcd6a97db0678b50e721ea02268ddabf5c2f597ca8e258c4ea87e57e7",
  "src/worker.js": "2b1fd07f9a05759a5f926a46732da1d12678a5e9e7878dda44d99f888847b6f7",
  "src/invariants.js": "5c8fb1cb138b725b9f1751f35c2c647c2518c9e46499a75c9de5fa3a746a28cd",
  "src/social/estate.js": "f77948b134fb954543d7508040e34dc6263de69ce0b0712676f57c63ce4a901f",
  "src/market.js": "256bceb83fbc0e27d06df1d3ae3ab8538c7cdf15ce427f30fc77d11c1f56af8f"
});
export const BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "1b2b37ecc8ef58a3100b2e4f8acdac215ff74cc9",
  "src/worker.js": "a22472d88c3ed638df0e209007f35a703568e687",
  "src/invariants.js": "26ec65e64aa0c76519c2995df377c9529713fef4",
  "src/social/estate.js": "3c1adee020c5804f871a9daffba3f01db185c12b",
  "src/market.js": "34d9bb0dac36f554b26e97218d019372d529d1a8"
});
export const BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "cd572e3608fb1718d528bac54f09b98847e18201",
  "src/worker.js": "474b0b1dc0879354db82f5158977a13a3e05e670",
  "src/invariants.js": "eb9db8489d11149b77c2c442700daa24a3a2148c",
  "src/social/estate.js": "dc1dfba22e5c34e276612ad387d9271b84e11755",
  "src/market.js": "c87f3004c6d278d9c68d763764822d79eb127183"
});
export const BUYER_COOPERATIVE_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerCompanyLogisticsHubs } from './routes/companylogisticshubs.js';\nimport { register as registerBuyerCooperatives } from './routes/buyercooperatives.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n",
      "baseline": "import { register as registerCommercialPremises } from './routes/commercialpremises.js';\nimport { register as registerCompanyBankPortfolios } from './routes/companybankportfolios.js';\nimport { register as registerCompanyLogisticsHubs } from './routes/companylogisticshubs.js';\nimport { register as registerDepot } from './routes/depot.js';\nimport { register as registerResources } from './routes/resources.js';\nimport * as Speakeasy from './speakeasy.js';\n"
    },
    {
      "current": "  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n  registerCompanyLogisticsHubs(app, { pool, auth });\n  registerBuyerCooperatives(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n",
      "baseline": "  registerCommercialPremises(app, { pool, auth });\n  registerCompanyBankPortfolios(app, { pool, auth });\n  registerCompanyLogisticsHubs(app, { pool, auth });\n\n  registerHeists(app, { pool, auth });\n\n"
    }
  ],
  "src/worker.js": [
    {
      "current": "import { runCompanyOperators } from './companyoperatorrunner.js';\nimport { runCompanyWorkflows } from './companyworkflowrunner.js';\nimport { runCompanyBankPortfolios } from './companybankportfoliorunner.js';\nimport { expireBuyerCooperativeFunding } from './buyercooperativerunner.js';\nimport { sweepLaw } from './law.js';\nimport { sweepLoans } from './loans.js';\nimport { sweepAuctions, sweepConsignments } from './auction.js';\n",
      "baseline": "import { runCompanyOperators } from './companyoperatorrunner.js';\nimport { runCompanyWorkflows } from './companyworkflowrunner.js';\nimport { runCompanyBankPortfolios } from './companybankportfoliorunner.js';\nimport { sweepLaw } from './law.js';\nimport { sweepLoans } from './loans.js';\nimport { sweepAuctions, sweepConsignments } from './auction.js';\n"
    },
    {
      "current": "      await safe('company operators', () => runCompanyOperators(pool, 20));\n      await safe('company workflows', () => runCompanyWorkflows(pool, 20));\n      await safe('company bank portfolios', () => runCompanyBankPortfolios(pool, 20));\n      await safe('buyer cooperative funding expiry', () => expireBuyerCooperativeFunding(pool, 20));\n    }\n    finally { companyTicking = false; }\n  };\n",
      "baseline": "      await safe('company operators', () => runCompanyOperators(pool, 20));\n      await safe('company workflows', () => runCompanyWorkflows(pool, 20));\n      await safe('company bank portfolios', () => runCompanyBankPortfolios(pool, 20));\n    }\n    finally { companyTicking = false; }\n  };\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "import { commercialPremisesInvariant } from './commercialpremisesinvariants.js';\nimport { runCompanyBankPortfolioInvariants } from './companybankportfolioinvariants.js';\nimport { logisticsHubInvariant } from './companylogisticshubsinvariants.js';\nimport { runBuyerCooperativeInvariants } from './buyercooperativeinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
      "baseline": "import { commercialPremisesInvariant } from './commercialpremisesinvariants.js';\nimport { runCompanyBankPortfolioInvariants } from './companybankportfolioinvariants.js';\nimport { logisticsHubInvariant } from './companylogisticshubsinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
    },
    {
      "current": "    'favor:',\n    'intel_job:', 'employment:reserve:', 'employment:wage:', 'employment:refund:', 'employment:estate:loot:',\n    'commercial_premises:rent:pay', 'commercial_premises:rent:receive',\n    'buyer_cooperative:fund', 'buyer_cooperative:refund', 'buyer_cooperative:death_cash', 'buyer_cooperative:loot_cash',\n    // COMMISSION step three: proposal deposits — treasury→escrow (`commission:proposal`, NULL char),\n    // refunded on an enacted motion (`commission:refund`) or forfeited to the confiscation pool\n    // (`commission:forfeit`) — reconciled by the treasury check (b) + the commission-escrow check\n",
      "baseline": "    'favor:',\n    'intel_job:', 'employment:reserve:', 'employment:wage:', 'employment:refund:', 'employment:estate:loot:',\n    'commercial_premises:rent:pay', 'commercial_premises:rent:receive',\n    // COMMISSION step three: proposal deposits — treasury→escrow (`commission:proposal`, NULL char),\n    // refunded on an enacted motion (`commission:refund`) or forfeited to the confiscation pool\n    // (`commission:forfeit`) — reconciled by the treasury check (b) + the commission-escrow check\n"
    },
    {
      "current": "    // the Safe's genesis reserve, reconciled by the 'drop claims ledgered' check below).\n    'drop:'],\n  cb: ['crime:', 'craft:', 'gun:buy:', 'jump:', 'death:', 'exchange:', 'onboard:', 'cook:'],\n  gin: ['buyer_cooperative:claim', 'buyer_cooperative:death_gin'],\n  ammo: ['melt', 'melt:tithe', 'craft:ammo', 'ammo:buy', 'jump', 'fire', 'death:', 'exchange:', 'gang:dissolved', 'convoy:', 'world:', 'port:', 'contract:', 'family:'],\n};\n\n",
      "baseline": "    // the Safe's genesis reserve, reconciled by the 'drop claims ledgered' check below).\n    'drop:'],\n  cb: ['crime:', 'craft:', 'gun:buy:', 'jump:', 'death:', 'exchange:', 'onboard:', 'cook:'],\n  ammo: ['melt', 'melt:tithe', 'craft:ammo', 'ammo:buy', 'jump', 'fire', 'death:', 'exchange:', 'gang:dissolved', 'convoy:', 'world:', 'port:', 'contract:', 'family:'],\n};\n\n"
    },
    {
      "current": "    push(`franchise rounding:${license.id}`, paid, Math.min(Number(license.royalty_cap), expected), 0);\n  }\n  push('franchise royalty provenance', royaltyFaults, 0, 0);\n  push('depot procurement', -depotCash('restock_escrow'), -(await sum(pool, \"currency='cash' AND reason='market:order' AND character_id IS NULL AND (counterparty IS NULL OR counterparty NOT IN (SELECT id FROM buyer_cooperatives))\")), 0);\n  push('depot refunds', depotCash('restock_refund'), await sum(pool, \"currency='cash' AND reason='market:refund' AND character_id IS NULL AND (counterparty IS NULL OR counterparty NOT IN (SELECT id FROM buyer_cooperatives))\"), 0);\n  push('depot listing fees', -depotCash('restock_fee'), -(await sum(pool, \"currency='cash' AND reason='market:list' AND character_id IS NULL AND (counterparty IS NULL OR counterparty NOT IN (SELECT id FROM buyer_cooperatives))\")), 0);\n  push('depot death burn', -depotCash('death'), -(await sum(pool, \"currency='cash' AND reason='depot:death'\")), 0);\n  push('warehouse rent ledger', depotCash('warehouse_rent'), -(await sum(pool, \"currency='cash' AND reason='warehouse:rent'\")), 0);\n  push('warehouse journal ownership', depotJournal.filter(j => j.lease_id ? !warehouseLeases.some(l =>\n",
      "baseline": "    push(`franchise rounding:${license.id}`, paid, Math.min(Number(license.royalty_cap), expected), 0);\n  }\n  push('franchise royalty provenance', royaltyFaults, 0, 0);\n  push('depot procurement', -depotCash('restock_escrow'), -(await sum(pool, \"currency='cash' AND reason='market:order' AND character_id IS NULL\")), 0);\n  push('depot refunds', depotCash('restock_refund'), await sum(pool, \"currency='cash' AND reason='market:refund' AND character_id IS NULL\"), 0);\n  push('depot listing fees', -depotCash('restock_fee'), -(await sum(pool, \"currency='cash' AND reason='market:list' AND character_id IS NULL\")), 0);\n  push('depot death burn', -depotCash('death'), -(await sum(pool, \"currency='cash' AND reason='depot:death'\")), 0);\n  push('warehouse rent ledger', depotCash('warehouse_rent'), -(await sum(pool, \"currency='cash' AND reason='warehouse:rent'\")), 0);\n  push('warehouse journal ownership', depotJournal.filter(j => j.lease_id ? !warehouseLeases.some(l =>\n"
    },
    {
      "current": "  push('company bank portfolio authority and lifetime budget', bankPortfolios.issues.length, 0, 0, { issues: bankPortfolios.issues });\n  const hubs = await logisticsHubInvariant(pool);\n  push(hubs.name, hubs.defects.length, 0, 0, { defects: hubs.defects });\n  const cooperatives = await runBuyerCooperativeInvariants(pool);\n  const cooperativeFunding = -(await sum(pool, \"currency='cash' AND character_id IS NOT NULL AND reason IN ('buyer_cooperative:fund','buyer_cooperative:refund')\"));\n  const cooperativeMarket = await sum(pool, \"currency='cash' AND character_id IS NULL AND reason IN ('market:order','market:list','market:refund') AND counterparty IN (SELECT id FROM buyer_cooperatives)\");\n  const cooperativeDeath = await sum(pool, \"currency='cash' AND character_id IS NULL AND reason IN ('buyer_cooperative:death_cash','buyer_cooperative:loot_cash')\");\n  push('buyer cooperative cash custody', cooperatives.cashEscrow, cooperativeFunding + cooperativeMarket + cooperativeDeath, 0);\n  const cooperativeCapturedGin = await one(pool, \"SELECT COALESCE(SUM(gin_delta),0) s FROM buyer_cooperative_journal WHERE kind='settle'\");\n  const cooperativeClaimedGin = await sum(pool, \"currency='gin' AND reason='buyer_cooperative:claim'\");\n  const cooperativeDeathGin = await sum(pool, \"currency='gin' AND reason='buyer_cooperative:death_gin'\");\n  push('buyer cooperative GIN custody', cooperatives.ginEscrow, cooperativeCapturedGin - cooperativeClaimedGin + cooperativeDeathGin, 0);\n  push('buyer cooperative settlement provenance', cooperatives.issues.length, 0, 0, { issues: cooperatives.issues });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n",
      "baseline": "  push('company bank portfolio authority and lifetime budget', bankPortfolios.issues.length, 0, 0, { issues: bankPortfolios.issues });\n  const hubs = await logisticsHubInvariant(pool);\n  push(hubs.name, hubs.defects.length, 0, 0, { defects: hubs.defects });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n"
    }
  ],
  "src/social/estate.js": [
    {
      "current": "import { voidCommercialPremisesAtDeath } from '../commercialpremises.js';\nimport { closeCompanyBankPortfoliosAtDeath } from '../companybankportfolios.js';\nimport { voidLogisticsHubsAtDeath } from '../companylogisticshubs.js';\nimport { recoverBuyerCooperativesAtDeath } from '../buyercooperativecustody.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n",
      "baseline": "import { voidCommercialPremisesAtDeath } from '../commercialpremises.js';\nimport { closeCompanyBankPortfoliosAtDeath } from '../companybankportfolios.js';\nimport { voidLogisticsHubsAtDeath } from '../companylogisticshubs.js';\nimport { wipeSpeakeasyAtDeath } from '../speakeasy.js';\nimport { wipeRingAtDeath } from '../ring.js';\nimport { wipeFighterAtDeath, cancelMainEventsAtDeath } from '../boxing.js';\n"
    },
    {
      "current": "  // (red-team) the seasonal lootMult covers EVERY fire-kill loot surface — escrow legs included; the\n  // BLOOD OATH decree mult (threaded from fire) rides the SAME clamp so the escrow legs match the pocket loot.\n  const estateLootRate = opts.loot ? Math.min(0.5, M3.CASH_LOOT_RATE * (seasonModOf().lootMult || 1) * (opts.bloodOathMult || 1)) : 0;\n  const cooperative = await recoverBuyerCooperativesAtDeath(client, victim.id, h.ledger, opts.killerCh, estateLootRate);\n  if (cooperative.looted) report.cooperativeLoot = cooperative.looted;\n  const mkt = await voidListingsAtDeath(client, victim.id, opts.killerCh, estateLootRate);\n  if (opts.killerCh && mkt.selfRefund) opts.killerCh.cash = Number(opts.killerCh.cash) + mkt.selfRefund;\n  await burnBidsAtDeath(client, victim.id);\n",
      "baseline": "  // (red-team) the seasonal lootMult covers EVERY fire-kill loot surface — escrow legs included; the\n  // BLOOD OATH decree mult (threaded from fire) rides the SAME clamp so the escrow legs match the pocket loot.\n  const estateLootRate = opts.loot ? Math.min(0.5, M3.CASH_LOOT_RATE * (seasonModOf().lootMult || 1) * (opts.bloodOathMult || 1)) : 0;\n  const mkt = await voidListingsAtDeath(client, victim.id, opts.killerCh, estateLootRate);\n  if (opts.killerCh && mkt.selfRefund) opts.killerCh.cash = Number(opts.killerCh.cash) + mkt.selfRefund;\n  await burnBidsAtDeath(client, victim.id);\n"
    }
  ],
  "src/market.js": [
    {
      "current": "import { GameError, bus, ledger, notify, skillMult, trunkCap, npcTier, bumpStanding, bumpMastery, masteryFx } from './game.js';\nimport { BLACK_MARKET as MARKET, GOODS, SKILLS, UNDERWORLD , jailed, safeHoused, usd, carOf , districtName } from './rules.js';\nimport { logCarCollect } from './collection.js';\nimport { buyerCooperativeOrderBinding, settleBuyerCooperativeOrder } from './buyercooperativecustody.js';\n\nconst uid = () => crypto.randomUUID();\nconst expired = (l) => new Date(l.expires_at) <= new Date();\n",
      "baseline": "import { GameError, bus, ledger, notify, skillMult, trunkCap, npcTier, bumpStanding, bumpMastery, masteryFx } from './game.js';\nimport { BLACK_MARKET as MARKET, GOODS, SKILLS, UNDERWORLD , jailed, safeHoused, usd, carOf , districtName } from './rules.js';\nimport { logCarCollect } from './collection.js';\n\nconst uid = () => crypto.randomUUID();\nconst expired = (l) => new Date(l.expires_at) <= new Date();\n"
    },
    {
      "current": "  const l = (await client.query(\n    \"SELECT * FROM market_listings WHERE id=$1 AND kind='order' AND seller_character=$2 FOR UPDATE\", [listingId, ch.id])).rows[0];\n  if (!l) throw new GameError('no_order', 'Not your order.');\n  if (await buyerCooperativeOrderBinding(client, l.id)) throw new GameError('cooperative_order', 'Collect shared inventory through its buyer cooperative.');\n  if (l.depot_id) throw new GameError('business_order', 'Receive this inventory through its depot.');\n  if (ch.loc !== l.district) throw new GameError('district', `The warehouse is at ${districtName(l.district)} — be there.`, { district: l.district });\n  const avail = Number(l.filled_qty);\n",
      "baseline": "  const l = (await client.query(\n    \"SELECT * FROM market_listings WHERE id=$1 AND kind='order' AND seller_character=$2 FOR UPDATE\", [listingId, ch.id])).rows[0];\n  if (!l) throw new GameError('no_order', 'Not your order.');\n  if (l.depot_id) throw new GameError('business_order', 'Receive this inventory through its depot.');\n  if (ch.loc !== l.district) throw new GameError('district', `The warehouse is at ${districtName(l.district)} — be there.`, { district: l.district });\n  const avail = Number(l.filled_qty);\n"
    },
    {
      "current": "  const l = (await client.query(\n    \"SELECT * FROM market_listings WHERE id=$1 AND status IN ('live','expired') FOR UPDATE\", [listingId])).rows[0];\n  if (l?.depot_id) throw new GameError('business_order', 'Cancel this procurement through its depot.');\n  if (l && await buyerCooperativeOrderBinding(client, l.id)) throw new GameError('cooperative_order', 'Settle shared procurement through its buyer cooperative.');\n  if (l && await reservedQuantity(client, l.id)) throw new GameError('committed_order', 'Accepted supplier quantities cannot be cancelled.');\n  if (!l || l.seller_character !== ch.id) throw new GameError('no_listing', 'Not your listing.');\n  // audit #5 (reserve-lock grief): a standing bid holds the hammer — EXCEPT a bid that can never\n",
      "baseline": "  const l = (await client.query(\n    \"SELECT * FROM market_listings WHERE id=$1 AND status IN ('live','expired') FOR UPDATE\", [listingId])).rows[0];\n  if (l?.depot_id) throw new GameError('business_order', 'Cancel this procurement through its depot.');\n  if (l && await reservedQuantity(client, l.id)) throw new GameError('committed_order', 'Accepted supplier quantities cannot be cancelled.');\n  if (!l || l.seller_character !== ch.id) throw new GameError('no_listing', 'Not your listing.');\n  // audit #5 (reserve-lock grief): a standing bid holds the hammer — EXCEPT a bid that can never\n"
    },
    {
      "current": "        if (!l) { await client.query('COMMIT'); continue; } // raced a buy/cancel — nothing to do\n        const h = { ledger, notify };\n        if (l.kind === 'order') {\n          if (await buyerCooperativeOrderBinding(client, l.id)) {\n            await settleBuyerCooperativeOrder(client, l.id, ledger, { cancel: true });\n            await client.query('COMMIT');\n            lapsed++;\n            continue;\n          }\n          // an expired order refunds its un-filled escrow to a LIVING poster (a dead poster's\n          // escrow already burned in the estate — this is only a race guard); deliveries stay\n          // claimable, so the row flips to 'expired' rather than vanishing.\n",
      "baseline": "        if (!l) { await client.query('COMMIT'); continue; } // raced a buy/cancel — nothing to do\n        const h = { ledger, notify };\n        if (l.kind === 'order') {\n          // an expired order refunds its un-filled escrow to a LIVING poster (a dead poster's\n          // escrow already burned in the estate — this is only a race guard); deliveries stay\n          // claimable, so the row flips to 'expired' rather than vanishing.\n"
    },
    {
      "current": "  await closeDeliveriesAtDeath(client, victimId);\n  let selfRefund = 0, looted = 0;\n  const rows = (await client.query(\n    \"SELECT * FROM market_listings WHERE seller_character=$1 AND status IN ('live','expired') AND id NOT IN (SELECT order_id FROM buyer_cooperative_orders) FOR UPDATE\", [victimId])).rows;\n  for (const l of rows) {\n    if (l.kind === 'order') {\n      // the dead poster's un-filled escrow leaves the market. On a PLAYER fire-kill (lootRate > 0)\n",
      "baseline": "  await closeDeliveriesAtDeath(client, victimId);\n  let selfRefund = 0, looted = 0;\n  const rows = (await client.query(\n    \"SELECT * FROM market_listings WHERE seller_character=$1 AND status IN ('live','expired') FOR UPDATE\", [victimId])).rows;\n  for (const l of rows) {\n    if (l.kind === 'order') {\n      // the dead poster's un-filled escrow leaves the market. On a PLAYER fire-kill (lootRate > 0)\n"
    },
    {
      "current": "      await notify(client, l.bidder, 'market_outbid', { listing: l.id, voided: true });\n    }\n  }\n  await client.query(\"DELETE FROM market_listings WHERE seller_character=$1 AND id NOT IN (SELECT order_id FROM buyer_cooperative_orders)\", [victimId]);\n  return { selfRefund, looted };\n}\n// the dead man's standing BIDS burn (the dead-funder precedent) — the auctions reopen.\n",
      "baseline": "      await notify(client, l.bidder, 'market_outbid', { listing: l.id, voided: true });\n    }\n  }\n  await client.query(\"DELETE FROM market_listings WHERE seller_character=$1\", [victimId]);\n  return { selfRefund, looted };\n}\n// the dead man's standing BIDS burn (the dead-funder precedent) — the auctions reopen.\n"
    }
  ]
});
export const BUYER_COOPERATIVE_SOURCE_TRANSFER = Object.freeze({
  sourceRevision: BUYER_COOPERATIVE_SOURCE_REVIEWED_REVISION,
  predecessorRevision: BUYER_COOPERATIVE_SOURCE_PREDECESSOR_REVISION,
  currentPins: BUYER_COOPERATIVE_SOURCE_CURRENT_PINS, baselinePins: BUYER_COOPERATIVE_SOURCE_BASELINE_PINS,
  currentBlobs: BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS, baselineBlobs: BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(BUYER_COOPERATIVE_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-buyer-cooperative-source-compatibility.js', phase: 'exact source transfer only; financial activation disabled',
  scope: "Only five complete frozen server, worker, invariant, estate and Market Git blobs and their exact unique cooperative registration, bounded expiry runner, custody reconciliation, Market routing and estate Git hunks reconstruct complete N06 predecessors. All prior pins and negative controls retain their scope. Personal claim/cancel refusals, joint expiry/estate exclusions, null-ledger depot discriminator, cash and GIN books, source custody, member death and active recovery require separate current-source cooperative proofs. This adapter adds no world-soak, native financial, accounting audit clearance, deployment or onchain qualification."
});
export function assertBuyerCooperativeSourceTransfer(file, input) {
  assert(Object.hasOwn(BUYER_COOPERATIVE_SOURCE_CURRENT_PINS, file), 'Unknown Buyer Cooperative source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, BUYER_COOPERATIVE_SOURCE_CURRENT_PINS[file], 'Buyer Cooperative source changed: ' + file);
  assert.equal(blob(text), BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS[file], 'Buyer Cooperative full Git blob changed: ' + file);
  let baselineText = text;
  for (const chunk of BUYER_COOPERATIVE_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Buyer Cooperative inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = BUYER_COOPERATIVE_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Buyer Cooperative source differs beyond exact reviewed hunks: ' + file);
  assert.equal(blob(baselineText), BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS[file], 'Buyer Cooperative complete predecessor blob differs: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: BUYER_COOPERATIVE_SOURCE_INVERSES[file].length,
    sourceRevision: BUYER_COOPERATIVE_SOURCE_REVIEWED_REVISION, sourceBlob: BUYER_COOPERATIVE_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: BUYER_COOPERATIVE_SOURCE_PREDECESSOR_REVISION, predecessorBlob: BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS[file],
    evidence: BUYER_COOPERATIVE_SOURCE_TRANSFER.evidence, phase: BUYER_COOPERATIVE_SOURCE_TRANSFER.phase, scope: BUYER_COOPERATIVE_SOURCE_TRANSFER.scope };
}
export function qualifyBuyerCooperativeSource(file, input) {
  assert(Object.hasOwn(BUYER_COOPERATIVE_SOURCE_BASELINE_PINS, file), 'Unknown Buyer Cooperative source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === BUYER_COOPERATIVE_SOURCE_BASELINE_PINS[file]) {
    assert.equal(blob(text), BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS[file], 'Buyer Cooperative complete predecessor blob differs: ' + file);
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: BUYER_COOPERATIVE_SOURCE_PREDECESSOR_REVISION, sourceBlob: BUYER_COOPERATIVE_SOURCE_BASELINE_BLOBS[file],
      evidence: BUYER_COOPERATIVE_SOURCE_TRANSFER.evidence, phase: BUYER_COOPERATIVE_SOURCE_TRANSFER.phase, scope: BUYER_COOPERATIVE_SOURCE_TRANSFER.scope };
  }
  return assertBuyerCooperativeSourceTransfer(file, text);
}
// Unknown bytes are retained for their original rejecting source guard, never stripped by pattern.
export function buyerCooperativeSourceBaseline(file, input) {
  const text = normalize(input);
  return Object.hasOwn(BUYER_COOPERATIVE_SOURCE_CURRENT_PINS, file) && hash(text) === BUYER_COOPERATIVE_SOURCE_CURRENT_PINS[file]
    ? assertBuyerCooperativeSourceTransfer(file, text).baselineText : text;
}
