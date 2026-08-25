// Finite Agent Alpha runner regressions. These tests use a real local Fastify listener and
// temporary on-disk sessions so lifecycle and recovery assertions exercise actual HTTP and I/O.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';

import { runAgentAlpha } from '../tools/agent-alpha.js';

const POLICY = {
  cashReserve: 1000,
  minArbitrageProfit: 25,
  allowPvP: false,
  allowBorrowing: false,
};

async function localApi() {
  const app = Fastify({ logger: false });
  const requests = [];
  const state = {
    guestCalls: 0,
    agentKeyCalls: 0,
    characterCalls: 0,
    actCalls: 0,
    hasCharacter: false,
    agent: false,
    characterName: null,
  };

  app.addHook('onRequest', async (req) => {
    requests.push({
      method: req.method,
      path: req.url,
      authorization: req.headers.authorization,
      idempotencyKey: req.headers['idempotency-key'],
    });
  });
  app.post('/v1/auth/guest', async () => {
    state.guestCalls += 1;
    return { token: 'guest-token-secret' };
  });
  app.get('/v1/session', async (req, reply) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!['guest-token-secret', 'agent-token-secret'].includes(token)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    return {
      authed: true,
      hasCharacter: state.hasCharacter,
      agent: state.agent,
      character: state.hasCharacter
        ? { id: 'character-id-secret', name: state.characterName, generation: 1 }
        : null,
      wallet: 'wallet-secret',
    };
  });
  app.post('/v1/auth/agent-key', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer guest-token-secret');
    state.agentKeyCalls += 1;
    state.agent = true;
    return { token: 'agent-token-secret', agent: true };
  });
  app.post('/v1/character', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer agent-token-secret');
    state.characterCalls += 1;
    state.characterName = req.body.name;
    state.hasCharacter = true;
    return { id: 'character-id-secret', name: state.characterName };
  });
  app.get('/v1/agent/turn', async () => ({
    turnId: `turn-secret-${state.actCalls + 1}`,
    recommendedActionId: `crime-secret-${state.actCalls + 1}`,
    policy: POLICY,
    actions: [{
      id: `crime-secret-${state.actCalls + 1}`,
      kind: 'crime',
      method: 'POST',
      path: '/v1/crimes/pick',
      body: { authoredPrompt: 'never report this body' },
      executable: true,
    }],
    blocked: [{ code: 'nerve', actionId: 'blocked-secret' }],
    exploration: { id: 'explore_crime', progress: { visited: 1, total: 40 } },
    state: {
      identity: { id: 'character-id-secret', name: state.characterName },
      resources: { cash: 1200, nerve: 9, energy: 8, heat: 1 },
    },
  }));
  app.post('/v1/agent/act', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer agent-token-secret');
    state.actCalls += 1;
    return {
      actionId: req.body.actionId,
      result: { ok: true, accountId: 'account-id-secret' },
      turn: null,
      refreshRequired: true,
    };
  });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    state,
    close: () => app.close(),
  };
}

