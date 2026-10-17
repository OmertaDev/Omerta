import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { mock } from 'node:test';
import { promisify } from 'node:util';
import { createAgentAlphaTestRunner, recommendationOf } from '../tools/agent-alpha.js';
import { createWalletComputeAgentFetch, runWalletComputeAgent } from '../tools/wallet-compute-agent.js';

const origin = 'https://game.test', resourceUrl = 'https://compute.test/v1/chat/completions';
const authorization = 'Bearer private-game-token';
const policy = { cashReserve: 1000, minArbitrageProfit: 25, allowPvP: false, allowBorrowing: false };
const action = (id, kind = 'market_fill') => ({ id, kind, executable: true, method: 'POST',
  path: '/private/canonical-path', body: { private: 'canonical-body-secret' },
  ev: { cash: 200, inventory: -1, confidence: 0.9, treasury: Infinity, hiddenEstimate: 999 } });
const turn = (id = 'private-turn-identity') => ({ turnId: id, recommendedActionId: 'a', policy,
  state: { private: 'private-turn-state' }, actions: [action('a'), action('b')] });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status,
  headers: { 'content-type': 'application/json', 'content-length': '999', 'x-game-header': 'retained' } });
const responseOf = (input, content = '{"actionId":"b"}') => ({ attemptId: input.attemptId,
  state: 'response', amountHeldAtoms: '1', automaticRetry: false, settlementVerified: false,
  verifiedOnChainReceipt: null, gameOutcomeVerified: false,
  providerResult: { status: 200, body: { choices: [{ index: 0, finish_reason: 'stop',
    message: { role: 'assistant', content } }] } } });
const config = values => ({ enabled: true, baseUrl: origin, resourceUrl, model: 'reviewed/model',
  maxOutputTokens: 128, shouldRequest: () => true, ...values });

function fixture({ current = turn(), role = 'general', output, strategy = () => true, transform,
  client, fetchImpl } = {}) {
  const requests = [], observations = [], computeRequests = [];
  const computeClient = client ?? { async compute(input) {
    computeRequests.push(input);
    const value = responseOf(input, output);
    return transform ? transform(value) : value;
  } };
  const transport = fetchImpl ?? (async (input, init) => {
    requests.push({ input, init }); return json(current);
  });
  const wrapped = createWalletComputeAgentFetch(config({ computeClient, shouldRequest: strategy,
    role, fetchImpl: transport, onObservation: event => observations.push(event) }));
  return { wrapped, requests, observations, computeRequests };
}
const get = f => f.wrapped(origin + '/v1/agent/turn', { headers: { authorization } });

// Imports/configuration are inert and missing explicit owner policy never starts inference.
for (const change of [{ enabled: false }, { shouldRequest: undefined }, { computeClient: {} },
  { resourceUrl: origin + '/v1/resources/compute' }, { resourceUrl: 'https://compute.test/v1/resources/compute' },
  { resourceUrl: resourceUrl + '?key=secret' }, { resourceUrl: 'https://user:password@compute.test/v1/chat' },
  { baseUrl: origin + '/private' }, { maxOutputTokens: 0 }, { maxOutputTokens: 16385 },
  { model: '' }, { role: 'unknown' }, { apiKey: 'unsupported' }]) {
  assert.throws(() => createWalletComputeAgentFetch(config({ computeClient: { compute() {} }, ...change })));
}
let getters = 0;
assert.throws(() => createWalletComputeAgentFetch({ ...config({ computeClient: { compute() {} } }),
  get enabled() { getters++; return true; } }));
assert.equal(getters, 0);

const good = fixture({ strategy: frame => {
  assert(Object.isFrozen(frame) && Object.isFrozen(frame.candidates) && Object.isFrozen(frame.candidates[0].estimates));
  assert.deepEqual(Object.keys(frame), ['attemptId', 'candidates']);
  return true;
} });
const changedResponse = await get(good), changed = await changedResponse.json();
assert.equal(recommendationOf(changed).action, changed.actions[0]);
assert.equal(changed.recommendedActionId, 'b');
assert.deepEqual(changed.actions, [JSON.parse(JSON.stringify(action('b'))), JSON.parse(JSON.stringify(action('a')))]);
assert.equal(changed.turnId, turn().turnId);
assert.deepEqual(changed.state, turn().state);
assert.equal(changed.actions[0].decisionCall, undefined);
assert.equal(changedResponse.headers.get('content-length'), null);
assert.equal(changedResponse.headers.get('x-game-header'), 'retained');
assert.equal(good.computeRequests.length, 1);
const request = good.computeRequests[0], serialized = JSON.stringify(request);
assert.deepEqual(Object.keys(request).sort(), ['attemptId', 'body', 'resourceUrl']);
assert.deepEqual(Object.keys(request.body).sort(), ['max_tokens', 'messages', 'model', 'stream']);
assert.deepEqual(request.body.messages.map(m => m.role), ['user']);
for (const secret of ['private-game-token', 'canonical-body-secret', '/private/canonical-path',
  'private-turn-state', 'private-turn-identity', origin, 'hiddenEstimate']) assert(!serialized.includes(secret), secret);
