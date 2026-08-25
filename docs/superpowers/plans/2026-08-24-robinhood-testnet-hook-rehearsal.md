# Robinhood Testnet OmertaHook Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the immutable `OmertaHook` to Robinhood Chain Testnet at its mined CREATE2 permission address while leaving every pool, fee, recipient, observer, anti-snipe, and surge control dormant.

**Architecture:** Reuse the audited `DeployHook.s.sol` CREATE2 salt miner and the canonical Foundry CREATE2 factory. Add an operator-facing PowerShell wrapper that derives OMR and governance from the live manifest, pins the exact PoolManager runtime code hash, enforces broadcaster nonce 16, reconciles the dry-run transaction, and independently checks the deployed state. The TWAP phase remains separate and pending because no reviewed OMR/WETH V2-compatible pair exists yet.

**Tech Stack:** Solidity 0.8.26, Foundry 1.7.1, Uniswap v4-core, Windows PowerShell 5.1, Robinhood Chain Testnet 46630, Safe v1.4.1.

**Spec:** `omerta-contracts/DEPLOYMENT.md`

## Global Constraints

- Target only `https://rpc.testnet.chain.robinhood.com`; the RPC chain ID must be `46630`.
- Broadcast only from encrypted testnet keystore account `0x8c8DfE7B443C80603Fbb0E08F22aA859a98D747B`; never export its private key.
- Set owner to Safe `0x895fC13973f66Aa39A1fB27F4a3245c6aC9717B0`, version 1.4.1 and threshold 2 of 3.
- Use deployed OMR `0x8A2f28cC2a0Dd31122c80B6eCf19354E87B7010e` and PoolManager `0x8366a39cc670b4001a1121b8f6a443a643e40951`.
- Require PoolManager runtime code hash `0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626`, which matches Robinhood mainnet's official v4 PoolManager bytecode.
- Use canonical CREATE2 factory `0x4e59b44847b379578588920cA78FbF26c0B4956C` and Foundry `--always-use-create-2-factory` for simulation and broadcast.
- Require permission mask `0x3fff`, hook flags `0x30cc`, mined salt `0x19fc`, and vacant predicted address `0x9f86fE471EFD6089eeb7b43e008fD7D830f130Cc`.
- Leave sell tax, split values, all four recipients, allowed quote currencies, observer, anti-snipe configuration, surge configuration, and accrued balances at zero.
- Do not create or initialize a v4 pool in this phase.
- Do not rerun after a partial send; inspect `broadcast/DeployHook.s.sol/46630/run-latest.json` and the broadcaster nonce first.
- Continue in the user-approved current dirty worktree; do not commit, tag, or clean unrelated changes.

---

### Task 1: Test the hook-address permission guard

**Files:**
- Create: `omerta-contracts/script/Deploy-TestnetHook.Utilities.ps1`
- Create: `omerta-contracts/script/tests/Deploy-TestnetHook.Utilities.Tests.ps1`

**Interfaces:**
- Consumes: a 20-byte hexadecimal address and an expected 14-bit hook flag value.
- Produces: `Test-HookPermissionBits -Address <address> -ExpectedFlags 0x30cc` returning a Boolean or rejecting malformed input.

- [ ] **Step 1: Write the failing utility test.**

  The test runner must assert these hand-derived fixtures:

  ```powershell
  Assert-Equal (Test-HookPermissionBits `
      -Address '0x9f86fE471EFD6089eeb7b43e008fD7D830f130Cc' `
      -ExpectedFlags 0x30cc) $true 'mined address flags'
  Assert-Equal (Test-HookPermissionBits `
      -Address '0x9f86fE471EFD6089eeb7b43e008fD7D830f130Cd' `
      -ExpectedFlags 0x30cc) $false 'neighbor address flags'
  Assert-Throws { Test-HookPermissionBits -Address '0x1234' -ExpectedFlags 0x30cc } 'invalid address'
  ```

- [ ] **Step 2: Run the test and verify RED.**

  ```powershell
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\tests\Deploy-TestnetHook.Utilities.Tests.ps1
  ```

  Expected: failure because `Deploy-TestnetHook.Utilities.ps1` or `Test-HookPermissionBits` does not exist.

- [ ] **Step 3: Implement the minimal permission guard.**

  Validate `^0x[0-9a-fA-F]{40}$`, parse the final four hex digits as `UInt16`, apply `-band 0x3fff`, and compare with the expected flags.

