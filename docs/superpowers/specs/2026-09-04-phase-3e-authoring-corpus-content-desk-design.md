# Phase 3E — Mystery Authoring Pipeline, Starter Corpus, and Content Desk Design

**Date:** 2026-09-04
**Status:** Architecture approved; formal written specification awaiting user confirmation; implementation planning pending
**Depends on:** Phase 3A–3D runtime capabilities and validators; Phase 2 production economy, professions, facilities, projects, provenance, and item services
**Scope:** Safe mass-authoring workflow, automatic package discovery, production-quality starter corpus, evidence-board UI, operational promotion artifacts, and whole-corpus verification

## Outcome

Phase 3E turns the validated mystery engine into a production authoring platform and ships a deep first corpus. Independent content agents work in bounded namespaces and produce safe public graph packages in this repository. Separately authorized agents produce production private evidence, structured verifier data, and solution review material in an access-controlled overlay repository or secret artifact store. Trusted builds pair those inputs into sealed server bundles and safe public manifests. Authors cannot add runtime logic or activate their own work.

The first corpus targets twenty-four individual mysteries, ten Crew cases, four Family conspiracies, and one seasonal meta-mystery. Quality remains more important than quota, but the production floor is twenty individual mysteries, eight Crew cases, four Family conspiracies, and exactly one deep seasonal meta-mystery. Four is required because the approved seasonal convergence depends on all four Family arcs. Weak packages are removed or replaced; shipping below a floor requires an explicit user-approved scope amendment that also changes and re-proves the seasonal dependency/recovery design rather than an implementation-time decision.

The first-class Content Desk gains a responsive evidence board, records view, structured theory flow, organization hierarchy, contributions, and Phase 2 dependency context. The server remains the sole visibility and action authority.

## Binding invariants

1. Content packages are declarative data. Authors cannot add JavaScript, SQL, shell, executable templates, credentials, external publishing actions, or custom routes.
2. The corpus is discovered automatically from bounded package directories. A package cannot evade CI because a script forgot to list it.
3. CI uses the exact compiler and activatable-profile validation invoked by operator activation.
4. Every package has one stable namespace, monotonic version, exact dependency lock, explicit closed runtime capability profile, deterministic validation output, and an explicit kind: `experience`, `library`, or server-owned non-activatable `fixture`.
5. Source and build artifacts never activate themselves.
6. Private solutions and sealed graph truth are never committed to this public repository or included in public CI caches/artifacts, Docker contexts, npm packages, browser assets/source maps, API projections, logs, snapshots, or unauthorized review transcripts.
7. Every `experience` passes lore, runtime-mediated blind solvability, difficulty, exploit, graph, privacy, and integration review. Libraries pass lore/dependency/API-contract/economy review and consumer fixtures; fixtures pass expected-accept/reject validator review and can never activate.
8. Mystery crafting dependencies require reasoning about what must be produced. Packages must not reduce Phase 2 to obvious delivery checklists.
9. Content rewards remain gameplay-inert unless a separately reviewed Phase 2 finite source authorizes a value-bearing object. Phase 3 emits no OMR.
10. Dynamic critical paths have in-game recovery and do not require external archives.
11. The UI never infers hidden nodes, authority, correct links, or contribution eligibility locally.
12. Existing OMERTÀ tone, district geography, organization structure, economy, and character history remain canonical.
13. Human rationale and narrative prose are review material, never machine authority. The compiler evaluates only schema-validated structured verifier data and closed operators.
14. Blind solvability review runs the exact bundle in a runtime-mediated sandbox that exposes only normal per-audience projections and issued actions over time. A social experience uses a fresh blind cohort with one independently authenticated sandbox account per required account/role; each member sees only that audience and may collaborate only through the recorded in-sandbox communication channel. It never exposes a union of roles, future snapshots/frontiers, filesystem artifacts, database rows, logs, overlay data, canonical solution, or hidden dependency lock.

## Authoring repository contract

### Automatic discovery

The public compiler discovers safe packages below approved roots in this repository using a strict directory contract. The trusted compiler separately discovers matching overlays from an access-controlled root unavailable to public builds and ordinary authors. Both reject:

- nested executable files;
- unknown package roots;
- duplicate namespaces or namespace/version pairs;
- generated artifacts placed among source files;
- source packages omitted from the corpus manifest;
- corpus-manifest entries with no package;
- symlinks or path traversal escaping the content root;
- case-insensitive path collisions on Windows-compatible filesystems.
- public files, git objects, caches, source maps, Docker contexts, npm packlists, logs, snapshots, or reports containing private-overlay canaries or forbidden secret fields.

The root public corpus manifest declares supported schema versions, package categories, rollout groups, expected dependency-lock format, and the public side of the overlay contract. It does not manually list every package as the only discovery authority; discovery and manifest reconciliation must agree. Production overlays use an independent access-controlled manifest whose plaintext and private lock never enter this repository. Public CI compiles synthetic overlays and verifies only a signed non-oracular attestation ID/status supplied by trusted CI; raw production overlay/private-lock digests remain access-controlled.

