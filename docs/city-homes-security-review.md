# Deed-backed City home directory review

Date: 2026-10-11. Phase: working-tree source review and disposable memory proof.
Initial authored source: `98c48c5abc68ffc8ac8c04ee793a11b0721f9eb5` on base
`1b63dfd8625a102fe57f36eafcb39f330a140d8c`.
Integrated predecessor: `df6b3e160648eebe1ceb063fa981646d1c0aae5e`.
The new server blob is `3bbab2eb5b1ac4cf66d61fd6c4dc11da05e13cdf`;
two exact import/registration inverses restore the complete preceding server
`7b32de9531c3d47ced6654175ec492afc81cc5cb`. The source base names the parent,
not a fictional committed revision of the new code. Release commits, independent
review, native qualification and deployed revision verification remain separate.

Scope: `src/cityhomes.js`, `src/routes/cityhomes.js`, the two server registration
lines, the additive closed Gateway contract and `test/city-homes-api.js`.
Historical qualification helpers transfer only unchanged predecessor guards.
They explicitly exclude this new authenticated projection and its native snapshot.
The authored homes delta changes no schema, index, deed/travel mutation, receipt,
worker loop, signer or financial rail. Incoming Warehouse and Crew source, schema, estate
and native proof inputs are retained from the independently reviewed predecessor;
its authority is not qualified by this read-surface review. All three sets of exact
server inverses and authority exclusions remain composed in the combined source.

`GET /v1/city/homes` requires existing bearer authentication and a living caller.
Its requested district is independent of the actual viewer district stamped in
the existing character/generation/district convention. Query fields are closed;
the six district IDs, opaque stored public street cursor and page size are bounded.
Default page size is 32, maximum 64. Cursor keys are 1–128 characters without C0/DEL;
a cursor must match a real stored key in the requested district. This does not reuse
today's claim alphabet: existing legacy Unicode deeds remain unchanged and pageable.
Public keyset order uses globally unique `name_lc`, stable across transfer/death.
Total counts canonical district records, not the page or duplicate own-home peek.

The bounded `myHome` peek includes an owned address outside the public page.
Both projections expose only street/key/district, owner name and finite actor kind,
mine and ownership labels. They expose no account UUID, wallet, balances, prices,
private rooms, upgrades, history, control, actor coordinate or movement authority.
Extracted or on-chain records have external ownership, null steward and mine=false;
they do not assert in-city ownership. Deeds without a living steward remain estate
landmarks. The current living heir resolves a surviving account-level deed.
Multiple living rows resolve deterministically by created_at descending then id.
Placement is explicitly illustrative, never a tracking or proximity claim.

Reads use the existing composed read boundary; native pools obtain a repeatable-read,
read-only snapshot. There are at most 65 bounded steward projections plus the page,
total, optional cursor and own-deed reads. Existing unique street-key and district
indexes suffice; no infrastructure or migrations were added. Private no-store and
Vary: Authorization headers also cover authentication and query refusals.

Review adapts the repository policy's pinned Pashov ownership/boundary methods,
Plamen lifecycle/state transitions, and Trail of Bits caller/specification/property
checks to this JavaScript read surface. This is not upstream orchestration, broad
SAST or contract/payment qualification. New execution, replay, payment, callback
and financial conservation authority are inapplicable: this route performs no write.

Node v24.19.0: the memory API proof passed actual claim/list/purchase transfer,
actual estate/heir, player/agent/NPC names, default/max bounds and 71-address pages,
out-of-page own home, malformed/cross-district cursor refusal, private field
exclusion, closed typed DTO, deterministic steward selection, current viewer
location, token revocation and resource/deed/ledger neutrality. A real stored legacy
Unicode record produces a nextCursor that the following real GET successfully uses.
An initial test-only revocation query named the wrong table; it was corrected to
the existing accounts.token_version field before the successful complete run.
Resolved finding CITY-HOMES-CURSOR-1 (P2), initial module blob c0c76180:
the cursor validator reused today's ASCII claim grammar although canonical legacy
deeds may contain Unicode. Such a read could issue a key its following request
rejected. Independent source review identified the mismatch. The correction treats
stored keys as bounded opaque literals and still requires the exact district/key
DB match. The real stored legacy-row pagination regression passed; no existing
asset was renamed and no claim/ownership authority changed.
Raw output: `%TEMP%/omerta-city-homes-memory-final.log`.
Current historical world and car-provenance tests passed their original controls
and added exact registration deletion/duplication/drift controls. Outputs:
`%TEMP%/omerta-city-homes-world-qualification.log` and
`%TEMP%/omerta-city-homes-car-provenance.log`.

