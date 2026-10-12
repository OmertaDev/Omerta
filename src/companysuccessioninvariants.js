// Succession is a receipt for one canonical new depot, not an inherited treasury.
// Existing depot invariants remain responsible for its opening sink and later trade.
export async function companySuccessionFaults(pool) {
  const receipts = (await pool.query('SELECT * FROM company_succession_receipts')).rows;
  const actors = new Map((await pool.query('SELECT id,account_id,generation FROM characters')).rows.map(c => [c.id,c]));
  const depots = new Map((await pool.query('SELECT id,owner_character FROM business_depots')).rows.map(d => [d.id,d]));
  const ledger = (await pool.query("SELECT * FROM transactions WHERE reason='depot:open'")).rows;
  const journal = (await pool.query("SELECT * FROM business_depot_journal WHERE reason='open'")).rows;
  let faults = 0;
  for (const r of receipts) {
    const prior = actors.get(r.predecessor_character), next = actors.get(r.successor_character), depot = depots.get(r.depot_id);
    const input = r.request_terms, receipt = r.receipt, s = receipt?.succession;
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).sort().join(',') !== 'consent,expectedCompanyRevision,maxOpeningCash,predecessorCharacterId'
      || input.consent !== true || input.maxOpeningCash !== 5000 || input.predecessorCharacterId !== r.predecessor_character
      || input.expectedCompanyRevision + 1 !== r.company_revision || !Number.isSafeInteger(input.expectedCompanyRevision)
      || input.expectedCompanyRevision < 1 || input.expectedCompanyRevision > 2147483646) faults++;
    if (!prior || !next || prior.account_id !== r.account_id || next.account_id !== r.account_id || next.generation !== prior.generation + 1
      || next.generation !== r.successor_generation || !depot || depot.owner_character !== next.id || Number(r.opening_cash) !== 5000) faults++;
    if (receipt?.ok !== true || !s || s.id !== r.id || s.accountId !== r.account_id || s.predecessorCharacterId !== r.predecessor_character
      || s.successorCharacterId !== r.successor_character || s.successorGeneration !== r.successor_generation || s.companyRevision !== r.company_revision
      || s.depotId !== r.depot_id || s.openingCash !== 5000 || receipt.depot?.id !== r.depot_id || receipt.depot?.openingCost !== 5000
      || receipt.company?.accountId !== r.account_id || receipt.company?.revision !== r.company_revision || receipt.company?.premises?.verified !== true) faults++;
    const paid = ledger.filter(t => t.counterparty === r.depot_id), opened = journal.filter(j => j.depot_id === r.depot_id);
    if (paid.length !== 1 || paid[0]?.character_id !== r.successor_character || paid[0]?.currency !== 'cash' || Number(paid[0]?.amount) !== -5000
      || opened.length !== 1 || Number(opened[0]?.expense) !== 5000 || ['cash_delta','stock_delta','cost_delta'].some(k => Number(opened[0]?.[k]) !== 0)) faults++;
  }
  return faults;
}
