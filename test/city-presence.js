import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { commandDatabase, postgres } from './lib/player-command-support.js';
import { cityPresence, cityIntel, recordCityEncounter, CITY_JOURNAL_LIMIT } from '../src/city-presence.js';

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
  console.log('city-presence PASS: public types/pagination, scoped32-card intel, encounter objectives, replay/isolation/rollback, neutral resources' + (postgres ? ', real concurrent replay and opposite-target locks' : ' (pg-mem; native locking not claimed)'));
} finally { await db.cleanup(pool); }
