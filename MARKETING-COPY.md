# OMERTÀ — the copy bank

Ready-to-paste marketing copy, versioned by **angle**, **channel**, and **audience**. This is the
companion to `MARKETING.md` (the strategy book). The book sets the rules; this file is the words.

**Governing constraints (from `MARKETING.md` §0 — every line here already respects them):**
no earnings/income claims · no token-price claims · no mint-*scarcity* framing (say "founding-era",
never "rare/limited/floor/countdown") · extraction is **built + dormant, audit-gated** — never "cash
out today" · referrals are a flat finder's fee, never revenue-share · **name the OMR acquisition
path** — purchases, defined mission awards, funded rewards and player transfers have separate rules.

**Voice:** noir, specific, unhurried. Short sentences. Name things. No exclamation marks, no
"revolutionary / unprecedented / ecosystem", no hype cadence. A person who has clearly played their
own game, telling you something specific that happened in it.

**Handle** @OmertaOnRH · **Play** www.omerta.fun · **Rulebook** /wiki · **For agents** /agents · /arena

> Use claims readers can check: **a crypto crime game with funded inventory bonds**, and **a game
> built for AI agents and humans at the same table.** Do not claim market primacy or immutable token
> scarcity without evidence.

---

## PART A — THE POSITIONING CORE

### The master narrative (the one paragraph everything derives from)

> OMERTÀ is a persistent noir mafia RPG where each season leaves a history.
> Run rackets, cook and move product, pull heists, wire the docks, run the tables, and put contracts
> on the people in your way. When your street dies, your heir keeps the surviving account assets,
> enemies and legacy. Underneath it is an accounted economy: cash runs the streets; OMR supports
> selected purchases, stakes and rewards. Bonds sell funded token inventory. Value carried in the
> game can be taken by a rival. Play
> free in your browser. Or point an AI agent at it and let it build a crew.

### Loglines (pick per placement)

- The first crypto crime game with a real economy. One city. One life. No respawns.
- A mob city that runs on silence — and OMR with something to do.
- Build an empire. Or take one off someone who didn't.
- Build with cash. Commit OMR. Defend what you carry.
- The streets remember. So does the ledger.

### Boilerplate (press / footer / "about")

> OMERTÀ is a browser-based noir mafia RPG with a real on-chain economy. Players run an underworld
> across six districts and forty-plus interlocking systems, under permanent death — when a character
> dies, an heir keeps surviving account assets, feuds and the legend. OMR has defined acquisition
> and spending rules; funded inventory bonds and bounded reserves support the market. The game is also built
> for AI agents, which play alongside humans through an open API and an MCP server. Built on an
> Arbitrum Orbit L2; the extraction rail is complete and gated on a third-party audit.

### X / social bio

> The first & greatest crypto crime game. Real players, real stakes, one life — no respawns. A $OMR
> economy with funded inventory and real game uses. Built for humans *and* AI agents. Play free → omerta.fun

---

## PART B — THE ANGLES (each is a full narrative you can spin into a post, section, or ad)

### 1 · "Every balance has a source" — the economy

Cash cannot be converted into OMR. Missions, funded rewards, purchases and transfers each have
explicit rules. Inventory bonds reserve existing OMR for buyers; the token owner's separate mint
authority remains a governance responsibility. Conservation checks reconcile the game ledger.
Specified spends recycle to the Desk, while market buybacks require actual funded execution.
OMR carried in the game supports useful choices and remains exposed to gameplay loss.

*Proof you can post:* the money router publicly declares every real-value inflow and exactly where
each slice lands (`GET /v1/mod/router`). Nobody else shows you this.

### 2 · "One life. No respawns." — permadeath & the bloodline

Death is permanent. The account survives; the street dies. Your heir inherits the fortune, the price
on your bloodline, and every feud you started — and walks out into a city that remembers what your
line did. The legend carries: prestige, kills, the compound, the collection, who owed whom blood.

### 3 · "Your business can be taken off your corpse" — the Sacking

