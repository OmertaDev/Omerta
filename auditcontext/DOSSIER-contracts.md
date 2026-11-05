# Native ETH staking contract context

Source: PR 310 base `d70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e`, modified working tree on
`codex/pr310-native-eth-rewards`, 2026-11-04. Phase: implementation and agent review;
no deployment, funding, activation, or broadcast. This is a context record, not a security conclusion.

Initial implementation SHA-256: `OmertaEthStakingV2.sol`
`b6f791a3e4634dc1a58baab198b460312d763df1bd17f045e4887b43cc319f74`;
`OmertaEthRewardsV2.sol`
`b4b916bab1d87c491718df3c278da70dcad9ccc852253ddaa92b283a60087b62`.
These identify the context-building snapshot; final review/test evidence must pin final source separately.

## Scope and dependencies

Included: native vault/collector and their unit, fuzz, invariant and actual-market integration tests;
the existing restricted token, canonical router, Hook, market-state source and restricted manager
as direct dependencies. The three existing revenue-policy identifiers change coherently to
`OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_ETH_STAKERS_BOTH_DIRECTIONS`.
The manager/Hook constructor ABIs, mandatory 350+50=400 bps allocation, rounding, opening guards,
auction and settlement behavior are preserved. Current WBTC reward/converter implementations and
their superseded tests are removed; Git history retains their original evidence.

Excluded: JavaScript receipt/signing routes, operational tooling, historical source-transfer evidence,
deployment configuration and chain state. Documentation and generated artifacts are separate parent work.
Compiler configuration is Solidity 0.8.38, Cancun, optimizer 800; the manager remains non-IR and
market periphery uses the repository's existing IR profile. Dependency integrity and executed checks
are recorded by the parent verification run rather than asserted from earlier owner-tree tests.

## Entry points, assets and accounting

- `stake` accepts only admitted player accounts, requires exact OMR custody and records a separate
  `lockedAt + 30 days` position per deposit. `withdraw` consumes only the caller's mature position,
  returns OMR only to that account, and reduces held reward balance. `relock` consumes mature lock
  quantity and creates a new lock without changing held principal or reward weight.
- Lock-flow prefix histories and held-balance reward-integral histories are independent. Maturity
  removes the withdrawal restriction; held principal keeps earning until withdrawn. Same-timestamp
  checkpoints coalesce without creating elapsed weight. Past integrals survive later exits/relocks.
- `fundEth` accepts only the one-time bound distributor with the pinned runtime. Only `msg.value`
  increases receipt-epoch budget and `totalEthFunded`; forced ETH/direct OMR donations create no credit.
- Anyone finalizes a closed 30-day epoch. An epoch with no stake-time moves its budget to the next
  full future epoch. Account entitlement is floor(budget * account stake-seconds / total stake-seconds).
  Rounding dust remains in the vault; there is no owner sweep or claim expiry.
- `claim` uses the caller's account identity and finalized historical weight. A batch contains 1–24
  strictly increasing epoch IDs; per-account/epoch flags prevent replay. Flags/counters precede ETH
  delivery, and failed recipients revert the entire batch. Native callbacks are reentrancy-guarded.
- `collectTax` permissionlessly sweeps only restricted-manager bucket 4 in native ETH and OMR,
  checking actual balance deltas against reported amounts. `fundRewards` forwards held ETH only to
  the immutable active vault and checks both native debit and vault funded-counter increase.
- `convertOmr` is Safe/keeper-only, through the immutable canonical router and key; its temporary
  approval is cleared. Exact OMR debit and native receipt are checked, with per-call/day caps,
  bounded deadline, observed market floor, conservative fee/slippage allowance and Safe health lease.

## Trust and privilege boundaries

The vault owner sets distributor once, activates only after token policy sealing and live pinned
`ProtocolCustody` admission, and can pause deposits/relocks. Mature exits and historical ETH claims
do not consult that pause or collector market/health state. Principal cannot be forwarded to a new
wallet through the custody operator. Real OMR transfer success still requires its immutable token
policy's live operator and recipient checks; mock-only exit tests do not establish that dependency.

The collector Safe changes keeper, confirms health, activates and unpauses. Keeper or Safe can pause
conversion/revoke health. Collection and native forwarding deliberately do not require a healthy
conversion market, live router/Hook/market-state code, conversion activation, or conversion unpause.
They retain OMR/vault/manager runtime pins, fixed manager reward recipient and fixed active vault.

Conversion checks immutable runtime hashes for OMR, manager, vault, canonical router, market state
and canonical Hook. The actual Hook's `poolKey`, `poolManager`, `omr` and manager-revenue mode must
match the immutable key/manager/token; market-state `source()` must identify that same Hook. The
Hook's reward recipient must identify this collector. This establishes conversion-route and
observation identity without expanding the manager's existing allowed-pool topology. A matching
getter alone does not establish safe bytecode: deployment/review must verify the concrete pinned
manager/router/Hook/market-state/token runtimes, including any delegation behavior.

Safe health leases are operational attestations, not automatic sequencer detection. The market
snapshot is a finalized observation with freshness, valid epoch, minimum liquidity, nonzero price
and stress bounds. Historical raw liquidity and a quote floor are prerequisites, not executable-depth
or MEV guarantees. The canonical router/manager still enforce actual swap settlement and caller limits.

## Context-building method and open questions

Applied `audit-context-building` routing with an independent staking function-analysis subagent,
followed direct callees and cross-file transfer policy, and compared the owner-tree starting point
with pinned PR source. Read-only function records informed the scope; this compact dossier captures
their shared invariants rather than reproducing per-function prose. Historical passing tests were
not treated as proof for the modified target.

- The manager/Hook recipient is immutable and the collector constructor requires an already deployed
  manager. The integration fixture must prove a deterministic predicted collector binding; production
  deployment parameters and prediction remain an operational verification obligation.
- Unit collector tests use real restricted OMR/router with mocked manager/market/Hook. The separate
  actual-manager/Hook/market-state integration test closes their canonical-path coverage gap only when
  executed successfully on this exact source.
- No live chain runtime, recipient, owner threshold, health lease, activation or funding state was
  inspected. Repository implementation evidence does not establish deployment readiness.
- Independent adversarial review, final source hashes, fresh Forge fuzz/invariant results and static
  finding dispositions are retained separately by the parent review package.
