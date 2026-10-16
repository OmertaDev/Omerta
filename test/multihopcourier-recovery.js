import assert from 'node:assert/strict';
import {fixture} from './multihopcourier-fixture.js';
import * as Rental from '../src/equipmentrentals.js';
const f=await fixture(true),{app,pool,C,tx,tool,terms,ref,invoke,state,books}=f;
const publish=async(a='owner')=>invoke(a,'publish',{...terms(await tool(a)),expiresInSeconds:60});
const agree=async q=>{await invoke('first','consent',ref(q));await invoke('second','consent',ref(q));return q;};
try{
 const incomplete=[await publish(),await publish()];for(const q of incomplete)await invoke('first','consent',ref(q));
 await assert.rejects(invoke('first','publish',{...terms(await tool('first')),firstCarrier:'owner'}),/role_limit/);
 const funded=await invoke('other','publish',{...terms(await tool('other')),firstCarrier:'third',secondCarrier:'fourth',expiresInSeconds:60});await invoke('third','consent',ref(funded));await invoke('fourth','consent',ref(funded));await invoke('other','dispatch',ref(funded));const ready=await invoke('other','publish',{...terms(await tool('other')),firstCarrier:'third',secondCarrier:'fourth',expiresInSeconds:60});await invoke('third','consent',ref(ready));await invoke('fourth','consent',ref(ready));
 // Actual account moderation status, not death; requester remains active.
 const ban=await app.inject({method:'POST',url:'/v1/mod/ban',headers:{'x-mod-key':process.env.MOD_KEY},payload:{accountId:'third',reason:'owned courier regression fixture'}});assert.equal(ban.statusCode,200,ban.body);
 const before=await state();await assert.rejects(invoke('third','travel',ref(funded)),/courier_original|original_actor/);assert.deepEqual(await state(),before);
 await assert.rejects(tx(c=>Rental.assertMultiHopCourierScope(c,funded.networkId,'other',{},'cancel')),/courier_scope/);
 await assert.rejects(tx(c=>Rental.withMultiHopCourierActors(c,{networkId:funded.networkId,accountId:'other',action:'cancel'},scope=>Rental.assertMultiHopCourierScope(c,funded.networkId,'other',scope,'travel'))),/courier_scope/);
 await assert.rejects(tx(c=>Rental.withMultiHopCourierActors(c,{networkId:funded.networkId,accountId:'other',action:'travel'},async()=>{})),/courier_original/);
 await assert.rejects(invoke('third','cancel',ref(funded)),/account|courier_original|banned/);
 const start=Date.now(),deadline=Math.max(...incomplete.map(q=>+new Date(q.expiresAt)),+new Date(funded.expiresAt),+new Date(ready.expiresAt));
 while(Date.now()<=deadline+30)await new Promise(r=>setTimeout(r,Math.min(1000,Math.max(1,deadline+31-Date.now()))));
 assert(Date.now()>=deadline);console.log('real fixed60s expiry elapsed; no clock or stored expiry mutation',Date.now()-start);
 // Funded expired source remains in the counterpart union, while expired unfunded history disappears.
 assert.deepEqual(await tx(c=>C.multiHopCourierDeathCounterparts(c,'owner-actor')),[]);
 assert.deepEqual(await tx(c=>C.multiHopCourierDeathCounterparts(c,'other-actor')),['fourth-actor','other-actor','third-actor']);
 const newOwn=await invoke('first','publish',{...terms(await tool('first')),firstCarrier:'owner'});assert.equal(newOwn.status,'offered');assert.deepEqual(await tx(c=>C.multiHopCourierDeathCounterparts(c,'first-actor')),['first-actor']);
 await assert.rejects(invoke('second','expire',ref(incomplete[0])),/account|party/);
 const retired=await invoke('first','expire',ref(incomplete[0]),'retire-incomplete');assert.equal(retired.status,'expired');assert.deepEqual(await invoke('first','expire',ref(incomplete[0]),'retire-incomplete'),retired);
 await invoke('owner','expire',ref(incomplete[1]));
 await invoke('fourth','expire',ref(ready));
 const recovered=await invoke('other','expire',ref(funded),'recover-banned');assert(recovered.refundTransaction);assert.equal(recovered.status,'expired');
 assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[funded.itemId])).rows[0],{owner_scope:'account',owner_id:'other',state:'active'});
 assert.deepEqual(await invoke('other','expire',ref(funded),'recover-banned'),recovered);await books();
 await pool.query("UPDATE accounts SET status='active' WHERE id='third'");
 const fault=await invoke('other','publish',{...terms(await tool('other')),firstCarrier:'third',secondCarrier:'fourth'});await invoke('third','consent',ref(fault));await invoke('fourth','consent',ref(fault));await invoke('other','dispatch',ref(fault));
 const snapshot=await state();let injected=false;const transport=new Proxy(pool,{get(target,key){if(key==='connect')return async()=>{const client=await target.connect();return new Proxy(client,{get(c,k){if(k==='query')return async(...args)=>{const result=await c.query(...args);if(!injected&&typeof args[0]==='string'&&args[0].startsWith('UPDATE multi_hop_couriers SET')&&args[1]?.[0]===fault.networkId){injected=true;throw Error('recovery-after-real-return-and-refund');}return result;};const value=c[k];return typeof value==='function'?value.bind(c):value;}});};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 await assert.rejects(C.multiHopCourierAction(transport,'other','cancel',ref(fault),'rollback-recovery'),/recovery-after-real-return-and-refund/);assert(injected);assert.deepEqual(await state(),snapshot);await invoke('other','cancel',ref(fault),'rollback-recovery');await books();

 // More expired terminal history than the live cap cannot block fresh owner/carrier or estate admission.
 for(let n=0;n<2;n++){const q=await publish();await invoke('first','consent',ref(q));await invoke('owner','cancel',ref(q));}
 const replacement=await invoke('first','publish',{...terms(await tool('first')),firstCarrier:'owner'});assert.equal(replacement.status,'offered');await books();
 console.log('COURIER-01/02 actual G/Items recovery, source/UID/real70 journal books, private wrong-action and active requester controls PASS');
}finally{await app.close();}
