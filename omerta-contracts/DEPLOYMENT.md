# OMERTA smart-contract deployment plan

The Uniswap CCA/LBP genesis launch has its own fail-closed ceremony and replaces the original
concurrent bootstrap-bond concept. Read and sign off [GENESIS-LAUNCH.md](./GENESIS-LAUNCH.md) before
deploying the launch hook, proceeds splitter, or launcher calldata. The older sections below still
describe the core suite and post-launch bond/oracle rail; where they conflict on genesis sale order,
`GENESIS-LAUNCH.md` controls.

This runbook deploys every contract that should have a top-level address while keeping every privileged
path off until the Safe completes a separate, reviewable ceremony.

> **Mainnet gate:** do not broadcast a mainnet transaction until the third-party contract/signer audit,
> Safe signer ceremony, chain/legal launch review, and the launch checklist are all signed off. Production
> is intentionally chain-dormant until those gates clear.

> **First mainnet cut — founder direction, 2026-08-24:** Phase 0 governance and the ten Phase 1 core
> contracts may proceed once the reviewed core report hash and signer scope are recorded in
> `.env.mainnet`. Phase 2 THE BANK is deliberately excluded while its audit finishes and is reserved as
> a post-deployment catalyst roughly one to two weeks later. Phase 3 still depends on a real pool; Phase 4
> still follows the separate Uniswap routing-review sequence. Deploying Phase 1 does not arm any rail.

## What actually gets deployed

| Phase | Script | Contracts |
|---|---|---|
| 0 — governance prerequisite | `script/DeploySafe.s.sol` | Fresh Safe v1.4.1 proxy (external governance infrastructure; not part of the OMERTA Solidity inventory) |
| 1 — pre-pool core | `script/Deploy.s.sol` | OMR, GearVault, VoucherClaim, OMRStaking, OmertaFees, StreetDeed, DynastyNFT, StockVault, GenesisOracle, OmertaBond |
| 2 — Bank | `script/DeployBank.s.sol` | Denari, Transmuter, Alchemist |
| 3 — post-pool oracle | `script/DeployTwapOracle.s.sol` | OmrTwapOracle |
| 4 — v4 hook | `script/DeployHook.s.sol` | OmertaHook at a mined CREATE2 address |
| Additive legacy RWA machine | `script/DeployRwaStockMachine.s.sol` | StockTokenRegistry and RwaStockBuyer; both born with automation/venue authority off |
| 5 — post-genesis v4 oracle | `script/DeployV4TwapOracle.s.sol` | ownerless OmrV4TwapOracle |

Six other top-level source files do not get a deployment transaction from the current release scripts:

- `CollateralEscrow` is created by `Alchemist` when each user first deposits.
- `FlashGuard` is abstract and is inherited by the Bank contracts.
- `IOmrOracle` is an interface.
- `StockTokenRegistryV2` is implemented, independently approved and dormant; its production publisher
  remains blocked on the finalized consumer, health overlay, and AcquisitionVault budget bridge.
- `SettlementGasPool` is a reviewed standalone dependency, but no gameplay-vault integration or deploy
  script is authorized by this runbook yet.
- `AcquisitionVault` contains only the independently approved O1 authority base. A1 accounting and all
  later custody/outflow integration remain pending, so it must not be deployed.

That accounts for all 23 top-level `src/*.sol` files: 22 contract-bearing files plus the top-level
`IOmrOracle` interface. Three additional dedicated interface files live under `src/interfaces/` and
also receive no deployment transaction. Freeze the exact release phase and refresh the third-party
audit packet before any mainnet broadcast; source inventory alone is not release scope approval.

## 1. Freeze and prove the source

From the repository root:

```powershell
git status --short
git rev-parse HEAD
node tools/validate-fee-splits.js
npm run gearcaps -- --json
```

Save the commit hash, fee-split output, and generated gear-cap table with the deployment record. Then use
a native Foundry installation to run the full contract suite:

