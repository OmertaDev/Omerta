import { GameError } from './game.js';
import { assertItemTransaction,registerItemTransactionUndo,poisonItemTransaction } from './items.js';
import { assertEquipmentUsable } from './itemdurability.js';
import { latestPolicy } from './operatingpolicy.js';

export const COMPANY_SPECIALIZATION=Object.freeze({volume:Object.freeze({maxCrafts:6,cadence:300}),quality:Object.freeze({maxCrafts:2,cadence:180}),speed:Object.freeze({maxCrafts:1,cadence:60}),niche:Object.freeze({maxCrafts:3,cadence:300})});
const RECIPES=['recipe:hardened_steel','recipe:precision_lock_tool','recipe:tempered_precision_lock_tool'];
const fail=reason=>{throw new GameError('company_specialization',reason);};
const id=value=>{if(typeof value!=='string'||!value.length||value.length>200)fail('identity');return value;};
const key=value=>{if(typeof value!=='string'||!/^[!-~]{1,128}$/.test(value))fail('key');return value;};
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);
export const companySpecializationDDL=`CREATE TABLE IF NOT EXISTS company_specializations (
 business_id TEXT PRIMARY KEY REFERENCES business_depots(id), account_id TEXT NOT NULL REFERENCES accounts(id),
 original_character TEXT NOT NULL REFERENCES characters(id), revision INT NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),
 kind TEXT NOT NULL CHECK(kind IN ('volume','quality','speed','niche')), recipe_ids JSONB NOT NULL,
 tool_item_id TEXT REFERENCES item_instances(id), next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 allow_agent_production BOOLEAN NOT NULL DEFAULT false, grant_expires_at TIMESTAMPTZ,
 max_batch_cash INT NOT NULL DEFAULT 0 CHECK(max_batch_cash BETWEEN 0 AND 1800),
 max_grant_cash INT NOT NULL DEFAULT 0 CHECK(max_grant_cash BETWEEN 0 AND 1800),
 grant_spent INT NOT NULL DEFAULT 0 CHECK(grant_spent BETWEEN 0 AND 1800));
CREATE TABLE IF NOT EXISTS company_specialization_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL, identity JSONB NOT NULL, receipt JSONB NOT NULL,
 PRIMARY KEY(account_id,request_key));
CREATE TABLE IF NOT EXISTS company_specialization_runs (
 account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL, business_id TEXT NOT NULL REFERENCES business_depots(id),
 original_character TEXT NOT NULL REFERENCES characters(id), revision INT NOT NULL, total_crafts INT NOT NULL CHECK(total_crafts BETWEEN 1 AND 6),
 PRIMARY KEY(account_id,request_key));`;
