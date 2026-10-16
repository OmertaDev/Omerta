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
const { buildServer } = await import('./server-fixture.js'), G = await import('../src/game.js');
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
async function sameKeyReplay(...args) {
  const deadline = Date.now() + 10000;
  for (;;) {
    const result = await call(...args);
    if (result.code === 200) return result.body;
    assert.equal(result.code, 409, JSON.stringify(result));
    assert.equal(result.body.error, 'in_progress');
    assert.equal(result.headers['retry-after'], '1');
    assert(Date.now() < deadline, 'Original-key receipt must settle within the fixture bound');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
async function refusal(...args) { const r = await call(...args); assert([400, 409, 422].includes(r.code), JSON.stringify(r)); return r; }
async function player() {
  const p = { token: (await ok(null, 'POST', '/v1/auth/guest')).token };
  await ok(p, 'POST', '/v1/character', { name: `Combined Factory ${++sequence}` }); p.account = app.jwt.verify(p.token).sub;
  const row = (await app.pool.query('SELECT id,cash,bank FROM characters WHERE account_id=$1 AND alive', [p.account])).rows[0]; p.id = row.id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry',respect=10000 WHERE id=$1", [p.id]);
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


const Vault=await import('../src/customervaults.js');
const quote=(s,b)=>call(s,'POST',base+'/quote',{depotId:s.business,buyerCharacter:b.id});
const vaultRows=async()=>({services:(await app.pool.query('SELECT * FROM customer_vault_services ORDER BY id')).rows,positions:(await app.pool.query('SELECT * FROM customer_vault_positions ORDER BY id')).rows,requests:(await app.pool.query('SELECT * FROM customer_vault_requests ORDER BY account_id,key_hash')).rows});
try{
 const operator=await player(),customer=await player(),purchaser=await buyer();
 const opened=await ok(operator,'POST','/v1/company/vaults/open',{depotId:operator.business,feeCash:7,lifetimeSeconds:600,consent:true});
 const terms={serviceId:opened.service.id,sourceHash:opened.service.sourceHash,consent:true};
 assert.equal((await quote(operator,purchaser)).body.message,'customer_vault_obligation');
 const position=await ok(customer,'POST','/v1/company/vaults/deposit',{...terms,principal:500,maxFeeCash:7});
 await ok(operator,'POST','/v1/company/vaults/close',terms);
 const principal=(await app.pool.query('SELECT * FROM customer_vault_positions WHERE id=$1',[position.position.id])).rows[0];assert.equal(Number(principal.remaining),500);
 assert.equal((await quote(operator,purchaser)).body.message,'customer_vault_obligation');
 // Negative persisted-state corruption: a false closed label cannot release real principal.
 await app.pool.query("UPDATE customer_vault_services SET state='closed' WHERE id=$1",[opened.service.id]);
 assert.equal((await quote(operator,purchaser)).body.message,'customer_vault_obligation');
 await app.pool.query("UPDATE customer_vault_services SET state='draining' WHERE id=$1",[opened.service.id]);
 const withdrawal={positionId:position.position.id,sourceHash:position.position.sourceHash,consent:true},returned=await ok(customer,'POST','/v1/company/vaults/withdraw',withdrawal,'actual-vault-principal-withdraw');assert.equal(returned.position.remaining,0);assert.equal((await quote(operator,purchaser)).code,200);assert.deepEqual((await Vault.customerVaultAccounting(app.pool)).issues,[]);
 const before=await vaultRows(),purchase=await deal(operator,purchaser);await ok(operator,'POST',base+'/'+purchase.id+'/execute',{termsHash:purchase.termsHash},'sale-after-actual-vault-recovery');assert.deepEqual(await vaultRows(),before);assert.deepEqual(await ok(customer,'POST','/v1/company/vaults/withdraw',withdrawal,'actual-vault-principal-withdraw'),returned);await global();
 if(native){
  const owner=await player(),patron=await player(),buyer2=await buyer(),service=await ok(owner,'POST','/v1/company/vaults/open',{depotId:owner.business,feeCash:7,lifetimeSeconds:600,consent:true}),ref={serviceId:service.service.id,sourceHash:service.service.sourceHash,consent:true};
  const race=await Promise.all([call(patron,'POST','/v1/company/vaults/deposit',{...ref,principal:500,maxFeeCash:7},'vault-deposit-close-race'),call(owner,'POST','/v1/company/vaults/close',ref,'vault-close-deposit-race')]);
  assert.equal(race[1].code,200,JSON.stringify(race));
  if(race[0].code===200){assert.equal((await quote(owner,buyer2)).body.message,'customer_vault_obligation');const held=race[0].body.position;assert.equal(held.remaining,500);await ok(patron,'POST','/v1/company/vaults/withdraw',{positionId:held.id,sourceHash:held.sourceHash,consent:true},'vault-race-principal-return');}
  else{assert.equal(race[0].code,400,JSON.stringify(race));assert.equal((await app.pool.query('SELECT * FROM customer_vault_positions WHERE service_id=$1',[ref.serviceId])).rows.length,0);}
  assert.equal((await quote(owner,buyer2)).code,200);await global();
 }
 console.log('Vault F15 relationship '+(native?'native '+version:'memory')+' PASS: open/draining/actual500principal block, false closed metadata refuses, real customer withdrawal clears, paid sale preserves histories and original ACK'+(native?'/actual deposit-close race retains funds or refuses new funding':'')+'.');
}finally{await app.close();}