### Package contents

Each public production package in this repository includes only:

- source manifest and graph data;
- public discovery metadata;
- theme, canon/lore-intent, district, tone, and continuity metadata with an assigned lore reviewer;
- public-authored narrative text and presentation-safe evidence shells;
- public role, audience-contract, contribution, and recovery declarations that do not reveal secret topology;
- Phase 2 item/profession/facility/blueprint dependencies;
- cross-package imports and exports;
- a safe public dependency lock and opaque trusted-overlay attestation reference after compilation;
- presentation-safe or synthetic test fixture describing valid public initial state;
- one or more presentation-safe negative or edge-case fixtures;
- public author rationale that contains no solution or hidden clue chain;
- deterministic public validation report;
- deterministic difficulty report;
- safe knowledge manifest;
- UI presentation metadata using allowlisted tokens only.

The separately access-controlled overlay for an `experience` includes private evidence bodies, hidden nodes/edges, structured canonical theory/verifier data, secret-bearing dependency entries, solution rationale, fairness explanation, recovery truth, and private validation fixtures. It contains data only: no JavaScript, SQL, shell, template code, arbitrary expressions, or executable plugins. The trusted compiler pairs public and private halves by namespace, version, `sourceHash`, overlay contract version, and `secretOverlayHash`; any mismatch fails closed.

Authored narrative, dialogue, and artifact copy use inert escaped text plus an allowlisted markup vocabulary. Length, Unicode normalization, localization keys/fallbacks, alt text, reading order, and expansion budgets are schema-validated. Text cannot interpolate secrets, SQL/HTML/templates, external active content, runtime queries, or executable links.

An `experience` package contains exactly one primary experience ID. A `library` package contains reusable lore, item, location, or historical definitions and has no primary entry point. A `fixture` package can exist only under server-owned test roots, is never activatable, and may use synthetic secrets. Activatable content uses only the closed `phase3_mystery` capability profile; it may depend on artifacts built under `phase2_economy` but cannot invent a hybrid profile name.

### Canonical solution contract

The access-controlled solution review document describes:

- intended reasoning chain;
- alternate valid reasoning paths;
- canonical structured theory;
- misleading evidence and why it remains fair;
- every irreversible choice;
- critical evidence audiences;
- item/facility/profession dependencies;
- recovery route;
- expected minimum systems, accounts, and time gates;
- allowed partial and incorrect outcomes.

Machine-verifiable truth is a separate structured overlay document with typed candidates, accepted outcome tuples, evidence/audience dependencies, terminal classes, recovery contracts, dynamic outcome classes, and exact IDs. The compiler hashes and validates this structure but never interprets the human solution prose, infers truth with an LLM, parses rationale with regex, or treats wording as authority. Ordinary authored answer regex is prohibited; accepted inputs use normalized exact values, finite enums, or bounded token sets. A future safe-pattern matcher requires its own reviewed RE2-like capability and is not part of Phase 3E.

The trusted compiler converts structured overlay data into sealed verifier IR and produces separately safe runtime projections. It does not serialize solution prose to players. `definitionHash`, `sourceHash`, `secretOverlayHash`, `dependencyLockHash`, `irHash`, `bundleHash`, and `publicManifestHash` follow the cross-cutting non-recursive hash contract exactly. Legacy database/server-internal `content_hash` columns map to `bundleHash`; public Phase 3 payloads expose only `publicManifestHash` or a safe public version and opaque cursor/action tokens, never the secret-bearing `bundleHash`.

## Subagent authoring workflow

### Bounded roles

Fresh specialized agents work on independent package paths after runtime contracts stabilize. Disciplined roles include:

- murder mystery author;
- historical conspiracy author;
- economic/forensic-accounting author;
- item and crafting puzzle author;
- location and property-record puzzle author;
- social-operation author;
- Crew-case author;
- Family-conspiracy author;
- seasonal-meta author;
- lore reviewer;
- blind solvability reviewer;
- graph consistency reviewer;
- difficulty reviewer;
- exploit and privacy reviewer;
- economy reviewer.

A public author receives a bounded namespace, dependency budget, allowed node/edge/adapters, difficulty intent, organization scope, Phase 2 economic budget, and exact public output path. A private-overlay author/reviewer receives the least access required in the separate controlled environment. Neither edits runtime code, schemas, shared library packages, other authors’ namespaces, activation state, deployment configuration, or copies private overlay material into public task messages or findings.

### Review sequence

Every production package passes the applicable steps below; blind solving and solution comparison apply only to `experience` packages:

1. schema compilation and automatic discovery;
2. lore review against existing OMERTÀ canon;
3. for an `experience`, runtime-mediated blind solvability using the exact sealed-bundle/player-view build identity, synthetic server state where needed, and only normal audience projections/actions as they become available; an individual experience uses one fresh solver, while a social experience uses the isolated-account blind cohort and recorded collaboration channel above; no solver has source/filesystem/database/log/overlay access or receives a union of roles or future state;
4. solution comparison and fairness review;
5. difficulty and complexity review;
6. exploit, privacy, and social-alt review;
7. economy and conservation review when Phase 2 dependencies exist;
8. full graph, universal critical-success, recovery, import/export, package-coverage, and OMR-boundary validation;
9. package integration tests on pg-mem and real PostgreSQL where runtime state is exercised;
10. final content-quality review.

