process.env.RATE_LIMIT = 'off'; process.env.JWT_SECRET = 'commercial-reputation-isolated-proof-secret';
process.env.SOCIAL_VERIFY_MODE = 'off'; process.env.DEPOT_PILOT = 'on'; process.env.DELIVERY_CONTRACTS = 'on';
process.env.MARKET_SEED = 'commercial-reputation-isolated-seed'; process.env.MOD_KEY = 'commercial-reputation-isolated-mod';
const native = process.argv.includes('--postgres'); let nativeVersion; assert(!process.env.DATABASE_URL, 'Refuse ambient database endpoints');
function nativeEndpoint(value) {
  const url=new URL(value); assert(['postgres:','postgresql:'].includes(url.protocol)); assert.equal(url.hostname,'127.0.0.1'); assert(!url.search&&!url.hash);
  const local=['35439','35449'].includes(url.port)&&url.username==='pilot_runner'&&!url.password;
  const ci=url.port==='5432'&&url.username==='postgres'&&url.password==='pgcheck'; assert(local||ci); assert(/^\/commercial_reputation_[a-z0-9_]+$/.test(url.pathname)); return {url,local};
}
for(const bad of ['postgresql://pilot_runner@remote:35449/commercial_reputation_test_guard','postgresql://pilot_runner@127.0.0.1:35449/omerta','postgresql://postgres:wrong@127.0.0.1:5432/commercial_reputation_test_guard','postgresql://pilot_runner@127.0.0.1:35449/commercial_reputation_test_guard?host=remote']) assert.throws(()=>nativeEndpoint(bad));
if(native) {
  const {url,local}=nativeEndpoint(process.env.COMMERCIAL_REPUTATION_INTEGRATION_TEST_DATABASE_URL),{default:pg}=await import('pg'),pre=new pg.Pool({connectionString:url.href});
  try { const version=(await pre.query('SHOW server_version')).rows[0].server_version; nativeVersion=version; assert.match(version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/); assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0,'Fresh owned namespace required'); } finally { await pre.end(); }
  process.env.DATABASE_URL=url.href;
}
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import * as G from '../src/game.js';
import * as D from '../src/depot.js';
import * as Delivery from '../src/delivery.js';
import * as E from '../src/gameemployment.js';
import * as W from '../src/warehouseleases.js';
import * as Loans from '../src/loans.js';
import * as R from '../src/commercialreputation.js';
import * as Workflow from '../src/companyworkflows.js';
import * as Finance from '../src/deliveryfinance.js';
import { LOAN } from '../src/rules.js';
import { buyGood } from '../src/economy.js';
const app = await buildServer(); let serial = 0;
async function player(agent=false) {
  const ownerToken = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const token=agent?(await app.inject({method:'POST',url:'/v1/auth/agent-key',headers:{authorization:`Bearer ${ownerToken}`}})).json().token:ownerToken;
  const result = await app.inject({ method: 'POST', url: '/v1/character', payload: { name: `Reputation ${++serial}` }, headers: { authorization: `Bearer ${token}` } });
  assert.equal(result.statusCode, 200, result.body);
  const account = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub;
  const row = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1", [row.id, new Date(Date.now() + 3600000)]);
  await G.ledger(app.pool, { characterId: row.id, currency: 'cash', amount: 100000 - Number(row.cash) - Number(row.bank), reason: 'pilot:capital' });

  const profile=await app.inject({method:'POST',url:'/v1/resources/company',payload:{expectedRevision:0,name:`Company ${serial}`,published:false,premises:null},headers:{authorization:`Bearer ${ownerToken}`}}); assert.equal(profile.statusCode,200,profile.body);
  return { id: row.id, account, token, ownerToken };
}
const single = (p, fn) => G.withCharacter(app.pool, p.account, fn);
const pair = (p, other, fn) => G.withTwoCharacters(app.pool, p.account, other.id, fn, { meet: false });
const pub = p => R.publicCommercialReputation(app.pool, p.account);
const depotTerms = { salePrice: 600, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 };
async function depot(p) {
  const row = await single(p, (ch, db, h) => D.openDepot(ch, depotTerms, db, h));
  await single(p, (ch, db, h) => D.fundDepot(ch, row.id, 10000, db, h)); return row.id;
}

