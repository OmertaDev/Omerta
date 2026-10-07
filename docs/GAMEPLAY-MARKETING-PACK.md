# OMERTÀ gameplay-route campaign

Nine research sheets explain how a character becomes distinct without flattening OMERTÀ into a
class picker. Every number below is sourced from the current rules in `src/rules.generated.js` and
`src/rules.tail.js`.

## Campaign argument

**Promise:** the city does not hand every character the same optimal build. Training shapes the
foundation; a Path creates a real edge and a real weakness; skills determine capability; repeated
actions create mastery; Career records breadth and ambition.

**Master line:** SIX WAYS INTO THE CITY. EVERY EDGE LEAVES A WEAKNESS.

**System line:** You train the foundation. You choose a Path. You build a skill tree. The city
records what you practice. Your Career proves how far you can carry it.

## The nine sheets

1. **Choose Your Path** — the six-way decision, the shared gates, and the universal mastery rates.
2. **The Gun** — combat and contract execution at the cost of commerce.
3. **The Ledger** — compound income and trading at the cost of force.
4. **The Kitchen** — better product and cooler dealing at the cost of longer jail time.
5. **The Wheel** — faster convoys at the cost of slower cooking.
6. **The Shadow** — faster searches at the cost of direct contests.
7. **The Ring** — stronger contests at the cost of expensive recovery.
8. **How Your Character Becomes Yours** — attributes, Path, skills, mastery, and Career shown as
   five separate systems that reinforce one another.
9. **From Associate to The Don** — the five Career books, their six objectives, and the 4/6 and
   6/6 gates.

## Rules carried into the art

- A first Path becomes available at level 5 and costs $10,000 cash.
- Changing Path burns 150 OMR and is limited by a seven-day cooldown.
- A home trade earns mastery XP at 1.5x; a rival trade earns it at 0.6x; all others stay at 1x.
- Skills grant one point every four levels across Enforcer, Operator, and Wheelman.
- A full skill branch lands around level 40. Two capstones combine into a Grandmastery around
  level 48. Active abilities share an eight-hour cooldown; Grandmasteries use four hours.
- Ten action-trained mastery tracks run from level 1 to 50, with perks at 10, 25, and 40 and a
  virtuoso trait at 50. Purchased XP does not exist. An heir keeps 25% of mastery XP.
- Each Career tier contains six objectives. Four claims open the next tier; all six earn that
  tier's cash capstone. Career claims survive death.

## Distribution crops

The full 1600 × 1000 sheets are the canonical assets. Social derivatives should preserve the
headline, the central visual argument, and the source line—not shrink the whole sheet into an
illegible square. Planned crops:

- 1600 × 900 landscape for X and link previews.
- 1080 × 1350 portrait, one Path per post.
- 1080 × 1080 square, one mechanic and one proof point.
- 1080 × 1920 vertical sequence, master selector followed by six Path reveals.

## Deeds and eligible RWA distributions

**Your deed is your RWA vault.** Mint your deed to receive eligible RWA distributions funded by the protocol’s tax share. When distributions are active, assets are delivered to the on-chain vault attached to your deed. Your share depends on qualifying gameplay and available funding.

No paid Broker activation or deed upgrade is required for baseline qualification. Successful server-authoritative play must still meet the seven-day epoch’s three-track and score-25 gate; spending alone never qualifies. Without a finalized on-chain deed delivery target, allocations wait without expiry.

Optional permanent deed upgrades are sequential:

| Level | Spend $OMR | Required renown | Reward-weight bonus |
| --- | ---: | ---: | ---: |
| 1 | 150 | 5 | 5% |
| 2 | 450 | 20 | 10% |
| 3 | 1,200 | 50 | 15% |
| 4 | 3,000 | 80 | 20% |
| 5 | 9,000 | 120 | 25% |

Each upgrade also requires qualifying activity in the last seven days. Bonuses replace lower levels, cap at 25%, and apply only to future epochs whose entire activity window starts on or after the next UTC day. They redistribute shares of a fixed treasury-funded pool; they do not increase its budget or guarantee a payout. Spending $OMR uses the game sink and recycles inventory to the current market shelf; it does not destroy ERC-20 supply.

Upgrade level follows the deed when sold. Transfers, reimports and wallet changes apply bonuses only to future full reward windows beginning on or after the next UTC day; already earned allocations stay with the account that earned them. Upgrading or selling cannot rewrite previously allocated rewards or their original qualifying account. Existing paid Broker commitments retain their multiplier until expiry; the larger eligible multiplier applies, without stacking it with the upgrade bonus. All existing asset, funding, chain-finality, delivery and launch gates remain in force; source availability does not establish live RWA payouts.

Authenticated API: `GET /v1/deeds` shows upgrade status; `POST /v1/deeds/upgrade` accepts `{ "deedName": "Ash Street", "expectedLevel": 0 } (the named deed and its current level)`. `POST /v1/brokers/activate` is retired for new paid activations.
