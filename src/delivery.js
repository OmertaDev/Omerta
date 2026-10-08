import crypto from 'node:crypto';
import { GameError, travel } from './game.js';
import { jailed, safeHoused, CONSTANTS, BLACK_MARKET } from './rules.js';
import { fillOrder } from './market.js';
import { reservedQuantity } from './deliverybook.js';
import { buyGood } from './economy.js';
import { goodsBuyQuote } from './goodsquote.js';

export const DELIVERY = Object.freeze({ maxActive: 2, maxUnits: 40, maxSpend: 100000, maxSeconds: 21600 });
export const deliveryIntakeEnabled = () => process.env.DELIVERY_CONTRACTS === 'on';
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
export async function acceptDelivery(ch, orderId, body, client) {
  if (!deliveryIntakeEnabled()) throw new GameError('pilot_disabled', 'Delivery-contract acceptance is not open.');
  if (ch.is_npc) throw new GameError('delivery_owner', 'Delivery commitments require a durable player or agent identity.');
  if (jailed(ch) || safeHoused(ch)) throw new GameError('status', 'Surface before accepting a delivery.');
  if (!integer(body?.qty, 1, DELIVERY.maxUnits) || !integer(body?.maxProcurementCash, 1, DELIVERY.maxSpend)
      || !integer(body?.deadlineSeconds, 60, DELIVERY.maxSeconds)) throw new GameError('delivery_terms', 'Supply bounded integer qty, maxProcurementCash and deadlineSeconds.');
  const active = (await client.query("SELECT remaining FROM delivery_commitments WHERE supplier_character=$1 AND status='accepted' AND deadline>now()", [ch.id])).rows;
  if (active.length >= DELIVERY.maxActive || active.reduce((n, r) => n + Number(r.remaining), 0) + body.qty > DELIVERY.maxUnits)
    throw new GameError('delivery_limit', 'Delivery exposure exceeds the active-contract or unit limit.');
  const order = (await client.query("SELECT * FROM market_listings WHERE id=$1 AND kind='order' AND status='live' FOR UPDATE", [orderId])).rows[0];
  const deadline = new Date(Date.now() + body.deadlineSeconds * 1000);
  if (!order?.depot_id || new Date(order.expires_at) < deadline) throw new GameError('no_order', 'Choose a depot order that remains funded through this deadline.');
  if (order.seller_character === ch.id) throw new GameError('own', 'You cannot contract with your own business.');
  if (body.qty > Number(order.qty) - await reservedQuantity(client, order.id)) throw new GameError('reserved', 'That quantity is no longer available.');
  if (Number(order.price) !== body.unitPrice) throw new GameError('price_changed', 'Refresh the order quote before accepting its fixed price.');
  const id = crypto.randomUUID();
  await client.query('INSERT INTO delivery_commitments (id,order_id,depot_id,buyer_character,supplier_character,good_id,district,unit_price,quantity,remaining,spend_limit,deadline,take_bps) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$11,$12)',
    [id, order.id, order.depot_id, order.seller_character, ch.id, order.good_id, order.district, order.price, body.qty, body.maxProcurementCash, deadline, BLACK_MARKET.TAKE_BPS]);
  const gross = body.qty * Number(order.price);
  return { ok: true, id, quantity: body.qty, district: order.district, unitPrice: Number(order.price),
    takeBps: BLACK_MARKET.TAKE_BPS, netPayout: gross - Math.ceil(gross * BLACK_MARKET.TAKE_BPS / 10000),
    deadline: deadline.toISOString(), maxProcurementCash: body.maxProcurementCash };
}

async function lockedCommitment(ch, id, client) {
  const pre = (await client.query('SELECT order_id FROM delivery_commitments WHERE id=$1 AND supplier_character=$2', [id, ch.id])).rows[0];
  if (!pre) throw new GameError('no_commitment', 'No delivery commitment of yours.');
  const order = (await client.query("SELECT * FROM market_listings WHERE id=$1 AND status='live' FOR UPDATE", [pre.order_id])).rows[0];
  const commitment = (await client.query("SELECT * FROM delivery_commitments WHERE id=$1 AND supplier_character=$2 AND status='accepted' AND deadline>now() FOR UPDATE", [id, ch.id])).rows[0];
  if (!order || !commitment || new Date(commitment.deadline) <= new Date() || new Date(order.expires_at) <= new Date()) throw new GameError('no_commitment', 'This commitment is no longer deliverable.');
  return commitment;
}

