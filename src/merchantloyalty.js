import crypto from 'node:crypto';
import { GameError } from './game.js';
import * as I from './items.js';
import * as C from './consignments.js';

export const MERCHANT_LOYALTY = Object.freeze({ maximumPrograms:2, maximumQuotes:4, maximumUses:20, maximumPriorPurchases:5, quoteSeconds:60 });
const fail = reason => { throw new GameError('merchant_loyalty', reason); };
const id = value => { if(typeof value!=='string'||!/^[!-~]{1,128}$/.test(value))fail('identity');return value; };
const exact = (v,keys) => v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const whole = (v,min=0,max=Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v)&&v>=min&&v<=max;
const stable = v => JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a<b?-1:a>b?1:0)):x);
const hash = v => crypto.createHash('sha256').update(stable(v)).digest('hex');
const date = v => new Date(v).toISOString();
const clock = async c => new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const digest = v => typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const purchaseContexts = new WeakMap();

function hooks(){
  for(const name of ['consignmentEconomyListing','consignmentEconomySaleWitness','buyConsignmentWithEconomyContext','assertFreshConsignmentSaleProof'])if(typeof C[name]!=='function')fail('integration_required');
}
function terms(action,b){
  if(action==='create'){
    if(!exact(b,['requiredPurchases','discountBps','maximumDiscountCash','maximumUses','lifetimeSeconds','consent'])||b.consent!==true||!whole(b.requiredPurchases,2,5)||!whole(b.discountBps,1,2000)||!whole(b.maximumDiscountCash,1,100000)||!whole(b.maximumUses,1,20)||!whole(b.lifetimeSeconds,60,86400))fail('terms');
    return {action,...b};
  }
  if(action==='close'){
    if(!exact(b,['programId','programSourceHash','consent'])||!digest(b.programSourceHash)||b.consent!==true)fail('terms');
    return {action,programId:id(b.programId),programSourceHash:b.programSourceHash,consent:true};
  }
  if(action==='quote'){
    if(!exact(b,['programId','programSourceHash','consignmentId','sourceHash','qualifyingSaleIds','consent'])||!digest(b.programSourceHash)||!digest(b.sourceHash)||b.consent!==true||!Array.isArray(b.qualifyingSaleIds)||b.qualifyingSaleIds.length<2||b.qualifyingSaleIds.length>5)fail('terms');
    const sales=b.qualifyingSaleIds.map(id).sort();if(new Set(sales).size!==sales.length)fail('distinct_purchases');
    return {action,programId:id(b.programId),programSourceHash:b.programSourceHash,consignmentId:id(b.consignmentId),sourceHash:b.sourceHash,qualifyingSaleIds:sales,consent:true};
  }
  if(action==='buy'){
    if(!exact(b,['quoteId','quoteSourceHash','consent'])||!digest(b.quoteSourceHash)||b.consent!==true)fail('terms');
    return {action,quoteId:id(b.quoteId),quoteSourceHash:b.quoteSourceHash,consent:true};
  }
  fail('action');
}
const programSource = p => ({id:p.id,sellerAccount:p.seller_account,sellerCharacter:p.seller_character,requiredPurchases:Number(p.required_purchases),discountBps:Number(p.discount_bps),maximumDiscountCash:Number(p.maximum_discount),maximumUses:Number(p.maximum_uses),observedAt:date(p.observed_at),expiresAt:date(p.expires_at)});
const programDTO = p => ({programId:p.id,programSourceHash:p.source_hash,requiredPurchases:Number(p.required_purchases),discountBps:Number(p.discount_bps),maximumDiscountCash:Number(p.maximum_discount),maximumUses:Number(p.maximum_uses),usedCount:Number(p.used_count),expiresAt:date(p.expires_at),status:p.status});
const quoteSource = q => ({id:q.id,programId:q.program_id,programSourceHash:q.program_hash,consignmentId:q.consignment_id,saleSourceHash:q.sale_hash,itemId:q.item_id,seller:{accountId:q.seller_account,characterId:q.seller_character},host:{accountId:q.host_account,characterId:q.host_character},buyer:{accountId:q.buyer_account,characterId:q.buyer_character},grossPrice:Number(q.gross_price),buyerPaid:Number(q.buyer_paid),hostFee:Number(q.host_fee),sellerPaid:Number(q.seller_paid),discountCash:Number(q.discount_cash),qualification:q.qualification,observedAt:date(q.observed_at),expiresAt:date(q.expires_at)});
const quoteDTO = q => ({quoteId:q.id,quoteSourceHash:q.source_hash,programId:q.program_id,consignmentId:q.consignment_id,grossPrice:Number(q.gross_price),buyerPaid:Number(q.buyer_paid),hostFee:Number(q.host_fee),sellerPaid:Number(q.seller_paid),discountCash:Number(q.discount_cash),expiresAt:date(q.expires_at),status:q.status});
function checkProgram(p){
  if(!p||hash(programSource(p))!==p.source_hash||!whole(Number(p.required_purchases),2,5)||!whole(Number(p.discount_bps),1,2000)||!whole(Number(p.maximum_discount),1,100000)||!whole(Number(p.maximum_uses),1,20)||!whole(Number(p.used_count),0,Number(p.maximum_uses)))fail('program_source');
  return p;
}
function pricing(p,gross,fee){
  const discountCash=Math.min(Math.floor(gross*Number(p.discount_bps)/10000),Number(p.maximum_discount)),buyerPaid=gross-discountCash,sellerPaid=buyerPaid-fee;
  if(!whole(discountCash,1,100000)||!whole(buyerPaid,1,1000000)||!whole(sellerPaid))fail('no_discount');
  return {grossPrice:gross,buyerPaid,hostFee:fee,sellerPaid,discountCash};
}
function checkQuote(q,p){
  checkProgram(p);if(!q||q.program_id!==p.id||q.program_hash!==p.source_hash||q.seller_account!==p.seller_account||q.seller_character!==p.seller_character||hash(quoteSource(q))!==q.source_hash||!Array.isArray(q.qualification)||q.qualification.length!==Number(p.required_purchases))fail('quote_source');
  const amounts=pricing(p,Number(q.gross_price),Number(q.host_fee));for(const [k,col]of [['buyerPaid','buyer_paid'],['sellerPaid','seller_paid'],['discountCash','discount_cash']])if(amounts[k]!==Number(q[col]))fail('quote_source');
  if(+new Date(q.observed_at)<+new Date(p.observed_at)||+new Date(q.expires_at)>+new Date(p.expires_at)||+new Date(q.expires_at)>+new Date(q.observed_at)+60000||+new Date(q.expires_at)<=+new Date(q.observed_at))fail('quote_source');return q;
}
async function authoredProgram(c,p){
  const authored=(await c.query('SELECT account_id,body_hash,original_character,request_json,receipt FROM merchant_loyalty_requests WHERE run_id=$1',[p.id])).rows,created=authored[0],b=created?.request_json;
  if(authored.length!==1||created.account_id!==p.seller_account||created.original_character!==p.seller_character||b?.action!=='create'||!exact(b,['action','requiredPurchases','discountBps','maximumDiscountCash','maximumUses','lifetimeSeconds','consent'])||created.body_hash!==hash(b)||b.consent!==true||!whole(b.lifetimeSeconds,60,86400)||b.requiredPurchases!==Number(p.required_purchases)||b.discountBps!==Number(p.discount_bps)||b.maximumDiscountCash!==Number(p.maximum_discount)||b.maximumUses!==Number(p.maximum_uses)||+new Date(p.expires_at)!==+new Date(p.observed_at)+b.lifetimeSeconds*1000||stable(created.receipt)!==stable({ok:true,...programDTO({...p,status:'active',used_count:0})}))fail('program_receipt');
}
async function authoredQuote(c,q){
  const rows=(await c.query('SELECT account_id,body_hash,original_character,request_json,receipt FROM merchant_loyalty_requests WHERE run_id=$1',[q.id])).rows,r=rows[0],b=r?.request_json;
  if(rows.length!==1||r.account_id!==q.buyer_account||r.original_character!==q.buyer_character||!exact(b,['action','programId','programSourceHash','consignmentId','sourceHash','qualifyingSaleIds','consent'])||r.body_hash!==hash(b)||b.action!=='quote'||b.consent!==true||b.programId!==q.program_id||b.programSourceHash!==q.program_hash||b.consignmentId!==q.consignment_id||b.sourceHash!==q.sale_hash||stable(b.qualifyingSaleIds)!==stable(q.qualification.map(w=>w.consignmentId))||stable(r.receipt)!==stable({ok:true,...quoteDTO({...q,status:'quoted'})}))fail('quote_receipt');
}
async function current(c,account){const rows=(await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2',[account])).rows;if(rows.length!==1)fail('original_actor');return rows[0].id;}
async function ownActor(c,account){
  const char=await current(c,account),rows=await C.lockConsignmentParties(c,[char]),actor=rows[0];if(!actor?.alive||actor.account_id!==account||await current(c,account)!==actor.id)fail('original_actor');return actor;
}
async function admission(c,account,consignmentId,sourceHash){
  const before=await C.consignmentEconomyListing(c,consignmentId,sourceHash),buyerId=await current(c,account);
  const rows=await C.lockConsignmentParties(c,[before.seller.characterId,before.host.characterId,buyerId]);
  await c.query('SELECT id FROM consignments WHERE id=$1 FOR UPDATE',[consignmentId]);
  const after=await C.consignmentEconomyListing(c,consignmentId,sourceHash),buyer=rows.find(r=>r.id===buyerId&&r.account_id===account);
  if(stable(before)!==stable(after)||!buyer||rows.length!==3||rows.some(r=>!r.alive)||after.status!=='active'||[after.seller.accountId,after.host.accountId].includes(account))fail('original_actor');
  for(const party of [after.seller,after.host,{accountId:account,characterId:buyerId}])if(rows.find(r=>r.id===party.characterId)?.account_id!==party.accountId||await current(c,party.accountId)!==party.characterId)fail('original_actor');
  if(+await clock(c)>=+new Date(after.expiresAt))fail('expired');return {...after,buyer:{accountId:account,characterId:buyerId}};
}
function matchesListing(q,l){
  if(q.consignment_id!==l.consignmentId||q.sale_hash!==l.sourceHash||q.item_id!==l.itemId||Number(q.gross_price)!==l.grossPrice||Number(q.host_fee)!==l.hostFee||stable({accountId:q.seller_account,characterId:q.seller_character})!==stable(l.seller)||stable({accountId:q.host_account,characterId:q.host_character})!==stable(l.host)||stable({accountId:q.buyer_account,characterId:q.buyer_character})!==stable(l.buyer))fail('listing_changed');
}
function qualification(w){return {consignmentId:w.consignmentId,sourceHash:w.sourceHash,itemId:w.itemId,grossPrice:w.grossPrice,buyerPaid:w.buyerPaid,hostFee:w.hostFee,sellerPaid:w.sellerPaid,seller:w.seller,buyer:w.buyer,transactionIds:w.transactionIds,transferEventId:w.transferEventId};}
async function priorPurchases(c,saleIds,l,currentCustody=true,beforeSequence=null){
  const found=[];
  for(const saleId of saleIds){
    const row=(await c.query('SELECT settlement FROM consignments WHERE id=$1',[saleId])).rows[0];if(row?.settlement?.loyalty)fail('prior_purchase');
    const w=await C.consignmentEconomySaleWitness(c,saleId);if(w.buyerPaid!==w.grossPrice||stable(w.seller)!==stable(l.seller)||stable(w.buyer)!==stable(l.buyer)||w.itemId===l.itemId)fail('prior_purchase');found.push(qualification(w));
  }
  if(new Set(found.map(w=>w.itemId)).size!==found.length)fail('distinct_uids');
  for(const w of [...found].sort((a,b)=>a.itemId<b.itemId?-1:1)){
    if(currentCustody){
      const item=(await c.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1 FOR UPDATE',[w.itemId])).rows[0];
      const last=(await c.query("SELECT id FROM item_events WHERE item_id=$1 AND event_kind='transferred' ORDER BY sequence DESC LIMIT 1",[w.itemId])).rows[0];
      if(item?.owner_scope!=='account'||item.owner_id!==l.buyer.accountId||item.state!=='active'||last?.id!==w.transferEventId)fail('purchase_custody');
      if((await c.query("SELECT id FROM merchant_return_rights WHERE sale_id=$1 AND state IN ('offered','accepted') LIMIT 1",[w.consignmentId])).rows.length)fail('return_right');
    }else{
      const last=(await c.query("SELECT id FROM item_events WHERE item_id=$1 AND event_kind='transferred' AND sequence<$2 ORDER BY sequence DESC LIMIT 1",[w.itemId,beforeSequence])).rows[0];if(last?.id!==w.transferEventId)fail('historical_custody');
    }
  }
  return found;
}
async function capacity(c,p,buyer){
  if(p.status!=='active'||Number(p.used_count)>=Number(p.maximum_uses)||+await clock(c)>=+new Date(p.expires_at))fail('program_closed');
  if((await c.query("SELECT id FROM merchant_loyalty_quotes WHERE program_id=$1 AND buyer_character=$2 AND status='consumed' LIMIT 1",[p.id,buyer])).rows.length)fail('already_used');
}
async function request(c,account,action,body,key,execute){
  I.assertItemTransaction(c);id(account);id(key);const t=terms(action,body),keyHash=hash([account,key]),bodyHash=hash(t),prior=(await c.query('SELECT body_hash,receipt FROM merchant_loyalty_requests WHERE account_id=$1 AND key_hash=$2',[account,keyHash])).rows[0];
  if(prior){if(prior.body_hash!==bodyHash)fail('request_conflict');if(!prior.receipt)fail('in_progress');return prior.receipt;}
  hooks();const run=crypto.randomUUID();I.registerItemTransactionUndo(c,()=>c.query('DELETE FROM merchant_loyalty_requests WHERE account_id=$1 AND key_hash=$2 AND run_id=$3',[account,keyHash,run]));
  await c.query('INSERT INTO merchant_loyalty_requests(account_id,key_hash,body_hash,run_id,request_json) VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id,key_hash) DO NOTHING',[account,keyHash,bodyHash,run,t]);
  const reserved=(await c.query('SELECT body_hash,run_id,receipt FROM merchant_loyalty_requests WHERE account_id=$1 AND key_hash=$2 FOR UPDATE',[account,keyHash])).rows[0];if(reserved.body_hash!==bodyHash)fail('request_conflict');if(reserved.receipt)return reserved.receipt;if(reserved.run_id!==run)fail('in_progress');
  const result=await execute(t,run);if((await c.query('UPDATE merchant_loyalty_requests SET receipt=$4,account_ref=$1,original_character=$5 WHERE account_id=$1 AND key_hash=$2 AND run_id=$3 AND receipt IS NULL',[account,keyHash,run,result.receipt,result.actorId])).rowCount!==1)fail('receipt');return result.receipt;
}
async function create(c,account,t,run){
  const actor=await ownActor(c,account),now=await clock(c);
  if((await c.query("SELECT id FROM merchant_loyalty_programs WHERE seller_account=$1 AND seller_character=$2 AND status='active' AND expires_at>$3 ORDER BY id LIMIT 2",[account,actor.id,now])).rows.length>=2)fail('program_limit');
  const p={id:run,seller_account:account,seller_character:actor.id,required_purchases:t.requiredPurchases,discount_bps:t.discountBps,maximum_discount:t.maximumDiscountCash,maximum_uses:t.maximumUses,used_count:0,observed_at:now,expires_at:new Date(+now+t.lifetimeSeconds*1000),status:'active'};p.source_hash=hash(programSource(p));
  I.registerItemTransactionUndo(c,()=>c.query('DELETE FROM merchant_loyalty_programs WHERE id=$1',[run]));await c.query("INSERT INTO merchant_loyalty_programs(id,seller_account,seller_character,required_purchases,discount_bps,maximum_discount,maximum_uses,observed_at,expires_at,source_hash,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')",[p.id,account,actor.id,p.required_purchases,p.discount_bps,p.maximum_discount,p.maximum_uses,p.observed_at,p.expires_at,p.source_hash]);return {actorId:actor.id,receipt:{ok:true,...programDTO(p)}};
}
async function close(c,account,t){
  const actor=await ownActor(c,account),p=checkProgram((await c.query('SELECT * FROM merchant_loyalty_programs WHERE id=$1 FOR UPDATE',[t.programId])).rows[0]);if(p.source_hash!==t.programSourceHash||p.seller_account!==account||p.seller_character!==actor.id)fail('seller');
  I.registerItemTransactionUndo(c,()=>c.query('UPDATE merchant_loyalty_programs SET status=$2 WHERE id=$1',[p.id,p.status]));await c.query("UPDATE merchant_loyalty_programs SET status='closed' WHERE id=$1",[p.id]);return {actorId:actor.id,receipt:{ok:true,...programDTO({...p,status:'closed'})}};
}
async function quote(c,account,t,run){
  const l=await admission(c,account,t.consignmentId,t.sourceHash),p=checkProgram((await c.query('SELECT * FROM merchant_loyalty_programs WHERE id=$1 FOR UPDATE',[t.programId])).rows[0]);
  await authoredProgram(c,p);
  if(p.source_hash!==t.programSourceHash||p.seller_account!==l.seller.accountId||p.seller_character!==l.seller.characterId||t.qualifyingSaleIds.length!==Number(p.required_purchases))fail('program_source');await capacity(c,p,l.buyer.characterId);
  const now=await clock(c);if((await c.query("SELECT id FROM merchant_loyalty_quotes WHERE buyer_account=$1 AND status='quoted' AND expires_at>$2 ORDER BY id LIMIT 4",[account,now])).rows.length>=4)fail('quote_limit');
  const prior=await priorPurchases(c,t.qualifyingSaleIds,l),amount=pricing(p,l.grossPrice,l.hostFee),expires=new Date(Math.min(+now+60000,+new Date(p.expires_at),+new Date(l.expiresAt)));
  if(+await clock(c)>=+expires)fail('expired');const q={id:run,program_id:p.id,program_hash:p.source_hash,consignment_id:l.consignmentId,sale_hash:l.sourceHash,item_id:l.itemId,seller_account:l.seller.accountId,seller_character:l.seller.characterId,host_account:l.host.accountId,host_character:l.host.characterId,buyer_account:account,buyer_character:l.buyer.characterId,gross_price:amount.grossPrice,buyer_paid:amount.buyerPaid,host_fee:amount.hostFee,seller_paid:amount.sellerPaid,discount_cash:amount.discountCash,qualification:prior,observed_at:now,expires_at:expires,status:'quoted'};q.source_hash=hash(quoteSource(q));
  I.registerItemTransactionUndo(c,()=>c.query('DELETE FROM merchant_loyalty_quotes WHERE id=$1',[run]));await c.query("INSERT INTO merchant_loyalty_quotes(id,program_id,program_hash,consignment_id,sale_hash,item_id,seller_account,seller_character,host_account,host_character,buyer_account,buyer_character,gross_price,buyer_paid,host_fee,seller_paid,discount_cash,qualification,observed_at,expires_at,source_hash,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'quoted')",[q.id,q.program_id,q.program_hash,q.consignment_id,q.sale_hash,q.item_id,q.seller_account,q.seller_character,q.host_account,q.host_character,q.buyer_account,q.buyer_character,q.gross_price,q.buyer_paid,q.host_fee,q.seller_paid,q.discount_cash,JSON.stringify(q.qualification),q.observed_at,q.expires_at,q.source_hash]);return {actorId:l.buyer.characterId,receipt:{ok:true,...quoteDTO(q)}};
}
function attestation(q){return {programId:q.program_id,programSourceHash:q.program_hash,quoteId:q.id,quoteSourceHash:q.source_hash,discountCash:Number(q.discount_cash)};}
export async function assertMerchantLoyaltyPurchaseScope(c,token,consignmentId,sourceHash,buyerAccount){
  I.assertItemTransaction(c);I.assertItemTransactionHealthy(c);const s=token&&purchaseContexts.get(token);
  if(!s?.active||s.client!==c||s.transaction!==I.itemTransactionIdentity(c)||s.quote.consignment_id!==consignmentId||s.quote.sale_hash!==sourceHash||s.quote.buyer_account!==buyerAccount)fail('purchase_scope');
  const p=checkProgram((await c.query('SELECT * FROM merchant_loyalty_programs WHERE id=$1',[s.program.id])).rows[0]),q=checkQuote((await c.query('SELECT * FROM merchant_loyalty_quotes WHERE id=$1',[s.quote.id])).rows[0],p);
  await authoredProgram(c,p);await authoredQuote(c,q);
  if(stable(quoteSource(q))!==stable(quoteSource(s.quote))||q.status!=='quoted'||+await clock(c)>=+new Date(q.expires_at))fail('purchase_scope');await capacity(c,p,q.buyer_character);s.admitted=true;
  return Object.freeze({buyerPaid:Number(q.buyer_paid),hostFee:Number(q.host_fee),sellerPaid:Number(q.seller_paid),loyalty:Object.freeze(attestation(q))});
}
function matchesWitness(q,w){
  const source=quoteSource(q);for(const k of ['consignmentId','itemId','grossPrice','buyerPaid','hostFee','sellerPaid','seller','host','buyer'])if(stable(source[k])!==stable(w[k]))fail('sale_witness');if(w.sourceHash!==q.sale_hash)fail('sale_witness');
}
async function buy(c,account,t,run){
  const hint=(await c.query('SELECT consignment_id,sale_hash,program_id FROM merchant_loyalty_quotes WHERE id=$1',[t.quoteId])).rows[0];if(!hint)fail('quote_source');
  const l=await admission(c,account,hint.consignment_id,hint.sale_hash),p=checkProgram((await c.query('SELECT * FROM merchant_loyalty_programs WHERE id=$1 FOR UPDATE',[hint.program_id])).rows[0]),q=checkQuote((await c.query('SELECT * FROM merchant_loyalty_quotes WHERE id=$1 FOR UPDATE',[t.quoteId])).rows[0],p);
  await authoredProgram(c,p);await authoredQuote(c,q);
  if(q.source_hash!==t.quoteSourceHash||q.status!=='quoted')fail('quote_source');matchesListing(q,l);await capacity(c,p,l.buyer.characterId);if(+await clock(c)>=+new Date(q.expires_at))fail('expired');
  const prior=await priorPurchases(c,q.qualification.map(w=>w.consignmentId),l);if(stable(prior)!==stable(q.qualification))fail('qualification_changed');
  const token=Object.freeze({}),context={client:c,transaction:I.itemTransactionIdentity(c),program:p,quote:q,active:true,admitted:false};purchaseContexts.set(token,context);
  try{
    const scopes={loyaltyContext:token},result=await C.buyConsignmentWithEconomyContext(c,account,{consignmentId:q.consignment_id,sourceHash:q.sale_hash,consent:true},'merchant-loyalty:'+run+':sale',scopes);
    const witness=await C.assertFreshConsignmentSaleProof(c,result.saleProof,scopes);if(!context.admitted||!result.receipt||stable(result.receipt.loyalty)!==stable(attestation(q)))fail('sale_proof');matchesWitness(q,witness);
    if(+await clock(c)>=+new Date(q.expires_at)||+await clock(c)>=+new Date(p.expires_at))fail('expired');
    I.registerItemTransactionUndo(c,()=>c.query('UPDATE merchant_loyalty_quotes SET status=$2,sale_witness=$3,sale_receipt=$4 WHERE id=$1',[q.id,q.status,q.sale_witness,q.sale_receipt]));I.registerItemTransactionUndo(c,()=>c.query('UPDATE merchant_loyalty_programs SET used_count=$2 WHERE id=$1',[p.id,p.used_count]));
    if((await c.query("UPDATE merchant_loyalty_quotes SET status='consumed',sale_witness=$2,sale_receipt=$3 WHERE id=$1 AND status='quoted'",[q.id,witness,result.receipt])).rowCount!==1)fail('quote_source');
    if((await c.query("UPDATE merchant_loyalty_programs SET used_count=used_count+1 WHERE id=$1 AND status='active' AND used_count=$2 AND used_count<maximum_uses",[p.id,p.used_count])).rowCount!==1)fail('program_source');
    const verified=await C.consignmentEconomySaleWitness(c,q.consignment_id);matchesWitness(q,verified);if(stable(witness)!==stable(verified))fail('sale_proof');if(+await clock(c)>=+new Date(q.expires_at)||+await clock(c)>=+new Date(p.expires_at))fail('expired');
    return {actorId:l.buyer.characterId,receipt:{ok:true,...quoteDTO({...q,status:'consumed'}),sale:result.receipt}};
  }finally{context.active=false;}
}
export async function merchantLoyaltyAction(c,account,action,body,key){
  I.assertItemTransaction(c);try{return await request(c,account,action,body,key,(t,run)=>action==='create'?create(c,account,t,run):action==='close'?close(c,account,t):action==='quote'?quote(c,account,t,run):buy(c,account,t,run));}catch(e){I.poisonItemTransaction(c,e);throw e;}
}
// Read-only historical attestation. No private purchase context or fresh proof is minted here.
export async function verifyMerchantLoyaltySale(c,row,witness){
  const a=row?.settlement?.loyalty;if(!exact(a,['programId','programSourceHash','quoteId','quoteSourceHash','discountCash']))fail('sale_attestation');
  const p=checkProgram((await c.query('SELECT * FROM merchant_loyalty_programs WHERE id=$1',[id(a.programId)])).rows[0]),q=checkQuote((await c.query('SELECT * FROM merchant_loyalty_quotes WHERE id=$1',[id(a.quoteId)])).rows[0],p);
  if(q.status!=='consumed'||stable(a)!==stable(attestation(q))||stable(q.sale_witness)!==stable(witness)||stable(q.sale_receipt)!==stable(row.settlement)||q.consignment_id!==row.id||+new Date(q.expires_at)!==Math.min(+new Date(q.observed_at)+60000,+new Date(p.expires_at),+new Date(row.expires_at)))fail('sale_attestation');matchesWitness(q,witness);
  const event=(await c.query('SELECT sequence FROM item_events WHERE id=$1',[witness.transferEventId])).rows[0];if(!event)fail('sale_attestation');
  const l={itemId:q.item_id,seller:{accountId:q.seller_account,characterId:q.seller_character},buyer:{accountId:q.buyer_account,characterId:q.buyer_character}},prior=await priorPurchases(c,q.qualification.map(w=>w.consignmentId),l,false,event.sequence);if(stable(prior)!==stable(q.qualification))fail('qualification_changed');
  await authoredProgram(c,p);await authoredQuote(c,q);
  return witness;
}
export async function merchantLoyaltyBoard(c,account,sellerAccount=account){
  id(account);id(sellerAccount);const programs=(await c.query('SELECT * FROM merchant_loyalty_programs WHERE seller_account=$1 ORDER BY observed_at DESC,id DESC LIMIT 25',[sellerAccount])).rows,quotes=(await c.query('SELECT * FROM merchant_loyalty_quotes WHERE buyer_account=$1 ORDER BY observed_at DESC,id DESC LIMIT 25',[account])).rows;return {programs:programs.map(programDTO),quotes:quotes.map(quoteDTO)};
}
export async function collectMerchantLoyaltyIssues(c){
  const issues=[],programs=(await c.query('SELECT * FROM merchant_loyalty_programs ORDER BY id')).rows,quotes=(await c.query('SELECT * FROM merchant_loyalty_quotes ORDER BY id')).rows;
  for(const p of programs){try{checkProgram(p);await authoredProgram(c,p);if(quotes.filter(q=>q.program_id===p.id&&q.status==='consumed').length!==Number(p.used_count))throw Error('count');}catch{issues.push({id:p.id,reason:'program_book'});}}
  for(const q of quotes){try{checkQuote(q,programs.find(p=>p.id===q.program_id));await authoredQuote(c,q);if(q.status==='consumed')await C.consignmentEconomySaleWitness(c,q.consignment_id);}catch{issues.push({id:q.id,reason:'quote_book'});}}
  const requests=(await c.query('SELECT * FROM merchant_loyalty_requests ORDER BY account_id,key_hash')).rows;
  for(const r of requests){try{const b=r.request_json,t=terms(b?.action,Object.fromEntries(Object.entries(b||{}).filter(([k])=>k!=='action')));if(stable(t)!==stable(b)||r.body_hash!==hash(b)||r.account_ref!==r.account_id||!r.receipt||!r.original_character)throw Error('request');if(b.action==='create'&&!programs.some(p=>p.id===r.run_id&&p.seller_account===r.account_id&&p.seller_character===r.original_character))throw Error('program');if(b.action==='quote'&&!quotes.some(q=>q.id===r.run_id&&q.buyer_account===r.account_id&&q.buyer_character===r.original_character))throw Error('quote');if(b.action==='buy'){const q=quotes.find(q=>q.id===b.quoteId);if(!q||q.source_hash!==b.quoteSourceHash||q.buyer_account!==r.account_id||q.buyer_character!==r.original_character||q.status!=='consumed'||stable(r.receipt)!==stable({ok:true,...quoteDTO(q),sale:q.sale_receipt}))throw Error('purchase');}if(b.action==='close'){const p=programs.find(p=>p.id===b.programId);if(!p||p.source_hash!==b.programSourceHash||p.seller_account!==r.account_id||p.seller_character!==r.original_character||r.receipt?.status!=='closed')throw Error('close');}}catch{issues.push({id:r.run_id,reason:'request_binding'});}}
  return issues;
}