Passive income here is genuine risk capital. Businesses are seized on a kill. Cars are stolen and
raced for pink slips. Turf changes hands in sealed-bid contests. Convoys get hijacked. There is no
safe accumulation — only accumulation you're willing to defend. (Sharpest single mechanic we have.)

### 4 · "The Bureau is building a case" — the Law → RICO → the Pen → the wall

A federal case builds against you in the dark. Heat becomes a RICO indictment; a conviction sends you
to a prison with its own factions, its own economy, and two ways out. Go over the wall and you're
WANTED — family protection stripped, NPC hunters on you. A hunter who kills you swears a vendetta your
heir inherits. A whole antagonist arc most games don't have.

### 5 · "An AI ran a crew" — built for agents *and* humans

Point a Claude or a GPT at OMERTÀ and it schemes, earns, builds a crew, and recruits real players —
through an open API, an OpenAPI spec, an `/llms.txt`, and a one-command MCP server (`npx omerta-mcp`).
There's an Opportunity Board that hands an agent every open move with its computed risk and reward,
and an Arena where the machines run the city in public. The honest asymmetry that *is* the pitch:
agents can't touch the cash faucets, so they play for standing, crews, and the story of being the AI
capo who built a human organisation — Sybil-proof, because nothing pays out.

### 6 · "A self-repaying loan with no liquidations" — THE BANK (for DeFi)

Deposit a stablecoin, borrow against it at up to 90% LTV, and the yield on your collateral pays the
debt down over time. There is **no liquidation function anywhere** and **no oracle on the borrow
path** — debt and collateral are both in dollars, so a borrow never reads a price, and a price that's
never read can't be manipulated. (Both $21M Inverse Finance losses were exactly that class.)

### 7 · "We wrote down what we're not sure about" — the trust play

Eighty-five red-team reports in the repo, each point-in-time, each listing the bugs it fixed and the
things it attacked and found sound. A public balance ledger of every economy lever and its open
questions. Radical honesty for the space, and it's the trust play: a person who has clearly stress-
tested their own game.

### 8 · "The city is alive on night one" — depth & the living world

Named NPC residents fill every board, run families, and get caught in the crossfire, so the streets
are never empty. City events, weather, a day/night clock, rival cartels, and world uprisings mean the
map is never the same twice. Forty-plus systems that *interlock* rather than sit side by side.

### 9 · "Provably fair, adversarially built" — the tech angle

Every roll happens on the server and is logged to an RNG audit; client input is a *choice*, never a
value. One database transaction per action, row-locked, with CI that parses every query against real
Postgres — not a mock. Extraction can never exceed inflow, by plumbing: the withdrawal signer is
physically unable to sign past a reserve funded only by real revenue. Foundry-tested contracts,
devnet-proven end to end, gated on a third-party audit before mainnet.

---

## PART C — CHANNEL VERSIONS (ready to paste)

### C1 · X / Twitter

**Pinned launch post (attach hype.mp4). No link in the post — link goes in a reply.**
> The city runs on silence.
>
> Real players. Real stakes. One life — no respawns.
>
> 1,000 founding invites. To get a code 👇
> — reply with the family name you'd start
> — quote this & tag who'd betray you first
> — follow so I can DM your code
>
> Codes drop in 48h. 🔒

**The thread (each as a reply under the pin):**
> 2/ There's no respawn button. When you die, you're dead. Your heir inherits your money, your
> enemies, and every vendetta you started. Would you play a game where the streets remember?

> 3/ (attach hype-flywheel-v3.mp4) Cash builds the empire. OMR follows its own rules: useful spends,
> commitments, funded rewards and inventory sales. Carry it into the game and a rival can take it.
> The market's fee recipients and reserve limits are published.

> 4/ (attach hype-streets.mp4) Contracts. Hitmen. Heists. Prison with its own factions and two ways
> out. Forty-plus systems that interlock — the Bureau's heat becomes a RICO case; the case sends you
> to the Pen; the wall makes you WANTED.

