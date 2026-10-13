import crypto from 'node:crypto';
import { GameError } from './game.js';
import { DISTRICTS, GOODS } from './rules.js';
import { depotBoard } from './depot.js';
import { warehouseOffers } from './warehouseleases.js';
import { supplyTenderBoard } from './supplytenders.js';
import { publicEmploymentOffers } from './gameemployment.js';

export const COMPANY_OPPORTUNITIES = Object.freeze({ kinds: ['depot', 'warehouse', 'delivery', 'tender', 'employment'], sourceLimit: 100, inboxLimit: 100, refreshLimit: 20, pageLimit: 50 });
const kindNames = Object.freeze({ depot: 'Storefront offers', warehouse: 'Storage offers', delivery: 'Delivery contracts', tender: 'Supply tenders', employment: 'Paid jobs' });
const fail = reason => { throw new GameError('company_opportunity', reason); };
const closed = (body, fields) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) fail('terms');
};
const person = ch => { if (!ch?.alive || ch.is_npc || !ch.account_id) fail('character'); };
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const iso = value => new Date(value).toISOString();
const filtersOf = body => {
  if (typeof body.enabled !== 'boolean' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision >= 2147483647
      || !Array.isArray(body.kinds) || body.kinds.length < 1 || body.kinds.length > 5 || new Set(body.kinds).size !== body.kinds.length
      || body.kinds.some(kind => !COMPANY_OPPORTUNITIES.kinds.includes(kind))
      || !(body.district === null || DISTRICTS.some(d => d.id === body.district))
      || !(body.good === null || GOODS.some(g => g.id === body.good))) fail('filters');
  return { kinds: [...body.kinds].sort(), district: body.district, good: body.good };
};

// Caller owns a transaction and canonical character lock. This account preference
// grants no gameplay execution, capital control or external messaging authority.
export async function setCompanyOpportunitySubscription(ch, body, client) {
  person(ch); closed(body, ['enabled', 'expectedRevision', 'kinds', 'district', 'good']);
  const filters = filtersOf(body);
  const previous = (await client.query('SELECT * FROM company_opportunity_subscriptions WHERE account_id=$1 FOR UPDATE', [ch.account_id])).rows[0];
  if (Number(previous?.revision || 0) !== body.expectedRevision) fail('revision');
  const revision = body.expectedRevision + 1;
  if (previous) await client.query('UPDATE company_opportunity_subscriptions SET enabled=$2,revision=$3,filters=$4,next_refresh_at=clock_timestamp() WHERE account_id=$1', [ch.account_id, body.enabled, revision, JSON.stringify(filters)]);
  else await client.query('INSERT INTO company_opportunity_subscriptions(account_id,enabled,revision,filters) VALUES($1,$2,$3,$4)', [ch.account_id, body.enabled, revision, JSON.stringify(filters)]);
  return { ok: true, enabled: body.enabled, revision, ...filters };
}

