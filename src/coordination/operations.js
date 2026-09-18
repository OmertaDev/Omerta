// Family coordination uses existing operation, inventory and knowledge authorities.
// Every command owns one item transaction and one replay receipt, including resolution.
import crypto from 'node:crypto';
import { GameError, bus } from '../game.js';
import { dbCaps } from '../db.js';
import { canonicalBytes } from '../content/canonical.js';
import { withItemTransaction, withItemMutation, registerItemTransactionUndo, itemMutationContext, assertItemRead,
  escrowItem, releaseEscrow, consumeItem, consumeStack, grantStack } from '../items.js';
import { createCoordinationKnowledge, knowledgeProofMatches, assertKnowledgeSnapshot, snapshotRequirementMatches } from './knowledge.js';
import { depositCapital, refundCapital, settleCapital } from './capital.js';
import { compileFamilyOperations, operationSkillValue } from './operation-definitions.js';
import { createWorldPrerequisites, prerequisiteMatches } from '../world-prerequisites.js';
import { knowledgeRequirementKey } from '../world-knowledge.js';

const TERMINAL = new Set(['completed', 'failed', 'canceled', 'expired']);
const hash = (value) => crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
const fail = (code = 'coordination_operation_unavailable') => { throw new GameError(code, 'The operation request could not complete.'); };
const id = (value) => {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,160}$/.test(value)) fail('bad_coordination_operation_request');
  return value;
};
function input(value, required = [], optional = []) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some((key) => ![...required, ...optional].includes(key)
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))
    || required.some((key) => !Object.hasOwn(value, key))) fail('bad_coordination_operation_request');
  return Object.freeze({ ...value });
}
const own = (accountId) => ({ scope: 'account', id: accountId });
const custody = (operationId) => ({ scope: 'operation', id: operationId });
const same = (a, b) => hash(a) === hash(b);
const requirementKey = (roleId, requirementId) => `${roleId}/${requirementId}`;
const roleIdentity = (rows) => rows.map((row) => [row.role_id, row.account_id, row.character_id]);
const promiseIdentity = (rows) => rows.map((r) => [r.role_id, r.requirement_id, r.account_id, r.character_id,
  r.kind, Number(r.quantity), r.template_id, r.item_id, r.state]);
const capitalIdentity = (rows) => rows.map((r) => [r.role_id, r.requirement_id, r.account_id, r.character_id, Number(r.amount), r.state]);

async function roster(client, operationId) {
  return (await client.query('SELECT * FROM world_operation_roles WHERE operation_id=$1 ORDER BY role_id LIMIT 9', [operationId])).rows;
}
async function commitments(client, operationId) {
  return (await client.query('SELECT * FROM world_operation_commitments WHERE operation_id=$1 ORDER BY role_id,requirement_id LIMIT 33', [operationId])).rows;
}
async function capital(client, operationId) {
  return (await client.query('SELECT * FROM world_operation_capital WHERE operation_id=$1 ORDER BY role_id,requirement_id LIMIT 33', [operationId])).rows;
}
async function operationRow(client, operationId, lock = false) {
  const result = lock
    ? await client.query("SELECT * FROM world_operations WHERE id=$1 AND coordination_mode='family' FOR UPDATE", [operationId])
    : await client.query("SELECT * FROM world_operations WHERE id=$1 AND coordination_mode='family'", [operationId]);
  return result.rows[0];
}
const bounded = (roles, promises, cash) => {
  if (roles.length > 8 || promises.length > 32 || cash.length > 32) fail('coordination_operation_corrupt');
};

