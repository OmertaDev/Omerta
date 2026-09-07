// Phase 1 data-defined mysteries: private discovery, graph gates, irreversible branches,
// conserved item effects, pinned versions, and replay/rollback safety.
import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import {
  createItem,
  grantStack,
  inventoryBoard,
  withItemTransaction,
} from '../src/items.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import {
  cancelMystery,
  commitChoice,
  completeNode,
  createMysteryContext,
  discoverNode,
  mysteryBoard,
  startMystery,
} from '../src/mysteries.js';
import { isWorldGraphRegistry, loadGraphPackages } from '../src/worldgraph.js';

const ACCOUNT = 'mystery-account';
const CHARACTER = 'mystery-character';
const OTHER_ACCOUNT = 'mystery-other-account';
const OTHER_CHARACTER = 'mystery-other-character';
const OWNER = Object.freeze({ scope: 'account', id: ACCOUNT });
const OTHER_OWNER = Object.freeze({ scope: 'account', id: OTHER_ACCOUNT });
const GRAPH_ID = 'test-mystery';
const NOW = '2026-09-03T18:00:00.000Z';

const corePackage = Object.freeze({
  id: 'test-mystery-core',
  version: 1,
  season: 'core',
  dependsOn: Object.freeze([]),
  nodes: Object.freeze([
    Object.freeze({
      id: 'mat:mystery_dust', type: 'material', visibility: 'public',
      metadata: Object.freeze({ inventoryClass: 'stack', administratorSeeded: true }),
    }),
    Object.freeze({
      id: 'item:mystery_tool', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'item:missing_tool', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'item:mystery_artifact', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'source:mystery_tools', type: 'source', visibility: 'public',
      produces: Object.freeze([
        Object.freeze({ templateId: 'item:mystery_tool', quantity: 1 }),
        Object.freeze({ templateId: 'item:missing_tool', quantity: 1 }),
      ]),
    }),
  ]),
});

