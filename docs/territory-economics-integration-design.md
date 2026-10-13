# F20 territory economics: source-bound integration design

Phase: component design; no implemented payment, API, worker, or release qualification.
Inspected base: `029312db26cf9e71058ce2512592c1f1cd734561`.
Infrastructure dependency inspected separately: `fefebab7dbc62de04b5f3635b2194d527d0ff9a9`.
The base does not contain `src/infrastructureconcessions.js`; no dependency was silently installed.

## Supported economic effect

An original living Depot owner explicitly authorizes a bounded share of subsequent verified customer profit to the owner's original consenting family. That family must still hold the Depot district, the operator must remain a member, and the paid F19 concession must remain valid. Membership/control changes never transfer the consent. No external spending, financial activation, demand multiplier, treasury mint, or new money bucket is proposed.

Canonical `Depot.buyFromDepot` writes a sale journal with customer identity, net revenue after the market take, negative inventory cost, and negative stock. It writes `depot:buy` and `depot:take` cash witnesses. `bookDepot` also writes costs/expenses and franchise royalty expenses. A conservative closed window sums positive sale cash plus negative COGS, subtracts all new expense fields, and rejects malformed/unwitnessed sales. Other positive journals (funding, refunds, rent, royalties) are never customer income. Missing records or a window exceeding the explicit bound yield UNKNOWN and no payment. No claim of independent customers is made from character IDs alone; customer original account identity must differ from the operator's.

Journals use random UUIDs and transaction timestamps, not a monotonic global sequence. Freeze exact baseline journal IDs at consent and retain unique paid-source IDs; do not use `(created_at,id)` as a chronological cursor. A finite complete per-Depot window is intentionally restrictive; a truncated history must not qualify as complete. Unpaid positive profit and subsequent expenses remain in the same cumulative consent window. Profile edits must not erase paid totals or daily/lifetime ceilings.

Actual transfer is `Depot.withdrawDepot` followed by `Gang.tribute` in the same authoritative actor/item transaction. Canonical tribute minimum is $100; smaller eligible shares remain unpaid. Treasury stock, cost basis, cash reserve and current operating-policy reserve remain protected. The receipt binds original operator/account, business, concession, district, family, source IDs, withdrawal and tribute journal witnesses. It creates no treasury credit independent of tribute.

## Required shared transaction seam

`G.withCharacter` owns `Items.withItemTransaction`; `Items.withItemTransaction` explicitly rejects nested transactions. An outer Items wrapper followed by G is invalid, and a fabricated pool/client wrapper would violate ownership. `G` currently exposes before-character/after-account hooks, but F19's `withInfrastructureConcession` uses a live AsyncLocalStorage scope that must span preflight, action and final authority refresh. A before-character callback alone cannot retain that scope.

Minimal root-owned addition: an internal lifecycle wrapper invoked inside the existing branded G transaction, surrounding existing actor/account acquisition, owned-state load, action and persistence. The wrapper resolves `concessionProductionContext` and invokes `withInfrastructureConcession(client, context, execute)` before G acquires its single actor. Existing G phase-one settlement and postcommit behavior remain outside this wrapper. No nested BEGIN/COMMIT, callback-created ownership token or caller-supplied authority is permitted.

F19 already sorts original operator/landlord actors and accounts, then both Depots, locks premises/rental sources and revalidates source hash, paid leases, policy, physical condition and expiry. F20 must call `concessionToolAuthority` inside that live scope and refresh expiry after any later source wait. Intended subsequent locks: district, gang, current membership, F20 profile/request, then Depot journal witnesses. Confirm cross-feature ordering in the combined root source before installing the wrapper.

`Gang.tribute` calls `resolveWarIfDue`, which can lock two war gangs in sorted order. Taking only the current gang before this call would invert with an earlier-ID rival. The bounded initial product refuses any non-null `war_with` after locking the current gang, preventing the hidden second-gang transition. Existing tribute emits a synchronous game UI event and updates daily/family tasks; rollback notification behavior is inherited and must be recorded, not mistaken for external customer messaging.

## Interfaces and pending proofs

Proposed owned operations: set original-owner consent with exact body/key replay; run share under trusted live F19/G scope; close original consent; private original-account board; metadata-only death invalidation; all-row source/payment invariant collector. Configuration by an agent with an existing restrictive operating policy must use the established owner-session restriction. Automatic execution may consume only explicit current consent and cannot change policy or create external authority.

Pending source-integrated evidence: real canonical procurement/receive/retail, actual paid premises/rental/F19 acceptance, actual family holding and tribute effects; original-actor death/no heir or new-holder rights; duplicate/request/source replay; late expiry after source lock wait; membership/control/policy drift; withdrawal/tribute failure rollback; global cash/GIN/treasury conservation. Native proof requires a fresh owned explicit loopback PostgreSQL18.4 fixture. None has been executed for F20 at this design phase.

Manual policy passes so far: caller/brand boundary, authority and lock ordering, journal arithmetic/source provenance, replay and death semantics. Methods follow the repository policy's pinned Pashov/Plamen/Trail of Bits adaptations; no upstream orchestration or blanket audit is claimed.
