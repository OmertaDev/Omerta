import assert from 'node:assert/strict';
import { fixture } from './consignments-fixture.js';
const f=await fixture(),{pool,tx,I,C,native,tool,terms,ref,invoke,state}=f;
try{
const item=await tool(),offer=await invoke('createConsignment','owner',terms(item),'offer');
let invalidIndex=0;for(const invalid of [{...terms(item),price:0},{...terms(item),price:1000001},{...terms(item),hostFeeBps:2001},{...terms(item),lifetimeSeconds:59},{...terms(item),unknown:true}])await assert.rejects(invoke('createConsignment','owner',invalid,'invalid-'+(++invalidIndex)),/terms/);
assert.equal((await pool.query('SELECT owner_id,state FROM item_instances WHERE id=$1',[item])).rows[0].owner_id,offer.consignmentId);
assert.equal((await pool.query('SELECT depositor_id FROM operation_escrow WHERE item_id=$1',[item])).rows[0].depositor_id,'owner');
await assert.rejects(invoke('buyConsignment','buyer',ref(offer),'premature'),/buyer/);
await assert.rejects(invoke('acceptConsignment','other',ref(offer),'foreign-host'),/original_actor/);
await invoke('acceptConsignment','host',ref(offer),'accept');
await assert.rejects(invoke('buyConsignment','owner',ref(offer),'self'),/buyer/);
const before=await state();await assert.rejects(tx(async c=>{await C.buyConsignment(c,'buyer',ref(offer),'latefault');throw Error('late failure');}),/late failure/);assert.deepEqual(await state(),before);
await assert.rejects(tx(async c=>{try{await C.buyConsignment(c,'buyer',{...ref(offer),sourceHash:'0'.repeat(64)},'caught');}catch{}return 'must not commit';}),/source/);assert.deepEqual(await state(),before);
const bought=await invoke('buyConsignment','buyer',ref(offer),'purchase');assert.equal(bought.hostFee,10);assert.equal(bought.paid,101);assert.equal(bought.transactionIds.length,3);
assert.equal((await pool.query('SELECT owner_id,state FROM item_instances WHERE id=$1',[item])).rows[0].owner_id,'buyer');
const legs=(await pool.query("SELECT character_id,amount,reason FROM transactions WHERE counterparty=$1 ORDER BY reason",[offer.consignmentId])).rows;assert.equal(legs.length,3);assert.equal(legs.reduce((s,l)=>s+Number(l.amount),0),0);assert.deepEqual(legs.map(r=>Number(r.amount)),[10,91,-101]);
assert.deepEqual(await invoke('buyConsignment','buyer',ref(offer),'purchase'),bought);await assert.rejects(invoke('buyConsignment','buyer',{...ref(offer),sourceHash:'0'.repeat(64)},'purchase'),/request_conflict/);
const publicBoard=await tx(c=>C.consignmentBoard(c,'other'));assert(!JSON.stringify(publicBoard).includes(item));assert(!JSON.stringify(publicBoard).includes('owner-actor'));
const cancelled=await invoke('createConsignment','owner',terms(await tool()),'cancel-offer');await invoke('cancelConsignment','host',ref(cancelled),'host-cancel');assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=(SELECT item_id FROM consignments WHERE id=$1)',[cancelled.consignmentId])).rows[0].owner_id,'owner');
const expired=await invoke('createConsignment','owner',terms(await tool()),'expiry');await assert.rejects(invoke('expireConsignment','host',ref(expired),'too-early'),/not_expired/);
// Explicit administrative negative expiry fixture: hash mismatch never becomes a valid source.
await pool.query('UPDATE consignments SET expires_at=$2 WHERE id=$1',[expired.consignmentId,new Date(0)]);await assert.rejects(invoke('acceptConsignment','host',ref(expired),'changed-expiry'),/source/);
// Restore the deliberately corrupted negative fixture; no expiry backdating is a positive proof.
await pool.query('UPDATE consignments SET expires_at=$2 WHERE id=$1',[expired.consignmentId,new Date(expired.expiresAt)]);
const dead=await invoke('createConsignment','owner',terms(await tool()),'death');
await tx(async c=>{const scope=await C.prelockConsignmentDeath(c,'host-actor');await c.query('UPDATE characters SET alive=false WHERE id=$1',['host-actor']);await C.recoverConsignmentsAtDeath(c,'host-actor',scope);});
assert.equal((await pool.query('SELECT status FROM consignments WHERE id=$1',[dead.consignmentId])).rows[0].status,'party_dead');await assert.rejects(invoke('acceptConsignment','host',ref(dead),'dead-host'),/original_actor/);
await pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES('host-heir','host','Host heir',1,'foundry',500)");await assert.rejects(invoke('acceptConsignment','host',ref(dead),'heir-host'),/original_actor/);
assert.deepEqual(await invoke('acceptConsignment','host',ref(offer),'accept'),{ok:true,...offer,status:'active'});
await pool.query('UPDATE characters SET alive=false WHERE id=$1',['host-heir']);await pool.query('UPDATE characters SET alive=true WHERE id=$1',['host-actor']);
const race=await invoke('createConsignment','owner',terms(await tool()),'race');await invoke('acceptConsignment','host',ref(race),'race-accept');
if(native){const result=await Promise.allSettled([invoke('buyConsignment','buyer',ref(race),'buyer-race'),invoke('buyConsignment','other',ref(race),'other-race')]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);}else{await invoke('buyConsignment','buyer',ref(race),'buyer-race');await assert.rejects(invoke('buyConsignment','other',ref(race),'other-race'),/closed/);}
const duplicate=await invoke('createConsignment','owner',terms(await tool()),'duplicate');await invoke('acceptConsignment','host',ref(duplicate),'duplicate-accept');const replies=native?await Promise.all([invoke('buyConsignment','buyer',ref(duplicate),'same-key'),invoke('buyConsignment','buyer',ref(duplicate),'same-key')]):[await invoke('buyConsignment','buyer',ref(duplicate),'same-key'),await invoke('buyConsignment','buyer',ref(duplicate),'same-key')];assert.deepEqual(replies[0],replies[1]);
assert.deepEqual(await C.collectConsignmentIssues(pool),[]);
if(native){
  const expiring=await invoke('createConsignment','owner',terms(await tool()),'real-expiry');await invoke('acceptConsignment','host',ref(expiring),'real-expiry-accept');
  // Real sixty-second source lifetime; only the final two seconds contend, retaining normal8s lock timeout.
  for(let ms=+new Date(expiring.expiresAt)-Date.now()-1500;ms>0;ms-=Math.min(ms,10000))await new Promise(r=>setTimeout(r,Math.min(ms,10000)));
  const prior=await state(),blocker=await pool.connect();let pending;
  try{await blocker.query('BEGIN');const uid=(await pool.query('SELECT item_id FROM consignments WHERE id=$1',[expiring.consignmentId])).rows[0].item_id;await blocker.query('SELECT id FROM item_instances WHERE id=$1 FOR UPDATE',[uid]);
    pending=invoke('buyConsignment','buyer',ref(expiring),'after-wait').then(value=>({value}),error=>({error}));
    let witnessed=false;for(let n=0;n<80;n++){const waiting=(await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query='SELECT * FROM item_instances WHERE id=$1 FOR UPDATE'")).rows;if(waiting.length){witnessed=true;break;}await new Promise(r=>setTimeout(r,25));}assert(witnessed,'Actual buyer must wait on the canonical UID lock');
    const remaining=+new Date(expiring.expiresAt)-Date.now()+50;console.log('Native actual item-lock deadline wait',remaining);for(let ms=remaining;ms>0;ms-=Math.min(ms,10000))await new Promise(r=>setTimeout(r,Math.min(ms,10000)));await blocker.query('COMMIT');
  }finally{await blocker.query('ROLLBACK');blocker.release();}
  const outcome=await pending;assert.match(outcome.error?.message||'',/expired/);assert.deepEqual(await state(),prior);await invoke('expireConsignment','host',ref(expiring),'real-expiry-return');assert.deepEqual(await C.collectConsignmentIssues(pool),[]);
}
const ownerDeathItem=await tool(),ownerDeath=await invoke('createConsignment','owner',terms(ownerDeathItem),'owner-death');await invoke('acceptConsignment','host',ref(ownerDeath),'owner-death-accept');
await tx(async c=>{const scope=await C.prelockConsignmentDeath(c,'owner-actor');await c.query('UPDATE characters SET alive=false WHERE id=$1',['owner-actor']);await C.recoverConsignmentsAtDeath(c,'owner-actor',scope);});
assert.equal((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[ownerDeathItem])).rows[0].owner_id,'owner');
await pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES('owner-heir','owner','Owner heir',1,'foundry',500)");await assert.rejects(invoke('buyConsignment','buyer',ref(ownerDeath),'post-owner-death'),/closed/);
assert.deepEqual(await invoke('createConsignment','owner',terms(ownerDeathItem),'owner-death'),ownerDeath);assert.deepEqual(await C.collectConsignmentIssues(pool),[]);
console.log(`consignments ${native?'native':'memory'} PASS: authored physical UID escrow/title, original host consent, actual third-party transfer/three conserved cash legs/floor fee, exact replay, late/caught-failure full rollback, source drift, scoped component death recovery/heir refusal, serialized one-buyer/same-key. Shared estate/route integration remains root-owned.`);
}finally{await pool.end();}
