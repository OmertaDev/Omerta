# THE BROKERS — treasury-funded RWA rewards to NFT holders

Founder-directed 2026-08-10. Funding source: **the treasury slice** (founder decision). Denomination:
**tokenized stocks, in the Stonkbrokers pattern** (founder decision, made after the alternatives and
their costs were laid out).

> **Implementation amendment — 2026-08-24 (supersedes stale status and the gateless-keeper wording
> below).** Product copy and new code use Robinhood's required term **Stock Tokens**. The chosen
> activity policy is **minimum breadth/score, then uncapped proportional play**: at least 3 tracks and
> score 25, followed by the full linear score; human and agent accounts qualify identically, while NPC/resident accounts are excluded.
> `worker.js` now publishes the completed seven-day epoch automatically and `allocateEpoch` enforces
> the NPC exclusion. Delivery still has no player claim, but it is no longer an unauthenticated keeper
> assertion once the Safe arms `StockVault.allocationSigner`: every push then requires an EIP-712
> authorization binding the frozen epoch hash, account hash, exact token, deed TBA, units, delivery id,
> and deadline. The EVM does not recompute gameplay; it verifies the independent server attestation.
>
> The acquisition authority is also explicit now. `StockTokenRegistry` is Safe-owned and enumerable;
> an isolated publisher may commit one closed-day family result, but only for an active registry entry.
> `RwaStockBuyer` accepts the immediately preceding UTC ballot day—not a ticker/address—resolves the
> exact token address snapshotted when that result was published, uses only a Safe-approved venue adapter,
> enforces a daily ETH cap and one buy per ballot, and verifies the exact resolved token arrived in
> `StockVault` above the stricter of an independent fresh-oracle floor
> and the keeper's floor. Both contracts deploy disabled via `DeployRwaStockMachine.s.sol`. The
> venue-specific adapter, quote/TWAP oracle, Safe catalog approvals, and mainnet funding remain launch
> configuration/gates; no document may
> describe those as live merely because the bounded contracts exist.
>
> **Founder compliance posture — 2026-08-24.** OMERTÀ performs no KYC, residency, sanctions, or other
> recipient-compliance check in gameplay or in the Stock Token delivery worker. Qualification is active
> play plus the linked-wallet/extracted-deed delivery target; issuer KYC at direct redemption is outside
> the game. The implementation already has this shape—there is no hidden eligibility-provider call to
> remove. This is a product/risk decision, not a claim of legal approval: Robinhood's permissionless ERC-20
> developer posture and its separately published transfer restrictions both remain facts the launch
> review must address. Adding a recipient gate later requires a new founder decision.
>
> **Founder corporate-action posture — 2026-08-25.** RHJ's currently active split/dividend actions
> are multiplier-managed, so neither raw `StockVault` balances nor raw-unit allocations are rewritten.
> A terminal or conversion action (including redemption, merger, spin-off, or worthless removal) is a
> rare, fail-closed exception: deactivate the catalog entry, pause purchases and undelivered pushes,
> snapshot the source-token balance and outstanding allocation book, and wait for both an issuer
> `COMPLETED` record and verified on-chain receipt of the actual successor property. The economic share
> backing pending allocations follows that property pro rata to the same accounts; it never falls to
> general treasury inventory or a later epoch. No keeper may infer settlement from an announcement.
> Until RHJ activates and documents a terminal type, reconciliation is Safe-reviewed rather than
> speculative automation. §3.4b is the normative calculation and runbook.
>
> **Founder closed-ballot execution posture — 2026-08-25.** Default selection ends when the UTC-day
> result is published. If that result's exact Stock Token becomes inactive, halted, or otherwise
> ineligible before purchase, the purchase is skipped: neither the keeper, publisher, nor Safe may
> substitute another token or republish the day for a different winner. The unspent, bounded ETH carries
> forward inside the existing treasury, funding, and per-buy/per-day cap walls; unused authority does not
> enlarge a later cap. The immutable ballot remains public, and the public machine status records the
> skipped purchase and reason. A tie, silence, or pre-close candidate removal may still resolve to the
> active default under the ballot rules; it is not authority for post-close substitution.
>
> **Founder open-ballot removal posture — 2026-08-25.** If a candidate is deactivated after votes are
> cast but before the UTC cutoff, the ballot neither restarts nor extends. Votes for that candidate
> become invalid immediately and do not contribute to the live lead or closing tally; affected families
> may recast for any remaining active candidate until the ordinary cutoff. An invalid vote left unrecast
> is ignored. The remaining active votes resolve normally, with the active default used only for a tie or
> silence. This is not fully implemented: `tallyTickerDay` and the public ballot board must filter or mark
> inactive votes before the rail can be armed.
>
> **Founder carried-budget posture — 2026-08-25.** ETH left unspent by a skipped purchase remains in one
> non-expiring general Stock Token acquisition budget; it is not earmarked for the unavailable winner
> and remains there by default unless the designated `mainOperator` exercises the later founder-approved
> arbitrary ETH-transfer authority. A future valid ballot may spend from the remaining pool
> only on its own exact winner, through the ordinary one-ballot/one-buy path and under the Safe-set daily
> cap. Unused daily capacity never stacks, and no keeper may batch a catch-up purchase. The backlog drains
> gradually across valid days; the skipped token receives nothing unless it wins a later ballot after
> becoming eligible again. `stockBudget()` and `RwaStockBuyer` already express the pooled budget, ballot
> latch, and non-stacking cap. The current unrestricted Safe `sweepEth` still does not match the approved
> authority model: it must become an explicit, publicly accounted `mainOperator` transfer path rather than
> a falsely acquisition-only Safe recovery claim.
>
> **Founder forward-only catalog lifecycle — 2026-08-25.** Robinhood's API may discover a status or
> identity change, but it never reactivates or replaces an approved entry. Restoring the same exact token
> requires a new Safe decision after address, status, venue, oracle, and exposure-limit review; a successor
> with a different address or provider identity requires a Safe-reviewed registry addition or migration.
> Either change applies only to future open ballots. It never rewrites, repairs, or replays a closed or
> skipped ballot, and it cannot redirect a pending allocation; issuer corporate-action reconciliation is
> the separate §3.4b path. Prior identities and ballot results must remain inspectable. This is not fully
> enforced. The approved target is an immutable, versioned registry: an existing version's token address
> and provider identity can never change; restoring that exact pair only toggles the same version active;
> any address or provider-identity change creates a new permanent `assetKey`; the old version remains
> inactive and enumerable; and at most one version of a ticker may be active. Today,
> `StockTokenRegistry.upsertAsset` can overwrite identity under a ticker-derived key, and the Postgres
> mirror has a unique ticker that updates in place. `ballotToken` protects closed ballots from redirection,
> but the contract, proposal tooling, mirror schema, and public history must implement the approved model
> before activation.
>
> **Founder deterministic version-key posture — 2026-08-25.** A version key is independently
> recomputable as
> `keccak256(abi.encode(chainId, keccak256(bytes(normalizedTicker)), token, robinhoodAssetIdHash))`.
> `normalizedTicker` is the validated uppercase ballot symbol; `token` is the exact canonical deployment;
> and `robinhoodAssetIdHash` binds RHJ's provider identity. Changing the ticker, token, provider identity,
> or chain creates a different version. Display-name corrections and active/inactive status changes do
> not. The registry must derive and verify this key rather than accepting an opaque Safe-chosen alias.
>
> **Founder active-set uniqueness posture — 2026-08-25.** Historical inactive versions may repeat an
> individual ticker, token address, or RHJ provider-id hash, but the active catalog is one-to-one across
> all three fields. At most one active version may own each ticker, token, and provider identity.
> Activating a version atomically deactivates every distinct active version that conflicts on any of those
> fields; reactivating the exact same version only toggles its existing record. This invariant belongs in
> the registry, not only in Safe procedure or the Postgres mirror. Current reverse mappings and
> `setAssetActive` do not implement it and remain part of the activation gap.
>
> **Founder empty-catalog posture — 2026-08-25.** If no version is active, the production ballot has no
> candidates and no default. Casts are refused, rollover records a public `catalog_empty` skipped day,
> no purchasable winner is published, and no buy occurs. The bounded ETH remains in the permanent pooled
> Stock Token acquisition budget. The machine never revives SPY, an old default, or a static allowlist.
> Only an explicit Safe reactivation/addition can restore candidates, and it affects future open ballots;
> empty-catalog days are never replayed. Current `resolveTickerBallotDay` merely returns
> `{resolved:false, reason:'no_tickers'}` without the required durable public skip record/status, so this
> remains an implementation and rehearsal gate.
>
> **Founder family nomination posture — 2026-08-25.** Add a public, non-binding RWA nomination queue.
> A currently seated family's boss or underboss may nominate an RHJ Stock Token ticker with a short
> reason, and other currently seated families may publicly endorse it. The server attaches the current
> Robinhood discovery identity/status as evidence, never approval. A nomination or endorsement cannot
> enter the ballot, create/activate a registry version, rewrite a closed result, or bypass any Safe review;
> only Safe execution plus registry sync makes a version voteable. Submission and endorsement are
> rate-limited under the cadence below. No nomination table, route, or board exists today, so this is an
> explicit implementation gap.
>
> **Founder nomination cadence — 2026-08-25.** Each seated family may create at most one nomination in
> any rolling seven-day window. A nomination remains pending for at most 30 days. Each seated family has
> one endorsement on each pending nomination, exercised by its boss or underboss and changeable or
> withdrawable while pending. A Safe disposition of approved, rejected, or not eligible closes the item
> immediately; `approved` still does not make it voteable until the Safe transaction executes and the
> registry sync observes it. Thirty-day expiry archives the item without approving, rejecting, or
> activating anything. Once its seven-day submission cooldown has elapsed, a family may renominate an
> expired ticker, creating a new record with fresh discovery evidence rather than reopening history.
>
> **Founder nomination seat-turnover posture — 2026-08-25.** A nomination that was authorized when
> submitted remains public and pending if its family later loses its Commission seat or dissolves; review
> work is not erased by chamber turnover. That family immediately loses nomination and endorsement write
> authority. Its endorsement event remains immutable history but is excluded from the current seated
> support count. Regaining a seat never revives the old endorsement automatically: the current boss or
> underboss must endorse again. Newly seated families may endorse any still-pending item. The public board
> shows both current seated-family support and historical endorsement events; neither binds the Safe.
>
> **Founder nomination deduplication posture — 2026-08-25.** At most one pending nomination may exist
> citywide for an exact deterministic version key. A family attempting to nominate that same
> chain/ticker/token/provider identity is sent to the existing item and may endorse it with its own short
> rationale; no new row is created and its seven-day nomination allowance is not consumed. Same-ticker
> nominations with genuinely different version keys may coexist, but the board marks them as mutually
> conflicting because the registry can activate at most one. After the exact version's prior item becomes
> terminal or expires, a new linked nomination may be created with fresh evidence. Pending-key uniqueness
> and cooldown accounting must be atomic under concurrent submissions.
>
> **Founder nomination sponsor posture — 2026-08-25.** The submitting family is the nomination's sole
> sponsor and cannot also endorse its own item. A seated sponsor contributes one current supporting family;
> each other seated family may contribute one endorsement, so current support is capped by the five-seat
> Commission. If the sponsor loses its seat or dissolves, sponsorship remains historical but contributes
> zero current support. Reseating does not revive it automatically: the current boss or underboss must
> explicitly renew sponsor support, without creating a second endorsement. The public board separates
> sponsor identity, current support, and historical support.
>
> **Founder nomination review-threshold posture — 2026-08-25.** Three current supporting families out of
> the five-seat Commission mark a pending nomination `review_requested`; a current sponsor counts toward
> the three. Crossing the threshold refreshes the RHJ discovery evidence and alerts operators, but never
> generates, signs, or submits Safe calldata and never binds approval. If live support falls below three
> before an operator claims it, the item returns to ordinary `pending`. Once claimed as `under_review`,
> later support/seat changes remain public but do not cancel review. Operators may claim any nomination
> below threshold for risk, timing, or catalog-health reasons. Pending order is live-support descending,
> then oldest first.
>
> **Founder fixed review quorum — 2026-08-25.** The automatic threshold is always three distinct
> currently seated families, even when fewer than five Commission seats are occupied. It is not a majority
> of occupied seats and never scales down to one or two organizations. With fewer than three seated
> families, automatic `review_requested` is impossible, while authorized operators retain the manual
> below-threshold claim path. Seat fill/vacancy recomputes current support but not the threshold, and an
> already claimed `under_review` item remains claimed.
>
> **Founder hard nomination deadline — 2026-08-25.** The original 30-day `pending_until` is immutable
> across `pending`, `review_requested`, and `under_review`; claiming, reassigning, or posting progress never
> pauses, resets, or extends it. If no terminal Safe disposition exists when the deadline arrives, the item
> becomes `expired` even while under review, preserving its assigned reviewer and latest public progress
> note without implying approval/rejection. Further work requires a fresh linked nomination and evidence
> snapshot. Terminal `approved`, `rejected`, and `not_eligible` items do not expire. An approved item still
> awaiting Safe execution remains terminal but visibly non-voteable under its separate execution status.
>
> **Founder Safe execution TTL — 2026-08-25.** Review approval binds the exact deterministic version key
> and final RHJ/review evidence hash, and its generated Safe activation calldata carries
> `validUntil = approved_at + 7 days`. The registry rejects activation after that timestamp, so an old
> queued proposal cannot remain executable indefinitely. Execution before the deadline remains valid if
> worker sync lands later; chain execution time controls. If the window closes unexecuted, the nomination
> stays terminal `approved` while execution becomes `approval_stale`, non-voteable, and incapable of
> producing replacement calldata from the old review. Continuing requires a fresh linked nomination,
> evidence snapshot, and Safe review. The public board separates approval time, deadline, Safe transaction,
> execution, and registry-sync state. Current registry/proposal calldata has no evidence binding or TTL,
> so this is a contract/tooling activation gate.
>
> **Founder pre-execution evidence drift rule — 2026-08-25.** From approval through execution, an
> off-chain watcher rechecks the exact RHJ identity/status plus the approved venue, oracle, and exposure
> prerequisites. Material change sets public execution status `evidence_drift`, identifies the changed
> fact, alerts Safe owners, and prevents first-party proposal/broadcast tooling from advancing it. The
> watcher and third-party feeds receive no on-chain catalog authority: they cannot revoke already signed
> calldata, and the board must disclose that residual executability until the Safe cancels it or the TTL
> expires. If Safe owners nevertheless execute it on time, the registry accepts it and the incident is
> recorded as a Safe-governance failure rather than misdescribed as an on-chain watcher guarantee.
>
> **Founder atomic activation rule — 2026-08-25.** A single Safe-authorized registry transaction must
> deactivate every active ticker/token/provider-id conflict, create or select the exact immutable version,
> enforce the active-set uniqueness checks, and activate that version. All operations revert together.
> Conflict-deactivation and activation events make the unit auditable, and the server mirror applies the
> transaction indivisibly; there is no intermediate duplicate-active or replacement-missing state.
>
> **Founder finalized-chain voteability rule — 2026-08-25.** Safe submission and mining are not
> voteability. The public lifecycle distinguishes `safe_submitted`, `executed_pending_finality`, and
> `synced_active`; only a canonical registry activation that satisfies the configured chain-finality policy
> and is synchronized may enter a future ballot. Inclusion before `validUntil` remains valid even when
> finality/sync arrives later. A pre-finality reorg returns the version to non-voteable state and alerts the
> operator; if an open ballot had optimistically observed it, the approved pre-close deactivation/recast
> rule applies. A submitted receipt or optimistic indexer result is never catalog truth.
>
> **Founder single-reviewer disposition rule — 2026-08-25.** One authenticated authorized RWA reviewer
> suffices to set any terminal nomination disposition: `approved`, `rejected`, or `not_eligible`; no second
> reviewer or reviewer co-signature is required. The immutable record binds the reviewer identity, terminal
> status, public rationale, evidence references, and final evidence hash. For approval, that reviewer's
> action sets `approved_at` and begins the seven-day Safe window. Review authority never makes a version
> voteable or substitutes for the separate Safe threshold, chain execution, finality, and sync controls.
>
> **Founder post-activation quarantine rule — 2026-08-25.** Monitoring continues after `synced_active`.
> Verified material drift sets public `operational_quarantine`; inability to verify a critical prerequisite
> sets distinct `health_unknown`. Either fails closed for new ballot inclusion, casts/changes, purchases,
> and automatic delivery. An open ballot applies the existing invalidate-and-recast rule; a closed winner
> not yet purchased skips without substitution and leaves ETH in the pooled acquisition budget. Ownership
> and permanent allocations remain intact and cannot be seized, substituted, redirected, or expired.
> Quarantine is visibly an operational overlay while the on-chain version remains active; the watcher can
> halt OMERTÀ's use but cannot activate, permanently deactivate, transfer, or reassign anything.
>
> **Founder quarantine recovery and reactivation rule — 2026-08-25.** If the registry version remains
> active, clearance needs no new family nomination, but does require fresh evidence resolving every reason,
> one authorized reviewer approval, a new evidence-bound seven-day Safe clearance action, finality, and
> mirror sync; it stays blocked until all complete. If the Safe deactivated the version on-chain, recovery
> requires a fresh linked public nomination with no carried endorsements/support, fresh RHJ evidence and
> review, a new TTL-bound Safe approval, atomic execution, finality, and sync. An identity-unchanged version
> is reactivated in place rather than duplicated, with the old nomination, quarantine, deactivation, and
> recovery records linked and permanently enumerable.
>
> **Founder quarantine-entry authority rule — 2026-08-25.** Deterministic watcher predicates may
> automatically impose `operational_quarantine` for verified drift or `health_unknown` for unverifiable
> critical health; one authenticated authorized RWA reviewer may also impose either immediately. Every
> entry records a stable reason code, public explanation, exact asset key, evidence/source observations,
> actor, and timestamp. Families, nominees, endorsers, ordinary operators, agents, and clients have no such
> authority. Entry needs no Safe approval because it only removes operational permission; Safe-controlled
> recovery remains mandatory. Repeated triggers are idempotent and may append observations without hiding
> or resetting the original quarantine timestamp.
>
> **Founder monitoring cadence and freshness rule — 2026-08-25.** Every `synced_active` version is checked
> at least every five minutes, with a synchronous fresh check immediately before publishing the daily
> candidate snapshot, broadcasting a purchase, beginning an automatic delivery batch, or broadcasting a
> clearance. Critical health older than ten minutes is unusable and becomes `health_unknown`; an earlier
> successful check never authorizes a later sensitive action. Timeouts, malformed responses, signature
> failures, identity mismatch, or inability to verify the chain/token/provider tuple fail closed without
> falsely claiming material drift. Production may check more often but cannot loosen either ceiling through
> ordinary configuration; a documented founder/Safe policy change is required. Public state exposes
> `last_checked_at`, `last_healthy_at`, status, and safe failure reason without secrets or credentials.
>
> **Founder in-flight purchase race rule — 2026-08-25.** Quarantine known before broadcast prevents the
> transaction, skips without substitution, and keeps ETH pooled. Immediately before broadcast the worker
> atomically records the exact health/catalog/ballot/quote-oracle snapshots, spend, and transaction intent.
> Quarantine observed after broadcast but before mining marks `purchase_at_risk` and prompts a best-effort
> same-nonce cancellation/replacement only where safe; cancellation is never guaranteed and no substitute
> ticker may be sent. Cancellation success or purchase revert leaves the day skipped and ETH unspent. If
> the purchase canonically finalizes first, the real trade stands, its units allocate to that day's eligible
> cohort, and delivery pauses under quarantine without unwind, substitution, or reassignment. The public
> chronology shows observation, broadcast, inclusion, and finality. No later quarantine creates rebuy or
> catch-up authority. Unprovable ordering becomes `ordering_uncertain`: preserve canonical assets/ledger,
> pause delivery, and require operator review rather than inventing history.
>
> **Founder delivery-backlog resumption rule — 2026-08-25.** Quarantine clearance resumes delivery only
> after canonical finality, mirror sync, and another synchronous fresh health check. Paused allocations keep
> their exact asset key, cohort, amount, creation time, and deterministic FIFO priority by creation time then
> stable allocation id; newer allocations cannot jump them, though a held/ineligible row does not block later
> eligible work. Each batch is stage-then-confirm and idempotently identified. A returning quarantine blocks
> new stages, releases an unbroadcast stage without changing `delivered`, and lets a broadcast transfer follow
> canonical chain outcome before pausing the remainder. Delay creates no substitute, cash, yield, priority
> bonus, or larger allocation. Public state exposes backlog size, oldest pause, last completed batch, and
> current blocker. An acquisition-vault reconciliation shortfall or deficit is not itself a delivery blocker for
> already-acquired, already-allocated units when exact StockVault custody and all independent delivery walls are healthy.
>
> **Founder permanently undeliverable resolution rule — 2026-08-25.** A permanently frozen,
> non-transferable, irrecoverable, or unsupported Stock Token sets affected allocations to
> `delivery_impossible_pending_resolution`; they never expire or move cohorts. Resolution cannot use an
> unrelated token, general treasury ETH, $OMR, game cash, or synthetic internal credit. Safe resolution is
> permitted only from value actually recovered from that exact holding—verified RHJ redemption/liquidation,
> successor corporate-action consideration, or recovered original units—and distributes no more than the
> recovered amount pro rata under original cohort weights. Deterministic rounding residue stays with that
> cohort, never general treasury. With no recovery the obligation remains visibly unresolved. Resolution
> requires fresh evidence, one authorized reviewer, exact Safe calldata, finality/sync, and a public
> conservation calculation.
>
> **Founder user delivery-hold rule — 2026-08-25.** Automatic delivery to the extracted Street Deed TBA
> remains default, but a user may set a reversible `delivery_hold` globally or for one exact immutable asset
> version. It preserves the allocation without forfeiture, expiry, redirection, sale, redemption,
> substitution, conversion, cash value, interest, yield, priority, compensation, or voting power. Clearing
> returns the row to its original FIFO position. The keeper checks the hold before staging and again before
> broadcast; a newly held unbroadcast stage releases without changing `delivered`, while post-broadcast
> canonical execution cannot be cancelled or reversed by a hold. Idempotent toggling cannot reserve batches
> or starve others, and a held row does not block later eligible rows. The public board may show `user_held`
> while private controls remain authenticated. Death, inactivity, logout, or an indefinite hold never
> forfeits the allocation, which remains tied to its designated Street Deed TBA.
>
> **Founder Street Deed destination-binding rule — 2026-08-25.** An unbound allocation is beneficially the
> qualifying account's and remains `awaiting_deed`. A deed becomes eligible only after canonically finalized
> extraction, deterministic ERC-6551 TBA derivation, and current account ownership. Exactly one eligible deed
> auto-selects as `rwa_delivery_deed`; with multiple and no selection, no silent oldest/newest/value default is
> allowed. The authenticated user designates one primary deed. Establishing it binds all unbound allocations
> and future allocations to the exact chain id, deed contract, token id, and TBA, one whole allocation at a
> time with no split. Changing primary affects only still-unbound and future allocations. Once bound, the
> destination is immutable. Selection itself only freezes identity and creates no transfer, delivery, fee,
> tax, allocation, or ownership event.
>
> **Founder deed-transfer attached-rights rule — 2026-08-25.** A bound pending allocation travels with the
> exact Street Deed/TBA. Finalized deed transfer changes control of Stock Tokens already in the TBA, bound
> pending allocations, and their delivery holds; original activity/cohort history remains attributed to the
> qualifier and is not re-scored to the buyer. Existing holds persist across transfer, the new owner may
> change them after finality, and the former owner immediately loses control. Delivery remains addressed to
> the unchanged TBA even during a staged transfer. Before sale, the public deed view discloses aggregate
> pending allocations, exact versions, delivered/undelivered amounts, quarantine/health/impossible status,
> and holds. OMERTÀ neither prices, guarantees, nor intermediates the sale. Transfer causes no reallocation,
> double allocation, substitution, scoring, or cohort entry.
>
> **Founder bound-beneficiary immutability and migration rule — 2026-08-25.** After binding, neither user,
> reviewer, support, database admin, keeper, nor ordinary Safe action may redirect an allocation to another
> deed, EOA, TBA, character, or account. Lost wallet, recovery request, inactivity, death, sanctions, or sale
> dispute creates no discretion; recovery follows control/transfer of the deed and its owner's wallet-recovery
> mechanism. The sole exception is a verified protocol-wide deed/TBA migration for a contract defect or chain
> migration, with deterministic one-to-one mapping, preserved current deed owner and every allocation field/
> history, exact Safe calldata, a public old-to-new map plus conservation proof, canonical finality, and sync.
> It cannot rescue one individual. Delivery pauses until a valid migration completes rather than redirecting.
>
> **Founder delivery-gas funding rule — 2026-08-25.** Automatic Stock Token delivery gas is paid from a
> dedicated, separately accounted RWA delivery-operations ETH budget funded by the operator/Safe or an
> explicitly designated protocol-operations source. Users owe no extra delivery fee after the existing deed
> extraction requirement. Automated gas charging may never reduce allocations/cohort holdings, pooled
> acquisition ETH,
> withdrawal reserves, $OMR, game cash, or user balances, and funding grants no allocation, priority, claim,
> repayment, or yield. A Safe-set fee ceiling applies. Empty budget or excessive fees pause as
> `delivery_gas_unfunded` or `delivery_gas_above_ceiling`, preserving allocation/FIFO and publicly showing
> reason, balance, ceiling, and oldest delay. The keeper cannot sell/skim Stock Tokens for reimbursement.
> Accounting records tx hash, gas used, effective price, ETH spent, funding-source category, and balance.
> This does not limit the separate founder-approved `mainOperator` arbitrary ETH-transfer authority: if that
> key moves pooled ETH into gas or anywhere else, it is a public `operator_outflow`, not an automatic gas
> deduction, and it reduces the acquisition pool.
>
> **Founder atomic-unit largest-remainder rule — 2026-08-25.** The exact version reads, bounds, and caches
> the real token `decimals()`; all purchases/allocations use integer atomic units, never floating point. Each
> daily cohort floors exact activity-weighted pro-rata entitlements, then assigns remaining units by largest
> fractional remainder, with equal remainders broken by stable immutable account id ascending. Allocations
> sum exactly to purchased cohort units. When units are fewer than eligible accounts, zero awards are public
> `qualified_rounded_zero` records with weight/result and create no token liability. Fractional remainders do
> not cross days, versions, or cohorts. Every positive unit remains a valid permanent allocation with no
> value threshold; delivery may aggregate rows for the same deed/version while retaining row audit history.
>
> **Founder isolated delivery-item batch rule — 2026-08-25.** The keeper aggregates all currently
> deliverable positive undelivered rows for one deed TBA/exact version into one immutable-id item for its full
> staged amount, and may include bounded multiple items in a transaction. Recipient-specific failure must not
> revert unrelated successes. Canonical per-item events name asset key, deed/TBA, atomic units, item id, tx,
> and result. Success confirms covered rows and increments `delivered` only after finality. Failure increments
> nothing, exposes a stable reason, releases/retains the stage safely, and links retry attempts to the same
> logical id. Token-wide or inventory/conservation failure halts the whole version. Always enforce delivered
> <= allocated and staged + delivered <= held; retries/log duplication/reorg/restart cannot double-confirm.
> Batch limits cannot alter FIFO, permanently skip a recipient, or favor large allocations.
>
> **Founder custody-balance acquisition truth rule — 2026-08-25.** Router success, quoted/nominal output,
> venue receipt, and events are evidence but never the allocatable unit source. After canonical finality,
> under serialization against all movements of that exact token, record pre/post custody balances and set
> `receivedUnits = postPurchaseBalance - prePurchaseBalance` with transaction, asset key, vault, and blocks.
> Freeze allocation only after a verified positive delta. Claimed-output mismatch becomes public
> `acquisition_amount_mismatch` and blocks allocation pending reconciliation. Rebasing, fee-on-transfer,
> reflection, elastic-supply, or otherwise non-standard balance tokens are ineligible by default; later
> support requires a new immutable version, purpose-built Safe-approved accounting adapter, fresh nomination/
> review, and explicit conservation tests rather than reuse of ordinary ERC-20 assumptions.
>
> **Founder acquisition spend/refund/slippage rule — 2026-08-25.** The daily cap covers total ETH committed
> as ballot trade input, including venue/router/liquidity fees taken from input; network gas is separate
> operations expense. Every net atomic unit actually received is allocated with no protocol skim. Canonically
> unconsumed/refunded ETH returns to the pooled acquisition budget, creates no larger allocation, and grants
> no second ticker. In-bound slippage lowers actual cohort units; out-of-bound slippage reverts. No treasury,
> operator, Safe owner, family, broker, or keeper compensates ordinary slippage or captures favorable
> execution. Public purchase accounting shows intended/consumed/refunded ETH, received units, effective and
> oracle prices, deviation, venue/adapter, and separate gas.
>
> **Founder hard two-hour purchase window rule — 2026-08-25.** Each closed ballot fixes
> `purchaseUntil = closed_at + 2 hours`, never extended for worker/provider/gas/quarantine/quote/contention/
> transaction/operator delay. The buyer contract requires inclusion with `block.timestamp <= purchaseUntil`;
> later finality/sync remains valid. Before the deadline, one logical intent may retry reverted, dropped,
> cancelled, or safely replaced attempts, but only one canonically successful acquisition is allowed. Any
> positive successful output satisfying `minOut` and price bounds—including a venue-described partial fill—
> is final with no top-up; unused/refunded ETH stays pooled. No on-time success yields terminal
> `purchase_window_missed`, no buy/substitution/replay, and on-chain rejection of late inclusion. Public
> attempt history links dropped/cancelled/reverted/replaced/successful/expired outcomes to the ballot intent.
>
> **Founder independent price-oracle rule — 2026-08-25.** Venue/router/pool cannot be its own independent
> reference. Each exact asset version has Safe-approved source(s) and needs at least one independently
> governed valid price; multiple valid sources normalize decimals/direction and use their median. A snapshot
> is valid at most five minutes and binds asset key, source, price/decimals/quote currency, observed time,
> round/sequence id, and evidence hash. Each version has a Safe-set deviation no higher than the contract's
> hard 500-bps (5%) ceiling; only reviewed contract upgrade may raise the ceiling. Buyer enforces both
> `minOut` and effective price versus reference with guarded direction/decimals. Missing/stale/malformed/zero/
> negative/inconsistent/wrong-asset data fails closed, with no venue quote, prior close/day, operator number,
> or unverified cache fallback. Public history names used median/source and every rejected source/reason.
>
> **Founder calendar-neutral market-availability rule — 2026-08-25.** Ballots open/close and preserve votes
> every calendar day, but no clock/calendar alone proves tradability. Within the two-hour window a buy needs
> healthy/transferable exact token, executable approved venue, <=5-minute independent reference, and every
> price/exposure/liquidity/inventory check. If never true, terminal `market_unavailable` buys/substitutes
> nothing and pools ETH while preserving the vote. Never use stale prior close. Weekend, holiday, halt,
> oracle maintenance, or RHJ pause grants no extension/Monday catch-up; genuine off-hours venue plus fresh
> oracle may trade. Public reasons distinguish `underlying_market_closed`, `venue_unavailable`,
> `oracle_unavailable`, `oracle_stale`, `asset_halted`, and combinations.
>
> **Founder adapter and attempt-confinement rule — 2026-08-25.** Buyer calls only exact Safe-approved adapter
> address and deployed code hash on the configured chain; no arbitrary target/calldata or `delegatecall`.
> Each attempt binds chain, ballot/intent ids, asset key/output token, vault recipient, max ETH, `minOut`,
> oracle snapshot/evidence, deviation, `purchaseUntil`, and an attempt deadline <= five minutes and <= the
> purchase deadline. Adapter cannot redirect/retain output, approve unrelated spenders/unbounded allowance,
> or send residual ETH outside approved pool/custody paths. Private submission is preferred, not trusted;
> public mempool is allowed only because all walls are on-chain. Retry may refresh quote/oracle and lower but
> never exceed remaining input; it cannot auto-widen slippage/deviation. Revocation is forward-only.
> Adapter/proxy code change or code-hash mismatch needs fresh Safe approval/security verification, but not a
> new asset version unless identity changes. All targets/hashes/parameters/submission/replacements/results
> remain public.
>
> **Founder acquisition-vault/operator-override rule — 2026-08-25.** ETH defaults to a separately accounted
> `RwaAcquisitionVault`, with canonical inflow, reservation, purchase, refund, available, and unattributed-
> surplus records. Normal release is buyer-only for an exact ballot/asset/max-input/deadline/adapter/intent,
> and refunds return to the vault. Safe may pause/tighten/revoke and cannot arbitrarily sweep. However, the
> single publicly designated `mainOperator` may transfer any amount of any vault ETH—including available,
> unattributed, or reserved ETH—to any address for any purpose, without Safe approval, destination allowlist,
> purchase/exposure caps, or timelock. A reserved-fund transfer atomically cancels/invalidates affected intents
> before value leaves. The call emits `operator_outflow` with operator, recipient, amount, reason code,
> nonzero details hash,
> pre/post balances, accounting buckets, and impacted intents; it cannot move Stock Tokens or rewrite
> allocations. Accounting adjusts so reserved + available + unattributed equals the post-transfer vault
> balance. This unilateral custody power is an explicit trust assumption, not an acquisition-only guarantee.
>
> **Founder main-operator appointment/authentication rule — 2026-08-25.** The vault exposes exactly one
> current `mainOperator` address at a time (or zero, which disables operator outflow), plus any
> `pendingMainOperator`, proposal time, acceptance time, and expiry. Deployment publicly declares the initial
> address. The Safe may immediately disable the role by setting it to zero; doing so atomically cancels any
> pending nomination, increments the operator generation, invalidates every outstanding signed authorization,
> and makes any outflow ordered after that canonical state change fail at execution. Re-enabling even the same
> address requires a fresh public Safe nomination, an acceptance time at least 48 hours later, and acceptance
> from the nominated address itself. The nomination expires seven days after that acceptance time; an expired
> nominee cannot accept, and a fresh Safe nomination is required. The Safe may cancel a pending nomination.
> The old operator remains current until acceptance unless the Safe disables it first; acceptance replaces it
> atomically and emits the old/new addresses and role generation. This delayed path governs Safe-driven
> appointment and re-enabling after the role is zero; it does not restrict the active operator's separate
> instant self-replacement authority below.
>
> **Founder instant main-operator self-replacement rule — 2026-08-25.** The active `mainOperator` may directly
> call `replaceMainOperator` and install any nonzero, different successor immediately, without Safe approval, nomination,
> acceptance delay, or timelock. The call is never relayable and requires `msg.sender == mainOperator`. The
> successor must consent in that same transaction with an EIP-712 acceptance binding action, chain ID, verifying
> vault, current operator, proposed operator, current role generation, `issuedAt`, and acceptance deadline. Require
> `issuedAt <= block.timestamp <= deadline`, `deadline > issuedAt`, and `deadline - issuedAt <= 1 hour`; reject
> future-issued, expired, zero/reversed, or over-hour consent before mutation. Validate consent
> by exact ECDSA recovery for an EOA or exact ERC-1271 magic value for a smart wallet, with the same fail-closed
> rules as outflow authorization. On success, atomically cancel any pending Safe nomination, install the
> successor, increment generation, invalidate all old-operator authorizations, preserve `nextOutflowNonce`, and
> emit old/new operator and generation. The former operator loses authority immediately in canonical ordering;
> Safe retains immediate zero-disable. Replacement moves no ETH and mutates no bucket, reservation, allocation,
> or purchase cap.
>
> **Founder address-based smart-wallet operator rule — 2026-08-25.** Once installed, operator identity follows
> the `mainOperator` address, not a pinned runtime code hash, proxy implementation, owner set, module set, or
> signature policy. Later wallet ownership/module/implementation/code changes do not automatically rotate,
> disable, or increment the operator generation. Each action still validates the address's current execution or
> ERC-1271 behavior at execution time. Public monitoring surfaces current code hash, detectable implementation,
> owner/module/configuration changes, validation failure, code appearance/disappearance, and last-check time as
> `operator_wallet_changed` or `operator_wallet_health_unknown` warnings, without silently changing authority or
> pausing action. A direct call proceeds when `msg.sender` is the current operator; a relayed call proceeds when
> the current EOA/ERC-1271 validation succeeds on-chain. The Safe may zero-disable immediately. If a
> wallet change makes relay validation impossible, relay fails closed; if the operator address can no longer
> originate a direct call, the Safe restoration path is the recovery mechanism.
>
> **Founder operator-wallet monitoring cadence rule — 2026-08-25.** The watcher checks operator wallet code,
> detectable implementation, owners/modules/configuration, and validation behavior at least every five minutes.
> Data older than ten minutes is `operator_wallet_health_unknown`. Before the server constructs or relays any
> operator transaction it synchronously attempts a fresh check and publishes `last_checked_at`,
> `last_changed_at`, `last_healthy_at`, observed identity/configuration, warning, and failure reason. Watcher or
> refresh failure records a warning but does not veto the transaction; contract caller/signature validation is
> authoritative. Direct on-chain calls never depend on watcher, server, or API availability.
>
> **Founder operator-role reason/disclosure rule — 2026-08-25.** Instant operator replacement, direct
> renunciation, Safe zero-disable, Safe nomination, nomination cancellation, and nominee acceptance each require
> one code from the same closed `operations`/`security`/`purchase_recovery`/`migration_bypass`/`retirement`/
> `other` taxonomy plus a nonzero `detailsHash`. Bind both fields into every relevant EIP-712 or ERC-1271 digest
> and direct/Safe calldata. Emit them immutably with the actor, affected old/new/pending operator, generation,
> and transition type. Missing off-chain explanation text never blocks execution after the on-chain code/hash are
> supplied; public surfaces may resolve matching text but cannot rewrite the committed record.
>
> **Founder unattributed-ETH quarantine/reclassification rule — 2026-08-25.** ETH not matched to an approved,
> identified acquisition inflow—including forced ETH, mistaken transfers, and unexplained positive balance
> surplus—is booked as `unattributed` and is never available to the automated buyer or a purchase reservation.
> Plain receipt books unattributed immediately; permissionless `syncUnattributed()` books any positive
> `vault.balance - accountedBuckets` forced-balance delta without granting spend authority. Only the Safe may
> publicly reclassify a specified unattributed amount into available acquisition ETH, with reason code/details
> hash and old/new buckets; normal ballot, oracle, adapter, purchase, daily, and rolling caps still apply, and
> reclassification never revives or retroactively funds an intent. The `mainOperator` may withdraw unattributed
> ETH through the already-approved `operator_outflow` debit order without reclassification. Negative accounting
> drift is an invariant failure and pause, never an implicit bucket reduction.
>
> **Founder immutable reservation-expiry rule — 2026-08-25.** Every purchase reservation binds one immutable
> attempt deadline within the approved two-hour purchase window. Execution requires `block.timestamp < deadline`;
> a transaction mined at or after the deadline fails even if broadcast earlier. At or after the deadline anyone
> may permissionlessly and idempotently call `expireIntent(intentId)`, mark the intent terminal
> `intent_expired`, and release its entire remaining reservation to available ETH except any uncertain portion
> already held in `reconciliation_pending`; proven unaffected value releases immediately, while uncertain value
> remains quarantined until Safe reconciliation. The intent cannot be extended,
> revived, re-reserved, or executed, and the ballot receives no substitute or catch-up. Released ETH participates
> only in later purchases under their fresh caps and authority.
>
> **Founder deterministic singleton purchase-intent rule — 2026-08-25.** Each closed ballot and exact Stock Token
> version may create at most one logical purchase intent, with
> `intentId = keccak256(abi.encode(chainId, vault, ballotId, assetVersionKey))`. That ID is a permanent lifecycle
> record from first creation through terminal state. Transaction attempts use a monotonic `attemptNonce` and are
> serialized under the same intent; at most one registered attempt may be live, and replacements/retries remain
> linked so only one transaction can settle canonically. No path may create a second/parallel intent, split the
> ballot across intents, change its asset version, or produce more than one success. Success, partial-fill finality,
> expiry, operator cancellation, or any other terminal disposition permanently prevents recreation or further
> execution. A second creation attempt fails without changing reservations, buckets, clocks, or history.
>
> **Founder atomic post-wall intent-creation rule — 2026-08-25.** Only the currently Safe-approved
> `RwaStockBuyer` may call the intent/reservation creation entrypoint. In that one transaction it revalidates the
> finalized closed ballot, deterministic intent ID, exact active and healthy asset version, zero accounting deficit,
> sufficient unreserved available ETH, per-buy/daily/rolling/concentration caps, approved adapter and current code
> identity, fresh independent oracle and deviation wall, and a still-future immutable deadline. Only after every
> check succeeds may it persist the intent, reserve ETH, initialize its attempt lifecycle, and consume the next
> `accountingSequence`. Any failed check or competing creation reverts the whole transition: no intent/tombstone,
> reservation, bucket change, attempt nonce, or sequence consumption. A later call may try again before the same
> unchanged deadline; buyer approval alone bypasses none of the walls.
>
> **Founder permissionless bound-intent execution rule — 2026-08-25.** Once created, `executeIntent(intentId)` is
> callable by any address before the deadline. It accepts no caller-selected asset, recipient, input ceiling,
> adapter, oracle/deviation limit, output destination, or deadline; it uses only the stored intent and current
> approved registry state, revalidating activity, health, deficit, reservation, caps, adapter/code identity, fresh
> oracle/deviation, and time at inclusion. The caller may choose timing only inside that bounded envelope, pays its
> own network gas, and receives no fee, rebate, refund, Stock Token, approval, or other economic benefit. All output
> goes to `StockVault`; unused or returned ETH goes to `RwaAcquisitionVault`. Permissionless callers cannot create,
> edit, cancel, reserve for, or redirect an intent. Calls are reentrancy-protected and atomic; the first valid
> canonical execution wins, while competing, stale, failing, or post-terminal calls revert without accounting
> mutation or sequence consumption.
>
> **Founder immutable adapter-attempt result/reconciliation rule — 2026-08-25.** Pre-adapter validation failures
> revert without consuming `attemptNonce`, changing accounting, or creating an attempt record. Once execution
> actually invokes the approved adapter, however, that attempt consumes the next nonce and receives one immutable
> public result. A revert, false return, or zero Stock Token output is a clean `attempt_failed` only when canonical
> pre/post vault and custody balances prove zero ETH debit and zero Stock Token output; the intent and reservation
> then remain active and may be retried sequentially before the same deadline. Any nonzero or unexplained ETH debit,
> refund, token receipt, or custody delta instead marks `attempt_reconciliation` and blocks another execution or
> final settlement until an explicit public reconciliation transition accounts for the discrepancy. No retry,
> replacement, reorg handling, or operator report may erase or overwrite a consumed nonce or its result.
>
> **Founder Safe-only attempt-reconciliation finality rule — 2026-08-25.** Only the Safe may finalize an
> `attempt_reconciliation`, classify its value effects, release quarantined ETH, or declare the attempt reconciled.
> The current `mainOperator` may append evidence and a proposed disposition, but that submission is informational:
> it cannot alter buckets, custody facts, terminal state, or accounting sequence and cannot authorize itself or a
> relayer to finalize. Safe finality binds the exact intent and consumed attempt nonce and remains subject to the
> ordinary public reason code and nonzero details-hash commitment.
>
> **Founder exact reconciliation evidence/final-fill rule — 2026-08-25.** Safe reconciliation publishes the
> attempt's actual ETH debit, cumulative verified refund, Stock Token custody delta, canonical transaction
> provenance, resulting disposition, and complete pre/post balance, buckets, deficit, and intent state, and consumes
> the next `accountingSequence`. A positive, valid Stock Token custody delta is the intent's final fill at the actual
> received amount: it may allocate only those units, releases or quarantines ETH according to the proven debit and
> refund facts, and never permits a top-up, second fill, substitute purchase, or catch-up. Zero or invalid custody
> output cannot be represented as acquired stock, and unexplained residual value remains quarantined rather than
> being inferred away.
>
> **Founder terminal reconciliation-quarantine rule — 2026-08-25.** If cancellation or the immutable deadline
> arrives while an attempt awaits reconciliation, the intent becomes terminal for execution immediately. Any
> portion proven unaffected releases normally, but the unresolved portion moves from the intent reservation into
> the nonspendable `reconciliation_pending` bucket; it is not available ETH and cannot fund another reservation.
> Only later Safe reconciliation may release the amount proven unspent, while actual debit/refund/output is booked
> from canonical evidence. Neither the terminal transition nor reconciliation may revive the intent, retry it,
> replace its purchase, provide a substitute, or create catch-up authority.
>
> **Founder contract-derived reconciliation-bound rule — 2026-08-25.** The contract, not Safe-supplied numbers,
> derives or strictly caps every reconcilable ETH debit, verified refund, and Stock Token output from the attempt's
> immutable pre-adapter balance snapshots, current canonical `RwaAcquisitionVault` and `StockVault` balances, and
> already-recorded canonical refund and provenance records. The Safe chooses the disposition and commits its reason,
> details, and evidence, but cannot override those observations, credit more output, claim more refund, hide debit, or
> enter an otherwise unsupported value. Any inconsistent reconciliation reverts before bucket, intent, allocation,
> sequence, or custody-state mutation.
>
> **Founder indefinite reconciliation-quarantine rule — 2026-08-25.** `reconciliation_pending` has no timeout,
> abandonment, operator escape, presumed-success/presumed-failure rule, or automatic release. Time, deadline age,
> Safe inactivity, unavailable signers, or missing off-chain evidence never converts uncertainty into available ETH.
> The quarantined amount and its age remain public indefinitely until the Safe completes a valid contract-bounded
> reconciliation. Safe signer recovery and incident escalation provide liveness; accounting never guesses.
>
> **Founder quarantine/operator-outflow deficit-preservation rule — 2026-08-25.** Consistent with the explicit
> unilateral sweep trust assumption, the current `mainOperator` retains raw `operator_outflow` authority over actual
> ETH accounted in `reconciliation_pending`. Such an outflow may transfer the ETH but cannot finalize reconciliation,
> change its disposition, release it into available ETH, erase or reduce the underlying unresolved liability, or
> represent missing value as reconciled. It consumes the normal outflow nonce and `accountingSequence` and publicly
> debits the backed quarantine amount, identifies affected reconciliation records, and publishes complete pre/post
> balance, quarantine, liability, and deficit. Any resulting unbacked liability is an explicit accounting deficit and
> remains subject to the existing deficit pause and repair rules until canonical evidence and actual funding resolve it.
>
> **Founder reconciliation-liability solvency rule — 2026-08-25.** Every reconciliation attempt and the vault-wide
> aggregate expose `reconciliationLiability`, `backedQuarantineEth`, and `reconciliationShortfall`, with the enforced
> invariant `reconciliationLiability = backedQuarantineEth + reconciliationShortfall`. A positive shortfall joins the
> vault-wide `accountingDeficit` immediately and globally pauses new intent creation and execution; canonical deposits,
> deficit repair, matched and late refunds, reconciliation, expiry, cancellation, and authorized outflows remain live.
> No view, event, sync, or Safe/operator action may collapse these three figures into one or hide under-collateralization.
>
> **Founder deterministic reconciliation debit/repair rule — 2026-08-25.** An operator outflow that reaches
> reconciliation backing assigns the debit without operator choice: greatest `backedQuarantineEth` first, then oldest
> `reconciliationStartedAt`, then lowest intent ID, fully exhausting each record before at most one partial debit.
> Generic canonical repair funding uses one unified deficit-component queue ordered by each component's
> `firstObservedAt` or `shortfallCreatedAt`, then numeric `componentTypeCode`, then record ID, fully repairing each
> component before at most one partial repair. An exact canonical late refund overrides that generic queue and repairs
> its own attempt first. Contract-controlled bounded priority indexes, or an audited equivalent, maintain both orders;
> no historical full scan, caller-supplied ordering, or caller-supplied sort proof is authoritative. Every affected
> record and aggregate publishes pre/post liability, backing, shortfall, vault deficit, and sequence data.
>
> **Founder factual underfunded-reconciliation closure rule — 2026-08-25.** The Safe may finalize the attempt's
> factual contract-bounded disposition even when the vault lacks the ETH proven unspent. The absent amount becomes a
> durable terminal `reconciled_shortfall`; it does not create available ETH, reduce liability, or pretend the vault is
> funded. The intent closes permanently with no revival, retry, replacement, substitute, or catch-up, while the
> shortfall and its original provenance remain append-only until actual funding repairs them.
>
> **Founder repaired terminal-shortfall principal-release rule — 2026-08-25.** When real repair ETH reaches a
> Safe-finalized `reconciled_shortfall` whose immutable disposition proves the ETH was unspent, the same atomic entry
> reduces that record's shortfall and liability and credits exactly the repaired amount to available acquisition ETH.
> It requires no second Safe action and never reopens or edits the intent. Repair is capped at exact missing principal:
> the protocol creates no interest, penalty, opportunity-cost compensation, damages, yield, or other extra credit.
> Repair of a still-unresolved reconciliation instead restores backing without creating available ETH.
>
> **Founder exact late-arrival reconciliation rule — 2026-08-25.** A canonical refund arriving after terminal or
> final reconciliation first repairs the exact attempt's `reconciliationShortfall`; only the remainder not needed for
> that repair follows the ordinary terminal-refund classification, and any amount above proven debit is
> `unattributed`. The receipt appends a new record and never reopens, edits, replaces, or grants catch-up to the old
> intent. Stock Tokens arriving after terminal or final reconciliation enter `unattributed_stock` quarantine under
> their exact token address, immutable asset version, amount, sender, and canonical transaction provenance. Safe may
> only continue holding the exact stock, transfer it to the fixed Safe-approved recovery vault, or redeem/liquidate that
> exact token through a Safe-approved recovery adapter. It may not choose an arbitrary recipient, retroactively
> allocate the stock, substitute an asset, or reopen/change the historical intent or allocation. Quarantined units are
> excluded from distributable inventory, player allocations, and fulfilled-acquisition totals but included in gross
> custody, concentration-risk reporting, and every applicable exact-version exposure cap.
>
> **Founder late-stock recovery-proceeds rule — 2026-08-25.** Canonical ETH recovered by redeeming or liquidating
> `unattributed_stock` first repairs the exact originating attempt's reconciliation shortfall. Any remaining ETH enters
> the `unattributed` bucket; it does not automatically become available, allocate to the historical cohort, reopen the
> old intent, or create a substitute/catch-up. The recovery record binds the late-stock provenance, input units, actual
> ETH output, exact shortfall repair, remainder classification, and complete pre/post stock and ETH accounting.
>
> **Founder recovery-vault and adapter confinement rule — 2026-08-25.** There is exactly one active Stock Token
> recovery-vault version, bound to chain, address, runtime code hash, and, for a proxy, implementation address and code
> hash. Safe rotation is public, proposed at least 48 hours before execution, and atomically replaces old with new; the
> emergency fallback is continued quarantine, never immediate redirection. Each recovery adapter is Safe-approved by
> exact address/runtime code hash and binds one exact input token/version to a canonical ETH output path, fresh
> independent price, `minEthOut`, maximum slippage, immutable deadline, and fixed route. It exposes no arbitrary
> calldata, caller-selected path, `delegatecall`, persistent approval, or residual token authority.
>
> **Founder canonical recovery-output and conservative valuation rule — 2026-08-25.** A recovery succeeds only when
> canonical ETH is atomically received by the acquisition vault; intermediates remain inside the approved adapter.
> Unexpected ERC-20 output is never recovery credit and, if it nevertheless arrives, enters exact-token/provenance
> `unattributed_stock` quarantine. For custody risk and every applicable exact-version exposure wall, quarantined stock
> is valued at the greater of its latest fresh independent-oracle market value and last valid acquisition price. If
> neither exists or is usable, new purchases of that exact version are blocked until valuation becomes available.
>
> **Founder immutable recovery-authorization and expiry rule — 2026-08-25.** Every recovery tranche has a unique,
> immutable, domain-separated `recoveryId` binding action, chain ID, active recovery-vault address/version/runtime code
> hash and proxy implementation when applicable, incident ID, exact quarantine record and provenance, Stock Token
> version, exact input units, adapter address/code identity, canonical acquisition-vault destination, independent-oracle
> observation, `minEthOut`, slippage ceiling, fixed route ID, Safe authorization generation/nonce, issue time, and
> deadline. Only the Safe may create, activate, cancel, or replace an authorization. It expires at the earlier of one
> hour after Safe approval and the bound oracle-validity deadline; expiry, cancellation, any field change, or price
> refresh requires a new ID and cannot renew, mutate, or replay the old one. Execution rechecks every pinned code identity
> and a fresh independent price and enforces the stricter of the authorized floor and execution-time oracle floor.
>
> **Founder partial recovery, no-sweep, and permissionless-execution rule — 2026-08-25.** A quarantine record may be
> recovered through multiple monotonic partial tranches, but each tranche has its own fully bound `recoveryId` and exact
> units; successful tranches can only reduce `remainingUnits`, never exceed them, and the record resolves only at zero.
> Neither Safe nor operator has an arbitrary Stock Token sweep: the exact quarantined token leaves only through an
> active authorization and its exact adapter. Prefer a pull-free direct transfer; if approval is technically required,
> set only the exact units immediately before use and consume/reset the allowance to zero atomically. After Safe
> authorization anyone may call `executeRecovery(recoveryId)`, but supplies no payload or discretion, receives no
> reward/refund/output, chooses no route/recipient/amount, and pays gas personally or from a separately accounted
> operations wallet. Recovery gas never reduces recovery credit, acquisition backing, allocation, or player value.
>
> **Founder blackhat/grief-resistant recovery-execution rule — 2026-08-25.** Permissionless callers cannot create or
> enqueue records. Execution is a constant-time exact-ID lookup with positive units and active/not-expired/not-cancelled/
> not-consumed checks, same-call vault/token/adapter/oracle code-identity verification, exact pre/post token and ETH
> balance deltas, Solidity checked arithmetic, `nonReentrant`, and checks-effects-interactions: consume the tranche and
> reduce remaining units before external calls, with atomic rollback on failure. It performs no attacker-sized loop,
> scan, dynamic route decode, caller callback, caller payment, or caller-selected external call. Reverted, malformed,
> expired, cancelled, duplicated, or losing-race calls create no canonical event, incident entry, alert, storage growth,
> or protocol gas expense; the caller alone pays. A successful same-ID front-run performs the identical approved action,
> and every later copy fails cleanly. Fresh-oracle `minEthOut`, the slippage ceiling, short expiry, and a fixed route bound
> sandwich loss; MEV-protected submission is preferred but is never trusted as the control. Nonstandard, rebasing,
> fee-on-transfer, callback-capable, or revert-griefing Stock Tokens require a separately code-pinned adapter and
> adversarial balance-delta tests or remain quarantined without blocking unrelated versions. Safe or current
> `mainOperator` may immediately pause recovery execution; only the Safe may resume, and a pause cannot redirect stock,
> consume an authorization, alter deadlines, or credit recovery.
>
> **Founder public recovery-evidence, finality, retention, and API-abuse rule — 2026-08-25.** Successful canonical
> recovery transitions publish IDs, versions, sequences/components, actor/authority, transaction hashes, units, ETH,
> blocker changes, code identities, and finality; bulky, sensitive, or legally restricted evidence stays off-chain under
> an immutable content hash. Provisional and finalized streams are separate, finalized is the default accounting/UI/
> export authority, and reorgs may replace only provisional data. Canonical history is permanent; the UI may bound its
> recent window but complete cursor-based exports cover every generation in checksum-addressed pages/files. Public
> incident and recovery APIs are read-only for anonymous callers and enforce cursor validation, fixed maximum page/body
> size, cheap indexed lookup, per-origin/token quotas, caching, and content-addressed precomputed exports. Invalid cursors,
> duplicate requests, rejected executions, and transport abuse never trigger unbounded scans, canonical writes, alerts,
> export regeneration, or incident amplification; infrastructure metrics are sampled and retention-bounded separately.
>
> **Founder recovery implementation/audit activation gate — 2026-08-25.** This is a conditional gate for activating a
> future recovery feature, not a requirement to build that feature or a blocker to the ordinary RWA launch. Recovery
> remains unavailable and every recovery mutation control remains disabled until the exact production vault/adapter/
> oracle/API implementation and deployment manifest exist. Activation requires contract unit tests, stateful
> fuzz/invariant tests, malicious-token/adapter/oracle/
> receiver and reentrancy tests, forked-route slippage/MEV/reorg tests, API authorization/idempotency/concurrency/body-limit/
> cursor/export/load/denial-of-service tests, and an independent third-party review of the exact source and bytecode with
> every critical/high finding fixed and every remaining finding publicly dispositioned. The manifest binds chain,
> addresses, compiler/settings, source commit, runtime and implementation code hashes, adapter/oracle identities, test
> reports, and audit artifact hashes. Any material contract, proxy implementation, adapter, oracle, authorization,
> accounting, or write-route change invalidates the approval and repeats the applicable gate. No placeholder generic
> executor or recovery write endpoint may be deployed merely because the architecture is documented.
>
> **Founder quarantine proportionality and conditional-v1 security rule — 2026-08-25.** The launch/default behavior for
> late or unexplained Stock Tokens is simply exact-provenance quarantine and indefinite hold: no recovery contract,
> oracle pair, executor, keeper, relayer, or write API is required until a real, materially useful quarantined balance
> makes recovery worth building and the Safe publishes that decision. If recovery is activated, the Safe records every
> authorization on-chain; proxy vaults/adapters remain allowed (there is no non-upgradeable mandate), but exact proxy
> and implementation identities remain pinned and rechecked. Safe-set hard limits cap each tranche, each exact version
> over rolling 24 hours, and all recovery over rolling 24 hours, with no operator bypass over Stock Token recovery;
> this does not reduce the main operator's separate authority over ETH after receipt. Two independent fresh price sources
> set the more conservative floor and divergence above 500 basis points fails closed. V1 supports only conventional
> balance-delta ERC-20 behavior; every exceptional token waits for a separately reviewed adapter. A successful adapter
> ends with zero attributable token/ETH residue and zero allowance; forced unsolicited dust is excluded from recovery
> credit and quarantined. Public APIs return unsigned calldata and never sponsor or relay anonymous gas, while canonical
> history is derived only from finalized events emitted by pinned contracts. Rejected/duplicate/malformed calls may be
> rate-limited and alerted on operationally but never auto-pause recovery, open a financial incident, or write canonical
> history; only objective code/oracle/custody walls or Safe/operator action block recovery. Before activation, publish a
> vulnerability-disclosure or bounty channel, independent monitors for code identity, balances/allowances, oracle
> divergence, recovery rate, and sequence gaps, and a rehearsed pause/cancel/rotation runbook. These are conditional
> safety constraints, not a reason to turn an edge case into a launch subsystem.
>
> **Founder fixed pre-vote budget with no reserve/dust policy floor — 2026-08-25.** Ordinary RWA funding does not use
> an automatic percentage of prior-day protocol revenue and does not preserve a mandatory minimum acquisition-vault ETH
> reserve. Before a ballot opens, the system publishes and atomically snapshots one exact maximum ETH budget drawn from
> backed available acquisition ETH under the existing caps; that budget cannot increase, decrease, or follow the winning
> ticker after voting begins. There is no policy minimum economic purchase size: any positive budget that satisfies the
> normal token, market, price, output, gas, custody, and accounting walls may execute even if small. Zero output,
> insufficient actual balance, a venue-enforced minimum, or another ordinary execution wall still fails normally. This
> permits ordinary automation to use all available acquisition ETH but never to spend value the vault does not hold.
>
> **Founder spot-only acquisition and no discretionary trading rule — 2026-08-25.** The RWA MVP may acquire only the
> Safe-approved provider-native spot Stock Token for the voted underlying. LP tokens, lending receipts, yield wrappers,
> synthetic equities, derivatives, and bridged wrappers are not MVP acquisition assets. Once an ordinary acquisition is
> allocated, the protocol may not sell, rebalance, rotate, or market-time it. Only delivery to the entitled holder and
> the already-defined mandatory corporate-action, provider-retirement, legal, or worthless-removal processes may change
> its disposition.
>
> **Founder future-product optionality and OMR-stake allocation direction — 2026-08-25.** Leverage, borrowing, shorting,
> options, perpetuals, leveraged tokens, lending, rehypothecation, and collateral use are not permanently prohibited, but
> this rejection of a permanent ban authorizes none of them for the MVP; each requires a later explicit architecture,
> risk, counsel, Safe, and implementation decision. The prior strictly play-only allocation posture is also rejected:
> verified OMR staking may add a multiplier allocation on top of active-play weight. The shipped formula remains
> `activationMult × activityScore` until the unified on-chain stake source and the required finalized staking snapshot
> exist; no current stake balance is silently or retroactively counted.
>
> **Founder staking-weight composition, qualification, and snapshot rule — 2026-08-25, agent parity amendment 2026-08-26.** When implemented, ordinary
> Broker activity qualification remains mandatory for human and agent accounts: failing the breadth/score gate produces zero regardless of
> stake. Agent accounts qualify on identical terms; only NPC/resident accounts remain excluded. The formula is
> `finalWeight = activationMult × activityScore × stakeMult`; the existing recurring 30-day paid Broker activation also
> remains mandatory. `stakeMult` uses fixed, publicly disclosed tiers derived from finalized time-weighted-average
> eligible staked principal over the complete seven-day epoch. There is no separate 72-hour maturity delay: stake begins
> contributing pro rata when accepted into the eligible source and stops when removed. Each account binds exactly one
> verified allocation wallet for an epoch, and a wallet change affects only the next epoch. Only eligible staked
> principal counts; liquid wallet OMR, pending or claimed-but-not-restaked rewards, and Broker-activation spend do not.
> A 2× maximum was rejected; the approved replacement is capped at 1.50× with the exact tiers and epoch rules specified
> below. `account_persistent.staked` must not survive as a separate economic source: the unified on-chain gameplay
> stake below replaces it, and its finalized mirror supplies the RWA staking history.
>
> **Founder agent-wallet parity rule — 2026-08-26.** `agent_flag` is never an economic disqualifier for the unified
> gameplay stake or the RWA rail. An agent account's verified EOA or ERC-1271 controller wallet has the same ability as
> a human account to deposit, stake, commit, partially unbond, withdraw, inherit the account position, receive idle
> gameplay loot, lose eligible principal to canonical gameplay settlement, build finalized Broker stake TWA, and receive
> Stock Token allocations and delivery. The same activation, activity, wallet-uniqueness, finality, consent, exposure,
> solvency, and launch gates apply. The flag may continue to gate human-only faucets and status boards, but it must not
> appear as a denial condition in vault authorization, settlement, staking checkpoints, Broker weights, RWA allocation,
> or delivery.
>
> **Founder unified on-chain OMR gameplay-stake directive — 2026-08-25.** Every feature currently described as
> game-internal OMR staking must use actual OMR principal held on-chain. This includes `/v1/stake`, `/v1/unstake`, the
> Made Ladder and `effectiveStake`, commitment locks/multipliers, Den high-stakes access, career/coach/UI qualification,
> RWA `stakeMult`, the committed-rate `whack:loot` loss, unbonding exposure/release, death/inheritance continuity,
> token-health/ops reporting, and OMR conservation. The database may become a finalized indexed mirror and pending-
> settlement journal, but may not independently create, destroy, transfer, lock, unlock, or credit stake. The current
> `OMRStaking` contract is not sufficient as written: it promises principal is always immediately withdrawable, lets only
> the staker reduce principal, has no gameplay-loss/slashing settlement, commitment lock, six-hour on-chain unbonding,
> account/wallet binding, or per-user historical checkpointing. Do not retrofit gameplay loss through an unconstrained
> owner sweep or signer. The approved replacement baseline below defines custody, consent, narrow game-settlement
> authority, replay walls, chain-outage behavior, and backing treatment for existing database balances. Until that ships,
> the existing database mechanics remain legacy gameplay behavior and do not masquerade as on-chain stake.
>
> **Founder purpose-built OMRGameplayVault custody and settlement baseline — 2026-08-25.** Build a new
> `OMRGameplayVault`; do not retrofit the yield-oriented `OMRStaking` contract. The gameplay vault pays no personal APY
> and has no per-staker reward pool or claim path. Family yield and separately backed utility rewards may continue, but
> deposited principal does not generate personal yield. OMR earned only in the game database is not stakeable until an
> extraction/claim transaction puts the exact reserve-backed OMR on-chain; an atomic claim-and-stake path is permitted
> only when it proves the same receipt once and cannot double-credit the claim or stake.
>
> The public lifecycle is `deposit_pending -> active -> committed | unbonding -> withdrawable -> withdrawn`.
> `deposit_pending` is a nonqualifying pending-finality journal state; canonical receipt activates principal. Active
> principal may enter a commitment, and committed principal cannot bypass its published lock. After lock expiry it may
> return active or begin unbonding. Active or expired-commitment principal may enter the contract-enforced six-hour
> unbonding period; only finalized expiry makes it withdrawable. Gameplay outcomes may debit or reassign eligible
> active, committed, or unbonding principal under their published rates, but never manufacture a withdrawal transition.
> Every state and amount change is evented and checkpointed; the database only mirrors finalized state and journals
> pending transactions.
>
> A dedicated, rotatable gameplay-settlement signer has only typed outcome authority. The Safe may pause or rotate it;
> the role has no arbitrary transfer, approval, rescue, sweep, recipient-selection, or upgrade power. Loot remains inside
> the vault: an authorized loss reassigns actual OMR from the victim's eligible stake/unbonding bucket into the killer's
> on-chain idle gameplay balance rather than an EOA or an unbacked database credit. Each authorization is one-use EIP-712
> data binding the action and chain, vault, signer generation, immutable event ID, victim and recipient game accounts and
> verified wallets, source bucket, exact amount, maximum rate, victim settlement nonce, issue time, and deadline. Any
> wrong, stale, expired, replayed, or already-consumed field fails before mutation.
>
> Settlement is chain-first. The server may prepare a deterministic gameplay outcome, but it does not consume irreversible
> resources or publish the kill/loot result until the vault transaction is canonically finalized and the finalized mirror
> proves event/nonce continuity. If the chain, vault, signer-authorization service, or finalized mirror is unavailable or stale, the
> value-taking action fails closed before consuming ammunition, energy, cooldown, or another one-use resource. Recovery
> after a server crash must commit a finalized event exactly once, never resubmit the debit.
>
> Legacy `staked` and `unbonding` rows migrate only against OMR actually reserved and deposited into the new vault. The
> migration may not mint OMR merely to honor database rows or silently reduce other reserves. It publishes total legacy
> claims, actual backing, imported positions, and the unfunded difference as an explicit liability; an unfunded row is
> not represented as on-chain principal or allowed to qualify as if funded. Per-account detail remains visible to the
> affected account while public reporting exposes the aggregate conservation proof.
>
> **Founder gameplay-vault identity, consent, settlement-finality, and upgradeability rule — 2026-08-25.** Only the
> account's currently verified controller wallet or the exact reserve-backed claim-and-stake contract may increase that
> account's position. A third party cannot name another account as beneficiary; a direct ERC-20 transfer that bypasses
> the deposit entrypoint creates no position, qualification, consent, or checkpoint and remains separately accounted
> unattributed OMR. Each position is keyed to the permanent non-transferable game account ID plus one verified controller
> wallet, not a character name or Street Deed. Death, respawn, and inheritance preserve principal and history. Legitimate
> wallet recovery may rotate the controller without moving principal or resetting consent/nonces/checkpoints under the
> paired healthy-rotation and public seven-day lost-wallet process approved below.
>
> First deposit or commitment accepts an immutable published gameplay-risk ruleset hash/version on-chain. Safe may lower
> exposure or pause an outcome class for existing principal immediately. A higher loss rate or new loss category requires
> a new public ruleset version and fresh user consent before that principal is exposed. Within an accepted version the
> vault, not the signer, derives the debit from the typed outcome and source bucket. Current hard ceilings are 20% of
> active/committed stake and 50% of idle/unbonding OMR; the signer cannot supply a larger effective percentage or arbitrary
> amount. Safe may lower/pause those ceilings, while any increase follows the new-version/fresh-consent path.
>
> Each value-taking action progresses `prepared -> submitted -> finalized -> game_committed`. Preparation journals its
> intended immutable event ID and victim settlement nonce off-chain without reserving either on-chain, publishing the
> result, locking the victim, or consuming the one-use resource. Canonical submission is the first state-changing step.
> Canonical finality authorizes exactly one game commit. If the eligible bucket is smaller than the calculated loss at
> execution because an earlier canonical settlement won the race, the vault moves
> `min(calculatedLoss, eligibleBalance)`, emits the actual amount, and the underlying gameplay outcome may resolve with
> partial or zero loot; it never overdraws or becomes permanently unresolvable. A finalized vault event is the sole crash-
> recovery authority: an indexer may commit its matching game result exactly once and may never issue a replacement debit
> for the same event ID.
>
> Every deposit, commitment, unbond, withdrawal, gameplay loss, loot reassignment, and controller-wallet change writes an
> on-chain per-account checkpoint. The Made Ladder reads the latest finalized checkpoint and RWA `stakeMult` reconstructs
> the seven-day time-weighted average from finalized checkpoint history; a mutable database balance is never weight
> authority. Safe has separate pauses for deposits, new commitments, gameplay settlement, and withdrawals. The ordinary
> emergency posture stops new risk and gameplay debits but keeps user exits open. Suspending withdrawals requires a
> separately declared custody-integrity incident rather than being an automatic side effect of another pause.
>
> The founder rejected the non-upgradeable/migration-only recommendation: `OMRGameplayVault` will be upgradeable. The proxy
> implementation and upgrade authority are therefore explicit custody and consent trust boundaries because an upgrade
> can technically change rates, state transitions, signer checks, pauses, and withdrawal behavior. Proxy pattern, upgrade
> authority, delay, emergency path, compatibility checks, and rollback policy follow the approved governance baseline
> below. No public surface may describe the accepted rules as technically immutable across upgrades unless an enforceable
> constraint actually makes them so.
>
> **Founder gameplay-vault transparent-proxy upgrade-governance rule — 2026-08-25.** Use the reviewed OpenZeppelin
> Transparent Proxy pattern with a dedicated `ProxyAdmin`; do not substitute UUPS, Beacon, Diamond, or a custom proxy.
> A small non-upgradeable `GameplayVaultUpgradeGovernor` owns `ProxyAdmin`. The Safe is the governor's sole authorized
> proposer, canceller, and executor. `mainOperator`, gameplay-settlement signer, relayer, server/API keys, individual EOA,
> and the vault implementation itself receive no direct or delegated upgrade or governor-control authority.
>
> Every implementation upgrade and every governor-control change follows
> `upgrade_proposed -> waiting_48h -> executable -> executed_validated | cancelled | expired`. There is a minimum public
> 48-hour delay before execution. Incident response may immediately activate the already-separated pauses but has no
> emergency upgrade or delay-bypass path. The exact proposal immutably binds chain ID, proxy, current implementation and
> runtime code hash, proposed implementation and runtime code hash, semantic version, exact initialization-calldata hash,
> storage-layout commitment, reason code, audit/evidence hash, earliest execution time, and expiry. Execution with any
> mismatch reverts; changing the package requires a new proposal and delay.
>
> Each implementation disables its own initializer. The proxy initializes once. A later versioned reinitializer may run
> only once as the exact committed `upgradeAndCall`; no standalone or replayable initialization path exists. The same
> transaction runs mandatory post-upgrade validation over the pinned OMR token, vault token balance, total accounted
> liabilities, ruleset configuration, settlement-nonce continuity, pause state, controller bindings, and implementation
> version. Any required continuity failure reverts the whole upgrade. Validation is defense in depth rather than proof
> against a malicious implementation, so independent code review, storage-layout comparison, and fork rehearsal remain
> launch gates.
>
> A rollback is another full proposal subject to the same evidence, delay, exact execution, initialization, validation,
> and public history; no instant switch-back or permanently preauthorized old implementation exists. An upgrade that
> raises loss rates, adds a loss category, weakens withdrawals, expands signer authority, or otherwise changes economic
> risk creates a new ruleset and cannot expose existing principal without fresh user consent. Nonconsenting positions keep
> an exit under their previously accepted terms. Behavior-preserving security fixes may apply globally after the ordinary
> upgrade process.
>
> Public player and operator surfaces continuously expose proxy, implementation address/code hash/version, governor,
> controlling Safe, delay, pending exact package/calldata and evidence commitments, earliest execution, expiry, validation
> result, and complete upgrade/control history. An unexplained implementation, code-hash, admin, governor, or timelock
> mismatch is a persistent red incident and disables first-party deposits and new commitments. It cannot be rendered
> green or dismissed by an off-chain acknowledgment; existing exits follow the separate withdrawal-pause state.
>
> **Founder gameplay-vault controller recovery, partial exit, and exact-OMR accounting rule — 2026-08-26.** An ordinary
> controller change requires both the current controller's release and the proposed controller's acceptance. Each EIP-712
> or ERC-1271 authorization binds the same account ID, chain, vault, current controller generation, exact rotation nonce,
> both controller addresses, issue time, and deadline. The first valid paired execution wins and increments controller
> generation; no game login, server key, relayer, support role, or operator can substitute for either signature.
>
> Lost-wallet recovery is the separate fallback. Authenticated control of the permanent game account plus proof of the new
> wallet opens a public seven-day request, not an immediate controller change. Notify every available account channel.
> The current controller may contest/cancel during the window; only the Safe may resolve a contested request against a
> public evidence commitment, and even Safe approval cannot shorten the original seven-day minimum. An individual
> operator cannot select the destination, accelerate the clock, approve the request, or suppress its history. The recovery
> states and transitions are public and append-only: `recovery_pending -> finalized | cancelled | contested`, with a
> contested request proceeding only to `safe_approved -> finalized` or `safe_rejected`; expiry is terminal.
>
> While recovery is pending or contested, withdrawals, new deposits, new commitments, and further controller changes are
> frozen. Existing commitments, six-hour unbonding clocks, gameplay exposure, and valid gameplay-loss settlement continue;
> recovery creates no safe harbour. Finalization increments the monotonic controller generation and invalidates every
> unfinalized old-generation deposit, withdrawal, commitment, rotation, and recovery authorization without resetting any
> nonce. An unfinalized old-generation gameplay action fails and is abandoned without consuming its one-use resource.
> Already-finalized vault events, positions, consent, nonces, and checkpoints remain canonical and commit exactly once.
> Controller verification and every rotation/recovery/deposit/withdrawal path support EOA signatures and exact ERC-1271
> magic-value validation; revert, malformed/non-magic response, and signer-type mismatch fail closed with no fallback.
>
> Withdrawable principal is paid only to the current verified controller; there is no arbitrary `to`, support override,
> signer-selected, operator-selected, or relayer-selected recipient. Withdrawal is a direct permissionless controller-pull
> operation requiring no server signature, API, gameplay signer, relayer, or operator approval. Stake, unbond, and withdraw
> accept an explicit positive amount and reject zero, excessive, or precision-invalid input without mutation. Each partial
> unstake creates an independent tranche with amount, start, six-hour unlock, accepted ruleset version, and exposure
> history. Later requests cannot reset, extend, merge, shorten, or otherwise rewrite an earlier tranche. The deterministic
> earliest-unlock/lowest-ID consumption order, 16-live-tranche bound, and 0.01 OMR partial minimum follow the approved
> tranche rule below.
>
> The vault pins one exact OMR contract and uses `SafeERC20`. A deposit reads balance before and after transfer and derives
> receipt from `balanceAfter - balanceBefore`; the requested amount is never credited by assumption. A nonpositive or
> mismatched receipt, fee, rebase, elastic balance, unexpected hook, false/missing result, or other unsupported behavior
> creates no position and reverts or enters an explicit quarantine when atomic reversion is impossible. Direct bypass
> transfers are unattributed OMR: they fund no liability, account, qualification, checkpoint, consent, or deficit repair.
> Continuously enforce `actual OMR balance >= total accounted liabilities`. Surplus remains unattributed; any deficit is a
> persistent red custody-integrity incident that stops new deposits, commitments, and gameplay debits while the separately
> governed withdrawal response remains explicit. No database or operator entry may hide, haircut, or infer away drift.
>
> **Founder gameplay-vault tranche bounds, surplus recovery, and deficit-finality rule — 2026-08-26.** Gameplay loss
> consumes eligible unbonding tranches in ascending unlock-time order and, for equal unlock times, ascending immutable
> tranche ID. It exhausts one tranche before touching the next; neither signer, relayer, operator, nor caller chooses the
> order. An account may have at most 16 live unbonding tranches. A matured tranche no longer counts toward that limit,
> and an unstake that would exceed it reverts before mutation. A partial unstake must be at least `0.01 OMR`, except an
> account may always unbond its exact full remaining eligible stake. Matured tranches aggregate into one withdrawable
> balance for efficient controller-pull withdrawal, while immutable events and checkpoints preserve every tranche's
> amount, timing, ruleset, exposure, consumption, and withdrawal history.
>
> Solvent unattributed OMR is nonqualifying and nonspendable by default. The Safe alone may propose, cancel, and execute
> recovery of an exact verified surplus amount to one fixed OMR recovery-treasury address through
> `surplus_recovery_proposed -> waiting_48h -> executable -> executed | cancelled | expired`. The public proposal binds
> amount, fixed destination, reason/evidence commitment, earliest execution, and expiry; edits restart the delay. It may
> not credit a player, settle gameplay, choose an arbitrary recipient, or be executed by `mainOperator`, the gameplay
> signer, relayer, server, or individual wallet. A permissionless `fundDeficit(amount)` accepts pinned OMR, measures the
> actual receipt, repairs the custody deficit first, gives no player balance, qualification, yield, repayment claim, or
> gameplay credit, and classifies any receipt above the deficit as unattributed OMR.
>
> Any positive custody deficit automatically applies a deficit-specific withdrawal pause and stops deposits, new
> commitments, and gameplay debits, preventing a first-withdrawer bank run. Every user liability remains recorded at its
> full amount: there is no haircut, pro-rata conversion, first-come settlement, operator write-off, or database adjustment.
> Once canonical chain state proves zero deficit at configured finality and the continuous public mirror synchronizes,
> only the deficit-specific pauses clear automatically—no Safe acknowledgment or cooldown is required, and every
> independent pause or blocker remains in force. Every value-changing entrypoint checks solvency before and after its
> effects. Anyone may call `syncSolvency()` and `syncUnattributed()`. Each zero-to-positive deficit transition creates a
> new immutable incident ID, and public monitoring verifies actual balance, full liabilities, incident generation,
> finality, mirror freshness, and sequence continuity; an acknowledgment can never close or conceal the incident.
>
> **Founder gameplay-loss calculation and settlement-sequencing rule — 2026-08-26.** For each eligible
> source bucket, the vault—not the signer—derives loss from that bucket's execution-time pre-settlement balance, rounds
> down to OMR atomic units, and applies the signed amount/rate only as ceilings. A legitimate zero result still finalizes
> the outcome; there is no round-up-to-one rule. One outcome that touches multiple buckets settles atomically in one
> transaction: every bucket is calculated independently, unbonding follows the approved tranche order, the combined
> actual loot credits the killer exactly once, and any failed bucket/signature/nonce/controller/solvency invariant reverts
> the whole settlement.
>
> Finalized loot lands immediately in the killer's on-chain idle gameplay balance and remains exposed under the idle-rate
> rules. It is not automatically committed or staked and does not begin contributing to the Broker stake TWA until the
> killer performs the separately authorized eligible action. A settlement authorization rejects a future `issuedAt` and
> permits at most five minutes from issue to canonical inclusion; inclusion before the deadline may reach finality later.
> `prepared` is an expiring off-chain journal state only: it cannot reserve vault OMR, consume a nonce, pause or block the
> victim, or otherwise mutate custody. Canonical submission is the first state-changing step, so prepared actions may
> race and stale losers fail without consuming gameplay resources.
>
> Every outcome binds one globally unique immutable gameplay event ID and the victim's exact next monotonic settlement
> nonce. A successful canonical settlement consumes that nonce even when actual loot is zero; a prepared, rejected,
> expired, or reverted attempt consumes neither event authority nor nonce. The MVP accepts exactly one outcome and emits
> one complete outcome record per transaction. Batching remains unauthorized until separately designed with deterministic
> failure semantics, justified by measured need, reviewed, and audited.
>
> **Founder signer rotation, permissionless settlement, community gas, finality, and Broker stake-weight rule — 2026-08-26.** Ordinary
> signer rotation activates the new generation immediately and preserves only old-generation authorizations issued before
> canonical rotation, for the lesser of their original deadline or five minutes after rotation. Emergency Safe revocation
> has no overlap and invalidates every old-generation authorization not already canonically included; finalized settlement
> remains immutable. Submission is permissionless: any address may present the exact signed authorization, but submission
> grants no signer, custody, recipient, amount, rate, pause, upgrade, controller, or ruleset authority. The proposed
> approved-relayer registry, three-relayer cap, operator relayer management, and Safe relayer-set controls are superseded
> and must not be built. Invalid, stale, expired, replayed, malformed, or losing-race submissions revert without canonical
> mutation; their callers bear their own gas, and spam alone cannot pause settlement or create an incident.
>
> Community settlement gas uses a dedicated non-upgradeable `SettlementGasPool` that accepts only the supported chain's
> native gas asset. It is a separate contract and accounting domain with no custody of, approval over, or access to OMR
> gameplay principal, player liabilities, RWA acquisition ETH, Stock Tokens, or unrelated treasury funds. Sponsorship is
> a final community contribution: it creates no sponsor balance, refund, yield, priority, allocation weight, governance
> power, repayment claim, or other economic credit. The Safe cannot sweep contributions to treasury. A public 48-hour
> migration may move only unreserved ETH to one exact successor pool bound by chain, address, verified code hash, amount,
> reason, earliest execution, and expiry; the old pool retains exact ETH for every outstanding executor credit and keeps
> credit withdrawals live.
>
> Only the address whose valid submission creates the canonical settlement for an event ID/victim nonce earns a gas
> credit, including a legitimate successful zero-loot settlement. Invalid, expired, malformed, wrong-chain/vault,
> reverted, replayed, stale, and losing-race calls earn zero. After completing all vault economic effects, the fixed pool
> records a credit to the successful `msg.sender`; it never pushes ETH during settlement and exposes no arbitrary credit
> recipient. The submitter later pulls its accumulated credit only to itself under checks-effects-interactions and
> `ReentrancyGuard`. Outstanding credits are exact pool liabilities and are excluded from reimbursable balance, preserving
> `actual native balance >= total outstanding credits`. Pool pause, emptiness, insufficiency, or an isolated credit-hook
> failure never reverts or invalidates an otherwise canonical gameplay settlement.
>
> The contract accepts no caller-supplied gas bill. It computes `reimbursableGasPrice = min(tx.gasprice, block.basefee +
> PRIORITY_FEE_CAP)` and `verifiedGasCost = measuredSettlementGas × reimbursableGasPrice + approvedChainNativeDataFee`,
> where measured gas covers only the audited settlement span plus a fixed audited overhead and a data-fee component exists
> only through the supported chain's canonical reviewed source. Credit is
> `min(verifiedGasCost, PER_SETTLEMENT_WEI_CAP, actualBalance - outstandingCredits)`. Arbitrary caller work, excess calldata,
> unrelated external calls, deliberate gas burning, failed work, and fee amounts above public caps are not reimbursed.
>
> Empty or insufficient sponsorship produces a partial or zero credit and does not close permissionless settlement; a
> willing caller may self-fund. If nobody submits, the game remains uncommitted and consumes no irreversible resource.
> Public surfaces show unreserved pool ETH, outstanding credits, capped estimate, full/partial/unavailable status, and
> contribution/reimbursement history. The Safe may immediately pause new credits or reduce caps, but existing credits
> remain withdrawable. Cap increases, a new chain-native fee source, and pool migration require an exact public 48-hour
> proposal. Unpause requires a public reason and solvent pool. The Safe cannot select submitters, manually reimburse a
> chosen call, redirect a credit, or replenish this pool from OMR/RWA custody.
>
> Permissionless spam is bounded by exact typed authorization, five-minute inclusion expiry, signer generation, chain and
> vault binding, unique event ID, exact nonce, account/wallet/bucket/rate/amount binding, vault-derived execution-time loss,
> cheap rejection before economic work, the 16-live-tranche bound, no submitter-selected external call, and one canonical
> settlement per event/nonce. Invalid calls remain caller-funded and unreimbursed. Public HTTP surfaces may enforce auth,
> idempotency, rate limits, and abuse controls without restricting direct on-chain submission. Monitoring may alert on
> abnormal failures, but spam alone never reserves authority, locks a victim, consumes gameplay resources, pauses the
> protocol, or creates a canonical incident.
>
> Every supported chain publishes one exact `SETTLEMENT_FINALITY_BLOCKS`; server, signer, submitter, and operator cannot
> choose a lower per-action threshold. Every increase or decrease follows the same Safe-only
> `finality_change_proposed -> waiting_48h -> executable -> executed | cancelled | expired` process and binds the supported
> chain, exact current and proposed counts, reason/evidence hash, proposal time, earliest execution, expiry, and effective
> block. A change applies prospectively only to transactions first included after that boundary; pending and finalized
> transactions retain their inclusion-time rule. Emergency response pauses new value-taking settlements and never hot-edits
> finality. A pre-finality reorg returns the same immutable
> event ID and victim nonce to retryable state. The original authorization may be resubmitted while valid; after expiry,
> a fresh authorization may reuse that same event and nonce only after canonical absence is proven. Each finalized event
> publishes event/ruleset, signer and controller generations, victim nonce, submitter, issue/deadline/inclusion times,
> bucket pre-balances, rate/amount ceilings, rounded debits, consumed unbonding tranches, combined killer credit, and
> post-settlement solvency totals.
>
> Broker `stakeMult` is capped at `1.50×` and uses finalized seven-day TWA eligible principal: below 300 OMR `1.00×`,
> 300–999.999… `1.10×`, 1,000–4,999.999… `1.20×`, 5,000–19,999.999… `1.35×`, and 20,000+ `1.50×`. Only finalized
> active and committed principal qualifies; pending deposit, idle loot, unbonding, withdrawable, withdrawn, unattributed,
> quarantined, and unfunded legacy amounts do not. One verified wallet may qualify only one permanent account per epoch;
> a collision gives every conflicting claim zero stake multiplier until resolved. Each finalized transition changes TWA
> prospectively from its canonical time, with no snapshot shortcut, backfill, or retroactive restoration.
>
> Only the Safe may change tiers or thresholds, after at least seven public days, effective no earlier than the first full
> epoch beginning after notice. Each epoch freezes its tier schedule, wallet/account bindings, eligible-bucket definition,
> activity formula, activation requirement, and ruleset version. A critical defect pauses or cancels the epoch rather than
> rewriting weights after participation is known.
>
> **Founder units-first portfolio and evidence-based complexity rule — 2026-08-25.** Player and operator views lead with
> actual Stock Token units, acquisition reference/cost, allocation epoch, delivery state, and custody destination.
> Estimated market value is secondary, timestamped, source-labeled, and stale-aware, never presented as guaranteed cash,
> yield, or redeemability. Any RWA subsystem beyond the MVP requires demonstrated recurring material value, measured
> user demand, or an actual failure mode plus a written Safe-approved scope before engineering begins.
>
> **Founder reconciliation-incident alert/UI rule — 2026-08-25.** Any positive reconciliation shortfall or operator
> debit of reconciliation backing emits an immediate critical alert and keeps the RWA operator UI in a persistent red
> incident state. The state shows aggregate and per-record liabilities, backing, shortfall, age, affected intent and
> attempt IDs, last quarantine outflow, vault deficit, and purchase-pause status. Each zero-to-positive transition
> creates a new immutable `incidentId`; alerts, acknowledgments, outflows, repairs, and reconciliation actions append to
> that generation. It closes only after finalized canonical zero synchronizes into the mirror, and a later recurrence
> creates a new ID. Safe or current `mainOperator` may submit a signed public acknowledgment bound to the exact
> `incidentId` and, for operator authority, current operator generation. Acknowledgment may silence duplicate
> notifications only; it cannot clear, downgrade, conceal, resolve, unpause, or mutate the incident's financial state.
>
> **Founder acquisition-deficit delivery-continuity rule — 2026-08-25.** A reconciliation shortfall or acquisition
> accounting deficit pauses new purchase-intent creation and execution but does not pause delivery of Stock Tokens
> already acquired and allocated when exact `StockVault` custody and every delivery invariant remain healthy. Asset
> quarantine, custody mismatch, delivery hold, insufficient delivery gas, fee ceiling, stale token health, or another
> independent delivery wall still pauses affected work. This distinction creates no new allocation or purchase.
>
> **Founder stale reconciliation-mirror fail-closed rule — 2026-08-25.** If the canonical RWA accounting mirror is
> more than ten minutes stale or cannot prove finalized `accountingSequence` continuity, the operator UI remains red
> and displays `incident_state_unknown_stale`; it never renders green. The UI disables new risk-creating purchase
> controls while keeping recovery funding, reconciliation, cancellation, expiry, and otherwise-authorized operator
> outflow controls available. Stale display state neither invents an on-chain incident nor resolves a real one.
>
> **Founder exact incident-closure and composable-blocker rule — 2026-08-25.** A reconciliation incident closes only
> when finalized canonical state simultaneously proves aggregate `reconciliationShortfall == 0`, vault-wide
> `accountingDeficit == 0`, every affected record's liability/backing invariant, continuous `accountingSequence`, and
> synchronized public-mirror state; acknowledgments are irrelevant to closure. Purchase blocking is a set of
> independent reasons, including manual Safe/operator pause, reconciliation deficit, stale accounting mirror, token
> quarantine, oracle failure, and exposure cap. Clearing one reason removes only that blocker. Purchases resume only
> when none remain, so automatic deficit clearance never clears a manual or unrelated pause.
>
> **Founder priority-index rebuild and bounded-mutation rule — 2026-08-25.** If a contract-maintained debit or repair
> priority index disagrees with immutable records, new purchases pause and anyone may rebuild it deterministically in
> bounded chunks. The completed root must equal the root derived from immutable records; Safe/operator cannot choose
> order, and related mutations remain unavailable until the rebuild proves complete. Every operator outflow or generic
> repair supplies a public positive `maxComponents`; the entire requested transfer or repair must be accountably
> processable within that bound or revert before any mutation or ETH transfer. Large actions may use sequential
> transactions, each preserving the same deterministic order.
>
> **Founder canonical incident-history cursor rule — 2026-08-25.** Public incident history uses an immutable cursor
> ordered by `accountingSequence`, `componentIndex`, and stable event ID. Offset pagination and mutable latest-first
> authority are forbidden. The UI defaults to the active or most recent incident but exposes a complete export of every
> generation, with cursor continuity and canonical reorg/finality status visible to clients.
>
> **Founder Safe/main-operator explicit intent-cancellation rule — 2026-08-25.** The Safe or current
> `mainOperator` may immediately call `cancelIntent(intentId, reasonCode, detailsHash)` for a currently active intent,
> without transferring ETH. The action uses the existing closed reason taxonomy, requires a nonzero details hash,
> marks terminal `intent_cancelled`, releases the entire remaining reservation to available acquisition ETH except
> any unresolved `reconciliation_pending` portion, and
> consumes the next `accountingSequence`. Its immutable event publishes actor/authority, reason/details, released
> amount, intent/attempt state, and complete pre/post accounting. It cannot revive, substitute, extend, replay, split,
> re-reserve, allocate, or create catch-up, and it does not rewrite the ballot, asset, prior attempts, or deposit
> history. Canonical inclusion order decides cancellation versus execution, expiry, refund, or operator outflow; the
> first valid transition wins and every later incompatible call fails without mutation. This is an explicit power
> for either authority to abort a planned RWA purchase even when no ETH leaves the vault.
>
> **Founder relayed intent-cancellation authorization rule — 2026-08-25.** The current `mainOperator` may cancel
> directly or authorize a relayer through EIP-712/ERC-1271. The typed cancellation binds action, chain, vault,
> operator generation, exact intent ID, reason code, nonzero details hash, exact `nextIntentCancelNonce`, `issuedAt`,
> and deadline. Its deadline may be no more than one hour after issuance and no future-issued authorization is
> accepted. Direct and relayed operator cancellations consume the same monotonic cancellation nonce, which is
> independent of `nextOutflowNonce`; Safe cancellation consumes neither operator nonce. Operator replacement,
> renunciation, or zero-disable invalidates every older-generation cancellation signature.
>
> **Founder asymmetric emergency purchase-pause rule — 2026-08-25.** The Safe or current `mainOperator` may
> immediately pause new intent creation and intent execution with a closed public reason code and nonzero details
> hash, but only the Safe may unpause. Pause does not stop canonical deposits, deficit repair, matched refunds,
> reconciliation, permissionless expiry, explicit cancellation, or otherwise-authorized operator outflows. Existing
> intent deadlines continue to run without extension, tolling, revival, substitute, or catch-up, and reservations
> remain governed by their normal expiry and cancellation rules. Every pause and unpause is public, forward-only, and
> bound to actor, authority, operator generation, reason/details, and inclusion time.
>
> **Founder matched/late/unmatched refund rule — 2026-08-25.** A refund is matched only by exact intent, approved
> attempt, adapter/sender, and canonical transaction provenance, and cumulative matched refund cannot exceed that
> attempt's actual debited ETH. While the intent remains active, verified refund restores that intent's remaining
> reserved capacity up to its original bound, permitting only an otherwise-valid retry before the same deadline.
> After cancellation, `intent_expired`, successful finalization, or any other terminal state, verified refund first
> repairs that exact attempt's reconciliation shortfall, if any; only the remainder is available acquisition ETH. It
> never reopens the intent, ballot, allocation, purchase window, substitute, or catch-up. Unknown-intent,
> unprovable-sender/provenance, and above-debit excess refund is `unattributed`, not
> available. Each receipt publishes sender, amount, intent/attempt when known, provenance, cumulative debit/refund,
> resulting classification, and pre/post buckets. Reclassification and main-operator withdrawal then follow the
> existing unattributed rules.
>
> **Founder canonical acquisition-deposit identity rule — 2026-08-25.** Only a currently Safe-approved
> acquisition ingress contract may credit canonical acquisition ETH. Each positive-value deposit binds
> `depositId = keccak256(abi.encode(chainId, sourceContract, externalPaymentReferenceHash))`; caller/source,
> nonzero external reference, and `msg.value` must match, and any reused `depositId` reverts rather than replaying
> or double-crediting. Success credits available ETH and emits deposit ID, chain, source, external reference hash,
> amount, approval version, and pre/post buckets. Safe ingress approval/revocation is public and forward-only.
> Direct receipt, unapproved source, missing/malformed reference, source mismatch, and forced balance remain
> `unattributed`; none may claim canonical identity through later sync.
>
> **Founder exact ingress-code identity rule — 2026-08-25.** Each Safe ingress approval binds the exact chain,
> source address, source runtime code hash, and an approval version. For a proxy it additionally binds the resolved
> implementation address and implementation runtime code hash; a non-proxy records no implementation. The canonical
> deposit path revalidates every bound field before consuming a deposit ID or crediting a bucket. Any source-code,
> proxy, or implementation change requires a fresh public Safe approval version; a mismatch reverts the canonical
> call. Plain or forced ETH that nevertheless reaches the vault remains `unattributed`. Revocation and replacement
> are forward-only: deposits accepted under an older approval remain canonical history, and every previously used
> deposit ID remains consumed forever.
>
> **Founder single-active-ingress-version rule — 2026-08-25.** Each acquisition vault holds at most one active
> canonical ingress approval version: one exact version or the disabled/zero state. Safe rotation is one atomic
> transition that deactivates the old version and activates the new one; there is no overlap, grace period, or
> dual-source window. The canonical deposit call must name and match the version active at transaction inclusion.
> Broadcast or mempool time grants no grandfathering: an old-version call included after rotation reverts before
> accepting ETH, consuming its deposit ID, or changing accounting. Plain or forced ETH that nevertheless arrives is
> `unattributed`. Canonical chain ordering resolves same-block rotation/deposit races, while prior accepted deposits,
> consumed IDs, and approval history remain unchanged.
>
> **Founder immutable deficit-repair deposit-split rule — 2026-08-25.** A canonical deposit received while
> `accounting_deficit > 0` consumes its `depositId` once and records
> `deficitRepairAmount = min(msg.value, deficitBefore)` and
> `availableCreditAmount = msg.value - deficitRepairAmount`. The repair portion raises actual balance and reduces
> the deficit without crediting a bucket; only `availableCreditAmount` increases available acquisition ETH. The
> repair portion uses the unified deficit-component queue ordered by `firstObservedAt`/`shortfallCreatedAt`, numeric
> `componentTypeCode`, then record ID, fully repairing each component before at most one partial repair; the depositor
> cannot select a record or bucket. An exact late refund remains causally bound to its own attempt instead. The
> immutable deposit record emits total value, both split amounts, deficit before/after, approval version, and
> pre/post buckets. A fully consumed repair deposit is still canonical provenance but creates zero spendable ETH;
> retries cannot reuse its ID or claim that the full `msg.value` became available.
>
> **Founder immediate accounting-only Safe reclassification rule — 2026-08-25.** Safe may immediately call
> `reclassifyUnattributed(amount, reasonCode, detailsHash)` for a positive amount no greater than the
> unattributed bucket. The only state move is `unattributed -> available`; it transfers no ETH, creates no
> reservation, targets no ballot/asset/intent, revives nothing, bypasses no cap/oracle/adapter/deadline, and never
> classifies value as purchased. The classification event is immutable and cannot be reversed or deleted,
> although the reclassified ETH may later leave through an ordinary valid purchase or `operator_outflow`.
>
> **Founder accounting-deficit/operator-survival rule — 2026-08-25.** If accounted buckets exceed actual vault
> balance, publish `accounting_deficit = accountedBuckets - vault.balance` with the first-observed block/time,
> cause, last reconciliation, and pre/post figures. While positive, block automated buying, new reservations,
> Safe reclassification, and canonical vault migration. Existing expiry/cancellation/refund reconciliation and
> canonical/unattributed inflows remain available to repair state. Every incoming wei first reduces the deficit
> by raising actual balance without crediting a new bucket; only value beyond full repair becomes available under
> a canonical deposit or unattributed otherwise. The `mainOperator` may still withdraw up to the actual remaining
> balance through the fixed available-then-unattributed-then-reserved-then-reconciliation-pending debit order; publish deficit
> before/after, and never transfer more than actual balance. Such an outflow reduces balance and debited buckets
> together, so the deficit remains explicit rather than being written down. Automation/migration resumes only
> after public reconciliation proves the deficit is zero. No Safe, operator, sync, or migration action may
> silently haircut or erase an accounted bucket or deficit.
>
> **Founder finalized zero-deficit automatic-resumption rule — 2026-08-25.** Deficit mode clears only when a
> canonical-chain reconciliation computes `accounting_deficit == 0`, that block reaches the configured finality,
> and the finalized result synchronizes into the public mirror. At that point automation and canonical migration
> resume immediately under every ordinary cap, oracle, adapter, health, deadline, and authorization wall, with no
> Safe/operator acknowledgment or extra cooldown. Clearance never revives an expired/cancelled intent, extends a
> purchase window, replays a missed ballot, or creates catch-up authority. The reconciliation publishes its block,
> transaction, finality, synchronized time, and deficit/bucket/balance pre/post state. A later canonical deficit
> re-enters deficit mode immediately; no role may manually declare zero or bypass finality.
>
> **Founder vault-wide accounting-sequence rule — 2026-08-25.** Every successful atomic vault-accounting entrypoint
> receives exactly the next monotonic `accountingSequence`. This includes canonical deposits/deficit repair,
> unattributed synchronization, Safe reclassification, reservation/intent creation, purchase debit/finalization,
> refunds, expiry/cancellation, operator outflow, deficit reconciliation, and canonical migration. One transaction's
> component effects share its sequence and use deterministic `componentIndex` order. Each record publishes action,
> actor, transaction/block position, and complete pre/post vault balance, available, unattributed, reserved,
> accounted-bucket total, and deficit, plus affected intent/bucket deltas. Reverts and true no-ops consume no
> sequence. Canonical on-chain inclusion order is authoritative; worker time, API arrival, and database time cannot
> reorder or invent mutations. Mirrors roll back reorged entries and expose only finalized canonical ordering;
> duplicates, unexplained gaps, or pre/post discontinuity are public synchronization failures, never silently healed.
>
> An outflow is authorized only by a direct on-chain call from the current `mainOperator` or a relayed EIP-712
> authorization from that same current address. The typed authorization binds action, chain ID, verifying vault,
> operator generation, recipient, amount, reason code, nonzero details hash, exact current global nonce,
> `issuedAt`, and deadline. Nonces never reset on role rotation; authorization is consumed exactly once, and an expired,
> replayed, wrong-chain, wrong-vault, or
> former-operator signature fails before accounting changes. A backend key, bearer token, server session, or
> relayer identity alone never authorizes an outflow.
>
> **Founder outflow reason/nonce rule — 2026-08-25.** Every outflow selects exactly one closed, public reason
> code: `operations`, `security`, `purchase_recovery`, `migration_bypass`, `retirement`, `other`, or
> `reconciliation_outflow`, and supplies
> a nonzero `detailsHash` committing to the canonical explanation bytes. The code and hash are immutable event
> fields. An outflow that debits any `reconciliation_pending` backing must use `reconciliation_outflow`; every other
> reason reverts before nonce, bucket, liability, or transfer mutation. An outflow that does not touch reconciliation
> backing may not use that dedicated code. The operator never selects which accounting bucket or reconciliation
> record is debited.
> Execution does not depend on an off-chain document remaining available. Direct and relayed outflows
> both require the exact `nextOutflowNonce` and increment that single global counter on success. The current
> operator may call `invalidateOutflowNonces(newNextNonce)` without moving ETH, where `newNextNonce` must exceed
> the current value; it advances past all lower signed authorizations and emits the old/new nonce. It changes no
> vault bucket, reservation, allocation, or purchase cap. Emergency role-generation invalidation remains an
> independent all-signatures wall.
>
> **Founder relayed-authorization time rule — 2026-08-25.** A relayed authorization is valid only when
> `issuedAt <= block.timestamp <= deadline`, `deadline > issuedAt`, and `deadline - issuedAt <= 1 hour`.
> A future `issuedAt`, expired authorization, zero/reversed interval, or interval over one hour fails before
> signer, nonce, bucket, or reservation mutation. Direct calls are live operator authorization and carry no
> signature-lifetime window, while still consuming the same exact current nonce and recording the same reason.
>
> **Founder zero-recipient/no-burn rule — 2026-08-25.** Every operator outflow requires a nonzero recipient.
> The protocol exposes no `operator_burn`, zero-address transfer, or other intentional ETH-burning action because
> no justified product scenario exists. This cannot prove that an arbitrary nonzero recipient is recoverable;
> that residual destination risk remains part of the explicit main-operator trust assumption.
>
> **Founder operator self-renunciation rule — 2026-08-25.** The current `mainOperator` may directly renounce.
> Renunciation is not relayable and requires `msg.sender == mainOperator`; it atomically sets the operator to
> zero, cancels any pending nomination, increments the role generation, and invalidates every outstanding signed
> authorization, exactly like emergency Safe disable. It moves no ETH, changes no nonce/bucket/reservation/
> allocation/cap, and emits the former operator and new generation. Renunciation itself names no successor; an
> orderly handoff uses instant `replaceMainOperator` before renunciation.
>
> **Founder EOA/ERC-1271 operator rule — 2026-08-25.** `mainOperator` may be an EOA or an ERC-1271 smart-contract
> wallet. The direct path always requires `msg.sender == mainOperator`. On the relayed path, an address with no
> code must recover exactly as the ECDSA signer; an address with code must return the exact ERC-1271
> `isValidSignature` magic value for the same EIP-712 digest. Revert, out-of-gas, malformed return data, wrong
> magic value, or signer-type mismatch fails closed before nonce or accounting mutation. No fallback from a
> failed ERC-1271 check to ECDSA or from a failed ECDSA recovery to arbitrary contract validation is allowed.
>
> **Founder ETH-only operator-call rule — 2026-08-25.** `operator_outflow` may send ETH to any recipient but
> invokes that recipient only with empty calldata. It exposes no arbitrary-call payload, `delegatecall`, token
> approval, or token-transfer surface and cannot move Stock Tokens or other ERC-20/ERC-721/ERC-1155 assets.
> A contract recipient's payable `receive`/fallback may execute; checks-effects-interactions, a reentrancy guard,
> and atomic revert on transfer failure protect the vault. Richer contract interaction happens after ETH leaves
> the vault, from the operator or recipient, not with vault authority.
>
> **Founder operator-outflow debit/disclosure rule — 2026-08-25.** Each outflow uses one contract-fixed order:
> available ETH first, unattributed ETH second, ordinary reserved ETH third, and `reconciliation_pending` ETH last;
> the caller cannot choose a bucket. If ordinary reservations must be touched,
> the vault cancels the minimum number of whole intents needed: sort live reservations by amount descending,
> then later execution deadline first, then intent ID ascending; cancel until their total covers the shortfall.
> No intent remains partially funded. Any cancelled-reservation excess left after the transfer becomes
> available ETH. If reconciliation backing is still required, debit the greatest backed amount first, then oldest
> `reconciliationStartedAt`, then lowest intent ID, fully exhausting records before at most one partial debit. The
> transaction publishes one cancellation record per affected intent and an immediate
> `operator_outflow` record containing operator, authorization path, recipient, amount, reason code, details
> hash, nonce,
> affected intents, and pre/post vault balances and buckets. Transfer failure rolls the whole state change back.
> Public API and board state must expose the current/pending operator, rotation clock, outflow, and cancellations.
>
> **Founder spend-based concentration-cap rule — 2026-08-25.** Normal purchases simultaneously obey ballot
> input, Safe-set per-purchase cap, citywide daily ETH cap, exact-version rolling-30-day ETH cap, and available
> unreserved vault balance. Actual trade input including input-deducted fees consumes capacity; separate gas
> and failed/reverted/cancelled/replaced/expired attempts do not. Success atomically consumes daily/rolling
> capacity. Safe may lower immediately; falling below already consumed capacity never sells/invalidates/
> reallocates and only blocks future buys until capacity returns. Increases need exact public Safe execution,
> finality, and sync. A blocked winner becomes `exposure_cap_reached`, no substitute, ETH remaining pooled.
> Splitting cannot evade one-success. Public state exposes caps, consumed/remaining values, window, and wall.
> `mainOperator` ETH transfers bypass these purchase caps because they are withdrawals, never purchases, and
> cannot be represented as asset acquisition.
>
> **Founder vault migration/retirement with operator bypass — 2026-08-25.** The canonical state-preserving
> migration path remains a Safe proposal delayed at least 48 hours and binding old/successor vault, chain,
> successor code hash, full expected amount, old/new accounting hashes, evidence, earliest time, and expiry.
> It requires no pending purchase (or deterministic reservation recreation), identical acquisition-only buyer
> walls, reconciled full balance/state, atomic move, persistent surplus classification, retirement of old
> reservations, finality/sync, and public proof. Pause is immediate; the migration delay is not shortened.
> Separately, `mainOperator` may bypass the migration path and move some or all ETH immediately/arbitrarily.
> Such a move is only `operator_outflow`: it does not migrate reservations/state, does not certify a successor,
> and must cancel impacted intents. On permanent program retirement the main operator may withdraw/dispose of
> the pooled ETH arbitrarily; absent that action, it remains in the acquisition vault. The board must never
> describe operator-withdrawn funds as locked, acquisition-only, purchased, refunded, or migrated.

