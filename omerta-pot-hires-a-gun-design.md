# THE POT HIRES A GUN — an uncollected contract pot buys the NPC hitman

**Status:** design, awaiting adversarial refutation → build. Every number in it is a founder
sign-off lever. Nothing signed is retuned (ground rule #1).

**Provenance.** This answers the one open design call `BALANCE.md § THE ADAPTIVE HUNTERS` leaves
on the record, in that section's own words:

> a contract pot on a hunter nobody can collect refunds and lets him farm the town … whether a pot
> should be able to HIRE the NPC hitman when no player collects — the arena does not model
> `npcHit`, so its number is the worst case.

---

## 1. The finding, measured

`tools/arena.js` step three ran 90 warped days, three seeded pairs, `ARENA_HUNT_SEATS` on and off.
Read in kill order (`ORDER BY kill_log.at`, never `id` — a UUID is not an order), every run tells
the same story:

- Six career hunters **contract-kill each other first**. Five of six are dead by kill #18–24 in
  every seed, every arm.
- The **last one standing** then carries every remaining pot on his head **with nobody left who can
  execute it**. Open pots on a living hunter at day 90: **zero** — they all expired and refunded,
  **20–23 pots, $2.2–2.5M**, in every run a hunter survived.
- He farms the town unopposed: **60 / 60 / 50 kills** after the fifth hunter death in the controls,
  ending on 54–63 kills and a $16–26M pocket, top decile holding 97–98%.

The retaliation rail — the thing step two proved makes killing −EV as a career — **deters exactly as
long as somebody is left to COLLECT**. When the executors are dead, a pot is a note nobody can cash:
it sits for its TTL, refunds in full, and the mark it was written against never felt it.

The town has already paid. The money is already in escrow. It simply has no trigger.

## 2. The mechanic in one sentence

**A KILL pot that has sat unclaimed past a grace window buys the best NPC hitman it can afford, out
of its own escrow, and keeps doing so until it runs out of money.**

The pot is the client. The NPC hitman is the contractor. The funders paid for a body, and if no
player will take the job, the pot takes it to the professionals.

## 3. Why this shape and not another

Three alternatives were considered and rejected, and the reasons are the design:

1. **Let the pot roll over / never expire.** Does nothing — the problem is not that the money goes
   away, it is that nothing acts on it. A permanent pot is a permanent note nobody can cash.
2. **Let a pot pay a PLAYER to use `npcHit`.** Re-introduces the executor requirement the finding is
   about, plus a bounty-funded fee is a rail for paying an alt to click a button.
3. **Auto-kill the mark when the pot is large enough.** No. The NPC hitman is a *chance* — the weak
   buy a chance at the strong, never a certainty (`NPC_HITMEN`'s own design). A pot that guarantees
   a kill makes wealth a kill switch.

The chosen shape keeps every property the kill economy was signed with: the fee **burns win or
lose**, the odds are the signed `NPC_HITMEN` curve, and a rich pot buys a *better gun*, never a
sure thing.

---

## 4. The ten decisions

### Q1 — When is a pot eligible?

Eligible iff **all** hold:

| Condition | Why |
|---|---|
| `kind = 'kill'` | The NPC hitman kills. A hospitalize pot asks for a beating — wrong instrument. |
| `created_at + POT_GUN.GRACE_MS ≤ now()` | The grace window is what makes this a BACKSTOP rather than a faster `npcHit`. |
| `now() < expires_at` | An expired pot belongs to `sweepExpiredBounties` (§5 ordering). |
| `opens_at IS NULL OR opens_at <= now()` | A directed exclusive window is the named hitman's contractual right. Never jump it. |
| no `'HOUSE'` contributor row | `huntWanted` already sends free NPC hunters at a WANTED mark every tick — a pot-gun would double-dip, and it keeps confiscation-pool money out of a fee. |
| `hired_at IS NULL OR hired_at + POT_GUN.CD_MS <= now()` | Per-pot cooldown (Q3). |
| victim level ≥ `M3.NPC_MIN_TARGET_LVL` | The `npcHit` rookie floor, honoured identically. Skip, **no fee**, pot stands. |
| the pot can afford a tier and still keep `POT_GUN.KEEP` | Q2. |

**Grace is measured from `bounties.created_at`, not from the last top-up.** A top-up is *more*
evidence nobody will collect, not less — the town raising the price on a mark it cannot reach is
exactly the state this exists for. So no new `funded_at` column, and no way to reset the clock by
adding a dollar.

**Family/gang pots are eligible.** An uncollected family contract is the finding verbatim.

### Q2 — What does it cost, and where does the money come from?

The pot hires the **best `NPC_HITMEN` tier it can afford while retaining ≥ `POT_GUN.KEEP`** after
the carve (`KEEP` = `M3.BOUNTY_MIN`, so a pot never hires itself below the floor a player may post).
A bigger pot buys a better gun — correct economics, and the finding is about *huge* pots.

**The fee is carved from the escrow, proportionally across `bounty_contributors`.** This is the
load-bearing arithmetic, because `refundPot` (`src/social/contracts.js:402`) pays each funder from
`bounty_contributors.amount` — so **Σ shares must stay exactly equal to `bounties.amount`** or a
later refund over- or under-pays: §10.4 drift plus free money.

The carve, in floored integers:

```
total   = Σ floor(share_i)            // must equal floor(bounties.amount) — else FAIL CLOSED
carve_i = floor(fee × share_i / total)
rem     = fee − Σ carve_i             // 0 ≤ rem < n
```

then distribute `rem` **one dollar at a time** to shares sorted DESC by remaining
`(share_i − carve_i)`, skipping any already at 0.

**Termination proof.** After the proportional pass,
`Σ(share_i − carve_i) = total − (fee − rem) = total − fee + rem`. Eligibility guarantees
`total − fee ≥ KEEP ≥ 1`, so `Σ(share_i − carve_i) ≥ 1 + rem > rem` — there is always somewhere to
place the next dollar, and the loop cannot spin.

**Fail closed.** If `Σ shares ≠ floor(bounties.amount)` for any reason (legacy dust, a bug
elsewhere), the tick **skips the hire and logs**. A hire that papers over a broken pot would convert
an accounting fault into a lost life.

**The ONE new ledger reason is the fee outflow.**

### Q3 — What happens on a miss?

The fee is gone (it burns win or lose — the `npchit:hire` posture), the pot continues at its reduced
amount, and `bounties.hired_at` stamps a per-pot cooldown of `POT_GUN.CD_MS`.

**No attempt counter is needed.** The pot runs out of affordable money on its own: a $60k pot at a
$50k legbreaker fee hires exactly once and then fails the `KEEP` test forever.

### Q4 — What happens to the remainder on a KILL?

**It BURNS, and this needs no new code.** `runEstate` (`src/social/estate.js:320-352`) already locks
the dying character's pots, SUMs every open pot into ONE NULL-character `death:bounty` burn row, and
deletes the bounties/contributors/roster rows.

This is the most important economic property of the design, so state it plainly:

> A pot-gun kill costs the funders **the entire pot**. That is strictly WORSE for a funder than a
> player claim, which at least pays the killer they wanted paid.

Which means the pot-gun **keeps hunters employed** rather than replacing them. It is a backstop, not
a cheaper route: a funder always prefers a player to collect, and only reaches this when nobody
will.

### Q5 — Shields

Identical to `huntWanted` (`src/social/combat.js`, the headless NPC kill precedent):

- `safeHoused` / `witproActive` / `penSafe` / `inHole` / hospitalized / jailed → **skip the tick, NO
  fee.** The contractor never found them.
- **Bodyguard absorb** or **respawn token** → **the fee IS spent.** The contractor showed up; that is
  what `npcHit` charges for, and it is the shape `npcHit` already uses.
- **The grace clock does NOT pause.** A mark living in a safehouse already pays the signed D2 costs
  (wealth-scaled price, a daily allowance, and no offence or extraction while sheltered). Pausing
  the clock would pay them twice for the same shelter.

### Q6 — Anti-abuse

The pot-gun is **strictly worse than `npcHit` on price** and better only on **reach**:

| | `npcHit` | pot-gun |
|---|---|---|
| Cost to the buyer | a flat fee | the fee **plus the whole pot on a kill** |
| Cooldowns | per-payer 6h + per-target 24h | per-pot `CD_MS`, but no per-payer gate |
| Heat / honor / grudges | the payer eats all three | nobody eats them |
| Works while offline / dead | no | yes |
| Speed | immediate | only after `GRACE_MS` |

So a player who wants somebody dead **now** still uses `npcHit`; the pot-gun is what a town uses on
a mark it cannot reach. **`GRACE_MS` is the wall** that stops it being a laundered fast hit.

Alt self-hire buys nothing: the fee burns and the pot burns on the kill, so a self-funded pot is a
pure loss with the same odds a direct `npcHit` would have given at a fraction of the price.

### Q7 — Who gets the kill?

**Nobody.** `runEstate(client, h, victim, 'A HIRED GUN')` with **no `killerCh`** — the `huntWanted`
precedent exactly:

- no chop, no `whack:loot`, no gear loot
- no hitman rep, no `kills` / `season_kills`
- no `kill_log` row → no vendetta, no blood ledger, no `rival_events`
- no war points
- `opts.killerCh?.id` is `undefined`, so the estate's exclusive-pot self-refund branch is inert and
  **all** the victim's pots burn

A contractor nobody can name leaves no feud. That is the point: the pot-gun ends a reign, it does not
crown a successor.

### Q8 — Locks

A headless worker sweep, single-writer.

```
pg_try_advisory_lock(POT_GUN class)     — the runPopulation / DEX-bot precedent (this SPENDS)
  per pot, its own transaction:
    SELECT … FROM characters WHERE id = victim FOR UPDATE      — characters FIRST
    SELECT … FROM bounties  WHERE (target, kind) FOR UPDATE    — then pots
```

- **Funder character rows are NOT locked.** The carve writes only `bounty_contributors` leaf rows and
  moves no cash to a funder. This is what keeps the sweep cheap and lock-order-clean.
- **No AB-BA with `sweepExpiredBounties`** (`contracts.js:485`): that sweep holds *funder* chars and
  wants the pot; this one holds the *victim* char and wants the pot. Different first resources, same
  second — they serialize on the pot rather than cycling.
- **No AB-BA with the player paths**: `fire` / `claimBounty` / `cancelBounty` all take characters
  before pots, which is the order here.
- The advisory lock is for **single-writer**, not for correctness: two overlapping workers must never
  each spend the same pot's escrow. The loser SKIPS (a keeper run is a periodic sweep; the next tick
  is the retry).

### Q9 — Surfaces

Every one of these is the *terms ride with the price* rule: a funder must know their pot will start
spending itself.

| Surface | What it says |
|---|---|
| `GET /v1/contracts` | a `hiring` block per pot: eligible now / seconds until eligible / the tier this pot could afford / the fee. |
| Funder notify (`contract_hired`) | the fee and the tier. **Never** other funders' names — the info-economy rule; anonymity of a pot's funders is already paid for with the `intel:peek` sink. |
| Mark notify | the existing `npchit_survived` on a miss. **Never** which pot or who funded it.** |
| Streets feed | the anonymous `bus.emit('streets', { type: 'kill', by: 'a hired gun', victim })` — the `huntWanted` shape. |
| `describe()` | one line for the funder's toast. |
| `feedText` | one template per new notification type (THE WIRE LEDGER's rule — a type reaching a player must have a template, and a type emitted with two shapes must BRANCH). |

### Q10 — Levers

A `POT_GUN` block in the M3 rules tail, every number pinned in `test/levers.js` and tabled in
`BALANCE.md`:

| Lever | Proposed | What it does |
|---|---|---|
| `ENABLED` | `true` | Kill switch. `false` reverts the game byte-for-byte. |
| `GRACE_MS` | 24h | The wall that makes this a backstop, not a fast hit. |
| `CD_MS` | 12h | Per-pot cooldown between hires. |
| `KEEP` | `M3.BOUNTY_MIN` | The floor a pot may never hire itself below. |
| (reused) | `M3.NPC_MIN_TARGET_LVL` | The rookie floor, unchanged. |
| (reused) | `NPC_HITMEN` | The tier ladder and its signed odds, unchanged. |

`POT_GUN_P` is a **TEST-ONLY** env roll knob (the `LAW_BUST_P` / `WANTED_HUNT_P` precedent),
classified TEST_ONLY in `src/preflight.js`.

---

## 5. §10.4 — the walls

**The pot funds the fee. Nothing mints.**

### The one new reason

`bounty:hire` — rides the existing `bounty:` cash-vocabulary prefix, so **ZERO vocabulary change**:

- `character_id` NULL
- amount **negative** (a burn)
- `counterparty = target`

### The escrow identity gains one subtracted term

`src/invariants.js:236-251` today:

```
SUM(bounties.amount) == posted + gangPosted + wantedPosted
                        − claimed − refunded − wantedRefunded − deadBounties
```

becomes `… − hired`, where `hired = Σ |bounty:hire|`.

The invariant is what makes the carve safe: if the proportional split ever loses or gains a dollar
against `bounties.amount`, the identity breaks that night.

### Check (b) must stay drift-0 — and this must be TESTED, not argued

The gang-treasuries check sums NULL-character rows matching the **exact** reason `bounty:refund` as
treasury inflow. That is the precise reason `bounty:wanted:refund` was given a distinct name (a
recorded audit HIGH). `bounty:hire` is a distinct reason and a NEGATIVE amount, so it is invisible to
check (b) **by construction** — and the regression asserts check (b) drift is unchanged across a
hire, because "by construction" is exactly the claim that has been wrong before.

### What does NOT move

- **No new bucket.** The escrow already lives in `bounties.amount`; the fee leaves it.
- **No faucet.** Every dollar the pot-gun touches was posted by a player and is either burned as the
  fee or burned as `death:bounty` on the kill.
- **No `character_id` row**, so the per-character cash check (a) is untouched.
- The kill's remainder burn is the **existing** `death:bounty` path — not a new outflow.

---

## 6. Measurement

**Sim probe P9.41** (analytic, prints every run, no value seeded):

- expected funder cost per hire (fee, and fee + remainder at the tier's kill probability)
- the base-wide daily ceiling on escrow burned: bounded by (eligible pots) × (1 hire per `CD_MS`) ×
  (the affordable tier's fee)

**Arena.** `tools/arena.js` does not model `npcHit` today and must model the pot-gun to answer the
founder's open question. The measurement that matters is the seeded pair on the same
`ARENA_SEED` / `ARENA_HUNT_SEATS` arms as step three:

> Does the surviving hunter's unopposed run (54–63 kills, 97–98% top-decile) end when the pots he is
> carrying can hire?

That number, not this document, is what the founder signs.

---

## 7. What this deliberately does NOT do

- It does not make killing cheaper. The funder pays more, not less.
- It does not create an executor. Nobody gains rep, loot, or a feud.
- It does not guarantee anything. The odds are the signed `NPC_HITMEN` curve, clamped
  `[NPC_MIN_SUCCESS, NPC_MAX_SUCCESS]`.
- It does not touch a signed lever. Every number is new and every reused one is read, not rewritten.
