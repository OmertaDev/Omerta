# Native ETH rewards — periphery context

Scope: proposed source integration on PR310 base
`d70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e`, dirty isolated checkout. No chain
transaction, production service change, activation or database operation is part
of this work. Final review pins and release qualification belong to the parent
review package; the October 29 reports remain historical evidence only.

## Behavior and callers

- Preserve the fixed 350-bps base allocation (127/51/76/96), separate 50-bps
  rewards allocation, 50-bps surcharge ceiling and separately rounded POL dust.
- The collector receives manager bucket 4. Native ETH funding is independent of
  conversion health. OMR conversion uses the canonical runtime-pinned route,
  caps, fresh market information and a Safe health lease.
- Each deposit has a 30-day minimum withdrawal lock. Every unwithdrawn principal
  amount continues earning by stake-seconds after maturity without renewal.
  Partial withdrawal removes only the withdrawn amount's future weight. Closed
  30-day reward periods require finalization before claims.
- The auction reader and unsigned operation tools require separate collector and
  staking runtime pins, reciprocal bindings and 30-day constants. Existing NFT,
  allocation, recovery, freshness, native-clock and source guards remain.
- The browser deployment client preserves all five trusted creation templates,
  the Hook's 10-argument/16-word constructor and per-transaction approval gates.
  It requires independent owner-approved collector/vault runtime SHA-256 pins,
  verifies reciprocal runtime bindings and rejects missing approvals.
- The full guarded deployment planner deploys the Hook before the native
  collector, registers the vault as typed custody and the collector as
  receiving-only, binds the distributor once before sealing and leaves both
  staking activation and conversion dormant.
- Dedicated ETH keeper jobs use the existing transaction journal, typed calldata,
  one-block reads, simulation and persisted last-service fairness. Disabled ETH
  flags also prevent replay of journaled ETH transactions. The existing worker
  has an independent 60-second timer; no new worker service is introduced.
- Authenticated player routes read the account's linked wallet and prepare only
  fixed register/approve/stake/mature-withdraw/claim actions. The browser encodes
  complete intent independently, simulates and rechecks wallet/chain/expiry. User
  wallets send transactions. No server signing key or game ledger debit is used.

## Trust assumptions and explicit limits

All production opt-ins default off. The public browser rewards approval remains
`null`. Public fixtures and synthetic providers do not establish deployment.
The current five-deployment browser route expects pre-existing approved native
dependencies, while the collector constructor requires its actual canonical
Hook to exist. A collector for that route's future Hook cannot be predeployed
before the Hook. The route therefore stays blocked pending a separately reviewed
dependency/deployment sequence; this patch does not authorize or enable it.

The optional player UI needs a reviewed replacement OMR address/runtime and an
accepted manifest. It verifies the token's sealed policy and vault custody role;
ordinary ledger balances or an older token are not substituted. Keeper execution
requires PostgreSQL and a separate keeper credential only after all opt-ins,
manifest digest and policy checks succeed. No production PostgreSQL behavior was
exercised in this periphery task.

The ABI pack travels with runtime code and fails closed on digest mismatch. Its
offline generator verifies current compiler metadata, all dependency source pins
and approved dependency mounts. Changed sources require regeneration. Trusted
browser bytecode generation and historical source-projection qualification remain
separate parent-owned steps.

## Focused verification

Passed locally against synthetic RPC/providers: native keeper (11 groups), ETH
upkeep/fairness (8), readiness (11), worker gating (10), player preparation (12),
isolated browser player checks (16 total groups), bundled ABI integrity (10),
generic keeper, current copy, independent environment classification, auction
reader, unsigned auction operations and trusted browser deployment-client tests.
The market deployment planner passed 25 artifact-backed synthetic checks.

Browser screenshot output is `output/pr310-native-eth/eth-staking-player-mobile.png`;
all outbound browser requests were aborted. No historical evidence was replaced.
The full guarded player deployment suite initially could not start because its
compiled `PositionManager` artifact was absent; final artifact-dependent results
are recorded by the parent release verification. Full Solidity, static analysis,
source projection and final release checks are outside this periphery-only log.