Supersedes nothing. It *reverses* part of `omerta-stock-layer-retirement.md` (2026-07-31), which is a
founder call and is recorded as such in §6.

---

## 1. The reference, accurately

StonkBrokers is a 4,444-item collection on Robinhood Chain — our chain — and the mechanism the
founder is pointing at is specific enough to copy properly rather than approximate:

- Each NFT is an **ERC-6551 token-bound account**: the NFT literally owns a wallet, seeded with
  tokenized stock (TSLA, AMZN) at mint.
- **Protocol fee income is converted into tokenized stock and dropped to those bound accounts.**
  Funding is cited as 70% of Anvil AMM transaction fees, triggered by a user "Clock In" action.
- Rewards are **not automatic for holders**. You must spend STONKBROKER tokens to *activate* the NFT
  into the distribution set. Five tiers, 66,666 → 1,666,666 tokens, weights 1× → ~3.33×.

Three things in that are worth taking, and one is worth *not* taking.

**Take:** the bound account (the reward has somewhere to live that travels with the NFT), the
activation burn (holding is not enough — you must commit to be paid, which is a token sink), and
fee-income-as-funding rather than a promise from treasury reserves.

**Do not take: activation weighting alone is WEALTH-weighted.** Their weight is a pure function of
how many tokens you burn, so the largest holder is by construction the largest earner, and the
mechanism rewards capital rather than participation. We already have the fix for that, built and
merged this week.

