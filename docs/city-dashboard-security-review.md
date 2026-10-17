# Dashboard game parity: final security and regression review

Final review date: 2026-10-16. Phase: combined implementation review before release, merge or deployment. Current integration anchor `3217dd945b5c5641ab0414630c58c1f97ef40ec1`, branch `codex/dashboard-game-parity-20261016`; reviewed working tree is dirty. The latest combined source manifest below identifies the reviewed bytes. Earlier bases and evidence remain historical.

**Current conclusion:** the four original findings (DGP-01 through DGP-04), two hosted-CI source-consumer failures, and the new combined-domain replay finding below are resolved for their pinned scopes and retested. No critical/high or unresolved confirmed finding remains in this bounded review. The combined replay, source-profile and fixture review is complete; its exact source and evidence are in the latest addendum. **The full local release harness has not completed successfully, and final combined hosted CI has not yet passed.** Targeted checks, the 22-command market memory suite, and the 32 source-consumer passes do not establish a complete release-harness or native pass. Full hosted CI on the final committed combined source remains a hard merge/deployment gate. Earlier e321 native results apply only to that earlier source; running, skipped, superseded or cancelled lanes are incomplete. This is neither production acceptance nor blanket security clearance for OMERTA. No production, signer, deployment or onchain action was performed by this review.

Final scope includes the registry and server publication hooks; authenticated presence projection; browser API/action bridges and canonical-state refresh; dashboard panel lifecycle; scene activity acceptance, rendering, expiry and identity retirement; and associated focused tests. The latest addendum reopens only the combined source-comparison/fixture boundaries and the new cross-docking, production-slot and merchant-return durable replay return values and receipt DTOs. Existing gameplay handlers, receipt middleware, player projections, public activity wire, and player-intel reads were traced as dependencies. Existing gameplay economics, authentication implementation beyond changed call sites, all dashboard feature implementations, encounter locking, and unrelated backend/contract surfaces were not re-audited. Package scripts and concise presence documentation were checked for consistency.

Methods and limitations are retained in the historical review below and extended in the final addendum. The initial report SHA-256 was `84dd365b03f5e509353cbfef67ed3758b46157f35f4fec3a897aa2dfa6282e98`. Its finding text, original source hashes and open dispositions are preserved as historical evidence; **the final dispositions in the addendum supersede those historical statuses**. This report's final hash is provided separately to the release coordinator to avoid a self-referential hash.

## Historical initial review — before remediation

Original title: Dashboard game parity: backend security and regression review.

Review date: 2026-10-16. Phase: working-tree implementation review, before release/deployment.

## Scope and conclusion

Base commit: `3aaeaa97a102babf7f56dece03860964814fe313`.
Branch: `codex/dashboard-game-parity-20261016`. Working tree is dirty; conclusions attach to the file hashes below, not to the base tree alone.

Reviewed the new activity registry, the activity additions to presence/routes, the auth capture and response publication changes in the server, and the focused activity test. Followed existing HTTP receipt middleware, Command Center replay, presence identity/intel projection, read scopes, and public WebSocket delivery as dependencies. Frontend rendering and dashboard action coverage are outside this backend review.

**Conditional conclusion:** no critical/high defect was identified in this bounded backend scope. Two medium issues and one low presentation regression remain open below. Owner isolation, lifecycle filters, bounded retention and failure isolation have useful evidence, but the current source does not yet satisfy identity privacy and replay suppression across all relevant paths. This is not release approval. No implementation was edited, no deployment performed, and no wider security clearance is implied.

| File | SHA-256 (raw working-tree bytes) |
| --- | --- |
| `src/city-activity.js` | `fed18f7b3dd891adbed583b5cd40d0fef19d77e00e9a4c078a8b88ae06d4108c` |
| `src/city-presence.js` | `79cc3a4169b0ffdf5e037951bd1a0a6f3cb1be532d55d2bb05cfe6ecce8e477b` |
| `src/routes/city.js` | `a6c9a13e75b1f3f4181c56435975fd5dec1062f2205462293b59f078db5025eb` |
| `src/server.js` | `3bf2f7f1481d8b78647062f42ecdb0f65d07d6d567fe853554684f83ea69779f` |
| `test/city-activity.js` | `281ac607e626ce38cb7c5e2ba469e8cfd13cc2bebd8f93f72c331cc901c29c9e` |
| `package-lock.json` (dependency pin) | `c82433eeb57adb7213267c8e483a5526670935edfa8f692c03a60355e38910b0` |

## Methods and adaptations

Applied `omerta-contracts/SECURITY-REVIEW-POLICY.md`. The local method repositories in the primary checkout were checked with `git rev-parse HEAD` and match the required pins:

- pashov/skills `c577eb7799c349de0acb187ba00ca98e14e436fd`: access-control and invariant-agent passes; traced weak/parallel guards, receipt identity and stale cache assumptions.
- PlamenTSV/plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: semantic-invariant write/read and lifecycle analysis; enumerated the single registry write site and compared its meaning with returned presentation facts. Concrete hypotheses were checked with executable proofs.
- trailofbits/skills `d3323cefbcf645678b8dc481de204b02ad3d02dc`: differential review, caller/blast-radius review, test coverage and report methods. Also used the installed audit-context-building skill and web-service domain notes for initial trust-boundary mapping; the installed skill itself is not claimed to be the pinned repository revision.

This is a JavaScript/API review, not execution of the upstream Solidity/Sui orchestration. All four agent slots were occupied; the context-building routing was adapted to a bounded manual dependency map. Independent implementation-agent test results were reused and explicitly distinguished from review-owned proofs. No contract compiler, EVM, asset-transfer, native locking, arithmetic conservation or PostgreSQL concurrency claim is made. No broad SAST tool or stateful fuzzer was run; native syntax checks, focused static queries and deterministic adversarial controls were used.

## System and trust boundaries

- **Ingress/auth:** registered game routes use the existing JWT/account-status/token-version/rate-limit auth. Only after auth succeeds is the current living character sampled for eligible mutation routes. The route template, not an arbitrary request path, determines category. Account/actor IDs come from server reads, not the payload.
- **Publication:** the response hook accepts 2xx responses, rejects the HTTP replay header, samples the current actor again, then updates ephemeral registries. A capture failure omits the cue. The existing named public wire remains separate and unchanged in shape; this matters to finding DGP-01.
- **Public authority:** only the existing `ACTIVITY_WIRE` route keys can write the public registry. Labels/kinds/venue IDs are fixed constants, never copied request bodies, targets, amounts or outcomes. Public entries use random IDs, not owner idempotency keys.
- **Private authority:** the broader owner registry accepts registered authenticated POST/PUT/PATCH/DELETE routes except explicit read/auth/telemetry exclusions. Presence reads it only for the authenticated owner. The final owner-read guard requires viewer character and generation equality in addition to entry account/actor/district checks.
- **Read projection:** presence selects living actors in the viewer's server-derived current district, excludes the owner from other actors, and retains existing unknown-name/level/online redaction. Responses are private/no-store with Authorization variation. Activity does not write player intel or grant knowledge, gameplay authority, money, items, or permissions.
- **Identity/district:** before/after character, account and generation must match and both be alive. Nontravel publication requires unchanged district; travel requires the after district to equal the route destination. Read-time character/account/generation/district checks reject turnover/migration mismatches. Public SQL already restricts actors to alive even though its selected rows omit the alive column.
- **Lifetime/bounds:** each server owns two maps, capped at 20,000 actors each, with a 60-second TTL. Updates replace an actor's previous entry. New processes start empty; no durable/accounting state is introduced. Multi-instance routing can omit cues, which is an accepted best-effort limitation.
- **Concurrency/staleness:** DB samples are not an action-commit snapshot. Same-identity/same-district callbacks may finish out of action order, and the last callback wins. Movement away and back within TTL may make a previous cue observable again. These are bounded presentation limitations, not transaction/locking proofs or new balance risks. The replay defect below is separately reproducible without a race.
- **External effects:** no new external network or signer call; registry storage is process memory. The new reads add DB work before/after eligible writes; existing auth/rate controls remain. A rejected lookup is swallowed, but a stalled lookup may add latency until the existing DB timeout.

## Findings

### DGP-01 — Medium / P2: public cue correlates an unmet actor with the named activity wire

**Source:** `src/city-presence.js:123-125`; `src/server.js:3198-3206`; existing public delivery at `src/server.js:3090-3093`.

The roster keeps an unmet actor's `name` null, but now adds a fresh actor-specific category and timestamp for the same action that the town-wide wire emits with `who`. In a quiet district, an authenticated observer can take a roster snapshot, observe one named dice wire event, and associate the single new `play` cue with that name. This supplies the encounter-handle/name/district link without obtaining the corresponding intel.

**Proof:** the retained HTTP proof creates an uninformed observer and a separate actor, reads the redacted roster, performs one dice action, then sees exactly one new cue alongside exactly one wire event. The returned actor name stays null, but the wire names it `Hidden Real Name`. The production WebSocket subscribes authenticated viewers to that same `activity` event; the proof captures the bus delivery point rather than opening another transport connection.

**Impact/prerequisite:** observer is authenticated and can view the same district; sparse/unique activity enables correlation. No account balance or secret payload leaks. This is a new association between independently available public data, so unchanged wire shape and null name fields do not invalidate the issue.

**Correction:** keep person-specific public activity restricted to NPCs or actors already covered by appropriate viewer intel, or redesign the named wire/person correlation. Merely deleting the timestamp leaves the unique category/refresh channel. If the product deliberately accepts this discovery channel, document that explicit privacy change rather than claiming unmet identity privacy.

**Disposition:** open; not edited or retested after remediation.

### DGP-02 — Medium regression / P2: domain replays overwrite newer owner activity

**Source:** new response guard `src/server.js:3190-3200`; existing replay exemption `src/server.js:1328-1334`; domain result `src/routes/commands.js:55-65`.

The new hook suppresses only `x-idempotent-replay`. Command Center retries intentionally bypass cached HTTP responses to reproject current facts; their durable result uses `replayed: true` in the body and has no HTTP replay header. Consequently a normal retry writes a new owner presentation receipt, refreshing its time and replacing the newest actual action.

**Proof:** execute an issued `mystery.start`, make a bank deposit, then retry the original execution ID/key. The domain returns `replayed: true` with no replay header and zero new consequences. Presence nevertheless changes `Banking` back to `Action completed` with a later timestamp. This does not need HTTP receipt expiry. No economic effect executes twice.

**Correction:** propagate trusted domain replay metadata to the presentation hook and suppress cue recording on either replay path. Preserve current-response reprojection and durable replay behavior. Also check the frontend bridge, which another reviewer is examining, rather than relying on a header-only check there.

**Disposition:** open; independently confirmed with the implementation agent, which also identified the client counterpart.

### DGP-03 — Low / P3: read-only forecast POSTs become owner actions

**Source:** `src/city-activity.js:27-42`; dependency routes `src/routes/companyforecast.js:4-5`, `src/routes/companydemand.js:5-6`.

The classifier returns `work` for `POST /v1/company/forecast/:id` and `POST /v1/company/demand/:id/scenario`. Their handlers use `G.readCharacter` and return calculated views; separate `/apply` routes perform changes. Successful previewing therefore replaces a real owner cue with `Action completed` despite the read exclusion requirement.

