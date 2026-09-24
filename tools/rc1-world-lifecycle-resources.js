// Read-only custody classification. Route authorization and random combat outcomes
// remain the responsibility of the canonical command/native proofs.
import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { readFileSync } from 'node:fs';
import { LAW, M3 } from '../src/rules.js';
import { exactSum, negate, sha256 } from './rc1-resource-journal.js';
import { actorValueHash } from './rc1-native-actor-replay.js';
import { QUERY_ORDER_SCOPE } from './rc1-native-query-order.js';

const rows = (state, table) => state.tables[table];
const value = amount => exactSum([amount]);
const omit = (row, fields) => Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key)));
const delta = (a, b) => exactSum([b, negate(a)]);
const index = values => new Map(values.map(row => [row.character_id, row]));
const contextOf = identity => identity?.context || identity || {};
const integer = amount => { const result = value(amount); assert(/^\d+$/.test(result), 'Nonnegative integer resource required'); return BigInt(result); };

export function reconcileMembershipResources(before, after, { identity = null, receipts = [] } = {}) {
  const result = { memberIds: new Set(), familyFields: new Map(), movements: [] };
  const a = index(rows(before, 'gang_members')), b = index(rows(after, 'gang_members'));
  const changed = [...new Set([...a.keys(), ...b.keys()])].filter(id => !equal(a.get(id), b.get(id)));
  if (!changed.length) return result;
  const context = contextOf(identity), route = context.path || context.url;
  if (context.method !== 'POST' || !route || receipts.length) return result;
  if (changed.some(id => a.has(id) && !rows(after, 'gangs').some(row => row.id === a.get(id).gang_id))) return result;
  const family = id => {
    const old = rows(before, 'gangs').find(row => row.id === id), next = rows(after, 'gangs').find(row => row.id === id);
    assert(old && next, 'Membership custody requires a surviving Family');
    assert(equal(omit(old, ['npc_flag']), omit(next, ['npc_flag'])), 'Membership changed Family resource fields');
    return [old, next];
  };
  const owner = id => {
    const old = rows(before, 'characters').find(row => row.id === id), next = rows(after, 'characters').find(row => row.id === id);
    assert(old?.alive && next?.alive && old.account_id === next.account_id, 'Membership lacks the same living owner');
    for (const field of ['cash', 'bank', 'bank_intransit', 'ammo', 'cb']) assert.equal(value(old[field] || 0), value(next[field] || 0), 'Membership changed personal custody: ' + field);
    return old;
  };
  const joined = route.match(/^\/v1\/gangs\/([^/]+)\/join$/);
  if (joined) {
    assert.equal(changed.length, 1, 'Compound membership join');
    const id = changed[0], next = b.get(id); assert(!a.has(id) && next, 'Join must add one member');
    assert.equal(next.gang_id, joined[1]); assert.equal(next.role, 'soldier');
    assert.equal(next.post, null); assert.equal(next.post_at, null);
    assert.deepEqual(Object.keys(next).sort(), ['character_id', 'gang_id', 'joined_at', 'post', 'post_at', 'role']);
    assert.equal(Date.parse(next.joined_at), context.logicalAt, 'Join timestamp lacks the observed boundary');
    const person = owner(id); if (context.accountId) assert.equal(context.accountId, person.account_id);
    const [old, final] = family(next.gang_id); assert(equal(old, final), 'Join changed Family metadata');
    assert([...a.values()].filter(row => row.gang_id === next.gang_id).length < M3.GANG_MAX_MEMBERS);
    result.memberIds.add(id); result.movements.push({ kind: 'family-join', familyId: next.gang_id, characterId: id, economicGrant: false });
  } else if (route === '/v1/gangs/promote') {
    assert.equal(changed.length, 1, 'Compound promotion');
    const id = changed[0], old = a.get(id), next = b.get(id);
    assert(old && next && old.role !== 'boss' && ['soldier', 'capo', 'underboss'].includes(next.role));
    assert(equal(omit(old, ['role']), omit(next, ['role'])), 'Promotion changed non-role membership fields');
    owner(id); const [prior, final] = family(old.gang_id); assert(equal(prior, final));
    assert.equal([...b.values()].filter(row => row.gang_id === old.gang_id && row.role === 'boss').length, 1);
    assert([...b.values()].filter(row => row.gang_id === old.gang_id && row.role === 'underboss').length <= 1);
    result.memberIds.add(id); result.movements.push({ kind: 'family-role', familyId: old.gang_id, characterId: id, from: old.role, to: next.role, economicGrant: false });
  } else if (route === '/v1/gangs/leave' || route === '/v1/gangs/kick') {
    const removed = changed.filter(id => a.has(id) && !b.has(id)); assert.equal(removed.length, 1, 'Departure must remove one member');
    const id = removed[0], departed = a.get(id), person = owner(id), [oldFamily, nextFamily] = family(departed.gang_id);
    if (route.endsWith('/leave') && context.accountId) assert.equal(context.accountId, person.account_id);
    if (route.endsWith('/kick')) assert.notEqual(departed.role, 'boss');
    const remaining = [...a.values()].filter(row => row.gang_id === departed.gang_id && row.character_id !== id);
    assert(remaining.length, 'Dissolution is not a zero-resource membership transition');
    const promotions = changed.filter(other => other !== id);
    if (departed.role === 'boss') {
      const rank = role => role === 'underboss' ? 0 : role === 'capo' ? 1 : 2;
      remaining.sort((x, y) => rank(x.role) - rank(y.role) || x.character_id.localeCompare(y.character_id));
      assert.deepEqual(promotions, [remaining[0].character_id], 'Departure selected the wrong successor');
      const successor = a.get(promotions[0]), next = b.get(promotions[0]); owner(promotions[0]);
      assert(equal(next, { ...successor, role: 'boss' }), 'Succession changed unrelated membership fields');
      const character = rows(before, 'characters').find(row => row.id === successor.character_id);
      assert.equal(nextFamily.npc_flag, character.is_npc ?? oldFamily.npc_flag);
      result.familyFields.set(oldFamily.id, new Set(['npc_flag']));
    } else { assert.equal(promotions.length, 0); assert(equal(oldFamily, nextFamily)); }
    for (const changedId of changed) result.memberIds.add(changedId);
    result.movements.push({ kind: 'family-departure', familyId: departed.gang_id, characterId: id, successor: promotions[0] || null, economicGrant: false });
  }
  return result;
}