---

## 2. What we already have, and how well it fits

This is unusually well-matched to existing machinery. Almost nothing here is new invention:

| Stonkbrokers piece | Ours | Status |
|---|---|---|
| ERC-6551 bound account | The Dynasty NFT's token-bound account | **Designed, not built** (`omerta-identity-nft-design.md`) |
| Activation burn in the project token | A `$OMR` burn through the `spendOmr` till | Machinery exists; the sink is new |
| "Clock In" trigger | **`ACTIVITY`** — the metric merged in #29 | **Built** |
| Fee income as funding | The **treasury slice** — 10% of gameplay fees, 25% of bonds, 20% of Store, 4% of the sell tax, accruing in `rwa_revenue` | **Built** |
| `allocated ≤ held` | `runTreasuryInvariants` | **Built** — ETH arm *and* per-ticker units (step 2, done) |

**The ACTIVITY fit is the important one.** Their "Clock In" is a button; ours is a measured,
Sybil-resistant, fail-closed score over throttled actions with a breadth gate, agent-player parity,
and an NPC/resident exclusion.
Using it as the second weighting term turns a wealth-weighted airdrop into a **play-weighted** one,
which is both a better game and a materially better posture on every other axis.

---

## 3. The architecture

```
Robinhood /rhj/assets ──proposal──▶ OMERTÀ Safe ──approval──▶ StockTokenRegistry (chain 4663)
                                                               │ active candidates
families vote in server DB ──daily tally hash + asset key───────┤
                                                               ▼
treasury ETH ──keeper──▶ RwaStockBuyer ──approved adapter──▶ StockVault (exact-token balance check)
                                                                  │
completed activity epoch ─▶ weight snapshot ─▶ allocations ─▶ signed delivery authorization
                                                                  ▼
                                                   Street Deed ERC-6551 account
```

