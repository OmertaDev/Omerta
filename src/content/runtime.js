import crypto from 'node:crypto';
import { GameError } from '../game.js';
import { compileContentPack, validateActivatableContentPack } from './compiler.js';
import {
  MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD,
  disciplineLvlOf, levelOf, masteryLvlOf, seasonIdxOf, seasonPhaseLeft, seasonPhaseOf,
} from '../rules.js';

const COMPLETE = 'completed';
const ACTIVE = 'active';
const FORMING = 'forming';
export const CONTENT_FORMING_TTL_MS = 24 * 60 * 60 * 1000;
const ACTION_TYPES = new Set(['puzzle', 'choice']);
const PASSIVE_UNLOCK_TYPES = new Set(['mystery', 'chapter', 'reward_bundle', 'terminal']);

const fail = (code, message, data) => { throw new GameError(code, message, data); };
const parseJson = (value, fallback = {}) => {
  try { return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback); }
  catch { return fallback; }
};
const normalizeAnswer = (value) => String(value ?? '').trim().toLowerCase();
const runPolicyOf = (graph) => graph.runtime.runPolicy || 'once';
const runKeyOf = (graph) => (runPolicyOf(graph) === 'once_per_season'
  ? `season:${seasonIdxOf()}` : 'once');
const entitlementTargetId = (graph, instance, refId) => (
  runPolicyOf(graph) === 'once_per_season'
    ? `${graph.bundle.namespace}:${instance.run_key}:${refId}`
    : refId
);

function verifyBundle(bundle, expectedHash) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    fail('content_hash_mismatch', 'The submitted content artifact is not a bundle.');
  }
  const claimed = String(bundle.contentHash || '');
  const { contentHash: _claimedHash, ...source } = bundle;
  let compiled;
  try { compiled = compileContentPack(source); }
  catch (error) { fail('unsupported_content_feature', error.message); }
  if (!claimed || compiled.contentHash !== claimed || (expectedHash && expectedHash !== claimed)) {
    fail('content_hash_mismatch', 'The content artifact does not match its pinned hash.');
  }
  try { return validateActivatableContentPack(compiled); }
  catch (error) {
    if (error instanceof GameError) throw error;
    fail('unsupported_content_feature', error.message);
  }
}

function graphOf(bundle) {
  const runtime = bundle.runtime;
  const included = new Set(runtime.nodeIds);
  const nodeById = new Map(bundle.nodes.filter((node) => included.has(node.id)).map((node) => [node.id, node]));
  const edges = bundle.edges
    .filter((edge) => included.has(edge.from) && included.has(edge.to))
    .sort((a, b) => `${a.from}\0${a.type}\0${a.to}`.localeCompare(`${b.from}\0${b.type}\0${b.to}`));
  const outgoing = new Map();
  const incoming = new Map();
  for (const edge of edges) {
    const out = outgoing.get(edge.from) || [];
    out.push(edge); outgoing.set(edge.from, out);
    const inc = incoming.get(edge.to) || [];
    inc.push(edge); incoming.set(edge.to, inc);
  }
  const partyRoles = edges
    .filter((edge) => edge.from === runtime.partyPolicyId && edge.type === 'PERFORMED_BY_ROLE')
    .map((edge) => edge.to);
  return {
    bundle, runtime, nodeById, edges, outgoing, incoming,
    actionIds: new Set(runtime.actionNodeIds), partyRoles,
    policy: nodeById.get(runtime.partyPolicyId), quorum: nodeById.get(runtime.quorumId),
  };
}

async function loadBundle(client, namespace, version, contentHash) {
  const row = (await client.query(
    `SELECT bundle_json FROM content_bundles
      WHERE namespace=$1 AND version=$2 AND content_hash=$3`,
    [namespace, version, contentHash],
  )).rows[0];
  if (!row) fail('content_inactive', 'The pinned content bundle is unavailable.');
  const bundle = parseJson(row.bundle_json, null);
  if (!bundle) fail('content_inactive', 'The pinned content bundle cannot be read.');
  return bundle;
}

async function loadActiveBundle(client, namespace) {
  const active = (await client.query(
    'SELECT version, content_hash FROM content_activations WHERE namespace=$1', [namespace],
  )).rows[0];
  if (!active) fail('content_inactive', 'That authored experience is not active.');
  return loadBundle(client, namespace, Number(active.version), active.content_hash);
}

