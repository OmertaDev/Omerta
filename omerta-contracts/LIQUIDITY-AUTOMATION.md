# Restricted liquidity automation

This implementation is for Robinhood mainnet, chain **4663**. Its contracts and backend support
routine operation under an initial Safe-approved policy. The source review is recorded in
[the liquidity automation audit](audits/2026-09-08-liquidity-automation/report.md). Production
activation still requires the actual Safe, recipients, contract addresses, runtime hashes and
finite budgets. Neither a generated plan nor this document deploys or funds a contract.

## Money and authority

| Revenue | Destination policy |
| --- | --- |
| Character mint | **100% DEV**, directly from `OmertaFees`; never enters the router |
| Respawn, reroll, store packages | 25% Vig, 10% treasury, 15% community, 50% DEV; rounding remainder stays with DEV |
| Bonds | 75% POL vault, 15% DEV, 5% treasury, 5% Vig |
| Sell tax | Required configured launch split: 9% total — 2% DEV, 1.6% treasury, 2.4% community, 3% POL |
| LP trading fees | **75% Desk / 25% Vig**, in each currency; these fees are not compounded into POL |
| Genesis proceeds | Existing 37.5% LP / 25% treasury / 22.5% Vig / 15% founder allocation |

The sell-tax allocation is an explicit launch configuration: the Hook initially has tax disabled,
and the backend source defaults differ. Verify that the active backend and Hook configuration
both match this approved split. The unsigned deployment builder preserves the observed Hook
configuration; it does not infer or overwrite the split.

`FeeRevenueRouter` physically distributes non-mint payments. Its fee contract and recipients
are immutable. Its separate entry point preserves the mint instruction even though the fee
contract previously used the same DEV recipient for both payment classes.

`ProtocolLiquidityVault` owns the full-range foundational PositionManager NFT. Its fixed pool,
PoolManager, PositionManager, Permit2, token and oracle bindings are checked on-chain. It accepts
the approved POL inflows, funds the designated inventory executor within caps, and increases
the existing position. Routine keeper authority cannot transfer, decrease or burn that position.
Fee collection pays the fixed Desk/Vig executors. A minimum liquidity floor and warmup gate
protect issuance; a fresh oracle quote alone cannot substitute for protected liquidity.

Four `LiquidityBuybackExecutor` instances keep Vig, Desk, Community and POL inventory funds
separate. Each has a fixed stream, recipient, pool, oracle and spending limits. The executor
performs the swap and delivers the purchased tokens in the same transaction. Both Vig portions
reach VoucherClaim custody: the ledger earmarks half for the reserve and half for prizes. Desk
tokens likewise reach VoucherClaim. Community tokens reach the declared community custodian;
POL inventory reaches the vault. No executor obtains OMR minting authority.

`KeeperGasVault` refills an allowlisted keeper toward a fixed balance target from an explicitly
funded operating reserve. Per-refill limits, a shared UTC-day budget and cooldowns bind every
caller. This is a gas subsidy with a finite allowance; it does not authenticate the keeper's
subsequent use of those funds. Exhaustion never draws from the mint, player or POL allocations.

`BankBufferVault` is optional. It calls the pinned Transmuter's actual `fund` entry point, caps
funding by the observed deficit and policy, and preserves redemption support. Bank harvest and
fee-sweep jobs require explicitly declared asset, vault, borrower and recipient bindings. They
do not activate Bank issuance or invent an asset-to-OMR exchange path. A concrete Bank asset
and ERC-4626 strategy still need their own activation review.

## Recurring execution and accounting

The worker schedules a bounded cycle. A cycle first indexes confirmed logs, then reconciles any
durable pending transaction, reads the current pinned contracts, and submits at most one new
typed action. Multiple workers coordinate through PostgreSQL advisory locks and one wallet nonce
journal. The scheduler rotates among due jobs, with gas refill and launch transitions receiving
priority. Ordinary low balances, thresholds, cooldowns and completed intervals cause waiting.

