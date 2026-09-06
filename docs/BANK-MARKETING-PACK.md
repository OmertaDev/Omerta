# THE BANK — marketing pack

**Audience:** DeFi. Not the game's audience. This pack is written for people who have read a
liquidation post-mortem, and it is deliberately colder than everything else in `docs/`.

**Status, stated in the tense `MARKETING.md` §8 requires: BUILT — DORMANT.** The contracts are
written, the backend is built, the suites are green, and the market is **not deployed**. Nothing in
this pack may be posted in the present tense as a live product. Every claim below is a claim about
what is built and what it will do when it is deployed, and the copy says so.

**Every number is measured from `omerta-contracts/src/Alchemist.sol`.** Not remembered, not
approximated.

---

## The campaign argument

Two things happened in 2022 that most of this audience remembers without being reminded.

Inverse Finance lost **$15.6M in April** and **$5.8M in June** — both to oracle manipulation on the
borrow path. Both times the attack was the same shape: the protocol read a price, the price was
moved, and the read decided how much could be borrowed against what.

Every self-repaying-loan design since has been built in that shadow, and most of them still read a
price somewhere.

**Ours does not have one on the borrow path.** Not a better oracle — no oracle. The collateral and
the debt are both denominated in dollars, so the borrow decision compares dollars to dollars and
never asks anything what anything is worth. A price that is never read cannot be manipulated. That
is not a mitigation, it is the absence of the attack surface.

**And there is no liquidation function anywhere in the contract.** Not paused, not gated, not
owner-only — absent. The consequence is worth stating as flatly as the code states it: **there is no
price at which a user is liquidated.** Debt only ever falls, from harvested yield or from a
repayment.

---

## The promise

> **Deposit. Borrow. The yield pays it back. Nobody can call the loan.**

## Master line

> **No liquidations. No oracle on the borrow path. Both, because the function isn't there.**

## System line

Deposit a stablecoin. Borrow against it up to a Safe-set ceiling — **50% at deploy, hard-capped at
90% in the contract**, so nobody, including us, can raise it past that. The yield on your collateral
is harvested and applied against your debt until the debt is gone, after which the collateral is
yours to withdraw. The protocol takes **20% of harvested yield**, and that fee is **capped at 30% in
the contract** so a stolen key cannot raise it either.

---

## The disclosure that is the actual differentiator

The fee is the part most protocols bury, and it is the part we lead with, because a performance fee
on a self-repaying loan does not cost you money — it costs you **time**, and the time is the entire
product.

> **ILLUSTRATIVE, not a projection:** at a 50% loan-to-value and an 8% realised yield, a 20% harvest
> fee moves the payoff date from roughly 6.25 years to roughly 7.8.

Say it exactly like that, with the word ILLUSTRATIVE, every time. It is arithmetic on assumed inputs
and it is not a forecast of anything.

**And the UI never quotes a nominal rate.** The projected payoff date is computed from live,
post-fee, *realised* yield once the market is live, and it moves with it. **No yield, no number** —
the interface refuses to show a date rather than showing an optimistic one. That refusal is the
strongest single thing we can demonstrate to this audience, because it is the opposite of what the
category does.

---

## The thread

> 1/ In 2022, Inverse Finance lost $15.6M in April and another $5.8M in June. Both to oracle
> manipulation on the borrow path.
>
> 2/ Every self-repaying loan built since has lived in that shadow. Most still read a price
> somewhere.
>
> 3/ Ours doesn't have one on the borrow path. Not a better oracle — no oracle. Collateral and debt
> are both denominated in dollars, so the borrow decision compares dollars to dollars.
>
> 4/ A price that is never read cannot be manipulated. That isn't a mitigation. The attack surface
> isn't there.
>
> 5/ There is also no liquidation function. Not paused. Not owner-gated. Absent. There is no price
> at which you get liquidated, because there is no code that could do it.
>
> 6/ Debt only ever falls — from harvested yield, or because you repaid it.
>
> 7/ We take 20% of harvested yield. That's capped at 30% inside the contract, so a stolen key can't
> raise it.
>
> 8/ And here's the number most protocols don't publish: what the fee does to your payoff date.
>
> 9/ ILLUSTRATIVE — at 50% LTV and 8% realised yield, a 20% fee moves payoff from ~6.25 years to
> ~7.8. That's the cost. It's time, not money.
>
> 10/ The UI never quotes a nominal rate. It computes the projected date from live post-fee realised
> yield. No yield, no number. It would rather show you nothing than show you an optimistic guess.
>
> 11/ Built and audited-pending. The market is not deployed yet. When it is, this is what it does.