The sandbox records an authenticated server-side transcript of each audience's issued projections/actions, solver submissions, and the cohort's allowed communication. It does not reveal the transcript to public CI or write it into this repository. Blind-solver pass requires the individual solver or cohort to reach an allowed **successful** terminal within the difficulty band's reviewed time, hint, interaction, and collaboration budget, without forbidden assistance; every necessary inference must be traceable to evidence projected to the audience that supplied it. Merely reaching abandonment, incomplete-but-restartable, narrative failure, or a recovery/restart terminal is not a solve. Required recovery paths are reviewed by continuing or restarting from that state through the normal runtime until the fresh solver/cohort reaches success within the separately declared recovery budget. Once a transcript contains a proposed or accepted solution, it moves directly to the access-controlled review store, where a separate authorized reviewer performs solution comparison. Any material player-view, sealed-bundle, verifier, evidence, recovery, or canonical-solution change after that comparison requires a fresh blind solver/cohort whose members have never received the comparison or solution; exposed members cannot certify the revision. Libraries instead require export/import consumer fixtures, lore and API-contract review, source/sink/economy review where applicable, and deterministic expected-use coverage. Fixtures declare whether validation must accept or reject them and are reviewed against that expectation; they are never blind-solved or activated.

Findings return to the author. A package is not integrated with unresolved Critical or Important findings. Two unsuccessful fix/review cycles trigger architecture or scope reassessment instead of unbounded patching.

### Parallelization limits

Content authors can run in parallel only when they own distinct package paths and consume stable shared contracts. Shared runtime, schema, library, or compiler changes remain serialized through the authoritative integration branch.

The working limit is three concurrent subagents plus the integrating agent. Every agent reports files, tests, validation hash, player-view artifact hash where applicable, and known assumptions. Public task reports use safe identifiers and contain no secret text, topology, verifier tuples, private hashes that act as equality oracles, or solution details. The integrator reviews actual diffs and reruns validation rather than trusting a textual completion report.

### Compiler-generated package coverage contract

For every activatable root `experience`, the compiler emits a deterministic coverage manifest over that experience and the complete transitive library closure, mapping structured obligations to at least one fixture, integration test, or experience-only blind-solver transcript. Every library also emits an export/use coverage manifest independent of any one consumer. Non-activatable fixtures emit an expected accept/reject manifest. Required classes where applicable are:

- every entry point, successful/recovery/incomplete/failure/abandonment terminal, and terminal export;
- every irreversible branch and declared recovery path;
- every role composition, distinctness scope, assignment generation, replacement path, audience grant/share, and required declassification transform;
- every theory outcome class, dynamic signal mode/outcome, import/export contract, consequence, and season relationship;
- every critical unique-item, material, profession, blueprint, facility, tool, service, contribution, and value-bearing adapter dependency;
- every reward/collectible/contribution beneficiary policy and replay boundary.

Activation rejects a root when any root or transitive-library manifest obligation is uncovered, references a missing fixture/transcript, or was suppressed manually. A library export cannot hide uncovered behavior merely because another experience imports one path through it. Mutation fixtures must prove the state transition, authority check, replay result, and conservation/recovery behavior, not merely that compilation succeeds. The safe public report exposes obligation categories and coverage status without exposing hidden node counts, secret IDs, answer cardinality, or topology; exact private coverage detail stays in the access-controlled report.

The canonical obligation set is embedded in the sealed IR before `irHash` is computed. Evidence mappings and test/transcript digests form a deterministic coverage report whose digest is bound into the access-controlled signed activation attestation, avoiding any self-reference in `bundleHash`. Activation recomputes the obligation set from the exact bundle, verifies every referenced artifact/digest and attestation, and refuses a stale coverage report from another source, overlay, compiler, dependency lock, or test build.

## Corpus architecture

The first corpus is organized into four connected arcs. Players encounter local mysteries first and should not initially know that the arcs converge.

A deterministic corpus inventory reports package kind, primary experience ID where applicable, selected candidate version, alias/supersession identity, arc, one primary scale, difficulty band, authored-text status, public/private pairing status, transitive libraries, fixture/test coverage, and rollout group. Floor counts use distinct accepted `primary_experience_id` values at exactly one selected candidate version and primary scale. Libraries, fixtures, aliases, archived/deprecated versions, compatibility-only legacy experiences, and multiple versions/hashes of one experience do not count; one experience cannot count in two scale columns. The acceptance gate reconciles the exact selected-ID/version list with automatic discovery and enforces the production floors without treating raw node count as a quality metric.

### Arc I — The Missing Street and the Sixth Family

This arc examines erased property, altered maps, false inheritance, and an organization removed from official history.

