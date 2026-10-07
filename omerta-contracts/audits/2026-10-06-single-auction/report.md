# NFT-gated single-auction release review

## Source, scope and phase

Source commit: `9e47d4a0a9ecc20adb55826fed0293b896ff434c`, based on main `b899f3766b95a942279fb0e8461c7dc1da6f5879`. Pre-deployment source review, October 6, 2026. The reviewed Solidity/backend/client bytes match the final Daybreak retest pins; that report's base-commit label remained the earlier `db54f824...` during the checkout update. Its file hashes, not that stale base label, identify the reviewed delta. Full source and artifact pins are retained in `source-manifest.json` and `evidence/genesis-single-artifact-inventory.json`.

The approved route is one NFT-gated ETH/OMR public auction. Scope includes the guarded auction and fixed validator, new `OmertaAuctionCoordinatorV2`, direct unsigned deployment planner, unsigned operations preparation, authenticated participant API, browser payment/recovery controls, and related tests. Referenced market hook/funding adapters and pinned auction/Uniswap dependencies are included in artifact/import inventory. Retained two-leg code and its NFT regression coverage are compatibility evidence; those contracts and their player window are not selected for deployment. Unreleased two-leg backend/planning drafts were retained outside the release checkout and are not shipped.

Existing production OMR, NFT and fee contracts are reused only after execution-time verification. This review does not enable bonds, withdrawals, reserve strategies or other market automation, and does not attest to a funded or active launch.

## System model and properties

Five EOA deployment transactions create two adapters, coordinator, mined hook through CREATE2, and auction. The auction creates its NFT validator internally. The deployment account is the one-time configurator; the approved Safe funds two OMR inventories, registers auction inventory, and the configurator binds the auction before bidding. Planner nonces include the CREATE2 factory call. Unrelated deployment-wallet transactions invalidate the prepared address sequence.

Each new bid checks NFT ownership of its recipient, including relayed bids and both overloads. NFT/code/chain identity is pinned. Exits and token claims retain the bid owner's rights after NFT transfer. The API prepares exact unsigned calldata only; it does not sign, broadcast or maintain payment liabilities in the game database. Consequently PostgreSQL payment-lock proof is inapplicable to this new preparation route; wallet submission concurrency is browser-local, while contract ownership and settlement remain authoritative.

After final checkpoint/graduation, migration atomically sweeps accepted public proceeds, spends 37.5% on full-range ETH/OMR liquidity, verifies actual 99–100% budget spending, matching token reserve, position identity/custody, and revokes temporary approvals. Residual proceeds are pull credits: 40% treasury, 36% Vig, exact remaining 24% founder. A reverting credited recipient cannot veto migration. Failure rolls back principal movement and pool/position changes. Migration does not wait for the claim cliff; claims require success and the native cliff.

The source is a direct nonproxy deployment. Arbitrary proxy upgrades are not claimed safe. Runtime/address pins and immutable bindings are checked against one block, with final block-hash/chain recheck before unsigned preparation. All four liquidity dependencies are mandatory. Clock cadence, reserve adequacy, nonce vacancy and actual production settings remain execution-time gates.

## Methods and findings

Applied the repository security policy and its pinned Pashov/Plamen/Trail of Bits method baseline: context/trust-boundary building, adversarial entry-point and execution traces, accounting/economic boundaries, privilege and replay domains, external calls, failure/recovery, property testing and static triage. These are adapted passes, not claims that entire upstream orchestration ran. Parallel authors/reviewers used the existing Windows/Foundry toolchain; authors' self-review is distinguished from independent passes. The actual CLI reviews ran `gpt-daybreak-blue-latest`, provider OpenAI, read-only, exit 0. Headers are retained. The first single-auction report incorrectly said Daybreak was unavailable; the unchanged original and explicit provenance correction are both retained.

