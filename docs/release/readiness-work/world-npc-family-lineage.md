# Scoped original-worker NPC Family formation

The test-only classifier accepts one original `runFamilies → foundNpcFamily → createGang`
transaction, with a stable living NPC founder, exact §25,000 personal cash sink and its
immutable `gang:found` receipt, new boss membership, zero Family resource custody, and
the authored initial `war_pool=120000`. **War pool is nonmonetary standing, not a currency
mint or reward.** Matching state alone remains insufficient.

The adapter pins the original population, Family, ledger and rules source bytes. It
copies actual returned PostgreSQL queries, parameters, row counts, rows and original
caller frames before gameplay mutates returned objects. It binds their ordered, bounded
transaction transcript to the actual COMMIT event. The verifier checks source pins,
shortlist/locked-founder authority, exact native insert/update targets, receipt identity,
fee arithmetic, clock and zero-custody defaults. Unknown compound SQL stays unsupported.
Missing provenance keeps the earlier explicit NPC-formation unknown classification.
Other Family fields and movements remain unsupported with full restricted changed rows.

`createNpcFamilyCommitObserver({innerObserverFactory,onBoundary,...options})` wraps
inside the existing commit observer's query call. It delegates the one serialization
guard and lifecycle, preserving callback argument two (car witness), and appends NPC
Family provenance as argument three. It never issues SQL or takes snapshots. The
default inner factory is `createNativeCommitObserver`; the car factory can be supplied
by the world runner. This standalone proof does not edit that runner.

Run from a clean committed checkout with PostgreSQL available:

```powershell
$env:RC1_RESOURCE_DATABASE_URL='postgres://postgres@127.0.0.1:55438/postgres'
$env:RC1_NPC_FAMILY_OUTPUT='<fresh private directory outside the checkout>'
node test/rc1-native-npc-family-lineage.js --postgres
node test/rc1-world-npc-family-lineage.js $env:RC1_NPC_FAMILY_OUTPUT
```

The native proof creates its own database and declares 25 ordinary accounts with authored
birth defaults before baseline. NPCs, resources, eligibility and Families then come from
original worker callbacks. A declared prebaseline diagnostic trigger verifies the fee,
membership, cash write and standing update have occurred, then aborts the first eligible formation (which need not occur at boot).
The complete resource snapshot must remain identical after rollback. Removing that
diagnostic trigger permits two later original hourly callbacks to form Families, with an eight-hour
maximum; no
game status, deadline or resource is edited. All intervening worker callbacks, canonical
invariants, resource boundaries, unknowns, random tape, cleanup and source checks are
retained. Corruption controls alter owners, native inputs/results, source/caller binding,
receipt freshness/uniqueness, statement order and nonmonetary state. A separate adapter
control tests composition and PostgreSQL's aborted-COMMIT response without claiming it
as native evidence. The retained native inputs can be independently reverified.

The policy review applies the pinned Pashov execution/authority and invariant pass,
Plamen state/accounting and verified-hypothesis pass, and Trail of Bits context/property/
false-positive pass from `omerta-contracts/SECURITY-REVIEW-POLICY.md`. These are manual
adaptations, not claims of upstream orchestration or Solidity tools. Production code is
unchanged. NPC seeding/car grants, recruitment, war-pool regeneration/combat/payout,
other Family terminals, HTTP entry, full-resource conservation, matrix qualification,
chain/backing and deployment remain outside this proof. Actual run results are retained
separately and apply only to their recorded source revision.

Retained harness failures are separate from passing evidence: TOOL51 at `3bb7aada`
incorrectly required an eligible founder at boot. The later eight-hour maximum is a new
predeclared workload. TOOL52 at `8f8f0d6b` called canonical invariants through the raw
snapshot connection; that connection lacks the schema clock's session setting. The
corrected proof captures PostgreSQL's raw `42704` rejection before baseline and runs
invariants through the ordinary clocked connection. Snapshot reads remain uninstrumented
and read-only. Neither failure is a game accounting finding or an inherited pass.
