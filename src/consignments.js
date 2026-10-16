import crypto from 'node:crypto';
import { GameError, ledger } from './game.js';
import { jailed, safeHoused } from './rules.js';
import { assertItemTransaction, itemTransactionIdentity, itemMutationContext, ownsItemMutationReservation, withItemMutation, escrowItem, releaseEscrow, transferItem, poisonItemTransaction, registerItemTransactionUndo } from './items.js';
import { assertEquipmentUsable } from './itemdurability.js';
import { assertEquipmentRentalDeathScope } from './equipmentrentals.js';
import { assertEstateResolutionScope } from './social/estate.js';

export const CONSIGNMENTS = Object.freeze({ templateId: 'item:precision_lock_tool', ownerLimit: 8, hostLimit: 16, maximumPrice: 1000000, maximumFeeBps: 2000 });
const fail = reason => { throw new GameError('consignment', reason); };
const id = v => { if (typeof v !== 'string' || !/^[!-~]{1,128}$/.test(v)) fail('identity'); return v; };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const integer = (v, a, b) => Number.isSafeInteger(v) && v >= a && v <= b;
const stable = v => JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : x);
const hash = v => crypto.createHash('sha256').update(stable(v)).digest('hex');
const clock = async c => new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const title = account => ({ scope: 'account', id: account });
function normalize(action, body) {
  if (action === 'create') {
    if (!exact(body, ['itemId','hostAccountId','price','hostFeeBps','lifetimeSeconds','consent']) || body.consent !== true
      || !integer(body.price,1,1000000) || !integer(body.hostFeeBps,0,2000) || !integer(body.lifetimeSeconds,60,86400)) fail('terms');
    return { action, itemId:id(body.itemId), hostAccountId:id(body.hostAccountId), price:body.price, hostFeeBps:body.hostFeeBps, lifetimeSeconds:body.lifetimeSeconds, consent:true };
  }
  if (!['accept','buy','cancel','expire'].includes(action) || !exact(body,['consignmentId','sourceHash','consent']) || body.consent !== true
    || typeof body.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.sourceHash)) fail('terms');
  return { action, consignmentId:id(body.consignmentId), sourceHash:body.sourceHash, consent:true };
}
async function request(c, account, action, body, key, execute) {
  assertItemTransaction(c); id(account); id(key); const terms=normalize(action,body), keyHash=hash([account,key]), bodyHash=hash(terms);
  const prior=(await c.query('SELECT body_hash,receipt FROM consignment_requests WHERE account_id=$1 AND key_hash=$2',[account,keyHash])).rows[0];
  if(prior){if(prior.body_hash!==bodyHash)fail('request_conflict');if(!prior.receipt)fail('in_progress');return prior.receipt;}
  const run=crypto.randomUUID(); registerItemTransactionUndo(c,()=>c.query('DELETE FROM consignment_requests WHERE account_id=$1 AND key_hash=$2 AND run_id=$3',[account,keyHash,run]));
  await c.query('INSERT INTO consignment_requests(account_id,key_hash,body_hash,run_id) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,key_hash) DO NOTHING',[account,keyHash,bodyHash,run]);
  const reserved=(await c.query('SELECT body_hash,run_id,receipt FROM consignment_requests WHERE account_id=$1 AND key_hash=$2 FOR UPDATE',[account,keyHash])).rows[0];
  if(reserved.body_hash!==bodyHash)fail('request_conflict');if(reserved.receipt)return reserved.receipt;if(reserved.run_id!==run)fail('in_progress');
  const result=await execute(terms,run);
  if((await c.query('UPDATE consignment_requests SET receipt=$4,account_ref=$1,original_character=$5 WHERE account_id=$1 AND key_hash=$2 AND run_id=$3 AND receipt IS NULL',[account,keyHash,run,result.receipt,result.actorId])).rowCount!==1)fail('receipt');
  return result.receipt;
}
async function current(c,account){const rows=(await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2',[account])).rows;if(rows.length!==1)fail('original_actor');return rows[0].id;}
// Feature-specific finite ordering: original characters, accounts, listing, physical UID.
export async function lockConsignmentParties(c, ids, returning=false) {
  assertItemTransaction(c); if(!Array.isArray(ids)||ids.length<1||ids.length>3)fail('parties');const rows=[];
  for(const actor of [...new Set(ids.map(id))].sort()){const row=(await c.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE',[actor])).rows[0];if(!row||row.is_npc)fail('original_actor');rows.push(row);}
  if(new Set(rows.map(r=>r.account_id)).size!==rows.length)fail('self');
  for(const account of rows.map(r=>r.account_id).sort()){const status=(await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[account])).rows[0]?.status;if(!status||(!returning&&status!=='active'))fail('account');}
  return rows;
}
function live(rows){if(rows.some(r=>!r.alive))fail('original_actor');}
function source(row){return {id:row.id,itemId:row.item_id,ownerAccount:row.owner_account,ownerCharacter:row.owner_character,hostAccount:row.host_account,hostCharacter:row.host_character,price:Number(row.price),hostFeeBps:Number(row.host_fee_bps),expiresAt:new Date(row.expires_at).toISOString()};}
const dto=row=>({consignmentId:row.id,sourceHash:row.source_hash,price:Number(row.price),hostFeeBps:Number(row.host_fee_bps),expiresAt:new Date(row.expires_at).toISOString(),status:row.status});
async function listing(c,terms){const row=(await c.query('SELECT * FROM consignments WHERE id=$1 FOR UPDATE',[terms.consignmentId])).rows[0];if(!row||row.source_hash!==terms.sourceHash||hash(source(row))!==row.source_hash)fail('source');return row;}
async function custody(c,row){
  const item=(await c.query('SELECT * FROM item_instances WHERE id=$1 FOR UPDATE',[row.item_id])).rows[0];
  const escrow=(await c.query('SELECT * FROM operation_escrow WHERE item_id=$1 AND operation_id=$2 FOR UPDATE',[row.item_id,row.id])).rows[0];
  if(item?.template_id!==CONSIGNMENTS.templateId||item.owner_scope!=='operation'||item.owner_id!==row.id||item.state!=='escrowed'||escrow?.depositor_scope!=='account'||escrow.depositor_id!==row.owner_account)fail('custody');
  return assertEquipmentUsable(c,{itemId:row.item_id});
}
async function change(c,row,status,buyer=null,receipt=null){
  registerItemTransactionUndo(c,()=>c.query('UPDATE consignments SET status=$2,buyer_character=$3,settlement=$4 WHERE id=$1',[row.id,row.status,row.buyer_character,row.settlement]));
  if((await c.query('UPDATE consignments SET status=$2,buyer_character=$3,settlement=$4 WHERE id=$1 AND status=$5',[row.id,status,buyer,receipt,row.status])).rowCount!==1)fail('source');
}
async function cash(c,ch,amount,reason,counterparty){
  const before=Number(ch.cash);if(!ch.alive||!Number.isSafeInteger(before)||!Number.isSafeInteger(before+amount)||before+amount<0)fail('cash');
  registerItemTransactionUndo(c,()=>c.query('UPDATE characters SET cash=$2 WHERE id=$1',[ch.id,before]));
  if((await c.query('UPDATE characters SET cash=cash+$2 WHERE id=$1 AND alive=true AND cash+$2>=0',[ch.id,amount])).rowCount!==1)fail('cash');
  const tx=await ledger(c,{characterId:ch.id,currency:'cash',amount,reason,counterparty},{beforeInsert:tx=>registerItemTransactionUndo(c,()=>c.query('DELETE FROM transactions WHERE id=$1',[tx]))});ch.cash=before+amount;return tx;
}
async function create(c,account,terms,run){
  const ownerId=await current(c,account), hostId=await current(c,terms.hostAccountId), rows=await lockConsignmentParties(c,[ownerId,hostId]);live(rows);
  const owner=rows.find(r=>r.id===ownerId),host=rows.find(r=>r.id===hostId);if(owner.account_id!==account||host.account_id!==terms.hostAccountId)fail('original_actor');
  if(jailed(owner)||safeHoused(owner))fail('mobile');
  if((await c.query("SELECT id FROM consignments WHERE owner_account=$1 AND status IN ('offered','active') LIMIT 8",[account])).rows.length>=8)fail('owner_limit');
  await assertEquipmentUsable(c,{itemId:terms.itemId,owner:title(account)});const now=await clock(c),expires=new Date(+now+terms.lifetimeSeconds*1000);
  if((await c.query("SELECT id FROM consignments WHERE (item_id=$1) IS TRUE AND (owner_account=$2) IS TRUE AND status IN ('offered','active')",[terms.itemId,account])).rows.length)fail('item_offer');
  const row={id:run,item_id:terms.itemId,owner_account:account,owner_character:owner.id,host_account:host.account_id,host_character:host.id,price:terms.price,host_fee_bps:terms.hostFeeBps,expires_at:expires,status:'offered'};row.source_hash=hash(source(row));
  registerItemTransactionUndo(c,()=>c.query('DELETE FROM consignments WHERE id=$1',[run]));
  await c.query("INSERT INTO consignments(id,item_id,owner_account,owner_character,host_account,host_character,price,host_fee_bps,expires_at,source_hash,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'offered')",[run,terms.itemId,account,owner.id,host.account_id,host.id,terms.price,terms.hostFeeBps,expires,row.source_hash]);
  if(+await clock(c)>=+expires)fail('expired');
  return {actorId:owner.id,receipt:{ok:true,...dto(row)}};
}
async function execute(c,account,terms,run,economy=null,basket=null){
  const hint=(await c.query('SELECT owner_character,host_character FROM consignments WHERE id=$1',[terms.consignmentId])).rows[0];if(!hint)fail('source');
  const callerId=await current(c,account), ids=[hint.owner_character,hint.host_character];if(terms.action==='buy')ids.push(callerId);
  const returning=terms.action==='cancel'||terms.action==='expire';
  const rows=await lockConsignmentParties(c,ids,returning), row=await listing(c,terms),caller=rows.find(r=>r.id===callerId&&r.account_id===account);
  if(!caller||row.owner_character!==hint.owner_character||row.host_character!==hint.host_character)fail('original_actor');
  if(returning&&(await c.query('SELECT status FROM accounts WHERE id=$1',[account])).rows[0]?.status!=='active')fail('account');
  const owner=rows.find(r=>r.id===row.owner_character),host=rows.find(r=>r.id===row.host_character);if(owner?.account_id!==row.owner_account||host?.account_id!==row.host_account)fail('original_actor');
  if(!['offered','active'].includes(row.status))fail('closed');
  if(terms.action==='accept'){
    live(rows);if(caller.id!==host.id||row.status!=='offered')fail('host');
    if((await c.query("SELECT id FROM consignments WHERE host_account=$1 AND status='active' LIMIT 16",[host.account_id])).rows.length>=16)fail('host_limit');
    await assertEquipmentUsable(c,{itemId:row.item_id,owner:title(row.owner_account)});if(+await clock(c)>=+new Date(row.expires_at))fail('expired');
    await withItemMutation(c,title(row.owner_account),'operation_action','consignment:'+run+':deposit',{consignmentId:row.id,itemId:row.item_id,itemAuthority:{operations:[row.id]}},m=>escrowItem(c,title(row.owner_account),row.id,row.item_id,'mutually consented consignment original-owner custody',m,'used_in_operation'));
    if(+await clock(c)>=+new Date(row.expires_at))fail('expired');await change(c,row,'active');return {actorId:caller.id,receipt:{ok:true,...dto({...row,status:'active'})}};
  }
  if(terms.action==='buy'){
    live(rows);if(rows.length!==3||[owner.account_id,host.account_id].includes(account)||row.status!=='active')fail('buyer');if(jailed(caller)||safeHoused(caller)||caller.loc!==host.loc)fail('pickup');
    const condition=await custody(c,row);if(+await clock(c)>=+new Date(row.expires_at))fail('expired');const fee=Math.floor(Number(row.price)*Number(row.host_fee_bps)/10000);
    let pricing={buyerPaid:Number(row.price),hostFee:fee,sellerPaid:Number(row.price)-fee};
    if(basket){if(economy)fail('mixed_purchase_context');await (await import('./shoppingbasket.js')).assertShoppingBasketPurchaseScope(c,basket.context,row.id,row.source_hash,account);}
    if(economy?.contexts.attributionContext)await (await import('./saleattribution.js')).assertSaleAttributionPurchaseScope(c,economy.contexts.attributionContext,row.id,row.source_hash,account);
    if(economy?.contexts.loyaltyContext)pricing=await (await import('./merchantloyalty.js')).assertMerchantLoyaltyPurchaseScope(c,economy.contexts.loyaltyContext,row.id,row.source_hash,account);
    if(!!economy?.contexts.loyaltyContext!==!!pricing.loyalty)fail('sale_pricing');
    if(pricing.loyalty){pricing={...pricing,loyalty:loyaltyTerms(pricing.loyalty)};if(pricing.loyalty.discountCash!==Number(row.price)-pricing.buyerPaid)fail('sale_pricing');}
    if(!Number.isSafeInteger(pricing.buyerPaid)||!Number.isSafeInteger(pricing.sellerPaid)||pricing.buyerPaid<fee||pricing.buyerPaid>Number(row.price)||pricing.hostFee!==fee||pricing.sellerPaid!==pricing.buyerPaid-fee||(!economy?.contexts.loyaltyContext&&pricing.buyerPaid!==Number(row.price)))fail('sale_pricing');
    for(const [actor,delta] of [[caller,-pricing.buyerPaid],[owner,pricing.sellerPaid],[host,fee]])if(!Number.isSafeInteger(Number(actor.cash))||!Number.isSafeInteger(Number(actor.cash)+delta)||Number(actor.cash)+delta<0)fail('cash');
    const result=await withItemMutation(c,title(row.owner_account),'operation_action','consignment:'+run+':sale',{consignmentId:row.id,sourceHash:row.source_hash,buyerAccount:account,...(pricing.loyalty?{loyalty:pricing.loyalty}:{}),itemAuthority:{operations:[row.id],destinations:[title(row.owner_account),title(account)]}},async mutation=>{
      await releaseEscrow(c,row.id,title(row.owner_account),row.item_id,'consignment original depositor sale release',mutation);
      await transferItem(c,title(row.owner_account),title(account),row.item_id,'consignment buyer title transfer',mutation);
      const legs=[await cash(c,caller,-pricing.buyerPaid,'consignment:purchase',row.id),await cash(c,owner,pricing.sellerPaid,'consignment:proceeds',row.id),await cash(c,host,fee,'consignment:host_fee',row.id)];
      if(+await clock(c)>=+new Date(row.expires_at))fail('expired');
      const receipt={ok:true,...dto({...row,status:'sold'}),itemId:row.item_id,paid:pricing.buyerPaid,hostFee:fee,condition:condition.remaining,transactionIds:legs,...(pricing.loyalty?{loyalty:pricing.loyalty}:{})};
      if(economy){const proof=Object.freeze({});freshEconomySales.set(proof,{c,transaction:itemTransactionIdentity(c),contexts:economy.contexts,consignmentId:row.id,key:itemMutationContext(c,mutation).key,mutationId:itemMutationContext(c,mutation).mutationId,receipt:structuredClone(receipt),used:false});economy.proof=proof;}
      if(basket){const proof=Object.freeze({}),ctx=itemMutationContext(c,mutation);freshBasketSales.set(proof,{client:c,transaction:itemTransactionIdentity(c),context:basket.context,consignmentId:row.id,key:ctx.key,mutationId:ctx.mutationId,receipt:structuredClone(receipt),used:false});basket.proof=proof;}
      return receipt;
    });await change(c,row,'sold',caller.id,result);return {actorId:caller.id,receipt:result};
  }
  if(![owner.id,host.id].includes(caller.id)||!caller.alive)fail('original_actor');
  if(terms.action==='expire'&&+await clock(c)<+new Date(row.expires_at))fail('not_expired');
  const status=terms.action==='expire'?'expired':'cancelled';if(row.status==='active')await returnTool(c,row,run);await change(c,row,status);return {actorId:caller.id,receipt:{ok:true,...dto({...row,status})}};
}
async function returnTool(c,row,run){
  // Return does not require usable condition; recovery must not strand a damaged tool.
  return withItemMutation(c,title(row.owner_account),'operation_action','consignment:'+run+':return',{consignmentId:row.id,itemAuthority:{operations:[row.id],destinations:[title(row.owner_account)]}},m=>releaseEscrow(c,row.id,title(row.owner_account),row.item_id,'consignment return to original depositor',m));
}
async function action(c,account,name,body,key){assertItemTransaction(c);try{return await request(c,account,name,body,key,(terms,run)=>name==='create'?create(c,account,terms,run):execute(c,account,terms,run));}catch(error){poisonItemTransaction(c,error);throw error;}}
export const createConsignment=(c,account,body,key)=>action(c,account,'create',body,key);
export const acceptConsignment=(c,account,body,key)=>action(c,account,'accept',body,key);
export const buyConsignment=(c,account,body,key)=>action(c,account,'buy',body,key);
export const cancelConsignment=(c,account,body,key)=>action(c,account,'cancel',body,key);
export const expireConsignment=(c,account,body,key)=>action(c,account,'expire',body,key);
export async function consignmentBoard(c,account,after=''){
  id(account);if(after!=='')id(after);
  const rows=(await c.query("SELECT * FROM consignments WHERE id>$1 AND (status='active' OR owner_account=$2 OR host_account=$2) ORDER BY id LIMIT 25",[after,account])).rows;
  // Accepting a public sale advertises its pickup district without publishing
  // the host's identity. This observation never authorizes a later purchase.
  const pickup = new Map();
  for (const row of rows) if (row.status === 'active' && !pickup.has(row.host_character)) {
    const host = (await c.query('SELECT loc,alive FROM characters WHERE id=$1', [row.host_character])).rows[0];
    pickup.set(row.host_character, host?.alive ? host.loc : null);
  }
  const observed=await clock(c);return {observedAt:observed.toISOString(),rows:rows.map(row=>({...dto(row),available:row.status==='active'&&+new Date(row.expires_at)>+observed,pickupDistrict:row.status==='active'?pickup.get(row.host_character)??null:null,...([row.owner_account,row.host_account].includes(account)?{itemId:row.item_id,originalOwner:row.owner_character,originalHost:row.host_character}: {})})),next:rows.length===25?rows.at(-1).id:null};
}
// Root estate integration must compose this discovery with ALL other pre-actor unions.
export async function consignmentDeathCounterparts(c,characterId){
  assertItemTransaction(c);const rows=(await c.query("SELECT owner_character,host_character FROM consignments WHERE status='active' AND (owner_character=$1 OR host_character=$1) ORDER BY id LIMIT 25",[id(characterId)])).rows;if(rows.length>24)fail('death_limit');return [...new Set(rows.flatMap(r=>[r.owner_character,r.host_character]))].sort();
}
const deathScopes=new WeakMap();
// Only the canonical estate can adopt its already locked complete actor union.
// The witness is verified privately; callers cannot supply an ids array or flag.
export async function recoverConsignmentsInEstate(c, characterId, rentalScope, estateScope) {
  await assertEstateResolutionScope(c, characterId, estateScope);
  const locked = await assertEquipmentRentalDeathScope(c, characterId, rentalScope);
  const scope = Object.freeze({});
  deathScopes.set(scope, { c, transaction: itemTransactionIdentity(c), characterId, ids: [...locked.ids] });
  return recoverConsignmentsAtDeath(c, characterId, scope);
}
export async function prelockConsignmentDeath(c,characterId){
  const ids=[...new Set([id(characterId),...await consignmentDeathCounterparts(c,characterId)])].sort(),rows=[];
  for(const key of ids){const row=(await c.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE',[key])).rows[0];if(!row)fail('death_actor');rows.push(row);}
  for(const key of [...new Set(rows.map(r=>r.account_id))].sort())await c.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[key]);
  const scope=Object.freeze({});deathScopes.set(scope,{c,transaction:itemTransactionIdentity(c),characterId,ids});return scope;
}
export async function recoverConsignmentsAtDeath(c,characterId,scope){
  assertItemTransaction(c);try{const locked=deathScopes.get(scope);if(!locked||locked.c!==c||locked.transaction!==itemTransactionIdentity(c)||locked.characterId!==characterId)fail('death_scope');
    if((await c.query('SELECT alive FROM characters WHERE id=$1',[characterId])).rows[0]?.alive!==false)fail('death_required');
    if((await consignmentDeathCounterparts(c,characterId)).some(key=>!locked.ids.includes(key)))fail('death_scope_changed');
    const rows=(await c.query("SELECT * FROM consignments WHERE (status='active' AND (owner_character=$1 OR host_character=$1)) OR (status='offered' AND owner_character=$1) ORDER BY id LIMIT 25 FOR UPDATE",[characterId])).rows;if(rows.length>24)fail('death_limit');
    for(const row of rows){if(row.status==='active')await returnTool(c,row,'death:'+row.id);await change(c,row,'party_dead');}return rows.map(r=>r.id);
  }catch(error){poisonItemTransaction(c,error);throw error;}
}
export async function collectConsignmentIssues(c){
  const issues=[],rows=(await c.query('SELECT * FROM consignments ORDER BY id')).rows;
  for(const row of rows){
    if(hash(source(row))!==row.source_hash)issues.push({id:row.id,reason:'source_hash'});
    if(row.status==='active'){
      const item=(await c.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[row.item_id])).rows[0];
      const deposit=(await c.query('SELECT depositor_scope,depositor_id FROM operation_escrow WHERE item_id=$1 AND operation_id=$2',[row.item_id,row.id])).rows[0];
      if(item?.owner_scope!=='operation'||item.owner_id!==row.id||item.state!=='escrowed'||deposit?.depositor_scope!=='account'||deposit.depositor_id!==row.owner_account)issues.push({id:row.id,reason:'custody'});
    }
    if(row.status==='sold'&&row.settlement?.loyalty){try{await consignmentEconomySaleWitness(c,row.id);}catch{issues.push({id:row.id,reason:'sale_legs'});}continue;}
    if(row.status==='sold'){
      const legs=(await c.query("SELECT id,character_id,currency,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('consignment:purchase','consignment:proceeds','consignment:host_fee') ORDER BY reason",[row.id])).rows,fee=Math.floor(Number(row.price)*Number(row.host_fee_bps)/10000);
      const expected=[['consignment:host_fee',row.host_character,fee],['consignment:proceeds',row.owner_character,Number(row.price)-fee],['consignment:purchase',row.buyer_character,-Number(row.price)]];
      if(legs.length!==3||expected.some(([reason,actor,amount],i)=>legs[i]?.reason!==reason||legs[i]?.character_id!==actor||legs[i]?.currency!=='cash'||Number(legs[i]?.amount)!==amount)||stable(legs.map(l=>l.id).sort())!==stable([...(row.settlement?.transactionIds||[])].sort()))issues.push({id:row.id,reason:'sale_legs'});
    }
  }return issues;
}

// N16/N17 proposal: fixed source-bound private contexts, no caller-installed adapters.
const freshEconomySales=new WeakMap();
function loyaltyTerms(value){
  if(!exact(value,['programId','programSourceHash','quoteId','quoteSourceHash','discountCash'])||!integer(value.discountCash,1,1000000)||!digestHash(value.programSourceHash)||!digestHash(value.quoteSourceHash))fail('sale_pricing');
  return {programId:id(value.programId),programSourceHash:value.programSourceHash,quoteId:id(value.quoteId),quoteSourceHash:value.quoteSourceHash,discountCash:value.discountCash};
}
const digestHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function economyContexts(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length<1||Object.keys(value).length>2||Object.keys(value).some(k=>!['attributionContext','loyaltyContext'].includes(k))||Object.values(value).some(v=>!v||typeof v!=='object'))fail('economy_context');
  return Object.freeze({...value});
}
export async function consignmentEconomyListing(c,consignmentId,sourceHash){assertItemTransaction(c);return consignmentEconomyEventHistoryReference(c,consignmentId,sourceHash);}
export async function consignmentEconomyEventHistoryReference(c,consignmentId,sourceHash){
  const row=(await c.query('SELECT * FROM consignments WHERE id=$1',[id(consignmentId)])).rows[0];
  if(!row||row.source_hash!==sourceHash||hash(source(row))!==sourceHash)fail('source');
  return {consignmentId:row.id,sourceHash:row.source_hash,itemId:row.item_id,grossPrice:Number(row.price),hostFee:Math.floor(Number(row.price)*Number(row.host_fee_bps)/10000),seller:{accountId:row.owner_account,characterId:row.owner_character},host:{accountId:row.host_account,characterId:row.host_character},expiresAt:new Date(row.expires_at).toISOString(),status:row.status,pickupDistrict:(await c.query('SELECT loc FROM characters WHERE id=$1',[row.host_character])).rows[0]?.loc};
}
export async function buyConsignmentWithEconomyContext(c,account,body,key,contexts){
  assertItemTransaction(c);try{const economy={contexts:economyContexts(contexts)};
    const receipt=await request(c,account,'buy',body,key,(terms,run)=>execute(c,account,terms,run,economy));
    if(!economy.proof)fail('fresh_sale_required');
    return {receipt,saleProof:economy.proof};
  }catch(error){poisonItemTransaction(c,error);throw error;}
}
async function economySaleBaseWitness(c,consignmentId){
  const row=(await c.query('SELECT * FROM consignments WHERE id=$1',[id(consignmentId)])).rows[0];
  if(!row||row.status!=='sold'||hash(source(row))!==row.source_hash||!row.buyer_character||!row.settlement)fail('sale_source');
  const receipt=row.settlement,fee=Math.floor(Number(row.price)*Number(row.host_fee_bps)/10000),paid=Number(receipt.paid);
  if(receipt.consignmentId!==row.id||receipt.itemId!==row.item_id||receipt.sourceHash!==row.source_hash||receipt.price!==Number(row.price)||receipt.hostFeeBps!==Number(row.host_fee_bps)||receipt.expiresAt!==new Date(row.expires_at).toISOString()||receipt.status!=='sold'||receipt.ok!==true||!integer(paid,fee,Number(row.price))||receipt.hostFee!==fee||!integer(receipt.condition,10,150)||(!receipt.loyalty&&paid!==Number(row.price)))fail('sale_source');
  const keys=['ok','consignmentId','sourceHash','price','hostFeeBps','expiresAt','status','itemId','paid','hostFee','condition','transactionIds',...(receipt.loyalty?['loyalty']:[])];
  if(!exact(receipt,keys))fail('sale_source');
  const actors=(await c.query('SELECT id,account_id,is_npc FROM characters WHERE id=$1 OR id=$2 OR id=$3',[row.owner_character,row.host_character,row.buyer_character])).rows;
  const buyer=actors.find(a=>a.id===row.buyer_character);if(actors.length!==3||actors.some(a=>a.is_npc)||actors.find(a=>a.id===row.owner_character)?.account_id!==row.owner_account||actors.find(a=>a.id===row.host_character)?.account_id!==row.host_account||!buyer||new Set(actors.map(a=>a.account_id)).size!==3)fail('sale_source');
  const legs=(await c.query("SELECT id,character_id,currency,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('consignment:purchase','consignment:proceeds','consignment:host_fee') ORDER BY reason",[row.id])).rows;
  const expected=[['consignment:host_fee',row.host_character,fee],['consignment:proceeds',row.owner_character,paid-fee],['consignment:purchase',row.buyer_character,-paid]];
  if(legs.length!==3||expected.some(([reason,actor,amount],i)=>legs[i]?.reason!==reason||legs[i]?.character_id!==actor||legs[i]?.currency!=='cash'||Number(legs[i]?.amount)!==amount)||!Array.isArray(receipt.transactionIds)||receipt.transactionIds.length!==3||new Set(receipt.transactionIds).size!==3||stable(receipt.transactionIds)!==stable([legs[2].id,legs[1].id,legs[0].id]))fail('sale_legs');
  const requests=(await c.query("SELECT run_id,account_id,original_character,receipt FROM consignment_requests WHERE receipt->>'consignmentId'=$1 AND receipt->>'status'='sold' ORDER BY key_hash LIMIT 2",[row.id])).rows;
  if(requests.length!==1||requests[0].account_id!==buyer.account_id||requests[0].original_character!==row.buyer_character||stable(requests[0].receipt)!==stable(receipt))fail('sale_receipt');
  const key='consignment:'+requests[0].run_id+':sale',guard=(await c.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1',[key])).rows[0];
  let result;try{result=JSON.parse(guard?.result_json);}catch{fail('sale_guard');}
  const requestHash=crypto.createHash('sha256').update(JSON.stringify({kind:'operation_action',owner:title(row.owner_account),request:{consignmentId:row.id,sourceHash:row.source_hash,buyerAccount:buyer.account_id,...(receipt.loyalty?{loyalty:loyaltyTerms(receipt.loyalty)}:{})}})).digest('hex');
  if(!guard?.completed_at||guard.request_hash!==requestHash||guard.mutation_kind!=='operation_action'||guard.owner_scope!=='account'||guard.owner_id!==row.owner_account||stable(result)!==stable(receipt))fail('sale_guard');
  const events=(await c.query("SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence",[key])).rows;
  if(events.length!==2||events[0].event_kind!=='released'||events[0].item_id!==row.item_id||events[0].template_id!==CONSIGNMENTS.templateId||events[0].from_owner_scope!=='operation'||events[0].from_owner_id!==row.id||events[0].to_owner_scope!=='account'||events[0].to_owner_id!==row.owner_account||events[0].reason!=='consignment original depositor sale release'||events[1].event_kind!=='transferred'||events[1].item_id!==row.item_id||events[1].template_id!==CONSIGNMENTS.templateId||events[1].from_owner_scope!=='account'||events[1].from_owner_id!==row.owner_account||events[1].to_owner_scope!=='account'||events[1].to_owner_id!==buyer.account_id||events[1].reason!=='consignment buyer title transfer')fail('sale_transfer');
  const witness={consignmentId:row.id,sourceHash:row.source_hash,itemId:row.item_id,grossPrice:Number(row.price),buyerPaid:paid,hostFee:fee,sellerPaid:paid-fee,seller:{accountId:row.owner_account,characterId:row.owner_character},host:{accountId:row.host_account,characterId:row.host_character},buyer:{accountId:buyer.account_id,characterId:row.buyer_character},transactionIds:receipt.transactionIds,mutationKey:key,mutationId:guard.mutation_id,releaseEventId:events[0].id,transferEventId:events[1].id,observedAt:new Date(guard.completed_at).toISOString(),receipt:structuredClone(receipt)};
  return witness;
}
export async function consignmentEconomySaleWitness(c,consignmentId){
  const witness=await economySaleBaseWitness(c,consignmentId);
  if(witness.receipt.loyalty){const row=(await c.query('SELECT * FROM consignments WHERE id=$1',[consignmentId])).rows[0];await (await import('./merchantloyalty.js')).verifyMerchantLoyaltySale(c,row,witness);}
  return witness;
}
export async function assertFreshConsignmentSaleProof(c,proof,contexts){
  assertItemTransaction(c);const p=freshEconomySales.get(proof),expected=economyContexts(contexts);
  if(!p||p.used||p.c!==c||p.transaction!==itemTransactionIdentity(c)||Object.keys(expected).sort().join(',')!==Object.keys(p.contexts).sort().join(',')||Object.keys(expected).some(k=>expected[k]!==p.contexts[k])||!await ownsItemMutationReservation(c,p.key))fail('fresh_sale_proof');
  const witness=await economySaleBaseWitness(c,p.consignmentId);
  if(witness.mutationKey!==p.key||witness.mutationId!==p.mutationId||stable(witness.receipt)!==stable(p.receipt))fail('fresh_sale_proof');
  if(expected.attributionContext)await (await import('./saleattribution.js')).assertSaleAttributionPurchaseScope(c,expected.attributionContext,witness.consignmentId,witness.sourceHash,witness.buyer.accountId);
  if(!!expected.loyaltyContext!==!!witness.receipt.loyalty)fail('fresh_sale_pricing');
  if(expected.loyaltyContext){const pricing=await (await import('./merchantloyalty.js')).assertMerchantLoyaltyPurchaseScope(c,expected.loyaltyContext,witness.consignmentId,witness.sourceHash,witness.buyer.accountId);if(pricing.buyerPaid!==witness.buyerPaid||pricing.hostFee!==witness.hostFee||pricing.sellerPaid!==witness.sellerPaid||stable(pricing.loyalty)!==stable(witness.receipt.loyalty))fail('fresh_sale_pricing');}
  const item=(await c.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[witness.itemId])).rows[0];
  if(item?.owner_scope!=='account'||item.owner_id!==witness.buyer.accountId||item.state!=='active')fail('fresh_sale_custody');
  p.used=true;return witness;
}

// Separate fixed-purpose N18 leaf. No advertising, loyalty, courier or generic pricing capability.
const freshBasketSales=new WeakMap();
export async function buyConsignmentWithBasketContext(c,account,body,key,context){
  assertItemTransaction(c);try{if(!context||typeof context!=='object')fail('basket_context');const basket={context};
    const receipt=await request(c,account,'buy',body,key,(terms,run)=>execute(c,account,terms,run,null,basket));
    if(!basket.proof)fail('fresh_basket_sale_required');return {receipt,saleProof:basket.proof};
  }catch(error){poisonItemTransaction(c,error);throw error;}
}
export async function assertFreshConsignmentBasketProof(c,proof,context){
  assertItemTransaction(c);const p=freshBasketSales.get(proof);
  if(!p||p.used||p.client!==c||p.transaction!==itemTransactionIdentity(c)||p.context!==context||!await ownsItemMutationReservation(c,p.key))fail('fresh_basket_sale_proof');
  const witness=await consignmentEconomySaleWitness(c,p.consignmentId);
  if(witness.receipt.loyalty||witness.buyerPaid!==witness.grossPrice||witness.mutationKey!==p.key||witness.mutationId!==p.mutationId||stable(witness.receipt)!==stable(p.receipt))fail('fresh_basket_sale_proof');
  await (await import('./shoppingbasket.js')).assertShoppingBasketPurchaseScope(c,context,witness.consignmentId,witness.sourceHash,witness.buyer.accountId);
  const item=(await c.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[witness.itemId])).rows[0];
  if(item?.owner_scope!=='account'||item.owner_id!==witness.buyer.accountId||item.state!=='active')fail('fresh_basket_sale_custody');p.used=true;return witness;
}