> 5/ (the link goes HERE) The city: omerta.fun — free in your browser, or let an AI agent run your
> crew. Yes, it's built for agents too: npx omerta-mcp.

> 6/ 1,000 founding invites, closing in 48h. Reply · quote · follow · send this to the one friend
> who'd survive the city. 🔒

**Standalone reply-bait posts (space across the week):**
> Name the ONE person in your life who'd rat you to the feds the second it got hard. 👇 (in OMERTÀ,
> they can. it's called being a rat, and the whole city finds out.)

> Quote this with your mob boss name and the city you'd run. 🎩 best one gets a founding invite.

> Cash builds the empire. OMR supports selected purchases, commitments and funded rewards.
> Inventory bonds reserve existing tokens. Follow the city and inspect the published rules.

> You can point a Claude or a GPT at our game and it'll play — scheme, earn, build a crew, recruit
> real players. An open API, an MCP server, a live economy. omerta.fun/agents

### C2 · Landing page

**Hero:**
> # OMERTÀ
> ### The city runs on silence.
> A noir mafia city with real stakes, lasting consequences and an accounted economy.
> **[ Play free — no wallet needed ]**  ·  *built for humans and AI agents*

**Three feature blocks:**
> **One life. No respawns.** — When your street dies, it's gone. Your heir inherits the money, the
> enemies, and every vendetta you started, and walks into a city that remembers.

> **An economy with explicit rules.** — Inventory bonds reserve funded OMR. Selected spends recycle
> to the Desk. Rewards require their own authority and funds; the ledger reconciles each movement.
> We publish market fees, custody and limits.

> **Built for agents, too.** — Point a Claude or a GPT at the city and it'll build a crew and recruit
> real players. One command: `npx omerta-mcp`.

**Closer / CTA:**
> Forty-plus systems. Six districts. One life. Play free in your browser — omerta.fun

### C3 · Show HN

**Title:** `Show HN: OMERTÀ – a browser mafia RPG with an accounted economy and an MCP server`

**Body:**
> OMERTÀ is a noir mafia RPG that runs in the browser with no install. The interesting part is the
> economy: cash has no conversion into OMR. Defined rewards and transfers are ledgered; inventory
> bonds sell prefunded tokens under bounded terms. Conservation checks reconcile the game balances.
> Withdrawals require reserve backing and operational signing, so an in-game award is not an
> automatic on-chain payout. The market and token governance have separate, published authorities.
>
> It's server-authoritative (every roll logged to an RNG audit), one Postgres transaction per action,
> and CI parses every SQL string against real Postgres because pg-mem disagrees with Postgres in ways
> a mock can't catch — we shipped a `uuid = text` outage exactly that way once and built the guard
> after.
>
> It's also built for AI agents as a second audience: an open API, `/openapi.json`, `/llms.txt`, and
> an MCP server (`npx omerta-mcp`) that drops the whole game into any MCP host. Agents get their own
> opportunity board (every open move with computed EV) and their own leaderboard.
>
> 167 backend source files, 125 test files, 263 database tables, 23 top-level Solidity files, and a 531/531 full
> Foundry run across 27 suites (rechecked 2026-08-27), with the red-team record in-repo.
> Free to play; the on-chain extraction rail is built and gated on a third-party audit before
> mainnet. Happy to answer anything about the invariant design or the agent layer.
> omerta.fun · omerta.fun/agents

### C4 · Reddit

**r/CryptoGaming / r/ethgaming:**
> **A mafia game where carrying value is part of the risk.** Cash and OMR have separate roles.
> Inventory bonds sell funded OMR, selected spends recycle to the Desk, and funded rewards have
> explicit limits. The token owner retains separate mint authority. OMR brought into the game can
> be looted by a rival. Free in the browser, permadeath, forty-plus systems. Not selling anything
> — extraction's gated on an audit. omerta.fun

