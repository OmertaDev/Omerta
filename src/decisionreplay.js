import crypto from 'node:crypto';
import { GameError } from './game.js';
import { withItemRead } from './items.js';
import { businessSeasonJournalResult } from './businessseasons.js';

export const DECISION_REPLAY = Object.freeze({ days:30, page:20, maximumSources:200, maximumJournalRows:200,
  kinds:Object.freeze(['intelligence_purchase','forecast_memory']) });
const fail=reason=>{throw new GameError('decision_replay',reason);};
const id=v=>{if(typeof v!=='string'||!/^[!-~]{1,128}$/.test(v))fail('terms');return v;};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const whole=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');
const same=(a,b)=>stable(a)===stable(b);
const date=v=>{const n=+new Date(v);if(!Number.isSafeInteger(n))fail('source');return n;};
async function context(c,account){id(account);if((await c.query('SELECT status FROM accounts WHERE id=$1',[account])).rows[0]?.status!=='active')fail('account');const at=date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);return{at,start:at-DECISION_REPLAY.days*86400000};}
function recent(at,ctx){const n=date(at);if(n<ctx.start||n>ctx.at)fail('source_window');return new Date(n).toISOString();}
async function original(c,character,account){const row=(await c.query('SELECT account_id,is_npc FROM characters WHERE id=$1',[character])).rows[0];if(!row||row.account_id!==account||row.is_npc)fail('source');}
async function readSnapshot(pool,perform){
 // Preserve only this read-only module's closed refusals across Phase2's generic error boundary.
 const result=await withItemRead(pool,async c=>{try{return{value:await perform(c)};}catch(error){if(error instanceof GameError&&error.code==='decision_replay')return{error};throw error;}});
 if(result.error)throw result.error;return result.value;
}
const common=(kind,key,at,originalCharacter)=>({kind,id:key,occurredAt:at,originalCharacter,readOnly:true,historicalAccountOnly:true,
  executionAuthority:false,causality:'not_established',performanceClaim:'none'});
