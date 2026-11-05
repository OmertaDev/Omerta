# Independent native ETH reward review

Review date: 2026-11-04. Reviewer: independent staking-context/integration subagent.
Phase: repository implementation and agent review; no deployment, transaction, funding or activation.
Base commit: `d70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e` on the modified
`codex/pr310-native-eth-rewards` working tree. This review covers the source hashes below,
not an unqualified claim about the branch or any deployed system.

## Scope and source identity

Primary scope is the complete `OmertaEthStakingV2` and `OmertaEthRewardsV2` contracts.
Direct callee inspection includes restricted OMR transfer/admission, canonical router settlement,
manager fee collection, Hook identity/observations and market-state snapshots. Existing OpenZeppelin
access control, SafeERC20, Math, Pausable and ReentrancyGuard behavior is relied upon through the
repository's pinned dependencies. Dependency installation/version verification and runtime artifact
hashing belong to the parent evidence package.

SHA-256 of the reviewed working-tree bytes:

| File, relative to `omerta-contracts/src/market-v2/` | SHA-256 |
| --- | --- |
| `OmertaEthStakingV2.sol` | `b6f791a3e4634dc1a58baab198b460312d763df1bd17f045e4887b43cc319f74` |
| `OmertaEthRewardsV2.sol` | `b4b916bab1d87c491718df3c278da70dcad9ccc852253ddaa92b283a60087b62` |
| `OmertaRestrictedOMRV2.sol` | `60731f3f786c9a6c3238b144e11e0bf26ceb165891cd5441a9e81038b1b08f44` |
| `OmertaHookV2.sol` | `e63aec4054854d1928a04eb5779c291a4e2bcaa0b548b800b33b94c33425b28a` |
| `OmertaSwapRouterV2.sol` | `40efd48079b60739cd212de417b011fe8d87aecf582e8365dc5d5cf02743adf6` |
| `OmertaMarketStateV2.sol` | `79590d29029c0705c2c56dfbc9ca03efba47cb6ebb5fd0176396969b43985a31` |
| `core/OmertaPoolManagerV2.sol` | `a185e13053c5d170487bf674b756595e5ff97234bf96e1c3e45221a60905da87` |

Hash refresh after final wording: the Hook dev notice now names staker ETH rewards and the manager
notice now states its 3.5% base plus 0.5% reward allocation. These are comment-only changes from the
earlier reviewed hashes `61a0587d...` and `c284c320...`; the already reviewed matching native policy
identifier remains unchanged. Token and both native implementation hashes remain unchanged.

Compiler configuration read from `omerta-contracts/foundry.toml`: Solidity 0.8.38, Cancun,
optimizer 800; the existing compilation restrictions use IR for market periphery/tests and
non-IR for the restricted manager. No new compiler/toolchain configuration is proposed here.
Out of scope: signer/backend/database routes, arbitrary noncanonical pool deployments, operational
scripts, production Safe ownership/threshold, chain state and deployment acceptance.

## Methods actually applied

The local method checkouts were read and their commits verified with `git rev-parse HEAD`:

- Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`: applied the
  `access-control-agent.md`, `math-precision-agent.md` and `execution-trace-agent.md` passes
  under `solidity-auditor/references/hacking-agents/`.
- Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: applied
  `agents/skills/evm/economic-design-audit/SKILL.md` and
  `agents/skills/evm/external-precondition-audit/SKILL.md`.
- Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc`: context-first review and
  explicit unenforced assumptions were applied through the installed
  `audit-context-building` skill, independent staking function-context analysis and the parent
  [contract dossier](DOSSIER-contracts.md).

These are adapted manual passes on the bounded scope. No claim is made that an upstream repository's
complete orchestration ran. Forge compilation/testing is owned by the parent to avoid concurrent
artifact writes; this reviewer did not execute Forge or a static-analysis engine. File reads,
focused symbol searches, source hashes and the method-pin checks returned successfully.

## Model and invariants checked

### Assets, permissions and replay domains

The vault holds OMR principal and funded native ETH. `totalStaked` and per-account held balances
are principal liabilities; finalized epoch budgets fund floor-rounded per-account ETH entitlements.
Only an admitted account can deposit or relock, only that account can consume its positions, and
withdrawal pays principal only to `msg.sender` (`OmertaEthStakingV2.sol:147-186,288-305`).
Governance cannot redirect held principal or earned ETH through a sweep/rescue method; none exists.
The owner sets a distributor once, activates once and pauses deposits/relocks; inherited ownership
transfer does not create any new payment route (`119-145`).

