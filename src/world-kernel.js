// Canonical state for authored physical objects that have no existing domain
// table. Actors, memberships, knowledge and inventory retain their authorities.
import crypto from 'node:crypto';
import { GameError, bus } from './game.js';
import { dbCaps } from './db.js';
import { canonicalBytes } from './content/canonical.js';
import { createCoordinationKnowledge } from './coordination/knowledge.js';
import { normalizeKnowledgeRequirement } from './world-knowledge.js';
import { isWorldGraphRegistry, nodeOf } from './worldgraph.js';
import { withItemTransaction, withItemMutation, consumeItem, consumeStack,
  registerItemTransactionUndo, itemMutationContext, assertItemTransaction } from './items.js';

const fail = (code = 'world_unavailable') => { throw new GameError(code, 'The world request could not complete.'); };
const text = (value) => {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,160}$/.test(value)) fail('bad_world_definition');
  return value;
};
const digest = (value) => crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
const closed = (value, required, optional = []) => {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some((key) => ![...required, ...optional].includes(key)
      || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))
    || required.some((key) => !Object.hasOwn(value, key))) fail('bad_world_definition');
};

export function compileWorldObjects(registry, inputs) {
  if (!isWorldGraphRegistry(registry) || !Array.isArray(inputs) || inputs.length > 100) fail('bad_world_definition');
  const ids = new Set();
  return Object.freeze(inputs.map((input) => {
    closed(input, ['id', 'type', 'title', 'locationId', 'states', 'initialState', 'publicStates', 'knowledge', 'actions']);
    const id = text(input.id);
    if (ids.has(id)) fail('bad_world_definition'); ids.add(id);
    if (!['facility', 'workshop', 'world_object'].includes(input.type)
      || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 120) fail('bad_world_definition');
    text(input.locationId);
    if (!Array.isArray(input.states) || input.states.length < 1 || input.states.length > 16
      || new Set(input.states).size !== input.states.length) fail('bad_world_definition');
    const states = Object.freeze(input.states.map(text));
    if (!states.includes(input.initialState) || !Array.isArray(input.publicStates)
      || input.publicStates.some((state) => !states.includes(state))) fail('bad_world_definition');
    if (!Array.isArray(input.knowledge) || input.knowledge.length > 8) fail('bad_world_definition');
    const knowledge = Object.freeze(input.knowledge.map(normalizeKnowledgeRequirement));
    if (states.some((state) => !input.publicStates.includes(state)) && !knowledge.length) fail('bad_world_definition');
    if (!Array.isArray(input.actions) || input.actions.length > 16) fail('bad_world_definition');
    const actionIds = new Set();
    const actions = Object.freeze(input.actions.map((action) => {
      closed(action, ['id', 'from', 'to', 'itemTemplateId', 'materials']);
      text(action.id);
      if (actionIds.has(action.id) || !states.includes(action.from) || !states.includes(action.to)
        || action.from === action.to) fail('bad_world_definition');
      actionIds.add(action.id);
      if (nodeOf(registry, action.itemTemplateId)?.type !== 'item_template') fail('bad_world_definition');
      if (!Array.isArray(action.materials) || action.materials.length > 8) fail('bad_world_definition');
      const materials = Object.freeze(action.materials.map((material) => {
        closed(material, ['templateId', 'quantity']);
        if (nodeOf(registry, material.templateId)?.type !== 'material'
          || !Number.isSafeInteger(material.quantity) || material.quantity < 1 || material.quantity > 1000000) fail('bad_world_definition');
        return Object.freeze({ templateId: material.templateId, quantity: material.quantity });
      }).sort((a, b) => a.templateId.localeCompare(b.templateId)));
      if (new Set(materials.map((entry) => entry.templateId)).size !== materials.length) fail('bad_world_definition');
      return Object.freeze({ id: action.id, from: action.from, to: action.to, itemTemplateId: action.itemTemplateId, materials });
    }));
    const definition = { id, type: input.type, title: input.title, locationId: input.locationId,
      states, initialState: input.initialState, publicStates: Object.freeze([...input.publicStates]), knowledge, actions };
    return Object.freeze({ ...definition, contentHash: digest(definition) });
  }));
}

