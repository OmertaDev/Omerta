import assert from 'node:assert/strict';
import * as E from '../src/gameemployment.js';
import { employmentCashInvariant } from '../src/gameemploymentinvariants.js';
const native = process.argv.includes('--postgres');
assert(!process.env.DATABASE_URL, 'Employment proofs reject ambient DATABASE_URL');
if (native) {
  const url = new URL(process.env.GAME_EMPLOYMENT_TEST_DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1'); assert(['35439','35449'].includes(url.port));
  assert.equal(url.username, 'pilot_runner'); assert.match(url.pathname, /^\/employment_proof_[a-z0-9_]+$/);
  const { default: pg } = await import('pg'); const pre = new pg.Pool({ connectionString: url.href });
  try {
    const version = (await pre.query('SHOW server_version')).rows[0].server_version; assert.match(version, /^18\.4/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
  } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
}
process.env.DEPOT_PILOT = 'on'; process.env.DELIVERY_CONTRACTS = 'on'; process.env.RATE_LIMIT = 'off';
process.env.SOCIAL_VERIFY_MODE = 'off'; process.env.JWT_SECRET = 'employment-local-isolated-test-secret';
process.env.MARKET_SEED = 'employment-local-native-seed'; process.env.MOD_KEY = 'employment-local-test-mod-key';
const { buildServer } = await import('../src/server.js'), G = await import('../src/game.js');
const D = await import('../src/depot.js'), M = await import('../src/market.js'), Delivery = await import('../src/delivery.js');
const { setAgentCompany } = await import('../src/agentcompany.js');
const { runEstate } = await import('../src/social/estate.js');
const app = await buildServer(); let serial = 0;
// Core worktree does not own server wiring. Exercise its actual route module
// using the server's signed JWT verifier; integrated builds already register it.
if (!app.hasRoute({ method:'GET',url:'/v1/company/employment' })) {
  const routes = await import('../src/routes/gameemployment.js');
  routes.register(app,{ pool:app.pool,auth:async req=>req.jwtVerify() });
}
if (!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
async function player() {
  const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const response = await app.inject({ method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${token}`, 'idempotency-key': `employment-character-${++serial}` }, payload: { name: `Employee ${serial}` } });
  assert.equal(response.statusCode, 200, response.body);
  const account = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub;
  const ch = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
  await app.pool.query('UPDATE characters SET cash=100000,last_accrued_at=$2 WHERE id=$1', [ch.id, new Date(Date.now()+3600000)]);
  return { id: ch.id, account, token };
}
const single = (p, fn) => G.withCharacter(app.pool, p.account, fn);
const pair = (p, other, fn) => G.withTwoCharacters(app.pool, p.account, other.id, fn, { meet: false });
const balance = async p => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.id])).rows[0].cash);
async function fixture(slots = 2) {
  const owner = await player(), worker = await player();
  await app.pool.query('INSERT INTO estates(account_id,tier) VALUES($1,1)', [owner.account]);
  await setAgentCompany(app.pool, owner.account, { expectedRevision: 0, name: `Employment Firm ${serial}`, published: true, premises: 'estate' });
  const depot = await single(owner, (ch, client, h) => D.openDepot(ch, { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 }, client, h));
  await single(owner, (ch, client, h) => D.fundDepot(ch, depot.id, 5000, client, h));
  const order = await single(owner, (ch, client, h) => D.restockDepot(ch, depot.id, client, h));
  const commitment = await single(worker, (ch, client) => Delivery.acceptDelivery(ch, order.id, { qty: 4, unitPrice: 500, maxProcurementCash: 5000, deadlineSeconds: 600 }, client));
  const terms = { depotId: depot.id, slots, wageCash: 100, acceptHumans: true, acceptAgents: true, expiresAt: new Date(Date.now()+1200000).toISOString() };
  const start = await balance(owner);
  const job = await single(owner, (ch, client, h) => E.createEmployment(ch, terms, 'create', client, h));
  assert.equal(await balance(owner), start-slots*100);
  const input = { employmentId: job.employmentId, commitmentId: commitment.id, consent: true };
  await pair(worker, owner, (ch, other, client, h) => E.acceptEmployment(ch, other, input, 'accept', client, h));
  return { owner, worker, depot, order, commitment, terms, job, input };
}
async function deliver(f) {
  await app.pool.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',4)", [f.worker.id]);
  const loc = (await app.pool.query('SELECT district FROM market_listings WHERE id=$1', [f.order.id])).rows[0].district;
  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [f.worker.id, loc]);
  await single(f.worker, (ch, client, h) => Delivery.deliverCommitment(ch, f.commitment.id, 4, client, h));
}
const claim = (f, key='claim') => pair(f.worker, f.owner, (ch, other, client, h) => E.claimEmployment(ch, other, f.job.employmentId, f.commitment.id, key, client, h));
try {
  for (const bad of [0, -1, 6, 1.5, 2147483647, NaN]) {
    assert.throws(() => E.employmentTerms({ depotId:'depot',slots:bad,wageCash:100,acceptHumans:true,acceptAgents:true,expiresAt:new Date(Date.now()+600000).toISOString() }), /terms/);
  }
  const f = await fixture();
  const board = await app.inject({ method:'GET',url:'/v1/company/employment',headers:{authorization:`Bearer ${f.worker.token}`} });
  assert.equal(board.statusCode,200,board.body); assert.equal(board.json().employment.length,1);
  const invalid = await app.inject({ method:'POST',url:`/v1/company/employment/${f.job.employmentId}/accept`,headers:{authorization:`Bearer ${f.worker.token}`,'idempotency-key':'bad-fields'},payload:{commitmentId:f.commitment.id,consent:true,externalSpend:true} });
  assert.equal(invalid.statusCode,400,invalid.body);
  await assert.rejects(claim(f), /evidence/);
  await assert.rejects(single(f.owner, (ch, client, h) => E.closeEmployment(ch, f.job.employmentId, 'close', client, h)), /active_assignments/);
  await deliver(f); const cash = await balance(f.worker);
  if (native) {
    const results = await Promise.allSettled([claim(f, 'claim-a'), claim(f, 'claim-b')]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length, 1);
    const winner = results[0].status==='fulfilled' ? 'claim-a' : 'claim-b';
    assert.equal((await claim(f, winner)).replayed, true);
  } else { await claim(f); assert.equal((await claim(f)).replayed, true); await assert.rejects(claim(f,'again'), /evidence/); }
  assert.equal(await balance(f.worker), cash+100);
  await assert.rejects(single(f.owner, (ch, client, h) => E.createEmployment(ch, { ...f.terms, slots: 1 }, 'create', client, h)), /request_conflict/);
  await app.pool.query("UPDATE game_employment_jobs SET expires_at=now()-interval '1 second' WHERE id=$1", [f.job.employmentId]);
  const before = await balance(f.owner);
  await single(f.owner, (ch, client, h) => E.closeEmployment(ch, f.job.employmentId, 'close', client, h));
  assert.equal(await balance(f.owner), before+100);
  const book = (await app.pool.query('SELECT * FROM game_employment_jobs WHERE id=$1', [f.job.employmentId])).rows[0];
  assert.equal(Number(book.total_cash), Number(book.paid_cash)+Number(book.refunded_cash)+Number(book.escrow_cash)+Number(book.burned_cash));
  assert.equal(Number(book.escrow_cash), 0);
  // Assignment must precede all canonical delivery, and a commitment cannot back two slots.
  const duplicate = await single(f.owner, (ch, client, h) => E.createEmployment(ch, { ...f.terms, expiresAt: new Date(Date.now()+1200000).toISOString() }, 'second', client, h));
  await assert.rejects(pair(f.worker, f.owner, (ch, other, client, h) => E.acceptEmployment(ch, other, { ...f.input, employmentId: duplicate.employmentId }, 'second', client, h)), /eligibility/);
  const r = await fixture(1); const rollbackCash = await balance(r.worker); await deliver(r);
  const completedCash = await balance(r.worker); assert(completedCash > rollbackCash);
  if (native) {
    await assert.rejects(pair(r.worker, r.owner, async (ch, other, client, h) => { await E.claimEmployment(ch, other, r.job.employmentId, r.commitment.id, 'rollback', client, h); throw new Error('rollback'); }), /rollback/);
    assert.equal(await balance(r.worker), completedCash);
    assert.equal((await app.pool.query('SELECT state FROM game_employment_assignments WHERE commitment_id=$1',[r.commitment.id])).rows[0].state, 'assigned');
  }
  await claim(r); assert.equal(await balance(r.worker), completedCash+100);
  if (native) {
    const x = await fixture(1); await deliver(x);
    const holder = await app.pool.connect();
    try {
      await holder.query('BEGIN'); await holder.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE',[x.owner.id]);
      const pending = claim(x, 'blocked-expiry');
      await app.pool.query("UPDATE game_employment_jobs SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[x.job.employmentId]);
      await holder.query('COMMIT');
      await assert.rejects(pending,/evidence/);
      const result = await Promise.allSettled([claim(x,'expired-race'),single(x.owner,(ch,client,h)=>E.closeEmployment(ch,x.job.employmentId,'expired-close',client,h))]);
      assert.equal(result[0].status,'rejected'); assert.equal(result[1].status,'fulfilled');
    } finally { await holder.query('ROLLBACK'); holder.release(); }
  }
  const d = await fixture(1);
  const died = await pair(d.worker, d.owner, async (_ch, target, client, h) => {
    const result = await runEstate(client,h,target,'employment proof');
    // Core proof calls the exported estate hook in the same transaction; the
    // coordinator's shared integration suite must also verify runEstate wiring.
    await E.voidEmploymentAtDeath(client,h,target); return result;
  });
  await assert.rejects(claim(d));
  // An heir inherits metadata/receipts, never this street-wealth escrow.
  const heir = { id: died.heirId, account: d.owner.account };
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[heir.id,new Date(Date.now()+3600000)]);
  const heirCash = await balance(heir);
  await assert.rejects(single(heir, (ch, client, h) => E.closeEmployment(ch,d.job.employmentId,'estate',client,h)), /owner/);
  assert.equal(await balance(heir),heirCash);
  assert.equal(Number((await app.pool.query('SELECT burned_cash FROM game_employment_jobs WHERE id=$1',[d.job.employmentId])).rows[0].burned_cash),100);
  assert.equal((await single(heir,(ch,client,h)=>E.createEmployment(ch,d.terms,'create',client,h))).replayed,true);
  const deadWorker = await fixture(1); await deliver(deadWorker);
  await pair(deadWorker.owner,deadWorker.worker,(_ch,target,client,h)=>runEstate(client,h,target,'employment worker death proof'));
  await assert.rejects(claim(deadWorker));
  assert.equal((await employmentCashInvariant(app.pool)).ok,true);
  console.log(`gameemployment ${native?'PostgreSQL (including concurrent claims and rollback)':'memory'}: canonical work, once-only wages, replay, expiry, canonical death/heir and conservation passed`);
} finally { await app.close(); }

