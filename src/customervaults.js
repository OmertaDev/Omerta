import crypto from 'node:crypto';
import * as G from './game.js';
import { withItemRead, assertItemTransaction, registerItemTransactionUndo, poisonItemTransaction } from './items.js';
import { guardDelegatedControl, latestPolicy } from './operatingpolicy.js';
import { assertEquipmentRentalDeathScope } from './equipmentrentals.js';
import { assertEstateResolutionScope } from './social/estate.js';
import { safeHoused } from './rules.js';

export const CUSTOMER_VAULT = Object.freeze({ maximumCustomers:3, maximumPrincipal:100000, maximumReserve:300000, maximumFee:1000 });
// Component DDL only. Coordinator owns canonical schema and global cash-book wiring.
export const customerVaultDDL = `
CREATE TABLE IF NOT EXISTS customer_vault_services (
 id TEXT PRIMARY KEY,depot_id TEXT NOT NULL REFERENCES business_depots(id),operator_account TEXT NOT NULL REFERENCES accounts(id),
 operator_character TEXT NOT NULL REFERENCES characters(id),fee_cash INT NOT NULL CHECK(fee_cash BETWEEN 0 AND 1000),
 source_hash TEXT NOT NULL,policy_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('open','draining','closed')),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,closed_at TIMESTAMPTZ,CHECK(expires_at>created_at));
CREATE UNIQUE INDEX IF NOT EXISTS customer_vault_one_service ON customer_vault_services(operator_account) WHERE state IN ('open','draining');
CREATE TABLE IF NOT EXISTS customer_vault_positions (
 id TEXT PRIMARY KEY,service_id TEXT NOT NULL REFERENCES customer_vault_services(id),operator_account TEXT NOT NULL REFERENCES accounts(id),
 operator_character TEXT NOT NULL REFERENCES characters(id),customer_account TEXT NOT NULL REFERENCES accounts(id),customer_character TEXT NOT NULL REFERENCES characters(id),
 source_hash TEXT NOT NULL,principal INT NOT NULL CHECK(principal BETWEEN 1 AND 100000),remaining INT NOT NULL CHECK(remaining BETWEEN 0 AND principal),
 fee_cash INT NOT NULL CHECK(fee_cash BETWEEN 0 AND 1000),reserve_debit TEXT NOT NULL UNIQUE REFERENCES transactions(id),
 fee_debit TEXT UNIQUE REFERENCES transactions(id),fee_credit TEXT UNIQUE REFERENCES transactions(id),release_credit TEXT UNIQUE REFERENCES transactions(id),
 state TEXT NOT NULL CHECK(state IN ('funded','withdrawn','estate_refunded')),created_at TIMESTAMPTZ NOT NULL DEFAULT now(),released_at TIMESTAMPTZ,
 CHECK(operator_account<>customer_account),CHECK((state='funded' AND remaining=principal AND released_at IS NULL AND release_credit IS NULL) OR (state<>'funded' AND remaining=0 AND released_at IS NOT NULL AND release_credit IS NOT NULL)),
 CHECK((fee_cash=0 AND fee_debit IS NULL AND fee_credit IS NULL) OR (fee_cash>0 AND fee_debit IS NOT NULL AND fee_credit IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS customer_vault_one_position ON customer_vault_positions(customer_account) WHERE state='funded';
CREATE TABLE IF NOT EXISTS customer_vault_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id),key_hash TEXT NOT NULL,body_hash TEXT NOT NULL,receipt JSONB NOT NULL,PRIMARY KEY(account_id,key_hash));`;
const fail = reason => { throw new G.GameError('customer_vault',reason); };
const id = v => { if(typeof v!=='string'||!/^[!-~]{1,128}$/.test(v))fail('terms');return v; };
const integer = (v,a,b) => Number.isSafeInteger(v)&&v>=a&&v<=b;
const stable = v => JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a<b?-1:a>b?1:0)):x);
const hash = v => crypto.createHash('sha256').update(stable(v)).digest('hex');
const exact = (b,keys) => b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).sort().join(',')===keys.split(',').sort().join(',');
const now = async c => new Date((await c.query('SELECT clock_timestamp() AS at')).rows[0].at);
async function read(pool,fn){const result=await withItemRead(pool,async c=>{try{return {value:await fn(c)};}catch(error){if(error instanceof G.GameError&&error.code==='customer_vault')return {failure:error};throw error;}});if(result.failure)throw result.failure;return result.value;}
export function customerVaultTerms(action,b) {
  if(action==='open') {
    if(!exact(b,'depotId,feeCash,lifetimeSeconds,consent')||b.consent!==true||!integer(b.feeCash,0,1000)||!integer(b.lifetimeSeconds,60,86400))fail('terms');id(b.depotId);
  } else if(action==='deposit') {
    if(!exact(b,'serviceId,sourceHash,principal,maxFeeCash,consent')||b.consent!==true||!integer(b.principal,1,100000)||!integer(b.maxFeeCash,0,1000))fail('terms');id(b.serviceId);
  } else if(action==='close'||action==='withdraw') {
    if(!exact(b,(action==='close'?'serviceId':'positionId')+',sourceHash,consent')||b.consent!==true)fail('terms');id(b[action==='close'?'serviceId':'positionId']);
  } else fail('action');
  if(action!=='open'&&(typeof b.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(b.sourceHash)))fail('terms');
  return {...b};
}
const serviceHash = r => hash(['customer-vault-service-v1',r.id,r.depot_id,r.operator_account,r.operator_character,Number(r.fee_cash),r.policy_hash,+new Date(r.created_at),+new Date(r.expires_at)]);
const positionHash = r => hash(['customer-vault-position-v1',r.id,r.service_id,r.operator_account,r.operator_character,r.customer_account,r.customer_character,Number(r.principal),Number(r.fee_cash),r.reserve_debit,r.fee_debit,r.fee_credit,+new Date(r.created_at)]);
const serviceView = r => ({id:r.id,depotId:r.depot_id,operatorCharacter:r.operator_character,feeCash:Number(r.fee_cash),sourceHash:r.source_hash,state:r.state,expiresAt:new Date(r.expires_at).toISOString(),principalTitle:'original_customer',fullyReserved:true,noYield:true});
const positionView = r => ({id:r.id,serviceId:r.service_id,operatorCharacter:r.operator_character,customerCharacter:r.customer_character,principal:Number(r.principal),remaining:Number(r.remaining),feeCash:Number(r.fee_cash),sourceHash:r.source_hash,state:r.state,reserveDebit:r.reserve_debit,feeDebit:r.fee_debit,feeCredit:r.fee_credit,releaseCredit:r.release_credit,createdAt:new Date(r.created_at).toISOString(),releasedAt:r.released_at?new Date(r.released_at).toISOString():null,principalTitle:'original_customer',executionAuthority:false});
function original(ch) { if(!ch?.alive||ch.is_npc)fail('original_actor');id(ch.id);return id(ch.account_id); }
async function active(c,accounts) { for(const a of [...new Set(accounts)].sort())if((await c.query('SELECT status FROM accounts WHERE id=$1',[a])).rows[0]?.status!=='active')fail('account'); }
async function prior(c,account,key,bodyHash) {
  const r=(await c.query('SELECT body_hash,receipt FROM customer_vault_requests WHERE account_id=$1 AND key_hash=$2',[account,hash(id(key))])).rows[0];
  if(!r)return null;if(r.body_hash!==bodyHash)fail('key_conflict');return {...r.receipt,replayed:true,executionAuthority:false};
}
async function receipt(c,account,key,bodyHash,result) {
  const keyHash=hash(key);registerItemTransactionUndo(c,()=>c.query('DELETE FROM customer_vault_requests WHERE account_id=$1 AND key_hash=$2',[account,keyHash]));
  const value={...result,executionAuthority:false};await c.query('INSERT INTO customer_vault_requests(account_id,key_hash,body_hash,receipt) VALUES($1,$2,$3,$4)',[account,keyHash,bodyHash,JSON.stringify(value)]);return value;
}
async function cash(c,ch,delta,reason,position) {
  const before=Number(ch.cash);if(!ch.alive||!Number.isFinite(before)||before+delta<0||!Number.isFinite(before+delta)||Math.abs(before+delta)>Number.MAX_SAFE_INTEGER)fail('cash');
  const journal=await G.ledger(c,{characterId:ch.id,currency:'cash',amount:delta,reason,counterparty:position},{beforeInsert:tx=>registerItemTransactionUndo(c,()=>c.query('DELETE FROM transactions WHERE id=$1',[tx]))});
  registerItemTransactionUndo(c,()=>{ch.cash=before;});ch.cash=before+delta;return journal;
}
async function funding(c,r) {
  if(r.source_hash!==positionHash(r)||!integer(Number(r.principal),1,100000)||!integer(Number(r.fee_cash),0,1000)||r.operator_account===r.customer_account)fail('funding_source');
  const service=(await c.query('SELECT * FROM customer_vault_services WHERE id=$1',[r.service_id])).rows[0];if(!service||service.source_hash!==serviceHash(service)||service.operator_account!==r.operator_account||service.operator_character!==r.operator_character||Number(service.fee_cash)!==Number(r.fee_cash))fail('funding_source');
  const actors=(await c.query('SELECT id,account_id,alive FROM characters WHERE id=$1 OR id=$2',[r.customer_character,r.operator_character])).rows;
  if(!actors.some(v=>v.id===r.customer_character&&v.account_id===r.customer_account)||!actors.some(v=>v.id===r.operator_character&&v.account_id===r.operator_account))fail('funding_source');
  if(r.state==='funded'&&actors.some(v=>!v.alive))fail('unrecovered_estate');
  const rows=(await c.query("SELECT id,character_id,currency,amount,reason,counterparty FROM transactions WHERE counterparty=$1 AND reason IN ('customer_vault:reserve','customer_vault:fee_pay','customer_vault:fee_receive','customer_vault:withdraw','customer_vault:estate_refund') ORDER BY id",[r.id])).rows;
  const matches=(tx,character,amount,reason)=>rows.some(v=>v.id===tx&&v.character_id===character&&v.currency==='cash'&&Number(v.amount)===amount&&v.reason===reason&&v.counterparty===r.id);
  if(!matches(r.reserve_debit,r.customer_character,-Number(r.principal),'customer_vault:reserve'))fail('funding_source');
  const fee=Number(r.fee_cash);if(fee?(!matches(r.fee_debit,r.customer_character,-fee,'customer_vault:fee_pay')||!matches(r.fee_credit,r.operator_character,fee,'customer_vault:fee_receive')):(r.fee_debit!==null||r.fee_credit!==null))fail('funding_source');
  const released=r.state!=='funded';if(released&&!matches(r.release_credit,r.customer_character,Number(r.principal),r.state==='withdrawn'?'customer_vault:withdraw':'customer_vault:estate_refund'))fail('funding_source');
  if(rows.length!==1+(fee?2:0)+(released?1:0)||Number(r.remaining)!==(released?0:Number(r.principal)))fail('funding_source');
}
async function lockService(c,serviceId) {
  const r=(await c.query('SELECT * FROM customer_vault_services WHERE id=$1 FOR UPDATE',[serviceId])).rows[0];if(!r||r.source_hash!==serviceHash(r))fail('service_source');return r;
}
async function custodyDepot(c,depotId){if(!(await c.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE',[depotId])).rows.length)fail('depot_source');}
async function release(c,r,customer,state,credit) {
  if(r.state!=='funded'||customer.id!==r.customer_character||customer.account_id!==r.customer_account)fail('original_customer');
  const stamp=await now(c);registerItemTransactionUndo(c,()=>c.query("UPDATE customer_vault_positions SET remaining=$2,state='funded',release_credit=NULL,released_at=NULL WHERE id=$1",[r.id,r.principal]));
  const changed=await c.query("UPDATE customer_vault_positions SET remaining=0,state=$2,release_credit=$3,released_at=$4 WHERE id=$1 AND state='funded' AND remaining=$5",[r.id,state,credit,stamp,r.principal]);if(changed.rowCount!==1)fail('revision');
  const next={...r,remaining:0,state,release_credit:credit,released_at:stamp};await funding(c,next);
  if(!(await c.query("SELECT id FROM customer_vault_positions WHERE service_id=$1 AND state='funded' LIMIT 1",[r.service_id])).rows.length){
    const service=(await c.query("SELECT state,closed_at FROM customer_vault_services WHERE id=$1 AND state='draining'",[r.service_id])).rows[0];
    if(service){registerItemTransactionUndo(c,()=>c.query('UPDATE customer_vault_services SET state=$2,closed_at=$3 WHERE id=$1',[r.service_id,service.state,service.closed_at]));await c.query("UPDATE customer_vault_services SET state='closed' WHERE id=$1 AND state='draining'",[r.service_id]);}
  }return next;
}
async function execute(ch,other,action,b,key,c,agent) {
  assertItemTransaction(c);const account=original(ch),bodyHash=hash([action,b]),old=await prior(c,account,key,bodyHash);if(old)return old;
  await active(c,[account,...(other?[original(other)]:[])]);
  if(action==='open') {
    const depot=(await c.query("SELECT id FROM business_depots WHERE id=$1 AND owner_character=$2 AND status='open' FOR UPDATE",[b.depotId,ch.id])).rows[0];if(!depot)fail('depot');await guardDelegatedControl(c,b.depotId,agent);
    if((await c.query("SELECT id FROM customer_vault_services WHERE operator_account=$1 AND state IN ('open','draining') LIMIT 1",[account])).rows.length)fail('operator_capacity');
    const stamp=await now(c),r={id:crypto.randomUUID(),depot_id:b.depotId,operator_account:account,operator_character:ch.id,fee_cash:b.feeCash,policy_hash:hash(await latestPolicy(c,b.depotId,true)),state:'open',created_at:stamp,expires_at:new Date(+stamp+b.lifetimeSeconds*1000)};r.source_hash=serviceHash(r);
    registerItemTransactionUndo(c,()=>c.query('DELETE FROM customer_vault_services WHERE id=$1',[r.id]));await c.query('INSERT INTO customer_vault_services(id,depot_id,operator_account,operator_character,fee_cash,source_hash,policy_hash,state,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[r.id,r.depot_id,account,ch.id,r.fee_cash,r.source_hash,r.policy_hash,r.state,r.created_at,r.expires_at]);return receipt(c,account,key,bodyHash,{ok:true,service:serviceView(r)});
  }
  if(action==='deposit') {
    if(safeHoused(ch))throw new G.GameError('safe', "The courier won't come to a safehouse — banking waits until you surface.");
    if(!other||other.id===ch.id||other.account_id===account)fail('party');
    const hint=(await c.query('SELECT depot_id,operator_character FROM customer_vault_services WHERE id=$1',[b.serviceId])).rows[0];if(!hint||hint.operator_character!==other.id)fail('original_operator');
    if(!(await c.query("SELECT id FROM business_depots WHERE id=$1 AND owner_character=$2 AND status='open' FOR UPDATE",[hint.depot_id,other.id])).rows.length)fail('depot');
    const policyHash=hash(await latestPolicy(c,hint.depot_id,true)),r=await lockService(c,b.serviceId);if(r.depot_id!==hint.depot_id||r.operator_character!==other.id||r.operator_account!==other.account_id||r.policy_hash!==policyHash||r.state!=='open'||r.source_hash!==b.sourceHash||+new Date(r.expires_at)<=+await now(c))fail('service_source');
    // Fresh admission is bound to the owner's exact policy snapshot. Customer agent keys acquire no owner authority.
    if(Number(r.fee_cash)>b.maxFeeCash)fail('fee_cap');
    const funded=(await c.query("SELECT principal FROM customer_vault_positions WHERE service_id=$1 AND state='funded' ORDER BY id LIMIT 4",[r.id])).rows;if(funded.length>=3||funded.reduce((n,v)=>n+Number(v.principal),0)+b.principal>300000)fail('service_capacity');
    if((await c.query("SELECT id FROM customer_vault_positions WHERE customer_account=$1 AND state='funded' LIMIT 1",[account])).rows.length)fail('customer_capacity');
    if(Number(ch.cash)<b.principal+Number(r.fee_cash))fail('cash');
    const position={id:crypto.randomUUID(),service_id:r.id,operator_account:r.operator_account,operator_character:other.id,customer_account:account,customer_character:ch.id,principal:b.principal,remaining:b.principal,fee_cash:Number(r.fee_cash),state:'funded',created_at:await now(c),released_at:null,release_credit:null};
    position.reserve_debit=await cash(c,ch,-b.principal,'customer_vault:reserve',position.id);position.fee_debit=null;position.fee_credit=null;
    if(position.fee_cash){position.fee_debit=await cash(c,ch,-position.fee_cash,'customer_vault:fee_pay',position.id);position.fee_credit=await cash(c,other,position.fee_cash,'customer_vault:fee_receive',position.id);}position.source_hash=positionHash(position);
    registerItemTransactionUndo(c,()=>c.query('DELETE FROM customer_vault_positions WHERE id=$1',[position.id]));await c.query('INSERT INTO customer_vault_positions(id,service_id,operator_account,operator_character,customer_account,customer_character,source_hash,principal,remaining,fee_cash,reserve_debit,fee_debit,fee_credit,state,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[position.id,r.id,r.operator_account,other.id,account,ch.id,position.source_hash,position.principal,position.remaining,position.fee_cash,position.reserve_debit,position.fee_debit,position.fee_credit,position.state,position.created_at]);await funding(c,position);return receipt(c,account,key,bodyHash,{ok:true,position:positionView(position)});
  }
  if(action==='withdraw') {
    // No operator liveness, policy, Depot ownership or service-expiry condition can confiscate a funded principal.
    const hint=(await c.query('SELECT p.service_id,p.customer_account,p.customer_character,s.depot_id FROM customer_vault_positions p JOIN customer_vault_services s ON s.id=p.service_id WHERE p.id=$1',[b.positionId])).rows[0];if(!hint||hint.customer_account!==account||hint.customer_character!==ch.id)fail('original_customer');await custodyDepot(c,hint.depot_id);const service=await lockService(c,hint.service_id);if(service.depot_id!==hint.depot_id)fail('service_source');
    const r=(await c.query('SELECT * FROM customer_vault_positions WHERE id=$1 FOR UPDATE',[b.positionId])).rows[0];if(!r||r.customer_account!==account||r.customer_character!==ch.id||r.source_hash!==b.sourceHash||r.state!=='funded')fail('original_customer');await funding(c,r);
    const credit=await cash(c,ch,Number(r.principal),'customer_vault:withdraw',r.id),next=await release(c,r,ch,'withdrawn',credit);return receipt(c,account,key,bodyHash,{ok:true,position:positionView(next)});
  }
  const hint=(await c.query('SELECT depot_id FROM customer_vault_services WHERE id=$1',[b.serviceId])).rows[0];if(!hint)fail('service_source');await custodyDepot(c,hint.depot_id);const r=await lockService(c,b.serviceId);if(r.depot_id!==hint.depot_id||r.operator_account!==account||r.operator_character!==ch.id||r.source_hash!==b.sourceHash||r.state!=='open')fail('original_operator');
  const count=(await c.query("SELECT id FROM customer_vault_positions WHERE service_id=$1 AND state='funded' LIMIT 1",[r.id])).rows.length;registerItemTransactionUndo(c,()=>c.query("UPDATE customer_vault_services SET state='open',closed_at=NULL WHERE id=$1",[r.id]));r.state=count?'draining':'closed';await c.query('UPDATE customer_vault_services SET state=$2,closed_at=$3 WHERE id=$1',[r.id,r.state,await now(c)]);return receipt(c,account,key,bodyHash,{ok:true,service:serviceView(r)});
}

/** Trusted registrar readiness is NOT a request field or a new grant. Missing bridge means zero transaction admission. */
export function createCustomerVaultRuntime({pool,assertEstateBridgeReady}={}) {
  const available=typeof assertEstateBridgeReady==='function';
  const ready=async()=>available&&await assertEstateBridgeReady()===true;
  return { available,ready,
    async action(account,action,body,key,{agent=false}={}) {
      if(!await ready())throw Object.assign(new G.GameError('customer_vault_unavailable','Canonical estate-start and global reserve-book integration required.'),{statusCode:503});id(account);id(key);if(typeof agent!=='boolean')fail('actor');const b=customerVaultTerms(action,body),bodyHash=hash([action,b]);
      const replay=await read(pool,async c=>{await active(c,[account]);return prior(c,account,key,bodyHash);});if(replay)return replay;
      const run=(ch,other,c)=>execute(ch,other,action,b,key,c,agent).catch(error=>{poisonItemTransaction(c,error);throw error;});
      if(action==='deposit') {
        const hint=(await pool.query('SELECT operator_character FROM customer_vault_services WHERE id=$1',[b.serviceId])).rows[0];if(!hint)fail('service_source');
        const {character,...result}=await G.withTwoCharacters(pool,account,hint.operator_character,(ch,other,c)=>run(ch,other,c),{meet:false});return result;
      }
      const {character,...result}=await G.withCharacter(pool,account,(ch,c)=>run(ch,null,c));return result;
    }
  };
}
export async function customerVaultBoard(pool,account) {
  id(account);return read(pool,async c=>{await active(c,[account]);const services=(await c.query('SELECT * FROM customer_vault_services WHERE operator_account=$1 ORDER BY created_at DESC,id LIMIT 21',[account])).rows;
    const positions=(await c.query('SELECT * FROM customer_vault_positions WHERE customer_account=$1 ORDER BY created_at DESC,id LIMIT 21',[account])).rows;
    const currentService=(await c.query("SELECT * FROM customer_vault_services WHERE operator_account=$1 AND state IN ('open','draining') LIMIT 2",[account])).rows,currentPosition=(await c.query("SELECT * FROM customer_vault_positions WHERE customer_account=$1 AND state='funded' LIMIT 2",[account])).rows;if(currentService.length>1||currentPosition.length>1)fail('capacity_source');
    const include=(current,recent)=>[...current,...recent.filter(r=>!current.some(v=>v.id===r.id))],ss=include(currentService,services),pp=include(currentPosition,positions);
    for(const r of ss.slice(0,20))if(r.source_hash!==serviceHash(r))fail('service_source');for(const r of pp.slice(0,20))await funding(c,r);
    return {status:'verified',services:ss.slice(0,20).map(serviceView),positions:pp.slice(0,20).map(positionView),historyTruncated:ss.length>20||pp.length>20,executionAuthority:false};});
}
export async function customerVaultOffers(pool,account) {
  id(account);return read(pool,async c=>{await active(c,[account]);const rows=(await c.query("SELECT s.* FROM customer_vault_services s JOIN characters ch ON ch.id=s.operator_character JOIN accounts a ON a.id=s.operator_account JOIN business_depots d ON d.id=s.depot_id WHERE s.state='open' AND ch.alive AND ch.account_id=s.operator_account AND a.status='active' AND d.owner_character=s.operator_character AND d.status='open' AND s.expires_at>clock_timestamp() ORDER BY s.created_at DESC,s.id LIMIT 20")).rows,offers=[];for(const r of rows)if(r.source_hash===serviceHash(r)&&r.policy_hash===hash(await latestPolicy(c,r.depot_id)))offers.push(serviceView(r));return {offers,executionAuthority:false};});
}
export async function customerVaultDeathCounterparts(c,character) {
  id(character);const rows=(await c.query("SELECT operator_character,customer_character FROM customer_vault_positions WHERE state='funded' AND (operator_character=$1 OR customer_character=$1) ORDER BY id LIMIT 5",[character])).rows;
  if(rows.length>4)fail('death_capacity');return [...new Set(rows.flatMap(r=>[r.operator_character,r.customer_character]).filter(v=>v!==character))].sort();
}
/** Root must call BEFORE exactCash, with its genuine preactor and estate-resolution witnesses. */
export async function recoverCustomerVaultsAtEstateStart(c,victim,h,{killerCh}={}) {
  assertItemTransaction(c);try {
    const estate=await assertEstateResolutionScope(c,victim.id,h?.estateResolutionScope),locked=await assertEquipmentRentalDeathScope(c,victim.id,h?.rentalDeathScope);
    if(estate.accountId!==victim.account_id||!victim.alive)fail('death_scope');if((await customerVaultDeathCounterparts(c,victim.id)).some(v=>!locked.ids.has(v)))fail('death_scope_changed');
    const hints=(await c.query("SELECT p.service_id,s.depot_id FROM customer_vault_positions p JOIN customer_vault_services s ON s.id=p.service_id WHERE p.state='funded' AND (p.operator_character=$1 OR p.customer_character=$1) ORDER BY p.service_id,p.id LIMIT 5",[victim.id])).rows;if(hints.length>4)fail('death_capacity');
    for(const depotId of [...new Set(hints.map(v=>v.depot_id))].sort())await custodyDepot(c,depotId);
    for(const service of [...new Set(hints.map(v=>v.service_id))].sort())await lockService(c,service);
    const rows=(await c.query("SELECT * FROM customer_vault_positions WHERE state='funded' AND (operator_character=$1 OR customer_character=$1) ORDER BY service_id,id LIMIT 5 FOR UPDATE",[victim.id])).rows;if(rows.length!==hints.length||rows.length>4)fail('death_scope_changed');
    const results=[];
    for(const r of rows){await funding(c,r);const customer=(await c.query('SELECT id,account_id,alive,cash FROM characters WHERE id=$1',[r.customer_character])).rows[0];if(!customer?.alive||customer.account_id!==r.customer_account)fail('customer_estate_unrecovered');const amount=Number(r.principal),before=Number(customer.cash);
      registerItemTransactionUndo(c,()=>c.query('UPDATE characters SET cash=$2 WHERE id=$1',[customer.id,before]));const updated=await c.query('UPDATE characters SET cash=cash+$2 WHERE id=$1 AND alive RETURNING cash',[customer.id,amount]);if(updated.rowCount!==1)fail('death_scope');
      const credit=await G.ledger(c,{characterId:customer.id,currency:'cash',amount,reason:'customer_vault:estate_refund',counterparty:r.id},{beforeInsert:tx=>registerItemTransactionUndo(c,()=>c.query('DELETE FROM transactions WHERE id=$1',[tx]))});
      for(const actor of new Set([victim,h.actorCh,killerCh].filter(v=>v?.id===customer.id))){const old=Number(actor.cash);registerItemTransactionUndo(c,()=>{actor.cash=old;});actor.cash=old+amount;}
      const next=await release(c,r,customer,'estate_refunded',credit);results.push({positionId:r.id,customerCharacter:customer.id,refunded:amount,releaseCredit:next.release_credit});
    }
    const services=(await c.query("SELECT id,state,closed_at FROM customer_vault_services WHERE operator_character=$1 AND state IN ('open','draining') ORDER BY id FOR UPDATE",[victim.id])).rows;
    for(const s of services){registerItemTransactionUndo(c,()=>c.query('UPDATE customer_vault_services SET state=$2,closed_at=$3 WHERE id=$1',[s.id,s.state,s.closed_at]));await c.query("UPDATE customer_vault_services SET state='closed',closed_at=$2 WHERE id=$1",[s.id,await now(c)]);}return results;
  }catch(error){poisonItemTransaction(c,error);throw error;}
}
export async function customerVaultAccounting(c) {
  const rows=(await c.query('SELECT * FROM customer_vault_positions ORDER BY id')).rows,issues=[];let reserve=0;
  for(const r of rows){try{await funding(c,r);reserve+=Number(r.remaining);}catch(error){issues.push({positionId:r.id,reason:'funding_source'});}}
  const services=new Map(),customers=new Set();for(const r of rows.filter(v=>v.state==='funded')){if(customers.has(r.customer_account))issues.push({positionId:r.id,reason:'customer_capacity'});customers.add(r.customer_account);const s=services.get(r.service_id)||{count:0,reserve:0};s.count++;s.reserve+=Number(r.remaining);services.set(r.service_id,s);if(s.count>3||s.reserve>300000)issues.push({positionId:r.id,reason:'service_capacity'});}
  const tx=(await c.query("SELECT id,currency,amount FROM transactions WHERE reason IN ('customer_vault:reserve','customer_vault:fee_pay','customer_vault:fee_receive','customer_vault:withdraw','customer_vault:estate_refund')")).rows;
  const bound=new Set(rows.flatMap(r=>[r.reserve_debit,r.fee_debit,r.fee_credit,r.release_credit]).filter(Boolean));for(const t of tx)if(!bound.has(t.id))issues.push({reason:'unbound_journal'});
  for(const t of tx)if(t.currency!=='cash')issues.push({reason:'wrong_currency'});
  const ledgerDelta=tx.filter(t=>t.currency==='cash').reduce((n,r)=>n+Number(r.amount),0);if(!Number.isSafeInteger(reserve)||ledgerDelta+reserve!==0)issues.push({reason:'reserve_conservation'});
  return {reserve,ledgerDelta,issues};
}
