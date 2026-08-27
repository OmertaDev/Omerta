# THE STOCK MACHINE — tax → daily Commission-voted stock buy → gas-paid claims

> **2026-08-24 implementation note.** This design predates the deployed-shape decisions now recorded
> in `omerta-brokers-design.md` and the in-game Codex (`docs/WIKI.md`). The current machine uses the
> Safe-owned `StockTokenRegistry`, closed-day ballot commitments, `RwaStockBuyer`, automatic
> human-only activity epochs, and EIP-712-authorized `StockVault` delivery. Any older passage below
> proposing a free-form ticker map, a player claim voucher, a static candidate list, or a gateless
> keeper-only delivery is historical analysis rather than the implementation contract. The founder's
> current recipient posture is also explicit: OMERTÀ performs no KYC or compliance screening in the
> game or delivery worker; older eligibility-allowlist proposals below are rejected historical options,
> not unimplemented requirements. This posture is not represented as outside legal approval.
> The current closed-ballot rule is equally exact: a tie, silence, or pre-close removal may resolve to
> the active default, but if the committed winner becomes inactive, halted, or otherwise ineligible
> before purchase, the day skips and bounded ETH carries forward. The keeper cannot substitute another
> token; the closed result and public skip reason remain in history.
> Before close, removal instead invalidates only that candidate's votes: they stop counting, affected
> families may recast until the unchanged cutoff, and the ballot never restarts or extends. Unrecast
> invalid votes are ignored before the remaining active tally applies its ordinary tie/silence default.
> ETH from a skipped purchase remains one non-expiring, general Stock Token acquisition backlog. It is
> not earmarked for the skipped token and remains pooled by ordinary operation; future valid winners consume
> it gradually through independent daily caps, never a stacked cap or catch-up batch. The later founder
> override explicitly gives the designated `mainOperator` unilateral authority to move any/all pool ETH to
> any address/purpose.
> Catalog lifecycle is forward-only. Robinhood API changes never reactivate or replace an approved entry;
> a restored exact identity requires a fresh Safe review, while a changed address/provider identity needs
> a Safe-reviewed immutable version with a new asset key. The prior version stays inactive/enumerable
> forever, and at most one version of a ticker may be active. Those decisions affect only future open ballots, never
> repair or replay closed/skipped results, and cannot redirect pending allocations outside the separate
> corporate-action reconciliation. Historical identities and ballot outcomes remain inspectable. The
> ticker-keyed registry, proposal helpers, and current-state mirror still permit or assume in-place identity
> overwrite, so implementing permanent version keys and active-ticker uniqueness remains a launch gate.
> Each version key is deterministic:
> `keccak256(abi.encode(chainId, keccak256(bytes(normalizedTicker)), token, robinhoodAssetIdHash))`.
> Chain, uppercase ticker, exact token, and RHJ provider identity are key material; changing any creates a
> new version, while a display-name correction or active-status toggle keeps the same version. The
> contract must recompute the key and reject an opaque or mismatched Safe-supplied value.
> Inactive historical versions may repeat ticker, token, or provider ID; the active set may not. At most
> one active version owns each of those three fields. Activating a version atomically deactivates every
> active conflict, while exact-version reactivation toggles the permanent record without appending a
> duplicate. This is a registry invariant, not an off-chain Safe/mirror convention.
> If the active set reaches zero, the production catalog has no candidates and no default. Casts fail,
> rollover durably records public `catalog_empty`, no winner is published or purchased, and the ETH remains
> pooled acquisition capital. SPY/static fallback never returns. Explicit Safe recovery affects only
> future open ballots; the empty days are permanent skipped history. The current transient `no_tickers`
> return does not yet satisfy that status/history requirement.
> A public, non-binding family nomination queue sits before Safe review. A currently seated boss or
> underboss may submit an RHJ ticker and rationale; other seated families may publicly endorse it, while
> the server attaches timestamped Robinhood discovery data only as evidence. Neither action changes the
> registry or ballot. Safe execution plus sync remains the sole promotion path. Rate limiting is required;
> the cadence/expiry rule is fixed below, while the queue/table/routes do not exist yet.
> Cadence is now fixed: one nomination per seated family per rolling seven days, pending for at most 30
> days, with one reversible endorsement per seated family. Safe `approved`, `rejected`, or `not_eligible`
> closes early; expiry archives only. Approval requires later Safe execution plus registry sync before the
> candidate is voteable. Renomination after cooldown creates a fresh linked record/evidence snapshot and
> never reopens history. A valid nomination survives seat loss or family dissolution, while the departed
> family immediately loses write authority. Its endorsement remains historical but stops counting as
> current seated support. Reseating requires a fresh boss/underboss endorsement; new seats may endorse
> pending items. The board separates live support from immutable endorsement history, neither Safe-binding.
> The queue permits one pending item per deterministic version key citywide. Duplicate submissions return
> the existing item and an explicit endorsement path without consuming the family's weekly nomination
> allowance. Same-ticker/different-key identities may coexist but are publicly grouped as conflicts, since
> only one version may become active. A terminal item permits a fresh linked nomination/evidence snapshot.
> Pending-key uniqueness and cooldown preservation must survive concurrent submissions.
> The submitting family is the immutable sole sponsor and cannot self-endorse. A seated sponsor with
> current support counts once; each other seated family may endorse once, making live support `0..5` with
> no double count. Seat loss/dissolution leaves sponsor history and removes current support. Reseating
> requires an explicit boss/underboss sponsor renewal, never automatic revival or a second endorsement.
> Three current supporting families mark `review_requested`, refresh timestamped RHJ evidence, and alert
> operators without producing Safe calldata or binding approval. Falling below three before claim returns
> to `pending`; once an operator claims `under_review`, support churn stays visible but cannot cancel it.
> Operators may claim below threshold. Queue order is support descending, then oldest, then stable id.
> The automatic quorum is a constant three distinct currently seated families, never a majority of
> occupied seats and never rank-weighted. With fewer than three seated families, only manual operator
> claim can start review. Seat fill/vacancy recomputes support without changing the quorum or cancelling
> an already claimed review.
> The original 30-day `pending_until` is immutable across all unresolved states, including `under_review`.
> Claims, reassignment, refreshes, and updates never extend it; unresolved work expires at the deadline,
> preserving reviewer/note history and requiring a fresh linked nomination to continue. Terminal Safe
> dispositions do not expire. Approved-but-unexecuted work remains separately visible and non-voteable.
> Approved Safe activation calldata binds the deterministic version key plus final evidence hash and
> expires exactly seven days after `approved_at`; the registry enforces the deadline. Mining before the
> boundary survives later sync. Missing it leaves terminal nomination status `approved` but execution
> status `approval_stale`, with no extension/regeneration from the old review. Fresh nomination, evidence,
> and Safe review are required. Current registry/tooling lacks this binding and remains launch-blocked.
> Until execution, an off-chain watcher rechecks the bound RHJ identity/status and venue/oracle/exposure
> prerequisites. Material drift becomes public `evidence_drift`, alerts Safe owners, and blocks first-party
> tooling, but grants no feed or watcher on-chain authority and cannot revoke signed calldata; residual
> executability stays visible until cancellation/expiry, and deliberate Safe execution is a governance
> failure. Activation itself is one reverting-together registry transaction that deactivates every active
> ticker/token/provider conflict, creates/selects the exact immutable version, and activates it. Only the
> finalized, canonical, synchronized activation state `synced_active` is voteable—not Safe submission,
> mining, a receipt, or optimistic indexing. On-time inclusion survives later finality/sync; a pre-finality
> reorg fails closed and invokes the existing open-ballot deactivation/recast rule.
> One authenticated authorized RWA reviewer alone may terminally set `approved`, `rejected`, or
> `not_eligible`; the immutable record binds reviewer, rationale, evidence, hash, and status. Approval sets
> `approved_at` and starts the TTL, but remains unable to bypass Safe execution/finality/sync. Monitoring
> continues after activation: verified drift sets `operational_quarantine`, while an unverifiable critical
> predicate sets `health_unknown`; either blocks ballots/votes, purchases, and automatic delivery without
> touching ownership or permanent allocations. Open ballots recast and unpurchased closed winners skip with
> ETH pooled. The watcher has no registry/transfer authority. If the version remains on-chain active,
> clearance requires fresh resolving evidence, one reviewer, a fresh TTL-bound Safe clearance action,
> finality, and sync but no nomination. If Safe-deactivated, full fresh linked nomination/support/evidence/
> review/Safe/finality/sync is required; no support carries over, the same immutable version reactivates
> without duplication, and all prior lifecycle history remains linked.
> Quarantine entry is automatic for deterministic verified drift/unverifiable critical health and may also
> be imposed by one authorized reviewer; it records stable reason/evidence/actor/time, needs no Safe to halt,
> denies families/agents/clients, and is idempotent without resetting original time. Each `synced_active`
> version is checked at least every five minutes and synchronously before ballot snapshot, purchase,
> delivery batch, or clearance; health older than ten minutes is `health_unknown`. Failures fail closed, the
> ceilings cannot be loosened by ordinary production config, and public freshness fields expose no secrets.
> Quarantine known before purchase broadcast skips and pools ETH. The worker first atomically records all
> decision snapshots and intent. Quarantine after broadcast sets `purchase_at_risk` and permits only
> best-effort safe same-nonce cancellation, never a substitute. Cancellation/revert skips; canonical
> finalization preserves the trade and cohort allocations while pausing delivery, with no unwind, rebuy, or
> catch-up. Unprovable chronology is `ordering_uncertain`: preserve canonical ledger/assets, pause delivery,
> and require review.
> After a finalized/synced clearance plus fresh health check, paused delivery resumes FIFO by original
> creation time/stable id with exact asset/cohort/amount/priority preserved. Idempotent stage-then-confirm
> releases unbroadcast work if quarantine returns, follows canonical broadcast outcome, and never grants
> delay compensation. Permanently frozen/non-transferable/irrecoverable/unsupported tokens set
> `delivery_impossible_pending_resolution`: allocations never expire/change cohort and can resolve only pro
> rata from actual exact-holding recovery under one reviewer + Safe + finality/sync + public conservation,
> never unrelated tokens or treasury/game/synthetic value. Zero recovery stays visibly unresolved. Automatic
> deed-TBA delivery remains default, but users may set reversible global/per-version `delivery_hold` without
> economic benefit or forfeiture. It is checked before stage/broadcast; unbroadcast work releases, broadcast
> outcome stands, toggling cannot starve, and death/inactivity/logout/indefinite hold never erase the claim.
> Unbound claims are account-beneficial `awaiting_deed`. Exactly one finalized/owned/derivable deed
> auto-selects as `rwa_delivery_deed`; multiple require explicit selection. Establishment binds every unbound
> and future allocation whole to exact chain/deed/token/TBA; primary changes affect only unbound/future and
> selection itself moves nothing. Bound pending rights and holds follow finalized deed transfer with TBA
> holdings; activity/cohort history is not re-scored, holds persist under the new owner's control, destination
> stays the same, and the public deed view discloses attached state before sale. No individual—including Safe,
> reviewer, admin, or user—may redirect a bound beneficiary. Only deterministic one-to-one protocol-wide
> defect/chain migration may remap it while preserving owner/all fields/history under exact Safe calldata,
> public mapping/conservation, finality, and sync; individual rescue is forbidden and delivery otherwise pauses.
> Automatic delivery gas comes by default from separately accounted RWA operations ETH, never as an automatic
> deduction from user allocations, holdings, pooled acquisition ETH, reserves, or game balances; no extra
> post-extraction user fee applies. The separate `mainOperator` may explicitly move pool ETH into gas or any
> other destination as public `operator_outflow`.
> Safe fee ceilings pause as `delivery_gas_unfunded`/`delivery_gas_above_ceiling` without priority loss, token
> skimming, or hidden accounting. Token amounts are bounded/cached actual-decimal integer atomic units. Daily
> cohort floors are completed by largest fractional remainder, stable immutable account-id ties, exact sum
> conservation, public `qualified_rounded_zero`, no cross-cohort fraction carry, and no positive-unit value
> cutoff. Same deed/version rows may aggregate without losing history. Bounded delivery transactions isolate
> immutable-id deed/version items: recipient failure cannot undo unrelated success; finality confirms success,
> failure increments nothing and links retry, while token-wide/inventory/conservation faults halt the version.
> Delivered <= allocated and staged + delivered <= held survive retries, duplicate logs, reorgs, and restarts;
> batch caps cannot change FIFO, permanently skip recipients, or favor large allocations.
> Acquired units come only from a canonically finalized, exact-token-serialized custody delta
> `postPurchaseBalance - prePurchaseBalance`, with quote/router/venue/events as evidence. Positive delta alone
> freezes allocation; mismatch is public `acquisition_amount_mismatch`. Non-standard balance tokens default
> ineligible and need new version, custom Safe adapter, fresh nomination/review, and conservation tests. Daily
> cap covers ballot trade input and input fees, not separate gas; allocate all net received units with no skim,
> return unconsumed/refunded ETH to the acquisition pool, accept only in-bound slippage, and publicly reconcile
> input/consumption/refund/units/prices/deviation/venue/gas. Each ballot fixes `purchaseUntil = closed_at + 2
> hours` with on-chain timestamp enforcement and no extensions. One logical intent may retry before expiry but
> only one canonical success; any positive minOut/bounds-valid partial is final without top-up. Otherwise
> `purchase_window_missed` skips forever, late inclusion reverts, and all attempts stay linked/public.
> Venue/router/pool cannot self-reference price. Each exact version needs >=1 independently governed
> Safe-approved source; normalized multiple sources use median. Snapshots bind identity/price/decimals/quote/
> time/round/evidence and expire after five minutes. Safe per-version deviation is capped by contract at 500
> bps (5%); buyer enforces minOut plus reference deviation/direction/decimals with no venue/prior/operator/cache
> fallback. Daily ballots persist through closures, but purchase requires live health/venue/fresh oracle/all
> gates inside two hours; otherwise `market_unavailable` pools ETH with vote preserved, no extension/catch-up.
> Genuine off-hours trading is evidence-based. Buyer calls only Safe-approved adapter address+code hash, no
> arbitrary call/delegatecall, binding chain/ballot/intent/asset/token/vault/input/minOut/oracle/deviation/both
> deadlines. No output/residual/approval diversion. Private route is preferred, public allowed under on-chain
> walls. Retry may refresh and lower input but not exceed authority or widen limits. Code/proxy/hash change
> needs fresh Safe security approval; asset version changes only with identity. Full attempts remain public.
> Acquisition ETH defaults to separately bucketed `RwaAcquisitionVault` custody and exact buyer intents, but
> the one public `mainOperator` may unilaterally move any available/unattributed/reserved ETH to any address/
> purpose without Safe/caps/timelock, cancelling impacted intents and emitting fully reconciled
> `operator_outflow`; no Stock Token/allocation rewrite is allowed. This is an explicit sweep trust assumption.
> Exactly one current operator (or zero/disabled) and any pending nominee/48-hour acceptance clock are public;
> Safe zero-disable atomically cancels pending nomination, bumps generation, and invalidates signed outflows;
> even same-address re-enable needs fresh nomination/48 hours/nominee acceptance. Nomination expires seven days
> after becoming acceptable. Separately, active operator may directly replace itself immediately with a nonzero,
> different successor who supplies same-transaction EIP-712 EOA/ERC-1271 consent bound to non-future `issuedAt`
> through a maximum one-hour deadline; no Safe/delay/relay is involved, pending
> Safe nomination clears, generation invalidates old signatures, global outflow nonce persists, old authority
> ends immediately, and Safe may still zero. Smart-wallet authority follows its address, not pinned code/owners/
> modules/implementation; changes/unknown health are public informational warnings only, each action validates
> current on-chain behavior, relay fails closed only on failed validation, and Safe zero/restoration recovers an
> unusable wallet. Watch at least every five minutes, stale after ten, synchronously attempt refresh before server
> construction/relay, but never make watcher failure a veto or direct chain dependency. Every replacement/
> renunciation/Safe-zero/nomination/cancellation/acceptance binds and emits the closed public reason code plus
> nonzero details hash; missing explanation text never blocks or rewrites it. Forced/mistaken/unexplained ETH is
> unattributed and buyer-ineligible until public Safe reclassification, permissionless sync only books surplus,
> operator may still withdraw it, and negative drift pauses. Each reservation has one immutable deadline:
> execution is strictly before it, permissionless idempotent expiry releases all to available, and no revive/
> extension/substitute/catch-up exists. Each ballot/exact asset version has one permanent deterministic
> `intentId = keccak256(abi.encode(chainId, vault, ballotId, assetVersionKey))`; attempts are monotonic and
> serialized with one live at a time, and no parallel/split/second-success/terminal recreation exists. Only current
> Safe-approved `RwaStockBuyer` creates atomically after every ballot/asset/health/deficit/balance/cap/adapter/code/
> oracle/deviation/deadline wall; failure consumes no intent/tombstone/reservation/bucket/attempt/sequence and may
> retry before unchanged deadline. `executeIntent(intentId)` is permissionless but fully bound, revalidates every
> wall, routes Stock Tokens/ETH only to their vaults, pays caller nothing, and first canonical success wins under
> atomic reentrancy protection. Safe or current main operator may explicitly `cancelIntent` with closed reason and
> nonzero details, no ETH transfer, terminal full reservation release, next accounting sequence, and no revival/
> rewrite/catch-up; canonical inclusion order resolves every execution/expiry/refund/outflow race.
> Pre-adapter validation failures consume no nonce/record/accounting. Once the approved adapter is invoked, the
> next `attemptNonce` is consumed and its immutable public result cannot be overwritten: revert/false/zero output
> is retryable `attempt_failed` only when canonical vault/custody deltas prove zero ETH debit and zero Stock Token
> output; any unexplained debit/refund/token/custody delta is `attempt_reconciliation` and blocks new execution or
> final settlement until an explicit public reconciliation accounts for it. Only Safe finalizes reconciliation,
> classifies value, releases quarantine, or declares resolution; current main operator may append evidence/proposed
> disposition but cannot mutate buckets/state/sequence or self-authorize finality. Safe reconciliation publishes
> actual ETH debit, cumulative verified refund, Stock Token custody delta, canonical transaction provenance,
> disposition, and full pre/post balance/buckets/deficit/intent state, consuming the next `accountingSequence`.
> Any positive valid custody delta is the final fill at actual units with no top-up/second fill/substitute/catch-up.
> Cancellation or deadline while reconciliation is pending ends execution immediately, releases only proven
> unaffected value, and moves the unresolved portion to nonspendable `reconciliation_pending` until Safe resolution;
> later proven-unspent value becomes available without revival/replacement. Contract-derived bounds from immutable
> pre-attempt snapshots, current canonical acquisition/StockVault balances, and recorded canonical refunds/provenance
> cap all debit/refund/output figures; Safe chooses disposition/evidence but cannot override observed value, and an
> inconsistency reverts before mutation. `reconciliation_pending` has no timeout, abandonment, presumed outcome, or
> automatic release: signer recovery provides liveness and accounting never guesses. Current main operator retains
> raw outflow authority over actual quarantine ETH under the explicit sweep trust model, but the transfer cannot
> finalize/classify/release/erase the unresolved liability; it publicly debits backed quarantine, consumes normal
> outflow nonce plus `accountingSequence`, and records any resulting shortfall as explicit accounting deficit under
> the existing pause/repair rules. Operator outflow follows the contract-fixed available → unattributed → ordinary
> reserved → `reconciliation_pending` order with no caller bucket choice; quarantine is last. Each attempt and the
> aggregate expose `reconciliationLiability = backedQuarantineEth + reconciliationShortfall`; any positive shortfall
> joins vault-wide `accountingDeficit` and pauses new intent creation/execution while recovery remains live. A
> quarantine debit is assigned greatest backing first, then oldest `reconciliationStartedAt`, then lowest intent ID,
> fully exhausting records before one partial. Generic canonical repair uses one unified oldest-created deficit queue,
> then numeric component type and record ID, while an exact late refund repairs its own attempt first. Contract-owned
> bounded priority indexes preserve both orders; caller ordering/proofs and unbounded history scans are forbidden. Safe
> may finalize factual underfunded reconciliation, but
> proven-unspent absent ETH becomes durable terminal `reconciled_shortfall`, creates no available ETH, and closes the
> intent forever. When real repair ETH later reaches that finalized proven-unspent shortfall, the same entry retires
> exact repaired liability and credits exactly that principal to available with no second Safe action, interest,
> penalty, opportunity-cost compensation, damages, yield, or reopening; unresolved reconciliation repair restores backing only. A late exact canonical
> refund repairs its own attempt shortfall before any remainder becomes
> available; above-proven-debit excess is unattributed, with append-only history and no reopening/edit/catch-up. Late
> Stock Tokens enter exact-token/version/provenance `unattributed_stock` quarantine. Safe may only hold, transfer the
> exact token to a fixed Safe-approved recovery vault, or redeem/liquidate it through an approved exact-token adapter;
> no arbitrary recipient/retroallocation/substitution/reopening exists. Quarantined units are excluded from
> distributable/player/fulfilled totals but included in gross custody, concentration risk, and exact-version caps.
> Recovery ETH repairs the exact originating attempt shortfall first and sends remainder to `unattributed`, never
> automatic availability/cohort allocation/reopening. One active recovery vault is exact chain/address/code/proxy-
> implementation pinned; Safe rotation is public 48-hour delayed and atomic, with continued quarantine as emergency
> fallback. Each exact-address/code adapter binds one exact input version to canonical ETH using fresh independent price,
> `minEthOut`, slippage ceiling, deadline, and fixed route; no arbitrary calldata/path/delegatecall/persistent approval.
> Success requires atomic canonical ETH at the acquisition vault; unexpected ERC-20 output receives no recovery credit
> and is quarantined. Quarantined exposure uses the greater of fresh independent market value and last valid acquisition
> price; no usable value blocks new exact-version purchases. Any
> recovery tranche has a unique domain-separated immutable `recoveryId` binding chain/vault/code/proxy identity,
> incident/quarantine provenance, exact Stock Token version and input units, adapter/code, acquisition-vault destination,
> oracle observation, `minEthOut`, slippage, route, Safe generation/nonce, issue time, and deadline. Only Safe creates,
> activates, cancels, or replaces it. It expires at the earlier of one hour after approval and oracle validity; any
> change/refresh requires a new one-use ID. Execution rechecks pinned identities and applies the stricter of authorized
> and fresh execution-time oracle floors. Partial recovery is monotonic through separately authorized exact tranches,
> never exceeds `remainingUnits`, and resolves only at zero. Neither Safe nor operator has an arbitrary Stock Token
> sweep. Use direct transfer where possible; any necessary exact-unit allowance is created, consumed, and zeroed in the
> same transaction. Anyone may execute an authorized ID with no payload, discretion, reward, refund, caller output, or
> protocol-paid gas; recovery credit never pays gas.
> Permissionless execution cannot create/enqueue records and is constant-time, positive-unit, active/unexpired/
> uncancelled/unconsumed, code-identity-checked, exact-balance-delta, checked-arithmetic, `nonReentrant`, and
> checks-effects-interactions with atomic rollback. It has no attacker-sized loop/scan/dynamic route/callback/payment.
> Invalid, duplicate, expired, cancelled, losing-race, or reverted calls create no canonical write/event/alert/storage
> growth and cost only the caller; an identical-ID front-run can perform only the approved action. Fresh `minEthOut`,
> slippage, short expiry, fixed route, and preferably MEV-protected submission bound sandwich loss. Nonstandard tokens
> need a separately pinned adapter plus adversarial balance-delta tests or remain quarantined without blocking other
> versions. Safe/current main operator may pause recovery immediately; only Safe resumes, with no redirect, consumption,
> deadline change, or credit. Public recovery/incident data exposes structured canonical facts and content hashes, not
> restricted evidence bytes; provisional and finalized streams are separate and finalized is default. History is
> permanent with checksum-addressed cursor exports. Anonymous access is read-only and cursor/page/body bounded, indexed,
> quota-limited, cached, and precomputed so invalid/replayed/transport spam cannot scan, write, alert, regenerate exports,
> or amplify incidents; sampled infrastructure metrics are separate and retention-bounded. Quarantine-and-hold is the
> complete default; recovery is optional, deferred until real material quarantined stock exists, and is not an ordinary
> RWA-launch blocker. If later activated, recovery stays unavailable and UI mutations disabled until the exact production
> vault/adapter/oracle/API bytecode and manifest pass unit,
> stateful fuzz/invariant, malicious-component/reentrancy, forked MEV/slippage/reorg, and API auth/concurrency/body/cursor/
> export/load/DoS tests plus independent third-party source/bytecode review; critical/high findings must be fixed and
> every remainder publicly dispositioned. The manifest pins chain/addresses/compiler/source/code/implementation/
> adapter/oracle/test/audit hashes, and any material code or write-route change resets the gate. No placeholder generic
> executor or recovery write route may ship from documentation alone. Safe authorization then records on-chain. Proxies
> remain allowed—no non-upgradeable mandate—but proxy/implementation identities stay pinned. Safe-set per-tranche,
> per-version rolling-24-hour, and global rolling-24-hour recovery caps have no operator Stock Token bypass while leaving
> post-receipt operator ETH authority intact. Two fresh independent prices use the conservative floor and fail above
> 500-bps divergence. V1 accepts conventional balance-delta ERC-20s only; adapters finish with zero attributable residue
> and allowance, and forced dust receives no credit. APIs return unsigned calldata without gas sponsorship; canonical
> history comes only from finalized pinned-contract events. Failed/duplicate/malformed spam may be throttled/alerted but
> never auto-pauses, opens an incident, or writes canonical history. Activation also needs a bounty/disclosure channel,
> independent code/balance/allowance/oracle/rate/sequence monitoring, and a rehearsed pause/cancel/rotation runbook.
> Ordinary RWA funding has no automatic prior-day-revenue percentage, mandatory acquisition-vault ETH reserve, or
> policy minimum purchase size. One exact backed maximum ETH budget is published and atomically frozen before the ballot
> opens and cannot change after voting starts; ordinary balance, venue, cap, quote, and execution walls still apply. The
> MVP buys only the Safe-approved provider-native spot Stock Token and does not sell, rebalance, rotate, or market-time
> allocated holdings outside mandatory delivery, corporate-action, provider-retirement, legal, or worthless-removal
> handling. Financial engineering is not permanently prohibited but none is authorized for the MVP. Verified OMR
> staking may later multiply active-play allocation. Qualification remains active play by a human or agent account plus recurring Broker
> activation, and the chosen formula is `activationMult × activityScore × stakeMult`. `stakeMult` uses fixed public tiers
> from finalized time-weighted-average eligible principal across the full seven-day epoch, with no separate 72-hour
> maturity delay. One verified allocation wallet is bound per account/epoch and changes next epoch. Liquid OMR,
> pending or claimed-but-not-restaked rewards, and activation spend do not count. The 2× ceiling was rejected; the
> approved replacement is capped at 1.50× with exact 300/1,000/5,000/20,000 OMR thresholds. Database-only game stake will not remain an alternative:
> `/v1/stake`, Made Ladder/commitment/access reads, gameplay loss, unbonding, inheritance, reporting, and RWA weighting
> must all use one actual on-chain OMR gameplay position. The database becomes only a finalized mirror/pending-settlement
> journal. The current `OMRStaking` contract cannot supply that lifecycle because principal is immediately user-
> withdrawable and it has no constrained gameplay loss, commitment lock, unbonding, account binding, or user history.
> The approved replacement is a new `OMRGameplayVault`, not a retrofit: it pays no personal APY; game-earned OMR must
> first become exact reserve-backed on-chain OMR, with an optional non-double-crediting atomic claim-and-stake path; and
> it enforces `deposit_pending -> active -> committed | unbonding -> withdrawable -> withdrawn`, commitment locks, and
> six-hour unbonding. A Safe-pausable/rotatable typed gameplay-settlement signer has no sweep power. One-use EIP-712
> outcomes bind chain, vault, signer generation, immutable event, accounts/wallets, source bucket, amount/rate ceiling,
> victim nonce, issue time, and deadline. Loot reassigns actual victim principal to the killer's on-chain idle gameplay
> balance. Settlement finalizes on-chain before irreversible game resource/result commitment and fails closed when the
> chain, vault, signer-authorization service, or finalized mirror is unavailable or stale. Legacy rows import only against deposited
> reserve backing; no migration mint is allowed and any difference remains an explicit published liability. No arbitrary
> owner sweep may substitute for these controls. Until this vault and a finalized anti-flash snapshot are
> implemented, the shipped formula remains
> `activationMult × activityScore`; current balances do not count retroactively.
> Agent accounts and their verified EOA or ERC-1271 controller wallets have full economic parity throughout this rail:
> deposit, stake, commitment, partial unbonding, withdrawal, inheritance continuity, receiving idle gameplay loot,
> losing eligible principal to canonical settlement, finalized Broker stake TWA, Stock Token allocation, and delivery.
> `agent_flag` may gate human-only faucets/status but never vault authorization, gameplay settlement, checkpoints,
> Broker weight, RWA allocation, or delivery. All ordinary activity, activation, uniqueness, consent, exposure,
> finality, solvency, and launch gates remain unchanged.
> Only the verified controller wallet or exact claim-and-stake rail may fund an account position; bypass transfers are
> unattributed and qualify nobody. Positions bind permanent game account ID plus one controller wallet and survive death/
> respawn without resetting history; recovery rotates control without moving principal. Deposit/commitment accepts an
> immutable risk-ruleset version. The vault—not signer—computes debits under 20% active/committed and 50% idle/unbonding
> ceilings; Safe may lower/pause, while increases/new loss classes require a new public version and fresh consent.
> Value-taking settlement is `prepared -> submitted -> finalized -> game_committed`, reserves event ID/victim nonce,
> moves the lesser of calculated loss and execution-time eligible balance, and uses the finalized event as the only
> exactly-once crash-recovery authority. Every economic/controller transition checkpoints on-chain for finalized Made
> Ladder and RWA history. Independent pauses keep ordinary exits open unless a separately declared custody-integrity
> incident suspends withdrawals. The founder rejected non-upgradeable/migration-only custody: the gameplay vault will be
> upgradeable, making proxy implementation/admin an explicit trust boundary. It uses an OpenZeppelin Transparent Proxy
> and dedicated `ProxyAdmin` owned by a non-upgradeable `GameplayVaultUpgradeGovernor`; only the Safe may propose, cancel,
> or execute, and no operator/signer/relayer/server/EOA/implementation has upgrade authority. Implementation and governor-
> control changes bind an exact chain/proxy/current+new implementation/code-hash/version/init-calldata/storage-layout/
> reason/audit/timing package and wait at least 48 hours. Emergency response is pause-only, never a hot-upgrade bypass.
> Implementations disable initializers; proxy initialization is once, and a reinitializer is only the committed one-use
> `upgradeAndCall`. Atomic validation covers pinned OMR, balance/liabilities, ruleset, nonce, pauses, bindings, and version;
> failure reverts, while audit, layout comparison, and fork rehearsal remain necessary against malicious code. Rollback
> is a normal delayed upgrade. Material risk changes require a new ruleset/fresh consent and preserve the old exit for
> nonconsenting principal. Public code/admin/governor/timelock drift stays red and disables deposits/commitments while
> exits remain under their separate pause. No claim of technical immutability may hide this upgrade power.
> Ordinary controller rotation requires current-wallet release plus new-wallet acceptance bound to account/chain/vault/
> generation/nonce/controllers/time. Lost-wallet fallback requires authenticated permanent-account control, new-wallet
> proof, a public seven-day clock, all-channel notice, current-controller contest, and Safe-only evidence resolution with
> no clock acceleration or individual-operator choice. Pending/contested recovery freezes withdrawal/deposit/commitment/
> controller changes but not existing locks, unbond clocks, gameplay exposure, or valid loss settlement. Finalization
> increments controller generation, invalidates unfinalized old-generation authorizations without nonce reset, abandons
> provisional gameplay safely, and preserves finalized history. EOA and ERC-1271 controllers are supported fail-closed.
> Withdrawals are direct server-independent controller pulls to that controller only. Stake/unbond/withdraw are partial,
> amount-specific operations; each unstake creates a separate amount/start/six-hour-unlock/ruleset/exposure tranche that
> later requests cannot rewrite. Gameplay loss consumes eligible unbonding tranches by earliest unlock time, ties by
> lowest immutable tranche ID, and exhausts each before the next. An account may have at most 16 live unbonding tranches;
> matured tranches do not count, and over-cap unstake reverts before mutation. Partial unstake is at least `0.01 OMR`,
> except exact full remaining eligible stake may always exit. Matured tranches aggregate into one withdrawable balance
> without erasing immutable tranche events or checkpoints. The vault pins exact OMR, uses
> `SafeERC20`, credits only verified balance delta, and rejects/quarantines fee/rebase/hook/result mismatch. Bypass transfers
> are unattributed and qualify nobody. Solvent unattributed OMR is nonspendable; only the Safe may move exact verified
> surplus after a public 48-hour proposal to one fixed OMR recovery-treasury address, never to an account, arbitrary
> recipient, settlement, operator, or signer. Permissionless exact-receipt `fundDeficit` repairs deficit first with no
> player credit and classifies excess as unattributed. `actual OMR balance >= total accounted liabilities`; any positive
> deficit automatically pauses withdrawals plus deposits/commitments/gameplay debits, preserves every liability in full
> without haircut or write-off, and creates a new immutable incident generation. Finalized canonical zero plus continuous
> mirror sync automatically clears only deficit-specific pauses. Every value-changing entrypoint checks solvency before
> and after; permissionless solvency/unattributed sync and public balance/liability/finality/sequence monitoring keep a
> database, operator, or acknowledgment from hiding or manually closing drift.
> Gameplay loss uses each bucket's execution-time pre-settlement balance, contract-calculated under signed ceilings, and
> rounds down to OMR atomic units; a legitimate zero still finalizes. Multi-bucket loss is one atomic transaction with
> independent bucket calculation, approved unbonding order, one combined killer credit, and full revert on any invariant
> failure. Loot lands in the killer's idle on-chain gameplay balance, remains idle-rate exposed, and neither auto-commits
> nor contributes to the Broker stake TWA until separately authorized. Settlement authorization rejects future issue time,
> expires if not included within five minutes, and may finalize later once timely included. `prepared` remains an expiring
> off-chain nonlocking journal entry. Each outcome binds a unique immutable event ID plus the victim's exact next nonce;
> successful zero-loot settlement consumes it, while rejected/expired/reverted attempts do not. MVP settlement is one
> outcome/event per transaction, with no batching. Routine signer rotation gives only pre-rotation authorizations their
> remaining deadline up to a five-minute overlap; emergency Safe revocation has no overlap, and finalized settlements stay
> immutable. Settlement submission is permissionless with no approved-relayer registry or submission-derived authority;
> invalid/stale/replayed/racing calls mutate nothing, callers bear their gas, and spam cannot pause or create an incident.
> Community sponsorship uses a dedicated non-upgradeable native-asset `SettlementGasPool`, completely separate from OMR,
> RWA, Stock Token, player-liability, and unrelated treasury custody. Contributions are final and buy no refund, yield,
> priority, allocation, governance, repayment, or other credit; Safe has no treasury sweep, and a delayed code-hash-bound
> successor migration moves only unreserved ETH while the old pool retains outstanding executor-credit backing. Only the
> submitter winning canonical event/nonce settlement—including zero loot—earns a pull-to-self credit; failed, invalid,
> stale, replayed, and losing calls earn zero. Credits are exact liabilities under CEI/reentrancy protection. Reimbursement
> is the minimum of contract-measured audited gas at `min(tx.gasprice, basefee + priority cap)` plus approved canonical
> chain-data fee, a per-settlement wei cap, and unreserved pool ETH; no caller-supplied cost or arbitrary work qualifies.
> Empty/paused/insufficient sponsorship yields partial or zero credit without blocking settlement or consuming an
> uncommitted game's resources. Safe may pause credits/reduce caps immediately; increases, a new fee source, or exact pool
> migration wait 48 public hours, while existing credits remain withdrawable. Direct chain submission stays open even
> when authenticated/rate-limited HTTP surfaces reject abuse. Each chain pins one public finality block count with no
> per-action discretion; every increase or decrease uses the same Safe-only 48-hour exact public proposal and applies only
> to transactions first included after its effective block. Emergencies pause new value-taking settlements rather than
> hot-editing finality. Pre-finality reorg retry reuses the same event/nonce only after canonical absence, and finalized
> events expose complete identities, timings, bucket math, tranche consumption, killer credit, and solvency totals.
> Broker stake weight is capped at 1.50× with tiers `<300=1.00×`, `300=1.10×`, `1,000=1.20×`, `5,000=1.35×`, and
> `20,000+=1.50×`. Only finalized active/committed principal counts. One wallet qualifies one account per epoch; collisions
> score zero until resolved. Canonical transitions affect seven-day TWA prospectively. Safe-only tier changes get seven
> days' notice and start with a later full epoch; each epoch freezes all weighting inputs and is paused/cancelled, never
> rewritten, for a critical defect.
> Portfolio views lead with actual units,
> acquisition provenance/cost, epoch, delivery state, and
> custody destination; market value is secondary, timestamped, source-labeled, and stale-aware. Any added RWA subsystem
> must justify itself through recurring material value, measured user demand, or an actual failure mode plus written
> scope, authority, invariants, tests, and operating owner.
> Any quarantine-touching outflow requires dedicated `reconciliation_outflow` plus
> nonzero details hash; generic reasons revert. Shortfall or quarantine outflow triggers an immediate critical alert
> and persistent red RWA UI showing liabilities/backing/age/affected IDs/last outflow/deficit/pause. Each zero-positive
> transition creates immutable `incidentId`; its timeline closes only after finalized/synced zero and recurrence gets a
> new ID. Safe or current operator may publicly acknowledge the exact ID, binding operator generation when applicable;
> acknowledgment silences repeats only and cannot clear/resolve/unpause/mutate. A mirror over ten minutes stale or with
> unproven sequence continuity stays red `incident_state_unknown_stale`, never green, disables new purchase controls,
> and preserves recovery/reconciliation/cancel/expiry/authorized-outflow controls. Acquisition deficit pauses buying,
> not delivery of already-acquired/allocated stock with healthy exact custody and delivery walls. Incident closure
> requires finalized/synced zero aggregate shortfall and vault deficit, every record invariant, and continuous sequence;
> acknowledgment is irrelevant. Manual pause, deficit, stale mirror, token quarantine, oracle, and exposure blockers
> compose independently; clearing one never clears another. Index disagreement pauses purchases and permits only a
> permissionless bounded deterministic rebuild whose root matches immutable records; Safe/operator choose no order.
> Outflow/generic repair binds positive `maxComponents` and reverts wholly unless the complete action fits, with ordered
> multi-transaction splitting allowed. Incident API cursors order immutable history by accounting sequence, component
> index, and stable event ID; no offset/mutable ordering, active/latest UI default, and full-generation export. Current main operator cancellation may
> be direct or relayed EIP-712/ERC-1271 binding action/chain/vault/generation/intent/reason/details and exact `nextIntentCancelNonce`/
> issue time/deadline; the maximum lifetime is one hour, the shared direct/relay cancellation nonce runs independently of `nextOutflowNonce`,
> Safe cancellation consumes neither, and operator-generation change
> invalidates older signatures. Safe or current main operator may pause new intent creation/execution immediately
> with public reason/details, but only the Safe may unpause. Deposits, deficit repair, matched refunds,
> reconciliation, expiry, cancellation, and authorized operator outflows remain live. Existing deadlines continue to run without extension/
> tolling/revival/substitute/catch-up, and reservations keep normal expiry/cancellation.
> Exact-provenance refunds up to actual debit restore only active intent
> capacity before unchanged deadline; terminal refunds first repair their exact attempt shortfall and only the
> remainder becomes available without reopening, while unknown/
> unprovable/excess refunds are unattributed, with full public classification. Canonical acquisition credit
> requires unique chain/source/external-reference deposit ID from current Safe-approved ingress; duplicates
> revert and every other receipt stays unattributed. Each ingress approval binds exact address/runtime code hash
> and, for a proxy, resolved implementation address/code hash; any change needs fresh public Safe approval, while
> prior canonical deposits and consumed IDs remain historical truth. Each vault has one active exact ingress version
> or zero; Safe rotation is atomic with no overlap/grace, and only inclusion-time active version is canonical, while
> stale calls revert before acceptance/ID/accounting and canonical chain order resolves races. During deficit, one immutable canonical deposit
> record splits total into `deficitRepairAmount = min(msg.value, deficitBefore)` and remaining
> `availableCreditAmount`; only the latter credits available, including zero for a repair-only deposit.
> Safe reclassification is immediate but only
> unattributed-to-available accounting, with no transfer/target/revival/wall bypass. A public positive accounting
> deficit blocks automation/new reservations/reclassification/migration, incoming ETH repairs it through the unified
> oldest-created/type/id queue before bucket
> credit, but main operator may still withdraw actual remaining balance through normal debit/cancellation while
> the deficit remains explicit; no silent haircut is permitted. Deficit mode clears only after canonical-chain
> zero reconciliation reaches configured finality and public-mirror sync, then automation/migration resumes
> immediately under normal walls without acknowledgment/cooldown, revival, replay, extension, or catch-up; recurrence
> pauses again and no role may manually declare zero. Every successful atomic accounting entrypoint consumes the next
> vault-wide `accountingSequence`; compound effects share deterministic component order and publish complete pre/post
> balance/buckets/deficit, while reverts/no-ops consume none and finalized canonical inclusion—not worker/API/DB time—
> controls mirrors, reorg rollback, gaps, and discontinuities. Authorization is current-operator direct call or relayed EIP-712 binding action,
> chain, vault, operator generation, recipient, amount, closed public reason code, nonzero details hash, exact
> current global nonce, `issuedAt`, and deadline; relay validity is issue-time-through-deadline with a one-hour
> maximum and no future issue time. Backend/session/relayer identity alone is never authority. Direct and relay
> consume the same nonce; current operator may advance it without moving ETH to invalidate signed actions.
> Operator may be EOA or ERC-1271 wallet: direct caller equality, exact ECDSA/1271 magic validation, and no
> cross-type fallback; any revert/malformed/non-magic response fails before mutation. Vault outflow is ETH-only
> to any recipient with empty calldata—no
> arbitrary call/delegatecall/token approval or transfer—though payable recipient code may run under reentrancy
> protection and atomic rollback. Debit available, then unattributed, then reserved only as needed;
> recipient must be nonzero and there is no ETH-burn path. Current operator may directly self-renounce into the
> same zero/cancel/generation/signature reset as Safe disable, without moving value; orderly handoff instead uses
> instant replacement before renunciation.
> cancel the fewest whole reservations amount-descending/later-deadline-first/intent-ID-ascending, reclassify
> excess, and publish every cancellation plus immediate pre/post `operator_outflow`, with full rollback on failure.
> Normal buys still obey ballot/per-buy/daily/rolling-30-day/balance caps; success consumes actual input, cap
> reductions never rewrite, increases need finalized Safe, and `exposure_cap_reached` skips without substitute.
> Operator outflow bypasses purchase caps only as a withdrawal. Canonical vault migration remains a 48-hour,
> full-state, code-hash-bound, reconciled Safe path; main operator may bypass it for raw ETH outflow, including
> permanent retirement, but that moves/certifies no state and must never be labeled migration or locked capital.

