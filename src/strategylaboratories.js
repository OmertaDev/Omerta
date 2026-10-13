import crypto from 'node:crypto';
import { GameError, withCharacter } from './game.js';
import { assertItemTransaction, poisonItemTransaction, registerItemTransactionUndo, withItemRead } from './items.js';
import { configureDepot, DEPOT } from './depot.js';
import { latestPolicy, guardDelegatedControl } from './operatingpolicy.js';
import { companyForecast } from './companyforecast.js';
import { BLACK_MARKET } from './rules.js';
import { dbCaps } from './db.js';
import { concessionProductionContext, withInfrastructureConcession } from './infrastructureconcessions.js';
import { observeTerritoryEconomicsSources } from './territoryeconomics.js';

export const STRATEGY_LABORATORY=Object.freeze({arms:3,minSeconds:60,maxSeconds:3600,maxLifetimeCost:100000,minimumSamples:5,minimumAccounts:3});
export const strategyLaboratoriesDDL=`CREATE TABLE IF NOT EXISTS strategy_laboratories (
 id TEXT PRIMARY KEY, original_account TEXT NOT NULL REFERENCES accounts(id), original_character TEXT NOT NULL REFERENCES characters(id),
 business_id TEXT NOT NULL REFERENCES business_depots(id), territory_profile_id TEXT NOT NULL REFERENCES territory_economics_profiles(id),
 territory_revision INT NOT NULL CHECK(territory_revision>=1), policy_hash TEXT NOT NULL CHECK(char_length(policy_hash)=64),
 terms JSONB NOT NULL, terms_hash TEXT NOT NULL CHECK(char_length(terms_hash)=64), allow_autonomous BOOLEAN NOT NULL, owner_arm_grant BOOLEAN NOT NULL,
 arm_index INT NOT NULL CHECK(arm_index BETWEEN 0 AND 2), observed_cost NUMERIC NOT NULL DEFAULT 0 CHECK(observed_cost>=0),
 expires_at TIMESTAMPTZ NOT NULL, next_run_at TIMESTAMPTZ NOT NULL, state TEXT NOT NULL CHECK(state IN ('active','completed','retired','party_dead')),
 CHECK(owner_arm_grant=false OR allow_autonomous=true));
CREATE UNIQUE INDEX IF NOT EXISTS strategy_laboratory_active_depot ON strategy_laboratories(business_id) WHERE state='active';
CREATE TABLE IF NOT EXISTS strategy_laboratory_arms (
 id TEXT PRIMARY KEY, lab_id TEXT NOT NULL REFERENCES strategy_laboratories(id), ordinal INT NOT NULL CHECK(ordinal BETWEEN 0 AND 2),
 config JSONB NOT NULL, baseline JSONB NOT NULL, start_receipt JSONB NOT NULL, started_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('observing','completed','retired')), result JSONB, UNIQUE(lab_id,ordinal));
CREATE TABLE IF NOT EXISTS strategy_laboratory_sources (
 journal_id TEXT PRIMARY KEY REFERENCES business_depot_journal(id), arm_id TEXT NOT NULL REFERENCES strategy_laboratory_arms(id));
CREATE TABLE IF NOT EXISTS strategy_laboratory_requests (
 account_id TEXT NOT NULL, key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64), body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),
 run_id TEXT NOT NULL UNIQUE, receipt JSONB, original_actor TEXT REFERENCES characters(id), account_ref TEXT REFERENCES accounts(id),
 PRIMARY KEY(account_id,key_hash), CHECK((receipt IS NULL AND original_actor IS NULL AND account_ref IS NULL) OR
 (receipt IS NOT NULL AND original_actor IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL)));`;
