import crypto from 'node:crypto';
import { ledger } from './game.js';
import { assertItemTransaction, itemTransactionIdentity, registerItemTransactionUndo, poisonItemTransaction } from './items.js';
import { PRODUCTION_BOOKING, productionBookingDDL } from './productionbooking-contracts.js';
import { bookingStable as stable, bookingHash as hash, bookingFailure as fail, bookingISO as iso,
  productionBookingResources, verifyProductionBookingResources, productionBookingOutcome } from './productionbooking-sources.js';
export { PRODUCTION_BOOKING, productionBookingDDL };
const scopes = new WeakMap(), witnesses = new WeakMap();
const id = x => { if (typeof x !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(x)) fail('identity'); return x; };
const keyOf = x => { if (typeof x !== 'string' || !x.length || x.length > 200) fail('request_key'); return x; };
const integer = (x, min, max) => { if (!Number.isSafeInteger(x) || x < min || x > max) fail('terms'); return x; };
const clock = async c => +new Date((await c.query('SELECT clock_timestamp() AS at')).rows[0].at);
const closed = (b, keys) => { if (!b || Array.isArray(b) || Object.keys(b).sort().join(',') !== keys) fail('terms'); };
export function productionBookingTerms(action, b) {
  if (action === 'offer') {
    closed(b, 'bonusCash,businessId,consent,customerCharacterId,feeCash,lifetimeSeconds');
    if (b.consent !== true) fail('consent');
    return { businessId: id(b.businessId), customerCharacterId: id(b.customerCharacterId), feeCash: integer(b.feeCash,1,1000),
      bonusCash: integer(b.bonusCash,1,1000), lifetimeSeconds: integer(b.lifetimeSeconds,60,1200), consent: true };
  }
  if (!['accept','complete','cancel','expire'].includes(action)) fail('action');
  closed(b, action === 'accept' ? 'bonusCash,bookingId,consent,feeCash,sourceHash' : 'bookingId,consent,sourceHash');
  if (b.consent !== true || typeof b.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(b.sourceHash)) fail('terms');
  return { bookingId: id(b.bookingId), sourceHash: b.sourceHash, consent: true,
    ...(action === 'accept' ? { feeCash: integer(b.feeCash,1,1000), bonusCash: integer(b.bonusCash,1,1000) } : {}) };
}
async function replay(c, account, action, body, key) {
  const r = (await c.query('SELECT * FROM production_booking_requests WHERE account_id=$1 AND request_key=$2',[account,key])).rows[0];
  if (!r) return null;
  if (r.action !== action || r.request_hash !== hash([action,body]) || stable(r.identity) !== stable(body)) fail('request_conflict');
  return { ...r.receipt, replayed: true };
}
async function saveRequest(c, account, action, body, key, receipt) {
  registerItemTransactionUndo(c,()=>c.query('DELETE FROM production_booking_requests WHERE account_id=$1 AND request_key=$2',[account,key]));
  await c.query('INSERT INTO production_booking_requests(account_id,request_key,action,identity,request_hash,receipt) VALUES($1,$2,$3,$4,$5,$6)',[account,key,action,body,hash([action,body]),receipt]);
  return receipt;
}
async function current(c, account) {
  const rows = (await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2',[account])).rows;
  if (rows.length !== 1) fail('original_actor'); return rows[0].id;
}
async function actors(c, ids, { caller = null, recovery = false } = {}) {
  const originals = [...new Set(ids.map(id))].sort(); if (originals.length !== 2) fail('original_limit');
  const rows = [];
  for (const ch of originals) { const r = (await c.query('SELECT id,account_id,alive,is_npc,cash FROM characters WHERE id=$1 FOR UPDATE',[ch])).rows[0];
    if (!r || r.is_npc || (!recovery && !r.alive)) fail('original_actor'); rows.push(r); }
  const accounts = [...new Set(rows.map(r=>r.account_id))].sort(); if (accounts.length !== 2) fail('self_booking');
  for (const account of accounts) {
    const a = (await c.query('SELECT id,status FROM accounts WHERE id=$1 FOR UPDATE',[account])).rows[0];
    if (!a || ((!recovery || account === caller) && a.status !== 'active')) fail('original_actor');
    if (!recovery || account === caller) if (await current(c,account) !== rows.find(r=>r.account_id===account).id) fail('original_actor');
  }
  return rows;
}
async function cash(c, ch, amount, reason, bookingId) {
  const old = (await c.query('SELECT account_id,alive,cash FROM characters WHERE id=$1',[ch])).rows[0], next = Number(old?.cash)+amount;
  if (!old?.alive || !Number.isSafeInteger(next) || next < 0) fail('capital');
  registerItemTransactionUndo(c,()=>c.query('UPDATE characters SET cash=$2 WHERE id=$1',[ch,old.cash]));
  const tx = await ledger(c,{characterId:ch,accountId:old.account_id,currency:'cash',amount,reason,counterparty:bookingId},
    {beforeInsert:tx=>registerItemTransactionUndo(c,()=>c.query('DELETE FROM transactions WHERE id=$1',[tx]))});
  await c.query('UPDATE characters SET cash=$2 WHERE id=$1',[ch,next]); return tx;
}
async function offer(c, bookingId) {
  const r = (await c.query('SELECT * FROM production_booking_offers WHERE id=$1 FOR UPDATE',[id(bookingId)])).rows[0];
  if (!r || hash(r.source_json) !== r.source_hash) fail('source_changed'); return r;
}
async function run(c, bookingId) { return (await c.query('SELECT * FROM production_booking_runs WHERE id=$1 FOR UPDATE',[bookingId])).rows[0]; }
async function ownPair(c, account, t, recovery = false) {
  const hint = (await c.query('SELECT maker_account,maker_character,customer_account,customer_character FROM production_booking_offers WHERE id=$1',[t.bookingId])).rows[0];
  if (!hint || ![hint.maker_account,hint.customer_account].includes(account)) fail('booking_private');
  const people = await actors(c,[hint.maker_character,hint.customer_character],{caller:account,recovery}), row = await offer(c,t.bookingId);
  if (row.source_hash !== t.sourceHash || people.find(x=>x.id===row.maker_character)?.account_id !== row.maker_account
    || people.find(x=>x.id===row.customer_character)?.account_id !== row.customer_account) fail('source_changed');
  return { row, people };
}
async function positionCapacity(c, original) {
  if ((await c.query("SELECT booking_id FROM production_booking_positions WHERE original_character=$1 AND state='held'",[original])).rows.length) fail('original_booking_limit');
}
async function positions(c, row) {
  for (const [role, account, ch] of [['maker',row.maker_account,row.maker_character],['customer',row.customer_account,row.customer_character]]) {
    await positionCapacity(c,ch); registerItemTransactionUndo(c,()=>c.query('DELETE FROM production_booking_positions WHERE booking_id=$1 AND original_character=$2',[row.id,ch]));
    await c.query("INSERT INTO production_booking_positions(booking_id,original_account,original_character,role,state) VALUES($1,$2,$3,$4,'held')",[row.id,account,ch,role]);
  }
}
export function productionBookingOfferView(r) { return { bookingId:r.id,sourceHash:r.source_hash,state:r.state,businessId:r.business_id,
  makerCharacterId:r.maker_character,customerCharacterId:r.customer_character,toolItemId:r.tool_item,feeCash:Number(r.fee_cash),bonusCash:Number(r.bonus_cash),
  profileRevision:Number(r.source_json.resources.profile.revision),floorRevision:Number(r.source_json.resources.floor.revision),
  toolCondition:Number(r.source_json.resources.equipment.remaining),toolRevision:Number(r.source_json.resources.equipment.revision),
  offerExpiresAt:iso(r.offer_expires_at),expiresAt:iso(r.expires_at),resourcesHeld:false,recipeId:PRODUCTION_BOOKING.recipeId,quantity:1 }; }
export function productionBookingRunView(r) { return { bookingId:r.id,state:r.state,businessId:r.business_id,commissionId:r.commission_id,reservationId:r.reservation_id,
  toolItemId:r.tool_item,bonusCash:Number(r.bonus_cash),reservedBonusCash:Number(r.remaining_cash),paidBonusCash:Number(r.paid_cash),refundedBonusCash:Number(r.refunded_cash),
  acceptedAt:iso(r.accepted_at),deadline:iso(r.deadline),closedAt:r.closed_at?iso(r.closed_at):null,resourcesHeld:r.state==='active' }; }
async function books(c) {
  const { productionBookingAccounting } = await import('./productionbooking-invariants.js'), result = await productionBookingAccounting(c);
  if (result.issues.length) throw Object.assign(new Error('booking_history',{cause:result.issues}),{code:'production_booking',reason:'booking_history'});
}
async function perform(c, account, action, body, key, execute) {
  assertItemTransaction(c);
  try {
    id(account);keyOf(key);const t=productionBookingTerms(action,body),prior=await replay(c,account,action,t,key);if(prior)return prior;
    const result=await execute(t);if(result.replayed)return result.receipt;
    const receipt=await saveRequest(c,account,action,t,key,result.receipt);await books(c);if(result.check)await result.check();return receipt;
  }catch(error){poisonItemTransaction(c,error);throw error;}
}
export async function offerProductionBooking(c, account, body, key) {
  return perform(c,account,'offer',body,key,async t=>{
    const original=await current(c,account);if(original===t.customerCharacterId)fail('self_booking');
    const people=await actors(c,[original,t.customerCharacterId],{caller:account}),customer=people.find(x=>x.id===t.customerCharacterId);
    const old=await replay(c,account,'offer',t,key);if(old)return{receipt:old,replayed:true};
    if ((await c.query("SELECT id FROM production_booking_offers WHERE maker_character=$1 AND state='offered'",[original])).rows.length) fail('offer_limit');
    await positionCapacity(c,original);
    const resources=await productionBookingResources(c,account,original,t.businessId),now=await clock(c),bookingId=crypto.randomUUID();
    const source={kind:'production-booking-offer-v1',nonce:bookingId,makerAccount:account,makerCharacter:original,customerAccount:customer.account_id,
      customerCharacter:customer.id,businessId:t.businessId,recipeId:PRODUCTION_BOOKING.recipeId,quantity:1,feeCash:t.feeCash,bonusCash:t.bonusCash,
      lifetimeSeconds:t.lifetimeSeconds,createdAt:iso(now),offerExpiresAt:iso(now+Math.min(300,t.lifetimeSeconds)*1000),expiresAt:iso(now+t.lifetimeSeconds*1000),resources,consent:true};
    const r={id:bookingId,maker_account:account,maker_character:original,customer_account:customer.account_id,customer_character:customer.id,business_id:t.businessId,
      tool_item:resources.equipment.itemId,source_json:source,source_hash:hash(source),created_at:new Date(now),offer_expires_at:new Date(source.offerExpiresAt),expires_at:new Date(source.expiresAt),
      fee_cash:t.feeCash,bonus_cash:t.bonusCash,lifetime_seconds:t.lifetimeSeconds,state:'offered'};
    registerItemTransactionUndo(c,()=>c.query('DELETE FROM production_booking_offers WHERE id=$1',[r.id]));
    await c.query("INSERT INTO production_booking_offers(id,maker_account,maker_character,customer_account,customer_character,business_id,tool_item,source_json,source_hash,created_at,offer_expires_at,expires_at,fee_cash,bonus_cash,lifetime_seconds,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'offered')",
      [r.id,account,original,customer.account_id,customer.id,r.business_id,r.tool_item,source,r.source_hash,r.created_at,r.offer_expires_at,r.expires_at,r.fee_cash,r.bonus_cash,r.lifetime_seconds]);
    return{receipt:{offer:productionBookingOfferView(r)},check:async()=>{if(await clock(c)>=+r.offer_expires_at)fail('expired');await verifyProductionBookingResources(c,r,await clock(c));}};
  });
}
function scoped(c) { const s=scopes.get(c);if(!s?.active||s.transaction!==itemTransactionIdentity(c))fail('private_booking_scope');return s; }
export async function assertProductionBookingQualityCommission(c,businessId,maker) {
  assertItemTransaction(c);if(!scopes.has(c))return false;const s=scoped(c);
  if(s.row.business_id!==businessId||s.row.maker_character!==maker.id||s.row.maker_account!==maker.account_id||!['fund','accept','slot','confirm','complete'].includes(s.phase))fail('quality_source');
  await verifyProductionBookingResources(c,s.row,await clock(c));return true;
}
export async function assertProductionBookingQualitySlot(c,businessId,maker) { return assertProductionBookingQualityCommission(c,businessId,maker); }
export async function assertProductionBookingBeforeCraft(c,ctx) {
  assertItemTransaction(c);
  const r=(await c.query("SELECT * FROM production_booking_runs WHERE business_id=$1 AND state='active'",[ctx.businessId])).rows[0];if(!r)return;
  const s=scoped(c);if(s.phase!=='complete'||s.booking?.id!==r.id||s.row.maker_account!==ctx.accountId||s.row.maker_character!==ctx.originalCharacter
    ||ctx.recipeId!==PRODUCTION_BOOKING.recipeId||ctx.totalCrafts!==1||ctx.ordinal!==0||ctx.totalCashCost!==0
    ||ctx.requestKey!=='commission:'+r.commission_id+':production')fail('production_reserved');
}
export async function acceptProductionBooking(c,account,body,key) {
  return perform(c,account,'accept',body,key,async t=>{
    const{row}=await ownPair(c,account,t);const old=await replay(c,account,'accept',t,key);if(old)return{receipt:old,replayed:true};
    if(row.state!=='offered'||row.customer_account!==account||t.feeCash!==Number(row.fee_cash)||t.bonusCash!==Number(row.bonus_cash)||await clock(c)>=+new Date(row.offer_expires_at))fail('accept_terms');
    await positionCapacity(c,row.maker_character);await positionCapacity(c,row.customer_character);await verifyProductionBookingResources(c,row,await clock(c));
    const s={active:true,transaction:itemTransactionIdentity(c),row,phase:'fund'};scopes.set(c,s);
    try{
      const C=await import('./commissionedcrafting.js'),R=await import('./productionslots.js');
      const reserve=await cash(c,row.customer_character,-Number(row.bonus_cash),'production_booking:bonus_reserve',row.id);
      const commission=await C.fundCommission(c,account,{businessId:row.business_id,feeCash:Number(row.fee_cash),lifetimeSeconds:Number(row.lifetime_seconds),consent:true},'booking:'+row.id+':fund');
      s.phase='accept';await C.acceptCommission(c,row.maker_account,{commissionId:commission.commissionId,sourceHash:commission.sourceHash,consent:true},'booking:'+row.id+':accept');
      s.phase='slot';const reservation=await R.productionSlotAction(c,row.maker_account,'offer',{commissionId:commission.commissionId,commissionSourceHash:commission.sourceHash,expectedProfileRevision:Number(row.source_json.resources.profile.revision),consent:true},'booking:'+row.id+':slot');
      s.phase='confirm';await R.productionSlotAction(c,account,'confirm',{reservationId:reservation.reservationId,sourceHash:reservation.sourceHash,consent:true},'booking:'+row.id+':confirm');
      const now=await clock(c),deadline=Math.min(+new Date(row.expires_at),Date.parse(reservation.deadline));if(now>=deadline||Date.parse(reservation.readyAt)>=deadline)fail('no_usable_interval');
      registerItemTransactionUndo(c,()=>c.query('DELETE FROM production_booking_runs WHERE id=$1',[row.id]));
      await c.query("INSERT INTO production_booking_runs(id,business_id,maker_account,maker_character,customer_account,customer_character,tool_item,commission_id,commission_source_hash,reservation_id,reservation_source_hash,state,bonus_cash,remaining_cash,reserve_transaction,accepted_at,deadline) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12,$12,$13,$14,$15)",
        [row.id,row.business_id,row.maker_account,row.maker_character,row.customer_account,row.customer_character,row.tool_item,commission.commissionId,commission.sourceHash,reservation.reservationId,reservation.sourceHash,row.bonus_cash,reserve,new Date(now),new Date(deadline)]);
      await positions(c,row);registerItemTransactionUndo(c,()=>c.query("UPDATE production_booking_offers SET state='offered' WHERE id=$1",[row.id]));await c.query("UPDATE production_booking_offers SET state='accepted' WHERE id=$1",[row.id]);
      const active=await run(c,row.id);return{receipt:{offer:productionBookingOfferView({...row,state:'accepted'}),booking:productionBookingRunView(active)},check:async()=>{if(await clock(c)>=deadline)fail('expired');await verifyProductionBookingResources(c,row,await clock(c));}};
    }finally{s.active=false;scopes.delete(c);}
  });
}
async function finish(c,r,state,transaction,outcome) {
  const at=new Date(await clock(c)),source={...outcome,closedAt:iso(at),releaseTransaction:transaction};
  registerItemTransactionUndo(c,()=>c.query('UPDATE production_booking_runs SET state=$2,remaining_cash=$3,paid_cash=$4,refunded_cash=$5,release_transaction=$6,closed_at=$7,outcome=$8 WHERE id=$1',
    [r.id,r.state,r.remaining_cash,r.paid_cash,r.refunded_cash,r.release_transaction,r.closed_at,r.outcome]));
  await c.query('UPDATE production_booking_runs SET state=$2,remaining_cash=0,paid_cash=$3,refunded_cash=$4,release_transaction=$5,closed_at=$6,outcome=$7 WHERE id=$1',
    [r.id,state,state==='completed'?r.bonus_cash:0,state==='refunded'?r.bonus_cash:0,transaction,at,{...source,sourceHash:hash(source)}]);
  const held=(await c.query('SELECT * FROM production_booking_positions WHERE booking_id=$1 ORDER BY original_character',[r.id])).rows;
  if(held.length!==2||held.some(x=>x.state!=='held'))fail('positions');
  registerItemTransactionUndo(c,()=>c.query("UPDATE production_booking_positions SET state='held' WHERE booking_id=$1",[r.id]));
  if((await c.query("UPDATE production_booking_positions SET state='released' WHERE booking_id=$1",[r.id])).rowCount!==2)fail('positions');
}
export async function recordProductionBookingCompletion(c,commissionId,token) {
  assertItemTransaction(c);const active=(await c.query("SELECT id FROM production_booking_runs WHERE commission_id=$1 AND state='active'",[commissionId])).rows[0];if(!active)return null;
  const s=scoped(c);if(s.phase!=='complete'||s.booking.commission_id!==commissionId||s.row.id!==active.id)fail('completion_scope');
  const C=await import('./commissionedcrafting.js');await C.assertCommissionCompletionScope(c,commissionId,token);
  if(await clock(c)>=+new Date(s.booking.deadline))fail('expired');
  const outcome=await productionBookingOutcome(c,s.row,s.booking,'completed');
  const item=(await c.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[outcome.outputItemId])).rows[0];
  if(item?.owner_scope!=='account'||item.owner_id!==s.row.customer_account||item.state!=='active')fail('actual_handover');
  witnesses.set(c,{transaction:itemTransactionIdentity(c),bookingId:s.row.id,outcome});return true;
}
export async function completeProductionBooking(c,account,body,key,options={agentCredential:false}) {
  if(!options||Object.keys(options).join(',')!=='agentCredential'||typeof options.agentCredential!=='boolean')fail('credential');
  const {agentCredential}=options;
  return perform(c,account,'complete',body,key,async t=>{
    const{row}=await ownPair(c,account,t),r=await run(c,row.id);const old=await replay(c,account,'complete',t,key);if(old)return{receipt:old,replayed:true};
    if(account!==row.maker_account||r?.state!=='active')fail('maker');if(await clock(c)>=+new Date(r.deadline))fail('expired');await verifyProductionBookingResources(c,row,await clock(c));
    const s={active:true,transaction:itemTransactionIdentity(c),row,booking:r,phase:'complete'};scopes.set(c,s);
    try{
      const C=await import('./commissionedcrafting.js');const result=await C.completeCommission(c,account,{commissionId:r.commission_id,sourceHash:r.commission_source_hash,consent:true},'booking:'+r.id+':complete',{agentCredential});
      const proof=witnesses.get(c);if(!proof||proof.transaction!==itemTransactionIdentity(c)||proof.bookingId!==r.id)fail('completion_witness');
      const actual=await productionBookingOutcome(c,row,r,'completed');if(stable(proof.outcome)!==stable(actual))fail('completion_witness');
      const payout=await cash(c,row.maker_character,Number(r.bonus_cash),'production_booking:bonus',r.id);await finish(c,r,'completed',payout,actual);
      return{receipt:{booking:productionBookingRunView(await run(c,r.id)),outputItemId:result.outputItemId,paidFee:Number(result.paidFee),paidBonusCash:Number(r.bonus_cash)},check:async()=>{if(await clock(c)>=+new Date(r.deadline))fail('expired');}};
    }finally{s.active=false;scopes.delete(c);witnesses.delete(c);}
  });
}