**Status: DESIGN ONLY (founder-directed 2026-08-09). Approval recorded as a founder assertion, the standing directive pattern. Nothing here is built; the
chain half is mainnet-gated on the third-party audit clock like every contract change.**

The founder's proposal, verbatim in spirit: (1) the fee slice dedicated to RWA should buy the
stock *programmably, like a v4 hook*; (2) the top families should vote **daily**, through the
Commission, on **which stock** gets bought — a live call-to-action; (3) distribution costs money,
so the bought stock **sits and accumulates** until a user **claims their airdrop by paying the
gas** themselves.

**Verdict: FEASIBLE — all three legs — with two engineering corrections, and one place where the
gate lands that is not where you would expect.** The corrections: the buy should be **hook-accrued
but keeper-executed** (per-swap atomic buying is technically possible in v4 and a bad idea — §2);
and "airdrop" needs an **allocation rule** (who is owed how much), for which the retired float
design's burn-earned-$OMR rail is the sound answer (§4). Where the gate lands: Robinhood Stock
Tokens are **standard ERC-20s with no on-chain transfer allowlist** — they move peer-to-peer and
trade on a day-one Uniswap deployment — so the holder restriction is enforced by whoever hands it
over, i.e. by OUR claim rail, not by the token (§5).

---

## 0. What is already true (verified 2026-08-09)

