import crypto from 'node:crypto';
import { GameError, withCharacter, ledger } from './game.js';
import { assertItemTransaction, poisonItemTransaction, registerItemTransactionUndo, withItemRead } from './items.js';
import { withdrawDepot, DEPOT } from './depot.js';
import { tribute } from './social/gangs.js';
import { latestPolicy, guardDelegatedControl } from './operatingpolicy.js';
import { dayOf, M3 } from './rules.js';
import { concessionProductionContext, withInfrastructureConcession, concessionToolAuthority } from './infrastructureconcessions.js';

export const TERRITORY_ECONOMICS = Object.freeze({ maximumBps: 2000, maximumDailyCash: 5000, maximumLifetimeCash: 10000, maximumSeconds: 3600, journalLimit: 500, ledgerLimit: 1000 });
export const territoryEconomicsDDL = `CREATE TABLE IF NOT EXISTS territory_economics_profiles (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL UNIQUE REFERENCES business_depots(id), original_account TEXT NOT NULL REFERENCES accounts(id),
 original_character TEXT NOT NULL REFERENCES characters(id), gang_id TEXT NOT NULL, district_id TEXT NOT NULL REFERENCES districts(id),
 concession_id TEXT NOT NULL REFERENCES infrastructure_concessions(id), source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64),
 baseline_ids JSONB NOT NULL, revision INT NOT NULL CHECK(revision>=1), enabled BOOLEAN NOT NULL, share_bps INT NOT NULL CHECK(share_bps BETWEEN 1 AND 2000),
 daily_cap INT NOT NULL CHECK(daily_cap BETWEEN 100 AND 5000), lifetime_cap INT NOT NULL CHECK(lifetime_cap BETWEEN 100 AND 10000),
 paid_cash INT NOT NULL DEFAULT 0 CHECK(paid_cash>=0 AND paid_cash<=lifetime_cap), expires_at TIMESTAMPTZ NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','closed','party_dead')));
CREATE TABLE IF NOT EXISTS territory_economics_requests (
 account_id TEXT NOT NULL, key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64), body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),
 run_id TEXT NOT NULL UNIQUE, receipt JSONB, actor_ref TEXT REFERENCES characters(id), account_ref TEXT REFERENCES accounts(id),
 PRIMARY KEY(account_id,key_hash), CHECK((receipt IS NULL AND actor_ref IS NULL AND account_ref IS NULL) OR
 (receipt IS NOT NULL AND actor_ref IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL)));
CREATE TABLE IF NOT EXISTS territory_economics_payments (
 id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES territory_economics_profiles(id), revision INT NOT NULL CHECK(revision>=1),
 amount_cash INT NOT NULL CHECK(amount_cash BETWEEN 100 AND 5000), day_key INT NOT NULL, observed_profit INT NOT NULL CHECK(observed_profit>0),
 share_bps INT NOT NULL CHECK(share_bps BETWEEN 1 AND 2000), daily_cap INT NOT NULL CHECK(daily_cap BETWEEN 100 AND 5000), lifetime_cap INT NOT NULL CHECK(lifetime_cap BETWEEN 100 AND 10000), source_ids JSONB NOT NULL,
 withdraw_journal TEXT NOT NULL UNIQUE REFERENCES business_depot_journal(id), withdraw_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id),
 tribute_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id), created_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS territory_economics_sources (
 journal_id TEXT PRIMARY KEY REFERENCES business_depot_journal(id), profile_id TEXT NOT NULL REFERENCES territory_economics_profiles(id),
 payment_id TEXT NOT NULL REFERENCES territory_economics_payments(id));`;
