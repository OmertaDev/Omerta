import { merchantReturnSaleWitness } from './merchantreturns.js';
import crypto from 'node:crypto';
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
export async function collectMerchantReturnIssues(c){
 const rights=(await c.query('SELECT * FROM merchant_return_rights ORDER BY id')).rows,requests=(await c.query('SELECT * FROM merchant_return_requests ORDER BY account_id,key_hash')).rows,
 journals=(await c.query("SELECT * FROM transactions WHERE reason IN ('merchant_return:reserve','merchant_return:payout','merchant_return:refund') ORDER BY id")).rows,
 guards=(await c.query("SELECT * FROM item_mutation_guards WHERE idempotency_key LIKE 'merchant-return:%' ORDER BY idempotency_key")).rows,
 events=(await c.query("SELECT * FROM item_events WHERE idempotency_key LIKE 'merchant-return:%' ORDER BY sequence")).rows,issues=[],used=new Set();
 for(const q of requests){const r=rights.find(r=>r.id===q.return_ref),action=q.request_json?.action,b=q.request_json,bodyKeys=action==='offer'?['action','consignmentId','sourceHash','refundCash','lifetimeSeconds','consent']:['action','returnId','sourceHash','consent'];const shape=exact(b,bodyKeys)&&b.consent===true&&(action!=='offer'||(Number.isSafeInteger(b.refundCash)&&b.refundCash>=1&&b.refundCash<=1000000&&Number.isSafeInteger(b.lifetimeSeconds)&&b.lifetimeSeconds>=60&&b.lifetimeSeconds<=86400));const immutable=r&&q.receipt?.saleId===r.sale_id&&q.receipt?.itemId===r.item_id&&q.receipt?.sellerOriginal===r.seller_character&&q.receipt?.buyerOriginal===r.buyer_character&&q.receipt?.refundCash===Number(r.refund_cash)&&q.receipt?.conditionFloor===Number(r.condition_floor)&&q.receipt?.expiresAt===new Date(r.expires_at).toISOString();if(!shape||!immutable||!r||q.body_hash!==hash(q.request_json)||q.account_ref!==q.account_id||![r.seller_account,r.buyer_account].includes(q.account_id)||q.original_character!==(q.account_id===r.seller_account?r.seller_character:r.buyer_character)||q.receipt?.returnId!==r.id||q.receipt?.sourceHash!==r.source_hash||q.request_json?.sourceHash!==(action==='offer'?r.sale_hash:r.source_hash)||!['offer','accept','return','cancel','expire'].includes(action))issues.push({id:q.run_id,reason:'request_binding'});}
 for(const r of rights){
  const source={id:r.id,saleId:r.sale_id,saleHash:r.sale_hash,itemId:r.item_id,sellerAccount:r.seller_account,sellerCharacter:r.seller_character,buyerAccount:r.buyer_account,buyerCharacter:r.buyer_character,refundCash:Number(r.refund_cash),conditionFloor:Number(r.condition_floor),expiresAt:new Date(r.expires_at).toISOString()};
  if(hash(source)!==r.source_hash||Number(r.refund_cash)!==Number(r.escrow_cash)+Number(r.paid_cash)+Number(r.refunded_cash))issues.push({id:r.id,reason:'rights_book'});
  try{const s=await merchantReturnSaleWitness(c,r.sale_id,false);if(r.sale_hash!==s.row.source_hash||r.item_id!==s.row.item_id||r.seller_account!==s.row.owner_account||r.seller_character!==s.row.owner_character||r.buyer_account!==s.buyerAccount||r.buyer_character!==s.row.buyer_character||Number(r.condition_floor)!==Number(s.row.settlement.condition)||Number(r.refund_cash)>s.net)throw Error('tuple');}catch{issues.push({id:r.id,reason:'sale_witness'});}
  const legs=journals.filter(j=>j.counterparty===r.id),reserve=legs.filter(j=>j.reason==='merchant_return:reserve'),payout=legs.filter(j=>j.reason==='merchant_return:payout'),refund=legs.filter(j=>j.reason==='merchant_return:refund');
  const bind=(j,actor,account,amount)=>j?.character_id===actor&&j.account_id===account&&j.currency==='cash'&&Number(j.amount)===amount;
  if(reserve.length!==1||reserve[0].id!==r.reserve_journal||!bind(reserve[0],r.seller_character,r.seller_account,-Number(r.refund_cash)))issues.push({id:r.id,reason:'reserve_witness'});
  if(payout.length!==(r.state==='returned'?1:0)||payout.some(j=>!bind(j,r.buyer_character,r.buyer_account,Number(r.paid_cash))||j.id!==r.settlement?.payoutJournal))issues.push({id:r.id,reason:'payout_witness'});
  if(refund.length!==(Number(r.refunded_cash)>0?1:0)||refund.some(j=>!bind(j,r.seller_character,r.seller_account,Number(r.refunded_cash))||j.id!==r.settlement?.refundJournal))issues.push({id:r.id,reason:'refund_witness'});
  if(['accepted','returned','waived'].includes(r.state)&&!r.accepted_at)issues.push({id:r.id,reason:'acceptance'});
  if(r.state==='returned'){
   const q=requests.filter(q=>q.return_ref===r.id&&q.request_json?.action==='return');if(q.length!==1||q[0].account_id!==r.buyer_account||stable(q[0].receipt)!==stable(r.settlement))issues.push({id:r.id,reason:'completion'});
   const key=r.settlement?.transferKey,g=guards.find(g=>g.idempotency_key===key),ev=events.filter(e=>e.idempotency_key===key);if(key)used.add(key);
   const requestHash=crypto.createHash('sha256').update(JSON.stringify({kind:'transfer_item',owner:{scope:'account',id:r.buyer_account},request:{to:{scope:'account',id:r.seller_account},itemId:r.item_id,reason:'merchant contractual return'}})).digest('hex');
   let result;try{result=JSON.parse(g?.result_json);}catch{}
   if(result?.id!==r.item_id||result?.templateId!=='item:precision_lock_tool'||result?.owner?.scope!=='account'||result?.owner?.id!==r.seller_account||result?.state!=='active'||!g?.completed_at||g.mutation_kind!=='transfer_item'||g.owner_scope!=='account'||g.owner_id!==r.buyer_account||g.request_hash!==requestHash||ev.length!==1||ev[0].event_kind!=='transferred'||ev[0].provenance_kind!=='transferred'||ev[0].item_id!==r.item_id||ev[0].template_id!=='item:precision_lock_tool'||ev[0].from_owner_scope!=='account'||ev[0].from_owner_id!==r.buyer_account||ev[0].to_owner_scope!=='account'||ev[0].to_owner_id!==r.seller_account||ev[0].reason!=='merchant contractual return')issues.push({id:r.id,reason:'physical_return'});
  }
 }
 for(const j of journals)if(!rights.some(r=>r.id===j.counterparty))issues.push({id:j.id,reason:'orphan_journal'});
 for(const row of [...guards,...events])if(!used.has(row.idempotency_key))issues.push({id:row.idempotency_key,reason:'orphan_return'});
 return issues;
}
export async function merchantReturnCashInvariant(c){const actual=Number((await c.query('SELECT COALESCE(SUM(escrow_cash),0) AS cash FROM merchant_return_rights')).rows[0].cash),net=Number((await c.query("SELECT COALESCE(SUM(amount),0) AS cash FROM transactions WHERE reason IN ('merchant_return:reserve','merchant_return:payout','merchant_return:refund')")).rows[0].cash);return{name:'merchant return escrow',actual,expected:-net,delta:actual+net};}
