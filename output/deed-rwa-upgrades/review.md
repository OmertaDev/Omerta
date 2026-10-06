# Independent backend differential review

Date: 2026-10-06. Base commit: `db54f824004c4d855778668081ce2adfac173c39`; reviewed dirty implementation, pre-release. Scope: deed-upgrades, broker weighting, deed board, schema, authenticated route, OMR reason registry; dependencies: account transaction/ledger, stock allocation/delivery ownership, sale and chain reimport/transfer writers. Solidity, live deployment and browser UI excluded.

## Methods and adaptations

Read the repository SECURITY-REVIEW-POLICY. Applied its pinned pashov judging gates (attack execution/reachability/trigger/impact), plamen state transition tracing, and Trail of Bits context building/differential review. Exact sources read: `output/audit-methods/pashov/solidity-auditor/SKILL.md`, its `references/judging.md`; `plamen/skills/audit-prep/SKILL.md`, `plamen/codex-adapter/agents/depth-state-trace.toml`; `trailofbits/plugins/differential-review/skills/differential-review/SKILL.md`, plus audit-context-building skill used for preceding dossier. Adaptation: JavaScript/PostgreSQL code, scoped native diff/caller searches; did not run Solidity orchestration or claim full upstream pipelines. No tool environment repair.

## Findings / leads

**DU-01 — medium specification lead: acquired bonus applies to pre-acquisition gameplay.** `src/deed-upgrades.js:16–23` maps historical upgrade eligibility to the current reward owner. Trace: A upgrades deed with effective day D; B performs qualifying gameplay in a later seven-day window starting S >= D; B acquires the NFT just before publication; ownership ingestion maps it to B; allocator applies the bonus to B's entire window, including days before acquisition. Owner transfer is ordinary reachable gameplay/marketplace activity and improves B's funded pool share at peers' expense. Published prior epochs remain intact. Severity is bounded by 25% weight uplift; classification remains a specification lead because permanent transferable upgrades may intentionally include all unpublished windows. Correction if future-only includes acquisition: retain ownership effective history and require both upgrade and owner's acquisition effective day <= epoch start. Tests currently assert bonus follows observed owner but do not cover acquisition timing. No source edits or retest of a correction performed.

**DU-02 — low confirmed display inconsistency.** `src/brokers.js:54–57` derives displayed weight from `upgradeBoard`'s most recent owned deed, while `upgradeWeights` uses the maximum bonus among all owned deeds. An account may hold multiple linked-wallet NFTs. Holding an older upgraded deed plus a newer unupgraded deed causes board weight to understate the allocator's weight. Fix: board weight should use the same `upgradeWeights` account result; preserve selected-deed upgrade details separately. Does not mint assets or overallocate the pool.

**DU-03 — low test coverage limitation.** `test/deed-upgrades.js` checks vocabulary recognition, balance cost and an arithmetic model, but not full OMR conservation or actual funded distribution after upgrades. Add a ledger-baseline fixture or compare exact player debit, desk inventory increment and paired recycle transaction, then distribute a real recorded fixture buy against upgraded epoch weights.

## Rejected hypotheses / boundary checks

- Stale replacement deed: request requires exact deedName and expectedLevel; post-lock board looks up that exact name. Ownership loss yields no eligible next tier and fails before spend. No silent fallback to another deed when deedName is supplied.
- Duplicate spending: account transaction locks serialize same-account requests; expectedLevel and deed-name/level PK reject old submissions. PostgreSQL concurrency not executed, so this is inspected reasoning only.
- Upgrade vs sale/reimport/canonical owner ingestion: upgraded row is locked before eligibility recheck; sale, reimport and recordDeedTransfer inspect/lock the same deed row. Lock correctness requires PostgreSQL validation. Existing unknown-owner extractor fallback matches delivery; watcher freshness remains a trust assumption, not newly proven chain ownership.
- Upgrade-time retroactive weights: effective day starts tomorrow and eligibility uses epoch start, so a newly purchased level cannot affect earlier or partially overlapping windows. Published weight rows and owed allocations are not rewritten.
- Conservation: new `deed:upgrade` is present in DESK.SINK_REASONS and invariant vocabulary; existing spend/ledger code recycles equal units, with no new faucet. Public spend/sink wording is accurate.
- Fixed pool and flooring are unchanged in distributeBuy/allocateStock. Upgrade state changes allocation proportions only. Callback/reentrancy and Solidity bytecode analysis are inapplicable to this server-only diff.

## Executed evidence

Node v24.19.0. Commands in worktree: `node test/deed-upgrades.js` (exit 0; sequential costs, stale guard, milestones, future-only bonus, transfer and fixed-pool arithmetic PASS); `node test/brokers.js` (exit 0; qualified baseline, retired activation, legacy terms and idempotent funded distribution PASS). Both explicitly used pg-mem. PostgreSQL persistence, isolation and lock races were not run and are not claimed green. Static inspection used scoped git diff and rg of owner/sale/reimport writers; no external static analyzer diagnostics were produced. No stateful fuzzing executed.

## SHA256 source pin

