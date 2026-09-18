// Operation listings preserve independent authority branches and bounded output
// without scanning unrelated global operation/commitment history.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { withItemRead } from '../src/items.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { createCoordinationKnowledge } from '../src/coordination/knowledge.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createWorldKernelQuery } from '../src/world-kernel-query.js';
import { WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS } from '../src/content/world-kernel-pilot.js';
import { COORDINATION_OPERATION_PILOT } from '../src/content/coordination-operation-pilot.js';

const native = process.argv.includes('--postgres');
let pool, cleanup;
if (native) {
  assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit isolated PostgreSQL endpoint required');
  const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
  const { Pool } = await import('pg'), admin = new Pool({ connectionString: endpoint.toString() });
  const schema = `operation_reads_${crypto.randomBytes(8).toString('hex')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${schema} -c statement_timeout=20000` });
  cleanup = async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true }); registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const actor = 'read-viewer', character = 'read-character', crew = 'read-crew', family = 'read-family';
const trace = [];
const observed = { query: (sql, args) => { trace.push({ sql, args }); return pool.query(sql, args); },
  async connect() { const client = await pool.connect(); return {
    query: (sql, args) => { trace.push({ sql, args }); return client.query(sql, args); }, release: () => client.release(),
  }; } };
const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
const kernel = createWorldKernel({ pool, registry: WORLD_KERNEL_REGISTRY, objects: WORLD_KERNEL_OBJECTS, enabled: true });
const operations = createFamilyOperations({ pool, registry: WORLD_KERNEL_REGISTRY, kernel,
  definitions: COORDINATION_OPERATION_PILOT, enabled: true });
const graph = createWorldKernelQuery({ pool, registry: WORLD_KERNEL_REGISTRY });
const expectedRows = [];
async function seed(mode, route, number) {
  const id = `row-${String(expectedRows.length).padStart(4, '0')}`;
  const ownFamily = route === 'family' || route === 'overlap', ownCrew = route === 'crew' || route === 'crew_only_family';
  const opener = route === 'opener' || route === 'overlap', role = route === 'role' || route === 'overlap';
  const promise = route === 'promise' || route === 'overlap';
  const created = new Date(Date.UTC(2026, 0, 1) + (number % 7) * 1000); // deliberate ties, interleaved branches
  if (mode === 'family') await pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,
    opened_by_account_id,status,coordination_mode,family_id,run_key,coordination_definition_hash,
    coordination_definition_json,revision,expires_at,resolution_seed,created_at)
    VALUES($1,'fixture',1,$1,$2,$3,'draft','family',$4,$1,$5,'{}',1,$6,'seed',$7)`,
  [id, ownCrew ? crew : 'other-crew', opener ? actor : 'other-account', ownFamily ? family : 'other-family',
    'f'.repeat(64), new Date(Date.UTC(2027, 0, 1)), created]);
  else await pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,created_at)
    VALUES($1,'fixture',1,$1,$2,$3,'forming',$4)`, [id, ownCrew ? crew : 'other-crew', opener ? actor : 'other-account', created]);
  if (role) await pool.query(`INSERT INTO world_operation_roles(operation_id,role_id,account_id,character_id)
    VALUES($1,'historical',$2,'old-character')`, [id, actor]);
  // Returned historical promises confer read authority, even without a current seat.
  // Two promises must never consume two slots in a branch's limit.
  if (promise) for (const requirement of ['first', 'second']) await pool.query(`INSERT INTO world_operation_commitments
    (operation_id,role_id,requirement_id,account_id,character_id,kind,quantity,state)
    VALUES($1,'historical',$2,$3,'old-character','participation',1,'returned')`, [id, requirement, actor]);
  expectedRows.push({ id, mode, ownFamily, ownCrew, opener, role, promise, created: created.getTime() });
}
const visible = (row, membership) => row.opener || row.role
  || (row.mode === 'family' ? (membership && row.ownFamily) || row.promise : membership && row.ownCrew);