```powershell
Set-Location omerta-contracts
forge --version
forge clean
forge test -vv
# FuzzTester is a synthetic all-handler Medusa/Echidna target, never a deployment.
forge build --sizes --skip FuzzTester
```

The hook tests compile a real Uniswap v4 `PoolManager`; use native solc 0.8.26. Do not use a successful
no-hook/shim build as the mainnet gate.

## 2. Prepare keys and configuration

1. Deploy and test the treasury Safe on the target chain. Record its owners and threshold.
2. Create the voucher signer in HSM/KMS. Put only its public address in `SIGNER`; never expose
   `VOUCHER_SIGNER_PK` to the deployer machine.
3. Import the deployer into Foundry's encrypted keystore or use a hardware wallet. Do not put a private
   key in `.env` or a command line.
4. Copy `.env.deploy.example` to `.env` and replace every required zero. `.env` is gitignored.
5. Set the RPC in the shell, then prove it is the intended chain:

```powershell
Copy-Item .env.deploy.example .env
$env:CHAIN_RPC_URL = "https://REPLACE_WITH_TARGET_RPC"
$safe = "0xREPLACE_WITH_SAFE_ADDRESS"
cast chain-id --rpc-url $env:CHAIN_RPC_URL
cast code $safe --rpc-url $env:CHAIN_RPC_URL
```

`EXPECTED_CHAIN_ID` is mandatory in every script. Robinhood Chain is documented as 46630 for testnet and
4663 for mainnet, but trust the signed network deployment record and the RPC response, not a copied number.

For mainnet, use the separate fail-closed profile rather than changing the testnet `.env`:

```powershell
Copy-Item .env.mainnet.example .env.mainnet
```

Fill every release placeholder, including the exact clean release commit, the deployer's current mainnet
nonce, the core audit-report SHA-256, and `CORE_SIGNER_AUDIT_INCLUDED=true`. The mainnet wrappers reject a
dirty worktree, a commit mismatch, a missing audit record, placeholder metadata, a wrong chain, and any
nonzero Bank address. `.env.mainnet` is gitignored and must contain public configuration only.

Before Phase 1, make the following explicit decisions:

- `DAILY_CAP_OMR`, deed/dynasty daily mint caps, and `STOCK_DEFAULT_DAILY_CAP` must be nonzero. Zero means
  unlimited in those contracts, so the script rejects it.
- Run `npm --prefix .. run dials` against the actual planned POL depth to derive `BOND_DAILY_CAP_OMR` and
  `BOND_MAX_OMR_PER_ETH`; both must be nonzero.
- The script cross-checks the immutable Path A bond split, including the Vig remainder, against the four
  `BOND_*_BPS` values.
- Use `GENESIS_PRICE_OMR_PER_ETH=0` and `GENESIS_VALID_UNTIL=0` to deploy the genesis feed closed. To open
  a real genesis window, set both an 18-decimal OMR-per-ETH rate and a future Unix close timestamp.

### Phase 0 — deploy a fresh Safe when one does not already exist

Set `SAFE_OWNERS` to a comma-delimited list of public owner addresses, choose a threshold, and record a
nonzero `SAFE_SALT_NONCE`. On Robinhood testnet, the configured Safe v1.4.1 L2 singleton, proxy factory,
and compatibility fallback handler must all have bytecode before proceeding.