Signed transaction bytes, the nonce and budget reservations are committed **before broadcast**.
After an uncertain response the same bytes and hash are retried. A nonce conflict, unexpected
runtime, reorganized receipt or accounting mismatch holds the wallet for investigation. The
status command omits signed bytes. Back up and protect the database as operational key material.

Receipt accounting requires successful canonical receipts, fixed emitters, expected event
sequences and exact token-delivery logs. It books decimal strings into SQL NUMERIC and rounds
gameplay credits down to the existing six-decimal unit. The canonical block timestamp supplies
the price observation time. Multiple executor calls nested in one transaction are selected by
their own terminal log and preceding transfer segment. Idempotency covers both keeper execution
and permissionless calls found by the indexer.

Native Hook sweeps need additional historical proof because native transfers have no ERC-20
Transfer event. Both direct settlement and indexing verify the configured recipients at the
receipt block and hold any block containing a recipient change. A change followed by restoration
within the same block cannot manufacture approved native revenue. Rejected proof moves no books.

The initial indexing block is an explicit **L2 log block**, after all declared deployment code
exists and before its first operational receipts. Every page must finish accounting atomically
before its cursor advances. Backlogs are processed before new keeper spending. A stored prior
block hash detects a deeper reorganization across the cursor.

After the journal has reconciled, the cycle can complete already-queued withdrawals using the
existing extraction configuration. It verifies the claim runtime, token, owner, signer and chain,
then checks both exact lifetime funding and current physical backing for unclaimed signatures.
Absent extraction configuration remains dormant. A physical backing deficit holds new keeper
work and health publication; the helper never creates a key, changes a destination or enables
withdrawals. The existing FIFO request order and signing rules remain in place.

Vig, Desk and Community purchases remain bounded by their established recorded-revenue rules.
Desk buys also retain the historical band, lower price floor and exact minimum-output ceiling.
Permissionless receipts cannot bypass those books. If ordinary fee/bond watchers have not yet
recorded an inflow, the completed purchase remains held until that input can be reconciled.

## Genesis and issuance

`GenesisLifecycleController` binds once, before the auction starts, to the exact CCA/LBP
initializer and migration parameters. The CCA's unsold-token recipient is the controller;
the migration's position recipient is the POL vault. Configure these through
`buildGenesisLaunchArtifacts({ ..., lifecycleController, positionRecipient: polVault })`.
The immutable proceeds splitter must already name the intended Vig executor.

Permissionless typed calls checkpoint, attempt migration, distribute proceeds, return unsold
tokens to treasury, and adopt the proven full-range position. Upstream migration catches some
failures inside a successful outer transaction, so the controller proves actual pool creation
and state before advancing. A failed launch remains failed and exposes only the specified
recovery actions. No keeper can repoint it to a replacement launch.

The controller uses its pinned native chain clock for auction timing. Log discovery separately
uses L2 block numbers. The keeper searches a finite approved range for a unique qualifying
position, checks its ownership, pool, range, liquidity and subscriber state, then simulates
adoption. Missing or ambiguous candidates hold that step.

After foundation adoption, continuous custody, a fresh oracle observation after the configured
warmup and valid bond guards are required. Bond readiness is separate from general market readiness.
The public manifest optionally declares `bondDailyIssuance: "unlimited"`. This explicit policy must
match `OmertaBond.dailyCapOMR() == 0`, configured by the Safe through `setDailyCap(0)`. In that mode,
zero means no protocol-wide daily issuance cap; it does not mean paused. No additional environment
variable enables this policy, and `BOND_AUTOMATION_DAILY_OMR` does not create or ration daily offerings
for an unlimited manifest. A zero on-chain cap without that declaration, or the declaration paired
with a positive cap, keeps bonding unavailable.

Without the unlimited declaration, the existing finite mode remains: `BOND_AUTOMATION_DAILY_OMR`
creates one offering per UTC day, clipped by the contract's positive whole-OMR daily cap and remaining
lifetime signing capacity. It never increases that capacity or overrides an existing daily offering,
including a manual stop. Neither mode imposes a per-wallet purchase maximum.