async function districtOf(client, depotId) {
  return (await client.query('SELECT district FROM business_depots WHERE id=$1', [depotId])).rows[0]?.district || null;
}
function source(kind, id, district, good, quote) {
  const snapshot = { kind, sourceId: id, district, good, quote };
  return { ...snapshot, sourceHash: hash(snapshot) };
}
async function sources(client, ch, filters) {
  const result = [];
  for (const kind of filters.kinds) {
    let offers = [];
    if (kind === 'depot') offers = (await depotBoard(client)).map(row => source(kind, row.id, row.district, row.good,
      { stock: row.stock, unitPrice: row.unitPrice }));
    if (kind === 'warehouse') offers = (await warehouseOffers(client)).map(row => source(kind, row.depotId, row.district, row.good,
      { availableUnits: row.availableUnits, cashPerUnitDay: row.cashPerUnitDay, offerRevision: row.offerRevision, termHours: row.termHours }));
    if (kind === 'delivery') {
      // Public market-order projection only. Do not load private commitments, cars,
      // auction bids/reserves or unbounded marketBoard auxiliary collections.
      const rows = (await client.query("SELECT l.id,l.good_id,l.district,l.qty,l.price,l.expires_at FROM market_listings l JOIN characters c ON c.id=l.seller_character WHERE l.kind='order' AND l.status='live' AND l.expires_at>clock_timestamp() ORDER BY l.expires_at,l.id LIMIT 100")).rows;
      for (const row of rows) {
        const reserved = Number((await client.query("SELECT COALESCE(SUM(remaining),0) AS qty FROM delivery_commitments WHERE order_id=$1 AND status='accepted' AND deadline>clock_timestamp()", [row.id])).rows[0].qty);
        const wanted = Math.max(0, Number(row.qty) - reserved);
        if (wanted) offers.push(source(kind, row.id, row.district, row.good_id, { wanted, unitPrice: Number(row.price), expiresAt: iso(row.expires_at) }));
      }
    }
    if (kind === 'tender') {
      for (const row of (await supplyTenderBoard(client, ch)).tenders) {
        // The canonical board can include ownOffer and owner-only bids. Deliberately
        // construct a public-only quote instead of spreading its richer view.
        offers.push(source(kind, row.id, await districtOf(client, row.depotId), 'gin',
          { qty: row.qty, unitPrice: row.unitPrice, offersCloseAt: row.offersCloseAt }));
      }
    }
    if (kind === 'employment') {
      for (const row of await publicEmploymentOffers(client)) offers.push(source(kind, row.id, await districtOf(client, row.depot_id), 'gin',
        { slots: row.terms.slots, wageCash: row.terms.wageCash, acceptHumans: row.terms.acceptHumans,
          acceptAgents: row.terms.acceptAgents, expiresAt: row.terms.expiresAt }));
    }
    for (const offer of offers.slice(0, COMPANY_OPPORTUNITIES.sourceLimit)) {
      if ((!filters.district || offer.district === filters.district) && (!filters.good || offer.good === filters.good)) result.push(offer);
    }
  }
  return result;
}

export async function refreshCompanyOpportunities(ch, client) {
  person(ch);
  const subscription = (await client.query('SELECT * FROM company_opportunity_subscriptions WHERE account_id=$1 FOR UPDATE', [ch.account_id])).rows[0];
  if (!subscription?.enabled) return { ok: true, refreshed: false, emitted: 0 };
  const offers = await sources(client, ch, subscription.filters);
  const inbox = (await client.query('SELECT * FROM company_opportunity_notices WHERE account_id=$1 ORDER BY id LIMIT 100 FOR UPDATE', [ch.account_id])).rows;
  let emitted = 0, full = false;
  for (const offer of offers) {
    const previous = inbox.find(row => row.kind === offer.kind && row.source_id === offer.sourceId);
    if (previous?.source_hash === offer.sourceHash) continue;
    if (emitted >= COMPANY_OPPORTUNITIES.refreshLimit) break;
    if (previous) await client.query('UPDATE company_opportunity_notices SET source_hash=$3,snapshot=$4,updated_at=clock_timestamp(),acknowledged_at=NULL WHERE id=$1 AND account_id=$2', [previous.id, ch.account_id, offer.sourceHash, JSON.stringify(offer)]);
    else {
      if (inbox.length >= COMPANY_OPPORTUNITIES.inboxLimit) {
        const retired = inbox.find(row => row.acknowledged_at && !offers.some(current => current.kind === row.kind && current.sourceId === row.source_id));
        if (!retired) { full = true; continue; }
        await client.query('DELETE FROM company_opportunity_notices WHERE id=$1 AND account_id=$2', [retired.id, ch.account_id]);
        inbox.splice(inbox.indexOf(retired), 1);
      }
      const id = crypto.randomUUID();
      await client.query('INSERT INTO company_opportunity_notices(id,account_id,kind,source_id,source_hash,snapshot) VALUES($1,$2,$3,$4,$5,$6)', [id, ch.account_id, offer.kind, offer.sourceId, offer.sourceHash, JSON.stringify(offer)]);
      inbox.push({ id, kind: offer.kind, source_id: offer.sourceId });
    }
    emitted++;
  }
  await client.query("UPDATE company_opportunity_subscriptions SET next_refresh_at=clock_timestamp()+interval '300 seconds' WHERE account_id=$1", [ch.account_id]);
  return { ok: true, refreshed: true, emitted, inboxFull: full, observed: offers.length,
    sourceWindowPerKind: COMPANY_OPPORTUNITIES.sourceLimit, quotesInformational: true };
}