For a production-like 2-of-3 testnet rehearsal without existing wallets, create three Safe owners and a
separate voucher signer through hidden local password prompts:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\New-TestnetWallets.ps1
```

The helper writes only encrypted JSON keystores under the gitignored `keystores-testnet/` directory and
prints their public addresses. It never writes the password. Back up that directory before funding any
address. Owner 1 is also the testnet broadcaster; owners 2 and 3 supply the second Safe approval. Keep the
fourth wallet isolated as the EIP-712 signer.

```powershell
$deployerKeystore = ".\keystores-testnet\omerta-deployer-owner-1"
forge script script/DeploySafe.s.sol:DeploySafe --rpc-url $env:CHAIN_RPC_URL --sender $deployer --keystore $deployerKeystore -vvvv
forge script script/DeploySafe.s.sol:DeploySafe --rpc-url $env:CHAIN_RPC_URL --sender $deployer --keystore $deployerKeystore --broadcast -vvvv
```

After broadcast, verify `VERSION() == "1.4.1"`, the complete owner list, threshold, and initial nonce on
the explorer and through `cast call`. Put the emitted proxy address in `SAFE`; do not send treasury funds
to it until those reads match. Safe transaction-service/UI support is independent of the contracts being
deployed: if Robinhood testnet is not listed by the hosted UI, interact through reviewed Safe calldata or
a self-hosted interface rather than treating the proxy as an EOA.

The Robinhood public testnet RPC may not retain enough recent state for Foundry's multi-request fork
simulation while its head advances. The guarded testnet helper executes the same single canonical factory
call atomically, verifies the resulting owners/version/threshold, and refuses an unfunded or wrong-chain
broadcast:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetSafe.ps1
```

For mainnet, the guarded wrapper defaults to preflight-only. It validates the frozen source, audit record,
canonical Safe v1.4.1 infrastructure, 2-of-3 owner set, counterfactual address, exact deployer nonce, and a
2x gas buffer. A broadcast requires both `-Broadcast` and the exact interactive confirmation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-MainnetSafe.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-MainnetSafe.ps1 -Broadcast
```

After Phase 0, put the emitted `SAFE` in `.env.mainnet` and increment `EXPECTED_DEPLOYER_NONCE` to the
live nonce before running Phase 1. Do not reuse the testnet keystores; the wrapper asks Foundry for the
encrypted account named by `-Account` (default `omerta-mainnet-deployer`).

## 3. Phase 1 — deploy the pre-pool core

For the first mainnet cut, use the guarded mainnet wrapper. The default invocation only simulates. It
requires the closed `0/0` genesis window, the pinned IPFS gear base, the reviewed first-cut constructor
profile, the verified Safe, exact nonce, empty predicted addresses, and a 2x gas buffer. It also requires
`BANK_ASSET` and `BANK_ERC4626_VAULT` to remain zero, so this path cannot accidentally deploy or arm THE
BANK:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-MainnetCore.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-MainnetCore.ps1 -Broadcast
```

The broadcast requires the exact confirmation `DEPLOY MAINNET CORE 4663`, sends ten creations with
`--slow`, verifies ownership, constructor caps and recipients, and confirms that the OMR minter, gear
minter, stock keeper, bond oracle, sell tax, and genesis window remain off. It then writes
`deployments/4663/manifest.json`. Explorer source verification and review/commit of that manifest are the
next gate; do not arm a contract merely because RPC verification passed.

