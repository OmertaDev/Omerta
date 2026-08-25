// THE AGENT TURN — one compact, personalized observation for an autonomous player. Agent reads share
// the hard cadence, so forcing me → opportunities → notifications before every move burns the budget
// on observation. This response joins the existing coach and economic board, then adds executable
// action descriptors whose method/path/body can be handed straight back to the API.
import crypto from 'node:crypto';
import { BLACK_MARKET, CONSTANTS, CRIMES, M3, PACING, drugOf, goodPriceOf, kitchenOf, levelOf, jailed, safeHoused } from './rules.js';
import { view } from './game.js';
import { opportunityBoard } from './opportunities.js';
import { chainConfig } from './chain.js';
import { businessesOf } from './business.js';
import { territoryOf } from './territory.js';
import { convoyBoard } from './convoy.js';
import { loanBoard } from './loans.js';
import { crewBoard } from './crew.js';

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
      }, { cash: net, confidence: 1, basis: 'Deterministic order proceeds after the published market take.' });
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
    const held = Number(owned.cargo?.[edge.good] || 0);
    const id = `arbitrage:${edge.good}:${edge.buyIn}:${edge.sellIn}`;
    if (held > 0) {
      const atSeller = ch.loc === edge.sellIn;
      const travel = atSeller ? 0 : CONSTANTS.TRAVEL_COST;
      const proceeds = sellNet(edge.sellPrice, held);
      const estimate = valuation({ cash: proceeds - travel, confidence: 0.75,
        basis: 'Expected liquidation proceeds from held cargo after the 2% sell take and required travel; acquisition cost is already sunk and unavailable.' });
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
    let quantity = Math.min(capacity, Math.floor(spendable / Math.max(1, edge.buyPrice * 1.02)));
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

export async function agentTurn(db, ch, acct, owned) {
  const sheet = view(ch, acct, owned);
  const [opportunities, convoyBoardState, loanBoardState, crewBoardState] = await Promise.all([
    opportunityBoard(db, ch), convoyBoard(db, ch.id), loanBoard(db, ch), crewBoard(ch, db),
  ]);
  const crime = crimePlan(ch, owned);
  const passive = [...await businessActions(db, ch), ...await territoryActions(db, ch, owned)];
  const arbitrage = arbitragePlans(ch, sheet, owned, opportunities.niches.arbitrage);
  const kitchen = kitchenPlans(sheet);
  const convoy = convoyPlans(ch, sheet, owned, convoyBoardState);
  const loans = loanPlans(ch, loanBoardState);
  const organization = organizationPlans(crewBoardState);
  const actions = rankActions([...passive, ...marketActions(ch, owned, opportunities.opportunities),
    ...arbitrage.actions, ...kitchen.actions, ...convoy.actions, ...loans.actions,
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
    coach: sheet.coach,
    coachPlan: sheet.coachPlan,
    policy: POLICY,
    ranking: RANKING,
    recommendedActionId: actions[0]?.id || null,
    actions,
    blockedActions,
    plans: rankPlans([...arbitrage.plans, ...kitchen.plans, ...convoy.plans, ...loans.plans,
      ...organization.plans]),
    nextWakeAt: actions.length || !(futureClocks.length || blockedClocks.length)
      ? null : new Date(Math.min(...futureClocks, ...blockedClocks)).toISOString(),
    opportunities,
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
