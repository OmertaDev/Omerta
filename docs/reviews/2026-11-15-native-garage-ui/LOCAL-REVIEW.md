> Historical local-workspace review. Its retained pins describe that point-in-time scope. The final explicit-wallet release and its current source pins are reviewed in REVIEW.md.

# Native garage UI integration review

**Phase:** scoped local integration verification complete, including the real Anvil UI rehearsal. Mainnet deployment is **false** and production activation is excluded. Starting HEAD is `e56cf576065c5f1bbb9bb55115f5961267f7d654`; the working tree is dirty. [Source pins](evidence/original-source-pins.json), rather than HEAD alone, identify this reviewed implementation. A separately tested controlled-release revision needs its own package pins. Earlier contract review packages remain historical and unchanged.

## Scope and adapted methods

Reviewed `src/nativegarage.js`, its `src/server.js` route/static mounts, `public/nativegarage.js`, `public/nativegarage-client.js`, `public/nativegarage.css`, the `public/index.html` integration, and five relevant UX guards: `noir-shell.js`, `strategy-command.js`, `ux-identity.js`, `ux-navigation.js`, `ux-progression.js`. The browser fixture is `test/nativegarage-browser.js`. Existing auth, wallet discovery, the game read wrapper, viem ABI encoding, and the already-reviewed contracts are followed dependencies; their unrelated surfaces are excluded.

Applied the repository [agent-led policy](../../../omerta-contracts/SECURITY-REVIEW-POLICY.md) with all three pinned sources:

