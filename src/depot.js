import crypto from 'node:crypto';
import { BLACK_MARKET, jailed, safeHoused } from './rules.js';
import { GameError, trunkCap } from './game.js';
import { postOrder, orderCashQuote, maxListings } from './market.js';
import { bookDepot, refundDepotOrder } from './depotbook.js';
import { reservedQuantity } from './deliverybook.js';
import { latestPolicy, policyLive, policyTermsMatch, policyView, requirePolicy } from './operatingpolicy.js';

export const DEPOT = Object.freeze({ good: 'gin', capacity: 40, openingCost: 5000, cashReserve: 1000 });
export const depotPilotEnabled = () => process.env.DEPOT_PILOT === 'on';
const intake = () => { if (!depotPilotEnabled()) throw new GameError('pilot_disabled', 'The supply-depot pilot is not open.'); };
const mobile = (ch) => {
  if (jailed(ch)) throw new GameError('jailed', 'No depot business from lockup.');
  if (safeHoused(ch)) throw new GameError('safe', 'Come out before moving business funds or stock.');
};
function integer(value, min, max, field) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new GameError('depot_terms', `${field} must be a whole number between ${min} and ${max}.`);
  return value;
}
function terms(body) {
  const sale_price = integer(body?.salePrice, 50, 1000000, 'salePrice');
  const bid_price = integer(body?.bidPrice, 50, 1000000, 'bidPrice');
  const target_stock = integer(body?.targetStock, 1, DEPOT.capacity, 'targetStock');
  const reorder_at = integer(body?.reorderAt, 0, target_stock - 1, 'reorderAt');
  const restock_budget = integer(body?.restockBudget, 50, 100000000, 'restockBudget');
  if (sale_price - Math.ceil(sale_price * BLACK_MARKET.TAKE_BPS / 10000) <= bid_price)
    throw new GameError('depot_terms', 'The sale price must leave a margin after the market take and procurement bid.');
  return { sale_price, bid_price, target_stock, reorder_at, restock_budget };
}
async function own(ch, id, client) {
  const row = (await client.query("SELECT * FROM business_depots WHERE id=$1 AND owner_character=$2 AND status='open' FOR UPDATE", [id, ch.id])).rows[0];
  if (!row) throw new GameError('not_yours', 'No open depot of yours by that number.');
  return row;
}
const atDock = (ch, row) => { if (ch.loc !== row.district) throw new GameError('district', `This depot operates at ${row.district}.`, { district: row.district }); };
const pending = async (client, id) => (await client.query(
  "SELECT * FROM market_listings WHERE depot_id=$1 AND (status='live' OR filled_qty>0)", [id])).rows;

export async function openDepot(ch, body, client, h) {
  intake(); mobile(ch);
  if (ch.is_npc) throw new GameError('depot_owner', 'The pilot is for durable player and agent businesses.');
  const config = terms(body);
  if ((await client.query("SELECT id FROM business_depots WHERE owner_character=$1 AND status='open'", [ch.id])).rows.length)
    throw new GameError('exists', 'You already operate a supply depot.');
  if (Number(ch.cash) < DEPOT.openingCost) throw new GameError('cash', 'Opening a depot costs $5,000.');
  const id = crypto.randomUUID();
  await client.query('INSERT INTO business_depots (id,owner_character,district,sale_price,bid_price,target_stock,reorder_at,restock_budget) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, ch.id, ch.loc, config.sale_price, config.bid_price, config.target_stock, config.reorder_at, config.restock_budget]);
  ch.cash = Number(ch.cash) - DEPOT.openingCost;
  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -DEPOT.openingCost, reason: 'depot:open', counterparty: id });
  const row = await own(ch, id, client);
  await bookDepot(client, row, 'open', { expense: DEPOT.openingCost });
  return { ok: true, id, district: ch.loc, good: DEPOT.good, openingCost: DEPOT.openingCost };
}

