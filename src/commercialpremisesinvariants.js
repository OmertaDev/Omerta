// Rent is a direct backed character-to-character transfer, never an escrow.
// Run within the canonical invariant's consistent snapshot.
export async function commercialPremisesInvariant(client) {
  const leases=(await client.query('SELECT id,offer_id,slot,tenant_account,tenant_character,landlord_character,state,expires_at,rent_cash FROM commercial_premises_leases')).rows;
  const transfers=(await client.query("SELECT counterparty,reason,amount,character_id FROM transactions WHERE currency='cash' AND reason LIKE 'commercial_premises:rent:%'")).rows;
  const defects=[], leaseIds=new Set(leases.map(lease=>lease.id)), byLease=new Map();
  for (const row of transfers) {
    if (!byLease.has(row.counterparty)) byLease.set(row.counterparty,[]);
    byLease.get(row.counterparty).push(row);
  }
  for (const lease of leases) {
    const rows=byLease.get(lease.id)||[], rent=Number(lease.rent_cash);
    const paid=rows.filter(row=>row.reason==='commercial_premises:rent:pay' && Number(row.amount)===-rent && row.character_id===lease.tenant_character);
    const received=rows.filter(row=>row.reason==='commercial_premises:rent:receive' && Number(row.amount)===rent && row.character_id===lease.landlord_character);
    if (rows.length!==2 || paid.length!==1 || received.length!==1 || paid[0].character_id===received[0].character_id) defects.push({ leaseId:lease.id,reason:'rent_backing' });
  }
  for (const row of transfers) if (!leaseIds.has(row.counterparty)) defects.push({ leaseId:row.counterparty,reason:'orphan_transfer' });
  const occupied=new Set();
  for (const lease of leases.filter(row=>row.state==='active')) {
    const key=`${lease.offer_id}:${lease.slot}`;
    if (occupied.has(key)) defects.push({ leaseId:lease.id,reason:'duplicate_slot' }); occupied.add(key);
  }
  return { name:'commercial premises paid occupancy',ok:!defects.length,leases:leases.length,defects };
}
