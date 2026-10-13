import { firstBatchSourceBaseline, assertFirstBatchSourceTransfer } from './rc1-first-batch-source-compatibility.js';
import { STRATEGY_LEAGUE_SOURCE_CURRENT_PINS, qualifyStrategyLeagueSource } from './rc1-strategy-league-source-compatibility.js';
import { MARKET_FEED_SOURCE_CURRENT_PINS, qualifyMarketFeedSource } from './rc1-market-feed-source-compatibility.js';
import { COMPANY_SUCCESSION_SOURCE_CURRENT_PINS, qualifyCompanySuccessionSource } from './rc1-company-succession-source-compatibility.js';
import { STRATEGY_SOURCE_CURRENT_PINS, qualifyStrategySource } from './rc1-strategy-source-compatibility.js';
import { COVERAGE_SOURCE_CURRENT_PINS, qualifyCoverageSource } from './rc1-logistics-coverage-source-compatibility.js';
import { INVOICE_SOURCE_CURRENT_PINS, INVOICE_SOURCE_TRANSFER, qualifyInvoiceSource } from './rc1-invoice-source-compatibility.js';
import { INTEL_SOURCE_CURRENT_PINS, INTEL_SOURCE_TRANSFER, qualifyIntelSource } from './rc1-intel-source-compatibility.js';
// Pure test-only source transfer guards; no product modules or runtime effects.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { COMPANY_OPERATOR_SOURCE_CURRENT_PINS, assertCompanyOperatorSourceTransfer, companyOperatorSourceBaseline } from './rc1-company-operator-source-compatibility.js';
import { GAME_EMPLOYMENT_SOURCE_CURRENT_PINS, assertGameEmploymentSourceTransfer } from './rc1-game-employment-source-compatibility.js';
import { COMPANY_WORKFLOW_SOURCE_CURRENT_PINS, assertCompanyWorkflowSourceTransfer } from './rc1-company-workflow-source-compatibility.js';
import { COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS, assertCommercialPremisesSourceTransfer } from './rc1-commercial-premises-source-compatibility.js';
import { COMPANY_BANK_SOURCE_CURRENT_PINS, assertCompanyBankSourceTransfer } from './rc1-company-bank-source-compatibility.js';
import { COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS, assertCompanyLogisticsHubSourceTransfer } from './rc1-company-logistics-hub-source-compatibility.js';
import { BUYER_COOPERATIVE_SOURCE_CURRENT_PINS, assertBuyerCooperativeSourceTransfer } from './rc1-buyer-cooperative-source-compatibility.js';
import { COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS, assertCompanyOpportunitySourceTransfer } from './rc1-company-opportunity-source-compatibility.js';
import { COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS, assertCommercialReputationSourceTransfer } from './rc1-commercial-reputation-source-compatibility.js';
import { BUSINESS_SEASON_SOURCE_CURRENT_PINS, assertBusinessSeasonSourceTransfer } from './rc1-business-season-source-compatibility.js';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
function operatorEnvelope(file, input, predecessorGuard) {
 const text = input.replaceAll('\r\n', '\n');
 const season = Object.hasOwn(BUSINESS_SEASON_SOURCE_CURRENT_PINS, file) && hash(text) === BUSINESS_SEASON_SOURCE_CURRENT_PINS[file] ? assertBusinessSeasonSourceTransfer(file, text) : null;
 const reputationText = season?.baselineText || text;
 const reputation = Object.hasOwn(COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS, file) && hash(reputationText) === COMMERCIAL_REPUTATION_SOURCE_CURRENT_PINS[file] ? assertCommercialReputationSourceTransfer(file, reputationText) : null;
 const opportunityText = reputation?.baselineText || reputationText;
 const opportunity = Object.hasOwn(COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS, file) && hash(opportunityText) === COMPANY_OPPORTUNITY_SOURCE_CURRENT_PINS[file] ? assertCompanyOpportunitySourceTransfer(file, opportunityText) : null;
 const cooperativeText = opportunity?.baselineText || opportunityText;
 const cooperative = Object.hasOwn(BUYER_COOPERATIVE_SOURCE_CURRENT_PINS, file) && hash(cooperativeText) === BUYER_COOPERATIVE_SOURCE_CURRENT_PINS[file] ? assertBuyerCooperativeSourceTransfer(file, cooperativeText) : null;
 const hubText = cooperative?.baselineText || cooperativeText;
 const hub = Object.hasOwn(COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS, file) && hash(hubText) === COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS[file] ? assertCompanyLogisticsHubSourceTransfer(file, hubText) : null;
 const bankText = hub?.baselineText || hubText;
 const bank = Object.hasOwn(COMPANY_BANK_SOURCE_CURRENT_PINS, file) && hash(bankText) === COMPANY_BANK_SOURCE_CURRENT_PINS[file] ? assertCompanyBankSourceTransfer(file, bankText) : null;
 const premisesText = bank?.baselineText || bankText;
 const premises = Object.hasOwn(COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS, file) && hash(premisesText) === COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS[file] ? assertCommercialPremisesSourceTransfer(file, premisesText) : null;
 const workflowText = premises?.baselineText || premisesText;
 const workflow = Object.hasOwn(COMPANY_WORKFLOW_SOURCE_CURRENT_PINS, file) && hash(workflowText) === COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file] ? assertCompanyWorkflowSourceTransfer(file, workflowText) : null;
 const employmentText = workflow?.baselineText || workflowText;
 const employment = Object.hasOwn(GAME_EMPLOYMENT_SOURCE_CURRENT_PINS, file) && hash(employmentText) === GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file] ? assertGameEmploymentSourceTransfer(file, employmentText) : null;
 const operatorText = employment?.baselineText || employmentText;
 if (!Object.hasOwn(COMPANY_OPERATOR_SOURCE_CURRENT_PINS, file) || hash(operatorText) !== COMPANY_OPERATOR_SOURCE_CURRENT_PINS[file]) return null;
 const transfer = assertCompanyOperatorSourceTransfer(file, operatorText);
 const home = file === 'src/server.js' ? assertCityHomesLeagueServerTransfer(transfer.baselineText) : null;
 const predecessor = predecessorGuard(home?.baselineText || transfer.baselineText);
 return { ...predecessor, actualSha256: hash(text), companyOperatorSourceTransfer: transfer, ...(season ? { businessSeasonSourceTransfer: season } : {}), ...(reputation ? { commercialReputationSourceTransfer: reputation } : {}), ...(opportunity ? { companyOpportunitySourceTransfer: opportunity } : {}), ...(cooperative ? { buyerCooperativeSourceTransfer: cooperative } : {}), ...(hub ? { companyLogisticsHubSourceTransfer: hub } : {}), ...(bank ? { companyBankSourceTransfer: bank } : {}), ...(premises ? { commercialPremisesSourceTransfer: premises } : {}), ...(workflow ? { companyWorkflowSourceTransfer: workflow } : {}), ...(employment ? { gameEmploymentSourceTransfer: employment } : {}), ...(home ? { cityHomesLeagueSourceTransfer: home } : {}) };
}
export const CITY_HOMES_SERVER_PIN = 'f66e2f5a40394d3dc1ac92a779486fa0cb7b5a3d005eae2f4a99214e65105dd6';
export const CITY_HOMES_SOURCE_BASE_REVISION = '9506c37e18bbc1be45ae8150951e42451eb909de';
export const CITY_HOMES_SERVER_BLOB = 'be8267a5a68ba142f5cd21213c7946880c47381a';
export const CITY_HOMES_PREDECESSOR_SERVER_BLOB = 'b7a754a7c11af484d884fd7dd35e7b99b5e0de8a';
export const CITY_HOMES_SOURCE_INVERSES = Object.freeze([
  "import { registerCityHomes } from './routes/cityhomes.js';\n",
  "  registerCityHomes(app, { pool, auth });\n",
]);
// Exact registration transfer excludes the new authenticated directory projection.
export function assertCityHomesServerTransfer(text) {
 const actualSha256 = hash(text);
 assert.equal(actualSha256, CITY_HOMES_SERVER_PIN, 'City homes transfer source changed: src/server.js');
 let baselineText = text;
 for (const chunk of CITY_HOMES_SOURCE_INVERSES) {
  assert.equal(baselineText.split(chunk).length, 2, 'City homes inverse is not exact and unique');
  baselineText = baselineText.replace(chunk, '');
 }
 assert.equal(hash(baselineText), COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js'], 'Server differs beyond exact City homes registration');
 return { actualSha256, baselineText, baselineSha256: COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js'],
  sourceBaseRevision: CITY_HOMES_SOURCE_BASE_REVISION, sourceBlob: CITY_HOMES_SERVER_BLOB,
  predecessorServerBlob: CITY_HOMES_PREDECESSOR_SERVER_BLOB, inverseChunks: 2 };
}
export const CITY_HOMES_FEED_SERVER_PIN = '4c7ce5c43ce53921fc334955b196fe3a3b0990d36a6698215b01225a0a63ba3f';
export const CITY_HOMES_FEED_SOURCE_BASE_REVISION = '2395509e2b0c980bd9e80e6cc4aef78209f2b38e';
export const CITY_HOMES_FEED_SERVER_BLOB = 'b1ee0ec744762c83f2dd7cc3c82dc0eb2db0a116';
export const CITY_HOMES_FEED_PREDECESSOR_SERVER_BLOB = '5b1d2b43ffac10930625c914ecc638de64506453';
export function assertCityHomesFeedServerTransfer(input) {
 const text = input.replaceAll('\r\n', '\n'), actualSha256 = hash(text);
 assert.equal(actualSha256, CITY_HOMES_FEED_SERVER_PIN, 'City homes Feed transfer source changed: src/server.js');
 let baselineText = text;
 for (const chunk of CITY_HOMES_SOURCE_INVERSES) {
  assert.equal(baselineText.split(chunk).length, 2, 'City homes Feed inverse is not exact and unique');
  baselineText = baselineText.replace(chunk, '');
 }
 assert.equal(hash(baselineText), MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js'], 'Server differs beyond exact City homes Feed registration');
 return { actualSha256, baselineText, baselineSha256: MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js'],
  sourceBaseRevision: CITY_HOMES_FEED_SOURCE_BASE_REVISION, sourceBlob: CITY_HOMES_FEED_SERVER_BLOB,
  predecessorServerBlob: CITY_HOMES_FEED_PREDECESSOR_SERVER_BLOB, inverseChunks: 2 };
}
export function cityHomesFeedSourceBaseline(file, input) {
 const text = input.replaceAll('\r\n', '\n');
 return file === 'src/server.js' && hash(text) === CITY_HOMES_FEED_SERVER_PIN ? assertCityHomesFeedServerTransfer(text).baselineText : text;
}
export const CITY_HOMES_LEAGUE_SERVER_PIN = '8cc6baca8f1c019bb507afb45d1f62838749e0208d4d61bb05b23d28ebc84b55';
export const CITY_HOMES_LEAGUE_SOURCE_BASE_REVISION = 'e018820492ce00eeae766455164067ff5ecfcc10';
export const CITY_HOMES_LEAGUE_SERVER_BLOB = 'c90f24dcea1a29e5ca257ae3ec365f8b022785f5';
export const CITY_HOMES_LEAGUE_PREDECESSOR_SERVER_BLOB = '920092d78aa4ac21eee34548c1c858e4d5b4a1f1';
export function assertCityHomesLeagueServerTransfer(input) {
 const text = input.replaceAll('\r\n', '\n'), actualSha256 = hash(text);
 assert.equal(actualSha256, CITY_HOMES_LEAGUE_SERVER_PIN, 'City homes League transfer source changed: src/server.js');
 let baselineText = text;
 for (const chunk of CITY_HOMES_SOURCE_INVERSES) {
  assert.equal(baselineText.split(chunk).length, 2, 'City homes League inverse is not exact and unique');
  baselineText = baselineText.replace(chunk, '');
 }
 assert.equal(hash(baselineText), STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js'], 'Server differs beyond exact City homes League registration');
 return { actualSha256, baselineText, baselineSha256: STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js'],
  sourceBaseRevision: CITY_HOMES_LEAGUE_SOURCE_BASE_REVISION, sourceBlob: CITY_HOMES_LEAGUE_SERVER_BLOB,
  predecessorServerBlob: CITY_HOMES_LEAGUE_PREDECESSOR_SERVER_BLOB, inverseChunks: 2 };
}
export function cityHomesLeagueSourceBaseline(file, input) {
 const text = companyOperatorSourceBaseline(file, input);
 return file === 'src/server.js' && hash(text) === CITY_HOMES_LEAGUE_SERVER_PIN ? assertCityHomesLeagueServerTransfer(text).baselineText : text;
}
// Franchise additions transfer only unchanged historical assertions by full-file reconstruction.
export const FRANCHISE_SOURCE_REVIEWED_REVISION = 'f6dddbfa6b3a475b94b21bb308b91ea8a77d2329';
export const FRANCHISE_SOURCE_PREDECESSOR_REVISION = '89646ae613a86c7c5a3558487788a54a57817f36';
export const FRANCHISE_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "aa03980dbba6a9f5f0a8da96e69c94031f930ffb75950851e166d5db51d288d2",
  "src/depot.js": "87ecc31f935fae40b09820cdcd6bccd7226c2f10dc71ada9e2479a2cac4e4eb7",
  "src/invariants.js": "10d8f60e89dab8ffc1494cbe3953fe0a5c18106722b84e1e7817294ac6fa0016",
  "src/delivery.js": "3322ec74f770ca89259c35f3dfc9d772f407f10d43e4c283920df2b57cd2081f"
});
export const FRANCHISE_SOURCE_PREDECESSOR_PINS = Object.freeze({
  "src/server.js": "ca911a40235992e6e938eeab5a622a82133499fe9ac723bf61845477ab4fb113",
  "src/depot.js": "417a00fe6283ed404e37970cc5bb6951bb324e8fb28bdf5219dc12712bc1684f",
  "src/invariants.js": "851df4ddbcc20a7a947c1b3c07821b5d0ff3a0fe9655cb59578aa7019680fb99",
  "src/delivery.js": "f3fe045cf3836edf68ed598c41a09e377e5df848d165a3fe32305cbe5e68fbcc"
});
export const FRANCHISE_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "6fc8c1d21e4b346d52d9e8214ce723f7a92d7a7a",
  "src/depot.js": "6011e6d9be973b26c2f3c9ce6aad5b149e5309ed",
  "src/invariants.js": "31084671f54e09e03c2b366d0e053ef74fb2d27d",
  "src/delivery.js": "311cad308598dd6a8f57cd3a9f8d16cad23d23b2"
});
export const FRANCHISE_SOURCE_PREDECESSOR_BLOBS = Object.freeze({
  "src/server.js": "7b32de9531c3d47ced6654175ec492afc81cc5cb",
  "src/depot.js": "945165dab07398c5eeb4d15ced5038885e36d5f5",
  "src/invariants.js": "e4671955f894edef3ae655a0e199da8e8afa2ebf",
  "src/delivery.js": "cf01d7605ada91b4f589935707d23238382a20b2"
});
export const FRANCHISE_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    [
      "import { register as registerFranchises } from './routes/franchises.js';\n",
      ""
    ],
    [
      "  registerFranchises(app, { pool, auth });\n",
      ""
    ]
  ],
  "src/depot.js": [
    [
      "import { prepareFranchiseSale, settleFranchiseSale } from './franchiselicenses.js';\n",
      ""
    ],
    [
      "  const prepared = await prepareFranchiseSale(client, id);\n  const row = prepared.operator;\n  if (!row || row.status !== 'open' || row.owner_character !== owner.id || !owner.alive) throw new GameError('no_depot', 'That business is not operating.');\n",
      "  const row = (await client.query(\"SELECT * FROM business_depots WHERE id=$1 AND status='open' FOR UPDATE\", [id])).rows[0];\n  if (!row || row.owner_character !== owner.id || !owner.alive) throw new GameError('no_depot', 'That business is not operating.');\n"
    ],
    [
      "  const saleJournalId = await bookDepot(client, row, 'sale', { cash: net, stock: -quantity, cost: -cost, customerId: ch.id });\n  await settleFranchiseSale(client, prepared.context, saleJournalId);\n",
      "  await bookDepot(client, row, 'sale', { cash: net, stock: -quantity, cost: -cost, customerId: ch.id });\n"
    ],
    [
      "  const royaltyRevenue = journal.filter((entry) => entry.reason === 'royalty_income')\n    .reduce((n, entry) => n + Number(entry.cash_delta), 0);\n",
      ""
    ],
    [
      "    customerRevenue: revenue, rentalRevenue, royaltyRevenue, costOfGoodsSold: cogs, operatingExpenses: expenses,\n    operatingProfit: revenue + rentalRevenue + royaltyRevenue - cogs - expenses,\n",
      "    customerRevenue: revenue, rentalRevenue, costOfGoodsSold: cogs, operatingExpenses: expenses,\n    operatingProfit: revenue + rentalRevenue - cogs - expenses,\n"
    ]
  ],
  "src/invariants.js": [
    [
      "  const depotJournal = (await pool.query('SELECT id,depot_id,reason,cash_delta,stock_delta,cost_delta,expense,customer_character,lease_id,lease_stock_delta,lease_stock_after,lease_sequence,source_journal_id,franchise_license_id FROM business_depot_journal')).rows;\n  const franchiseLicenses = (await pool.query('SELECT * FROM depot_brand_licenses')).rows;\n",
      "  const depotJournal = (await pool.query('SELECT depot_id,reason,cash_delta,stock_delta,cost_delta,customer_character,lease_id,lease_stock_delta,lease_stock_after,lease_sequence FROM business_depot_journal')).rows;\n"
    ],
    [
      "  push('franchise royalty conservation', -depotCash('royalty_expense'), depotCash('royalty_income'), 0);\n  const royaltyEntries = depotJournal.filter(j => j.franchise_license_id || j.source_journal_id || ['royalty_expense', 'royalty_income'].includes(j.reason));\n  let royaltyFaults = 0;\n  const royaltySources = new Map();\n  for (const j of royaltyEntries) {\n    if (!j.franchise_license_id || !j.source_journal_id || !['royalty_expense', 'royalty_income'].includes(j.reason)) royaltyFaults++;\n    const sourceLicenses = royaltySources.get(j.source_journal_id) || new Set();\n    sourceLicenses.add(j.franchise_license_id); royaltySources.set(j.source_journal_id, sourceLicenses);\n    if (!franchiseLicenses.some(l => l.id === j.franchise_license_id)) royaltyFaults++;\n  }\n  royaltyFaults += [...royaltySources.values()].filter(ids => ids.size !== 1).length;\n  for (const license of franchiseLicenses) {\n    const entries = royaltyEntries.filter(j => j.franchise_license_id === license.id);\n    let earned = 0, paid = 0;\n    for (const sourceId of new Set(entries.map(j => j.source_journal_id))) {\n      const pair = entries.filter(j => j.source_journal_id === sourceId);\n      const debit = pair.find(j => j.reason === 'royalty_expense'), credit = pair.find(j => j.reason === 'royalty_income');\n      const sale = depotJournal.find(j => j.id === sourceId);\n      if (pair.length !== 2 || !debit || !credit || !sale || sale.reason !== 'sale' || sale.depot_id !== license.operator_depot_id\n          || !sale.customer_character || Number(sale.cash_delta) <= 0 || Number(sale.stock_delta) >= 0\n          || debit.depot_id !== license.operator_depot_id || credit.depot_id !== license.recipient_depot_id\n          || Number(credit.cash_delta) < 0 || Number(debit.cash_delta) !== -Number(credit.cash_delta)\n          || Number(debit.expense) !== Number(credit.cash_delta) || Number(credit.expense) !== 0\n          || pair.some(j => Number(j.stock_delta) !== 0 || Number(j.cost_delta) !== 0)) royaltyFaults++;\n      if (sale?.reason === 'sale') earned += Number(sale.cash_delta);\n      if (credit) paid += Number(credit.cash_delta);\n    }\n    if (!depots.some(d => d.id === license.operator_depot_id && d.owner_character === license.operator_character)\n        || !depots.some(d => d.id === license.recipient_depot_id && d.owner_character === license.licensor_character)) royaltyFaults++;\n    push(`franchise paid:${license.id}`, Number(license.paid), paid, 0);\n    push(`franchise earned:${license.id}`, Number(license.earned_net), earned, 0);\n    const expected = Number(BigInt(earned) * BigInt(license.royalty_bps) / 10000n);\n    push(`franchise rounding:${license.id}`, paid, Math.min(Number(license.royalty_cap), expected), 0);\n  }\n  push('franchise royalty provenance', royaltyFaults, 0, 0);\n",
      ""
    ]
  ],
  "src/delivery.js": [
    [
      "import { prepareFranchiseSale } from './franchiselicenses.js';\n",
      ""
    ],
    [
      "  const depot = (await prepareFranchiseSale(client, depotId)).operator;\n  if (!depot || depot.status !== 'open' || depot.owner_character !== owner.id) throw new GameError('no_depot', 'That storefront is no longer operating.');\n",
      "  const depot = (await client.query(\"SELECT * FROM business_depots WHERE id=$1 AND status='open' FOR UPDATE\", [depotId])).rows[0];\n  if (!depot || depot.owner_character !== owner.id) throw new GameError('no_depot', 'That storefront is no longer operating.');\n"
    ]
  ]
});
export function assertFranchiseSourceTransfer(file, text) {
  const outer = firstBatchSourceBaseline(file, text);
  if (outer !== text.replaceAll('\r\n', '\n')) {
    const transfer = assertFirstBatchSourceTransfer(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text.replaceAll('\r\n', '\n')), firstBatchSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === BUYER_COOPERATIVE_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertBuyerCooperativeSourceTransfer(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, buyerCooperativeSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertCompanyLogisticsHubSourceTransfer(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, companyLogisticsHubSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === COMPANY_BANK_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertCompanyBankSourceTransfer(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, companyBankSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertCommercialPremisesSourceTransfer(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, commercialPremisesSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertCompanyWorkflowSourceTransfer(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, companyWorkflowSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertGameEmploymentSourceTransfer(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, gameEmploymentSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategyLeagueSource(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyMarketFeedSource(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCompanySuccessionSource(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategySource(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCoverageSource(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyInvoiceSource(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  if (hash(text) === INTEL_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyIntelSource(file, text), predecessor = assertFranchiseSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), intelSourceTransfer: transfer };
  }
  assert(FRANCHISE_SOURCE_CURRENT_PINS[file], 'Unknown franchise compatibility source');
  const actualSha256 = hash(text);
  assert.equal(actualSha256, FRANCHISE_SOURCE_CURRENT_PINS[file], 'Franchise source changed: ' + file);
  let baselineText = text;
  for (const [current, original] of FRANCHISE_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(current).length, 2, 'Franchise inverse is not exact and unique: ' + file);
    baselineText = baselineText.replace(current, original);
  }
  const baselineSha256 = FRANCHISE_SOURCE_PREDECESSOR_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Source differs beyond exact Franchise changes: ' + file);
  return { actualSha256, baselineText, baselineSha256, sourceRevision: FRANCHISE_SOURCE_REVIEWED_REVISION,
    sourceBlob: FRANCHISE_SOURCE_CURRENT_BLOBS[file], predecessorBlob: FRANCHISE_SOURCE_PREDECESSOR_BLOBS[file],
    inverseChunks: FRANCHISE_SOURCE_INVERSES[file].length };
}
// Crew logistics changes transfer unchanged historical guards by full-file reconstruction only.
export const CREW_LOGISTICS_SOURCE_REVIEWED_REVISION = '5f6d9b83496ddce31811d61c168d1ddd3cfb5896';
export const CREW_LOGISTICS_SOURCE_PREDECESSOR_REVISION = 'e3b5586c9887d980bc03c709841804b66e36752b';
export const CREW_LOGISTICS_SOURCE_CURRENT_PINS = Object.freeze({
  "src/server.js": "ca911a40235992e6e938eeab5a622a82133499fe9ac723bf61845477ab4fb113",
  "src/game.js": "8c299023ed047d5ff97125044e4e45e1052289bc82b470a08709b33d0402266c",
  "src/crew.js": "28f8646f59cc6e21c69055092d2b5c9ca4766df73a06f636f26dd31dfc063c09"
});
export const CREW_LOGISTICS_SOURCE_PREDECESSOR_PINS = Object.freeze({
  "src/server.js": "62b94b304ed000e3300879d5df63661653bbb17f52de40ab01ea30ce60db7361",
  "src/game.js": "bb8d9f1b9b63c4775631e0938888f2d85d1b5eb879bcf47f218d6ccd3b862f05",
  "src/crew.js": "e13d9e745f62292ef47766c756ece7c9d14e10368cc30784053a8e5e4c2487ed"
});
export const CREW_LOGISTICS_SOURCE_CURRENT_BLOBS = Object.freeze({
  "src/server.js": "7b32de9531c3d47ced6654175ec492afc81cc5cb",
  "src/game.js": "48e9c5ab0df52d00ab27b2077cf38dbde2fc1d2f",
  "src/crew.js": "1f3121bd1ea60f54575d47522a48fbf76d1296ce"
});
export const CREW_LOGISTICS_SOURCE_PREDECESSOR_BLOBS = Object.freeze({
  "src/server.js": "2e340c1069979debd62ef9f9190c76d1490caadd",
  "src/game.js": "8edf3e3370f8a7aec006acfe286074ad045be71b",
  "src/crew.js": "6556caa35fceb784761f14a14d8fbce3c8a5dcb7"
});
export const CREW_LOGISTICS_SOURCE_INVERSES = Object.freeze({
  "src/server.js": [
    [
      "import { register as registerCrewLogistics } from './routes/crewlogistics.js';\n",
      ""
    ],
    [
      "  registerCrewLogistics(app, { pool, auth });\n",
      ""
    ]
  ],
  "src/game.js": [
    [
      "// Serialized private projections use no accrual or persistence. Hooks establish the\n// membership boundary before actor/account locks; the callback cannot write or lock.\nexport async function withCharacterReadLocked(pool, accountId, fn, lockHooks = null) {\n  const client = await pool.connect();\n  try {\n    await client.query('BEGIN');\n    const prelockState = lockHooks?.beforeCharacterLock\n      ? await lockHooks.beforeCharacterLock(client, accountId) : null;\n    let r = await client.query('SELECT * FROM characters WHERE account_id=$1 AND alive FOR SHARE', [accountId]);\n    if (!r.rows.length) r = await client.query('SELECT * FROM characters WHERE account_id=$1 AND alive FOR SHARE', [accountId]);\n    if (!r.rows.length) throw new GameError('no_character', 'Create a character first.');\n    const ch = r.rows[0];\n    await client.query('SELECT account_id FROM account_persistent WHERE account_id=$1 FOR SHARE', [accountId]);\n    if (lockHooks?.afterAccountLock) await lockHooks.afterAccountLock(client, accountId, ch, prelockState);\n    const result = await fn(ch, readOnlyClient(client));\n    await client.query('COMMIT');\n    return result;\n  } catch (e) {\n    await client.query('ROLLBACK').catch(() => {});\n    throw deadlockToRetry(e);\n  } finally { client.release(); }\n}\n\n",
      ""
    ],
    [
      "const WRITE_ANY = /\\b(?:insert\\s+into|update\\s+\\w+\\s+set|delete\\s+from|truncate\\b|merge\\s+into|copy\\s+\\w+\\s+from|\\binto\\s+\\w+\\s+from|for\\s+update\\b|for\\s+no\\s+key\\s+update\\b|for\\s+(?:key\\s+)?share\\b|setval\\s*\\(|nextval\\s*\\(|pg_advisory_(?:xact_)?lock\\s*\\()/i;\n",
      "const WRITE_ANY = /\\b(?:insert\\s+into|update\\s+\\w+\\s+set|delete\\s+from|truncate\\b|merge\\s+into|copy\\s+\\w+\\s+from|\\binto\\s+\\w+\\s+from|for\\s+update\\b|for\\s+no\\s+key\\s+update\\b|for\\s+share\\b|setval\\s*\\(|nextval\\s*\\(|pg_advisory_(?:xact_)?lock\\s*\\()/i;\n"
    ]
  ],
  "src/crew.js": [
    [
      "  await client.query('UPDATE crew_logistics_links SET revoked_at=now() WHERE crew_id=$1 AND publisher_account_id=$2 AND revoked_at IS NULL', [crewId, ch.account_id]);\n",
      ""
    ],
    [
      "  await client.query('UPDATE crew_logistics_links SET revoked_at=now() WHERE crew_id=$1 AND publisher_account_id=$2 AND revoked_at IS NULL', [crewId, t.account_id]);\n",
      ""
    ]
  ]
});
export function assertCrewLogisticsSourceTransfer(file, text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategyLeagueSource(file, text), predecessor = assertCrewLogisticsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyMarketFeedSource(file, text), predecessor = assertCrewLogisticsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCompanySuccessionSource(file, text), predecessor = assertCrewLogisticsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategySource(file, text), predecessor = assertCrewLogisticsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCoverageSource(file, text), predecessor = assertCrewLogisticsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyInvoiceSource(file, text), predecessor = assertCrewLogisticsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  assert(CREW_LOGISTICS_SOURCE_CURRENT_PINS[file], 'Unknown Crew logistics compatibility source');
  const actualSha256 = hash(text);
  assert.equal(actualSha256, CREW_LOGISTICS_SOURCE_CURRENT_PINS[file], 'Crew logistics source changed: ' + file);
  let baselineText = text;
  for (const [current, original] of CREW_LOGISTICS_SOURCE_INVERSES[file]) {
    assert.equal(baselineText.split(current).length, 2, 'Crew logistics inverse is not exact and unique: ' + file);
    baselineText = baselineText.replace(current, original);
  }
  const baselineSha256 = CREW_LOGISTICS_SOURCE_PREDECESSOR_PINS[file];
  assert.equal(hash(baselineText), baselineSha256, 'Source differs beyond exact Crew logistics changes: ' + file);
  return { actualSha256, baselineText, baselineSha256, sourceRevision: CREW_LOGISTICS_SOURCE_REVIEWED_REVISION,
    sourceBlob: CREW_LOGISTICS_SOURCE_CURRENT_BLOBS[file], predecessorBlob: CREW_LOGISTICS_SOURCE_PREDECESSOR_BLOBS[file],
    inverseChunks: CREW_LOGISTICS_SOURCE_INVERSES[file].length };
}
// Exact warehouse source reconstruction transfers unchanged historical guards only.
export const WAREHOUSE_SOURCE_REVIEWED_REVISION = '7220e8b088921fcb277ecf7863fb724f113041b8';
export const WAREHOUSE_SERVER_PIN = '62b94b304ed000e3300879d5df63661653bbb17f52de40ab01ea30ce60db7361';
export const WAREHOUSE_SERVER_BLOB = '2e340c1069979debd62ef9f9190c76d1490caadd';
export const WAREHOUSE_SERVER_PREDECESSOR_BLOB = 'c102341216e7eb54b012d9dba41310116c21ec4a';
export const WAREHOUSE_SERVER_SOURCE_INVERSES = Object.freeze([
  [
    "import { register as registerWarehouses } from './routes/warehouses.js';\n",
    ""
  ],
  [
    "  registerWarehouses(app, { pool, auth });\n",
    ""
  ]
]);
export function assertWarehouseServerTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertWarehouseServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertWarehouseServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertWarehouseServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertWarehouseServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertWarehouseServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertWarehouseServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  const actualSha256 = hash(text);
  assert.equal(actualSha256, WAREHOUSE_SERVER_PIN, 'Warehouse server source changed');
  let baselineText = text;
  for (const [current, original] of WAREHOUSE_SERVER_SOURCE_INVERSES) {
    assert.equal(baselineText.split(current).length, 2, 'Warehouse inverse is not exact and unique');
    baselineText = baselineText.replace(current, original);
  }
  const baselineSha256 = SUPPLY_TENDER_SERVER_PIN;
  assert.equal(hash(baselineText), baselineSha256, 'Warehouse server differs beyond exact reviewed changes');
  return { actualSha256, baselineText, baselineSha256, sourceRevision: WAREHOUSE_SOURCE_REVIEWED_REVISION, sourceBlob: WAREHOUSE_SERVER_BLOB, predecessorBlob: WAREHOUSE_SERVER_PREDECESSOR_BLOB, inverseChunks: WAREHOUSE_SERVER_SOURCE_INVERSES.length };
}
export const WAREHOUSE_INVARIANT_PIN = '851df4ddbcc20a7a947c1b3c07821b5d0ff3a0fe9655cb59578aa7019680fb99';
export const WAREHOUSE_INVARIANT_BLOB = 'e4671955f894edef3ae655a0e199da8e8afa2ebf';
export const WAREHOUSE_INVARIANT_PREDECESSOR_BLOB = 'ba08838454bd98d6ac2c623a47492cd0de351693';
export const WAREHOUSE_INVARIANT_SOURCE_INVERSES = Object.freeze([
  [
    "    'gang:contract', 'bodyguard:', 'territory:', 'business:', 'depot:', 'warehouse:rent', 'pilot:capital', 'path:', 'casino:', 'convoy:', 'market:', 'underworld:',\n",
    "    'gang:contract', 'bodyguard:', 'territory:', 'business:', 'depot:', 'pilot:capital', 'path:', 'casino:', 'convoy:', 'market:', 'underworld:',\n"
  ],
  [
    "  const depots = (await pool.query('SELECT id,owner_character,treasury,stock,stock_cost FROM business_depots')).rows;\n  const depotJournal = (await pool.query('SELECT depot_id,reason,cash_delta,stock_delta,cost_delta,customer_character,lease_id,lease_stock_delta,lease_stock_after,lease_sequence FROM business_depot_journal')).rows;\n  const warehouseLeases = (await pool.query('SELECT * FROM business_warehouse_leases')).rows;\n  const warehouseNow = Date.now();\n",
    "  const depots = (await pool.query('SELECT id,treasury,stock,stock_cost FROM business_depots')).rows;\n  const depotJournal = (await pool.query('SELECT depot_id,reason,cash_delta,stock_delta,cost_delta FROM business_depot_journal')).rows;\n"
  ],
  [
    "    const warehouseReserved = warehouseLeases.filter(l => l.depot_id === depot.id)\n      .reduce((n, l) => n + (l.status === 'active' && new Date(l.expires_at).getTime() > warehouseNow\n        ? Number(l.units) : ['active', 'landlord_closed'].includes(l.status) ? Number(l.held_qty) : 0), 0);\n    push(`depot capacity:${depot.id}`, Math.max(0, promised + warehouseReserved - 40), 0, 0);\n",
    "    push(`depot capacity:${depot.id}`, Math.max(0, promised - 40), 0, 0);\n"
  ],
  [
    "  push('warehouse rent ledger', depotCash('warehouse_rent'), -(await sum(pool, \"currency='cash' AND reason='warehouse:rent'\")), 0);\n  push('warehouse journal ownership', depotJournal.filter(j => j.lease_id ? !warehouseLeases.some(l =>\n    l.id === j.lease_id && l.depot_id === j.depot_id && l.tenant_character === j.customer_character)\n    : Number(j.lease_stock_delta) !== 0 || j.lease_stock_after !== null || j.lease_sequence !== null).length, 0, 0);\n  const warehousePayments = (await pool.query(\"SELECT character_id,counterparty,amount FROM transactions WHERE currency='cash' AND reason='warehouse:rent'\")).rows;\n  const rentalPairs = new Map();\n  for (const row of depotJournal.filter(j => j.reason === 'warehouse_rent')) {\n    const key = JSON.stringify([row.customer_character, row.depot_id]);\n    const pair = rentalPairs.get(key) || { receipts: 0, debits: 0 };\n    pair.receipts += Number(row.cash_delta); rentalPairs.set(key, pair);\n  }\n  for (const row of warehousePayments) {\n    const key = JSON.stringify([row.character_id, row.counterparty]);\n    const pair = rentalPairs.get(key) || { receipts: 0, debits: 0 };\n    pair.debits -= Number(row.amount); rentalPairs.set(key, pair);\n  }\n  for (const [key, pair] of rentalPairs) push(`warehouse rent pairing:${key}`, pair.receipts, pair.debits, 0);\n  for (const lease of warehouseLeases) {\n    const entries = depotJournal.filter(j => j.lease_id === lease.id).sort((a, b) => Number(a.lease_sequence) - Number(b.lease_sequence));\n    const rent = entries.filter(j => j.reason === 'warehouse_rent');\n    push(`warehouse rent event:${lease.id}`, rent.length, 1, 0);\n    push(`warehouse rent terms:${lease.id}`, rent.reduce((n, j) => n + Number(j.cash_delta), 0), Number(lease.fee_cash), 0);\n    push(`warehouse custody:${lease.id}`, Number(lease.held_qty), entries.reduce((n, j) => n + Number(j.lease_stock_delta), 0), 0);\n    push(`warehouse landlord:${lease.id}`, depots.some(d => d.id === lease.depot_id && d.owner_character === lease.landlord_character) ? 0 : 1, 0, 0);\n    let held = 0, discontinuities = 0;\n    for (const [index, entry] of entries.entries()) {\n      held += Number(entry.lease_stock_delta);\n      if (Number(entry.lease_sequence) !== index + 1 || held < 0 || held > Number(lease.units)\n          || (Number(entry.lease_stock_delta) !== 0 && entry.lease_stock_after === null)\n          || (entry.lease_stock_after !== null && Number(entry.lease_stock_after) !== held)\n          || (index === 0 && entry.reason !== 'warehouse_rent')) discontinuities++;\n    }\n    push(`warehouse custody sequence:${lease.id}`, discontinuities, 0, 0);\n  }\n",
    ""
  ]
]);
export function assertWarehouseInvariantTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/invariants.js']) {
    const transfer = qualifyStrategyLeagueSource('src/invariants.js', text), predecessor = assertWarehouseInvariantTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/invariants.js']) {
    const transfer = qualifyMarketFeedSource('src/invariants.js', text), predecessor = assertWarehouseInvariantTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/invariants.js']) {
    const transfer = qualifyCompanySuccessionSource('src/invariants.js', text), predecessor = assertWarehouseInvariantTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/invariants.js']) {
    const transfer = qualifyStrategySource('src/invariants.js', text), predecessor = assertWarehouseInvariantTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/invariants.js']) {
    const transfer = qualifyCoverageSource('src/invariants.js', text), predecessor = assertWarehouseInvariantTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/invariants.js']) {
    const transfer = qualifyInvoiceSource('src/invariants.js', text), predecessor = assertWarehouseInvariantTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  const actualSha256 = hash(text);
  assert.equal(actualSha256, WAREHOUSE_INVARIANT_PIN, 'Warehouse invariant source changed');
  let baselineText = text;
  for (const [current, original] of WAREHOUSE_INVARIANT_SOURCE_INVERSES) {
    assert.equal(baselineText.split(current).length, 2, 'Warehouse inverse is not exact and unique');
    baselineText = baselineText.replace(current, original);
  }
  const baselineSha256 = AGENT_ECONOMY_INVARIANT_PIN;
  assert.equal(hash(baselineText), baselineSha256, 'Warehouse invariant differs beyond exact reviewed changes');
  return { actualSha256, baselineText, baselineSha256, sourceRevision: WAREHOUSE_SOURCE_REVIEWED_REVISION, sourceBlob: WAREHOUSE_INVARIANT_BLOB, predecessorBlob: WAREHOUSE_INVARIANT_PREDECESSOR_BLOB, inverseChunks: WAREHOUSE_INVARIANT_SOURCE_INVERSES.length };
}
export const WAREHOUSE_ESTATE_PIN = '5d39208e155fb81ef450640f7d4d44d4fb62e3c564b2d6588bee55b07f4671cc';
export const WAREHOUSE_ESTATE_BLOB = '1230efc72779eb839292d82dc1bf0e7a34f04b51';
export const WAREHOUSE_ESTATE_PREDECESSOR_BLOB = '49ad22ddf287ad62b76b9b84ea27c4e14c19bcaa';
export const WAREHOUSE_ESTATE_SOURCE_INVERSES = Object.freeze([
  [
    "import { closeWarehouseClaimsAtDeath } from '../warehouseleases.js';\n",
    ""
  ],
  [
    "  // Lock the sorted union before any existing depot/order lock, including\n  // mutual rentals. A landlord's death never consumes surviving tenant goods.\n  await closeWarehouseClaimsAtDeath(client, victim.id);\n",
    ""
  ]
]);
export function assertWarehouseEstateSourceChange(text) {
  if (hash(text) === INTEL_SOURCE_CURRENT_PINS['src/social/estate.js']) {
    const transfer = qualifyIntelSource('src/social/estate.js', text), predecessor = assertWarehouseEstateSourceChange(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), intelSourceTransfer: transfer };
  }
  const actualSha256 = hash(text);
  assert.equal(actualSha256, WAREHOUSE_ESTATE_PIN, 'Warehouse estate source changed');
  let baselineText = text;
  for (const [current, original] of WAREHOUSE_ESTATE_SOURCE_INVERSES) {
    assert.equal(baselineText.split(current).length, 2, 'Warehouse inverse is not exact and unique');
    baselineText = baselineText.replace(current, original);
  }
  const baselineSha256 = "ad9825bc36babb3c117e9efcdf490946e9bcdadcad4b406ceaecfa13823882ce";
  assert.equal(hash(baselineText), baselineSha256, 'Warehouse estate differs beyond exact reviewed changes');
  return { actualSha256, baselineText, baselineSha256, sourceRevision: WAREHOUSE_SOURCE_REVIEWED_REVISION, sourceBlob: WAREHOUSE_ESTATE_BLOB, predecessorBlob: WAREHOUSE_ESTATE_PREDECESSOR_BLOB, inverseChunks: WAREHOUSE_ESTATE_SOURCE_INVERSES.length };
}
export const SUPPLY_TENDER_SERVER_PIN = '0d222a2a3771758a28ac7bcda2124419cd9d9cebb6da65616120117bf34cae19';
export const SUPPLY_TENDER_SOURCE_REVIEWED_REVISION = 'b243a283c6f55a37bada5897798bf65f9ddd5553';
export const SUPPLY_TENDER_SERVER_BLOB = 'c102341216e7eb54b012d9dba41310116c21ec4a';
export const SUPPLY_TENDER_PREDECESSOR_SERVER_BLOB = '79771473a82bc7a088921dc254031b5e6a10801e';
export const SUPPLY_TENDER_SOURCE_INVERSES = Object.freeze([
  "import { register as registerSupplyTenders } from './routes/supplytenders.js';\n",
  "  registerSupplyTenders(app, { pool, auth });\n"
]);
// Registration transfers unchanged recovery guards, never new tender execution.
export function assertSupplyTenderServerTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertSupplyTenderServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertSupplyTenderServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertSupplyTenderServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertSupplyTenderServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertSupplyTenderServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertSupplyTenderServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
 const actualSha256 = hash(text);
 assert.equal(actualSha256, SUPPLY_TENDER_SERVER_PIN, 'Supply tender transfer source changed: src/server.js');
 let baselineText = text;
 for (const current of SUPPLY_TENDER_SOURCE_INVERSES) {
  assert.equal(baselineText.split(current).length, 2, 'Supply tender inverse is not exact and unique');
  baselineText = baselineText.replace(current, '');
 }
 assert.equal(hash(baselineText), DECISION_CALL_SERVER_PIN, 'Server differs beyond exact supply tender registration');
 return { actualSha256, baselineText, baselineSha256: DECISION_CALL_SERVER_PIN, sourceRevision: SUPPLY_TENDER_SOURCE_REVIEWED_REVISION, sourceBlob: SUPPLY_TENDER_SERVER_BLOB, predecessorServerBlob: SUPPLY_TENDER_PREDECESSOR_SERVER_BLOB, inverseChunks: 2 };
}
export const DECISION_CALL_SERVER_PIN = '7e599c49c28b6549182cb72f9e3ed7178b40549dea872bc7178ebb67a240ac8c';
export const DECISION_CALL_SOURCE_REVIEWED_REVISION = 'cd048a8940fb524af1320bcb4b3cd40d8e547820';
export const DECISION_CALL_SERVER_BLOB = '79771473a82bc7a088921dc254031b5e6a10801e';
export const DECISION_CALL_PREDECESSOR_SERVER_BLOB = '0a5053e000198230ca9e7e036233611c1ab44c8e';
export const DECISION_CALL_SOURCE_INVERSES = Object.freeze([
  [
    "import { validateDecisionCall, recordDecisionExecution } from './decisionproofs.js';\n",
    ""
  ],
  [
    "  const executeAgentAction = async (client, ch, h, turnId, actionId, lender = null, decisionCallId = null) => {\n",
    "  const executeAgentAction = async (client, ch, h, turnId, actionId, lender = null) => {\n"
  ],
  [
    "    const decision = decisionCallId === null ? null : await validateDecisionCall(client, {\n      callId: decisionCallId, accountId: ch.account_id, characterId: ch.id,\n      generation: Number(ch.generation), turnId, actionId,\n    });\n",
    ""
  ],
  [
    "    const decisionProof = decision ? await recordDecisionExecution(client, decision, { actionKind: action.kind, result }) : null;\n",
    ""
  ],
  [
    "    return { ...result, ...(decisionProof ? { decisionProof } : {}) };\n",
    "    return result;\n"
  ],
  [
    "    const decisionCallId = req.body?.decisionCallId === undefined ? null : req.body.decisionCallId;\n    if (decisionCallId !== null && (typeof decisionCallId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(decisionCallId)))\n      throw new G.GameError('decision_call', 'Provide a valid decision call identifier.');\n",
    ""
  ],
  [
    "            executeAgentAction(client, ch, h, turnId, actionId, owner, decisionCallId));\n",
    "            executeAgentAction(client, ch, h, turnId, actionId, owner));\n"
  ],
  [
    "            executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId), agentActionLocks);\n",
    "            executeAgentAction(client, ch, h, turnId, actionId), agentActionLocks);\n"
  ],
  [
    "            return executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId);\n",
    "            return executeAgentAction(client, ch, h, turnId, actionId, lender);\n"
  ],
  [
    "            return executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId);\n",
    "            return executeAgentAction(client, ch, h, turnId, actionId);\n"
  ],
  [
    "          return executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId);\n",
    "          return executeAgentAction(client, ch, h, turnId, actionId);\n"
  ],
  [
    "    const { decisionProof, ...actionResult } = result;\n    return { actionId, result: actionResult, turn, refreshRequired: !turn,\n      ...(decisionProof ? { decisionProof } : {}) };\n",
    "    return { actionId, result, turn, refreshRequired: !turn };\n"
  ]
]);
// Only unchanged historical guards transfer; receipt execution retains separate native proof.
export function assertDecisionCallServerTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertDecisionCallServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertDecisionCallServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertDecisionCallServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertDecisionCallServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertDecisionCallServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertDecisionCallServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
 const actualSha256 = hash(text);
 assert.equal(actualSha256, DECISION_CALL_SERVER_PIN, 'Decision call transfer source changed: src/server.js');
 let baselineText = text;
 for (const [current, previous] of DECISION_CALL_SOURCE_INVERSES) {
  assert.equal(baselineText.split(current).length, 2, 'Decision call inverse is not exact and unique');
  baselineText = baselineText.replace(current, previous);
 }
 assert.equal(hash(baselineText), STOREFRONT_CITY_SERVER_PIN, 'Server differs beyond exact decision receipt hook');
 return { actualSha256, baselineText, baselineSha256: STOREFRONT_CITY_SERVER_PIN, sourceRevision: DECISION_CALL_SOURCE_REVIEWED_REVISION, sourceBlob: DECISION_CALL_SERVER_BLOB, predecessorServerBlob: DECISION_CALL_PREDECESSOR_SERVER_BLOB, inverseChunks: 12 };
}
export const CITY_PRESENCE_SERVER_PIN = 'f4a8eece717448482ac55998c68df89e45344c208b6ea9d4c910be3ea281b1e1';
export const CITY_PRESENCE_SERVER_PREDECESSOR_PIN = 'd05da300976624ce7152bec6e5ba6a4a3ae43d8659e053faaffe8613c1762e4c';
export const CITY_PRESENCE_SOURCE_REVIEWED_REVISION = '83479446113cc3acffef1ee857a5d8d8e9fdc52c';
export const CITY_PRESENCE_SOURCE_PREDECESSOR_REVISION = '6485e8d0a01a3fb18417ec5eeded7cc1c62238b9';
export const BUSINESS_SERVER_PIN = '3e7a9ca662681aadf6cc0aaca515d0cbbc011287346223580288e83a9363e5df';
export const BUSINESS_SOURCE_REVIEWED_REVISION = '9db9b9a4d740c9faced0edece981145028f3f6c5';
export const BUSINESS_SOURCE_PREDECESSOR_REVISION = '16a55ff2f30c2f583ba8f3bbe5e409b4a126d9ec';
export const STOREFRONT_SERVER_PIN = '999208a6e0539a6c0be02119c13c108bf2a7853610a33eb16868de548529a914';
export const STOREFRONT_SOURCE_REVIEWED_REVISION = '213491e5a30aba9bc308d63d12b38b2473bc5e04';
export const STOREFRONT_SOURCE_PREDECESSOR_REVISION = 'e837b1bb32b3fda321d672779a9693a8b838de00';
const storefrontServerChanges = [
  [
    "      case 'delivery_depot_buy':\n        if (!lender) throw new G.GameError('no_depot', 'Refresh the storefront purchase.');\n        return Delivery.buyCommittedFromDepot(ch, lender, action.body.commitmentId, action.body.depotId, action.body, client, h);\n",
    ""
  ],
  [
    "      // Two-party actions preserve the canonical sorted character/account lock order.\n      const loanMatch = /^loan:([^:]+):repay$/.exec(actionId);\n      const storefrontMatch = /^delivery:([A-Za-z0-9_-]{1,128}):depot:([A-Za-z0-9_-]{1,128}):buy$/.exec(actionId);\n      if (storefrontMatch) {\n        const ownerId = (await pool.query(\"SELECT owner_character FROM business_depots WHERE id=$1 AND status='open'\", [storefrontMatch[2]])).rows[0]?.owner_character;\n        if (ownerId) {\n          result = await G.withTwoCharacters(pool, req.user.sub, ownerId, (ch, owner, client, h) =>\n            executeAgentAction(client, ch, h, turnId, actionId, owner));\n        } else {\n          result = await G.withCharacter(pool, req.user.sub, (ch, client, h) =>\n            executeAgentAction(client, ch, h, turnId, actionId), agentActionLocks);\n        }\n      } else if (loanMatch && loanMatch[1] !== 'house') {\n",
    "      // Player-loan repayment is the only issued two-party action. Preserve its existing stable\n      // character/account lock order; every other descriptor executes under the ordinary solo lock.\n      const loanMatch = /^loan:([^:]+):repay$/.exec(actionId);\n      if (loanMatch && loanMatch[1] !== 'house') {\n"
  ]
];
export const STOREFRONT_CITY_SERVER_PIN = '59ce69a095d83b89e6664b91fed593e760d59b89b34f4c5805ce207a81bdbe12';
export const STOREFRONT_CITY_SERVER_BLOB = '0a5053e000198230ca9e7e036233611c1ab44c8e';
export const STOREFRONT_CITY_SOURCE_PARENTS = Object.freeze([
  "aab87060e775fb18ccf952c417b1583c40fca931",
  "1e1a1ea745a2801cec3c7ba33a545d1cf9148524"
]);
// Composition preserves both independently pinned parent qualification scopes.
export function assertStorefrontCityServerTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertStorefrontCityServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertStorefrontCityServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertStorefrontCityServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertStorefrontCityServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertStorefrontCityServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertStorefrontCityServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
 const actualSha256 = hash(text);
 assert.equal(actualSha256, STOREFRONT_CITY_SERVER_PIN, 'Composed storefront/City transfer source changed: src/server.js');
 let baselineText = text;
 for (const [current, previous] of storefrontServerChanges) {
  assert.equal(baselineText.split(current).length, 2, 'Composed storefront inverse is not exact and unique');
  baselineText = baselineText.replace(current, previous);
 }
 assert.equal(hash(baselineText), CITY_SOCIAL_BUSINESS_SERVER_PIN, 'Server differs beyond exact composed storefront dispatch and pair locks');
 return { actualSha256, baselineText, baselineSha256: CITY_SOCIAL_BUSINESS_SERVER_PIN, sourceBlob: STOREFRONT_CITY_SERVER_BLOB, sourceParents: STOREFRONT_CITY_SOURCE_PARENTS, inverseChunks: 2 };
}
// New storefront execution retains separate current-source accounting and native proofs.
export function assertStorefrontServerTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertStorefrontServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertStorefrontServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertStorefrontServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertStorefrontServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertStorefrontServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertStorefrontServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
 const actualSha256 = hash(text);
 assert.equal(actualSha256, STOREFRONT_SERVER_PIN, 'Storefront transfer source changed: src/server.js');
 let baselineText = text;
 for (const [current, previous] of storefrontServerChanges) {
  assert.equal(baselineText.split(current).length, 2, 'Storefront inverse is not exact and unique');
  baselineText = baselineText.replace(current, previous);
 }
 assert.equal(hash(baselineText), BUSINESS_SERVER_PIN, 'Server differs beyond exact storefront dispatch and pair locks');
 return { actualSha256, baselineText, baselineSha256: BUSINESS_SERVER_PIN, sourceRevision: STOREFRONT_SOURCE_REVIEWED_REVISION, predecessorRevision: STOREFRONT_SOURCE_PREDECESSOR_REVISION, inverseChunks: 2 };
}
const businessServerChanges = [
  [
    "  const performAgentAction = async (action, ch, client, h, lender = null, policy = null) => {\n",
    "  const performAgentAction = async (action, ch, client, h, lender = null) => {\n"
  ],
  [
    "      case 'business_buy': return Business.buyBusiness(ch, tail('/v1/business/').replace(/\\/buy$/, ''), client, h);\n      case 'business_upkeep': return Business.payBusinessUpkeep(ch, client, h,\n        { maxCash: action.cost.cash, minimumReserve: policy.cashReserve });\n      case 'business_upgrade': return Business.upgradeBusiness(ch, tail('/v1/business/').replace(/\\/upgrade$/, ''), client, h);\n",
    ""
  ],
  [
    "    const result = await performAgentAction(action, ch, client, h, lender, current.policy);\n",
    "    const result = await performAgentAction(action, ch, client, h, lender);\n"
  ]
];
// Exact inverse only: new business execution retains its separate current-source proofs.
export function assertBusinessServerTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
 const actualSha256 = hash(text);
 assert.equal(actualSha256, BUSINESS_SERVER_PIN, 'Business transfer source changed: src/server.js');
 let baselineText = text;
 for (const [current, previous] of businessServerChanges) {
  assert.equal(baselineText.split(current).length, 2, 'Business inverse is not exact and unique');
  baselineText = baselineText.replace(current, previous);
 }
 assert.equal(hash(baselineText), CITY_PRESENCE_SERVER_PIN, 'Server differs beyond exact business dispatch');
 return { actualSha256, baselineText, baselineSha256: CITY_PRESENCE_SERVER_PIN,
  sourceRevision: BUSINESS_SOURCE_REVIEWED_REVISION, predecessorRevision: BUSINESS_SOURCE_PREDECESSOR_REVISION, inverseChunks: 3 };
}
const cityPresenceServerChunks = [
  "import { registerCity } from './routes/city.js';\n",
  '  registerCity(app, { pool, auth, onlineIds: () => [...wsClients.keys()] });\n',
];
// This exact registration inverse preserves only the previously reviewed paths.
// City encounter, private progress and lifecycle authority have separate current-source proofs.
export function assertCityPresenceServerTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertCityPresenceServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertCityPresenceServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertCityPresenceServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertCityPresenceServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertCityPresenceServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertCityPresenceServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  const actualSha256 = hash(text);
  assert.equal(actualSha256, CITY_PRESENCE_SERVER_PIN, 'City presence transfer source changed: src/server.js');
  let baselineText = text;
  for (const chunk of cityPresenceServerChunks) {
    assert.equal(baselineText.split(chunk).length, 2, 'City presence inverse is not exact and unique');
    baselineText = baselineText.replace(chunk, '');
  }
  assert.equal(hash(baselineText), CITY_PRESENCE_SERVER_PREDECESSOR_PIN, 'Server differs beyond exact City presence registration');
  return { actualSha256, baselineText, baselineSha256: CITY_PRESENCE_SERVER_PREDECESSOR_PIN,
    sourceRevision: CITY_PRESENCE_SOURCE_REVIEWED_REVISION, predecessorRevision: CITY_PRESENCE_SOURCE_PREDECESSOR_REVISION,
    inverseChunks: cityPresenceServerChunks.length };
}
export const CITY_SOCIAL_BUSINESS_SERVER_PIN = '87f05f32c9bf329e4c9f919c1d3313f718472f4ba4a454a5dd766e48a25be488';
export const CITY_SOCIAL_BUSINESS_SERVER_BLOB = 'f48b59999ce6505c90015acf44de9cd5c202ab73';
export const CITY_SOCIAL_BUSINESS_SOURCE_PARENTS = Object.freeze([
  'd9dd10ac00593fcedd077d6593d86208bfcdeeef',
  '5afd99aef81375a41702b2694fa39e4cb5b746ea',
]);
// A separate closed composition: both parent transfers retain their original complete pins.
// This inverse qualifies only unchanged historical guards, never either new execution authority.
export function assertCitySocialBusinessServerTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertCitySocialBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertCitySocialBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertCitySocialBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertCitySocialBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertCitySocialBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertCitySocialBusinessServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  const actualSha256 = hash(text);
  assert.equal(actualSha256, CITY_SOCIAL_BUSINESS_SERVER_PIN, 'City social/business transfer source changed: src/server.js');
  let baselineText = text;
  for (const [current, previous] of businessServerChanges) {
    assert.equal(baselineText.split(current).length, 2, 'City social/business inverse is not exact and unique');
    baselineText = baselineText.replace(current, previous);
  }
  assert.equal(hash(baselineText), CITY_SOCIAL_SERVER_PIN, 'Server differs beyond exact composed business dispatch');
  return { actualSha256, baselineText, baselineSha256: CITY_SOCIAL_SERVER_PIN,
    sourceBlob: CITY_SOCIAL_BUSINESS_SERVER_BLOB, sourceParents: CITY_SOCIAL_BUSINESS_SOURCE_PARENTS, inverseChunks: 3 };
}
export const DEED_RULES_CURRENT_PIN = '83b05a40c16eaa43d383fdf5c7ee1a7794e0b3b5c0be92fa20af19ced99699fb';
export const CITY_SOCIAL_SERVER_PIN = 'c50672019e746466be229950be32901ee809c5e7ee2102dde487c5d2c24bbaab';
export const CITY_SOCIAL_SERVER_PREDECESSOR_PIN = CITY_PRESENCE_SERVER_PIN;
export const CITY_SOCIAL_SOURCE_REVIEWED_REVISION = '33ef29b41e0b5b0b6b3eb8e857677aabf074b01f';
export const CITY_SOCIAL_SOURCE_PREDECESSOR_REVISION = '64ff651ce74a5f0c09ec94a6e7fc2fa6bb8b9e5a';
const citySocialServerChunks = [
  "import { registerCitySocial } from './city-social.js';\n",
  '  registerCitySocial(app, { pool, auth, onlineIds: () => [...wsClients.keys()], lastChatAt, capMap });\n',
  "    ['city-world-ui.js', 'application/javascript'], ['city-world-ui.css', 'text/css'],\n",
];
// Only unchanged historical guards transfer; new social authority and execution do not.
export function assertCitySocialServerTransfer(text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertCitySocialServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertCitySocialServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertCitySocialServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertCitySocialServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertCitySocialServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertCitySocialServerTransfer(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  const actualSha256 = hash(text);
  assert.equal(actualSha256, CITY_SOCIAL_SERVER_PIN, 'City social transfer source changed: src/server.js');
  let baselineText = text;
  for (const chunk of citySocialServerChunks) {
    assert.equal(baselineText.split(chunk).length, 2, 'City social inverse is not exact and unique');
    baselineText = baselineText.replace(chunk, '');
  }
  assert.equal(hash(baselineText), CITY_SOCIAL_SERVER_PREDECESSOR_PIN, 'Server differs beyond exact City social registration and assets');
  return { actualSha256, baselineText, baselineSha256: CITY_SOCIAL_SERVER_PREDECESSOR_PIN,
    sourceRevision: CITY_SOCIAL_SOURCE_REVIEWED_REVISION, predecessorRevision: CITY_SOCIAL_SOURCE_PREDECESSOR_REVISION,
    inverseChunks: citySocialServerChunks.length };
}
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
  const outer = firstBatchSourceBaseline(file, text);
  if (outer !== text.replaceAll('\r\n', '\n')) {
    const transfer = assertFirstBatchSourceTransfer(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text.replaceAll('\r\n', '\n')), firstBatchSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === BUYER_COOPERATIVE_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertBuyerCooperativeSourceTransfer(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, buyerCooperativeSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertCompanyLogisticsHubSourceTransfer(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, companyLogisticsHubSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === COMPANY_BANK_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertCompanyBankSourceTransfer(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, companyBankSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertCommercialPremisesSourceTransfer(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, commercialPremisesSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === COMPANY_WORKFLOW_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertCompanyWorkflowSourceTransfer(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, companyWorkflowSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text.replaceAll('\r\n', '\n')) === GAME_EMPLOYMENT_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertGameEmploymentSourceTransfer(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: transfer.actualSha256, gameEmploymentSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategyLeagueSource(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyMarketFeedSource(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCompanySuccessionSource(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategySource(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCoverageSource(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyInvoiceSource(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  if (hash(text) === INTEL_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyIntelSource(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), intelSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text) === FRANCHISE_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertFranchiseSourceTransfer(file, text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), franchiseSourceTransfer: transfer };
  }
  if (file === 'src/invariants.js' && hash(text) === WAREHOUSE_INVARIANT_PIN) {
    const transfer = assertWarehouseInvariantTransfer(text), predecessor = assertDeedBacklogCompatibility(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), warehouseSourceTransfer: transfer };
  }
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
  const operator = operatorEnvelope('src/server.js', text, assertGenesisSnapshotServerCompatibility);
  if (operator) return operator;
  if (hash(text) === CITY_HOMES_LEAGUE_SERVER_PIN) {
    const transfer = assertCityHomesLeagueServerTransfer(text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesLeagueSourceTransfer: transfer };
  }
  if (hash(text) === CITY_HOMES_FEED_SERVER_PIN) {
    const transfer = assertCityHomesFeedServerTransfer(text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesFeedSourceTransfer: transfer };
  }
  if (hash(text) === CITY_HOMES_SERVER_PIN) {
    const transfer = assertCityHomesServerTransfer(text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  if (hash(text) === INTEL_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyIntelSource('src/server.js', text), predecessor = assertGenesisSnapshotServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), intelSourceTransfer: transfer };
  }
  if (hash(text) === FRANCHISE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertFranchiseSourceTransfer('src/server.js', text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), franchiseSourceTransfer: transfer };
  }
  if (hash(text) === CREW_LOGISTICS_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertCrewLogisticsSourceTransfer('src/server.js', text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), crewLogisticsSourceTransfer: transfer };
  }
  if (hash(text) === WAREHOUSE_SERVER_PIN) {
    const transfer = assertWarehouseServerTransfer(text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), warehouseSourceTransfer: transfer };
  }
  if (hash(text) === SUPPLY_TENDER_SERVER_PIN) {
    const transfer = assertSupplyTenderServerTransfer(text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), supplyTenderSourceTransfer: transfer };
  }
  if (hash(text) === DECISION_CALL_SERVER_PIN) {
    const transfer = assertDecisionCallServerTransfer(text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), decisionCallSourceTransfer: transfer };
  }
  if (hash(text) === STOREFRONT_CITY_SERVER_PIN) {
    const transfer = assertStorefrontCityServerTransfer(text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), storefrontCitySourceTransfer: transfer };
  }
  if (hash(text) === STOREFRONT_SERVER_PIN) {
    const transfer = assertStorefrontServerTransfer(text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), storefrontSourceTransfer: transfer };
  }
  if (hash(text) === CITY_SOCIAL_BUSINESS_SERVER_PIN) {
    const transfer = assertCitySocialBusinessServerTransfer(text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySocialBusinessSourceTransfer: transfer };
  }
  if (hash(text) === BUSINESS_SERVER_PIN) {
    const transfer = assertBusinessServerTransfer(text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), businessSourceTransfer: transfer };
  }
  if (hash(text) === CITY_SOCIAL_SERVER_PIN) {
    const transfer = assertCitySocialServerTransfer(text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySocialSourceTransfer: transfer };
  }
  if (hash(text) === CITY_PRESENCE_SERVER_PIN) {
    const transfer = assertCityPresenceServerTransfer(text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), cityPresenceSourceTransfer: transfer };
  }
  if (hash(text) === GOODS_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertGoodsSourceTransfer('src/server.js', text);
    return { ...assertGenesisSnapshotServerCompatibility(transfer.baselineText), actualSha256: hash(text), goodsSourceTransfer: transfer };
  }
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
  const operator = operatorEnvelope('src/server.js', text, assertGenesisWrapperServerCompatibility);
  if (operator) return operator;
  if (hash(text) === CITY_HOMES_LEAGUE_SERVER_PIN) {
    const transfer = assertCityHomesLeagueServerTransfer(text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesLeagueSourceTransfer: transfer };
  }
  if (hash(text) === CITY_HOMES_FEED_SERVER_PIN) {
    const transfer = assertCityHomesFeedServerTransfer(text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesFeedSourceTransfer: transfer };
  }
  if (hash(text) === CITY_HOMES_SERVER_PIN) {
    const transfer = assertCityHomesServerTransfer(text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  if (hash(text) === INTEL_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyIntelSource('src/server.js', text), predecessor = assertGenesisWrapperServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), intelSourceTransfer: transfer };
  }
  if (hash(text) === FRANCHISE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertFranchiseSourceTransfer('src/server.js', text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), franchiseSourceTransfer: transfer };
  }
  if (hash(text) === CREW_LOGISTICS_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertCrewLogisticsSourceTransfer('src/server.js', text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), crewLogisticsSourceTransfer: transfer };
  }
  if (hash(text) === WAREHOUSE_SERVER_PIN) {
    const transfer = assertWarehouseServerTransfer(text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), warehouseSourceTransfer: transfer };
  }
  if (hash(text) === SUPPLY_TENDER_SERVER_PIN) {
    const transfer = assertSupplyTenderServerTransfer(text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), supplyTenderSourceTransfer: transfer };
  }
  if (hash(text) === DECISION_CALL_SERVER_PIN) {
    const transfer = assertDecisionCallServerTransfer(text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), decisionCallSourceTransfer: transfer };
  }
  if (hash(text) === STOREFRONT_CITY_SERVER_PIN) {
    const transfer = assertStorefrontCityServerTransfer(text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), storefrontCitySourceTransfer: transfer };
  }
  if (hash(text) === STOREFRONT_SERVER_PIN) {
    const transfer = assertStorefrontServerTransfer(text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), storefrontSourceTransfer: transfer };
  }
  if (hash(text) === CITY_SOCIAL_BUSINESS_SERVER_PIN) {
    const transfer = assertCitySocialBusinessServerTransfer(text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySocialBusinessSourceTransfer: transfer };
  }
  if (hash(text) === BUSINESS_SERVER_PIN) {
    const transfer = assertBusinessServerTransfer(text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), businessSourceTransfer: transfer };
  }
  if (hash(text) === CITY_SOCIAL_SERVER_PIN) {
    const transfer = assertCitySocialServerTransfer(text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySocialSourceTransfer: transfer };
  }
  if (hash(text) === CITY_PRESENCE_SERVER_PIN) {
    const transfer = assertCityPresenceServerTransfer(text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), cityPresenceSourceTransfer: transfer };
  }
  if (hash(text) === GOODS_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertGoodsSourceTransfer('src/server.js', text);
    return { ...assertGenesisWrapperServerCompatibility(transfer.baselineText), actualSha256: hash(text), goodsSourceTransfer: transfer };
  }
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
  const operator = operatorEnvelope('src/server.js', text, assertHttpReceiptServerCompatibility);
  if (operator) return operator;
  if (hash(text) === CITY_HOMES_LEAGUE_SERVER_PIN) {
    const transfer = assertCityHomesLeagueServerTransfer(text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesLeagueSourceTransfer: transfer };
  }
  if (hash(text) === CITY_HOMES_FEED_SERVER_PIN) {
    const transfer = assertCityHomesFeedServerTransfer(text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesFeedSourceTransfer: transfer };
  }
  if (hash(text) === CITY_HOMES_SERVER_PIN) {
    const transfer = assertCityHomesServerTransfer(text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  if (hash(text) === INTEL_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyIntelSource('src/server.js', text), predecessor = assertHttpReceiptServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), intelSourceTransfer: transfer };
  }
  if (hash(text) === FRANCHISE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertFranchiseSourceTransfer('src/server.js', text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), franchiseSourceTransfer: transfer };
  }
  if (hash(text) === CREW_LOGISTICS_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertCrewLogisticsSourceTransfer('src/server.js', text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), crewLogisticsSourceTransfer: transfer };
  }
  if (hash(text) === WAREHOUSE_SERVER_PIN) {
    const transfer = assertWarehouseServerTransfer(text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), warehouseSourceTransfer: transfer };
  }
  if (hash(text) === SUPPLY_TENDER_SERVER_PIN) {
    const transfer = assertSupplyTenderServerTransfer(text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), supplyTenderSourceTransfer: transfer };
  }
  if (hash(text) === DECISION_CALL_SERVER_PIN) {
    const transfer = assertDecisionCallServerTransfer(text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), decisionCallSourceTransfer: transfer };
  }
  if (hash(text) === STOREFRONT_CITY_SERVER_PIN) {
    const transfer = assertStorefrontCityServerTransfer(text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), storefrontCitySourceTransfer: transfer };
  }
  if (hash(text) === STOREFRONT_SERVER_PIN) {
    const transfer = assertStorefrontServerTransfer(text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), storefrontSourceTransfer: transfer };
  }
  if (hash(text) === CITY_SOCIAL_BUSINESS_SERVER_PIN) {
    const transfer = assertCitySocialBusinessServerTransfer(text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySocialBusinessSourceTransfer: transfer };
  }
  if (hash(text) === BUSINESS_SERVER_PIN) {
    const transfer = assertBusinessServerTransfer(text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), businessSourceTransfer: transfer };
  }
  if (hash(text) === CITY_SOCIAL_SERVER_PIN) {
    const transfer = assertCitySocialServerTransfer(text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySocialSourceTransfer: transfer };
  }
  if (hash(text) === CITY_PRESENCE_SERVER_PIN) {
    const transfer = assertCityPresenceServerTransfer(text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), cityPresenceSourceTransfer: transfer };
  }
  if (hash(text) === GOODS_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertGoodsSourceTransfer('src/server.js', text);
    return { ...assertHttpReceiptServerCompatibility(transfer.baselineText), actualSha256: hash(text), goodsSourceTransfer: transfer };
  }
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
  const operator = operatorEnvelope('src/server.js', text, assertDeedServerCompatibility);
  if (operator) return operator;
  if (hash(text) === CITY_HOMES_LEAGUE_SERVER_PIN) {
    const transfer = assertCityHomesLeagueServerTransfer(text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesLeagueSourceTransfer: transfer };
  }
  if (hash(text) === CITY_HOMES_FEED_SERVER_PIN) {
    const transfer = assertCityHomesFeedServerTransfer(text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesFeedSourceTransfer: transfer };
  }
  if (hash(text) === CITY_HOMES_SERVER_PIN) {
    const transfer = assertCityHomesServerTransfer(text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategyLeagueSource('src/server.js', text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyMarketFeedSource('src/server.js', text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCompanySuccessionSource('src/server.js', text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyStrategySource('src/server.js', text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyCoverageSource('src/server.js', text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyInvoiceSource('src/server.js', text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  if (hash(text) === INTEL_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = qualifyIntelSource('src/server.js', text), predecessor = assertDeedServerCompatibility(transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), intelSourceTransfer: transfer };
  }
  if (hash(text) === FRANCHISE_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertFranchiseSourceTransfer('src/server.js', text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), franchiseSourceTransfer: transfer };
  }
  if (hash(text) === CREW_LOGISTICS_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertCrewLogisticsSourceTransfer('src/server.js', text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), crewLogisticsSourceTransfer: transfer };
  }
  if (hash(text) === WAREHOUSE_SERVER_PIN) {
    const transfer = assertWarehouseServerTransfer(text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), warehouseSourceTransfer: transfer };
  }
  if (hash(text) === SUPPLY_TENDER_SERVER_PIN) {
    const transfer = assertSupplyTenderServerTransfer(text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), supplyTenderSourceTransfer: transfer };
  }
  if (hash(text) === DECISION_CALL_SERVER_PIN) {
    const transfer = assertDecisionCallServerTransfer(text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), decisionCallSourceTransfer: transfer };
  }
  if (hash(text) === STOREFRONT_CITY_SERVER_PIN) {
    const transfer = assertStorefrontCityServerTransfer(text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), storefrontCitySourceTransfer: transfer };
  }
  if (hash(text) === STOREFRONT_SERVER_PIN) {
    const transfer = assertStorefrontServerTransfer(text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), storefrontSourceTransfer: transfer };
  }
  if (hash(text) === CITY_SOCIAL_BUSINESS_SERVER_PIN) {
    const transfer = assertCitySocialBusinessServerTransfer(text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySocialBusinessSourceTransfer: transfer };
  }
  if (hash(text) === BUSINESS_SERVER_PIN) {
    const transfer = assertBusinessServerTransfer(text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), businessSourceTransfer: transfer };
  }
  if (hash(text) === CITY_SOCIAL_SERVER_PIN) {
    const transfer = assertCitySocialServerTransfer(text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), citySocialSourceTransfer: transfer };
  }
  if (hash(text) === CITY_PRESENCE_SERVER_PIN) {
    const transfer = assertCityPresenceServerTransfer(text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), cityPresenceSourceTransfer: transfer };
  }
  if (hash(text) === GOODS_SOURCE_CURRENT_PINS['src/server.js']) {
    const transfer = assertGoodsSourceTransfer('src/server.js', text);
    return { ...assertDeedServerCompatibility(transfer.baselineText), actualSha256: hash(text), goodsSourceTransfer: transfer };
  }
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
  const outer = firstBatchSourceBaseline(file, text);
  if (outer !== text.replaceAll('\r\n', '\n')) {
    const transfer = assertFirstBatchSourceTransfer(file, text), predecessor = assertCitySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text.replaceAll('\r\n', '\n')), firstBatchSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategyLeagueSource(file, text), predecessor = assertCitySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyMarketFeedSource(file, text), predecessor = assertCitySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCompanySuccessionSource(file, text), predecessor = assertCitySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategySource(file, text), predecessor = assertCitySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCoverageSource(file, text), predecessor = assertCitySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyInvoiceSource(file, text), predecessor = assertCitySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
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

