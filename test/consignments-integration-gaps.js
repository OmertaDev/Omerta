import assert from 'node:assert/strict';
import {fixture} from './lib/consignments-fixture.js';
import {runEstate} from '../src/social/estate.js';
import {runLedgerInvariants} from '../src/invariants.js';
const f=await fixture(true),{app,pool,tool,terms,ref,invoke,C,G,native}=f;
const books=async()=>{assert.deepEqual(await C.collectConsignmentIssues(pool),[]);const r=await runLedgerInvariants(pool,{alert:false});assert.deepEqual(r.checks.filter(x=>!x.ok),[]);};
try{
 const item=await tool(),offer=await invoke('createConsignment','owner',terms(item),'owner-death-offer');await invoke('acceptConsignment','host',ref(offer),'owner-death-accept');
 const ownerBefore=Number((await pool.query("SELECT cash FROM characters WHERE id='owner-actor'")).rows[0].cash),hostBefore=Number((await pool.query("SELECT cash FROM characters WHERE id='host-actor'")).rows[0].cash);
 Object.assign(process.env,{PEN_YARD_EVENT:'quiet',SHANK_P:'1'});
 for(const who of ['buyer-actor','owner-actor'])await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1',[who,new Date(Date.now()+1800000)]);
 const token=app.jwt.sign({sub:'buyer',tv:0}),call=(url,key)=>app.inject({method:'POST',url,headers:{authorization:'Bearer '+token,'idempotency-key':key}});
 let r=await call('/v1/pen/buy/shiv','gap-shiv');assert.equal(r.statusCode,200,r.body);
 r=await call('/v1/pen/shank/owner-actor','gap-owner-shank');assert.equal(r.statusCode,200,r.body);assert.equal(r.json().kill,true);const heir=r.json().estate.heirId;
 assert.equal((await pool.query("SELECT alive FROM characters WHERE id='owner-actor'")).rows[0].alive,false);
 assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE id='owner-actor'")).rows[0].cash),0);
 const prestige=Number((await pool.query("SELECT prestige FROM account_persistent WHERE account_id='owner'")).rows[0].prestige);assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1',[heir])).rows[0].cash),500+100*prestige);
 assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE id='host-actor'")).rows[0].cash),hostBefore);
 assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[item])).rows[0],{owner_scope:'account',owner_id:'owner',state:'active'});
 assert.equal((await pool.query('SELECT COUNT(*) n FROM operation_escrow WHERE item_id=$1',[item])).rows[0].n.toString(),'0');
 assert.equal((await pool.query('SELECT status FROM consignments WHERE id=$1',[offer.consignmentId])).rows[0].status,'party_dead');
 assert.equal(Number((await pool.query("SELECT amount FROM transactions WHERE character_id='owner-actor' AND reason='death:estate' AND currency='cash'")).rows[0].amount),-ownerBefore);
 assert.equal((await pool.query("SELECT COUNT(*) n FROM transactions WHERE counterparty=$1 AND reason IN ('consignment:purchase','consignment:proceeds','consignment:host_fee')",[offer.consignmentId])).rows[0].n.toString(),'0');
 assert.deepEqual(await invoke('acceptConsignment','host',ref(offer),'owner-death-accept'),{ok:true,...offer,status:'active'});
 await assert.rejects(invoke('cancelConsignment','owner',ref(offer),'owner-heir-fresh'),/original_actor/);await books();
 console.log('actual registered public Pen.shank owner death: original account UID return, zero host fee, ordinary estate cash burn/canonical prestige heir stake, history ACK/no heir authority/global books PASS');
 const otherItem=await tool('other'),pending=await invoke('createConsignment','other',terms(otherItem),'new-counterpart-offer');
 if(native){
  let seenResolve,resumeResolve;const seen=new Promise(r=>seenResolve=r),resume=new Promise(r=>resumeResolve=r);let paused=false,entered=false,acceptedState;
  const instrumented=new Proxy(pool,{get(target,key){if(key==='connect')return async()=>{const client=await target.connect();return new Proxy(client,{get(c,k){if(k==='query')return async(...args)=>{const value=await c.query(...args);if(!paused&&args[0]==="SELECT owner_character,host_character FROM consignments WHERE status='active' AND (owner_character=$1 OR host_character=$1) ORDER BY id LIMIT 25"&&args[1]?.[0]==='host-actor'){paused=true;seenResolve();await resume;}return value;};const v=c[k];return typeof v==='function'?v.bind(c):v;}});};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
  const death=G.withTwoCharacters(instrumented,'buyer','host-actor',async()=>{entered=true;},{meet:false});const rejection=assert.rejects(death,e=>e.code==='contention'&&/counterpart/.test(e.message));
  await Promise.race([seen,new Promise((_,reject)=>setTimeout(()=>reject(Error('preactor discovery not observed')),5000))]);
  try{await invoke('acceptConsignment','host',ref(pending),'new-counterpart-accept');acceptedState=await f.state();}finally{resumeResolve();}
  await rejection;assert.deepEqual(await f.state(),acceptedState,'Refused stale union adds no cash/custody/receipt/metadata effects');assert.equal(entered,false,'canonical postlock union must reject before gameplay/estate callback');
  assert.equal((await pool.query("SELECT alive FROM characters WHERE id='host-actor'")).rows[0].alive,true);
  assert.equal((await pool.query('SELECT status FROM consignments WHERE id=$1',[pending.consignmentId])).rows[0].status,'active');
  console.log('native actual preactor discovery paused after genuine read; concurrent host acceptance commits new original counterpart; canonical fresh union refuses contention before gameplay PASS');
 }else await invoke('acceptConsignment','host',ref(pending),'new-counterpart-accept');
 await G.withTwoCharacters(pool,'buyer','host-actor',async(_actor,victim,c,h)=>{await runEstate(c,h,victim,'fresh complete consignment union');},{meet:false});
 assert.equal((await pool.query('SELECT status FROM consignments WHERE id=$1',[pending.consignmentId])).rows[0].status,'party_dead');
 assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[otherItem])).rows[0],{owner_scope:'account',owner_id:'other',state:'active'});await books();
 console.log(`consignments integrated gaps ${native?'native18.4':'memory'} PASS: public owner estate + fresh union retry original title/global books`);
}finally{await app.close();}
