import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createResourceDeliveryTestRunner, readAuthoredText } from '../tools/resource-deliver.js';

const dir = await mkdtemp(join(tmpdir(), 'omerta-delivery-'));
const file = join(dir, 'report'); const text = 'Private report\n€\n';
const token = 'secret-delivery-token'; const epoch = Date.now();
const job = (state = 'open') => ({ id: 'job-1', assignedToYou: true, fulfillment: 'authored', state,
  expiresAt: new Date(epoch + 100000).toISOString(), callId: null,
  ...(['submitted', 'accepted'].includes(state) ? { report: { source: 'account_authored', text, costUsdMicros: null } } : {}) });
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function fixture({ initial = job(), claim = job('claimed'), submit = job('submitted'), fail, httpStatus, response } = {}) {
  let now = 0; const calls = [];
  const run = createResourceDeliveryTestRunner({ baseUrl: 'https://omerta.test', jobId: 'job-1', file, token,
    fetchImpl: async (url, init) => {
      calls.push({ url, init, now });
      assert.equal(init.redirect, 'error'); assert.equal(init.headers.authorization, `Bearer ${token}`);
      assert(init.signal);
      if (fail === calls.length) throw new Error(`${token} ${text}`);
      if (response) return response();
      return json(calls.length === 1 ? { assignedJobs: [initial] } : { job: calls.length === 2 && initial.state === 'open' ? claim : submit }, httpStatus || 200);
    } }, { now: () => now, sleep: async ms => { now += ms; }, wallNow: () => epoch + now });
  return { run, calls };
}
try {
  await writeFile(file, text);
  const received = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    received.push({ path: req.url, authorization: req.headers.authorization, body });
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.url.endsWith('/claim') ? { resourceAction: 'claim', job: job('claimed') }
      : req.url.endsWith('/submit') ? { resourceAction: 'submit', job: job('submitted') } : { jobs: [job()] }));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  try {
    let localNow = 0;
    const local = createResourceDeliveryTestRunner({ baseUrl: `http://127.0.0.1:${server.address().port}`, jobId: 'job-1', file, token },
      { now: () => localNow, sleep: async ms => { localNow += ms; }, wallNow: () => epoch + localNow });
    assert.equal((await local()).state, 'submitted');
    assert.equal(received.length, 3); assert.equal(received[0].authorization, `Bearer ${token}`);
    assert.deepEqual(JSON.parse(received[2].body), { text });
    server.removeAllListeners('request'); server.on('request', (_req, res) => { res.writeHead(302, { location: 'https://other.test/' }); res.end(); });
    const redirect = createResourceDeliveryTestRunner({ baseUrl: `http://127.0.0.1:${server.address().port}`, jobId: 'job-1', file, token },
      { now: () => 0, sleep: async () => {}, wallNow: () => epoch });
    assert.equal((await redirect()).pending, false);
  } finally { await new Promise(done => server.close(done)); }
  assert.equal(await readAuthoredText(file), text);
  const good = fixture(); const receipt = await good.run();
  assert.deepEqual(receipt, { jobId: 'job-1', state: 'submitted', stage: 'submit', status: 200, pending: false, retry: false });
  assert.deepEqual(good.calls.map(call => call.now), [0, 3100, 6200]);
  assert.deepEqual(JSON.parse(good.calls[2].init.body), { text });
  await good.run(); assert.equal(good.calls.length, 3);
  for (const state of ['submitted', 'accepted']) {
    const replay = fixture({ initial: job(state) });
    assert.equal((await replay.run()).stage, 'reconcile'); assert.equal(replay.calls.length, 1);
    const conflict = fixture({ initial: { ...job(state), report: { ...job(state).report, text: 'changed' } } });
    assert.equal((await conflict.run()).stage, 'conflict'); assert.equal(conflict.calls.length, 1);
  }
  const claimed = fixture({ initial: job('claimed') }); assert.equal((await claimed.run()).state, 'submitted'); assert.equal(claimed.calls.length, 2);
  for (const initial of [{ ...job(), assignedToYou: false }, { ...job(), fulfillment: 'compute' }, { ...job(), fulfillment: undefined },
    { ...job(), expiresAt: new Date(epoch - 1).toISOString() }, job('disputed'), { ...job(), expiresAt: 'invalid' }]) {
    const refused = fixture({ initial }); await refused.run(); assert.equal(refused.calls.length, 1);
  }
  const expiresDuringPacing = fixture({ initial: { ...job(), expiresAt: new Date(epoch + 1000).toISOString() } });
  await expiresDuringPacing.run(); assert.equal(expiresDuringPacing.calls.length, 1);
  for (const fail of [1, 2, 3]) {
    const unknown = fixture({ fail }); const result = await unknown.run();
    assert.equal(result.pending, fail > 1); assert.equal(unknown.calls.length, fail);
    assert(!JSON.stringify(result).includes(token)); assert(!JSON.stringify(result).includes(text));
  }
  for (const claim of [job('open'), { ...job('claimed'), fulfillment: 'compute' }, { ...job('claimed'), assignedToYou: false }]) {
    const invalid = fixture({ claim }); assert.equal((await invalid.run()).pending, true); assert.equal(invalid.calls.length, 2);
  }
  for (const httpStatus of [401, 403, 409, 302]) {
    const rejected = fixture({ httpStatus }); await rejected.run(); assert.equal(rejected.calls.length, 1);
  }
  const invalidSubmission = fixture({ submit: { ...job('submitted'), report: { source: 'account_authored', text: 'changed', costUsdMicros: null } } });
  assert.equal((await invalidSubmission.run()).pending, true);
  assert.equal(invalidSubmission.calls.length, 3);
  const huge = fixture({ response: () => new Response('x'.repeat(1048577)) }); await huge.run(); assert.equal(huge.calls.length, 1);
  for (const baseUrl of ['https://other.test/path', 'http://other.test', 'https://user:secret@omerta.test', 'https://omerta.test?x=1']) {
    assert.throws(() => createResourceDeliveryTestRunner({ baseUrl, jobId: 'job-1', file, token }, {}));
  }
  for (const content of [Buffer.alloc(65537, 65), Buffer.from([0xff]), Buffer.from('  \n')]) {
    await writeFile(file, content); await assert.rejects(readAuthoredText(file));
  }
  await assert.rejects(readAuthoredText(dir));
  await writeFile(file, text);
  try {
    await symlink(file, join(dir, 'link')); await assert.rejects(readAuthoredText(join(dir, 'link')));
  } catch (error) { if (error.code !== 'EPERM') throw error; }
  const cli = spawnSync(process.execPath, ['tools/resource-deliver.js', '--token', token, '--job', 'job-1', '--file', file],
    { encoding: 'utf8', env: { ...process.env, OMERTA_RESOURCE_TOKEN: token } });
  assert.equal(cli.status, 1); assert(!`${cli.stdout}${cli.stderr}`.includes(token)); assert(!`${cli.stdout}${cli.stderr}`.includes(text));
  console.log('Authored delivery tests passed');
} finally { await rm(dir, { recursive: true, force: true }); }
