// SEASONAL AUTHORED CONTENT — the runtime adapter between the 28-day city clock and
// revision-checked story instances. The root gate controls discovery, creation, and
// lobby start only: an active story remains finishable if the phase turns underneath it.
process.env.MOD_KEY = 'test-mod-key';
process.env.SEASON_PHASE = 'opening';

import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { compileContentPack, validateRuntimeContentPack } from '../src/content/compiler.js';
import { seasonIdxOf } from '../src/rules.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SEASON_DAYS = 28;

function seasonalSource({
  namespace = 'omerta.test.seasonal-case',
  runPolicy,
  phaseId = 'opening',
  phaseGateAt = 'root',
  mementoId = 'seasonal-memento',
} = {}) {
  const phaseGate = { kind: 'season_phase_is', phaseId };
  const runtime = {
    experienceId: 'seasonal-case',
    entryNodeId: 'seasonal-case',
    partyPolicyId: 'personal-policy',
    quorumId: 'solo-quorum',
    terminalNodeId: 'case-closed',
    nodeIds: [
      'seasonal-case', 'personal-policy', 'solo-quorum', 'investigator',
      'case-file', 'final-choice', 'completion-reward', mementoId, 'case-closed',
    ],
    actionNodeIds: ['final-choice'],
  };
  if (runPolicy !== undefined) runtime.runPolicy = runPolicy;

  return {
    schemaVersion: 1,
    namespace,
    version: 1,
    growth: { role: 'internal_only', exemptReason: 'seasonal runtime test fixture' },
    runtime,
    nodes: [
      { id: 'seasonal-case', type: 'mystery', payload: {
        title: 'The Turning Calendar',
        systems: ['seasons', 'authored-content'],
        gates: phaseGateAt === 'root' ? [phaseGate] : [],
      } },
      { id: 'personal-policy', type: 'party_policy', payload: {
        organizationScopes: ['personal'],
        uniqueParticipants: true,
        roleLockOnStart: true,
        recheckConsent: true,
      } },
      { id: 'solo-quorum', type: 'quorum', payload: {
        minimumParticipants: 1,
        uniqueParticipants: true,
        minimumOrganizations: 1,
      } },
      { id: 'investigator', type: 'role', payload: {
        title: 'Investigator',
        participantKinds: ['agent', 'human_eligible_non_agent'],
      } },
      { id: 'case-file', type: 'chapter', payload: { title: 'A Clock in the Ledger' } },
      { id: 'final-choice', type: 'choice', payload: {
        title: 'Close the Seasonal Book',
        prompt: 'How does the investigator close the book?',
        gates: [
          { kind: 'party_role', role: 'investigator' },
          ...(phaseGateAt === 'action' ? [phaseGate] : []),
        ],
        options: [
          { id: 'file-it', label: 'File the evidence', gates: [] },
          {
            id: 'seal-it',
            label: 'Seal the evidence',
            gates: phaseGateAt === 'option' ? [phaseGate] : [],
          },
        ],
      } },
      { id: 'completion-reward', type: 'reward_bundle', payload: {
        claimOnce: true,
        cash: 0,
        tradeableItems: 0,
      } },
      { id: mementoId, type: 'collectible_def', payload: {
        title: 'A Calendar Page with No Date',
        rarity: 'seasonal_unique',
        gameplayPower: 'none',
      } },
      { id: 'case-closed', type: 'terminal', payload: {
        title: 'The Book Is Closed',
        effects: [{
          kind: 'award_collectible',
          collectibleId: mementoId,
          recipientPolicy: 'all_participants',
          claimPolicy: 'self',
        }],
      } },
    ],
    edges: [
      { from: 'seasonal-case', type: 'REQUIRES', to: 'personal-policy' },
      { from: 'personal-policy', type: 'REQUIRES', to: 'solo-quorum' },
      { from: 'personal-policy', type: 'PERFORMED_BY_ROLE', to: 'investigator' },
      { from: 'seasonal-case', type: 'UNLOCKS', to: 'case-file' },
      { from: 'case-file', type: 'UNLOCKS', to: 'final-choice' },
      { from: 'final-choice', type: 'UNLOCKS', to: 'completion-reward' },
      { from: 'completion-reward', type: 'UNLOCKS', to: 'case-closed' },
    ],
  };
}

const compileRuntime = (source) => {
  const bundle = compileContentPack(source);
  assert.equal(validateRuntimeContentPack(bundle), bundle,
    `${source.namespace} belongs to the strict live runtime closure`);
  return bundle;
};

