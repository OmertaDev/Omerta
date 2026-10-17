// Refusal-only genuine private admission; no relocation execute or positive memory gameplay.
import assert from 'node:assert/strict';
import {fixture} from './manufacturinglicenses-integration-fixture.js';
const f=await fixture(),D=await import('../src/depot.js');
try{
 const owner=await f.player(),buyer=await f.player(),published=await f.published(owner,buyer);
 // Capture after ordinary G accrual, immediately before the tested read-only admission.
 let enteredState;
 const inspect=()=>f.G.withCharacter(f.pool,owner.account,async(ch,c,h)=>{enteredState=await f.snapshot();return D.canonicalDepotRelocationRuntime.inspect(c,ch,h,{businessId:owner.business,destination:'docks',agent:false});},{withActionScope:(c,a,run)=>D.canonicalDepotRelocationRuntime.withScope(c,a,{action:'quote',terms:{businessId:owner.business,destination:'docks'}},run)});
 await assert.rejects(inspect(),e=>e.code==='business_relocation'&&e.message==='manufacturing_license_obligation');assert.deepEqual(await f.snapshot(),enteredState);
 const old=(await f.pool.query('SELECT source_hash FROM manufacturing_licenses WHERE id=$1',[published.licenseId])).rows[0].source_hash;
 await f.pool.query('UPDATE manufacturing_licenses SET source_hash=$2 WHERE id=$1',[published.licenseId,'0'.repeat(64)]);
 await assert.rejects(inspect(),e=>e.code==='business_relocation'&&e.message==='manufacturing_license_history');assert.deepEqual(await f.snapshot(),enteredState);
 await f.pool.query('UPDATE manufacturing_licenses SET source_hash=$2 WHERE id=$1',[published.licenseId,old]);
 for(const column of ['licensor_business','licensee_business']){const table='unknown_relocation_'+column;await f.pool.query('CREATE TABLE '+table+'(id TEXT PRIMARY KEY,'+column+' TEXT)');await assert.rejects(inspect(),e=>e.code==='business_relocation'&&e.message==='unsupported_schema');assert.deepEqual(await f.snapshot(),enteredState);await f.pool.query('DROP TABLE '+table);}
 assert.equal((await f.pool.query('SELECT source_hash FROM manufacturing_licenses WHERE id=$1',[published.licenseId])).rows[0].source_hash,old);await f.books();console.log('PASS genuine N15 source and current live license prevent relocation; unknown exact license-business columns fail closed, measured histories/assets unchanged. No relocation execution/native claim.');
}finally{await f.app.close();}
