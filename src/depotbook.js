import crypto from 'node:crypto';

// Storage-only treasury boundary. Callers hold character → depot → order locks.
// Absolute writes keep pg-mem and PostgreSQL accounting identical.
export async function bookDepot(client, row, reason, { cash = 0, stock = 0, cost = 0, expense = 0, orderId = null, policyId = null, customerId = null } = {}) {
  const next = { cash: Number(row.treasury) + cash, stock: Number(row.stock) + stock,
    cost: Number(row.stock_cost) + cost };
  if (![cash, stock, cost, expense, ...Object.values(next)].every(Number.isSafeInteger)
      || next.cash < 0 || next.stock < 0 || next.stock > 40 || next.cost < 0 || expense < 0
      || (next.stock === 0 && next.cost !== 0))
    throw new Error('Depot accounting would violate its funded balance or capacity.');
  await client.query('UPDATE business_depots SET treasury=$2,stock=$3,stock_cost=$4 WHERE id=$1',
    [row.id, next.cash, next.stock, next.cost]);
  await client.query('INSERT INTO business_depot_journal (id,depot_id,reason,cash_delta,stock_delta,cost_delta,expense,order_id,policy_id,customer_character,stock_after) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [crypto.randomUUID(), row.id, reason, cash, stock, cost, expense, orderId, policyId, customerId, next.stock]);
  row.treasury = next.cash; row.stock = next.stock; row.stock_cost = next.cost;
}

export async function refundDepotOrder(client, listing, amount) {
  const depot = (await client.query("SELECT * FROM business_depots WHERE id=$1 AND status='open' FOR UPDATE", [listing.depot_id])).rows[0];
  if (!depot || depot.owner_character !== listing.seller_character) throw new Error('Business order lost its recorded treasury.');
  await bookDepot(client, depot, 'restock_refund', { cash: amount, orderId: listing.id });
}

export async function closeDepotsAtDeath(client, characterId, ledger) {
  const rows = (await client.query("SELECT * FROM business_depots WHERE owner_character=$1 AND status='open' FOR UPDATE", [characterId])).rows;
  for (const row of rows) {
    const cash = Number(row.treasury);
    const orders = (await client.query("SELECT qty,filled_qty,price,status FROM market_listings WHERE depot_id=$1 AND (status='live' OR filled_qty>0)", [row.id])).rows;
    const rights = orders.reduce((n, order) => n + (Number(order.filled_qty)
      + (order.status === 'live' ? Number(order.qty) : 0)) * Number(order.price), 0);
    await bookDepot(client, row, 'death', { cash: -cash, stock: -Number(row.stock), cost: -Number(row.stock_cost),
      expense: cash + Number(row.stock_cost) + rights });
    await client.query("UPDATE business_depots SET status='closed' WHERE id=$1", [row.id]);
    await client.query('UPDATE business_operating_policies SET enabled=false WHERE depot_id=$1', [row.id]);
    if (cash) await ledger(client, { currency: 'cash', amount: -cash, reason: 'depot:death', counterparty: characterId });
  }
}