async function purchase(c,account,key,ctx){
 const p=(await c.query('SELECT * FROM economic_intelligence_purchases WHERE id=$1 AND buyer_account=$2',[key,account])).rows[0];if(!p)fail('not_found');
 const at=recent(p.purchased_at,ctx);await original(c,p.buyer_character,account);await original(c,p.seller_character,p.seller_account);
 const pub=(await c.query('SELECT * FROM economic_intelligence_publications WHERE id=$1',[p.publication_id])).rows[0];
 if(!pub||pub.seller_account!==p.seller_account||pub.seller_character!==p.seller_character||p.seller_account===account||!whole(Number(p.price),1,100000)||Number(pub.price)!==Number(p.price)||pub.report_hash!==p.report_hash||hash(p.report)!==p.report_hash||!same(p.report,pub.report)||date(pub.created_at)>date(p.purchased_at)||date(pub.expires_at)<=date(p.purchased_at))fail('source');
 if(pub.terms_hash!==hash([pub.id,pub.depot_id,pub.seller_account,pub.seller_character,Number(pub.window_hours),Number(pub.horizon_hours),new Date(date(pub.evaluation_at)).toISOString(),pub.source_hash,pub.report_hash,Number(pub.price),new Date(date(pub.created_at)).toISOString(),new Date(date(pub.expires_at)).toISOString()]))fail('source');
 const r=p.report;if(r?.type!=='sanitized_observed_gin_forecast'||r.good!=='gin'||r.noFutureObservations!==true||r.noAccuracyOrProfitGuarantee!==true||r.notMarketWideDemand!==true||!whole(r.samples,5,200)||!whole(r.observedUnits,1)||!whole(r.projectedUnits)||date(r.evaluatedAt)>date(p.purchased_at))fail('source');
 const legs=(await c.query("SELECT id,character_id,account_id,currency,amount,reason,counterparty FROM transactions WHERE counterparty=$1 AND reason IN ('economic_intelligence:pay','economic_intelligence:receive') ORDER BY id LIMIT 3",[p.id])).rows;
 if(legs.length!==2||p.pay_journal===p.receive_journal)fail('source');
 for(const [journal,character,amount,reason]of [[p.pay_journal,p.buyer_character,-Number(p.price),'economic_intelligence:pay'],[p.receive_journal,p.seller_character,Number(p.price),'economic_intelligence:receive']]){
  const j=legs.find(x=>x.id===journal);if(!j||j.character_id!==character||j.currency!=='cash'||Number(j.amount)!==amount||j.reason!==reason||j.counterparty!==p.id||j.account_id!==null)fail('source');
 }
 return{...common('intelligence_purchase',p.id,at,p.buyer_character),action:{kind:'purchase_economic_intelligence',publicationId:p.publication_id,requestBody:'not_retained'},
  cost:{gameCashDebited:Number(p.price),basis:'exact_canonical_paired_journals'},receipt:{id:p.id,reportHash:p.report_hash,payJournal:p.pay_journal,receiveJournal:p.receive_journal},
  outcome:{status:'report_delivered',evaluatedAt:new Date(date(r.evaluatedAt)).toISOString(),samples:r.samples,observedUnits:r.observedUnits,projectedUnits:r.projectedUnits,projectionIsNotOutcome:true}};
}
async function forecast(c,account,key,ctx){
 const f=(await c.query("SELECT * FROM agent_operating_memory_facts WHERE id=$1 AND account_id=$2 AND source_kind='forecast'",[key,account])).rows[0];if(!f)fail('not_found');
 const at=recent(f.source_at,ctx);await original(c,f.original_character,account);if(date(f.captured_at)<date(f.source_at)||date(f.captured_at)>ctx.at||date(f.expires_at)<=date(f.source_at))fail('source');
 const sources=(await c.query('SELECT key,status,body_hash,response,created_at FROM idempotency WHERE account_id=$1 AND created_at>=$2 AND created_at<=$3 ORDER BY key LIMIT 201',[account,new Date(ctx.start),new Date(ctx.at)])).rows;if(sources.length>200)fail('source_overflow');
 const matching=sources.filter(s=>hash({account,kind:'forecast',key:s.key})===f.source_key_hash);if(matching.length!==1)fail('source');const s=matching[0];
 if(s.status<200||s.status>=300||date(s.created_at)!==date(f.source_at)||typeof s.response!=='string'||s.response.length>262144)fail('source');let r;try{r=JSON.parse(s.response);}catch{fail('source');}
 if(r?.ok!==true||r.id!==f.business_id||r.character?.id!==f.original_character||r.source!=='observed_inventory_forecast'||r.gameCashDebited!==0||!exact(r.applied,['salePrice','bidPrice','targetStock','reorderAt','restockBudget'])||!Object.values(r.applied).every(v=>whole(v))||!same(r.applied,f.summary?.applied)||hash({bodyHash:s.body_hash,original:r.character.id,applied:r.applied,source:r.source})!==f.source_proof_hash)fail('source');
 let outcome={status:'unknown',reason:'no_recorded_observation',attribution:'not_established'};
 if(f.outcome?.status==='observed'){
  const observedAt=date(f.outcome.observedAt);if(observedAt<date(f.captured_at)||observedAt>ctx.at||f.baseline_truncated||!Array.isArray(f.baseline_ids)||f.baseline_ids.length>200||new Set(f.baseline_ids).size!==f.baseline_ids.length||f.baseline_ids.some(x=>typeof x!=='string'))fail('observation_source');
  const rows=(await c.query('SELECT id,created_at,reason,cash_delta,stock_delta,cost_delta,expense,stock_after FROM business_depot_journal WHERE depot_id=$1 AND created_at>=$2 AND created_at<=$3 ORDER BY created_at DESC,id DESC LIMIT 201',[f.business_id,new Date(date(f.captured_at)-2592000000),new Date(observedAt)])).rows;
  if(rows.length>200||f.baseline_ids.some(key=>!rows.some(row=>row.id===key&&date(row.created_at)<=date(f.captured_at))))fail('observation_source');
  if(!same([...f.baseline_ids].sort(),rows.filter(row=>date(row.created_at)<=date(f.captured_at)).map(row=>row.id).sort()))fail('observation_source');
  const newRows=rows.filter(row=>!f.baseline_ids.includes(row.id)),book=businessSeasonJournalResult(newRows);
  if(!book.known||book.sales<5||!same({samples:book.sales,operatingResult:book.operatingResult,unitsSold:book.unitsSold,expenses:book.expenses,stockoutSaleEvents:book.stockoutSales},Object.fromEntries(['samples','operatingResult','unitsSold','expenses','stockoutSaleEvents'].map(k=>[k,f.outcome[k]])))||f.outcome.causality!=='not_established'||f.outcome.accuracy!=='unknown')fail('observation_source');
  outcome={status:'observed',observedAt:new Date(observedAt).toISOString(),samples:book.sales,operatingResult:book.operatingResult,unitsSold:book.unitsSold,expenses:book.expenses,attribution:'not_established'};
 }else if(f.outcome?.status!=='unknown')fail('observation_source');
 return{...common('forecast_memory',f.id,at,f.original_character),action:{kind:'apply_observed_inventory_forecast',businessId:f.business_id,applied:{...r.applied}},
  cost:{gameCashDebited:0,basis:'canonical_apply_receipt'},receipt:{factId:f.id,sourceProofHash:f.source_proof_hash},outcome};
}
export async function decisionReplay(pool,account,kind,key){id(key);if(!DECISION_REPLAY.kinds.includes(kind))fail('unsupported_kind');return readSnapshot(pool,async c=>{const ctx=await context(c,account);return kind==='intelligence_purchase'?purchase(c,account,key,ctx):forecast(c,account,key,ctx);});}
export async function decisionReplayBoard(pool,account,query){
 if(!exact(query,['kind'])&&!exact(query,['kind','after']))fail('terms');if(!DECISION_REPLAY.kinds.includes(query.kind))fail('unsupported_kind');const after=query.after===undefined?'':id(query.after);
 return readSnapshot(pool,async c=>{const ctx=await context(c,account),rows=query.kind==='intelligence_purchase'?(await c.query('SELECT id,purchased_at AS at FROM economic_intelligence_purchases WHERE buyer_account=$1 AND purchased_at>=$2 AND purchased_at<=$3 AND id>$4 ORDER BY id LIMIT 21',[account,new Date(ctx.start),new Date(ctx.at),after])).rows:(await c.query("SELECT id,source_at AS at FROM agent_operating_memory_facts WHERE account_id=$1 AND source_kind='forecast' AND source_at>=$2 AND source_at<=$3 AND id>$4 ORDER BY id LIMIT 21",[account,new Date(ctx.start),new Date(ctx.at),after])).rows;
  return{kind:query.kind,candidates:rows.slice(0,20).map(r=>({id:r.id,occurredAt:new Date(date(r.at)).toISOString(),verification:'detail_required'})),next:rows.length>20?rows[19].id:null,windowDays:30,readOnly:true,unsupportedKinds:['production'],performanceClaim:'none'};
 });
}
