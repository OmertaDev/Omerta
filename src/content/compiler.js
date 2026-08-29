import crypto from 'node:crypto';

export const NODE_TYPES = Object.freeze([
  'mystery', 'chapter', 'puzzle', 'choice', 'terminal', 'evidence', 'answer_spec',
  'party_policy', 'role', 'quorum', 'organization_gate', 'contribution',
  'location', 'npc', 'world_fact', 'season_overlay', 'event_window',
  'item_def', 'recipe', 'source', 'sink', 'tool', 'facility', 'skill_track',
  'reward_bundle', 'status', 'collectible_def', 'funded_omr_allocation',
  'budget', 'scarcity_cap', 'activation', 'supersession',
  'public_hook', 'shareable_artifact', 'acquisition_campaign', 'referral_entry',
  'newcomer_activation', 'human_agent_collaboration', 'retention_checkpoint',
  'agent_recruitment_reward', 'growth_exemption',
]);
export const EDGE_TYPES = Object.freeze([
  'REQUIRES', 'UNLOCKS', 'REVEALS', 'CONSUMES', 'PRODUCES', 'USES_TOOL',
  'SOURCED_FROM', 'SINKS_TO', 'PERFORMED_BY_ROLE', 'REQUIRES_ORG_SCOPE',
  'REQUIRES_WORLD_FACT', 'CONTRIBUTES_TO', 'ALTERNATIVE_TO', 'EXCLUDES',
  'REWARDS', 'EXPORTS_AS', 'OVERLAID_BY_SEASON', 'SUPERSEDES',
  'ATTRACTS_TO', 'ATTRIBUTED_TO', 'ACTIVATES', 'COLLABORATES_WITH',
  'RETURNS_FOR', 'QUALIFIES_RECRUIT', 'REWARDS_RECRUITER',
]);
export const GATE_KINDS = Object.freeze([
  'level_at_least', 'stat_at_least', 'mastery_at_least', 'owns_item',
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
        && ['source', 'recipe'].includes(nodeById.get(edge.from)?.type));
      if (!hasProvider) {
        throw new Error(`recipe ${recipe.id} input ${inputEdge.to} has no source or producing recipe`);
      }
    }
    for (const outputEdge of produces) {
      const hasUseOrSink = input.edges.some((edge) => (edge.from === outputEdge.to && edge.type === 'SINKS_TO')
        || (edge.type === 'CONSUMES' && edge.to === outputEdge.to && edge.from !== recipe.id));
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
