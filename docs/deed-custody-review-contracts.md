# Independent Deed custody contract review

**Conclusion:** no confirmed actionable Solidity defect in the source scope below. This is an implementation-phase review of an isolated dirty working tree based on `b8fcce7baaa91b29661921a17e5510a47e9f725a`, not deployment or activation clearance. The reviewer authored the backend adapter, not these Solidity contracts.

## Exact scope and evidence

The reviewed production scope is `CharacterDeedCustody.sol` (including `CharacterDeedAccount`), `DeedStockAccount.sol`, the existing `StreetDeed.sol` lock/update paths, the restricted OMR `burnFrom`/zero-address update changes and interface, and the eight-line canonical pool-manager volume addition. `DynastyNFT.sol`, OpenZeppelin ERC-20/ERC-721/signature/reentrancy dependencies and the reference ERC-6551 registry were followed where those paths depend on them. The three changed Solidity test files were inspected. Unrelated market, auction, governance and RWA behavior is outside this review.

Every source/test/dependency/configuration pin is retained in [independent-contract-source-pins.json](../omerta-contracts/audits/2026-10-16-deed-safehouse/evidence/backend/independent-contract-source-pins.json), SHA-256 `7a7a68d7a29cf93ffed02bf9ac24b501dbac4b3ff4f7420b0af4a5d684f386bb`.

| Production source | SHA-256 |
| --- | --- |
| CharacterDeedCustody.sol | `564d66302db4772064cc97acdece0c4dbef9047196e77e1eff8e9775b83edfa1` |
| DeedStockAccount.sol | `dbfefafad3bdf325f1a44d1c3fe36910ef9ec7efb4e468e6db8694fef3fbd4eb` |
| StreetDeed.sol | `78d7c908b6b4f654e9f4d8357b3321f3e60f80b496fba3b523d483e53a4ab4e3` |
| OmertaRestrictedOMRV2.sol | `8cd1c5db60078f97be38d8292528cef40457e634dad7bdfd4468c374b87ecee7` |
| IOmertaRestrictedOMRV2.sol | `216ce375eab9ba903af955fb9d57929bf46ab614649fad9b69f349129e73226c` |
| OmertaPoolManagerV2.sol | `ad6d4729b5678194c74f8a67ec87dc648817693eee2f8b2ac5261ec16b095b7c` |