export async function activateContentBundle(pool, { bundle, expectedHash, operatorId }) {
  const verified = verifyBundle(bundle, expectedHash);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO content_bundles
         (namespace, version, schema_version, content_hash, bundle_json, registered_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [verified.namespace, verified.version, verified.schemaVersion, verified.contentHash,
        JSON.stringify(verified), operatorId || null],
    );
    const registered = (await client.query(
      'SELECT content_hash FROM content_bundles WHERE namespace=$1 AND version=$2',
      [verified.namespace, verified.version],
    )).rows[0];
    if (!registered || registered.content_hash !== verified.contentHash) {
      fail('content_version_conflict', 'That namespace and version already identify different content.');
    }

    let active = (await client.query(
      'SELECT version, content_hash FROM content_activations WHERE namespace=$1 FOR UPDATE',
      [verified.namespace],
    )).rows[0];
    if (active && Number(active.version) > verified.version) {
      fail('content_version_regression', 'An older content version cannot replace an active newer version.');
    }
    if (active && Number(active.version) === verified.version
      && active.content_hash !== verified.contentHash) {
      fail('content_version_conflict', 'The active version is pinned to a different hash.');
    }
    const replay = !!active && active.content_hash === verified.contentHash;
    if (!replay && active) {
      await client.query(
        `UPDATE content_activations
            SET version=$2, content_hash=$3, activated_by=$4, activated_at=now()
          WHERE namespace=$1`,
        [verified.namespace, verified.version, verified.contentHash, operatorId || null],
      );
    } else if (!active) {
      await client.query(
        `INSERT INTO content_activations (namespace, version, content_hash, activated_by)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [verified.namespace, verified.version, verified.contentHash, operatorId || null],
      );
      active = (await client.query(
        'SELECT version, content_hash FROM content_activations WHERE namespace=$1',
        [verified.namespace],
      )).rows[0];
      if (Number(active.version) > verified.version) {
        fail('content_version_regression', 'An older content version cannot replace an active newer version.');
      }
      if (active.content_hash !== verified.contentHash) {
        if (Number(active.version) === verified.version) {
          fail('content_version_conflict', 'The active version is pinned to a different hash.');
        }
        await client.query(
          `UPDATE content_activations
              SET version=$2, content_hash=$3, activated_by=$4, activated_at=now()
            WHERE namespace=$1 AND version < $2`,
          [verified.namespace, verified.version, verified.contentHash, operatorId || null],
        );
      }
    }
    await client.query('COMMIT');
    return {
      ok: true, namespace: verified.namespace, version: verified.version,
      contentHash: verified.contentHash, replay,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function scopeIdFor(ch, scopeKind, client) {
  if (scopeKind === 'personal') return ch.id;
  if (scopeKind === 'crew') {
    const row = (await client.query(
      'SELECT crew_id FROM crew_members WHERE account_id=$1', [ch.account_id],
    )).rows[0];
    if (!row) fail('wrong_organization', 'Join a Crew before opening this experience.');
    return row.crew_id;
  }
  if (scopeKind === 'extended_family') {
    const row = (await client.query(
      'SELECT gang_id FROM gang_members WHERE character_id=$1', [ch.id],
    )).rows[0];
    if (!row) fail('wrong_organization', 'Join a Family before opening this experience.');
    return row.gang_id;
  }
  fail('wrong_organization', 'That organization scope is not supported.');
}

async function belongsToScope(client, accountId, scopeKind, scopeId) {
  if (scopeKind === 'personal') {
    return !!(await client.query(
      'SELECT 1 FROM characters WHERE id=$1 AND account_id=$2 AND alive', [scopeId, accountId],
    )).rows[0];
  }
  if (scopeKind === 'crew') {
    return !!(await client.query(
      'SELECT 1 FROM crew_members WHERE account_id=$1 AND crew_id=$2', [accountId, scopeId],
    )).rows[0];
  }
  if (scopeKind === 'extended_family') {
    return !!(await client.query(
      `SELECT 1 FROM characters c JOIN gang_members gm ON gm.character_id=c.id
        WHERE c.account_id=$1 AND c.alive AND gm.gang_id=$2`,
      [accountId, scopeId],
    )).rows[0];
  }
  return false;
}

function participantKind(acct) {
  if (acct?.npc_flag) return 'npc';
  return acct?.agent_flag ? 'agent' : 'human_eligible_non_agent';
}

function roleOf(graph, roleId) {
  if (!graph.partyRoles.includes(roleId)) fail('bad_role', 'That is not a seat in this experience.');
  const role = graph.nodeById.get(roleId);
  if (!role || role.type !== 'role') fail('bad_role', 'That role definition is unavailable.');
  return role;
}

function assertRoleEligible(role, kind) {
  if (kind === 'npc' || !role.payload?.participantKinds?.includes(kind)) {
    fail('participant_kind', 'This account is not eligible for that role.');
  }
}

async function lockedInstance(client, instanceId) {
  const row = (await client.query(
    'SELECT * FROM content_instances WHERE id=$1 FOR UPDATE', [instanceId],
  )).rows[0];
  if (!row) fail('no_content_instance', 'No such authored-content instance.');
  if (row.status === FORMING && row.forming_expires_at
    && new Date(row.forming_expires_at).getTime() <= Date.now()) {
    await client.query(
      `UPDATE content_instances
          SET status='abandoned', revision=revision+1
        WHERE id=$1 AND status='forming'`, [instanceId],
    );
    row.status = 'abandoned';
    row.revision = Number(row.revision) + 1;
  }
  return row;
}

async function expireFormingContentInstances(client) {
  return client.query(
    `UPDATE content_instances
        SET status='abandoned', revision=revision+1
      WHERE status='forming' AND forming_expires_at IS NOT NULL AND forming_expires_at <= now()`,
  );
}

function visibleInstance(row) {
  if (row?.status === FORMING && row.forming_expires_at
    && new Date(row.forming_expires_at).getTime() <= Date.now()) {
    return { ...row, status: 'abandoned', revision: Number(row.revision) + 1 };
  }
  return row;
}

async function memberRows(client, instanceId) {
  return (await client.query(
    `SELECT * FROM content_instance_members
      WHERE instance_id=$1 ORDER BY joined_at, account_id`, [instanceId],
  )).rows;
}

const actionId = (instance, kind, nodeId = '') => `content_${crypto.createHash('sha256')
  .update(`${instance.id}\0${Number(instance.revision)}\0${kind}\0${nodeId}`)
  .digest('hex').slice(0, 24)}`;

function locationRequiredBy(node, graph) {
  const gate = (node?.payload?.gates || []).find((item) => item.kind === 'at_location');
  if (!gate) return null;
  const location = graph.nodeById.get(gate.locationId);
  return location ? {
    id: location.id,
    districtId: location.payload?.districtId,
    title: location.payload?.title || location.id,
  } : null;
}

export function publicGateState(ch, h, gate, graph, roleId = null) {
  if (gate.kind === 'level_at_least') {
    const current = levelOf(Number(ch.respect));
    return {
      kind: gate.kind, label: 'Level requirement', passed: current >= gate.level,
      current, required: gate.level,
    };
  }
  if (gate.kind === 'mastery_at_least') {
    const track = MASTERY.TRACKS.find((item) => item.id === gate.trackId);
    const current = masteryLvlOf(Number(h?.owned?.mastery?.[gate.trackId] || 0));
    return {
      kind: gate.kind, label: `${track?.name || gate.trackId} mastery`,
      passed: current >= gate.level, trackId: gate.trackId,
      title: track?.name || gate.trackId, current, required: gate.level,
    };
  }
  if (gate.kind === 'path_is') {
    const path = PATHS.find((item) => item.id === gate.pathId);
    const current = ch.path || null;
    return {
      kind: gate.kind, label: `${path?.name || gate.pathId} Path`,
      passed: current === gate.pathId, pathId: gate.pathId,
      title: path?.name || gate.pathId, current, required: gate.pathId,
    };
  }
  if (gate.kind === 'skill_owned') {
    const skill = SKILLS.TREE.find((item) => item.id === gate.skillId);
    const passed = !!h?.owned?.skills?.has(gate.skillId);
    return {
      kind: gate.kind, label: `${skill?.name || gate.skillId} skill`, passed,
      skillId: gate.skillId, title: skill?.name || gate.skillId, current: passed, required: true,
    };
  }
  if (gate.kind === 'discipline_at_least') {
    const discipline = REGIMEN.DISCIPLINES.find((item) => item.id === gate.disciplineId);
    const current = disciplineLvlOf(Number(h?.owned?.disciplines?.[gate.disciplineId] || 0));
    return {
      kind: gate.kind, label: `${discipline?.name || gate.disciplineId} discipline`,
      passed: current >= gate.level, disciplineId: gate.disciplineId,
      title: discipline?.name || gate.disciplineId, current, required: gate.level,
    };
  }
  if (gate.kind === 'honor_at_least' || gate.kind === 'honor_at_most') {
    const current = Number(ch.honor) || 0;
    const atLeast = gate.kind === 'honor_at_least';
    return {
      kind: gate.kind, label: `Honor ${gate.honor} or ${atLeast ? 'higher' : 'lower'}`,
      passed: atLeast ? current >= gate.honor : current <= gate.honor,
      current, required: gate.honor,
    };
  }
  if (gate.kind === 'underworld_standing_at_least') {
    const npc = UNDERWORLD.NPCS.find((item) => item.id === gate.npcId);
    const current = Number(h?.owned?.npc?.[gate.npcId] || 0);
    return {
      kind: gate.kind, label: `${npc?.name || gate.npcId} standing`,
      passed: current >= gate.standing, npcId: gate.npcId,
      title: npc?.name || gate.npcId, current, required: gate.standing,
    };
  }
  if (gate.kind === 'season_phase_is') {
    const currentPhase = seasonPhaseOf();
    const requiredPhase = SEASON_PHASES.find((phase) => phase.id === gate.phaseId);
    return {
      kind: gate.kind, label: `${requiredPhase?.name || gate.phaseId} season phase`,
      passed: currentPhase.id === gate.phaseId,
      current: currentPhase.id, required: gate.phaseId,
    };
  }
  if (gate.kind === 'crew_membership') {
    const passed = !!h?.owned?.crewId;
    return { kind: gate.kind, label: 'Crew membership', passed, current: passed, required: true };
  }
  if (gate.kind === 'at_location') {
    const location = locationRequiredBy({ payload: { gates: [gate] } }, graph);
    return {
      kind: gate.kind, label: location?.title || 'Required district',
      passed: !location || ch.loc === location.districtId, location,
    };
  }
  if (gate.kind === 'party_role') {
    return { kind: gate.kind, label: 'Assigned story role', passed: gate.role === roleId, roleId: gate.role };
  }
  return { kind: gate.kind, label: 'Unsupported content requirement', passed: false };
}

function gateStates(ch, h, gates, graph, roleId = null) {
  return (gates || []).map((gate) => publicGateState(ch, h, gate, graph, roleId));
}

export function blockedGates(ch, h, gates, graph, roleId = null) {
  return gateStates(ch, h, gates, graph, roleId).filter((gate) => !gate.passed);
}

export function assertNodeGates(ch, h, node, graph, roleId = null, { option = false } = {}) {
  const blockedBy = blockedGates(ch, h, node?.payload?.gates, graph, roleId);
  if (!blockedBy.length) return;
  if (option) fail('content_gate', 'That story choice is not available to this street.', { blockedBy });
  const blocked = blockedBy[0];
  if (blocked.kind === 'at_location') {
    fail('wrong_location', `Travel to ${blocked.location.title} before continuing this story.`, {
      location: blocked.location,
    });
  }
  if (blocked.kind === 'party_role') fail('party_role', 'Only the assigned party role may perform that action.');
  if (blocked.kind === 'level_at_least') {
    fail('level', `This story opens at level ${blocked.required}.`, { blockedBy });
  }
  fail('content_gate', 'This street does not satisfy the authored-content gate.', { blockedBy });
}

function projectedMember(row, graph, instance, accountId) {
  return {
    name: row.name_snapshot, roleId: row.role_id,
    roleTitle: graph.nodeById.get(row.role_id)?.payload?.title || row.role_id,
    participantKind: row.participant_kind, consented: !!row.consent_at && !row.consent_revoked_at,
    leader: row.account_id === instance.created_by_account, isMe: row.account_id === accountId,
  };
}

async function lobbyProjection(ch, instance, bundle, client, h) {
  if (instance.status !== FORMING
    || !await belongsToScope(client, ch.account_id, instance.scope_kind, instance.scope_id)) {
    fail('not_member', 'You cannot view this authored-content lobby.');
  }
  const graph = graphOf(bundle);
  const members = await memberRows(client, instance.id);
  if (members.some((row) => row.account_id === ch.account_id)) {
    return projection(ch, instance, bundle, client, h);
  }
  const taken = new Set(members.map((row) => row.role_id));
  const kind = participantKind(h.acct);
  const root = graph.nodeById.get(graph.runtime.entryNodeId);
  return {
    instance: {
      id: instance.id, namespace: instance.namespace, version: Number(instance.version),
      contentHash: instance.content_hash, experienceId: instance.experience_id,
      title: root?.payload?.title || instance.experience_id,
      scopeKind: instance.scope_kind, status: instance.status, revision: Number(instance.revision),
      runKey: instance.run_key || 'once',
      members: members.map((row) => projectedMember(row, graph, instance, ch.account_id)),
      openRoles: graph.partyRoles.flatMap((roleId) => {
        const role = graph.nodeById.get(roleId);
        if (taken.has(roleId) || !role?.payload?.participantKinds?.includes(kind)) return [];
        return [{
          id: roleId, title: role.payload?.title || roleId,
          consentRequired: role.payload?.consentRequired === true,
        }];
      }),
      createdAt: instance.created_at, formingExpiresAt: instance.forming_expires_at || null,
    },
  };
}

async function joinReplacementProjection(ch, instance, bundle, client, h) {
  if (!await belongsToScope(client, ch.account_id, instance.scope_kind, instance.scope_id)) {
    fail('wrong_organization', 'Only members of this instance organization may join.');
  }
  if (instance.status === FORMING) return lobbyProjection(ch, instance, bundle, client, h);
  return {
    instance: {
      id: instance.id, status: instance.status, revision: Number(instance.revision),
    },
  };
}

async function projection(ch, instance, bundle, client, h) {
  const graph = graphOf(bundle);
  const members = await memberRows(client, instance.id);
  const mine = members.find((row) => row.account_id === ch.account_id);
  if (!mine) fail('not_member', 'You are not part of this content instance.');
  if ([FORMING, ACTIVE].includes(instance.status)
    && !await belongsToScope(client, ch.account_id, instance.scope_kind, instance.scope_id)) {
    fail('wrong_organization', 'You no longer belong to this instance organization.');
  }
  const progress = (await client.query(
    `SELECT node_id, state, result_json, revealed_at, completed_at
       FROM content_instance_nodes WHERE instance_id=$1 ORDER BY node_id`, [instance.id],
  )).rows;
  const progressById = new Map(progress.map((row) => [row.node_id, row]));
  const facts = (await client.query(
    'SELECT fact_key, value_json FROM content_instance_facts WHERE instance_id=$1 ORDER BY fact_key',
    [instance.id],
  )).rows.map((row) => ({ key: row.fact_key, value: parseJson(row.value_json, null) }));
  const effects = (await client.query(
    `SELECT subject_account, kind, state, payload_json
       FROM content_instance_effects WHERE instance_id=$1`, [instance.id],
  )).rows;

  const actions = [];
  const quorum = Number(graph.quorum.payload?.minimumParticipants || graph.partyRoles.length);
  const root = graph.nodeById.get(graph.runtime.entryNodeId);
  if (instance.status === FORMING && instance.created_by_account === ch.account_id
    && members.length >= quorum
    && blockedGates(ch, h, root?.payload?.gates, graph, mine.role_id).length === 0) {
    actions.push({ id: actionId(instance, 'start_instance'), kind: 'start_instance' });
  }
  if (instance.status === ACTIVE) {
    for (const nodeId of [...graph.actionIds].sort()) {
      const row = progressById.get(nodeId);
      const node = graph.nodeById.get(nodeId);
      if (row?.state !== 'available'
        || blockedGates(ch, h, node.payload?.gates, graph, mine.role_id).length) continue;
      const action = {
        id: actionId(instance, node.type, nodeId), kind: node.type === 'choice' ? 'choose' : 'solve',
        nodeId, title: node.payload?.title || nodeId, prompt: node.payload?.prompt || null,
      };
      if (node.type === 'choice') {
        action.options = node.payload.options.map((option) => {
          const blockedBy = blockedGates(ch, h, option.gates, graph, mine.role_id);
          return {
            id: option.id, label: option.label,
            available: blockedBy.length === 0, blockedBy,
          };
        });
      }
      actions.push(action);
    }
  }

  const visibleNodes = progress.flatMap((row) => {
    const node = graph.nodeById.get(row.node_id);
    if (!node || node.type === 'answer_spec') return [];
    const result = parseJson(row.result_json, {});
    const safe = {
      id: node.id, type: node.type, state: row.state,
      title: node.payload?.title || null,
    };
    if (node.payload?.prompt && ACTION_TYPES.has(node.type)) safe.prompt = node.payload.prompt;
    if (node.payload?.summary && row.state === COMPLETE) safe.summary = node.payload.summary;
    if (result.choiceId) safe.choiceId = result.choiceId;
    return [safe];
  });
  const ownEffects = effects.filter((effect) => effect.subject_account === ch.account_id)
    .map((effect) => {
      const payload = parseJson(effect.payload_json, {});
      return { kind: effect.kind, state: effect.state, id: payload.id, title: payload.title };
    });
  return {
    instance: {
      id: instance.id, namespace: instance.namespace, version: Number(instance.version),
      contentHash: instance.content_hash, experienceId: instance.experience_id,
      title: root?.payload?.title || instance.experience_id,
      scopeKind: instance.scope_kind, status: instance.status,
      runKey: instance.run_key || 'once',
      revision: Number(instance.revision), leader: instance.created_by_account === ch.account_id,
      members: members.map((row) => projectedMember(row, graph, instance, ch.account_id)),
      nodes: visibleNodes, facts, actions,
      awards: {
        pending: effects.filter((effect) => effect.state === 'pending').length,
        applied: effects.filter((effect) => effect.state === 'applied').length,
        mine: ownEffects,
      },
      createdAt: instance.created_at, startedAt: instance.started_at,
      completedAt: instance.completed_at, formingExpiresAt: instance.forming_expires_at || null,
    },
  };
}

async function assertRevision(ch, instance, expectedRevision, bundle, client, h) {
  if (!Number.isInteger(expectedRevision) || expectedRevision !== Number(instance.revision)) {
    const replacement = await projection(ch, instance, bundle, client, h);
    fail('stale_instance', 'The content instance changed; refresh its issued actions.', replacement);
  }
}

export async function contentBoard(ch, client, h) {
  const activations = (await client.query(
    'SELECT namespace, version, content_hash FROM content_activations ORDER BY namespace',
  )).rows;
  const experiences = [];
  for (const active of activations) {
    const bundle = await loadBundle(client, active.namespace, Number(active.version), active.content_hash);
    if (!bundle.runtime) continue;
    const graph = graphOf(bundle);
    const root = graph.nodeById.get(graph.runtime.entryNodeId);
    const location = locationRequiredBy(root, graph);
    const blockedBy = blockedGates(ch, h, root?.payload?.gates, graph);
    const phaseGate = (root?.payload?.gates || []).find((gate) => gate.kind === 'season_phase_is');
    experiences.push({
      namespace: bundle.namespace, version: Number(bundle.version), contentHash: bundle.contentHash,
      experienceId: graph.runtime.experienceId, title: root?.payload?.title || graph.runtime.experienceId,
      runPolicy: runPolicyOf(graph), runKey: runKeyOf(graph),
      location, availableHere: !location || ch.loc === location.districtId,
      eligible: blockedBy.length === 0, blockedBy,
      season: phaseGate ? {
        index: seasonIdxOf(), current: seasonPhaseOf().id, required: phaseGate.phaseId,
        daysUntilChange: seasonPhaseLeft(),
      } : null,
      systems: Array.isArray(root?.payload?.systems) ? [...root.payload.systems] : [],
      scopes: [...(graph.policy.payload?.organizationScopes || [])],
      roles: graph.partyRoles.map((id) => {
        const role = graph.nodeById.get(id);
        return {
          id, title: role?.payload?.title || id,
          participantKinds: [...(role?.payload?.participantKinds || [])],
          consentRequired: role?.payload?.consentRequired === true,
        };
      }),
    });
  }
  const rows = (await client.query(
    `SELECT ci.* FROM content_instances ci
       JOIN content_instance_members cm ON cm.instance_id=ci.id
      WHERE cm.account_id=$1 ORDER BY ci.created_at DESC`, [ch.account_id],
  )).rows;
  const instances = [];
  for (const stored of rows) {
    const row = visibleInstance(stored);
    if ([FORMING, ACTIVE].includes(row.status)
      && !await belongsToScope(client, ch.account_id, row.scope_kind, row.scope_id)) continue;
    const bundle = await loadBundle(client, row.namespace, Number(row.version), row.content_hash);
    instances.push((await projection(ch, row, bundle, client, h)).instance);
  }

  const scopes = [{ kind: 'personal', id: ch.id }];
  const crew = (await client.query(
    'SELECT crew_id FROM crew_members WHERE account_id=$1', [ch.account_id],
  )).rows[0];
  if (crew) scopes.push({ kind: 'crew', id: crew.crew_id });
  const families = (await client.query(
    `SELECT gm.gang_id FROM characters c JOIN gang_members gm ON gm.character_id=c.id
      WHERE c.account_id=$1 AND c.alive ORDER BY gm.gang_id`, [ch.account_id],
  )).rows;
  for (const family of families) scopes.push({ kind: 'extended_family', id: family.gang_id });

  const lobbies = [];
  const memberInstanceIds = new Set(rows.map((row) => row.id));
  for (const scope of scopes) {
    const open = (await client.query(
      `SELECT * FROM content_instances
        WHERE status=$1 AND scope_kind=$2 AND scope_id=$3
          AND (forming_expires_at IS NULL OR forming_expires_at > now())
        ORDER BY created_at DESC`,
      [FORMING, scope.kind, scope.id],
    )).rows;
    for (const row of open) {
      if (memberInstanceIds.has(row.id)) continue;
      const bundle = await loadBundle(client, row.namespace, Number(row.version), row.content_hash);
      lobbies.push((await lobbyProjection(ch, row, bundle, client, h)).instance);
    }
  }
  const storyFlags = (await client.query(
    `SELECT flag_key, flag_kind, flag_value, title, recorded_at
       FROM content_story_flags WHERE account_id=$1 ORDER BY flag_key`, [ch.account_id],
  )).rows.map((row) => ({
    key: row.flag_key, kind: row.flag_kind, value: row.flag_value,
    title: row.title, recordedAt: row.recorded_at,
  }));
  return { experiences, lobbies, instances, storyFlags };
}

export async function createContentInstance(ch, namespace, opts, client, h) {
  await expireFormingContentInstances(client);
  const bundle = await loadActiveBundle(client, namespace);
  if (!bundle.runtime) fail('unsupported_content_feature', 'That active bundle has no narrative runtime.');
  const graph = graphOf(bundle);
  const runKey = runKeyOf(graph);
  const scopeKind = String(opts?.scopeKind || '');
  if (!graph.policy.payload?.organizationScopes?.includes(scopeKind)) {
    fail('wrong_organization', 'That organization scope is not allowed for this experience.');
  }
  const scopeId = await scopeIdFor(ch, scopeKind, client);
  assertNodeGates(ch, h, graph.nodeById.get(graph.runtime.entryNodeId), graph);
  const role = roleOf(graph, String(opts?.roleId || ''));
  const kind = participantKind(h.acct);
  assertRoleEligible(role, kind);
  if (role.payload?.consentRequired && opts?.consent !== true) {
    fail('consent_required', 'This role requires your affirmative consent.');
  }
  const existing = (await client.query(
    `SELECT id, status FROM content_instances
      WHERE namespace=$1 AND version=$2 AND experience_id=$3 AND scope_kind=$4 AND scope_id=$5
        AND run_key=$6 AND status <> 'abandoned'`,
    [bundle.namespace, bundle.version, graph.runtime.experienceId, scopeKind, scopeId, runKey],
  )).rows[0];
  if (existing) fail(existing.status === COMPLETE ? 'already_complete' : 'already',
    existing.status === COMPLETE ? 'This organization already completed that exact experience.'
      : 'This organization already has that exact experience open.');

  const instanceId = crypto.randomUUID();
  await client.query(
    `INSERT INTO content_instances
       (id, namespace, version, content_hash, experience_id, root_node_id,
        scope_kind, scope_id, run_key, created_by_account, forming_expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [instanceId, bundle.namespace, bundle.version, bundle.contentHash, graph.runtime.experienceId,
      graph.runtime.entryNodeId, scopeKind, scopeId, runKey, ch.account_id,
      new Date(Date.now() + CONTENT_FORMING_TTL_MS)],
  );
  await client.query(
    `INSERT INTO content_instance_members
       (instance_id, account_id, joined_character_id, name_snapshot, participant_kind, role_id, consent_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [instanceId, ch.account_id, ch.id, ch.name, kind, role.id,
      opts?.consent === true ? new Date() : null],
  );
  const instance = (await client.query('SELECT * FROM content_instances WHERE id=$1', [instanceId])).rows[0];
  return projection(ch, instance, bundle, client, h);
}

export async function contentInstanceBoard(ch, instanceId, client, h) {
  const stored = (await client.query('SELECT * FROM content_instances WHERE id=$1', [instanceId])).rows[0];
  const instance = visibleInstance(stored);
  if (!instance) fail('no_content_instance', 'No such authored-content instance.');
  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);
  const member = (await client.query(
    'SELECT 1 FROM content_instance_members WHERE instance_id=$1 AND account_id=$2',
    [instanceId, ch.account_id],
  )).rows[0];
  return member ? projection(ch, instance, bundle, client, h)
    : lobbyProjection(ch, instance, bundle, client, h);
}

export async function joinContentInstance(ch, instanceId, opts, client, h) {
  const instance = await lockedInstance(client, instanceId);
  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);
  if (!Number.isInteger(opts?.expectedRevision)
    || opts.expectedRevision !== Number(instance.revision)) {
    const replacement = await joinReplacementProjection(ch, instance, bundle, client, h);
    fail('stale_instance', 'The content instance changed; refresh its open roles.', replacement);
  }
  if (instance.status !== FORMING) fail('already_complete', 'Roles are locked after an instance starts.');
  if (!await belongsToScope(client, ch.account_id, instance.scope_kind, instance.scope_id)) {
    fail('wrong_organization', 'Only members of this instance organization may join.');
  }
  const graph = graphOf(bundle);
  const role = roleOf(graph, String(opts?.roleId || ''));
  const kind = participantKind(h.acct);
  assertRoleEligible(role, kind);
  if (role.payload?.consentRequired && opts?.consent !== true) {
    fail('consent_required', 'This role requires your affirmative consent.');
  }
  if ((await client.query(
    'SELECT 1 FROM content_instance_members WHERE instance_id=$1 AND account_id=$2',
    [instanceId, ch.account_id],
  )).rows[0]) fail('bad_role', 'This account already occupies a role in the instance.');
  if ((await client.query(
    'SELECT 1 FROM content_instance_members WHERE instance_id=$1 AND role_id=$2',
    [instanceId, role.id],
  )).rows[0]) fail('role_taken', 'That role is already occupied.');
  await client.query(
    `INSERT INTO content_instance_members
       (instance_id, account_id, joined_character_id, name_snapshot, participant_kind, role_id, consent_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [instanceId, ch.account_id, ch.id, ch.name, kind, role.id,
      opts?.consent === true ? new Date() : null],
  );
  await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);
  const next = (await client.query('SELECT * FROM content_instances WHERE id=$1', [instanceId])).rows[0];
  return projection(ch, next, bundle, client, h);
}

export async function setContentConsent(ch, instanceId, opts, client, h) {
  const instance = await lockedInstance(client, instanceId);
  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);
  await assertRevision(ch, instance, opts?.expectedRevision, bundle, client, h);
  const member = (await client.query(
    'SELECT * FROM content_instance_members WHERE instance_id=$1 AND account_id=$2',
    [instanceId, ch.account_id],
  )).rows[0];
  if (!member) fail('not_member', 'You are not part of this content instance.');
  const graph = graphOf(bundle);
  if (roleOf(graph, member.role_id).payload?.consentRequired !== true) {
    fail('consent_not_required', 'This role does not use the consent control.');
  }
  if (!await belongsToScope(client, ch.account_id, instance.scope_kind, instance.scope_id)) {
    fail('wrong_organization', 'You no longer belong to this instance organization.');
  }
  const consent = opts?.consent === true;
  const already = consent ? (!!member.consent_at && !member.consent_revoked_at)
    : (!!member.consent_revoked_at || !member.consent_at);
  if (!already) {
    if (consent) {
      await client.query(
        `UPDATE content_instance_members
            SET consent_at=now(), consent_revoked_at=NULL
          WHERE instance_id=$1 AND account_id=$2`, [instanceId, ch.account_id],
      );
    } else {
      await client.query(
        `UPDATE content_instance_members SET consent_revoked_at=now()
          WHERE instance_id=$1 AND account_id=$2`, [instanceId, ch.account_id],
      );
    }
    await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);
  }
  const next = (await client.query('SELECT * FROM content_instances WHERE id=$1', [instanceId])).rows[0];
  return projection(ch, next, bundle, client, h);
}