For the current Robinhood Chain Testnet rehearsal, use the guarded Windows helper. It pins the conservative
profile selected for this rehearsal, verifies the deployed 2-of-3 Safe, requires broadcaster nonce 1,
re-simulates all ten creations, rejects occupied predicted addresses, checks a 2x gas buffer, and sends
nothing when `-PreflightOnly` is present:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetCore.ps1 -PreflightOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetCore.ps1
```

The broadcast path requires the exact confirmation `DEPLOY CORE`, then lets Foundry request the encrypted
testnet keystore password directly. The helper uses `--slow`, verifies all ten owners and dormant controls
after confirmation, and prints a contract/address/transaction table for the manifest. If the broadcaster
nonce is no longer 1, stop and inspect the existing broadcast record instead of overriding the guard.

Use the same sender and config for the simulation and broadcast. Replace the sender with the public address
of your Foundry account:

```powershell
$deployer = "0xREPLACE_WITH_DEPLOYER_ADDRESS"
forge script script/Deploy.s.sol:Deploy --rpc-url $env:CHAIN_RPC_URL --sender $deployer --account omerta-deployer -vvvv
forge script script/Deploy.s.sol:Deploy --rpc-url $env:CHAIN_RPC_URL --sender $deployer --account omerta-deployer --broadcast -vvvv
```

Do not rerun after a partial broadcast without inspecting `broadcast/Deploy.s.sol/<chainId>/run-latest.json`.
Foundry records transaction receipts there; a blind rerun creates a second suite.

Copy the ten emitted addresses into a signed deployment manifest. At minimum record: chain ID, source
commit, solc and Forge versions, deployer, Safe, signer address, constructor values, transaction hashes,
addresses, and deployment blocks.

## 4. Verify Phase 1 before arming anything

For every emitted address:

1. `cast code <address>` must be non-empty.
2. Verify source with the target chain's supported explorer and the exact compiler settings from
   `foundry.toml` (solc 0.8.26, optimizer 800, Cancun EVM).
3. Confirm `owner()` equals `SAFE` on every ownable contract.
4. Read and compare every immutable/configured constructor value to the signed manifest.
5. Confirm the intentionally dormant state:

   - `OMR.minter() == address(0)`
   - `GearVault.minter() == address(0)`
   - `OmertaBond.oracle() == address(0)`
   - `StockVault.keeper() == address(0)`
   - OMR and hook sell taxes are zero

Useful read shape:

```powershell
$omr = "0xREPLACE_WITH_OMR_ADDRESS"
$bond = "0xREPLACE_WITH_BOND_ADDRESS"
$fees = "0xREPLACE_WITH_FEES_ADDRESS"
cast call $omr "owner()(address)" --rpc-url $env:CHAIN_RPC_URL
cast call $omr "minter()(address)" --rpc-url $env:CHAIN_RPC_URL
cast call $bond "dailyCapOMR()(uint256)" --rpc-url $env:CHAIN_RPC_URL
cast call $bond "maxOmrPerEth()(uint256)" --rpc-url $env:CHAIN_RPC_URL
cast call $fees "vigBps()(uint256)" --rpc-url $env:CHAIN_RPC_URL
```

Do not continue if any address, owner, split, cap, recipient, bytecode hash, or chain ID differs.

## 5. Build and simulate the Safe ceremony

Create a Safe transaction batch, simulate the whole batch, have a second operator compare the decoded calls
to this list, and only then collect signatures. Ordering is part of the security boundary.

### Bridge, gear, staking, fees, and stocks

1. Generate the complete gear table with `npm --prefix .. run gearcaps -- --json`.
2. For every gear ID, call `GearVault.setGearCap(id, cap)`. Read every cap back.
3. Call `GearVault.setMinter(VoucherClaim)` only after all caps exist.
4. Transfer the approved OMR withdrawal tranche from the Safe to `VoucherClaim`.
5. Fund staking with `OMR.approve(OMRStaking, amount)` followed by `OMRStaking.fundRewards(amount)`.
6. Set every live Store SKU price on `OmertaFees`; leave unlaunched SKUs at zero.
7. For `StockVault`, transfer only the intended stock inventory into the vault, set a per-token daily cap,
   read balances/caps back, and call `setKeeper` last. Never arm a keeper against an empty or uncapped vault.

### Bond activation

1. If the genesis window is open, call
   `OmertaBond.setOracle(GenesisOracle, priceToleranceBps, maxOracleAge)`.
2. Confirm `GenesisOracle.consult()` and `OmertaBond.priceCeiling()` return the signed launch values.
3. Confirm `dailyCapOMR` and `maxOmrPerEth` again.
4. Call `OMR.setMinter(OmertaBond)` **last**. This is the transaction that turns issuance on.

If the genesis oracle was deployed closed, leave `OMR.minter` unset. The emergency stop is
`OMR.setMinter(address(0))`; pausing the bond is a second containment layer.

Do not arm the ERC-20 sell tax yet. It requires a real canonical pool, correct recipient exemptions, and the
one-venue/one-layer decision described in `CHAIN-DEPLOY.md`.

## 6. Phase 2 — deploy and arm THE BANK

**First-cut status (2026-08-24): deferred.** Do not run `DeployBank.s.sol` on mainnet until the Bank/loan
audit is complete and the post-launch catalyst window is explicitly opened. The Phase 0/1 wrappers neither
read nor invoke this script.

Only do this when the selected underlying and ERC-4626 vault are audited, denomination-matched, deployed on
the target chain, and their addresses are in the signed manifest. The constructors verify
`vault.asset() == BANK_ASSET`.

For an explicitly non-production Robinhood testnet rehearsal, the repository also provides a chain-locked
fixed-supply 6-decimal asset and standard ERC-4626 vault. The combined helper deploys those two dependencies
followed by Denari, Transmuter, and Alchemist, but leaves every Bank role, funder, flow cap, reserve, and fee
recipient unconfigured:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetBank.ps1 -PreflightOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetBank.ps1
```

