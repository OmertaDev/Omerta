# Living World Director: disabled Dock War pilot

Base: `44f48a743e549591bd125a1f678099b8382dd78f`, fetched from `origin/main` before implementation. This is the knowledge checkpoint immediately following player-command milestone `979519c5640061f45584e926c56d8bc36cc4476f`. Work is isolated on `codex/living-world-director`; the preexisting site branch is preserved.

## Systems and authority

The Director observes canonical facts, ranks eligible authored situations, records lifecycle decisions, and notices committed consequences. It owns no inventory, territory control, evidence, operation readiness, mystery progress, or money. Those remain in World Kernel, Knowledge, Coordination, Mystery Runtime, and the existing economy. Ordinary domain operations remain valid independently of the scheduler; a Director situation does not replace world-action authority.

The implemented pressure inputs are material deficit, actual Family control, recent operation failure fraction, and authenticated discovery-source activity. Material deficit is `(required - held) / required`, clamped to `[0,1]`, where required is the largest material cost of one admitted response and held is the controlling Family's current canonical stock. Unlike resources are never summed. No demand is invented to force eligibility. The Dock War requires a real constrained route and an actual wire deficit. Other potential pressure categories remain future content work.

Observations retain canonical references and bounded receipts. Population reads cap at 5,000 live active-account characters; stock reads at 10,000 rows fail conservatively to abundant rather than invent scarcity. The operation sample is at most 128 entries from seven days; discovery-source activity caps at 32 distinct sources. Object definitions, revisions and mutation events are checked against World Kernel authority. No canonical event history is copied wholesale.

## Database changes

Seven additive tables:

| Table | Purpose |
| --- | --- |
| `director_definitions` | Immutable admitted Situation/Campaign bytes and version/hash pins |
| `director_clock` | Cross-worker scheduling lock and monotonic observation watermark |
| `director_campaigns` | Campaign identity, current node, deadline and lifecycle |
| `director_situations` | One shared situation, pinned definition, lifecycle and canonical event reference |
| `director_receipts` | Stable evaluation/create/escalation/expiry/resolution/transition identities |
| `director_selections` | Private bounded facts, rejected-candidate reasons and selection audit |
| `director_action_intents` | Account/character-bound intent linking issued commands to existing domain receipts |

Indexes cover active work, scope/history, evaluation time, intent lookup and recent claim observation. Seventeen additional constraints are explicitly inventoried in the native upgrade witness. Action intents survive character death as reconciliation history; a successor cannot execute them. Migration uses the existing locked additive boot migration.

## Director, Situation and Campaign contracts

`createLivingWorldDirector({pool, content, definitions, mode, accountIds})` exposes `tick()`, the existing projection-planning protocol, command delegation, receipt reconciliation and aggregate metrics. Clock injection is internal test/simulation support; clients cannot choose time or tick identity. The production worker evaluates every five minutes with an in-process overlap guard and a database lock shared across workers.

Definitions are inert data, deep-frozen after compiler admission. A running row pins both version and content hash, including canonical dependency hashes. Same-version replacement, missing versions and tampered persisted admission bytes fail closed. Deployments must retain the exact admitted dependencies while work is active; there is no arbitrary hot replacement of a live world definition.

Situation definitions declare canonical fact predicates; semantic pressure inputs; audience/knowledge contracts; safe text signals; finite states; timed escalations; canonical-event resolutions; expiry/recovery; cooldowns; concurrency; participant minima; existing command, operation and mystery adapters; rarity and weight. The closed delegated command catalog is `discovery.start`, `mystery.start`, and `operation.create`. Normal discovery actions, clue sharing, crafting, role commitments and operation execution continue through their existing commands.

Campaigns are finite directed graphs of situations. Branches require both a preceding committed outcome and canonical predicates. No random branch creates contradictory world facts. The first Dock War resolution leads to a distinct restoration or maintenance situation. Recovery records abandonment and can offer the still-eligible aftermath under a new campaign identity linked through a `recoveryOf` receipt; it never resets physical state.

`npm run director:check` compiles the pilot. `node tools/director-validate.js proposal.json` validates a proposed `{situations,campaigns}` bundle against admitted content, without admitting or activating it. The reusable compiler/runtime accept other bundles without changes to scheduler code. Validation rejects malformed data, impossible fact predicates, unreachable or cyclic lifecycle/campaign graphs, absent recovery/cooldowns, conflicting terminals, unknown actions, invalid mutations, invalid dependency pins, unsupported economic effects and audience/signal mismatches. Review of literal prose remains necessary: a static compiler cannot determine whether an author wrote a secret into a sentence.