| ID | Severity / disposition | Evidence and correction |
| --- | --- | --- |
| G-01 | Low functional, fixed | UI reciprocal price limits could fall off the auction tick grid and be rejected. Verified tick/floor read, downward rounding preserves minimum OMR rate; backend independently checks modulo. Invalid/missing ticks and rate bounds have regressions. |
| G-02 | Medium, fixed | Orphan receipt could clear a persistent payment intent. Receipt/transaction identity and canonical block are checked twice, final confirmation depth/account/network/storage identity rechecked; adverse receipt/reorg tests retain the lock and reject phantom bid IDs. Original independent trace is retained. |
| G-03 | Medium functional, removed from current route | Earlier two-leg operations incorrectly waited for claim cliff before migration, risking player deadline cancellation. Fixed and independently retested before route replacement. New single-auction operations explicitly never gate migration on claim cliff. |
| G-04 | Medium, fixed | New deployment planner accepted other production chain IDs. Production now accepts only 4663; 31337 requires explicit rehearsal; all others reject before source cleanliness checks. Regression covers production/rehearsal rejection. |
| G-05 | Medium, fixed | Liquidity dependency runtime pins were optional during payment preparation. All four complete, distinct pins and on-chain bindings are now mandatory for reads, bids, recovery and operations. Missing/tampered/colliding pins reject before simulation. |
| H-01 | Requirement mismatch, not a confirmed exploit | Earlier Solidity review interpreted relaying as a requirement for player contributions. The clarified requirement supported relayers on public auction only; that earlier report and correction remain retained outside this current single-auction scope. The current route has no player contributions. |

Independent review and final Daybreak retest found no additional concrete defect in their recorded scope. This is not a guarantee that no bugs or exploits exist.

## Executed checks and static triage

- New coordinator: 11 focused tests, 512 fuzz runs, zero failures. Checks cover principal rollback/retry, proportional spending/credits, LP custody, revoked approvals, dependency drift, binding privileges and timing, malicious recipient isolation, and NFT-transfer recovery. See focused log and provenance.
- Single-auction Robinhood dependency fork: one test passed at block 82013317, timestamp 1791328828, real deployed NFT/OMR/PoolManager/PositionManager/Permit2 and genuinely mined hook. **ArbSys was removed on the local fork and block.number simulated auction time.** Parameters were example values, not the final production packet. This proves dependency integration under those limitations, not native-clock timing or final-plan adequacy.
- Prior full Foundry run: 1,325 tests passed across 91 suites with 512 invariant runs/depth 500. This was the preceding reviewed revision and does not prove the new coordinator. Log retained as baseline evidence only.
- Current focused Node gate tests real artifact/source/ABI/compiler/size pins, five deployment nonces and four funding/configuration calls, exact price/wei encoding, NFT admission, complete bounded partial exits, dependency verification, auth/dormant HTTP perimeter, stale/reorg/chain rejection, canonical receipts and duplicate-submission protections. Post-main browser suite, smoke and env classification passed. Final committed-source gate output/exit are retained.
- Daybreak personally ran helper/client/operations regressions. Its planner/HTTP attempts were limited by read-only temporary-directory `EPERM`; root's unrestricted executions passed those tests. Daybreak did not personally run Solidity or the fork.
- Slither 0.11.6 directly analyzed the guarded auction (46 contracts, 102 detectors), with two diagnostics: intentional zero-ownership equality, and caller-selected batch claims' pinned view-gate calls. Single claims remain available and batches are bounded by transaction gas. Neither supplied a concrete persistent global denial trace. Raw diagnostics are retained. Vendor transient-guard warning is triaged as the established clear-at-call-end guard pattern, with vendor unchanged.
- New coordinator Slither attempt failed because this Crytic compilation path did not apply the required via-IR settings, yielding stack-too-deep. Failed raw output is retained; no successful coordinator static-analysis claim is made. Foundry actually compiled it with Solidity 0.8.26, optimizer 800, Cancun, via-IR. Runtime template size: 13,517 bytes. Optional tool environment was not rebuilt to hide this limitation.

Hosted repository/release checks and actual deployment are separately verified after publication; this package does not declare them already complete.

## Remaining gates and conclusion

The reviewed source is suitable for the next release-check/pre-deployment phase, conditional on repository gates. It is not a launch-ready transaction approval. No new genesis contracts have been broadcast, funded or bound, and the website purchase route remains dormant without a verified manifest.

Required next evidence: public deployment wallet and gas funds; two Safe approvers; final recipient, inventory, floor/graduation and reserve settings; native-clock calibration and acceptance of estimated wall-clock boundaries; final-plan simulations/price-bound reserve proof; exact deployed runtimes and immutable bindings; funding and inventory registration; production manifest pins and rollout; agreed signed live bid; and operator/backup coverage for checkpoint, migration, credits and recovery. Graduated spent bids are not automatically refundable solely because later migration fails; immutable configuration must be verified before accepting bids.
