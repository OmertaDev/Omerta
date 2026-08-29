import crypto from 'node:crypto';
import { HONOR, MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD } from '../rules.js';

export const NODE_TYPES = Object.freeze([
  'mystery', 'chapter', 'puzzle', 'choice', 'terminal', 'evidence', 'answer_spec',
  'party_policy', 'role', 'quorum', 'organization_gate', 'contribution',
  'location', 'npc', 'world_fact', 'season_overlay', 'event_window',
  'story_flag',
  'item_def', 'recipe', 'work_order', 'source', 'sink', 'tool', 'facility', 'skill_track',
  'reward_bundle', 'status', 'collectible_def', 'funded_omr_allocation',
  'budget', 'scarcity_cap', 'activation', 'supersession',
  'public_hook', 'shareable_artifact', 'acquisition_campaign', 'referral_entry',
  'newcomer_activation', 'human_agent_collaboration', 'retention_checkpoint',
  'agent_recruitment_reward', 'growth_exemption',
]);
export const EDGE_TYPES = Object.freeze([
  'REQUIRES', 'UNLOCKS', 'REVEALS', 'CONSUMES', 'PRODUCES', 'TRAINS', 'USES_TOOL',
  'SOURCED_FROM', 'SINKS_TO', 'PERFORMED_BY_ROLE', 'REQUIRES_ORG_SCOPE',
  'REQUIRES_WORLD_FACT', 'CONTRIBUTES_TO', 'ALTERNATIVE_TO', 'EXCLUDES',
  'REWARDS', 'EXPORTS_AS', 'OVERLAID_BY_SEASON', 'SUPERSEDES',
  'ATTRACTS_TO', 'ATTRIBUTED_TO', 'ACTIVATES', 'COLLABORATES_WITH',
  'RETURNS_FOR', 'QUALIFIES_RECRUIT', 'REWARDS_RECRUITER',
]);
export const GATE_KINDS = Object.freeze([
  'level_at_least', 'stat_at_least', 'mastery_at_least', 'path_is', 'skill_owned',
  'discipline_at_least', 'honor_at_least', 'honor_at_most', 'underworld_standing_at_least', 'owns_item',
  'season_phase_is',
  'item_quality_at_least', 'at_location', 'completed_node', 'world_fact',
  'family_rank', 'family_post', 'crew_membership', 'coalition_membership',
  'party_role', 'unique_participants', 'unique_families', 'availability_window',
  'recruit_eligibility', 'meaningful_activation', 'meaningful_collaboration',
  'retention_checkpoint',
]);
export const EFFECT_KINDS = Object.freeze([
  'grant_evidence', 'reveal_node', 'record_contribution', 'reserve_item',
  'consume_item', 'produce_item', 'damage_item', 'set_progress_fact',
  'set_world_fact', 'award_status', 'award_collectible',
  'enqueue_omr_allocation_transfer', 'enqueue_agent_referral_cash',
]);
export const RUNTIME_NODE_TYPES = Object.freeze([
  'mystery', 'party_policy', 'quorum', 'role', 'chapter', 'puzzle', 'answer_spec',
  'choice', 'evidence', 'human_agent_collaboration', 'world_fact', 'reward_bundle',
  'terminal', 'status', 'collectible_def', 'location',
  'story_flag',
]);
export const RUNTIME_EDGE_TYPES = Object.freeze([
  'REQUIRES', 'UNLOCKS', 'REVEALS', 'CONTRIBUTES_TO', 'REWARDS', 'PERFORMED_BY_ROLE',
]);
export const RUNTIME_GATE_KINDS = Object.freeze([
  'party_role', 'at_location', 'level_at_least', 'mastery_at_least', 'path_is',
  'skill_owned', 'discipline_at_least', 'honor_at_least', 'honor_at_most',
  'underworld_standing_at_least', 'crew_membership', 'season_phase_is',
]);
export const RUNTIME_STORY_FLAG_KINDS = Object.freeze([
  'npc_ally', 'npc_grudge', 'district_contact', 'witness_spared', 'family_debt',
  'case_evidence', 'public_reputation', 'future_scene_variant',
]);
export const RUNTIME_EFFECT_KINDS = Object.freeze(['award_status', 'award_collectible']);
export const RUNTIME_ANSWER_VERIFIERS = Object.freeze(['normalized_exact']);
export const CRAFTING_NODE_TYPES = Object.freeze([
  'location', 'budget', 'source', 'item_def', 'recipe', 'work_order', 'skill_track', 'sink',
  'tool', 'facility',
]);
export const CRAFTING_EDGE_TYPES = Object.freeze([
  'REQUIRES', 'PRODUCES', 'CONSUMES', 'TRAINS', 'SINKS_TO', 'USES_TOOL',
]);
export const CRAFTING_GATE_KINDS = Object.freeze([
  'at_location', 'level_at_least', 'mastery_at_least', 'path_is', 'skill_owned',
  'discipline_at_least', 'honor_at_least', 'honor_at_most',
  'underworld_standing_at_least', 'crew_membership',
]);
export const GROWTH_ROLES = Object.freeze([
  'internal_only', 'shareable_story', 'referral_entry', 'human_activation',
  'human_collaboration', 'human_retention', 'advocacy',
]);
const RAW_RECRUITMENT_SIGNALS = new Set([
  'click', 'impression', 'post', 'signup', 'wallet_link', 'elapsed_time',
]);
const AGENT_CASH_MILESTONES = new Set([
  'qualified_activation', 'retained_collaborator',
]);
const AGENT_CASH_LEDGER_REASONS = Object.freeze({
  qualified_activation: 'referral:agent_qualified',
  retained_collaborator: 'referral:agent_retained',
});
const RECRUITMENT_GROWTH_ROLES = new Set([
  'referral_entry', 'human_activation', 'human_collaboration', 'human_retention', 'advocacy',
]);

const ownKeysAre = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every((key) => allowed.has(key));
const uniqueStrings = (values) => Array.isArray(values) && values.length > 0
  && values.every((value) => typeof value === 'string' && value.trim())
  && new Set(values).size === values.length;
const stableId = (value) => typeof value === 'string'
  && /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value);

