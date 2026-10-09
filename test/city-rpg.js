// Newcomer RPG introduction: real mystery transactions, irreversible choices, cosmetic rewards.
import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import { inventoryBoard, withItemTransaction } from '../src/items.js';
import { commitChoice, completeNode, createMysteryContext, exploreMystery, mysteryBoard, startMystery } from '../src/mysteries.js';
import { loadAndValidatePhase1WorldGraph } from '../src/content/phase1-validation.js';
import {
  NEIGHBORHOOD_INITIATION_PACKAGE,
  NEIGHBORHOOD_QUEST_GRAPH_ID,
  NEIGHBORHOOD_QUEST_PRESENTATION,
  NEIGHBORHOOD_QUEST_VENUES,
} from '../src/content/neighborhood-initiation.js';

const postgres = process.argv.includes('--postgres');
assert(postgres || !process.env.DATABASE_URL, 'city-rpg requires disposable pg-mem; use --postgres with an explicit isolated endpoint.');
const { registry, report } = loadAndValidatePhase1WorldGraph();
const graph = NEIGHBORHOOD_QUEST_GRAPH_ID;
const fixer = 'mystery:neighborhood-fixer', choice = 'choice:neighborhood-approach';
const ending = 'mystery:neighborhood-newsroom', keepsake = 'item:neighborhood_notebook';
const paths = [
  { id: 'listen', task: 'mystery:neighborhood-listen', interaction: 'inspect_neighborhood_watch',
    other: 'mystery:neighborhood-ask', evidence: 'evidence:neighborhood-timing' },
  { id: 'ask', task: 'mystery:neighborhood-ask', interaction: 'inspect_neighborhood_delivery',
    other: 'mystery:neighborhood-listen', evidence: 'evidence:neighborhood-route' },
];
assert.equal(report.packages, 4);
assert.equal(report.nodes, 30);
assert.equal(report.economyPolicy.omrAuthorityPaths, 0);
assert.equal(report.economyPolicy.cashRewardSourcePaths, 0);
assert(Object.isFrozen(NEIGHBORHOOD_INITIATION_PACKAGE.nodes));
assert(Object.isFrozen(NEIGHBORHOOD_INITIATION_PACKAGE.nodes[1].options[0].effects));
assert.equal(NEIGHBORHOOD_QUEST_PRESENTATION.ownerScope, 'character');
assert.equal(NEIGHBORHOOD_QUEST_PRESENTATION.deathPolicy, 'immutable_history_no_inheritance');
assert.deepEqual([...new Set(Object.values(NEIGHBORHOOD_QUEST_VENUES))], ['fixer', 'workshop', 'stories']);
for (const field of ['inert', 'tradeable', 'exportEligible']) {
  assert.equal(registry.nodes.get(keepsake).metadata[field], field === 'inert');
}
for (const node of NEIGHBORHOOD_INITIATION_PACKAGE.nodes) {
  assert(!node.repeatability, 'No ignored repeatability authority is authored.');
  for (const effect of node.effects || []) assert(['discover', 'evidence_grant', 'unique_item_award', 'status_award'].includes(effect.adapter));
}

let database;
if (postgres) {
  const endpointValue = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
  assert(endpointValue, '--postgres requires an explicit isolated COORDINATION_TEST_DATABASE_URL or WORLD_KERNEL_TEST_DATABASE_URL.');
  const endpoint = new URL(endpointValue);
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
    && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only disposable loopback PostgreSQL is allowed.');
  const { commandDatabase } = await import('./lib/player-command-support.js');
  database = await commandDatabase('city_rpg');
} else database = { pool: await makeDb(), cleanup: pool => pool.end() };
const pool = database.pool;
const tx = action => withItemTransaction(pool, action);
const players = paths.map(route => ({
  ...route,
  account: 'city-rpg-account-' + route.id,
  character: 'city-rpg-character-' + route.id,
  owner: { scope: 'character', id: 'city-rpg-character-' + route.id },
}));
for (const player of players) player.context = createMysteryContext({
  registry, accountId: player.account, now: '2026-10-09T13:00:00.000Z',
});
const act = (player, fn, ...args) => tx(client => fn(client, player.context, player.owner, graph, ...args));
const count = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].n);
const economy = async () => ({
  characters: (await pool.query('SELECT id,cash,bank,respect FROM characters ORDER BY id')).rows,
  balances: (await pool.query('SELECT account_id,omr FROM account_persistent ORDER BY account_id')).rows,
  ledger: await count('SELECT COUNT(*) AS n FROM transactions'),
});
const board = player => mysteryBoard(pool, player.context, player.owner, graph);