const mysteryNodes = Object.freeze([
  Object.freeze({
    id: 'm:start', type: 'mystery_step', version: 1, visibility: 'public',
    conditions: Object.freeze([
      Object.freeze({ adapter: 'location', value: 'docks' }),
      Object.freeze({ adapter: 'level', minimumLevel: 2 }),
      Object.freeze({ adapter: 'skill', skillId: 'fence_network' }),
      Object.freeze({ adapter: 'explicit_interaction', interactionId: 'inspect_manifest' }),
    ]),
  }),
  Object.freeze({
    id: 'm:hidden', type: 'mystery_step', version: 1, visibility: 'hidden',
    requires: Object.freeze(['m:start']),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'material_quantity', templateId: 'mat:mystery_dust', quantity: 2 }),
      Object.freeze({ adapter: 'time_window', windowId: 'night_shift' }),
    ]),
  }),
  Object.freeze({
    id: 'm:and', type: 'mystery_step', version: 1, visibility: 'public',
    requires: Object.freeze(['m:start', 'm:hidden']),
  }),
  Object.freeze({
    id: 'm:alternative', type: 'mystery_step', version: 1, visibility: 'public',
    requires: Object.freeze(['m:start']),
  }),
  Object.freeze({
    id: 'm:or', type: 'mystery_step', version: 1, visibility: 'public',
    requiresAny: Object.freeze([Object.freeze(['m:and', 'm:alternative'])]),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'graph_dependency', nodeId: 'm:start' }),
    ]),
  }),
  Object.freeze({
    id: 'choice:path', type: 'choice', version: 1, visibility: 'hidden',
    requires: Object.freeze(['m:or']),
    options: Object.freeze([
      Object.freeze({
        id: 'left',
        excludes: Object.freeze(['m:right']),
        effects: Object.freeze([
          Object.freeze({ adapter: 'discover', nodeId: 'm:left' }),
        ]),
      }),
      Object.freeze({
        id: 'right',
        excludes: Object.freeze(['m:left']),
        effects: Object.freeze([
          Object.freeze({ adapter: 'discover', nodeId: 'm:right' }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: 'm:left', type: 'mystery_step', version: 1, visibility: 'hidden',
    requires: Object.freeze(['choice:path']), excludes: Object.freeze(['m:right']),
  }),
  Object.freeze({
    id: 'm:right', type: 'mystery_step', version: 1, visibility: 'hidden',
    requires: Object.freeze(['choice:path']), excludes: Object.freeze(['m:left']),
  }),
  Object.freeze({
    id: 'm:right-tail', type: 'mystery_step', version: 1, visibility: 'hidden',
    requires: Object.freeze(['m:right']),
  }),
  Object.freeze({
    id: 'evidence:belladonna', type: 'evidence', version: 1, visibility: 'hidden',
    requires: Object.freeze(['m:evidence-source']),
  }),
  Object.freeze({
    id: 'source:belladonna_evidence', type: 'source', version: 1, visibility: 'hidden',
    produces: Object.freeze([
      Object.freeze({ templateId: 'evidence:belladonna', quantity: 1 }),
    ]),
  }),
  Object.freeze({
    id: 'm:evidence-source', type: 'mystery_step', version: 1, visibility: 'public',
    requires: Object.freeze(['m:and']),
    effects: Object.freeze([
      Object.freeze({ adapter: 'evidence_grant', nodeId: 'evidence:belladonna' }),
    ]),
  }),
  Object.freeze({
    id: 'm:evidence-gate', type: 'mystery_step', version: 1, visibility: 'public',
    requires: Object.freeze(['m:evidence-source']),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'evidence', evidenceId: 'evidence:belladonna' }),
    ]),
  }),
  Object.freeze({
    id: 'm:consume', type: 'mystery_step', version: 1, visibility: 'public',
    requires: Object.freeze(['m:evidence-gate']),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'item_ownership', templateId: 'item:mystery_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_consume', templateId: 'item:mystery_tool' }),
    ]),
  }),
  Object.freeze({
    id: 'm:escrow', type: 'mystery_step', version: 1, visibility: 'public',
    requires: Object.freeze(['m:evidence-gate']),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'owns_item', templateId: 'item:mystery_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:mystery_tool' }),
    ]),
  }),
  Object.freeze({
    id: 'm:rollback', type: 'mystery_step', version: 1, visibility: 'public',
    requires: Object.freeze(['m:evidence-gate']),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'item_ownership', templateId: 'item:mystery_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_consume', templateId: 'item:mystery_tool' }),
      Object.freeze({ adapter: 'item_consume', templateId: 'item:missing_tool' }),
    ]),
  }),
  Object.freeze({
    id: 'reward:mystery_status', type: 'reward', version: 1, visibility: 'hidden',
    requires: Object.freeze(['m:award']),
    metadata: Object.freeze({ inert: true, rewardType: 'status', title: 'Belladonna Witness' }),
  }),
  Object.freeze({
    id: 'm:award', type: 'mystery_step', version: 1, visibility: 'public',
    requires: Object.freeze(['m:consume']),
    effects: Object.freeze([
      Object.freeze({ adapter: 'unique_item_award', templateId: 'item:mystery_artifact' }),
      Object.freeze({ adapter: 'status_award', nodeId: 'reward:mystery_status' }),
    ]),
  }),
  Object.freeze({
    id: 'choice:conflict', type: 'choice', version: 1, visibility: 'public',
    requires: Object.freeze(['m:start']),
    options: Object.freeze([Object.freeze({
      id: 'too_late', excludes: Object.freeze(['m:alternative']),
    })]),
  }),
  Object.freeze({
    id: 'm:cancel-deposit', type: 'mystery_step', version: 1, visibility: 'public',
    conditions: Object.freeze([
      Object.freeze({ adapter: 'item_ownership', templateId: 'item:mystery_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:mystery_tool' }),
    ]),
  }),
  Object.freeze({
    id: 'm:terminal', type: 'mystery_step', version: 1, visibility: 'public',
    requires: Object.freeze(['m:award', 'm:escrow']),
    metadata: Object.freeze({ terminal: true, title: 'Close the Belladonna File' }),
  }),
  Object.freeze({
    id: 'm:role-secret', type: 'mystery_step', version: 1, visibility: 'role_private',
    metadata: Object.freeze({ roleId: 'investigator', secret: 'never publish me here' }),
  }),
  Object.freeze({
    id: 'choice:role-secret', type: 'choice', version: 1, visibility: 'role_private',
    metadata: Object.freeze({ roleId: 'investigator', secret: 'never publish this choice' }),
    options: Object.freeze([Object.freeze({ id: 'private-option' })]),
  }),
]);

const mysteryPackage = (version = 1) => Object.freeze({
  id: GRAPH_ID,
  version,
  season: 'core',
  dependsOn: Object.freeze(['test-mystery-core']),
  nodes: Object.freeze(mysteryNodes.map((node) => Object.freeze({
    ...node,
    ...(['mystery_step', 'world_gate', 'choice', 'evidence', 'reward'].includes(node.type)
      && node.version !== undefined ? { version } : {}),
  }))),
});

const registry = loadAndValidateGraphPackages([corePackage, mysteryPackage(1)]);
const context = createMysteryContext({
  registry,
  accountId: ACCOUNT,
  now: NOW,
  timeWindows: {
    night_shift: {
      startsAt: '2026-09-03T17:00:00.000Z',
      endsAt: '2026-09-03T19:00:00.000Z',
    },
  },
});
const otherContext = createMysteryContext({
  registry, accountId: OTHER_ACCOUNT, now: NOW,
  timeWindows: context.timeWindows,
});
const versionTwoRegistry = loadAndValidateGraphPackages([corePackage, mysteryPackage(2)]);
const versionTwoContext = createMysteryContext({
  registry: versionTwoRegistry, accountId: ACCOUNT, now: NOW,
  timeWindows: context.timeWindows,
});
const retiredRegistry = loadAndValidateGraphPackages([corePackage]);
const retiredContext = createMysteryContext({
  registry: retiredRegistry, accountId: ACCOUNT, now: NOW,
});
const retiredOtherContext = createMysteryContext({
  registry: retiredRegistry, accountId: OTHER_ACCOUNT, now: NOW,
});

