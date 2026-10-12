import assert from 'node:assert/strict';
const native=process.argv.includes('--postgres');
assert(!process.env.DATABASE_URL,'Integrated employment proof rejects ambient DATABASE_URL');
if(native) {
  const url=new URL(process.env.GAME_EMPLOYMENT_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(url.protocol)); assert.equal(url.hostname,'127.0.0.1');
  const pilot=url.username==='pilot_runner'&&['35439','35449'].includes(url.port);
  const ci=url.username==='postgres'&&url.port==='5432'; assert(pilot||ci,'Only named local pilot or hosted-CI loopback test roles/ports');
  assert.match(url.pathname,/^\/employment_proof_[a-z0-9_]+$/);
  const { default:pg }=await import('pg'), pre=new pg.Pool({ connectionString:url.href });
  try { assert.match((await pre.query('SHOW server_version')).rows[0].server_version,pilot?/^18\.4(?:\D|$)/:/^(?:16(?:\D|$)|18\.4(?:\D|$))/); assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0); }
  finally { await pre.end(); }
  process.env.DATABASE_URL=url.href;
}
Object.assign(process.env,{ DEPOT_PILOT:'on',DELIVERY_CONTRACTS:'on',RESOURCE_ECONOMY:'off',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',
  JWT_SECRET:'employment-integration-local-proof-secret',MARKET_SEED:'employment-integration-native-local-seed',MOD_KEY:'employment-integration-local-mod' });
