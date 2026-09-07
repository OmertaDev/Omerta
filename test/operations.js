// Phase 1 four-account social operations: server-derived Crew authority, account-distinct roles,
// asymmetric evidence, ordered contributions, conserved escrow, convergence, and closed-state safety.
import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import { CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import {
  createItem,
  grantStack,
  inventoryBoard,
  withItemTransaction,
} from '../src/items.js';
import {
  assignRole,
  cancelOperation,
  completeOperation,
  contribute,
  createOperationContext,
  openOperation,
  operationBoard,
  operationDefinitions,
  roleBoard,
} from '../src/operations.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { loadGraphPackages } from '../src/worldgraph.js';

const ACCOUNTS = ['op-account-1', 'op-account-2', 'op-account-3', 'op-account-4'];
const CHARACTERS = ['op-character-1', 'op-character-2', 'op-character-3', 'op-character-4'];
const ROLES = ['investigator', 'driver', 'mechanic', 'enforcer'];
const GRAPH_ID = 'test-social-operation';
const CREW_ID = 'internal-crew-never-publish';

const roles = () => ROLES.map((id) => Object.freeze({
  id, distinct: true,
  ...(id === 'mechanic' ? { conditions: Object.freeze([
    Object.freeze({ adapter: 'skill', skillId: 'fence_network' }),
  ]) } : {}),
}));

const core = Object.freeze({
  id: 'test-operation-core', version: 1, season: 'core', dependsOn: Object.freeze([]),
  nodes: Object.freeze([
    Object.freeze({
      id: 'item:operation_tool', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'item:missing_operation_tool', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'item:operation_artifact', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'item:mechanic_artifact', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'item:operation_alias_investigator', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'item:operation_alias_driver', type: 'item_template', visibility: 'hidden',
      metadata: Object.freeze({ inventoryClass: 'unique' }),
    }),
    Object.freeze({
      id: 'mat:operation_condition', type: 'material', visibility: 'public',
      metadata: Object.freeze({ inventoryClass: 'stack' }),
    }),
    Object.freeze({
      id: 'source:operation_items', type: 'source', visibility: 'public',
      produces: Object.freeze([
        Object.freeze({ templateId: 'item:operation_tool', quantity: 1 }),
        Object.freeze({ templateId: 'item:missing_operation_tool', quantity: 1 }),
        Object.freeze({ templateId: 'item:operation_artifact', quantity: 1 }),
        Object.freeze({ templateId: 'item:mechanic_artifact', quantity: 1 }),
        Object.freeze({ templateId: 'item:operation_alias_investigator', quantity: 1 }),
        Object.freeze({ templateId: 'item:operation_alias_driver', quantity: 1 }),
        Object.freeze({ templateId: 'mat:operation_condition', quantity: 1 }),
      ]),
    }),
  ]),
});

const mainSteps = Object.freeze([
  Object.freeze({
    id: 'op:investigate', type: 'operation_step', visibility: 'role_private',
    requires: Object.freeze(['op:lockbox']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'investigator', order: 1 }),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'explicit_interaction', interactionId: 'read_cipher' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'evidence_grant', nodeId: 'evidence:investigator' }),
      Object.freeze({ adapter: 'evidence_grant', nodeId: 'evidence:shared' }),
    ]),
  }),
  Object.freeze({
    id: 'op:mechanic', type: 'operation_step', visibility: 'role_private',
    requires: Object.freeze(['op:lockbox', 'op:investigate']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'mechanic', order: 2 }),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'item_ownership', templateId: 'item:operation_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:operation_tool' }),
      Object.freeze({ adapter: 'evidence_grant', nodeId: 'evidence:mechanic' }),
    ]),
  }),
  Object.freeze({
    id: 'op:drive', type: 'operation_step', visibility: 'public',
    requires: Object.freeze(['op:lockbox', 'op:mechanic']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'driver', order: 3 }),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'graph_dependency', nodeId: 'op:mechanic' }),
      Object.freeze({ adapter: 'evidence', evidenceId: 'evidence:shared' }),
    ]),
  }),
  Object.freeze({
    id: 'op:enforce', type: 'operation_step', visibility: 'public',
    requires: Object.freeze(['op:lockbox', 'op:drive']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'enforcer', order: 4 }),
    conditions: Object.freeze([
      Object.freeze({ adapter: 'item_ownership', templateId: 'item:operation_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:operation_tool' }),
    ]),
  }),
  Object.freeze({
    id: 'op:rollback', type: 'operation_step', visibility: 'role_private',
    requires: Object.freeze(['op:lockbox']),
    metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'mechanic' }),
    effects: Object.freeze([
      Object.freeze({ adapter: 'evidence_grant', nodeId: 'evidence:rollback' }),
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:missing_operation_tool' }),
    ]),
  }),
]);

const deathSteps = Object.freeze(ROLES.map((roleId, index) => Object.freeze({
  id: `death:${roleId}`, type: 'operation_step',
  visibility: roleId === 'mechanic' ? 'role_private' : 'public',
  requires: Object.freeze(['op:death-test']),
  metadata: Object.freeze({ operationId: 'op:death-test', roleId, order: index + 1 }),
  ...(roleId === 'investigator' ? {
    conditions: Object.freeze([
      Object.freeze({ adapter: 'item_ownership', templateId: 'item:operation_tool' }),
    ]),
    effects: Object.freeze([
      Object.freeze({ adapter: 'item_escrow', templateId: 'item:operation_tool' }),
    ]),
  } : {}),
})));