The server mirrors the on-chain active registry into Postgres before ballot resolution. Voting never
waits on RPC under a family/character lock, and an RPC outage preserves the last-known-good approved
list. The pre-chain development fallback publishes the original launch allowlist with null addresses;
it is not purchase authority. In production, an empty synced registry means no candidates—not an
automatic fall-through to static tickers.

If that active list is empty, ballot operation stops visibly rather than inventing authority. There is no
default, the cast route accepts no ticker, and rollover writes a public `catalog_empty` skipped-day record
without publishing an on-chain winner. The acquisition pool remains untouched. A later Safe-approved
activation resumes only future open ballots; it cannot backfill or replay the empty days. The existing
resolver's transient `no_tickers` return is insufficient until the skipped status is durably recorded and
exposed on the public board.

During an open ballot, a registry deactivation invalidates only votes for that candidate. The ballot's
day and cutoff do not change; affected families may use the existing same-day recast path, and the public
board must stop counting the invalid votes immediately. At close, unrecast invalid votes are ignored and
the remaining active tally resolves normally; only a tie or silence invokes the active default. The
current resolver and board still need that active-candidate filter and an explicit invalid-vote display,
so this rule is a launch requirement rather than a claim about the live implementation.

**Operator intake (implemented 2026-08-24, bootstrap policy approved 2026-08-24).**
`npm run stock-catalog` reads Robinhood's official `https://api.robinhood.com/rhj/assets` discovery
endpoint and reports the chain-4663 deployments, provider asset IDs, status, decimals, and trading
capabilities. `--initial-top-volume --registry <address>` also reads the official bulk `/rhj/prices`
feed and automatically emits the one-time initial Safe proposal for exactly the top 15 eligible assets
by `dailyTradingVolume`. That field is the underlying security's daily share volume—not on-chain DEX
volume or mint/burn volume. Eligibility requires active + fractional-tradable metadata, canonical
address agreement between both feeds, a fresh non-halted quote, and positive bid/ask/volume; exact
decimal comparison and ticker-order tie breaking make the output deterministic. The registry's ranked
insertion order becomes the production fallback order, so silence/ties select the highest-volume active
entry rather than an arbitrary alphabetic ticker. The static SPY default is development-only once a
production registry is configured.