async function lifecycleTest() {
  const dir = await mkdtemp(join(tmpdir(), 'omerta-agent-alpha-'));
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  const api = await localApi();
  try {
    await assert.rejects(
      runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 0,
        sleep: async () => {},
      }),
      /explicit.*create|session.*missing/i,
      'a missing identity requires the explicit creation flag',
    );
    assert.equal(api.state.guestCalls, 0,
      'a resume attempt never creates a replacement guest identity');

    const first = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      create: true,
      name: 'Alpha Machine',
      maxActions: 2,
      intervalMs: 0,
      sleep: async () => {},
    });
    assert.equal(first.actions, 2,
      'the finite runner stops after the caller action budget');
    assert.deepEqual({
      guestCalls: api.state.guestCalls,
      agentKeyCalls: api.state.agentKeyCalls,
      characterCalls: api.state.characterCalls,
      actCalls: api.state.actCalls,
    }, {
      guestCalls: 1,
      agentKeyCalls: 1,
      characterCalls: 1,
      actCalls: 2,
    }, 'explicit creation produces one flagged account, one character, and no extra actions');

    const session = JSON.parse(await readFile(sessionFile, 'utf8'));
    assert.deepEqual(session, {
      version: 1,
      base: api.baseUrl,
      phase: 'agent',
      token: 'agent-token-secret',
      characterName: 'Alpha Machine',
      pending: null,
    }, 'the durable session retains only the origin-bound agent identity and cleared operation state');

    const second = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: 1,
      intervalMs: 0,
      sleep: async () => {},
    });
    assert.equal(second.actions, 1, 'a resumed run receives its own finite action budget');
    assert.equal(api.state.guestCalls, 1,
      'a second run resumes the original identity without guest creation');
    assert.equal(api.state.agentKeyCalls, 1,
      'a second run does not issue another agent key');
    assert.equal(api.state.characterCalls, 1,
      'a second run does not create another character');

    const lines = (await readFile(reportFile, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.ok(lines.length >= 3, 'each attempted action leaves a machine-readable JSONL record');
    const report = JSON.stringify(lines);
    for (const forbidden of [
      'guest-token-secret', 'agent-token-secret', 'Bearer', 'wallet-secret',
      'account-id-secret', 'character-id-secret', 'never report this body', 'Alpha Machine',
    ]) {
      assert.equal(report.includes(forbidden), false,
        `reports exclude forbidden identity/authored value: ${forbidden}`);
    }
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function probeApi({ sessionStatus = 200 } = {}) {
  const app = Fastify({ logger: false });
  const state = { guestCalls: 0, sessionCalls: 0, turnCalls: 0, actCalls: 0 };
  app.post('/v1/auth/guest', async () => {
    state.guestCalls += 1;
    return { token: 'replacement-token' };
  });
  app.get('/v1/session', async (_req, reply) => {
    state.sessionCalls += 1;
    if (sessionStatus !== 200) {
      return reply.code(sessionStatus).send({
        error: sessionStatus === 401 ? 'unauthorized' : 'temporarily_unavailable',
      });
    }
    return {
      authed: true,
      hasCharacter: true,
      agent: true,
      character: { id: 'character-id-secret', name: 'Alpha Machine', generation: 1 },
    };
  });
  app.get('/v1/agent/turn', async () => {
    state.turnCalls += 1;
    return { turnId: 'idle-turn', recommendedActionId: null, policy: POLICY, actions: [] };
  });
  app.post('/v1/agent/act', async () => {
    state.actCalls += 1;
    return { turn: null };
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => app.close(),
  };
}

function sessionFor(base, overrides = {}) {
  return {
    version: 1,
    base,
    phase: 'agent',
    token: 'agent-token-secret',
    characterName: 'Alpha Machine',
    pending: null,
    ...overrides,
  };
}

async function failClosedSessionTest() {
  const cases = [
    {
      name: 'corrupt JSON',
      prepare: async (file) => writeFile(file, '{broken-json', 'utf8'),
      expected: /corrupt|session/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'wrong origin',
      prepare: async (file) => writeFile(file, JSON.stringify(sessionFor('https://wrong.example')), 'utf8'),
      expected: /origin/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'missing token',
      prepare: async (file, base) => writeFile(file,
        JSON.stringify(sessionFor(base, { token: undefined })), 'utf8'),
      expected: /token|session/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'unexpected wallet field in session',
      prepare: async (file, base) => writeFile(file,
        JSON.stringify(sessionFor(base, { wallet: 'wallet-secret' })), 'utf8'),
      expected: /corrupt|session/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'action body smuggled into pending journal',
      prepare: async (file, base) => writeFile(file, JSON.stringify(sessionFor(base, {
        pending: {
          operationId: 'operation-1',
          turnId: 'turn-1',
          actionId: 'action-1',
          startedAt: '2026-08-25T00:00:00.000Z',
          body: { prompt: 'authored-secret' },
        },
      })), 'utf8'),
      expected: /corrupt|session/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'expired token',
      prepare: async (file, base) => writeFile(file, JSON.stringify(sessionFor(base)), 'utf8'),
      expected: /401|unauthorized|expired/i,
      sessionStatus: 401,
      expectedProbeCalls: 1,
    },
    {
      name: 'transient probe failure',
      prepare: async (file, base) => writeFile(file, JSON.stringify(sessionFor(base)), 'utf8'),
      expected: /503|unavailable|verify/i,
      sessionStatus: 503,
      expectedProbeCalls: 1,
    },
  ];

  for (const testCase of cases) {
    const dir = await mkdtemp(join(tmpdir(), 'omerta-agent-alpha-session-'));
    const sessionFile = join(dir, 'session.json');
    const reportFile = join(dir, 'report.jsonl');
    const api = await probeApi({ sessionStatus: testCase.sessionStatus });
    try {
      await testCase.prepare(sessionFile, api.baseUrl);
      await assert.rejects(
        runAgentAlpha({
          baseUrl: api.baseUrl,
          sessionFile,
          reportFile,
          create: true,
          name: 'Replacement Machine',
          maxActions: 1,
          intervalMs: 0,
          sleep: async () => {},
        }),
        testCase.expected,
        `${testCase.name} fails closed instead of replacing the bound identity`,
      );
      assert.equal(api.state.guestCalls, 0,
        `${testCase.name} never creates a replacement guest`);
      assert.equal(api.state.sessionCalls, testCase.expectedProbeCalls,
        `${testCase.name} performs only the safe verification work expected`);
      assert.equal(api.state.turnCalls, 0,
        `${testCase.name} never reaches the autonomous loop`);
      assert.equal(api.state.actCalls, 0,
        `${testCase.name} never mutates game state`);
    } finally {
      await api.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
}

async function duplicateLockTest() {
  const dir = await mkdtemp(join(tmpdir(), 'omerta-agent-alpha-lock-'));
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  const api = await probeApi();
  try {
    await writeFile(sessionFile, JSON.stringify(sessionFor(api.baseUrl)), 'utf8');
    await writeFile(`${sessionFile}.lock`, JSON.stringify({ pid: process.pid }), 'utf8');
    await assert.rejects(
      runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 0,
        sleep: async () => {},
      }),
      /lock|already running|duplicate/i,
      'an existing process lock prevents a duplicate runner',
    );
    assert.equal(api.state.sessionCalls, 0,
      'the duplicate process exits before reading or mutating remote state');
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const ALLOWED_KINDS = [
  'onboard_claim', 'daily_claim', 'career_claim',
  'business_collect', 'territory_collect', 'kitchen_collect', 'convoy_collect',
  'convoy_travel', 'market_fill', 'arbitrage_buy', 'arbitrage_sell',
  'arbitrage_travel', 'loan_repay', 'crew_recruiting', 'crime',
];

async function actionApi({ kinds = ['crime'], policy = POLICY } = {}) {
  const app = Fastify({ logger: false });
  const state = { turnCalls: 0, actCalls: 0, actKeys: [], actBodies: [] };
  app.get('/v1/session', async () => ({
    authed: true,
    hasCharacter: true,
    agent: true,
    character: { id: 'character-id-secret', name: 'Alpha Machine', generation: 1 },
  }));
  app.get('/v1/agent/turn', async () => {
    const index = state.actCalls;
    state.turnCalls += 1;
    if (index >= kinds.length) {
      return { turnId: `turn-${index}`, recommendedActionId: null, policy, actions: [] };
    }
    const kind = kinds[index];
    return {
      turnId: `turn-${index}`,
      recommendedActionId: `action-${index}`,
      policy,
      actions: [{
        id: `action-${index}`,
        kind,
        method: 'DELETE',
        path: '/v1/forbidden-direct-mutation',
        body: { prompt: 'never trust or report action bodies' },
        executable: true,
      }],
    };
  });
  app.post('/v1/agent/act', async (req) => {
    state.actKeys.push(req.headers['idempotency-key']);
    state.actBodies.push(req.body);
    state.actCalls += 1;
    return { actionId: req.body.actionId, result: { ok: true }, turn: null };
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => app.close(),
  };
}

async function withReadySession(api, prefix, callback) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  await writeFile(sessionFile, JSON.stringify(sessionFor(api.baseUrl)), 'utf8');
  try {
    return await callback({ sessionFile, reportFile });
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function exactAllowlistTest() {
  const api = await actionApi({ kinds: ALLOWED_KINDS });
  await withReadySession(api, 'omerta-agent-alpha-allowlist-', async ({ sessionFile, reportFile }) => {
    const delays = [];
    const summary = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: ALLOWED_KINDS.length,
      sleep: async (ms) => { delays.push(ms); },
    });
    assert.equal(summary.actions, ALLOWED_KINDS.length,
      'every and only the exact design allowlist can execute through Agent Turn');
    assert.equal(api.state.actCalls, ALLOWED_KINDS.length,
      'each allowlisted recommendation is sent to the authoritative /v1/agent/act seam');
    assert.deepEqual(api.state.actBodies,
      ALLOWED_KINDS.map((_, index) => ({ turnId: `turn-${index}`, actionId: `action-${index}` })),
      'the runner sends only server-issued turn/action identifiers, never descriptor method/path/body');
    assert.deepEqual(delays, Array(ALLOWED_KINDS.length).fill(3100),
      'every real mutation attempt observes the conservative 3100ms cadence, including process starts');
  });
}

async function safetyRefusalTest() {
  const cases = [
    {
      name: 'non-allowlisted PvP recommendation',
      kinds: ['pvp_attack'],
      policy: POLICY,
      errorCode: 'unsafe_action',
    },
    {
      name: 'allowPvP policy mismatch',
      kinds: ['crime'],
      policy: { ...POLICY, allowPvP: true },
      errorCode: 'policy_mismatch',
    },
    {
      name: 'allowBorrowing policy mismatch',
      kinds: ['crime'],
      policy: { ...POLICY, allowBorrowing: true },
      errorCode: 'policy_mismatch',
    },
    {
      name: 'cash reserve policy mismatch',
      kinds: ['crime'],
      policy: { ...POLICY, cashReserve: 999 },
      errorCode: 'policy_mismatch',
    },
  ];

  for (const testCase of cases) {
    const api = await actionApi(testCase);
    await withReadySession(api, 'omerta-agent-alpha-refusal-', async ({ sessionFile, reportFile }) => {
      const summary = await runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 0,
        sleep: async () => {},
      });
      assert.equal(summary.actions, 0, `${testCase.name} exits without a mutation`);
      assert.equal(api.state.actCalls, 0, `${testCase.name} never reaches /v1/agent/act`);
      const records = (await readFile(reportFile, 'utf8')).trim().split('\n').map(JSON.parse);
      assert.equal(records.at(-1).status, 'refused', `${testCase.name} is recorded as a refusal`);
      assert.equal(records.at(-1).errorCode, testCase.errorCode,
        `${testCase.name} has a stable, non-sensitive refusal code`);
    });
  }
}

async function boundsTest() {
  for (const maxActions of [0, 51, 1.5, Number.NaN]) {
    const api = await actionApi();
    await withReadySession(api, 'omerta-agent-alpha-bounds-', async ({ sessionFile, reportFile }) => {
      await assert.rejects(
        runAgentAlpha({
          baseUrl: api.baseUrl,
          sessionFile,
          reportFile,
          maxActions,
          intervalMs: 0,
          sleep: async () => {},
        }),
        /maxActions|1.*50|action budget/i,
        `the finite budget rejects ${String(maxActions)}`,
      );
      assert.equal(api.state.turnCalls, 0,
        'invalid action budgets fail before any autonomous observation');
    });
  }

  const api = await actionApi();
  await withReadySession(api, 'omerta-agent-alpha-cadence-', async ({ sessionFile, reportFile }) => {
    await assert.rejects(
      runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3000,
      }),
      /3100|interval|cadence/i,
      'a real runner cannot lower the successful-mutation cadence below 3100ms',
    );
    assert.equal(api.state.turnCalls, 0,
      'an unsafe production cadence fails before an autonomous observation');
  });
}

async function recoveryApi({ staleFirst = false } = {}) {
  const app = Fastify({ logger: false });
  const state = { turnCalls: 0, actCalls: 0, actKeys: [], actBodies: [] };
  const turn = (index) => ({
    turnId: `recovery-turn-${index}`,
    recommendedActionId: `recovery-action-${index}`,
    policy: POLICY,
    actions: [{
      id: `recovery-action-${index}`,
      kind: index === 0 ? 'crime' : 'daily_claim',
      method: 'POST',
      path: '/ignored',
      body: { accountId: 'account-id-secret', prompt: 'authored-secret' },
      executable: true,
    }],
  });
  app.get('/v1/session', async () => ({
    authed: true,
    hasCharacter: true,
    agent: true,
    character: { id: 'character-id-secret', name: 'Alpha Machine', generation: 1 },
    wallet: 'wallet-secret',
  }));
  app.get('/v1/agent/turn', async () => {
    state.turnCalls += 1;
    return turn(0);
  });
  app.post('/v1/agent/act', async (req, reply) => {
    state.actCalls += 1;
    state.actKeys.push(req.headers['idempotency-key']);
    state.actBodies.push(req.body);
    if (staleFirst && state.actCalls === 1) {
      return reply.code(409).send({
        error: 'stale_turn',
        message: 'replacement available',
        turn: turn(1),
      });
    }
    if (!staleFirst && state.actCalls === 1) {
      reply.hijack();
      reply.raw.destroy();
      return;
    }
    return {
      actionId: req.body.actionId,
      result: { ok: true, characterId: 'character-id-secret' },
      turn: { turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [] },
    };
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => app.close(),
  };
}

async function ambiguousMutationRecoveryTest() {
  const api = await recoveryApi();
  await withReadySession(api, 'omerta-agent-alpha-ambiguous-', async ({ sessionFile, reportFile }) => {
    await assert.rejects(
      runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 0,
        sleep: async () => {},
      }),
      /fetch|socket|other side|terminated/i,
      'an ambiguous connection loss is surfaced rather than guessed successful or failed',
    );
    const journaled = JSON.parse(await readFile(sessionFile, 'utf8'));
    assert.deepEqual(Object.keys(journaled.pending).sort(),
      ['actionId', 'operationId', 'startedAt', 'turnId'].sort(),
      'the durable pre-mutation journal contains only the logical operation replay fields');
    assert.equal(journaled.pending.turnId, 'recovery-turn-0',
      'the turn identifier is durable before the ambiguous POST');
    assert.equal(journaled.pending.actionId, 'recovery-action-0',
      'the action identifier is durable before the ambiguous POST');

    const resumed = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: 1,
      intervalMs: 0,
      sleep: async () => {},
    });
    assert.equal(resumed.actions, 1,
      'a resumed ambiguous operation consumes one finite action after idempotent confirmation');
    assert.equal(api.state.turnCalls, 1,
      'restart retries the journaled operation before fetching or inventing a new turn');
    assert.equal(api.state.actCalls, 2,
      'the ambiguous logical operation is attempted exactly once per finite invocation');
    assert.equal(api.state.actKeys[0], api.state.actKeys[1],
      'an ambiguous retry reuses the exact same idempotency key');
    assert.deepEqual(api.state.actBodies[0], api.state.actBodies[1],
      'an ambiguous retry reuses the exact journaled turn/action pair');
    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null,
      'the journal clears only after the retry receives an authoritative response');
    const report = await readFile(reportFile, 'utf8');
    for (const forbidden of [
      'agent-token-secret', 'wallet-secret', 'account-id-secret',
      'character-id-secret', 'authored-secret', 'authorization',
    ]) {
      assert.equal(report.includes(forbidden), false,
        `ambiguous recovery telemetry excludes ${forbidden}`);
    }
  });
}