async function validateCurrentPartyAuthority(client, graph, instance, { requireQuorum = false } = {}) {
  const members = await memberRows(client, instance.id);
  const minimum = Number(graph.quorum.payload?.minimumParticipants || graph.partyRoles.length);
  if (requireQuorum
    && (members.length < minimum
      || graph.partyRoles.some((role) => !members.some((member) => member.role_id === role)))) {
    fail('quorum', 'Every required seat must be filled before the instance starts.');
  }
  const currentKinds = new Map();
  for (const member of members) {
    if (!await belongsToScope(client, member.account_id, instance.scope_kind, instance.scope_id)) {
      fail('wrong_organization', 'Every participant must still belong to the instance organization.');
    }
    const acct = (await client.query(
      'SELECT agent_flag, npc_flag FROM account_persistent WHERE account_id=$1', [member.account_id],
    )).rows[0];
    const kind = participantKind(acct);
    currentKinds.set(member.account_id, kind);
    const role = roleOf(graph, member.role_id);
    assertRoleEligible(role, kind);
    if (role.payload?.consentRequired && (!member.consent_at || member.consent_revoked_at)) {
      fail('consent_required', 'Every consent-required role must affirm before play continues.');
    }
  }
  for (const collaboration of [...graph.nodeById.values()]
    .filter((node) => node.type === 'human_agent_collaboration')) {
    const roles = new Set((graph.outgoing.get(collaboration.id) || [])
      .filter((edge) => edge.type === 'PERFORMED_BY_ROLE').map((edge) => edge.to));
    const participants = members.filter((member) => roles.has(member.role_id));
    const hasAgent = participants.some((member) => currentKinds.get(member.account_id) === 'agent');
    const hasHuman = participants.some((member) => (
      currentKinds.get(member.account_id) === 'human_eligible_non_agent'
    ));
    if (!hasAgent || !hasHuman) {
      fail('participant_mix', 'This collaboration requires distinct agent and human participants.');
    }
  }
  return members;
}