assert.equal(request.body.max_tokens, 128);
assert.equal(request.body.stream, false);
assert.deepEqual(good.observations[0], { kind: 'wallet_compute_observation', attemptId: request.attemptId,
  state: 'response', selection: 'existing_action', evidence: 'local_observation', settlementVerified: false,
  gameOutcomeVerified: false, causalEffect: null, automaticRetry: false });
await get(good);
assert.equal(good.computeRequests.length, 1, 'same turn never repeats inference in one decorator');
const postInit = { method: 'POST', redirect: 'manual', headers: { authorization,
  'idempotency-key': 'original-operation', 'content-type': 'application/json' },
  body: '{"turnId":"old","actionId":"a"}' };
await good.wrapped(origin + '/v1/agent/act', postInit);
assert.equal(good.requests.at(-1).init, postInit, 'game POST forwarded with the original options object');
assert(!good.requests.some(r => String(r.input).includes('/v1/resources/compute')));

for (const output of ['{"actionId":"unknown"}', '{"actionId":"b","path":"/attack"}',
  '{"actionId":"b","decisionCall":{"callId":"fake"}}',
  '{"actionId":"a","actionId":"b"}', '{"actionId":2}', '["b"]', 'not-json',
  '{"actionId":"b"}'.repeat(200), '{"\\u0061ctionId":"b"}']) {
  const original = json(turn()), f = fixture({ output, fetchImpl: async () => original });
  assert.equal(await get(f), original);
  assert.equal(original.bodyUsed, false);
  await get(f);
  assert.equal(f.computeRequests.length, 1);
}
for (const transform of [r => ({ ...r, state: 'ambiguous' }), r => ({ ...r, state: 'refused' }),
  r => ({ ...r, attemptId: 'another-attempt' }), r => ({ ...r, automaticRetry: true }),
  r => ({ ...r, providerResult: { ...r.providerResult, status: 500 } }),
  r => { r.providerResult.body.choices.push(r.providerResult.body.choices[0]); return r; },
  r => { r.providerResult.body.choices[0].message.tool_calls = []; return r; },
  r => { r.providerResult.body.choices[0].message.role = 'user'; return r; },
  r => { r.providerResult.body.choices[0].finish_reason = 'length'; return r; }]) {
  const original = json(turn()), f = fixture({ transform, fetchImpl: async () => original });
  assert.equal(await get(f), original);
}
for (const strategy of [() => false, () => 'yes', () => { throw new Error('private-strategy-error'); }]) {
  const f = fixture({ strategy });
  assert.deepEqual(await (await get(f)).json(), JSON.parse(JSON.stringify(turn())));
  assert.equal(f.computeRequests.length, 0);
  assert(!JSON.stringify(f.observations).includes('private-strategy-error'));
}
for (const current of [{ ...turn(), recommendedActionId: null },
  { ...turn(), actions: [action('a')] }, { ...turn(), actions: [action('a'), action('a')] },
  { ...turn(), policy: { ...policy, allowPvP: true } },
  { ...turn(), actions: [action('a', 'borrow'), action('b')] },
  { ...turn(), actions: Array.from({ length: 33 }, (_, i) => action(String(i))), recommendedActionId: '0' }]) {
  const f = fixture({ current }); await get(f); assert.equal(f.computeRequests.length, 0);
}
for (const [input, init] of [[origin + '/v1/agent/turn?include=private', { headers: { authorization } }],
  [origin + '/v1/agent/turn#fragment', { headers: { authorization } }],
  [origin + '/v1/agent/turn', {}], [origin + '/v1/agent/turn', { headers: { authorization: 'Basic secret' } }],
  [origin + '/v1/agent/turn', { method: 'POST', headers: { authorization }, body: 'original' }]]) {
  const f = fixture(); await f.wrapped(input, init); assert.equal(f.computeRequests.length, 0);
  assert.equal(f.requests[0].init, init);
}
const cross = fixture();
await assert.rejects(() => cross.wrapped('https://other.test/v1/agent/turn', { headers: { authorization } }), /origin/);
assert.equal(cross.requests.length, 0);
await cross.wrapped('https://other.test/v1/agent/turn');
assert.equal(cross.computeRequests.length, 0);