// Crew -> character(s) -> account -> family -> membership -> knowledge -> object
// -> inventory. Existing Crew writers lock the Crew first; Family writers lock
// their actor before the Family. Membership is re-read after every parent lock.
async function actor(client, accountId, familyAction = false) {
  text(accountId);
  let crew = null, members = [];
  if (familyAction) {
    const membership = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [accountId])).rows[0];
    if (!membership) fail();
    crew = (await client.query('SELECT id FROM crews WHERE id=$1 FOR UPDATE', [membership.crew_id])).rows[0];
    if (!crew) fail();
    members = (await client.query('SELECT account_id FROM crew_members WHERE crew_id=$1 ORDER BY account_id', [crew.id])).rows;
    if (members.length < 1 || members.length > 4 || !members.some((row) => row.account_id === accountId)) fail();
  }
  const accountIds = familyAction ? members.map((row) => row.account_id) : [accountId];
  const characters = [];
  for (const memberId of accountIds) {
    const rows = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [memberId])).rows;
    if (rows.length !== 1) fail();
    characters.push({ id: rows[0].id, accountId: memberId });
  }
  const live = [];
  for (const member of characters.sort((a, b) => a.id.localeCompare(b.id))) {
    const ch = (await client.query('SELECT id,account_id,alive,loc FROM characters WHERE id=$1 FOR UPDATE', [member.id])).rows[0];
    if (!ch?.alive || ch.account_id !== member.accountId) fail();
    live.push(ch);
  }
  for (const memberId of [...accountIds].sort()) {
    const account = (await client.query('SELECT id,status FROM accounts WHERE id=$1 FOR SHARE', [memberId])).rows[0];
    if (account?.status !== 'active') fail();
  }
  const ch = live.find((row) => row.account_id === accountId);
  if (!familyAction) return { ch };
  const family = (await client.query('SELECT gang_id FROM gang_members WHERE character_id=$1', [ch.id])).rows[0];
  if (!family || !(await client.query('SELECT id FROM gangs WHERE id=$1 FOR SHARE', [family.gang_id])).rows.length) fail();
  let role;
  for (const member of live) {
    const current = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1 FOR SHARE', [member.account_id])).rows[0];
    const made = (await client.query('SELECT gang_id,role FROM gang_members WHERE character_id=$1 FOR SHARE', [member.id])).rows[0];
    if (current?.crew_id !== crew.id || made?.gang_id !== family.gang_id) fail();
    if (member.id === ch.id) role = made.role;
  }
  if (!['boss', 'underboss'].includes(role)) fail('world_forbidden');
  return { ch, crewId: crew.id, familyId: family.gang_id };
}

const stateOf = (definition, row) => {
  if (row && (row.definition_hash !== definition.contentHash || row.object_kind !== definition.type
    || row.location_id !== definition.locationId || !definition.states.includes(row.state))) fail('world_definition_changed');
  return row || { id: definition.id, state: definition.initialState, revision: 0, controller_family_id: null };
};
const project = (definition, row) => ({ id: definition.id, type: definition.type, title: definition.title,
  locationId: definition.locationId, state: row.state, revision: Number(row.revision), controllerFamilyId: row.controller_family_id });

