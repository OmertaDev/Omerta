# Evidence consistency check — 2026-09-08

Snapshot: 2026-09-08T04:39:06Z, while the root audit was still running its baseline and supplementary proofs. This is document/evidence quality control, not an independent exploit review or release conclusion. The checker read the policy, reports, source inventories, static JSON and retained logs; compared paths, hashes and diagnostic identities; and did not run a compiler, test, network request or production mutation. Later evidence may resolve the pending items below; preserve this snapshot as the record of what was available.

## Verified coverage and counts

| Check | Observed result | Appropriate description |
| --- | --- | --- |
| Local Solidity inventory versus `source-before.json` | 40 local files, 40 records, no missing or extra paths | All 40 local Solidity source/interface files are inventoried. This is a content inventory, not proof of complete review or execution. |
| Directory breakdown | 32 top-level `src/*.sol`, including `IOmrOracle.sol`; 8 `src/interfaces/*.sol` | Do not describe this as 40 deployable contracts. |
| Acquisition inventory | 10 implementation files / 4,860 lines and 6 interface files / 851 lines; all current hashes match | Counts in `acquisition-review.md` are consistent. The inline migration interface is included in its containing implementation file. |
| Core source hashes | All eleven current files match `core-source-hashes.json` | The core subreview's hash inventory remains consistent at this snapshot. |
| Selected Slither outputs | 31 unique targets, every selected raw JSON has `success: true`; all declared detector counts agree with the raw arrays, treating absent arrays as empty | 31 successful selected source-target analyses, after three replacement runs. The selected count is correct. |
| Selected raw diagnostics | 1,616 diagnostic occurrences | This includes repeated imported-library diagnostics across runs. It is not 1,616 unique security findings. |
| Empty static results | `AcquisitionIntentExecution` and `AcquisitionReconciliation` each have `success: true`, empty `results`, and logs saying zero results | Legitimate successful analyses of the implemented skeletal modules; no inference about future intent execution or reconciliation behavior. |
| Group static-triage input hashes | Core: 11 inputs; market: 10; acquisition: 10. All 31 retained input hashes match | Every selected raw target has a group input record. |
| Group static-triage records | Core 52, market 89, acquisition 179 = 320 distinct `(sourceRun,id)` records | All 294 diagnostics that touch their own selected target file have dispositions. Market also includes cross-target local diagnostics. |
| Supplementary test-source census | Core 9 test functions, including 2 fuzz tests; acquisition 8, including 2 fuzz tests | The draft source-level test counts are correct; these counts do not establish execution. |

The 31-target selection covers every top-level Solidity filename except the interface-only `IOmrOracle.sol`. The eight files under `src/interfaces/` are inventoried and imported as applicable; they were not eight additional standalone Slither target runs. `FlashGuard` is abstract, so “targets” is more accurate than “deployed contracts.”

## Corrections and coverage additions before finalization

### QC-01 — Keep pre-remediation evidence separate from the final revision

The current bytes of `src/Alchemist.sol`, `src/Denari.sol` and `src/Transmuter.sol` differ from `source-before.json`; the other 37 local Solidity hashes match. This is expected during the root's active remediation, but the initial manifest and market static results cannot silently become evidence for the final bytes. Retain the initial manifest, capture the final source/test/script manifest, and identify the exact remediation and retest inputs. Avoid a single undifferentiated assertion that all tests/static analyses concern the final working tree.

The initial manifest and `capture-manifest.mjs` also omit related files that the core report explicitly says were inspected: `src/vig.js`, `src/community.js`, `src/router.js`, `src/rules.tail.js` and `CHAIN-DEPLOY.md`. Add their hashes to the final manifest, or a separate clearly scoped related-source inventory. The acquisition report's normative document references at lines 63–66 should likewise resolve to exact paths and hashes, rather than informal document titles alone.

### QC-02 — Distinguish draft test intent from executed proof

The core opening and evidence subsection correctly say supplementary execution is pending. Several other sentences are stronger than the retained execution state:

- `core-review.md:27`: “The parent package records the newly executed full suite.” At this snapshot the baseline has no final aggregate completion record, contains a failure, and no supplementary results are present. Say the parent owns/runs that evidence until its result and revision are recorded.
- `core-review.md:90`: “The supplementary test demonstrates…” is premature while that test is pending. Use “is designed to check” until a passing output can be linked.
- `acquisition-review.md:168`: “The new tests prove…” similarly anticipates unrecorded execution. The evidence subsection at lines 249–250 correctly says execution results remain to be filled.
- Both drafts use an “Executed evidence” heading for sections that mostly describe pending suites. Keep an explicit execution-status table or label the unexecuted part “Prepared tests / execution pending,” and update it only from retained outputs.