**Proof:** direct execution of the production classifier returned `work` for both registered templates. The callees (`companyForecast`, `companyDemandScenario`) only calculate views after reading context; their mutation counterparts call `configureDepot` separately.

**Correction:** explicitly exclude these semantic reads, or add trusted route metadata for action/read classification. Add negative cases beside the existing quote/preview exclusions.

**Disposition:** open. No sensitive public data exposure; presentation accuracy only.

## Executed and reused evidence

Runtime: Node `v24.19.0`, npm `11.17.0`, Windows PowerShell. Review-owned command:

`node output/security/dashboard-game-parity-proofs.mjs`

- Final run exit 0, approximately 5.7 seconds, disposable pg-mem; reproduced DGP-01/DGP-02 and passed an activity-read-failure injection. No live database credentials or network deployment were used.
- The first proof attempt exited 1 because the fixture put the dice actor in docks. This was a proof setup error, corrected to neon; its raw output is preserved in `dashboard-game-parity-proofs-attempt1.log`. The command replay fixture is then explicitly moved to docks.
- The successful log records a domain retry with `replayed:true`, zero changes, and owner cue `Banking` -> `Action completed`.
- The failure-injection leg throws only from the new activity actor lookup. Bank gameplay still returns 200 and the old cue remains unchanged.
- Direct classifier probe returned `work` for both read-only templates in DGP-03.
- `node --check` passed for all five reviewed source/test files; raw status output is retained in `dashboard-game-parity-static.log`. Syntax checks are not security analysis.
- Reused implementation-agent results: `node test/city-activity.js` passed at the listed registry/test hashes; `node test/city-presence-api.js` and `node test/city-presence.js` passed after the owner extension. These cover TTL boundary, eviction, fresh registry, invalid identity/owner/district/generation, invalid category, HTTP replay, error statuses, private/public separation, travel and generation-change controls. These runs were not independently rerun here.

Static triage found no new user-controlled SQL interpolation or unrestricted public-category writer in the changed path. Fixed output strings and shallow copied receipt objects avoid new payload injection and caller mutation of stored values. The owner-only cross-viewer hypothesis is invalidated by the final explicit viewer guard and authenticated caller construction. Registry capacity and expiration claims are supported by focused tests, not a production memory/load measurement. No separate broad scanner diagnostics exist; no scanner-clean claim is made.

| Evidence artifact | SHA-256 |
| --- | --- |
| `dashboard-game-parity-proofs.mjs` | `5099104bb511c88c041b918dbaf963b25764fa7af4cd28b0fb0636f433fe48d8` |
| `dashboard-game-parity-proofs.log` | `043d3a91ffd2da099b0185b00d6ee45ae928cd68496af9013d2a99eba3d24527` |
| `dashboard-game-parity-static.log` | `28f8134eee27e664ae22d00a448313fb987bb4c23b16dcf9aad62ff4d8471147` |

The report and evidence are retained under `output/security/`. Material source changes require a hash refresh and affected retest, preserving this finding history. A release manifest should reference the resulting report hash if this package is used for a release; no release manifest or production setting was changed during review.

## Final addendum: remediation and expanded frontend review

### Resolved findings

| ID | Final disposition and retained evidence |
| --- | --- |
| DGP-01, Medium/P2 | Resolved. `buildCityPresence` now projects a public cue only for an NPC or a person whose identity is already represented by viewer intel (`name`, `observedAt`, `source`). Independent real-HTTP retest finds no cue for the unknown actor, preserves the actor's private owner cue and existing wire delivery, then adds a dated intel snapshot and confirms the known actor's cue without changing the stored intel. The implementation tests additionally cover human/agent unknown-to-known behavior and NPC visibility. |
| DGP-02, Medium/P2 | Resolved. Server `onSend` derives trusted replay metadata from its serialized response; the later publication hook rejects HTTP and domain replays. The existing server compressor is gzip-only, and the parser supports its string/Buffer/gzip output. Decode failure omits presentation activity. Independent exact Command Center retry preserves the intervening Banking cue byte-for-byte, including ID and timestamp, with zero new consequences. `apiNow` also normalizes either replay form, and the actual browser-source matrix confirms neither creates an owner cue. Implementation tests cover compressed and ordinary domain responses, plus public/global suppression. |
| DGP-03, Low/P3 | Resolved. Forecast and demand-scenario read templates are explicit classifier exclusions. Independent classifier retest rejects both reads and retains their two mutation/apply counterparts. Implementation integration tests issue the actual read-only POST routes and preserve the earlier cue. Focused frontend caller search found no `act()` call to either read route; the visible bond quote uses direct `api()`, whose cue acquisition is now the server-classified presence read. |
| DGP-04, Low/P3 | Resolved. The action bridge now requires a non-ignored 2xx canonical refresh before publishing its local activity receipt. Independent execution of the actual `act()` and `recordCityAction()` source confirms that refresh 503, ignored 200, and successful travel into another scope all create no old-scene cue; a successful same-scope training action still creates its cue. The ordinary operation receipt remains available. This exact-source regression is retained in `test/client.js`. |

### DGP-04 — retained initial finding and correction

**Source:** `public/index.html`, `act()` after `await refresh()` and `recordCityAction()`; final guard at approximately lines 5690-5695. **Prerequisite:** a successful movement action followed by a failed canonical player refresh. **Severity:** Low/P3 because the consequence is misleading owner-only scene feedback; it grants no action authority or economic value.

Before correction, `act()` called `recordCityAction()` unconditionally after the refresh. A 503 response left the browser's character and authority revision at the departed district, so its existing current-scope predicate still passed. The review-owned VM proof executes these actual functions, models a successful `/v1/travel/neon` response and a 503 refresh, and observes a new confirmed `move` cue in `docks`. A successful refresh that changes the identity scope is the negative control. The original successful reproduction is retained in `dashboard-game-parity-refresh-proof.log`.

The correction requires successful, non-ignored canonical refresh before the local cue call while preserving ordinary operation receipts. The expanded four-case retest is retained in `dashboard-game-parity-refresh-retest.log`. One expanded reproduction attempt ran after the correction had landed and therefore failed its old expectation of a docks cue; that diagnostic is retained as `dashboard-game-parity-refresh-proof-expanded.log`, not treated as a product failure. The fixed-mode proof and extracted production regression both subsequently exit 0.

### Frontend trust boundaries and adversarial passes

- **Action authority and replay:** direct browser API mutations obtain a server-scoped owner cue via presence rather than stamping cached `me`. `act()` publishes only after a successful current canonical refresh. Its local receipt captures character/generation/district and projection/authority revisions; the scene separately validates the identity, confirmed state, timestamp and receipt ID. The owner-only local cue never writes a public registry or gameplay state. Stable server receipt IDs also prevent polling from repeatedly animating an action.
- **Read timing and recovery:** presence polling captures scene, projection and identity revisions, is throttled/single-flight, and suppresses stale responses. A successful presence board for a different identity triggers canonical refresh after the queued API call completes, avoiding a self-wait inside the authenticated request queue. The browser host test holds a new-district presence response after external travel and local chat; it proves no old-scene cue appears while pending, then refresh retires the old panel and enters the correct district.
- **Scene lifetime:** activity accepts only finite, recent times and bounded nonempty receipt IDs. Remembered IDs are bounded; per-actor cues replace earlier ones, expire, and release badges/timers. Identity/world-scope changes clear cues and remember old receipt IDs so revisiting does not revive them. Actor-generation changes and roster removal retire actor cues. Destroy cancels activity timers and listeners. These presentation controls do not claim real coordinates or execution order.
- **Injection and input:** activity labels are bounded text rendered through DOM text nodes, and badges use fixed categories with Phaser text. No activity-controlled HTML, script URL, SQL, or outbound request was introduced. The moved dashboard controls retain their canonical handlers. External panels stop movement and disable/inert scene controls; pointer, keyboard, movement and action entry points also reject the panel-open state. Scene tests exercise safe labels, reduced motion and retained-scene input locking.
- **Coverage boundaries:** reuse of existing controls was checked through all 33 destinations plus Character, Chat, and Account/help host panels. That is navigation/control integration coverage, not a re-audit of every gameplay route reachable through those screens. Phone tests prove actual training actions, visible confirmation/badges and compact canvas behavior at 320x812 and 320x568. Cosmetic/layout conclusions are bounded to those tested viewports and the desktop fixture.

The three pinned method families were applied again to the expanded boundaries: Pashov-style authority/replay/stale-cache adversarial passes; Plamen-style semantic write-versus-read and lifecycle invariants; Trail of Bits context/differential/caller review and false-positive checks. No additional tool or entire upstream orchestration is implied. The review-owned tests are deterministic fixtures with the explicit matrices below; no random campaign, fuzz seed or fuzz run budget applies.

### Final executed and reused evidence

Review-owned runs on 2026-10-16 with Node v24.19.0 / npm 11.17.0:

| Command | Result and scope |
| --- | --- |
| `node output/security/dashboard-game-parity-retest.mjs` | Exit 0, approximately 5.5 seconds, disposable pg-mem. Independently verifies DGP-01, DGP-02, DGP-03 and actor-lookup failure isolation. |
| `node output/security/dashboard-game-parity-refresh-proof.mjs` | Initial exit 0 reproduced DGP-04 using actual host source; later expanded old-expectation run after remediation exits 1 as explained above. |
| `node output/security/dashboard-game-parity-refresh-proof.mjs --fixed` | Exit 0. Refresh 503; ignored 200; successful scope-changing travel; successful same-scope training. |
| `node output/security/dashboard-game-parity-client-retest.mjs` | Exit 0. Extracts and executes the actual new blocks from `test/client.js`: four API/replay cases and four canonical-refresh cases, including preservation of the ordinary receipt. |
| `node --check` for each final source/test JavaScript file listed in `dashboard-game-parity-final-static.log` | All 11 exit 0. Raw statuses retained. Inline HTML code is exercised by the VM and host-browser tests rather than passed to `node --check`. |
| `git diff --check -- <final manifest files>` | Exit 0; diagnostic/status output retained. This is whitespace validation, not security analysis. |

Reused runs, explicitly reported by the implementation agents/coordinator rather than independently rerun here:

- Backend: `node test/city-activity.js`, `node test/city-presence.js`, `node test/city-presence-api.js`, and relevant Command Center integration all pass. The focused activity suite covers public/private separation, unknown human/agent and known/NPC projection, JSON/gzip replay suppression, actual forecast/scenario reads, failure isolation and registry lifecycle controls. These are pg-mem results, not native PostgreSQL lock/concurrency evidence.
- Scene: `node test/city-scene-browser.js` exit 0 (session 5446); `node test/city-activity-browser.js` exit 0 (tool chunk 721505). These cover activity validation/expiry/deduplication, old identity retirement, unsafe-label text rendering, reduced motion, and external-panel controls. A later narrow native world-panel loading-height conditional is covered by the coordinator's final world-host run rather than retroactively attributed to the earlier scene run.
- Host: `node test/city-dashboard-host-browser.js` final exit 0 (coordinator session 10495), covering all 33 destinations, utilities, real training, refused action, replay, authorized agent owner activity, known-agent/unmet privacy, stale-district chat recovery and both narrow phone heights. Earlier implementation run session 21337 also passed. No separate disk console log was made by the scene agent; test source and screenshots are retained, and the execution summaries are recorded here rather than fabricated as raw logs.
- Legacy integration: final `node test/city-world-host-browser.js` exit 0 reported by coordinator after the narrow scene loading-height adjustment. Full client wiring passed before the final refresh-guard regression was added; this review's extracted production blocks pass afterward. Remaining release check/route-byte checks belong to the coordinator, whose in-flight source-byte-equality test was rerun after source freeze. This report makes no claim that unreported release checks passed.

