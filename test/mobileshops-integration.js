// Actual shared-server prototype. Native gameplay requires the exact coordinator-owned hooks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
assert(!process.env.DATABASE_URL,'Reject ambient database endpoints');
const native=process.argv.includes('--postgres');let version='pg-mem';
if(native){
  const u=new URL(process.env.MOBILE_SHOP_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(u.protocol));assert.equal(u.hostname,'127.0.0.1');assert(!u.search&&!u.hash);assert.match(u.pathname,/^\/mobile_shop_integration_test_[a-z0-9_]+$/);
  const local=u.port==='35449'&&u.username==='pilot_runner'&&!u.password,ci=u.port==='5432'&&u.username==='postgres'&&u.password==='pgcheck';assert(local||ci,'Closed owned49 or explicit CI only');
  const {default:pg}=await import('pg'),pre=new pg.Client({connectionString:u.href});await pre.connect();
  try{
    await pre.query('BEGIN READ ONLY');version=(await pre.query('SHOW server_version')).rows[0].server_version;assert.match(version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
    if(local)assert.equal((await pre.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase(),'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof');
    const ownership=(await pre.query('SELECT current_user AS role,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()')).rows[0];assert.equal(ownership.role,u.username);assert.equal(ownership.owner,u.username);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);await pre.query('ROLLBACK');
    console.log('Owned fresh backend',version,u.pathname,local?'exact approved49 data directory':'CI PostgreSQL');
  }finally{await pre.end();}
  process.env.DATABASE_URL=u.href;
}
Object.assign(process.env,{RATE_LIMIT:'off',INVITE_MODE:'off',SOCIAL_VERIFY_MODE:'off',DEPOT_PILOT:'on',JWT_SECRET:'mobile-shop-native-component-fixture-only-secret',MARKET_SEED:'mobile-shop-native-fixture-seed-a9c8e721-unique',MOD_KEY:'mobile-shop-native-component-fixture-moderator',LEGAL_OPERATOR_NAME:'CI Test Operator',LEGAL_POSTAL_ADDRESS:'123 Fixture Street, Test City',PRIVACY_CONTACT_EMAIL:'privacy@example.test',DMCA_AGENT_NAME:'CI Test Agent',DMCA_AGENT_EMAIL:'copyright@example.test',DMCA_AGENT_ADDRESS:'123 Fixture Street, Test City',DMCA_AGENT_PHONE:'+1 202 555 0100',DMCA_AGENT_REGISTERED:'true',PAYMENT_REFUND_POLICY:'Test fixture policy; not a production policy.'});
// Import the real server first. No import-order priming or component route scaffold.
const {buildServer}=await import('./server-fixture.js');const app=await buildServer(),pool=app.pool;
const G=await import('../src/game.js'),M=await import('../src/market.js'),S=await import('../src/mobileshops.js'),I=await import('../src/items.js');
const {runLedgerInvariants}=await import('../src/invariants.js'),{canonicalDatabaseSnapshot}=await import('../tools/rc1-native-proof.js');
const {MOBILE_SHOP_CONTRACTS:contracts,MOBILE_SHOP_SCHEMAS:schemas}=await import('../src/mobileshops-contracts.js');
let sequence=0;const call=(p,method,url,body,key='shop-http-'+(++sequence),agent=false)=>app.inject({method,url,payload:body,headers:{...(p?{authorization:'Bearer '+(agent?p.agent:p.token)}:{}),'idempotency-key':key}});
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);const validators=Object.fromEntries(Object.entries(contracts).map(([key,c])=>[key,ajv.compile({...c.responseSchema,components:{schemas}})]));
async function ok(p,method,url,body,key,agent=false){const r=await call(p,method,url,body,key,agent);assert.equal(r.statusCode,200,r.body);const validate=validators[method+' '+url.split('?')[0]];if(validate)assert(validate(r.json()),JSON.stringify(validate.errors));return r.json();}
const reference=shop=>({shopId:shop.shop.shopId,sourceHash:shop.shop.sourceHash,consent:true});
const open=(p,quantity=1,seconds=3600)=>ok(p,'POST','/v1/mobile-shops/open',{quantity,unitPrice:1000,lifetimeSeconds:seconds,consent:true});
const buy=(p,s,key)=>ok(p,'POST','/v1/mobile-shops/buy',{...reference(s),quantity:1},key,true);
const books=async()=>{assert.deepEqual(await S.collectMobileShopIssues(pool),[]);const b=await runLedgerInvariants(pool,{alert:false});assert(b.ok,JSON.stringify(b));};
async function player(label){
  const p={token:(await ok(null,'POST','/v1/auth/guest')).token};await ok(p,'POST','/v1/character',{name:'Mobile Shop '+label});p.account=app.jwt.verify(p.token).sub;
  const ch=(await pool.query('SELECT id,cash,bank FROM characters WHERE account_id=$1 AND alive=true',[p.account])).rows[0];p.id=ch.id;
  await pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry' WHERE id=$1",[p.id]);await G.ledger(pool,{characterId:p.id,currency:'cash',amount:100000-Number(ch.cash)-Number(ch.bank),reason:'crime:mobile-shop-fixture'});
  p.agent=(await ok(p,'POST','/v1/auth/agent-key')).token;return p;
}
async function pending(p,body,key,observe=()=>{}){
  const frozen=JSON.stringify(body);for(let n=0;n<10;n++){
    assert.equal(JSON.stringify(body),frozen);const r=await call(p,'POST','/v1/mobile-shops/buy',body,key,true);observe(r);
    if(r.statusCode===200){assert(validators['POST /v1/mobile-shops/buy'](r.json()));return r.json();}
    assert.equal(r.statusCode,409,r.body);assert.equal(r.json().error,'in_progress',r.body);assert.equal(String(r.headers['retry-after']),'1');assert(n<9,'Ten exact-key attempts exhausted');await new Promise(r=>setTimeout(r,1000));
  }
}
async function waitForLock(fragment){
  for(let n=0;n<100;n++){const rows=(await pool.query("SELECT query FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows;if(rows.some(r=>r.query.includes(fragment)))return;await new Promise(r=>setTimeout(r,25));}assert.fail('Actual native lock wait was not delivered: '+fragment);
}
try{
  assert.equal((await call(null,'GET','/v1/mobile-shops')).statusCode,401);
  const advertised=(await app.inject({method:'GET',url:'/openapi.json'})).json();for(const route of ['/v1/mobile-shops','/v1/mobile-shops/open','/v1/mobile-shops/buy','/v1/mobile-shops/close','/v1/mobile-shops/expire'])assert(advertised.paths[route],route);
  if(!native){
    const p=await player('Memory');const refusal=await call(p,'POST','/v1/mobile-shops/open',{quantity:1,unitPrice:1000,lifetimeSeconds:60,consent:true});assert.equal(refusal.statusCode,400,refusal.body);assert.equal(refusal.json().error,'mobile_shop_transactional_backend_required');
    assert.equal((await pool.query('SELECT * FROM mobile_shops')).rows.length,0);console.log('PASS actual root registrar/auth/OpenAPI closed DTO; memory fresh gameplay explicitly unavailable.');
  }else{
    assert.equal(M.mobileShopHookRevision,S.MOBILE_SHOPS.hookRevision);
    const seller=await player('Seller'),buyer=await player('Buyer'),other=await player('Other'),killer=await player('Estate');
    const stock=quantity=>ok(seller,'POST','/v1/goods/buy',{goodId:'gin',qty:quantity});
    await stock(2);const shop=await open(seller,2),ref=reference(shop);assert.equal(shop.shop.remainingQuantity,2);assert.equal((await ok(seller,'GET','/v1/mobile-shops')).shops.find(r=>r.shopId===ref.shopId).available,true);
    const first=await buy(buyer,shop,'first-partial');assert.equal(first.quantity,1);assert.equal(first.paid,1000);assert.equal(first.shop.remainingQuantity,1);await books();
    await assert.rejects(G.withCharacter(pool,other.account,(ch,c,h)=>M.buyListing(ch,shop.shop.listingId,1,c,h)),e=>e.code==='mobile_shop_canonical_scope');
    await assert.rejects(G.withCharacter(pool,seller.account,(ch,c,h)=>M.cancelListing(ch,shop.shop.listingId,c,h)),e=>e.code==='mobile_shop_canonical_scope');
    assert.equal((await call(buyer,'POST','/v1/mobile-shops/close',ref,'foreign-close')).statusCode,400);
    const early=await call(seller,'POST','/v1/mobile-shops/expire',ref,'early-expire');assert.equal(early.statusCode,400,early.body);assert.equal(early.json().error,'mobile_shop_not_expired');
    await ok(seller,'POST','/v1/travel/docks');const away=await call(other,'POST','/v1/market/'+shop.shop.listingId+'/buy',{qty:1},'alternate-away',true);assert.equal(away.statusCode,400,away.body);assert.equal(away.json().error,'mobile_shop_unavailable');
    // Ordinary paid travel succeeds. The enrolled source alone suspends; remote reclaim is canonical.
    const closed=await ok(seller,'POST','/v1/market/'+shop.shop.listingId+'/cancel',{},'alternate-close');assert.equal(closed.action,'close');assert.equal(closed.returnedQuantity,1);assert.equal(closed.shop.status,'cancelled');await books();
    const ordinary=await ok(seller,'POST','/v1/market',{kind:'good',goodId:'gin',qty:1,price:1000,hours:1});assert.notEqual(ordinary.id,shop.shop.listingId);assert.equal((await pool.query('SELECT id FROM mobile_shops WHERE listing_id=$1',[ordinary.id])).rows.length,0);
    await ok(seller,'POST','/v1/travel/foundry');await ok(buyer,'POST','/v1/travel/docks');const ordinaryRemote=await ok(buyer,'POST','/v1/market/'+ordinary.id+'/buy',{qty:1});assert.equal(ordinaryRemote.qty,1);await ok(buyer,'POST','/v1/travel/foundry');await books();await stock(1);
    const raced=await open(seller),results=await Promise.all([call(buyer,'POST','/v1/mobile-shops/buy',{...reference(raced),quantity:1},'race-buyer',true),call(other,'POST','/v1/mobile-shops/buy',{...reference(raced),quantity:1},'race-other')]);assert.equal(results.filter(r=>r.statusCode===200).length,1,results.map(r=>r.body).join('\n'));assert.equal(Number((await pool.query('SELECT remaining_quantity FROM mobile_shops WHERE id=$1',[raced.shop.shopId])).rows[0].remaining_quantity),0);await books();
    await stock(1);const pendingShop=await open(seller),body={...reference(pendingShop),quantity:1},blocker=await pool.connect();let launched;
    try{
      await blocker.query('BEGIN');await blocker.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE',[seller.id]);
      launched=call(other,'POST','/v1/mobile-shops/buy',body,'real-pending-key',true);await waitForLock('characters');
      const duplicate=await call(other,'POST','/v1/mobile-shops/buy',body,'real-pending-key',true);assert.equal(duplicate.statusCode,409,duplicate.body);assert.equal(duplicate.json().error,'in_progress');assert.equal(String(duplicate.headers['retry-after']),'1');
      assert.equal((await pool.query('SELECT * FROM mobile_shop_requests WHERE shop_id=$1',[pendingShop.shop.shopId])).rows.filter(r=>r.receipt.action==='buy').length,0);await blocker.query('COMMIT');
    }finally{await blocker.query('ROLLBACK');blocker.release();}
    assert.equal((await launched).statusCode,200);await new Promise(r=>setTimeout(r,1000));const replayed=await pending(other,body,'real-pending-key');assert.equal(replayed.shop.status,'sold');assert.equal((await pool.query('SELECT * FROM mobile_shop_requests WHERE shop_id=$1',[pendingShop.shop.shopId])).rows.filter(r=>r.receipt.action==='buy').length,1);await books();
    await stock(1);const faultShop=await open(seller);let before,delivered=0;
    // Explicit administrative source-drift negative; restore the exact original field only.
    await pool.query('UPDATE mobile_shops SET unit_price=1001 WHERE id=$1',[faultShop.shop.shopId]);
    const drift=await call(buyer,'POST','/v1/mobile-shops/buy',{...reference(faultShop),quantity:1},'drift-refusal');assert.equal(drift.statusCode,400,drift.body);assert.equal(drift.json().error,'mobile_shop_source_changed');
    await pool.query('UPDATE mobile_shops SET unit_price=1000 WHERE id=$1',[faultShop.shop.shopId]);
    const faultPool=Object.create(pool);faultPool.query=pool.query.bind(pool);faultPool.connect=async()=>{
      const real=await pool.connect();return new Proxy(real,{get(target,prop){if(prop==='query')return async(...args)=>{const sql=typeof args[0]==='string'?args[0]:args[0]?.text;if(sql?.startsWith('INSERT INTO mobile_shop_requests')){before=await canonicalDatabaseSnapshot(pool);await target.query(...args);delivered++;throw Object.assign(Error('native post-sale receipt failure'),{code:'mobile_shop_native_fault'});}return target.query(...args);};const v=Reflect.get(target,prop);return typeof v==='function'?v.bind(target):v;}});
    };
    await assert.rejects(S.runMobileShop(faultPool,buyer.account,'buy',{...reference(faultShop),quantity:1},'whole-row-fault'),e=>e.code==='mobile_shop_native_fault');assert.equal(delivered,1);const after=await canonicalDatabaseSnapshot(pool);assert.deepEqual(after.tables,before.tables);assert.deepEqual(after.sequences,before.sequences);await books();await buy(buyer,faultShop,'whole-row-fault');await books();
    await stock(1);const expiring=await open(seller,1,60);for(let ms=+new Date(expiring.shop.expiresAt)-Date.now()-1200;ms>0;ms=+new Date(expiring.shop.expiresAt)-Date.now()-1200){await new Promise(r=>setTimeout(r,Math.min(ms,10000)));console.log('Real fixed expiry remains',Math.max(0,+new Date(expiring.shop.expiresAt)-Date.now()));}
    const sourceBlock=await pool.connect();let waiting;
    try{await sourceBlock.query('BEGIN');await sourceBlock.query('SELECT id FROM market_listings WHERE id=$1 FOR UPDATE',[expiring.shop.listingId]);waiting=call(other,'POST','/v1/mobile-shops/buy',{...reference(expiring),quantity:1},'actual-source-wait',true);await waitForLock('market_listings');await new Promise(r=>setTimeout(r,Math.max(0,+new Date(expiring.shop.expiresAt)-Date.now()+80)));await sourceBlock.query('COMMIT');}finally{await sourceBlock.query('ROLLBACK');sourceBlock.release();}
    const expired=await waiting;assert.equal(expired.statusCode,400,expired.body);assert.equal(expired.json().error,'mobile_shop_unavailable');assert.equal((await pool.query('SELECT * FROM mobile_shop_requests WHERE shop_id=$1',[expiring.shop.shopId])).rows.filter(r=>r.receipt.action==='buy').length,0);
    const returned=await ok(seller,'POST','/v1/mobile-shops/expire',reference(expiring),'actual-expire');assert.equal(returned.returnedQuantity,1);await books();
    const estateShop=await open(seller),preCash=Number((await pool.query('SELECT cash FROM characters WHERE id=$1',[seller.id])).rows[0].cash);
    // Explicit deterministic public-Pen fixture only, same actual paid shiv and canonical estate.
    process.env.PEN_YARD_EVENT='quiet';process.env.SHANK_P='1';for(const p of [seller,killer])await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1',[p.id,new Date(Date.now()+1800000)]);
    await ok(killer,'POST','/v1/pen/buy/shiv');const dead=await ok(killer,'POST','/v1/pen/shank/'+seller.id,{},'public-shop-estate');assert.equal(dead.kill,true);
    const terminal=(await pool.query('SELECT status,remaining_quantity FROM mobile_shops WHERE id=$1',[estateShop.shop.shopId])).rows[0];assert.equal(terminal.status,'estate_scattered');assert.equal(Number(terminal.remaining_quantity),1);assert.equal((await pool.query('SELECT id FROM market_listings WHERE id=$1',[estateShop.shop.listingId])).rows.length,0);
    const burns=(await pool.query("SELECT amount FROM transactions WHERE character_id=$1 AND currency='cash' AND reason='death:estate'",[seller.id])).rows;assert.equal(burns.length,1);assert.equal(Number(burns[0].amount),-preCash);
    const heir=dead.estate.heirId;assert.notEqual(heir,seller.id);assert.equal((await call(seller,'POST','/v1/mobile-shops/close',reference(estateShop),'heir-old-shop')).statusCode,400);await books();
    assert.deepEqual(await buy(buyer,shop,'first-partial'),first,'Historical exact ACK survives seller death without fresh authority');
    console.log('PASS N11 native'+version+' actual HTTP auth/DTO/canonical GIN input+sale/cash fees/travel/alternate cancel/pending409/serialized onebuyer/allrows+allseq rollback/real60s source-wait expiry/public estate/history/global books.');
  }
}finally{await app.close();}
