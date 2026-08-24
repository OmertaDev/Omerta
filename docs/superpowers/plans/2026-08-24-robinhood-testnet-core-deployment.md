# Robinhood Testnet Phase 1 Core Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy and independently verify the ten OMERTA Phase 1 contracts on Robinhood Chain Testnet while every privileged issuance and market control remains dormant.

**Architecture:** A 2-of-3 Safe already owns governance. A single encrypted testnet deployer creates ten contracts with sequential CREATE nonces; a guarded PowerShell wrapper checks chain, Safe, profile, nonce, predicted addresses, gas, and post-deployment state. Bank, TWAP, and hook deployments remain separate phases because they depend on assets, vaults, pools, and liquidity that Phase 1 does not create.

**Tech Stack:** Solidity 0.8.26, Foundry 1.7.1, Windows PowerShell 5.1, Robinhood Chain Testnet 46630, Safe v1.4.1.

**Spec:** `omerta-contracts/DEPLOYMENT.md`

## Global Constraints

- Target only `https://rpc.testnet.chain.robinhood.com`, whose RPC chain ID must equal `46630`.
- Use broadcaster `0x8c8DfE7B443C80603Fbb0E08F22aA859a98D747B` from its encrypted testnet keystore; never export its private key.
- Set every contract owner to Safe `0x895fC13973f66Aa39A1fB27F4a3245c6aC9717B0`, version 1.4.1, with the recorded three owners and threshold 2.
- Use voucher signer `0x5CCD83A89b9cd1C4544679dec2087dfe04c06b62`, which is not a Safe owner.
- Keep `OMR.minter`, `GearVault.minter`, `StockVault.keeper`, `OmertaBond.oracle`, and OMR sell tax off after deployment.
- Use the conservative caps: 1,000 OMR/day for VoucherClaim and OmertaBond, 10 deeds/day, 10 dynasties/day, and 1 stock unit/token/day.
- Keep GenesisOracle closed with `price = 0` and `validUntil = 0`.
- Do not commit or tag the current dirty worktree unless the user explicitly selects a clean source-freeze step.
- Do not rerun the Phase 1 broadcast after a partial send; inspect `omerta-contracts/broadcast/Deploy.s.sol/46630/run-latest.json` and the on-chain deployer nonce first.

---

### Task 1: Prove the Phase 1 configuration and deterministic addresses

**Files:**
- Read: `omerta-contracts/.env`
- Read: `omerta-contracts/deployments/46630/manifest.json`
- Read: `omerta-contracts/script/Deploy.s.sol`
- Produce: `omerta-contracts/broadcast/Deploy.s.sol/46630/dry-run/run-latest.json`

**Interfaces:**
- Consumes: Safe manifest, conservative `.env` values, deployer nonce 1.
- Produces: ten ordered CREATE addresses and a gas estimate used by the broadcast guard.

- [x] **Step 1: Query the RPC chain ID, Safe bytecode/state, deployer nonce, and deployer balance.**

  Expected: chain ID `46630`, Safe version `1.4.1`, threshold `2`, nonce `1`, and balance `9996734030000000` wei at the completed preflight.

- [x] **Step 2: Run the non-broadcast Foundry simulation with the exact local compiler.**

  ```powershell
  Set-Location C:\Users\Jorge\Documents\Omerta\omerta-contracts
  .\cache\verify\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe script script\Deploy.s.sol:Deploy --rpc-url https://rpc.testnet.chain.robinhood.com --sender 0x8c8DfE7B443C80603Fbb0E08F22aA859a98D747B --use .\cache\verify\solc-0.8.26.exe --offline --cache-path foundry-cache -vv
  ```

  Expected: `Script ran successfully`, ten CREATE transactions at nonces 1 through 10, and an estimated requirement near `0.000442413482120673 ETH`.

- [x] **Step 3: Confirm all ten predicted addresses have no bytecode.**

  Expected: `cast code` returns `0x` for every address before broadcast.

### Task 2: Build and prove the guarded Windows broadcaster

**Files:**
- Create: `omerta-contracts/script/Deploy-TestnetCore.ps1`
- Modify: `omerta-contracts/DEPLOYMENT.md`
- Modify: `omerta-contracts/deployments/46630/manifest.json`

**Interfaces:**
- Consumes: `.env`, encrypted deployer keystore, Safe manifest, Foundry/cast/solc binaries, live RPC.
- Produces: `-PreflightOnly` read-only validation and an explicit-confirmation broadcast path.