The tool never signs or sends a privileged write. The Safe still verifies legal/product eligibility,
the supported venue route and independent oracle, and exposure caps before executing the generated
calls. This is an initial snapshot, not an automatically rotating index: supplying `--tickers` plus
`--registry` emits unsigned calldata for later explicitly reviewed changes, and a newly listed provider
asset never auto-enrolls. `--deactivate SYMBOL` produces the corresponding unsigned Safe removal call. Once the
Safe executes the calls, the hourly registry mirror makes the subset visible
through `GET /v1/commission/ticker`; that public response is the single candidate feed for the Family
screen and API clients.

**Family nominations are public evidence, not catalog authority.** A seated boss or underboss may place
an RHJ ticker and short rationale on the public nomination queue; each other seated family may publicly
endorse it through its own boss or underboss. The server snapshots the current discovery-feed evidence—
provider identity, canonical chain-4663 address, status, and trading capabilities—so reviewers can see
what was observed, when, without treating that observation as approval. A nomination can be rejected,
left pending, or reviewed into an unsigned Safe proposal. It never calls the registry and never appears
in `GET /v1/commission/ticker` candidates until the Safe approves an immutable version on-chain and the
worker syncs it. Nominations and endorsements cannot change open-ballot eligibility, closed/skipped
history, or pending allocations. The public queue, authorization rules, rate limit, moderation state,
evidence timestamp, Safe-review disposition, and audit history still need implementation.