export function reconcileLifecycleCash(before, after, { identity = null, receipts = [] } = {}) {
  const result = { usedReceipts: new Set(), bankOwners: new Set(), checks: [], movements: [] };
  const person = (state, id) => { const matches = rows(state, 'characters').filter(row => row.id === id); assert.equal(matches.length, 1); return matches[0]; };
  const context = contextOf(identity);
  const claim = row => { assert(!result.usedReceipts.has(row.id), 'Receipt reused'); result.usedReceipts.add(row.id); };
  for (const incoming of receipts.filter(row => ['cash', 'cb'].includes(row.currency) && row.reason === 'jump:steal')) {
    const currency = incoming.currency;
    assert(incoming.character_id && incoming.counterparty && incoming.character_id !== incoming.counterparty && incoming.account_id === null);
    const amount = integer(incoming.amount); assert(amount > 0n && amount <= BigInt(currency === 'cash' ? M3.JUMP_STEAL_CAP : 3));
    const matching = receipts.filter(row => row.currency === currency && row.reason === 'jump:stolen'
      && row.character_id === incoming.counterparty && row.counterparty === incoming.character_id && row.account_id === null
      && value(row.amount) === String(-amount) && row.at === incoming.at);
    assert.equal(matching.length, 1, 'Jump transfer lacks one exact reciprocal receipt');
    for (const id of [incoming.character_id, incoming.counterparty]) {
      const old = person(before, id), next = person(after, id); assert(old.alive && next.alive && old.account_id === next.account_id);
      assert.equal(value(old.bank), value(next.bank), 'Jump diverted bank custody');
      const owned = receipts.filter(row => row.currency === currency && row.character_id === id);
      assert.equal(owned.length, 1, 'Compound jump resource boundary');
      assert.equal(delta(old[currency], next[currency]), value(owned[0].amount), 'Jump pocket endpoint differs');
    }
    claim(incoming); claim(matching[0]);
    result.movements.push({ kind: `jump-${currency}-transfer`, source: incoming.counterparty, destination: incoming.character_id, amount: String(amount), receiptIds: [incoming.id, matching[0].id] });
  }
  for (const row of receipts.filter(row => ['cash', 'cb'].includes(row.currency) && row.reason === 'jump:stolen'))
    assert(result.usedReceipts.has(row.id), 'Orphan jump debit');
  const heals = receipts.filter(row => row.currency === 'cash' && row.reason === 'heal');
  if (heals.length && context.method === 'POST' && (context.path || context.url) === '/v1/heal') {
    assert.equal(heals.length, 1, 'Compound heal boundary');
    const receipt = heals[0], old = person(before, receipt.character_id), next = person(after, receipt.character_id);
    const amount = integer(negate(receipt.amount)); assert(amount > 0n);
    assert(old.alive && next.alive && old.account_id === next.account_id);
    if (context.accountId) assert.equal(context.accountId, old.account_id);
    assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null);
    assert(Number(old.health) >= 0 && Number(old.health) < 100); assert.equal(Number(next.health), 100);
    assert.equal(receipts.filter(row => row.character_id === old.id && row.currency === 'cash').length, 1);
    assert.equal(delta(old.cash, next.cash), String(-amount), 'Heal pocket debit differs');
    for (const field of ['bank', 'bank_intransit', 'ammo', 'cb']) assert.equal(value(old[field] || 0), value(next[field] || 0), 'Heal diverted another resource');
    // Price modifiers remain canonical-command authority. This observer proves
    // the executed debit is destroyed, with no recipient or other custody leg.
    claim(receipt); result.movements.push({ kind: 'heal-cash-sink', characterId: old.id, amount: String(amount), receiptIds: [receipt.id] });
  }
  const pleas = receipts.filter(row => row.currency === 'cash' && row.reason === 'law:plea');
  if (pleas.length) {
    assert.equal(pleas.length, 1, 'Compound plea receipts'); assert.equal(receipts.length, 1, 'Compound plea boundary');
    const receipt = pleas[0], old = person(before, receipt.character_id), next = person(after, receipt.character_id);
    assert(old.alive && next.alive && old.account_id === next.account_id && old.indicted_at);
    assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null);
    const want = Math.floor((Number(old.cash) + Number(old.bank)) * LAW.PLEA_FORFEIT_RATE);
    const pocket = Math.min(want, Math.floor(Number(old.cash))), bank = Math.min(want - pocket, Math.floor(Number(old.bank))), total = pocket + bank;
    assert(Number.isSafeInteger(total) && total > 0);
    assert.equal(value(receipt.amount), String(-total));
    assert.equal(delta(old.cash, next.cash), String(-pocket)); assert.equal(delta(old.bank, next.bank), String(-bank));
    assert.equal(value(next.bank_intransit || 0), value(Math.min(Number(old.bank_intransit || 0), Number(next.bank))));
    assert.equal(next.indicted_at, null); assert.equal(value(next.heat_exposure), '0'); assert.equal(next.jury_bought, false);
    assert.equal(Date.parse(next.jail_until), Date.parse(receipt.at) + LAW.PLEA_JAIL_S * 1000);
    if (context.logicalAt != null) assert.equal(Date.parse(receipt.at), context.logicalAt);
    const tax = rows(before, 'street_tax'), nextTax = rows(after, 'street_tax'); assert.equal(tax.length, 1); assert.equal(nextTax.length, 1);
    assert(equal(omit(tax[0], ['pool']), omit(nextTax[0], ['pool'])));
    assert.equal(delta(tax[0].pool, nextTax[0].pool), String(total), 'Plea funds failed to reach confiscation pool');
    claim(receipt); result.bankOwners.add(old.id);
    result.movements.push({ kind: 'law-plea-transfer', source: old.id, destination: 'street_tax.pool', amount: String(total), receiptIds: [receipt.id] });
  }
  for (const movement of result.movements) result.checks.push({ kind: movement.kind, resource: movement.kind === 'jump-cb-transfer' ? 'cb' : 'cash', drift: '0', authority: movement.receiptIds.map(id => ({ table: 'transactions', id })) });
  return result;
}

