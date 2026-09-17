// Authentic discovery and live ACLs gate Phase 1 crafting. PostgreSQL mode requires an
// explicit loopback scratch database and creates its own disposable schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { createCraftingContext, craftWorldGraphRecipe, recipeCatalog } from '../src/crafting.js';
import { grantStack, inventoryBoard, withItemTransaction } from '../src/items.js';
import { knowledgeRequirementKey, normalizeKnowledgeRequirement } from '../src/world-knowledge.js';
import { createMysteryContext, startMystery, completeNode, discoverNode, commitChoice, mysteryBoard } from '../src/mysteries.js';

let pool, cleanup;
const postgres = process.argv.includes('--postgres');
if (postgres) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
  const { Pool } = await import('pg');
  const base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `world_knowledge_crafting_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true });
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg();
  pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}

const key = () => crypto.randomUUID();
const reject = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const source = graph.nodes.find(({ id }) => id === 'docks-source');
const requirement = { contentHash: graph.contentHash, ...source.claim };
const recipeId = 'recipe:knowledge_fixture_tool';
const owner = (accountId) => ({ scope: 'account', id: accountId });
const clone = (value) => structuredClone(value);
function registryFor(input = requirement, alter = () => {}) {
  const recipe = {
    id: recipeId, type: 'recipe', version: 1, visibility: 'public', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:wire', quantity: 1, quality: 'standard' }],
    produces: [{ templateId: 'item:precision_lock_tool', quantity: 1 }], cashCost: 25,
    conditions: [{ adapter: 'knowledge', requirement: input }],
  };
  alter(recipe);
  return loadAndValidateGraphPackages([...PHASE1_WORLD_GRAPH_PACKAGES, {
    id: 'knowledge-crafting-fixture', version: 1, season: 'core',
    dependsOn: ['core-materials', 'automotive-salvage'], nodes: [recipe],
  }]);
}
const registry = registryFor();
const context = createCraftingContext({ registry, knowledgeEnabled: true, sharingEnabled: true });
const privateContext = createCraftingContext({ registry, knowledgeEnabled: true });
const api = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const craft = (accountId, requestKey = key(), craftingContext = context, extra = {}) =>
  withItemTransaction(pool, (client) => craftWorldGraphRecipe(client,
    { ...extra, accountId }, recipeId, requestKey, craftingContext));
const economicTables = ['characters', 'item_stacks', 'item_instances', 'item_events', 'item_mutation_guards', 'transactions'];
async function economy() {
  return Object.fromEntries(await Promise.all(economicTables.map(async (table) => [table,
    (await pool.query(`SELECT * FROM ${table}`)).rows
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
}
async function denied(accountId, craftingContext = context, extra = {}) {
  const before = await economy();
  await reject(craft(accountId, key(), craftingContext, extra), 'knowledge_required');
  assert.deepEqual(await economy(), before, 'Denied knowledge must not consume cash, materials or mutation receipts');
}
async function player(accountId, loc = 'docks') {
  await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$3)', [accountId, 'test', accountId]);
  await pool.query('INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES($1,$2,$3,1,$4,1000)',
    [`${accountId}-ch`, accountId, accountId, loc]);
  await withItemTransaction(pool, (client) => grantStack(client, owner(accountId),
    'mat:wire', 20, 'standard', 'knowledge crafting fixture', key()));
  return accountId;
}
async function discover(accountId) {
  let instance = (await api.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  const act = async (action) => {
    assert(action, 'A server-issued action must exist');
    instance = (await api.act(accountId, instance.id,
      { expectedRevision: instance.revision, actionId: action.id }, key())).instance;
  };
  await act(instance.actions.find(({ kind, nodeId }) => kind === 'complete' && nodeId === 'briefing'));
  const action = instance.actions.find(({ kind }) => kind === 'discover');
  assert.equal(Object.hasOwn(action, 'nodeId'), false, 'Hidden discovery sources stay out of action descriptors');
  await act(action);
  const { claims } = await api.knowledgeBoard(accountId);
  const claim = claims.find((entry) => entry.sourceRoot === requirement.sourceRoot) ?? claims[0];
  assert(claim, 'Authentic source discovery creates knowledge');
  return claim.id;
}
async function share(accountId, claimId, recipient, kind = 'account') {
  const targets = (await api.knowledgeTargets(accountId, kind === 'account' ? { characterName: recipient } : {})).targets;
  const target = targets.find((entry) => entry.kind === kind);
  assert(target, 'Sharing requires a current server-issued target');
  const { claim } = await api.knowledgeGet(accountId, claimId);
  await api.shareKnowledge(accountId, claimId, { targetId: target.id, expectedAclRevision: claim.aclRevision }, key());
}
async function revoke(accountId, claimId) {
  const { claim } = await api.knowledgeGet(accountId, claimId);
  assert.equal(claim.grants.length, 1, 'This fixture has one active grant at each revocation');
  await api.revokeKnowledge(accountId, claimId,
    { grantId: claim.grants[0].id, expectedAclRevision: claim.aclRevision }, key());
}
function assertPrivateProjection(value, claimId) {
  const serialized = JSON.stringify(value);
  for (const secret of [requirement.contentHash, requirement.domain, requirement.proposition,
    requirement.sourceRoot, requirement.value.value, 'docks-source', claimId].filter(Boolean)) {
    assert(!serialized.includes(secret), `Crafting projection leaked private knowledge: ${secret}`);
  }
}

try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const author = await player('craft-author');
  const recipient = await player('craft-recipient');
  const member = await player('craft-member');
  const foreignSource = await player('craft-foundry', 'foundry');

  const invalid = [
    ['missing requirement', undefined],
    ['array requirement', []],
    ['extra authority field', { ...requirement, accountId: author }],
    ['invalid content hash', { ...requirement, contentHash: 'untrusted' }],
    ['uppercase hash', { ...requirement, contentHash: 'A'.repeat(64) }],
    ['missing source', { ...requirement, sourceRoot: '' }],
    ['domain whitespace', { ...requirement, domain: 'untrusted domain' }],
    ['proposition control character', { ...requirement, proposition: 'bad\nvalue' }],
    ['untyped value', { ...requirement, value: 'untrusted' }],
    ['extra value authority', { ...requirement, value: { ...requirement.value, receiptId: 'forged' } }],
    ['boolean coercion', { ...requirement, value: { type: 'boolean', value: 'true' } }],
    ['unsafe integer', { ...requirement, value: { type: 'integer', value: Number.MAX_SAFE_INTEGER + 1 } }],
    ['negative zero', { ...requirement, value: { type: 'integer', value: -0 } }],
    ['empty text', { ...requirement, value: { type: 'text', value: '' } }],
    ['unknown type', { ...requirement, value: { type: 'json', value: {} } }],
  ];
  for (const [label, input] of invalid) {
    assert.throws(() => normalizeKnowledgeRequirement(input),
      (error) => error.code === 'bad_knowledge_requirement', label);
    // Avoid the helper's default argument when intentionally testing undefined.
    assert.throws(() => registryFor(requirement, (recipe) => { recipe.conditions[0].requirement = input; }),
      (error) => error.code === 'malformed_condition', label);
  }
  assert.throws(() => registryFor(requirement, (recipe) => { recipe.conditions[0].claimId = 'forged'; }),
    (error) => error.code === 'malformed_condition');
  for (const value of [{ type: 'boolean', value: false }, { type: 'integer', value: 0 },
    { type: 'text', value: 'known' }]) {
    assert.deepEqual(normalizeKnowledgeRequirement({ ...requirement, value }).value, value);
  }
  const callerOwned = clone(requirement), normalized = normalizeKnowledgeRequirement(callerOwned);
  callerOwned.value.value = 'changed';
  assert.equal(normalized.value.value, requirement.value.value, 'Normalized values do not retain mutable caller authority');
  assert(Object.isFrozen(normalized)); assert(Object.isFrozen(normalized.value));

  const catalog = recipeCatalog({ character: { loc: 'docks', cash: 1000 },
    inventory: await inventoryBoard(pool, owner(author)) }, context);
  const projected = catalog.find(({ id }) => id === recipeId);
  assert.equal(projected.available, false);
  assert.deepEqual(projected.blockedBy, [{ adapter: 'knowledge' }]);
  assertPrivateProjection(projected);
  await denied(author);
  await denied(recipient, context, { knowledge: new Set([knowledgeRequirementKey(requirement)]),
    knowledgeEvidence: [requirement], discovered: new Set(['docks-source']),
    character: { id: `${author}-ch` } });
  await reject(craft(recipient, key(), { ...context, knowledgeEnabled: true }), 'bad_crafting_context');

  const claimId = await discover(author);
  await denied(author, createCraftingContext({ registry }));
  await denied(author, createCraftingContext({ registry, knowledgeEnabled: true, accountIds: [recipient] }));
  const ownKey = key(), beforeOwn = await inventoryBoard(pool, owner(author));
  const receipt = await craft(author, ownKey, privateContext);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.outputs[0].templateId, 'item:precision_lock_tool');
  const afterOwn = await inventoryBoard(pool, owner(author));
  assert.equal(afterOwn.stacks.find(({ templateId }) => templateId === 'mat:wire').qty,
    beforeOwn.stacks.find(({ templateId }) => templateId === 'mat:wire').qty - 1);
  assert.equal(afterOwn.items.length, beforeOwn.items.length + 1);
  assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE account_id=$1', [author])).rows[0].cash), 975);
  assertPrivateProjection(receipt, claimId);
  const afterCraft = await economy();
  assert.deepEqual(await craft(author, ownKey, privateContext), receipt);
  assert.deepEqual(await economy(), afterCraft, 'Replay does not duplicate inventory, cash or audit mutations');

  for (const mismatch of [{ contentHash: '0'.repeat(64) }, { sourceRoot: 'foundry.impression' },
    { domain: 'omerta.other-domain' }, { proposition: 'ledger.other-fact' },
    { value: { type: 'text', value: 'assembled-before-the-fire' } }]) {
    const wrongContext = createCraftingContext({ registry: registryFor({ ...requirement, ...mismatch }), knowledgeEnabled: true });
    await denied(author, wrongContext);
  }
  await discover(foreignSource);
  await denied(foreignSource);
  console.log('world-knowledge-crafting: definition validation, authentic discovery, private projection, exact source and replay pass');

  await denied(recipient);
  await share(author, claimId, recipient);
  await denied(recipient, privateContext);
  const sharedKey = key(), sharedReceipt = await craft(recipient, sharedKey);
  assertPrivateProjection(sharedReceipt, claimId);
  await revoke(author, claimId);
  await denied(recipient);
  const afterRevoke = await economy();
  assert.deepEqual(await craft(recipient, sharedKey), sharedReceipt, 'Committed replay returns its receipt after ACL revocation');
  assert.deepEqual(await economy(), afterRevoke, 'Revoked replay cannot execute another mutation');

  await pool.query('INSERT INTO crews(id,name,leader_account) VALUES($1,$2,$3)', ['craft-crew', 'Craft Crew', author]);
  for (const accountId of [author, member]) {
    await pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES($1,$2,$3)', ['craft-crew', accountId, accountId]);
  }
  await share(author, claimId, null, 'crew');
  const memberKey = key(), memberReceipt = await craft(member, memberKey);
  await pool.query('DELETE FROM crew_members WHERE account_id=$1', [member]);
  await denied(member, context, { crewId: 'craft-crew', knowledge: new Set([knowledgeRequirementKey(requirement)]) });
  const afterLeave = await economy();
  assert.deepEqual(await craft(member, memberKey), memberReceipt);
  assert.deepEqual(await economy(), afterLeave, 'Membership loss does not let replay spend again');
  console.log(`world-knowledge-crafting: sharing opt-in, revocation and live crew membership pass (${postgres ? 'postgres' : 'pg-mem'})`);

  // The same learned fact must govern private mystery discovery and irreversible deduction.
  // Reuse real discovery/crafting/sharing, never insert a trusted knowledge flag.
  const mysteryGraphId = 'knowledge-mystery-fixture';
  const knowledgeCondition = { adapter: 'knowledge', requirement };
  const mysteryNodes = [
    { id: 'm:knowledge-start', type: 'mystery_step', visibility: 'public', conditions: [knowledgeCondition] },
    { id: 'm:knowledge-hidden', type: 'mystery_step', visibility: 'hidden', requires: ['m:knowledge-start'],
      conditions: [{ adapter: 'item_ownership', templateId: 'item:precision_lock_tool' }, knowledgeCondition] },
    { id: 'm:knowledge-choice', type: 'choice', visibility: 'public', requires: ['m:knowledge-hidden'],
      conditions: [knowledgeCondition], options: [{ id: 'left', excludes: ['m:knowledge-right'] },
        { id: 'right', excludes: ['m:knowledge-left'] }] },
    { id: 'm:knowledge-left', type: 'mystery_step', visibility: 'public', requires: ['m:knowledge-choice'],
      conditions: [{ adapter: 'item_ownership', templateId: 'item:precision_lock_tool' }, knowledgeCondition],
      effects: [{ adapter: 'item_consume', templateId: 'item:precision_lock_tool' }], metadata: { terminal: true } },
    { id: 'm:knowledge-right', type: 'mystery_step', visibility: 'public', requires: ['m:knowledge-choice'],
      conditions: [knowledgeCondition], metadata: { terminal: true } },
  ];
  const mysteryRegistry = (nodes = mysteryNodes) => loadAndValidateGraphPackages([...PHASE1_WORLD_GRAPH_PACKAGES, {
    id: mysteryGraphId, version: 1, dependsOn: ['core-materials', 'automotive-salvage'], nodes,
  }]);
  const mysteryRegistryValue = mysteryRegistry();
  const mixedPackages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  mixedPackages.find((pkg) => pkg.id === 'automotive-salvage').nodes.push({
    id: 'm:mixed-salvage-step', type: 'mystery_step', visibility: 'public', metadata: { terminal: true },
  });
  assert.doesNotThrow(() => createMysteryContext({ registry: loadAndValidateGraphPackages(mixedPackages), accountId: author }),
    'Mixed packages retain their recipe-only condition vocabulary while mystery definitions are pinned');
  const mysteryContextFor = (accountId, policy = {}) => createMysteryContext({ registry: mysteryRegistryValue,
    accountId, knowledgeEnabled: true, sharingEnabled: true, ...policy });
  const mysteryAuthor = await player('mystery-author'), mysteryReader = await player('mystery-reader');
  const mysteryAuthorContext = mysteryContextFor(mysteryAuthor), mysteryReaderContext = mysteryContextFor(mysteryReader);
  const mysteryAct = (fn, accountId, nodeId, requestKey = key(), runtime = mysteryContextFor(accountId), extra = {}) =>
    withItemTransaction(pool, (client) => fn(client, runtime, owner(accountId), mysteryGraphId, nodeId,
      { idempotencyKey: requestKey, ...extra }));
  const board = (accountId, runtime = mysteryContextFor(accountId)) => mysteryBoard(pool, runtime, owner(accountId), mysteryGraphId);
  for (const accountId of [mysteryAuthor, mysteryReader]) await withItemTransaction(pool, (client) =>
    startMystery(client, mysteryContextFor(accountId), owner(accountId), mysteryGraphId, 1, key()));
  const beforeDiscovery = await board(mysteryReader);
  await reject(withItemTransaction(pool, (client) => mysteryBoard(client, mysteryReaderContext, owner(mysteryReader), mysteryGraphId)), 'mystery_read_required');
  assertPrivateProjection(beforeDiscovery);
  assert(!beforeDiscovery.nodes.some((node) => node.id === 'm:knowledge-hidden'));
  assert.deepEqual(beforeDiscovery.nodes.find((node) => node.id === 'm:knowledge-start').blockedBy, [{ adapter: 'knowledge' }]);
  await reject(mysteryAct(completeNode, mysteryReader, 'm:knowledge-start'), 'knowledge_required');
  await reject(mysteryAct(completeNode, mysteryReader, 'm:knowledge-start', key(), { ...mysteryReaderContext }), 'bad_mystery_context');
  const mysteryClaim = await discover(mysteryAuthor);
  await reject(mysteryAct(completeNode, mysteryAuthor, 'm:knowledge-start', key(), mysteryContextFor(mysteryAuthor, { knowledgeEnabled: false })), 'knowledge_required');
  await reject(mysteryAct(completeNode, mysteryAuthor, 'm:knowledge-start', key(), mysteryContextFor(mysteryAuthor, { accountIds: [mysteryReader] })), 'knowledge_required');
  assert.equal((await board(mysteryAuthor)).nodes.find((node) => node.id === 'm:knowledge-start').available, true);
  await share(mysteryAuthor, mysteryClaim, mysteryReader);
  assert.equal((await board(mysteryReader)).nodes.find((node) => node.id === 'm:knowledge-start').available, true);
  assert.equal((await board(mysteryReader, mysteryContextFor(mysteryReader, { sharingEnabled: false }))).nodes.find((node) => node.id === 'm:knowledge-start').available, false);
  for (const accountId of [mysteryAuthor, mysteryReader]) {
    await mysteryAct(completeNode, accountId, 'm:knowledge-start');
    await reject(mysteryAct(discoverNode, accountId, 'm:knowledge-hidden'), 'item_unavailable');
    await craft(accountId);
    await mysteryAct(discoverNode, accountId, 'm:knowledge-hidden');
    await mysteryAct(completeNode, accountId, 'm:knowledge-hidden');
  }
  await revoke(mysteryAuthor, mysteryClaim);
  const afterRevocation = await board(mysteryReader);
  assert(afterRevocation.nodes.some((node) => node.id === 'm:knowledge-hidden'), 'Past discoveries persist after source sharing is revoked');
  assert.deepEqual(afterRevocation.nodes.find((node) => node.id === 'm:knowledge-choice').blockedBy, [{ adapter: 'knowledge' }]);
  await reject(withItemTransaction(pool, (client) => commitChoice(client, mysteryReaderContext, owner(mysteryReader), mysteryGraphId,
    'm:knowledge-choice', 'left', { idempotencyKey: key() })), 'knowledge_required');
  await share(mysteryAuthor, mysteryClaim, mysteryReader);
  for (const accountId of [mysteryAuthor, mysteryReader]) {
    const choiceKey = key();
    const choose = () => withItemTransaction(pool, (client) => commitChoice(client, mysteryContextFor(accountId), owner(accountId),
      mysteryGraphId, 'm:knowledge-choice', 'left', { idempotencyKey: choiceKey }));
    assert.deepEqual(await choose(), await choose(), 'An irreversible deduction replays its original receipt');
    await reject(mysteryAct(completeNode, accountId, 'm:knowledge-right'), 'mystery_excluded');
  }
  const mysteryTrace = [];
  let injectMysteryFailure = false;
  const observedPool = { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    return { release: () => client.release(), async query(sql, params) {
      mysteryTrace.push(String(sql));
      const result = await client.query(sql, params);
      if (injectMysteryFailure && /UPDATE mystery_node_state SET result_json/.test(String(sql)) && params[1] === 'm:knowledge-left') {
        throw new Error('mystery failure after completion write');
      }
      return result;
    } };
  } };
  assertPrivateProjection(await mysteryBoard(observedPool, mysteryReaderContext, owner(mysteryReader), mysteryGraphId), mysteryClaim);
  assert(!mysteryTrace.some((sql) => /FOR UPDATE|FOR SHARE|^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)), 'Mystery boards cannot lock rows or write state');
  if (postgres) assert.equal(mysteryTrace.filter((sql) => /BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY/.test(sql)).length, 1);
  const beforeFault = await economy();
  const mysteryBeforeFault = (await pool.query('SELECT * FROM mystery_node_state ORDER BY instance_id,node_id')).rows;
  injectMysteryFailure = true;
  await assert.rejects(withItemTransaction(observedPool, (client) => completeNode(client, mysteryReaderContext, owner(mysteryReader),
    mysteryGraphId, 'm:knowledge-left', { idempotencyKey: key() })), /mystery failure after completion write/);
  injectMysteryFailure = false;
  assert.deepEqual(await economy(), beforeFault, 'Failed completion restores the consumed crafted item, events and replay guard');
  assert.deepEqual((await pool.query('SELECT * FROM mystery_node_state ORDER BY instance_id,node_id')).rows, mysteryBeforeFault);
  assert.equal((await board(mysteryReader)).status, 'active');
  const finalKey = key();
  let finalReceipt;
  if (postgres) {
    let signalWritten, releaseCommit;
    const written = new Promise((resolve) => { signalWritten = resolve; });
    const commit = new Promise((resolve) => { releaseCommit = resolve; });
    const completing = withItemTransaction(pool, async (client) => {
      const value = await completeNode(client, mysteryReaderContext, owner(mysteryReader), mysteryGraphId,
        'm:knowledge-left', { idempotencyKey: finalKey });
      signalWritten(); await commit; return value;
    });
    await written;
    const revoking = revoke(mysteryAuthor, mysteryClaim);
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        blocked = (await pool.query(`SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid()
          AND wait_event_type='Lock' AND query LIKE '%coordination_claims%'`)).rows.length > 0;
        if (blocked) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert(blocked, 'A real concurrent ACL revocation waits for the mystery predicate claim mutex');
    } finally { releaseCommit(); }
    finalReceipt = await completing; await revoking;
  } else {
    finalReceipt = await mysteryAct(completeNode, mysteryReader, 'm:knowledge-left', finalKey);
    await revoke(mysteryAuthor, mysteryClaim);
  }
  assert.equal(finalReceipt.status, 'completed');
  assertPrivateProjection(finalReceipt, mysteryClaim);
  assert.deepEqual(await mysteryAct(completeNode, mysteryReader, 'm:knowledge-left', finalKey), finalReceipt);
  const consumed = (await pool.query(`SELECT state FROM item_instances WHERE owner_scope='account' AND owner_id=$1
    AND template_id='item:precision_lock_tool'`, [mysteryReader])).rows;
  assert.equal(consumed.length, 1); assert.equal(consumed[0].state, 'consumed');
  assertPrivateProjection(await board(mysteryReader), mysteryClaim);
  const freshContext = createMysteryContext({ registry: mysteryRegistry(), accountId: mysteryReader, knowledgeEnabled: true, sharingEnabled: true });
  assert.equal((await board(mysteryReader, freshContext)).status, 'completed', 'A recreated runtime reads the persisted ending');
  await pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [mysteryAuthor]);
  await reject(mysteryAct(completeNode, mysteryAuthor, 'm:knowledge-left'), 'knowledge_unavailable');
  await pool.query("UPDATE accounts SET status='active' WHERE id=$1", [mysteryAuthor]);
  for (const mismatch of [{ contentHash: '0'.repeat(64) }, { sourceRoot: 'other.source' }]) {
    const nodes = structuredClone(mysteryNodes);
    nodes[3].conditions[1].requirement = { ...requirement, ...mismatch };
    const changed = createMysteryContext({ registry: mysteryRegistry(nodes), accountId: mysteryAuthor, knowledgeEnabled: true });
    await reject(mysteryAct(completeNode, mysteryAuthor, 'm:knowledge-left', key(), changed), 'graph_definition_drift');
  }
  const originalPin = (await pool.query('SELECT definition_hash FROM mystery_instances WHERE authority_account_id=$1', [mysteryAuthor])).rows[0].definition_hash;
  assert.match(originalPin, /^[a-f0-9]{64}$/);
  await pool.query('UPDATE mystery_instances SET definition_hash=NULL WHERE authority_account_id=$1', [mysteryAuthor]);
  await reject(mysteryAct(completeNode, mysteryAuthor, 'm:knowledge-left'), 'mystery_definition_unpinned');
  await reject(board(mysteryAuthor), 'mystery_definition_unpinned');
  await pool.query('UPDATE mystery_instances SET definition_hash=$2 WHERE authority_account_id=$1', [mysteryAuthor, originalPin]);
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  assert.equal((await board(mysteryReader)).status, 'completed', 'Schema reapplication retains new pins and prior completion');
  const overflow = Array.from({ length: 17 }, (_, index) => ({ id: `m:knowledge-bound-${index}`, type: 'mystery_step', visibility: 'public',
    conditions: [{ adapter: 'knowledge', requirement: { ...requirement, proposition: `bound.${index}` } }] }));
  assert.throws(() => createMysteryContext({ registry: mysteryRegistry(overflow), accountId: mysteryAuthor }), { code: 'bad_mystery_condition' });
  console.log(`world-knowledge-mysteries: authenticated prerequisites, private discovery, crafting, branching, revocation, replay and persistence pass (${postgres ? 'postgres' : 'pg-mem'})`);
} finally {
  await cleanup();
}