Individual mysteries:

1. **A Street Left Off the Map** — reconcile an old delivery route with a modern district map and identify a missing address range.
2. **The Deed Without a Parcel** — compare seals, property transfers, and tax records to show that a legitimate-looking deed describes no registered lot.
3. **The Undertaker’s Address** — use funeral records and contradictory addresses to connect several identities to one vanished block.
4. **Number Forty-Seven** — inspect architectural numbering and a repaired brass plate to determine which building absorbed a missing house.
5. **The Brick Behind the Wall** — determine which specialist inspection tool can reveal a concealed renovation without destroying the evidence.
6. **Names Under the Plaster** — restore and compare layered tenant records, revealing members of a Family that city history omits.

Crew cases:

- **The Surveyor’s Lie** — four roles compare a map, property ledger, street observation, and repaired instrument; one route follows the surveyor while another searches the records room.
- **The House With Two Front Doors** — six accounts investigate different entrances, ownership chains, and witness histories, then submit a shared building theory.
- **A Parish That Never Was** — a large Crew reconstructs a demolished parish boundary from private archival, financial, and physical evidence.

Family conspiracy:

- **The Sixth Family** — three distinct Crew outputs establish people, territory, and motive behind the historical erasure. Capos decide what to report; the Boss receives bounded findings, not every clue.

### Arc II — The Book of the Dead and Belladonna

This arc centers on staged deaths, funeral commerce, medical contradictions, changed identities, and the line between mistaken and manipulated testimony. Chemical references remain fictional and non-procedural.

Individual mysteries:

1. **Two Death Certificates** — identify why two official records describe the same death differently without assuming either is simply fake.
2. **The Empty Plot** — combine cemetery records and ground observations to determine who was never buried where the ledger claims.
3. **The Mourner in the Wrong Photograph** — date a wake photograph from physical details and find a witness who appears before their recorded arrival.
4. **The Physician’s Black Book** — perform forensic accounting on clinic payments and abstract medical supplies rather than simulating chemistry.
5. **The Widow Who Paid Twice** — trace funeral and protection payments that imply a staged death and a surviving obligation.
6. **Violets After Midnight** — connect a repaired historical object, a scent association, and contradictory testimony without teaching real poison production.

Crew cases:

- **The Funeral Train** — four roles inspect transport records, a vehicle modification, a cemetery transfer, and station testimony.
- **Five Witnesses at the Wake** — six accounts receive statements that are individually good-faith but context-dependent; the case resolves through timeline deduction.
- **Belladonna’s Account** — a large Crew combines clinic records, packaging provenance, territory distribution, and an archival device to distinguish criminal logistics from the staged-death conspiracy.

Family conspiracy:

- **The Book of the Dead** — Crew reports expose a registry used to erase living people and preserve dead identities. The final theory requires identity, motive, method, and supporting case outputs.

### Arc III — The Last Supper and the Hidden Sixth Object

This arc uses weddings, paintings, heirlooms, provenance, and inheritance disputes. It develops the hidden-sixth-object concept through material evidence and family history rather than a collectible checklist.

Individual mysteries:

1. **The Wedding Plate** — identify a table setting added after the official seating plan was printed.
2. **The Painter’s Debt** — compare pigment purchases, patron payments, and a later restoration to date a concealed figure.
3. **The Ring Returned Twice** — prove that two transfer records describe the same object at incompatible times.
4. **The Guest Outside the Frame** — infer an absent person through sight lines, reflections, and witness placement.
5. **The Heir’s Left Hand** — reconcile handwriting, clothing alterations, and an inheritance affidavit without relying on a single biometric clue.
6. **Silver Under the Varnish** — determine which Finework and archival processes can expose a hidden mount while preserving provenance.

Crew cases:

- **The Last Supper Photograph** — four roles reconstruct the event from photograph sections, catering accounts, a chauffeur route, and a restored frame.
- **The Sixth Ring** — six specialists determine what the legendary “ring” actually is, discover its production chain, and establish why five public objects imply a sixth.

Family conspiracy:

- **An Inheritance of Knives** — Family units compare rival inheritance theories, provenance chains, and historical decisions before making an irreversible but recoverable succession finding.

### Arc IV — The Ledger of Ashes

This arc joins old robberies, burned businesses, industrial supply chains, debt, vehicles, and financial conspiracies.

Individual mysteries:

1. **The Burned Inventory** — reconstruct what a warehouse held from purchase records and material residues rather than accepting the insurance list.
2. **The Robbery With No Victim** — trace a loss through businesses that all benefited from reporting it.
3. **The Foundry Clock Stopped** — use maintenance logs, work orders, and witness timing to disprove the official event time.
4. **The Loan That Outlived Its Debtor** — follow traded paper and repayments to a hidden beneficiary.
5. **The Warehouse of Empty Crates** — connect packaging, transport, and territory records to a shipment that existed only on paper.
6. **The Accountant at the River** — reconcile destroyed ledgers with bank, market, and item-provenance receipts to find the surviving account book.

