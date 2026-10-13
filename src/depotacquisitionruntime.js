import { collectCompanyRestructuringIssues, collectCommercialHistoryIssues } from './company-commercial-invariants.js';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { GameError, ledger } from './game.js';
import { assertItemTransaction, registerItemTransactionUndo, poisonItemTransaction } from './items.js';
import { ACQUISITION_CAPABILITY } from './companyacquisitions.js';

const scopes=new AsyncLocalStorage();
const fail=r=>{throw new GameError('depot_acquisition_runtime',r);};
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
const id=v=>{if(typeof v!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v))fail('identity');return v;};
const clock=async c=>new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
// This registry is frozen to the reviewed schema and unchanged F13/F14/F15 prerequisites.
// A new Depot reference is an unsupported transfer scope, even when presently empty.
export const DEPOT_ACQUISITION_REFERENCES=Object.freeze([
 'market_listings:depot_id','business_depot_journal:depot_id','delivery_commitments:depot_id','business_warehouse_leases:depot_id',
 'supply_tenders:depot_id','depot_brand_licenses:operator_depot_id','depot_brand_licenses:recipient_depot_id',
 'business_operating_policies:depot_id','business_supply_contracts:depot_id','business_external_costs:depot_id',
 'logistics_coverage_policies:depot_id','company_succession_receipts:depot_id','company_operators:depot_id','company_operator_receipts:depot_id',
 'game_employment_jobs:depot_id','company_workflows:depot_id','commercial_premises_offers:depot_id','commercial_premises_leases:depot_id',
 'company_logistics_hubs:depot_id','business_season_entries:depot_id','company_production_receipts:business_id',
 'company_specializations:business_id','company_specialization_runs:business_id','commercial_negotiations:depot_id',
 'contract_auctions:depot_id','business_partnerships:depot_id','company_acquisitions:depot_id',
 'worker_training_courses:depot_id','employment_organizations:depot_id',
 'company_restructuring_plans:depot_id','commercial_disputes:depot_id','infrastructure_concessions:business_id','territory_economics_profiles:business_id',
 'agent_operating_memory_facts:business_id','economic_intelligence_publications:depot_id','funded_external_work_jobs:depot_id','strategy_laboratories:business_id']);