Method pins were independently checked in the retained local checkouts: Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd` (access, execution, boundaries and invariant inversion); Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` (state-write/read trace and temporal-parameter analysis); Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` (context/trust boundaries, callee tracing, specification comparison and false-positive checks). This is a scoped manual adaptation, not execution of their full orchestration pipelines.

The retained compiler configuration is Solidity `0.8.26`, optimizer 800, Cancun; both native and configured via-IR artifacts exist. [The contract author's package](../omerta-contracts/audits/2026-10-16-deed-safehouse/evidence/contracts/deed-safehouse-contract-review.json) records exact compiler/Forge/Slither versions, artifact hashes, runtime sizes and diagnostics. This review verified that package's source pins still matched; deployed immutable values, chain IDs, addresses and runtime hashes do not yet exist for an authorized deployment.

## System and adversarial traces

The operator registers mortal lives, anchors soulbound identities and attests ordered deaths. A life account owns equipped Deeds and exposes only custody-controlled release. The canonical Deed vault keeps its assets while NFT ownership moves. Owners consent to equipment, exits and Safe House burns; permissionless settlement can only advance recorded graph edges.

| Boundary / attempted violation | Source trace and disposition |
| --- | --- |
| A dies to B; B dies to C before A settles | Every close consumes the next global sequence and records immutable successor/heir/time. `settleDeed` advances through strictly newer death sequences, at most 32 hops; a later call resumes from an intermediate dead life. Partial settlement cannot unlock its assets. |
| Protected heir dies before receiving the Deed | Each hop chooses coverage for that Deed, that life's dynasty and that life's authoritative death time. Protected hops choose the exact heir after `deathAt + 24h`; the next dead heir is evaluated independently. Unprotected hops choose the killer. |
| Buy or renew protection after an unreported death | New intervals start at purchase time plus one second. Expired intervals create a new interval instead of closing historical gaps. Extending an interval that is still active cannot change an earlier uncovered death into a covered one. Coverage is scoped to the dynasty, so another killer receives no former owner's insurance. |
| Steal via approvals, an unsafe NFT deposit or direct vault withdrawal | ERC-721 arrival clears token approval and relocks transfers. Equipment derives from actual ownership, including unsafe deposits. The life account has no owner execution, approval, redeem or signature surface. The vault has no arbitrary execution/allowance/delegated-signature path; its ERC-20/native withdrawals reject every life-account owner. |
| Malicious token/recipient callback | Custody and withdrawals are guarded against reentry. NFT release destinations derive from recorded lives or the signed current wallet; native withdrawal goes only to the direct owner. Rejected NFT receipt rolls back ownership and nonce. Token-issuer powers remain a stated limitation. |
| Replay, changed day, bigger burn or changed identity | EIP-712 binds chain, custody, exact life, Deed, days, UTC price day, maximum burn, nonce and bounded deadline. Signatures use the bound identity wallet with EOA/ERC-1271 verification. Death invalidates both exit and insurance nonces. No owner signature is accepted as a direct permissionless exit or insurance call. |
| Burn through unrestricted zero-address transfer | `burnFrom` requires the sealed, live runtime-pinned ProtocolCustody role and consumes the owner's allowance. The inherited ordinary transfer path rejects zero recipients before `_update`; entering the burn branch does not grant ordinary transfers new authority. A failed burn rolls back coverage and nonce. |
| Inflate volume without a filled, settled swap | `_checkPoolKey` pins ETH/OMR with OMR in currency1. The counter adds the absolute widened `int128` raw filled OMR delta once per core swap, before fees. LP changes, donations and transfers do not increment it. Later hook/unlock failures revert the counter with the swap. |
| Use a partial launch day or current-day volume | The manager's tracking-start day excludes its deployment day. Insurance requires today's day to exceed that start and reads yesterday only; the first quote is after the second UTC midnight. The quote is clamped to 1–25 OMR per Deed per day and already bought periods retain their price. |

## Executed evidence and static triage

No second Forge/cache writer was started for this independent pass. The independently executed backend ABI comparison passed against the genuine compiled contract artifact, checking every adapter selector, tuple output name/order and indexed event shape. The contract author's retained [aggregate Forge log](../omerta-contracts/audits/2026-10-16-deed-safehouse/evidence/contracts/deed-safehouse-affected-forge-final.log) proves 30 custody tests plus two stateful invariant suites passed, each invariant using 512 runs and depth 64. The interval invariant compares historical binary-search answers and actual supply burns against a separate linear model. Its RPC-free fixture is not production-chain deployment evidence.

At the initial review, two affected-suite cases in that aggregate log failed because `vm.getCode` could not find the unrelated vendored foreign-manager artifact. These were harness failures, not failed contract assertions, and remained incomplete checks at that point. The contract author owned the single Forge writer and restored the missing artifact. The dated closure below records the genuine retest while preserving the original failure history.

The retained Slither JSON analyses succeeded and contain 107 custody, 79 token and 134 manager diagnostics. The initial Foundry-discovery invocation also failed and remains retained; later successful direct-compiler JSON is the evidence used here. Relevant reports were traced independently:

- `_coverage` “uninitialized” is a mapping-backed storage-array alias written by `push` and renewal; receipt fields are all assigned before consumption and binary-search `low` intentionally starts at zero.
- Exact price-day equality is required owner consent, not an accounting equality mistake. Timestamp checks implement expiry, warmup, estate delay and the prepayment horizon; they do not supply randomness.
- Life accounts are created internally with nonzero `address(this)` custody. Other flagged zero checks are enforced by Ownable/runtime checks, or concern existing fee-controller disable behavior.
- The native low-level call has a fixed owner destination, reentry guard and checked success. The ERC-6551 footer read is constrained to the canonical registry account/binding.
- Dependency bitwise inverses/bitmap operations, existing rounded fee-bucket arithmetic, inherited mapping getters and style/optimization diagnostics do not identify a reachable violation in the added custody/burn/volume paths.

No confirmed contract finding requires remediation. The backend safe-exit finality defect `ROOT-D01` is a cross-layer issue: the contract explicitly trusts the operator to serialize gameplay. Its correction and native PostgreSQL/actual-action-wrapper proofs are recorded separately in the backend review package; it cannot be solved by treating a submitted exit as final on-chain.

## Trust limits and release conditions

The operator can attest incorrect kills, heirs or times; the chain cannot prove off-chain combat. Its owner can replace that operator. Actual automatic operation additionally depends on a solvent keeper, bounded gas policy, ordered durable delivery, finalized indexing and the gameplay barrier while a safe exit is unresolved. Disabling the rail must not erase pending death or safe-exit obligations.

Deployment must verify the audited nonproxy registry, soulbound collection, native manager and restricted OMR implementations, immutable addresses and sealed role/runtime bindings. Interface claims or a proxy's unchanged runtime hash alone do not prove immutable behavior. Existing sealed deployments cannot acquire this new burn function/role. Existing generic token-bound accounts and prior approvals are outside the constrained vault and require a separate checked migration. The lock covers ordinary ERC-20/native balances; issuers may retain seizure, restriction, rebase or upgrade powers. Unsupported asset standards can be stranded in the vault.

Actual wash trades can affect the next day's bounded OMR-denominated fee while paying the canonical trading fees. This is turnover-based pricing, not USD pricing. Prepaid protection is nonrefundable and limited to a seven-day horizon. The canonical manager runtime is 24,555 bytes, only 21 bytes below EIP-170; any subsequent change requires another size check. All conclusions reopen for material source, signing, configuration or settlement changes. No deployment, real burn, token transfer or financial activation was performed by this review.

## Test closure — 2026-10-16

The independent reviewer read the completed aggregate, build and exact retest logs and rechecked every source pin above: **zero source drift**. The contract author executed these commands in sequence; this reviewer did not start another Forge writer:

1. `forge test --match-contract 'CharacterDeedCustodyTest|CharacterDeedCustodyInvariantTest|SafeHouseCoverageInvariantTest|Restricted.*Test' --fuzz-seed 0x4f4d455254413230323631303136 -vv`: 138 passed, two missing-artifact harness failures, zero skipped, 140 total. The [original aggregate log](../omerta-contracts/audits/2026-10-16-deed-safehouse/evidence/contracts/deed-safehouse-affected-forge-final.log) remains unchanged.
2. `forge build lib/v4-core/src/PoolManager.sol`: exit zero, restoring the required vendored fixture. [Build log](../omerta-contracts/audits/2026-10-16-deed-safehouse/evidence/contracts/deed-safehouse-foreign-manager-build.log).
3. `forge test --match-test 'testNativeForeignManagerCannotBePrefundedBeforeSeal|test_foreignManagerAndCounterfactualCannotReceiveRevenueInventory' -vv`: exit zero, both previously failed cases passed, zero skipped. [Exact retest log](../omerta-contracts/audits/2026-10-16-deed-safehouse/evidence/contracts/deed-safehouse-foreign-manager-retest.log).

This establishes **140 unique tests passing across the original run plus exact retest**, rather than claiming a single all-green aggregate run. The custody and historical-coverage invariants each executed 512 runs / 32,768 calls with zero reverts; the manager and derived-revenue invariants each executed 512 runs / 256,000 calls with zero reverts. The configured 512-case fuzz suites also passed. No authored source changed between the failing harness run, fixture build and passing retest. The two incomplete harness checks are now closed; the scope, trust limits and separate deployment/activation requirements above remain in force.