Crew cases:

- **Engines in the Chapel** — a mixed Mechanics, Machining, Presswork, and investigator team identifies vehicle components disguised as restoration materials.
- **The Ash Ledger** — a large Crew operates parallel financial, industrial, transport, and witness branches, with one mutually exclusive surveillance decision.

Family conspiracy:

- **The City Owes a Dead Man** — four Crew findings show that old robberies, false claims, and business transfers funded a durable hidden obligation.

### Seasonal meta-mystery — The City That Forgot

The seasonal case does not announce its full dependency graph at discovery. Public metadata says only that durable findings from the four Family conspiracies can converge into a city-scale historical theory. Their exact relationship, required synthesis, accepted theory, hidden dependencies, and solution live exclusively in the access-controlled overlay.

The meta-mystery requires:

- exact-hash Family case outputs or in-game archival recoveries;
- several Phase 2 professions and crafted investigative tools;
- hierarchical report comparison;
- at least one dynamic city-state snapshot;
- a structured multi-field final theory;
- one consequential narrative choice with several fair interpretations;
- no production OMR reward.

Completion grants only reviewed gameplay-inert historical recognition and durable narrative facts. A later separately approved Phase 4 package may import one of those neutral durable facts through the ordinary typed import contract. Phase 3 defines no vault, reward connector, reserved OMR node, adapter, placeholder, or dormant OMR authority.

## Phase 2 integration principles

Crafted-item dependencies are deductions, not errands. A case should normally require players to infer what property an object or process must provide before the recipe identity is revealed.

Approved patterns include:

- infer that a photograph needs non-destructive glass-negative examination, locate blueprint fragments, obtain a Finework/Presswork service, then interpret the result;
- reconstruct a false deed’s period-specific printing method, identify the correct press tooling and paper provenance, and compare the output rather than simply deliver paper;
- determine that a wall contains a concealed mechanical void, commission a precision instrument across Machining and Finework, and choose where to inspect;
- establish that a historical vehicle required a specialty component, trace salvage provenance, repair the component, and use its wear history as evidence;
- identify the correct archival stabilization or medical inspection process from clues before accessing its recipe or specialist service;
- use item provenance, repair history, and source lots as reasoning evidence rather than arbitrary possession gates.

Rejected patterns include “bring ten steel,” “own any masterwork item,” unexplained profession-level walls, random quality gates, destructive use of an irreplaceable object with no recovery, and crafting requirements that exist only to lengthen playtime.

Every economic dependency declares source, use, sink, recovery, trade/service path, expected price/time band, and whether the item is consumed, escrowed, worn, or merely inspected. Economy simulation includes mystery demand.

## Difficulty bands and budgets

Internal bands are:

- **Street** — focused individual deduction using one or two systems;
- **Made** — multi-step individual or small Crew case with branching or one specialist dependency;
- **Boss** — large Crew or compact Family content spanning several systems and private evidence;
- **Commission** — multi-Crew conspiracy with hierarchy, production, dynamic facts, and irreversible decisions;
- **Omertà** — season-level synthesis demanding deep game knowledge, organization, recovery awareness, and reasoning.

Each package declares an intended band and soft budgets for nodes, evidence, branches, accounts, professions, unique items, time gates, and cross-package imports. Exceeding a budget requires review; it is not automatically invalid.

Automated difficulty reports estimate graph depth, distinct systems, accounts, professions, branches, critical items, irreversible decisions, time gates, and coordination. Blind solvers and reviewers judge intellectual quality.

## Content Desk information architecture

### Primary views

The first-class Content Desk adds:

- **Cases** — discovery, blockers, forming/active/completed runs, season context, and next issued action;
- **Evidence Board** — authorized evidence, player-proposed links, deductions, and theory readiness;
- **Records** — documents, photographs, statements, transactions, and historical snapshots in an accessible searchable list;
- **Production** — mystery-relevant blueprints, inferred requirements, service orders, facilities, and item provenance without exposing unknown recipe identities;
- **Organization** — roles, Crew assignments, child cases, Family outputs, contribution eligibility, and hierarchical blockers;
- **History** — completed cases, durable facts, recovery provenance, choices, and gameplay-inert mementos.

Navigation appears only when the active package has the corresponding capability. Existing linear stories retain the current timeline-focused experience.

### Evidence board interaction

The graph board uses a deterministic server-informed layout keyed by safe stable IDs, chapter, and entity kind. It does not use hidden nodes to place visible nodes. Client-side physics cannot reveal hidden mass or edges.

Players can:

- select an evidence card;
- filter by evidence kind, chapter, source, audience, and unresolved status;
- propose an allowlisted relationship between visible entities;
- add a short inert note;
- withdraw their proposal;
- inspect supporting/contradicting proposals visible to them;
- open a structured theory when issued by the server.

The UI never displays “correct” styling unless the server returns an authored public outcome. Ambiguity remains visible as competing theories.

### Privacy presentation

Evidence cards label their safe audience: private to you, role-held, shared with the case, Crew report, or Family report. Unauthorized evidence is absent unless the package supplied an explicit placeholder.

