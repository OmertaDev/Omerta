import crypto from 'node:crypto';
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item)).digest('hex');
export async function collectPickingPackingIssues(c){
  const jobs=(await c.query('SELECT * FROM picking_packing_jobs ORDER BY id')).rows;
  const ledger=(await c.query("SELECT * FROM transactions WHERE reason IN ('picking_packing:pay','picking_packing:receive') ORDER BY id")).rows;
  const requests=(await c.query('SELECT * FROM picking_packing_requests ORDER BY account_id,request_key')).rows;
  const issues=[],used=new Set(),journals=new Set();
  for(const actor of new Set(jobs.flatMap(j=>[j.tenant_character,j.provider_character])))if(jobs.filter(j=>[j.tenant_character,j.provider_character].includes(actor)&&['requested','accepted'].includes(j.state)).length>3)issues.push({id:actor,reason:'active_limit'});
  for(const job of jobs){
    const lease=(await c.query('SELECT depot_id,tenant_character,landlord_character,units,fee_cash,offer_revision FROM business_warehouse_leases WHERE id=$1',[job.lease_id])).rows[0],s=job.source;
    const tenant=(await c.query('SELECT account_id FROM characters WHERE id=$1',[job.tenant_character])).rows[0],provider=(await c.query('SELECT account_id FROM characters WHERE id=$1',[job.provider_character])).rows[0];
    if(!lease||lease.depot_id!==job.depot_id||lease.tenant_character!==job.tenant_character||lease.landlord_character!==job.provider_character||tenant?.account_id!==job.tenant_account||provider?.account_id!==job.provider_account
      ||job.tenant_account===job.provider_account||!s||hash(s)!==job.source_hash||s.leaseId!==job.lease_id||s.depotId!==job.depot_id||s.tenantCharacter!==job.tenant_character||s.providerCharacter!==job.provider_character||s.good!=='gin'
      ||s.units!==Number(lease.units)||s.rentCash!==Number(lease.fee_cash)||s.offerRevision!==Number(lease.offer_revision)||!Array.isArray(s.journalIds)||s.journalIds.length<1||s.journalIds.length>200||new Set(s.journalIds).size!==s.journalIds.length)issues.push({id:job.id,reason:'original_source'});
    else{let held=0;for(const [index,id]of s.journalIds.entries()){const j=(await c.query('SELECT * FROM business_depot_journal WHERE id=$1',[id])).rows[0];if(!j||j.lease_id!==job.lease_id||j.depot_id!==job.depot_id||j.customer_character!==job.tenant_character||Number(j.lease_sequence)!==index+1){issues.push({id:job.id,reason:'source_journal'});continue;}held+=Number(j.lease_stock_delta);if(Number(j.lease_stock_after)!==held)issues.push({id:job.id,reason:'source_custody'});if(id===s.rentJournal&&(j.reason!=='warehouse_rent'||j.warehouse_rent_lease_id!==job.lease_id||Number(j.cash_delta)!==s.rentCash))issues.push({id:job.id,reason:'source_rent'});}if(held!==s.heldQty||s.sequence!==s.journalIds.length||!s.journalIds.includes(s.rentJournal))issues.push({id:job.id,reason:'source_custody'});}
    if(job.state!=='fulfilled')continue;const r=job.receipt;
    const legs=ledger.filter(t=>t.counterparty===job.id),debit=legs.find(t=>t.id===r?.debit),credit=legs.find(t=>t.id===r?.credit);
    if(legs.length!==2||!debit||!credit||debit.currency!=='cash'||credit.currency!=='cash'||debit.reason!=='picking_packing:pay'||credit.reason!=='picking_packing:receive'
      ||debit.character_id!==job.tenant_character||credit.character_id!==job.provider_character||debit.account_id!==job.tenant_account||credit.account_id!==job.provider_account
      ||Number(debit.amount)!==-Number(job.fee_cash)||Number(credit.amount)!==Number(job.fee_cash))issues.push({id:job.id,reason:'fee_witness'});
    for(const leg of legs)used.add(leg.id);
    const j=r?(await c.query('SELECT * FROM business_depot_journal WHERE id=$1',[r.warehouseJournal])).rows[0]:null;
    if(!r||r.jobId!==job.id||r.state!=='fulfilled'||r.leaseId!==job.lease_id||r.quantity!==Number(job.quantity)||r.feeCash!==Number(job.fee_cash)
      ||r.tenantCharacter!==job.tenant_character||r.providerCharacter!==job.provider_character||!j||journals.has(j.id)||j.lease_id!==job.lease_id||j.depot_id!==job.depot_id
      ||j.reason!=='warehouse_withdraw'||j.customer_character!==job.tenant_character||Number(j.lease_sequence)!==Number(job.source.sequence)+1
      ||Number(j.lease_stock_delta)!==-Number(job.quantity)||Number(j.lease_stock_after)!==r.heldAfter||r.heldBefore!==Number(job.source.heldQty)
      ||r.heldBefore-r.heldAfter!==Number(job.quantity)||r.cargoAfter-r.cargoBefore!==Number(job.quantity))issues.push({id:job.id,reason:'custody_witness'});
    if(j)journals.add(j.id);
    if(requests.filter(q=>q.account_id===job.provider_account&&q.actor_ref===job.provider_character&&q.receipt?.jobId===job.id&&q.receipt?.state==='fulfilled').length!==1)issues.push({id:job.id,reason:'receipt_binding'});
  }
  for(const row of ledger)if(!used.has(row.id))issues.push({id:row.id,reason:'unbound_fee'});
  for(const q of requests){const j=jobs.find(j=>j.id===q.receipt?.jobId);if(!j||j.id!==q.job_id||![j.tenant_account,j.provider_account].includes(q.account_id)||q.actor_ref!==(q.account_id===j.tenant_account?j.tenant_character:j.provider_character))issues.push({id:q.request_key,reason:'request_binding'});}
  return issues;
}