const fail = message => { throw new GameError('territory_economics', message); };
const identity = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(value)) fail('identity'); return value; };
const exact = (body, keys) => body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).sort().join(',') === [...keys].sort().join(',');
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const clock = async client => new Date((await client.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const integer = (v, low, high) => { if (!Number.isSafeInteger(v) || v < low || v > high) fail('terms'); return v; };
function terms(action, body) {
  const keys = action === 'configure' ? ['businessId','expectedRevision','shareBps','dailyCapCash','lifetimeCapCash','expiresInSeconds','enabled'] : ['businessId','expectedRevision'];
  if (!exact(body, keys)) fail('terms'); identity(body.businessId); integer(body.expectedRevision, 0, 1000000);
  if (action === 'configure') {
    integer(body.shareBps, 1, 2000); integer(body.dailyCapCash, 100, 5000); integer(body.lifetimeCapCash, 100, 10000);
    integer(body.expiresInSeconds, 60, 3600); if (typeof body.enabled !== 'boolean') fail('terms');
  }
  return { action, ...body };
}
async function replay(client, account, normalized, key) {
  const old = (await client.query('SELECT body_hash,receipt FROM territory_economics_requests WHERE account_id=$1 AND key_hash=$2', [account, hash([account,key])])).rows[0];
  if (!old) return null; if (old.body_hash !== hash(normalized)) fail('request_conflict'); if (!old.receipt) fail('in_progress'); return old.receipt;
}
async function request(client, account, ch, normalized, key, execute) {
  const kh=hash([account,key]), bh=hash(normalized), run=crypto.randomUUID();
  const old=await replay(client,account,normalized,key); if(old) return old;
  registerItemTransactionUndo(client,()=>client.query('DELETE FROM territory_economics_requests WHERE account_id=$1 AND key_hash=$2 AND run_id=$3',[account,kh,run]));
  await client.query('INSERT INTO territory_economics_requests(account_id,key_hash,body_hash,run_id) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,key_hash) DO NOTHING',[account,kh,bh,run]);
  const row=(await client.query('SELECT run_id,body_hash,receipt FROM territory_economics_requests WHERE account_id=$1 AND key_hash=$2 FOR UPDATE',[account,kh])).rows[0];
  if(row.body_hash!==bh)fail('request_conflict'); if(row.receipt)return row.receipt; if(row.run_id!==run)fail('in_progress');
  const receipt=await execute(); const saved=await client.query('UPDATE territory_economics_requests SET receipt=$4,actor_ref=$5,account_ref=$1 WHERE account_id=$1 AND key_hash=$2 AND run_id=$3 AND receipt IS NULL',[account,kh,run,receipt,ch.id]);
  if(saved.rowCount!==1)fail('receipt_changed'); return receipt;
}
async function journalWindow(client, businessId, bounded=true) {
  const rows=bounded ? (await client.query('SELECT * FROM business_depot_journal WHERE depot_id=$1 ORDER BY id LIMIT 501 FOR UPDATE',[businessId])).rows
    : (await client.query('SELECT * FROM business_depot_journal WHERE depot_id=$1 ORDER BY id',[businessId])).rows;
  if(bounded&&rows.length>500)fail('source_unknown'); return rows;
}
async function sourceProfit(client, businessId, baseline, bounded=true) {
  const rows=await journalWindow(client,businessId,bounded), found=new Set(rows.map(r=>r.id));
  if(!Array.isArray(baseline)||new Set(baseline).size!==baseline.length||baseline.some(id=>!found.has(id)))fail('source_unknown');
  const books=bounded ? (await client.query("SELECT id,character_id,currency,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('depot:buy','depot:take') ORDER BY id LIMIT 1001 FOR UPDATE",[businessId])).rows
    : (await client.query("SELECT id,character_id,currency,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('depot:buy','depot:take') ORDER BY id",[businessId])).rows;
  if(bounded&&books.length>1000)fail('source_unknown');
  const sales=new Map(); let net=0, buys=0, takes=0;
  for(const r of rows){
    if(![r.cash_delta,r.stock_delta,r.cost_delta,r.expense].every(v=>Number.isSafeInteger(Number(v)))||Number(r.expense)<0)fail('source_unknown');
    if(r.reason==='sale'){
      if(!r.customer_character||Number(r.cash_delta)<=0||Number(r.stock_delta)>=0||Number(r.cost_delta)>0||Number(r.expense)!==0)fail('source_unknown');
      sales.set(r.customer_character,(sales.get(r.customer_character)||0)+Number(r.cash_delta));net+=Number(r.cash_delta);
    }
  }
  const customerBooks=new Map();
  for(const b of books){if(b.currency!=='cash'||!Number.isSafeInteger(Number(b.amount))||Number(b.amount)>=0)fail('source_unknown');
    if(b.reason==='depot:buy'){if(!b.character_id)fail('source_unknown');customerBooks.set(b.character_id,(customerBooks.get(b.character_id)||0)-Number(b.amount));buys-=Number(b.amount);}
    else {if(b.character_id!==null)fail('source_unknown');takes-=Number(b.amount);}}
  if(buys-net!==takes||sales.size!==customerBooks.size||[...sales].some(([id,n])=>!customerBooks.has(id)||customerBooks.get(id)<n))fail('source_unknown');
  const base=new Set(baseline), fresh=rows.filter(r=>!base.has(r.id)); let profit=0;
  for(const r of fresh){if(r.reason==='sale')profit+=Number(r.cash_delta)+Number(r.cost_delta);profit-=Number(r.expense);}
  if(!Number.isSafeInteger(profit))fail('source_unknown'); return {rows,fresh,profit};
}
async function original(client, ch, h, businessId) {
  if(!ch.alive||ch.is_npc||ch.account_id!==h.accountId)fail('original_actor');
  if((await client.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[h.accountId])).rows[0]?.status!=='active')fail('account');
  const depot=(await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE',[businessId])).rows[0];
  if(!depot||depot.status!=='open'||depot.owner_character!==ch.id)fail('business_owner');return depot;
}
async function family(client,ch,h,depot,row=null){
  const district=(await client.query('SELECT holder_gang FROM districts WHERE id=$1 FOR UPDATE',[depot.district])).rows[0];
  if(!h.owned.gangId||!district||district.holder_gang!==h.owned.gangId)fail('district_control');
  const gang=(await client.query('SELECT * FROM gangs WHERE id=$1 FOR UPDATE',[h.owned.gangId])).rows[0];
  const member=(await client.query('SELECT gang_id FROM gang_members WHERE character_id=$1 FOR UPDATE',[ch.id])).rows[0];
  if(!gang||gang.war_with||member?.gang_id!==gang.id)fail('family_changed');
  if(row&&(row.original_account!==h.accountId||row.original_character!==ch.id||row.gang_id!==gang.id||row.district_id!==depot.district))fail('original_party');return gang;
}
async function authority(client,ch,h,ctx){return concessionToolAuthority(client,{accountId:h.accountId,characterId:ch.id,businessId:ctx.businessId,itemId:ctx.itemId});}
async function restoreProfile(client,row){await client.query('UPDATE territory_economics_profiles SET revision=$2,enabled=$3,share_bps=$4,daily_cap=$5,lifetime_cap=$6,paid_cash=$7,expires_at=$8,state=$9 WHERE id=$1',[row.id,row.revision,row.enabled,row.share_bps,row.daily_cap,row.lifetime_cap,row.paid_cash,row.expires_at,row.state]);}
async function configure(ch,client,h,t,ctx,agent){
  const depot=await original(client,ch,h,t.businessId);await guardDelegatedControl(client,depot.id,agent);const gang=await family(client,ch,h,depot),proof=await authority(client,ch,h,ctx);
  const row=(await client.query('SELECT * FROM territory_economics_profiles WHERE business_id=$1 FOR UPDATE',[depot.id])).rows[0];
  if(Number(row?.revision||0)!==t.expectedRevision)fail('revision');const now=await clock(client),end=new Date(Math.min(+now+t.expiresInSeconds*1000,+new Date(proof.expiresAt)));
  if(+end-+now<60000)fail('expiry');
  if(row){if(row.original_account!==h.accountId||row.original_character!==ch.id||row.gang_id!==gang.id||row.concession_id!==proof.concessionId||row.source_hash!==proof.sourceHash||row.state==='party_dead'||t.lifetimeCapCash<Number(row.paid_cash))fail('original_party');
    registerItemTransactionUndo(client,()=>restoreProfile(client,row));await client.query("UPDATE territory_economics_profiles SET revision=revision+1,enabled=$2,share_bps=$3,daily_cap=$4,lifetime_cap=$5,expires_at=$6,state='active' WHERE id=$1",[row.id,t.enabled,t.shareBps,t.dailyCapCash,t.lifetimeCapCash,end]);
  }else{const baseline=await journalWindow(client,depot.id),id=crypto.randomUUID();await sourceProfit(client,depot.id,baseline.map(r=>r.id));registerItemTransactionUndo(client,()=>client.query('DELETE FROM territory_economics_profiles WHERE id=$1',[id]));
    await client.query("INSERT INTO territory_economics_profiles(id,business_id,original_account,original_character,gang_id,district_id,concession_id,source_hash,baseline_ids,revision,enabled,share_bps,daily_cap,lifetime_cap,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$11,$12,$13,$14,'active')",[id,depot.id,h.accountId,ch.id,gang.id,depot.district,proof.concessionId,proof.sourceHash,JSON.stringify(baseline.map(r=>r.id)),t.enabled,t.shareBps,t.dailyCapCash,t.lifetimeCapCash,end]);}
  return {ok:true,businessId:depot.id,revision:t.expectedRevision+1,enabled:t.enabled,expiresAt:end.toISOString(),effect:'verified_retail_profit_to_original_family',cashMoved:0};
}
async function compensateCanonicalPayment(client,ch,gang,depot,journals){
  const ids=new Set(journals.map(r=>r.id)),day=dayOf(),daily=(await client.query('SELECT counters FROM daily_progress WHERE character_id=$1 AND day=$2 FOR UPDATE',[ch.id,day])).rows[0];
  const fund=(await client.query('SELECT fund FROM street_tax WHERE id=1 FOR UPDATE')).rows[0];
  registerItemTransactionUndo(client,async()=>{
    const after=(await client.query('SELECT id,reason FROM business_depot_journal WHERE depot_id=$1',[depot.id])).rows;
    for(const r of after)if(!ids.has(r.id)&&r.reason==='withdraw')await client.query('DELETE FROM business_depot_journal WHERE id=$1',[r.id]);
    await client.query('UPDATE business_depots SET treasury=$2 WHERE id=$1',[depot.id,depot.treasury]);
    await client.query('UPDATE gangs SET treasury=$2,lifetime_tribute=$3,season_tribute=$4,weekly_week=$5,weekly_progress=$6,weekly_done=$7,omr_reserve=$8 WHERE id=$1',[gang.id,gang.treasury,gang.lifetime_tribute,gang.season_tribute,gang.weekly_week,gang.weekly_progress,gang.weekly_done,gang.omr_reserve]);
    if(fund)await client.query('UPDATE street_tax SET fund=$1 WHERE id=1',[fund.fund]);
    if(daily)await client.query('UPDATE daily_progress SET counters=$3 WHERE character_id=$1 AND day=$2',[ch.id,day,daily.counters]);
    else await client.query('DELETE FROM daily_progress WHERE character_id=$1 AND day=$2',[ch.id,day]);
  });
}
async function run(ch,client,h,t,ctx){
  const depot=await original(client,ch,h,t.businessId),hint=(await client.query('SELECT * FROM territory_economics_profiles WHERE business_id=$1',[depot.id])).rows[0];
  if(!hint)fail('consent');const gang=await family(client,ch,h,depot,hint),profile=(await client.query('SELECT * FROM territory_economics_profiles WHERE business_id=$1 FOR UPDATE',[depot.id])).rows[0];
  if(!profile||Number(profile.revision)!==t.expectedRevision||!profile.enabled||profile.state!=='active')fail('consent');
  const proof=await authority(client,ch,h,ctx),policy=await latestPolicy(client,depot.id,true);
  if(proof.concessionId!==profile.concession_id||proof.sourceHash!==profile.source_hash)fail('concession_changed');
  const sources=await sourceProfit(client,depot.id,profile.baseline_ids),customers=new Set(sources.fresh.filter(r=>r.reason==='sale').map(r=>r.customer_character));
  for(const customer of customers){const party=(await client.query('SELECT account_id FROM characters WHERE id=$1',[customer])).rows[0];if(!party?.account_id||party.account_id===h.accountId)fail('customer_source');}
  const payments=(await client.query('SELECT amount_cash,day_key FROM territory_economics_payments WHERE profile_id=$1 ORDER BY id FOR UPDATE',[profile.id])).rows;
  const now=await clock(client);if(+now>=+new Date(profile.expires_at)||+now>=+new Date(proof.expiresAt))fail('expired');
  const day=dayOf(+now),today=payments.filter(p=>Number(p.day_key)===day).reduce((n,p)=>n+Number(p.amount_cash),0),paid=payments.reduce((n,p)=>n+Number(p.amount_cash),0);
  if(paid!==Number(profile.paid_cash))fail('books');
  const earned=Math.max(0,Math.floor(sources.profit*Number(profile.share_bps)/10000));
  const amount=Math.min(Math.max(0,earned-paid),Number(profile.lifetime_cap)-paid,Math.max(0,Number(profile.daily_cap)-today),Math.max(0,Number(depot.treasury)-Math.max(DEPOT.cashReserve,Number(policy?.reserve_cash||0))));
  if(amount<M3.TRIBUTE_MIN)return {ok:true,businessId:depot.id,revision:Number(profile.revision),paidCash:0,eligibleProfit:Math.max(0,sources.profit),state:'below_minimum_or_cap',minimumCash:M3.TRIBUTE_MIN};
  const existing=(await client.query('SELECT journal_id FROM territory_economics_sources WHERE profile_id=$1 ORDER BY journal_id FOR UPDATE',[profile.id])).rows, used=new Set(existing.map(r=>r.journal_id));
  const freshSales=sources.fresh.filter(r=>r.reason==='sale'&&!used.has(r.id));
  for(const sale of freshSales)if((await client.query('SELECT profile_id FROM territory_economics_sources WHERE journal_id=$1 FOR UPDATE',[sale.id])).rows.length)fail('source_used');
  await compensateCanonicalPayment(client,ch,gang,depot,sources.rows);const entries=[];
  const trusted={...h,ledger:(c,entry)=>ledger(c,entry,{beforeInsert:id=>{entries.push({id,...entry});registerItemTransactionUndo(c,()=>c.query('DELETE FROM transactions WHERE id=$1',[id]));}})};
  await withdrawDepot(ch,depot.id,amount,client,trusted);await tribute(ch,amount,client,trusted);
  const after=await journalWindow(client,depot.id),before=new Set(sources.rows.map(r=>r.id)),withdrawals=after.filter(r=>!before.has(r.id)&&r.reason==='withdraw');
  const withdraw=entries.filter(r=>r.reason==='depot:withdraw'),contribution=entries.filter(r=>r.reason==='gang:tribute');
  if(withdrawals.length!==1||withdraw.length!==1||contribution.length!==1||Number(withdrawals[0].cash_delta)!==-amount)fail('payment_witness');
  const paymentId=crypto.randomUUID();registerItemTransactionUndo(client,()=>client.query('DELETE FROM territory_economics_payments WHERE id=$1',[paymentId]));
  await client.query('INSERT INTO territory_economics_payments(id,profile_id,revision,amount_cash,day_key,observed_profit,share_bps,daily_cap,lifetime_cap,source_ids,withdraw_journal,withdraw_transaction,tribute_transaction,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[paymentId,profile.id,profile.revision,amount,day,sources.profit,profile.share_bps,profile.daily_cap,profile.lifetime_cap,JSON.stringify(sources.fresh.map(r=>r.id)),withdrawals[0].id,withdraw[0].id,contribution[0].id,now]);
  for(const sale of freshSales){registerItemTransactionUndo(client,()=>client.query('DELETE FROM territory_economics_sources WHERE journal_id=$1 AND payment_id=$2',[sale.id,paymentId]));await client.query('INSERT INTO territory_economics_sources(journal_id,profile_id,payment_id) VALUES($1,$2,$3)',[sale.id,profile.id,paymentId]);}
  registerItemTransactionUndo(client,()=>restoreProfile(client,profile));await client.query('UPDATE territory_economics_profiles SET paid_cash=paid_cash+$2 WHERE id=$1',[profile.id,amount]);
  return {ok:true,businessId:depot.id,revision:Number(profile.revision),paymentId,paidCash:amount,eligibleProfit:sources.profit,state:'paid',sourceSales:freshSales.length};
}
async function close(ch,client,h,t){
  const profile=(await client.query('SELECT * FROM territory_economics_profiles WHERE business_id=$1 FOR UPDATE',[t.businessId])).rows[0];
  if(!profile||profile.original_account!==h.accountId||profile.original_character!==ch.id||Number(profile.revision)!==t.expectedRevision)fail('original_party');
  registerItemTransactionUndo(client,()=>restoreProfile(client,profile));await client.query("UPDATE territory_economics_profiles SET enabled=false,state='closed',revision=revision+1 WHERE id=$1",[profile.id]);return {ok:true,businessId:t.businessId,revision:t.expectedRevision+1,state:'closed',cashMoved:0};
}
export async function territoryEconomicsAction(pool,accountId,action,body,key,{agentCredential=false}={}){
  identity(accountId);identity(key);if(!['configure','run','close'].includes(action)||typeof agentCredential!=='boolean')fail('action');const normalized=terms(action,body);
  const prior=await withItemRead(pool,async c=>(await c.query('SELECT body_hash,receipt FROM territory_economics_requests WHERE account_id=$1 AND key_hash=$2',[accountId,hash([accountId,key])])).rows[0]);
  if(prior){if(prior.body_hash!==hash(normalized))fail('request_conflict');if(!prior.receipt)fail('in_progress');return prior.receipt;}
  const ctx=action==='close'?null:await withItemRead(pool,c=>concessionProductionContext(c,{accountId,businessId:normalized.businessId}));if(action!=='close'&&!ctx)fail('concession_required');
  let receipt;await withCharacter(pool,accountId,async(ch,c,h)=>{receipt=await request(c,accountId,ch,normalized,key,()=>action==='configure'?configure(ch,c,h,normalized,ctx,agentCredential):action==='run'?run(ch,c,h,normalized,ctx):close(ch,c,h,normalized));return receipt;},ctx?{withActionScope:(c,_a,execute)=>withInfrastructureConcession(c,ctx,execute)}:null);return receipt;
}
export async function territoryEconomicsBoard(pool,accountId){identity(accountId);return withItemRead(pool,async c=>{const rows=(await c.query('SELECT business_id,revision,enabled,share_bps,daily_cap,lifetime_cap,paid_cash,expires_at,state FROM territory_economics_profiles WHERE original_account=$1 ORDER BY business_id LIMIT 10',[accountId])).rows;return {profiles:rows.map(r=>({businessId:r.business_id,revision:Number(r.revision),enabled:r.enabled,shareBps:Number(r.share_bps),dailyCapCash:Number(r.daily_cap),lifetimeCapCash:Number(r.lifetime_cap),paidCash:Number(r.paid_cash),expiresAt:new Date(r.expires_at).toISOString(),state:r.state})),scope:'private_original_account',effect:'verified_retail_profit_to_original_family'};});}
export async function voidTerritoryEconomicsAtDeath(client,characterId){assertItemTransaction(client);identity(characterId);try{const victim=(await client.query('SELECT alive FROM characters WHERE id=$1 FOR UPDATE',[characterId])).rows[0];if(!victim||victim.alive)fail('death_source');const rows=(await client.query('SELECT * FROM territory_economics_profiles WHERE original_character=$1 ORDER BY id FOR UPDATE',[characterId])).rows;for(const row of rows){registerItemTransactionUndo(client,()=>restoreProfile(client,row));await client.query("UPDATE territory_economics_profiles SET enabled=false,state='party_dead' WHERE id=$1",[row.id]);}return {closed:rows.length,cashMoved:0};}catch(e){poisonItemTransaction(client,e);throw e;}}
export async function collectTerritoryEconomicsIssues(pool){
  const issues=[],profiles=(await pool.query('SELECT * FROM territory_economics_profiles ORDER BY id')).rows;
  for(const p of profiles){const payments=(await pool.query('SELECT * FROM territory_economics_payments WHERE profile_id=$1 ORDER BY id',[p.id])).rows;let paid=0;const days=new Map();
    let cumulative=0;for(const pay of [...payments].sort((a,b)=>+new Date(a.created_at)-+new Date(b.created_at)||a.id.localeCompare(b.id))){paid+=Number(pay.amount_cash);cumulative+=Number(pay.amount_cash);days.set(Number(pay.day_key),(days.get(Number(pay.day_key))||0)+Number(pay.amount_cash));
      const w=(await pool.query('SELECT depot_id,reason,cash_delta FROM business_depot_journal WHERE id=$1',[pay.withdraw_journal])).rows[0],a=(await pool.query('SELECT character_id,currency,amount,reason,counterparty FROM transactions WHERE id=$1',[pay.withdraw_transaction])).rows[0],b=(await pool.query('SELECT character_id,currency,amount,reason,counterparty FROM transactions WHERE id=$1',[pay.tribute_transaction])).rows[0];
      if(!w||w.depot_id!==p.business_id||w.reason!=='withdraw'||Number(w.cash_delta)!==-Number(pay.amount_cash)||!a||a.character_id!==p.original_character||a.currency!=='cash'||a.reason!=='depot:withdraw'||a.counterparty!==p.business_id||Number(a.amount)!==Number(pay.amount_cash)||!b||b.character_id!==p.original_character||b.currency!=='cash'||b.reason!=='gang:tribute'||b.counterparty!==p.gang_id||Number(b.amount)!==-Number(pay.amount_cash))issues.push({profileId:p.id,reason:'payment_witness'});
      if(cumulative>Math.floor(Number(pay.observed_profit)*Number(pay.share_bps)/10000)||cumulative>Number(pay.lifetime_cap)||days.get(Number(pay.day_key))>Number(pay.daily_cap))issues.push({profileId:p.id,reason:'profit_cap'});
      const snapshotIds=pay.source_ids;
      if(!Array.isArray(snapshotIds)||new Set(snapshotIds).size!==snapshotIds.length)issues.push({profileId:p.id,reason:'source_snapshot'});
      else {let observed=0;for(const id of snapshotIds){const j=(await pool.query('SELECT depot_id,reason,cash_delta,cost_delta,expense FROM business_depot_journal WHERE id=$1',[id])).rows[0];if(!j||j.depot_id!==p.business_id||p.baseline_ids.includes(id)){issues.push({profileId:p.id,reason:'source_snapshot'});continue;}if(j.reason==='sale')observed+=Number(j.cash_delta)+Number(j.cost_delta);observed-=Number(j.expense);}if(observed!==Number(pay.observed_profit))issues.push({profileId:p.id,reason:'source_profit'});}
    }
    if(paid!==Number(p.paid_cash)||paid>Number(p.lifetime_cap))issues.push({profileId:p.id,reason:'consent_books'});
    try{await sourceProfit(pool,p.business_id,p.baseline_ids,false);}catch{issues.push({profileId:p.id,reason:'source_unknown'});}
  }
  const refs=(await pool.query('SELECT s.journal_id,s.profile_id,s.payment_id,j.depot_id,j.reason,p.business_id,r.profile_id payment_profile FROM territory_economics_sources s LEFT JOIN business_depot_journal j ON j.id=s.journal_id LEFT JOIN territory_economics_profiles p ON p.id=s.profile_id LEFT JOIN territory_economics_payments r ON r.id=s.payment_id ORDER BY s.journal_id')).rows;
  for(const r of refs)if(r.reason!=='sale'||r.depot_id!==r.business_id||r.payment_profile!==r.profile_id)issues.push({profileId:r.profile_id,reason:'source_binding'});return issues;
}