// Exact source transfer for the separately tested finite goods market. This reconstructs
// complete prior bytes and qualifies unchanged car/recovery and committed cash/cargo equations
// only; new goods eligibility, bucket/counter accounting and authority do not inherit evidence.
export const GOODS_SOURCE_REVIEWED_REVISION = '29c8b418ba764f6058d643e8bbe6d685ba99e5ce';
export const GOODS_SOURCE_PREDECESSOR_REVISION = '7d4b1ffce56136bafddb46bb6bc609233b21712b';
export const GOODS_SOURCE_CURRENT_PINS = Object.freeze({
  'src/economy.js': 'd934bd109bf4599d79e6dba9ead2240b3b4c036d3f676a428941de2ca326ae91',
  'src/server.js': 'd05da300976624ce7152bec6e5ba6a4a3ae43d8659e053faaffe8613c1762e4c',
  'src/goodsquote.js': 'b191c83c4a3f254d6499fe8775025f9554d448151febb4a72573c5cbf5a44e50',
});
export const GOODS_SOURCE_PREDECESSOR_PINS = Object.freeze({
  'src/economy.js': 'c47bdfc17770ab3f47f9f5396547bdc408902fa3bdec1ba9ceb2e0934df0651b',
  'src/server.js': '647908de3e63520de306e91e8c34ff1152364fe0c7b3f97f9807cfddf2e016b8',
  'src/goodsquote.js': '16d9eccf4ed823c0c07db6f8a0d8d140246398fa9a693667dcd318b063923c74',
});
const goodsSourceInverse = {
  "src/economy.js": [
    [
      "// row (ch), the txn client, and the helper bag h = {ledger, rngLog, events, acct, owned}.\nimport crypto from 'node:crypto';\nimport { goodsBuyQuote } from './goodsquote.js';\nimport { consumeGoodsLiquidity } from './goodsmarket.js';\nimport { logCollect } from './collection.js';\nimport { registerItemTransactionUndo } from './items.js';\n// (tokenomics v2 step 2) the early-exit surcharge + toll split now live only on the WITHDRAWAL\n// boundary in chain.js — the AMM sell that used to carry them here is retired with the pool.\nimport { GameError, bumpFamilyTask, skillMult, trunkCap, npcMult, bumpStanding, bumpMastery, bus, notify } from './game.js';\nimport { CONSUMABLES, RACKETS, ASSETS, GOODS, GUNS, VESTS, CONSTANTS, SKILLS, UNDERWORLD, LIMITED_RUNS, runOf, limitedRunP, levelOf, cityEventOf, dayOf, carOf, carVal, carMelt, rollCar, rollTrim, effStat, cargoCapacity, goodPriceOf, priceBlock, gearOf, gunObjOf, RACKET_EMPIRE, racketUpgradeCost, racketIncomeLeveled, tycoonRankOf, seasonModOf, pathFx, rollRarity, ladderFx, ladderFenceMult, STAKE_LOCKS, stakeLockActive, effectiveStake, OPERATIONS, opSlotsOf, nextOpSlotLevel, jailed, usd, art , coolLeft, coolWait } from './rules.js';\n\nconst uid = () => crypto.randomUUID();\nconst cargoCount = (cargo) => Object.values(cargo).reduce((a, n) => a + (n || 0), 0);\n",
      "// row (ch), the txn client, and the helper bag h = {ledger, rngLog, events, acct, owned}.\nimport crypto from 'node:crypto';\nimport { goodsBuyQuote } from './goodsquote.js';\nimport { logCollect } from './collection.js';\nimport { registerItemTransactionUndo } from './items.js';\n// (tokenomics v2 step 2) the early-exit surcharge + toll split now live only on the WITHDRAWAL\n// boundary in chain.js — the AMM sell that used to carry them here is retired with the pool.\nimport { GameError, bumpFamilyTask, skillMult, trunkCap, npcMult, bumpStanding, bumpMastery, bus, notify } from './game.js';\nimport { CONSUMABLES, RACKETS, ASSETS, GOODS, GUNS, VESTS, CONSTANTS, SKILLS, UNDERWORLD, LIMITED_RUNS, runOf, limitedRunP, levelOf, cityEventOf, dayOf, carOf, carVal, carMelt, rollCar, rollTrim, effStat, cargoCapacity, goodPriceOf, gearOf, gunObjOf, RACKET_EMPIRE, racketUpgradeCost, racketIncomeLeveled, tycoonRankOf, seasonModOf, pathFx, rollRarity, ladderFx, ladderFenceMult, STAKE_LOCKS, stakeLockActive, effectiveStake, OPERATIONS, opSlotsOf, nextOpSlotLevel, jailed, usd, art , coolLeft, coolWait } from './rules.js';\n\nconst uid = () => crypto.randomUUID();\nconst cargoCount = (cargo) => Object.values(cargo).reduce((a, n) => a + (n || 0), 0);\n"
    ],
    [
      "  const cap = trunkCap(h);\n  if (cargoCount(h.owned.cargo) + n > cap) throw new GameError('cargo', `The trunk holds ${cap} units. Better Wheels carry more.`);\n  // STREET DEEDS 2C — controlled corners count for the ±5% turf price edge (set-union → OR, once)\n  const block = priceBlock();\n  const { unit, subtotal: cost, fee, tax } = goodsBuyQuote(goodId, ch.loc, n, h.owned, block);\n  if (Number(ch.cash) < cost + fee + tax) throw new GameError('cash', `That runs ${usd(cost + fee + tax)} with the 2% house take.`);\n  const liquidity = await consumeGoodsLiquidity(client, goodId, ch.loc, 'buy', n, block);\n  ch.cash = Number(ch.cash) - cost - fee - tax;\n  const have = (h.owned.cargo[goodId] || 0) + n;\n  h.owned.cargo[goodId] = have;\n",
      "  const cap = trunkCap(h);\n  if (cargoCount(h.owned.cargo) + n > cap) throw new GameError('cargo', `The trunk holds ${cap} units. Better Wheels carry more.`);\n  // STREET DEEDS 2C — controlled corners count for the ±5% turf price edge (set-union → OR, once)\n  const { unit, subtotal: cost, fee, tax } = goodsBuyQuote(goodId, ch.loc, n, h.owned);\n  if (Number(ch.cash) < cost + fee + tax) throw new GameError('cash', `That runs ${usd(cost + fee + tax)} with the 2% house take.`);\n  ch.cash = Number(ch.cash) - cost - fee - tax;\n  const have = (h.owned.cargo[goodId] || 0) + n;\n  h.owned.cargo[goodId] = have;\n"
    ],
    [
      "  // WAVE 59 — ten goods lines and one sentence: \"bought 2 at $190 a unit\" named nothing, so the\n  // cheapest crate and the dearest read identically but for the figure. The id is enough here — the\n  // client resolves it through goodName off the published /v1/rules catalog.\n  return { ok: true, good: goodId, unit, qty: n, spent: cost + fee + tax, liquidity };\n}\n\nexport async function sellGood(ch, goodId, qty, client, h) {\n",
      "  // WAVE 59 — ten goods lines and one sentence: \"bought 2 at $190 a unit\" named nothing, so the\n  // cheapest crate and the dearest read identically but for the figure. The id is enough here — the\n  // client resolves it through goodName off the published /v1/rules catalog.\n  return { ok: true, good: goodId, unit, qty: n, spent: cost + fee + tax };\n}\n\nexport async function sellGood(ch, goodId, qty, client, h) {\n"
    ],
    [
      "  const have = h.owned.cargo[goodId] || 0;\n  const n = Math.min(Math.max(1, Math.floor(Number(qty) || 0)), have);\n  if (n <= 0) throw new GameError('none', 'Nothing of that in the trunk.');\n  const block = priceBlock();\n  const ev = cityEventOf(dayOf());\n  // SEASONAL MODIFIER (slate #6): THE GOLD RUSH lifts every sale (composes like the city event)\n  const unit = Math.round(goodPriceOf(goodId, ch.loc, block) * turfMult([...(h.owned.held || []), ...(h.owned.deedPerk || [])], ch.loc, 'sell') * (ev.tradeMult || 1) * pathFx(ch, 'goodsSell') * (seasonModOf().tradeSellMult || 1)); // PATHS v2 — ledger keeps 1.05; the Gun sells at 0.95 (the soldier's-no-merchant handicap); deed corners count (2C)\n  const gross = unit * n, fee = Math.ceil(gross * 0.01), tax = Math.ceil(gross * 0.01);\n  const net = gross - fee - tax;\n  const liquidity = await consumeGoodsLiquidity(client, goodId, ch.loc, 'sell', n, block);\n  ch.cash = Number(ch.cash) + net;\n  const left = have - n;\n  h.owned.cargo[goodId] = left;\n",
      "  const have = h.owned.cargo[goodId] || 0;\n  const n = Math.min(Math.max(1, Math.floor(Number(qty) || 0)), have);\n  if (n <= 0) throw new GameError('none', 'Nothing of that in the trunk.');\n  const ev = cityEventOf(dayOf());\n  // SEASONAL MODIFIER (slate #6): THE GOLD RUSH lifts every sale (composes like the city event)\n  const unit = Math.round(goodPriceOf(goodId, ch.loc) * turfMult([...(h.owned.held || []), ...(h.owned.deedPerk || [])], ch.loc, 'sell') * (ev.tradeMult || 1) * pathFx(ch, 'goodsSell') * (seasonModOf().tradeSellMult || 1)); // PATHS v2 — ledger keeps 1.05; the Gun sells at 0.95 (the soldier's-no-merchant handicap); deed corners count (2C)\n  const gross = unit * n, fee = Math.ceil(gross * 0.01), tax = Math.ceil(gross * 0.01);\n  const net = gross - fee - tax;\n  ch.cash = Number(ch.cash) + net;\n  const left = have - n;\n  h.owned.cargo[goodId] = left;\n"
    ],
    [
      "  await takeHouse(client, tax);\n  await h.bumpDaily(client, ch.id, 'goods');\n  await bumpMastery(client, h, ch, 'commerce', 'sell'); // THE TRADES — goods moved at a margin is commerce\n  return { ok: true, good: goodId, unit, qty: n, earned: net, liquidity };\n}\n\n// ═══════════════════ RACKETS & ASSETS (§5.4) ═══════════════════\n",
      "  await takeHouse(client, tax);\n  await h.bumpDaily(client, ch.id, 'goods');\n  await bumpMastery(client, h, ch, 'commerce', 'sell'); // THE TRADES — goods moved at a margin is commerce\n  return { ok: true, good: goodId, unit, qty: n, earned: net };\n}\n\n// ═══════════════════ RACKETS & ASSETS (§5.4) ═══════════════════\n"
    ]
  ],
  "src/server.js": [
    [
      "  // ── M2: deterministic market board (§7.11) — public, server-computed ──\n  // ONE implementation, shared with the /v1/block aggregate that also serves this board — two copies\n  // is how the two ends of a mirror come to disagree.\n  app.get('/v1/market/prices', async () => Block.marketPrices(pool));\n\n  // THE SEASON HAS AN ENDING — the clock and the roll of past seasons. Keyless like /v1/city: a\n  // deadline nobody can read is not a deadline, and the record is the whole point of the arc.\n",
      "  // ── M2: deterministic market board (§7.11) — public, server-computed ──\n  // ONE implementation, shared with the /v1/block aggregate that also serves this board — two copies\n  // is how the two ends of a mirror come to disagree.\n  app.get('/v1/market/prices', async () => Block.marketPrices());\n\n  // THE SEASON HAS AN ENDING — the clock and the roll of past seasons. Keyless like /v1/city: a\n  // deadline nobody can read is not a deadline, and the record is the whole point of the arc.\n"
    ]
  ],
  "src/goodsquote.js": [
    [
      "import { goodPriceOf, priceBlock } from './rules.js';\n\n// Shared by procurement observations and settlement: round the turf-adjusted unit price\n// first, then round each of the two cash takes independently.\nexport function goodsBuyQuote(good, district, quantity, owned, block = priceBlock()) {\n  const controlled = [...(owned.held || []), ...(owned.deedPerk || [])].includes(district);\n  const unit = Math.round(goodPriceOf(good, district, block) * (controlled ? 0.95 : 1));\n  const subtotal = unit * quantity;\n  const fee = Math.ceil(subtotal * 0.01);\n  const tax = Math.ceil(subtotal * 0.01);\n",
      "import { goodPriceOf } from './rules.js';\n\n// Shared by procurement observations and settlement: round the turf-adjusted unit price\n// first, then round each of the two cash takes independently.\nexport function goodsBuyQuote(good, district, quantity, owned) {\n  const controlled = [...(owned.held || []), ...(owned.deedPerk || [])].includes(district);\n  const unit = Math.round(goodPriceOf(good, district) * (controlled ? 0.95 : 1));\n  const subtotal = unit * quantity;\n  const fee = Math.ceil(subtotal * 0.01);\n  const tax = Math.ceil(subtotal * 0.01);\n"
    ]
  ]
};
export function assertGoodsSourceTransfer(file, text) {
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategyLeagueSource(file, text), predecessor = assertGoodsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyMarketFeedSource(file, text), predecessor = assertGoodsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCompanySuccessionSource(file, text), predecessor = assertGoodsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategySource(file, text), predecessor = assertGoodsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCoverageSource(file, text), predecessor = assertGoodsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyInvoiceSource(file, text), predecessor = assertGoodsSourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  assert(Object.hasOwn(GOODS_SOURCE_CURRENT_PINS, file), 'Unknown goods transfer source');
  assert.equal(hash(text), GOODS_SOURCE_CURRENT_PINS[file], 'Goods transfer source changed: ' + file);
  let baselineText = text;
  for (const [current, original] of goodsSourceInverse[file]) {
    assert.equal(baselineText.split(current).length, 2, 'Goods source inverse is not exact and unique');
    baselineText = baselineText.replace(current, original);
  }
  assert.equal(hash(baselineText), GOODS_SOURCE_PREDECESSOR_PINS[file], 'Source differs beyond exact goods changes');
  return { actualSha256: hash(text), baselineText, baselineSha256: GOODS_SOURCE_PREDECESSOR_PINS[file],
    sourceRevision: GOODS_SOURCE_REVIEWED_REVISION, predecessorRevision: GOODS_SOURCE_PREDECESSOR_REVISION,
    inverseChunks: goodsSourceInverse[file].length };
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
  const operator = operatorEnvelope(file, text, prior => assertEconomySourceTransfer(file, prior));
  if (operator) return operator;
  if (file === 'src/server.js' && hash(text) === CITY_HOMES_LEAGUE_SERVER_PIN) {
    const transfer = assertCityHomesLeagueServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesLeagueSourceTransfer: transfer };
  }
  if (file === 'src/server.js' && hash(text) === CITY_HOMES_FEED_SERVER_PIN) {
    const transfer = assertCityHomesFeedServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesFeedSourceTransfer: transfer };
  }
  if (file === 'src/server.js' && hash(text) === CITY_HOMES_SERVER_PIN) {
    const transfer = assertCityHomesServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), cityHomesSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_LEAGUE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategyLeagueSource(file, text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategyLeagueSourceTransfer: transfer };
  }
  if (hash(text) === MARKET_FEED_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyMarketFeedSource(file, text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), marketFeedSourceTransfer: transfer };
  }
  if (hash(text) === COMPANY_SUCCESSION_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCompanySuccessionSource(file, text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), companySuccessionSourceTransfer: transfer };
  }
  if (hash(text) === STRATEGY_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyStrategySource(file, text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), strategySourceTransfer: transfer };
  }
  if (hash(text) === COVERAGE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyCoverageSource(file, text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), coverageSourceTransfer: transfer };
  }
  if (hash(text) === INVOICE_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyInvoiceSource(file, text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), invoiceSourceTransfer: transfer };
  }
  if (hash(text) === INTEL_SOURCE_CURRENT_PINS[file]) {
    const transfer = qualifyIntelSource(file, text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), intelSourceTransfer: transfer };
  }
  if (file === 'src/server.js' && hash(text) === FRANCHISE_SOURCE_CURRENT_PINS[file]) {
    const transfer = assertFranchiseSourceTransfer(file, text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
    return { ...predecessor, actualSha256: hash(text), franchiseSourceTransfer: transfer };
  }
 if (file === 'src/server.js' && hash(text) === CREW_LOGISTICS_SOURCE_CURRENT_PINS[file]) {
  const transfer = assertCrewLogisticsSourceTransfer(file, text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + transfer.inverseChunks, crewLogisticsSourceTransfer: transfer };
 }
 if (file === 'src/server.js' && hash(text) === WAREHOUSE_SERVER_PIN) {
  const transfer = assertWarehouseServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + transfer.inverseChunks, warehouseSourceTransfer: transfer };
 }
 if (file === 'src/server.js' && hash(text) === SUPPLY_TENDER_SERVER_PIN) {
  const transfer = assertSupplyTenderServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + transfer.inverseChunks, supplyTenderSourceTransfer: transfer };
 }
 if (file === 'src/server.js' && hash(text) === DECISION_CALL_SERVER_PIN) {
  const transfer = assertDecisionCallServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + transfer.inverseChunks, decisionCallSourceTransfer: transfer };
 }
 if (file === 'src/server.js' && hash(text) === STOREFRONT_CITY_SERVER_PIN) {
  const transfer = assertStorefrontCityServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + transfer.inverseChunks, storefrontCitySourceTransfer: transfer };
 }
 if (file === 'src/server.js' && hash(text) === STOREFRONT_SERVER_PIN) {
  const transfer = assertStorefrontServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + transfer.inverseChunks, storefrontSourceTransfer: transfer };
 }
 if (file === 'src/server.js' && hash(text) === CITY_SOCIAL_BUSINESS_SERVER_PIN) {
  const transfer = assertCitySocialBusinessServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + transfer.inverseChunks, citySocialBusinessSourceTransfer: transfer };
 }
 if (file === 'src/server.js' && hash(text) === BUSINESS_SERVER_PIN) {
  const transfer = assertBusinessServerTransfer(text), predecessor = assertEconomySourceTransfer(file, transfer.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + 3, businessSourceTransfer: transfer };
 }
 if (file === 'src/server.js' && hash(text) === CITY_SOCIAL_SERVER_PIN) {
  const social = assertCitySocialServerTransfer(text), predecessor = assertEconomySourceTransfer(file, social.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + social.inverseChunks, citySocialSourceTransfer: social };
 }
 if (file === 'src/server.js' && hash(text) === CITY_PRESENCE_SERVER_PIN) {
  const presence = assertCityPresenceServerTransfer(text), predecessor = assertEconomySourceTransfer(file, presence.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + presence.inverseChunks, cityPresenceSourceTransfer: presence };
 }
 if (hash(text) === GOODS_SOURCE_CURRENT_PINS[file]) {
  const goods = assertGoodsSourceTransfer(file, text), predecessor = assertEconomySourceTransfer(file, goods.baselineText);
  return { ...predecessor, actualSha256: hash(text), inverseChunks: predecessor.inverseChunks + goods.inverseChunks, goodsSourceTransfer: goods };
 }
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
