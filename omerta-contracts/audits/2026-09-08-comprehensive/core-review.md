# Core contracts review — 2026-09-08

Status: source review and supplementary test execution complete. This is the core-contract contribution to the comprehensive audit, not a deployment authorization or a conclusion for the other contract groups.

## Scope and source

Reviewed working-tree source at repository commit `e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`. The repository was dirty at review start; no pre-existing dirty file was changed by this reviewer. The eleven assigned production files were clean relative to that commit at inspection. Exact SHA-256 values are retained in `core-source-hashes.json` and the parent package's source inventory.

The following files were read in full, including internal helpers and constructor/configuration paths:

| File | External surface and internal paths inspected | Authority / invariant |
| --- | --- | --- |
| `src/OMR.sol` | Constructor; `setMinter`, `mint`, `setSellTax`, `setTaxRecipients`, `setPair`, `setExempt`, `_update`; inherited transfer/allowance/permit behavior | Single owner-selected minter; sell-tax slices conserve the transferred total; owner-controlled pool registration and exemptions |
| `src/OMRStaking.sol` | Constructor; `setApy`, `fundRewards`, `_updateRewardIndex`, `_accrue`, `stake`, `unstake`, `claimRewards`, `pendingRewards` | Principal and reward funding tracked separately; accrued history checkpointed before rate changes; reward payout cannot exceed funded reward accounting |
| `src/OmertaFees.sol` | Constructor; four `pay*` routes; `_forward`; fee/recipient/package setters; `sweep` | Exact positive payment; monotonic nonce; two-recipient forwarding succeeds atomically or every effect reverts |
| `src/VoucherClaim.sol` | Constructor; signer/cap/pause/sweep administration; `hashVoucher`, `claim`; `IGearVault` calls | Signed recipient/amount/kind/gear/nonce/deadline; chain/address domain; globally consumed nonce; pre-funded OMR; bridge gear preflight plus durable asset-layer bound |
| `src/GearVault.sol` | Constructor; minter/cap/metadata setters; `mint`, `redeem`; all class/type/rarity and JSON URI helpers | `minted - redeemed` equals live issuance; cap persists across bridge replacement; owner balance is burned before reimport event |
| `src/StreetDeed.sol` | Constructor; signer/cap/metadata/pause setters; `tokenIdFor`, `hashVoucher`, `claim`, `setTransferLock`, `redeem`, `_update`, `tokenURI`, `_json` | Unique live name-derived ID; owner-only burn/unlock; every mint/transfer relocks; signed authority; explicit preservation of burn recovery while paused |
| `src/DynastyNFT.sol` | Constructor; signer/cap/URI/royalty/pause setters; `hashVoucher`, `claim`, `tokenURI`, `supportsInterface` | Sequential ID; signed issuance and daily cap; ERC-2981 royalty is metadata, not a transfer-enforced payment; no balance-based game entitlement |
| `src/StockVault.sol` | Constructor; keeper/signer/cap/pause/sweep setters; `effectiveDailyCap`, `deliver`, `deliverAuthorized`, `hashAuthorization`, `deliverBatch`, `_deliver` | Held-token transfer only; keeper role; optional independent authorization required when armed; delivery-ID replay and per-token cap |
| `src/GenesisOracle.sol` | Constructor, `setPrice`, `consult` | Administered price ends at explicit validity boundary; returns unavailable outside the window |
| `src/OmertaBond.sol` | Constructor; all rate/oracle/signer/recipient/cap/pause/sweep setters; `priceCeiling`, `_oraclePrice`, `hashQuote`, `bond`, `claim`, `_vested`, `claimable` | Signed payer/value; bounded discount, absolute rate, oracle-derived rate, daily amount; minted OMR backs all outstanding bonds; sweep limited to surplus |
| `src/GenesisProceedsSplitter.sol` | Constructor, `receive`, `canonicalPoolInitialized`, `distributeResidual`, `recoverFailedLaunch`, `recoverToken`, `_send` | Immutable destinations; pool initialization distinguishes successful residual from failed-launch recovery; tokens always recover to treasury |