Screenshot evidence is under `C:/Users/Jorge/.codex/visualizations/2026/10/09/01a11e90-120c-7030-ab0d-2d9f1d99eb6e/dashboard-game-parity/`: `dashboard-training-1440.png`, `dashboard-training-320.png`, and `dashboard-training-320-short.png`. These support visible layout/action evidence, not replay, privacy or authorization claims.

Final static triage: no reachable new injection sink, public-category expansion from owner routes, cross-owner activity read, or local read-only forecast caller was found. Historical leads and confirmed defects retain their dispositions above. The failed-refresh hypothesis was confirmed and fixed. No broad SAST scanner was run, and no scanner-clean, load, native database concurrency or contract verification claim is made.

### Residual limits and release handoff

Activity remains a short-lived, per-process presentation cache. Multi-instance routing/restart can omit cues; same-identity callbacks can arrive out of order; the cache does not prove gameplay commit ordering. Read samples do not establish transaction isolation, and the added lookup can inherit database latency. Known-actor cues use existing intel and do not refresh it. Animation paths are illustrative and do not disclose real positions. These accepted limits do not affect gameplay authority or balances.

This conclusion applies only to the final hashes below and the pre-release implementation phase. Contract/signing/payment rails, native persistence/concurrency, deployment configuration, production cutover and monitoring are outside scope. Before using this package for release, the coordinator must pin the committed source, finish required repository/release checks, preserve this report and evidence, and reference the report hash in the release manifest. Later material source or replay/authority changes reopen affected coverage; production approval remains separate.

### Final source manifest

The machine-readable copy is `dashboard-game-parity-final-hashes.json`. SHA-256 values hash raw working-tree bytes, including current line endings; Git normalization can change raw hashes without a semantic source change and must be accounted for when pinning a later commit.

| File | Final SHA-256 |
| --- | --- |
| `src/city-activity.js` | `ae264f0523208d6806a90d0d21fe2ff14683d30778af1db171bb26d16ff80d66` |
| `src/city-presence.js` | `aaf473422daa86c2ac2c2430b8cd9f5a6b4112698ec15968a6d8c9ea9bc0dc85` |
| `src/routes/city.js` | `a6c9a13e75b1f3f4181c56435975fd5dec1062f2205462293b59f078db5025eb` |
| `src/server.js` | `6ba1c75d12d1cce1f5127dcac2e197439faef1d82292460598d55ef61d330ffd` |
| `public/index.html` | `8df5f1c3736071e7230af98ba7c7add115b0c09456ee73178d639c629e0d8db8` |
| `public/city-scene.js` | `8808f67ca7048c3b89b11a95f8d5ef924ab94abee20b0e5d7352069405ac3af6` |
| `public/city-scene.css` | `753306c328370aefadb6b73189c9c69b6ae9b6ed056279c26384e30ba199db95` |
| `test/city-activity.js` | `217b7fbf727737a6e5f9f22abd2b3b58a3f8428c4bd6c7536fd8c176b6ca6391` |
| `test/client.js` | `aff448626aa76484f39aec949dc73486a8e88b4c6f5ba9b5b4eb65138ab4f767` |
| `test/city-activity-browser.js` | `4fbe93c6db8e4b3eab9cd91348295887833ede391f78790d65fdbd3a6dd5b3ec` |
| `test/city-dashboard-host-browser.js` | `94c79b2053dbb9a06a5fb9a4040cf42e5d9e2d12ba71eaa8fd4f1853943b9433` |
| `test/city-scene-browser.js` | `127e3f59c42055c6692c594ee829befb5df25ee253cc7672b6056c0120be67b4` |
| `test/city-world-host-browser.js` | `1eb76b1f20c01ddbde3d3b12bf16437c502994028ca847ee9b65d06003321a84` |
| `package.json` | `65cdc8a180f42798e94b712e3808d13d4e01d30dd66b137e9849670f9fd61f16` |
| `package-lock.json` | `c82433eeb57adb7213267c8e483a5526670935edfa8f692c03a60355e38910b0` |
| `docs/city-presence.md` | `722c7cc14e2afbbd5e5e5af40152b2fe31fe8d71eff0e86e3c59f4bb21b615ff` |

### Final evidence manifest

| Evidence artifact | SHA-256 |
| --- | --- |
| `dashboard-game-parity-final-hashes.json` | `c7d33c7a808964fa7e134598f3108f51129974657946221ce2e1f360d2c5828d` |
| `dashboard-game-parity-proofs.mjs` | `5099104bb511c88c041b918dbaf963b25764fa7af4cd28b0fb0636f433fe48d8` |
| `dashboard-game-parity-proofs.log` | `043d3a91ffd2da099b0185b00d6ee45ae928cd68496af9013d2a99eba3d24527` |
| `dashboard-game-parity-proofs-attempt1.log` | `62ec74e4dc52ebf329d2141398288561076d7368dcaf836459675d8288919afe` |
| `dashboard-game-parity-static.log` | `28f8134eee27e664ae22d00a448313fb987bb4c23b16dcf9aad62ff4d8471147` |
| `dashboard-game-parity-retest.mjs` | `8602f966420a29bb288d79e49fdf7f2fba6254683c728884995bfba4c8b0c6f5` |
| `dashboard-game-parity-retest.log` | `d63cd5121bce97f366e64299ef9d88b40aedf3bd642665fbaea23f22ed0988d1` |
| `dashboard-game-parity-refresh-proof.mjs` | `c6aeb861606db4db0630145d082747dfcb004f02ca50677749961db37a445855` |
| `dashboard-game-parity-refresh-proof.log` | `ce57f3946e9929a01b2bc61815f3d8ef704bf061773e95655602ec891e43301a` |
| `dashboard-game-parity-refresh-proof-expanded.log` | `8fbfe4b783768f50144c9c09244e95c9d57eccb4f8357bc3dbdd3c7bd2240f57` |
| `dashboard-game-parity-refresh-retest.log` | `a28eeb13015bde6b6933695ffd46d16e5f8e6fc404fa1d83a5a5883644811351` |
| `dashboard-game-parity-client-retest.mjs` | `8d858bf044e1bac55740f6f31fb6e2719e4adf587d2f42c520a1ffc2a57d4678` |
| `dashboard-game-parity-client-retest.log` | `4674530fc9a46456d014b7d98aef0bdf9e7a8ad368c40e35a8529818e5daa178` |
| `dashboard-game-parity-final-static.log` | `ffdb2cbb950572f6d823bcce87c56facdcb3d177f028218274e8639586a26eb6` |
| `dashboard-game-parity-final-whitespace.log` | `3836c4f0b2321908d5c9d6a841cf10365a82a9ba81d7b8c5d8ac5026bf8fc080` |
| `dashboard-training-1440.png` (screenshot root above) | `e5c6636713bb0ead3ef9ff69c9baef0b2f90acd806c878e040b49163a78be27d` |
| `dashboard-training-320.png` (screenshot root above) | `671763d51907c84f113e6fdd3efcf5631ae731305cf99817986c5321272e9180` |
| `dashboard-training-320-short.png` (screenshot root above) | `1e77e7fdef01470fdb7cfaeaff291795e02c936a818b17a0663bdff8c576c796` |

## Scoped base-equivalence transfer — 2026-10-16

After this review completed, the feature checkout fast-forwarded its base from `3aaeaa97a102babf7f56dece03860964814fe313` to `f89df180aa54e71cb17431d5324d3d9344ca7de0`. The original review, source hashes, findings and retests above remain historical evidence for the original base plus reviewed working-tree changes; they have not been rewritten as a new baseline review.

The reviewer independently checked the exact base-to-base changed-file list. It contains only three test fixture/helper files (`test/lib/rc1-historical-source-fixture.js`, `test/rc1-native-worker-schedule.js`, `test/rc1-world-observer-load-order.js`) and four generated knowledge files (`knowledge/generated/github-history.md`, `knowledge/generated/graph-summary.md`, `knowledge/generated/graph.json`, `knowledge/generated/inventory.md`). There are no runtime, package/dependency, database schema or reviewed activity/host changes in that base delta. The coordinator also inspected the exact content diff as test-fixture fixes and generated output.

All 16 entries of `dashboard-game-parity-final-hashes.json` were recomputed after the fast-forward and still match the final manifest above byte-for-byte. Therefore this bounded review conclusion transfers to the same reviewed working-tree source on base `f89df180aa54e71cb17431d5324d3d9344ca7de0`. This is a scoped source-equivalence transfer, not a claim that the newly inherited fixture changes or every test dependent on them received a new security review. Any later material runtime change still reopens its affected coverage.

Additional coordinator-reported release checks passed after source freeze: routes, gates, documentation and PWA checks. The local native PostgreSQL query check was unavailable because no disposable `DATABASE_URL` was configured. No native PostgreSQL validation, persistence/locking or concurrency conclusion is added. Final mobile and broader harness work were still in progress when this transfer was recorded; their eventual results belong to the coordinator's release evidence, not an assumed pass here.

For durable repository retention, this report is copied verbatim to `docs/city-dashboard-security-review.md`; the original review artifacts remain under `output/security/`. The copy has the same content hash at handoff. The coordinator should reference the final report hash and committed source in release records, preserving the phase and scope limits above.

## Final integration and test-fixture addendum — 2026-10-16

The coordinator's completed integration results below supersede the earlier mobile-pending note. The reviewer read the retained outputs and independently inspected the two affected test fixtures. All 16 reviewed source-manifest hashes still match; these follow-up changes affect test fixtures only and introduce no runtime change.

| Check | Result and bounded meaning |
| --- | --- |
| `npm run mobile` / `node tools/mobile.js` | Coordinator PASS: 179 screen checks across 320x568, 375x667 and 360x780. The retained output reports no horizontal page overflow, navigation/reachability or runtime-page failures in those fixtures. Its stored-XSS sweep poisoned 4,756 strings over 163 responses, observed 668 text renderings across 35 screens, and reported zero failures. This is bounded layout/output evidence, not a blanket security or usability claim. |
| `node test/world-projection-client.js` | Coordinator PASS after exactly two test-fixture dependency lines were added. Independent diff review confirms that the two existing VM contexts now provide deterministic `uuid` and no-op `scheduleCityPresence` dependencies required by the reviewed API source. Existing contention, session/selection/revocation, passive-invalidation and queued-mutation assertions are unchanged. The presence mocks support those queue tests; they do not prove the actual presence side effect. |
| Final documentation check | Coordinator PASS after measured inventory corrections. The retained log confirms the documentation assertions and inventory checks. This is documentation consistency evidence; it adds no gameplay or native database claim. |
| `node test/rc1-browser-board-refresh.js` | Implementation-agent PASS and independent reviewer rerun PASS_SCOPED, exit 0, Chromium 155.0.8059.82. Both raw outputs are retained. Independent run confirms zero submissions during the two controlled refresh windows and preserves explicit failure controls for unexplained detachment, loading without an actual request and mismatched submitted identity. |

