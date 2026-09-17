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
} finally {
  await cleanup();
}
