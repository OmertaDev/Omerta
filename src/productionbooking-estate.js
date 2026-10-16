import { assertItemTransaction, registerItemTransactionUndo, poisonItemTransaction } from './items.js';
import { assertEstateResolutionScope } from './social/estate.js';
import { assertEquipmentRentalDeathScope } from './equipmentrentals.js';
import { bookingFailure as fail } from './productionbooking-sources.js';
import { assertProductionBookingAcceptedPair } from './productionbooking-guards.js';

// Runs before the canonical estate cash snapshot. Both originals are already
// covered by the genuine accepted-commission prelock; this adds no peer lock.
export async function recoverProductionBookingsAtEstateStart(c,victim,h,opts={}) {
  assertItemTransaction(c);
  try{
    const estate=await assertEstateResolutionScope(c,victim.id,h.estateResolutionScope);
    const locked=await assertEquipmentRentalDeathScope(c,victim.id,h.rentalDeathScope);
    if(estate.accountId!==victim.account_id)fail('estate_original');
    const rows=(await c.query("SELECT * FROM production_booking_runs WHERE state='active' AND (maker_character=$1 OR customer_character=$1) ORDER BY id LIMIT 2 FOR UPDATE",[victim.id])).rows;
    if(rows.length>1)fail('estate_limit');
    const C=await import('./commissionedcrafting.js');
    for(const r of rows){
      await assertProductionBookingAcceptedPair(c,r);
      if(!locked.ids.has(r.maker_character)||!locked.ids.has(r.customer_character))fail('estate_prelock');
      const before=Number((await c.query('SELECT cash FROM characters WHERE id=$1',[r.customer_character])).rows[0].cash);
      if(typeof C.refundProductionBookingCommissionInEstate!=='function')fail('integration_required');
      await C.refundProductionBookingCommissionInEstate(c,r.commission_id,victim.id,h.rentalDeathScope,h.estateResolutionScope);
      const after=Number((await c.query('SELECT cash FROM characters WHERE id=$1',[r.customer_character])).rows[0].cash);
      const closed=(await c.query('SELECT state,remaining_cash,refunded_cash FROM production_booking_runs WHERE id=$1',[r.id])).rows[0];
      const original=(await c.query('SELECT fee_total FROM commissioned_crafting_contracts WHERE id=$1',[r.commission_id])).rows[0];
      if(closed?.state!=='refunded'||Number(closed.remaining_cash)||Number(closed.refunded_cash)!==Number(r.bonus_cash)
        ||after-before!==Number(original.fee_total)+Number(r.bonus_cash))fail('estate_refund');
      for(const actor of new Set([victim,h.actorCh,opts.killerCh].filter(Boolean))){
        if(actor.id!==r.customer_character||!actor.alive)continue;
        const prior=Number(actor.cash);registerItemTransactionUndo(c,()=>{actor.cash=prior;});actor.cash=prior+after-before;
      }
    }
    if((await c.query("SELECT id FROM production_booking_runs WHERE state='active' AND (maker_character=$1 OR customer_character=$1)",[victim.id])).rows.length)fail('estate_unresolved');
    return{retired:rows.length};
  }catch(error){poisonItemTransaction(c,error);throw error;}
}
