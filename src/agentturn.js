// THE AGENT TURN — one compact, personalized observation for an autonomous player. Agent reads share
// the hard cadence, so forcing me → opportunities → notifications before every move burns the budget
// on observation. This response joins the existing coach and economic board, then adds executable
// action descriptors whose method/path/body can be handed straight back to the API.
import crypto from 'node:crypto';
import { restockCandidates } from './restock.js';
import { depotState, depotPilotEnabled } from './depot.js';
import { deliveryBoard, deliveryIntakeEnabled, DELIVERY } from './delivery.js';
import { BLACK_MARKET, CONSTANTS, CRIMES, M3, PACING, drugOf, goodPriceOf, kitchenOf, levelOf, jailed, safeHoused } from './rules.js';
import { view } from './game.js';
import { opportunityBoard } from './opportunities.js';
import { chainConfig } from './chain.js';
import { businessesOf } from './business.js';
import { territoryOf } from './territory.js';
import { convoyBoard } from './convoy.js';
import { loanBoard } from './loans.js';
import { crewBoard } from './crew.js';
import { getDaily, onboardBoard } from './growth.js';
import { careerBoard } from './career.js';
import { exploreBoard } from './explore.js';

const RANKING = Object.freeze({
  method: 'cash_equivalent', cashUnit: 'dollars', respectCashValue: 25,
  liabilityProtectionWeight: 1.25, refreshAfterEveryAction: true,
});
const POLICY = Object.freeze({
  cashReserve: 1000, minArbitrageProfit: 25, allowPvP: false, allowBorrowing: false,
});

const rounded = (value) => Math.round(Number(value) * 100) / 100;

function valuation({ cash = 0, treasury = 0, inventory = 0, liability = 0,
  respect = 0, confidence = 1, basis }) {
  const expectedCash = rounded(cash);
  const expectedTreasury = rounded(treasury);
  const expectedInventory = rounded(inventory);
  const expectedLiability = rounded(liability);
  const expectedRespect = rounded(respect);
  return {
    score: rounded(expectedCash + expectedTreasury + expectedInventory
      + expectedLiability * RANKING.liabilityProtectionWeight
      + expectedRespect * RANKING.respectCashValue),
    ev: { cash: expectedCash, treasury: expectedTreasury, inventory: expectedInventory,
      liability: expectedLiability, respect: expectedRespect, confidence, basis },
  };
}

function valued(action, estimate) {
  return { ...action, ...valuation(estimate) };
}

function rankActions(actions) {
  return actions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((action, index) => ({ ...action, rank: index + 1 }));
}

function rankPlans(plans) {
  return plans.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((plan, index) => ({ ...plan, rank: index + 1 }));
}

function extractionRailConfigured() {
  try { chainConfig(); }
  catch { return false; }
  return /^(?:0x)?[0-9a-f]{64}$/i.test(process.env.VOUCHER_SIGNER_PK || '');
}

function extractionState(acct) {
  const wallet = acct.wallet_address || null;
  const minted = !!acct.minted;
  const railLive = extractionRailConfigured();
  const stage = !wallet ? 'wallet_required' : !minted ? 'character_mint_required' : !railLive ? 'rail_dormant' : 'ready';
  return { stage, wallet, minted, canExtract: stage === 'ready' };
}

function crimeDescriptor(crime, { executable, blockedBy } = {}) {
  const standard = M3.CRIME_APPROACHES.standard;
  const success = crime.base * standard.successMult;
  return valued({
    id: `crime:${crime.id}:standard`, kind: 'crime', label: crime.name,
    method: 'POST', path: `/v1/crimes/${crime.id}`, body: { approach: 'standard' }, executable,
    cost: { nerve: crime.nerve },
    reward: { cash: { min: crime.cash[0], max: crime.cash[1] }, respect: crime.respect },
    risk: { baseSuccessPct: Math.round(success * 1000) / 10, jailMinutes: crime.jail },
    ...(blockedBy ? { blockedBy } : {}),
  }, {
    cash: ((crime.cash[0] + crime.cash[1]) / 2) * success,
    respect: crime.respect * success,
    confidence: 0.6,
    basis: 'Published base success rate times midpoint reward; excludes personalized stats and jail cost.',
  });
}

function crimePlan(ch, owned) {
  const lvl = levelOf(Number(ch.respect));
  const unlocked = CRIMES.filter((c) => c.lvl <= lvl);
  if (!unlocked.length) return null;
  if (jailed(ch)) {
    const earliest = unlocked.sort((a, b) => a.nerve - b.nerve)[0];
    return crimeDescriptor(earliest, { executable: false,
      blockedBy: [{ code: 'jailed', availableAt: new Date(ch.jail_until).toISOString() }] });
  }
  const eligible = unlocked.filter((c) => c.nerve <= Number(ch.nerve));
  // Expected gross under the published base chance is the honest early ranking signal. The action
  // remains a server-side roll; the descriptor publishes a range, never promises an outcome.
  const best = eligible.sort((a, b) =>
    (((b.cash[0] + b.cash[1]) / 2) * b.base) - (((a.cash[0] + a.cash[1]) / 2) * a.base))[0];
  if (best) return crimeDescriptor(best, { executable: true });
  const earliest = unlocked.sort((a, b) => a.nerve - b.nerve)[0];
  const regenPerMinute = PACING.NERVE_REGEN_PER_MIN * ((owned.held || []).includes('cathedral') ? 2 : 1);
  const waitMs = Math.ceil(Math.max(0, earliest.nerve - Number(ch.nerve)) / regenPerMinute * 60000);
  return crimeDescriptor(earliest, { executable: false,
    blockedBy: [{ code: 'nerve', current: Number(ch.nerve), required: earliest.nerve,
      availableAt: new Date(Date.now() + waitMs).toISOString() }] });
}

