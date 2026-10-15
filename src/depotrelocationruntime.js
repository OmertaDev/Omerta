// Canonical relocation retains original stock, costs, authority and paid travel.
import crypto from 'node:crypto';
import fs from 'node:fs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {GameError,travel,trunkCap,ledger} from './game.js';
import {withdrawDepotStock,depotPilotEnabled} from './depot.js';
import {bookDepot} from './depotbook.js';
import {guardDelegatedControl,latestPolicy} from './operatingpolicy.js';
import {latestSupplyContract} from './supplycontracts.js';
import {assertItemTransaction,itemTransactionIdentity,poisonItemTransaction} from './items.js';
import {prelockEquipmentRentalDeathActors,assertEquipmentRentalDeathScope} from './equipmentrentals.js';
import {DISTRICTS,CONSTANTS,jailed,safeHoused} from './rules.js';
const scopes=new AsyncLocalStorage(),REFERENCES=Object.freeze(["agent_operating_memory_facts:business_id","business_depot_journal:depot_id","business_external_costs:depot_id","business_operating_policies:depot_id","business_partnerships:depot_id","business_relocation_plans:depot_id","business_season_entries:depot_id","business_supply_contracts:depot_id","business_warehouse_leases:depot_id","commercial_disputes:depot_id","commercial_negotiations:depot_id","commercial_premises_leases:depot_id","commercial_premises_offers:depot_id","commissioned_crafting_contracts:business_id","company_acquisitions:depot_id","company_logistics_hubs:depot_id","company_operator_receipts:depot_id","company_operators:depot_id","company_production_receipts:business_id","company_restructuring_plans:depot_id","company_specialization_runs:business_id","company_specializations:business_id","company_succession_receipts:depot_id","company_workflows:depot_id","contract_auctions:depot_id","customer_vault_services:depot_id","delivery_commitments:depot_id","depot_brand_licenses:operator_depot_id","depot_brand_licenses:recipient_depot_id","economic_intelligence_publications:depot_id","employment_organizations:depot_id","funded_external_work_jobs:depot_id","game_employment_jobs:depot_id","infrastructure_concessions:business_id","logistics_coverage_policies:depot_id","market_listings:depot_id","manufacturing_licenses:licensee_business","manufacturing_licenses:licensor_business","picking_packing_jobs:depot_id","production_slot_reservations:business_id","strategy_laboratories:business_id","supply_tenders:depot_id","territory_economics_profiles:business_id","worker_training_courses:depot_id","workshop_floor_requests:business_ref","workshop_floorplans:business_id"]);
const fail=reason=>{throw new GameError('business_relocation',reason);};
const stable=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
const CODE=Object.freeze(Object.fromEntries(['depot.js','game.js','depotbook.js','depotrelocationruntime.js','businessrelocation.js','rules.js','rules.generated.js','rules.tail.js','operatingpolicy.js','supplycontracts.js','companyspecialization.js','equipmentrentals.js','items.js','workshopfloor.js','workshopfloor-admission.js'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(new URL(name,import.meta.url))).digest('hex')])));
const clock=async c=>new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
function scope(c){assertItemTransaction(c);const s=scopes.getStore();if(!s?.active||s.client!==c||s.transaction!==itemTransactionIdentity(c))fail('scope');return s;}
async function obligations(c,d){
 const refs=(await c.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('depot_id','operator_depot_id','recipient_depot_id','business_id','business_ref','licensor_business','licensee_business') ORDER BY table_name,column_name")).rows.map(r=>r.table_name+':'+r.column_name).sort();
 if(stable(refs)!==stable(REFERENCES))fail('unsupported_schema');
 const licenses=(await c.query('SELECT id,state,expires_at FROM manufacturing_licenses WHERE (licensor_business=$1 OR licensee_business=$1) IS TRUE ORDER BY id',[d.id])).rows;
 if(licenses.length){if((await (await import('./manufacturinglicensesinvariants.js')).collectManufacturingLicenseIssues(c)).length)fail('manufacturing_license_history');const now=await clock(c);if(licenses.some(row=>['offered','accepted'].includes(row.state)&&new Date(row.expires_at)>now))fail('manufacturing_license_obligation');}
 const floorIssues=await (await import('./workshopfloor.js')).collectWorkshopFloorIssues(c);if(floorIssues.length)fail('floor_history');
 const floor=(await c.query('SELECT * FROM workshop_floorplans WHERE business_id=$1 FOR UPDATE',[d.id])).rows[0];
 if(floor&&(!Array.isArray(floor.allocations)||floor.allocations.length!==0))fail('workshop_floor_allocations');
 if(d.warehouse_enabled)fail('warehouse_offer');
 if((await c.query("SELECT 1 FROM commercial_premises_leases WHERE (landlord_character=$1 OR tenant_character=$1) AND state='active' AND expires_at>clock_timestamp() LIMIT 1",[d.owner_character])).rows.length)fail('original_paid_occupancy');
 if((await c.query("SELECT 1 FROM business_warehouse_leases WHERE (landlord_character=$1 OR tenant_character=$1) AND (held_qty<>0 OR (status='active' AND expires_at>clock_timestamp())) LIMIT 1",[d.owner_character])).rows.length)fail('original_warehouse_custody');
 if((await c.query("SELECT 1 FROM equipment_rental_leases WHERE (landlord_character=$1 OR borrower_character=$1) AND status='active' LIMIT 1",[d.owner_character])).rows.length)fail('original_equipment_custody');
 if((await c.query("SELECT 1 FROM business_partnerships WHERE depot_id=$1 AND state IN ('funding','active') LIMIT 1",[d.id])).rows.length)fail("business_partnerships_obligation");
 if((await c.query("SELECT 1 FROM business_season_entries WHERE depot_id=$1 AND final_result IS NULL LIMIT 1",[d.id])).rows.length)fail("business_season_entries_obligation");
 if((await c.query("SELECT 1 FROM business_warehouse_leases WHERE depot_id=$1 AND (held_qty<>0 OR (status='active' AND expires_at>clock_timestamp())) LIMIT 1",[d.id])).rows.length)fail("business_warehouse_leases_obligation");
 if((await c.query("SELECT 1 FROM commercial_disputes WHERE depot_id=$1 AND state='agreed' LIMIT 1",[d.id])).rows.length)fail("commercial_disputes_obligation");
 if((await c.query("SELECT 1 FROM commercial_premises_leases WHERE depot_id=$1 AND state='active' AND expires_at>clock_timestamp() LIMIT 1",[d.id])).rows.length)fail("commercial_premises_leases_obligation");
 if((await c.query("SELECT 1 FROM commercial_premises_offers WHERE depot_id=$1 AND state='offered' AND expires_at>clock_timestamp() LIMIT 1",[d.id])).rows.length)fail("commercial_premises_offers_obligation");
 if((await c.query("SELECT 1 FROM commissioned_crafting_contracts WHERE business_id=$1 AND status='accepted' LIMIT 1",[d.id])).rows.length)fail("commissioned_crafting_contracts_obligation");
 if((await c.query("SELECT 1 FROM company_acquisitions WHERE depot_id=$1 AND state='accepted' LIMIT 1",[d.id])).rows.length)fail("company_acquisitions_obligation");
 if((await c.query("SELECT 1 FROM company_logistics_hubs WHERE depot_id=$1 AND state='active' LIMIT 1",[d.id])).rows.length)fail("company_logistics_hubs_obligation");
 if((await c.query("SELECT 1 FROM company_restructuring_plans WHERE depot_id=$1 AND state='ready' AND expires_at>clock_timestamp() LIMIT 1",[d.id])).rows.length)fail("company_restructuring_plans_obligation");
 if((await c.query("SELECT 1 FROM company_workflows WHERE depot_id=$1 AND status='active' LIMIT 1",[d.id])).rows.length)fail("company_workflows_obligation");
 if((await c.query("SELECT 1 FROM customer_vault_services WHERE depot_id=$1 AND state IN ('open','draining') LIMIT 1",[d.id])).rows.length)fail("customer_vault_services_obligation");
 if((await c.query("SELECT 1 FROM delivery_commitments WHERE depot_id=$1 AND status NOT IN ('delivered','expired') LIMIT 1",[d.id])).rows.length)fail("delivery_commitments_obligation");
 if((await c.query("SELECT 1 FROM depot_brand_licenses WHERE (operator_depot_id=$1 OR recipient_depot_id=$1) AND status='active' LIMIT 1",[d.id])).rows.length)fail("depot_brand_licenses_obligation");
 if((await c.query("SELECT 1 FROM funded_external_work_jobs WHERE depot_id=$1 AND state<>'recovered' LIMIT 1",[d.id])).rows.length)fail("funded_external_work_jobs_obligation");
 if((await c.query("SELECT 1 FROM game_employment_jobs WHERE depot_id=$1 AND (state='open' OR escrow_cash<>0) LIMIT 1",[d.id])).rows.length)fail("game_employment_jobs_obligation");
 if((await c.query("SELECT 1 FROM infrastructure_concessions WHERE business_id=$1 AND state='accepted' LIMIT 1",[d.id])).rows.length)fail("infrastructure_concessions_obligation");
 if((await c.query("SELECT 1 FROM logistics_coverage_policies WHERE depot_id=$1 AND (escrow_cash<>0 OR state IN ('active','claimable')) LIMIT 1",[d.id])).rows.length)fail("logistics_coverage_policies_obligation");
 if((await c.query("SELECT 1 FROM market_listings WHERE depot_id=$1 AND (kind<>'order' OR status NOT IN ('sold','cancelled','expired') OR qty<>0 OR filled_qty<>0) LIMIT 1",[d.id])).rows.length)fail("market_listings_obligation");
 if((await c.query("SELECT 1 FROM picking_packing_jobs WHERE depot_id=$1 AND state='accepted' LIMIT 1",[d.id])).rows.length)fail("picking_packing_jobs_obligation");
 if((await c.query("SELECT 1 FROM production_slot_reservations WHERE business_id=$1 AND status='active' LIMIT 1",[d.id])).rows.length)fail("production_slot_reservations_obligation");
 if((await c.query("SELECT 1 FROM strategy_laboratories WHERE business_id=$1 AND state='active' LIMIT 1",[d.id])).rows.length)fail("strategy_laboratories_obligation");
 if((await c.query("SELECT 1 FROM territory_economics_profiles WHERE business_id=$1 AND enabled=true AND state='active' LIMIT 1",[d.id])).rows.length)fail("territory_economics_profiles_obligation");
 if((await c.query("SELECT 1 FROM worker_training_courses WHERE depot_id=$1 AND (escrow_cash<>0 OR state='active') LIMIT 1",[d.id])).rows.length)fail("worker_training_courses_obligation");

 if((await c.query("SELECT r.id FROM delivery_loan_requests r JOIN market_listings o ON o.id=r.order_id WHERE o.depot_id=$1 AND r.state IN ('offered','active') LIMIT 1",[d.id])).rows.length)fail('delivery_finance');
 if((await c.query("SELECT 1 FROM customer_vault_positions p JOIN customer_vault_services v ON v.id=p.service_id WHERE v.depot_id=$1 AND (p.state='funded' OR p.remaining<>0) LIMIT 1",[d.id])).rows.length)fail('vault_funded_position');
 if((await c.query("SELECT 1 FROM game_employment_assignments a JOIN game_employment_jobs j ON j.id=a.employment_id JOIN delivery_commitments d ON d.id=a.commitment_id WHERE j.depot_id=$1 AND a.state='assigned' AND d.status<>'expired' LIMIT 1",[d.id])).rows.length)fail('unpaid_accepted_work');
 const book=(await c.query('SELECT COALESCE(SUM(cash_delta),0) cash,COALESCE(SUM(stock_delta),0) stock,COALESCE(SUM(cost_delta),0) cost FROM business_depot_journal WHERE depot_id=$1',[d.id])).rows[0];
 if(Number(book.cash)!==Number(d.treasury)||Number(book.stock)!==Number(d.stock)||Number(book.cost)!==Number(d.stock_cost))fail('asset_books');
}
async function assertScope(c,ch,h,{agent}){
 const s=scope(c);if(typeof agent!=='boolean'||ch.id!==s.original||ch.account_id!==s.account||!ch.alive||ch.is_npc||h.accountId!==s.account||h.ledger!==ledger||!h.owned?.cargo)fail('scope_actor');
 await assertEquipmentRentalDeathScope(c,s.original,s.prelock);
 const current=(await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2',[s.account])).rows;
 if(current.length!==1||current[0].id!==s.original||(await c.query('SELECT status FROM accounts WHERE id=$1',[s.account])).rows[0]?.status!=='active')fail('original_owner');
 s.ch=ch;s.h=h;
}
async function authorities(c,businessId){return {
 policy:await latestPolicy(c,businessId,true),cadence:await latestSupplyContract(c,businessId,true),
 operator:(await c.query('SELECT * FROM company_operators WHERE depot_id=$1 FOR UPDATE',[businessId])).rows[0]||null,
 specialization:(await c.query('SELECT * FROM company_specializations WHERE business_id=$1 FOR UPDATE',[businessId])).rows[0]||null,
 floor:(await c.query('SELECT * FROM workshop_floorplans WHERE business_id=$1 FOR UPDATE',[businessId])).rows[0]||null};}
async function inspect(c,ch,h,{businessId,destination,agent,purpose}){
 await assertScope(c,ch,h,{agent});const s=scope(c);
 const d=(await c.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE',[businessId])).rows[0];
 if(!d||d.status!=='open'||d.owner_character!==s.original)fail('owner');
 await guardDelegatedControl(c,d.id,agent);
 if(purpose==='cancel')return {sourceHash:null,snapshot:null};
 if(!depotPilotEnabled()||jailed(ch)||safeHoused(ch))fail('owner_action_unavailable');
 if(!DISTRICTS.some(x=>x.id===destination)||destination===d.district||ch.loc!==d.district)fail('location');
 if(!Number.isSafeInteger(Number(d.stock))||Number(d.stock)<0||Number(d.stock)>40||!Number.isSafeInteger(Number(d.stock_cost))||Number(d.stock_cost)<0||(Number(d.stock)===0&&Number(d.stock_cost)!==0))fail('stock');
 await obligations(c,d);
 const authority=await authorities(c,d.id);
 if((authority.operator&&(authority.operator.owner_character!==s.original||authority.operator.owner_account!==s.account))||(authority.specialization&&(authority.specialization.original_character!==s.original||authority.specialization.account_id!==s.account)))fail('foreign_authority');
 const cargo={...h.owned.cargo},capacity=trunkCap(h);
 if(!Number.isSafeInteger(capacity)||capacity<0||Object.values(cargo).some(q=>!Number.isSafeInteger(Number(q))||Number(q)<0)||Object.values(cargo).reduce((n,q)=>n+Number(q),0)+Number(d.stock)>capacity)fail('cargo');
 const snapshot={code:CODE,depot:d,authority,cargo,capacity,travelCost:CONSTANTS.TRAVEL_COST,original:s.original,account:s.account,origin:ch.loc,destination};
 return {sourceHash:hash(snapshot),snapshot};
}
export function recordBusinessRelocationWithdrawal(c,witness){
 const current=scopes.getStore();if(!current?.active)return;
 const s=scope(c),expected=s.expectedWithdrawal;
 if(s.action!=='execute'||!expected||s.withdrawal||witness.businessId!==expected.businessId||witness.characterId!==expected.characterId||witness.quantity!==expected.quantity||witness.cost!==expected.cost||typeof witness.journalId!=='string')fail('withdrawal_scope');
 s.withdrawal={...witness};
}
async function execute(c,ch,h,{plan,agent}){
 const s=scope(c);if(s.completed||s.action!=='execute'||s.terms.planId!==plan.id||s.terms.sourceHash!==plan.source_hash||plan.original_character!==s.original||plan.account_id!==s.account||plan.state!=='ready'||plan.revision!==1)fail('plan_scope');
 const before=await inspect(c,ch,h,{businessId:plan.depot_id,destination:plan.destination,agent});
 if(before.sourceHash!==plan.source_hash||stable(before.snapshot)!==stable(plan.source_snapshot)||+await clock(c)>=+new Date(plan.expires_at))fail('source_changed_or_expired');
 const d=before.snapshot.depot,qty=Number(d.stock),cost=Number(d.stock_cost),cash=Number(ch.cash),oldCargo={...h.owned.cargo};
 let withdrawal=null,returned=null;
 if(qty){
  s.expectedWithdrawal={businessId:d.id,characterId:ch.id,quantity:qty,cost};
  await withdrawDepotStock(ch,d.id,qty,c,h);
  if(!s.withdrawal)fail('canonical_withdrawal_hook_missing');withdrawal=s.withdrawal.journalId;s.expectedWithdrawal=null;
  const actual=(await c.query('SELECT * FROM business_depot_journal WHERE id=$1',[withdrawal])).rows[0];
  if(!actual||actual.depot_id!==d.id||actual.reason!=='inventory_withdrawal'||Number(actual.stock_delta)!==-qty||Number(actual.cost_delta)!==-cost||Number(actual.cash_delta)!==0||Number(actual.expense)!==0)fail('withdrawal_witness');
 }
 let travelJournal=null;
 const moved=await travel(ch,plan.destination,c,{...h,ledger:async(client,data)=>{if(travelJournal||client!==c||data.characterId!==ch.id||data.reason!=='travel'||data.currency!=='cash')fail('travel_witness');travelJournal=await h.ledger(client,data);return travelJournal;}});
 if(!travelJournal||ch.loc!==plan.destination||cash-Number(ch.cash)!==moved.cost||moved.cost!==before.snapshot.travelCost||stable(h.owned.cargo)!==stable({...oldCargo,...(qty?{gin:Number(oldCargo.gin||0)+qty}:{})}))fail('travel_changed');
 if(qty){
  const actual=(await c.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'",[ch.id])).rows[0];if(Number(actual?.qty)!==Number(oldCargo.gin||0)+qty)fail('cargo_witness');
  h.owned.cargo={...oldCargo};await c.query("DELETE FROM character_cargo WHERE character_id=$1 AND good_id='gin'",[ch.id]);if(Number(oldCargo.gin||0))await c.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',$2)",[ch.id,Number(oldCargo.gin)]);
  const emptied=(await c.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE',[d.id])).rows[0];if(Number(emptied.stock)!==0||Number(emptied.stock_cost)!==0)fail('withdrawal_source');
  returned=await bookDepot(c,emptied,'inventory_relocation_return',{stock:qty,cost});
 }
 const changed=await c.query("UPDATE business_depots SET district=$3 WHERE id=$1 AND owner_character=$2 AND status='open' AND district=$4",[d.id,ch.id,plan.destination,d.district]);if(changed.rowCount!==1)fail('district_changed');
 s.completed={plan,ch,h,authority:before.snapshot.authority,expected:{...d,district:plan.destination},cargo:oldCargo,cash:Number(ch.cash),withdrawal,returned,travelJournal,moved};
 await final(c);return {businessId:d.id,origin:d.district,destination:plan.destination,stockMoved:qty,stockCostPreserved:cost,travelCost:moved.cost,travelJournal,withdrawalJournal:withdrawal,returnJournal:returned};
}
async function final(c,recorded=false){
 const s=scope(c),x=s.completed;if(!x)return;
 const d=(await c.query('SELECT * FROM business_depots WHERE id=$1',[x.expected.id])).rows[0];
 if(stable(d)!==stable(x.expected)||x.ch.loc!==x.expected.district||Number(x.ch.cash)!==x.cash||stable(x.h.owned.cargo)!==stable(x.cargo)||+await clock(c)>=+new Date(x.plan.expires_at))fail('late_source_changed');
 await obligations(c,d);if(stable(await authorities(c,d.id))!==stable(x.authority))fail('authority_changed');
 if(recorded){const r=(await c.query('SELECT state,revision,receipt FROM business_relocation_plans WHERE id=$1',[x.plan.id])).rows[0];if(r?.state!=='executed'||r.revision!==2||r.receipt?.outcome?.withdrawalJournal!==x.withdrawal||r.receipt?.outcome?.returnJournal!==x.returned||r.receipt?.outcome?.travelJournal!==x.travelJournal)fail('late_receipt');}
 const travelRow=(await c.query('SELECT * FROM transactions WHERE id=$1',[x.travelJournal])).rows[0];
 if(!travelRow||travelRow.character_id!==s.original||travelRow.currency!=='cash'||travelRow.reason!=='travel'||Number(travelRow.amount)!==-x.moved.cost)fail('travel_journal');
 if(x.returned){const legs=(await c.query('SELECT * FROM business_depot_journal WHERE id IN ($1,$2) ORDER BY id',[x.withdrawal,x.returned])).rows;
 if(legs.length!==2||!legs.some(j=>j.id===x.withdrawal&&j.depot_id===d.id&&j.reason==='inventory_withdrawal'&&Number(j.stock_delta)===-Number(d.stock)&&Number(j.cost_delta)===-Number(d.stock_cost))||!legs.some(j=>j.id===x.returned&&j.depot_id===d.id&&j.reason==='inventory_relocation_return'&&Number(j.stock_delta)===Number(d.stock)&&Number(j.cost_delta)===Number(d.stock_cost))||legs.some(j=>Number(j.cash_delta)!==0||Number(j.expense)!==0||j.source_journal_id!==null||j.franchise_license_id!==null))fail('journal_witness');}
}
async function withScope(c,account,{action,terms},run){
 assertItemTransaction(c);if(scopes.getStore()?.active||typeof run!=='function')fail('scope');
 try{
  const current=(await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2',[account])).rows;if(current.length!==1)fail('original_owner');
  const prelock=await prelockEquipmentRentalDeathActors(c,[current[0].id]);
  return await scopes.run({active:true,client:c,transaction:itemTransactionIdentity(c),account,original:current[0].id,prelock:prelock.scope,action,terms},async()=>{const s=scope(c);try{const result=await run();await assertEquipmentRentalDeathScope(c,s.original,s.prelock);await final(c,true);return result;}finally{s.active=false;}});
 }catch(error){poisonItemTransaction(c,error);throw error;}
}
export const canonicalDepotRelocationRuntime=Object.freeze({kind:'canonical_depot_relocation_v1',withScope,assertScope,inspect,execute});
