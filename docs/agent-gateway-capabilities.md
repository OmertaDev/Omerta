# Agent Gateway implementation coverage

The executable contract is [`CAPABILITIES`](../src/gateway/capabilities.js); the service projections are in [`context.js`](../src/gateway/context.js). All 70 canonical capability names explicitly requested in the integration specification are registered. Registration does not imply that every underlying game system offers a complete player-facing projection.

The registry contains 74 capabilities: those 70 plus `get_notifications`, `get_world_events`, `prepare_crafting_operation`, and `prepare_trade`. Every capability declares its action class, required scopes, and closed input schema. Account, inventory ownership, membership, balances, and eligibility are resolved server-side. A root context includes additional sections only when their scopes have been granted.

## Existing authoritative projections

| Area | Capabilities | Runtime source and boundary |
| --- | --- | --- |
| Player and inventory | `get_player_context`, `get_inventory`, `get_item` | Persisted own character/account state, `loadOwned`, `view`, and `inventoryBoard`. Item inspection supports known world-graph templates, owned instances, owned vehicles, legacy inventory items, and gear. No read triggers character accrual or creates game state. |
| Crafting eligibility | `get_crafting_recipes`, `get_missing_resources` | Existing `recipeCatalog`, including actual material, location, skill, cash and vehicle blockers. Preview is revalidated by the game on execution. |
| Mystery investigation | `get_active_mysteries`, `get_known_clues`, `get_mystery_context`, `get_related_discoveries`, `get_investigation_options` | Existing mystery discovery/board and clue-scroll board. Only visible node projections and the current riddle are returned. No scroll seed, backend solution, hidden prerequisite ID, or private puzzle answer is exported. |
| Coordination | `get_coordination_requests`, `get_coordination_opportunities`, `get_shared_discoveries` | Coordination catalog, issued actions, and Knowledge Engine ACL checks. Disabled/unavailable engines remain explicitly unavailable. Sharing does not grant access to another player's inventory. |
| Organizations | `get_crew`, `get_family`, `get_members`, `get_roles`, `get_group_objectives`, `get_group_activity`, `get_alliances`, `get_conflicts` | Current Crew and Family membership, published objective progress, dynasty marriages/advisory ties, treaties and coalitions. Explicit projections remove peer account IDs and conditionally include economic fields. No private messages or peer holdings are returned. |
| Territory | `get_territory_state`, `get_controlled_territory`, `get_contested_territory`, `get_territory_requirements`, `get_turf_economics` | Public district holders/contest deadlines and `territoryOf` for the caller's Family. Existing racket income, upkeep, upgrade and fortification quotes are reused. Sealed contest bids are omitted. |
| Missions | `get_available_missions`, `get_active_missions` | Unfinished mission catalog and the same `missionReadiness` requirement/cooldown helper used by `doMission`. Completed missions are excluded from available candidates. One-shot missions have no running instance; the response states this. Published base rewards are distinguished from payouts subject to modifiers and account reward latches. |
| Seasons | `get_season`, `get_season_progress`, `get_season_objectives`, `get_season_rewards`, `get_remaining_season_opportunities` | Existing season clock, historical recaps and Season Pass board. Remaining opportunities describe unclaimed track tiers and present claim readiness; they do not guarantee completion before the deadline. |
| Economy | `get_economy_context`, `get_player_economic_state`, `get_reward_sources`, `get_resource_values`, `get_omr_context` | Own game-ledger balances, wallet-link status, published mission/pass rewards, and authoritative base trade-good prices. Game balances are not represented as a live wallet balance. Reference prices are not executable trade quotes. |

## Deliberately bounded or partial projections

