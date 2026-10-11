# Supply tender source review

Date: 2026-10-11. Phase: source review and local native proofs; hosted release
and deployment remain separate gates. Runtime module source
`cffa52f2ba2dd3527602972d003ce27284575029`, native deadline integration
`20426c079836b8e146848e1f943c823287100d43`, routes `baab6a2d`,
combined release wiring `2193ef69a42b32f1b9f61e2eb4ab26ad992c6f5c`.
Server blob `c102341216e7eb54b012d9dba41310116c21ec4a`.

Scope: authenticated publication, supplier offers, buyer award, withdrawal,
cancellation and private projections of existing funded depot supply orders.
Offers cover the full tender quantity at the existing order price. Publication
does not reserve stock. Award invokes the canonical delivery commitment and
reserves its quantity once; the existing order escrow is the sole funding.

Each offer records the supplier's own fixed spending limit, acceptance cutoff
and absolute delivery deadline. The native award transaction checks fresh
ownership, character liveness, availability, exposure, cash and deadlines.
Canonical sorted character/account locks precede depot, order, tender and offer
locks. Matching award retries return the recorded commitment. Changed terms and
withdrawn offers cannot silently revive authority. Existing owner control rules
apply to buyer actions; supplier signatures authorize only their own offers.

The shared board filters eligible funded orders before its bounded limit.
Buyers see their offers; suppliers see their own offer. Rival spending limits,
treasury and unrelated private history are excluded. No new cash, escrow,
crypto transaction, compute purchase or owner spending grant is introduced.

Review followed the repository agent-led security policy's ownership, replay,
state transition, adversarial and property checks. Independent integration
review found no confirmed funds, privacy or authority defect in this scope.
This is not a general audit of unrelated contracts or historical source pins.

Node v24.19.0 memory module/API and existing delivery regressions passed.
PostgreSQL 18.4 native module/API proofs passed, including two valid competing
awards with one winning canonical reservation and exact deadline preservation.
Migration definition checks passed against frozen catalog additions: seventeen
new constraint definitions and nineteen not-null columns, without replacing
existing expectations. Existing causal migration controls also passed.
Local test fixtures are isolated; no production actor or transaction was used.

Exact source reconstruction preserves the entire preceding decision-receipt
server and historical qualification pins. It does not qualify this new layer;
the current proofs and fresh required hosted checks cover the new behavior.
Financial activation remains disabled. Production revision and service health
must be verified separately after the exact checked revision is merged.

Hosted `96b7fc43` exposed a missing test-only market seed in the native module
fixture and omitted estate-census entries for the two immutable tender tables.
Repair `b7e7bd4165964c0573ba908b72292eb1be8a0efc` changes three test lines:
the seed is set only after the strict local database guard, and historical rows
are classified without wiping, reassignment or duplicate escrow. Migration and
fresh native PostgreSQL 18.4 retests passed. PostgreSQL 16 and complete hosted
qualification remain fresh release requirements; native authority is unchanged.

Further hosted qualification exposed the Director migration test's finite table
classification omitting these reviewed additive features. Test-only repair
c05b1e2c8c8adf86663c6dff7a640c0b8a93abdc recognizes only explicitly named
feature tables present in the frozen catalog, compares exact constraints and
nullability, and preserves the pinned baseline plus unknown-addition controls.
Native PostgreSQL 18.4 full-stack and new causal-negative retests passed;
partial-stack native PostgreSQL 16/18.4 hosted retests remain release gates.