The --postgres fixture requires CITY_HOMES_TEST_DATABASE_URL pointing to an explicit
named loopback test database (the CI omerta_query database is allowed), creates
an owned random schema, verifies actual application schema/version provenance and
drops only that schema after an owner check. Its additional native case holds a
real directory page read while a real canonical sale transfers the deed, then
checks coherent old snapshot versus a fresh HTTP read of the committed owner.
DB-free checks of the same native endpoint guard reject missing URLs, wrong protocol,
nonloopback hosts, the generic postgres database and unclassified database names.
No local native endpoint is available. This case has not run locally; hosted
PostgreSQL 16 and 18.4 current-source execution is required and remains pending.
No native locking/snapshot result is inferred from memory or historical transfers.

Normalized LF SHA-256 runtime pins:

| File | SHA-256 |
| --- | --- |
| src/cityhomes.js | 4748763673b2f1896459921c88bf4162dcc6f78bf3230388a1825ea062caba98 |
| src/routes/cityhomes.js | 24c40a06a9a82a93cfbacca476b928544af5f03d1897a120d85be65786c3dd6d |
| src/server.js | ac4d2d324d27f585477b29b1ee58031cfa8892d22ffbc4aa639e869dc8f01ab6 |
| src/agentgateway.js | 84b4dfbf47b78ec3470bd1bcd9521fc82688e5efcf2fa639d878c75134e6b644 |

The authored new HTTP surface uses package minor 1.4.0 under the existing Gateway
convention. Package/lock alignment, current client wiring, gates and measured
documentation checks passed locally on the combined source. Hosted qualification
and production version verification remain separate release steps.

The integration review also covers index blob
`1b3889d775409cc669fd8e29c8b613da0f2db901`, scene
`27db18d2543b505214dd06f8aff9e89b57c06cb0` and WorldUI
`2c01313476cedb50b8a588816115f6df2b48988d`. District-scoped first/page read
tickets, captured viewer identity, pre-send navigation/fare gates, owner/session
recovery after dispatch, confirmed deed handoff and accepted-only home intent
were independently reviewed. Existing mutations remain authoritative; historical
source transfers do not qualify this new transport or projection behavior.

All five complete local City browser components passed the initial authored
producer bytes at source 98c48c5a,
including real travel and lost-reply replay, claim/purchase/transfer, held deed
focus, identity teardown, real regional walking, home inspection and engine
fallback. A real 35-address directory issued pages of 32 and 3; its downstream
physical plots survived foreign inspection and a winning unrelated Refresh with
the same pose/handle and zero gameplay POSTs. Restoring only the old unconditional
scene first-page hydration made that actual assertion fail at 35 to 32 homes;
the isolated inverse passed its preceding canonical journey setup.

Local Fieldwork, 179 phone checks and stored-XSS checks passed. An actual installed
service worker with the same native controller delivered all four versioned
world assets as the final bytes, preserving the existing WorldUI cache-first and
Scene network-first policies and genuine offline predecessor fallback. These are
controlled disposable local proofs, not authenticated production gameplay or
hosted native qualification. Exact release-head checks and rollout evidence are
recorded separately in the pull request. The incoming index change only separates
Warehouse closure and loan cancellation receipts; its exact source delta was
independently reviewed. Final combined local and hosted checks remain required
after integration and the measured 44px Map-mode target correction.

The incoming reviewed Crew release adds its required native step and changes the
native limit from 20 to 30 minutes after recorded timeout evidence. This integration
retains that existing policy and its closed 50-step ledger; the homes proof remains
inside the original City command, with its explicit disposable database URL. The
GUI slice does not waive assertions, SQL ceilings or proof steps. Fresh combined
PostgreSQL 16 and 18.4 execution is still required.
