import crypto from 'node:crypto';
import { GameError, trunkCap } from './game.js';
import { CONSTANTS, jailed, safeHoused } from './rules.js';
import { assertItemTransaction, registerItemTransactionUndo } from './items.js';
import * as Delivery from './delivery.js';

export const FREIGHT = Object.freeze({ orders:2, maxUnits:8, maxSeconds:600, maxSupplierBatches:1, maxBuyerBatches:3, financing:'unsupported', newEscrow:false });
const scopes=new WeakMap();
const fail=reason=>{throw new GameError('freight_consolidation',reason);};
const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))fail('terms');return value;};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const exact=(body,keys)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!==keys.split(',').sort().join(','))fail('terms');};
function terms(action,batchId,body){
  if(action==='create'){
    exact(body,'commitmentIds,consent,expiresInSeconds');
    if(body.consent!==true||!Array.isArray(body.commitmentIds)||body.commitmentIds.length!==2||new Set(body.commitmentIds).size!==2
      ||!Number.isSafeInteger(body.expiresInSeconds)||body.expiresInSeconds<60||body.expiresInSeconds>FREIGHT.maxSeconds)fail('terms');
    const ids=body.commitmentIds.map(id);if(ids.join(',')!==[...ids].sort().join(','))fail('order');
    return {commitmentIds:ids,consent:true,expiresInSeconds:body.expiresInSeconds};
  }
  exact(body,action==='accept'?'consent,expectedRevision,manifestHash':'expectedRevision,manifestHash');
  if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1||!/^[a-f0-9]{64}$/.test(body.manifestHash)
    ||(action==='accept'&&body.consent!==true))fail('terms');
  return {batchId:id(batchId),expectedRevision:body.expectedRevision,manifestHash:body.manifestHash,...(action==='accept'?{consent:true}:{})};
}
const observed=async c=>+new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
export const freightConsolidationDDL=`
CREATE TABLE IF NOT EXISTS freight_consolidations (
 id TEXT PRIMARY KEY,supplier_account TEXT NOT NULL,supplier_character TEXT NOT NULL,
 buyer_a_account TEXT NOT NULL,buyer_a_character TEXT NOT NULL,buyer_b_account TEXT NOT NULL,buyer_b_character TEXT NOT NULL,
 manifest JSONB NOT NULL,manifest_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('proposed','ready','completed','cancelled','retired')),
 revision INT NOT NULL CHECK(revision>0),expires_at TIMESTAMPTZ NOT NULL,receipt JSONB);
CREATE TABLE IF NOT EXISTS freight_consolidation_acceptances (
 batch_id TEXT NOT NULL REFERENCES freight_consolidations(id),buyer_account TEXT NOT NULL,buyer_character TEXT NOT NULL,
 order_id TEXT NOT NULL,commitment_id TEXT NOT NULL,manifest_hash TEXT NOT NULL,accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(batch_id,buyer_account),UNIQUE(batch_id,order_id),UNIQUE(batch_id,commitment_id));
CREATE TABLE IF NOT EXISTS freight_consolidation_requests (
 account_id TEXT NOT NULL,request_key TEXT NOT NULL,identity TEXT NOT NULL,receipt JSONB NOT NULL,
 PRIMARY KEY(account_id,request_key));`;
