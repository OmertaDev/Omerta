# OMERTÀ Market V2 — X campaign drafts

Campaign: **The city has a treasury.** Created 2026-09-13. Three eight-post threads and six standalone posts. These are creation drafts; nothing has been published.

Canonical structured source: [copy.mjs](copy.mjs). Post text includes its thread number. Asset filenames in the data resolve inside the campaign's `png/` directory; alt text is supplied with each attachment. Use the image with the specified post, and post the rest as replies in order.

## Editorial basis

- Voice: [MARKETING.md, section 6](../../MARKETING.md) and [MARKETING-COPY.md](../../MARKETING-COPY.md): noir, specific, unhurried; no earnings, token-price or guaranteed-return claims.
- Mechanisms: [Market V2 design](../../omerta-contracts/docs/market-v2/DESIGN.md): canonical sell-fee scope and split, seven finite compartments, inventory-backed bonds, solver-funded arbitrage, seasonal fee entitlements and actual NFT custody.
- Release truth: [scoped implementation review, 2026-09-13](../../output/market-v2-review/REVIEW.md) and [deployment runbook](../../omerta-contracts/docs/market-v2/RUNBOOK.md): local implementation candidate; no deployment, reserve funding, production signer or game-route activation. Chain rehearsal and production integration remain ahead.

The design and final scoped review govern V2 mechanism and release claims where older marketing material differs. This copy does not describe the review as an external audit or imply that production acceptance is complete. RWA is a named fee recipient; the posts make no claim of RWA approval or live assets.

Each thread states built/tested and undeployed/unfunded status in its opener and closer. Every standalone post carries its own status. No post promises APY, a floor, token appreciation, MEV protection or exclusive arbitrage. No affiliation with an outside protocol is implied. No incentives are represented as live.

Character checks include numbering, spaces, line breaks and handles. These texts use only ASCII and Latin characters in the one-weight range, with no URLs or emoji, so their weighted counts equal their Unicode character counts. All 30 posts are below 280 weighted characters. Attached media and alt text are separate from the post text.

Second source review: surge wording refers to sell-driven tick pressure and time decay, without implying a duration gate; reserve roles avoid ambiguous raw-tick price directions; arbitrage profit is identified as after swap fees and before gas, with gas budgeted separately. Family rights remain prospective, funded and separate from principal. The Olympus reference identifies design inspiration in an independent OMERTÀ implementation, not affiliation. Opening-window wording preserves its finite, per-swap scope.

## Thread drafts

### 01-city-treasury — The city has a treasury.

**Post 1/8 · 216 weighted characters**

```text
1/8 The city has a treasury.

OMERTÀ Market V2 puts liquidity, reserves, inventory bonds and family Turf around a new Uniswap v4 market.

Built and tested locally. Not deployed or funded.

Here is how the books work.
```

Asset: [01-city-treasury.png](png/01-city-treasury.png)

Alt text: OMERTÀ Market V2. The city has a treasury. A miniature noir city inside an open bank vault. Built and tested; not deployed.

**Post 2/8 · 220 weighted characters**

```text
2/8 Seven compartments. Seven jobs.

Core. Lower Cushion. Garrison. Upper Cushion. Desk. War Chest. Turf.

Liquidity, trading inventory and idle reserves each have a place in the books. Each operates within fixed limits.
```

Asset: [05-seven-compartments.png](png/05-seven-compartments.png)

Alt text: The seven Market V2 compartments: Core, Lower Cushion, Garrison, Upper Cushion, Desk, War Chest and Turf. Finite capital with distinct roles.

**Post 3/8 · 196 weighted characters**

```text
3/8 The canonical ETH/OMR pool keeps a 9% base sell fee:

2% developer
1.6% RWA recipient
2.4% community
3% protocol-owned liquidity

The destination is part of the contract. LP fees are separate.
```

Asset: [04-tax-map.png](png/04-tax-map.png)

Alt text: Canonical pool base sell fee: 2% developer, 1.6% RWA recipient, 2.4% community and 3% POL, totaling 9%. An additional 0 to 1% sell surge goes to stability. LP fees are separate.

**Post 4/8 · 232 weighted characters**

```text
4/8 Sell-driven tick pressure can add a 0-1% surge, paid entirely to stability. Pressure decays over time.

The hook sell fee tops out at 10%, before separate LP fees.

This is canonical pool policy. It does not tax every OMR venue.
```

**Post 5/8 · 217 weighted characters**

```text
5/8 Opening night has a clock.

A finite anti-snipe window can apply a bounded temporary buy fee and an optional quote-size cap per swap.

The administrator cannot extend the window. Splitting trades remains possible.
```

**Post 6/8 · 225 weighted characters**

```text
6/8 The hook settles swaps and records measurements.

Companion contracts hold capital, manage reserve positions, vest inventory bonds and account for family fees.

Each authority has a defined job. Each balance has an owner.
```

**Post 7/8 · 221 weighted characters**

