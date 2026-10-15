# Soulbound identity and finite deed issuance

Date: 2026-10-14. Phase: working-tree source implementation. Base commit: `e56cf576065c5f1bbb9bb55115f5961267f7d654`; the tree was already dirty. `source-manifest.json` identifies the final inspected files. No deployment, migration, funding or activation was performed.

## Scope and policy

The owner selected soulbound character NFTs and a lifetime maximum of 2,500 unique Street Deeds. A repeated extraction of the same street retains its identity and must remain possible after burn-back into the game. The owner also selected killer inheritance of deeds and their contents; custody and death settlement are excluded from this implementation pending withdrawal and non-player-death rules.

Included boundaries: `DynastyNFT` mint/update/interface behavior; `StreetDeed` unique-identity issuance; `claimDeed` and supply display; schema boot initialization; character preflight, local rehearsal, metadata wording and relevant tests. Unrelated preexisting edits are preserved. This review does not re-clear the full game, token market, existing deployments, metadata privacy system, or stock delivery.

Compiler: Solidity 0.8.26, optimizer 800, Cancun. Native Forge 1.7.1, commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`. The local rehearsal deploys only fresh fee and character contracts on disposable Anvil chain 31337; those addresses are not production targets.

## Model and enforcement

- A server-signed EIP-712 voucher authorizes a mint recipient, nonce and deadline. Existing checks, daily caps, signatures and replay domains remain intact.
- `DynastyNFT._update` rejects every non-mint update. This covers both safe-transfer overloads, plain transfers, approved operators, self-transfers and forwarding inside mint receiver callbacks. ERC-5192 `locked`, `Locked` and interface discovery expose the policy. Existing approval and royalty ABI remains; approval cannot transfer an identity.
- Street identity is the permanent nonempty `deedName` mapping at `keccak256(name)`. Only the first mint increments `totalDeedIdentities`; redeem never clears that identity or decreases its count. The maximum is a fixed constant, not an owner-adjustable setting. Existing per-day mint accounting still applies to re-extraction.
- Backend creation locks the singleton supply row inside the existing gameplay transaction. Initialization includes all existing deed rows, including extracted synthetic owners. A monotonic counter and existing-row count prevent deletion from reopening issuance capacity. At exhaustion, the API reports no new-claim availability.
- Failed receiver calls and duplicate claims revert their nonce, day, identity and supply mutations atomically. SQL failures roll back creation and its counter together.
- Current preflight requires ERC-5192 support and checks a minted token's lock when available. It does not make a historically transferable deployment soulbound. Historical frozen metadata remains readable; new soulbound minting continues to serve the account's evolving portrait.

## Review methods and evidence

Applied narrow adaptations of the policy-pinned methods: Pashov access-control and invariant boundary tracing (`c577eb7799c349de0acb187ba00ca98e14e436fd`), Plamen transfer side-effect/state-coupling review (`795962b96e254f2e423a2635fe7f8cb8ea1e6d69`), and Trail of Bits context/property review (`d3323cefbcf645678b8dc481de204b02ad3d02dc`). Local method revisions were checked. No whole upstream orchestration is claimed.

An independent read-only agent examined inherited transfer paths, callback ordering, administrator capabilities, permanent identity accounting, rollback, alternate writers and SQL transaction boundaries. No concrete reachable defect was found in that changed scope.

Retained execution records:

- `output/nft-policy-review-2026-10-14/soulbound-tests.txt`: 26 Dynasty unit tests, 33 character audit tests and two stateful invariants passed. Each invariant ran 512 sequences at depth 500, 256,000 calls and zero reverts; fixed seed `0x20261014`.
- `output/nft-policy-review-2026-10-14/deed-supply-tests.txt` and `deed-supply-backend-tests.txt`: 31 passing deed contract tests, plus API, schema-replay and real PostgreSQL concurrency commands and results.
- `output/character-nft/rehearsals/2026-10-14T20-24-36-525Z-mint-dev.json`: 13 passing checks for real local payment, voucher issuance/claim, watcher attribution, replay refusal, ERC-5192 discovery, transfer rejection and live metadata.
- `node test/character-mint-policy.js` and `node test/portrait-access.js` passed. The policy tests reject unsupported, unlocked and unreadable identity policies. Changed JavaScript syntax checks and targeted diff checks passed.

The first local rehearsal stopped on the repository's newer adult-account gate; its synthetic account fixture was updated with an explicit adult test birth date and the rerun passed. Existing deed sale tests similarly needed two explicit known-player fixture contacts. No production authorization was weakened.

## Static triage and limitations

Native Dynasty lint retained two preexisting timestamp diagnostics at voucher expiry/TTL checks; these are intentional time bounds. No new actionable diagnostic was identified. Scoped formatting and whitespace checks passed. Solidity source verification and these tests do not substitute for constructor-specific deployed runtime verification.

Existing datasets above 2,500 identities are preserved and cannot create more; the change does not delete player property to force an inventory count downward. A funded replacement deployment requires explicit reconciliation of existing identities, contract addresses, token-bound accounts and game database binding. Original immutable contracts cannot acquire the new policy automatically.

Death custody remains design work. It needs per-life accounts, committed death authority, replay-safe settlement, pending rights for killers without claimed identity NFTs, and a rule for deaths with no player killer. No claim is made that the current estate flow already forfeits deeds or that stocks are locked while equipped.

Conclusion: the reviewed soulbinding and lifetime issuance boundaries pass their scoped verification. Production release and the future custody/death route remain separate work.
