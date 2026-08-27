# OMERTÀ genesis CCA/LBP launch runbook

Status: implementation, unsigned ceremony tooling, the canonical v4 bond oracle, and its durable
permissionless keeper/watchdog are present. The complete migration/oracle handoff passed a disposable
chain-4663 fork rehearsal on 2026-08-27. Production execution remains blocked on the launch-specific
audit, final recipient addresses, a reviewed LP-position custody choice, exact production block
timing, and the production Safe simulation/approval ceremony.

This runbook is the source of truth for replacing the original bootstrap bond sale with a Uniswap
Continuous Clearing Auction (CCA) that migrates into the canonical OMR/native-ETH Uniswap v4 pool.
`OmertaBond` remains the post-launch reserve-bond rail. It is not a concurrent genesis venue.

No script in the genesis tooling signs or broadcasts a transaction. Safe operators must decode,
simulate, and approve every call independently.

## 1. Committed architecture

| Component | Committed value |
|---|---:|
| Auction inventory | 4,410,000 OMR |
| Reserved LP inventory | 1,653,750 OMR |
| Total launcher deposit | 6,063,750 OMR |
| Graduation minimum | 10 native ETH by default |
| Sale floor | 205,882 OMR per ETH, represented in Q96 and rounded down to a 1% auction tick |
| Auction shape | 12 convex release steps carrying about 70% plus a one-block final release carrying about 30% |
| Auction duration target | 72 wall-clock hours, converted to `BlockNumberish` immediately before launch |
| Claim delay target | 24 wall-clock hours after auction end, as a claim cliff rather than linear vesting |
| v4 pool | native ETH / OMR, static 0.30% fee, tick spacing 60, `OmertaHook` |
| LP range | implicit full range |
| Raised currency assigned to LP | 37.5% of the post-protocol-fee amount |
| Remaining currency split | 40% treasury / 36% Vig / 24% founder |

The second split operates on the 62.5% residual. With no protocol fee and no rounding dust, the
whole-raise allocation is therefore 37.5% LP, 25% treasury, 22.5% Vig, and 15% founder.
`GenesisProceedsSplitter` assigns rounding dust to the founder leg.

The CCA factory can charge a protocol fee before the amount reaches the LBP. The pinned Robinhood
factory currently returns the zero address from `protocolFeeController()`, so its fee is zero, but
the read-only preflight still checks this live. If a reviewed future stack has a fee, the 10 ETH
graduation test is against gross CCA demand while LP and residual percentages apply to the net
post-fee currency. Reapprove the economics before using a nonzero-fee stack.

## 2. Pinned external stack

The configuration builder accepts only Robinhood Chain mainnet (`chainId 4663`) and pins:

| Contract | Version | Address | Runtime code hash |
|---|---|---|---|
| LiquidityLauncher | v3.2.0 | `0x0000FffFBE8efE702c8703aE3477FF5dE3d319C0` | `0x4a586d925c9d59ece13ce2239ebd7dea9ee725f9d33c6667e0fd16ae8d977d80` |
| LBPStrategy | v3.1.1 | `0x05d552391067389EE44fec3924157ed33F976000` | `0x6e822d6a2f634311363ec357109a691d86912414df5c211a2f6ac6de9a680d68` |
| CCA factory | v2.1.0 / BlockNumberish v1.1 | `0x000000001F26a0044BaA66024e7b6599c61963F8` | `0xa1d2a90564f4f63580b25de42efaff92505c254b00fc666f65ab38126cce5cfa` |
| Permit2 | canonical | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | `0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca` |
| PoolManager | canonical v4 | `0x8366a39CC670B4001A1121B8F6A443A643e40951` | `0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626` |
| PositionManager | canonical v4 | `0x58daec3116aae6D93017bAAea7749052E8a04fA7` | `0xc873e135dc9aaec88489cfbad146b4cb49d6a32e0d80326377784b7ba17670b2` |

The preflight also reads and compares these immutable relationships:

- `LiquidityLauncher.permit2()` equals canonical Permit2.
- `LBPStrategy.initializerFactory()` equals the pinned CCA factory.
- `LBPStrategy.poolManager()` and `positionManager()` equal the pinned v4 contracts.
- every runtime bytecode hash equals the reviewed value above.

An address appearing in an old README, an explorer label, or a copied Safe batch is not sufficient.
Any mismatch is a new release and requires a fresh source/audit review rather than an override.

Official references:

- <https://github.com/Uniswap/liquidity-launcher/tree/v3.2.0>
- <https://github.com/Uniswap/continuous-clearing-auction/tree/v2.1.0>
- <https://github.com/Uniswap/liquidity-launcher/blob/v3.2.0/docs/DeploymentGuide.md>

## 3. OMERTÀ launch contracts

### OmertaHook

The genesis hook has four constructor arguments: canonical v4 `PoolManager`, OMR, the governance
Safe, and the exact singleton `LBPStrategy` authorized to initialize the pool.

The hook advertises `IInitializerHook` through ERC-165 and enforces the same security property in
`beforeInitialize`: PoolManager initialization succeeds only when the callback `sender` is the
authorized LBP strategy. It then enforces the OMR/native-ETH pair allowlist. The hook address must
encode flags `0x30cc`, including `BEFORE_INITIALIZE`.

This repository implements the minimal `IInitializerHook` runtime surface directly instead of
inheriting Uniswap's `InitializerHook`, because the existing production hook does not inherit
v4-periphery `BaseHook`. The LBP strategy's actual ERC-165 validation and the authorization semantics
are covered by tests, but this deliberate integration boundary is a production audit item. Do not
waive it based only on local unit tests.

### GenesisProceedsSplitter

The splitter is ownerless and immutable. It binds to one exact pool ID and three exact recipients.
It treats PoolManager's nonzero `slot0.sqrtPriceX96` as the authoritative migration-success signal:

- after successful pool initialization, anyone can call `distributeResidual()`;
- before pool initialization, anyone can call `recoverFailedLaunch()`, which sends all recovered ETH
  to the treasury;
- anyone can call `recoverToken(OMR)` to send returned/unused OMR to the treasury.

Only the authorized LBP strategy can initialize this hooked pool, so a third party cannot flip the
splitter into its success branch by pre-initializing the pool. Forced ETH is handled by the same gate.

### LP position recipient

`positionRecipient` receives the v4 position NFT. It must be a reviewed Safe or an audited,
predeployed lock/fee-recipient contract compatible with the pinned PositionManager. Never use a
founder EOA or an address whose recovery/fee behavior has not been simulated. This address is an
unresolved operator choice and changing it changes the launch configuration bytes.

## 4. Backend isolation lifecycle

Set `GENESIS_LAUNCH_PHASE` in both API and worker deployments. Deploy them together and verify the
reported board state after every transition.

| Phase | New Desk lots | Existing Desk fills | New bond offers/quotes | Intended use |
|---|---|---|---|---|
| `legacy` | open | open | open | backward-compatible pre-ceremony state |
| `prepare` | closed | open | closed | drain existing short-lived Desk commitments |
| `auction` | closed | closed | closed | CCA is the only primary sale venue |
| `migration` | closed | closed | closed | finalize CCA and call one-shot LBP migration |
| `oracle_warmup` | closed | closed | closed | canonical-pool oracle accumulates a complete window |
| `live` | open | open | open | post-launch Desk and reserve bonds |
| `failed` | closed | closed | closed | recovery/relaunch decision; never auto-reopen |

Enter `prepare` at least as early as the longer of the Desk lot/fill commitment window and any bond
quote TTL. Independently verify that no live Desk fill can settle after auction start. The API gate
does not disable direct on-chain bonding: keep `OmertaBond` paused or keep `OMR.minter()` unset until
the `live` transition and a canonical oracle have passed their own ceremony.

`OmrV4TwapOracle` is the canonical v4-compatible bond feed. `OmertaHook` integrates active tick over
chain seconds on every successful swap and counterfactually through idle time; the separate ownerless
oracle closes bounded windows over that cumulative and preserves `IOmrOracle.consult()` for
`OmertaBond`. A missed keeper poke can make the feed stale but cannot erase intervening swaps or turn a
spot read into a TWAP. The implementation is built and tested, and the complete disposable chain-4663
fork rehearsal passed. `oracle_warmup -> live` remains a production gate until this hook/oracle pair
passes the external audit and the production deployment ceremony verifies the same invariants.
Do not point `OmertaBond` at `GenesisOracle` indefinitely and do not reopen it from PoolManager slot0.

## 5. Measure time in the chain's clock

The CCA uses BlockNumberish, not timestamps. An observation on 2026-08-27 was approximately 100 ms
per block, making 72 hours about 2,592,000 blocks and 24 hours about 864,000 blocks. Those are
examples, not permanent constants.

Immediately before choosing `startBlock`:

1. sample finalized `arbBlockNumber()` or the chain's BlockNumberish-equivalent value several times
   over at least a few minutes;
