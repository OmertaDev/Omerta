# Data, transactions and the economy

OMERTÀ’s central engineering claim is not that the economy is simple; it is that every value
movement is attributable and reconcilable.

## State and persistence

PostgreSQL is the production authority. `schema.sql` contains the current fresh schema plus additive
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migrations needed by existing databases. `src/db.js`
applies the schema, stamps versions and uses `pg-mem` only when no `DATABASE_URL` is present.

The [generated schema catalog](generated/schema.md) lists every unique table and the source modules
that name it. Those usage edges are exact-name references; they are navigation leads, not a SQL
parser’s proof of read/write direction.

## Transaction spine

`src/game.js` provides the shared actor transaction machinery:

- `withCharacter` locks the living character and associated account state;
- `withCharacterRead` / `readCharacter` handle read paths without turning every poll into a write
  lock while preserving gameplay-sensitive accrual semantics;
- `withTwoCharacters` locks both actors in stable order;
- broader operations follow the repository’s declared lock order: characters, accounts, gangs,
  then singleton/escrow rows;
- post-commit hooks are non-fatal and do not roll back a successful economic action.

For any new two-party or singleton interaction, inspect the existing lock-order tests and run the
real-PostgreSQL concurrency harness. A sequential `pg-mem` pass cannot validate lock correctness.

## Lazy accrual

Energy, nerve, heat, income, upkeep, raids and similar clocks derive from timestamps when a player or
asset is touched. This avoids a global tick over every account. The tradeoff is that “read” can have
gameplay consequences, so read optimizations must preserve the semantic event even when they avoid a
write lock.

## Ledgers and reason vocabulary

Every cash, $OMR and other tracked movement writes a transaction with a stable reason string. Named
checks in `src/invariants.js` reconcile:

- character balances and escrow/pool identities;
- minted and burned $OMR;
- treasury, market, convoy, casino and other system-specific buckets;
- chain reserve and revenue mirrors;
- the reason vocabulary itself, so an unknown reason is an alarm.

The specialized graph in `tools/graph.js` traces `Module → Reason`, `Check → Reason`, balance levers,
pinning suites and design mentions. Use it for questions such as “who emits this reason?” or “which
signed lever is not pinned?” The broad graph in this directory answers where the module, test, table,
route, commit and PR sit in the larger system.

## Randomness and deterministic markets

Gameplay randomness is generated on the server and recorded in `rng_audit`. Clients never supply
roll values. Some market surfaces are deterministic by design—trade-goods pricing derives from a
published day/district hash—while casino, crime and combat outcomes remain server RNG.

`MARKET_SEED` is shared by the API and worker so both processes agree on deterministic draws. It is a
secret operational input and never belongs in the knowledge graph or committed configuration.

## Value domains

| Value | Authority and movement |
|---|---|
| Cash | Off-chain character/bank/escrow balances; extensively transferred, sunk and earned through gameplay. |
| $OMR | Off-chain ledgered game currency with explicit mint/burn/transfer rules; withdrawal becomes on-chain only through the gated voucher rail. |
| Goods, cars, boats and gear | Ownership records with domain-specific transfer/conservation checks; not all are §10.4 currencies. |
| ETH and external assets | On-chain value observed through confirmed events and mirrored into dedicated revenue/reserve tables. |
| Standing, reputation and progression | Non-currency state; can gate capabilities but must not be confused with a redeemable balance. |

Cash cannot be converted into $OMR through a general swap or laundering path. The documented window
is one-way $OMR to cash, subject to its till. Retired routes remain explicit and should continue to
answer stable retirement errors rather than silently reappearing.

## Money router and chain reserve

`src/router.js` declares the cross-source waterfall for real-value inflows and validates source
membership and mirrors. It intentionally does not move money; it states and verifies where each
source lands. `src/chain.js`, `src/fees.js`, `src/watcher.js`, `src/vig.js`, `src/treasury.js` and the
contracts own the actual legs.

Withdrawals are full-reserve backed. The backend debits through the ledger and issues an EIP-712
voucher only when the production chain configuration and reserve rules permit it. A claimed event
closes the accounting loop. As of the snapshot, production activation remains audit-gated; see
[decisions-and-risks.md](decisions-and-risks.md).

## Change checklist for money-moving code

- Identify the source, destination, currency and ledger reason.
- Use the correct transaction helper and global lock order.
- Make retries idempotent and distinguish “committed but response uncertain” from “not run.”
- Update or prove the relevant invariant and reason vocabulary.
- Pin every changed balance lever in tests and its signed decision source.
- Run the smallest unit tests, the specialized graph check and §10.4 simulation.
- For SQL or concurrency changes, run `pgquery`, `pgcheck` and the relevant real-PostgreSQL harness.
- For chain parity, run Foundry plus the applicable end-to-end encoding prover.

