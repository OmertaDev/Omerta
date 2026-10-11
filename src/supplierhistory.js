const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const fields = ['orderId', 'depotId', 'buyerId', 'supplierId', 'good', 'district', 'unitPrice',
  'quantity', 'remaining', 'maxProcurementCash', 'spent', 'takeBps', 'netPayout', 'deadline', 'status'];
const valueKey = value => value === null ? 'null' : `${typeof value}:${['string', 'number', 'boolean', 'bigint'].includes(typeof value) ? String(value) : ''}`;
const deadlineOf = row => typeof row.deadline === 'string' ? Date.parse(row.deadline) : NaN;
const statusOf = (row, now) => row.status === 'accepted' && deadlineOf(row) <= now ? 'expired' : row.status;
const fingerprint = (row, now) => JSON.stringify(fields.map(field => valueKey(field === 'status' ? statusOf(row, now) : row[field])));

function outcome(row, now) {
  // Acceptance caps native commitments at 40 units. Invalid observations confer
  // neither successful performance nor delivered-unit credit.
  if (!Number.isSafeInteger(row.quantity) || row.quantity < 1 || row.quantity > 40
      || !Number.isSafeInteger(row.remaining) || row.remaining < 0 || row.remaining > row.quantity
      || !Number.isFinite(deadlineOf(row))) return 'unknown';
  const status = statusOf(row, now);
  if (status === 'delivered') return row.remaining === 0 ? 'fulfilled' : 'unknown';
  if (!row.remaining) return 'unknown';
  if (status === 'accepted') return 'active';
  if (status === 'expired') return deadlineOf(row) <= now ? 'missedDeadline' : 'unknown';
  if (status === 'buyer_dead') return 'buyerInterrupted';
  if (status === 'supplier_dead') return 'supplierInterrupted';
  return 'unknown';
}

// Input is the existing private deliveryBoard: all active commitments plus at
// most 100 historical rows across both participation roles, not 100 buyer rows.
export function supplierHistory(commitments, buyerId, now = Date.now()) {
  if (!Array.isArray(commitments) || !identifier(buyerId) || !Number.isSafeInteger(now)
      || !Number.isFinite(new Date(now).getTime())) throw new TypeError('Invalid supplier history observation.');
  const result = { scope: 'own_buyer_delivery_history', asOf: new Date(now).toISOString(),
    window: { historyLimit: 100, historyScope: 'buyer_and_supplier_roles', includesActive: true,
      inputRows: commitments.length, buyerContracts: 0 }, suppliers: [], unknownContracts: 0 };
  const buckets = new Map(), groups = new Map();
  for (const row of commitments) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    if (!identifier(row.id)) {
      if (row.buyerId === buyerId) { result.window.buyerContracts++; result.unknownContracts++; }
      continue;
    }
    if (!buckets.has(row.id)) buckets.set(row.id, []);
    buckets.get(row.id).push(row);
  }
  for (const rows of buckets.values()) {
    const owned = rows.filter(row => row.buyerId === buyerId);
    if (!owned.length) continue;
    result.window.buyerContracts++;
    const supplierIds = new Set(owned.map(row => row.supplierId));
    if (owned.length !== rows.length || supplierIds.size !== 1 || !identifier(owned[0].supplierId)
        || owned[0].supplierId === buyerId) { result.unknownContracts++; continue; }
    const row = owned[0], supplierId = row.supplierId;
    if (!groups.has(supplierId)) groups.set(supplierId, { supplierId, fulfilled: 0, missedDeadline: 0,
      buyerInterrupted: 0, supplierInterrupted: 0, active: 0, unknown: 0, deliveredUnits: 0 });
    const group = groups.get(supplierId);
    const classification = rows.every(other => fingerprint(other, now) === fingerprint(row, now)) ? outcome(row, now) : 'unknown';
    group[classification]++;
    if (classification !== 'unknown') group.deliveredUnits += row.quantity - row.remaining;
  }
  result.suppliers = [...groups.values()].sort((a, b) => a.supplierId < b.supplierId ? -1 : a.supplierId > b.supplierId ? 1 : 0);
  return result;
}
