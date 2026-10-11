import crypto from 'node:crypto';
import { GameError, trunkCap } from './game.js';
import { jailed, safeHoused } from './rules.js';
import { bookDepot } from './depotbook.js';

export const WAREHOUSE = Object.freeze({ good: 'gin', termMs: 86400000, maxUnits: 10, maxClaims: 2, depotCapacity: 40, cashReserve: 1000 });
const fail = (code, message) => { throw new GameError(code, message); };
const integer = (value, min, max) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('warehouse_terms', 'Warehouse terms must be bounded whole numbers.');
  return value;
};
const intake = () => { if (process.env.DEPOT_PILOT !== 'on') fail('pilot_disabled', 'The supply-depot pilot is not open.'); };
const mobile = ch => {
  if (!ch.alive) fail('dead', 'A living tenant is required.');
  if (jailed(ch)) fail('jailed', 'No warehouse cargo moves from lockup.');
  if (safeHoused(ch)) fail('safe', 'Come out before moving warehouse cargo.');
};
const atDock = (ch, depot) => { if (ch.loc !== depot.district) fail('district', 'Visit the warehouse district first.'); };
const time = value => { const ms = new Date(value).getTime(); if (!Number.isFinite(ms)) fail('warehouse_terms', 'Invalid warehouse clock.'); return ms; };
const liveService = (row, now) => row.status === 'active' && time(row.expires_at) > time(now);
export function warehouseLeaseTerms(body) {
  return { units: integer(body?.units, 1, 10), expectedOfferRevision: integer(body?.expectedOfferRevision, 1, 2147483647),
    maxTotalCash: integer(body?.maxTotalCash, 1, 1000000) };
}
export function warehouseLeaseFee(units, cashPerUnitDay) {
  return integer(units, 1, 10) * integer(cashPerUnitDay, 1, 100000);
}
export function warehouseReservedFromRows(rows, now) {
  time(now);
  return rows.reduce((sum, row) => {
    const units = integer(Number(row.units), 1, 10), held = integer(Number(row.held_qty), 0, units);
    if (!['active', 'closed', 'landlord_closed', 'tenant_dead'].includes(row.status)) fail('warehouse_terms', 'Invalid warehouse lifecycle.');
    if (['closed', 'tenant_dead'].includes(row.status)) {
      if (held) fail('warehouse_terms', 'Closed warehouse claims cannot retain cargo.');
      return sum;
    }
    const total = sum + (liveService(row, now) ? units : held);
    if (!Number.isSafeInteger(total)) fail('warehouse_terms', 'Warehouse capacity overflow.');
    return total;
  }, 0);
}
export async function warehouseReservedUnits(client, depotId, now = new Date()) {
  const { rows } = await client.query('SELECT units,held_qty,status,expires_at FROM business_warehouse_leases WHERE depot_id=$1', [depotId]);
  return warehouseReservedFromRows(rows, now);
}
async function lockedDepot(client, id) {
  const row = (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!row) fail('no_depot', 'No warehouse at that location.');
  return row;
}
async function promisedUnits(client, id) {
  const { rows } = await client.query("SELECT qty,filled_qty,status FROM market_listings WHERE depot_id=$1 AND (status='live' OR filled_qty>0)", [id]);
  return rows.reduce((sum, row) => sum + Number(row.filled_qty) + (row.status === 'live' ? Number(row.qty) : 0), 0);
}
async function capacity(client, depot, now) {
  const reserved = await warehouseReservedUnits(client, depot.id, now);
  const physical = 40 - Number(depot.stock) - await promisedUnits(client, depot.id) - reserved;
  return { reserved, available: Math.max(0, Math.min(physical, Number(depot.warehouse_slots) - reserved)) };
}
export async function configureWarehouseOffer(ch, depotId, body, client) {
  intake(); mobile(ch);
  const expected = integer(body?.expectedRevision, 0, 2147483646);
  if (typeof body?.enabled !== 'boolean') fail('warehouse_terms', 'Provide a warehouse enabled boolean.');
  const slots = integer(body.slots, 0, 40), price = integer(body.cashPerUnitDay, 0, 100000);
  if (body.enabled && (!slots || !price)) fail('warehouse_terms', 'An enabled offer needs positive slots and rent.');
  const depot = await lockedDepot(client, depotId);
  if (depot.owner_character !== ch.id || depot.status !== 'open') fail('not_yours', 'No open warehouse of yours.');
  if (Number(depot.warehouse_revision) !== expected) fail('warehouse_revision', 'Refresh the warehouse offer.');
  await client.query('UPDATE business_depots SET warehouse_enabled=$2,warehouse_slots=$3,warehouse_cash_per_unit_day=$4,warehouse_revision=$5 WHERE id=$1',
    [depotId, body.enabled, slots, price, expected + 1]);
  return { ok: true, depotId, revision: expected + 1 };
}
function leaseView(row, district, now) {
  return { id: row.id, depotId: row.depot_id, district, good: 'gin', units: Number(row.units), heldQty: Number(row.held_qty),
    feeCash: Number(row.fee_cash), cashPerUnitDay: Number(row.cash_per_unit_day), offerRevision: Number(row.offer_revision),
    createdAt: new Date(row.created_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(), status: row.status,
    depositsAllowed: liveService(row, now), retrievalAvailable: Number(row.held_qty) > 0 };
}
// Callers hold sorted tenant/landlord character locks before this depot lock.
export async function leaseWarehouse(ch, landlord, depotId, body, client, h) {
  intake(); mobile(ch); const terms = warehouseLeaseTerms(body);
  const depot = await lockedDepot(client, depotId), now = new Date();
  if (!landlord?.alive || depot.owner_character !== landlord.id || depot.status !== 'open') fail('no_depot', 'That warehouse is not operating.');
  if (ch.id === landlord.id || ch.account_id === landlord.account_id) fail('own', 'Rent only an independent warehouse.');
  atDock(ch, depot);
  if (!depot.warehouse_enabled || Number(depot.warehouse_revision) !== terms.expectedOfferRevision) fail('warehouse_revision', 'Refresh the warehouse offer.');
  const price = integer(Number(depot.warehouse_cash_per_unit_day), 1, 100000), fee = warehouseLeaseFee(terms.units, price);
  if (fee > terms.maxTotalCash) fail('price_changed', 'The warehouse rent exceeds your limit.');
  await client.query("UPDATE business_warehouse_leases SET status='closed' WHERE tenant_character=$1 AND status='active' AND held_qty=0 AND expires_at<=$2 AND depot_id=$3", [ch.id, now, depotId]);
  const claims = (await client.query("SELECT * FROM business_warehouse_leases WHERE tenant_character=$1 AND status IN ('active','landlord_closed')", [ch.id])).rows
    .filter(row => liveService(row, now) || Number(row.held_qty) > 0);
  if (claims.length >= 2 || claims.some(row => row.depot_id === depotId)) fail('warehouse_claims', 'Close or retrieve an existing warehouse claim first.');
  if (terms.units > (await capacity(client, depot, now)).available) fail('warehouse_capacity', 'Not enough warehouse capacity.');
  if (Number(ch.cash) - fee < 1000) fail('cash', 'Keep a $1,000 personal cash reserve after rent.');
  const row = { id: crypto.randomUUID(), depot_id: depotId, landlord_character: landlord.id, tenant_character: ch.id, good_id: 'gin',
    units: terms.units, held_qty: 0, cash_per_unit_day: price, fee_cash: fee, offer_revision: terms.expectedOfferRevision,
    created_at: now, expires_at: new Date(now.getTime() + 86400000), status: 'active' };
  await client.query("INSERT INTO business_warehouse_leases(id,depot_id,landlord_character,tenant_character,good_id,units,held_qty,cash_per_unit_day,fee_cash,offer_revision,created_at,expires_at,status) VALUES($1,$2,$3,$4,'gin',$5,0,$6,$7,$8,$9,$10,'active')",
    [row.id, depotId, landlord.id, ch.id, row.units, price, fee, row.offer_revision, now, row.expires_at]);
  await bookDepot(client, depot, 'warehouse_rent', { cash: fee, leaseId: row.id, customerId: ch.id });
  ch.cash = Number(ch.cash) - fee;
  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -fee, reason: 'warehouse:rent', counterparty: depotId });
  return { ok: true, lease: leaseView(row, depot.district, now) };
}
async function lockedLease(ch, leaseId, client) {
  const hint = (await client.query('SELECT depot_id FROM business_warehouse_leases WHERE id=$1 AND tenant_character=$2', [leaseId, ch.id])).rows[0];
  if (!hint) fail('not_yours', 'No warehouse claim of yours.');
  const depot = await lockedDepot(client, hint.depot_id);
  const row = (await client.query('SELECT * FROM business_warehouse_leases WHERE id=$1 AND tenant_character=$2 FOR UPDATE', [leaseId, ch.id])).rows[0];
  if (!row || row.depot_id !== depot.id || !['active', 'landlord_closed'].includes(row.status)) fail('not_yours', 'No warehouse claim of yours.');
  return { depot, row, now: new Date() };
}
async function setCargo(client, ch, h, qty) {
  await client.query('DELETE FROM character_cargo WHERE character_id=$1 AND good_id=$2', [ch.id, 'gin']);
  if (qty) await client.query('INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,$2,$3)', [ch.id, 'gin', qty]);
  h.owned.cargo.gin = qty;
}
export async function depositWarehouseCargo(ch, leaseId, qty, client, h) {
  mobile(ch); qty = integer(qty, 1, 10);
  const { depot, row, now } = await lockedLease(ch, leaseId, client); atDock(ch, depot);
  const owner = (await client.query('SELECT alive FROM characters WHERE id=$1', [row.landlord_character])).rows[0];
  if (!liveService(row, now) || depot.status !== 'open' || !owner?.alive) fail('warehouse_expired', 'This warehouse no longer accepts deposits.');
  const next = Number(row.held_qty) + qty, cargo = Number(h.owned.cargo.gin || 0);
  if (next > Number(row.units)) fail('warehouse_capacity', 'The leased compartment is full.');
  if (cargo < qty) fail('cargo', 'Not enough gin in your trunk.');
  await client.query('UPDATE business_warehouse_leases SET held_qty=$2 WHERE id=$1', [row.id, next]);
  await setCargo(client, ch, h, cargo - qty);
  await bookDepot(client, depot, 'warehouse_deposit', { leaseId: row.id, leaseStock: qty, leaseStockAfter: next, customerId: ch.id });
  return { ok: true, deposited: qty, heldQty: next };
}
export async function withdrawWarehouseCargo(ch, leaseId, qty, client, h) {
  mobile(ch); qty = integer(qty, 1, 10);
  const { depot, row } = await lockedLease(ch, leaseId, client); atDock(ch, depot);
  if (qty > Number(row.held_qty)) fail('cargo', 'Not enough gin in this warehouse claim.');
  if (Object.values(h.owned.cargo).reduce((n, q) => n + Number(q), 0) + qty > trunkCap(h)) fail('cargo', 'No room in the trunk.');
  const next = Number(row.held_qty) - qty;
  await client.query('UPDATE business_warehouse_leases SET held_qty=$2 WHERE id=$1', [row.id, next]);
  await setCargo(client, ch, h, Number(h.owned.cargo.gin || 0) + qty);
  await bookDepot(client, depot, 'warehouse_withdraw', { leaseId: row.id, leaseStock: -qty, leaseStockAfter: next, customerId: ch.id });
  return { ok: true, withdrawn: qty, heldQty: next };
}
export async function closeWarehouseLease(ch, leaseId, client) {
  mobile(ch); const { row } = await lockedLease(ch, leaseId, client);
  if (Number(row.held_qty)) fail('warehouse_cargo', 'Retrieve your stored gin before closing.');
  await client.query("UPDATE business_warehouse_leases SET status='closed' WHERE id=$1", [leaseId]);
  return { ok: true, closed: leaseId, refunded: 0 };
}
export async function warehouseOffers(client) {
  if (process.env.DEPOT_PILOT !== 'on') return [];
  const { rows } = await client.query("SELECT d.* FROM business_depots d JOIN characters c ON c.id=d.owner_character WHERE d.status='open' AND c.alive AND d.warehouse_enabled ORDER BY d.created_at,d.id LIMIT 100");
  const now = new Date(), offers = [];
  for (const depot of rows) {
    const { available } = await capacity(client, depot, now);
    if (available > 0) offers.push({ depotId: depot.id, district: depot.district, good: 'gin', availableUnits: Math.min(10, available),
      cashPerUnitDay: Number(depot.warehouse_cash_per_unit_day), offerRevision: Number(depot.warehouse_revision), termHours: 24 });
  }
  return offers;
}
export async function warehouseLeaseBoard(client, ch) {
  const { rows } = await client.query("SELECT l.*,d.district FROM business_warehouse_leases l JOIN business_depots d ON d.id=l.depot_id WHERE l.tenant_character=$1 AND ((l.status='active' AND l.expires_at>$2) OR (l.status IN ('active','landlord_closed') AND l.held_qty>0)) ORDER BY l.created_at,l.id LIMIT 100", [ch.id, new Date()]);
  const now = new Date(); return rows.map(row => leaseView(row, row.district, now));
}
// Called before ANY existing estate depot/order locks; never locks another character.
export async function lockWarehouseEstateDepots(client, characterId) {
  const { rows } = await client.query(`SELECT d.* FROM business_depots d WHERE d.owner_character=$1 OR d.id IN
    (SELECT depot_id FROM business_warehouse_leases WHERE tenant_character=$1 AND status IN ('active','landlord_closed')) ORDER BY d.id FOR UPDATE`, [characterId]);
  return rows;
}
export async function closeWarehouseClaimsAtDeath(client, characterId) {
  const depots = await lockWarehouseEstateDepots(client, characterId);
  for (const depot of depots) {
    const { rows } = await client.query("SELECT * FROM business_warehouse_leases WHERE depot_id=$1 AND (tenant_character=$2 OR landlord_character=$2) AND status IN ('active','landlord_closed') ORDER BY id FOR UPDATE", [depot.id, characterId]);
    for (const row of rows) {
      if (row.tenant_character === characterId) {
        const held = Number(row.held_qty);
        await client.query("UPDATE business_warehouse_leases SET held_qty=0,status='tenant_dead' WHERE id=$1", [row.id]);
        if (held) await bookDepot(client, depot, 'warehouse_tenant_death', { leaseId: row.id, leaseStock: -held, leaseStockAfter: 0, customerId: characterId });
      } else await client.query("UPDATE business_warehouse_leases SET status='landlord_closed' WHERE id=$1", [row.id]);
    }
  }
}