const business = fixture({ role: 'business', current: { ...turn(),
  actions: [action('a', 'business_collect'), action('b', 'business_upkeep'), action('crime', 'crime')] } });
assert.equal(recommendationOf(await (await get(business)).json(), 'business').action.id, 'b');
const forbidden = fixture({ role: 'business', output: '{"actionId":"crime"}', current: { ...turn(),
  actions: [action('a', 'business_collect'), action('b', 'business_upkeep'), action('crime', 'crime')] } });
assert.equal(recommendationOf(await (await get(forbidden)).json(), 'business').action.id, 'a');
assert(!JSON.stringify(forbidden.computeRequests).includes('"id":"crime"'));
const supplierTurn = { ...turn(), observedAt: '2026-10-17T00:00:00.000Z',
  state: { identity: { id: 'supplier' } }, deliveries: [{ id: 'urgent', status: 'accepted', supplierId: 'supplier',
    remaining: 1, deadline: '2026-10-17T00:01:00.000Z' }], actions: [action('a', 'delivery_accept'),
    action('b'), action('delivery:urgent:deliver', 'delivery_deliver')] };
const supplier = fixture({ role: 'supplier', current: supplierTurn });
assert.equal(recommendationOf(await (await get(supplier)).json(), 'supplier').action.id, 'delivery:urgent:deliver');
assert.equal(supplier.computeRequests.length, 0, 'canonical obligation leaves no two selectable alternatives');

// Faithful durable-client boundary: same attempt IDs survive decorator replacement, so spend is refused.
const journal = new Set(), calls = [];
const durableClient = { async compute(input) {
  calls.push(input);
  if (journal.has(input.attemptId)) return { attemptId: input.attemptId, state: 'refused', automaticRetry: false };
  journal.add(input.attemptId); return responseOf(input);
} };
await get(fixture({ client: durableClient })); await get(fixture({ client: durableClient }));
assert.equal(calls[0].attemptId, calls[1].attemptId);
assert.equal(journal.size, 1);
const distinct = fixture({ client: durableClient, current: turn('another-turn') }); await get(distinct);
assert.equal(journal.size, 2);
const otherOrigin = 'https://other-game.test';
await createWalletComputeAgentFetch(config({ baseUrl: otherOrigin, computeClient: durableClient,
  fetchImpl: async () => json(turn()) }))(otherOrigin + '/v1/agent/turn', { headers: { authorization } });
assert.notEqual(calls[0].attemptId, calls.at(-1).attemptId, 'attempt identity binds the exact game origin');
const thrown = fixture({ client: { async compute() { throw new Error('private-provider-error'); } } });
assert.deepEqual(await (await get(thrown)).json(), JSON.parse(JSON.stringify(turn())));
assert(!JSON.stringify(thrown.observations).includes('private-provider-error'));
const asyncObservation = createWalletComputeAgentFetch(config({ computeClient: { async compute(input) { return responseOf(input); } },
  fetchImpl: async () => json(turn()), onObservation: async () => { throw new Error('local-observer-error'); } }));
assert.equal((await (await asyncObservation(origin + '/v1/agent/turn', { headers: { authorization } })).json()).recommendedActionId, 'b');
await new Promise(resolve => setImmediate(resolve));