export async function replayFreightConsolidation(c,account,action,batchId,body,key){
  id(account);id(key);const input=terms(action,batchId,body),identity=hash({action,input});
  const prior=(await c.query('SELECT identity,receipt FROM freight_consolidation_requests WHERE account_id=$1 AND request_key=$2',[account,key])).rows[0];
  if(!prior)return null;if(prior.identity!==identity)fail('request_conflict');return {...prior.receipt,replayed:true,historicalAcknowledgement:true};
}
async function save(c,ch,action,batchId,body,key,receipt){
  const identity=hash({action,input:terms(action,batchId,body)});
  registerItemTransactionUndo(c,()=>c.query('DELETE FROM freight_consolidation_requests WHERE account_id=$1 AND request_key=$2',[ch.account_id,key]));
  await c.query('INSERT INTO freight_consolidation_requests(account_id,request_key,identity,receipt) VALUES($1,$2,$3,$4)',[ch.account_id,key,identity,receipt]);return receipt;
}
async function hint(c,account,action,batchId,body){
  const input=terms(action,batchId,body);
  if(action==='create'){
    const current=(await c.query('SELECT id,account_id FROM characters WHERE account_id=$1 AND alive=true',[account])).rows;if(current.length!==1)fail('source');const supplier=current[0];
    const rows=[];for(const key of input.commitmentIds){const r=(await c.query('SELECT * FROM delivery_commitments WHERE id=$1 AND supplier_character=$2',[key,supplier.id])).rows[0];if(!r)fail('source');rows.push(r);}
    if(!supplier||supplier.account_id!==account||rows.some(r=>r.supplier_character!==supplier.id)||rows[0].buyer_character===rows[1].buyer_character)fail('parties');
    return {input,partyIds:[supplier.id,...rows.map(r=>r.buyer_character)],supplierId:supplier.id,commitmentIds:input.commitmentIds};
  }
  const batch=(await c.query('SELECT * FROM freight_consolidations WHERE id=$1',[input.batchId])).rows[0];if(!batch)fail('private');
  const partyIds=[batch.supplier_character,...batch.manifest.entries.map(r=>r.buyerCharacter)];
  const accounts=[batch.supplier_account,...batch.manifest.entries.map(r=>r.buyerAccount)];if(!accounts.includes(account))fail('private');
  return {input,batch,partyIds,supplierId:batch.supplier_character,commitmentIds:batch.manifest.entries.map(r=>r.commitmentId)};
}
// One feature-local three-original lock scope, composed with the ordinary game root.
export function freightLockHooks(action,batchId,body){
  if(!['create','accept','run','cancel'].includes(action))fail('terms');
  return {
    withActionScope:async(c,account,execute)=>{
      assertItemTransaction(c);if(scopes.has(c))fail('scope');const scope={account,action,batchId,body,active:true};scopes.set(c,scope);
      try{const result=await execute();if(!scope.locked)fail('scope');if(scope.finish)await scope.finish();return result;}finally{scope.active=false;scopes.delete(c);}
    },
    beforeCharacterLock:async(c,account)=>{
      const scope=scopes.get(c);if(!scope?.active||scope.account!==account)fail('scope');const h=await hint(c,account,action,batchId,body);
      if(new Set(h.partyIds).size!==3)fail('parties');const parties=[];
      for(const key of [...h.partyIds].sort()){
        const ch=(await c.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE',[key])).rows[0];
        if(!ch?.alive||ch.is_npc||!ch.account_id)fail('original_party');parties.push(ch);
      }
      if(new Set(parties.map(r=>r.account_id)).size!==3)fail('parties');
      for(const key of parties.map(r=>r.account_id).sort()){
        if(!(await c.query('SELECT account_id FROM account_persistent WHERE account_id=$1 FOR UPDATE',[key])).rows.length)fail('account');
        if((await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[key])).rows[0]?.status!=='active')fail('account');
      }
      if(!parties.some(r=>r.account_id===account))fail('private');scope.locked=true;scope.hint=h;scope.parties=parties;return h;
    },
    afterAccountLock:async(c,account,ch)=>{
      const s=scopes.get(c);if(!s?.locked||s.account!==account||!s.parties.some(r=>r.id===ch.id&&r.account_id===account))fail('original_party');
    },
  };
}
function scope(c,ch,action,batchId,body){assertItemTransaction(c);const s=scopes.get(c);
  if(!s?.active||!s.locked||s.account!==ch.account_id||s.action!==action||s.batchId!==batchId||hash(s.body)!==hash(body))fail('scope');return s;}
