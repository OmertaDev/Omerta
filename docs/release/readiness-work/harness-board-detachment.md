# Browser helper detachment timing

Owner: Codex/native_harness. Changes are test-only, based on root `a95801f9`. No production client changes, force-clicks, production DOM removal, reduced assertions or submitted-command reissue were introduced.

## Retained failure and causal limits

The unchanged `golden-f8b9b0d1-1` evidence at source `f8b9b0d19629abc3f8875ee533d80dd424d5f9bd` passed320/360/390px, then failed430px after32 commands at `Commit: Mat wire`. Its assertion was `Selected command detached without an observed board refresh`. The log contains a command-board authorization immediately before the assertion and its response afterward. That run has no per-command board-read/DOM timeline, so its precise triggering interleaving remains unproven. A diagnostic-only430px run passed50 commands and did not reproduce the intermittent detachment. These facts do not establish a product fault or prove a benign repaint was the original cause.

Two concrete helper gaps are independently reproduced using the actual, source-pinned production `createProjectionRefresh` coordinator and authenticated `api` queue in a controlled browser/HTTP fixture:

1. After the helper checks its GET generation, it awaits `selectedNode.evaluate`. A real refresh can start and replace the node during that protocol round trip. The old helper asserted detachment without rechecking the generation. Controlled trace: selected board10, observed reads11, connected false, zero submissions.
2. The canonical coordinator clears controls before the authenticated request queue starts its GET. A real HTTP gate holds an earlier request; the selected node detaches while both read counters remain13 and the visible board is loading. Releasing the gate starts the actual GET. Loading and later request are both observed, rather than inferred from detachment.

The controlled fixture intercepts only the test driver's connectivity-read boundary to place the timing deterministically. It retains the actual selected ElementHandle, source-pinned coordinator/queue, real HTTP and normal subsequent browser click. It is a helper lifecycle proof, not native gameplay evidence. The coordinator source SHA256 is `a693944e6e8bde4e4bee829865ce813ec588d860bf5e45fad95545fecc48b2da`; API queue SHA256 is `61ffdfc08a79dca5491f95abf333f1fc9c9d125f344206a5233063ecaddeeba7`. Changed extraction sites fail closed for review.

## Repair and controls

The helper rechecks the observed GET generation after the awaited connectivity evaluation. If a detached or unavailable control has the actual rendered loading state while its GET is still queued, it waits at most5 seconds for a real `/v1/commands` GET. A loading message alone cannot authorize reissue. Every refresh recovery checks zero new execute submissions before and after its diagnostic read. The existing one-reissue limit and exact submitted execution identity remain enforced.

Both causal windows reproduce the old assertion with zero submissions at `d5bd8968`; after repair at `2de580f1502e26ed7dcad02fb3d69ea34cbea11f`, each becomes a recorded pre-submit refresh, followed by a visible fresh snapshot and exactly one submission of that newly selected identity. Negative controls still fail for unexplained same-board detachment, loading with no subsequent actual GET and a submitted identity mismatch. The mismatch submits once and is not retried. The prior test proving an unpinned Locator can select the wrong refreshed board remains present.

Bounded diagnostics retain only timestamps, request/response counts, board generations, submit counts, loading/summary state and button counts; no tokens, issued IDs, private DOM text or request bodies are logged. The browser helper now records them on detachment/recovery.

## Source-bound evidence

Restricted root: `C:/Users/Jorge/.codex/rc1-readiness-private-20260921`.

| Evidence | Source/result | SHA256 of results/output |
| --- | --- | --- |
| `golden-f8b9b0d1-1/results.json` | Original retained430px failure | `d523a62481c4e23812c5cb17e5c2d8aedbfac209e59b7a82d0bbb5e73eb95931` |
| `golden-fde1fc33-430-diagnostic-1/results.json` | Diagnostic-only `fde1fc33709c7a6985c40b2aa7f6ad4abdbbc67f`; clean source,50 commands/6 interactions PASS | `cbe7fb9fb7909d670eac4e1ec900fbfff2b27299f0a23037b729746b9910f7e3` |
| `board-refresh-cc7b198e-controlled-before.txt` | Retained preliminary control failure: stale network-idle receipt assertion; no release pass | `fbb10ed7ea068b6eb1fdc7c0399bb6a9a5b6227abfab1a31ce05e19f04e828eb` |
| `board-refresh-controlled-before-2.txt` | `d5bd8968`; both old helper failures causally reproduced after explicit request barrier repair | `b694872c179204baf99e5a462baa843800f79adea0e6fd88affc5029b6e53c56` |
| `board-refresh-controlled-after-1.txt` | `2de580f1502e26ed7dcad02fb3d69ea34cbea11f`; repaired controls PASS | `b62e3aa3eba03e54b443b84ec0fb735f521ef8b36aebb170fc039e4a0a876aa0` |
| `golden-2de580f1-430-retest-1/results.json` | Same clean source; native430px50 commands/6 interactions PASS | `fc20b3804fdd3adf8048098ed2d904b2087d42db180f8cb79ee89ad497d99581` |

The fixed native retest retained two actual refresh recoveries, board epochs47→48 and27→28, each with zero submissions before reissue. All selected native world/operation invariants passed and both new native fixture schemas were independently confirmed absent after cleanup. Chromium153.0.8010.48, Node24.19.0 and PostgreSQL18 were used. The fixed run's helper byte hash is `5abc9ae9f0a709bfc3a4ed1c771bd201129d36028f89ad0dfc7e85a929e83619`.

`board-detachment-independent-index.json` retains all109 original/new evidence files,141,030,071 bytes, with exact hashes. Index SHA256: `d567a98019e5dce596be4ec7a9a4d44dee3aa8bce40ff4c845ad156f1bc1ef2e`. Original failures and their source identities remain unchanged.

```powershell
node test/rc1-browser-board-refresh.js
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55441/rc1_native_harness'
$env:RC1_PG_BIN='C:/Program Files/PostgreSQL/18/bin'
$env:RC1_GOLDEN_BROWSER_WIDTH='430'
$env:RC1_GOLDEN_BROWSER_OUTPUT='<fresh restricted output>'
node test/rc1-golden-browser-postgres.js
```

`RC1_EXPECT_DETACHMENT_RACE=1` was used only at the recorded pre-repair source to retain the expected old assertion. Normal tests require the repaired behavior. No four-width rerun was performed on this isolated source; final integrated-source qualification remains separate.
