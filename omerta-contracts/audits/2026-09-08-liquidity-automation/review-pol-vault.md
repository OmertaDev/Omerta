# Restricted POL custody implementation and review

Review date: 2026-09-08. Phase: local implementation and real-AMM integration tests; no deployment, funding, production transaction, auction activation, or bond activation.

## Source and scope

Repository base HEAD was `e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`; the workspace was dirty and the new files were uncommitted. Conclusions apply to the working-tree hashes below, not the base commit alone.

| Reviewed file | SHA-256 |
| --- | --- |
| `omerta-contracts/src/ProtocolLiquidityVault.sol` | `a769361fbd3926f4a360ae726722d5f830a30251e932fe01f2f01f60dfa276e0` |
| `omerta-contracts/test/ProtocolLiquidityVault.t.sol` | `34d5aa40bcd0d1c2ce79afca915541dd6c1a5a859fa71668a780cb44d268354f` |
| `omerta-contracts/out/ProtocolLiquidityVault.sol/ProtocolLiquidityVault.json` | `3fe1dbfe15bb4e3a92ec03874a910d257a1d4c3f11719f7eb36e826faa2a9166` |

The vault runtime template is **23,220 bytes**, below the 24,576-byte EIP-170 limit. Immutable values change deployment-specific runtime hashes; the artifact hash above is not a production-address bytecode attestation.

Compiler: Solidity 0.8.26, optimizer enabled, 800 runs, Cancun, via-IR for the new vault, its test file, and the new upstream PositionManager source. The real PoolManager artifact uses the repository's normal non-IR profile. Forge is 1.7.1, commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`, dist build dated 2026-05-08.

New upstream dependency checkouts:

- Uniswap v4-periphery: `ad04c9f24a170accf5ea1b2836bbafd514537ca6` (v1.0.2).
- Uniswap Permit2: `cc56ad0f3439c502c246fc5cfcc3db92bb8b7219`.
- Existing v4-core is the vendored 1.0.2 package; existing OpenZeppelin and forge-std selection comes from the repository's dependency/bootstrap configuration. Those existing folders are not independently pinned Git checkouts: running `git -C` there resolves the parent repository and must not be reported as an upstream commit.

Scope includes fixed custody and adoption, bootstrap/mutation authority, native and OMR accounting, approvals/refunds, fee routing, bounded spending, callbacks, runtime/chain guards, and emergency recovery. The real existing OmertaHook and the new LiquidityBuybackExecutor are exercised as integrations. Their entire independent implementations, production TWAP security, GenesisLifecycleController's auction/migration state machine, upstream CCA/LBP, persistence/indexer behavior, and deployment transactions require the corresponding bundle review evidence.

## System model and authority

The vault owns exactly one registered PositionManager NFT for an immutable native-ETH/18-decimal-OMR PoolKey at the exact full-range usable ticks. Its immutable floor is denominated in Uniswap liquidity units. All routine keeper additions preserve the NFT and increase its liquidity. There is no keeper principal withdrawal, burn, transfer, arbitrary approval, router calldata, recipient, pool, or token-ID selector.

| Surface | Authority and effect |
| --- | --- |
| `mintFoundation` | Owner-only bounded bootstrap. Uses the configured oracle and typed PM mint actions. |
| `adoptFoundation` | Owner registers an already vault-owned qualifying NFT. |
| ERC-721 receiver | Only the configured PM, with both transfer sender and operator equal to the owner, can register the first qualifying NFT. |
| `setGenesisController` | Owner-only, once, before any position. Checks controller code, vault, token and pool, and pins its runtime hash. |
| `adoptGenesisFoundation` | Only that pinned controller can register a qualifying already-owned NFT. No asset movement or changed recipient. |
| `increase` | Keeper-only after custody warmup. Oracle age/future/zero/deviation checks, per-action and trailing-window budgets, typed PM add, exact received/refunded balance accounting. |
| `collectFees` | Permissionless fixed-position zero-liquidity decrease and take. No principal decrease. Actual native/OMR fee deltas route 75% to Desk and the exact remainder to Vig. |
| `setInventoryExecutor` | Owner-only and once. Pins runtime and requires the exact token, manager, pool, Pol stream, sole vault recipient, vault health guard and same oracle. |
| `fundInventory` | Keeper can deposit bounded native ETH only into the fixed executor. Shares the same native spend window as liquidity additions. |
| Pause and resume | Keeper/owner may stop. Owner resumes; custody warmup restarts. An empty pre-bootstrap vault resumes with no activation timestamp or healthy assertion. |
| Emergency | Keeper/owner may permanently latch unhealthy. Only owner may recover the registered NFT, native ETH and OMR, always to the original immutable Safe. |

