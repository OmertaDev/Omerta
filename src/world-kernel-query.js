// Runtime graph references resolve existing domain authority; this module stores no model copies.
// The caller supplies accountId from server authentication, never from a request owner field.
import { GameError } from './game.js';
import { dbCaps } from './db.js';
import { withItemRead, withItemTransaction, assertItemRead } from './items.js';
import { assertKnowledgeSnapshot } from './coordination/knowledge.js';
import { isWorldGraphRegistry } from './worldgraph.js';
import { DIPLOMACY, dayOf, weekOf, crewObjectiveOf } from './rules.js';

export const WORLD_KERNEL_QUERY_LIMITS = Object.freeze({ batch: 50, crewMembers: 100 });
const TYPES = new Set(['player', 'character', 'crew', 'family', 'territory', 'item',
  'item_template', 'material', 'recipe', 'resource', 'event', 'knowledge', 'mystery',
  'operation', 'facility', 'workshop', 'world_object', 'coalition', 'objective']);
const fail = (code = 'bad_world_query') => { throw new GameError(code, 'The world query could not complete.'); };
const canonical = (value, max = 200) => typeof value === 'string' && value.length > 0
  && value.length <= max && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);

/** A stable, collision-free reference to an existing domain identity. */
export function worldRef(type, id) {
  if (!TYPES.has(type) || !canonical(id, 1024)) fail();
  return `${type}:${encodeURIComponent(id)}`;
}

