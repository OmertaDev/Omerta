import { DEPOT, configureDepot } from './depot.js';
import { GameError } from './game.js';
import { guardDelegatedControl } from './operatingpolicy.js';
import { COMPANY_DEMAND, demandExact, demandWindow, demandContext, demandSummary, demandBudget, demandEvidence, demandProcurementBound, existingConfig, configureAction, productionInputWitness } from './companydemand.js';

const fail=reason=>{const e=new GameError('company_forecast',reason);e.reason=reason;throw e;};
function terms(body){demandExact(body,'horizonHours,windowHours');demandWindow({windowHours:body.windowHours});if(!COMPANY_DEMAND.windows.includes(body.windowHours)||!COMPANY_DEMAND.horizons.includes(body.horizonHours))fail('terms');return {...body};}
export function forecastView(ctx,input,h){
 const observed=demandSummary(ctx.history,ctx.now,{privateHistory:true}),samples=ctx.history.slice(0,COMPANY_DEMAND.maxSamples),span=samples.length?Math.max(...samples.map(r=>+new Date(r.created_at)))-Math.min(...samples.map(r=>+new Date(r.created_at))):0;
 const status=observed.status==='observed'&&span>=3600000?'supported':observed.status==='observed'?'sparse_span':observed.status;
 const exposureHours=Math.min(ctx.windowHours,Math.max(0,(ctx.now-+new Date(ctx.depot.created_at))/3600000));
 const projected=status==='supported'&&exposureHours>=1?Math.ceil(observed.units/exposureHours*input.horizonHours):null;
 const buckets=new Map();for(const row of samples){const b=Math.floor(+new Date(row.created_at)/3600000);buckets.set(b,(buckets.get(b)||0)-Number(row.stock_delta));}
 const upper=projected===null?null:Math.max(projected,...[...buckets.values()].map(n=>n*input.horizonHours));
 const budget=demandBudget(ctx,Number(ctx.depot.restock_budget)),procurement=demandProcurementBound(ctx,budget,h),config=existingConfig(ctx),capacity=Math.max(0,DEPOT.capacity-ctx.reserved);
 if(projected!==null){config.targetStock=Math.max(1,Math.min(capacity,Number(ctx.depot.stock)+(procurement?.qty||0),Math.max(1,projected)));config.reorderAt=Math.min(config.targetStock-1,Math.floor(config.targetStock/2));}
 const action=projected===null||capacity<1?null:configureAction(ctx,config);
 return {ok:true,type:'observed_inventory_forecast',scope:'owned_gin_depot_retail_history',asOf:new Date(ctx.now).toISOString(),...input,status,samples:observed.samples,stockoutCensored:observed.stockoutCensored,
  method:'Bounded observed units divided by observed business age within the declared past window; deterministic extrapolation, not a learned or accuracy-tested prediction.',exposureHours,projectedUnits:projected,scenarioRange:projected===null?null:{min:0,max:upper,notStatisticalConfidence:true},
  currentStock:Number(ctx.depot.stock),capacityAvailable:capacity,budgetCashBound:budget,canonicalProcurementBound:procurement,evidenceId:demandEvidence(ctx,input),action,productionInputs:productionInputWitness(),noFutureObservations:true};
}
export async function companyForecast(ch,depotId,body,client,h){const input=terms(body),ctx=await demandContext(ch,depotId,input.windowHours,client);return forecastView(ctx,input,h);}
export async function applyCompanyForecast(ch,depotId,body,client,agentCredential,h){
 demandExact(body,'consent,evidenceId,horizonHours,windowHours');if(body.consent!==true||typeof body.evidenceId!=='string'||!/^[a-f0-9]{64}$/.test(body.evidenceId)||typeof agentCredential!=='boolean')fail('terms');
 const input=terms({windowHours:body.windowHours,horizonHours:body.horizonHours}),ctx=await demandContext(ch,depotId,input.windowHours,client,true);await guardDelegatedControl(client,depotId,agentCredential);
 const proposed=forecastView(ctx,input,h);if(proposed.evidenceId!==body.evidenceId)fail('stale_evidence');if(!proposed.action)fail('unknown_forecast');
 const result=await configureDepot(ch,depotId,proposed.action.body,client);return {...result,applied:proposed.action.body,gameCashDebited:0,source:'observed_inventory_forecast'};
}
