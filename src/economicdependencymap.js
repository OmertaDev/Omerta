import { GameError } from './game.js';
import { withItemRead } from './items.js';

export const ECONOMIC_DEPENDENCY_MAP=Object.freeze({maximumOrders:20,maximumCommitments:40,maximumJournals:200,historyDays:30});
const fail=reason=>{throw new GameError('economic_dependency_map',reason);};
const id=v=>{if(typeof v!=='string'||!/^[!-~]{1,128}$/.test(v))fail('terms');return v;};
const whole=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(Number(v))&&Number(v)>=min&&Number(v)<=max;
const date=v=>{const n=+new Date(v);if(!Number.isSafeInteger(n))fail('source');return n;};
const observed=async c=>date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const unavailable=(business,reason,historyOnly=false)=>({status:'unavailable',businessId:business,reason,historyOnly,readOnly:true,executionAuthority:false});
async function read(pool,execute){const r=await withItemRead(pool,async c=>{try{return{value:await execute(c)};}catch(error){if(error instanceof GameError&&error.code==='economic_dependency_map')return{error};throw error;}});if(r.error)throw r.error;return r.value;}
function zero(row,fields){return fields.every(field=>Number(row[field])===0);}
export async function economicDependencyMap(pool,account,businessId){
 id(account);id(businessId);
 return read(pool,async c=>{
  if((await c.query('SELECT status FROM accounts WHERE id=$1',[account])).rows[0]?.status!=='active')fail('account');
  const d=(await c.query('SELECT d.*,a.account_id,a.alive,a.is_npc FROM business_depots d JOIN characters a ON a.id=d.owner_character WHERE d.id=$1 AND a.account_id=$2',[businessId,account])).rows[0];if(!d)fail('not_found');
  if(d.is_npc||!['open','closed'].includes(d.status)||!whole(d.stock,0,40)||!whole(d.stock_cost)||!whole(d.treasury)||(d.status==='open'&&!d.alive))fail('business_source');
  const historyOnly=d.status!=='open'||!d.alive;
  const at=await observed(c),cutoff=new Date(at-2592000000);
  const books=(await c.query('SELECT id,order_id,reason,cash_delta,stock_delta,cost_delta,expense,created_at FROM business_depot_journal WHERE depot_id=$1 ORDER BY created_at,id LIMIT 201',[d.id])).rows;
  if(books.length>200)return unavailable(d.id,'complete_depot_book_exceeds_200');
  if(!books.length||books.some(j=>!['cash_delta','stock_delta','cost_delta','expense'].every(k=>whole(j[k],k==='expense'?0:-Number.MAX_SAFE_INTEGER))||date(j.created_at)>at))fail('book_source');
  for(const [field,value]of [['cash_delta',d.treasury],['stock_delta',d.stock],['cost_delta',d.stock_cost]]){const sum=books.reduce((n,j)=>n+Number(j[field]),0);if(!whole(sum)||sum!==Number(value))fail('book_source');}
  const orders=(await c.query("SELECT * FROM market_listings WHERE depot_id=$1 AND (status='live' OR qty>0 OR filled_qty>0 OR created_at>=$2) ORDER BY id LIMIT 21",[d.id,cutoff])).rows;
  const commitments=(await c.query("SELECT * FROM delivery_commitments WHERE depot_id=$1 AND (status='accepted' OR created_at>=$2) ORDER BY id LIMIT 41",[d.id,cutoff])).rows;
  if(orders.length>20)return unavailable(d.id,'order_history_exceeds_20');if(commitments.length>40)return unavailable(d.id,'commitment_history_exceeds_40');
  if(historyOnly&&books.some(j=>j.order_id&&!orders.some(o=>o.id===j.order_id)))return unavailable(d.id,'canonical_order_history_removed_at_estate',true);
  if(commitments.some(x=>!orders.some(o=>o.id===x.order_id)))fail('order_source');
  const result=[],relationships=[],bottlenecks=[];const suppliers=new Map();
  for(const o of orders){
   if(o.kind!=='order'||o.good_id!=='gin'||o.seller_character!==d.owner_character||!['live','sold','cancelled','expired'].includes(o.status)||!whole(o.price,50,1000000)||!whole(o.qty,0,40)||!whole(o.filled_qty,0,40)||date(o.created_at)>at||date(o.expires_at)<=date(o.created_at))fail('order_source');
   const b=books.filter(j=>j.order_id===o.id),escrow=b.filter(j=>j.reason==='restock_escrow'),fee=b.filter(j=>j.reason==='restock_fee'),refund=b.filter(j=>j.reason==='restock_refund'),received=b.filter(j=>j.reason==='receive');
   if(escrow.length!==1||fee.length!==1||b.length!==escrow.length+fee.length+refund.length+received.length)fail('funding_source');
   const e=escrow[0],f=fee[0],price=Number(o.price),initial=-Number(e.cash_delta)/price;
   if(!whole(initial,1,40)||!zero(e,['stock_delta','cost_delta','expense'])||!whole(-Number(f.cash_delta),1)||Number(f.expense)!==-Number(f.cash_delta)||!zero(f,['stock_delta','cost_delta']))fail('funding_source');
   let receivedUnits=0,refundUnits=0;
   for(const j of received){if(!whole(j.stock_delta,1,40)||Number(j.cost_delta)!==Number(j.stock_delta)*price||!zero(j,['cash_delta','expense']))fail('funding_source');receivedUnits+=Number(j.stock_delta);}
   for(const j of refund){const units=Number(j.cash_delta)/price;if(!whole(units,1,40)||!zero(j,['stock_delta','cost_delta','expense']))fail('funding_source');refundUnits+=units;}
   const remaining=Number(o.qty),awaiting=Number(o.filled_qty),accounted=remaining+awaiting+receivedUnits+refundUnits;
   if(accounted>initial||(d.status==='open'&&accounted!==initial)||(o.status==='live'&&refundUnits!==0)||(o.status!=='live'&&remaining!==0))fail('funding_source');
   const bound=commitments.filter(x=>x.order_id===o.id);let reserved=0,delivered=0;
   for(const x of bound){
    if(x.buyer_character!==d.owner_character||x.good_id!==o.good_id||x.district!==o.district||Number(x.unit_price)!==price||x.supplier_character===d.owner_character||!whole(x.quantity,1,40)||!whole(x.remaining,0,Number(x.quantity))||!['accepted','delivered','expired','buyer_dead','supplier_dead'].includes(x.status)||date(x.deadline)<=date(x.created_at)||date(x.deadline)>date(o.expires_at)||date(x.created_at)<date(o.created_at)||date(x.created_at)>at||(x.status==='delivered'&&Number(x.remaining)!==0))fail('commitment_source');
    const person=(await c.query('SELECT id,account_id,is_npc,alive FROM characters WHERE id=$1',[x.supplier_character])).rows[0];if(!person||person.is_npc||person.account_id===account||(x.status==='accepted'&&!person.alive))fail('commitment_source');suppliers.set(person.id,{characterId:person.id,scope:'explicit_original_supplier_only'});
    const units=Number(x.quantity)-Number(x.remaining);delivered+=units;
    relationships.push({commitmentId:x.id,orderId:o.id,supplierCharacter:person.id,originalBuyerCharacter:d.owner_character,acceptedAt:new Date(date(x.created_at)).toISOString(),recordedDeliveredUnits:units,status:x.status,deliveryTimestamp:'not_recorded',paymentAttribution:'not_uniquely_recorded'});
   }
   if(d.status==='open'&&delivered>receivedUnits+awaiting)fail('delivery_source');
   result.push({orderId:o.id,good:'gin',district:o.district,status:o.status,unitPrice:price,initialFundedUnits:initial,remainingUnits:remaining,awaitingReceiveUnits:awaiting,receivedUnits,refundedUnits:refundUnits,escrowJournalId:e.id,feeJournalId:f.id,initialEscrowCash:initial*price,expiresAt:new Date(date(o.expires_at)).toISOString(),recordedEscrowCash:o.status==='live'?remaining*price:0,currentFundedUnits:0,currentFundedCash:0,reservedUnits:reserved,unassignedFundedUnits:0,unattributedDeliveredUnits:d.status==='open'?receivedUnits+awaiting-delivered:null,obligations:[]});
  }
  // A consistent read is a graph observation, never a permission/availability quote.
  const checked=await observed(c),historical=historyOnly;
  for(const row of result){const order=orders.find(o=>o.id===row.orderId),current=!historical&&order.status==='live'&&date(order.expires_at)>checked;let reserved=0;
   for(const x of commitments.filter(x=>x.order_id===row.orderId&&x.status==='accepted')){
    const live=current&&date(x.deadline)>checked;
    if(live)reserved+=Number(x.remaining);
    if(!historical&&Number(x.remaining)>0)row.obligations.push({commitmentId:x.id,supplierCharacter:x.supplier_character,remainingUnits:Number(x.remaining),unitPrice:row.unitPrice,fundedCash:live?Number(x.remaining)*row.unitPrice:0,deadline:new Date(date(x.deadline)).toISOString(),state:live?'current_funded':'deadline_or_order_unavailable'});
    if(!historical&&!live&&Number(x.remaining)>0)bottlenecks.push({kind:'expired_commitment_requires_canonical_recovery',orderId:row.orderId,units:Number(x.remaining)});
   }
   if(reserved>row.remainingUnits)fail('reservation_source');row.reservedUnits=reserved;row.currentFundedUnits=current?row.remainingUnits:0;row.currentFundedCash=row.currentFundedUnits*row.unitPrice;row.unassignedFundedUnits=current?row.remainingUnits-reserved:0;
   if(row.unassignedFundedUnits)bottlenecks.push({kind:'funded_units_without_current_supplier',orderId:row.orderId,units:row.unassignedFundedUnits});
   if(!historical&&row.awaitingReceiveUnits)bottlenecks.push({kind:'delivered_goods_await_canonical_receive',orderId:row.orderId,units:row.awaitingReceiveUnits});
   if(!historical&&row.recordedEscrowCash&&!current)bottlenecks.push({kind:'expired_order_requires_canonical_recovery',orderId:row.orderId,units:row.remainingUnits});
  }
  return{status:'verified',businessId:d.id,originalOwnerCharacter:d.owner_character,historyOnly:historical,observedAt:new Date(at).toISOString(),deadlinesCheckedAt:new Date(checked).toISOString(),source:'bounded_canonical_gin_procurement_snapshot',authority:false,readOnly:true,historyDays:30,orders:result,suppliers:[...suppliers.values()].sort((a,b)=>a.characterId.localeCompare(b.characterId)),relationships,bottlenecks,limits:{orders:20,commitments:40,journals:200},scope:{demand:'actual_funded_orders_only',openMarketSuppliers:'unattributed',supplierCashAndLocations:'private_not_queried',profits:'not_estimated',nonGinInputs:'unsupported',funding:'gross_buyer_escrow_not_supplier_net',executionRestrictions:'not_evaluated_use_canonical_actions'},consistentSnapshotNotExecutionQuote:true};
 });
}