function marketActions(ch, owned, opportunities) {
  if (jailed(ch)) return [];
  return opportunities.filter((o) => o.type === 'order'
      && o.posterId !== ch.id && o.district === ch.loc && Number(owned.cargo?.[o.good] || 0) > 0)
    .map((o) => {
      const qty = Math.min(Number(o.wanted), Number(owned.cargo[o.good]));
      const gross = qty * Number(o.unitPrice);
      const net = gross - Math.ceil(gross * BLACK_MARKET.TAKE_BPS / 10000);
      return valued({
        id: `market:fill:${o.listingId}`, kind: 'market_fill', label: `Fill ${o.good} buy order`,
        method: 'POST', path: `/v1/market/${o.listingId}/fill`, body: { qty }, executable: true,
        cost: { goods: { [o.good]: qty } }, reward: { cash: { gross, net } }, risk: { level: 'none' },
      }, { cash: net, inventory: -qty * goodPriceOf(o.good, ch.loc), confidence: 1,
        basis: 'Order proceeds after the published market take, less current district value of delivered cargo.' });
    });
}

function buyCost(unit, qty) {
  const subtotal = unit * qty;
  return subtotal + Math.ceil(subtotal * 0.01) * 2;
}

function sellNet(unit, qty) {
  const gross = unit * qty;
  return gross - Math.ceil(gross * 0.01) * 2;
}

