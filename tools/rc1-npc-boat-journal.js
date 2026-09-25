// Diagnostic source/query provenance for one original worker NPC dinghy grant.
// Boats have no authored grant receipt. No receipt or gameplay write is invented.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { levelOf, POPULATION, rollRarity } from '../src/rules.js';
import { createNpcCarAcquisitionCommitObserver, NPC_CAR_SOURCE_PINS, NPC_CAR_SQL } from './rc1-npc-car-acquisition.js';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

export const NPC_BOAT_SOURCE_PINS = Object.freeze({ ...NPC_CAR_SOURCE_PINS });
export const NPC_BOAT_INSERT = 'INSERT INTO boats (id, character_id, kind, rarity) VALUES ($1,$2,$3,$4)';
let sites;
export function assertNpcBoatSources() {
  let population;
  for (const [file, expected] of Object.entries(NPC_BOAT_SOURCE_PINS)) {
    const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(sha256(source), expected, 'NPC boat source changed: ' + file);
    if (file === 'src/population.js') population = source;
  }
  const line = needle => { assert.equal(population.split(needle).length, 2); return population.slice(0, population.indexOf(needle)).split('\n').length; };
  sites = { begin: line('export async function spawnResident('), end: line('export async function retireResident(') - 1,
    defaultCall: line('const born = await spawnResident(client);'), wrapperCall: line('return await runPopulationInner(pool);'), boat: line(NPC_BOAT_INSERT) };
  return sites;
}
const sourceUrl = new URL('../src/population.js', import.meta.url).href;
export function createNpcBoatAcquisitionCommitObserver({ readRandomTape, seed, additionalQueryOrigin = null, additionalProvenanceExtensions = {}, ...options }) {
  assertNpcBoatSources(); assert.equal(typeof readRandomTape, 'function'); assert.equal(typeof seed, 'string'); assert(seed.length);
  assert(additionalQueryOrigin === null || typeof additionalQueryOrigin === 'function');
  assert(!Object.hasOwn(additionalProvenanceExtensions, 'npcBoatAcquisition'), 'Cannot replace NPC boat source annotation');
  return createNpcCarAcquisitionCommitObserver({ ...options,
    additionalProvenanceExtensions: { ...additionalProvenanceExtensions, npcBoatAcquisition: { format: 1, sourcePins: NPC_BOAT_SOURCE_PINS, seed } },
    additionalQueryOrigin(sql) {
      if (sql !== NPC_BOAT_INSERT) return additionalQueryOrigin?.(sql) ?? null;
      const prior = Error.stackTraceLimit; let stack;
      try { Error.stackTraceLimit = 40; stack = new Error('RC1_BOAT_QUERY_ORIGIN').stack; }
      finally { Error.stackTraceLimit = prior; }
      const frames = [];
      for (const text of stack.split('\n')) {
        const at = text.indexOf(sourceUrl + ':'); if (at < 0) continue;
        const numbers = text.slice(at + sourceUrl.length + 1).match(/^(\d+):(\d+)/); assert(numbers);
        frames.push({ file: 'src/population.js', caller: text.slice(0, at).trim().replace(/^at\s+(?:async\s+)?/, '').replace(/\s*\($/, ''),
          line: Number(numbers[1]), column: Number(numbers[2]) });
      }
      if (!frames.length) return additionalQueryOrigin?.(sql) ?? null;
      const tape = readRandomTape(); assert(Array.isArray(tape)); const draws = [];
      for (let i = tape.length - 1; i >= 0 && draws.length < 2; i--) if (tape[i].stream === 'Math.random') draws.unshift({ index: i, ...structuredClone(tape[i]) });
      return { kind: 'native-stack-source-site-v1', frames, boatRandomInputs: { tapeLength: tape.length, draws,
        boatIdDraw: { index: tape.length - 1, ...structuredClone(tape.at(-1)) } } };
    },
  });
}
const table = (state, name) => { assert(Array.isArray(state.tables[name]), 'Missing boat evidence table: ' + name); return state.tables[name]; };
function fresh(before, after, name, field, id) {
  assert(!table(before, name).some(row => row[field] === id), 'Stale boat grant identity: ' + name);
  const found = table(after, name).filter(row => row[field] === id); assert.equal(found.length, 1, 'Missing or duplicate boat identity: ' + name); return found[0];
}
export function verifyNpcBoatAcquisition(before, after, provenance, identity) {
  if (!provenance?.extensions?.npcBoatAcquisition) return null;
  assertNpcBoatSources(); const extension = provenance.extensions.npcBoatAcquisition;
  assert.equal(extension.format, 1); assert.deepEqual(extension.sourcePins, NPC_BOAT_SOURCE_PINS); assert.equal(typeof extension.seed, 'string'); assert(extension.seed.length);
  assert.deepEqual(provenance.boundary, identity, 'Boat witness belongs to another native boundary');
  assert.equal(identity.outcome, 'COMMITTED'); assert(Number.isSafeInteger(identity.transactionId) && identity.transactionId > 0);
  assert.equal(provenance.format, 1); if (provenance.unsupported) return null;
  const q = provenance.queries; assert(Array.isArray(q) && q.length >= 2 && q.length <= 1024);
  assert.equal(q[0].command, 'BEGIN'); assert.equal(q.at(-1).command, 'COMMIT');
  if (q.slice(1, -1).some(entry => !['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(entry.command))) return null;
  const writes = q.filter(entry => /^(?:INSERT INTO|UPDATE|DELETE FROM) boats\b/.test(entry.sql.trim()));
  if (writes.length !== 1 || writes[0].sql !== NPC_BOAT_INSERT) return null;
  const boatWrite = writes[0], fromDefault = entry => entry.origin?.frames.some(f => f.file === 'src/population.js' && f.caller === 'runPopulationInner' && f.line === sites.defaultCall)
    && entry.origin.frames.some(f => f.file === 'src/population.js' && f.caller === 'runPopulation' && f.line === sites.wrapperCall);
  if (!fromDefault(boatWrite)) return null;
  const one = sql => { const matches = q.filter(entry => entry.sql === sql); assert.equal(matches.length, 1, 'Missing or duplicate boat birth statement'); return matches[0]; };
  const account = one(NPC_CAR_SQL.account), persistent = one(NPC_CAR_SQL.persistent), character = one(NPC_CAR_SQL.character);
  const operations = [account, persistent, character, boatWrite];
  for (const entry of operations) {
    assert.equal(entry.command, 'INSERT'); assert.equal(entry.rowCount, 1); assert.deepEqual(entry.rows, []);
    assert.equal(entry.origin?.kind, 'native-stack-source-site-v1'); assert(fromDefault(entry), 'Birth write lacks original worker caller');
    assert(entry.origin.frames.some(f => f.file === 'src/population.js' && f.caller === 'spawnResident' && f.line >= sites.begin && f.line <= sites.end));
    assert.equal(entry.logicalAt, identity.context.logicalAt);
  }
  assert(boatWrite.origin.frames.some(f => f.caller === 'spawnResident' && f.line === sites.boat));
  assert(operations.every((entry, i) => !i || q.indexOf(entry) > q.indexOf(operations[i - 1])));
  assert.equal(boatWrite.parameters.length, 4); const [boatId, owner, kind, rarity] = boatWrite.parameters;
  assert.equal(kind, 'dinghy'); assert.equal(character.parameters.length, 10);
  const [characterId, accountId, name, season, respect, cash, muscle, cunning, speed, loc] = character.parameters;
  assert.equal(characterId, owner); assert.deepEqual(account.parameters, [accountId, 'npc', 'npc:' + accountId]); assert.deepEqual(persistent.parameters, [accountId]);
  const level = levelOf(Number(respect)), band = POPULATION.BANDS.find(b => level >= b.lvl[0] && level <= b.lvl[1]);
  assert(band && POPULATION.MARKS.BOAT_P[band.id] > 0, 'NPC outside authored boat grant bands');
  const random = boatWrite.origin.boatRandomInputs; assert(random && Array.isArray(random.draws)); assert.equal(random.draws.length, 2);
  const [decision, rarityDraw] = random.draws;
  assert.equal(rarityDraw.counter, decision.counter + 1);
  assert.equal(decision.index, random.tapeLength - 3); assert.equal(rarityDraw.index, random.tapeLength - 2);
  const value = draw => {
    assert.equal(draw.stream, 'Math.random'); assert(Number.isSafeInteger(draw.counter) && draw.counter > 0);
    assert(Number.isSafeInteger(draw.index) && draw.index >= 0); assert(/^[a-f0-9]{12}$/.test(draw.hex));
    const hex = crypto.createHash('sha256').update(JSON.stringify(['omerta:rc1:serial:v1', extension.seed, 'Math.random', draw.counter, 0])).digest('hex').slice(0, 12);
    assert.equal(draw.hex, hex, 'Boat random input is not the retained seed/counter value'); return Number.parseInt(hex, 16) / 281474976710656;
  };
  const eligibilityRoll = value(decision), rarityRoll = value(rarityDraw);
  assert(eligibilityRoll < POPULATION.MARKS.BOAT_P[band.id], 'Boat grant did not satisfy original probability'); assert.equal(rollRarity(rarityRoll), rarity);
  const idDraw = random.boatIdDraw;
  assert.equal(idDraw.stream, 'crypto.randomUUID'); assert.equal(idDraw.index, random.tapeLength - 1);
  assert(Number.isSafeInteger(idDraw.counter) && idDraw.counter > 0);
  const idBytes = crypto.createHash('sha256').update(JSON.stringify(['omerta:rc1:serial:v1', extension.seed, idDraw.stream, idDraw.counter, 0])).digest().subarray(0, 16);
  assert.equal(idDraw.hex, idBytes.toString('hex')); idBytes[6] = (idBytes[6] & 15) | 64; idBytes[8] = (idBytes[8] & 63) | 128;
  const idHex = idBytes.toString('hex'); assert.equal(boatId, `${idHex.slice(0, 8)}-${idHex.slice(8, 12)}-${idHex.slice(12, 16)}-${idHex.slice(16, 20)}-${idHex.slice(20)}`);
  const ch = fresh(before, after, 'characters', 'id', owner), acct = fresh(before, after, 'account_persistent', 'account_id', accountId);
  assert.equal(ch.is_npc, true); assert.equal(ch.alive, true); assert.equal(acct.npc_flag, true);
  for (const [key, value] of Object.entries({ account_id: accountId, name, season, respect, cash, muscle, cunning, speed, loc })) assert.equal(String(ch[key]), String(value));
  const boat = fresh(before, after, 'boats', 'id', boatId);
  assert.deepEqual(boat, { id: boatId, character_id: owner, kind, rarity, run_until: null, run_route: null, run_hold: 0, run_cost: '0',
    run_escort: false, hull: 0, engine: 0, rendezvous: false, minted_onchain: false, created_at: new Date(boatWrite.logicalAt).toISOString() });
  assert.deepEqual(table(before, 'boats').map(canonicalJson).sort(), table(after, 'boats').filter(row => row.id !== boatId).map(canonicalJson).sort(), 'Unexplained compound boat change');
  return { kind: 'exact-npc-spawn-boat-source', boatId, owner, accountId, boatKind: kind, rarity, band: band.id,
    eligibilityRoll, rarityRoll, authority: 'Source-pinned original executed birth/boat INSERTs and recorded random inputs; no authored boat grant receipt',
    provenanceSha256: sha256(canonicalJson(provenance)), boundary: identity };
}
export function reconcileNpcBoats(before, after, { identity = null, npcBoatProvenance = null } = {}) {
  const changed = canonicalJson(table(before, 'boats')) !== canonicalJson(table(after, 'boats'));
  if (!changed) return { checks: [], movements: [], unsupported: [] };
  const movement = verifyNpcBoatAcquisition(before, after, npcBoatProvenance, identity);
  if (!movement) return { checks: [], movements: [], unsupported: [{ kind: 'boat-identity-provenance', table: 'boats',
    detail: 'Boat acquisition/disposition observed without an exact original worker birth witness; sale, estate, retirement, NFT and compound changes remain unsupported' }] };
  const count = state => table(state, 'boats').filter(row => row.character_id === movement.owner).length;
  assert.equal(count(after) - count(before), 1);
  return { checks: [{ resource: 'boats', owner: movement.owner, kind: 'exact-npc-grant-custody', before: String(count(before)), after: String(count(after)),
    expectedDelta: '1', drift: '0', authority: [{ kind: 'native-executed-query-witness', sha256: movement.provenanceSha256 }] }], movements: [movement], unsupported: [] };
}