The backend lifetime capacity remains an explicit aggregate signing budget, not a token balance
pre-funded into `OmertaBond` or an on-chain lifetime mint cap. Remaining capacity excludes committed
bonds and unresolved signed quotes. An unresolved quote continues reserving its amount until its
on-chain settlement is reconciled or expiry is verified against the chain; elapsed server time alone
does not release it. The bond board exposes this available allocation as `reserve.remainingOmr` and
outstanding quote reservations as `reserve.reservedQuotesOmr`. Unlimited daily issuance does not
increase the lifetime allocation or imply infinite available supply.

Before signing a new quote, bounded expiry recovery considers at most 100 expired candidates from
the recorded signing chain and contract. It requires the pinned bond runtime, an RPC `finalized`
block strictly after the quote deadline, `usedNonce(nonce) == false` at that same block, and an
unchanged canonical block hash. It does not substitute `latest` if finalized reads are unsupported.
All RPC reads precede the lifetime-budget lock; the quote status, original domain, deadline and
booked-bond state are rechecked under that lock before the release and JSON `expiry_proof` commit
together. The proof retains chain, contract, runtime, finalized block number/hash/timestamp, nonce
and deadline. A used nonce stays reserved while awaiting its watcher settlement. Legacy quotes
without stored signing chain/address remain reserved for explicit reconciliation rather than being
assumed to belong to the currently configured deployment. Quote signing rechecks current readiness
after recovery; recovery does not grant new quote authority.

The worker publishes a deployment-bound health observation with a 90-second expiry. Web
processes read the same row before new bond quotes or Desk auction commitments. Stale or absent
observations close those paths. In finite mode, setting a daily offering to zero remains possible
during an outage, while already-signed commitments retain their existing floor. In unlimited mode,
legacy daily-offering administration is rejected: use the Safe's bond pause or the designated bond
guardian's pause-only authority to stop issuance. Only the Safe can resume it. Ordinary withdrawal
and bond claim routes keep their existing rules; this feature does not activate extraction.

The unlimited board reports `daily.unlimited: true` and null daily offered/remaining/quoted amounts.
Clients must not interpret those nulls as an empty daily offering or the unlimited flag as readiness.
Quote controls also require `liquidity.bondReady`, Genesis `bondQuotesOpen`, a current quote and positive
available allocation. The user-facing policy is “No daily purchase limit”; available supply remains
visible separately.

## Initial setup

1. Compile the reviewed sources with the pinned dependencies and retain the resulting artifacts.
   Use `node tools/liquidity-deployment-plan.js --template` to produce an input template. Every
   public address, current getter binding, runtime hash, deployer nonce and financial policy is
   explicit; null placeholders are deliberately unusable. A bond daily cap of the explicit decimal
   string `"0"` selects no daily limit; required positive operating budgets retain their checks.
2. Generate an unsigned plan with
   `node tools/liquidity-deployment-plan.js --plan INPUT.json NEW_PLAN.json`. It checks compiler
   source hashes, ABI and settings, predicts sequential CREATE addresses, and emits ordered
   Safe configuration calls. It performs no RPC request, signature, broadcast or funding.
3. Verify the actual core deployment and Safe owners/threshold, execute the approved deployment
   sequence, and verify every runtime and constructor binding. Run the emitted configuration
   calls as the reviewed atomic Safe batch. The older core deployment wrapper initially sends
   POL to the Safe; this batch explicitly repoints the approved POL destination to the vault.
   There is no intermediate keeper ownership of core contracts.
4. Seed the approved foundation/genesis allocation and the operating service reserves. Configure
   the OMR minter, bond oracle, independent price ceiling, health guard and issuance caps through
   the initial Safe policy. The reviewed dormant core constructor profile may retain its positive
   initial cap; the later Safe configuration applies the selected zero cap while bonds remain paused.
   Bank is opt-in and stays separate.