```text
7/8 The city gets something to contest: future funded LP fee rights tied to seasonal Turf.

Families can contest those rights. They cannot take the underlying liquidity principal.

The distinction is written into custody.
```

Asset: [08-fee-rights.png](png/08-fee-rights.png)

Alt text: Family Turf controls future funded LP fee entitlements. Protocol-owned liquidity principal remains outside family control. Historical fees stay with their recorded recipients.

**Post 8/8 · 249 weighted characters**

```text
8/8 The city has a treasury. The contracts now have to earn their place in it.

Market V2 is built and tested locally, not deployed or funded. Chain rehearsal, production integration and launch acceptance remain ahead.

Follow the build. @OmertaOnRH
```

### 02-reserve-desk — Capital with orders.

**Post 1/8 · 220 weighted characters**

```text
1/8 Capital with orders.

OMERTÀ Market V2 gives the reserve a finite balance, separate compartments and rules for each move.

The contracts are built and tested locally. Not deployed or funded.

Inside the reserve desk:
```

Asset: [02-reserve-desk.png](png/02-reserve-desk.png)

Alt text: OMERTÀ Market V2. Capital with orders. A noir treasury desk with seven ledger compartments. Seven compartments, finite budgets. Built and tested; not deployed.

**Post 2/8 · 208 weighted characters**

```text
2/8 Core holds two-sided liquidity. Lower Cushion and Garrison commit ETH against OMR selling. Upper Cushion and Desk supply OMR into buying.

War Chest holds idle reserves. Turf holds a fixed seasonal range.
```

Asset: [05-seven-compartments.png](png/05-seven-compartments.png)

Alt text: Seven distinct compartments organize two-sided liquidity, downside ETH inventory, upside OMR inventory, idle reserves and fixed seasonal Turf.

**Post 3/8 · 228 weighted characters**

```text
3/8 An independent OMERTÀ implementation inspired by Olympus range-bound stability.

Spending is capped. Recovery needs spaced observations and actual War Chest assets.

Cooldowns apply. Lifetime deployment limits stay consumed.
```

**Post 4/8 · 229 weighted characters**

```text
4/8 A liquidity band has capacity. It can fill, reverse or be removed.

Crossing it does not permanently retire its inventory. A violent market can outrun finite reserves.

These are trading positions, not a promised price floor.
```

**Post 5/8 · 209 weighted characters**

```text
5/8 Inventory bonds sell OMR already held by the contract in exchange for ETH.

Discounts and sale sizes are bounded. The full OMR entitlement is reserved at purchase.

No mint authority. No promised sellback.
```

Asset: [06-inventory-bonds.png](png/06-inventory-bonds.png)

Alt text: Inventory bonds exchange ETH for already funded OMR inventory. The complete entitlement is reserved at purchase and vests over time. No mint authority or sellback guarantee.

**Post 6/8 · 229 weighted characters**

```text
6/8 Bond notes vest linearly and cannot be transferred.

Already vested claims remain available if new sales pause, inventory runs out or the oracle becomes unavailable.

The sale desk can close. Existing claims keep their terms.
```

**Post 7/8 · 248 weighted characters**

```text
7/8 Arbitrage uses the solver's ETH across two approved pools.

The atomic cycle must clear its profit threshold after swap fees, before gas. A fixed share goes to the reserve.

The solver budgets gas separately. Failed attempts can still cost gas.
```

Asset: [07-arbitrage.png](png/07-arbitrage.png)

Alt text: A solver-funded atomic ETH to OMR to ETH cycle through the canonical and an approved alternative pool. A fixed share of realized trading profit, before gas costs, funds the reserve. Failed attempts can cost gas.

**Post 8/8 · 253 weighted characters**

```text
8/8 The reserve desk has rules for spending, selling inventory and receiving realized arbitrage proceeds.

It still needs a funded release.

Market V2: built and tested locally. Not deployed or funded. No incentives are live from this build. @OmertaOnRH
```

### 03-turf-city — Control the Turf.

**Post 1/8 · 217 weighted characters**

```text
1/8 Control the Turf. Know what comes with it.

OMERTÀ Market V2 gives families rights to future funded LP fees. The liquidity principal stays outside family control.

Built and tested locally. Not deployed or funded.
```

Asset: [03-turf-city.png](png/03-turf-city.png)

Alt text: OMERTÀ Market V2. Control the Turf. A noir city model with district boundaries and family markers. Family fee rights, protocol-owned principal. Built and tested; not deployed.

**Post 2/8 · 236 weighted characters**

```text
2/8 Turf is a fixed price range for a defined season. Its fee source is bound before that season starts.

The contract records which family holds the future fee entitlement. A family holds the rights; the protocol retains the principal.
```

Asset: [08-fee-rights.png](png/08-fee-rights.png)

Alt text: Seasonal family fee entitlements are separate from liquidity principal. Families receive only their allocated funded LP fees and cannot remove the underlying capital.

**Post 3/8 · 221 weighted characters**