export function companySpecializationTerms(body) {
  if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='agentGrantSeconds,allowAgentProduction,businessId,expectedRevision,kind,maxBatchCashCost,maxGrantCashCost,recipeIds,renewAgentGrant,toolItemId')fail('terms');
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||body.expectedRevision>2147483646||!Object.hasOwn(COMPANY_SPECIALIZATION,body.kind)||!Array.isArray(body.recipeIds)||body.recipeIds.length>2||new Set(body.recipeIds).size!==body.recipeIds.length||body.recipeIds.some(r=>!RECIPES.includes(r)))fail('terms');
  if((body.kind==='niche')!==(body.recipeIds.length>0)||(body.kind==='quality')!==(body.toolItemId!==null))fail('terms');
  if(typeof body.allowAgentProduction!=='boolean'||typeof body.renewAgentGrant!=='boolean'||!Number.isSafeInteger(body.maxBatchCashCost)||body.maxBatchCashCost<0||body.maxBatchCashCost>1800||!Number.isSafeInteger(body.maxGrantCashCost)||body.maxGrantCashCost<body.maxBatchCashCost||body.maxGrantCashCost>1800||!Number.isSafeInteger(body.agentGrantSeconds))fail('grant_terms');
  if(body.allowAgentProduction?(body.agentGrantSeconds<60||body.agentGrantSeconds>86400):(body.maxBatchCashCost!==0||body.maxGrantCashCost!==0||body.agentGrantSeconds!==0||body.renewAgentGrant))fail('grant_terms');
  return {businessId:id(body.businessId),expectedRevision:body.expectedRevision,kind:body.kind,recipeIds:[...body.recipeIds].sort(),toolItemId:body.toolItemId===null?null:id(body.toolItemId),allowAgentProduction:body.allowAgentProduction,maxBatchCashCost:body.maxBatchCashCost,maxGrantCashCost:body.maxGrantCashCost,agentGrantSeconds:body.agentGrantSeconds,renewAgentGrant:body.renewAgentGrant};
}
async function actor(client,accountId,expected) {
  const row=(await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE account_id=$1 AND alive FOR UPDATE',[id(accountId)])).rows[0];
  if(!row||row.is_npc||(expected&&row.id!==expected))fail('actor');
  if((await client.query('SELECT id,status FROM accounts WHERE id=$1 FOR UPDATE',[accountId])).rows[0]?.status!=='active')fail('actor');return row;
}
async function business(client,character,businessId) {
  const row=(await client.query('SELECT id,owner_character,status FROM business_depots WHERE id=$1 FOR UPDATE',[id(businessId)])).rows[0];
  if(!row||row.owner_character!==character.id||row.status!=='open')fail('business');
}
async function healthy(client,policy,ch) {
  if(policy.kind!=='quality')return;
  const tool=(await client.query('SELECT owner_scope,owner_id FROM item_instances WHERE id=$1',[policy.tool_item_id])).rows[0];
  if(!tool||!((tool.owner_scope==='account'&&tool.owner_id===ch.account_id)||(tool.owner_scope==='character'&&tool.owner_id===ch.id)))fail('tool_owner');
  await assertEquipmentUsable(client,{itemId:policy.tool_item_id,owner:{scope:tool.owner_scope,id:tool.owner_id},minimum:80});
}
async function setCompanySpecializationImpl(client,accountId,body,requestKey,{ownerSession=false}={}) {
  assertItemTransaction(client);const terms=companySpecializationTerms(body);key(requestKey);
  const prior=(await client.query('SELECT identity,receipt FROM company_specialization_requests WHERE account_id=$1 AND request_key=$2',[id(accountId),requestKey])).rows[0];
  if(prior){if(stable(prior.identity)!==stable(terms))fail('request_conflict');return {...prior.receipt,replayed:true};}
  if(terms.allowAgentProduction&&ownerSession!==true)fail('owner_authority');
  const ch=await actor(client,accountId);await business(client,ch,terms.businessId);
  const old=(await client.query('SELECT * FROM company_specializations WHERE business_id=$1 FOR UPDATE',[terms.businessId])).rows[0];
  if(Number(old?.revision??0)!==terms.expectedRevision||(old&&(old.account_id!==accountId||old.original_character!==ch.id)))fail('revision');
  await healthy(client,{kind:terms.kind,tool_item_id:terms.toolItemId},ch);
  const revision=terms.expectedRevision+1;
  const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now,expires=terms.allowAgentProduction?new Date(new Date(now).getTime()+terms.agentGrantSeconds*1000):null,spent=terms.renewAgentGrant?0:Number(old?.grant_spent??0);
  if(terms.allowAgentProduction&&spent>terms.maxGrantCashCost)fail('grant_budget');
  if(old){await client.query('UPDATE company_specializations SET revision=$2,kind=$3,recipe_ids=$4,tool_item_id=$5,allow_agent_production=$6,grant_expires_at=$7,max_batch_cash=$8,max_grant_cash=$9,grant_spent=$10 WHERE business_id=$1',[terms.businessId,revision,terms.kind,JSON.stringify(terms.recipeIds),terms.toolItemId,terms.allowAgentProduction,expires,terms.maxBatchCashCost,terms.maxGrantCashCost,spent]);registerItemTransactionUndo(client,()=>client.query('UPDATE company_specializations SET revision=$2,kind=$3,recipe_ids=$4,tool_item_id=$5,allow_agent_production=$6,grant_expires_at=$7,max_batch_cash=$8,max_grant_cash=$9,grant_spent=$10 WHERE business_id=$1',[old.business_id,old.revision,old.kind,JSON.stringify(old.recipe_ids),old.tool_item_id,old.allow_agent_production,old.grant_expires_at,old.max_batch_cash,old.max_grant_cash,old.grant_spent]));}
  else {await client.query('INSERT INTO company_specializations(business_id,account_id,original_character,revision,kind,recipe_ids,tool_item_id,allow_agent_production,grant_expires_at,max_batch_cash,max_grant_cash,grant_spent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[terms.businessId,accountId,ch.id,revision,terms.kind,JSON.stringify(terms.recipeIds),terms.toolItemId,terms.allowAgentProduction,expires,terms.maxBatchCashCost,terms.maxGrantCashCost,spent]);registerItemTransactionUndo(client,()=>client.query('DELETE FROM company_specializations WHERE business_id=$1',[terms.businessId]));}
  const receipt={ok:true,businessId:terms.businessId,revision,kind:terms.kind,...COMPANY_SPECIALIZATION[terms.kind],immutableRecipeQuality:true,agentGrant:{enabled:terms.allowAgentProduction,expiresAt:expires?.toISOString()??null,maxBatchCashCost:terms.maxBatchCashCost,maxGrantCashCost:terms.maxGrantCashCost,spent}};
  await client.query('INSERT INTO company_specialization_requests(account_id,request_key,identity,receipt) VALUES($1,$2,$3,$4)',[accountId,requestKey,terms,receipt]);registerItemTransactionUndo(client,()=>client.query('DELETE FROM company_specialization_requests WHERE account_id=$1 AND request_key=$2',[accountId,requestKey]));return receipt;
}
async function assertCompanySpecializationBeforeCraftImpl(client,ctx) {
  assertItemTransaction(client);const ch=await actor(client,ctx.accountId,id(ctx.originalCharacter));await business(client,ch,ctx.businessId);
  if(!Number.isSafeInteger(ctx.ordinal)||ctx.ordinal<0||ctx.ordinal>=ctx.totalCrafts||!Number.isSafeInteger(ctx.totalCrafts)||ctx.totalCrafts<1||ctx.totalCrafts>6)fail('batch');key(ctx.requestKey);
  if(typeof ctx.agent!=='boolean'||!Number.isSafeInteger(ctx.totalCashCost)||ctx.totalCashCost<0||ctx.totalCashCost>1800||!Number.isSafeInteger(ctx.recipeCashCost)||ctx.recipeCashCost<0||ctx.recipeCashCost>ctx.totalCashCost)fail('cost_authority');
  const restrictive=ctx.agent?await latestPolicy(client,ctx.businessId,true):null;
  const policy=(await client.query('SELECT * FROM company_specializations WHERE business_id=$1 FOR UPDATE',[ctx.businessId])).rows[0];if(!policy){if(restrictive)fail('production_consent');return {kind:'unselected',productionAuthorized:true,grant:'canonical_baseline',agentGrantExpiresAt:null};}
  if(policy.account_id!==ctx.accountId||policy.original_character!==ch.id)fail('original_actor');
  const limits=COMPANY_SPECIALIZATION[policy.kind];if(ctx.totalCrafts>limits.maxCrafts||(policy.kind==='niche'&&!policy.recipe_ids.includes(ctx.recipeId)))fail('profile_limit');await healthy(client,policy,ch);
  const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  if(restrictive&&(!policy.allow_agent_production||!policy.grant_expires_at||new Date(policy.grant_expires_at)<=new Date(now)||ctx.totalCashCost>Number(policy.max_batch_cash)))fail('production_consent');
  const old=(await client.query('SELECT * FROM company_specialization_runs WHERE account_id=$1 AND request_key=$2',[ctx.accountId,ctx.requestKey])).rows[0];
  if(old){if(old.business_id!==ctx.businessId||old.original_character!==ch.id||old.revision!==policy.revision||old.total_crafts!==ctx.totalCrafts)fail('run_identity');}
  else {
    if(ctx.ordinal!==0)fail('run_order');if(new Date(policy.next_run_at)>new Date(now))fail('cadence');
    if(restrictive) {
      if(!policy.allow_agent_production||!policy.grant_expires_at||new Date(policy.grant_expires_at)<=new Date(now)||ctx.totalCashCost>Number(policy.max_batch_cash)||Number(policy.grant_spent)+ctx.totalCashCost>Number(policy.max_grant_cash))fail('production_consent');
      await client.query('UPDATE company_specializations SET grant_spent=$2 WHERE business_id=$1',[ctx.businessId,Number(policy.grant_spent)+ctx.totalCashCost]);registerItemTransactionUndo(client,()=>client.query('UPDATE company_specializations SET grant_spent=$2 WHERE business_id=$1',[ctx.businessId,policy.grant_spent]));
    }
    await client.query('INSERT INTO company_specialization_runs(account_id,request_key,business_id,original_character,revision,total_crafts) VALUES($1,$2,$3,$4,$5,$6)',[ctx.accountId,ctx.requestKey,ctx.businessId,ch.id,policy.revision,ctx.totalCrafts]);registerItemTransactionUndo(client,()=>client.query('DELETE FROM company_specialization_runs WHERE account_id=$1 AND request_key=$2',[ctx.accountId,ctx.requestKey]));
    await client.query('UPDATE company_specializations SET next_run_at=$2 WHERE business_id=$1',[ctx.businessId,new Date(new Date(now).getTime()+limits.cadence*1000)]);registerItemTransactionUndo(client,()=>client.query('UPDATE company_specializations SET next_run_at=$2 WHERE business_id=$1',[ctx.businessId,policy.next_run_at]));
  }
  return {kind:policy.kind,revision:policy.revision,maxCrafts:limits.maxCrafts,cadenceSeconds:limits.cadence,immutableRecipeQuality:true,equipmentWear:false,productionAuthorized:true,grant:restrictive?'explicit_owner_game_grant':'canonical_baseline',agentGrantExpiresAt:restrictive?new Date(policy.grant_expires_at).toISOString():null};
}
export async function ownCompanySpecializations(client,accountId) {
  return (await client.query('SELECT business_id,revision,kind,recipe_ids,tool_item_id,next_run_at,allow_agent_production,grant_expires_at,max_batch_cash,max_grant_cash,grant_spent FROM company_specializations WHERE account_id=$1 ORDER BY business_id LIMIT 20',[id(accountId)])).rows;
}
export async function setCompanySpecialization(client,...args) {
  assertItemTransaction(client);try{return await setCompanySpecializationImpl(client,...args);}catch(error){poisonItemTransaction(client,error);throw error;}
}
export async function assertCompanySpecializationBeforeCraft(client,ctx) {
  assertItemTransaction(client);try{return await assertCompanySpecializationBeforeCraftImpl(client,ctx);}catch(error){poisonItemTransaction(client,error);throw error;}
}