Queue cadence is family-keyed, not character-keyed. The server refuses a family's second nomination
inside a rolling 168-hour window, regardless of whether its boss or underboss submitted the first. A new
nomination receives `pending_until = created_at + 30 days` and one mutable endorsement slot per seated
family. The authorized boss/underboss may cast, change, or withdraw that family slot only while the item
is pending. Safe dispositions `approved`, `rejected`, and `not_eligible` are terminal; expiry produces the
separate terminal `expired` state. None of those state changes alone activates a candidate: `approved`
becomes voteable only after the executed Safe transaction is matched and the active registry version is
seen by sync. Renomination creates a fresh id/evidence snapshot and links back to the archived item; it
never reopens or overwrites it.

Seat authority is checked at every endorsement mutation, not only when the nomination was created. A
valid nomination survives loss of seat or family dissolution until its ordinary disposition/expiry, but
the departed family cannot edit or withdraw it and cannot mutate an endorsement. Endorsements are an
append-only event history plus a derived current view: only the latest affirmative event from a family
that is seated at read/decision time contributes to `current_endorsements`. Losing a seat removes that
contribution without deleting the event. Reseating does not restore it; a newly authorized boss/underboss
must write a fresh endorsement event. This makes the public board honest about both present Commission
support and the political history that preceded it, while leaving Safe review non-binding.