These are assurance-wording issues, not claims that the source-level reasoning is wrong. The final conclusion must continue to distinguish manual review, prepared tests, passed tests, failed tests, and unverified external integration.

### QC-03 — Annotate the historical Slither ledger's counting/configuration defects

`output/comprehensive-audit/slither-runs.json` is the initial 31-attempt ledger: 28 successful analyses and 3 failures. It is not the final 31-success selection. The three failed full attempts are `AcquisitionAuthority`, `AcquisitionVaultCore` and `RwaHealthOverlay`; their successful `-ir.json` replacements are correctly selected in `static-run-selection.json`.

The initial ledger records one diagnostic for each failed/missing result and for each of the two empty-result modules. That follows `@($result.results.detectors).Count` in `run-static.ps1`, where a null value contributes one array element. A missing result must have no established detector count; a successful empty result has zero. The initial ledger's summed 1,450 is consequently not a valid successful-diagnostic total. Preserve the historical ledger and document the correction; the final selection's 1,616 is independently supported by its raw files.

The initial ledger's `solcArgs` records requested `--via-ir` for seven targets, while the retained `-full.log` compiler commands show that Crytic's Foundry-config loading omitted it. The three replacement `-ir.log` commands visibly include `--via-ir`. Four successful selected full analyses (`AcquisitionConstellationFactory`, `PreVoteBudgetBook`, `AcquisitionIntentExecution`, `AcquisitionReconciliation`) still show direct non-IR static compilation even though the canonical Foundry profiles use IR. Report those exact static-analysis settings as an adaptation; do not claim every selected Slither run used the canonical per-file artifact profile. A later script edit does not change the settings of an earlier run.

Many successful runs retain exit `-1` while their raw JSON says `success: true`; the three compiler failures retain exit `1` and no successful raw JSON. Preserve both process exits and parsed analysis success. “Successful analysis” is supported by the raw results and terminal analysis summary, whereas “all commands exited zero” would be false.

### QC-04 — Account explicitly for local-interface diagnostics

Across the selected raw JSON, 344 diagnostic occurrences touch any local `src/` file. The three group ledgers dispose 320; the remaining 24 occurrences touch local interfaces only:

| Interface | Rule | Occurrences / selected runs |
| --- | --- | --- |
| `IStockTokenRegistryV2.sol` | `shadowing-local` | 6: two each from AcquisitionVault, RwaHealthOverlay and StockTokenRegistryV2 |
| `IAcquisitionVaultV1.sol` | `naming-convention` | 14 from AcquisitionVault |
| `IRwaHealthOverlay.sol` | `naming-convention` | 2 from RwaHealthOverlay |
| `IInitializerHook.sol` | `solc-version` | 2: one each from OmertaHook and OmrV4TwapOracle |

These can be triaged once per rule/source with explicit occurrence mappings in the root's shared review, but they are local source diagnostics, not external-library-only exclusions. The acquisition triage note currently says “Every direct in-scope diagnostic”; qualify its filter as own-target implementation diagnostics or add the local-interface records. This check identifies a classification/coverage gap and does not independently judge the warnings as vulnerabilities.

The remaining 1,272 raw occurrences do not touch local `src/` files. Their retention in raw output or `dependency-diagnostics.json` is not itself a disposition; the root's dependency review should state its deduplication and exclusion policy before claiming all static findings were triaged.

### QC-05 — Retain and explain unsuccessful and warning-bearing checks

The failure artifacts are present and visible. The final report should link them and their dispositions rather than merely list the latest passing result:

| Evidence | Observed result | Required presentation |
| --- | --- | --- |
| `forge-baseline.log:1134` and `:1212` | `AcquisitionVaultOperatorTest.test_artifactMetadataBindsCompilerConfigSourceHashAndReviewedExternalCallVocabulary` fails with “artifact is not bound to reviewed source”; suite result 83 passed / 1 failed | A baseline failure exists. Preserve it and record a concrete cause plus revision/profile-matched retest if resolved. A passing ordinary test suite does not erase artifact-binding failure. |
| Baseline completion | At inspection the log ended after the OmertaBond suite, and no aggregate completion/exit artifact was present | Report running/incomplete until the root records the process outcome. Do not extrapolate an overall pass from completed suite fragments. |
| `postgres-check.log` / `.exit.txt` | 198 passed, 5 failed, exit 1; deadlock fixture selected the holder as victim, cascading into five assertions | Preserve the initial failure and identify any fixture changes or nondeterminism in the disposition. |
| `postgres-retest.log` / `.exit.txt` | 203 passed, 0 failed, exit 0 | Supports this retest only; a second successful run alone does not establish the cause of the first failure. |
| `slither-all.log` / `.exit.txt` | Exit 1, incompatible/missing split Foundry build-info output | Tool integration failure, followed by direct-solc adaptation; not a clean full-project run. |
| `slither-OMR.log`, `slither-OMR-direct.log` / exits | Exit 1, Windows command/tool-resolution failures | Failed bootstrap attempts are retained separately from later successful OMR analysis. |
| Three initial Slither full logs | Stack-too-deep errors; no result JSON | Failed compilation attempts replaced by successful IR runs, not three clean full runs. |
| Five `erc-*.exit.txt` files | Exit 0 | Invocation completion does not mean warning-free conformance. OMR and Denari logs flag the approval-race behavior; GearVault flags optional receiver methods and `safeBatchTransferFrom` event detection. Give these explicit source-based dispositions before describing the checks as clean. |

The twelve entries in `js-runs.json` all retain exit zero and start/end timestamps. This is consistent run bookkeeping, but those selected suites should not be described as the whole repository's JavaScript suite.

## Final package coverage suggestions

At this snapshot, `report.md`, `coverage.md`, a final source manifest, final baseline outcome, supplementary proof outcomes and shared dependency triage were not yet present in this package. That is consistent with active work, not a finding of an abandoned review. Before declaring completion:

1. Resolve each of the 40 local Solidity files to its owning source review, entry-point inventory, executed tests and remaining exclusions. Keep inventory coverage separate from dynamic behavior coverage.
2. Record exact commands/settings, start/end time, process outcome, fuzz/invariant budgets, seeds when available, and raw-log hashes for each final proof or test group. Do not count duplicate invariant assertion lines as independent randomized campaigns.
3. Bind changed Solidity, related signer/indexer code, normative documents, test harnesses and selected artifacts to the final revision; retain old failures and before/after mappings.
4. Add root-level interface/library/ERC-check dispositions and retain requested versus effective compiler settings for static runs.
5. Keep the external runtime observation in `mainnet-external-check.json` scoped to chain 4663, block 57406998 and the named runtime/immutable/fee reads. It does not prove local bytecode equivalence, complete upstream-source review, or readiness to activate the economic rails.

## Read-only follow-up: baseline source-binding failure

The root requested a focused diagnosis of the failure while its baseline remained active. No artifact, cache, production file or test source was changed by this checker, and no compiler or test was executed.

`AcquisitionVaultOperator.t.sol:1817–1821` hashes the raw string returned by `vm.readFile` and searches the artifact's `rawMetadata` for that exact source-hash entry. Read-only Node hashing with the already-installed `@noble/hashes` Keccak implementation establishes:

| Representation of `src/AcquisitionVault.sol` | Bytes | Keccak-256 |
| --- | ---: | --- |
| Current on-disk CRLF bytes | 46,194 | `0xed29550585bb3e0ef7b5eb6d3e9b346b09d5742a31999410ccf100586a9058e4` |
| Current bytes after replacing CRLF pairs with LF | 45,200 | `0x275685e5920a8eeee17b725a7bb23fef62eeb29390ba1ed1730c3122b33551f9` |
| Exact `git show HEAD:omerta-contracts/src/AcquisitionVault.sol` blob | 45,200 | `0x275685e5920a8eeee17b725a7bb23fef62eeb29390ba1ed1730c3122b33551f9` |
| Retained artifact `rawMetadata.sources["src/AcquisitionVault.sol"].keccak256` | — | `0x275685e5920a8eeee17b725a7bb23fef62eeb29390ba1ed1730c3122b33551f9` |

The exact metadata substring sought by the test is present for the LF/Git hash and absent for the CRLF hash. Thus the retained failure is explained by raw CRLF-versus-LF source identity; it is not evidence of changed reviewed Solidity or an absent metadata key. This comparison does not locate which historical build step supplied the LF form and does not independently recompile bytecode.

