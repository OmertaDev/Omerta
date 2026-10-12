import assert from 'node:assert/strict';
import * as P from '../src/commercialpremises.js';
import { commercialPremisesInvariant } from '../src/commercialpremisesinvariants.js';
const native=process.argv.includes('--postgres');
let serverVersion='memory';
assert(!process.env.DATABASE_URL,'Commercial premises proof rejects ambient DATABASE_URL');
if (native) {
  const url=new URL(process.env.COMMERCIAL_PREMISES_TEST_DATABASE_URL);
  assert(['postgresql:','postgres:'].includes(url.protocol)); assert(['127.0.0.1','localhost'].includes(url.hostname));
  const localPilot=['35439','35449'].includes(url.port) && url.username==='pilot_runner' && url.password==='';
  const ci=url.port==='5432' && url.username==='postgres' && url.password==='pgcheck';
  assert(localPilot||ci,'Only approved isolated local pilot or CI endpoints'); assert(!url.search && !url.hash);
  assert.match(url.pathname,/^\/commercial_premises_proof_[a-z0-9_]+$/);
  const { default:pg }=await import('pg'), pre=new pg.Pool({ connectionString:url.href });
  try {
    await pre.query('BEGIN READ ONLY');
    serverVersion=(await pre.query('SHOW server_version')).rows[0].server_version;
    assert.match(serverVersion,localPilot?/^18\.4(?:[.\s]|$)/:/^(?:16(?:[.\s]|$)|18\.4(?:[.\s]|$))/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0,'Native proof must own an empty database');
    await pre.query('ROLLBACK');
  } finally { await pre.end(); }
  process.env.DATABASE_URL=url.href;
}
Object.assign(process.env,{ DEPOT_PILOT:'on',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',JWT_SECRET:'commercial-premises-local-test-secret',
  MARKET_SEED:'commercial-premises-local-proof-seed',MOD_KEY:'commercial-premises-local-mod-key' });