The collector Safe may set keeper, attest bounded health, activate and unpause. Safe/keeper may
pause, revoke health and convert. Collection/funding are permissionless and have immutable destinations
(`OmertaEthRewardsV2.sol:134-213`). No arbitrary external target, external purchase leg, native/token
withdrawal or upgrade entry point exists in the scoped collector.

ETH replay domain is `(vault address, epoch ID, msg.sender)` by storage, with strictly increasing
1-24-item batches and `claimed[id][account]` set before native delivery. Failed native delivery
reverts flags, counters and the complete batch; `nonReentrant` prevents callback claims
(`OmertaEthStakingV2.sol:233-253`). ETH may be delivered to another nonzero address, but reward
identity remains the caller. A zero entitlement consumes only that caller's finalized epoch flag.

### Lock and held-weight transitions

Each deposit appends its own `now + 30 days` position; top-ups do not edit prior unlock dates.
Before exact maturity, both withdrawal and relock fail. At maturity, held principal remains in the
reward balance until withdrawal (`OmertaEthStakingV2.sol:166-186,302-315`). A partial withdrawal of
40 from a mature 100 position leaves a 60 held balance and changes only future reward slope.
Relocking 60 of a mature 100 position moves that quantity between position records and adds a fresh
withdrawal lock, while reward balance remains 100. Therefore relock cannot manufacture stake-time.

The lock-flow prefixes and reward-integral histories are separate. Coalescing updates at the same
timestamp changes the future balance without manufacturing elapsed time. The integral at `t` is
the latest checkpoint's prefix plus `balance * elapsed`, and epoch weight is the difference at
the clipped epoch endpoints (`321-390`). Account/global balance additions are bounded to `uint192`,
timestamps to `uint64`; a held-balance integral over that timestamp range is below `2^256`.
Historical checkpoints are never pruned, and later exits/relocks cannot alter closed-epoch weight.

Concrete share check: 100 OMR held for 30 days and 100 OMR first held on day 15 yield weights
`259200000 OMR-seconds` and `129600000 OMR-seconds`; a 3 ETH budget pays 2 ETH and 1 ETH.
For any account partition, flooring each `budget * weight / totalWeight` cannot exceed the budget.
There is no share-price conversion for direct OMR donations to manipulate.

### Funding and closed-budget transitions

Only the pinned distributor can call `fundEth`; only actual `msg.value` increases current receipt-epoch
budget. Direct/forced asset donations do not create principal or reward credit (`202-211`).
Finalization requires a closed epoch and freezes its total weight once. An empty epoch moves its
budget to `currentEpoch + 1`, which is future and cannot already be finalized. Neither current
funding nor later roll-forward can rewrite a closed funded epoch (`214-229`).

The collector calls manager bucket 4 only, verifies native/OMR balance deltas against reported
withdrawals and accounts for actual receipts (`OmertaEthRewardsV2.sol:173-183`). The manager zeros
that bucket and decrements total owed before paying its immutable recipient
(`core/OmertaPoolManagerV2.sol:516-535,584-590`). Base buckets have no collector route.
Funding checks native debit and vault funded-counter increase, with cap consumption reverting on
any failed external operation (`OmertaEthRewardsV2.sol:188-195,255-268`).

### Canonical execution, runtime and health gates

OMR conversion binds the concrete Hook key, manager, token, manager-accounting mode and actual
market-state `source()`. Hook/runtime identity is checked at construction and on conversion;
OMR, manager, vault, router and market-state runtimes are pinned (`108-131,221-240`). Activation,
unpause and conversion additionally require fixed reward-recipient identity, sealed OMR policy,
bound settlement manager, collector recipient admission and a valid fresh observation (`245-253`).
Matching getters are configuration checks; safe concrete bytecode remains a reviewed-deployment
precondition rather than something a getter can prove.

Conversion spends the exact requested OMR amount through the canonical router and checks actual ETH
receipt. Temporary allowance is cleared; a partial fill, failed floor or failed external leg reverts
all state and allowance (`199-213`). Router settlement enforces payer identity from its bound payload,
actual restricted OMR receipts, output minimum and maximum input (`OmertaSwapRouterV2.sol:54-120`).
The integration fixture admits the collector as a receiving-only contract holder; the canonical
input router performs its OMR transfer, so the collector needs no custody-operator authority.

The conversion floor uses 18-decimal OMR/ETH, deducts canonical LP fee, a conservative 450-bps
canonical trade-cost allowance, and at most 1000 bps slippage (`270-283`). At 1 OMR/ETH, 3000-pip
LP fee and 1000-bps slippage, 1 OMR produces floor
`1e18 * 997000/1e6 * 9550/10000 * 9000/10000 = 856921500000000000 wei`.
Actual price impact still must satisfy the floor. Policy caps are positive and per-day limits cannot
be below per-call limits; policies are immutable after construction. Max health lease is one hour,
must exceed positive recovery grace, and health renewal after expiry restarts recovery (`149-159,278-283`).