### Independent review of the strict API-source fixture

The browser-board fixture previously accepted the exact API seam pinned at `0a1714c6aa971e3d16365f390eb03005a820dc19312c8f904c87a7471e2e22fd`, with its own exact inverse to `61ffdfc08a79dca5491f95abf333f1fc9c9d125f344206a5233063ecaddeeba7`. The reviewed dashboard change adds mutation-key allocation and scoped presence scheduling to that seam, so the old source assertion correctly required an explicit fixture update.

The update adds the fixed current-seam pin `490beb898976f6e3d94b2adea953b916fa5e9ac0ee1c35fd5fc0cebae9dbcf73`. Each of the two exact new chunks must occur exactly once before removal. The resulting complete source must reconstruct the unchanged `0a1714...` pin, and removing the previously reviewed dispatch guard must still reconstruct the unchanged `61ff...` pin. Source extraction continues to require unique start/end markers. Neither historical digest nor any existing assertion was weakened.

Additional negative controls reject duplicate and partially removed additions, key replacement, inverted replay/handled guards, broadened success statuses, modified presence calls, session-authority changes, unguarded output and appended source. Earlier dispatch-guard and coordinator tamper controls remain intact. The initial fixture proof executed the reconstructed `0a1714...` queue in its browser scenario; the subsequent current-source browser adaptation and retest are recorded below. Separate probes execute the actual current queue with explicit deterministic key/presence dependencies and check queued, dispatched, session-revoked, owner-revoked and default calls against real transport counts and response codes. The new presence function is deliberately stubbed for these transport probes; they do not inherit City activity, gameplay or economic qualification.

Independent syntax checks passed for both fixture files, and their scoped whitespace check passed. No additional confirmed defect was found in this fixture-only adaptation. The unavailable native PostgreSQL check remains unavailable; the broader release harness and committed-source pin remain the coordinator's separate release evidence.

### Supplemental fixture and integration evidence hashes

| File or artifact | SHA-256 |
| --- | --- |
| `test/world-projection-client.js` | `58d66e3333c5d583f6d30c14c4aaad45b93c7247d31d89a9bd2db9bedff4861d` |
| `test/rc1-browser-board-refresh.js` (initial fixture adaptation) | `28ee57643604bf1579fa6b30f7dadf71c22ac5bf2a9437f0903b30bc61333e63` |
| `output/security/dashboard-game-parity-mobile.log` | `07a99ed062725878674214de3b96262145edc0b1ac943586a8e17ca18602e665` |
| `output/security/dashboard-game-parity-projection.log` | `56126862612a4249bea4b961b9cba5b4822851e19d7ab5016b7e2d877f3b4c95` |
| `output/security/dashboard-game-parity-docs-final.log` | `caa566ba74464c81821dc9da49783edc929ad6a658c6d18d9afae07b5f4c80b9` |
| `output/security/dashboard-game-parity-rc1-board-refresh.log` | `e03825e9e750c19173ea63939bb20076bdf4abb96f875eeed2e781b7df31ca73` |
| `output/security/dashboard-game-parity-rc1-board-refresh-independent.log` | `2caf151feaa7f35a99652845a7773c6d014d1f87bc46e603b941dac074333fd3` |

## Final current-source and historical-envelope verification — 2026-10-16

The browser-board fixture now executes the **actual extracted current API queue** in its full browser scenario, with explicit UUID and no-op presence dependencies. The exact inverse chain and all prior negative controls remain. Both the implementation-agent run and independent reviewer rerun of `node test/rc1-browser-board-refresh.js` pass, exit 0, Chromium 155.0.8059.82. The independent run again confirms zero submissions in both controlled refresh windows and the retained mismatch/detachment failure controls. The initial reconstructed-queue logs above remain historical evidence; the `*-current*` logs below identify this final browser source.

### Server source compatibility

The new `tools/rc1-city-activity-source-compatibility.js` is a test/review helper. It recognizes only the reviewed complete server source: normalized LF SHA-256 `c208ba209099eed9e1de654bd81b3bd5f24ce55ab64af4b2b860d9d30ad2fde7`, Git blob `9a20ce92ec08499ad58a1f3227cfda6fe66f3642`, and the exact LF/CRLF raw variants. The CRLF raw pin is the server hash already recorded in the original final source manifest. Mixed line endings and bare CR are rejected.

Five unique, exact context replacements invert the activity import, registry/symbol declarations, authenticated actor snapshot, City route registration and response hooks. The whole reconstructed predecessor must match SHA-256 `7647459f9c99c23c224e22439a9d79fe4f4e608eb91622e840d538308ce01419` and Git blob `06baca87fc653ce4c3fc03326b1a89e2b7aa6cea`, and be byte-equal to both that immutable blob and `f89df180aa54e71cb17431d5324d3d9344ca7de0:src/server.js`. The reviewer independently recomputed the current and predecessor SHA/blob identities before inspecting the helper. Unknown variants are not rewritten and remain subject to the existing strict source chain.

`tools/rc1-world-qualification.js` applies this helper at the outer source-comparison boundary and records explicit City activity transfer metadata in review version 34. Its prior source-file pins and comparison chain are unchanged. The helper returns current raw-source provenance alongside its comparison witness; reconstructed source is not written or executed. New activity, owner projection, privacy, replay and new-module behavior remain excluded from inherited historical economic/native qualification and are supported by this report's separate current-source proofs instead.

The historical fixture loader applies the same exact outer inspection before its existing Deed/City-play/economy source chain. Independent final-diff inspection confirms unchanged historical/release revisions and tree pins, entry list, dependency admission, evaluated frozen bodies, loader hooks, network/database prohibitions and native-entry exclusions. `test/rc1-car-melt-provenance.js` itself has no final diff. Its returned execution source remains the immutable fe4 application/b12 tool bodies; accepting a current source witness does not execute the new activity module in that fixture.

Independent reruns passed:

- `node test/rc1-world-qualification.js`: exit 0, full current/prior/CRLF source parity, the added complete-source/inverse/semantic refusal controls, and all existing qualification assertions. This is not a native-world qualification.
- `node test/rc1-car-melt-provenance.js`: exit 0. Existing helper controls (18 positives/23 refusals), application controls (36 positives/165 refusals), 18 rule controls and 24 car-melt controls remain. The added activity inspection has six current/predecessor/frozen LF/CRLF positive controls and 39 raw/inverse/semantic/domain refusals. The frozen fixture reports database/network attempts `0/0` and no current native/financial qualification.
- Syntax checks for the five final compatibility source/test files and their scoped whitespace check: all exit 0, with retained status/diagnostic logs.

Failed fixture attempts are preserved: the first browser harness rejected the changed API seam; the initial world qualification rejected the changed server seam; a direct new-helper import into the frozen car-melt test was rejected as an unknown historical dependency and was reverted; the unchanged car-melt test then rejected the new outer server source until the exact loader inspection was added. These were source-envelope compatibility failures, not relaxed assertions or current unresolved runtime defects. The retained failure logs below distinguish them from the successful final runs. The broader release-harness run remains separate coordinator evidence.

### Remaining browser integration

The scene implementation agent completed `node test/world-fieldwork-browser.js`, `node test/city-presence-browser.js`, `node test/city-world-ui-browser.js`, `npm run test:city-gameplay:browser` and `npm run test:deed-discovery:browser`; all pass in the retained combined log. These results are reused, not independently rerun by this reviewer. The initial district-arcs test waited for the replaced `#city-return` control. Independent diff review confirms its only test adaptation now uses the actual `#city-panel-close`, adds panel input lock/unlock and retained scene/pose assertions, and keeps the original quest, mutation, receipt and pose checks. No runtime source changed. The log preserves the initial failure, adaptation and successful full retest. References to native controls in that browser log do not establish native PostgreSQL or production execution.

All 16 original final source-manifest entries were checked again and remain byte-identical. The additional helper/test sources and final evidence are pinned below; prior hashes remain historical. This expands only the review/test compatibility scope and does not change the original deployment, persistence, economic or production exclusions.

| Final supplemental source | SHA-256 |
| --- | --- |
| `test/rc1-browser-board-refresh.js` | `b278190d135690c5b6db2d23030200cb9c383b3ac07eb30965277a7def510e5f` |
| `tools/rc1-city-activity-source-compatibility.js` | `d769a5d9a7966b1da964c61c7d459061101288c1d70f883506b74f3325b73891` |
| `tools/rc1-world-qualification.js` | `b3cf74128d3374116d1ae9b3db48d09371646f74a6371d6b43a7cdc7070d4a01` |
| `test/rc1-world-qualification.js` | `701586b4fa7dfb4c14a41688906f7b091fc08adfbf61d341bcb13d062ab46597` |
| `test/lib/rc1-historical-source-fixture.js` | `998ae53870fbd67885156b1aae4947690ab1b6b9d945171fcb7d6d3fcbb7c3d7` |
| `test/city-district-arcs-browser.js` | `8d233868c988c8a2543fc6490d70ffcb8643426185502a3589efb1ceb073250e` |

| Final/failure evidence artifact under `output/security/` | SHA-256 |
| --- | --- |
| `dashboard-game-parity-rc1-board-refresh-current.log` | `4a176d50225bddc8230cba7dc87d2b0fe075ed8c62fbf3e2381a6ce4697bf171` |
| `dashboard-game-parity-rc1-board-refresh-current-independent.log` | `6188278f866f7dc56da31a2e65a18410a1d4b3d5293c629783056613c2045d2b` |
| `dashboard-game-parity-rc1-qualification-retest.log` | `aab67fe36fa3664f8bf0e91587748e46b2cc0b4643347c10c5287395b7b02e0f` |
| `dashboard-game-parity-rc1-qualification-independent.log` | `65b834d851e83286a4d8579cadfc08c0aa2f382404dbd43ee8bffae29e9f27d6` |
| `dashboard-game-parity-rc1-car-melt-envelope.log` | `59b74aa78ecfb46e83c6b9173dffecea32f2dfb650278fa929f6af348b98f434` |
| `dashboard-game-parity-rc1-car-melt-independent.log` | `c0fcf7faefdda52d71bc978060aed53b90db1dd59dea22caedaa504747f93012` |
| `dashboard-game-parity-compatibility-static.log` | `ee8fda6df2be168e5c4056c0322403aefe31fd60d07a42227f486dd1d11f0008` |
| `dashboard-game-parity-compatibility-whitespace.log` | `5e0e6077065598e0b3b20a5d8bda3cf3d641ee1039780467e49abeed04b6903c` |
| `dashboard-game-parity-rc1-harness.log` (initial API source rejection) | `bdf02464da556872a2648bb19414faad9fa961260b16be925e09e2612ff61ebe` |
| `dashboard-game-parity-rc1-harness-retest.log` (initial server source rejection) | `bb318f294ce2be6f8cc033a62a7371c902a077d29b34bc458dbae195ab1387fc` |
| `dashboard-game-parity-rc1-qualification.log` (initial server source rejection) | `53ae0385fb83d1ca8804fd9466797d093af6556591aaaa2d39b21243355a0a1c` |
| `dashboard-game-parity-rc1-car-melt-retest.log` (reverted import attempt) | `f7fb7a2bc1d145726c703d8aae3da633eb41d5be39b40c1b17093abaf8eed898` |
| `dashboard-game-parity-rc1-car-melt-frozen.log` (outer source rejection) | `57503c991eebe580aa569a0e291a62fecba1466543515b18b6a27406385bdbdd` |
| `dashboard-game-parity-remaining-browser.log` | `6ee76686f1df2e5005d1f8ad206326a04045a5b67eacd5a95f1d1f28e441a6aa` |

