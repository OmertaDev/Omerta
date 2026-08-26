# THE $OMR MACHINE — campaign copy

**Companion asset:** `public/art/omr-06-the-omr-machine-1080x1350.png`
**Editable source:** `docs/diagrams/omr-06-the-omr-machine-1080x1350.excalidraw`

This copy is intentionally explicit about launch state. The founder-signed go-live waterfall is published
in `deploy/fee-splits.json`, but it is not armed while production chain rails remain dormant. The extraction
and Stock Machine contracts are built and tested; production delivery waits on the audit and launch gates.

---

## Long-form explainer

The simplest way to think about **$OMR**:

OMERTÀ is a full mafia RPG with a token the game cannot farm into existence—and an economic machine designed
to make the same token come home as revenue more than once.

It is **not** a reserve-currency share. There is no claimed $1 floor, no NAV, and no inflationary rebasing APY.

Two rules sit at the center:

1. **Street cash can never become $OMR.** The game’s cash economy and token economy are deliberately severed.
2. **The extraction rail cannot sign more $OMR than real revenue has already bought and placed in reserve.**

That distinction matters. A reserve fund tries to defend the value of every token with a balance sheet. OMERTÀ
does something different: it keeps the game from printing sell pressure, then uses real activity to buy tokens,
recycle sinks, deepen liquidity, fund family competition, and—after the launch gates clear—buy tokenized stocks
for the people who actually played.

Here is how the machine works.

### 1. No time-based token faucet

Nothing you grind on a clock mints $OMR into existence. There is no wage, no drip, and no in-game staking yield.
The on-chain staking contract, if funded, can only redistribute a pre-loaded reward pool; it cannot mint rewards.

The game ledger has a small, enumerated surface: finite career awards, a tiny daily completion award, player-to-player
payments, loot, and payouts from pools that were funded first. A nightly conservation sweep checks that nothing else
appeared.

The only ERC-20 mint path is the **Reserve Bond**. Deposit ETH; receive discounted $OMR that vests over five days.
That mint is bounded by an on-chain daily cap, a compile-time 20% maximum discount, a fail-closed TWAP, an absolute
post-discount rate ceiling, and Safe controls. A bad rate or stale oracle does not “use the last good price.” It reverts.

So the system can sell a bounded amount of new supply for real ETH. The game itself cannot farm supply against hype.

### 2. Real value enters through declared pipes

OMERTÀ publishes where each dollar goes. The founder-signed **go-live configuration**—published now, armed only when
the production chain gates clear—is:

- **Gameplay fees and Store receipts:** 25% Vig, 10% treasury, 15% community, 50% operations.
- **Reserve Bond principal:** 75% protocol-owned liquidity, 5% Vig, 5% treasury, 15% operations.
- **Every DEX sell:** a 9% sell-only tax, split as 2% operations, 1.6% treasury, 2.4% community, and 3% liquidity.
  Buys and ordinary wallet transfers are not taxed.
- **POL trading fees:** 75% funds the Desk’s below-band buyback; 25% is diverted to the Vig.
- **Desk auction ETH:** 50% protocol-owned liquidity, 50% operations.

Those are not marketing percentages typed into a graphic. They are the signed deployment artifact translated into
the backend and contract arguments, with a validator that refuses a split that does not reconcile.

### 3. The Vig buys backing before the exit

The Vig spends only ETH that actually arrived. Its root invariant is simple:

**buyback spend ≤ recorded real revenue**

The bought $OMR then splits **50/50**:

- 50% funds the withdrawal reserve.
- 50% funds the prize pool.

A comp or QA call can record what was attempted, but it books zero spendable revenue and zero reserve credit. A
buyback price must be positive and remain inside continuity walls. The nightly monitor reconciles arrived ETH,
buyback spend, $OMR purchased, the reserve, prize payments, and the withdrawal queue.