function validateRuntimeGate(gate, { owner, nodeById, profileIds, temporal = false }) {
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)
    || !RUNTIME_GATE_KINDS.includes(gate.kind)) {
    throw new Error(`${owner} has unsupported gate ${gate?.kind}`);
  }
  if (gate.kind === 'party_role') {
    if (!ownKeysAre(gate, new Set(['kind', 'role']))) throw new Error(`${owner} party_role has unknown fields`);
    const role = nodeById.get(gate.role);
    if (!role) throw new Error(`${owner} party_role ${gate.role} references a missing node`);
    if (role.type !== 'role') throw new Error(`${owner} party_role ${gate.role} must reference role`);
    if (!profileIds.has(role.id)) throw new Error(`${owner} party_role ${gate.role} is outside nodeIds`);
    return;
  }
  if (gate.kind === 'at_location') {
    if (!ownKeysAre(gate, new Set(['kind', 'locationId']))) throw new Error(`${owner} at_location has unknown fields`);
    const location = nodeById.get(gate.locationId);
    if (!location) throw new Error(`${owner} at_location ${gate.locationId} references a missing node`);
    if (location.type !== 'location') throw new Error(`${owner} at_location ${gate.locationId} must reference location`);
    if (!profileIds.has(location.id)) throw new Error(`${owner} at_location ${gate.locationId} is outside nodeIds`);
    if (typeof location.payload?.districtId !== 'string' || !location.payload.districtId.trim()) {
      throw new Error(`runtime location ${location.id} requires districtId`);
    }
    return;
  }
  if (gate.kind === 'level_at_least') {
    if (!ownKeysAre(gate, new Set(['kind', 'level']))
      || !Number.isInteger(gate.level) || gate.level < 1) {
      throw new Error(`${owner} level_at_least requires a positive integer level`);
    }
    return;
  }
  if (gate.kind === 'mastery_at_least') {
    const track = MASTERY.TRACKS.find((item) => item.id === gate.trackId);
    if (!ownKeysAre(gate, new Set(['kind', 'trackId', 'level']))) throw new Error(`${owner} mastery_at_least has unknown fields`);
    if (!track) throw new Error(`${owner} mastery_at_least has unknown track ${gate.trackId}`);
    if (!Number.isInteger(gate.level) || gate.level < 1 || gate.level > MASTERY.MAX_LVL) {
      throw new Error(`${owner} mastery_at_least requires level 1-${MASTERY.MAX_LVL}`);
    }
    return;
  }
  if (gate.kind === 'path_is') {
    if (!ownKeysAre(gate, new Set(['kind', 'pathId']))) throw new Error(`${owner} path_is has unknown fields`);
    if (!PATHS.some((path) => path.id === gate.pathId)) {
      throw new Error(`${owner} path_is has unknown path ${gate.pathId}`);
    }
    return;
  }
  if (gate.kind === 'skill_owned') {
    if (!ownKeysAre(gate, new Set(['kind', 'skillId']))) throw new Error(`${owner} skill_owned has unknown fields`);
    if (!SKILLS.TREE.some((skill) => skill.id === gate.skillId)) {
      throw new Error(`${owner} skill_owned has unknown skill ${gate.skillId}`);
    }
    return;
  }
  if (gate.kind === 'discipline_at_least') {
    if (!ownKeysAre(gate, new Set(['kind', 'disciplineId', 'level']))) {
      throw new Error(`${owner} discipline_at_least has unknown fields`);
    }
    if (!REGIMEN.DISCIPLINES.some((discipline) => discipline.id === gate.disciplineId)) {
      throw new Error(`${owner} discipline_at_least has unknown discipline ${gate.disciplineId}`);
    }
    if (!Number.isInteger(gate.level) || gate.level < 1 || gate.level > REGIMEN.CAP) {
      throw new Error(`${owner} discipline_at_least requires level 1-${REGIMEN.CAP}`);
    }
    return;
  }
  if (gate.kind === 'honor_at_least' || gate.kind === 'honor_at_most') {
    if (!ownKeysAre(gate, new Set(['kind', 'honor']))) throw new Error(`${owner} ${gate.kind} has unknown fields`);
    if (!Number.isInteger(gate.honor) || gate.honor < HONOR.MIN || gate.honor > HONOR.MAX) {
      throw new Error(`${owner} ${gate.kind} requires integer honor ${HONOR.MIN}-${HONOR.MAX}`);
    }
    return;
  }
  if (gate.kind === 'underworld_standing_at_least') {
    if (!ownKeysAre(gate, new Set(['kind', 'npcId', 'standing']))) {
      throw new Error(`${owner} underworld_standing_at_least has unknown fields`);
    }
    if (!UNDERWORLD.NPCS.some((npc) => npc.id === gate.npcId)) {
      throw new Error(`${owner} underworld_standing_at_least has unknown NPC ${gate.npcId}`);
    }
    if (!Number.isInteger(gate.standing) || gate.standing < 0 || gate.standing > 100) {
      throw new Error(`${owner} underworld_standing_at_least requires standing 0-100`);
    }
    return;
  }
  if (gate.kind === 'season_phase_is') {
    if (!temporal) throw new Error(`${owner} season_phase_is is allowed only on the runtime entry node`);
    if (!ownKeysAre(gate, new Set(['kind', 'phaseId']))) {
      throw new Error(`${owner} season_phase_is has unknown fields`);
    }
    if (!SEASON_PHASES.some((phase) => phase.id === gate.phaseId)) {
      throw new Error(`${owner} season_phase_is has unknown phase ${gate.phaseId}`);
    }
    return;
  }
  if (!ownKeysAre(gate, new Set(['kind']))) throw new Error(`${owner} crew_membership has unknown fields`);
}