const fail=message=>{throw new GameError('strategy_laboratory',message);};
const id=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(v))fail('identity');return v;};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const digest=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
const integer=(v,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail('terms');return v;};
const clock=async c=>new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const configOf=d=>({salePrice:Number(d.sale_price),bidPrice:Number(d.bid_price),targetStock:Number(d.target_stock),reorderAt:Number(d.reorder_at),restockBudget:Number(d.restock_budget)});
function armTerms(a){if(!exact(a,['salePrice','bidPrice','targetStock','reorderAt','restockBudget']))fail('terms');integer(a.salePrice,50,1000000);integer(a.bidPrice,50,1000000);integer(a.targetStock,1,40);integer(a.reorderAt,0,a.targetStock-1);integer(a.restockBudget,50,100000000);
 if(a.salePrice-Math.ceil(a.salePrice*BLACK_MARKET.TAKE_BPS/10000)<=a.bidPrice)fail('margin');return {...a};}
function terms(action,b){if(action==='create'){
 if(!exact(b,['businessId','forecast','arms','armSeconds','cadenceSeconds','lifetimeCostCapCash','expiresInSeconds','allowAutonomous','consent'])||b.consent!==true||typeof b.allowAutonomous!=='boolean'||!Array.isArray(b.arms)||b.arms.length<1||b.arms.length>3)fail('terms');id(b.businessId);
 if(!exact(b.forecast,['windowHours','horizonHours','evidenceId'])||![4,12,24].includes(b.forecast.windowHours)||![1,4].includes(b.forecast.horizonHours)||typeof b.forecast.evidenceId!=='string'||!/^[a-f0-9]{64}$/.test(b.forecast.evidenceId))fail('terms');
 integer(b.armSeconds,60,3600);integer(b.cadenceSeconds,b.armSeconds,3600);integer(b.lifetimeCostCapCash,50,100000);integer(b.expiresInSeconds,60,3600);if(b.expiresInSeconds<=b.arms.length*b.cadenceSeconds)fail('horizon');
 return {action,...b,forecast:{...b.forecast},arms:b.arms.map(armTerms)};}
 if(!['advance','close'].includes(action)||!exact(b,['labId','expectedArm']))fail('terms');id(b.labId);integer(b.expectedArm,0,2);return {action,...b};}
