# Robinhood Testnet TWAP Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the final top-level OMERTA contract, `OmrTwapOracle`, on Robinhood Chain Testnet against an immutable chain-locked virtual OMR/WETH V2-compatible observation pair, without wiring it into `OmertaBond`.

**Architecture:** Add two unmistakably test-only dependencies: a fixed-supply virtual WETH token and a non-trading V2 observation pair whose immutable virtual reserves encode 5,000 OMR per ETH. Deploy those dependencies followed by the production `OmrTwapOracle` with the minimum 600-second window. A guarded PowerShell helper validates the completed core/Bank/hook manifest, nonce 17, deterministic CREATE addresses, virtual-reserve profile, gas, receipts, initial oracle unavailability, and continued `OmertaBond.oracle == address(0)`.

**Tech Stack:** Solidity 0.8.26, Foundry 1.7.1, OpenZeppelin ERC-20, Windows PowerShell 5.1, Robinhood Chain Testnet 46630, Safe v1.4.1.

**Spec:** `omerta-contracts/DEPLOYMENT.md`

## Global Constraints

- Target only `https://rpc.testnet.chain.robinhood.com`; require RPC chain ID `46630`.
- Broadcast only from encrypted testnet keystore account `0x8c8DfE7B443C80603Fbb0E08F22aA859a98D747B`; never export its private key.
- Set the `OmrTwapOracle` owner to Safe `0x895fC13973f66Aa39A1fB27F4a3245c6aC9717B0`.
- Use deployed OMR `0x8A2f28cC2a0Dd31122c80B6eCf19354E87B7010e`.
- Lock both test dependency constructors to chain ID `46630`.
- Mint exactly `1,000e18` Virtual Test WETH (`vtWETH`) to the Safe with no post-deployment mint function.
- The observation pair is not an AMM, holds no liquidity, exposes no swap/mint/burn/sync/reserve setter, and must never be presented as a production market.
- Encode immutable virtual reserves equal to `100e18` WETH and `500_000e18` OMR, i.e. exactly 5,000 OMR per ETH.
- Deploy the oracle with `PERIOD = 600` seconds, the contract's compile-time minimum.
- Keep `OmertaBond.oracle` at the zero address; do not call `setOracle` during this rehearsal.
- The new oracle must report `(0, 0)` until a full observation window closes.
- Do not rerun after a partial send; inspect `broadcast/DeployTestnetTwap.s.sol/46630/run-latest.json` and broadcaster nonce first.
- Continue in the user-approved dirty worktree; do not commit, tag, clean, or reformat unrelated source.

---

### Task 1: Specify the test-only TWAP dependencies with failing tests

**Files:**
- Create: `omerta-contracts/test/TestnetTwapDependencies.t.sol`
- Later create: `omerta-contracts/script/testnet/TestTwapDependencies.sol`

**Interfaces:**
- Consumes: Foundry `vm.getCode`, `OmrTwapOracle`, and hand-derived reserve/price literals.
- Produces: behavioral requirements for artifacts `TestTwapDependencies.sol:TestTwapWeth` and `TestTwapDependencies.sol:TestFixedOmrV2Pair`.

- [ ] **Step 1: Write four dependency tests before the contracts exist.**

  Use `vm.getCode` so the test suite compiles while the expected artifacts are missing. Cover:

  ```solidity
  function test_virtual_weth_is_fixed_supply_to_the_safe_and_has_no_mint_surface() public;
  function test_pair_sorts_tokens_and_encodes_exactly_5000_omr_per_eth() public;
  function test_pair_has_no_reserve_mutation_surface() public;
  function test_virtual_pair_drives_a_real_oracle_after_one_full_window() public;
  function test_dependencies_refuse_non_robinhood_testnet_chains() public;
  ```

  Derive the price independently as `(500_000e18 * 1e18) / 100e18 == 5_000e18` and assert the real oracle reports approximately that value after 601 seconds.

- [ ] **Step 2: Run only the new test contract and verify RED.**

  ```powershell
  cache\verify\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe test `
    --match-contract TestnetTwapDependenciesTest `
    --use cache\verify\solc-0.8.26.exe --offline --cache-path foundry-cache -vv
  ```

  Expected: failures naming missing `TestTwapWeth` and `TestFixedOmrV2Pair` artifacts.

### Task 2: Implement the minimum immutable virtual dependencies

**Files:**
- Create: `omerta-contracts/script/testnet/TestTwapDependencies.sol`
- Test: `omerta-contracts/test/TestnetTwapDependencies.t.sol`

**Interfaces:**
- Produces: `TestTwapWeth(address recipient)` and `TestFixedOmrV2Pair(address omr, address weth)` with the exact `IUniswapV2Pair` getter surface consumed by `OmrTwapOracle`.

- [ ] **Step 1: Implement `TestTwapWeth`.**

  Its constructor requires chain 46630 and a nonzero recipient, then mints `1_000e18` once. Override no ERC-20 behavior and add no mint/admin function.