// Runtime validation is intentionally separate from compilation. The compiler accepts the broad,
// future-facing authoring ontology above; an operator may activate only the explicit closure named by
// this narrower capability profile. Nodes outside runtime.nodeIds stay inert authored metadata.
export function validateRuntimeContentPack(bundle) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new Error('runtime content pack must be an object');
  }
  const runtime = bundle.runtime;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    throw new Error('runtime manifest is required');
  }
  const runtimeFields = new Set([
    'experienceId', 'entryNodeId', 'partyPolicyId', 'quorumId', 'terminalNodeId',
    'nodeIds', 'actionNodeIds', 'runPolicy',
  ]);
  if (!ownKeysAre(runtime, runtimeFields)) throw new Error('runtime manifest has unknown fields');
  if (runtime.runPolicy !== undefined
    && !['once', 'once_per_season'].includes(runtime.runPolicy)) {
    throw new Error('runtime runPolicy must be once or once_per_season');
  }

  const nodes = Array.isArray(bundle.nodes) ? bundle.nodes : [];
  const edges = Array.isArray(bundle.edges) ? bundle.edges : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const typedRef = (field, expectedType) => {
    const id = runtime[field];
    if (typeof id !== 'string' || !id.trim()) throw new Error(`runtime ${field} is required`);
    const node = nodeById.get(id);
    if (!node) throw new Error(`runtime ${field} ${id} references a missing node`);
    if (node.type !== expectedType) throw new Error(`runtime ${field} ${id} must reference ${expectedType}`);
    return node;
  };

  typedRef('experienceId', 'mystery');
  typedRef('entryNodeId', 'mystery');
  const policy = typedRef('partyPolicyId', 'party_policy');
  const quorum = typedRef('quorumId', 'quorum');
  const terminal = typedRef('terminalNodeId', 'terminal');

  if (!uniqueStrings(runtime.nodeIds)) throw new Error('runtime nodeIds must be a non-empty unique string array');
  if (!Array.isArray(runtime.actionNodeIds)
    || runtime.actionNodeIds.some((id) => typeof id !== 'string' || !id.trim())
    || new Set(runtime.actionNodeIds).size !== runtime.actionNodeIds.length) {
    throw new Error('runtime actionNodeIds must be a unique string array');
  }
  const profileIds = new Set(runtime.nodeIds);
  for (const [field, id] of [
    ['experienceId', runtime.experienceId],
    ['entryNodeId', runtime.entryNodeId],
    ['partyPolicyId', runtime.partyPolicyId],
    ['quorumId', runtime.quorumId],
    ['terminalNodeId', runtime.terminalNodeId],
  ]) {
    if (!profileIds.has(id)) throw new Error(`runtime nodeIds must contain ${field} ${id}`);
  }
  for (const id of runtime.nodeIds) {
    const node = nodeById.get(id);
    if (!node) throw new Error(`runtime nodeIds references missing node ${id}`);
    if (!RUNTIME_NODE_TYPES.includes(node.type)) {
      throw new Error(`runtime node ${id} has unsupported type ${node.type}`);
    }
  }
  for (const id of runtime.actionNodeIds) {
    if (!profileIds.has(id)) throw new Error(`runtime action node ${id} is outside nodeIds`);
    const node = nodeById.get(id);
    if (!node) throw new Error(`runtime action node ${id} references a missing node`);
    if (!['puzzle', 'choice'].includes(node.type)) {
      throw new Error(`runtime action node ${id} must be puzzle or choice`);
    }
  }
  const actionIds = new Set(runtime.actionNodeIds);
  for (const id of runtime.nodeIds) {
    if (['puzzle', 'choice'].includes(nodeById.get(id)?.type) && !actionIds.has(id)) {
      throw new Error(`runtime actionNodeIds must include action node ${id}`);
    }
  }

  const policyPayload = policy.payload ?? {};
  if (!uniqueStrings(policyPayload.organizationScopes)
    || policyPayload.organizationScopes.some((scope) => !['personal', 'crew', 'extended_family'].includes(scope))
    || policyPayload.uniqueParticipants !== true
    || policyPayload.roleLockOnStart !== true
    || policyPayload.recheckConsent !== true) {
    throw new Error(`runtime party policy ${policy.id} must declare supported organization scopes, unique participants, role locking, and consent rechecks`);
  }
  const quorumPayload = quorum.payload ?? {};
  if (!Number.isInteger(quorumPayload.minimumParticipants) || quorumPayload.minimumParticipants < 1
    || quorumPayload.uniqueParticipants !== true
    || !Number.isInteger(quorumPayload.minimumOrganizations) || quorumPayload.minimumOrganizations < 1) {
    throw new Error(`runtime quorum ${quorum.id} must declare positive participant/organization counts and unique participants`);
  }

  const supportedNodes = new Set(RUNTIME_NODE_TYPES);
  const supportedGates = new Set(RUNTIME_GATE_KINDS);
  const supportedEffects = new Set(RUNTIME_EFFECT_KINDS);
  const terminalAwardTargets = new Map();
  const storyFlagChoiceOwners = new Map();
  for (const id of runtime.nodeIds) {
    const node = nodeById.get(id);
    if (!supportedNodes.has(node.type)) throw new Error(`runtime node ${id} has unsupported type ${node.type}`);
    for (const gate of node.payload?.gates ?? []) {
      if (!supportedGates.has(gate.kind)) throw new Error(`runtime node ${id} has unsupported gate ${gate.kind}`);
      validateRuntimeGate(gate, {
        owner: `runtime node ${id}`, nodeById, profileIds,
        temporal: id === runtime.entryNodeId,
      });
    }
    const effects = node.payload?.effects ?? [];
    if (effects.length && node.id !== terminal.id) {
      throw new Error(`runtime effects may appear only on terminal ${terminal.id}`);
    }
    for (const [index, effect] of effects.entries()) {
      if (!supportedEffects.has(effect.kind)) throw new Error(`runtime node ${id} has unsupported effect ${effect.kind}`);
      if (effect.recipientPolicy !== 'all_participants' || effect.claimPolicy !== 'self') {
        throw new Error(`runtime terminal ${id} effect ${index} requires recipientPolicy all_participants and claimPolicy self`);
      }
      const targetField = effect.kind === 'award_status' ? 'statusId' : 'collectibleId';
      const targetType = effect.kind === 'award_status' ? 'status' : 'collectible_def';
      const targetId = effect[targetField];
      const target = nodeById.get(targetId);
      if (!target) throw new Error(`runtime terminal ${id} effect ${index} ${targetField} ${targetId} references a missing node`);
      if (target.type !== targetType) throw new Error(`runtime terminal ${id} effect ${index} ${targetField} ${targetId} must reference ${targetType}`);
      if (!profileIds.has(targetId)) throw new Error(`runtime terminal ${id} effect ${index} ${targetField} ${targetId} is outside nodeIds`);
      if (terminalAwardTargets.has(targetId)) throw new Error(`runtime terminal ${id} awards ${targetId} more than once`);
      terminalAwardTargets.set(targetId, effect.kind);
    }

    if (node.type === 'puzzle') {
      if (node.payload?.answerMode !== 'server_owned_canonical') {
        throw new Error(`runtime puzzle ${id} must use answerMode server_owned_canonical`);
      }
      const answerSpecId = node.payload?.answerSpecId;
      const answerSpec = nodeById.get(answerSpecId);
      if (!answerSpec) throw new Error(`runtime puzzle ${id} answerSpecId ${answerSpecId} references a missing node`);
      if (answerSpec.type !== 'answer_spec') throw new Error(`runtime puzzle ${id} answerSpecId ${answerSpecId} must reference answer_spec`);
      if (!profileIds.has(answerSpecId)) throw new Error(`runtime puzzle ${id} answerSpecId ${answerSpecId} is outside nodeIds`);
    }
    if (node.type === 'role') {
      const participantKinds = node.payload?.participantKinds;
      if (!uniqueStrings(participantKinds)) {
        throw new Error(`runtime role ${id} requires participantKinds`);
      }
      for (const kind of participantKinds) {
        if (!['agent', 'human_eligible_non_agent'].includes(kind)) {
          throw new Error(`runtime role ${id} has unsupported participant kind ${kind}`);
        }
      }
    }
    if (node.type === 'answer_spec') {
      const payload = node.payload ?? {};
      if (!RUNTIME_ANSWER_VERIFIERS.includes(payload.verifier)) {
        throw new Error(`runtime answer spec ${id} has unsupported verifier ${payload.verifier}`);
      }
      if (!uniqueStrings(payload.acceptedValues)) {
        throw new Error(`runtime answer spec ${id} requires non-empty acceptedValues`);
      }
      const normalized = new Set();
      for (const accepted of payload.acceptedValues) {
        if (accepted !== accepted.trim().toLowerCase()) {
          throw new Error(`runtime answer spec ${id} accepted value ${accepted} is not normalized`);
        }
        if (normalized.has(accepted)) throw new Error(`runtime answer spec ${id} has duplicate accepted value ${accepted}`);
        normalized.add(accepted);
      }
    }
    if (node.type === 'choice') {
      const options = node.payload?.options;
      if (!Array.isArray(options) || options.length < 2
        || options.some((option) => !option || typeof option !== 'object' || Array.isArray(option)
          || !ownKeysAre(option, new Set(['id', 'label', 'gates', 'storyFlagIds']))
          || typeof option.id !== 'string' || !option.id.trim()
          || typeof option.label !== 'string' || !option.label.trim())) {
        throw new Error(`runtime choice ${id} requires at least two stable options`);
      }
      const optionIds = new Set();
      let ungated = false;
      let expectedFlagKeys = null;
      const anyStoryFlags = options.some((option) => option.storyFlagIds !== undefined);
      for (const option of options) {
        if (optionIds.has(option.id)) throw new Error(`runtime choice ${id} has duplicate option id ${option.id}`);
        optionIds.add(option.id);
        if (option.gates !== undefined && !Array.isArray(option.gates)) {
          throw new Error(`runtime choice ${id} option ${option.id} gates must be an array`);
        }
        const gates = option.gates ?? [];
        if (!gates.length) ungated = true;
        for (const gate of gates) {
          validateRuntimeGate(gate, {
            owner: `runtime choice ${id} option ${option.id}`, nodeById, profileIds,
          });
        }
        if (anyStoryFlags) {
          if (!uniqueStrings(option.storyFlagIds) || option.storyFlagIds.length > 3) {
            throw new Error(`runtime choice ${id} option ${option.id} requires one to three storyFlagIds`);
          }
          const keys = [];
          for (const flagId of option.storyFlagIds) {
            const flag = nodeById.get(flagId);
            if (!flag) throw new Error(`runtime choice ${id} option ${option.id} storyFlagIds ${flagId} references a missing node`);
            if (flag.type !== 'story_flag') {
              throw new Error(`runtime choice ${id} option ${option.id} story flag ${flagId} must reference story_flag`);
            }
            if (!profileIds.has(flagId)) {
              throw new Error(`runtime choice ${id} option ${option.id} story flag ${flagId} is outside nodeIds`);
            }
            keys.push(flag.payload.key);
          }
          keys.sort();
          if (!expectedFlagKeys) expectedFlagKeys = keys;
          else if (JSON.stringify(keys) !== JSON.stringify(expectedFlagKeys)) {
            throw new Error(`runtime choice ${id} options must record the same story flag keys`);
          }
        }
      }
      if (!ungated) throw new Error(`runtime choice ${id} requires at least one ungated option`);
      for (const key of expectedFlagKeys ?? []) {
        const owner = storyFlagChoiceOwners.get(key);
        if (owner && owner !== id) throw new Error(`runtime story flag key ${key} is owned by multiple choices`);
        storyFlagChoiceOwners.set(key, id);
      }
    }
    if (node.type === 'story_flag') {
      const payload = node.payload ?? {};
      if (!ownKeysAre(payload, new Set(['key', 'kind', 'value', 'title', 'gameplayPower']))) {
        throw new Error(`runtime story flag ${id} has unknown fields`);
      }
      if (!stableId(payload.key) || !payload.key.startsWith(`${bundle.namespace}.`)) {
        throw new Error(`runtime story flag ${id} key must be canonical and namespace-scoped`);
      }
      if (!RUNTIME_STORY_FLAG_KINDS.includes(payload.kind)) {
        throw new Error(`runtime story flag ${id} has unknown kind ${payload.kind}`);
      }
      if (!stableId(payload.value) || typeof payload.title !== 'string' || !payload.title.trim()) {
        throw new Error(`runtime story flag ${id} requires a canonical value and title`);
      }
      if (payload.gameplayPower !== 'none') {
        throw new Error(`runtime story flag ${id} must be gameplay-inert`);
      }
    }
    if (node.type === 'evidence'
      && (node.payload?.shareScope ?? 'party_summary_only') !== 'party_summary_only') {
      throw new Error(`runtime evidence ${id} has unsupported shareScope ${node.payload?.shareScope}`);
    }
  }
  if ((terminal.payload?.effects ?? []).length === 0) {
    throw new Error(`runtime terminal ${terminal.id} requires at least one supported effect`);
  }

  const profileEdges = edges.filter((edge) => profileIds.has(edge.from) && profileIds.has(edge.to));
  const edgeShapes = {
    REQUIRES: [['mystery', 'party_policy'], ['party_policy', 'quorum']],
    UNLOCKS: [
      ['mystery', 'chapter'], ['chapter', 'puzzle'], ['chapter', 'choice'],
      ['world_fact', 'chapter'], ['world_fact', 'puzzle'], ['world_fact', 'choice'],
      ['puzzle', 'puzzle'], ['puzzle', 'choice'], ['puzzle', 'reward_bundle'],
      ['choice', 'puzzle'], ['choice', 'choice'], ['choice', 'reward_bundle'],
      ['reward_bundle', 'terminal'],
    ],
    REVEALS: [
      ['puzzle', 'evidence'], ['choice', 'evidence'],
      ['human_agent_collaboration', 'world_fact'],
    ],
    CONTRIBUTES_TO: [['evidence', 'human_agent_collaboration']],
    REWARDS: [['human_agent_collaboration', 'reward_bundle']],
    PERFORMED_BY_ROLE: [['party_policy', 'role'], ['human_agent_collaboration', 'role']],
  };
  for (const edge of profileEdges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (from?.type === 'reward_bundle' && edge.type === 'REWARDS'
      && ['status', 'collectible_def'].includes(to?.type) && terminalAwardTargets.has(to.id)) {
      throw new Error(`runtime reward ${to.id} has duplicate authority from edge and terminal effect`);
    }
    if (!RUNTIME_EDGE_TYPES.includes(edge.type)) {
      throw new Error(`runtime edge ${edge.from} -[${edge.type}]-> ${edge.to} is unsupported`);
    }
    if (!(edgeShapes[edge.type] ?? []).some(([fromType, toType]) => from.type === fromType && to.type === toType)) {
      throw new Error(`runtime edge ${edge.from} -[${edge.type}]-> ${edge.to} has unsupported endpoint types ${from.type} -> ${to.type}`);
    }
  }

  const hasEdge = (from, type, to) => profileEdges.some((edge) => edge.from === from && edge.type === type && edge.to === to);
  if (!hasEdge(runtime.entryNodeId, 'REQUIRES', runtime.partyPolicyId)) {
    throw new Error(`runtime entry ${runtime.entryNodeId} must require party policy ${runtime.partyPolicyId}`);
  }
  if (!hasEdge(runtime.partyPolicyId, 'REQUIRES', runtime.quorumId)) {
    throw new Error(`runtime party policy ${runtime.partyPolicyId} must require quorum ${runtime.quorumId}`);
  }
  const roleEdges = profileEdges.filter((edge) => edge.from === runtime.partyPolicyId && edge.type === 'PERFORMED_BY_ROLE');
  if (roleEdges.length < quorumPayload.minimumParticipants) {
    throw new Error(`runtime party policy ${runtime.partyPolicyId} exposes fewer roles than quorum ${runtime.quorumId}`);
  }

  return bundle;
}