assert(Object.isFrozen(context));
assert(Object.isFrozen(context.timeWindows));
assert.equal(context.registry, registry);
assert.equal(isWorldGraphRegistry(registry), true);

const spoofPackage = Object.freeze({
  id: 'spoof', version: 1, season: 'core', dependsOn: Object.freeze([]), nodes: Object.freeze([]),
});
assert.throws(
  () => createMysteryContext({
    registry: Object.freeze({
      byPackage: new Map([['spoof', spoofPackage]]), nodes: new Map(),
    }),
    accountId: ACCOUNT,
    now: NOW,
  }),
  (error) => error?.code === 'bad_mystery_context',
  'freezing a wrapper around caller-mutable Maps cannot forge world-graph registry authority',
);

const mutableEffects = [];
const mutableNode = {
  id: 'm:immutable', type: 'mystery_step', visibility: 'public', effects: mutableEffects,
};
const authenticImmutableRegistry = loadGraphPackages([{
  id: 'immutable-mystery', version: 1, season: 'core', dependsOn: [], nodes: [mutableNode],
}]);
const immutableContext = createMysteryContext({
  registry: authenticImmutableRegistry, accountId: ACCOUNT, now: NOW,
});
mutableEffects.push({ adapter: 'cash', amount: 1000 });
mutableNode.effects = mutableEffects;
assert.equal(immutableContext.registry.nodes.get('m:immutable').effects.length, 0,
  'post-context caller mutation cannot add executable effects to an authentic registry');

const ignoredLifecycleRegistry = loadGraphPackages([{
  id: 'ignored-lifecycle-mystery', version: 1, season: 'core', dependsOn: [], nodes: [{
    id: 'm:ignored-cooldown', type: 'mystery_step', visibility: 'public',
    metadata: { cooldownSeconds: 60 },
  }],
}]);
assert.throws(
  () => createMysteryContext({
    registry: ignoredLifecycleRegistry, accountId: ACCOUNT, now: NOW,
  }),
  (error) => error?.code === 'unsupported_mystery_semantics',
  'the request-time mystery context shares the release gate for ignored lifecycle authority',
);

