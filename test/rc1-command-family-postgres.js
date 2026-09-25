// RC1-04: full-server native probes for item, recipe, world and situation authority.
// Declared canonical setup is separate from the measured HTTP denial/replay checks.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildServer } from '../src/server.js';
import { boostCar } from '../src/economy.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createDockWarDefinitions } from '../src/director/dock-war.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated loopback PostgreSQL required');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.COORDINATION_TEST_DATABASE_URL).hostname));
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
const { AUTHORITY_TABLES } = await import('./lib/rc1-authority-probes.js');
const { dockFixture, ids } = await import('./lib/director-support.js');
const { findCommand } = await import('./lib/player-command-support.js');
for (const flag of ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']) process.env[flag] = 'on';
Object.assign(process.env, { LIVING_WORLD_DIRECTOR: 'LIVE', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off' });
for (const key of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[key] = crypto.randomBytes(32).toString('hex');
delete process.env.COORDINATION_ACCOUNT_IDS; delete process.env.DIRECTOR_ACCOUNT_IDS;
const directory = path.resolve(process.env.RC1_COMMAND_FAMILY_OUTPUT || 'output/rc1-command-family');
fs.mkdirSync(directory, { recursive: true });
const output = path.join(directory, 'results.json');
assert(!fs.existsSync(output), 'Use a new output directory; failures must remain retained');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const tables = [...AUTHORITY_TABLES, 'cars', 'mystery_node_state', 'mystery_choices', 'world_recipe_usage', 'director_definitions', 'director_clock',
  'director_campaigns', 'director_situations', 'director_receipts', 'director_selections', 'director_action_intents'];
const report = { status: 'RUNNING', source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  harnessSha256: hash(fs.readFileSync(new URL(import.meta.url))), node: process.version, startedAt: new Date().toISOString(),
  sourceFiles: Object.fromEntries(['package-lock.json', 'src/player-commands.js', 'src/routes/commands.js', 'src/routes/world-kernel.js',
    'src/crafting.js', 'src/world-kernel.js', 'src/director/runtime.js', 'src/coordination/operations.js', 'src/coordination/knowledge.js']
    .map((file) => [file, hash(fs.readFileSync(file))])),
  scope: 'Native fixture-assisted HTTP command family denials, current authority and replay', tables,
  setup: 'Five funded actors; two Families/Crews created through canonical services; both bosses learn route evidence and salvage garage-acquired materials. Garage success pinned only during initial acquisition. One ungrouped actor owns a garage-acquired junker. No direct game-state rewrites after setup.',
  exclusions: ['all mounted routes', 'all command definitions and role combinations', 'all scarcity branches', 'physical/browser play', 'production configuration'],
  denials: [], successes: [], replays: [] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2)); save();
let f, app;
try {
  f = await dockFixture(`family_boundary_${crypto.randomBytes(4).toString('hex')}`);
  const { aBoss: owner, bBoss: rival, aRunner: member, outsider } = f.actors;
  for (const account of [owner, rival]) { await f.learn(account); await f.acquireMaterials(account); }
  await f.move(outsider, 'foundry');
  const random = Math.random; let acquired;
  try { Math.random = () => 0.01; acquired = await f.social(outsider, (ch, client, h) => boostCar(ch, client, h)); }
  finally { Math.random = random; }
  assert.equal(acquired.car?.model, 'junker');
  const schema = (await f.pool.query('SELECT current_schema() AS name')).rows[0].name;
  assert(/^command_family_boundary_[a-z0-9_]+$/.test(schema));
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = endpoint.toString(); app = await buildServer();
  report.postgres = (await app.pool.query('SELECT version() AS version')).rows[0].version;
  const tokens = Object.fromEntries(Object.values(f.actors).map((account) => [account, app.jwt.sign({ sub: account, tv: 0 })]));
  const request = (account, method, url, payload, key = crypto.randomUUID()) => app.inject({ method, url,
    headers: { authorization: `Bearer ${tokens[account]}`, ...(method === 'POST' ? { 'idempotency-key': key } : {}) },
    ...(payload === undefined ? {} : { payload }) });
  const ok = async (...args) => { const response = await request(...args); assert.equal(response.statusCode, 200, response.body); return response.json(); };
  const board = (account, query = '') => ok(account, 'GET', `/v1/commands${query}`);
  const state = async () => {
    const result = {};
    // No concurrent worker/gameplay runs. Preserve exact SQL numeric representation.
    for (const table of tables) result[table] = (await app.pool.query(`SELECT row_to_json(t)::text AS value FROM ${table} t`)).rows.map((row) => row.value).sort();
    return result;
  };
  const deny = async (id, status, ...args) => {
    const before = await state(), response = await request(...args), after = await state();
    const prefix = `denial-${String(report.denials.length + 1).padStart(2, '0')}`;
    fs.writeFileSync(path.join(directory, `${prefix}-before.json`), JSON.stringify(before));
    fs.writeFileSync(path.join(directory, `${prefix}-after.json`), JSON.stringify(after));
    const row = { id, method: args[1], route: args[2], expectedStatus: status, status: response.statusCode,
      response: response.json(), before: `${prefix}-before.json`, after: `${prefix}-after.json`,
      beforeSha256: hash(JSON.stringify(before)), afterSha256: hash(JSON.stringify(after)) };
    report.denials.push(row); save();
    assert.equal(response.statusCode, status, `${id}: ${response.body}`);
    assert.doesNotMatch(response.body, /SELECT |INSERT |UPDATE |definition_json|authorization_predicate|resolution_seed|pressureInputs/);
    assert.deepEqual(after, before, `${id}: denial changed authoritative state`);
    row.passed = true; save(); return response.json();
  };
  const body = (command) => ({ executionId: command.executionIdentity.executionId, confirmed: true });
  const execute = async (account, command) => {
    const result = await ok(account, 'POST', '/v1/commands/execute', body(command), command.executionIdentity.executionId);
    assert.equal(result.status, 'COMPLETED'); assert.equal(result.executionId, command.executionIdentity.executionId);
    report.successes.push({ type: command.commandType, executionId: result.executionId, replayed: result.replayed }); save(); return result;
  };
  const denyCommand = (id, account, command, extra = {}, status = 409) => deny(id, status, account, 'POST',
    '/v1/commands/execute', { ...body(command), ...extra }, command.executionIdentity.executionId);
  const boundary = async (account, command) => {
    await denyCommand(`${command.commandType}:stolen-identity`, account === outsider ? owner : outsider, command);
    await denyCommand(`${command.commandType}:authoritative-parameter-substitution`, account, command,
      { parameters: { ...command.parameters, accountId: outsider, cost: 0, quantity: 1000000 } }, 400);
  };
  const replay = async (account, command, stage) => {
    const before = await state(), result = await execute(account, command);
    assert.equal(result.replayed, true); assert.deepEqual(await state(), before, `${stage}: replay changed authority`);
    report.replays.push({ stage, type: command.commandType, executionId: result.executionId }); save();
  };
  const move = (account, district) => ok(account, 'POST', `/v1/travel/${district}`, {});

  const salvage = findCommand(await board(outsider), 'item.salvage', { carId: acquired.car.id });
  await boundary(outsider, salvage);
  await denyCommand('item.salvage:unconfirmed-consumption', outsider, salvage, { confirmed: false });
  await move(outsider, 'docks');
  await denyCommand('item.salvage:stale-location', outsider, salvage);
  await move(outsider, 'foundry');
  const currentSalvage = findCommand(await board(outsider), 'item.salvage', { carId: acquired.car.id });
  await execute(outsider, currentSalvage);
  assert.equal((await app.pool.query('SELECT id FROM cars WHERE id=$1', [acquired.car.id])).rowCount, 0);
  await replay(outsider, currentSalvage, 'consumed-car');

  const craft = findCommand(await board(owner), 'recipe.craft', { recipeId: ids.recipe });
  await boundary(owner, craft);
  await deny('recipe.craft:foreign-cost-and-output', 400, owner, 'POST', `/v1/worldgraph/kernel/recipes/${ids.recipe}/craft`, { cashCost: 0, outputs: [{ quantity: 1000000 }] });
  await move(owner, 'docks'); await denyCommand('recipe.craft:stale-location', owner, craft); await move(owner, 'foundry');
  const currentCraft = findCommand(await board(owner), 'recipe.craft', { recipeId: ids.recipe });
  await execute(owner, currentCraft); await replay(owner, currentCraft, 'consumed-materials');
  const rivalCraft = findCommand(await board(rival), 'recipe.craft', { recipeId: ids.recipe }); await execute(rival, rivalCraft);
  await move(owner, 'docks'); await move(rival, 'docks');
  const world = findCommand(await board(owner), 'world.execute', { objectId: ids.object, actionId: 'establish_route' });
  const rivalWorld = findCommand(await board(rival), 'world.execute', { objectId: ids.object, actionId: 'establish_route' });
  await boundary(owner, world);
  const route = `/v1/worldgraph/objects/${ids.object}/actions/establish_route`;
  await deny('world.execute:known-foreign-item', 404, rival, 'POST', route, { itemId: world.parameters.itemId, expectedRevision: 0 });
  // Idle is an explicitly public authored state; shortage requires route Knowledge.
  assert.equal((await ok(outsider, 'GET', `/v1/worldgraph/objects/${ids.object}`)).state, 'idle');
  await execute(owner, world);
  const hidden = await deny('world.execute:unknown-object-known-id', 404, outsider, 'GET', `/v1/worldgraph/objects/${ids.object}`);
  assert.deepEqual(await deny('world.execute:unknown-object-missing-id', 404, outsider, 'GET', '/v1/worldgraph/objects/missing-world-object'), hidden);
  await denyCommand('world.execute:competing-stale-world', rival, rivalWorld);
  await deny('world.execute:stale-authoritative-revision', 409, rival, 'POST', route,
    { itemId: rivalWorld.parameters.itemId, expectedRevision: 0 });
  await deny('world.execute:operation-proof-cannot-be-bypassed', 404, owner, 'POST', `/v1/worldgraph/objects/${ids.object}/actions/protect_shipment`,
    { itemId: rivalWorld.parameters.itemId, expectedRevision: 1 });
  await replay(owner, world, 'world-changed');

  const director = createLivingWorldDirector({ pool: f.pool, content: f.content, definitions: createDockWarDefinitions(f.content), mode: 'LIVE' });
  const situationId = (await director.tick()).selected[0].situationId;
  assert(!JSON.stringify(await board(outsider)).includes(situationId));
  const protect = findCommand(await board(owner), 'situation.act', { actionId: 'protect' });
  await boundary(owner, protect);
  await denyCommand('situation.act:member-cannot-borrow-leader-command', member, protect);
  await denyCommand('situation.act:rival-cannot-borrow-controller-command', rival, protect);
  const investigate = findCommand(await board(member), 'situation.act', { actionId: 'investigate' });
  await ok(member, 'POST', '/v1/crew/leave', {});
  await denyCommand('situation.act:crew-departure-invalidates-issued-rumor', member, investigate);
  await ok(owner, 'POST', '/v1/gangs/leave', {});
  await denyCommand('situation.act:family-departure-invalidates-issued-leadership', owner, protect);
  const rivalInvestigate = findCommand(await board(rival), 'situation.act', { actionId: 'investigate' });
  const discovered = await execute(rival, rivalInvestigate); assert(discovered.result.instanceId);
  await replay(rival, rivalInvestigate, 'situation-domain-receipt');
  await app.close(); await app.pool.end(); app = await buildServer();
  for (const [account, command] of [[outsider, currentSalvage], [owner, currentCraft], [owner, world], [rival, rivalInvestigate]])
    await replay(account, command, 'complete-server-reconstruction');
  report.invariants = { world: await worldKernelInvariants(app.pool), operations: await familyOperationInvariants(app.pool) };
  assert.equal(report.invariants.world.ok, true); assert.equal(report.invariants.operations.ok, true);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), report.source);
  for (const [file, digest] of Object.entries(report.sourceFiles)) assert.equal(hash(fs.readFileSync(file)), digest, `${file} changed during execution`);
  assert.equal(hash(fs.readFileSync(new URL(import.meta.url))), report.harnessSha256);
  report.sourceUnchanged = true;
  report.status = 'PASS_SCOPED'; report.completedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: report.status, denials: report.denials.length, replays: report.replays.length,
    authorityTables: tables.length, source: report.source, output }));
} catch (error) {
  report.status = 'FAIL'; report.error = { message: error.message, stack: error.stack }; report.completedAt = new Date().toISOString(); save(); throw error;
} finally {
  if (app) { await app.close(); await app.pool.end(); }
  if (f) await f.cleanup();
}