Suggested harness correction: compare against the explicit compiler-input representation, or narrowly account for CRLF-to-LF normalization at the source-hash check while preserving every other byte and all compiler/settings/source-vocabulary assertions. Preserve the failing baseline, hash the revised test, and retain its actual rerun result after the active baseline finishes. Diagnosis alone is not a passing retest, and the production-file manifest should continue to hash exact on-disk bytes.

### Authorized metadata-harness correction and hashes

After the read-only diagnosis, the root authorized the narrow correction. `AcquisitionVaultOperator.t.sol` now has `_normalizeCrLf`, which removes a CR only when immediately followed by LF. Standalone CR, LF and all other bytes remain unchanged. Only the metadata-source hash uses the normalized bytes; the subsequent external-call vocabulary assertions still inspect the original source. No compiler, artifact or cache was changed by this subagent. The root owns the subsequent Solidity retest; it is still pending in this record.

| Artifact | SHA-256 |
| --- | --- |
| Retained `out/AcquisitionVault.sol/AcquisitionVault.json` inspected during diagnosis | `526783220df8edef053cf04880aa153f68f66428a6a5db0606c86c243ce68e7b` |
| Exact on-disk `src/AcquisitionVault.sol` | `a7301148771bbf4aa57e2e49d65c885179373fe73d5a6c5ad06f1122ea0db52d` |
| Original `test/AcquisitionVaultOperator.t.sol`, from `source-before.json` | `6c89d2b96570710a49f39871211effa23c002dca1367da8a7e29dba911034e70` |
| Corrected `test/AcquisitionVaultOperator.t.sol` | `fd7478cda112238ced82c69c66a274cd423aacbd62a206f00f2faf22e7eec7b2` |

Contract/test paths in this table are relative to `omerta-contracts/`.

## Authorized integration follow-up: deed callback recovery

The root expanded this assignment to follow the callback assumptions into `src/watcher.js`, `src/chain.js`, `src/stockdeliver.js` and their relevant tests. The audit-context-building skill's call-following and explicit-assumption discipline was applied inside this bounded subagent; the upstream per-function orchestration was not run. The root then authorized a focused regression, production correction in `src/chain.js`, and JavaScript/PostgreSQL validation. The initial read-only snapshot above is preserved separately from this later work.

### INT-DEED-01 — Early burn was consumed before extraction indexing

**Confirmed failure, corrected and retested.** An ERC-721 receiver can burn the new StreetDeed during `_safeMint`, producing `Redeemed` before `Extracted` in one successful transaction. The prepared real-contract proof in `ComprehensiveCoreAudit.t.sol` records that exact event order. The worker normally processes extraction first, but `src/worker.js:909–912` catches each stream failure independently: an unavailable Extracted RPC/read does not prevent the Redeemed stream from progressing.

Before the correction, `applyDeedReimport` queried only the synthetic `onchain:<tokenId>` owner. When the same deed still belonged to its original account with `onchain_token_id` set, it treated the row as absent and permanently marked the burn `applied`. A later successful extraction retry moved the deed into the synthetic on-chain state. The burn's cursor had advanced and its supposedly applied row was excluded from the recovery sweep, leaving the burned deed stranded.

The correction reads and locks the deed by `onchain_token_id` first. A row that still belongs to the pre-extraction account leaves the recorded burn `pending`. Once the actual extraction handler establishes the synthetic owner, the existing sweep performs the ordinary return. The no-outstanding-deed case remains a settled historical no-op. The existing reimport-row lock and status recheck still serialize competing recovery attempts; the return, lineage update and final applied status remain inside one transaction.

The new `test/audit/deed-reimport-order.js` uses the real schema, `requestDeedWithdraw` signature production and independent EIP-712 recovery, actual watcher window/cursor code, `markDeedExtracted`, the reimport handler and the recovery sweep. Its only event-source replacement supplies the normalized confirmed RPC events; it does not fake the database handlers or their authority. Account/wallet associations are fixture preconditions, not proof of smart-wallet enrollment. No public-chain RPC or transaction is used.

The regression makes the extraction read fail, ingests the same-transaction burn, checks that repeated early sweeps keep it pending, retries extraction, recovers to the burner's mapped account, then rewinds and replays both streams. It checks the exact recipient, one deed, one recovery lineage entry, cleared on-chain/control fields, one applied recovery and zero currency-ledger movement. The PostgreSQL run invokes two actual recovery sweeps concurrently and observes exactly one application. The in-memory run expressly does not claim concurrency coverage.