async function completeNode(client, instanceId, nodeId, actor, result = {}) {
  const row = (await client.query(
    'SELECT state FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2', [instanceId, nodeId],
  )).rows[0];
  if (row?.state === COMPLETE) return false;
  if (row) {
    await client.query(
      `UPDATE content_instance_nodes
          SET state='completed', actor_account=$3, actor_character_id=$4,
              result_json=$5, completed_at=now(), revealed_at=COALESCE(revealed_at,now())
        WHERE instance_id=$1 AND node_id=$2`,
      [instanceId, nodeId, actor?.accountId || null, actor?.characterId || null, JSON.stringify(result)],
    );
  } else {
    await client.query(
      `INSERT INTO content_instance_nodes
         (instance_id, node_id, state, actor_account, actor_character_id,
          result_json, revealed_at, completed_at)
       VALUES ($1,$2,'completed',$3,$4,$5,now(),now())`,
      [instanceId, nodeId, actor?.accountId || null, actor?.characterId || null, JSON.stringify(result)],
    );
  }
  return true;
}

async function makeAvailable(client, instanceId, nodeId) {
  const row = (await client.query(
    'SELECT state FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2', [instanceId, nodeId],
  )).rows[0];
  if (row) return false;
  await client.query(
    `INSERT INTO content_instance_nodes (instance_id, node_id, state, revealed_at)
     VALUES ($1,$2,'available',now()) ON CONFLICT DO NOTHING`, [instanceId, nodeId],
  );
  return true;
}