export async function configureDepot(ch, id, body, client) {
  intake(); mobile(ch);
  const config = terms(body), row = await own(ch, id, client);
  await client.query('UPDATE business_depots SET sale_price=$2,bid_price=$3,target_stock=$4,reorder_at=$5,restock_budget=$6 WHERE id=$1',
    [row.id, config.sale_price, config.bid_price, config.target_stock, config.reorder_at, config.restock_budget]);
  return { ok: true, id };
}

export async function fundDepot(ch, id, amount, client, h) {
  intake(); mobile(ch); amount = integer(amount, 1, 100000000, 'amount');
  const row = await own(ch, id, client);
  if (Number(ch.cash) < amount) throw new GameError('cash', 'Not enough personal cash to fund this business.');
  await bookDepot(client, row, 'fund', { cash: amount });
  ch.cash = Number(ch.cash) - amount;
  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -amount, reason: 'depot:fund', counterparty: id });
  return { ok: true, treasury: Number(row.treasury) };
}

export async function withdrawDepot(ch, id, amount, client, h) {
  mobile(ch); amount = integer(amount, 1, 100000000, 'amount');
  const row = await own(ch, id, client);
  if (Number(row.treasury) < amount) throw new GameError('treasury', 'Withdraw only uncommitted business cash.');
  await releaseCash(ch, row, amount, client, h);
  return { ok: true, depotAction: 'cash_withdraw', treasury: Number(row.treasury), withdrawn: amount };
}

async function releaseCash(ch, row, amount, client, h) {
  if (!Number.isSafeInteger(Number(ch.cash) + amount)) throw new GameError('cash_capacity', 'Move personal cash before withdrawing this balance.');
  await bookDepot(client, row, 'withdraw', { cash: -amount });
  ch.cash = Number(ch.cash) + amount;
  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount, reason: 'depot:withdraw', counterparty: row.id });
}

export function procurementQuote(row, h, policy = null) {
  if (Number(row.stock) > Number(row.reorder_at)) return null;
  const spendable = Math.min(Number(row.restock_budget), Number(row.treasury) - Math.max(DEPOT.cashReserve, Number(policy?.reserve_cash || 0)),
    policy ? Number(policy.max_spend) - Number(policy.spent) : Infinity);
  let qty = Math.min(Number(row.target_stock) - Number(row.stock), BLACK_MARKET.ORDER_MAX_QTY,
    Math.floor(spendable / Number(row.bid_price)));
  while (qty > 0 && orderCashQuote(qty, Number(row.bid_price), h).total > spendable) qty--;
  return qty > 0 ? { qty, ...orderCashQuote(qty, Number(row.bid_price), h) } : null;
}

export async function restockDepot(ch, id, client, h, { automated = false, policyId = null } = {}) {
  intake(); mobile(ch);
  const row = await own(ch, id, client); atDock(ch, row);
  const policy = automated ? await requirePolicy(client, row, policyId, 'restock') : null;
  if ((await pending(client, id)).length) throw new GameError('pending_order', 'Receive or cancel the previous procurement first.');
  const quote = procurementQuote(row, h, policy);
  if (!quote) throw new GameError('restock_budget', 'Stock is above the reorder threshold or the funded budget cannot preserve the cash reserve.');
  // Only this internal adapter can use a business balance. Public /market/order never
  // accepts a depot identifier, and these market rows never debit personal cash.
  const payer = { ...ch, cash: Number(row.treasury) };
  const helper = { ...h, ledger: (c, entry) => h.ledger(c, { ...entry, characterId: null, counterparty: id }) };
  const result = await postOrder(payer, { goodId: DEPOT.good, qty: quote.qty, price: Number(row.bid_price), hours: 24 }, client, helper);
  await client.query('UPDATE market_listings SET depot_id=$2 WHERE id=$1', [result.id, id]);
  await bookDepot(client, row, 'restock_escrow', { cash: -result.escrow, orderId: result.id, policyId: policy?.id || null });
  await bookDepot(client, row, 'restock_fee', { cash: -result.fee, expense: result.fee, orderId: result.id, policyId: policy?.id || null });
  if (policy) await client.query('UPDATE business_operating_policies SET spent=$2 WHERE id=$1', [policy.id, Number(policy.spent) + result.escrow + result.fee]);
  return { ...result, depotId: id, treasury: Number(row.treasury) };
}

