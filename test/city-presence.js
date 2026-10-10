import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { commandDatabase, postgres } from './lib/player-command-support.js';
import { cityPresence, cityIntel, recordCityEncounter, CITY_JOURNAL_LIMIT } from '../src/city-presence.js';
import { withTwoCharacters } from '../src/game.js';
import { runEstate } from '../src/social/estate.js';
import { retireResident } from '../src/population.js';
import { M3 } from '../src/rules.js';

const db = await commandDatabase('city_presence'), pool = db.pool;
const uuid = () => crypto.randomUUID();
async function actor(name, kind = 'player', loc = 'docks') {
  const account = 'private-city-' + uuid(), id = uuid();
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
  await pool.query('INSERT INTO account_persistent(account_id,agent_flag,omr) VALUES($1,$2,777)', [account, kind === 'agent']);
  await pool.query(`INSERT INTO characters(id,account_id,name,season,loc,is_npc,cash,bank,respect,health,energy,nerve,heat)
    VALUES($1,$2,$3,1,$4,$5,111,222,0,41,23,3,8)`, [id, account, name, loc, kind === 'npc']);
  return { id, account, name, kind, loc, generation: 1 };
}
const request = (a, b) => ({ characterId: a.id, generation: a.generation, district: a.loc, targetGeneration: b.generation });
const encounter = (a, b, key = uuid()) => recordCityEncounter(pool, a.account, b.id, request(a, b), key);
const neutral = async () => ({
  characters: (await pool.query('SELECT id,cash,bank,respect,health,energy,nerve,heat,muscle,cunning,speed,train_at FROM characters ORDER BY id')).rows,
  balances: (await pool.query('SELECT account_id,omr FROM account_persistent ORDER BY account_id')).rows,
  ledger: Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n),
  contacts: Number((await pool.query('SELECT COUNT(*) n FROM contacts')).rows[0].n),
  calls: Number((await pool.query('SELECT COUNT(*) n FROM contact_calls')).rows[0].n),
});
function wrappedPool(onQuery) {
  return { async connect() {
    const client = await pool.connect();
    return new Proxy(client, { get(target, property) {
      if (property === 'query') return async (sql, params) => {
        await onQuery(String(sql), params, target);
        return target.query(sql, params);
      };
      const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
    } });
  } };
}
async function concurrent(actions) {
  let arrivals = 0, release;
  const pids = [], barrier = new Promise(resolve => { release = resolve; }), trace = [];
  const concurrentPool = wrappedPool(async (sql, params, client) => {
    if (/^BEGIN$/i.test(sql.trim())) {
      pids.push(Number((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid));
      if (++arrivals === actions.length) release();
      await Promise.race([barrier, new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('City encounter BEGIN barrier timed out')), 5000);
        barrier.then(() => clearTimeout(timer));
      })]);
    }
    if (/FOR UPDATE/i.test(sql)) trace.push({ sql, params });
  });
  const results = await Promise.all(actions.map(a => recordCityEncounter(concurrentPool, a.from.account, a.to.id, request(a.from, a.to), a.key)));
  assert.equal(new Set(pids).size, actions.length, 'Concurrency uses distinct real PostgreSQL backends.');
  const characterLocks = trace.filter(t => /FROM characters/i.test(t.sql));
  assert.equal(characterLocks.length, new Set(actions.map(a => a.from.account + ':' + a.key)).size);
  assert(characterLocks.every(t => /ORDER BY id FOR UPDATE/i.test(t.sql)), 'No viewer-first character lock precedes the sorted actor locks.');
  assert(!trace.some(t => /account_persistent|transactions|businesses/i.test(t.sql)), 'Encounters lock no monetary/account rows.');
  return results;
}
try {
  const me = await actor('Viewer'), npc = await actor('Resident', 'npc'), machine = await actor('Machine', 'agent'), human = await actor('Human');
  const away = await actor('Elsewhere', 'player', 'midtown'), dead = await actor('Dead');
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [dead.id]);
  // NPC classification wins even for an internally flagged account.
  await pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [npc.account]);
  const before = await neutral();
  assert.deepEqual((await cityIntel(pool, me.account)).journal, []);
  assert.deepEqual((await cityIntel(pool, me.account)).objectives, [], 'Unknown objective identifiers are absent.');
  let page = await cityPresence(pool, me.account, [machine.account], { limit: '1' }), cards = [...page.actors];
  const firstCursor = page.nextCursor;
  while (page.hasMore) { page = await cityPresence(pool, me.account, [machine.account], { limit: '1', cursor: page.nextCursor }); cards.push(...page.actors); }
  assert.equal(cards.length, 3); assert.equal(new Set(cards.map(c => c.id)).size, 3);
  assert.deepEqual(new Set(cards.map(c => c.kind)), new Set(['npc', 'agent', 'player']));
  assert.equal(cards.find(c => c.id === machine.id).online, true);
  assert.equal(cards.find(c => c.id === npc.id).kind, 'npc');
  for (const row of cards) {
    assert.deepEqual(Object.keys(row).sort(), ['actions','district','gangTag','generation','id','kind','level','name','online']);
    for (const secret of [me.account, npc.account, machine.account, human.account, 'cash', 'bank', 'omr', 'health', 'account_id']) assert(!JSON.stringify(row).includes(secret));
    assert.deepEqual(row.actions[0].body, request(me, { generation: row.generation }));
  }
  await assert.rejects(cityPresence(pool, me.account, [], { limit: 41 }), e => e.code === 'bad_city_presence');
  await assert.rejects(cityPresence(pool, me.account, [], { district: 'midtown' }), e => e.code === 'bad_city_presence');
  await assert.rejects(encounter(me, me), e => e.code === 'city_actor_unavailable');
  await assert.rejects(encounter(me, away), e => e.code === 'city_actor_unavailable');
  await assert.rejects(encounter(me, dead), e => e.code === 'city_actor_unavailable');
  await assert.rejects(recordCityEncounter(pool, human.account, npc.id, request(me, npc), uuid()), e => e.code === 'city_identity_changed');
  await assert.rejects(recordCityEncounter(pool, me.account, npc.id, { ...request(me, npc), generation: 2 }, uuid()), e => e.code === 'city_identity_changed');
  await assert.rejects(recordCityEncounter(pool, me.account, npc.id, { ...request(me, npc), targetGeneration: 2 }, uuid()), e => e.code === 'city_actor_unavailable');
  const firstKey = uuid(), first = await encounter(me, npc, firstKey);
  assert.equal(first.journal.length, 1); assert.equal(first.objectives[0].status, 'available');
  assert.deepEqual(await encounter(me, npc, firstKey), first);
  await assert.rejects(encounter(me, human, firstKey), e => e.code === 'idempotency_conflict');
  const repeated = await encounter(me, npc);
  assert.equal(repeated.progress.totalEncounters, 2); assert.equal(repeated.objectives[0].status, 'available');
  const distinct = await encounter(me, human);
  assert.deepEqual(distinct.objectives.map(o => o.status), ['completed', 'available']);
  const cross = await encounter(me, human);
  assert.deepEqual(cross.objectives.map(o => o.status), ['completed', 'completed', 'available']);
  const third = await encounter(me, machine);
  assert(third.objectives.every(o => o.status === 'completed'));
  assert.deepEqual((await cityIntel(pool, human.account)).journal, [], 'Private journal does not follow another actor.');
  for (let i = 0; i < CITY_JOURNAL_LIMIT + 2; i++) await encounter(me, npc);
  const bounded = await cityIntel(pool, me.account);
  assert.equal(bounded.journal.length, 32); assert.equal(bounded.progress.totalEncounters, 39);
  assert.equal(bounded.journal[0].sequence, 39); assert.equal(bounded.journal.at(-1).sequence, 8);
  const rollbackBefore = await cityIntel(pool, me.account), failureKey = uuid();
  const interruptedPool = wrappedPool(async sql => { if (/UPDATE item_mutation_guards/i.test(sql) && /result_json/i.test(sql)) throw new Error('injected city receipt interruption'); });
  // Fail after the private row writes, before the replay guard completes.
  await assert.rejects(recordCityEncounter(interruptedPool, me.account, npc.id, request(me, npc), failureKey));
  assert.deepEqual(await cityIntel(pool, me.account), rollbackBefore);
  assert.equal((await encounter(me, npc, failureKey)).progress.totalEncounters, 40);
  assert.deepEqual(await neutral(), before, 'Encounters do not change resources, ledgers or contacts.');
  if (postgres) {
    const a = await actor('Native A'), b = await actor('Native B');
    const nativeBefore = await neutral();
    const exactKey = uuid(), pairBefore = await cityIntel(pool, a.account);
    const replay = await concurrent([{ from: a, to: b, key: exactKey }, { from: a, to: b, key: exactKey }]);
    assert.deepEqual(replay[0], replay[1]);
    assert.equal((await cityIntel(pool, a.account)).progress.totalEncounters, pairBefore.progress.totalEncounters + 1);
    await concurrent([{ from: a, to: b, key: uuid() }, { from: b, to: a, key: uuid() }]);
    assert.equal((await cityIntel(pool, b.account)).progress.totalEncounters, 1);
    assert.deepEqual(await neutral(), nativeBefore, 'Real concurrent encounters change no economic or resource rows.');
  }
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [me.id, 'midtown']);
  await assert.rejects(encounter(me, npc), e => e.code === 'city_identity_changed');
  await assert.rejects(cityPresence(pool, me.account, [], { cursor: firstCursor }), e => e.code === 'city_cursor_stale');
  await pool.query("UPDATE characters SET loc='docks',generation=2 WHERE id=$1", [me.id]);
  assert.equal((await cityIntel(pool, me.account)).journal.length, 0);
  await assert.rejects(encounter(me, npc), e => e.code === 'city_identity_changed');
  // A direct stale-generation command cannot use a receipt to drive the successor's journal.
  await assert.rejects(encounter(me, npc, firstKey), e => e.code === 'city_identity_changed');
  assert.equal((await cityIntel(pool, me.account)).journal.length, 0);
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [me.id]);
  await assert.rejects(cityIntel(pool, me.account), e => e.code === 'no_character');
  await assert.rejects(encounter(me, npc), e => e.code === 'no_character');
  const heir = { ...me, id: uuid(), generation: 3, loc: 'docks' };
  await pool.query("INSERT INTO characters(id,account_id,name,generation,season,loc) VALUES($1,$2,'Heir',3,1,'docks')", [heir.id, heir.account]);
  assert.equal((await cityIntel(pool, heir.account)).journal.length, 0);
  await assert.rejects(encounter(me, npc, firstKey), e => e.code === 'city_identity_changed');
  await assert.rejects(encounter(heir, npc, firstKey), e => e.code === 'idempotency_conflict');
  assert.equal((await encounter(heir, npc)).journal.length, 1, 'A successor begins its own progression.');
  const rows = async (sql, params = []) => JSON.parse(JSON.stringify((await pool.query(sql, params)).rows));
  const cityGuards = () => rows("SELECT * FROM item_mutation_guards WHERE idempotency_key LIKE 'city:intel:v1:%' ORDER BY idempotency_key");
  const lifecycleSnapshot = async () => ({
    characters: await rows('SELECT * FROM characters ORDER BY id'),
    accounts: await rows('SELECT * FROM account_persistent ORDER BY account_id'),
    ledger: await rows('SELECT * FROM transactions ORDER BY id'),
    progress: await rows('SELECT * FROM city_intel_progress ORDER BY character_id,generation'),
    guards: await cityGuards(),
  });
  for (const retirement of [false, true]) {
    const departing = await actor(retirement ? 'Retiring city resident' : 'Doomed city owner', retirement ? 'npc' : 'player');
    const witness = await actor(retirement ? 'Retirement witness' : 'Estate witness');
    // Disable pre-transaction accrual in these controlled lifecycle fixtures.
    await pool.query('UPDATE characters SET last_accrued_at=$1 WHERE id IN ($2,$3)', [new Date(Date.now() + 86400000), departing.id, witness.id]);
    await pool.query('UPDATE characters SET generation=2 WHERE id=$1', [departing.id]); departing.generation = 2;
    if (retirement) await pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [departing.account]);
    else await pool.query('UPDATE account_persistent SET prestige=2 WHERE account_id=$1', [departing.account]);
    const departedKey = uuid(), witnessKey = uuid();
    await encounter(departing, npc, departedKey);
    const sourceReceipt = await encounter(witness, departing, witnessKey);
    // A previous generation's bounded state must also be removed for this owner.
    await pool.query('INSERT INTO city_intel_progress(character_id,generation,sequence,journal,objectives) SELECT character_id,1,sequence,journal,objectives FROM city_intel_progress WHERE character_id=$1 AND generation=2', [departing.id]);
    const otherProgress = await rows('SELECT * FROM city_intel_progress WHERE character_id<>$1 ORDER BY character_id,generation', [departing.id]);
    const unrelatedResources = async () => ({
      characters: await rows('SELECT id,cash,bank,respect,health,energy,nerve,heat,muscle,cunning,speed,train_at FROM characters WHERE account_id<>$1 ORDER BY id', [departing.account]),
      balances: await rows('SELECT account_id,omr FROM account_persistent WHERE account_id<>$1 ORDER BY account_id', [departing.account]),
    });
    const guardsBefore = await cityGuards(), unrelatedBefore = await unrelatedResources();
    const ownRows = async client => Number((await client.query('SELECT COUNT(*) AS count FROM city_intel_progress WHERE character_id=$1', [departing.id])).rows[0].count);
    const execute = async (failLate = false) => {
      if (!retirement) return withTwoCharacters(pool, witness.account, departing.id, async (_actor, victim, client, h) => {
        const result = await runEstate(client, h, victim, 'City lifecycle proof');
        assert.equal(await ownRows(client), 0, 'The actual estate removes every owner generation.');
        assert.equal((await client.query('SELECT alive FROM characters WHERE id=$1', [result.heirId])).rows[0].alive, true);
        if (failLate) throw new Error('injected late City lifecycle interruption');
        return result;
      }, { meet: false });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await retireResident(client, departing.id); assert(result);
        assert.equal(await ownRows(client), 0, 'Actual NPC retirement removes every owner generation.');
        assert.equal((await client.query('SELECT alive FROM characters WHERE id=$1', [departing.id])).rows[0].alive, false);
        if (failLate) throw new Error('injected late City lifecycle interruption');
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    };
    if (postgres) {
      const beforeLifecycle = await lifecycleSnapshot();
      await assert.rejects(execute(true), /injected late City lifecycle interruption/);
      assert.deepEqual(await lifecycleSnapshot(), beforeLifecycle, 'Native late failure restores real owner rows, character/estate state, money and receipts.');
    }
    const result = await execute();
    assert.equal(await ownRows(pool), 0);
    assert.deepEqual(await rows('SELECT * FROM city_intel_progress WHERE character_id<>$1 ORDER BY character_id,generation', [departing.id]), otherProgress,
      'Other owners retain exact historical source cards and objectives.');
    assert.deepEqual(await cityGuards(), guardsBefore, 'Death/retirement preserves original encounter receipts.');
    assert.deepEqual(await unrelatedResources(), unrelatedBefore, 'Other accounts retain exact money, stats and resources through owner cleanup.');
    const reason = retirement ? 'npc:retire' : 'death:estate';
    assert.equal(Number((await pool.query('SELECT SUM(amount) AS amount FROM transactions WHERE character_id=$1 AND currency=$2 AND reason=$3', [departing.id, 'cash', reason])).rows[0].amount), -333,
      'The existing lifecycle burns the departing cash+bank exactly.');
    const afterLifecycle = await neutral();
    assert.deepEqual(await encounter(witness, departing, witnessKey), sourceReceipt);
    assert.deepEqual(await neutral(), afterLifecycle, 'Historical source replay grants no new intel or currency.');
    assert.deepEqual(await rows('SELECT * FROM city_intel_progress WHERE character_id<>$1 ORDER BY character_id,generation', [departing.id]), otherProgress);
    assert.equal(await ownRows(pool), 0);
    if (retirement) {
      assert.equal(Number((await pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [departing.account])).rows[0].omr), 777);
      await assert.rejects(cityIntel(pool, departing.account), e => e.code === 'no_character');
      const client = await pool.connect();
      try { await client.query('BEGIN'); assert.equal(await retireResident(client, departing.id), null); await client.query('COMMIT'); }
      finally { client.release(); }
      assert.deepEqual(await neutral(), afterLifecycle, 'Repeated retirement creates no second burn.');
    } else {
      const next = { ...departing, id: result.heirId, generation: 3 };
      const heirRow = (await pool.query('SELECT cash,generation FROM characters WHERE id=$1', [next.id])).rows[0];
      assert.equal(Number(heirRow.cash), 700); assert.equal(heirRow.generation, 3);
      assert.equal(Number((await pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [departing.account])).rows[0].omr), 777 - Math.floor(777 * M3.DEATH_DUTY_RATE));
      const fresh = await cityIntel(pool, next.account); assert.equal(fresh.progress.totalEncounters, 0); assert.deepEqual(fresh.objectives, []);
      await assert.rejects(encounter(departing, npc, departedKey), e => e.code === 'city_identity_changed');
      await assert.rejects(encounter(next, npc, departedKey), e => e.code === 'idempotency_conflict');
      assert.equal((await cityIntel(pool, next.account)).progress.totalEncounters, 0, 'An old receipt never grants a successor progress.');
      assert.equal((await encounter(next, npc)).progress.totalEncounters, 1);
      assert.deepEqual(await neutral(), afterLifecycle, 'Fresh heir intel adds no economic/stat/resource effect.');
    }
  }
  console.log('city-presence PASS: public types/pagination, scoped32-card intel, encounter objectives, replay/isolation/rollback, neutral resources' + (postgres ? ', real concurrent replay and opposite-target locks' : ' (pg-mem; native locking not claimed)'));
  console.log('city-presence lifecycle PASS: actual estate/retirement wipe all owner generations, retain other source cards/receipts and preserve existing economics' + (postgres ? ', native late rollback and retry' : ' (native lifecycle rollback not claimed)'));
} finally { await db.cleanup(pool); }
