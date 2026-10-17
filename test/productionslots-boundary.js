import assert from 'node:assert/strict';
import {fixture} from './productionslots-fixture.js';
import * as Production from '../src/companyproduction.js';
const f=await fixture(),{pool,tx,R,funded,specialize,offerTerms,invoke,state,books}=f;
try{
 await specialize();const q=await funded(),url=new URL('../src/productionslots.js',import.meta.url);url.searchParams.set('boundary','unbound-controller');
 const standalone=await import(url.href);
 assert.equal(Production.productionReservationAdmission,R.assertProductionSlotBeforeCraft,'Canonical central admission capability is installed');
 assert.notEqual(Production.productionReservationAdmission,standalone.assertProductionSlotBeforeCraft,'Standalone controller has no canonical admission capability');
 const body=offerTerms(q),before=await state();
 await assert.rejects(tx(c=>standalone.productionSlotAction(c,'maker','offer',body,'unbound-controller-offer')),/slot_hooks_unavailable/);
 assert.deepEqual(await state(),before);assert.deepEqual((await R.productionSlotBoard(pool,'other')).reservations,[]);
 const offered=await invoke('maker','offer',body,'canonical-controller-offer');assert.equal(offered.status,'offered');
 assert.equal(Production.productionReservationAdmission,R.assertProductionSlotBeforeCraft);await books();
 console.log('Actual funded N03/profile: standalone unbound controller FAILS CLOSED without effects; canonical central F01/private N03 admission stays installed and same offer succeeds PASS');
}finally{await pool.end();}
