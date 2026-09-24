import assert from 'node:assert/strict';
import { carMelt, CONSTANTS } from '../src/rules.js';
import { CAR_MELT_SOURCE_PINS, carMeltQueryShapes, verifyFamilyCarMelt } from '../tools/rc1-car-melt-provenance.js';
import { PLAYER_CAR_SQL, PLAYER_CAR_SOURCE_PINS, assertPlayerCarSources, verifyPlayerCarAcquisition } from '../tools/rc1-player-car-provenance.js';
const shapes = carMeltQueryShapes(), sites = assertPlayerCarSources(), at = Date.parse('2026-09-20T12:00:00Z');
const ch = { id: 'person', account_id: 'account', is_npc: false, alive: true, ammo: 10 };
const acct = { account_id: 'account', staked: '0', made_until: null, stake_lock_until: null, stake_lock_mult: 1 };
const car = { id: 'car', character_id: ch.id, model_id: 'junker', trim_id: 'stock', dmg: 20, rarity: 'common',
  run_id: null, serial: null, listed: false, pledged: false, minted_onchain: false, pink_slip: false,
  race_limit: null, plate: null, tune: 0, nos: 0, created_at: new Date(at).toISOString() };
const query = (sql, parameters, command, rowCount = 0, rows = []) => ({ sql, parameters, command, rowCount, rows: structuredClone(rows), logicalAt: at });
const locked = [query('BEGIN', [], 'BEGIN'),
  query('SELECT * FROM characters WHERE account_id = $1 AND alive FOR UPDATE', [ch.account_id], 'SELECT', 1, [ch]),
  query('SELECT * FROM account_persistent WHERE account_id = $1 FOR UPDATE', [ch.account_id], 'SELECT', 1, [acct]),
  query(shapes.bulk, [ch.id, ch.account_id, '2026-09-20'], 'SELECT', 0),
  query('SELECT * FROM cars WHERE character_id=$1 ORDER BY created_at', [ch.id], 'SELECT', 0)];
const persist = [query(shapes.character, [ch.id], 'UPDATE', 1), query('DELETE FROM stash WHERE character_id=$1', [ch.id], 'DELETE'),
  query('DELETE FROM makings WHERE character_id=$1', [ch.id], 'DELETE'), query(shapes.account, [ch.account_id], 'UPDATE', 1), query('COMMIT', [], 'COMMIT')];
const trace = queries => ({ format: 1, sourcePins: CAR_MELT_SOURCE_PINS, boundary: { transactionId: 1, outcome: 'COMMITTED' },
  unsupported: null, queries, extensions: { playerCar: { format: 1, sourcePins: PLAYER_CAR_SOURCE_PINS } } });
const frame = site => ({ kind: 'native-player-car-source-v1', frames: [{ file: 'src/economy.js', caller: 'boostCar', line: site, column: 1 }] });
const audit = (id, action, roll, outcome) => ({ id, character_id: ch.id, action, roll, outcome });
const rarity = audit('rarity', 'rarity:car', 0, 'common'), grant = audit('grant', 'gta', 0.1, 'success');
const gtaBefore = { tables: { characters: [ch], cars: [], rng_audit: [] } }, gtaAfter = structuredClone(gtaBefore);
gtaAfter.tables.cars.push(car); gtaAfter.tables.rng_audit.push(rarity, grant);
const gtaTrace = trace([...structuredClone(locked),
  { ...query(PLAYER_CAR_SQL.car, [car.id, ch.id, car.model_id, car.trim_id, car.dmg, car.rarity, null, null], 'INSERT', 1), origin: frame(sites.car) },
  ...[[rarity, sites.rarity], [grant, sites.grant]].map(([a, site]) => ({ ...query(PLAYER_CAR_SQL.audit, Object.values(a), 'INSERT', 1), origin: frame(site) })),
  ...structuredClone(persist)]);
const total = Math.floor(carMelt(car.model_id, car.trim_id, car.dmg)), tithe = Math.floor(total * CONSTANTS.MELT_TITHE), keep = total - tithe;
const family = { id: 'family', treasury: '200', ammo_bank: '0', weekly_progress: 0 }, member = { gang_id: family.id, character_id: ch.id, role: 'boss' };
const receipt = (id, character, currency, amount, reason, counterparty) => ({ id, character_id: character, account_id: null, currency, amount, reason, counterparty });
const receipts = [receipt('personal', ch.id, 'ammo', keep, 'melt', null), receipt('tithe-ammo', null, 'ammo', tithe, 'melt:tithe', family.id),
  receipt('tithe-cash', null, 'cash', tithe * CONSTANTS.TITHE_ROUND_VALUE, 'melt:tithe', family.id)];
