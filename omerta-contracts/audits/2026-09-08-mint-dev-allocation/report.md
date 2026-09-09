# Character mint allocation amendment — 2026-09-08

**Implemented allocation: 100% of each character-creation mint fee goes to `DEV_WALLET`.**
The contract recipient is `OmertaFees.feeRecipient`, which the deployment scripts wire to
`DEV_WALLET`. The owner can rotate this recipient through the existing owner-only setter.
Respawn, reroll, package, bond, sell-tax and other revenue allocations retain their existing rules.

This report records the owner's explicit instruction, “Let's have the Character Creation Mint go
100% to DEV_Wallet.” It is a scoped amendment to the
[comprehensive review](../2026-09-08-comprehensive/report.md), not a replacement of its historical
evidence. The prior reports, manifests, readiness records and ZIP were preserved.

## Source and scope

Target release: Robinhood mainnet, chain **4663**. This amendment is implemented in the working tree;
it has not been deployed or activated. The git base remains
`e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`, with existing unrelated modifications preserved.
[source-manifest.json](source-manifest.json) pins the exact reviewed files and the Solidity delta
against the earlier comprehensive review. Only `src/OmertaFees.sol` changes among its 40 contract
source files. [artifact.json](artifact.json) binds the current compiled fee artifact to that source.

The review covers `payMintFee`, its shared forwarding helper, all sibling fee methods, ownership
and recipient controls, the fee event watcher, fee ingestion and entitlement reconciliation,
the Vig booking boundary, the revenue router, schema migration, policy preflight and deployment
readbacks. The Dynasty NFT payment-to-claim integration is retested; the NFT contract is unchanged.
No withdrawal, bond, token, vault, upstream protocol or live account mutation is introduced.

Compiler: Solidity **0.8.26**, optimizer **800** runs, **Cancun**, ordinary non-via-IR compilation for
OmertaFees, using the repository's pinned OpenZeppelin dependencies. Native Forge **1.7.1** and
Slither **0.11.6** were used. Review methods continue the pinned policy's source/context pass,
adversarial recipient and replay pass, invariant/fuzz execution, integration verification and static
triage. This is a focused material-change review, not a rerun of every unrelated comprehensive suite.

## Behavior and authority

| Surface | Amended behavior |
| --- | --- |
| `payMintFee()` | Requires the exact mint price, increments the common payment nonce, forwards the entire payment to `feeRecipient`, then emits the existing payment event. |
| `FeeSplit` | The mint path emits `(nonce, gross, 0)` with the existing event ABI. |
| `mintDevBps()` | New public constant getter returns `10000`, independently of the immutable non-mint `vigBps`. |
| Other fee paths | Respawn, reroll and packages continue to pass `vigBps` to the shared forwarding helper. |
| Recipient failure | Mint never calls the Vig recipient. DEV rejection reverts the payment, nonce increment and events atomically. All payment entry points retain the reentrancy guard. |
| Backend mint ingestion | Records the payment and existing entitlement; books no Vig, treasury or community revenue. Direct Vig ingestion also refuses `source='fee', kind='mint'`, including an explicit BPS override. |
| Historical records | New mint rows persist `mint_dev_only=true`; the additive column defaults to false for historical rows. Existing fee and revenue rows are not rewritten. |
| Router | A separate character-mint source declares 100% DEV and reports its gross and DEV receipts. Historical split mint payments remain in the legacy fee totals. Any Vig, treasury or community row referencing a DEV-only mint fails an allocation invariant. |
| Runtime/preflight checks | Watcher ingestion requires both the configured non-mint Vig share and `mintDevBps=10000` before fetching fee or package logs. A missing or wrong mint policy holds ingestion; chain parity reports it. |
| Deployment | Solidity and PowerShell deployment paths read back the immutable policy and DEV recipient. The configured non-mint percentages remain unchanged. |

Mint price, entitlement count, NFT royalties, mint eligibility, signature domains, constructor
arguments and existing event ABIs are unchanged. The contract introduces no new storage slot for
the policy constant. The backend marker is internal bookkeeping, not caller-selected allocation
authority. Vig's revenue totals continue to describe Vig-eligible inflows; the complete money
router reports character mint receipts separately.

## Executed verification

The retained command outputs and reports are hashed in [evidence-manifest.json](evidence-manifest.json).