- [x] **Step 1: Add fail-closed checks for chain, Safe, owners, threshold, signer separation, conservative configuration, nonce, address vacancy, and gas buffer.**

- [x] **Step 2: Add an explicit `DEPLOY CORE` confirmation and Foundry `--slow --broadcast` execution using the encrypted keystore.**

- [x] **Step 3: Add post-broadcast checks for bytecode, Safe ownership, dormant privileged controls, caps, and closed GenesisOracle.**

- [x] **Step 4: Parse the script with Windows PowerShell 5.1 and run its read-only mode.**

  ```powershell
  Set-Location C:\Users\Jorge\Documents\Omerta\omerta-contracts
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetCore.ps1 -PreflightOnly
  ```

  Expected final lines:

  ```text
  PREFLIGHT_OK=true
  No transaction was sent.
  ```

### Task 3: Choose the source-freeze posture and broadcast Phase 1

**Files:**
- Execute: `omerta-contracts/script/Deploy-TestnetCore.ps1`
- Produce: `omerta-contracts/broadcast/Deploy.s.sol/46630/run-latest.json`

**Interfaces:**
- Consumes: the successfully simulated current worktree or a user-approved clean deployment commit.
- Produces: ten successful testnet receipts and live contract bytecode.

- [x] **Step 1: Select one posture.**

  Option 1 broadcasts the current simulated dirty worktree and records `dirty-unfrozen` in the testnet manifest. Option 2 pauses, reviews only deployment-scoped diffs, and creates a clean deployment commit before rerunning preflight.

- [x] **Step 2: Run the guarded broadcaster.**

  ```powershell
  Set-Location C:\Users\Jorge\Documents\Omerta\omerta-contracts
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetCore.ps1
  ```

- [x] **Step 3: Review the displayed chain, Safe, caps, predicted addresses, and gas buffer; type `DEPLOY CORE` only if they match this plan.**

- [x] **Step 4: Enter the encrypted testnet deployer-keystore password at Foundry's hidden prompt.**

  Expected: ten receipts succeed, the broadcaster nonce advances from 1 to 11, and the helper prints `Phase 1 deployed and verified. Privileged paths remain OFF.`

### Task 4: Finalize the Phase 1 deployment record

**Files:**
- Modify: `omerta-contracts/deployments/46630/manifest.json`
- Read: `omerta-contracts/broadcast/Deploy.s.sol/46630/run-latest.json`

**Interfaces:**
- Consumes: ten contract addresses, transaction hashes, block numbers, compiler settings, and post-deployment reads.
- Produces: a complete non-secret Phase 1 manifest suitable for independent verification.

- [x] **Step 1: Copy the deployment output back into Codex.**

- [x] **Step 2: Record each transaction hash, block number, contract address, conservative constructor values, and the explicit gear-metadata warning in the manifest.**

- [x] **Step 3: Re-read all ten owners, four dormant address controls, five caps, GenesisOracle price/deadline, and deployer nonce from the RPC.**

  Expected: every owner equals the Safe; all four dormant address controls equal the zero address; caps match the conservative profile; GenesisOracle remains `0/0`; deployer nonce is `11`.

### Task 5: Continue with dependency-gated phases

**Files:**
- Read: `omerta-contracts/DEPLOYMENT.md`
- Execute later: `omerta-contracts/script/DeployBank.s.sol`
- Execute later: `omerta-contracts/script/DeployTwapOracle.s.sol`
- Execute later: `omerta-contracts/script/DeployHook.s.sol`

**Interfaces:**
- Consumes: finalized Phase 1 manifest plus independently selected external assets, vaults, pools, and liquidity.
- Produces: separate deployment records for Bank, TWAP oracle, and v4 hook.

- [ ] **Step 1: Stop before Bank deployment until a specific audited underlying ERC-20 and denomination-matched ERC-4626 vault are selected and their live bytecode is verified.**

- [ ] **Step 2: Stop before TWAP deployment until the OMR/WETH V2-compatible pair exists, has reviewed test liquidity, and its pair address is recorded.**

- [ ] **Step 3: Deploy the hook only after rechecking the canonical CREATE2 factory and PoolManager bytecode; leave all hook taxes and market migration off.**

- [ ] **Step 4: Keep backend chain variables dormant until each phase's on-chain reads match its manifest and the Safe activation batch has been independently decoded and simulated.**