Vault claims/exits do not consult conversion pause, health, snapshot, router or Hook.
Collection/funding deliberately omit those conversion gates while retaining funding-core runtime and
fixed-recipient checks (`173-195,221-230`). Thus a broken observation/conversion dependency cannot by
itself block forwarding existing ETH or returning mature OMR.

## Adversarial hypotheses and disposition

No confirmed defect was identified in these manual passes. The following concrete hypotheses were
checked and rejected or retained as explicit dependencies:

| ID | Trace considered | Disposition/evidence |
| --- | --- | --- |
| ETH-R01 | Stake twice at one timestamp, then relock after maturity to count principal twice. | Rejected: same-time reward checkpoint updates future balance only; relock does not change reward balance (`OmertaEthStakingV2.sol:179-186,354-367`). |
| ETH-R02 | Partially withdraw/relock an older lock, then withdraw its original full amount. | Rejected: both operations subtract the same position quantity; `_checkMatureAmount` bounds later use to the remainder (`166-185,302-304`). |
| ETH-R03 | Claim duplicate epoch IDs or reenter on ETH receipt to receive the same epoch twice. | Rejected: ordered IDs, flags-before-call, whole-batch rollback and reentrancy guard (`233-253`). |
| ETH-R04 | Add OMR at a closed boundary or donate assets to inflate historical weight or funding. | Rejected: integrals at the closed endpoint remain fixed; credit derives from exact deposits and `msg.value`, not raw balances (`147-160,202-229,354-390`). |
| ETH-R05 | Substitute a permissive Hook key or market state from another pool to sell OMR against unrelated observations. | Rejected for pinned concrete implementations: constructor/conversion check Hook key/manager/token, source identity and runtime (`OmertaEthRewardsV2.sol:232-240`). |
| ETH-R06 | Pause conversion or expire health after ETH is earned to freeze principal or claim funds. | Rejected for these dependencies: withdrawal/claim have no conversion call, and native forwarding bypasses conversion gates (`OmertaEthStakingV2.sol:166-176,233-253`; `OmertaEthRewardsV2.sol:188-195`). |
| ETH-R07 | A rejecting recipient or lying fee withdrawal leaves flags/caps funded without assets. | Rejected by EVM-wide revert and exact receipt/debit checks (`OmertaEthStakingV2.sol:249-252`; `OmertaEthRewardsV2.sol:173-195`). |
| ETH-A01 | Registered staker later changes account code or the vault loses pinned OMR operator identity. | External precondition retained: actual OMR still validates current receiver and operator on transfer (`OmertaRestrictedOMRV2.sol:270-280,314-330`). Registered-wallet admission is persistent, but adding account code can invalidate it. No claim that vault-local checks override token policy. |
| ETH-A02 | Governance stops renewing health, a keeper times a sale, or a finalized observation understates immediate price impact. | Explicit operational/economic trust: Safe/keeper timing, observed-liquidity limits and MEV exposure remain; bounded lease, recovery, caps and actual output floor limit conversion. Native funding and existing vault liabilities remain separate. |

No bridges, signed reward manifests, Merkle roots, debt, rebases, emissions, proxies or upgradeable
storage are introduced in the scoped implementation, so those specialized mechanisms are inapplicable.
The actual-manager fixed recipient requires a correct deterministic collector deployment prediction;
the test factory demonstrates CREATE ordering, while production address/bytecode prediction remains
a separate deployment check.

## Verification boundary and conclusion

This reviewer authored `test/market-v2/EthRewardsIntegrationV2.t.sol`, including actual restricted
token/manager/Hook/router/market-state collection, OMR conversion, paused native forwarding,
time-weighted ETH claims, independent 30-day deposit locks and mature principal exits. Additional
tests reject mismatched canonical key/source and assert fixed receiver bindings. Source inspection
also read the native unit/fuzz/invariant test coverage for partial exits/relocks, donation isolation,
recipient failures, reentry, claim replay, checkpoint intervals and conservation.

Those are test-source coverage claims, not executed results from this reviewer. The parent must
retain fresh compilation, focused suites, fuzz/invariant runs, static diagnostic triage and any fixes
with the final source hashes. No static engine was run here and no clean-scanner claim is made.

Manual review found no confirmed issue requiring a production change at the pinned bytes. This
independent pass alone does not establish release or deployment readiness. Its conclusion must be
reopened for material changes to the two native contracts or their transfer, canonical-route,
observation, runtime or authority dependencies.