2. record sample blocks, timestamps, median cadence, RPC class, and finality lag;
3. convert the approved 72-hour auction and 24-hour claim cliff with that measured cadence;
4. leave enough lead blocks for Safe review without creating an unreasonably long public prebid;
5. have a second operator recompute every derived block independently.

The builder enforces:

- `endBlock = startBlock + prebidBlocks + auctionBlocks`;
- `migrationBlock = endBlock + 1`;
- `claimBlock = endBlock + claimDelayBlocks` and never before migration;
- `sum(mps * blockDelta) = 10,000,000`;
- block deltas exactly span the configured auction plus prebid range;
- the last block releases 20-40% of inventory;
- Q96 floor price is aligned downward to the auction tick.

## 6. Deployment and configuration ceremony

### Gate A — freeze and audit

- Freeze the exact OMERTÀ commit, compiler settings, Uniswap tags, external code hashes, and this
  runbook into the signed launch manifest.
- Complete the launch-specific audit, including the direct `IInitializerHook` implementation,
  hook tick accumulator, `OmrV4TwapOracle` window/conversion logic, splitter outcome gate, OMR transfer
  behavior, LBP failure branch, and the archived chain-4663 fork migration/oracle-warmup evidence.
- Decide and record all recipients, the launch-owner Safe, LP-position custody, and thresholds.
- Confirm 6,063,750 OMR is an approved treasury allocation and not counted by another reserve.
- Confirm OMR and hook sell taxes remain zero through migration, initial claims, and oracle bootstrap.

### Gate B — isolate legacy venues

1. Deploy `GENESIS_LAUNCH_PHASE=prepare` to API and worker.
2. Verify no new Desk lot or bond offer/quote can open.
3. Wait out existing commitments and prove boards are drained.
4. Pause/disable direct on-chain bonding and record the signed dormant posture.

### Gate C — deploy the hook and splitter

Populate reviewed environment values, including `LBP_STRATEGY`, then simulate without `--broadcast`:

```powershell
forge script script/DeployHook.s.sol:DeployHook --rpc-url $env:CHAIN_RPC_URL --sender $env:DEPLOYER --always-use-create-2-factory -vvvv
forge script script/DeployGenesisSplitter.s.sol:DeployGenesisSplitter --rpc-url $env:CHAIN_RPC_URL --sender $env:DEPLOYER -vvvv
```

The hook must be mined after the authorized strategy is final because it affects constructor bytecode
and CREATE2 output. Verify source, runtime, ownership, immutables, permission bits, zero taxes, empty
observer, initially disallowed quotes, and ERC-165 support for both `IInitializerHook` and
`IOmrV4ObservationSource` (`0xa4f7792a`). Verify every splitter immutable and confirm the pool is
uninitialized.

Robinhood testnet currently has no reviewed official launcher/LBP stack matching mainnet. The old
`Deploy-TestnetHook.ps1` is intentionally retired because it pins the obsolete three-argument hook.
Use a mainnet fork for exact-stack rehearsal. A testnet broadcast requires first deploying and
reviewing the complete launcher/CCA/LBP stack, then mining a new hook for that testnet strategy.

The repository's automated rehearsal runs the nine-step migration/oracle/fault/bond sequence against
a disposable local fork and writes hash-manifested evidence below `.audit/genesis-fork-rehearsal/`:

```powershell
npm run genesis:fork
```

It validates the six pinned runtime hashes before the first local mutation and refuses any non-4663
upstream or non-loopback mutation RPC. Anvil does not emulate Robinhood Chain's ArbSys precompile, so
the harness installs the test-only `ForkArbSysShim` runtime at address `0x64`; the evidence records
that runtime hash and the reason for the shim. The pinned launcher, CCA factory, LBP strategy,
Permit2, PoolManager, and PositionManager bytecode remains inherited unchanged from the recorded fork
block. This is necessary integration evidence, not a substitute for the launch-specific audit or a
production Safe simulation.

Verified rehearsal record (2026-08-27):

- evidence directory: `.audit/genesis-fork-rehearsal/2026-08-27T08-01-00-765Z/`;
- fork block: `47283811` (`0xfc7e53a22d05d18849378a3affac0b3f75290e5c5889d0b54d6a264b0f9eed71`);
- all eight files match `SHA256SUMS`, and `evidence.json` records zero production broadcasts, zero
  production keys read, and no persisted secrets;
- CCA graduation, LBP migration, canonical pool/NFT custody, oracle lifecycle and fault recovery,
  exact tick-to-price reconstruction, and a `0.001 ETH` fork-only bond all completed successfully.

### Gate D — build unsigned Safe calls