## Pacing and recovery

Hard limits are 32 active situations, 32 active campaigns, four starts per evaluation and 64 candidate evaluations. Situation policies can tighten these limits. Territory and scope concurrency default to one; Family demands cap at six, Crew at four, and player cards at three. Ranking favors pending campaign branches, then explicit bounded pressure/weight, then a deterministic identity. Common/uncommon/rare divide ranking weight by 1/2/4; rarity is not an unrestricted random draw.

The pilot permits at most two equivalent offers per seven-day window, a one-day cooldown and five minutes of quiet between situations. History saturation fails closed. A quiet world receives no manufactured emergency merely to keep a counter moving. Supplies exhausted by players remain exhausted until existing acquisition/production rules provide more.

Recovery is the implemented one-attempt `expire` policy, using the actual lifecycle deadline. Server/worker restart resumes persisted work. Membership changes and succession revoke old action authority; remaining or replacement players can investigate, share and organize through normal rules. Missing items can be replaced through ordinary acquisition and crafting. Orphaned control or season changes produce an explicit recovery receipt; expiry abandons unfinished campaigns without deleting world consequences. Existing operation cancellation/expiry/refunds retain custody authority; the Director never releases escrow itself. A recovered campaign remains subject to its cooldown and repetition budget.

After a worker outage, canonical event timestamps determine whether work completed before its deadline. Completed work remains completed even when observed late. Unfinished work retains its eligible aftermath node so a recovery campaign can resume it. An operation completed after its deadline still changes the physical world through ordinary rules, but does not retroactively count as timely campaign completion.

## Command, Coordination, World and Knowledge integration

The current command API remains the only new player-facing mutation entry point: clients submit an issued opaque execution identity plus confirmation. The Director does not add a situation-enumeration endpoint or accept authored action payloads from clients. Situation actions use the existing whole-board freshness check and their own deadline. Domain transaction admission hooks recheck the current actor, knowledge, membership, situation revision and canonical world revision at commit time.

Director and ordinary cards use one authenticated knowledge read snapshot. Signals distinguish informed controlling Family, informed rival Family, local Crew rumor and independently corroborated canal evidence. A player can see several authorized signals for the same situation; all sides share its identity and one world object. Public aftermath appears only after a real consequence. The UI displays authorized facts, objectives, helpers, available commands and deadlines, never pressure scores or definition metadata.

An operation is created through `createFamilyOperations`, then uses the existing published roles, promises, real item/material custody, approvals and deterministic resolution. Opposing operations contend on the same World Kernel revision. One can commit; the other retains the existing recovery/refund path. Crafted seals and wire are consumed by existing mutation accounting; discovery and Mystery Runtime produce evidence through their existing authenticated provenance.

The peaceful option uses two distinct members of one Crew inside the existing Family operation service. It still requires Family leadership to initiate. This does not introduce independent unaffiliated-Crew world-mutation authority. No autonomous NPC economy adapter is admitted in the pilot; system behavior is limited to scheduling and declared signals, with zero permission to create assets or bypass world rules.

## Economic effects

The Director itself has no resource grants, price writes, OMR effects or cash rewards. A real car acquisition and salvage fund the route seal recipe; seal production consumes scrap steel and salvage parts. Establishing the route consumes one wire. Protection/interception each consume two wire and a seal; the canal branch consumes one wire and a seal. Restoration uses the declared existing operation costs. All mutations and provenance remain in the established economy/item/world services. The general economy simulation remains a separate verification from the Director model.

## Simulation and verification

`npm run director:sim` runs nine deterministic canonical-state models for 1, 7, 30 and 180 days: low/medium/high population, Family-dominated, fragmented Crew, shortage, territory war, quiet and high-mystery worlds. The model uses the production compiler, selector and pressure functions. Its full report explicitly separates model results from native database proof.

Across the nine 180-day models: 995 situations generated, 603 completed, 291 campaigns completed and 388 recovery uses. Maximum active situations were 10; maximum starts were four per tick and repetition two per window. Director minting, OMR delta, resource conservation error and lifecycle dead ends were zero. The finite-stock shortage fixture leaves three unfunded scopes visible. A quiet world generates zero invented conflicts. Counts for different horizons overlap and must not be summed as independent runs.