| Verification | Result / retained evidence |
| --- | --- |
| Solidity examples and fuzzing | 87 tests passed across `OmertaTest` and `CharacterLaunchAuditTest`; four fuzz properties ran 512 cases each with seed `0x20260908`. [Forge output](../../../output/mint-dev-allocation/forge.log) |
| Fee stateful invariant | Passed 512 runs, 256,000 calls, zero reverts; exact per-recipient cumulative receipts, all four fee paths, rotations, forced funds and sweeps. Same Forge output. |
| Additional unchanged NFT invariant | Passed 512 runs, 256,000 calls, zero reverts. The completed coordinated Forge run passed **89 tests in four suites**, zero failures. |
| Backend regressions | `chain`, `watcher`, `chainparams`, `router`, `vig`, `community`, and `migrate` suites all passed. Logs are under `output/mint-dev-allocation/`. |
| Allocation integration | Passed in pg-mem and real PostgreSQL 18.4 using dedicated loopback scratch databases. Mixed legacy mint/new mint/respawn/reroll accounting, immediate and delayed credits, replay, zero-value/comp behavior, historical preservation and phantom-revenue detection were exercised. [PostgreSQL result](../../../output/mint-dev-allocation/backend-postgres-retest.log) |
| Migration semantics | Real PostgreSQL exercised the generated additive migration twice against a temporary old-form fee table. Its historical payment acquired `mint_dev_only=false`; reapplying the migration was harmless. |
| Real local contract-to-backend flow | 13 checks passed on a fresh loopback Anvil chain 31337 with pg-mem. A 0.01 local ETH payment reached DEV in full and Vig received zero; real log ingestion, once-only credit, character mint, NFT voucher claim and transfer provenance passed. [Rehearsal report](../../../output/character-nft/rehearsals/2026-09-08T06-02-45-458Z-mint-dev.json) |
| Fee configuration | `node tools/validate-fee-splits.js` passed all ten declared sources, including the new 10000-BPS mint allocation. The public fee-flow page's ten sources were checked against the same JSON. |
| Preflight/tooling | `test/character-mint-policy.js`, tool syntax, PowerShell syntax and deployment utility regression passed. Missing getter, wrong allocation and unavailable RPC are rejected. |
| Deployment compilation | `forge build script/Deploy.s.sol` passed. Its sole lint warning is the unchanged genesis-expiry timestamp comparison; that script deliberately rejects an already-expired genesis window, and the new mint readbacks introduce no timestamp dependency. |
| Static analysis | Slither succeeded: 16 diagnostics across six rule groups, all individually retained and triaged in [static-triage.json](static-triage.json). No new confirmed defect from this amendment. |
| Workspace validation | Scoped `git diff --check` passed. Source-to-artifact metadata and bytecode size are recorded in `artifact.json`. |

The Solidity tests cover a mint with nonzero Vig BPS, all allowed Vig BPS under fuzzing, odd wei,
100% Vig configuration for non-mint fees, rejecting Vig receivers, rejecting DEV receivers, exact
rollback, all 16 outer/nested payment combinations for cross-function reentry, unchanged sibling
splits, and total/per-recipient conservation.

The initial new fixture exposed pg-mem's lack of Boolean-default backfill on `ALTER TABLE`, an
incorrect fixture-only `dev_eth` column assumption, and an unchecksummed fixture wallet. The fixture
was corrected; actual migration semantics were verified on PostgreSQL. An existing router fixture
also required its expected source list to include the new mint source. Initial retained failures
are identified as fixture/tool limitations, not presented as successful runs. Final affected
regressions passed. The disposable PostgreSQL cluster was stopped after verification.

## Static dispositions and remaining deployment requirements

The 16 static diagnostics concern OpenZeppelin's intentional zero-address ownership-nomination
cancellation, its unchanged StorageSlot assembly, compatible pragma ranges, unused Context
helpers, broad compiler-version ranges, and the explicitly checked native-currency calls.
The actual compiler is 0.8.26. Payment/sweep call results are checked, payment methods are guarded,
and malicious-recipient behavior is covered by executed tests. This result is scoped to the
amended fee path and its included dependencies.

The recorded Robinhood testnet fee contract
`0xf89405e54F699bE14bff01d3c2edb017029B3F7A` predates this policy. A read-only check at block
**115,373,119** returned `character_mint_policy_unavailable`, as expected because that contract
does not implement `mintDevBps`. Its historical 75% DEV / 25% Vig mint result remains historical
evidence. [Current-policy preflight](../../../output/character-nft/preflight/2026-09-08T05-59-23-668Z.json).

The existing fee contract has no setter that changes only the mint allocation. Enabling this
policy therefore requires a new fee-contract deployment and coordinated backend configuration.
Setting the existing global Vig share to zero would change other fees and is not this amendment.
The final public DEV wallet address remains owner-supplied.

An already-used database cannot be repointed to a new fee contract by merely changing its address:
payment nonces are currently keyed globally and watcher cursors are keyed by stream. A replacement
can restart nonces and collide with or skip earlier payments. Fresh mainnet indexing state or a
separately reviewed deployment-identity migration is required. The historical allocation marker
preserves accounting but does not solve that existing deployment-cutover boundary.

No public-chain transaction was submitted. All writes for the integration rehearsal were to the
disposable local chain and databases. The amendment is implemented and verified for a new deployment;
live recipient configuration and deployment remain separate operations.