const pool = await makeDb();
const tx = (action) => withItemTransaction(pool, action);
const act = (fn, ...args) => tx((client) => fn(client, context, ...args));
const nodeState = async (instanceId, nodeId) => (await pool.query(
  'SELECT * FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2',
  [instanceId, nodeId],
)).rows[0] || null;
const count = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].n);
const tracingPool = (queries) => ({
  async connect() {
    const inner = await pool.connect();
    return new Proxy(inner, {
      get(target, property) {
        if (property === 'query') return async (sql, params) => {
          queries.push(String(sql).replace(/\s+/g, ' ').trim());
          return target.query(sql, params);
        };
        const value = target[property];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  },
});

try {
  await pool.query(
    `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
     VALUES ($1,$2,'Mystery Mae',1,'docks',10000,5555),
            ($3,$4,'Other Olive',1,'docks',10000,6666)`,
    [CHARACTER, ACCOUNT, OTHER_CHARACTER, OTHER_ACCOUNT],
  );
  await pool.query(
    'INSERT INTO account_persistent (account_id,omr) VALUES ($1,777),($2,888)',
    [ACCOUNT, OTHER_ACCOUNT],
  );
  await pool.query(
    "INSERT INTO character_skills (character_id,skill_id) VALUES ($1,'fence_network')",
    [CHARACTER],
  );

  const moneyBefore = {
    cash: Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [CHARACTER])).rows[0].cash),
    omr: Number((await pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [ACCOUNT],
    )).rows[0].omr),
    transactions: await count('SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [CHARACTER]),
  };

  await assert.rejects(
    tx((client) => startMystery(client, context, { scope: 'operation', id: 'forbidden' }, GRAPH_ID, 1)),
    (error) => error?.code === 'bad_mystery_owner',
    'social operation custody is not a Task 5 mystery root owner',
  );
  await assert.rejects(
    tx((client) => startMystery(client, context, OTHER_OWNER, GRAPH_ID, 1)),
    (error) => error?.code === 'mystery_owner_forbidden',
    'an authenticated context cannot nominate another account as owner',
  );
  await assert.rejects(
    tx((client) => startMystery(client, context, OWNER, GRAPH_ID, 2)),
    (error) => error?.code === 'graph_version',
  );

  const started = await act(startMystery, OWNER, GRAPH_ID, 1);
  const startReplay = await act(startMystery, OWNER, GRAPH_ID, 1);
  assert.deepEqual(startReplay, started, 'start is deterministic and replay-safe without a caller key');
  const concurrentStarts = await Promise.all(Array.from({ length: 4 }, () => (
    tx((client) => startMystery(client, context, OWNER, GRAPH_ID, 1))
  )));
  assert(concurrentStarts.every(({ instanceId }) => instanceId === started.instanceId));
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM mystery_instances
      WHERE owner_scope=$1 AND owner_id=$2 AND graph_id=$3 AND graph_version=$4`,
    [OWNER.scope, OWNER.id, GRAPH_ID, 1],
  ), 1, 'same-version start races converge on one owner/graph/version lifecycle');
  const lockTrace = [];
  await assert.rejects(
    withItemTransaction(tracingPool(lockTrace), (client) => completeNode(
      client, context, OWNER, GRAPH_ID, 'm:start', {
        idempotencyKey: 'm-lock-order-probe', interactionId: 'wrong-interaction',
      },
    )),
    (error) => error?.code === 'interaction',
  );
  const actorLock = lockTrace.findIndex((sql) => (
    /FROM characters WHERE (?:id|account_id)=\$1 AND alive .*FOR UPDATE/i.test(sql)
  ));
  const mysteryLock = lockTrace.findIndex((sql) => (
    /FROM mystery_instances WHERE id=\$1 FOR UPDATE/i.test(sql)
      || /FROM mystery_instances .*graph_version=\$4 FOR UPDATE/i.test(sql)
  ));
  assert(actorLock >= 0 && mysteryLock > actorLock,
    `every mystery action locks actor character before mystery_instances: ${lockTrace.join(' | ')}`);
  assert.equal(started.graph.id, GRAPH_ID);
  assert.equal(started.graph.version, 1);
  assert.match(started.instanceId, /^[0-9a-f-]{36}$/i);
  await pool.query(
    `INSERT INTO mystery_choices (instance_id,node_id,choice_id,result_json)
     VALUES ($1,'choice:role-secret','private-option','{}')`,
    [started.instanceId],
  );

  const characterOwner = Object.freeze({ scope: 'character', id: CHARACTER });
  const characterStarted = await act(startMystery, characterOwner, GRAPH_ID, 1);
  assert.deepEqual(characterStarted.owner, characterOwner,
    'a character root is supported but remains bound to its server-derived account');
  assert.equal((await mysteryBoard(pool, context, characterOwner, GRAPH_ID)).instanceId,
    characterStarted.instanceId);
  await assert.rejects(
    mysteryBoard(pool, otherContext, characterOwner, GRAPH_ID),
    (error) => error?.code === 'mystery_owner_forbidden',
    'another account cannot drive a character-rooted mystery by guessing its character id',
  );
  const cancelTool = await tx((client) => createItem(
    client, characterOwner, 'item:mystery_tool', 'crafted', 'm-cancel-tool-create',
  ));
  await act(
    completeNode, characterOwner, GRAPH_ID, 'm:cancel-deposit',
    { idempotencyKey: 'm-cancel-deposit-1' },
  );
  assert.deepEqual((await inventoryBoard(pool, { scope: 'operation', id: characterStarted.instanceId }))
    .items.map(({ id }) => id), [cancelTool.id]);
  await assert.rejects(
    mysteryBoard(pool, versionTwoContext, characterOwner, GRAPH_ID),
    (error) => error?.code === 'mystery_not_started',
    'current-version discovery never reinterprets or leaks an old active mystery',
  );
  const versionTwoStarted = await tx((client) => startMystery(
    client, versionTwoContext, characterOwner, GRAPH_ID, 2, 'm-start-v2-beside-v1-active',
  ));
  assert.notEqual(versionTwoStarted.instanceId, characterStarted.instanceId);
  assert.equal(versionTwoStarted.graph.version, 2);
  assert.equal(versionTwoStarted.status, 'active',
    'v2 starts independently while the immutable v1 instance remains active for recovery');
  for (const [candidateContext, candidateGraph, candidateId, label] of [[
    retiredOtherContext, GRAPH_ID, characterStarted.instanceId, 'foreign account',
  ], [
    retiredContext, 'retired-wrong-graph', characterStarted.instanceId, 'wrong graph',
  ], [
    retiredContext, GRAPH_ID, 'retired-missing-instance', 'missing instance',
  ]]) {
    await assert.rejects(
      tx((client) => cancelMystery(
        client, candidateContext, characterOwner, candidateGraph, candidateId,
        { idempotencyKey: `m-cancel-refused-${label.replace(/\s/g, '-')}` },
      )),
      (error) => error?.code === 'mystery_unavailable',
      `${label} is indistinguishable during exact-id historical recovery`,
    );
  }
  const canceled = await tx((client) => cancelMystery(
    client, retiredContext, characterOwner, GRAPH_ID, characterStarted.instanceId,
    { idempotencyKey: 'm-cancel-1' },
  ));
  assert.equal(canceled.status, 'canceled');
  assert.equal(canceled.releasedEscrowCount, 1);
  assert.deepEqual((await inventoryBoard(pool, characterOwner)).items.map(({ id }) => id),
    [cancelTool.id], 'cancel returns mystery custody to the original depositor atomically');
  assert.deepEqual(await tx((client) => cancelMystery(
    client, retiredContext, characterOwner, GRAPH_ID, characterStarted.instanceId,
    { idempotencyKey: 'm-cancel-1' },
  )), canceled, 'removed-package release-only cancellation is exact on logical replay');
  assert.equal((await mysteryBoard(pool, versionTwoContext, characterOwner, GRAPH_ID)).instanceId,
    versionTwoStarted.instanceId,
  'historical v1 cancellation leaves the already-active current v2 instance independent');
  assert.equal((await act(startMystery, characterOwner, GRAPH_ID, 1)).status, 'canceled',
    'start cannot reopen or misreport a canceled graph-pinned instance');
  await assert.rejects(
    act(
      completeNode, characterOwner, GRAPH_ID, 'm:start',
      { idempotencyKey: 'm-canceled-cannot-act', interactionId: 'inspect_manifest' },
    ),
    (error) => error?.code === 'mystery_closed',
    'a canceled instance cannot continue',
  );

  let board = await mysteryBoard(pool, context, OWNER, GRAPH_ID);
  assert.equal(board.instanceId, started.instanceId);
  assert.equal(board.graph.version, 1);
  assert.equal(board.nodes.some((node) => node.id === 'm:hidden'), false,
    'an undiscovered hidden node is absent, not redacted into an oracle');
  assert.equal(JSON.stringify(board).includes('m:hidden'), false,
    'public-node blockers cannot disclose an undiscovered hidden dependency id');
  assert.equal(board.nodes.some((node) => node.id === 'm:role-secret'), false,
    'Task 5 never publishes role-private nodes');
  assert.equal(JSON.stringify(board).includes('choice:role-secret'), false,
    'the choice summary also fails closed around role-private graph state');
  assert.equal(JSON.stringify(board).includes('effects'), false,
    'the board never publishes private effect authority');
  assert.equal(JSON.stringify(board).includes('never publish me here'), false);

  await pool.query("UPDATE characters SET loc='foundry' WHERE id=$1", [CHARACTER]);
  await assert.rejects(
    act(
      completeNode, OWNER, GRAPH_ID, 'm:start',
      { idempotencyKey: 'm-start-location', interactionId: 'inspect_manifest' },
    ),
    (error) => error?.code === 'location',
    'location comes from the locked living-character row, not the caller',
  );
  await pool.query("UPDATE characters SET loc='docks',respect=0 WHERE id=$1", [CHARACTER]);
  await assert.rejects(
    act(
      completeNode, OWNER, GRAPH_ID, 'm:start',
      { idempotencyKey: 'm-start-level', interactionId: 'inspect_manifest' },
    ),
    (error) => error?.code === 'level',
    'level is derived from locked respect',
  );
  await pool.query('UPDATE characters SET respect=10000 WHERE id=$1', [CHARACTER]);
  await pool.query('DELETE FROM character_skills WHERE character_id=$1', [CHARACTER]);
  await assert.rejects(
    act(
      completeNode, OWNER, GRAPH_ID, 'm:start',
      { idempotencyKey: 'm-start-skill', interactionId: 'inspect_manifest' },
    ),
    (error) => error?.code === 'skill',
    'skill qualification is reloaded inside the guarded callback',
  );
  await pool.query(
    "INSERT INTO character_skills (character_id,skill_id) VALUES ($1,'fence_network')",
    [CHARACTER],
  );
  await assert.rejects(
    act(completeNode, OWNER, GRAPH_ID, 'm:start', { idempotencyKey: 'm-start-wrong' }),
    (error) => error?.code === 'interaction',
    'explicit interaction is a declared, exact server-checked gate',
  );
  const completedStart = await act(
    completeNode, OWNER, GRAPH_ID, 'm:start',
    { idempotencyKey: 'm-start-1', interactionId: 'inspect_manifest' },
  );
  assert.equal(completedStart.node.status, 'completed');
  await assert.rejects(
    act(
      completeNode, OWNER, GRAPH_ID, 'm:alternative',
      { idempotencyKey: 'm-start-1', interactionId: 'inspect_manifest' },
    ),
    (error) => error?.code === 'idempotency_conflict',
    'one logical key cannot be rebound to another graph node or request',
  );

  await assert.rejects(
    act(discoverNode, OWNER, GRAPH_ID, 'm:hidden', { idempotencyKey: 'm-hidden-no-dust' }),
    (error) => error?.code === 'materials',
  );
  await tx((client) => grantStack(
    client, OWNER, 'mat:mystery_dust', 2, 'standard', 'mystery fixture', 'm-dust-1',
  ));
  const closedWindowContext = createMysteryContext({
    registry,
    accountId: ACCOUNT,
    now: '2026-09-03T20:00:00.000Z',
    timeWindows: context.timeWindows,
  });
  await assert.rejects(
    tx((client) => discoverNode(
      client, closedWindowContext, OWNER, GRAPH_ID, 'm:hidden',
      { idempotencyKey: 'm-hidden-late' },
    )),
    (error) => error?.code === 'time_window',
    'named time windows are immutable server context, not client timestamps',
  );
  const discovered = await act(
    discoverNode, OWNER, GRAPH_ID, 'm:hidden', { idempotencyKey: 'm-hidden-discover-1' },
  );
  assert.equal(discovered.node.status, 'discovered');
  board = await mysteryBoard(pool, context, OWNER, GRAPH_ID);
  assert.equal(board.nodes.find((node) => node.id === 'm:hidden').status, 'discovered');

  await assert.rejects(
    act(completeNode, OWNER, GRAPH_ID, 'm:and', { idempotencyKey: 'm-and-too-soon' }),
    (error) => error?.code === 'mystery_prerequisite',
    'AND dependencies require every branch',
  );
  await act(completeNode, OWNER, GRAPH_ID, 'm:hidden', { idempotencyKey: 'm-hidden-complete-1' });
  await act(completeNode, OWNER, GRAPH_ID, 'm:and', { idempotencyKey: 'm-and-1' });
  const completedOr = await act(
    completeNode, OWNER, GRAPH_ID, 'm:or', { idempotencyKey: 'm-or-1' },
  );
  assert.equal(completedOr.node.status, 'completed', 'one member of each OR group is sufficient');

  await assert.rejects(
    act(
      commitChoice, OWNER, GRAPH_ID, 'choice:path', 'left',
      { idempotencyKey: 'm-choice-guessed-hidden' },
    ),
    (error) => error?.code === 'mystery_hidden',
    'guessing a hidden choice id cannot bypass discovery',
  );
  await act(
    discoverNode, OWNER, GRAPH_ID, 'choice:path',
    { idempotencyKey: 'm-choice-discover-1' },
  );

  const choice = await act(
    commitChoice, OWNER, GRAPH_ID, 'choice:path', 'left', { idempotencyKey: 'm-choice-1' },
  );
  assert.equal(choice.choice.id, 'left');
  assert.equal(JSON.stringify(choice).includes('m:right'), false,
    'choice responses do not leak directly or transitively excluded hidden node ids');
  assert.equal((await nodeState(started.instanceId, 'm:right')).state, 'excluded');
  assert.equal((await nodeState(started.instanceId, 'm:right-tail')).state, 'excluded',
    'closing a branch transitively closes nodes whose prerequisites can no longer be satisfied');
  assert.equal((await nodeState(started.instanceId, 'm:left')).state, 'discovered');
  assert.deepEqual(await act(
    commitChoice, OWNER, GRAPH_ID, 'choice:path', 'left', { idempotencyKey: 'm-choice-1' },
  ), choice, 'same-key choice replay is exact');
  assert.deepEqual(await act(
    commitChoice, OWNER, GRAPH_ID, 'choice:path', 'left', { idempotencyKey: 'm-choice-repeat' },
  ), choice, 'same-choice retry under a fresh key is harmless');
  await assert.rejects(
    act(commitChoice, OWNER, GRAPH_ID, 'choice:path', 'right', { idempotencyKey: 'm-choice-change' }),
    (error) => error?.code === 'choice_committed',
    'a committed branch is irreversible',
  );

  await act(
    completeNode, OWNER, GRAPH_ID, 'm:alternative',
    { idempotencyKey: 'm-alternative-1' },
  );
  await assert.rejects(
    act(
      commitChoice, OWNER, GRAPH_ID, 'choice:conflict', 'too_late',
      { idempotencyKey: 'm-choice-contradiction' },
    ),
    (error) => error?.code === 'choice_conflict',
    'an option cannot exclude an already completed or chosen branch',
  );
  await assert.rejects(
    act(completeNode, OWNER, GRAPH_ID, 'm:right', { idempotencyKey: 'm-right-closed' }),
    (error) => error?.code === 'mystery_excluded',
  );

  const evidenceSource = await act(
    completeNode, OWNER, GRAPH_ID, 'm:evidence-source',
    { idempotencyKey: 'm-evidence-source-1' },
  );
  assert.equal(JSON.stringify(evidenceSource).includes('evidence:belladonna'), false,
    'completion results do not reveal hidden effect targets');
  assert.equal((await nodeState(started.instanceId, 'evidence:belladonna')).state, 'completed');
  await act(
    completeNode, OWNER, GRAPH_ID, 'm:evidence-gate',
    { idempotencyKey: 'm-evidence-gate-1' },
  );

  await assert.rejects(
    act(completeNode, OWNER, GRAPH_ID, 'm:consume', { idempotencyKey: 'm-consume-no-item' }),
    (error) => error?.code === 'item_unavailable',
    'item ownership is required from the locked conserved inventory',
  );

  const consumeTool = await tx((client) => createItem(
    client, OWNER, 'item:mystery_tool', 'crafted', 'm-consume-tool-create',
  ));
  const consumeResult = await act(
    completeNode, OWNER, GRAPH_ID, 'm:consume', { idempotencyKey: 'm-consume-1' },
  );
  assert.equal((await pool.query(
    'SELECT state FROM item_instances WHERE id=$1', [consumeTool.id],
  )).rows[0].state, 'consumed');
  assert.deepEqual(await act(
    completeNode, OWNER, GRAPH_ID, 'm:consume', { idempotencyKey: 'm-consume-1' },
  ), consumeResult, 'same-key completion replay returns the original effect result');
  assert.deepEqual(await act(
    completeNode, OWNER, GRAPH_ID, 'm:consume', { idempotencyKey: 'm-consume-repeat' },
  ), consumeResult, 'fresh-key duplicate completion does not apply effects twice');
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_events WHERE item_id=$1 AND event_kind='consumed'", [consumeTool.id],
  ), 1);

  const escrowTool = await tx((client) => createItem(
    client, OWNER, 'item:mystery_tool', 'crafted', 'm-escrow-tool-create',
  ));
  const escrowResult = await act(
    completeNode, OWNER, GRAPH_ID, 'm:escrow', { idempotencyKey: 'm-escrow-1' },
  );
  assert.equal(JSON.stringify(escrowResult).includes(escrowTool.id), false,
    'item effect identities stay inside the authoritative inventory board');
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE item_id=$1 AND operation_id=$2',
    [escrowTool.id, started.instanceId],
  ), 1);

  const rollbackTool = await tx((client) => createItem(
    client, OWNER, 'item:mystery_tool', 'crafted', 'm-rollback-tool-create',
  ));
  await assert.rejects(
    act(completeNode, OWNER, GRAPH_ID, 'm:rollback', { idempotencyKey: 'm-rollback-1' }),
    (error) => error?.code === 'item_unavailable',
    'a later authored item effect can reject the complete action',
  );
  assert.equal((await inventoryBoard(pool, OWNER)).items.some(({ id }) => id === rollbackTool.id), true,
    'pg-mem compensation restores an item consumed before a later effect fails');
  assert.equal(await nodeState(started.instanceId, 'm:rollback'), null,
    'failed action leaves no node completion fragment');
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key='m-rollback-1'",
  ), 0, 'failed action leaves no replay reservation');
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_events WHERE idempotency_key='m-rollback-1'",
  ), 0, 'failed action leaves no item provenance fragment');

  const award = await act(
    completeNode, OWNER, GRAPH_ID, 'm:award', { idempotencyKey: 'm-award-1' },
  );
  assert.equal(JSON.stringify(award).includes('item:mystery_artifact'), false);
  assert.equal(JSON.stringify(award).includes('reward:mystery_status'), false,
    'award effect targets are not exposed in mutation responses');
  assert.equal((await nodeState(started.instanceId, 'reward:mystery_status')).state, 'completed');

  const terminal = await act(
    completeNode, OWNER, GRAPH_ID, 'm:terminal', { idempotencyKey: 'm-terminal-1' },
  );
  assert.equal(terminal.status, 'completed');
  assert.equal(terminal.releasedEscrowCount, 1);
  assert.deepEqual((await inventoryBoard(pool, OWNER)).items
    .filter(({ id }) => id === escrowTool.id).map(({ id }) => id), [escrowTool.id],
  'successful graph-declared terminal completion releases mystery escrow');
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [started.instanceId],
  ), 0);
  assert.deepEqual(await act(
    completeNode, OWNER, GRAPH_ID, 'm:terminal', { idempotencyKey: 'm-terminal-1' },
  ), terminal, 'terminal completion replays after the instance closes');
  await assert.rejects(
    act(completeNode, OWNER, GRAPH_ID, 'm:left', { idempotencyKey: 'm-after-terminal' }),
    (error) => error?.code === 'mystery_closed',
    'a successfully completed instance cannot continue',
  );

  board = await mysteryBoard(pool, context, OWNER, GRAPH_ID);
  assert.deepEqual(board.choices, [{ nodeId: 'choice:path', choiceId: 'left' }]);
  assert.equal(board.nodes.find(({ id }) => id === 'm:award').status, 'completed');
  assert.equal(JSON.stringify(board).includes('item_consume'), false);

  await assert.rejects(
    mysteryBoard(pool, versionTwoContext, OWNER, GRAPH_ID),
    (error) => error?.code === 'mystery_not_started',
    'a completed v1 instance is not exposed as current v2 state',
  );
  const completedOwnerV2 = await tx((client) => startMystery(
    client, versionTwoContext, OWNER, GRAPH_ID, 2, 'm-start-v2-after-v1-complete',
  ));
  assert.notEqual(completedOwnerV2.instanceId, started.instanceId);
  assert.equal(completedOwnerV2.status, 'active',
    'a completed historical version cannot permanently block the owner from the successor');
  assert.equal((await mysteryBoard(pool, versionTwoContext, OWNER, GRAPH_ID)).instanceId,
    completedOwnerV2.instanceId);
  assert.equal(Number((await pool.query(
    'SELECT graph_version FROM mystery_instances WHERE id=$1', [started.instanceId],
  )).rows[0].graph_version), 1);
  await assert.rejects(
    mysteryBoard(pool, otherContext, OWNER, GRAPH_ID),
    (error) => error?.code === 'mystery_owner_forbidden',
  );
  await assert.rejects(
    mysteryBoard(pool, otherContext, OTHER_OWNER, GRAPH_ID),
    (error) => error?.code === 'mystery_not_started',
    'another valid owner gets no instance details',
  );

  const moneyAfter = {
    cash: Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [CHARACTER])).rows[0].cash),
    omr: Number((await pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [ACCOUNT],
    )).rows[0].omr),
    transactions: await count('SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [CHARACTER]),
  };
  assert.deepEqual(moneyAfter, moneyBefore,
    'mystery conditions/effects cannot move cash, OMR, or the transaction ledger');

  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [CHARACTER]);
  await pool.query(
    `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
     VALUES ('mystery-heir',$1,'Mystery Heir',1,'foundry',0,0)`,
    [ACCOUNT],
  );
  assert.deepEqual(await act(
    completeNode, OWNER, GRAPH_ID, 'm:award', { idempotencyKey: 'm-award-1' },
  ), award, 'guard replay occurs before replacement-character eligibility is loaded');

  const unsafeRegistry = loadAndValidateGraphPackages([corePackage, Object.freeze({
    id: 'unsafe-mystery', version: 1, season: 'core', dependsOn: Object.freeze([]),
    nodes: Object.freeze([Object.freeze({
      id: 'm:unsafe', type: 'mystery_step', visibility: 'public',
      effects: Object.freeze([Object.freeze({ adapter: 'cash', amount: 1000 })]),
    })]),
  })]);
  assert.throws(
    () => createMysteryContext({ registry: unsafeRegistry, accountId: ACCOUNT, now: NOW }),
    (error) => error?.code === 'unsupported_mystery_effect',
    'content cannot smuggle cash, OMR, SQL, or arbitrary execution through an effect',
  );

  for (const adapter of ['discover', 'complete']) {
    const choiceEffectRegistry = loadAndValidateGraphPackages([Object.freeze({
      id: `choice-effect-mystery-${adapter}`,
      version: 1,
      season: 'core',
      dependsOn: Object.freeze([]),
      nodes: Object.freeze([
        Object.freeze({
          id: `m:choice-effect-${adapter}`, type: 'mystery_step', visibility: 'public',
          effects: Object.freeze([
            Object.freeze({ adapter, nodeId: `choice:forbidden-target-${adapter}` }),
          ]),
        }),
        Object.freeze({
          id: `choice:forbidden-target-${adapter}`, type: 'choice', visibility: 'public',
          options: Object.freeze([Object.freeze({ id: 'one' })]),
        }),
      ]),
    })]);
    assert.throws(
      () => createMysteryContext({ registry: choiceEffectRegistry, accountId: ACCOUNT, now: NOW }),
      (error) => error?.code === 'bad_mystery_effect',
      `${adapter} effects cannot bypass commitChoice to complete choice nodes`,
    );
  }

  for (const [adapter, targetType, targetMetadata] of [
    ['discover', 'mystery_step', {}],
    ['complete', 'mystery_step', {}],
    ['evidence_grant', 'evidence', {}],
    ['status_award', 'reward', { inert: true, rewardType: 'status' }],
  ]) {
    const rolePrivateEffectRegistry = loadAndValidateGraphPackages([Object.freeze({
      id: `role-private-effect-mystery-${adapter}`,
      version: 1,
      season: 'core',
      dependsOn: Object.freeze([]),
      nodes: Object.freeze([
        Object.freeze({
          id: `m:role-private-effect-${adapter}`, type: 'mystery_step', visibility: 'public',
          effects: Object.freeze([Object.freeze({
            adapter, nodeId: `target:role-private-${adapter}`,
          })]),
        }),
        Object.freeze({
          id: `target:role-private-${adapter}`, type: targetType, visibility: 'role_private',
          metadata: Object.freeze(targetMetadata),
        }),
      ]),
    })]);
    assert.throws(
      () => createMysteryContext({
        registry: rolePrivateEffectRegistry, accountId: ACCOUNT, now: NOW,
      }),
      (error) => error?.code === 'bad_mystery_effect',
      `${adapter} cannot smuggle Task 6 role-private graph-state authority into Task 5`,
    );
  }

  const terminalEffectRegistry = loadAndValidateGraphPackages([Object.freeze({
    id: 'terminal-effect-mystery',
    version: 1,
    season: 'core',
    dependsOn: Object.freeze([]),
    nodes: Object.freeze([
      Object.freeze({
        id: 'm:terminal-effect-source', type: 'mystery_step', visibility: 'public',
        effects: Object.freeze([Object.freeze({
          adapter: 'complete', nodeId: 'm:terminal-effect-target',
        })]),
      }),
      Object.freeze({
        id: 'm:terminal-effect-target', type: 'mystery_step', visibility: 'public',
        metadata: Object.freeze({ terminal: true }),
      }),
    ]),
  })]);
  assert.throws(
    () => createMysteryContext({
      registry: terminalEffectRegistry, accountId: ACCOUNT, now: NOW,
    }),
    (error) => error?.code === 'bad_mystery_effect',
    'a generic complete effect cannot pre-complete a terminal while leaving the instance active',
  );

  const invalidTerminalRegistry = loadAndValidateGraphPackages([Object.freeze({
    id: 'invalid-terminal-mystery',
    version: 1,
    season: 'core',
    dependsOn: Object.freeze([]),
    nodes: Object.freeze([Object.freeze({
      id: 'choice:invalid-terminal', type: 'choice', visibility: 'public',
      metadata: Object.freeze({ terminal: true }),
      options: Object.freeze([Object.freeze({ id: 'one' })]),
    })]),
  })]);
  assert.throws(
    () => createMysteryContext({
      registry: invalidTerminalRegistry, accountId: ACCOUNT, now: NOW,
    }),
    (error) => error?.code === 'bad_mystery_terminal',
    'only an explicit terminal action node may close a mystery and release escrow',
  );

  console.log('✓ data-defined mystery runtime passed');
} finally {
  await pool.end();
}
