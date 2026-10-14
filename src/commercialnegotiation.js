import crypto from 'node:crypto';
import { GameError } from './game.js';
import { acceptDelivery, DELIVERY } from './delivery.js';
import { latestPolicy, guardDelegatedControl } from './operatingpolicy.js';

export const COMMERCIAL_NEGOTIATION=Object.freeze({maxRounds:3,maxActive:3,maxSeconds:3600});
export const commercialNegotiationDDL=`CREATE TABLE IF NOT EXISTS commercial_negotiations (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, depot_id TEXT NOT NULL,
 buyer_account TEXT NOT NULL REFERENCES accounts(id), supplier_account TEXT NOT NULL REFERENCES accounts(id),
 buyer_character TEXT NOT NULL REFERENCES characters(id), supplier_character TEXT NOT NULL REFERENCES characters(id),
 revision INT NOT NULL CHECK(revision BETWEEN 1 AND 3), last_offer_character TEXT NOT NULL REFERENCES characters(id),
 terms JSONB NOT NULL, terms_hash TEXT NOT NULL, source_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('offered','accepted','withdrawn','expired')),
 expires_at TIMESTAMPTZ NOT NULL, delivery_deadline TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL,
 commitment_id TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS commercial_negotiation_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL, identity TEXT NOT NULL, receipt JSONB NOT NULL,
 PRIMARY KEY(account_id,request_key));`;