Counts, progress bars, board extents, empty states, search totals, keyboard order, and loading skeletons use only the viewer’s safe projection.

### Accessibility and responsive behavior

Every new Content Desk surface must conform to WCAG 2.2 AA under the complete program-wide criterion matrix. The evidence board has a semantically equivalent list/table view containing every visible node, relationship, status, detail, and action; no action is graph-only. Creating, editing, selecting, and deleting a relationship has a non-drag keyboard workflow with explicit source, relation, and target controls. Focus order is deterministic, textual relationship descriptions are programmatically associated, and color is never the only indicator of evidence kind, contradiction, privacy, or state.

After refresh, stale replacement, modal close, action completion, deletion, or view switch, focus returns to the triggering control or the nearest valid deterministic successor. Status, blocker, stale, error, window, and completion changes use appropriately scoped live regions without repeatedly announcing the whole board. Loading skeletons and empty states expose no hidden counts, dimensions, labels, timing differences, or inaccessible focus targets.

Desktop can show board, detail, and theory panes. Narrow/mobile layouts use one pane at a time with persistent breadcrumbs and a safe back stack. The UI reflows without loss of information or two-dimensional page scrolling at 320 CSS pixels and remains usable at 400% zoom and 200% text resize. It tolerates the exact 1.4.12 overrides—line height 1.5 times font size, paragraph spacing 2 times, letter spacing 0.12em, and word spacing 0.16em—without clipped or lost content. It supports portrait/landscape orientation without an unnecessary lock, forced-colors mode, prefers-reduced-motion, visible and not-obscured focus, 24-by-24-CSS-pixel targets or documented 2.5.8 exceptions, high contrast, long localized strings, right-to-left-safe ordering where the application supports RTL, and authored text expansion without clipping. Hover/focus supplemental content is dismissible, hoverable, and persistent where 1.4.13 applies. Touch and pointer behavior never removes the equivalent keyboard and screen-reader operation.

Content timers and social coordination windows comply with 2.2.1 by offering adjustment/extension where the timing is not essential. A package may use the essential exception only for a reviewed mechanic whose outcome fundamentally depends on real-time coordination and which provides the compiled retry/recovery contract; the Desk exposes and announces its deadline, expiry, and recovery without requiring perception of animation.

Verification combines the applicable/N/A WCAG 2.2 A/AA conformance matrix with automated axe checks, Playwright keyboard-only journeys for every action in both graph and list/table views, focus-restoration/not-obscured assertions, hover/focus-content and target-size checks, orientation, timing, forced-colors/reduced-motion/reflow/text-resize/exact-text-spacing snapshots, and manual task-based NVDA with Chrome plus VoiceOver with Safari (or documented project-supported equivalents). Every matrix row names its evidence owner/artifact or reviewed N/A rationale. Manual evidence records the exact browser, assistive-technology version, player-view artifact hash, task transcript, failures, and retest result.

### Refresh and concurrency UX

The Desk consumes opaque audience-bound projection-cursor deltas and falls back to a full safe snapshot when directed. A stale action preserves the player’s unsubmitted local note where safe, replaces authoritative state, explains the changed visible blocker, and requires reconfirmation before resubmission. Hidden-only mutations leave an unauthorized viewer's cursor, issued actions, snapshot bytes, delta, cache result, search counts, skeleton, empty state, and error/stale behavior unchanged.

No optimistic UI marks an item consumed, evidence shared, link committed, role replaced, or theory accepted before the server response.

## API and payload budgets

Existing content endpoints remain the entry surface. Packages expose capability-versioned safe projections, paginated board regions/records, opaque audience-cursor deltas, and server-issued actions bound to exact visible/domain preconditions rather than a projected global revision.

Payloads have reviewed limits for:

- evidence body and authored-note length;
- board nodes and links per page;
- theory candidates;
- participant and unit summaries;
- delta history window;
- image metadata and approved static assets;
- search result count.

Search operates over the viewer’s authorized projection. Server-side indexing cannot return hits or counts for hidden evidence. Projection, search, pagination, cursor, and cache keys use the complete cross-cutting audience binding plus exact case/board/record resource and normalized Content Desk query/filter/sort/page/region/locale identity; queries build the authorized relation before filter/count/sort/page, never after retrieving a hidden superset. Browser tests replay equal-generation cursors across different cases, organizations, boards, filters, pages, and locales and require safe rejection with no cache contamination.

The browser never downloads server bundles, answer specifications, private solution files, sealed signal values, or dependency-lock sections that reveal secret structure.

## Validation and generated reports

Corpus validation runs in deterministic stages:

1. automatic filesystem discovery and manifest reconciliation;
2. strict schema and executable-content rejection;
3. exact dependency resolution and lock verification;
4. package-local structural validation;
5. cross-package graph and export/import validation;
6. source/sink, item, profession, blueprint, facility, and recovery validation;
7. private audience and information-flow analysis;
8. social composition and contribution analysis;
9. dynamic/cross-season validation;
10. difficulty approximation;
11. OMR and economic-boundary validation;
12. compiler-generated package-coverage reconciliation;
13. sealed/public artifact separation, public-source secret scan, and reproducibility checks.