export function validateCraftingContentPack(bundle) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new Error('crafting content pack must be an object');
  }
  const crafting = bundle.crafting;
  if (!crafting || typeof crafting !== 'object' || Array.isArray(crafting)) {
    throw new Error('crafting manifest is required');
  }
  const fields = new Set([
    'title', 'nodeIds', 'sourceIds', 'recipeIds', 'jobIds', 'skillTrackIds', 'toolIds', 'facilityIds',
    'exchange',
  ]);
  if (!ownKeysAre(crafting, fields)) throw new Error('crafting manifest has unknown fields');
  if (typeof crafting.title !== 'string' || !crafting.title.trim()) {
    throw new Error('crafting manifest requires a title');
  }
  if (!uniqueStrings(crafting.nodeIds)) throw new Error('crafting nodeIds must be a non-empty unique string array');
  if (!uniqueStrings(crafting.sourceIds)) throw new Error('crafting sourceIds must be a non-empty unique string array');
  if (!uniqueStrings(crafting.recipeIds)) throw new Error('crafting recipeIds must be a non-empty unique string array');
  for (const field of ['jobIds', 'skillTrackIds', 'toolIds', 'facilityIds']) {
    const values = crafting[field] ?? [];
    if (!Array.isArray(values)
      || values.some((value) => typeof value !== 'string' || !value.trim())
      || new Set(values).size !== values.length) {
      throw new Error(`crafting ${field} must be a unique string array`);
    }
  }
  if (crafting.exchange !== undefined) {
    const exchange = crafting.exchange;
    if (!exchange || typeof exchange !== 'object' || Array.isArray(exchange)
      || !ownKeysAre(exchange, new Set(['itemIds', 'listingTtlHours', 'maxOpenListingsPerAccount']))
      || !uniqueStrings(exchange.itemIds) || exchange.itemIds.length < 2
      || !Number.isInteger(exchange.listingTtlHours)
      || exchange.listingTtlHours < 1 || exchange.listingTtlHours > 168
      || !Number.isInteger(exchange.maxOpenListingsPerAccount)
      || exchange.maxOpenListingsPerAccount < 1 || exchange.maxOpenListingsPerAccount > 20) {
      throw new Error('crafting exchange requires at least two unique itemIds, listingTtlHours 1-168, and maxOpenListingsPerAccount 1-20');
    }
  }

  const nodes = Array.isArray(bundle.nodes) ? bundle.nodes : [];
  const edges = Array.isArray(bundle.edges) ? bundle.edges : [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const profileIds = new Set(crafting.nodeIds);
  const sourceIds = new Set(crafting.sourceIds);
  const recipeIds = new Set(crafting.recipeIds);
  const jobIds = new Set(crafting.jobIds ?? []);
  const skillTrackIds = new Set(crafting.skillTrackIds ?? []);
  const toolIds = new Set(crafting.toolIds ?? []);
  const facilityIds = new Set(crafting.facilityIds ?? []);
  const exchangeItemIds = new Set(crafting.exchange?.itemIds ?? []);
  const supportedNodes = new Set(CRAFTING_NODE_TYPES);
  const supportedEdges = new Set(CRAFTING_EDGE_TYPES);
  const supportedGates = new Set(CRAFTING_GATE_KINDS);
  const refs = (id, type) => {
    const node = nodeById.get(id);
    if (!node) throw new Error(`crafting profile references missing node ${id}`);
    if (node.type !== type) throw new Error(`crafting node ${id} must be ${type}`);
    if (!profileIds.has(id)) throw new Error(`crafting node ${id} is outside nodeIds`);
    return node;
  };

  for (const id of crafting.nodeIds) {
    const node = nodeById.get(id);
    if (!node) throw new Error(`crafting nodeIds references missing node ${id}`);
    if (!supportedNodes.has(node.type)) {
      throw new Error(`crafting node ${id} has unsupported type ${node.type}`);
    }
  }
  for (const id of crafting.sourceIds) refs(id, 'source');
  for (const id of crafting.recipeIds) refs(id, 'recipe');
  for (const id of crafting.jobIds ?? []) refs(id, 'work_order');
  for (const id of crafting.skillTrackIds ?? []) refs(id, 'skill_track');
  for (const id of crafting.toolIds ?? []) refs(id, 'tool');
  for (const id of crafting.facilityIds ?? []) refs(id, 'facility');
  for (const id of crafting.exchange?.itemIds ?? []) refs(id, 'item_def');
  for (const id of crafting.nodeIds) {
    const node = nodeById.get(id);
    if (node.type === 'source' && !sourceIds.has(id)) {
      throw new Error(`crafting sourceIds must include source node ${id}`);
    }
    if (node.type === 'recipe' && !recipeIds.has(id)) {
      throw new Error(`crafting recipeIds must include recipe node ${id}`);
    }
    if (node.type === 'work_order' && !jobIds.has(id)) {
      throw new Error(`crafting jobIds must include work order node ${id}`);
    }
    if (node.type === 'skill_track' && !skillTrackIds.has(id)) {
      throw new Error(`crafting skillTrackIds must include skill track node ${id}`);
    }
    if (node.type === 'tool' && !toolIds.has(id)) {
      throw new Error(`crafting toolIds must include tool node ${id}`);
    }
    if (node.type === 'facility' && !facilityIds.has(id)) {
      throw new Error(`crafting facilityIds must include facility node ${id}`);
    }
    for (const gate of node.payload?.gates ?? []) {
      if (!supportedGates.has(gate.kind)) {
        throw new Error(`crafting node ${id} has unsupported gate ${gate.kind}`);
      }
      validateRuntimeGate(gate, { owner: `crafting node ${id}`, nodeById, profileIds });
    }
    if (node.type === 'location') {
      if (!ownKeysAre(node.payload ?? {}, new Set(['title', 'districtId']))
        || typeof node.payload?.title !== 'string' || !node.payload.title.trim()
        || typeof node.payload?.districtId !== 'string' || !node.payload.districtId.trim()) {
        throw new Error(`crafting location ${id} requires only title and districtId`);
      }
    }
    if (node.type === 'budget') {
      const payload = node.payload ?? {};
      if (!ownKeysAre(payload, new Set(['kind', 'epoch', 'maxUnitsPerEpoch']))
        || payload.kind !== 'source' || !['day', 'week', 'season'].includes(payload.epoch)
        || !Number.isInteger(payload.maxUnitsPerEpoch) || payload.maxUnitsPerEpoch < 1) {
        throw new Error(`crafting budget ${id} must be a finite source epoch budget`);
      }
    }
    if (node.type === 'source') {
      const payload = node.payload ?? {};
      if (!ownKeysAre(payload, new Set([
        'title', 'sourceKind', 'budgetId', 'claimLimitPerEpoch', 'gates',
      ])) || typeof payload.title !== 'string' || !payload.title.trim()) {
        throw new Error(`crafting source ${id} has unknown fields or no title`);
      }
      if (payload.sourceKind !== 'finite_salvage') {
        throw new Error(`crafting source ${id} has unsupported sourceKind ${payload.sourceKind}`);
      }
      if (payload.claimLimitPerEpoch !== 1) {
        throw new Error(`crafting source ${id} claimLimitPerEpoch must be 1`);
      }
      refs(payload.budgetId, 'budget');
    }
    if (node.type === 'recipe') {
      const payload = node.payload ?? {};
      if (!ownKeysAre(payload, new Set([
        'title', 'craftKind', 'skillTrackId', 'minSkillLevel', 'gates',
      ]))
        || typeof payload.title !== 'string' || !payload.title.trim()
        || payload.craftKind !== 'account_inventory') {
        throw new Error(`crafting recipe ${id} must be an account_inventory recipe with a title`);
      }
      const hasSkill = payload.skillTrackId !== undefined || payload.minSkillLevel !== undefined;
      if (hasSkill) {
        const track = refs(payload.skillTrackId, 'skill_track');
        if (!Number.isInteger(payload.minSkillLevel) || payload.minSkillLevel < 0
          || payload.minSkillLevel > track.payload.thresholds.length) {
          throw new Error(`crafting recipe ${id} has invalid minSkillLevel`);
        }
      }
    }
    if (node.type === 'skill_track') {
      const payload = node.payload ?? {};
      if (!ownKeysAre(payload, new Set(['title', 'thresholds']))
        || typeof payload.title !== 'string' || !payload.title.trim()
        || !Array.isArray(payload.thresholds) || payload.thresholds.length < 1
        || payload.thresholds.length > 20
        || payload.thresholds.some((value, index) => !Number.isInteger(value) || value < 1
          || value > 1000000 || (index > 0 && value <= payload.thresholds[index - 1]))) {
        throw new Error(`crafting skill track ${id} requires strictly increasing positive thresholds`);
      }
    }
    if (node.type === 'work_order') {
      const payload = node.payload ?? {};
      if (!ownKeysAre(payload, new Set([
        'title', 'jobKind', 'durationSeconds', 'skillTrackId', 'minSkillLevel', 'gates',
      ]))
        || typeof payload.title !== 'string' || !payload.title.trim()
        || payload.jobKind !== 'account_work_order') {
        throw new Error(`crafting work order ${id} must be an account_work_order with a title`);
      }
      if (!Number.isInteger(payload.durationSeconds)
        || payload.durationSeconds < 1 || payload.durationSeconds > 604800) {
        throw new Error(`crafting work order ${id} durationSeconds must be 1-604800`);
      }
      const track = refs(payload.skillTrackId, 'skill_track');
      if (!Number.isInteger(payload.minSkillLevel) || payload.minSkillLevel < 0
        || payload.minSkillLevel > track.payload.thresholds.length) {
        throw new Error(`crafting work order ${id} has invalid minSkillLevel`);
      }
    }
    if (node.type === 'facility') {
      const payload = node.payload ?? {};
      if (!ownKeysAre(payload, new Set(['title', 'facilityKind', 'locationId']))
        || typeof payload.title !== 'string' || !payload.title.trim()
        || payload.facilityKind !== 'location_workbench') {
        throw new Error(`crafting facility ${id} must be a location_workbench with a title`);
      }
      refs(payload.locationId, 'location');
    }
    if (node.type === 'tool') {
      const payload = node.payload ?? {};
      if (!ownKeysAre(payload, new Set([
        'title', 'toolKind', 'itemId', 'maxDurability', 'durabilityCost', 'repairKind',
      ])) || typeof payload.title !== 'string' || !payload.title.trim()
        || payload.toolKind !== 'account_durable'
        || payload.repairKind !== 'restore_to_max'
        || !Number.isInteger(payload.maxDurability) || payload.maxDurability < 1
        || payload.maxDurability > 10000
        || !Number.isInteger(payload.durabilityCost) || payload.durabilityCost < 1
        || payload.durabilityCost > payload.maxDurability) {
        throw new Error(`crafting tool ${id} requires bounded account_durable wear and restore_to_max repair`);
      }
      refs(payload.itemId, 'item_def');
    }
    if (node.type === 'item_def') {
      const payload = node.payload ?? {};
      if (payload.exportPolicy !== undefined) throw new Error(`crafting item ${id} cannot enable export`);
      if (!ownKeysAre(payload, new Set([
        'title', 'category', 'tier', 'stackable', 'maxOwned', 'gameplayPower', 'tradeable',
      ])) || typeof payload.title !== 'string' || !payload.title.trim()
        || typeof payload.category !== 'string' || !payload.category.trim()
        || !Number.isInteger(payload.tier) || payload.tier < 1
        || typeof payload.stackable !== 'boolean'
        || !Number.isInteger(payload.maxOwned) || payload.maxOwned < 1 || payload.maxOwned > 10000) {
        throw new Error(`crafting item ${id} requires a bounded inert inventory definition`);
      }
      const authoredTool = payload.category === 'authored_tool';
      if (payload.gameplayPower !== (authoredTool ? 'authored_crafting_only' : 'none')) {
        if (!authoredTool) throw new Error(`crafting item ${id} requires gameplayPower none`);
        throw new Error(`crafting item ${id} has unsupported gameplayPower ${payload.gameplayPower}`);
      }
      const exchangeItem = exchangeItemIds.has(id);
      if (exchangeItem) {
        if (payload.tradeable !== true || !payload.stackable || payload.gameplayPower !== 'none'
          || !['authored_raw_material', 'authored_workpiece'].includes(payload.category)) {
          throw new Error(`crafting exchange item ${id} must be a stackable inert authored material with tradeable true`);
        }
      } else if (payload.tradeable !== false) {
        throw new Error(`crafting item ${id} requires tradeable false unless declared by the exchange`);
      }
      if (authoredTool && (payload.stackable || payload.maxOwned !== 1)) {
        throw new Error(`crafting authored tool item ${id} must be non-stackable with maxOwned 1`);
      }
      if (!payload.stackable && payload.maxOwned !== 1) {
        throw new Error(`crafting non-stackable item ${id} must have maxOwned 1`);
      }
    }
    if (node.type === 'sink') {
      const payload = node.payload ?? {};
      if (!ownKeysAre(payload, new Set(['title', 'kind', 'gameplayPower']))
        || typeof payload.title !== 'string' || !payload.title.trim()
        || payload.kind !== 'display_only' || payload.gameplayPower !== 'none') {
        throw new Error(`crafting sink ${id} must be gameplay-inert display_only`);
      }
    }
  }

  const profileEdges = edges.filter((edge) => profileIds.has(edge.from) || profileIds.has(edge.to));
  const edgeShapes = {
    REQUIRES: [
      ['source', 'budget'], ['recipe', 'facility'], ['work_order', 'facility'], ['tool', 'facility'],
    ],
    PRODUCES: [['source', 'item_def'], ['recipe', 'item_def'], ['work_order', 'item_def']],
    CONSUMES: [['recipe', 'item_def'], ['work_order', 'item_def'], ['tool', 'item_def']],
    TRAINS: [['work_order', 'skill_track']],
    SINKS_TO: [['item_def', 'sink']],
    USES_TOOL: [['recipe', 'tool'], ['work_order', 'tool']],
  };
  for (const edge of profileEdges) {
    if (!profileIds.has(edge.from) || !profileIds.has(edge.to)) {
      throw new Error(`crafting edge ${edge.from} -[${edge.type}]-> ${edge.to} crosses nodeIds`);
    }
    if (!supportedEdges.has(edge.type)) {
      throw new Error(`crafting edge ${edge.from} -[${edge.type}]-> ${edge.to} is unsupported`);
    }
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!(edgeShapes[edge.type] ?? []).some(([a, b]) => from.type === a && to.type === b)) {
      throw new Error(`crafting edge ${edge.from} -[${edge.type}]-> ${edge.to} has unsupported endpoint types ${from.type} -> ${to.type}`);
    }
  }
  for (const sourceId of crafting.sourceIds) {
    const source = nodeById.get(sourceId);
    const budgetId = source.payload.budgetId;
    if (!profileEdges.some((edge) => edge.from === sourceId
      && edge.type === 'REQUIRES' && edge.to === budgetId)) {
      throw new Error(`crafting source ${sourceId} must require budget ${budgetId}`);
    }
    const outputs = profileEdges.filter((edge) => edge.from === sourceId && edge.type === 'PRODUCES');
    if (!outputs.length) throw new Error(`crafting source ${sourceId} must produce an item`);
    const total = outputs.reduce((sum, edge) => sum + Number(edge.quantity || 0), 0);
    const budget = nodeById.get(budgetId);
    if (total > budget.payload.maxUnitsPerEpoch) {
      throw new Error(`crafting source ${sourceId} one claim exceeds budget ${budgetId}`);
    }
    for (const edge of outputs) {
      const item = nodeById.get(edge.to);
      if (edge.quantity > item.payload.maxOwned) {
        throw new Error(`crafting source ${sourceId} output ${edge.to} exceeds maxOwned`);
      }
    }
  }
  for (const recipeId of crafting.recipeIds) {
    const consumes = profileEdges.filter((edge) => edge.from === recipeId && edge.type === 'CONSUMES');
    const produces = profileEdges.filter((edge) => edge.from === recipeId && edge.type === 'PRODUCES');
    if (!consumes.length || !produces.length) {
      throw new Error(`crafting recipe ${recipeId} must consume and produce items`);
    }
    for (const edge of produces) {
      const item = nodeById.get(edge.to);
      if (edge.quantity > item.payload.maxOwned) {
        throw new Error(`crafting recipe ${recipeId} output ${edge.to} exceeds maxOwned`);
      }
    }
    for (const edge of [...consumes, ...produces]) {
      if (!Number.isInteger(edge.quantity) || edge.quantity < 1) {
        throw new Error(`crafting recipe ${recipeId} item quantities must be positive integers`);
      }
    }
  }
  for (const jobId of crafting.jobIds ?? []) {
    const job = nodeById.get(jobId);
    const consumes = profileEdges.filter((edge) => edge.from === jobId && edge.type === 'CONSUMES');
    const produces = profileEdges.filter((edge) => edge.from === jobId && edge.type === 'PRODUCES');
    const trains = profileEdges.filter((edge) => edge.from === jobId && edge.type === 'TRAINS');
    if (!consumes.length || !produces.length) {
      throw new Error(`crafting work order ${jobId} must consume and produce items`);
    }
    if (trains.length !== 1 || trains[0].to !== job.payload.skillTrackId) {
      throw new Error(`crafting work order ${jobId} must train exactly one skill track`);
    }
    if (!Number.isInteger(trains[0].quantity) || trains[0].quantity < 1 || trains[0].quantity > 100000) {
      throw new Error(`crafting work order ${jobId} requires bounded positive skill XP`);
    }
    for (const edge of [...consumes, ...produces]) {
      if (!Number.isInteger(edge.quantity) || edge.quantity < 1) {
        throw new Error(`crafting work order ${jobId} item quantities must be positive integers`);
      }
    }
    for (const edge of consumes) {
      const hasProvider = profileEdges.some((candidate) => candidate.type === 'PRODUCES'
        && candidate.to === edge.to && candidate.from !== jobId
        && ['source', 'recipe', 'work_order'].includes(nodeById.get(candidate.from)?.type));
      if (!hasProvider) {
        throw new Error(`crafting work order ${jobId} input ${edge.to} has no producer`);
      }
    }
    for (const edge of produces) {
      const item = nodeById.get(edge.to);
      if (!item.payload.stackable || item.payload.category !== 'authored_workpiece') {
        throw new Error(`crafting work order ${jobId} may produce only stackable authored workpieces`);
      }
      if (edge.quantity > item.payload.maxOwned) {
        throw new Error(`crafting work order ${jobId} output ${edge.to} exceeds maxOwned`);
      }
      const competing = profileEdges.find((candidate) => candidate !== edge
        && candidate.type === 'PRODUCES' && candidate.to === edge.to
        && nodeById.get(candidate.from)?.type !== 'work_order');
      if (competing) {
        throw new Error(`crafting work order output ${edge.to} cannot share source or recipe production authority`);
      }
      const hasUseOrSink = profileEdges.some((candidate) => (
        candidate.from === edge.to && candidate.type === 'SINKS_TO'
      ) || (
        candidate.type === 'CONSUMES' && candidate.to === edge.to && candidate.from !== jobId
      ));
      if (!hasUseOrSink) {
        throw new Error(`crafting work order ${jobId} output ${edge.to} has no use or sink`);
      }
    }
  }
  for (const toolId of crafting.toolIds ?? []) {
    const tool = nodeById.get(toolId);
    const item = nodeById.get(tool.payload.itemId);
    if (item.payload.category !== 'authored_tool'
      || item.payload.gameplayPower !== 'authored_crafting_only'
      || item.payload.tradeable !== false || item.payload.stackable || item.payload.maxOwned !== 1) {
      throw new Error(`crafting tool ${toolId} must link one non-tradeable authored_tool item`);
    }
    const linkedTools = (crafting.toolIds ?? [])
      .filter((candidate) => nodeById.get(candidate).payload.itemId === item.id);
    if (linkedTools.length !== 1) {
      throw new Error(`crafting tool item ${item.id} must link to exactly one tool`);
    }
    const producers = profileEdges.filter((edge) => edge.type === 'PRODUCES' && edge.to === item.id);
    if (producers.length !== 1 || nodeById.get(producers[0].from)?.type !== 'recipe'
      || producers[0].quantity !== 1) {
      throw new Error(`crafting tool ${toolId} must be acquired by exactly one single-item recipe`);
    }
    const repairInputs = profileEdges.filter((edge) => edge.from === toolId && edge.type === 'CONSUMES');
    if (!repairInputs.length || repairInputs.some((edge) => !Number.isInteger(edge.quantity) || edge.quantity < 1)) {
      throw new Error(`crafting tool ${toolId} requires positive repair materials`);
    }
    for (const edge of repairInputs) {
      const hasProvider = profileEdges.some((candidate) => candidate.type === 'PRODUCES'
        && candidate.to === edge.to
        && ['source', 'recipe', 'work_order'].includes(nodeById.get(candidate.from)?.type));
      if (!hasProvider) throw new Error(`crafting tool ${toolId} repair input ${edge.to} has no producer`);
    }
    const facilities = profileEdges.filter((edge) => edge.from === toolId && edge.type === 'REQUIRES');
    if (facilities.length !== 1) {
      throw new Error(`crafting tool ${toolId} must require exactly one facility`);
    }
    const uses = profileEdges.filter((edge) => edge.type === 'USES_TOOL' && edge.to === toolId);
    if (!uses.length) throw new Error(`crafting tool ${toolId} must be used by a recipe or work order`);
    for (const use of uses) {
      if (use.quantity !== undefined) {
        throw new Error(`crafting USES_TOOL ${use.from} -> ${toolId} cannot override durability cost`);
      }
      if (!profileEdges.some((edge) => edge.from === use.from
        && edge.type === 'REQUIRES' && edge.to === facilities[0].to)) {
        throw new Error(`crafting action ${use.from} must require tool ${toolId}'s facility`);
      }
    }
  }
  for (const itemId of crafting.nodeIds.filter((id) => nodeById.get(id).type === 'item_def')) {
    const item = nodeById.get(itemId);
    const linked = (crafting.toolIds ?? []).filter((toolId) => nodeById.get(toolId).payload.itemId === itemId);
    if (item.payload.category === 'authored_tool' && linked.length !== 1) {
      throw new Error(`crafting authored tool item ${itemId} must link to exactly one tool`);
    }
    if (item.payload.category !== 'authored_tool' && linked.length) {
      throw new Error(`crafting tool item ${itemId} must use category authored_tool`);
    }
  }
  for (const itemId of exchangeItemIds) {
    const producers = profileEdges.filter((edge) => edge.type === 'PRODUCES' && edge.to === itemId);
    const uses = profileEdges.filter((edge) => (edge.type === 'CONSUMES' && edge.to === itemId)
      || (edge.type === 'SINKS_TO' && edge.from === itemId));
    if (!producers.length || !uses.length) {
      throw new Error(`crafting exchange item ${itemId} requires an authored producer and use or sink`);
    }
  }
  return bundle;
}