Pending nominations are deduplicated by the exact deterministic `assetKey`, not ticker text. The database
enforces one pending row per key with a conditional unique constraint. A duplicate submission returns the
existing nomination id and an endorsement action; it neither inserts a nomination nor advances the
family's `last_nomination_at`. The family may attach its proposed reason to the endorsement event, but the
server does not silently endorse on redirect—the authorized boss/underboss confirms the endorsement.
Concurrent first submissions for the same key resolve to one winner and the loser receives the same
existing-item response without consuming cooldown.

Different keys sharing the same normalized ticker remain separate review objects because their address
or provider identity differs. The board groups and labels them `identity_conflict`, displays both exact
identities, and reminds reviewers that active-set uniqueness permits at most one activation. A terminal
or expired record no longer blocks a fresh nomination for that key; the new row links to the prior record
and carries a new discovery snapshot rather than mutating history.

The nomination row stores one immutable `sponsor_family_id`; that family has no endorsement slot on its
own item. Live support is derived as:

```text
(sponsor is currently seated and has current sponsor support ? 1 : 0)
+ count(latest affirmative endorsement from each other currently seated family)
```

The total is therefore bounded `0..5`, with no family counted twice. Initial valid submission creates the
sponsor's support event. Seat loss/dissolution makes that event historical and live support zero without
deleting it. If the family later regains a seat, its current boss/underboss must write a fresh
`sponsor_support_renewed` event; it cannot use the ordinary endorsement route and no automatic read-time
revival is permitted. Sponsor identity never changes, including after dissolution. The board exposes the
sponsor, whether its support is current, the current-support total and families, and the immutable support
event history.

`current_support >= 3` is a procedural trigger only. On the transition from ordinary `pending` to
`review_requested`, the server fetches and stores a new timestamped RHJ discovery snapshot and emits an
operator alert. Feed failure leaves the item pending with the failed-refresh status visible; stale or
missing evidence cannot be presented as refreshed. No registry/Safe proposal is generated by this
transition. While unclaimed, current support is recomputed from the live seats: dropping below three
clears `review_requested` back to `pending` and records the transition. An authorized operator may move
any pending or review-requested item to `under_review`; after that, support movement changes the displayed
count/history but never auto-closes or demotes the review. The default public/operator queue sort is
`current_support DESC, created_at ASC, id ASC`, with the id as deterministic final tie-break.

The constant review quorum is `3`, independent of `occupied_seat_count`. Threshold evaluation uses three
distinct family ids that are currently seated and currently support the item; rank/seat weight does not
alter the count. If only zero, one, or two families are seated, the system cannot automatically emit
`review_requested`. A newly filled seat can supply the third support and trigger the ordinary evidence
refresh/alert transition; a vacancy can clear an unclaimed request. Neither transition affects an item
already `under_review`, and the operator's explicit below-threshold claim remains the only escape hatch
from a sparsely occupied chamber.

`pending_until` is written once as `created_at + interval '30 days'` and is never mutable. Every unresolved
queue mutation checks database time under the row lock: it is permitted only while `now() < pending_until`;
at or after the deadline, expiry wins before any claim, reassignment, endorsement, progress update, or
review disposition. The expiry event snapshots the assigned operator and latest public progress note
(including an explicit no-note value) and closes the nomination with no Safe/registry/ballot side effect.
The worker makes the same transition for untouched rows, idempotently. A terminal disposition committed
before the deadline remains terminal and does not expire. For `approved`, the nomination status and the
separate Safe execution/sync state are both public: approval alone remains non-voteable, but it is not
silently converted to expiry. No operator extension field or reopen path exists.

An approval record freezes `asset_key`, `evidence_hash`, `approved_at`, and `valid_until`; the last value is
exactly seven days after approval and cannot be extended. The unsigned Safe transaction commits those
same values, and the registry activation entry point recomputes/verifies the version key, binds the
evidence hash into its lifecycle event, and reverts unless `block.timestamp <= validUntil`. An execution
mined at or before the boundary is authoritative even if the mirror observes it later. An unexecuted row
transitions idempotently to execution status `approval_stale` after the boundary while nomination status
remains `approved`; it cannot be requeued, regenerated, or assigned a new deadline. The public audit view
shows `approved_at`, `valid_until`, Safe transaction id/hash, on-chain execution block/time/hash, and sync
status independently. `StockTokenRegistry` and the current ticker-keyed proposal helper do not yet accept
or emit these fields and must be replaced before activation.

Catalog recovery is equally manual and forward-only. A provider feed returning an entry to service does
not reactivate it: the Safe must recheck the exact token address, provider identity, live status,
venue/oracle support, and exposure limits before approving the same identity again. A different address
or provider identity is a successor and needs an explicitly reviewed registry addition or migration.
Approval changes only future open ballots; it cannot alter a closed or skipped result, and it cannot move
an existing pending allocation to the successor—the corporate-action reconciliation in §3.4b owns that
value transition. Deactivated identities and every ballot result remain in the audit history.

The approved storage target is immutable and versioned. A catalog version binds one ticker, token
address, and Robinhood provider identity permanently. A Safe reactivation may only toggle that same
version. Any address or provider-identity change creates a new stable `assetKey`; the prior version stays
inactive and enumerable forever. The registry must enforce at most one active version per ticker, and a
successor transition must deactivate the old version and activate the reviewed new version atomically.
The version key is deterministic and not Safe-selectable:

```solidity
assetKey = keccak256(abi.encode(
    chainId,
    keccak256(bytes(normalizedTicker)),
    token,
    robinhoodAssetIdHash
));
```

`normalizedTicker` uses the existing validated uppercase ballot-symbol grammar. The production
`chainId` is Robinhood Chain mainnet 4663; a rehearsal deployment uses its own chain ID and therefore a
different namespace. Ticker, token, provider-id hash, and chain ID are identity fields: changing any one
creates a new version. Human-readable name and active status are not identity fields, so corrections and
deactivation/reactivation do not fork the key. The contract recomputes the key from the submitted fields
and rejects a mismatch; the Safe cannot approve an opaque alias.

Uniqueness applies to the active set, not to the permanent history. Inactive versions may reuse a ticker,
token address, or provider-id hash—for example, a ticker rename necessarily creates two historical
versions sharing address and provider identity. The registry maintains a single active owner for each
normalized ticker, token address, and provider-id hash. When the Safe activates a version, the registry
must deactivate every distinct active key referenced by those three indexes in the same transaction,
emit the corresponding lifecycle events, clear the old active indexes, and then bind all three indexes to
the activated key. If the exact key is already active, the operation is idempotent; if it is inactive, it
reactivates that permanent record rather than appending another version. The invariant must hold at the
end of every registry mutation and cannot depend on an eventual worker sync.

The current storage shape does not meet that target. `StockTokenRegistry.upsertAsset` may replace the
token and provider-id hash under a ticker-derived key; `keyForToken` and
`keyForRobinhoodAssetIdHash` assume one current owner; the Safe proposal/deactivation helpers also derive
keys from ticker; and Postgres declares `ticker` unique while updating one `stock_token_catalog` row in
place. The immutable per-day `ballotToken` snapshot correctly prevents an old ballot redirect, but before
activation the contract, proposal tooling, mirror schema, sync logic, public audit surface, and tests must
all move to permanent versions with contract-enforced active indexes for ticker, token, and provider ID.

**The default is resolution-only.** Once the publisher commits the closed day's registry key, exact
token address, and tally hash, that result never falls through to the default or another active catalog
entry. If the committed token becomes inactive, halted, or otherwise ineligible before execution,
`RwaStockBuyer` fails closed and the day records no purchase. The bounded ETH remains unspent for later
days under the existing funding and cap walls; the closed result and a public skip reason remain in the
history. Reopening or replacing the closed ballot is a separate governance decision, not keeper recovery.

**Carry-forward is pooled, never catch-up authority.** A skipped day's ETH stays inside the Stock Token
acquisition budget without expiry or a ticker-specific claim. Each later closed ballot can authorize at
most one purchase of its own exact winner, bounded independently by that execution day's daily cap; the
unused portion of an earlier cap is never added. The backlog may therefore fund later valid winners
gradually, while the skipped asset gets no preferred future purchase. Moving carried ETH between
designated acquisition addresses for an audited operational rotation may preserve the budget; moving it
to general non-RWA inventory does not. Because `RwaStockBuyer.sweepEth` does not presently encode that
destination policy, arming requires an explicit contract/runbook control rather than trust in prose.

**Epochs, not streams.** Allocation runs once per epoch (weekly) over a snapshot, because a
continuously-streamed balance is far harder to reason about, to audit, and to stop. An epoch that has
not run yet can be cancelled; a stream cannot.

### 3.1 The weight, which is the whole design

```
weight(nft) = activationMult(tier) × activityScore(owner, epoch)
```

- `activationMult` — the Stonkbrokers half. A tiered `$OMR` burn, weights 1× → ~3×. **A sink**, which
  the late-game economy wants anyway.
