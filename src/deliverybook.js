// Order locks serialize acceptance, open fills, delivery and release. Reservations
import { assertCommercialDisputeAccess } from './commercialdisputes.js';
// partition existing escrow; they never mint or create a second monetary claim.
export async function reservedQuantity(client, orderId) {
  const rows = (await client.query("SELECT remaining FROM delivery_commitments WHERE order_id=$1 AND status='accepted' AND deadline>now()", [orderId])).rows;
  return rows.reduce((n, row) => n + Number(row.remaining), 0);
}

export async function closeDeliveriesAtDeath(client, characterId, estateScope = null) {
  const rows = (await client.query("SELECT id,order_id,buyer_character FROM delivery_commitments WHERE status='accepted' AND (buyer_character=$1 OR supplier_character=$1)", [characterId])).rows;
  for (const order of [...new Set(rows.map((r) => r.order_id))].sort())
    await client.query('SELECT id FROM market_listings WHERE id=$1 FOR UPDATE', [order]);
  for (const row of rows) {
    await client.query('SELECT id FROM delivery_commitments WHERE id=$1 FOR UPDATE', [row.id]);
    await assertCommercialDisputeAccess(client, { orderId: row.order_id, commitmentId: row.id, action: 'estate' },
      { victimId: characterId, scope: estateScope });
    await client.query('UPDATE delivery_commitments SET status=$2 WHERE id=$1',
      [row.id, row.buyer_character === characterId ? 'buyer_dead' : 'supplier_dead']);
  }
}
