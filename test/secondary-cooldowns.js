// Shared asset rest closes instant PvP record/standing/mastery farming and PvE/PvP rotation.
process.env.MOD_KEY = 'test-mod-key';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from './server-fixture.js';
import { BOXING, STABLE, RACES, PACING } from '../src/rules.js';
import { sweepMainEvents } from '../src/boxing.js';

const app = await buildServer();
const pool = app.pool;
const call = async (method, url, token, payload) => {
  const res = await app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload });
  return { status: res.statusCode, body: res.json() };
};
const player = async (name) => {
  const auth = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
  const { token } = auth.json();
  await call('POST', '/v1/character', token, { name });
  const { character } = (await call('GET', '/v1/me', token)).body;
  await pool.query('UPDATE characters SET cash=$2,respect=$3 WHERE id=$1',
    [character.id, 10000000, PACING.LEVEL_DIVISOR * 11 * 11]);
  return { token, id: character.id };
};
const players = await Promise.all([player('Rest Alpha'), player('Rest Bravo'), player('Rest Charlie')]);
const actualNow = Date.now;
const now = actualNow();
Date.now = () => now;

try {
  for (const mode of ['boxing', 'stable']) {
    const boxing = mode === 'boxing';
    const table = boxing ? 'fighters' : 'racers';
    const clock = boxing ? 'exhib_at' : 'circuit_at';
    const restMs = boxing ? BOXING.BOUT_CD_MS : STABLE.MATCH_CD_MS;
    const pveRestMs = boxing ? BOXING.EXHIBITION_CD_MS : STABLE.CIRCUIT_CD_MS;
    const ids = players.map(() => crypto.randomUUID());
    for (let i = 0; i < players.length; i++) {
      if (boxing) await pool.query(
        'INSERT INTO fighters (id,character_id,name,power,chin,speed,bout_limit) VALUES ($1,$2,$3,$4,$4,$4,50000)',
        [ids[i], players[i].id, `Fighter ${i}`, i === 0 ? 25 : 6]);
      else await pool.query(
        'INSERT INTO racers (id,character_id,kind,name,speed,stamina,heart,race_limit) VALUES ($1,$2,$3,$4,$5,$5,$5,50000)',
        [ids[i], players[i].id, 'dog', `Racer ${i}`, i === 0 ? 25 : 6]);
    }
    const match = (actor, target, stake = 5000) => call('POST', `/v1/${mode}/${boxing ? 'fight' : 'match'}/${players[target].id}`,
      players[actor].token, boxing
        ? { myFighter: ids[actor], theirFighter: ids[target], stake }
        : { myRacer: ids[actor], theirRacer: ids[target], stake });
    const pve = () => call('POST', boxing ? '/v1/boxing/exhibition' : `/v1/stable/circuit/${ids[0]}`,
      players[0].token, boxing ? { fighter: ids[0], tier: 'clubfighter' } : { meet: 'maiden' });
    const snapshot = async () => {
      const results = await Promise.all([
        pool.query(`SELECT * FROM ${table} ORDER BY id`),
        pool.query('SELECT id,cash FROM characters ORDER BY id'),
        pool.query('SELECT * FROM account_persistent ORDER BY account_id'),
        pool.query('SELECT * FROM npc_standing ORDER BY character_id,npc_id'),
        pool.query('SELECT * FROM masteries ORDER BY character_id,track_id'),
        pool.query('SELECT COUNT(*) n FROM transactions'),
        pool.query('SELECT * FROM boxing_bouts ORDER BY id'),
        pool.query('SELECT * FROM boxing_title ORDER BY id'),
      ]);
      return results.map((result) => result.rows);
    };
    const refusesWithoutReward = async (act) => {
      const before = await snapshot();
      const response = await act();
      assert.equal(response.body.error, 'cooldown', `${mode}: active rest refuses`);
      assert(response.body.cooldownSeconds > 0, `${mode}: rejection reports remaining rest`);
      assert.deepEqual(await snapshot(), before, `${mode}: refusal changes no cash, rewards or clocks`);
    };

    // One millisecond is still resting; a refusal must preserve the longer PvE timestamp.
    await pool.query(`UPDATE ${table} SET ${clock}=$2 WHERE id=$1`, [ids[0], new Date(now + 1)]);
    await refusesWithoutReward(() => match(0, 1));
    await pool.query(`UPDATE ${table} SET ${clock}=$2 WHERE id=$1`, [ids[0], new Date(now + pveRestMs)]);
    await refusesWithoutReward(() => match(0, 1));
    await pool.query(`UPDATE ${table} SET ${clock}=NULL WHERE id=$1`, [ids[0]]);
    await pool.query(`UPDATE ${table} SET ${clock}=$2 WHERE id=$1`, [ids[1], new Date(now + pveRestMs)]);
    await refusesWithoutReward(() => match(0, 1));

    // At the exact boundary both sides can compete, and both winner and loser receive rest.
    await pool.query(`UPDATE ${table} SET ${clock}=$1`, [new Date(now)]);
    const won = await match(0, 1);
    assert.equal(won.status, 200, `${mode}: exact expiry is accepted`);
    assert.equal(won.body.win, true, `${mode}: deterministic stronger participant wins`);
    assert.equal(boxing ? won.body.restSeconds : won.body.circuitCdSeconds, restMs / 1000);
    for (const id of ids.slice(0, 2)) {
      const row = (await pool.query(`SELECT ${clock} FROM ${table} WHERE id=$1`, [id])).rows[0];
      assert.equal(new Date(row[clock]).getTime(), now + restMs, `${mode}: both participants rest`);
    }
    await refusesWithoutReward(() => match(0, 2)); // winning actor rotates opponents
    await refusesWithoutReward(() => match(2, 0)); // different actor feeds a listed winner
    await refusesWithoutReward(pve); // PvP cannot rotate straight back into a faucet
    await pool.query(`UPDATE ${table} SET injured_until=NULL WHERE id=$1`, [ids[1]]);
    await refusesWithoutReward(() => match(1, 2)); // healing the loser does not remove rest

    // Failed funding does not consume rest; a loss then stamps the initiating actor as well.
    await pool.query(`UPDATE ${table} SET ${clock}=NULL,injured_until=NULL`);
    await pool.query('UPDATE characters SET cash=0 WHERE id=$1', [players[2].id]);
    const unfunded = await match(2, 0);
    assert.equal(unfunded.body.error, 'cash', `${mode}: insufficient funds rejects before stamping`);
    assert.equal((await pool.query(`SELECT ${clock} FROM ${table} WHERE id=$1`, [ids[2]])).rows[0][clock], null);
    await pool.query('UPDATE characters SET cash=1000000 WHERE id=$1', [players[2].id]);
    const lost = await match(2, 0);
    assert.equal(lost.body.win, false, `${mode}: deterministic weaker actor loses`);
    assert.equal(new Date((await pool.query(`SELECT ${clock} FROM ${table} WHERE id=$1`, [ids[2]])).rows[0][clock]).getTime(), now + restMs);
    const board = (await call('GET', `/v1/${mode}`, players[0].token)).body;
    const view = board.stable.find((asset) => asset.id === ids[0]);
    assert.equal(boxing ? view.exhibitionCdSeconds : view.cooldownSeconds, restMs / 1000,
      `${mode}: existing board view exposes shared rest`);

    if (boxing) {
      // Booking and accepting a title card cannot route around an exhibition rest.
      await pool.query('UPDATE fighters SET exhib_at=NULL,injured_until=NULL');
      await pool.query('UPDATE fighters SET exhib_at=$2 WHERE id=$1', [ids[0], new Date(now + pveRestMs)]);
      const announce = () => call('POST', `/v1/boxing/announce/${players[1].id}`, players[0].token,
        { myFighter: ids[0], theirFighter: ids[1] });
      await refusesWithoutReward(announce);
      await pool.query('UPDATE boxing_title SET callout_fighter=$1,callout_char=$2,callout_deadline=$3 WHERE id=1',
        [ids[1], players[1].id, new Date(now + 86400000)]);
      await refusesWithoutReward(() => call('POST', '/v1/boxing/callout/accept', players[0].token));
      await pool.query('UPDATE boxing_title SET callout_fighter=NULL,callout_char=NULL,callout_deadline=NULL WHERE id=1');
      await pool.query('UPDATE fighters SET exhib_at=NULL');
      const announced = await announce();
      assert.equal(announced.status, 200, 'boxing: rested fighters can book a card');
      // A pre-existing card might have been booked before the new rest guard: settling it cannot
      // shorten a longer exhibition rest, and a second worker pass cannot award another record.
      await pool.query('UPDATE fighters SET exhib_at=$2 WHERE id=$1', [ids[0], new Date(now + pveRestMs)]);
      await pool.query("UPDATE boxing_bouts SET resolves_at=now() - interval '1 minute' WHERE id=$1", [announced.body.bout]);
      await sweepMainEvents(pool);
      assert.equal(new Date((await pool.query('SELECT exhib_at FROM fighters WHERE id=$1', [ids[0]])).rows[0].exhib_at).getTime(), now + pveRestMs);
      assert.equal(new Date((await pool.query('SELECT exhib_at FROM fighters WHERE id=$1', [ids[1]])).rows[0].exhib_at).getTime(), now + restMs);
      const settled = await snapshot();
      await sweepMainEvents(pool);
      assert.deepEqual(await snapshot(), settled, 'boxing: worker retry awards no duplicate record');
    }
  }
  // Street races already stamp the passive winner; the missing target gate made that stamp inert.
  const cars = players.map(() => crypto.randomUUID());
  for (let i = 0; i < players.length; i++) {
    await pool.query('INSERT INTO cars (id,character_id,model_id,trim_id,dmg,race_limit,pink_slip,nos) VALUES ($1,$2,$3,$4,0,50000,true,1)',
      [cars[i], players[i].id, i === 0 ? 'pigeon' : 'junker', 'stock']);
    await pool.query('UPDATE characters SET race_at=NULL,speed=$2 WHERE id=$1', [players[i].id, i === 0 ? 500 : 5]);
  }
  const raceSnapshot = async () => {
    const results = await Promise.all([
      pool.query('SELECT id,cash,race_at FROM characters ORDER BY id'),
      pool.query('SELECT * FROM cars ORDER BY id'),
      pool.query('SELECT * FROM account_persistent ORDER BY account_id'),
      pool.query('SELECT * FROM masteries ORDER BY character_id,track_id'),
      pool.query('SELECT COUNT(*) n FROM transactions'),
    ]);
    return results.map((result) => result.rows);
  };
  const streetRace = (actor, target, pinks = false, myCar = cars[actor]) => call('POST',
    `/v1/races/${pinks ? 'pinks' : 'challenge'}/${players[target].id}`, players[actor].token,
    { myCar, theirCar: cars[target], wager: 5000, nos: true });
  const rejectsRace = async (act) => {
    const before = await raceSnapshot();
    const rejected = await act();
    assert.equal(rejected.body.error, 'cooldown', 'street races: the resting passive driver refuses');
    assert(rejected.body.cooldownSeconds > 0, 'street races: rejection exposes the remaining rest');
    assert.deepEqual(await raceSnapshot(), before, 'street races: refusal awards nothing and consumes no nitrous/car/cash');
  };
  const racing = await streetRace(1, 0); // a weak actor loses to the listed winner
  assert.equal(racing.body.win, false, 'street races: passive winner is deterministic');
  await rejectsRace(() => streetRace(2, 0));
  await rejectsRace(() => streetRace(2, 0, true));
  // Listing toggles and another car leave the driver's persistent clock intact.
  await call('POST', `/v1/races/unlist/${cars[0]}`, players[0].token);
  await call('POST', `/v1/races/list/${cars[0]}`, players[0].token, { limit: 50000 });
  await call('POST', `/v1/races/pinkslip/${cars[0]}`, players[0].token, { on: false });
  await call('POST', `/v1/races/pinkslip/${cars[0]}`, players[0].token, { on: true });
  const replacementCar = crypto.randomUUID();
  await pool.query('INSERT INTO cars (id,character_id,model_id,trim_id,dmg) VALUES ($1,$2,$3,$4,0)',
    [replacementCar, players[0].id, 'pigeon', 'stock']);
  await rejectsRace(() => streetRace(2, 0));
  await rejectsRace(() => streetRace(0, 2, false, replacementCar));
  // Expired targets can race for pinks and receive the same two-hour driver rest on a passive win.
  await pool.query('UPDATE characters SET race_at=$2 WHERE id=$1', [players[0].id, new Date(now)]);
  const pinks = await streetRace(2, 0, true);
  assert.equal(pinks.status, 200);
  assert.equal(pinks.body.win, false);
  assert.equal((await pool.query('SELECT character_id FROM cars WHERE id=$1', [cars[2]])).rows[0].character_id,
    players[0].id, 'street races: the accepted pinks race transfers the losing car');
  const passiveClock = new Date((await pool.query('SELECT race_at FROM characters WHERE id=$1', [players[0].id])).rows[0].race_at).getTime();
  assert(passiveClock >= now + RACES.CD_MS, 'street races: passive pinks winner is throttled');
  console.log('Secondary cooldowns: both-side rest, boundaries, rotation, unchanged refusals, wins/losses, street wager/pinks PASS');
} finally {
  Date.now = actualNow;
  await app.close();
}