---

## Headlines

- *There is no price at which you are liquidated.*
- *No oracle on the borrow path. Not a better one — none.*
- *We publish what our fee does to your payoff date.*
- *No yield, no number.*
- *The fee is capped in the contract, not in the docs.*

## Captions

> The borrow path never reads a price. There is nothing to manipulate.

> 20% of harvested yield, capped at 30% in the contract. Here's what that does to your payoff date,
> in years, publicly.

> Debt only ever falls.

---

## FAQ — the four questions this audience will actually ask

**"What's the catch on 'self-repaying'?"**
Time. The loan repays from realised yield, so if the yield is low it takes longer, and if there is
no yield it does not repay at all. That is why the interface refuses to show a projected date when
there is no realised yield to compute one from. It is a slower payoff, never a liquidation.

**"So what happens if the collateral's value moves?"**
Nothing on the borrow path, because the borrow path does not read a value. Collateral and debt are
both dollar-denominated. Where a ratio matters, a breach costs a slower payoff and blocks further
borrowing and withdrawal until it clears — it is never a loss, because there is nothing to liquidate.

**"Who can change the parameters?"**
A Safe, within compile-time ceilings it cannot exceed: LTV capped at 90%, the harvest fee capped at
30%. Those two numbers are constants in the contract. The Safe sets values beneath them; it cannot
set values above them, and neither can a stolen key.

**"Is it live?"**
No. Built, tested, and pending a third-party audit and the launch review. We are not taking deposits
and are not asking anyone to plan around a date.

---

## Claim discipline for this pack specifically

The general rules bind — no earnings claims, no token-price claims — and this audience adds three
more that matter more here than anywhere else:

- **Never say "risk-free".** No liquidation is not no risk. Smart-contract risk, yield risk and
  stablecoin risk all remain, and saying so is what makes the rest credible.
- **Never quote an APY or a nominal rate.** The product deliberately does not, so the marketing
  cannot.
- **Never state a launch date.** Deployment is gated on a third-party audit of the contracts and the
  signer, plus the launch review. "When it clears" is the only honest schedule.
- **Always mark the payoff example ILLUSTRATIVE**, and always give the inputs it assumes.

## What the art has to carry

- A ledger, a fountain pen, a bank teller's cage. Period-correct 1940s, same world as everything
  else.
- **No charts.** No price lines, no up-and-to-the-right, no percentages floating over a graph.
- **No money shots.** No stacks of cash, no vaults full of gold, no wallet balances.
- The strongest single image for this audience is the absence: an empty chair where the liquidator
  would sit.

## Distribution

| Surface | Use |
|---|---|
| **X thread** | The thread as written; steps 1–6 stand alone if you need a short one |
| **DeFi forums / research Discords** | The FAQ and the disclosure section; this audience reads the fee section first |
| **Long-form** | Lead with the two Inverse figures, then the two absences, then the disclosure |
| **Landing page** | The master line and the four headlines |
| **Docs** | Link `omerta-contracts/src/Alchemist.sol` directly. This audience reads source, and the contract's own comments say what this pack says |

## Where this fits in the book

`MARKETING.md` §5 arc 7 — *"A self-repaying loan with no liquidations."* This is the copy for it.
`MARKETING.md` §4.3 is the summary; this is the campaign.
