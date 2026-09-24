// A source annotation on the existing single bounded native transaction trace.
// This observes executed GTA choices; it does not override or replay random draws.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carOf, trimOf, rollRarity } from '../src/rules.js';
import { CAR_MELT_SOURCE_PINS, carMeltQueryShapes } from './rc1-car-melt-provenance.js';
import { createNpcMarketOrderCommitObserver } from './rc1-npc-market-order-journal.js';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

export const PLAYER_CAR_SQL = Object.freeze({
  car: 'INSERT INTO cars (id, character_id, model_id, trim_id, dmg, rarity, run_id, serial) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
  audit: 'INSERT INTO rng_audit (id, character_id, action, roll, outcome) VALUES ($1,$2,$3,$4,$5)',
});
export const PLAYER_CAR_SOURCE_PINS = Object.freeze({ 'src/economy.js': CAR_MELT_SOURCE_PINS['src/economy.js'] });
let sites;
export function assertPlayerCarSources() {
  carMeltQueryShapes();
  const source = fs.readFileSync(new URL('../src/economy.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  assert.equal(sha256(source), PLAYER_CAR_SOURCE_PINS['src/economy.js']);
  const line = needle => { assert.equal(source.split(needle).length, 2); return source.slice(0, source.indexOf(needle)).split('\n').length; };
  sites = { car: line(PLAYER_CAR_SQL.car), rarity: line("await h.rngLog(client, ch.id, 'rarity:car', rrRoll, rarity);"),
    grant: line("await h.rngLog(client, ch.id, 'gta', roll, 'success');") };
  return { ...sites };
}
const sourceUrl = new URL('../src/economy.js', import.meta.url).href;
function origin(sql) {
  if (![PLAYER_CAR_SQL.car, PLAYER_CAR_SQL.audit].includes(sql)) return null;
  const prior = Error.stackTraceLimit; let stack;
  try { Error.stackTraceLimit = 40; stack = new Error('RC1_PLAYER_CAR_ORIGIN').stack; }
  finally { Error.stackTraceLimit = prior; }
  const frames = [];
  for (const text of stack.split('\n')) {
    const at = text.indexOf(sourceUrl + ':'); if (at < 0) continue;
    const numbers = text.slice(at + sourceUrl.length + 1).match(/^(\d+):(\d+)/); assert(numbers);
    frames.push({ file: 'src/economy.js', caller: text.slice(0, at).trim().replace(/^at\s+(?:async\s+)?/, '').replace(/\s*\($/, ''),
      line: Number(numbers[1]), column: Number(numbers[2]) });
  }
  return frames.length ? { kind: 'native-player-car-source-v1', frames } : null;
}
export function createPlayerCarCommitObserver({ innerObserverFactory = createNpcMarketOrderCommitObserver,
  additionalQueryOrigin = null, additionalProvenanceExtensions = {}, ...options }) {
  assertPlayerCarSources(); assert(!Object.hasOwn(additionalProvenanceExtensions, 'playerCar'));
  return innerObserverFactory({ ...options,
    additionalQueryOrigin: sql => origin(sql) ?? additionalQueryOrigin?.(sql) ?? null,
    additionalProvenanceExtensions: { ...additionalProvenanceExtensions, playerCar: { format: 1, sourcePins: PLAYER_CAR_SOURCE_PINS } } });
}
export function verifyPlayerCarAcquisition(before, after, provenance) {
  if (!provenance?.extensions?.playerCar || provenance.unsupported) return null;
  assertPlayerCarSources();
  assert.deepEqual(provenance.extensions.playerCar, { format: 1, sourcePins: PLAYER_CAR_SOURCE_PINS });
  assert.deepEqual(provenance.sourcePins, CAR_MELT_SOURCE_PINS);
  assert.equal(provenance.format, 1); assert.equal(provenance.boundary.outcome, 'COMMITTED');
  assert(Number.isSafeInteger(provenance.boundary.transactionId) && provenance.boundary.transactionId > 0);
  const q = provenance.queries; assert(Array.isArray(q) && q.length >= 2 && q.length <= 1024);
  assert.equal(q[0].command, 'BEGIN'); assert.equal(q.at(-1).command, 'COMMIT');
  if (q.slice(1, -1).some(e => !['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(e.command))) return null;
  const writes = q.filter(e => /^(?:INSERT INTO|UPDATE|DELETE FROM) cars\b/.test(e.sql.trim()));
  if (writes.length !== 1 || writes[0].sql !== PLAYER_CAR_SQL.car) return null;
  const carWrite = writes[0];
  if (carWrite.origin?.kind !== 'native-player-car-source-v1') return null;
  const at = carWrite.logicalAt; assert(Number.isSafeInteger(at)); assert(q.every(e => e.logicalAt === at));
  const [carId, owner, modelId, trimId, damage, rarityName, runId, serial] = carWrite.parameters;
  assert.equal(carWrite.parameters.length, 8);
  if (runId !== null || serial !== null || q.some(e => /^(?:INSERT INTO|UPDATE|DELETE FROM) limited_runs\b/.test(e.sql.trim()))) return null;
  const only = sql => { const found = q.filter(e => e.sql === sql); assert.equal(found.length, 1, 'Missing/duplicate GTA query'); return found[0]; };
  const characterRead = only('SELECT * FROM characters WHERE account_id = $1 AND alive FOR UPDATE');
  assert.equal(characterRead.rows.length, 1); const ch = characterRead.rows[0];
  if (ch.is_npc || !ch.alive) return null;
  assert.equal(ch.id, owner); const accountId = ch.account_id;
  assert.deepEqual(characterRead.parameters, [accountId]);
  const owned = only(carMeltQueryShapes().bulk), garage = only('SELECT * FROM cars WHERE character_id=$1 ORDER BY created_at');
  assert.equal(owned.parameters[0], owner); assert.equal(owned.parameters[1], accountId); assert.deepEqual(garage.parameters, [owner]);
  const audits = q.filter(e => e.sql === PLAYER_CAR_SQL.audit && ['gta', 'rarity:car'].includes(e.parameters[2]));
  assert.equal(audits.length, 2); const rarity = audits.find(e => e.parameters[2] === 'rarity:car'), grant = audits.find(e => e.parameters[2] === 'gta');
  assert(rarity && grant);
  for (const [entry, site] of [[carWrite, sites.car], [rarity, sites.rarity], [grant, sites.grant]]) {
    assert.equal(entry.command, 'INSERT'); assert.equal(entry.rowCount, 1);
    assert.equal(entry.origin?.kind, 'native-player-car-source-v1');
    assert(entry.origin.frames.some(f => f.file === 'src/economy.js' && f.caller === 'boostCar' && f.line === site), 'Wrong pinned GTA source site');
  }
  const order = [characterRead, owned, garage, carWrite, rarity, grant].map(e => q.indexOf(e));
  assert(order.every((n, i) => !i || n > order[i - 1]));
  assert.equal(carOf(modelId)?.id, modelId); assert.equal(trimOf(trimId)?.id, trimId); assert(Number.isInteger(damage) && damage >= 0 && damage <= 60);
  for (const [entry, action, outcome] of [[rarity, 'rarity:car', rarityName], [grant, 'gta', 'success']]) {
    assert.equal(entry.parameters.length, 5); assert.equal(entry.parameters[1], owner);
    assert.equal(entry.parameters[2], action); assert.equal(entry.parameters[4], outcome);
    assert(Number.isFinite(entry.parameters[3]) && entry.parameters[3] >= 0 && entry.parameters[3] < 1);
  }
  assert.equal(rollRarity(rarity.parameters[3]), rarityName);
  const rows = (state, table) => { assert(Array.isArray(state.tables[table])); return state.tables[table]; };
  const one = (state, table, id) => { const found = rows(state, table).filter(r => r.id === id); assert.equal(found.length, 1); return found[0]; };
  const priorCh = one(before, 'characters', owner), nextCh = one(after, 'characters', owner);
  for (const field of ['id', 'account_id', 'is_npc', 'alive']) { assert.equal(priorCh[field], ch[field]); assert.equal(nextCh[field], ch[field]); }
  assert.deepEqual(garage.rows.map(canonicalJson).sort(), rows(before, 'cars').filter(c => c.character_id === owner).map(canonicalJson).sort());
  assert(!rows(before, 'cars').some(c => c.id === carId));
  const car = one(after, 'cars', carId);
  assert.deepEqual(car, { id: carId, character_id: owner, model_id: modelId, trim_id: trimId, dmg: damage, rarity: rarityName,
    listed: false, pledged: false, minted_onchain: false, pink_slip: false, run_id: null, serial: null,
    race_limit: null, plate: null, tune: 0, nos: 0, created_at: new Date(at).toISOString() });
  assert.deepEqual(rows(before, 'cars').map(canonicalJson).sort(), rows(after, 'cars').filter(c => c.id !== carId).map(canonicalJson).sort());
  for (const entry of [rarity, grant]) {
    assert(!rows(before, 'rng_audit').some(r => r.id === entry.parameters[0]));
    const committed = one(after, 'rng_audit', entry.parameters[0]);
    for (const [index, field] of ['id', 'character_id', 'action', 'roll', 'outcome'].entries())
      assert.equal(String(committed[field]), String(entry.parameters[index]), 'Committed GTA audit differs');
  }
  return { kind: 'exact-player-gta-car-source', carId, owner, accountId, grantId: grant.parameters[0], rarityId: rarity.parameters[0],
    modelId, trimId, damage, rarity: rarityName, provenanceSha256: sha256(canonicalJson(provenance)), boundary: provenance.boundary,
    scope: 'One non-limited car from executed original player GTA; source choices observed, RNG fairness/selection probability not replayed.' };
}
