import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { acquireCohortLease, COHORT, runCohort } from '../tools/agent-cohort.js';

process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT = 'on';
delete process.env.DATABASE_URL;
const { buildServer } = await import('../src/server.js');
const temp = await mkdtemp(join(tmpdir(), 'omerta-cohort-test-'));
const stateRoot = join(temp, 'private'), out = join(temp, 'reports');
const app = await buildServer();
try {
  const dry = await runCohort({ stateRoot, out }, { runAgent: () => { throw new Error('Unarmed network call'); } });
  assert.equal(dry.status, 'not_armed');
  await app.listen({ host: '127.0.0.1', port: 0 });
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const result = await runCohort({ stateRoot, out, baseUrl, prepare: true, create: true,
    live: true, maxActions: 1, maxMinutes: 1 });
  assert.equal(result.results.length, 3);
  const ids = new Set();
  for (const role of COHORT) {
    const row = result.results.find((entry) => entry.role === role.id);
    assert.equal(row.posts, 1, `the ${role.id} identity sends exactly one bounded action POST`);
    const checkpointText = await readFile(join(out, `${role.id}.json`), 'utf8');
    const checkpoint = JSON.parse(checkpointText);
    assert.equal(checkpoint.agentMarked, true, 'every cohort identity is visibly an agent');
    assert.equal(checkpointText.includes('"token"'), false);
    assert.equal(checkpointText.includes('Bearer '), false);
    ids.add(checkpoint.identity);
    const session = JSON.parse(await readFile(join(stateRoot, role.id, 'session.json'), 'utf8'));
    assert.equal(session.phase, 'agent');
    assert.equal(session.pending, null);
  }
  assert.equal(ids.size, 3, 'roles retain three separate durable identities');
  const lead = JSON.parse(await readFile(join(out, 'lead.json'), 'utf8'));
  await rm(join(stateRoot, 'lead', 'session.json'));
  for (const role of ['economy', 'investigator']) {
    const path = join(out, `${role}.json`), data = JSON.parse(await readFile(path, 'utf8'));
    data.status = 'level_reached'; await writeFile(path, JSON.stringify(data));
  }
  const lost = await runCohort({ stateRoot, out, baseUrl, create: true, live: true, maxActions: 1 }, {
    runAgent: () => { throw new Error('Lost/terminal identity must not create a replacement'); },
  });
  assert.equal(lost.results.find((row) => row.role === 'lead').status, 'identity_lost');
  lead.status = 'level_reached'; lead.last.state.identity.level = 100;
  await writeFile(join(out, 'lead.json'), JSON.stringify(lead));
  const done = await runCohort({ stateRoot, out, baseUrl, live: true }, {
    runAgent: () => { throw new Error('Completed goal must stay stopped'); },
  });
  assert.equal(done.status, 'goal_reached');
  const leaseRoot = join(temp, 'lease-private'), leaseOut = join(temp, 'lease-reports');
  await runCohort({ stateRoot: leaseRoot, out: leaseOut, prepare: true });
  await writeFile(join(leaseOut, 'economy.json'), '{');
  let releaseWorkers, startedWorkers, held = 0;
  const gate = new Promise((done) => { releaseWorkers = done; });
  const started = new Promise((done) => { startedWorkers = done; });
  const active = runCohort({ stateRoot: leaseRoot, out: leaseOut, live: true, maxActions: 1 }, {
    runAgent: async () => { if (++held === 2) startedWorkers(); await gate; return { status: 'complete', actions: 0 }; },
  });
  await started;
  try {
    await assert.rejects(acquireCohortLease(leaseRoot), { code: 'EADDRINUSE' },
      'a corrupt checkpoint must not release the group lease while the other roles still run');
  } finally { releaseWorkers(); }
  const finished = await active;
  assert.equal(finished.results.find((row) => row.role === 'economy').status, 'needs_attention');
  console.log('agent-cohort tests passed: rate-on/no-DOB identities, bounded parallel play, no replacement, goal stop');
} finally {
  await app.close();
  assert.equal(resolve(dirname(temp)).toLowerCase(), resolve(tmpdir()).toLowerCase(), 'cleanup stays in its named temp root');
  await rm(temp, { recursive: true, force: true });
}
