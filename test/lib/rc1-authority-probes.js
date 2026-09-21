// Targeted RC1-04 native HTTP role/Knowledge probes. Initial actors and social
// memberships are declared fixtures; measured mutations use canonical routes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { addPlayer, characterId, findCommand } from './player-command-support.js';
import { familyOperationInvariants } from '../../src/coordination/operation-invariants.js';

export const AUTHORITY_TABLES = Object.freeze(['characters', 'crews', 'crew_members', 'gangs', 'gang_members',
  'mystery_instances', 'item_mutation_guards', 'item_instances', 'item_stacks', 'item_events',
  'world_operations', 'world_operation_roles', 'world_operation_commitments', 'world_operation_capital',
  'world_operation_contributions', 'world_operation_events', 'world_kernel_objects', 'world_kernel_events',
  'coordination_instances', 'coordination_commands', 'coordination_events', 'coordination_claims',
  'coordination_claim_acl_state', 'coordination_claim_acl_events', 'coordination_claim_grants',
  'coordination_claim_links', 'coordination_knowledge_archives', 'coordination_archive_events',
  'coordination_archive_entries', 'transactions']);

export async function authoritativeState(pool) {
  const result = {};
  // No concurrent gameplay is running during denial/replay comparisons. Passive
  // telemetry, current projection issuance and the HTTP cache are not authority.
  for (const table of AUTHORITY_TABLES) result[table] = (await pool.query(`SELECT * FROM ${table}`)).rows
    .map((row) => JSON.stringify(row)).sort();
  return result;
}