export async function receiveDepot(ch, id, orderId, client, { automated = false, policyId = null } = {}) {
  mobile(ch); const row = await own(ch, id, client); atDock(ch, row);
  if (automated) await requirePolicy(client, row, policyId, 'receive');
  const order = (await client.query("SELECT * FROM market_listings WHERE id=$1 AND depot_id=$2 AND kind='order' FOR UPDATE", [orderId, id])).rows[0];
  if (!order || order.seller_character !== ch.id) throw new GameError('no_order', 'No procurement order of this business.');
  const qty = Number(order.filled_qty);
  if (!qty) throw new GameError('empty', 'No supplier delivery is waiting.');
  if (Number(row.stock) + qty > DEPOT.capacity) throw new GameError('cargo', 'The depot cannot hold this delivery.');
  await bookDepot(client, row, 'receive', { stock: qty, cost: qty * Number(order.price), orderId });
  await client.query('UPDATE market_listings SET filled_qty=0 WHERE id=$1', [orderId]);
  if (order.status === 'live' && Number(order.qty) === 0)
    await client.query("UPDATE market_listings SET status='sold' WHERE id=$1", [orderId]);
  return { ok: true, received: qty, stock: Number(row.stock) };
}

export async function cancelDepotOrder(ch, id, orderId, client, h) {
  mobile(ch); await own(ch, id, client);
  const order = (await client.query("SELECT * FROM market_listings WHERE id=$1 AND depot_id=$2 AND kind='order' AND status IN ('live','expired') FOR UPDATE", [orderId, id])).rows[0];
  if (!order || order.seller_character !== ch.id) throw new GameError('no_order', 'No cancellable order of this business.');
  if (await reservedQuantity(client, order.id)) throw new GameError('committed_order', 'Accepted supplier quantities cannot be cancelled before their deadlines.');
  const refund = order.status === 'live' ? Number(order.qty) * Number(order.price) : 0;
  if (refund) {
    await refundDepotOrder(client, order, refund);
    await h.ledger(client, { currency: 'cash', amount: refund, reason: 'market:refund', counterparty: id });
  }
  await client.query("UPDATE market_listings SET qty=0,status='cancelled' WHERE id=$1", [orderId]);
  return { ok: true, depotAction: 'cancel_order', refunded: refund, awaiting: Number(order.filled_qty) };
}

