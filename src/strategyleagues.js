import crypto from 'node:crypto';
import { GameError } from './game.js';
import { DISTRICTS, jailed, safeHoused, priceBlock } from './rules.js';
import { marketPrices } from './streets.js';
import { canonicalBytes } from './content/canonical.js';
import { INTEL_FORECAST, intelForecastSnapshot, intelForecastOutcome } from './intelforecasts.js';

const fail = message => { throw new GameError('strategy_league', message); };
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const iso = value => value == null ? null : new Date(value).toISOString();
const intake = () => { if(process.env.DEPOT_PILOT!=='on')fail('New benchmark participation is not open.'); };
const person = ch => { if(!ch?.alive||ch.is_npc||!key(ch.id)||!key(ch.account_id))fail('Use a living human or agent account.'); };
const mobile = ch => { person(ch);if(jailed(ch)||safeHoused(ch))fail('Surface before entering or starting a benchmark.'); };
function exact(body,fields){if(!body||typeof body!=='object'||Array.isArray(body)||![Object.prototype,null].includes(Object.getPrototypeOf(body)))fail('Provide exact benchmark terms.');const keys=Reflect.ownKeys(body);if(keys.length!==fields.length||keys.some(k=>!fields.includes(k))||fields.some(k=>!Object.hasOwn(Object.getOwnPropertyDescriptor(body,k),'value')))fail('Provide exact benchmark terms.');}
function terms(body){exact(body,['districtId','minimumStock']);if(!DISTRICTS.some(d=>d.id===body.districtId)||!Number.isSafeInteger(body.minimumStock)||body.minimumStock<1||body.minimumStock>40)fail('Choose canonical public gin conditions.');return body;}
function ruleOf(v,l){const r=v.rule;exact(r,['kind','districtId','minimumStock','triggerStock']);if(r.kind!=='gin_availability_v1'||r.districtId!==l.district_id||r.minimumStock!==Number(l.minimum_stock)||!Number.isSafeInteger(r.triggerStock)||r.triggerStock<1||r.triggerStock>40||crypto.createHash('sha256').update(canonicalBytes(r)).digest('hex')!==v.rule_hash)fail('The immutable version does not match this cohort.');return JSON.parse(JSON.stringify(r));}
async function locked(client,id){if(!key(id))fail('Choose a benchmark.');const l=(await client.query('SELECT * FROM strategy_leagues WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!l)fail('No benchmark.');return l;}
async function entries(client,id,lock=false){const sql=lock?'SELECT * FROM strategy_league_entries WHERE league_id=$1 ORDER BY id FOR UPDATE':'SELECT * FROM strategy_league_entries WHERE league_id=$1 ORDER BY id';const rows=(await client.query(sql,[id])).rows;if(rows.length>20)fail('Cohort capacity is invalid.');return rows;}
function view(l,rows,accountId=null){const graded=l.state==='resolved'&&l.result_kind==='graded';const correct=rows.filter(e=>e.outcome==='correct').length;
  const standings=rows.map(e=>({id:e.id,accountId:e.account_id,outcome:e.outcome,attempts:1,scored:['correct','incorrect'].includes(e.outcome)?1:0,unknown:e.outcome==='unknown'?1:0,pending:e.outcome==null?1:0,
    points:graded?(e.outcome==='correct'?1:0):null,rank:graded?(e.outcome==='correct'?1:correct+1):null})).sort((a,b)=>(b.points??-1)-(a.points??-1)||a.accountId.localeCompare(b.accountId));
  const own=accountId&&rows.find(e=>e.account_id===accountId);
  return {id:l.id,creatorAccountId:l.creator_account,state:l.state,districtId:l.district_id,minimumStock:Number(l.minimum_stock),createdAt:iso(l.created_at),enrollmentExpiresAt:iso(l.enrollment_expires_at),
    observedAt:iso(l.observed_at),targetAt:iso(l.target_at),windowEndsAt:l.target_at?iso(new Date(l.target_at).getTime()+INTEL_FORECAST.scoreGraceMs):null,
    sampledAt:l.sample?.observedAt||null,resolvedAt:iso(l.resolved_at),resultKind:l.result_kind,standings,
    denominators:{attempted:rows.length,graded:rows.filter(e=>['correct','incorrect'].includes(e.outcome)).length,unknown:rows.filter(e=>e.outcome==='unknown').length,pending:rows.filter(e=>e.outcome==null).length},
    ...(own?{ownEntry:{id:own.id,versionId:own.version_id,licenseId:own.license_id,rule:own.rule,ruleHash:own.rule_hash,predictsAvailable:own.predicts_available,outcome:own.outcome}}:{}),
    scope:'prize_free_shared_public_stock_benchmark',prizesEnabled:false,entryFeeCash:0,cashRewards:0,profitVerified:false,causalImprovementVerified:false,manipulationResistanceVerified:false};}
const response=async(client,l,accountId,extra={})=>({ok:true,league:view(l,await entries(client,l.id),accountId),...extra});
const participant=(l,rows,ch)=>{if(l.creator_account!==ch.account_id&&!rows.some(e=>e.account_id===ch.account_id))fail('Only the creator or an enrolled original account can resolve this cohort.');};
async function unknown(client,l,at){await client.query("UPDATE strategy_league_entries SET outcome='unknown' WHERE league_id=$1 AND outcome IS NULL",[l.id]);await client.query("UPDATE strategy_leagues SET state='resolved',result_kind='unknown',resolved_at=$2,sample=NULL,sample_started_at=NULL WHERE id=$1 AND state<>'resolved'",[l.id,new Date(at)]);l.state='resolved';l.result_kind='unknown';l.resolved_at=new Date(at);l.sample=null;l.sample_started_at=null;}
export async function createStrategyLeague(ch,body,identity,client){person(ch);const t=terms(body);if(typeof identity!=='string'||!/^[\x21-\x7e]{1,200}$/.test(identity))fail('Provide a bounded request identity.');
  const prior=(await client.query('SELECT * FROM strategy_leagues WHERE creator_account=$1 AND request_key=$2 FOR UPDATE',[ch.account_id,identity])).rows[0];
  if(prior){if(prior.district_id!==t.districtId||Number(prior.minimum_stock)!==t.minimumStock)fail('This identity already created different conditions.');return response(client,prior,ch.account_id,{replayed:true});}
  intake();mobile(ch);if((await client.query("SELECT id FROM strategy_leagues WHERE creator_account=$1 AND state IN ('enrolling','running') LIMIT 1",[ch.account_id])).rows.length)fail('Resolve your previous active cohort before creating another.');
  const at=Date.now(),id=crypto.randomUUID();await client.query("INSERT INTO strategy_leagues(id,creator_account,creator_character,request_key,created_at,enrollment_expires_at,state,district_id,minimum_stock) VALUES($1,$2,$3,$4,$5,$6,'enrolling',$7,$8)",[id,ch.account_id,ch.id,identity,new Date(at),new Date(at+600000),t.districtId,t.minimumStock]);
  return response(client,(await client.query('SELECT * FROM strategy_leagues WHERE id=$1',[id])).rows[0],ch.account_id);
}
export async function joinStrategyLeague(ch,id,body,client){person(ch);exact(body,['versionId']);if(!key(body.versionId))fail('Choose an owned or licensed version.');const l=await locked(client,id);
  // The actor/account lock precedes assets; common order is league -> version -> entry.
  const existing=(await client.query('SELECT * FROM strategy_league_entries WHERE league_id=$1 AND account_id=$2',[l.id,ch.account_id])).rows[0];
  if(existing){if(existing.version_id!==body.versionId)fail('Your original-account entry is already fixed.');return response(client,l,ch.account_id,{replayed:true});}
  intake();mobile(ch);if(l.state!=='enrolling'||Date.now()>=new Date(l.enrollment_expires_at).getTime())fail('Enrollment is closed.');
  const v=(await client.query('SELECT * FROM strategy_versions WHERE id=$1 FOR UPDATE',[body.versionId])).rows[0];if(!v||v.retired_at)fail('No current strategy version.');
  const rule=ruleOf(v,l);let licenseId=null,licenseAt=null;
  if(v.seller_account!==ch.account_id){const license=(await client.query('SELECT id,purchased_at FROM strategy_licenses WHERE version_id=$1 AND buyer_account=$2',[v.id,ch.account_id])).rows[0];if(!license)fail('Buy private access or enter your own published version.');licenseId=license.id;licenseAt=new Date(license.purchased_at).getTime();}
  const rows=await entries(client,l.id,true);if(rows.length>=20)fail('Twenty original-account entries already joined.');const at=new Date();if(at.getTime()>=new Date(l.enrollment_expires_at).getTime())fail('Enrollment expired while acquiring its asset locks.');if(licenseId&&(!Number.isFinite(licenseAt)||licenseAt>at.getTime()))fail('Private access must predate entry consent.');
  await client.query('INSERT INTO strategy_league_entries(id,league_id,account_id,character_id,version_id,license_id,rule,rule_hash,joined_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[crypto.randomUUID(),l.id,ch.account_id,ch.id,v.id,licenseId,rule,v.rule_hash,at]);
  return response(client,l,ch.account_id);
}
export async function startStrategyLeague(ch,id,client){person(ch);const l=await locked(client,id);if(l.creator_account!==ch.account_id)fail('Only the original creator account starts this cohort.');
  if(l.state!=='enrolling')return response(client,l,ch.account_id,{replayed:true});intake();mobile(ch);
  const rows=await entries(client,l.id,true);if(rows.length<2)fail('Two original accounts must commit before the common observation.');
  const start=Date.now();if(start>=new Date(l.enrollment_expires_at).getTime())fail('Resolve this expired lobby.');
  const block=priceBlock(start),board=await marketPrices(client,block),at=Date.now(),target=at+300000;
  if(at>=new Date(l.enrollment_expires_at).getTime())fail('Enrollment expired before the common observation completed.');
  if(at<start||priceBlock(at)!==block||priceBlock(target)!==block)fail('A full common five-minute target must fit the current market block.');
  const observation=intelForecastSnapshot(board,l.district_id,at);
  for(const e of rows){ruleOf({rule:e.rule,rule_hash:e.rule_hash},l);await client.query('UPDATE strategy_league_entries SET predicts_available=$2 WHERE id=$1 AND predicts_available IS NULL',[e.id,observation.stock>=e.rule.triggerStock]);}
  await client.query("UPDATE strategy_leagues SET state='running',observation=$2,observed_at=$3,target_at=$4,price_block=$5 WHERE id=$1 AND state='enrolling'",[l.id,observation,new Date(at),new Date(target),block]);
  return response(client,(await client.query('SELECT * FROM strategy_leagues WHERE id=$1',[l.id])).rows[0],ch.account_id);
}
export async function resolveStrategyLeague(ch,id,client){person(ch);const l=await locked(client,id),rows=await entries(client,l.id,true);participant(l,rows,ch);
  if(l.state==='resolved')return {ok:true,league:view(l,rows,ch.account_id),replayed:true};const start=Date.now();
  if(l.state==='enrolling'){if(start<new Date(l.enrollment_expires_at).getTime())return {ok:true,pending:true,league:view(l,rows,ch.account_id)};await unknown(client,l,start);return response(client,l,ch.account_id);}
  const target=new Date(l.target_at).getTime(),end=target+INTEL_FORECAST.scoreGraceMs;if(start<target)return {ok:true,pending:true,league:view(l,rows,ch.account_id)};
  let sample=null,completed=start;const outcomes=[];
  if(start<=end&&priceBlock(start)===Number(l.price_block)){try{const board=await marketPrices(client,Number(l.price_block));completed=Date.now();if(completed>=start&&completed<=end&&priceBlock(completed)===Number(l.price_block)){
    sample=intelForecastSnapshot(board,l.district_id,completed);
    for(const e of rows)outcomes.push(intelForecastOutcome({districtId:l.district_id,minimumStock:Number(l.minimum_stock),targetAt:iso(l.target_at),reportedAt:iso(l.observed_at),observation:l.observation,predictsAvailable:e.predicts_available},sample,completed));
  }}catch(error){if(error?.code)throw error;completed=Date.now();sample=null;}}
  if(!sample||rows.length<2||outcomes.length!==rows.length||outcomes.includes('unknown')){await unknown(client,l,completed);return response(client,l,ch.account_id);}
  for(let i=0;i<rows.length;i++)await client.query('UPDATE strategy_league_entries SET outcome=$2 WHERE id=$1 AND outcome IS NULL',[rows[i].id,outcomes[i]]);
  await client.query("UPDATE strategy_leagues SET state='resolved',result_kind='graded',sample=$2,sample_started_at=$3,resolved_at=$4 WHERE id=$1 AND state='running'",[l.id,sample,new Date(start),new Date(completed)]);
  return response(client,(await client.query('SELECT * FROM strategy_leagues WHERE id=$1',[l.id])).rows[0],ch.account_id);
}
export async function strategyLeagueBoard(client,accountId=null){if(accountId!=null&&!key(accountId))fail('Use an authenticated original account for private access.');
  // One statement supplies coherent cohort/entry snapshots, and the cohort bound precedes the join.
  const sql=accountId==null?`SELECT l.*,e.id AS entry_id,e.account_id AS entry_account,e.character_id AS entry_character,e.version_id AS entry_version,e.license_id AS entry_license,e.rule AS entry_rule,e.rule_hash AS entry_hash,e.joined_at AS entry_joined,e.predicts_available AS entry_prediction,e.outcome AS entry_outcome
    FROM strategy_leagues l LEFT JOIN strategy_league_entries e ON e.league_id=l.id WHERE l.id IN
    (SELECT id FROM strategy_leagues ORDER BY created_at DESC,id LIMIT 100) ORDER BY l.created_at DESC,l.id,e.id`:`SELECT l.*,e.id AS entry_id,e.account_id AS entry_account,e.character_id AS entry_character,e.version_id AS entry_version,e.license_id AS entry_license,e.rule AS entry_rule,e.rule_hash AS entry_hash,e.joined_at AS entry_joined,e.predicts_available AS entry_prediction,e.outcome AS entry_outcome
    FROM strategy_leagues l LEFT JOIN strategy_league_entries e ON e.league_id=l.id WHERE l.id IN
    (SELECT id FROM strategy_leagues WHERE creator_account=$1 OR id IN
      (SELECT league_id FROM strategy_league_entries WHERE account_id=$1) ORDER BY created_at DESC,id LIMIT 100) ORDER BY l.created_at DESC,l.id,e.id`;
  const rows=(await client.query(sql,accountId==null?[]:[accountId])).rows;
  const groups=new Map();for(const r of rows){if(!groups.has(r.id))groups.set(r.id,{league:r,entries:[]});if(r.entry_id)groups.get(r.id).entries.push({id:r.entry_id,account_id:r.entry_account,character_id:r.entry_character,version_id:r.entry_version,license_id:r.entry_license,rule:r.entry_rule,rule_hash:r.entry_hash,joined_at:r.entry_joined,predicts_available:r.entry_prediction,outcome:r.entry_outcome});}
  return [...groups.values()].map(g=>view(g.league,g.entries,accountId));
}
