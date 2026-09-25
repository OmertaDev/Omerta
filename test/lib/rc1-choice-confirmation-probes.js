// Full HTTP Furnace prefix. Observations never supply admission or branch authority.
import assert from 'node:assert/strict';
import { addPlayer, findCommand, characterId } from './player-command-support.js';
import { FURNACE_IDS as ids } from '../../src/content/furnace-ledger.js';
import { AUTHORITY_TABLES, authoritativeState } from './rc1-authority-probes.js';

export const CHOICE_AUTHORITY_TABLES = [...AUTHORITY_TABLES, 'mystery_node_state', 'mystery_choices'];

export async function choiceConfirmationProbes({ server, restart, onFixture, onEvidence }) {
  const accounts = { organizer: 'rc1-choice-organizer', researcher: 'rc1-choice-researcher' };
  const names = { organizer: 'RC1 Choice Organizer', researcher: 'RC1 Choice Researcher' };
  const tokens = {};
  for (const role of Object.keys(accounts)) {
    await addPlayer(server().pool, accounts[role], names[role]);
    tokens[role] = server().jwt.sign({ sub: accounts[role], tv: 0 });
  }
  await server().pool.query("INSERT INTO crews(id,name,leader_account) VALUES('rc1-choice-crew','RC1 Choice Crew',$1)", [accounts.organizer]);
  for (const role of Object.keys(accounts)) await server().pool.query(
    "INSERT INTO crew_members(crew_id,account_id,name) VALUES('rc1-choice-crew',$1,$2)", [accounts[role], names[role]]);
  const requests = [];
  async function request(role, method, url, payload, key) {
    const response = await server().inject({ method, url, headers: { authorization: `Bearer ${tokens[role]}`,
      ...(key ? { 'idempotency-key': key } : {}) }, ...(payload === undefined ? {} : { payload }) });
    const row = { role, accountId: accounts[role], method, url, ...(payload === undefined ? {} : { payload }),
      ...(key ? { key } : {}), status: response.statusCode, body: response.json() };
    requests.push(row); return row;
  }
  async function ok(...args) {
    const row = await request(...args); assert.equal(row.status, 200, `${row.method} ${row.url}: ${JSON.stringify(row.body)}`); return row.body;
  }
  const board = (role, graphId) => ok(role, 'GET', '/v1/commands' + (graphId ? `?mysteryGraphId=${encodeURIComponent(graphId)}` : ''));
  const execute = (role, command, confirmed = true) => request(role, 'POST', '/v1/commands/execute',
    { executionId: command.executionIdentity.executionId, confirmed }, command.executionIdentity.executionId);
  async function act(role, type, parameters = {}, graphId) {
    const command = findCommand(await board(role, graphId), type, parameters);
    const row = await execute(role, command); assert.equal(row.status, 200, JSON.stringify(row));
    assert.equal(row.body.status, 'COMPLETED'); assert.equal(row.body.executionId, command.executionIdentity.executionId);
    return { command, row };
  }
  // Declared setup-only RNG fixture: actual canonical boost, original costs and
  // receipt/RNG audit. The source does not require a district for boosting.
  const originalRandom = Math.random; let acquired;
  try { Math.random = () => 0.01; acquired = await ok('researcher', 'POST', '/v1/garage/boost', {}, 'rc1-choice-fixture-boost'); }
  finally { Math.random = originalRandom; }
  assert.equal(acquired.car?.model, 'junker');
  await onFixture({ accounts, names, characterIds: Object.values(accounts).map(characterId), acquired,
    requests: [...requests], tables: CHOICE_AUTHORITY_TABLES, randomRestored: Math.random === originalRandom });

  const instances = new Map();
  async function learn(role) {
    if (!instances.has(role)) instances.set(role, (await act(role, 'discovery.start', { graphId: ids.coordination })).row.body.result.instanceId);
    for (let step = 0; step < 16; step++) {
      const view = await ok(role, 'GET', `/v1/coordination/instances/${instances.get(role)}`);
      const action = view.actions.find(entry => entry.kind === 'complete') || view.actions.find(entry => entry.kind === 'discover');
      if (!action) return view;
      await act(role, 'discovery.act', { instanceId: view.id, actionId: action.id });
    }
    throw Error('Furnace discovery action bound exceeded');
  }
  const mystery = (role, graphId, kind) => act(role, `mystery.${kind}`, { graphId }, graphId);
  for (const role of Object.keys(accounts)) {
    await act(role, 'mystery.start', { graphId: ids.inspection });
    await mystery(role, ids.inspection, 'complete');
    await learn(role);
  }
  await ok('researcher', 'POST', '/v1/travel/foundry', {}, 'rc1-choice-researcher-travel');
  await act('researcher', 'item.salvage', { carId: acquired.car.id });
  await act('researcher', 'recipe.craft', { recipeId: ids.recipe });
  await mystery('researcher', ids.inspection, 'discover');
  await mystery('researcher', ids.inspection, 'complete');
  await learn('researcher');
  const knowledge = '/v1/coordination/knowledge';
  const second = (await ok('researcher', 'GET', knowledge)).claims.find(claim => claim.owned && claim.source.root === 'foundry.reversed-countermark');
  assert(second, 'Canonical independent countermark claim required');
  const target = (await ok('researcher', 'GET', `${knowledge}/targets?characterName=${encodeURIComponent(names.organizer)}`)).targets.find(entry => entry.kind === 'account');
  assert(target);
  await ok('researcher', 'POST', `${knowledge}/${second.id}/share`, { targetId: target.id, expectedAclRevision: second.aclRevision }, 'rc1-choice-share-countermark');
  await ok('organizer', 'POST', '/v1/travel/foundry', {}, 'rc1-choice-organizer-travel');
  await learn('organizer');
  const corroborated = (await ok('organizer', 'GET', knowledge)).claims.find(claim => claim.owned && claim.proposition === 'duplicate-accounts.location');
  assert(corroborated, 'Independent authentic evidence must earn the deduction');
  await act('organizer', 'mystery.start', { graphId: ids.deduction });
  await mystery('organizer', ids.deduction, 'discover');
  const choiceView = await board('organizer', ids.deduction);
  const chosen = findCommand(choiceView, 'mystery.choice', { graphId: ids.deduction, optionId: 'preserve' });
  const opposite = findCommand(choiceView, 'mystery.choice', { graphId: ids.deduction, optionId: 'expose' });
  assert.equal(chosen.confirmation.required, true); assert.equal(opposite.confirmation.required, true);
  await onEvidence({ kind: 'issued-choices', choiceView, chosen, opposite, corroborated, second });

  async function state() {
    const value = await authoritativeState(server().pool);
    for (const table of CHOICE_AUTHORITY_TABLES.slice(AUTHORITY_TABLES.length))
      value[table] = (await server().pool.query(`SELECT * FROM ${table}`)).rows.map(row => JSON.stringify(row)).sort();
    return value;
  }
  async function unchanged(label, command, confirmed, status, error) {
    const before = await state(), row = await execute('organizer', command, confirmed), after = await state();
    await onEvidence({ kind: 'denial', label, requests: [row], before, after });
    assert.equal(row.status, status); assert.equal(row.body.error, error); assert.deepEqual(after, before, label);
    return row;
  }
  await unchanged('false confirmation refuses the currently eligible irreversible choice', chosen, false, 409, 'command_confirmation_required');
  const beforeChoice = await state(), committed = await execute('organizer', chosen), afterChoice = await state();
  await onEvidence({ kind: 'transition', label: 'confirmed preserve commits the authored irreversible branch', requests: [committed], before: beforeChoice, after: afterChoice });
  assert.equal(committed.status, 200, JSON.stringify(committed)); assert.equal(committed.body.replayed, false);
  const choices = (await server().pool.query('SELECT * FROM mystery_choices')).rows;
  assert.equal(choices.length, 1); assert.equal(choices[0].node_id, ids.choice); assert.equal(choices[0].choice_id, 'preserve');
  const nodes = (await server().pool.query('SELECT * FROM mystery_node_state WHERE instance_id=$1', [choices[0].instance_id])).rows;
  assert.equal(nodes.find(row => row.node_id === ids.preserve)?.state, 'discovered');
  assert.equal(nodes.find(row => row.node_id === ids.expose)?.state, 'excluded');
  await onEvidence({ kind: 'branch-effects', choices, nodes });
  await unchanged('stale opposite choice cannot replace the committed branch', opposite, true, 409, 'command_unavailable');
  await mystery('organizer', ids.deduction, 'complete');

  async function replay(label) {
    const before = await state(), row = await execute('organizer', chosen), after = await state();
    await onEvidence({ kind: 'replay', label, requests: [row], before, after });
    assert.equal(row.status, 200, JSON.stringify(row)); assert.equal(row.body.replayed, true);
    assert.deepEqual(row.body.result, committed.body.result); assert.deepEqual(after, before, label);
  }
  await replay('exact choice retry after branch completion');
  await restart();
  await replay('exact choice retry after full server reconstruction');
  await unchanged('opposite choice remains unavailable after restart', opposite, true, 409, 'command_unavailable');
  const finalChoices = (await server().pool.query('SELECT * FROM mystery_choices')).rows;
  assert.deepEqual(finalChoices, choices);
  const finalNodes = (await server().pool.query('SELECT * FROM mystery_node_state WHERE instance_id=$1', [choices[0].instance_id])).rows;
  assert.equal(finalNodes.find(row => row.node_id === ids.preserve)?.state, 'completed');
  assert.equal(finalNodes.find(row => row.node_id === ids.expose)?.state, 'excluded');
  await onEvidence({ kind: 'final-branch-effects', choices: finalChoices, nodes: finalNodes });
  return { scope: 'Full HTTP fixture-assisted authored Furnace preserve confirmation', deniedCases: 3, exactReplays: 2,
    serverReconstructions: 1, authorityTablesCompared: CHOICE_AUTHORITY_TABLES.length, irreversibleChoices: 1,
    measuredProgression: 'Two independent authentic source roots, canonical salvage/craft/share/discovery, confirmed preserve and authored opposite exclusion',
    exclusions: ['Expose success branch', 'Family operation execution', 'Natural entry', 'All authority tables', 'Worker deadlines and concurrent choice race'] };
}
