import crypto from 'node:crypto';
import { GameError } from './game.js';
import { bookDepot } from './depotbook.js';

export const FRANCHISE = Object.freeze({ maxBps: 1000, maxCap: 1000000, maxEarnedNet: 1000000000000,
  maxSaleNet: 40000000, maxTermMs: 30 * 86400000, preset: 'gin_storefront' });
const fail = message => { throw new GameError('franchise_terms', message); };
const integer = (value, min, max) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('Use bounded whole-number franchise terms.');
  return value;
};
const clock = value => {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') fail('Use a valid franchise clock.');
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) fail('Use a valid franchise clock.');
  return ms;
};

export function franchiseLicenseTerms(body, now = Date.now()) {
  const keys = ['companyRevision', 'presetId', 'royaltyBps', 'royaltyCap', 'expiresAt'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== keys.length
      || Object.keys(body).some(key => !keys.includes(key)) || body.presetId !== FRANCHISE.preset)
    fail('Provide exact brand/preset licence terms.');
  const current = clock(now), expires = clock(body.expiresAt);
  if (expires <= current || expires - current > FRANCHISE.maxTermMs) fail('Use a future licence expiry within thirty days.');
  return { companyRevision: integer(body.companyRevision, 1, 2147483647), presetId: body.presetId,
    royaltyBps: integer(body.royaltyBps, 1, FRANCHISE.maxBps), royaltyCap: integer(body.royaltyCap, 1, FRANCHISE.maxCap),
    expiresAt: new Date(expires).toISOString() };
}

// Quote only canonical retail net proceeds: after market fees, before inventory cost.
// Callers must prove the source sale journal and independently held depot locks.
export function franchiseRoyalty(row, net, now = Date.now()) {
  const current = clock(now), expires = clock(row?.expires_at);
  if (!['offered', 'active', 'ended'].includes(row?.status)) fail('Invalid licence lifecycle.');
  const bps = integer(Number(row.royalty_bps), 1, FRANCHISE.maxBps);
  const cap = integer(Number(row.royalty_cap), 1, FRANCHISE.maxCap);
  const paid = integer(Number(row.paid), 0, cap);
  const earned = integer(Number(row.earned_net), 0, FRANCHISE.maxEarnedNet);
  integer(net, 1, FRANCHISE.maxSaleNet);
  if (row.status !== 'active' || expires <= current || paid === cap)
    return { royaltyCash: 0, earnedNet: earned, paidCash: paid, eligible: false };
  const next = integer(earned + net, 0, FRANCHISE.maxEarnedNet);
  const incremental = Number((BigInt(next) * BigInt(bps) / 10000n) - (BigInt(earned) * BigInt(bps) / 10000n));
  const royaltyCash = Math.min(cap - paid, incremental);
  return { royaltyCash, earnedNet: next, paidCash: paid + royaltyCash, eligible: true };
}

export function franchiseLicenseView(row) {
  return { id: row.id, operatorDepotId: row.operator_depot_id, recipientDepotId: row.recipient_depot_id,
    brandName: row.brand_name, presetId: row.preset_id, companyRevision: Number(row.company_revision),
    royaltyBps: Number(row.royalty_bps), royaltyCap: Number(row.royalty_cap), paidCash: Number(row.paid),
    earnedNet: Number(row.earned_net), createdAt: new Date(clock(row.created_at)).toISOString(),
    expiresAt: new Date(clock(row.expires_at)).toISOString(), status: row.status,
    royaltyBasis: 'retail_net_after_market_fee_before_inventory_cost', gameCashOnly: true };
}

