// Public-service Phase 1 journeys. The optional database mode uses only an explicitly named
// loopback scratch database and a random disposable schema, never the game's DATABASE_URL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs, createCoordinationRegistry } from '../src/coordination/graph.js';
import { COORDINATION_PILOT, COORDINATION_KNOWLEDGE_PILOT, COORDINATION_ALL_PILOTS } from '../src/coordination/pilot.js';

const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
let pool, cleanup;
if (process.argv.includes('--postgres')) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
  const { Pool } = await import('pg');
  const base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `coordination_knowledge_runtime_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true });
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool();
  cleanup = () => pool.end(); dbCaps.skipLocked = false;
}

const definition = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const { contentHash: _hash, ...source } = definition;
const idempotencyKey = () => crypto.randomUUID();
const rejects = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
const rows = async (table) => (await pool.query(`SELECT * FROM ${table}`)).rows
  .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const coordinatedTables = [
  'coordination_definitions', 'coordination_instances', 'coordination_commands', 'coordination_events',
  'coordination_claims', 'coordination_claim_acl_state', 'coordination_claim_acl_events',
  'coordination_claim_grants', 'coordination_claim_links', 'coordination_knowledge_archives',
  'coordination_archive_events', 'coordination_archive_entries',
];
const snapshot = async (tables = coordinatedTables) => Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await rows(table)])));
const economySnapshot = () => snapshot(['accounts', 'characters', 'account_persistent', 'transactions',
  'item_stacks', 'item_instances', 'operation_escrow', 'content_inventory_lots']);

// Record only service-issued DML. Fixture setup/travel/death use the unwrapped test pool.
const serviceWrites = new Set();
function observedPool({ failMatch = null, loseCommit = false } = {}) {
  let failed = false;
  const query = async (client, sql, args) => {
    const statement = typeof sql === 'string' ? sql : sql.text;
    const write = statement.trim().match(/^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i);
    if (write) serviceWrites.add(write[1]);
    if (!failed && failMatch?.test(statement)) {
      failed = true;
      throw Object.assign(Error('injected knowledge discovery rollback'), { code: '40001' });
    }
    if (!failed && loseCommit && statement === 'COMMIT') {
      failed = true;
      await client.query(sql, args);
      throw Error('lost discovery COMMIT acknowledgement');
    }
    return client.query(sql, args);
  };
  return { query: (sql, args) => query(pool, sql, args), async connect() {
    const client = await pool.connect();
    return { query: (sql, args) => query(client, sql, args), release: (...args) => client.release(...args) };
  } };
}
const service = (options = {}) => createCoordinationService({ pool: observedPool(), registry: COORDINATION_ALL_PILOTS,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true, ...options });
const player = async (id, loc = 'docks') => {
  await pool.query('INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ($1,$2,$3)', [id, 'test', id]);
  await pool.query('INSERT INTO characters (id, account_id, name, season, loc) VALUES ($1,$2,$3,1,$4)', [`${id}-ch`, id, id, loc]);
  return id;
};
const start = (api, account, graph = definition, key = idempotencyKey()) =>
  api.create(account, graph.id, { expectedContentHash: graph.contentHash }, key).then((receipt) => receipt.instance);
const act = (api, account, run, action, key = idempotencyKey()) => {
  assert(action, 'A current issued action is required');
  return api.act(account, run.id, { expectedRevision: run.revision, actionId: action.id }, key);
};
const complete = async (api, account, run, nodeId) => {
  const action = run.actions.find((entry) => entry.kind === 'complete' && entry.nodeId === nodeId);
  return (await act(api, account, run, action)).instance;
};
const discovery = (run) => {
  const actions = run.actions.filter((entry) => entry.kind === 'discover');
  assert.equal(actions.length, 1, 'Fixture should expose exactly one permitted discovery');
  assert.equal(Object.hasOwn(actions[0], 'nodeId'), false, 'A hidden source ID must not enter its discovery descriptor');
  return actions[0];
};
const beginSource = async (api, account, graph = definition) => {
  let run = await start(api, account, graph);
  assert.deepEqual(run.nodes.map((entry) => entry.id), ['briefing']);
  run = await complete(api, account, run, 'briefing');
  return run;
};
const collectSource = async (api, account, nodeId, graph = definition) => {
  let run = await beginSource(api, account, graph);
  run = (await act(api, account, run, discovery(run))).instance;
  assert(run.nodes.some((entry) => entry.id === nodeId));
  run = await complete(api, account, run, nodeId);
  const claimRow = (await pool.query('SELECT id FROM coordination_claims WHERE instance_id=$1 AND node_id=$2', [run.id, nodeId])).rows[0];
  assert(claimRow, 'Executed source discovery must atomically create a claim');
  return { run, claimId: claimRow.id };
};
const assertPrivateRun = (run, secrets = []) => {
  const text = JSON.stringify(run);
  for (const field of ['owner_account_id', 'owner_character_id', 'origin_character_id', 'actor_account_id',
    'source_event_id', 'discovery_receipt', 'knowledgeEvidence', 'receiptIds', 'requires', 'claim']) {
    assert(!text.includes(`"${field}"`), `${field} must stay private`);
  }
  for (const secret of secrets) assert(!text.includes(secret), 'Private cross-account evidence must not enter a run projection');
};

// Sharing helpers below use only issued targets and current ACL revisions; no target owner IDs
// are submitted as authority. They are kept separate from lower-level knowledge-service tests.
async function shareTo(api, owner, claimId, recipient, key = idempotencyKey()) {
  const targetBoard = await api.knowledgeTargets(owner, { characterName: recipient });
  const target = targetBoard.targets.find((entry) => entry.kind === 'account' && entry.label === recipient);
  assert(target, `An issued account target for ${recipient} must exist`);
  const { claim } = await api.knowledgeGet(owner, claimId);
  return api.shareKnowledge(owner, claimId, { targetId: target.id, expectedAclRevision: claim.aclRevision }, key);
}
async function revokeAll(api, owner, claimId) {
  const { claim } = await api.knowledgeGet(owner, claimId);
  assert.equal(claim.grants.length, 1, 'Fixture must have one active grant');
  return api.revokeKnowledge(owner, claimId,
    { grantId: claim.grants[0].id, expectedAclRevision: claim.aclRevision }, idempotencyKey());
}

try {
  await pool.query(schema);
  await pool.query(schema);
  const api = service();
  const a = await player('knowledge-run-a'), b = await player('knowledge-run-b', 'foundry');
  const outsider = await player('knowledge-run-outsider', 'neon');
  const beforeEconomy = await economySnapshot();

  let left = await collectSource(api, a, 'docks-source');
  const right = await collectSource(api, b, 'foundry-source');
  assert.equal(left.run.actions.length, 0, 'One authentic source cannot open the conclusion');
  assert.equal(right.run.actions.length, 0);
  assertPrivateRun(left.run, [b, `${b}-ch`, right.claimId]);
  await rejects(api.get(outsider, left.run.id), 'coordination_unavailable');
  await rejects(api.get(outsider, 'missing-instance'), 'coordination_unavailable');
  assert.deepEqual((await api.knowledgeBoard(a)).claims.map((claim) => claim.id), [left.claimId]);
  await rejects(api.knowledgeGet(outsider, left.claimId), 'knowledge_unavailable');
  await rejects(api.knowledgeGet(outsider, 'missing-claim'), 'knowledge_unavailable');

  await shareTo(api, b, right.claimId, a);
  left.run = await api.get(a, left.run.id);
  const issuedBeforeRevoke = discovery(left.run);
  const sharedReceipt = await api.knowledgeGet(a, right.claimId);
  assert.equal(sharedReceipt.claim.id, right.claimId);
  assert.equal(sharedReceipt.claim.owned, false);
  assert.equal(Object.hasOwn(sharedReceipt.claim, 'aclRevision'), false);
  assert.equal(Object.hasOwn(sharedReceipt.claim, 'grants'), false);
  assert(!JSON.stringify(sharedReceipt).includes(`${b}-ch`));
  assert.equal((await rows('coordination_claims')).length, 2, 'A share grants access without copying or minting evidence');
  await revokeAll(api, b, right.claimId);
  const refusedSnapshot = await snapshot();
  await rejects(act(api, a, left.run, issuedBeforeRevoke), 'coordination_action_unavailable');
  assert.deepEqual(await snapshot(), refusedSnapshot, 'Revoked evidence cannot leave a transition or command receipt');
  assert.equal((await api.get(a, left.run.id)).actions.length, 0);

  await shareTo(api, b, right.claimId, a);
  left.run = await api.get(a, left.run.id);
  left.run = (await act(api, a, left.run, discovery(left.run))).instance;
  assert(left.run.nodes.some((entry) => entry.id === 'conclusion'));
  const terminalBeforeRevoke = left.run.actions.find((entry) => entry.nodeId === 'conclusion');
  await revokeAll(api, b, right.claimId);
  await rejects(act(api, a, left.run, terminalBeforeRevoke), 'coordination_action_unavailable');
  await shareTo(api, b, right.claimId, a);
  left.run = await api.get(a, left.run.id);
  left.run = await complete(api, a, left.run, 'conclusion');
  assert.equal(left.run.status, 'completed');
  assertPrivateRun(left.run, [b, `${b}-ch`, right.claimId]);
  const terminal = (await pool.query("SELECT payload_json FROM coordination_events WHERE instance_id=$1 AND event_type='coordination.node.completed' ORDER BY revision DESC", [left.run.id])).rows[0];
  const evidence = JSON.parse(terminal.payload_json).knowledgeEvidence;
  assert.equal(evidence.length, 1); assert.equal(new Set(evidence[0].receiptIds).size, 2);
  assert.deepEqual(await economySnapshot(), beforeEconomy, 'The complete discovery/share/revoke/gate journey changes no economic or character state');
  console.log('coordination-knowledge-runtime: two-account journey, private projections and live gate revocation pass');

  // One account collecting both roots, including across death and a replacement character,
  // never establishes two originating accounts.
  const solo = await player('knowledge-run-solo');
  let own = await collectSource(api, solo, 'docks-source');
  await pool.query("UPDATE characters SET loc='foundry' WHERE account_id=$1 AND alive=true", [solo]);
  own.run = await api.get(solo, own.run.id);
  own.run = (await act(api, solo, own.run, discovery(own.run))).instance;
  own.run = await complete(api, solo, own.run, 'foundry-source');
  assert.equal(own.run.actions.length, 0, 'Two roots discovered by one account cannot qualify');
  const historicClaims = (await pool.query('SELECT * FROM coordination_claims WHERE owner_account_id=$1 ORDER BY id', [solo])).rows;
  assert.equal(historicClaims.length, 2);
  await pool.query('UPDATE characters SET alive=false WHERE account_id=$1', [solo]);
  await pool.query("INSERT INTO characters (id,account_id,name,season,loc) VALUES ($1,$2,$3,1,'foundry')", [`${solo}-heir`, solo, 'Knowledge heir']);
  const heir = await collectSource(api, solo, 'foundry-source');
  assert.equal(heir.run.actions.length, 0, 'An heir and their historical original character still count as one account');
  const afterHeir = (await pool.query('SELECT * FROM coordination_claims WHERE instance_id=$1 ORDER BY id', [own.run.id])).rows;
  assert.deepEqual(afterHeir, historicClaims, 'Historical origins remain immutable');
  await rejects(act(api, solo, own.run, { id: 'old-or-guessed' }), 'coordination_unavailable');

  const disabled = service({ enabled: false });
  const historical = await disabled.get(solo, own.run.id);
  assert.equal(historical.historical, true); assert.deepEqual(historical.actions, []);
  assert.equal((await disabled.knowledgeGet(solo, own.claimId)).claim.id, own.claimId);
  assert.equal((await disabled.cancel(solo, own.run.id, { expectedRevision: historical.revision }, idempotencyKey())).instance.status, 'cancelled');
  console.log('coordination-knowledge-runtime: own-root and same-account heir non-independence, historical recovery pass');

  // A newly selected content hash cannot qualify an old pinned graph. Retirement removes new
  // admission only; original exact-hash evidence can still finish its historical live run.
  const pinA = await player('knowledge-pin-a'), pinB = await player('knowledge-pin-b', 'foundry');
  const pinC = await player('knowledge-pin-c', 'foundry');
  let pinned = await collectSource(api, pinA, 'docks-source');
  const oldComplement = await collectSource(api, pinB, 'foundry-source');
  const successorRegistry = createCoordinationRegistry([{ ...source, version: 2, title: 'A newer split ledger' }]);
  const successorGraph = coordinationGraphs(successorRegistry)[0];
  const successor = service({ registry: successorRegistry });
  const wrongHash = await collectSource(successor, pinC, 'foundry-source', successorGraph);
  await shareTo(successor, pinC, wrongHash.claimId, pinA);
  assert.equal((await successor.get(pinA, pinned.run.id)).actions.length, 0, 'A different exact hash cannot corroborate old evidence');
  const retired = service({ registry: COORDINATION_PILOT });
  await rejects(start(retired, pinA), 'coordination_unavailable');
  assert.equal((await retired.get(pinA, pinned.run.id)).contentHash, definition.contentHash);
  await shareTo(retired, pinB, oldComplement.claimId, pinA);
  pinned.run = await retired.get(pinA, pinned.run.id);
  pinned.run = (await act(retired, pinA, pinned.run, discovery(pinned.run))).instance;
  pinned.run = await complete(retired, pinA, pinned.run, 'conclusion');
  assert.equal(pinned.run.status, 'completed'); assert.equal(pinned.run.graphVersion, 1);
  console.log('coordination-knowledge-runtime: exact-hash isolation and retired-definition resolution pass');

  const conflictingSource = JSON.parse(JSON.stringify(source));
  conflictingSource.id = 'omerta.coordination.runtime-conflict';
  const firstClaim = conflictingSource.nodes.find((entry) => entry.id === 'docks-source').claim;
  conflictingSource.nodes.push({ id: 'conflicting-source', kind: 'task', title: 'Read the contradictory receipt', visibility: 'hidden',
    discover: { kind: 'all', rules: [{ kind: 'node_completed', nodeId: 'briefing' }, { kind: 'at_district', districtId: 'neon' }] },
    requires: { kind: 'always' }, claim: { ...firstClaim, sourceRoot: 'neon.receipt', value: { type: 'text', value: 'assembled-before-the-fire' } } });
  for (const field of ['discover', 'requires']) conflictingSource.nodes.find((entry) => entry.id === 'conclusion')[field].rules
    .find((rule) => rule.kind === 'any').rules.push({ kind: 'node_completed', nodeId: 'conflicting-source' });
  const conflictRegistry = createCoordinationRegistry([conflictingSource]);
  const conflictGraph = coordinationGraphs(conflictRegistry)[0], conflictApi = service({ registry: conflictRegistry });
  const ca = await player('knowledge-conflict-a'), cb = await player('knowledge-conflict-b', 'foundry');
  const cc = await player('knowledge-conflict-c', 'neon');
  const first = await collectSource(conflictApi, ca, 'docks-source', conflictGraph);
  const second = await collectSource(conflictApi, cb, 'foundry-source', conflictGraph);
  const contrary = await collectSource(conflictApi, cc, 'conflicting-source', conflictGraph);
  await shareTo(conflictApi, cb, second.claimId, ca);
  assert.equal((await conflictApi.get(ca, first.run.id)).actions.filter((entry) => entry.kind === 'discover').length, 1);
  await shareTo(conflictApi, cc, contrary.claimId, ca);
  assert.equal((await conflictApi.get(ca, first.run.id)).actions.length, 0, 'A readable conflicting authoritative value blocks otherwise sufficient roots');
  await revokeAll(conflictApi, cc, contrary.claimId);
  assert.equal((await conflictApi.get(ca, first.run.id)).actions.filter((entry) => entry.kind === 'discover').length, 1);
  console.log('coordination-knowledge-runtime: incompatible readable source blocks qualification until revoked pass');

  const flagsAccount = await player('knowledge-flags-a'), flagsRecipient = await player('knowledge-flags-b');
  const foundationOnly = service({ knowledgeEnabled: false });
  assert.equal((await foundationOnly.catalog(flagsAccount)).graphs.length, 1);
  await rejects(start(foundationOnly, flagsAccount), 'coordination_disabled');
  await rejects(start(service({ accountIds: [flagsRecipient] }), flagsAccount), 'coordination_disabled');
  const privateOnly = service({ sharingEnabled: false });
  const privateClaim = await collectSource(privateOnly, flagsAccount, 'docks-source');
  assert.equal((await privateOnly.knowledgeGet(flagsAccount, privateClaim.claimId)).claim.id, privateClaim.claimId);
  assert.deepEqual((await privateOnly.knowledgeTargets(flagsAccount, { characterName: flagsRecipient })).targets, []);
  await rejects(privateOnly.shareKnowledge(flagsAccount, privateClaim.claimId,
    { targetId: 'unissued', expectedAclRevision: 0 }, idempotencyKey()), 'knowledge_sharing_disabled');
  assert.equal((await disabled.catalog(flagsAccount)).graphs.length, 0);
  assert.equal((await disabled.knowledgeGet(flagsAccount, privateClaim.claimId)).claim.id, privateClaim.claimId);
  console.log('coordination-knowledge-runtime: engine/cohort/knowledge/private-only sharing flags pass');

  // The fixture exposes one district source; two concurrent commands using that same issued
  // revision produce one claim, one discovery event and one committed command.
  const racer = await player('knowledge-runtime-race');
  let race = await beginSource(api, racer);
  const raceAction = discovery(race);
  const outcomes = await Promise.allSettled([act(api, racer, race, raceAction), act(api, racer, race, raceAction)]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((outcome) => outcome.status === 'rejected').reason.code, 'stale_coordination');
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM coordination_claims WHERE instance_id=$1', [race.id])).rows[0].n), 1);

  const faultActor = await player('knowledge-runtime-fault');
  const faultRun = await beginSource(api, faultActor), faultAction = discovery(faultRun);
  for (const failMatch of [/INSERT INTO coordination_claims\b/i, /INSERT INTO coordination_claim_acl_state\b/i,
    /INSERT INTO coordination_commands\b/i]) {
    const before = await snapshot();
    const failing = service({ pool: observedPool({ failMatch }) });
    await rejects(act(failing, faultActor, faultRun, faultAction), 'contention');
    assert.deepEqual(await snapshot(), before, `Discovery failure at ${failMatch} must restore state, event, claim, ACL and receipt`);
  }
  const lostKey = idempotencyKey();
  const ambiguous = service({ pool: observedPool({ loseCommit: true }) });
  await rejects(act(ambiguous, faultActor, faultRun, faultAction, lostKey), 'content_commit_unknown');
  const committed = await snapshot();
  const recovered = await act(disabled, faultActor, faultRun, faultAction, lostKey);
  assert.equal(recovered.replayed, true);
  assert.deepEqual(await snapshot(), committed, 'Replay after disable recovers the original atomic discovery receipt');
  for (const table of serviceWrites) assert(table.startsWith('coordination_'), `Unexpected domain mutation: ${table}`);
  console.log(`coordination-knowledge-runtime: ${dbCaps.skipLocked ? 'PostgreSQL' : 'pg-mem'} complete journeys, lifecycle/flags, races, discovery rollback and ambiguous commit recovery pass`);
} finally { await cleanup(); }
