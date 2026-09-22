// Read-only extension of the ONE native car transaction witness. No RNG
// override, extra query, production receipt, or gameplay mutation is introduced.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carOf, levelOf, POPULATION, rollRarity } from '../src/rules.js';
import { createCarMeltCommitObserver, CAR_MELT_SOURCE_PINS } from './rc1-car-melt-provenance.js';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

export const NPC_CAR_SOURCE_PINS = Object.freeze({
  'src/population.js': '7ca4cfe884b3b2f8acd44a9c34c88507c9c42e0730688cac1d4bd358a7d9cecb',
  'src/rules.js': CAR_MELT_SOURCE_PINS['src/rules.js'],
  'src/rules.tail.js': CAR_MELT_SOURCE_PINS['src/rules.tail.js'],
  'src/rules.generated.js': CAR_MELT_SOURCE_PINS['src/rules.generated.js'],
});
export const NPC_CAR_SQL = Object.freeze({
  account: 'INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ($1,$2,$3)',
  persistent: 'INSERT INTO account_persistent (account_id, npc_flag) VALUES ($1,true)',
  character: `INSERT INTO characters (id, account_id, name, is_npc, season, respect, cash, muscle, cunning, speed, loc, health, energy, nerve)
     VALUES ($1,$2,$3,true,$4,$5,$6,$7,$8,$9,$10,100,50,10)`,
  car: 'INSERT INTO cars (id, character_id, model_id, trim_id, dmg, rarity) VALUES ($1,$2,$3,$4,$5,$6)',
  grant: 'INSERT INTO rng_audit (id, character_id, action, roll, outcome) VALUES ($1,$2,$3,0,$4)',
  rarity: 'INSERT INTO rng_audit (id, character_id, action, roll, outcome) VALUES ($1,$2,$3,$4,$5)',
});
let sites;
export function assertNpcCarSources() {
  let population;
  for (const [file, expected] of Object.entries(NPC_CAR_SOURCE_PINS)) {
    const text = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(sha256(text), expected, 'NPC car source changed: ' + file);
    if (file === 'src/population.js') population = text;
  }
  const line = needle => {
    assert.equal(population.split(needle).length, 2, 'NPC source site is not unique');
    return population.slice(0, population.indexOf(needle)).split('\n').length;
  };
  sites = { spawnBegin: line('export async function spawnResident('), spawnEnd: line('export async function retireResident(') - 1,
    defaultCall: line('const born = await spawnResident(client);'), wrapperCall: line('return await runPopulationInner(pool);'), carInsert: line(NPC_CAR_SQL.car) };
  return sites;
}
const sourceUrl = new URL('../src/population.js', import.meta.url).href;
function captureOrigin(sql) {
  if (!/^\s*INSERT\s+INTO\s+(?:cars|accounts|account_persistent|characters|rng_audit)\b/i.test(sql)) return null;
  const prior = Error.stackTraceLimit; let stack;
  try { Error.stackTraceLimit = 40; stack = new Error('RC1_NATIVE_QUERY_ORIGIN').stack; }
  finally { Error.stackTraceLimit = prior; }
  const frames = [];
  for (const text of stack.split('\n')) {
    const at = text.indexOf(sourceUrl + ':'); if (at < 0) continue;
    const numbers = text.slice(at + sourceUrl.length + 1).match(/^(\d+):(\d+)/); assert(numbers);
    const caller = text.slice(0, at).trim().replace(/^at\s+(?:async\s+)?/, '').replace(/\s*\($/, '');
    frames.push({ file: 'src/population.js', caller, line: Number(numbers[1]), column: Number(numbers[2]) });
  }
  return frames.length ? { kind: 'native-stack-source-site-v1', frames } : null;
}
export function createNpcCarAcquisitionCommitObserver(options) {
  assertNpcCarSources();
  assert(!options.queryOrigin && !options.provenanceExtensions, 'NPC car extension owns its source annotation');
  const { additionalQueryOrigin = null, additionalProvenanceExtensions = {}, ...baseOptions } = options;
  assert(additionalQueryOrigin === null || typeof additionalQueryOrigin === 'function');
  assert(!Object.hasOwn(additionalProvenanceExtensions, 'npcCarAcquisition'), 'Cannot replace NPC car source annotation');
  return createCarMeltCommitObserver({ ...baseOptions, queryOrigin: sql => captureOrigin(sql) ?? additionalQueryOrigin?.(sql) ?? null,
    provenanceExtensions: { ...additionalProvenanceExtensions, npcCarAcquisition: { format: 1, sourcePins: NPC_CAR_SOURCE_PINS } } });
}

// The source-pinned executed INSERTs and observed source frames are authority.
// Snapshots verify their committed effect; they never substitute for the trace.
export function verifyNpcCarAcquisition(before, after, provenance) {
  if (!provenance?.extensions?.npcCarAcquisition) return null;
  assertNpcCarSources();
  assert.deepEqual(provenance.extensions.npcCarAcquisition, { format: 1, sourcePins: NPC_CAR_SOURCE_PINS }, 'Wrong NPC car source extension');
  assert.equal(provenance.format, 1); assert.equal(provenance.boundary.outcome, 'COMMITTED');
  assert(Number.isSafeInteger(provenance.boundary.transactionId) && provenance.boundary.transactionId > 0);
  if (provenance.unsupported) return null;
  const q = provenance.queries; assert(Array.isArray(q) && q.length >= 2 && q.length <= 1024);
  assert.equal(q[0].command, 'BEGIN'); assert.equal(q.at(-1).command, 'COMMIT');
  if (q.slice(1, -1).some(e => !['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(e.command))) return null;
  const carWrites = q.filter(e => /^(?:INSERT INTO|UPDATE|DELETE FROM) cars\b/.test(e.sql.trim()));
  if (carWrites.length !== 1 || carWrites[0].sql !== NPC_CAR_SQL.car) return null;
  const carWrite = carWrites[0];
  // A direct fixture spawn or unrelated caller has no default runPopulation
  // origin, so it remains unknown even if it copied the same SQL and values.
  if (!carWrite.origin?.frames.some(f => f.caller === 'runPopulationInner' && f.line === sites.defaultCall)
    || !carWrite.origin.frames.some(f => f.caller === 'runPopulation' && f.line === sites.wrapperCall)) return null;
  const one = sql => { const matches = q.filter(e => e.sql === sql); assert.equal(matches.length, 1, 'Missing or duplicate original NPC query: ' + sql.slice(0, 55)); return matches[0]; };
  const account = one(NPC_CAR_SQL.account), persistent = one(NPC_CAR_SQL.persistent), character = one(NPC_CAR_SQL.character);
  const grant = one(NPC_CAR_SQL.grant), rarity = one(NPC_CAR_SQL.rarity);
  const operations = [account, persistent, character, carWrite, grant, rarity];
  for (const entry of operations) {
    assert.equal(entry.command, 'INSERT'); assert.equal(entry.rowCount, 1, 'NPC insert did not commit exactly one row');
    assert.equal(entry.origin?.kind, 'native-stack-source-site-v1', 'Missing native NPC query origin');
    assert(entry.origin.frames.some(f => f.file === 'src/population.js' && f.caller === 'spawnResident'
      && f.line >= sites.spawnBegin && f.line <= sites.spawnEnd), 'Query did not originate in pinned spawnResident');
    assert(entry.origin.frames.some(f => f.file === 'src/population.js' && f.caller === 'runPopulationInner' && f.line === sites.defaultCall), 'Query lacks canonical default spawn caller');
    assert(entry.origin.frames.some(f => f.file === 'src/population.js' && f.caller === 'runPopulation' && f.line === sites.wrapperCall), 'Query lacks original serialized population wrapper');
  }
  assert(carWrite.origin.frames.some(f => f.caller === 'spawnResident' && f.line === sites.carInsert), 'Car INSERT origin site changed');
  assert(operations.every((e, i) => !i || q.indexOf(e) > q.indexOf(operations[i - 1])), 'NPC grant execution order changed');
  const [carId, owner, modelId, trimId, damage, rarityName] = carWrite.parameters;
  assert.equal(carWrite.parameters.length, 6);
  const [characterId, accountId, name, season, respect, cash, muscle, cunning, speed, loc] = character.parameters;
  assert.equal(character.parameters.length, 10); assert.equal(characterId, owner);
  assert.deepEqual(account.parameters, [accountId, 'npc', 'npc:' + accountId]); assert.deepEqual(persistent.parameters, [accountId]);
  const [grantId, grantOwner, action, outcome] = grant.parameters;
  assert.deepEqual([grantOwner, action, outcome], [owner, 'npc:car', 'grant']); assert.equal(grant.parameters.length, 4);
  const [rarityId, rarityOwner, rarityAction, roll, rarityOutcome] = rarity.parameters;
  assert.equal(rarity.parameters.length, 5); assert.equal(rarityOwner, owner); assert.equal(rarityAction, 'rarity:car');
  assert(Number.isFinite(roll) && roll >= 0 && roll < 1, 'Invalid observed rarity roll');
  assert.equal(rollRarity(roll), rarityOutcome); assert.equal(rarityName, rarityOutcome);
  const level = levelOf(Number(respect)), band = POPULATION.BANDS.find(b => level >= b.lvl[0] && level <= b.lvl[1]);
  assert(band && POPULATION.MARKS.CAR_P[band.id] > 0, 'NPC car owner outside authored grant bands');
  const [lo, hi] = POPULATION.MARKS.CAR_VAL[band.id], model = carOf(modelId);
  assert(model && model.val >= lo && model.val <= hi, 'NPC model outside original band catalog');
  assert.equal(trimId, 'stock'); assert(Number.isInteger(damage) && damage >= 0 && damage <= 20, 'NPC damage outside authored selection');
  const rows = (state, table) => { assert(Array.isArray(state.tables[table]), 'Missing NPC car table ' + table); return state.tables[table]; };
  const newRow = (table, key, id) => {
    assert(!rows(before, table).some(r => r[key] === id), 'NPC acquisition reused preexisting ' + table);
    const found = rows(after, table).filter(r => r[key] === id); assert.equal(found.length, 1, 'NPC committed identity missing or duplicated: ' + table); return found[0];
  };
  const ch = newRow('characters', 'id', owner), acct = newRow('account_persistent', 'account_id', accountId), car = newRow('cars', 'id', carId);
  assert.equal(ch.is_npc, true); assert.equal(ch.alive, true); assert.equal(acct.npc_flag, true);
  for (const [field, value] of Object.entries({ account_id: accountId, name, season, respect, cash, muscle, cunning, speed, loc }))
    assert.equal(String(ch[field]), String(value), 'NPC character insert effect differs: ' + field);
  const expectedCar = { id: carId, character_id: owner, model_id: modelId, trim_id: 'stock', dmg: damage, rarity: rarityName,
    listed: false, pledged: false, minted_onchain: false, pink_slip: false, run_id: null, serial: null,
    race_limit: null, plate: null, tune: 0, nos: 0, created_at: new Date(carWrite.logicalAt).toISOString() };
  assert.deepEqual(car, expectedCar, 'Committed NPC car differs from executed insertion/default custody');
  assert.deepEqual(rows(before, 'cars').map(canonicalJson).sort(), rows(after, 'cars').filter(r => r.id !== carId).map(canonicalJson).sort(), 'Compound car disposition in NPC spawn');
  const committedGrant = newRow('rng_audit', 'id', grantId), committedRarity = newRow('rng_audit', 'id', rarityId);
  for (const [receipt, expected] of [[committedGrant, { character_id: owner, action: 'npc:car', roll: 0, outcome: 'grant' }],
    [committedRarity, { character_id: owner, action: 'rarity:car', roll, outcome: rarityName }]])
    for (const [field, value] of Object.entries(expected)) assert.equal(String(receipt[field]), String(value), 'Committed NPC receipt differs: ' + field);
  return { kind: 'exact-npc-spawn-car-source', carId, owner, accountId, grantId, rarityId, band: band.id,
    modelId, trimId, damage, rarity: rarityName, rarityRoll: roll,
    provenanceSha256: sha256(canonicalJson(provenance)), boundary: provenance.boundary,
    scope: 'One car identity/custody from the default original worker spawn path; no classification of other spawned assets or human boosts' };
}