export async function companyOpportunityInbox(ch, query, client) {
  person(ch); closed(query, ['limit', 'after']);
  if (query.limit !== undefined && typeof query.limit !== 'number' && !(typeof query.limit === 'string' && /^[0-9]+$/.test(query.limit))) fail('pagination');
  const limit = query.limit === undefined ? 25 : Number(query.limit), after = query.after === undefined ? '' : query.after;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > COMPANY_OPPORTUNITIES.pageLimit
      || typeof after !== 'string' || (after && !/^[0-9a-f-]{36}$/.test(after))) fail('pagination');
  const subscription = (await client.query('SELECT * FROM company_opportunity_subscriptions WHERE account_id=$1', [ch.account_id])).rows[0];
  const current = subscription?.enabled ? await sources(client, ch, subscription.filters) : [];
  const rows = (await client.query('SELECT * FROM company_opportunity_notices WHERE account_id=$1 AND id>$2 ORDER BY id LIMIT $3', [ch.account_id, after, limit + 1])).rows;
  const notices = rows.slice(0, limit).map(row => {
    const visible = current.find(offer => offer.kind === row.kind && offer.sourceId === row.source_id);
    const expires = row.snapshot.quote.expiresAt || row.snapshot.quote.offersCloseAt;
    const status = expires && +new Date(expires) <= Date.now() ? 'expired'
      : visible ? (visible.sourceHash === row.source_hash ? 'observed' : 'changed') : 'not_observed';
    return { id: row.id, kind: row.kind, kindName: kindNames[row.kind], sourceId: row.source_id, sourceHash: row.source_hash,
      status, quote: status === 'observed' ? visible : null, updatedAt: iso(row.updated_at),
      acknowledged: row.acknowledged_at !== null, informational: true };
  });
  return { ok: true, subscription: subscription ? { enabled: subscription.enabled, revision: Number(subscription.revision), ...subscription.filters } : null,
    notices, nextCursor: rows.length > limit ? notices.at(-1).id : null, inboxLimit: COMPANY_OPPORTUNITIES.inboxLimit,
    visibility: 'current bounded public snapshot; not_observed does not assert closure', quotesInformational: true };
}

export async function acknowledgeCompanyOpportunity(ch, body, client) {
  person(ch); closed(body, ['noticeId', 'expectedHash']);
  if (typeof body.noticeId !== 'string' || !/^[0-9a-f-]{36}$/.test(body.noticeId)
      || typeof body.expectedHash !== 'string' || !/^[0-9a-f]{64}$/.test(body.expectedHash)) fail('acknowledgment');
  const row = (await client.query('SELECT * FROM company_opportunity_notices WHERE id=$1 AND account_id=$2 FOR UPDATE', [body.noticeId, ch.account_id])).rows[0];
  if (!row) fail('notice');
  if (row.source_hash !== body.expectedHash) fail('notice_changed');
  if (!row.acknowledged_at) await client.query('UPDATE company_opportunity_notices SET acknowledged_at=clock_timestamp() WHERE id=$1 AND account_id=$2', [row.id, ch.account_id]);
  return { ok: true, noticeId: row.id, sourceHash: row.source_hash, acknowledged: true };
}

export async function dueCompanyOpportunitySubscriptions(client, limit = 25) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) fail('candidate_limit');
  return (await client.query('SELECT s.account_id,s.revision,s.next_refresh_at FROM company_opportunity_subscriptions s WHERE s.enabled AND s.next_refresh_at<=clock_timestamp() ORDER BY s.next_refresh_at,s.account_id LIMIT $1', [limit])).rows;
}
