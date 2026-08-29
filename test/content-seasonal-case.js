// THE BOOKS OPEN AT MIDNIGHT — production contract for a personal case that may be
// completed once per 28-day season. The public collectible stays logically stable while
// its persisted entitlement authority is qualified by the instance season key.
process.env.MOD_KEY = 'test-mod-key';
process.env.SEASON_PHASE = 'opening';

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildServer } from '../src/server.js';
import { compileContentPack, validateRuntimeContentPack } from '../src/content/compiler.js';
import { seasonIdxOf } from '../src/rules.js';

const NAMESPACE = 'omerta.case.season.books-open-at-midnight';
const TITLE = 'The Books Open at Midnight';
const COLLECTIBLE_ID = 'midnight-ledger-page';
const DAY_MS = 24 * 60 * 60 * 1000;

const source = JSON.parse(await readFile(
  new URL('../content/packs/books-open-at-midnight/pack.json', import.meta.url),
  'utf8',
));
const bundle = compileContentPack(source);
assert.equal(validateRuntimeContentPack(bundle), bundle,
  'the production artifact belongs to the strict live runtime closure');

const nodeById = new Map(bundle.nodes.map((node) => [node.id, node]));
const runtime = bundle.runtime;
const runtimeNodes = runtime.nodeIds.map((id) => nodeById.get(id));
const root = nodeById.get(runtime.entryNodeId);
const policy = nodeById.get(runtime.partyPolicyId);
const quorum = nodeById.get(runtime.quorumId);
const terminal = nodeById.get(runtime.terminalNodeId);

assert.equal(bundle.namespace, NAMESPACE);
assert.equal(root.payload.title, TITLE);
assert.equal(runtime.runPolicy, 'once_per_season',
  'the case is explicitly once per season rather than relying on the lifetime default');
assert.deepEqual(root.payload.gates, [{ kind: 'season_phase_is', phaseId: 'opening' }],
  'the sole entry gate is the canonical opening phase');

assert.deepEqual(policy.payload.organizationScopes, ['personal']);
assert.equal(policy.payload.uniqueParticipants, true);
assert.equal(policy.payload.roleLockOnStart, true);
assert.equal(policy.payload.recheckConsent, true);
assert.deepEqual({
  minimumParticipants: quorum.payload.minimumParticipants,
  uniqueParticipants: quorum.payload.uniqueParticipants,
  minimumOrganizations: quorum.payload.minimumOrganizations,
}, {
  minimumParticipants: 1,
  uniqueParticipants: true,
  minimumOrganizations: 1,
}, 'the case has one personal seat and a one-person quorum');

const roleEdges = bundle.edges.filter((edge) => (
  edge.from === policy.id && edge.type === 'PERFORMED_BY_ROLE'
));
assert.equal(roleEdges.length, 1, 'the personal policy exposes exactly one role');
const roleId = roleEdges[0].to;
assert.equal(nodeById.get(roleId).type, 'role');

const actions = runtime.actionNodeIds.map((id) => nodeById.get(id));
assert.deepEqual(actions.map((node) => node.type), ['puzzle', 'puzzle', 'choice'],
  'the executable spine is exactly two puzzles followed by one choice');
assert(bundle.edges.some((edge) => (
  edge.from === actions[0].id && edge.type === 'UNLOCKS' && edge.to === actions[1].id
)), 'the first puzzle directly unlocks the second');
assert(bundle.edges.some((edge) => (
  edge.from === actions[1].id && edge.type === 'UNLOCKS' && edge.to === actions[2].id
)), 'the second puzzle directly unlocks the final choice');
for (const action of actions) {
  assert.deepEqual(action.payload.gates, [{ kind: 'party_role', role: roleId }],
    `${action.id} is owned solely by the one investigator seat`);
}
assert.equal(actions[2].payload.options.length, 3, 'the resolution has exactly three options');
assert.equal(new Set(actions[2].payload.options.map((option) => option.id)).size, 3,
  'the three resolution option IDs are stable and unique');
