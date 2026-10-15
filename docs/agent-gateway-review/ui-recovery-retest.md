# Consigliere recovery control retest

Date: 2026-09-21. Phase: final bounded UI correction after the Gateway added authoritative receipt recovery from any noncompleted metadata state. The root's backend and PostgreSQL review are separate; this check exercises the browser against the actual mounted server with disposable pg-mem.

The UI offers **Retry approved action** for unexpired pending attempts, with copy explicitly stating that retrying may execute the approved action. It offers **Check action result** for expired pending, refused, and executing attempts with saved results. It no longer asserts that pending metadata proves an action did not execute. Untouched expired proposals remain disabled. The existing confirmation endpoint remains the authority: it recovers a durable receipt or refuses terminal/expired proposals without a receipt.

## Executed evidence

```powershell
node --check public/consigliere.js
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node test/consigliere-recovery-browser.js
```

Both commands exited 0. Browser output:

```text
[db] pg-mem in-memory database (set DATABASE_URL for Postgres)
consigliere-recovery-browser: explicit pending retry label, expired pending/refused recovery, neutral outcome copy, untouched expiry, and no-receipt refusal pass
```

The test first commits a real coordination command through the player UI. It verifies an unexpired pending attempt displays the enabled **Retry approved action** button and explicit execution copy, with no automatic submission. It then simulates delayed concurrent refusal metadata (`pending`, then `refused`) on the committed proposal and sets its expiry in the past. In both cases the explicit browser check recovers completion without creating another authoritative command. The test separately verifies an untouched expired proposal cannot be submitted, and a check on an expired refusal without a receipt returns 409 without a new command. No browser exceptions occurred.

## Source checkpoint

| File | SHA-256 |
| --- | --- |
| `public/consigliere.js` | `d44808269c18b4884aed4b54cc43b5314f640c58e2b1dcde2287f87674faddfd` |
| `test/consigliere-recovery-browser.js` | `ca7f92cfd5793b1bd4c807eb4fe2820b06e6771b92679c8e27940be2aa957a92` |
| `src/gateway/service.js` | `53cf398350bebf069404f32d08c14a93fc38b92706cee2272f0aea225245840e` |

This retest establishes the corrected UI recovery behavior at this checkpoint. It does not independently prove PostgreSQL concurrency or native Muse integration.
