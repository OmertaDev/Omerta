import { companySuccessionSourceBaseline } from './rc1-company-succession-source-compatibility.js';
import { strategySourceBaseline } from './rc1-strategy-source-compatibility.js';
import { coverageSourceBaseline } from './rc1-logistics-coverage-source-compatibility.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const INVOICE_SOURCE_REVIEWED_REVISION = "ea654f61659e38acfc09b55cf8c95a4f971e054e";
export const INVOICE_SOURCE_PREDECESSOR_REVISION = "df4e87984066a296889fbf0173f9179187445b26";
export const INVOICE_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "a3a4ca0ec758c6b004737ac7be2c894e4410f5adbc60f1979570b2cfd80e6e69",
  "src/invariants.js": "c9b4de1c12760e5148f03cf69ad46d59513ea2debc8b4084e39ad567c007afa9",
  "src/loans.js": "2393c2e961842b92d40b08b101e32b138f8cd4ff9e82d4c235bda2741f0f71e9",
  "src/delivery.js": "abeed34ebfb26b00f9b97e9a50f5a6e9b06e4966fc1520307e7344310e23635b",
  "src/market.js": "256bceb83fbc0e27d06df1d3ae3ab8538c7cdf15ce427f30fc77d11c1f56af8f",
  "src/routes/delivery.js": "ac95352637a33e7836a1a69e1d7ad80cd0afff19fb08750392eddb08563a36ed",
  "src/courierjobs.js": "f4cb7494e06aa9e87700d99a9bcdcf8f1b73900a58e5a365d8695afa7cef8185"
});
export const INVOICE_SOURCE_BASELINE_PINS = Object.freeze({
  "src/server.js": "9b968fc85aab3666b0a9e1d1e22ab38647b883bc3039e8bd11dbec4e50dfd5f3",
  "src/invariants.js": "5f66d3ef90645eeaed7c84e5604249d94db4c32884dc7f6e8c758f54600a66a1",
  "src/loans.js": "e5440abea494c28d3726aae9aee489953b731e168fbdf3d7713d894c655f6843",
  "src/delivery.js": "3322ec74f770ca89259c35f3dfc9d772f407f10d43e4c283920df2b57cd2081f",
  "src/market.js": "1d7196656c0ee326ccd9761e4c8f57fc3f484a3cf55ca5907b4692e9639e23f2",
  "src/routes/delivery.js": "d77982484013efaf52d06da04a65bcd671b4e2e95008dccf78fdd68c8d330482",
  "src/courierjobs.js": "4138e3b73f8ad1400a706eed40ab53d65c96e2cf6537efdaa3dcf490933c729d"
});
export const INVOICE_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "acb31436b99a464a62754942582871f118af14da",
  "src/invariants.js": "475dbed2d6747ac0274f7d8dfbf048c55f41f235",
  "src/loans.js": "71963bb297c0dc7b3d745b48fc7a6fc49ab3ffd6",
  "src/delivery.js": "269c91c70bcdc9be82cb6122242414674fd5c159",
  "src/market.js": "c87f3004c6d278d9c68d763764822d79eb127183",
  "src/routes/delivery.js": "395c4ec26f162c8e4caf2fc94c869fe52286f575",
  "src/courierjobs.js": "ac0bc66d93853b1155d2581df0b9c93a734c48d9"
});
export const INVOICE_SOURCE_BASELINE_BLOBS = Object.freeze({
  "src/server.js": "cb1b1a2acf90fcd702c0cf31b26705477e1f72c1",
  "src/invariants.js": "cc8bd5324ceffb9b37371682c5cedac64b5f4e92",
  "src/loans.js": "4708d8256eb9d40a83202c3ac371a9e2d9e735d9",
  "src/delivery.js": "311cad308598dd6a8f57cd3a9f8d16cad23d23b2",
  "src/market.js": "0a57b820a4a69d31bbac3656f4f4d9f2d510a8a6",
  "src/routes/delivery.js": "4a28caece062ba0252abb9f9847dff429187b74f",
  "src/courierjobs.js": "5e738bd1fa4f2993994424c1f6a633f4e0f18523"
});
export const INVOICE_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    {
      "current": "import * as Depot from './depot.js';\nimport * as Delivery from './delivery.js';\nimport { register as registerDelivery } from './routes/delivery.js';\nimport { register as registerDeliveryFinance, takeOwnedAdvance } from './routes/deliveryfinance.js';\nimport * as DeliveryFinance from './deliveryfinance.js';\nimport { register as registerSupplyTenders } from './routes/supplytenders.js';\nimport { register as registerWarehouses } from './routes/warehouses.js';\nimport { register as registerCrewLogistics } from './routes/crewlogistics.js';\n",
      "baseline": "import * as Depot from './depot.js';\nimport * as Delivery from './delivery.js';\nimport { register as registerDelivery } from './routes/delivery.js';\nimport { register as registerSupplyTenders } from './routes/supplytenders.js';\nimport { register as registerWarehouses } from './routes/warehouses.js';\nimport { register as registerCrewLogistics } from './routes/crewlogistics.js';\n"
    },
    {
      "current": "  app.post('/v1/loans', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Loans.offerLoan(ch, req.body, client, h)));\n  app.post('/v1/loans/:id/take', { preHandler: auth }, async (req) =>\n    takeOwnedAdvance(pool, req.user.sub, req.params.id, req.body?.carId));\n  app.post('/v1/loans/:id/cancel', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Loans.cancelLoan(ch, req.params.id, client, h)));\n  // repay is two-party (borrower pays, lender credited): look up the lender, lock both.\n",
      "baseline": "  app.post('/v1/loans', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Loans.offerLoan(ch, req.body, client, h)));\n  app.post('/v1/loans/:id/take', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Loans.takeLoan(ch, req.params.id, req.body?.carId, client, h)));\n  app.post('/v1/loans/:id/cancel', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Loans.cancelLoan(ch, req.params.id, client, h)));\n  // repay is two-party (borrower pays, lender credited): look up the lender, lock both.\n"
    },
    {
      "current": "  registerDepot(app, { pool, auth });\n  registerResources(app, { pool, auth, modAuth });\n  registerDelivery(app, { pool, auth });\n  registerDeliveryFinance(app, { pool, auth });\n  registerSupplyTenders(app, { pool, auth });\n  registerWarehouses(app, { pool, auth });\n  registerCrewLogistics(app, { pool, auth });\n",
      "baseline": "  registerDepot(app, { pool, auth });\n  registerResources(app, { pool, auth, modAuth });\n  registerDelivery(app, { pool, auth });\n  registerSupplyTenders(app, { pool, auth });\n  registerWarehouses(app, { pool, auth });\n  registerCrewLogistics(app, { pool, auth });\n"
    },
    {
      "current": "      case 'depot_restock': return Depot.restockDepot(ch, tail('/v1/depot/').replace(/\\/restock$/, ''), client, h,\n        { automated: true, policyId: action.body.policyId });\n      case 'delivery_accept': return Delivery.acceptDelivery(ch, action.body.orderId, action.body, client);\n      case 'delivery_deliver': return lender\n        ? DeliveryFinance.deliverFinancedCommitment(ch, lender, action.body.commitmentId, action.body.qty, client, h)\n        : Delivery.deliverCommitment(ch, action.body.commitmentId, action.body.qty, client, h);\n      case 'delivery_buy':\n      case 'delivery_travel': return Delivery.deliveryStep(ch, action.body.commitmentId, action.kind, action.body, client, h);\n      case 'delivery_depot_buy':\n",
      "baseline": "      case 'depot_restock': return Depot.restockDepot(ch, tail('/v1/depot/').replace(/\\/restock$/, ''), client, h,\n        { automated: true, policyId: action.body.policyId });\n      case 'delivery_accept': return Delivery.acceptDelivery(ch, action.body.orderId, action.body, client);\n      case 'delivery_deliver': return Delivery.deliverCommitment(ch, action.body.commitmentId, action.body.qty, client, h);\n      case 'delivery_buy':\n      case 'delivery_travel': return Delivery.deliveryStep(ch, action.body.commitmentId, action.kind, action.body, client, h);\n      case 'delivery_depot_buy':\n"
    },
    {
      "current": "      // Two-party actions preserve the canonical sorted character/account lock order.\n      const loanMatch = /^loan:([^:]+):repay$/.exec(actionId);\n      const storefrontMatch = /^delivery:([A-Za-z0-9_-]{1,128}):depot:([A-Za-z0-9_-]{1,128}):buy$/.exec(actionId);\n      const financedMatch = /^delivery:([A-Za-z0-9_-]{1,128}):deliver$/.exec(actionId);\n      if (financedMatch) {\n        const advance = (await pool.query(\"SELECT loan_id FROM delivery_loan_requests WHERE commitment_id=$1 AND state='active'\", [financedMatch[1]])).rows[0];\n        const creditor = advance?.loan_id && (await pool.query(\"SELECT lender_character FROM loans WHERE id=$1 AND status='active'\", [advance.loan_id])).rows[0]?.lender_character;\n        if (creditor) result = await G.withTwoCharacters(pool, req.user.sub, creditor,\n          (ch, lender, client, h) => executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId), { meet: false });\n        else result = await G.withCharacter(pool, req.user.sub,\n          (ch, client, h) => executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId), agentActionLocks);\n      } else if (storefrontMatch) {\n        const ownerId = (await pool.query(\"SELECT owner_character FROM business_depots WHERE id=$1 AND status='open'\", [storefrontMatch[2]])).rows[0]?.owner_character;\n        if (ownerId) {\n          result = await G.withTwoCharacters(pool, req.user.sub, ownerId, (ch, owner, client, h) =>\n",
      "baseline": "      // Two-party actions preserve the canonical sorted character/account lock order.\n      const loanMatch = /^loan:([^:]+):repay$/.exec(actionId);\n      const storefrontMatch = /^delivery:([A-Za-z0-9_-]{1,128}):depot:([A-Za-z0-9_-]{1,128}):buy$/.exec(actionId);\n      if (storefrontMatch) {\n        const ownerId = (await pool.query(\"SELECT owner_character FROM business_depots WHERE id=$1 AND status='open'\", [storefrontMatch[2]])).rows[0]?.owner_character;\n        if (ownerId) {\n          result = await G.withTwoCharacters(pool, req.user.sub, ownerId, (ch, owner, client, h) =>\n"
    }
  ],
  "src/invariants.js": [
    {
      "current": "import { definitionByHash } from './itemdefinitions.js';\nimport { canonicalBytes } from './content/canonical.js';\nimport { intelForecastAccounting } from './intelforecastinvariants.js';\nimport { deliveryFinanceTerms } from './deliveryfinanceterms.js';\nimport { DESK, DESK_RECYCLE_REASON, loanOwed, loanVig } from './rules.js';\nimport {\n  PHASE1_HARDENING_CASH_COST,\n  PHASE1_HARDENING_CASH_REASON,\n",
      "baseline": "import { definitionByHash } from './itemdefinitions.js';\nimport { canonicalBytes } from './content/canonical.js';\nimport { intelForecastAccounting } from './intelforecastinvariants.js';\nimport { DESK, DESK_RECYCLE_REASON } from './rules.js';\nimport {\n  PHASE1_HARDENING_CASH_COST,\n  PHASE1_HARDENING_CASH_REASON,\n"
    },
    {
      "current": "  const loanLoot = -(await sum(pool, \"currency='cash' AND reason='loan:loot'\"));\n  push('loan escrow', loanEscrow, loanOffered - loanTaken - loanRefunded - loanDeath - loanLoot);\n\n  // Advances add no cash bucket. Verify their consent/receipt binding to the\n  // canonical debt; loan escrow and character cash still reconcile all value.\n  const financeRequests = (await pool.query('SELECT * FROM delivery_loan_requests')).rows;\n  const financeLoans = (await pool.query('SELECT * FROM loans')).rows;\n  const financeCommitments = (await pool.query('SELECT * FROM delivery_commitments')).rows;\n  let financeFaults = 0;\n  for (const request of financeRequests) {\n    try {\n      const terms = deliveryFinanceTerms(request.terms), quote = request.quote;\n      const loan = financeLoans.find(row => row.id === request.loan_id);\n      const commitment = financeCommitments.find(row => row.id === request.commitment_id);\n      const owed = loanOwed(terms.principal, terms.rate), gross = quote.quantity * quote.unitPrice;\n      if (quote.eligible !== true || quote.good !== 'gin' || !Number.isSafeInteger(quote.quantity) || quote.quantity < 1 || quote.quantity > 40\n          || !Number.isSafeInteger(quote.unitPrice) || quote.unitPrice < 50 || quote.unitPrice > 1000000\n          || !Number.isSafeInteger(quote.takeBps) || quote.takeBps < 0 || quote.takeBps > 10000\n          || quote.gross !== gross || quote.take !== Math.ceil(gross * quote.takeBps / 10000)\n          || quote.fullSettlementNet !== gross - quote.take || quote.fullSettlementNet < owed\n          || quote.owed !== owed || quote.vig !== loanVig(owed)\n          || quote.projectedLenderReceipt !== owed - loanVig(owed)\n          || quote.projectedCashRemainder !== quote.fullSettlementNet - owed) throw new Error('quote');\n      if (terms.supplierId !== request.supplier_character || terms.lenderId !== request.requested_lender_character\n          || terms.commitmentId !== request.commitment_id || quote.supplierId !== terms.supplierId\n          || quote.lenderId !== terms.lenderId || quote.commitmentId !== terms.commitmentId\n          || quote.buyerId !== request.buyer_character || quote.orderId !== request.order_id\n          || quote.principal !== terms.principal || quote.rate !== terms.rate || quote.hours !== terms.hours\n          || quote.fundsReserved !== false || quote.guaranteedIncome !== false) throw new Error('binding');\n      if (commitment && (commitment.order_id !== request.order_id || commitment.supplier_character !== request.supplier_character\n          || commitment.buyer_character !== request.buyer_character || Number(commitment.quantity) !== quote.quantity\n          || Number(commitment.unit_price) !== quote.unitPrice || Number(commitment.take_bps) !== quote.takeBps)) throw new Error('commitment');\n      if (loan && (Number(loan.principal) !== terms.principal || Number(loan.rate) !== terms.rate\n          || Number(loan.hours) !== terms.hours || Number(loan.collateral_min) !== 0 || Number(loan.collateral_omr) !== 0\n          || loan.collateral_car || (loan.status === 'open' && loan.offered_to !== request.supplier_character)\n          || (loan.borrower_character && loan.borrower_character !== request.supplier_character))) throw new Error('debt');\n      if (loan && ((request.state === 'offered' && loan.status === 'active')\n          || (request.state === 'active' && loan.status === 'open')\n          || (request.state === 'closed' && ['open', 'active'].includes(loan.status)))) throw new Error('state');\n      if (request.state === 'settled') {\n        const { delivery, repayment } = request.settlement || {}, owed = loanOwed(terms.principal, terms.rate);\n        if (!delivery || !repayment || delivery.delivered !== quote.quantity || delivery.earned !== quote.fullSettlementNet\n            || delivery.earned < owed || repayment.paid !== owed || repayment.vig !== loanVig(owed)\n            || repayment.toLender !== owed - loanVig(owed) || (loan && loan.status !== 'repaid')\n            || (commitment && (commitment.status !== 'delivered' || Number(commitment.remaining) !== 0))) throw new Error('receipt');\n      }\n    } catch { financeFaults++; }\n  }\n  push('delivery finance bindings', financeFaults, 0, 0);\n\n  // (f4b) Drop 5 (B) — THE $OMR PLEDGE ESCROW: active pledged $OMR == pledged in − returned − seized\n  // − death-looted. Every pledge row is a single-leg transfer (the auction:bid shape): loan:pledge is\n  // the borrower's negative debit into the row, the three exits are positive credits out of it\n",
      "baseline": "  const loanLoot = -(await sum(pool, \"currency='cash' AND reason='loan:loot'\"));\n  push('loan escrow', loanEscrow, loanOffered - loanTaken - loanRefunded - loanDeath - loanLoot);\n\n  // (f4b) Drop 5 (B) — THE $OMR PLEDGE ESCROW: active pledged $OMR == pledged in − returned − seized\n  // − death-looted. Every pledge row is a single-leg transfer (the auction:bid shape): loan:pledge is\n  // the borrower's negative debit into the row, the three exits are positive credits out of it\n"
    }
  ],
  "src/loans.js": [
    {
      "current": "import { LOAN, loanVig, loanOwed, paperTake, M3, carCollateralValue, levelOf, HONOR , jailed, hospitalized, safeHoused, usd } from './rules.js';\nimport { logCarCollect } from './collection.js';\nimport { bumpHonor, sqlHonorDelta } from './honor.js';\nimport { assertDeliveryFinanceLoanTake } from './deliveryfinance.js';\n\nconst uid = () => crypto.randomUUID();\nconst isWanted = (ch) => ch.wanted_until && new Date(ch.wanted_until) > new Date();\n",
      "baseline": "import { LOAN, loanVig, loanOwed, paperTake, M3, carCollateralValue, levelOf, HONOR , jailed, hospitalized, safeHoused, usd } from './rules.js';\nimport { logCarCollect } from './collection.js';\nimport { bumpHonor, sqlHonorDelta } from './honor.js';\n\nconst uid = () => crypto.randomUUID();\nconst isWanted = (ch) => ch.wanted_until && new Date(ch.wanted_until) > new Date();\n"
    },
    {
      "current": "  if (jailed(ch)) throw new GameError('jailed', 'No taking a loan from lockup.');\n  const loan = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [loanId])).rows[0];\n  if (!loan || loan.status !== 'open') throw new GameError('gone', 'That offer is off the table.');\n  await assertDeliveryFinanceLoanTake(client, ch, loanId);\n  if (loan.lender_character === ch.id) throw new GameError('own', \"You can't take your own money.\");\n  if (loan.offered_to && loan.offered_to !== ch.id) throw new GameError('directed', 'That offer is spoken for — it names another borrower.');\n  if (ch.welsher) throw new GameError('welsher', 'Nobody lends to a welsher. Square your name first.');\n",
      "baseline": "  if (jailed(ch)) throw new GameError('jailed', 'No taking a loan from lockup.');\n  const loan = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [loanId])).rows[0];\n  if (!loan || loan.status !== 'open') throw new GameError('gone', 'That offer is off the table.');\n  if (loan.lender_character === ch.id) throw new GameError('own', \"You can't take your own money.\");\n  if (loan.offered_to && loan.offered_to !== ch.id) throw new GameError('directed', 'That offer is spoken for — it names another borrower.');\n  if (ch.welsher) throw new GameError('welsher', 'Nobody lends to a welsher. Square your name first.');\n"
    }
  ],
  "src/delivery.js": [
    {
      "current": "import { GameError, travel } from './game.js';\nimport { jailed, safeHoused, CONSTANTS, BLACK_MARKET } from './rules.js';\nimport { fillOrder } from './market.js';\nimport { assertDeliveryFinanceDelivery } from './deliveryfinance.js';\nimport { reservedQuantity } from './deliverybook.js';\nimport { buyGood } from './economy.js';\nimport { goodsBuyQuote } from './goodsquote.js';\n",
      "baseline": "import { GameError, travel } from './game.js';\nimport { jailed, safeHoused, CONSTANTS, BLACK_MARKET } from './rules.js';\nimport { fillOrder } from './market.js';\nimport { reservedQuantity } from './deliverybook.js';\nimport { buyGood } from './economy.js';\nimport { goodsBuyQuote } from './goodsquote.js';\n"
    },
    {
      "current": "export async function deliverCommitment(ch, id, qty, client, h) {\n  if (!integer(qty, 1, DELIVERY.maxUnits)) throw new GameError('delivery_terms', 'qty must be a bounded integer.');\n  const c = await lockedCommitment(ch, id, client);\n  await assertDeliveryFinanceDelivery(client, ch, c.id);\n  if (qty > Number(c.remaining) || qty > Number(h.owned.cargo[c.good_id] || 0)) throw new GameError('qty', 'Deliver only committed quantities you actually hold.');\n  return fillOrder(ch, c.order_id, qty, client, h, { commitmentId: c.id });\n}\n",
      "baseline": "export async function deliverCommitment(ch, id, qty, client, h) {\n  if (!integer(qty, 1, DELIVERY.maxUnits)) throw new GameError('delivery_terms', 'qty must be a bounded integer.');\n  const c = await lockedCommitment(ch, id, client);\n  if (qty > Number(c.remaining) || qty > Number(h.owned.cargo[c.good_id] || 0)) throw new GameError('qty', 'Deliver only committed quantities you actually hold.');\n  return fillOrder(ch, c.order_id, qty, client, h, { commitmentId: c.id });\n}\n"
    }
  ],
  "src/market.js": [
    {
      "current": "// → market_listings (pot class) → street_tax singleton. Acyclic vs the global order; residual\n// races fall back to the 40P01→contention mapping.\nimport crypto from 'node:crypto';\nimport { assertDeliveryFinanceDelivery } from './deliveryfinance.js';\nimport { closeDepotsAtDeath, refundDepotOrder } from './depotbook.js';\nimport { reservedQuantity, closeDeliveriesAtDeath } from './deliverybook.js';\nimport { GameError, bus, ledger, notify, skillMult, trunkCap, npcTier, bumpStanding, bumpMastery, masteryFx } from './game.js';\n",
      "baseline": "// → market_listings (pot class) → street_tax singleton. Acyclic vs the global order; residual\n// races fall back to the 40P01→contention mapping.\nimport crypto from 'node:crypto';\nimport { closeDepotsAtDeath, refundDepotOrder } from './depotbook.js';\nimport { reservedQuantity, closeDeliveriesAtDeath } from './deliverybook.js';\nimport { GameError, bus, ledger, notify, skillMult, trunkCap, npcTier, bumpStanding, bumpMastery, masteryFx } from './game.js';\n"
    },
    {
      "current": "      throw new GameError('no_commitment', 'No current delivery commitment with these terms.');\n  }\n  const available = commitment ? Number(commitment.remaining) : Number(l.qty) - await reservedQuantity(client, l.id);\n  if (commitment) await assertDeliveryFinanceDelivery(client, ch, commitment.id);\n  const have = h.owned.cargo[l.good_id] || 0;\n  const n = Math.min(Math.max(1, Math.floor(Number(qty) || have)), Number(l.qty), available, have);\n  if (n <= 0) throw new GameError('qty', 'Nothing to deliver.');\n",
      "baseline": "      throw new GameError('no_commitment', 'No current delivery commitment with these terms.');\n  }\n  const available = commitment ? Number(commitment.remaining) : Number(l.qty) - await reservedQuantity(client, l.id);\n  const have = h.owned.cargo[l.good_id] || 0;\n  const n = Math.min(Math.max(1, Math.floor(Number(qty) || have)), Number(l.qty), available, have);\n  if (n <= 0) throw new GameError('qty', 'Nothing to deliver.');\n"
    }
  ],
  "src/routes/delivery.js": [
    {
      "current": "import * as G from '../game.js';\nimport * as Delivery from '../delivery.js';\nimport { supplierHistory } from '../supplierhistory.js';\nimport { deliverOwnedAdvance } from './deliveryfinance.js';\nexport function register(app, { pool, auth }) {\n  app.get('/v1/deliveries', { preHandler: auth }, async (req) =>\n    G.readCharacter(pool, req.user.sub, async (ch, client) => {\n",
      "baseline": "import * as G from '../game.js';\nimport * as Delivery from '../delivery.js';\nimport { supplierHistory } from '../supplierhistory.js';\nexport function register(app, { pool, auth }) {\n  app.get('/v1/deliveries', { preHandler: auth }, async (req) =>\n    G.readCharacter(pool, req.user.sub, async (ch, client) => {\n"
    },
    {
      "current": "  app.post('/v1/market/:id/accept-delivery', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client) => Delivery.acceptDelivery(ch, req.params.id, req.body, client)));\n  app.post('/v1/deliveries/:id/deliver', { preHandler: auth }, async (req) =>\n    deliverOwnedAdvance(pool, req.user.sub, req.params.id, req.body?.qty));\n  app.post('/v1/deliveries/:id/expire', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client) => Delivery.expireCommitment(ch, req.params.id, client)));\n  app.post('/v1/deliveries/:id/depot/:depotId/buy', { preHandler: auth }, async (req) => {\n",
      "baseline": "  app.post('/v1/market/:id/accept-delivery', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client) => Delivery.acceptDelivery(ch, req.params.id, req.body, client)));\n  app.post('/v1/deliveries/:id/deliver', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Delivery.deliverCommitment(ch, req.params.id, req.body?.qty, client, h)));\n  app.post('/v1/deliveries/:id/expire', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client) => Delivery.expireCommitment(ch, req.params.id, client)));\n  app.post('/v1/deliveries/:id/depot/:depotId/buy', { preHandler: auth }, async (req) => {\n"
    }
  ],
  "src/courierjobs.js": [
    {
      "current": "  if (!commitment || commitment.status !== 'accepted' || commitment.supplierId !== ch?.id) return null;\n  const blocked = (blockedReason) => ({ blockedReason });\n  const whole = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;\n  const cashAmount = n => Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;\n  if (!Number.isFinite(now) || !Number.isFinite(new Date(commitment.deadline).getTime())\n      || new Date(commitment.deadline).getTime() <= now) return blocked('deadline');\n  if (jailed(ch, now) || safeHoused(ch, now)) return blocked('status');\n",
      "baseline": "  if (!commitment || commitment.status !== 'accepted' || commitment.supplierId !== ch?.id) return null;\n  const blocked = (blockedReason) => ({ blockedReason });\n  const whole = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;\n  if (!Number.isFinite(now) || !Number.isFinite(new Date(commitment.deadline).getTime())\n      || new Date(commitment.deadline).getTime() <= now) return blocked('deadline');\n  if (jailed(ch, now) || safeHoused(ch, now)) return blocked('status');\n"
    },
    {
      "current": "      || !whole(commitment.quantity, 1, 40) || !whole(commitment.remaining, 1, commitment.quantity)\n      || !whole(commitment.unitPrice, 1, 1000000) || !whole(commitment.takeBps, 0, 10000)\n      || !whole(commitment.maxProcurementCash, 1, 100000) || !whole(commitment.spent, 0, commitment.maxProcurementCash)\n      || !cashAmount(Number(ch.cash))\n      || !whole(policy?.cashReserve, 1000, Number.MAX_SAFE_INTEGER)) return blocked('terms');\n  const cargo = Number(owned?.cargo?.[commitment.good] || 0);\n  if (!whole(cargo, 0, Number.MAX_SAFE_INTEGER)) return blocked('cargo');\n",
      "baseline": "      || !whole(commitment.quantity, 1, 40) || !whole(commitment.remaining, 1, commitment.quantity)\n      || !whole(commitment.unitPrice, 1, 1000000) || !whole(commitment.takeBps, 0, 10000)\n      || !whole(commitment.maxProcurementCash, 1, 100000) || !whole(commitment.spent, 0, commitment.maxProcurementCash)\n      || !whole(Number(ch.cash), 0, Number.MAX_SAFE_INTEGER)\n      || !whole(policy?.cashReserve, 1000, Number.MAX_SAFE_INTEGER)) return blocked('terms');\n  const cargo = Number(owned?.cargo?.[commitment.good] || 0);\n  if (!whole(cargo, 0, Number.MAX_SAFE_INTEGER)) return blocked('cargo');\n"
    },
    {
      "current": "    - Math.ceil(done * commitment.unitPrice * commitment.takeBps / 10000);\n  const net = gross - take;\n  const travelCash = ch.loc === commitment.district ? 0 : CONSTANTS.TRAVEL_COST;\n  if (!cashAmount(Number(ch.cash) - travelCash + net)) return blocked('cash_capacity');\n  if (travelCash && commitment.spent + travelCash > commitment.maxProcurementCash) return blocked('budget');\n  if (travelCash && Number(ch.cash) - travelCash < policy.cashReserve) return blocked('reserve');\n  if (net - travelCash <= 0) return blocked('incremental_cash');\n",
      "baseline": "    - Math.ceil(done * commitment.unitPrice * commitment.takeBps / 10000);\n  const net = gross - take;\n  const travelCash = ch.loc === commitment.district ? 0 : CONSTANTS.TRAVEL_COST;\n  if (!Number.isSafeInteger(Number(ch.cash) - travelCash + net)) return blocked('cash_capacity');\n  if (travelCash && commitment.spent + travelCash > commitment.maxProcurementCash) return blocked('budget');\n  if (travelCash && Number(ch.cash) - travelCash < policy.cashReserve) return blocked('reserve');\n  if (net - travelCash <= 0) return blocked('incremental_cash');\n"
    }
  ]
});
const normalize = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
export const INVOICE_SOURCE_TRANSFER = Object.freeze({ sourceRevision: INVOICE_SOURCE_REVIEWED_REVISION,
  predecessorRevision: INVOICE_SOURCE_PREDECESSOR_REVISION, currentPins: INVOICE_SOURCE_CURRENT_PINS, baselinePins: INVOICE_SOURCE_BASELINE_PINS,
  currentBlobs: INVOICE_SOURCE_CURRENT_BLOBS, baselineBlobs: INVOICE_SOURCE_BASELINE_BLOBS,
  inverseChunks: Object.fromEntries(Object.entries(INVOICE_SOURCE_INVERSES).map(([file, chunks]) => [file, chunks.length])),
  evidence: 'test/rc1-invoice-source-compatibility.js', phase: 'exact source compatibility; financial activation disabled',
  scope: 'Only exact unique Git diff hunks reconstruct the complete prior repaired Intel sources. Historical qualifications remain scoped to those unchanged bytes. Invoice semantics, accounting, authorization, custody and quote behavior require separate current-source native proof; no historical runtime, native, deployment or financial qualification is expanded. The unchanged worker requires its existing Intel qualification; this transfer supplies no worker qualification.' });