- **Robinhood Chain is live** (public mainnet 2026-07-01): an Arbitrum Orbit L2, ETH for gas —
  the SAME chain family OMERTÀ's whole M6 rail targets. No bridge is needed anywhere in this
  design. (The tokenomics-v2 §10.2 cross-chain flag is moot here too.)
- **Stock Tokens are ordinary ERC-20s**: ~200+ US stocks/ETFs, EU-facing, each with a Chainlink
  price feed. RHJ's currently active split/dividend actions land as **on-chain multipliers, not raw
  balance changes** — which is a gift: a vault holding N token units still holds N units after one of
  those actions, so `allocated ≤ held` in TOKEN UNITS stays exact with zero allocation rewrite. Do not
  generalize that sentence to a future redemption, merger, spin-off, or worthless removal: those
  forward-compatible terminal types use the fail-closed successor-property runbook in
  `omerta-brokers-design.md` §3.4b.
- **Uniswap runs on Robinhood Chain from day one** (a dedicated deployment). OPEN DEPENDENCY:
  which version the stock-token pools run (v3 vs v4) — the keeper's swap call differs, nothing
  else in this design does. Verify before Phase B.
- **The issuer's holder restriction** is enforced by whoever hands the token over, not by the token.
  Anyone technically *can* hold the ERC-20; the party distributing to an ineligible holder is the
  one with the problem. The moment we distribute, that party is us — §5.
