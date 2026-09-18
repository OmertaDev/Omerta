# World Campaign Network implementation

Base: `621cfbb4070e0fded63ce0a0a7fc91e7b00a2b4e`, branch `codex/world-campaign-network`, isolated worktree `Omerta-campaign-network`. Phase: disabled implementation and local verification. The original site and Director worktrees are preserved. No deployment, production database access, contract change, or feature activation is part of this work.

## Authority and content

The existing compiler, Director scheduler, Player Commands, Family operations, Knowledge, Mystery Runtime, item custody and World Kernel remain the authorities. New situations observe facts and issue ordinary commands. They cannot grant inventory, create evidence, resolve an operation, change control or refund an item. Physical changes still commit through Family operations and the World Kernel, with item provenance and domain receipts in the same transaction.

Dock War version 1 retains its exact source and compiled hashes. The additive Canal Supply Depot is an ordinary canonical world object. Registering a dispatch requires the real disrupted dock route and consumes a crafted cargo seal and existing wire. Its state is infrastructure/route state, not a parallel shipment inventory or currency balance.

* **The Missing Shipment:** recovery, interception, destruction, and redistribution have distinct canonical outcomes. Redistribution requires the dispatch mystery, a crafted seal, and members of one Crew. Recovery can fail through the existing deterministic operation resolver.
* **The Black Market:** a genuinely diverted depot enables establishment; supplying, restoring supply, seizing control, and exposing the market consume existing resources through domain rules. Exposure produces the canonical state that enables an investigation. There is no generated vendor stock, free reward, or new trading ledger.
* **The Informant:** public disclosure and actual unsuccessful operations create different concerns. Independent original investigators can corroborate a public paper trail; actual participants can examine failed-operation evidence. A participant-only notebook proves the reader's own disclosure action from its real operation receipt; it does not infer authorization, betrayal or guilt. Securing records, recording an unresolved concern, and publishing a disputed allegation leave different consequences. No definition names a guilty player, and failure or allegation is never proof of guilt.

Cross-campaign eligibility names canonical conditions, not downstream campaign IDs. Black Market's finite establishment-to-supply branch uses the existing campaign graph. A proposed scarcity-only establishment path was removed during review: no existing authoritative operation prerequisite could enforce that stock deficit at execution. The delivered market origin uses a route state checked by the domain service. No weak substitute or Director-only economic permission was added.

## Framework contracts

New Situation definitions carry an optional `network` contract; existing definitions do not gain fields or change hashes. It declares the seven closed competition classes, six domains, related-world state prerequisites, seven information layers, and a bounded consequence vocabulary. Competition describes authored play; domain transactions still decide winners. Related objects are hash-pinned and read under ordered locks, and action admission rechecks their current state. Content operations independently enforce their applicable world, knowledge, participant, item and mystery prerequisites.

Compiler checks include audience/layer compatibility, mandatory Knowledge for secret situations, bounded cooperation, supported consequences, closed fields, exact dependencies, unreachable or expired escalations, and forbidden internal metadata in player text. Diagnostics identify the definition and field. Literal prose still requires review; a compiler cannot recognize every semantically encoded secret. A fifty-Situation fixture verifies capacity without shipping fifty shallow stories.

`retainedDefinitions` permits a bounded set of separately compiled old bundles alongside the current bundle. Active rows resolve their exact version/hash and campaigns resolve pinned Situation hashes. Only current campaigns start new work. Same-version replacement and changed world/operation/discovery/mystery dependencies fail closed. This is explicit retention with compatible domain dependencies, not arbitrary hot replacement or automatic content migration.

## Pressure and pacing

Memory reads one indexed observation per six-hour bucket over seven days: at most 28 observations. Canonical event and operation samples retain 32/128 bounds. Recent outcomes use an indexed resolution-time window, so older operations resolved recently are included. Discovery observation reads at most 257 indexed rows once before deduplication; saturation fails conservatively. Signals include repeated shortages, failed operations, continuous control, control changes, discoveries, and authored peaceful/violent labels on committed actions. Unknown or saturated history contributes no historical pressure and cannot start a contested network situation. Low measured activity also suppresses new contested network situations. None of these pressure signals changes world or economic state.

The existing global/per-scope/per-Family budgets, cooldowns, repetition windows, deadlines, recovery receipts and worker lock remain in force. There is no new unbounded event consumer or second world database. Historical samples are private scheduling evidence, not player facts or resource authority.

## Player experience and history

Authorized opportunities are grouped as Urgent, Family, Crew, Personal, Intelligence and World. Ordering uses visible state, actual opportunity deadlines, readiness, current commitments and continuity, with a stable tie-break. Command-board refresh expiry is not presented as a fictional emergency. Cards explain known requirements, missing preparation, helpers, stakes and progress; opaque issued commands still execute every action. Ranking values and Situation revision bookkeeping are excluded from public DTOs.

History reads canonical World Kernel events through the existing authenticated Knowledge snapshot. A currently public object does not grant access to its earlier private states. Indexed per-state windows have a hard 64-query/1,600-row budget and return at most 24 events. The new visibility index is additive; no event is copied or rewritten. The depot has delayed public aftermath; genuine prior Knowledge can reveal a known consequence sooner. Hidden events cannot crowd out public history or change its truncation count. Unknown actors and causes remain absent.

