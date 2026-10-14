// Real Crew/mystery/operation HTTP composition; native mode owns a disposable loopback schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { STAGED_CREW_MISSIONS_PACKAGE as mission } from '../src/content/staged-crew-missions.js';
import { CREW_CROSSCURRENT_PACKAGE as crosscurrent } from '../src/content/crew-crosscurrent.js';

const postgres = process.argv.includes('--postgres');
let app, admin, namespace, createdSchema = false;
const nativeEndpoint = value => {
  assert.equal(typeof value, 'string', 'Set an explicit staged-Crew disposable native test URL.');
  const endpoint = new URL(value);
  assert(!endpoint.search && !endpoint.hash, 'Fixture URLs cannot override driver host or connection options');
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Native fixture requires loopback.');
  assert(/^\/(?:omerta_query|omerta_check|staged_crew_[a-z0-9_]+)$/.test(endpoint.pathname), 'Use a named test database.');
  return endpoint;
};
assert.equal(nativeEndpoint('postgresql://127.0.0.1/omerta_query').pathname, '/omerta_query');
for (const value of [undefined, 'https://127.0.0.1/omerta_query', 'postgresql://production.invalid/omerta_query',
  'postgresql://127.0.0.1/postgres', 'postgresql://127.0.0.1/live_database']) assert.throws(() => nativeEndpoint(value));
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.SOCIAL_VERIFY_MODE = 'off'; process.env.POPULATION_OFF = 'on';
process.env.CORE_PROGRESSION = 'off';
try {
  if (postgres) {
    const endpoint = nativeEndpoint(process.env.STAGED_CREW_MISSIONS_TEST_DATABASE_URL);
    const { Pool } = await import('pg'); admin = new Pool({ connectionString: endpoint.toString() });
    namespace = 'staged_crew_' + crypto.randomBytes(8).toString('hex'); assert(/^staged_crew_[a-f0-9]{16}$/.test(namespace));
    await admin.query(`CREATE SCHEMA ${namespace}`); createdSchema = true;
    endpoint.searchParams.set('options', `-c search_path=${namespace}`); process.env.DATABASE_URL = endpoint.toString();
  } else assert(!process.env.DATABASE_URL, 'Memory proof requires disposable pg-mem.');
  const { buildServer } = await import('../src/server.js');
  const { ledger } = await import('../src/game.js');
  app = await buildServer();
  if (postgres) {
    const actual = (await app.pool.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
    assert.equal(actual.schema, namespace); assert.match(actual.version, /^PostgreSQL /);
  }
  const call = (actor, method, url, body, key = crypto.randomUUID()) => app.inject({ method, url,
    ...(body === undefined ? {} : { payload: body }), headers: { ...(actor?.headers || {}), ...(method === 'POST' ? { 'idempotency-key': key } : {}) } });
  const success = async request => { const response = await request; assert.equal(response.statusCode, 200, response.body); return response.json(); };
  const denied = async request => { const response = await request; assert(response.statusCode >= 400, response.body); return response.json(); };
  const actor = async name => {
    const guest = await success(call(null, 'POST', '/v1/auth/guest', { birthDate: '1990-01-01' }));
    const account = app.jwt.verify(guest.token).sub, headers = { authorization: 'Bearer ' + guest.token };
    await success(call({ headers }, 'POST', '/v1/character', { name }));
    const character = (await app.pool.query('SELECT id,cash FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query('UPDATE characters SET cash=100000,respect=10000,loc=$2,last_accrued_at=$3 WHERE id=$1',
      [character.id, 'docks', new Date(Date.now() + 86400000)]);
    await ledger(app.pool, { characterId: character.id, currency: 'cash', amount: 100000 - Number(character.cash), reason: 'crime:crew-missions-fixture' });
    return { name, account, character: character.id, headers };
  };
  const completeDocks = async owner => {
    const root = '/v1/worldgraph/mysteries/district-docks-story';
    await success(call(owner, 'POST', root + '/start', {}));
    await success(call(owner, 'POST', root + '/nodes/' + encodeURIComponent('mystery:district-docks-story-introduction') + '/complete', { interactionId: 'district-docks-story:meet' }));
    await success(call(owner, 'POST', root + '/choices/' + encodeURIComponent('choice:district-docks-story-approach'), { interactionId: 'district-docks-story:choose', optionId: 'witness' }));
    await success(call(owner, 'POST', root + '/nodes/' + encodeURIComponent('mystery:district-docks-story-witness') + '/complete', { interactionId: 'district-docks-story:witness' }));
    await success(call(owner, 'POST', root + '/explore', {}));
    await success(call(owner, 'POST', root + '/nodes/' + encodeURIComponent('mystery:district-docks-story-report') + '/complete', { interactionId: 'district-docks-story:report' }));
  };
  const party = async label => {
    const players = await Promise.all(['Planner', 'Lookout', 'Driver'].map(role => actor(label + ' ' + role)));
    const crew = await success(call(players[0], 'POST', '/v1/crew', { name: label + ' Crew' }));
    for (const player of players.slice(1)) {
      await success(call(players[0], 'POST', '/v1/crew/invite', { name: player.name }));
      await success(call(player, 'POST', '/v1/crew/accept/' + encodeURIComponent(crew.id), {}));
    }
    return { players, crewId: crew.id };
  };
  const first = await party('Pier HTTP'), players = first.players, outsider = await actor('Pier HTTP Outsider');
  const root = mission.nodes.find(node => node.type === 'social_gate');
  const openPath = '/v1/worldgraph/operations/' + mission.id + '/' + encodeURIComponent(root.id) + '/open';
  const catalogue = await success(call(players[0], 'GET', '/v1/worldgraph/operations'));
  const offer = catalogue.operations.find(entry => entry.graphId === mission.id);
  assert(offer, 'The authored mission must be registered in the canonical release manifest.');
  assert.equal(offer.available, false); assert.equal(offer.actions[0].available, false);
  await denied(call(players[0], 'POST', openPath, {}));
  await completeDocks(players[0]);
  const ready = (await success(call(players[0], 'GET', '/v1/worldgraph/operations'))).operations.find(entry => entry.graphId === mission.id);
  assert(ready.actions[0].available);
  const openKey = crypto.randomUUID(), opening = await call(players[0], 'POST', ready.actions[0].path, ready.actions[0].body, openKey);
  assert.equal(opening.statusCode, 200, opening.body); const opened = opening.json();
  const openReplay = await call(players[0], 'POST', ready.actions[0].path, ready.actions[0].body, openKey);
  assert.equal(openReplay.statusCode, 200); assert.deepEqual(openReplay.json(), opened);
  const base = '/v1/worldgraph/operations/' + encodeURIComponent(opened.operationId);
  const spec = (await app.inject({ url: '/openapi.json' })).json();
  const schemas = Object.fromEntries(Object.entries(spec.components.schemas).filter(([name]) => name.startsWith('WorldGraph')));
  const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
  const projection = suffix => ajv.compile({ $ref: spec.paths['/v1/worldgraph/operations/{operationId}' + suffix].get.responses[200].content['application/json'].schema.$ref, components: { schemas } });
  const validateShared = projection(''), validatePrivate = projection('/role');
  const shared = async player => { const board = await success(call(player, 'GET', base)); assert(validateShared(board), JSON.stringify(validateShared.errors)); return board; };
  const role = async player => { const board = await success(call(player, 'GET', base + '/role')); assert(validatePrivate(board), JSON.stringify(validatePrivate.errors)); return board; };
  await denied(call(outsider, 'GET', base)); await denied(call(outsider, 'GET', base + '/role'));
  await denied(call(outsider, 'POST', base + '/roles/planner', {}));
  await denied(call(players[0], 'POST', base + '/roles/planner', { accountId: outsider.account, characterId: outsider.character }));
  const plannerRole = (await shared(players[0])).roles.find(slot => slot.roleId === 'planner').actions[0];
  await success(call(players[0], 'POST', plannerRole.path, plannerRole.body));
  await denied(call(players[0], 'POST', base + '/roles/lookout', {}));
  for (let index = 1; index < 3; index++) {
    if (index === 2) {
      await app.pool.query("UPDATE characters SET loc='neon' WHERE id=$1", [players[index].character]);
      const refused = await denied(call(players[index], 'POST', base + '/roles/driver', {})); assert.equal(refused.error, 'location');
      const travelled = await success(call(players[index], 'POST', '/v1/travel/docks', {})); assert.equal(travelled.cost, 250); assert.equal(travelled.loc, 'docks');
    }
    const invitation = (await shared(players[index])).roles.find(slot => slot.roleId === root.metadata.roles[index].id).actions[0];
    assert(invitation.available); await success(call(players[index], 'POST', invitation.path, invitation.body));
  }
  assert.equal((await shared(players[0])).status, 'active');
  await app.pool.query('DELETE FROM player_intel WHERE owner_account=$1', [players[0].account]);
  const unknownRoles = await shared(players[0]);
  assert.equal(unknownRoles.roles.find(role => role.roleId === 'planner').occupant.self, true);
  assert.equal(unknownRoles.roles.find(role => role.roleId === 'lookout').occupant.name, null);
  assert.deepEqual(unknownRoles.roles.filter(role => role.turn).map(role => role.roleId), ['planner']);
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM player_intel WHERE owner_account=$1', [players[0].account])).rows[0].n), 0,
    'Polling role occupants is read-only and never grants notebook facts.');
  await success(call(players[0], 'POST', '/v1/streets/' + players[1].character + '/meet', {}));
  const learned = (await shared(players[0])).roles.find(role => role.roleId === 'lookout').occupant;
  assert.equal(learned.name, players[1].name); assert(learned.observedAt);
  await app.pool.query('UPDATE characters SET name=$2 WHERE id=$1', [players[1].character, 'Changed private name']);
  assert.deepEqual((await shared(players[0])).roles.find(role => role.roleId === 'lookout').occupant, learned,
    'A shared role uses the viewer-earned snapshot, not a new live name.');
  assert.equal((await shared(players[2])).roles.find(role => role.roleId === 'lookout').occupant.name, null);
  const before = await Promise.all(players.map(async player => ({
    character: (await app.pool.query('SELECT cash,bank,heat,ammo,respect FROM characters WHERE id=$1', [player.character])).rows[0],
    omr: (await app.pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [player.account])).rows[0],
    transactions: Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE character_id=$1 OR account_id=$2', [player.character, player.account])).rows[0].n),
  })));
  const steps = mission.nodes.filter(node => node.type === 'operation_step').sort((a, b) => a.metadata.order - b.metadata.order);
  const contributionPath = step => base + '/contributions/' + encodeURIComponent(step.id);
  const body = step => ({ interactionId: step.conditions.find(condition => condition.adapter === 'explicit_interaction').interactionId });
  await denied(call(players[2], 'POST', contributionPath(steps[3]), body(steps[3])));
  await denied(call(players[0], 'POST', base + '/complete', {}));
  const wrongRole = await denied(call(players[1], 'POST', contributionPath(steps[0]), body(steps[0])));
  const absent = await denied(call(players[1], 'POST', base + '/contributions/operation%3Ano-such-pier-step', body(steps[0])));
  assert.deepEqual(wrongRole, absent, 'An assigned role cannot distinguish another role\'s private step from a missing one.');
  const privateTexts = mission.nodes.filter(node => node.type === 'evidence').map(node => node.metadata.privateEvidence);
  for (const [index, step] of steps.entries()) {
    const participant = players[root.metadata.roles.findIndex(slot => slot.id === step.metadata.roleId)];
    const board = await role(participant), action = board.nodes.find(node => node.id === step.id).actions[0];
    assert(action.available); assert.equal(action.path, contributionPath(step)); assert.deepEqual(action.body, body(step));
    const key = crypto.randomUUID(), committed = await call(participant, 'POST', action.path, action.body, key);
    assert.equal(committed.statusCode, 200, committed.body);
    const replay = await call(participant, 'POST', action.path, action.body, key); assert.equal(replay.statusCode, 200); assert.deepEqual(replay.json(), committed.json());
    if (index === 0) {
      assert(JSON.stringify(await role(players[0])).includes(privateTexts[0]));
      assert(!JSON.stringify(await role(players[1])).includes(privateTexts[0]));
    }
    if (index === 1) {
      assert(JSON.stringify(await role(players[1])).includes(privateTexts[1]));
      assert(!JSON.stringify(await role(players[0])).includes(privateTexts[1]));
    }
    const permitted = mission.nodes.filter(node => node.type === 'evidence' && node.metadata.roleId === step.metadata.roleId)
      .map(node => node.metadata.privateEvidence);
    assert(privateTexts.filter(text => !permitted.includes(text)).every(text => !JSON.stringify(board).includes(text)),
      'Every role snapshot excludes the other roles\' private evidence.');
  }
  const safe = JSON.stringify(await shared(players[0]));
  assert(privateTexts.every(text => !safe.includes(text)));
  assert(![first.crewId, ...players.flatMap(player => [player.account, player.character])].some(id => safe.includes(id)));
  await denied(call(players[1], 'POST', base + '/complete', {}));
  await denied(call(players[0], 'POST', base + '/complete', { recipientRoleId: 'planner', reward: 'cash' }));

  // Fault the actual closing transaction after its artifact write, then retry the same HTTP key.
  const originalConnect = app.pool.connect.bind(app.pool); let faulted = false;
  const instrument = inner => new Proxy(inner, { get(target, property) {
      if (property === 'query') return async (...args) => {
        const [sql, params] = args;
        if (!faulted && /UPDATE\s+world_operations\s+SET\s+status/i.test(String(sql)) && params?.[1] === 'completed') {
          faulted = true; throw Error('owned staged Crew closing fault');
        }
        return target.query(...args);
      };
      const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
    } });
  app.pool.connect = (...args) => {
    if (typeof args[0] === 'function') {
      const callback = args[0];
      return originalConnect((error, inner, release) => callback(error, error ? undefined : instrument(inner), release));
    }
    return originalConnect(...args).then(instrument);
  };
  const closeKey = crypto.randomUUID();
  try { const failed = await call(players[0], 'POST', base + '/complete', {}, closeKey); assert.equal(failed.statusCode, 500, failed.body); }
  finally { app.pool.connect = originalConnect; }
  assert(faulted);
  assert.equal((await app.pool.query('SELECT status FROM world_operations WHERE id=$1', [opened.operationId])).rows[0].status, 'active');
  assert.equal((await app.pool.query('SELECT id FROM item_instances WHERE template_id=$1', ['item:quiet_pier_manifest'])).rows.length, 0,
    'A rolled-back closer cannot leave a partial artifact.');
  const [winner, follower] = await Promise.all([
    call(players[0], 'POST', base + '/complete', {}, closeKey), call(players[0], 'POST', base + '/complete', {}, crypto.randomUUID()),
  ]);
  assert.equal(winner.statusCode, 200, winner.body); assert.equal(follower.statusCode, 200, follower.body);
  assert.equal([...winner.json().effects, ...follower.json().effects].filter(effect => effect.kind === 'unique_item_award').length, 1);
  const replay = await call(players[0], 'POST', base + '/complete', {}, closeKey); assert.equal(replay.statusCode, 200); assert.deepEqual(replay.json(), winner.json());
  const rewards = (await app.pool.query('SELECT id,owner_scope,owner_id FROM item_instances WHERE template_id=$1', ['item:quiet_pier_manifest'])).rows;
  assert.equal(rewards.length, 1); assert.equal(rewards[0].owner_scope, 'account'); assert.equal(rewards[0].owner_id, players[2].account);
  const after = await Promise.all(players.map(async player => ({
    character: (await app.pool.query('SELECT cash,bank,heat,ammo,respect FROM characters WHERE id=$1', [player.character])).rows[0],
    omr: (await app.pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [player.account])).rows[0],
    transactions: Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE character_id=$1 OR account_id=$2', [player.character, player.account])).rows[0].n),
  }))); assert.deepEqual(after, before);
  const driverInventory = await success(call(players[2], 'GET', '/v1/worldgraph/inventory'));
  assert.deepEqual(driverInventory.items.find(item => item.id === rewards[0].id).actions, []);

  const second = await party('Pier Leave'); await completeDocks(second.players[0]);
  const otherOperation = await success(call(second.players[0], 'POST', openPath, {}));
  const otherBase = '/v1/worldgraph/operations/' + encodeURIComponent(otherOperation.operationId);
  for (let index = 0; index < 3; index++) await success(call(second.players[index], 'POST', otherBase + '/roles/' + root.metadata.roles[index].id, {}));
  await success(call(second.players[1], 'POST', '/v1/crew/leave', {}));
  const abandoned = await success(call(second.players[0], 'POST', otherBase + '/contributions/' + encodeURIComponent(steps[0].id), body(steps[0])));
  assert.equal(abandoned.status, 'abandoned');
  assert.equal((await app.pool.query('SELECT id FROM item_instances WHERE template_id=$1', ['item:quiet_pier_manifest'])).rows.length, 1);
  // Four real route/signal combinations; every driver chooses between two distinct consequences.
  // No global numeric ordering may make an unchosen branch a prerequisite.
  assert(Object.isFrozen(crosscurrent));
  assert(crosscurrent.nodes.filter(node => node.type === 'operation_step').every(node => node.metadata.order === undefined));
  for (const [route, signal, escape, alternate] of [
    ['quay', 'wait', 'barge', 'towpath'], ['quay', 'blue', 'mooring', 'gate'],
    ['canal', 'wait', 'oars', 'drift'], ['canal', 'blue', 'towline', 'lockwall'],
  ]) {
    const group = await party('Cross ' + route + ' ' + signal), team = group.players;
    await completeDocks(team[0]);
    const openedCross = await success(call(team[0], 'POST', '/v1/worldgraph/operations/' + crosscurrent.id + '/operation%3Acrosscurrent-run/open', {}));
    const path = '/v1/worldgraph/operations/' + openedCross.operationId;
    for (const [index, roleId] of ['planner', 'lookout', 'driver'].entries()) await success(call(team[index], 'POST', path + '/roles/' + roleId, {}));
    const unchanged = await Promise.all(team.map(async member => ({
      cash: (await app.pool.query('SELECT cash,bank,heat,health,respect FROM characters WHERE id=$1', [member.character])).rows[0],
      items: (await success(call(member, 'GET', '/v1/worldgraph/inventory'))).items,
      moneyEntries: Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE account_id=$1 OR character_id=$2', [member.account, member.character])).rows[0].n),
    })));
    const perform = async (index, key) => {
      const board = await success(call(team[index], 'GET', path + '/role'));
      const action = board.nodes.find(node => node.id === 'operation:crosscurrent-' + key)?.actions[0];
      assert(action?.available, key + ' must be issued by the current actual role board');
      const receiptKey = crypto.randomUUID(), committed = await success(call(team[index], 'POST', action.path, action.body, receiptKey));
      assert.deepEqual(await success(call(team[index], 'POST', action.path, action.body, receiptKey)), committed);
      return committed;
    };
    await perform(0, route);
    const otherRoute = route === 'quay' ? 'canal' : 'quay';
    assert.equal((await denied(call(team[0], 'POST', path + '/contributions/operation%3Acrosscurrent-' + otherRoute,
      { interactionId: 'crosscurrent:' + otherRoute }))).error, 'operation_branch_closed');
    await perform(0, 'brief'); await perform(1, 'read-' + route);
    const roleClue = crosscurrent.nodes.find(node => node.id === 'evidence:crosscurrent-' + route).metadata.privateEvidence;
    assert(JSON.stringify(await success(call(team[1], 'GET', path + '/role'))).includes(roleClue));
    assert(!JSON.stringify(await success(call(team[0], 'GET', path + '/role'))).includes(roleClue));
    assert(!JSON.stringify(await success(call(team[2], 'GET', path))).includes(roleClue));
    await perform(1, signal); await perform(1, 'signal'); await perform(2, 'read-escape');
    const driverBoard = await success(call(team[2], 'GET', path + '/role'));
    for (const key of [escape, alternate]) assert(driverBoard.nodes.find(node => node.id === 'operation:crosscurrent-' + key).actions[0].available);
    assert.equal(driverBoard.nodes.filter(node => node.actions?.some(action => action.available)).length, 2);
    await perform(2, escape);
    assert.equal((await denied(call(team[2], 'POST', path + '/contributions/operation%3Acrosscurrent-' + alternate,
      { interactionId: 'crosscurrent:' + alternate }))).error, 'operation_branch_closed');
    await perform(2, 'finish');
    const completionKey = crypto.randomUUID(), result = await success(call(team[0], 'POST', path + '/complete', {}, completionKey));
    assert.equal(result.status, 'completed'); assert.deepEqual(result.effects, [{ kind: 'status_award' }]);
    assert.deepEqual(await success(call(team[0], 'POST', path + '/complete', {}, completionKey)), result);
    const final = await success(call(team[0], 'GET', path)); assert(validateShared(final), JSON.stringify(validateShared.errors));
    assert.equal(final.nodes.find(node => node.id === 'operation:crosscurrent-' + escape).status, 'completed');
    assert.equal(final.nodes.find(node => node.id === 'operation:crosscurrent-' + alternate).status, 'excluded');
    assert.deepEqual(await Promise.all(team.map(async member => ({
      cash: (await app.pool.query('SELECT cash,bank,heat,health,respect FROM characters WHERE id=$1', [member.character])).rows[0],
      items: (await success(call(member, 'GET', '/v1/worldgraph/inventory'))).items,
      moneyEntries: Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE account_id=$1 OR character_id=$2', [member.account, member.character])).rows[0].n),
    }))), unchanged, 'Branching narrative outcomes create no cash, item or stat faucet.');
  }
  console.log('Crosscurrent PASS: all four route/signal combinations, eight issued driver alternatives, actual private complementary clues, three-role convergence, closed alternatives, immutable exact-key replay, no economic mutations; role notebook snapshots never live names or GET-earned intel');
  const validateCatalogue = ajv.compile({ $ref: '#/components/schemas/WorldGraphOperationDiscovery', components: { schemas } });
  const completedBoard = await success(call(players[2], 'GET', '/v1/worldgraph/operations'));
  assert(validateCatalogue(completedBoard), JSON.stringify(validateCatalogue.errors));
  const saved = completedBoard.completedOperations.find(item => item.operationId === opened.operationId);
  assert.equal(saved.title, 'The Quiet Pier Run'); assert.equal(saved.roleTitle, 'Driver'); assert(saved.completedAt);
  assert(saved.milestones.includes('Complete the Getaway'));
  assert(privateTexts.every(text => !JSON.stringify(saved).includes(text)));
  assert(![first.crewId, ...players.flatMap(player => [player.account, player.character])].some(id => JSON.stringify(saved).includes(id)));
  await success(call(players[2], 'POST', '/v1/crew/leave', {}));
  assert.deepEqual((await success(call(players[2], 'GET', '/v1/worldgraph/operations'))).completedOperations.find(item => item.operationId === opened.operationId), saved,
    'A confirmed private accomplishment survives leaving the Crew; it does not grant access to its old live board.');
  await denied(call(players[2], 'GET', base));
  assert.deepEqual((await success(call(outsider, 'GET', '/v1/worldgraph/operations'))).completedOperations, []);
  console.log('staged-crew-missions-api PASS: actual Crew invite/accept and mystery bridge, consenting distinct roles, current-district refusal/canonical travel, role-private and ghost denial, issued stage order, same-key contributions, closing rollback/concurrent one-winner/exact replay, durable driver-only inert artifact, unchanged currencies and Crew-leave abandonment' +
    (postgres ? '; owned-schema PostgreSQL' : '; disposable pg-mem'));
} finally {
  if (app) await app.close();
  if (admin) {
    if (createdSchema) {
      assert(/^staged_crew_[a-f0-9]{16}$/.test(namespace));
      const owner = (await admin.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [namespace])).rows[0];
      assert.equal(owner?.mine, true, 'Drop only the fixture schema owned by this connection.');
      await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
    }
    await admin.end();
  }
}