Prepare a private, access-controlled JSON input:

```json
{
  "token": "<OMR>",
  "launchOwner": "<SAFE_THAT_OWNS_THE_OMR>",
  "treasury": "<TREASURY_RECIPIENT>",
  "vigRecipient": "<VIG_RECIPIENT>",
  "founderRecipient": "<FOUNDER_RECIPIENT>",
  "proceedsSplitter": "<DEPLOYED_SPLITTER>",
  "positionRecipient": "<REVIEWED_LP_POSITION_RECIPIENT>",
  "hook": "<MINED_HOOK_WITH_0x30cc_PERMISSION_BITS>",
  "salt": "<UNIQUE_32_BYTE_SALT>",
  "startBlock": "<MEASURED_BLOCK>",
  "auctionBlocks": "<MEASURED_72H_BLOCK_COUNT>",
  "prebidBlocks": "0",
  "claimDelayBlocks": "<MEASURED_24H_BLOCK_COUNT>",
  "permit2Expiration": "<UNIX_SECONDS_AFTER_LAUNCH_EXECUTION>",
  "requiredCurrencyRaised": "10000000000000000000"
}
```

Generate deterministic unsigned calldata:

```powershell
npm --prefix .. run genesis:config -- .\path\to\genesis-input.json
```

Two operators must decode and compare the complete nested multicall, tuples, schedule, recipients,
amounts, salt, and timeline. The launcher transaction atomically calls `depositToken` and
`distributeToken`; never deposit OMR into the public launcher in a standalone transaction.

### Gate E — prepare, preflight, and launch

Execute the preparation calls from `launchOwner`:

1. OMR approves Permit2 for exactly 6,063,750 OMR.
2. Permit2 approves only the pinned launcher for exactly that amount and reviewed expiration.
3. the hook owner allows native ETH as the quote currency.

Then run the read-only post-preparation preflight:

```powershell
$env:CHAIN_RPC_URL = 'https://rpc.mainnet.chain.robinhood.com'
npm --prefix .. run genesis:preflight -- .\path\to\genesis-input.json
```

It fails closed on the wrong chain, changed external code, mismatched immutables or fees, nonzero
taxes, wrong hook authorization/interface/flags, wrong splitter state/recipients, insufficient OMR,
non-exact allowances, or an expired deadline.

After a second operator signs the preflight block/result, execute only `safeTransactions.launch`.
Verify the receipt and extract the initializer from `LBPStrategy.InitializerCreated`; also verify the
expected `TokenDistributed` and `TokensReceived` events. Read every initializer parameter back from
chain. Only then deploy `GENESIS_LAUNCH_PHASE=auction`.

## 7. Auction operations

- Publish the initializer, chain, block timeline, floor interpretation, claim cliff, official bid
  interface, and scam warning before `startBlock`.
- Monitor checkpoints, clearing price, gross currency raised, bid exits, RPC health, and clock drift.
- `checkpoint()` is permissionless and finalizes at `endBlock` when called after the end.
- Do not change OMR/hook taxes or open another primary OMR venue.
- Chain state, not UI estimates or mempool activity, is authoritative.

At auction end, deploy `GENESIS_LAUNCH_PHASE=migration`. Call `checkpoint()` and verify the final
checkpoint, `isGraduated()`, clearing price, sold tokens, gross raise, and current protocol fee.

## 8. Migration and outcome branches

`LBPStrategy.migrate(initializer)` is permissionless but one-shot. It clears the initializer's pool
reservation before its internal attempt. Never send it before `migrationBlock` or without final reads.

### Successful migration

Require all of the following:

- `Migrated(initializer, key, initialSqrtPriceX96, plan)` exists;
- `MigrationFailed` and `FundsRecovered` do not exist;
- the pool key exactly matches native ETH / OMR / fee 3000 / spacing 60 / OmertaHook;
- PoolManager slot0 is initialized at the auction-derived price;
- the expected position NFT exists and is owned by `positionRecipient`;
- LP and residual deltas reconcile to the post-fee raise;
- the splitter received only residual currency and unused LP-reserve dust.

Then call `distributeResidual()` and reconcile all recipient balances. Call `recoverToken(OMR)` only
after explaining any OMR balance. The treasury may separately call the initializer's
`sweepUnsoldTokens()` as `tokensRecipient`.

Deploy `GENESIS_LAUNCH_PHASE=oracle_warmup` and keep bonds, Desk creation, OMR minting, and both tax
layers closed. The hook accumulator began at pool initialization, but the oracle deliberately seeds a
new baseline when it is deployed; no pre-deployment interval is published as fresh.

