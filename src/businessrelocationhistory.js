import crypto from 'node:crypto';
const stable=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const hash=value=>crypto.createHash('sha256').update(stable(value)).digest('hex');
// Private full-book diagnostic, never a public board or a permission grant.
export async function collectBusinessRelocationIssues(c){
 const plans=(await c.query('SELECT * FROM business_relocation_plans ORDER BY id')).rows;
 const returns=(await c.query("SELECT id FROM business_depot_journal WHERE reason='inventory_relocation_return' ORDER BY id")).rows;
 const issues=[],used=new Set(),usedReturns=new Set();
 for(const p of plans){
  const bad=reason=>issues.push({planId:p.id,reason}),s=p.source_snapshot,d=s?.depot;
  if(!s||hash(s)!==p.source_hash||d?.id!==p.depot_id||d.owner_character!==p.original_character||s.original!==p.original_character||s.account!==p.account_id||s.destination!==p.destination){bad('source');continue;}
  const original=(await c.query('SELECT account_id FROM characters WHERE id=$1',[p.original_character])).rows[0];if(original?.account_id!==p.account_id)bad('original_identity');
  if(p.state!=='executed'){if(p.receipt!==null)bad('nonexecution_receipt');continue;}
  const r=p.receipt,o=r?.outcome,qty=Number(d.stock),cost=Number(d.stock_cost);
  if(p.revision!==2||!r?.ok||r.planId!==p.id||r.businessId!==p.depot_id||r.originalCharacterId!==p.original_character||r.sourceHash!==p.source_hash||r.state!=='executed'||o?.businessId!==p.depot_id||o.origin!==s.origin||o.destination!==p.destination||o.stockMoved!==qty||o.stockCostPreserved!==cost||o.travelCost!==s.travelCost){bad('receipt');continue;}
  const travel=(await c.query('SELECT character_id,currency,amount,reason FROM transactions WHERE id=$1',[o.travelJournal])).rows[0];
  if(!travel||travel.character_id!==p.original_character||travel.currency!=='cash'||travel.reason!=='travel'||Number(travel.amount)!==-s.travelCost||used.has(o.travelJournal))bad('travel');used.add(o.travelJournal);
  if(qty===0){if(cost!==0||o.withdrawalJournal!==null||o.returnJournal!==null)bad('empty_stock');continue;}
  const legs=(await c.query('SELECT * FROM business_depot_journal WHERE id IN ($1,$2) ORDER BY id',[o.withdrawalJournal,o.returnJournal])).rows;
  if(used.has(o.withdrawalJournal)||used.has(o.returnJournal)||o.withdrawalJournal===o.returnJournal||legs.length!==2
   ||!legs.some(j=>j.id===o.withdrawalJournal&&j.depot_id===p.depot_id&&j.reason==='inventory_withdrawal'&&Number(j.stock_delta)===-qty&&Number(j.cost_delta)===-cost)
   ||!legs.some(j=>j.id===o.returnJournal&&j.depot_id===p.depot_id&&j.reason==='inventory_relocation_return'&&Number(j.stock_delta)===qty&&Number(j.cost_delta)===cost)
   ||legs.some(j=>Number(j.cash_delta)!==0||Number(j.expense)!==0||j.source_journal_id!==null||j.franchise_license_id!==null))bad('stock_journals');
  used.add(o.withdrawalJournal);used.add(o.returnJournal);usedReturns.add(o.returnJournal);
 }
 for(const row of returns)if(!usedReturns.has(row.id))issues.push({journalId:row.id,reason:'orphan_return'});
 return issues;
}