for (const option of actions[2].payload.options) {
  assert.equal(typeof option.label, 'string');
  assert(option.label.trim(), `${option.id} has a visible label`);
}

for (const node of bundle.nodes) {
  if (node.id !== root.id) {
    assert.equal((node.payload?.gates || []).some((gate) => gate.kind === 'season_phase_is'), false,
      `${node.id} has no temporal gate below the root`);
  }
  for (const option of node.payload?.options || []) {
    assert.equal((option.gates || []).some((gate) => gate.kind === 'season_phase_is'), false,
      `${node.id}/${option.id} has no temporal choice gate`);
  }
}

const forbiddenNodeTypes = new Set([
  'story_flag', 'status',
  'item_def', 'recipe', 'source', 'sink', 'tool', 'facility', 'skill_track',
  'funded_omr_allocation', 'budget', 'scarcity_cap',
  'activation', 'supersession', 'public_hook', 'shareable_artifact',
  'acquisition_campaign', 'referral_entry', 'newcomer_activation',
  'human_agent_collaboration', 'retention_checkpoint', 'agent_recruitment_reward',
  'growth_exemption',
]);
assert.deepEqual(bundle.nodes.filter((node) => forbiddenNodeTypes.has(node.type)), [],
  'the case contains no story-flag, status, economic, external, or recruitment nodes');
assert.equal(runtimeNodes.length, bundle.nodes.length,
  'the production pack carries no inert out-of-profile nodes');

const rewards = bundle.nodes.filter((node) => node.type === 'reward_bundle');
assert.equal(rewards.length, 1);
assert.deepEqual(rewards[0].payload, { claimOnce: true, cash: 0, tradeableItems: 0 },
  'the only reward bundle grants no fungible value');
const collectibles = bundle.nodes.filter((node) => node.type === 'collectible_def');
assert.equal(collectibles.length, 1);
assert.equal(collectibles[0].id, COLLECTIBLE_ID);
assert.equal(collectibles[0].payload.gameplayPower, 'none');
assert.deepEqual(terminal.payload.effects, [{
  kind: 'award_collectible',
  collectibleId: COLLECTIBLE_ID,
  recipientPolicy: 'all_participants',
  claimPolicy: 'self',
}], 'the terminal has one all-participants, self-claim inert collectible effect');

const realDateNow = Date.now;
let testNow = realDateNow();
Date.now = () => testNow;

const app = await buildServer();
const pool = app.pool;
const call = async (method, url, { token, body, mod = false } = {}) => {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (mod) headers['x-mod-key'] = 'test-mod-key';
  const response = await app.inject({ method, url, headers, payload: body });
  return { code: response.statusCode, body: response.json() };
};
const create = (token) => call('POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/instances`, {
  token,
  body: { scopeKind: 'personal', roleId },
});
const issued = (instance, kind) => {
  const action = instance.actions.find((item) => item.kind === kind);
  assert(action, `${instance.status} instance issues ${kind}`);
  return action;
};
const act = (token, instance, action, extra = {}) => call(
  'POST', `/v1/content/instances/${instance.id}/act`,
  { token, body: { expectedRevision: instance.revision, actionId: action.id, ...extra } },
);
const answerFor = (action) => {
  const puzzle = nodeById.get(action.nodeId);
  const answerSpec = nodeById.get(puzzle.payload.answerSpecId);
  return answerSpec.payload.acceptedValues[0];
};
const finish = async (token, active) => {
  let instance = active;
  for (let index = 0; index < 2; index++) {
    const solve = issued(instance, 'solve');
    const response = await act(token, instance, solve, { answer: answerFor(solve) });
    assert.equal(response.code, 200, `seasonal puzzle ${index + 1} resolves`);
    instance = response.body.instance;
  }
  const choose = issued(instance, 'choose');
  assert.equal(choose.options.length, 3);
  const option = choose.options.find((item) => item.available);
  assert(option, 'the final choice retains an available baseline option');
  const response = await act(token, instance, choose, { choiceId: option.id });
  assert.equal(response.code, 200, 'the final choice resolves');
  assert.equal(response.body.instance.status, 'completed');
  return response.body.instance;
};
const economy = async (characterId, accountId) => {
  const character = (await pool.query(
    'SELECT cash FROM characters WHERE id=$1', [characterId],
  )).rows[0];
  const persistent = (await pool.query(
    'SELECT omr FROM account_persistent WHERE account_id=$1', [accountId],
  )).rows[0];
  const transaction = (await pool.query(
    'SELECT COUNT(*) AS count FROM transactions WHERE character_id=$1', [characterId],
  )).rows[0];
  return {
    cash: Number(character.cash),
    omr: Number(persistent.omr),
    transactions: Number(transaction.count),
  };
};
const effectFor = async (instanceId) => (await pool.query(
  `SELECT kind, target_id, state, payload_json
     FROM content_instance_effects WHERE instance_id=$1`,
  [instanceId],
)).rows[0];
const claim = (token, instance) => call(
  'POST', `/v1/content/instances/${instance.id}/claim`,
  { token, body: { expectedRevision: instance.revision } },
);