- **In our own tree**: the four tax slices already flow into `rwa_revenue` (bond 2500 bps,
  sell-tax 400, Store 2000, gameplay-fee 1000); the v4 `OmertaHook` already **accrues** its RWA
  slice in ETH with a permissionless `sweep` to Safe-set recipients; the Commission has weekly
  vote machinery (`commission_votes`, seats recomputed live); the retired float
  (`omerta-rwa-float-design.md` + `src/rwa.js` at pre-retirement history) had the reserve
  bookkeeping, the `allocated ≤ held` invariant, the anti-fabrication txHash gate, and the
  oracle-priced burn-to-claim rail; and `VoucherClaim` is a battle-tested server-signed EIP-712
  claim contract. **Almost every part of this machine exists; the new work is one keeper, one
  vault contract, one daily ballot, and the eligibility gate.**

## 1. The pipeline at a glance

```
  sells on the OMR pool                     daily, once
  ────────────────────►  OmertaHook accrues  ──────────►  THE BUY (keeper)
                         the RWA slice in ETH             ETH → today's TICKER
                         (already designed)               on its Uniswap pool
                                                              │
  Commission daily TICKER BALLOT  ────────────────────────────┘
  (seated families vote; the town watches)                    ▼
                                                    StockVault (Safe-owned)
                                                    holds the tokens; per-ticker
                                                    units + cost basis booked in
                                                    rwa_reserve (txHash-gated)
                                                              │
  player burns earned $OMR at the oracle price  ──────────────┤  allocation
  (rwa:vault — the reason already in the vocabulary)          ▼
                                                    CLAIM: server-signed EIP-712
                                                    voucher; THE PLAYER PAYS GAS;
                                                    eligibility at sign
```