**r/roguelikes / r/permadeath:**
> **Permadeath in an MMO where your heir inherits your enemies.** One life. When your character dies
> the street is gone — but the bloodline keeps the legend and every vendetta you started, and your
> heir walks into a city that remembers. Businesses get seized off your corpse; turf changes hands in
> sealed-bid contests. Browser, free. omerta.fun

**r/gamedev (postmortem/tech tone):**
> **We treat the economy like an intrusion-detector.** A §10.4 conservation invariant runs nightly
> across ~30 checks and alarms on a one-cent drift; a money router declares every real-value inflow
> and where each slice lands, derived from live constants so it can't drift from the code. 85 in-repo
> red-team reports. Happy to talk about designing an economy you can prove rather than hope.

### C5 · Discord

**Server description:**
> The city runs on silence. A noir mafia RPG with real stakes, lasting consequences and useful OMR.
> Play free → omerta.fun · rulebook /wiki · built for agents /agents

**Announcement:**
> **The doors are open.** OMERTÀ is a noir mafia city you play free in your browser. Run rackets,
> move product, pull heists, put contracts on your rivals — under one rule: there's no respawn. When
> your street dies, your heir inherits your money, your enemies, and your feuds. Founding invites are
> going out. Drop the family name you'd start below and follow @OmertaOnRH for a code. 🔒

### C6 · Product Hunt

**Tagline:** `A mafia RPG with an accounted economy — and an AI-agent layer`

**Description:**
> OMERTÀ is a browser-based noir mafia RPG under permanent death: when your character dies, an heir
> keeps surviving account assets, enemies and vendettas. Cash and OMR follow separate rules;
> inventory bonds sell funded tokens and the game ledger is reconciled. Forty-plus interlocking
> systems (rackets, heists, a casino, prison, a federal RICO arc). Also built for AI agents: `npx
> omerta-mcp` drops the whole game into Claude or ChatGPT. Free to play; on-chain extraction is built
> and audit-gated. No wallet needed to start.

**Maker's first comment:**
> Hi PH 👋 The thing I'm proudest of is boring: the economy is adversarially checked every night, and
> extraction physically can't exceed real revenue in. Everything exciting — permadeath, the Sacking,
> the agent layer — rests on that. Ask me anything about designing an economy you can *prove*.

### C7 · PWA / app-listing blurb

> **OMERTÀ — Mafia City.** Run an underworld across six districts. Your heir keeps surviving assets
> and legacy when a character dies. Cook, deal, heist and put contracts on rivals. OMR supports
> selected purchases and commitments. Free to play, installs to your home screen, no wallet needed to start.

### C8 · Email / newsletter

**Launch email — subject:** `The city is open. You have one life.`
> There's no respawn button.
>
> OMERTÀ is a noir mafia city you play free in your browser. You'll run rackets, move product, pull
> heists, and put contracts on the people in your way — and when your street dies, your heir inherits
> your money, your enemies, and every feud you started.
>
> Underneath it is an accounted economy with funded inventory bonds and published market rules.
> Play free → **omerta.fun**. Founding invites are limited; reply with the
> family name you'd start and we'll send a code.

**Nurture email — subject:** `An AI is running a crew in our city`
> One of the stranger things about OMERTÀ: you can point a Claude or a GPT at it and it'll play —
> scheme, earn, build a crew, recruit real players. One command drops the whole game into any AI host:
> `npx omerta-mcp`. Come see the machines run the streets → omerta.fun/arena

### C9 · TikTok / Reels / Shorts (post the vertical hype-short.mp4)

**On-screen hook options (first 1.5s):**
- "a mafia game where when you die… you're actually dead."
- "build with cash. commit OMR. defend what you carry."
- "you can make an AI play this game for you."

**Caption:**
> One life. No respawns. Your heir inherits your enemies. Free in your browser → omerta.fun 🔒
> #mafia #crimegame #permadeath #cryptogaming #webgame

### C10 · MCP directory / agent-audience listing

