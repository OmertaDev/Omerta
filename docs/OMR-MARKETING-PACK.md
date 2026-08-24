# OMR marketing and distribution pack

Updated against the repository on 2026-08-24. This pack separates live game-ledger mechanics from dormant production-chain rails. It is marketing copy, not a promise of token price, yield, income, launch timing, or regulatory treatment.

## The positioning in one sentence

**OMR is the scarce coordination token inside a full mafia RPG: gameplay creates reasons to hold, commit, spend, steal, and recycle it, while issuance, buybacks, extraction, and the future RWA rail are bounded by code and conservation checks.**

## Canonical long-form explainer

People compare every treasury-adjacent token with Olympus in 2021. That is useful only if the comparison is precise.

Legacy OHM used rebasing rewards and discounted bonds to grow supply and treasury assets. OMERTÀ starts from a different question: what happens when the token sits underneath a persistent multiplayer economy instead of a staking dashboard?

OMR is not pitched as a decentralized reserve currency. It is the coordination token of a server-authoritative mafia RPG. Players need it for the Made ladder, family dues, access stakes, subscriptions, seals, intel, vanity, gear, the one-way Window, Brokers activation, and other enumerated uses. Loose OMR can be looted from a dead street. Committed OMR is safer, but never made untouchable. Demand is meant to come from what players do in the city.

The first structural difference is the separation between street cash and OMR. Cash pays for the operating economy: jobs, rackets, businesses, heists, loans, kitchens, convoys, the casino, and the track. There is no general cash-to-OMR conversion route. The Window goes the other way only: it accepts OMR for cash at a published rate when its funded till can cover the redemption. If the till is short, the transaction refuses and takes no OMR. Grinding the game therefore cannot be converted into unlimited token supply.

The second difference is supply discipline. The ERC-20 contract begins with a 100 million OMR founding mint to the treasury Safe. It has no owner mint. OmertaBond is the only contract allowed to mint additional OMR, and it sits behind four independent walls: a daily issuance cap, a compile-time 20% discount ceiling, a TWAP oracle that fails closed when missing, stale, or invalid, and an absolute OMR-per-ETH rate wall. The treasury can permanently end that mint path by setting the minter to the zero address.

The game itself has no time-based OMR wage, inflationary APY, or drip. One-time missions and prize credits are enumerated on the server ledger and must be funded; they do not call the ERC-20 mint. Contract staking, if offered and funded, pays from a pre-loaded reward pool. That is redistribution of tokens already present, not a hidden reward printer.

The third difference is what happens when OMR is spent. Most house sinks do not burn it. They return the same amount to Desk inventory through one shared ledger hook. The Desk can sell only what is on its shelf. Its daily Dutch auction starts above the market, decays toward the reserve at the upper band edge, and caps the base lot at 1% of player float per day. Under the defined upper-band condition, the hard ceiling can rise to 3%. Unsold inventory rolls forward. ETH proceeds split between protocol-owned liquidity and operations.

That changes the core metric from burn count to **return velocity**: how often the same token can come home through a real revenue event. A burn is terminal. A recycled token can be used, spent, auctioned, and used again. Withdrawal is deliberately excluded from recycling because it leaves the game ledger for the chain.

The fourth difference is the money router. Every supported real-value inflow has a declared source and permitted destinations: the vig, treasury, community pool, operations, protocol-owned liquidity, or the Desk buyback budget. The published map covers gameplay fees, Store receipts, reserve bonds, the one-layer sell tax, Desk auction proceeds, POL trading fees, Bank harvest fees, and exit tolls. The router describes and verifies the accounting; it is not a discretionary wallet.

Three separate buybacks sit downstream:

- **The vig buyback** can spend no more than arrived vig revenue. Purchased OMR funds the withdrawal reserve and the backed prize pool.
- **The Desk buyback** can spend no more than its POL-fee budget and acts only below the defined band. Purchased OMR returns to the shelf.
- **The community buyback** can spend no more than arrived community revenue. Purchased OMR enters the family pool and is split by current seasonal standing.

Each executor requires transaction proof, price-continuity or fat-finger walls, and reconciliation. The root rule is simple: a buyback cannot outrun the revenue behind it.

