import assert from 'node:assert/strict';
const native=process.argv.includes('--postgres'); let serverVersion='memory';
assert(!process.env.DATABASE_URL,'Integration proof rejects ambient DATABASE_URL');
if (native) {
  const url=new URL(process.env.COMMERCIAL_PREMISES_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgresql:','postgres:'].includes(url.protocol)); assert(['127.0.0.1','localhost'].includes(url.hostname));
  const localPilot=['35439','35449'].includes(url.port) && url.username==='pilot_runner' && url.password==='';
  const ci=url.port==='5432' && url.username==='postgres' && url.password==='pgcheck';
  assert(localPilot||ci,'Only approved fresh local pilot or CI endpoint'); assert(!url.search && !url.hash);
  assert.match(url.pathname,/^\/commercial_premises_proof_[a-z0-9_]+$/);
  const { default:pg }=await import('pg'), pre=new pg.Pool({ connectionString:url.href });
  try {
    await pre.query('BEGIN READ ONLY'); serverVersion=(await pre.query('SHOW server_version')).rows[0].server_version;
    assert.match(serverVersion,localPilot?/^18\.4(?:[.\s]|$)/:/^(?:16(?:[.\s]|$)|18\.4(?:[.\s]|$))/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0,'Own a fresh empty integration database');
    await pre.query('ROLLBACK');
  } finally { await pre.end(); }
  process.env.DATABASE_URL=url.href;
}
Object.assign(process.env,{ DEPOT_PILOT:'on',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',JWT_SECRET:'commercial-premises-integration-isolated-secret',
  MARKET_SEED:'commercial-premises-integration-fixture-seed',MOD_KEY:'commercial-premises-integration-fixture-mod' });
const { buildServer }=await import('../src/server.js'), G=await import('../src/game.js');
const { runEstate }=await import('../src/social/estate.js'), P=await import('../src/commercialpremises.js');
const { runLedgerInvariants }=await import('../src/invariants.js');
const app=await buildServer(); let serial=0, keySerial=0;
if (!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
const base='/v1/company/premises';
const call=async (p,method,url,body,key=`premises-api-${++keySerial}`,agent=false)=>{
  const response=await app.inject({ method,url,payload:body,headers:{ ...(p?{ authorization:`Bearer ${agent?p.agent:p.token}` }:{}),'idempotency-key':key } });
  return { code:response.statusCode,body:response.json() };
};
const ok=async (...args)=>{ const result=await call(...args); assert.equal(result.code,200,JSON.stringify(result.body)); return result.body; };
const reject=async (...args)=>{ const result=await call(...args); assert([400,409].includes(result.code) || (result.code===422 && result.body.error==='idempotency_key_reuse'),JSON.stringify(result)); return result.body; };
const recovered=(receipt,retry)=>{
  const { replayed,...body }=retry; assert.deepEqual(body,receipt,'HTTP idempotency preserves original receipt');
  if (replayed!==undefined) assert.equal(replayed,true);
};
const cash=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
async function player() {
  const token=(await ok(null,'POST','/v1/auth/guest')).token;
  const p={ token }; await ok(p,'POST','/v1/character',{ name:`Premises API ${++serial}` });
  p.account=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;
  const ch=(await app.pool.query('SELECT id,cash FROM characters WHERE account_id=$1 AND alive',[p.account])).rows[0]; p.id=ch.id;
  await app.pool.query('UPDATE characters SET cash=100000,last_accrued_at=$2 WHERE id=$1',[p.id,new Date(Date.now()+3600000)]);
  await G.ledger(app.pool,{ characterId:p.id,currency:'cash',amount:100000-Number(ch.cash),reason:'crime:pilot-fixture' });
  p.agent=(await ok(p,'POST','/v1/auth/agent-key')).token;
  assert.equal(JSON.parse(Buffer.from(p.agent.split('.')[1],'base64url')).agent,true);
  return p;
}
const offerTerms=(overrides={})=>({ expectedRevision:0,expectedCompanyRevision:1,depotId:null,slots:2,rentCash:300,durationSeconds:600,
  offerExpiresAt:new Date(Date.now()+3600000).toISOString(),published:true,...overrides });
const leaseTerms=(slot=1,revision=1)=>({ expectedRevision:revision,slot,maxRentCash:300,consent:true });
async function fixture(kind='estate',slots=2) {
  const owner=await player(),tenant=await player(),rival=await player();
  if (kind==='estate') await app.pool.query('INSERT INTO estates(account_id,tier,name) VALUES($1,1,$2)',[owner.account,`PRIVATE Estate ${serial}`]);
  else await app.pool.query('INSERT INTO street_deeds(account_id,name,name_lc,district) VALUES($1,$2,$3,$4)',[owner.account,`PRIVATE Street ${serial}`,`private-street-${serial}`,'docks']);
  await ok(owner,'POST','/v1/resources/company',{ expectedRevision:0,name:`Premises Landlord ${serial}`,published:true,premises:kind });
  for (const p of [tenant,rival]) await ok(p,'POST','/v1/resources/company',{ expectedRevision:0,name:`Private Tenant ${++serial}`,published:false,premises:null });
  const terms=offerTerms({ slots });
  const offered=await ok(owner,'POST',`${base}/offers`,terms,`fixture-offer-${serial}`,true);
  return { owner,tenant,rival,offer:offered.offer,terms };
}
async function rent(f,p=f.tenant,slot=1,key=`lease-${++keySerial}`,agent=true) { return ok(p,'POST',`${base}/offers/${f.offer.id}/lease`,leaseTerms(slot,f.offer.revision),key,agent); }
async function global() {
  const checks=(await runLedgerInvariants(app.pool,{ alert:false })).checks;
  const occupancy=checks.find(c=>c.name==='commercial premises paid occupancy'); assert(occupancy,'Actual global invariant collector includes paid occupancy');
  assert.equal(occupancy.ok,true,JSON.stringify(occupancy));
  assert.deepEqual(checks.filter(c=>!c.ok),[],'Global source, money and occupancy invariants remain reconciled');
}
async function die(killer,victim) {
  const result=await G.withTwoCharacters(app.pool,killer.account,victim.id,(_ch,target,db,h)=>runEstate(db,h,target,'commercial premises actual integration'),{ meet:false });
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[result.heirId,new Date(Date.now()+3600000)]);
  const heir={ ...victim,id:result.heirId };
  const prestige=Number((await app.pool.query('SELECT prestige FROM account_persistent WHERE account_id=$1',[victim.account])).rows[0].prestige);
  assert.equal(await cash(heir),500+100*prestige,'Premises rent creates no extra heir cash beyond canonical stake');
  return heir;
}
try {
  for (const [method,url] of [['GET',base],['GET',`${base}/offers`],['POST',`${base}/offers`]]) assert.equal((await call(null,method,url,method==='POST'?offerTerms():undefined)).code,401);
  const f=await fixture();
  assert(app.hasRoute({ method:'POST',url:`${base}/offers/:id/lease` }),'Use the actual registered runtime, no test route injection');
  const advertised=(await ok(f.rival,'GET',`${base}/offers`,undefined,'board',true)).offers.find(o=>o.id===f.offer.id);
  assert(advertised); assert.equal(advertised.premises.kind,'estate'); assert.equal(advertised.premises.verified,true);
  for (const secret of [f.owner.account,f.owner.id,'PRIVATE Estate','private-street','premisesKey']) assert.equal(JSON.stringify(advertised).includes(secret),false,secret);
  const beforeTenant=await cash(f.tenant),beforeOwner=await cash(f.owner);
  const paid=await rent(f,f.tenant,1,'normal-agent-rent');
  assert.equal(await cash(f.tenant),beforeTenant-300); assert.equal(await cash(f.owner),beforeOwner+300);
  const rentRows=(await app.pool.query("SELECT character_id,reason,amount FROM transactions WHERE counterparty=$1 AND reason LIKE 'commercial_premises:rent:%' ORDER BY reason",[paid.lease.id])).rows;
  assert.equal(rentRows.length,2); assert.equal(rentRows.reduce((n,row)=>n+Number(row.amount),0),0);
  assert.deepEqual(rentRows.map(r=>r.reason),['commercial_premises:rent:pay','commercial_premises:rent:receive']);
  const replay=await rent(f,f.tenant,1,'normal-agent-rent',false); recovered(paid,replay);
  assert.equal(await cash(f.tenant),beforeTenant-300); assert.equal(await cash(f.owner),beforeOwner+300);
  await reject(f.tenant,'POST',`${base}/offers/${f.offer.id}/lease`,leaseTerms(2),'normal-agent-rent',true);
  await reject(f.rival,'POST',`${base}/offers/${f.offer.id}/lease`,leaseTerms(1),'occupied',false);
  const access=await ok(f.tenant,'GET',`${base}/leases/${paid.lease.id}`,undefined,'access',true);
  assert.equal(access.lease.role,'tenant'); assert.equal(access.premisesKey,f.owner.account);
  const occupancy=await G.withTwoCharacters(app.pool,f.tenant.account,f.owner.id,(ch,landlord,db)=>P.assertPremisesOccupancy(ch,landlord,paid.lease.id,db),{ meet:false });
  assert.equal(occupancy.slot,1,'Actual paired mutation guard recognizes current paid occupancy');
  await ok(f.owner,'POST','/v1/resources/company',{ expectedRevision:1,name:'Private Landlord Now',published:false,premises:'estate' });
  assert.equal((await ok(f.rival,'GET',`${base}/offers`)).offers.some(o=>o.id===f.offer.id),false,'Current company publication controls public offers');
  assert.equal((await ok(f.tenant,'GET',`${base}/leases/${paid.lease.id}`)).lease.id,paid.lease.id,'Privacy withdrawal preserves current paid occupancy');
  await ok(f.owner,'POST','/v1/resources/company',{ expectedRevision:2,name:'Public Landlord Again',published:true,premises:'estate' });
  const outsider=await player();
  await reject(outsider,'GET',`${base}/leases/${paid.lease.id}`);
  assert.equal((await ok(outsider,'GET',base)).leases.length,0);
  await reject(f.owner,'POST',`${base}/leases/${paid.lease.id}/cancel`,{ expectedRevision:1 },'no-eviction');
  await ok(f.owner,'POST',`${base}/offers/${f.offer.id}/cancel`,{ expectedRevision:1 },'withdraw-offer',true);
  assert.equal((await ok(f.tenant,'GET',`${base}/leases/${paid.lease.id}`)).lease.id,paid.lease.id,'Withdrawing intake preserves paid occupancy');
  await ok(f.tenant,'POST',`${base}/leases/${paid.lease.id}/cancel`,{ expectedRevision:1 },'surrender',true);
  await reject(f.tenant,'GET',`${base}/leases/${paid.lease.id}`);
  assert.equal(await cash(f.tenant),beforeTenant-300,'No surrender refund is minted');
  await global();
  const street=await fixture('street'),streetPaid=await rent(street,street.tenant,1,'human-street-rent',false);
  assert.equal((await ok(street.rival,'GET',`${base}/offers`)).offers.find(o=>o.id===street.offer.id).premises.district,'docks');
  await app.pool.query('UPDATE street_deeds SET onchain_token_id=$2 WHERE account_id=$1',[street.owner.account,'fixture-extracted']);
  await reject(street.tenant,'GET',`${base}/leases/${streetPaid.lease.id}`);
  assert.equal((await ok(street.rival,'GET',`${base}/offers`)).offers.some(o=>o.id===street.offer.id),false);
  await app.pool.query('UPDATE street_deeds SET onchain_token_id=NULL WHERE account_id=$1',[street.owner.account]);
  await app.pool.query('UPDATE street_deeds SET account_id=$2 WHERE account_id=$1',[street.owner.account,outsider.account]);
  await reject(street.tenant,'GET',`${base}/leases/${streetPaid.lease.id}`);
  await app.pool.query('UPDATE street_deeds SET account_id=$2 WHERE account_id=$1',[outsider.account,street.owner.account]);
  const expired=await fixture(),expiredPaid=await rent(expired);
  await app.pool.query("UPDATE commercial_premises_leases SET starts_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",[expiredPaid.lease.id]);
  await reject(expired.tenant,'GET',`${base}/leases/${expiredPaid.lease.id}`);
  assert.equal((await rent(expired,expired.rival,1,'reuse-expired')).lease.slot,1);
  const landlordDeath=await fixture(),landlordPaid=await rent(landlordDeath,landlordDeath.tenant,1,'landlord-initial-rent');
  const tenantMoney=await cash(landlordDeath.tenant),heir=await die(landlordDeath.rival,landlordDeath.owner);
  assert.equal((await app.pool.query('SELECT state FROM commercial_premises_leases WHERE id=$1',[landlordPaid.lease.id])).rows[0].state,'landlord_dead');
  assert.equal((await app.pool.query('SELECT state FROM commercial_premises_offers WHERE id=$1',[landlordDeath.offer.id])).rows[0].state,'invalidated');
  await reject(landlordDeath.tenant,'GET',`${base}/leases/${landlordPaid.lease.id}`);
  await reject(heir,'GET',`${base}/leases/${landlordPaid.lease.id}`);
  await assert.rejects(G.withTwoCharacters(app.pool,landlordDeath.tenant.account,heir.id,(ch,landlord,db)=>P.assertPremisesOccupancy(ch,landlord,landlordPaid.lease.id,db),{ meet:false }),/access_expired/);
  recovered(landlordPaid,await rent(landlordDeath,landlordDeath.tenant,1,'landlord-initial-rent'));
  assert.equal(await cash(landlordDeath.tenant),tenantMoney,'Recovered receipt neither recharges tenant nor refunds rent');
  assert.equal(await cash(heir),500,'Historical receipt creates no extra heir money or paid authority');
  await reject(landlordDeath.rival,'POST',`${base}/offers/${landlordDeath.offer.id}/lease`,leaseTerms(),'new-after-landlord-death');
  const beforeRepeat=(await app.pool.query('SELECT state,revision FROM commercial_premises_offers WHERE id=$1',[landlordDeath.offer.id])).rows[0];
  await G.withCharacter(app.pool,heir.account,(_ch,db)=>P.voidCommercialPremisesAtDeath(db,{ id:landlordDeath.owner.id }));
  assert.deepEqual((await app.pool.query('SELECT state,revision FROM commercial_premises_offers WHERE id=$1',[landlordDeath.offer.id])).rows[0],beforeRepeat,'Repeated hook is idempotent after the actual integrated estate already ran');
  const fresh=await ok(heir,'POST',`${base}/offers`,offerTerms({ expectedRevision:2 }),'fresh-heir-offer',true);
  assert.equal(fresh.offer.revision,3); assert.equal(await cash(heir),500,'Fresh explicit property consent grants no old rent');
  const tenantDeath=await fixture(),tenantPaid=await rent(tenantDeath,tenantDeath.tenant,1,'tenant-initial-rent');
  const landlordCash=await cash(tenantDeath.owner),tenantHeir=await die(tenantDeath.rival,tenantDeath.tenant);
  assert.equal((await app.pool.query('SELECT state FROM commercial_premises_leases WHERE id=$1',[tenantPaid.lease.id])).rows[0].state,'tenant_dead');
  assert.equal(await cash(tenantDeath.owner),landlordCash,'Paid landlord cash remains ordinary cash; no escrow refund or clawback');
  await reject(tenantHeir,'GET',`${base}/leases/${tenantPaid.lease.id}`);
  recovered(tenantPaid,await rent(tenantDeath,tenantHeir,1,'tenant-initial-rent'));
  assert.equal(await cash(tenantHeir),500);
  await global();
  if (native) {
    const contention=await fixture('estate',1),a=await cash(contention.tenant),b=await cash(contention.rival),landlord=await cash(contention.owner);
    const results=await Promise.all([
      call(contention.tenant,'POST',`${base}/offers/${contention.offer.id}/lease`,leaseTerms(),'api-race-human',false),
      call(contention.rival,'POST',`${base}/offers/${contention.offer.id}/lease`,leaseTerms(),'api-race-agent',true),
    ]);
    assert.equal(results.filter(r=>r.code===200).length,1);
    assert.equal(results.filter(r=>r.code===400 && r.body.message==='occupied').length,1);
    assert.equal(a+b-await cash(contention.tenant)-await cash(contention.rival),300); assert.equal(await cash(contention.owner),landlord+300);
    const rollback=await fixture(),left=await cash(rollback.tenant),right=await cash(rollback.owner);
    const originalConnect=app.pool.connect; const witnessed={ rent:0,lease:0 };
    app.pool.connect=async function(...args) {
      const client=await originalConnect.apply(this,args),originalQuery=client.query,originalRelease=client.release;
      client.query=async function(sql,values,...rest) {
        if (sql.startsWith('INSERT INTO commercial_premises_requests') && values?.[1]==='lease' && values?.[2]==='api-rollback') throw new Error('injected API final receipt failure');
        const response=await originalQuery.call(this,sql,values,...rest);
        if (sql.startsWith('INSERT INTO transactions') && String(values?.[5]).startsWith('commercial_premises:rent:')) witnessed.rent++;
        if (sql.startsWith('INSERT INTO commercial_premises_leases')) witnessed.lease++;
        return response;
      };
      client.release=function(...releaseArgs) { client.query=originalQuery; client.release=originalRelease; return originalRelease.apply(this,releaseArgs); };
      return client;
    };
    try { assert.equal((await call(rollback.tenant,'POST',`${base}/offers/${rollback.offer.id}/lease`,leaseTerms(),'api-rollback',true)).code,500); }
    finally { app.pool.connect=originalConnect; }
    assert.deepEqual(witnessed,{ rent:2,lease:1 },'Actual HTTP transaction wrote both rent legs and occupancy before injected late failure');
    assert.equal(await cash(rollback.tenant),left); assert.equal(await cash(rollback.owner),right);
    assert.equal((await app.pool.query('SELECT id FROM commercial_premises_leases WHERE offer_id=$1',[rollback.offer.id])).rows.length,0);
    assert.equal((await app.pool.query("SELECT request_key FROM commercial_premises_requests WHERE account_id=$1 AND action='lease' AND request_key='api-rollback'",[rollback.tenant.account])).rows.length,0);
    await rent(rollback,rollback.tenant,1,'api-rollback',true);
    const waited=await fixture(),waitLeft=await cash(waited.tenant),waitRight=await cash(waited.owner),blocker=await app.pool.connect();
    await app.pool.query('UPDATE commercial_premises_offers SET expires_at=$2 WHERE id=$1',[waited.offer.id,new Date(Date.now()+500)]);
    await blocker.query('BEGIN'); await blocker.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE',[waited.owner.id]);
    const pending=call(waited.tenant,'POST',`${base}/offers/${waited.offer.id}/lease`,leaseTerms(),'api-after-lock',true);
    try {
      let observed=false;
      for (let n=0;n<40;n++) {
        if ((await app.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%characters%' LIMIT 1")).rows.length) { observed=true; break; }
        await new Promise(resolve=>setTimeout(resolve,5));
      }
      assert.equal(observed,true,'HTTP paired transaction is observed waiting for original landlord character lock');
      await new Promise(resolve=>setTimeout(resolve,550)); await blocker.query('COMMIT');
      const expired=await pending; assert.equal(expired.code,400); assert.equal(expired.body.message,'offer');
      assert.equal(await cash(waited.tenant),waitLeft); assert.equal(await cash(waited.owner),waitRight);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); }
    await global();
  }
  const pay=(await app.pool.query("SELECT id,character_id FROM transactions WHERE counterparty=$1 AND reason='commercial_premises:rent:pay'",[paid.lease.id])).rows[0];
  await app.pool.query('UPDATE transactions SET character_id=$2 WHERE id=$1',[pay.id,outsider.id]);
  assert.equal((await runLedgerInvariants(app.pool,{ alert:false })).checks.find(c=>c.name==='commercial premises paid occupancy').ok,false,'Actual global collector detects wrong-party rent');
  await app.pool.query('UPDATE transactions SET character_id=$2 WHERE id=$1',[pay.id,pay.character_id]); await global();
  console.log(`commercial premises integration ${native?`PostgreSQL ${serverVersion}`:'memory'}: real JWT human/agent routes, paired rent exactly once, global invariants, verified property/private access, occupancy lifecycle and actual tenant/landlord estate with no extra heir cash/authority passed${native?'; API slot race, witnessed late rollback and post-lock expiry passed':''}`);
} finally { await app.close(); await app.pool.end(); }