## 2. Leg one — "programmable like a v4 hook": accrue in the hook, buy with a keeper

**Can a v4 hook buy the stock inside the taxed swap itself?** Yes, technically: v4 pool
operations run inside the PoolManager's unlock callback, and a hook may itself call
`poolManager.swap` against ANOTHER pool in the same transaction — atomic ETH→ticker per sell is
expressible. **We should not do it**, for the same reasons the shipped `OmertaHook` accrues fees
rather than forwarding them in-transaction:

1. **Pool liveness.** A revert anywhere in the stock leg — the stock pool paused, thin, or
   mid-migration — reverts the PLAYER'S swap. That bricks the OMR market whenever a stock pool
   hiccups. Market liveness must never depend on a third pool's behaviour (the exact argument
   that made the hook sweep-based; it holds with more force for a pool we don't operate).
2. **Gas.** Every seller pays for our treasury's shopping. A tax should be cheap to pay.
3. **Execution quality.** Hundreds of micro-buys are sandwich food; one daily buy executed by a
   keeper at a TWAP-checked price with a slippage bound is both cheaper and manipulation-resistant.
4. **The product is daily anyway.** The Commission votes per day; a per-swap buy would front-run
   its own ballot half the time.

So the "programmable" part is exactly what the hook already does — **the RWA slice accrues in
ETH inside the hook, trustlessly, per swap** — and THE BUY is a once-daily keeper transaction:
`sweep()` the hook's accrued slice (plus the bond/Store/fee slices already landing at the
treasury) → swap ETH → today's ticker on that token's own Uniswap pool → deliver to the
StockVault. Keeper discipline copied from the bond-oracle keeper: slippage-bounded against the
token's Chainlink feed, fail-closed on a stale feed, watched by the existing `alertDrift`
watchdog pattern (a silent keeper reads exactly like a quiet day — the recorded lesson).

