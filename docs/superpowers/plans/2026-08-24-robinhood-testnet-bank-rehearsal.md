# Robinhood Testnet Bank Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a chain-locked test asset, its matching ERC-4626 vault, Denari, Transmuter, and Alchemist on Robinhood Chain Testnet without arming issuance, redemption, funding, or borrowing.

**Architecture:** Two fixed-purpose dependency contracts provide a 6-decimal USD-shaped test asset and a standard OpenZeppelin ERC-4626 vault. One Foundry script deploys those dependencies and the three Bank contracts in a deterministic five-transaction sequence, while a PowerShell wrapper performs live preflight and post-deployment checks. This phase is testnet-only and cannot be reused as a production Bank market.

**Tech Stack:** Solidity 0.8.26, OpenZeppelin Contracts, Foundry 1.7.1, Windows PowerShell 5.1, Robinhood Chain Testnet 46630.

**Spec:** `omerta-contracts/DEPLOYMENT.md` Phase 2 and `omerta-contracts/src/Transmuter.sol` denomination-matching rules.

## Global Constraints

- Compile with solc 0.8.26, optimizer 800, and Cancun EVM settings.
- Refuse dependency construction unless `block.chainid == 46630`.
- Use a 6-decimal asset so Transmuter and Alchemist derive `scale == 1e12` against 18-decimal Denari.
- Mint a fixed `1_000_000e6` test-asset supply to Safe `0x895fC13973f66Aa39A1fB27F4a3245c6aC9717B0` at construction.
- Expose no faucet, owner mint, post-deployment mint, blacklist, fee, or upgrade path on the test asset.
- Deploy all three Bank contracts owned by the Safe.
- Leave `Denari.minter`, `Denari.burner`, all Transmuter funders/caps/reserves, Alchemist mint caps, and Alchemist fee recipient unconfigured.
- Require broadcaster `0x8c8DfE7B443C80603Fbb0E08F22aA859a98D747B` to begin at nonce 11.
- Do not rerun after a partial broadcast; inspect `broadcast/DeployTestnetBank.s.sol/46630/run-latest.json` and the broadcaster nonce.
- Do not commit unrelated dirty worktree files.

---

### Task 1: Testnet dependency contracts

**Files:**
- Create: `omerta-contracts/test/TestnetBankDependencies.t.sol`
- Create: `omerta-contracts/script/testnet/TestBankDependencies.sol`

**Interfaces:**
- Consumes: OpenZeppelin `ERC20`, `ERC4626`, and `IERC20`.
- Produces: `TestBankAsset(address recipient, uint256 initialSupply)` and `TestBankVault(IERC20 asset)`.

- [x] **Step 1: Write a failing artifact-level test before the contracts exist.**

  The test deploys creation bytecode returned by `vm.getCode`, sets chain ID 46630, and asserts the literal names, symbols, 6 decimals, fixed supply, Safe balance, and `vault.asset()` link. A separate test sets chain ID 1 and requires both constructors to fail.

- [x] **Step 2: Run the focused test and observe failure because the artifact is absent.**

  ```powershell
  .\cache\verify\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe test --match-contract TestnetBankDependenciesTest --use .\cache\verify\solc-0.8.26.exe --offline --cache-path foundry-cache -vv
  ```

- [x] **Step 3: Implement the minimum fixed-supply asset and ERC-4626 vault.**

  ```solidity
  contract TestBankAsset is ERC20 {
      constructor(address recipient, uint256 initialSupply) ERC20("Test Bank USD", "tbUSD") {
          require(block.chainid == 46630, "TestBankAsset: testnet only");
          require(recipient != address(0) && initialSupply != 0, "TestBankAsset: bad genesis");
          _mint(recipient, initialSupply);
      }
      function decimals() public pure override returns (uint8) { return 6; }
  }

  contract TestBankVault is ERC4626 {
      constructor(IERC20 asset_) ERC20("Vault Test Bank USD", "vtbUSD") ERC4626(asset_) {
          require(block.chainid == 46630, "TestBankVault: testnet only");
      }
  }
  ```

