import assert from 'node:assert/strict';
import {fixture} from './workshopfloor-fixture.js';
import {runEstate} from '../src/social/estate.js';
const f=await fixture();try{
  const p=await f.configure('maker',[f.service(),f.storage()],0,'estate-plan'),q=await f.fund();await f.G.withTwoCharacters(f.pool,'other','maker-actor',async(_actor,victim,c,h)=>runEstate(c,h,victim,'actual workshop owner estate'),{meet:false});assert.equal((await f.pool.query("SELECT alive FROM characters WHERE id='maker-actor'")).rows[0].alive,false);
  assert.equal((await f.pool.query('SELECT status FROM commissioned_crafting_contracts WHERE id=$1',[q.commissionId])).rows[0].status,'refunded');assert.deepEqual(await f.configure('maker',[f.service(),f.storage()],0,'estate-plan'),p);
  const before=await f.state();await assert.rejects(f.run('maker','recipe:precision_lock_tool','heir-old-workshop'),/business_owner/);assert.deepEqual(await f.state(),before);assert.deepEqual(await f.W.collectWorkshopFloorIssues(f.pool),[]);assert.deepEqual(await f.C.collectCommissionedCraftingIssues(f.pool),[]);
  console.log('Workshop floor '+(f.native?'native18.4':'memory')+' genuine G/private runEstate PASS: actual funded commission original recovery unaffected, plan/history retained without cash or actor-union changes, historical ACK grants no heir business/production authority. Native all-world rollback remains a separate gate.');
}finally{await f.pool.end();}
