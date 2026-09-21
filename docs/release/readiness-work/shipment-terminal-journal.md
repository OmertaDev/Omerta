# Scoped shipment terminal and midnight proof

The isolated branch starts at root9e05bf08 plus the exact OMR proof/repair
commits, equivalent source at52f5257256f05945e15e171cc9615abeecfefdec.
Only the new journal, native test and this guide belong to this scope.
The production shipment, combat, estate and worker implementations are unchanged.

Run from clean committed source with a loopback administrative
`RC1_RESOURCE_DATABASE_URL`:
`node test/rc1-native-shipment-terminals.js --postgres --output=<new-private-directory>`.
The runner allocates and retains an exclusively owned PostgreSQL database.
It refuses shortened combat timers and external provider/chain configuration.

The midnight case fills the original city cap canonically to one remaining
share. A separate transaction holds the existing day row with `SELECT FOR UPDATE`.
Two distinct-owner canonical requests must reach their original day claim and
be blocked through that native lock. The artifact records the actual PostgreSQL
blocking graph. With those requests pending, the aligned application and SQL
clock advances one millisecond across midnight. Another owner's canonical take
commits in the new day before the old-day lock releases. Exactly one old-day
request succeeds; both stamped caps, owner takes and durable replay are checked.
The proof records request/completion order and this specific barrier ordering.
It does not invent a total commit order for concurrent queries.

Two canonical searches start before midnight. All original local worker callbacks
run through their unchanged three-hour deadline; a one-millisecond-early shot
is refused. Two fire requests exercise an eligible victim with odd material
and a victim below the loot floor. The actual combat outcome must be a kill:
there is no forced random outcome or post-baseline readiness rewrite. Exact
per-owner equations account for material transferred, material lost with the
dead character, and the heir's zero balance. Dead historical material fields
remain in restricted snapshots and never count as spendable custody. Existing
bespoke ownership survives; historical request receipts grant no second value.

The killer commissions one piece from looted material. A native output trigger
first aborts after the canonical cash receipt and serial allocation; balances,
outputs, receipts and serial counter must return exactly to the prior state.
The same request key then races concurrently and can create exactly one output,
consume the exact material/cash once, and replay without further value.

All eligibility, physical stats, cash, ammunition, equipped weapons and initial
material fixtures are declared before baseline. Canonical cash/ammo invariants
retain explicit offsets derived from those exact fixture writes. They never
derive an arbitrary drift allowance from an observed mismatch. Independent
per-owner equations reconcile every later cash/ammo receipt and the original
newborn defaults. Corruption controls alter copies of native artifacts, never
world rows: lost/wrong-owner loot, heir material, missing kill/take/debit authority,
rewritten caps, orphan serial and wrong receipt owner must fail.

No natural entry, apex-rout grant, network/browser, deployed compatibility,
complete resource matrix or release clearance follows from this bounded proof.
The initial loot branch uses declared material; city-take and commission flows
are canonical after baseline. The journal explicitly handles the estate deleting
the dead character's daily take rows while preserving the stamped city total.
Restricted artifacts retain those deleted rows and their canonical terminal cause.
