import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdtemp, writeFile, unlink, rmdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createBusinessObserver, createBusinessObserverForTest, readBusinessRecord } from '../tools/business-agent.js';

const token = 'private-business-test-token';
const baseUrl = 'https://omerta.test';
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const fixture = {
  version: 1, asOf: new Date().toISOString(), accountId: 'account-1', mode: 'shadow', resourceMode: 'test',
  treasury: { availableUsdMicros: 100000, reservedUsdMicros: 0, frozen: false },
  policy: { enabled: true, revision: 1, providers: [], dailyAuthorizedUsdMicros: 0,
    maxPerCallUsdMicros: 100000, maxPerDayUsdMicros: 1000000, minimumReserveUsdMicros: 0,
    expiresAt: new Date(Date.now() + 86400000).toISOString() },
  service: null, capacity: { activeJobs: 0, remainingCapacity: 3 }, commitments: { pendingAwardBids: 0 }, bounties: [],
  jobs: [], calls: [], customers: [], catalog: [], providerOutcomes: [],
  totals: { jobsByState: {}, settledCustomerRevenueUsdMicros: 0, settledPaidComputeCostsUsdMicros: 0,
    heldPaidComputeUsdMicros: 0, unresolvedPaidCalls: 0, simulatedPaidCalls: 0, outsideCostsComplete: false },
  coverage: {}, causalEffect: null, profitabilityKnown: false,
  question: 'private-business-question', report: token,
};
let now = 0; const calls = [];
const run = createBusinessObserverForTest({ baseUrl, token, samples: 3,
  fetchImpl: async (url, init) => {
    calls.push({ url, init, at: now });
    assert.equal(url, `${baseUrl}/v1/resources/business`);
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
    assert.equal(init.headers.authorization, `Bearer ${token}`);
    assert(init.signal instanceof AbortSignal);
    return json(fixture);
  } }, { now: () => now, sleep: async ms => { now += ms; } });
const result = await run();
assert.equal(result.mode, 'shadow'); assert.equal(result.financialRequests, 0);
assert.equal(result.samples.length, 3); assert.equal(result.samples[0].comparison, null);
assert(Buffer.byteLength(JSON.stringify(result)) + 1 <= 1048576, 'every emitted record including its newline fits the previous-record reader');
assert(!JSON.stringify(result).includes(token));
assert(!JSON.stringify(result).includes('private-business-question'));
assert.equal(calls.length, 3);
const nextFixture = { ...fixture, totals: { ...fixture.totals, settledCustomerRevenueUsdMicros: 10000 } };
const continued = await createBusinessObserverForTest({ baseUrl, token,
  previousEvaluation: result.samples.at(-1).evaluation, fetchImpl: async () => json(nextFixture) },
{ now: () => 0, sleep: async () => {} })();
assert.equal(continued.samples[0].comparison.observedDelta.settledCustomerRevenueUsdMicros, 10000);
await assert.rejects(createBusinessObserverForTest({ baseUrl, token,
  previousEvaluation: result.samples[0].evaluation,
  fetchImpl: async () => json({ ...fixture, accountId: 'other-account' }) },
{ now: () => 0, sleep: async () => {} }), /comparison/);
const recordDirectory = await mkdtemp(join(tmpdir(), 'omerta-business-record-'));
const paths = ['previous.json', 'invalid.json', 'large.json', 'link.json'].map(name => join(recordDirectory, name));
try {
  await writeFile(paths[0], JSON.stringify(result), { mode: 0o600, flag: 'wx' });
  assert.deepEqual(await readBusinessRecord(paths[0]), result.samples.at(-1).evaluation);
  await writeFile(paths[1], '{malformed', { mode: 0o600, flag: 'wx' });
  await assert.rejects(() => readBusinessRecord(paths[1]));
  await writeFile(paths[2], 'x'.repeat(1048577), { mode: 0o600, flag: 'wx' });
  await assert.rejects(() => readBusinessRecord(paths[2]), /record/);
  await assert.rejects(() => readBusinessRecord(recordDirectory), /record/);
  try {
    await symlink(paths[0], paths[3], 'file');
    await assert.rejects(() => readBusinessRecord(paths[3]), /record/);
  } catch (error) { if (!['EPERM', 'EACCES'].includes(error.code)) throw error; }
} finally {
  for (const path of paths) { try { await unlink(path); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  await rmdir(recordDirectory);
}
for (let i = 1; i < calls.length; i++) assert(calls[i].at - calls[i - 1].at >= 3100);
for (const invalidBase of ['http://omerta.test', 'https://u:p@omerta.test', 'https://omerta.test/path', 'https://omerta.test/?x=1']) {
  assert.throws(() => createBusinessObserver({ baseUrl: invalidBase, token }));
}
for (const invalidSamples of [0, 21, 1.5, Infinity]) assert.throws(() => createBusinessObserver({ baseUrl, token, samples: invalidSamples }));
assert.throws(() => createBusinessObserver({ baseUrl, token: 'bad\ntoken' }));
assert.throws(() => createBusinessObserver({ baseUrl, token, policy: { unknownOption: true } }));
assert.throws(() => createBusinessObserverForTest({ baseUrl, token }, {}));
const testTiming = { now: () => 0, sleep: async () => {} };
for (const response of [new Response('x'.repeat(1048577)), new Response('{}', { status: 302 }), new Response('not-json')]) {
  const failed = createBusinessObserverForTest({ baseUrl, token, fetchImpl: async () => response }, testTiming);
  await assert.rejects(failed);
}
const redirected = json(fixture);
Object.defineProperty(redirected, 'url', { value: 'https://other.test/response' });
await assert.rejects(createBusinessObserverForTest({ baseUrl, token, fetchImpl: async () => redirected }, testTiming), /origin/);
await assert.rejects(createBusinessObserverForTest({ baseUrl, token, policy: { providerId: token },
  fetchImpl: async () => json(fixture) }, testTiming), /record/,
  'a credential embedded in a proposed output field must fail closed');
const productionStarts = [];
await createBusinessObserver({ baseUrl: 'http://127.0.0.1:8080', token, samples: 2,
  fetchImpl: async () => { productionStarts.push(performance.now()); return json(fixture); } })();
assert(productionStarts[1] - productionStarts[0] >= 3100, 'production cadence cannot be overridden by options');
let cliRequests = 0;
const server = createServer((req, res) => {
  cliRequests++;
  assert.equal(req.method, 'GET');
  assert.equal(req.url, '/v1/resources/business');
  assert.equal(req.headers.authorization, `Bearer ${token}`);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(fixture));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const cli = duty => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['tools/business-agent.js', '--base', `http://127.0.0.1:${server.address().port}`, '--duty', duty],
    { env: { ...process.env, OMERTA_BUSINESS_TOKEN: token }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  child.on('error', reject);
  child.on('close', code => resolve({ code, stdout, stderr }));
});
try {
  const focused = await cli('fulfillment');
  assert.equal(focused.code, 0, focused.stderr);
  const record = JSON.parse(focused.stdout);
  assert.equal(record.financialRequests, 0);
  assert.equal(record.samples[0].evaluation.policy.duty, 'fulfillment');
  assert(!focused.stdout.includes(token));
  const invalid = await cli('procurement');
  assert.equal(invalid.code, 1);
  assert.equal(invalid.stdout, '');
  assert.equal(invalid.stderr.trim(), 'business_agent_error');
  assert.equal(cliRequests, 1, 'invalid duty fails before any request');
} finally { await new Promise(resolve => server.close(resolve)); }
console.log('business-agent: finite read-only sampling, pacing, credential boundaries and bounded responses passed');