The fifth difference is extraction. The production rail is not live today. The code is built and devnet-proven, but production remains chain-unconfigured until the audit and launch checklist clear.

When armed, withdrawal will not be a server promise. Vig revenue must first buy real OMR into the funded reserve. A request can receive an EIP-712 claim voucher only when the amount already committed plus the new request is no greater than funded OMR. A short reserve queues. Claiming a voucher does not reopen capacity, because those tokens have already left the game. In plain English: extraction cannot exceed arrived backing by construction.

The future RWA rail uses the same conservation pattern. Families vote one allowed stock ticker as a gameplay decision. A walled keeper can spend arrived treasury revenue to acquire tokenized stock. Allocation uses frozen, deterministic activity weights; idle capital receives nothing. StockVault can deliver only units already held and allocated, into a Street Deed's token-bound account. What remains in that account follows the deed, although its owner can drain it before transferring the deed. This rail is also dormant until the legal, audit, and launch gates clear.

None of this makes OMR immune to market risk. Code walls reduce specific failure modes; they do not guarantee demand, liquidity, price, or execution quality. The sharper claim is also the more defensible one:

**OMR removes the direct gameplay printer, severs cash farming from token acquisition, recycles house sinks into bounded revenue, roots buybacks in arrived inflows, and refuses to sign extraction or RWA delivery before reserves exist. The thing built on top is not a staking dashboard. It is a live mafia RPG.**

## Technical X thread — 12 posts

