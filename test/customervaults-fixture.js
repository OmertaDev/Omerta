import assert from 'node:assert/strict';
export async function customerVaultFixture(){
  assert(!process.env.DATABASE_URL,'No ambient database endpoint');const native=process.argv.includes('--postgres');
  if(native){const u=new URL(process.env.CUSTOMER_VAULT_TEST_DATABASE_URL);assert(['postgresql:','postgres:'].includes(u.protocol));assert.equal(u.hostname,'127.0.0.1');assert(!u.search&&!u.hash);assert.match(u.pathname,/^\/customer_vault_test_[a-f0-9]{12}$/);
    const local=['35439','35449'].includes(u.port)&&u.username==='pilot_runner'&&!u.password,ci=u.port==='5432'&&u.username==='postgres'&&u.password==='pgcheck';assert(local||ci);
    const {default:pg}=await import('pg'),pre=new pg.Pool({connectionString:u.href});try{await pre.query('BEGIN READ ONLY');const p=(await pre.query("SELECT current_user AS role,current_setting('server_version') AS version")).rows[0];assert.equal(p.role,u.username);assert.match(p.version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);await pre.query('ROLLBACK');}finally{await pre.end();}process.env.DATABASE_URL=u.href;
  }
  Object.assign(process.env,{DEPOT_PILOT:'on',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',LEGAL_PROFILE_DEFER:'on',RESOURCE_ECONOMY:'off',JWT_SECRET:'owned-vault-fixture-secret',MOD_KEY:'owned-vault-fixture-mod',MARKET_SEED:'owned-vault-fixture-seed'});
  const {buildServer}=await import('./server-fixture.js'),G=await import('../src/game.js'),V=await import('../src/customervaults.js'),Depot=await import('../src/depot.js');
  const app=await buildServer(),pool=app.pool;const tables=(await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('customer_vault_services','customer_vault_positions','customer_vault_requests')")).rows;
  assert.deepEqual(tables.map(r=>r.table_name).sort(),['customer_vault_positions','customer_vault_requests','customer_vault_services'],'All vault tables come from the actual shared schema');let serial=0;
  const call=async(p,method,url,body,key='vault-proof-'+(++serial),agent=false)=>{const r=await app.inject({method,url,payload:body,headers:{...(p?{authorization:'Bearer '+(agent?p.agent:p.token)}:{}),...(key?{'idempotency-key':key}:{})}});return{code:r.statusCode,body:r.json(),headers:r.headers};};
  const create=async()=>{const token=(await call(null,'POST','/v1/auth/guest')).body.token,agent=(await call({token},'POST','/v1/auth/agent-key')).body.token;assert.equal((await call({token,agent},'POST','/v1/character',{name:'Vault proof '+(++serial)})).code,200);const ch=(await call({token},'GET','/v1/me')).body.character;await pool.query("UPDATE characters SET cash=100000,bank=0,nerve=0,loc='docks' WHERE id=$1",[ch.id]);await G.ledger(pool,{characterId:ch.id,currency:'cash',amount:100000-Number(ch.cash)-Number(ch.bank),reason:'crime:vault-fixture'});return {id:ch.id,account:(await pool.query('SELECT account_id FROM characters WHERE id=$1',[ch.id])).rows[0].account_id,token,agent};};
  const owner=await create(),customers=[await create(),await create(),await create()],stranger=await create();
  const single=(p,fn)=>G.withCharacter(pool,p.account,fn),pair=(p,q,fn)=>G.withTwoCharacters(pool,p.account,q.id,fn,{meet:false});
  const depot=await single(owner,(ch,c,h)=>Depot.openDepot(ch,{salePrice:300,bidPrice:100,targetStock:8,reorderAt:0,restockBudget:5000},c,h));
  // This component readiness callback is NOT a production estate integration proof.
  const runtime=V.createCustomerVaultRuntime({pool,assertEstateBridgeReady:async()=>true});
  const http=app; // Actual authenticated shared registrar; no component-only HTTP server.
  const api=async(p,action,b,key='api-vault-'+(++serial),agent=false)=>{const r=await http.inject({method:'POST',url:'/v1/company/vaults/'+action,payload:b,headers:{authorization:'Bearer '+(agent?p.agent:p.token),...(key?{'idempotency-key':key}:{})}});return {code:r.statusCode,body:r.json()};};
  const cash=async p=>Number((await pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
  const state=async()=>({characters:(await pool.query('SELECT id,account_id,alive,cash,bank FROM characters ORDER BY id')).rows,services:(await pool.query('SELECT * FROM customer_vault_services ORDER BY id')).rows,positions:(await pool.query('SELECT * FROM customer_vault_positions ORDER BY id')).rows,requests:(await pool.query('SELECT * FROM customer_vault_requests ORDER BY account_id,key_hash')).rows,transactions:(await pool.query("SELECT * FROM transactions WHERE reason LIKE 'customer_vault:%' ORDER BY id")).rows});
  const books=async()=>{assert.deepEqual((await V.customerVaultAccounting(pool)).issues,[]);};
  return {app,http,pool,G,V,Depot,owner,customers,stranger,create,depotId:depot.id,single,pair,runtime,api,call,cash,state,books,native,close:async()=>{await app.close();await pool.end();}};
}