export function validateActivatableContentPack(bundle) {
  let profiles = 0;
  if (bundle?.runtime !== undefined) {
    validateRuntimeContentPack(bundle);
    profiles += 1;
  }
  if (bundle?.crafting !== undefined) {
    validateCraftingContentPack(bundle);
    profiles += 1;
  }
  if (!profiles) throw new Error('activatable content requires a supported capability manifest');
  return bundle;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

const stableCompare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function compileContentPack(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('content pack must be an object');
  if (input.schemaVersion !== 1) throw new Error('schemaVersion must be 1');
  if (typeof input.namespace !== 'string' || !input.namespace.trim()) throw new Error('namespace is required');
  if (!Number.isInteger(input.version) || input.version < 1) throw new Error('version must be a positive integer');
  if (!GROWTH_ROLES.includes(input.growth?.role)) {
    throw new Error(`growth role ${input.growth?.role} is unknown`);
  }
  if (input.growth.role === 'internal_only'
    && (typeof input.growth.exemptReason !== 'string' || !input.growth.exemptReason.trim())) {
    throw new Error('internal_only growth role requires exemptReason');
  }
  if (RECRUITMENT_GROWTH_ROLES.has(input.growth.role)) {
    if (input.growth.attributionPolicy !== 'direct_once_with_consent') {
      throw new Error(`growth role ${input.growth.role} requires attributionPolicy direct_once_with_consent`);
    }
    if (input.growth.externalActionPolicy !== 'approved_asset_only') {
      throw new Error(`growth role ${input.growth.role} requires externalActionPolicy approved_asset_only`);
    }
  }
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) throw new Error('content pack must contain nodes');
  if (!Array.isArray(input.edges)) throw new Error('content pack edges must be an array');

  const allowedNodes = new Set(NODE_TYPES);
  const allowedGates = new Set(GATE_KINDS);
  const allowedEffects = new Set(EFFECT_KINDS);
  const nodeIds = new Set();
  const nodeById = new Map();
  for (const node of input.nodes) {
    if (!allowedNodes.has(node?.type)) throw new Error(`node ${node?.id} has unknown type ${node?.type}`);
    if (typeof node?.id !== 'string' || !node.id.trim()) throw new Error('node id is required');
    if (nodeIds.has(node.id)) throw new Error(`duplicate node id ${node.id}`);
    nodeIds.add(node.id);
    nodeById.set(node.id, node);
    if (node.payload?.gates !== undefined && !Array.isArray(node.payload.gates)) {
      throw new Error(`node ${node.id} gates must be an array`);
    }
    for (const [index, gate] of (node.payload?.gates ?? []).entries()) {
      if (!allowedGates.has(gate?.kind)) {
        throw new Error(`node ${node.id} gate ${index} has unknown kind ${gate?.kind}`);
      }
    }
    if (node.payload?.effects !== undefined && !Array.isArray(node.payload.effects)) {
      throw new Error(`node ${node.id} effects must be an array`);
    }
    for (const [index, effect] of (node.payload?.effects ?? []).entries()) {
      if (!allowedEffects.has(effect?.kind)) {
        throw new Error(`node ${node.id} effect ${index} has unknown kind ${effect?.kind}`);
      }
    }
    if (node.type === 'agent_recruitment_reward') {
      const milestone = node.payload?.milestone;
      if (RAW_RECRUITMENT_SIGNALS.has(milestone)) {
        throw new Error(`agent reward ${node.id} cannot reward raw signal ${milestone}`);
      }
      if (!AGENT_CASH_MILESTONES.has(milestone)) {
        throw new Error(`agent reward ${node.id} has unknown qualified milestone ${milestone}`);
      }
    }
    if (node.type === 'funded_omr_allocation') {
      const payload = node.payload ?? {};
      if (payload.trigger !== 'achievement' || payload.timeEmission !== false) {
        throw new Error(`OMR allocation ${node.id} must be achievement-triggered and never time-emitting`);
      }
      if (payload.currency !== 'OMR' || payload.funding !== 'season_precommitted') {
        throw new Error(`OMR allocation ${node.id} must be a season-precommitted OMR reserve`);
      }
      if (!/^[1-9]\d*$/.test(payload.amountAtomic ?? '') || payload.claimLimit !== 1) {
        throw new Error(`OMR allocation ${node.id} must declare one finite positive claim`);
      }
      if (typeof payload.allocationId !== 'string' || !payload.allocationId.trim()) {
        throw new Error(`OMR allocation ${node.id} requires allocationId`);
      }
    }
    if (['item_def', 'collectible_def'].includes(node.type) && node.payload?.exportPolicy !== undefined) {
      const policy = node.payload.exportPolicy;
      if (policy?.mode !== 'owner_initiated_optional'
        || policy?.gameplayEffect !== 'none'
        || policy?.identityPolicy !== 'escrow_single_identity'
        || policy?.metadataPolicy !== 'hash_pinned'
        || policy?.chainProfile !== 'allowlisted_profile') {
        throw new Error(`collectible ${node.id} export must be optional, gameplay-inert, and identity-preserving`);
      }
    }
  }
  const allowedEdges = new Set(EDGE_TYPES);
  const edgeIds = new Set();
  for (const edge of input.edges) {
    if (!allowedEdges.has(edge?.type)) {
      throw new Error(`edge ${edge?.from} -[${edge?.type}]-> ${edge?.to} has unknown type`);
    }
    if (!nodeIds.has(edge?.from) || !nodeIds.has(edge?.to)) {
      throw new Error(`edge ${edge?.from} -[${edge?.type}]-> ${edge?.to} references a missing node`);
    }
    if (edge.ordinal !== undefined && (!Number.isInteger(edge.ordinal) || edge.ordinal < 0)) {
      throw new Error(`edge ${edge.from} -[${edge.type}]-> ${edge.to} has invalid ordinal ${edge.ordinal}`);
    }
    const edgeId = `${edge.from}\u0000${edge.type}\u0000${edge.to}\u0000${edge.ordinal ?? 0}`;
    if (edgeIds.has(edgeId)) {
      throw new Error(`duplicate edge ${edge.from} -[${edge.type}]-> ${edge.to} at ordinal ${edge.ordinal ?? 0}`);
    }
    edgeIds.add(edgeId);
  }

  const adjacency = new Map([...nodeIds].map((id) => [id, []]));
  for (const edge of input.edges) adjacency.get(edge.from).push(edge.to);
  for (const targets of adjacency.values()) targets.sort();
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  function visit(nodeId) {
    if (visiting.has(nodeId)) {
      const start = stack.indexOf(nodeId);
      throw new Error(`dependency cycle: ${[...stack.slice(start), nodeId].join(' -> ')}`);
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    stack.push(nodeId);
    for (const target of adjacency.get(nodeId)) visit(target);
    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }
  for (const nodeId of [...nodeIds].sort()) visit(nodeId);

  for (const collaboration of input.nodes.filter((node) => node.type === 'human_agent_collaboration')) {
    const roles = input.edges
      .filter((edge) => edge.from === collaboration.id && edge.type === 'PERFORMED_BY_ROLE')
      .map((edge) => nodeById.get(edge.to))
      .filter((node) => node?.type === 'role');
    const hasAgentRole = roles.some((role) => role.payload?.participantKinds?.includes('agent'));
    const hasConsentingHumanRole = roles.some((role) => role.payload?.participantKinds?.includes('human_eligible_non_agent')
      && role.payload?.consentRequired === true);
    if (collaboration.payload?.consentRequired !== true
      || collaboration.payload?.uniqueParticipants !== true
      || roles.length < 2 || !hasAgentRole || !hasConsentingHumanRole) {
      throw new Error(`collaboration ${collaboration.id} requires distinct agent and consenting human-eligible roles`);
    }
  }

  for (const sourceNode of input.nodes.filter((node) => node.type === 'source')) {
    const budgetId = sourceNode.payload?.budgetId;
    const budget = nodeById.get(budgetId);
    const requiresBudget = input.edges.some((edge) => edge.from === sourceNode.id
      && edge.type === 'REQUIRES' && edge.to === budgetId);
    if (budget?.type !== 'budget' || budget.payload?.kind !== 'source'
      || !Number.isInteger(budget.payload?.maxUnitsPerEpoch) || budget.payload.maxUnitsPerEpoch < 1
      || !['day', 'week', 'season'].includes(budget.payload?.epoch)
      || !requiresBudget) {
      throw new Error(`source ${sourceNode.id} must require finite source budget ${budgetId}`);
    }
    const outputs = input.edges.filter((edge) => edge.from === sourceNode.id && edge.type === 'PRODUCES');
    if (outputs.length === 0) throw new Error(`source ${sourceNode.id} must produce at least one item`);
    for (const edge of outputs) {
      if (nodeById.get(edge.to)?.type !== 'item_def'
        || !Number.isInteger(edge.quantity) || edge.quantity < 1) {
        throw new Error(`source ${sourceNode.id} output ${edge.to} must be an item with positive quantity`);
      }
    }
  }

  for (const recipe of input.nodes.filter((node) => node.type === 'recipe')) {
    const consumes = input.edges.filter((edge) => edge.from === recipe.id && edge.type === 'CONSUMES');
    const produces = input.edges.filter((edge) => edge.from === recipe.id && edge.type === 'PRODUCES');
    if (consumes.length === 0 || produces.length === 0) {
      throw new Error(`recipe ${recipe.id} must consume and produce at least one item`);
    }
    for (const edge of [...consumes, ...produces]) {
      if (nodeById.get(edge.to)?.type !== 'item_def') {
        throw new Error(`recipe ${recipe.id} ${edge.type} target ${edge.to} must be an item_def`);
      }
      if (!Number.isInteger(edge.quantity) || edge.quantity < 1) {
        throw new Error(`recipe ${recipe.id} edge to ${edge.to} requires positive integer quantity`);
      }
    }
    for (const inputEdge of consumes) {
      const hasProvider = input.edges.some((edge) => edge.type === 'PRODUCES'
        && edge.to === inputEdge.to
        && edge.from !== recipe.id
        && ['source', 'recipe', 'work_order'].includes(nodeById.get(edge.from)?.type));
      if (!hasProvider) {
        throw new Error(`recipe ${recipe.id} input ${inputEdge.to} has no source or producing recipe`);
      }
    }
    for (const outputEdge of produces) {
      const hasUseOrSink = input.edges.some((edge) => (edge.from === outputEdge.to && edge.type === 'SINKS_TO')
        || (edge.type === 'CONSUMES' && edge.to === outputEdge.to && edge.from !== recipe.id))
        || input.nodes.some((node) => node.type === 'tool' && node.payload?.itemId === outputEdge.to);
      if (!hasUseOrSink) throw new Error(`recipe ${recipe.id} output ${outputEdge.to} has no use or sink`);
    }
  }

  const rewardsByBudget = new Map();
  for (const reward of input.nodes.filter((node) => node.type === 'agent_recruitment_reward')) {
    const payload = reward.payload ?? {};
    if (payload.currency !== 'cash') throw new Error(`agent reward ${reward.id} must use cash`);
    if (!Number.isInteger(payload.amount) || payload.amount < 1) {
      throw new Error(`agent reward ${reward.id} amount must be a positive integer`);
    }
    if (payload.directOnly !== true) throw new Error(`agent reward ${reward.id} must be directOnly`);
    if (JSON.stringify(payload.eligibleRecruiterKinds) !== JSON.stringify(['agent'])) {
      throw new Error(`agent reward ${reward.id} must target agent recruiters`);
    }
    if (JSON.stringify(payload.eligibleRecruitKinds) !== JSON.stringify(['human_eligible_non_agent'])) {
      throw new Error(`agent reward ${reward.id} must target human_eligible_non_agent recruits`);
    }
    if (payload.ledgerReason !== AGENT_CASH_LEDGER_REASONS[payload.milestone]) {
      throw new Error(`agent reward ${reward.id} has invalid ledgerReason ${payload.ledgerReason}`);
    }
    if (payload.claimKey !== 'direct_recruiter_recruit_campaign_milestone') {
      throw new Error(`agent reward ${reward.id} must use the direct milestone claim key`);
    }
    const budget = nodeById.get(payload.budgetId);
    if (budget?.type !== 'budget' || budget.payload?.currency !== 'cash') {
      throw new Error(`agent reward ${reward.id} requires cash budget ${payload.budgetId}`);
    }
    if (!input.edges.some((edge) => edge.from === reward.id
      && edge.type === 'REQUIRES' && edge.to === budget.id)) {
      throw new Error(`agent reward ${reward.id} must require cash budget ${budget.id}`);
    }
    const budgetPayload = budget.payload ?? {};
    if (!Number.isInteger(budgetPayload.liabilityCap) || budgetPayload.liabilityCap < 1
      || !Number.isInteger(budgetPayload.reserved) || budgetPayload.reserved < 1
      || budgetPayload.reserved > budgetPayload.liabilityCap
      || !Number.isInteger(budgetPayload.maxRecruits) || budgetPayload.maxRecruits < 1) {
      throw new Error(`cash budget ${budget.id} must declare bounded reserved liability and maxRecruits`);
    }
    const rewards = rewardsByBudget.get(budget.id) ?? [];
    rewards.push(reward);
    rewardsByBudget.set(budget.id, rewards);
  }
  for (const [budgetId, rewards] of rewardsByBudget) {
    const budget = nodeById.get(budgetId);
    const worstCasePerRecruit = rewards.reduce((sum, reward) => sum + reward.payload.amount, 0);
    if (worstCasePerRecruit * budget.payload.maxRecruits > budget.payload.reserved) {
      throw new Error(`agent reward ${rewards[0].id} exceeds reserved cash budget ${budgetId}`);
    }
    const milestoneKeys = new Set();
    for (const reward of rewards) {
      if (milestoneKeys.has(reward.payload.milestone)) {
        throw new Error(`cash budget ${budgetId} has duplicate milestone ${reward.payload.milestone}`);
      }
      milestoneKeys.add(reward.payload.milestone);
    }
  }

  const source = canonical({
    ...input,
    nodes: [...input.nodes].sort((a, b) => stableCompare(String(a?.id), String(b?.id))),
    edges: [...input.edges].sort((a, b) => {
      const ak = `${a?.from}\u0000${a?.type}\u0000${a?.to}\u0000${a?.ordinal ?? 0}`;
      const bk = `${b?.from}\u0000${b?.type}\u0000${b?.to}\u0000${b?.ordinal ?? 0}`;
      return stableCompare(ak, bk);
    }),
  });
  const canonicalJson = JSON.stringify(source);
  return {
    ...source,
    contentHash: crypto.createHash('sha256').update(canonicalJson).digest('hex'),
  };
}

export function bundleSummary(bundle) {
  return {
    ok: true,
    namespace: bundle.namespace,
    version: bundle.version,
    nodes: bundle.nodes.length,
    edges: bundle.edges.length,
    contentHash: bundle.contentHash,
  };
}