export async function buyFromDepot(ch, owner, id, quantity, maxUnitPrice, client, h) {
  intake(); mobile(ch); quantity = integer(quantity, 1, DEPOT.capacity, 'qty');
  maxUnitPrice = integer(maxUnitPrice, 50, 1000000, 'maxUnitPrice');
  const row = (await client.query("SELECT * FROM business_depots WHERE id=$1 AND status='open' FOR UPDATE", [id])).rows[0];
  if (!row || row.owner_character !== owner.id || !owner.alive) throw new GameError('no_depot', 'That business is not operating.');
  if (row.owner_character === ch.id) throw new GameError('own', 'Withdraw your inventory through its owner route.');
  atDock(ch, row);
  if (Number(row.sale_price) > maxUnitPrice) throw new GameError('price_changed', 'The current unit price exceeds your purchase limit. Refresh the business quote.');
  if (quantity > Number(row.stock)) throw new GameError('stock', 'The depot does not have that many units.');
  const cargo = h.owned.cargo;
  if (Object.values(cargo).reduce((n, q) => n + Number(q), 0) + quantity > trunkCap(h)) throw new GameError('cargo', 'No room in the trunk.');
  const gross = quantity * Number(row.sale_price), take = Math.ceil(gross * BLACK_MARKET.TAKE_BPS / 10000), net = gross - take;
  if (Number(ch.cash) < gross) throw new GameError('cash', 'Not enough cash for this order.');
  const cost = Math.ceil(Number(row.stock_cost) * quantity / Number(row.stock));
  await bookDepot(client, row, 'sale', { cash: net, stock: -quantity, cost: -cost, customerId: ch.id });
  ch.cash = Number(ch.cash) - gross;
  cargo[DEPOT.good] = Number(cargo[DEPOT.good] || 0) + quantity;
  await client.query('DELETE FROM character_cargo WHERE character_id=$1 AND good_id=$2', [ch.id, DEPOT.good]);
  await client.query('INSERT INTO character_cargo (character_id,good_id,qty) VALUES ($1,$2,$3)', [ch.id, DEPOT.good, cargo[DEPOT.good]]);
  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -gross, reason: 'depot:buy', counterparty: id });
  await h.ledger(client, { currency: 'cash', amount: -take, reason: 'depot:take', counterparty: id });
  if (take) await client.query('UPDATE street_tax SET pool=pool+$1 WHERE id=1', [Math.floor(take / 2)]);
  await h.track(client, ch.account_id, 'depot_purchase', { good: DEPOT.good, qty: quantity });
  return { ok: true, good: DEPOT.good, qty: quantity, paid: gross, businessRevenue: net, take };
}

export async function withdrawDepotStock(ch, id, quantity, client, h) {
  mobile(ch); quantity = integer(quantity, 1, DEPOT.capacity, 'qty');
  const row = await own(ch, id, client); atDock(ch, row);
  if (quantity > Number(row.stock)) throw new GameError('stock', 'Not enough business stock.');
  const cargo = h.owned.cargo;
  if (Object.values(cargo).reduce((n, q) => n + Number(q), 0) + quantity > trunkCap(h)) throw new GameError('cargo', 'No room in the trunk.');
  await bookDepot(client, row, 'inventory_withdrawal', { stock: -quantity, cost: -Math.ceil(Number(row.stock_cost) * quantity / Number(row.stock)) });
  cargo[DEPOT.good] = Number(cargo[DEPOT.good] || 0) + quantity;
  await client.query('DELETE FROM character_cargo WHERE character_id=$1 AND good_id=$2', [ch.id, DEPOT.good]);
  await client.query('INSERT INTO character_cargo (character_id,good_id,qty) VALUES ($1,$2,$3)', [ch.id, DEPOT.good, cargo[DEPOT.good]]);
  return { ok: true, depotAction: 'stock_withdraw', withdrawn: quantity, stock: Number(row.stock) };
}

export async function closeDepot(ch, id, client, h) {
  mobile(ch); const row = await own(ch, id, client);
  if (Number(row.stock) || (await pending(client, id)).length)
    throw new GameError('depot_obligations', 'Receive pending deliveries, cancel live orders, and sell or withdraw inventory before closing.');
  if (Number(row.treasury)) await releaseCash(ch, row, Number(row.treasury), client, h);
  await client.query("UPDATE business_depots SET status='closed' WHERE id=$1", [id]);
  await client.query('UPDATE business_operating_policies SET enabled=false WHERE depot_id=$1', [id]);
  return { ok: true, closed: id };
}

