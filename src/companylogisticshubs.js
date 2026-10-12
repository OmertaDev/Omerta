import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { GameError } from './game.js';
import { loanOwed } from './rules.js';
import { assertPremisesOccupancy } from './commercialpremises.js';
import { withdrawWarehouseCargo } from './warehouseleases.js';
import { deliverFinancedCommitment,takeDeliveryAdvance } from './deliveryfinance.js';

export const LOGISTICS_HUB = Object.freeze({ maxSources:3,maxUnits:10,financier:'original premises and warehouse landlord',newFees:0 });
const fail=reason=>{ const e=new GameError('company_logistics_hub',reason); e.reason=reason; throw e; };
const id=value=>{ if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('terms'); return value; };
const exact=(body,fields)=>{ if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).sort().join(',')!==fields) fail('terms'); };
const person=ch=>{ if(!ch?.alive||ch.is_npc||!ch.account_id) fail('party'); };
const clock=async client=>+new Date((await client.query('SELECT clock_timestamp() AS at')).rows[0].at);
function terms(action,hubId,body) {
  if(action==='setup') {
    exact(body,'financeRequestIds,premisesLeaseId,warehouseLeaseId');
    if(!Array.isArray(body.financeRequestIds)||body.financeRequestIds.length<1||body.financeRequestIds.length>3
      ||new Set(body.financeRequestIds).size!==body.financeRequestIds.length) fail('terms');
    return { premisesLeaseId:id(body.premisesLeaseId),warehouseLeaseId:id(body.warehouseLeaseId),financeRequestIds:body.financeRequestIds.map(id) };
  }
  exact(body,action==='accept'?'consent,expectedRevision':'expectedRevision');
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1||body.expectedRevision>2147483646
    ||(action==='accept'&&body.consent!==true)) fail('terms');
  return { hubId:id(hubId),expectedRevision:body.expectedRevision,...(action==='accept'?{ consent:true }:{}) };
}
async function replay(account,action,input,key,client) {
  if(typeof key!=='string'||!key.length||key.length>200) fail('request_key');
  const old=(await client.query('SELECT terms,receipt FROM company_logistics_hub_requests WHERE account_id=$1 AND action=$2 AND request_key=$3',[id(account),action,key])).rows[0];
  if(!old) return null; if(!isDeepStrictEqual(old.terms,input)) fail('request_conflict'); return { ...old.receipt,replayed:true };
}
export async function replayLogisticsHubRequest(account,action,hubId,body,key,client) {
  if(!['setup','accept','run','cancel'].includes(action)) fail('terms');
  return replay(account,action,terms(action,hubId,body),key,client);
}
async function save(ch,action,input,key,result,client) {
  await client.query('INSERT INTO company_logistics_hub_requests(account_id,action,request_key,terms,receipt) VALUES($1,$2,$3,$4,$5)',[ch.account_id,action,key,input,result]); return result;
}
async function custody(ch,landlord,premisesId,warehouseId,client) {
  person(ch); person(landlord);
  const occupied=await assertPremisesOccupancy(ch,landlord,premisesId,client);
  if(occupied.premisesKind==='street'&&occupied.district!==occupied.businessDistrict) fail('custody_pairing');
  const warehouse=(await client.query('SELECT * FROM business_warehouse_leases WHERE id=$1 FOR UPDATE',[id(warehouseId)])).rows[0];
  const premises=(await client.query('SELECT depot_id,expires_at FROM commercial_premises_leases WHERE id=$1',[premisesId])).rows[0];
  // The premises helper already locks THIS depot before its own offer/lease.
  // Matching the depot avoids acquiring a different depot after those leaves.
  if(!warehouse||!premises?.depot_id||warehouse.depot_id!==premises.depot_id||warehouse.tenant_character!==ch.id
    ||warehouse.landlord_character!==landlord.id||warehouse.good_id!=='gin'||warehouse.status!=='active') fail('custody_pairing');
  const depot=(await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE',[warehouse.depot_id])).rows[0];
  if(!depot||depot.status!=='open'||depot.owner_character!==landlord.id||depot.district!==occupied.businessDistrict) fail('custody_pairing');
  return { warehouse,occupied,depot,premises };
}
// Canonical pair -> accounts/depot/profile/premises (existing helper) -> own
// warehouse -> loan -> order -> commitment -> finance request -> hub/source.
// Supported financiers are the same ORIGINAL landlord; no third actor is locked.
async function source(ch,landlord,requestId,client) {
  const hint=(await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1',[id(requestId)])).rows[0];
  if(!hint?.loan_id) fail('funded_reference');
  const loan=(await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE',[hint.loan_id])).rows[0];
  const order=(await client.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE',[hint.order_id])).rows[0];
  const commitment=(await client.query('SELECT * FROM delivery_commitments WHERE id=$1 FOR UPDATE',[hint.commitment_id])).rows[0];
  const finance=(await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1 FOR UPDATE',[requestId])).rows[0];
  const buyer=finance?(await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE id=$1',[finance.buyer_character])).rows[0]:null;
  if(!finance||!loan||!order||!commitment||finance.loan_id!==loan.id||finance.order_id!==order.id||finance.commitment_id!==commitment.id
    ||finance.supplier_character!==ch.id||finance.requested_lender_character!==landlord.id||loan.lender_character!==landlord.id
    ||(finance.state==='offered' ? loan.status!=='open'||loan.borrower_character!=null||loan.offered_to!==ch.id : loan.borrower_character!==ch.id)
    ||commitment.supplier_character!==ch.id||commitment.good_id!=='gin'
    ||commitment.order_id!==order.id||commitment.buyer_character!==finance.buyer_character||order.seller_character!==finance.buyer_character
    ||finance.terms?.supplierId!==ch.id||finance.terms?.lenderId!==landlord.id
    ||Number(loan.principal)!==finance.terms?.principal||Number(loan.rate)!==finance.terms?.rate||loan.hours!==finance.terms?.hours
    ||!buyer?.alive||buyer.is_npc||[ch.account_id,landlord.account_id].includes(buyer.account_id)
    ||(finance.state!=='offered'&&!finance.accepted_at)) fail('supported_landlord_financier');
  return { finance,loan,order,commitment };
}
function snapshot(ctx) {
  return { loanId:ctx.loan.id,orderId:ctx.order.id,commitmentId:ctx.commitment.id,quantity:Number(ctx.commitment.quantity),
    unitPrice:Number(ctx.commitment.unit_price),takeBps:ctx.commitment.take_bps,depotId:ctx.commitment.depot_id,district:ctx.commitment.district,
    principal:Number(ctx.loan.principal),rate:Number(ctx.loan.rate),terms:ctx.finance.terms };
}
function funded(ctx,now,district) {
  if(!['active','offered'].includes(ctx.finance.state)||(ctx.finance.state==='active'?ctx.loan.status!=='active':ctx.loan.status!=='open')||ctx.commitment.status!=='accepted'
    ||Number(ctx.commitment.remaining)!==Number(ctx.commitment.quantity)||ctx.order.status!=='live'||ctx.order.kind!=='order'
    ||ctx.order.good_id!=='gin'||ctx.order.depot_id!==ctx.commitment.depot_id||ctx.order.district!==district||ctx.commitment.district!==district
    ||Number(ctx.order.price)!==Number(ctx.commitment.unit_price)||Number(ctx.order.qty)<Number(ctx.commitment.remaining)
    ||+new Date(ctx.commitment.deadline)<=now||+new Date(ctx.order.expires_at)<=now
    ||(ctx.finance.state==='active'&&(!ctx.loan.due_at||+new Date(ctx.loan.due_at)<=now))) fail('source_changed');
}
function usable(ctx,now) {
  if(ctx.warehouse.status!=='active'||+new Date(ctx.warehouse.expires_at)<=now||+new Date(ctx.premises.expires_at)<=now) fail('lease_expired');
}
const view=row=>({ id:row.id,state:row.state,revision:row.revision,premisesLeaseId:row.premises_lease_id,
  warehouseLeaseId:row.warehouse_lease_id,district:row.district,totalUnits:row.total_units,expiresAt:new Date(row.expires_at).toISOString(),
  supportedFinancier:LOGISTICS_HUB.financier,gameCashOnly:true,newFees:0,fungibleCargoProvenance:false });
async function response(client,hubId,extra={}) {
  const row=(await client.query('SELECT * FROM company_logistics_hubs WHERE id=$1',[hubId])).rows[0];
  const advances=(await client.query('SELECT finance_request_id,snapshot FROM company_logistics_hub_sources WHERE hub_id=$1 ORDER BY position',[hubId])).rows.map(item=>({ financeRequestId:item.finance_request_id,terms:item.snapshot.terms }));
  return { ok:true,hub:{ ...view(row),advances,consentIncludesOfferedAdvances:true },...extra };
}
export async function setupLogisticsHub(ch,landlord,body,key,client) {
  const input=terms('setup',null,body), prior=await replay(ch.account_id,'setup',input,key,client); if(prior) return prior;
  if(process.env.DEPOT_PILOT!=='on') fail('disabled');
  const ctx=await custody(ch,landlord,input.premisesLeaseId,input.warehouseLeaseId,client), sources=[];
  for(const requestId of input.financeRequestIds) sources.push({ requestId,...await source(ch,landlord,requestId,client) });
  if(sources.some((entry,i)=>entry.finance.state==='active'&&i!==0)) fail('active_advance_must_be_first');
  // A financial source wait may outlive the previously checked premises lease.
  await assertPremisesOccupancy(ch,landlord,input.premisesLeaseId,client);
  const now=await clock(client); usable(ctx,now);
  let total=0,end=Math.min(+new Date(ctx.warehouse.expires_at),+new Date(ctx.premises.expires_at));
  for(const entry of sources) { funded(entry,now,ctx.depot.district); total+=Number(entry.commitment.quantity); end=Math.min(end,+new Date(entry.commitment.deadline),+new Date(entry.order.expires_at),entry.loan.due_at?+new Date(entry.loan.due_at):Infinity); }
  if(total<1||total>LOGISTICS_HUB.maxUnits||total>Number(ctx.warehouse.units)||total>Number(ctx.warehouse.held_qty)) fail('unbacked_capacity');
  const occupied=(await client.query("SELECT id FROM company_logistics_hubs WHERE (warehouse_lease_id=$1 OR premises_lease_id=$2) AND state IN ('draft','active') FOR UPDATE",[ctx.warehouse.id,input.premisesLeaseId])).rows;
  if(occupied.length) fail('occupied_hub');
  const hubId=crypto.randomUUID();
  await client.query(`INSERT INTO company_logistics_hubs(id,supplier_character,supplier_account,landlord_character,landlord_account,
    premises_lease_id,warehouse_lease_id,depot_id,district,total_units,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [hubId,ch.id,ch.account_id,landlord.id,landlord.account_id,input.premisesLeaseId,ctx.warehouse.id,ctx.depot.id,ctx.depot.district,total,new Date(end)]);
  for(let i=0;i<sources.length;i++) await client.query('INSERT INTO company_logistics_hub_sources(hub_id,position,finance_request_id,quantity,snapshot) VALUES($1,$2,$3,$4,$5)',[hubId,i+1,sources[i].requestId,sources[i].commitment.quantity,snapshot(sources[i])]);
  return save(ch,'setup',input,key,await response(client,hubId),client);
}
async function locked(ch,landlord,hubId,client) {
  const hint=(await client.query('SELECT * FROM company_logistics_hubs WHERE id=$1',[id(hubId)])).rows[0];
  if(!hint||hint.supplier_character!==ch.id||hint.supplier_account!==ch.account_id||hint.landlord_character!==landlord.id||hint.landlord_account!==landlord.account_id) fail('party');
  const ctx=await custody(ch,landlord,hint.premises_lease_id,hint.warehouse_lease_id,client);
  const items=(await client.query("SELECT * FROM company_logistics_hub_sources WHERE hub_id=$1 AND state='pending' ORDER BY position",[hubId])).rows;
  const sources=[];
  for(const item of items) { const current=await source(ch,landlord,item.finance_request_id,client); if(!isDeepStrictEqual(item.snapshot,snapshot(current))) fail('source_changed'); sources.push({ item,...current }); }
  await assertPremisesOccupancy(ch,landlord,hint.premises_lease_id,client);
  const now=await clock(client); usable(ctx,now);
  const hub=(await client.query('SELECT * FROM company_logistics_hubs WHERE id=$1 FOR UPDATE',[hubId])).rows[0];
  await client.query('SELECT position FROM company_logistics_hub_sources WHERE hub_id=$1 ORDER BY position FOR UPDATE',[hubId]);
  if(!hub||hub.warehouse_lease_id!==ctx.warehouse.id||hub.premises_lease_id!==hint.premises_lease_id||+new Date(hub.expires_at)<=now) fail('hub_expired');
  return { ...ctx,hub,sources,now };
}
export async function acceptLogisticsHub(ch,landlord,hubId,body,key,client) {
  const input=terms('accept',hubId,body), prior=await replay(ch.account_id,'accept',input,key,client); if(prior) return prior;
  const ctx=await locked(ch,landlord,hubId,client);
  if(ctx.hub.state!=='draft'||ctx.hub.revision!==input.expectedRevision) fail('revision');
  for(const entry of ctx.sources) funded(entry,ctx.now,ctx.depot.district);
  if(ctx.sources.reduce((n,entry)=>n+entry.item.quantity,0)>Number(ctx.warehouse.held_qty)) fail('unbacked_capacity');
  const changed=await client.query("UPDATE company_logistics_hubs SET state='active',revision=revision+1 WHERE id=$1 AND revision=$2",[hubId,input.expectedRevision]);
  if(changed.rowCount!==1) fail('revision');
  return save(ch,'accept',input,key,await response(client,hubId),client);
}
export async function runLogisticsHub(ch,landlord,hubId,body,key,client,h) {
  const input=terms('run',hubId,body), prior=await replay(ch.account_id,'run',input,key,client); if(prior) return prior;
  const ctx=await locked(ch,landlord,hubId,client);
  if(ctx.hub.state!=='active'||ctx.hub.revision!==input.expectedRevision||!ctx.sources.length) fail('revision');
  const selected=ctx.sources[0]; let withdrawalId=null, withdrawn=0;
  const alreadySettled=selected.finance.state==='settled';
  if(!alreadySettled) {
    for(const entry of ctx.sources) funded(entry,ctx.now,ctx.depot.district);
    if(ctx.sources.reduce((n,entry)=>n+entry.item.quantity,0)>Number(ctx.warehouse.held_qty)) fail('unbacked_capacity');
    // Explicit batch consent pins these offered terms. Canonical take preserves
    // LOAN.MAX_ACTIVE=1; the preceding batch loan must be repaid first.
    if(selected.finance.state==='offered') await takeDeliveryAdvance(ch,landlord,selected.finance.id,client,h);
    const moved=await withdrawWarehouseCargo(ch,ctx.warehouse.id,selected.item.quantity,client,h); withdrawn=moved.withdrawn;
    const journal=(await client.query('SELECT * FROM business_depot_journal WHERE lease_id=$1 ORDER BY lease_sequence DESC LIMIT 1',[ctx.warehouse.id])).rows[0];
    if(!journal||journal.reason!=='warehouse_withdraw'||journal.customer_character!==ch.id||journal.depot_id!==ctx.depot.id
      ||Number(journal.lease_stock_delta)!==-withdrawn||withdrawn!==selected.item.quantity) fail('custody_evidence');
    withdrawalId=journal.id;
    await deliverFinancedCommitment(ch,landlord,selected.commitment.id,selected.item.quantity,client,h);
  }
  const finance=(await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1',[selected.finance.id])).rows[0];
  const c=(await client.query('SELECT * FROM delivery_commitments WHERE id=$1',[selected.commitment.id])).rows[0];
  if(finance.state!=='settled'||!finance.settlement||c.status!=='delivered'||Number(c.remaining)!==0
    ||finance.settlement.delivery?.delivered!==selected.item.quantity||finance.settlement.repayment?.paid!==loanOwed(selected.loan.principal,selected.loan.rate)) fail('settlement_evidence');
  await assertPremisesOccupancy(ch,landlord,ctx.hub.premises_lease_id,client);
  const end=await clock(client); usable(ctx,end); if(+new Date(ctx.hub.expires_at)<=end) fail('hub_expired');
  await client.query("UPDATE company_logistics_hub_sources SET state='completed',withdrawal_journal_id=$3,settlement=$4,completed_at=clock_timestamp() WHERE hub_id=$1 AND position=$2 AND state='pending'",[hubId,selected.item.position,withdrawalId,finance.settlement]);
  const state=ctx.sources.length===1?'completed':'active';
  const changed=await client.query('UPDATE company_logistics_hubs SET state=$3,revision=revision+1 WHERE id=$1 AND revision=$2',[hubId,input.expectedRevision,state]);
  if(changed.rowCount!==1) fail('revision');
  return save(ch,'run',input,key,await response(client,hubId,{ financeRequestId:finance.id,withdrawn,alreadySettled,settlement:finance.settlement }),client);
}
export async function cancelLogisticsHub(ch,hubId,body,key,client) {
  const input=terms('cancel',hubId,body), prior=await replay(ch.account_id,'cancel',input,key,client); if(prior) return prior;
  person(ch);
  const row=(await client.query('SELECT * FROM company_logistics_hubs WHERE id=$1 FOR UPDATE',[id(hubId)])).rows[0];
  if(!row||row.supplier_character!==ch.id||row.supplier_account!==ch.account_id||row.revision!==input.expectedRevision) fail('party');
  const changed=await client.query("UPDATE company_logistics_hubs SET state='closed',revision=revision+1 WHERE id=$1 AND revision=$2",[hubId,input.expectedRevision]); if(changed.rowCount!==1) fail('revision');
  return save(ch,'cancel',input,key,await response(client,hubId),client);
}
export async function logisticsHubBoard(client,account) {
  const rows=(await client.query('SELECT * FROM company_logistics_hubs WHERE supplier_account=$1 ORDER BY expires_at,id LIMIT 100',[id(account)])).rows;
  const hubs=[]; for(const row of rows) hubs.push({ ...view(row),sources:(await client.query('SELECT position,finance_request_id,quantity,state,withdrawal_journal_id,settlement FROM company_logistics_hub_sources WHERE hub_id=$1 ORDER BY position',[row.id])).rows });
  return { ok:true,hubs,limits:LOGISTICS_HUB };
}
export async function voidLogisticsHubsAtDeath(client,victim) {
  const rows=(await client.query("SELECT id FROM company_logistics_hubs WHERE (supplier_character=$1 OR landlord_character=$1) AND state IN ('draft','active') ORDER BY id FOR UPDATE",[victim.id])).rows;
  for(const row of rows) await client.query("UPDATE company_logistics_hubs SET state='closed',revision=revision+1 WHERE id=$1",[row.id]);
  return { closedHubs:rows.length,newCash:0 };
}