## Final release-integration follow-up and limits — 2026-10-16

This addendum preserves the previous source and failure history. The integration base advanced from `f89df180aa54e71cb17431d5324d3d9344ca7de0` to `02430c7d51e0241b05e7da22b9d28b9c024e63ec`, then to `b8fcce7baaa91b29661921a17e5510a47e9f725a`. Independent Git comparison found only the unrelated `test/deedbuildings-browser.js` browser-executable discovery repair in the first step (all test assertions retained), followed by the four generated knowledge files in the second. All 16 entries in the original final source manifest were independently rehashed after both transfers and remain identical. The base transfer does not extend the reviewed runtime scope.

### Exact historical qualification-tool inspection

The subsequent local harness rejected the changed qualification tool in the existing historical loader. The minimal repair adds an inspector for the **already admitted** `tools/rc1-world-qualification.js`; it does not expand the admitted file/dependency set. Independent inspection and identity recomputation verified normalized current SHA-256 `e677b7080fd37428d211254f5f042b7b0e0a9f18ed052bbb86da446a4a45f8d9`, Git blob `6a81639df0d4fae11be126f574197a8e924d426e`, and three unique inverses: import adjacency, review version 34 plus activity metadata, and the outer activity source comparison. The complete inverse equals the immutable f89 source and the existing b12 evaluated tool: SHA-256 `97168b579fb5b864e787045e7c9d88066c79b0c8fe54dfb35a68305560d5f4a1`, Git blob `0b63c8dd253b92954cfe6a7bcd285cba4496c19f`.

The inspector returns the existing immutable b12 tool buffer; predecessor input follows the unchanged original fallback. Original helper pins, historical/release revisions and tree pins, entry admission, loader hooks, and database/network/native exclusions remain unchanged. Four current/frozen LF/CRLF positives and 26 raw/inverse/semantic/domain refusals were added. All existing helper (18/23), application (36/165), server activity (6/39), and rule (18) controls remain and pass.

The reviewer independently reran `node test/rc1-lifecycle-applicability.js` and `node test/lib/rc1-historical-source-fixture.js --npc-rule-rejections`: both exit 0. The lifecycle fixture executes the same frozen fe4 application and b12 tools, reports database/network attempts `0/0`, and does not qualify current native or financial behavior. The final historical-loader hash supersedes the earlier `998ae...` hash without erasing it.

### Incomplete full local harness and required hosted gate

The retained `dashboard-game-parity-rc1-harness-final.log` stopped at the initial missing historical qualification-tool inspector. After that focused repair, `dashboard-game-parity-rc1-harness-complete.log` progressed through the lifecycle/checkpoint/NPC/boat/car/worker/resource checks and stopped at the Intel direct source-composition fixture, which lacked the new outer server envelope. Neither log is a complete passing release-harness result. The coordinator explicitly chose focused repair/review of the affected direct consumers instead of another whole local rerun. The full, unchanged hosted CI harness on the final committed revision is mandatory before merge or deployment. Any hosted failure remains blocking; this report cannot substitute targeted controls for that result.

The reviewer independently reran the repaired Intel and Invoice direct fixtures: Intel passes 4 files, 9 inverse chunks and 38 negative controls; Invoice passes 7 files, 18 inverse chunks and 67 negative controls, both exit 0. Their diffs only import and apply the existing exact activity envelope before the existing composition. All prior source pins, assertions and unknown-source checks remain. These source-only passes add no native, financial, economic, or production qualification.


### Final direct-consumer and package-envelope review

The read-only pretest inventory identified 17 direct source-composition consumers missing the outer current envelope. Focused probes reproduced the source rejection before each repair. Thirteen initially reached the changed server; four first reached the package file. First/second-batch consumers also reached the package after their server repair. The coordinator separately authorized the exact package comparison. No unrelated failed check was suppressed and no whole local harness rerun was substituted for the required hosted gate.

The final 19 consumer edits (17 inventory entries plus Intel and Invoice) only add the existing source-helper import and apply it to the earliest raw-source reads. The release-source test required the same wrapper for its later City-domain reader as well as its main reader. Independent visual diff review and a retained mechanical comparison confirm that removing only these imports/wrappers reproduces the complete original test files byte-for-byte after LF normalization. Original pins, assertions, negative controls, unknown-source checks, comparison bodies, and control-count logic are therefore unchanged. Reconstructed source remains comparison data; the runtime implementation and lockfile are unchanged.

The separate package qualifier is in the newly added activity comparison module. Independently recomputed package identities match normalized current SHA-256 `3d4005905e2ebb374e02be9f6ce70026110c4bfb2ec5f385a6c864b9844b508a`, raw CRLF SHA-256 `65cdc8a180f42798e94b712e3808d13d4e01d30dd66b137e9849670f9fd61f16`, and Git blob `73d18260ce840f7ae6fa19072d1da86c7ab18091`. The complete immutable f89 predecessor is SHA-256 `267a95d8f4178a850e61000f91349f71c93e3ea503b4d759dee61e361174b08a`, blob `de048eb000416b391b7ea17f89c72907c637c381`; the integration-base package is identical to it.

Exactly three keyed script entries are inverted: `test` and `test:city` each add `test/city-activity.js`; `test:city:browser` adds `test/city-activity-browser.js` and `test/city-dashboard-host-browser.js`. Each key occurs once, each complete current/prior script line has its own SHA pin, and each bounded inverse occurs once. The entire reconstructed file must match both the immutable f89 revision and blob bytes plus SHA/blob identities. Uniform LF/CRLF inputs are pinned; mixed or bare-CR inputs are rejected. Unknown package sources pass through unchanged for existing strict checks. The package qualifier never writes or executes reconstructed text. The prior server pins/inverses and all prior comparison-helper implementations remain unchanged.

The expanded world-qualification test includes both package variants, immutable revision/blob equality, predecessor/other-domain pass-through, and 19 omission, duplication, raw-tamper, unrelated-script, semantic-registration and line-ending refusal cases. The reviewer independently reran this final test and the City gameplay source test: both exit 0. The latter retains 17 exact complete-file domains and 1,210 tamper/unknown/no-new-module negatives. The implementation agent's final packet records 20 focused passing tests: all 17 inventory consumers, Intel, Invoice and expanded world/package/server qualification. The reviewer independently verified every listed test hash, log hash and exit status. Those other focused passes are reused evidence, not claimed as reviewer reruns. The release transfer retains all 923 main and 69 City negative controls.

All 24 supplemental JavaScript files pass reviewer syntax checks and the scoped whitespace check, with raw diagnostics retained. The coordinator's final documentation and gate checks also pass and are reused below. No broad SAST, additional fuzz campaign, native PostgreSQL concurrency proof, full local release-harness success, hosted-CI success or production execution is claimed. The earlier unavailable PostgreSQL query check remains unavailable because no disposable DATABASE_URL was supplied. Exact source-envelope compatibility adds no inherited runtime, financial, economic, deployment or onchain qualification.

### Final supplemental source freeze

At final report synchronization the integration base is `b8fcce7baaa91b29661921a17e5510a47e9f725a`; staged changes identify a dirty implementation review rather than a final committed release. All 16 original final-manifest entries still match. The 24 supplemental source hashes below supersede earlier hashes only where the reviewed fixture/helper changed. Original and failed-run evidence remains intact. `test/deedbuildings-browser.js`, the unrelated base-transfer file, remains `5d2ebdc4dd1a349ea6d843315b1236b839a24c9ddf22992712ff936e0d17ab8a`.

| Final supplemental source | Raw SHA-256 |
| --- | --- |
| `test/rc1-intel-source-compatibility.js` | `bc5cd04a6393a8ba4ee7d7b24b64436c63d1491c29d63542ec5b57b0e98daa05` |
| `test/rc1-invoice-source-compatibility.js` | `538dcc81ed6790f98ce162a5b787448f50b12d7d9d4d38b74b89fb8a5f743109` |
| `test/rc1-first-batch-source-compatibility.js` | `90e010980b5b799ee9c4b3f5a450498e087c836e59be5152f7dc56104641317f` |
| `test/player-intel-source-compatibility.js` | `3c5aa81249e37309d90bd368873cf4cfa2faa1589c50dcb8151cbc9545f57f9b` |
| `test/rc1-commercial-premises-source-compatibility.js` | `12d519a645c1f8cb48129d98bbfe3c06b6d616f2e653b58399d7d6014233c964` |
| `test/rc1-company-bank-source-compatibility.js` | `127ece477a63396a5d8107998fab3047462efccc47d6ca99c00cb0c774eeb086` |
| `test/rc1-company-logistics-hub-source-compatibility.js` | `b9daef5f02b01789e133e454f962b023be4de2f27b7ff4254c6ab8b922edf3c0` |
| `test/rc1-buyer-cooperative-source-compatibility.js` | `0a2f9f2bf145d3bdea936d579332f74c9940b69845c1bb1474dbb81c59ce9003` |
| `test/rc1-company-opportunity-source-compatibility.js` | `8ed6dd0f3d6a5f97180416da6459721b82814e39d8281e97046a995f75fc4dea` |
| `test/rc1-commercial-reputation-source-compatibility.js` | `b09ad425806c791ad0f048954b64c0b1c54638d9ab2848ffe0cca729b41a74bc` |
| `test/rc1-business-season-source-compatibility.js` | `41ecadb4ac760dcb616e5620bc75c38b3e1cae9df7598a5e6c55a4f9596908dc` |
| `test/rc1-game-employment-source-compatibility.js` | `9d8a8ec546089f4d58962b641f3e6aa3eb3f537f2f3f9e81633005359d729c5e` |
| `test/rc1-company-workflow-source-compatibility.js` | `d9660097fcf30796ea9c141cc307e5a8bb07e91ef1158c3bfb54615a58d87411` |
| `test/rc1-company-operator-source-compatibility.js` | `7421787b3bbaae1aeaf1b3519ca8e3a62c19233ddbf8107cf66e0eb2c4bffc59` |
| `test/rc1-city-gameplay-source-compatibility.js` | `cfeebba74dfdb00f7868fe5428b69ca58f5c2e50c95e6ac427c151c3ae251c57` |
| `test/next-layer-source-compatibility.js` | `b25c43e9357dcd91cecfd2f8084988dea53fa83354f30832799935accc980ffd` |
| `test/next-five-source-compatibility.js` | `2ad6a18da0c04af7ed7037d83a446fd2c06f277eabd119119912ad81f8956e58` |
| `test/rc1-second-batch-source-compatibility.js` | `fb0d5bae7eb02206d59092fbda2bdd1fe224e235ecded75cca0f57c9cf940ae9` |
| `test/release-source-transfer.js` | `f29f15e4ab605827c058ae394e3402b072da56021b5030bd4b2ead4422d92b25` |
| `tools/rc1-city-activity-source-compatibility.js` | `60a755277b7385d4018ffba643b1fd37ab6e6ebecea4f5674f8fdace2020f430` |
| `test/rc1-world-qualification.js` | `749cd7b927eedb0e14c6d6dd64c55efe059b7f2969f942d6d81e12fcfcfa95bc` |
| `tools/rc1-world-qualification.js` | `b3cf74128d3374116d1ae9b3db48d09371646f74a6371d6b43a7cdc7070d4a01` |
| `test/lib/rc1-historical-source-fixture.js` | `37e650a8745c425efabd4f2b2aa37814765ada8475545012378cb0ed350abd88` |
| `test/rc1-browser-board-refresh.js` | `b278190d135690c5b6db2d23030200cb9c383b3ac07eb30965277a7def510e5f` |