// The manifest is backward compatible: absence means the lifetime, write-once policy.
const onceBundle = compileRuntime(seasonalSource({
  namespace: 'omerta.test.seasonal-default-once',
  mementoId: 'once-memento',
}));
assert.equal(onceBundle.runtime.runPolicy, undefined,
  'authors may omit runPolicy; the runtime, not the compiler artifact, supplies the once default');

// The only authored alternative is one run for each deterministic season key.
const seasonalBundle = compileRuntime(seasonalSource({
  namespace: 'omerta.test.seasonal-once-per-season',
  runPolicy: 'once_per_season',
}));
assert.equal(seasonalBundle.runtime.runPolicy, 'once_per_season');
assert.throws(() => compileRuntime(seasonalSource({
  namespace: 'omerta.test.seasonal-bad-policy',
  runPolicy: 'daily',
})), /runPolicy must be once or once_per_season/i,
'runtime.runPolicy is a closed enum');

for (const phaseId of ['opening', 'long_game', 'reckoning']) {
  compileRuntime(seasonalSource({
    namespace: `omerta.test.seasonal-phase-${phaseId.replace('_', '-')}`,
    phaseId,
  }));
}
assert.throws(() => compileRuntime(seasonalSource({
  namespace: 'omerta.test.seasonal-bad-phase',
  phaseId: 'off_season',
})), /season_phase_is has unknown phase off_season/i,
'season_phase_is accepts only the canonical three phase IDs');
assert.throws(() => compileRuntime(seasonalSource({
  namespace: 'omerta.test.seasonal-action-gate',
  phaseGateAt: 'action',
})), /season_phase_is is allowed only on the runtime entry node/i,
'an action cannot become unfinishable because the season phase changed');
assert.throws(() => compileRuntime(seasonalSource({
  namespace: 'omerta.test.seasonal-option-gate',
  phaseGateAt: 'option',
})), /season_phase_is is allowed only on the runtime entry node/i,
'a choice option cannot become unfinishable because the season phase changed');

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
const activate = async (bundle) => {
  const response = await call('POST', '/v1/mod/content/activate', {
    mod: true,
    body: { bundle, expectedHash: bundle.contentHash },
  });
  assert.equal(response.code, 200, `operator activates ${bundle.namespace}`);
};
const create = (token, namespace) => call(
  'POST', `/v1/content/${encodeURIComponent(namespace)}/instances`,
  { token, body: { scopeKind: 'personal', roleId: 'investigator' } },
);
const act = (token, instance, action, extra = {}) => call(
  'POST', `/v1/content/instances/${instance.id}/act`,
  { token, body: { expectedRevision: instance.revision, actionId: action.id, ...extra } },
);
const issued = (instance, kind) => {
  const action = instance.actions.find((item) => item.kind === kind);
  assert(action, `${instance.status} instance issues ${kind}`);
  return action;
};
const economy = async (characterId, accountId) => {
  const character = (await pool.query(
    'SELECT cash FROM characters WHERE id=$1', [characterId],
  )).rows[0];
  const persistent = (await pool.query(
    'SELECT omr FROM account_persistent WHERE account_id=$1', [accountId],
  )).rows[0];
  const transactions = (await pool.query(
    'SELECT COUNT(*) AS count FROM transactions WHERE character_id=$1', [characterId],
  )).rows[0];
  return {
    cash: Number(character.cash),
    omr: Number(persistent.omr),
    transactions: Number(transactions.count),
  };
};

