// Focused checked-client, provenance, encrypted target, ACL and rebuild proofs.
// Real PostgreSQL membership/lock interleavings are exercised by the separate
// coordination-knowledge-postgres test; this suite verifies pg-mem compensation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { registerPgMemCompatibility, dbCaps } from '../src/db.js';
import { withPhase2Transaction } from '../src/content/phase2-transactions.js';
import { createCoordinationKnowledge } from '../src/coordination/knowledge.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';

const mem = newDb({ noAstCoverageCheck: true });
registerPgMemCompatibility(mem, DataType); dbCaps.skipLocked = false;
const { Pool } = mem.adapters.createPg(), pool = new Pool();
const key = () => crypto.randomUUID();
const reject = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const api = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
const tables = ['coordination_claims', 'coordination_claim_acl_state', 'coordination_claim_acl_events',
  'coordination_claim_grants', 'coordination_claim_links', 'coordination_knowledge_archives',
  'coordination_archive_events', 'coordination_archive_entries', 'coordination_commands'];
const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async (table) => [table,
  (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
const use = (accountId, action, customPool = pool) => withPhase2Transaction(customPool, async (client) => {
  const character = (await client.query('SELECT * FROM characters WHERE account_id=$1 AND alive=true FOR UPDATE', [accountId])).rows[0] ?? null;
  await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [accountId]);
  const ctx = await knowledge.context(client, { accountId, character, lock: true });
  return action(client, ctx);
});
const args = (value) => ({ ...value, commandId: key(), now: Date.now() });
async function player(accountId, name, loc = 'docks') {
  await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$3)', [accountId, 'test', accountId]);
  await pool.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$3,1,$4)', [`${accountId}-ch`, accountId, name, loc]);
}
async function discover(accountId) {
  let instance = (await api.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  instance = (await api.act(accountId, instance.id, { expectedRevision: instance.revision, actionId: instance.actions[0].id }, key())).instance;
  const action = instance.actions.find((candidate) => candidate.kind === 'discover');
  await api.act(accountId, instance.id, { expectedRevision: instance.revision, actionId: action.id }, key());
  return (await api.knowledgeBoard(accountId)).claims[0];
}
function faultPool(nth) {
  let writes = 0;
  return { async connect() {
    const client = await pool.connect();
    return { release: (...rest) => client.release(...rest), async query(sql, values) {
      if (/^(INSERT|UPDATE|DELETE)\b/.test(sql.trim()) && ++writes === nth) {
        throw Object.assign(Error('injected write rollback'), { code: '40001' });
      }
      return client.query(sql, values);
    } };
  } };
}

try {
  await pool.query(schema); await pool.query(schema);
  await player('knowledge-a', 'Archivist'); await player('knowledge-b', 'Witness', 'foundry');
  await player('knowledge-c', 'Observer');
  const own = await discover('knowledge-a'), foreign = await discover('knowledge-b');
  assert.equal((await api.knowledgeArchive('knowledge-a')).entries.length, 0);
  assert.equal((await api.knowledgeBoard('knowledge-c')).claims.length, 0);
  await reject(knowledge.board(pool, {}, {}), 'content_transaction_required');
  let escaped;
  await use('knowledge-a', async (_client, ctx) => { escaped = ctx; });
  await use('knowledge-a', async (client) => {
    await reject(knowledge.board(client, escaped), 'content_transaction_required');
    await reject(knowledge.board(client, { accountId: 'knowledge-a' }), 'content_transaction_required');
  });
  await reject(use('knowledge-a', (client, ctx) => knowledge.board(client, ctx, { limit: 51 })), 'bad_knowledge_request');
  await reject(use('knowledge-a', (client, ctx) => knowledge.board(client, ctx, { extra: 1 })), 'bad_knowledge_request');

  const row = (await pool.query('SELECT * FROM coordination_claims WHERE id=$1', [own.id])).rows[0];
  const sourceEvent = (await pool.query('SELECT * FROM coordination_events WHERE id=$1', [row.source_event_id])).rows[0];
  const beforeDuplicate = await snapshot();
  await use('knowledge-a', async (client, ctx) => {
    const replay = await knowledge.issueClaim(client, ctx, { instanceId: row.instance_id, nodeId: row.node_id,
      sourceEventId: row.source_event_id, commandId: sourceEvent.correlation_id, now: Date.now() });
    assert.equal(replay.id, own.id);
  });
  assert.deepEqual(await snapshot(), beforeDuplicate, 'same authentic discovery cannot mint twice');
  await reject(use('knowledge-a', (client, ctx) => knowledge.issueClaim(client, ctx,
    args({ instanceId: row.instance_id, nodeId: row.node_id, sourceEventId: row.source_event_id }))), 'knowledge_unavailable');
  await reject(use('knowledge-b', (client, ctx) => knowledge.issueClaim(client, ctx, {
    instanceId: row.instance_id, nodeId: row.node_id, sourceEventId: row.source_event_id,
    commandId: sourceEvent.correlation_id, now: Date.now() })), 'knowledge_unavailable');
  await pool.query('UPDATE coordination_claims SET value_json=$2 WHERE id=$1', [row.id, '{"type":"text","value":"forged"}']);
  await reject(api.knowledgeGet('knowledge-a', row.id), 'knowledge_corrupt');
  await pool.query('UPDATE coordination_claims SET value_json=$2 WHERE id=$1', [row.id, row.value_json]);

  const targets = await use('knowledge-b', (client, ctx) => knowledge.targets(client, ctx, { characterName: 'Archivist' }));
  const target = targets.targets[0]; assert.equal(target.kind, 'account');
  const raw = Buffer.from(target.id, 'base64url').toString('utf8');
  for (const privateId of ['knowledge-a', 'knowledge-b']) assert(!raw.includes(privateId), 'encrypted recipient/caller principals');
  const shareInput = args({ claimId: foreign.id, targetId: target.id, expectedAclRevision: 0 });
  await reject(use('knowledge-a', (client, ctx) => knowledge.share(client, ctx, shareInput)), 'knowledge_stale_target');
  await reject(use('knowledge-b', (client, ctx) => knowledge.share(client, ctx,
    { ...shareInput, targetId: `${target.id.slice(0, 20)}x${target.id.slice(21)}` })), 'knowledge_stale_target');
  const beforeShare = await snapshot();
  for (let nth = 1; nth <= 3; nth++) {
    await reject(use('knowledge-b', (client, ctx) => knowledge.share(client, ctx, shareInput), faultPool(nth)), 'contention');
    assert.deepEqual(await snapshot(), beforeShare, `share rollback boundary ${nth}`);
  }
  const shared = await use('knowledge-b', (client, ctx) => knowledge.share(client, ctx, shareInput));
  assert.equal(shared.claim.aclRevision, 1);
  const foreignView = (await api.knowledgeGet('knowledge-a', foreign.id)).claim;
  assert(!Object.hasOwn(foreignView, 'grants')); assert(!Object.hasOwn(foreignView, 'aclRevision'));
  for (const privateId of ['knowledge-a', 'knowledge-b', row.source_event_id]) assert(!JSON.stringify(foreignView).includes(privateId));
  const page = await api.knowledgeBoard('knowledge-a', { limit: 1 });
  assert.equal(page.claims.length, 1); assert(page.nextCursor);
  const next = await api.knowledgeBoard('knowledge-a', { limit: 1, cursor: page.nextCursor });
  assert.equal(next.claims.length, 1); assert.notEqual(next.claims[0].id, page.claims[0].id); assert.equal(next.nextCursor, null);
  await reject(api.knowledgeBoard('knowledge-b', { cursor: page.nextCursor }), 'bad_knowledge_cursor');
  await reject(api.knowledgeArchive('knowledge-a', { cursor: page.nextCursor }), 'bad_knowledge_cursor');
  await reject(use('knowledge-b', (client, ctx) => knowledge.share(client, ctx, shareInput)), 'knowledge_stale_acl');

  const beforeLink = await snapshot();
  await reject(use('knowledge-a', (client, ctx) => knowledge.link(client, ctx,
    args({ fromClaimId: own.id, toClaimId: foreign.id, relation: 'contradicts' })), faultPool(1)), 'contention');
  assert.deepEqual(await snapshot(), beforeLink);
  const link = await api.linkKnowledge('knowledge-a', { fromClaimId: own.id, toClaimId: foreign.id, relation: 'contradicts' }, key());
  assert(!Object.hasOwn(link.link, 'fromClaimId')); assert(!Object.hasOwn(link.link, 'toClaimId'));
  assert.equal((await api.knowledgeGet('knowledge-a', own.id)).links.length, 1);
  const beforeArchive = await snapshot();
  for (let nth = 1; nth <= 3; nth++) {
    await reject(use('knowledge-a', (client, ctx) => knowledge.archive(client, ctx,
      args({ claimId: foreign.id })), faultPool(nth)), 'contention');
    assert.deepEqual(await snapshot(), beforeArchive, `archive rollback boundary ${nth}`);
  }
  const archive = await api.archiveKnowledge('knowledge-a', { claimId: foreign.id }, key());
  assert(!Object.hasOwn(archive.archive, 'claimId'));
  assert.equal((await api.knowledgeArchive('knowledge-a')).entries[0].claim.id, foreign.id);
  // Inject a committed permission change after the bounded SQL candidate scan.
  // Successful pages may not silently omit a slot or falsely end continuation.
  for (const [pattern, read] of [
    [/SELECT c\.id FROM coordination_claims c/, (client, ctx) => knowledge.board(client, ctx)],
    [/SELECT e\.\* FROM coordination_archive_entries e/, (client, ctx) => knowledge.archiveBoard(client, ctx)],
  ]) {
    let changed = false;
    const racedPool = { async connect() {
      const client = await pool.connect();
      return { release: (...rest) => client.release(...rest), async query(sql, values) {
        const response = await client.query(sql, values);
        if (!changed && pattern.test(sql)) {
          changed = true;
          await pool.query('UPDATE coordination_claim_grants SET active=false WHERE id=$1', [shared.claim.grants[0].id]);
        }
        return response;
      } };
    } };
    await reject(use('knowledge-a', read, racedPool), 'contention');
    assert(changed);
    await pool.query('UPDATE coordination_claim_grants SET active=true WHERE id=$1', [shared.claim.grants[0].id]);
  }
  const recordsBeforeRebuild = await snapshot();
  await pool.query('DELETE FROM coordination_claim_grants WHERE claim_id=$1', [foreign.id]);
  await pool.query('DELETE FROM coordination_claim_acl_state WHERE claim_id=$1', [foreign.id]);
  const beforeRepair = await snapshot();
  for (let nth = 1; nth <= 2; nth++) {
    await reject(use('knowledge-b', (client, ctx) => knowledge.rebuild(client, ctx, args({})), faultPool(nth)), 'contention');
    assert.deepEqual(await snapshot(), beforeRepair, `repair rollback boundary ${nth}`);
  }
  assert.equal((await api.knowledgeBoard('knowledge-a')).claims.length, 1);
  const rebuiltGrant = await api.rebuildKnowledge('knowledge-b', {}, key());
  assert.equal(rebuiltGrant.rebuilt.grants, 1);
  assert.equal((await api.knowledgeBoard('knowledge-a')).claims.length, 2);
  await pool.query('DELETE FROM coordination_archive_entries WHERE id=$1', [archive.archive.id]);
  const rebuiltArchive = await api.rebuildKnowledge('knowledge-a', {}, key());
  assert.equal(rebuiltArchive.rebuilt.archiveEntries, 1);
  assert.equal((await api.knowledgeArchive('knowledge-a')).entries.length, 1);
  for (const table of ['coordination_claims', 'coordination_claim_acl_events', 'coordination_claim_links', 'coordination_archive_events']) {
    assert.deepEqual((await snapshot())[table], recordsBeforeRebuild[table], `${table} remains immutable during repair`);
  }
  const off = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT, enabled: false });
  assert.deepEqual((await off.knowledgeTargets('knowledge-b', { characterName: 'Archivist' })).targets, []);
  await reject(off.shareKnowledge('knowledge-b', foreign.id, { targetId: target.id, expectedAclRevision: 1 }, key()), 'knowledge_sharing_disabled');
  const beforeRevoke = await snapshot();
  for (let nth = 1; nth <= 3; nth++) {
    await reject(use('knowledge-b', (client, ctx) => knowledge.revoke(client, ctx, args({ claimId: foreign.id,
      grantId: shared.claim.grants[0].id, expectedAclRevision: 1 })), faultPool(nth)), 'contention');
    assert.deepEqual(await snapshot(), beforeRevoke, `revoke rollback boundary ${nth}`);
  }
  const revoke = await off.revokeKnowledge('knowledge-b', foreign.id,
    { grantId: shared.claim.grants[0].id, expectedAclRevision: 1 }, key());
  assert.equal(revoke.claim.aclRevision, 2); assert.equal(revoke.claim.grants.length, 0);
  await reject(api.knowledgeGet('knowledge-a', foreign.id), 'knowledge_unavailable');
  assert.equal((await api.knowledgeGet('knowledge-a', own.id)).links.length, 0);
  assert.equal((await api.knowledgeArchive('knowledge-a')).entries.length, 0);
  assert.equal((await off.knowledgeBoard('knowledge-b')).claims[0].id, foreign.id);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM transactions')).rows[0].n), 0);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM coordination_claims')).rows[0].n), 2);

  // Two individually bounded histories exceed the aggregate repair-work budget.
  // A real dense SQL fixture ensures the first claim's repairs also roll back.
  await player('knowledge-budget', 'Budget Keeper');
  await discover('knowledge-budget');
  await pool.query("UPDATE characters SET loc='foundry' WHERE account_id='knowledge-budget'");
  const budgetRun = (await pool.query("SELECT id FROM coordination_instances WHERE owner_account_id='knowledge-budget'")).rows[0];
  const budgetView = await api.get('knowledge-budget', budgetRun.id);
  await api.act('knowledge-budget', budgetView.id, { expectedRevision: budgetView.revision,
    actionId: budgetView.actions.find((action) => action.kind === 'discover').id }, key());
  const budgetClaims = (await api.knowledgeBoard('knowledge-budget')).claims;
  assert.equal(budgetClaims.length, 2);
  for (const claim of budgetClaims) {
    const grantId = key();
    for (let offset = 0; offset < 2048; offset += 128) {
      const values = [], tuples = [];
      for (let revision = offset + 1; revision <= offset + 128; revision++) {
        const row = [key(), claim.id, grantId, revision % 2 ? 'grant' : 'revoke', 'account',
          'knowledge-c', 'Observer', revision, 'knowledge-budget', key(), new Date()];
        tuples.push(`(${row.map((_, index) => `$${values.length + index + 1}`).join(',')})`); values.push(...row);
      }
      await pool.query(`INSERT INTO coordination_claim_acl_events(id,claim_id,grant_id,operation,
        recipient_kind,recipient_id,recipient_label,revision,author_account_id,command_id,occurred_at)
        VALUES ${tuples.join(',')}`, values);
    }
  }
  const beforeBudgetRepair = await snapshot();
  await reject(api.rebuildKnowledge('knowledge-budget', {}, key()), 'knowledge_limit');
  assert.deepEqual(await snapshot(), beforeBudgetRepair, 'aggregate-budget rejection compensates earlier repairs');
  console.log('coordination-knowledge: checked contexts, immutable provenance, encrypted targets, filtered pages with revoke retry, 12 rollback boundaries, aggregate rebuild bound and disabled recovery pass');
} finally { await pool.end(); }
