// Native complement to the legacy MOD_KEY boundary: the four separately
// credentialed RWA reviewer mutations. This does not clear their domain effects.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildServer } from '../src/server.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated loopback PostgreSQL required');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.COORDINATION_TEST_DATABASE_URL).hostname));
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
const { commandDatabase, addPlayer } = await import('./lib/player-command-support.js');
const directory = path.resolve(process.env.RC1_REVIEWER_AUTHORITY_OUTPUT || 'output/rc1-reviewer-authority');
fs.mkdirSync(directory, { recursive: true }); fs.mkdirSync(path.join(directory, 'states'), { recursive: true });
const output = path.join(directory, 'results.json'); assert(!fs.existsSync(output), 'Use a new evidence directory');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const files = ['src/server.js', 'src/routes/rwa.js', 'src/preflight.js', 'src/ratelimit.js', 'package-lock.json', 'test/rc1-reviewer-authority-postgres.js'];
const report = { status: 'RUNNING', source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), node: process.version, startedAt: new Date().toISOString(),
  sourceFiles: Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(file))])), cases: [],
  scope: 'Four mounted RWA reviewer mutation credential boundaries on native PostgreSQL.',
  exclusions: ['Privileged nomination/health transitions', 'real catalog/provider/Safe execution', 'known foreign domain IDs behind authenticated reviewer authority', 'full529-route review'],
  configuration: 'Native private schema; distinct generated reviewer secret, public reviewer ID and MOD_KEY; external rails disabled; rate limiter disabled for credential probes.' };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2)); save();
for (const key of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY', 'RWA_REVIEWER_KEY']) process.env[key] = crypto.randomBytes(32).toString('hex');
process.env.RWA_REVIEWER_ID = 'rc1-native-reviewer';
for (const key of Object.keys(process.env)) if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(key)) delete process.env[key];
delete process.env.X_TRUST_USER_TOKEN;
Object.assign(process.env, { RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off' });
let db, app;
try {
  db = await commandDatabase('reviewer_authority');
  const schema = (await db.pool.query('SELECT current_schema() AS name')).rows[0].name;
  assert(/^command_reviewer_authority_[a-f0-9]+$/.test(schema));
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = endpoint.toString(); app = await buildServer();
  report.postgres = (await app.pool.query('SELECT version() AS version')).rows[0].version;
  await addPlayer(app.pool, 'reviewer-ordinary', 'Reviewer Ordinary', 'foundry');
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('reviewer-new','guest','reviewer-new')");
  const ordinary = app.jwt.sign({ sub: 'reviewer-ordinary', tv: 0 }), fresh = app.jwt.sign({ sub: 'reviewer-new', tv: 0 });
  const forged = app.jwt.sign({ sub: 'reviewer-ordinary', tv: 0, role: 'reviewer', reviewerId: process.env.RWA_REVIEWER_ID });
  const mounted = app.routes.filter(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method) && r.authKind === 'rwaReviewerAuth').map(r => `${r.method} ${r.url}`).sort();
  const expected = JSON.parse(fs.readFileSync('docs/release/readiness-work/authority-inventory.json')).routes.filter(r => r.mountedAuth.authKind === 'rwaReviewerAuth').map(r => r.id).sort();
  assert.deepEqual(mounted, expected); assert.equal(mounted.length, 4); report.routes = mounted;
  const tables = (await app.pool.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename', [schema])).rows.map(r => r.tablename);
  assert(tables.every(t => /^[a-z_0-9]+$/.test(t))); report.authorityTables = tables;
  const sql = tables.map(t => `SELECT '${t}' AS name, COALESCE(jsonb_agg(v ORDER BY v::text),'[]'::jsonb)::text AS rows FROM (SELECT to_jsonb(t) AS v FROM "${t}" t) q`).join(' UNION ALL ');
  const snapshot = async () => { const value = JSON.stringify((await app.pool.query(sql)).rows.sort((a, b) => a.name.localeCompare(b.name))), hash = sha(value);
    fs.writeFileSync(path.join(directory, 'states', `${hash}.json`), value); return hash; };
  for (const route of mounted) {
    const [method, pattern] = route.split(' '), url = pattern.replace(':id', 'unowned-review-target').replace(':assetVersionKey', `0x${'1'.repeat(64)}`);
    for (const [kind, headers] of [['unauthenticated', {}], ['new-account', { authorization: `Bearer ${fresh}` }],
      ['ordinary', { authorization: `Bearer ${ordinary}` }], ['forged-reviewer-jwt', { authorization: `Bearer ${forged}` }],
      ['MOD_KEY-not-reviewer', { 'x-mod-key': process.env.MOD_KEY }], ['wrong-reviewer-key', { 'x-rwa-reviewer-key': '0'.repeat(64) }],
      ['cookie-only-reviewer-CSRF', { cookie: `x-rwa-reviewer-key=${process.env.RWA_REVIEWER_KEY}`, origin: 'https://untrusted.invalid' }]]) {
      const beforeSha256 = await snapshot(), response = await app.inject({ method, url, headers: { ...headers, 'idempotency-key': crypto.randomUUID() }, payload: {} }), afterSha256 = await snapshot();
      report.cases.push({ route, kind, expected: 401, actual: response.statusCode, body: response.json(), beforeSha256, afterSha256 }); save();
      assert.equal(response.statusCode, 401, response.body); assert.deepEqual(response.json(), { error: 'rwa_reviewer_auth' }); assert.equal(afterSha256, beforeSha256);
    }
  }
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM rwa_nomination_reviewer_state_v2')).rows[0].n), 0, 'Rejected credentials never latch an identity');
  const admitted = await app.inject({ method: 'GET', url: '/v1/rwa/reviewer/queue', headers: { 'x-rwa-reviewer-key': process.env.RWA_REVIEWER_KEY } });
  assert.equal(admitted.statusCode, 200, admitted.body);
  assert.equal((await app.pool.query('SELECT reviewer_id FROM rwa_nomination_reviewer_state_v2 WHERE id=1')).rows[0].reviewer_id, process.env.RWA_REVIEWER_ID);
  report.positiveControl = 'Configured distinct credential reaches reviewer queue and latches the configured public identity; no mutation-domain execution inferred.';
  for (const [file, hash] of Object.entries(report.sourceFiles)) assert.equal(sha(fs.readFileSync(file)), hash);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), report.source);
  report.status = 'PASS_SCOPED'; report.sourceUnchanged = true; report.completedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: report.status, routes: mounted.length, denials: report.cases.length, tables: tables.length, source: report.source }));
} catch (error) { report.status = 'FAIL'; report.error = { message: error.message, stack: error.stack }; save(); throw error; }
finally { if (app) { await app.close(); await app.pool.end(); } if (db) await db.cleanup(db.pool); }