// Both callers cross BEGIN on separate backends before either may reserve the replay guard.
// PostgreSQL must serialize the identical key and return the winner's recorded result to the loser.
async function concurrentReplay(player, fn, options) {
  const backendPids = [];
  let arrivals = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const concurrentPool = {
    async connect() {
      const inner = await pool.connect();
      return new Proxy(inner, {
        get(target, property) {
          if (property === 'query') return async (sql, params) => {
            const result = await target.query(sql, params);
            if (/^\s*BEGIN\s*$/i.test(String(sql))) {
              backendPids.push(Number((await target.query('SELECT pg_backend_pid() AS pid')).rows[0].pid));
              if (++arrivals === 2) release();
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('City RPG concurrent transaction barrier timed out')), 5000);
                barrier.then(() => { clearTimeout(timeout); resolve(); }, reject);
              });
            }
            return result;
          };
          const value = target[property];
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
  };
  const execute = () => withItemTransaction(concurrentPool,
    client => fn(client, player.context, player.owner, graph, ...options));
  const [winner, replay] = await Promise.all([execute(), execute()]);
  assert.equal(new Set(backendPids).size, 2, 'The concurrent replay proof uses two real PostgreSQL backends.');
  assert.deepEqual(replay, winner, 'Concurrent exact-key callers receive byte-equivalent recorded results.');
  return winner;
}