export async function deliverCommitment(ch, id, qty, client, h) {
  if (!integer(qty, 1, DELIVERY.maxUnits)) throw new GameError('delivery_terms', 'qty must be a bounded integer.');
  const c = await lockedCommitment(ch, id, client);
  if (qty > Number(c.remaining) || qty > Number(h.owned.cargo[c.good_id] || 0)) throw new GameError('qty', 'Deliver only committed quantities you actually hold.');
  return fillOrder(ch, c.order_id, qty, client, h, { commitmentId: c.id });
}

export async function deliveryStep(ch, id, kind, body, client, h) {
  if (jailed(ch) || safeHoused(ch)) throw new GameError('status', 'Surface before procuring a delivery.');
  const c = await lockedCommitment(ch, id, client);
  let cost;
  if (kind === 'delivery_buy') {
    if (body.goodId !== c.good_id || !integer(body.qty, 1, Number(c.remaining))
        || body.qty + Number(h.owned.cargo[c.good_id] || 0) > Number(c.remaining))
      throw new GameError('delivery_terms', 'Procure only the committed good and still-needed quantity.');
    cost = goodsBuyQuote(c.good_id, ch.loc, body.qty, h.owned).total;
  } else if (kind === 'delivery_travel') cost = CONSTANTS.TRAVEL_COST;
  else throw new GameError('delivery_terms', 'Unknown delivery step.');
  if (Number(c.spent) + cost > Number(c.spend_limit) || Number(ch.cash) - cost < 1000)
    throw new GameError('delivery_budget', 'This step exceeds the committed spending cap or personal cash reserve.');
  const result = kind === 'delivery_buy' ? await buyGood(ch, c.good_id, body.qty, client, h)
    : await travel(ch, body.district, client, h);
  await client.query('UPDATE delivery_commitments SET spent=$2 WHERE id=$1', [id, Number(c.spent) + cost]);
  return result;
}

export async function expireCommitment(ch, id, client) {
  const pre = (await client.query('SELECT order_id,supplier_character,buyer_character FROM delivery_commitments WHERE id=$1', [id])).rows[0];
  if (!pre || ![pre.supplier_character, pre.buyer_character].includes(ch.id)) throw new GameError('no_commitment', 'No commitment of yours.');
  await client.query('SELECT id FROM market_listings WHERE id=$1 FOR UPDATE', [pre.order_id]);
  const c = (await client.query("SELECT * FROM delivery_commitments WHERE id=$1 AND status='accepted' FOR UPDATE", [id])).rows[0];
  if (!c || new Date(c.deadline) > new Date()) throw new GameError('delivery_deadline', 'Only an elapsed commitment can be closed without delivery.');
  await client.query("UPDATE delivery_commitments SET status='expired' WHERE id=$1", [id]);
  return { ok: true, released: Number(c.remaining), paid: 0 };
}

export async function deliveryBoard(client, ch) {
  const active = (await client.query("SELECT * FROM delivery_commitments WHERE (supplier_character=$1 OR buyer_character=$1) AND status='accepted' AND deadline>now() ORDER BY created_at", [ch.id])).rows;
  const history = (await client.query("SELECT * FROM delivery_commitments WHERE (supplier_character=$1 OR buyer_character=$1) AND NOT (status='accepted' AND deadline>now()) ORDER BY created_at DESC LIMIT 100", [ch.id])).rows;
  const rows = [...active, ...history];
  return rows.map((c) => ({ id: c.id, orderId: c.order_id, depotId: c.depot_id, buyerId: c.buyer_character,
    supplierId: c.supplier_character, good: c.good_id, district: c.district, unitPrice: Number(c.unit_price),
    quantity: Number(c.quantity), remaining: Number(c.remaining), maxProcurementCash: Number(c.spend_limit), spent: Number(c.spent),
    takeBps: Number(c.take_bps), netPayout: Number(c.quantity) * Number(c.unit_price) - Math.ceil(Number(c.quantity) * Number(c.unit_price) * Number(c.take_bps) / 10000),
    deadline: new Date(c.deadline).toISOString(), status: c.status === 'accepted' && new Date(c.deadline) <= new Date() ? 'expired' : c.status }));
}
