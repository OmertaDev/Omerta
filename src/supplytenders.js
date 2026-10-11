import crypto from 'node:crypto';
import { GameError } from './game.js';
import { jailed, safeHoused } from './rules.js';
import { DEPOT } from './depot.js';
import { DELIVERY, acceptDelivery } from './delivery.js';
import { reservedQuantity } from './deliverybook.js';

const fail = message => { throw new GameError('supply_tender', message); };
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const iso = value => new Date(value).toISOString();
function time(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || iso(value) !== value)
    fail('Provide a canonical UTC ISO timestamp.');
  return Date.parse(value);
}
function mobile(ch) {
  if (!ch?.alive || ch.is_npc || jailed(ch) || safeHoused(ch)) fail('Use a living, surfaced player or agent identity.');
}
export function supplyTenderView(row) {
  return { id: row.id, orderId: row.order_id, depotId: row.depot_id, buyerId: row.buyer_character,
    qty: Number(row.qty), unitPrice: Number(row.unit_price), offersCloseAt: iso(row.offers_close_at),
    status: row.status, winningOfferId: row.winning_offer_id || null, commitmentId: row.commitment_id || null,
    gameCashOnly: true, offersReserveQuantity: false };
}
export function supplyOfferView(row) {
  return { id: row.id, tenderId: row.tender_id, supplierId: row.supplier_character,
    qty: Number(row.qty), unitPrice: Number(row.unit_price), maxProcurementCash: Number(row.spend_limit),
    acceptUntil: iso(row.accept_until), deliverBy: iso(row.delivery_deadline), status: row.status };
}
export async function supplyTenderBoard(client, ch) {
  if (!key(ch?.id)) fail('Observe tenders as a signed-in character.');
  const now = Date.now(), rows = (await client.query(`SELECT t.* FROM supply_tenders t
    JOIN business_depots d ON d.id=t.depot_id JOIN market_listings m ON m.id=t.order_id
    JOIN characters b ON b.id=t.buyer_character
    LEFT JOIN (SELECT order_id,SUM(remaining) reserved FROM delivery_commitments
      WHERE status='accepted' AND deadline>now() GROUP BY order_id) c ON c.order_id=m.id
    WHERE t.status='open' AND t.offers_close_at>now() AND d.status='open' AND b.alive
      AND d.owner_character=t.buyer_character AND m.seller_character=t.buyer_character AND m.depot_id=d.id
      AND m.status='live' AND m.kind='order' AND m.good_id=$1 AND m.expires_at>now()
      AND m.price=t.unit_price AND m.qty>=t.qty AND (c.reserved IS NULL OR m.qty-c.reserved>=t.qty)
    ORDER BY t.created_at,t.id LIMIT 100`, [DEPOT.good])).rows;
  const tenders = [];
  for (const tender of rows) {
    const depot = (await client.query('SELECT * FROM business_depots WHERE id=$1', [tender.depot_id])).rows[0];
    const order = (await client.query('SELECT * FROM market_listings WHERE id=$1', [tender.order_id])).rows[0];
    const buyer = (await client.query('SELECT id FROM characters WHERE id=$1 AND alive', [tender.buyer_character])).rows[0];
    if (!buyer || !depot || depot.status !== 'open' || depot.owner_character !== tender.buyer_character
        || !order || order.status !== 'live' || order.kind !== 'order' || order.depot_id !== depot.id
        || order.seller_character !== tender.buyer_character || order.good_id !== DEPOT.good
        || new Date(order.expires_at).getTime() <= now || Number(order.price) !== Number(tender.unit_price)
        || Number(order.qty) - await reservedQuantity(client, order.id) < Number(tender.qty)) continue;
    const own = (await client.query('SELECT * FROM supply_tender_offers WHERE tender_id=$1 AND supplier_character=$2', [tender.id, ch.id])).rows[0];
    const view = { ...supplyTenderView(tender), ownOffer: own ? supplyOfferView(own) : null };
    if (ch.id === tender.buyer_character) {
      const offers = (await client.query("SELECT o.* FROM supply_tender_offers o JOIN characters s ON s.id=o.supplier_character WHERE o.tender_id=$1 AND o.status='offered' AND s.alive AND o.accept_until>$2 AND o.delivery_deadline>=$3 ORDER BY o.delivery_deadline,o.id LIMIT 101",
        [tender.id, new Date(now), new Date(now + 60000)])).rows;
      view.offers = offers.slice(0, 100).map(supplyOfferView);
      view.offersTruncated = offers.length > 100;
    }
    tenders.push(view);
  }
  return { tenders, limit: 100, offersLimit: 100, gameCashOnly: true };
}
async function context(client, tenderId) {
  if (!key(tenderId)) fail('Choose a valid tender.');
  const hint = (await client.query('SELECT depot_id,order_id FROM supply_tenders WHERE id=$1', [tenderId])).rows[0];
  if (!hint) fail('No such tender.');
  const depot = (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [hint.depot_id])).rows[0];
  const order = (await client.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE', [hint.order_id])).rows[0];
  const tender = (await client.query('SELECT * FROM supply_tenders WHERE id=$1 FOR UPDATE', [tenderId])).rows[0];
  if (!depot || !order || !tender || tender.depot_id !== depot.id || tender.order_id !== order.id
      || order.depot_id !== depot.id || order.seller_character !== tender.buyer_character
      || depot.owner_character !== tender.buyer_character) fail('This tender lost its recorded order ownership.');
  return { depot, order, tender };
}
function owner(buyer, ctx) {
  mobile(buyer);
  if (ctx.depot.owner_character !== buyer.id || ctx.order.seller_character !== buyer.id) fail('No tender of your business.');
}
async function funded(ctx, client) {
  const { depot, order, tender } = ctx;
  if (depot.status !== 'open' || order.kind !== 'order' || order.status !== 'live' || order.good_id !== DEPOT.good
      || new Date(order.expires_at).getTime() <= Date.now() || Number(order.price) !== Number(tender.unit_price)
      || Number(order.qty) - await reservedQuantity(client, order.id) < Number(tender.qty))
    fail('This order no longer has the quoted unreserved quantity.');
}