The final evidence packet indexes all 20 focused test/log hashes. The probe index hashes the 17 initial candidate rejection logs; each has a passing final disposition in that packet. These indexes are retained alongside the raw logs and are independently hash-checked.

| Retained final/failure evidence | Raw SHA-256 |
| --- | --- |
| `output/security/dashboard-game-parity-final-compatibility-hashes.json` | `3bcaa6f68b7b5061171e7cf115d2656da82e466d2b049c14dbf0077897e09b0c` |
| `output/security/dashboard-game-parity-source-envelope-results.json` | `ea3345a8d3f216f88d05d16f2137dd0134c099064a4877030e50a65bef1e283f` |
| `output/security/dashboard-game-parity-source-envelope-probes.json` | `628d6c428fb6f13a3985e245845f7dde9e55868ef58a65fcc95bbaa84c35902f` |
| `output/security/dashboard-game-parity-final-compatibility-static.log` | `c1f86f692dae905695f440d760789edb3bb98d9323a28fa17dc4c454063d22b6` |
| `output/security/dashboard-game-parity-consumer-diff-independent.log` | `f85b6c025ab6d5d412d7067354a351d6b06664ff0cdc9c2c734ba444dd9d7ffb` |
| `output/security/dashboard-game-parity-package-independent.log` | `aab67fe36fa3664f8bf0e91587748e46b2cc0b4643347c10c5287395b7b02e0f` |
| `output/security/dashboard-game-parity-city-gameplay-source-independent.log` | `f8ede4e9b1e08f59687eb5af89f2b8367b5dae9521737d57df2b170f808ae600` |
| `output/security/dashboard-game-parity-intel-independent.log` | `611ad7c867fb58679ee51756084852eba8d1cf782d064bd40f318ee6de7dfe5b` |
| `output/security/dashboard-game-parity-invoice-independent.log` | `0b0b7958994a45c38b7b0013cab12f852c3fdb2bcae3ec543bdf44f36c367cfb` |
| `output/security/dashboard-game-parity-rc1-lifecycle-independent.log` | `fba13ff4788187c9a7710b6be87e648a35ac0ee9cbe44977a6f47a19610f975a` |
| `output/security/dashboard-game-parity-rc1-historical-controls-independent.log` | `a56ed78af9ee3775864d6addf732f261b840fbf19d4f6fdfb488223c653f9889` |
| `output/security/dashboard-game-parity-rc1-harness-final.log` | `1b13bb63c8d9414540dd4b6816ee63396a05ab19d2a58091ce0d4ceb13c72110` |
| `output/security/dashboard-game-parity-rc1-harness-complete.log` | `1b36989f87b459185dc551a5163ce2d84bd10078245b41b227201d8e972d1341` |
| `output/security/dashboard-game-parity-docs-sealed.log` | `caa566ba74464c81821dc9da49783edc929ad6a658c6d18d9afae07b5f4c80b9` |
| `output/security/dashboard-game-parity-gates-sealed.log` | `aae07b2180cfa7e76005c70f644fd71d2b25ba26f74776c5eaa9fc0b93dc72ab` |

**Final disposition:** the bounded implementation and source-envelope review is complete with DGP-01 through DGP-04 resolved and no remaining confirmed finding in this scope. Release acceptance remains conditional on the unchanged full hosted CI passing on the final committed revision. No merge, deployment or production acceptance is established by this report.


## Hosted CI failure and source-consumer repair addendum — 2026-10-16

This addendum applies to candidate `e3211c2619b43a51b943626b35174cad3ab38e23` (authored implementation `554257d4`) plus the nine dirty test files pinned below. It preserves the earlier report hash `5f41d371ee7812e246cc9365df31108e8a3ffb2b95e2652f384e9ac92640e319` as a historical point-in-time review. Independent Git comparison confirms no delta from this candidate under `src/`, `tools/`, `public/`, `package.json`, `package-lock.json` or `schema.sql`. All 16 original final-manifest hashes also still match. These changes extend only the source-verification test scope.

### DGP-CI-01 — Deed source and metatest boundaries (resolved)