const meltBefore = { tables: { characters: [ch], account_persistent: [acct], cars: [car], transactions: [], gang_members: [member], gangs: [family] } };
const meltAfter = structuredClone(meltBefore); meltAfter.tables.cars = []; meltAfter.tables.transactions = receipts;
meltAfter.tables.characters[0].ammo += keep; meltAfter.tables.gangs[0].ammo_bank = String(tithe); meltAfter.tables.gangs[0].treasury = String(200 + receipts[2].amount);
const ledgerSql = 'INSERT INTO transactions (id, character_id, account_id, currency, amount, reason, counterparty) VALUES ($1,$2,$3,$4,$5,$6,$7)';
const ledger = r => query(ledgerSql, Object.values(r), 'INSERT', 1);
const meltTrace = trace([...structuredClone(locked), query('DELETE FROM cars WHERE id=$1', [car.id], 'DELETE', 1), ledger(receipts[0]),
  query('UPDATE gangs SET ammo_bank = ammo_bank + $2, treasury = treasury + $3 WHERE id=$1', [family.id, tithe, receipts[2].amount], 'UPDATE', 1),
  ledger(receipts[1]), ledger(receipts[2]), ...structuredClone(persist)]);
meltTrace.queries[3].rows = [{ src: 'gm', k: family.id, k2: 'boss' }]; meltTrace.queries[3].rowCount = 1;
meltTrace.queries[4].rows = [car]; meltTrace.queries[4].rowCount = 1;
assert.equal(verifyPlayerCarAcquisition(gtaBefore, gtaAfter, gtaTrace).carId, car.id);
assert.equal(verifyFamilyCarMelt(meltBefore, meltAfter, meltTrace).titheCash, receipts[2].amount);
let controls = 0;
function rejects(kind, edit) {
  const input = structuredClone(kind === 'gta' ? { before: gtaBefore, after: gtaAfter, trace: gtaTrace } : { before: meltBefore, after: meltAfter, trace: meltTrace });
  edit(input); const verify = kind === 'gta' ? verifyPlayerCarAcquisition : verifyFamilyCarMelt;
  let rejected = false; try { rejected = verify(input.before, input.after, input.trace) === null; } catch (error) { if (error instanceof assert.AssertionError) rejected = true; else throw error; }
  assert(rejected, 'Corrupt or unsupported evidence acquired authority'); controls++;
}
for (const kind of ['gta', 'melt']) {
  rejects(kind, x => x.trace = null);
  rejects(kind, x => x.trace.sourcePins['src/game.js'] = 'wrong');
  rejects(kind, x => x.trace.unsupported = 'bounded-trace-overflow');
  rejects(kind, x => x.trace.boundary.outcome = 'ROLLED_BACK');
  rejects(kind, x => x.trace.boundary.transactionId = 0);
  rejects(kind, x => x.trace.queries.pop());
  rejects(kind, x => x.trace.queries[5].logicalAt++);
  rejects(kind, x => x.trace.queries[1].rows[0].is_npc = true);
  rejects(kind, x => x.trace.queries[5].rowCount = 0);
}
for (const edit of [
  x => x.trace.extensions.playerCar.sourcePins['src/economy.js'] = 'wrong',
  x => delete x.trace.extensions.playerCar,
  x => delete x.trace.queries[5].origin,
  x => x.trace.queries[5].origin.frames[0].line++,
  x => x.trace.queries[6].origin.frames[0].caller = 'fixture',
  x => x.trace.queries[5].parameters[0] = 'other',
  x => x.trace.queries[5].parameters[1] = 'other',
  x => x.trace.queries[5].parameters[4] = 61,
  x => x.trace.queries[5].parameters[6] = 'limited',
  x => x.trace.queries[6].parameters[3] = 1,
  x => x.after.tables.cars[0].dmg++,
  x => x.after.tables.cars[0].listed = true,
  x => x.after.tables.rng_audit[1].character_id = 'other',
  x => x.after.tables.cars.push({ ...car, id: 'compound' }),
]) rejects('gta', edit);
for (const edit of [
  x => x.trace.queries[3].rows = [],
  x => x.trace.queries[3].rows[0].k = 'other',
  x => x.trace.queries[3].rows.push({ src: 'sk', k: 'fence_network' }),
  x => x.trace.queries[2].rows[0].staked = 10,
  x => x.trace.queries[4].rows[0].run_id = 'limited',
  x => x.trace.queries[7].parameters[1]++,
  x => x.trace.queries[8].parameters[6] = 'other',
  x => x.trace.queries[9].parameters[4]++,
  x => x.after.tables.characters[0].ammo++,
  x => x.after.tables.gangs[0].ammo_bank++,
  x => x.after.tables.gangs[0].treasury++,
  x => x.after.tables.gangs[0].weekly_progress++,
  x => x.after.tables.transactions[2].counterparty = 'other',
  x => x.after.tables.gang_members[0].role = 'soldier',
  x => x.after.tables.cars.push(car),
  x => x.trace.queries.splice(-1, 0, query('UPDATE gangs SET weekly_progress=1', [], 'UPDATE', 1)),
]) rejects('melt', edit);
console.log(JSON.stringify({ status: 'PASS', positiveCases: 2, rejectOrUnsupportedControls: controls, nativeProof: false }));
