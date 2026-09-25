import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NPC_BOAT_SOURCE_PINS, NPC_BOAT_INSERT, assertNpcBoatSources, verifyNpcBoatAcquisition, reconcileNpcBoats, createNpcBoatAcquisitionCommitObserver } from '../tools/rc1-npc-boat-journal.js';
import { NPC_CAR_SQL } from '../tools/rc1-npc-car-acquisition.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { PACING, rollRarity } from '../src/rules.js';
import { npcBoatCorruptions } from './lib/rc1-npc-boat-controls.js';
const sites = assertNpcBoatSources(), seed = 'boat-pure-fixture', runtime = installSerialRuntime(seed), at = Date.now();
let decision, rarityRoll, boatId, random;
try {
  do { decision = Math.random(); } while (decision >= 0.6);
  rarityRoll = Math.random(); boatId = crypto.randomUUID();
  random = { tapeLength: runtime.tape.length, draws: runtime.tape.slice(-3, -1).map((row, i) => ({ index: runtime.tape.length - 3 + i, ...row })),
    boatIdDraw: { index: runtime.tape.length - 1, ...runtime.tape.at(-1) } };
} finally { runtime.restore(); }
const character = { id: 'npc-fixture', account_id: 'npc-account', name: 'Pure fixture', season: 1, respect: PACING.LEVEL_DIVISOR * 49 ** 2,
  cash: 100000, muscle: 100, cunning: 100, speed: 100, loc: 'docks', is_npc: true, alive: true };
const boat = { id: boatId, character_id: character.id, kind: 'dinghy', rarity: rollRarity(rarityRoll), run_until: null, run_route: null,
  run_hold: 0, run_cost: '0', run_escort: false, hull: 0, engine: 0, rendezvous: false, minted_onchain: false, created_at: new Date(at).toISOString() };
const origin = line => ({ kind: 'native-stack-source-site-v1', frames: [
  { file: 'src/population.js', caller: 'spawnResident', line, column: 10 },
  { file: 'src/population.js', caller: 'runPopulationInner', line: sites.defaultCall, column: 10 },
  { file: 'src/population.js', caller: 'runPopulation', line: sites.wrapperCall, column: 10 } ] });
const statements = [['BEGIN', []], [NPC_CAR_SQL.account, ['npc-account', 'npc', 'npc:npc-account']], [NPC_CAR_SQL.persistent, ['npc-account']],
  [NPC_CAR_SQL.character, [character.id, character.account_id, character.name, 1, character.respect, character.cash, 100, 100, 100, 'docks']],
  [NPC_BOAT_INSERT, [boatId, character.id, 'dinghy', boat.rarity]], ['COMMIT', []]];
const event = { sequence: 10, transactionId: 1, outcome: 'COMMITTED', context: { authority: 'original-worker', logicalAt: at } };
const provenance = { format: 1, boundary: structuredClone(event), extensions: { npcBoatAcquisition: { format: 1, sourcePins: NPC_BOAT_SOURCE_PINS, seed } },
  queries: statements.map(([sql, parameters]) => ({ sql, parameters, command: sql.split(' ')[0], rowCount: sql.startsWith('INSERT') ? 1 : null, rows: [], logicalAt: at,
    origin: { ...origin(sql === NPC_BOAT_INSERT ? sites.boat : 100), ...(sql === NPC_BOAT_INSERT ? { boatRandomInputs: random } : {}) } })) };
const before = { tables: { boats: [], characters: [], account_persistent: [] } }, after = { tables: { boats: [boat], characters: [character], account_persistent: [{ account_id: 'npc-account', npc_flag: true }] } };
assert.equal(verifyNpcBoatAcquisition(before, after, provenance, event).boatId, boatId);
const exact = reconcileNpcBoats(before, after, { identity: event, npcBoatProvenance: provenance });
assert.equal(exact.checks[0].expectedDelta, '1'); assert.equal(exact.unsupported.length, 0);
assert.equal(reconcileNpcBoats(before, after).unsupported[0].kind, 'boat-identity-provenance');
const controls = npcBoatCorruptions({ before, after, provenance, event });
let witness;
const observer = createNpcBoatAcquisitionCommitObserver({ seed, readRandomTape: () => [], onBoundary: async (_event, value) => { witness = value; } });
const query = observer.wrapQuery({}, async sql => ({ command: sql.split(' ')[0], rowCount: 1, rows: [] }));
observer.arm(); await query('BEGIN'); await query(NPC_BOAT_INSERT, statements[4][1]); await query('ROLLBACK'); assert.equal(witness, null);
await query('BEGIN'); await query(NPC_BOAT_INSERT, statements[4][1]); await query('COMMIT');
assert(witness.extensions.npcCarAcquisition && witness.extensions.npcBoatAcquisition); assert.equal(witness.queries[1].origin, undefined);
assert.equal(verifyNpcBoatAcquisition(before, after, witness, witness.boundary), null); observer.assertComplete(); observer.disarm();
console.log(JSON.stringify({ status: 'PASS', controls: controls.length, collectorControls: ['one-shared-car-witness', 'rollback-no-grant', 'copied-SQL-no-original-caller'], scope: 'Synthetic controls only; original-worker native proof required' }));
