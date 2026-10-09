import { BLACK_MARKET, CONSTANTS, DISTRICTS, GOODS, goodPriceOf, jailed } from './rules.js';
import { goodsBuyQuote } from './goodsquote.js';

// Plans spend the supplier's cash against an existing customer's escrow. They reserve
// neither demand nor prices: every next step is recomputed by Agent Turn before execution.
export function restockCandidates(ch, sheet, owned, orders, policy, liquidity = null) {
  if (jailed(ch)) return [];
  const cargo = owned.cargo || {};
  const free = Math.max(0, Number(sheet.cargoCap) - Object.values(cargo).reduce((n, q) => n + Number(q), 0));
  const candidates = [];
  for (const order of orders) {
    if (order.type !== 'order' || order.posterId === ch.id || !(order.wanted > 0)
        || !GOODS.some((g) => g.id === order.good) || !DISTRICTS.some((d) => d.id === order.district)
        || !(Number(order.unitPrice) > 0) || !(new Date(order.expiresAt).getTime() > Date.now() + 60000)) continue;
    const held = Math.min(Number(cargo[order.good] || 0), Number(order.wanted));
    const id = `restock:${order.listingId}`;
    const proceeds = (qty) => qty * Number(order.unitPrice)
      - Math.ceil(qty * Number(order.unitPrice) * BLACK_MARKET.TAKE_BPS / 10000);
    let quantity, source, acquisition = 0, travel, status, estimate;
    if (held > 0) {
      // The existing local fill descriptor already handles stock at the customer's dock.
      if (ch.loc === order.district || Number(ch.cash) < policy.cashReserve + CONSTANTS.TRAVEL_COST) continue;
      quantity = held;
      source = ch.loc;
      travel = CONSTANTS.TRAVEL_COST;
      status = 'travel_to_deliver';
      estimate = { cash: proceeds(quantity) - travel,
        inventory: -quantity * goodPriceOf(order.good, ch.loc), confidence: 0.7,
        basis: 'Order proceeds after market take and travel, less current district value of held cargo; customer demand may disappear before delivery.' };
      if (estimate.cash + estimate.inventory < policy.minArbitrageProfit) continue;
    } else {
      let best = null;
      for (const district of DISTRICTS) {
        const fares = (ch.loc === district.id ? 0 : CONSTANTS.TRAVEL_COST)
          + (district.id === order.district ? 0 : CONSTANTS.TRAVEL_COST);
        const spendable = Number(ch.cash) - policy.cashReserve - fares;
        const unit = goodsBuyQuote(order.good, district.id, 1, owned).unit;
        const stock = liquidity?.districts[district.id]?.[order.good]?.stock ?? Infinity;
        let qty = Math.min(free, stock, Number(order.wanted), Math.floor(spendable / (unit * 1.02)));
        while (qty > 0 && goodsBuyQuote(order.good, district.id, qty, owned).total > spendable) qty--;
        if (qty <= 0) continue;
        const cost = goodsBuyQuote(order.good, district.id, qty, owned).total;
        const profit = proceeds(qty) - cost - fares;
        if (profit < policy.minArbitrageProfit) continue;
        if (!best || profit > best.profit) best = { quantity: qty, source: district.id, acquisition: cost, travel: fares, profit };
      }
      if (!best) continue;
      ({ quantity, source, acquisition, travel } = best);
      status = ch.loc === source ? 'buy' : 'travel_to_buy';
      estimate = { cash: best.profit, confidence: 0.7,
        basis: 'Customer-funded order margin after exact quoted acquisition takes, market take and all required travel; prices and demand may change before delivery.' };
    }
    const buying = status === 'buy';
    const destination = status === 'travel_to_deliver' ? order.district : source;
    const nextActionId = `${id}:${status}`;
    const route = held > 0 ? [] : [
      ...(ch.loc === source ? [] : [{ kind: 'travel', district: source }]),
      { kind: 'buy', good: order.good, quantity },
    ];
    if ((held > 0 ? ch.loc : source) !== order.district) route.push({ kind: 'travel', district: order.district });
    route.push({ kind: 'fill', path: `/v1/market/${order.listingId}/fill`, quantity });
    candidates.push({
      estimate,
      plan: { id, kind: 'restock', label: `Deliver ${order.good} to a customer at ${order.district}`,
        listingId: order.listingId, expiresAt: order.expiresAt, quantity, source, destination: order.district,
        acquisitionCash: acquisition, travelCash: travel, netOrderCash: proceeds(quantity),
        status, nextActionId, refreshAfterStep: true, route },
      action: { id: nextActionId, planId: id, kind: buying ? 'restock_buy' : 'restock_travel',
        label: buying ? `Source ${quantity} ${order.good} for a customer` : `Travel to ${destination} for a customer order`,
        method: 'POST', path: buying ? '/v1/goods/buy' : `/v1/travel/${destination}`,
        body: buying ? { goodId: order.good, qty: quantity } : {}, executable: true,
        cost: { cash: buying ? acquisition : CONSTANTS.TRAVEL_COST },
        reward: { planCash: estimate.cash },
        risk: { level: 'medium', orderReserved: false, pricesMayChange: true, demandMayDisappear: true } },
    });
  }
  return candidates;
}
