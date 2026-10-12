# City gameplay source scope and qualification

Date: 2026-10-12. Phase: local candidate implementation and bounded local proofs.
Base: `727df2f02b2d0e5031b4c5a4516144de67aba0a8`, branch `codex/city-gameplay-expansion`.
This records scope and evidence limits; it is not a release or deployment attestation.
The separately verified PR252 map-affordance release does not qualify these new gameplay authorities.

The ten mechanics are district story arcs; functional deed interiors/storage/workbench; learned
skill challenges; real NPC favors/trust; staged Crew missions; tactical district PvE drills;
hidden evidence/secret content; permanent choice/heat consequences; server-clock timed cases;
and hosted furnishing puzzles with explicit guests. Existing cosmetic hideouts/outfits are separate.

Source scope includes `src/content/district-story-arcs.js`, `staged-crew-missions.js`,
`city-world-opportunities.js`, their canonical manifest/policy and presentation integration;
`src/mysteries.js`, `src/worldgraph-validate.js`, `src/city-world-opportunity-adapters.js`,
`src/city-world-opportunities-contract.js`, the private opportunity domain/router;
`src/city-home-interiors.js`, its contract/router and deed/estate integration;
`src/city-encounters.js`, its contract/router; additive schema, gateway/server registration;
and the City/Fieldwork/Home/Adventure client panels. The census measures 20 graph packages,
151 nodes and three existing recipes. This expansion grants no new cash/$OMR reward source,
chain export, signer, worker rollout or financial activation authority.

NPC mutations reserve the native receipt before sorted actor locks, then revalidate authenticated
owner and living target generations/district. Favor is persistent and bounded 0–3; client fields
cannot nominate account authority or a trust score. Hidden native nodes stay private until discovery.
Start publication and guarded acceptance share native predicates. One-time positive heat effects
are bounded by the existing loud-crime value of 6 and participate in transaction rollback.
Fixed recurring windows use server context time and stable definitions. Exact-key ACK recovery
preserves its immutable result; fresh keys recheck actors. Explicit old-version cancellation uses
stored original authority solely to return custody, without interpreting current/retired effects.

The current opportunity API/control entry passed disposable pg-mem playthroughs for all nine
packages, three learned approaches, quiet/public branches, secret pass consumption, four timed
cases, guarded unavailable starts, freshness and replay. Its custom NPC custody fixture passed
post-effect/post-release compensation and dead/changed-generation v1 recovery against a v2 registry.
Independent memory retests closed two start-admission findings: unavailable offers previously
created instances, and new-key repeated starts previously bypassed target freshness. Legacy
`test/mysteries.js`, `test/worldgraph-validation.js` and `worldgraph:check` passed separately.
Generic package IDs remain public; that does not disclose hidden clues or admit generic NPC starts.

`test/city-world-opportunities.js --postgres` requires its explicit disposable loopback URL,
creates and verifies an owned schema, and enables actual concurrent duplicate transactions.
Without that URL it fails before any memory fallback, even with an inherited `DATABASE_URL`.
Memory compensation is not PostgreSQL concurrency qualification. The isolated API proof uses
test account-header authentication; whole-app JWT and browser evidence have separate scope.
Other Home/Crew/PvE evidence and predecessor compatibility retain their own source limits.
Final native database, independent combined review, release gates, migrations, worker compatibility
and exact production revision/behavior verification remain pending for this source expansion.
