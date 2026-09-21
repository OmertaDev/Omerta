# RC1-CREW-INPUT-01: pending Crew render destroys active draft

Severity: **P1 release-blocking critical-path UI defect**. An ordinary Crew tab
entry may leave the previous panel visible during canonical reads. A player can
start a message before the final read finishes. The old renderer then replaces
the focused input, silently loses its draft and selection, and sends focus to the
document. This affects message entry and keyboard continuity; no economy or
currency mutation is involved.

The native causal control at source `a102590596c4f5cd690d900f944f8c17c4d938d6`
held an actual `/v1/circle` response unchanged after normal tab entry, entered a
draft, focused it with a reduced viewport, and released the response. The
retained trace shows `renderCrew` replacing the connected active input:
`sameNode=false`, `focused=false`, `value=""`, `priorConnected=false`.
The controlled transport delay chooses an interleaving; it does not rewrite
server state, response bytes, clocks, or gameplay outcomes. Initial actor/social
fixtures remain explicit. The hosted PG16 focus assertion has the same possible
failure surface, but its exact cause is **inferred**, because that earlier hosted
log contains no causal DOM trace. The separate hosted PG18 phone receipt finding
is tracked as TOOL28; this repair does not address that pending-notice race.

Runtime repair commit `df5cc3d4cc42d5800879652ce88989332bd9aade` checks current
Crew render ownership and active editing immediately before committing DOM.
An active field defers replacement until the existing focusout refresh path can
fetch fresh data. Newer Crew renders own the panel; an older response cannot
overwrite it. The native regression verifies node, draft, focus and selection,
fresh reads after keyboard focusout, and an older response completing after a
new Crew entry has started. Authenticated requests are serialized, so the test
holds the newer read after releasing the older one; it does not claim impossible
reversed wire completion within that queue.
It does not claim every renderer or possible focus race is repaired.

A separate native run at `257212c47cbafa9d59d7cb0da3c866bb820e3bc9` passed the
focus assertion, then failed control reachability because a finite `#toast.show`
covered Crew Send. The helper now waits once, at most 5 seconds, only after the
actual hit test observes a non-actionable toast. It then repeats normal geometry
and hit tests. It does not remove an overlay, force-click, retry focus, or reduce
the 44px minimum. Controlled tests retain hard failures for actionable, unknown,
non-disappearing overlays and a 43px target.

Required reruns on each integrated clean source: `node test/rc1-browser-controls.js`,
`node test/rc1-browser-receipt.js`, `node test/rc1-browser-toast-controls.js`, native
`test/rc1-golden-focus-race.js`, and native `test/rc1-golden-browser-postgres.js`
at widths 320, 360, 390 and 430. Native tests require a dedicated PostgreSQL DB,
`COORDINATION_TEST_DATABASE_URL`, and a private `RC1_GOLDEN_BROWSER_OUTPUT`.
The causal test also accepts `RC1_GOLDEN_BROWSER_WIDTH` (default 320).
Hosted golden/phone and PG16/PG18 release lanes must rerun after integration;
local evidence is not hosted or deployment clearance. Failed native reports,
source hashes, manifests, passive focus/render traces and screenshots are retained
outside the checkout. No raw actor identifiers or tokens belong in public reports.