async function profile(c,business){const rows=(await c.query('SELECT * FROM territory_economics_profiles WHERE business_id=$1',[business])).rows;if(rows.length!==1)fail('territory_consent');return rows[0];}
async function context(c,ch,h,business,lab=null){if(!ch.alive||ch.is_npc||ch.account_id!==h.accountId)fail('original_actor');const p=await profile(c,business);
 if(p.original_account!==h.accountId||p.original_character!==ch.id||!p.enabled||p.state!=='active'||(lab&&(lab.original_account!==h.accountId||lab.original_character!==ch.id||lab.business_id!==business||lab.territory_profile_id!==p.id||Number(lab.territory_revision)!==Number(p.revision))))fail('territory_consent');
 const d=(await c.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE',[business])).rows[0];if(!d||d.status!=='open'||d.owner_character!==ch.id)fail('business_owner');
 const policy=await latestPolicy(c,business,true),hash=digest(policy);if(lab&&lab.policy_hash!==hash)fail('policy_changed');
 const read={accountId:h.accountId,characterId:ch.id,businessId:business,profileId:p.id,profileRevision:Number(p.revision)};return {p,d,policy,policyHash:hash,read};}
async function observed(c,ctx,baseline=null){const result=await observeTerritoryEconomicsSources(c,{...ctx.read,baseline});if(result.status!=='observed')fail('source_unknown');return result;}
function metrics(observation,complete,arm){const sales=observation.events.filter(e=>e.kind==='sale'),accounts=new Set(sales.map(e=>e.customerAccount));
 return {status:complete&&sales.length>=5&&accounts.size>=3?'observed_without_causal_inference':'insufficient_exposure',completeObservationHorizon:complete,asOf:observation.asOf,actualExposureSeconds:Math.max(0,(+new Date(observation.asOf)-+new Date(arm.started_at))/1000),plannedMinimumSeconds:(+new Date(arm.end_at)-+new Date(arm.started_at))/1000,paidPurchases:sales.length,independentCustomerAccounts:accounts.size,units:sales.reduce((n,e)=>n+e.units,0),customerNetRevenueCash:sales.reduce((n,e)=>n+e.netCash,0),observedCostCash:observation.costCash,observedProfitCash:observation.netCash,sourceIds:observation.sourceIds,notCausal:true,noGuaranteedIncome:true};}
async function admission(c,ch,h,ctx,term,config,expectedEvidence=null,remaining=term.lifetimeCostCapCash){
 const f=await companyForecast(ch,ctx.d.id,{windowHours:term.forecast.windowHours,horizonHours:term.forecast.horizonHours},c,h);
 if(expectedEvidence!==null&&f.evidenceId!==expectedEvidence)fail('stale_forecast');if(['invalid_source','truncated'].includes(f.status))fail('forecast_unknown');
 if(config.targetStock>f.capacityAvailable||config.restockBudget>term.lifetimeCostCapCash||config.restockBudget>f.budgetCashBound||Number(ctx.d.stock_cost)>remaining)fail('admission_bounds');
 if(ctx.policy&&(['bidPrice','targetStock','reorderAt','restockBudget'].some(k=>config[k]!==({bidPrice:Number(ctx.policy.bid_price),targetStock:Number(ctx.policy.target_stock),reorderAt:Number(ctx.policy.reorder_at),restockBudget:Number(ctx.policy.order_budget)})[k])))fail('policy_terms');
 return {source:'actual_company_forecast_admission',evidenceId:f.evidenceId,status:f.status,capacityAvailable:f.capacityAvailable,budgetCashBound:f.budgetCashBound,projectedDemandUsed:false};}
async function restoreLab(c,row){await c.query('UPDATE strategy_laboratories SET arm_index=$2,observed_cost=$3,next_run_at=$4,state=$5 WHERE id=$1',[row.id,row.arm_index,row.observed_cost,row.next_run_at,row.state]);}
async function restoreArm(c,row){await c.query('UPDATE strategy_laboratory_arms SET state=$2,result=$3 WHERE id=$1',[row.id,row.state,row.result]);}
async function applyArm(c,ch,h,ctx,labId,ordinal,term,admit){
 const a=term.arms[ordinal],prior=configOf(ctx.d);registerItemTransactionUndo(c,()=>c.query('UPDATE business_depots SET sale_price=$2,bid_price=$3,target_stock=$4,reorder_at=$5,restock_budget=$6 WHERE id=$1',[ctx.d.id,prior.salePrice,prior.bidPrice,prior.targetStock,prior.reorderAt,prior.restockBudget]));
 const effect=await configureDepot(ch,ctx.d.id,a,c),source=await observed(c,ctx),now=await clock(c),armId=crypto.randomUUID(),end=new Date(+now+term.armSeconds*1000);
 const receipt={kind:'canonical_depot_configuration',labId,ordinal,originalAccount:h.accountId,originalCharacter:ch.id,businessId:ctx.d.id,config:a,baseline:source.baseline,admission:admit,applied:effect,gameCashDebited:0};
 registerItemTransactionUndo(c,()=>c.query('DELETE FROM strategy_laboratory_arms WHERE id=$1',[armId]));await c.query("INSERT INTO strategy_laboratory_arms(id,lab_id,ordinal,config,baseline,start_receipt,started_at,end_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'observing')",[armId,labId,ordinal,a,source.baseline,receipt,now,end]);return {armId,receipt,startedAt:now,endAt:end,nextAt:new Date(+now+term.cadenceSeconds*1000)};
}
async function create(ch,c,h,t,agent){const ctx=await context(c,ch,h,t.businessId);await guardDelegatedControl(c,t.businessId,agent);
 if((await c.query("SELECT id FROM strategy_laboratories WHERE business_id=$1 AND state='active' FOR UPDATE",[t.businessId])).rows.length)fail('active_lab');
 await observed(c,ctx);for(const a of t.arms)await admission(c,ch,h,ctx,t,a,t.forecast.evidenceId);
 const now=await clock(c),expires=new Date(Math.min(+now+t.expiresInSeconds*1000,+new Date(ctx.p.expires_at)));if(+expires-+now<t.arms.length*t.cadenceSeconds*1000)fail('expiry');
 const labId=crypto.randomUUID();registerItemTransactionUndo(c,()=>c.query('DELETE FROM strategy_laboratories WHERE id=$1',[labId]));await c.query("INSERT INTO strategy_laboratories(id,original_account,original_character,business_id,territory_profile_id,territory_revision,policy_hash,terms,terms_hash,allow_autonomous,owner_arm_grant,arm_index,expires_at,next_run_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,'active')",[labId,h.accountId,ch.id,t.businessId,ctx.p.id,ctx.p.revision,ctx.policyHash,t,digest(t),t.allowAutonomous,!agent&&t.allowAutonomous,expires,now]);
 const admit=await admission(c,ch,h,ctx,t,t.arms[0],t.forecast.evidenceId),arm=await applyArm(c,ch,h,ctx,labId,0,t,admit),after=await clock(c);if(+after>=+expires||+arm.nextAt>=+expires)fail('expired');await c.query('UPDATE strategy_laboratories SET next_run_at=$2 WHERE id=$1',[labId,arm.nextAt]);
 return {ok:true,labId,arm:0,applied:t.arms[0],endAt:arm.endAt.toISOString(),expiresAt:expires.toISOString(),state:'active',gameCashDebited:0,autonomous:t.allowAutonomous,configurationGrant:!agent&&t.allowAutonomous?'exact_original_owner_arms_only':'existing_agent_configuration_guard',comparison:'no_causal_or_income_guarantee'};
}
async function advance(ch,c,h,t,agent){const hint=(await c.query('SELECT * FROM strategy_laboratories WHERE id=$1',[t.labId])).rows[0];if(!hint)fail('no_lab');const ctx=await context(c,ch,h,hint.business_id,hint),lab=(await c.query('SELECT * FROM strategy_laboratories WHERE id=$1 FOR UPDATE',[hint.id])).rows[0];
 if(lab.state!=='active'||Number(lab.arm_index)!==t.expectedArm||digest(lab.terms)!==lab.terms_hash)fail('lab_changed');
 const term=lab.terms;if(agent&&!(lab.owner_arm_grant&&lab.allow_autonomous))await guardDelegatedControl(c,lab.business_id,true);
 const arm=(await c.query('SELECT * FROM strategy_laboratory_arms WHERE lab_id=$1 AND ordinal=$2 FOR UPDATE',[lab.id,lab.arm_index])).rows[0];
 if(!arm||arm.state!=='observing'||stable(arm.config)!==stable(term.arms[lab.arm_index])||stable(arm.config)!==stable(configOf(ctx.d))||stable(arm.baseline)!==stable(arm.start_receipt.baseline)||arm.start_receipt.originalAccount!==h.accountId||arm.start_receipt.originalCharacter!==ch.id||arm.start_receipt.labId!==lab.id||arm.start_receipt.ordinal!==Number(lab.arm_index))fail('configuration_changed');
 const source=await observed(c,ctx,arm.baseline),now=await clock(c);if(+now>=+new Date(lab.expires_at))fail('expired');
 const complete=+new Date(source.asOf)>=+new Date(arm.end_at)&&+now>=+new Date(lab.next_run_at),view=metrics(source,complete,arm);registerItemTransactionUndo(c,()=>restoreArm(c,arm));await c.query('UPDATE strategy_laboratory_arms SET result=$2 WHERE id=$1',[arm.id,view]);
 if(!complete)return {ok:true,labId:lab.id,arm:Number(lab.arm_index),state:'waiting',endAt:new Date(arm.end_at).toISOString(),observed:view,gameCashDebited:0};
 for(const sourceId of source.sourceIds){if((await c.query('SELECT arm_id FROM strategy_laboratory_sources WHERE journal_id=$1 FOR UPDATE',[sourceId])).rows.length)fail('source_used');registerItemTransactionUndo(c,()=>c.query('DELETE FROM strategy_laboratory_sources WHERE journal_id=$1 AND arm_id=$2',[sourceId,arm.id]));await c.query('INSERT INTO strategy_laboratory_sources(journal_id,arm_id) VALUES($1,$2)',[sourceId,arm.id]);}
 registerItemTransactionUndo(c,()=>restoreLab(c,lab));await c.query("UPDATE strategy_laboratory_arms SET state='completed' WHERE id=$1",[arm.id]);const cost=Number(lab.observed_cost)+source.costCash;
 if(!Number.isSafeInteger(cost))fail('source_unknown');
 if(cost>term.lifetimeCostCapCash){await c.query("UPDATE strategy_laboratories SET observed_cost=$2,state='retired' WHERE id=$1",[lab.id,cost]);return {ok:true,labId:lab.id,arm:Number(lab.arm_index),state:'retired',reason:'observed_cost_ceiling_exceeded',observed:view,gameCashDebited:0,noAutomaticWinner:true};}
 if(Number(lab.arm_index)+1>=term.arms.length){await c.query("UPDATE strategy_laboratories SET observed_cost=$2,state='completed' WHERE id=$1",[lab.id,cost]);return {ok:true,labId:lab.id,arm:Number(lab.arm_index),state:'completed',observed:view,gameCashDebited:0,finalConfiguration:'last_preconsented_arm',noAutomaticWinner:true};}
 const next=Number(lab.arm_index)+1,admit=await admission(c,ch,h,ctx,term,term.arms[next],null,term.lifetimeCostCapCash-cost),applied=await applyArm(c,ch,h,ctx,lab.id,next,term,admit),after=await clock(c);if(+after>=+new Date(lab.expires_at)||+applied.nextAt>=+new Date(lab.expires_at))fail('expired');
 await c.query('UPDATE strategy_laboratories SET observed_cost=$2,arm_index=$3,next_run_at=$4 WHERE id=$1',[lab.id,cost,next,applied.nextAt]);return {ok:true,labId:lab.id,arm:next,applied:term.arms[next],state:'active',endAt:applied.endAt.toISOString(),previousObserved:view,gameCashDebited:0,noAutomaticWinner:true};
}
async function close(ch,c,h,t){const lab=(await c.query('SELECT * FROM strategy_laboratories WHERE id=$1 FOR UPDATE',[t.labId])).rows[0];if(!lab||lab.original_account!==h.accountId||lab.original_character!==ch.id||Number(lab.arm_index)!==t.expectedArm)fail('original_party');registerItemTransactionUndo(c,()=>restoreLab(c,lab));await c.query("UPDATE strategy_laboratories SET state='retired' WHERE id=$1",[lab.id]);const arms=(await c.query("SELECT * FROM strategy_laboratory_arms WHERE lab_id=$1 AND state='observing' ORDER BY ordinal FOR UPDATE",[lab.id])).rows;for(const a of arms){registerItemTransactionUndo(c,()=>restoreArm(c,a));await c.query("UPDATE strategy_laboratory_arms SET state='retired' WHERE id=$1",[a.id]);}return {ok:true,labId:lab.id,arm:Number(lab.arm_index),state:'retired',gameCashDebited:0,configurationUnchanged:true};}
async function request(c,ch,h,t,key,fn){const kh=digest([h.accountId,key]),bh=digest(t),runId=crypto.randomUUID(),old=(await c.query('SELECT body_hash,receipt FROM strategy_laboratory_requests WHERE account_id=$1 AND key_hash=$2',[h.accountId,kh])).rows[0];if(old){if(old.body_hash!==bh)fail('request_conflict');if(!old.receipt)fail('in_progress');return old.receipt;}
 registerItemTransactionUndo(c,()=>c.query('DELETE FROM strategy_laboratory_requests WHERE account_id=$1 AND key_hash=$2 AND run_id=$3',[h.accountId,kh,runId]));await c.query('INSERT INTO strategy_laboratory_requests(account_id,key_hash,body_hash,run_id) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,key_hash) DO NOTHING',[h.accountId,kh,bh,runId]);
 const row=(await c.query('SELECT run_id,body_hash,receipt FROM strategy_laboratory_requests WHERE account_id=$1 AND key_hash=$2 FOR UPDATE',[h.accountId,kh])).rows[0];if(row.body_hash!==bh)fail('request_conflict');if(row.receipt)return row.receipt;if(row.run_id!==runId)fail('in_progress');const receipt=await fn();if((await c.query('UPDATE strategy_laboratory_requests SET receipt=$4,original_actor=$5,account_ref=$1 WHERE account_id=$1 AND key_hash=$2 AND run_id=$3 AND receipt IS NULL',[h.accountId,kh,runId,receipt,ch.id])).rowCount!==1)fail('receipt_changed');return receipt;
}
export async function strategyLaboratoryAction(pool,accountId,action,body,key,{agentCredential=false}={}){id(accountId);id(key);if(typeof agentCredential!=='boolean')fail('actor');const t=terms(action,body),old=await withItemRead(pool,async c=>(await c.query('SELECT body_hash,receipt FROM strategy_laboratory_requests WHERE account_id=$1 AND key_hash=$2',[accountId,digest([accountId,key])])).rows[0]);
 if(old){if(old.body_hash!==digest(t))fail('request_conflict');if(!old.receipt)fail('in_progress');return old.receipt;}
 let business=t.businessId;if(action!=='create'){const hint=await withItemRead(pool,async c=>(await c.query('SELECT business_id,original_account FROM strategy_laboratories WHERE id=$1',[t.labId])).rows[0]);if(!hint||hint.original_account!==accountId)fail('original_party');business=hint.business_id;}
 const ctx=action==='close'?null:await withItemRead(pool,c=>concessionProductionContext(c,{accountId,businessId:business}));if(action!=='close'&&!ctx)fail('concession_required');let receipt;
 await withCharacter(pool,accountId,async(ch,c,h)=>{receipt=await request(c,ch,h,t,key,()=>action==='create'?create(ch,c,h,t,agentCredential):action==='advance'?advance(ch,c,h,t,agentCredential):close(ch,c,h,t));return receipt;},ctx?{withActionScope:(c,_account,execute)=>withInfrastructureConcession(c,ctx,execute)}:null);return receipt;
}
export async function strategyLaboratoryBoard(pool,account){id(account);return withItemRead(pool,async c=>{const labs=(await c.query('SELECT id,business_id,arm_index,state,observed_cost,expires_at,allow_autonomous FROM strategy_laboratories WHERE original_account=$1 ORDER BY id LIMIT 10',[account])).rows,result=[];
 for(const l of labs){const arms=(await c.query('SELECT ordinal,config,state,result,end_at FROM strategy_laboratory_arms WHERE lab_id=$1 ORDER BY ordinal',[l.id])).rows;result.push({labId:l.id,businessId:l.business_id,arm:Number(l.arm_index),state:l.state,autonomous:l.allow_autonomous,observedCostCash:Number(l.observed_cost),expiresAt:new Date(l.expires_at).toISOString(),arms:arms.map(a=>({ordinal:Number(a.ordinal),applied:a.config,state:a.state,endAt:new Date(a.end_at).toISOString(),observed:a.result?{...a.result,sourceIds:undefined}:null})),comparison:'observations_only_no_causal_superiority_or_income_guarantee'});}return {laboratories:result,scope:'private_original_account',automaticWinner:false};});}
export async function voidStrategyLaboratoriesAtDeath(c,character){assertItemTransaction(c);id(character);try{const ch=(await c.query('SELECT alive FROM characters WHERE id=$1 FOR UPDATE',[character])).rows[0];if(!ch||ch.alive)fail('death_source');const labs=(await c.query('SELECT * FROM strategy_laboratories WHERE original_character=$1 ORDER BY id FOR UPDATE',[character])).rows;for(const l of labs){registerItemTransactionUndo(c,()=>restoreLab(c,l));await c.query("UPDATE strategy_laboratories SET state='party_dead' WHERE id=$1",[l.id]);const arms=(await c.query("SELECT * FROM strategy_laboratory_arms WHERE lab_id=$1 AND state='observing' ORDER BY ordinal FOR UPDATE",[l.id])).rows;for(const a of arms){registerItemTransactionUndo(c,()=>restoreArm(c,a));await c.query("UPDATE strategy_laboratory_arms SET state='retired' WHERE id=$1",[a.id]);}}return {retired:labs.length,gameCashDebited:0};}catch(e){poisonItemTransaction(c,e);throw e;}}
export async function strategyLaboratoryDueCandidates(pool,limit=20){integer(limit,1,20);if(dbCaps.skipLocked)return (await pool.query("SELECT l.id,l.original_account,l.original_character,l.arm_index,l.next_run_at::text due_stamp FROM strategy_laboratories l JOIN characters c ON c.id=l.original_character JOIN accounts a ON a.id=l.original_account WHERE l.state='active' AND l.allow_autonomous=true AND c.alive=true AND c.account_id=l.original_account AND a.status='active' AND l.expires_at>clock_timestamp() AND l.next_run_at<=clock_timestamp() ORDER BY l.next_run_at,l.id LIMIT $1",[limit])).rows;return (await pool.query("SELECT l.id,l.original_account,l.original_character,l.arm_index,l.next_run_at due_stamp FROM strategy_laboratories l JOIN characters c ON c.id=l.original_character JOIN accounts a ON a.id=l.original_account WHERE l.state='active' AND l.allow_autonomous=true AND c.alive=true AND c.account_id=l.original_account AND a.status='active' AND l.expires_at>clock_timestamp() AND l.next_run_at<=clock_timestamp() ORDER BY l.next_run_at,l.id LIMIT $1",[limit])).rows;}
export async function runStrategyLaboratories(pool,limit=20){const rows=await strategyLaboratoryDueCandidates(pool,limit),results=[];for(const r of rows){let error;try{results.push(await strategyLaboratoryAction(pool,r.original_account,'advance',{labId:r.id,expectedArm:Number(r.arm_index)},`strategy:auto:${digest([r.id,r.arm_index,r.due_stamp])}`,{agentCredential:true}));}catch(e){error=e;results.push({labId:r.id,state:'refused',error:e.code||'unexpected'});}
 const stamp=new Date(+await clock(pool)+60000);if(dbCaps.skipLocked)await pool.query("UPDATE strategy_laboratories SET next_run_at=$6 WHERE id=$1 AND original_account=$2 AND original_character=$3 AND arm_index=$4 AND state='active' AND allow_autonomous=true AND next_run_at::text=$5",[r.id,r.original_account,r.original_character,r.arm_index,r.due_stamp,stamp]);else await pool.query("UPDATE strategy_laboratories SET next_run_at=$6 WHERE id=$1 AND original_account=$2 AND original_character=$3 AND arm_index=$4 AND state='active' AND allow_autonomous=true AND next_run_at=$5",[r.id,r.original_account,r.original_character,r.arm_index,r.due_stamp,stamp]);if(error&&!(error instanceof GameError))throw error;}return {attempted:results.length,results};}
export async function collectStrategyLaboratoryIssues(pool){
 const issues=[],labs=(await pool.query('SELECT * FROM strategy_laboratories ORDER BY id')).rows;
 for(const l of labs){
  const arms=(await pool.query('SELECT * FROM strategy_laboratory_arms WHERE lab_id=$1 ORDER BY ordinal',[l.id])).rows;
  if(digest(l.terms)!==l.terms_hash||arms.length>l.terms.arms.length||arms.some((a,i)=>Number(a.ordinal)!==i||stable(a.config)!==stable(l.terms.arms[i])||stable(a.baseline)!==stable(a.start_receipt.baseline)||a.start_receipt.originalAccount!==l.original_account||a.start_receipt.originalCharacter!==l.original_character||a.start_receipt.businessId!==l.business_id||a.start_receipt.ordinal!==i))issues.push({labId:l.id,reason:'arm_authority'});
  let cost=0;
  for(const a of arms){
   const frame={kind:'canonical_depot_uuid_baseline',accountId:l.original_account,characterId:l.original_character,businessId:l.business_id,profileId:l.territory_profile_id,profileRevision:Number(l.territory_revision),ids:a.baseline.ids};
   if(!Array.isArray(a.baseline.ids)||digest(frame)!==a.baseline.hash)issues.push({labId:l.id,reason:'baseline_authority'});
   if(a.state!=='completed')continue;
   const view=a.result;
   if(!view||!view.completeObservationHorizon||+new Date(view.asOf)<+new Date(a.end_at)||+new Date(view.asOf)>=+new Date(l.expires_at)||!Array.isArray(view.sourceIds)){issues.push({labId:l.id,reason:'observation_horizon'});continue;}
   let net=0,observedCost=0,units=0,purchases=0,revenue=0;const seen=new Set(),accounts=new Set();
   for(const sourceId of view.sourceIds){
    const r=(await pool.query('SELECT depot_id,reason,cash_delta,cost_delta,expense,stock_delta,customer_character FROM business_depot_journal WHERE id=$1',[sourceId])).rows[0];
    if(!r||r.depot_id!==l.business_id||a.baseline.ids.includes(sourceId)||seen.has(sourceId)){issues.push({labId:l.id,reason:'source_binding'});continue;}
    seen.add(sourceId);const ref=(await pool.query('SELECT arm_id FROM strategy_laboratory_sources WHERE journal_id=$1',[sourceId])).rows[0];if(ref?.arm_id!==a.id)issues.push({labId:l.id,reason:'source_binding'});
    if(r.reason==='sale'){
     const customer=(await pool.query('SELECT account_id FROM characters WHERE id=$1',[r.customer_character])).rows[0];
     if(!customer?.account_id||customer.account_id===l.original_account)issues.push({labId:l.id,reason:'customer_source'});else accounts.add(customer.account_id);
     net+=Number(r.cash_delta)+Number(r.cost_delta);revenue+=Number(r.cash_delta);observedCost-=Number(r.cost_delta);units-=Number(r.stock_delta);purchases++;
    }
    net-=Number(r.expense);observedCost+=Number(r.expense);
   }
   const status=purchases>=5&&accounts.size>=3?'observed_without_causal_inference':'insufficient_exposure',elapsed=(+new Date(view.asOf)-+new Date(a.started_at))/1000,minimum=(+new Date(a.end_at)-+new Date(a.started_at))/1000;
   if(net!==Number(view.observedProfitCash)||observedCost!==Number(view.observedCostCash)||units!==Number(view.units)||purchases!==Number(view.paidPurchases)||revenue!==Number(view.customerNetRevenueCash)||accounts.size!==Number(view.independentCustomerAccounts)||view.status!==status||!view.notCausal||!view.noGuaranteedIncome||view.actualExposureSeconds!==elapsed||view.plannedMinimumSeconds!==minimum)issues.push({labId:l.id,reason:'observation_books'});
   cost+=observedCost;
  }
  if(cost!==Number(l.observed_cost))issues.push({labId:l.id,reason:'cost_books'});
  if(l.allow_autonomous!==l.terms.allowAutonomous||(l.owner_arm_grant&&!l.allow_autonomous))issues.push({labId:l.id,reason:'grant_scope'});
 }
 const refs=(await pool.query('SELECT s.journal_id,a.id arm_id,a.state,a.result,j.depot_id,l.business_id FROM strategy_laboratory_sources s LEFT JOIN strategy_laboratory_arms a ON a.id=s.arm_id LEFT JOIN strategy_laboratories l ON l.id=a.lab_id LEFT JOIN business_depot_journal j ON j.id=s.journal_id ORDER BY s.journal_id')).rows;
 for(const r of refs)if(r.state!=='completed'||r.depot_id!==r.business_id||!r.result?.sourceIds?.includes(r.journal_id))issues.push({armId:r.arm_id,reason:'unbound_source'});
 return issues;
}