| Executed command / environment | Result | Retained evidence under `output/comprehensive-audit/` |
| --- | --- | --- |
| `node test/audit/deed-reimport-order.js --memory`, before correction | Exit 1: actual burn status `applied`, expected `pending` | `deed-reimport-before.log`, `deed-reimport-before-run.json` |
| Same command, after correction | Exit 0 | `deed-reimport-after.log`, `deed-reimport-after-run.json` |
| Same fixture on PostgreSQL 18 at loopback port 55439, dedicated `omerta_audit_deed_recovery` database | Exit 0; concurrent sweeps applied exactly once | `deed-reimport-postgres.log`, `deed-reimport-postgres-run.json` |
| `node test/deeds.js`, pg-mem | Exit 0, `deeds: PASS` | `deed-lifecycle-retest.log`, `deed-lifecycle-retest-run.json` |

The four run JSON files retain commands, UTC start/end timestamps, process exits and source/test hashes. Node reported version 24.19.0. The dedicated PostgreSQL database was created on the root's existing isolated audit server; unrelated `tools/pgcheck.js`, watcher changes and existing deed tests were not edited.

| Retained input/output | SHA-256 |
| --- | --- |
| `src/chain.js` immediately before this correction | `9ff587881e4398053c5088a357a022e7cd9064d01303ae6d0e404dea1c3fcf23` |
| `src/chain.js` after correction and in every passing run | `5bd20176417e61a239423d13a4876be8243841aa1b411daa0aa719b7ff9d4d44` |
| `test/audit/deed-reimport-order.js` in failing and passing runs | `7db72c172cd1a9a438df7905fe694d350885aa10219204d51fbb3d800b2b119f` |
| `test/deeds.js` existing lifecycle suite | `624b9c56d18095855e3da56bfcd9fd2cec1397df26d21a2dabed3b387b944fae` |
| `deed-reimport-before.log` | `052bf6ddf58d0e74a3a0a32f68f6015b3c34f3ff62d954d436e1c7af28682134` |
| `deed-reimport-after.log` | `a9f00f1cab586030d78e57edc5bfd537c35e08b69e36c1f34c22d67cd50814ba` |
| `deed-reimport-postgres.log` | `52e59fd683630078c87224c14bc1630f8e4b4008197a3dadc5cd48598c4a03ec` |
| `deed-lifecycle-retest.log` | `8b1fd7afa591bebed0efae4ccc96ce995bfcbc0396b056b8afabfceccd59b963` |

Paths in this table are relative to the repository root, except bare log names, which are under `output/comprehensive-audit/`. The correction concerns delayed extraction indexing within a recorded deed lifecycle. It does not establish atomic behavior for an external stock delivery or authorize activating the dormant rail.

### Callback claim boundaries after this check

- **Dynasty:** the retained baseline actually passes `test_callbackMayTransferBeforeCustomMintedEventWithoutCreatingExtraToken` (`forge-baseline.log:1036`). The live adapter retains Transfer block/log positions; `recordDynastyMint` binds locally issued nonce provenance; `recordDynastyTransfer` requires mint provenance and rejects stale positions. `test/watcher.js:240–312` covers mint processing, freezing, old transfer replay and delayed Minted recovery. The source admits same-transaction callback transfer ordering through these paths; no additional Dynasty ordering defect was established. The tests are separate contract and backend tests, not one EVM-receipt-to-database run, and the portrait freezes at confirmed observation time.
- **Gear:** withdrawal sets the in-game item state before issuance, and `reimportItem` uses the authoritative burn reference and burner account independently of the later `Claimed` marker. `markClaimed` only resolves the voucher; it does not re-extract an item returned by the callback burn. The prepared core callback proof and existing `test/reimport.js` cover their respective boundaries; this subagent did not execute the new Solidity proof.
- **StreetDeed / stock target freshness remains separate:** `recordDeedTransfer` has no persisted event position, the worker continues to the stock keeper after a caught deed-transfer sync failure, and `deedTargetRows` selects cached `onchain_owner`. `resolveTbaOnchain` derives the account address without proving live NFT ownership. The completed recovery fix does not establish freshness or atomic ownership at delivery. Keep that explicit for activation of the stock rail.
- **Stock confirmation remains a trusted-data boundary:** the actual `Delivered` event contains `deliveryId`, `token`, `to` and `units`, but the adapter retains only ID and transaction hash and `confirmStockDelivered` confirms the staged row by ID. Exact token/recipient/amount correctness therefore relies on the selected on-chain authorization mode and trusted signing/staging path; the callback tests do not prove an independent event-versus-allocation reconciliation. No arbitrary external token deployment or independent signer service was verified by this subagent.