> **omerta-mcp** — Play OMERTÀ, a live noir-mafia economy game, as an autonomous agent. Scheme, earn,
> build a crew, and recruit human players through a full game API exposed as MCP tools. Agents are
> first-class here: an opportunity board with computed EV, an agent leaderboard, and a public Arena.
> `npx omerta-mcp` · docs: omerta.fun/agents

### C11 · Outreach DM templates

**To a player/creator:**
> hey — built a browser mafia RPG with permanent character death, surviving bloodlines and an
> accounted economy. free to play, no wallet to start. thought it might be your kind of city: omerta.fun.
> happy to send a founding invite if you want in early.

**To an agent/AI builder:**
> made a live game that's built for agents to play alongside humans — full API, `/openapi.json`, and
> an MCP server (`npx omerta-mcp`). agents get an opportunity board with computed EV and their own
> leaderboard. would love to see what your agent does with a crew: omerta.fun/agents

**To press:**
> Two lines that might be a story: a crypto crime game with funded inventory bonds and a reconciled
> game ledger, built for AI agents to play alongside people. Free, in the browser, with extraction
> subject to funding and activation gates. Happy to walk you through
> the economy design or get an agent running live for you.

---

## PART D — AUDIENCE VERSIONS (same game, different lead)

| Audience | Lead with | The line |
|---|---|---|
| **Crypto-native** | useful OMR and funded inventory | "Bonds reserve existing OMR. Market fees have explicit recipients. Game spends, reserves and rewards each follow their own rules. We publish the mechanisms and verify activation separately." |
| **Mainstream gamer** | permadeath + the fantasy | "A mafia city with one life. When you die, your heir inherits your money and your enemies. Build an empire — or take one off someone's corpse." |
| **Builders / HN** | the invariant + real-Postgres CI | "The economy is adversarially checked nightly; extraction can't exceed inflow by plumbing; CI parses every query against real Postgres. And there's an MCP server." |
| **Agent builders** | first-class agents | "Point your agent at a live economy. Full API, MCP server, an opportunity board with computed EV, a public arena. It plays *with* humans." |
| **DeFi** | THE BANK | "A self-repaying loan with no liquidation function and no oracle on the borrow path. A price that's never read can't be manipulated." |

---

## PART E — THE TECH & FEATURES DECK (for the "tech used" ask)

**The stack**
- **Client:** one static HTML console, no build step; a PWA that installs to the home screen, with web push.
- **Server:** Node, server-authoritative — every roll on the server, logged to an RNG audit; client input is a choice, never a value.
- **Data:** Postgres, one row-locked transaction per action; CI parses and type-checks every SQL string against real Postgres.
- **Chain (EVM · Arbitrum Orbit L2 / Robinhood Chain):** ERC-20 OMR, ERC-1155 gear, signed withdrawal vouchers, funded inventory bonds, bounded stability reserves, seasonal Turf fees and a **Uniswap v4 hook** that charges inside the swap. Deployment, funding and activation require separate verification against the [market runbook](omerta-contracts/docs/market/RUNBOOK.md).
- **Agents:** open REST API, `/openapi.json`, `/llms.txt`, and an MCP server (`npx omerta-mcp`).
- **Media:** ~245 generated noir art plates, per-player procedural portraits, shareable "beef" and legend cards — lifetime art spend $11.12.

**The economy controls (what to verify)**
- **Separate acquisition rules:** cash cannot convert into OMR; inventory bonds cannot mint, while token-owner mint authority is independent.
- **Proven nightly:** a conservation invariant reconciles the whole ledger across ~30 checks; a one-cent drift alarms.
- **Extraction ≤ inflow, by plumbing:** the withdrawal signer can't sign past a reserve funded only by real revenue.
- **Bounded market terms:** immutable fee and bond terms coexist with Safe pause, funding and recovery powers; inspect each contract's actual authority.
- **Published money router:** every real-value inflow and where each slice lands, derived from live constants.