export async function roleKnowledgeProbes({ server, restart }) {
  const key = () => crypto.randomUUID(), tokens = new Map(), passed = [];
  const report = (name) => { passed.push(name); console.log(`PASS RC1-04 ${name}`); };
  const actors = { boss: 'rc1-role-boss', participant: 'rc1-role-participant', nonparticipant: 'rc1-role-nonparticipant',
    outsider: 'rc1-role-outsider', reader: 'rc1-knowledge-reader', author: 'rc1-knowledge-author' };
  const names = { reader: 'RC1 Archivist', author: 'RC1 Printer' };
  for (const [role, account] of Object.entries(actors)) {
    await addPlayer(server().pool, account, names[role] || account, role === 'reader' ? 'docks' : 'foundry');
    tokens.set(role, server().jwt.sign({ sub: account, tv: 0 }));
  }
  await server().pool.query("INSERT INTO crews(id,name,leader_account) VALUES('rc1-role-crew','RC1 Role Crew',$1)", [actors.boss]);
  await server().pool.query("INSERT INTO gangs(id,name,tag) VALUES('rc1-role-family','RC1 Role Family','RCR')");
  for (const role of ['boss', 'participant', 'nonparticipant']) {
    await server().pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('rc1-role-crew',$1,$1)", [actors[role]]);
    await server().pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('rc1-role-family',$1,$2)",
      [characterId(actors[role]), role === 'boss' ? 'boss' : 'soldier']);
  }
  const request = (method, url, role, payload, identity = key()) => server().inject({ method, url,
    headers: { authorization: `Bearer ${tokens.get(role)}`, ...(method === 'POST' ? { 'idempotency-key': identity } : {}) },
    ...(payload === undefined ? {} : { payload }) });
  const ok = async (...args) => { const response = await request(...args); assert.equal(response.statusCode, 200, response.body); return response.json(); };
  let denials = 0;
  const deny = async (label, statuses, ...args) => {
    const before = await authoritativeState(server().pool), response = await request(...args);
    assert(statuses.includes(response.statusCode), `${label}: ${response.statusCode}: ${response.body}`);
    assert.doesNotMatch(response.body, /SELECT |INSERT |UPDATE |definition_json|authorization_predicate|resolution_seed|source_event_id/);
    assert.deepEqual(await authoritativeState(server().pool), before, `${label}: denied request changed authority`);
    denials++; return response;
  };
  const sameState = async (label, work) => {
    const before = await authoritativeState(server().pool), result = await work();
    assert.deepEqual(await authoritativeState(server().pool), before, label); return result;
  };
  const hidden = async (label, known, missing, role) => {
    const response = await deny(label, [404], 'GET', known, role);
    const absent = await deny(`${label} nonexistent comparison`, [404], 'GET', missing, role);
    assert.deepEqual(response.json(), absent.json(), `${label}: known IDs disclose existence`);
  };
  const commands = (role, query = '') => ok('GET', `/v1/commands${query}`, role);
  const execute = (role, command) => ok('POST', '/v1/commands/execute', role,
    { executionId: command.executionIdentity.executionId, confirmed: true }, command.executionIdentity.executionId);

  const base = '/v1/coordination/operations', definitionId = 'operation:recover_foundry_archive';
  const create = findCommand(await commands('boss'), 'operation.create', { definitionId });
  await deny('ordinary Family member cannot create a leadership operation', [403], 'POST', base, 'nonparticipant', { definitionId });
  const created = await execute('boss', create), operationId = created.result.operationId;
  assert(operationId); const operation = `${base}/${operationId}`;
  const action = (name, role, payload = {}, identity = key()) => ok('POST', `${operation}/actions/${name}`, role, payload, identity);
  await hidden('outsider operation detail', operation, `${base}/rc1-missing-operation`, 'outsider');
  const selectedHidden = await deny('outsider selected operation projection', [409], 'GET', `/v1/commands?operationId=${encodeURIComponent(operationId)}`, 'outsider');
  const selectedMissing = await deny('outsider selected missing operation projection', [409], 'GET', '/v1/commands?operationId=rc1-missing-operation', 'outsider');
  assert.deepEqual(selectedHidden.json(), selectedMissing.json());
  const outsideBoard = await commands('outsider');
  assert(!JSON.stringify(outsideBoard).includes(operationId), 'outsider command projection discloses a hidden operation');
  await deny('outsider guessed operation contribution', [404], 'POST', `${operation}/actions/contribute`, 'outsider', { requirementId: 'funding' });
  await action('publish', 'boss'); await action('join', 'boss', { roleId: 'organizer' });
  await action('join', 'participant', { roleId: 'supplier' });
  await deny('same-Family nonparticipant cannot commit funding', [409], 'POST', `${operation}/actions/commit`, 'nonparticipant', { requirementId: 'funding' });
  await deny('same-Family nonparticipant cannot contribute funding', [409], 'POST', `${operation}/actions/contribute`, 'nonparticipant', { requirementId: 'funding' });
  await deny('same-Family nonparticipant cannot assign a role', [403], 'POST', `${operation}/actions/assign`, 'nonparticipant', { roleId: 'researcher', accountId: actors.nonparticipant });
  await deny('same-Family nonparticipant cannot cancel', [403], 'POST', `${operation}/actions/cancel`, 'nonparticipant', {});
  await deny('participant cannot contribute another role funding', [409], 'POST', `${operation}/actions/contribute`, 'participant', { requirementId: 'funding' });
  await deny('participant cannot approve', [403], 'POST', `${operation}/actions/approve`, 'participant', {});
  await deny('participant cannot execute as organizer', [409], 'POST', `${operation}/actions/execute`, 'participant', {});
  const commitment = findCommand(await commands('boss', `?operationId=${encodeURIComponent(operationId)}`), 'operation.commit', { operationId, requirementId: 'funding' });
  await deny('issued organizer command is account-bound', [409], 'POST', '/v1/commands/execute', 'nonparticipant',
    { executionId: commitment.executionIdentity.executionId, confirmed: true }, commitment.executionIdentity.executionId);
  await execute('boss', commitment);
  const contribution = findCommand(await commands('boss', `?operationId=${encodeURIComponent(operationId)}`), 'operation.contribute', { operationId, requirementId: 'funding' });
  const cashBefore = Number((await server().pool.query('SELECT cash FROM characters WHERE id=$1', [characterId(actors.boss)])).rows[0].cash);
  const contributed = await execute('boss', contribution); assert.equal(contributed.replayed, false);
  assert.equal(Number((await server().pool.query('SELECT cash FROM characters WHERE id=$1', [characterId(actors.boss)])).rows[0].cash), cashBefore - 100);
  assert.equal(Number((await server().pool.query('SELECT amount FROM world_operation_capital WHERE operation_id=$1', [operationId])).rows[0].amount), 100);
  await sameState('contribution exact retry duplicated capital', async () => assert.equal((await execute('boss', contribution)).replayed, true));
  await restart();
  await sameState('restarted contribution duplicated capital', async () => assert.equal((await execute('boss', contribution)).replayed, true));
  await action('cancel', 'boss');
  assert.equal(Number((await server().pool.query('SELECT cash FROM characters WHERE id=$1', [characterId(actors.boss)])).rows[0].cash), cashBefore);
  await sameState('terminal-state contribution replay restored refunded capital', async () => assert.equal((await execute('boss', contribution)).replayed, true));
  assert.equal((await familyOperationInvariants(server().pool)).ok, true);
  report('Family leadership, participant/nonparticipant, hidden operation IDs, native capital and restart/terminal replay');

  const knowledge = '/v1/coordination/knowledge';
  const graph = (await ok('GET', '/v1/coordination', 'reader')).graphs.find((entry) => entry.id === 'omerta.coordination.split-ledger'); assert(graph);
  const createDiscovery = async (role) => (await ok('POST', `/v1/coordination/${graph.id}/instances`, role, { expectedContentHash: graph.contentHash })).instance;
  const advance = async (role, view, wanted = view.actions[0]) => {
    assert(wanted); return (await ok('POST', `/v1/coordination/instances/${view.id}/act`, role,
      { expectedRevision: view.revision, actionId: wanted.id })).instance;
  };
  let reader = await createDiscovery('reader'), author = await createDiscovery('author');
  reader = await advance('reader', reader); author = await advance('author', author);
  reader = await advance('reader', reader); author = await advance('author', author);
  const privateOwnerAction = author.actions.find((entry) => entry.nodeId === 'foundry-source'); assert(privateOwnerAction);
  await deny('foreign discovery act with a currently valid owner action', [404], 'POST', `/v1/coordination/instances/${author.id}/act`, 'reader',
    { expectedRevision: author.revision, actionId: privateOwnerAction.id });
  reader = await advance('reader', reader, reader.actions.find((entry) => entry.nodeId === 'docks-source'));
  author = await advance('author', author, privateOwnerAction);
  const ownClaim = (await ok('GET', knowledge, 'reader')).claims[0];
  let claim = (await ok('GET', knowledge, 'author')).claims[0]; assert(ownClaim?.owned && claim?.owned);
  await hidden('unknown claim detail', `${knowledge}/${claim.id}`, `${knowledge}/rc1-missing-claim`, 'reader');
  await hidden('private discovery instance', `/v1/coordination/instances/${author.id}`, '/v1/coordination/instances/rc1-missing-instance', 'reader');
  const target = (await ok('GET', `${knowledge}/targets?characterName=${encodeURIComponent(names.reader)}`, 'author')).targets.find((entry) => entry.kind === 'account'); assert(target);
  const shareUrl = `${knowledge}/${claim.id}/share`, shareBody = { targetId: target.id, expectedAclRevision: claim.aclRevision }, shareKey = key();
  const shared = await ok('POST', shareUrl, 'author', shareBody, shareKey); claim = shared.claim;
  const viewed = await ok('GET', `${knowledge}/${claim.id}`, 'reader');
  assert.equal(viewed.claim.owned, false); assert.equal(viewed.claim.grants, undefined); assert.equal(viewed.claim.aclRevision, undefined);
  const targetBack = (await ok('GET', `${knowledge}/targets?characterName=${encodeURIComponent(names.author)}`, 'reader')).targets.find((entry) => entry.kind === 'account'); assert(targetBack);
  await deny('a recipient cannot reshare', [404], 'POST', shareUrl, 'reader', { targetId: targetBack.id, expectedAclRevision: 0 });
  await deny('stale ACL share', [409], 'POST', shareUrl, 'author', shareBody);
  const archiveKey = key(), linkKey = key();
  const archived = await ok('POST', `${knowledge}/archive`, 'reader', { claimId: claim.id }, archiveKey);
  const linkBody = { fromClaimId: ownClaim.id, toClaimId: claim.id, relation: 'corroborates' };
  const linked = await ok('POST', `${knowledge}/links`, 'reader', linkBody, linkKey);
  const beforeRevoke = await ok('GET', `/v1/coordination/instances/${reader.id}`, 'reader'); assert(beforeRevoke.actions.length);
  const staleAction = beforeRevoke.actions[0];
  const staleCommand = findCommand(await commands('reader'), 'discovery.act', { instanceId: reader.id, actionId: staleAction.id });
  const revokeBody = { grantId: claim.grants[0].id, expectedAclRevision: claim.aclRevision }, revokeKey = key();
  const revoked = await ok('POST', `${knowledge}/${claim.id}/revoke`, 'author', revokeBody, revokeKey);
  assert.equal(revoked.claim.grants.length, 0);
  await hidden('revoked claim detail', `${knowledge}/${claim.id}`, `${knowledge}/rc1-missing-claim`, 'reader');
  assert(!(await ok('GET', knowledge, 'reader')).claims.some((entry) => entry.id === claim.id));
  assert.deepEqual((await ok('GET', `${knowledge}/archive`, 'reader')).entries, []);
  assert.deepEqual((await ok('GET', `${knowledge}/${ownClaim.id}`, 'reader')).links, []);
  await deny('revoked evidence cannot authorize stale direct action', [404], 'POST', `/v1/coordination/instances/${reader.id}/act`, 'reader',
    { expectedRevision: beforeRevoke.revision, actionId: staleAction.id });
  await deny('revoked evidence cannot authorize stale Player Command', [409], 'POST', '/v1/commands/execute', 'reader',
    { executionId: staleCommand.executionIdentity.executionId, confirmed: true }, staleCommand.executionIdentity.executionId);
  await deny('new archive request cannot use revoked claim', [404], 'POST', `${knowledge}/archive`, 'reader', { claimId: claim.id });
  await deny('new link request cannot use revoked claim', [404], 'POST', `${knowledge}/links`, 'reader', linkBody);
  await restart();
  await sameState('restarted share retry recreated a revoked grant', async () => assert.deepEqual(await ok('POST', shareUrl, 'author', shareBody, shareKey), shared));
  await sameState('restarted revoke retry mutated ACL again', async () => assert.deepEqual(await ok('POST', `${knowledge}/${claim.id}/revoke`, 'author', revokeBody, revokeKey), revoked));
  await sameState('historical archive retry changed revoked authority', async () => assert.deepEqual(await ok('POST', `${knowledge}/archive`, 'reader', { claimId: claim.id }, archiveKey), archived));
  await sameState('historical link retry changed revoked authority', async () => assert.deepEqual(await ok('POST', `${knowledge}/links`, 'reader', linkBody, linkKey), linked));
  assert(!JSON.stringify(archived).includes(claim.id) && !JSON.stringify(linked).includes(claim.id));
  await hidden('revoked claim after server reconstruction and exact retries', `${knowledge}/${claim.id}`, `${knowledge}/rc1-missing-claim`, 'reader');
  assert(!(await ok('GET', `${knowledge}/${claim.id}`, 'author')).claim.grants.length);
  report('hidden claim/instance IDs, stale ACL, revoked Knowledge, hidden archive/link views, stale direct/Player Commands and restart replay');
  return { scope: 'native fixture-assisted Family/Knowledge HTTP boundary regression', groups: passed, deniedCases: denials,
    authorityTablesCompared: AUTHORITY_TABLES.length, serverReconstructions: 2,
    initialFixture: { actors: Object.keys(actors), cashPerActor: 100000, respectPerActor: 10000,
      locations: { reader: 'docks', others: 'foundry' }, familyAndCrewMembers: ['boss', 'participant', 'nonparticipant'],
      note: 'Only initial actors and memberships are inserted; all measured operations, discovery, sharing and revocation use canonical HTTP.' },
    exclusions: ['complete route/role cross product', 'all operation terminal branches', 'all Knowledge source/propagation policies', 'natural social entry'] };
}