5. Create the public keeper manifest from the schema/example in
   `tools/liquidity-manifest-example.js`. Replace every synthetic identity and approve each job's
   limits. Include `bondDailyIssuance: "unlimited"` only for the matching approved zero-cap bond policy.
   Pin the exact file SHA256. Set the same manifest and chain configuration on web and
   worker; keep `LIQUIDITY_KEEPER_PK` on the worker and out of the web environment. Remove the old `DEX_BOT_PK`.
6. Run `npm run liquidity:plan`. Planning is read-only, needs no signing key and uses a read-only
   PostgreSQL connection when supplied. Inspect bindings, blocked conditions and encoded actions.
   Enable the worker only after the concrete plan and source evidence match the deployed system.

Required environment values are `LIQUIDITY_AUTOMATION_ENABLED=on`,
`LIQUIDITY_AUTOMATION_MANIFEST_PATH`, `LIQUIDITY_AUTOMATION_MANIFEST_SHA256`, `CHAIN_ID=4663`,
`CHAIN_RPC_URL`, and a persistent `DATABASE_URL`. Only execution needs `LIQUIDITY_KEEPER_PK`.
Optional `LIQUIDITY_RPC_URLS` supplies at most two additional HTTPS endpoints; exact signed bytes
remain unchanged across failover. `BOND_AUTOMATION_DAILY_OMR` has no financial default and applies
only to finite daily offerings; the optional manifest declaration controls unlimited daily issuance.
The key must differ from Safe governance, voucher signing and the existing oracle keeper keys.
Distinct keys do not establish process isolation: a worker configured for the existing withdrawal
queue can also hold its separate voucher key. Keep the established v4 oracle maintenance worker
enabled with its separate identity.

Existing testnet fee contracts cannot acquire the new runtime. The older general fee watcher
also has nonce keys and cursors that require fresh deployment-scoped state or a separately
reviewed migration when replacing an existing fee contract. Do not change only an address while
retaining incompatible old fee-indexing state.

## Emergency operations

Use `npm run liquidity:status` for the redacted transaction journal and retained canonical receipt
evidence. Inspect worker logs and alarms for cycle-level indexing, reconciliation and backing
holds. A failing receipt must be reconciled before another wallet
transaction is authorized. Do not delete pending rows, invent a new nonce, or replace signed
bytes to bypass a hold. A stopped or exhausted job leaves its funds in the declared custody.

Safe governance can pause the relevant executor, revoke a gas recipient or stop issuance. The
POL guardian can latch an emergency stop; it cannot redirect or withdraw funds. Principal
recovery goes only to the immutable Safe recipient after the latch. This invalidates foundation
health before recovery. The keeper cannot clear the emergency or select a replacement pool.

Routine collections, buybacks, POL additions, finite-mode daily offerings and gas refills need no recurring
Safe approval within the configured policy. Changing recipients, budgets, the canonical pool,
an asset adapter or a failed launch remains an explicit governance decision.

## Verification commands

- `npm run test:liquidity` — deterministic transport, planner, accounting, Genesis and policy tests.
- `npm run test:liquidity:deployment` — unsigned artifact-bound deployment planning.
- `npm run liquidity:e2e` — disposable local actual-contract rehearsal; no production transaction.
- `npm test` — full backend suite, including the liquidity tests.
- `npm run pgquery` and `npm run pgcheck` — full real-PostgreSQL SQL and gameplay gates on a
  disposable database. The dedicated liquidity PostgreSQL suites also prove recovery and locking.
- Foundry's focused liquidity suites — unit, adversarial, fuzz and invariant evidence identified
  by the audit's source and evidence manifests.

The local E2E uses an administered GenesisOracle and a local EOA standing in for governance.
The real v4/PositionManager/Permit2 paths execute locally. Genesis-controller and Bank proofs are
separate suites; this distinction is retained in the report rather than implied by one E2E label.
