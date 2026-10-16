import assert from 'node:assert/strict';
import { customerVaultFixture } from './customervaults-fixture.js';
import { runEstate } from '../src/social/estate.js';
import { runLedgerInvariants } from '../src/invariants.js';
const f=await customerVaultFixture(),{pool,V,runtime,owner,customers,stranger}=f;
const action=(p,a,b,k)=>runtime.action(p.account,a,b,k);
try{
  const service=(await action(owner,'open',{depotId:f.depotId,feeCash:100,lifetimeSeconds:3600,consent:true},'estate-open')).service;
  const deposits=[];for(let i=0;i<3;i++)deposits.push(await action(customers[i],'deposit',{serviceId:service.id,sourceHash:service.sourceHash,principal:10000,maxFeeCash:100,consent:true},'estate-deposit-'+i));
  await action(customers[0],'withdraw',{positionId:deposits[0].position.id,sourceHash:deposits[0].position.sourceHash,consent:true},'estate-prior-withdraw');deposits[0]=await action(customers[0],'deposit',{serviceId:service.id,sourceHash:service.sourceHash,principal:10000,maxFeeCash:100,consent:true},'estate-deposit-again');
  assert.deepEqual((await V.customerVaultDeathCounterparts(pool,owner.id)).sort(),customers.map(p=>p.id).sort());await f.books();
  // A missing final customer's reserve proof must roll back earlier refunds too, never strand a partial estate.
  const last=(await pool.query("SELECT reserve_debit FROM customer_vault_positions WHERE state='funded' ORDER BY service_id,id DESC LIMIT 1")).rows[0],amount=(await pool.query('SELECT amount FROM transactions WHERE id=$1',[last.reserve_debit])).rows[0].amount;
  await pool.query('UPDATE transactions SET amount=amount+1 WHERE id=$1',[last.reserve_debit]);const badSource=await f.state();await assert.rejects(f.pair(customers[0],owner,(_a,v,c,h)=>runEstate(c,h,v,'vault missing-proof rollback')));assert.deepEqual(await f.state(),badSource);await pool.query('UPDATE transactions SET amount=$2 WHERE id=$1',[last.reserve_debit,amount]);await f.books();
  const customerCash=await Promise.all(customers.map(p=>f.cash(p)));let estateCash;
  const died=await f.pair(customers[0],owner,async(actor,victim,c,h)=>{
    estateCash=Number(victim.cash)+Number(victim.bank);
    // Ordinary existing gameplay state can be ahead of SQL until G persists. The exact refund DELTA must survive that persist.
    actor.cash-=7;await f.G.ledger(c,{characterId:actor.id,currency:'cash',amount:-7,reason:'crime:vault-estate-fixture'});
    return runEstate(c,h,victim,'vault operator estate proof');
  });
  assert(died);assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1',[owner.id])).rows[0].alive,false);
  assert.equal((await pool.query('SELECT state FROM customer_vault_services WHERE id=$1',[service.id])).rows[0].state,'closed');
  for(let i=0;i<3;i++)assert.equal(await f.cash(customers[i]),customerCash[i]+10000-(i===0?7:0));assert.equal((await V.customerVaultAccounting(pool)).reserve,0);await f.books();
  assert.equal(Number((await pool.query("SELECT SUM(amount) AS amount FROM transactions WHERE character_id=$1 AND currency='cash' AND reason='death:estate'",[owner.id])).rows[0].amount),-estateCash,'Operator estate includes only its actual accrued personal cash, never customer principal');
  const retained=await f.state(),replay=await action(customers[0],'deposit',{serviceId:service.id,sourceHash:service.sourceHash,principal:10000,maxFeeCash:100,consent:true},'estate-deposit-0');assert.equal(replay.replayed,true);assert.deepEqual(await f.state(),retained);
  await assert.rejects(action(customers[0],'withdraw',{positionId:deposits[0].position.id,sourceHash:deposits[0].position.sourceHash,consent:true},'estate-double-withdraw'));
  // Fresh independent original operator; dying customer gets principal before exactCash, with no heir title.
  const depot=await f.single(stranger,(ch,c,h)=>f.Depot.openDepot(ch,{salePrice:300,bidPrice:100,targetStock:8,reorderAt:0,restockBudget:5000},c,h));
  const s2=(await action(stranger,'open',{depotId:depot.id,feeCash:0,lifetimeSeconds:3600,consent:true},'customer-death-open')).service;
  const b={serviceId:s2.id,sourceHash:s2.sourceHash,principal:12000,maxFeeCash:0,consent:true},p=(await action(customers[1],'deposit',b,'customer-death-deposit')).position;let customerExactCash;
  await f.pair(customers[2],customers[1],(_a,v,c,h)=>{customerExactCash=Number(v.cash)+Number(v.bank);return runEstate(c,h,v,'vault customer estate proof');});
  const sink=Number((await pool.query("SELECT SUM(amount) AS amount FROM transactions WHERE character_id=$1 AND currency='cash' AND reason='death:estate'",[customers[1].id])).rows[0].amount);assert.equal(sink,-(customerExactCash+12000),'Dying original principal joins exact estate cash, never heir wealth');assert.equal((await pool.query('SELECT remaining FROM customer_vault_positions WHERE id=$1',[p.id])).rows[0].remaining,0);await f.books();
  const ack=await action(customers[1],'deposit',b,'customer-death-deposit');assert.equal(ack.replayed,true);assert.equal(ack.executionAuthority,false);await assert.rejects(action(customers[1],'withdraw',{positionId:p.id,sourceHash:p.sourceHash,consent:true},'heir-fresh-withdraw'));
  const global=await runLedgerInvariants(pool,{alert:false});assert.deepEqual(global.checks.filter(v=>!v.ok),[]);
  for(const [currency,reason]of [['cash','customer_vault:fee_receive_extra'],['gin','customer_vault:fee_receive']]){
    const one=await f.G.ledger(pool,{characterId:stranger.id,currency,amount:1,reason,counterparty:'negative-vault-vocabulary'}),two=await f.G.ledger(pool,{characterId:stranger.id,currency,amount:-1,reason,counterparty:'negative-vault-vocabulary'});
    const rejected=await runLedgerInvariants(pool,{alert:false});assert.equal(rejected.checks.find(v=>v.name==='reason vocabulary').ok,false,'Neither suffix nor foreign-currency variants enter the five exact game-cash reasons');await pool.query('DELETE FROM transactions WHERE id=$1 OR id=$2',[one,two]);
  }
  assert.deepEqual((await runLedgerInvariants(pool,{alert:false})).checks.filter(v=>!v.ok),[]);
  console.log('Customer vault '+(f.native?'native18.4':'memory')+' actual shared estate integration PASS: genuine sealed preactor union and estate-start; three living principal refunds, acting killer DELTA retained, customer principal included in exact death sink, no heir title/double release; all '+global.checks.length+' actual global book checks. Actual canonical root preactor and estate-start hooks are exercised.');
}finally{await f.close();}