function arbitragePlans(ch, sheet, owned, niches) {
  if (jailed(ch)) return { plans: [], actions: [] };
  const usedCargo = Object.values(owned.cargo || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
  const capacity = Math.max(0, Number(sheet.cargoCap) - usedCargo);
  const plans = [];
  const actions = [];
  for (const edge of niches || []) {
    const held = Math.min(Number(owned.cargo?.[edge.good] || 0), edge.buying);
    const id = `arbitrage:${edge.good}:${edge.buyIn}:${edge.sellIn}`;
    if (held > 0) {
      const atSeller = ch.loc === edge.sellIn;
      const travel = atSeller ? 0 : CONSTANTS.TRAVEL_COST;
      const proceeds = sellNet(edge.sellPrice, held);
      const estimate = valuation({ cash: proceeds - travel, inventory: -held * goodPriceOf(edge.good, ch.loc), confidence: 0.75,
        basis: 'Expected liquidation proceeds after the 2% sell take and travel, less current district value of held cargo; acquisition cost is already sunk and unavailable.' });
      const nextActionId = `${id}:${atSeller ? 'sell' : 'travel-sell'}`;
      plans.push({
        id, kind: 'arbitrage', label: `${edge.name}: ${edge.buyIn} to ${edge.sellIn}`,
        ...estimate, quantity: held, buyIn: edge.buyIn, buyPrice: edge.buyPrice,
        sellIn: edge.sellIn, sellPrice: edge.sellPrice,
        status: atSeller ? 'sell' : 'travel_to_sell', nextActionId, refreshAfterStep: true,
        route: [
          { kind: 'travel', district: edge.buyIn }, { kind: 'buy', good: edge.good, quantity: held },
          { kind: 'travel', district: edge.sellIn }, { kind: 'sell', good: edge.good, quantity: held },
        ],
      });
      if (atSeller || Number(ch.cash) >= CONSTANTS.TRAVEL_COST) {
        actions.push(valued({
          id: nextActionId, planId: id, kind: atSeller ? 'arbitrage_sell' : 'arbitrage_travel',
          label: atSeller ? `Sell ${held} ${edge.name}` : `Travel to ${edge.sellIn} to sell ${edge.name}`,
          method: 'POST', path: atSeller ? '/v1/goods/sell' : `/v1/travel/${edge.sellIn}`,
          body: atSeller ? { goodId: edge.good, qty: held } : {}, executable: true,
          cost: atSeller ? { goods: { [edge.good]: held } } : { cash: CONSTANTS.TRAVEL_COST },
          reward: { cash: { net: proceeds } }, risk: { level: 'low', priceBlock: 'current' },
        }, estimate.ev));
      }
      continue;
    }
    if (capacity <= 0) continue;
    const preBuyTravel = ch.loc === edge.buyIn ? 0 : CONSTANTS.TRAVEL_COST;
    const sellTravel = edge.buyIn === edge.sellIn ? 0 : CONSTANTS.TRAVEL_COST;
    const spendable = Number(ch.cash) - POLICY.cashReserve - preBuyTravel - sellTravel;
    let quantity = Math.min(capacity, edge.stock, edge.buying, Math.floor(spendable / Math.max(1, edge.buyPrice * 1.02)));
    while (quantity > 0 && buyCost(edge.buyPrice, quantity) > spendable) quantity--;
    if (quantity <= 0) continue;
    const acquisition = buyCost(edge.buyPrice, quantity);
    const proceeds = sellNet(edge.sellPrice, quantity);
    const profit = proceeds - acquisition - preBuyTravel - sellTravel;
    if (profit < POLICY.minArbitrageProfit) continue;
    const estimate = valuation({ cash: profit, confidence: 0.8,
      basis: 'Deterministic district prices after 2% buy/sell takes and required travel; excludes personal turf, path, event, and season modifiers.' });
    const atSupplier = ch.loc === edge.buyIn;
    const nextActionId = `${id}:${atSupplier ? 'buy' : 'travel-buy'}`;
    plans.push({
      id, kind: 'arbitrage', label: `${edge.name}: ${edge.buyIn} to ${edge.sellIn}`,
      ...estimate, quantity, buyIn: edge.buyIn, buyPrice: edge.buyPrice,
      sellIn: edge.sellIn, sellPrice: edge.sellPrice,
      status: atSupplier ? 'buy' : 'travel_to_buy', nextActionId, refreshAfterStep: true,
      route: [
        { kind: 'travel', district: edge.buyIn }, { kind: 'buy', good: edge.good, quantity },
        { kind: 'travel', district: edge.sellIn }, { kind: 'sell', good: edge.good, quantity },
      ],
    });
    actions.push(valued({
      id: nextActionId, planId: id, kind: atSupplier ? 'arbitrage_buy' : 'arbitrage_travel',
      label: atSupplier ? `Buy ${quantity} ${edge.name}` : `Travel to ${edge.buyIn} for ${edge.name}`,
      method: 'POST', path: atSupplier ? '/v1/goods/buy' : `/v1/travel/${edge.buyIn}`,
      body: atSupplier ? { goodId: edge.good, qty: quantity } : {}, executable: true,
      cost: atSupplier ? { cash: acquisition } : { cash: CONSTANTS.TRAVEL_COST },
      reward: { planCash: profit }, risk: { level: 'low', priceBlock: 'current' },
    }, estimate.ev));
  }
  return { plans, actions };
}

function kitchenPlans(sheet) {
  const batch = sheet.batch;
  const lab = kitchenOf(sheet.lab);
  if (!batch || !lab) return { plans: [], actions: [], blockedActions: [] };
  const drug = drugOf(batch.drug);
  const fireChance = Number(lab.fire || 0);
  const inventoryValue = Number(batch.qty) * Number(drug?.base || 0) * (1 - fireChance);
  const id = `kitchen:${batch.drug}:collect`;
  const actionId = `${id}:now`;
  const estimate = valuation({ inventory: inventoryValue, confidence: 0.65,
    basis: 'Batch quantity times published base street value, adjusted for the lab fire chance; final quality and district demand resolve at collection/deal.' });
  if (Number(batch.readySeconds) > 0) {
    const availableAt = new Date(Date.now() + Number(batch.readySeconds) * 1000).toISOString();
    const blocked = valued({
      id: actionId, planId: id, kind: 'kitchen_collect', label: `Collect ${drug?.name || batch.drug} batch`,
      method: 'POST', path: '/v1/kitchen/collect', body: {}, executable: false,
      cost: {}, reward: { inventory: { drug: batch.drug, quantity: Number(batch.qty), estimatedGross: rounded(inventoryValue) } },
      risk: { level: fireChance > 0.05 ? 'medium' : 'low', firePct: rounded(fireChance * 100) },
      blockedBy: [{ code: 'cooking', availableAt }],
    }, estimate.ev);
    return { plans: [{
      id, kind: 'kitchen', label: `Finish ${drug?.name || batch.drug} batch`, ...estimate,
      status: 'cooking', nextActionId: null, availableAt, refreshAfterStep: true,
      route: [{ kind: 'collect', path: '/v1/kitchen/collect' }, { kind: 'deal', drug: batch.drug }],
    }], actions: [], blockedActions: [blocked] };
  }
  const plan = {
    id, kind: 'kitchen', label: `Finish ${drug?.name || batch.drug} batch`, ...estimate,
    status: 'collect', nextActionId: actionId, refreshAfterStep: true,
    route: [{ kind: 'collect', path: '/v1/kitchen/collect' }, { kind: 'deal', drug: batch.drug }],
  };
  const action = valued({
    id: actionId, planId: id, kind: 'kitchen_collect', label: `Collect ${drug?.name || batch.drug} batch`,
    method: 'POST', path: '/v1/kitchen/collect', body: {}, executable: true,
    cost: {}, reward: { inventory: { drug: batch.drug, quantity: Number(batch.qty), estimatedGross: rounded(inventoryValue) } },
    risk: { level: fireChance > 0.05 ? 'medium' : 'low', firePct: rounded(fireChance * 100) },
  }, estimate.ev);
  return { plans: [plan], actions: [action], blockedActions: [] };
}

function convoyPlans(ch, sheet, owned, board) {
  const convoy = board.mine;
  if (!convoy || jailed(ch) || safeHoused(ch))
    return { plans: [], actions: [], blockedActions: [] };
  const usedCargo = Object.values(owned.cargo || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
  let room = Math.max(0, Number(sheet.cargoCap) - usedCargo);
  let inventoryValue = 0, recoverable = 0;
  for (const item of convoy.manifest || []) {
    const quantity = Math.min(Number(item.qty), room);
    room -= quantity;
    recoverable += quantity;
    inventoryValue += quantity * goodPriceOf(item.good, convoy.to);
  }
  const destinationTravel = ch.loc === convoy.to ? 0 : CONSTANTS.TRAVEL_COST;
  if (convoy.status === 'transit') {
    const id = `convoy:${convoy.id}`;
    const availableAt = new Date(Date.now() + Number(convoy.arrivesSeconds || 0) * 1000).toISOString();
    const estimate = valuation({ cash: -destinationTravel, inventory: inventoryValue, confidence: 0.7,
      basis: 'Destination value of freight that fits in the current trunk after required travel; arrival and later toll/ambush outcomes remain unresolved.' });
    const blocked = valued({
      id: `${id}:collect`, planId: id, kind: 'convoy_collect', label: 'Collect convoy after arrival',
      method: 'POST', path: `/v1/convoy/${convoy.id}/collect`, body: {}, executable: false,
      cost: {}, reward: { inventory: { units: recoverable, estimatedValue: rounded(inventoryValue) } },
      risk: { level: 'medium', ambushed: !!convoy.ambushed },
      blockedBy: [{ code: 'en_route', availableAt }],
    }, estimate.ev);
    return { plans: [{
      id, kind: 'convoy', label: `Land freight at ${convoy.to}`, ...estimate,
      status: 'in_transit', nextActionId: null, availableAt, refreshAfterStep: true,
      route: [{ kind: 'wait', until: availableAt }, { kind: 'travel', district: convoy.to },
        { kind: 'collect', path: `/v1/convoy/${convoy.id}/collect` }],
    }], actions: [], blockedActions: [blocked] };
  }
  if (convoy.status !== 'arrived') return { plans: [], actions: [], blockedActions: [] };
  if (recoverable <= 0 && Number(convoy.insuranceDue || 0) <= 0)
    return { plans: [], actions: [], blockedActions: [] };
  const id = `convoy:${convoy.id}`;
  const atDestination = destinationTravel === 0;
  const actionId = `${id}:${atDestination ? 'collect' : 'travel'}`;
  const estimate = valuation({ cash: Number(convoy.insuranceDue || 0) - destinationTravel,
    inventory: inventoryValue,
    confidence: 0.85,
    basis: 'Destination value of freight that fits in the live trunk plus quoted insurance, minus required travel; excludes any destination toll.' });
  const plan = {
    id, kind: 'convoy', label: `Land freight at ${convoy.to}`, ...estimate,
    status: atDestination ? 'collect' : 'travel_to_destination', nextActionId: actionId,
    refreshAfterStep: true,
    route: [{ kind: 'travel', district: convoy.to }, { kind: 'collect', path: `/v1/convoy/${convoy.id}/collect` }],
  };
  const action = valued({
    id: actionId, planId: id, kind: atDestination ? 'convoy_collect' : 'convoy_travel',
    label: atDestination ? 'Collect arrived convoy' : `Travel to ${convoy.to} for arrived convoy`,
    method: 'POST', path: atDestination ? `/v1/convoy/${convoy.id}/collect` : `/v1/travel/${convoy.to}`,
    body: {}, executable: true,
    cost: atDestination ? {} : { cash: destinationTravel },
    reward: { inventory: { units: recoverable, estimatedValue: rounded(inventoryValue) },
      insuranceCash: Number(convoy.insuranceDue || 0) },
    risk: { level: 'low', destinationTollExcluded: true },
  }, estimate.ev);
  return { plans: [plan], actions: [action], blockedActions: [] };
}

async function businessActions(db, ch) {
  if (safeHoused(ch)) return [];
  const fronts = (await businessesOf(db, ch.id)).filter((front) => !front.cold && Number(front.pending) > 0);
  const pending = fronts.reduce((sum, front) => sum + Number(front.pending), 0);
  if (pending <= 0) return [];
  const hot = fronts.filter((front) => front.raidRisk);
  const riskAdjustment = hot.length ? 0.5 : 1;
  return [valued({
    id: 'business:collect', kind: 'business_collect', label: 'Collect all business income',
    method: 'POST', path: '/v1/business/collect', body: {}, executable: true,
    cost: {}, reward: { cash: { pending } },
    risk: { level: hot.length ? 'high' : 'low', raidRiskFronts: hot.map((front) => front.id) },
  }, {
    cash: pending * riskAdjustment,
    confidence: hot.length ? 0.35 : 1,
    basis: hot.length
      ? 'Live pending take discounted 50% because at least one front is currently raid-eligible.'
      : 'Live server-computed pending take across operating fronts.',
  })];
}

function depotActions(ch, depot) {
  if (!depot || jailed(ch) || safeHoused(ch)) return [];
  const policy = depot.operatingPolicy;
  if (!policy?.enabled) return [];
  const delivery = policy.allowReceive && depot.orders.find((order) => order.delivered > 0);
  const replenish = depotPilotEnabled() && policy.allowRestock && depot.automatedRestockQuote;
  if (!delivery && !replenish) return [];
  if (ch.loc !== depot.district) {
    if (Number(ch.cash) < POLICY.cashReserve + CONSTANTS.TRAVEL_COST) return [];
    return [valued({ id: `depot:${depot.id}:travel`, kind: 'depot_travel', label: 'Visit your supply depot',
      method: 'POST', path: `/v1/travel/${depot.district}`, body: { policyId: policy.id }, executable: true,
      cost: { cash: CONSTANTS.TRAVEL_COST }, reward: { businessInventoryPending: delivery?.delivered || 0 },
      risk: { level: 'low' } }, { cash: -CONSTANTS.TRAVEL_COST, basis: 'Actual fare to receive paid inventory or manage a funded procurement budget.' })];
  }
  if (delivery) return [valued({ id: `depot:${depot.id}:receive:${delivery.id}`, kind: 'depot_receive',
    label: 'Receive supplier delivery into business stock', method: 'POST',
    path: `/v1/depot/${depot.id}/orders/${delivery.id}/receive`, body: { policyId: policy.id }, executable: true,
    cost: {}, reward: { businessStock: delivery.delivered }, risk: { level: 'none' } },
  { basis: 'Moves already-paid warehouse inventory into the business; no cash or new economic reward is created.' })];
  return [valued({ id: `depot:${depot.id}:restock`, kind: 'depot_restock', label: 'Post a treasury-funded procurement order',
    method: 'POST', path: `/v1/depot/${depot.id}/restock`, body: { policyId: policy.id }, executable: true,
    cost: { businessCash: replenish.total }, reward: { requestedStock: replenish.qty },
    risk: { level: 'medium', customerDemandGuaranteed: false } },
  { treasury: -replenish.total, inventory: replenish.escrow, confidence: 0.7,
    basis: 'Commits business cash to supplier escrow within owner-set terms; the listing fee is an expense and future customer demand is uncommitted.' })];
}

async function territoryActions(db, ch, owned) {
  if (!owned.gangId || safeHoused(ch)) return [];
  const operations = (await territoryOf(db, owned.gangId))
    .filter((operation) => !operation.cold && Number(operation.pending) > 0);
  const pending = operations.reduce((sum, operation) => sum + Number(operation.pending), 0);
  if (pending <= 0) return [];
  const hot = operations.filter((operation) => operation.raidRisk);
  const riskAdjustment = hot.length ? 0.5 : 1;
  return [valued({
    id: 'territory:collect', kind: 'territory_collect', label: 'Collect family territory income',
    method: 'POST', path: '/v1/territory/collect', body: {}, executable: true,
    cost: {}, reward: { treasury: { pending } },
    risk: { level: hot.length ? 'high' : 'low', raidRiskDistricts: hot.map((operation) => operation.district) },
  }, {
    treasury: pending * riskAdjustment,
    confidence: hot.length ? 0.35 : 1,
    basis: hot.length
      ? 'Live family-treasury take discounted 50% because at least one operation is raid-eligible.'
      : 'Live server-computed pending take into the family treasury.',
  })];
}

function loanPlans(ch, board) {
  const debts = (board.active || []).filter((loan) =>
    loan.role === 'borrower' && Number(loan.dueSeconds) <= 6 * 3600);
  if (board.house?.yourMarker && Number(board.house.yourMarker.dueSeconds) <= 6 * 3600)
    debts.push({ ...board.house.yourMarker, house: true, counterparty: 'the house' });
  const plans = [], actions = [], blockedActions = [];
  for (const debt of debts) {
    const owed = Number(debt.owed);
    const id = debt.house ? 'loan:house' : `loan:${debt.id}`;
    const path = debt.house ? '/v1/loans/house/repay' : `/v1/loans/${debt.id}/repay`;
    const actionId = `${id}:repay`;
    const estimate = valuation({ cash: -owed, liability: owed, confidence: 1,
      basis: 'Exact quoted repayment removes the full debt; liability protection receives the published 1.25x default-avoidance weight.' });
    const affordable = Number(ch.cash) >= owed;
    plans.push({
      id, kind: 'loan', label: `Square debt to ${debt.counterparty || 'lender'}`, ...estimate,
      status: affordable ? 'repay_due' : 'cash_blocked', nextActionId: affordable ? actionId : null,
      dueSeconds: Number(debt.dueSeconds), refreshAfterStep: true,
      route: [{ kind: 'repay', path }],
    });
    const action = valued({
      id: actionId, planId: id, kind: 'loan_repay', label: `Repay $${owed} debt`,
      method: 'POST', path, body: {}, executable: affordable,
      cost: { cash: owed }, reward: { liabilityRemoved: owed }, risk: { level: 'none' },
      ...(!affordable ? { blockedBy: [{ code: 'cash', current: Number(ch.cash), required: owed }] } : {}),
    }, estimate.ev);
    (affordable ? actions : blockedActions).push(action);
  }
  return { plans, actions, blockedActions };
}

function organizationPlans(board) {
  const crew = board.crew;
  if (!crew?.leader || crew.recruiting || crew.members.length >= Number(board.maxMembers))
    return { plans: [], actions: [], blockedActions: [] };
  const id = `organization:crew:${crew.id}:recruiting`;
  const actionId = `${id}:open`;
  const estimate = valuation({ confidence: 1,
    basis: 'Standing organization order with no monetary expected value assigned.' });
  return {
    plans: [{
      id, kind: 'organization', label: `Open ${crew.name} for recruiting`, ...estimate,
      status: 'open_recruiting', nextActionId: actionId, refreshAfterStep: true,
      route: [{ kind: 'recruiting', on: true, path: '/v1/crew/recruiting' }],
    }],
    actions: [valued({
      id: actionId, planId: id, kind: 'crew_recruiting', label: `List ${crew.name} as recruiting`,
      method: 'POST', path: '/v1/crew/recruiting', body: { on: true }, executable: true,
      cost: {}, reward: { organization: 'crew_discovery_visibility' }, risk: { level: 'none' },
    }, estimate.ev)],
    blockedActions: [],
  };
}

function onboardingRewardActions(onboard) {
  // Social readiness is proof-deferred to the mounted claim route. A turn must never call an
  // external verifier (or advertise an unverified faucet) as if it were an executable payout.
  const ready = onboard.tasks.filter((task) => !task.social && task.ready && !task.claimed);
  const finalClaim = onboard.tasks.filter((task) => !task.claimed).length === 1;
  return ready.map((task) => {
    const capstone = finalClaim ? onboard.capstone : {};
    const cash = Number(task.reward.cash || 0) + Number(capstone.cash || 0);
    const cb = Number(task.reward.cb || 0) + Number(capstone.cb || 0);
    const energy = Number(task.reward.en || 0) + Number(capstone.en || 0);
    return valued({
      id: `reward:onboard:${task.id}`, kind: 'onboard_claim',
      label: `Claim First Week: ${task.name}`,
      method: 'POST', path: `/v1/onboard/${task.id}/claim`, body: {}, executable: true,
      cost: {}, reward: { cash: { gross: cash, net: cash }, cb, energy }, risk: { level: 'none' },
    }, { cash, confidence: 1,
      basis: 'Server First Week readiness and exact mounted claim payout; the capstone is included only for the final offered task.' });
  });
}

function dailyRewardActions(daily, level) {
  const ready = daily.jobs.filter((job) => !job.claimed && !job.blocked && job.progress >= job.goal);
  const finalClaim = daily.jobs.filter((job) => !job.claimed).length === 1;
  return ready.map((job) => {
    const cash = 200 * level + (finalClaim ? 500 * level : 0);
    const respect = 5 * level + (finalClaim ? 15 * level : 0);
    return valued({
      id: `reward:daily:${job.id}`, kind: 'daily_claim',
      label: `Claim daily contract: ${job.name}`,
      method: 'POST', path: `/v1/daily/${job.id}/claim`, body: {}, executable: true,
      cost: {}, reward: { cash: { gross: cash, net: cash }, respect,
        ...(finalClaim ? { energyRefill: true } : {}) }, risk: { level: 'none' },
    }, { cash, respect, confidence: 1,
      basis: 'Server Daily Contracts readiness and exact claim formula; conditional event-fund OMR is excluded from guaranteed EV.' });
  });
}

function careerRewardActions(career) {
  return career.tiers.flatMap((tier) => tier.open
    ? tier.tasks.filter((task) => task.ready && !task.claimed).map((task) => {
      const capstone = tier.done + 1 >= tier.of ? Number(tier.capstone || 0) : 0;
      const cash = Number(task.cash || 0) + capstone;
      return valued({
        id: `reward:career:${task.id}`, kind: 'career_claim',
        label: `Claim career reward: ${task.name}`,
        method: 'POST', path: `/v1/career/${task.id}`, body: {}, executable: true,
        cost: {}, reward: { cash: { gross: cash, net: cash },
          ...(capstone ? { capstone } : {}) }, risk: { level: 'none' },
      }, { cash, confidence: 1,
        basis: 'Server Career board readiness and exact mounted payout; the capstone is included only when this claim completes the tier.' });
    }) : []);
}

async function rewardActions(db, ch, acct, owned) {
  const h = { accountId: ch.account_id, acct, owned };
  const onboard = await onboardBoard(ch, h, db);
  const daily = await getDaily(db, ch.id);
  const career = await careerBoard(ch, db, h);
  return [
    ...onboardingRewardActions(onboard),
    ...dailyRewardActions(daily, levelOf(Number(ch.respect))),
    ...careerRewardActions(career),
  ];
}

export async function agentTurn(db, ch, acct, owned, { onlineAccounts = [] } = {}) {
  const sheet = view(ch, acct, owned);
  // GET Agent Turn may receive a pool, but locked action authorization receives one transaction
  // client. Keep the shared implementation valid for the stricter context: one loader at a time on
  // the same authoritative snapshot, with no out-of-band pool connections.
  const opportunities = await opportunityBoard(db, ch);
  const convoyBoardState = await convoyBoard(db, ch.id);
  const loanBoardState = await loanBoard(db, ch);
  const crewBoardState = await crewBoard(ch, db);
  const rewards = await rewardActions(db, ch, acct, owned);
  const exploration = await exploreBoard(db, ch, acct, owned, { onlineAccounts });
  const crime = crimePlan(ch, owned);
  const passive = [...await businessActions(db, ch), ...await territoryActions(db, ch, owned)];
  const depot = await depotState(db, ch, { acct, owned });
  const commitments = await deliveryBoard(db, ch);
  const arbitrage = arbitragePlans(ch, sheet, owned, opportunities.niches.arbitrage);
  const restock = restockCandidates(ch, sheet, owned, opportunities.opportunities, POLICY, opportunities.goodsLiquidity);
  const activeDeliveries = commitments.filter((c) => c.supplierId === ch.id && c.status === 'accepted');
  if (deliveryIntakeEnabled()) for (const candidate of restock) {
    const order = opportunities.opportunities.find((o) => o.listingId === candidate.plan.listingId);
    if (!order?.depotId || activeDeliveries.length >= DELIVERY.maxActive
        || activeDeliveries.reduce((n, c) => n + c.remaining, 0) + candidate.plan.quantity > DELIVERY.maxUnits
        || new Date(order.expiresAt).getTime() - Date.now() < 3700000) continue;
    const budget = candidate.plan.acquisitionCash + candidate.plan.travelCash;
    if (budget < 1 || budget > DELIVERY.maxSpend) continue;
    candidate.action = { ...candidate.action, kind: 'delivery_accept', label: 'Accept a funded supplier delivery',
      path: `/v1/market/${order.listingId}/accept-delivery`,
      body: { orderId: order.listingId, qty: candidate.plan.quantity, unitPrice: order.unitPrice,
        maxProcurementCash: budget, deadlineSeconds: 3600 }, cost: {},
      risk: { level: 'medium', orderReservedAfterAcceptance: true, deathMayTerminate: true } };
    candidate.plan.status = 'accept_delivery';
    candidate.plan.route.unshift({ kind: 'accept', path: candidate.action.path, quantity: candidate.plan.quantity });
  }
  const deliveryActions = [];
  const deliveryPlans = [];
  for (const contract of activeDeliveries) {
    if (jailed(ch) || safeHoused(ch)) continue;
    const held = Math.min(contract.remaining, Number(owned.cargo?.[contract.good] || 0));
    if (held && ch.loc === contract.district) {
      const gross = held * contract.unitPrice, done = contract.quantity - contract.remaining;
      const net = gross - (Math.ceil((done + held) * contract.unitPrice * contract.takeBps / 10000)
        - Math.ceil(done * contract.unitPrice * contract.takeBps / 10000));
      const action = valued({ id: `delivery:${contract.id}:deliver`, planId: `delivery:${contract.id}`, kind: 'delivery_deliver',
        label: 'Deliver reserved goods', method: 'POST', path: `/v1/deliveries/${contract.id}/deliver`,
        body: { commitmentId: contract.id, qty: held }, executable: true,
        cost: { goods: { [contract.good]: held } }, reward: { cash: { gross, net } }, risk: { level: 'low' } },
      { cash: net, inventory: -held * goodPriceOf(contract.good, ch.loc), basis: 'Fixed committed payout after market take, less delivered inventory value.' });
      deliveryActions.push(action);
      deliveryPlans.push({ id: action.planId, kind: 'delivery', commitmentId: contract.id, deadline: contract.deadline,
        label: 'Settle committed delivery', quantity: held, status: 'deliver', nextActionId: action.id,
        refreshAfterStep: true, score: action.score, ev: action.ev,
        route: [{ kind: 'deliver', path: action.path, quantity: held }] });
      continue;
    }
    const available = contract.maxProcurementCash - contract.spent;
    const choices = restockCandidates({ ...ch, cash: Math.min(Number(ch.cash), available + POLICY.cashReserve) }, sheet, owned,
      [{ type: 'order', listingId: contract.orderId, posterId: contract.buyerId, good: contract.good,
        wanted: contract.remaining, unitPrice: contract.unitPrice, district: contract.district, expiresAt: contract.deadline }], POLICY, opportunities.goodsLiquidity);
    if (!choices.length) continue;
    const choice = choices[0];
    const action = valued({ ...choice.action, id: `delivery:${contract.id}:${choice.plan.status}`, planId: `delivery:${contract.id}`,
      kind: choice.action.kind === 'restock_buy' ? 'delivery_buy' : 'delivery_travel',
      body: { ...choice.action.body, commitmentId: contract.id,
        ...(choice.action.kind === 'restock_travel' ? { district: choice.action.path.split('/').at(-1) } : {}) },
      risk: { level: 'medium', orderReserved: true, deathMayTerminate: true } }, choice.estimate);
    deliveryActions.push(action);
    deliveryPlans.push({ ...choice.plan, id: action.planId, kind: 'delivery', commitmentId: contract.id,
      deadline: contract.deadline, nextActionId: action.id, ...valuation(choice.estimate),
      route: choice.plan.route.map((step) => step.kind === 'fill'
        ? { kind: 'deliver', path: `/v1/deliveries/${contract.id}/deliver`, quantity: step.quantity } : step) });
  }
  const kitchen = kitchenPlans(sheet);
  const convoy = convoyPlans(ch, sheet, owned, convoyBoardState);
  const loans = loanPlans(ch, loanBoardState);
  const organization = organizationPlans(crewBoardState);
  const actions = rankActions([...rewards, ...passive, ...marketActions(ch, owned, opportunities.opportunities),
    ...arbitrage.actions, ...restock.map((c) => valued(c.action, c.estimate)), ...deliveryActions, ...depotActions(ch, depot), ...kitchen.actions, ...convoy.actions, ...loans.actions,
    ...organization.actions, crime]
    .filter((action) => action?.executable));
  const blockedActions = [...kitchen.blockedActions, ...convoy.blockedActions, ...loans.blockedActions,
    ...organization.blockedActions, crime]
    .filter((action) => action && !action.executable);
  const futureClocks = [ch.jail_until, ch.hosp_until, ch.shoot_cd_until, ch.train_at, ch.mission_at]
    .filter((v) => v && new Date(v).getTime() > Date.now())
    .map((v) => new Date(v).getTime());
  const blockedClocks = blockedActions.flatMap((action) => action.blockedBy || [])
    .map((blocker) => blocker.availableAt && new Date(blocker.availableAt).getTime())
    .filter((value) => Number.isFinite(value) && value > Date.now());
  const turn = {
    observedAt: new Date().toISOString(),
    state: {
      identity: { id: ch.id, name: ch.name, level: sheet.level, generation: Number(ch.generation), district: ch.loc },
      resources: { cash: sheet.cash, bank: sheet.bank, energy: sheet.energy, nerve: sheet.nerve,
        health: sheet.health, heat: sheet.heat, omr: sheet.omr },
      status: { jailedUntil: ch.jail_until || null, hospitalizedUntil: ch.hosp_until || null,
        wantedUntil: ch.wanted_until || null, indictedAt: ch.indicted_at || null },
    },
    extraction: extractionState(acct),
    depot,
    deliveries: commitments,
    coach: sheet.coach,
    coachPlan: sheet.coachPlan,
    policy: POLICY,
    ranking: RANKING,
    recommendedActionId: (depot?.operatingPolicy?.enabled && depot.operatingPolicy.businessPriority
      ? actions.find((a) => ['depot_restock', 'depot_receive', 'depot_travel'].includes(a.kind))?.id : null) || actions[0]?.id || null,
    recommendationSource: depot?.operatingPolicy?.enabled && depot.operatingPolicy.businessPriority
      && actions.some((a) => ['depot_restock', 'depot_receive', 'depot_travel'].includes(a.kind)) ? 'owner_policy' : 'cash_equivalent',
    actions,
    blockedActions,
    plans: rankPlans([...arbitrage.plans, ...restock.map((c) => ({ ...c.plan, ...valuation(c.estimate) })), ...deliveryPlans, ...kitchen.plans, ...convoy.plans, ...loans.plans,
      ...organization.plans]),
    nextWakeAt: actions.length || !(futureClocks.length || blockedClocks.length)
      ? null : new Date(Math.min(...futureClocks, ...blockedClocks)).toISOString(),
    opportunities,
    exploration,
  };
  // A turn is authority, not just advice. Fingerprint only the state and descriptors that govern
  // execution: wall-clock presentation fields (observedAt, dueSeconds, wake estimates) must not make
  // an otherwise-current turn expire between GET and POST, while any resource, status, extraction,
  // location, action-set, action-body, or action-cost change must invalidate it. The POST endpoint
  // recomputes this under the character lock before executing, so two callers cannot spend one turn.
  const authority = {
    state: turn.state,
    extraction: turn.extraction,
    actions: turn.actions.map(({ id, kind, method, path, body, cost }) =>
      ({ id, kind, method, path, body, cost })),
  };
  turn.turnId = `turn_${crypto.createHash('sha256').update(JSON.stringify(authority)).digest('hex')}`;
  return turn;
}
