import assert from 'node:assert/strict';
import {fixture} from './multihopcourier-fixture.js';
import * as Rental from '../src/equipmentrentals.js';
const f=await fixture(),{pool,tx,C,tool,terms,ref,invoke,state,books}=f;
try {
 const q=await invoke('owner','publish',terms(await tool()),'offer');assert.equal(q.status,'offered');
 assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[q.itemId])).rows[0].owner_id,'owner');
 assert.deepEqual(await tx(c=>C.multiHopCourierDeathCounterparts(c,'first-actor')),[]);
 await assert.rejects(invoke('other','consent',ref(q),'foreign'),/carrier/);
 await invoke('first','consent',ref(q),'first-consent');await invoke('second','consent',ref(q),'second-consent');
 const before=await state();
 await assert.rejects(tx(c=>Rental.prelockEquipmentRentalDeathActors(c,['owner-actor','first-actor','second-actor'])),/death_scope/);
 assert.deepEqual(await state(),before);
 await assert.rejects(tx(c=>Rental.assertMultiHopCourierScope(c,q.networkId,'owner',{})),/courier_scope/);
 assert.deepEqual(await state(),before);
 assert.equal(typeof Rental.withMultiHopCourierActors,'function','Actual source-resolved private bridge is installed');
 const funded=await invoke('owner','dispatch',ref(q),'actual-closed-scope');assert.equal(funded.status,'first_leg');
 assert.deepEqual(await invoke('owner','dispatch',ref(q),'actual-closed-scope'),funded);
 assert.equal((await pool.query('SELECT owner_scope FROM item_instances WHERE id=$1',[q.itemId])).rows[0].owner_scope,'operation');
 await books();
 console.log('multi-hop courier actual private boundary PASS: generic3-subject and forged capability refuse unchanged; exact source-resolved bridge funds real UID/fees once. Prior missing-bridge refusal retained in component evidence.');
} finally {await pool.end();}
