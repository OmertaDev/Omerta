import { bookingHash as hash, bookingStable as stable, productionBookingOutcome } from './productionbooking-sources.js';
import { assertProductionBookingAcceptedPair } from './productionbooking-guards.js';
import {productionBookingTerms,productionBookingOfferView,productionBookingRunView} from './productionbooking.js';

// Read-only, historical accounting. No current owner, live profile or source
// upgrade can grant execution authority or rewrite an original receipt here.
export async function productionBookingAccounting(c) {
  const issues=[], offers=(await c.query('SELECT * FROM production_booking_offers ORDER BY id')).rows;
  const runs=(await c.query('SELECT * FROM production_booking_runs ORDER BY id')).rows;
  const requests=(await c.query('SELECT * FROM production_booking_requests ORDER BY account_id,request_key')).rows;
  const positions=(await c.query('SELECT * FROM production_booking_positions ORDER BY booking_id,original_character')).rows;
  const journals=(await c.query("SELECT id,character_id,account_id,currency,amount,reason,counterparty FROM transactions WHERE reason LIKE 'production_booking:%' ORDER BY id")).rows;
  const bad=(id,reason)=>issues.push({id,reason});
  const byOffer=new Map(offers.map(o=>[o.id,o])), byRun=new Map(runs.map(r=>[r.id,r]));
  for(const o of offers){
    const s=o.source_json;
    if(!s||hash(s)!==o.source_hash||s.kind!=='production-booking-offer-v1'||s.nonce!==o.id||s.consent!==true
      ||s.makerAccount!==o.maker_account||s.customerAccount!==o.customer_account||s.makerCharacter!==o.maker_character
      ||s.customerCharacter!==o.customer_character||s.businessId!==o.business_id||s.resources?.equipment?.itemId!==o.tool_item
      ||s.recipeId!=='recipe:precision_lock_tool'||s.quantity!==1||s.feeCash!==Number(o.fee_cash)||s.bonusCash!==Number(o.bonus_cash)
      ||s.lifetimeSeconds!==Number(o.lifetime_seconds)||s.makerAccount===s.customerAccount||s.makerCharacter===s.customerCharacter
      ||+new Date(s.createdAt)!==+new Date(o.created_at)||+new Date(s.expiresAt)!==+new Date(o.expires_at)
      ||+new Date(s.offerExpiresAt)!==+new Date(o.offer_expires_at))bad(o.id,'offer_source');
    const ack=requests.filter(q=>q.action==='offer'&&q.receipt?.offer?.bookingId===o.id&&q.account_id===o.maker_account);
    if(ack.length!==1||ack[0].receipt.offer.sourceHash!==o.source_hash)bad(o.id,'maker_consent');
    if((o.state==='accepted')!==byRun.has(o.id))bad(o.id,'accepted_root');
  }
  for(const r of runs){
    const o=byOffer.get(r.id), ps=positions.filter(p=>p.booking_id===r.id), js=journals.filter(j=>j.counterparty===r.id);
    if(!o){bad(r.id,'orphan_run');continue;}
    if(['business_id','maker_account','maker_character','customer_account','customer_character','tool_item'].some(k=>r[k]!==o[k])
      ||Number(r.bonus_cash)!==Number(o.bonus_cash)||Number(r.bonus_cash)!==Number(r.remaining_cash)+Number(r.paid_cash)+Number(r.refunded_cash))bad(r.id,'run_source');
    const accepted=requests.filter(q=>q.action==='accept'&&q.account_id===o.customer_account&&q.receipt?.booking?.bookingId===r.id);
    if(accepted.length!==1||accepted[0].identity.sourceHash!==o.source_hash||accepted[0].identity.feeCash!==Number(o.fee_cash)
      ||accepted[0].identity.bonusCash!==Number(o.bonus_cash))bad(r.id,'customer_consent');
    if(ps.length!==2||!ps.some(p=>p.role==='maker'&&p.original_account===o.maker_account&&p.original_character===o.maker_character)
      ||!ps.some(p=>p.role==='customer'&&p.original_account===o.customer_account&&p.original_character===o.customer_character)
      ||ps.some(p=>p.state!==(r.state==='active'?'held':'released')))bad(r.id,'positions');
    const reserve=js.filter(j=>j.reason==='production_booking:bonus_reserve'),released=js.filter(j=>j.reason!=='production_booking:bonus_reserve');
    if(reserve.length!==1||reserve[0].id!==r.reserve_transaction||reserve[0].character_id!==o.customer_character||reserve[0].account_id!==o.customer_account
      ||Number(reserve[0].amount)!==-Number(o.bonus_cash)||js.some(j=>j.currency!=='cash'))bad(r.id,'reserve');
    const commission=(await c.query('SELECT status,source_hash FROM commissioned_crafting_contracts WHERE id=$1',[r.commission_id])).rows[0];
    const slot=(await c.query('SELECT * FROM production_slot_reservations WHERE id=$1',[r.reservation_id])).rows[0];
    if(!commission||commission.source_hash!==r.commission_source_hash||!slot||slot.source_hash!==r.reservation_source_hash
      ||slot.commission_id!==r.commission_id)bad(r.id,'canonical_sources');
    if(r.state==='active'){
      try{await assertProductionBookingAcceptedPair(c,r);}catch{bad(r.id,'accepted_pair');}
      if(Number(r.remaining_cash)!==Number(r.bonus_cash)||Number(r.paid_cash)||Number(r.refunded_cash)||released.length||r.release_transaction||r.outcome
        ||slot?.status!=='active'||+new Date(r.deadline)>+new Date(o.expires_at)||+new Date(r.accepted_at)>=+new Date(r.deadline))bad(r.id,'active_budget');
    }else{
      const completed=r.state==='completed',expected=completed?'production_booking:bonus':'production_booking:bonus_refund';
      if(!['completed','refunded'].includes(r.state)||Number(r.remaining_cash)||released.length!==1||released[0]?.id!==r.release_transaction
        ||released[0]?.reason!==expected||Number(released[0]?.amount)!==Number(r.bonus_cash)
        ||released[0]?.character_id!==(completed?o.maker_character:o.customer_character)
        ||released[0]?.account_id!==(completed?o.maker_account:o.customer_account)
        ||Number(r.paid_cash)!==(completed?Number(r.bonus_cash):0)||Number(r.refunded_cash)!==(completed?0:Number(r.bonus_cash)))bad(r.id,'terminal_budget');
      try{const expectedOutcome=await productionBookingOutcome(c,o,r,r.state),actual=r.outcome;
        const {sourceHash,...source}=actual||{};
        if(sourceHash!==hash(source)||stable(source)!==stable({...expectedOutcome,closedAt:new Date(r.closed_at).toISOString(),releaseTransaction:r.release_transaction}))bad(r.id,'outcome');
      }catch{bad(r.id,'outcome');}
      if(slot?.status!==(completed?'consumed':'void'))bad(r.id,'slot_terminal');
    }
  }
  for(const q of requests){
    try{
      const terms=productionBookingTerms(q.action,q.identity);if(stable(terms)!==stable(q.identity)||q.request_hash!==hash([q.action,terms]))throw Error('terms');
      const bookingId=q.action==='offer'?q.receipt?.offer?.bookingId:terms.bookingId,o=byOffer.get(bookingId),r=byRun.get(bookingId);if(!o)throw Error('offer');
      let expected;
      if(q.action==='offer'){
        if(q.account_id!==o.maker_account||stable(terms)!==stable({businessId:o.business_id,customerCharacterId:o.customer_character,feeCash:Number(o.fee_cash),bonusCash:Number(o.bonus_cash),lifetimeSeconds:Number(o.lifetime_seconds),consent:true}))throw Error('original');
        expected={offer:productionBookingOfferView({...o,state:'offered'})};
      }else{
        if(terms.sourceHash!==o.source_hash||![o.maker_account,o.customer_account].includes(q.account_id))throw Error('original');
        if(q.action==='accept'){
          if(!r||q.account_id!==o.customer_account)throw Error('accept');
          expected={offer:productionBookingOfferView({...o,state:'accepted'}),booking:productionBookingRunView({...r,state:'active',remaining_cash:r.bonus_cash,paid_cash:0,refunded_cash:0,closed_at:null})};
        }else if(q.action==='complete'){
          if(r?.state!=='completed'||q.account_id!==o.maker_account)throw Error('complete');
          expected={booking:productionBookingRunView(r),outputItemId:r.outcome.outputItemId,paidFee:Number(o.fee_cash),paidBonusCash:Number(r.bonus_cash)};
        }else if(r){if(r.state!=='refunded')throw Error('terminal');expected={booking:productionBookingRunView(r),refundedBonusCash:Number(r.bonus_cash)};}
        else {if(q.account_id!==o.maker_account)throw Error('maker');expected={offer:productionBookingOfferView({...o,state:q.action==='expire'?'expired':'cancelled'}),refundedBonusCash:0};}
      }
      if(stable(expected)!==stable(q.receipt))throw Error('receipt');
    }catch{bad(q.request_key,'request');}
  }
  for(const j of journals)if(!byRun.has(j.counterparty)||!['production_booking:bonus_reserve','production_booking:bonus','production_booking:bonus_refund'].includes(j.reason)||j.currency!=='cash')bad(j.id,'journal_source');
  for(const p of positions)if(!byRun.has(p.booking_id))bad(p.booking_id,'position_source');
  const C=await import('./commissionedcrafting.js'),R=await import('./productionslots.js');
  for(const x of await C.collectCommissionedCraftingIssues(c))bad(x.id,'commission:'+x.reason);
  for(const x of await R.collectProductionSlotIssues(c))bad(x.id,'slot:'+x.reason);
  return{issues,reservedCash:runs.reduce((n,r)=>n+Number(r.remaining_cash),0),paidCash:runs.reduce((n,r)=>n+Number(r.paid_cash),0),refundedCash:runs.reduce((n,r)=>n+Number(r.refunded_cash),0)};
}
export async function collectProductionBookingIssues(c){return(await productionBookingAccounting(c)).issues;}