export const MARKET_EXPIRY_SOURCE_PINS = Object.freeze({
  'src/worker.js': '7072264895a874fbcc1f068c85a8668c4cc34819918868459d71194c5f1eabf6',
  'src/market.js': 'ac65c72a32ce85e1e6cb5804a5c76c15e5d8f611ffab84122d6ddade1611fb40',
  'src/game.js': 'bb8d9f1b9b63c4775631e0938888f2d85d1b5eb879bcf47f218d6ccd3b862f05',
});
const EXPIRY_SQL = Object.freeze({
  due: "SELECT id, kind, seller_character, bidder FROM market_listings WHERE status='live' AND expires_at <= now()",
  lock: 'SELECT 1 FROM characters WHERE id=$1 FOR UPDATE',
  order: "SELECT * FROM market_listings WHERE id=$1 AND status='live' AND expires_at <= now() FOR UPDATE",
  alive: 'SELECT 1 FROM characters WHERE id=$1 AND alive',
  credit: 'UPDATE characters SET cash = cash + $2 WHERE id=$1',
  ledger: 'INSERT INTO transactions (id, character_id, account_id, currency, amount, reason, counterparty) VALUES ($1,$2,$3,$4,$5,$6,$7)',
  expire: "UPDATE market_listings SET qty=0, status='expired' WHERE id=$1",
  notify: 'INSERT INTO notifications (id, character_id, type, payload) VALUES ($1,$2,$3,$4)',
});
const stateHash = ({ boundary, ...state }) => sha256(state);
let expirySourceChecked = false;
function companionQueries(before, after, identity, evidence) {
  if (!expirySourceChecked) {
    for (const [file, expected] of Object.entries(MARKET_EXPIRY_SOURCE_PINS))
      assert.equal(sha256(readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r\n', '\n')), expected, 'Expiry source changed: ' + file);
    expirySourceChecked = true;
  }
  assert.equal(identity.kind, 'resource-quiescent-aggregate'); assert.equal(identity.outcome, 'QUIESCENT_AGGREGATE');
  assert(!Object.hasOwn(identity, 'sequence'), 'Aggregate cannot claim native commit sequence');
  assert.equal(actorValueHash(identity), actorValueHash(evidence.identity), 'Expiry aggregate identity differs');
  const root = identity.traceRoot, { sha256: rootHash, ...descriptor } = root;
  assert.equal(root.format, 2); assert.equal(root.kind, 'quiescent-resource-trace-root'); assert.equal(root.groupId, identity.groupId);
  assert.equal(rootHash, actorValueHash(descriptor));
  for (const [state, recorded, hash] of [[before, evidence.before, root.beforeHash], [after, evidence.after, root.afterHash]]) {
    assert.equal(stateHash(state), hash); assert.equal(stateHash(recorded), hash);
  }
  assert.equal(root.requestsSha256, actorValueHash(evidence.requests)); assert.equal(root.requestsSha256, identity.requestsSha256);
  assert.equal(root.outcomesSha256, actorValueHash(evidence.outcomes));
  assert.equal(root.traceSha256, actorValueHash(evidence.trace)); assert.equal(root.traceSha256, evidence.traceSha256);
  assert.equal(root.companionsSha256, actorValueHash(evidence.companions)); assert.equal(root.companionsSha256, identity.companionsSha256);
  assert.equal(root.companionOutcomesSha256, actorValueHash(evidence.companionOutcomes));
  assert.equal(identity.companionCount, 1); assert.equal(evidence.companions.length, 1);
  assert.equal(evidence.companionOutcomes.length, 1); assert.equal(evidence.companionOutcomes[0].status, 'fulfilled');
  assert.equal(actorValueHash(identity.context.companions), actorValueHash(evidence.companions));
  const [worker] = evidence.companions, at = identity.context.logicalAt;
  assert(Number.isSafeInteger(at)); assert.equal(worker.logicalAt, at); assert.equal(worker.companionIndex, 0);
  assert.equal(worker.kind, 'original-worker-job'); assert.equal(worker.label, 'market sweep');
  assert.equal(worker.sourceFile, 'src/worker.js'); assert.equal(worker.sourceSha256, MARKET_EXPIRY_SOURCE_PINS[worker.sourceFile]);
  assert.equal(worker.handlerSourceFile, 'src/market.js'); assert.equal(worker.handlerSourceSha256, MARKET_EXPIRY_SOURCE_PINS[worker.handlerSourceFile]);
  const dispatches = new Map(), queries = [];
  for (const [offset, event] of evidence.trace.entries()) {
    assert.equal(event.sequence, offset + 1); assert.equal(event.logicalAt, at);
    if (event.authority !== 'original-worker-job') continue;
    assert.equal(event.companionIndex, 0);
    if (event.phase.startsWith('COMPANION_')) continue;
    assert.equal(event.requestIndex, null);
    if (event.phase === 'DISPATCH') {
      assert(!dispatches.has(event.queryId)); assert(event.original);
      const sql = typeof event.original.sql === 'string' ? event.original.sql : event.original.sql.text;
      assert.equal(event.sqlSha256, sha256(sql)); dispatches.set(event.queryId, event);
    } else if (event.phase === 'ACKNOWLEDGED') {
      const start = dispatches.get(event.queryId); assert(start, 'Worker acknowledgment lacks original dispatch'); dispatches.delete(event.queryId);
      assert.equal(start.clientId, event.clientId); assert(start.sequence < event.sequence);
      assert.equal(event.sqlSha256, start.sqlSha256); assert.equal(event.nativeResultSha256, actorValueHash(event.nativeResult));
      assert.equal(event.command, event.nativeResult.command); assert.equal(event.rowCount, event.nativeResult.rowCount);
      const sql = typeof start.original.sql === 'string' ? start.original.sql : start.original.sql.text;
      queries.push({ sql, params: start.original.parameters, result: event.nativeResult, transactionId: event.transactionId,
        clientId: event.clientId, dispatchSequence: start.sequence, acknowledgedSequence: event.sequence });
    } else assert.fail('Unsupported worker query outcome in expiry companion: ' + event.phase);
  }
  assert.equal(dispatches.size, 0);
  assert.equal(evidence.trace.filter(row => row.phase === 'COMPANION_DISPATCH').length, 1);
  assert.equal(evidence.trace.filter(row => row.phase === 'COMPANION_RETURNED').length, 1);
  return { queries, at, rootHash, outcome: evidence.companionOutcomes[0].value };
}

function reconcileCompanionExpiry(before, after, { identity, receipts, quiescentGroupEvidence }, result) {
  const old = new Map(rows(before, 'market_listings').map(row => [row.id, row]));
  const expired = rows(after, 'market_listings').filter(row => old.get(row.id)?.kind === 'order' && old.get(row.id).status === 'live' && row.status === 'expired');
  if (!expired.length || !quiescentGroupEvidence) return result;
  const { queries, at, rootHash, outcome } = companionQueries(before, after, identity, quiescentGroupEvidence);
  const orderedScan = QUERY_ORDER_SCOPE.queries.find(query => query.id === 'market-due');
  assert.equal(orderedScan.originalSql, EXPIRY_SQL.due);
  assert.equal(orderedScan.sourceSha256, MARKET_EXPIRY_SOURCE_PINS['src/market.js']);
  const scans = queries.filter(query => query.sql === EXPIRY_SQL.due || query.sql === orderedScan.transformedSql)
    .map(query => {
      if (query.sql === EXPIRY_SQL.due) return query;
      // The existing query-order wrapper retains both projections in one native
      // statement snapshot. Do not mistake that SQL transport for a missing scan.
      assert.equal(query.result.command, 'SELECT'); assert.equal(query.result.rowCount, 1);
      assert.equal(query.result.rows.length, 1);
      const { limited_rows: selected, eligible_rows: encoded } = query.result.rows[0];
      assert(Array.isArray(selected) && Array.isArray(encoded));
      const eligible = encoded.map(text => { assert.equal(typeof text, 'string'); return JSON.parse(text); });
      assert(eligible.every(row => row.status === 'live' && Date.parse(row.expires_at) <= at));
      const projection = row => Object.fromEntries(orderedScan.projection.map(field => [field, row[field]]));
      assert.deepEqual(selected.map(actorValueHash).sort(), eligible.map(row => actorValueHash(projection(row))).sort(),
        'Original full due projection differs from same-statement eligible rows');
      return { ...query, result: { ...query.result, rowCount: selected.length, rows: selected } };
    });
  assert.equal(scans.length, 1); assert.equal(scans[0].transactionId, null);
  const usedTransactions = new Set();
  for (const final of expired) {
    const prior = old.get(final.id), held = integer(prior.qty) * integer(prior.price);
    // Only this existing living-owner refund subset is claimed. Other expiry
    // branches remain visible to the enclosing resource observer.
    if (!held) continue;
    assert(held <= BigInt(Number.MAX_SAFE_INTEGER), 'Expiry source amount exceeds exact JavaScript integer scope');
    assert.equal(prior.bidder, null); assert(Date.parse(prior.expires_at) <= at); assert.equal(final.qty, 0);
    assert(equal(omit(prior, ['qty', 'status']), omit(final, ['qty', 'status'])), 'Aggregate expiry rewrote order metadata or warehouse cargo');
    assert(scans[0].result.rows.some(row => row.id === prior.id && row.kind === 'order' && row.seller_character === prior.seller_character && row.bidder === null));
    const locked = queries.filter(query => query.sql === EXPIRY_SQL.order && equal(query.params, [prior.id]) && query.result.rows.length === 1);
    assert.equal(locked.length, 1, 'Expiry needs one actual locked order read'); const transaction = locked[0].transactionId;
    assert(Number.isSafeInteger(transaction) && transaction > 0 && !usedTransactions.has(transaction)); usedTransactions.add(transaction);
    assert.equal(actorValueHash(locked[0].result.rows[0]), actorValueHash(prior), 'Locked order differs from aggregate input');
    const steps = queries.filter(query => query.transactionId === transaction);
    assert.deepEqual(steps.map(step => step.sql), ['BEGIN', EXPIRY_SQL.lock, EXPIRY_SQL.order, EXPIRY_SQL.alive,
      EXPIRY_SQL.credit, EXPIRY_SQL.ledger, EXPIRY_SQL.expire, EXPIRY_SQL.notify, 'COMMIT'], 'Unrecognized canonical expiry transaction');
    assert(steps.every(step => step.clientId === locked[0].clientId));
    for (let index = 1; index < steps.length; index++) assert(steps[index - 1].acknowledgedSequence < steps[index].dispatchSequence, 'Worker transaction query order differs');
    assert.deepEqual(steps.map(step => step.result.command), ['BEGIN', 'SELECT', 'SELECT', 'SELECT', 'UPDATE', 'INSERT', 'UPDATE', 'INSERT', 'COMMIT']);
    for (const step of steps.slice(1, -1)) assert.equal(step.result.rowCount, 1);
    assert.deepEqual(steps[1].params, [prior.seller_character]); assert.deepEqual(steps[3].params, [prior.seller_character]);
    assert.deepEqual(steps[4].params, [prior.seller_character, Number(held)]); assert.deepEqual(steps[6].params, [prior.id]);
    assert.equal(steps[3].result.rows.length, 1, 'Expiry owner was not alive at the executed credit');
    const ledger = steps[5].params;
    assert.equal(ledger.length, 7); assert.deepEqual(ledger.slice(1), [prior.seller_character, null, 'cash', Number(held), 'market:refund', null]);
    const matches = receipts.filter(receipt => receipt.id === ledger[0]); assert.equal(matches.length, 1);
    const [receipt] = matches; assert(!result.usedReceipts.has(receipt.id));
    assert.equal(receipt.character_id, prior.seller_character); assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null);
    assert.equal(receipt.currency, 'cash'); assert.equal(receipt.reason, 'market:refund'); assert.equal(value(receipt.amount), String(held)); assert.equal(Date.parse(receipt.at), at);
    const notification = steps[7].params; assert.equal(notification.length, 4);
    assert.equal(notification[1], prior.seller_character); assert.equal(notification[2], 'order_expired');
    assert.deepEqual(JSON.parse(notification[3]), { listing: prior.id, refunded: Number(held), awaiting: Number(prior.filled_qty) });
    assert(!rows(before, 'notifications').some(row => row.id === notification[0]));
    const notices = rows(after, 'notifications').filter(row => row.id === notification[0]); assert.equal(notices.length, 1);
    assert.equal(notices[0].character_id, notification[1]); assert.equal(notices[0].type, notification[2]);
    assert.deepEqual(typeof notices[0].payload === 'string' ? JSON.parse(notices[0].payload) : notices[0].payload, JSON.parse(notification[3]));
    const person = rows(before, 'characters').find(row => row.id === prior.seller_character), next = rows(after, 'characters').find(row => row.id === prior.seller_character);
    assert(person?.alive && next?.alive && person.account_id === next.account_id);
    for (const field of ['bank', 'bank_intransit']) assert.equal(value(person[field] || 0), value(next[field] || 0));
    const ownerDelta = delta(person.cash, next.cash), ownerReceipts = receipts.filter(row => row.character_id === person.id && row.currency === 'cash');
    assert.equal(ownerDelta, exactSum(ownerReceipts.map(row => row.amount)), 'Aggregate owner pocket differs from exact receipt net');
    result.listingIds.add(prior.id); result.usedReceipts.add(receipt.id);
    result.movements.push({ kind: 'market-order-expiry-refund', listingId: prior.id, owner: person.id, amount: String(held), receiptId: receipt.id,
      retainedFilledQuantity: final.filled_qty, provenance: 'original-market-sweep-quiescent-companion', traceRootSha256: rootHash });
    result.checks.push({ kind: 'market-order-expiry-refund', resource: 'cash', owner: person.id, escrowBefore: String(held), escrowAfter: '0',
      expiryCredit: String(held), aggregateOwnerDelta: ownerDelta, drift: '0', authority: [{ table: 'market_listings', id: prior.id }, { table: 'transactions', id: receipt.id }, { traceRootSha256: rootHash }] });
  }
  assert(Number.isSafeInteger(outcome?.lapsed) && outcome.lapsed >= result.movements.length, 'Worker return contradicts observed expiry count');
  return result;
}

export function reconcileOrderExpiry(before, after, { identity = null, receipts = [], quiescentGroupEvidence = null } = {}) {
  const result = { listingIds: new Set(), usedReceipts: new Set(), checks: [], movements: [] };
  if (identity?.outcome === 'QUIESCENT_AGGREGATE') return reconcileCompanionExpiry(before, after, { identity, receipts, quiescentGroupEvidence }, result);
  const context = contextOf(identity);
  if (context.authority !== 'original-worker' || !Number.isSafeInteger(context.logicalAt)) return result;
  const old = new Map(rows(before, 'market_listings').map(row => [row.id, row]));
  const final = new Map(rows(after, 'market_listings').map(row => [row.id, row]));
  const changed = [...new Set([...old.keys(), ...final.keys()])].filter(id => !equal(old.get(id), final.get(id)));
  if (changed.length !== 1) return result;
  const id = changed[0], a = old.get(id), b = final.get(id);
  if (a?.kind !== 'order' || a.status !== 'live' || b?.status !== 'expired') return result;
  assert.equal(identity.outcome, 'COMMITTED'); assert.equal(identity.command, 'COMMIT');
  assert.equal(b.qty, 0); assert(equal(omit(a, ['qty', 'status']), omit(b, ['qty', 'status'])), 'Expiry rewrote another order field');
  assert(Date.parse(a.expires_at) <= context.logicalAt, 'Order refunded before its deadline');
  const held = integer(a.qty) * integer(a.price); assert(held > 0n, 'Zero remaining order is outside this refund subset');
  const people = rows(before, 'characters').filter(row => row.id === a.seller_character);
  const nextPeople = rows(after, 'characters').filter(row => row.id === a.seller_character);
  assert.equal(people.length, 1); assert.equal(nextPeople.length, 1);
  const [person] = people, [next] = nextPeople; assert(person.alive && next.alive, 'Dead owner is outside living order refund scope');
  assert(equal(omit(person, ['cash']), omit(next, ['cash'])), 'Expiry changed another owner field');
  assert.equal(delta(person.cash, next.cash), String(held), 'Order escrow did not reach the living owner pocket');
  assert.equal(receipts.length, 1, 'Compound expiry receipt boundary');
  const [receipt] = receipts;
  assert.equal(receipt.reason, 'market:refund'); assert.equal(receipt.currency, 'cash'); assert.equal(receipt.character_id, person.id);
  assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null); assert.equal(value(receipt.amount), String(held));
  assert.equal(Date.parse(receipt.at), context.logicalAt);
  for (const table of Object.keys(before.tables)) {
    if (['transactions', 'market_listings', 'notifications'].includes(table)) continue;
    const aRows = table === 'characters' ? rows(before, table).filter(row => row.id !== person.id) : rows(before, table);
    const bRows = table === 'characters' ? rows(after, table).filter(row => row.id !== person.id) : rows(after, table);
    assert(equal(aRows, bRows), 'Expiry compound resource change: ' + table);
  }
  result.listingIds.add(id); result.usedReceipts.add(receipt.id);
  result.movements.push({ kind: 'market-order-expiry-refund', listingId: id, owner: person.id, amount: String(held), receiptId: receipt.id, retainedFilledQuantity: b.filled_qty });
  result.checks.push({ kind: 'market-order-expiry-refund', resource: 'cash', owner: person.id, escrowBefore: String(held), escrowAfter: '0', personalDelta: String(held), drift: '0', authority: [{ table: 'market_listings', id }, { table: 'transactions', id: receipt.id }] });
  return result;
}
