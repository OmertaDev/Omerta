# Player-first launch strategy

Status: proposed launch sequence, September 30, 2026. Founder confirmed that player-tranche
proceeds contribute to initial liquidity and the play window lasts at most five days before
the whitelist cutoff. This plan does not activate checkout,
change committed Genesis parameters, or authorize production transactions.

## Objective

Contract implementation and release boundaries are documented in
[player Genesis preparation](../omerta-contracts/PLAYER-GENESIS.md). The strict player-first route
uses a guarded public auction and the current market's initializer; existing Genesis factory and
keeper calldata does not support this sequence. Implementation is not deployment or activation.

Open Omerta gameplay and character minting first. Let players establish a history of playing,
then offer qualifying players a capped Genesis purchase opportunity alongside public access.
Judge the first phase by returning players and enjoyable gameplay, rather than mint revenue alone.

The character release already supports operation without OMR issuance, a pool, bonds, the Bank,
or token withdrawals. See [character release preparation](../omerta-contracts/CHARACTER-NFT-LAUNCH.md).
The current [Genesis runbook](../omerta-contracts/GENESIS-LAUNCH.md) specifies a seven-day,
uncapped public CCA with a zero validation hook. A player tranche is a proposed amendment;
its supply, custody, pricing, proceeds and claims require a reviewed implementation before announcement.

## 1. Fix the offer before accepting paid mints

- Define the character's standalone gameplay and portrait benefits, the actual mint fee,
  and any earned or complimentary mint routes. Do not require a second portrait fee.
- State that qualification grants an opportunity to buy, subject to the published tranche rules.
  It does not grant free OMR, guaranteed returns, or a guaranteed token quantity before pricing.
- Decide which prelaunch progress persists. Keep any provisional game credits explicitly
  nonredeemable unless a separately approved conversion policy exists.
- Publish the qualification window, criteria, snapshot time, allocation method and appeal deadline.
- Complete applicable sale-term and eligibility review before promoting paid minting as sale access.

Deliverable: one approved player-facing rules page and a fixed parameter sheet.

## 2. Release the game and character flow

- Complete the character release's existing production gates, including the new fee deployment,
  recipient verification, wallet linking, payment indexing and end-to-end NFT claim evidence.
- Check the full pretoken gameplay loop and every visible purchase/reward action. Close or clearly
  label unavailable token-dependent actions so the first session is coherent.
- Start with a bounded invited cohort, fix material onboarding and gameplay failures, then expand access.
- Instrument wallet-link completion, character creation, NFT claims, meaningful play days,
  day-1/day-7 return rates, payment failures and support volume.

Confirmed qualification window: at most five days (120 hours) from the announced opening to
the whitelist cutoff. Publish exact UTC opening and cutoff timestamps after release readiness
is established. Do not start the qualification clock during a broken checkout. Snapshot eligibility
at the cutoff; appeals may correct recorded eligibility but cannot add gameplay after that time.

## 3. Qualify players through play

Baseline: one linked wallet, one eligible character account, and meaningful gameplay on at least
one distinct UTC date during the window. Select qualifying actions from existing game loops before
publishing the rules; log server-accepted actions rather than browser visits. Count each UTC date
once. The founder-selected contribution tiers are:

| Qualifying play days | Maximum player-tranche contribution |
|---|---:|
| 0 | Ineligible |
| 1 | 0.5 ETH |
| 2 | 1 ETH |
| 3 | 2.5 ETH |
| 4 or 5 | 5 ETH |

Caps are cumulative across all player-tranche payments, not per transaction. The fifth day retains
the four-day cap; this is the planning default because no fifth tier was specified. These are maximum
contribution requests, not guaranteed accepted contributions or token allocations. They do not cap
participation in the separate public auction.

- Award one eligibility slot per qualifying player account. Extra mints, spending, referrals,
  or repeated actions within a qualifying day do not increase the slot or purchase cap.
  Only additional qualifying play days increase the tier, up to the 5 ETH maximum.
- Bind the slot to the originating account and its verified wallet, not current portrait ownership.
  The portrait is transferable; its game account and entitlement stay with the original account.
- Make qualifying actions accessible to ordinary play. Avoid wealth or leaderboard thresholds.
- Review obvious coordinated farming using proportionate account and activity evidence.
  A wallet limit alone does not prove a unique person; shared IP addresses alone do not prove abuse.
- Show progress and the deadline in the game. Freeze wallet changes for the snapshot,
  with a documented recovery path before the list is finalized.

Deliverable: a versioned eligibility export, aggregate counts, appeal decisions and final snapshot hash.
Keep sensitive account and abuse-review data out of public exports.

## 4. Design the player priority tranche

Suggested planning starting point: reserve 10% of approved sale inventory for players and retain
90% for the public auction. This is a proposal, not a change to the current 4,410,000 OMR auction
inventory or the separate LP reserve. Reconcile all token budgets before approving either amount.