async function materializeTerminalEffects(client, graph, instance, terminalNode) {
  const members = await validateCurrentPartyAuthority(client, graph, instance);
  const effects = terminalNode.payload?.effects || [];
  for (let ordinal = 0; ordinal < effects.length; ordinal++) {
    const effect = effects[ordinal];
    const refId = effect.statusId || effect.collectibleId;
    const definition = graph.nodeById.get(refId);
    const targetId = entitlementTargetId(graph, instance, refId);
    for (const member of members) {
      await client.query(
        `INSERT INTO content_instance_effects
           (instance_id, node_id, effect_ordinal, subject_account, kind, target_id, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [instance.id, terminalNode.id, ordinal, member.account_id, effect.kind, targetId,
          JSON.stringify({ id: refId, title: definition?.payload?.title || refId })],
      );
    }
  }
}

async function cascade(client, graph, instance, actor = null) {
  let changed = true;
  while (changed) {
    changed = false;
    const completed = new Set((await client.query(
      `SELECT node_id FROM content_instance_nodes
        WHERE instance_id=$1 AND state='completed'`, [instance.id],
    )).rows.map((row) => row.node_id));

    for (const nodeId of [...graph.nodeById.keys()].sort()) {
      if (completed.has(nodeId)) continue;
      const node = graph.nodeById.get(nodeId);
      const incoming = graph.incoming.get(nodeId) || [];
      const unlocks = incoming.filter((edge) => edge.type === 'UNLOCKS');
      if (unlocks.length && unlocks.every((edge) => completed.has(edge.from))) {
        if (graph.actionIds.has(nodeId)) changed = await makeAvailable(client, instance.id, nodeId) || changed;
        else if (PASSIVE_UNLOCK_TYPES.has(node.type)) {
          const landed = await completeNode(client, instance.id, nodeId, actor);
          changed = landed || changed;
          if (landed && node.type === 'terminal') {
            await materializeTerminalEffects(client, graph, instance, node);
            await client.query(
              `UPDATE content_instances SET status='completed', completed_at=now()
                WHERE id=$1 AND status <> 'completed'`, [instance.id],
            );
            instance.status = COMPLETE;
          }
        }
      }

      const revealers = incoming.filter((edge) => edge.type === 'REVEALS');
      if (!completed.has(nodeId) && revealers.some((edge) => completed.has(edge.from))
        && ['evidence', 'world_fact'].includes(node.type)) {
        const landed = await completeNode(client, instance.id, nodeId, actor);
        changed = landed || changed;
        if (landed && node.type === 'world_fact') {
          await client.query(
            `INSERT INTO content_instance_facts
               (instance_id, fact_key, value_json, set_by_node_id)
             VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [instance.id, node.payload.key, JSON.stringify(node.payload.value ?? true), node.id],
          );
        }
      }

      const contributions = incoming.filter((edge) => edge.type === 'CONTRIBUTES_TO');
      if (!completed.has(nodeId) && contributions.length
        && contributions.every((edge) => completed.has(edge.from))) {
        changed = await completeNode(client, instance.id, nodeId, actor) || changed;
      }

      const rewarders = incoming.filter((edge) => edge.type === 'REWARDS');
      if (!completed.has(nodeId) && rewarders.some((edge) => completed.has(edge.from))
        && node.type === 'reward_bundle') {
        changed = await completeNode(client, instance.id, nodeId, actor) || changed;
      }
    }
  }
}