const saleContexts = new WeakMap();
const intake = () => { if (process.env.DEPOT_PILOT !== 'on') throw new GameError('pilot_disabled', 'The supply-depot pilot is not open.'); };
async function lockedDepots(client, ids) {
  const rows = [];
  for (const id of [...new Set(ids)].sort()) {
    const row = (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!row) throw new GameError('no_depot', 'A recorded licence depot was not found.');
    rows.push(row);
  }
  return rows;
}
function independent(licensor, operator, recipient, depot) {
  if (!licensor?.alive || !operator?.alive || !licensor.account_id || !operator.account_id
      || licensor.id === operator.id || licensor.account_id === operator.account_id
      || recipient.id === depot.id || recipient.owner_character !== licensor.id || depot.owner_character !== operator.id
      || recipient.status !== 'open' || depot.status !== 'open')
    throw new GameError('franchise_owner', 'Two independently owned open depots and living owners are required.');
}
async function lockedLicense(client, id) {
  const hint = (await client.query('SELECT operator_depot_id,recipient_depot_id FROM depot_brand_licenses WHERE id=$1', [id])).rows[0];
  if (!hint) throw new GameError('franchise_missing', 'That licence was not found.');
  const depots = await lockedDepots(client, [hint.operator_depot_id, hint.recipient_depot_id]);
  const row = (await client.query('SELECT * FROM depot_brand_licenses WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!row || row.operator_depot_id !== hint.operator_depot_id || row.recipient_depot_id !== hint.recipient_depot_id)
    throw new GameError('franchise_missing', 'Recorded licence depots changed.');
  return { row, operator: depots.find(d => d.id === row.operator_depot_id), recipient: depots.find(d => d.id === row.recipient_depot_id) };
}

// Routes retain established direct-control guards and sorted account/actor locks.
export async function offerFranchiseLicense(licensor, operator, recipientDepotId, operatorDepotId, body, client) {
  intake(); const now = new Date(), terms = franchiseLicenseTerms(body, now);
  const depots = await lockedDepots(client, [recipientDepotId, operatorDepotId]);
  const recipient = depots.find(d => d.id === recipientDepotId), depot = depots.find(d => d.id === operatorDepotId);
  independent(licensor, operator, recipient, depot);
  const company = (await client.query('SELECT * FROM agent_company_profiles WHERE account_id=$1', [licensor.account_id])).rows[0];
  if (!company?.published || Number(company.revision) !== terms.companyRevision || typeof company.name !== 'string')
    throw new GameError('franchise_company', 'Refresh the published company brand revision.');
  const row = { id: crypto.randomUUID(), operator_depot_id: depot.id, operator_character: operator.id,
    recipient_depot_id: recipient.id, licensor_character: licensor.id, company_account_id: licensor.account_id,
    company_revision: terms.companyRevision, brand_name: company.name, preset_id: terms.presetId,
    royalty_bps: terms.royaltyBps, royalty_cap: terms.royaltyCap, paid: 0, earned_net: 0,
    expires_at: new Date(terms.expiresAt), status: 'offered', created_at: now };
  await client.query("INSERT INTO depot_brand_licenses(id,operator_depot_id,operator_character,recipient_depot_id,licensor_character,company_account_id,company_revision,brand_name,preset_id,royalty_bps,royalty_cap,paid,earned_net,expires_at,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,$12,'offered',$13)",
    [row.id, depot.id, operator.id, recipient.id, licensor.id, licensor.account_id, row.company_revision, row.brand_name,
      row.preset_id, row.royalty_bps, row.royalty_cap, row.expires_at, now]);
  return { ok: true, license: franchiseLicenseView(row) };
}

export async function acceptFranchiseLicense(operator, licensor, licenseId, client) {
  intake(); const { row, operator: depot, recipient } = await lockedLicense(client, licenseId);
  independent(licensor, operator, recipient, depot);
  if (row.operator_character !== operator.id || row.licensor_character !== licensor.id
      || row.company_account_id !== licensor.account_id) throw new GameError('franchise_owner', 'The recorded parties must consent.');
  if (clock(row.expires_at) <= Date.now() || !['offered', 'active'].includes(row.status))
    throw new GameError('franchise_ended', 'That licence can no longer be accepted.');
  if (row.status === 'active') return { ok: true, license: franchiseLicenseView(row) };
  // The operator depot lock serializes acceptance, including expired active rows.
  const active = (await client.query("SELECT * FROM depot_brand_licenses WHERE operator_depot_id=$1 AND status='active' FOR UPDATE", [depot.id])).rows;
  for (const prior of active) {
    if (clock(prior.expires_at) > Date.now()) throw new GameError('franchise_active', 'End the current active licence first.');
    await client.query("UPDATE depot_brand_licenses SET status='ended' WHERE id=$1", [prior.id]);
  }
  await client.query("UPDATE depot_brand_licenses SET status='active' WHERE id=$1", [row.id]); row.status = 'active';
  return { ok: true, license: franchiseLicenseView(row) };
}

export async function endFranchiseLicense(actor, licenseId, client) {
  intake(); const { row, operator, recipient } = await lockedLicense(client, licenseId);
  if (!actor?.alive || ![row.operator_character, row.licensor_character].includes(actor.id)
      || (actor.id === row.operator_character ? operator.owner_character : recipient.owner_character) !== actor.id)
    throw new GameError('franchise_owner', 'Only a recorded living owner can end this licence.');
  if (row.status !== 'ended') await client.query("UPDATE depot_brand_licenses SET status='ended' WHERE id=$1", [row.id]);
  row.status = 'ended'; return { ok: true, license: franchiseLicenseView(row) };
}

// Must precede the existing operator asset lock. The opaque context is tied to
// this SQL client and immutable depot ids; no body can invent royalty authority.
export async function prepareFranchiseSale(client, operatorDepotId) {
  const hint = (await client.query("SELECT id,recipient_depot_id FROM depot_brand_licenses WHERE operator_depot_id=$1 AND status='active'", [operatorDepotId])).rows[0];
  const rows = await lockedDepots(client, hint ? [operatorDepotId, hint.recipient_depot_id] : [operatorDepotId]);
  let row = null;
  if (hint) {
    row = (await client.query('SELECT * FROM depot_brand_licenses WHERE id=$1 FOR UPDATE', [hint.id])).rows[0];
    if (!row || row.operator_depot_id !== operatorDepotId || row.recipient_depot_id !== hint.recipient_depot_id)
      throw new GameError('franchise_missing', 'Recorded licence depots changed.');
  }
  const context = Object.freeze({});
  saleContexts.set(context, { client, licenseId: row?.id || null, operatorId: operatorDepotId, recipientId: row?.recipient_depot_id || null });
  return { context, operator: rows.find(d => d.id === operatorDepotId) };
}

export async function settleFranchiseSale(client, context, saleJournalId) {
  const proof = saleContexts.get(context);
  if (!proof || proof.client !== client) throw new GameError('franchise_proof', 'A prepared native sale is required.');
  if (!proof.licenseId) return { royaltyCash: 0 };
  const sale = (await client.query('SELECT * FROM business_depot_journal WHERE id=$1 FOR UPDATE', [saleJournalId])).rows[0];
  if (!sale || sale.depot_id !== proof.operatorId || sale.reason !== 'sale' || !sale.customer_character
      || !(Number(sale.stock_delta) < 0) || !(Number(sale.cash_delta) > 0))
    throw new GameError('franchise_proof', 'Only canonical customer sale proceeds may bear royalties.');
  const previous = (await client.query("SELECT cash_delta FROM business_depot_journal WHERE franchise_license_id=$1 AND source_journal_id=$2 AND reason='royalty_income'", [proof.licenseId, sale.id])).rows[0];
  if (previous) return { royaltyCash: Number(previous.cash_delta), replayed: true };
  const row = (await client.query('SELECT * FROM depot_brand_licenses WHERE id=$1 FOR UPDATE', [proof.licenseId])).rows[0];
  // Refresh rows after bookDepot's absolute full-sale write, never overwrite it
  // using the pre-sale prepare snapshot.
  const depots = await lockedDepots(client, [proof.operatorId, proof.recipientId]);
  const operator = depots.find(d => d.id === proof.operatorId), recipient = depots.find(d => d.id === proof.recipientId);
  if (!row || row.operator_depot_id !== operator.id || row.recipient_depot_id !== recipient.id
      || operator.owner_character !== row.operator_character || recipient.owner_character !== row.licensor_character
      || operator.status !== 'open' || recipient.status !== 'open') return { royaltyCash: 0 };
  const owners = (await client.query('SELECT id,alive,account_id FROM characters WHERE id IN ($1,$2)', [row.operator_character, row.licensor_character])).rows;
  if (owners.length !== 2 || owners.some(owner => !owner.alive) || owners[0].account_id === owners[1].account_id) return { royaltyCash: 0 };
  const quote = franchiseRoyalty(row, Number(sale.cash_delta));
  if (!quote.eligible) return { royaltyCash: 0 };
  const links = { sourceJournalId: sale.id, franchiseLicenseId: row.id };
  await bookDepot(client, operator, 'royalty_expense', { cash: -quote.royaltyCash, expense: quote.royaltyCash, ...links });
  await bookDepot(client, recipient, 'royalty_income', { cash: quote.royaltyCash, ...links });
  await client.query('UPDATE depot_brand_licenses SET paid=$2,earned_net=$3 WHERE id=$1', [row.id, quote.paidCash, quote.earnedNet]);
  return { royaltyCash: quote.royaltyCash };
}