Family/Crew grants authorize history through the existing Knowledge service and revoke on membership change. Private history uses the conservative label “discovered intelligence”: incoming grant origin is deliberately absent from the existing Knowledge DTO, so it is not guessed from current membership. Related-business links use only already-visible matching subjects; they do not claim to establish causation. The mobile Command Center uses the existing renderer and confirmation/retry controls.

## Verification and review record

Before edits, 57 relevant memory suites and 33 native PostgreSQL suites passed at the pinned base. Native tests used a newly initialized loopback PostgreSQL 18.4 cluster and disposable schemas. An initial scratch-cluster lock-capacity error (`53200`) was retained and corrected by increasing only that cluster's `max_locks_per_transaction`; all 33 native files were rerun successfully from the untouched base. It was not a gameplay assertion failure.

New evidence includes complete issued-command campaign journeys; distinct physical branches; real acquisition, salvage, crafting and custody; Knowledge asymmetry; actual failed-operation evidence; two-Family contention; duplicate workers and commands; membership/Crew/item/deadline changes; delayed observation and restart; native transactional interruption after attempted consumption; exact success/cancellation replay; pinned version coexistence; and private/delayed consequence enumeration attacks. Existing recovery/death/succession and domain suites remain required.

The simulation declares a seed and exercises 13 archetypes at four horizons, plus 13 authored-network scenarios. It reuses production content, compiler, selector and pressure aggregation. Physical resolution in the long-horizon model remains modeled; real custody, Knowledge admission, concurrency, rollback and canonical consequences are proved separately by domain-service integration tests. Model conservation counters are not claims about production monetary balances or traffic capacity.

Review follows the repository [agent-led review policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md), adapting its pinned trust-boundary, accounting, execution-trace, invariant and false-positive methods to the changed JavaScript services. No Solidity/reentrancy/oracle audit is claimed because those surfaces are unchanged.

| Finding and severity | Resolution and evidence |
| --- | --- |
| WC-01, high: A scarcity-only market predicate had no domain execution adapter, allowing stale economic eligibility | Removed the branch; diverted-route eligibility is revalidated inside the existing operation authority. |
| WC-02, high: Retained Situation dependency checking omitted mystery graphs, allowing changed evidence semantics | Added exact mystery hash checks and a changed-graph rejection regression in `director-network`. |
| WC-03, low: Inherited opportunity priority and Situation revisions exposed implementation details | Removed public ranking values and Situation revision fields while preserving private issued descriptors and stale-command admission. |
| WC-04, medium: Filtering event history after a shared limit could expose hidden activity through missing public results | Query only authorized state windows through the new visibility index; adversarial private-history saturation/delay tests cover this. |
| WC-05, medium: Unavailable pressure history could bypass quiet-world suppression | Contested network situations now require measurable recent activity; saturation cannot increase conflict generation. |
| WC-06, low: A creation-time sample omitted older operations resolved recently, understating pressure | Added the bounded resolution-time query and index, with an actual failed-operation timestamp regression. |
| WC-07, low: Long-horizon model attached violence labels absent from immutable Dock definitions, overstating simulation coverage | Removed model-only labels; positive Law pressure is tested against actual authored network implications. |
| WC-08, medium: Public mystery invitations implied a hidden event had already happened | Reworded invitations so they assert no hidden world fact; raw catalog and selected-board enumeration tests cover all new entries and private witness records. |

The broader documentation check separately reproduced an existing base-revision census mismatch (1,046 declared Foundry tests versus 1,048 in source). Its retained baseline failure is distinct from the new source/test census changes; the measured documentation figures were corrected without changing any contract or test behavior.

The final native run passed all 30 files spanning Director, commands, projection, World Kernel and Family operations. One inherited migration fixture crossed the scheduler's five-minute boundary between its initial tick and replay assertion. Its observation clock is now fixed; the original failure and successful rerun are retained. The mobile harness passed 175 checks, and the actual opportunity renderer passed at 320, 390 and 1,440 pixels with no horizontal overflow or page errors. Static SQL validation passed 4,059 queries; the existing interpolated/nonliteral inventories remain explicitly reported rather than counted as static proofs.

The complete 239-command repository sequence passed 238 checks before the authored checkpoint, including the 100-seed, 25,000-action resource property suite. Its sole failure was the expected generated knowledge drift while source was modified. Final acceptance requires committing authored changes, regenerating knowledge on that clean tree, committing only generated artifacts, and passing both `knowledge:check` and `tools/knowledge-test.js`. Their separate final logs are named in the verification package; this preserves the original pre-checkpoint result instead of replacing it.

Execution logs and per-command baseline/final manifests are retained under `output/campaign-network/`. The [verification package](evidence/world-campaign-network.json) pins final source hashes, exact commands, baseline results and test limitations. The release remains disabled; local Windows/PostgreSQL proof does not replace target-environment backup permissions, graceful Linux shutdown, representative staging capacity, or operator activation acceptance.
