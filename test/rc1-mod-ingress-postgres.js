// RC1-04-LEGACY-01: moderator authentication and limiter precede JSON parsing.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildServer } from '../src/server.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated loopback PostgreSQL required');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.COORDINATION_TEST_DATABASE_URL).hostname));
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
const { commandDatabase } = await import('./lib/player-command-support.js');
const directory = path.resolve(process.env.RC1_MOD_INGRESS_OUTPUT || 'output/rc1-mod-ingress');
fs.mkdirSync(directory, { recursive: true });
const output = path.join(directory, 'results.json'); assert(!fs.existsSync(output), 'Use a new evidence directory');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { status: 'RUNNING', finding: 'RC1-04-LEGACY-01', source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), startedAt: new Date().toISOString(), node: process.version,
  sourceFiles: Object.fromEntries(['src/server.js', 'src/routes/modtools.js', 'src/ratelimit.js', 'package-lock.json', 'test/rc1-mod-ingress-postgres.js'].map(file => [file, hash(file)])),
  scope: 'Native HTTP injection: pre-parser moderator mutation auth/rate boundary, authorized parsing and single audit. Not an internet/proxy load test.', cases: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2)); save();
for (const key of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[key] = crypto.randomBytes(32).toString('hex');
Object.assign(process.env, { RATE_LIMIT: 'on', RATE_AUTH_BURST: '2', RATE_AUTH_PER_SEC: '0.0001',
  SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on' }); delete process.env.REDIS_URL;
let db, app, releaseAudit;
try {
  db = await commandDatabase('mod_ingress');
  const schema = (await db.pool.query('SELECT current_schema() AS name')).rows[0].name;
  assert(/^command_mod_ingress_[a-f0-9]+$/.test(schema));
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = endpoint.toString(); app = await buildServer();
  report.postgres = (await db.pool.query('SELECT version() AS version')).rows[0].version;
  const actualRoutes = app.routes.filter(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method) && r.authKind === 'modAuth').map(r => `${r.method} ${r.url}`).sort();
  const expectedRoutes = JSON.parse(fs.readFileSync('docs/release/readiness-work/authority-inventory.json')).routes.filter(r => r.mountedAuth.authKind === 'modAuth').map(r => r.id).sort();
  assert.deepEqual(actualRoutes, expectedRoutes); report.moderatorRoutes = actualRoutes;
  // Production audits are intentionally best-effort asynchronous writes. Track
  // their real completion, rather than assuming an HTTP parser error waits for
  // the INSERT. No polling, fixed sleep, or change to production ordering.
  const auditWrites = [];
  const query = app.pool.query.bind(app.pool);
  let auditDelay = null;
  app.pool.query = (...args) => {
    if (!/^INSERT INTO mod_actions\b/i.test(typeof args[0] === 'string' ? args[0] : args[0]?.text || '')) return query(...args);
    const write = auditDelay ? auditDelay.then(() => query(...args)) : query(...args);
    auditWrites.push(write);
    return write;
  };
  const committedAudits = async () => Number((await query('SELECT count(*) AS n FROM mod_actions')).rows[0].n);
  const audits = async () => { await Promise.all(auditWrites); return committedAudits(); };
  const request = async (id, url, payload, expected, { authorized = false, ip = '127.0.0.10' } = {}) => {
    const response = await app.inject({ method: 'POST', url, payload, remoteAddress: ip,
      headers: { 'content-type': 'application/json', ...(authorized ? { 'x-mod-key': process.env.MOD_KEY } : {}) } });
    report.cases.push({ id, url, payloadBytes: Buffer.byteLength(payload), expected, actual: response.statusCode,
      response: response.json(), retryAfter: response.headers['retry-after'] || null }); save();
    assert.equal(response.statusCode, expected, `${id}: ${response.body}`); return response;
  };
  const malformed = ' '.repeat(1024 * 1024 + 100) + '{';
  await request('unauthorized-raised-parser-limit', '/v1/mod/drop/load', malformed, 401);
  await request('unauthorized-default-parser-limit', '/v1/mod/ban', malformed, 401);
  assert((await request('rate-budget-before-malformed-parser', '/v1/mod/drop/load', malformed, 429)).headers['retry-after']);
  assert.equal(await audits(), 0, 'rejected credentials/parser flood must never reach moderator audit');
  // The same route metadata protects the moderator control outside /v1/mod.
  await request('non-prefix-moderator-control', '/v1/rwa/ballots/2026-09-21/open', '{', 401, { ip: '127.0.0.11' });
  const authorized = { authorized: true, ip: '127.0.0.12' };
  const before = await audits();
  const allocation = JSON.stringify({ rows: [{ wallet: '0x1111111111111111111111111111111111111111', omr: 0 }] });
  // >1 MiB whitespace is valid JSON and must still reach the authorized loader.
  const parsed = await request('authorized-large-body-still-parses', '/v1/mod/drop/load', ' '.repeat(1024 * 1024 + 100) + allocation, 200, authorized);
  assert.equal(parsed.json().loaded, 1);
  await request('authorized-second-request-uses-one-token', '/v1/mod/drop/load', allocation, 200, authorized);
  assert.equal(await audits(), before + 2, 'onRequest and preHandler must produce one audit per authorized request');
  await request('authorized-third-request-exhausts-two-token-budget', '/v1/mod/drop/load', allocation, 429, authorized);
  assert.equal(await audits(), before + 2, 'rate rejection must not produce a moderator audit');
  await request('authorized-malformed-json-remains-parser-error', '/v1/mod/drop/load', '{', 400, { authorized: true, ip: '127.0.0.13' });
  assert.equal(await audits(), before + 3, 'admitted malformed attempt is audited once before parsing');
  // Causal control for the hosted PG18 race: keep this exact audit queued while
  // the parser returns its response. The former immediate count must be short
  // by one, then the unchanged INSERT must commit and satisfy the exact count.
  auditDelay = new Promise(resolve => { releaseAudit = resolve; });
  let deadline;
  try {
    await Promise.race([
      request('authorized-default-body-cap-remains', '/v1/mod/ban', malformed, 413, { authorized: true, ip: '127.0.0.14' }),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Parser response waited for deliberately delayed audit')), 5000); }),
    ]);
    const beforeRelease = await committedAudits();
    assert.equal(auditWrites.length, before + 4, 'all admitted attempts schedule exactly one audit');
    assert.equal(beforeRelease, before + 3, 'response can precede the fourth audit commit');
    assert.throws(() => assert.equal(beforeRelease, before + 4), assert.AssertionError);
    report.auditTimingControl = { delayedWrite: 4, responseBeforeCommit: true,
      formerImmediateAssertion: { expected: before + 4, actual: beforeRelease, status: 'EXPECTED_FAILURE' } };
  } finally { clearTimeout(deadline); releaseAudit(); auditDelay = null; }
  assert.equal(await audits(), before + 4);
  report.auditTimingControl.afterCompletionBarrier = { expected: before + 4, actual: await committedAudits(), status: 'PASS' };
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM bans')).rows[0].n), 0);
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM drop_allocations WHERE omr=0')).rows[0].n), 1);
  for (const [file, digest] of Object.entries(report.sourceFiles)) assert.equal(hash(file), digest);
  report.status = 'PASS_SCOPED'; report.sourceUnchanged = true; report.completedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: report.status, cases: report.cases.length, mountedModeratorMutations: actualRoutes.length, output }));
} catch (error) { report.status = 'FAIL'; report.error = { message: error.message, stack: error.stack }; save(); throw error; }
finally { releaseAudit?.(); if (app) { await app.close(); await app.pool.end(); } if (db) await db.cleanup(db.pool); }