// Advance actual outer timers without waiting or changing the production65s bound/client accounting.
for (const rejectLate of [false, true]) {
 let lateResolve, timeoutCalls = 0;
 mock.timers.enable({ apis: ['setTimeout'] });
 try {
  const original = json(turn());
  const timed = createWalletComputeAgentFetch(config({ computeClient: { compute(input) {
    timeoutCalls++; return new Promise((resolve, reject) => {
      lateResolve = () => rejectLate ? reject(new Error('late-provider-error')) : resolve(responseOf(input));
    });
  } }, fetchImpl: async () => original }));
  const pending = timed(origin + '/v1/agent/turn', { headers: { authorization } });
  for (let i = 0; i < 128 && !lateResolve; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof lateResolve, 'function');
  mock.timers.tick(65000);
  assert.equal(await pending, original);
  lateResolve(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(await timed(origin + '/v1/agent/turn', { headers: { authorization } }), original);
  assert.equal(timeoutCalls, 1, 'late success cannot apply a choice or repeat spending');
 } finally { mock.timers.reset(); }
}

async function privateDirectory() {
  const dir = await mkdtemp(join(tmpdir(), 'wallet-compute-alpha-test-'));
  if (process.platform === 'win32') await promisify(execFile)('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `
      $ErrorActionPreference='Stop'
      $target=$env:WALLET_ALPHA_TEST_DIR
      $user=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
      $acl=New-Object System.Security.AccessControl.DirectorySecurity
      $acl.SetOwner($user);$acl.SetAccessRuleProtection($true,$false)
      $inherit=[System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
      foreach($sid in @($user,[System.Security.Principal.SecurityIdentifier]'S-1-5-18',[System.Security.Principal.SecurityIdentifier]'S-1-5-32-544')){
        $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,[System.Security.AccessControl.FileSystemRights]::FullControl,$inherit,[System.Security.AccessControl.PropagationFlags]::None,[System.Security.AccessControl.AccessControlType]::Allow)
        $acl.AddAccessRule($rule)
      }
      (New-Object System.IO.DirectoryInfo($target)).SetAccessControl($acl)
    `], { env: { ...process.env, WALLET_ALPHA_TEST_DIR: dir }, windowsHide: true, timeout: 10000 });
  return dir;
}
async function runnerCase(pending = null) {
  const dir = await privateDirectory(), sessionFile = join(dir, 'session.json'), reportFile = join(dir, 'report.jsonl');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(sessionFile, JSON.stringify({ version: 1, base: origin, phase: 'agent',
    token: 'private-game-token', characterName: 'Wallet Alpha', pending }), { mode: 0o600 });
  const posts = [], local = [], starts = [];
  const fetchImpl = async (input, init) => {
    const path = new URL(input).pathname;
    assert.equal(init.headers.authorization, authorization);
    assert.equal(init.redirect, 'manual');
    if (path === '/v1/session') return json({ authed: true, agent: true, hasCharacter: true,
      character: { id: 'original-character', name: 'Wallet Alpha' } });
    if (path === '/v1/agent/turn') { starts.push(performance.now()); return json(turn()); }
    assert.equal(path, '/v1/agent/act'); starts.push(performance.now()); posts.push(init);
    return json({ ok: true });
  };
  try {
    const wallet = config({ computeClient: { async compute(input) { local.push(input); return responseOf(input); } }, fetchImpl });
    if (!pending) {
      const result = await runWalletComputeAgent({ alpha: { baseUrl: origin, sessionFile, reportFile,
        maxActions: 1, fetchImpl }, wallet });
      assert.deepEqual({ status: result.status, actions: result.actions }, { status: 'complete', actions: 1 });
      assert.equal(result.walletComputeObservations[0].selection, 'existing_action');
      assert(starts[1] - starts[0] >= 3000, 'production Alpha cadence remains active');
      assert.deepEqual(JSON.parse(posts[0].body), { turnId: turn().turnId, actionId: 'b' });
      assert.equal(local.length, 1);
    } else {
      let now = 0;
      const run = createAgentAlphaTestRunner({ now: () => now, sleep: async ms => { now += ms; } });
      await run({ baseUrl: origin, sessionFile, reportFile, maxActions: 1,
        fetchImpl: createWalletComputeAgentFetch(wallet) });
      assert.equal(local.length, 0, 'pending recovery does not request another inference');
      assert.deepEqual(JSON.parse(posts[0].body), { turnId: pending.turnId, actionId: pending.actionId });
      assert.equal(posts[0].headers['idempotency-key'], crypto.createHash('sha256').update(pending.operationId).digest('hex'));
    }
    assert.deepEqual(Object.keys(posts[0].headers).sort(), ['authorization', 'content-type', 'idempotency-key']);
    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null);
    assert(!String(await readFile(reportFile)).includes('private-game-token'));
  } finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert(basename(dir).startsWith('wallet-compute-alpha-test-'));
    await rm(dir, { recursive: true, force: true });
  }
}
await runnerCase();
await runnerCase({ operationId: 'original-operation', turnId: 'original-turn', actionId: 'original-action', startedAt: '2026-10-17T00:00:00Z' });
console.log('wallet compute agent: canonical selection, role/continuation/recovery, privacy, durable attempt and timeout controls passed; external network/signatures/payments0');