async function validatePartyForStart(client, graph, instance) {
  await validateCurrentPartyAuthority(client, graph, instance, { requireQuorum: true });
}

async function recordStoryFlags(client, graph, instance, ch, choiceNode, choice) {
  for (const flagId of choice.storyFlagIds || []) {
    const flagNode = graph.nodeById.get(flagId);
    const flag = flagNode.payload;
    const inserted = await client.query(
      `INSERT INTO content_story_flags
         (account_id, flag_key, flag_kind, flag_value, title,
          source_namespace, source_version, source_instance_id, source_node_id, source_choice_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (account_id, flag_key) DO NOTHING
       RETURNING flag_key`,
      [ch.account_id, flag.key, flag.kind, flag.value, flag.title,
        graph.bundle.namespace, graph.bundle.version, instance.id, choiceNode.id, choice.id],
    );
    if (inserted.rowCount) continue;
    const existing = (await client.query(
      `SELECT flag_kind, flag_value FROM content_story_flags
        WHERE account_id=$1 AND flag_key=$2`, [ch.account_id, flag.key],
    )).rows[0];
    if (!existing || existing.flag_kind !== flag.kind || existing.flag_value !== flag.value) {
      fail('story_flag_conflict', 'That lasting story decision was already recorded differently.');
    }
  }
}