The test asset has a fixed 1,000,000 tbUSD supply minted to the Safe and no post-deployment mint function.
Neither it nor the test vault is a production Bank dependency. The broadcast requires `DEPLOY BANK` and
refuses any starting broadcaster nonce other than the recorded Phase 1 ending nonce.

```powershell
forge script script/DeployBank.s.sol:DeployBank --rpc-url $env:CHAIN_RPC_URL --sender $deployer --account omerta-deployer -vvvv
forge script script/DeployBank.s.sol:DeployBank --rpc-url $env:CHAIN_RPC_URL --sender $deployer --account omerta-deployer --broadcast -vvvv
```

Verify all three owners equal the Safe and confirm Denari's minter/burner are zero. Then simulate this Safe
sequence:

1. `Transmuter.setBufferFloorBps(reviewedFloor)` — at least the contract's 5% minimum.
2. `Transmuter.setRedeemCaps(perBlock, perDay)` — zero is unlimited; use reviewed nonzero values.
3. `Alchemist.setLtvBps(ltv)` and `setHarvestFee(fee, recipient)`, with `ltv + fee <= 10000`.
4. `Alchemist.setMintCaps(perBlock, perDay)` — zero is unlimited; use reviewed nonzero values.
5. `Transmuter.setFunder(Alchemist, true)` and `setFunder(Safe, true)`.
6. Safe approves `BANK_ASSET` to the Transmuter and calls `Transmuter.fund(seed)` **before any borrow**.
7. `Denari.setBurner(Transmuter)`.
8. `Denari.setMinter(Alchemist)` **last**.

An unseeded Bank refuses the first borrow atomically under the post-issuance buffer check. No unsafe DNR
survives, but the market remains unusable until it is seeded; do not treat role wiring alone as activation.

## 7. Create the V2-compatible pool and deploy the TWAP

The current `OmrTwapOracle` consumes a Uniswap V2-compatible cumulative-price pair. Confirm the factory,
router, and wrapped-native-token addresses from the target chain's official deployment record, probe their
bytecode, create the OMR/WETH pair, and add the signed initial liquidity. Set `V2_FACTORY`, `WETH_ADDRESS`,
and `OMR_V2_PAIR`. The oracle constructor independently requires both assets to use 18 decimals, requires
the pair tokens to be exactly OMR and that WETH, and requires `factory.getPair(OMR,WETH)` to return the
supplied pair; an arbitrary V2-shaped contract or an OMR pool against another quote asset cannot deploy.

For the Robinhood Chain Testnet rehearsal only, where no reviewed OMR/WETH V2 deployment is available,
use the guarded virtual-observation helper instead:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetTwap.ps1 -PreflightOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetTwap.ps1
```

The helper derives the finalized Safe, broadcaster, OMR, OmertaBond, and prior-phase status from
`deployments/46630/manifest.json`. It requires broadcaster nonce 17 and the case-sensitive confirmation
`DEPLOY TWAP`, then deploys:

- a fixed-supply `Virtual Test Wrapped Ether` token (`vtWETH`), with all 1,000 tokens assigned to the Safe;
- a non-trading observation pair with immutable virtual reserves of 500,000 OMR and 100 vtWETH; and
- a test-only factory attestation that recognizes only that exact OMR/vtWETH pair; and
- the production `OmrTwapOracle` implementation with the minimum 600-second period.

The virtual pair is not an AMM: it holds no assets and exposes no swap, mint, burn, sync, or reserve-mutation
surface. It exists only to exercise the oracle lifecycle at a fixed virtual price of 5,000 OMR/ETH. Never
wire this test feed into `OmertaBond`; the helper checks that the bond's `oracle` remains the zero address
before and after deployment. Replace both virtual dependencies with an independently reviewed, liquid,
canonical OMR/WETH market before any production activation.

After the virtual oracle has been deployed, wait at least 600 chain seconds and close its first window with
the idempotent guarded updater:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Update-TestnetTwap.ps1 -PreflightOnly
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Update-TestnetTwap.ps1
```

