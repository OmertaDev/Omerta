import assert from 'node:assert/strict';
import fs from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { decisionReplayFixture } from './decision-dependency-integration-fixture.js';
import { decisionReplay,decisionReplayBoard } from '../src/decisionreplay.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';
const f=await decisionReplayFixture(),pool=f.app.pool;
const spec=JSON.parse(fs.readFileSync(new URL('../docs/decision-replay-integration.json',import.meta.url),'utf8'));
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);const validators=Object.fromEntries(Object.entries(spec.schemas).map(([key,value])=>[key,ajv.compile(value)]));
const ok=async(p,path,agent=false)=>{const r=await f.read(p,path,agent);assert.equal(r.statusCode,200,r.body);const body=r.json(),validate=validators[path.startsWith('?')?'DecisionReplayBoard':'DecisionReplay'];assert(validate(body),JSON.stringify(validate.errors));return body;};
const publicState=async()=>({money:(await pool.query('SELECT * FROM transactions ORDER BY id')).rows,source:(await pool.query('SELECT * FROM idempotency ORDER BY account_id,key')).rows,facts:(await pool.query('SELECT * FROM agent_operating_memory_facts ORDER BY id')).rows,books:(await pool.query('SELECT * FROM business_depot_journal ORDER BY id')).rows,actors:(await pool.query('SELECT id,cash,energy,alive FROM characters ORDER BY id')).rows});
const snapshot=async()=>{if(!f.native)return publicState();const {capturedAt,...state}=await canonicalDatabaseSnapshot(pool);assert(capturedAt instanceof Date);return state;}; // Observer capture time is not stored database state; every row timestamp and sequence remains included.
try{
 await f.seedHistory();const terms={windowHours:24,horizonHours:4};
 const preview=(await f.call(f.owner,'POST','/v1/company/intelligence/'+f.depotId+'/preview',terms)).body;
 const publication=await f.call(f.owner,'POST','/v1/company/intelligence/publish',{...terms,depotId:f.depotId,consent:true,price:300,expiresInSeconds:600,evaluationAt:preview.evaluationAt,sourceHash:preview.sourceHash,reportHash:preview.reportHash},'replay-publish',true);assert.equal(publication.code,200,JSON.stringify(publication));
 const paid=await f.call(f.buyers[0],'POST','/v1/company/intelligence/'+publication.body.publication.id+'/purchase',{consent:true,maxPrice:300,reportHash:preview.reportHash},'replay-purchase',true);assert.equal(paid.code,200,JSON.stringify(paid));
 // Refill using actual funded canonical leaves before capturing the next observed configuration.
 await f.single(f.owner,(ch,c)=>f.Depot.configureDepot(ch,f.depotId,{...f.config,reorderAt:3},c));
 const order=await f.single(f.owner,(ch,c,h)=>f.Depot.restockDepot(ch,f.depotId,c,h));const orderId=order.orderId||order.id;
 const qty=Number((await pool.query('SELECT qty FROM market_listings WHERE id=$1',[orderId])).rows[0].qty);
 const Econ=await import('../src/economy.js');await f.single(f.supplier,(ch,c,h)=>Econ.buyGood(ch,'gin',qty,c,h));await f.single(f.supplier,(ch,c,h)=>f.Market.fillOrder(ch,orderId,qty,c,h));await f.single(f.owner,(ch,c)=>f.Depot.receiveDepot(ch,f.depotId,orderId,c));
 const policy=await f.call(f.owner,'POST','/v1/agent/memory/policy',{expectedRevision:0,enabled:true},'memory-policy');assert.equal(policy.code,200,JSON.stringify(policy));
 const forecast=await f.call(f.owner,'POST','/v1/company/forecast/'+f.depotId,terms);assert.equal(forecast.code,200);assert.equal(forecast.body.status,'supported');
 const applyBody={...terms,consent:true,evidenceId:forecast.body.evidenceId},sourceKey='private-replay-forecast-source';
 const apply=await f.call(f.owner,'POST','/v1/company/forecast/'+f.depotId+'/apply',applyBody,sourceKey);assert.equal(apply.code,200,JSON.stringify(apply));
 const capture=await f.call(f.owner,'POST','/v1/agent/memory/capture',{kind:'forecast',sourceRequestKey:sourceKey,businessId:f.depotId,sourceBody:applyBody},'memory-capture');assert.equal(capture.code,200,JSON.stringify(capture));const factId=capture.body.factId;
 const purchasePath='/intelligence_purchase/'+paid.body.entitlement.id,factPath='/forecast_memory/'+factId;
 const before=await snapshot();
 assert.equal((await f.read(null,'?kind=forecast_memory')).statusCode,401);
 for(const path of ['?kind=production','?kind=forecast_memory&unknown=1','?kind[]=forecast_memory','?kind=forecast_memory&after[]=bad',purchasePath+'?refresh=true'])assert.equal((await f.read(f.owner,path)).statusCode,400,path);
 assert.equal((await f.read(f.stranger,purchasePath)).json().message,'not_found');assert.equal((await f.read(f.stranger,factPath)).json().message,'not_found');
 assert.deepEqual((await ok(f.stranger,'?kind=intelligence_purchase')).candidates,[]);
 const replay=await ok(f.buyers[0],purchasePath,true);assert.equal(replay.cost.gameCashDebited,300);assert.equal(replay.outcome.status,'report_delivered');assert.equal(replay.performanceClaim,'none');assert.deepEqual(await ok(f.buyers[0],purchasePath),replay);
 const unknown=await ok(f.owner,factPath);assert.equal(unknown.outcome.status,'unknown');assert.equal(unknown.cost.gameCashDebited,0);
 assert.equal((await ok(f.owner,'?kind=forecast_memory')).candidates[0].id,factId);
 const serialized=JSON.stringify({replay,unknown});for(const secret of [sourceKey,f.owner.account,f.owner.token,f.buyers[1].id])assert(!serialized.includes(secret),'No keys/account/bystander identities');
 assert.deepEqual(await snapshot(),before,'Replay reads leave all native rows AND sequences unchanged');
 for(let i=0;i<5;i++)await f.buy(f.buyers[i%3]);const observed=await f.call(f.owner,'POST','/v1/agent/memory/observe',{factId},'observe-replay');assert.equal(observed.code,200,JSON.stringify(observed));assert.equal(observed.body.outcome.status,'observed');
 const beforeObserved=await snapshot(),recorded=await ok(f.owner,factPath,true);assert.equal(recorded.outcome.operatingResult,observed.body.outcome.operatingResult);assert.equal(recorded.outcome.attribution,'not_established');assert.deepEqual(await snapshot(),beforeObserved);
 // As-of means later actual activity is not silently folded into an earlier recorded outcome.
 await f.buy();assert.deepEqual(await ok(f.owner,factPath),recorded);
 const transaction=(await pool.query('SELECT amount FROM transactions WHERE id=$1',[paid.body.payJournal])).rows[0];
 await pool.query('UPDATE transactions SET amount=$2 WHERE id=$1',[paid.body.payJournal,-299]);await assert.rejects(decisionReplay(pool,f.buyers[0].account,'intelligence_purchase',paid.body.entitlement.id),/source/);await pool.query('UPDATE transactions SET amount=$2 WHERE id=$1',[paid.body.payJournal,transaction.amount]);
 const fact=(await pool.query('SELECT * FROM agent_operating_memory_facts WHERE id=$1',[factId])).rows[0];
 await pool.query('UPDATE agent_operating_memory_facts SET source_proof_hash=$2 WHERE id=$1',[factId,'0'.repeat(64)]);await assert.rejects(decisionReplay(pool,f.owner.account,'forecast_memory',factId),/source/);await pool.query('UPDATE agent_operating_memory_facts SET source_proof_hash=$2 WHERE id=$1',[factId,fact.source_proof_hash]);
 await pool.query('UPDATE agent_operating_memory_facts SET outcome=$2 WHERE id=$1',[factId,{...fact.outcome,operatingResult:fact.outcome.operatingResult+1}]);await assert.rejects(decisionReplay(pool,f.owner.account,'forecast_memory',factId),/observation_source/);await pool.query('UPDATE agent_operating_memory_facts SET outcome=$2 WHERE id=$1',[factId,fact.outcome]);
 await pool.query('UPDATE economic_intelligence_purchases SET purchased_at=$2 WHERE id=$1',[paid.body.entitlement.id,new Date(Date.now()+60000)]);await assert.rejects(decisionReplay(pool,f.buyers[0].account,'intelligence_purchase',paid.body.entitlement.id),/source_window/);await pool.query('UPDATE economic_intelligence_purchases SET purchased_at=$2 WHERE id=$1',[paid.body.entitlement.id,new Date(paid.body.entitlement.purchasedAt)]);
 await assert.rejects(decisionReplayBoard(pool,f.owner.account,{kind:'forecast_memory',limit:1000}),/terms/);
 await pool.query('UPDATE agent_operating_memory_facts SET baseline_ids=$2 WHERE id=$1',[factId,JSON.stringify(fact.baseline_ids.slice(1))]);await assert.rejects(decisionReplay(pool,f.owner.account,'forecast_memory',factId),/observation_source/);await pool.query('UPDATE agent_operating_memory_facts SET baseline_ids=$2 WHERE id=$1',[factId,JSON.stringify(fact.baseline_ids)]);
 const cached=(await pool.query('SELECT body_hash FROM idempotency WHERE account_id=$1 AND key=$2',[f.owner.account,sourceKey])).rows[0];await pool.query('UPDATE idempotency SET body_hash=$3 WHERE account_id=$1 AND key=$2',[f.owner.account,sourceKey,'0'.repeat(64)]);await assert.rejects(decisionReplay(pool,f.owner.account,'forecast_memory',factId),/source/);await pool.query('UPDATE idempotency SET body_hash=$3 WHERE account_id=$1 AND key=$2',[f.owner.account,sourceKey,cached.body_hash]);
 assert.equal(validators.DecisionReplay({...replay,authority:true}),false);assert.equal(validators.DecisionReplay({...recorded,outcome:{...recorded.outcome,guaranteedProfit:1}}),false);
 const {runEstate}=await import('../src/social/estate.js');await f.pair(f.stranger,f.owner,(_a,v,c,h)=>runEstate(c,h,v,'decision replay fixture estate'));
 const estateBefore=await snapshot();assert.deepEqual(await ok(f.owner,factPath),recorded,'Same account heir can read history, with no fresh execution grant');assert.deepEqual(await ok(f.buyers[0],purchasePath),replay,'Seller death does not fabricate a new purchase or remove owned history');assert.deepEqual(await snapshot(),estateBefore);
 await f.invariants();
 console.log(`Decision replay ${f.native?'native18.4':'memory'} actual registered integration PASS: actual F21 cash journals/report receipt and F04/F23 apply/observed books; as-of boundaries, unknown honesty, keys/privacy/cross-account/tamper refusal and exact all-row/sequence read-only snapshot. Actual buildServer registration/auth/OpenAPI contracts exercised; no new execution authority.`);
}finally{await f.close();}
