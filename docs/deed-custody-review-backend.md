# Independent backend Deed custody review

Review date: 2026-10-16 (client date). Phase: isolated source implementation, before deployment or activation. Base commit: `b8fcce7baaa91b29661921a17e5510a47e9f725a`; reviewed files are uncommitted additions/changes in the `deed-death-safehouse` worktree. This reviewer authored the separate UI, not these backend changes.

**Conclusion:** no new confirmed backend defect remains in the scoped traces and executed checks. ROOT-D01's release/death escape is addressed by the character action barrier, including the durable-journal/exit-row crash window. This is evidence for the pinned working-tree source and this phase only. It does not clear deployment, production configuration, financial activation, or the Solidity implementation independently.

## Scope and evidence pins

Included: `src/deedcustody.js`, `src/deedcustodychain.js`, their schema, authenticated Deed routes, `withCharacter`/`withTwoCharacters`, the canonical estate hook, worker ordering, nested Deed stock-delivery targeting, and the existing durable keeper journal. Focused tests and independent proof scripts are included in the source pin manifest.

The complete raw-byte SHA-256 manifest is [independent-backend-source-pins.json](../omerta-contracts/audits/2026-10-16-deed-safehouse/evidence/backend/independent-backend-source-pins.json), SHA-256 `af9d0daf7cb79f9ce149d1ac86850c6c9f8b60be02cfb5be566a19cd9389773c`. Native tooling: Node `v24.19.0`, viem `2.55.1`, pg `8.22.0`, pg-mem `3.0.14`. The chain adapter suite compared selectors, named return tuples, and indexed event fields with the genuinely present Forge artifact; it did not take the artifact-missing skip branch.

Excluded: a full audit of unrelated gameplay/economics, launch auctions, production RPC/addresses/keys, live burns/transfers, full browser/wallet compatibility, and independent Solidity fuzzing/static analysis. Those are separate scopes. No real chain transaction or production mutation was performed by this review.

## Methods actually applied

The policy pins were verified locally:

| Method source | Exact revision | Applied pass |
| --- | --- | --- |
| pashov/skills | `c577eb7799c349de0acb187ba00ca98e14e436fd` | Execution-trace and access-control reference passes: entry point to value movement, interleaving, stale reads, confused deputy, inconsistent guards. |
| PlamenTSV/plamen | `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | State trace and temporal-parameter template: all readers/writers, multi-step consent/queue/send/finality, UTC rollover, historical coverage. |
| trailofbits/skills | `d3323cefbcf645678b8dc481de204b02ad3d02dc` | Context/trust-boundary map and callee inspection before findings. |

Adaptation: one independent backend reviewer used native JavaScript/PostgreSQL and targeted reference passes. The upstream full orchestration, external vulnerability databases, and a twelve-agent workflow were not run. No blanket static-analysis or production-on-chain claim is made.

## Authority and state model

1. Authenticated routes derive the account from `req.user.sub`. Equipment and Safe House preparation resolve that account's current living life and canonical equipment. Clients cannot choose another account or assert protection.
2. SQL character death, its exact next-generation heir, killer edge, timestamp, and globally ordered outbox are committed together. The estate hook skips never-tracked lives, preventing dormant-game deaths from creating a future gas backlog. A life already tracked as an incoming killer or heir continues to record deaths even if activation is later disabled.
3. The lifecycle operator attests off-chain game results. The contracts enforce their ordering and authorization; they cannot independently prove a combat result. `[CROSS-DOMAIN-DEP: game oracle]`
4. The keeper pins chain, custody runtime, configured Deed/identity/account/OMR contracts, canonical settlement-manager volume source, operator, and estate policy. Its durable signed transaction journal is the broadcast and nonce authority. `[CROSS-DOMAIN-DEP: chain finality and runtime identity]`
5. Only confirmed, ordered contract logs project equipment or coverage. ERC-721 `Transfer` is physical ownership authority; a later descriptive custody event cannot overwrite a receiver callback's later transfer. Death events must agree with the SQL sequence, killer, heir, timestamp and disposition before the cursor advances.
6. Stock delivery recognizes a living account only after both physical nested ownership and canonical equipment agree. Dead owners and unsettled loot wait. The constrained canonical wallet resolver fails closed. Undelivered account allocations are separate from assets already held inside a Deed wallet.

## ROOT-D01: release/finality escape — addressed

Attack trace examined: complete a notice, commit an owner-signed raw exit, crash before the exit row changes from `pending` to `releasing`, then attack or die while that raw transaction can still release the Deed before a later on-chain death.

The new barrier hashes the entire exact signed exit into its keeper job key. Under the same character lock used by the keeper, actions reject a `releasing` exit or a signed pending exit whose journal exists in any state except proven `reverted`. Cancellation and consent refresh cannot erase that barrier. The barrier runs before action callbacks in `withCharacter`, for both participants in `withTwoCharacters`, and at the start of headless `runEstate`. A game death cannot overwrite an already committed safe release.

Evidence: native PostgreSQL exercised `prepared`, `submitted`, `mined`, and `settled` with an unchanged pending exit row; rejected cancellation/refresh; rolled back an attempted death and its cash changes; exercised real character-lock contention; and resumed after a proven revert or confirmed projection. The independent full-app proof invoked the actual wrappers and headless estate function, proving their offensive callbacks/death did not execute. Its journal row was synthetic; the separate keeper suite exercised actual signed raw journal persistence and recovery.

The existing keeper recovery suite also covers invalid signatures without starving later users, transient RPC errors retaining consent, and submitted transactions that subsequently revert. Notice timestamps survive recovery; a revert never unlocks equipment.

## Safe House adversarial trace

The server obtains the current canonical completed-day quote and binds life, Deed, days, price day, maximum burn, nonce, issue time, deadline, chain and contract into EIP-712. It verifies the current identity wallet signature, then rechecks the exact living life and canonical equipment under SQL locks. The queue has one signed request per life/nonce and is idempotent for the same request. The keeper prioritizes already signed journal work and ordered deaths, cancels dead/stale requests, simulates the exact purchase, and journals the exact call before broadcast.

Tests rejected another wallet's genuine signature, changed fee/days/day/nonce, consumed nonce replay, a stale UTC quote, a chain-dead life, a changed current life and a runtime mismatch. A valid queued signature left protection false. Only a finalized coverage event activated it. Existing historical interval checks route a protected Deed to its exact heir after the estate delay; a purchase beginning after a recorded death cannot rewrite that death's loot rights.

The price is yesterday's canonical OMR volume divided by 20,000, clamped to 1–25 OMR per Deed per day. New authorizations expire at a UTC day change, and the contract enforces the seven-day horizon. Purchased intervals retain their original price and ownership dynasty. An approval or pending request grants no coverage. A request already broadcast can be delayed past a game death; newly confirmed coverage still cannot protect the earlier death. `[CROSS-DOMAIN-DEP: block timestamp and authoritative game timestamp]`

## Executed checks

All commands below exited zero. Logs are under `output/deed-custody-review/`. The six initial focused suites, native PostgreSQL proof and independent proofs ran before the final additive tracked-life helper and its estate caller. Their exercised barrier, journal, quote, signature and projection functions remained unchanged. The state suite and actual full-server estate-hook suite were then executed on the final source. The earlier raw source pin manifest is retained as `independent-backend-source-pins-pre-tracked-life.json`; these receipts are not relabeled as fresh executions of the final whole tree.

| Check | Retained result |
| --- | --- |
| `node test/deedcustody.js` | `independent-state-suite.log`; after the tracked-life hook, `independent-tracked-life-retest.log` |
| `node test/deedcustodychain.js` | `independent-chain-suite.log`; actual compiled ABI comparison, ordered kills, nested stock targeting and callback authority |
| `node test/deedcustody-estates-chain.js` | `independent-estate-suite.log`; mixed deaths, maturity, successor targeting and conflicting/incomplete event rejection |
| `node test/deedcustody-review.js` | `independent-recovery-suite.log`; bounded binding eligibility, refreshed signed-intent retry and journal replay |
| `node test/deedcustody-exit-keeper.js` | `independent-exit-keeper-suite.log`; real signatures/raw journal and deterministic RPC recovery |
| `node test/deedcustody-safe-house.js` | `independent-safe-house-suite.log`; real EIP-712 signatures and deterministic pinned quote/projection checks |
| `node test/deedcustody-postgres.js` | Independent tool receipt: exit 0, exact stdout retained in `independent-native-postgres-receipt.txt`; isolated random schema on private loopback PostgreSQL port 15459 |
| `node test/deedcustody-estate-hook.js` | `independent-estate-hook-suite.log`; actual full-server deaths skip never-tracked lives but journal the exact heir for tracked lives while activation is disabled |
| `node output/deed-custody-review/independent-backend-proof.mjs` | `independent-backend-proof.log`; independently authored genuine-signature and real PostgreSQL request/projection proof with deterministic RPC reads |
| `node output/deed-custody-review/independent-action-barrier-proof.mjs` | `independent-action-barrier-proof-retest.log`; actual full-app wrappers and headless estate guard |

The first action-wrapper proof failed because the fixture used a public `/v1/me` view as an internal account record. The public view omits the account ID. The fixture now reads its disposable database's internal account ID. The original failure log is retained; no product correction was needed. An independent UI regression separately found and corrected a test clock mismatch between frozen browser time and advancing Node time; that was also a fixture issue.

### Final coordinated suite closure

After the final UI clock-fixture correction and tracked-estate hook were present, the root agent executed `npm run test:deed-custody`: all nine checks passed with exit code 0, including the actual compiled-ABI comparison, browser coverage/UTC/identity checks, and real full-server tracked-estate hook. This is a later coordinated execution; it does not replace or relabel the independent historical runs above. The cohesive retained package is `omerta-contracts/audits/2026-10-16-deed-safehouse/`; selected proof scripts, source manifests and logs from `output/deed-custody-review/` are retained in its `evidence/backend/` directory under the same basenames. Native PostgreSQL data files are excluded.

## Remaining assumptions and limits

### Authored worker correction supplement — 2026-10-16

The backend author corrected `ROOT-W01` after the independent review above: the custody sync and keeper were bare calls inside the shared worker pass. A thrown error could skip unrelated following jobs; simply adding `safe()` without a dependency gate could let Stock Token work continue after a contained custody failure. Both jobs now have separate `safe()` boundaries. An explicit readiness value stays false while custody is enabled until synchronization returns a nondormant result and the keeper returns a nonalert `idle` or `settled` state. Missing, dormant, failed, pending or unresolved results keep dependent stock synchronization/delivery closed while subsequent unrelated jobs continue. Inactive custody preserves the existing stock path.

This is an **authored correction and authored regression proof**, not an assertion that its author independently reviewed their own change. Root subsequently inspected the actual worker block, keeper return states and three RPC batches, reviewed the narrow CI/guard diff, and independently executed the worker proof successfully. Original manifests, conclusions and historical receipts above remain unchanged. [authored-worker-supplement.json](../omerta-contracts/audits/2026-10-16-deed-safehouse/evidence/backend/authored-worker-supplement.json) pins the new worker, actual-source proof and test-wiring changes.

The author executed `node test/deedcustody-worker.js`, `node test/gates.js`, `node test/deedcustodychain.js` and the actual `npm run test:deed-custody:postgres` alias; all exited zero. The worker proof executes the real safe-wrapper and custody/stock/next-identity-job source with injected jobs, covering sync failure, keeper failure, null/undefined/dormant/error returns, healthy completion and disabled custody. The native proof used a disposable schema on private loopback PostgreSQL 15459. No RPC or production writes occurred.

Coverage wiring was also corrected: the real Playwright proof runs in the existing Chromium browser job through `test:deed-custody:browser`; it no longer assumes a browser in the ordinary suites job. The existing PostgreSQL core job now invokes the custody native alias with an explicit isolated endpoint. The new worker proof is in the ordinary custody alias. Three exact viem-only batches were classified in the shared-client guard, preserving its rejection of concurrent queries on a checked-out SQL client. The guard passed all worker, concurrency, test-inventory and actual CI-command ledgers after these changes.

The independent pass above established no additional confirmed finding. The main adversarial preconditions would be a bypassing future death/action writer, unauthorized SQL/journal mutation, a compromised lifecycle operator or signature wallet, or a reorganization beyond the configured finality assumption. Current public writes do not expose those capabilities. These remain explicit trust boundaries, not proven impossibilities.

Ambiguous broadcasts, nonce conflicts, runtime drift and unavailable RPCs intentionally retain locks or halt ordered work. This favors custody safety over availability and can pause affected characters while an exit finalizes. The one-command keeper does not promise liveness under arbitrary sustained backlog. Production configuration, operational recovery, deployed code verification and activation require their own release checks. Material edits to any pinned authority, state transition, signer, ABI or persistence path reopen this review.