| Method source | Exact revision | Actual adapted pass |
| --- | --- | --- |
| pashov/skills | `c577eb7799c349de0acb187ba00ca98e14e436fd` | Access-control/periphery pass: auth → explicit wallet → unsigned plan → selected provider; exact destination/value/calldata, approval and receipt acceptance traces. |
| PlamenTSV/plamen | `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | Stateful depth pass: double clicks, changed session/network/account, ambiguous submission, persisted pending record, terminal receipt → confirmed projection → unlock. |
| trailofbits/skills | `d3323cefbcf645678b8dc481de204b02ad3d02dc` | Context/specification pass: distinguish SQL snapshot from chain authority, follow RPC/index ownership reads and provider callbacks, compare UI promises with ordinary-car/foundry rules and executable regressions. |

These are scoped manual passes and cross-checks, **not complete upstream orchestrators or scanners**. Implementation and review overlap; separate agents reviewed the controller/backend and supplied their tests. No new Solidity/compiler/cryptography audit is claimed for this JavaScript integration.

## Authority and failure traces

- Authenticated routes expose public chain projections, unsigned prepared calls and receipt reads. There is no server signer, broadcast path, SQL item credit, material import or migration/export endpoint in this lane. Explicit-wallet queries do not confer authority to spend; the selected wallet signs the actual call.
- Configuration defaults closed. An enabled service requires the pinned deployment-file bytes, supported chain, anchor block, distinct runtime hashes and dependency/manifest commitments. Reads recheck those bindings and the canonical block. Client-side validation independently checks wallet, chain, manifest, profile, zero ETH value, destination and ABI-encoded calldata; plan expiry is checked before submission.
- The bounded Transfer index discovers IDs; canonical `ownerOf` and provenance reads determine the displayed inventory. Reorg/incomplete indexing fails closed or stays visibly reconciling. This remains a trusted-RPC projection, not a light-client proof.
- The controller takes its busy/pending lock before awaiting wallet work, saves the exact call before sending, then saves its returned hash. Ambiguous submission or receipt/refetch failure stays recoverable without resending. Explicit wallet rejection clears only the rejected attempt. Account/network events invalidate the pre-send plan; a changed authenticated session throws rather than falling back to the prior selected wallet.
- A terminal receipt must match the stored chain/from/to/data/value and confirmation requirement. The pending lock is retained until the refreshed board reaches the receipt block and indexing is ready; an equal-height block hash must match. No item/material credit is optimistic. Confirmation depth is not a guarantee against every later chain reorganization.
- Approval and hardening are distinct wallet transactions. Approval calldata names only the configured foundry and exactly `0.6 × batches` OMR at 18 decimals; source state bounds the requested scrap/balance. Approval confirmation refreshes allowance and never automatically sends hardening.
- `GET /v1/me` continues returning the migrated living character as a frozen snapshot through its read wrapper; legacy actor mutations remain blocked. Migrated landing/coach lead to Garage. Frozen SQL balances, fleet cards, legacy theft instructions and mastery promises are suppressed or explicitly labelled; ordinary-player controls remain available.
- Car names, provenance, errors and transfer inputs are escaped/text-rendered. Explorer links are restricted to the configured scheme; recipient addresses and supported action fields are validated before a plan is accepted.

## Resolved findings and regression traces

| ID / severity | Observed trace and correction | Retest |
| --- | --- | --- |
| NG-01 / Low | A migrated Home visit preferred the legacy first-week panel, bypassing the new onchain coach. The strategy mount now removes that panel for migrated characters. Separate guards suppress the SQL showroom, contextual theft rules/mastery panel and frozen sidebar stats in this lane. This was misleading presentation, not a chain-authority bypass. | Real-index browser checks migrated coach/absence and ordinary-lane retention; desktop/mobile inspection. |
| NG-02 / Low | A changed session returned null for expected wallet, allowing the controller's fallback to reuse the prior selection during async wallet access. The integration callback now throws. Wallet signing still required consent; the defect was stale authenticated context. | Pause `eth_accounts`, expire `/me` with 401, resume provider: visible session error, zero prepare calls and zero sends. |
| NG-03 / Low | A terminal receipt followed by a lagging/incomplete projection could release the UI lock while showing old ownership/materials. The controller now requires receipt block metadata and a caught-up, ready projection before clearing tracking. | Controller cases for stale height, incomplete index and equal-height fork retain recoverable tracking; successful browser receipt/refetch unlocks without optimistic credits. |

No unresolved critical/high issue was established in these scoped passes. That conclusion applies to this isolated local implementation and the exclusions below.

## Executed evidence and disclosures

- **14 mock-RPC groups passed** for configuration/dependency pins, authoritative projection/plans and receipt handling, including the unconfigured receipt gate returning before SQL access; backend agent retains raw output in the package's final evidence manifest.
- **19 controller groups passed**, including exact ABI/approval, account/network changes, persisted/ambiguous submission, stale projection/index/fork recovery, pagination and forced wallet selection; [retained output](evidence/controller-final.log).
- **10 real-index browser groups passed**, exit 0: disabled lane, migrated/ordinary presentation, existing picker/rejection, wrong wallet/network, session race, no optimistic salvage credit, approval separation, navigation/reload recovery, mobile/XSS. [Final log](evidence/browser-final.log), [exit](evidence/browser-final.exit), [desktop](evidence/desktop.png), [mobile](evidence/mobile.png), [XSS fixture](evidence/security-xss.png).
- Exact browser command: `node test/nativegarage-browser.js`, disposable pg-mem and a synthetic EIP-1193 provider; no public-chain transaction. Tool/source versions are retained with the pins. The mock/fixture tests do not prove PostgreSQL migration locking or actual chain execution.
- Initial outputs are preserved: `browser-attempt1.log` exposed NG-01; `browser-attempt2.log` waited for a deliberately hidden picker using the default visible state (harness correction); `browser-session-attempt1.log` looked for the session error in the status region while it was correctly rendered in the alert (harness correction). The earlier successful 9/10-group runs are retained, followed by the final run after all guards.
- **Real Anvil/server/UI rehearsal: four groups passed, 23 local wallet transactions**, runtime/deployment pins retained in the [report](evidence/real-chain-final.json), [log](evidence/real-chain-attempt3.log), [exit 0](evidence/real-chain-attempt3.exit) and [screenshot](evidence/real-chain-desktop.png). The actual picker/controller/API claims, requests/verifies/settles four genuine archived BLS rounds, abandons non-junkers, burns earned junker #4 once, approves exactly 0.6 OMR, hardens/crafts against the actual restricted OMR policy, assigns/unassigns and transfers the tool to Bob with confirmed ownership. Command: `node tools/native-garage-ui-rehearsal.js`. Both UI and server deliberately use a historical test clock; this proves execution compatibility, not entropy fairness. Initial rehearsal failures (round not ready; archived proof unavailable) remain in attempts 1/2. No live transaction or production database write occurred.
- No new Solidity fuzz/invariant run or general static-scanner run was required by these JavaScript-only changes; prior contract evidence is not re-labelled as new coverage. Contract source is unchanged by this UI slice.

## Release limits

Missing approved production OMR/token-policy/house configuration and the immutable native bootstrap batch remain activation blockers; this UI does not create substitutes, deploy contracts or export characters. The enabled flag stays off unless explicitly configured. A controlled web release can expose the closed UI without activating an onchain rail.

The prior native-GTA limits remain unchanged: trusted initial SQL/bootstrap and pinned RPC; fixed baseline profile with ordinary cars only; numbered series excluded; social/mastery progression events-only; immutable wallet recovery limitations; experimental unaudited BLS dependency, beacon-threshold/fresh-chain-clock assumptions, and possible pending-action stranding without rescue/redraw. Historical proof compatibility is not production unpredictability. Broader market/token economics, reverse bridges, wallet software, production operations and whole-game release readiness are excluded.

Material changes reopen the affected review. This report records the pinned local integration; it does not authorize mainnet deployment, funding or activation.