| Area | Capabilities | Exact limitation |
| --- | --- | --- |
| Crafting relationships | `get_item_uses`, `get_crafting_path`, `get_resource_sources` | Search only the authoritative published Phase 1 recipe catalog. Paths are bounded dependency candidates, not inventory allocation simulations, optimal plans, or exhaustive lists of farming/market/mission sources. |
| World graph | `get_world_context`, `get_related_entities`, `get_location_context`, `get_relationship_context`, `get_discovered_world_nodes` | Public item/recipe/source entities and separately authorized mystery nodes. Graph pages default to 25 nodes, capped at 100, with a continuation cursor; root contexts include at most 10 nodes. Related-entity queries return only one visible hop around the known entity. Edges require returned/known visible endpoints; unproven mystery edges are omitted. Each page checks current permissions again. |
| Changes and briefings | `get_world_changes`, `generate_brief_context` | World changes use published city event results. Briefings combine authorized current sections with bounded public world events and explicitly allowed personal notification metadata. Arbitrary notification payloads and unvalidated organization notifications are omitted. World-graph transition history is not fabricated. |
| Group requirements and resources | `get_group_requirements`, `get_available_contributions`, `get_group_resources` | Requirements expose current Crew operation roles and visible progress. Contributions expose only the caller's role projection and own inventory. Shared Family cash/ammunition/OMR balances are available with economic scope. Crews have no shared inventory authority; other members' inventory remains unknown. |
| Operation eligibility | `get_operation_requirements`, `get_eligible_operations`, `get_operation_readiness` | Opening eligibility comes from the existing discovery service. Readiness can identify unfilled roles and visible progress. Filled roles alone never imply that private evidence, ordered contributions or completion gates are satisfied; final validation remains in the operation service. |
| Social paths | `find_coordination_paths` | Connects authorized operation role slots with public Crew member candidates, the player's own authorized resources, and ACL-authorized knowledge. Own and shared knowledge are separate. Candidate membership is explicitly **unknown eligibility**, never a claim about another member's inventory or private clues. |
| Actionable context | `get_opportunities`, `get_actionable_context` | Deterministic candidates from existing recipe, mission, mystery, operation, coordination and pass previews. Actionable context supplies the nine requested category buckets and chooses no single best action. Empty Family/territory/economic categories are not filled with speculative eligibility. |
| Season rank | `get_season_rank_context` | Published historical records and own recaps; `liveRank` is explicitly null. |
| Protocol, POL and bonds | `get_protocol_state`, `get_pol_context`, `get_bond_context` | Published chain configuration, indexed liquidity status/freshness, recorded bond-funded POL and own recorded bonds. No live RPC balance, live LP valuation, executable bond claim quote, admin control, signing key or operational payload is inferred or returned. |

## Explicitly unavailable integrations

| Capability | Returned limitation |
| --- | --- |
| `get_territory_events` | No authorized durable territory transition source is registered. Current territory state remains available. |
| `get_liquidity_turf_context` | Indexed liquidity context is available, but there is no registered authoritative mapping from liquidity ranges to Family territory. |
| `get_rbs_context` | No authoritative RBS player projection is registered. |
| `prepare_transaction` | No registered public unsigned transaction builder. The Gateway accepts neither arbitrary calldata nor signing authority. |

The additional `prepare_trade` capability likewise refuses execution until an authoritative preparation adapter exists. These gaps are machine-readable, not simulated results.

Organization boards use optional bounded service queries, preserving ordinary game defaults. Gateway organization lists cap at 20 with truncation indicators; dynasty counterpart names use batched lookups. Root mission and mystery lists, inventory previews, and opportunity results are bounded. Truncation means that a follow-up focused query or the official game view is needed; it never means that an omitted entity is absent.

## Player-confirmed actions

`prepare_operation`, `prepare_coordination_request`, and `prepare_resource_pledge` stage a server-selected existing game command. The additional `prepare_crafting_operation` stages one craft or exact-vehicle salvage. Resource pledges refer to existing assigned operation steps; there is no generic arbitrary resource-transfer engine.

`submit_mystery_action` and `respond_to_coordination_request` are COMMIT-class capabilities. An agent invocation only stages a proposal. Execution requires the official player confirmation flow, progressive scopes, an unexpired proposal and a fresh authority preview. Existing game services revalidate their full rules and retain their durable idempotency behavior. Unknown/hidden node guesses, foreign operations and stale issued actions cannot be turned into preparation authority.

## Verification

`node test/gateway-context.js` covers scope minima, owner isolation, current membership changes, public versus hidden graph information, event metadata/payload boundaries, shared-knowledge delegation, own-resource-only coordination paths, strict/bounded inputs, all parameterless read/analyze capabilities, and absence of character-state writes. Mission eligibility is compared with the command gate for every published mission across low/high stats and active/inactive cooldowns. `node test/growth.js` verifies the unchanged game mission and progression behavior.
