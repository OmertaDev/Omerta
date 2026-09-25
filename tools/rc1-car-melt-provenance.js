// Test-only read-only provenance. Native PostgreSQL and the original gameplay
// implementation remain the authorities; no request/actor context is trusted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createNativeCommitObserver } from './rc1-native-commit-observer.js';
import { carMelt, ladderFenceMult, CONSTANTS } from '../src/rules.js';
import { exactSum } from './rc1-resource-journal.js';

const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const json = value => JSON.parse(JSON.stringify(value));
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}' : JSON.stringify(value);
export const CAR_MELT_SOURCE_PINS = Object.freeze({
  'src/game.js': 'bb8d9f1b9b63c4775631e0938888f2d85d1b5eb879bcf47f218d6ccd3b862f05',
  'src/economy.js': 'f563ee157adf73627e0c457be43a262151aa9ae92132aa6468ef9b63b285e835',
  'src/rules.js': 'c22a72398a46a4f0076a64692dd31ddb2555ed94e9afa0da538f3f3a773f7c24',
  'src/rules.tail.js': 'ee6bdee29f049fcac9c3530729cbdca3039ea87a18b873cf7a6d548f0af1abed',
  'src/rules.generated.js': 'ddce8118bd79f56af022a6a4e33da09d41f89829bd3b59a2e906c6e19af73ec9',
});
let shapes;
export function carMeltQueryShapes() { assertCarMeltSources(); return { ...shapes }; }
export function assertCarMeltSources() {
  const sources = {};
  for (const [file, pin] of Object.entries(CAR_MELT_SOURCE_PINS)) {
    sources[file] = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(hash(sources[file]), pin, 'Car melt provenance source changed: ' + file);
  }
  const bulk = sources['src/game.js'].match(/const bulk = await client\.query\(`([\s\S]*?)`,\s*\[ch\.id, ch\.account_id, today\]\)/);
  assert(bulk, 'Original complete loadOwned UNION not located');
  const columns = name => {
    const block = sources['src/game.js'].match(new RegExp('export const ' + name + '_PERSIST_COLUMNS = \\[([\\s\\S]*?)\\];'));
    assert(block, 'Original persist columns not located');
    return [...block[1].matchAll(/\['([^']+)'/g)].map(m => m[1]);
  };
  const persist = (table, key, name) => 'UPDATE ' + table + ' SET ' + columns(name).map((c, i) => c + '=$' + (i + 2)).join(', ') + ' WHERE ' + key + '=$1';
  shapes = { bulk: bulk[1], character: persist('characters', 'id', 'CHARACTER'), account: persist('account_persistent', 'account_id', 'ACCOUNT') };
  return CAR_MELT_SOURCE_PINS;
}

// Composition is INSIDE the existing observer's native call. Thus rows are
// copied before gameplay can mutate them and before COMMITTED is delivered.
// AsyncLocalStorage binds the actual client, not coincidentally matching IDs.
export function createCarMeltCommitObserver({ onBoundary, onAttempt, context, maxQueries = 1024, maxBytes = 8 * 1024 * 1024,
  queryOrigin = null, provenanceExtensions = null }) {
  assertCarMeltSources();
  assert(Number.isSafeInteger(maxQueries) && maxQueries > 0);
  assert(Number.isSafeInteger(maxBytes) && maxBytes > 0);
  assert(queryOrigin === null || typeof queryOrigin === 'function');
  const extensions = provenanceExtensions === null ? null : json(provenanceExtensions);
  const current = new AsyncLocalStorage(), transactions = new WeakMap();
  let armed = false;
  const base = createNativeCommitObserver({ onAttempt, context, async onBoundary(boundary) {
    const client = current.getStore(), trace = transactions.get(client);
    const carMeltProvenance = boundary.outcome === 'COMMITTED' && trace
      ? { format: 1, sourcePins: CAR_MELT_SOURCE_PINS, boundary: json(boundary), ...trace,
        ...(extensions ? { extensions: json(extensions) } : {}) } : null;
    try { await onBoundary(boundary, carMeltProvenance); }
    finally { if (['COMMITTED', 'ROLLED_BACK'].includes(boundary.outcome)) transactions.delete(client); }
  } });
  return { ...base,
    arm() { base.arm(); armed = true; },
    disarm() { base.disarm(); armed = false; },
    wrapQuery(client, query) {
      const observed = base.wrapQuery(client, async (sql, values) => {
        // Snapshot input BEFORE native dispatch (driver/caller may reuse objects).
        const text = typeof sql === 'string' ? sql : sql.text;
        const parameters = json(values ?? (typeof sql === 'object' ? sql.values : null) ?? []);
        // Optional test-only origin annotation shares this one bounded native
        // trace. It sees SQL identity only and cannot alter parameters/results.
        const origin = armed && queryOrigin ? queryOrigin(text) : null;
        let result;
        try { result = await query(sql, values); }
        catch (error) { if (armed && transactions.has(client)) transactions.get(client).unsupported = 'native-query-failure'; throw error; }
        if (!armed) return result;
        if (result.command === 'BEGIN') transactions.set(client, { queries: [], bytes: 0, unsupported: null });
        const trace = transactions.get(client);
        if (trace && !trace.unsupported) {
          const entry = { sql: text.replaceAll('\r\n', '\n'), parameters, command: result.command,
            rowCount: result.rowCount ?? null, rows: json(result.rows), logicalAt: Date.now(),
            ...(origin === null ? {} : { origin: json(origin) }) };
          const bytes = Buffer.byteLength(JSON.stringify(entry));
          if (trace.queries.length >= maxQueries || trace.bytes + bytes > maxBytes) trace.unsupported = 'bounded-trace-overflow';
          else { trace.queries.push(entry); trace.bytes += bytes; }
        }
        return result;
      });
      return (sql, values) => current.run(client, () => observed(sql, values));
    },
  };
}

// This verifier accepts retained native evidence, not an authority supplied by
// a player. A caller must retain the collector/source/boundary custody chain.
// No provenance => no upgrade. Unsupported trace => ordinary unknown lineage.
export function verifySoloCarMelt(before, after, provenance) {
  return verifyCarMelt(before, after, provenance, false);
}
export function verifyFamilyCarMelt(before, after, provenance) {
  return verifyCarMelt(before, after, provenance, true);
}
function verifyCarMelt(before, after, provenance, family) {
  if (!provenance) return null;
  assertCarMeltSources();
  assert.equal(provenance.format, 1);
  assert.deepEqual(provenance.sourcePins, CAR_MELT_SOURCE_PINS, 'Wrong melt source pins');
  assert.equal(provenance.boundary.outcome, 'COMMITTED', 'Melt witness is not committed');
  assert(Number.isSafeInteger(provenance.boundary.transactionId) && provenance.boundary.transactionId > 0);
  if (provenance.unsupported) return null;
  const q = provenance.queries;
  assert(Array.isArray(q) && q.length >= 2 && q.length <= 1024, 'Incomplete melt trace');
  assert.equal(q[0].command, 'BEGIN'); assert.equal(q.at(-1).command, 'COMMIT');
  if (q.slice(1, -1).some(e => !['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(e.command))) return null;
  const select = sql => q.filter(e => e.sql === sql);
  const only = sql => { const matches = select(sql); assert.equal(matches.length, 1, 'Missing or ambiguous melt query: ' + sql.slice(0, 70)); return matches[0]; };
  const deletes = q.filter(e => /^DELETE\s+FROM\s+cars\b/i.test(e.sql.trim()));
  const ledgers = select('INSERT INTO transactions (id, character_id, account_id, currency, amount, reason, counterparty) VALUES ($1,$2,$3,$4,$5,$6,$7)');
  // No car destruction / melt at this boundary is not a candidate.
  if (!deletes.length || !ledgers.some(e => e.parameters[5] === 'melt')) return null;
  if (deletes.length !== 1 || ledgers.length !== (family ? 3 : 1)) return null;
  const deletion = only('DELETE FROM cars WHERE id=$1'), personal = ledgers.filter(e => e.parameters[5] === 'melt');
  assert.equal(personal.length, 1, 'Ambiguous personal melt receipt');
  const receipt = personal[0];
  const characterRead = only('SELECT * FROM characters WHERE account_id = $1 AND alive FOR UPDATE');
  const accountRead = only('SELECT * FROM account_persistent WHERE account_id = $1 FOR UPDATE');
  const owned = only(shapes.bulk), garage = only('SELECT * FROM cars WHERE character_id=$1 ORDER BY created_at');
  assert.equal(characterRead.rows.length, 1); assert.equal(accountRead.rows.length, 1);
  const ch = characterRead.rows[0], acct = accountRead.rows[0], owner = ch.id, accountId = ch.account_id;
  const memberships = owned.rows.filter(r => r.src === 'gm');
  if (ch.is_npc || !ch.alive || memberships.length !== (family ? 1 : 0)
    || owned.rows.some(r => r.src === 'sk' && ['kingpin', 'fence_network'].includes(r.k))
    || Number(acct.staked || 0) !== 0 || acct.made_until || acct.stake_lock_until) return null;
  assert.deepEqual(characterRead.parameters, [accountId]); assert.deepEqual(accountRead.parameters, [accountId]);
  assert.equal(acct.account_id, accountId); assert.equal(owned.parameters[0], owner); assert.equal(owned.parameters[1], accountId);
  assert.deepEqual(garage.parameters, [owner]); assert.equal(deletion.parameters.length, 1);
  assert.equal(deletion.rowCount, 1, 'Melt deletion did not delete exactly one car');
  const carId = deletion.parameters[0], readCars = garage.rows.filter(c => c.id === carId);
  assert.equal(readCars.length, 1, 'Deleted car absent from original owned read');
  const car = readCars[0]; assert.equal(car.character_id, owner, 'Melt car belongs to another owner');
  if (car.run_id || car.listed || car.pledged || car.minted_onchain) return null;
  const at = deletion.logicalAt;
  assert(Number.isFinite(at)); assert(q.every(e => e.logicalAt === at), 'Melt trace crossed an unsupported logical clock boundary');
  assert.equal(ladderFenceMult(acct, at), 1, 'Melt account is not a neutral ladder');
  // Refuse compound mutation shapes. The only data writes in the pinned solo
  // operation are the car, one ledger row, daily counter, and wrapper persistence.
  const familyId = family ? memberships[0].k : null;
  const titheWrite = family ? only('UPDATE gangs SET ammo_bank = ammo_bank + $2, treasury = treasury + $3 WHERE id=$1') : null;
  const allowed = e => e === deletion || ledgers.includes(e) || e === titheWrite
    || e.sql === shapes.character && e.parameters[0] === owner
    || e.sql === shapes.account && e.parameters[0] === accountId
    || ['DELETE FROM stash WHERE character_id=$1', 'DELETE FROM makings WHERE character_id=$1'].includes(e.sql) && e.parameters[0] === owner && e.rowCount === 0
    || ['UPDATE daily_progress SET counters=$3 WHERE character_id=$1 AND day=$2',
      'INSERT INTO daily_progress (character_id, day, counters) VALUES ($1,$2,$3)'].includes(e.sql) && e.parameters[0] === owner;
  if (q.some(e => ['INSERT', 'UPDATE', 'DELETE'].includes(e.command) && !allowed(e))) return null;
  for (const sql of [shapes.character, shapes.account, 'DELETE FROM stash WHERE character_id=$1', 'DELETE FROM makings WHERE character_id=$1']) {
    const write = only(sql); assert(q.indexOf(write) > q.indexOf(receipt), 'Melt wrapper persistence precedes action');
  }
  const order = [characterRead, accountRead, owned, garage, deletion, receipt].map(e => q.indexOf(e));
  assert(order.every((n, i) => !i || n > order[i - 1]), 'Melt provenance query order differs from original execution');
  if (family) {
    const tail = [receipt, titheWrite, ...ledgers.filter(e => e !== receipt)].map(e => q.indexOf(e));
    assert(tail.every((n, i) => !i || n > tail[i - 1]), 'Family tithe query order differs from original execution');
    assert(q.indexOf(only(shapes.character)) > tail.at(-1), 'Family tithe follows wrapper persistence');
  }
  const table = (s, name) => { assert(Array.isArray(s.tables[name]), 'Missing melt evidence: ' + name); return s.tables[name]; };
  const row = (s, name, field, id) => { const matches = table(s, name).filter(r => r[field] === id); assert.equal(matches.length, 1, 'Missing or duplicate melt ' + name); return matches[0]; };
  const priorCar = row(before, 'cars', 'id', carId);
  assert.deepEqual(json(priorCar), car, 'Executed car read differs from boundary snapshot');
  assert(!table(after, 'cars').some(r => r.id === carId), 'Melt car was not destroyed');
  const beforeCars = table(before, 'cars').filter(r => r.id !== carId), afterCars = table(after, 'cars');
  assert.deepEqual(beforeCars.map(canonical).sort(), afterCars.map(canonical).sort(), 'Compound car transition in solo melt');
  const priorCh = row(before, 'characters', 'id', owner), nextCh = row(after, 'characters', 'id', owner);
  for (const field of ['id', 'account_id', 'is_npc', 'alive', 'ammo']) assert.equal(String(priorCh[field]), String(ch[field]), 'Locked owner differs: ' + field);
  assert.equal(nextCh.account_id, accountId); assert.equal(nextCh.alive, true); assert.equal(nextCh.is_npc, false);
  for (const state of [before, after]) {
    const members = table(state, 'gang_members').filter(r => r.character_id === owner);
    if (family) {
      assert.equal(members.length, 1); assert.equal(members[0].gang_id, familyId);
      assert.equal(members[0].role, memberships[0].k2);
    } else assert.equal(members.length, 0, 'Solo melt boundary contains Family membership');
    const account = row(state, 'account_persistent', 'account_id', accountId);
    for (const field of ['staked', 'made_until', 'stake_lock_until', 'stake_lock_mult'])
      assert.equal(String(account[field]), String(acct[field]), 'Melt ladder input changed: ' + field);
  }
  const yieldRounds = Math.floor(carMelt(car.model_id, car.trim_id, car.dmg));
  const tithe = family ? Math.floor(yieldRounds * CONSTANTS.MELT_TITHE) : 0, rounds = yieldRounds - tithe;
  assert(Number.isSafeInteger(rounds) && rounds > 0);
  const [receiptId, characterId, ledgerAccount, currency, amount, reason, counterparty] = receipt.parameters;
  assert.deepEqual([characterId, ledgerAccount, currency, Number(amount), reason, counterparty], [owner, null, 'ammo', rounds, 'melt', null], 'Original melt ledger yield/owner mismatch');
  assert.equal(receipt.rowCount, 1, 'Original melt ledger insert cardinality');
  assert(!table(before, 'transactions').some(r => r.id === receiptId), 'Melt receipt was already present');
  const actualReceipt = row(after, 'transactions', 'id', receiptId);
  for (const [field, expected] of Object.entries({ character_id: owner, account_id: null, currency: 'ammo', amount: rounds, reason: 'melt', counterparty: null }))
    assert.equal(String(actualReceipt[field]), String(expected), 'Committed melt receipt mismatch: ' + field);
  assert.equal(Number(nextCh.ammo) - Number(priorCh.ammo), rounds, 'Exact personal melt ammo delta mismatch');
  const titheReceiptIds = [];
  if (family) {
    assert(tithe > 0); const cash = tithe * CONSTANTS.TITHE_ROUND_VALUE;
    assert.deepEqual(titheWrite.parameters, [familyId, tithe, cash]); assert.equal(titheWrite.rowCount, 1);
    assert.deepEqual(table(before, 'gang_members'), table(after, 'gang_members'), 'Melt changed Family membership');
    const oldFamily = row(before, 'gangs', 'id', familyId), newFamily = row(after, 'gangs', 'id', familyId);
    for (const field of new Set([...Object.keys(oldFamily), ...Object.keys(newFamily)]))
      if (!['ammo_bank', 'treasury'].includes(field)) assert.deepEqual(newFamily[field], oldFamily[field], 'Compound Family melt field: ' + field);
    assert.equal(exactSum([oldFamily.ammo_bank, tithe]), exactSum([newFamily.ammo_bank]), 'Wrong Family melt ammo endpoint');
    assert.equal(exactSum([oldFamily.treasury, cash]), exactSum([newFamily.treasury]), 'Wrong Family melt cash endpoint');
    assert.deepEqual(table(before, 'gangs').filter(g => g.id !== familyId), table(after, 'gangs').filter(g => g.id !== familyId), 'Melt changed another Family');
    for (const [index, currency, amount] of [[1, 'ammo', tithe], [2, 'cash', cash]]) {
      const entry = ledgers[index]; assert.equal(entry.rowCount, 1);
      assert.deepEqual(entry.parameters.slice(1), [null, null, currency, amount, 'melt:tithe', familyId]);
      const id = entry.parameters[0]; assert(!table(before, 'transactions').some(r => r.id === id));
      assert(![receiptId, ...titheReceiptIds].includes(id), 'Melt receipt reused');
      const committed = row(after, 'transactions', 'id', id);
      for (const [field, expected] of Object.entries({ character_id: null, account_id: null, currency, amount, reason: 'melt:tithe', counterparty: familyId }))
        assert.equal(String(committed[field]), String(expected), 'Committed Family tithe mismatch: ' + field);
      titheReceiptIds.push(id);
    }
  }
  return { kind: family ? 'exact-family-melt-sink' : 'exact-solo-melt-sink', carId, owner, accountId, rounds, receiptId,
    ...(family ? { familyId, totalRounds: yieldRounds, titheRounds: tithe, titheCash: tithe * CONSTANTS.TITHE_ROUND_VALUE, titheReceiptIds } : {}),
    provenanceSha256: hash(canonical(provenance)), boundary: provenance.boundary,
    inputs: { model: car.model_id, trim: car.trim_id, damage: car.dmg, fenceMultiplier: 1, kingpinMultiplier: 1, ladderMultiplier: 1, tithe } };
}