const fail=reason=>{const e=new GameError('commercial_negotiation',reason);e.reason=reason;throw e;};
const id=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v))fail('identity');return v;};
const requestKey=v=>{if(typeof v!=='string'||!/^[!-~]{1,128}$/.test(v))fail('identity');return v;};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==keys)fail('terms');};
const integer=(v,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail('terms');return v;};
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v,(_,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value)).digest('hex');
const offerHash=(r,t=r.terms,revision=r.revision,last=r.last_offer_character)=>hash([r.id,r.order_id,r.depot_id,r.buyer_account,r.supplier_account,r.buyer_character,r.supplier_character,new Date(r.delivery_deadline).toISOString(),new Date(r.expires_at).toISOString(),r.source_hash,revision,last,t]);
const actor=ch=>{if(!ch?.alive||ch.is_npc||!ch.account_id)fail('actor');return id(ch.account_id);};
const terms=v=>{exact(v,'deadlineSeconds,maxProcurementCash,qty,unitPrice');return {qty:integer(v.qty,1,DELIVERY.maxUnits),unitPrice:integer(v.unitPrice,50,1000000),maxProcurementCash:integer(v.maxProcurementCash,1,DELIVERY.maxSpend),deadlineSeconds:integer(v.deadlineSeconds,120,DELIVERY.maxSeconds)};};
const clock=async c=>+new Date((await c.query('SELECT clock_timestamp() AS at')).rows[0].at);
async function replay(c,account,key,identity){requestKey(key);const r=(await c.query('SELECT identity,receipt FROM commercial_negotiation_requests WHERE account_id=$1 AND request_key=$2',[account,key])).rows[0];if(!r)return null;if(r.identity!==identity)fail('request_conflict');return r.receipt;}
async function activeAccounts(c,a,b){const rows=(await c.query('SELECT id,status FROM accounts WHERE id=$1 OR id=$2',[a,b])).rows;if(rows.length!==2||rows.some(r=>r.status!=='active'))fail('party_account');}
async function save(c,account,key,identity,receipt){await c.query('INSERT INTO commercial_negotiation_requests(account_id,request_key,identity,receipt) VALUES($1,$2,$3,$4)',[account,key,identity,JSON.stringify(receipt)]);return receipt;}
const view=r=>({id:r.id,orderId:r.order_id,depotId:r.depot_id,buyerCharacter:r.buyer_character,supplierCharacter:r.supplier_character,revision:Number(r.revision),state:r.state,terms:r.terms,termsHash:r.terms_hash,lastOfferCharacter:r.last_offer_character,expiresAt:new Date(r.expires_at).toISOString(),deliveryDeadline:new Date(r.delivery_deadline).toISOString(),commitmentId:r.commitment_id||null,gameCashOnly:true,priceRule:'existing_funded_order_fixed_unit_price',deadlineRule:'fixed_at_original_offer',negotiableFields:['qty','maxProcurementCash'],acceptancePaysNothing:true});
async function source(c,orderId,depotId,buyerId,requireLive=true){
 const d=(await c.query('SELECT id,owner_character,status,created_at FROM business_depots WHERE id=$1 FOR UPDATE',[depotId])).rows[0];
 const policy=await latestPolicy(c,depotId,true);
 const o=(await c.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
 if(!d||d.status!=='open'||d.owner_character!==buyerId||!o||o.depot_id!==d.id||o.seller_character!==buyerId||o.good_id!=='gin'||o.kind!=='order'||(requireLive&&o.status!=='live'))fail('source');
 const j=(await c.query("SELECT id,reason,cash_delta,created_at FROM business_depot_journal WHERE depot_id=$1 AND order_id=$2 AND reason IN ('restock_escrow','restock_fee') ORDER BY reason,id",[d.id,o.id])).rows,now=await clock(c);
 const backing=j.filter(r=>r.reason==='restock_escrow'),fee=j.filter(r=>r.reason==='restock_fee');
 if(backing.length!==1||fee.length!==1||!Number.isSafeInteger(-Number(backing[0].cash_delta))||-Number(backing[0].cash_delta)<Number(o.qty)*Number(o.price)||!Number.isSafeInteger(-Number(fee[0].cash_delta))||Number(fee[0].cash_delta)>=0||j.some(r=>+new Date(r.created_at)<+new Date(o.created_at)||+new Date(r.created_at)<+new Date(d.created_at)||+new Date(r.created_at)>now))fail('funding');
 return {order:o,sourceHash:hash([d.id,d.owner_character,new Date(d.created_at).toISOString(),o.id,o.seller_character,o.depot_id,o.good_id,o.kind,o.district,Number(o.price),new Date(o.created_at).toISOString(),new Date(o.expires_at).toISOString(),j,policy?[policy.id,Number(policy.revision),policy.enabled,new Date(policy.expires_at).toISOString()]:null])};
}
function party(r,ch,other){actor(ch);actor(other);if(ch.id===other.id||ch.account_id===other.account_id)fail('party');const ids=[r.buyer_character,r.supplier_character];if(!ids.includes(ch.id)||!ids.includes(other.id)||ch.account_id!==(ch.id===r.buyer_character?r.buyer_account:r.supplier_account)||other.account_id!==(other.id===r.buyer_character?r.buyer_account:r.supplier_account))fail('party');}
function validSource(o,t,deadline,now){if(Number(o.price)!==t.unitPrice||Number(o.qty)<t.qty||+new Date(o.expires_at)<deadline||deadline-now<60000)fail('source_changed');}
export function commercialNegotiationCreateTarget(body){exact(body,'expiresInSeconds,orderId,supplierCharacter,terms');id(body.orderId);terms(body.terms);integer(body.expiresInSeconds,60,COMMERCIAL_NEGOTIATION.maxSeconds);return id(body.supplierCharacter);}

// Caller locks both canonical characters/accounts before depot, order, then negotiation.
export async function createCommercialNegotiation(ch,supplier,body,key,c,agentCredential=false){
 commercialNegotiationCreateTarget(body);const account=actor(ch);actor(supplier);if(supplier.id!==body.supplierCharacter||supplier.id===ch.id||supplier.account_id===account)fail('party');
 const t=terms(body.terms),expiry=integer(body.expiresInSeconds,60,COMMERCIAL_NEGOTIATION.maxSeconds),orderId=id(body.orderId),identity=hash(['create',account,supplier.id,orderId,expiry,t]);const prior=await replay(c,account,key,identity);if(prior)return prior;
 if(typeof agentCredential!=='boolean')fail('actor');const hint=(await c.query('SELECT depot_id FROM market_listings WHERE id=$1',[orderId])).rows[0];if(!hint?.depot_id)fail('source');const src=await source(c,orderId,hint.depot_id,ch.id),o=src.order;await guardDelegatedControl(c,o.depot_id,agentCredential);const now=await clock(c),deadline=now+t.deadlineSeconds*1000;
 await activeAccounts(c,account,supplier.account_id);if(expiry*1000>deadline-now-60000)fail('expiry');validSource(o,t,deadline,now);
 if((await c.query("SELECT id FROM commercial_negotiations WHERE (buyer_account=$1 OR supplier_account=$1) AND state='offered' AND expires_at>$2 LIMIT 3",[account,new Date(now)])).rows.length>=3||(await c.query("SELECT id FROM commercial_negotiations WHERE (buyer_account=$1 OR supplier_account=$1) AND state='offered' AND expires_at>$2 LIMIT 3",[supplier.account_id,new Date(now)])).rows.length>=3)fail('limit');
 if((await c.query('SELECT id FROM commercial_negotiations WHERE order_id=$1',[orderId])).rows.length)fail('source_used');
 const r={id:crypto.randomUUID(),order_id:orderId,depot_id:o.depot_id,buyer_account:account,supplier_account:supplier.account_id,buyer_character:ch.id,supplier_character:supplier.id,revision:1,last_offer_character:ch.id,terms:t,source_hash:src.sourceHash,state:'offered',expires_at:new Date(now+expiry*1000),delivery_deadline:new Date(deadline),created_at:new Date(now)};r.terms_hash=offerHash(r);
 await c.query('INSERT INTO commercial_negotiations(id,order_id,depot_id,buyer_account,supplier_account,buyer_character,supplier_character,revision,last_offer_character,terms,terms_hash,source_hash,state,expires_at,delivery_deadline,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$15,$11,$12,$13,$14)',[r.id,orderId,r.depot_id,account,supplier.account_id,ch.id,supplier.id,ch.id,JSON.stringify(t),r.terms_hash,r.state,r.expires_at,r.delivery_deadline,r.created_at,r.source_hash]);return save(c,account,key,identity,{ok:true,negotiation:view(r),paid:0});
}

export async function actCommercialNegotiation(ch,other,negotiationId,body,key,c,agentCredential=false){
 const account=actor(ch);id(negotiationId);if(body?.action==='counter')exact(body,'action,expectedRevision,terms');else exact(body,'action,expectedRevision,termsHash');if(!['counter','accept','withdraw'].includes(body.action))fail('terms');integer(body.expectedRevision,1,3);
 const t=body.action==='counter'?terms(body.terms):null;if(!t&&(typeof body.termsHash!=='string'||!/^[a-f0-9]{64}$/.test(body.termsHash)))fail('terms');
 const identity=hash([body.action,account,negotiationId,body.expectedRevision,t||body.termsHash]),prior=await replay(c,account,key,identity);if(prior)return prior;
 if(typeof agentCredential!=='boolean')fail('actor');const hint=(await c.query('SELECT * FROM commercial_negotiations WHERE id=$1',[negotiationId])).rows[0];if(!hint)fail('missing');party(hint,ch,other);const src=await source(c,hint.order_id,hint.depot_id,hint.buyer_character,body.action!=='withdraw'),o=src.order;
 if(ch.id===hint.buyer_character)await guardDelegatedControl(c,hint.depot_id,agentCredential);
 const r=(await c.query('SELECT * FROM commercial_negotiations WHERE id=$1 FOR UPDATE',[negotiationId])).rows[0];party(r,ch,other);if(r.order_id!==hint.order_id||r.depot_id!==hint.depot_id)fail('source_changed');await activeAccounts(c,r.buyer_account,r.supplier_account);const now=await clock(c);
 if(r.state!=='offered'||Number(r.revision)!==body.expectedRevision)fail('revision');if(+new Date(r.expires_at)<=now)fail('expired');if(body.action!=='counter'&&r.terms_hash!==body.termsHash)fail('terms_changed');if(r.terms_hash!==offerHash(r))fail('binding');
 const oldRevision=Number(r.revision),oldHash=r.terms_hash;let changed;
 if(body.action==='withdraw'){changed=await c.query("UPDATE commercial_negotiations SET state='withdrawn' WHERE id=$1 AND state='offered' AND revision=$2 AND terms_hash=$3",[r.id,oldRevision,oldHash]);r.state='withdrawn';}
 else {if(src.sourceHash!==r.source_hash)fail('source_changed');if(r.last_offer_character===ch.id)fail('opposite_consent');if(body.action==='counter'){if(oldRevision>=3)fail('rounds');validSource(o,t,+new Date(r.delivery_deadline),now);if(t.deadlineSeconds!==Number(r.terms.deadlineSeconds))fail('immutable_deadline');r.revision=oldRevision+1;r.terms=t;r.last_offer_character=ch.id;r.terms_hash=offerHash(r);changed=await c.query("UPDATE commercial_negotiations SET revision=$2,terms=$3,terms_hash=$4,last_offer_character=$5 WHERE id=$1 AND state='offered' AND revision=$6 AND terms_hash=$7",[r.id,r.revision,JSON.stringify(t),r.terms_hash,ch.id,oldRevision,oldHash]);}
  else {validSource(o,r.terms,+new Date(r.delivery_deadline),now);const supplier=ch.id===r.supplier_character?ch:other,result=await acceptDelivery(supplier,r.order_id,r.terms,c,{deadlineAt:new Date(r.delivery_deadline)});changed=await c.query("UPDATE commercial_negotiations SET state='accepted',commitment_id=$2 WHERE id=$1 AND state='offered' AND revision=$3 AND terms_hash=$4",[r.id,result.id,oldRevision,oldHash]);r.state='accepted';r.commitment_id=result.id;}}
 if(changed.rowCount!==1)fail('revision');
 return save(c,account,key,identity,{ok:true,negotiation:view(r),paid:0});
}
export async function commercialNegotiationParty(c,account,negotiationId){const r=(await c.query('SELECT buyer_character,supplier_character,buyer_account,supplier_account FROM commercial_negotiations WHERE id=$1',[id(negotiationId)])).rows[0];if(!r||![r.buyer_account,r.supplier_account].includes(account))fail('party');return r.buyer_account===account?r.supplier_character:r.buyer_character;}
export async function commercialNegotiationBoard(c,account){id(account);const rows=(await c.query('SELECT n.*,b.alive AS buyer_alive,s.alive AS supplier_alive FROM commercial_negotiations n JOIN characters b ON b.id=n.buyer_character JOIN characters s ON s.id=n.supplier_character WHERE n.buyer_account=$1 OR n.supplier_account=$1 ORDER BY n.created_at DESC,n.id LIMIT 30',[account])).rows,now=await clock(c);return {negotiations:rows.map(r=>({...view(r),effectiveState:r.state==='offered'&&(!r.buyer_alive||!r.supplier_alive)?'party_dead':r.state==='offered'&&+new Date(r.expires_at)<=now?'expired':r.state})),maxRounds:3};}
export async function expireCommercialNegotiation(ch,negotiationId,body,key,c){exact(body,'');const account=actor(ch),identity=hash(['expire',account,id(negotiationId)]),prior=await replay(c,account,key,identity);if(prior)return prior;const r=(await c.query('SELECT * FROM commercial_negotiations WHERE id=$1 FOR UPDATE',[negotiationId])).rows[0];if(!r||![r.buyer_account,r.supplier_account].includes(account))fail('party');const parties=(await c.query('SELECT id,alive FROM characters WHERE id=$1 OR id=$2',[r.buyer_character,r.supplier_character])).rows,now=await clock(c);if(r.state==='offered'){if(parties.length!==2||parties.some(p=>!p.alive)||+new Date(r.expires_at)<=now){const changed=await c.query("UPDATE commercial_negotiations SET state='expired' WHERE id=$1 AND state='offered' AND revision=$2 AND terms_hash=$3",[r.id,r.revision,r.terms_hash]);if(changed.rowCount!==1)fail('revision');r.state='expired';}else fail('not_expired');}return save(c,account,key,identity,{ok:true,negotiation:view(r),paid:0});}