// Lock the complete participant/original-depositor union before Family and operation rows.
// NOWAIT avoids the existing invite-accept character -> Crew order. A changed union retries;
// it never acquires a newly discovered participant behind an already locked operation.
async function authority(client, accountId, operationId = null, assignedAccountId = null, deferChanged = false, readOnly = false) {
  if (readOnly) assertItemRead(client);
  const before = operationId ? await operationRow(client, operationId) : null;
  if (operationId && !before) fail();
  const roles = operationId ? await roster(client, operationId) : [];
  const promises = operationId ? await commitments(client, operationId) : [];
  const cash = operationId ? await capital(client, operationId) : [];
  bounded(roles, promises, cash);
  const membership = (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [accountId])).rows[0];
  let crew;
  if (membership) crew = readOnly
    ? (await client.query('SELECT id FROM crews WHERE id=$1', [membership.crew_id])).rows[0]
    : (await client.query('SELECT id FROM crews WHERE id=$1 FOR UPDATE', [membership.crew_id])).rows[0];
  const crewAccounts = crew ? (await client.query('SELECT account_id FROM crew_members WHERE crew_id=$1 ORDER BY account_id', [crew.id])).rows.map((r) => r.account_id) : [];
  if (crewAccounts.length > 4) fail('coordination_operation_corrupt');
  const accounts = [...new Set([accountId, ...(assignedAccountId ? [assignedAccountId] : []), ...crewAccounts, ...roles.map((r) => r.account_id),
    ...promises.map((r) => r.account_id), ...cash.map((r) => r.account_id)])].sort();
  const current = new Map(), chars = new Map();
  for (const account of accounts) {
    const live = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [account])).rows;
    if (live.length > 1) fail('coordination_operation_corrupt');
    current.set(account, live[0]?.id ?? null);
  }
  const characterIds = [...new Set([...current.values(), ...roles.map((r) => r.character_id),
    ...promises.map((r) => r.character_id), ...cash.map((r) => r.character_id)].filter(Boolean))].sort();
  for (const characterId of characterIds) {
    const locked = readOnly
      ? await client.query('SELECT * FROM characters WHERE id=$1', [characterId])
      : dbCaps.skipLocked
      ? await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE NOWAIT', [characterId])
      : await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [characterId]);
    const row = locked.rows[0];
    if (row) chars.set(row.id, row);
  }
  const accountRows = new Map();
  for (const account of accounts) {
    const locked = readOnly
      ? await client.query('SELECT id,status FROM accounts WHERE id=$1', [account])
      : dbCaps.skipLocked
      ? await client.query('SELECT id,status FROM accounts WHERE id=$1 FOR SHARE NOWAIT', [account])
      : await client.query('SELECT id,status FROM accounts WHERE id=$1 FOR SHARE', [account]);
    const row = locked.rows[0];
    accountRows.set(account, row);
    const live = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [account])).rows;
    if (live.length > 1 || (live[0]?.id ?? null) !== current.get(account)) fail('contention');
  }
  if (accountRows.get(accountId)?.status !== 'active') fail();
  const ch = chars.get(current.get(accountId));
  const actorFamily = ch && (await client.query('SELECT gang_id,role FROM gang_members WHERE character_id=$1', [ch.id])).rows[0];
  const familyId = before?.family_id || actorFamily?.gang_id;
  let family;
  if (familyId) family = readOnly
    ? (await client.query('SELECT id FROM gangs WHERE id=$1', [familyId])).rows[0]
    : (await client.query('SELECT id FROM gangs WHERE id=$1 FOR SHARE', [familyId])).rows[0];
  const families = new Map();
  for (const characterId of characterIds) {
    const membershipRow = readOnly
      ? await client.query('SELECT gang_id,role FROM gang_members WHERE character_id=$1', [characterId])
      : await client.query('SELECT gang_id,role FROM gang_members WHERE character_id=$1 FOR SHARE', [characterId]);
    families.set(characterId, membershipRow.rows[0]);
  }
  const actualCrew = readOnly
    ? (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [accountId])).rows[0]
    : (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1 FOR SHARE', [accountId])).rows[0];
  if ((actualCrew?.crew_id ?? null) !== (crew?.id ?? null)) fail('contention');
  if (crew && !same(crewAccounts, (await client.query('SELECT account_id FROM crew_members WHERE crew_id=$1 ORDER BY account_id', [crew.id])).rows.map((r) => r.account_id))) fail('contention');
  const row = operationId ? await operationRow(client, operationId, !readOnly) : null;
  if (operationId && (!row || row.family_id !== before.family_id)) fail('contention');
  const changed = operationId && (!same(roleIdentity(roles), roleIdentity(await roster(client, operationId)))
    || !same(promiseIdentity(promises), promiseIdentity(await commitments(client, operationId)))
    || !same(capitalIdentity(cash), capitalIdentity(await capital(client, operationId))));
  if (changed && !deferChanged) fail('contention');
  const member = !!(family && ch?.alive && families.get(ch.id)?.gang_id === familyId);
  const officer = member && ['boss', 'underboss'].includes(families.get(ch.id).role);
  const uniformCrew = !!crew && crewAccounts.length > 0 && crewAccounts.every((account) => {
    const currentCh = chars.get(current.get(account));
    return accountRows.get(account)?.status === 'active' && currentCh?.alive && families.get(currentCh.id)?.gang_id === familyId;
  });
  return { accountId, row, roles, promises, cash, chars, current, accountRows, families, ch,
    familyId, family, member, officer, crewId: crew?.id ?? null, crewAccounts, uniformCrew, changed };
}