The broadcast path requires the case-sensitive confirmation `UPDATE TWAP` and the encrypted testnet
keystore password. It simulates first, requires the broadcaster nonce and initial `(0,0)` reading, refuses
an early or overlong window, verifies the fixed 5,000 OMR/ETH result, and rechecks that `OmertaBond.oracle()`
is still zero. A safe rerun after success reports `TWAP_UPDATE_ALREADY_COMPLETE=true` and sends nothing.

```powershell
forge script script/DeployTwapOracle.s.sol:DeployTwapOracle --rpc-url $env:CHAIN_RPC_URL --sender $deployer --account omerta-deployer -vvvv
forge script script/DeployTwapOracle.s.sol:DeployTwapOracle --rpc-url $env:CHAIN_RPC_URL --sender $deployer --account omerta-deployer --broadcast -vvvv
```

Then:

1. Wait at least one full `TWAP_PERIOD_SECONDS` window.
2. Call permissionless `update()`.
3. Verify `consult()` returns a nonzero price and recent timestamp.
4. For a real reviewed pair only, simulate and execute `OmertaBond.setOracle(TwapOracle, tolerance, maxAge)` from the Safe.
5. Start the oracle keeper and alerting before the old genesis window is retired.
6. Verify `priceCeiling()` and a deliberately out-of-range quote rejection.

The keeper must update within `maxOracleAge`; a stale feed intentionally halts bonding.
For the virtual Robinhood testnet rehearsal, stop after verifying `consult()` and leave the bond disconnected.

## 8. Phase 4 — mine and deploy the v4 hook

Set `V4_POOL_MANAGER` to the official PoolManager for the target chain and verify its bytecode. The script
uses the canonical Foundry CREATE2 proxy at `0x4e59…956C`, mines the exact low-14-bit permission pattern,
and checks both the predicted and deployed addresses.

