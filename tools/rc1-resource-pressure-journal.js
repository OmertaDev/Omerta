// Exact bounded ammo escrow journal; no inferred grants, no alterations to raw snapshots.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { exactSum, negate } from './rc1-resource-journal.js';
const hash = value => sha256(canonicalJson(value));
function index(rows, key, label) { const m = new Map(); for (const r of rows) { assert(!m.has(r[key]), 'Duplicate ' + label); m.set(r[key], r); } return m; }
export function reconcilePressureResources(before, after, { command = null } = {}) {
  const b = before.tables, a = after.tables, chars = index(b.characters, 'id', 'character'), final = index(a.characters, 'id', 'character');
  assert.deepEqual([...chars.keys()].sort(), [...final.keys()].sort(), 'Stable measured roster required');
  const old = index(b.listings, 'id', 'listing'), current = index(a.listings, 'id', 'listing');
  const prior = index(b.transactions, 'id', 'receipt'), receipts = index(a.transactions, 'id', 'receipt');
  for (const [id, row] of prior) assert.deepEqual(receipts.get(id), row, 'Immutable receipt changed');
  const added = [...receipts.values()].filter(r => !prior.has(r.id));
  const inserted = [...current.values()].filter(r => !old.has(r.id)), removed = [...old.values()].filter(r => !current.has(r.id));
  for (const [id, row] of old) if (current.has(id)) assert.deepEqual(current.get(id), row, 'Live escrow rewritten');
  const transfers = new Map(), equations = [];
  const bump = (id, amount) => { assert(chars.has(id), 'Foreign custody owner'); transfers.set(id, exactSum([transfers.get(id) || '0', String(amount)])); };
  if (inserted.length || removed.length) {
    assert(command && command.status === 200 && !command.replayed, 'Unbound escrow mutation');
    const { actorId, path, method, body, response } = command; assert(chars.has(actorId));
    if (path === '/v1/exchange/list' && method === 'POST') {
      assert.equal(inserted.length, 1); assert.equal(removed.length, 0); const lot = inserted[0];
      assert.equal(lot.id, response.listingId); assert.equal(lot.seller_character, actorId); assert.equal(lot.item_kind, 'ammo');
      assert.equal(lot.item_id, 'ammo'); assert.equal(body.kind, 'ammo'); assert.equal(Number(lot.qty), body.qty); assert.equal(Number(lot.unit_price), body.unitPrice);
      assert.equal(response.qty, body.qty); assert.equal(response.total, body.qty * body.unitPrice); bump(actorId, -body.qty);
      assert.equal(added.filter(r => ['ammo', 'cash'].includes(r.currency)).length, 0, 'Escrow posting cannot invent resource receipts');
    } else {
      assert.equal(inserted.length, 0); assert.equal(removed.length, 1); const lot = removed[0]; assert.equal(lot.item_kind, 'ammo');
      const qty = Number(lot.qty); assert.equal(response.qty, qty);
      if (method === 'DELETE') {
        assert.equal(path, '/v1/exchange/' + lot.id); assert.equal(lot.seller_character, actorId); assert.equal(response.exchange, 'pulled');
        bump(actorId, qty); assert.equal(added.filter(r => ['ammo', 'cash'].includes(r.currency)).length, 0, 'Cancellation cannot invent receipts');
      } else {
        assert.equal(method, 'POST'); assert.equal(path, '/v1/exchange/' + lot.id + '/buy'); assert.notEqual(actorId, lot.seller_character);
        assert.equal(response.exchange, 'bought'); const total = qty * Number(lot.unit_price), fee = Math.ceil(total / 100), tax = Math.ceil(total / 100), net = Math.max(0, total - fee - tax);
        assert.equal(response.paid, total); bump(actorId, qty);
        const exchange = added.filter(r => r.reason === 'exchange:buy' || r.reason === 'exchange:sale'); assert.equal(exchange.length, 2, 'One-use buyer/seller receipt cardinality');
        const buy = exchange.find(r => r.reason === 'exchange:buy'), sell = exchange.find(r => r.reason === 'exchange:sale');
        assert(buy && sell); assert.equal(buy.character_id, actorId); assert.equal(buy.counterparty, lot.seller_character);
        assert.equal(sell.character_id, lot.seller_character); assert.equal(sell.counterparty, actorId);
        assert.equal(buy.currency, 'cash'); assert.equal(sell.currency, 'cash'); assert.equal(exactSum([buy.amount, String(total)]), '0'); assert.equal(exactSum([sell.amount, String(-net)]), '0');
        assert.equal(added.filter(r => r.currency === 'ammo').length, 0, 'Transfer cannot masquerade as ammo mint');
        const poolDelta = exactSum([a.street_tax[0].pool, negate(b.street_tax[0].pool)]);
        assert.equal(poolDelta, String(Math.min(tax, total - net)), 'Street tax destination');
        equations.push({ kind: 'exchange-cash-compound', buyer: actorId, seller: lot.seller_character, gross: total, net, tax: Number(poolDelta), sink: total - net - Number(poolDelta), receiptIds: exchange.map(r => r.id) });
      }
    }
  } else assert.equal(added.filter(r => /^exchange:(buy|sale)$/.test(r.reason)).length, 0, 'Exchange receipts require consumed escrow');
  for (const [id, priorChar] of chars) {
    const next = final.get(id);
    for (const currency of ['cash', 'ammo', 'cb']) {
      const delta = currency === 'cash' ? exactSum([next.cash, next.bank, negate(priorChar.cash), negate(priorChar.bank)]) : exactSum([next[currency], negate(priorChar[currency])]);
      const linked = added.filter(r => r.character_id === id && r.currency === currency);
      const expected = exactSum([...linked.map(r => r.amount), currency === 'ammo' ? transfers.get(id) || '0' : '0']);
      assert.equal(delta, expected, 'Per-owner ' + currency + ' parity: ' + id);
      equations.push({ resource: currency, owner: id, delta, expected, receiptIds: linked.map(r => r.id) });
    }
  }
  const totalAmmo = t => exactSum([...t.characters.map(r => r.ammo), ...t.listings.filter(r => r.item_kind === 'ammo').map(r => r.qty)]);
  const ammoDelta = exactSum([totalAmmo(a), negate(totalAmmo(b))]), ammoReceipts = added.filter(r => r.currency === 'ammo');
  assert.equal(ammoDelta, exactSum(ammoReceipts.map(r => r.amount)), 'All-owner ammo and escrow conservation');
  return { status: 'PASS_SCOPED', beforeSha256: hash(before), afterSha256: hash(after), equations,
    ammoDelta, ammoReceiptIds: ammoReceipts.map(r => r.id), escrowChanges: { inserted, removed },
    scope: 'Stable cohort personal cash/bank/ammo/cb parity and exactly bound ammo listing, purchase, cancellation. Other resources and unrelated lineage remain outside this focused journal.' };
}
export function pressureConcentration(snapshot) {
  const t = snapshot.tables, people = t.characters;
  const resources = {};
  for (const name of ['ammo', 'cashAndBank']) {
    const values = people.map(ch => ({ owner: ch.id, amount: name === 'ammo'
      ? exactSum([ch.ammo, ...t.listings.filter(l => l.seller_character === ch.id && l.item_kind === 'ammo').map(l => l.qty)]) : exactSum([ch.cash, ch.bank]) }));
    const total = exactSum(values.map(v => v.amount));
    // Exact decimal totals are retained. Ratios are diagnostics, never journal arithmetic.
    const numeric = values.map(v => Number(v.amount)), sum = numeric.reduce((x, y) => x + y, 0);
    resources[name] = { values, total, topShare: sum ? Math.max(...numeric) / sum : null,
      gini: sum ? numeric.reduce((x, a) => x + numeric.reduce((y, b) => y + Math.abs(a - b), 0), 0) / (2 * values.length * sum) : null };
  }
  return { resources, scope: 'Finite declared cohort including seller-owned live ammo escrow; no global concentration claim.' };
}