When production extraction opens, a withdrawal pays a flat **2% toll**. Fresh $OMR also pays an early-exit surcharge:
**50% at hour zero, declining linearly to 0% at hour 48**. The server signs only when the reserve can back the net
amount. If the reserve is thin, the request queues. It does not become an unsecured IOU.

That is the actual backing claim: not “one token equals one dollar,” but **one signed exit never exceeds arrived reserve**.

### 4. Sinks recycle instead of disappearing

Most token systems treat a burn as the end of the story. OMERTÀ treats an in-game sink as inventory returning to the
house.

Made dues, the Wire, Broker activation, estates, vanity, auctions, jury payments, the Window, and the rest of the
enumerated $OMR sink vocabulary send tokens to **the Desk’s shelf**. Chain withdrawal is the one deliberate exception;
recycling a withdrawn token would count it twice.

Once a day, the Desk offers returned inventory in a six-hour descending auction. It opens at **1.5×** the 30-day
anchor and falls to the sell edge at **1.0×**. The ordinary lot cannot exceed the tokens that returned, the shelf
balance, or **1% of player float**. A formulaic upper leg can expand the clip in genuine premium conditions, but a
hard wall stops it at **3% of float**.

Below **0.8×** the anchor, the other side of the Desk activates: POL trading fees buy $OMR from the open market and
restock the shelf. No POL fees, no buyback. No usable price, no trade. The Desk never mints inventory.

That makes the KPI **return velocity**: how many times the same token can be bought, used, returned, and sold again.
A one-time burn can create one economic event. A recycled sink can create a permanent revenue loop.

### 5. Holding is commitment, not yield

In-game staking pays no yield. It changes the risk and utility of the balance.

An idle or unbonding balance is highly exposed: a successful killer can take **50%**. A staked balance is still
lootable, but at **20%**. A player can also commit stake for **7, 30, or 90 days**, making it count **×1.25, ×1.5,
or ×2** toward the Made Ladder while the principal remains locked and loot-exposed.

The reward is access, capacity, status, and cheaper exposure—not newly printed tokens.

### 6. Activity can build a real stock book

The treasury share is separate from the withdrawal reserve. At go-live, its signed inputs are **10% of gameplay
fees, 10% of Store receipts, 5% of bond principal, and 1.6% of DEX sell gross**.

The Commission chooses one approved Robinhood Stock Token each day. The ballot cannot type an arbitrary contract
address: candidates come from a Safe-owned on-chain registry. After the day closes, the keeper buys the exact
committed asset. It cannot silently substitute another ticker. A stale, halted, inactive, or price-discontinuous
asset causes a named skip and the ETH remains bounded in treasury.

Distribution is deterministic and play-weighted:

- Broker activation lasts 30 days and costs 150 / 450 / 1,200 / 3,000 / 9,000 $OMR for ×1 / ×1.5 / ×2 / ×2.5 /
  ×3 weight.
- The allocation epoch is seven days.
- A human account must play across at least three distinct activity tracks and score at least 25.
- After that gate, activity weight is linear and uncapped. An idler receives zero. Agent and NPC accounts are excluded.
- Bought units are allocated only after the purchase exists, checked per ticker with `allocated ≤ held`.
- Delivery waits for an extracted Street Deed, then lands in that deed’s ERC-6551 vault. The allocation does not expire.

The Stock Machine is built, but its production purchase and delivery legs remain off until the audit, launch, venue,
reserve, Safe, and legal-review gates clear. OMERTÀ does not claim stock delivery is live before it is.

### Takeaway

Most tokens run one reflexive loop:

**attention → price → more attention**

$OMR adds a game and a set of hard boundaries underneath it:

- Play cannot schedule-mint the token.
- Cash cannot convert into the token.
- Real revenue funds buybacks.
- In-game sinks become recurring Desk inventory.
- POL fees buy below the band.
- Treasury activity can buy approved tokenized stocks for active human players.
- Extraction cannot outrun the reserve that arrived first.

No price target. No floor promise. No yield promise. The demand is the game; the defense is code-bounded recycling.