- [x] **Step 4: Rerun the focused test and require all dependency tests to pass.**

### Task 2: Combined Bank deployment script

**Files:**
- Create: `omerta-contracts/script/DeployTestnetBank.s.sol`
- Create: `omerta-contracts/script/Deploy-TestnetBank.ps1`
- Reuse: `omerta-contracts/script/Deploy-TestnetCore.Utilities.ps1`

**Interfaces:**
- Consumes: `EXPECTED_CHAIN_ID`, `SAFE`, the encrypted deployer keystore, and the live RPC.
- Produces: TestBankAsset, TestBankVault, Denari, Transmuter, and Alchemist addresses in that nonce order.

- [x] **Step 1: Implement the Solidity script with a fixed `1_000_000e6` test supply.**

  ```solidity
  TestBankAsset asset = new TestBankAsset(safe, 1_000_000e6);
  TestBankVault vault = new TestBankVault(IERC20(address(asset)));
  Denari denari = new Denari("Denari", "DNR", safe);
  Transmuter transmuter = new Transmuter(denari, IERC20(address(asset)), safe);
  Alchemist alchemist = new Alchemist(denari, IERC20(address(asset)), IERC4626(address(vault)), transmuter, safe);
  ```

- [x] **Step 2: Implement PowerShell guards for chain 46630, completed Phase 1 manifest, Safe bytecode/state, nonce 11, five vacant predicted addresses, and a 2x gas buffer.**

- [x] **Step 3: Require exact confirmation `DEPLOY BANK`, then broadcast through the encrypted keystore with Foundry `--slow`.**

- [x] **Step 4: Verify code, constructor links, Safe ownership, `scale == 1e12`, fixed supply, Safe balance, and every dormant Bank role/control after broadcast.**

### Task 3: Compile and simulate the complete Bank phase

**Files:**
- Produce: `omerta-contracts/broadcast/DeployTestnetBank.s.sol/46630/dry-run/run-latest.json`
- Modify: `omerta-contracts/deployments/46630/manifest.json`

**Interfaces:**
- Consumes: nonce 11 and the live Phase 1 deployment.
- Produces: five deterministic addresses, gas estimate, and a Bank preflight record.

- [x] **Step 1: Run the focused dependency tests plus the existing full Bank suite.**

  ```powershell
  .\cache\verify\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe test --match-path test\Bank.t.sol --use .\cache\verify\solc-0.8.26.exe --offline --cache-path foundry-cache -vv
  ```

- [x] **Step 2: Run the guarded read-only preflight.**

  ```powershell
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetBank.ps1 -PreflightOnly
  ```

- [x] **Step 3: Record the predicted five-address map, nonce range 11–15, gas estimate, and test-only dependency profile in the manifest.**

### Task 4: Broadcast and finalize the Bank record

**Files:**
- Execute: `omerta-contracts/script/Deploy-TestnetBank.ps1`
- Produce: `omerta-contracts/broadcast/DeployTestnetBank.s.sol/46630/run-latest.json`
- Modify: `omerta-contracts/deployments/46630/manifest.json`

**Interfaces:**
- Consumes: successful preflight and hidden testnet keystore password.
- Produces: five successful receipts and a deployed-but-unarmed Bank phase.

- [ ] **Step 1: Run the guarded broadcaster and type `DEPLOY BANK` after reviewing its output.**

  ```powershell
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetBank.ps1
  ```

- [ ] **Step 2: Enter the testnet keystore password only at Foundry's hidden prompt.**

- [ ] **Step 3: Independently reconcile all five receipts, live bytecode, constructor links, owners, and dormant controls with the manifest.**

- [ ] **Step 4: Stop before Bank activation; seeding and role wiring require a separately decoded 2-of-3 Safe batch.**
