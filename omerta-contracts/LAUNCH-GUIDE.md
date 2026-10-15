# OMERTA smart-contract launch: operator guide

Prepared September 24, 2026 against repository HEAD `e56cf576065c5f1bbb9bb55115f5961267f7d654` and the inspected working tree. This is a launch procedure, not a release-readiness verdict. The working tree contained uncommitted changes; choose and review a clean release revision before execution. No deployment, funding, signing, production configuration, or launch verification was performed to prepare this guide.

The intended route is **Robinhood mainnet → Safe → dormant core → optional character checkout → automated CCA genesis → pool migration → oracle warmup → bonds and other approved rails**. Deploying a contract and opening it to users are separate milestones.

Robinhood currently documents mainnet chain ID **4663**, testnet **46630**, and ETH gas. Use a production RPC provider with the historical reads your indexer needs; the public endpoint is rate-limited and not recommended for production. Recheck these facts during the ceremony. Sources: [network configuration](https://docs.robinhood.com/chain/connecting/) and [contract deployment](https://docs.robinhood.com/chain/deploy-smart-contracts/).

## 1. Decide exactly what this release opens

**Responsible: release owner.** Record the selected scope and who can approve each activation.

| Milestone | What happens | Dependency |
| --- | --- | --- |
| Contract deployment | Safe plus ten core contracts; privileged issuance/delivery controls remain off | Clean release, scoped review, Safe ceremony |
| Paid character/NFT checkout | OmertaFees payments and eligible DynastyNFT claims | Checkout, wallet authentication, deployment-bound database and indexing evidence |
| Token genesis | Seven-day CCA sale, then native ETH/OMR v4 pool | Hook, final oracle, splitter, POL vault, automation, routing resolution, Safe launch ceremony |
| Post-genesis issuance | Reserve bonds and other individually approved rails | Proven pool custody, oracle and foundation warmup, configured limits |
| Later releases | Bank, RWA delivery/market modules, other dormant components | Separate scope, review and activation |

The first core script creates **OMR, GearVault, VoucherClaim, OMRStaking, OmertaFees, StreetDeed, DynastyNFT, StockVault, GenesisOracle and OmertaBond**. It does not launch a token sale or deploy THE BANK. Character checkout can ship independently of OMR trading.

Do not deploy/fund incomplete acquisition components or assume that every `.sol` file belongs in this release. Use the exclusions in [DEPLOYMENT.md](DEPLOYMENT.md) and the exact scoped review.

**Pass condition:** a written phase scope, named release owner, deployment operator, independent transaction reviewer, Safe signers and incident contact.

## 2. Close the known preparation gaps

**Responsible: release owner and engineering.** Resolve these before assigning a public launch time:

- Finalize DEV, Vig, treasury, Safe owner, signer, guardian and keeper public addresses; approve custody and funding budgets. The automated LP position recipient is `ProtocolLiquidityVault`.
- Finish or demonstrate closure of the character checkout findings in [CHARACTER-NFT-LAUNCH.md](CHARACTER-NFT-LAUNCH.md): payment and claim submission, rejected-wallet/refresh recovery, origin-bound ERC-4361 wallet authentication, durable chain/contract database binding, public metadata, and persistent-database recovery. That document records open work; it is not proof of the current implementation's readiness.
- Use the revised OmertaFees. The historical testnet fee contract uses the old mint split and cannot be changed into the current implementation by editing recipients.
- Resolve the launch-specific review for the **seven-day, uncapped** CCA and current automation/bond policy. Historical capped-auction evidence does not cover this configuration.
- Resolve Uniswap Labs routing before committing the public token launch schedule. OMERTA's return-delta hook flags require manual allowlisting under [current Labs guidance](https://support.uniswap.org/hc/en-us/articles/48291859140621-Routing-for-hooked-pools). A deployed hook or hooklist entry is not approval. The existing [routing runbook](../UNISWAP-ROUTING.md) requires a review pool, while the current hook only accepts initialization through the pinned LBP strategy. Obtain an approved review sequence; do not manually initialize the canonical pool to satisfy an older checklist.

Several old instructions must not be copied literally:

| Older instruction | Instruction for this route |
| --- | --- |
| Bootstrap bonds alongside genesis | CCA is the sole primary sale during genesis; direct on-chain bonding stays disabled |
| 72-hour auction in the release-manifest example | **168 hours**, as enforced by `src/genesiscadence.js`; regenerate all blocks and evidence |
| Deploy v4 oracle only after migration | Automated mode deploys the final bootstrap-capable oracle **before** vault/controller and auction |
| Generic Safe as LP recipient | Automated mode uses the reviewed POL vault |
| Third-party review as the universal internal gate | [SECURITY-REVIEW-POLICY.md](SECURITY-REVIEW-POLICY.md) governs the scoped agent-led review; satisfy any separate external/platform requirements too |
| Zero daily bond cap means disabled | Zero means unlimited; it requires explicit matching policy and review. Initial core deployment still requires its fixed positive cap |

**Pass condition:** each applicable gap has evidence or a documented decision to defer the affected milestone. Contract-only deployment need not wait for a deferred checkout or token launch, but cannot be advertised as their activation.

## 3. Freeze the release and retain the evidence

**Responsible: engineering and security reviewer.** Reconcile intended changes into a clean release checkout; preserve unrelated development work. Record the full commit, tool versions, dependency pins, configuration, source/artifact hashes and review-package hash. Keep ceremony evidence outside the checkout, for example `C:\secure-launch-evidence`, so it does not invalidate clean-tree checks.

From the repository root, run the release checks in the reviewed environment:

```powershell
git status --short
git rev-parse HEAD
node --version
forge --version
npm ci
node tools/validate-fee-splits.js
npm run gearcaps -- --json
npm test
$env:FOUNDRY_PROFILE = 'default'
forge build --force --root .\omerta-contracts
forge test --root .\omerta-contracts -vv
forge build --root .\omerta-contracts --sizes --skip FuzzTester
```

Check each exit status; stop on failure. Use native Solidity **0.8.26**, optimizer **800**, **Cancun**, and the per-contract compiler restrictions in [foundry.toml](foundry.toml). Preserve CI's dependency pins; do not install moving dependency versions for the ceremony. Keep the standard `out/` location because conformance tests read it.

Require passing release CI for that revision, including the real-PostgreSQL, economy, contract-size and relevant on-chain integration checks in [ci.yml](../.github/workflows/ci.yml), [forge.yml](../.github/workflows/forge.yml) and [liquidity-postgres.yml](../.github/workflows/liquidity-postgres.yml). Use disposable databases for tests. If path filters skip a required workflow, run it explicitly on the candidate. Retain static-analysis triage, fuzz/invariant results, fixes/retests and exclusions under the security policy; fix and retest in-scope critical/high findings.

Rehearse the selected public flow before mainnet. For characters, use `npm run character:rehearsal` plus the persistent testnet/browser exercise. For genesis, use `npm run genesis:fork` against the reviewed mainnet stack and `npm run liquidity:e2e` with its documented disposable PostgreSQL setup. The fork harness uses a recorded ArbSys shim; it does not prove production timing or replace the production Safe simulation. The obsolete testnet hook wrapper is retired.

**Pass condition:** the exact clean revision has a complete scoped contract/signer/backend review and passing required evidence. Historical test counts and hashes entered into a form are insufficient.

## 4. Prepare governance, keys and public configuration

**Responsible: Safe signers and deployment operator.** Establish three independently controlled mainnet owners with a **2-of-3** threshold. Rehearse transaction decoding and recovery. Use a dedicated voucher signer, separate from Safe owners; separate liquidity/oracle keepers with limited gas balances. Keep signing secrets in the approved signing service/secret manager, never in deployment documents or `.env.mainnet`.

Use the encrypted Foundry account `omerta-mainnet-deployer` for the guarded scripts. Phase 0 requires the broadcaster to be Safe owner 1; Phase 1 may use a separate approved deployer. Never reuse testnet keystores.

From the repository root:

```powershell
Set-Location .\omerta-contracts
if (-not (Test-Path .env.mainnet)) {
    Copy-Item .env.mainnet.example .env.mainnet
}
$env:CHAIN_RPC_URL = 'https://REPLACE_WITH_APPROVED_MAINNET_RPC'
cast chain-id --rpc-url $env:CHAIN_RPC_URL
```

The returned chain must be `4663`. Populate [.env.mainnet.example](.env.mainnet.example)'s fields in the private local copy: clean release commit, current deployer nonce, actual retained review SHA-256, signer review attestation, Safe infrastructure/owners/salt, recipients and final metadata. Independently open and hash the referenced review package; the wrappers only check the attestation fields' format.

Before Phase 1, `POL_WALLET=SAFE`; Bank addresses, `OMR_ADDRESS` and `OMR_V2_PAIR` remain zero; genesis price/deadline remain `0/0`. The wrapper enforces a fixed constructor profile: 1,000 OMR daily voucher/bond caps, 10 deeds and NFTs/day, stock default cap of 1 raw token unit, 14% staking APY, 0.01 ETH mint fee, 0.1 ETH respawn fee, 5% NFT royalty, and a 15,000 OMR/ETH absolute bond rate ceiling. These are the wrapper's values, not newly recommended economic settings. A different profile requires a reviewed release change.

**Tooling prerequisite:** the Windows wrappers use these exact files under `omerta-contracts`, rather than searching `PATH`: `cache/verify/node_modules/@foundry-rs/forge-win32-amd64/bin/forge.exe`, the equivalent `cast-win32-amd64/bin/cast.exe`, and `cache/verify/solc-0.8.26.exe`. Provision and verify the approved binaries there before launch day. Do not bypass a missing-tool guard with an unguarded broadcast.

**Pass condition:** all public values are independently reviewed, the signer addresses match their custody records, Safe infrastructure has verified code on the target chain, and gas funding meets the simulated requirement plus the wrappers' 2× buffer.

## 5. Deploy and verify the Safe

**Responsible: deployment operator; reviewed by Safe signers.** Commands below run from `omerta-contracts`.

```powershell
# Read-only preflight/simulation.
powershell.exe -NoProfile -File .\script\Deploy-MainnetSafe.ps1 -RpcUrl $env:CHAIN_RPC_URL

# Separate execution step, after reviewing the exact simulation.
powershell.exe -NoProfile -File .\script\Deploy-MainnetSafe.ps1 -RpcUrl $env:CHAIN_RPC_URL -Broadcast
```

The second command broadcasts and requires the wrapper's explicit interactive confirmation. If reusing an existing approved Safe, verify it instead of creating a second treasury.

Verify `VERSION() == 1.4.1`, all three owners, threshold 2, expected nonce, code and deployment receipt. Record the address in `.env.mainnet` as `SAFE`; reread the deployer's live nonce and update `EXPECTED_DEPLOYER_NONCE`. Do not assume that a Safe interface/service supports the chain merely because the contract deployed.

**Pass condition:** independent owner/threshold verification and a recorded Safe address that the signing team can operate.

## 6. Deploy the ten core contracts, then leave controls off

**Responsible: deployment operator.** Use the same configuration and account for simulation and execution:

```powershell
powershell.exe -NoProfile -File .\script\Deploy-MainnetCore.ps1 -RpcUrl $env:CHAIN_RPC_URL

# Broadcast only after the preceding trace and predicted addresses are approved.
powershell.exe -NoProfile -File .\script\Deploy-MainnetCore.ps1 -RpcUrl $env:CHAIN_RPC_URL -Broadcast
```

The wrapper requires `DEPLOY MAINNET CORE 4663`, deploys ten contracts with `--slow`, verifies initial state and writes `deployments/4663/manifest.json`.

If execution stops partway, inspect the actual receipts, nonce and `broadcast/Deploy.s.sol/4663/run-latest.json`. Do not rerun blindly: it can create another suite. Preserve the successful deployments and prepare a reviewed continuation or replacement plan.

**Pass condition:** all ten addresses, transaction hashes, deployment blocks and constructor values are recorded. This milestone alone opens no public product flow.

## 7. Verify source, ownership, money paths and dormant state

**Responsible: independent reviewer.** Verify each source and constructor on [Robinhood Blockscout](https://robinhoodchain.blockscout.com), using the release's exact compiler settings. Compare deployed runtime with reproduced bytecode, resolving constructor immutables. Nonempty `cast code` alone is insufficient.

Require these reads and reconcile them to the manifest:

| Check | Required result immediately after core deployment |
| --- | --- |
| Every ownable core contract's `owner()` | Approved Safe |
| OMR founding supply | 100,000,000 OMR held by Safe before allocations |
| `OMR.minter()`, `GearVault.minter()`, `StockVault.keeper()` | Zero address |
| `OmertaBond.oracle()` | Zero address |
| GenesisOracle usable price/window | Closed |
| OMR sell tax | Zero |
| `OmertaFees.mintDevBps()` / `feeRecipient()` | `10000` / final DEV address |
| Caps, fee amounts, signer, metadata and bond splits | Exact approved constructor values |

Example reads, with verified addresses filled by the operator:

```powershell
$fees = '0xREPLACE_WITH_VERIFIED_FEES_ADDRESS'
$omr = '0xREPLACE_WITH_VERIFIED_OMR_ADDRESS'
cast call $fees 'mintDevBps()(uint256)' --rpc-url $env:CHAIN_RPC_URL
cast call $fees 'feeRecipient()(address)' --rpc-url $env:CHAIN_RPC_URL
cast call $omr 'owner()(address)' --rpc-url $env:CHAIN_RPC_URL
cast call $omr 'minter()(address)' --rpc-url $env:CHAIN_RPC_URL
```

Dormant does not mean every function is paused: OmertaFees accepts direct payments, and voucher-based contracts may act on valid signatures. Withhold unauthorized signing and monitor deployed payment contracts.

**Pass condition:** verified source/runtime and all manifest reads match. Archive/commit the deployment record through the release process; repin subsequent ceremony evidence to the resulting clean revision. Never bypass a source-commit mismatch.

## 8. Activate character checkout only if included in this release

**Responsible: application operator and Safe signers.** Use the amended fee deployment and reviewed NFT deployment. Configure API and worker consistently with mainnet `CHAIN_ID`, approved RPC, `OMERTA_FEES_ADDRESS`, `DYNASTY_NFT_ADDRESS`, deployment start block, finality/confirmation policy and matching signer. Keep unused rail addresses unset. Verify the on-chain NFT base URI reaches the service indexing this deployment, and metadata/images remain publicly readable through the invite gate.

Bind persistent database state to this chain and contract set before indexing. Testnet and mainnet must use separate databases. Replacing a fee deployment requires fresh deployment-scoped indexing or a reviewed migration, not just an address change. A new start block does not reset existing cursors.

Run a controlled end-to-end mainnet canary after approval: link wallet → pay the displayed fee → wait for indexed confirmation → consume one character credit → request the eligible NFT voucher → submit `claim` → confirm ownership and metadata. Retain receipts; exercise refresh/rejection recovery and ensure payment and claim crediting occur once. Confirm 100% of the mint payment reaches DEV, with no mint allocation booked to Vig/treasury/community.

`npm run character:preflight` is hardwired to the historical **testnet** manifest. It is not a mainnet readiness check and is expected to reject the old mint policy. Five watcher confirmations are a historical default, not an approved mainnet finality policy.

**Pass condition:** the selected production flow and persistent indexing/recovery work on the exact deployment, and the open findings in Step 2 are closed. OMR trading and bonds can remain dormant.

## 9. Prepare the automated token-launch dependencies

**Responsible: contract operator and Safe signers.** Follow the mandatory automated sequence in [GENESIS-LAUNCH.md](GENESIS-LAUNCH.md) and [LIQUIDITY-AUTOMATION.md](LIQUIDITY-AUTOMATION.md).

1. Set both API and worker to the appropriate preparation posture; close new Desk lots/bond quotes, drain existing commitments for at least their actual TTL, and keep direct bonding paused with `OMR.minter()` unset.
2. Verify the six pinned external runtime hashes and immutable relationships in the genesis runbook. Do not substitute testnet addresses or treat an explorer label as verification.
3. Deploy the final hook with the exact LBP strategy, then the final bootstrap-capable v4 oracle while the canonical pool is unopened. Verify hook permission bits `0x30cc`, authorized strategy, zero taxes, oracle pool identity, `consult() == (0,0)` and `baselineInitialized == false`. Have the Safe set and read back the hook observer before launch.
4. Reserve one deployer nonce interval for the liquidity CREATE sequence. Include every earlier transaction, including hook factory calls, oracle and splitter creation; reverted transactions consume nonces too. Derive the future Vig executor at bundle `startingNonce + 1`.
5. Deploy the immutable splitter with that predicted Vig executor as `VIG_RECIPIENT`, and the reviewed treasury/founder recipients. Verify all bindings while the pool is unopened.
6. Generate/review the liquidity plan, verify startup state immediately before its first CREATE, then execute its ordered creations: POL vault, four buyback executors, fee router, gas vault and genesis controller. Verify each receipt, runtime and constructor before advancing. A changed nonce requires a new reviewed plan; do not shift addresses under an already-deployed immutable splitter.
7. Simulate and execute the emitted **atomic Safe configuration batch**. For this prelaunch stage set `policies.bond.unpauseAfterConfiguration=false`; review every emitted call and keep new issuance closed. The plan wires the bond oracle/health guard, replaces Safe POL custody with the vault, configures fixed recipients/keepers, and preserves 100% DEV character mint fees. It does not itself fund contracts or appoint the OMR minter.

The direct Foundry scripts do not automatically load `.env.mainnet`. In a fresh shell in `omerta-contracts`, explicitly load its reviewed public values using the repository helper, after updating the deployed OMR/hook addresses:

```powershell
. .\script\Deploy-Mainnet.Utilities.ps1
$launchConfig = Read-DeployConfig (Join-Path (Get-Location) '.env.mainnet')
Import-DeployEnvironment $launchConfig @($launchConfig.Keys)

# Run these individually in dependency order; these commands only simulate.
forge script script/DeployHook.s.sol:DeployHook --rpc-url $env:CHAIN_RPC_URL --sender $env:DEPLOYER --account omerta-mainnet-deployer --always-use-create-2-factory -vvvv
# Update/reload OMERTA_HOOK_ADDRESS after its separately approved broadcast.
forge script script/DeployV4TwapOracle.s.sol:DeployV4TwapOracle --rpc-url $env:CHAIN_RPC_URL --sender $env:DEPLOYER --account omerta-mainnet-deployer -vvvv
# Only after the complete nonce/recipient plan is approved:
forge script script/DeployGenesisSplitter.s.sol:DeployGenesisSplitter --rpc-url $env:CHAIN_RPC_URL --sender $env:DEPLOYER --account omerta-mainnet-deployer -vvvv
```

For each direct script, review the exact trace, then execute the same command with `--broadcast`; verify before proceeding. Core/Safe retain their guarded wrappers. Never run the three simulations as though prerequisite addresses already exist.

From the repository root, the offline plan commands are:

```powershell
node tools/liquidity-deployment-plan.js --template
node tools/liquidity-deployment-plan.js --plan C:\secure-launch-evidence\liquidity-input.json C:\secure-launch-evidence\liquidity-plan.json
```

Fill every required identity/budget from reviewed values; set `genesis.enabled=true` and `bank.enabled=false`. The planner **does not broadcast**. Its exported `verifyLiquidityDeploymentStartup(client, plan, { expectedPlanSha256 })` is a read-only API, not a CLI switch. Integrate it into the reviewed execution procedure and retain its `startup_verified` evidence before signing the first CREATE. The hash must come from the independently approved plan. Exclusive nonce control and sequential receipt checks remain necessary after this read.

**Pass condition:** verified unopened dependency chain, approved exact CREATE plan and its execution receipts, controller/vault/keeper bindings, stopped bond issuance, and no unresolved routing requirement. If no reviewed executor invokes the startup verifier and follows the nonce plan, that execution preparation is still unfinished.

## 10. Configure funding, automation and the auction package

**Responsible: treasury, application operator and independent reviewer.** Approve and reconcile the genesis allocation of **6,063,750 OMR**: **4,410,000** for auction and **1,653,750** reserved for LP. Keep service gas, reward pools and other tranches separately accounted for.

Create the public keeper manifest from `tools/liquidity-manifest-example.js`, approve limits and pin its SHA-256. Stage matching chain/manifest configuration for API and worker, including manifest path/hash and persistent database. First run `npm run liquidity:plan` in a keyless operator environment and review all holds and encoded actions. After approval, deliberately start/redeploy the keeper worker with `LIQUIDITY_AUTOMATION_ENABLED=on` and its dedicated `LIQUIDITY_KEEPER_PK`; these settings enable execution on a running worker, with no additional execution switch. Keep the key off the API, apply the matching automatic lifecycle configuration there, and remove the legacy `DEX_BOT_PK`. Configure and start the separate oracle worker through its own approved activation using `OMR_V4_ORACLE_ADDRESS` and `V4_ORACLE_KEEPER_PK`. Prefund only approved operating amounts.

Use `launchMode: "automated"` in genesis input; bind the real controller, POL vault, final oracle, keeper and all six exact local runtime hashes. Use the current [genesis input schema](GENESIS-LAUNCH.md#gate-d--build-unsigned-safe-calls). The auction has **no wallet bid cap**, zero validation hook, no aggregate raise ceiling, and a default **10 ETH graduation minimum**. The sale floor is represented by the builder from 205,882 OMR/ETH with its documented Q96/tick rounding. Approve the generated bytes, not a hand-rounded price.

Immediately before choosing `startBlock`, from repository root:

```powershell
npm run genesis:inventory
npm run genesis:cadence -- --duration-seconds 180 --interval-seconds 30 --rpc-class private
npm run genesis:config -- C:\secure-launch-evidence\genesis-input.json
```

Retain cadence output and independently derive **168 hours of auction** plus a **24-hour claim cliff** using the chain's BlockNumberish clock. The final release gate accepts cadence evidence for at most one hour. Provide enough pre-start time for launch execution, receipt verification and the subsequent controller binding. Do not use historical 100 ms/block constants or the stale 72-hour example. `--rpc-class` accepts `public`, `private` or `archive`; select the class of the endpoint actually used.

**Pass condition:** exact reviewed schedule, budgets, recipients, custody, runtime hashes and calldata digest, with sufficient ceremony time remaining.

## 11. Approve and create the CCA; bind it before bidding

**Responsible: Safe signers and two independent reviewers.** Execute only the reviewed preparation calls: approve exactly 6,063,750 OMR to Permit2, approve exactly that amount to the pinned launcher with the chosen expiration, and allow native ETH as the hook quote. Then run the post-preparation live preflight:

```powershell
npm run genesis:preflight -- C:\secure-launch-evidence\genesis-input.json
npm run genesis:release -- C:\secure-launch-evidence\genesis-release-review.json
```

Build the review JSON using [GENESIS-RELEASE-MANIFEST.md](GENESIS-RELEASE-MANIFEST.md)'s evidence schema, corrected to the current seven-day schedule and automated vault custody. Include source/audit evidence, runtime hashes, cadence, exact-stack fork evidence, live preflight, Safe simulation/approvals and two independent decodes bound to `calldataDigests.launchKeccak256`. Both reviewers compare and sign the resulting `manifestSha256` **before the launch transaction executes**. These tools generate/check artifacts; they never sign or send the Safe transaction.

Execute `safeTransactions.launch` through the Safe. Its launcher `depositToken` and `distributeToken` must remain atomic: never deposit into the public launcher in a standalone transaction. Verify the receipt, `InitializerCreated`, `TokenDistributed`, `TokensReceived`, derived auction address and all on-chain auction parameters.

Only after actual creation, generate the separate binding:

```powershell
npm run genesis:config -- C:\secure-launch-evidence\genesis-input.json --bind-auction
```

Decode, approve and execute the returned Safe transaction. Read back `controller.auction()` and retain its confirmed receipt **before `startBlock`**. An unsigned payload, successful simulation, or `pending_creation` manifest does not satisfy this step. Missing the deadline requires a stop and a new governance decision; it is not fixed by changing a local timestamp.

**Pass condition:** one correctly created CCA, confirmed controller binding before start, and evidence tying both transactions to the reviewed launch. Publish the verified chain, auction address, bid interface, timing and claim terms.

## 12. Operate the auction, then prove migration succeeded

**Responsible: keeper operator and incident lead.** Monitor canonical auction checkpoints, clearing price, gross raise, exits, RPC/indexer health and clock drift. Keep bonds, Desk issuance and both tax layers closed. Automated lifecycle phase comes from durable keeper observations; stale/missing observations must hold issuance closed. Manual `GENESIS_LAUNCH_PHASE` edits do not substitute for controller state.

At the end, verify the final checkpoint, graduation, sold amount and protocol fee. Let the typed keeper/controller execute the reviewed migration at or after `migrationBlock`. `LBPStrategy.migrate` is one-shot and can catch internal failures: a successful outer receipt is insufficient.

Require the `Migrated` event, no failure/recovery branch, an initialized **native ETH/OMR, fee 3000, tick spacing 60, exact hook** pool, and the actual full-range position NFT owned/adopted by the POL vault. Reconcile LP, residual and unsold-token movements. The controller is the CCA unsold-token recipient; do not attempt its actions by impersonating treasury.

Allocation is 37.5% of net proceeds to LP; residual is 40% treasury / 36% Vig / 24% founder. With no protocol fee or dust, that is 37.5% / 25% / 22.5% / 15% of the gross raise. Read the protocol fee live and reconcile rounding; a changed fee requires renewed economic acceptance.

**Pass condition:** migration proven from events, custody and balances. If graduation/migration fails, remain failed, reconcile refunds and recoveries through the reviewed branch, and do not reuse the initializer. See Step 15.

## 13. Warm the oracle and activate bonds last

**Responsible: oracle operator, treasury and Safe signers.** The already-deployed oracle must seed its first real initialized observation, then accumulate a complete `PERIOD`. Pre-pool waiting time does not count. The current example period is 1,800 seconds; confirm the approved value. Also satisfy the vault's separate foundation warmup and custody/health checks.

Verify fresh `consult()`, timestamp and independently reconstructed historical tick pricing. Confirm keeper updates, funding and alerting; stale/zero observations must block issuance. The interval must respect the oracle's bounded window; an overlong interval requires a new honest window. A pool spot price is not an activation signal.

Reconfirm bond signer, recipient splits, lifetime backend signing allocation, outstanding quote reservations, independent maximum rate, oracle tolerance/age and liquidity health guard. Choose the explicit daily policy: finite cap with matching automation budget, or separately approved `dailyCapOMR=0` with manifest `bondDailyIssuance: "unlimited"`. Unlimited daily issuance does not remove rate, liquidity, pause or lifetime signing-budget controls.

Simulate the final Safe activation batch; verify all guard settings, unpause only when ready, and **set `OMR.minter=OmertaBond` last** for this staged procedure. Require healthy durable lifecycle observations before reopening backend offers. Execute one low-value bond settlement and reconcile issuance, vesting and all recipients. Keep taxes zero through that canary; later tax changes require their own decision and routing/disclosure review.

Claims open at the CCA's `claimBlock` as a cliff; verify claim availability separately from bond readiness. An issuance hold should not become an accidental block on already-earned claims.

**Pass condition:** healthy foundation, usable maintained TWAP, correct guards, working claim flow and one reconciled bond canary.

## 14. Open any remaining approved core rails individually

**Responsible: treasury and application operator.** Use the Safe ceremony in [DEPLOYMENT.md](DEPLOYMENT.md); do not turn on every backend address at once.

- **Gear/withdrawals:** generate the full gear table; set/read every `GearVault.setGearCap`; set the voucher contract as gear minter only afterward. Fund only the approved OMR withdrawal tranche and reconcile backend liabilities. Confirm cap, signer and replay/deadline behavior before a canary claim.
- **Staking:** approve the reviewed amount and call `fundRewards`; check reward backing and a deposit/withdrawal canary before advertising availability.
- **Deeds/NFTs:** verify signer/domain, caps, metadata and confirmed mint/transfer/indexing behavior for each activated deployment.
- **Stock delivery:** leave off until the exact asset, custody, allocation authorization, inventory and per-token limits are reviewed; arm the keeper last. A core StockVault address alone does not approve RWA delivery.
- **THE BANK:** defer until its separate concrete asset/ERC-4626, loan, reserve, role and cap review passes. The first mainnet wrapper intentionally rejects Bank configuration.

**Pass condition:** each advertised rail has its own configured limits, funding reconciliation, confirmed canary and operator sign-off.

## 15. Hand over monitoring and practice the stop procedure

**Responsible: incident lead and Safe signers.** Assign coverage for the auction, migration, first claims and initial live operation. Record quantitative alert thresholds and escalation contacts for RPC/indexer lag, finality/reorg divergence, oracle age, keeper gas, failed/pending transactions, cap consumption, custody, signer activity and treasury liabilities.

| Incident | Containment and recovery |
| --- | --- |
| Wrong chain/address/runtime/recipient or nonce drift | Stop before further signing; retain evidence and regenerate the affected reviewed plan |
| Partial deployment | Inspect receipts/nonce; no blind rerun or shifted immutable predictions |
| Bad or stale oracle / unsafe issuance | Disable new backend quotes; pause bond and revoke OMR minter as needed through authorized controls; reconcile existing obligations |
| Failed auction/migration | Keep failed posture; verify outcome, bidder refund/claim rules and custody; use reviewed controller/splitter recovery, including `recoverFailedLaunch` only for the verified failed branch |
| Keeper transaction uncertainty | Inspect `npm run liquidity:status`; reconcile canonical receipt/journal before authorizing another operation; never delete pending rows to force progress |
| Character incident | Stop new checkout/voucher issuance and pause NFT mints as appropriate; keep indexing payments already sent. OmertaFees has no pause, and pausing DynastyNFT mints does not stop transfers |
| Custody emergency | Use the reviewed guardian/Safe stop and recovery path; vault principal recovery goes only to its immutable Safe recipient and invalidates foundation health |
| Signer compromise | Stop issuance and pause every affected active rail; rotate all contracts/services using that signer, accounting for pending vouchers and quotes |

Contract deployments are not rolled back by redeploying the website. Recovery may require pausing, revoking permissions, reconciling balances or a separately reviewed replacement deployment. Preserve evidence and communicate the actual state.

**Final release record:** clean source revision, scoped review hash, dependency/artifact/runtime hashes, configuration and Safe approvals, all addresses/receipts/blocks, executed tests/rehearsals, genesis/binding/migration evidence, oracle and canary evidence, backend deployment/database identity, monitors and incident owners. The launch owner signs off on the specific milestones actually opened.
