import assert from 'node:assert/strict';
import {fixture} from './customerlayaway-fixture.js';
import {runEstate} from '../src/social/estate.js';
import {runLedgerInvariants} from '../src/invariants.js';
import {canonicalDatabaseSnapshot} from '../tools/rc1-native-proof.js';
process.env.DEPOT_PILOT='on'; // Explicit synthetic in-game business fixture only.
const f=await fixture(true),{app,pool,G,native,tool,terms,ref,pay}=f;
const tokens=Object.fromEntries(['seller','buyer','third','fourth','other'].map(a=>[a,app.jwt.sign({sub:a,tv:0,agent:true})]));let serial=0;
const post=async(a,url,body,key='mixed-'+(++serial))=>{const r=await app.inject({method:'POST',url,payload:body,headers:{authorization:'Bearer '+tokens[a],'idempotency-key':key}});assert.equal(r.statusCode,200,r.body);return r.json();};
const balances=async()=>Object.fromEntries((await pool.query('SELECT id,cash FROM characters ORDER BY id')).rows.map(r=>[r.id,Number(r.cash)]));
const books=async()=>assert.deepEqual((await runLedgerInvariants(pool,{alert:false})).checks.filter(c=>!c.ok),[]);
try {
 const layaway=await post('seller','/v1/customer/layaway/offer',terms(await tool()));
 await post('buyer','/v1/customer/layaway/pay',pay(layaway,30),'mixed-installment');
 const Depot=await import('../src/depot.js');
 const depot=await G.withCharacter(pool,'seller',(ch,c,h)=>Depot.openDepot(ch,{salePrice:300,bidPrice:100,targetStock:8,reorderAt:0,restockBudget:5000},c,h));
 const vault=(await post('seller','/v1/company/vaults/open',{depotId:depot.id,feeCash:5,lifetimeSeconds:3600,consent:true})).service;
 const position=(await post('buyer','/v1/company/vaults/deposit',{serviceId:vault.id,sourceHash:vault.sourceHash,principal:300,maxFeeCash:5,consent:true},'mixed-vault-deposit')).position;
 const courier=await post('seller','/v1/company/courier-networks/publish',{itemId:await tool(),firstCarrier:'buyer',secondCarrier:'third',origin:'foundry',handoff:'docks',destination:'neon',firstFee:30,secondFee:40,expiresInSeconds:600,consent:true});
 const network={networkId:courier.networkId,sourceHash:courier.sourceHash,consent:true};
 await post('buyer','/v1/company/courier-networks/consent',network);await post('third','/v1/company/courier-networks/consent',network);
 await G.withCharacter(pool,'third',(ch,c,h)=>G.travel(ch,'docks',c,h));
 await post('seller','/v1/company/courier-networks/dispatch',network,'mixed-dispatch');await books();
 if(native){let before,attempted;
  await assert.rejects(G.withTwoCharacters(pool,'buyer','seller-actor',async(actor,victim,c,h)=>{
   await runEstate(c,h,victim,'mixed actual estate late fault');attempted=Number((await c.query('SELECT COUNT(*) n FROM item_events')).rows[0].n)-before.tables.item_events.length;throw Error('after-mixed-estate');
  },{meet:false,withActionScope:async(_c,_a,execute)=>{before=await canonicalDatabaseSnapshot(pool);return execute();}}),/after-mixed-estate/);
  const after=await canonicalDatabaseSnapshot(pool);assert.deepEqual(after.tables,before.tables);assert.equal(attempted,2);
  for(let i=0;i<before.sequences.length;i++){const a=after.sequences[i],b=before.sequences[i];if(b.sequencename==='item_events_sequence_seq')assert.equal(BigInt(a.last_value)-BigInt(b.last_value),2n);else assert.deepEqual(a,b);}
  console.log('Mixed estate native late fault: all canonical rows restored, exact two attempted UID-event allocator increments, all other sequences exact PASS');
 }
 await post('fourth','/v1/streets/seller-actor/bounty',{amount:500});
 for(const id of ['seller-actor','buyer-actor'])await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1',[id,new Date(Date.now()+1800000)]);
 Object.assign(process.env,{PEN_YARD_EVENT:'quiet',SHANK_P:'1'});await post('buyer','/v1/pen/buy/shiv');
 const before=await balances(),pot=Number((await pool.query("SELECT amount FROM bounties WHERE target_character='seller-actor'")).rows[0].amount);
 const death=await post('buyer','/v1/pen/shank/seller-actor');assert.equal(death.kill,true);
 const after=await balances();assert.equal(after['buyer-actor'],before['buyer-actor']+pot+300+30,'Both living-customer refund deltas preserve the actual unsaved killer bounty');
 const burn=(await pool.query("SELECT amount FROM transactions WHERE character_id='seller-actor' AND currency='cash' AND reason='death:estate'")).rows;assert.equal(burn.length,1);assert.equal(Number(burn[0].amount),-(before['seller-actor']+70),'Only original unearned courier fees join the dying seller cash; customer vault principal remains customer property');
 for(const item of [layaway.itemId,courier.itemId])assert.deepEqual((await pool.query('SELECT owner_scope,owner_id FROM item_instances WHERE id=$1',[item])).rows[0],{owner_scope:'account',owner_id:'seller'});
 assert.equal((await pool.query('SELECT status FROM customer_layaways WHERE id=$1',[layaway.layawayId])).rows[0].status,'party_dead');
 assert.equal(Number((await pool.query('SELECT remaining FROM customer_vault_positions WHERE id=$1',[position.id])).rows[0].remaining),0);
 assert.equal((await pool.query('SELECT status FROM multi_hop_couriers WHERE id=$1',[courier.networkId])).rows[0].status,'party_dead');
 await books();await f.books();
 const retained=await balances();assert.equal((await post('buyer','/v1/customer/layaway/pay',pay(layaway,30),'mixed-installment')).status,'active');await post('buyer','/v1/company/vaults/deposit',{serviceId:vault.id,sourceHash:vault.sourceHash,principal:300,maxFeeCash:5,consent:true},'mixed-vault-deposit');await post('seller','/v1/company/courier-networks/dispatch',network,'mixed-dispatch');assert.deepEqual(await balances(),retained);
 console.log('Actual registered mixed layaway/vault/courier estate '+(native?'native18.4':'memory')+' PASS: same-source title, genuine customer refunds, exact dying cash, no double effects, normal heir history and all global books');
} finally {await app.close();}
