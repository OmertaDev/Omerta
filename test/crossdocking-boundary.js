import assert from 'node:assert/strict';
import {fixture,eligibleHub} from './crossdocking-fixture.js';
const f=await fixture(),{pool,C,X,tool,terms,ref,invoke,state,books}=f;
try{
 const h=await eligibleHub(f),network=await invoke('owner','publish',terms(await tool()));
 await invoke('first','consent',ref(network));await invoke('second','consent',ref(network));await invoke('owner','dispatch',ref(network));
 const url=new URL('../src/crossdocking.js',import.meta.url);url.searchParams.set('boundary','unbound-controller');
 const standalone=await import(url.href);
 assert.equal(C.crossDockHandoffScope,X.withCrossDockHandoff,'Canonical shared capability is installed');
 assert.notEqual(C.crossDockHandoffScope,standalone.withCrossDockHandoff,'Standalone controller has no canonical handoff capability');
 const body={networkId:network.networkId,networkSourceHash:network.sourceHash,hubId:h.hub.id,expectedHubRevision:2,consent:true},before=await state();
 await assert.rejects(standalone.crossDockAction(pool,'owner','offer',body,'unbound-controller-offer'),e=>e.code==='cross_docking'&&e.message==='cross_dock_hooks_unavailable');
 assert.deepEqual(await state(),before);
 const offered=await X.crossDockAction(pool,'owner','offer',body,'canonical-controller-offer');assert.equal(offered.status,'offered');
 assert.equal(C.crossDockHandoffScope,X.withCrossDockHandoff);await books();
 console.log('Actual funded courier/paid hub: standalone unbound controller FAILS CLOSED without effects; canonical capability remains installed and same canonical offer succeeds PASS');
}finally{await pool.end();}
