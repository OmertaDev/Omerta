# Uniswap routing release gate

Authority checked 2026-08-24: [Uniswap Labs — Routing for hooked pools](https://support.uniswap.org/hc/en-us/articles/48291859140621-Routing-for-hooked-pools) and the [Uniswap hooklist](https://github.com/Uniswap/hooklist).

`OmertaHook` is **not automatically eligible for Uniswap Labs routing**. Its core sell-tax mechanism uses `afterSwapReturnsDelta`; its immutable `0x30cc` permission set also reserves `beforeSwapReturnsDelta`. Either flag requires manual review. Do not describe a successful deployment, hooklist entry, or passing test suite as routing approval.

## Compliance map

| Labs criterion | Omerta evidence | Release status |
|---|---|---|
| Mainnet supported by Uniswap Labs | Robinhood is present in Uniswap's hooklist chain registry. Confirm the Labs router supports the production chain in the allowlist response. | External confirmation required |
| Address does not start `0x91` | `DeployHook.s.sol` skips every `0x91…` CREATE2 candidate and asserts the deployed address again. | Automated |
| Review-triggering flags disclosed | `OmertaHook.t.sol::test_routing_review_flags_are_limited_to_swap_return_deltas` pins both swap return-delta flags and proves no liquidity return-delta flags are present. | Automated; manual allowlist required |
| Source inspectable | Deploy from this repository and verify the exact Solidity source, compiler `0.8.26`, optimizer runs `800`, constructor arguments, and CREATE2 deployment on the production explorer. A repository link is fallback evidence, not permission to skip explorer verification. | Mainnet action required |
| No upgradeable proxy | `DeployHook.s.sol` directly CREATE2-deploys `OmertaHook`; the hook is the implementation and contains no proxy/delegatecall upgrade path. | Code-reviewed; verify deployed bytecode |
| AMM protocol fee preserved | The hook has no protocol-fee setter/collector path. `test_the_hook_does_not_bypass_the_amm_protocol_fee` proves PoolManager protocol fees accrue alongside the hook fee. | Automated |
| No router-specific calldata | Swap callbacks ignore `hookData`. `test_standard_router_swap_requires_no_custom_hook_data` proves empty standard data works and arbitrary data does not control the path. | Automated |
| No dynamic LP fee | The hook never calls `updateDynamicLPFee` and always returns a zero fee override. The canonical pool must use the signed-off static `DEX_POOL_FEE`. | Deployment configuration required |
| Not malicious or extractive | Sells can never be blocked; the base sell tax is capped at 10%; buys are free outside a non-renewable window of at most 200 blocks; fees and recipients are on-chain and evented. The intended 9% sell tax, temporary anti-snipe restrictions, mutable Safe controls, surge ceiling, and dev/treasury/community/LP split must all be disclosed. Only Uniswap Labs can decide whether that economic design is acceptable. | External judgment required |

The hooklist metadata should state `dynamicFee: false`, `upgradeable: false`, `requiresCustomSwapData: false`, `vanillaSwap: true`, and `swapAccess: temporal` (because the Safe can arm the bounded opening window). A hooklist entry is interface metadata only; it does **not** grant routing allowlist status.

## Before launch day

- [ ] Third-party contract audit is complete and its public URL is available.
- [ ] Deploy the final, audited hook directly on the supported production mainnet **before** pool launch. Record chain ID, hook address, salt, deployer, transaction, runtime code hash, PoolManager, OMR, Safe, and `HOOK_FLAGS`.
- [ ] Confirm the deployed address is not `0x91…` and its low 14 bits equal `0x30cc`.
- [ ] Verify the exact source and constructor arguments on the production block explorer.
- [ ] Initialize a small, static-fee review pool on each submitted chain and seed the minimum real liquidity needed for Labs to test it. The live form requires a deployed pool address; test-token pools are allowed, but an application for a major-pair listing must submit that pair. `beforeInitialize` still requires OMR plus a Safe-approved quote, so this cannot be an arbitrary two-test-token pool.
- [ ] Submit the [Uniswap Labs routing allowlist form](https://share.hsforms.com/15fMHwt6NTzuKuQdxw6nHwws8pgg). Include the deployed hook and review-pool addresses; disclose both return-delta flags and every economic/admin behavior listed above; attach the explorer source, repository, audit, tests, and intended production pool key.
- [ ] Record affirmative routing approval from Uniswap Labs. Submission alone is not approval, and Labs explicitly does not guarantee allowlisting.
- [ ] Seed or migrate canonical production liquidity only after approval. Use only the signed-off static-fee pool key; do not substitute a dynamic-fee pool at launch.
- [ ] Before announcing liquidity, execute a small exact-input buy and sell through the actual Uniswap Labs interface/router. Verify both routes quote and settle, the protocol fee still accrues, the hook fee matches disclosure, and no custom calldata or custom router is used.
- [ ] After deployment, submit the hook to the [Uniswap hooklist repository](https://github.com/Uniswap/hooklist) for the human-readable name and description. Track this separately from routing approval.

If Labs declines or has not confirmed the hook by launch, the hooked pool may still exist at the protocol level, but launch materials must not claim Uniswap Labs routing support. The honest options are to delay the canonical hooked-pool launch or obtain a new economic/design sign-off for a hook that does not require return-delta accounting.