- `activityScore` — the half they do not have. Linear in effort, capped per account only by the
  breadth **gate** (never a cap — a cap is Sybil-*positive*, see the #29 reasoning); human and agent
  players qualify identically, while NPC residents are excluded at source.
- **A zero on either term is a zero.** An unactivated NFT earns nothing; an activated NFT owned by
  somebody who did not play earns nothing. That second one is the sentence that makes this a game
  mechanic rather than a yield product, and it should not be softened later.

### 3.2 The walls

1. **`allocated ≤ held`, PER TICKER, in units.** The game may only ever owe stock it already holds.
   This is the wall the retirement removed by holding ETH; buying stock again brings it back, and it
   must be re-denominated in units per ticker — a cash-value version silently permits owing more
   units than exist when a price moves.
2. **Never by chance.** Both weight terms are deterministic. No RNG anywhere in acquisition,
   allocation, or delivery. This is a standing project rule and it is what keeps the mechanism out of
   loot-box territory entirely.
3. **The keeper is fail-closed and TWAP-bounded** — the `OmrTwapOracle` / bond-dial discipline: a
   stale or absent price halts buying rather than defaulting to a number, and a per-buy price
   continuity bound (a generous multiple of the last print) makes a fat-finger or a leaked key unable
   to buy at an absurd rate. Anything else is a free option on the treasury.
4. **The treasury cannot be spent past what arrived.** `ethToSpend ≤ received − alreadySpent`, the
   `runVigBuyback` root cap, applied to the treasury ledger.
5. **Comps book zero.** A mod/QA path may exercise the mechanism but must record no revenue and no
   holdings — the anti-fabrication gate that already guards the Vig, the Store, bonds and the desk.
   Fabricated backing is invisible to precisely the check that is supposed to catch it.

### 3.2b DECIDED (founder, 2026-08-15) — play-weighted distribution stands; burn-to-redeem is REJECTED

The founder asked whether a simpler **burn-to-redeem** counter (burn X $OMR → X-worth of stock at an
oracle price) would beat the built play-weighted distribution, and chose to **keep the distribution**
after the trade was laid out. Recorded here so the fork is not re-litigated — this is the THIRD time
the same underlying call has been made (the stock-layer retirement rejected stock-denominated claims;
the 2026-08-10 brokers directive chose play-weighted rewards; this confirms both against the sharper
alternative). The four costs of burn-to-redeem, for the record: **(1)** a quoted price + consideration
+ a specific security delivered on demand is the shape of operating a DEALER — the sharp form of the
launch-checklist row the activation leg already carries in soft form, and a redemption counter anyone
holding $OMR can draw on surrenders the delivery control the issuer restriction requires; **(2)** it
puts an ORACLE on the player path — every lag is a free option against the treasury (the retired RWA
float's #1 flagged economics item), and it breaks the same-asset-both-sides wall that made the ETH
vault safe (owing stock priced through two markets while holding it through one), where the built
distribution has NO price on the player side at all and is structurally immune to price manipulation;
**(3)** a redemption board publishes a value-per-$OMR figure, which the standing copy rule forbids and
which changes what the TOKEN is, not just the stock rail; **(4)** it is a shop, not a loop — one-shot
wealth-shaped demand, where activation is recurring and gated on PLAY (an activated idler earns
nothing, the design's own anti-yield-product assertion). The legibility burn-to-redeem would have
bought is answered elsewhere: **the ETH vault IS the burn-to-redeem rail**, live today, in the one
asset where same-asset-both-sides holds — the two rails coexist and serve different roles. The
residual cost of the distribution (it is harder to explain than a redemption counter) is a
client/copy problem, not a mechanism problem.

### 3.3 DECIDED — stock lands in the bound account, and there is no claim gate

**Founder decision, 2026-08-10, taken after the alternatives and their costs were put in front of
them twice.** Stock accrues STRAIGHT into the NFT's ERC-6551 account, Stonkbrokers-style, and there
is no gate at delivery.

The case for it is real and was not a close call on product grounds: it is the proven model, the NFT
visibly *contains* value, delivery is atomic and trustless with no claim process, nothing sits
unclaimed in a protocol contract, and the NFT sells self-contained.

**What was argued against it and rejected — recorded so the tradeoff is not rediscovered later as a
surprise:**

1. **The NFT becomes a bearer instrument for real assets.** Any marketplace buyer acquires the stock
   with no identity verification, no eligibility gate and no check on who they are. Against the one hard operational fact here —
   Robinhood's tokenized stocks are EU-facing and restricted by the issuer — this routes them to US
   persons by default, with no off switch.
2. **It is the irreversible direction.** Claim-then-deliver could always have become bearer later;
   bearer cannot become gated, because once stock is in freely-trading TBAs it is gone. That
   asymmetry was the recommendation's whole basis.
3. **It contradicts our own entitlement wall.** `omerta-identity-nft-design.md` states *"the token is
   a tradeable trophy; the game entitlement is account-bound and never read off a balance."* That rule
   does not survive this decision, and that doc should be amended rather than left contradicting
   reality.
4. **The floor becomes a function of contents rather than utility** — the cheap end of the order book
   becomes drained NFTs and contents-vs-floor arbitrage, the same dynamic the identity-NFT design
   already flagged for the entitlement.

**The consequence that changes what gets built, and the reason it is written here rather than only in
a commit message:** with no claim gate, **`allocated <= held` is the only wall left** between the
treasury and a bad delivery. It stops being one check among several and becomes load-bearing, so it is
built FIRST, in per-ticker UNITS (a cash-value version silently permits owing more units than exist
the moment a price moves), and watched nightly by `alertDrift` rather than merely asserted in a test.

### 3.4 AMENDED — stock lands in the STREET DEED, not the identity NFT (founder-directed 2026-08-14)

§3.3 chose the ERC-6551 bound account of the **Dynasty (identity) NFT** as the container. The founder
redirected delivery to the **Street Deed** NFT: the treasury-bought tokenized stock is delivered into
the player's on-chain Street Deed's ERC-6551 token-bound account. The deed becomes a self-contained
real-estate-plus-portfolio NFT — *own the street, and the street holds your legit book; sell the
street, sell the book with it.*

**Why the deed is the better container (the redirect is a strict improvement, not a lateral move):**

1. **It fits the fiction exactly.** The mob's legit front is real estate; the deed IS the real estate.
   Stock sitting under a deed reads as "the family's holdings on that street," where stock in an
   identity PFP read as nothing in particular.
2. **The deed already IS a tradeable, self-contained asset** (Phase 3 secondary market + the
   extract/re-import lifecycle). A deed that also contains a stock portfolio is a stronger
   secondary-market object than an identity PFP; §3.3's "the NFT sells self-contained" argument lands
   harder on an NFT that was already built to be sold.
3. **The identity NFT's entitlement wall SURVIVES.** §3.3 argument 3 said the container decision
   *"does not survive"* the identity-NFT rule that "the token is a tradeable trophy; the game
   entitlement is account-bound and never read off a balance" — because stock in the identity NFT
   makes it a bearer instrument. Moving the stock to the deed removes that contradiction: the Dynasty
   NFT holds no stock, so `balanceOf` still gates nothing and the entitlement stays account-bound.
   The identity-NFT design's wall is now intact rather than amended. (`DynastyNFT.sol` already gates
   nothing on `balanceOf` — this keeps it that way.)

**The rule that follows, and the utility it creates.** A Street Deed is an on-chain ERC-721 only once
EXTRACTED (`street_deeds.onchain_token_id` non-null). So: **to RECEIVE delivered tokenized stock
on-chain, a player must own and EXTRACT a Street Deed.** An account with no deed, or an un-extracted
one, accrues its `stock_allocations` as owed and waits — nothing is lost, delivery just has no target
yet. **Founder-resolved 2026-08-24: that pending debt is permanent.** It has no expiry, inactivity
forfeiture, treasury clawback, or redistribution into a later epoch; it remains owed until the account
again has a valid extracted-deed target. This gives the deed a powerful new reason to exist (claim a
street, extract it, and it becomes your investment vault) without changing any of the wall math.

**§3.3's accepted risks (1 and 4) still apply, now on the deed, and are RE-flagged here rather than
re-discovered later:**
- **Bearer instrument (arg 1).** A deed's marketplace buyer acquires the stock inside it with no
  on-chain eligibility check — the same accepted, legal-cleared risk, now on an NFT already built to
  trade. Unchanged in kind.
- **Floor-as-contents (arg 4).** A deed's secondary price now partly reflects the stock in its TBA;
  the cheap end of the deed order book becomes drained deeds. Same dynamic §3.3 accepted.
- **Drain-before-sale.** The canonical ERC-6551 account lets the NFT owner control the TBA, so a
  seller CAN drain the stock before selling the deed. This is inherent to gateless push into any
  tradeable NFT's TBA (`omerta-identity-nft-design.md` flags the mitigations — a listing lock, or a
  voucher-gated TBA outflow — as launch-review items). On-chain, `StreetDeed.transferLocked` is the
  most any rule can do: it forces the drain BEFORE the unlock, so an unlock is the public "check the
  vault now" moment. Off-chain, the answer is disclosure — see §3.4a.

### 3.4a The vault survives the burn — and the IN-GAME market had to be told (2026-08-16)

`tokenId = keccak256(bytes(name))`, so a deed's ERC-6551 account is a function of its NAME. Burn the
NFT (`redeem`) and re-import the street, sell it **in-game**, and the buyer's next extraction resolves
the SAME vault — whatever sits in it travels with the name, while the in-game deed market priced the
street with no sight of it. The on-chain half has a listing lock; **a database row is not an ERC-721
transfer**, so nothing on that path warned anybody.

**Three fixes were ruled out before the fourth was built, and the reasons matter more than the fix:**

1. *Make the tokenId unique per extraction so the vault does not follow the name.* Worse than the gap:
   the bijection is load-bearing precisely BECAUSE it makes a burned deed's vault **recoverable**.
   Break it and every re-import orphans real stock at an address nobody can ever reach again.
2. *Refuse the re-import.* Not available — `applyDeedReimport` runs off the `Redeemed` watcher, and by
   then the burn has already happened on-chain. Refusing strands the deed in-game as well.
3. *Show a live balance on the market board.* `/v1/deeds` is polled; one RPC per listing per render is
   the shape the poll-cost pass spent a session removing.

**What shipped is DISCLOSURE** (the terms ride with the price — the pad, the nut, the Port lane):
- The **record** (`vaultHistoryFor`) on the deed card and every market listing — a pure DB read of
  `stock_deliveries`, so it costs nothing and works chain-dormant.
- Phrased **RECEIVED, never "holds"**. The game knows what was pushed IN; the owner controls the
  account and can move tokens out. A delivered total presented as a balance is a false claim on a
  purchase screen, which is strictly worse than silence. Comps are excluded (`tx_hash IS NOT NULL`) —
  counting one would fabricate exactly what that gate exists to prevent.
- The **live balance at the buy-CONFIRM step** (`vaultLiveBalances`), one RPC at the moment the money
  moves, run OUTSIDE the read transaction (an RPC inside a held txn pins a pooled connection — the
  `bankPosition` posture). Chain-dormant → the buyer is told the live figure is unavailable, never
  shown a fabricated zero: "we can't see the vault" and "the vault is empty" are different answers.
- A **warning before the burn** on the client's re-import copy: burning brings the street home, it does
  not empty the vault; move what's yours out first.

**What this changes in the build (and what it does NOT):** the `allocated ≤ held` wall (per ticker, in
units) is UNCHANGED — the delivery TARGET moving from the Dynasty TBA to the Deed TBA does not touch
what may be owed or how it is bounded. The only new surface is the DELIVERY rail (`src/stockdeliver.js`):
resolve each owed allocation to the account's extracted-deed ERC-6551 TBA and drive `StockVault.deliver`
there, idempotently, with a new `delivered ≤ allocated` nightly check so a delivery can never exceed
what was allocated. Because the `Delivered` event carries only a `deliveryId`, the rail is two-phase —
STAGE records what the keeper is about to send (deterministic `deliveryId` = keccak of
`stockdeliver:<epoch>:<account>:<TICKER>`, so a re-drive maps to the same on-chain id), and only the
`Delivered` watcher CONFIRMS it and flips the `stock_allocations.delivered` flag (a comp/simulated
stage is never confirmed — the treasury.js `txHash` gate). Built chain-dormant (the established
discipline — the day the market deploys, the rail exists), §10.4-NEUTRAL by construction (out-of-band
real value — zero `transactions` rows). One subtlety the build turns on: `chain.js:markDeedExtracted`
re-keys the extracted deed's `account_id` to `onchain:<tokenId>`, severing the account→deed link, so
the re-key also stamps `extracted_by_account` — which is what the delivery rail JOINs on to find an
account's on-chain deed.

**The same bijection is what makes an accidental burn RECOVERABLE (2026-08-16).** Because the id is
`keccak(NAME)` and nothing ever deletes a `street_deeds` row or frees its unique name, a burn FREEZES
the vault rather than emptying it — re-minting that street restores control with the contents intact.
In the ordinary case nobody acts: the re-import stays `pending` and the worker sweep retries forever.
The one case that never resolves is a burn from a wallet that will never link, and it needs no
contract change — `POST /v1/mod/deeds/recover {street}` signs a `DeedVoucher` for that street to the
TREASURY HOLDING address (`DEED_RECOVERY_ADDRESS`), bounded by four walls: a fixed destination (never
caller-supplied), a recorded burn still in the on-chain state (so it can never be a confiscation — the
contract backstops it, since `_safeMint` reverts on a live id), a 30-day wait that distinguishes
stranded from in-flight, and superseding the pending re-import so the sweep cannot later hand the
street to the burner while the treasury holds the NFT. Runbook in CHAIN-DEPLOY §8.

**Deferred, flagged (not built):** the drain-before-sale mitigation beyond the listing lock + the
disclosure in §3.4a — a voucher-gated TBA outflow is the only stronger form, and it costs the
"self-contained NFT" property the gateless push was chosen for. (The other two former deferrals are
CLOSED: the deed `Transfer` watcher re-targets delivery to a SECONDARY owner, and
`runStockDeliveryKeeper` is the real TX send.)

### 3.4b Corporate actions — the entitlement follows the property (founder-directed 2026-08-25)

The two issuers must not be confused. NVIDIA, Apple, and the other underliers issue their ordinary
shares. **Robinhood Assets (Jersey) Limited (RHJ) issues the Stock Token**, which is a tokenized debt
security providing economic exposure to the underlier. A retirement of the Stock Token is therefore
an RHJ product action even when it was triggered by an underlier merger or other corporate event.

The hot path remains simple. RHJ documents forward/reverse splits and cash/stock dividends as active
multiplier-managed actions. `uiMultiplier()` changes while the raw ERC-20 balance stays static, so
`stock_allocations.units`, `delivered_units`, and the per-token `allocated ≤ held` wall stay in raw token
units. **Do not rewrite those rows because a multiplier changed.** The on-chain oracle incorporates the
multiplier when value is displayed or priced.

Redemption, cash/stock merger, spin-off, rights distribution, unit split, and worthless removal are
currently forward-compatible API types rather than active settlement contracts. They therefore use a
rare-event, fail-closed runbook instead of code that guesses future issuer behavior:

1. At an `IN_PROGRESS` non-multiplier action or an affected asset becoming inactive, the Safe disables
   the registry entry and the per-token delivery cap. That blocks new ballots, buys, and undelivered
   pushes without deleting any debt. Already delivered tokens stay with the deed owner; OMERTÀ cannot
   and does not re-open that custody.
2. Snapshot, with block numbers, the vault's affected raw-token balance `B`, every account's outstanding
   units `u_i = units - delivered_units`, their total `U`, and any staged delivery. `U ≤ B` must hold.
   If it does not, stop as an invariant incident rather than manufacturing a settlement.
3. Wait for RHJ's action to be `COMPLETED`, then prove the actual successor property received by the
   vault from on-chain transaction hashes and balance deltas. An announcement, API rate, or keeper
   estimate is not receipt. If completion, asset identity, or receipt is ambiguous, the original
   allocations remain permanently pending.
4. Let `P` be the actual successor asset's atomic units received for the snapshotted `B`. The pending
   cohort owns `C = floor(P × U / B)`; the remainder of `P` corresponds to the vault's unallocated
   source inventory. Each pending account receives `floor(C × u_i / U)`. Allocate the remaining atomic
   dust inside `C` by largest fractional remainder, with `keccak256(account_id)` as the deterministic
   tie-break. Thus `sum(successor_i) = C` without over-allocation, and no player-backed atom leaks to
   general treasury inventory or a later epoch.
5. A Safe-approved reconciliation record binds the issuer action id/status, source and successor token
   addresses, snapshot and receipt blocks, transaction hashes, `B`, `U`, `P`, every account result, and
   the rounding proof. Only then may a successor allocation be delivered and the source allocation be
   marked reconciled. Never delete the source history. A verified completed worthless removal with zero
   actual proceeds records a zero settlement rather than fabricating value; absent that proof it waits.

This is deliberately not automated today. Automation becomes appropriate only after RHJ activates a
terminal action type, publishes its settlement semantics, and the resulting contract/schema change has
the same audit and rehearsal as the original value-moving rail.

---

## 4. What this does NOT touch

The founder's funding decision keeps every existing wall intact, and that is worth stating plainly:

- **Withdrawals are unaffected.** The Vig still funds the reserve; `extraction ≤ inflow` holds exactly
  as before. This was the alternative that would have broken it, and it was not chosen.
- **§10.4 is unaffected.** Treasury ETH and tokenized stock are out-of-band real value; they write no
  `transactions` rows, exactly like `fees.js`. The activation burn IS in-game and rides the existing
  `$OMR` sink vocabulary.
- **No new emission.** Nothing here mints `$OMR`; the activation tier only burns it.

---

## 5. Order of work

1. **The gate, before code.** §6.
2. ~~Re-denominate `runTreasuryInvariants` to per-ticker units and restore the `allocated ≤ held`
   wall.~~ **DONE.**
3. ~~The activation tiers + burn (in-game, shippable independently, a pure `$OMR` sink).~~ **DONE.**
4. ~~The epoch allocator, computing weights off `ACTIVITY` — off-chain, dormant, no delivery.~~
   **DONE.**
5. ~~The buy keeper — chain-dormant behind the standing gates.~~ **DONE** (`runStockBuyback`,
   `POST /v1/mod/treasury/keeper`). It reads `stockBudget()` for its root cap (wall 4) and writes
   through `recordStockBuy`, so wall 5 (comps book zero) and idempotency are inherited rather than
   reimplemented. **Wall 3 was its job and deliberately not step 2's:** `recordStockBuy` ingests a
   fill that already happened on-chain, and refusing to record a real fill would make the books
   disagree with the chain rather than prevent anything (the `recordBond` lesson).
   **The multiple is now sized** — `npm run keeper-dials`, recorded in BALANCE.md § THE KEEPER'S
   WALLS: **2× the last real print, 0.2× floor, halt past a 30d-old print, refuse a first buy.** The
   sizing produced a finding worth carrying into step 7: the multiple does NOT bound the damage
   (wall 4 does), and buying few units for much ETH leaves `allocated ≤ held` perfectly true — so
   this is a wall precisely because no check can see it. The first cut scaled the bound with the gap
   and had to be discarded: it reaches 26× at a quarter, and a bound that widens with staleness is
   not fail-closed.
6. The Dynasty NFT + ERC-6551 bound accounts. **The OFF-CHAIN half is DONE** — `src/portrait.js`,
   `test/portrait.js`, `GET /v1/identity/:characterId/portrait.svg` and the ERC-721-shaped metadata
   at `GET /v1/identity/:characterId`, pointing at no token. That is `omerta-identity-nft-design.md`
   §5's phase 1 + phase 2, which that doc sequences first *because they carry no gate at all* and
   because the portrait is the thing the token would point at, so the ordering costs nothing.
   **The CONTRACT half is correctly still waiting**, on two independent gates: an OPEN
   launch-checklist row (the dynasty design's §7.2 makes the contract conditional on two of them; one
   is cleared, the other re-opened when the published tranche schedule changed what it covers), and the
   third-party audit batch — which the dynasty design says to **batch, not dribble**, so writing
   `DynastyNFT` now would start that clock for one contract instead of the set.
   The build corrected three of the design's own slots; the reasons are recorded in the identity
   doc's §3 banner, and one of them was a defect that doc had already flagged and nobody had acted
   on: the frame slot cited **`dynastyTierOf`, which no longer exists** (retired with the Portfolio at
   D11). The suite now asserts it is gone, so the frame cannot be re-sourced back to a dead symbol.
7. Delivery. **Last**, and only after 1.

Steps 2–5 are done, and step 6's off-chain half with them. **THE DISTRIBUTION landed 2026-08-15**
(`brokers.js:distributeBuy`, `POST /v1/mod/treasury/distribute`) — the link steps 4 and 5 left
implicit: a REAL buy's units split pro-rata over an epoch's published weights into
`stock_allocations`, exactly once (a `distributed` latch on the buy row), every share written
through the audited `allocateStock` clamp. Two rules are load-bearing: **the frozen-weights rule**
(a buy distributes only to the latest epoch published BEFORE it — the allocator reads LIVE
activations at publish time, so a post-buy epoch could include someone who activated after seeing
the buy land, the retroactive windfall §8's no-roll-forward rule forbids; ops order is publish →
buy → distribute) and **the silent-epoch rule** (a buy with no frozen epoch, or a weightless one,
CONSUMES its latch with zero allocations — the units sit unallocated in held forever, never
tomorrow's jackpot). Dormant by construction pre-mainnet: only a real buy's units exist to split,
and comps book zero. What remains is step 6's CONTRACT half of the on-chain batch — **now written**
(`DynastyNFT.sol`, 2026-08-14, in the audit batch) — and delivery (step 7), whose backend
(`src/stockdeliver.js`: plan/stage/keeper/watcher) is also built and chain-dormant; the chain from
activation burn to a share landing in a Street Deed's TBA is code-complete end to end, gated only
on the audit + the launch review. The portrait is the clearest case for that ordering: it is the
whole player-visible half of the flagship asset, and it shipped without touching a gate.

### 5.1 What step 2 actually built, and the one thing it found

The wall is back in `src/treasury.js`, in two arms, both inside `runTreasuryInvariants` — which was
*already* wired into the worker's nightly `alertDrift`, so the new checks inherited the alarm the
moment they existed rather than needing their own.

- **`allocated ≤ held (<TICKER>, units)`, one check per ticker.** Not a summed one: stocks are not
  fungible and a delivery is made in a *specific* ticker, so a summed check would let the treasury owe
  TSLA it does not hold as long as it held enough AMZN.
- **`allocateStock` is the only writer of the owed side, and it clamps.** The invariant is the
  *detector*; the clamp is the *prevention*, and with §3.3's no-gate delivery a detector that fires
  the next night is too late — the units are already in a freely-trading bound account. The clamp
  reads-then-writes, so it is only as good as its serialization: verified against **real Postgres**
  by racing two allocations of 8 against a reserve of 10 — they came back **8 + 2**, not 8 + 8. The
  suite cannot show that (pg-mem is single-caller, so it exercises the arithmetic and Postgres
  exercises the lock), which is the same split the ETH pool lock already lives under.
- **A comp books ZERO units.** The `txHash` gate matters more here than anywhere else it appears:
  everywhere else a comp merely fails to credit revenue, but here the fabricated quantity *is the
  wall's input*, so a QA fill that booked units would raise the delivery ceiling with no asset behind
  it — invisible to precisely the check meant to catch it.

**The thing it found, which was not in the plan.** `rwa_revenue` is an *inflow* ledger: it records
what arrived and nothing about what leaves. So the moment the keeper converts treasury ETH into
stock, the Safe holds less ETH and **no existing number moves**. The ETH vault would have gone on
quoting availability out of ETH that was already spent, allocating it to players, with
`allocated ≤ held` reading green throughout. The ETH arm is therefore
`allocated + spent ≤ held (ETH)` — the spend term inside the comparison, not beside it — and
`stockBudget()` exposes the same figure as the keeper's root cap, so ETH already promised to a
player's vault line is not the keeper's to spend. Reopening the stock layer would have quietly
weakened the wall the retirement was written to strengthen.

**Two things the existing guards caught, both worth recording.** The first cut *replaced* the ETH
check with the spend-aware one, and two suites that look it up by name went red. Renaming them would
have been the cheap fix; emitting **both** is the better one, because the two ways the ETH arm can
break have different owners — `allocated ≤ held` breaching is a claim-path bug in the vault, while
`allocated + spent ≤ held` breaching *while the first holds* is an overspending keeper. One check
catches both and tells whoever is woken by the alarm nothing about which they are looking at.

The second was a `test/tokenomics.js` assertion reading `holds === 'eth'` with the words *"it does
not buy stock"* — a statement of fact from the retirement that this design reverses. A test pinning a
reversed decision protects nothing, so the fact was updated rather than defended; what was kept is
the part that still holds and still matters, which is that **the player-facing vault rail stays
denominated in ETH alone**. The treasury holding stock for this distribution never puts a player's
claim into an asset the game would have to cash-settle — that separation was the retirement's central
point and it survives intact.

---

## 6. What this reverses, and what the gate is for

The founder cleared this to be built (this session, and the standing directive in `CLAUDE.md`). This
section exists because the next reader needs the facts in one place.

**What is being reversed.** `omerta-stock-layer-retirement.md` retired stock acquisition on
2026-07-31 with recorded reasons: it deleted the project's one gated surface, removed the
verification and eligibility requirements, and stopped R2/R3 being carried milestones. This design
reopens all three.

**What a precedent does and does not establish.** StonkBrokers is doing this, visibly, at scale, on
the same chain. That is real evidence about what infrastructure exists and how it is received. **It
is not a clearance, and "they did it first" has never been a defence.** Worth saying plainly once so
nobody mistakes a citation for a green light.

**Three concrete facts that do not go away:**

1. **Handing an asset to somebody because they hold the token is the sharpest surface in the
   project**, and a launch-checklist row already covers it. Weighting by *play* rather than by
   holdings genuinely helps — effort is not passive — and the activation burn is a purchase rather
   than a payout. Neither makes the question go away.
2. **Eligibility is an operational constraint.** Robinhood's tokenized stocks are EU-facing and not
   offered everywhere, so delivery realistically needs an eligibility gate and identity verification
   at the boundary — which is exactly the machinery the retirement deleted.
3. **A bearer-instrument NFT (§3.3) is the sharpest version of all of the above**, because the asset
   then moves on a secondary marketplace with no gate at all.

**The recommendation, made once:** get the §3.3 fork and the delivery boundary onto the launch
checklist *before* step 7, not after. Everything in steps 2–6 can be built, tested and merged
meanwhile without a single share changing hands, which is why the order of work is arranged that way.

---

## Sources

- [StonkBrokers](https://stonkbrokers.io/)
- [What are StonkBrokers NFTs — Airdrop Alert](https://airdropalert.com/blogs/what-are-stonkbrokers-nfts-robinhood/)
- [NFTs turning into stock tokens? What exactly is StonkBrokers? — Odaily](https://www.odaily.news/en/post/5212003)
- [Robinhood Chain NFTs see surge in activity — KuCoin](https://www.kucoin.com/news/flash/robinhood-chain-nfts-surge-in-activity-seven-projects-hit-1500-eth-in-trading-volume)