The hook constructor now binds an exact authorized LBP strategy. The historical Robinhood testnet
helper is deliberately retired: it pins the obsolete three-argument constructor, salt, and hook
address, and chain 46630 has no reviewed official LBP strategy matching the pinned mainnet stack.
Invoking it fails before simulation and sends nothing:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\script\Deploy-TestnetHook.ps1 -PreflightOnly
```

Use a chain-4663 fork for an exact-stack rehearsal. A new testnet release requires deploying and
reviewing the complete LiquidityLauncher/CCA/LBP stack first, setting `LBP_STRATEGY` to the resulting
testnet contract, mining a new hook salt/address, and freezing a replacement manifest-aware helper.
Never put the mainnet strategy address into a testnet configuration when it has no code on that chain.

```powershell
cast code 0x4e59b44847b379578588920cA78FbF26c0B4956C --rpc-url $env:CHAIN_RPC_URL
forge script script/DeployHook.s.sol:DeployHook --rpc-url $env:CHAIN_RPC_URL --sender $deployer --always-use-create-2-factory -vvvv
```

After deployment, verify `(uint160(hook) & 0x3fff) == 0x30cc`, `HOOK_FLAGS() == 0x30cc`, and
`authorized() == LBP_STRATEGY`. Follow `GENESIS-LAUNCH.md`: native ETH is allowed only in the reviewed
preparation batch, while recipients, observer, anti-snipe/surge policy, and sell tax remain dormant
unless their separate ceremonies explicitly arm them.

If anti-snipe is required, call `setAntiSnipe` before PoolManager initializes the pool: the duration is
snapshotted into that pool's immutable `openingEndsAt` deadline, and later global changes cannot extend it.
The hook now exposes `IOmrV4ObservationSource`: it integrates tick on every successful swap and brings
quiet time forward counterfactually, so keeper timing cannot erase the price path. `OmrV4TwapOracle`
samples that cumulative outside settlement. The backend keeper intentionally schedules `update()`
from the oracle's own baseline rather than depending on `ObservationRequested` delivery; that event is
an optional liveness hint, while a quiet pool still needs its completed window closed. The hook never
enters observer code from inside `afterSwap`.

After the CCA/LBP migration initializes the canonical pool, follow `GENESIS-LAUNCH.md`: deploy
`DeployV4TwapOracle.s.sol` in simulation first, verify the exact pool/source/period, set it as the hook
observer, accumulate a full bounded window, and cut `OmertaBond` over only after fork and audit sign-off.
The older `OmrTwapOracle` remains the V2-compatible path for deployments that intentionally retain a
separately reviewed V2 market; it is not the source for the native ETH/OMR genesis pool.

## 9. Activate backend addresses last

Keep API and worker chain-dormant while deploying and wiring. After all on-chain reads match, set the
relevant variables on both processes and redeploy them together:

| Deployment output | Backend variable |
|---|---|
| OMR | `OMR_ADDRESS` |
| GearVault | `GEARVAULT_ADDRESS` for the watcher and `GEAR_VAULT_ADDRESS` for the chain control panel |
| VoucherClaim | `VOUCHER_CLAIM_ADDRESS` |
| OMRStaking | `OMR_STAKING_ADDRESS` |
| OmertaFees | `OMERTA_FEES_ADDRESS` |
| OmertaBond | `OMERTA_BOND_ADDRESS` |
| GenesisOracle | `GENESIS_ORACLE_ADDRESS` while it is live |
| StreetDeed | `STREET_DEED_ADDRESS` |
| DynastyNFT | `DYNASTY_NFT_ADDRESS` |
| StockVault | `STOCK_VAULT_ADDRESS` |
| Denari | `DENARI_ADDRESS` |
| Transmuter | `TRANSMUTER_ADDRESS` |
| Alchemist | `ALCHEMIST_ADDRESS` plus `ALCHEMIST_ASSET` |
| OmertaHook | `OMERTA_HOOK_ADDRESS` only when the v4 market is activated |

Also set `CHAIN_RPC_URL`, the RPC-reported `CHAIN_ID`, and `VOUCHER_SIGNER_PK` only on the process that
signs. During the v4 warmup set `OMR_V4_ORACLE_ADDRESS` plus a dedicated low-balance
`V4_ORACLE_KEEPER_PK` on the worker; the key has no privileged role because `update()` is
permissionless. Optional `V4_ORACLE_CONFIRMATIONS`, `V4_ORACLE_TX_TIMEOUT_MS`, and
`V4_ORACLE_LEASE_MS` tune receipt depth/wait and failed-attempt cooldown. The worker simulates before
signing, stores the raw signed transaction before sending it, and records submitted/confirmed/reverted
state in `v4_oracle_keeper_attempts`; never share this key with another transaction workload. Apply
`deploy/fee-splits.env` in lockstep to API and worker. Run `npm --prefix .. run preflight`, confirm
chain parity/oracle health in the admin panel, and test one low-value transaction on each live rail
before raising caps.

## 10. Emergency posture

- Remove a rail's backend address to stop new off-chain signing/sending.
- `OMR.setMinter(address(0))` stops new bond issuance.
- Pause VoucherClaim, OmertaBond, StreetDeed/Dynasty minting, or StockVault as applicable; exits remain
  available according to each contract's design.
- Set the OMR/hook sell tax to zero instead of trying to pause a public market.
- Signer rotation is a four-contract ceremony: pause, rotate VoucherClaim + OmertaBond + StreetDeed +
  DynastyNFT, rotate the backend HSM/KMS key, then unpause after parity checks.

Never "fix" a bad immutable deployment by wiring around it. Leave it dormant, document it, and redeploy
from the frozen commit.