```text
3/8 A takeover starts with the books.

The contracts collect and account for accrued fees before future rights change hands. Historical fees stay with their recorded recipients.

A new flag does not rewrite an old ledger.
```

**Post 4/8 · 230 weighted characters**

```text
4/8 A siege has a deadline. Funded fees enter escrow, and the settlement rules divide what is actually there.

The defender and attacker recipients are frozen for that siege.

No outcome can award fees the contract never received.
```

**Post 5/8 · 240 weighted characters**

```text
5/8 Up to four families can share a Turf entitlement under predetermined shares.

Corridors, fortification and loyalty carry bounded game state. They cannot multiply the fee balance.

Politics can change the split. It cannot change the sum.
```

**Post 6/8 · 218 weighted characters**

```text
6/8 LP commitments put an actual canonical position NFT in custody for a finite term.

The original depositor can recover it at maturity even if rewards are exhausted, the oracle is stale or new commitments are paused.
```

**Post 7/8 · 240 weighted characters**

```text
7/8 Commitment accounting measures sampled useful depth over time, using distinct fresh observations.

Rewards require a prefunded campaign and available budget. Raw liquidity alone earns no claim.

A commitment creates no unfunded promise.
```

**Post 8/8 · 256 weighted characters**

```text
8/8 The settlement and custody contracts are built and tested locally. Not deployed or funded.

Production game integration remains ahead; this build activates no new Turf map or incentives.

The city has a treasury. Every claim needs an entry. @OmertaOnRH
```

## Standalone drafts

### s01-city-treasury · 209 weighted characters

```text
The city has a treasury.

OMERTÀ Market V2: seven capital compartments, funded inventory bonds and seasonal family fee rights.

Built and tested locally. Not deployed or funded.

The next chapter has a ledger.
```

Asset: [01-city-treasury.png](png/01-city-treasury.png)

Alt text: The city has a treasury. OMERTÀ Market V2 announcement, with a miniature noir city inside an open bank vault. Built and tested; not deployed.

### s02-tax-map · 227 weighted characters

```text
The canonical pool keeps its 9% base sell fee:
2% developer
1.6% RWA recipient
2.4% community
3% POL

A 0-1% extra sell surge funds stability. LP fees are separate.

OMERTÀ Market V2 is built and tested. Not deployed or funded.
```

Asset: [04-tax-map.png](png/04-tax-map.png)

Alt text: The 9% canonical base sell fee is split 2% developer, 1.6% RWA recipient, 2.4% community and 3% POL. An additional 0 to 1% sell surge goes to stability. LP fees are separate.

### s03-reserve-desk · 215 weighted characters

```text
An empty War Chest cannot place an order.

OMERTÀ Market V2 gives reserve operations finite inventory, fixed limits and cooldowns. Recovery requires actual funding.

Built and tested locally. Not deployed or funded.
```

Asset: [02-reserve-desk.png](png/02-reserve-desk.png)

Alt text: Capital with orders. A noir treasury desk representing seven distinct capital compartments and finite budgets. OMERTÀ Market V2 is built and tested, not deployed.

### s04-inventory-bonds · 230 weighted characters

```text
The bond desk sells what is already in the vault.

ETH buys a reserved claim on funded OMR inventory, vesting over time. No mint authority. No promised sellback.

OMERTÀ Market V2: built and tested locally. Not deployed or funded.
```

Asset: [06-inventory-bonds.png](png/06-inventory-bonds.png)

Alt text: Inventory bonds sell already funded OMR for ETH, reserve the full entitlement at purchase and release it through linear vesting. No minting or sellback guarantee.

### s05-arbitrage · 219 weighted characters

```text
Two pools. The solver's ETH. One atomic cycle.

OMERTÀ Market V2 routes a fixed share of realized trading profit, before gas, to the reserve. Competition still applies.

Built and tested locally. Not deployed or funded.
```

Asset: [07-arbitrage.png](png/07-arbitrage.png)

Alt text: Solver-funded ETH to OMR to ETH arbitrage through two approved pools, with a fixed reserve share of realized trading profit before gas and an on-chain profit threshold.

### s06-family-turf · 241 weighted characters

```text
A new flag does not rewrite an old ledger.

In OMERTÀ Market V2, a Turf takeover changes future funded LP fee rights. Historical fees stay with recorded recipients. Families cannot remove principal.

Built and tested. Not deployed or funded.
```

Asset: [03-turf-city.png](png/03-turf-city.png)

Alt text: Control the Turf. A noir city marked with family boundaries. Family fee rights are separate from protocol-owned liquidity principal. Built and tested; not deployed.

## Final publication check

Visual review completed on 2026-09-13: covers 01–03 were inspected individually, and infographic cards 04–08 were checked on their rendered contact sheet. The attached images match the mechanisms, status and alt descriptions in this copy. All eight referenced PNG files are present, and every attachment link resolves into `png/`.

Preserve the status line and the distinction between canonical sell fees and separate LP fees. If deployment or funding status changes, update the relevant evidence and copy together before publishing. This package does not authorize or perform publication.
