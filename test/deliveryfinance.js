import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const url = new URL(process.env.DELIVERY_FINANCE_TEST_DATABASE_URL || 'http://missing');
  const local = url.hostname === '127.0.0.1' && ((url.port === '35439' && url.username === 'pilot_runner') || (url.port === '5432' && url.username === 'postgres'));
  if (url.protocol !== 'postgresql:' || !local || !/^\/delivery_finance_[a-z0-9_]+$/.test(url.pathname)) throw Error('Use an isolated local delivery_finance_ PostgreSQL database.');
  process.env.DATABASE_URL = url.href;
} else process.env.DATABASE_URL = '';
Object.assign(process.env, { RATE_LIMIT: 'off', JWT_SECRET: 'delivery-finance-local-test-only-secret', MOD_KEY: 'delivery-finance-local-mod-only',
  SOCIAL_VERIFY_MODE: 'off', DEPOT_PILOT: 'on', DELIVERY_CONTRACTS: 'on', MARKET_SEED: 'delivery-finance-native-test-only' });
const { buildServer } = await import('../src/server.js');
const { ledger, withCharacter, withTwoCharacters } = await import('../src/game.js');
const Finance = await import('../src/deliveryfinance.js');
const Loans = await import('../src/loans.js');
const Delivery = await import('../src/delivery.js');
const { loanOwed, loanVig } = await import('../src/rules.js');
const app = await buildServer(), suffix = crypto.randomUUID().slice(0,6);
async function call(method,url,player,body) {
  const r=await app.inject({method,url,payload:body,headers:{...(player?{authorization:'Bearer '+player.token}:{}),'idempotency-key':crypto.randomUUID()}});
  assert.equal(r.statusCode,200,r.body);return r.json();
}
async function actor(name) {
  const token=(await call('POST','/v1/auth/guest')).token,p={token};
  await call('POST','/v1/character',p,{name:name+' '+suffix});
  const ch=(await call('GET','/v1/me',p)).character;p.id=ch.id;
  p.accountId=(await app.pool.query('SELECT account_id FROM characters WHERE id=$1',[p.id])).rows[0].account_id;
  await app.pool.query("UPDATE characters SET cash=50000.5,bank=0,loc='docks' WHERE id=$1",[p.id]);
  await ledger(app.pool,{characterId:p.id,currency:'cash',amount:50000.5-ch.cash-ch.bank,reason:'crime:finance-fixture'});
  return p;
}
const single=(p,fn)=>withCharacter(app.pool,p.accountId,(ch,c,h)=>fn(ch,c,h));
const pair=(a,b,fn)=>withTwoCharacters(app.pool,a.accountId,b.id,(ch,other,c,h)=>fn(ch,other,c,h),{meet:false});
const cash=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
const requestRow=async id=>(await app.pool.query('SELECT * FROM delivery_loan_requests WHERE id=$1',[id])).rows[0];
const loanRow=async id=>(await app.pool.query('SELECT * FROM loans WHERE id=$1',[id])).rows[0];
async function commitment(buyer,supplier) {
  const depot=(await call('POST','/v1/depot',buyer,{salePrice:2500,bidPrice:2000,targetStock:5,reorderAt:0,restockBudget:11000})).id;
  await call('POST',`/v1/depot/${depot}/fund`,buyer,{amount:15000});
  const order=(await call('POST',`/v1/depot/${depot}/restock`,buyer)).id;
  const c=await call('POST',`/v1/market/${order}/accept-delivery`,supplier,{qty:5,maxProcurementCash:10000,deadlineSeconds:1200,unitPrice:2000});
  return {id:c.id,order,depot};
}
const terms=(s,l,c)=>({supplierId:s.id,lenderId:l.id,commitmentId:c.id,principal:5000,rate:0.1,hours:1});
const request=(s,l,c,key=crypto.randomUUID())=>pair(s,l,(ch,other,client,h)=>Finance.requestDeliveryAdvance(ch,other,terms(s,l,c),key,client,h));
const offer=(l,s,id)=>pair(l,s,(ch,other,c,h)=>Finance.offerDeliveryAdvance(ch,other,id,c,h));
const take=(s,l,id)=>pair(s,l,(ch,other,c,h)=>Finance.takeDeliveryAdvance(ch,other,id,c,h));
const settle=(s,l,id,qty=5)=>pair(s,l,(ch,other,c,h)=>Finance.deliverFinancedCommitment(ch,other,id,qty,c,h));
const procurement=(s,c)=>single(s,(ch,client,h)=>Delivery.deliveryStep(ch,c.id,'delivery_buy',{goodId:'gin',qty:5},client,h));
async function snapshot(c) {
  return {characters:(await app.pool.query('SELECT id,cash FROM characters ORDER BY id')).rows,
    cargo:(await app.pool.query('SELECT * FROM character_cargo ORDER BY character_id,good_id')).rows,
    order:(await app.pool.query('SELECT * FROM market_listings WHERE id=$1',[c.order])).rows,
    commitment:(await app.pool.query('SELECT * FROM delivery_commitments WHERE id=$1',[c.id])).rows,
    loans:(await app.pool.query('SELECT * FROM loans ORDER BY id')).rows,
    requests:(await app.pool.query('SELECT * FROM delivery_loan_requests ORDER BY id')).rows,
    receipts:Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n)};
}
try {
  const buyer=await actor('FinBuyer'),supplier=await actor('FinSupplier'),lender=await actor('FinLender'),outsider=await actor('FinOutside');
  await app.pool.query('UPDATE characters SET cash=5000.5 WHERE id=$1',[lender.id]);
  await ledger(app.pool,{characterId:lender.id,currency:'cash',amount:-45000,reason:'crime:finance-reserve-fixture'});
  const c=await commitment(buyer,supplier),key='finance-request-once';
  const beforeCash=await cash(lender),cancelOnly=(await request(supplier,lender,c,'finance-metadata-cancel')).request;
  await single(supplier,(ch,client)=>Finance.cancelRequestedDeliveryAdvance(ch,cancelOnly.id,client));
  await single(supplier,(ch,client)=>Finance.cancelRequestedDeliveryAdvance(ch,cancelOnly.id,client));
  assert.equal(await cash(lender),beforeCash);assert.equal((await requestRow(cancelOnly.id)).state,'cancelled');
  const r=(await request(supplier,lender,c,key)).request;
  assert.equal(await cash(lender),beforeCash,'Metadata request reserves no money');
  assert.equal((await request(supplier,lender,c,key)).request.id,r.id);
  assert.equal((await Finance.deliveryFinanceBoard(app.pool,outsider.accountId)).length,0);
  const funded=(await offer(lender,supplier,r.id)).request;
  assert.equal(await cash(lender),0.5,'The entire advance is in real loan escrow, not lender pocket cash');assert.equal((await offer(lender,supplier,r.id)).request.loanId,funded.loanId);
  await assert.rejects(single(supplier,(ch,client)=>Finance.assertDeliveryFinanceLoanTake(client,{...ch,invoicePermit:true},funded.loanId)),e=>e.code==='delivery_finance');
  // Capture a deferred continuation during the private permitted call. It may not retain authority after return.
  let release,late;
  const accepted=await pair(supplier,lender,async(ch,other,client,h)=>{
    let proxy,loanReads=0;
    proxy=new Proxy(client,{get(target,prop){if(prop!=='query')return Reflect.get(target,prop,target);return async(sql,args)=>{
      if(typeof sql==='string'&&sql.startsWith('SELECT * FROM loans WHERE id=$1 FOR UPDATE')) loanReads++;
      if(!late&&loanReads===2&&typeof sql==='string'&&sql.startsWith('SELECT * FROM loans WHERE id=$1 FOR UPDATE')) {
        await Finance.assertDeliveryFinanceLoanTake(proxy,ch,funded.loanId); // proves this capture is INSIDE the active permit
        const wait=new Promise(resolve=>{release=resolve;});
        late=wait.then(()=>Finance.assertDeliveryFinanceLoanTake(proxy,ch,funded.loanId));late.catch(()=>{});
      }
      return target.query(sql,args);
    };}});
    const result=await Finance.takeDeliveryAdvance(ch,other,r.id,proxy,h);release();
    await assert.rejects(late,e=>e.code==='delivery_finance');return result;
  });
  assert.equal(accepted.request.state,'active');assert.equal((await take(supplier,lender,r.id)).request.state,'active');
  assert.equal((await loanRow(funded.loanId)).status,'active');
  await assert.rejects(single(supplier,(ch,client)=>Finance.assertDeliveryFinanceDelivery(client,{...ch,settlementPermit:true},c.id)),e=>e.code==='delivery_finance');
  await procurement(supplier,c);
  const before=await snapshot(c),cashBefore=await cash(supplier);
  await assert.rejects(settle(supplier,lender,c.id,4),e=>e.code==='delivery_finance');assert.deepEqual(await snapshot(c),before);
  const delivered=await settle(supplier,lender,c.id);
  assert.equal(delivered.delivery.delivered,5);assert.equal(delivered.delivery.earned,9800);assert.equal(delivered.repayment.paid,5500);
  assert.equal(delivered.repayment.vig,loanVig(5500));assert.equal(delivered.repayment.toLender,5225);
  assert.equal(await cash(supplier),cashBefore+9800-5500);assert.equal(await cash(lender),beforeCash-5000+5225);
  const settled=await snapshot(c);assert.deepEqual((await settle(supplier,lender,c.id)).delivery,delivered.delivery);assert.deepEqual(await snapshot(c),settled);
  assert.equal((await loanRow(funded.loanId)).status,'repaid');
  await single(supplier,(ch,client)=>Finance.assertDeliveryFinanceDelivery(client,ch,c.id));
  // A separate real debtor may repay manually; metadata must release without another claim.
  const b2=await actor('FinBuyer2'),s2=await actor('FinSupplier2'),l2=await actor('FinLender2'),paperBuyer=await actor('FinPaperBuyer');
  const c2=await commitment(b2,s2),r2=(await request(s2,l2,c2)).request,f2=(await offer(l2,s2,r2.id)).request;
  await take(s2,l2,r2.id);await pair(s2,l2,(ch,l,client,h)=>Loans.repayLoan(ch,l,f2.loanId,client,h));
  await single(s2,(ch,client)=>Finance.assertDeliveryFinanceDelivery(client,ch,c2.id));assert.equal((await requestRow(r2.id)).state,'closed');
  // New consent after released debt can target the same still-untouched commitment.
  const r3=(await request(s2,l2,c2)).request,f3=(await offer(l2,s2,r3.id)).request;await take(s2,l2,r3.id);
  await single(l2,(ch,client,h)=>Loans.sellPaper(ch,f3.loanId,{price:4000},client,h));
  await pair(paperBuyer,l2,(ch,l,client,h)=>Loans.buyPaper(ch,l,f3.loanId,client,h));
  assert.equal((await loanRow(f3.loanId)).lender_character,paperBuyer.id);
  await procurement(s2,c2);await assert.rejects(settle(s2,l2,c2.id),e=>e.code==='delivery_finance');
  const paperCash=await cash(paperBuyer);await settle(s2,paperBuyer,c2.id);assert.equal(await cash(paperBuyer),paperCash+5225);
  if(postgres) {
    const br=await actor('FinRaceBuyer'),sr=await actor('FinRaceSup'),lr=await actor('FinRaceLend');
    const cr=await commitment(br,sr),rr=(await request(sr,lr,cr)).request;
    const funding=await Promise.all([offer(lr,sr,rr.id),offer(lr,sr,rr.id)]);
    assert.equal(funding[0].request.loanId,funding[1].request.loanId);assert.equal(await cash(lr),45000.5);
    await take(sr,lr,rr.id);await procurement(sr,cr);
    await app.pool.query("CREATE FUNCTION finance_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='loan:repay' THEN RAISE EXCEPTION 'finance repayment fixture failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER finance_fail BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION finance_fail()');
    const faultBefore=await snapshot(cr);await assert.rejects(settle(sr,lr,cr.id));assert.deepEqual(await snapshot(cr),faultBefore,'Repayment failure rolls back actual cargo/order/cash/debt/metadata');
    await app.pool.query('DROP TRIGGER finance_fail ON transactions');
    const race=await Promise.all([settle(sr,lr,cr.id),settle(sr,lr,cr.id)]);
    assert(race.every(value=>value.repayment.paid===5500));
    assert.equal(Number((await app.pool.query("SELECT COUNT(*) n FROM transactions WHERE character_id=$1 AND reason='market:fill'",[sr.id])).rows[0].n),1);
    assert.equal(Number((await app.pool.query("SELECT COUNT(*) n FROM transactions WHERE character_id=$1 AND reason='loan:repay'",[sr.id])).rows[0].n),1);
  }
  console.log(JSON.stringify({status:'PASS',database:postgres?'PostgreSQL':'pg-mem',serverVersion:postgres?(await app.pool.query('SHOW server_version')).rows[0].server_version:null,
    principal:5000,actualGross:10000,actualMarketTake:200,actualNet:9800,actualDebtPayment:5500,actualVig:275,
    scope:'Actual canonical loan offer/take/full cargo purchase/delivery/repayment, manual release and paper creditor; SQL-client permission lifetime; native race/rollback when postgres. Legacy take/delivery interception and full estate proofs require root shared hooks.'}));
} finally {await app.close();}
