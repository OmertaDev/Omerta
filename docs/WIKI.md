# OMERTÀ — The Codex

This is the knowledge base for OMERTÀ, a multiplayer crime game. It describes every system, every gameplay
loop, and every important number. This is the source text. The game shows the same content at **`/wiki`** (the
CODEX button in the top bar).

> **How to read this document.** The numbers are the current settings. They can change.
> The routes start with `/v1/…`. A route needs a character with a login, unless the route has the mark
> **[public]**, **[mod]**, or **[chain]**.
> "Level N" is the character level. The level comes from respect: `level = floor(sqrt(respect/10)) + 1` — L5 ≈ 160 respect, L10 ≈ 810, L20 ≈ 3,610.

---

## Table of contents
1. [The core loop](#1-the-core-loop) · 2. [Your character, death & the heir](#2-your-character-death--the-heir) ·
3. [Cars, guns & gear](#3-cars-guns--gear) · 4. [The city & the living world](#4-the-city--the-living-world) ·
5. [The economy — $OMR, cash, the window](#5-the-economy) · 6. [The Kitchen](#6-the-kitchen) ·
7. [Businesses & fronts](#7-businesses--fronts) · 8. [Territory rackets](#8-territory-rackets) ·
9. [Families](#9-families) · 10. [The Commission](#10-the-commission) · 11. [The Den (casino)](#11-the-den) ·
12. [The Speakeasy](#12-the-speakeasy) · 13. [The Fights (boxing)](#13-the-fights) ·
14. [PvP — jumps, hits & contracts](#14-pvp) · 15. [Make risk pay — loot, safehouse, revive](#15-make-risk-pay) ·
16. [The Law & RICO](#16-the-law--rico) · 17. [The Pen (prison)](#17-the-pen) ·
18. [Loan sharking](#18-loan-sharking) · 19. [Convoys](#19-convoys) · 20. [Crew heists](#20-crew-heists) ·
21. [The Black Market](#21-the-black-market) · 22. [Vendettas](#22-vendettas) · 23. [Skills](#23-skills) ·
24. [The Underworld (fixers)](#24-the-underworld) · 25. [The Wire](#25-the-wire) ·
26. [The Store & the Season Pass](#26-the-store--the-ledger) · 27. [Going Legit — what your $OMR does](#27-going-legit) ·
28. [The Estate & Auction House](#28-the-estate--auction-house) · 29. [The chain — withdrawal & bonds](#29-the-chain) ·
30. [Growth — paths, missions, first week](#30-growth) ·
30a. [The Megaproject](#30a-the-megaproject-the-city-builds-a-monument) ·
30a2. [Duels, Clue Scrolls & the Season](#30a2-the-dueling-circuit-clue-scrolls--the-season) ·
30a3. [The deferred four](#30a3-the-deferred-four-the-household-the-motion-the-house-window--ring-poker) ·
30b. [The Cellphone & the Troll Box](#30b-the-cellphone--the-troll-box-talking) ·
30c. [Street Life — the corner, the black book, the call](#30c-street-life--the-corner-the-black-book-the-call) ·
31. [Reference — districts, gotchas, glossary](#31-reference)

---

## 1. The core loop

You start as a new player in the Docks district. You have $500 and no reputation. The main loop is: **do jobs
to earn cash. Train your stats. Put your cash in the bank. Set up income sources that pay you while you are
away. Increase your level.**

**Crimes** (`POST /v1/crimes/:id`) — there are 43 jobs. The first job is Pickpocket (L1, 2 nerve, $40–120). The
last job is Empty the Federal Depository (L110, 35 nerve, $160k–400k). Each job has a level requirement, a
nerve cost, a cash range, and a chance of jail if you fail. Your success rate increases with your **cunning**
and **speed**, your family level, some districts, and your rank. A job can also give you **contraband crates**
(you use these to buy guns and to make gear) and **makings** (ingredients for the Kitchen).

**Every job has a mark, and the money comes off them.** A crime names a victim drawn from the NPC
residents standing in your district. When that mark has money on them, THE TAKE moves it: the cash
you earn is transferred off their pocket (up to 25% of it per job) and only the shortfall is created
by the game. So a job on a busy street is a robbery with a name on it; a job on an empty one still
pays exactly the same, it just comes from nowhere. Marks are always NPC residents — a real player is
never robbed by a stranger's crime roll, because they would get no warning and no way to answer.
Taking from a real player is what the PvP asset crimes are for (rob a front, steal a car, mug their
trunk), and those always tell the victim who did it.

**Energy and nerve** power your actions. They increase again with time. The game does not use a global clock;
your resources increase when you do an action. Energy powers crimes and training. Nerve powers the more
dangerous actions. **Heat** is the police attention that crime causes. Too much heat starts a police case (see
section 16).

**Train** (`POST /v1/train/:stat`) — one training session costs 10 energy. You can train muscle, cunning, or
speed. The increase becomes smaller as the stat becomes higher. **Heal** (`POST /v1/heal`) — you pay cash to
return to full health. The cost increases with your injury. **Check in** (`POST /v1/checkin`) — do this one
time each day. A daily streak pays `250×lvl + 100×lvl×min(streak,7)` plus 20 energy.

**The Bank** (`POST /v1/bank/deposit|withdraw`) — **another player who kills you can steal the cash in your
pocket. They cannot touch your bank.** (The bank stops your *killer*; it does not survive your death — see
"What is safest when you die".) But a new deposit is **"in transit" for 2 hours** before it is safe.
Another player can steal it during this time. A new deposit resets the 2-hour clock. The bank pays about 2%
interest each 12 hours. The interest has a limit (12 hours of interest each day). The interest is smaller
above $10M. **You cannot use the bank from a safehouse.**

**Travel** (`POST /v1/travel/:district`) — travel between the 6 districts costs $250. You cannot travel from
jail.

**Important limits:** jail stops almost all actions. Energy and nerve limit crimes and training. A safehouse
stops your own attacks and your money movements. A safehouse is a shield, not a base.

---

## 2. Your character, death & the heir

Each account has one living character. You start at Level 1 (respect 0). You have 50 energy, 10 nerve, 100
health, and $500. Your muscle, cunning, and speed are a server-rolled 15-point spread, each at least 3. You
start in the Docks district.

**Respect, level, and rank.** Respect is your experience. Your level comes from your respect. The **RANKS**
ladder gives you benefits at each level: L10 Hustler (+5% crime pay), L22 Runner (+1 energy increase), L35
Enforcer (+5 attack), L50 Associate (10% cheaper healing), L65 Soldier (a made man, −20% jail), L80 Capo (+1
nerve increase), L95 Underboss (+10% racket and business income), L110 Mob Boss, L125 Don of the City.

**Effective stats** = your trained stats + gear increases + asset increases. **Firepower (fp)** comes from
the gun you carry. You need 50 fp or more to make a lethal attack.

**Death and the estate (section 7.9).** A lethal attack starts the **estate** process in one step. **The
character dies, but your account does not die.** An heir is born. The heir is a new character (generation
+1). **These are lost when the character dies:** pocket and bank cash, stats, skills, businesses, the
speakeasy, the Kitchen crew, the boxing fighter, control of territory operations, and this season's kills.
**These pass to the heir:** the remaining $OMR after the game's loot and death rules, prestige, the
**Estate**, deeds, the Store **patron/pass** benefit, minted status, revive tokens, account-level legends,
and 25% of your **Underworld** standings.

**Prestige and seasons.** A season is 28 days. At the end of a season, your level converts to **prestige**
(`floor(level/2)`). Your respect returns to 0.
You can **respec** your stats for 90 $OMR (`POST /v1/respec`). This has a 24-hour cooldown that it shares with
skills.

Routes: `POST /v1/character` (create — the name is 2–24 characters and must be unique among living characters;
you can add `referralCode`), `GET /v1/me`, `GET /v1/session` [public probe], `POST /v1/respec`.

---

## 3. Cars, guns & gear

**Cars and the Garage** (limit 12). There are 60 car models. The cheapest is a County Auction Junker ($900).
The most expensive is The Tsarina's Ghost ($400k). Each car has a chance of being stolen, a scrap value, and a
book value. A **trim** (Rusted to Coachbuilt) increases all three values.
- **Boost** (`POST /v1/garage/boost`) — steal a random car. This has a 5-minute cooldown.
- **Melt** (`POST /v1/garage/:carId/melt`) — scrap a car for ammo. 25% of the ammo goes to your family.
- **Fence** (`/fence`) and **Repair** (`/repair`) — sell a car for cash, or repair its damage.

**RARITY, AND THE WAY OFF THE BOARD (the rarity NFTs).** Every car and boat carries a rarity —
Common, Rare, Legendary, Epic — rolled by the server the moment you EARN it, and logged so the draw
can be checked. Rarity has bounded utility: Rare / Legendary / Epic add **3% / 6% / 10%** to a car's
chassis contribution to race power, or to a boat's base hold and speed. It does not multiply driver
stats, tuning, naval upgrades, resale/book value, or melt yield.

You can buy your way up the ladder with $OMR (`POST /v1/nft/:kind/:id/upgrade`), and the price buys
exactly the next tier — a known item for a known price, never a roll. That is how the upgrade is built
today. (The old game-wide "nothing sells a random outcome for money" rule was retired by the founder on
2026-08-21 — any future product that does sell one will carry its own published odds, stated before you pay.)

Once the production rail opens, you can also take one **ON-CHAIN**
(`POST /v1/nft/:kind/:id/withdraw`, on the same rail gear uses). The tradeoff is:

> **In-game items are lootable. Extracted NFTs are safe, and inert.**

An extracted car is an ERC-1155 in your own wallet. Nobody can steal it, win it in a pink-slip race,
chop it off your corpse or take it in a war — and it **survives your death**, passing down the
bloodline. In exchange it never races, hauls, melts, fences or earns again while it stays on-chain.
The door swings both ways: whoever **holds** the NFT — you, or whoever bought it on a marketplace —
can **burn it (redeem)** from their wallet, and the real thing comes back into play on *their*
account, fresh and stock (tune, trim and damage do not make the trip). Gear makes the same round
trip: burn a gear NFT and the class joins the burner's account — unless they already run the
in-game copy, in which case the burn waits until that copy extracts or is lost. You must be MADE to take anything
on-chain (the same gate as a $OMR withdrawal); a free-trial street plays the whole game and extracts
nothing.
- You cannot melt, fence, or repair a car that is **listed** on the market or **pledged** as loan collateral.

**Guns and the Armory.** There are 15 guns. The cheapest is a Rusty .25 ($800, fp3). The most powerful is the
Long-Case 'Undertaker' ($400k, fp60). Each gun costs cash and crates. **Vests** (bought with $OMR) increase
your chance to survive. Routes: `POST /v1/armory/gun/:id/buy`, `/equip`, `/unequip`, `/armory/vest/:id`,
`/armory/ammo`. Ammo costs $2000 for 50 rounds. **The price of ammo is never reduced. Ammo controls the cost
of a kill.**

**Gear** (about 50 items, from Common to Legendary, priced in $OMR) increases your stats. The built chain
rail can represent extracted gear as a tradeable NFT (the GearVault system, section 29). When a player kills
you with a fire attack, they have a **15% chance to take one piece of your in-game gear.** Extracted gear is
safe but inert. **Production extraction is dormant**, so gear cannot move on-chain yet.

**Consumables** (bought with crates): espresso (+energy), medkit (+health), Getaway Kit (leave jail), Priest's
Alibi (−heat), and more. Route: `POST /v1/items/:id/use`. The **Workshop** (`POST /v1/workshop/craft/:id`,
`/workshop/ammo`) makes gear and ammo from crates and cash. It is cheaper in the Old Foundry district.

---

## 4. The city & the living world

The city has a **daily background that is the same for all players**. You can know it before it happens.

**City events** (16 events, one each day, in order) change every loop. Examples: HEAT WAVE (job pay ×1.5, jail
×2), DOCK STRIKE (contraband ×2), COMMISSIONER'S VISIT (jail ×0.5), THE CRACKDOWN (job pay ×1.75, jail ×1.5),
BUREAU SWEEP (deal heat ×2), THE THIRST (drug demand ×1.3), SUPPLY DROUGHT (makings +40%), OPEN CITY (heat
decreases ×2). `GET /v1/city` [public] shows the current day and a **7-day forecast**, so you can plan.

**Regional weather** — a daily price change on trade goods in each district (0.9–1.1×, average 1.0). **Day and
night clock** — during patrol hours (UTC 13:00–22:00), RICO convictions are stronger (×1.15). At night, NPC
raids are easier.

**The 6 districts:** **Docks** (+50% contraband, the harbor), **Neon Mile** (+15% racket and
business income; the vice district — casino, speakeasy), **Old Foundry** (workshop −25%), **Brick Yards** (+2%
crime success), **Canal Row** (+10% crime pay), **Cathedral Hill** (nerve increases two
times faster).

**NPC rival families** (`GET /v1/world`, `POST /v1/world/:npcId/raid`) — these are shared cash reserves for the
whole server. All players attack them together. This is a cooperative task. The outfits are: Dock Rats (L4), Zappa Crew (L8),
Kryl Syndicate (L20), Moreau Cartel (L40), Volkov Bratva (L55) — the top three need a CREW raid. A raid costs energy, ammo, and heat. It takes a limited amount of
cash. It pays a one-time bonus if you reduce a family below its floor. If the family repels the raid, you go
to hospital. If you defeat a family, your **family holds its outpost**. The outpost pays tribute to your
treasury. A rival family can take the outpost if it pays more than your garrison.

**The uprising** (`POST /v1/world/:npcId/reinforce`) — the NPC families fight back. On some days (the forecast
shows them a week early) one family **rises up**. It becomes harder to raid, and it stops paying tribute. At
the end, it will **leave your outpost if your garrison is too small.** Use `reinforce` to make the garrison
stronger from the treasury. This also protects the outpost from rival families. If you keep the family weak
with raids, a small garrison is enough.

---

## 5. The economy

**Currencies:** **cash** (in your pocket and your bank), **$OMR** (premium, account-level, earned through
enumerated rules, and eligible for on-chain extraction by minted accounts once the production rail opens),
**crates** (cb), and **ammo**. **Cash can never buy $OMR.** The one live conversion runs the other way at
the Window: burn $OMR for cash from a funded till. The main economic rule (section 10.4) is that the game
records and checks every movement of value.

**Nothing you do in the game creates $OMR on a schedule.** There is no wage, no yield and no drip — the city has no
scheduled printer. Outside the mission ladder's one-time payouts (~1,320 across a career) and the small
daily bonus, every $OMR in it was **bought with real money** by somebody, which is exactly why it is worth taking off them. Your five ways to get some:
**take it** (killing a player loots their liquid $OMR — staked and committed $OMR is safer), **earn it**
from another player who pays you in it, **work for it** (the mission ladder's one-time payouts and the
daily all-three bonus), **buy it**, or **get paid out of the Bank** (below). A nightly
job asserts that nothing unenumerated appeared, so this is a fact you can check rather than a promise.

**The Bank's city leg** (`GET /v1/bank`) — the fifth way, and the only one that pays you for simply
playing. People who borrow from the Bank pay to use it; that profit is spent **buying $OMR on the open
market**, and the whole of it is handed to the players who played that day. Nothing is printed — every
token in the split was purchased first, which is why it does not move supply.

Your share is your share of what the whole city did that day, **flat and with no cap** — so a man
running ten accounts takes exactly what he would have taken running one, and there is no reward for
splitting yourself up. Only actions the game itself rations count (nerve, energy, a cooldown); nothing
you can simply buy more of. To be in a day's split at all you need work across **three different
trades** and a minimum day's score — the board tells you where you stand and what you still need. It
is not a rate and it is not a promise: the size of the split is whatever the Bank actually earned.

**The Desk** (`GET /v1/desk`) — where you buy it, and where it goes when you spend it. Every $OMR a
sink takes off you (a vanity burn, an estate tier, a jury, the Window) is **not destroyed** — it lands
on the desk's shelf, and the desk puts it back up for sale. Once a day the desk runs a **descending
auction**: it opens high and the price falls for six hours toward a **reserve**, and whatever does not
sell simply rolls to tomorrow. The lot is what came home yesterday, capped at 1% of all the $OMR in
player hands so a big spending day cannot become a dump. **The desk can only ever sell what is on its
shelf** — it never issues anything, which is why buying here moves no supply at all: those are somebody
else's spent chips changing hands. There is a **buy side** too: if the price falls far enough below
the 30-day average, the desk restocks off the open market instead of waiting for the sinks — paid for
out of the trading fees the game's own liquidity earns, never by printing. Between the two edges it
does nothing at all, which is deliberate: a desk that buys and sells at the same time is just paying
fees to trade with itself. The board publishes the shelf, the clock, the price and the exact
list of spends that feed it, so the claim is checkable. **$OMR bought at the desk is FRESH** — it pays
the full early-exit toll for its first 48 hours, same as any other fresh token.

**The Exchange window** (`GET /v1/window`, `POST /v1/window/redeem`) — the ONE conversion in the
game, and it runs one way: **burn $OMR, receive cash at a published rate**, from a till that real
cash sinks fill (the street take). A short till refuses cleanly and burns nothing — the window is a
claim on what was funded, never a promise. 5% of every redemption goes to the top families (the
family yield). **Cash can never become $OMR** — there is no swap and no laundering rail, street or
private; any route that would do it answers `retired`.
- **The early-exit tax on withdrawals:** $OMR that you received less than 48 hours ago pays an
  extra toll when you extract it on-chain — 50% at age zero, decreasing in a straight line to 0% at
  48 hours, newest tokens priced first so old savings cannot shield a fresh dump. Hold a token for
  two days and it exits free. There are no exemptions.

**THE MADE MAN** (`GET`/`POST /v1/made`) — the recurring subscription. Pay **120 $OMR every 30 days**
and you are *made*: the badge, the upper compound (Country Estate and above), a club of your own, and
**the pad pays itself** — your fronts settle their own cash upkeep the moment you touch them, so a
stretch away does not leave them cold.

**It buys standing, never power.** No earning loop is gated, no odds move, no stat changes, and the
pad is not discounted by a cent — the same money leaves your pocket, you just stop having to remember.
Operating costs stay in cash, all of them, which is the line that keeps the game free: a man who never
pays a dues runs the whole city at full strength — and can hunt made men for their $OMR. Paying buys
you a seat at tables where you can lose money. It buys no advantage at any of them.

Dues are a sink like any other, so they go to **the Desk** to be sold again rather than being destroyed.

**THE ACCESS STAKE** — the high-stakes room at the Den wants a seat (level 30, or the Madame's velvet
rope) *and* **300 $OMR held in a stake**. Held, not spent: it earns nobody anything, and its whole job
is to put a permanent, visible, lootable float on exactly the players worth hunting.

**The Vault (staking)** (`POST /v1/stake`, `/unstake`) — **cheaper cover, not a safe harbour.**
Nothing makes $OMR untouchable: a killer takes 50% of a loose or unbonding
balance but only 20% of a staked one, so committing halves what a bad night costs you without ever
making you safe. You always get your full principal back, but it "unbonds" for 6 hours (at the higher
IDLE rate during that window) before it is liquid. **Nothing you hold is out of reach** — the whole
point of the currency is that it can be taken off you. The old per-staker
yield is retired (`/claim-rewards` answers `retired`): $OMR yield now pays THE FAMILIES — the top
families by seasonal standing draw the **family yield** into their gang reserves.

The founder-directed replacement makes that stake actual on-chain OMR rather than a separate database balance. The same
canonical position must drive the Made Ladder, commitment multiplier, Den access, Broker staking multiplier, gameplay
loss, unbonding, inheritance, and public accounting. The database may mirror finalized chain state and journal pending
settlement, but cannot independently create or move stake. The approved design uses a new `OMRGameplayVault`, not the
current yield-oriented `OMRStaking` contract. Principal pays no personal APY: family yield and separately backed utility
rewards remain, while the stake itself earns nothing. Game-earned OMR must first become real, reserve-backed on-chain OMR
before staking; the claim and stake may be atomic but cannot be credited twice.

The vault enforces the visible path from pending deposit to active or committed stake, through the six-hour unbonding
period, to withdrawable OMR. A narrowly authorized, Safe-rotatable gameplay signer can apply one-use, rate-bounded game
outcomes but may not sweep funds. Loot moves actual OMR inside the vault from the victim's exposed position to the
killer's on-chain gameplay balance. Chain settlement finalizes before the game consumes one-use resources or publishes
an irreversible result; chain or settlement outages therefore stop value-taking actions safely. Legacy database stake
becomes on-chain stake only to the extent actual OMR backs it. No migration mint covers a shortage, and any unfunded
difference is reported as a liability. This design is approved, not live, until implementation,
audit, funded migration, and launch verification are complete.

Only the account's verified controller wallet or the reserve-backed claim-and-stake rail may fund its position; a bypass
transfer cannot stake for somebody else or qualify them. The position follows the permanent game account—not a character
name—so death or respawn does not erase its principal or history, and legitimate wallet recovery changes control without
moving the stake. Depositing or committing accepts a published on-chain risk-ruleset version. The vault, not the gameplay
signer, enforces maximum losses of 20% for active/committed stake and 50% for idle/unbonding OMR. The Safe may reduce or
pause exposure, but a higher rate or new loss type requires a new public version and fresh consent.

Value-taking actions move through prepared, submitted, finalized, and game-committed states. The final vault event is the
one source for crash recovery; concurrent settlements use only the balance actually available and cannot overdraw. Every
position change creates on-chain history for the Made Ladder and the Broker time-weighted average. Emergency controls are
separate so a gameplay or signer incident does not automatically trap withdrawals; stopping exits requires a specifically
declared custody-integrity incident.

The founder selected an upgradeable gameplay vault rather than a non-upgradeable migration-only contract. That means the
proxy implementation and whoever controls upgrades are real trust assumptions: an upgrade can technically change rules,
rates, settlement, pauses, or withdrawal behavior. The approved structure uses an OpenZeppelin Transparent Proxy and
dedicated `ProxyAdmin`, owned by a small non-upgradeable upgrade governor. Only the Safe may propose, cancel, or execute;
the main operator, gameplay signer, relayer, servers, and individual wallets have no upgrade power.

An upgrade or upgrade-control change is published for at least 48 hours with its exact old/new code hashes, version,
initialization call, storage-layout commitment, reason, review evidence, and execution window. Emergencies can pause the
affected vault functions immediately but cannot bypass that delay. Implementations cannot initialize themselves, and a
versioned setup step runs once inside the exact upgrade transaction. The same transaction validates OMR identity,
balance and liabilities, ruleset, settlement nonces, pauses, controller bindings, and version; a failed continuity check
reverts the upgrade. Independent review and rehearsal remain necessary because upgradeable code can be malicious.

A rollback follows the same proposal and delay. An upgrade that increases economic risk requires a new ruleset and fresh
consent, while a player who does not consent keeps an exit under the previously accepted terms. Public surfaces show the
proxy, implementation and code hash, governor, Safe, delay, pending proposal, evidence, validation result, and full
history. Any unexplained code or authority mismatch stays red and stops new deposits and commitments without silently
stopping exits.

Changing a healthy controller normally requires signatures from both the current and proposed wallets. Lost-wallet
recovery is slower: authenticated control of the permanent game account plus proof of the new wallet opens a public
seven-day request and notifies every available account channel. The current controller may contest it; only the Safe may
resolve a contested request against public evidence, and nobody may shorten the seven-day minimum. While recovery is open,
withdrawals, deposits, new commitments, and more controller changes stop, but existing commitments, unbonding clocks,
gameplay exposure, and valid losses continue—recovery is not a temporary shield. A completed change advances the public
controller generation, invalidates unfinished old-wallet authorizations, and never rewrites finalized history. EOA and
ERC-1271 smart-contract wallets are supported and invalid contract-wallet responses fail closed.

Unlocked principal is withdrawn directly by the current controller to that same wallet. There is no arbitrary recipient,
server signature, support override, or required relayer. Stake, unbond, and withdrawal accept partial amounts. Every
partial unstake has its own amount, start, six-hour unlock, ruleset version, and exposure history; a later request cannot
restart or rewrite an earlier clock. Gameplay loss consumes eligible unbonding tranches by earliest unlock time, ties by
lowest immutable tranche ID, and exhausts one before the next. There may be at most 16 live unbonding tranches per account;
matured tranches do not count, and an over-cap unstake fails before changing state. A partial unstake must be at least
0.01 OMR, except the exact full remaining eligible stake can always exit. Matured tranches aggregate into one withdrawable
balance, while immutable events and checkpoints preserve each tranche's complete history.

The vault accepts only the pinned OMR contract and records what its balance actually received, not what a caller claimed
to send. Transfer fees, rebases, hooks, malformed results, and amount mismatches cannot fabricate a position. OMR sent
around the deposit route is unattributed and qualifies nobody. The vault continuously requires its actual OMR balance to
cover every accounted liability. A shortfall is a red custody-integrity incident that stops new risk; no database or
operator entry may conceal it, and the withdrawal response remains separately visible.

Unattributed OMR remains nonqualifying and nonspendable while the vault is solvent. Only the Safe may recover exact,
verified surplus after a public 48-hour proposal, and only to the single fixed OMR recovery-treasury address. The proposal
publishes the amount, destination, evidence/reason, earliest execution, and expiry; a changed proposal restarts the delay.
It cannot credit a player, settle gameplay, choose an arbitrary recipient, or be executed by the main operator, gameplay
signer, relayer, or server. Anyone may fund a deficit with exact OMR. Actual OMR received repairs the deficit first,
credits no player and creates no qualification, yield, repayment claim, or gameplay credit; excess becomes unattributed.

Any positive custody deficit automatically pauses withdrawals as well as deposits, new commitments, and gameplay debits.
Every player's liability remains recorded in full—there is no haircut, pro-rata conversion, first-come payout, operator
write-off, or database adjustment. When canonical zero deficit reaches configured finality and the continuous public
mirror synchronizes, the deficit-specific pauses clear automatically without acknowledgment or cooldown; unrelated
pauses remain. The vault checks solvency before and after every value-changing operation. Permissionless solvency and
unattributed-balance synchronization are available, every zero-to-positive recurrence receives a new immutable incident
ID, and public monitoring proves actual balance, full liabilities, incident generation, finality, mirror freshness, and
sequence continuity. An acknowledgment cannot close or conceal an incident.

Gameplay loss is calculated by the vault from each eligible bucket's balance immediately before settlement. The signer
can supply ceilings but cannot choose or inflate that balance. Calculations round down to OMR atomic units, never up to
one; a legitimate zero-loot result still finalizes. If one outcome touches several buckets, the vault calculates them
independently and settles them atomically in one transaction, follows the approved unbonding-tranche order, credits the
killer once with the combined actual loot, and reverts everything if any invariant fails.

Finalized loot enters the killer's idle on-chain gameplay balance and remains exposed at the idle rate. It is not
automatically committed or staked and does not enter the Broker stake time-weighted average until the killer takes the
separately authorized eligible action. A settlement authorization cannot have a future issue time and must be canonically
included within five minutes; once timely included, it may reach finality after that deadline. The prepared state is only
an expiring off-chain journal entry. It cannot reserve OMR, consume a nonce, pause withdrawals, or lock the victim.

Every outcome binds a globally unique immutable gameplay event ID and the victim's exact next monotonic settlement nonce.
A successful settlement consumes the nonce even when actual loot is zero; preparation, rejection, expiry, and revert do
not. The MVP settles exactly one outcome and emits one complete record per transaction; batching is not authorized.

During an ordinary signer rotation, the new generation activates immediately while an old authorization remains usable
only if issued before canonical rotation and still within both its original deadline and a maximum five-minute overlap.
An emergency Safe revocation has no overlap and invalidates every old-generation authorization not already included;
finalized settlement remains immutable.

Settlement submission is permissionless. Any address may present the exact signed authorization, but gains no authority
over the victim, killer, amount, rate, buckets, recipient, controller, ruleset, pauses, custody, or upgrades. There is no
approved-relayer registry, relayer-count cap, or operator-managed relayer set. Invalid, stale, expired, replayed,
malformed, and losing-race submissions change no canonical state; those callers pay their own gas, and spam alone cannot
pause settlement or create a financial incident.

Protocol users may voluntarily fund settlement gas shared by the whole community through a dedicated, non-upgradeable
`SettlementGasPool` that accepts only the chain's native gas asset. It is a separate contract with no custody of or access
to OMR principal, player liabilities, RWA acquisition ETH, Stock Tokens, or unrelated treasury funds. A contribution is
final and creates no sponsor balance, refund, yield, priority, allocation weight, governance power, repayment claim, or
other economic credit. The Safe cannot sweep it to treasury. After 48 public hours, an exact code-hash-bound migration may
move only unreserved ETH to one successor pool; the old pool retains the ETH backing outstanding executor credits and
keeps their withdrawals live.

Only the submitter that wins canonical settlement for an event ID and victim nonce receives a gas credit, including for
a legitimate zero-loot result. Invalid, expired, malformed, wrong-chain/vault, reverted, replayed, stale, and losing-race
calls receive zero. Vault economic effects complete before the fixed pool records a credit to `msg.sender`; settlement
never pushes ETH or names an arbitrary reimbursement recipient. Executors later pull accumulated credit only to
themselves under checks-effects-interactions and reentrancy protection. Credits are exact liabilities and never count as
available sponsorship. Pool failure, pause, or depletion cannot revert an otherwise canonical gameplay settlement.

The caller cannot submit a gas bill. Reimbursement is the minimum of: contract-measured audited settlement gas priced at
`min(transaction gas price, base fee + public priority-fee cap)` plus any canonical reviewed chain-data fee; the public
per-settlement wei cap; and unreserved pool ETH. Arbitrary caller work, excess calldata, unrelated external calls,
deliberate gas burning, failed work, and fee above the caps do not qualify. An empty or insufficient pool produces partial
or zero credit while settlement remains permissionless. If nobody self-funds, the game stays uncommitted and consumes no
irreversible resource.

The Safe may immediately pause new credits or reduce reimbursement caps, while existing credits remain withdrawable.
Increases, a new native-fee source, and exact pool migration wait 48 public hours. The Safe cannot select submitters,
manually reward a chosen call, redirect credits, or refill the pool from OMR/RWA custody. Hosted HTTP surfaces may use
authentication, idempotency, rate limits, and abuse controls, but direct on-chain submission remains open. Exact typed
authorization, five-minute inclusion expiry, signer generation, event/nonce uniqueness, vault-derived loss, cheap early
rejection, bounded tranches, and no submitter-selected external calls leave invalid spam caller-funded and unreimbursed;
spam cannot lock a victim, consume gameplay resources, auto-pause, or create a canonical incident.

Each supported chain publishes one exact settlement-finality block count; no action receives a server-, signer-,
submitter-, or operator-selected lower threshold. Every increase and decrease follows the same Safe-only 48-hour public
proposal binding the chain, current and proposed counts, reason/evidence, timing, expiry, and effective block. It applies
only to transactions first included after that boundary; pending and finalized transactions retain their inclusion-time
rule. Emergency response pauses new value-taking settlement and never hot-edits finality. A pre-finality reorg retries the same event ID and victim nonce:
the original authorization may be resubmitted while valid, or the same event/nonce may be freshly authorized only after
canonical absence is proven. Final events expose the ruleset, generations, nonce, submitter, times, per-bucket balances
and ceilings, rounded debits, tranche consumption, killer credit, and post-settlement solvency totals.

**The money cycle:** cash costs (the casino cut, house takes, fines, and other fees) go to the
**street-tax pool**, and every 12 hours the whole take funds the **Exchange window's till** — so the
cash that players spend is what backs the cash that $OMR redeems for. On the $OMR side, a cut of
every window redemption flows to the top families (**the family yield**). Spenders fund earners;
nothing is created to make it so.

### Why it is built this way

Almost every game with a token has the same pipe: you farm the game's own currency, convert it to the
token, and sell. It is one pipe, and everything bad runs through it. Farming is unbounded, so the token
is unbounded. The people converting are the people leaving, so the sell pressure grows exactly as fast
as the game succeeds. And because the token is the only reason to grind, the grind is optimised until
it stops resembling a game. The genre's most-studied collapse — Axie's SLP — is that pipe running to
completion.

**OMERTÀ does not have the pipe.** Cash cannot become $OMR at any price, through any route, at any
rate. There is no swap, no wash house, no laundering at your own front — those routes exist as code
that answers `retired`. This is not a rate that was tuned down or a cap that was lowered; the
conversion does not exist.

Four things follow, and each is a mechanism rather than a policy:

- **Grinding cannot inflate the token.** Grinding makes cash, and cash has nowhere to go but back into
  the city. A player who plays twenty hours a day is a rich player, not a source of new supply.
- **Supply is enumerated, and a nightly job proves it.** The ledger check is
  `buckets == genesis + mints − burns`, and a reason nobody enumerated is itself an alarm. The
  city has no scheduled printer, and a nightly check asserts that none appears. What can mint is a
  short list: the mission ladder (a few hundred $OMR over a whole career, once per account) is the one
  tap that pays you for playing, and the rest — the prize pool and the two buybacks — issue a token
  only when a real one has arrived to back it, one for one. And a sink does not destroy anything: it
  is the house's cut, and it goes to the desk to be sold again rather than to the fire.
- **What you can take out is bounded by code, not by arithmetic.** The withdrawal rail signs nothing
  the reserve cannot back, and the reserve is filled by real revenue — so "you can only take out what
  somebody put in" is a rule the rail enforces on every single withdrawal, whatever the supply does.
  That is the guarantee worth having, and it is the one that holds even with the mission tap open.
- **The one conversion runs the other way, and only on money that already exists.** The Window burns
  $OMR and pays cash out of a till that real cash sinks filled. A short till refuses and burns
  nothing. It is a claim on what was collected, never a promise about what will be.

**Why this particular game.** OMERTÀ's whole thesis is that things are lost — death is permanent, your
pocket is lootable, your empire is seizable by someone who wants it more. A token you can farm and dump
is, structurally, a way to opt out of that: convert your position into something the game cannot take,
and leave. Severing the pipe means effort converts to $OMR only by being paid for playing well, and
$OMR converts to power only by being burned. The currency cannot be used as an exit from the risk that
the game is about.

**And there is no hiding place, by design.** The obvious way to soften a risk economy is a vault
nobody can reach into, and this game deliberately does not have one. What it has instead is a CHOICE
with a real trade-off: money doing nothing is the most exposed thing you own (a killer takes half),
money you have committed to a stake is cheaper to be caught with (a fifth) — and neither is free.
Both answers help the city: committing keeps the currency moving, staying liquid keeps hunters in
business. On top of that, unstaking exposes the principal for six hours, staking pays no personal
yield (the yield goes to families), and every route out of the city passes an early-exit toll that
starts at 50% and decays over 48 hours.

**Flat passive income** (buy one time, then earn continuously — this is different from Businesses):
**Rackets** (`/v1/rackets/:id/buy`, Laundromat L3 to The Invisible Hand L100) and **Assets**
(`/v1/assets/:id/buy`, `/sell` for 80% — vehicles, property, and legal businesses that increase your cargo,
energy limit, or income).

**Trade goods** (10 goods, with a set price in each district) — buy at a low price, carry the goods in your
trunk, and sell at a high price. This is the start of the Black Market and convoys. Routes: `POST
/v1/goods/buy`, `/goods/sell`. The **Exchange** (M3) is a separate market for crates and ammo, with escrow.

---

## 6. The Kitchen

The Kitchen is a drug operation that earns income while you are offline: **makings → lab → cook → deal.** Your
**trade rank** controls it.

Loop: buy **makings** (`POST /v1/kitchen/makings/:drugId`) → **upgrade your lab** (`/kitchen/lab/upgrade`, 5
levels; the top levels cost $OMR) → **cook a batch** (`/kitchen/cook`) → **collect** (`/kitchen/collect`) →
**deal** (`/kitchen/deal`) or let your **crew** sell while you are offline.

- **Drugs** (8, unlocked by rank): VIM (base 90) to NOCTURNE (base 9000).
- **Cook** produces `demand × 12`, and 1 crate for each 20 units. There is a **fire** risk. You survive a
  fire but lose the batch. The risk is higher for lower quality.
- **Deal** income = demand × quality × city event × trade-rank bonus. It **adds heat** (this feeds the Law).
  A rank-0 dealer gets a **+50% bonus** on the corner. This bonus stops at rank 1.
- **Crew** (`/kitchen/crew/hire`, up to 5) sell your cheapest drugs while you are offline. But each crew
  member costs **$1,200 each hour in wages** (also called "the nut," `/kitchen/crew/wages`) whether the
  stash moves or not. If you do not pay for 3 days, the crew becomes **cold** and stops selling.
  **Keep them stocked and check in often.** Offline sales are capped at 8 hours' worth however long you
  are away, but the nut keeps running for up to a week — so a crew you visit three times a day earns
  about 3.6× its wages even on the cheapest line, a crew you see once a day barely clears it, and a crew
  you leave for three days costs more than it makes. That is the trade: they are staff, not a machine.
- **Letting one go** (`DELETE /v1/kitchen/crew`): square up what they are owed and one walks. If the crew
  has already gone **cold**, they walk for nothing — so you can always get out from under the nut. Their
  buy-in does not come back; hiring again starts at the first step price.
- **Lay low** (`/kitchen/laylow`, $5k plus energy, −25 heat) and **clean papers** (`/kitchen/cleanpapers`, 60
  $OMR) reduce your heat. Above heat 60, the Bureau can **raid** your operation.

Connections: deal heat feeds the Law meter. Crates feed the workshop and armory. Trade reputation feeds the
assassin and trade ranks.

---

## 7. Businesses & fronts

Businesses are premium, level-gated, **upgradeable** places that earn pocket cash — the endgame
personal-income engine, different from flat Rackets and Assets. Catalog: **Laundromat (L15) to
Casino (L58)**. Each has 3 levels. You can own one of each kind. `GET /v1/catalog` [public] lists
them all. *(Fronts do not launder anything — cash cannot become $OMR anywhere in the game.)*

Loop: **buy** (`/v1/business/:kind/buy`) → **collect** (income accrues, 24-hour limit,
`/business/collect`) → **upgrade** (`/business/:id/upgrade`) → **pay the upkeep**.

### The pad, and why a front can owe you money

**A front wants an owner who shows up, and the terms say so.** The till only holds a **day** of
takings (income stops banking after 24 hours) and the pad — protection and wages, 20% of the
hourly income — keeps running for **two days** whether you are there or not. The envelope stops
below a full till, so coming back always covers it: what an absence actually costs you is the
front going **cold** and earning nothing at all until you square up, plus every hour of takings
the till was too full to hold. Collect every day or two and a front is an engine; buy one and
forget it and it sits dark.

- **Upkeep** (also called "the pad," `/business/upkeep`) — 20% of the hourly income, and it climbs
  5% for every extra front you run, on *all* of them. It accrues to a 2-day limit. Unpaid for
  3 days the business goes **cold** — no income, no upgrades, no specialization — until you square
  it out of pocket.
- **Closing up** (`DELETE /v1/business/:id`) — the way out. A cold front you cannot carry does not
  merely sit idle: you can only own one of each kind, so it holds that slot for the rest of your
  street's life. Close it and the pad stops and the slot frees; you can buy that kind again later
  at level-1 prices. It is permanent — the tier, the specialization and everything sunk in go with
  it, and you get back whatever `BUSINESS_SHUTTER_BPS` is set to (shipped at 0 — nothing).
- **The Bureau** — a front heats up by *earning*. Every full day's income you bank adds to its
  file; past the threshold the Bureau rolls a raid that seizes the pending take and fines you.
  Collecting often keeps the file thin and any raid small. **The Accountant** and **The Fixer**
  specializations halve the heat and the fine.
- **Shakedown** (`/business/:id/shakedown`) — a rival takes 30% of the pending income in a muscle
  and cunning contest (8-hour cooldown, costs energy and heat). You cannot shake down a family
  member or a safehoused owner.
- **The bigger threats** — a rival can attempt a **hostile takeover** (a forced sale), an
  inside-job crew heist can raid your pending take, and a killer who puts your street down can
  **SACK** your best front and run it themselves. A passive empire is risk capital — defend it.

---

## 8. Territory rackets

There is **one income operation in each district**. The family that holds the turf owns it. So wars are about
income, not only a one-time treasury payment. Two axes: a 5-rung SCALE ladder (**Corner $50k →
Neighborhood $250k → District $1M → Citywide $4M → The Syndicate $15M** — the return on each level becomes
smaller) and a TYPE chosen at establish (**numbers** is safe; **protection** and **smuggling** run hotter
and richer but draw Bureau raids).

A boss or underboss **establishes** an operation on held turf from the treasury
(`POST /v1/territory/:districtId/establish`). Income accrues (24-hour limit) and **collects to the treasury**
(`/territory/collect`). **Upgrade** climbs the levels. You must pay **upkeep** (`/territory/upkeep`, 20% of
income; it becomes cold after 3 days). **When another family seizes the turf, the operation moves to the new
owner** (the pending income is lost, and the clock resets). The victor also pays a war premium of 50% of the
build cost. If a family is dissolved, its operations end.

---

## 9. Families

Families are player groups with a treasury, roles, wars, turf, and status badges.

**Found or join** — you found a family for $25k at L5 (maximum 20 members). You join a family immediately.
Roles: **boss / underboss / capo / crew**. Each role has an income multiplier.

**Tribute** — `/v1/gangs/tribute` (cash; this adds to the weekly task) and `/gangs/tribute/omr` (adds $OMR to
the family reserve). **Wars** (`/gangs/war/:targetGangId`) — you declare a war for $10k. It runs 30 minutes.
The winner takes 20% of the loser's treasury and standing. A jump-kill scores 1 war point. A fire-kill on a
family that you are at war with scores 3 points. **Turf** (`/districts/:id/seize`) — seize a district for its
benefits and its territory racket.

**The watch.** A holder declares the hour their family stands ready (`/districts/:id/watch`, boss or
underboss, free and changeable — the cost is having to BE there, though not once somebody is at
the door: with a contest running you are held to the hour you committed to). Inside that four-hour window, taking
the district is the plain price; outside it, catching them cold costs **1.5x**. A family that never
declares a watch is dear at every hour, so declaring is what buys you the cheap window. Every declared
hour is public on `/districts` — you are meant to plan around it, on both sides.

**The sealed bid.** A district *another family holds* cannot be bought at a published price — it goes
to a contest (`/districts/:id/claim`). Every family puts up a SECRET stake from its treasury; when the
window closes the highest takes the district, **the holder wins ties**, and the winning stake becomes
the new garrison. The board tells you how many families are in and never what any of them put up. A
loser gets half of their stake back and forfeits the rest, so committing everything against a family
that was never coming is how you lose money without losing a fight. A stake only ever goes up, and it
leaves the treasury the moment you make it — you cannot bluff with money you have already spent. The
watch still applies: staking outside the holder's declared window costs more just to get in.

**The map.** The six core districts are not a flat set — they border each other, and `/v1/districts`
publishes which. Geography prices the door from both sides. A district a family holds is **dearer to
come for once per bordering district that family also holds**, because they can reinforce across their
own ground: contiguous turf genuinely defends itself. And a district **next to ground you already
hold** is **cheaper for you** — your men are already on that side of the river. That is one foothold
discount however many borders you share, not a bonus for encirclement. So "we cannot defend the canal,
we do not hold the docks" is now a real sentence, and taking the district next to your own beats taking
the rich one across town.

**The charter — what your family IS.** Without one, a family is defined only by what it happens to
hold. The boss picks a charter, and every one of them trades an edge for a real
handicap — a charter with only an upside would be a free upgrade everybody takes, and then nothing is
asymmetric again. **The Syndicate** runs its operations 15% leaner but pays 15% over the odds for
turf. **The Outfit** takes ground 15% cheaper and pays 15% more to run what it holds. **The Fixers**
have the Bureau building its file 25% slower, but forfeit 25% more of a losing contest stake. Running
NO charter is a real answer — you get neither side, which is exactly the family you have today. The
first pick is free; re-founding costs the family reserve and locks for a week afterwards. The two
mirrors are deliberate: a Syndicate family and an Outfit family are each good at what the other is
bad at, so an alliance between them is complementary rather than just twice as big.

**The season has an ending.** A season runs 28 days in three phases you can read on `/seasons`:
**The Opening** (days 1–7 — cheap ground, nothing settled), **The Long Game** (8–21 — build and hold),
and **The Reckoning** (22–28). In the last week held turf is a quarter cheaper to challenge, contests
settle in half the time and a holder's watch window is halved, so an incumbent who has been sitting on
a district since week one has to defend it while the door is open. Nothing is reset or seized when the
books close — instead the city REMEMBERS: the top City Standing takes the season and the family holding
the most core turf goes on the permanent roll, and the champion's bloodline keeps the crown forever.
That is the whole point of the arc — you are not just accumulating, you are racing a clock.

**The posts.** A family fills five chairs — the Enforcer, the Caporegime, the Streetboss, the
Quartermaster and the Bagman (`/roster`, boss or underboss). **One post per made man, one man per
post**, so your best man can do one job and not the others; each post reads one stat, and what it is
worth scales with the man in it. What makes this worth fighting over: **a post is dead while its
holder is dead, in lockup or in the hospital** — put a family's Enforcer in the hospital and their
turf gets cheaper to take without your ever going near the district. They can fill the chair again
straight away, but only with somebody who was on the STREET; you cannot slide a man across from
another post for six hours — nor stand him down and walk him into the next chair, which is the same
shuffle — so answering a hit costs the family a second made man. Every post is a
bonus, never a requirement — the scarcity is which chairs you fill, not that the baseline moved.

**The reserve pays for status:** **seals** (`/gangs/vanity/seal`, Wax 150 to Obsidian 9000 $OMR, a badge) and
the **Foundation** (`/gangs/foundation`, Community Fund 360 to The Legacy 18000 $OMR). The Foundation is real
power: it **reduces the RICO conviction chance of every member** and speeds their case bleed (only members
present when a case was filed get the benefit). The reserve also draws the **family yield** (section 27).

Routes: `POST /v1/gangs` (found), `/gangs/:id/join`, `/gangs/leave`, `/gangs/kick`, `/gangs/promote`, tribute
×2, war, seize, foundation, vanity (color/name/seal). `GET /v1/gangs` [public], `GET /v1/gangs/:id`.

---

## 10. The Commission

Server-wide player politics, with no money — only status and weekly rule changes. The **top 5 families by this
season's standing** (`season_tribute + 10000×season_wars`, recomputed live) hold the seats. Each seated boss
or underboss casts **one public vote each week**. The **majority of last week's votes controls this week** (a
tie or no votes means no decree). The boss of the first seat can **veto** one time each week.

**Decrees** (each changes one thing): **Open Season** (safehouse stays ×0.5 — every player is more exposed),
**Pax** (no player can declare a new war), **Amnesty** (lay-low ×0.5), **Lockdown** (convoy defense +20),
**Smuggler's Moon** (port interdiction eased), **Open Roads** (convoys arrive faster), **Blood Oath** (kill
loot cuts deeper), and **The Levy** (the buyback's family split goes to the seated chamber).
`GET /v1/commission` [public], `POST /v1/commission/vote`, `/commission/veto`.

### The daily Stock Token ballot

The same five seats also choose **which approved Robinhood Stock Token** the RWA treasury machine may
buy after the UTC day closes. A boss or underboss casts one public family pick at
`POST /v1/commission/ticker`; it is changeable until rollover. Seat weights are 5, 4, 3, 2, 1, so the
head family breaks a raw 1–1 split by weight. A weighted tie or silence uses the currently approved
default. `GET /v1/commission/ticker` is public and returns the votes, leading pick, last result, and the
current candidates.

The candidate list is not a ticker typed into a bot configuration. Robinhood publishes the canonical
Stock Token identities and chain-4663 addresses; the OMERTÀ Safe approves the subset the game is able
and willing to buy in `StockTokenRegistry`. The worker mirrors only the registry's active entries into
the ballot. `GET /v1/commission/ticker` feeds the Family screen its current `candidates`, ticker list,
default, registry address, chain ID, and last-sync time. If the chain RPC is down, the last approved
snapshot remains. Once a production registry address is configured but has never synced, the list is
empty rather than silently returning to the old static list. If the Safe deactivates a token before
rollover, votes for it become invalid immediately and stop counting toward the public lead or closing
tally. Affected families may recast for another active candidate until the normal cutoff; the ballot does
not restart or extend. An invalid vote left unrecast is ignored, and the active default is used only if
the remaining tally ties or falls silent. After rollover, the worker commits the chosen registry key and
a hash of the public family tally on-chain. The buy keeper names the day, not a ticker or token
address—the buyer contract resolves the exact approved token from that result.

The default applies only while resolving the ballot. If the exact Stock Token committed by the closed
result becomes inactive, halted, or otherwise ineligible before purchase, that day's purchase is
**skipped**. The machine does not substitute the default or any other token because the families did not
vote for it. The bounded, unspent ETH carries forward inside the existing treasury and purchase caps;
unused authority does not enlarge a later daily cap. The closed ballot remains in the public history,
along with the skipped-purchase status and reason.

That unspent ETH stays permanently in one general **Stock Token acquisition budget**. It is not reserved
for the skipped token and does not expire by ordinary operation. The designated `mainOperator` is the explicit
exception: that key may move any or all pooled ETH to any address for any purpose. Future
valid ballots may spend the backlog gradually, but every day still permits only one purchase of that
day's exact winner under the unchanged daily cap—there is no stacked cap or catch-up batch. The skipped
token receives nothing unless it becomes eligible and wins a later ballot.

Robinhood's public APIs are **discovery, not governance**. Operators run `npm run stock-catalog` to
inspect the current chain-4663 list. For the initial launch only,
`npm run stock-catalog -- --initial-top-volume --registry 0x...` automatically ranks the eligible feed
and emits unsigned Safe calls for exactly the top 15. The metric is Robinhood's documented
`dailyTradingVolume`: the **underlying security's daily share volume**, not Robinhood Chain DEX volume
and not the API's separate mint/burn fields. The deterministic snapshot admits only active,
fractional-tradable assets with a non-halted, fresh, positive bid/ask quote whose chain-4663 address
matches the canonical asset entry; ties break by ticker. The ranked Safe insertion order is preserved:
the highest-volume approved entry is the production quiet-chamber fallback, and if it is later
deactivated the next active entry in that original ranking takes its place. SPY remains only the
chain-dormant development fallback before a production registry has synced.

The bootstrap is automatic selection, not automatic key custody. The tool holds no key and sends no
transaction. Legal/product eligibility, venue route, independent oracle support, and exposure caps
remain Safe-signing checks. A candidate reaches families only after the Safe executes the 15 calls and
the worker observes the on-chain registry. The snapshot is one-time and is not a continuously rotating
volume index: later additions or replacements use an explicitly reviewed
`npm run stock-catalog -- --tickers AAPL,SPY --registry 0x...` proposal. Provider additions never
auto-enroll themselves. `--deactivate SYMBOL` emits the matching Safe removal call when an asset is
suspended, disappears, or falls outside policy; removal is likewise explicit and reviewable rather
than API-controlled.

Catalog changes are **forward-only**. Robinhood's API never reactivates or replaces an entry by itself.
If the same exact token returns to service, the Safe must explicitly approve reactivation after checking
its address, provider status, venue, oracle, and exposure limits again. A successor with a different
address or provider identity gets a separately reviewed, immutable registry version with a new asset key.
The prior version remains inactive and inspectable forever, and only one version of a ticker may be active.
Either decision affects only future open ballots: it never rewrites, repairs, or replays a closed or skipped ballot.
Catalog approval also cannot redirect an existing pending allocation; issuer corporate-action
reconciliation keeps that value with the original account cohort. Inactive identities, their changes,
and all ballot results remain inspectable in the public audit history.

Every version's asset key is deterministic. It binds the Robinhood Chain ID, validated uppercase ticker,
exact token address, and RHJ provider-asset-ID hash, so anyone can recompute which identity the Safe
approved. A changed ticker—including a ticker rename—address, provider identity, or chain creates a new
version. Correcting the display name or toggling that exact version inactive and active does not. The
registry verifies the derived key and does not accept an opaque Safe-selected alias.

Uniqueness applies only to active candidates. Inactive historical versions may repeat a ticker, token
address, or RHJ provider ID, but the live catalog permits at most one active version for each of those
three fields. Activating a version atomically deactivates every active conflict; reactivating the exact
same version updates its permanent record instead of creating a duplicate. The on-chain registry enforces
this itself, so neither a Safe sequencing error nor a stale database mirror can expose two conflicting
active candidates.

If every version is inactive, the catalog is hard-empty: there are zero candidates, no active default,
and no valid Stock Token cast. Rollover records a public `catalog_empty` skipped day, publishes no
purchasable winner, and spends no ETH. The permanent pooled acquisition budget keeps the unspent value.
Production never falls back to SPY, a prior default, or the development list. Only an explicit Safe
reactivation or addition can restore candidates, beginning with future open ballots; empty-catalog days
are never replayed.

Seated families may also put potential Stock Tokens forward through a public, non-binding nomination
queue. A seated boss or underboss submits an RHJ ticker and short reason; other seated families may add a
public endorsement. The queue records the current Robinhood discovery identity, chain-4663 address,
status, capabilities, and observation time as review evidence—not approval. A nomination does not become
a ballot candidate and cannot activate a registry version. Only the Safe's completed review and on-chain
approval, followed by worker synchronization, makes it voteable. Nominations and endorsements are
rate-limited and cannot alter closed/skipped ballots or pending allocations.

Each seated family may submit one new nomination per rolling seven days. A nomination stays pending for
up to 30 days, and each seated family has one endorsement that its boss or underboss may cast, change, or
withdraw during that window. Safe approval, rejection, or a `not_eligible` disposition closes it early;
even “approved” becomes voteable only after the Safe transaction executes and registry sync confirms the
active version. Expiry only archives the record. After its seven-day cooldown, a family may nominate the
ticker again, but the new item receives fresh discovery evidence and never rewrites the archived one.

A nomination remains pending if its submitting family later loses its Commission seat or dissolves; valid
review history is not erased by political turnover. That family immediately loses all nomination and
endorsement write authority. Its old endorsement stays visible in history but stops counting as current
seated-family support. If it later regains a seat, its current boss or underboss must endorse again—the
old endorsement does not revive automatically. Newly seated families may endorse any item that is still
pending. The board shows current seated support separately from historical endorsement events, and both
remain advisory to the Safe.

The queue keeps only one pending nomination citywide for an exact deterministic version key. If another
family submits the same chain, ticker, token address, and RHJ provider identity, it is sent to the existing
item and may endorse it with its own short reason. No duplicate nomination is created, and the attempt
does not consume that family's seven-day nomination allowance. The endorsement still requires explicit
boss/underboss confirmation. Different identities using the same ticker may remain separate nominations,
but the board marks them as conflicting because only one version can ever be active. After an exact
version's prior item closes or expires, a fresh linked nomination may be created with new evidence.

The submitting family is the nomination's sponsor and cannot endorse its own item a second time. While
that sponsor remains seated with current support, it counts as one supporting family; each of the other
seated families may contribute one endorsement, so no family counts twice and the maximum is five. If the
sponsor loses its seat or dissolves, its identity and support event remain in history but current support
drops by one. Reseating does not restore it automatically: the current boss or underboss must explicitly
renew sponsor support. The board shows the sponsor, current supporting families and total, and historical
support separately.

Support from three current seated families—including the sponsor when its support is current—marks a
pending nomination `review_requested`. Crossing that threshold refreshes the timestamped RHJ discovery
evidence and alerts operators, but it never creates Safe calldata, guarantees approval, or binds the
Safe. If support drops below three before an operator claims it, the nomination returns to ordinary
pending status. Once marked `under_review`, later seat or endorsement changes remain public but do not
cancel the review. Operators may review a lower-support item for risk, timing, or catalog-health reasons.
Pending nominations are ordered by current support from highest to lowest, then oldest first.

The automatic review threshold stays fixed at three distinct currently seated families even when fewer
than five Commission seats are occupied. It never shrinks to a majority of the occupied seats and seat
rank does not add weight. If fewer than three families are seated, no nomination can become
`review_requested` automatically; an authorized operator may still claim one manually. Filling or
vacating seats recomputes current support without changing the threshold or cancelling `under_review`.

The original 30-day deadline remains fixed through `pending`, `review_requested`, and `under_review`.
Claiming, reassigning, refreshing evidence, or posting progress cannot pause or extend it. If no terminal
Safe disposition exists at the deadline, the nomination becomes `expired` even while under review; its
assigned reviewer and latest public progress note remain in history, without implying approval or
rejection. Continuing the work requires a fresh linked nomination with new evidence. Terminal `approved`,
`rejected`, and `not_eligible` items do not expire. An approved item awaiting Safe execution remains
publicly non-voteable under a separate execution status rather than silently expiring.

Review approval also has a seven-day execution window. It freezes the exact version key and final
RHJ/review evidence hash; the Safe activation transaction carries an immutable deadline seven days after
approval, and the registry rejects later execution. A transaction mined before the deadline remains valid
even if worker synchronization arrives later. If it is not executed in time, the nomination remains
terminal `approved`, but execution becomes `approval_stale` and non-voteable. The old review cannot mint a
replacement transaction or deadline—continuing requires a fresh linked nomination, evidence snapshot,
and Safe review. The board shows approval time, execution deadline, Safe transaction, on-chain execution,
and registry synchronization separately.

Approval does not freeze third-party facts. Until execution, an off-chain watcher rechecks the bound RHJ
identity and status together with the approved venue, oracle, and exposure prerequisites. A material
change becomes public `evidence_drift`, identifies what changed, alerts the Safe owners, and blocks
OMERTÀ's own presentation and broadcast tooling. The watcher and external feeds have no on-chain catalog
authority and cannot revoke already signed calldata, so the board discloses residual executability until
the Safe cancels it or the seven-day deadline expires. If the Safe executes the warned transaction on
time anyway, the registry accepts it and the event is recorded as a Safe-governance failure.

Catalog activation is one atomic Safe-authorized registry transition. It deactivates all active
ticker/token/provider-ID conflicts, creates or selects the exact immutable version, rechecks uniqueness,
and activates the version. All parts revert together if any part fails. The registry emits the conflict changes
and activation, and the server synchronizes the transaction as one unit, so the catalog never exposes a
duplicate-active or half-installed replacement state.

Only finalized canonical chain state is voteable. `approved`, `safe_submitted`, and
`executed_pending_finality` remain non-voteable; `synced_active` begins only after the configured
chain-finality policy accepts the registry event and the mirror synchronizes it. Inclusion before the
seven-day deadline remains valid even if finality or synchronization lands later. A pre-finality reorg
returns the version to non-voteable state and alerts operators. If an open ballot observed it, the normal
pre-close deactivation rule invalidates its votes and lets affected families recast until the unchanged
cutoff. A submitted transaction, receipt, or optimistic indexer result is never catalog truth.

One authenticated authorized RWA reviewer may set a terminal nomination status of `approved`, `rejected`,
or `not_eligible`; a second reviewer or reviewer co-signature is not required. The immutable disposition
records that reviewer, the status, public rationale, evidence references, and final evidence hash. For an
approval, the reviewer's action sets `approved_at` and starts the seven-day Safe window. That one-person
review decision still cannot activate the catalog: Safe threshold execution, finality, and synchronization
remain separate mandatory gates before voteability.

Monitoring continues after a version becomes `synced_active`. Verified material drift places it in public
`operational_quarantine`; inability to verify a critical prerequisite is separately labeled
`health_unknown`. Both statuses block new ballot inclusion, new or changed votes, purchases, and automatic
delivery. An open ballot invalidates affected votes and permits recasting until the same cutoff. If purchase
has not executed for a closed winner, the day skips without substitution and keeps its ETH in the pooled
Stock Token acquisition budget. Existing ownership and permanent allocation records remain intact: they
cannot be confiscated, substituted, redirected, or expired. The public board shows that the registry version
is still active but operationally blocked. The watcher can halt OMERTÀ's use of it, but cannot activate,
permanently deactivate, transfer, or reassign anything.

Recovery depends on the registry state. If the exact version remains active on-chain, clearing quarantine
does not need a new family nomination, but it does require fresh evidence resolving every stated reason,
one authorized reviewer approval, a new evidence-bound seven-day Safe clearance action, canonical finality,
and mirror synchronization. The version remains blocked until all complete. If the Safe deactivated it
on-chain, it needs a fresh linked public nomination; prior endorsements and support do not carry over. Fresh
RHJ evidence and review, a new TTL-bound Safe approval, atomic execution, finality, and synchronization all
apply again. When its immutable identity is unchanged, the registry reactivates the existing version rather
than creating a duplicate, while preserving and linking the full nomination, quarantine, deactivation, and
recovery history.

Quarantine can begin automatically or manually. Deterministic watcher rules impose
`operational_quarantine` for verified material drift and `health_unknown` when critical health cannot be
verified. One authenticated authorized RWA reviewer may also impose either immediately. Every entry records
a stable reason code, public explanation, exact asset key, evidence or source observations, actor, and
timestamp. Families, nominees, endorsers, ordinary operators, agents, and client code have no quarantine
authority. Entry does not require the Safe because it only removes operational permission; Safe-controlled
recovery is still required. Repeated triggers are idempotent: they may append observations but cannot reset
or hide the original quarantine timestamp.

Every `synced_active` version is checked at least every five minutes. A synchronous fresh check also runs
immediately before publishing the daily candidate snapshot, broadcasting a Stock Token purchase, beginning
an automatic delivery batch, or broadcasting a quarantine clearance. Critical health older than ten
minutes is unusable and becomes `health_unknown`; an earlier successful check cannot authorize a later
sensitive action. Timeouts, malformed responses, signature failures, identity mismatch, and inability to
verify the expected chain/token/provider tuple fail closed without being mislabeled as verified drift.
Production may check more often but ordinary configuration cannot loosen either ceiling; that requires a
documented founder/Safe policy change. The public board shows `last_checked_at`, `last_healthy_at`, health
status, and a safe failure reason without secrets or provider credentials.

Quarantine may race a purchase. If it is known before broadcast, no transaction is sent: the day skips
without substitution and its ETH stays pooled. Immediately before broadcast, the worker atomically records
the exact health, catalog, ballot, quote/oracle, intended-spend, and transaction-intent snapshots. If
quarantine arrives after broadcast but before mining, the purchase becomes `purchase_at_risk`; OMERTÀ makes
a best-effort same-nonce cancellation or replacement only where the signer and chain support it safely.
Cancellation is not guaranteed, and no substitute ticker transaction may be sent. If cancellation wins or
the purchase reverts, the day remains skipped and the ETH remains unspent. If the purchase canonically
finalizes first, the real trade stands and its units allocate to that day's eligible cohort, while automatic
delivery remains paused under quarantine. Nothing is unwound, substituted, or reassigned. The board shows
the quarantine observation, broadcast, inclusion, and finality chronology, and later quarantine grants no
rebuy or catch-up authority. When ordering cannot be proven, status becomes `ordering_uncertain`; canonical
assets and ledger entries are preserved, delivery pauses, and an operator reviews it without inventing a
cleaner history.

After quarantine, delivery resumes only when the Safe clearance is canonically finalized and synchronized
and another synchronous health check succeeds. Every paused allocation keeps its exact asset key, cohort,
amount, creation time, and original priority. Eligible backlogs run FIFO by creation time and then stable
allocation ID; newer rows cannot jump older paused rows, although a held or otherwise ineligible row does
not block later eligible work. Delivery remains stage-then-confirm with an idempotent batch ID. If quarantine
returns, no new batch is staged, an unbroadcast stage is safely released without changing `delivered`, and
an already broadcast transfer follows its canonical-chain result before the rest pauses. Delay grants no
substitute asset, cash, yield, priority bonus, or enlarged allocation. The board publishes backlog size,
oldest paused allocation time, latest completed batch, and current blocker. An acquisition-vault reconciliation
shortfall or deficit is not itself a delivery blocker for already-acquired, already-allocated units when exact
StockVault custody and every independent delivery wall are healthy.

If the exact Stock Token becomes permanently frozen, non-transferable, irrecoverable, or unsupported for
delivery, affected allocations become `delivery_impossible_pending_resolution`. They never expire or move
to another cohort. OMERTÀ cannot replace them with an unrelated Stock Token, general treasury ETH, $OMR,
game cash, or synthetic internal credit. The Safe may resolve them only from value actually recovered from
that exact holding, such as a verified RHJ redemption or liquidation, successor corporate-action
consideration, or recovered original units. Distribution is pro rata under the original cohort weights and
cannot exceed what OMERTÀ actually recovered. Deterministic rounding residue remains assigned to that same
cohort, not the general treasury. If nothing is recovered, the obligation remains permanently visible and
unresolved. Any resolution needs fresh evidence, one authorized RWA reviewer, exact Safe-authorized
calldata, finality, synchronization, and a public conservation calculation.

Automatic delivery to an extracted Street Deed TBA remains the default, but a user may set a reversible
`delivery_hold` for every Stock Token or for one exact immutable asset version. The hold preserves the
allocation permanently and does not forfeit, expire, redirect, sell, redeem, substitute, convert, or grant
cash, interest, yield, priority, compensation, or voting power. Clearing it restores the allocation's
original FIFO position. The keeper checks the hold immediately before staging and again before broadcast.
A hold added after staging but before broadcast releases the stage without changing `delivered`; once a
transfer is broadcast, a hold cannot cancel or reverse its canonical result. Idempotent rapid toggling cannot
reserve batches or starve others, and a held allocation does not block later eligible allocations. The board
may show `user_held`, while hold controls remain authenticated. Death, inactivity, logout, or an indefinite
hold never causes forfeiture; the allocation stays tied to the designated Street Deed TBA.

Before binding to a deed, an allocation is beneficially the qualifying account's and remains
`awaiting_deed`. A Street Deed is eligible only after its extraction is canonically finalized, its ERC-6551
TBA is deterministically derived, and the account currently owns it. If the account has exactly one eligible
deed, that deed automatically becomes its `rwa_delivery_deed`. If multiple eligible deeds exist, the server
does not silently choose by age or value; the authenticated user designates one primary deed. Establishing
that primary binds all unbound allocations and future allocations to its exact chain ID, deed contract,
token ID, and TBA. Each allocation binds whole and cannot be split. Changing primary affects only still-
unbound and future allocations; a bound destination is immutable. Selection freezes a destination identity
but itself creates no transfer, delivery, fee, tax, allocation, or ownership event.

Once bound, a pending allocation travels with that exact Street Deed and TBA. Finalized deed transfer gives
the recipient control of Stock Tokens already held by the TBA, already-bound pending allocations, and their
delivery holds. Qualification and cohort history remain attributed to the original activity and are not
re-scored to the recipient. Existing holds persist through transfer; after transfer finality the new owner
may change them and the former owner immediately loses authority. Delivery remains addressed to the same
TBA even during a staged transfer. Before sale, the public deed view discloses aggregate pending allocations,
their exact immutable versions, delivered and undelivered amounts, quarantine/health/delivery-impossible
status, and any hold. OMERTÀ does not price, guarantee, or intermediate the sale. Transfer creates no
reallocation, duplicate allocation, substitution, re-scoring, or new cohort entry.

No one may discretionarily redirect a bound allocation. That includes the user, RWA reviewer, support,
database administrator, keeper, and an ordinary Safe action; another deed, EOA, TBA, character, or account
cannot be substituted. Lost wallets, recovery requests, inactivity, death, sanctions, and sale disputes do
not create redirection authority. Recovery follows control or transfer of the Street Deed and the current
owner's wallet-recovery mechanism. The only exception is a verified protocol-wide Street Deed/TBA migration
required by a contract defect or chain migration. It must map every affected deed deterministically one-to-
one, preserve the current on-chain deed owner and all allocation fields/history, use exact Safe calldata,
publish the complete old-to-new map and conservation proof, and reach canonical finality plus synchronization.
It cannot be used for an individual rescue. Delivery pauses until a valid migration completes.

Automatic Stock Token delivery gas comes by default from a dedicated, separately accounted RWA delivery-operations
ETH budget funded by the operator or Safe, or an explicitly designated protocol-operations source. Users
pay no extra delivery charge after the existing Street Deed extraction requirement. Gas cannot reduce a
user allocation, cohort-held Stock Tokens, pooled Stock Token acquisition ETH, withdrawal reserves, $OMR,
game cash, or another user balance. Funding creates no allocation, priority, claim, repayment right, or
yield. The keeper obeys a Safe-set fee ceiling. An empty budget or excessive network fees pause delivery as
`delivery_gas_unfunded` or `delivery_gas_above_ceiling`, preserving every allocation and its FIFO priority.
The board shows the reason, operations balance, gas ceiling, and oldest delayed allocation; the keeper may
not sell or skim Stock Tokens to reimburse itself. Gas accounting publishes transaction hash, gas used,
effective gas price, ETH spent, funding-source category, and remaining operations balance.
This automatic-gas rule does not restrict the designated `mainOperator` from explicitly moving pooled ETH
into the gas budget or anywhere else; that action is a public pool-reducing `operator_outflow`, not a hidden
delivery charge.

Token quantities use integer atomic units. The actual Stock Token contract's `decimals()` is read, bounded,
and cached under the exact immutable version; floating-point balances are never ledgered. For each daily
cohort, the server computes exact activity-weighted pro-rata entitlements, assigns every integer floor, and
then distributes all remaining atomic units by largest fractional remainder. Equal remainders are broken by
stable immutable account ID ascending, never name, family rank, arrival time, or operator choice. Cohort
allocations must sum exactly to its purchased atomic units. If units are fewer than eligible accounts, a
zero award is recorded publicly as `qualified_rounded_zero` with its weight and result, but creates no
phantom token liability. Fractions do not carry into another day, version, or cohort. Every positive
allocation, including one atomic unit, remains permanent without a dollar-value threshold. Several rows for
the same deed and version may be delivered together while their row-level audit history stays enumerable.

Delivery batches isolate items. The keeper aggregates all currently deliverable positive undelivered rows
for the same exact deed TBA and asset version into one immutable-ID item for the full staged amount. A
bounded transaction may contain several deed/version items, but one recipient-specific restriction, revert,
or false return does not undo unrelated successes. A canonical per-item result names the asset key, deed/TBA,
atomic units, item ID, and transaction. Successful covered rows increase `delivered` only after finality. A
failed item increases nothing, exposes a stable reason, safely releases or retains its stage for diagnosis,
and links later transaction attempts to the same logical item ID. A token-wide or inventory/conservation
failure halts the entire version. Confirmed delivered units can never exceed allocated units, and staged plus
delivered units can never exceed held inventory. Retries, duplicate logs, reorgs, and restarts cannot double-
confirm a row. Batch caps cannot alter FIFO, permanently skip an inconvenient recipient, or favor larger
allocations.

A purchase's allocatable unit count comes from actual custody, not a quote or receipt. Router success,
nominal output, venue reporting, and transfer events remain evidence, but after canonical finality the server
serializes against every movement of that exact token and records the custody vault's pre-purchase and post-
purchase balances. It computes `receivedUnits = postPurchaseBalance - prePurchaseBalance` and binds the
transaction, exact asset key, custody address, and block references. Allocation freezes only after a verified
positive delta. A claimed-output mismatch becomes public `acquisition_amount_mismatch` and blocks allocation
until reconciliation. Rebasing, fee-on-transfer, reflection, elastic-supply, and other non-standard balance
tokens are ineligible by default. Supporting one later requires a new immutable version, purpose-built
Safe-approved accounting adapter, fresh nomination and review, and explicit conservation testing.

The daily purchase cap applies to total ETH committed as the ballot's trade input, including venue, router,
or liquidity fees taken from that input. Network gas is separate operations expense. Every net Stock Token
atomic unit actually received is allocated; OMERTÀ takes no protocol skim. Canonically unconsumed or refunded
ETH returns to the pooled Stock Token acquisition budget without enlarging that day's allocation or allowing
a second ticker. Permitted slippage is reflected in the lower actual unit count; execution outside the
approved bounds reverts. No treasury, operator, Safe owner, family, broker, or keeper compensates ordinary
slippage or captures favorable execution. The public purchase shows intended ETH input, actual ETH consumed,
refunded ETH, received atomic units, effective execution price, oracle/reference price, deviation, venue and
adapter, plus separate network gas.

Every closed ballot has immutable `purchaseUntil = closed_at + 2 hours`. Worker downtime, provider outage,
high gas, quarantine, failed/replaced transactions, operator delay, stale quotes, contention, and retries do
not extend it. The purchase must be included with `block.timestamp <= purchaseUntil`; later finality and
synchronization remain valid. Before the deadline, one logical purchase intent may retry reverted, dropped,
cancelled, or safely replaced attempts, but only one canonically successful transaction may complete. Any
positive output satisfying `minOut` and the price bounds—including a venue-described partial fill—is final
for the day, with no top-up. Unused or refunded ETH stays pooled. If none succeeds before the boundary, status
becomes `purchase_window_missed`, the day buys nothing, and it is never replayed or substituted. A late
transaction reverts on-chain. Public history links every dropped, cancelled, reverted, replaced, successful,
or expired attempt to the same ballot intent.

The execution venue, router, or liquidity pool cannot serve as its own independent reference-price oracle.
Each exact asset version has Safe-approved sources and needs at least one independently governed valid price;
when several valid sources exist, prices are normalized for decimals and quote direction and their median is
used. A snapshot is usable for at most five minutes and binds the asset key, source, observed price, price
decimals, quote currency, observation time, round or sequence ID, and evidence hash. Each version has a
Safe-set maximum execution deviation, but the contract enforces a hard ceiling of 500 basis points (5%) that
only a reviewed contract upgrade may raise. The buyer checks both `minOut` and effective execution price
against the independent reference with direction and decimal guards. Missing, stale, malformed, zero,
negative, inconsistent, or wrong-asset data fails closed. There is no fallback to the venue quote, prior
close or day, operator-entered value, or unverified cache. Public history names the used source or median and
every source rejected as stale or invalid.

Daily family ballots continue through weekends, holidays, and other market closures, preserving their vote
result, but a calendar alone never proves tradability. During the immutable two-hour purchase window the
exact Stock Token must be healthy and transferable, the approved venue executable, an independent reference
no older than five minutes, and every price, exposure, liquidity, and inventory check valid. If those
conditions never converge, the ballot becomes `market_unavailable`, buys and substitutes nothing, and leaves
ETH pooled while preserving its vote. A stale prior close is never used. Weekend, holiday, trading halt,
oracle maintenance, or RHJ venue pause grants no deadline extension or Monday catch-up. A genuinely live
off-hours venue may execute when the independent oracle is fresh. Public reason codes distinguish
`underlying_market_closed`, `venue_unavailable`, `oracle_unavailable`, `oracle_stale`, `asset_halted`, and
combined causes.

The buyer can call only an exact Safe-approved adapter address and deployed code hash on the configured
chain; adapters accept neither arbitrary call targets/calldata nor `delegatecall`. Each attempt binds chain
ID, ballot and logical-intent IDs, exact asset key/output token, custody-vault recipient, maximum ETH input,
`minOut`, oracle snapshot/evidence hash, maximum deviation, `purchaseUntil`, and a per-attempt deadline no
more than five minutes after construction and never after the purchase deadline. The adapter cannot redirect
or retain output, approve an unrelated spender or unbounded allowance, or send residual ETH outside approved
acquisition/custody paths. Private submission is preferred but is not a security boundary; public-mempool
submission is permitted only because every identity, recipient, input, price, and deadline wall is enforced
on-chain. A retry may refresh quote/oracle and lower input within remaining authority, but cannot exceed it or
automatically widen slippage/deviation. Revocation blocks future attempts only. Adapter or proxy code change
and code-hash mismatch require fresh Safe approval and security verification; they do not create a new Stock
Token version unless its immutable identity changes. Targets, code hashes, parameters, submission route,
replacements, and results remain publicly auditable.

Acquisition ETH defaults to a separate `RwaAcquisitionVault`. Its ledger separates canonical inflows,
purchase reservations, finalized spend, refunds, available acquisition ETH, and unattributed balance surplus.
Normal release goes only to the approved buyer for an exact ballot, asset key, maximum input, deadline,
adapter, and logical intent; unused ETH returns to the vault. The Safe may pause, tighten caps, or revoke
buyer/adapter authority, but cannot arbitrarily sweep. The publicly designated `mainOperator`, however, may
unilaterally transfer any amount of available, unattributed, or reserved vault ETH to any address for any
purpose, without Safe approval, destination allowlist, purchase/exposure caps, or timelock. Moving reserved
ETH first cancels or invalidates affected purchase intents. Every call emits `operator_outflow` with operator,
recipient, amount, reason code, nonzero details hash, pre/post balances, accounting buckets, and impacted intents. It cannot move
Stock Tokens or rewrite allocations. The vault adjusts its buckets so reserved plus available plus
unattributed ETH equals its remaining balance. This is an explicit main-operator trust assumption; the vault
is not represented as unsweepable or strictly acquisition-only.

The vault exposes exactly one current `mainOperator` address at a time; the zero address disables operator
outflows. It also exposes any `pendingMainOperator`, the proposal and acceptance times, and the operator-role
generation. Deployment publicly declares the initial address. The Safe may disable the role immediately by
setting it to zero. Zeroing atomically cancels any pending nomination, increments the role generation, and
invalidates every outstanding signed outflow. Re-enabling even the same address requires a new public Safe
nomination, an acceptance time at least 48 hours later, and acceptance by the nominated address itself. The
nomination expires seven days after that acceptance time; late acceptance fails and requires a fresh
nomination. The Safe may cancel sooner. Until acceptance, the old address remains the operator unless disabled;
acceptance atomically publishes and installs the new address. This delayed process governs Safe-driven
appointment and restoration from a zero operator; an active operator has the separate instant-replacement path.

The active `mainOperator` may directly call `replaceMainOperator` to install any nonzero, different successor immediately,
without Safe approval, nomination, acceptance delay, or timelock. The call cannot be relayed and requires
`msg.sender == mainOperator`. The successor consents in the same transaction through an EIP-712 acceptance
binding the action, chain ID, verifying vault, current operator, proposed operator, current role generation,
`issuedAt`, and acceptance deadline. Consent requires `issuedAt <= block.timestamp <= deadline`, a deadline later
than issue time, and an interval no longer than one hour. Future-issued, expired, zero/reversed, or over-hour
consent fails before mutation. An EOA must recover exactly; a smart wallet must return the exact ERC-1271 magic value,
with every failure handled before mutation. Success cancels any pending Safe nomination, installs the successor,
increments generation, invalidates old-operator authorizations, preserves `nextOutflowNonce`, and publishes the
old/new operator and generation. The former operator loses authority immediately in canonical ordering, while
the Safe retains immediate zero-disable. Replacement moves no ETH and changes no bucket, reservation,
allocation, or purchase cap.

Once installed, smart-wallet operator identity follows the `mainOperator` address rather than a pinned runtime
code hash, proxy implementation, owner set, module set, or signature policy. Later wallet ownership, module,
implementation, or code changes do not automatically rotate or disable the operator or increment its generation.
Every action still validates the address's current direct execution or ERC-1271 behavior. Public monitoring
surfaces code hash, detectable implementation, owner/module/configuration changes, validation failure, code
appearance or disappearance, and last-check time as `operator_wallet_changed` or
`operator_wallet_health_unknown` warnings without changing authority or pausing action. A direct call proceeds
when `msg.sender` is the current operator; a relay proceeds when current EOA/ERC-1271 validation succeeds
on-chain. The Safe may zero-disable immediately. If relay validation becomes impossible, relay fails closed; if the address
can no longer originate a direct call, Safe restoration is the recovery path.

The operator-wallet watcher checks code, detectable implementation, owners, modules, configuration, and
validation behavior at least every five minutes. Information older than ten minutes becomes
`operator_wallet_health_unknown`. Before the server constructs or relays any operator transaction, it
synchronously attempts a fresh check and publishes `last_checked_at`, `last_changed_at`, `last_healthy_at`, the
observed identity/configuration, warning, and failure reason. Watcher or refresh failure records a warning but
does not veto the transaction; the contract's current caller/signature validation is authoritative. Direct
on-chain calls never depend on watcher, server, or API availability.

Every operator-role transition carries a public reason code and nonzero `detailsHash`. This applies to instant
replacement, direct renunciation, Safe zero-disable, Safe nomination, nomination cancellation, and nominee
acceptance. The code comes from the same closed `operations`, `security`, `purchase_recovery`,
`migration_bypass`, `retirement`, or `other` taxonomy. Relevant EIP-712/ERC-1271 authorization and direct/Safe
calldata bind both fields. The immutable event includes actor, old/new/pending operator, generation, transition
type, reason, and details hash. Missing off-chain explanation text never blocks a valid role change once the
code and hash are supplied, and public surfaces cannot rewrite the committed record.

ETH that cannot be matched to an approved, identified acquisition inflow—including forced ETH, mistaken
transfers, and unexplained positive balance surplus—is `unattributed`. It is unavailable to the automated buyer
and cannot fund a purchase reservation. A plain receipt is booked unattributed immediately; anyone may call
`syncUnattributed()` to book a positive `vault.balance - accountedBuckets` forced-balance delta without making
it spendable. Only the Safe may publicly reclassify a specified unattributed amount into available acquisition
ETH, publishing reason code, details hash, and old/new buckets. All ordinary ballot, oracle, adapter, purchase,
daily, and rolling caps still apply, and reclassification never revives or retroactively funds an intent. The
`mainOperator` may still withdraw unattributed ETH through `operator_outflow`. Negative accounting drift pauses
as an invariant failure rather than silently reducing any bucket.

Every purchase reservation has one immutable attempt deadline inside its approved two-hour purchase window.
Execution requires `block.timestamp < deadline`; a transaction mined at or after the deadline fails even when
broadcast earlier. At or after the deadline, anyone may permissionlessly and idempotently call
`expireIntent(intentId)`, mark it terminal `intent_expired`, and release its entire remaining reservation to
available ETH except any uncertain portion held in `reconciliation_pending`. Proven unaffected value releases
immediately; uncertain value remains quarantined until Safe reconciliation. The intent cannot be extended, revived,
re-reserved, or executed, and the ballot gets no
substitute or catch-up. Released ETH is available only to later purchases under fresh caps and authority.

Each closed ballot and exact Stock Token version may create at most one logical purchase intent:
`intentId = keccak256(abi.encode(chainId, vault, ballotId, assetVersionKey))`. That ID remains a permanent lifecycle
record from creation through terminal state. Transaction attempts use a monotonic `attemptNonce` and are serialized
under the same intent; at most one registered attempt may be live, and replacements or retries stay linked so only
one transaction can settle canonically. No path may create a second or parallel intent, split a ballot across
intents, change its asset version, or produce more than one success. Success, partial-fill finality, expiry, operator
cancellation, and every other terminal disposition permanently prevent recreation or further execution. A second
creation attempt fails without changing any reservation, bucket, clock, or history.

Only the currently Safe-approved `RwaStockBuyer` may create the intent and reservation. In one atomic transaction it
revalidates the finalized closed ballot, deterministic intent ID, exact active and healthy Stock Token version, zero
accounting deficit, sufficient unreserved available ETH, per-buy/daily/rolling/concentration caps, approved adapter
and current code identity, fresh independent oracle and deviation wall, and a still-future immutable deadline. Only
after every check succeeds does it persist the intent, reserve ETH, initialize attempts, and consume the next
`accountingSequence`. Any failed check or competing creation reverts completely: no intent or tombstone, reservation,
bucket change, attempt nonce, or sequence consumption. Creation may be tried again before the same unchanged
deadline, and buyer approval bypasses none of the walls.

After creation, any address may call `executeIntent(intentId)` before the deadline. The call accepts no caller-chosen
asset, recipient, input ceiling, adapter, oracle/deviation limit, output destination, or deadline. It uses the stored
intent and current approved registry state and revalidates activity, health, deficit, reservation, caps, adapter/code
identity, fresh oracle/deviation, and time at inclusion. A caller may choose execution timing only inside that bounded
envelope, pays its own network gas, and receives no fee, rebate, refund, Stock Token, approval, or other economic
benefit. All output goes to `StockVault`; unused or returned ETH goes to `RwaAcquisitionVault`. Permissionless callers
cannot create, edit, cancel, reserve for, or redirect an intent. Calls are atomic and reentrancy-protected: the first
valid canonical execution wins, while competing, stale, failing, or terminal calls revert without accounting mutation
or sequence consumption.

Pre-adapter validation failures revert without consuming `attemptNonce`, changing accounting, or creating an attempt
record. Once execution actually invokes the approved adapter, the attempt consumes the next nonce and receives one
immutable public result. A revert, false return, or zero Stock Token output is a retryable `attempt_failed` only when
canonical pre/post vault and custody balances prove zero ETH debit and zero Stock Token output. The intent and
reservation then remain active for a sequential retry before the same deadline. Any nonzero or unexplained ETH debit,
refund, token receipt, or custody delta instead marks `attempt_reconciliation` and blocks another execution or final
settlement until an explicit public reconciliation transition accounts for it. A consumed nonce and result can never
be erased or overwritten.

Only the Safe may finalize an `attempt_reconciliation`, classify its value effects, release quarantined ETH, or
declare the attempt reconciled. The current `mainOperator` may append evidence and a proposed disposition, but that
submission is informational: it cannot alter buckets, custody facts, terminal state, or `accountingSequence`, and it
cannot authorize the operator or a relayer to finalize. Safe finality binds the exact intent and consumed attempt
nonce and includes the ordinary public reason code and nonzero details-hash commitment.

Safe reconciliation publishes the actual ETH debit, cumulative verified refund, Stock Token custody delta,
canonical transaction provenance, resulting disposition, and complete pre/post balance, buckets, deficit, and intent
state, and consumes the next `accountingSequence`. A positive valid Stock Token custody delta is the intent's final
fill at the actual received amount. Only those units may be allocated, and there is no top-up, second fill, substitute
purchase, or catch-up. Zero or invalid custody output cannot be represented as acquired stock; unexplained residual
value remains quarantined.

If cancellation or the immutable deadline arrives during reconciliation, the intent becomes terminal for execution
immediately. Proven unaffected value releases normally, but the unresolved portion moves from the reservation into
the nonspendable `reconciliation_pending` bucket and cannot fund another reservation. Only later Safe reconciliation
may release the amount proven unspent while booking actual debit, refund, and output from canonical evidence. Neither
the terminal transition nor reconciliation may revive the intent, retry it, replace its purchase, provide a
substitute, or create catch-up authority.

The contract—not figures supplied by the Safe—derives or strictly caps every reconcilable ETH debit, verified refund,
and Stock Token output from immutable pre-adapter balance snapshots, current canonical `RwaAcquisitionVault` and
`StockVault` balances, and already-recorded canonical refund and provenance records. The Safe chooses the disposition
and commits reason, details, and evidence, but cannot override those observations, over-credit output or refund, hide
debit, or enter unsupported value. An inconsistent reconciliation reverts before any bucket, intent, allocation,
`accountingSequence`, or custody-state mutation.

`reconciliation_pending` has no timeout, abandonment path, presumed outcome, or automatic release. Passage of time,
deadline age, Safe inactivity, unavailable signers, or missing off-chain evidence never turns uncertainty into
available ETH. The amount and its age remain public indefinitely until the Safe completes a valid contract-bounded
reconciliation. Safe signer recovery and incident escalation provide liveness; accounting never guesses.

The current `mainOperator` nevertheless retains raw `operator_outflow` authority over actual ETH accounted in
`reconciliation_pending`, consistent with its disclosed unilateral sweep power. The transfer cannot finalize or
classify reconciliation, release value into available ETH, erase or reduce the unresolved liability, or represent
missing ETH as reconciled. It consumes the normal outflow nonce and `accountingSequence`, publicly debits backed
quarantine, identifies affected reconciliation records, and publishes complete pre/post balance, quarantine,
liability, and deficit. Any resulting unbacked liability remains an explicit accounting deficit under the existing
automation pause and repair rules until canonical evidence and actual funding resolve it.

Each reconciliation attempt and the vault-wide aggregate separately expose `reconciliationLiability`,
`backedQuarantineEth`, and `reconciliationShortfall`, enforcing
`reconciliationLiability = backedQuarantineEth + reconciliationShortfall` after every mutation. Any positive
shortfall joins vault-wide `accountingDeficit` and globally pauses new intent creation and execution while canonical
deposits, deficit repair, matched or late refunds, reconciliation, expiry, cancellation, and authorized outflow remain
live. No caller, mirror, or authority may hide under-collateralization by collapsing these figures.

If an operator outflow reaches reconciliation backing, its record attribution is automatic: greatest
`backedQuarantineEth` first, then oldest `reconciliationStartedAt`, then lowest intent ID, fully debiting records before
at most one partial debit. Generic canonical repair funding uses one unified deficit-component queue ordered by
`firstObservedAt` or `shortfallCreatedAt`, then numeric `componentTypeCode`, then record ID, fully repairing components
before at most one partial repair. An exact canonical late refund overrides the generic queue and repairs its own
attempt first. Contract-controlled bounded priority indexes, or an audited equivalent, maintain both orders; caller-
supplied ordering, caller-supplied sort proofs, and unbounded historical scans are not authoritative. The operator or
depositor cannot choose a bucket or record; events expose every affected record and aggregate pre/post liability,
backing, shortfall, deficit, and sequence.

The Safe may finalize a factual, contract-bounded reconciliation even when the ETH proven unspent is absent. That
amount becomes a durable terminal `reconciled_shortfall`: no available ETH is fabricated, no liability is erased, and
the intent closes permanently without revival, retry, replacement, substitute, or catch-up. The shortfall and its
original evidence remain append-only until actual funding repairs them.

When real repair ETH reaches a Safe-finalized `reconciled_shortfall` whose immutable disposition proves the ETH was
unspent, the same atomic entry reduces that record's shortfall and liability and credits exactly the repaired amount to
available acquisition ETH. It needs no second Safe action and never reopens or edits the intent. Repair is capped at
the exact missing principal: the protocol creates no interest, penalty, opportunity-cost compensation, damages, yield,
or other extra credit. Repair of a still-unresolved reconciliation restores backing without creating available ETH.

A canonical refund received after terminal or final reconciliation first repairs the exact attempt's
`reconciliationShortfall`. Only the remainder not required for that repair follows the normal terminal-refund
classification; value above proven debit is `unattributed`. This appends a receipt and never reopens, edits, replaces,
or grants catch-up to the old intent. Stock Tokens received after terminal or final reconciliation enter
`unattributed_stock` quarantine keyed by exact token address, immutable asset version, amount, sender, and canonical
transaction provenance. The Safe may only continue holding the exact stock, transfer it to the fixed Safe-approved
recovery vault, or redeem or liquidate that exact token through a Safe-approved recovery adapter. It cannot choose an
arbitrary recipient, retroactively allocate the stock, substitute an asset, or reopen or change the old intent or
allocation. Quarantined units are excluded from distributable inventory, player allocations, and fulfilled-acquisition
totals but included in gross custody, concentration-risk reporting, and every applicable exact-version exposure cap.

Canonical ETH recovered by redeeming or liquidating `unattributed_stock` first repairs the exact originating attempt's
reconciliation shortfall. Any remaining ETH enters the `unattributed` bucket; it does not automatically become
available, allocate to the historical cohort, reopen the old intent, or create a substitute or catch-up. The immutable
recovery record binds late-stock provenance, input units, actual ETH output, exact shortfall repair, remainder
classification, and complete pre/post stock and ETH accounting.

There is exactly one active Stock Token recovery-vault version, bound to chain, address, runtime code hash, and, for a
proxy, implementation address and code hash. Safe rotation is publicly proposed at least 48 hours before execution and
atomically replaces the old version with the new one. Continued quarantine is the emergency fallback; there is no
immediate redirection bypass.

Each recovery adapter is Safe-approved by exact address and runtime code hash and binds one exact input token/version
to a canonical ETH output path, fresh independent price, `minEthOut`, maximum slippage, immutable deadline, and fixed
route. It exposes no arbitrary calldata, caller-selected path, `delegatecall`, persistent approval, or residual token
authority. Recovery succeeds only when canonical ETH is atomically received by the acquisition vault; intermediate
assets remain inside the adapter. Unexpected ERC-20 output receives no recovery credit and, if it nevertheless arrives,
enters exact-token/provenance `unattributed_stock` quarantine.

For custody risk, concentration reporting, and every applicable exact-version exposure wall, quarantined stock is
valued at the greater of its latest fresh independent-oracle market value and last valid acquisition price. If neither
value exists or is usable, new purchases of that exact version remain blocked until valuation becomes available.

Every recovery tranche receives a unique, immutable, domain-separated `recoveryId`. It binds the action, chain, active
recovery-vault address/version/runtime code hash and proxy implementation when applicable, incident, exact quarantine
record and provenance, Stock Token version, exact input units, adapter/code identity, canonical acquisition-vault
destination, independent-oracle observation, `minEthOut`, slippage ceiling, fixed route, Safe authorization
generation/nonce, issue time, and deadline. Only the Safe can create, activate, cancel, or replace it. It expires at the
earlier of one hour after Safe approval and the oracle-validity deadline; expiry, cancellation, any field change, or a
price refresh needs a new one-use ID. Execution rechecks every pinned identity and a fresh independent price, applying
the stricter of the authorized and execution-time oracle floors.

A quarantined balance may be recovered in multiple monotonic partial tranches, each with a separate authorized
`recoveryId` and exact units. A tranche can only reduce `remainingUnits`, never exceed it, and the quarantine record
resolves only at zero. Neither the Safe nor operator has an arbitrary Stock Token sweep. The token leaves only through
its exact active authorization and adapter. Direct transfer is preferred; if an approval is technically necessary, it
is for exact units immediately before use and is consumed or reset to zero atomically. After Safe authorization anyone
may call `executeRecovery(recoveryId)`, but supplies no payload or discretion, chooses no amount, route, recipient, or
output, and receives no reward or refund. The caller or a separately accounted operations wallet pays gas; recovery gas
never reduces recovery credit, acquisition backing, allocations, or player value.

Permissionless execution does not permit permissionless creation or enqueueing. The recovery entrypoint performs a
constant-time exact-ID lookup and accepts only positive units under an active, unexpired, uncancelled, unconsumed
authorization. It rechecks vault, token, adapter, oracle, and proxy code identity in the same call; measures exact
pre/post Stock Token and canonical-ETH balance deltas; uses checked arithmetic, `nonReentrant`, and
checks-effects-interactions; and consumes the tranche and reduces remaining units before external calls, with atomic
rollback on any failure. There is no attacker-sized loop or scan, dynamic route, caller callback or payment, or
caller-selected external call. Malformed, reverted, duplicate, expired, cancelled, and losing-race calls create no
canonical event, incident entry, alert, storage growth, or protocol gas cost—the caller alone pays. A same-ID front-run
can only perform the identical approved action; later copies fail. Fresh-oracle `minEthOut`, maximum slippage, short
expiry, and a fixed route bound sandwich loss. MEV-protected submission is preferred but is not a trusted control.
Rebasing, fee-on-transfer, callback-capable, nonstandard-return, or revert-griefing Stock Tokens require a separately
code-pinned adapter and adversarial balance-delta tests or remain quarantined without blocking unrelated versions. The
Safe or current `mainOperator` may pause recovery immediately; only the Safe may resume, and pausing cannot redirect
stock, consume authorization, change deadlines, or credit recovery.

Successful recovery transitions publish structured canonical IDs, versions, sequences and components, actor and
authority, transaction hashes, units, ETH, blocker changes, code identities, and finality. Bulky, sensitive, or legally
restricted evidence remains off-chain under an immutable content hash. Provisional and finalized streams are separate;
finalized is the default accounting, UI, and export authority, and reorganizations may replace only provisional data.
Canonical history is retained permanently. The UI may show a bounded recent window, but complete cursor-based exports
cover every generation in checksum-addressed pages or files. Anonymous incident and recovery APIs are read-only and use
strict cursor validation, fixed maximum page and body size, cheap indexed lookup, per-origin or token quotas, caching,
and content-addressed precomputed exports. Invalid cursors, duplicates, rejected executions, and transport abuse cannot
cause unbounded scans, canonical writes, alerts, export regeneration, storage growth, or incident amplification;
infrastructure metrics are sampled and retention-bounded separately.

Quarantine and indefinite hold are the complete launch behavior for late or unexplained Stock Tokens. Recovery is
optional, deferred until a real material quarantined balance makes it worth building, and is not an ordinary RWA-launch
blocker. If later activated, recovery remains unavailable and every recovery mutation control remains disabled until
the exact production vault/adapter/oracle/API implementation and deployment manifest exist. Activation requires contract unit tests,
stateful fuzz/invariant tests, malicious-token/adapter/oracle/receiver and reentrancy tests, forked-route
slippage/MEV/reorg tests, API authorization/idempotency/concurrency/body-limit/cursor/export/load/denial-of-service
tests, and independent third-party review of the exact source and bytecode. Every critical or high finding must be fixed
and every remaining finding publicly dispositioned. The manifest binds chain, addresses, compiler settings, source
commit, runtime and implementation code hashes, adapter and oracle identities, test reports, and audit artifact hashes.
Any material contract, proxy, adapter, oracle, authorization, accounting, or write-route change resets the applicable
gate. No placeholder generic executor or recovery write endpoint may ship merely because the design is documented.

If recovery is built, the Safe records every authorization on-chain. Proxy vaults and adapters remain permitted—there
is no non-upgradeable requirement—but exact proxy and implementation identities stay pinned and rechecked. Safe-set hard
caps limit each tranche, each Stock Token version over rolling 24 hours, and all recovery over rolling 24 hours, with no
operator bypass over Stock Token recovery; the main operator's separate authority over ETH after canonical receipt is
unchanged. Two fresh independent price sources set the more conservative output floor and divergence above 500 basis
points fails closed. V1 accepts only conventional balance-delta ERC-20 behavior. A successful adapter ends with zero
attributable token or ETH residue and zero allowance; forced unsolicited dust receives no recovery credit and is
quarantined. Public APIs return unsigned calldata and never sponsor or relay anonymous gas. Canonical history derives
only from finalized events emitted by pinned contracts. Failed, duplicate, or malformed spam may be rate-limited and
alerted on operationally but cannot automatically pause recovery, open a financial incident, or write canonical history.
Before activation, OMERTÀ publishes a vulnerability-disclosure or bounty channel, independently monitors code identity,
balances, allowances, oracle divergence, recovery rate, and sequence gaps, and rehearses pause, cancellation, and
rotation. These are conditional safety constraints, not a reason to build a recovery subsystem before it is needed.

Ordinary RWA funding does not use an automatic percentage of prior-day protocol revenue and keeps no mandatory minimum
acquisition-vault ETH reserve. The exact maximum ETH budget comes only from backed available acquisition ETH and is
published and atomically frozen before the ballot opens; voting, a winner, later deposits, operator edits, or price
movement cannot resize it. There is no policy minimum economic purchase size, although actual balance, venue minimums,
caps, quotes, slippage, health, and other ordinary execution walls still fail normally.

The MVP may acquire only the Safe-approved provider-native spot Stock Token for the voted underlying. It does not buy LP
tokens, lending receipts, yield wrappers, synthetic equities, derivatives, or bridged wrappers. After allocation, OMERTÀ
may not sell, rebalance, rotate, or market-time the holding. Delivery and the existing mandatory corporate-action,
provider-retirement, legal, or worthless-removal processes are the only disposition paths. Leverage, borrowing, shorting,
options, perpetuals, leveraged tokens, lending, rehypothecation, and collateral use are not permanently prohibited, but
that future optionality authorizes none of them for the MVP.

Verified OMR staking may multiply active-play allocation, but the boost is not live. It will read the same unified actual
on-chain OMR gameplay position used by the Made Ladder, commitment locks, gameplay loss, unbonding, and inheritance—not
a separate `account_persistent.staked` balance. Active-play qualification for human and agent accounts,
NPC/resident exclusion, and recurring 30-day Broker activation remain mandatory. The selected future formula is
`activationMult × activityScore × stakeMult`, so failed activity still produces zero. `stakeMult` uses fixed public tiers
from finalized time-weighted-average eligible principal over the complete seven-day epoch. There is no separate 72-hour
maturity delay: accepted principal contributes pro rata while staked. Each account binds one verified allocation wallet
for an epoch and a wallet change begins next epoch. Liquid OMR, unclaimed rewards, claimed rewards not restaked, and
Broker-activation spend do not count. The approved cap is 1.50×: below 300 OMR receives 1.00×; 300–999.999… receives
1.10×; 1,000–4,999.999… receives 1.20×; 5,000–19,999.999… receives 1.35×; and 20,000 OMR or more receives 1.50×.
Only finalized active and committed principal qualifies. Pending deposits, idle loot, unbonding, withdrawable, withdrawn,
unattributed, quarantined, and unfunded legacy value do not. One verified wallet may qualify one permanent account per
epoch; every conflicting claim receives zero stake multiplier until resolved. Each finalized transition changes the TWA
prospectively from canonical time with no shortcut, backfill, or retroactive restoration.

Only the Safe may change tiers or thresholds, after at least seven public days, effective no earlier than the first full
epoch beginning after notice. Every epoch freezes the schedule, wallet/account bindings, eligible buckets, activity
formula, activation requirement, and ruleset. A critical defect pauses or cancels that epoch rather than rewriting weights
after participation is known. The replacement custody and settlement baseline is approved but not live: a new
`OMRGameplayVault` has no personal APY, accepts only actual reserve-backed on-chain OMR, enforces commitment/unbonding,
uses one-use typed and rate-bounded chain-first gameplay outcomes, and imports legacy stake only against deposited OMR.
Until that vault, the tier schedule, and anti-flash historical snapshots are implemented and tested, the shipped formula
remains `activationMult × activityScore`; no current stake balance counts silently or retroactively.

Agent accounts have full economic parity in this design. Their verified EOA or ERC-1271 controller wallets may deposit,
stake, commit, partially unbond, withdraw, survive inheritance, receive idle loot, lose eligible principal through
canonical gameplay settlement, build finalized Broker stake TWA, and receive Stock Token allocations and delivery under
the same activity, activation, wallet-uniqueness, consent, exposure, finality, solvency, and launch gates as human wallets.
The agent flag still excludes human-only faucets and status rewards; it never denies vault authorization, settlement,
checkpoints, Broker weight, RWA allocation, or delivery.

Portfolio views lead with actual Stock Token units, acquisition reference and cost, allocation epoch, delivery state, and
custody destination. Estimated market value is secondary, timestamped, source-labeled, and stale-aware, never presented
as guaranteed cash, yield, or redeemability. New RWA complexity requires demonstrated recurring material value, measured
user demand, or an actual failure mode plus written Safe scope, authority, invariants, tests, and operating owner.

Any positive reconciliation shortfall or operator debit of reconciliation backing emits an immediate critical alert
and keeps the RWA operator UI in a persistent red incident state. It shows aggregate and per-record liabilities,
backing, shortfall, age, affected intent and attempt IDs, last quarantine outflow, vault deficit, and purchase-pause
state. Every zero-to-positive transition creates a new immutable `incidentId`; alerts, acknowledgments, outflows,
repairs, and reconciliation actions append to that generation. It closes only after finalized canonical zero is
synchronized into the mirror, and a later recurrence creates a new ID. The Safe or current `mainOperator` may submit a
signed public acknowledgment bound to the exact `incidentId` and, for operator authority, current operator generation.
Acknowledgment may silence duplicate notifications only; it cannot clear, downgrade, conceal, resolve, unpause, or
mutate the incident's financial state.

A reconciliation shortfall or acquisition accounting deficit pauses new purchase-intent creation and execution but
does not pause delivery of Stock Tokens already acquired and allocated when exact `StockVault` custody and every
delivery invariant remain healthy. Asset quarantine, custody mismatch, delivery hold, insufficient delivery gas, fee
ceiling, stale token health, and every other independent delivery wall still apply. Continuing delivery creates no new
allocation or purchase.

If the canonical RWA accounting mirror is more than ten minutes stale or cannot prove finalized
`accountingSequence` continuity, the operator UI remains red and shows `incident_state_unknown_stale`; it never renders
green. It disables new risk-creating purchase controls while keeping recovery funding, reconciliation, cancellation,
expiry, and otherwise-authorized operator outflow controls available. Stale display state neither invents an on-chain
incident nor resolves a real one.

A reconciliation incident closes only when finalized canonical state simultaneously proves aggregate
`reconciliationShortfall == 0`, vault-wide `accountingDeficit == 0`, every affected record's liability/backing
invariant, continuous `accountingSequence`, and synchronized public-mirror state. Acknowledgments do not affect closure.

Purchase blocking uses independent composable reasons, including manual Safe/operator pause, reconciliation deficit,
stale accounting mirror, token quarantine, oracle failure, and exposure cap. Clearing one reason removes only that
blocker. Purchases resume only when no applicable blocker remains, so automatic deficit clearance never clears a
manual or unrelated pause.

If a contract-maintained debit or repair priority index disagrees with immutable records, new purchases pause and
anyone may rebuild the index deterministically in bounded chunks. The completed root must equal the root derived from
immutable records; the Safe and operator cannot choose order, and dependent mutations remain unavailable until the
rebuild proves complete.

Every operator outflow or generic repair supplies a public positive `maxComponents`. The complete requested transfer or
repair must be accountably processable within that bound or the transaction reverts before any mutation or ETH
transfer. A large action may be split across sequential transactions, each preserving the same deterministic order.

Public incident history uses an immutable cursor ordered by `accountingSequence`, `componentIndex`, and stable event ID.
Offset pagination and mutable latest-first authority are forbidden. The UI defaults to the active or most recent
incident while allowing complete export of every generation, including cursor continuity and canonical reorg/finality
status.

The Safe or current `mainOperator` may immediately call
`cancelIntent(intentId, reasonCode, detailsHash)` for an active intent without transferring ETH. Cancellation uses the
existing closed reason taxonomy and a nonzero details hash, marks terminal `intent_cancelled`, releases the complete
remaining reservation to available acquisition ETH except any unresolved `reconciliation_pending` portion, and
consumes the next `accountingSequence`. Its immutable record
publishes actor and authority, reason/details, released amount, intent/attempt state, and complete pre/post accounting.
It cannot revive, substitute, extend, replay, split, re-reserve, allocate, or create catch-up, and does not rewrite the
ballot, asset, prior attempts, or deposit history. Canonical inclusion order decides cancellation versus execution,
expiry, refund, or operator outflow; the first valid transition wins and later incompatible calls fail without
mutation. Either authority can therefore abort a planned RWA purchase even when no ETH leaves the vault.

The current `mainOperator` may cancel directly or authorize a relayer through EIP-712/ERC-1271. The typed
authorization binds action, chain, vault, operator generation, exact intent ID, reason code, nonzero details hash,
exact `nextIntentCancelNonce`, `issuedAt`, and deadline. Its lifetime is at most one hour, future issue time is invalid,
and direct and relayed operator cancellations consume the same monotonic cancellation nonce independently of
`nextOutflowNonce`. Safe cancellation consumes neither operator nonce. Replacing, renouncing, or zero-disabling the
operator invalidates all older-generation cancellation signatures.

The Safe or current `mainOperator` may immediately pause new intent creation and execution with a closed public reason
code and nonzero details hash; only the Safe may unpause. Canonical deposits, deficit repair, matched refunds,
reconciliation, permissionless expiry, explicit cancellation, and otherwise-authorized operator outflows remain
available. Existing deadlines continue to run without extension, tolling, revival, substitute, or catch-up, while
reservations remain governed by their normal expiry and cancellation rules. Every pause or unpause publicly records
actor, authority, operator generation, reason/details, and inclusion time.

A refund is matched only through its exact intent, approved attempt, adapter or sender, and canonical
transaction provenance. Cumulative matched refund cannot exceed the attempt's actual debited ETH. While the
intent is active, a verified refund restores that intent's remaining reserved capacity only up to its original
bound, allowing an otherwise-valid retry before the unchanged deadline. After cancellation, `intent_expired`,
successful finalization, or any other terminal state, a verified refund first repairs the exact attempt's
reconciliation shortfall, if any; only the remainder becomes available acquisition ETH. It never reopens the intent,
ballot, allocation, purchase window, substitute, or catch-up. Unknown-intent,
unprovable-sender/provenance, and above-debit excess refunds are `unattributed`, not available. Every receipt
publishes sender, amount, known intent/attempt, provenance, cumulative debit/refund, resulting classification,
and pre/post buckets. Safe reclassification and main-operator withdrawal then follow the unattributed rules.

Only a currently Safe-approved acquisition ingress contract may credit canonical acquisition ETH. Every
positive deposit has
`depositId = keccak256(abi.encode(chainId, sourceContract, externalPaymentReferenceHash))`; caller and source,
nonzero external reference, and `msg.value` must match. A duplicate ID reverts instead of replaying or
double-crediting. Success credits available ETH and publishes deposit ID, chain, source, reference hash, amount,
approval version, and pre/post buckets. Safe ingress approval and revocation are public and forward-only. Direct
receipt, unapproved source, missing or malformed reference, source mismatch, and forced ETH stay `unattributed`
and cannot acquire canonical identity through later synchronization.

Each Safe ingress approval binds the exact chain, source address, source runtime code hash, and approval version.
For a proxy it also binds the resolved implementation address and implementation runtime code hash. The canonical
deposit path revalidates every bound field before consuming a deposit ID or crediting a bucket. Any source-code,
proxy, or implementation change requires a fresh public Safe approval version; a mismatch reverts the canonical
call. Plain or forced ETH that still reaches the vault remains `unattributed`. Approval and revocation are
forward-only: deposits accepted under an earlier approval remain canonical history, and their deposit IDs remain
consumed forever.

Each acquisition vault has at most one active canonical ingress approval version: one exact version or the
disabled/zero state. Safe rotation atomically deactivates the old version and activates the new one; there is no
overlap, grace period, or dual-source window. A canonical deposit must name and match the version active when its
transaction is included. Broadcast or mempool time grants no grandfathering: an old-version call included after
rotation reverts before accepting ETH, consuming its deposit ID, or changing accounting. Plain or forced ETH that
still arrives is `unattributed`. Canonical chain order resolves same-block rotation/deposit races, while all prior
accepted deposits, consumed IDs, and approval history remain unchanged.

During a positive accounting deficit, a canonical deposit consumes its deposit ID once and records
`deficitRepairAmount = min(msg.value, deficitBefore)` and
`availableCreditAmount = msg.value - deficitRepairAmount`. The repair portion raises actual balance and reduces the
deficit without crediting a bucket; only the available-credit remainder increases available acquisition ETH. The
repair portion uses the unified queue ordered by `firstObservedAt` or `shortfallCreatedAt`, numeric component type, then
record ID, fully repairing components before at most one partial repair; the sender cannot choose a record or bucket.
An exact late refund stays bound to its own attempt. If the assigned component is a finalized proven-unspent
shortfall, the same entry retires the repaired principal and credits exactly that amount to available under its
immutable disposition. The
immutable deposit record publishes total value, both portions, deficit before/after, approval version, and pre/post
buckets. A repair-only deposit remains canonical provenance but creates zero spendable ETH, and no retry or display
may treat its full `msg.value` as available.

The Safe may immediately call `reclassifyUnattributed(amount, reasonCode, detailsHash)` for a positive amount no
greater than the unattributed bucket. The only move is `unattributed -> available`. It transfers no ETH, creates
no reservation, targets no ballot, asset, or intent, revives nothing, bypasses no cap, oracle, adapter, or
deadline, and never books a purchase. The public classification entry is immutable, non-deletable, and
non-reversible; the ETH may later leave only through an ordinary valid purchase or `operator_outflow`.

If accounted buckets exceed actual vault balance, public state reports
`accounting_deficit = accountedBuckets - vault.balance` with the first-observed block/time, cause, last
reconciliation, and pre/post figures. While positive, it blocks automated buying, new reservations, Safe
reclassification, and canonical migration. Existing expiry, cancellation, refund reconciliation, and incoming
ETH remain available to repair state. Every incoming wei first repairs the deficit by increasing actual balance
without crediting a bucket; only value beyond full repair becomes available when canonical or unattributed
otherwise. The `mainOperator` may still withdraw no more than the actual remaining ETH using the fixed
available, then unattributed, then ordinary reserved, then reconciliation-pending debit and cancellation order. The outflow publishes deficit
before/after; because balance and booked buckets fall together, the deficit remains visible. Automation and
migration resume only after public reconciliation proves zero. No role or synchronization path may silently
haircut or erase a bucket or deficit.

Deficit mode clears only after a canonical-chain reconciliation computes `accounting_deficit == 0`, the containing
block reaches the configured finality, and that finalized result synchronizes into the public mirror. Automation and
canonical migration then resume immediately under every normal cap, oracle, adapter, health, deadline, and authority
wall; no Safe acknowledgment, operator acknowledgment, or additional cooldown is required. Clearance does not revive
an expired or cancelled intent, extend a purchase window, replay a missed ballot, or create catch-up authority. The
public reconciliation names its block, transaction, finality, synchronization time, and pre/post deficit, bucket,
and balance state. A later deficit immediately pauses the system again. No role may manually declare zero or bypass
finality.

Every successful atomic vault-accounting entrypoint receives exactly the next monotonic `accountingSequence`. This
includes canonical deposits and deficit repair, unattributed synchronization, Safe reclassification, reservation or
intent creation, purchase debit/finalization, refunds, expiry/cancellation, operator outflow, deficit reconciliation,
and canonical migration. Component effects inside one transaction share the sequence and use deterministic
`componentIndex` order. Each record publishes action, actor, transaction/block position, complete pre/post vault
balance, available, unattributed, reserved, accounted-bucket total, and deficit, plus affected intent/bucket deltas.
Reverts and true no-ops consume no sequence. Canonical on-chain inclusion order is authoritative; worker timestamps,
API arrival, and database time cannot reorder or invent mutations. Public mirrors roll back reorged entries and
expose finalized canonical order. A duplicate sequence, unexplained gap, or pre/post discontinuity is a public
synchronization failure, never silently healed.

An outflow requires either a direct on-chain call from the current `mainOperator` or a relayed EIP-712
authorization by that same current address. The typed message binds the action, chain ID, verifying vault,
operator generation, recipient, amount, reason code, nonzero details hash, exact current global nonce, and
`issuedAt` and deadline. Its nonce is consumed once and never reset by rotation. Expired, replayed, wrong-chain, wrong-vault,
and former-operator authorizations
fail before accounting changes. A backend API key, bearer token, server session, or relayer identity is never
sufficient authority by itself.

Every outflow carries exactly one public reason code from `operations`, `security`, `purchase_recovery`,
`migration_bypass`, `retirement`, `other`, or `reconciliation_outflow`, plus a nonzero `detailsHash` committing to the
canonical explanation bytes. Any outflow that debits reconciliation backing must use `reconciliation_outflow`, and a
generic reason is rejected; the dedicated code is rejected when no reconciliation backing is touched. The caller
cannot choose the accounting bucket or reconciliation record. The code and hash are immutable even if an off-chain explanation later disappears; document
availability never gates execution. Direct and relayed outflows both require the exact `nextOutflowNonce` and
increment that one global counter on success. The current operator may advance past specified signed
authorizations without moving ETH through `invalidateOutflowNonces(newNextNonce)`, which requires a strict
increase, publishes the old/new nonce, and changes no bucket, reservation, allocation, or purchase cap.

A relayed authorization is valid only when `issuedAt <= block.timestamp <= deadline`, its deadline is later
than its issue time, and the complete interval is no longer than one hour. Future-issued, expired, zero/reversed,
or longer-lived signatures fail before signer, nonce, bucket, or reservation mutation. A direct operator call
is live authorization and has no signature-lifetime window, but it consumes the same nonce and reason fields.

Every operator outflow requires a nonzero recipient. OMERTÀ exposes no `operator_burn`, zero-address transfer,
or other intentional ETH-burning action because there is no identified product scenario for destroying ETH.
The vault cannot prove that an arbitrary nonzero destination is recoverable; destination choice remains part
of the explicitly disclosed operator trust.

The current `mainOperator` may directly renounce. Renunciation cannot be relayed and requires
`msg.sender == mainOperator`. It sets the role to zero, cancels any pending nomination, increments the role
generation, and invalidates every outstanding signed authorization just like Safe zero-disable. It moves no ETH
and changes no nonce, bucket, reservation, allocation, or cap. The event publishes the former operator and new
generation. Renunciation itself names no successor; an orderly handoff uses instant `replaceMainOperator` first.

`mainOperator` may be an ordinary EOA or an ERC-1271 smart-contract wallet. Direct execution always requires
`msg.sender == mainOperator`. Relayed authorization uses exact ECDSA recovery when the operator has no code and
the exact ERC-1271 `isValidSignature` magic value for the same EIP-712 digest when it has code. Revert,
out-of-gas, malformed return data, a non-magic response, or signer-type mismatch fails closed before nonce or
accounting mutation. The verifier never falls back from failed ERC-1271 to ECDSA or failed ECDSA to arbitrary
contract validation.

`operator_outflow` sends ETH to the arbitrary recipient with empty calldata only. The vault exposes no
arbitrary-call payload, `delegatecall`, token approval, token transfer, or Stock Token/NFT movement. A contract
recipient's payable `receive` or fallback may run, protected by checks-effects-interactions and a reentrancy
guard. Transfer failure rolls back the entire outflow. Any richer interaction occurs from the operator or
recipient after the ETH has left, without vault authority.

Operator outflow debits available ETH first, unattributed ETH second, ordinary reserved ETH third, and
`reconciliation_pending` ETH last; the caller cannot select a bucket. If ordinary reservations are needed, the vault cancels the minimum number of whole purchase intents by
sorting live reservations by amount descending, then later execution deadline first, then intent ID ascending,
and cancelling until the shortfall is covered. It never leaves an intent partially funded; excess released by
the cancelled reservations becomes available ETH after the transfer. If reconciliation backing is still required,
the vault debits the greatest backed amount first, then oldest `reconciliationStartedAt`, then lowest intent ID,
fully exhausting records before at most one partial debit. The transaction immediately publishes
each cancelled intent and an `operator_outflow` containing the operator, authorization path, recipient, amount,
reason code, details hash, nonce, affected intents, and pre/post balances and accounting buckets. A failed ETH transfer rolls
back the accounting and cancellations. Public boards expose operator identity and rotation, outflows, and
cancelled reservations.

Normal purchases simultaneously obey their ballot input, a Safe-set per-purchase ETH cap, citywide daily ETH
cap, exact-version rolling-30-day ETH cap, and available unreserved balance. Actual trade input and fees taken
from it consume capacity; separate gas and unsuccessful attempts do not. Success atomically consumes daily
and rolling capacity. The Safe may lower caps immediately; if already-used capacity is higher, nothing is
sold, invalidated, or reallocated, but future purchases wait. Increases require public Safe execution,
canonical finality, and synchronization. A blocked winner becomes `exposure_cap_reached`, buys no substitute,
and leaves remaining ETH pooled. Splitting cannot evade the one-success rule. Public state exposes each cap,
consumed/remaining amount, window, and blocking wall. Main-operator ETH outflows bypass these purchase caps
because they are withdrawals, not purchases, and can never be reported as acquisition.

The canonical state-preserving vault migration remains a public Safe proposal delayed at least 48 hours. It
binds old and successor vaults, successor chain and code hash, full expected amount, old/new accounting-state
hashes, evidence, earliest execution, and expiry. It requires no pending purchase—or deterministic reservation
recreation—plus the same buyer restrictions, fully reconciled balance/state, atomic complete movement,
preserved surplus classification, retired old reservations, finality, synchronization, and public proof.
Emergency response is immediate pause, not a shorter canonical migration delay. Separately, the main operator
may bypass this process and transfer some or all ETH immediately and arbitrarily. Such a transfer is only an
`operator_outflow`: it migrates no reservations or state, certifies no successor, and cancels impacted intents.
On permanent program retirement the main operator may dispose of pooled ETH arbitrarily; if unused, it remains
in the acquisition vault. Public history never labels an operator outflow as locked capital, purchase, refund,
or canonical migration.

The contracts do not call HTTP and do not wake themselves. The hourly worker supplies liveness: it
refreshes the Safe registry mirror, resolves the closed ballot, publishes the immutable day result,
and freezes the completed activity epoch. `RwaStockBuyer` supplies the value walls: one purchase per
ballot, a Safe-set daily ETH cap, an approved venue adapter, a fresh independent quote oracle, and an
exact-token balance check at `StockVault`. The contract enforces whichever output floor is stricter—the
oracle's or the keeper's—so a stolen keeper key cannot relax slippage protection. Production buying
remains disabled until a reviewed venue adapter and quote/TWAP oracle are configured; “the bounded
contract exists” is not the same claim as “the rail is armed.”

---

## 11. The Den

Player-against-house and player-against-player gambling at the Neon Mile. Every game at the den today is
**cash-denominated** — no den game touches $OMR. (The old blanket "cash only, never $OMR" rule was retired by
the founder on 2026-08-21; a $OMR-denominated game is now a designable product, and if one ships it will be
documented here with its own terms.) Every result is calculated on the server and recorded. The house adds 1% of stakes to the
street-tax pool, **only from real profit**. `GET /v1/casino` [public].

- **Street craps** (`/v1/casino/dice`) — the pass line in one action, 1:1, edge about 1.41%, 1 nerve, $100 to
  $250k table ($2M in the high-stakes room — L30 or the Madame's rope, plus the 300 $OMR access stake).
- **The Numbers** (`/v1/casino/numbers`, `/numbers/claim`) — pick a number 0–999, bet $10 to $1000, **one
  ticket each day**, drawn from the daily seed, pays **600:1** (edge about 40%). Claim finished tickets when
  ready.
- **Back-room PvP dice** (`/v1/casino/fade` to list, `/casino/dice/:targetId` to challenge) — you agree by
  listing a fade limit. It uses 2 dice for each player. The winner takes the pot minus a 5% rake.
- **The weekly Fight** (`/v1/casino/fight`, `/fight/claim`) — one bet of up to $5k each week on a favorite
  (which wins 65% of the time). The boss of the family that holds Neon can **fix** the result one time each
  week for $50k from the treasury.
- **The Track** (`/v1/casino/track`, `/track/claim`) — the greyhounds and the horses. There is a **daily**
  race card. Each race has 6 runners with posted odds. The odds include a 15% house share. You make one
  **win** bet for each race each day, $50 to $10k. The winner comes from the daily seed (this is fair; the
  odds carry the house share, not the draw). Claim finished tickets at the posted odds.
- **Rakeback** — owners of a casino business share 1% of the Den's stake volume.

### The Stable — own the dogs & the ponies

You can also OWN racing animals (this uses the boxing-stable pattern). **Buy** a greyhound ($30k) or a
racehorse ($120k) at level 6 or higher (`/v1/stable/buy`). **Train** its speed, stamina, and heart
(`/v1/stable/train/:id`, cash and energy, with a limit). **Race** it. The PvE **circuit** pays a purse
(`/v1/stable/circuit/:id` — the entry fee is lost win or lose; the purse pays only for a win). The PvP **match
race** is against another owner's animal of the same kind (`/v1/stable/match/:opponentId` — you agree by
listing a wager; the winner takes the pot minus a 5% share). You can run up to 3 animals. An animal **dies
when your character dies**. Your lifetime wins are an **owner record** that survives death
(`/v1/leaderboard/stable`). CASH only. **Breed** two animals of the same kind into a foal that inherits their
form (`/v1/stable/breed` — this is a head start, not a way to pass the limit; both parents retire). Enter **The
Stakes** (`/v1/stable/stakes/:id`) — a scheduled major race. A cash buy-in goes into escrow as a purse. The
worker races the field, and the top places share the purse minus a 5% rake. (Mickey the Cornerman — the
Underworld boxing fixer — also trains your animals; his standing reduces the training cost.) **Run in the
card** (`/v1/casino/track/enter/:racerId`) — enter a fit animal into The Track's daily card (its kind's race,
$5k entry fee, up to 2 owner entries a race). The whole town bets on it. The worker records its win for the
animal and your owner record. Track bets now lock **fixed odds** at bet time. So a player animal that enters
in the middle of the day changes the board but does not change settled tickets. **The Futurity**
(`/v1/casino/futurity/nominate/:racerId`, `/v1/casino/futurity/bet`) — the major race where the Stable and the
Track meet. Owners **nominate** their animals ($5k fee, up to 8 in the field). The **whole town bets
parimutuel** on the race (one bet for each player; you cannot bet on a card that has your own animal). At the
window close, the worker races the field on form. The winners share the losing pool minus a 5% share. The
winning owner takes a promoter's purse. The animal records a win. This is different from The Stakes: The
Stakes has owners competing for a pooled buy-in; the Futurity has the crowd betting on the field.

---

## 12. The Speakeasy

There is one prestige **nightclub in each district**. A made man opens it (L15, $750k). It is a business, a
casino, and a social place. It dies when the owner's character dies. `GET /v1/speakeasy` [public].

- **Collect** the bar income (it accrues, 24-hour limit). **Upgrade** the decor levels (Backroom to The
  Cathedral). **Name** it (this costs $OMR).
- **Be seen:** a player in the district can **buy a round** (`/speakeasy/:districtId/round`, a taxed cash
  payment to the owner; it adds the player to the guest list; 1-hour cooldown; 10 visits make a "regular").
  A player can also buy **bottle service** (`/bottle`, a $OMR status payment, for large prestige).
- **The back-room table** (`/table`) — a cash game. The owner takes 3%. It adds **notoriety**.
- **Prohibition raids** — notoriety above 60 causes a raid. The raid takes the pending income, fines the
  owner, and closes the club for 2 hours. One player can only add limited heat to a club each day.
- **Cross-club renown** — a personal nightlife record (Nobody to King of the Night). It unlocks earned decor.
- **P2P buyout** (`/list`, `/:districtId/buy`) — an agreed, taxed sale. The hostile **Standover**
  (`/:districtId/standover`) — pay a $250k fee (lost win or lose), win a muscle contest, and force the owner
  to sell at the club's assessed build value.

---

## 13. The Fights

Sign and manage a **stable of up to 3 boxers** (L8, $50k each). Train the boxer. Fight the boxer against other managers.
`GET /v1/boxing`.

Loop: **recruit** (`/v1/boxing/recruit`, stats power/chin/speed set to 6–14) → **train** (`/boxing/train`,
$20k plus energy, +1 to a stat, limit 25) → **list a bout limit** (`/boxing/list`) → **fight**
(`/boxing/fight/:opponentId`). The bout uses each fighter's three stats plus a random amount. The winner takes
2× the stake minus a 5% rake (this is the same taxed transfer as PvP dice; no new money is created). The
loser's fighter is **in the hospital for 4 hours**. The fighter dies when your character dies. Ranks: Prospect
to Hall of Famer (30 wins).

---

## 14. PvP

**Jump** (`POST /v1/streets/:targetId/jump`) — not lethal. It costs energy and ammo. It steals up to $25k of
pocket cash. It puts the target in the hospital for about 3 minutes. It scores 1 war point.

**The hit (search then fire).** Put a **search** on a target (`/streets/:targetId/search`, about 3 hours to be
ready; cancel it with `DELETE /streets/search`). Then **fire** (`/streets/:targetId/fire`) when it is ready. A
fire costs energy, needs 50 fp or more, has a 2-hour cooldown, and **adds +20 heat**. On a kill, the game runs
the victim's estate. It **takes 40% of the victim's real cars** for you. It **loots** their cash and $OMR (see
section 15). It has a 15% chance to take one piece of gear. It **swears a vendetta**. It pays any open kill
contracts. It scores war points. It earns you **hitman reputation**.

**NPC hit** (`/streets/:targetId/npchit`) — pay a fixed fee (Leg-Breaker $50k to The Professional $1M) for a
hit that the server calculates. **The fee is lost win or lose.** A weak player buys a *chance* against a strong
player, never a certainty. It adds heat, a 6-hour cooldown, and a 24-hour cooldown for each target. It pays no
reputation. You cannot use it against a family member, yourself, a jailed player, a new player (below L5), a
hospitalized player, or a safehoused player.

**The Contract Board** (`GET /v1/contracts` [public]) — bounties are escrow pots that you can view. There is
one pot for each (target, kind). A **hospitalize** pot pays for a jump or a kill. A **kill** pot pays only for
a completed kill. Post a bounty (`/streets/:targetId/bounty`, minimum $500; add 18 $OMR to post it
**anonymously**). You can name a **directed hitman** for an exclusive time window (minimum $10k, up to 24
hours, +1.5× reputation). This minimum is **removed** for a vendetta, rat, welsher, or wanted kill contract. A
**family contract** (`/gangs/contract/:targetId`) is paid from the treasury. The target can **peek**
(`/contracts/peek`, 30 $OMR) to read every funder. This removes the anonymity.

**Hitman reputation** is a status ladder (Associate to Button Man to Mechanic to Ghost to The Undertaker).
Your lifetime reputation and kills survive death (like prestige). This season's kills die with the character.
You earn reputation only from targets at L5 or higher. It is reduced if you kill the same family many times.
`GET /v1/leaderboard/hitmen`, `GET /v1/feud/:characterId` [public].

---

## 15. Make risk pay

A kill is designed to be worth the risk — contracts, war points, and loot all attach to it.

**Loot (only for a PLAYER fire-kill):** the killer takes 25% of the victim's **pocket and in-transit** cash,
**50% of their loose and unbonding** $OMR, and **20% of their staked** $OMR. **Only cleared bank cash is safe** —
staking is cheaper cover, never a safe harbour. (An NPC kill and a mod kill take nothing.) A fire-kill also takes 25% of the victim's open market buy-order escrow and loan-offer
escrow.

**Loot surfaces** — this is why banking is a *timed* action: a new deposit is in transit for 2 hours, and
unstaked principal unbonds for 6 hours. Another player can take both during those times. Bank early. Stake to
be safe.

**Defenses (earned in the game):**
- **Safehouse** (`POST /v1/safehouse`) — the cost increases with your wealth (minimum $25k, or 1% of cash plus
  bank) for each 4-hour stay. A hit cannot target you, but a jump can. It is a **shield, not a base** — you
  cannot attack or move money from inside.
- **Bodyguard** — a guard lists a price (`/v1/bodyguard/offer`). You hire a guard
  (`/bodyguard/hire/:guardId`). The guard **absorbs one lethal hit** (the guard goes to hospital in your
  place). The game never absorbs the guard's own attack — betrayal defeats protection.
- **Revive insurance** (a real-ETH `respawn_token`) — it absorbs a lethal hit completely (full health, keep
  everything, no car loss, no loot, no estate). It is used before the estate runs.

---

## 16. The Law & RICO

The state is the PvE opponent. It reacts to your **heat**. `GET /v1/law` [public] is your record.

**The investigation meter** accrues slowly: heat above a threshold builds **exposure**, which decreases
slowly. Stages: **clean → watched → investigation → indicted** (which locks). A short heat spike costs little.
A long, high heat builds a case.

**Escapes (before it files):** **bribe** (`/v1/law/bribe`, scales with wealth, reduces the meter — blocked
when you are clean, indicted, or safehoused), the **lawyer retainer** (`/law/retainer`, $150k for 3 days,
reduces the bust and forfeiture), and the **envelope** (`/law/envelope`, 90 $OMR for 7 days — a standing
payment that halves the meter's *gain* and doubles its *decrease*).

**The RICO bust.** When you cross the line, the state files an **indictment** (a grace clock starts). A
conviction takes **30% of your pocket and bank** into the confiscation pool and jails you. But **staked $OMR
and minted gear are safe, and this is NOT death** (the Law is an economic opponent; death is PvP only). If you
stay offline past the grace window, the worker force-busts you (so a rich player cannot hide).

**The courtroom:** **plea** (`/law/plea`, a certain smaller loss plus short jail), **buy the jury**
(`/law/jury`, a $OMR payment that reduces the conviction chance), **demand trial** (`/law/trial`, resolve
now).

**Informants (Phase 4):** **flip** (`/law/flip/:targetId`) — drop your own case, add exposure to a rival, and
earn the permanent **rat** badge (it follows your family; a rat loses family omertà). **Witness protection**
(`/law/witpro`) makes you untargetable for a short time. If you kill a witness, the seeds they planted are
removed.

The **Foundation** (section 9) reduces family convictions. **Patrol hours** (section 4) increase convictions.

---

## 17. The Pen

Jail is a **place**. Every Pen action requires that you are locked up. `GET /v1/pen`.

- **Work the yard** (`/v1/pen/work`) — energy for a little cash, and it reduces your sentence (good
  behaviour).
- **The commissary** (`/pen/buy/:item`) — a **shiv** ($5k), a **burner phone** ($25k), a **cutkit** ($50k).
- **Protection** (`/pen/protection`, $15k or 0.5% of your worth, whichever is more) — a period when no one can shank you (the in-jail safehouse; it is
  a shield, so a protected inmate cannot shank either). **Bribe the guard** (`/pen/bribe`, per second) — the
  fast, expensive exit.
- **The shank** (`/pen/shank/:targetId`) — both players must be jailed. You spend a shiv and energy in a
  muscle contest. It passes street defenses but respects a revive token, witness protection, and omertà
  (unless the target is a rat), and protection or the hole. A successful shank is a **real death** (an heir, a
  sworn vendetta) but with **no loot, no car loss, and no reputation** (it is dishonorable). A caught attempt
  costs the shiv, more time, and **the hole** (solitary — you cannot act and no one can shank you).
- **Yard incidents** (a daily draw): Lockdown (no shanks), Riot (higher shank chance), Visit (cheaper
  bribes), Toss (commissary closed).
- **The burner phone** — the only way to reach outside: use it to call an NPC hit from your cell.
- **The breakout** — solo (`/pen/break`, needs a cutkit; a win clears your sentence but you become a **WANTED
  fugitive** for 2 days) or **co-op** (`/pen/break/plan`, `/breaks`, `/:id/join`, `/go` — a crew of 2–4; a win
  frees everyone and makes them WANTED; a loss puts the whole crew in the hole).

---

## 18. Loan sharking

Player-to-player lending — the first PvP credit market. `GET /v1/loans` [public].

**Offer** (`POST /v1/loans`) puts the principal in escrow ($5k to $1M, rate up to 50%, term 1–72 hours;
optional **directed** to a named borrower, or **collateralized** by a car). A borrower **takes** the loan
(`/loans/:id/take`; one active loan at a time; the borrower pledges a car if it is secured, and that car
locks). The borrower owes `principal × (1 + rate)` by the due date.

**Repay** (`/loans/:id/repay`) returns the debt. A 5% vig splits between the street-tax pool and the
Loan House's lending pool. **Cancel**
(`/loans/:id/cancel`) removes an offer that no one took. **Default and collect** (`/loans/:id/collect`, past
due) — the lender takes the pocket and in-transit cash (cleared bank and staked $OMR are safe), takes the
pledged car, sends the borrower to hospital for 30 minutes, and marks the borrower a permanent **welsher** (no
one lends to them again).

A default also marks the borrower **WANTED** for 3 days: it removes omertà (even the borrower's family can hunt
them), it puts a pool-funded $25k bounty on their head (if they are L20 or higher), and NPC hunters look for
them. **Square your name** (`/loans/square`, $50k) clears WANTED, welsher, and the bounty. There is also a
**paper market**: sell an active loan's claim (`/loans/:id/sell`, `/:id/buy`). A lender with muscle can buy
risky paper at a low price.

---

## 19. Convoys

Bulk goods on a real 30-minute clock. They are visible, and players can ambush them. Turf gives protection.
`GET /v1/convoys` [public].

Loop: **open** a shipment from your district with a first load from the trunk (`POST /v1/convoy`) → **load
more** between the trunk and the market (`/convoy/load` — the manifest can be larger than your trunk limit) →
**depart** (`/depart`), and pick a **guard tier** (none, crew $5k, or heavy $20k — this is never public) and
optional **insurance** → it travels 30 minutes → **collect** at the destination (`/:id/collect`, one trunk
load at a time).

The route and a value band are announced, but never the manifest. **Ambush** (`/:id/ambush`) — spend energy,
ammo, and heat in a contest of your muscle and speed against the guards and the turf defense. If you win, you
take goods up to your trunk limit. There are up to 3 hijacks for each convoy (one for each attacker; only a
win reduces the guards). **Tolls** — if you collect at another family's docks, you pay 5% to their treasury.
**Insured** freight pays for a hijack, with a limit so that a group of related accounts cannot take honest
premiums.

---

## 20. Crew heists

The game's co-op content. `GET /v1/heists` [public]. Jobs: a 12-rung ladder from the Corner Store (crew 2,
L4) up to the Federal Reserve (crew 5, L80), plus the Inside Job (crew 2, against a player's business). Each
crew position is a **role** (brains, muscle, wheelman, gun — plus lookout and hacker on the big crews). The
success calculation uses each member's stat *for their role*. So
a crew of specialists can match a crew of generalists at a lower cost.

Loop: a leader **plans** and stakes the cost (`/v1/heists/plan`) → the crew **join** from the board by role
(`/:id/join`) → the leader **executes** (`/execute`), one calculation for everyone. Success divides the pot
evenly (1.2× for the leader). Failure jails the whole crew. **The Inside Job** takes 60% of a player business's
pending income (it refuses a hot, raid-eligible business). **The Rat** (`/:id/rat`) — any member can inform
silently. A ratted job fails automatically. The rat leaves with half the stake. The rest get double jail. The
feed only says "somebody talked." The **solo Daily Score** (`POST /v1/heist`) shares an 8-hour cooldown.

---

## 21. The Black Market

Player-to-player trade. `GET /v1/market` [public]. **Cars sell by auction. Goods sell at a fixed price with a
district pickup. Standing buy orders (WTB) let buyers name a price.** (Gear is not here; its market is the
GearVault on the blockchain.)

- **Car auction** — one standing bid, an optional buy-now, a hidden reserve, and an anti-snipe soft-close. An
  outbid player gets a refund immediately. A listed car locks (no melt, fence, or repair).
- **Goods** — a fixed price. The buyer must **stand at the listing's dock** with trunk space (partial buys are
  allowed). The market cannot move freight past the convoy game.
- **Buy orders** — a buyer escrows quantity × price at their dock. Sellers who stand there fill the order from
  the trunk and are paid at once. The goods wait until the buyer claims them.

Routes: `POST /v1/market` (list), `/:id/bid`, `/buy`, `/cancel`, `/market/order`, `/:id/fill`, `/:id/claim`. A
1% listing fee and a 2% sale fee apply. If the poster is killed, the escrow refunds bidders (and burns their
own).

---

## 22. Vendettas

A **blood feud** starts after a fire-kill — status only, no money. `GET /v1/feud/:characterId` [public]. A
player fire-kill swears the victim's family against the killer's family **for 7 days**. The heir inherits the
feud and gets a message. A **revenge fire-kill inside the window** ends the feud, pays 2× feared-reputation,
and feeds the streets feed. Revenge also **removes the directed-contract minimum** on a kill contract against
your vendetta target. An NPC kill and a mod kill do not start a feud.

---

## 23. Skills

Your character build. **Three branches, FOUR levels each** — the 4th a capstone that also unlocks an
ACTIVE ability. Points **come from your level** (`floor(level/4)`, plus a small prestige bonus — a full
branch is about L40). Skills **die with the character**. Respec for 60 $OMR on the shared 24-hour
cooldown. `GET /v1/skills`, `POST /v1/skills/:id`, `/skills/respec`.

- **Enforcer** — Bruiser (jump and shakedown ×1.08) · Doctor's Friend (heal ×0.75) · Executioner (search
  ×0.8).
- **Operator** — Fast Talker (lay-low ×0.8) · Fence Network (fence and melt +8%) · Broker (listing fees
  ×0.5).
- **Wheelman** — Pack Mule (+3 trunk) · Getaway (crime jail ×0.8) · Road Captain (own convoys 20% faster).

### The Trades (mastery — learn by doing)

Ten **use-XP tracks** — the RuneScape shape: every job, deal, race and bout schools its own craft, and
nothing else does (XP is never bought, gifted or traded). `GET /v1/mastery` is the board; the catalog is
public on `/v1/rules.mastery`.

| Trade | Fed by |
|---|---|
| Larceny | street crimes (success) |
| Wet Work | fire kills · shanks · duels |
| The Cook | cook collects · deals |
| Wheels | boosts · street races |
| Seamanship | clean port landings · piracy wins |
| The Gambler | dice · blackjack · numbers · track bets |
| Protection | jump wins · shakedowns · standovers |
| Commerce | goods sales · market fills |
| Big Scores | the daily Score · crew heists |
| Fisticuffs | boxing bouts · exhibitions |

The curve is the game's own quadratic (level = √(xp/15)+1, capped at 50); ranks run Green → Apprentice →
Made → Craftsman → Expert → **Master of the Trade**. Levels **die with the street** — the heir inherits
**25% of each track's XP** (the bloodline echo) — while a lifetime, account-level XP **legend** survives
death whole and ranks the `GET /v1/leaderboard/trades` board (Dabbler → A Legend of the Life; agents
excluded).

**Milestone perks (step two):** each trade carries ONE perk that deepens at L10/25/40 — shorter jail
stints (Larceny), a faster search clock (Wet Work), faster batches (The Cook), discounted tunes and
boat refits (Wheels, Seamanship), a higher PvE table limit (The Gambler — access only, the odds never
move), harder jumps and shakedowns (Protection), cheaper listings (Commerce), the Score lining up
sooner (Big Scores), fighters healing faster (Fisticuffs). Den plays under **$1,000** school nothing
(no min-bet farming). At **level 50**, choose a permanent trait — **Virtuoso** (the perk deepens
further, for this life) or **Dynast** (your heir keeps HALF this trade's schooling instead of a
quarter). The choice dies with the street; the heir chooses their own.

**Paths v2 (step three):** six careers now — The Gun, The Ledger, The Kitchen, **The Wheel, The
Shadow, The Ring** — each with a signature edge, a REAL handicap (the Gun sells goods at ×0.95, the
Ledger fights at ×0.95, the Kitchen does ×1.1 jail time, the Wheel cooks slow, the Shadow shies from
duels, the Ring pays the Doc ×1.15), and trades that come easy (**×1.5 XP**) or fight you (**×0.6**).
The Ledger's long-advertised +10% front income is finally real. Switching careers takes the 150 $OMR
AND a week between moves.

**Stats by use (step four):** working a trade also exercises its core stat — each XP-paying action
has a small chance of +1 to the track's stat (larceny builds cunning, wet work builds muscle,
wheels builds speed…), on the gym's own diminishing curve, hard-capped at **3 points per rolling
day** whatever you play. The gym is still the fast lane; this just makes plying your trade FEEL
like training it. Your board shows today's remaining allowance.

---

## 24. The Underworld

Six **named fixers** that you build a *relationship* with (standing 0–100, for each character).
`GET /v1/underworld`.
- **Doc Moretti** (survival) · **Vinnie the Match** (contracts) · **Bella Bang-Bang** (gear) ·
  **Big Tuna** (trade) · **The Madame** (the Den) · **Mickey the Corner** (boxing & the stable).

You **earn standing when you work with a fixer** (healing, buying guns, posting contracts, killing, running
convoys — each action adds standing to the correct fixer). The limit is 25 standing each day. Levels at 25, 60,
and 90 unlock single perks: Doc gives heal discounts and early discharge; Vinnie gives NPC-hit and
contract-fee discounts and faster searches; Bella gives gun and craft discounts and a gun buyback; Big Tuna
gives guard discounts, longer listings, and a 4th market slot; the Madame gives no-nerve dice, high-stakes
access, and a hunter count.

- **Gifts** (`/underworld/:npc/gift`, $5k, +5) only work below 50 (you must earn the top levels).
- The **daily lead** — do the fixer's assigned task one time each day with your best fixer for a bonus (and a
  streak).
- **Rivalry and grudges** — a kill costs you standing with the Doc. If you kill a fixer's friend (standing 60
  or higher), you get a **grudge** that limits your level with that fixer until you pay **penance**
  (`/underworld/:npc/penance`, $25k). **Decay** reduces idle standing toward level 1. A **weekly favor**
  (`/favor`, level 3, a resource package) and an **errand chain** (`/errand`, 3 days for a bonus) reward
  loyalty. Your heir inherits 25% of your standings.

---

## 25. The Wire

Information as a $OMR resource that you can spend. `GET /v1/wire`.
- **Wiretap** (`/v1/wire/tap/:targetId`, 48 $OMR, 12 hours, up to 5 at one time) — shows a rival's Law stage
  and heat band, wealth band, operations, WANTED status, and **if they are hunting you** (this pierces the
  peek space).
- **Sweep** (`/wire/sweep`, 30 $OMR) — removes every tap on you (free when you are clean).
- **The Street Wire subscription** (`/wire/subscribe {tier}`) — a **tiered ladder**: Street Wire (72 $OMR for
  7 days — Law forecasts and threat data: a *count* of hunters and contracts on you, never a
  name; the layered intel economy — the subscription warns you, a tap identifies a rival, and the $OMR peek
  names funders), The Wire Room (180 — plus your family war room and 2 standing watches), The Switchboard (360 —
  plus 5 standing watches).
- **The Standing Watch** (`/wire/watch/:targetId`, tier 2 or higher) — enroll a target and the Wire
  **renews the tap from your $OMR** each cycle (`intel:watch`). So the surveillance runs while you are offline
  (limited by your balance and the tier's slots). It pauses if you run out of $OMR or the subscription ends.
  Use `DELETE` to stop it.
- **Tradecraft and the Spymaster board** — your lifetime intel actions rank you (Eavesdropper to The Oracle).
  This gives more wire slots and a discount on intel reads. The **watchdog** sends you a live alert the moment
  a tapped target becomes hot (hunts you, becomes wanted, or is indicted). Also: **bug trace** (name your
  watchers), **dossier** (a deep read), **disinformation** (send false data to your watchers), and
  **informant** (a human source that passes disinformation).

---

## 26. The Store & the Ledger

**The Store** (`GET /v1/store` [public]) — real-money (ETH) packages that grant **only non-currency items**
(this prevents pay-to-win: entitlements, access windows, cosmetics, and status — never cash, $OMR, gear, or
power). Packages: revive bundles, a 30-day Street Wire, the Season Pass, the Patron's
Ring badge, and decor styles. The revenue divides 40% to the founder, 40% to the buyback (the Vig, which funds
withdrawals and prizes), and 20% to the treasury (the ETH that backs the Vault).

**Most real-money prices have two rails — but getting Made has one.** PLEX lets you pay in earned $OMR
instead of ETH: the respawn token and every Store package are payable either way, because none of them
gates anything. Which currency bought a revive, a Wire month or a decor style changes nothing about what
it does.

**Becoming Made is the exception, and it is deliberate.** A price payable two ways is always the cheaper
of the two, and being Made is what unlocks extraction — so it is the one price that must be unambiguous.
It costs ETH, at the published wave, and nothing else sells it. That costs you nothing on the free road:
the mission ladder's *Dockside Heist* hands you a mint credit outright.

The line is short: **the bound has one price; everything else is a currency choice.**

**Where that $OMR comes from, said plainly, because the arithmetic matters.** Nothing in the city
mints it. Every $OMR mission in the game pays 1,320 across a whole career and the daily contract
bonus adds 3 a day — against 4,118 for the *cheapest* thing PLEX sells. So the rail is not funded by
grinding. It is funded by taking it off somebody (a kill strips a fifth to a half of what they are
carrying, staked included), by buying it at the desk, or by a family handing it to you. That is the
game working as intended, and it is worth knowing before you plan around it.

**The Season Pass / The Ledger** (`GET /v1/pass`, `/pass/claim`) — while your pass is active, claim the next of
12 levels one time each day: titles, revive tokens, energy refills, and small **$OMR stipends** paid from the
funded prize pool (never created). This is account-level, so it survives death.

---

## 27. Going Legit

The old player-bought **stock book** remains retired (D11, 2026-08-05): there is no cash/$OMR route
where a player picks and buys a share, and those old invest routes still answer `retired`. A separate
system now exists: **The Brokers**, a treasury-funded, play-weighted Robinhood Stock Token reward.
It is not a shop, a promised yield, or a cash-out quote. The production chain leg remains off until
the audit, legal/eligibility, venue, reserve, and Safe launch gates are cleared.

Going legit includes what your **earned $OMR** does:

- **Stake it** (`/v1/stake`) — the founder-directed replacement requires actual on-chain OMR; the same canonical
  position climbs the ladder (trunk, energy, nerve, garage, the fence at the top), supports commitment locks and the
  Broker multiplier, and remains exposed to gameplay loss and unbonding. This replacement is designed, not live.
- **Redeem it** at the Window for cash (below).
- **Claim backed ETH** at the Vault (`GET /v1/vault`) — real ETH the treasury holds, never more than
  it holds; big moves draw the Bureau's eye and are blocked from a safehouse.
- **Get Made** (`/v1/made`) and take your $OMR out on-chain (`/v1/withdraw`).
- **Landmarks** (`/v1/landmarks/:districtId`) — one plaque in each district still bears a name that
  survives death.

### The Brokers — how active play qualifies

The policy is **minimum breadth and score, then uncapped proportional activity**:

1. **Activate** a Broker tier by spending earned $OMR. Activation is a recurring window and a
   multiplier, not eligibility by itself. An activated idler receives zero.
2. During the seven-day epoch, successful server-authoritative actions write raw counts to the
   activity log. A player must clear at least **3 distinct activity tracks** and the published
   **minimum score of 25**. Failed attempts, page views, time-online, client telemetry, and granted XP
   do not count. Human and agent accounts qualify on identical economic terms; NPC/resident accounts are excluded.
3. After the gate, the full activity score remains linear and **has no cap**. Weight is
   `activation multiplier × activity score`, so more genuine successful play earns a larger
   pro-rata share. There is no cliff beyond the qualifying floor and no equal split.
   A future verified OMR-staking multiplier will preserve that activity gate and the recurring
   activation requirement. Its chosen composition is `activation multiplier × activity score ×
   stake multiplier`, with fixed public stake tiers based on the finalized full-epoch time-weighted
   average. It is not live until the eligible source and tier ceiling/thresholds are resolved and
   anti-flash snapshot history is implemented.
4. The worker automatically freezes the completed epoch. Re-running the hourly job is safe: the
   `(start day, end day)` epoch is unique, so a restart cannot publish a second snapshot.
5. A real treasury purchase distributes its received token units over the latest snapshot frozen
   before that purchase. A snapshot published after a buy can never reach backward and capture it.
   `allocated ≤ held` and `delivered ≤ allocated` are checked per ticker.
6. Delivery waits until the account has an extracted Street Deed, then goes into that deed's
   ERC-6551 token-bound account. No manual claim is required. **Pending allocations never expire:**
   they are not forfeited for inactivity, reclaimed by the treasury, or redistributed to later epochs.
   If a player has no valid delivery target for months or years, the exact outstanding units remain
   owed until that player extracts or regains a qualifying Street Deed.

**If Robinhood retires or converts a Stock Token.** Here, the issuer means Robinhood Assets (Jersey)
Limited (RHJ), which issues the Stock Token—not the public company whose shares provide the economic
exposure. Ordinary splits and dividends use RHJ's on-chain multiplier: the raw token balance and the
game's raw-unit allocation do not change. A future redemption, merger, spin-off, or worthless-removal
event is different and fails closed. OMERTÀ stops new buys and undelivered pushes for the affected token,
snapshots the vault balance and every outstanding account allocation, and waits for RHJ to mark the event
completed and for the vault's actual on-chain successor assets or proceeds to be reconciled. The portion
backing pending players follows those proceeds pro rata to the **same accounts**. It never becomes general
treasury inventory and is never redistributed to a later activity epoch. If completion or proceeds are
ambiguous, the old allocation remains pending rather than being guessed away. Tokens already delivered
to a Street Deed are in that deed owner's custody and are outside this pending-allocation reconciliation.

Robinhood Chain cannot read the gameplay database, so the contract does not pretend to recalculate
"active play." The server computes the frozen allocation; a separate Safe-configured allocation
signer attests the exact epoch hash, account hash, token, deed account, units, delivery id, and
deadline. Once that signer is enabled, `StockVault` disables the old keeper-only push and accepts only
the signed authorization. The delivery keeper can relay an approved allocation but cannot invent a
qualified account or alter its asset, recipient, or amount.

**No in-game KYC or recipient compliance gate.** OMERTÀ does not request identity documents, store
KYC data, screen residency or sanctions status, call a compliance provider, or condition the activity
calculation or Stock Token delivery on those facts. Once a human account qualifies through active play
and has a linked wallet plus an extracted Street Deed, the delivery worker uses only the frozen gameplay
allocation and the on-chain ownership/safety checks described above. Any KYC/AML Robinhood requires for
direct issuer redemption happens in Robinhood's exit process, outside the game.

That is a founder-directed permissionless-product posture, not a representation that OMERTÀ has received
legal clearance. Robinhood describes Robinhood Chain and its standard ERC-20 Stock Tokens as open and
composable, while its issuer disclosures separately restrict offers, sales, distributions, and deliveries
to some recipients and jurisdictions. The production launch review must therefore evaluate this exact
no-in-game-check model; it must not quietly add a KYC gate without a new founder decision, and it must not
describe the posture as legally approved without written support. See
`https://docs.robinhood.com/chain/stock-tokens/` and
`https://docs.robinhood.com/rhj/restricted-jurisdictions/`.

### The Window and the Family Yield

**Cash does not buy $OMR** — there are no wash houses, no laundering at your own front, and no swap;
any route that would convert cash into $OMR says so plainly if you try it. What you get instead:

- **The Window** (`GET /v1/window`, `/v1/window/redeem`) — burn $OMR, take in-game cash at a published
  rate, from a till that the street take fills. It runs **one way only**: cash never becomes $OMR again.
  The till can run dry, and a short window refuses and **burns nothing** — it is a claim on what was
  funded, never a promise. There is a daily limit per account. It is **open**, which it could not be
  while cash still bought $OMR: the two together would be a money pump, and the game refuses to run both.
- **The Family Yield** (`GET /v1/yield`) — the top families by this season's standing split a pot of $OMR
  into their reserve. The pot is fed by **the family's cut of every redemption at the Window** — a small
  share of what a player spends goes to the families rather than to the house, so the yield scales with
  real redemption volume. It is what staking rewards and personal dividends become: standing stops being
  only a badge and starts paying, so tribute, wars and the Commission are worth real money to a family.
- **The Vault** (`GET /v1/vault`) — four streams of real ETH (the DEX sell tax, treasury bonds, the
  store, game fees) fund the protocol: liquidity, the withdrawal reserve, the founder, and a treasury.
  Burn earned $OMR and you claim a share of what that treasury actually holds. It is **backed by ETH,
  not by stock** and remains separate from The Brokers. The rule is the same one it always had and is
  now unbreakable: **the house never owes more than it holds**, and with ETH on both sides no price move
  can change that. The board publishes what came in and from where, so you can check the claim yourself.
  Allocation only — nothing is delivered, no sell, no cash-out.

---

## 28. The Estate & Auction House

**The Estate** (`GET /v1/estate`) — a deep, account-level (death-proof) $OMR cost and a "home" surface: buy
levels (Safe House 240 to The Compound 15,000 $OMR), unlock features (Trophy Room to The Menagerie), name it, and
show **trophies** that come from your real holdings (rarest car, guns, book value, kills, family seal). Status
only. `POST /v1/estate/upgrade`, `/feature/:id`, `/name`.

**The Auction House** (`GET /v1/auction` [public]) — a competitive weekly $OMR cost: 3 unique numbered prestige
items each week. The highest **$OMR bid wins**, and **the winning bid is sunk** — it leaves you for good and goes to the house, which sells it back at the daily auction. Bids go
into escrow. An outbid bidder gets a refund immediately. Won items are account-level and survive death.
`POST /v1/auction/:lotId/bid`.

---

## 29. The chain

OMERTÀ settles on Robinhood Chain (an EVM L2). The blockchain layer is built but **not active until mainnet**
(behind the launch checklist and audit). The design: the off-chain game is authoritative; the blockchain settles
withdrawals and ownership proofs. The ONE place new $OMR is created on-chain is bonds — minted at
bond time inside hard walls (a daily cap, a discount ceiling, a rate ceiling).

- **Withdraw $OMR** (`/v1/withdraw`) — this burns your $OMR (a legal burn) and signs an EIP-712 voucher **only
  if the reserve can back it** (the full-reserve queue; if not, it waits in a queue). Every withdrawal pays a
  **2% exit toll** (steeper on tokens younger than 48 hours — the early-exit tax). **Only a minted account
  can extract.**
- **Gear withdrawal** (`/gear/:id/withdraw`) — mints your in-game gear as an ERC-1155 NFT (it leaves the game,
  and it becomes safe and tradeable).
- **Wallet link** — SIWE (`/wallet/challenge`, sign, `/wallet/verify`).
- **The Forge** (`GET /v1/forge`, `/character/forge`) — a linked wallet's on-chain HISTORY can forge
  your build, once per wallet EVER: its age and mileage (never a balance) cast the stats as one of
  **twelve named archetypes** (four history families, the exact face a stable function of the wallet
  itself — the same wallet forges the same face forever), plus a small capped bonus on the
  archetype's strong suit — and a genuinely deep history forges a slightly BIGGER budget (a few
  extra points spread across the whole build, hard-capped). Each archetype also SCHOOLS its own
  regimen discipline with a banded head start (a few levels of a 25-level ladder — schooling, never
  mastery). Free early; past level 5 it costs a paid re-roll credit. A fresh empty wallet earns
  an ordinary random roll on the standard budget. Note an ordinary paid RE-ROLL later replaces the
  whole build — bonus and budget perk included — with a fresh standard roll. **Character mint**
  (`/character/mint`) — a one-off ETH fee makes a free-trial character permanent (able to withdraw). The
  price follows a published schedule (five waves, 0.01 ETH at the founding wave, never above 0.05); the
  Store shows the current one. You can also earn a mint credit outright off the mission ladder. Revive
  insurance is a 0.10 ETH fee.
- **Bonds** (`GET /v1/bonds` [public], `/bonds/:id/claim`) — the Reserve Bond (Protocol-Owned Liquidity):
  deposit ETH to receive **discounted $OMR that vests over time**. The ETH deepens the OMR-ETH pool
  and feeds the Vig. Bonds are the ONE mint — new $OMR is issued at bond time inside hard on-chain
  walls (a daily cap, a discount ceiling, a rate ceiling).

The **Vig** is the real-revenue engine: fee, store, and bond revenue buys hard $OMR that backs withdrawals and
funds the prize pools.

---

## 30. Growth

**Paths** (`POST /v1/path`, at L5 for $10k; switch for 150 $OMR + a 7-day cooldown) — a career, not just a
bonus: SIX Paths (**The Gun**, **The Ledger**, **The Kitchen**, **The Wheel**, **The Shadow**, **The Ring**),
each with a signature edge, a REAL handicap, and trades that come easy (×1.5 mastery XP) or fight you (×0.6).

**Missions** (`/v1/missions/:id`) — 36 pay-once jobs with level and stat requirements. They pay cash, respect,
sometimes $OMR (a legal source, one time for each account), and titles.

**Daily contracts** (`GET /v1/daily`, `/daily/:id/claim`) — 3 drawn each day. Complete all three for a $OMR
bonus. **The Daily Score** (`/v1/heist`) is the best repeatable income at a low level (8-hour cooldown). **Check
in** each day for a streak bonus.

**Referrals** (section 7.13) — your referral code is your character **name**. A recruit qualifies after 4
conditions (L8, 40 jobs, 3 check-ins, $25k net worth). Milestones pay the recruiter cash and titles.
- **THE CREW BONUS** — the real reward, and the reason to recruit people who actually play. Every
  qualified recruit makes you earn **respect faster**, scaled by how far *they* have got: a recruit at
  level 5 is worth +5%, at level 10 +10%, at level 15 +15%, and so on in steps. It applies to every
  respect you earn, anywhere in the game. It is **live** — recomputed from your crew's current levels,
  so it rises as they rise, falls when one of them dies back to an heir, and stops when they stop.
  It is capped, and it is not a currency: it cannot be sold, given away or laundered.
  **Referrals pay in cash and in respect, never in $OMR.**
- **Naming your referrer** — a recruit can type the sharer's street name in the **"who sent you?"
  field when they create their character** (a shared `?ref=` link pre-fills it), or — if they missed
  it — from the **"Did someone send you?" card on Start Here within their first 3 days**. Spelling is
  forgiven on case; attribution is set once and can't be changed after.
- **The spark** — a small EARLY payment ($2,500 for the recruiter, $1,500 for the recruit, cash only) when
  your recruit reaches L3 and 10 jobs, before full qualification — fast feedback so you continue to recruit.
- **Tier-2 "the family tree"** — when a recruit that YOU brought in then brings in their OWN qualified
  recruit, you earn a single $5k finder's fee (cash only, depth 2 only). This is a referral bonus, not a
  percentage.
- **The recruitment drive** — a time-limited event (a "🔥 RECRUITMENT DRIVE" banner) where every referral CASH
  payment multiplies. **The Recruiters** boards
  (`GET /v1/leaderboard/recruiters`) rank the top recruiters and families by recruits.
- **My Profile** (`GET /v1/profile`, the "My Profile" screen) — your personal page: who you are (mood,
  member-since, generation, family, honor, kills), your **Top 8** (every recruit you brought in, with
  their status — green / coming up / made), and **The Take** — exactly what recruiting has paid you in
  cash and $OMR, read straight from the ledger. Your copy-the-link and share buttons live here too;
  the link carries your name as the referral code.

**Spread the Word** (`GET /v1/social`, `/v1/social/:taskId/claim`) — three daily social tasks (post about the
game, share your code, follow or repost). Each pays a small amount of **cash** ($300; $500 for all three). Cash
only, one time each day, agents excluded. A share pays in two steps: first you REGISTER it (the claim button starts the clock), then it pays only after the post has STOOD for 4 hours — if the server runs live verification, a deleted post pays nothing. The share links carry your name as a referral code, so real sharing
feeds the referral system. (This needs `SOCIAL_VERIFY_MODE` not equal to off; a wrong deploy shows the tab but
pays nothing.)

**The First Week** (`GET /v1/onboard`, `/onboard/:taskId/claim`) — a short checklist (do a job, boost a car,
use the bank, declare a Path, join a family, link a wallet, follow on X). It pays cash to teach you the
game, with a final bonus. **The Coach** (the ▸ line on your sheet) always names your single best next action.

**Vanity** — name change (30 $OMR), custom title (60), car plate (12), family color (60), family rename (150).

### For agents (autonomous players)
Agents are full players. `POST /v1/auth/agent-key` grants a permanent 🤖 flag and a 90-day token (limited to 1
action each 3 seconds). Discovery: **`GET /agents`** (the quickstart), **`GET /openapi.json`** (the full API
contract), **`GET /llms.txt`** (the discovery index), **`GET /v1/opportunities`** (the Opportunity Board —
every open economic action and skill loop, with the estimated value and risk, in one call), and
**`GET /v1/leaderboard/agents`** (the agent leaderboard). Agents earn by SKILL. The anti-abuse sources
(referrals, Spread-the-Word, assassin reputation) are for humans only; every economic loop is open. An MCP
server (`omerta-mcp/`) shows the game as MCP tools, so any MCP-capable agent can play directly.

---

## 30a. The Megaproject (the city builds a monument)

The whole server pools value toward ONE announced monument (`GET /v1/megaproject`; the City tab).
Contribute **cash** (`POST /v1/megaproject/cash`), **trade goods** from your trunk (credited at
catalog base value), or **$OMR** (at a fixed $83 rate). Every contribution is a BURN — this buys
glory, not power. Contributions clamp to what the wall still needs, and the whole city sees
milestones at 25/50/75%. When it completes, the monument joins **the skyline** on the city board
permanently, and the plaque records every contributor forever — tiered **The Architect** (top
brick) → Foreman (top 3) → Patron (top 10) → Builder. The plaque is account-level: your dynasty
keeps its glory through death. Monuments are raised in order (the Cathedral Restoration → the
Grand Casino → the Founder's Bridge → the Colossus of the Docks).

## 30a2. The Dueling Circuit, Clue Scrolls & the Season

**The Dueling Circuit** (Wet Work tab; `GET /v1/duels`) — the game's ranked ladder. List yourself
with a stake cap, challenge anyone listed: your BUILD fights (stats + gear), the stake changes
hands minus the 5% rake, and your **ELO** moves. The rating is seasonal (resets every 28 days),
dies with your street, and feeds `GET /v1/leaderboard/duels`. Lifetime wins are a dynasty legend.
Rematch-farming the same opponent pays less and less each day.

**Clue Scrolls** (the Streets tab) — a rare drop on any successful job starts a treasure trail. Trails
come in TIERS (easy 3 steps up to master 7), each riddle naming a district (sometimes an hour of day).
Travel there and DIG (5 energy). The last dig opens a **casket** ($3k up to $120k on a master scroll,
with a shot at a RELIC for the Collection) and counts on your lifetime diggers' legend. One hunt at a
time; after a casket the streets go quiet for 8 hours.

**The Season** (the City tab) — each 28-day season MAY carry one rule twist drawn from a public
pool (The Crackdown, Blood in the Streets, The Gold Rush — or a vanilla Dead Quiet season). The
banner on the City board tells you the season's law; it snaps back at rollover.

## 30a3. The deferred four: the Household, the Motion, the House Window & Ring Poker

**The Household & the Gala** (Estate tab) — your compound now RUNS: hire staff (Groundskeeper to
the Capo of the House) who draw daily $OMR wages on one household clock. Pay the book or they WALK
after a week — arrears die with the insult, but so do your hires. With a Butler on staff and a
square book, a tier-2+ house can throw a GALA: a big $OMR burn that opens the doors for four hours
and puts every guest's name on your list. `GET /v1/leaderboard/estates` ranks the great houses.

**Motions before the Commission** (Family tab) — a seated family's boss can now TABLE A MOTION:
stake a $100,000 treasury deposit to put a decree on the week's ballot. When any motions exist,
ONLY proposed decrees are votable; the enacted motion's deposit comes home, every other forfeits to
the confiscation pool. The fifth decree is **THE LEVY** — while in force, the family yield
pays the seated families by seat instead of the standing board. Politics finally pays.

**The House Window** (Shylock tab; `POST /v1/loans/house`) — the lender of last resort. Always
open, terms deliberately bad (35% for 24 hours, a level-scaled cap), and it lends ONLY what its
pool holds — the window is fed by half of every street vig, never printed money. Default and the
house ALWAYS collects: the sweep seizes what you have, brands you a welsher, and puts you on the
WANTED books.

**Ring Poker** (Den tab; `GET /v1/casino/ring`) — the den's skill game at last: real multi-way
hold'em with betting streets. The TABLE holds the money — you buy in, your stack lives on the felt,
and cash only moves when you sit down or stand up. Raises cap at the shortest stack (everyone can
always call), a 90-second clock folds stallers, the rake is carved from the pot. Die at the table
and your stack burns with you. The tournament also gained **THE BRACKET** — open it in bracket
format and the field plays down in rounds of heats to a televised final.

## 30b. The Cellphone & the Troll Box (talking)

**The Cellphone** (the 📱 up top; `GET /v1/phone`, `GET /v1/phone/thread/:characterId`,
`POST /v1/phone/dm/:characterId`) — your personal inbox + direct messages. The **inbox** shows what happened
TO you (a convoy jacked, a contract posted on your head, a fee credited); the **line** is player-to-player
DMs. Threads are ACCOUNT-level, so they survive death — the heir picks up the phone. 240 characters a line,
one message every 2 seconds, 30-day retention. No money ever rides a message. **Blocked lines**
(`POST`/`DELETE /v1/phone/block/:characterId`) — block a pest and they get a dead tone (they will know);
the block follows their bloodline until you lift it, and it only mutes their mouth — game events (a jump,
a contract on your head) still reach you. There is also a 📱 button on every street in Wet Work, and a
cell stop with an unread badge on the mobile thumb bar.

**The Troll Box** (`/v1/chat`, `/v1/gangs/chat`) — public city chat plus a family-only room (you only see
family chat from AFTER you joined — no back-reading a family you infiltrate).

## 30c. Street Life — the corner, the black book, the call

**Word on the Street** (`GET /v1/corner`, `POST /v1/corner/:slot/accept|claim`) — every district posts
3 daily tasks (the same board for everyone standing there, one CONFLICT job — a jump or a bust —
guaranteed). Take a job WHERE it's posted, do the work anywhere it happens, collect the envelope back
at the district: $400 + 15 respect each, at most 5 envelopes a day across the whole city. Only work
done AFTER you take a job counts.

**The block's standing job** — work the same district's corner on **3 separate days** and it pays a
**$1,500 + 40 respect** bonus on the last one. A second envelope in that district today still pays,
but it does not move the chain: a chain is days of showing up, not a busy afternoon. Finish one and
the block has another for you.

**The Black Book** (`GET /v1/contacts`) — phone numbers are EARNED, never free. You get a line three
ways: **meet them** (any completed face-to-face — a jump, a hire, a fade, a duel — hands BOTH sides
the other's number), **tap them** (a wiretap or dossier earns it one-way; they never get yours), or
**answer** (whoever rings you reveals their own number). The phone's compose list IS your book — a
stranger's 📱 reads 📵 until you earn the line. How many lines you hold is a **rank** — Nobody Calls up to The
Switchboard — and `GET /v1/leaderboard/contacts` ranks the busiest books in the city.

**Standing** — every job you finish for one contact deepens that relationship (a stranger → a
regular → a friend → family). A contact who knows you asks for **bigger loads and tips better**.
The money still comes from their own pocket, so a contact who cannot cover the bigger ask simply
does not call: standing moves what they ASK, never where it comes from.

**The Call** (`POST /v1/call/fulfill`) — contacts you've met ring you with paid requests: bring N
units of freight to their district (base × 1.15), or just come see them (a tip). The pay comes from
THE CONTACT'S OWN pocket — a real transfer, never minted — and an unanswered request lapses in a day.

**The Favor** (`GET /v1/favors`, `POST /v1/favors`, `POST /v1/favors/:id/run`, `DELETE /v1/favors/:id`) —
the player-posted call. Put up to 3 requests on the wire: N units of a trade good delivered to a
district, with the pay **escrowed the moment you post it**. Everyone who holds your number sees it;
whoever hauls the freight there takes the money on the spot, minus a 2% house cut. That escrow is
why this is worth posting at all — a runner can never cross town and find your pocket empty. Pull it
back any time and the money returns; nobody runs it in a day and the money returns by itself. But
escrow is cash sitting outside your pocket, so it is NOT a hiding place: you cannot post from a
safehouse, and a killer takes a quarter of every open favor you were holding.

## 30d. Risk Factors — the honest register

Every promise in this game is a formula you can check; this section is the other half — what can go
wrong, stated plainly BEFORE you plan around it. It is not legal advice, and it is deliberately
written the way a careful counterparty would want it written. Figures below are the live levers; if
a lever moves, this page moves with it (a test enforces that).

- **Thin launch liquidity.** When the token market opens, it starts SMALL by design. Ordinary trades can move the
  price, and a round trip pays the sell tax plus slippage. Do not treat the pool as an exit for
  size.
- **Selling is taxed.** Once the chain market is live, **9% comes off the top** of every DEX sell (split between the founder, the
  treasury and the pool's own depth). On top of that, $OMR younger than 48 hours pays an early-exit
  surcharge — up to an extra 50% that fades to zero over the window. Fresh tokens are expensive to
  flip; that is the design, not a bug.
- **Withdrawing will pay a toll and can queue.** Once production extraction opens, every on-chain withdrawal pays a flat 2% toll, and the
  rail is FULL-RESERVE: the server signs only what the reserve already holds, funded by real
  revenue. If the reserve is thin your withdrawal QUEUES — debited, safe, and signed when revenue
  funds it. No timing is promised.
- **Nothing you hold is safe from the game.** Unstaked principal unbonds for 6 hours and is
  lootable the whole time. A killer takes up to 50% of a loose balance and 20% of a staked one.
  When your street falls, the estate burns 25% of the liquid $OMR your heir inherits. Committing a
  balance makes it cheaper to hold, never safe.
- **You cannot grind the token.** Nothing in the game mints $OMR to players on a schedule. The
  earnable surface is small and finite (the mission ladder plus the daily envelope). Plan to EARN
  in cash and to reach $OMR by playing well against people who hold it — never by farming.
- **Death is real.** Your street dies, its cash-side holdings die with it, and the account-level
  survivors are enumerated (they are the exception, not the rule).
- **The house edge is real.** Every den game is negative expected value for the player and says so
  on its own card. Gambling here is entertainment priced as entertainment; the expected outcome of
  a long session is loss.
- **Extraction is not open yet.** The withdrawal rail is built and devnet-proven, and it opens only
  when the third-party audit and the launch review clear. Until then $OMR is an in-game balance.
- **The root of trust is a Safe.** The game is server-authoritative and its chain levers are held
  by a Safe. That is a disclosed trust assumption, not an apology — the invariants that watch it
  run nightly, and their alarms reach a human.
- **The complete list is unwriteable.** Anything not listed here is not therefore safe.

## 31. Reference

### Districts
| District | Benefit |
|---|---|
| Docks | +50% contraband on crimes; the harbor; the start district |
| Neon Mile | +15% racket and business income; the vice district (casino, speakeasy) |
| Old Foundry | Workshop crafting −25% cash |
| Brick Yards | +2% crime success |
| Canal Row | +10% crime pay |
| Cathedral Hill | Nerve increases two times faster |

### What is safest when you die
Your **$OMR** (liquid and staked — a killer takes a cut, the rest carries to your heir) ·
**minted (on-chain)** gear · your account-level **estate, deeds and prestige**. Staked $OMR is
looted LIGHTER (a fifth vs half of a loose balance) — cheaper cover, never safe.

**Your bank is not one of them.** Banking puts cash out of a *killer's* reach — a killer's cut only
touches your pocket and any deposit still in transit — but when the street falls the estate takes
**pocket and bank together**, and your heir starts on $500 either way. Bank to deny your killer,
never to save it for yourself. Everything else you were carrying dies with the street.

### Status marks on your sheet
**wanted** (hunted, even by family — square it) · **welsher** (defaulted, cannot borrow — square it) ·
**indicted** (a RICO case is filed — go to The Law) · **in transit** (a deposit is not cleared — another player
can steal it) · **unbonding** ($OMR is not liquid yet — another player can steal it) · **safehouse**
(untargetable, but you cannot act) · **hospital / lockup / the hole** (wait).

### Currency quick-reference
- **Cash** — earned everywhere. Pocket cash can be stolen. Cleared bank cash avoids a killer's cut but does not survive death.
- **$OMR** — the premium currency. It is earned through enumerated rules (never bought with cash), can be staked,
  and becomes eligible for extraction after you mint and the production rail opens. It is account-level, so it survives death. A killer takes half a loose or
  unbonding balance and a fifth of a staked one — cheaper, never safe.
- **Crates (cb)** — from crimes and cooking. Use them to buy guns and make gear.
- **Ammo** — from melting cars, or bought at $2000 for 50. Used on jumps, fires, raids, and ambushes.

### "Three things with the same name" (do not confuse them)
- A flat **Racket/Asset** "Speakeasy", "Nightclub", or "Casino" (buy-once passive income) is NOT a **Business**
  casino or nightclub (an upgradeable front). Neither is **The Speakeasy** (the deep club system). Neither is
  **The Den** (the casino games). They are different systems.

### Test-only settings (never active in production)
`SEARCH_MS`, `SHOOT_CD_MS`, `CONVOY_MS`, `PASS_CLAIM_MS`, `LAW_BUST_P`, `SHANK_P`, `PEN_BREAK_P`,
`PEN_YARD_EVENT`, `BUSINESS_RAID_P`, `SPEAKEASY_RAID_P`, `WORLD_RAID_P`, `SPEAKEASY_STANDOVER_P`,
`GEAR_LOOT_CHANCE`, `WANTED_HUNT_P`.

### Discovery endpoints
`GET /v1/rules` [public] (the rulebook — crimes, guns, drugs, catalogs), `GET /v1/catalog` [public]
(businesses), `GET /` (the console), `GET /wiki` (this codex), `GET /admin` (the live-ops dashboard, needs the
mod key).