- [ ] **Step 4: Rerun the test and verify GREEN.**

  Expected final line: `HOOK_UTILITY_TESTS_OK`.

### Task 2: Build the guarded testnet hook broadcaster

**Files:**
- Create: `omerta-contracts/script/Deploy-TestnetHook.ps1`
- Modify: `omerta-contracts/DEPLOYMENT.md`
- Modify: `omerta-contracts/deployments/46630/manifest.json`

**Interfaces:**
- Consumes: Phase 1 OMR address, Safe and broadcaster from the manifest, PoolManager and CREATE2 factory bytecode, encrypted deployer keystore, and `DeployHook.s.sol` dry-run record.
- Produces: a `-PreflightOnly` path and an explicit `DEPLOY HOOK` password-gated broadcast path.

- [ ] **Step 1: Implement static and live fail-closed checks.**

  Require chain 46630, Safe v1.4.1/threshold 2/three recorded owners, core and Bank deployed-dormant statuses, OMR bytecode and Safe owner, PoolManager code hash, CREATE2 factory bytecode, deployer nonce 16, and sufficient balance for twice the simulated fee.

- [ ] **Step 2: Run the exact non-broadcast simulation.**

  Set process-local `EXPECTED_CHAIN_ID`, `SAFE`, `OMR_ADDRESS`, and `V4_POOL_MANAGER` from validated manifest data, then execute:

  ```powershell
  forge script script\DeployHook.s.sol:DeployHook `
    --rpc-url https://rpc.testnet.chain.robinhood.com `
    --sender 0x8c8DfE7B443C80603Fbb0E08F22aA859a98D747B `
    --always-use-create-2-factory `
    --use cache\verify\solc-0.8.26.exe --offline --cache-path foundry-cache -vv
  ```

  Reconcile exactly one CREATE2 transaction named `OmertaHook`, from the broadcaster, to the canonical factory, at nonce 16, predicted address `0x9f86...30Cc`, and permission flags `0x30cc`; require the predicted address to be vacant.

- [ ] **Step 3: Add the explicit broadcast and post-deployment verifier.**

  Require case-sensitive confirmation `DEPLOY HOOK`, recheck nonce and vacancy after the simulation, then add `--keystore`, `--broadcast`, `--slow`, and `--always-use-create-2-factory`. Verify one successful matching receipt, deployed bytecode, Safe owner, exact PoolManager/OMR immutables, `HOOK_FLAGS() == 0x30cc`, and every mutable configuration value remains zero.

- [ ] **Step 4: Document the helper and record the simulation profile.**

  Add commands for preflight and broadcast to `DEPLOYMENT.md`. Record PoolManager/factory evidence, predicted address, salt, gas estimate, and dormant configuration in the manifest without marking the hook deployed.

### Task 3: Verify and hand off the hook broadcast

**Files:**
- Read: `omerta-contracts/broadcast/DeployHook.s.sol/46630/dry-run/run-latest.json`
- Execute: `omerta-contracts/script/Deploy-TestnetHook.ps1`

**Interfaces:**
- Consumes: the helper and its deterministic dry-run record.
- Produces: fresh local test evidence and one operator command that never exposes the keystore password.

- [ ] **Step 1: Parse the new PowerShell files with Windows PowerShell 5.1 and confirm this phase changed no Solidity source.**

  Do not run a formatting rewrite over the existing CRLF hook files after mining the CREATE2 salt: even a
  whitespace-only Solidity change alters compiler metadata, init-code hash, salt search, and the predicted
  hook address. Instead, require the parser to report zero errors for the three new PowerShell files and
  use the exact unchanged Solidity source in the full compilation/test and live simulation below.

- [ ] **Step 2: Run all 311 Foundry tests with 512 fuzz runs and require zero failures.**

  ```powershell
  cache\verify\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe test `
    --use cache\verify\solc-0.8.26.exe --offline --cache-path foundry-cache --fuzz-runs 512
  ```

- [ ] **Step 3: Run the live no-broadcast helper.**

  ```powershell
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetHook.ps1 -PreflightOnly
  ```

  Expected final lines:

  ```text
  HOOK_PREFLIGHT_OK=true
  No transaction was sent.
  ```

- [ ] **Step 4: Reconcile the dry-run address and manifest, then hand off the password-gated broadcast.**

  The operator runs the same helper without `-PreflightOnly`, types `DEPLOY HOOK`, enters the hidden testnet-keystore password, and returns the final `HOOK_OMERTAHOOK` line and receipt table. If Foundry stops after sending, do not rerun.