export async function actOnContentInstance(ch, instanceId, opts, client, h) {
  const instance = await lockedInstance(client, instanceId);
  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);
  const graph = graphOf(bundle);
  await assertRevision(ch, instance, opts?.expectedRevision, bundle, client, h);
  const member = (await client.query(
    'SELECT * FROM content_instance_members WHERE instance_id=$1 AND account_id=$2',
    [instanceId, ch.account_id],
  )).rows[0];
  if (!member) fail('not_member', 'You are not part of this content instance.');

  const startId = actionId(instance, 'start_instance');
  if (!await belongsToScope(client, ch.account_id, instance.scope_kind, instance.scope_id)) {
    fail('wrong_organization', 'You no longer belong to this instance organization.');
  }
  if (opts?.actionId === startId) {
    if (instance.status !== FORMING) fail('already_complete', 'This instance has already started.');
    if (instance.created_by_account !== ch.account_id) fail('not_leader', 'Only the lobby creator may start it.');
    assertNodeGates(ch, h, graph.nodeById.get(graph.runtime.entryNodeId), graph, member.role_id);
    await validatePartyForStart(client, graph, instance);
    await client.query(
      `UPDATE content_instances
          SET status='active', started_at=now(), forming_expires_at=NULL
        WHERE id=$1`, [instanceId],
    );
    instance.status = ACTIVE;
    instance.forming_expires_at = null;
    await completeNode(client, instanceId, graph.runtime.entryNodeId,
      { accountId: ch.account_id, characterId: ch.id });
    await cascade(client, graph, instance, { accountId: ch.account_id, characterId: ch.id });
  } else {
    if (instance.status !== ACTIVE) fail('unknown_action', 'That action is not currently issued.');
    await validateCurrentPartyAuthority(client, graph, instance);
    let selected = null;
    for (const nodeId of graph.runtime.actionNodeIds) {
      const node = graph.nodeById.get(nodeId);
      if (opts?.actionId === actionId(instance, node.type, nodeId)) { selected = node; break; }
    }
    if (!selected) fail('unknown_action', 'That action was not issued for this instance revision.');
    const progress = (await client.query(
      'SELECT state FROM content_instance_nodes WHERE instance_id=$1 AND node_id=$2',
      [instanceId, selected.id],
    )).rows[0];
    if (progress?.state !== 'available') fail('unknown_action', 'That node is not currently actionable.');
    assertNodeGates(ch, h, selected, graph, member.role_id);
    let result;
    if (selected.type === 'puzzle') {
      const spec = graph.nodeById.get(selected.payload.answerSpecId);
      const answer = normalizeAnswer(opts?.answer);
      if (!spec?.payload?.acceptedValues?.includes(answer)) fail('wrong_answer', 'That answer does not fit the evidence.');
      result = { matched: true };
    } else if (selected.type === 'choice') {
      const choice = selected.payload.options.find((option) => option.id === opts?.choiceId);
      if (!choice) fail('unknown_action', 'That choice was not offered.');
      assertNodeGates(ch, h, { payload: { gates: choice.gates || [] } }, graph, member.role_id,
        { option: true });
      await recordStoryFlags(client, graph, instance, ch, selected, choice);
      result = { choiceId: choice.id };
    } else fail('unknown_action', 'That node is not executable.');
    await completeNode(client, instanceId, selected.id,
      { accountId: ch.account_id, characterId: ch.id }, result);
    await cascade(client, graph, instance, { accountId: ch.account_id, characterId: ch.id });
  }
  await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);
  const next = (await client.query('SELECT * FROM content_instances WHERE id=$1', [instanceId])).rows[0];
  return projection(ch, next, bundle, client, h);
}