// Explicit compensation mirrors only this operation's rows for pg-mem. PostgreSQL uses ROLLBACK.
function restoreOperation(client, row) {
  row = { ...row };
  registerItemTransactionUndo(client, () => client.query(`UPDATE world_operations SET status=$2,revision=$3,
    approved_at=$4,resolved_at=$5,updated_at=$6,activated_at=$7,completed_at=$8,canceled_at=$9,close_reason=$10 WHERE id=$1`,
  [row.id, row.status, row.revision, row.approved_at, row.resolved_at, row.updated_at,
    row.activated_at, row.completed_at, row.canceled_at, row.close_reason]));
}
async function restoreParticipants(client, operationId) {
  const roles = await roster(client, operationId), promises = await commitments(client, operationId);
  const contributions = (await client.query('SELECT * FROM world_operation_contributions WHERE operation_id=$1 ORDER BY node_id', [operationId])).rows;
  registerItemTransactionUndo(client, async () => {
    await client.query('DELETE FROM world_operation_contributions WHERE operation_id=$1', [operationId]);
    await client.query('DELETE FROM world_operation_commitments WHERE operation_id=$1', [operationId]);
    await client.query('DELETE FROM world_operation_roles WHERE operation_id=$1', [operationId]);
    for (const r of roles) await client.query(`INSERT INTO world_operation_roles(operation_id,role_id,account_id,character_id,assigned_at)
      VALUES($1,$2,$3,$4,$5)`, [operationId, r.role_id, r.account_id, r.character_id, r.assigned_at]);
    for (const r of promises) await client.query(`INSERT INTO world_operation_commitments
      (operation_id,role_id,requirement_id,account_id,character_id,kind,quantity,template_id,item_id,state,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [operationId, r.role_id, r.requirement_id,
      r.account_id, r.character_id, r.kind, r.quantity, r.template_id, r.item_id, r.state, r.updated_at]);
    for (const r of contributions) await client.query(`INSERT INTO world_operation_contributions
      (operation_id,node_id,role_id,account_id,character_id,contributed_at) VALUES($1,$2,$3,$4,$5,$6)`,
    [operationId, r.node_id, r.role_id, r.account_id, r.character_id, r.contributed_at]);
  });
}

export function createFamilyOperations({ pool, registry, kernel, definitions = [], enabled = false,
  knowledgeEnabled = false, sharingEnabled = false, prerequisitesEnabled = false, accountIds = [] } = {}) {
  if (!pool || !kernel || [enabled, knowledgeEnabled, sharingEnabled, prerequisitesEnabled].some((v) => typeof v !== 'boolean')
    || !Array.isArray(accountIds)) fail('bad_coordination_operation_definition');
  const compiled = compileFamilyOperations(registry, kernel.definitions, definitions);
  const byId = new Map(compiled.map((d) => [d.id, d])), cohort = new Set(accountIds);
  const knowledge = createCoordinationKnowledge({ enabled: enabled && knowledgeEnabled,
    sharingEnabled: enabled && knowledgeEnabled && sharingEnabled, accountIds });
  const prerequisites = createWorldPrerequisites({ enabled: enabled && prerequisitesEnabled,
    accountIds, worldDefinitions: kernel.definitions, knowledgeEnabled: enabled && knowledgeEnabled,
    sharingEnabled: enabled && knowledgeEnabled && sharingEnabled });
  const allowed = (accountId) => { id(accountId); if (!enabled || (cohort.size && !cohort.has(accountId))) fail(); };
  const logicalKey = (accountId, key) => `family-operation:${hash([id(accountId), id(key)])}`;
  const definitionOf = (row, recovery = false) => {
    const definition = byId.get(row.graph_id);
    if (!definition || definition.version !== Number(row.graph_version)
      || definition.contentHash !== row.coordination_definition_hash
      || JSON.stringify(definition) !== row.coordination_definition_json) {
      if (recovery) return null;
      fail('coordination_operation_definition_changed');
    }
    return definition;
  };
  const canRead = (a) => a.member || a.row.opened_by_account_id === a.accountId
    || a.roles.some((r) => r.account_id === a.accountId)
    || a.promises.some((r) => r.account_id === a.accountId);
  const eligible = (a, role) => {
    const ch = a.chars.get(role?.character_id);
    return !!(role && ch?.alive && ch.account_id === role.account_id && a.current.get(role.account_id) === ch.id
      && a.accountRows.get(role.account_id)?.status === 'active' && a.family
      && a.families.get(ch.id)?.gang_id === a.familyId);
  };
  function roleKnowledge(definition, role) {
    const requirements = role.requirements.filter((r) => r.kind === 'information').map((r) => r.knowledge);
    requirements.push(...prerequisites.knowledgeRequirements(role.requirements.filter((r) => r.kind === 'prerequisite').map((r) => r.predicate)));
    if (role.id === definition.executorRoleId) requirements.push(...kernel.definitions.find((d) => d.id === definition.world.objectId).knowledge);
    return [...new Map(requirements.map((requirement) => [knowledgeRequirementKey(requirement), requirement])).values()];
  }
  function externalPlan(a, definition) {
    const subjects = definition.roles.flatMap((role) => {
      const seat = a.roles.find((r) => r.role_id === role.id);
      return eligible(a, seat) ? [{ key: role.id, accountId: seat.account_id, characterId: seat.character_id }] : [];
    });
    const keys = new Set(subjects.map((subject) => subject.key));
    return { subjects, groups: definition.roles.filter((role) => keys.has(role.id)).map((role) => ({ subjectKey: role.id,
      requirements: role.requirements.filter((r) => r.kind === 'prerequisite').map((r) => r.predicate)
        .filter((predicate) => predicate.adapter !== 'social' || !predicate.requirement.subject || keys.has(predicate.requirement.subject)) })) };
  }
  async function prepareProof(client, a, definition) {
    const groups = [];
    for (const role of definition.roles) {
      const seat = a.roles.find((r) => r.role_id === role.id);
      if (!eligible(a, seat)) continue;
      const requirements = roleKnowledge(definition, role);
      if (!requirements.length) continue;
      const context = await knowledge.context(client, { accountId: seat.account_id,
        character: a.chars.get(seat.character_id), lock: true });
      groups.push({ context, requirements });
    }
    const knowledgeProof = await knowledge.prepareRequirementProof(client, groups);
    const plan = externalPlan(a, definition);
    const facts = plan.groups.some((group) => group.requirements.length)
      ? await prerequisites.prepare(client, { ...plan, asOf: Date.now(), knowledgeProof }) : null;
    return { knowledge: knowledgeProof, facts };
  }
  function factMatches(client, proof, a, seat, requirement, readOnlySnapshot = null) {
    return eligible(a, seat) && knowledge.enabledFor(seat.account_id)
      && (readOnlySnapshot ? snapshotRequirementMatches : knowledgeProofMatches)(client, readOnlySnapshot || proof?.knowledge, { accountId: seat.account_id, characterId: seat.character_id,
        requirement, sharingEnabled: knowledge.sharingEnabledFor(seat.account_id) });
  }
  function externalMatches(client, facts, a, seat, predicate, readOnly = false) {
    if (!facts || !eligible(a, seat)) return false;
    if (predicate.adapter === 'social' && predicate.requirement.subject
      && !eligible(a, a.roles.find((role) => role.role_id === predicate.requirement.subject))) return false;
    return prerequisiteMatches(client, facts, { subjectKey: seat.role_id, requirement: predicate, mode: readOnly ? 'read' : 'write' });
  }
  async function readiness(client, a, definition, proof, executing = false, readOnlySnapshot = null, asOf = Date.now(), readFacts = null) {
    if (readOnlySnapshot) { assertItemRead(client); assertKnowledgeSnapshot(client, readOnlySnapshot, a.accountId); }
    const promises = await commitments(client, a.row.id), cash = await capital(client, a.row.id);
    const rolesFilled = definition.roles.every((role) => a.roles.some((r) => r.role_id === role.id));
    const participantsEligible = rolesFilled && a.roles.every((r) => eligible(a, r));
    let promised = true, fulfilled = true, requirementsMet = true;
    for (const role of definition.roles) for (const required of role.requirements) {
      const seat = a.roles.find((r) => r.role_id === role.id);
      const commitment = promises.find((r) => r.role_id === role.id && r.requirement_id === required.id
        && r.account_id === seat?.account_id && r.character_id === seat?.character_id);
      promised &&= !!commitment && ['promised', 'fulfilled'].includes(commitment.state);
      fulfilled &&= commitment?.state === 'fulfilled';
      if (required.kind === 'information') requirementsMet &&= factMatches(client, proof, a, seat, required.knowledge, readOnlySnapshot);
      if (required.kind === 'prerequisite') requirementsMet &&= externalMatches(client, readFacts || proof?.facts, a, seat, required.predicate, !!readOnlySnapshot);
      if (required.kind === 'capability') requirementsMet &&= eligible(a, seat)
        && operationSkillValue(a.chars.get(seat.character_id), required.skill) >= required.minimum;
      if (commitment?.state !== 'fulfilled') continue;
      if (required.kind === 'capital') requirementsMet &&= cash.some((r) => r.role_id === role.id
        && r.requirement_id === required.id && r.state === 'held' && Number(r.amount) === required.quantity
        && r.account_id === seat.account_id && r.character_id === seat.character_id);
      if (required.kind === 'item') {
        const item = (await client.query('SELECT template_id,owner_scope,owner_id,state FROM item_instances WHERE id=$1', [commitment.item_id])).rows[0];
        requirementsMet &&= item?.template_id === required.templateId && item.owner_scope === 'operation'
          && item.owner_id === a.row.id && item.state === 'escrowed';
      }
    }
    const world = kernel.definitions.find((d) => d.id === definition.world.objectId);
    const action = world.actions.find((d) => d.id === definition.world.actionId);
    let worldResult;
    if (executing && dbCaps.skipLocked) worldResult = await client.query('SELECT state,revision,definition_hash FROM world_kernel_objects WHERE id=$1 FOR UPDATE NOWAIT', [world.id]);
    else if (executing) worldResult = await client.query('SELECT state,revision,definition_hash FROM world_kernel_objects WHERE id=$1 FOR UPDATE', [world.id]);
    else if (readOnlySnapshot) worldResult = await client.query('SELECT state,revision,definition_hash FROM world_kernel_objects WHERE id=$1', [world.id]);
    else worldResult = await client.query('SELECT state,revision,definition_hash FROM world_kernel_objects WHERE id=$1 FOR SHARE', [world.id]);
    const worldRow = worldResult.rows[0];
    const executor = a.roles.find((r) => r.role_id === definition.executorRoleId);
    const executorCh = a.chars.get(executor?.character_id);
    const executorOfficer = eligible(a, executor) && ['boss', 'underboss'].includes(a.families.get(executor.character_id)?.role);
    let worldReady = executorOfficer && executorCh?.loc === world.locationId
      && (!worldRow || worldRow.definition_hash === world.contentHash)
      && (worldRow?.state ?? world.initialState) === action.from;
    worldReady &&= world.knowledge.every((requirement) => factMatches(client, proof, a, executor, requirement, readOnlySnapshot));
    for (const material of action.materials) {
      const row = (await client.query("SELECT quantity FROM item_stacks WHERE owner_scope='operation' AND owner_id=$1 AND template_id=$2 AND quality='standard'", [a.row.id, material.templateId])).rows[0];
      requirementsMet &&= Number(row?.quantity || 0) >= material.quantity;
    }
    const approved = !!a.row.approved_at;
    const ready = rolesFilled && participantsEligible && promised && fulfilled && requirementsMet && worldReady && approved
      && new Date(a.row.expires_at).getTime() > asOf && !TERMINAL.has(a.row.status) && a.row.status !== 'draft';
    return { rolesFilled, participantsEligible, promisesMet: promised, contributionsMet: fulfilled,
      requirementsMet, worldReady: !!worldReady, approved, ready, expectedWorldRevision: Number(worldRow?.revision || 0) };
  }
  async function event(client, a, mutation, kind, payload = {}, roleId = null, requirementId = null) {
    const eventId = crypto.randomUUID(), ordinal = a.eventOrdinal++;
    registerItemTransactionUndo(client, () => client.query('DELETE FROM world_operation_events WHERE id=$1', [eventId]));
    await client.query(`INSERT INTO world_operation_events(id,operation_id,revision,ordinal,mutation_id,
      actor_account_id,actor_character_id,event_kind,role_id,requirement_id,payload_json)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [eventId, a.row.id, a.row.revision, ordinal,
      itemMutationContext(client, mutation).mutationId, a.accountId, a.ch?.id ?? null, kind, roleId, requirementId, JSON.stringify(payload)]);
  }
  async function setStatus(client, a, status) {
    const terminal = TERMINAL.has(status), now = new Date();
    await client.query(`UPDATE world_operations SET status=$2,revision=$3,approved_at=$4,resolved_at=$5,
      updated_at=$6,activated_at=$7,completed_at=$8,canceled_at=$9,close_reason=$10 WHERE id=$1`,
    [a.row.id, status, a.row.revision, a.row.approved_at, terminal ? now : null, now,
      ['executing', 'resolving', 'completed', 'failed'].includes(status) ? (a.row.activated_at || now) : a.row.activated_at,
      status === 'completed' ? now : a.row.completed_at, status === 'canceled' ? now : a.row.canceled_at, terminal ? status : null]);
    a.row.status = status; a.row.resolved_at = terminal ? now : null;
  }
  async function returnCommitment(client, a, promise, mutation) {
    if (promise.state === 'fulfilled') {
      if (promise.kind === 'item') await releaseEscrow(client, a.row.id, own(promise.account_id), promise.item_id, 'Family operation withdrawal', mutation);
      if (promise.kind === 'resource') {
        await consumeStack(client, custody(a.row.id), promise.template_id, Number(promise.quantity), 'standard', 'Family operation withdrawal', mutation);
        await grantStack(client, own(promise.account_id), promise.template_id, Number(promise.quantity), 'standard', 'Family operation withdrawal', mutation);
      }
      if (promise.kind === 'capital') await refundCapital(client, { operationId: a.row.id,
        roleId: promise.role_id, requirementId: promise.requirement_id }, mutation);
      await client.query('DELETE FROM world_operation_contributions WHERE operation_id=$1 AND node_id=$2',
        [a.row.id, requirementKey(promise.role_id, promise.requirement_id)]);
    }
    await client.query("UPDATE world_operation_commitments SET state='withdrawn',updated_at=now() WHERE operation_id=$1 AND role_id=$2 AND requirement_id=$3",
      [a.row.id, promise.role_id, promise.requirement_id]);
    await event(client, a, mutation, 'withdrawn', { fulfilled: promise.state === 'fulfilled' }, promise.role_id, promise.requirement_id);
  }
  const catalogProjection = (d) => ({ id: d.id, version: d.version, title: d.title, lifetimeSeconds: d.lifetimeSeconds,
    roles: d.roles.map((r) => ({ id: r.id, title: r.title, requirements: r.requirements.map((q) => ({ id: q.id, kind: q.kind,
      quantity: q.quantity, ...(q.templateId ? { templateId: q.templateId } : {}) })) })) });
  const admitted = (client, a, definition) => !definition.admission ? true : a.ch?.alive
    ? prerequisites.admitsMysteryState(client, { accountId: a.accountId, characterId: a.ch.id, requirements: definition.admission }) : false;
  async function admittedCatalog(client, a) {
    const result = [];
    for (const definition of compiled) if (await admitted(client, a, definition)) result.push(definition);
    return result;
  }
  async function project(client, a, definition, state) {
    const promises = await commitments(client, a.row.id);
    const rows = (await client.query(`SELECT event_kind,role_id,requirement_id,payload_json,actor_account_id,revision,ordinal,occurred_at
      FROM world_operation_events WHERE operation_id=$1 ORDER BY revision DESC,ordinal DESC LIMIT 101`, [a.row.id])).rows;
    return { id: a.row.id, title: definition?.title ?? 'Family operation', status: a.row.status,
      revision: Number(a.row.revision), expiresAt: new Date(a.row.expires_at).toISOString(), readiness: state ? {
        rolesFilled: state.rolesFilled, participantsEligible: state.participantsEligible, promisesMet: state.promisesMet,
        contributionsMet: state.contributionsMet, requirementsMet: state.requirementsMet,
        worldReady: state.worldReady, approved: state.approved, ready: state.ready } : null,
      roles: (definition?.roles || a.roles.map((r) => ({ id: r.role_id, title: r.role_id, requirements: [] }))).map((role) => {
        const seat = a.roles.find((r) => r.role_id === role.id), mine = seat?.account_id === a.accountId;
        return { id: role.id, title: role.title, filled: !!seat, mine: !!mine,
          requirements: role.requirements.map((r) => ({ id: r.id, kind: r.kind, quantity: r.quantity,
            state: promises.find((p) => p.role_id === role.id && p.requirement_id === r.id)?.state ?? 'uncommitted',
            ...(mine && r.templateId ? { templateId: r.templateId } : {}) })) };
      }), history: rows.slice(0, 100).map((r) => ({ kind: r.event_kind, roleId: r.role_id,
        requirementId: r.requirement_id, mine: r.actor_account_id === a.accountId,
        revision: Number(r.revision), at: new Date(r.occurred_at).toISOString() })), historyTruncated: rows.length > 100 };
  }

  const api = {
    definitions: compiled,
    // Two-stage read adapter: plan every predicate before the shared knowledge snapshot.
    // The closure is bound to this active read and never confers command authority.
    async planSnapshot(client, accountId, { operationId = null, asOf } = {}) {
      const readScope = assertItemRead(client);
      if (!Number.isSafeInteger(asOf) || asOf < 0) fail('bad_coordination_operation_request');
      if (!enabled || (cohort.size && !cohort.has(accountId))) return { groups: [], render: async () => ({ catalog: [], instances: [], selected: null, truncated: false }) };
      allowed(accountId); if (operationId !== null) id(operationId);
      const a = await authority(client, accountId, operationId, null, false, true);
      if (operationId && !canRead(a)) fail();
      // Historical selection has its own authorization. Catalog membership always
      // follows the viewer's current Family, independently of the selected run.
      const currentFamilyId = a.ch?.alive ? a.families.get(a.ch.id)?.gang_id : null;
      const currentFamily = currentFamilyId && (await client.query('SELECT id FROM gangs WHERE id=$1', [currentFamilyId])).rows[0];
      const currentOfficer = !!currentFamily && ['boss', 'underboss'].includes(a.families.get(a.ch.id)?.role);
      const visibleCatalog = currentFamily ? await admittedCatalog(client, a) : [];
      const currentUniformCrew = !!currentFamily && !!a.crewId && a.crewAccounts.length > 0 && a.crewAccounts.every((account) => {
        const character = a.chars.get(a.current.get(account));
        return a.accountRows.get(account)?.status === 'active' && character?.alive && a.families.get(character.id)?.gang_id === currentFamilyId;
      });
      const definition = a.row ? definitionOf(a.row, true) : null;
      const groups = [];
      if (definition && !TERMINAL.has(a.row.status)) for (const role of definition.roles) {
        const seat = a.roles.find((r) => r.role_id === role.id);
        if (!eligible(a, seat)) continue;
        const requirements = roleKnowledge(definition, role);
        if (requirements.length) groups.push({ accountId: seat.account_id, characterId: seat.character_id, requirements });
      }
      // Each authorization branch uses its own lookup index. LIMIT after a broad
      // OR still scanned unrelated global history; branch limits preserve the
      // same top 51 because every branch uses the final total ordering.
      const rows = (await client.query(`SELECT id,graph_id,status,revision,expires_at FROM (
        (SELECT id,graph_id,status,revision,expires_at,created_at FROM world_operations
          WHERE coordination_mode='family' AND family_id=$2 ORDER BY created_at DESC,id LIMIT 51)
        UNION
        (SELECT id,graph_id,status,revision,expires_at,created_at FROM world_operations
          WHERE coordination_mode='family' AND opened_by_account_id=$1 ORDER BY created_at DESC,id LIMIT 51)
        UNION
        (SELECT id,graph_id,status,revision,expires_at,created_at FROM world_operations
          WHERE coordination_mode='family' AND id IN (SELECT operation_id FROM world_operation_roles WHERE account_id=$1)
          ORDER BY created_at DESC,id LIMIT 51)
        UNION
        (SELECT id,graph_id,status,revision,expires_at,created_at FROM world_operations
          WHERE coordination_mode='family' AND id IN (SELECT operation_id FROM world_operation_commitments WHERE account_id=$1)
          ORDER BY created_at DESC,id LIMIT 51)
        ) authorized ORDER BY created_at DESC,id LIMIT 51`, [accountId, currentFamily ? currentFamilyId : null])).rows;
      return { groups, render: async (snapshot) => {
        if (assertItemRead(client) !== readScope) fail('bad_coordination_operation_request');
        assertKnowledgeSnapshot(client, snapshot, accountId);
        const plan = definition && !TERMINAL.has(a.row.status) ? externalPlan(a, definition) : null;
        const facts = plan?.groups.some((group) => group.requirements.length)
          ? await prerequisites.readSnapshot(client, { ...plan, asOf, knowledgeSnapshot: snapshot }) : null;
        const state = definition && !TERMINAL.has(a.row.status)
          ? await readiness(client, a, definition, null, false, snapshot, asOf, facts) : null;
        let selected = a.row ? await project(client, a, definition, state) : null;
        if (selected) {
          const open = !TERMINAL.has(a.row.status), current = open && !!definition && new Date(a.row.expires_at).getTime() > asOf;
          const seat = a.roles.find((r) => r.account_id === accountId);
          const action = (name, canAttempt, body = {}, missing = 'operation_requirements') => ({ action: name, canAttempt: !!canAttempt, input: body, missing: canAttempt ? [] : [missing] });
          selected.actions = [
            action('publish', current && a.officer && a.row.status === 'draft'),
            action('approve', current && a.officer && a.row.status !== 'draft'),
            action('execute', current && a.officer && a.uniformCrew && seat?.role_id === definition?.executorRoleId && state?.ready),
            action('leave', open && !!seat),
            action('cancel', open && (a.officer || a.row.opened_by_account_id === accountId)),
            action('expire', open && new Date(a.row.expires_at).getTime() <= asOf),
          ];
          for (const role of selected.roles) {
            role.actions = [action('join', current && a.member && a.row.status !== 'draft' && !seat && !role.filled, { roleId: role.id })];
            for (const required of role.requirements) {
              required.actions = [];
              if (!role.mine) continue;
              const declaration = definition?.roles.find((r) => r.id === role.id)?.requirements.find((r) => r.id === required.id);
              const activePromise = ['promised', 'fulfilled'].includes(required.state);
              const canCommit = current && a.member && eligible(a, seat) && !activePromise;
              let canContribute = current && a.member && eligible(a, seat) && required.state === 'promised', itemId = null;
              if (canContribute && declaration?.kind === 'information') canContribute = factMatches(client, null, a, seat, declaration.knowledge, snapshot);
              if (canContribute && declaration?.kind === 'prerequisite') canContribute = externalMatches(client, facts, a, seat, declaration.predicate, true);
              if (canContribute && declaration?.kind === 'capability') canContribute = operationSkillValue(a.ch, declaration.skill) >= declaration.minimum;
              if (canContribute && declaration?.kind === 'capital') canContribute = Number(a.ch.cash) >= declaration.quantity;
              if (canContribute && declaration?.kind === 'item') {
                itemId = (await client.query("SELECT id FROM item_instances WHERE owner_scope='account' AND owner_id=$1 AND template_id=$2 AND state='active' AND definition_hash IS NULL ORDER BY id LIMIT 1", [accountId, declaration.templateId])).rows[0]?.id ?? null;
                canContribute = !!itemId;
              }
              if (canContribute && declaration?.kind === 'resource') {
                const stack = (await client.query("SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1 AND template_id=$2 AND quality='standard'", [accountId, declaration.templateId])).rows[0];
                canContribute = Number(stack?.quantity || 0) >= declaration.quantity;
              }
              required.actions = [action('commit', canCommit, { requirementId: required.id }),
                action('contribute', canContribute, { requirementId: required.id, ...(canContribute && itemId ? { itemId } : {}) }),
                action('withdraw', open && activePromise, { requirementId: required.id })];
            }
          }
        }
        return { catalog: currentFamily ? visibleCatalog.map((d) => ({ ...catalogProjection(d),
          canCreate: currentOfficer && currentUniformCrew, missing: currentOfficer && currentUniformCrew ? [] : ['family_authority'] })) : [],
        instances: rows.slice(0, 50).map((r) => ({ id: r.id, definitionId: r.graph_id, status: r.status,
          revision: Number(r.revision), expiresAt: new Date(r.expires_at).toISOString() })), selected, truncated: rows.length > 50 };
      } };
    },
    async catalog(accountId) {
      allowed(accountId);
      return withItemTransaction(pool, async (client) => {
        const a = await authority(client, accountId);
        if (!a.member) fail();
        const rows = (await client.query(`SELECT id,graph_id,status,revision,expires_at FROM world_operations
          WHERE family_id=$1 AND coordination_mode='family' ORDER BY created_at DESC,id LIMIT 51`, [a.familyId])).rows;
        return { operations: (await admittedCatalog(client, a)).map(catalogProjection), instances: rows.slice(0, 50).map((r) => ({
          id: r.id, definitionId: r.graph_id, status: r.status, revision: Number(r.revision),
          expiresAt: new Date(r.expires_at).toISOString() })), truncated: rows.length > 50 };
      });
    },
    async get(accountId, operationId) {
      allowed(accountId); id(operationId);
      return withItemTransaction(pool, async (client) => {
        const a = await authority(client, accountId, operationId);
        if (!canRead(a)) fail();
        const definition = definitionOf(a.row, true);
        const state = definition && !TERMINAL.has(a.row.status)
          ? await readiness(client, a, definition, await prepareProof(client, a, definition)) : null;
        return project(client, a, definition, state);
      });
    },
    async create(accountId, value, key) {
      allowed(accountId); value = input(value, ['definitionId']); id(value.definitionId);
      const definition = byId.get(value.definitionId);
      if (!definition) fail();
      let fresh = false;
      const result = await withItemTransaction(pool, async (client) => {
        const a = await authority(client, accountId);
        if (!a.officer || !a.uniformCrew) fail('coordination_operation_forbidden');
        return withItemMutation(client, own(accountId), 'operation_action', logicalKey(accountId, key),
          { domain: 'family-coordination', action: 'create', definitionId: definition.id, version: definition.version }, async (mutation) => {
            if (!await admitted(client, a, definition)) fail();
            const operationId = crypto.randomUUID(), now = new Date(), expires = new Date(now.getTime() + definition.lifetimeSeconds * 1000);
            registerItemTransactionUndo(client, () => client.query('DELETE FROM world_operations WHERE id=$1', [operationId]));
            await client.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,
              opened_by_account_id,status,coordination_mode,family_id,run_key,coordination_definition_hash,
              coordination_definition_json,revision,expires_at,resolution_seed)
              VALUES($1,$2,$3,$4,$5,$6,'draft','family',$7,$8,$9,$10,1,$11,$12)`,
            [operationId, definition.id, definition.version, definition.id, a.crewId, accountId, a.familyId,
              operationId, definition.contentHash, JSON.stringify(definition), expires, crypto.randomBytes(32).toString('hex')]);
            a.row = await operationRow(client, operationId); a.eventOrdinal = 0;
            await event(client, a, mutation, 'created'); fresh = true;
            return { operationId, status: 'draft', revision: 1 };
          });
      });
      if (fresh) { try { bus.emit('coordination:changed', { operationId: result.operationId, revision: result.revision }); } catch { /* durable receipt is authoritative */ } }
      return result;
    },
    async command(accountId, operationId, action, value, key) {
      allowed(accountId); id(operationId); id(action);
      const fields = { publish: [], join: ['roleId'], assign: ['roleId', 'accountId'], leave: [], commit: ['requirementId'],
        contribute: ['requirementId'], withdraw: ['requirementId'], approve: [], execute: [], cancel: [], expire: [] };
      if (!Object.hasOwn(fields, action)) fail('bad_coordination_operation_request');
      value = input(value, fields[action], action === 'contribute' ? ['itemId'] : []);
      Object.values(value).forEach(id);
      let fresh = false, worldReceipt = null;
      const result = await withItemTransaction(pool, async (client) => {
        const a = await authority(client, accountId, operationId, action === 'assign' ? value.accountId : null, true);
        if (!canRead(a)) fail();
        const recovery = ['cancel', 'expire', 'withdraw', 'leave'].includes(action);
        return withItemMutation(client, own(accountId), 'operation_action', logicalKey(accountId, key), {
          domain: 'family-coordination', operationId, action, input: value,
          itemAuthority: { operations: [operationId], destinations: [...new Set([accountId,
            ...a.roles.map((r) => r.account_id), ...a.promises.map((r) => r.account_id)])].map(own) },
        }, async (mutation) => {
          // A completed exact-key replay is returned before this callback. Fresh work must
          // retry if the participant/depositor union changed while acquiring parent locks.
          if (a.changed) fail('contention');
          const definition = definitionOf(a.row, recovery);
          if (TERMINAL.has(a.row.status)) fail('coordination_operation_closed');
          const expired = new Date(a.row.expires_at).getTime() <= Date.now();
          if (expired && !['expire', 'cancel', 'withdraw', 'leave'].includes(action)) fail('coordination_operation_expired');
          if (!recovery && !a.member) fail('coordination_operation_forbidden');
          // Complete knowledge/physical fact planning precedes any inventory movement.
          // Joining changes the already locked seat union, but performs no inventory writes.
          let proof = definition && !['join', 'assign', 'cancel', 'expire'].includes(action)
            ? await prepareProof(client, a, definition) : null;
          restoreOperation(client, a.row); await restoreParticipants(client, operationId);
          if (Number(a.row.revision) >= 2147483647) fail('coordination_operation_limit');
          a.row.revision = Number(a.row.revision) + 1; a.eventOrdinal = 0;
          let seat = a.roles.find((r) => r.account_id === accountId);
          if (action === 'publish') {
            if (!a.officer || a.row.status !== 'draft') fail('coordination_operation_forbidden');
            await setStatus(client, a, 'recruiting');
          } else if (action === 'join' || action === 'assign') {
            const targetId = action === 'assign' ? value.accountId : accountId;
            const targetCh = a.chars.get(a.current.get(targetId));
            if (action === 'assign' && (!a.officer || (cohort.size && !cohort.has(targetId)))) fail('coordination_operation_forbidden');
            if (a.row.status === 'draft' || !targetCh?.alive || a.accountRows.get(targetId)?.status !== 'active'
              || a.families.get(targetCh.id)?.gang_id !== a.familyId || a.roles.some((r) => r.account_id === targetId)
              || !definition.roles.some((r) => r.id === value.roleId)
              || a.roles.some((r) => r.role_id === value.roleId)) fail('coordination_operation_role');
            await client.query('INSERT INTO world_operation_roles(operation_id,role_id,account_id,character_id) VALUES($1,$2,$3,$4)',
              [operationId, value.roleId, targetId, targetCh.id]);
          } else if (['commit', 'contribute', 'withdraw'].includes(action)) {
            if (!seat || (!recovery && !eligible(a, seat))) fail('coordination_operation_role');
            const required = definition?.roles.find((r) => r.id === seat.role_id)?.requirements.find((r) => r.id === value.requirementId);
            const promise = a.promises.find((r) => r.role_id === seat.role_id && r.requirement_id === value.requirementId);
            if (action === 'withdraw') {
              if (!promise || promise.account_id !== accountId || !['promised', 'fulfilled'].includes(promise.state)) fail('coordination_operation_commitment');
              await returnCommitment(client, a, promise, mutation);
            } else {
              if (!required) fail('coordination_operation_commitment');
              if (action === 'commit') {
                if (promise && ['promised', 'fulfilled'].includes(promise.state)) fail('coordination_operation_commitment');
                await client.query(`INSERT INTO world_operation_commitments(operation_id,role_id,requirement_id,account_id,character_id,kind,quantity,template_id,state)
                  VALUES($1,$2,$3,$4,$5,$6,$7,$8,'promised') ON CONFLICT(operation_id,role_id,requirement_id)
                  DO UPDATE SET account_id=excluded.account_id,character_id=excluded.character_id,kind=excluded.kind,
                    quantity=excluded.quantity,template_id=excluded.template_id,item_id=NULL,state='promised',updated_at=now()`,
                [operationId, seat.role_id, required.id, accountId, seat.character_id, required.kind, required.quantity, required.templateId ?? null]);
              } else {
                if (promise?.state !== 'promised' || promise.account_id !== accountId || promise.character_id !== seat.character_id) fail('coordination_operation_commitment');
                if (required.kind !== 'item' && value.itemId !== undefined) fail('bad_coordination_operation_request');
                if (required.kind === 'item') {
                  id(value.itemId);
                  const item = (await client.query('SELECT template_id,definition_hash FROM item_instances WHERE id=$1', [value.itemId])).rows[0];
                  if (item?.template_id !== required.templateId || item.definition_hash !== null) fail('coordination_operation_commitment');
                  await escrowItem(client, own(accountId), operationId, value.itemId, 'Family operation contribution', mutation, 'used_in_operation');
                }
                if (required.kind === 'resource') {
                  await consumeStack(client, own(accountId), required.templateId, required.quantity, 'standard', 'Family operation contribution', mutation);
                  await grantStack(client, custody(operationId), required.templateId, required.quantity, 'standard', 'Family operation contribution', mutation);
                }
                if (required.kind === 'capital') await depositCapital(client, { operationId, roleId: seat.role_id,
                  requirementId: required.id, characterId: seat.character_id, amount: required.quantity }, mutation);
                if (required.kind === 'capability' && operationSkillValue(a.ch, required.skill) < required.minimum) fail('coordination_operation_requirements');
                if (required.kind === 'information' && !factMatches(client, proof, a, seat, required.knowledge)) fail('coordination_operation_requirements');
                if (required.kind === 'prerequisite' && !externalMatches(client, proof?.facts, a, seat, required.predicate)) fail('coordination_operation_requirements');
                await client.query("UPDATE world_operation_commitments SET state='fulfilled',item_id=$4,updated_at=now() WHERE operation_id=$1 AND role_id=$2 AND requirement_id=$3",
                  [operationId, seat.role_id, required.id, value.itemId ?? null]);
                await client.query(`INSERT INTO world_operation_contributions(operation_id,node_id,role_id,account_id,character_id)
                  VALUES($1,$2,$3,$4,$5)`, [operationId, requirementKey(seat.role_id, required.id), seat.role_id, accountId, seat.character_id]);
              }
            }
          } else if (action === 'leave') {
            if (!seat) fail('coordination_operation_role');
            for (const promise of a.promises.filter((r) => r.role_id === seat.role_id && ['promised', 'fulfilled'].includes(r.state))) await returnCommitment(client, a, promise, mutation);
            await client.query('DELETE FROM world_operation_roles WHERE operation_id=$1 AND role_id=$2', [operationId, seat.role_id]);
          } else if (action === 'approve') {
            if (!a.officer || a.row.status === 'draft') fail('coordination_operation_forbidden');
            a.row.approved_at = new Date();
          } else if (action === 'cancel' || action === 'expire') {
            if (action === 'expire' ? !expired : (!a.officer && a.row.opened_by_account_id !== accountId)) fail('coordination_operation_forbidden');
            for (const promise of a.promises.filter((r) => ['promised', 'fulfilled'].includes(r.state))) await returnCommitment(client, a, promise, mutation);
            await settleCapital(client, operationId, 'refund', mutation);
            await setStatus(client, a, action === 'expire' ? 'expired' : 'canceled');
          }
          if (['join', 'assign', 'leave', 'commit', 'contribute', 'withdraw'].includes(action)) a.row.approved_at = null;
          a.roles = await roster(client, operationId);
          // A joining actor was included in the original union; no new character lock is needed.
          let state = null;
          if (definition && !TERMINAL.has(a.row.status)) {
            proof ??= await prepareProof(client, a, definition);
            state = await readiness(client, a, definition, proof, action === 'execute');
            if (action === 'execute') {
              if (!a.officer || !a.uniformCrew || !seat || seat.role_id !== definition.executorRoleId || !state.ready) fail('coordination_operation_not_ready');
              await setStatus(client, a, 'executing'); await event(client, a, mutation, 'executing');
              await setStatus(client, a, 'resolving'); await event(client, a, mutation, 'resolving');
              const bonus = definition.resolution.skillBonuses.reduce((sum, entry) => sum + Math.min(entry.maxBonusPermille,
                operationSkillValue(a.ch, entry.skill) * entry.perLevelPermille), 0);
              const chance = Math.min(1000, definition.resolution.chancePermille + bonus);
              const roll = parseInt(hash([a.row.resolution_seed, operationId, definition.contentHash]).slice(0, 12), 16) % 1000;
              const success = roll < chance;
              const held = await commitments(client, operationId);
              const primary = held.find((r) => r.role_id === definition.world.itemRoleId && r.requirement_id === definition.world.itemRequirementId);
              if (success) worldReceipt = await kernel.executeInTransaction(client, accountId, {
                objectId: definition.world.objectId, actionId: definition.world.actionId, itemId: primary.item_id,
                expectedRevision: state.expectedWorldRevision }, mutation, { operationId, knowledgeProof: proof.knowledge });
              else {
                await consumeItem(client, custody(operationId), primary.item_id, 'Family operation failed', mutation);
                for (const promise of held.filter((r) => r.kind === 'resource' && r.state === 'fulfilled'))
                  await consumeStack(client, custody(operationId), promise.template_id, Number(promise.quantity), 'standard', 'Family operation failed', mutation);
              }
              await settleCapital(client, operationId, 'spend', mutation);
              await client.query("UPDATE world_operation_commitments SET state='spent',updated_at=now() WHERE operation_id=$1 AND state='fulfilled'", [operationId]);
              await setStatus(client, a, success ? 'completed' : 'failed');
              await event(client, a, mutation, 'resolved', { success, chancePermille: chance, roll });
            } else if (a.row.status !== 'draft') {
              await setStatus(client, a, state.ready ? 'ready' : state.rolesFilled && state.promisesMet ? 'committed' : 'recruiting');
            }
          }
          if (!TERMINAL.has(a.row.status)) await setStatus(client, a, a.row.status);
          await event(client, a, mutation, action, {}, value.roleId || seat?.role_id || null, value.requirementId || null);
          fresh = true;
          return { operationId, status: a.row.status, revision: a.row.revision, ...(worldReceipt ? { world: worldReceipt } : {}) };
        });
      });
      if (fresh) {
        if (worldReceipt) await kernel.notifyCommitted(worldReceipt);
        try { bus.emit('coordination:changed', { operationId: result.operationId, revision: result.revision }); } catch { /* durable receipt is authoritative */ }
      }
      return result;
    },
  };
  return Object.freeze(api);
}
