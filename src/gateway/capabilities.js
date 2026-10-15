// Provider-neutral authority manifest. Closed inputs never accept an owner or account selector.
const ID = Object.freeze({ type: 'string', minLength: 1, maxLength: 200, pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' });
const HASH = Object.freeze({ type: 'string', pattern: '^[a-f0-9]{64}$' });
const LIMIT = Object.freeze({ type: 'integer', minimum: 1, maximum: 100 });
const REVISION = Object.freeze({ type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
const empty = Object.freeze({ type: 'object', additionalProperties: false, properties: {} });
const schema = (properties, required = []) => ({ type: 'object', additionalProperties: false, properties, required });
const scope = (name) => `omerta.${name}`;
const capability = (name, actionClass, scopes, description, inputSchema = empty) =>
  ({ name, actionClass, scopes: scopes.map(scope), description, inputSchema });
const read = (name, scopes, description, inputSchema) => capability(name, 'READ', scopes, description, inputSchema);
const analyze = (name, scopes, description, inputSchema) => capability(name, 'ANALYZE', scopes, description, inputSchema);
const group = schema({ group: { type: 'string', enum: ['crew', 'family'] } });
const operation = schema({ operationId: ID }, ['operationId']);
const mystery = schema({ graphId: ID }, ['graphId']);
const item = schema({ itemId: ID }, ['itemId']);
const resource = schema({ templateId: ID }, ['templateId']);
const recipe = schema({ recipeId: ID }, ['recipeId']);
const page = schema({ limit: LIMIT });
const graphPage = { limit: LIMIT, cursor: { type: 'string', maxLength: 20, pattern: '^world:[0-9]{1,8}$' } };
const changes = schema({ limit: LIMIT, since: { type: 'string', format: 'date-time', maxLength: 40 } });

export const CAPABILITIES = Object.freeze([
  read('get_player_context', ['player.read'], 'Compose the player snapshot and only sections authorized by the current token.'),
  read('get_inventory', ['inventory.read'], 'Read only this player’s account and living-character inventory, including vehicles and equipment.'),
  read('get_item', ['inventory.read'], 'Inspect an owned item or a published item template.', item),
  analyze('get_item_uses', ['inventory.read', 'economy.read'], 'Find uses in the authoritative published recipe catalog.', resource),
  analyze('get_missing_resources', ['inventory.read', 'economy.read'], 'Return the crafting service’s actual resource and eligibility blockers.', recipe),
  read('get_crafting_recipes', ['inventory.read', 'economy.read'], 'Published recipes and authoritative readiness previews.'),
  analyze('get_crafting_path', ['inventory.read', 'economy.read'], 'Trace published recipes toward an output without promising sequential readiness.', resource),
  analyze('get_resource_sources', ['inventory.read', 'economy.read'], 'Find published recipes producing this resource.', resource),
  read('get_world_context', ['world.read'], 'Read a bounded page of public entities and separately authorized discoveries.', schema(graphPage)),
  read('get_related_entities', ['world.read'], 'Read a bounded visible one-hop neighborhood around one known entity.', schema({ entityId: ID, ...graphPage }, ['entityId'])),
  read('get_location_context', ['world.read'], 'Inspect a published district and its public control state.', schema({ locationId: ID })),
  read('get_relationship_context', ['world.read'], 'Read a bounded visible one-hop neighborhood around one known entity.', schema({ entityId: ID, ...graphPage }, ['entityId'])),
  read('get_discovered_world_nodes', ['world.read'], 'Read a bounded page of the safe public/discovered graph projection.', schema(graphPage)),
  read('get_world_changes', ['world.read'], 'Read bounded event metadata visible to this player.', changes),
  read('get_active_mysteries', ['mysteries.read'], 'Discover available and started mystery packages without exposing hidden nodes.'),
  read('get_known_clues', ['mysteries.read'], 'Read discovered clue projections and the current scroll riddle, never solutions.'),
  read('get_mystery_context', ['mysteries.read'], 'Read the authoritative mystery board after owner/discovery checks.', mystery),
  read('get_related_discoveries', ['mysteries.read'], 'Read visible nodes from one mystery, without hidden relationship references.', mystery),
  analyze('get_investigation_options', ['mysteries.read'], 'Read actions currently offered by the authoritative mystery board.', mystery),
  read('get_coordination_requests', ['coordination.read'], 'Read the Coordination Engine catalog and the caller’s runs.'),
  analyze('get_coordination_opportunities', ['coordination.read'], 'Read actions already authorized by the Coordination Engine.'),
  analyze('get_group_requirements', ['coordination.read', 'social.read'], 'Read a current Crew operation’s published role requirements.', operation),
  analyze('get_available_contributions', ['coordination.read', 'social.read', 'inventory.read'], 'Read the caller’s assigned operation steps and own resources.', operation),
  read('get_crew', ['social.read'], 'Read the current Crew board without other members’ inventories.'),
  read('get_family', ['social.read'], 'Read the current Family and its published membership and objectives.'),
  read('get_members', ['social.read'], 'Read members of the caller’s current Crew or Family.', group),
  read('get_roles', ['social.read'], 'Read role assignments in the caller’s current Crew or Family.', group),
  read('get_group_objectives', ['social.read'], 'Read the current organization’s published objectives.', group),
  read('get_group_resources', ['social.read', 'economy.read'], 'Read explicitly shared Family balances; Crew private inventories stay private.', group),
  read('get_group_activity', ['social.read'], 'Read the current organization’s objective progress.', group),
  read('get_alliances', ['social.read'], 'Read authoritative Family treaties and public coalition context.'),
  read('get_conflicts', ['social.read'], 'Read the current Family’s published conflict state.'),
  read('get_shared_discoveries', ['social.read', 'coordination.read'], 'Read only claims currently authorized by the Knowledge Engine.'),
  read('get_territory_state', ['world.read'], 'Read public district holders and contest deadlines.'),
  read('get_controlled_territory', ['world.read', 'social.read'], 'Read districts held by the caller’s current Family.'),
  read('get_contested_territory', ['world.read'], 'Read public active territory contests without sealed bids.'),
  read('get_territory_requirements', ['world.read', 'social.read', 'economy.read'], 'Read authoritative next-tier and fortification quotes for Family rackets.'),
  read('get_territory_events', ['world.read'], 'Read bounded territory event metadata for this player.', changes),
  read('get_turf_economics', ['world.read', 'social.read', 'economy.read'], 'Read authoritative Family racket income and upkeep projections.'),
  read('get_available_missions', ['player.read', 'economy.read'], 'Read unfinished missions using the same requirement and cooldown calculation as the game command.'),
  read('get_active_missions', ['player.read'], 'Read completed one-shot missions and their current cooldown.'),
  read('get_operation_requirements', ['social.read'], 'Read a current Crew operation’s published roles and visible progress.', operation),
  analyze('get_eligible_operations', ['social.read', 'mysteries.read'], 'Use the authoritative operation discovery service to determine opening eligibility.'),
  analyze('get_operation_readiness', ['social.read'], 'Read role readiness and visible progress; hidden execution gates remain authoritative.', operation),
  read('get_season', ['player.read'], 'Read the published season clock and phase.'),
  read('get_season_progress', ['player.read'], 'Read current progression and historical season recaps.'),
  read('get_season_objectives', ['player.read', 'economy.read'], 'Read the authoritative Season Pass reward track.'),
  read('get_season_rewards', ['player.read', 'economy.read'], 'Read Season Pass claims, rewards, and funded stipend context.'),
  read('get_season_rank_context', ['player.read'], 'Read recorded season results without inventing a live rank.'),
  analyze('get_remaining_season_opportunities', ['player.read', 'economy.read'], 'Read unclaimed pass tiers and current claim readiness.'),
  read('get_economy_context', ['economy.read'], 'Read own game balances and published economy context.'),
  read('get_player_economic_state', ['economy.read'], 'Read this player’s off-chain balances and wallet-link status.'),
  read('get_reward_sources', ['player.read', 'economy.read'], 'Read published mission and Season Pass rewards.'),
  read('get_resource_values', ['economy.read'], 'Read published trade-good prices in the player’s current district.'),
  read('get_protocol_state', ['economy.read'], 'Read public chain configuration and indexed liquidity freshness, never operational controls.'),
  read('get_omr_context', ['economy.read'], 'Read the player’s OMR balances and public backing information.'),
  read('get_pol_context', ['economy.read'], 'Read public recorded protocol-owned liquidity totals with source limitations.'),
  read('get_liquidity_turf_context', ['economy.read', 'world.read'], 'Report indexed liquidity state and whether territory linkage is available.'),
  read('get_bond_context', ['economy.read'], 'Read this player’s recorded bonds and published offering parameters.'),
  read('get_rbs_context', ['economy.read'], 'Report availability of an authoritative RBS player projection.'),
  read('get_notifications', ['player.read'], 'Read event identifiers, types, and times; scoped payloads are never returned.', page),
  read('get_world_events', ['world.read'], 'Read event metadata visible to this player.', page),
  analyze('generate_brief_context', ['player.read'], 'Compose structured authorized context and bounded recent changes.', changes),
  analyze('get_opportunities', ['player.read'], 'Deterministically combine currently authorized recipe, investigation, operation and coordination options.', page),
  analyze('get_actionable_context', ['player.read'], 'Group currently authorized opportunities by play style without selecting a single best action.', page),
  analyze('find_coordination_paths', ['social.read', 'coordination.read'], 'Connect visible operation roles, public Crew membership, own authorized resources and legitimately shared knowledge; never infer private holdings.', schema({ operationId: ID })),
  capability('prepare_crafting_operation', 'PREPARE', ['actions.prepare', 'inventory.read', 'economy.read'], 'Prepare one published craft or salvage for explicit player confirmation.', schema({ recipeId: ID, carId: ID }, ['recipeId'])),
  capability('prepare_operation', 'PREPARE', ['actions.prepare', 'social.read', 'mysteries.read'], 'Prepare opening one published Crew operation for player confirmation.', schema({ graphId: ID, operationNodeId: ID }, ['graphId', 'operationNodeId'])),
  capability('prepare_resource_pledge', 'PREPARE', ['actions.prepare', 'coordination.read', 'social.read', 'inventory.read'], 'Prepare one assigned operation contribution without committing resources.', schema({ operationId: ID, nodeId: ID, interactionId: ID }, ['operationId', 'nodeId'])),
  capability('prepare_coordination_request', 'PREPARE', ['coordination.prepare', 'coordination.read'], 'Prepare an exact version of a published coordination graph.', schema({ graphId: ID, expectedContentHash: HASH }, ['graphId', 'expectedContentHash'])),
  capability('prepare_trade', 'PREPARE', ['actions.prepare', 'economy.read', 'inventory.read'], 'Report unavailable until an authoritative trade preparation adapter is configured.'),
  capability('prepare_transaction', 'PREPARE', ['actions.prepare', 'economy.read'], 'Report unavailable until a public unsigned transaction builder is configured; no keys or arbitrary calldata.'),
  capability('submit_mystery_action', 'COMMIT', ['actions.commit', 'mysteries.read'], 'Stage a mystery action for explicit player confirmation; agent calls never execute it.', schema({ graphId: ID, nodeId: ID, action: { type: 'string', enum: ['start', 'discover', 'complete', 'choice', 'cancel'] }, optionId: ID, interactionId: ID, instanceId: ID }, ['graphId', 'action'])),
  capability('respond_to_coordination_request', 'COMMIT', ['actions.commit', 'coordination.read'], 'Stage a currently issued coordination action for explicit player confirmation.', schema({ instanceId: ID, actionId: ID, expectedRevision: REVISION }, ['instanceId', 'actionId', 'expectedRevision'])),
].map((entry) => Object.freeze(entry)));

export const CAPABILITY_BY_NAME = new Map(CAPABILITIES.map((entry) => [entry.name, entry]));

export function validateCapabilityInput(capability, input = {}) {
  const fail = () => { const error = new Error('Invalid capability input.'); error.code = 'gateway_bad_input'; error.statusCode = 400; throw error; };
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail();
  const { properties = {}, required = [] } = capability.inputSchema;
  if (Object.keys(input).some((key) => !Object.hasOwn(properties, key))
      || required.some((key) => !Object.hasOwn(input, key))) fail();
  for (const [key, value] of Object.entries(input)) {
    const spec = properties[key];
    if (spec.type === 'string' && (typeof value !== 'string'
        || value.length < (spec.minLength || 0) || value.length > (spec.maxLength || 1000)
        || (spec.pattern && !new RegExp(spec.pattern).test(value))
        || (spec.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))))) fail();
    if (spec.type === 'integer' && (!Number.isSafeInteger(value) || value < spec.minimum || value > spec.maximum)) fail();
    if (spec.enum && !spec.enum.includes(value)) fail();
  }
  return input;
}