export function createWorldKernel({ pool, registry, objects = [], enabled = false,
  knowledgeEnabled = false, sharingEnabled = false, accountIds = [] } = {}) {
  if (!pool || typeof pool.connect !== 'function' || [enabled, knowledgeEnabled, sharingEnabled].some((flag) => typeof flag !== 'boolean')
    || !Array.isArray(accountIds) || accountIds.some((id) => typeof id !== 'string')) fail('bad_world_definition');
  const definitions = compileWorldObjects(registry, objects), byId = new Map(definitions.map((definition) => [definition.id, definition]));
  if (new Set(definitions.flatMap((definition) => definition.knowledge.map(digest))).size > 16) fail('bad_world_definition');
  const cohort = new Set(accountIds);
  const knowledge = createCoordinationKnowledge({ enabled: enabled && knowledgeEnabled,
    sharingEnabled: enabled && knowledgeEnabled && sharingEnabled, accountIds });
  const allowed = (accountId) => enabled && (!cohort.size || cohort.has(accountId));
  const keyFor = (accountId, key) => `world:${digest([text(accountId), text(key)])}`;
  async function known(client, accountId, ch, definition) {
    if (!definition.knowledge.length) return true;
    const ctx = await knowledge.context(client, { accountId, character: ch, lock: true });
    return (await knowledge.matchesRequirements(client, ctx, definition.knowledge)).every(Boolean);
  }
  const service = Object.freeze({
    definitions,
    async list(accountId) {
      if (!allowed(accountId)) fail();
      return withItemTransaction(pool, async (client) => {
        if (dbCaps.skipLocked) await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        const { ch } = await actor(client, accountId);
        // Reuse the same filtering path used by trusted graph readers.
        return service.visibleObjects(client, accountId, ch);
      });
    },
    async visibleObjects(client, accountId, character) {
      assertItemTransaction(client);
      if (!allowed(accountId) || !character || character.account_id !== accountId || !character.alive || !definitions.length) return [];
      const rows = (await client.query(`SELECT * FROM world_kernel_objects WHERE id IN
        (${definitions.map((_, index) => `$${index + 1}`).join(',')})`, definitions.map((definition) => definition.id))).rows;
      const stored = new Map(rows.map((row) => [row.id, row]));
      const states = definitions.map((definition) => stateOf(definition, stored.get(definition.id)));
      const requirements = new Map();
      definitions.forEach((definition, index) => {
        if (!definition.publicStates.includes(states[index].state)) {
          for (const requirement of definition.knowledge) requirements.set(digest(requirement), requirement);
        }
      });
      const keys = [...requirements.keys()];
      let matches = [];
      if (keys.length) {
        const ctx = await knowledge.context(client, { accountId, character, lock: true });
        matches = await knowledge.matchesRequirements(client, ctx, [...requirements.values()]);
      }
      const satisfied = new Set(keys.filter((_, index) => matches[index]));
      return definitions.flatMap((definition, index) => definition.publicStates.includes(states[index].state)
        || (definition.knowledge.length > 0 && definition.knowledge.every((requirement) => satisfied.has(digest(requirement))))
        ? [project(definition, states[index])] : []);
    },
    async get(accountId, objectId) {
      const definition = byId.get(objectId);
      if (!allowed(accountId) || !definition) fail();
      return withItemTransaction(pool, async (client) => {
        if (dbCaps.skipLocked) await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        const { ch } = await actor(client, accountId);
        const row = stateOf(definition, (await client.query('SELECT * FROM world_kernel_objects WHERE id=$1', [definition.id])).rows[0]);
        if (!definition.publicStates.includes(row.state) && !await known(client, accountId, ch, definition)) fail();
        return project(definition, row);
      });
    },
    async execute(accountId, input, idempotencyKey) {
      closed(input, ['objectId', 'actionId', 'itemId', 'expectedRevision']);
      // Bind execution to the exact immutable scalar command hashed by the
      // receipt, even if a trusted in-process caller mutates its original object.
      input = Object.freeze({ ...input });
      text(input.objectId); text(input.actionId); text(input.itemId);
      if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) fail('bad_world_request');
      const definition = byId.get(input.objectId), action = definition?.actions.find((entry) => entry.id === input.actionId);
      if (!allowed(accountId) || !action) fail();
      const key = keyFor(accountId, idempotencyKey), owner = { scope: 'account', id: accountId };
      let changed = null;
      const result = await withItemTransaction(pool, (client) => withItemMutation(client, owner, 'world_action', key,
        { ...input, contentHash: definition.contentHash }, async (mutation) => {
          const authority = await actor(client, accountId, true);
          if (authority.ch.loc !== definition.locationId || !await known(client, accountId, authority.ch, definition)) fail();
          if (!(await client.query('SELECT id FROM districts WHERE id=$1', [definition.locationId])).rows.length) fail();
          const existing = (await client.query('SELECT id FROM world_kernel_objects WHERE id=$1 FOR UPDATE', [definition.id])).rows[0];
          // pg-mem reports a RETURNING row even on DO NOTHING; an existing row
          // must never be registered as transaction-owned compensation work.
          const inserted = !existing && (await client.query(`INSERT INTO world_kernel_objects
            (id,object_kind,location_id,definition_hash,state,revision) VALUES ($1,$2,$3,$4,$5,0)
            ON CONFLICT (id) DO NOTHING RETURNING id`, [definition.id, definition.type,
            definition.locationId, definition.contentHash, definition.initialState])).rows.length > 0;
          if (inserted) registerItemTransactionUndo(client, () => client.query('DELETE FROM world_kernel_objects WHERE id=$1', [definition.id]));
          const row = stateOf(definition, (await client.query('SELECT * FROM world_kernel_objects WHERE id=$1 FOR UPDATE', [definition.id])).rows[0]);
          if (Number(row.revision) !== input.expectedRevision || row.state !== action.from) fail('world_stale');
          if (Number(row.revision) >= 2147483647) fail('world_revision_limit');
          const item = (await client.query('SELECT template_id,owner_scope,owner_id,state,definition_hash FROM item_instances WHERE id=$1 FOR UPDATE', [input.itemId])).rows[0];
          if (!item || item.template_id !== action.itemTemplateId || item.owner_scope !== 'account'
            || item.owner_id !== accountId || item.state !== 'active' || item.definition_hash !== null) fail();
          for (const material of action.materials) await consumeStack(client, owner, material.templateId,
            material.quantity, 'standard', `world ${definition.id} ${action.id}`, mutation);
          await consumeItem(client, owner, input.itemId, `world ${definition.id} ${action.id}`, mutation);
          registerItemTransactionUndo(client, () => client.query(`UPDATE world_kernel_objects SET state=$2,revision=$3,
            controller_family_id=$4,updated_at=$5 WHERE id=$1`, [row.id, row.state, row.revision, row.controller_family_id, row.updated_at]));
          const next = (await client.query(`UPDATE world_kernel_objects SET state=$2,revision=revision+1,
            controller_family_id=$3,updated_at=now() WHERE id=$1 AND revision=$4 RETURNING *`,
          [row.id, action.to, authority.familyId, input.expectedRevision])).rows[0];
          if (!next) fail('world_stale');
          const eventId = crypto.randomUUID(), revision = Number(next.revision);
          const mutationId = itemMutationContext(client, mutation).mutationId;
          registerItemTransactionUndo(client, () => client.query('DELETE FROM world_kernel_events WHERE id=$1', [eventId]));
          await client.query(`INSERT INTO world_kernel_events
            (id,object_id,revision,mutation_id,actor_account_id,actor_character_id,crew_id,family_id,action_id,
              prior_state,next_state,item_id,definition_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [eventId, row.id, revision, mutationId, accountId, authority.ch.id, authority.crewId, authority.familyId,
            action.id, row.state, action.to, input.itemId, definition.contentHash]);
          changed = { objectId: row.id, revision };
          return { objectId: row.id, state: next.state, revision, eventId };
        }));
      // Durable event is authority. This process-local notification is only an
      // invalidation hint, sent after COMMIT; a lost hint is recovered by reads.
      if (changed) { try { bus.emit('world:changed', changed); } catch { /* committed state remains queryable */ } }
      return result;
    },
  });
  return service;
}
