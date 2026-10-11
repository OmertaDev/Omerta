import crypto from 'node:crypto';
import { GameError } from './game.js';

export const CREW_LOGISTICS = Object.freeze({ termMs: 86400000, memberLimit: 8, crewLimit: 32 });
const kinds = ['tender', 'delivery_commitment', 'warehouse_claim'];
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const fail = (code = 'crew_logistics') => { throw new GameError(code, 'This Crew logistics reference is unavailable.'); };
const millis = value => { const ms = new Date(value).getTime(); if (!Number.isFinite(ms)) fail(); return ms; };
const iso = value => new Date(millis(value)).toISOString();
const integer = (value, min, max) => (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max;

export function validateCrewLogisticsTarget(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2
      || !Object.hasOwn(body, 'kind') || !Object.hasOwn(body, 'targetId') || !kinds.includes(body.kind) || !key(body.targetId)) fail();
  return { kind: body.kind, targetId: body.targetId };
}
// Whitelist projections intentionally omit prices, spending caps and warehouse holdings.
export function crewLogisticsSourceView(kind, row, characterId, now = new Date()) {
  const clock = millis(now);
  if (!key(characterId) || !row || !key(row.id) || typeof row.district !== 'string' || !row.district || row.district.length > 128) fail();
  if (kind === 'tender') {
    if (row.buyer_character !== characterId || row.order_good !== 'gin' || !['open', 'awarded', 'cancelled'].includes(row.status)
        || !integer(row.qty, 1, 40)) fail();
    return { kind, targetId: row.id, good: 'gin', district: row.district, status: row.status === 'open' && millis(row.offers_close_at) <= clock ? 'expired' : row.status,
      deadline: iso(row.offers_close_at) };
  }
  if (kind === 'delivery_commitment') {
    if (row.supplier_character !== characterId || row.good_id !== 'gin'
        || !['accepted', 'delivered', 'expired', 'buyer_dead', 'supplier_dead'].includes(row.status)
        || !integer(row.quantity, 1, 40) || !integer(row.remaining, 0, Number(row.quantity))) fail();
    return { kind, targetId: row.id, good: 'gin', district: row.district,
      status: row.status === 'accepted' && millis(row.deadline) <= clock ? 'expired' : row.status,
      deadline: iso(row.deadline), quantityDelivered: Number(row.quantity) - Number(row.remaining) };
  }
  if (kind === 'warehouse_claim') {
    if (row.tenant_character !== characterId || row.good_id !== 'gin'
        || !['active', 'closed', 'landlord_closed', 'tenant_dead'].includes(row.status)
        || !integer(row.units, 1, 10) || !integer(row.held_qty, 0, Number(row.units))) fail();
    return { kind, targetId: row.id, good: 'gin', district: row.district,
      status: row.status === 'active' && millis(row.expires_at) <= clock ? 'expired' : row.status, deadline: iso(row.expires_at) };
  }
  fail();
}
async function membership(client, ch) {
  if (!ch?.alive || ch.is_npc || !key(ch.id) || !key(ch.account_id) || !integer(ch.generation, 1, 2147483647)) fail();
  const row = (await client.query(`SELECT m.crew_id,c.leader_account FROM crew_members m JOIN crews c ON c.id=m.crew_id
    WHERE m.account_id=$1`, [ch.account_id])).rows[0];
  if (!row) fail('no_crew');
  return row;
}
async function source(client, kind, targetId, actorId, now) {
  if (!kinds.includes(kind) || !key(targetId) || !key(actorId)) fail();
  let row;
  if (kind === 'tender') {
    row = (await client.query(`SELECT t.*,d.district,d.owner_character,d.status depot_status,m.seller_character,m.depot_id order_depot_id,m.kind order_kind,m.good_id order_good
      FROM supply_tenders t JOIN business_depots d ON d.id=t.depot_id JOIN market_listings m ON m.id=t.order_id
      WHERE t.id=$1 AND t.buyer_character=$2`, [targetId, actorId])).rows[0];
    if (!row || row.owner_character !== actorId || row.seller_character !== actorId || row.order_depot_id !== row.depot_id
        || row.order_kind !== 'order' || row.order_good !== 'gin') fail();
  } else if (kind === 'delivery_commitment') {
    row = (await client.query('SELECT * FROM delivery_commitments WHERE id=$1 AND supplier_character=$2', [targetId, actorId])).rows[0];
  } else {
    row = (await client.query(`SELECT l.*,d.district FROM business_warehouse_leases l JOIN business_depots d ON d.id=l.depot_id
      WHERE l.id=$1 AND l.tenant_character=$2`, [targetId, actorId])).rows[0];
  }
  if (row?.id !== targetId) fail();
  return { row, view: crewLogisticsSourceView(kind, row, actorId, now) };
}
function linkView(link, view, publisherName) {
  return { id: link.id, publisher: publisherName, source: view, createdAt: iso(link.created_at), expiresAt: iso(link.expires_at) };
}
// Writes require G.withCharacter(..., CREW_FIRST_CHARACTER_LOCKS): Crew -> character -> account -> membership.
// Sources are read-only; these functions never execute, reserve, transfer, assign or spend anything.
export async function publishCrewLogisticsLink(ch, body, client) {
  const target = validateCrewLogisticsTarget(body), member = await membership(client, ch), now = new Date();
  const { row, view } = await source(client, target.kind, target.targetId, ch.id, now);
  const current = target.kind === 'tender' ? ['open', 'awarded'].includes(view.status) && row.depot_status === 'open'
    : target.kind === 'delivery_commitment' ? view.status === 'accepted'
      : view.status === 'active' || (['expired', 'landlord_closed'].includes(view.status) && Number(row.held_qty) > 0);
  if (!current) fail();
  await client.query(`UPDATE crew_logistics_links SET revoked_at=$3 WHERE crew_id=$1 AND publisher_account_id=$2 AND revoked_at IS NULL
    AND (expires_at<=$3 OR publisher_character_id<>$4 OR generation<>$5)`, [member.crew_id, ch.account_id, now, ch.id, Number(ch.generation)]);
  const links = (await client.query(`SELECT l.* FROM crew_logistics_links l JOIN crew_members m ON m.crew_id=l.crew_id AND m.account_id=l.publisher_account_id
    JOIN characters c ON c.id=l.publisher_character_id WHERE l.crew_id=$1 AND l.revoked_at IS NULL AND l.expires_at>$2
    AND c.alive AND c.account_id=l.publisher_account_id AND c.generation=l.generation ORDER BY l.created_at,l.id LIMIT 33`, [member.crew_id, now])).rows;
  const own = links.filter(link => link.publisher_account_id === ch.account_id);
  const prior = own.find(link => link.kind === target.kind && link.target_id === target.targetId);
  if (prior) return { link: linkView(prior, view, ch.name) };
  if (own.length >= 8 || links.length >= 32) fail('crew_logistics_limit');
  const link = { id: crypto.randomUUID(), crew_id: member.crew_id, publisher_account_id: ch.account_id, publisher_character_id: ch.id,
    generation: Number(ch.generation), kind: target.kind, target_id: target.targetId, created_at: now, expires_at: new Date(now.getTime() + 86400000) };
  await client.query(`INSERT INTO crew_logistics_links(id,crew_id,publisher_account_id,publisher_character_id,generation,kind,target_id,created_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [link.id, link.crew_id, link.publisher_account_id, ch.id, link.generation, target.kind, target.targetId, now, link.expires_at]);
  return { link: linkView(link, view, ch.name) };
}
export async function revokeCrewLogisticsLink(ch, id, client) {
  if (!key(id)) fail();
  const member = await membership(client, ch);
  const row = (await client.query('SELECT * FROM crew_logistics_links WHERE id=$1 AND crew_id=$2 FOR UPDATE', [id, member.crew_id])).rows[0];
  if (!row || (row.publisher_account_id !== ch.account_id && member.leader_account !== ch.account_id)) fail();
  if (!row.revoked_at) await client.query('UPDATE crew_logistics_links SET revoked_at=$2 WHERE id=$1', [id, new Date()]);
  return { revoked: id };
}
export async function crewLogisticsBoard(client, ch) {
  const member = await membership(client, ch), now = new Date();
  const { rows } = await client.query(`SELECT l.*,c.name publisher_name FROM crew_logistics_links l
    JOIN crew_members m ON m.crew_id=l.crew_id AND m.account_id=l.publisher_account_id JOIN characters c ON c.id=l.publisher_character_id
    WHERE l.crew_id=$1 AND l.revoked_at IS NULL AND l.expires_at>$2 AND c.alive AND c.account_id=l.publisher_account_id
    AND c.generation=l.generation ORDER BY l.created_at,l.id LIMIT 33`, [member.crew_id, now]);
  const links = [];
  for (const link of rows.slice(0, 32)) {
    try { const { view } = await source(client, link.kind, link.target_id, link.publisher_character_id, now); links.push(linkView(link, view, link.publisher_name)); }
    catch (error) { if (!(error instanceof GameError) || error.code !== 'crew_logistics') throw error; }
  }
  return { crewId: member.crew_id, links, limit: 32, sharedExecutionAuthority: false, causalEffect: null };
}
