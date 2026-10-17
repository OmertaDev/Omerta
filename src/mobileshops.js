// Temporary, seller-present GIN listings. Market remains the sole cargo/cash authority.
import crypto from 'node:crypto';
import * as G from './game.js';
import * as M from './market.js';
import { GOODS, BLACK_MARKET as MARKET } from './rules.js';
import { dbCaps } from './db.js';
import { withItemRead, assertItemRead, assertItemTransaction, itemTransactionIdentity, poisonItemTransaction } from './items.js';
import { assertEstateResolutionScope } from './social/estate.js';

export const MOBILE_SHOPS = Object.freeze({ good: 'gin', maximumQuantity: 10, maximumGross: 1000000, minimumSeconds: 60, maximumSeconds: 3600, hookRevision: 'mobile_shop_market_v1' });
const scopes = new WeakMap();
const fail = reason => { throw new G.GameError('mobile_shop_'+reason, reason); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const identity = v => { if (typeof v !== 'string' || !/^[!-~]{1,128}$/.test(v)) fail('identity'); return v; };
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const clock = async c => new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const sourceHash = r => hash([r.id,r.seller_character,r.seller_account,r.listing_id,r.district,'gin',Number(r.initial_quantity),Number(r.unit_price),new Date(r.expires_at).toISOString(),new Date(r.listing_expires_at).toISOString()]);
export function mobileShopTerms(action, body) {
  if (action === 'open') {
    if (!exact(body, ['quantity','unitPrice','lifetimeSeconds','consent']) || body.consent !== true
      || !integer(body.quantity,1,10) || !integer(body.unitPrice,1,1000000) || body.quantity * body.unitPrice > 1000000
      || !integer(body.lifetimeSeconds,60,3600)) fail('terms');
    return { action, quantity:body.quantity, unitPrice:body.unitPrice, lifetimeSeconds:body.lifetimeSeconds, consent:true };
  }
  if (!['buy','close','expire'].includes(action) || !exact(body, action === 'buy' ? ['shopId','sourceHash','quantity','consent'] : ['shopId','sourceHash','consent'])
    || body.consent !== true || !/^[a-f0-9]{64}$/.test(body.sourceHash ?? '') || (action === 'buy' && !integer(body.quantity,1,10))) fail('terms');
  return { action, shopId:identity(body.shopId), sourceHash:body.sourceHash, ...(action === 'buy' ? { quantity:body.quantity } : {}), consent:true };
}
async function replay(c, account, keyHash, bodyHash) {
  const r=(await c.query('SELECT body_hash,receipt FROM mobile_shop_requests WHERE account_id=$1 AND key_hash=$2',[account,keyHash])).rows[0];
  if (!r) return null;
  if (r.body_hash !== bodyHash) fail('request_conflict');
  if (!r.receipt) fail('in_progress');
  return r.receipt;
}
function dto(r) {
  return { shopId:r.id, sellerCharacterId:r.seller_character, listingId:r.listing_id, district:r.district,
    good:'gin', initialQuantity:Number(r.initial_quantity), remainingQuantity:Number(r.remaining_quantity), unitPrice:Number(r.unit_price),
    sourceHash:r.source_hash, expiresAt:new Date(r.expires_at).toISOString(), status:r.status };
}
export async function mobileShopListingReference(c,listingId){
  assertItemRead(c);identity(listingId);
  const row=(await c.query('SELECT id,source_hash FROM mobile_shops WHERE listing_id=$1',[listingId])).rows[0];
  return row?{shopId:row.id,sourceHash:row.source_hash}:null;
}
export async function mobileShopBoard(c, after='') {
  if (typeof after !== 'string' || after.length > 128) fail('cursor');
  const now=await clock(c);
  const rows=(await c.query('SELECT * FROM mobile_shops WHERE id>$1 ORDER BY id LIMIT 21',[after])).rows;
  const shops=[];
  for (const r of rows.slice(0,20)) {
    const seller=(await c.query('SELECT alive,loc FROM characters WHERE id=$1',[r.seller_character])).rows[0];
    const account=(await c.query('SELECT status FROM accounts WHERE id=$1',[r.seller_account])).rows[0];
    const listing=(await c.query('SELECT status,qty,price,expires_at,district,good_id,seller_character FROM market_listings WHERE id=$1',[r.listing_id])).rows[0];
    shops.push({ ...dto(r), available:r.status==='active' && account?.status==='active' && r.source_hash===sourceHash(r) && new Date(r.expires_at)>now && seller?.alive===true && seller.loc===r.district && listing?.status==='live'
      && listing.good_id==='gin' && listing.seller_character===r.seller_character && listing.district===r.district && Number(listing.price)===Number(r.unit_price)
      && new Date(listing.expires_at).getTime()===new Date(r.listing_expires_at).getTime() && Number(listing.qty)===Number(r.remaining_quantity) });
  }
  return { shops, next:rows.length>20 ? rows[19].id : null };
}
// Shared Market must call this BEFORE any source write, after real original actors are locked.
// A direct Market caller cannot reuse an HTTP key, actor string, or copied scope as authority.
export async function assertMobileShopMarketAdmission(c, { action, listingId=null }) {
  const linked=listingId ? (await c.query('SELECT * FROM mobile_shops WHERE listing_id=$1',[listingId])).rows[0] : null;
  let s;
  // Ordinary unrelated Market callers retain their existing transaction contract.
  // Only absence of an Items scope is tolerated here; linked sources still fail closed.
  try { s=scopes.get(itemTransactionIdentity(c)); } catch(e) { if(linked)throw e; }
  if (!linked && !(s && s.action==='open' && action==='list_good')) return;
  assertItemTransaction(c);
  if (!s || s.c !== c || s.marketAction!==action || (linked && s.shopId!==linked.id)) fail('canonical_scope');
  if (s.admitted) fail('duplicate_admission');
  if (linked) {
    const r=(await c.query('SELECT * FROM mobile_shops WHERE id=$1 FOR UPDATE',[linked.id])).rows[0];
    const seller=(await c.query('SELECT id,account_id,alive,loc FROM characters WHERE id=$1',[r.seller_character])).rows[0];
    if (r.source_hash!==s.sourceHash || r.source_hash!==sourceHash(r) || r.status!=='active' || !seller?.alive || seller.account_id!==r.seller_account) fail('source_changed');
    const l=(await c.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE',[listingId])).rows[0];
    if (!l || l.kind!=='good' || l.good_id!=='gin' || l.seller_character!==r.seller_character || l.district!==r.district
      || Number(l.price)!==Number(r.unit_price) || Number(l.qty)!==Number(r.remaining_quantity) || new Date(l.expires_at).getTime()!==new Date(r.listing_expires_at).getTime() || !['live','expired'].includes(l.status)) fail('source_changed');
    const now=await clock(c);
    if (action==='buy_good' && (new Date(r.expires_at)<=now || seller.loc!==r.district)) fail('unavailable');
    if (s.action==='expire' && new Date(r.expires_at)>now) fail('not_expired');
    if (action==='buy_good' && l.status!=='live') fail('unavailable');
  }
  s.admitted=true;
}
// Canonical cancel/sweep/estate calls this AFTER its terminal transition. Never gates recovery.
// estate source must be captured before canonical DELETE; it is not a new cargo recovery claim.
export async function retireMobileShopSource(c, listingId, disposition, estateScope=null) {
  const shop=(await c.query('SELECT seller_character FROM mobile_shops WHERE listing_id=$1',[listingId])).rows[0];
  if(!shop)return;
  assertItemTransaction(c);
  if (!['cancelled','sold','estate_scattered'].includes(disposition)) fail('terminal_source');
  const source=(await c.query('SELECT status FROM market_listings WHERE id=$1',[listingId])).rows[0];
  if(disposition==='estate_scattered'){
    await assertEstateResolutionScope(c,shop.seller_character,estateScope);
  }
  if (disposition==='estate_scattered' ? !!source : source?.status!==disposition) fail('terminal_source');
  await c.query("UPDATE mobile_shops SET status=$2 WHERE listing_id=$1 AND status='active'",[listingId,disposition]);
}
async function execute(c, ch, seller, h, account, terms, keyHash, bodyHash,eventToken=null) {
  assertItemTransaction(c);
  const old=await replay(c,account,keyHash,bodyHash); if(old)return old;
  if (!ch.alive || ch.is_npc || ch.account_id!==account || (seller && (!seller.alive || seller.is_npc || seller.account_id===account))) fail('original_actor');
  // Real Game prelock already holds the original parties' account mutexes.
  for(const actor of [ch,...(seller?[seller]:[])])if((await c.query('SELECT status FROM accounts WHERE id=$1',[actor.account_id])).rows[0]?.status!=='active')fail('account');
  const scope={c,action:terms.action,marketAction:terms.action==='open'?'list_good':terms.action==='buy'?'buy_good':'cancel_good',admitted:false,shopId:terms.shopId,sourceHash:terms.sourceHash};
  const tx=itemTransactionIdentity(c); if(scopes.has(tx))fail('nested_scope'); scopes.set(tx,scope);
  try {
    let row, canonical;
    const witnesses=[];
    const mh={...h,ledger:async(client,event)=>G.ledger(client,event,{beforeInsert:id=>{witnesses.push({id,event});}})};
    if(terms.action==='open') {
      if(!GOODS.some(g=>g.id==='gin'))fail('unsupported_good');
      if((await c.query("SELECT id FROM mobile_shops WHERE seller_character=$1 AND status='active' ORDER BY id LIMIT 1",[ch.id])).rows.length)fail('active_shop');
      const before=Number(h.owned.cargo.gin||0);
      canonical=await M.listItem(ch,{kind:'good',goodId:'gin',qty:terms.quantity,price:terms.unitPrice,hours:1},c,mh);
      if(!scope.admitted)fail('missing_market_hook');
      const l=(await c.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE',[canonical.id])).rows[0], observed=await clock(c);
      if(!l || l.seller_character!==ch.id || l.good_id!=='gin' || Number(l.qty)!==terms.quantity || before-Number(h.owned.cargo.gin||0)!==terms.quantity)fail('source_changed');
      const expires=new Date(Math.min(observed.getTime()+terms.lifetimeSeconds*1000,new Date(l.expires_at).getTime()));
      if(expires<=observed)fail('expired');
      const sid=crypto.randomUUID(), frozen={id:sid,seller_character:ch.id,seller_account:account,listing_id:l.id,district:l.district,initial_quantity:terms.quantity,unit_price:terms.unitPrice,expires_at:expires,listing_expires_at:l.expires_at};
      await c.query("INSERT INTO mobile_shops(id,seller_account,seller_character,listing_id,district,initial_quantity,remaining_quantity,unit_price,source_hash,expires_at,listing_expires_at,status) VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,'active')",[sid,account,ch.id,l.id,l.district,terms.quantity,terms.unitPrice,sourceHash(frozen),expires,l.expires_at]);
      row=(await c.query('SELECT * FROM mobile_shops WHERE id=$1',[sid])).rows[0];
    } else {
      row=(await c.query('SELECT * FROM mobile_shops WHERE id=$1',[terms.shopId])).rows[0];
      if(!row || row.source_hash!==terms.sourceHash || (terms.action!=='buy' && row.seller_character!==ch.id) || (terms.action==='buy' && row.seller_character!==seller?.id))fail('source_changed');
      if(terms.action==='buy') {
        await(await Event()).assertEventMarketIngress(c,account,'gin',row.id,eventToken);
        const cargoBefore=Number(h.owned.cargo.gin||0), remainingBefore=Number(row.remaining_quantity);
        const before=(await c.query('SELECT cash FROM characters WHERE id=$1',[seller.id])).rows[0];
        canonical=await M.buyListing(ch,row.listing_id,terms.quantity,c,mh);
        const after=(await c.query('SELECT cash FROM characters WHERE id=$1',[seller.id])).rows[0];
        const take=Math.ceil(Number(canonical.paid)*MARKET.TAKE_BPS/10000);
        if(!integer(canonical.qty,1,terms.quantity) || Number(canonical.paid)!==canonical.qty*Number(row.unit_price)
          || cargoBefore+canonical.qty!==Number(h.owned.cargo.gin) || remainingBefore-canonical.qty!==Number(canonical.remaining)
          || Number(after.cash)-Number(before.cash)!==Number(canonical.paid)-take)fail('sale_witness');
        seller.cash=Number(seller.cash)+Number(after.cash)-Number(before.cash);
        await c.query('UPDATE mobile_shops SET remaining_quantity=$2 WHERE id=$1',[row.id,canonical.remaining]);
      } else canonical=await M.cancelListing(ch,row.listing_id,c,mh);
      if(!scope.admitted)fail('missing_market_hook');
      row=(await c.query('SELECT * FROM mobile_shops WHERE id=$1',[row.id])).rows[0];
      if(terms.action!=='buy' && row.status!=='cancelled')fail('missing_terminal_hook');
      if(terms.action==='buy' && Number(canonical.remaining)===0 && row.status!=='sold')fail('missing_terminal_hook');
      if(terms.action==='buy' && new Date(row.expires_at)<=await clock(c))fail('expired_after_wait');
    }
    const expected=terms.action==='open'?['market:list']:terms.action==='buy'?['market:bid','market:sale','market:take']:[];
    if(witnesses.map(w=>w.event.reason).join(',')!==expected.join(','))fail('journal_witness');
    if(terms.action==='buy'){
      const take=Math.ceil(canonical.paid*MARKET.TAKE_BPS/10000), amounts=[-canonical.paid,canonical.paid-take,-take];
      if(witnesses.some((w,i)=>Number(w.event.amount)!==amounts[i]))fail('journal_witness');
    }
    for(const w of witnesses){const actual=(await c.query('SELECT character_id,currency,amount,reason FROM transactions WHERE id=$1',[w.id])).rows[0];if(!actual || actual.reason!==w.event.reason || actual.currency!=='cash' || Number(actual.amount)!==Number(w.event.amount) || (actual.character_id??null)!==(w.event.characterId??null))fail('journal_witness');}
    const receipt={ok:true,action:terms.action,shop:dto(row),...(terms.action==='buy'?{quantity:canonical.qty,paid:canonical.paid}:{}),...(terms.action==='open'?{listingFee:canonical.fee}:{}),...(terms.action==='close'||terms.action==='expire'?{returnedQuantity:canonical.qty}: {})};
    await c.query('INSERT INTO mobile_shop_requests(account_id,key_hash,body_hash,original_character,shop_id,receipt,journal_ids) VALUES($1,$2,$3,$4,$5,$6,$7)',[account,keyHash,bodyHash,ch.id,row.id,receipt,JSON.stringify(witnesses.map(w=>w.id))]);
    return receipt;
  } catch(e){poisonItemTransaction(c,e);throw e;} finally { scopes.delete(tx); }
}
export async function runMobileShop(pool,account,action,body,key) {
  identity(account);identity(key);const terms=mobileShopTerms(action,body), keyHash=hash([account,key]), bodyHash=hash(terms);
  const old=await withItemRead(pool,c=>replay(c,account,keyHash,bodyHash));if(old)return old;
  // Existing Market does not register pg-mem compensation. Never claim its partial writes atomic.
  if(!dbCaps.skipLocked)fail('transactional_backend_required');
  if(M.mobileShopHookRevision!==MOBILE_SHOPS.hookRevision)fail('canonical_hooks_required');
  if(action==='buy'){
    const source=await withItemRead(pool,async c=>(await c.query('SELECT seller_character FROM mobile_shops WHERE id=$1',[terms.shopId])).rows[0]);
    if(!source)fail('source_changed');
    const {character,...receipt}=await G.withTwoCharacters(pool,account,source.seller_character,(ch,seller,c,h)=>execute(c,ch,seller,h,account,terms,keyHash,bodyHash),{meet:false});
    return receipt;
  }
  const {character,...receipt}=await G.withCharacter(pool,account,(ch,c,h)=>execute(c,ch,null,h,account,terms,keyHash,bodyHash));
  return receipt;
}
// Private full-book oracle, not a public board or current execution authority.
export async function collectMobileShopIssues(c){
  const issues=[],shops=(await c.query('SELECT * FROM mobile_shops ORDER BY id')).rows;
  for(const r of shops){
    const bad=reason=>issues.push({shopId:r.id,reason});
    if(r.source_hash!==sourceHash(r))bad('source_hash');
    const requests=(await c.query('SELECT * FROM mobile_shop_requests WHERE shop_id=$1 ORDER BY key_hash',[r.id])).rows;
    let sold=0,opens=0,returns=0;
    for(const q of requests){
      const p=q.receipt,actor=(await c.query('SELECT account_id FROM characters WHERE id=$1',[q.original_character])).rows[0];
      if(!p||p.shop?.shopId!==r.id||p.shop.sourceHash!==r.source_hash||actor?.account_id!==q.account_id){bad('receipt_identity');continue;}
      const ids=q.journal_ids;if(!Array.isArray(ids)||new Set(ids).size!==ids.length){bad('journal_identity');continue;}
      let legs=[];
      if(p.action==='open'){
        opens++;if(q.account_id!==r.seller_account||q.original_character!==r.seller_character||!integer(p.listingFee,0,1000000))bad('open');
        legs=[{reason:'market:list',character:r.seller_character,amount:-p.listingFee}];
      }else if(p.action==='buy'){
        if(q.account_id===r.seller_account||!integer(p.quantity,1,10)||p.paid!==p.quantity*Number(r.unit_price))bad('sale');
        sold+=Number(p.quantity);const take=Math.ceil(Number(p.paid)*MARKET.TAKE_BPS/10000);
        legs=[{reason:'market:bid',character:q.original_character,amount:-p.paid},{reason:'market:sale',character:r.seller_character,amount:p.paid-take},{reason:'market:take',character:null,amount:-take}];
      }else if(['close','expire'].includes(p.action)){
        returns++;if(q.account_id!==r.seller_account||q.original_character!==r.seller_character||Number(p.returnedQuantity)!==Number(r.remaining_quantity))bad('return');
      }else bad('receipt_action');
      if(ids.length!==legs.length)bad('journal_count');
      for(let n=0;n<ids.length;n++){
        const leg=legs[n],actual=(await c.query('SELECT character_id,currency,amount,reason FROM transactions WHERE id=$1',[ids[n]])).rows[0];
        if(!leg||!actual||actual.currency!=='cash'||actual.reason!==leg.reason||(actual.character_id??null)!==leg.character||Number(actual.amount)!==leg.amount)bad('journal_leg');
      }
    }
    if(opens!==1||sold+Number(r.remaining_quantity)!==Number(r.initial_quantity))bad('quantity_history');
    const listing=(await c.query('SELECT * FROM market_listings WHERE id=$1',[r.listing_id])).rows[0];
    if(r.status==='active'&&(!listing||!['live','expired'].includes(listing.status)||listing.seller_character!==r.seller_character||listing.good_id!=='gin'||listing.district!==r.district||Number(listing.price)!==Number(r.unit_price)||Number(listing.qty)!==Number(r.remaining_quantity)))bad('active_source');
    if(r.status==='sold'&&(Number(r.remaining_quantity)!==0||returns!==0))bad('sold');
    if(r.status==='cancelled'&&returns!==1)bad('cancelled');
    if(r.status==='estate_scattered'){
      const original=(await c.query('SELECT alive FROM characters WHERE id=$1',[r.seller_character])).rows[0];
      if(listing||original?.alive!==false||returns!==0)bad('estate_source');
    }
  }
  return issues;
}

// Fixed N19 completion leaves. Opaque roots originate only in the actual two-party G callback.
export const eventMarketHookRevision='event_market_v1';
const eventVisitRoots=new WeakMap(),eventVisitProofs=new WeakMap(),eventVisitResults=new WeakMap();
const Event=()=>import('./eventmarkets.js');
export async function eventShopReference(c,shopId,digest){assertItemTransaction(c);return eventShopHistoryReference(c,shopId,digest);}
export async function eventShopHistoryReference(c,shopId,digest){
  const r=(await c.query('SELECT * FROM mobile_shops WHERE id=$1',[identity(shopId)])).rows[0];
  if(!r||r.source_hash!==digest||sourceHash(r)!==digest||(await collectMobileShopIssues(c)).some(x=>x.shopId===r.id))fail('event_source');
  return{shopId:r.id,sourceHash:r.source_hash,listingId:r.listing_id,district:r.district,seller:{accountId:r.seller_account,characterId:r.seller_character},initialQuantity:Number(r.initial_quantity),remainingQuantity:Number(r.remaining_quantity),expiresAt:new Date(r.expires_at).toISOString(),state:r.status};
}
export async function assertEventVisitRoot(c,issuer){assertItemTransaction(c);const s=eventVisitRoots.get(issuer);if(!s?.active||s.c!==c||s.transaction!==itemTransactionIdentity(c))fail('event_root');return s;}
export async function eventShopSaleWitness(c,account,keyHash){
  const q=(await c.query('SELECT * FROM mobile_shop_requests WHERE account_id=$1 AND key_hash=$2',[account,keyHash])).rows[0],p=q?.receipt;
  if(!q||p?.action!=='buy'||p.ok!==true||p.quantity!==1||!Array.isArray(q.journal_ids)||q.journal_ids.length!==3||new Set(q.journal_ids).size!==3)fail('event_sale');
  const r=(await c.query('SELECT * FROM mobile_shops WHERE id=$1',[q.shop_id])).rows[0];if(!r||r.source_hash!==sourceHash(r)||p.shop.shopId!==r.id||p.shop.sourceHash!==r.source_hash||p.shop.listingId!==r.listing_id||p.paid!==Number(r.unit_price)||p.shop.initialQuantity!==Number(r.initial_quantity)||p.shop.unitPrice!==Number(r.unit_price)||p.shop.district!==r.district||p.shop.sellerCharacterId!==r.seller_character||p.shop.good!=='gin'||!integer(p.shop.remainingQuantity,0,Number(r.initial_quantity)-1))fail('event_sale');
  const buyer=(await c.query('SELECT id,account_id,is_npc FROM characters WHERE id=$1',[q.original_character])).rows[0],seller=(await c.query('SELECT id,account_id,is_npc FROM characters WHERE id=$1',[r.seller_character])).rows[0];if(!buyer||!seller||buyer.is_npc||seller.is_npc||buyer.account_id!==account||seller.account_id!==r.seller_account||buyer.account_id===seller.account_id)fail('event_sale');
  const take=Math.ceil(p.paid*MARKET.TAKE_BPS/10000),expected=[['market:bid',buyer.id,-p.paid],['market:sale',seller.id,p.paid-take],['market:take',null,-take]],legs=[];
  for(let i=0;i<3;i++){const x=(await c.query('SELECT * FROM transactions WHERE id=$1',[q.journal_ids[i]])).rows[0],e=expected[i];if(!x||x.reason!==e[0]||(x.character_id??null)!==e[1]||x.currency!=='cash'||Number(x.amount)!==e[2]||x.account_id!==null)fail('event_sale');legs.push(x);}
  if(q.body_hash!==hash(mobileShopTerms('buy',{shopId:r.id,sourceHash:r.source_hash,quantity:1,consent:true})))fail('event_sale');
  return{shopId:r.id,sourceHash:r.source_hash,listingId:r.listing_id,keyHash,quantity:1,paid:p.paid,remainingQuantity:p.shop.remainingQuantity,buyer:{accountId:account,characterId:buyer.id},seller:{accountId:r.seller_account,characterId:seller.id},transactionIds:q.journal_ids,observedAt:new Date(Math.max(...legs.map(x=>+new Date(x.at)))).toISOString()};
}
export async function assertFreshEventShopSale(c,proof,token){assertItemTransaction(c);const s=eventVisitProofs.get(proof);if(!s||s.used||s.c!==c||s.transaction!==itemTransactionIdentity(c)||s.token!==token)fail('event_sale_proof');await(await Event()).assertEventShopScope(c,token);const w=await eventShopSaleWitness(c,s.account,s.keyHash);if(JSON.stringify(w)!==JSON.stringify(s.witness))fail('event_sale_proof');s.used=true;return w;}
export async function runEventShopVisit(pool,account,body,key){
  if(!dbCaps.skipLocked)fail('transactional_backend_required');if(M.mobileShopHookRevision!==MOBILE_SHOPS.hookRevision)fail('canonical_hooks_required');const E=await Event(),d=await withItemRead(pool,c=>E.eventMarketVisitDescriptor(c,account,body,key));if(d.prior)return d.prior;
  const{character,...receipt}=await G.withTwoCharacters(pool,account,d.sellerCharacter,async(buyer,seller,c,h)=>{
    const issuer=Object.freeze({}),s={active:true,c,transaction:itemTransactionIdentity(c),account,input:d.input,key,buyer,seller};eventVisitRoots.set(issuer,s);
    try{const token=await E.beginEventShopVisit(c,issuer),terms=mobileShopTerms('buy',{shopId:d.shopId,sourceHash:d.shopHash,quantity:1,consent:true}),keyHash=hash([account,'event-visit:'+key]),before=Number(h.owned.cargo.gin||0),buyerCash=Number(buyer.cash),sellerCash=Number(seller.cash);
      const sale=await execute(c,buyer,seller,h,account,terms,keyHash,hash(terms),token);const witness=await eventShopSaleWitness(c,account,keyHash);if(Number(h.owned.cargo.gin||0)!==before+1||Number(buyer.cash)!==buyerCash-sale.paid||Number(seller.cash)!==sellerCash+sale.paid-Math.ceil(sale.paid*MARKET.TAKE_BPS/10000))fail('event_cargo');
      const proof=Object.freeze({});eventVisitProofs.set(proof,{c,transaction:itemTransactionIdentity(c),token,account,keyHash,witness,used:false});const result=await E.recordEventShopVisit(c,token,proof);eventVisitResults.set(result,{c,transaction:itemTransactionIdentity(c),issuer,token,buyer,seller,cargo:before+1,buyerCash:Number(buyer.cash),sellerCash:Number(seller.cash)});return result;
    }catch(e){s.active=false;poisonItemTransaction(c,e);throw e;}
  },{meet:false});return receipt;
}
// Ordinary G calls this fixed leaf after both real character/cargo/account ACKs. Unbranded results no-op.
export async function finalizeEventVisitPair(c,result){const s=eventVisitResults.get(result);if(!s)return;try{assertItemTransaction(c);if(s.c!==c||s.transaction!==itemTransactionIdentity(c))fail('event_completion');await assertEventVisitRoot(c,s.issuer);const cargo=(await c.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'",[s.buyer.id])).rows[0];for(const[a,cash]of[[s.buyer,s.buyerCash],[s.seller,s.sellerCash]]){const row=(await c.query('SELECT cash,alive,account_id FROM characters WHERE id=$1',[a.id])).rows[0];if(!row?.alive||row.account_id!==a.account_id||Number(row.cash)!==cash)fail('event_completion');}if(Number(cargo?.qty||0)!==s.cargo)fail('event_cargo');await(await Event()).finishEventShopVisit(c,s.token,result);}catch(e){poisonItemTransaction(c,e);throw e;}finally{eventVisitResults.delete(result);const r=eventVisitRoots.get(s.issuer);if(r)r.active=false;}}