Each external PM operation settles through the real Permit2 integration. ERC-20 allowance to Permit2 and Permit2 allowance to PM are set to the requested maximum and revoked after success. Any failure rolls back the whole operation. PM native dust is measured before the call and accounted separately from the returned unused native maximum, so a donation cannot disguise spending.

Additions first collect existing fees into the vault and reserve them. Fee recipients are called only after the addition and its actual usage checks, preventing a recipient callback from moving the price between fee collection and addition. Liquidity hook callbacks and subscribed positions are rejected. The public health view returns false during a guarded operation, including fee and emergency receiver callbacks.

The spend ring contains at most 64 actions in a true trailing time window. Reservations use maxima and shrink to actual consumption after the PM refund. Deposits retain their actual fixed amount. Boundary-adjacent calls do not receive two independent fresh calendar budgets.

## Methods applied

The repository's agent-led policy is the governing review policy. These were bounded manual adaptations, not claims that the upstream full orchestrators or all their tools ran:

- Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`: `solidity-auditor/references/senior-auditor-sop.md`, plain-language function explanation, assumption questioning and backward attack traces.
- Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: `agents/depth-token-flow.md`, separate native/token entry and exit tracing, donation/collision hypotheses, exact constants, external trust dependencies and real-AMM evidence.
- Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc`: audit context building and callee/authority tracing, followed by stateful property checks. No additional agent slot was available for a per-function subagent decomposition, so this pass was performed locally.
- Local `v4-security-foundations/SKILL.md`: permission-bit, settlement-delta, sender/receiver identity, token behavior and callback boundaries. This work adds custody/periphery integration, not a new hook. Generic skill recommendations do not replace the repository's scoped release policy.

## Findings, corrections and retest

### POL-01 — Pre-bootstrap pause could strand normal startup (medium availability, resolved)

Before correction, `pauseAutomation()` could run with `positionId == 0`, while `resumeAutomation()` required `_foundationValid(positionId)`. Both mint/adoption paths required the vault to be unpaused. Trace: keeper pauses an empty vault; owner resume fails on the absent position; owner mint/adoption also fails because paused. Normal startup then requires replacing the vault, even though the pause was intended to be resumable. No unauthorized principal withdrawal was demonstrated.

Correction permits owner resume when the position is absent, while keeping `activationTimestamp == 0` and health false. Existing-position resume still revalidates custody/dependencies and restarts the full warmup. `test_pause_before_bootstrap_can_resume_without_starting_warmup` passes against the corrected source. This was found by source/state trace; a separate pre-fix bytecode execution was not retained.

### POL-02 — Generic executor primary recipient did not prove exclusive POL routing (low configuration validation, resolved)

The generic executor's `destination()` returns its primary recipient. A Vig executor can set the vault as primary while sending half its bought OMR to a separate secondary. Checking only the primary recipient, token and pool would accept that misconfiguration during the owner-only, one-time binding. A different oracle or health guard also failed to express the intended shared dependencies.

Correction requires Pol stream (`3`), zero secondary recipient, the same oracle and the vault itself as health guard. `test_inventory_binding_rejects_split_stream_and_foreign_oracle_or_health_guard` constructs real executors for these mismatches and proves binding reverts. The successful real-executor funding → swap → vault delivery → LP addition composition also passes. This boundary still relies on governance selecting the reviewed direct implementation; matching getters alone cannot authenticate malicious code.

### POL-03 — Zero-hook address hash could depend on account existence (low robustness, resolved)

The initial dependency expression compared even the zero hook address's codehash. On a chain where that address begins nonexistent, sending it native currency can change EXTCODEHASH from zero to the empty-code hash. The configured canonical OmertaHook is nonzero, but a hookless fixture/pool should not be disabled by funding an unused address. The check now ignores the hook hash when no hook is configured. The zero-address donation regression passes.

### Adversarial hypotheses checked