```text
src/deed-upgrades.js 9CB12762FA47686F34F2B2EEF6A564F53FC42971BCB4E7D2300A3F46572A1432
src/brokers.js 92EE511F4C2EADEAAEEA2ADF4728750716CB4EE38FAAB6D228B667E3E8B65C12
src/deeds.js 5408D5FDFFA0B873FB0B9DADF40126F937F441FA2660CC1D36E2C7D0BC87D05C
schema.sql DFFC5C6096952B429AD80EC607DB671F31DA8D81E18C44851BCB11622C8A4053
src/server.js 2A5634C9AD149F1AB82039B85844E1F5022A626F20EBCF8F52258ADD79EF7B57
src/rules.tail.js 1889E906A6A1734CFBC6DB0FF9B470B48BD5FB62F94AD43F7056D9CC826AAC05
src/invariants.js 558F8C34930618D873B83246642764782BBE459FC014B3842DC363F2A5403EBA
test/deed-upgrades.js 2D9FF30EB44D149703B1A2C8D05A36DC724B01B3891DFEEC149B328480F62866
```

Conclusion: no confirmed high/critical defect in this scoped inspection. Ownership timing policy, displayed multi-deed weighting and test limitations remain visible above. This is not production activation evidence; material source changes require affected retesting.

## Ownership remedy follow-up

Latest `sold` history cannot be authoritative: `recordDeedEvent` (`src/deeds.js:44–59`) catches failed inserts; sale and chain transfer callers ignore its false result. Atomic owner-effective day belongs in the deed mutation itself (`buyDeed`, `recordDeedTransfer`, `applyDeedReimport`), conservatively next day, gated against epoch start. Mint/extraction preserves the economic owner and can retain acquisition timing or reset conservatively.

Wallet mapping is another acquisition boundary: `walletVerify` (`src/chain.js:1470`) can rotate a linked wallet. A frees upgraded NFT wallet W by linking W2; B links W after B's prior gameplay; no NFT Transfer occurs. An owner-effective field alone does not protect this path. Require wallet-link effective day <= epoch start for on-chain bonus eligibility, or explicitly accept current linked-owner publication semantics. No existing wallet-linked timestamp was found in the inspected schema.

## Remediation and independent retest

DU-01 resolved for new mutations: added `street_deeds.ownership_since_day` atomically to in-game sale, observed chain owner change and redemption/reimport; added `account_persistent.reward_wallet_since_day` atomically to wallet verification only when its address changes. `upgradeWeights` and selected-deed board eligibility require max(ownership day, wallet-link day) <= epoch start. Inspected updated mutation parameters. Existing null fields use original claim day / zero wallet-link day; this is migration-compatible for pre-existing owners because no deed upgrades existed before this release. New change gates protect future ownership events. Extraction conserves economic ownership while chain mint-owner ingestion conservatively delays eligibility.

DU-02 resolved: broker board now obtains effective account bonus directly from `upgradeWeights`, matching allocator maximum across owned deeds.

DU-03 exact conservation portion resolved: regression now checks exact individual costs, account reduction, matching desk inventory increment, and matching summed paired desk recycling transactions. The 2/10/100 funded-budget test remains arithmetic modeling, with allocator/distributor mechanics separately exercised by brokers suite; no claim that it is a full end-to-end funded upgraded population simulation.

Independent rerun: `node test/deed-upgrades.js` and `node test/brokers.js`, Node v24.19.0, both exit 0 on pg-mem after fixes. Ownership and wallet-link future gates are exercised with directly seeded authority fields, so production mutation and concurrent indexing behavior remain inspection plus separately retained PostgreSQL evidence from the backend author, not a PostgreSQL run performed by this reviewer.

Final inspected SHA256 pins supersede initial implementation pins above:

```text
src/deed-upgrades.js D081B8E1826FE0B56434F25EDE8B605DE80D89A61C495E099BB5F924D1070DF2
src/brokers.js C84720B5FB32349BBFAFC6C9AD5F56E134ABAB4CBF0C9C0C2B1F93698AB035EB
src/deeds.js BAD636255F9B6B0B29331520298A1C2F67A190E407F1A829F93EEBDA00E17E4F
schema.sql 06625AD360639C52B63E190EB81C1ED4DDDB5DCD6117366F6449932B582EC016
src/chain.js 27B0EDC4E7E6649E916BA4EA868D3FADBD44959AB3DAFC107935C9FAD7C5CEC2
src/server.js E9EE0DB076FB157A1940B50528BC59BFBBFF9E82586488A08AF401CD91C65E5C
src/rules.tail.js 1889E906A6A1734CFBC6DB0FF9B470B48BD5FB62F94AD43F7056D9CC826AAC05
src/invariants.js 558F8C34930618D873B83246642764782BBE459FC014B3842DC363F2A5403EBA
test/deed-upgrades.js B812F76B2288DE0A299153A861B78DD660608DA26F248F3FDCA44A1CB48F6784
```

Residual assumptions: chain owner data and wallet attribution reflect indexed state; no synchronous chain ownership proof is added. Database bonus CHECK bounds 500..2500; no unprivileged SQL writer found. The maximum 25% bonus remains enforced by catalog and persisted bounds. No open confirmed high/critical finding; final conclusion restricted to these pins and pre-release server scope.