try {
  await activate(onceBundle);
  await activate(seasonalBundle);

  const auth = await call('POST', '/v1/auth/guest');
  assert.equal(auth.code, 200);
  const token = auth.body.token;
  const made = await call('POST', '/v1/character', {
    token,
    body: { name: 'Seasonal Scribe' },
  });
  assert.equal(made.code, 200);
  const me = await call('GET', '/v1/me', { token });
  const characterId = me.body.character.id;
  const accountId = (await pool.query(
    'SELECT account_id FROM characters WHERE id=$1', [characterId],
  )).rows[0].account_id;
  const firstSeason = seasonIdxOf();

  // Omitted runPolicy projects its effective defaults on both discovery and instances.
  process.env.SEASON_PHASE = 'opening';
  let board = await call('GET', '/v1/content', { token });
  assert.equal(board.code, 200);
  const onceExperience = board.body.experiences.find(
    (item) => item.namespace === onceBundle.namespace,
  );
  assert.equal(onceExperience.runPolicy, 'once');
  assert.equal(onceExperience.runKey, 'once');

  let response = await create(token, onceBundle.namespace);
  assert.equal(response.code, 200);
  let onceInstance = response.body.instance;
  assert.equal(onceInstance.runKey, 'once');
  assert(Number.isFinite(Date.parse(onceInstance.formingExpiresAt)),
    'a forming personal lobby has a finite public expiry');
  response = await act(token, onceInstance, issued(onceInstance, 'start_instance'));
  assert.equal(response.code, 200);
  onceInstance = response.body.instance;
  assert.equal(onceInstance.status, 'active');
  assert.equal(onceInstance.formingExpiresAt, null,
    'an active instance is explicitly non-expiring');
  response = await act(token, onceInstance, issued(onceInstance, 'choose'), {
    choiceId: 'file-it',
  });
  assert.equal(response.code, 200);
  onceInstance = response.body.instance;
  assert.equal(onceInstance.status, 'completed');
  assert.equal(onceInstance.formingExpiresAt, null);
  response = await create(token, onceBundle.namespace);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'already_complete',
    'the default policy remains write-once in its first season');

  // A closed root phase remains discoverable, but cannot create a lobby.
  process.env.SEASON_PHASE = 'reckoning';
  board = await call('GET', '/v1/content', { token });
  const closedExperience = board.body.experiences.find(
    (item) => item.namespace === seasonalBundle.namespace,
  );
  assert.equal(closedExperience.runPolicy, 'once_per_season');
  assert.equal(closedExperience.runKey, `season:${firstSeason}`);
  assert.equal(closedExperience.eligible, false);
  assert.deepEqual(closedExperience.season, {
    index: firstSeason,
    current: 'reckoning',
    required: 'opening',
    daysUntilChange: closedExperience.season.daysUntilChange,
  }, 'the board projects only safe current/required seasonal state plus its clock');
  assert(Number.isInteger(closedExperience.season.daysUntilChange));
  assert.deepEqual(closedExperience.blockedBy, [{
    kind: 'season_phase_is',
    label: 'The Opening season phase',
    passed: false,
    current: 'reckoning',
    required: 'opening',
  }], 'the closed phase uses the canonical machine-readable blocker');

  response = await create(token, seasonalBundle.namespace);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'content_gate');
  assert.deepEqual(response.body.blockedBy, closedExperience.blockedBy,
    'creation rechecks the same root gate advertised on discovery');

  // A lobby can form while open, but cannot be started after the phase closes.
  process.env.SEASON_PHASE = 'opening';
  response = await create(token, seasonalBundle.namespace);
  assert.equal(response.code, 200);
  let seasonalInstance = response.body.instance;
  const firstSeasonInstanceId = seasonalInstance.id;
  assert.equal(seasonalInstance.runKey, `season:${firstSeason}`);
  assert(Number.isFinite(Date.parse(seasonalInstance.formingExpiresAt)));
  const firstStart = issued(seasonalInstance, 'start_instance');

  process.env.SEASON_PHASE = 'reckoning';
  response = await act(token, seasonalInstance, firstStart);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'content_gate',
    'start rechecks a root gate that changed after lobby formation');

  process.env.SEASON_PHASE = 'opening';
  response = await act(token, seasonalInstance, firstStart);
  assert.equal(response.code, 200);
  seasonalInstance = response.body.instance;
  assert.equal(seasonalInstance.status, 'active');
  assert.equal(seasonalInstance.formingExpiresAt, null);
  assert.equal((await pool.query(
    'SELECT forming_expires_at FROM content_instances WHERE id=$1',
    [seasonalInstance.id],
  )).rows[0].forming_expires_at, null,
  'starting clears the DB deadline instead of carrying an expired lobby clock into play');

  // The phase gate is root-only, so an active run remains finishable after the turn.
  const beforeCompletion = await economy(characterId, accountId);
  process.env.SEASON_PHASE = 'reckoning';
  response = await act(token, seasonalInstance, issued(seasonalInstance, 'choose'), {
    choiceId: 'seal-it',
  });
  assert.equal(response.code, 200);
  seasonalInstance = response.body.instance;
  assert.equal(seasonalInstance.status, 'completed',
    'an active instance may finish after the opening phase closes');
  assert.equal(seasonalInstance.runKey, `season:${firstSeason}`);
  assert.equal(seasonalInstance.formingExpiresAt, null);
  response = await call('POST', `/v1/content/instances/${seasonalInstance.id}/claim`, {
    token,
    body: { expectedRevision: seasonalInstance.revision },
  });
  assert.equal(response.code, 200);
  assert.deepEqual(response.body.claimed, [{
    kind: 'award_collectible',
    id: 'seasonal-memento',
    title: 'A Calendar Page with No Date',
  }]);
  assert.deepEqual(await economy(characterId, accountId), beforeCompletion,
    'completion and claiming do not change cash, OMR, or the ledger');
  const effects = (await pool.query(
    `SELECT kind, state FROM content_instance_effects
      WHERE instance_id=$1 ORDER BY effect_ordinal`,
    [firstSeasonInstanceId],
  )).rows;
  assert.deepEqual(effects, [{ kind: 'award_collectible', state: 'applied' }],
    'the only applied effect is the gameplay-inert memento');
  assert.deepEqual(
    seasonalBundle.nodes.find((node) => node.id === 'completion-reward').payload,
    { claimOnce: true, cash: 0, tradeableItems: 0 },
    'the authored reward bundle carries no fungible value');

  response = await create(token, seasonalBundle.namespace);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'content_gate',
    'a closed phase wins before replay checks and reveals no instance details');
  process.env.SEASON_PHASE = 'opening';
  response = await create(token, seasonalBundle.namespace);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'already_complete',
    'the completed run blocks another run under the same season key');

  // Crossing the deterministic 28-day key permits a fresh seasonal run, while once stays once.
  testNow = (firstSeason + 1) * SEASON_DAYS * DAY_MS;
  const secondSeason = seasonIdxOf();
  assert.equal(secondSeason, firstSeason + 1);
  process.env.SEASON_PHASE = 'opening';
  board = await call('GET', '/v1/content', { token });
  const reopened = board.body.experiences.find(
    (item) => item.namespace === seasonalBundle.namespace,
  );
  assert.equal(reopened.runKey, `season:${secondSeason}`);
  assert.equal(reopened.eligible, true);

  response = await create(token, onceBundle.namespace);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'already_complete',
    'the default once policy does not reset with the season');

  response = await create(token, seasonalBundle.namespace);
  assert.equal(response.code, 200);
  const expiringInstance = response.body.instance;
  assert.equal(expiringInstance.runKey, `season:${secondSeason}`);
  assert(Number.isFinite(Date.parse(expiringInstance.formingExpiresAt)));
  const deadlineRow = (await pool.query(
    `SELECT created_at, forming_expires_at FROM content_instances WHERE id=$1`,
    [expiringInstance.id],
  )).rows[0];
  assert(new Date(deadlineRow.forming_expires_at) > new Date(deadlineRow.created_at),
    'the persisted forming_expires_at is a finite deadline after creation');

  response = await create(token, seasonalBundle.namespace);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'already',
    'an open run blocks another run under the same season key');

  // Expiry is deterministic in the DB. Board refresh abandons the stale lobby and releases scope.
  await pool.query(
    'UPDATE content_instances SET forming_expires_at=$2 WHERE id=$1',
    [expiringInstance.id, new Date('2000-01-01T00:00:00.000Z')],
  );
  board = await call('GET', '/v1/content', { token });
  assert.equal(board.code, 200);
  const abandoned = board.body.instances.find((item) => item.id === expiringInstance.id);
  assert.equal(abandoned.status, 'abandoned');
  const expiredRow = (await pool.query(
    'SELECT status FROM content_instances WHERE id=$1', [expiringInstance.id],
  )).rows[0];
  assert.equal(expiredRow.status, 'forming',
    'the GET projection remains read-only even while hiding an expired lobby as abandoned');

  response = await create(token, seasonalBundle.namespace);
  assert.equal(response.code, 200,
    'an abandoned lobby releases the same scope and season key for recreation');
  assert.equal((await pool.query(
    'SELECT status FROM content_instances WHERE id=$1', [expiringInstance.id],
  )).rows[0].status, 'abandoned',
  'the next mutation persists expiry before allocating the replacement lobby');
  assert.notEqual(response.body.instance.id, expiringInstance.id);
  assert.equal(response.body.instance.status, 'forming');
  assert.equal(response.body.instance.runKey, `season:${secondSeason}`);
  assert(Number.isFinite(Date.parse(response.body.instance.formingExpiresAt)));
} finally {
  Date.now = realDateNow;
  delete process.env.SEASON_PHASE;
  await app.close();
}

console.log('✅ seasonal authored-content runtime contract passed');
