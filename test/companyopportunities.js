import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeDb } from '../src/db.js';
import * as O from '../src/companyopportunities.js';
const native = process.argv.includes('--postgres'); let nativeVersion;
assert(!process.env.DATABASE_URL, 'Refuse ambient database endpoints');
function nativeEndpoint(value) {
  const url = new URL(value);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1'); assert(!url.search && !url.hash);
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci); assert(/^\/company_opportunity_[a-z0-9_]+$/.test(url.pathname)); return { url, local };
}
for (const refused of ['postgresql://pilot_runner@remote:35449/company_opportunity_test_guard', 'postgresql://pilot_runner@127.0.0.1:35449/omerta', 'postgresql://postgres:wrong@127.0.0.1:5432/company_opportunity_test_guard', 'postgresql://pilot_runner@127.0.0.1:35449/company_opportunity_test_guard?host=remote']) assert.throws(() => nativeEndpoint(refused));
if (native) {
  const { url, local } = nativeEndpoint(process.env.COMPANY_OPPORTUNITY_TEST_DATABASE_URL);
  const { default: pg } = await import('pg'), pre = new pg.Pool({ connectionString: url.href });
  try {
    nativeVersion = (await pre.query('SHOW server_version')).rows[0].server_version;
    assert.match(nativeVersion, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0, 'Fresh owned public namespace required');
  } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
}
process.env.DEPOT_PILOT = 'on';
const pool = await makeDb();
const account = crypto.randomUUID(), character = crypto.randomUUID(), otherAccount = crypto.randomUUID(), otherCharacter = crypto.randomUUID();
const ch = { id: character, account_id: account, alive: true, is_npc: false }, other = { ...ch, id: otherCharacter, account_id: otherAccount };
const tx = async fn => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); await client.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE', [character]);
    const result = await fn(client); await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
};
const subscription = { enabled: true, expectedRevision: 0, kinds: ['depot', 'warehouse', 'delivery', 'tender', 'employment'], district: null, good: 'gin' };
const expiry = new Date(Date.now() + 3600000);
try {
  for (const [id, cid] of [[account, character], [otherAccount, otherCharacter]]) {
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [id, 'guest']);
    await pool.query('INSERT INTO characters(id,account_id,name,season) VALUES($1,$2,$1,1)', [cid, id]);
  }
  await pool.query("INSERT INTO business_depots(id,owner_character,district,stock,sale_price,bid_price,target_stock,reorder_at,restock_budget,warehouse_enabled,warehouse_revision,warehouse_slots,warehouse_cash_per_unit_day) VALUES('opportunity-depot',$1,'docks',2,1000,500,4,0,3000,true,1,10,10)", [character]);
  await pool.query("INSERT INTO market_listings(id,seller_character,depot_id,kind,good_id,district,qty,price,expires_at) VALUES('opportunity-order',$1,'opportunity-depot','order','gin','docks',4,500,$2)", [character, expiry]);
  await pool.query("INSERT INTO supply_tenders(id,order_id,depot_id,buyer_character,qty,unit_price,offers_close_at) VALUES('opportunity-tender','opportunity-order','opportunity-depot',$1,2,500,$2)", [character, expiry]);
  await pool.query("INSERT INTO supply_tender_offers(id,tender_id,supplier_character,qty,unit_price,spend_limit,accept_until,delivery_deadline) VALUES('private-bid','opportunity-tender',$1,2,500,54321,$2,$3)", [otherCharacter, expiry, new Date(+expiry + 120000)]);
  await pool.query("INSERT INTO agent_company_profiles(account_id,revision,name,published) VALUES($1,1,'Private company',false)", [account]);
  const terms = { depotId: 'opportunity-depot', slots: 2, wageCash: 100, acceptHumans: true, acceptAgents: true, expiresAt: expiry.toISOString() };
  await pool.query("INSERT INTO game_employment_jobs(id,depot_id,employer_character,employer_account,terms,total_cash,escrow_cash,expires_at) VALUES('private-employment','opportunity-depot',$1,$2,$3,200,200,$4)", [character, account, JSON.stringify(terms), expiry]);
  assert.equal((await O.refreshCompanyOpportunities(ch, pool)).refreshed, false, 'no opt-in means no inbox writes');
  for (const invalid of [{ url: 'https://arbitrary.invalid' }, { kinds: ['unknown'] }, { district: 'secret' }, { good: 'unknown' }, { kinds: ['depot', 'depot'] }])
    await assert.rejects(tx(db => O.setCompanyOpportunitySubscription(ch, { ...subscription, ...invalid }, db)), /terms|filters/);
  const capitalBefore = (await pool.query('SELECT cash,bank FROM characters WHERE id=$1', [character])).rows[0];
  await tx(db => O.setCompanyOpportunitySubscription(ch, subscription, db));
  await assert.rejects(tx(db => O.setCompanyOpportunitySubscription(ch, subscription, db)), /revision/);
  const refreshed = native ? await Promise.all([tx(db => O.refreshCompanyOpportunities(ch, db)), tx(db => O.refreshCompanyOpportunities(ch, db))]) : [await tx(db => O.refreshCompanyOpportunities(ch, db))];
  assert.equal(refreshed.reduce((n, r) => n + r.emitted, 0), 4, 'same-source concurrent refresh emits once');
  let inbox = await O.companyOpportunityInbox(ch, { limit: 50 }, pool);
  assert.equal(inbox.notices.length, 4);
  assert.equal(inbox.notices.some(n => n.kind === 'employment'), false, 'unpublished employment is never copied');
  const serialized = JSON.stringify(inbox);
  for (const forbidden of ['54321', 'private-bid', 'spend_limit', 'maxProcurementCash', 'winningOfferId', 'escrow_cash', 'Private company']) assert.equal(serialized.includes(forbidden), false, forbidden);
  const page = await O.companyOpportunityInbox(ch, { limit: 2 }, pool);
  assert.equal(page.notices.length, 2); assert(page.nextCursor);
  const next = await O.companyOpportunityInbox(ch, { limit: 2, after: page.nextCursor }, pool);
  assert.equal(new Set([...page.notices, ...next.notices].map(n => n.id)).size, 4);
  await assert.rejects(O.companyOpportunityInbox(ch, { limit: 51 }, pool), /pagination/);
  await assert.rejects(O.companyOpportunityInbox(ch, { limit: [1] }, pool), /pagination/);
  await assert.rejects(O.companyOpportunityInbox(ch, { after: false }, pool), /pagination/);
  await assert.rejects(O.companyOpportunityInbox(ch, { sql: 'SELECT secret' }, pool), /terms/);
  assert.equal((await O.companyOpportunityInbox(other, {}, pool)).notices.length, 0);
  const notice = inbox.notices.find(n => n.kind === 'depot'), acknowledgment = { noticeId: notice.id, expectedHash: notice.sourceHash };
  await assert.rejects(tx(db => O.acknowledgeCompanyOpportunity(other, acknowledgment, db)), /notice/);
  await tx(db => O.acknowledgeCompanyOpportunity(ch, acknowledgment, db));
  assert.deepEqual(await tx(db => O.acknowledgeCompanyOpportunity(ch, acknowledgment, db)), { ok: true, noticeId: notice.id, sourceHash: notice.sourceHash, acknowledged: true });
  assert.equal((await tx(db => O.refreshCompanyOpportunities(ch, db))).emitted, 0);
  assert.equal((await O.companyOpportunityInbox(ch, {}, pool)).notices.find(n => n.id === notice.id).acknowledged, true, 'event hash replay preserves acknowledgment');
  await pool.query('UPDATE business_depots SET sale_price=1100 WHERE id=$1', ['opportunity-depot']);
  assert.equal((await O.companyOpportunityInbox(ch, {}, pool)).notices.find(n => n.id === notice.id).status, 'changed');
  await tx(db => O.refreshCompanyOpportunities(ch, db));
  await assert.rejects(tx(db => O.acknowledgeCompanyOpportunity(ch, acknowledgment, db)), /notice_changed/);
  await pool.query('UPDATE agent_company_profiles SET published=true WHERE account_id=$1', [account]);
  await tx(db => O.refreshCompanyOpportunities(ch, db));
  inbox = await O.companyOpportunityInbox(ch, {}, pool);
  assert.equal(inbox.notices.filter(n => n.kind === 'employment').length, 1);
  await pool.query('UPDATE agent_company_profiles SET published=false WHERE account_id=$1', [account]);
  const hidden = (await O.companyOpportunityInbox(ch, {}, pool)).notices.find(n => n.kind === 'employment');
  assert.equal(hidden.status, 'not_observed'); assert.equal(hidden.quote, null, 'current privacy revocation redacts cached quote');
  await pool.query('UPDATE market_listings SET expires_at=$2 WHERE id=$1', ['opportunity-order', new Date(Date.now() - 1000)]);
  const missing = (await O.companyOpportunityInbox(ch, {}, pool)).notices.find(n => n.kind === 'delivery');
  assert.equal(missing.status, 'not_observed'); assert.equal(missing.quote, null, 'disappearance never claims expiry without a known expired quote');
  await pool.query('UPDATE supply_tenders SET offers_close_at=$2 WHERE id=$1', ['opportunity-tender', new Date(Date.now() - 1000)]);
  assert.equal((await O.companyOpportunityInbox(ch, {}, pool)).notices.find(n => n.kind === 'tender').quote, null);
  const shortExpiry = new Date(Date.now() + 250);
  await pool.query("INSERT INTO market_listings(id,seller_character,kind,good_id,district,qty,price,expires_at) VALUES('known-expiry',$1,'order','gin','docks',1,500,$2)", [character, shortExpiry]);
  await tx(db => O.refreshCompanyOpportunities(ch, db));
  assert.equal((await O.companyOpportunityInbox(ch, {}, pool)).notices.find(n => n.sourceId === 'known-expiry').status, 'observed');
  await new Promise(resolve => setTimeout(resolve, 275));
  const expired = (await O.companyOpportunityInbox(ch, {}, pool)).notices.find(n => n.sourceId === 'known-expiry');
  assert.equal(expired.status, 'expired'); assert.equal(expired.quote, null, 'known captured deadline proves expiry honestly');
  if (native) {
    await pool.query('UPDATE business_depots SET sale_price=1200 WHERE id=$1', ['opportunity-depot']);
    const hashBefore = (await pool.query('SELECT source_hash FROM company_opportunity_notices WHERE id=$1', [notice.id])).rows[0].source_hash;
    await assert.rejects(tx(db => O.refreshCompanyOpportunities(ch, { query: (sql, args) => {
      if (sql.startsWith('UPDATE company_opportunity_subscriptions SET next_refresh_at')) throw new Error('injected refresh failure');
      return db.query(sql, args);
    } })), /injected/);
    assert.equal((await pool.query('SELECT source_hash FROM company_opportunity_notices WHERE id=$1', [notice.id])).rows[0].source_hash, hashBefore, 'native refresh rollback keeps prior event');
  }
  await tx(db => O.setCompanyOpportunitySubscription(ch, { ...subscription, expectedRevision: 1, district: 'neon' }, db));
  assert.equal((await O.companyOpportunityInbox(ch, {}, pool)).notices.every(n => n.quote === null), true, 'owner filters are applied at read time');
  assert.equal((await tx(db => O.refreshCompanyOpportunities(ch, db))).emitted, 0);
  await tx(db => O.setCompanyOpportunitySubscription(ch, { ...subscription, expectedRevision: 2, enabled: false }, db));
  assert.equal((await tx(db => O.refreshCompanyOpportunities(ch, db))).refreshed, false);
  await assert.rejects(O.dueCompanyOpportunitySubscriptions(pool, 26), /candidate_limit/);
  await tx(db => O.setCompanyOpportunitySubscription(ch, { ...subscription, expectedRevision: 3, kinds: ['delivery'] }, db));
  for (let index = 0; index < 120; index++) await pool.query('INSERT INTO market_listings(id,seller_character,kind,good_id,district,qty,price,expires_at) VALUES($1,$2,$3,$4,$5,1,500,$6)',
    [`bulk-${String(index).padStart(3, '0')}`, character, 'order', 'gin', 'docks', expiry]);
  let full = false;
  for (let cycle = 0; cycle < 6; cycle++) {
    const result = await tx(db => O.refreshCompanyOpportunities(ch, db));
    assert(result.emitted <= 20); assert(result.observed <= 100); full ||= result.inboxFull;
    assert(Number((await pool.query('SELECT COUNT(*) AS n FROM company_opportunity_notices WHERE account_id=$1', [account])).rows[0].n) <= 100);
  }
  assert.equal(full, true, 'full bounded inbox is reported honestly');
  const firstFullPage = await O.companyOpportunityInbox(ch, { limit: 50 }, pool);
  const secondFullPage = await O.companyOpportunityInbox(ch, { limit: 50, after: firstFullPage.nextCursor }, pool);
  assert.equal(new Set([...firstFullPage.notices, ...secondFullPage.notices].map(n => n.id)).size, 100);
  const retired = [...firstFullPage.notices, ...secondFullPage.notices].find(n => n.kind === 'employment');
  await tx(db => O.acknowledgeCompanyOpportunity(ch, { noticeId: retired.id, expectedHash: retired.sourceHash }, db));
  assert.equal((await tx(db => O.refreshCompanyOpportunities(ch, db))).emitted, 1, 'only an acknowledged unobserved record is retired for bounded room');
  assert.equal((await O.dueCompanyOpportunitySubscriptions(pool, 1)).length, 0, 'finite refresh scheduling advances');
  if (native) {
    const revisions = await Promise.allSettled([
      tx(db => O.setCompanyOpportunitySubscription(ch, { ...subscription, expectedRevision: 4, kinds: ['delivery'], district: 'docks' }, db)),
      tx(db => O.setCompanyOpportunitySubscription(ch, { ...subscription, expectedRevision: 4, kinds: ['delivery'], district: 'neon' }, db)),
    ]);
    assert.equal(revisions.filter(r => r.status === 'fulfilled').length, 1, 'same-revision preference race accepts one update');
    assert.equal(revisions.filter(r => r.status === 'rejected' && /revision/.test(r.reason.message)).length, 1);
  }
  assert.deepEqual((await pool.query('SELECT cash,bank FROM characters WHERE id=$1', [character])).rows[0], capitalBefore, 'subscriptions never move funds');
  console.log(`company opportunities: public source visibility, private quote stripping, filters, bounded sources/emissions/inbox/pagination, acknowledgment/hash replay, disappearance and unchanged cash passed${native ? '; PostgreSQL concurrent dedup, preference revision race and atomic rollback passed' : ''}`);
} finally { await pool.end(); }