Recommended pricing principle: players receive reserved access at the public auction's final
clearing price, with no discount. Validate whether the selected CCA supports the intended settlement
semantics before making that promise. Do not invent a fixed-price presale beside an unresolved auction.

Proposed settlement sequence:

1. Snapshot qualified wallets before public bidding opens.
2. Run the reviewed public auction to completion.
3. Open a 48-hour player reservation/payment window once its final price is known.
4. Accept contribution requests up to each player's snapshotted ETH tier. Nobody must request
   their full allowance. Hold payments pending settlement rather than routing them immediately.
5. Close the window. Proposed oversubscription rule: if total requests exceed the tranche's
   capacity at the final public price, scale all requests proportionally, round accepted amounts
   down, and make excess ETH refundable. Otherwise accept each request in full. Convert accepted
   contributions to OMR at the same approved price and reconcile rounding against inventory.
   Publish this rule before paid minting; never allocate by transaction speed. Do not promise
   unused capacity to another player or transfer it into the completed auction.
6. Combine the approved liquidity contributions from both sale legs, then open the pool through
   the amended, reviewed migration ceremony. Send unsold inventory only to its approved
   destination; publish aggregate settlement results.

The player purchase contract must enforce the snapshot, cumulative tier cap, price and deadline,
prevent duplicate eligibility use, and define settlement, failed-payment and refund behavior.
Route only accepted proceeds into the liquidity/proceeds split; refundable ETH must remain reserved.
Both sale legs must keep token claims
closed until player settlement and successful pool migration, and no earlier than the public
claim cliff. Define a common claim opening rule before launch; this changes the current timing.

Confirmed funding decision: player-tranche proceeds contribute to initial liquidity. Public price
discovery therefore precedes the player purchase window, and pool opening follows its settlement.
The current automatic CCA migration path must be amended so it cannot open the pool prematurely.
Validate that the external auction/LBP stack can enforce this ordering, including any permissionless
migration path; a keeper delay alone is insufficient.

Approve the player proceeds split and matching OMR liquidity budget explicitly. Contribution to
liquidity does not imply that 100% of player proceeds goes to LP; the public leg currently assigns
37.5% of net proceeds to LP. Define how both legs count toward graduation, a settlement deadline,
and refund/recovery behavior if combined settlement or migration fails. Do not assume the existing
CCA can refund completed bids or that its reserved LP inventory covers the additional contribution.
These are implementation and release gates, not unresolved launch-sequence preferences.

Deliverable: approved sale architecture, reconciled supply/proceeds table, updated runbook,
implementation, and scoped security review with relevant settlement tests and fork evidence.

## 5. Use a readiness decision, not a fundraising countdown

Before opening Genesis, evaluate the full qualification cohort: retained players, completion of
core gameplay, concentrated or suspicious eligibility, support load and purchase reliability.
Set numeric retention and reliability thresholds before the cohort begins, using the invited pilot
to establish a realistic baseline. A large mint count alone does not satisfy this gate.

Proceed only when gameplay is stable, eligibility appeals are resolved, sale rules are published,
the amended sale is reviewed, and production configuration and Safe simulations satisfy the
existing release gates. Otherwise continue testing outside the qualification window and revise sale dates before taking
sale funds. Successful source tests do not establish production activation.

## 6. Execute Genesis and measure the result

- Publish official contract addresses, auction and player-window times, caps, pricing, claim times,
  proceeds policy and unused-inventory destination through the existing official surfaces.
- Execute the reviewed production ceremony; verify receipts, runtime identities and actual state.
- Monitor auction settlement, player purchases, claims, migration and oracle readiness separately.
- After launch, measure returning players and gameplay participation alongside tranche uptake.
  Compare the qualified cohort's retention before and after Genesis to identify allocation-only demand.

## Decisions needed next

| Decision | Proposed starting point |
|---|---|
| Qualification window | Confirmed maximum five days (120 hours) to the whitelist cutoff |
| Meaningful play requirement | At least one distinct UTC date; more days unlock contribution tiers |
| Eligibility unit | Originating character account plus verified wallet |
| Player share | 10% of approved sale inventory; reconcile against current commitments |
| Player pricing | Public final clearing price, subject to validated settlement support |
| Purchase limit | 1 day: 0.5 ETH; 2: 1 ETH; 3: 2.5 ETH; 4–5: 5 ETH cumulative |
| Oversubscription | Proposed proportional acceptance with excess ETH refundable |
| Player purchase window | 48 hours after final public price is known |
| Claims | Both legs after player settlement and pool migration, no earlier than public claim cliff |
| Unused inventory | Fixed approved destination; no automatic second sale |
| Initial liquidity funding | Both public and player sale proceeds contribute; pool opens after player settlement |
| Player proceeds split and LP token budget | Approve and reconcile before implementing the tranche |

First implementation scope: eligibility tracking and the player rules/status page once the parameter
sheet is approved. Keep the sale amendment as a separate workstream because it changes the current
Genesis architecture and requires its own evidence.