const { buildServer }=await import('../src/server.js'), G=await import('../src/game.js'), D=await import('../src/depot.js');
const { setAgentCompany }=await import('../src/agentcompany.js'), { runEstate }=await import('../src/social/estate.js');
const app=await buildServer(); let serial=0;
if (!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
assert(app.hasRoute({ method:'GET',url:'/v1/company/premises' }),'Core proof requires actual registered runtime routes');
async function player() {
  const token=(await app.inject({ method:'POST',url:'/v1/auth/guest' })).json().token;
  const result=await app.inject({ method:'POST',url:'/v1/character',headers:{ authorization:`Bearer ${token}`,'idempotency-key':`commercial-player-${++serial}` },payload:{ name:`Premises ${serial}` } });
  assert.equal(result.statusCode,200,result.body);
  const account=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;
  const ch=(await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive',[account])).rows[0];
  await app.pool.query('UPDATE characters SET cash=100000,last_accrued_at=$2 WHERE id=$1',[ch.id,new Date(Date.now()+3600000)]);
  return { id:ch.id,account,token };
}
const single=(p,fn)=>G.withCharacter(app.pool,p.account,fn);
const pair=(p,target,fn)=>G.withTwoCharacters(app.pool,p.account,target.id,fn,{ meet:false });
const cash=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
const body=(overrides={})=>({ expectedRevision:0,expectedCompanyRevision:1,depotId:null,slots:2,rentCash:300,durationSeconds:600,
  offerExpiresAt:new Date(Date.now()+3600000).toISOString(),published:true,...overrides });
async function fixture({ kind='estate',published=true,depot=false,slots=2 }={}) {
  const owner=await player(),tenant=await player(),rival=await player();
  if (kind==='estate') await app.pool.query('INSERT INTO estates(account_id,tier,name) VALUES($1,1,$2)',[owner.account,'PRIVATE_ESTATE_ADDRESS']);
  if (kind==='street') await app.pool.query('INSERT INTO street_deeds(account_id,name,name_lc,district) VALUES($1,$2,$3,$4)',[owner.account,`PRIVATE_STREET_${serial}`,`private_street_${serial}`,'docks']);
  await setAgentCompany(app.pool,owner.account,{ expectedRevision:0,name:`Landlord Firm ${serial}`,published:true,premises:kind });
  for (const p of [tenant,rival]) await setAgentCompany(app.pool,p.account,{ expectedRevision:0,name:`PRIVATE Tenant ${p===tenant?'A':'B'} ${serial}`,published:false,premises:null });
  const operation=depot ? await single(owner,(ch,client,h)=>D.openDepot(ch,{ salePrice:2000,bidPrice:500,targetStock:4,reorderAt:0,restockBudget:3000 },client,h)) : null;
  const terms=body({ published,slots,depotId:operation?.id||null });
  const result=await single(owner,(ch,client)=>P.offerPremises(ch,terms,'offer',client));
  return { owner,tenant,rival,terms,offer:result.offer,operation };
}
const leaseBody=(slot=1,revision=1)=>({ expectedRevision:revision,slot,maxRentCash:300,consent:true });
const lease=(f,p=f.tenant,slot=1,key='lease')=>pair(p,f.owner,(ch,landlord,client,h)=>P.leasePremises(ch,landlord,f.offer.id,leaseBody(slot,f.offer.revision),key,client,h));
const call=(p,method,url,payload,key='commercial-http')=>app.inject({ method,url,payload,headers:{ authorization:`Bearer ${p.token}`,'idempotency-key':key } });
async function death(killer,victim) {
  const result=await pair(killer,victim,async (_ch,target,client,h)=>{
    const estate=await runEstate(client,h,target,'commercial premises proof');
    return estate;
  });
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[result.heirId,new Date(Date.now()+3600000)]);
  return { ...victim,id:result.heirId };
}
try {
  // Deterministic boundary budget: invalid integers, bounds, closed metadata.
  for (const field of ['slots','rentCash','durationSeconds','expectedRevision','expectedCompanyRevision']) {
    for (const value of [-1,0.5,NaN,Number.MAX_SAFE_INTEGER,Infinity]) assert.throws(()=>P.premisesOfferTerms(body({ [field]:value })),/terms/);
  }
  for (const extra of [{ address:'fake' },{ wallet:'external' },{ policy:'spend' }]) assert.throws(()=>P.premisesOfferTerms({ ...body(),...extra }),/terms/);
  const noBacking=await player(); await setAgentCompany(app.pool,noBacking.account,{ expectedRevision:0,name:'Unbacked Firm',published:true,premises:null });
  await assert.rejects(single(noBacking,(ch,client)=>P.offerPremises(ch,body(),'unbacked',client)),/premises/);
  const f=await fixture(), beforeTenant=await cash(f.tenant), beforeOwner=await cash(f.owner);
  const publicBoard=await call(f.rival,'GET','/v1/company/premises/offers');
  assert.equal(publicBoard.statusCode,200,publicBoard.body);
  assert.equal(publicBoard.json().offers.find(row=>row.id===f.offer.id).premises.kind,'estate');
  assert(!JSON.stringify(publicBoard.json()).includes('PRIVATE')); assert(!JSON.stringify(publicBoard.json()).includes(f.owner.account));
  assert(!('district' in publicBoard.json().offers.find(row=>row.id===f.offer.id).premises),'Estate has no invented geography');
  const paid=await lease(f); assert.equal(await cash(f.tenant),beforeTenant-300); assert.equal(await cash(f.owner),beforeOwner+300);
  assert.equal((await pair(f.tenant,f.owner,(ch,landlord,client)=>P.assertPremisesOccupancy(ch,landlord,paid.lease.id,client))).slot,1);
  await assert.rejects(single(f.owner,(ch,client,h)=>P.leasePremises(ch,ch,f.offer.id,leaseBody(),'self',client,h)),/self/);
  assert.equal((await lease(f)).replayed,true); assert.equal(await cash(f.tenant),beforeTenant-300);
  await assert.rejects(pair(f.tenant,f.owner,(ch,other,client,h)=>P.leasePremises(ch,other,f.offer.id,{ ...leaseBody(),slot:2 },'lease',client,h)),/request_conflict/);
  await assert.rejects(lease(f,f.rival,1,'collision'),/occupied/);
  const second=await lease(f,f.rival,2,'slot-two');
  const offerRows=await P.publicPremisesOffers(app.pool); assert(!offerRows.offers.some(row=>row.id===f.offer.id),'Full occupancy is absent from public offers');
  await assert.rejects(single(f.owner,(ch,client)=>P.cancelPremisesLease(ch,paid.lease.id,{ expectedRevision:1 },'evict',client)),/paid_occupancy/);
  await assert.rejects(single(f.owner,(ch,client)=>P.offerPremises(ch,{ ...f.terms,expectedRevision:1,slots:1 },'shrink',client)),/occupied/);
  const access=await single(f.tenant,(ch,client)=>P.commercialPremisesAccess(client,ch,paid.lease.id));
  assert.equal(access.lease.role,'tenant'); assert.equal(access.premisesKey,f.owner.account);
  const outsider=await player(); const denied=await call(outsider,'GET',`/v1/company/premises/leases/${paid.lease.id}`);
  assert.equal(denied.statusCode,400,denied.body); assert(!denied.body.includes(f.owner.account));
  const outsiderBoard=await call(outsider,'GET','/v1/company/premises'); assert.equal(outsiderBoard.json().leases.length,0);
  await single(f.owner,(ch,client)=>P.cancelPremisesOffer(ch,f.offer.id,{ expectedRevision:1 },'stop-intake',client));
  assert.equal((await single(f.tenant,(ch,client)=>P.commercialPremisesAccess(client,ch,paid.lease.id))).lease.id,paid.lease.id,'Offer withdrawal honors paid occupancy');
  await single(f.tenant,(ch,client)=>P.cancelPremisesLease(ch,paid.lease.id,{ expectedRevision:1 },'surrender',client));
  await assert.rejects(single(f.tenant,(ch,client)=>P.commercialPremisesAccess(client,ch,paid.lease.id)),/access_expired/);
  assert.equal(await cash(f.tenant),beforeTenant-300,'No rent is minted/refunded on surrender');
  assert.equal(second.lease.slot,2);
  const privateOffer=await fixture({ published:false });
  assert(!(await P.publicPremisesOffers(app.pool)).offers.some(row=>row.id===privateOffer.offer.id));
  await app.pool.query('UPDATE estates SET tier=0 WHERE account_id=$1',[privateOffer.owner.account]);
  await assert.rejects(lease(privateOffer),/offer/);
  const agentOffer=await fixture();
  const ownerAgent=(await call(agentOffer.owner,'POST','/v1/auth/agent-key',{},'owner-agent')).json().token;
  const tenantAgent=(await call(agentOffer.tenant,'POST','/v1/auth/agent-key',{},'tenant-agent')).json().token;
  const offeredHTTP=await call({ ...agentOffer.owner,token:ownerAgent },'POST','/v1/company/premises/offers',{ ...agentOffer.terms,expectedRevision:1 },'agent-offer');
  assert.equal(offeredHTTP.statusCode,200,offeredHTTP.body);
  const agentPaid=await call({ ...agentOffer.tenant,token:tenantAgent },'POST',`/v1/company/premises/offers/${agentOffer.offer.id}/lease`,leaseBody(1,2),'agent-lease');
  assert.equal(agentPaid.statusCode,200,agentPaid.body);
  const street=await fixture({ kind:'street' }), streetPaid=await lease(street);
  const streetView=(await P.publicPremisesOffers(app.pool)).offers.find(row=>row.id===street.offer.id);
  assert.equal(streetView.premises.district,'docks'); assert(!JSON.stringify(streetView).includes('private_street'));
  await app.pool.query('UPDATE street_deeds SET onchain_token_id=$2 WHERE account_id=$1',[street.owner.account,'123']);
  await assert.rejects(single(street.tenant,(ch,client)=>P.commercialPremisesAccess(client,ch,streetPaid.lease.id)),/access_expired/);
  await assert.rejects(lease(street,street.rival,2,'onchain'),/offer/);
  assert(!(await P.publicPremisesOffers(app.pool)).offers.some(row=>row.id===street.offer.id));
  await app.pool.query('UPDATE street_deeds SET onchain_token_id=NULL,account_id=$2 WHERE account_id=$1',[street.owner.account,outsider.account]);
  await assert.rejects(lease(street,street.rival,2,'transferred'),/offer/);
  const drift=await fixture({ depot:true }), driftPaid=await lease(drift);
  const operating=(await P.publicPremisesOffers(app.pool)).offers.find(row=>row.id===drift.offer.id);
  assert.equal(operating.businessDistrict,drift.operation.district); assert(!('district' in operating.premises));
  await app.pool.query('UPDATE business_depots SET owner_character=$2 WHERE id=$1',[drift.operation.id,outsider.id]);
  await assert.rejects(single(drift.tenant,(ch,client)=>P.commercialPremisesAccess(client,ch,driftPaid.lease.id)),/access_expired/);
  const expired=await fixture(), expiredPaid=await lease(expired);
  await app.pool.query("UPDATE commercial_premises_leases SET starts_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",[expiredPaid.lease.id]);
  await assert.rejects(single(expired.tenant,(ch,client)=>P.commercialPremisesAccess(client,ch,expiredPaid.lease.id)),/access_expired/);
  const reused=await lease(expired,expired.rival,1,'reused'); assert.equal(reused.lease.slot,1);
  const died=await fixture(), diedPaid=await lease(died), heir=await death(died.rival,died.owner);
  assert.equal((await app.pool.query('SELECT state FROM commercial_premises_leases WHERE id=$1',[diedPaid.lease.id])).rows[0].state,'landlord_dead');
  await assert.rejects(single(died.tenant,(ch,client)=>P.commercialPremisesAccess(client,ch,diedPaid.lease.id)),/access_expired/);
  assert.equal((await single(heir,(ch,client)=>P.offerPremises(ch,died.terms,'offer',client))).replayed,true);
  const inherited=await single(heir,(ch,client)=>P.offerPremises(ch,{ ...died.terms,expectedRevision:2 },'fresh-heir-consent',client));
  assert.equal(inherited.offer.premises.verified,true,'Canonical persistent estate rights may back a fresh heir offer');
  const replayHTTP=await call(died.tenant,'POST',`/v1/company/premises/offers/${died.offer.id}/lease`,leaseBody(),'lease');
  assert.equal(replayHTTP.statusCode,200,replayHTTP.body); assert.equal(replayHTTP.json().replayed,true,'Replay precedes original landlord eligibility');
  const tenantDeath=await fixture(), tenantPaid=await lease(tenantDeath); await death(tenantDeath.owner,tenantDeath.tenant);
  assert.equal((await app.pool.query('SELECT state FROM commercial_premises_leases WHERE id=$1',[tenantPaid.lease.id])).rows[0].state,'tenant_dead');
  if (native) {
    const race=await fixture({ slots:1 }); const firstCash=await cash(race.tenant), rivalCash=await cash(race.rival), landlordCash=await cash(race.owner);
    const results=await Promise.allSettled([lease(race,race.tenant,1,'race-a'),lease(race,race.rival,1,'race-b')]);
    assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
    assert.equal((firstCash+rivalCash)-(await cash(race.tenant)+await cash(race.rival)),300);
    assert.equal(await cash(race.owner),landlordCash+300);
    const rollback=await fixture(), tenantCash=await cash(rollback.tenant), ownerCash=await cash(rollback.owner);
    await assert.rejects(pair(rollback.tenant,rollback.owner,async (ch,other,client,h)=>{ await P.leasePremises(ch,other,rollback.offer.id,leaseBody(),'rollback',client,h); throw new Error('rollback'); }),/rollback/);
    assert.equal(await cash(rollback.tenant),tenantCash); assert.equal(await cash(rollback.owner),ownerCash);
    assert.equal((await app.pool.query('SELECT id FROM commercial_premises_leases WHERE offer_id=$1',[rollback.offer.id])).rows.length,0);
    await lease(rollback);
    const waited=await fixture(), hold=await app.pool.connect();
    try {
      await hold.query('BEGIN'); await hold.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE',[waited.owner.id]);
      const pending=lease(waited);
      await app.pool.query("UPDATE commercial_premises_offers SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[waited.offer.id]);
      await hold.query('COMMIT'); await assert.rejects(pending,/offer/);
    } finally { await hold.query('ROLLBACK'); hold.release(); }
  }
  const invariant=await commercialPremisesInvariant(app.pool); assert.equal(invariant.ok,true,JSON.stringify(invariant));
  const originalPay=(await app.pool.query("SELECT id,character_id FROM transactions WHERE counterparty=$1 AND reason='commercial_premises:rent:pay'",[paid.lease.id])).rows[0];
  await app.pool.query('UPDATE transactions SET character_id=$2 WHERE id=$1',[originalPay.id,outsider.id]);
  assert.equal((await commercialPremisesInvariant(app.pool)).ok,false,'Invariant rejects a wrong-party rent receipt');
  await app.pool.query('UPDATE transactions SET character_id=$2 WHERE id=$1',[originalPay.id,originalPay.character_id]);
  assert.equal((await commercialPremisesInvariant(app.pool)).ok,true);
  console.log(`commercialpremises ${native?`PostgreSQL ${serverVersion} race/rollback/lock-expiry`:'memory'}: verified estate/street slots, upfront rent, exact replay, capacity, privacy, drift, registered runtime routes, canonical integrated estate and ledger backing passed`);
} finally { await app.close(); await app.pool.end(); }