const chronological = (a, b) => b.created - a.created || a.id.localeCompare(b.id);
async function boards(membership) {
  return withItemRead(observed, async (client) => {
    const plan = await operations.planSnapshot(client, actor, { asOf: Date.now() });
    const snapshot = await knowledge.readSnapshot(client, { viewer: { accountId: actor, characterId: character }, groups: plan.groups });
    const board = await plan.render(snapshot);
    const expected = expectedRows.filter((r) => r.mode === 'family' && visible(r, membership)).sort(chronological);
    assert.deepEqual(board.instances.map((r) => r.id), expected.slice(0, 50).map((r) => r.id));
    assert.equal(board.truncated, expected.length > 50);
    for (const limit of [1, 5, 50]) {
      const view = await graph.readSnapshot(client, actor, { limit, knowledgeSnapshot: snapshot, asOf: Date.now() });
      const refs = expectedRows.filter((r) => visible(r, membership)).sort((a, b) => a.id.localeCompare(b.id));
      assert.deepEqual(view.nodes.filter((r) => r.type === 'operation').map((r) => r.id), refs.slice(0, limit).map((r) => r.id));
      assert.equal(view.truncated.operations, refs.length > limit);
    }
  });
}
function nodes(plan) { return [plan, ...(plan.Plans || []).flatMap(nodes)]; }
try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [actor]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,'Read Viewer',1,'foundry')", [character, actor]);
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES($1,'Read Crew',$2)", [crew, actor]);
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES($1,$2,'Read Viewer')", [crew, actor]);
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES($1,'Read Family','READ')", [family]);
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES($1,$2,'boss')", [family, character]);
  for (let n = 0; n < 60; n++) for (const route of ['family', 'opener', 'role', 'promise', 'overlap', 'private', 'crew_only_family']) await seed('family', route, n);
  for (let n = 0; n < 12; n++) for (const route of ['crew', 'opener', 'role', 'promise', 'private']) await seed('crew', route, n);
  await boards(true);
  await pool.query('DELETE FROM crew_members WHERE account_id=$1', [actor]);
  await pool.query('DELETE FROM gang_members WHERE character_id=$1', [character]);
  await boards(false);
  console.log('operation-read-paths: Family/opener/role/returned-promise/legacy-Crew ACL equality, duplicate branches, membership removal, ordering and truncation pass');
  if (native) {
    const indexes = (await pool.query(`SELECT indexname FROM pg_indexes WHERE schemaname=current_schema()
      AND indexname IN ('ix_world_operations_opener','ix_world_operation_commitments_account')`)).rows;
    assert.equal(indexes.length, 2);
    await pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,
      coordination_mode,family_id,run_key,coordination_definition_hash,coordination_definition_json,revision,expires_at,resolution_seed)
      SELECT 'noise-'||n,'noise',1,'noise','noise-crew-'||n,'noise-owner-'||n,'draft','family','noise-family-'||n,
        'noise-'||n,repeat('f',64),'{}',1,now()+interval '1 day','seed' FROM generate_series(1,50000) n`);
    await pool.query(`INSERT INTO world_operation_commitments(operation_id,role_id,requirement_id,account_id,character_id,kind,quantity,state)
      SELECT 'noise-'||n,'presence','presence','noise-owner-'||n,'noise-character-'||n,'participation',1,'promised' FROM generate_series(1,50000) n`);
    for (const table of ['world_operations', 'world_operation_commitments', 'world_operation_roles']) await pool.query(`ANALYZE ${table}`);
    for (const membership of [false, true]) {
      if (membership) {
        await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES($1,$2,'Read Viewer')", [crew, actor]);
        await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES($1,$2,'boss')", [family, character]);
      }
      trace.length = 0; await boards(membership);
      const listings = trace.filter((q) => q.sql.includes(') authorized ORDER BY'));
      assert.equal(listings.length, 4);
      for (const { sql, args } of [listings[0], listings.at(-1)]) {
        const [explain] = (await pool.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`, args)).rows[0]['QUERY PLAN'];
        const scans = nodes(explain.Plan).filter((n) => ['world_operations', 'world_operation_commitments'].includes(n['Relation Name']));
        assert(scans.length > 0);
        assert(scans.every((n) => n['Node Type'] !== 'Seq Scan'), 'Authorized listing must not scan unrelated global history');
        assert(scans.every((n) => (n['Rows Removed by Filter'] || 0) < 1000));
        assert(scans.every((n) => n['Actual Rows'] * n['Actual Loops'] < 1000), 'An ordered global index traversal is still an unbounded scan');
        console.log(`operation-read-paths native ${sql.includes('created_at') ? 'Family' : 'references'} membership=${membership} plan: ${JSON.stringify(explain)}`);
      }
    }
  }
  console.log(`operation-read-paths: pass (${native ? 'PostgreSQL' : 'pg-mem'})`);
} finally { await cleanup(); }