Designer reports include:

- unreachable and conditionally reachable nodes;
- entry/terminal and recovery witnesses;
- missing sources, sinks, or service paths;
- critical unique items;
- private evidence flow and required shares;
- minimum accounts, Crews, roles, professions, systems, and time gates;
- irreversible choices and soft-lock exposure;
- package fan-in/fan-out and cross-season depth;
- explicit `sourceHash`, `secretOverlayHash`, `dependencyLockHash`, `irHash`, `bundleHash`, and `publicManifestHash` identities without recursive/self-inclusion;
- public/private pairing and coverage-manifest status;
- economic demand/sink summary;
- warnings for shallow, repetitive, or excessively linear content.

Reports use compact predecessor witnesses and component summaries rather than copying a full path to every node. Safe public reports expose only approved categories, public IDs, and aggregate statuses that cannot reveal hidden cardinality or topology. Secret-bearing path witnesses, declassification flows, exact verifier coverage, overlay hashes that could become public equality oracles, and solution comparison stay in the access-controlled report store.

## Scale fixtures

Non-activatable test packages include:

- a valid 10,000-node mixed-component graph;
- a long linear graph to prove iterative traversal;
- high fanout/fanin graphs;
- valid and invalid production cycles;
- adversarial mystery prerequisite cycles;
- many-package dependency graphs;
- role-composition constraint fixtures;
- private-evidence noninterference fixtures;
- destructive unique-item recovery fixtures;
- cross-season import and migration fixtures;
- malicious content and path traversal fixtures.

CI records compile time, activation-validation time, peak memory, bundle size, safe projection size, action frontier work, and database query budgets. Budget regression fails CI at reviewed thresholds rather than silently normalizing quadratic growth.

## Economy and population simulation

Corpus-wide simulation includes:

- material demand created by mystery tools and repairs;
- blueprint and profession demand distribution;
- facility capacity and service-order pressure;
- unique-item bottlenecks and recovery availability;
- item consumption and durability sinks;
- small-, medium-, and large-population completion feasibility;
- Crew and Family composition availability;
- players joining mid-season or missing prior seasons;
- repeated-run and alt-account pressure;
- zero OMR movement and no unexpected cash/item emissions.

The simulation flags a mystery that monopolizes a critical material, makes one profession economically dominant, demands more rare items than sources can support, or becomes impossible at realistic population levels.

## TDD and verification

Each runtime/UI slice and each package starts with failing tests. Final Phase 3E evidence includes:

1. package discovery, manifest reconciliation, path safety, and deterministic build tests;
2. activation parity tests proving CI and runtime accept/reject identical artifacts;
3. sealed/public artifact and secret-scanning tests across working tree, git objects/index, compiler caches, CI artifacts, test output, source maps, Docker contexts, npm packlists, browser bundles, logs, snapshots, and reports;
4. one complete integration test per production package;
5. cross-package and cross-season chain tests for every Family and seasonal dependency;
6. blind-solver review record per `experience` containing every isolated audience/player-view artifact identity, the retained runtime and permitted-collaboration transcripts, a trace from every necessary inference to the projecting audience's evidence, successful-terminal budget result, recovery-through-success result where applicable, and canonical-solution comparison only in the controlled review environment; any material post-comparison revision is certified by a fresh unexposed solver or cohort;
7. lore, difficulty, exploit, privacy, and economy review results;
8. browser tests for board, records, theory, production, organization, history, stale refresh, empty states, and errors;
9. complete WCAG 2.2 A/AA applicable/N/A matrix plus axe, keyboard-only Playwright parity for every action, focus restoration/not-obscured and live-region checks, orientation, hover/focus content, 24-by-24 target size or reviewed exceptions, timing adjustment/essential-exception recovery, forced colors, 400% zoom/320-CSS-pixel reflow, 200% text resize, exact 1.4.12 text spacing, reduced motion, localization expansion, responsive/mobile-browser tests, and documented manual NVDA/Chrome plus VoiceOver/Safari (or supported-equivalent) evidence;
10. projection privacy tests at the API and rendered-DOM/network-fixture levels;
11. pg-mem full suite;
12. real PostgreSQL clean-start, migration, backup/restore, constraint, transaction, and concurrency suites;
13. 10,000-node compiler/runtime scale tests;
14. economy and population simulations;
15. red-team fixtures for item, role, evidence, contribution, reward, graph, and OMR attacks;
16. full repository test suite.

The activation test suite also rejects every package with an uncovered compiler-generated obligation across entries, terminal classes, irreversible branches, recoveries, roles/generations, audiences/shares/declassifications, theory outcomes, dynamic modes/outcomes, imports/exports, critical items, contributions, value adapters, and beneficiary policies. Each mutation obligation requires a state-transition/replay/conservation fixture.