async function assertNoObligations(c,depotId){
 if((await c.query('SELECT id FROM agent_operating_memory_facts WHERE business_id=$1 LIMIT 1',[depotId])).rows.length)fail('operating_memory_archive_required');
 if((await c.query('SELECT id FROM economic_intelligence_publications WHERE depot_id=$1 LIMIT 1',[depotId])).rows.length)fail('intelligence_archive_required');
 if((await c.query('SELECT id FROM funded_external_work_jobs WHERE depot_id=$1 LIMIT 1',[depotId])).rows.length)fail('external_work_archive_required');
 if((await c.query('SELECT id FROM strategy_laboratories WHERE (business_id=$1) IS TRUE LIMIT 1',[depotId])).rows.length)fail('strategy_laboratory_archive_required');
 if((await c.query("SELECT id FROM company_restructuring_plans WHERE depot_id=$1 AND state='ready' LIMIT 1",[depotId])).rows.length)fail('restructuring_pending');
 if((await c.query("SELECT id FROM commercial_disputes WHERE depot_id=$1 AND state IN ('proposed','agreed') LIMIT 1",[depotId])).rows.length)fail('commercial_dispute_pending');
 if((await c.query("SELECT id FROM infrastructure_concessions WHERE business_id=$1 AND state='accepted' LIMIT 1",[depotId])).rows.length)fail('concession_active');
 if((await c.query("SELECT id FROM territory_economics_profiles WHERE business_id=$1 AND enabled=true AND state='active' AND expires_at>clock_timestamp() LIMIT 1",[depotId])).rows.length)fail('territory_authority_active');
 if((await collectCompanyRestructuringIssues(c,depotId)).length||(await collectCommercialHistoryIssues(c,depotId)).length)fail('commercial_history_changed');
 // Historical authority is not deleted or adopted to manufacture a transfer.
 if((await c.query('SELECT id FROM equipment_maintenance_offers WHERE id=$1 LIMIT 1',[depotId])).rows.length)fail('maintenance_archive_required');
 if((await c.query('SELECT s.id FROM service_subscriptions s JOIN equipment_maintenance_offers o ON o.id=s.offer_id WHERE o.id=$1 LIMIT 1',[depotId])).rows.length)fail('subscription_archive_required');
 if((await c.query('SELECT id FROM worker_training_courses WHERE depot_id=$1 LIMIT 1',[depotId])).rows.length)fail('training_archive_required');
 if((await c.query('SELECT id FROM employment_organizations WHERE depot_id=$1 LIMIT 1',[depotId])).rows.length)fail('organization_archive_required');
 if((await c.query("SELECT id FROM market_listings WHERE depot_id=$1 AND (kind<>'order' OR status NOT IN ('sold','cancelled','expired') OR qty<>0 OR filled_qty<>0) LIMIT 1",[depotId])).rows.length)fail("market");
 if((await c.query("SELECT id FROM delivery_commitments WHERE depot_id=$1 AND status NOT IN ('delivered','expired') LIMIT 1",[depotId])).rows.length)fail("delivery");
 if((await c.query("SELECT r.id FROM delivery_loan_requests r JOIN delivery_commitments d ON d.id=r.commitment_id WHERE d.depot_id=$1 LIMIT 1",[depotId])).rows.length)fail("delivery_debt");
 if((await c.query("SELECT id FROM business_warehouse_leases WHERE depot_id=$1 AND (status NOT IN ('closed','tenant_dead') OR held_qty<>0) LIMIT 1",[depotId])).rows.length)fail("warehouse");
 if((await c.query("SELECT id FROM supply_tenders WHERE depot_id=$1 LIMIT 1",[depotId])).rows.length)fail("tender");
 if((await c.query("SELECT id FROM depot_brand_licenses WHERE (operator_depot_id=$1 OR recipient_depot_id=$1) AND status<>'ended' LIMIT 1",[depotId])).rows.length)fail("brand");
 if((await c.query("SELECT id FROM business_operating_policies WHERE depot_id=$1 LIMIT 1",[depotId])).rows.length)fail("policy_archive_required");
 if((await c.query("SELECT id FROM business_supply_contracts WHERE depot_id=$1 LIMIT 1",[depotId])).rows.length)fail("cadence_archive_required");
 if((await c.query("SELECT depot_id FROM company_operators WHERE depot_id=$1 LIMIT 1",[depotId])).rows.length)fail("operator_archive_required");
 if((await c.query("SELECT business_id FROM company_specializations WHERE business_id=$1 LIMIT 1",[depotId])).rows.length)fail("specialization_archive_required");
 if((await c.query("SELECT id FROM business_partnerships WHERE depot_id=$1 LIMIT 1",[depotId])).rows.length)fail("partnership_archive_required");
 if((await c.query("SELECT g.partnership_id FROM company_governance g JOIN business_partnerships p ON p.id=g.partnership_id WHERE p.depot_id=$1 LIMIT 1",[depotId])).rows.length)fail("governance_archive_required");
 if((await c.query("SELECT id FROM game_employment_jobs WHERE depot_id=$1 AND (state<>'closed' OR escrow_cash<>0) LIMIT 1",[depotId])).rows.length)fail("employment");
 if((await c.query("SELECT a.id FROM game_employment_assignments a JOIN game_employment_jobs j ON j.id=a.employment_id WHERE j.depot_id=$1 AND a.state<>'paid' LIMIT 1",[depotId])).rows.length)fail("worker_assignment");
 if((await c.query("SELECT id FROM company_workflows WHERE depot_id=$1 AND status<>'completed' LIMIT 1",[depotId])).rows.length)fail("workflow");
 if((await c.query("SELECT id FROM commercial_premises_offers WHERE depot_id=$1 AND state='offered' LIMIT 1",[depotId])).rows.length)fail("premises_offer");
 if((await c.query("SELECT id FROM commercial_premises_leases WHERE depot_id=$1 AND state NOT IN ('expired','cancelled','invalidated','landlord_dead','tenant_dead') LIMIT 1",[depotId])).rows.length)fail("premises_occupancy");
 if((await c.query("SELECT id FROM company_logistics_hubs WHERE depot_id=$1 AND state IN ('draft','active') LIMIT 1",[depotId])).rows.length)fail("hub");
 if((await c.query("SELECT id FROM logistics_coverage_policies WHERE depot_id=$1 AND (state NOT IN ('expired','cancelled','paid') OR escrow_cash<>0) LIMIT 1",[depotId])).rows.length)fail("coverage");
 if((await c.query("SELECT depot_id FROM business_season_entries WHERE depot_id=$1 AND end_snapshot IS NULL LIMIT 1",[depotId])).rows.length)fail("season");
 if((await c.query('SELECT id FROM commercial_negotiations WHERE depot_id=$1 LIMIT 1',[depotId])).rows.length)fail('negotiation_archive_required');
 if((await c.query('SELECT id FROM contract_auctions WHERE depot_id=$1 LIMIT 1',[depotId])).rows.length)fail('auction_archive_required');
 if((await c.query("SELECT depot_id FROM company_succession_receipts WHERE depot_id=$1 LIMIT 1",[depotId])).rows.length)fail("succession");
}
async function inspect({client:c,depot,seller,buyer}){assertItemTransaction(c);const scope=scopes.getStore();if(!scope?.active||scope.client!==c||!scope.characters.includes(seller?.id)||!scope.characters.includes(buyer?.id))fail('preflight_required');if(process.env.DEPOT_PILOT!=='on')fail('disabled');if(!seller?.alive||!buyer?.alive||seller.is_npc||buyer.is_npc||seller.account_id===buyer.account_id)fail('parties');id(seller.id);id(buyer.id);id(seller.account_id);id(buyer.account_id);id(depot?.id);
 const chars=[];for(const key of [seller.id,buyer.id].sort()){const ch=(await c.query('SELECT id,account_id,alive,is_npc FROM characters WHERE id=$1 FOR UPDATE',[key])).rows[0];if(!ch?.alive||ch.is_npc)fail('parties');chars.push(ch);}if(!chars.some(x=>x.id===seller.id&&x.account_id===seller.account_id)||!chars.some(x=>x.id===buyer.id&&x.account_id===buyer.account_id))fail('original_identity');
 for(const key of [seller.account_id,buyer.account_id].sort())if((await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[key])).rows[0]?.status!=='active')fail('accounts');
 const d=(await c.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE',[depot.id])).rows[0];if(!d||d.status!=='open'||d.owner_character!==seller.id||stable(d)!==stable(depot))fail('source_changed');if((await c.query("SELECT id FROM business_depots WHERE owner_character=$1 AND status='open' LIMIT 1",[buyer.id])).rows.length)fail('buyer_depot');
 const references=(await c.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('depot_id','operator_depot_id','recipient_depot_id','business_id') ORDER BY table_name,column_name")).rows.map(r=>r.table_name+':'+r.column_name);if(!references.length||references.some(x=>!DEPOT_ACQUISITION_REFERENCES.includes(x))||DEPOT_ACQUISITION_REFERENCES.some(x=>!references.includes(x)))fail('unsupported_schema');
 if(d.warehouse_enabled)fail('warehouse_offer');if(!Number.isSafeInteger(Number(d.treasury))||Number(d.treasury)<0||!Number.isSafeInteger(Number(d.stock))||Number(d.stock)<0||Number(d.stock)>40||!Number.isSafeInteger(Number(d.stock_cost))||Number(d.stock_cost)<0)fail('assets');
 const book=(await c.query('SELECT COALESCE(SUM(cash_delta),0) cash,COALESCE(SUM(stock_delta),0) stock,COALESCE(SUM(cost_delta),0) cost FROM business_depot_journal WHERE depot_id=$1',[d.id])).rows[0];if(Number(book.cash)!==Number(d.treasury)||Number(book.stock)!==Number(d.stock)||Number(book.cost)!==Number(d.stock_cost)||(Number(d.stock)===0&&Number(d.stock_cost)!==0))fail('asset_books');
 // Literal queries only. All writers of these scopes must share the current owner/Depot locks.
 await assertNoObligations(c,d.id);
 return {kind:ACQUISITION_CAPABILITY,eligible:true,sourceHash:hash({depot:d,seller:seller.id,buyer:buyer.id,references,slice:'no_authority_or_unsettled_obligations'}),retirement:{kind:'canonical_empty_authority_proof',existingGrants:0,retiredGrants:0},depot:d};}
async function settle(args){const{client:c,depot,seller,buyer,acquisitionId,price,termsHash,acceptedAt,expiresAt}=args;assertItemTransaction(c);id(acquisitionId);if(!Number.isSafeInteger(price)||price<1||price>100000000)fail('price');const proof=await inspect(args),r=(await c.query('SELECT * FROM company_acquisitions WHERE id=$1 FOR UPDATE',[acquisitionId])).rows[0];if(!r||r.state!=='accepted'||r.depot_id!==depot.id||r.seller_character!==seller.id||r.buyer_character!==buyer.id||r.seller_account!==seller.account_id||r.buyer_account!==buyer.account_id||Number(r.price)!==price||r.terms_hash!==termsHash||r.pay_journal!==null||r.receive_journal!==null||+new Date(r.accepted_at)!==+new Date(acceptedAt)||+new Date(r.expires_at)!==+new Date(expiresAt))fail('consent');
 const binding=hash([r.id,r.depot_id,r.seller_account,r.buyer_account,r.seller_character,r.buyer_character,price,r.source_hash,new Date(r.created_at).toISOString(),new Date(r.expires_at).toISOString()]);if(binding!==r.terms_hash||r.source_hash!==hash([hash([depot,null]),proof.sourceHash]))fail('source_changed');const now=await clock(c);if(!r.accepted_at||+now>=+new Date(r.expires_at))fail('expired');const beforeBuyer=Number(buyer.cash),beforeSeller=Number(seller.cash);if(!Number.isSafeInteger(beforeBuyer)||beforeBuyer<price||!Number.isSafeInteger(beforeSeller)||!Number.isSafeInteger(beforeSeller+price))fail('cash');
 const original=(await c.query('SELECT id,cash FROM characters WHERE id IN ($1,$2)',[buyer.id,seller.id])).rows;let payJournal=null,receiveJournal=null;
 registerItemTransactionUndo(c,async()=>{buyer.cash=beforeBuyer;seller.cash=beforeSeller;for(const ch of original)await c.query('UPDATE characters SET cash=$2 WHERE id=$1',[ch.id,ch.cash]);await c.query('UPDATE business_depots SET owner_character=$2 WHERE id=$1',[depot.id,seller.id]);await c.query('UPDATE company_acquisitions SET state=$2,accepted_at=$3,executed_at=$4,pay_journal=$5,receive_journal=$6 WHERE id=$1',[r.id,r.state,r.accepted_at,r.executed_at,r.pay_journal,r.receive_journal]);if(payJournal&&receiveJournal){const rows=(await c.query("SELECT request_key FROM company_acquisition_requests WHERE account_id=$1 AND receipt->'acquisition'->>'id'=$2 AND receipt->'canonicalReceipt'->>'payJournal'=$3 AND receipt->'canonicalReceipt'->>'receiveJournal'=$4 LIMIT 2",[seller.account_id,r.id,payJournal,receiveJournal])).rows;if(rows.length>1)throw Error('Acquisition ACK ownership ambiguous');if(rows.length)await c.query('DELETE FROM company_acquisition_requests WHERE account_id=$1 AND request_key=$2',[seller.account_id,rows[0].request_key]);}});
 payJournal=await ledger(c,{characterId:buyer.id,currency:'cash',amount:-price,reason:'company_acquisition:pay',counterparty:r.id},{beforeInsert:key=>registerItemTransactionUndo(c,()=>c.query('DELETE FROM transactions WHERE id=$1',[key]))});receiveJournal=await ledger(c,{characterId:seller.id,currency:'cash',amount:price,reason:'company_acquisition:receive',counterparty:r.id},{beforeInsert:key=>registerItemTransactionUndo(c,()=>c.query('DELETE FROM transactions WHERE id=$1',[key]))});buyer.cash=beforeBuyer-price;seller.cash=beforeSeller+price;await c.query('UPDATE characters SET cash=$2 WHERE id=$1',[buyer.id,buyer.cash]);await c.query('UPDATE characters SET cash=$2 WHERE id=$1',[seller.id,seller.cash]);
 const transferred=await c.query("UPDATE business_depots SET owner_character=$3 WHERE id=$1 AND owner_character=$2 AND status='open'",[depot.id,seller.id,buyer.id]);if(transferred.rowCount!==1)fail('owner_changed');const post=(await c.query('SELECT * FROM business_depots WHERE id=$1',[depot.id])).rows[0];if(stable({...depot,owner_character:buyer.id})!==stable(post)||+await clock(c)>=+new Date(r.expires_at))fail('expired_or_assets_changed');scopes.getStore().settled={depot:JSON.parse(stable(post)),record:r,payJournal,receiveJournal,buyer,seller,buyerCash:buyer.cash,sellerCash:seller.cash};return {kind:ACQUISITION_CAPABILITY,payJournal,receiveJournal,retirement:proof.retirement};}
async function assertSettlementJournals(c,x){
 const legs=(await c.query("SELECT * FROM transactions WHERE counterparty=$1 AND currency='cash' AND reason IN ('company_acquisition:pay','company_acquisition:receive') ORDER BY id LIMIT 3",[x.record.id])).rows;
 const now=await clock(c),price=Number(x.record.price);
 if(legs.length!==2||!legs.some(j=>j.id===x.payJournal&&j.character_id===x.buyer.id&&j.currency==='cash'&&j.counterparty===x.record.id&&j.reason==='company_acquisition:pay'&&Number(j.amount)===-price)
  ||!legs.some(j=>j.id===x.receiveJournal&&j.character_id===x.seller.id&&j.currency==='cash'&&j.counterparty===x.record.id&&j.reason==='company_acquisition:receive'&&Number(j.amount)===price)
  ||legs.some(j=>!Number.isFinite(+new Date(j.at))||+new Date(j.at)<+new Date(x.record.accepted_at)||+new Date(j.at)>+now))fail('late_source_changed');
}
const guarded=fn=>async args=>{assertItemTransaction(args.client);try{return await fn(args);}catch(e){poisonItemTransaction(args.client,e);throw e;}};
async function withPartiesImpl(c,first,second,execute){assertItemTransaction(c);if(typeof execute!=='function'||scopes.getStore()?.active||first?.id===second?.id||first?.account_id===second?.account_id)fail('parties');const people=[first,second];for(const who of [...people].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){const ch=(await c.query('SELECT id,account_id,alive,is_npc FROM characters WHERE id=$1 FOR UPDATE',[id(who.id)])).rows[0];if(!ch?.alive||ch.is_npc||ch.account_id!==who.account_id)fail('parties');}for(const a of people.map(x=>x.account_id).sort())if((await c.query('SELECT status FROM accounts WHERE id=$1 FOR UPDATE',[id(a)])).rows[0]?.status!=='active')fail('accounts');return scopes.run({active:true,client:c,characters:people.map(x=>x.id)},async()=>{const scope=scopes.getStore();try{const result=await execute();if(scope.settled){const x=scope.settled,d=(await c.query('SELECT * FROM business_depots WHERE id=$1',[x.depot.id])).rows[0],r=(await c.query('SELECT state,pay_journal,receive_journal FROM company_acquisitions WHERE id=$1',[x.record.id])).rows[0];if(stable(d)!==stable(x.depot)||r?.state!=='executed'||r.pay_journal!==x.payJournal||r.receive_journal!==x.receiveJournal||x.buyer.cash!==x.buyerCash||x.seller.cash!==x.sellerCash||+await clock(c)>=+new Date(x.record.expires_at))fail('late_source_changed');await assertSettlementJournals(c,x);await assertNoObligations(c,d.id);}return result;}catch(e){poisonItemTransaction(c,e);throw e;}finally{scope.active=false;}});}
async function withParties(c,...args){assertItemTransaction(c);try{return await withPartiesImpl(c,...args);}catch(e){poisonItemTransaction(c,e);throw e;}}
export const canonicalDepotAcquisitionRuntime=Object.freeze({kind:ACQUISITION_CAPABILITY,withParties,assertEligible:guarded(inspect),settle:guarded(settle)});
