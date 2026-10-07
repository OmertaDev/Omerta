# Deed RWA upgrades: context dossier

Source revision: `db54f824004c4d855778668081ce2adfac173c39` (pre-change worktree HEAD).
Scope: server-side gameplay eligibility, optional OMR upgrades, epoch weighting, allocation and delivery boundaries. Phase: implementation preparation; no deployment or activation conclusion. This document records context, not a security verdict.

## Function records

- `src/brokers.js:61` (`activate`): selects a paid tier, locks activation state, debits via `spendOmr`, writes a renewable window. Its transactional safety depends on the authenticated `withCharacter` wrapper; the function does not own a transaction.
- `src/brokers.js:102` (`brokerBoard`): reports current activation and activity. Existing eligibility combines a live payment window with gameplay qualification. It must distinguish baseline gameplay eligibility from optional upgrade status under the new model.
- `src/brokers.js:139` (`allocateEpoch`): owns a transaction; exact window reruns return the existing epoch. Currently filters eligible non-NPC accounts through live activations, then applies activity breadth and score gates. Writes published account weights and total weight; delivers no asset.
- `src/brokers.js:232` (`distributeBuy`): owns a transaction and locks the real buy row. Chooses the latest epoch published at or before buy recording, floors each proportional allocation to six decimals, and consumes the distribution latch even for an absent or weightless epoch. Calls `allocateStock`; does not mint currency or deliver assets.
- `src/treasury.js` (`allocateStock`): bounds allocations by real purchased holdings per ticker, with a transaction-scoped advisory lock in production. Accumulated allocations remain account-keyed and owed regardless of whether an account has a delivery target.
- `src/stockdeliver.js:95` (`deedTargetRows`): targets the observed on-chain owner's linked account. When ownership has not been observed, falls back to the extractor. Only extracted deeds with token IDs participate; most recently extracted deed is selected first. Delivery eligibility and deed ownership are separate from gameplay earning eligibility.
- `src/vanity.js:23` (`spendOmr`): rejects nonpositive/nonfinite costs and insufficient balances, mutates the in-memory account and writes the ledger. Persistence and rollback depend on the caller's transaction wrapper.
- `src/game.js:1113` (`withCharacter`): locks the character and account, invokes the action, persists account balance, and commits. Failure rolls back. `src/game.js:181–210` ledger recycling adds recognized OMR sinks to desk inventory and writes the paired `desk:recycle` transaction.
- `src/rules.tail.js:5889–5993`: activity qualification requires three distinct gameplay tracks and minimum score 25; agents participate, NPCs are excluded. Current broker multipliers range from 1 to 3. New bonus limits and milestones must be explicit server rules.

## Cross-function invariants for implementation

1. Qualifying gameplay earns a baseline weight without a paid activation. Optional upgrades never bypass activity breadth or score qualification.
2. Upgrade costs, eligibility, sequential level changes and maximum bonus are enforced server-side under the account transaction lock. Recognize any new sink reason in the existing OMR conservation registry.
3. These OMR sinks recycle inventory; public wording must say **spend** or **sink**, not irreversible token burning.
4. Published epochs, weights, stock allocations and delivery records remain unchanged during migration. Previously earned allocations require no additional payment.
5. Upgrade history must support weighting as of the epoch window. Apply a level only when `effectiveFromDay <= epoch.startDay`, protecting past and partially overlapping activity windows. Select the latest qualifying historical level; current level alone is insufficient.
6. Future distributions split the fixed funded pool proportionally. The bonus cannot create purchased units, guaranteed payouts or an additional treasury obligation.
7. Preserve publish-before-buy selection, one distribution per buy, floor rounding and `allocated <= held` clamp.

## Assumptions and open questions

- Upgrade transfer semantics must be explicit: a deed-bound upgrade follows the same deed owner used for delivery; account-bound progress does not automatically transfer with an NFT. No established upgrade ownership model exists at this pinned revision.
- Existing paid activation history requires an explicit transition policy; no automatic refund or converted bonus entitlement is established here.
- Activity history retention and historical account/NPC status are taken from existing storage; a versioned historical account-eligibility snapshot was not found in the inspected path.
- Operational chain configuration, distribution activation and actual production deployment require separate verification.