// Called only by N03's literal private refund leaf, including its genuine estate bridge.
export async function retireProductionBookingForCommission(c,commissionId,token,customer) {
  assertItemTransaction(c);
  try{
    const hint=(await c.query("SELECT id FROM production_booking_runs WHERE commission_id=$1 AND state='active'",[commissionId])).rows[0];if(!hint)return{refundedBonusCash:0};
    const C=await import('./commissionedcrafting.js');if(typeof C.assertCommissionRefundScope!=='function')fail('integration_required');await C.assertCommissionRefundScope(c,commissionId,token);
    const row=await offer(c,hint.id),r=await run(c,hint.id);
    if(customer?.id!==row.customer_character||customer.account_id!==row.customer_account||!customer.alive||r.state!=='active')fail('refund_original');
    const outcome=await productionBookingOutcome(c,row,r,'refunded'),refund=await cash(c,row.customer_character,Number(r.bonus_cash),'production_booking:bonus_refund',r.id);
    const old=Number(customer.cash);registerItemTransactionUndo(c,()=>{customer.cash=old;});customer.cash=old+Number(r.bonus_cash);
    await finish(c,r,'refunded',refund,outcome);return{refundedBonusCash:Number(r.bonus_cash)};
  }catch(error){poisonItemTransaction(c,error);throw error;}
}
// Fixed N09 terminal bridge: existing original-party release/expiry consent
// closes the real commission, bonus and all holds in the same transaction.
export async function retireProductionBookingForSlot(c,account,action,terms,key) {
  assertItemTransaction(c);if(!['release','expire'].includes(action))return false;
  const hint=(await c.query("SELECT id FROM production_booking_runs WHERE reservation_id=$1 AND state='active'",[terms.reservationId])).rows[0];if(!hint)return false;
  try{
    const row=await offer(c,hint.id);await actors(c,[row.maker_character,row.customer_character],{caller:account,recovery:true});
    if(![row.maker_account,row.customer_account].includes(account))fail('booking_private');
    const r=await run(c,row.id),slot=(await c.query('SELECT * FROM production_slot_reservations WHERE id=$1 FOR UPDATE',[terms.reservationId])).rows[0];
    if(r.state!=='active'||slot?.status!=='active'||slot.source_hash!==terms.sourceHash||r.reservation_source_hash!==terms.sourceHash)fail('source_changed');
    if(action==='expire'&&await clock(c)<+new Date(slot.deadline))fail('deadline');
    const C=await import('./commissionedcrafting.js');await C.refundCommission(c,account,{commissionId:r.commission_id,sourceHash:r.commission_source_hash,consent:true},'booking-slot:'+hash([r.id,action,key]));
    if((await run(c,r.id)).state!=='refunded')fail('terminal_bridge_required');return true;
  }catch(error){poisonItemTransaction(c,error);throw error;}
}
async function endAction(c,account,action,body,key) {
  return perform(c,account,action,body,key,async t=>{
    const hint=(await c.query('SELECT * FROM production_booking_offers WHERE id=$1',[t.bookingId])).rows[0];if(!hint||![hint.maker_account,hint.customer_account].includes(account))fail('booking_private');
    if(hint.state==='offered'){
      const original=await current(c,account);if(original!==hint.maker_character||account!==hint.maker_account)fail('maker');
      const actor=(await c.query('SELECT id,alive FROM characters WHERE id=$1 FOR UPDATE',[original])).rows[0];
      const owner=(await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[account])).rows[0];
      if(!actor?.alive||owner?.status!=='active'||await current(c,account)!==original)fail('original_actor');
      const old=await replay(c,account,action,t,key);if(old)return{receipt:old,replayed:true};
      const row=await offer(c,t.bookingId);if(row.source_hash!==t.sourceHash)fail('source_changed');if(row.state!=='offered')fail('booking_state');
      if(action==='expire'&&await clock(c)<+new Date(row.offer_expires_at))fail('deadline');
      const at=new Date(await clock(c));registerItemTransactionUndo(c,()=>c.query('UPDATE production_booking_offers SET state=$2,closed_at=$3 WHERE id=$1',[row.id,row.state,row.closed_at]));
      await c.query('UPDATE production_booking_offers SET state=$2,closed_at=$3 WHERE id=$1',[row.id,action==='expire'?'expired':'cancelled',at]);
      return{receipt:{offer:productionBookingOfferView({...row,state:action==='expire'?'expired':'cancelled'}),refundedBonusCash:0}};
    }
    const{row}=await ownPair(c,account,t,true),r=await run(c,row.id);const old=await replay(c,account,action,t,key);if(old)return{receipt:old,replayed:true};
    if(r?.state!=='active')fail('booking_state');if(action==='expire'&&await clock(c)<+new Date(r.deadline))fail('deadline');
    const C=await import('./commissionedcrafting.js');await C.refundCommission(c,account,{commissionId:r.commission_id,sourceHash:r.commission_source_hash,consent:true},'booking:'+r.id+':'+action);
    const ended=await run(c,r.id);if(ended.state!=='refunded'||Number(ended.remaining_cash))fail('terminal_bridge_required');
    return{receipt:{booking:productionBookingRunView(ended),refundedBonusCash:Number(r.bonus_cash)}};
  });
}
export const cancelProductionBooking=(c,a,b,k)=>endAction(c,a,'cancel',b,k);
export const expireProductionBooking=(c,a,b,k)=>endAction(c,a,'expire',b,k);
export async function productionBookingBoard(c,account) {
  id(account);const offers=(await c.query('SELECT * FROM production_booking_offers WHERE maker_account=$1 OR customer_account=$1 ORDER BY created_at DESC,id LIMIT 50',[account])).rows;
  const bookings=(await c.query('SELECT * FROM production_booking_runs WHERE maker_account=$1 OR customer_account=$1 ORDER BY accepted_at DESC,id LIMIT 50',[account])).rows;
  return{offers:offers.map(productionBookingOfferView),bookings:bookings.map(productionBookingRunView),recipeId:PRODUCTION_BOOKING.recipeId,quantity:1};
}