## Final evidence reconciliation follow-up

This addendum records later results without rewriting the initial quality-control
snapshot or its then-pending entries. The checker inspected the completed raw logs
and final group reports; it did not execute another Solidity compiler, change
artifacts or caches, or edit runtime code in this follow-up.

| Earlier pending point | Inspected completed evidence |
| --- | --- |
| Full baseline and final Registry V2 invariant | `forge-baseline.log` ends with 927 passed, one failed, zero skipped and 928 total tests across 46 suites; retained process exit is 1. Registry V2 passed 512 runs and 256,000 handler calls with zero reverts; its suite duration was 1,383.95 seconds. The single failed artifact-binding assertion remains present. |
| CRLF metadata-harness retest | `affected-retest.log` ends with 169 passed, zero failed and zero skipped across nine suites; retained process exit is 0. All 84 AcquisitionVaultOperator tests passed, including the previously failing artifact-source assertion. |
| Supplementary proofs | The same affected run passed nine core, eight acquisition and two market tests, 19 total. Exactly four supplementary properties are fuzz tests: two core and two acquisition, each at 512 runs. The original and affected executions overlap; their counts must not be added as distinct behaviors. |
| Contract callback-order proof | The actual GearVault and StreetDeed burn-during-mint proofs now both have passing results in the core suite. This resolves their execution status, while their relationship to the separate backend fixture retains the limits described above. |
| Shared dependency and interface diagnostic accounting | `shared-static-triage.json` contains 1,616 coverage rows and records 31 selected successful runs, 561 distinct IDs, 320 directly assigned occurrences and 1,296 shared occurrences. It reports zero unassigned occurrences, zero multiply assigned occurrences and zero cross-group ID overlaps. `shared-dependencies.md` supplies the additional interface/library/ERC dispositions and bounded mathematical cross-check. |
| Subreview execution wording and dependency provenance | `core-review.md` and `acquisition-review.md` now cite the inspected passing supplementary and affected-run results. The acquisition report's unsupported OpenZeppelin 5.6.1 package claim was removed: inspected headers and content hashes identify the vendored files, without inferring a single package release. |
| Genesis fork rehearsal | The first run's failure remains retained. `genesis-fork-retest-run.json` records exit 0 for `node tools/genesis-fork-rehearsal.js`, from `2026-09-08T04:53:36.3173680Z` to `2026-09-08T04:54:43.2179299Z`. Its output reports `ok: true`, fork block 57,419,976 and `reconstructedPriceExact: true`. These are inspected run outputs; detailed rehearsal assertions and clock simulation assumptions remain owned by the root evidence package. |

`report.md`, `coverage.md` and `fee-routing.md` were read for consistency. Their
40-file inventory correctly distinguishes 31 implementation-bearing files and nine
interface-only files. The fee allocations and two-recipient gameplay custody
explanation agree with the reviewed source. The root was notified that its report's
baseline/fork pending wording needed to reflect the newly completed results, and
that the LF metadata diagnosis establishes the artifact's LF-source identity,
without identifying which historical build step provided that representation.
This checker left those root-owned documents unchanged. Final source and execution
manifest assembly remains a separate root responsibility.

| Inspected evidence or input | SHA-256 |
| --- | --- |
| `output/comprehensive-audit/forge-baseline.log` | `c701cc3d80b809c95953f3322abd53893866627e680b6774716822fa936abf4c` |
| `output/comprehensive-audit/affected-retest.log` | `c0c6bfe0002e7fa3b0736f1aec5be065bab40ea372da5f8d699f148e263852d4` |
| `omerta-contracts/test/audit/ComprehensiveCoreAudit.t.sol` | `8fce0f30138e714698f0ef1f27a2e0d6e8948e858b2796ed5022d53f3ecbd527` |
| `omerta-contracts/test/audit/ComprehensiveAcquisitionAudit.t.sol` | `82c4f11dbb4cbf91ed7d469a0ad34a64cc7fb8f690a70514a0cf18a7c78058fe` |
| `omerta-contracts/audits/2026-09-08-comprehensive/shared-static-triage.json` | `502bbf50bb449b66d7aa24fc3beb5f94e0ddafc4f9b4b2b2f0eed3b29e6bfa05` |
| `output/comprehensive-audit/genesis-fork-retest.log` | `855f5bceb948cdd3b583d449eb6832fbfec0586f8e9bbfd12baf3f9e7d481ce1` |
