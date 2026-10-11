import crypto from 'node:crypto';
import { GameError } from './game.js';
import { DISTRICTS, jailed, safeHoused, priceBlock } from './rules.js';
import { marketPrices } from './streets.js';
import { canonicalBytes } from './content/canonical.js';
import { INTEL_FORECAST, intelForecastSnapshot, intelForecastOutcome } from './intelforecasts.js';

const fail = message => { throw new GameError('strategy_license', message); };
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const requestKey = value => { if (typeof value !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(value)) fail('Provide a bounded request identity.'); };
const intake = () => { if (process.env.DEPOT_PILOT !== 'on') fail('New strategy licenses are not open.'); };
const person = ch => { if (!ch?.alive || ch.is_npc || !key(ch.id) || !key(ch.account_id)) fail('Use a living player or agent.'); };
const mobile = ch => { person(ch); if (jailed(ch) || safeHoused(ch)) fail('Surface before trading a new strategy license.'); };
const iso = value => value == null ? null : new Date(value).toISOString();
function exact(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || ![Object.prototype, null].includes(Object.getPrototypeOf(body))) fail('Provide exact strategy terms.');
  const keys = Reflect.ownKeys(body);
  if (keys.length !== fields.length || keys.some(k => !fields.includes(k)) || fields.some(k => !Object.hasOwn(Object.getOwnPropertyDescriptor(body, k), 'value'))) fail('Provide exact strategy terms.');
}
function terms(body) {
  exact(body, ['title','rule','feeCash']); exact(body.rule, ['kind','districtId','minimumStock','triggerStock']);
  const {rule} = body;
  if (typeof body.title !== 'string' || body.title !== body.title.trim() || body.title.length < 1 || body.title.length > 100 || /[\x00-\x1f\x7f]/.test(body.title)
      || rule.kind !== 'gin_availability_v1' || !DISTRICTS.some(d => d.id === rule.districtId)
      || ![rule.minimumStock,rule.triggerStock].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 40)
      || !Number.isSafeInteger(body.feeCash) || body.feeCash < 50 || body.feeCash > 5000) fail('Invalid finite forecast rule or license fee.');
  const clean = { kind: rule.kind, districtId: rule.districtId, minimumStock: rule.minimumStock, triggerStock: rule.triggerStock };
  return {title:body.title,rule:clean,feeCash:body.feeCash,ruleHash:crypto.createHash('sha256').update(canonicalBytes(clean)).digest('hex')};
}
const publicView = v => ({id:v.id,sellerAccountId:v.seller_account,title:v.title,kind:'gin_availability_v1',feeCash:Number(v.fee_cash),
  createdAt:iso(v.created_at),targetAt:iso(v.target_at),windowEndsAt:iso(new Date(v.target_at).getTime()+INTEL_FORECAST.scoreGraceMs),
  outcome:v.outcome, resolvedAt:iso(v.resolved_at),sampledAt:v.sample?.observedAt || null,retiredAt:iso(v.retired_at),
  outcomeScope:'first_public_stock_sample_in_30s_window',profitVerified:false,causalImprovementVerified:false});