const social = Object.freeze({
  id: GRAPH_ID, version: 1, season: 'core', dependsOn: Object.freeze(['test-operation-core']),
  nodes: Object.freeze([
    Object.freeze({ id: 'm:operation-unlock', type: 'mystery_step', visibility: 'public' }),
    Object.freeze({ id: 'm:operation-block', type: 'mystery_step', visibility: 'public' }),
    Object.freeze({ id: 'm:operation-route-a', type: 'mystery_step', visibility: 'public' }),
    Object.freeze({ id: 'm:operation-route-b', type: 'mystery_step', visibility: 'public' }),
    Object.freeze({
      id: 'op:lockbox', type: 'social_gate', visibility: 'public',
      requires: Object.freeze(['m:operation-unlock']),
      requiresAny: Object.freeze([Object.freeze([
        'm:operation-route-a', 'm:operation-route-b',
      ])]),
      excludes: Object.freeze(['m:operation-block']),
      minimumDistinctAccounts: 4, roles: Object.freeze(roles()),
      metadata: Object.freeze({
        phase1Proof: true,
        closerRoleId: 'investigator',
        mysteryGate: Object.freeze({
          graphId: GRAPH_ID, graphVersion: 1, ownerScope: 'account', requiredStatus: 'completed',
        }),
        completionRequires: Object.freeze(['op:investigate', 'op:mechanic', 'op:drive', 'op:enforce']),
      }),
      effects: Object.freeze([
        Object.freeze({
          adapter: 'unique_item_award', templateId: 'item:operation_artifact',
          recipientRoleId: 'investigator',
        }),
        Object.freeze({
          adapter: 'unique_item_award', templateId: 'item:mechanic_artifact',
          recipientRoleId: 'mechanic',
        }),
        Object.freeze({ adapter: 'status_award', nodeId: 'reward:operation_status' }),
      ]),
    }),
    ...mainSteps,
    Object.freeze({
      id: 'op:hidden-decoy', type: 'operation_step', visibility: 'hidden',
      requires: Object.freeze(['op:lockbox']),
      metadata: Object.freeze({ operationId: 'op:lockbox', roleId: 'investigator' }),
    }),
    Object.freeze({
      id: 'evidence:investigator', type: 'evidence', visibility: 'role_private',
      requires: Object.freeze(['op:investigate']),
      metadata: Object.freeze({
        operationId: 'op:lockbox', roleId: 'investigator', privateEvidence: 'violet ledger',
      }),
    }),
    Object.freeze({
      id: 'evidence:shared', type: 'evidence', visibility: 'public',
      requires: Object.freeze(['op:investigate']),
      metadata: Object.freeze({ operationId: 'op:lockbox' }),
    }),
    Object.freeze({
      id: 'evidence:mechanic', type: 'evidence', visibility: 'role_private',
      requires: Object.freeze(['op:mechanic']),
      metadata: Object.freeze({
        operationId: 'op:lockbox', roleId: 'mechanic', privateEvidence: 'reversed tumblers',
      }),
    }),
    Object.freeze({
      id: 'evidence:rollback', type: 'evidence', visibility: 'role_private',
      requires: Object.freeze(['op:rollback']),
      metadata: Object.freeze({
        operationId: 'op:lockbox', roleId: 'mechanic', privateEvidence: 'must roll back',
      }),
    }),
    Object.freeze({
      id: 'reward:operation_status', type: 'reward', visibility: 'hidden',
      requires: Object.freeze(['op:lockbox']),
      metadata: Object.freeze({
        operationId: 'op:lockbox', inert: true, rewardType: 'status', title: 'Lockbox Witness',
      }),
    }),
    Object.freeze({
      id: 'op:death-test', type: 'social_gate', visibility: 'public',
      minimumDistinctAccounts: 4, roles: Object.freeze(roles()),
      metadata: Object.freeze({
        phase1Proof: true,
        closerRoleId: 'investigator',
        completionRequires: Object.freeze(ROLES.map((roleId) => `death:${roleId}`)),
      }),
    }),
    ...deathSteps,
    Object.freeze({
      id: 'op:cancel-test', type: 'social_gate', visibility: 'public',
      minimumDistinctAccounts: 4, roles: Object.freeze(roles()),
      metadata: Object.freeze({
        phase1Proof: true,
        closerRoleId: 'investigator',
        completionRequires: Object.freeze(ROLES.map((roleId) => `cancel:${roleId}`)),
      }),
    }),
    ...ROLES.map((roleId, index) => Object.freeze({
      id: `cancel:${roleId}`, type: 'operation_step', visibility: 'public',
      requires: Object.freeze(['op:cancel-test']),
      metadata: Object.freeze({ operationId: 'op:cancel-test', roleId, order: index + 1 }),
    })),
    Object.freeze({
      id: 'op:cancel-recovery', type: 'social_gate', visibility: 'public',
      minimumDistinctAccounts: 4, roles: Object.freeze(roles()),
      metadata: Object.freeze({
        phase1Proof: true,
        closerRoleId: 'investigator',
        completionRequires: Object.freeze(ROLES.map((roleId) => `recovery:${roleId}`)),
      }),
    }),
    ...ROLES.map((roleId, index) => Object.freeze({
      id: `recovery:${roleId}`, type: 'operation_step', visibility: 'public',
      requires: Object.freeze(['op:cancel-recovery']),
      metadata: Object.freeze({
        operationId: 'op:cancel-recovery', roleId, order: index + 1,
      }),
      ...(['investigator', 'mechanic'].includes(roleId) ? {
        conditions: Object.freeze([Object.freeze({
          adapter: 'item_ownership', templateId: 'item:operation_tool',
        })]),
        effects: Object.freeze([Object.freeze({
          adapter: 'item_escrow', templateId: 'item:operation_tool',
        })]),
      } : {}),
    })),
    Object.freeze({
      id: 'op:version-recovery', type: 'social_gate', visibility: 'public',
      minimumDistinctAccounts: 4, roles: Object.freeze(roles()),
      metadata: Object.freeze({
        phase1Proof: true,
        closerRoleId: 'investigator',
        completionRequires: Object.freeze(ROLES.map((roleId) => `version:${roleId}`)),
      }),
      effects: Object.freeze([Object.freeze({
        adapter: 'unique_item_award', templateId: 'item:operation_artifact',
        recipientRoleId: 'investigator',
      })]),
    }),
    ...ROLES.map((roleId, index) => Object.freeze({
      id: `version:${roleId}`, type: 'operation_step', visibility: 'public',
      requires: Object.freeze(['op:version-recovery']),
      metadata: Object.freeze({
        operationId: 'op:version-recovery', roleId, order: index + 1,
      }),
      ...(roleId === 'investigator' ? {
        conditions: Object.freeze([Object.freeze({
          adapter: 'item_ownership', templateId: 'item:operation_tool',
        })]),
        effects: Object.freeze([Object.freeze({
          adapter: 'item_escrow', templateId: 'item:operation_tool',
        })]),
      } : {}),
    })),
    Object.freeze({
      id: 'op:condition-aliases', type: 'social_gate', visibility: 'public',
      metadata: Object.freeze({
        phase1Proof: true,
        minimumDistinctAccounts: 4,
        roles: Object.freeze(roles()),
        closerRoleId: 'investigator',
        completionRequires: Object.freeze(ROLES.map((roleId) => `aliases:${roleId}`)),
      }),
    }),
    ...[
      ['investigator', Object.freeze({
        adapter: 'item_ownership', itemTemplateId: 'item:operation_alias_investigator',
      })],
      ['driver', Object.freeze({
        adapter: 'owns_item', nodeId: 'item:operation_alias_driver',
      })],
      ['mechanic', Object.freeze({
        adapter: 'material_quantity', materialId: 'mat:operation_condition',
        minimumQuantity: 2,
      })],
      ['enforcer', Object.freeze({
        adapter: 'material_quantity', nodeId: 'mat:operation_condition', amount: 3,
      })],
    ].map(([roleId, condition], index) => Object.freeze({
      id: `aliases:${roleId}`, type: 'operation_step', visibility: 'public',
      requires: Object.freeze(['op:condition-aliases']),
      conditions: Object.freeze([condition]),
      metadata: Object.freeze({
        operationId: 'op:condition-aliases', roleId, order: index + 1,
      }),
    })),
    Object.freeze({
      id: 'gate:public-non-operation', type: 'social_gate', visibility: 'public',
      metadata: Object.freeze({ title: 'A public graph gate, not an operation' }),
    }),
    Object.freeze({
      id: 'op:different-vocabulary', type: 'social_gate', visibility: 'public',
      minimumDistinctAccounts: 2,
      roles: Object.freeze([
        Object.freeze({ id: 'chemist', distinct: true }),
        Object.freeze({ id: 'lookout', distinct: true }),
      ]),
      metadata: Object.freeze({
        closerRoleId: 'chemist',
        completionRequires: Object.freeze(['different:chemist', 'different:lookout']),
      }),
    }),
    Object.freeze({
      id: 'different:chemist', type: 'operation_step', visibility: 'role_private',
      requires: Object.freeze(['op:different-vocabulary']),
      metadata: Object.freeze({
        operationId: 'op:different-vocabulary', roleId: 'chemist', order: 1,
      }),
    }),
    Object.freeze({
      id: 'different:lookout', type: 'operation_step', visibility: 'public',
      requires: Object.freeze(['op:different-vocabulary', 'different:chemist']),
      metadata: Object.freeze({
        operationId: 'op:different-vocabulary', roleId: 'lookout', order: 2,
      }),
    }),
    Object.freeze({
      id: 'op:crew-change-vocabulary', type: 'social_gate', visibility: 'public',
      minimumDistinctAccounts: 2,
      roles: Object.freeze([
        Object.freeze({ id: 'analyst', distinct: true }),
        Object.freeze({ id: 'tail', distinct: true }),
      ]),
      metadata: Object.freeze({
        closerRoleId: 'analyst',
        completionRequires: Object.freeze(['crewchange:analyst', 'crewchange:tail']),
      }),
    }),
    Object.freeze({
      id: 'crewchange:analyst', type: 'operation_step', visibility: 'role_private',
      requires: Object.freeze(['op:crew-change-vocabulary']),
      metadata: Object.freeze({
        operationId: 'op:crew-change-vocabulary', roleId: 'analyst', order: 1,
      }),
    }),
    Object.freeze({
      id: 'crewchange:tail', type: 'operation_step', visibility: 'public',
      requires: Object.freeze(['op:crew-change-vocabulary', 'crewchange:analyst']),
      metadata: Object.freeze({
        operationId: 'op:crew-change-vocabulary', roleId: 'tail', order: 2,
      }),
    }),
  ]),
});

