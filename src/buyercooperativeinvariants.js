// Read-only binding + explicit joint cash/GIN conservation; no runtime repair.
export async function runBuyerCooperativeInvariants(client) {
  const rows = (await client.query('SELECT * FROM buyer_cooperatives ORDER BY id')).rows, issues = [];
  let cashEscrow = 0, ginEscrow = 0;
  for (const row of rows) {
    cashEscrow += Number(row.cash_balance); ginEscrow += Number(row.gin_balance);
    const members = (await client.query('SELECT * FROM buyer_cooperative_members WHERE cooperative_id=$1 ORDER BY position', [row.id])).rows;
    const journal = (await client.query('SELECT * FROM buyer_cooperative_journal WHERE cooperative_id=$1', [row.id])).rows;
    const sum = field => members.reduce((total, m) => total + Number(m[field]), 0);
    const delta = field => journal.reduce((total, entry) => total + Number(entry[field]), 0);
    if (members.length < 1 || members.length > 3 || sum('unit_share') !== row.units || sum('funding_required') !== row.units * row.unit_price + row.fee_cap) issues.push({ id: row.id, reason: 'terms' });
    if (delta('cash_delta') !== Number(row.cash_balance) || delta('gin_delta') !== Number(row.gin_balance)) issues.push({ id: row.id, reason: 'journal_balance' });
    if (['settled', 'cancelled'].includes(row.status)) {
      if (sum('cash_entitlement') - sum('cash_claimed') - sum('death_cash') !== row.cash_balance || sum('gin_entitlement') - sum('gin_claimed') - sum('death_gin') !== row.gin_balance) issues.push({ id: row.id, reason: 'rights' });
      if (sum('gin_entitlement') !== row.purchased_units) issues.push({ id: row.id, reason: 'received_allocation' });
    }
    let marketEscrow = 0;
    if (row.order_id) {
      const binding = (await client.query('SELECT cooperative_id FROM buyer_cooperative_orders WHERE order_id=$1', [row.order_id])).rows[0];
      const order = (await client.query('SELECT * FROM market_listings WHERE id=$1', [row.order_id])).rows[0];
      if (!order || binding?.cooperative_id !== row.id || order.seller_character !== row.organizer_character || order.good_id !== 'gin' || order.kind !== 'order' || order.depot_id || Number(order.price) !== row.unit_price || order.district !== row.district) issues.push({ id: row.id, reason: 'canonical_binding' });
      else if (row.status === 'live') {
        marketEscrow = Number(order.qty) * row.unit_price;
        if (Number(order.qty) + Number(order.filled_qty) !== row.units) issues.push({ id: row.id, reason: 'live_quantity' });
      } else if (Number(order.qty) || Number(order.filled_qty)) issues.push({ id: row.id, reason: 'closed_source' });
    }
    const paidUnits = row.status === 'live' && row.order_id ? Number((await client.query('SELECT filled_qty FROM market_listings WHERE id=$1', [row.order_id])).rows[0]?.filled_qty || 0) : row.purchased_units;
    if (sum('funded_cash') !== Number(row.cash_balance) + marketEscrow + Number(row.fee_paid) + paidUnits * row.unit_price + sum('cash_claimed') + sum('death_cash')) issues.push({ id: row.id, reason: 'cash_conservation' });
    for (const member of members) {
      const source = (await client.query('SELECT account_id FROM characters WHERE id=$1', [member.original_character])).rows[0];
      if (source?.account_id !== member.account_id || (member.is_dead && (Number(member.cash_entitlement) !== Number(member.cash_claimed) + Number(member.death_cash) || Number(member.gin_entitlement) !== Number(member.gin_claimed) + Number(member.death_gin)))) issues.push({ id: row.id, reason: 'original_member' });
    }
    for (const entry of journal) {
      const records = [];
      for (const ledgerId of entry.ledger_ids) {
        const record = (await client.query('SELECT * FROM transactions WHERE id=$1', [ledgerId])).rows[0];
        if (!record) issues.push({ id: row.id, reason: 'missing_ledger', ledgerId }); else records.push(record);
      }
      const member = members.find(m => m.account_id === entry.member_account);
      if (entry.kind === 'fund' && (records.length !== 1 || records[0].character_id !== member?.original_character || records[0].currency !== 'cash' || Number(records[0].amount) !== -entry.cash_delta || records[0].reason !== 'buyer_cooperative:fund' || records[0].counterparty !== row.id)) issues.push({ id: row.id, reason: 'funding_debit' });
      if (entry.kind === 'post_order') {
        const funding = records.find(r => r.reason === 'market:order'), fee = records.find(r => r.reason === 'market:list');
        if (records.length !== 2 || funding?.character_id !== null || fee?.character_id !== null || funding?.counterparty !== row.id || fee?.counterparty !== row.id || Number(funding?.amount) !== -row.units * row.unit_price || Number(fee?.amount) !== -row.fee_paid || entry.cash_delta !== -(row.units * row.unit_price + row.fee_paid)) issues.push({ id: row.id, reason: 'canonical_order_debit' });
      }
      if (entry.kind === 'claim') {
        const cash = records.filter(r => r.currency === 'cash'), gin = records.filter(r => r.currency === 'gin');
        if (cash.reduce((sum, r) => sum + Number(r.amount), 0) !== -entry.cash_delta || gin.reduce((sum, r) => sum + Number(r.amount), 0) !== -entry.gin_delta || records.some(r => r.character_id !== member?.original_character || r.counterparty !== row.id)) issues.push({ id: row.id, reason: 'claim_credit' });
      }
    }
  }
  return { ok: issues.length === 0, cashEscrow, ginEscrow, cooperativeCount: rows.length, issues };
}