// Routes hold sorted actor/account locks before these helpers acquire depot →
// order → tender → offer locks. Offers never reserve or move any game cash.
export async function publishSupplyTender(buyer, depotId, orderId, body, client) {
  mobile(buyer);
  if (!key(depotId) || !key(orderId) || !integer(body?.qty, 1, DELIVERY.maxUnits)
      || !integer(body?.unitPrice, 50, 1000000)) fail('Provide a valid funded order and fixed quantity/price.');
  const closes = time(body.offersCloseAt);
  const depot = (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [depotId])).rows[0];
  const order = (await client.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE', [orderId])).rows[0];
  if (!depot || !order || depot.owner_character !== buyer.id || order.seller_character !== buyer.id || order.depot_id !== depot.id)
    fail('No funded procurement order of your business.');
  const prior = (await client.query("SELECT * FROM supply_tenders WHERE order_id=$1 AND status='open' FOR UPDATE", [orderId])).rows[0]
    || (await client.query('SELECT * FROM supply_tenders WHERE order_id=$1 AND qty=$2 AND unit_price=$3 AND offers_close_at=$4 ORDER BY created_at DESC LIMIT 1 FOR UPDATE',
      [orderId, body.qty, body.unitPrice, new Date(closes)])).rows[0];
  if (prior && Number(prior.qty) === body.qty && Number(prior.unit_price) === body.unitPrice && new Date(prior.offers_close_at).getTime() === closes)
    return { ok: true, tender: supplyTenderView(prior) };
  if (prior?.status === 'open' && new Date(prior.offers_close_at).getTime() > Date.now())
    fail('Close the existing tender before publishing another.');
  if (closes < Date.now() + 60000 || closes > Date.now() + 3600000 || closes > new Date(order.expires_at).getTime() - 60000)
    fail('Collect offers for 1–60 minutes within the funded order lifetime.');
  const tender = { id: crypto.randomUUID(), order_id: order.id, depot_id: depot.id, buyer_character: buyer.id,
    qty: body.qty, unit_price: body.unitPrice, offers_close_at: new Date(closes), status: 'open' };
  await funded({ depot, order, tender }, client);
  if (prior?.status === 'open') await client.query("UPDATE supply_tenders SET status='cancelled' WHERE id=$1", [prior.id]);
  await client.query('INSERT INTO supply_tenders (id,order_id,depot_id,buyer_character,qty,unit_price,offers_close_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [tender.id, order.id, depot.id, buyer.id, body.qty, body.unitPrice, tender.offers_close_at]);
  return { ok: true, tender: supplyTenderView(tender) };
}

export async function offerSupplyTender(supplier, buyer, tenderId, body, client) {
  mobile(supplier);
  const ctx = await context(client, tenderId);
  if (!buyer?.alive || ctx.tender.buyer_character !== buyer.id) fail('This funded tender has no living buyer.');
  if (supplier.id === buyer.id || !integer(body?.qty, 1, DELIVERY.maxUnits) || !integer(body?.unitPrice, 50, 1000000)
      || !integer(body?.maxProcurementCash, 1, DELIVERY.maxSpend)) fail('Offer independent, bounded supplier terms.');
  const acceptUntil = time(body.acceptUntil), deliverBy = time(body.deliverBy);
  const prior = (await client.query('SELECT * FROM supply_tender_offers WHERE tender_id=$1 AND supplier_character=$2 FOR UPDATE', [tenderId, supplier.id])).rows[0];
  if (prior) {
    if (Number(prior.qty) !== body.qty || Number(prior.unit_price) !== body.unitPrice || Number(prior.spend_limit) !== body.maxProcurementCash
        || new Date(prior.accept_until).getTime() !== acceptUntil || new Date(prior.delivery_deadline).getTime() !== deliverBy)
      fail('An offer is immutable; changed retry terms cannot replace its consent.');
    return { ok: true, offer: supplyOfferView(prior) };
  }
  const now = Date.now();
  if (ctx.tender.status !== 'open' || body.qty !== Number(ctx.tender.qty) || body.unitPrice !== Number(ctx.tender.unit_price)
      || acceptUntil <= now || acceptUntil > new Date(ctx.tender.offers_close_at).getTime() || deliverBy < acceptUntil + 60000
      || deliverBy > now + DELIVERY.maxSeconds * 1000 || deliverBy > new Date(ctx.order.expires_at).getTime())
    fail('Offer exact tender terms with separate acceptance expiry and a bounded promised deadline.');
  await funded(ctx, client);
  const active = (await client.query("SELECT remaining FROM delivery_commitments WHERE supplier_character=$1 AND status='accepted' AND deadline>now()", [supplier.id])).rows;
  if (active.length >= DELIVERY.maxActive || active.reduce((n, row) => n + Number(row.remaining), 0) + body.qty > DELIVERY.maxUnits)
    fail('This supplier cannot promise another full commitment.');
  const offer = { id: crypto.randomUUID(), tender_id: tenderId, supplier_character: supplier.id, qty: body.qty,
    unit_price: body.unitPrice, spend_limit: body.maxProcurementCash, accept_until: new Date(acceptUntil), delivery_deadline: new Date(deliverBy), status: 'offered' };
  await client.query('INSERT INTO supply_tender_offers (id,tender_id,supplier_character,qty,unit_price,spend_limit,accept_until,delivery_deadline) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [offer.id, tenderId, supplier.id, body.qty, body.unitPrice, body.maxProcurementCash, offer.accept_until, offer.delivery_deadline]);
  return { ok: true, offer: supplyOfferView(offer) };
}

export async function awardSupplyTender(buyer, supplier, tenderId, offerId, client) {
  const ctx = await context(client, tenderId); owner(buyer, ctx);
  if (!key(offerId)) fail('Choose a valid offer.');
  const offer = (await client.query('SELECT * FROM supply_tender_offers WHERE id=$1 AND tender_id=$2 FOR UPDATE', [offerId, tenderId])).rows[0];
  if (!offer || offer.supplier_character !== supplier?.id || supplier.id === buyer.id) fail('No signed-in consent from this independent supplier.');
  if (ctx.tender.status === 'awarded') {
    if (ctx.tender.winning_offer_id !== offer.id) fail('This tender was awarded to another offer.');
    return { ok: true, tender: supplyTenderView(ctx.tender), offer: supplyOfferView(offer), commitmentId: ctx.tender.commitment_id };
  }
  mobile(supplier);
  const now = Date.now();
  if (ctx.tender.status !== 'open' || offer.status !== 'offered' || new Date(ctx.tender.offers_close_at).getTime() <= now
      || new Date(offer.accept_until).getTime() <= now || new Date(offer.delivery_deadline).getTime() < now + 60000
      || Number(offer.qty) !== Number(ctx.tender.qty) || Number(offer.unit_price) !== Number(ctx.tender.unit_price))
    fail('This selected offer is no longer acceptable.');
  await funded(ctx, client);
  const accepted = await acceptDelivery(supplier, ctx.order.id, { qty: Number(offer.qty), unitPrice: Number(offer.unit_price),
    maxProcurementCash: Number(offer.spend_limit), deadlineSeconds: 60 }, client, { deadlineAt: new Date(offer.delivery_deadline) });
  if (accepted.deadline !== iso(offer.delivery_deadline)) fail('Acceptance did not preserve the exact supplier deadline.');
  await client.query("UPDATE supply_tenders SET status='awarded',winning_offer_id=$2,commitment_id=$3 WHERE id=$1", [tenderId, offer.id, accepted.id]);
  await client.query("UPDATE supply_tender_offers SET status='accepted' WHERE id=$1", [offer.id]);
  ctx.tender.status = 'awarded'; ctx.tender.winning_offer_id = offer.id; ctx.tender.commitment_id = accepted.id; offer.status = 'accepted';
  return { ok: true, tender: supplyTenderView(ctx.tender), offer: supplyOfferView(offer), commitmentId: accepted.id };
}

export async function withdrawSupplyOffer(supplier, tenderId, client) {
  mobile(supplier);
  const ctx = await context(client, tenderId);
  const offer = (await client.query('SELECT * FROM supply_tender_offers WHERE tender_id=$1 AND supplier_character=$2 FOR UPDATE', [tenderId, supplier.id])).rows[0];
  if (!offer || offer.status === 'accepted') fail('Only your unaccepted offer can be withdrawn.');
  if (offer.status !== 'withdrawn') await client.query("UPDATE supply_tender_offers SET status='withdrawn' WHERE id=$1", [offer.id]);
  offer.status = 'withdrawn';
  return { ok: true, offer: supplyOfferView(offer) };
}
export async function cancelSupplyTender(buyer, tenderId, client) {
  const ctx = await context(client, tenderId); owner(buyer, ctx);
  if (ctx.tender.status === 'awarded') fail('An accepted delivery cannot be revoked by cancelling its tender.');
  if (ctx.tender.status !== 'cancelled') await client.query("UPDATE supply_tenders SET status='cancelled' WHERE id=$1", [tenderId]);
  ctx.tender.status = 'cancelled';
  return { ok: true, tender: supplyTenderView(ctx.tender) };
}