**Bookkeeping** resurrects the float's ledger from git history: `rwa_reserve (ticker, units,
cost basis)` + `rwa_buys` rows **txHash-gated** (a comp/QA call books ZERO units — "the treasury
holds this" must never be assertable by a mod route; the anti-fabrication class that has been
fixed three times in this tree). The invariant is the float's, restored to its original strength
because both sides are the same asset again: **allocated ≤ held, per ticker, in token units** —
nightly, beside vig/bond/treasury/desk in `alertDrift`.

## 3. Leg two — THE TICKER BALLOT (the Commission picks the stock of the day)

Pure off-chain build on existing machinery, and the best part of the proposal — it turns a
treasury operation into a daily server-wide political event.

- `commission_ticker_votes (day, gang_id, ticker)` — the weekly `commission_votes` shape at
  daily cadence. A **seated** family's boss/underboss casts one public vote per day from the
  supported-ticker catalog (start small: 5–8 liquid names); re-cast all day; standing-ranked
  weighted tally at close (the audited step-two ballot discipline: weight frozen at cast,
  electorate bounded at the seat count, dissolved families' ballots deleted).
- **The day's draw resolves at the buy, not at midnight**: the keeper reads yesterday's tally.
  Deadlock/silence → the keeper buys the DEFAULT ticker (a founder lever — e.g. the broad-market
  ETF) rather than skipping, so a quiet chamber never stalls accumulation. (Alternative:
  skip-and-carry the budget; a founder call, but a default keeps the daily beat alive.)
- **Why this is manipulation-safe**: the vote chooses *which* ticker, never *whether*, *how
  much*, or *to whom* — the budget is the accrued slice and the destination is the vault, both
  outside the ballot. The worst a captured chamber does is pick a stock the town disagrees with.
  That is not an exploit; that is the Commission working.
- **The call-to-action**: the open ballot on `GET /v1/city` + a card on the Family tab ("the
  chamber is deciding today's buy — your family's vote is cast/uncast"), the result on the
  streets feed + the city wire ("the Commission put the day's take into NVDA"), and the running
  vault (units per ticker, cost basis, market value via the Chainlink feeds) as a public board —
  the town watching its own treasury grow is the retention hook.

**§10.4: zero surface.** Votes move nothing; the buy is out-of-band real value (zero
`transactions` rows, the fees.js precedent); the vault board is a read.

## 4. Leg three — claims: the user pays the gas, and WHAT they can claim needs a rule

"Anyone can claim while it sits and accumulates, paying the gas for their airdrop" — the
**pull-payment** pattern, and correct: distribution cost lands on the claimant, unclaimed stock
just sits (custody is free), and nobody is ever pushed a token they didn't ask for (which
matters — see §5).

**The missing piece is the allocation rule** — an "airdrop" implies everyone is owed something,
but *how much*? Two options, one recommended:

- **RECOMMENDED — the float's rail: burn earned $OMR to allocate.** A player burns $OMR at the
  ticker's oracle price (Chainlink feed × a premium bps — the vault is not a market maker, the
  treasury-claim precedent) to move units from `unallocated` to their account's vault line
  (`rwa_vault (account_id, ticker, units)` — account-level, survives death). The burn reason
  `rwa:vault` is **already in the §10.4 vocabulary** — this is the one in-game flow in the whole
  machine, and it's a sink. Properties: allocation is **purchase-shaped** (earned, chosen, priced
  — "never by chance" holds trivially); it's a deep recurring $OMR sink; clamps to `unallocated`
  so an IOU can never be issued; structuring-guarded by the shared `rwa_used` RICO window that
  already exists.
- **Rejected — pro-rata "everyone accrues a share by playing."** Distribution-by-gameplay makes
  the stock a *dividend on play*, drags every §10.4 faucet inside the gate, strengthens
  the investment-contract reading of $OMR itself, and still needs a claims registry. The
  founder's "any user can choose to claim" is fully satisfied by the burn rail — anyone CAN
  claim; what they claim is what they allocated.

**The claim mechanics** are the M6 rail with a different asset — `StockVault` is `VoucherClaim`
with an ERC-20 `transfer` instead of a mint: server-signed EIP-712 voucher
`{to, ticker/tokenAddr, units, nonce, deadline}`, replay-proof nonce, deadline-bound, per-ticker
daily caps, pausable, Safe-owned, **pre-funded only** (it can only hand out what it holds — the
tranche discipline; `allocated ≤ held` enforced by construction on-chain and checked off-chain).
The claimant submits and **pays the gas**; the server signs only for an eligible account (§5).
An expired unclaimed voucher's units return to the account's allocation (the
`reclaimExpiredVouchers` pattern, easier here since nothing was burned to sign).

## 5. Where the gate lands — because the token itself won't stop anyone

The searches confirmed the sharp fact: **there is no on-chain allowlist**. A Stock Token moves
like any ERC-20. So every restriction lives at the point of *distribution* — and the claim rail
is our point of distribution. Consequences, all mechanical:

1. **Eligibility is checked at voucher-SIGN time, server-side**: linked SIWE wallet + minted
   account (the extraction gate that already exists) + **an eligibility allowlist** (the issuer's
   own excluded list — a founder-supplied parameter). An ineligible account can still ALLOCATE
   (the in-game burn and the vault line are not the gated event) — it just can't claim
   on-chain until eligible. This is exactly the R3 posture the original design recorded.
2. **Pull, never push.** No token ever moves to a wallet that didn't sign a claim transaction —
   which is both the gas-cost win the founder wants and the clean answer to "did you distribute
   to them?" (they came to the counter, attested, and paid).
3. **The standing copy rules stand**: no appreciation language, no earnings promises, describe
   the machine factually. The approval covers architecture; exact player-facing copy is
   its own review (the recorded rule).
4. **Identity depth is a founder call, not ours**: how much verification the claim counter needs
   is the one open parameter. The design works under either — it only changes what
   `signStockVoucher` checks.

## 6. Build order (each phase shippable alone)

- **PHASE A — off-chain, zero new gated surface, buildable now**: the TICKER BALLOT
  (`commission_ticker_votes` + tally + the city/family/feed surfaces), the vault BOARD (public
  units/cost/value), and `rwa_reserve` bookkeeping resurrected txHash-gated (mod-driven sim
  buys for QA book zero units). Chain-dormant like every M6 sibling.
- **PHASE B — the metal**: `StockVault.sol` (the VoucherClaim fork) + the keeper (sweep → swap →
  vault, slippage-bounded, watchdogged) + real `rwa_buys`. **Resets the third-party audit clock**
  (the recorded rule for any contract change) — batch it with whatever else is queued for that
  audit. Verify the Uniswap version on Robinhood Chain here.
- **PHASE C — claims live**: `signStockVoucher` + the eligibility gate + the client
  claim flow (the wallet picker + calldata rail already exist), behind the founder's final word on
  verification depth and the eligibility list.

## 7. What this deliberately does not do

No per-swap atomic stock buys (§2). No pro-rata airdrops (§4). No custody of claims we don't
hold (allocated ≤ held, both sides in token units). No RNG anywhere near the asset (the
never-by-chance rule — the ballot is a vote, the allocation is a purchase, the claim is a
transaction). No new hook — the deployed-in-design `OmertaHook` already accrues the slice, and
one pool takes one hook. **FOUNDER-RESOLVED 2026-08-09 ("one hook four slices"): the canonical
pool runs ONE hook whose accrued fees route to FOUR destinations — dev / treasury (this
machine's buy budget) / LP — the §10.8 trade-fee question was CLOSED 2026-08-11 by retiring the trade fee (no vig slice), and this design's
treasury slice into a single contract. The Stock Machine adds a KEEPER that sweeps the hook's
treasury accrual, never a second hook.** And no copy that promises anything about what the
stock will be worth.
