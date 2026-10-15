import assert from 'node:assert/strict';
import {freightFixture} from './freightconsolidation-fixture.js';
const f=await freightFixture(),base='/v1/company/freight';
try{
  const g=await f.group(),outsider=await f.player();
  assert.equal((await f.call(null,'GET',base)).status,401);assert.equal((await f.call(g.supplier,'GET',base+'?unknown=1')).status,400);
  const before=await f.state();await assert.rejects(f.G.withCharacter(f.app.pool,g.supplier.account,(ch,c,h)=>f.F.createFreightConsolidation(ch,{commitmentIds:g.entries.map(e=>e.commitmentId),consent:true,expiresInSeconds:600},'missing-scope',c,h)),/scope/);assert.deepEqual(await f.state(),before);const proposal=await f.propose(g);assert.deepEqual(await f.state(),before,'Metadata booking cannot fund or move goods');
  assert.deepEqual((await f.ok(outsider,'GET',base)).batches,[]);
  const buyerBoard=(await f.ok(g.entries[0].buyer,'GET',base)).batches[0];assert.equal(buyerBoard.entries.length,1);assert.equal(buyerBoard.entries[0].buyerCharacter,g.entries[0].buyer.id);
  const denied=await f.call(g.supplier,'POST',`${base}/${proposal.batchId}/run`,{expectedRevision:proposal.revision,manifestHash:proposal.manifestHash},'not-consented');assert.equal(denied.status,400);assert.deepEqual(await f.state(),before);
  const ready=await f.approve(g,proposal),runBody={expectedRevision:ready.revision,manifestHash:ready.manifestHash};
  const result=await f.ok(g.supplier,'POST',`${base}/${ready.batchId}/run`,runBody,'one-trip',true);
  assert.equal(result.state,'completed');assert.equal(result.totalDelivered,4);assert.equal(result.handoffs.length,2);
  const after=await f.state(),supplierBefore=before.chars.find(r=>r.id===g.supplier.id),supplierAfter=after.chars.find(r=>r.id===g.supplier.id);
  assert.equal(supplierAfter.loc,'docks');assert.equal(Number(supplierAfter.cash),Number(supplierBefore.cash)-result.travel.cost+result.earned);
  for(const e of g.entries){const row=after.orders.find(r=>r.id===e.orderId),commitment=after.commitments.find(r=>r.id===e.commitmentId);assert.equal(Number(row.filled_qty),2);assert.equal(Number(row.qty),0);assert.equal(commitment.status,'delivered');assert.equal(Number(commitment.remaining),0);}
  assert.equal(Number(after.commitments.find(r=>r.id===g.entries[0].commitmentId).spent),result.travel.cost);
  assert.equal(Number(after.commitments.find(r=>r.id===g.entries[1].commitmentId).spent),0);
  const newTx=after.transactions.filter(r=>!before.transactions.some(old=>old.id===r.id));assert.equal(newTx.filter(r=>r.reason==='travel').length,1);assert.equal(newTx.filter(r=>r.reason==='market:fill').length,2);
  const replay=await f.call(g.supplier,'POST',`${base}/${ready.batchId}/run`,runBody,'one-trip',true);assert.equal(replay.status,200);assert.equal(replay.headers['x-idempotent-replay'],'true');assert.deepEqual(replay.body,result);assert.deepEqual(await f.state(),after);
  assert.equal((await f.call(g.supplier,'POST',`${base}/${ready.batchId}/run`,{...runBody,expectedRevision:99},'one-trip',true)).status,422);
  const killed=await f.app.inject({method:'POST',url:'/v1/mod/kill',payload:{characterId:g.supplier.id},headers:{'x-mod-key':process.env.MOD_KEY}});assert.equal(killed.statusCode,200,killed.body);assert(killed.json().heirId);const afterEstate=await f.state();const historical=await f.call(g.supplier,'POST',`${base}/${ready.batchId}/run`,runBody,'one-trip',true);assert.equal(historical.status,200);assert.deepEqual(historical.body,result);const domainAck=await f.F.replayFreightConsolidation(f.app.pool,g.supplier.account,'run',ready.batchId,runBody,'one-trip');assert.equal(domainAck.historicalAcknowledgement,true);assert.equal((await f.call(g.supplier,'POST',`${base}/${ready.batchId}/run`,runBody,'heir-fresh',true)).status,400);assert.deepEqual(await f.state(),afterEstate);
  await f.books();console.log(`freightconsolidation ${f.version} PASS: two genuine independently funded orders, explicit original consents, actual one-trip canonical4GIN handoff, exact per-order budgets/cash/cargo and replay; component registration only`);
}finally{await f.close();}
