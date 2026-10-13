import crypto from 'node:crypto';
import { GameError } from './game.js';
import { DEPOT, configureDepot } from './depot.js';
import { BLACK_MARKET } from './rules.js';
import { GOODS_MARKET } from './goodsmarket.js';
import { orderCashQuote } from './market.js';
import { guardDelegatedControl, latestPolicy } from './operatingpolicy.js';
import { warehouseReservedUnits } from './warehouseleases.js';

export const COMPANY_DEMAND = Object.freeze({ windows:Object.freeze([4,12,24]), horizons:Object.freeze([1,4]), maxSamples:200, minSamples:5, minCharacters:3, freshHours:2 });
const fail=reason=>{const e=new GameError('company_demand',reason);e.reason=reason;throw e;};
export const demandId=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))fail('terms');return value;};
export const demandExact=(body,keys)=>{if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).sort().join(',')!==keys)fail('terms');};
export function demandWindow(body={}) { if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!=='windowHours'))fail('terms');const n=body.windowHours??24;if(!COMPANY_DEMAND.windows.includes(n))fail('terms');return n; }
function scenarioTerms(body){
 demandExact(body,'horizonHours,maxBudgetCash,preference,priceChangeBps,sensitivity,windowHours');if(!COMPANY_DEMAND.windows.includes(body.windowHours))fail('terms');
 if(!COMPANY_DEMAND.horizons.includes(body.horizonHours)||![-500,0,500].includes(body.priceChangeBps)||!['low','medium','high'].includes(body.sensitivity)
   ||!['price','availability'].includes(body.preference)||!Number.isSafeInteger(body.maxBudgetCash)||body.maxBudgetCash<50||body.maxBudgetCash>100000000)fail('terms');
 return {...body};
}
export async function demandContext(ch,depotId,windowHours,client,lock=false){
 if(!ch?.alive||ch.is_npc||!ch.account_id)fail('party');demandId(depotId);if(!COMPANY_DEMAND.windows.includes(windowHours))fail('terms');
 const depot=(await (lock?client.query("SELECT * FROM business_depots WHERE id=$1 AND owner_character=$2 AND status='open' FOR UPDATE",[depotId,ch.id])
   :client.query("SELECT * FROM business_depots WHERE id=$1 AND owner_character=$2 AND status='open'",[depotId,ch.id]))).rows[0];if(!depot)fail('not_yours');
 const now=+new Date((await client.query('SELECT clock_timestamp() AS at')).rows[0].at),start=new Date(now-windowHours*3600000),end=new Date(now);
 const district=(await client.query("SELECT j.id,j.depot_id,j.created_at,j.stock_delta,j.cash_delta,j.stock_after,j.customer_character FROM business_depot_journal j JOIN business_depots d ON d.id=j.depot_id WHERE d.district=$1 AND j.reason='sale' AND j.stock_delta<0 AND j.cash_delta>0 AND j.customer_character IS NOT NULL AND j.created_at >= d.created_at AND j.created_at >= $2 AND j.created_at <= $3 ORDER BY j.created_at DESC,j.id DESC LIMIT 201",[depot.district,start,end])).rows;
 const ownStart=new Date(Math.max(+start,+new Date(depot.created_at)));
 const history=(await client.query("SELECT id,created_at,stock_delta,cash_delta,stock_after,customer_character FROM business_depot_journal WHERE depot_id=$1 AND reason='sale' AND stock_delta<0 AND cash_delta>0 AND customer_character IS NOT NULL AND created_at >= $2 AND created_at <= $3 ORDER BY created_at DESC,id DESC LIMIT 201",[depot.id,ownStart,end])).rows;
 const block=Math.floor(now/GOODS_MARKET.BLOCK_MS),shop=(await client.query('SELECT price_block,bought,sold FROM goods_market_liquidity WHERE good_id=$1 AND district=$2',[DEPOT.good,depot.district])).rows[0];
 const policy=await latestPolicy(client,depot.id),reserved=await warehouseReservedUnits(client,depot.id,new Date(now));
 return {depot,now,windowHours,district,history,policy,reserved,shop:shop&&Number(shop.price_block)===block&&[shop.bought,shop.sold].every(n=>Number.isSafeInteger(Number(n))&&Number(n)>=0&&Number(n)<=500)?{block,bought:Number(shop.bought),sold:Number(shop.sold)}:null};
}
export function demandSummary(rows,now,{privateHistory=false}={}){
 const truncated=rows.length>COMPANY_DEMAND.maxSamples,items=rows.slice(0,COMPANY_DEMAND.maxSamples);
 const valid=items.every(r=>Number.isSafeInteger(-Number(r.stock_delta))&&-Number(r.stock_delta)>0&&-Number(r.stock_delta)<=DEPOT.capacity&&Number.isSafeInteger(Number(r.cash_delta))&&Number(r.cash_delta)>0&&+new Date(r.created_at)<=now);
 const dates=items.map(r=>+new Date(r.created_at)).filter(Number.isFinite),characters=new Set(items.map(r=>r.customer_character)).size,latest=dates.length?Math.max(...dates):null;
 const stale=latest===null||now-latest>COMPANY_DEMAND.freshHours*3600000,sparse=items.length<COMPANY_DEMAND.minSamples||(!privateHistory&&characters<COMPANY_DEMAND.minCharacters);
 const status=!valid?'invalid_source':truncated?'truncated':stale?'stale':sparse?'sparse':'observed';
 const units=status==='observed'?items.reduce((n,r)=>n-Number(r.stock_delta),0):null;
 return {status,samples:items.length,units,band:units===null?'unknown':units<10?'low':units<40?'medium':'high',stockoutCensored:items.some(r=>Number(r.stock_after)===0),latestAt:latest===null?null:new Date(latest).toISOString()};
}
export function demandBudget(ctx,cap){return Math.max(0,Math.min(cap,Number(ctx.depot.restock_budget),Number(ctx.depot.treasury)-Math.max(DEPOT.cashReserve,Number(ctx.policy?.reserve_cash||0)),ctx.policy?Number(ctx.policy.max_spend)-Number(ctx.policy.spent):100000000));}
export function demandEvidence(ctx,terms){return crypto.createHash('sha256').update(JSON.stringify({terms,depot:[ctx.depot.id,ctx.depot.owner_character,ctx.depot.stock,ctx.depot.sale_price,ctx.depot.bid_price,ctx.depot.target_stock,ctx.depot.reorder_at,ctx.depot.restock_budget,ctx.depot.treasury],reserved:ctx.reserved,policy:ctx.policy?[ctx.policy.id,ctx.policy.revision,ctx.policy.max_spend,ctx.policy.spent,ctx.policy.reserve_cash]:null,history:ctx.history,district:ctx.district,shop:ctx.shop,status:demandSummary(ctx.history,ctx.now,{privateHistory:true}).status})).digest('hex');}
export const productionInputWitness=()=>({scope:'worldgraph_purchased_production_inputs',status:'unavailable',reason:'No canonical GIN shop/depot purchase mapping to account item_stacks/item_instances recipe inputs; craft fees are not purchase prices.'});
export const configureAction=(ctx,config)=>({kind:'canonical_depot_configure',method:'POST',path:`/v1/depot/${ctx.depot.id}/configure`,body:config,requires:'Existing owner authority and guardDelegatedControl; no procurement is executed.'});
export function existingConfig(ctx){const d=ctx.depot;return {salePrice:Number(d.sale_price),bidPrice:Number(d.bid_price),targetStock:Number(d.target_stock),reorderAt:Number(d.reorder_at),restockBudget:Number(d.restock_budget)};}
export function demandProcurementBound(ctx,budget,h){let qty=Math.min(BLACK_MARKET.ORDER_MAX_QTY,Math.max(0,DEPOT.capacity-ctx.reserved-Number(ctx.depot.stock)),Math.floor(budget/Number(ctx.depot.bid_price)));while(qty>0&&orderCashQuote(qty,Number(ctx.depot.bid_price),h).total>budget)qty--;return qty>0?{qty,...orderCashQuote(qty,Number(ctx.depot.bid_price),h),eligibilityNotQualified:true}:null;}
export async function companyDemand(ch,depotId,body,client){
 const ctx=await demandContext(ch,depotId,demandWindow(body),client);
 return {ok:true,scope:'observed_gin_retail_only',district:ctx.depot.district,good:DEPOT.good,asOf:new Date(ctx.now).toISOString(),windowHours:ctx.windowHours,
  observedDepotPurchases:demandSummary(ctx.district,ctx.now),shopTurnover:ctx.shop?{status:'current_block_counter',...ctx.shop,notHistoricalSamples:true}: {status:'unavailable'},marketFillHistory:{status:'unavailable',reason:'No immutable generic fill quantity/district binding; live listing counters are not historical purchase evidence.'},productionInputs:productionInputWitness()};
}
export function demandScenario(ctx,terms,h){
 const observed=demandSummary(ctx.district,ctx.now),budget=demandBudget(ctx,terms.maxBudgetCash),elasticity={low:0.5,medium:1,high:2}[terms.sensitivity];
 const projected=observed.units===null?null:Math.max(0,Math.ceil(observed.units/ctx.windowHours*terms.horizonHours*(1-terms.priceChangeBps/10000*elasticity)));
 const config=existingConfig(ctx);config.salePrice=Math.max(50,Math.min(1000000,Math.round(config.salePrice*(1+terms.priceChangeBps/10000))));
 const margin=config.salePrice-Math.ceil(config.salePrice*BLACK_MARKET.TAKE_BPS/10000)>config.bidPrice;
 const procurement=demandProcurementBound(ctx,budget,h),fundable=procurement?.qty||0,space=Math.max(0,DEPOT.capacity-ctx.reserved);
 if(projected!==null){config.targetStock=Math.max(1,Math.min(space,Number(ctx.depot.stock)+fundable,Math.ceil(projected*(terms.preference==='availability'?1.5:1))));config.reorderAt=Math.min(config.targetStock-1,Math.floor(config.targetStock/2));}
 const action=projected===null||!margin||space<1?null:configureAction(ctx,config);
 return {ok:true,type:'counterfactual_scenario',notHistoricalSales:true,notCustomerCommitment:true,assumptions:terms,observed,model:'Finite chosen elasticity against observed turnover; not learned demand or measured performance.',projectedUnits:projected,budgetCashBound:budget,canonicalProcurementBound:procurement,currentStock:Number(ctx.depot.stock),evidenceId:demandEvidence(ctx,terms),action,productionInputs:productionInputWitness()};
}
export async function companyDemandScenario(ch,depotId,body,client,h){const terms=scenarioTerms(body),ctx=await demandContext(ch,depotId,terms.windowHours,client);return demandScenario(ctx,terms,h);}
export async function applyCompanyDemandScenario(ch,depotId,body,client,agentCredential,h){
 demandExact(body,'consent,evidenceId,scenario');if(body.consent!==true||typeof body.evidenceId!=='string'||!/^[a-f0-9]{64}$/.test(body.evidenceId)||typeof agentCredential!=='boolean')fail('terms');
 const terms=scenarioTerms(body.scenario),ctx=await demandContext(ch,depotId,terms.windowHours,client,true);await guardDelegatedControl(client,depotId,agentCredential);
 const proposal=demandScenario(ctx,terms,h);if(proposal.evidenceId!==body.evidenceId)fail('stale_evidence');if(!proposal.action)fail('unknown_demand');
 const result=await configureDepot(ch,depotId,proposal.action.body,client);return {...result,applied:proposal.action.body,source:'counterfactual_scenario',gameCashDebited:0};
}
