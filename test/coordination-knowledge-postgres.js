// Explicit loopback PostgreSQL proofs for live knowledge authority and lock ordering.
// This runner never reads DATABASE_URL, starts a database, or changes an existing schema.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';
import { dbCaps } from '../src/db.js';
import { createCoordinationRegistry, coordinationGraphs } from '../src/coordination/graph.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import * as Crew from '../src/crew.js';
import { kickMember as kickFamilyMember, removeMember as removeFamilyMember } from '../src/social/gangs.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
const namespace = `coordination_knowledge_test_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString(), max: 4 });
const pool = new pg.Pool({ connectionString: endpoint.toString(), max: 12,
  options: `-c search_path=${namespace} -c lock_timeout=5000 -c statement_timeout=10000` });
dbCaps.skipLocked = true;
const key = () => crypto.randomUUID();
const always = { kind: 'always' };
const completed = (nodeId) => ({ kind: 'node_completed', nodeId });
const evidenceRule = { kind: 'independent_evidence', domain: 'review.knowledge', proposition: 'sealed',
  value: { type: 'boolean', value: true }, sourceRoots: ['source-a', 'source-b'] };
const source = { schemaVersion: 2, id: 'review.knowledge', version: 1, title: 'Knowledge review', nodes: [
  ...[['a', 'docks', true], ['b', 'downtown', true], ['c', 'foundry', false]].map(([id, districtId, value]) => ({
    id, kind: 'task', title: `Source ${id}`, visibility: 'hidden',
    discover: { kind: 'at_district', districtId }, requires: always,
    claim: { domain: 'review.knowledge', proposition: 'sealed', sourceRoot: `source-${id}`, value: { type: 'boolean', value } },
  })),
  { id: 'end', kind: 'terminal', title: 'Evidence established', visibility: 'public', discover: always,
    requires: { kind: 'all', rules: [evidenceRule, { kind: 'any', rules: ['a', 'b', 'c'].map(completed) }] } },
] };
const registry = createCoordinationRegistry([source]);
const contentHash = coordinationGraphs(registry)[0].contentHash;
const service = (options = {}) => createCoordinationService({ pool, registry, enabled: true,
  knowledgeEnabled: true, sharingEnabled: true, ...options });
const api = service();
const rejectCode = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pendingReleases = new Set();

// Pause after a real SELECT has acquired its PostgreSQL locks. The other path is
// observed through pg_stat_activity, so these proofs do not assume a lucky sleep.
function pausedPool(match) {
  const reached = deferred(), resume = deferred();
  pendingReleases.add(resume.resolve);
  let fired = false;
  return { reached: reached.promise, resume: resume.resolve, pool: {
    query: (...args) => pool.query(...args),
    async connect() {
      const client = await pool.connect();
      return { release: (...args) => client.release(...args), async query(sql, args) {
        const result = await client.query(sql, args);
        if (!fired && match(sql, args, result)) { fired = true; reached.resolve(); await resume.promise; }
        return result;
      } };
    },
  } };
}
function tracedPool() {
  const connected = deferred();
  return { connected: connected.promise, pool: { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    connected.resolve(Number((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid));
    return client;
  } } };
}
async function waitForLock(pid, label) {
  const deadline = Date.now() + 3500;
  while (Date.now() < deadline) {
    const row = (await admin.query('SELECT wait_event_type, wait_event FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
    if (row?.wait_event_type === 'Lock') return;
    await sleep(20);
  }
  assert.fail(`${label}: expected an observed PostgreSQL lock wait`);
}
async function within(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error(`${label}: exceeded 12-second proof budget`)), 12000);
  })]); } finally { clearTimeout(timer); }
}
async function player(id, loc = 'docks') {
  await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [id, 'test']);
  await pool.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$2,1,$3)', [`${id}-ch`, id, loc]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  return id;
}
async function start(account) {
  return (await api.create(account, source.id, { expectedContentHash: contentHash }, key())).instance;
}
async function discover(account, district = 'docks') {
  await pool.query('UPDATE characters SET loc=$2 WHERE account_id=$1 AND alive', [account, district]);
  let view = await start(account);
  const action = view.actions.find((item) => item.kind === 'discover');
  assert(action, `discovery is issued in ${district}`);
  const result = await api.act(account, view.id, { expectedRevision: view.revision, actionId: action.id }, key());
  return { view: result.instance, claim: (await api.knowledgeBoard(account)).claims
    .find((claim) => claim.owned && claim.source.root === `source-${district === 'docks' ? 'a' : district === 'downtown' ? 'b' : 'c'}`) };
}
async function target(account, kind, characterName) {
  const reply = await api.knowledgeTargets(account, characterName ? { characterName } : {});
  const issued = reply.targets.find((item) => item.kind === kind);
  assert(issued, `server issues ${kind} target`);
  return issued.id;
}
async function share(owner, claimId, kind, characterName, commandKey = key()) {
  const current = (await api.knowledgeGet(owner, claimId)).claim;
  return api.shareKnowledge(owner, claimId, { expectedAclRevision: current.aclRevision,
    targetId: await target(owner, kind, characterName) }, commandKey);
}
async function revoke(owner, claimId, grantId, instance = api) {
  const current = (await api.knowledgeGet(owner, claimId)).claim;
  return instance.revokeKnowledge(owner, claimId, { expectedAclRevision: current.aclRevision, grantId }, key());
}
const readable = async (account, claimId) => (await api.knowledgeGet(account, claimId)).claim;
const terminal = (view) => view.actions.find((action) => action.nodeId === 'end');

// Invoke the existing membership implementations using their route lock order.
// Fixtures retain their boss, avoiding unrelated dissolution/economic side effects.
async function membershipKick(kind, leader, member, hooks = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = Number((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    hooks.connected?.(pid);
    const crewId = kind === 'crew' ? await Crew.CREW_FIRST_CHARACTER_LOCKS.beforeCharacterLock(client, leader) : null;
    const ch = (await client.query('SELECT * FROM characters WHERE account_id=$1 AND alive FOR UPDATE', [leader])).rows[0];
    await client.query('SELECT * FROM account_persistent WHERE account_id=$1 FOR UPDATE', [leader]);
    if (kind === 'crew') {
      await Crew.CREW_FIRST_CHARACTER_LOCKS.afterAccountLock(client, leader, ch, crewId);
      await Crew.kickMember(ch, `${member}-ch`, client, {});
    } else await kickFamilyMember(ch, `${member}-ch`, client, { owned: { gangRole: 'boss', gangId: 'review-family' } });
    hooks.deleted?.();
    if (hooks.beforeCommit) await hooks.beforeCommit;
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

try {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  await pool.query(schema);
  console.log(`PostgreSQL ${String((await pool.query('SHOW server_version')).rows[0].server_version)}; isolated schema ${namespace}`);

  const owner = await player('review-owner'), other = await player('review-other', 'downtown');
  const member = await player('review-member'), leader = await player('review-leader');
  const stranger = await player('review-stranger');
  const a = (await discover(owner)).claim, b = (await discover(other, 'downtown')).claim;
  assert(a && b);
  await rejectCode(api.knowledgeGet(stranger, a.id), 'knowledge_unavailable');
  await rejectCode(api.knowledgeGet(stranger, key()), 'knowledge_unavailable');
  const initialClaimCount = Number((await pool.query('SELECT COUNT(*) AS n FROM coordination_claims')).rows[0].n);

  const shared = await share(owner, a.id, 'account', 'review-member');
  const grant = shared.claim.grants.find((row) => row.kind === 'account');
  assert(grant);
  assert.equal((await readable(member, a.id)).owned, false);
  const archiveReceipt = await api.archiveKnowledge(member, { claimId: a.id }, key());
  assert(archiveReceipt.archive.id);
  assert.equal(archiveReceipt.archive.claimId, undefined, 'archive receipt does not retain foreign claim IDs');

  const held = pausedPool((sql) => /FROM coordination_claims/i.test(sql) && /FOR (SHARE|UPDATE)/i.test(sql));
  const reading = service({ pool: held.pool }).knowledgeGet(member, a.id);
  await within(held.reached, 'read acquired claim lock');
  const trace = tracedPool();
  const revoking = service({ pool: trace.pool }).revokeKnowledge(owner, a.id,
    { expectedAclRevision: shared.claim.aclRevision, grantId: grant.id }, key());
  await waitForLock(await trace.connected, 'revoke waits for checked disclosure');
  held.resume();
  assert.equal((await within(reading, 'overlapping read')).claim.id, a.id);
  await within(revoking, 'revocation');
  await rejectCode(api.knowledgeGet(member, a.id), 'knowledge_unavailable');
  assert(!(await api.knowledgeBoard(member)).claims.some((claim) => claim.id === a.id));
  assert(!(await api.knowledgeArchive(member)).entries.some((entry) => entry.claim.id === a.id));
  console.log('PASS live ACL: disclosure/revoke serial order; board and archive omit revoked evidence');

  const sharedAgain = await share(owner, a.id, 'account', 'review-member');
  const revokeBarrier = pausedPool((sql) => /^UPDATE coordination_claim_grants\b/i.test(sql));
  const firstRevoke = service({ pool: revokeBarrier.pool }).revokeKnowledge(owner, a.id,
    { expectedAclRevision: sharedAgain.claim.aclRevision,
      grantId: sharedAgain.claim.grants.find((row) => row.kind === 'account').id }, key());
  await within(revokeBarrier.reached, 'revoke changed grant while holding claim');
  const waitingRead = tracedPool();
  const refusedRead = rejectCode(service({ pool: waitingRead.pool }).knowledgeGet(member, a.id), 'knowledge_unavailable');
  await waitForLock(await waitingRead.connected, 'read waits for committing revoke');
  revokeBarrier.resume();
  await within(Promise.all([firstRevoke, refusedRead]), 'revoke-before-read');
  console.log('PASS reverse ACL order: read waits for pending revoke and then refuses');

  // Membership changes use their actual shared-domain functions, in both orders.
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('review-crew','Review Crew',$1)", [leader]);
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('review-family','Review Family','RPG')");
  for (const account of [owner, member, leader]) {
    await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('review-crew',$1,$1)", [account]);
    await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('review-family',$1,$2)",
      [`${account}-ch`, account === leader ? 'boss' : 'soldier']);
  }
  for (const kind of ['crew', 'family']) {
    await share(owner, a.id, kind);
    const membershipTable = kind === 'crew' ? 'crew_members' : 'gang_members';
    const barrier = pausedPool((sql, args) => new RegExp(`FROM ${membershipTable}\\b`, 'i').test(sql)
      && /FOR (SHARE|UPDATE)/i.test(sql) && args?.includes(kind === 'crew' ? member : `${member}-ch`));
    const read = service({ pool: barrier.pool }).knowledgeGet(member, a.id);
    await within(barrier.reached, `${kind} membership read locked`);
    const kicking = deferred();
    const kick = membershipKick(kind, leader, member, { connected: kicking.resolve });
    await waitForLock(await kicking.promise, `${kind} kick waits for knowledge membership lock`);
    barrier.resume();
    assert.equal((await within(read, `${kind} overlap read`)).claim.id, a.id);
    await within(kick, `${kind} kick`);
    await rejectCode(api.knowledgeGet(member, a.id), 'knowledge_unavailable');

    if (kind === 'crew') await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('review-crew',$1,$1)", [member]);
    else await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('review-family',$1,'soldier')", [`${member}-ch`]);
    const deleted = deferred(), commit = deferred();
    pendingReleases.add(commit.resolve);
    const firstKick = membershipKick(kind, leader, member, { deleted: deleted.resolve, beforeCommit: commit.promise });
    await within(deleted.promise, `${kind} deletion before commit`);
    const secondTrace = tracedPool();
    const postKickRead = rejectCode(service({ pool: secondTrace.pool }).knowledgeGet(member, a.id), 'knowledge_unavailable');
    await waitForLock(await secondTrace.connected, `${kind} read waits for deletion`);
    commit.resolve();
    await within(Promise.all([firstKick, postKickRead]), `${kind} removal-before-read`);
    const ownerView = (await api.knowledgeGet(owner, a.id)).claim;
    await revoke(owner, a.id, ownerView.grants.find((row) => row.kind === kind).id);
    console.log(`PASS ${kind}: real kick waits for read; committed removal immediately removes access`);
  }

  // Source copies from one account cannot satisfy account independence.
  let run = (await discover(owner, 'downtown')).view;
  const completeA = run.actions.find((action) => action.nodeId === 'a');
  assert(completeA);
  run = (await api.act(owner, run.id, { expectedRevision: run.revision, actionId: completeA.id }, key())).instance;
  assert(!terminal(run));
  const independent = await share(other, b.id, 'account', 'review-owner');
  run = await api.get(owner, run.id);
  assert(terminal(run), 'two original accounts with configured roots unlock the gate');
  const issued = terminal(run);
  await revoke(other, b.id, independent.claim.grants[0].id);
  await rejectCode(api.act(owner, run.id, { expectedRevision: run.revision, actionId: issued.id }, key()),
    'coordination_action_unavailable');
  assert(!terminal(await api.get(owner, run.id)));
  console.log('PASS evidence: same-account copies refuse; independent sources unlock; stale action loses revoked authority');

  const newIndependent = await share(other, b.id, 'account', 'review-owner');
  run = await api.get(owner, run.id);
  const gateRevoke = pausedPool((sql) => /^UPDATE coordination_claim_grants\b/i.test(sql));
  const revokeBeforeAct = service({ pool: gateRevoke.pool }).revokeKnowledge(other, b.id,
    { expectedAclRevision: newIndependent.claim.aclRevision,
      grantId: newIndependent.claim.grants.find((row) => row.kind === 'account').id }, key());
  await within(gateRevoke.reached, 'gate claim revocation pending');
  const actTrace = tracedPool();
  const invalidatedAct = rejectCode(service({ pool: actTrace.pool }).act(owner, run.id,
    { expectedRevision: run.revision, actionId: terminal(run).id }, key()), 'coordination_action_unavailable');
  await waitForLock(await actTrace.connected, 'gate act waits for revoked evidence');
  gateRevoke.resume();
  await within(Promise.all([revokeBeforeAct, invalidatedAct]), 'gate revocation race');
  assert.equal((await api.get(owner, run.id)).revision, run.revision);
  console.log('PASS gate race: pending evidence revoke wins without a partial instance transition');

  await share(owner, a.id, 'account', 'review-other');
  await share(other, b.id, 'account', 'review-owner');
  const links = await within(Promise.all([
    api.linkKnowledge(owner, { fromClaimId: a.id, toClaimId: b.id, relation: 'corroborates' }, key()),
    api.linkKnowledge(other, { fromClaimId: b.id, toClaimId: a.id, relation: 'corroborates' }, key()),
  ]), 'reciprocal claim links');
  assert(links.every((reply) => reply.link.assertion === 'player'));
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM coordination_claim_links')).rows[0].n), 2);
  assert(!JSON.stringify(links).includes(a.id) && !JSON.stringify(links).includes(b.id));
  console.log('PASS reciprocal links: stable claim order and receipts without evidence identifiers');

  const personal = await discover(member);
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('review-family',$1,'soldier')", [`${member}-ch`]);
  await share(owner, a.id, 'family');
  assert.equal((await readable(member, a.id)).id, a.id);
  const dying = await pool.connect();
  try {
    await dying.query('BEGIN');
    await dying.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [`${member}-ch`]);
    await dying.query('SELECT * FROM account_persistent WHERE account_id=$1 FOR UPDATE', [member]);
    await removeFamilyMember(dying, 'review-family', `${member}-ch`);
    await dying.query('UPDATE characters SET alive=false WHERE id=$1', [`${member}-ch`]);
    await dying.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$2,1,$3)',
      [`${member}-heir`, member, 'docks']);
    const deathTrace = tracedPool();
    const heirRead = rejectCode(service({ pool: deathTrace.pool }).knowledgeGet(member, a.id), 'knowledge_unavailable');
    await waitForLock(await deathTrace.connected, 'knowledge read waits for death');
    await dying.query('COMMIT');
    await within(heirRead, 'post-death family authority');
  } catch (error) { await dying.query('ROLLBACK'); throw error; }
  finally { dying.release(); }
  assert.equal((await readable(member, personal.claim.id)).owned, true, 'account retains its own historical evidence');
  const oldRun = await api.get(member, personal.view.id);
  assert.equal(oldRun.historical, true);
  assert.equal(oldRun.actions.length, 0);
  assert.equal((await pool.query('SELECT origin_character_id FROM coordination_claims WHERE id=$1', [personal.claim.id]))
    .rows[0].origin_character_id, `${member}-ch`);
  console.log('PASS death/heir: real family removal, current-character relookup, historical private evidence without action inheritance');

  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM coordination_claims')).rows[0].n), initialClaimCount + 2);
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM transactions')).rows[0].n), 0);
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM item_events')).rows[0].n), 0);
  console.log('PASS value boundary: sharing/archive/revocation created no discovery copy or economic event');
} finally {
  for (const release of pendingReleases) release();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`);
  await admin.end();
}
