// Read-only metadata/proof reconciliation; canonical monetary books remain authoritative.
export async function runCompanyWorkflowInvariants(client) {
  const workflows = (await client.query('SELECT * FROM company_workflows ORDER BY id')).rows;
  const issues = [];
  for (const row of workflows) {
    const proofs = (await client.query('SELECT * FROM company_workflow_proofs WHERE workflow_id=$1', [row.id])).rows;
    const counts = ['procurement', 'custody', 'delivery'].map(stage => proofs.filter(p => p.stage === stage).length);
    const expected = [row.completed_stages >= 1 ? 1 : 0, row.completed_stages >= 2 ? 3 : 0, row.completed_stages >= 3 ? 1 : 0];
    if (counts.some((count, n) => count !== expected[n]) || (row.status === 'completed') !== (row.completed_stages === 3)) issues.push({ id: row.id, reason: 'stage_proofs' });
    const actor = (await client.query('SELECT account_id FROM characters WHERE id=$1', [row.original_character])).rows[0];
    const commitment = (await client.query('SELECT supplier_character FROM delivery_commitments WHERE id=$1', [row.commitment_id])).rows[0];
    const lease = (await client.query('SELECT tenant_character FROM business_warehouse_leases WHERE id=$1', [row.lease_id])).rows[0];
    if (actor?.account_id !== row.account_id || commitment?.supplier_character !== row.original_character || lease?.tenant_character !== row.original_character) issues.push({ id: row.id, reason: 'source_ownership' });
    for (const proof of proofs) {
      const source = proof.source_type === 'finance'
        ? (await client.query('SELECT state,supplier_character FROM delivery_loan_requests WHERE id=$1', [proof.source_id])).rows[0]
        : (await client.query('SELECT id FROM business_depot_journal WHERE id=$1', [proof.source_id])).rows[0];
      if (!source || (proof.source_type === 'finance' && (source.state !== 'settled' || source.supplier_character !== row.original_character))) issues.push({ id: row.id, reason: 'missing_settled_source', sourceId: proof.source_id });
    }
  }
  const receipts = (await client.query('SELECT account_id,request_key,receipt FROM company_workflow_receipts')).rows;
  for (const receipt of receipts) if (receipt.receipt.paid !== 0) issues.push({ accountId: receipt.account_id, reason: 'metadata_payment' });
  return { ok: issues.length === 0, workflowCount: workflows.length, issues };
}
