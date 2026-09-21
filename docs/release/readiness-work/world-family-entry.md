# Scoped shared Family entry observer

This increment starts from integrated root `4b9db479` plus the four prior ammo/cash observer commits (equivalent cherry-picks ending at `57233484`). It changes diagnostic/test code only. The integrated exact Family-yield repair is present; this work does not replace or requalify that proof.

`tools/rc1-world-resource-observer.js` now observes full `gang_members` rows and classifies a deliberately narrow set: ordinary formation's $25,000 personal cash sink with one newly created Family/boss, cash tribute from a stable living member to that exact Family treasury with equal lifetime/season standing increments, and whole-unit OMR tribute from the living member's account to that Family reserve. Exact decimal strings and per-owner equations are retained. No aggregate balancing adjustment is permitted. Every existing Family's ammo bank must remain unchanged at these ordinary boundaries. **There is no authored personal ammo-tribute route; ammo tribute is not executed coverage.** Car-melt funding is separate and remains unsupported here.

The shared classifier consumes only fresh transaction IDs and links the original membership, character/account and Family counterparty. The pure observer cannot reconstruct HTTP authorization from a ledger row. The focused native verifier additionally binds completed canonical HTTP commands to the exact route/body hash, account/key, response and durable idempotency row, then checks requested floored amount and actual recipient. Compound boundaries containing other receipts, weekly/seasonal or war transitions remain unsupported; they are not forced into ordinary tribute equations. New or changed Family fields outside the explicit projection, other membership/role changes, and other OMR bucket movements remain unknown with lossless restricted row diagnostics. No full-resource or matrix qualification is claimed.

Run from a clean committed checkout with Node and native PostgreSQL:

```powershell
node test/rc1-world-family-entry.js
$env:RC1_RESOURCE_DATABASE_URL='postgres://postgres@127.0.0.1:55438/postgres'
node test/rc1-native-family-entry.js --postgres --output=<private-directory>
node test/rc1-world-family-entry.js --evidence=<private-directory>
node test/rc1-world-resource-observer.js --postgres
node test/rc1-world-ammo-escrow.js
node test/rc1-world-pressure-cash.js
```

The native runner creates an exclusively owned disposable database. It declares four fixture accounts, respect eligibility and a 1,000 OMR reallocation from the retired AMM seed before baseline. Canonical prebaseline cash-window redemption funds formation and tribute; actual allocation, window/ledger and idempotency receipts are retained. The declared exchange till is a local fixture, not proof of deployed or chain backing. No postbaseline gameplay state/deadline/balance rewrite is made. Population and liquidity deployment switches are explicit. The original worker and shared application/SQL clock execute all original callbacks due during a 15-minute scope, with the current weekly task verified as crime. This does not exercise a weekly tribute completion, seasonal rollover or hourly Family yield.

Cases include two formations; boss/member cash and OMR tribute; fractional request flooring; outsider refusal; exact retries; a same-key concurrent cash tribute batch; and cash/OMR failure after the canonical Family credit but before ledger insertion, followed by same-key successful retry. Full before/after state is retained at HTTP/callback boundaries, including the first unexpected failure. The concurrent batch retains invocation/completion evidence, not an invented PostgreSQL total commit order. Diagnostic trigger SQL and its predecessor assertion are retained separately and cannot create a gameplay payout.

Controls mutate independently rerunnable pure or captured native inputs: missing/stale/duplicate ledger and durable receipts, wrong owner/body/amount, balanced wrong-Family and wrong-account movements, missing cash sink or reserve credit, wrong standing, ammo diversion and pocket/vault substitution. Positive retries create no new movement. Unsupported new fields, member joins, season changes and unclassified ammo funding remain visible. Native artifacts and raw actor/custody data stay private; publish only source, counts, hashes and scope.

The first clean run at `d92a9198237424ca07db6c49ce97f40735a826e9` is retained as **FAIL** (`family-entry-d92a9198-native-1`). Its 34 completed boundaries and 11 movements preceded a failed duplicate-durable-receipt control: the verifier originally checked only the active command's durable key and missed a duplicate historical funding row. The verifier now asserts uniqueness of every observed durable account/key pair. This was a diagnostic verifier defect, not a production failure; preceding completed assertions do not turn that full failed gate into PASS. The generic observer native regression's old formation-unsupported expectation was updated to classified formation plus an explicitly unsupported season projection control.

Security review applies the repository policy's pinned Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`, Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`, and Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` methods through local caller/authority inspection, adversarial owner/receipt/rounding review and native transaction failure controls. This does not claim upstream orchestration, Solidity fuzzing or external rail review. Relevant authorities are `src/social/gangs.js` (`createGang`, `tribute`, `tributeOmr`), `src/game.js` (`withCharacter`, `bumpFamilyTask`, `ledger`), the canonical server idempotency hooks and `schema.sql`. No gameplay runtime repair is included.
