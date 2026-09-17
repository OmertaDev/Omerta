// Read existing domain facts without manufacturing coordination claims or inventory.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import { dbCaps } from './db.js';
import { assertItemRead, assertItemTransaction } from './items.js';
import { assertPhase2Write, phase2ContextIdentity } from './content/phase2-transactions.js';
import { canonicalBytes } from './content/canonical.js';
import { normalizeWorldPrerequisite, worldPrerequisiteKey, normalizeKnowledgeRequirement, knowledgeRequirementKey } from './world-knowledge.js';
import { assertKnowledgeProof, knowledgeProofMatches, assertKnowledgeSnapshot, snapshotRequirementMatches } from './coordination/knowledge.js';

const TOKENS = new WeakMap();
const PREPARED = new WeakSet();
const fail = (code = 'bad_world_prerequisite') => { throw new GameError(code, 'World prerequisites are unavailable.'); };
const digest = (value) => crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
function assertWrite(client) {
  try { assertItemTransaction(client); }
  catch (error) { if (error?.code !== 'item_transaction_required') throw error; assertPhase2Write(client); }
}
function record(value, fields, required = fields) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some((key) => !fields.includes(key)
      || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))
    || required.some((key) => !Object.hasOwn(value, key))) fail();
}
function id(value) { if (typeof value !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(value)) fail(); return value; }
function boundedArray(value, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) fail();
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
  }
  if (Reflect.ownKeys(value).length !== value.length + 1) fail();
  return value;
}
function request(input, readOnly) {
  record(input, ['subjects', 'groups', 'asOf', 'knowledgeProof', 'knowledgeSnapshot'], ['subjects', 'groups', 'asOf']);
  if (!Number.isSafeInteger(input.asOf) || input.asOf < 0 || input.asOf > 8.64e15
    || (readOnly ? input.knowledgeProof !== undefined : input.knowledgeSnapshot !== undefined)) fail();
  const subjects = boundedArray(input.subjects, readOnly ? 9 : 8).map((subject) => {
    record(subject, ['key', 'accountId', 'characterId']);
    return Object.freeze({ key: id(subject.key), accountId: id(subject.accountId), characterId: id(subject.characterId) });
  });
  if (!subjects.length || new Set(subjects.map((subject) => subject.key)).size !== subjects.length
    || new Set(subjects.map((subject) => subject.accountId)).size !== subjects.length) fail();
  const keys = new Set(subjects.map((subject) => subject.key));
  let total = 0;
  const groups = boundedArray(input.groups, readOnly ? 9 : 8).map((group) => {
    record(group, ['subjectKey', 'requirements']);
    if (!keys.has(group.subjectKey)) fail();
    const requirements = boundedArray(group.requirements, readOnly ? 64 : 32).map(normalizeWorldPrerequisite);
    total += requirements.length;
    for (const predicate of requirements) if (predicate.adapter === 'social' && predicate.requirement.subject
      && (!keys.has(predicate.requirement.subject) || predicate.requirement.subject === group.subjectKey)) fail();
    return Object.freeze({ subjectKey: group.subjectKey, requirements: Object.freeze(requirements) });
  });
  if (total > (readOnly ? 64 : 32) || new Set(groups.map((group) => group.subjectKey)).size !== groups.length) fail();
  return { subjects, groups, asOf: input.asOf, knowledgeProof: input.knowledgeProof, knowledgeSnapshot: input.knowledgeSnapshot };
}
function checked(client, token, mode) {
  const state = TOKENS.get(token);
  if (!state || state.client !== client || state.identity !== phase2ContextIdentity(client)
    || state.mode !== mode) fail('bad_prerequisite_proof');
  if (mode === 'read') { if (state.readIdentity !== assertItemRead(client)) fail('bad_prerequisite_proof'); }
  else if (mode === 'write') assertWrite(client);
  else fail('bad_prerequisite_proof');
  return state;
}
export function prerequisiteMatches(client, token, { subjectKey, requirement, mode }) {
  const state = checked(client, token, mode), key = JSON.stringify([subjectKey, worldPrerequisiteKey(requirement)]);
  if (!state.matches.has(key)) fail('prerequisite_scope');
  return state.matches.get(key);
}
// Persist only this admission witness with the canonical discovery event. Subsequent
// claim authentication checks its pinned shape; consuming the tool cannot erase history.
export function prerequisiteReceipt(client, token, { subjectKey, requirements }) {
  const state = checked(client, token, 'write');
  const predicates = boundedArray(requirements, 32).map(normalizeWorldPrerequisite);
  const subject = state.subjects.find((entry) => entry.key === subjectKey);
  if (!subject || !predicates.every((requirement) => prerequisiteMatches(client, token, { subjectKey, requirement, mode: 'write' }))) fail('prerequisite_required');
  return Object.freeze({ accountId: subject.accountId, characterId: subject.characterId,
    predicatesHash: digest(predicates) });
}