const registry = loadAndValidateGraphPackages([core, social]);
const discoverableDefinitions = operationDefinitions(registry, { publicOnly: true });
assert.equal(discoverableDefinitions.some(({ root }) => root.id === 'gate:public-non-operation'), false,
  'public social gates without operation roles are excluded from operation discovery');
const metadataDefinition = discoverableDefinitions
  .find(({ root }) => root.id === 'op:condition-aliases');
assert.equal(metadataDefinition.minimumDistinctAccounts, 4);
assert.deepEqual(metadataDefinition.roles.map(({ id }) => id), ROLES,
  'metadata role/minimum aliases normalize identically for discovery and runtime');
const socialV2 = structuredClone(social);
socialV2.version = 2;
socialV2.nodes.find(({ id }) => id === 'op:lockbox').metadata.mysteryGate.graphVersion = 2;
const versionTwoRegistry = loadAndValidateGraphPackages([core, socialV2]);
const ignoredLifecycleOperationPackage = structuredClone(social);
ignoredLifecycleOperationPackage.nodes
  .find(({ id }) => id === 'op:lockbox').failureRules = { onFailure: 'retry' };
assert.throws(
  () => createOperationContext({
    registry: loadGraphPackages([core, ignoredLifecycleOperationPackage]),
    accountId: ACCOUNTS[0],
  }),
  (error) => error?.code === 'unsupported_operation_semantics',
  'the request-time operation context shares the release gate for ignored lifecycle authority',
);
const crossOperationPackage = structuredClone(social);
crossOperationPackage.nodes.find(({ id }) => id === 'evidence:investigator').metadata.operationId =
  'op:death-test';