- [ ] **Step 2: Implement `TestFixedOmrV2Pair`.**

  Require chain 46630 and distinct nonzero tokens. Sort token addresses, assign corresponding immutable `uint112` reserves for 100 WETH and 500,000 OMR, snapshot `uint32(block.timestamp)`, expose zero cumulative storage getters, and implement only:

  ```solidity
  function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
  ```

- [ ] **Step 3: Run the focused tests and verify GREEN.**

  Expected: all five new tests pass, including the real `OmrTwapOracle` integration after a 601-second warp.

### Task 3: Add the deterministic testnet TWAP deployer and guarded helper

**Files:**
- Create: `omerta-contracts/script/DeployTestnetTwap.s.sol`
- Create: `omerta-contracts/script/Deploy-TestnetTwap.ps1`
- Modify: `omerta-contracts/DEPLOYMENT.md`
- Modify: `omerta-contracts/deployments/46630/manifest.json`

**Interfaces:**
- Consumes: validated manifest Safe, OMR, OmertaBond, broadcaster, encrypted keystore, exact compiler, and live nonce 17.
- Produces: three ordered CREATE deployments—`TestTwapWeth`, `TestFixedOmrV2Pair`, `OmrTwapOracle`—and a password-gated `DEPLOY TWAP` broadcast path.

- [ ] **Step 1: Implement `DeployTestnetTwap.run()`.**

  Read `EXPECTED_CHAIN_ID`, `SAFE`, `OMR_ADDRESS`, and `TWAP_PERIOD_SECONDS`; require chain 46630 and period 600; deploy the three contracts in order; log their addresses and the warning that the pair is virtual and the oracle remains disconnected.

- [ ] **Step 2: Implement the PowerShell preflight.**

  Require completed dormant statuses for core, Bank, and hook; verify Safe owners/threshold; verify OMR and OmertaBond bytecode/owners; require `OmertaBond.oracle == address(0)`; require broadcaster nonce 17; run a non-broadcast simulation; reconcile exactly three sequential CREATE transactions at nonces 17–19; require each predicted address vacant; and require at least twice the simulated gas fee.

- [ ] **Step 3: Implement the password-gated broadcast and post-verifier.**

  Require case-sensitive `DEPLOY TWAP`, recheck nonce/vacancy, execute with the encrypted keystore and `--slow --broadcast`, then verify three successful receipts, runtime bytecode, fixed WETH supply/Safe balance, pair tokens/reserves/timestamp, oracle owner/pair/period/orientation, `consult() == (0,0)`, and `OmertaBond.oracle == address(0)`.

- [ ] **Step 4: Update the documentation and simulated manifest.**

  Document `-PreflightOnly` and broadcast commands, the exact test-only limitations, the 600-second first window, and the prohibition on wiring this virtual feed into bonds. Record predicted addresses, simulation gas, virtual reserves, period, and dormant status without marking deployment complete.

### Task 4: Verify and hand off the final deployment broadcast

**Files:**
- Execute: `omerta-contracts/script/Deploy-TestnetTwap.ps1`
- Read: `omerta-contracts/broadcast/DeployTestnetTwap.s.sol/46630/dry-run/run-latest.json`

**Interfaces:**
- Consumes: exact source, manifest, and live RPC.
- Produces: full verification evidence and the operator's final password-gated command.

- [ ] **Step 1: Parse the PowerShell helper with Windows PowerShell 5.1 and run `forge fmt --check` only on the three new Solidity files.**

- [ ] **Step 2: Run all Foundry tests with 512 fuzz runs and require zero failures.**

- [ ] **Step 3: Run the helper with `-PreflightOnly` and require `TWAP_PREFLIGHT_OK=true` plus `No transaction was sent.`**

- [ ] **Step 4: Reconcile dry-run data with the manifest and hand off the broadcast.**

  The operator runs the helper without `-PreflightOnly`, types `DEPLOY TWAP`, enters the hidden testnet-keystore password, and returns the receipt table and `TWAP_...` lines. If Foundry sends only part of the sequence, do not rerun.

### Task 5: Close the first test observation window without activating bonds

**Files:**
- Later create after deployment: `omerta-contracts/script/Update-TestnetTwap.ps1`
- Modify after update: `omerta-contracts/deployments/46630/manifest.json`

**Interfaces:**
- Consumes: deployed oracle address and `blockTimestampLast`, plus the broadcaster's encrypted keystore.
- Produces: one permissionless `update()` transaction after at least 600 seconds and a nonzero 5,000 OMR/ETH test reading.

- [ ] **Step 1: Read elapsed time and stop without sending if fewer than 600 seconds have passed.**

- [ ] **Step 2: After the window, require `UPDATE TWAP`, send `update()` using the encrypted testnet keystore, and verify the receipt.**

- [ ] **Step 3: Verify `consult()` is approximately `5_000e18`, `lastUpdate` is current, and `OmertaBond.oracle` remains zero.**

- [ ] **Step 4: Record the observation receipt and retain the manifest warning `test-only-virtual-feed-never-wire-to-bond`.**

