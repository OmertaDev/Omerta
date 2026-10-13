import {ensureComponentDDL} from './lib/company-middle-five-fixture-schema.js';
import assert from 'node:assert/strict';
const native = process.argv.includes('--postgres'); let version = 'memory';
assert(!process.env.DATABASE_URL, 'Production integration refuses ambient database endpoints');
if (native) {
  const url = new URL(process.env.DEPOT_ACQUISITION_RUNTIME_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1');
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci); assert(!url.search && !url.hash); assert.match(url.pathname, /^\/depot_acquisition_runtime_test_[a-z0-9_]+$/);
  const { default: pg } = await import('pg'), pre = new pg.Client({ connectionString: url.href }); await pre.connect();
  try {
    await pre.query('BEGIN READ ONLY'); version = (await pre.query('SHOW server_version')).rows[0].server_version;
    assert.match(version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
    await pre.query('ROLLBACK');
  } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
}
Object.assign(process.env, { RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', DEPOT_PILOT: 'on', INVITE_MODE: 'off',
  JWT_SECRET: 'production-combined-native-fixture-secret', MARKET_SEED: 'production-combined-fixture-market-seed-long', MOD_KEY: 'production-combined-fixture-moderator' });
const { buildServer } = await import('../src/server.js'), G = await import('../src/game.js');
const I = await import('../src/items.js'), { runEstate } = await import('../src/social/estate.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const app=await buildServer(),P=await import('../src/businesspartnerships.js'),V=await import('../src/companygovernance.js'),A=await import('../src/companyacquisitions.js'),R=await import('../src/depotacquisitionruntime.js'),{default:Fastify}=await import('fastify');await ensureComponentDDL(app.pool,P.businessPartnershipDDL,["business_partnerships","business_partnership_requests","business_partnership_distributions","business_partnership_contributions"]);await ensureComponentDDL(app.pool,V.companyGovernanceDDL,["company_governance","company_governance_proposals","company_governance_votes","company_governance_requests"]);await ensureComponentDDL(app.pool,A.companyAcquisitionsDDL,["company_acquisitions","company_acquisition_requests"]);const service=A.companyAcquisitions(R.canonicalDepotAcquisitionRuntime);const {withAcquisitionCharacters}=await import('../src/company-middle-five-runtime.js');let sequence=0;
// Global schema and real root registrations/hooks only: no component DDL or
// registration/admission/mystery-completion scaffold is installed by this test.
async function call(p, method, url, body, key = `combined-${++sequence}`, agent = false) {
  const r = await app.inject({ method, url, payload: body, headers: { ...(p ? { authorization: `Bearer ${agent ? p.agent : p.token}` } : {}), 'idempotency-key': key } });
  return { code: r.statusCode, body: r.json(), headers: r.headers };
}
async function ok(...args) { const r = await call(...args); assert.equal(r.code, 200, JSON.stringify(r)); return r.body; }
async function refusal(...args) { const r = await call(...args); assert([400, 409, 422].includes(r.code), JSON.stringify(r)); return r; }
async function player() {
  const p = { token: (await ok(null, 'POST', '/v1/auth/guest')).token };
  await ok(p, 'POST', '/v1/character', { name: `Combined Factory ${++sequence}` }); p.account = app.jwt.verify(p.token).sub;
  const row = (await app.pool.query('SELECT id,cash,bank FROM characters WHERE account_id=$1 AND alive', [p.account])).rows[0]; p.id = row.id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry',respect=10000,last_accrued_at=$2 WHERE id=$1", [p.id, new Date(Date.now() + 3600000)]);
  await G.ledger(app.pool, { characterId: p.id, currency: 'cash', amount: 100000 - Number(row.cash) - Number(row.bank), reason: 'crime:combined-production-fixture' });
  await app.pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')", [p.id]);
  await ok(p, 'POST', '/v1/resources/company', { expectedRevision: 0, name: `Private Factory ${sequence}`, published: false, premises: null });
  p.business = (await ok(p, 'POST', '/v1/depot', { salePrice: 1000, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 })).id;
  p.agent = (await ok(p, 'POST', '/v1/auth/agent-key')).token; assert.equal(app.jwt.verify(p.agent).agent, true); return p;
}
const base='/v1/company/acquisitions',config={salePrice:1000,bidPrice:500,targetStock:2,reorderAt:0,restockBudget:2000};
const pair=(s,b,fn)=>withAcquisitionCharacters(app.pool,s.account,b.id,fn);
const cash=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
const snapshot=async d=>({depot:(await app.pool.query('SELECT * FROM business_depots WHERE id=$1',[d])).rows[0],journals:(await app.pool.query('SELECT * FROM business_depot_journal WHERE depot_id=$1 ORDER BY id',[d])).rows});
async function deal(s,b,seconds=600){const q=await ok(s,'POST',base+'/quote',{depotId:s.business,buyerCharacter:b.id});const body={depotId:s.business,buyerCharacter:b.id,price:10000,sourceHash:q.sourceHash,expiresInSeconds:seconds,consent:true},r=await ok(s,'POST',base,body,'offer-'+(++sequence),true);assert.equal((await call(b,'POST',base+'/'+r.acquisition.id+'/accept',{consent:true,maxPrice:9999,termsHash:r.acquisition.termsHash},'wrong-price-'+(++sequence))).body.message,'buyer_consent');await ok(b,'POST',base+'/'+r.acquisition.id+'/accept',{consent:true,maxPrice:10000,termsHash:r.acquisition.termsHash},'accept-'+(++sequence),true);return r.acquisition;}
async function buyer(){const p=await player();await ok(p,'POST',`/v1/depot/${p.business}/close`,{});return p;}
async function global(){const checks=(await runLedgerInvariants(app.pool,{alert:false})).checks;assert.deepEqual(checks.filter(c=>!c.ok),[]);assert.equal(Number((await app.pool.query("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE reason IN ('company_acquisition:pay','company_acquisition:receive') AND currency='cash'")).rows[0].n),0);}
try{
const seller=await player(),purchaser=await buyer(),supplier=await player(),foreign=await buyer();
await ok(seller,'POST',`/v1/depot/${seller.business}/fund`,{amount:5000});const order=await ok(seller,'POST',`/v1/depot/${seller.business}/restock`,{});const Economy=await import('../src/economy.js'),Market=await import('../src/market.js');await G.withCharacter(app.pool,supplier.account,(ch,c,h)=>Economy.buyGood(ch,'gin',2,c,h));await G.withCharacter(app.pool,supplier.account,(ch,c,h)=>Market.fillOrder(ch,order.id,2,c,h));await ok(seller,'POST',`/v1/depot/${seller.business}/orders/${order.id}/receive`,{});
const before=await snapshot(seller.business),balances=[await cash(seller),await cash(purchaser)];assert.equal(Number(before.depot.stock),2);assert.equal(Number(before.depot.stock_cost),1000);const r=await deal(seller,purchaser),body={termsHash:r.termsHash};
await assert.rejects(pair(seller,purchaser,async(s,b,c,h)=>{await service.execute(s,b,r.id,body,'late-full',c,h);throw Error('late whole acquisition fault');}),/late whole acquisition fault/);assert.deepEqual(await snapshot(seller.business),before);assert.deepEqual([await cash(seller),await cash(purchaser)],balances);assert.equal((await app.pool.query('SELECT state FROM company_acquisitions WHERE id=$1',[r.id])).rows[0].state,'accepted');assert.equal((await app.pool.query("SELECT request_key FROM company_acquisition_requests WHERE request_key='late-full'")).rows.length,0);
const paid=native?await Promise.all([ok(seller,'POST',base+'/'+r.id+'/execute',body,'execute',true),ok(seller,'POST',base+'/'+r.id+'/execute',body,'execute',true)]):[await ok(seller,'POST',base+'/'+r.id+'/execute',body,'execute',true)];assert.deepEqual(paid[0],await ok(seller,'POST',base+'/'+r.id+'/execute',body,'execute'));if(native)assert.deepEqual(paid[0],paid[1]);assert.equal(paid[0].acquisition.ownershipTransferred,true);const after=await snapshot(seller.business);assert.deepEqual(after,{...before,depot:{...before.depot,owner_character:purchaser.id}});assert.deepEqual([await cash(seller),await cash(purchaser)],[balances[0]+10000,balances[1]-10000]);assert.equal((await app.pool.query('SELECT id FROM transactions WHERE counterparty=$1',[r.id])).rows.length,2);
assert.equal((await call(seller,'POST',`/v1/depot/${seller.business}/configure`,config)).code,400);await ok(purchaser,'POST',`/v1/depot/${seller.business}/configure`,{...config,salePrice:1100},'buyer-configure',true);assert.equal((await call(foreign,'POST',`/v1/depot/${seller.business}/configure`,config)).code,400);await global();
if(native){
 const sourceSeller=await player(),sourceBuyer=await buyer(),sourceDeal=await deal(sourceSeller,sourceBuyer),originalState=await snapshot(sourceSeller.business),originalCash=[await cash(sourceSeller),await cash(sourceBuyer)];
 const executeUrl=base+'/'+sourceDeal.id+'/execute',executeBody={termsHash:sourceDeal.termsHash};
 for(const mode of ['missing','extra']){
  let witnessed=0;const originalConnect=app.pool.connect.bind(app.pool);
  const wrapClient=client=>{const query=client.query.bind(client),release=client.release.bind(client);
   client.query=async(sql,...rest)=>{const result=await query(sql,...rest),text=typeof sql==='string'?sql:sql?.text,parameters=Array.isArray(rest[0])?rest[0]:sql?.values;
    if(text==="SELECT * FROM transactions WHERE counterparty=$1 AND currency='cash' AND reason IN ('company_acquisition:pay','company_acquisition:receive') ORDER BY id LIMIT 3"&&parameters?.[0]===sourceDeal.id&&result?.rows?.length===2&&++witnessed===2)
     return {...result,rows:mode==='missing'?result.rows.slice(0,1):[...result.rows,{...result.rows[0],id:'inconsistent_read_view'}]};
    return result;};
   client.release=(...values)=>{client.query=query;client.release=release;return release(...values);};return client;};
  app.pool.connect=(...args)=>{const callback=args.at(-1);if(typeof callback==='function'){args.pop();return originalConnect(...args,(error,client)=>{if(error)return callback(error);const wrapped=wrapClient(client);return callback(null,wrapped,wrapped.release);});}return originalConnect(...args).then(wrapClient);};
  try{const failed=await call(sourceSeller,'POST',executeUrl,executeBody,'source-view-'+mode,true);assert.equal(failed.code,400,JSON.stringify(failed));assert.equal(failed.body.message,'late_source_changed');assert.equal(witnessed,2,'The actual final source reread must observe the inconsistent view');}
  finally{app.pool.connect=originalConnect;}
  assert.deepEqual(await snapshot(sourceSeller.business),originalState);assert.deepEqual([await cash(sourceSeller),await cash(sourceBuyer)],originalCash);
  assert.equal((await app.pool.query('SELECT state FROM company_acquisitions WHERE id=$1',[sourceDeal.id])).rows[0].state,'accepted');
  assert.equal((await app.pool.query('SELECT id FROM transactions WHERE counterparty=$1',[sourceDeal.id])).rows.length,0);
  assert.equal((await app.pool.query('SELECT request_key FROM company_acquisition_requests WHERE request_key=$1',['source-view-'+mode])).rows.length,0);
 }
 await ok(sourceSeller,'POST',executeUrl,executeBody,'source-view-success',true);assert.equal((await app.pool.query('SELECT id FROM transactions WHERE counterparty=$1',[sourceDeal.id])).rows.length,2);await global();
}
const controlled=await player(),candidate=await buyer();await ok(controlled,'POST',`/v1/depot/${controlled.business}/policy`,{expectedRevision:0,enabled:false,allowRestock:false,allowReceive:false,businessPriority:false,maxSpend:0,reserveCash:1000,expiresInSeconds:600});assert.equal((await call(controlled,'POST',base+'/quote',{depotId:controlled.business,buyerCharacter:candidate.id})).body.message,'policy_archive_required');
const pending=await player();await ok(pending,'POST',`/v1/depot/${pending.business}/fund`,{amount:5000});await ok(pending,'POST',`/v1/depot/${pending.business}/restock`,{});assert.equal((await call(pending,'POST',base+'/quote',{depotId:pending.business,buyerCharacter:candidate.id})).body.message,'market');
const unknown=await player();await app.pool.query('CREATE TABLE unsupported_depot_scope(id TEXT PRIMARY KEY,depot_id TEXT)');assert.equal((await call(unknown,'POST',base+'/quote',{depotId:unknown.business,buyerCharacter:candidate.id})).body.message,'unsupported_schema');await app.pool.query('DROP TABLE unsupported_depot_scope');
if(native){const racingSeller=await player(),one=await buyer(),two=await buyer(),bodies=[];for(const b of [one,two]){const q=await ok(racingSeller,'POST',base+'/quote',{depotId:racingSeller.business,buyerCharacter:b.id});bodies.push({depotId:racingSeller.business,buyerCharacter:b.id,price:10000,sourceHash:q.sourceHash,expiresInSeconds:600,consent:true});}const race=await Promise.all(bodies.map((b,i)=>call(racingSeller,'POST',base,b,'one-buyer-'+i,true)));assert.equal(race.filter(x=>x.code===200).length,1);assert.equal(race.filter(x=>x.code===400&&x.body.message==='pending').length,1);const won=race.find(x=>x.code===200).body.acquisition,winning=won.buyerCharacter===one.id?one:two;await ok(winning,'POST',base+'/'+won.id+'/accept',{consent:true,maxPrice:10000,termsHash:won.termsHash},'winning-consent');await ok(racingSeller,'POST',base+'/'+won.id+'/execute',{termsHash:won.termsHash},'winning-transfer');assert.equal((await app.pool.query('SELECT owner_character FROM business_depots WHERE id=$1',[racingSeller.business])).rows[0].owner_character,winning.id);const old=await player(),next=await buyer(),r=await deal(old,next,60),state=await snapshot(old.business),wallets=[await cash(old),await cash(next)];const held=await app.pool.connect();await held.query('BEGIN');await held.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE',[old.business]);const short=pair(old,next,(s,b,c,h)=>service.execute(s,b,r.id,{termsHash:r.termsHash},'default-lock-timeout',c,h)).then(value=>({value}),error=>({error}));const timeout=await short;assert.equal(timeout.error?.code,'contention');assert(+new Date(r.expiresAt)>Date.now());assert.deepEqual(await snapshot(old.business),state);assert.deepEqual([await cash(old),await cash(next)],wallets);await held.query('SET LOCAL idle_in_transaction_session_timeout=90000');const pending=pair(old,next,async(s,b,c,h)=>{await c.query('SET LOCAL statement_timeout=90000');await c.query('SET LOCAL lock_timeout=90000');return service.execute(s,b,r.id,{termsHash:r.termsHash},'real-wait-expiry',c,h);}).then(value=>({value}),error=>({error}));console.log('Negative fixture only: LOCAL90s limits cross actual original60s acquisition expiry under held Depot; runtime/CI limits unchanged, no timestamp mutation.');await new Promise(resolve=>setTimeout(resolve,Math.max(0,+new Date(r.expiresAt)-Date.now())+100));await held.query('COMMIT');held.release();const result=await pending;assert(result.error,/state|expired/.test(result.error?.message));assert.match(result.error.message,/state|expired/);assert.deepEqual(await snapshot(old.business),state);assert.deepEqual([await cash(old),await cash(next)],wallets);assert.equal((await app.pool.query('SELECT id FROM transactions WHERE counterparty=$1',[r.id])).rows.length,0);}
await global();console.log(`depotacquisitionruntime ${native?'native '+version:'memory'} PASS: actual F15 consent+real Depot owner transfer, buyer-funded price/two G.ledger legs, all assets/history preserved, full rollback/exact replay/current owner API rights, dormant grants/market liabilities/unknown schema closed. Actual global reason vocabulary and all accounting checks pass.`);
}finally{await app.close();}
