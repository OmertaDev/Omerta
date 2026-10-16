import crypto from 'node:crypto';
import {GameError} from './game.js';
import { PRODUCTION_BOOKING } from './productionbooking-contracts.js';
export const bookingStable = value => JSON.stringify(value, (_key, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)) : x);
export const bookingHash = value => crypto.createHash('sha256').update(bookingStable(value)).digest('hex');
export const bookingFailure = reason => { throw new GameError('production_booking',reason); };
export const bookingISO = value => { if (value == null || !Number.isFinite(+new Date(value))) bookingFailure('source_time'); return new Date(value).toISOString(); };

export async function productionBookingResources(c, account, original, businessId) {
  const W = await import('./workshopfloor.js');
  if (typeof W.workshopFloorQualityBookingSource !== 'function') bookingFailure('integration_required');
  const value = await W.workshopFloorQualityBookingSource(c, { accountId: account, originalCharacter: original, businessId });
  if (value.account !== account || value.original !== original || value.businessId !== businessId || value.profile?.kind !== 'quality'
    || value.equipment?.itemId !== value.profile.tool_item_id || value.equipment.remaining < 80 || value.equipment.revision < 0
    || value.floor?.source?.premises?.kind !== 'estate'
    || !value.floor?.allocations?.some(x => x.use === 'service') || !value.floor.allocations.some(x => x.use === 'tool_bench' && x.toolItemId === value.equipment.itemId)) bookingFailure('resources');
  return value;
}
export async function verifyProductionBookingResources(c, offer, now) {
  if (offer.source_hash !== bookingHash(offer.source_json) || +new Date(offer.expires_at) <= now) bookingFailure('source_changed');
  const value = await productionBookingResources(c, offer.maker_account, offer.maker_character, offer.business_id);
  if (bookingStable(value) !== bookingStable(offer.source_json.resources)) bookingFailure('source_changed'); return value;
}

// Read-only historical proof. N03's fixed hook separately requires its genuine
// transaction-bound private completion/refund token before changing any bonus.
export async function productionBookingOutcome(c, offer, run, kind) {
  const row = (await c.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1', [run.commission_id])).rows[0];
  if (!row || row.customer_account !== offer.customer_account || row.customer_character !== offer.customer_character
    || row.maker_account !== offer.maker_account || row.maker_character !== offer.maker_character || row.business_id !== offer.business_id
    || row.source_hash !== run.commission_source_hash || Number(row.fee_total) !== Number(offer.fee_cash) || Number(row.fee_remaining) !== 0) bookingFailure('commission_history');
  const settlement = row.settlement;
  if (kind === 'completed') {
    if (row.status !== 'completed' || Number(row.fee_paid) !== Number(offer.fee_cash) || Number(row.fee_refunded) !== 0) bookingFailure('completion_history');
    const stored = (await c.query('SELECT * FROM company_production_receipts WHERE account_id=$1 AND request_key=$2', [offer.maker_account, 'commission:' + row.id + ':production'])).rows[0];
    const production = typeof stored?.receipt === 'string' ? JSON.parse(stored.receipt) : stored?.receipt;
    const craft = production?.crafts?.[0], admission = craft?.admission;
    if (stored?.original_character !== offer.maker_character || stored.business_id !== offer.business_id || production.totalCrafts !== 1 || production.totalCashCost !== 0
      || production.crafts.length !== 1 || bookingStable(production.steps)!==bookingStable([{recipeId:PRODUCTION_BOOKING.recipeId,repeat:1}])
      || craft.receipt?.recipe?.recipeId!==PRODUCTION_BOOKING.recipeId || admission?.kind !== 'quality'
      || Number(admission.revision) !== Number(offer.source_json.resources.profile.revision) || admission.immutableRecipeQuality !== true || admission.equipmentWear !== false
      || admission.workshopFloor?.sourceHash !== offer.source_json.resources.floor.sourceHash || admission.workshopFloor.toolItemId !== offer.tool_item
      || Number(admission.workshopFloor.revision) !== Number(offer.source_json.resources.floor.revision)
      || craft.receipt.outputs?.length !== 1 || craft.receipt.outputs[0].templateId !== 'item:precision_lock_tool'
      || craft.receipt.outputs[0].id !== settlement.outputItemId || bookingStable(production) !== bookingStable(settlement.production)) bookingFailure('production_history');
    const handover = (await c.query('SELECT event_kind,item_id,from_owner_scope,from_owner_id,to_owner_scope,to_owner_id FROM item_events WHERE idempotency_key=$1 ORDER BY sequence', [settlement.outputGuard])).rows;
    if (handover.length !== 1 || handover[0].event_kind !== 'transferred' || handover[0].item_id !== settlement.outputItemId
      || handover[0].from_owner_scope !== 'account' || handover[0].from_owner_id !== offer.maker_account
      || handover[0].to_owner_scope !== 'account' || handover[0].to_owner_id !== offer.customer_account) bookingFailure('handover_history');
    const fee = (await c.query('SELECT id,character_id,currency,amount,reason,counterparty FROM transactions WHERE id=$1', [settlement.feeTransaction])).rows[0];
    if (!fee || fee.character_id !== offer.maker_character || fee.currency !== 'cash' || Number(fee.amount) !== Number(offer.fee_cash)
      || fee.reason !== 'commissioned_crafting:fee' || fee.counterparty !== row.id) bookingFailure('fee_history');
    return { kind: 'canonical_production_completion', commissionId: row.id, commissionSourceHash: row.source_hash, reservationId: run.reservation_id,
      productionRunId: stored.run_id, productionKey: stored.request_key, outputItemId: settlement.outputItemId, outputGuard: settlement.outputGuard,
      feeTransaction: fee.id, baseFeeCash: Number(fee.amount), bonusCash: Number(run.bonus_cash), floorSourceHash: admission.workshopFloor.sourceHash,
      profileRevision: Number(admission.revision), toolItemId: admission.workshopFloor.toolItemId, recipeId: PRODUCTION_BOOKING.recipeId };
  }
  if (kind !== 'refunded' || row.status !== 'refunded' || Number(row.fee_refunded) !== Number(offer.fee_cash) || Number(row.fee_paid) !== 0) bookingFailure('refund_history');
  const tx = (await c.query('SELECT id,character_id,currency,amount,reason,counterparty FROM transactions WHERE id=$1', [settlement.refundTransaction])).rows[0];
  if (!tx || tx.character_id !== offer.customer_character || tx.currency !== 'cash' || Number(tx.amount) !== Number(offer.fee_cash)
    || tx.reason !== 'commissioned_crafting:refund' || tx.counterparty !== row.id) bookingFailure('refund_history');
  return { kind: 'canonical_production_refund', commissionId: row.id, commissionSourceHash: row.source_hash, reservationId: run.reservation_id,
    refundTransaction: tx.id, returnedInputs: settlement.returnedInputs, refundedFeeCash: Number(tx.amount), bonusCash: Number(run.bonus_cash) };
}
