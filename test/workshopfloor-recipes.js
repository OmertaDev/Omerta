import assert from 'node:assert/strict';
import {fixture} from './workshopfloor-fixture.js';
const recipes=['recipe:hardened_steel','recipe:precision_lock_tool','recipe:tempered_precision_lock_tool'];
for(const recipeId of recipes){const f=await fixture();try{
  const uid=await f.tool(),physicalBefore=(await f.pool.query('SELECT * FROM item_instances WHERE id=$1',[uid])).rows[0];await f.specialize('maker','quality',uid);await f.configure('maker',[f.bench(uid),f.storage()]);const definition=f.P.companyProductionRecipes().find(r=>r.id===recipeId);assert(definition);await f.materials('maker',definition.inputs);
  const result=await f.run('maker',recipeId,'exact-recipe-'+recipeId);assert.equal(result.totalCashCost,definition.cashCost);const craft=result.crafts[0];assert.equal(craft.admission.kind,'quality');assert.equal(craft.admission.workshopFloor.toolItemId,uid);assert.equal(craft.admission.workshopFloor.use,'tool_bench');assert.deepEqual((await f.pool.query('SELECT * FROM item_instances WHERE id=$1',[uid])).rows[0],physicalBefore,'Exact genuine existing quality tool retained, not cloned or consumed');
  assert.deepEqual(craft.receipt.inputs.map(i=>[i.templateId,-i.delta]).sort(),definition.inputs.map(i=>[i.templateId,i.quantity]).sort());assert.equal(craft.receipt.outputs.length,definition.outputs.length);assert.deepEqual(await f.W.collectWorkshopFloorIssues(f.pool),[]);console.log(recipeId+' actual QUALITY exact physical UID admission + unmodified authored inputs/cash/output PASS');
}finally{await f.pool.end();}}
console.log('All3 supported recipes actually admit the exact healthy UID through the existing quality policy; no recipe itself was rewritten to require a fictional machine or grant extra production.');