**1/** The useful comparison is not “OMR is the next OHM.” It is: which 2021 treasury-token failure modes does OMERTÀ remove in code, and which risks still remain?

Here is the full mechanism map.

**2/** OMR is a game token first. A full mafia RPG creates reasons to hold, commit, spend, steal, and recycle it: the Made ladder, dues, access stakes, seals, intel, gear, the Window, Brokers activation, and more.

Demand is the game. Not a displayed APY.

**3/** Street cash and OMR are severed.

Cash runs jobs, rackets, kitchens, heists, loans, convoys, the casino, and the track. There is no general cash → OMR route. The Window is one-way and funded: OMR → cash, or the transaction refuses.

Grinding cannot become a token printer.

**4/** Supply is explicit.

100M OMR founding mint to the treasury Safe. No owner mint. OmertaBond is the only additional minter, behind:

- daily cap
- 20% discount ceiling
- fail-closed TWAP
- absolute rate wall

The minter can be set to zero.

**5/** “No APY” is too sloppy. The accurate claim is stronger:

The game has no time-based OMR wage, inflationary yield, or drip. Contract staking rewards, if funded, come from a pre-loaded pool. Redistribution, not minting.

**6/** House sinks recycle.

Spend OMR on supported game uses and one shared ledger hook returns it to Desk inventory. The Desk can sell only shelf stock in a bounded daily Dutch auction. Withdrawal is excluded because it leaves the game.

**7/** The KPI is return velocity.

A burn records one terminal event. A recycled token can return through another use and another revenue event. The question is not “how much vanished?” It is “how productively did the float circulate?”

**8/** Real-value inflows follow a declared router: vig, treasury, community, operations, POL, and the Desk buyback budget. The map covers fees, Store receipts, bonds, the one-layer sell tax, Desk proceeds, POL fees, Bank harvest fees, and exit tolls.

**9/** Three buybacks. Three root caps.

- vig spend ≤ vig revenue
- Desk spend ≤ POL-fee budget
- community spend ≤ community revenue

All require proof of spend, price walls, and reconciliation. A buyback cannot outrun its source.

**10/** Extraction is full-reserve, not rhetorical.

Vig revenue buys OMR first. A withdrawal voucher can sign only when:

`committed outstanding + request ≤ funded OMR`

A short reserve queues.

**11/** The RWA rail uses the same pattern: arrived treasury revenue → walled keeper buy → held stock ≥ allocation ≥ delivery. Active play gets deterministic weight; idle capital gets nothing.

Production extraction and RWA delivery are dormant pending audit + launch gates.

**12/** OMR does not remove market risk. It removes specific structural shortcuts:

- no gameplay printer
- no cash-farm conversion pipe
- no unbacked extraction signature
- no revenue-free buyback
- no hidden launch-state claim

Then it puts a mafia RPG on top.

Ledger, contracts, and system maps: **omerta.fun/wiki#economy**

## Punchy X thread — 6 posts

**1/** OMR is not “OHM with better parameters.” It changes the control surface.

The token sits inside a mafia RPG, not on top of an APY dashboard.

**2/** Cash runs the streets. OMR runs status, access, coordination, and extraction.

Cash cannot become OMR through the game. Farming the RPG cannot inflate the token.

**3/** No gameplay wage. No inflationary staking drip.

The contract has one extra mint path: OmertaBond, bounded by a daily cap, discount ceiling, fail-closed TWAP, and absolute rate wall.

**4/** Spend OMR and most house sinks return it to the Desk. The Desk auctions only collected inventory.

That is return velocity: one token, multiple real revenue events.

**5/** Three buybacks, each capped by the revenue behind it. Full-reserve extraction signs only after OMR arrives. The RWA keeper can allocate and deliver only stock already held.

**6/** No price promise. No claim that dormant rails are live.

Just a public ledger, explicit launch states, and a full mafia economy designed so the books have to balance.

**omerta.fun/wiki#economy**

## Gamer-first version

OMR is the chip that makes the city personal.

You can hold it to climb the ladder, commit it for access, spend it on status and intel, put it behind a family, or carry it loose and risk losing part of it when somebody puts you in the ground.

What you cannot do is grind street cash and turn it into OMR. The economies are intentionally severed. Cash runs the business. OMR marks the stakes.

When the house takes OMR, most of it is not deleted for a screenshot. It goes back to the Desk, where only collected inventory can be auctioned into the city again. The same token can become useful, dangerous, and valuable to the game more than once.

The production extraction rail is not open yet. When it is armed, the server will be unable to sign more OMR out than real revenue has already bought into reserve.

Build a street. Join a family. Carry only what you can defend.

## Builder / agent version

OMERTÀ exposes a JSON API, stable error codes, idempotent mutations, public rules, and a ledgered two-asset economy.

For an autonomous player, OMR is not a faucet reward. The EV comes from running the game better: deterministic arbitrage, lazy-accrual businesses, convoy timing, loan pricing, contract fulfillment, family coordination, and the funded daily pools. Cash cannot be converted into OMR, so the agent's economic advantage does not become an inflation route.

The accounting surfaces are inspectable: sink reasons, Desk inventory, auction caps, router destinations, buyback budgets, funded extraction reserve, and dormant chain state. Poll `/v1/opportunities`; verify the rules at `/v1/rules`; inspect the contract and ledger model in the Codex.

## Landing-page copy variations

### A — mechanism-led

**THE TOKEN THE GAME CANNOT PRINT**

Street cash runs the city. OMR runs status, access, families, the Desk, and the extraction rail. No cash conversion pipe. No inflationary gameplay APY. Every supported sink, buyback, and withdrawal route has a named source and a hard boundary.

CTA: **SEE THE MONEY MAP**

### B — game-led

**A MAFIA RPG WITH SOMETHING REAL TO LOSE**

Build a street. Hold OMR for access and standing. Carry it loose and it can be looted. Spend it and most house sinks return it to the Desk to circulate again. The city creates the demand; the ledger keeps the score.

CTA: **ENTER THE CITY**

### C — proof-led

**DON'T TRUST THE FLYWHEEL. TRACE IT.**

One public ledger. One bounded contract minter. Three revenue-rooted buybacks. Full-reserve extraction that refuses to sign before OMR arrives. Every dormant rail labeled before launch.

CTA: **CHECK THE MECHANISM**

## Headlines and hooks

1. One token. Two ledgers. No hidden pipe.
2. Burn once, or earn repeatedly?
3. The game creates demand. The game does not mint.
4. Every dollar has a declared desk.
5. The reserve cannot write an IOU.
6. A buyback that outruns revenue is an ad. This one reverts.
7. The same token can come home twice.
8. No cash farm. No conversion pipe. No inflationary drip.
9. A treasury token with a whole city on top.
10. Don't trust the flywheel. Trace it.
11. Full-reserve means the signature waits for the reserve.
12. What OHM taught. What OMR changed.

## Short captions

- OMR has no gameplay printer. The contract's only additional mint is the bounded bond path. Everything else is transfer, purchase, allocation, or recycle.
- Most token projects celebrate burns. OMERTÀ tracks return velocity: how often the same OMR comes back through a real use and a real revenue event.
- Cash cannot buy OMR inside the game. That single severance prevents the most obvious farm → convert → dump loop.
- Three buybacks, three revenue roots. Vig, Desk, and community can spend only what their source already earned.
- Production extraction is dormant. When armed, it signs only against OMR already purchased into the reserve.
- The RWA arc is built as held ≥ allocated ≥ delivered. Voting picks the ticker; it does not manufacture the stock.

## FAQ / objection replies

**“So there is zero minting?”**
No. The accurate claim is narrower: gameplay does not mint ERC-20 OMR on a schedule. The contract begins with a 100M founding mint, and OmertaBond is the only additional mint path. It is bounded by four code walls.

**“Does staking pay APY?”**
The game Vault pays no inflationary yield. The separate contract staking design can pay only from a funded reward pool. If the pool is dry, rewards do not materialize.

**“Are sinks burns?”**
Most are not. Supported house sinks credit the same amount to Desk inventory. Withdrawal is excluded because it exits the game ledger.

**“Can I grind cash and buy OMR?”**
Not through the game. Cash has no general conversion path into OMR. The Window goes OMR → cash only and refuses when its funded till is short.

**“Are buybacks guaranteed?”**
No. They require actual source revenue, execution proof, price walls, and configured keepers. The invariant is a maximum spend, not a promise of constant buying.

**“Is extraction live?”**
No. The rail is built and devnet-proven, but production is chain-unconfigured and dormant pending audit and launch gates.

**“Does a Street Deed force the RWA book to travel with it?”**
Assets remaining in its token-bound account travel with the deed. The current owner can drain the account before transfer, so market copy must not imply an undrainable bundled book.

**“Does any of this guarantee price?”**
No. Mechanism design can remove specific reflexive paths. It cannot guarantee demand, liquidity, price, keeper execution, contract safety, or regulatory outcomes.

## Distribution notes

| Surface | Lead asset | Copy |
|---|---|---|
| Landing page | Sheet 01 | Landing variation A or C |
| Codex | Full 5-sheet series | Canonical explainer |
| X launch thread | Sheets 01–05 in order | 12-post technical thread |
| X recurring education | One sheet per post | Short captions |
| Farcaster | Sheet 02 or 03 | Punchy 6-post thread, compressed to one cast + replies |
| Discord / Telegram | Sheet 01 + Codex link | Gamer-first version |
| Agent / developer outreach | Sheet 03 | Builder / agent version |
| Due-diligence reply | Sheet 05 | FAQ answers + source links |

## Claim discipline and primary sources

Repository anchors:

- `omerta-contracts/src/OMR.sol` — founding supply and sole minter slot
- `omerta-contracts/src/OmertaBond.sol` — daily cap, discount ceiling, TWAP and absolute rate wall
- `omerta-contracts/src/OMRStaking.sol` — funded reward pool
- `src/invariants.js` — enumerated game-ledger credit reasons
- `src/rules.tail.js` and `src/game.js` — Desk sink list and automatic inventory credit
- `src/router.js` — revenue sources and destinations
- `src/chain.js` — buybacks, withdrawal queue, vouchers, reserve accounting and RWA keeper

External primary sources for the historical comparison:

- Olympus legacy staking: <https://docs.olympusdao.finance/main/legacy/staking>
- Olympus legacy bond mechanics: <https://docs.olympusdao.finance/main/legacy/bonding>
- Olympus legacy supply equations: <https://docs.olympusdao.finance/main/contracts-old/equations>
- Robinhood Chain connection docs: <https://docs.robinhood.com/chain/connecting/>

Always keep these statements intact:

1. “Legacy 2021 Olympus mechanics,” not “Olympus today.”
2. “No gameplay mint schedule,” not “OMR can never mint.”
3. “Funded-pool staking,” not “guaranteed APY.”
4. “Revenue-bounded buybacks,” not “continuous price support.”
5. “Built and devnet-proven; production dormant,” until production evidence changes.
6. “Assets remaining in the Street Deed account follow the deed,” not “the book can never be removed.”
7. “Designed for Robinhood Chain,” until the production deployment is configured and independently verifiable.