export async function depotState(client, ch, h) {
  const row = (await client.query("SELECT * FROM business_depots WHERE owner_character=$1 AND status='open'", [ch.id])).rows[0];
  if (!row) return null;
  const orders = await pending(client, row.id);
  const journal = (await client.query('SELECT reason,SUM(cash_delta) cash_delta,SUM(stock_delta) stock_delta,SUM(cost_delta) cost_delta,SUM(expense) expense FROM business_depot_journal WHERE depot_id=$1 GROUP BY reason', [row.id])).rows;
  const sales = journal.filter((entry) => entry.reason === 'sale');
  const revenue = sales.reduce((n, entry) => n + Number(entry.cash_delta), 0);
  const cogs = -sales.reduce((n, entry) => n + Number(entry.cost_delta), 0);
  const expenses = journal.reduce((n, entry) => n + Number(entry.expense), 0);
  const slots = Number((await client.query("SELECT COUNT(*) n FROM market_listings WHERE seller_character=$1 AND (status='live' OR (kind='order' AND filled_qty>0))", [ch.id])).rows[0].n);
  const policy = await latestPolicy(client, row.id);
  const quote = orders.length || slots >= maxListings(h) ? null : procurementQuote(row, h);
  const autoQuote = policyLive(policy) && policy.allow_restock && policyTermsMatch(policy, row)
    && !orders.length && slots < maxListings(h) ? procurementQuote(row, h, policy) : null;
  const customers = (await client.query("SELECT customer_character,COUNT(*) purchases FROM business_depot_journal WHERE depot_id=$1 AND reason='sale' AND customer_character IS NOT NULL GROUP BY customer_character", [row.id])).rows;
  const external = (await client.query('SELECT category,SUM(usd_micros) usd_micros FROM business_external_costs WHERE depot_id=$1 GROUP BY category', [row.id])).rows;
  const stockouts = Number((await client.query("SELECT COUNT(*) n FROM business_depot_journal WHERE depot_id=$1 AND reason='sale' AND stock_after=0", [row.id])).rows[0].n);
  return { id: row.id, good: DEPOT.good, district: row.district, treasury: Number(row.treasury), stock: Number(row.stock),
    stockCost: Number(row.stock_cost), salePrice: Number(row.sale_price), bidPrice: Number(row.bid_price),
    reorderAt: Number(row.reorder_at), targetStock: Number(row.target_stock), restockBudget: Number(row.restock_budget),
    capacity: DEPOT.capacity, cashReserve: DEPOT.cashReserve,
    customerRevenue: revenue, costOfGoodsSold: cogs, operatingExpenses: expenses, operatingProfit: revenue - cogs - expenses,
    unitsSold: -sales.reduce((n, entry) => n + Number(entry.stock_delta), 0),
    operatingPolicy: policyView(policy), automatedRestockQuote: autoQuote,
    customerMetrics: { customerCharacters: customers.length, repeatCustomers: customers.filter((c) => Number(c.purchases) > 1).length,
      measuredPurchases: customers.reduce((n, c) => n + Number(c.purchases), 0), independentCustomersVerified: false },
    stockoutEvents: stockouts, externalCostsUsdMicros: external.reduce((n, e) => n + Number(e.usd_micros), 0),
    externalCostSource: 'owner_reported', externalCostCompletenessVerified: false,
    externalCosts: external.map((e) => ({ category: e.category, usdMicros: Number(e.usd_micros) })),
    profitAfterExternalCosts: null,
    restockQuote: quote, orders: orders.map((o) => ({ id: o.id, status: o.status, wanted: Number(o.qty),
      delivered: Number(o.filled_qty), unitPrice: Number(o.price), expiresAt: new Date(o.expires_at).toISOString() })) };
}

export async function depotBoard(client) {
  if (!depotPilotEnabled()) return [];
  const rows = (await client.query("SELECT d.id,d.owner_character,d.district,d.stock,d.sale_price,c.name FROM business_depots d JOIN characters c ON c.id=d.owner_character WHERE d.status='open' AND c.alive AND d.stock>0 ORDER BY d.created_at LIMIT 100")).rows;
  return rows.map((r) => ({ id: r.id, owner: r.name, district: r.district, good: DEPOT.good, stock: Number(r.stock), unitPrice: Number(r.sale_price) }));
}