Simulate the ownerless oracle deployment without `--broadcast`, decode all constructor inputs, then
execute it only after the successful-migration evidence above is signed:

```powershell
forge script script/DeployV4TwapOracle.s.sol:DeployV4TwapOracle --rpc-url $env:CHAIN_RPC_URL --sender $env:DEPLOYER -vvvv
```

The script fixes the pool to native ETH / OMR / fee 3000 / spacing 60 / the mined hook, verifies the
hook's PoolManager and initialized accumulator, and requires the fresh oracle to report `(0, 0)`.

### Failed auction or migration

If `MigrationFailed`/`FundsRecovered` appear or the pool remains uninitialized:

1. deploy `GENESIS_LAUNCH_PHASE=failed`;
2. reconcile recovered ETH and OMR;
3. call `recoverFailedLaunch()` to return ETH to treasury;
4. call `recoverToken(OMR)` to return OMR to treasury;
5. verify CCA bidder refund/claim behavior;
6. publish the outcome and do not reuse the initializer.

Creating liquidity manually or launching a replacement is a new governance decision and ceremony.

## 9. Claims, oracle handoff, and post-launch bonds

Claims open at `claimBlock`; this is a cliff. Confirm the final checkpoint and publish a batch-claim
path. Monitor claimed tokens, unclaimed inventory, and phishing attempts.

Before `live`:

1. Verify the deployed `OmrV4TwapOracle` bytecode and every immutable: source = mined OmertaHook,
   PoolManager = pinned v4 singleton, OMR = canonical token, pool ID = committed genesis pool,
   fee = 3000, spacing = 60, and the approved `PERIOD` (never below ten minutes).
2. From the Safe, call `OmertaHook.setObserver(oracle)`. Read it back. This only enables the
   post-settlement `pokeObserver(poolKey)` path; the hook never calls external oracle code during a
   PoolManager callback.
3. Before activation, set `OMR_V4_ORACLE_ADDRESS` and a dedicated low-balance
   `V4_ORACLE_KEEPER_PK` on the worker, then verify `/v1/mod/bonds` and the admin Chain panel. The
   worker polls the oracle's own baseline on `CHAIN_POLL_MS`, simulates permissionless `update()`,
   persists the signed raw transaction before broadcast, confirms its receipt, and journals one
   attempt per `(oracle, baseline)`. Retries rebroadcast the exact same raw bytes; deploy overlap
   cannot independently sign the same window. `ObservationRequested(poolId)` remains an optional
   liveness hint, not a completeness dependency: the hook already retains every swap and idle-time
   tick-second. Keep every close between `PERIOD` and `PERIOD * 4`; an overlong window is discarded
   and recovery takes one additional honest window.
4. Wait at least one complete window after oracle deployment, call `update()`, and independently read
   `consult()`, `arithmeticMeanTick()`, `tickCumulativeLast()`, `blockTimestampLast()`, and
   `lastUpdate()`. Confirm OMR-per-ETH orientation against independently reconstructed historical
   ticks; do not compare only with current slot0.
5. On a chain-4663 fork, prove the feed goes stale when pokes stop, rejects an early close, discards an
   overlong interval, recovers after one valid window, preserves multiple swaps between pokes, and
   makes `OmertaBond.priceCeiling()` revert for zero/stale readings and reject an out-of-tolerance quote.
6. Choose `maxOracleAge` strictly above the normal keeper cadence and below the first planned missed-
   window alert; record the derivation. Simulate the complete
   `OmertaBond.setOracle(oracle, toleranceBps, maxOracleAge)` plus cap/minter activation ceremony and
   arm OMR minting last.
7. Keep OMR and hook sell tax zero through the first low-value bond settlement. Any later sell-tax
   activation is a separate approval; it is not part of migration or oracle cutover.

Only then enter `GENESIS_LAUNCH_PHASE=live`. Reopen Desk and reserve bonds conservatively and test one
low-value settlement. Keep the CCA as history; never reuse its floor as a live oracle.

## 10. Required evidence package

Archive and sign source tags, tool versions, audits, manifests, code hashes, cadence measurements,
derived blocks, input JSON hash, decoded calls, Safe simulations, approvals, transaction receipts,
preflight JSON, final checkpoint, fee calculation, migration branch, pool/NFT state, proceeds split,
oracle warm-up, activation ceremony, public communications, and incident contacts.

If any address, bytecode hash, recipient, supply amount, pool parameter, schedule, timing, fee result,
or oracle design changes, stop and regenerate the evidence package.