Related source inspected: `src/IOmrOracle.sol`; deployment wiring in `script/Deploy.s.sol`, `script/DeployGenesisSplitter.s.sol`, `script/Deploy-MainnetCore.ps1`; supported oracle timestamp writes in `src/OmrTwapOracle.sol` and `src/OmrV4TwapOracle.sol`; fee ingestion and custody expectations in repository `src/fees.js`, `src/vig.js`, `src/treasury.js`, `src/community.js`, `src/router.js`, `src/watcher.js`, `deploy/fee-splits.env`, and `CHAIN-DEPLOY.md`.

Existing tests were inspected as test implementation, not relied on as historic proof: `test/Omerta.t.sol`, `test/OmertaBond.t.sol`, `test/OMRTax.t.sol`, `test/GearVault.t.sol`, `test/StockVault.t.sol`, `test/GenesisProceedsSplitter.t.sol`, and callback fixtures in the pre-existing `test/CharacterLaunchAudit.t.sol`. The parent package records the newly executed full suite.

## Method adaptation

The governing source is `SECURITY-REVIEW-POLICY.md`. Methods were drawn from the locally pinned repositories, not silently updated:

- Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`: read judging/shared scan rules and applied access-control, execution-path, replay, rounding, callback, cap, recipient and migration adversarial passes. The finding gates require a reachable trigger and identifiable harm. Admin powers, unreachable future timestamps, and dust-only arithmetic differences were not presented as exploitable findings.
- Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: read EVM `token-flow-tracing` and `verification-protocol`; tracked entry/exit custody, unsolicited transfers, exact token forms, externally supplied behavior, and source provenance of proof assertions.
- Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc`: read audit-context-building and followed actual inherited/library callees before relying on checks. Used the context/trust-boundary discipline with this bounded subagent assignment. The upstream per-function orchestration was not invoked and is not claimed.

This review ran in the existing Windows workspace with the parent coordinating the shared compiler/cache. No chain transaction, fee payment, configuration change, deployment, or broadcast was performed.

## System and trust model

[Feynman: token and staking] OMR has one issuer selected by its owner. A stake puts existing tokens aside, earns a time-based promise, and withdraws only from deposited principal plus separately funded reward tokens. Deposits and donations do not change a share price because there is no share price.

[Inversion: token/staking accounting] Consider tax-recipient aliases, repeated fractional transfers, an unsolicited donation, frequent interest checkpoints, a rate change just before claiming, and an empty reward pool. None gives an ordinary caller a new mint authority or permission to spend another staker's principal. The principal guarantee assumes the configured asset is this reviewed OMR and staking is not deliberately registered as a taxed AMM destination.

[Feynman: vouchers and collectibles] The server signs exactly what may be issued and to whom. Anyone may submit a valid voucher, but cannot redirect it. Reimports destroy the holder's token and leave an event for the game. A receiver contract can destroy or transfer a just-minted token before the enclosing issuance function emits its final event.

[Inversion: claim execution] Reuse a nonce; change recipient/amount/kind; replay against another contract or chain; reject the receiver callback; burn during the receiver callback; replace the bridge after prior issuance. Nonce, daily totals, mint totals and payments revert together when the enclosing transaction fails. Cross-contract receiver actions may legitimately precede the final claim event; the indexer must handle their real order.

[Feynman: bonds] A player pays the signed ETH amount; the contract creates the promised OMR immediately, holds it for that player, and releases it over time. The treasury receives the ETH immediately. The contract's unclaimed promise and its held OMR decrease together as claims vest.

[Inversion: bond accounting] Attempt stale prices, inflated oracle prices, excessive discounts, alternate payers, altered principal, duplicate signatures, repeated tiny vesting claims, and a final fee recipient that rejects ETH. Price/cap/signature checks bound issuance; a failed forward rolls back the issuance and earlier recipient transfers; repeated claims cannot create another payout. Finite caps and compatible live oracle configuration remain release requirements.

[Feynman: stock and genesis distribution] The stock vault distributes an existing balance under keeper authority, optionally requiring the separate allocation key. The genesis splitter releases money only to its immutable configured destinations and chooses its ETH policy by reading the committed pool.

