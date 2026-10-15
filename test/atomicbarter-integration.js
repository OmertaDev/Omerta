import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fixture } from './lib/consignments-fixture.js';
import * as B from '../src/atomicbarter.js';
import * as Rentals from '../src/equipmentrentals.js';
import { runEstate } from '../src/social/estate.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { ATOMIC_BARTER_SCHEMAS as schemas,ATOMIC_BARTER_CONTRACTS as contracts } from '../src/atomic-barter-contracts.js';
const f=await fixture(true),{app,pool,tx,tool,C,G,native}=f;
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);
const validate=ajv.compile({...schemas.AtomicBarterResult,components:{schemas}});
const token=a=>app.jwt.sign({sub:a,tv:0,agent:true});let n=0;
const call=(a,path,body,key='barter-http-'+ ++n)=>app.inject({method:body===undefined?'GET':'POST',url:'/v1/items/barter'+path,payload:body,headers:{...(a?{authorization:'Bearer '+token(a)}:{}),...(key?{'idempotency-key':key}:{})}});
const success=async(...args)=>{const r=await call(...args);assert.equal(r.statusCode,200,r.body);assert(validate(r.json()),JSON.stringify(validate.errors));return r.json();};
const books=async()=>{const r=await runLedgerInvariants(pool,{alert:false});assert.deepEqual(r.checks.filter(x=>!x.ok),[]);};
try{
 const api=(await app.inject({method:'GET',url:'/openapi.json'})).json();
 for(const [route,contract] of Object.entries(contracts)){
  const [method,url]=route.split(' '),op=api.paths[url]?.[method.toLowerCase()];
  assert.equal(op?.operationId,contract.operationId);assert.deepEqual(op.security,[{bearerAuth:[]}]);
  assert.deepEqual(op.responses['200'].content['application/json'].schema,contract.responseSchema);
  if(contract.requestSchema)assert.deepEqual(op.requestBody.content['application/json'].schema,contract.requestSchema);
  assert.deepEqual(op.parameters,contract.requestParameters);
 }
 const x=await tool('owner'),y=await tool('host'),body={counterpartyCharacter:'host-actor',offeredItemId:x,requestedItemId:y,expiresInSeconds:600};
 assert.equal((await call(null,'/create',body)).statusCode,401);
 assert.equal((await call('owner','/create',body,null)).statusCode,400);
 for(const bad of [null,[],1,{...body,authority:true}])assert.equal((await call('owner','/create',bad)).statusCode,400);
 assert.equal((await call('owner','?owner=host')).statusCode,400);
 assert.equal((await call('owner','/create?unknown=1',body)).statusCode,400);
 const q=await success('owner','/create',body,'create-original');
 assert.deepEqual(await success('owner','/create',body,'create-original'),q);
 assert.equal((await call('owner','/create',{...body,expiresInSeconds:601},'create-original')).statusCode,422);
 assert.equal((await call('other','/accept',{offerId:q.offerId,consent:true})).statusCode,400);
 assert.deepEqual((await call('other','')).json(),{offers:[]});
 assert.equal((await call('owner','/accept',{offerId:q.offerId,consent:true})).statusCode,400);
 const cashBefore=(await pool.query('SELECT id,cash FROM characters ORDER BY id')).rows;
 let done;
 if(native){
  const blocker=await pool.connect();let first;
  try{await blocker.query('BEGIN');await blocker.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE',['host-actor']);
   first=call('host','/accept',{offerId:q.offerId,consent:true},'accept-original').then(response=>({response}),error=>({error}));
   let waiting=false;for(let n=0;n<80;n++){if((await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query='SELECT * FROM characters WHERE id=$1 FOR UPDATE'")).rows.length){waiting=true;break;}await new Promise(r=>setTimeout(r,25));}assert(waiting,'real acceptance actor wait');
   const duplicate=await call('host','/accept',{offerId:q.offerId,consent:true},'accept-original');
   assert.equal(duplicate.statusCode,409,duplicate.body);assert.equal(duplicate.json().error,'in_progress');assert.equal(String(duplicate.headers['retry-after']),'1');
   assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[x])).rows[0].owner_id,'owner');
   await blocker.query('COMMIT');const result=await first;if(result.error)throw result.error;assert.equal(result.response.statusCode,200,result.response.body);done=result.response.json();assert(validate(done));
   await new Promise(r=>setTimeout(r,1000));
  }finally{await blocker.query('ROLLBACK');blocker.release();if(first)await first;}
 }else done=await success('host','/accept',{offerId:q.offerId,consent:true},'accept-original');
 assert.deepEqual(await success('host','/accept',{offerId:q.offerId,consent:true},'accept-original'),done);
 assert.deepEqual((await pool.query('SELECT id,cash FROM characters ORDER BY id')).rows,cashBefore);
 assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[x])).rows[0].owner_id,'host');
 assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[y])).rows[0].owner_id,'owner');
 assert.equal((await pool.query("SELECT id FROM item_events WHERE reason='atomic barter'")).rows.length,2);
 const cancelled=await success('owner','/create',{...body,offeredItemId:y,requestedItemId:x},'cancel-create');
 await success('owner','/cancel',{offerId:cancelled.offerId},'cancel-original');
 const z=await tool('other'),w=await tool('owner');
 const pending=await success('owner','/create',{...body,counterpartyCharacter:'other-actor',offeredItemId:w,requestedItemId:z},'estate-create');
 // Add actual consignment and rental rights to the same victim's finite actor union.
 const ctool=await tool('owner'),cq=await tx(c=>C.createConsignment(c,'owner',f.terms(ctool),'mixed-consign'));
 await tx(c=>C.acceptConsignment(c,'host',f.ref(cq),'mixed-consign-accept'));
 const rtool=await tool('host'),rq=await tx(c=>Rentals.createEquipmentRentalOffer(c,'host',{itemId:rtool,rentCash:100,depositCash:250,durationSeconds:60,offerSeconds:60,published:true},'mixed-rental'));
 await tx(c=>Rentals.acceptEquipmentRental(c,'buyer',{offerId:rq.offerId,maxRentCash:100,maxDepositCash:250,consent:true},'mixed-rental-accept'));
 // Host's pending barter adds another original counterpart to rental+consignment discovery.
 const htool=await tool('host'),otool=await tool('other');
 const mixedBody={...body,counterpartyCharacter:'other-actor',offeredItemId:htool,requestedItemId:otool};
 let hq;
 if(native){
  // Settle through genuine ordinary actions before testing the later pre-actor phase.
  await G.withCharacter(pool,'host',()=>({}));await G.withCharacter(pool,'buyer',()=>({}));
  const blocker=await pool.connect();let raced;
  try{
   await blocker.query('BEGIN');await blocker.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE',['buyer-actor']);
   raced=G.withTwoCharacters(pool,'buyer','host-actor',(_a,v,c,h)=>runEstate(c,h,v,'barter prelock race'),{meet:false}).then(value=>({value}),error=>({error}));
   let waiting=false;for(let n=0;n<80;n++){if((await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query='SELECT * FROM characters WHERE id=$1 FOR UPDATE'")).rows.length){waiting=true;break;}await new Promise(r=>setTimeout(r,25));}assert(waiting,'real estate first sorted actor lock wait');
   hq=await success('host','/create',mixedBody,'mixed-barter');
   await blocker.query('COMMIT');const result=await raced;assert.equal(result.error?.code,'contention');
   assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1',['host-actor'])).rows[0].alive,true);
  }finally{await blocker.query('ROLLBACK');blocker.release();if(raced)await raced;}
 }else hq=await success('host','/create',mixedBody,'mixed-barter');
 if(native){
  // Exact rows must roll back; PostgreSQL nextval consumption intentionally is not compared.
  const snapshot=async()=>({
   people:(await pool.query('SELECT * FROM characters ORDER BY id')).rows,
   barter:(await pool.query('SELECT * FROM atomic_barter_offers ORDER BY id')).rows,
   consignments:(await pool.query('SELECT * FROM consignments ORDER BY id')).rows,
   leases:(await pool.query('SELECT * FROM equipment_rental_leases ORDER BY id')).rows,
   items:(await pool.query('SELECT * FROM item_instances ORDER BY id')).rows,
   journals:(await pool.query('SELECT * FROM transactions ORDER BY id')).rows,
   events:(await pool.query('SELECT * FROM item_events ORDER BY sequence')).rows,
   guards:(await pool.query('SELECT * FROM item_mutation_guards ORDER BY idempotency_key')).rows,
  });const before=await snapshot();
  await assert.rejects(G.withTwoCharacters(pool,'buyer','host-actor',async(_a,v,c,h)=>{await runEstate(c,h,v,'barter late fault');throw Error('after-complete-barter-estate');},{meet:false}),/after-complete-barter-estate/);
  assert.deepEqual(await snapshot(),before,'All affected rows roll back, without a false sequence rollback obligation');
 }

 await assert.rejects(G.withTwoCharacters(pool,'buyer','host-actor',(_a,v,c,h)=>B.recoverAtomicBartersInEstate(c,v,h.rentalDeathScope,{}),{meet:false}),e=>e.code==='estate_scope');
 await G.withTwoCharacters(pool,'buyer','host-actor',async(_a,v,c,h)=>{
  const scope=await Rentals.assertEquipmentRentalDeathScope(c,v.id,h.rentalDeathScope);
  assert.deepEqual([...scope.ids].sort(),['buyer-actor','host-actor','other-actor','owner-actor']);
  await runEstate(c,h,v,'atomic barter actual estate fixture');
 },{meet:false});
 assert.equal((await pool.query('SELECT state FROM atomic_barter_offers WHERE id=$1',[hq.offerId])).rows[0].state,'party_dead');
 assert.equal((await pool.query('SELECT state FROM atomic_barter_offers WHERE id=$1',[pending.offerId])).rows[0].state,'offered');
 assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[htool])).rows[0].owner_id,'host');
 await pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES('host-heir','host','Barter heir',1,'foundry',500)");
 assert.equal((await call('host','/accept',{offerId:hq.offerId,consent:true},'heir-fresh')).statusCode,400);
 assert.deepEqual(await success('host','/create',mixedBody,'mixed-barter'),hq);
 await books();
 assert.equal(Object.keys(contracts).length,4);assert.equal(validate({...done,authority:true}),false);
 assert.equal(validate({...done,items:[done.items[0]]}),false);
 console.log(`Actual registered atomic barter ${native?'native18.4':'memory'} proposal PASS: four closed contracts/auth/query/body/key/foreign; actual two UID swap, exact historical replay; opaque canonical mixed rental+consignment+barter estate union, no heir authority, metadata-only death and complete global books. No sequence rollback equality claim.`);
}finally{await app.close();await pool.end();}
