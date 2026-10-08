import assert from 'node:assert/strict';
import { createResourceAgentFetch, runPaidWork } from '../tools/resource-agent.js';

const baseUrl = 'https://omerta.test';
const headers = { authorization: 'Bearer private-token' };
const policy = { cashReserve: 1000, minArbitrageProfit: 25, allowPvP: false, allowBorrowing: false };
const action = (id, kind = 'market_fill', cash = 200) => ({ id, kind, executable: true,
  ev: { cash, inventory: -1 }, method: 'POST', path: '/v1/internal', body: { hidden: 'private-body' } });
const turn = (id = 'turn-0', cash = 1000) => ({ turnId: id, recommendedActionId: 'a', policy,
  state: { resources: { cash } }, actions: [action('a'), action('b')] });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'content-length': '999' } });

async function fixture({ output = '{"actionId":"b"}', status = 200, role = 'general', initial = turn(), fail = false } = {}) {
  const calls = []; const observations = []; let current = initial;
  const wrapped = createResourceAgentFetch({ baseUrl, providerId: 'metered', maxOutputTokens: 256, role,
    onObservation: event => observations.push(event), requestIdFactory: () => 'request-fixed',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/compute')) {
        if (fail) throw new Error('provider unknown');
        return json({ call: { id: 'call-1', output, costUsdMicros: 150 } }, status);
      }
      return json(current);
    } });
  return { wrapped, calls, observations, set: value => { current = value; } };
}

const good = await fixture();
const response = await good.wrapped(`${baseUrl}/v1/agent/turn`, { headers });
const changed = await response.json();
assert.equal(changed.recommendedActionId, 'b');
assert.deepEqual(changed.actions, [action('b'), action('a')]);
assert.equal(changed.turnId, 'turn-0');
assert.equal(response.headers.get('content-length'), null);
assert.equal(good.calls.length, 2);
const request = JSON.parse(good.calls[1].init.body);
assert.deepEqual(request.purpose, { kind: 'game_decision', turnId: 'turn-0', baselineActionId: 'a' });
assert.equal(request.requestId, 'request-fixed');
assert.equal(good.calls[1].init.headers.authorization, headers.authorization);
assert.equal(good.calls[1].init.redirect, 'error');
assert(!request.prompt.includes('private-body'));
assert(!request.prompt.includes('/v1/internal'));
assert(!JSON.stringify(good.observations).includes('private-token'));
await good.wrapped(`${baseUrl}/v1/agent/turn`, { headers });
assert.equal(good.calls.filter(c => c.url.endsWith('/compute')).length, 1, 'a repeated turn cannot repeat paid inference');
for (let i = 1; i <= 4; i++) {
  good.set({ ...turn(`turn-${i}`, 1000 + i * 20), actions: [] });
  await good.wrapped(`${baseUrl}/v1/agent/turn`, { headers });
}
assert.deepEqual(good.observations.at(-1), { kind: 'compute_outcome', callId: 'call-1', subsequentTurns: 4,
  gameCashChange: 80, costUsdMicros: 150, evidence: 'observational', causalEffect: null });

for (const output of ['{"actionId":"unknown"}', '{"actionId":"b","authority":true}', 'not-json', '["b"]', '{"actionId":2}']) {
  const f = await fixture({ output });
  assert.deepEqual(await (await f.wrapped(`${baseUrl}/v1/agent/turn`, { headers })).json(), turn());
}
for (const config of [{ status: 403 }, { status: 409 }, { fail: true }]) {
  const f = await fixture(config);
  assert.deepEqual(await (await f.wrapped(`${baseUrl}/v1/agent/turn`, { headers })).json(), turn());
  await f.wrapped(`${baseUrl}/v1/agent/turn`, { headers });
  assert.equal(f.calls.filter(c => c.url.endsWith('/compute')).length, 1);
}
for (const initial of [
  { ...turn(), actions: [action('a')] },
  { ...turn(), actions: [action('a', 'market_fill', 99), action('b')] },
  { ...turn(), actions: [action('a'), action('b', 'borrow')] },
  { ...turn(), policy: { ...policy, allowPvP: true } },
  { ...turn(), actions: [action('a'), action('a')] },
]) {
  const f = await fixture({ initial });
  await f.wrapped(`${baseUrl}/v1/agent/turn`, { headers });
  assert.equal(f.calls.length, 1);
}
const supplier = await fixture({ role: 'supplier', initial: { ...turn(), actions: [action('a'), action('b', 'crime')] } });
await supplier.wrapped(`${baseUrl}/v1/agent/turn`, { headers });
assert.equal(supplier.calls.length, 1);
const origin = await fixture();
await assert.rejects(() => origin.wrapped('https://evil.test/v1/agent/turn', { headers }), /origin/);
assert.equal(origin.calls.length, 0);
await origin.wrapped(`${baseUrl}/v1/agent/turn`);
assert.equal(origin.calls.length, 1, 'no authorization means no compute');
assert.throws(() => createResourceAgentFetch({ baseUrl: 'https://private@omerta.test', providerId: 'p', maxOutputTokens: 10 }));
assert.throws(() => createResourceAgentFetch({ baseUrl, providerId: 'p', maxOutputTokens: Infinity }));

const workCalls = [];
const work = await runPaidWork({ baseUrl, token: 'private-token', jobId: 'job-1', providerId: 'metered', maxOutputTokens: 20,
  fetchImpl: async (url, init) => { workCalls.push({ url, init }); return json({ job: { status: 'submitted' } }); } });
assert.equal(work.stage, 'work');
assert.equal(workCalls.length, 2);
assert.equal(workCalls[0].url, `${baseUrl}/v1/resources/jobs/job-1/claim`);
assert.equal(workCalls[1].url, `${baseUrl}/v1/resources/jobs/job-1/work`);
assert(!Object.hasOwn(JSON.parse(workCalls[1].init.body), 'prompt'), 'work context belongs to the server');
let unknownCalls = 0;
const unknown = await runPaidWork({ baseUrl, token: 't', jobId: 'job-1', providerId: 'metered', maxOutputTokens: 20,
  fetchImpl: async () => { unknownCalls++; throw new Error('unknown'); } });
assert.deepEqual(unknown, { stage: 'claim', pending: true, retry: false });
assert.equal(unknownCalls, 1);
let pendingCalls = 0;
const pending = await runPaidWork({ baseUrl, token: 't', jobId: 'job-1', providerId: 'metered', maxOutputTokens: 20,
  fetchImpl: async () => { pendingCalls++; return json({ pending: true }, 202); } });
assert.equal(pending.pending, true);
assert.equal(pendingCalls, 1, 'pending claim cannot start work');
console.log('resource-agent: compute selection, bounded authority, observations, and work recovery passed');