const { buildServer }=await import('../src/server.js'), G=await import('../src/game.js');
const { runEstate }=await import('../src/social/estate.js'), { runLedgerInvariants }=await import('../src/invariants.js');
const { M3,seasonModOf,loanOwed }=await import('../src/rules.js');
const app=await buildServer(); let serial=0;
// Require actual coordinator wiring. No registration seam or manual employment
// estate helper invocation is permitted in this integrated proof.
assert(app.hasRoute({ method:'POST',url:'/v1/company/employment' }),'Actual server must register employment routes');
if(!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
async function call(p,method,url,payload,key=`employment-integrated-${++serial}`) {
  const response=await app.inject({ method,url,payload,headers:{ ...(p?{ authorization:`Bearer ${p.token}` }:{}),'idempotency-key':key } });
  return { code:response.statusCode,body:response.json(),text:response.body,headers:response.headers };
}
const ok=result=>{ assert.equal(result.code,200,result.text); return result.body; };
async function player(agent=false) {
  const ownerToken=ok(await call(null,'POST','/v1/auth/guest')).token;
  const token=agent?ok(await call({ token:ownerToken },'POST','/v1/auth/agent-key')).token:ownerToken;
  const p={ token,ownerToken }; ok(await call(p,'POST','/v1/character',{ name:`Integrated Worker ${++serial}` }));
  const ch=ok(await call(p,'GET','/v1/me')).character;
  const stored=(await app.pool.query('SELECT account_id,cash,bank FROM characters WHERE id=$1',[ch.id])).rows[0];
  p.id=ch.id; p.account=stored.account_id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1",[p.id,new Date(Date.now()+3600000)]);
  await G.ledger(app.pool,{ characterId:p.id,currency:'cash',amount:100000-Number(stored.cash)-Number(stored.bank),reason:'crime:employment-integration-fixture' });
  return p;
}
const single=(p,fn)=>G.withCharacter(app.pool,p.account,fn);
const pair=(p,other,fn)=>G.withTwoCharacters(app.pool,p.account,other.id,fn,{ meet:false });
const balance=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
async function employer() {
  const p=await player(); await app.pool.query('INSERT INTO estates(account_id,tier) VALUES($1,1)',[p.account]);
  ok(await call(p,'POST','/v1/resources/company',{ expectedRevision:0,name:`Payroll Firm ${serial}`,published:true,premises:'estate' }));
  const depot=ok(await call(p,'POST','/v1/depot',{ salePrice:2500,bidPrice:2000,targetStock:5,reorderAt:0,restockBudget:11000 }));
  return { ...p,depotId:depot.id };
}
async function job(p,{ slots=2,wage=101,key='create',acceptHumans=true,acceptAgents=true }={}) {
  const body={ depotId:p.depotId,slots,wageCash:wage,acceptHumans,acceptAgents,expiresAt:new Date(Date.now()+1800000).toISOString() };
  const result=ok(await call(p,'POST','/v1/company/employment',body,key)); return { id:result.employmentId,body,key,reserve:slots*wage };
}
async function invariants(label) {
  const result=await runLedgerInvariants(app.pool,{ alert:false });
  assert.equal(result.ok,true,`${label}: ${JSON.stringify(result.checks.filter(check=>!check.ok))}`);
  const employment=result.checks.find(check=>check.name==='game employment escrow');
  assert(employment,`${label}: named employment invariant must be integrated, not manually appended by the test`);
  assert.equal(employment.ok,true);
  const loot=result.checks.find(check=>check.name==='game employment loot ledger'); assert(loot,`${label}: named payroll loot ledger check must be integrated`);
  assert.equal(loot.ok,true); return result;
}
async function employmentRow(id) { return (await app.pool.query('SELECT * FROM game_employment_jobs WHERE id=$1',[id])).rows[0]; }
async function freezeHeir(p,id) { await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[id,new Date(Date.now()+3600000)]); return { ...p,id }; }
try {
  const owner=await employer(), worker=await player(true), lender=await player();
  ok(await call(owner,'POST',`/v1/depot/${owner.depotId}/fund`,{ amount:15000 }));
  const order=ok(await call(owner,'POST',`/v1/depot/${owner.depotId}/restock`));
  const c=ok(await call(worker,'POST',`/v1/market/${order.id}/accept-delivery`,{ qty:5,unitPrice:2000,maxProcurementCash:10000,deadlineSeconds:1200 }));
  const employment=await job(owner), ownerCash=await balance(owner);
  const accepted=ok(await call(worker,'POST',`/v1/company/employment/${employment.id}/accept`,{ commitmentId:c.id,consent:true },'accept'));
  assert.equal(accepted.commitmentId,c.id);
  assert.equal((await call(worker,'POST',`/v1/company/employment/${employment.id}/claim`,{ commitmentId:c.id },'premature')).code,400);
  await invariants('reserved before delivery');
  const terms={ supplierId:worker.id,lenderId:lender.id,commitmentId:c.id,principal:5000,rate:0.1,hours:1 };
  const advance=ok(await call(worker,'POST','/v1/delivery-finance/requests',terms));
  ok(await call(lender,'POST',`/v1/delivery-finance/${advance.request.id}/offer`,{}));
  ok(await call(worker,'POST',`/v1/delivery-finance/${advance.request.id}/take`,{}));
  // Actual canonical procurement; finance's source settlement remains the sole
  // authority. No invented cargo/commitment completion or payroll helper call.
  await single(worker,async(ch,client,h)=>{
    const { deliveryStep }=await import('../src/delivery.js');
    return deliveryStep(ch,c.id,'delivery_buy',{ goodId:'gin',qty:5 },client,h);
  });
  const delivered=ok(await call(worker,'POST',`/v1/deliveries/${c.id}/deliver`,{ qty:5 }));
  assert.equal(delivered.delivery.delivered,5); assert.equal(delivered.repayment.paid,loanOwed(5000,0.1));
  const beforeWage=await balance(worker), wage=ok(await call(worker,'POST',`/v1/company/employment/${employment.id}/claim`,{ commitmentId:c.id },'claim'));
  assert.equal(wage.wageCash,101); assert.equal(await balance(worker),beforeWage+101); assert.equal(await balance(owner),ownerCash);
  assert.equal(Number((await employmentRow(employment.id)).paid_cash),101);
  const replay=await call(worker,'POST',`/v1/company/employment/${employment.id}/claim`,{ commitmentId:c.id },'claim'); ok(replay);
  assert.equal(replay.headers['x-idempotent-replay'],'true'); assert.equal(await balance(worker),beforeWage+101);
  assert.equal((await call(worker,'POST',`/v1/company/employment/${employment.id}/claim`,{ commitmentId:c.id },'double')).code,400);
  const ledger=(await app.pool.query("SELECT amount FROM transactions WHERE character_id=$1 AND reason LIKE 'employment:wage:%'",[worker.id])).rows;
  assert.equal(ledger.length,1); assert.equal(Number(ledger[0].amount),101);
  await invariants('financed work wage and replay');
  const stranger=await player(); const privateBoard=ok(await call(stranger,'GET','/v1/company/employment')); assert.equal(privateBoard.employment.length,0);
  const killed=await employer(), killer=await player(), doomed=await job(killed,{ slots:2,wage:101,key:'player-estate-create' });
  const beforeKill=await balance(killer), rate=Math.min(0.5,M3.CASH_LOOT_RATE*(seasonModOf().lootMult||1)), expectedLoot=Math.floor(doomed.reserve*rate);
  const death=await pair(killer,killed,(ch,target,client,h)=>runEstate(client,h,target,ch.name,{ killerCh:ch,loot:true }));
  const terminal=await employmentRow(doomed.id);
  assert.equal(terminal.state,'closed'); assert.equal(Number(terminal.escrow_cash),0);
  assert.equal(Number(terminal.looted_cash),expectedLoot); assert.equal(Number(terminal.burned_cash),doomed.reserve-expectedLoot);
  assert.equal(await balance(killer),beforeKill+expectedLoot,'Actual estate hook preserves original in-memory killer credit');
  const heir=await freezeHeir(killed,death.heirId), heirCash=await balance(heir);
  const oldReceipt=await call(heir,'POST','/v1/company/employment',doomed.body,doomed.key); ok(oldReceipt); assert.equal(oldReceipt.headers['x-idempotent-replay'],'true');
  assert.equal(await balance(heir),heirCash);
  assert.equal((await call(heir,'POST',`/v1/company/employment/${doomed.id}/close`,{})).code,400,'Heir receives historical metadata, no reserve authority');
  assert.equal((await call(heir,'POST','/v1/company/employment',{ ...doomed.body,expiresAt:new Date(Date.now()+1800000).toISOString() })).code,400,'Old closed depot gives heir no new employer authority');
  await invariants('actual canonical player estate');
  const modVictim=await employer(), modJob=await job(modVictim,{ slots:1,wage:103,key:'mod-estate-create' });
  const mod=await app.inject({ method:'POST',url:'/v1/mod/kill',headers:{ 'x-mod-key':process.env.MOD_KEY },payload:{ characterId:modVictim.id,reason:'employment integrated mod burn proof' } });
  assert.equal(mod.statusCode,200,mod.body); await freezeHeir(modVictim,mod.json().heirId);
  const modState=await employmentRow(modJob.id); assert.equal(modState.state,'closed'); assert.equal(Number(modState.looted_cash),0); assert.equal(Number(modState.burned_cash),103);
  await invariants('actual authenticated mod estate');
  // A second actual estate on the same original victim is refused by the
  // canonical route, without directly invoking any feature's death helper.
  const duplicate=await app.inject({ method:'POST',url:'/v1/mod/kill',headers:{ 'x-mod-key':process.env.MOD_KEY },payload:{ characterId:modVictim.id } });
  assert.equal(duplicate.statusCode,400,duplicate.body); assert.equal(Number((await employmentRow(modJob.id)).burned_cash),103);
  if(native) {
    const rollbackVictim=await employer(), rollbackKiller=await player(), rollbackJob=await job(rollbackVictim,{ slots:1,wage:107,key:'rollback-estate-create' });
    const victimCash=await balance(rollbackVictim), killerCash=await balance(rollbackKiller);
    await assert.rejects(pair(rollbackKiller,rollbackVictim,async(ch,target,client,h)=>{
      await runEstate(client,h,target,ch.name,{ killerCh:ch,loot:true }); throw new Error('integrated estate rollback');
    }),/integrated estate rollback/);
    const unchanged=await employmentRow(rollbackJob.id); assert.equal(unchanged.state,'open'); assert.equal(Number(unchanged.escrow_cash),107); assert.equal(Number(unchanged.looted_cash),0); assert.equal(Number(unchanged.burned_cash),0);
    assert.equal(await balance(rollbackVictim),victimCash); assert.equal(await balance(rollbackKiller),killerCash);
    assert.equal((await app.pool.query('SELECT alive FROM characters WHERE id=$1',[rollbackVictim.id])).rows[0].alive,true);
    await invariants('actual integrated estate rollback');
  }
  // A canonical NPC actor is an existing game death input, not a new payroll
  // enrollee. Payroll must not block unrelated estates with no payroll jobs.
  const npcKiller=await player(), noPayroll=await player();
  await app.pool.query('UPDATE characters SET is_npc=true,npc_seed=100000 WHERE id=$1',[npcKiller.id]);
  const npcEmptyEstate=await pair(npcKiller,noPayroll,(ch,target,client,h)=>runEstate(client,h,target,'canonical NPC no-payroll proof',{ killerCh:ch,loot:true }));
  await freezeHeir(noPayroll,npcEmptyEstate.heirId);
  const npcVictim=await employer(), npcJob=await job(npcVictim,{ slots:1,wage:109,key:'npc-estate-create' }), beforeNpc=await balance(npcKiller);
  const npcFunded=await pair(npcKiller,npcVictim,(ch,target,client,h)=>runEstate(client,h,target,'canonical NPC funded-payroll proof',{ killerCh:ch,loot:true }));
  await freezeHeir(npcVictim,npcFunded.heirId);
  const npcRow=await employmentRow(npcJob.id), npcLoot=Math.floor(109*rate);
  assert.equal(Number(npcRow.looted_cash),npcLoot); assert.equal(Number(npcRow.burned_cash),109-npcLoot); assert.equal(await balance(npcKiller),beforeNpc+npcLoot);
  assert.equal((await call(npcKiller,'POST','/v1/company/employment',{ ...npcJob.body })).code,400,'Existing NPC estate loot does not authorize NPC employment enrollment');
  await invariants('canonical NPC death inputs and funded reserve');
  console.log(`gameemployment-integration ${native?'PostgreSQL18.4':'memory'}: actual server JWT employment+financed work+wage replay, canonical player/mod estate hooks, heirs and all global ledger invariants PASS`);
} finally { await app.close(); }