export function assertInvoiceSourceTransfer(file, input) {
  assert(Object.hasOwn(INVOICE_SOURCE_CURRENT_PINS, file), 'Unknown Invoice source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  assert.equal(actualSha256, INVOICE_SOURCE_CURRENT_PINS[file], 'Invoice source changed: ' + file);
  let baselineText = text;
  for (const chunk of INVOICE_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(chunk.current).length, 2, 'Invoice source inverse must be exact and unique: ' + file);
    baselineText = baselineText.replace(chunk.current, chunk.baseline);
  }
  const baselineSha256 = INVOICE_SOURCE_BASELINE_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Invoice source differs beyond exact reviewed hunks: ' + file);
  return { file, actualSha256, baselineSha256, baselineText, inverseChunks: INVOICE_SOURCE_INVERSES[file].length,
    sourceRevision: INVOICE_SOURCE_REVIEWED_REVISION, sourceBlob: INVOICE_SOURCE_CURRENT_BLOBS[file],
    predecessorRevision: INVOICE_SOURCE_PREDECESSOR_REVISION, predecessorBlob: INVOICE_SOURCE_BASELINE_BLOBS[file],
    evidence: INVOICE_SOURCE_TRANSFER.evidence, phase: INVOICE_SOURCE_TRANSFER.phase, scope: INVOICE_SOURCE_TRANSFER.scope };
}
export function qualifyInvoiceSource(file, input) {
  assert(Object.hasOwn(INVOICE_SOURCE_BASELINE_PINS, file), 'Unknown Invoice source compatibility file');
  const text = normalize(input), actualSha256 = hash(text);
  if (actualSha256 === INVOICE_SOURCE_BASELINE_PINS[file])
    return { file, actualSha256, baselineSha256: actualSha256, baselineText: text, inverseChunks: 0,
      sourceRevision: INVOICE_SOURCE_PREDECESSOR_REVISION, sourceBlob: INVOICE_SOURCE_BASELINE_BLOBS[file],
      evidence: INVOICE_SOURCE_TRANSFER.evidence, phase: INVOICE_SOURCE_TRANSFER.phase, scope: INVOICE_SOURCE_TRANSFER.scope };
  return assertInvoiceSourceTransfer(file, text);
}

// Compose only the exact current invoice blob. Earlier revisions and unknown
// bytes still reach the existing closed historical guard unchanged.
export function invoiceSourceBaseline(file, input) {
  const text = normalize(coverageSourceBaseline(file, strategySourceBaseline(file, input)));
  return Object.hasOwn(INVOICE_SOURCE_CURRENT_PINS, file) && hash(text) === INVOICE_SOURCE_CURRENT_PINS[file]
    ? qualifyInvoiceSource(file, text).baselineText : text;
}