async function sources(c,s){
  const hints=[];for(const key of s.hint.commitmentIds){const r=(await c.query('SELECT * FROM delivery_commitments WHERE id=$1',[key])).rows[0];if(!r)fail('source');hints.push(r);}
  if(new Set(hints.map(r=>r.order_id)).size!==2||new Set(hints.map(r=>r.depot_id)).size!==2)fail('distinct_orders');
  for(const key of hints.map(r=>r.depot_id).sort())await c.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE',[key]);
  for(const key of hints.map(r=>r.order_id).sort())await c.query('SELECT id FROM market_listings WHERE id=$1 FOR UPDATE',[key]);
  for(const key of [...s.hint.commitmentIds].sort())await c.query('SELECT id FROM delivery_commitments WHERE id=$1 FOR UPDATE',[key]);
  const now=await observed(c),entries=[];
  for(const key of s.hint.commitmentIds){
    const a=(await c.query('SELECT * FROM delivery_commitments WHERE id=$1',[key])).rows[0];
    const order=a?(await c.query('SELECT * FROM market_listings WHERE id=$1',[a.order_id])).rows[0]:null;
    const depot=a?(await c.query('SELECT * FROM business_depots WHERE id=$1',[a.depot_id])).rows[0]:null;
    const original=hints.find(r=>r.id===key);
    if(a&&(!original||a.order_id!==original.order_id||a.depot_id!==original.depot_id||a.buyer_character!==original.buyer_character||a.supplier_character!==original.supplier_character))fail('source_changed');
    const buyer=s.parties.find(r=>r.id===a?.buyer_character);
    if(!a||!buyer||a.supplier_character!==s.hint.supplierId||a.status!=='accepted'||a.good_id!=='gin'||a.buyer_character===s.hint.supplierId
      ||!order||order.kind!=='order'||order.status!=='live'||order.depot_id!==a.depot_id||order.seller_character!==buyer.id
      ||order.good_id!==a.good_id||order.district!==a.district||Number(order.price)!==Number(a.unit_price)
      ||!depot||depot.status!=='open'||depot.owner_character!==buyer.id||depot.district!==a.district
      ||+new Date(a.deadline)<=now||+new Date(order.expires_at)<=now)fail('source_changed');
    if((await c.query('SELECT id FROM delivery_loan_requests WHERE commitment_id=$1',[a.id])).rows.length)fail('financing_unsupported');
    const books=(await c.query('SELECT * FROM business_depot_journal WHERE depot_id=$1 AND order_id=$2',[depot.id,order.id])).rows;
    const escrow=books.filter(r=>r.reason==='restock_escrow'),fee=books.filter(r=>r.reason==='restock_fee');
    const gross=(Number(order.qty)+Number(order.filled_qty))*Number(order.price);
    if(escrow.length!==1||fee.length!==1||!Number.isSafeInteger(gross)||Number(escrow[0].cash_delta)!==-gross
      ||Number(fee[0].cash_delta)>0||Number(fee[0].expense)!==-Number(fee[0].cash_delta))fail('funding_source');
    const quantity=Number(a.remaining);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>FREIGHT.maxUnits||quantity>Number(order.qty))fail('quantity');
    entries.push({commitmentId:a.id,orderId:order.id,depotId:depot.id,buyerAccount:buyer.account_id,buyerCharacter:buyer.id,
      quantity,allocatedTravelCash:entries.length===0?CONSTANTS.TRAVEL_COST:0,unitPrice:Number(a.unit_price),takeBps:Number(a.take_bps),spendLimit:Number(a.spend_limit),spent:Number(a.spent),deadline:new Date(a.deadline).toISOString(),orderExpiry:new Date(order.expires_at).toISOString(),
      escrowJournalId:escrow[0].id,feeJournalId:fee[0].id});
  }
  if(new Set(entries.map(r=>r.buyerAccount)).size!==2||entries.reduce((n,r)=>n+r.quantity,0)>FREIGHT.maxUnits
    ||new Set(hints.map(r=>r.district)).size!==1)fail('incompatible');
  return {entries,destination:hints[0].district,now};
}
async function lockedBatch(c,s,input){
  const fresh=await sources(c,s);
  const batch=(await c.query('SELECT * FROM freight_consolidations WHERE id=$1 FOR UPDATE',[input.batchId])).rows[0];
  if(!batch||batch.revision!==input.expectedRevision||batch.manifest_hash!==input.manifestHash||hash(batch.manifest)!==batch.manifest_hash
    ||hash(batch.manifest.entries)!==hash(fresh.entries)||batch.manifest.destination!==fresh.destination
    ||+new Date(batch.expires_at)<=fresh.now||!['proposed','ready'].includes(batch.state))fail('revision_or_source');
  return {batch,...fresh};
}
async function update(c,batch,state,receipt=null){
  registerItemTransactionUndo(c,()=>c.query('UPDATE freight_consolidations SET state=$2,revision=$3,receipt=$4 WHERE id=$1',[batch.id,batch.state,batch.revision,batch.receipt]));
  const r=await c.query('UPDATE freight_consolidations SET state=$3,revision=revision+1,receipt=$4 WHERE id=$1 AND revision=$2',[batch.id,batch.revision,state,receipt]);if(r.rowCount!==1)fail('revision');
}
export async function createFreightConsolidation(ch,body,key,c,h){
  const s=scope(c,ch,'create',null,body),prior=await replayFreightConsolidation(c,ch.account_id,'create',null,body,key);if(prior)return prior;
  const input=terms('create',null,body),fresh=await sources(c,s),quantity=fresh.entries.reduce((n,r)=>n+r.quantity,0);
  for(const party of s.parties)if(Number((await c.query("SELECT COUNT(*) n FROM freight_consolidations WHERE (supplier_account=$1 OR buyer_a_account=$1 OR buyer_b_account=$1) AND state IN('proposed','ready') AND expires_at>clock_timestamp()",[party.account_id])).rows[0].n)>=(party.id===s.hint.supplierId?1:3))fail('active_limit');
  if(ch.id!==s.hint.supplierId||ch.loc===fresh.destination||jailed(ch)||safeHoused(ch)||quantity>trunkCap(h)
    ||Number(h.owned.cargo.gin||0)<quantity||Object.values(h.owned.cargo).reduce((n,v)=>n+Number(v),0)>trunkCap(h))fail('trip');
  const expires=new Date(Math.min(fresh.now+input.expiresInSeconds*1000,...fresh.entries.map(r=>Math.min(+new Date(r.deadline),+new Date(r.orderExpiry)))));
  if(+expires-fresh.now<60000)fail('deadline');
  const manifest={supplierAccount:ch.account_id,supplierCharacter:ch.id,origin:ch.loc,destination:fresh.destination,
    quantity,travelCost:CONSTANTS.TRAVEL_COST,travelCommitmentId:fresh.entries[0].commitmentId,entries:fresh.entries};
  const batchId=crypto.randomUUID(),manifestHash=hash(manifest);
  registerItemTransactionUndo(c,()=>c.query('DELETE FROM freight_consolidations WHERE id=$1',[batchId]));
  await c.query("INSERT INTO freight_consolidations(id,supplier_account,supplier_character,buyer_a_account,buyer_a_character,buyer_b_account,buyer_b_character,manifest,manifest_hash,state,revision,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'proposed',1,$10)",[batchId,ch.account_id,ch.id,manifest.entries[0].buyerAccount,manifest.entries[0].buyerCharacter,manifest.entries[1].buyerAccount,manifest.entries[1].buyerCharacter,manifest,manifestHash,expires]);
  s.finish=async()=>{if(await observed(c)>=+expires)fail('expired');};
  return save(c,ch,'create',null,body,key,{ok:true,batchId,manifestHash,revision:1,state:'proposed',expiresAt:expires.toISOString(),quantity,travelCost:manifest.travelCost});
}
export async function acceptFreightConsolidation(ch,batchId,body,key,c){
  const s=scope(c,ch,'accept',batchId,body),prior=await replayFreightConsolidation(c,ch.account_id,'accept',batchId,body,key);if(prior)return prior;
  const input=terms('accept',batchId,body),{batch}=await lockedBatch(c,s,input),entry=batch.manifest.entries.find(r=>r.buyerAccount===ch.account_id&&r.buyerCharacter===ch.id);
  if(!entry)fail('original_buyer');
  if((await c.query('SELECT buyer_account FROM freight_consolidation_acceptances WHERE batch_id=$1 AND buyer_account=$2',[batchId,ch.account_id])).rows.length)fail('already_accepted');
  registerItemTransactionUndo(c,()=>c.query('DELETE FROM freight_consolidation_acceptances WHERE batch_id=$1 AND buyer_account=$2',[batchId,ch.account_id]));
  await c.query('INSERT INTO freight_consolidation_acceptances(batch_id,buyer_account,buyer_character,order_id,commitment_id,manifest_hash) VALUES($1,$2,$3,$4,$5,$6)',[batchId,ch.account_id,ch.id,entry.orderId,entry.commitmentId,input.manifestHash]);
  const count=Number((await c.query('SELECT COUNT(*) n FROM freight_consolidation_acceptances WHERE batch_id=$1',[batchId])).rows[0].n),state=count===2?'ready':'proposed';await update(c,batch,state);
  s.finish=async()=>{if(await observed(c)>=+new Date(batch.expires_at))fail('expired');};
  return save(c,ch,'accept',batchId,body,key,{ok:true,batchId,manifestHash:input.manifestHash,revision:batch.revision+1,state});
}
export async function runFreightConsolidation(ch,batchId,body,key,c,h){
  const s=scope(c,ch,'run',batchId,body),prior=await replayFreightConsolidation(c,ch.account_id,'run',batchId,body,key);if(prior)return prior;
  const input=terms('run',batchId,body),{batch}=await lockedBatch(c,s,input),m=batch.manifest;
  if(batch.state!=='ready'||ch.id!==batch.supplier_character||ch.account_id!==batch.supplier_account||ch.loc!==m.origin
    ||m.travelCost!==CONSTANTS.TRAVEL_COST||m.quantity>trunkCap(h)||Number(h.owned.cargo.gin||0)<m.quantity
    ||Object.values(h.owned.cargo).reduce((n,v)=>n+Number(v),0)>trunkCap(h))fail('trip');
  const accepted=(await c.query('SELECT * FROM freight_consolidation_acceptances WHERE batch_id=$1',[batchId])).rows;
  for(const e of m.entries)if(accepted.filter(r=>r.buyer_account===e.buyerAccount&&r.buyer_character===e.buyerCharacter&&r.order_id===e.orderId&&r.commitment_id===e.commitmentId&&r.manifest_hash===input.manifestHash).length!==1)fail('consent');
  const before={cash:Number(ch.cash),cargo:Number(h.owned.cargo.gin||0)},proofs=[];
  const travel=await Delivery.deliveryStep(ch,m.travelCommitmentId,'delivery_travel',{district:m.destination},c,h);
  if(travel.loc!==m.destination||travel.cost!==m.travelCost)fail('travel_effect');
  for(const e of m.entries){const receipt=await Delivery.deliverCommitment(ch,e.commitmentId,e.quantity,c,h);if(receipt.delivered!==e.quantity)fail('handoff');proofs.push({orderId:e.orderId,commitmentId:e.commitmentId,quantity:e.quantity,receipt});}
  const earned=proofs.reduce((n,r)=>n+r.receipt.earned,0);
  if(Number(ch.cash)!==before.cash-m.travelCost+earned||Number(h.owned.cargo.gin)!==before.cargo-m.quantity)fail('effects');
  const receipt={ok:true,batchId,manifestHash:input.manifestHash,revision:batch.revision+1,state:'completed',
    travel:{...travel,chargedCommitmentId:m.travelCommitmentId},handoffs:proofs,totalDelivered:m.quantity,earned};
  await update(c,batch,'completed',receipt);
  s.finish=async()=>{const now=await observed(c);if(now>=+new Date(batch.expires_at)||m.entries.some(e=>now>=+new Date(e.deadline)||now>=+new Date(e.orderExpiry)))fail('expired');
    for(const e of m.entries){const row=(await c.query('SELECT order_id,supplier_character,buyer_character,status,remaining FROM delivery_commitments WHERE id=$1',[e.commitmentId])).rows[0];if(!row||row.order_id!==e.orderId||row.supplier_character!==ch.id||row.buyer_character!==e.buyerCharacter||row.status!=='delivered'||Number(row.remaining)!==0)fail('settlement_binding');}};
  return save(c,ch,'run',batchId,body,key,receipt);
}
export async function cancelFreightConsolidation(ch,batchId,body,key,c){
  const s=scope(c,ch,'cancel',batchId,body),prior=await replayFreightConsolidation(c,ch.account_id,'cancel',batchId,body,key);if(prior)return prior;
  const input=terms('cancel',batchId,body),batch=(await c.query('SELECT * FROM freight_consolidations WHERE id=$1 FOR UPDATE',[batchId])).rows[0];
  if(!batch||batch.revision!==input.expectedRevision||batch.manifest_hash!==input.manifestHash||!['proposed','ready'].includes(batch.state))fail('revision');
  await update(c,batch,'cancelled');return save(c,ch,'cancel',batchId,body,key,{ok:true,batchId,state:'cancelled',revision:batch.revision+1,releasedCash:0,releasedGoods:0,canonicalObligationsUnchanged:true});
}
export async function freightConsolidationBoard(c,account){
  const batches=(await c.query('SELECT * FROM freight_consolidations WHERE supplier_account=$1 OR buyer_a_account=$1 OR buyer_b_account=$1 ORDER BY id LIMIT 20',[account])).rows;
  return {batches:batches.slice(0,20).map(b=>({id:b.id,state:b.state,revision:b.revision,manifestHash:b.manifest_hash,expiresAt:new Date(b.expires_at).toISOString(),
    role:b.supplier_account===account?'supplier':'buyer',orderCount:2,quantity:b.manifest.quantity,origin:b.manifest.origin,destination:b.manifest.destination,travelCost:b.manifest.travelCost,expired:+new Date(b.expires_at)<=Date.now(),
    entries:b.manifest.entries.filter(e=>b.supplier_account===account||e.buyerAccount===account).map(e=>({commitmentId:e.commitmentId,orderId:e.orderId,depotId:e.depotId,buyerCharacter:e.buyerCharacter,quantity:e.quantity,allocatedTravelCash:e.allocatedTravelCash,unitPrice:e.unitPrice,takeBps:e.takeBps,spendLimit:e.spendLimit,spent:e.spent,deadline:e.deadline,orderExpiry:e.orderExpiry})),receipt:b.supplier_account===account?b.receipt:null})),limits:FREIGHT};
}
export async function voidFreightConsolidationsAtDeath(c,victim){
  assertItemTransaction(c);const original=(await c.query('SELECT alive FROM characters WHERE id=$1',[id(victim?.id)])).rows[0];if(!original||original.alive!==false)fail('death_source');
  const rows=(await c.query("SELECT * FROM freight_consolidations WHERE (supplier_character=$1 OR buyer_a_character=$1 OR buyer_b_character=$1) AND state IN('proposed','ready') AND expires_at>clock_timestamp()",[victim.id])).rows;
  let retired=0;for(const row of rows)if(row.supplier_character===victim.id||row.manifest.entries.some(e=>e.buyerCharacter===victim.id)){await update(c,row,'retired');retired++;}return {retired,cashMoved:0,goodsMoved:0};
}