[Standard CI run 38975885236](https://github.com/OmertaDev/Omerta/actions/runs/38975885236), job `suites + sim (pg-mem)` (117225102826), failed the step `npm test (the full suite, on pg-mem)` at 2026-10-16T22:30:19Z. Node 22.23.3 reported `test/deed-quest-source-compatibility.js:28`: actual normalized package SHA `3d4005905e2ebb374e02be9f6ce70026110c4bfb2ec5f385a6c864b9844b508a` versus pinned predecessor `267a95d8f4178a850e61000f91349f71c93e3ea503b4d759dee61e361174b08a`. The dependent City/mobile browser job was skipped. The full hosted test suite did not pass.

The existing exact activity qualifier now wraps that fixture's raw source read. After this, two existing checks correctly exposed further mismatched comparison boundaries: the Git hunk collector still compared the actual working tree, and the next-layer preservation metatest retained the newly reviewed activity reader wrapper. Both intermediate failures are retained. The approved repair derives hunks from the unchanged immutable baseline/current blobs after the current SHA/blob assertions and an added complete-current-text equality to `git cat-file`. The original inverse-array equality and all old rejecting controls remain.

A test-local inspector admits only the exact next-layer test at e321: normalized SHA `71fbdfe52b0c1c1e4815d919e74bb86811595e61e0eaf36dcd432de2cb2aaa1d`, blob `840ae51c78eeed77a461c537cae6b86a3a48af21`, complete text equal to the immutable revision and blob. Exactly two unique inverses remove the activity import and raw-reader call. The entire inverse must equal f89 text, SHA `6fb23142f7dae80c8e51c214e7e75dbe62b9a506837eab52e14c564a16b69a98`, blob `8733aa2ed7a90a640474eedeaa179714af5bec78`. Only then does the unchanged older Deed inspector and complete-predecessor equality run. Reconstructed test text is never executed. The reviewer independently retested the final fixture: 13 closed domains, 47 inverse hunks and all 316 original negatives pass, plus two LF/CRLF positives and 14 current/predecessor/omission/duplication/raw/semantic refusals.

### DGP-CI-02 — Remaining direct source consumers (resolved)

The earlier symbol-filtered pretest scan missed the direct Deed qualifier and did not establish complete coverage of scripts invoked through the full test/harness graph. Independent and implementation-agent command expansion now agree on roots `pretest`, `test` and `test:rc1:harness`, recursively expanding npm scripts and applicable hooks: 14 scripts, 588 unique Node entry points, and 30 source compatibility/transfer/composition tests. The independent filename inventory contains 29; the separately inspected `test/economy-release-composition.js` is the 30th. No Node invocation in these scripts was left unparsed. This defines the focused consumer scope; it does not claim all 588 tests were executed.

The initial 29 probes passed 21 and failed eight, including the already diagnosed Deed check. Separate composition probing also failed. Seven additional readers were confirmed in company succession, logistics coverage, market feed, strategy league, strategy, third batch and fourth batch. Each repair, plus economy composition, only imports the unchanged activity qualifier and applies it before existing raw-source composition. Independent mechanical comparison strips exactly these additions from all eight files and reproduces each complete e321 test byte-for-byte after LF normalization. All original source pins, assertions, bodies, negative controls and target counts remain unchanged.

The fourth-batch failure came from applying historical inverse substitutions to unqualified current text, so some substitutions made no change and the existing rejection assertion failed. The corrected actual `worldRead` qualifies the text first. An independent witness extracts that actual reader expression and verifies every retained inverse is present and every unchanged mutation recipe changes the qualified bytes: 15 server cases and nine worker cases. The reviewer also ran the real fourth-batch test; all 24 mutations are rejected, alongside its original 195 negatives and retained package/Delivery/Depot controls. The economy composition independent rerun passes 19 domains and 566 refusing controls.

### Current evidence and release limit

The sealed implementation-agent packet records **30/30 focused tests passing** on this candidate plus the nine-file test delta. The reviewer independently compared the recursive inventories and verified every listed current source hash, final log hash, exit status and retained prior failure hash. Deed, economy composition and fourth batch were independently rerun; the other focused passes are reused evidence. All nine changed tests pass syntax and scoped whitespace checks. The runtime, helper, schema and package boundary hashes remain unchanged. Local reruns used Node 24.19.0. No full local harness rerun or full hosted success is asserted.

At this addendum's monitoring snapshot, liquidity recovery run [38975885263](https://github.com/OmertaDev/Omerta/actions/runs/38975885263) had succeeded; the four PostgreSQL jobs of the failed standard-CI candidate and Forge run [38975885151](https://github.com/OmertaDev/Omerta/actions/runs/38975885151) were still running. This is a point-in-time status, not a later result. Even successful unaffected jobs cannot satisfy the failed full-suite gate. The unchanged complete hosted checks must pass on the final successor commit before merge or deployment. This source-only review adds no native, migration, financial, economic, chain or production qualification.

| Final additional reviewed test source | Raw SHA-256 |
| --- | --- |
| `test/deed-quest-source-compatibility.js` | `58f605054b44cba05846ee03b1e017d2db25fbae6daa6267ebe0f0d822e2306a` |
| `test/economy-release-composition.js` | `6be4c9cb563e0796db0502779c807cf57b1ef46e1eaca5019dbb9c27d918ac30` |
| `test/rc1-company-succession-source-compatibility.js` | `a14b003e28793d60bb014be8132690223e0df914925907d95282e03d53c1572c` |
| `test/rc1-fourth-batch-source-compatibility.js` | `7181fafdc2807760cd5cfb17342b7a4d2e30b30f150fe9309659091693a7c885` |
| `test/rc1-logistics-coverage-source-compatibility.js` | `aa20724af4cb68a8769a8301f8aadf12501876bb789e62793006f6e7a456feec` |
| `test/rc1-market-feed-source-compatibility.js` | `195272ec289df95ce2ade93d851656362015c76be244ed6fa29aa9a9476e7e4e` |
| `test/rc1-strategy-league-source-compatibility.js` | `693002d41a16b883ada423650f7d96881aec2cd3c556bbb9fd8b6852d3618926` |
| `test/rc1-strategy-source-compatibility.js` | `88a8ce89f004a423e8c59dd2f5ec48949a6b0cbe567bccbd67003ff2af385070` |
| `test/rc1-third-batch-source-compatibility.js` | `d64b42e3cc31b9e0c21f2a8fb3f283fd3c8a270d1ac44d56959bcb9931a4af18` |

The sealed 30-test packet includes all individual final and prior-failure log hashes, candidate/baseline identities, and the implementer mutation-effect witness; the independent artifacts below are retained with it.

| Additional evidence | Raw SHA-256 |
| --- | --- |
| `output/security/dashboard-game-parity-ci-38975885236-failed-job.log` | `bcf71d36823b274840c1291c5898f2f0624d7109bb88cc27e804aab75831e856` |
| `output/security/dashboard-game-parity-ci-source-consumers-final.json` | `81f46a621c537b7850b65e1b50248c832de462fe35056a421d61feb0e17cc3d2` |
| `output/security/dashboard-game-parity-ci-consumer-inventory.json` | `2bff196ed3bb5d78596437db84eb51f17a7c65834619f7f99698bf7763bd91b8` |
| `output/security/dashboard-game-parity-ci-consumer-inventory-independent.json` | `bc5b0095d86c5f3659b21ebd82f2c6296e937927799bfed166551cc36d36d33d` |
| `output/security/dashboard-game-parity-ci-review-independent.json` | `3051b87a4e125e40cb9369a2b394b525b17fd25f08d0fd7c7810c22769596255` |
| `output/security/dashboard-game-parity-ci-review-static-independent.log` | `775707c218116fd8d349e42ecc0cc31a765fdbecd4a4ac294d614d08ec05ec59` |
| `output/security/dashboard-game-parity-ci-deed-independent.log` | `996feb79d82bbde11361bc429254fb4f10b76eb9db7cbee4bbcfa96b1f7b262c` |
| `output/security/dashboard-game-parity-ci-deed-final-independent.log` | `eb50d9e87fb3e79e565c304f50f97e3da1dfb09df680f20f3ea31a3a36fb6fbe` |
| `output/security/dashboard-game-parity-ci-deed-qualified-independent.log` | `6e8a867cd6a27516cdd77110b7bdb35522a472795468e2f146ad0d8c235b9401` |
| `output/security/dashboard-game-parity-ci-composition-independent.log` | `25929c437f9761b49e80ec7839c959da36d792eae04937b05dadf2f9b6333bc5` |
| `output/security/dashboard-game-parity-ci-fourth-independent.log` | `b72b0447c75a96ff5b51148ba140a5bf1ac2379473bb2db85ea88fcb74c2734f` |
| `output/security/dashboard-game-parity-ci-fourth-mutations-independent.json` | `267a4d71f22c811ba97ef19493d971ff94ceaf68238c9f06a167e96840b7bd18` |

**Latest disposition:** the four original gameplay findings and both CI compatibility failures above are resolved for their pinned scopes. The independent review of the nine test-only repairs is complete. The failed first hosted full-suite run remains in the record; a passing full successor CI run remains a hard merge/deployment condition.


## Combined candidate replay and source-profile review — 2026-10-16

### Revision, scope and preserved evidence

This addendum supersedes current-scope status only and preserves every previous finding, failed attempt and source hash. Its preceding report was SHA-256 `cc77584788c711e2013abfb9e3557240010ceca607f9b3513df9e81d65268643`. Integration anchor `3217dd945b5c5641ab0414630c58c1f97ef40ec1` merges parity `fdcfc052` with the queued market source `b6be98c7e0233c4b35a74467828e24080b16b0eb`. The three conflict resolutions were independently compared against both parents. All incoming assertions remain; parity assertions are retained with explicit historical Deed reads, the correct Deed-normalized inverse probe, and the composed current source reader. Historical executable bodies and database/network/native exclusions remain unchanged.

This is a bounded integration review of six replay runtime/DTO files, seven associated tests, six source-profile/tool/fixture files, and the anchored server/package/next-layer reader boundaries. It is not a new audit or native qualification of all incoming economics. Thirteen of the original 16 final-manifest files remain raw-byte identical. The expected differences are the merged `src/server.js`, merged `package.json`, and expanded `test/city-activity.js`; the current hashes are below.

### DGP-COMBINED-01 — Durable domain replay could publish a new owner cue (resolved)

The newly composed cross-docking, production-slot and merchant-return domains returned an original stored receipt after the transport idempotency row expired, without the trusted `replayed:true` marker. The response had no transport replay header, so the actual server could replace a newer owner Banking cue with a fresh Action completed cue even though the old domain receipt caused no new canonical action. This is a medium presentation-integrity/regression finding within the activity boundary, not evidence of a repeated payment or item transfer.

The repair changes exactly four return sites across three runtime files to return a fresh shallow clone with `replayed:true`. Fresh success keeps the original shape, and stored receipt values are not rewritten. Independent mechanical reversal of only those four expressions reproduces every other byte of the anchor runtime, including all receipt writes, identity/body conflict checks, lifecycle gates and economic operations. The three DTO modules add an optional `const:true` marker to exactly six mutation receipt schemas. Independent schema comparison confirms all prior required lists, closed property rules, board schemas and existing properties are preserved. No request schema or new mutation authority is introduced.

The expanded existing City activity test uses actual loopback HTTP through all three real server registrars. Nine genuine funded mutations cover human and agent identities and all six receipt schemas. It establishes a fresh cue, replaces it with Banking, expires/deletes only the completed transport row according to the existing 24-hour policy, and repeats the original account/key/body. It then asserts no replay header, the durable marker, the exact original payload, the unchanged newer cue, identical canonical economic state and domain rows, identical stored receipt bytes, observer privacy, and no public activity event. A subsequent cached replay also preserves state/cues. Generation turnover separately proves an old receipt cannot animate a later generation. All six schemas reject false/string markers and unknown properties. Small market DTOs remain below the real compression threshold; the existing genuine compressed command-response test still exercises gzip replay inspection. The fixtures' synthetic IDs use the canonical private intel helper, with known-name verification, so redaction cannot mask an accidental observer cue.

The reviewer independently reran `node test/city-activity.js`: all earlier lifecycle/redaction/allowlist/replay/travel tests and all nine new HTTP cases passed. A retained negative-control loader restores only the four old return expressions in module-loading memory. That control fails at the exact real cross-dock offer replay: the newer Banking cue becomes Action completed with a new timestamp. Repository bytes are unchanged by this control. Its loader and failed trace are retained.

The first full market memory attempt exposed an additional stale exact receipt comparison in `test/crossdocking-estate.js`. That failure is retained. The approved repair asserts `replayed === true`, fresh receipt marker absence, and complete equality of every remaining original receipt field. Independent whole-file comparison proves every surrounding estate/economic/identity assertion is byte-for-byte retained. The exact 22-command script and native race branches were inspected; remaining exact HTTP-cache replay and unrelated-domain comparisons stay unchanged. Native merchant same-key race expectations retain exactly one fresh result, one marked replay, and complete canonical payload equality; this local run does not claim native race execution.

The six direct focused commands, focused estate retest, and repaired unfiltered `npm run test:agent-economy-market-operations` all passed. The latter executed all 22 declared commands and reached final world-graph validation with exit 0. Memory-only limitations printed by native-gated tests remain applicable. No full local release harness was rerun or represented as passed.

### Exact combined source comparison and retained fixture guards

The new test/tool-only `tools/rc1-city-activity-market-source-compatibility.js` admits exactly two files: `package.json` and `src/server.js`. It binds complete current text, LF/CRLF raw hashes, normalized SHA-256 and Git blobs to immutable anchor `3217dd945b5c5641ab0414630c58c1f97ef40ec1`. Exactly three package script inverses and five server inverses reconstruct complete immutable predecessor `b6be98c7e0233c4b35a74467828e24080b16b0eb`. The inverse definitions are asserted equal to the unchanged earlier activity inverses. Script keys, complete entry hashes and inverse occurrences are unique; full predecessor text/SHA/blob must match. Unknown domains and altered bytes cannot acquire qualification; mixed/bare-CR inputs are rejected. Reconstructed source is compared, never executed.

The old activity helper adds only the new exact-profile dispatch; independent removal of this import/dispatch restores its complete old source and pins. Current package/server are checked separately from the retained original activity controls, which now read their unchanged immutable blobs. Independent reversal of the new test block and those two input selections restores the full previous world-qualification test. The actual current joint controls pass four LF/CRLF positives and 54 raw, omission, duplication, reordering, semantic, line-ending and domain refusals. All previous controls and the ten closed Coverage guards remain and pass.

The Deed metatest separately pins the complete anchor next-layer test (normalized SHA `93680640a6e868c89f14421d63b55b74dcd5a3442c1e22eccb165f7d63887463`, blob `8878ffb12bde51589a0683761f714e50002bbc81`) and exactly three Git-derived inverse hunks to e321 (SHA `71fbdfe52b0c1c1e4815d919e74bb86811595e61e0eaf36dcd432de2cb2aaa1d`, blob `840ae51c78eeed77a461c537cae6b86a3a48af21`). Only then does the unchanged e321-to-f89 inspector execute its original comparisons. The new joint reader has two LF/CRLF positives and 21 refusals; the prior two positives/14 refusals and all original 13-domain, 47-inverse, 316-negative Deed controls pass. The market source consumer adds only the outer activity reader and a corrected assertion label; all old assertions remain.

The historical fixture adds the exact combined proof alongside retained activity/frozen inputs. Independent rejection-mode execution passed: helper guards 18 positives/23 refusals; activity helper 4/26; application 40/177; activity 10/51; independent C2 rule refusals 18. The final loader's admitted entry/dependency set, frozen execution bodies, raw native refusal and database/network exclusions are unchanged. This does not inherit an old source-pair qualification: the six runtime/DTO files are included in the source-pair reviewed-tree identity, so their changed bytes require the actual new candidate's evidence.

Independent traversal of the actual npm graph found 15 scripts, 610 unique Node files and 32 source-comparison consumers, with no unparsed Node commands. All 32 focused consumers passed. The sealed packet is SHA-256 `ed852910ac321f117db35418a1044e073f2761e5666532753c90099563128ad0`; the reviewer verified its exact consumer set, all 32 current source/pass-log hashes, all six profile hashes and all 12 retained evidence hashes. Earlier combined failures remain in that packet. Syntax and whitespace checks pass across all 19 changed implementation/test/profile files.

### Earlier CI remains separately scoped

The original e321 full workflow `38975885236` failed its full-suite source fixture; the browser lane was skipped. Both original native economy jobs completed 17/17 steps successfully (18.4 job `117225103024`, 16 job `117225103107`), and liquidity run `38975885263` passed. Their full economy logs and a pre-successor snapshot are retained. In that snapshot, core 18.4 had 41 successful steps with buyer cooperatives running; core 16 had 43 with commercial reputation running. Forge run `38975885151` had completed compilation and was still in unit/fuzz. Those running lanes are incomplete at this report freeze. Any later auto-cancellation/supersession remains incomplete, never a pass. No old e321 result grants combined runtime/native release acceptance. A fresh full hosted run on the final combined commit is the required merge/deployment gate.

### Combined source and evidence freeze

All values below are raw working-tree SHA-256. The machine-readable combined source manifest also preserves normalized LF hashes and Git blobs for later line-ending-aware commit mapping. The anchor alone does not identify these uncommitted repairs.

| File | Raw SHA-256 |
| --- | --- |
| `src/crossdocking.js` | `9ecb0396c7ccf0bcaf2fea63c6de6e8189afbcee495c4d367e6793b898ba5dd2` |
| `src/crossdocking-contracts.js` | `4307955053c2de199373898759009da9535321216bcfb746cafd859d8b37bfc1` |
| `src/productionslots.js` | `ca4ee0c3083e6d8bc697227e8669fca409b76ea79513635a2137f930ff83cf30` |
| `src/productionslots-contracts.js` | `978a9b6ed59a5b488539278124639d5fecde4b1fa6e714787e16e257ad81edd1` |
| `src/merchantreturns.js` | `0960bf84cffec76e1cfbebef7793ec7e78f905a24a4dfab3ad2b0d67f3ffd767` |
| `src/merchantreturns-contracts.js` | `f088fd22a8ff00d6e04609a515a5bd00694c388b836b535b6117bafdc328d227` |
| `test/crossdocking.js` | `86b6885503111605e546268c2ffeb528756c2d1ea506022ce5327cac8845445d` |
| `test/productionslots-recovery.js` | `624e64493227de897c9b956f58eae6183fb0ef65f9d778015416cc75fdecc189` |
| `test/merchantreturns.js` | `07eba6d3f45f2d4032468104e663c57bfdf4479750aba91a9b637e5c93498bc1` |
| `test/merchantreturns-api.js` | `8c01ceb916d1dec13583bddada148bc5557cc2074dc8630c482182b07a254001` |
| `test/merchantreturns-fixture.js` | `e35015d50cb65f321fb8a5c8d1be167fe39f425deb33b59e846684ebc9b0fc24` |
| `test/city-activity.js` | `5a97cb06a1d907d47a633ddde9cabd9851ef2d157b73624dff846dc3f5070adb` |
| `tools/rc1-city-activity-market-source-compatibility.js` | `af060a1c044e8b3e7d4ce0d9c2cf952597e835972fd95fcfbfede00e0aec2caa` |
| `tools/rc1-city-activity-source-compatibility.js` | `27752c326c43b94e3b8112d819cc62350f147e23e22966115932e5ac7025b00e` |
| `test/rc1-world-qualification.js` | `56c577548a6db66b342f4feee31aae7329c8c5165176d12c0e24aa40607b2bb5` |
| `test/deed-quest-source-compatibility.js` | `e0426a2ff6041b4efcedd755774d1a71ad4df530c5fe65b497d1d3ecb7ef8c3a` |
| `test/lib/rc1-historical-source-fixture.js` | `cf568ef9eea86e61bfa7a8777258b2a92069a9c8218924af6a7a5eb93d804165` |
| `test/market-operations-source-compatibility.js` | `e0b5757cf38b42cf91f848cbb05159eed7a6d7c54e738a1cdf9138951723a85b` |
| `package.json` | `7fe1b97dbb21bf1c1a38cd1462ce4981cf309dae9109f7b8d504110c5f1441bf` |
| `src/server.js` | `1d62fc2332e9a3973073d01c3e6eade107e3a86db9162d370be5ccc2255734f7` |
| `test/next-layer-source-compatibility.js` | `58258a0f5a34b18dc4812ff34004a87313f0fdee34a10df79fa214500a5e3fdb` |
| `test/crossdocking-estate.js` | `1ea2972225975ebc9bb8a40daec12013df741950215edc3cb3a191b96de8f824` |

The evidence index is `output/security/dashboard-game-parity-combined-evidence-independent.json`. It records the following retained files without rewriting earlier evidence.

| Evidence | Raw SHA-256 |
| --- | --- |
| `output/security/dashboard-game-parity-combined-sources-independent.json` | `6e13469c676f69543eb392de11a0da3e5075ea6f3c6f7b24d03bd3add416fada` |
| `output/security/dashboard-market-replay-owned-hashes.json` | `28c7b27045b4dd974938a8272aa75bb23e33982a1bd3a5bf9afbf7e0c808aca7` |
| `output/security/dashboard-game-parity-combined-runtime-independent.log` | `7ddbcbc646ed3cd9c2bf5114edde6b1f53f734666bae68c50436242b3214265c` |
| `output/security/dashboard-market-replay-direct.log` | `d5074a707711b13afd43b84f80c92d81052733a528c2f65661885751124e7392` |
| `output/security/dashboard-market-replay-city-activity.log` | `bc10865207b23ceb086da2af06c1d4db93e333e62691d3420c380b5bcd38d422` |
| `output/security/dashboard-game-parity-combined-activity-independent.log` | `ff551192c4cb4bc76c497918c962919439aff1852617eaac618cccb2eb109437` |
| `output/security/dashboard-market-replay-negative-loader.mjs` | `db5da490fbb5c98903776ea18cee3e159af183bfa44c410cbcd3f7dcf3b5c97e` |
| `output/security/dashboard-market-replay-negative-control.log` | `f3a67e7c645431bd1eec6c532c27301fe46f7d6f906c2f66e10765c678e99788` |
| `output/security/dashboard-market-replay-full-memory-attempt1-failed.log` | `dfa0f5cbcc4635b6d4ebec4298fdd8030ba966cd1741578b87b8f125179df147` |
| `output/security/dashboard-market-replay-estate.log` | `90210868835216ca7274fcdf5bc23017eb2fda315611798952f7f0b7b4bdab35` |
| `output/security/dashboard-market-replay-full-memory.log` | `e7b680872a6b731c9eea17e075c45aa78cd2b19489b488ccbbd0e0e599b3f3fc` |
| `output/security/dashboard-game-parity-combined-estate-independent.log` | `2701a30257ae2a2c8c09b167db97fdbf0388a44525e7028ed249671c250eddec` |
| `output/security/dashboard-game-parity-combined-static-independent.log` | `7d4fbd8f4aae3a56985f0c3a3a6f34f9eba9e1435c70fe46204eb3f5f635e0e2` |
| `output/security/dashboard-game-parity-combined-estate-static-independent.log` | `afcc6cb40dcfb2ef8281f7ac628fa804a620986be4d23b7ae6cb948ce4a318f8` |
| `output/security/dashboard-game-parity-merged-source-profile-snapshot.json` | `9f768f9909d56dabf8075e2ec4b72424fbd7f771ce16f5466d888c883b83ee61` |
| `output/security/dashboard-game-parity-merged-ci-source-consumers-final.json` | `ed852910ac321f117db35418a1044e073f2761e5666532753c90099563128ad0` |
| `output/security/dashboard-game-parity-combined-final-packet-independent.json` | `1ad83b2ac566e87e39ae6e0eeb1a570cf49a1f82cb1dcc1b1c5c9672285f0e50` |
| `output/security/dashboard-game-parity-combined-inventory-independent.json` | `bbca2d0dcc867d73a2295fa284cc9a27f93e7e94ea34cd07644c6b5b224b3430` |
| `output/security/dashboard-game-parity-combined-preservation-independent.log` | `8642670fa461707eae45124c895de0222d9eed62ae7c968dfd71a4ec3b9a909d` |
| `output/security/dashboard-game-parity-combined-world-independent.log` | `79d28f37142154750bf2326d8325ae5bf7a2cbefe1493c85b2ee8a751868c5a6` |
| `output/security/dashboard-game-parity-combined-deed-independent.log` | `6e685e33d0e49525bcb96ebadc42cded07a9d975b1040c4efdf9e27f0330a8cc` |
| `output/security/dashboard-game-parity-combined-fixture-independent.log` | `6293af7db1440d7d24911ac6929a656e25b9ab794f19c8ac504ee5c61b89296c` |
| `output/security/dashboard-game-parity-e321-pre-successor-snapshot.json` | `e785138fe5cf377efb9df3979aa5e48678e9be571f80928401e0daff089bc032` |
| `output/security/dashboard-game-parity-e321-native-economy-18.4.log` | `6ac6b2ccb86f6bfe80aaf04c4eb14e2f212449da2b2511fb68b1ffe0ba94fddf` |
| `output/security/dashboard-game-parity-e321-native-economy-16.log` | `0c91e819907bef7df0330f2f8a2d8e515f5dba2fdbdbd6702a99dc6c690a6173` |

**Latest disposition:** the bounded combined runtime/DTO, actual HTTP replay, fixture and source-comparison review is complete with the confirmed findings resolved. The repaired 22-command market memory suite and 32 focused source consumers pass; historical failures remain preserved. Final combined full hosted CI and its required native/browser lanes remain pending hard merge/deployment gates. No production acceptance, onchain acceptance or inherited economic/native/source-pair qualification is asserted.


## Hosted diagnostic ordering and race-fixture repairs — 2026-10-17

Reviewed working tree is based on full commit `0b01a6a92672f833ce1db32c21e8de4e005f2621`; the exact five reviewed source hashes and retained evidence are in `output/security/dashboard-game-parity-ci-repairs-independent.json` (SHA-256 `f0211761713fdc8a812d9d4b4d10eddaed006c9cf10e0fdccdb1318443616fce`). This is a pre-release review of two runtime diagnostic changes and three test changes. Root independently inspected the complete diff, actual callers, hook ordering, async-context boundary, race refusal path and retained assertions. The prior report bytes and all historical conclusions remain preserved above.

### DGP-CI-03 — Required response diagnostic waited behind optional activity (resolved locally)

The complete hosted npm suite passed, but the subsequent RC1 observability check failed: the command route response hook ran after a global optional City actor read. Moving the existing completion hook into earlier registration preserves request-specific diagnostics without waiting for that read. An explicit absent-trace return prevents unrelated routes from using inherited async-local diagnostic context. No request data, owner identity, response payload or new diagnostic fields are logged.

The regression holds the real after-response actor read, preserving every original timeline, privacy, denial, replay and failing-log-sink assertion. Old ordering fails while the read is held; the repair passes. An actual untraced health request under inherited context emits no command diagnostics. The standalone director API test also passes. Syntax and whitespace checks pass for all five changed files. No accounting, authorization, contract or schema implementation changes are part of this repair; financial fuzzing and contract analysis are outside this diagnostic-only runtime delta.

### DGP-CI-04 — Passive-projection VM lacked current API dependencies (resolved locally)

After the ordering fix, the chained passive-projection test failed because its extracted API function requires uuid and scheduleCityPresence. The fixture now supplies a deterministic UUID and inert presentation scheduler. All original client invalidation, server-hint and gameplay-invalidation assertions remain intact. The complete unchanged test:rc1:observability command passes both children. The intermediate fixture failure is retained separately.

### DGP-CI-05 — Native sale race over-specified its immediate refusal (native retest pending)

Exact original source diagnostic run38986480879 failed on both PostgreSQL16 and18.4. Commission acceptance can expand the discovered actor union; the existing runtime then correctly refuses the concurrent sale with the exact400 contention response before settlement. The test previously demanded commission_accepted immediately. The test-only repair retains exactly one initial200, allows only that exact contention as an intermediate response, retries the unchanged sale path/body/key once, and requires the exact final400 commission_accepted plus an unchanged full commission row. Original ownership, zero-sale-journal, reserve100, cash, refund and global invariants remain. Runtime concurrency and idempotency behavior are unchanged.

The memory test passes, but its native race branch is unexecuted locally. The actual failed native logs and encrypted artifacts are indexed in output/security/dashboard-game-parity-depot-diagnostic-failure-receipt.json (SHA-256 fdb1c923c75728842f8a67b553bee713d294ae4aa586537919093f3028eeea2d). The repaired native branch must pass on the successor.

The five changed files are not historical source-transfer domain keys. Embedded unchanged package-command strings do not require pin adaptation. Current native and source-pair inventories must record the actual successor; no older source is aliased to these bytes. Full successor CI, browser, required native checks and the production source-pair/cutover remain outstanding release gates.
