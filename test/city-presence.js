import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { commandDatabase, postgres } from './lib/player-command-support.js';
import { cityPresence, cityIntel, recordCityEncounter, CITY_JOURNAL_LIMIT } from '../src/city-presence.js';
import { withTwoCharacters } from '../src/game.js';
import { runEstate } from '../src/social/estate.js';
import { retireResident } from '../src/population.js';
import { readPlayerIntel, recordPlayerIntel } from '../src/playerintel.js';
import { DISTRICTS, M3 } from '../src/rules.js';
import { CITY_RUMOR_TOPICS } from '../src/content/city-rumors.js';
import { DISTRICT_STORY_ARCS } from '../src/content/district-story-arcs.js';

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
  mysteries: Number((await pool.query('SELECT COUNT(*) n FROM mystery_instances')).rows[0].n),
  mysteryNodes: Number((await pool.query('SELECT COUNT(*) n FROM mystery_node_state')).rows[0].n),
  mysteryChoices: Number((await pool.query('SELECT COUNT(*) n FROM mystery_choices')).rows[0].n),
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
  assert.deepEqual(Object.keys(CITY_RUMOR_TOPICS).sort(), DISTRICTS.map(d => d.id).sort());
  const allRumors = Object.values(CITY_RUMOR_TOPICS).flat();
  assert.equal(allRumors.length, 18); assert.equal(new Set(allRumors.map(r => r.id)).size, 18);
  for (const district of DISTRICTS) {
    const story = DISTRICT_STORY_ARCS.find(s => s.presentation.districtId === district.id);
    assert.equal(CITY_RUMOR_TOPICS[district.id].length, 3);
    for (const rumor of CITY_RUMOR_TOPICS[district.id]) {
      assert.equal(rumor.lead.districtId, district.id, 'A saved rumor retains its original district.');
      assert.equal(rumor.lead.venueId, story.presentation.startVenueId, 'A rumor points to the real case opening.');
      assert.equal(rumor.lead.label, 'Ask the Fixer about ' + story.presentation.title);
      assert(rumor.teaser.length > 30 && rumor.description.length > rumor.teaser.length);
      for (const node of story.package.nodes.filter(n => n.visibility !== 'public')) {
        assert(!JSON.stringify(rumor).includes(node.id), 'A rumor exposes no private quest node.');
        assert(!JSON.stringify(rumor).includes(node.metadata.description), 'A rumor does not copy a later account or reward.');
      }
    }
  }
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
  for (const privateActor of [machine, human]) {
    const card = cards.find(c => c.id === privateActor.id);
    for (const field of ['name', 'level', 'gangTag', 'online', 'lastSeenDistrict', 'observedAt', 'source', 'sourceName']) assert.equal(card[field], null, 'An unintroduced person supplies no live private facts: ' + field);
    assert.equal(await readPlayerIntel(pool, me.account, privateActor.id), null, 'Reading the roster is not an introduction.');
  }
  assert.equal(cards.find(c => c.id === npc.id).name, npc.name);
  assert.equal(cards.find(c => c.id === npc.id).level, 1);
  assert.equal(cards.find(c => c.id === npc.id).kind, 'npc');
  for (const row of cards) {
    assert.deepEqual(Object.keys(row).sort(), ['actions','district','gangTag','generation','id','kind','lastSeenDistrict','level','name','observedAt','online','source','sourceName']);
    for (const secret of [me.account, npc.account, machine.account, human.account, 'cash', 'bank', 'omr', 'health', 'account_id']) assert(!JSON.stringify(row).includes(secret));
    assert.deepEqual(row.actions[0].body, request(me, { generation: row.generation }));
    const action = row.actions[0], rumor = CITY_RUMOR_TOPICS.docks.find(r => r.id === action.topic.id);
    assert(rumor); assert.deepEqual(action.topic, { id: rumor.id, title: rumor.title, teaser: rumor.teaser });
    assert.equal(action.label, (row.kind === 'npc' ? 'Ask about ' : 'Compare rumors about ') + rumor.subject);
    assert.match(action.consequence, /unverified rumor/);
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
  const npcTopic = cards.find(c => c.id === npc.id).actions[0].topic;
  assert.equal(first.intel.tipId, npcTopic.id); assert.equal(first.intel.title, npcTopic.title);
  assert.equal(first.intel.category, 'rumor'); assert.equal(first.intel.attribution, 'resident');
  assert.equal(first.intel.description, CITY_RUMOR_TOPICS.docks.find(r => r.id === npcTopic.id).description);
  assert.equal(first.intel.lead.districtId, 'docks'); assert.equal(first.intel.lead.venueId, 'fixer'); assert.match(first.intel.sourceContext, /resident/);
  assert.deepEqual(await encounter(me, npc, firstKey), first);
  await assert.rejects(encounter(me, human, firstKey), e => e.code === 'idempotency_conflict');
  const repeated = await encounter(me, npc);
  assert.equal(repeated.progress.totalEncounters, 2); assert.equal(repeated.objectives[0].status, 'available');
  assert.equal(repeated.intel.tipId, first.intel.tipId); assert.equal(repeated.intel.description, first.intel.description);
  assert.deepEqual((await cityPresence(pool, me.account)).actors.find(c => c.id === npc.id).actions[0].topic, npcTopic,
    'Recording a rumor cannot switch the advertised subject.');
  const distinct = await encounter(me, human);
  assert.deepEqual(distinct.objectives.map(o => o.status), ['completed', 'available']);
  assert.equal(distinct.intel.tipId, cards.find(c => c.id === human.id).actions[0].topic.id);
  assert.equal(distinct.intel.attribution, 'street'); assert.match(distinct.intel.sourceContext, /own observation of this player/);
  const cross = await encounter(me, human);
  assert.deepEqual(cross.objectives.map(o => o.status), ['completed', 'completed', 'available']);
  const third = await encounter(me, machine);
  assert(third.objectives.every(o => o.status === 'completed'));
  assert.equal(third.intel.tipId, cards.find(c => c.id === machine.id).actions[0].topic.id);
  assert.equal(third.intel.attribution, 'street'); assert.match(third.intel.sourceContext, /own observation of this agent/);
  assert.deepEqual((await cityIntel(pool, human.account)).journal, [], 'Private journal does not follow another actor.');
  for (let i = 0; i < CITY_JOURNAL_LIMIT + 2; i++) await encounter(me, npc);
  const bounded = await cityIntel(pool, me.account);
  assert.equal(bounded.journal.length, 32); assert.equal(bounded.progress.totalEncounters, 39);
  assert.equal(bounded.journal[0].sequence, 39); assert.equal(bounded.journal.at(-1).sequence, 8);
  const rollbackBefore = await cityIntel(pool, me.account), failureKey = uuid();
  const knowledgeRows = async () => ({
    intel: (await pool.query('SELECT * FROM player_intel ORDER BY owner_account,target_character')).rows,
    contacts: (await pool.query('SELECT * FROM contacts ORDER BY owner_account,contact_account')).rows,
  });
  const knowledgeBefore = await knowledgeRows();
  const interruptedPool = wrappedPool(async sql => { if (/UPDATE item_mutation_guards/i.test(sql) && /result_json/i.test(sql)) throw new Error('injected city receipt interruption'); });
  // Fail after the private row writes, before the replay guard completes.
  await assert.rejects(recordCityEncounter(interruptedPool, me.account, npc.id, request(me, npc), failureKey));
  assert.deepEqual(await cityIntel(pool, me.account), rollbackBefore);
  assert.deepEqual(await knowledgeRows(), knowledgeBefore, 'Receipt failure restores exact notebook snapshots and phone contacts.');
  assert.equal((await encounter(me, npc, failureKey)).progress.totalEncounters, 40);
  assert.deepEqual(await neutral(), before, 'Rumors do not change resources, ledgers, contacts or quest progression.');
  const rumorReader = await actor('District rumor reader'), rumorSource = await actor('District rumor resident', 'npc');
  const beforeDistrictRumors = await neutral();
  for (const district of DISTRICTS) {
    await pool.query('UPDATE characters SET loc=$1 WHERE id IN ($2,$3)', [district.id, rumorReader.id, rumorSource.id]);
    const roster = await cityPresence(pool, rumorReader.account, [], { limit: 40 });
    const issued = roster.actors.find(row => row.id === rumorSource.id).actions[0];
    const result = await recordCityEncounter(pool, rumorReader.account, rumorSource.id, issued.body, uuid());
    const topic = CITY_RUMOR_TOPICS[district.id].find(r => r.id === issued.topic.id);
    assert(topic, 'Every district advertises its own case.');
    assert.equal(result.intel.tipId, issued.topic.id); assert.equal(result.intel.description, topic.description);
    assert.deepEqual(result.intel.lead, topic.lead);
  }
  assert.deepEqual(await neutral(), beforeDistrictRumors, 'Every district lead is a journal entry, not an automatic quest start.');
  // A real past observation is not refreshed by a current district projection. The
  // canonical row still issues the district/generation preconditions for an encounter.
  const observer = await actor('Private notebook owner'), stranger = await actor('Old human name'), bot = await actor('Old agent name', 'agent');
  const observationTime = new Date('2020-01-01T00:00:00.000Z');
  for (const target of [stranger, bot]) {
    await pool.query("UPDATE characters SET loc='canal',respect=10000 WHERE id=$1", [target.id]);
    const observed = (await pool.query('SELECT * FROM characters WHERE id=$1', [target.id])).rows[0];
    await recordPlayerIntel(pool, observer.account, observed, { observedAt: observationTime, source: 'gossip', sourceName: 'Old witness' });
    await pool.query("UPDATE characters SET loc='docks',respect=200000,name=$2 WHERE id=$1", [target.id, 'Current ' + target.kind]);
  }
  const beforeRead = await knowledgeRows(), observerBoard = await cityPresence(pool, observer.account, [stranger.account, bot.account], { limit: 40 });
  for (const target of [stranger, bot]) {
    const card = observerBoard.actors.find(row => row.id === target.id);
    assert.equal(card.name, target.name); assert.equal(card.level, 32);
    assert.equal(card.district, 'docks'); assert.equal(card.lastSeenDistrict, 'canal');
    assert.equal(card.observedAt, observationTime.toISOString()); assert.equal(card.source, 'gossip'); assert.equal(card.sourceName, 'Old witness');
    assert.equal(card.gangTag, null); assert.equal(card.online, null);
    assert.deepEqual(card.actions[0].body, request(observer, target));
    const privateCard = (await cityPresence(pool, human.account, [target.account], { limit: 40 })).actors.find(row => row.id === target.id);
    assert.equal(privateCard.name, null); assert.equal(privateCard.level, null); assert.equal(privateCard.observedAt, null);
  }
  assert.deepEqual(await knowledgeRows(), beforeRead, 'Reading dated facts never updates either owner\'s notebook or phone book.');
  const learnedKey = uuid(), learned = await encounter(observer, stranger, learnedKey);
  const learnedSnapshot = await readPlayerIntel(pool, observer.account, stranger.id);
  assert.equal(learned.encounteredActor.name, 'Current player');
  assert.equal(learned.encounteredActor.level, learnedSnapshot.level);
  assert.equal(learned.encounteredActor.observedAt, learned.intel.collectedAt);
  assert.equal(learned.encounteredActor.lastSeenDistrict, 'docks'); assert.equal(learned.encounteredActor.source, 'city_encounter');
  assert.deepEqual(learned.intel.source, learned.encounteredActor, 'The new journal source is projected from the earned notebook snapshot.');
  assert.equal(await readPlayerIntel(pool, stranger.account, observer.id), null, 'An encounter is not a reciprocal introduction.');
  const learnedJournal = await cityIntel(pool, observer.account);
  await pool.query('UPDATE characters SET name=$2,respect=400000 WHERE id=$1', [stranger.id, 'Newer live name']);
  const datedCard = (await cityPresence(pool, observer.account, [stranger.account], { limit: 40 })).actors.find(row => row.id === stranger.id);
  assert.equal(datedCard.name, learned.encounteredActor.name); assert.equal(datedCard.level, learned.encounteredActor.level);
  assert.equal(datedCard.actions[0].topic.id, learned.intel.tipId, 'Changing private facts cannot change a public rumor topic.');
  assert.deepEqual(await encounter(observer, stranger, learnedKey), learned, 'The original encounter receipt remains immutable after live facts change.');
  assert.deepEqual(await readPlayerIntel(pool, observer.account, stranger.id), learnedSnapshot, 'Old-key replay is not a new sighting.');
  assert.deepEqual(await cityIntel(pool, observer.account), learnedJournal);
  await new Promise(resolve => setTimeout(resolve, 2));
  const newer = await encounter(observer, stranger), newerSnapshot = await readPlayerIntel(pool, observer.account, stranger.id);
  assert.equal(newer.encounteredActor.name, 'Newer live name');
  assert.equal(newerSnapshot.name, 'Newer live name');
  assert.deepEqual(await encounter(observer, stranger, learnedKey), learned);
  assert.deepEqual(await readPlayerIntel(pool, observer.account, stranger.id), newerSnapshot, 'Historical replay cannot regress a newer earned snapshot.');
  const failedKnowledge = await knowledgeRows(), failedJournal = await cityIntel(pool, observer.account);
  const privateFailureKey = uuid();
  await assert.rejects(recordCityEncounter(interruptedPool, observer.account, bot.id, request(observer, bot), privateFailureKey));
  assert.deepEqual(await knowledgeRows(), failedKnowledge); assert.deepEqual(await cityIntel(pool, observer.account), failedJournal);
  const recovered = await encounter(observer, bot, privateFailureKey);
  assert.equal(recovered.encounteredActor.name, 'Current agent'); assert.equal(recovered.encounteredActor.source, 'city_encounter');
  assert.equal(recovered.progress.totalEncounters, failedJournal.progress.totalEncounters + 1, 'A rolled-back encounter retries once under its original key.');
  await pool.query("UPDATE characters SET loc='docks',jail_until=$2 WHERE id=$1", [away.id, new Date(Date.now() + 60000)]);
  await encounter(me, away);
  const nonphysical = await readPlayerIntel(pool, me.account, away.id);
  assert.equal(nonphysical.source, 'city_encounter'); assert.equal(nonphysical.loc, undefined); assert.equal(nonphysical.level, undefined);
  assert.equal(await readPlayerIntel(pool, away.account, me.id), null, 'Collecting intel never identifies the observer to the source.');
  await pool.query('UPDATE characters SET jail_until=NULL WHERE id=$1', [away.id]);
  await pool.query('UPDATE characters SET hosp_until=$2 WHERE id=$1', [me.id, new Date(Date.now() + 60000)]);
  await encounter(me, away);
  assert.equal((await readPlayerIntel(pool, me.account, away.id)).loc, undefined, 'A hospitalized observer gains no physical sighting.');
  await pool.query('UPDATE characters SET hosp_until=NULL WHERE id=$1', [me.id]);
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [away.id, away.loc]);
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
  console.log('city-presence PASS: 18 district rumors, stable preview/receipt, honest source attribution, public types/pagination, scoped32-card intel, encounter objectives, replay/isolation/rollback, neutral resources/quests' + (postgres ? ', real concurrent replay and opposite-target locks' : ' (pg-mem; native locking not claimed)'));
  console.log('city-presence lifecycle PASS: actual estate/retirement wipe all owner generations, retain other source cards/receipts and preserve existing economics' + (postgres ? ', native late rollback and retry' : ' (native lifecycle rollback not claimed)'));
} finally { await db.cleanup(pool); }