const {runEstate}=await import('../src/social/estate.js');
try {
  const company = await player(true), peers = [await player(), await player(), await player()];
  const ownDepot = await depot(company), contracts = [], assignments = [], loans = [];
  await single(company, (ch, db) => W.configureWarehouseOffer(ch, ownDepot, { expectedRevision: 0, enabled: true, slots: 10, cashPerUnitDay: 10 }, db));
  for (const peer of peers) {
    peer.depot = await depot(peer);
    const order = await single(peer, (ch, db, h) => D.restockDepot(ch, peer.depot, db, h));
    const commitment = await single(company, (ch, db) => Delivery.acceptDelivery(ch, order.id, { qty: 2, unitPrice: 500, maxProcurementCash: 5000, deadlineSeconds: 600 }, db));
    contracts.push(commitment.id);
    const job = await single(peer, (ch, db, h) => E.createEmployment(ch, { depotId: peer.depot, slots: 1, wageCash: 100, acceptHumans: true, acceptAgents: true, expiresAt: new Date(Date.now() + 1200000).toISOString() }, `job-${peer.id}`, db, h));
    const assignment = await pair(company, peer, (ch, owner, db) => E.acceptEmployment(ch, owner, { employmentId: job.employmentId, commitmentId: commitment.id, consent: true }, `work-${peer.id}`, db));
    assignments.push(assignment.assignmentId);
    await single(company, (ch, db, h) => buyGood(ch, 'gin', 2, db, h));
    await single(company, (ch, db, h) => Delivery.deliverCommitment(ch, commitment.id, 2, db, h));
    await pair(company, peer, (ch, owner, db, h) => E.claimEmployment(ch, owner, job.employmentId, commitment.id, `claim-${peer.id}`, db, h));
    await single(peer, (ch, db) => D.receiveDepot(ch, peer.depot, order.id, db));
    const rented = await pair(peer, company, (ch, owner, db, h) => W.leaseWarehouse(ch, owner, ownDepot, { units: 1, expectedOfferRevision: 1, maxTotalCash: 10 }, db, h));
    await single(peer, (ch, db) => W.closeWarehouseLease(ch, rented.lease.id, db));
    const loan = await single(company, (ch, db, h) => Loans.offerLoan(ch, { amount: Math.max(500, LOAN.MIN), rate: 0.05, hours: Math.max(3, LOAN.TERM_MIN_H), to: peer.id }, db, h));
    loans.push(loan.id);
    await single(peer, (ch, db, h) => Loans.takeLoan(ch, loan.id, null, db, h));
    await pair(peer, company, (ch, lender, db, h) => Loans.repayLoan(ch, lender, loan.id, db, h));
  }
  const endpoint='/v1/company/reputation';
  async function call(p,method,url,payload,owner=false) { const r=await app.inject({method,url,payload,headers:p?{authorization:`Bearer ${owner?p.ownerToken:p.token}`}:{}}); return {code:r.statusCode,body:r.json(),text:r.body}; }
  const ok=r=>{assert.equal(r.code,200,r.text);return r.body;};
  const publicView=async()=>ok(await call(null,'GET',`${endpoint}/public/${company.account}`));
  const ownView=async p=>ok(await call(p,'GET',endpoint));
  const publish=(p,revision,value=true)=>call(p,'POST',endpoint,{expectedRevision:revision,published:value});
  const profile=(p,revision,value)=>call(p,'POST','/v1/resources/company',{expectedRevision:revision,name:'Original Company',published:value,premises:null},true);
  async function baseline() { return {cash:(await app.pool.query('SELECT id,cash,bank FROM characters ORDER BY id')).rows,cargo:(await app.pool.query('SELECT * FROM character_cargo ORDER BY character_id,good_id')).rows,dm:Number((await app.pool.query('SELECT COUNT(*) n FROM dm_messages')).rows[0].n),journal:Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n)}; }
  assert(app.hasRoute({method:'POST',url:endpoint})); assert.equal((await call(null,'GET',endpoint)).code,401);
  assert.equal((await publish(company,0)).code,400,'Separate current company publication is required');
  ok(await profile(company,1,true)); assert.deepEqual(await publicView(),{available:false});
  const before=await baseline();
  assert.equal((await call(company,'POST',endpoint,{expectedRevision:0,published:true,accountId:peers[0].account})).code,400);
  assert.equal((await call(company,'POST',`${endpoint}/refresh`,{rating:100})).code,400);
  ok(await publish(company,0)); assert.equal((await publish(company,0)).code,400);
  const published=await publicView(); assert(published.available);
  for(const category of ['deliveries','paidWork','closedStorage','repaidLoans']) assert.equal(published.categories[category],'3–9');
  for(const hidden of [...contracts,...assignments,...loans,...peers.flatMap(p=>[p.id,p.account]),company.id,'principal','"rate":']) assert(!JSON.stringify(published).includes(hidden),hidden);
  assert(!(await ownView(peers[0])).evidence.some(row=>contracts.includes(row.sourceId)),'Foreign own route reveals no supplier proof');
  const refreshes=await Promise.all([call(company,'POST',`${endpoint}/refresh`,{}),call(company,'POST',`${endpoint}/refresh`,{})]); refreshes.forEach(ok);
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM commercial_reputation_proofs WHERE account_id=$1',[company.account])).rows[0].n),12);
  const originals=(await app.pool.query('SELECT original_character FROM commercial_reputation_proofs WHERE account_id=$1',[company.account])).rows; assert(originals.every(row=>row.original_character===company.id));
  await app.pool.query("INSERT INTO loans(id,lender_character,borrower_character,principal,rate,hours,status,offered_at,due_at) SELECT 'integrated-copied-loan',lender_character,borrower_character,principal,rate,hours,status,offered_at,due_at FROM loans WHERE id=$1",[loans[0]]);
  assert.equal((await ownView(company)).evidence.find(row=>row.sourceId==='integrated-copied-loan').eligible,false);
  ok(await call(company,'POST',`${endpoint}/refresh`,{})); assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM commercial_reputation_settlements WHERE account_id=$1',[company.account])).rows[0].n),6);
  await app.pool.query("DELETE FROM loans WHERE id='integrated-copied-loan'");
  ok(await profile(company,2,false)); assert.deepEqual(await publicView(),{available:false}); ok(await profile(company,3,true));
  ok(await publish(company,1,false)); assert.deepEqual(await publicView(),{available:false}); ok(await publish(company,2));
  assert.deepEqual(await baseline(),before,'Reputation publication/refresh/display moves no wealth or messages');
  if(native) {
    await assert.rejects(app.pool.query("UPDATE commercial_reputation_proofs SET original_character=NULL WHERE category='deliveries' AND source_id=$1",[contracts[0]]),/null|constraint/i);
    await assert.rejects(app.pool.query("INSERT INTO commercial_reputation_proofs(category,source_id,account_id,original_character,evidence_hash) SELECT category,source_id,$2,$3,evidence_hash FROM commercial_reputation_proofs WHERE category='deliveries' AND source_id=$1",[contracts[0],peers[0].account,peers[0].id]),/duplicate|unique/i);
    const outcomes=await Promise.all([publish(company,3,false),publish(company,3,false)]); assert.equal(outcomes.filter(r=>r.code===200).length,1); assert.equal(outcomes.filter(r=>r.code===400).length,1);
    await assert.rejects(single(company,(ch,c)=>R.setCommercialReputation(ch,{expectedRevision:4,published:true},{query:(...args)=>{if(args[0].startsWith('UPDATE commercial_reputation_publications')) throw new Error('publication rollback');return c.query(...args);}})),/publication rollback/);
    assert.deepEqual(await publicView(),{available:false}); assert.equal((await ownView(company)).publication.revision,4); ok(await publish(company,4));
  }
  const oldCharacter=company.id;
  const estate=await pair(peers[0],company,(killer,victim,c,h)=>runEstate(c,h,victim,'reputation integrated proof',{killerCh:killer,loot:true}));
  company.id=estate.heirId; await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[company.id,new Date(Date.now()+3600000)]);
  const heirBefore=await baseline(); const inherited=await ownView(company); assert(inherited.evidence.some(row=>contracts.includes(row.sourceId)&&row.eligible)); ok(await call(company,'POST',`${endpoint}/refresh`,{}));
  const historical=(await app.pool.query('SELECT original_character FROM commercial_reputation_proofs WHERE account_id=$1',[company.account])).rows; assert(historical.every(row=>row.original_character===oldCharacter)); assert(!historical.some(row=>row.original_character===estate.heirId));
  assert.equal((await publicView()).categories.deliveries,'3–9'); assert.deepEqual(await baseline(),heirBefore,'Actual heir reads/refresh do not transfer old wealth or grant new performer attribution');
  console.log(`commercialreputation-integration ${native?`PostgreSQL${nativeVersion}`:'memory'}: actual JWT/agent consent, canonical independent paid work/delivery/loans, proof/journal uniqueness, current privacy and actual estate original-performer history PASS`);
} catch(error) {console.error(error);throw error;} finally {await app.close();await app.pool.end();}