async function staleReplacementTest() {
  const api = await recoveryApi({ staleFirst: true });
  await withReadySession(api, 'omerta-agent-alpha-stale-', async ({ sessionFile, reportFile }) => {
    const summary = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: 1,
      intervalMs: 0,
      sleep: async () => {},
    });
    assert.equal(summary.actions, 1,
      'a stale non-mutation does not consume the finite successful-action budget');
    assert.equal(api.state.turnCalls, 1,
      'the runner consumes the server-provided stale replacement without an extra turn read');
    assert.equal(api.state.actCalls, 2,
      'the replacement recommendation executes once after the stale refusal');
    assert.notEqual(api.state.actKeys[0], api.state.actKeys[1],
      'a replacement recommendation is a new logical operation with a fresh key');
    assert.deepEqual(api.state.actBodies, [
      { turnId: 'recovery-turn-0', actionId: 'recovery-action-0' },
      { turnId: 'recovery-turn-1', actionId: 'recovery-action-1' },
    ], 'the stale response cannot replay a sibling from the invalidated turn');
    const records = (await readFile(reportFile, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(records.map((record) => record.status), ['stale', 'executed'],
      'redacted telemetry distinguishes a stale non-mutation from the eventual success');
  });
}

async function phaseRecoveryApi({ initialPhase }) {
  const app = Fastify({ logger: false });
  const state = {
    agent: initialPhase === 'agent',
    hasCharacter: false,
    agentKeyCalls: 0,
    characterCalls: 0,
  };
  app.get('/v1/session', async (req, reply) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!['guest-token-secret', 'agent-token-secret'].includes(token)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    return {
      authed: true,
      agent: state.agent,
      hasCharacter: state.hasCharacter,
      character: state.hasCharacter
        ? { id: 'character-id-secret', name: 'Alpha Machine', generation: 1 }
        : null,
    };
  });
  app.post('/v1/auth/agent-key', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer guest-token-secret');
    state.agentKeyCalls += 1;
    state.agent = true;
    return { token: 'agent-token-secret', agent: true };
  });
  app.post('/v1/character', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer agent-token-secret');
    assert.equal(req.body.name, 'Alpha Machine');
    state.characterCalls += 1;
    state.hasCharacter = true;
    return { id: 'character-id-secret', name: 'Alpha Machine' };
  });
  app.get('/v1/agent/turn', async () => ({
    turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [],
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => app.close(),
  };
}

async function phaseRecoveryTest() {
  for (const phase of ['guest', 'agent']) {
    const api = await phaseRecoveryApi({ initialPhase: phase });
    await withReadySession(api, 'omerta-agent-alpha-phase-', async ({ sessionFile, reportFile }) => {
      await writeFile(sessionFile, JSON.stringify(sessionFor(api.baseUrl, {
        phase,
        token: phase === 'guest' ? 'guest-token-secret' : 'agent-token-secret',
      })), 'utf8');
      const summary = await runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 0,
        sleep: async () => {},
      });
      assert.equal(summary.actions, 0,
        `a durable ${phase} phase resumes setup and reaches an idle turn`);
      assert.equal(api.state.agentKeyCalls, phase === 'guest' ? 1 : 0,
        `a ${phase} phase performs only the unfinished agent-key transition`);
      assert.equal(api.state.characterCalls, 1,
        `a ${phase} phase finishes the one stored character creation`);
      assert.deepEqual(JSON.parse(await readFile(sessionFile, 'utf8')), {
        version: 1,
        base: api.baseUrl,
        phase: 'agent',
        token: 'agent-token-secret',
        characterName: 'Alpha Machine',
        pending: null,
      }, `a ${phase} recovery stores no response account/character identifiers`);
    });
  }
}

