# Deed death custody and Safe House

Implementation scope: character-life custody, automatic death settlement, and voluntary
Safe House protection. These contracts and adapters are not production activation.
Existing immutable deployments do not acquire these rules from a source change.

## Ownership and death

Equipping is an explicit wallet action. A restricted account for the exact character life
holds the Deed NFT. Its canonical ERC-6551 wallet retains all Stock Tokens, but cannot
withdraw, approve spenders, or execute arbitrary calls while equipped. Neither equipping
nor settlement moves Stock Tokens into a treasury. Soulbound character identity and
the permanent 2,500-building supply remain separate from transferable property.

The gameplay death transaction records an immutable, ordered death event together with
the exact killer and next-generation heir. An automated keeper registers pending lives,
submits ordered on-chain death records, and advances each Deed through the recorded
succession graph. A killer who dies before an earlier transfer settles cannot keep or
withdraw that loot. The same Deed and stock-wallet identity continue through A → B → C.
Traversal is bounded per transaction and resumes without skipping an unresolved edge.

Unprotected player-kill loot goes to the killer's life account. Non-player deaths and
protected Deeds go to the victim's exact heir after a 24-hour estate delay measured from
the authoritative death time, with assets locked until confirmed settlement. Each later
death applies its own disposition and delay. An unminted killer or heir has pending
rights; absence of an identity never redirects property to the operator or treasury.

Unequipping requires the owner's typed signature, the published exit notice, and fresh
game authorization serialized against pending deaths. Assets stay restricted until exit
is reconciled. Once an exit transaction is durably prepared, actions and death commits
for that life pause until its canonical outcome is reconciled. The ordinary 24-hour
notice period does not pause play. The raw transaction journal preserves this barrier
across a worker crash before the exit row updates. A game server remains the authority for off-chain combat; a contract
cannot independently discover an unreported death. Finality and chain outages delay
settlement instead of granting provisional withdrawal authority.

## Daily Safe House fee

The user selected the previous completed UTC day's OMR trading volume as the pricing
input. The canonical ETH/OMR settlement manager records the absolute raw OMR side of
each successful swap once, in OMR atomic units. Failed swaps, liquidity changes,
donations, transfers and other venues do not count. The published source is this manager,
not an estimate of all-market volume. A full recorded UTC day is required before pricing.
Tracking begins with the first full day after manager deployment, so the first price
becomes available at the second UTC midnight after deployment.

The daily fee per Deed is `clamp(previousDayOmrVolume / 20,000, 1 OMR, 25 OMR)`.
Examples: zero or 20,000 OMR volume costs 1 OMR; 100,000 costs 5 OMR; 500,000 or
more costs 25 OMR. Integer arithmetic rounds down at token precision. The fee increases
with volume and remains fixed for purchases in that UTC day.

Owners may prepay whole 24-hour periods up to seven days ahead. Today's price applies
to the newly purchased periods; later daily changes do not alter prepaid coverage.
The owner signs the UTC price day and maximum total burn. A rollover or changed quote
requires a fresh signature rather than silently charging more.

Payment destroys actual on-chain OMR through a narrowly authorized, allowance-consuming
burn. It is not a game-ledger debit, a transfer to a dead address, or a recycled Desk fee.
It reduces total token supply and is non-refundable. The canonical token requires a new
reviewed deployment with this burn path and the custody operator pinned before sealing.
Any assets held by an older generic token-bound account need an explicit migration before
financial activation. This custody contract cannot retroactively restrict a different
wallet implementation or revoke that wallet's old spending allowances.

Protection covers the Deed and every asset in its canonical wallet. Coverage is evaluated
at the authoritative death timestamp, using historical intervals for that property's
owner dynasty. Purchasing afterward never changes an earlier death's loot. Expired time
does not confiscate the property; it exposes it to subsequent eligible deaths. Protection
does not follow stolen loot into a different dynasty, erase an existing transfer, promise
yield, guarantee Stock Token value, or activate Stock Token acquisition/delivery.

## Release requirements

The affected review includes contract access and allowance boundaries, nested ownership,
malicious token/receiver behavior, successive deaths, historical protection, UTC pricing,
rounding, replay and signature domains, database transaction/lock ordering, keeper crash
recovery, finality, and UI quote/actor races. Retain executed evidence under the repository
security-review policy. Deployment, source/runtime identity, pinned transfer roles, signer
separation, financial activation and shared release handoff remain separate operations.
