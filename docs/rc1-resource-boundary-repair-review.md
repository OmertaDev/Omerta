# RC1 estate harness transaction-boundary repair

Phase: second-batch release harness proposal only. Baseline `0438b3cba2843b075858ff6ae051a87046517d0d`; clean tested repair `d28fcd8d6665a5e7442220cb4877837c6e4de9d9`. Only `tools/rc1-resource-proof.js` and `tools/rc1-resource-capital.js` change executable code. Runtime, schema, journal arithmetic/snapshot utility, source inventory/pins, source-compatibility adapters, census, CI, package and generated artifacts remain unchanged.

## Cause and correction

Hosted jobs `115455524084` and `115455524149` failed their resource/capital estate scenarios with `item_transaction_required`: both harnesses manually acquired a client, began a transaction, assembled account/inventory helpers and invoked `runEstate`. The current canonical boundary intentionally requires an actual Items-owned transaction and the original sorted rental/actor/account death scope. A manually opened SQL transaction supplies neither.

The failing mutations are in `rc1-resource-proof.js` and `rc1-resource-capital.js`; `rc1-resource-journal.js` only reads a repeatable snapshot and performs exact reconciliation. Its independent snapshot transaction remains correct and untouched. Historical inspection of `f254c64a54a019665d7a516d382d56b46f2dcd82` confirms the existing two-character API already accepted `{meet:false}`. This is interface context, not a new historical qualification or normalized state claim.

Each estate fixture now invokes actual `G.withTwoCharacters` with an existing, distinct, living non-NPC fixture observer. The canonical wrapper owns the Items transaction, sorted counterpart/rental locks, account helpers, death capability and persistence. There is no outer BEGIN/COMMIT, nested transaction, client proxy, fabricated brand or manual persistence substitute. Victim, original account, cause string, step ordering, no-loot behavior and `naturalCombatDeath:false` remain unchanged. Explicit assertions verify the observer's original identity and unchanged balances, and reject any observer estate cash credit/charge. Campaign OMR/bespoke ownership and ammo/default equations remain intact.

Both tools reject ambient `DATABASE_URL`, remote endpoints and unapproved fixture roles before connection. Their existing fresh random database creation remains intact. Read-only preflight accepts the approved local `pilot_runner` ports `35439/35449` on PostgreSQL18.4 or the existing CI `postgres/pgcheck` loopback5432 on PostgreSQL16/18.4. Local evidence below is **18.4 only**.

## Source-pinned proof

Both complete campaigns ran first on the pristine baseline, using separate fresh owned databases. The exact original error reproduced at `campaign:canonical-death-and-replacement` (resource scenario146) and `death:canonical-estate-and-heir` (capital scenario66). Their first-failure before/after resource snapshots are identical apart from the pre-existing database boundary/clock fields; no unbranded mutation committed.

The clean committed repair then ran both complete fresh PostgreSQL18.4 campaigns: **159 resource scenarios** and **70 capital scenarios**, all passed, processes exited zero. Existing funding, escrow/terminal custody, actual sixty-second expiry, replay/race, deliberately failed original transactions, maturity, restart, original-heir restrictions and invariant checks remain exercised. The exact-decimal/missing-receipt/corrupted-internal-movement journal unit test also passed. Configuration negatives reject ambient and remote endpoints without contacting them.

The preserved outcome is `SCOPED_PASS`. The resource campaign deliberately still reports `REQUIRED_TRANSITION_PROOF_MISSING`; this fixture-assisted campaign does not replace the full resource simulation matrix or manufacture complete/historical release clearance. Hosted PostgreSQL16 and the final coordinator source union still need their normal checks. No new fault-injection scope, economic state normalization, funding, demand, authority, financial activation, external messages or provider transactions are introduced.

Focused review applied the repository's pinned Pashov boundary/execution/economic, Plamen state/callback/accounting, and Trail of Bits caller/specification/invariant passes as manual JavaScript adaptations. The concrete finding is a stale harness ownership assumption; the runtime brand remains enforced. No full upstream tool orchestration or broad security audit is claimed. Raw original failures, full retests, exact source/tool hashes and scoped manifests are retained in durable team evidence.
