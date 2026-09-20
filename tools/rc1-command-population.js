// RC1 proof harness: real HTTP handlers, real PostgreSQL, no SQL-created value.
// This is population entry/replay evidence, not an equilibrium or cohort model.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const population = Number(option('--players', '1000'));
const rounds = Number(option('--rounds', '2'));
const seed = option('--seed', 'rc1-entry-20260920');
const output = option('--output', 'docs/release/evidence/simulation/command-population.json');
assert(Number.isSafeInteger(population) && population > 0 && population <= 1000);
assert(Number.isSafeInteger(rounds) && rounds > 0 && rounds <= 20);
assert(seed && seed.length <= 128);
assert(process.env.DATABASE_URL, 'Real PostgreSQL is mandatory for RC1 population evidence');
const endpoint = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Use disposable local PostgreSQL');
assert(/^\/omerta_rc1_[a-z_0-9]+$/.test(endpoint.pathname), 'Use a dedicated omerta_rc1_ database');
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
process.env.MOD_KEY ||= crypto.randomBytes(32).toString('hex');
process.env.MARKET_SEED ||= crypto.createHash('sha256').update(seed).digest('hex');
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.RATE_LIMIT = 'off';
process.env.INVITE_MODE = 'off';
for (const flag of ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE',
  'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
delete process.env.COORDINATION_ACCOUNT_IDS;
let randomState = crypto.createHash('sha256').update(seed).digest().readUInt32LE();
const priorRandom = Math.random;
Math.random = () => {
  randomState = (randomState + 0x6D2B79F5) | 0;
  let value = Math.imul(randomState ^ randomState >>> 15, 1 | randomState);
  value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
};
const { buildServer } = await import('../src/server.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const report = {
  schemaVersion: 1, source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  seed, population, rounds, node: process.version, startedAt: new Date().toISOString(),
  engine: 'real PostgreSQL; Fastify production handlers through app.inject',
  scope: 'Fresh account/character entry, server-issued Player Commands and exact request replay',
  limitations: ['Sequential requests do not prove concurrent latency or locking.',
    'Seed fixes actor decisions and Math.random, not UUIDs, database time or scheduling.',
    'No model of aggression, Families, churn, resource equilibrium, workers or a real-player cohort.',
    'Only resources mutated by the recorded commands are exercised; static invariant passes do not prove every transition.'],
  commands: {}, requests: 0, transitions: 0, invariantAssertions: 0, replays: 0,
  playersWithoutCommand: [], latencyMs: [], history: [], failures: [],
};
await fs.mkdir(path.dirname(output), { recursive: true });
const tracePath = output.replace(/\.json$/, '') + '-transitions.ndjson';
await fs.writeFile(tracePath, '');
let app, previousChecks;
async function conservation(label) {
  const current = await runLedgerInvariants(app.pool, { alert: false });
  const failed = current.checks.filter((check) => !check.ok);
  report.invariantAssertions += current.checks.length;
  const changed = current.checks.flatMap((check) => {
    const prior = previousChecks?.get(check.name);
    if (prior && check.lhs === prior.lhs && check.rhs === prior.rhs) return [];
    return [{ name: check.name, before: prior?.lhs ?? null, after: check.lhs,
      accountedBefore: prior?.rhs ?? null, accountedAfter: check.rhs, drift: check.drift, ok: check.ok }];
  });
  await fs.appendFile(tracePath, JSON.stringify({ transition: report.transitions++, label, checked: current.checks.length, changed }) + '\n');
  assert.equal(failed.length, 0, `${label}: ${JSON.stringify(failed)}`);
  previousChecks = new Map(current.checks.map((check) => [check.name, check]));
  return current;
}
async function request(method, url, token, body, idempotencyKey) {
  const start = performance.now();
  const response = await app.inject({ method, url, payload: body, headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  } });
  report.requests++;
  if (url === '/v1/commands/execute') report.latencyMs.push(performance.now() - start);
  const result = response.json();
  assert.equal(response.statusCode, 200, `${method} ${url}: ${response.statusCode} ${JSON.stringify(result)}`);
  return result;
}
try {
  app = await buildServer();
  assert.equal(Number((await app.pool.query('SELECT count(*) AS count FROM accounts')).rows[0].count), 0,
    'This proof requires a fresh dedicated database');
  report.databaseVersion = (await app.pool.query('SHOW server_version')).rows[0].server_version;
  report.initialChecks = (await conservation('fresh bootstrap')).checks;
  const actors = [];
  for (let index = 0; index < population; index++) {
    const session = await request('POST', '/v1/auth/guest');
    const character = await request('POST', '/v1/character', session.token, { name: `RC1 Player ${index}` });
    actors.push({ index, token: session.token, characterId: character.id });
    await conservation(`player ${index} created`);
    if ((index + 1) % 25 === 0) console.log(JSON.stringify({ phase: 'created', players: index + 1, assertions: report.invariantAssertions }));
  }
  for (let round = 0; round < rounds; round++) for (const actor of actors) {
    const query = actor.graphId ? `?mysteryGraphId=${encodeURIComponent(actor.graphId)}` : '';
    const board = await request('GET', `/v1/commands${query}`, actor.token);
    const available = board.commands.filter((command) => command.availability === 'AVAILABLE');
    const prioritized = ['mystery.complete', 'mystery.discover', 'mystery.choice', 'discovery.act', 'discovery.start', 'mystery.start'];
    const command = available.sort((a, b) => {
      const rank = (entry) => { const index = prioritized.indexOf(entry.commandType); return index < 0 ? 100 : index; };
      return rank(a) - rank(b) || a.commandType.localeCompare(b.commandType);
    })[0];
    if (!command) {
      report.playersWithoutCommand.push({ player: actor.index, round, opportunities: board.opportunities.length,
        blockers: board.commands.map(({ commandType, availability, blockers }) => ({ commandType, availability, blockers })) });
      continue;
    }
    const key = command.executionIdentity.executionId;
    const body = { executionId: key, confirmed: true };
    const result = await request('POST', '/v1/commands/execute', actor.token, body, key);
    assert.equal(result.status, 'COMPLETED');
    report.commands[command.commandType] = (report.commands[command.commandType] || 0) + 1;
    if (command.commandType.startsWith('mystery.')) actor.graphId = command.parameters.graphId;
    report.history.push({ player: actor.index, round, command: command.commandType, parameters: command.parameters,
      executionId: key, result: result.status });
    await conservation(`player ${actor.index} round ${round} ${command.commandType}`);
    const replay = await request('POST', '/v1/commands/execute', actor.token, body, key);
    assert.equal(replay.replayed, true, 'A successful retry must return its prior receipt');
    report.replays++;
    await conservation(`player ${actor.index} round ${round} replay`);
    if ((actor.index + 1) % 25 === 0) console.log(JSON.stringify({ phase: 'commands', round, players: actor.index + 1, assertions: report.invariantAssertions }));
  }
  assert.equal(report.playersWithoutCommand.length, 0, 'Every sampled player must have a server-issued action');
  report.finalChecks = (await conservation('final')).checks;
  report.tableRows = (await app.pool.query(`SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname`)).rows;
  report.databaseBytes = Number((await app.pool.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes);
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.failures.push({ message: error.message, stack: error.stack });
  console.error(error);
  process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString();
  const latencies = report.latencyMs.sort((a, b) => a - b);
  report.commandLatency = { count: latencies.length, p50: latencies[Math.floor(latencies.length * .5)] ?? null,
    p95: latencies[Math.floor(latencies.length * .95)] ?? null, max: latencies.at(-1) ?? null };
  delete report.latencyMs;
  Math.random = priorRandom;
  if (app) await app.close();
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ok: report.ok, population, requests: report.requests, transitions: report.transitions,
    invariantAssertions: report.invariantAssertions, commands: report.commands, replays: report.replays,
    blockedPlayers: report.playersWithoutCommand.length, output }));
}