export async function leaveContentInstance(ch, instanceId, opts, client, h) {
  const instance = await lockedInstance(client, instanceId);
  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);
  await assertRevision(ch, instance, opts?.expectedRevision, bundle, client, h);
  const member = (await client.query(
    'SELECT 1 FROM content_instance_members WHERE instance_id=$1 AND account_id=$2',
    [instanceId, ch.account_id],
  )).rows[0];
  if (!member) fail('not_member', 'You are not part of this content instance.');
  if (instance.status !== FORMING) fail('already_complete', 'Roles cannot change after an instance starts.');
  if (instance.created_by_account === ch.account_id) {
    await client.query(
      `UPDATE content_instances SET status='abandoned', revision=revision+1 WHERE id=$1`, [instanceId],
    );
    return { ok: true, left: true, instance: {
      id: instanceId, status: 'abandoned', revision: Number(instance.revision) + 1,
    } };
  }
  await client.query(
    'DELETE FROM content_instance_members WHERE instance_id=$1 AND account_id=$2',
    [instanceId, ch.account_id],
  );
  await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);
  return { ok: true, left: true, instance: {
    id: instanceId, status: FORMING, revision: Number(instance.revision) + 1,
  } };
}

export async function claimContentRewards(ch, instanceId, opts, client, h) {
  const instance = await lockedInstance(client, instanceId);
  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);
  await assertRevision(ch, instance, opts?.expectedRevision, bundle, client, h);
  if (instance.status !== COMPLETE) fail('nothing_to_claim', 'This experience has no completed rewards to claim.');
  if (!(await client.query(
    'SELECT 1 FROM content_instance_members WHERE instance_id=$1 AND account_id=$2',
    [instanceId, ch.account_id],
  )).rows[0]) fail('not_member', 'You are not part of this content instance.');
  const pending = (await client.query(
    `SELECT node_id, effect_ordinal, kind, payload_json
       FROM content_instance_effects
      WHERE instance_id=$1 AND subject_account=$2 AND state='pending'
      ORDER BY node_id, effect_ordinal`, [instanceId, ch.account_id],
  )).rows;
  if (!pending.length) fail('nothing_to_claim', 'You already claimed every authored-content reward.');
  const claimed = [];
  for (const effect of pending) {
    const payload = parseJson(effect.payload_json, {});
    if (effect.kind === 'award_status') ch.title = payload.title;
    else if (effect.kind !== 'award_collectible') {
      fail('unsupported_content_feature', 'This content effect has no safe claim adapter.');
    }
    const applied = await client.query(
      `UPDATE content_instance_effects SET state='applied', applied_at=now()
        WHERE instance_id=$1 AND node_id=$2 AND effect_ordinal=$3
          AND subject_account=$4 AND state='pending'`,
      [instanceId, effect.node_id, effect.effect_ordinal, ch.account_id],
    );
    if (applied.rowCount) claimed.push({ kind: effect.kind, id: payload.id, title: payload.title });
  }
  await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);
  const next = (await client.query('SELECT * FROM content_instances WHERE id=$1', [instanceId])).rows[0];
  const out = await projection(ch, next, bundle, client, h);
  return { ...out, ok: true, claimed };
}