const privateView = v => ({...publicView(v),ruleHash:v.rule_hash,rule:v.rule,observation:v.observation,predictsAvailable:v.predicts_available,reportedAt:iso(v.reported_at),sample:v.sample});
async function lockedVersion(client,id) {
  if(!key(id)) fail('Choose a strategy version.');
  const v=(await client.query('SELECT * FROM strategy_versions WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!v)fail('No strategy version.');return v;
}
async function license(client,v,buyer,keyValue) {
  const prior=(await client.query('SELECT * FROM strategy_licenses WHERE buyer_account=$1 AND request_key=$2 FOR UPDATE',[buyer.account_id,keyValue])).rows[0];
  if(prior&&prior.version_id!==v.id)fail('This request identity already bought a different version.');
  const owned=prior || (await client.query('SELECT * FROM strategy_licenses WHERE buyer_account=$1 AND version_id=$2 FOR UPDATE',[buyer.account_id,v.id])).rows[0];
  if(owned && owned.request_key!==keyValue)fail('Already licensed: use your library or the original purchase identity.');
  return owned;
}
const purchase = (v,l,replayed=false) => ({ok:true,license:{id:l.id,versionId:l.version_id,buyerAccountId:l.buyer_account,buyerCharacterId:l.buyer_character,
  sellerPaidCharacterId:l.seller_paid_character,feeCash:Number(l.fee_cash),purchasedAt:iso(l.purchased_at)},strategy:privateView(v),replayed});
export async function publishStrategy(ch,body,identity,client,_h) {
  person(ch);requestKey(identity);const t=terms(body);
  const prior=(await client.query('SELECT * FROM strategy_versions WHERE seller_account=$1 AND request_key=$2 FOR UPDATE',[ch.account_id,identity])).rows[0];
  if(prior){if(prior.title!==t.title||Number(prior.fee_cash)!==t.feeCash||prior.rule_hash!==t.ruleHash)fail('This identity already published different terms.');return {ok:true,strategy:privateView(prior),replayed:true};}
  intake();mobile(ch);
  const own=(await client.query('SELECT id FROM strategy_versions WHERE seller_account=$1 AND retired_at IS NULL LIMIT 10',[ch.account_id])).rows;
  if(own.length>=10)fail('Ten current versions are already published.');
  const started=Date.now(),block=priceBlock(started),board=await marketPrices(client,block),at=Date.now(),target=at+300000;
  if(at<started||priceBlock(at)!==block||priceBlock(target)!==block)fail('Publish when a full five-minute holdout fits this market block.');
  const observation=intelForecastSnapshot(board,t.rule.districtId,at),prediction=observation.stock>=t.rule.triggerStock,id=crypto.randomUUID();
  // Content, prediction and future target are frozen together; no caller outcome or target is accepted.
  await client.query(`INSERT INTO strategy_versions(id,seller_account,seller_character,request_key,title,rule,rule_hash,fee_cash,created_at,target_at,price_block,observation,predicts_available,reported_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[id,ch.account_id,ch.id,identity,t.title,t.rule,t.ruleHash,t.feeCash,new Date(at),new Date(target),block,observation,prediction,new Date(at)]);
  return {ok:true,strategy:privateView((await client.query('SELECT * FROM strategy_versions WHERE id=$1',[id])).rows[0])};
}
export async function buyStrategy(buyer,currentSeller,versionId,identity,client,h) {
  person(buyer);requestKey(identity);const v=await lockedVersion(client,versionId),prior=await license(client,v,buyer,identity);
  if(prior)return purchase(v,prior,true);
  intake();mobile(buyer);mobile(currentSeller);
  if(v.retired_at||v.seller_character!==currentSeller.id||v.seller_account!==currentSeller.account_id||buyer.account_id===v.seller_account)fail('Buy from the original living seller using your independent account.');
  const fee=Number(v.fee_cash),buyerCash=Number(buyer.cash)-fee,sellerCash=Number(currentSeller.cash)+fee;
  if(!Number.isSafeInteger(fee)||fee<50||fee>5000||![buyerCash,sellerCash].every(n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER))fail('Actual pocket cash cannot cover the fixed license fee.');
  const id=crypto.randomUUID(),at=new Date();
  await client.query('INSERT INTO strategy_licenses(id,version_id,buyer_account,buyer_character,seller_paid_character,fee_cash,purchased_at,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,v.id,buyer.account_id,buyer.id,currentSeller.id,fee,at,identity]);
  await h.ledger(client,{characterId:buyer.id,currency:'cash',amount:-fee,reason:`strategy:buy:${id}`});
  await h.ledger(client,{characterId:currentSeller.id,currency:'cash',amount:fee,reason:`strategy:sell:${id}`});
  buyer.cash=buyerCash;currentSeller.cash=sellerCash;
  return purchase(v,(await client.query('SELECT * FROM strategy_licenses WHERE id=$1',[id])).rows[0]);
}
export async function resolveStrategyHoldout(ch,versionId,client) {
  person(ch);const v=await lockedVersion(client,versionId);
  if(v.seller_account!==ch.account_id&&!(await client.query('SELECT id FROM strategy_licenses WHERE version_id=$1 AND buyer_account=$2',[v.id,ch.account_id])).rows.length)fail('Only the publisher or a licensed account can resolve this holdout.');
  if(v.outcome!=null)return {ok:true,strategy:privateView(v),replayed:true};
  const start=Date.now(),target=new Date(v.target_at).getTime(),end=target+INTEL_FORECAST.scoreGraceMs;
  if(start<target)return {ok:true,pending:true,strategy:privateView(v)};
  let sample=null,sampleStarted=null,outcome='unknown',completed=start;
  if(start<=end&&priceBlock(start)===Number(v.price_block)){
    try { const board=await marketPrices(client,Number(v.price_block));completed=Date.now();
    if(completed>=start&&completed<=end&&priceBlock(completed)===Number(v.price_block)){sample=intelForecastSnapshot(board,v.rule.districtId,completed);sampleStarted=new Date(start);
      outcome=intelForecastOutcome({districtId:v.rule.districtId,minimumStock:v.rule.minimumStock,targetAt:iso(v.target_at),reportedAt:iso(v.reported_at),predictsAvailable:v.predicts_available,observation:v.observation},sample,completed);}
    } catch(error) { if(error?.code)throw error;completed=Date.now();sample=null;sampleStarted=null;outcome='unknown'; }
  }
  await client.query('UPDATE strategy_versions SET outcome=$2,resolved_at=$3,sample_started_at=$4,sample=$5 WHERE id=$1 AND outcome IS NULL',[v.id,outcome,new Date(completed),sampleStarted,sample]);
  return {ok:true,strategy:privateView((await client.query('SELECT * FROM strategy_versions WHERE id=$1',[v.id])).rows[0])};
}
export async function strategyCatalog(client) {
  const rows=(await client.query('SELECT * FROM strategy_versions WHERE retired_at IS NULL ORDER BY created_at DESC,id LIMIT 100')).rows;
  const reputation=new Map();
  for(const v of rows)if(!reputation.has(v.seller_account)){
    const counts={correct:0,incorrect:0,unknown:0,pending:0,total:0};
    for(const r of (await client.query('SELECT outcome,COUNT(*) AS n FROM strategy_versions WHERE seller_account=$1 GROUP BY outcome',[v.seller_account])).rows){const k=r.outcome===null?'pending':r.outcome;if(!Object.hasOwn(counts,k))fail('Unknown recorded outcome.');counts[k]+=Number(r.n);counts.total+=Number(r.n);}
    reputation.set(v.seller_account,counts);
  }
  return rows.map(v=>({...publicView(v),publisherOutcomes:reputation.get(v.seller_account)}));
}
export async function strategyLibrary(client,accountId) {
  if(!key(accountId))fail('Use your original account.');
  const rows=(await client.query(`SELECT v.* FROM strategy_versions v WHERE v.seller_account=$1 OR v.id IN
    (SELECT version_id FROM strategy_licenses WHERE buyer_account=$1) ORDER BY v.created_at DESC,v.id LIMIT 100`,[accountId])).rows;
  return rows.map(privateView);
}