**The game (features), in the order a player meets them**
- **The streets** — 43 jobs, six districts, a stat build that decides your odds, three approaches per job.
- **The Kitchen** — cook, cut, and move product; a crew that sells while you sleep and expects to be paid.
- **The Empire** — businesses, rackets, territory; passive income that's genuinely at risk (the Bureau raids what earns; a killer takes a front off your corpse).
- **Wet work** — contracts, hitmen, vendettas, bodyguards, the Pen; a kill loots and swears a feud that outlives the man.
- **The Family** — gangs, turf, war, and the Commission, a five-seat chamber that votes weekly decrees the whole server plays under.
- **Vice** — a casino (craps, blackjack, poker, tournaments), a racetrack, a boxing stable, street races. All cash, never $OMR.
- **Going legit** — the Vault, the compound, the Dynasty, the estate: where a made man keeps what he means to keep.
- **The living world** — NPC residents and families, city events, weather, a day/night clock, rival cartels, world uprisings.

**Historical scale snapshot (checked 2026-08-11; superseded by the rechecked figures above):**
142 backend modules · 100 test suites · 222 database tables · 15 smart contracts · 213 Foundry tests
· 85 red-team reports. Retained to date the original launch-copy draft, not as current inventory.

---

## PART F — ELEVATOR PITCHES

**5 seconds:** "Build with cash. Commit OMR. Defend your empire."

**30 seconds:** "OMERTÀ is a browser mafia RPG with permanent character death and a surviving
bloodline. Cash and OMR have separate jobs. OMR supports useful purchases and commitments; inventory
bonds sell funded tokens. Value brought into the game can be taken by a rival. It's free, and it's
also built for AI agents to play alongside people."

**2 minutes:** "OMERTÀ gives cash and OMR separate roles. Cash has no conversion into OMR; defined
awards, funded rewards and purchases each follow explicit rules. Inventory bonds reserve existing
tokens, while the token owner retains separate mint authority. Conservation checks reconcile the ledger.
Extraction physically can't exceed real revenue in, because the withdrawal signer can't sign past a
reserve funded only by revenue. On top of that plumbing sits a deep game — forty-plus interlocking
systems, permanent death where your bloodline inherits the feuds, businesses you can lose off your
corpse, a federal RICO arc that ends in a prison with two ways out. And it has a second audience:
you can point a Claude or a GPT at it through an MCP server and it'll build a crew and recruit real
players. It's free to play in the browser today; the on-chain extraction rail is built and gated on a
third-party audit. Everything exciting rests on one boring thing: an economy you can prove instead of
one you hope holds."

---

## PART G — THE EARNINGS-FORWARD VARIANT (founder-directed, COUNSEL REVIEW REQUIRED)

The founder lifted the no-earnings rule for the hype videos (2026-08-14) and asked for the $OMR value
flywheel. That framing is **not** in the copy above, because `MARKETING.md` §0 forbids it and it is
the highest-scrutiny thing a pre-audit token can say. Use these only with counsel sign-off, keep them
**mechanism-true and number-free**, and keep every cash-out line **future/conditional** (the rail is
built and not switched on):

- "Specified OMR spends return to the Desk as inventory. Revenue-funded buybacks require real
  receipts and actual execution. Rewards distribute only through their authorized funding rules."
- "More players can create more uses for OMR. Inventory sales, rewards and governance decisions
  also affect available supply; activity does not guarantee a higher token price."
- "Play well enough and the city pays out — for real, on-chain, when the doors open."

**Why it's flagged:** earnings + "$OMR value" framing is the Howey-test surface. The lines are
defensible *because* they describe systems and carry no numbers and no dates — but one edit that
flips "when the doors open" to present tense, or adds a figure, or implies the price goes up, crosses
the line the whole book is written to hold. Counsel eyeballs it; the founder signs the final wording.

---

## BEFORE YOU POST (the four-question gate)
1. Earnings, price, or scarcity claim? → rewrite.
2. Every number still true? → check the file named in `MARKETING.md` §4.
3. A date on anything gated on the launch checklist or an audit? → remove the date.
4. Would a player who read it, then played, feel the game matched? → if not, the copy is wrong.
