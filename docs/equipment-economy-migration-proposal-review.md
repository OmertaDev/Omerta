# Equipment economy native migration projection proposal

Proposal source `fbfe9483132e2daec99f1efbaa6c098fe735b339`, frozen runtime base
`a4c2a63c86431862772beceec214ae22d441b6be`. Only three test files were authored:
new test/lib/equipment-economy-migration-catalog.js, its dedicated test, and the
minimal test/phase2-postgres.js composition/causal checks. No runtime/schema/CI,
historical City helper, existing literal event predicates or catalog JSON is
changed by the proposed commit. Actual catalog integration remains root-owned.

## Exact boundary

Current complete schema blob cdfd770c051424d6ef6d198cf25aad851fd21337 has SHA256
0f84bd62550030d065621637241e62e21d8f51820a57bd6cfb1e0bc4182e609a. Its exact
declared Windows CRLF representation is separately pinned. Predecessor
9adc01bea4963b89f12419126bd91bb5e7d57a55 has schema blob
dbca5a839e79ee66e5502fe7308270f9c7e28851 and SHA256
220780ae48a8a6ce9a3a1970110c4d420720c777c80217811c7166cf53e36390.
Git blob IDs, complete source hash and complete LF/CRLF text are checked before
projection. Unknown source, appended/mixed line endings and BOM refuse.

The complete current and predecessor item_events.item_event_kind native CHECK
definitions were independently compiled from their complete pinned schemas on
PostgreSQL18.4. Both exact full definitions are literal constants. The only
difference is escrow_relayed in the legacy branch; lot, unique and observation
branches remain intact. Normalization requires one uniquely named exact current
predicate and exact native CHECK type/validated=true metadata. It substitutes
the entire declared predecessor definition for that one row. There is no regex
stripping, wildcard predicate rewrite, generic current-schema normalization,
double projection or removal of equipment table rows.

Composition is equipment→unchanged City→complete original Phase2 oracle. The
existing City helper keeps its full source pins, original metadata assertions,
7/63/72 manifest and old predicate inversion. The old Phase2 seven-event literal
and all existing causal negatives remain unchanged. An explicit native causal
assertion confirms the unchanged City oracle rejects the current equipment
predicate without the new layer.

## Native evidence and catalog ownership

Dedicated unit controls pass for exact LF/CRLF source, unknown/mixed/BOM source,
unknown/reordered/previous predicates, missing/duplicate/renamed constraint and
wrong type/unvalidated metadata. All14 equipment table sentinel rows survive
unchanged. A fresh owned18.4 database equipment_migration_test_deea8b542d4b
independently executed full current and predecessor schemas and matched their
native predicates to the literal expectations. An actual NOT VALID constraint
was refused using its native metadata, without changing the expected oracle.

Root's independently captured candidate catalog was copied temporarily only
for proof. SHA256:
e60fc7a581bb21276c5176a2851e96fbc1d6a6bf429485a4510f36819e3a44b2.
It declares14 added equipment tables,122 constraints and132 NOT NULL bindings.
The tracked catalog was restored before committing; the proposal does not own
or publish this candidate. Root must separately review/pin/integrate it.

Fresh owned schema p2_definitions_22f00b3bb398af2613da0604908a18c6 in approved
loopback omerta_check passed the actual populated Phase2 definition upgrade,
twice-applied migration and unchanged content hashes/pointer. Exact original
complete catalog, seventeen original upgrade negatives, PlayerIntel controls,
City7/63/72 metadata/constraint negatives and frozen quoted-position controls
all passed. The new full-oracle causal pass rejects removal, alteration and
renaming of each122 constraint, removal/alteration of each132 native NOT NULL,
unknown additions on every equipment table and wrong event-kind validation/type.
Every new constraint stays visible; none is excluded as a migration exemption.

Preflights retained pilot_runner, PostgreSQL18.4, loopback35449, no ambient
endpoint, generated fresh schema ownership and exact parent-issued child timeout
options. The upgrade schema was dropped only after ownership verification. The
whole clean/scalar/missing-unique/lots suite and PG16 were not executed here;
this is exact predicate/catalog upgrade evidence, not whole release or gameplay
financial qualification. Raw source, catalog dependency, guards, logs and patch
hashes are retained outside the checkout. No real transactions, external messages
or financial activation occurred.

## Review and root apply

Applied the policy's Pashov c577eb7799c349de0acb187ba00ca98e14e436fd
boundary/periphery adversarial passes; Plamen
795962b96e254f2e423a2635fe7f8cb8ea1e6d69 state/catalog transition comparison;
Trail of Bits d3323cefbcf645678b8dc481de204b02ad3d02dc trust-boundary/specification
and native invariant/false-positive checks as manual JavaScript adaptations.
No upstream orchestration or whole-system audit is claimed. Syntax/diff and
unchanged runtime/schema/City-helper source checks pass.

Root should apply only the test/helper/review patch, preserve all historical
assertions and integrate its independently frozen catalog. The independent
SECOND source-transfer envelope is source-only and cannot supply this native
clearance. Any schema source drift requires a new exact pin and native retest;
do not widen the hash acceptance or infer an oracle from the upgraded database.
