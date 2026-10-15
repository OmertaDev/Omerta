import crypto from 'node:crypto';
import * as G from './game.js';
import * as I from './items.js';
import * as Warehouse from './warehouseleases.js';
import { guardDelegatedControl } from './operatingpolicy.js';
import { jailed, safeHoused } from './rules.js';
import { assertEstateResolutionScope } from './social/estate.js';
import { assertEquipmentRentalDeathScope } from './equipmentrentals.js';

export const PICKING_PACKING = Object.freeze({ good:'gin',maximumQuantity:10,maximumFee:1000,activeLimit:3,maximumSeconds:3600 });
export const pickingPackingDDL = `CREATE TABLE IF NOT EXISTS picking_packing_jobs (
 id TEXT PRIMARY KEY, tenant_account TEXT NOT NULL REFERENCES accounts(id), provider_account TEXT NOT NULL REFERENCES accounts(id),
 tenant_character TEXT NOT NULL REFERENCES characters(id), provider_character TEXT NOT NULL REFERENCES characters(id),
 lease_id TEXT NOT NULL REFERENCES business_warehouse_leases(id), depot_id TEXT NOT NULL REFERENCES business_depots(id),
 quantity INT NOT NULL CHECK(quantity BETWEEN 1 AND 10), fee_cash INT NOT NULL CHECK(fee_cash BETWEEN 1 AND 1000),
 source_hash TEXT NOT NULL CHECK(char_length(source_hash)=64), source JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('requested','accepted','fulfilled','cancelled','party_dead')), receipt JSONB,
 CHECK(tenant_account<>provider_account AND tenant_character<>provider_character), CHECK((state='fulfilled')=(receipt IS NOT NULL)));
CREATE TABLE IF NOT EXISTS picking_packing_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128),
 request_hash TEXT NOT NULL CHECK(char_length(request_hash)=64), actor_ref TEXT NOT NULL REFERENCES characters(id),
 receipt JSONB NOT NULL, job_id TEXT NOT NULL REFERENCES picking_packing_jobs(id), PRIMARY KEY(account_id,request_key));
CREATE INDEX IF NOT EXISTS picking_packing_tenant ON picking_packing_jobs(tenant_character,state);
CREATE INDEX IF NOT EXISTS picking_packing_provider ON picking_packing_jobs(provider_character,state);`;
const fail = reason => { throw new G.GameError('picking_packing',reason); };
const id = value => { if(typeof value!=='string'||!value.length||value.length>128)fail('terms');return value; };
const exact = (value,keys) => value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)).digest('hex');
async function clock(c){return new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);}
function terms(action,b){
  if(action==='create'){
    if(!exact(b,['leaseId','quantity','feeCash','expiresInSeconds','consent'])||b.consent!==true||!Number.isSafeInteger(b.quantity)||b.quantity<1||b.quantity>10
      ||!Number.isSafeInteger(b.feeCash)||b.feeCash<1||b.feeCash>1000||!Number.isSafeInteger(b.expiresInSeconds)||b.expiresInSeconds<60||b.expiresInSeconds>3600)fail('terms');
    return {action,leaseId:id(b.leaseId),quantity:b.quantity,feeCash:b.feeCash,expiresInSeconds:b.expiresInSeconds,consent:true};
  }
  if(!['accept','fulfill','cancel'].includes(action)||!exact(b,action==='accept'?['jobId','consent']:['jobId'])||(action==='accept'&&b.consent!==true))fail('terms');
  return {action,jobId:id(b.jobId),...(action==='accept'?{consent:true}:{})};
}
async function replay(c,account,key,t){
  const row=(await c.query('SELECT request_hash,receipt FROM picking_packing_requests WHERE account_id=$1 AND request_key=$2',[account,key])).rows[0];
  if(row&&row.request_hash!==hash(t))fail('request_conflict');return row?.receipt;
}
async function actors(c,tenant,provider){
  if(!tenant.alive||!provider.alive||tenant.is_npc||provider.is_npc||tenant.account_id===provider.account_id)fail('original_party');
  for(const account of [tenant.account_id,provider.account_id].sort()){
    if((await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[account])).rows[0]?.status!=='active')fail('account');
    const living=(await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2',[account])).rows;
    if(living.length!==1||![tenant.id,provider.id].includes(living[0].id))fail('original_party');
  }
}
async function source(c,tenant,provider,leaseId){
  const hint=(await c.query('SELECT depot_id FROM business_warehouse_leases WHERE id=$1',[leaseId])).rows[0];if(!hint)fail('lease');
  const depot=(await c.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE',[hint.depot_id])).rows[0];
  const lease=(await c.query('SELECT * FROM business_warehouse_leases WHERE id=$1 FOR UPDATE',[leaseId])).rows[0];
  const now=await clock(c);
  if(!depot||depot.owner_character!==provider.id||depot.status!=='open'||!depot.warehouse_enabled||lease.depot_id!==depot.id||lease.tenant_character!==tenant.id
    ||lease.landlord_character!==provider.id||lease.good_id!=='gin'||lease.status!=='active'||+new Date(lease.expires_at)<=+now)fail('lease');
  if(tenant.loc!==depot.district||provider.loc!==depot.district||jailed(tenant)||jailed(provider)||safeHoused(tenant)||safeHoused(provider))fail('dock');
  const journals=(await c.query('SELECT * FROM business_depot_journal WHERE lease_id=$1 ORDER BY lease_sequence,id LIMIT 201',[lease.id])).rows;
  if(journals.length>200)fail('history_unknown');
  const rent=journals.filter(j=>j.reason==='warehouse_rent'&&j.warehouse_rent_lease_id===lease.id);
  if(rent.length!==1||rent[0].customer_character!==tenant.id||rent[0].depot_id!==depot.id||Number(rent[0].cash_delta)!==Number(lease.fee_cash)
    ||Number(lease.fee_cash)!==Number(lease.units)*Number(lease.cash_per_unit_day))fail('paid_lease');
  const rentLedger=(await c.query("SELECT id FROM transactions WHERE character_id=$1 AND currency='cash' AND reason='warehouse:rent' AND counterparty=$2 AND amount=$3 LIMIT 201",[tenant.id,depot.id,-Number(lease.fee_cash)])).rows;
  if(!rentLedger.length||rentLedger.length>200)fail('paid_lease');
  let held=0,sequence=0;
  for(const j of journals){sequence++;if(j.depot_id!==depot.id||j.customer_character!==tenant.id||Number(j.lease_sequence)!==sequence)fail('custody_source');held+=Number(j.lease_stock_delta);if(Number(j.lease_stock_after)!==held)fail('custody_source');}
  if(held!==Number(lease.held_qty)||held<0||held>Number(lease.units))fail('custody_source');
  const quote={leaseId:lease.id,depotId:depot.id,tenantCharacter:tenant.id,providerCharacter:provider.id,good:'gin',units:Number(lease.units),heldQty:held,
    rentCash:Number(lease.fee_cash),rentJournal:rent[0].id,offerRevision:Number(lease.offer_revision),warehouseRevision:Number(depot.warehouse_revision),
    expiresAt:new Date(lease.expires_at).toISOString(),district:depot.district,journalIds:journals.map(j=>j.id),sequence};
  return {depot,lease,quote,now};
}
const dto = row => ({jobId:row.id,tenantCharacter:row.tenant_character,providerCharacter:row.provider_character,leaseId:row.lease_id,
  quantity:Number(row.quantity),feeCash:Number(row.fee_cash),sourceHash:row.source_hash,good:'gin',expiresAt:new Date(row.expires_at).toISOString(),state:row.state});
async function grant(c,row,accepted){
  const requests=(await c.query('SELECT account_id,actor_ref,request_hash,receipt FROM picking_packing_requests WHERE job_id=$1 ORDER BY account_id,request_key LIMIT 4',[row.id])).rows;
  if(requests.length>3)fail('consent');
  const same=r=>r&&r.jobId===row.id&&r.tenantCharacter===row.tenant_character&&r.providerCharacter===row.provider_character&&r.leaseId===row.lease_id&&r.quantity===Number(row.quantity)&&r.feeCash===Number(row.fee_cash)&&r.sourceHash===row.source_hash&&r.expiresAt===new Date(row.expires_at).toISOString();
  const owner=requests.filter(q=>q.account_id===row.tenant_account&&q.actor_ref===row.tenant_character&&q.receipt?.state==='requested');
  if(owner.length!==1||!same(owner[0].receipt)||owner[0].request_hash!==hash(terms('create',{leaseId:row.lease_id,quantity:Number(row.quantity),feeCash:Number(row.fee_cash),expiresInSeconds:owner[0].receipt.expiresInSeconds,consent:true})))fail('consent');
  if(accepted){const provider=requests.filter(q=>q.account_id===row.provider_account&&q.actor_ref===row.provider_character&&q.receipt?.state==='accepted');if(provider.length!==1||!same(provider[0].receipt)||provider[0].request_hash!==hash(terms('accept',{jobId:row.id,consent:true})))fail('consent');}
}
function restoreJob(c,row){const prior=[row.id,row.state,row.receipt];I.registerItemTransactionUndo(c,()=>c.query('UPDATE picking_packing_jobs SET state=$2,receipt=$3 WHERE id=$1',prior));}
async function changeJob(c,row,state,receipt=null){restoreJob(c,row);const changed=await c.query('UPDATE picking_packing_jobs SET state=$2,receipt=$3 WHERE id=$1 AND state=$4',[row.id,state,receipt,row.state]);if(changed.rowCount!==1)fail('job_changed');row.state=state;row.receipt=receipt;}

// This private bridge selects the real tenant only from an already owner-consented,
// fixed original-party job. The provider's authenticated account remains separate.
async function withPickingPackingActors(pool,requester,action,t,key,agent){
  const hint=action==='create'?(await pool.query('SELECT tenant_character,landlord_character provider_character FROM business_warehouse_leases WHERE id=$1',[t.leaseId])).rows[0]
    :(await pool.query('SELECT * FROM picking_packing_jobs WHERE id=$1',[t.jobId])).rows[0];
  if(!hint)fail('job');
  const originalTenant=(await pool.query('SELECT account_id,alive,is_npc FROM characters WHERE id=$1',[hint.tenant_character])).rows[0];
  const originalProvider=(await pool.query('SELECT account_id,alive,is_npc FROM characters WHERE id=$1',[hint.provider_character])).rows[0];
  if(!originalTenant?.alive||!originalProvider?.alive||originalTenant.is_npc||originalProvider.is_npc)fail('original_party');
  const tenantAccount=originalTenant.account_id;
  if(action==='create'){if(tenantAccount!==requester)fail('tenant');}
  else if(action==='cancel'){if(![hint.tenant_account,hint.provider_account].includes(requester))fail('party');}
  else if(hint.provider_account!==requester||!['requested','accepted'].includes(hint.state))fail('provider');
  if(action==='fulfill'&&(hint.state!=='accepted'||hint.tenant_account!==tenantAccount||+new Date(hint.expires_at)<=Date.now()))fail('consent');
  if(action==='accept'||action==='fulfill')await grant(pool,hint,action==='fulfill');
  const result=await G.withTwoCharacters(pool,tenantAccount,hint.provider_character,async(tenant,provider,c,h)=>{
    try{
      const old=await replay(c,requester,key,t);if(old)return old;
      if(action!=='cancel'&&process.env.DEPOT_PILOT!=='on')fail('pilot_disabled');
      await actors(c,tenant,provider);let row,receipt;
      if(action==='create'){
        if(tenant.account_id!==requester)fail('tenant');const src=await source(c,tenant,provider,t.leaseId);
        if(t.quantity>Number(src.lease.held_qty)||+src.now+t.expiresInSeconds*1000>=+new Date(src.lease.expires_at))fail('quantity_or_window');
        for(const actor of [tenant.id,provider.id])if((await c.query("SELECT id FROM picking_packing_jobs WHERE (tenant_character=$1 OR provider_character=$1) AND state IN ('requested','accepted') LIMIT 4",[actor])).rows.length>=3)fail('active_limit');
        row={id:crypto.randomUUID(),tenant_account:tenant.account_id,provider_account:provider.account_id,tenant_character:tenant.id,provider_character:provider.id,
          lease_id:src.lease.id,depot_id:src.depot.id,quantity:t.quantity,fee_cash:t.feeCash,source_hash:hash(src.quote),source:src.quote,expires_at:new Date(+src.now+t.expiresInSeconds*1000),state:'requested'};
        I.registerItemTransactionUndo(c,()=>c.query('DELETE FROM picking_packing_jobs WHERE id=$1',[row.id]));
        await c.query("INSERT INTO picking_packing_jobs(id,tenant_account,provider_account,tenant_character,provider_character,lease_id,depot_id,quantity,fee_cash,source_hash,source,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'requested')",[row.id,row.tenant_account,row.provider_account,tenant.id,provider.id,row.lease_id,row.depot_id,row.quantity,row.fee_cash,row.source_hash,row.source,row.expires_at]);receipt={...dto(row),expiresInSeconds:t.expiresInSeconds};
      }else{
        const src=action==='cancel'?null:await source(c,tenant,provider,hint.lease_id);
        row=(await c.query('SELECT * FROM picking_packing_jobs WHERE id=$1 FOR UPDATE',[hint.id])).rows[0];
        if(!row||row.tenant_account!==tenant.account_id||row.provider_account!==provider.account_id||row.tenant_character!==tenant.id||row.provider_character!==provider.id
          ||!['requested','accepted'].includes(row.state))fail('original_party');
        if(action==='cancel'){if(![row.tenant_account,row.provider_account].includes(requester))fail('party');await changeJob(c,row,'cancelled');receipt=dto(row);}
        else{
          if(requester!==row.provider_account)fail('provider');await guardDelegatedControl(c,src.depot.id,agent);
          await grant(c,row,action==='fulfill');
          if(row.source_hash!==hash(row.source)||row.source_hash!==hash(src.quote)||+await clock(c)>=+new Date(row.expires_at))fail('source_changed_or_expired');
          if(action==='accept'){if(row.state!=='requested')fail('state');await changeJob(c,row,'accepted');receipt=dto(row);}
          else{
            if(row.state!=='accepted'||Number(tenant.cash)-Number(row.fee_cash)<Warehouse.WAREHOUSE.cashReserve)fail('consent_or_cash');
            const cargoBefore=(await c.query('SELECT good_id,qty FROM character_cargo WHERE character_id=$1 ORDER BY good_id',[tenant.id])).rows;
            const cashBefore=(await c.query('SELECT id,cash FROM characters WHERE id IN ($1,$2)',[tenant.id,provider.id])).rows;
            const ownedBefore={...h.owned.cargo},tenantCash=tenant.cash,providerCash=provider.cash,sequence=src.quote.sequence;
            I.registerItemTransactionUndo(c,async()=>{
              tenant.cash=tenantCash;provider.cash=providerCash;h.owned.cargo={...ownedBefore};
              for(const person of cashBefore)await c.query('UPDATE characters SET cash=$2 WHERE id=$1',[person.id,person.cash]);
              await c.query('UPDATE business_warehouse_leases SET held_qty=$2 WHERE id=$1',[src.lease.id,src.quote.heldQty]);
              await c.query('DELETE FROM character_cargo WHERE character_id=$1',[tenant.id]);
              for(const cargo of cargoBefore)await c.query('INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,$2,$3)',[tenant.id,cargo.good_id,cargo.qty]);
              const created=(await c.query('SELECT id FROM business_depot_journal WHERE lease_id=$1 AND lease_sequence>$2',[src.lease.id,sequence])).rows;
              for(const j of created)await c.query('DELETE FROM business_depot_journal WHERE id=$1',[j.id]);
            });
            const moved=await Warehouse.withdrawWarehouseCargo(tenant,row.lease_id,Number(row.quantity),c,h);
            const journals=(await c.query('SELECT * FROM business_depot_journal WHERE lease_id=$1 AND lease_sequence>$2 ORDER BY lease_sequence',[row.lease_id,sequence])).rows;
            if(journals.length!==1||journals[0].reason!=='warehouse_withdraw'||journals[0].customer_character!==tenant.id||journals[0].depot_id!==row.depot_id
              ||Number(journals[0].lease_stock_delta)!==-Number(row.quantity)||Number(journals[0].lease_stock_after)!==src.quote.heldQty-Number(row.quantity)
              ||moved.withdrawn!==Number(row.quantity)||Number(h.owned.cargo.gin)!==Number(ownedBefore.gin||0)+Number(row.quantity))fail('custody_result');
            if(+await clock(c)>=+new Date(row.expires_at)||+await clock(c)>=+new Date(src.lease.expires_at))fail('expired');
            tenant.cash=Number(tenant.cash)-Number(row.fee_cash);provider.cash=Number(provider.cash)+Number(row.fee_cash);
            if(!Number.isSafeInteger(tenant.cash)||!Number.isSafeInteger(provider.cash))fail('cash');
            const undo=tx=>I.registerItemTransactionUndo(c,()=>c.query('DELETE FROM transactions WHERE id=$1',[tx]));
            const debit=await h.ledger(c,{characterId:tenant.id,accountId:tenant.account_id,currency:'cash',amount:-Number(row.fee_cash),reason:'picking_packing:pay',counterparty:row.id},{beforeInsert:undo});
            const credit=await h.ledger(c,{characterId:provider.id,accountId:provider.account_id,currency:'cash',amount:Number(row.fee_cash),reason:'picking_packing:receive',counterparty:row.id},{beforeInsert:undo});
            if(+await clock(c)>=+new Date(row.expires_at)||+await clock(c)>=+new Date(src.lease.expires_at))fail('expired');
            receipt={...dto({...row,state:'fulfilled'}),warehouseJournal:journals[0].id,debit,credit,heldBefore:src.quote.heldQty,heldAfter:moved.heldQty,cargoBefore:Number(ownedBefore.gin||0),cargoAfter:Number(h.owned.cargo.gin)};
            await changeJob(c,row,'fulfilled',receipt);
          }
        }
      }
      const actor=requester===tenant.account_id?tenant.id:provider.id;
      I.registerItemTransactionUndo(c,()=>c.query('DELETE FROM picking_packing_requests WHERE account_id=$1 AND request_key=$2',[requester,key]));
      await c.query('INSERT INTO picking_packing_requests(account_id,request_key,request_hash,actor_ref,receipt,job_id) VALUES($1,$2,$3,$4,$5,$6)',[requester,key,hash(t),actor,receipt,row.id]);
      return receipt;
    }catch(error){I.poisonItemTransaction(c,error);throw error;}
  },{meet:false});
  const {character,...receipt}=result;return receipt;
}
export async function pickingPackingAction(pool,account,action,body,key,{agent=false}={}){
  id(account);id(key);if(typeof agent!=='boolean')fail('agent_context');const t=terms(action,body);
  const old=await replay(pool,account,key,t);if(old)return old;
  try{return await withPickingPackingActors(pool,account,action,t,key,agent);}
  catch(error){
    // A same-key winner may commit between the first receipt read and role/source
    // preflight. Only its exact durable original-account receipt can resolve that race.
    const completed=await replay(pool,account,key,t);if(completed)return completed;throw error;
  }
}
export async function pickingPackingBoard(pool,account){id(account);return {jobs:(await pool.query('SELECT * FROM picking_packing_jobs WHERE tenant_account=$1 OR provider_account=$1 ORDER BY id LIMIT 50',[account])).rows.map(dto)};}
export async function pickingPackingCounterparts(c,character){id(character);const rows=(await c.query("SELECT tenant_character,provider_character FROM picking_packing_jobs WHERE (tenant_character=$1 OR provider_character=$1) AND state IN ('requested','accepted') ORDER BY id LIMIT 4",[character])).rows;if(rows.length>PICKING_PACKING.activeLimit)fail('active_limit');return [...new Set(rows.flatMap(r=>[r.tenant_character,r.provider_character]).filter(id=>id!==character))].sort();}
async function voidPickingPackingAtDeath(c,victim){I.assertItemTransaction(c);try{const dead=(await c.query('SELECT alive,account_id FROM characters WHERE id=$1',[victim.id])).rows[0];if(!dead||dead.alive!==false||dead.account_id!==victim.account_id)fail('death_required');const rows=(await c.query("SELECT * FROM picking_packing_jobs WHERE (tenant_character=$1 OR provider_character=$1) AND state IN ('requested','accepted') ORDER BY id LIMIT 4 FOR UPDATE",[victim.id])).rows;if(rows.length>3)fail('active_limit');for(const row of rows)await changeJob(c,row,'party_dead');return {retired:rows.length};}catch(error){I.poisonItemTransaction(c,error);throw error;}}

export async function recoverPickingPackingInEstate(c,victim,prelockScope,estateScope){
 I.assertItemTransaction(c);try{await assertEstateResolutionScope(c,victim.id,estateScope);const locked=await assertEquipmentRentalDeathScope(c,victim.id,prelockScope);for(const actor of await pickingPackingCounterparts(c,victim.id))if(!locked.ids.has(actor))throw new G.GameError('contention','Picking counterpart changed; retry the whole action.');return await voidPickingPackingAtDeath(c,victim);}catch(error){I.poisonItemTransaction(c,error);throw error;}
}