**Play. Pay. Buy back. Recycle. Build the book. Repeat.**

NFA. DYOR. The production chain rails are not live yet.

---

## X / Farcaster thread version

**1/** The simplest way to think about $OMR:

A mafia RPG token the game cannot farm into existence.

No $1 floor. No NAV. No emission APY. Revenue buys it back, sinks send it home, and extraction cannot outrun arrived reserve.

**2/** Rule one: street cash can never become $OMR.

There is no swap, laundering rail, or farm→convert→dump pipe. Grind makes you rich in the city; it does not print token sell pressure.

**3/** The only ERC-20 mint is the Reserve Bond: ETH in, discounted $OMR out over a five-day vest.

Daily cap. 20% max discount. Fail-closed TWAP. Absolute rate wall. Bad quote or stale oracle = revert.

**4/** Signed go-live routing:

- Fees + Store: 25% Vig / 10% treasury / 15% community / 50% ops
- Bonds: 75% POL / 5% Vig / 5% treasury / 15% ops
- Sells: 9% total = 2% ops / 1.6% treasury / 2.4% community / 3% LP

Published. Not armed while production chain rails are dormant.

**5/** The Vig can spend only arrived real revenue.

Bought $OMR splits 50/50: withdrawal reserve and prize pool. If the reserve cannot back an exit, the request queues. The server does not sign an unsecured promise.

**6/** In-game $OMR sinks do not disappear. They return to the Desk.

Daily six-hour Dutch auction. Base lot ≤ returned tokens, shelf inventory, and 1% of float. Genuine premium can scale it, but never beyond 3% of float.

**7/** Below 0.8× the 30-day anchor, POL trading fees buy $OMR and restock the shelf.

No earned fees, no buyback. No fresh price, no trade. No inventory mint.

The KPI is return velocity, not burn count.

**8/** Staking is commitment, not yield.

7/30/90-day commitments count ×1.25/×1.5/×2 toward the Made Ladder. Staked balances are still lootable: 20% versus 50% idle. In-game staking yield: 0; the contract cannot mint staking rewards.

**9/** The Stock Machine converts a separate treasury slice into approved Robinhood Stock Tokens.

Families vote daily. Active humans qualify through ≥3 activity tracks and score ≥25. Weight is linear and uncapped. Units follow the player into an extracted Street Deed vault.

**10/** Honest status:

Extraction and stock purchase/delivery are built but production-dormant until audit and launch gates clear.

No price promise. No floor promise. No yield promise.

Demand is the game. Defense is code-bounded recycling.

---

## Short variants

### Single post

$OMR is not a reserve-currency share. No $1 floor, no NAV, no emission APY.

It is the currency of a mafia RPG where cash cannot buy the token, play cannot schedule-mint it, real revenue funds buybacks, in-game sinks return to a daily Desk auction, and extraction cannot exceed the reserve already bought.

Demand is the game. Defense is code-bounded recycling. Production chain rails remain audit- and launch-gated.

### Telegram / Discord

The $OMR machine in one sentence: **play cannot print it, cash cannot convert into it, revenue buys it back,
sinks recycle it, and the exit cannot outrun arrived reserve.**

At go-live, the signed router sends fees and Store ETH 25% to the Vig, 10% to treasury, 15% to community,
and 50% to operations; bonds stay POL-heavy at 75%; every sell pays 9% across operations, treasury,
community, and LP depth. Bought $OMR funds reserve + prizes 50/50. Treasury can buy approved Stock Tokens
for active humans; Desk inventory can return repeatedly instead of burning once.

The production extraction and stock-delivery rails are built but not live until the audit and launch gates clear.

### Graphic caption

**THE $OMR MACHINE**

No $1 floor. No NAV. No emission APY.

Cash never becomes $OMR. Real revenue buys it back. Sinks go to the Desk. Active play can build the Stock
Machine’s book. Extraction signs only against arrived reserve.

Open the code-anchored map: **omerta.fun/wiki#economy**