try {
  let response = await call('POST', '/v1/mod/content/activate', {
    mod: true,
    body: { bundle, expectedHash: bundle.contentHash },
  });
  assert.equal(response.code, 200, 'the operator activates the exact compiled production bundle');

  response = await call('POST', '/v1/auth/guest');
  assert.equal(response.code, 200);
  const token = response.body.token;
  response = await call('POST', '/v1/character', {
    token,
    body: { name: 'Midnight Reader' },
  });
  assert.equal(response.code, 200);
  const me = await call('GET', '/v1/me', { token });
  const characterId = me.body.character.id;
  const accountId = (await pool.query(
    'SELECT account_id FROM characters WHERE id=$1', [characterId],
  )).rows[0].account_id;
  const economyBefore = await economy(characterId, accountId);
  const firstSeason = seasonIdxOf();

  process.env.SEASON_PHASE = 'reckoning';
  let board = await call('GET', '/v1/content', { token });
  assert.equal(board.code, 200);
  let experience = board.body.experiences.find((item) => item.namespace === NAMESPACE);
  assert.equal(experience.title, TITLE);
  assert.equal(experience.runPolicy, 'once_per_season');
  assert.equal(experience.runKey, `season:${firstSeason}`);
  assert.equal(experience.eligible, false);
  assert.deepEqual(experience.blockedBy.map(({ kind, passed, current, required }) => ({
    kind, passed, current, required,
  })), [{
    kind: 'season_phase_is', passed: false, current: 'reckoning', required: 'opening',
  }]);
  response = await create(token);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'content_gate', 'the closed phase blocks instance creation');

  process.env.SEASON_PHASE = 'opening';
  board = await call('GET', '/v1/content', { token });
  experience = board.body.experiences.find((item) => item.namespace === NAMESPACE);
  assert.equal(experience.eligible, true);
  assert.equal(experience.season.current, 'opening');
  assert.equal(experience.season.required, 'opening');
  assert.equal(experience.runKey, `season:${firstSeason}`);

  response = await create(token);
  assert.equal(response.code, 200, 'the opening phase permits a first-season lobby');
  let instance = response.body.instance;
  assert.equal(instance.runKey, `season:${firstSeason}`);
  response = await act(token, instance, issued(instance, 'start_instance'));
  assert.equal(response.code, 200, 'the opening phase permits start');
  instance = response.body.instance;
  assert.equal(instance.status, 'active');

  process.env.SEASON_PHASE = 'reckoning';
  const firstCompleted = await finish(token, instance);
  assert.equal(firstCompleted.runKey, `season:${firstSeason}`,
    'the active first-season run finishes after the phase closes');
  response = await claim(token, firstCompleted);
  assert.equal(response.code, 200);
  assert.deepEqual(response.body.claimed, [{
    kind: 'award_collectible',
    id: COLLECTIBLE_ID,
    title: collectibles[0].payload.title,
  }], 'the first claim exposes the stable logical collectible ID');
  const firstClaimed = response.body.instance;
  let effect = await effectFor(firstCompleted.id);
  assert.deepEqual({ kind: effect.kind, state: effect.state }, {
    kind: 'award_collectible', state: 'applied',
  });
  const firstTargetId = effect.target_id;
  assert.equal(firstTargetId, `${NAMESPACE}:season:${firstSeason}:${COLLECTIBLE_ID}`,
    'the first persisted entitlement authority is qualified by namespace and season key');
  assert.equal(JSON.parse(effect.payload_json).id, COLLECTIBLE_ID,
    'the private entitlement payload preserves the public logical ID');

  response = await claim(token, firstClaimed);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'nothing_to_claim',
    'the first-season entitlement is self-claimable exactly once');
  process.env.SEASON_PHASE = 'opening';
  response = await create(token);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'already_complete',
    'the same scope cannot replay a completed case in the same season');

  testNow += 28 * DAY_MS;
  const secondSeason = seasonIdxOf();
  assert.equal(secondSeason, firstSeason + 1, 'advancing 28 days advances exactly one season key');
  board = await call('GET', '/v1/content', { token });
  experience = board.body.experiences.find((item) => item.namespace === NAMESPACE);
  assert.equal(experience.runKey, `season:${secondSeason}`);
  assert.equal(experience.eligible, true);

  response = await create(token);
  assert.equal(response.code, 200, 'the next season permits a fresh run for the same personal scope');
  instance = response.body.instance;
  assert.equal(instance.runKey, `season:${secondSeason}`);
  response = await act(token, instance, issued(instance, 'start_instance'));
  assert.equal(response.code, 200);
  instance = response.body.instance;
  process.env.SEASON_PHASE = 'reckoning';
  const secondCompleted = await finish(token, instance);
  response = await claim(token, secondCompleted);
  assert.equal(response.code, 200,
    'the season-scoped authority permits the same logical collectible next season');
  assert.deepEqual(response.body.claimed, [{
    kind: 'award_collectible',
    id: COLLECTIBLE_ID,
    title: collectibles[0].payload.title,
  }], 'the second claim still exposes only the stable logical collectible ID');
  const secondClaimed = response.body.instance;
  effect = await effectFor(secondCompleted.id);
  const secondTargetId = effect.target_id;
  assert.equal(secondTargetId, `${NAMESPACE}:season:${secondSeason}:${COLLECTIBLE_ID}`,
    'the second persisted entitlement authority is qualified by its new season key');
  assert.notEqual(secondTargetId, firstTargetId,
    'two seasonal claims never collide on the global entitlement authority');
  assert.equal(JSON.parse(effect.payload_json).id, COLLECTIBLE_ID);

  response = await claim(token, secondClaimed);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'nothing_to_claim',
    'the second-season entitlement is also self-claimable exactly once');

  const allEffects = (await pool.query(
    `SELECT target_id, state FROM content_instance_effects
      WHERE subject_account=$1 AND kind='award_collectible'
        AND target_id LIKE $2 ORDER BY target_id`,
    [accountId, `${NAMESPACE}:%:${COLLECTIBLE_ID}`],
  )).rows;
  assert.equal(allEffects.length, 2);
  assert.deepEqual(new Set(allEffects.map((row) => row.target_id)),
    new Set([firstTargetId, secondTargetId]));
  assert(allEffects.every((row) => row.state === 'applied'));
  assert.deepEqual(await economy(characterId, accountId), economyBefore,
    'both seasonal completions and claims leave cash, OMR, and transactions unchanged');
} finally {
  Date.now = realDateNow;
  delete process.env.SEASON_PHASE;
  await app.close();
}

console.log('✅ The Books Open at Midnight seasonal case contract passed');