export function createWorldPrerequisites({ enabled = false, accountIds = [], worldDefinitions = [], knowledgeEnabled = false, sharingEnabled = false } = {}) {
  if ([enabled, knowledgeEnabled, sharingEnabled].some((value) => typeof value !== 'boolean')) fail();
  const cohort = new Set(boundedArray(accountIds, 10000).map(id));
  const worlds = new Map(boundedArray(worldDefinitions, 100).map((definition) => {
    // Definitions are server configuration from the kernel compiler, copied before any await.
    const knowledge = boundedArray(definition.knowledge, 8).map(normalizeKnowledgeRequirement);
    if (typeof definition.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(definition.contentHash)) fail();
    const states = boundedArray(definition.states, 32).map(id), publicStates = boundedArray(definition.publicStates, 32).map(id);
    if (publicStates.some((state) => !states.includes(state))) fail();
    return [id(definition.id), Object.freeze({ id: definition.id, hash: definition.contentHash,
      states: Object.freeze(states), publicStates: Object.freeze(publicStates), knowledge: Object.freeze(knowledge) })];
  }));
  if (worlds.size !== worldDefinitions.length) fail();
  const allowed = (accountId) => enabled && (!cohort.size || cohort.has(accountId));
  // Admission only reads monotonic completed nodes. It never mints a command proof,
  // and can therefore filter a catalog without opening another mutable fact batch.
  async function admitsMysteryState(client, { accountId, characterId, requirements }) {
    try { assertItemRead(client); } catch (error) {
      if (error?.code !== 'item_read_required') throw error;
      assertWrite(client);
    }
    id(accountId); id(characterId);
    const predicates = boundedArray(requirements, 16).map(normalizeWorldPrerequisite);
    if (predicates.some((predicate) => predicate.adapter !== 'mystery_state')) fail();
    if (!allowed(accountId)) return false;
    const actor = (await client.query(`SELECT c.id FROM characters c JOIN accounts a ON a.id=c.account_id
      WHERE c.id=$1 AND c.account_id=$2 AND c.alive=true AND a.status='active'`, [characterId, accountId])).rows[0];
    if (!actor) return false;
    for (const { requirement: q } of predicates) {
      const scope = q.ownerScope === 'account' ? 'account' : 'character';
      const row = (await client.query(`SELECT s.node_id FROM mystery_instances m JOIN mystery_node_state s ON s.instance_id=m.id
        WHERE m.authority_account_id=$1 AND m.owner_scope=$2 AND m.owner_id=$3 AND m.graph_id=$4 AND m.graph_version=$5
          AND m.definition_hash=$6 AND s.node_id=$7 AND s.state='completed' LIMIT 1`,
      [accountId, scope, scope === 'account' ? accountId : characterId, q.graphId, q.graphVersion, q.definitionHash, q.nodeId])).rows[0];
      if (!row) return false;
    }
    return true;
  }
  function knowledgeRequirements(inputs) {
    const facts = boundedArray(inputs, 64).map(normalizeWorldPrerequisite), requirements = new Map();
    for (const fact of facts) if (fact.adapter === 'world_state') {
      const world = worlds.get(fact.requirement.objectId);
      if (!world || world.hash !== fact.requirement.definitionHash || !world.states.includes(fact.requirement.state)) fail();
      for (const requirement of world.knowledge) requirements.set(knowledgeRequirementKey(requirement), requirement);
    }
    return Object.freeze([...requirements.values()]);
  }
  async function evaluate(client, input, readOnly) {
    const readIdentity = readOnly ? assertItemRead(client) : (assertWrite(client), null);
    const data = request(input, readOnly), identity = phase2ContextIdentity(client);
    if (!readOnly) { if (PREPARED.has(identity)) fail('prerequisites_already_prepared'); PREPARED.add(identity); }
    const facts = data.groups.flatMap((group) => group.requirements);
    knowledgeRequirements(facts); // Validate every reference, even when another condition is false.
    const subjects = new Map();
    for (const subject of [...data.subjects].sort((a, b) => a.characterId.localeCompare(b.characterId))) {
      let character, account, crew, family;
      if (readOnly) character = (await client.query('SELECT id,account_id,alive FROM characters WHERE id=$1', [subject.characterId])).rows[0];
      else if (dbCaps.skipLocked) character = (await client.query('SELECT id,account_id,alive FROM characters WHERE id=$1 FOR UPDATE NOWAIT', [subject.characterId])).rows[0];
      else character = (await client.query('SELECT id,account_id,alive FROM characters WHERE id=$1 FOR UPDATE', [subject.characterId])).rows[0];
      if (readOnly) account = (await client.query('SELECT status FROM accounts WHERE id=$1', [subject.accountId])).rows[0];
      else if (dbCaps.skipLocked) account = (await client.query('SELECT status FROM accounts WHERE id=$1 FOR SHARE NOWAIT', [subject.accountId])).rows[0];
      else account = (await client.query('SELECT status FROM accounts WHERE id=$1 FOR SHARE', [subject.accountId])).rows[0];
      const current = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true LIMIT 2', [subject.accountId])).rows;
      if (readOnly) {
        crew = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [subject.accountId])).rows[0];
        family = (await client.query('SELECT gang_id,role FROM gang_members WHERE character_id=$1', [subject.characterId])).rows[0];
      } else if (dbCaps.skipLocked) {
        crew = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1 FOR SHARE NOWAIT', [subject.accountId])).rows[0];
        family = (await client.query('SELECT gang_id,role FROM gang_members WHERE character_id=$1 FOR SHARE NOWAIT', [subject.characterId])).rows[0];
      } else {
        crew = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1 FOR SHARE', [subject.accountId])).rows[0];
        family = (await client.query('SELECT gang_id,role FROM gang_members WHERE character_id=$1 FOR SHARE', [subject.characterId])).rows[0];
      }
      subjects.set(subject.key, { ...subject, crewId: crew?.crew_id, familyId: family?.gang_id, role: family?.role,
        eligible: allowed(subject.accountId) && account?.status === 'active' && character?.alive === true
          && character.account_id === subject.accountId && current.length === 1 && current[0].id === subject.characterId });
    }
    // Mutable world rows precede physical inventory. Missing rows are false, never an
    // assumed initial state: a SELECT cannot lock a row which does not yet exist.
    const worldRows = new Map();
    for (const objectId of [...new Set(facts.filter((f) => f.adapter === 'world_state').map((f) => f.requirement.objectId))].sort()) {
      const result = readOnly ? await client.query('SELECT definition_hash,state,controller_family_id FROM world_kernel_objects WHERE id=$1', [objectId])
        : await client.query('SELECT definition_hash,state,controller_family_id FROM world_kernel_objects WHERE id=$1 FOR SHARE', [objectId]);
      worldRows.set(objectId, result.rows[0]);
    }
    const items = new Map();
    // Freeze the complete candidate set before taking any item lock; no later selection
    // expands it after contention. Current owner/state is rechecked under the item mutex.
    for (const group of data.groups) for (const predicate of group.requirements) if (predicate.adapter === 'item_ownership') {
      const subject = subjects.get(group.subjectKey), templateId = predicate.requirement.templateId;
      const row = (await client.query(`SELECT i.id FROM item_instances i
        WHERE i.owner_scope='account' AND i.owner_id=$1 AND i.template_id=$2 AND i.state='active' AND i.definition_hash IS NULL
          AND i.id IN (SELECT e.item_id FROM item_events e WHERE e.event_kind='created' AND e.provenance_kind='crafted')
        ORDER BY i.id LIMIT 1`, [subject.accountId, templateId])).rows[0];
      items.set(JSON.stringify([group.subjectKey, templateId]), row?.id ?? null);
    }
    const lockedItems = new Map();
    for (const itemId of [...new Set([...items.values()].filter(Boolean))].sort()) {
      const result = readOnly ? await client.query('SELECT owner_scope,owner_id,template_id,state,definition_hash FROM item_instances WHERE id=$1', [itemId])
        : await client.query('SELECT owner_scope,owner_id,template_id,state,definition_hash FROM item_instances WHERE id=$1 FOR SHARE', [itemId]);
      lockedItems.set(itemId, result.rows[0]);
    }
    const matches = new Map();
    for (const group of data.groups) for (const predicate of group.requirements) {
      const subject = subjects.get(group.subjectKey), q = predicate.requirement;
      let matched = false;
      if (subject.eligible && predicate.adapter === 'social') {
        const other = q.subject ? subjects.get(q.subject) : null;
        if (q.relation === 'crew_member') matched = !!subject.crewId;
        if (q.relation === 'family_member') matched = !!subject.familyId;
        if (q.relation === 'family_officer') matched = !!subject.familyId && ['boss', 'underboss'].includes(subject.role);
        if (q.relation === 'same_crew') matched = !!other?.eligible && !!subject.crewId && subject.crewId === other.crewId;
        if (q.relation === 'different_crew') matched = !!other?.eligible && !!subject.crewId && !!other.crewId && subject.crewId !== other.crewId;
        if (q.relation === 'same_family') matched = !!other?.eligible && !!subject.familyId && subject.familyId === other.familyId;
      } else if (subject.eligible && predicate.adapter === 'mystery_state') {
        const scope = q.ownerScope === 'account' ? 'account' : 'character', ownerId = scope === 'account' ? subject.accountId : subject.characterId;
        const row = (await client.query(`SELECT s.node_id FROM mystery_instances m JOIN mystery_node_state s ON s.instance_id=m.id
          WHERE m.authority_account_id=$1 AND m.owner_scope=$2 AND m.owner_id=$3 AND m.graph_id=$4 AND m.graph_version=$5
            AND m.definition_hash=$6 AND s.node_id=$7 AND s.state='completed' LIMIT 1`,
        [subject.accountId, scope, ownerId, q.graphId, q.graphVersion, q.definitionHash, q.nodeId])).rows[0];
        matched = !!row;
      } else if (subject.eligible && predicate.adapter === 'family_operation_outcome') {
        const row = (await client.query(`SELECT o.id FROM world_operations o
          JOIN world_operation_roles r ON r.operation_id=o.id JOIN world_operation_events e ON e.operation_id=o.id AND e.event_kind='resolved'
          JOIN item_mutation_guards g ON g.mutation_id=e.mutation_id AND g.mutation_kind='operation_action'
          WHERE o.coordination_mode='family' AND o.graph_id=$1 AND o.coordination_definition_hash=$2 AND o.status=$3
            AND r.account_id=$4 AND r.character_id=$5 AND g.result_json IS NOT NULL LIMIT 1`,
        [q.definitionId, q.definitionHash, q.outcome, subject.accountId, subject.characterId])).rows[0];
        matched = !!row;
      } else if (subject.eligible && predicate.adapter === 'item_ownership') {
        const row = lockedItems.get(items.get(JSON.stringify([group.subjectKey, q.templateId])));
        matched = row?.owner_scope === 'account' && row.owner_id === subject.accountId && row.template_id === q.templateId
          && row.state === 'active' && row.definition_hash === null;
      } else if (subject.eligible && predicate.adapter === 'world_state') {
        const row = worldRows.get(q.objectId), definition = worlds.get(q.objectId);
        if (row?.definition_hash === q.definitionHash && row.state === q.state
          && (!q.controller || (!!subject.familyId && row.controller_family_id === subject.familyId))) {
          matched = definition.publicStates.includes(row.state);
          if (!matched && knowledgeEnabled && definition.knowledge.length) {
            const proof = readOnly ? data.knowledgeSnapshot : data.knowledgeProof;
            if (readOnly) assertKnowledgeSnapshot(client, proof); else assertKnowledgeProof(client, proof);
            matched = definition.knowledge.every((requirement) => (readOnly ? snapshotRequirementMatches : knowledgeProofMatches)(client, proof,
              { accountId: subject.accountId, characterId: subject.characterId, requirement, sharingEnabled }));
          }
        }
      }
      matches.set(JSON.stringify([group.subjectKey, worldPrerequisiteKey(predicate)]), !!matched);
    }
    const token = Object.freeze({});
    TOKENS.set(token, { client, identity, mode: readOnly ? 'read' : 'write', readIdentity, subjects: data.subjects, matches });
    return token;
  }
  return Object.freeze({ knowledgeRequirements, admitsMysteryState,
    prepare: (client, input) => evaluate(client, input, false), readSnapshot: (client, input) => evaluate(client, input, true) });
}
