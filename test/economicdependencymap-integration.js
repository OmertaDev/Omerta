import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { dependencyMapFixture } from './decision-dependency-integration-fixture.js';
import { economicDependencyMap } from '../src/economicdependencymap.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';
const f=await dependencyMapFixture(),pool=f.app.pool;
const spec=JSON.parse(fs.readFileSync(new URL('../docs/economic-dependency-map-integration.json',import.meta.url),'utf8')),ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);const validate=ajv.compile(spec.schemas.EconomicDependencyMap);
const graph=async(p=f.owner)=>{const r=await f.read(p);assert.equal(r.statusCode,200,r.body);const body=r.json();assert(validate(body),JSON.stringify(validate.errors));return body;};
const state=async()=>f.native?((({capturedAt,...state})=>state)(await canonicalDatabaseSnapshot(pool))):{books:(await pool.query('SELECT * FROM business_depot_journal ORDER BY id')).rows,transactions:(await pool.query('SELECT * FROM transactions ORDER BY id')).rows,characters:(await pool.query('SELECT * FROM characters ORDER BY id')).rows,orders:(await pool.query('SELECT * FROM market_listings ORDER BY id')).rows,commitments:(await pool.query('SELECT * FROM delivery_commitments ORDER BY id')).rows};
const refuse=async(fn,expected,...rest)=>{const before=await state();await assert.rejects(fn,expected,...rest);assert.deepEqual(await state(),before,'Failed reads preserve complete native rows and sequences');};
try{
 for(let i=0;i<5;i++)await f.buy(f.buyers[i%3]);await f.single(f.owner,(ch,c)=>f.Depot.configureDepot(ch,f.depotId,{...f.config,reorderAt:3},c));
 const order=await f.single(f.owner,(ch,c,h)=>f.Depot.restockDepot(ch,f.depotId,c,h)),orderId=order.orderId||order.id;
 const commitment=await f.single(f.supplier,(ch,c)=>f.D.acceptDelivery(ch,orderId,{qty:3,unitPrice:100,maxProcurementCash:1000,deadlineSeconds:600},c));
 await f.single(f.supplier,(ch,c,h)=>f.D.deliveryStep(ch,commitment.id,'delivery_buy',{goodId:'gin',qty:3},c,h));
 await f.single(f.supplier,(ch,c,h)=>f.D.deliverCommitment(ch,commitment.id,2,c,h));
 const before=await state(),g=await graph();assert.equal(g.status,'verified');assert.equal(validate({...g,authorityToken:'not allowed'}),false);const active=g.orders.find(x=>x.orderId===orderId);assert.equal(active.initialFundedUnits,5);assert.equal(active.currentFundedUnits,3);assert.equal(active.currentFundedCash,300);assert.equal(active.reservedUnits,1);assert.equal(active.unassignedFundedUnits,2);assert.equal(active.awaitingReceiveUnits,2);assert.equal(active.obligations[0].fundedCash,100);
 assert.equal(g.relationships.find(x=>x.commitmentId===commitment.id).recordedDeliveredUnits,2);assert.equal(g.relationships[0].paymentAttribution,'not_uniquely_recorded');assert(g.bottlenecks.some(x=>x.kind==='funded_units_without_current_supplier'));assert(g.bottlenecks.some(x=>x.kind==='delivered_goods_await_canonical_receive'));
 assert.equal((await f.read(null)).statusCode,401);assert.equal((await f.read(f.owner,f.depotId,'?refresh=true')).statusCode,400);assert.equal((await f.read(f.stranger)).json().message,'not_found');assert.equal((await f.read(f.stranger,'missing-business')).json().message,'not_found');
 const agent=(await f.read(f.owner,f.depotId,'',true)).json();assert.equal(agent.orders.find(x=>x.orderId===orderId).currentFundedCash,300);for(const secret of [f.supplier.account,f.owner.account,f.supplier.token,'maxProcurementCash','spend_limit','customer_character'])assert(!JSON.stringify(g).includes(secret));
 assert.deepEqual(await state(),before,'All native tables/row timestamps/IDs and sequences stay exact; only observer capture time excluded');
 await f.single(f.owner,(ch,c)=>f.Depot.receiveDepot(ch,f.depotId,orderId,c));const received=await graph();assert.equal(received.orders.find(x=>x.orderId===orderId).receivedUnits,2);
 await f.single(f.supplier,(ch,c,h)=>f.D.deliverCommitment(ch,commitment.id,1,c,h));const completed=await graph();assert.equal(completed.relationships.find(x=>x.commitmentId===commitment.id).status,'delivered');assert.equal(completed.relationships.find(x=>x.commitmentId===commitment.id).recordedDeliveredUnits,3);assert.equal(completed.orders.find(x=>x.orderId===orderId).reservedUnits,0);
 const second=await f.single(f.buyers[1],(ch,c)=>f.D.acceptDelivery(ch,orderId,{qty:2,unitPrice:100,maxProcurementCash:500,deadlineSeconds:f.native?60:600},c));
 if(f.native){
  // Real canonical minimum deadline, no forged clock/deadline or open transaction while waiting.
  const start=Date.now();while(Date.now()<=+new Date(second.deadline))await new Promise(resolve=>setTimeout(resolve,Math.min(1000,+new Date(second.deadline)-Date.now()+20)));
  const beforeExpired=await state(),expired=await graph(),edge=expired.orders.find(x=>x.orderId===orderId).obligations.find(x=>x.commitmentId===second.id);
  assert.equal(edge.state,'deadline_or_order_unavailable');assert.equal(edge.fundedCash,0);assert.equal(expired.orders.find(x=>x.orderId===orderId).unassignedFundedUnits,2);assert(expired.bottlenecks.some(x=>x.kind==='expired_commitment_requires_canonical_recovery'&&x.units===2));assert.deepEqual(await state(),beforeExpired);
  console.log('Real elapsed canonical commitment deadline observed without writes; waitedMs='+String(Date.now()-start));
 }
 const funding=(await pool.query("SELECT id,reason FROM business_depot_journal WHERE order_id=$1 AND reason='restock_escrow'",[orderId])).rows[0];await pool.query('UPDATE business_depot_journal SET reason=$2 WHERE id=$1',[funding.id,'negative_missing_escrow']);await refuse(()=>economicDependencyMap(pool,f.owner.account,f.depotId),/funding_source/);await pool.query('UPDATE business_depot_journal SET reason=$2 WHERE id=$1',[funding.id,funding.reason]);
 await pool.query('UPDATE delivery_commitments SET unit_price=101 WHERE id=$1',[commitment.id]);await refuse(()=>economicDependencyMap(pool,f.owner.account,f.depotId),/commitment_source/);await pool.query('UPDATE delivery_commitments SET unit_price=100 WHERE id=$1',[commitment.id]);
 const originalTime=(await pool.query('SELECT expires_at FROM market_listings WHERE id=$1',[orderId])).rows[0].expires_at;
 await pool.query('UPDATE market_listings SET expires_at=$2 WHERE id=$1',[orderId,new Date(Date.now()-1)]);await refuse(()=>economicDependencyMap(pool,f.owner.account,f.depotId),/commitment_source/,'Expiry inconsistent with its exact canonical commitment must not remain a funded edge');await pool.query('UPDATE market_listings SET expires_at=$2 WHERE id=$1',[orderId,originalTime]);
 for(let n=0;n<201;n++)await pool.query("INSERT INTO business_depot_journal(id,depot_id,reason) VALUES($1,$2,'negative_dependency_capacity')",['negative-cap-'+n,f.depotId]);const truncatedBefore=await state();assert.equal((await graph()).reason,'complete_depot_book_exceeds_200');assert.deepEqual(await state(),truncatedBefore);await pool.query("DELETE FROM business_depot_journal WHERE depot_id=$1 AND reason='negative_dependency_capacity'",[f.depotId]);
 const {runEstate}=await import('../src/social/estate.js');await f.pair(f.stranger,f.owner,(_a,v,c,h)=>runEstate(c,h,v,'dependency map canonical estate'));
 const estateBefore=await state(),history=await graph();assert.equal(history.status,'unavailable');assert.equal(history.reason,'canonical_order_history_removed_at_estate');assert.equal(history.historyOnly,true);assert.equal(history.executionAuthority,false);assert.equal(Object.hasOwn(history,'orders'),false);assert.deepEqual(await state(),estateBefore);
 await f.invariants();console.log(`Economic dependency map ${f.native?'native18.4':'memory'} actual registered integration PASS: actual canonical funded procurement/acceptance/partial+completed delivery/receive; exact funded/unassigned quantities, private original supplier edges, unattributed open fills, stale/tampered/missing/truncated refusal and actual estate/heir historical-only all-row+sequence read invariance. Actual buildServer registration/auth/OpenAPI contracts exercised; no new execution authority.`);
}finally{await f.close();}