async function runCli(args, env) {
  const script = fileURLToPath(new URL('../tools/agent-alpha.js', import.meta.url));
  const child = spawn(process.execPath, [script, ...args], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolveExit) => child.once('exit', resolveExit));
  return { code, stdout, stderr };
}

async function cliContractTest() {
  const api = await probeApi();
  await withReadySession(api, 'omerta-agent-alpha-cli-', async ({ sessionFile, reportFile }) => {
    const result = await runCli([
      '--session', sessionFile,
      '--report', reportFile,
      '--max-actions', '1',
    ], { OMERTA_BASE_URL: api.baseUrl });
    assert.equal(result.code, 0, `the finite CLI exits cleanly: ${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout), { status: 'complete', actions: 0 },
      'the CLI exposes the finite runner summary as JSON');

    const reset = await runCli([
      '--session', sessionFile,
      '--report', reportFile,
      '--reset',
    ], { OMERTA_BASE_URL: api.baseUrl });
    assert.equal(reset.code, 1, 'the CLI exposes no identity-reset path');
    assert.equal(reset.stderr.trim(), 'agent_alpha_error',
      'CLI failures print only a stable non-sensitive code');
  });
}

await lifecycleTest();
await failClosedSessionTest();
await duplicateLockTest();
await exactAllowlistTest();
await safetyRefusalTest();
await boundsTest();
await ambiguousMutationRecoveryTest();
await staleReplacementTest();
await phaseRecoveryTest();
await cliContractTest();
console.log('agent-alpha tests passed');
