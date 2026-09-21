// Test-only returned-query provenance. This neither writes SQL nor takes snapshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createNativeCommitObserver } from './rc1-native-commit-observer.js';
export const NPC_FAMILY_SOURCE_PINS = Object.freeze({
  'src/population.js': '7a54934015fa68f99d008aca4699b168efc6b8e1c73dbccd8e3c9802396c151c',
  'src/social/gangs.js': 'f8ac8bdd2ee2706619d2d5cfd5ef8901f05415703c67cdd08d4e6e5554f53ad7',
  'src/game.js': '7d6c61102dd14b8b54780fe2c32eb1f794ed2677263b8611edd37e7df1fa9645',
  'src/rules.js': 'c22a72398a46a4f0076a64692dd31ddb2555ed94e9afa0da538f3f3a773f7c24',
  'src/rules.tail.js': 'ee6bdee29f049fcac9c3530729cbdca3039ea87a18b873cf7a6d548f0af1abed',
  'src/rules.generated.js': 'ddce8118bd79f56af022a6a4e33da09d41f89829bd3b59a2e906c6e19af73ec9',
});
export const NPC_FORMATION_SQL = Object.freeze([
  'BEGIN', 'SELECT name FROM gangs', 'SELECT character_id FROM gang_members',
  'SELECT * FROM characters WHERE alive AND is_npc AND respect >= $1 ORDER BY cash DESC LIMIT 32',
  'SELECT * FROM characters WHERE id=$1 AND alive AND is_npc FOR UPDATE',
  'SELECT 1 FROM gang_members WHERE character_id=$1',
  'SELECT id FROM gangs WHERE name=$1 OR tag=$2',
  'INSERT INTO gangs (id, name, tag, season) VALUES ($1,$2,$3,$4)',
  'INSERT INTO gang_members (gang_id, character_id, role) VALUES ($1,$2,$3)',
  'INSERT INTO transactions (id, character_id, account_id, currency, amount, reason, counterparty) VALUES ($1,$2,$3,$4,$5,$6,$7)',
  'UPDATE characters SET cash=$2 WHERE id=$1',
  'UPDATE gangs SET npc_flag=true, war_pool=$2, war_pool_at=now() WHERE id=$1', 'COMMIT',
]);
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const normalize = sql => sql.replace(/\s+/g, ' ').trim();
const known = new Set([...NPC_FORMATION_SQL, 'ROLLBACK']);
const sourceUrls = Object.fromEntries(Object.keys(NPC_FAMILY_SOURCE_PINS).map(file => [file, new URL('../' + file, import.meta.url).href]));
function frames(stack) {
  const result = [];
  for (const line of String(stack).split('\n')) for (const [file, url] of Object.entries(sourceUrls)) {
    if (!line.includes(url + ':')) continue;
    const match = line.trim().match(/^at (?:async )?([^ ]+) \(.+:(\d+):(\d+)\)$/);
    if (match) result.push({ file, function: match[1], line: Number(match[2]), column: Number(match[3]) });
  }
  return result;
}
function captureFrames() {
  // Composed native/query-order wrappers add frames above ledger→createGang.
  // Capture synchronously and restore even when a stack formatter throws.
  const prior = Error.stackTraceLimit;
  try { Error.stackTraceLimit = 40; return frames(new Error().stack); }
  finally { Error.stackTraceLimit = prior; }
}
export function assertNpcFamilySourcePins() {
  for (const [file, pin] of Object.entries(NPC_FAMILY_SOURCE_PINS))
    assert.equal(hash(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r\n', '\n')), pin, `NPC provenance source changed: ${file}`);
}
export function createNpcFamilyCommitObserver({ innerObserverFactory = createNativeCommitObserver, onBoundary, ...options }) {
  assertNpcFamilySourcePins();
  const transactions = new WeakMap(); let armed = false, open = 0, last = null;
  const diagnostic = { committedCandidates: 0, rolledBackCandidates: 0, rejectedShapeCandidates: 0 };
  const inner = innerObserverFactory({ ...options, onBoundary: async (event, carMeltProvenance, ...extra) => {
    assert.equal(extra.length, 0, 'Unknown inner observer callback argument');
    assert(last && last.sqlSha256 === event.sqlSha256 && last.command === event.command, 'Native statement/boundary provenance mismatch');
    let provenance = null;
    if (last.transaction?.candidate) {
      const transaction = last.transaction;
      provenance = { format: 1, sourcePins: NPC_FAMILY_SOURCE_PINS, boundary: plain(event),
        outcome: event.outcome, statements: transaction.statements, unsupportedShape: transaction.unsupported,
        authority: 'Observed native returned statements and original source caller frames; war_pool is nonmonetary standing' };
      provenance.sha256 = hash(provenance);
      if (event.outcome === 'COMMITTED') diagnostic.committedCandidates++;
      else if (event.outcome === 'ROLLED_BACK') diagnostic.rolledBackCandidates++;
      if (transaction.unsupported) diagnostic.rejectedShapeCandidates++;
    }
    await onBoundary(event, carMeltProvenance, provenance);
  } });
  return {
    arm() { inner.arm(); assert(!armed); armed = true; },
    disarm() { inner.disarm(); assert.equal(open, 0); armed = false; },
    assertComplete() { inner.assertComplete(); assert.equal(open, 0); },
    diagnostic() { return { ...inner.diagnostic(), npcFamilyProvenance: { ...diagnostic, open } }; },
    wrapQuery(client, query) {
      return inner.wrapQuery(client, async (sql, values) => {
        if (!armed) return query(sql, values);
        const text = typeof sql === 'string' ? sql : sql.text, normalized = normalize(text), callerFrames = captureFrames();
        const parameters = plain(values ?? (typeof sql === 'object' ? sql.values : undefined) ?? []);
        let returned, error; try { returned = await query(sql, values); } catch (caught) { error = caught; }
        const command = returned?.command ?? null;
        if (command === 'BEGIN') { assert(!transactions.has(client)); transactions.set(client, { statements: [], candidate: false, unsupported: false }); open++; }
        const transaction = transactions.get(client);
        if (transaction) {
          if (normalized === NPC_FORMATION_SQL[11]) transaction.candidate = true;
          const bounded = known.has(normalized) && transaction.statements.length < 20 && (returned?.rows?.length ?? 0) <= 128
            && Buffer.byteLength(JSON.stringify(parameters)) <= 65536 && Buffer.byteLength(JSON.stringify(returned?.rows ?? [])) <= 2 * 1024 * 1024;
          if (!bounded) transaction.unsupported = true;
          else transaction.statements.push({ sql: normalized, rawSql: text, sqlSha256: hash(text), parameters, callerFrames,
            outcome: error ? 'THREW' : 'RETURNED', command, rowCount: returned?.rowCount ?? null,
            rows: plain(returned?.rows ?? []), ...(error ? { code: error.code || error.name } : {}) });
        }
        last = { sqlSha256: hash(text), command, transaction };
        if (command === 'COMMIT' || command === 'ROLLBACK' && ['COMMIT', 'ROLLBACK'].includes(normalized)) {
          if (transaction) { transactions.delete(client); open--; }
        }
        if (error) throw error;
        return returned;
      });
    },
  };
}
export function verifyNpcProvenanceEnvelope(value, event) {
  assert(value && value.format === 1, 'Missing NPC statement provenance');
  const { sha256, ...body } = value; assert.equal(sha256, hash(body), 'NPC provenance bytes changed');
  assert.deepEqual(value.sourcePins, NPC_FAMILY_SOURCE_PINS); assert.deepEqual(value.boundary, event);
  assert.equal(value.outcome, 'COMMITTED'); assert.equal(event.outcome, 'COMMITTED'); assert.equal(event.command, 'COMMIT');
  assert.equal(event.context?.authority, 'original-worker'); assert(Number.isSafeInteger(event.transactionId));
  assert.equal(value.unsupportedShape, false, 'Compound/unknown statements in NPC formation');
  assert.deepEqual(value.statements.map(row => row.sql), NPC_FORMATION_SQL, 'Missing, duplicated, reordered or unknown NPC statement');
  for (const [i, row] of value.statements.entries()) {
    assert.equal(row.outcome, 'RETURNED');
    assert.equal(row.sqlSha256, hash(row.rawSql)); assert.equal(normalize(row.rawSql), row.sql);
    assert(Array.isArray(row.rows));
    if (i >= 1 && i <= 6) { assert.equal(row.command, 'SELECT'); assert.equal(row.rowCount, row.rows.length); }
    const origin = i === 0 || i === 12 ? ['src/population.js', 'runFamilies']
      : i >= 6 && i <= 8 ? ['src/social/gangs.js', 'createGang']
      : i === 9 ? ['src/game.js', 'ledger'] : ['src/population.js', 'foundNpcFamily'];
    assert(row.callerFrames.some(frame => frame.file === origin[0] && frame.function === origin[1]), `Missing original caller for NPC statement ${i}`);
    assert(row.callerFrames.some(frame => frame.file === 'src/population.js' && ['runFamilies','foundNpcFamily'].includes(frame.function)), 'Missing original population caller');
  }
  assert.equal(value.statements.at(-1).sqlSha256, event.sqlSha256);
  return value.statements;
}