[Socratic: genesis success discriminator] A nonzero pool price is a successful-launch proof only if the canonical hook really restricts initialization to the committed migration and failed migration rolls that initialization back. The comprehensive AMM/launcher review owns this integration proof; an unhooked PoolManager test proves the splitter branch implementation, not that integration precondition.

### Assets and external calls

| Asset / call | Entry | Exit | Tracked authority | Unsolicited-transfer effect |
| --- | --- | --- | --- | --- |
| Actual OMR in staking | `stake`, `fundRewards`, direct transfer | `unstake`, `claimRewards` | `positions`, `totalStaked`, `rewardPool`, global reward index | Donation creates unallocated balance; no reward or principal entitlement and no rate inflation |
| Actual OMR in voucher bridge | Safe funding/direct transfer | signed OMR claim, owner sweep | Pre-held balance, nonce and UTC-day claim counters | More claim liquidity only; no unsigned recipient authority |
| Actual OMR in bond | Authorized mint at bond creation; direct transfer | owner claim, surplus-only sweep | `bonds`, `committedOMR`, nonce, bounded issuance | Donation increases sweepable surplus; does not change vesting promise |
| Gear ERC-1155 | Authorized mint; transfer among holders | Holder redeem burns | Durable `minted`, `redeemed`, `cap`; ERC-1155 balances | Transfers cannot create cap headroom; only actual burn can |
| Deed/identity ERC-721 | Signed mint; inherited transfers | Deed-only holder burn | ERC-721 owner/balances, signed nonce, daily count | Receiver may move own newly minted token during callback; identity has no burn |
| External stock ERC-20 | Treasury deposit/direct transfer | Keeper/attested transfer; owner sweep | Held token balance, delivery IDs, per-token daily counter | Additional tokens do not create new allocation authorizations |
| Native ETH fees/bonds | Exact-value payable entry | Immediate fixed-ratio recipients; owner stray-ETH sweep | Nonce or bond ledger; no retained payable liability | Forced ETH can be swept separately; not attributed to a fee/bond |
| Native ETH genesis | `receive` or forced transfer | Success split or pre-success treasury recovery | Actual balance plus immutable pool/recipients | Sent ETH follows the same fixed destinations; sender cannot redirect it |
| ERC-20 genesis dust | Direct transfer / launcher recovery | `recoverToken` to treasury | Actual selected-token balance | Any token can be recovered; cannot move other token classes or choose recipient |

Native ETH and ERC-20 are separate paths; `recoverToken`/stock rejects the zero-token sentinel. No ERC-4626, receipt-token pricing, lending/liquidation, cross-chain transport, or upgradeable proxy storage exists in this assigned subset. Those categories belong to other contract groups where applicable.

### Dependency and provenance checks

- OpenZeppelin ECDSA recovery checks were followed: invalid lengths/upper-half `s`/invalid recovery are rejected; EIP-712 domains bind name, version, chain ID and contract address. ERC20Permit consumes its owner nonce within the reverting transaction. These are `[CODE]` evidence.
- ERC-20 `_update`, `_mint`, `_transfer`, allowance spending and SafeERC20 failure checks were read. Actual OMR has no receiver callback. SafeERC20 supports no-return tokens and rejects false returns; it does not certify fee-on-transfer, rebase, blacklist, or other external token economics.
- ERC-721 `_update`, `_safeMint`, `_burn` and ERC-1155 update/acceptance paths were read. Ownership/balance updates occur before receiver callbacks. A deed's override re-locks the new owner and clears its lock on burn.
- Ownable2Step transfer/accept semantics, ordinary one-step renunciation, ReentrancyGuard implementation, and ERC-2981 bounds were read. Owner/signer/keeper powers are explicit trust boundaries, not asserted to be eliminated by these libraries.
- Vendored files are stored inside the repository rather than independently pinned Git submodules in this checkout; `git -C lib/... rev-parse HEAD` resolves the parent commit and must not be described as an upstream dependency commit. The parent source inventory pins file bytes. The v4 package identifies itself as `1.0.2`; OpenZeppelin inspected headers identify updates ranging from v5.1.0 through v5.6.0. A single inferred OpenZeppelin package release is not claimed.