Native and memory suites cover the three complete issued-command journeys, canonical second-generation situations, actual resource provenance/conservation, hidden enumeration, cross-Family denial, forged/stale/expired actions, membership/succession/revocation, receipt replay, duplicate workers, concurrent opposing operations, canonical observation races and populated migration. See [security review](SECURITY-REVIEW.md), the retained evidence and source manifest for exact executed commands and scope.

The full repository sequence found a missing preflight classification for the new feature flag and stale module/table/test census figures in two required documents. Those are fixed; failing gates and the remaining sequence are rerun from their checkpoints, with earlier passing suites retained. The execution record distinguishes this from claiming a single uninterrupted successful `npm test` invocation.

### Completion gate evidence

| Required behavior | Executable evidence |
| --- | --- |
| Situation definitions compile; immutable version/hash admission | `director-definitions`, `director-runtime`, `director:check` |
| Bounded selection and canonical pressures | `director-runtime`, `director-simulation` |
| Persistent situations and retry identities | Native `director-runtime`, `director-commands`, `director-migration` |
| Explicit escalation | `director-runtime` |
| Conflicting objectives and information asymmetry | `director-dock-world`, `director-api`, `director-journey` |
| Commands consume opportunities; Coordination consumes objectives | `director-commands`, all three `director-journey` branches |
| Existing services mutate World Graph; Director observes consequences | `director-dock-world`, `director-journey`, native `director-security` |
| Campaign branches and second-generation situations | All three `director-journey` branches; `director-recovery` catches up multiple intervening outcomes |
| Recovery without erasing consequences | Memory/native `director-recovery`, `director-runtime`, `director-dock-world` |
| Economy conservation | Real acquisition/crafting/operation journeys, Director model, existing economy simulation |
| Simulation | Nine scenarios at four horizons in [simulation.json](evidence/simulation.json) |
| Security and PostgreSQL behavior | [Scoped review](SECURITY-REVIEW.md) and [execution record](evidence/README.md) |
| Complete Dock War vertical slice | Native issued-command protection, interception and peaceful Crew canal journeys |

The peaceful branch requires independent mystery evidence and Crew cooperation; interception changes the controlling Family. Their aftermaths differ in canonical action, cost and restoration path. The completed-route catch-up records an already committed restoration without offering stale work or reapplying its cost.

## Flags and deployment requirements

`LIVING_WORLD_DIRECTOR` defaults to `DIRECTOR_DISABLED`. Supported stages:

| Stage | Behavior |
| --- | --- |
| `DIRECTOR_DISABLED` | No Director worker, new catalogs or signals |
| `INTERNAL_SIMULATION` | Offline tooling only; production tick is a no-op |
| `SHADOW_MODE` | Private evaluation receipts only; no situations, world mutations or new player catalogs |
| `LIMITED_COHORT` | Explicit `DIRECTOR_ACCOUNT_IDS` exactly matching the existing world cohort |
| `LIVE` | Existing world policy plus Director lifecycle/pacing |

All non-disabled stages require existing Core Progression, World Graph, Coordination, Knowledge, sharing and operations flags. Invalid stages or incompatible cohorts fail startup. Limited mode deliberately shares the foundational cohort so direct existing content APIs cannot expose new authored catalogs outside it.

Deploy schema before compatible API/worker code through the existing migration/runbook. Preserve admitted content while active work exists. Keep all feature flags disabled until operator review; then use shadow and a bounded cohort. No production flag, deployment, external database or live account was changed by this work. Board execution reserves capacity for both its lock and the underlying domain transaction; PostgreSQL pools must have at least two connections. Metrics expose fixed aggregate active/generation/resolution/expiry/recovery/error/backlog counts and rates plus evaluation/selection latency; they contain no actor or audience labels.

The release follows the repository's knowledge workflow: commit authored changes first, regenerate on a clean tree, then commit the generated checkpoint separately. The Director remains disabled during production rollout; later activation uses the stages above.

## Remaining work and recommended next milestone

This is one bounded authored pilot, not a general autonomous content generator. Broader pressure categories, NPC behavioral adapters, unaffiliated Crew authority, long-lived multi-version content retirement, audit/intent retention and operational population tuning require separately reviewed work. Audit/history saturation is intentionally fail closed. Existing domain actions stay usable when a scheduled offer expires, subject to their own canonical prerequisites; no scheduler monopoly was added.

Recommended next milestone: shadow deployment and limited-cohort observation of the Dock War, comparing real opportunity load, completion, recovery and contention with the simulation. Expand content only after those measurements justify the pacing and recovery policies.