function optionsOf(options) {
  if (!options || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail();
  for (const key of Reflect.ownKeys(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (key !== 'limit' || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
  }
  const limit = options.limit ?? WORLD_KERNEL_QUERY_LIMITS.batch;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > WORLD_KERNEL_QUERY_LIMITS.batch) fail();
  return { limit };
}

const iso = (value) => value == null ? null : new Date(value).toISOString();

/**
 * Bounded account neighborhood, not an arbitrary traversal API. Each inventory/evidence batch
 * has its own explicit truncation flag; a partial neighborhood never asserts completeness.
 * Knowledge may be the existing createCoordinationKnowledge server capability, or null.
 */
export function createWorldKernelQuery({ pool, knowledge = null, registry = null } = {}) {
  if (!pool || typeof pool.connect !== 'function') fail();
  if (knowledge !== null && (typeof knowledge.enabledFor !== 'function'
      || typeof knowledge.context !== 'function' || typeof knowledge.board !== 'function')) fail();
  if (registry !== null && !isWorldGraphRegistry(registry)) fail();
  return Object.freeze({
    async readSnapshot(client, authenticatedAccountId, options) {
      assertItemRead(client);
      if (!canonical(authenticatedAccountId) || !options || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) fail();
      for (const key of Reflect.ownKeys(options)) {
        const descriptor = Object.getOwnPropertyDescriptor(options, key);
        if (!['limit', 'knowledgeSnapshot', 'asOf'].includes(key) || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
      }
      const { limit } = optionsOf({ limit: options.limit });
      if (!Number.isSafeInteger(options.asOf) || options.asOf < 0 || options.asOf > 8.64e15) fail();
      assertKnowledgeSnapshot(client, options.knowledgeSnapshot, authenticatedAccountId);
      return neighborhood(client, authenticatedAccountId, limit, null, registry, options.knowledgeSnapshot, options.asOf);
    },
    async snapshot(authenticatedAccountId, options = {}) {
      if (!canonical(authenticatedAccountId)) fail();
      const { limit } = optionsOf(options);
      // Knowledge's existing reader locks membership and immutable claims. PostgreSQL forbids
      // those locks in withItemRead(pool)'s READ ONLY transaction, so own a writable transaction
      // without performing writes, set its snapshot before the first read, then reuse its reader.
      return withItemTransaction(pool, async (client) => {
        if (dbCaps.skipLocked) await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        return withItemRead(client, (q) => neighborhood(q, authenticatedAccountId, limit, knowledge, registry));
      });
    },
  });
}

async function neighborhood(client, accountId, limit, knowledge, registry, knowledgeSnapshot = null, asOf = Date.now()) {
  // One server-owned instant governs expiry and the weekly goal for the whole snapshot.
  const at = new Date(asOf);
  // Character -> account -> membership matches the existing coordination knowledge lock order.
  // A dying/replaced street makes REPEATABLE READ fail with contention, rather than mixing heirs.
  const characters = (knowledgeSnapshot
    ? await client.query('SELECT id,account_id,name,loc,alive FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [accountId])
    : await client.query('SELECT id,account_id,name,loc,alive FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2 FOR SHARE', [accountId])).rows;
  const account = (knowledgeSnapshot ? await client.query('SELECT id,status FROM accounts WHERE id=$1', [accountId])
    : await client.query('SELECT id,status FROM accounts WHERE id=$1 FOR SHARE', [accountId])).rows[0];
  if (!account || account.status !== 'active') fail('world_query_unavailable');
  if (characters.length > 1) fail('world_query_corrupt');
  const character = characters[0] ?? null;
  const membership = (knowledgeSnapshot ? await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [accountId])
    : await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1 FOR SHARE', [accountId])).rows[0];
  const familyMembership = character && (knowledgeSnapshot ? await client.query('SELECT gang_id FROM gang_members WHERE character_id=$1', [character.id])
    : await client.query('SELECT gang_id FROM gang_members WHERE character_id=$1 FOR SHARE', [character.id])).rows[0];
  const nodes = new Map(), relationships = new Map();
  const truncated = { items: false, resources: false, events: false, knowledge: false,
    crewAffiliation: false, definitions: false, definitionRelationships: false, operations: false, mysteries: false,
    alliances: false, coalitions: false };
  const add = (type, id, fields = {}) => {
    const ref = worldRef(type, id);
    if (!nodes.has(ref)) nodes.set(ref, { ref, type, id, ...fields });
    return ref;
  };
  const edge = (type, from, to, fields = {}) => {
    const ref = `relationship:${encodeURIComponent(JSON.stringify([type, from, to]))}`;
    relationships.set(ref, { ref, type, from, to, ...fields });
  };
  const player = add('player', account.id);
  const street = character && add('character', character.id, { name: character.name });
  if (street) edge('current_character', player, street);
  let family = null;
  if (familyMembership) {
    const row = (await client.query('SELECT id,name,war_with,war_until FROM gangs WHERE id=$1', [familyMembership.gang_id])).rows[0];
    if (row) {
      family = add('family', row.id, { name: row.name }); edge('membership', street, family);
      if (row.war_with && row.war_until && new Date(row.war_until) > at) {
        const rival = (await client.query('SELECT id,name FROM gangs WHERE id=$1', [row.war_with])).rows[0];
        if (rival) edge('rivalry', family, add('family', rival.id, { name: rival.name }),
          { kind: 'war', until: iso(row.war_until) });
      }
      // diplomacyBoard exposes relations only for the reader's current character Family.
      // Pending/expired offers are not alliances, and pact rows remain the sole authority.
      const pacts = (await client.query(
        `SELECT r.gang_a,r.gang_b,r.until,a.name AS name_a,b.name AS name_b FROM gang_relations r
          JOIN gangs a ON a.id=r.gang_a JOIN gangs b ON b.id=r.gang_b
          WHERE (r.gang_a=$1 OR r.gang_b=$1) AND r.kind='pact' AND r.accepted=true AND r.until>$2
          ORDER BY r.gang_a,r.gang_b LIMIT $3`, [row.id, at, limit + 1],
      )).rows;
      truncated.alliances = pacts.length > limit;
      for (const pact of pacts.slice(0, limit)) {
        const ownA = pact.gang_a === row.id;
        edge('alliance', family, add('family', ownA ? pact.gang_b : pact.gang_a,
          { name: ownA ? pact.name_b : pact.name_a }), { kind: 'pact', until: iso(pact.until) });
      }
    }
  }
  if (membership) {
    const crew = (await client.query('SELECT id,name FROM crews WHERE id=$1', [membership.crew_id])).rows[0];
    if (crew) {
      const crewRef = add('crew', crew.id, { name: crew.name });
      edge('membership', player, crewRef);
      // Match crewObjective's current-week identity and deterministic fallback without
      // materializing another goal or touching its reward/contribution authority.
      const week = weekOf(dayOf(at.getTime()));
      const objective = (await client.query(
        'SELECT kind,target,progress,done FROM crew_objectives WHERE crew_id=$1 AND week=$2', [crew.id, week],
      )).rows[0];
      const memberCount = Number((await client.query('SELECT COUNT(*) AS n FROM crew_members WHERE crew_id=$1', [crew.id])).rows[0].n) || 1;
      const drawn = crewObjectiveOf(crew.id, week, memberCount);
      const ownProgress = (await client.query(
        'SELECT n,claimed FROM crew_objective_progress WHERE crew_id=$1 AND week=$2 AND account_id=$3', [crew.id, week, accountId],
      )).rows[0];
      const objectiveRef = add('objective', JSON.stringify([crew.id, week]), { week,
        kind: objective?.kind || drawn.kind, target: objective ? Number(objective.target) : drawn.target,
        progress: objective ? Number(objective.progress) : 0, done: !!objective?.done,
        mine: Number(ownProgress?.n ?? 0), claimed: !!ownProgress?.claimed });
      edge('parent_child', crewRef, objectiveRef);
      edge('authorization', player, objectiveRef);
      // Affiliation is a snapshot-derived fact, not permanent ownership or command authority.
      // Every living member must have the same non-null family. Dead/account-only members do
      // not invent a family; a bounded/incomplete roster never yields an affirmative relation.
      const roster = (await client.query(
        `SELECT c.id,gm.gang_id FROM crew_members cm
          JOIN characters c ON c.account_id=cm.account_id AND c.alive=true
          LEFT JOIN gang_members gm ON gm.character_id=c.id
          WHERE cm.crew_id=$1 ORDER BY c.id LIMIT $2`,
        [crew.id, WORLD_KERNEL_QUERY_LIMITS.crewMembers + 1],
      )).rows;
      truncated.crewAffiliation = roster.length > WORLD_KERNEL_QUERY_LIMITS.crewMembers;
      if (!truncated.crewAffiliation && roster.length > 0 && roster[0].gang_id
          && roster.every((row) => row.gang_id === roster[0].gang_id)) {
        const row = (await client.query('SELECT id,name FROM gangs WHERE id=$1', [roster[0].gang_id])).rows[0];
        if (row) edge('affiliation', crewRef, add('family', row.id, { name: row.name }),
          { derived: 'all_living_members', authority: false });
      }
    }
  }
  // The public diplomacy board publishes active coalition IDs, targets and counts, but
  // not other member identities or the founder. Only the reader's own membership is an edge.
  const coalitions = (await client.query(
    `SELECT c.id,c.target_gang,c.expires_at,g.name AS target_name,
        COUNT(m.gang_id) AS member_count,
        COUNT(CASE WHEN m.gang_id=$3 THEN 1 ELSE NULL END) AS own_memberships
      FROM (SELECT id,target_gang,expires_at FROM coalitions
        WHERE expires_at>$1 ORDER BY id LIMIT $2) c
      LEFT JOIN gangs g ON g.id=c.target_gang LEFT JOIN coalition_members m ON m.coalition_id=c.id
      GROUP BY c.id,c.target_gang,c.expires_at,g.name ORDER BY c.id`,
    [at, limit + 1, family ? familyMembership.gang_id : null],
  )).rows;
  truncated.coalitions = coalitions.length > limit;
  for (const coalition of coalitions.slice(0, limit)) {
    const count = Number(coalition.member_count);
    const ref = add('coalition', coalition.id, { members: count, armed: count >= DIPLOMACY.COALITION_MIN,
      expiresAt: iso(coalition.expires_at) });
    if (coalition.target_name !== null) edge('rivalry', ref,
      add('family', coalition.target_gang, { name: coalition.target_name }), { kind: 'coalition' });
    if (family && Number(coalition.own_memberships) > 0) edge('membership', family, ref);
  }
  if (character) {
    const district = (await client.query('SELECT id,holder_gang FROM districts WHERE id=$1', [character.loc])).rows[0];
    if (district) {
      const place = add('territory', district.id);
      edge('location', street, place);
      if (family && district.holder_gang === familyMembership.gang_id) edge('control', family, place);
    }
  }

  // Public immutable definitions supply semantics, not runtime inventory/knowledge authority.
  // Never expose raw conditions, hidden prerequisite IDs, metadata, or authored effect payloads.
  if (registry) {
    const definitions = [];
    for (const definition of registry.nodes.values()) {
      if (definition.visibility !== 'public' || !['material', 'item_template', 'recipe'].includes(definition.type)) continue;
      if (definitions.length === limit) { truncated.definitions = true; break; }
      definitions.push(definition);
      const title = definition.title ?? definition.metadata?.title;
      add(definition.type, definition.id, { version: definition.version,
        ...(typeof title === 'string' && title.length <= 200 ? { title } : {}) });
    }
    const visibleDefinitions = new Map(definitions.map((definition) => [definition.id, definition]));
    let relationCount = 0;
    const definitionEdge = (type, from, to, fields = {}) => {
      if (relationCount >= limit) { truncated.definitionRelationships = true; return; }
      relationCount++; edge(type, from, to, fields);
    };
    for (const definition of definitions) {
      const ref = worldRef(definition.type, definition.id);
      for (const id of (Array.isArray(definition.requires) ? definition.requires : [])) {
        const prerequisite = visibleDefinitions.get(id);
        if (prerequisite) definitionEdge('prerequisite', worldRef(prerequisite.type, id), ref);
      }
      if (definition.type !== 'recipe') continue;
      for (const [field, alias, relation] of [['consumes', 'inputs', 'consumed_by'], ['produces', 'outputs', 'produced_by']]) {
        const entries = definition[field] ?? definition[alias] ?? [];
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
          const id = entry?.templateId ?? entry?.nodeId ?? entry?.materialId ?? entry?.itemTemplateId ?? entry?.id;
          const target = visibleDefinitions.get(id);
          if (!target || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) continue;
          definitionEdge(relation, worldRef(target.type, target.id), ref, { quantity: entry.quantity });
        }
      }
    }
  }

  // These are references to already authorized runtime instances only. Their private nodes,
  // choices, evidence, role assignments and other actors remain in their dedicated safe boards.
  const mysteries = (await client.query(
    `SELECT id,status,graph_id,graph_version FROM mystery_instances
      WHERE authority_account_id=$1 AND ((owner_scope='account' AND owner_id=$1)
        OR (owner_scope='character' AND owner_id IN (SELECT id FROM characters WHERE account_id=$1)))
      ORDER BY id LIMIT $2`, [accountId, limit + 1],
  )).rows;
  truncated.mysteries = mysteries.length > limit;
  for (const row of mysteries.slice(0, limit)) edge('authorization', player,
    add('mystery', row.id, { status: row.status, graphId: row.graph_id, graphVersion: Number(row.graph_version) }));
  // Family coordination retains the board's Family/opener/role/promise visibility.
  // Joining the recorded Crew grants access only to legacy Crew operations.
  const operations = (await client.query(
    `SELECT id,status,graph_id,graph_version FROM world_operations
      WHERE opened_by_account_id=$1
        OR id IN (SELECT operation_id FROM world_operation_roles WHERE account_id=$1)
        OR (coordination_mode='crew' AND crew_id=$2)
        OR (coordination_mode='family' AND (family_id=$3
          OR id IN (SELECT operation_id FROM world_operation_commitments WHERE account_id=$1)))
      ORDER BY id LIMIT $4`, [accountId, membership?.crew_id ?? null,
      family ? familyMembership.gang_id : null, limit + 1],
  )).rows;
  truncated.operations = operations.length > limit;
  for (const row of operations.slice(0, limit)) edge('authorization', player,
    add('operation', row.id, { status: row.status, graphId: row.graph_id, graphVersion: Number(row.graph_version) }));

  // No client-chosen owner tuple. Historical character assets do not pass to the current heir.
  const ownerValues = [accountId, character?.id ?? null, limit + 1];
  const owned = (await client.query(
    `SELECT id,template_id,owner_scope,state,created_at,consumed_at FROM item_instances
      WHERE ((owner_scope='account' AND owner_id=$1) OR (owner_scope='character' AND owner_id=$2))
      ORDER BY id LIMIT $3`, ownerValues,
  )).rows;
  truncated.items = owned.length > limit;
  for (const row of owned.slice(0, limit)) {
    const item = add('item', row.id, { state: row.state, createdAt: iso(row.created_at), consumedAt: iso(row.consumed_at) });
    edge('instance_of', item, add('item_template', row.template_id));
    edge(row.state === 'consumed' ? 'last_custody' : 'ownership', row.owner_scope === 'account' ? player : street, item);
  }
  const stacks = (await client.query(
    `SELECT owner_scope,owner_id,template_id,quality,quantity FROM item_stacks
      WHERE ((owner_scope='account' AND owner_id=$1) OR (owner_scope='character' AND owner_id=$2)) AND quantity>0
      ORDER BY owner_scope,template_id,quality LIMIT $3`, ownerValues,
  )).rows;
  truncated.resources = stacks.length > limit;
  for (const row of stacks.slice(0, limit)) {
    const resource = add('resource', JSON.stringify([row.owner_scope, row.owner_id, row.template_id, row.quality]),
      { quantity: Number(row.quantity), quality: row.quality });
    // A material definition already projected from the registry keeps one identity;
    // fungible resource balances never invent a second item-template node for it.
    edge('instance_of', resource, add('material', row.template_id));
    edge('ownership', row.owner_scope === 'account' ? player : street, resource);
  }
  if (owned.length) {
    const events = (await client.query(
      `SELECT id,item_id,event_kind,provenance_kind,created_at FROM item_events
        WHERE item_id IN (SELECT id FROM item_instances
          WHERE ((owner_scope='account' AND owner_id=$1) OR (owner_scope='character' AND owner_id=$2))
          ORDER BY id LIMIT $3)
        ORDER BY sequence DESC LIMIT $4`, [accountId, character?.id ?? null, limit, limit + 1],
    )).rows;
    truncated.events = events.length > limit;
    for (const row of events.slice(0, limit)) {
      // Source/destination owner IDs, free-text reasons, and mutation keys can contain secrets.
      // Provenance for a visible object identifies its event without exposing those identities.
      const event = add('event', row.id,
        { kind: row.event_kind, provenance: row.provenance_kind, occurredAt: iso(row.created_at) });
      edge('provenance', worldRef('item', row.item_id), event);
    }
  }
  if (knowledgeSnapshot || knowledge?.enabledFor(accountId)) {
    const board = knowledgeSnapshot ? knowledgeSnapshot.board
      : await knowledge.board(client, await knowledge.context(client, { accountId, character, lock: true }), { limit });
    truncated.knowledge = board.nextCursor !== null || board.claims.length > limit;
    for (const claim of board.claims.slice(0, limit)) {
      const ref = add('knowledge', claim.id, { domain: claim.domain, proposition: claim.proposition,
        value: claim.value, contentHash: claim.contentHash, discoveredAt: claim.discoveredAt });
      edge(claim.owned ? 'discovery' : 'visibility', player, ref);
    }
  }
  return { schemaVersion: 1, root: player, nodes: [...nodes.values()],
    relationships: [...relationships.values()], truncated };
}