try {
  for (const player of players) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [player.account]);
    await pool.query(
      "INSERT INTO characters (id,account_id,name,season,loc,respect,cash,bank) VALUES ($1,$2,$3,1,'docks',0,555,666)",
      [player.character, player.account, 'City RPG ' + player.id],
    );
    await pool.query('INSERT INTO account_persistent (account_id,omr) VALUES ($1,777)', [player.account]);
  }
  const before = await economy();
  await assert.rejects(
    tx(client => startMystery(client, players[1].context, players[0].owner, graph, 1, 'rpg-cross-account-start')),
    error => error?.code === 'mystery_owner_forbidden',
    'A different account cannot start a quest for another character.',
  );

  for (const player of players) {
    const prefix = 'rpg-' + player.id;
    const started = await act(player, startMystery, 1, prefix + '-start');
    assert.equal(started.status, 'active');
    assert.deepEqual(await act(player, startMystery, 1, prefix + '-start'), started);
    assert.equal((await act(player, startMystery, 1, prefix + '-other-start')).instanceId, started.instanceId,
      'Starting again resumes the same persistent character instance.');
    const initial = await board(player);
    assert.deepEqual(initial.nodes.map(node => node.id), [fixer, choice]);
    for (const secret of [player.task, player.other, ending, keepsake, player.evidence]) {
      assert(!JSON.stringify(initial).includes(secret), 'Initial projection omits undiscovered node and reward IDs.');
    }
    await assert.rejects(
      act(player, completeNode, ending, { idempotencyKey: prefix + '-skip', interactionId: 'publish_neighborhood_note' }),
      error => error?.code === 'mystery_hidden', 'Guessing the terminal node cannot skip objectives.',
    );
    await assert.rejects(
      act(player, completeNode, fixer, { idempotencyKey: prefix + '-walk-only', interactionId: 'pointer-arrival' }),
      error => error?.code === 'interaction', 'Cosmetic walking does not prove the explicit NPC interaction.',
    );
    assert.equal(await count('SELECT COUNT(*) AS n FROM mystery_node_state WHERE instance_id=$1', [started.instanceId]), 0,
      'A rejected interaction leaves no completion fragment.');
    assert.equal(await count('SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key=$1', [prefix + '-walk-only']), 0,
      'A rejected interaction leaves no replay reservation.');

    const first = await act(player, completeNode, fixer,
      { idempotencyKey: prefix + '-fixer', interactionId: 'meet_neighborhood_fixer' });
    assert.deepEqual(await act(player, completeNode, fixer,
      { idempotencyKey: prefix + '-fixer', interactionId: 'meet_neighborhood_fixer' }), first);
    await assert.rejects(
      act(player, completeNode, fixer, { idempotencyKey: prefix + '-fixer', interactionId: 'tampered' }),
      error => error?.code === 'idempotency_conflict', 'A replay key cannot authorize changed interaction data.',
    );
    const decision = await act(player, commitChoice, choice, player.id,
      { idempotencyKey: prefix + '-choice', interactionId: 'choose_neighborhood_approach' });
    assert.equal(decision.choice.id, player.id);
    assert.deepEqual(await act(player, commitChoice, choice, player.id,
      { idempotencyKey: prefix + '-choice', interactionId: 'choose_neighborhood_approach' }), decision);
    const otherOption = player.id === 'listen' ? 'ask' : 'listen';
    await assert.rejects(
      act(player, commitChoice, choice, otherOption,
        { idempotencyKey: prefix + '-change-choice', interactionId: 'choose_neighborhood_approach' }),
      error => error?.code === 'choice_committed', 'The selected dialogue path is irreversible.',
    );
    const persistedContext = createMysteryContext({ registry, accountId: player.account });
    const persisted = await mysteryBoard(pool, persistedContext, player.owner, graph);
    assert.equal(persisted.instanceId, started.instanceId);
    assert.deepEqual(persisted.choices, [{ nodeId: choice, choiceId: player.id }]);
    assert(persisted.nodes.some(node => node.id === player.task), 'A fresh runtime context resumes the selected objective.');
    assert(!JSON.stringify(persisted).includes(player.other), 'The unchosen hidden path stays outside the projection.');
    await assert.rejects(
      act(player, completeNode, player.other, { idempotencyKey: prefix + '-wrong-path', interactionId: player.interaction }),
      error => ['mystery_excluded', 'mystery_hidden'].includes(error?.code), 'The opposite workshop branch cannot be completed.',
    );
    await act(player, completeNode, player.task,
      { idempotencyKey: prefix + '-workshop', interactionId: player.interaction });
    const inspected = await board(player);
    assert(inspected.nodes.some(node => node.id === player.evidence && node.status === 'completed'));
    assert(!JSON.stringify(inspected).includes(ending), 'Inspection leaves the eligible newsroom lead undiscovered and its ID private.');
    assert.equal(inspected.explorationAvailable, true, 'The server issues exploration eligibility after the workshop objective.');
    await assert.rejects(
      tx(client => exploreMystery(client, players.find(other => other !== player).context, player.owner, graph,
        { idempotencyKey: prefix + '-cross-account-explore' })),
      error => error?.code === 'mystery_owner_forbidden', 'Another account cannot investigate this character\'s lead.',
    );
    assert(!JSON.stringify(await board(player)).includes(ending), 'Rejected cross-account exploration discloses and changes nothing.');
    await assert.rejects(
      act(player, completeNode, ending,
        { idempotencyKey: prefix + '-skip-exploration', interactionId: 'publish_neighborhood_note' }),
      error => error?.code === 'mystery_hidden', 'Eligible prerequisites alone do not complete an undiscovered lead.',
    );
    const exploreOptions = { idempotencyKey: prefix + '-explore' };
    const explored = postgres && player.id === 'listen'
      ? await concurrentReplay(player, exploreMystery, [exploreOptions])
      : await act(player, exploreMystery, exploreOptions);
    assert.equal(explored.node.id, ending);
    assert.equal(explored.node.status, 'discovered');
    assert.equal(await count('SELECT COUNT(*) AS n FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2',
      [started.instanceId, ending]), 1, 'Concurrent exploration writes exactly one discovered node row.');
    assert.equal(await count('SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key=$1',
      [exploreOptions.idempotencyKey]), 1, 'Concurrent exploration reserves one replay guard.');
    assert.deepEqual(await act(player, exploreMystery, { idempotencyKey: prefix + '-explore' }), explored,
      'An exploration retry returns the same recorded reveal instead of selecting another candidate.');
    await assert.rejects(
      act(player, completeNode, ending,
        { idempotencyKey: prefix + '-explore', interactionId: 'publish_neighborhood_note' }),
      error => error?.code === 'idempotency_conflict', 'An exploration key cannot authorize a different completion payload.',
    );
    await assert.rejects(
      act(player, exploreMystery, { idempotencyKey: prefix + '-extra-explore' }),
      error => error?.code === 'mystery_node_unavailable', 'A new exploration key cannot reveal an already discovered lead twice.',
    );
    assert((await board(player)).nodes.some(node => node.id === ending), 'Explicit investigation reveals the newsroom objective.');
    assert.equal((await inventoryBoard(pool, player.owner)).items.length, 0, 'No early checkpoint awards the keepsake.');
    const terminalOptions = { idempotencyKey: prefix + '-newsroom', interactionId: 'publish_neighborhood_note' };
    const terminal = postgres && player.id === 'listen'
      ? await concurrentReplay(player, completeNode, [ending, terminalOptions])
      : await act(player, completeNode, ending, terminalOptions);
    assert.equal(terminal.status, 'completed');
    assert(!JSON.stringify(terminal).includes(keepsake), 'Mutation replies do not leak hidden reward template identifiers.');
    assert.deepEqual(await act(player, completeNode, ending,
      { idempotencyKey: prefix + '-newsroom', interactionId: 'publish_neighborhood_note' }), terminal,
    'A terminal retry returns the same recorded result after the instance closes.');
    await assert.rejects(
      act(player, completeNode, ending,
        { idempotencyKey: prefix + '-duplicate-award', interactionId: 'publish_neighborhood_note' }),
      error => error?.code === 'mystery_closed', 'A fresh replay key cannot reopen the quest or mint a second keepsake.',
    );
    const completed = await board(player);
    assert.equal(completed.status, 'completed');
    const inventory = await inventoryBoard(pool, player.owner);
    assert.equal(inventory.items.filter(item => item.templateId === keepsake).length, 1);
    assert.equal((await act(player, startMystery, 1, prefix + '-restart-completed')).status, 'completed');
    await assert.rejects(
      mysteryBoard(pool, players.find(other => other !== player).context, player.owner, graph),
      error => error?.code === 'mystery_owner_forbidden', 'Another account cannot inspect private quest progress.',
    );
  }
  assert.deepEqual(await economy(), before, 'Both dialogue paths leave cash, bank, respect, OMR, and the economic ledger unchanged.');

  const original = players[0], heirId = 'city-rpg-character-heir';
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [original.character]);
  await pool.query(
    "INSERT INTO characters (id,account_id,name,season,loc,generation) VALUES ($1,$2,'City RPG Heir',1,'docks',2)",
    [heirId, original.account],
  );
  const historical = await board(original);
  assert.equal(historical.status, 'completed', 'The original character retains immutable quest history after death.');
  const heirOwner = { scope: 'character', id: heirId };
  const heir = await tx(client => startMystery(client, original.context, heirOwner, graph, 1, 'rpg-heir-start'));
  assert.notEqual(heir.instanceId, historical.instanceId);
  const fresh = await mysteryBoard(pool, original.context, heirOwner, graph);
  assert.deepEqual(fresh.choices, []);
  assert(!fresh.nodes.some(node => node.status === 'completed'), 'An heir does not inherit another character\'s quest completion.');
  assert.equal((await inventoryBoard(pool, heirOwner)).items.length, 0, 'The cosmetic reward stays with its original character owner.');
  assert.equal((await inventoryBoard(pool, original.owner)).items.filter(item => item.templateId === keepsake).length, 1);
  assert.equal(await count('SELECT COUNT(*) AS n FROM item_instances WHERE template_id=$1', [keepsake]), 2,
    'Two completed characters award two keepsakes; rejected actions, retries, restart, and a new heir award none.');
  console.log('city-rpg: canonical validation, three NPC objectives, both irreversible paths, private leads/explicit exploration, replay conflicts, transaction rollback, exactly-once cosmetic rewards, economic neutrality, persistent progress, owner isolation, and death/no-inheritance pass');
  console.log('Content hash: ' + report.contentHash + '; database: ' + (postgres
    ? 'isolated PostgreSQL schema; two-backend concurrent exploration and terminal exact-key replay pass.'
    : 'pg-mem (PostgreSQL contention/concurrency not claimed).'));
} finally { await database.cleanup(pool); }
