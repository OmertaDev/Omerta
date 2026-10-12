import crypto from 'node:crypto';

// Internal database custody hooks. No Market/core import, caller code or external calls.
const fail = reason => { const error = new Error(`Buyer cooperative custody refused: ${reason}.`); error.code = 'buyer_cooperative'; error.reason = reason; error.statusCode = 400; throw error; };
const number = (value, max = 810000) => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0 || n > max) fail('source_amount'); return n; };
export function buyerCooperativeApportion(total, weights) {
  number(total); if (!Array.isArray(weights) || weights.length < 1 || weights.length > 3) fail('shares');
  weights.forEach(w => number(w)); const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) { if (total) fail('shares'); return weights.map(() => 0); }
  const result = weights.map(w => Math.floor(total * w / sum));
  const rank = weights.map((w, position) => ({ position, remainder: total * w % sum })).sort((a, b) => b.remainder - a.remainder || a.position - b.position);
  for (let left = total - result.reduce((a, b) => a + b, 0), n = 0; left > 0; left--, n++) result[rank[n].position]++;
  return result;
}
export async function buyerCooperativeOrderBinding(client, orderId) {
  return (await client.query('SELECT cooperative_id FROM buyer_cooperative_orders WHERE order_id=$1', [orderId])).rows[0] || null;
}
export async function buyerCooperativeJournal(client, cooperativeId, kind, cashDelta, ginDelta, ledgerIds = [], orderId = null, account = null) {
  if (![cashDelta, ginDelta].every(Number.isSafeInteger) || Math.abs(cashDelta) > 810000 || Math.abs(ginDelta) > 8) fail('journal');
  if (!Array.isArray(ledgerIds) || ledgerIds.some(value => typeof value !== 'string')) fail('ledger_identity');
  await client.query('INSERT INTO buyer_cooperative_journal(id,cooperative_id,kind,cash_delta,gin_delta,ledger_ids,order_id,member_account) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [crypto.randomUUID(), cooperativeId, kind, cashDelta, ginDelta, JSON.stringify(ledgerIds), orderId, account]);
}
async function shares(client, cooperativeId) {
  return (await client.query('SELECT * FROM buyer_cooperative_members WHERE cooperative_id=$1 ORDER BY position FOR UPDATE', [cooperativeId])).rows;
}
async function allocate(client, row, members) {
  if (members.some(m => number(m.cash_claimed) || number(m.gin_claimed, 8) || number(m.death_cash) || number(m.death_gin, 8))) fail('already_allocated');
  const cash = buyerCooperativeApportion(number(row.cash_balance), members.map(m => number(m.funded_cash)));
  const gin = buyerCooperativeApportion(number(row.gin_balance, 8), members.map(m => number(m.funded_cash) ? number(m.unit_share, 8) : 0));
  for (let n = 0; n < members.length; n++) {
    if (cash[n] > number(members[n].funded_cash) || gin[n] > number(members[n].unit_share, 8)) fail('allocation_cap');
    await client.query('UPDATE buyer_cooperative_members SET cash_entitlement=$3,gin_entitlement=$4 WHERE cooperative_id=$1 AND account_id=$2', [row.id, members[n].account_id, cash[n], gin[n]]);
  }
}
export async function cancelBuyerCooperativeFunding(client, cooperativeId) {
  const row = (await client.query('SELECT * FROM buyer_cooperatives WHERE id=$1 FOR UPDATE', [cooperativeId])).rows[0];
  if (!row || row.order_id || row.status !== 'funding') fail('funding_state');
  const members = await shares(client, row.id);
  if (number(row.cash_balance) !== members.reduce((sum, m) => sum + number(m.funded_cash), 0)) fail('funding_balance');
  await allocate(client, row, members);
  await client.query("UPDATE buyer_cooperatives SET status='cancelled' WHERE id=$1", [row.id]);
  return { ok: true, cancelled: true, captured: 0, marketRefund: 0 };
}
export async function settleBuyerCooperativeOrder(client, orderId, ledger, { cancel = false } = {}) {
  if (typeof ledger !== 'function' || typeof cancel !== 'boolean') fail('internal_context');
  const order = (await client.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE', [orderId])).rows[0];
  const binding = await buyerCooperativeOrderBinding(client, orderId); if (!binding || !order) fail('order');
  const row = (await client.query('SELECT * FROM buyer_cooperatives WHERE id=$1 FOR UPDATE', [binding.cooperative_id])).rows[0];
  if (!row || row.order_id !== order.id || order.kind !== 'order' || order.good_id !== 'gin' || order.depot_id || order.seller_character !== row.organizer_character || Number(order.price) !== row.unit_price || order.district !== row.district) fail('binding');
  if (row.status === 'settled') {
    if (number(order.qty, 8) || number(order.filled_qty, 8)) fail('terminal_source');
    return { ok: true, replayed: true, captured: 0, marketRefund: 0 };
  }
  if (row.status !== 'live') fail('state');
  const members = await shares(client, row.id);
  if (members.some(m => number(m.funded_cash) !== number(m.funding_required))) fail('not_funded');
  const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  const remaining = number(order.qty, 8), received = number(order.filled_qty, 8);
  if (remaining + received !== row.units || !['live', 'expired', 'cancelled'].includes(order.status)) fail('source_quantity');
  if (remaining > 0 && order.status === 'live' && !cancel && new Date(order.expires_at) > new Date(now)) fail('not_ready');
  if ((await client.query("SELECT id FROM delivery_commitments WHERE order_id=$1 AND status='accepted' LIMIT 1", [order.id])).rows.length) fail('reserved');
  // This sole bound adapter clears canonical source quantities in the SAME transaction.
  const refund = remaining * row.unit_price, ledgerIds = [];
  if (refund) ledgerIds.push(await ledger(client, { characterId: null, currency: 'cash', amount: refund, reason: 'market:refund', counterparty: row.id }));
  const cash = number(row.cash_balance) + refund, gin = number(row.gin_balance, 8) + received;
  number(cash); number(gin, 8);
  await client.query('UPDATE buyer_cooperatives SET cash_balance=$2,gin_balance=$3,purchased_units=$4 WHERE id=$1', [row.id, cash, gin, received]);
  await client.query('UPDATE market_listings SET qty=0,filled_qty=0,status=$2 WHERE id=$1', [order.id, remaining ? 'cancelled' : 'sold']);
  await buyerCooperativeJournal(client, row.id, 'settle', refund, received, ledgerIds, order.id);
  await allocate(client, { ...row, cash_balance: cash, gin_balance: gin }, members);
  await client.query("UPDATE buyer_cooperatives SET status='settled' WHERE id=$1", [row.id]);
  return { ok: true, captured: received, marketRefund: refund };
}
export async function recoverBuyerCooperativesAtDeath(client, characterId, ledger, killerCh = null, lootRate = 0) {
  if (typeof ledger !== 'function' || !Number.isFinite(lootRate) || lootRate < 0 || lootRate > 1) fail('internal_context');
  const rows = (await client.query("SELECT c.id,c.order_id FROM buyer_cooperatives c LEFT JOIN buyer_cooperative_members m ON m.cooperative_id=c.id AND m.original_character=$1 WHERE (c.organizer_character=$1 AND c.status IN ('funding','live')) OR (m.funded_cash>0 AND m.is_dead=false AND (c.status IN ('funding','live') OR m.cash_entitlement>m.cash_claimed OR m.gin_entitlement>m.gin_claimed)) ORDER BY c.id LIMIT 7", [characterId])).rows;
  if (rows.length > 6) fail('death_context_limit');
  // Acquire all source orders first, before any cooperative/member metadata.
  for (const orderId of [...new Set(rows.map(r => r.order_id).filter(Boolean))].sort()) await client.query('SELECT id FROM market_listings WHERE id=$1 FOR UPDATE', [orderId]);
  let looted = 0, burnedCash = 0, burnedGin = 0;
  for (const hint of rows) {
    let row = (await client.query('SELECT * FROM buyer_cooperatives WHERE id=$1 FOR UPDATE', [hint.id])).rows[0];
    if (row.order_id !== hint.order_id) fail('source_changed');
    if (row.status === 'funding') await cancelBuyerCooperativeFunding(client, row.id);
    else if (row.status === 'live') await settleBuyerCooperativeOrder(client, row.order_id, ledger, { cancel: true });
    row = (await client.query('SELECT * FROM buyer_cooperatives WHERE id=$1 FOR UPDATE', [hint.id])).rows[0];
    const members = await shares(client, row.id), member = members.find(m => m.original_character === characterId);
    if (!member || member.is_dead) continue;
    const cash = number(member.cash_entitlement) - number(member.cash_claimed), gin = number(member.gin_entitlement, 8) - number(member.gin_claimed, 8);
    const loot = killerCh ? Math.floor(cash * lootRate) : 0, burn = cash - loot, ids = [];
    if (loot) { killerCh.cash = Number(killerCh.cash) + loot; ids.push(await ledger(client, { characterId: killerCh.id, currency: 'cash', amount: loot, reason: 'whack:loot', counterparty: characterId })); ids.push(await ledger(client, { characterId: null, currency: 'cash', amount: -loot, reason: 'buyer_cooperative:loot_cash', counterparty: row.id })); }
    if (burn) ids.push(await ledger(client, { characterId: null, currency: 'cash', amount: -burn, reason: 'buyer_cooperative:death_cash', counterparty: row.id }));
    if (gin) ids.push(await ledger(client, { characterId: null, currency: 'gin', amount: -gin, reason: 'buyer_cooperative:death_gin', counterparty: row.id }));
    if (cash > number(row.cash_balance) || gin > number(row.gin_balance, 8)) fail('death_balance');
    await client.query('UPDATE buyer_cooperatives SET cash_balance=$2,gin_balance=$3 WHERE id=$1', [row.id, Number(row.cash_balance) - cash, Number(row.gin_balance) - gin]);
    await client.query('UPDATE buyer_cooperative_members SET is_dead=true,death_cash=$3,death_gin=$4,death_loot=$5 WHERE cooperative_id=$1 AND account_id=$2', [row.id, member.account_id, cash, gin, loot]);
    await buyerCooperativeJournal(client, row.id, 'death', -cash, -gin, ids, row.order_id, member.account_id);
    looted += loot; burnedCash += burn; burnedGin += gin;
  }
  return { looted, burnedCash, burnedGin };
}