- Pre-existing PM native dust cannot understate usage: real add with 7 ETH of PM dust still charges the full 2 ETH contribution and explicitly returns the dust.
- Fees cannot be relabeled donated vault principal: direct vault native/token gifts remain in vault, and a zero-fee collection routes zero.
- Fee collection/addition cannot withdraw the registered LP principal: real PM liquidity is unchanged for zero-delta collection and increases by the actual added liquidity for additions.
- Keeper cannot approve or transfer the NFT. Genesis nomination cannot register foreign-owned, wrong-range, wrong-pool or below-floor positions; failures roll back the controller's state too.
- Rejected native fee recipients revert atomically without losing accrued fees or LP principal. Reentrant fee callbacks see unhealthy and cannot recurse into collection.
- Emergency recipients observe the permanent latch before NFT and native callbacks. Keeper cannot recover principal or resume a latched vault.
- Runtime/chain changes, oracle zero/future/staleness/deviation, expired/excessive deadlines, insufficient balances, action/window limits and exhausted ring slots fail closed.

## Executed evidence

Final command in `omerta-contracts`:

```text
FOUNDRY_INVARIANT_RUNS=128
FOUNDRY_INVARIANT_DEPTH=64
FOUNDRY_INVARIANT_FAIL_ON_REVERT=true
forge test --match-path test/ProtocolLiquidityVault.t.sol --fuzz-seed 0x20260908 -vvv
```

Result: **41 passed, 0 failed, 0 skipped**, comprising 38 unit/fuzz tests and 3 stateful invariants. The fee-conservation fuzz test ran 512 cases. Each invariant ran 128 sequences of 64 calls, or 8,192 calls per property, with zero handler reverts. Handler selectors covered additions, funding, fee collection, real swaps, donations, elapsed time, pause/resume, and unauthorized attempts. Setup primes successful adds, funding and real fee generation, so the invariants do not pass solely through a never-successful handler.

Retained final output: `pol-tests-final.log`; exit marker: `pol-tests-final.log.exit` (`0`). Earlier evidence is retained in `pol-tests-initial.log`, `pol-tests-invariants.log`, and `pol-tests-genesis-final.log`, with their exit markers. Early failures were disclosed: missing upstream ERC-721 declarations in its PM interface, stack-depth build/profile issues, a chain-id restoration harness optimization, and the hook integration harness checking recipient balances before its required permissionless sweep. These were addressed before the final run. The normal PoolManager artifact plus via-IR periphery split avoids the Solidity 0.8.26 upstream Pool.swap Yul compilation failure; it still deploys actual upstream bytecode.

The oracle is an explicitly named controllable fixture for failure injection. Permit2 uses the pinned upstream precompiled deployment fixture. PM metadata and WETH9 constructor dependencies are zero because neither metadata rendering nor wrapping is used by these native actions. The AMM, position accounting, allowances and hook interactions are real implementations. This is local EVM evidence, not a production fork or on-chain deployment claim.

## Remaining review and operating limits

- Bundle-wide Slither diagnostics and triage are owned by the parent review and are not claimed complete in this note. The only final compiler diagnostic for this file recommends marking its always-reverting ownership-renunciation override `view`; it has no state/asset effect.
- Clean build tooling must fetch the newly pinned periphery and Permit2 dependencies because `lib/` is ignored. This requirement was sent to the parent for CI/bootstrap integration.
- `healthy()` proves continuous custody of the configured nominal liquidity floor since activation, plus current in-range status. It does not prove historical market depth or continuously in-range liquidity at every intermediate price. A fresh, independently suitable TWAP remains a separate requirement.
- Dependency runtime hashes do not pin a proxy implementation or validate deployment parameters. Only reviewed direct implementations and reviewed parameters satisfy the intended configuration.
- Fixed fee recipients that reject transfers can stop routine collection/addition until their behavior is repaired or governance performs latched recovery. Fee accounting and principal remain intact on revert; immutable routing is deliberate.
- The planner preserves matching native inventory using the oracle-valued excess policy. The vault's funding authority itself enforces fixed routing and bounded shared spend, not an internal 50/50 pairing reserve.
- The genesis adoption fixture proves only the vault boundary. The actual controller must separately prove its pinned CCA ABI, committed auction/migration parameters, success detection, clock domain and one-time lifecycle; those tests are maintained by the other review agent.

For the two hashed files and the stated local phase, the implemented custody/accounting properties have passing targeted evidence. This note does not authorize deployment or expand the scope of any sealed prior audit.