Plamen step record: token entry/state/exit/type separation/native paths/donations/full token matrix/cross-token interactions/return type/callback side effects were inspected. There are no secondary receipt-token outputs in the assigned implementation. Actual external stock token deployments remain `[EXT-UNV]`; the deliberately false-return test token and hostile recipient fixtures are `[MOCK]` adversaries and cannot establish production token compatibility. The pool source used by splitter tests is actual vendored `[CODE]`, but the test's zero-hook key does not establish canonical migration authorization.

## Findings and disposition

No confirmed unprivileged core-contract exploit was established in this assigned source pass. This is a bounded result, not a claim that every surrounding component is free of defects. The following hypotheses and operational dependencies remain visible:

| ID | Disposition | Source / trace | Reason and required release evidence |
| --- | --- | --- | --- |
| CORE-CFG-01 | Documented custody dependency; address decision required | `OmertaFees.sol:128`; repository `src/fees.js:80-94`, `src/treasury.js:80-86`; `CHAIN-DEPLOY.md:273` | Path A sends 25% to Vig and 75% to feeRecipient on-chain, while the backend books 10% treasury + 15% community out of that 75%. Neither booking transfers ETH to the treasury/community wallets. Identify the address that actually holds these earmarks, remittance controls, and balance reconciliation before activating the economic rails. No unprivileged extraction exploit through these core contracts was demonstrated. |
| CORE-CFG-02 | Immutable recipient liveness dependency | `GenesisProceedsSplitter.sol:53-68,80-119` | One rejecting destination reverts the entire success split; no recipient rotation or success-path bypass exists. The supplementary test demonstrates retained custody and zero partial payout, not recoverability. Validate actual recipient code/acceptance before deploying this ownerless splitter. |
| CORE-INT-01 | Cross-component callback ordering; parent indexer review | `GearVault.sol:113-122,142-151`; `VoucherClaim.sol:161-167`; `StreetDeed.sol:181-188,203-208`; `DynastyNFT.sol:159-161` | Receiver ownership is established before callback. A gear/deed receiver may burn before final `Claimed`/`Extracted`; a Dynasty receiver may transfer before `Minted`. This is valid token behavior, not by itself a contract bug. Tests retain actual ordering so the parent can validate ingestion and freeze/reimport behavior. |
| CORE-INT-02 | Genesis integration prerequisite | `GenesisProceedsSplitter.sol:74-77`; `script/DeployGenesisSplitter.s.sol:32-45` | Nonzero slot0 is only a reliable success signal under canonical hook/launcher initialization authority and atomic rollback. Parent AMM review must supply that proof. |
| CORE-HYP-01 | Not promoted: no supported-feed trigger | `OmertaBond.sol:295-298` | Consumer does not explicitly reject a future timestamp. The actual Genesis feed returns current time; supported TWAP sources write their close time from `block.timestamp`. An arbitrary replacement oracle is a new trusted integration requiring review; no ordinary actor can feed a future timestamp through these implementations. |
| CORE-HYP-02 | Not promoted: trusted cap-transition semantics | `StockVault.sol:239-245`; `OmertaBond.sol:366-371` | Counters are not incremented while the respective daily cap is explicitly unlimited. Enabling a finite cap during that day starts counting future activity against it, excluding the unlimited period. Deployment uses finite caps. A malicious owner turning caps off is not a new attack finding. Avoid presenting the counter as complete historical totals across an unlimited interval. |
| CORE-HYP-03 | Not promoted: bounded rounding | `OMRStaking.sol:69,78`; `OmertaBond.sol:357` | Repeated index updates round down, not up; bond-rate division can differ from a rational bound by sub-unit rounding. At configured token precision these do not provide a material overpayment path. The staking fuzzer compares with independent time/rate integration. |
| CORE-HYP-04 | Not promoted: supported asset is fixed | `OMRStaking.sol:60-63,84-90` | Nominal-amount accounting would be incompatible with a taxed/rebasing replacement asset. The deployed constructor is wired to reviewed OMR; incoming protocol transfers have no tax unless the owner deliberately registers the staking address as an AMM. Do not generalize this contract as safe for arbitrary IERC20 assets. |

