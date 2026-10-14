# OMERTÀ marketing video fact matrix

Repository inspection prepared 2026-09-24 before the initial scripts. Revised campaign setting: the user has specified a fully live release. The matrix retains actual status at inspection; the films use the future launch assumptions in [the release brief](02-LAUNCH-ASSUMPTIONS.md). This distinction preserves source truth without putting development warnings in the advertisements.

## Source and status

`git fetch origin` confirmed latest main **32859cf7d198d2a003160b2bb1ef005991697d73**, dated 2026-09-20. The working branch is `codex/site-copy-ui-upgrade`, HEAD **e56cf576065c5f1bbb9bb55115f5961267f7d654**, with pre-existing changes. Those changes were preserved. Main is substantially newer than the checkout in world systems. Uncommitted Consigliere work is a separate prototype, not evidence of integration with main.

**Latest RC1 decision: BLOCKED.** Fresh solo progression cannot produce its required world consequence under existing Family/Crew authority; mobile and population evidence is incomplete. The connected campaign service loop passes for seeded participants. These are different findings. See [RC1 decision](https://github.com/OmertaDev/Omerta/blob/32859cf7d198d2a003160b2bb1ef005991697d73/docs/release/RC1-READINESS.md#L3-L10), [demonstrated loop and limitations](https://github.com/OmertaDev/Omerta/blob/32859cf7d198d2a003160b2bb1ef005991697d73/docs/release/RC1-READINESS.md#L59-L97).

Status vocabulary:

- **Implemented:** source implements it; current production enablement is unverified.
- **Gated:** implemented behind disabled/default-off flags or release requirements.
- **Component-ready:** bounded component checks passed; does not mean release-ready.
- **Experimental:** local prototype or a separately bounded content/runtime experiment.
- **Planned:** design only, or broader capability not established by implementation.
- **Deployed/dormant:** a deployment manifest exists, but activation is false.
- **Live:** requires current runtime evidence. **No current production activation was verified in this review.** Older documents calling the game or MCP “live” do not prove today's flags or release state.

Evidence aliases below resolve at the pinned main commit unless prefixed LOCAL:

| Alias | File |
|---|---|
| CORE | `docs/core-architecture/IMPLEMENTATION.md` |
| CMD | `docs/core-architecture/PLAYER-COMMAND-CONTRACT.md` |
| HANDOFF | `docs/core-architecture/PLAYER-COMMAND-HANDOFF.md` |
| DIRECTOR | `docs/living-world-director/HANDOFF.md` |
| NETWORK | `docs/living-world-director/WORLD-CAMPAIGN-NETWORK.md` |
| FEED | `docs/living-world-director/OPPORTUNITY-FEED.md` |
| NETSRC | `src/content/campaign-network.js` |
| RC1 | `docs/release/RC1-READINESS.md` |

## Fact matrix

| ID | System | Status at inspection | Supported mechanic / full-release treatment | Evidence |
|---|---|---|---|---|
| F01 | Core gameplay | Implemented; release blocked | Browser mafia RPG: choose actions, manage resources/heat, acquire assets, cooperate/compete. New world progression requires real group authority; never imply a fresh solo player can instantly finish it. | `README.md:16–29,65–72`; RC1:69–83 |
| F02 | World Graph | Gated; component-ready | Connects actual player, Crew, Family, territory, inventory, information and operations. Translate as “the city remembers” for committed world changes, not omniscience. | CORE:16–29,33–45 |
| F03 | Living World Director | Gated | Observes canonical conditions, selects authored situations, tracks committed consequences. Cannot invent evidence/assets, resolve an operation or move money. No generative infinite story claim. | DIRECTOR:7–11,27–35; `src/director/config.js:19–25` |
| F04 | Campaign Network | Gated | Missing Shipment → diverted depot → Black Market → exposure → Informant is implemented. Branches require actual prerequisites. | NETWORK:3–17; RC1:59–66 |
| F05 | Opportunities | Gated | Prioritized, authorized next moves with known preparation, collaborators and genuine deadlines. Hidden work is not leaked; “related business” is not always proven causation. | FEED:3–17,39–46 |
| F06 | Player Commands | Gated; component-ready | Player chooses server-issued actions; current authority and requirements are checked at execution; consequential actions show confirmation. | CMD:7–38 |
| F07 | Coordination Engine | Gated | Family operations implement roles, promises versus contributions, knowledge, escrow, approval and resolution. Old Phase 0-only README is superseded by the newer component record. | CORE:78–90 |
| F08 | Crews | Implemented; new world adapters gated | Current members contribute their own items/intelligence. Same-Crew requirements are definition-specific. Membership is not a permanent authorization grant. | CORE:19,78–90; NETSRC:136–152; `src/crew.js` |
| F09 | Families / hierarchy | Implemented; world authority gated | Boss/underboss permissions matter; individual contributions require the owner's action. Four-person Foundry operation is a real pilot, not a requirement for every operation. | CORE:21,78–90; `src/social.js` |
| F10 | Territory | Implemented; new world control gated | Existing district seizure/war differs from control of a route/object. A successful authorized operation can change canonical control/state. Neither implies ownership of LP principal. | `README.md:69,108`; CORE:21–23; NETWORK:9–17 |
| F11 | Markets | Implemented; campaign market gated | Existing goods/escrow Exchange coexist with Canal market infrastructure. Canal establishment does not mint vendor stock or automatically move token price. | `src/economy.js`; `src/social.js`; NETWORK:12–17 |
| F12 | Crafting | Implemented; knowledge-gated progression gated | Inputs are consumed; knowledge/location can unlock a recipe. Canal Cargo Seal uses salvage inputs at Foundry. No automatic OMR reward from crafting. | CORE:25–27,41; NETSRC:49–59; `src/crafting.js:936–970` |
| F13 | Inventory | Implemented | Real custody, owned unique items and fungible resource balances. UI can show only the authorized owner's inventory or deliberately contributed resources. | CORE:27–29; `src/items.js:970–1069` |
| F14 | Item provenance | Implemented | Creation, transfer, use and consumption history; “this was crafted from salvage” is valid. Provenance alone is not an NFT export or public history of every owner. | `src/items.js:970–1086`; CORE:23 |
| F15 | Materials | Implemented | Scrap steel, wire, salvage parts and other admitted materials are physical game resources. OMR is separate. | `src/content/core-materials.js`; `src/content/automotive-salvage.js`; NETSRC:56–59 |
| F16 | Salvage | Implemented | Consumes a real owned eligible vehicle through salvage service; outputs enter custody. Do not portray arbitrary stolen scenery as an eligible asset. | `src/crafting.js:970`; CORE:41; HANDOFF:49 |
| F17 | Facilities | Gated bounded content | Foundry Archive and Canal Supply Depot have states, location, requirements and control. Not an unlimited facility-building sandbox. | CORE:21–23,41; NETSRC:81–87 |
| F18 | Professions | Broader item-profession system planned | Existing skills/trade ranks are implemented; they do not establish the proposed Phase 2b profession/blueprint ladder. Omit profession leveling claims. | `src/skills.js`; `docs/superpowers/specs/2026-09-04-world-graph-phase-2b-professions-blueprints-design.md`; no matching profession service in examined main |
| F19 | Durability / tool economy | Bounded implementation; broader plan | Authored content crafting has tool durability/repair state. Do not generalize to every World Graph item or the whole proposed Phase 2c system. | `src/content/crafting.js:124–140,261–281`; `src/content/compiler.js:684–691`; Phase 2c design |
| F20 | Mysteries | Gated bounded content | Investigations use actual knowledge, item provenance, location and operation receipts; evidence can reveal an irreversible branch. Not an endless procedural murder generator. | CORE:120–154; NETSRC:88–121 |
| F21 | Evidence | Gated | Independent original evidence can corroborate a public disclosure. Duplicate forwarded claims do not become independent proof. | NETSRC:122–132; CORE:25,144 |
| F22 | Asymmetric information | Gated | Own/private/shared/public views differ; hidden requirements stay hidden. A public object does not expose its private past. | DIRECTOR:55; FEED:18–32 |
| F23 | Knowledge systems | Gated | Authentic discoveries and deliberate sharing grant access; revocation or membership loss can remove it. No AI access to all secrets. | CORE:25,144; FEED:26–31 |
| F24 | Logistics | Implemented; new campaigns gated | Existing convoys/port systems; buyer-owned bulk cargo ships from the buyer’s trunk. Partial ambushes respect capacity; a funded destination toll requires another Family’s territory. New canonical shipment-route states require materials and group actions. No magical teleport from trade to warehouse inventory. | `src/market.js:314–333`; `src/convoy.js:70–99,254–266,327–347`; `src/port.js`; NETWORK:9–15 |
| F25 | Law pressure | Implemented; Director use bounded | Heat, law and court systems exist. Director can observe authored pressure; it does not automatically summon an arrest for every suspicious event. | `src/law.js`; NETWORK:25–29 |
| F26 | Dynamic world state | Gated persistent objects | Actions commit state and events together. Distinct recovery/interception/destruction/exposure outcomes persist. | CORE:21–23; NETWORK:11–15 |
| F27 | Persistent consequences | Gated; demonstrated in seeded journeys | History survives restart/replay; UI filters visibility. “Remembers this consequence,” not “remembers every betrayal forever.” Some tested branches did not produce follow-up opportunities. | RC1:59–66,85–97; FEED:18–46 |
| F28 | Seasonal systems | Implemented; funding/chain gates separate | Existing rollover, modifiers, objectives/rewards. Do not promise a payout to all participants or assert new world pilots emit OMR. | `src/worker.js`; `src/season.js`; `src/server.js:1940–1951` |
| F29 | OMR | Implemented ledger; chain rails gated/dormant | Distinct from gameplay cash and materials; cash cannot buy OMR. Present as a usable game token, never investment/earnings pitch. | `src/economy.js`; `src/chain.js`; `docs/WIKI.md` |
| F30 | OMR sources | Implemented/configured; economic and chain gates | Authored reward paths and finite configured distributions exist. Source depends on subsystem/version; no guaranteed earnings. World Graph/Family operation completion is not a new token faucet. | `src/growth.js`; `src/worker.js`; CORE:86,90; `src/agentgateway.js:1727` |
| F31 | OMR sinks | Implemented ledger paths | Vanity and specified service uses exist. Some token flows redistribute rather than burn. Show a title customization, not an invented universal burn. | `README.md:114–122`; `src/vanity.js`; `src/desk.js` |
| F32 | Escrow | Implemented; new Family operations gated | Exchange/bounty custody and Family-operation custody differ. Operation capital is gameplay cash, explicitly not OMR. | CORE:80–86; `src/social.js`; `src/market.js` |
| F33 | Bounties | Implemented | Funded player/Family contracts, expiry/refund and claim rules. No invented automated AI assassination or fixed return. | `README.md:110–112`; `src/social/contracts.js:15–19,114–139` |
| F34 | Bonds | Legacy deployed dormant / V2 candidate | Legacy minting model and V2 funded-inventory sale model are different. No active purchase CTA, APY or invented discount. | `omerta-contracts/DEPLOYMENT.md`; `omerta-contracts/docs/market-v2/DESIGN.md`; `src/bonds.js` |
| F35 | Treasuries | Gameplay implemented; chain policy separate | Family gameplay treasury funds authorized costs/contracts. Do not animate salvage cash depositing directly into an onchain treasury. | `src/territory.js:1–8,57–66`; `src/social/contracts.js:199–217`; `src/community.js:24–33`; CORE:86 |
| F36 | Protocol-owned liquidity | Deployed dormant legacy / V2 candidate | Protocol custody of liquidity. Under L02–L03, Core funding and separately configured seasonal Turf ranges operate; designated Turf LP fees can support Family credits while principal stays protocol-owned. | `omerta-contracts/deployments/4663/manifest.json:3,255–262`; market-v2 design |
| F37 | Uniswap v4 / OMERTÀ Hook | Implemented candidate, not established active | At the assumed full release, show the canonical Hook operating under L02. Use an actual settled receipt. Its POL fee allocation funds Core; designated seasonal Turf LP fees follow a separate bridge. | `omerta-contracts/docs/market-v2/DESIGN.md`; `docs/WIKI.md`; deployment manifest |
| F38 | Liquidity territory | Candidate/gated | Turf rights concern future funded LP fees, not withdrawal/ownership of pool principal. Keep this separate from game district control. | `omerta-contracts/docs/market-v2/DESIGN.md:48,95–103`; `omerta-contracts/src/market-v2/OmertaTurfV2.sol:11–13` |
| F39 | NFT-compatible / provenanced items | Provenance implemented; export readiness distinct | Export eligibility is item-specific. The Canal Cargo Seal is explicitly nontradeable and non-exportable. Never show “mint seal NFT.” | NETSRC:32–35; `src/content/core-materials.js:29–34`; `src/items.js` |
| F40 | NFT rails | Deployed/gated, not universal item ownership | Character/gear contract rails are separately scoped. Contract existence does not turn every inventory item into an NFT. | `README.md:35–47`; `omerta-contracts/DEPLOYMENT.md` |
| F41 | RWA integrations | Staged shells / planned activation | Remains outside these masters: the full-release setting does not establish a specific completed player-facing RWA integration to dramatize. | `omerta-contracts/DEPLOYMENT.md`; `omerta-contracts/docs/market-v2/DESIGN.md` |
| F42 | Onchain settlement | Implemented/devnet proof; dormant manifest | Wallet/voucher/watcher paths exist. Requires configured, funded, activated rails; in-game event persistence is not a blockchain transaction. | `README.md:31–48,76–80`; deployment manifest |
| F43 | AI Agents / Agent Turn | Implemented, bounded | Can expose permitted state and allowed actions. Deep City exploration is read-only; World Graph actions are excluded from autonomous Agent Act. | `src/agentgateway.js:1705–1707,1725–1727` |
| F44 | Consigliere adviser | LOCAL experimental | Scoped adviser, staged proposals and official human confirmation. Not proved deployed/integrated at inspection; L04 explicitly assumes the same released world/command integration for the launch film. No specific Muse interoperability claim. | LOCAL `docs/agent-gateway-capabilities.md:11–31,48–52`; `docs/agent-gateway-review/README.md:95–101` |
| F45 | Autonomous / semi-autonomous agents | Bounded implementation | Agent Alpha has limited permitted actions; excludes wallet, mint, withdrawal, PvP and borrowing automation. Do not label all agent actions approval-per-click if bounded automation exists. | `src/agentgateway.js:1705–1707`; LOCAL gateway capabilities |
| F46 | Human approval | Implemented boundaries | New player commands revalidate confirmation/authorization; local adviser proposals need human confirmation; contributions require each owner. No officer/AI silently spends a teammate's inventory. | CMD:19,27–38; CORE:82–86; LOCAL capabilities:48–52 |
| F47 | Betrayal / social history | Events implemented; guilt inference unsupported | A participant notebook can prove their own disclosure action; it does not establish whether it was authorized or betrayal. No psychic rat detection. | NETSRC:107,120,166–173; NETWORK:13–15 |
| F48 | Other current mechanics | Implemented; per-system gates | Crime/skills, garage/armory, businesses/rackets, kitchen, loans, contracts, law/courts, death/estate/succession and diplomacy are in source. Not all needed in these three films. | `README.md:18–29,65–80`; `src/dynasty.js`; `src/diplomacy.js` |

## Full-release story boundaries

1. The masters promote the fully live game under the user’s updated brief. Development/prototype/inactive labels are removed. [L01–L05](02-LAUNCH-ASSUMPTIONS.md) describe the producer’s release assumptions.
2. Video 1 shows the four-person Foundry operation and a visibly separate shipment/market/investigation example. One does not magically cause the other.
3. Video 2 demonstrates game cash, a separate human-confirmed OMR sale, Hook funding to POL/Core, and a separately registered seasonal Turf siege. Future funded fee rights can change holder; principal and historical credited fees are not seized.
4. Video 3 assumes an integrated release Consigliere. Permitted context, evidence, proposals and human authorization define the interface. Its characterization is scripted; footage of the actual adviser must use that same released integration.
5. Disclosure evidence is still not guilt. Full release does not add psychic betrayal detection, private-message surveillance or invented information access.
6. “Not a cutscene” refers to the actual game-state consequence, paired with STAGED VISUALS · GAME STATE when acting and interface footage meet.
7. No invented tokenomics, guaranteed return, universal Hook tax or automatic crafting-to-OMR conversion. No merely speculative profession, NFT-export or RWA capability is silently added.

## Evidence limits

The source statuses above describe the inspected revision, not the assumed publication date. This revision changes creative positioning and production instructions only. No feature is activated and no new deployment, test result or release approval is claimed. Production captures should identify the actual advertised release and its configured rules; current historical limitations remain traceable here rather than appearing as audience-facing caveats.
