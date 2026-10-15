// Independent adversarial projection pass: use real game services behind a
// query guard that rejects every durable mutation made by a READ/ANALYZE call.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { makeDb } from '../src/db.js';
import { CAPABILITIES } from '../src/gateway/capabilities.js';
import { createContextGateway } from '../src/gateway/context.js';
import { dynastyBoard } from '../src/dynasty.js';
import { crewBoard } from '../src/crew.js';
import { diplomacyBoard } from '../src/diplomacy.js';

const pool = await makeDb();
const actor = 'projection-a', peer = 'projection-b';
const all = { scopes: [...new Set(CAPABILITIES.flatMap((entry) => entry.scopes))] };
const only = (...scopes) => ({ scopes: scopes.map((scope) => 'omerta.' + scope) });
let queryCount = 0;
function guarded(queryable) {
  return {
    async query(statement, ...args) {
      const sql = (typeof statement === 'string' ? statement : statement.text)
        .replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/FOR\s+UPDATE\b/gi, '');
      assert(!/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|CREATE|ALTER|DROP)\b/i.test(sql),
        'A read projection attempted a durable database mutation: ' + sql.slice(0, 160));
      queryCount++;
      return queryable.query(statement, ...args);
    },
    ...(queryable.connect ? { async connect() { return guarded(await queryable.connect()); } } : {}),
    ...(queryable.release ? { release: () => queryable.release() } : {}),
  };
}
const api = createContextGateway({ pool: guarded(pool) });
const read = (name, args = {}, scopes = all) => api.execute(name, actor, args, scopes);
try {
  for (const id of [actor, peer]) {
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ($1,$2,$1)', [id, 'projection-security']);
    await pool.query('INSERT INTO characters(id,account_id,name,season,cash,loc) VALUES ($1,$2,$3,1,$4,$5)',
      ['ch-' + id, id, id, id === actor ? 20202 : 90909, 'docks']);
    await pool.query('INSERT INTO account_persistent(account_id,omr,wallet_address) VALUES ($1,$2,$3)',
      [id, id === actor ? 30303 : 80808, id === actor ? 'OWN_WALLET_PRIVATE' : 'PEER_WALLET_PRIVATE']);
  }
  await pool.query('INSERT INTO crews(id,name,leader_account) VALUES ($1,$2,$3)', ['projection-crew', 'Projection Crew', actor]);
  for (const id of [actor, peer]) await pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES ($1,$2,$2)', ['projection-crew', id]);
  await pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id)
    VALUES ('projection-op','belladonna-demo',1,'operation:belladonna-lockbox','projection-crew',$1)`, [actor]);
  await pool.query(`INSERT INTO world_operation_roles(operation_id,role_id,account_id,character_id)
    VALUES ('projection-op','investigator',$1,$2)`, [actor, 'ch-' + actor]);
  await pool.query(`INSERT INTO cars(id,character_id,model_id,trim_id,dmg)
    VALUES ('PEER_PRIVATE_CAR',$1,'junker','stock',0)`, ['ch-' + peer]);
  await pool.query(`INSERT INTO notifications(id,character_id,type,payload)
    VALUES ('projection-private',$1,'admin_private_oracle','{"secret":"PRIVATE_ORACLE_SOLUTION"}')`, ['ch-' + actor]);

  for (const name of ['get_player_context', 'generate_brief_context', 'get_opportunities', 'get_actionable_context']) {
    const result = await read(name, {}, only('player.read'));
    assert.doesNotMatch(JSON.stringify(result), /20202|30303|90909|80808|WALLET_PRIVATE|PEER_PRIVATE_CAR|PRIVATE_ORACLE_SOLUTION/);
    for (const field of ['inventory', 'ownInventory', 'economy', 'crew', 'family', 'activeMysteries', 'coordinationRequests']) {
      // Action categories are empty arrays, which convey no unauthorized entities.
      if (field in result) assert.deepEqual(result[field], []);
    }
  }
  const paths = await read('find_coordination_paths', { operationId: 'projection-op' }, only('social.read', 'coordination.read'));
  assert(!Object.hasOwn(paths, 'ownInventory'));
  assert(!Object.hasOwn(paths, 'ownCraftingOptions'));
  assert(paths.paths.every((path) => path.candidates.every((candidate) => candidate.eligibility === 'unknown')));
  assert.doesNotMatch(JSON.stringify(paths), /PEER_PRIVATE_CAR|WALLET_PRIVATE|90909|80808|privateEvidence|false hinge|last two gates/);

  let role = await read('get_available_contributions', { operationId: 'projection-op' });
  assert(role.nodes.some((node) => node.id === 'operation:belladonna-investigate'), 'An assigned task is legitimately visible');
  assert(!role.nodes.some((node) => node.id === 'operation:belladonna-mechanic'), 'Another role private task remains hidden');
  assert(!role.nodes.some((node) => node.type === 'evidence'), 'Role assignment alone does not discover puzzle evidence');
  for (const nodeId of ['evidence:belladonna-cipher-fragment', 'evidence:belladonna-tumbler-pattern']) {
    await pool.query(`INSERT INTO world_operation_node_state(operation_id,node_id,state,completed_at)
      VALUES ('projection-op',$1,'completed',now())`, [nodeId]);
  }
  role = await read('get_available_contributions', { operationId: 'projection-op' });
  assert(role.nodes.some((node) => node.id === 'evidence:belladonna-cipher-fragment'));
  assert(!role.nodes.some((node) => node.id === 'evidence:belladonna-tumbler-pattern'));
  assert.doesNotMatch(JSON.stringify(role), /false hinge|last two gates|privateEvidence|PEER_PRIVATE_CAR|WALLET_PRIVATE/);
  await pool.query('DELETE FROM crew_members WHERE account_id=$1', [actor]);
  await assert.rejects(read('get_available_contributions', { operationId: 'projection-op' }), { code: 'operation_unavailable' });
  await pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES ($1,$2,$2)', ['projection-crew', actor]);

  const parameterless = CAPABILITIES.filter((entry) => ['READ', 'ANALYZE'].includes(entry.actionClass)
    && !entry.inputSchema.required?.length);
  for (const entry of parameterless) await read(entry.name);

  // Reproduce the formerly unbounded unsolicited-state fan-out. Each helper's
  // optional mode must cap SQL result sets, preserve names, and label omissions.
  const ch = (await pool.query('SELECT * FROM characters WHERE id=$1', ['ch-' + actor])).rows[0];
  await pool.query('UPDATE account_persistent SET dynasty_name=$2 WHERE account_id=$1', [peer, 'Peer House']);
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES ('projection-family','Projection Family','PRJ')");
  for (let index = 0; index < 125; index++) {
    const other = index === 0 ? peer : 'bounds-peer-' + index;
    await pool.query('INSERT INTO dynasty_marriages(account_a,account_b,proposed_by) VALUES ($1,$2,$2)', [actor, other]);
    await pool.query('INSERT INTO consiglieri(dynasty_account,adviser_account,accepted) VALUES ($1,$2,true),($3,$2,false)',
      ['advising-' + index, actor, 'offering-' + index]);
    await pool.query('INSERT INTO crews(id,name,leader_account) VALUES ($1,$1,$2)', ['bounds-crew-' + index, other]);
    await pool.query('INSERT INTO crew_invites(crew_id,account_id,from_name) VALUES ($1,$2,$3)', ['bounds-crew-' + index, actor, other]);
    await pool.query('INSERT INTO crew_requests(crew_id,account_id,from_name) VALUES ($1,$2,$2)', ['projection-crew', other]);
    await pool.query('INSERT INTO gangs(id,name,tag) VALUES ($1,$1,$2)', ['bounds-family-' + index, 'B' + index]);
    await pool.query('INSERT INTO gang_relations(gang_a,gang_b,proposed_by,accepted) VALUES ($1,$2,$1,true)',
      ['projection-family', 'bounds-family-' + index]);
    await pool.query('INSERT INTO coalitions(id,target_gang,formed_by,expires_at) VALUES ($1,$2,$3,$4)',
      ['bounds-coalition-' + index, 'bounds-family-' + index, 'projection-family', '2100-01-01T00:00:00Z']);
    await pool.query('INSERT INTO coalition_members(coalition_id,gang_id) VALUES ($1,$2)', ['bounds-coalition-' + index, 'projection-family']);
  }
  await pool.query('UPDATE dynasty_marriages SET created_at=$3 WHERE account_a=$1 AND account_b=$2',
    [actor, peer, '2099-01-01T00:00:00Z']);
  const boundedPool = guarded(pool);
  const beforeHouses = queryCount;
  const houses = await dynastyBoard(ch, boundedPool, { limit: 20 });
  assert.equal(queryCount - beforeHouses, 7, 'Bounded house lookup uses two batched peer queries, never N+1');
  for (const key of ['proposals', 'advising', 'consigliereOffers']) {
    assert.equal(houses[key].length, 20);
    assert.equal(houses.truncated[key], true);
  }
  assert.equal(houses.proposals[0].dynasty, 'Peer House');
  assert.equal(houses.proposals[0].steward, peer);
  const oldHouses = await dynastyBoard(ch, pool);
  assert.equal(oldHouses.proposals.length, 125, 'Default game board remains complete');
  assert(!Object.hasOwn(oldHouses, 'truncated'));
  const crew = await crewBoard(ch, boundedPool, { limit: 20 });
  assert.equal(crew.invites.length, 20); assert.equal(crew.crew.requests.length, 20);
  assert.equal(crew.truncated.invites, true); assert.equal(crew.truncated.requests, true);
  const oldCrew = await crewBoard(ch, pool);
  assert.equal(oldCrew.invites.length, 125); assert.equal(oldCrew.crew.requests.length, 125);
  assert(!Object.hasOwn(oldCrew, 'truncated'));
  const beforeDiplomacy = queryCount;
  const diplomacy = await diplomacyBoard(boundedPool, { owned: { gangId: 'projection-family' } }, { limit: 20 });
  assert(queryCount - beforeDiplomacy <= 7, 'Bounded diplomacy does not enumerate all family rankings');
  assert.equal(diplomacy.relations.length, 20); assert.equal(diplomacy.coalitions.length, 20);
  assert.equal(diplomacy.truncated.relations, true); assert.equal(diplomacy.truncated.coalitions, true);
  assert.equal(diplomacy.truncated.dominant, true);
  assert(diplomacy.coalitions.every((row) => row.members === 1 && row.mine));
  const oldDiplomacy = await diplomacyBoard(pool, { owned: { gangId: 'projection-family' } });
  assert.equal(oldDiplomacy.relations.length, 125); assert.equal(oldDiplomacy.coalitions.length, 125);
  assert(!Object.hasOwn(oldDiplomacy, 'truncated'));
  const familyProjection = await read('get_family', {}, only('social.read'));
  assert.equal(familyProjection.extendedFamily.proposals.length, 20);
  assert.equal(familyProjection.extendedFamily.truncated.proposals, true);
  await assert.rejects(dynastyBoard(ch, pool, { limit: 0 }), TypeError);
  await assert.rejects(crewBoard(ch, pool, { limit: 101 }), TypeError);
  await assert.rejects(diplomacyBoard(pool, { owned: {} }, { limit: '20' }), TypeError);

  for (const file of ['src/gateway/context.js', 'src/growth.js', 'src/dynasty.js', 'src/crew.js', 'src/diplomacy.js']) console.log(file + ' SHA256 '
    + crypto.createHash('sha256').update(fs.readFileSync(new URL('../' + file, import.meta.url))).digest('hex'));
  console.log(`projection security: ${parameterless.length} READ/ANALYZE capabilities, role/scope adversarial traces and 125-row social bounds passed; ${queryCount} guarded queries, zero durable writes`);
} finally { await pool.end(); }
