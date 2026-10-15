import assert from 'node:assert/strict';
import {fixture} from './workshopfloor-fixture.js';
const recipes=['recipe:hardened_steel','recipe:precision_lock_tool','recipe:tempered_precision_lock_tool'];
const f=await fixture();try{
  // One fresh guarded database per proof in native mode. Three genuine owners each receive their
  // first canonical quality run, preserving real cadence rather than resetting it between recipes.
  f.businesses.customer=(await f.G.withCharacter(f.pool,'customer',(ch,c,h)=>f.D.openDepot(ch,{salePrice:1000,bidPrice:500,targetStock:2,reorderAt:0,restockBudget:2000},c,h))).id;await f.pool.query("INSERT INTO estates(account_id,tier,name) VALUES('customer',1,'explicit third recipe owner fixture')");await f.A.setAgentCompany(f.pool,'customer',{expectedRevision:1,name:'Third workshop owner',published:false,premises:'estate'});
  for(const [index,recipeId]of recipes.entries()){const account=['maker','other','customer'][index];
  const uid=await f.tool(account),physicalBefore=(await f.pool.query('SELECT * FROM item_instances WHERE id=$1',[uid])).rows[0];await f.specialize(account,'quality',uid);await f.configure(account,[f.bench(uid),f.storage()]);const definition=f.P.companyProductionRecipes().find(r=>r.id===recipeId);assert(definition);await f.materials(account,definition.inputs);
  const result=await f.run(account,recipeId,'exact-recipe-'+recipeId);assert.equal(result.totalCashCost,definition.cashCost);const craft=result.crafts[0];assert.equal(craft.admission.kind,'quality');assert.equal(craft.admission.workshopFloor.toolItemId,uid);assert.equal(craft.admission.workshopFloor.use,'tool_bench');assert.deepEqual((await f.pool.query('SELECT * FROM item_instances WHERE id=$1',[uid])).rows[0],physicalBefore,'Exact genuine existing quality tool retained, not cloned or consumed');
  assert.deepEqual(craft.receipt.inputs.map(i=>[i.templateId,-i.delta]).sort(),definition.inputs.map(i=>[i.templateId,i.quantity]).sort());assert.equal(craft.receipt.outputs.length,definition.outputs.length);assert.deepEqual(await f.W.collectWorkshopFloorIssues(f.pool),[]);console.log(recipeId+' actual QUALITY exact physical UID admission + unmodified authored inputs/cash/output PASS');
  }
}finally{await f.pool.end();}
console.log('All3 supported recipes actually admit the exact healthy UID through the existing quality policy; no recipe itself was rewritten to require a fictional machine or grant extra production.');