const crossOperationRegistry = loadGraphPackages([core, crossOperationPackage]);
assert.throws(
  () => createOperationContext({ registry: crossOperationRegistry, accountId: ACCOUNTS[0] }),
  (error) => error?.code === 'bad_operation_effect',
  'an effect cannot mutate a role-private node scoped to another operation in the package',
);
const orphanPrivatePackage = structuredClone(social);
const orphanPrivate = structuredClone(
  orphanPrivatePackage.nodes.find(({ id }) => id === 'evidence:investigator'),
);
orphanPrivate.id = 'evidence:orphan-private';
delete orphanPrivate.metadata.operationId;
orphanPrivatePackage.nodes.push(orphanPrivate);
assert.throws(
  () => createOperationContext({
    registry: loadGraphPackages([core, orphanPrivatePackage]), accountId: ACCOUNTS[0],
  }),
  (error) => error?.code === 'bad_operation_definition',
  'a role-private graph-state node cannot omit its owning operation in a multi-operation package',
);
assert.throws(
  () => createOperationContext({
    registry: Object.freeze({ byPackage: new Map(), nodes: new Map() }),
    accountId: ACCOUNTS[0],
  }),
  (error) => error?.code === 'bad_operation_context',
  'a frozen wrapper around caller-mutable Maps cannot forge graph authority',
);
const contexts = ACCOUNTS.map((accountId) => createOperationContext({
  registry, accountId, now: '2026-09-03T20:00:00.000Z',
}));
const versionTwoContexts = ACCOUNTS.map((accountId) => createOperationContext({
  registry: versionTwoRegistry, accountId, now: '2026-09-03T20:00:00.000Z',
}));
const pool = await makeDb();
const tx = (action) => withItemTransaction(pool, action);
const act = (index, fn, ...args) => tx((client) => fn(client, contexts[index], ...args));
const actV2 = (index, fn, ...args) => tx((client) => fn(client, versionTwoContexts[index], ...args));
const count = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].n);
const safeJson = (value) => JSON.stringify(value);
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
    `INSERT INTO crews (id,name,leader_account) VALUES ($1,'Operation Crew',$2)`,
    [CREW_ID, ACCOUNTS[0]],
  );
  for (let index = 0; index < ACCOUNTS.length; index += 1) {
    await pool.query(
      `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
       VALUES ($1,$2,$3,1,'docks',10000,$4)`,
      [CHARACTERS[index], ACCOUNTS[index], `Operator ${index + 1}`, 7000 + index],
    );
    await pool.query(
      'INSERT INTO account_persistent (account_id,omr) VALUES ($1,$2)',
      [ACCOUNTS[index], 900 + index],
    );
    await pool.query(
      'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
      [CREW_ID, ACCOUNTS[index], `Operator ${index + 1}`],
    );
  }
  await pool.query(
    "INSERT INTO character_skills (character_id,skill_id) VALUES ($1,'fence_network')",
    [CHARACTERS[2]],
  );

  const crewWrapperTrace = [];
  await withItemTransaction(tracingPool(crewWrapperTrace), async (client) => {
    const crewId = await CREW_FIRST_CHARACTER_LOCKS.beforeCharacterLock(client, ACCOUNTS[0]);
    const character = (await client.query(
      'SELECT * FROM characters WHERE account_id = $1 AND alive FOR UPDATE', [ACCOUNTS[0]],
    )).rows[0];
    await client.query(
      'SELECT * FROM account_persistent WHERE account_id = $1 FOR UPDATE', [ACCOUNTS[0]],
    );
    await CREW_FIRST_CHARACTER_LOCKS.afterAccountLock(
      client, ACCOUNTS[0], character, crewId,
    );
  });
  const crewWrapperCrew = crewWrapperTrace.findIndex((sql) => (
    /FROM crews WHERE id=\$1 FOR UPDATE/i.test(sql)
  ));
  const crewWrapperCharacter = crewWrapperTrace.findIndex((sql) => (
    /FROM characters WHERE account_id = \$1 AND alive FOR UPDATE/i.test(sql)
  ));
  const crewWrapperAccount = crewWrapperTrace.findIndex((sql) => (
    /FROM account_persistent WHERE account_id = \$1 FOR UPDATE/i.test(sql)
  ));
  const crewWrapperMembership = crewWrapperTrace.findIndex((sql) => (
    /FROM crew_members WHERE account_id=\$1 FOR UPDATE/i.test(sql)
  ));
  assert(crewWrapperCrew >= 0 && crewWrapperCharacter > crewWrapperCrew
    && crewWrapperAccount > crewWrapperCharacter && crewWrapperMembership > crewWrapperAccount,
  'Crew mutation wrapper locks Crew, character, account, then membership');

  const moneyBefore = await Promise.all(ACCOUNTS.map(async (accountId, index) => ({
    cash: Number((await pool.query(
      'SELECT cash FROM characters WHERE id=$1', [CHARACTERS[index]],
    )).rows[0].cash),
    omr: Number((await pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [accountId],
    )).rows[0].omr),
  })));
  const transactionsBefore = await count('SELECT COUNT(*) AS n FROM transactions');

  await assert.rejects(
    act(0, openOperation, GRAPH_ID, 'op:lockbox', 1, 'op-open-without-mystery'),
    (error) => error?.code === 'operation_locked',
    'an operation cannot trust client intent in place of an authenticated mystery instance',
  );
  await pool.query(
    `INSERT INTO mystery_instances
       (id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,status,completed_at)
     VALUES ('operation-bridge-mystery','account',$1,$1,$2,2,'completed',now())`,
    [ACCOUNTS[0], GRAPH_ID],
  );
  await assert.rejects(
    act(0, openOperation, GRAPH_ID, 'op:lockbox', 1, 'op-open-wrong-mystery-version'),
    (error) => error?.code === 'operation_locked',
    'an old or future Task 5 instance cannot satisfy an exact graph-version bridge',
  );
  await pool.query(
    `UPDATE mystery_instances SET graph_version=1,status='active',completed_at=NULL
      WHERE id='operation-bridge-mystery'`,
  );
  await pool.query(
    `INSERT INTO mystery_node_state
       (instance_id,node_id,state,discovered_at,completed_at)
     VALUES ('operation-bridge-mystery','m:operation-unlock','completed',now(),now())`,
  );
  await assert.rejects(
    act(0, openOperation, GRAPH_ID, 'op:lockbox', 1, 'op-open-wrong-mystery-status'),
    (error) => error?.code === 'operation_locked',
    'the bridge enforces its exact graph-pinned Task 5 status',
  );
  await pool.query(
    `UPDATE mystery_instances SET status='completed',completed_at=now()
      WHERE id='operation-bridge-mystery'`,
  );
  await assert.rejects(
    act(0, openOperation, GRAPH_ID, 'op:lockbox', 1, 'op-open-or-group-unmet'),
    (error) => error?.code === 'operation_locked',
    'every Task 5 requiresAny group needs a server-completed alternative',
  );
  await pool.query(
    `INSERT INTO mystery_node_state
       (instance_id,node_id,state,discovered_at,completed_at)
     VALUES ('operation-bridge-mystery','m:operation-route-b','completed',now(),now())`,
  );
  await pool.query(
    `INSERT INTO mystery_node_state
       (instance_id,node_id,state,discovered_at,completed_at)
     VALUES ('operation-bridge-mystery','m:operation-block','completed',now(),now())`,
  );
  await assert.rejects(
    act(0, openOperation, GRAPH_ID, 'op:lockbox', 1, 'op-open-excluded-mystery'),
    (error) => error?.code === 'operation_excluded',
    'a committed excluded mystery branch closes the social operation gate',
  );
  await pool.query(
    `DELETE FROM mystery_node_state
      WHERE instance_id='operation-bridge-mystery' AND node_id='m:operation-block'`,
  );
  const opened = await act(0, openOperation, GRAPH_ID, 'op:lockbox', 1, 'op-open-main');
  assert.equal(opened.status, 'forming');
  assert(!safeJson(opened).includes(CREW_ID));
  assert(!ACCOUNTS.some((id) => safeJson(opened).includes(id)));

  const firstAssignment = await act(0, assignRole, opened.operationId, 'investigator', {
    idempotencyKey: 'op-assign-investigator',
  });
  assert.equal(firstAssignment.assignment.roleId, 'investigator');
  await assert.rejects(
    act(0, assignRole, opened.operationId, 'driver', { idempotencyKey: 'op-same-account-twice' }),
    (error) => error?.code === 'operation_distinct_account',
  );
  await assert.rejects(
    act(0, contribute, opened.operationId, 'op:investigate', {
      idempotencyKey: 'op-contribute-too-early', interactionId: 'read_cipher',
    }),
    (error) => error?.code === 'operation_not_active',
  );
  await act(1, assignRole, opened.operationId, 'driver', { idempotencyKey: 'op-assign-driver' });
  await act(2, assignRole, opened.operationId, 'mechanic', { idempotencyKey: 'op-assign-mechanic' });
  const activated = await act(3, assignRole, opened.operationId, 'enforcer', {
    idempotencyKey: 'op-assign-enforcer',
  });
  assert.equal(activated.status, 'active');
  assert.deepEqual(
    await act(0, assignRole, opened.operationId, 'investigator', {
      idempotencyKey: 'op-assign-investigator',
    }),
    firstAssignment,
    'role assignment replay remains exact after the other three accounts join',
  );
  assert.equal(await count(
    'SELECT COUNT(DISTINCT account_id) AS n FROM world_operation_roles WHERE operation_id=$1',
    [opened.operationId],
  ), 4, 'storage holds four distinct accounts');

  const publicBefore = await operationBoard(pool, contexts[0], opened.operationId);
  assert.equal(publicBefore.filledRoleCount, 4);
  assert(!safeJson(publicBefore).includes('op:investigate'));
  assert(!safeJson(publicBefore).includes('op:mechanic'));
  assert(!safeJson(publicBefore).includes('evidence:investigator'));
  assert(!safeJson(publicBefore).includes('evidence:mechanic'));
  assert(!safeJson(publicBefore).includes(CREW_ID));
  assert(!ACCOUNTS.some((id) => safeJson(publicBefore).includes(id)));

  const investigatorBefore = await roleBoard(pool, contexts[0], opened.operationId);
  assert(investigatorBefore.nodes.some(({ id }) => id === 'op:investigate'));
  assert(!investigatorBefore.nodes.some(({ id }) => id === 'op:mechanic'));
  const unavailableErrors = [];
  for (const candidate of ['op:does-not-exist', 'op:hidden-decoy', 'op:mechanic']) {
    try {
      await act(0, contribute, opened.operationId, candidate, {
        idempotencyKey: 'op-private-oracle-shared-key',
      });
      assert.fail('unavailable contribution unexpectedly executed');
    } catch (error) {
      unavailableErrors.push({ code: error.code, message: error.message });
    }
  }
  assert.deepEqual(unavailableErrors, [
    unavailableErrors[0], unavailableErrors[0], unavailableErrors[0],
  ],
    'nonexistent, hidden, and another role private contribution are indistinguishable');
  await assert.rejects(
    act(1, contribute, opened.operationId, 'op:investigate', {
      idempotencyKey: 'op-wrong-role', interactionId: 'read_cipher',
    }),
    (error) => error?.code === 'operation_step_unavailable',
  );
  await assert.rejects(
    act(2, contribute, opened.operationId, 'op:mechanic', {
      idempotencyKey: 'op-out-of-order',
    }),
    (error) => error?.code === 'operation_prerequisite' || error?.code === 'operation_order',
  );

  await act(0, contribute, opened.operationId, 'op:investigate', {
    idempotencyKey: 'op-contribute-investigator', interactionId: 'read_cipher',
  });
  const investigatorPrivate = await roleBoard(pool, contexts[0], opened.operationId);
  assert(investigatorPrivate.nodes.some(({ id }) => id === 'evidence:investigator'));
  assert(!investigatorPrivate.nodes.some(({ id }) => id === 'evidence:mechanic'));
  const mechanicPrivate = await roleBoard(pool, contexts[2], opened.operationId);
  assert(!mechanicPrivate.nodes.some(({ id }) => id === 'evidence:investigator'));
  assert(mechanicPrivate.nodes.some(({ id }) => id === 'op:mechanic'));

  await assert.rejects(
    act(2, contribute, opened.operationId, 'op:mechanic', {
      idempotencyKey: 'op-mechanic-no-item',
    }),
    (error) => error?.code === 'item_unavailable',
  );
  const tool = await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[2] }, 'item:operation_tool',
    'crafted', 'op-seed-tool-main',
  ));
  const mechanicContribution = await act(2, contribute, opened.operationId, 'op:mechanic', {
    idempotencyKey: 'op-contribute-mechanic',
  });
  assert.equal(mechanicContribution.effects[0].item.state, 'escrowed');
  assert(!safeJson(mechanicContribution).includes(ACCOUNTS[2]));
  await act(2, contribute, opened.operationId, 'op:mechanic', {
    idempotencyKey: 'op-contribute-mechanic',
  });
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [opened.operationId],
  ), 1, 'replay cannot duplicate operation custody');

  await act(1, contribute, opened.operationId, 'op:drive', {
    idempotencyKey: 'op-contribute-driver',
  });
  await assert.rejects(
    act(0, completeOperation, opened.operationId, { idempotencyKey: 'op-complete-early' }),
    (error) => error?.code === 'operation_incomplete',
  );
  const enforcerTool = await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[3] }, 'item:operation_tool',
    'crafted', 'op-seed-tool-enforcer',
  ));
  await act(3, contribute, opened.operationId, 'op:enforce', {
    idempotencyKey: 'op-contribute-enforcer',
  });

  let releasePausedFailure;
  let reportPausedFailure;
  const pausedFailureReached = new Promise((resolve) => { reportPausedFailure = resolve; });
  const pausedFailureRelease = new Promise((resolve) => { releasePausedFailure = resolve; });
  const aliasPool = {
    async connect() {
      const inner = await pool.connect();
      return new Proxy(inner, {
        get(target, property) {
          if (property === 'query') return async (sql, params) => {
            if (/SELECT id FROM item_instances/i.test(String(sql))
              && params?.includes('item:missing_operation_tool')) {
              reportPausedFailure();
              await pausedFailureRelease;
            }
            return target.query(sql, params);
          };
          const value = target[property];
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
  };
  const pausedFailure = withItemTransaction(aliasPool, (client) => contribute(
    client, contexts[2], opened.operationId, 'op:rollback', {
      idempotencyKey: 'op-contribute-rollback',
    },
  ));
  await pausedFailureReached;
  let boardSettled = false;
  const boardDuringFailure = roleBoard(pool, contexts[2], opened.operationId)
    .then((value) => { boardSettled = true; return value; });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(boardSettled, false,
    'operation boards share the item transaction read barrier across pool aliases');
  releasePausedFailure();
  await assert.rejects(pausedFailure, (error) => error?.code === 'item_unavailable');
  const compensatedBoard = await boardDuringFailure;
  assert(!compensatedBoard.nodes.some(({ id }) => id === 'evidence:rollback'),
    'the board resumes only after the partial operation write is compensated');
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM world_operation_node_state WHERE operation_id=$1 AND node_id='evidence:rollback'",
    [opened.operationId],
  ), 0, 'a late failed effect rolls back earlier operation state under pg-mem');

  await assert.rejects(
    act(1, completeOperation, opened.operationId, { idempotencyKey: 'op-wrong-closer' }),
    (error) => error?.code === 'operation_completion_role',
  );
  const [closeOne, closeTwo] = await Promise.all([
    act(0, completeOperation, opened.operationId, { idempotencyKey: 'op-complete-main-a' }),
    act(0, completeOperation, opened.operationId, { idempotencyKey: 'op-complete-main-b' }),
  ]);
  assert.equal(closeOne.status, 'completed');
  assert.equal(closeTwo.status, 'completed');
  assert.equal(closeOne.releasedEscrowCount + closeTwo.releasedEscrowCount, 2);
  assert(!safeJson(closeOne).includes(CREW_ID));
  assert(!ACCOUNTS.some((id) => safeJson(closeOne).includes(id)));
  assert(!safeJson(closeOne).includes('reward:operation_status'));
  assert(!safeJson(closeOne).includes('item:operation_artifact'));
  assert(!safeJson(closeOne).includes('item:mechanic_artifact'));
  const investigatorInventory = await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[0] });
  assert.equal(investigatorInventory.items.filter(
    ({ templateId }) => templateId === 'item:operation_artifact',
  ).length, 1, 'concurrent completion awards exactly one artifact');
  const mechanicInventory = await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[2] });
  assert(mechanicInventory.items.some(({ id, state }) => id === tool.id && state === 'active'),
    'terminal convergence returns contributed escrow to its depositor');
  assert.equal(mechanicInventory.items.filter(
    ({ templateId }) => templateId === 'item:mechanic_artifact',
  ).length, 1, 'completion distributes a second reward to its graph-declared role recipient');
  const enforcerInventory = await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[3] });
  assert(enforcerInventory.items.some(({ id, state }) => id === enforcerTool.id && state === 'active'),
    'one operation can conserve and independently return deposits from different participants');
  await assert.rejects(
    act(3, contribute, opened.operationId, 'op:enforce', {
      idempotencyKey: 'op-after-close',
    }),
    (error) => error?.code === 'operation_not_active',
  );

  // A participant death abandons the operation on the next mutation and returns custody atomically.
  const death = await act(0, openOperation, GRAPH_ID, 'op:death-test', 1, 'op-open-death');
  for (let index = 0; index < ROLES.length; index += 1) {
    await act(index, assignRole, death.operationId, ROLES[index], {
      idempotencyKey: `op-death-assign-${index}`,
    });
  }
  const deathTool = await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[0] }, 'item:operation_tool',
    'crafted', 'op-seed-tool-death',
  ));
  await act(0, contribute, death.operationId, 'death:investigator', {
    idempotencyKey: 'op-death-contribute-investigator',
  });
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [CHARACTERS[2]]);
  const abandoned = await act(1, assignRole, death.operationId, 'driver', {
    idempotencyKey: 'op-trigger-abandonment',
  });
  assert.equal(abandoned.status, 'abandoned');
  assert.equal(abandoned.closeReason, 'participant_dead');
  assert.equal(abandoned.releasedEscrowCount, 1);
  const recovered = await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[0] });
  assert(recovered.items.some(({ id, state }) => id === deathTool.id && state === 'active'));
  await pool.query('UPDATE characters SET alive=true WHERE id=$1', [CHARACTERS[2]]);

  // Assignment itself audits already-filled seats before accepting another account. This also
  // proves a second operation in one package may use a completely different private-role vocabulary.
  const different = await act(
    0, openOperation, GRAPH_ID, 'op:different-vocabulary', 1, 'op-open-different-vocabulary',
  );
  const authorityTrace = [];
  await withItemTransaction(tracingPool(authorityTrace), (client) => assignRole(
    client, contexts[0], different.operationId, 'chemist', {
      idempotencyKey: 'op-assign-different-chemist',
    },
  ));
  const operationLockIndex = authorityTrace.findIndex((sql) => (
    /FROM world_operations WHERE id=\$1 FOR UPDATE/i.test(sql)
  ));
  const characterLockIndex = authorityTrace.findIndex((sql) => (
    /FROM characters\s+WHERE id=\$1 FOR UPDATE/i.test(sql)
  ));
  const membershipLockIndex = authorityTrace.findIndex((sql) => (
    /FROM crew_members\s+WHERE account_id=\$1 FOR UPDATE/i.test(sql)
  ));
  assert(operationLockIndex >= 0 && characterLockIndex > operationLockIndex
    && membershipLockIndex > characterLockIndex,
  'role admission locks operation, then exact characters, then memberships');
  assert.equal(authorityTrace.some((sql) => /LEFT JOIN (characters|crew_members)/i.test(sql)), false,
    'participant authority never locks nullable outer-join rows');
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [CHARACTERS[0]]);
  const assignmentAbandoned = await act(1, assignRole, different.operationId, 'lookout', {
    idempotencyKey: 'op-assign-detects-death',
  });
  assert.equal(assignmentAbandoned.status, 'abandoned');
  assert.equal(assignmentAbandoned.closeReason, 'participant_dead');
  await pool.query('UPDATE characters SET alive=true WHERE id=$1', [CHARACTERS[0]]);

  const crewChanged = await act(
    0, openOperation, GRAPH_ID, 'op:crew-change-vocabulary', 1, 'op-open-crew-change',
  );
  await act(0, assignRole, crewChanged.operationId, 'analyst', {
    idempotencyKey: 'op-assign-crew-change-analyst',
  });
  await pool.query(
    `INSERT INTO crews (id,name,leader_account)
     VALUES ('temporary-other-crew','Temporary Other Crew',$1)`, [ACCOUNTS[0]],
  );
  await pool.query(
    `UPDATE crew_members SET crew_id='temporary-other-crew' WHERE account_id=$1`, [ACCOUNTS[0]],
  );
  const crewChangeAbandoned = await act(1, assignRole, crewChanged.operationId, 'tail', {
    idempotencyKey: 'op-assign-detects-crew-change',
  });
  assert.equal(crewChangeAbandoned.status, 'abandoned');
  assert.equal(crewChangeAbandoned.closeReason, 'crew_changed');
  await pool.query('UPDATE crew_members SET crew_id=$1 WHERE account_id=$2', [CREW_ID, ACCOUNTS[0]]);
  await pool.query("DELETE FROM crews WHERE id='temporary-other-crew'");

  // Version-independent cancellation authenticates only the immutable stored operation tuple. A
  // registry bump cannot strand escrow, cannot execute the old definition, and cannot touch the
  // distinct current-version operation for the same Crew/root.
  const versionRecovery = await act(
    0, openOperation, GRAPH_ID, 'op:version-recovery', 1, 'op-open-version-recovery-v1',
  );
  for (let index = 0; index < ROLES.length; index += 1) {
    await act(index, assignRole, versionRecovery.operationId, ROLES[index], {
      idempotencyKey: `op-version-recovery-assign-${index}`,
    });
  }
  const versionRecoveryTool = await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[0] }, 'item:operation_tool',
    'crafted', 'op-version-recovery-tool',
  ));
  await act(0, contribute, versionRecovery.operationId, 'version:investigator', {
    idempotencyKey: 'op-version-recovery-contribute',
  });
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1',
    [versionRecovery.operationId],
  ), 1);
  const versionRecoveryEscrowItemId = (await pool.query(
    'SELECT item_id FROM operation_escrow WHERE operation_id=$1',
    [versionRecovery.operationId],
  )).rows[0].item_id;
  assert(versionRecoveryEscrowItemId,
    'the historical recovery proof follows the exact FIFO item selected into escrow');
  await assert.rejects(
    operationBoard(pool, versionTwoContexts[0], versionRecovery.operationId),
    (error) => error?.code === 'stale_graph_version',
    'a version bump cannot reinterpret or continue the old operation definition',
  );
  const currentVersionOperation = await actV2(
    0, openOperation, GRAPH_ID, 'op:version-recovery', 2, 'op-open-version-recovery-v2',
  );
  assert.notEqual(currentVersionOperation.operationId, versionRecovery.operationId);
  assert.equal(currentVersionOperation.graph.version, 2);
  const currentVersionBeforeRecovery = (await pool.query(
    `SELECT id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status
       FROM world_operations WHERE id=$1`, [currentVersionOperation.operationId],
  )).rows[0];
  await assert.rejects(
    actV2(3, cancelOperation, versionRecovery.operationId, {
      idempotencyKey: 'op-version-recovery-non-opener',
    }),
    (error) => error?.code === 'operation_cancel_forbidden',
    'a participant cannot use version-independent recovery for the opener',
  );
  const versionAwardsBefore = await count(
    "SELECT COUNT(*) AS n FROM item_instances WHERE template_id='item:operation_artifact'",
  );
  const versionReleaseBefore = await count(
    `SELECT COUNT(*) AS n FROM item_events
      WHERE item_id=$1 AND event_kind='released'`, [versionRecoveryEscrowItemId],
  );
  const versionCancelTrace = [];
  const versionCanceled = await withItemTransaction(tracingPool(versionCancelTrace), (client) => (
    cancelOperation(client, versionTwoContexts[0], versionRecovery.operationId, {
      idempotencyKey: 'op-version-recovery-cancel',
    })
  ));
  assert.equal(versionCanceled.status, 'canceled');
  assert.equal(versionCanceled.graph.version, 1,
    'the recovery receipt retains the stored immutable version');
  assert.equal(versionCanceled.releasedEscrowCount, 1);
  const versionOperationLock = versionCancelTrace.findIndex((sql) => (
    /FROM world_operations WHERE id=\$1 FOR UPDATE/i.test(sql)
  ));
  const versionCharacterLock = versionCancelTrace.findIndex((sql) => (
    /FROM characters\s+WHERE id=\$1 FOR UPDATE/i.test(sql)
  ));
  const versionMembershipLock = versionCancelTrace.findIndex((sql) => (
    /FROM crew_members\s+WHERE account_id=\$1 FOR UPDATE/i.test(sql)
  ));
  assert(versionOperationLock >= 0 && versionCharacterLock > versionOperationLock
    && versionMembershipLock > versionCharacterLock,
  'historical cancellation locks operation, then sorted characters, then sorted memberships');
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1',
    [versionRecovery.operationId],
  ), 0);
  assert((await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[0] })).items
    .some(({ id, state }) => id === versionRecoveryEscrowItemId && state === 'active'));
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM item_events
      WHERE item_id=$1 AND event_kind='released'`, [versionRecoveryEscrowItemId],
  ), versionReleaseBefore + 1);
  assert.equal(await count(
    "SELECT COUNT(*) AS n FROM item_instances WHERE template_id='item:operation_artifact'",
  ), versionAwardsBefore, 'release-only recovery cannot execute the old completion award');
  assert.deepEqual(await actV2(0, cancelOperation, versionRecovery.operationId, {
    idempotencyKey: 'op-version-recovery-cancel',
  }), versionCanceled, 'old-version cancellation replays without releasing escrow twice');
  assert.equal((await actV2(0, cancelOperation, versionRecovery.operationId, {
    idempotencyKey: 'op-version-recovery-cancel-after-close',
  })).releasedEscrowCount, 0, 'a fresh recovery request cannot release the same custody twice');
  assert.deepEqual((await pool.query(
    `SELECT id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status
       FROM world_operations WHERE id=$1`, [currentVersionOperation.operationId],
  )).rows[0], currentVersionBeforeRecovery,
  'canceling the pinned v1 operation leaves the current v2 operation byte-identical');

  // The same normalized condition vocabulary drives validation and execution. Every documented
  // target/quantity alias therefore keeps its exact meaning beyond the release gate.
  const aliases = await act(
    0, openOperation, GRAPH_ID, 'op:condition-aliases', 1, 'op-open-condition-aliases',
  );
  for (let index = 0; index < ROLES.length; index += 1) {
    await act(index, assignRole, aliases.operationId, ROLES[index], {
      idempotencyKey: `op-aliases-assign-${index}`,
    });
  }
  await assert.rejects(
    act(0, contribute, aliases.operationId, 'aliases:investigator', {
      idempotencyKey: 'op-aliases-item-template-blocked',
    }),
    (error) => error?.code === 'item_unavailable',
    'itemTemplateId remains an enforced item target after validation',
  );
  await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[0] }, 'item:operation_alias_investigator',
    'crafted', 'op-aliases-investigator-tool',
  ));
  await act(0, contribute, aliases.operationId, 'aliases:investigator', {
    idempotencyKey: 'op-aliases-item-template-pass',
  });
  await assert.rejects(
    act(1, contribute, aliases.operationId, 'aliases:driver', {
      idempotencyKey: 'op-aliases-item-node-blocked',
    }),
    (error) => error?.code === 'item_unavailable',
    'nodeId remains an enforced item target after validation',
  );
  await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[1] }, 'item:operation_alias_driver',
    'crafted', 'op-aliases-driver-tool',
  ));
  await act(1, contribute, aliases.operationId, 'aliases:driver', {
    idempotencyKey: 'op-aliases-item-node-pass',
  });
  await tx((client) => grantStack(
    client, { scope: 'account', id: ACCOUNTS[2] }, 'mat:operation_condition', 1,
    'standard', 'op aliases mechanic material', 'op-aliases-mechanic-material-one',
  ));
  await assert.rejects(
    act(2, contribute, aliases.operationId, 'aliases:mechanic', {
      idempotencyKey: 'op-aliases-minimum-quantity-blocked',
    }),
    (error) => error?.code === 'materials',
    'minimumQuantity greater than one cannot degrade to a default quantity',
  );
  await tx((client) => grantStack(
    client, { scope: 'account', id: ACCOUNTS[2] }, 'mat:operation_condition', 1,
    'standard', 'op aliases mechanic material', 'op-aliases-mechanic-material-two',
  ));
  await act(2, contribute, aliases.operationId, 'aliases:mechanic', {
    idempotencyKey: 'op-aliases-minimum-quantity-pass',
  });
  await tx((client) => grantStack(
    client, { scope: 'account', id: ACCOUNTS[3] }, 'mat:operation_condition', 2,
    'standard', 'op aliases enforcer material', 'op-aliases-enforcer-material-two',
  ));
  await assert.rejects(
    act(3, contribute, aliases.operationId, 'aliases:enforcer', {
      idempotencyKey: 'op-aliases-amount-blocked',
    }),
    (error) => error?.code === 'materials',
    'amount greater than one cannot degrade to a default quantity',
  );
  await tx((client) => grantStack(
    client, { scope: 'account', id: ACCOUNTS[3] }, 'mat:operation_condition', 1,
    'standard', 'op aliases enforcer material', 'op-aliases-enforcer-material-three',
  ));
  await act(3, contribute, aliases.operationId, 'aliases:enforcer', {
    idempotencyKey: 'op-aliases-amount-pass',
  });

  // Cancellation is a recovery path, not participant validation: it locks the same authority rows
  // but still returns multi-owner escrow after death, Crew movement, and membership deletion.
  const recovery = await act(
    0, openOperation, GRAPH_ID, 'op:cancel-recovery', 1, 'op-open-cancel-recovery',
  );
  for (let index = 0; index < ROLES.length; index += 1) {
    await act(index, assignRole, recovery.operationId, ROLES[index], {
      idempotencyKey: `op-recovery-assign-${index}`,
    });
  }
  await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[0] }, 'item:operation_tool',
    'crafted', 'op-recovery-tool-investigator',
  ));
  await tx((client) => createItem(
    client, { scope: 'account', id: ACCOUNTS[2] }, 'item:operation_tool',
    'crafted', 'op-recovery-tool-mechanic',
  ));
  for (let index = 0; index < ROLES.length; index += 1) {
    await act(index, contribute, recovery.operationId, `recovery:${ROLES[index]}`, {
      idempotencyKey: `op-recovery-contribute-${index}`,
    });
  }
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [recovery.operationId],
  ), 2);
  const recoveryCustody = (await pool.query(
    `SELECT item_id,depositor_id FROM operation_escrow
      WHERE operation_id=$1 ORDER BY depositor_id,item_id`, [recovery.operationId],
  )).rows;
  assert.deepEqual(
    recoveryCustody.map(({ depositor_id }) => depositor_id),
    [ACCOUNTS[0], ACCOUNTS[2]],
    'the active recovery fixture holds escrow deposited by two different participant accounts',
  );
  const recoveryInvestigatorItemId = recoveryCustody[0].item_id;
  const recoveryMechanicItemId = recoveryCustody[1].item_id;
  const recoveryReleaseCountsBefore = new Map();
  for (const itemId of [recoveryInvestigatorItemId, recoveryMechanicItemId]) {
    recoveryReleaseCountsBefore.set(itemId, await count(
      `SELECT COUNT(*) AS n FROM item_events
        WHERE item_id=$1 AND event_kind='released'`, [itemId],
    ));
  }
  const recoveryAwardsBefore = await count(
    `SELECT COUNT(*) AS n FROM item_instances
      WHERE template_id IN ('item:operation_artifact','item:mechanic_artifact')`,
  );
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [CHARACTERS[1]]);
  await pool.query(
    `INSERT INTO crews (id,name,leader_account)
     VALUES ('cancel-recovery-other','Cancel Recovery Other',$1)`, [ACCOUNTS[2]],
  );
  await pool.query(
    `UPDATE crew_members SET crew_id='cancel-recovery-other' WHERE account_id=$1`, [ACCOUNTS[2]],
  );
  await pool.query('DELETE FROM crew_members WHERE account_id=$1', [ACCOUNTS[3]]);
  const recoveredCancellation = await act(0, cancelOperation, recovery.operationId, {
    idempotencyKey: 'op-cancel-invalid-active',
  });
  assert.equal(recoveredCancellation.status, 'canceled');
  assert.equal(recoveredCancellation.releasedEscrowCount, 2);
  assert.equal(await count(
    'SELECT COUNT(*) AS n FROM operation_escrow WHERE operation_id=$1', [recovery.operationId],
  ), 0);
  assert((await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[0] })).items
    .some(({ id, state }) => id === recoveryInvestigatorItemId && state === 'active'));
  assert((await inventoryBoard(pool, { scope: 'account', id: ACCOUNTS[2] })).items
    .some(({ id, state }) => id === recoveryMechanicItemId && state === 'active'));
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM item_events
      WHERE item_id=$1 AND event_kind='released'`, [recoveryInvestigatorItemId],
  ), recoveryReleaseCountsBefore.get(recoveryInvestigatorItemId) + 1);
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM item_events
      WHERE item_id=$1 AND event_kind='released'`, [recoveryMechanicItemId],
  ), recoveryReleaseCountsBefore.get(recoveryMechanicItemId) + 1);
  assert.equal(await count(
    `SELECT COUNT(*) AS n FROM item_instances
      WHERE template_id IN ('item:operation_artifact','item:mechanic_artifact')`,
  ), recoveryAwardsBefore, 'recovery cancellation cannot execute completion awards');
  assert.deepEqual(
    await act(0, cancelOperation, recovery.operationId, {
      idempotencyKey: 'op-cancel-invalid-active',
    }),
    recoveredCancellation,
    'invalid-party cancellation replays exactly without releasing twice',
  );
  for (const itemId of [recoveryInvestigatorItemId, recoveryMechanicItemId]) {
    assert.equal(await count(
      `SELECT COUNT(*) AS n FROM item_events
        WHERE item_id=$1 AND event_kind='released'`, [itemId],
    ), recoveryReleaseCountsBefore.get(itemId) + 1,
    'an exact cancellation replay cannot append a second release event');
  }
  await pool.query('UPDATE characters SET alive=true WHERE id=$1', [CHARACTERS[1]]);
  await pool.query('UPDATE crew_members SET crew_id=$1 WHERE account_id=$2', [CREW_ID, ACCOUNTS[2]]);
  await pool.query(
    'INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)',
    [CREW_ID, ACCOUNTS[3], 'Operation Four'],
  );
  await pool.query("DELETE FROM crews WHERE id='cancel-recovery-other'");

  // An opener may cancel a forming run without a living street; closure is exact and replay-safe.
  const openAuthorityTrace = [];
  const cancel = await withItemTransaction(tracingPool(openAuthorityTrace), (client) => openOperation(
    client, contexts[0], GRAPH_ID, 'op:cancel-test', 1, 'op-open-cancel',
  ));
  const crewLockIndex = openAuthorityTrace.findIndex((sql) => (
    /FROM crews WHERE id=\$1 FOR UPDATE/i.test(sql)
  ));
  const existingOperationLockIndex = openAuthorityTrace.findIndex((sql) => (
    /FROM world_operations WHERE crew_id=\$1.+FOR UPDATE/i.test(sql)
  ));
  const openerMembershipLockIndex = openAuthorityTrace.findIndex((sql) => (
    /FROM crew_members WHERE account_id=\$1 FOR UPDATE/i.test(sql)
  ));
  const openerCharacterLockIndex = openAuthorityTrace.findIndex((sql) => (
    /FROM characters WHERE id=\$1 FOR UPDATE/i.test(sql)
  ));
  assert(crewLockIndex >= 0 && existingOperationLockIndex > crewLockIndex
    && openerCharacterLockIndex > existingOperationLockIndex
    && openerMembershipLockIndex > openerCharacterLockIndex,
  'opening locks Crew, existing operation, character, then membership authority');
  const roleRace = await Promise.allSettled([
    act(0, assignRole, cancel.operationId, 'investigator', {
      idempotencyKey: 'op-cancel-role-race-a',
    }),
    act(1, assignRole, cancel.operationId, 'investigator', {
      idempotencyKey: 'op-cancel-role-race-b',
    }),
  ]);
  assert.equal(roleRace.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(roleRace.filter((result) => (
    result.status === 'rejected' && result.reason?.code === 'operation_role_taken'
  )).length, 1, 'concurrent claims cannot occupy one role twice');
  await assert.rejects(
    act(3, cancelOperation, cancel.operationId, { idempotencyKey: 'op-cancel-bystander' }),
    (error) => error?.code === 'operation_cancel_forbidden',
    'an unassigned same-Crew bystander cannot cancel another account\'s operation',
  );
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [CHARACTERS[0]]);
  await pool.query('DELETE FROM crew_members WHERE crew_id=$1', [CREW_ID]);
  await pool.query('DELETE FROM crews WHERE id=$1', [CREW_ID]);
  const canceled = await act(0, cancelOperation, cancel.operationId, {
    idempotencyKey: 'op-cancel-forming',
  });
  assert.equal(canceled.status, 'canceled');
  const canceledReplay = await act(0, cancelOperation, cancel.operationId, {
    idempotencyKey: 'op-cancel-forming',
  });
  assert.deepEqual(canceledReplay, canceled);

  const moneyAfter = await Promise.all(ACCOUNTS.map(async (accountId, index) => ({
    cash: Number((await pool.query(
      'SELECT cash FROM characters WHERE id=$1', [CHARACTERS[index]],
    )).rows[0].cash),
    omr: Number((await pool.query(
      'SELECT omr FROM account_persistent WHERE account_id=$1', [accountId],
    )).rows[0].omr),
  })));
  assert.deepEqual(moneyAfter, moneyBefore, 'operations cannot move cash or OMR');
  assert.equal(await count('SELECT COUNT(*) AS n FROM transactions'), transactionsBefore,
    'operations cannot write the currency ledger');

  console.log('operations ok');
} finally {
  await pool.end();
}
