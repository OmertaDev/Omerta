# RC1-05 native phone golden journey segments

Owner: Codex/source_repairs. Phase: local prerelease browser regression, not full RC1-05 acceptance.

The new test uses an isolated native PostgreSQL schema per viewport and an actual Chromium browser against the production HTTP server. Required widths are 320, 360, 390 and 430; heights are respectively 568, 800, 844 and 932. Initial actors, cash/respect, two established Families/Crews, a scarce dock route and salvaged materials are explicitly prepared before a retained canonical-state baseline. That setup uses the existing domain fixture, including a declared successful garage roll. It is not natural-entry evidence. Every measured player mutation after that baseline comes from an ordinary rendered control; only a declared Director tick uses the canonical worker service directly.

The connected path covers these automated segments:

- C: recruiting, an ordinary join request, leader approval, normal Family entry, joining operation roles, contributing with others and reaching visible shared readiness.
- D: acquiring incomplete tide evidence, crafting the required route seal, revealing the survey, proving one actor cannot invent independent corroboration, sharing a second actor's source through Crew permissions, and revealing the combined conclusion.
- E: two Families prepare competing operations for the same scarce route; the winner executes, the rival loses availability, and its leader cancels the remaining operation. Both operations reach a canonical terminal state. A member's browser board must not contain the rival's private operation ID.
- B: a participant's browser context closes before another actor executes. On returning, the member sees the actual changed world state, newly authorized consequence and an available next action. Reload without intervening activity cannot satisfy these assertions.

Every measured command checks the exact issued execution identity and completed HTTP response plus a rendered receipt naming the action. Critical controls are checked for a 44-by-44 minimum hit area, viewport containment, horizontal overflow, interfering overlays and multiple managed dialogs. Legacy social/travel controls use real touchscreen taps; Command Center actions use ordinary Playwright actionability-checked clicks. No force clicks, programmatic DOM click or hidden-element removal is used. Focus retention is exercised with a reduced 420 px viewport, then restored; this is CSS/focus emulation, not proof of an OS keyboard or touch-scroll behavior.

Historical nonpassing development attempts remain retained locally. Early initialization captured the wrong fixture mode and was aborted; the final harness explicitly admits only a private native PostgreSQL schema. Later probes exposed DOM replacement, modal-transform measurement timing, and coordinate command taps that emitted no request at narrow widths. The harness now bounds stabilization, waits for the required hit area, and uses the established command-control actionability path. No runtime or interface change was made, and these observations are not promoted to passing evidence or a proven product root cause.

Human comprehension, physical iPhone/Safari and Android/Chrome, external wallets, natural low-resource entry, all responsive surfaces/list sizes, all loss/expiry branches, and full A-E acceptance remain outside this test. Existing latency/lost-response and authorization/concurrent-revocation suites remain separate evidence; their absence from this browser test does not mean those other tests do not exist.

Reviewed test commit: `870f131bada3c401410394dc77b6af0a6ebb2b9a`, clean before and after the full four-width run. All four widths passed: **200 rendered Player Commands, 24 social/travel HTTP interactions**, zero uncaught browser errors, and passing World Kernel/Family operation invariants. Total observed duration: 500.665 seconds. Each width includes eight retained milestone screenshots and text captures. This duration is a functional test observation, not a load-performance claim.

Reproduce with `node test/rc1-golden-browser-postgres.js`, explicit `COORDINATION_TEST_DATABASE_URL` pointing to an isolated loopback PostgreSQL database and a new `RC1_GOLDEN_BROWSER_OUTPUT` directory. Optional `CHROMIUM_PATH` chooses the browser binary. `RC1_GOLDEN_BROWSER_WIDTH` selects a development subset and is unset for the four-width result. The harness creates/drops a unique private schema and rejects reusing its evidence filename.

See [the source-specific record](golden-browser-regressions.json) for versions, assertions, source and artifact hashes, exact scope and retained failure disposition. Raw local outputs are in `output/rc1-golden-frozen-2`; final CI/source capture remains the integrator's responsibility.
