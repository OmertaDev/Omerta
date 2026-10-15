// Negative admission only: genuine G frame, never invokes relocation execute or bypasses public native guard.
import assert from 'node:assert/strict';
import {fixture} from './workshopfloor-fixture.js';
const f=await fixture(),G=await import('../src/game.js'),D=await import('../src/depot.js');
try{
 await f.configure('maker',[f.service()]);
 const inspect=()=>G.withCharacter(f.pool,'maker',(ch,c,h)=>D.canonicalDepotRelocationRuntime.inspect(c,ch,h,{businessId:f.businesses.maker,destination:'docks',agent:false}),{withActionScope:(c,a,run)=>D.canonicalDepotRelocationRuntime.withScope(c,a,{action:'quote',terms:{businessId:f.businesses.maker,destination:'docks'}},run)});
 const state=await f.state();
 await assert.rejects(inspect(),e=>e.code==='business_relocation'&&e.message==='workshop_floor_allocations');assert.deepEqual(await f.state(),state);
 const row=(await f.pool.query('SELECT source_hash FROM workshop_floorplans WHERE business_id=$1',[f.businesses.maker])).rows[0];
 await f.pool.query('UPDATE workshop_floorplans SET source_hash=$2 WHERE business_id=$1',[f.businesses.maker,'0'.repeat(64)]);
 const corrupt=await f.state();await assert.rejects(inspect(),e=>e.code==='business_relocation'&&e.message==='floor_history');assert.deepEqual(await f.state(),corrupt);
 await f.pool.query('UPDATE workshop_floorplans SET source_hash=$2 WHERE business_id=$1',[f.businesses.maker,row.source_hash]);
 await f.pool.query('CREATE TABLE unknown_relocation_floor_ref(business_ref TEXT)');
 await assert.rejects(inspect(),e=>e.code==='business_relocation'&&e.message==='unsupported_schema');await f.pool.query('DROP TABLE unknown_relocation_floor_ref');assert.deepEqual(await f.state(),state);
 console.log('PASS genuine G/Items/preactor-scope read admission: real configured nonempty floor blocks, tampered historical source and unknown business_ref close; measured rows unchanged. No relocation execute/positive memory or native claim.');
}finally{if(f.app)await f.app.close();else await f.pool.end();}
