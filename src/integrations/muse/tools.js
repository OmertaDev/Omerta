const ALIASES = Object.freeze({
  get_player_context: 'get_my_omerta_status',
  get_inventory: 'get_my_inventory',
  get_crew: 'get_my_crew',
  get_family: 'get_my_family',
  get_available_missions: 'get_my_missions',
  get_active_mysteries: 'get_my_mysteries',
  get_territory_state: 'get_my_territory',
  get_season_progress: 'get_my_season_progress',
  get_world_changes: 'get_world_updates',
  get_actionable_context: 'find_things_i_can_do',
  get_coordination_opportunities: 'find_crew_opportunities',
  get_missing_resources: 'find_resources_we_need',
  get_crafting_recipes: 'find_crafting_options',
});

export function museTools(capabilities, scopes = null) {
  const granted = scopes === null ? null : new Set(scopes);
  return capabilities.filter(capability => ['READ', 'ANALYZE', 'PREPARE'].includes(capability.actionClass)
    && (!granted || capability.scopes.every(scope => granted.has(scope))))
    .map(capability => ({
      name: ALIASES[capability.name] || capability.name,
      capability: capability.name,
      description: `${capability.description}${capability.actionClass === 'PREPARE'
        ? ' This only prepares a proposal. The player must review and approve it in Omerta before it can execute.' : ''}`,
      inputSchema: structuredClone(capability.inputSchema),
      requiredScopes: [...capability.scopes],
      actionClass: capability.actionClass,
      readOnly: capability.actionClass !== 'PREPARE',
      playerApprovalRequired: capability.actionClass === 'PREPARE',
    }));
}
