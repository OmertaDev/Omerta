// Authenticated production routes and generic HTTP idempotency middleware together.
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { travel, withCharacter } from '../src/game.js';
import { FURNACE_IDS as ids } from '../src/content/furnace-ledger.js';
import { addPlayer, characterId, findCommand } from './lib/player-command-support.js';

assert(!process.env.DATABASE_URL, 'This HTTP lane uses an isolated memory database');
const flags = ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE',
  'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS', 'COORDINATION_ACCOUNT_IDS'];
const prior = Object.fromEntries(flags.map((flag) => [flag, process.env[flag]]));
const owner = 'command-api-owner', other = 'command-api-other';
let app;
const request = (method, url, token, payload, key) => app.inject({ method, url,
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key ? { 'idempotency-key': key } : {}) },
  ...(payload === undefined ? {} : { payload }) });
const ok = (response) => { assert.equal(response.statusCode, 200, response.body); return response.json(); };
const noStore = (response) => assert.equal(response.headers['cache-control'], 'no-store');
try {
  for (const flag of flags) delete process.env[flag];
  for (const flag of flags.slice(0, -1)) process.env[flag] = 'on';
  process.env.COORDINATION_ACCOUNT_IDS = `${owner},${other}`;
  app = await buildServer();
  for (const account of [owner, other, 'command-api-excluded']) await addPlayer(app.pool, account);
  const token = app.jwt.sign({ sub: owner, tv: 0 }), otherToken = app.jwt.sign({ sub: other, tv: 0 });
  const excludedToken = app.jwt.sign({ sub: 'command-api-excluded', tv: 0 });
  for (const bearer of [undefined, 'invalid-token']) {
    const response = await request('GET', '/v1/commands', bearer);
    assert.equal(response.statusCode, 401); noStore(response);
  }
  const outside = await request('GET', '/v1/commands', excludedToken);
  assert.equal(outside.statusCode, 409); noStore(outside);
  const boardResponse = await request('GET', '/v1/commands', token); noStore(boardResponse);
  const board = ok(boardResponse); assert.equal(board.commandSchemaVersion, 1);
  const selectedUrl = `/v1/commands?mysteryGraphId=${ids.inspection}`;
  assert.equal(ok(await request('GET', selectedUrl, token)).cases.selected, null);
  const unavailableOperation = await request('GET', '/v1/commands?operationId=missing', token);
  assert.equal(unavailableOperation.statusCode, 409); noStore(unavailableOperation);
  for (const query of ['?accountId=other', '?mysteryGraphId=', '?mysteryGraphId=a&mysteryGraphId=b',
    '?mysteryGraphId[]=a', '?operationId=%20x', '?unknown=a']) {
    const invalid = await request('GET', `/v1/commands${query}`, token);
    assert.equal(invalid.statusCode, 400, query); noStore(invalid);
  }
  const start = findCommand(board, 'mystery.start', { graphId: ids.inspection });
  const executionId = start.executionIdentity.executionId, body = { executionId, confirmed: true };
  for (const hidden of [ids.impression, ids.key, 'beneath-the-quench-floor']) assert(!JSON.stringify(board).includes(hidden));
  const foreign = await request('POST', '/v1/commands/execute', otherToken, body, executionId);
  assert.equal(foreign.statusCode, 409); assert.deepEqual(foreign.json(), outside.json()); noStore(foreign);
  const missingKey = await request('POST', '/v1/commands/execute', token, body);
  assert.equal(missingKey.statusCode, 400);
  const badBody = await request('POST', '/v1/commands/execute', token, { ...body, accountId: other }, executionId);
  assert.equal(badBody.statusCode, 400); noStore(badBody);
  const badQuery = await request('POST', '/v1/commands/execute?accountId=other', token, body, executionId);
  assert.equal(badQuery.statusCode, 400); noStore(badQuery);
  const first = ok(await request('POST', '/v1/commands/execute', token, body, executionId));
  assert.equal(first.status, 'COMPLETED'); assert.equal(first.projection.player.character.locationId, 'docks');
  const selected = ok(await request('GET', selectedUrl, token));
  assert.equal(selected.cases.selected.graph.id, ids.inspection);
  assert.equal(selected.cases.selected.owner.id, characterId(owner));
  const retry = ok(await request('POST', '/v1/commands/execute', token, body, executionId));
  assert.equal(retry.replayed, true);
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM mystery_instances WHERE authority_account_id=$1 AND graph_id=$2', [owner, ids.inspection])).rows[0].n), 1);

  await withCharacter(app.pool, owner, (ch, client, helpers) => travel(ch, 'foundry', client, helpers));
  const refreshed = ok(await request('POST', '/v1/commands/execute', token, body, executionId));
  assert.equal(refreshed.replayed, true);
  assert.equal(refreshed.projection.player.character.locationId, 'foundry', 'HTTP retry reprojects current facts instead of returning a cached player view');
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [characterId(owner)]);
  await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('command-api-heir',$1,'Command Heir',1,'docks')", [owner]);
  const reincarnated = await request('POST', '/v1/commands/execute', token, body, executionId);
  assert.equal(reincarnated.statusCode, 409, 'old character receipts cannot cross into a new character through HTTP cache'); noStore(reincarnated);
  assert(!reincarnated.body.includes(characterId(owner)));
  console.log('player-command-api: authentication, cohort, strict request shape, account binding, no-store, exact HTTP retries, current projection and character isolation PASS');
} finally {
  if (app) await app.close();
  for (const [flag, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[flag]; else process.env[flag] = value;
  }
}
