// Read-only exact custody classifier for the explicitly exercised shipment branches.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { SHIPMENT, M3, levelOf, commissionOf, shipmentCityCap } from '../src/rules.js';
import { equation, exactSum, negate } from './rc1-resource-journal.js';
export const SHIPMENT_TABLES = ['characters', 'account_persistent', 'transactions', 'shipment_days', 'shipment_takes',
  'bespoke_pieces', 'bespoke_serials', 'idempotency', 'kill_log', 'notifications', 'searches'];
export const shipmentRequestHash = ({ method = 'POST', url, payload }) => crypto.createHash('sha256')
  .update(`${method}\n${url}\n${JSON.stringify(payload ?? null)}`).digest('hex');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = row => row.id;
const receiptKey = row => `${row.account_id}/${row.key}`;
const takeKey = row => `${row.day}/${row.character_id}`;
const pieceKey = row => `${row.commission_id}/${row.serial}`;
const index = (rows, getKey) => { const result = new Map(); for (const row of rows) { const id = getKey(row); assert(!result.has(id), `Duplicate identity ${id}`); result.set(id, row); } return result; };
const added = (old, now, getKey) => { const prior = index(old, getKey), current = index(now, getKey);
  for (const [id, row] of prior) assert.deepEqual(current.get(id), row, `Missing/rewritten immutable row ${id}`);
  return now.filter(row => !prior.has(getKey(row))); };
