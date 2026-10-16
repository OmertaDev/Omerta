import { bookingFailure as fail } from './productionbooking-sources.js';

// These fixed read-only predicates grant no capability and acquire no late peer
// actor lock. Mutation callers retain their existing canonical owner/item locks.
async function held(c, column, value) {
  const allowed = new Set(['tool_item','business_id','maker_account']);
  if (!allowed.has(column)) fail('guard_context');
  return (await c.query(`SELECT id,commission_id,maker_character,customer_character FROM production_booking_runs WHERE ${column}=$1 AND state='active' ORDER BY id LIMIT 2`,[value])).rows;
}
export async function assertProductionBookingItemMutable(c, itemId) {
  if ((await held(c,'tool_item',itemId)).length) fail('tool_reserved'); return true;
}
export async function assertProductionBookingBusinessMutable(c, businessId) {
  if ((await held(c,'business_id',businessId)).length) fail('workshop_reserved'); return true;
}
export async function assertProductionBookingSlotMutable(c,reservationId) {
  if((await c.query("SELECT id FROM production_booking_runs WHERE reservation_id=$1 AND state='active'",[reservationId])).rows.length)fail('slot_reserved');return true;
}
export async function assertProductionBookingPremisesMutable(c, account, before, after) {
  const key = row => [row?.premises_kind??null,row?.premises_key??null,row?.premises_district??null];
  if (JSON.stringify(key(before)) !== JSON.stringify(key(after)) && (await held(c,'maker_account',account)).length) fail('premises_reserved');
  return true;
}
export async function assertProductionBookingPremisesTitleMutable(c, account) {
  if ((await held(c,'maker_account',account)).length) fail('premises_reserved'); return true;
}
export async function assertProductionBookingAcceptedPair(c, booking) {
  const row=(await c.query('SELECT status,maker_account,maker_character,customer_account,customer_character,business_id,source_hash FROM commissioned_crafting_contracts WHERE id=$1',[booking.commission_id])).rows[0];
  if(!row||row.status!=='accepted'||row.maker_account!==booking.maker_account||row.maker_character!==booking.maker_character
    ||row.customer_account!==booking.customer_account||row.customer_character!==booking.customer_character
    ||row.business_id!==booking.business_id||row.source_hash!==booking.commission_source_hash)fail('accepted_pair');return true;
}
