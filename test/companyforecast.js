import assert from 'node:assert/strict';
import { demandFixture } from './companydemand-fixture.js';
import { applyCompanyForecast } from '../src/companyforecast.js';
const f=await demandFixture('forecast'),base='/v1/company/forecast/'+f.depotId,input={windowHours:24,horizonHours:4};
try{
 const empty=(await f.call(f.owner,'POST',base,input)).body;assert.equal(empty.projectedUnits,null);assert.equal(empty.action,null);await f.seedHistory();
 const before=await f.state(),forecast=await f.call(f.owner,'POST',base,input);assert.equal(forecast.code,200);assert.equal(forecast.body.status,'supported');assert.equal(forecast.body.currentStock,3);assert(forecast.body.exposureHours>=3&&forecast.body.exposureHours<4);assert.equal(forecast.body.projectedUnits,7);assert(forecast.body.action);assert.equal(forecast.body.noFutureObservations,true);assert.deepEqual(await f.state(),before);
 assert.equal((await f.call(f.stranger,'POST',base,input)).code,400);assert.equal((await f.call(f.owner,'POST',base,{...input,horizonHours:100})).code,400);
 if(f.native){assert.notEqual(forecast.body.action.body.targetStock,Number(before.depot.target_stock));await assert.rejects(f.single(f.owner,async(ch,c,h)=>{await applyCompanyForecast(ch,f.depotId,{...input,consent:true,evidenceId:forecast.body.evidenceId},c,false,h);throw Error('late rollback');}),/late rollback/);assert.deepEqual(await f.state(),before);}
 const body={...input,consent:true,evidenceId:forecast.body.evidenceId};const applied=await f.call(f.owner,'POST',base+'/apply',body,'apply-forecast');assert.equal(applied.code,200,JSON.stringify(applied));assert.equal(applied.body.applied.targetStock,7);assert.equal((await f.call(f.owner,'POST',base+'/apply',body,'apply-forecast')).code,200);
 const after=await f.state();assert.deepEqual(after.money,before.money);assert.equal(after.depot.stock,before.depot.stock);assert.equal(after.transactions,before.transactions);assert.equal(after.journals,before.journals);
 const current=(await f.call(f.owner,'POST',base,input)).body;
 await f.buy();assert.equal((await f.call(f.owner,'POST',base+'/apply',{...input,consent:true,evidenceId:current.evidenceId})).body.message,'stale_evidence');
 if(f.native){const a=(await f.call(f.owner,'POST',base,input)).body;const result=await Promise.all([f.call(f.owner,'POST',base+'/apply',{...input,consent:true,evidenceId:a.evidenceId},'race-a'),f.call(f.owner,'POST',base+'/apply',{...input,consent:true,evidenceId:a.evidenceId},'race-b')]);assert.equal(result.filter(r=>r.code===200).length,1,'One configuration advances the evidence snapshot; contender rejects stale evidence');}
 await f.app.pool.query("UPDATE business_depot_journal SET created_at=$2 WHERE depot_id=$1 AND reason='sale'",[f.depotId,new Date(Date.now()-4*3600000)]);assert.equal((await f.call(f.owner,'POST',base,input)).body.action,null,'Stale history cannot authorize forecast application');
 await f.invariants();console.log('companyforecast PASS '+f.version+': finite owned canonical history, minimum support/business-age exposure, fresh stock, actual configure/replay/stale/privacy bounds; no future or fake performance claims'+(f.native?'; native late rollback and concurrent stale-evidence refusal':''));
}finally{await f.close();}