export async function snapshotShipment(pool) {
  const client = await pool.connect();
  try { await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const value = {};
    for (const table of SHIPMENT_TABLES) value[table] = (await client.query(`SELECT * FROM ${table}`)).rows.map(row => JSON.parse(JSON.stringify(row)))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    await client.query('COMMIT'); return value;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
export const shipmentCustodyHash = state => hash({ characters: state.characters.map(row => ({ id: row.id, account: row.account_id, alive: row.alive,
  cash: row.cash, bank: row.bank, ammo: row.ammo, shipment: row.shipment })), transactions: state.transactions, days: state.shipment_days,
  takes: state.shipment_takes, pieces: state.bespoke_pieces, serials: state.bespoke_serials, receipts: state.idempotency });
export function reconcileShipment(before, after, { commands = [], label = '' } = {}) {
  const receipts = added(before.transactions, after.transactions, key), durable = added(before.idempotency, after.idempotency, receiptKey);
  const pieces = added(before.bespoke_pieces, after.bespoke_pieces, pieceKey), oldChars = index(before.characters, key), chars = index(after.characters, key);
  const requests = [];
  for (const row of durable) {
    const matches = commands.filter(command => command.accountId === row.account_id && command.key === row.key && shipmentRequestHash(command) === row.body_hash);
    assert(matches.some(command => command.status === 200), 'Durable receipt lacks completed observed request'); assert.equal(row.status, 200);
    const command = matches.find(command => command.status === 200), response = JSON.parse(row.response);
    assert.deepEqual(response, command.body, 'Stored response differs from observed response'); requests.push({ command, response, row });
  }
  const stored = index(after.idempotency, receiptKey);
  for (const command of commands.filter(command => command.status === 200 && command.key)) {
    const row = stored.get(`${command.accountId}/${command.key}`); assert(row && row.body_hash === shipmentRequestHash(command));
    assert.deepEqual(JSON.parse(row.response), command.body, 'Success/replay does not name its durable receipt');
  }
  const material = new Map(), authority = new Map(), lineage = [], equations = [];
  const add = (id, amount, kind, evidence) => { assert(chars.has(id) || oldChars.has(id), 'Unknown material owner'); assert(amount >= 0);
    const entry = material.get(id) || {}; entry[kind] = (entry[kind] || 0) + amount; material.set(id, entry);
    authority.set(id, [...(authority.get(id) || []), evidence]); };
  const deaths = before.characters.filter(row => row.alive && chars.get(row.id)?.alive === false), classifiedDeaths = new Set();
  for (const { command, response, row } of requests.filter(item => /\/fire$/.test(item.command.url) && item.response.kill)) {
    const victimId = command.url.split('/')[3], victim = oldChars.get(victimId), killer = oldChars.get(response.character.id);
    assert(victim?.alive && killer?.alive); assert.equal(killer.account_id, command.accountId); assert(deaths.some(dead => dead.id === victimId));
    assert(!classifiedDeaths.has(victimId)); classifiedDeaths.add(victimId);
    const eligible = levelOf(Number(victim.respect)) >= M3.LOOT_MIN_LVL, loot = eligible ? Math.floor(Number(victim.shipment) * SHIPMENT.LOOT_RATE) : 0;
    assert.equal(response.lootable, eligible); assert.equal(response.matLoot, loot, 'Canonical material loot floor disagrees');
    const killRows = after.kill_log.filter(kill => !before.kill_log.some(prior => prior.id === kill.id) && kill.killer_account === killer.account_id && kill.victim_account === victim.account_id);
    assert.equal(killRows.length, 1, 'Death requires one canonical owner-linked kill receipt');
    const evidence = { rule: 'src/social/combat.js fire material loot; src/social/estate.js original terminal and heir',
      victim: victimId, killer: killer.id, killId: killRows[0].id, receipt: receiptKey(row), lootable: eligible, beforeMaterial: victim.shipment, lootRate: SHIPMENT.LOOT_RATE };
    add(victim.id, loot, 'transferredOut', evidence); add(victim.id, Number(victim.shipment) - loot, 'destroyed', evidence);
    if (loot) add(killer.id, loot, 'transferredIn', evidence);
    const heirs = after.characters.filter(ch => ch.alive && ch.account_id === victim.account_id && !oldChars.has(ch.id));
    assert.equal(heirs.length, 1); assert.equal(heirs[0].shipment, 0); assert.equal(heirs[0].generation, victim.generation + 1);
    // Dead rows retain historical values. They are evidence, never spendable custody.
    assert.equal(Number(chars.get(victim.id).shipment), Number(victim.shipment) - loot, 'Unexpected dead material history');
    lineage.push({ kind: 'fire-death', from: victim.id, to: killer.id, transferred: loot, destroyed: Number(victim.shipment) - loot, heir: heirs[0].id, evidence });
  }
  assert.equal(classifiedDeaths.size, deaths.length, 'Unclassified character terminal');
  const oldTakes = index(before.shipment_takes, takeKey), takes = index(after.shipment_takes, takeKey), claimed = new Set(), dayGrants = new Map();
  for (const { command, response, row } of requests.filter(item => item.command.url === '/v1/shipment/take')) {
    const actor = chars.get(response.character.id); assert(actor?.alive); assert.equal(actor.account_id, command.accountId);
    const matches = after.shipment_takes.filter(take => take.character_id === actor.id && take.n !== oldTakes.get(takeKey(take))?.n);
    assert.equal(matches.length, 1, 'Take must bind one exact owner/day authority'); const take = matches[0], delta = take.n - (oldTakes.get(takeKey(take))?.n || 0);
    assert(!claimed.has(takeKey(take))); claimed.add(takeKey(take)); assert.equal(delta, response.took); assert(delta > 0 && take.n <= SHIPMENT.PER_PLAYER);
    dayGrants.set(take.day, (dayGrants.get(take.day) || 0) + delta);
    const evidence = { table: 'shipment_takes', key: takeKey(take), before: take.n - delta, after: take.n, receipt: receiptKey(row) };
    add(actor.id, delta, 'created', evidence); lineage.push({ kind: 'take', owner: actor.id, day: take.day, created: delta, evidence });
  }
  for (const [id, prior] of oldTakes) {
    if (!takes.has(id)) assert(classifiedDeaths.has(prior.character_id), 'Take authority disappeared without its canonical estate');
    else if (!claimed.has(id)) assert.deepEqual(takes.get(id), prior);
  }
  for (const [id] of takes) assert(oldTakes.has(id) || claimed.has(id), 'Unexplained take authority');
  const oldDays = index(before.shipment_days, row => row.day), days = index(after.shipment_days, row => row.day);
  for (const [day, row] of days) {
    const prior = oldDays.get(day); if (prior) for (const field of ['district', 'cap', 'pop']) assert.equal(row[field], prior[field], `Stamped ${field} changed`);
    assert.equal(row.cap, shipmentCityCap(row.pop)); assert.equal(row.taken - (prior?.taken || 0), dayGrants.get(day) || 0, 'Day cap not explained by canonical takes');
    assert(row.taken >= 0 && row.taken <= row.cap);
  }
  for (const day of oldDays.keys()) assert(days.has(day));
  const commissioned = new Set();
  for (const { command, response, row } of requests.filter(item => item.command.url.startsWith('/v1/shipment/commission/'))) {
    const piece = commissionOf(command.url.split('/').at(-1)), actor = chars.get(response.character.id); assert(piece && actor?.alive); assert.equal(actor.account_id, command.accountId);
    const created = pieces.filter(item => item.account_id === actor.account_id && item.commission_id === piece.id && item.serial === response.piece.serial);
    assert.equal(created.length, 1); assert(!commissioned.has(pieceKey(created[0]))); commissioned.add(pieceKey(created[0]));
    assert.equal(response.units, piece.units); assert.equal(response.spent, piece.cash);
    const debit = receipts.filter(tx => tx.character_id === actor.id && tx.reason === 'shipment:commission' && tx.currency === 'cash'); assert.equal(debit.length, 1); assert.equal(String(debit[0].amount), String(-piece.cash));
    const evidence = { table: 'bespoke_pieces', key: pieceKey(created[0]), owner: actor.account_id, cashReceipt: debit[0].id, request: receiptKey(row) };
    add(actor.id, piece.units, 'destroyed', evidence); lineage.push({ kind: 'commission', owner: actor.id, consumed: piece.units, cash: piece.cash, piece: created[0], evidence });
  }
  assert.equal(commissioned.size, pieces.length, 'Unexplained bespoke output');
  const oldSerials = index(before.bespoke_serials, row => row.commission_id);
  for (const serial of after.bespoke_serials) { const created = pieces.filter(piece => piece.commission_id === serial.commission_id), prior = Number(oldSerials.get(serial.commission_id)?.minted || 0);
    assert.equal(serial.minted, prior + created.length, 'Serial increment differs from actual outputs');
    assert.deepEqual(created.map(piece => piece.serial).sort((a, b) => a - b), Array.from({ length: created.length }, (_, i) => prior + i + 1)); }
  for (const id of oldSerials.keys()) assert(after.bespoke_serials.some(row => row.commission_id === id));
  for (const ch of after.characters) {
    const prior = oldChars.get(ch.id), beforeUnits = prior?.alive ? Number(prior.shipment) : 0, afterUnits = ch.alive ? Number(ch.shipment) : 0;
    assert(Number.isSafeInteger(beforeUnits) && Number.isSafeInteger(afterUnits) && afterUnits >= 0);
    const changes = material.get(ch.id) || {};
    equations.push(equation({ resource: 'shipment-material', owner: ch.id, before: beforeUnits, after: afterUnits,
      ...changes,
      authority: authority.get(ch.id) || [{ rule: 'No classified material action permits this owner to change', label }] }));
    if (!prior) assert(deaths.some(dead => dead.account_id === ch.account_id), 'Unclassified character creation');
    for (const currency of ['cash', 'ammo']) {
      const receiptRows = receipts.filter(tx => tx.character_id === ch.id && tx.currency === currency), freshDefault = prior ? 0 : currency === 'cash' ? 500 : 25;
      const amount = row => currency === 'cash' ? exactSum([row?.cash || 0, row?.bank || 0]) : row?.ammo || 0;
      const change = exactSum([freshDefault, ...receiptRows.map(tx => tx.amount)]);
      equations.push(equation({ resource: currency, owner: ch.id, before: amount(prior), after: amount(ch), created: change,
        authority: [{ rule: 'Exact character ledger parity plus declared canonical newborn defaults', newbornDefault: freshDefault, receiptIds: receiptRows.map(tx => tx.id) }] }));
    }
  }
  for (const id of oldChars.keys()) assert(chars.has(id), 'Historical character disappeared');
  return { version: 1, beforeHash: hash(before), afterHash: hash(after), lineage, equations, fullResourceCoverage: false,
    unsupported: ['Apex rout material grants', 'Other death paths without observed fire authority', 'Natural progression and combat acquisition', 'Network/browser/deployment', 'Other resource custody and full simulation matrix'] };
}
