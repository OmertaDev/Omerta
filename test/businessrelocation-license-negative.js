// Refusal-only genuine private admission; no relocation execute or positive memory gameplay.
import assert from 'node:assert/strict';
import {fixture} from './manufacturinglicenses-integration-fixture.js';
const f=await fixture(),D=await import('../src/depot.js');
try{
 const owner=await f.player(),buyer=await f.player(),published=await f.published(owner,buyer);
 const inspect=()=>f.G.withCharacter(f.pool,owner.account,(ch,c,h)=>D.canonicalDepotRelocationRuntime.inspect(c,ch,h,{businessId:owner.business,destination:'docks',agent:false}),{withActionScope:(c,a,run)=>D.canonicalDepotRelocationRuntime.withScope(c,a,{action:'quote',terms:{businessId:owner.business,destination:'docks'}},run)});
 const before=await f.snapshot();
 await assert.rejects(inspect(),e=>e.code==='business_relocation'&&e.message==='manufacturing_license_obligation');assert.deepEqual(await f.snapshot(),before);
 const old=(await f.pool.query('SELECT source_hash FROM manufacturing_licenses WHERE id=$1',[published.licenseId])).rows[0].source_hash;
 await f.pool.query('UPDATE manufacturing_licenses SET source_hash=$2 WHERE id=$1',[published.licenseId,'0'.repeat(64)]);const corrupt=await f.snapshot();
 await assert.rejects(inspect(),e=>e.code==='business_relocation'&&e.message==='manufacturing_license_history');assert.deepEqual(await f.snapshot(),corrupt);
 await f.pool.query('UPDATE manufacturing_licenses SET source_hash=$2 WHERE id=$1',[published.licenseId,old]);
 for(const column of ['licensor_business','licensee_business']){const table='unknown_relocation_'+column;await f.pool.query('CREATE TABLE '+table+'(id TEXT PRIMARY KEY,'+column+' TEXT)');await assert.rejects(inspect(),e=>e.code==='business_relocation'&&e.message==='unsupported_schema');await f.pool.query('DROP TABLE '+table);}
 assert.deepEqual(await f.snapshot(),before);await f.books();console.log('PASS genuine N15 source and current live license prevent relocation; unknown exact license-business columns fail closed, measured histories/assets unchanged. No relocation execution/native claim.');
}finally{await f.app.close();}