Visual snapshots contain only synthetic public fixtures. Canonical answers and production private evidence never enter snapshot artifacts.

## Promotion and rollout preparation

The branch prepares immutable artifacts and validation evidence but does not activate them. A later explicitly approved rollout would:

1. verify the exact branch commit and clean test evidence;
2. build byte-for-byte reproducible artifacts;
3. compare recorded `bundleHash` and `publicManifestHash` identities inside the authorized artifact registry;
4. register artifacts without activation where supported;
5. activate a reviewed rollout group explicitly;
6. monitor privacy denials, runtime errors, frontier work, stale rates, and recovery use;
7. pause new instances by hash if necessary while preserving active read/recovery paths.

No author, subagent, build command, migration, or application startup automatically promotes content.

## Whole-corpus red team

The final review explicitly attacks:

- hidden evidence in browser bundles, source maps, API caches, errors, counts, and logs;
- brute-force theories and unlimited attempts;
- role and distinct-account bypass;
- passenger contribution eligibility;
- item, salvage, crafting, service, trade, escrow, and repair replay;
- unique-item double ownership or destructive dead ends;
- cross-Family scope injection;
- child receipt and cross-season fact substitution;
- content version reward duplication;
- dynamic signal privacy leaks;
- path traversal, executable content, prototype pollution, and oversized package denial of service;
- graph cycles, impossible branches, and population soft locks;
- economic inflation and profession monopolies;
- hidden cash, OMR, transaction-ledger, or NFT-export movement.

## Compatibility

- Existing activated stories and workshops remain exact-hash runnable and keep their current UI capabilities.
- New Content Desk views are capability-gated and retain the existing linear/list fallback.
- Existing Content Desk style, authentication, routing, error conventions, and mobile shell are extended rather than replaced.
- Existing Phase 1 direct world-graph routes remain compatibility surfaces.
- Existing items, organizations, mastery, season clock, story flags, and collection history retain their authorities.
- No old package is rewritten merely to satisfy new corpus conventions; a new version is authored when migration is desired.

## Acceptance criteria

Phase 3E is complete only when:

- automatic discovery finds every package and prevents CI omission;
- every public production package has safe source, authored narrative text, fixtures, an exact safe public lock subset plus opaque trusted-build attestation, deterministic safe reports, and review evidence, while every `experience` has a matching access-controlled solution/verifier overlay, private exact dependency lock, and private report that never enters this repository;
- every `experience`, `library`, and `fixture` obeys its discriminated entry-point and activation rules and uses only the closed capability profiles;
- every compiler-generated package obligation is covered by a named fixture, integration test, or exact-artifact blind-solver transcript, with activation rejecting coverage gaps;
- the accepted corpus provides deep individual, Crew, Family, and seasonal play targeting 24/10/4/1 and never below 20/8/4/1 without an explicit user-approved scope and seasonal-dependency amendment; the discovery-reconciled inventory counts distinct accepted primary experience IDs at one selected version/scale and contains no weak quota filler;
- each arc uses Phase 2 production through deduction and provenance rather than shallow delivery tasks;
- the Content Desk supports private evidence, records, proposed links, structured theories, production context, organization hierarchy, contributions, and history accessibly on desktop and mobile;
- every Content Desk action has graph/list-table parity and every new Desk surface conforms to WCAG 2.2 AA through the complete applicable/N/A matrix, owned automated/manual evidence, and the explicit orientation, timing, hover/focus-content, focus-not-obscured, target-size, zoom/reflow, text-resize, exact-text-spacing, forced-colors, localization, and assistive-technology gates;
- no private content appears in browser assets, unauthorized projections, logs, snapshots, counts, or errors;
- no production secret appears in this public repository, public CI caches/artifacts, packaging contexts, source maps, test reports, or public review transcripts;
- graph, privacy, social, dynamic, cross-season, economy, and difficulty reports are clean or contain only explicitly accepted warnings;
- the synthetic 10,000-node and adversarial package suites pass within approved budgets;
- economy and population simulations show playable demand, adequate recovery, no dominant unintended path, and no uncontrolled inflation;
- pg-mem, real PostgreSQL, concurrency, browser/mobile, API, backup/restore, and full repository suites pass;
- the final strongest available whole-branch reviewer finds no unresolved Critical or Important issue;
- the branch stops before merge, production push, deployment, content activation, OMR reward activation, or NFT contract deployment.

## Non-goals

- Raw node count is not a success metric.
- Phase 3E does not create thousands of filler nodes or hundreds of unreviewed mysteries.
- It does not let agents bypass the compiler, reviewers, or operator activation.
- It does not make every mystery a cipher, cyberpunk puzzle, fetch quest, or combat grind.
- It does not require external community history for critical progression.
- It does not enable production cross-Family diplomacy.
- It does not grant OMR, activate a seasonal OMR vault, or deploy NFT contracts.
- It does not broadly NFTize evidence, materials, blueprints, or routine crafted items.
- It does not merge to main, push a production release, deploy, or activate content without the user’s later explicit approval.