Fee configuration discrepancy resolution: `src/rules.tail.js`/`src/vig.js` code defaults differ from the deployment values intentionally. `deploy/fee-splits.env` is the Path A override, and the mainnet wrapper enforces it. This was checked as configuration drift and resolved as a named profile; legacy/genesis economics must not be silently substituted for that profile.

## Recipient and fee map for owner input

| Flow | Implemented allocation | Destination input / mutability |
| --- | --- | --- |
| Mint, respawn, reroll and package ETH | Immutable `vigBps`; Path A 25% Vig / 75% fee recipient on-chain | `VIG_WALLET`, `DEV_WALLET` at core deployment; owner can rotate destinations |
| Path A fee economic earmarks | Backend: 25% Vig / 10% treasury / 15% community / 50% operations | Treasury/community are currently carved from the 75% feeRecipient custody; separate recipient/remittance design must be made concrete |
| Postlaunch bond ETH | Immutable Path A 75% POL / 15% developer / 5% treasury / 5% Vig remainder | `POL_WALLET`, `DEV_WALLET`, `SAFE`, `VIG_WALLET`; mainnet wrapper requires POL=SAFE; owner can rotate recipients |
| Dynasty royalty | Deployment default 500 bps (5%), voluntary marketplace ERC-2981 query | Initial royalty recipient `SAFE`; owner may rotate recipient/rate within ERC-2981 bound |
| OMR ERC-20 sell tax | Configurable total ≤10%; named dev/treasury/community plus LP remainder | Four explicit recipients; canonical hooked v4 venue must not also be taxed at this token layer |
| Successful genesis residual ETH | 40% treasury / 36% Vig / 24% founder of residual; assumes 37.5% whole-raise allocation to LP | `TREASURY_RECIPIENT`, `VIG_RECIPIENT`, `DEV_RECIPIENT`; all immutable in splitter |
| Failed genesis ETH and all ERC-20 dust | 100% treasury | Immutable treasury recipient |
| Staking / vouchers / stock | No recipient fee split in these contracts | Staking reward pool funded separately; voucher and stock custody in their dedicated contracts |

The testnet manifest's existing addresses are rehearsal data tied to its historical revision, not proposed production destinations. This audit did not ask for private keys and does not require them. Public destination addresses and confirmation of the fee-custody arrangement are the relevant owner inputs.

## Executed evidence

Supplementary suite: `test/audit/ComprehensiveCoreAudit.t.sol`. All nine tests passed in the retained affected regression run, including two fuzz properties at 512 runs each. The suite uses independently constructed EIP-712 message/domain hashes for bond, voucher, deed and stock authorizations. The inspected result is in [`affected-retest.log`](../../../output/comprehensive-audit/affected-retest.log); the command, seed and execution settings are recorded by the parent package.

Executed coverage: eight-step staking rate histories; repeated rounded bond claims against minted commitment; full rollback when the last bond recipient rejects; actual gear burn-during-mint ordering; live-supply bound across replacement by another actual VoucherClaim; deed burn-during-mint ownership/replay; stock authorization chain/address/recipient binding; false-return token rollback; genesis immutable-recipient rejection and branch separation.

The full baseline completed with 927 passed, one failed, and zero skipped across 46 suites (928 tests). Its single failure was the AcquisitionVaultOperator CRLF-versus-LF artifact-source assertion. After the narrow test-harness correction, the affected regression passed all 169 tests across nine suites, including all 84 AcquisitionVaultOperator tests and all 19 supplementary tests: nine core, eight acquisition and two market. Four of those 19 are fuzz properties, two core and two acquisition, each at 512 runs. These are separate executions, not 169 additional distinct behaviors or a silently replaced clean baseline.

Static-analysis accounting and full-suite conclusions are in the parent package's triage artifacts and [`report.md`](report.md). The later indexer follow-up confirmed and corrected the deed recovery defect associated with CORE-INT-01; [`evidence-consistency.md`](evidence-consistency.md) retains its before/after JavaScript and PostgreSQL evidence. Contract callback-order tests and backend fixture tests remain separate boundaries. No mainnet state/bytecode/address conclusion is made by this core source-and-test contribution.
