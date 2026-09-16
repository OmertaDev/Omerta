# CLAUDE.md — project context for Claude Code sessions

You are building the production backend for OMERTÀ, a multiplayer noir mafia RPG that settles on an EVM
chain (Robinhood Chain, an Arbitrum Orbit L2 — M6 moved off Solana; see `omerta-chain-migration-evm.md`).
The founder (Jorge) is non-technical: explain decisions plainly, and never assume he can debug — tests
must prove things work.

**How to read this file.** Everything here is BINDING and short: the ground rules below, and the
sensitive product rules at the end. Read both; they govern every session.

**The drop log lives in `docs/LOG.md` and is NOT loaded automatically.** That is deliberate — it is
~18,500 lines of history, and injecting it into every window costs ~370k tokens to answer questions a
grep answers in one line (`GRAPH.md` §6 is the argument). It is the codebase's PRECEDENT DICTIONARY:
~439 comments in `src/` cite a pattern by name ("the fade pattern", "the refundPot discipline", "the
casino:pvp transfer"), and that log is where those names are defined. When you meet one:

```
grep -n "refundPot discipline" docs/LOG.md      # the precedent, and the drop that set it
grep -n "THE PAD\|business:upkeep" docs/LOG.md  # a system's whole history, newest last
node tools/knowledge.js                         # the graph; CITES edges resolve named precedents
```

**A new DROP's entry goes at the end of `docs/LOG.md`, not here.** Only a new BINDING rule — one that
governs every future session rather than recording one — belongs in this file.

**For current state, not history:** `SPEC.md` (architecture, the invariants, the open technical-debt
register), `BALANCE.md` and `SIGN-OFF.md` (the economy levers and the founder's decisions),
`docs/AUDITS.md` (the audit trail, which indexes all 96 reports and states that they are point-in-time).


## Ground rules
1. **`omerta-backend-spec.md` is the contract.** Every formula, table, and timer is specified there with production values. Do not invent mechanics or "improve" balance — the numbers were sim-audited.
2. **The rules live in two files and the seam is enforced, not remembered.**
   `src/rules.generated.js` is MACHINE-OWNED — only the prototype's 22 data tables, overwritten
   wholesale by `node tools/extract-rules.js <prototype>.jsx`. `src/rules.tail.js` is HAND-WRITTEN —
   every helper, catalog, ladder and founder-signed lever — and the extractor never opens it.
   `src/rules.js` re-exports both, so every import site is unchanged. To change a TABLE, edit the
   PROTOTYPE and re-extract (the car-catalog precedent); to change anything else, edit the tail.
   `test/rules.js` fails if hand-written code appears in the generated half, if it grows an import,
   if the extractor addresses any other file, or if both halves export the same name.
3. **Server-authoritative always.** Client input is a choice, never a value. All randomness server-side and logged to `rng_audit`.
4. **Every value movement writes to `transactions`.** The §10.4 invariants are sacred. AMENDED by the
   founder-directed VALUE-CREATION pivot (2026-07-23, `omerta-value-creation-design.md`): value transfers,
   OR is minted through ENUMERATED, SCHEDULED emission faucets only (today: `emission:wage`, bounded per-epoch
   by `epochBudget` and lifetime by the `emission within endowment` check). Discretionary/unbudgeted minting
   remains forbidden and is the loudest alarm. Add invariant checks to tests when you add faucets/sinks.
5. **Lazy accrual, no global ticks** (§7.1). Any new time-based mechanic extends `src/accrual.js` inside the same pattern.
6. **One DB transaction per action**, row-locked via `withCharacter` (extend it for two-party actions in M3: lock both rows in a stable order to avoid deadlock).
7. Run `npm test` after every change; extend `test/smoke.js` (or add files) for every new endpoint — both success and gate-rejection paths.
8. **A GREEN `npm test` IS NOT A GREEN BUILD. After every push, check CI before doing anything else.**
   The suites run on pg-mem, which is a different database engine from production and disagrees with
   it in ways no suite can see. On 2026-07-30 a `uuid = text` comparison made `loadOwned` fail to
   PARSE — every authed request 500'd for hours — while all 61 suites stayed green. CI's real-Postgres
   job caught it *on the exact commit that broke it*, and seven more commits were pushed on top of a
   red build because only the pg-mem result was read. The guard worked; nobody looked.
   **`npm test` green means the pg-mem half passed and nothing more.** Before pushing anything that
   touches SQL, run the real-Postgres gates locally — they need a throwaway database and nothing else:
   ```
   su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pg -o '-p 5433 -k /tmp' -l /tmp/pg.log start"
   DATABASE_URL='postgres://postgres@/db?host=/tmp&port=5433' npm run pgquery   # every SQL string parses
   DATABASE_URL='postgres://postgres@/db?host=/tmp&port=5433' npm run pgcheck   # the loop, locks, ledger
   ```
   (`initdb`/`pg_ctl` refuse to run as root — hence `su postgres`.) After pushing, confirm the run
   went green. A red CI that nobody reads is worse than no CI, because it manufactures confidence.
9. **UNCOMMITTED WORK MUST NOT BE DESTROYABLE. Run `tools/savepoint.sh` after every meaningful edit
   and ALWAYS before any git command that can discard** — checkout, restore, reset, stash, merge,
   rebase, clean. FIVE separate times a whole session's work was wiped here: twice by
   `git checkout <file>` used to undo a mutation, once by an external `git merge -s ours`, and TWICE
   by a container restart reverting the checkout to an old lineage. Each time the remedy written down
   was a PARAGRAPH, and each next occurrence proved that a rule with no enforcement is not a rule.
   The enforcement is one command with THREE layers, ordered by what each survives, every claim
   MEASURED rather than assumed:
   ```
   L1  THE INDEX (git add -A)      unstaged + `git checkout -- f` → reverts to HEAD. GONE.
                                   STAGED   + `git checkout -- f` → reverts to the INDEX. SURVIVES.
                                   STAGED   + `reset --hard`      → dangling blob, still recoverable.
   L2  A MIRROR under $HOME        survives git itself going wrong (bad merge, wrong-lineage
                                   checkout). NOT /tmp — a container restart wipes that.
   L3  refs/heads/savepoint/<br>   the ONLY layer off this machine, so the only one that survives
                                   the container being replaced. `git stash create` snapshots the
                                   working tree into a commit object without touching the tree.
   ```
   L1 alone turns the most frequent disaster into a no-op. But on 2026-08-21 the fifth occurrence
   defeated L1 AND L2 at once — the restart replaced the tree, wiped /tmp, and **took the savepoint
   script with it**, so the tool was missing at the one moment it mattered (it now installs a copy to
   `~/.omerta-savepoint.sh`). The work came back only because it had been PUSHED, which is the whole
   argument for L3 and for the sentence that follows. Note L3 uses `refs/heads/savepoint/*`, not a
   `refs/wip/*` namespace: this session's git proxy answers 403 to anything outside `refs/heads/*`.
   **And commit and PUSH each fix the moment its mutation passes rather than batching a whole drop**
   — a savepoint is a safety net, a pushed commit is the floor. After a loss:
   `tools/savepoint.sh --recover` (or `~/.omerta-savepoint.sh --recover` if the tree is gone) prints
   every remote savepoint branch, every local snapshot and every dangling blob, in that order.
10. **NEVER ASSUME. MEASURE, THEN TEST.** Founder-directed 2026-08-21, after a finding in this file
    turned out to be a guess: a `describe()` branch was called silent from READING one branch, and an
    earlier branch ~700 lines up already handled it — the "fix" was dead code, and only a mutation
    caught it. The rule has four enforceable parts, each earned by a specific failure already recorded
    here:
    - **A claim you have not REPRODUCED is not a finding.** Drive the real route against a running
      engine and read the actual output. This applies to clean bills of health too: a sweep that
      reaches nothing reads exactly like a sweep that passes, so every extractor states what it
      matched and asserts a non-zero floor.
    - **Check the NEIGHBOURS before you claim a path is uncovered.** `describe()`, the gate chains and
      the watcher poison list are flat `if` chains with early returns — an earlier sibling can already
      own the shape you are about to add a branch for.
    - **Every mutation must ASSERT ITS ANCHOR LANDED.** A mutation that silently did not apply reads
      exactly like a fix that holds; that has happened three times. Mutate on a scratchpad copy
      (`cp` out, `cp` back), never `git checkout`, and run with `set -o pipefail` — a piped exit code
      is the tail's, not the run's.
    - **Every fix ships with a unit test that FAILS BY NAME when the fix is reverted.** Assert against
      what the SERVER actually sent or what the DATABASE actually holds, never a literal restatement,
      and never against the reply under test when a table can answer instead. If the mutation survives,
      that is a claim about the TEST before it is a claim about the code.


## Where things stand

Every milestone, drop, audit and retune is recorded in **`docs/LOG.md`**, newest last. Search it rather
than reading it. The short version: M1–M8 shipped the game, the chain layer (M6) is BUILT and DORMANT
behind the third-party contract audit and the launch checklist, the Risk-to-Earn pivot and the tokenomics
v3 migration are complete, and the current surface is ~236 backend modules under ~207 test suites with a
§10.4 ledger sweep that must stay drift-0. `SPEC.md` §1 carries the live census.


## Sensitive design notes
*These are standing PRODUCT rules. They bind whatever else is true, and several of them exist
because breaking one is very hard to walk back.*
- **The Street Wage pays players on a schedule — the MESSAGING is founder-gated.** The MECHANICS ship
  under the standing founder directive; the copy does not: no earnings promises, no income claims, no
  "side hustle" language in official copy until the founder clears exact wording. Describe the
  schedule factually only. The wage must NEVER become discretionary or chance-based (it would break
  both the anti-Axie wall and the no-chance rule).
- Social/onboarding rewards pay in-game cash only, never $OMR (v24 rule) — unchanged.
- Agent-flagged accounts: excluded from referral payouts, harder rate limits, public badge.
- **The tier-2 "family tree" referral is intentionally a FLAT, one-time cash finder's fee — NOT an
  ongoing percentage of the grandrecruit's earnings.** That distinction is the anti-MLM line and it is
  load-bearing: a bounded per-recruit bonus is a referral incentive, an ongoing revenue share down a
  multi-level tree is a pyramid. Keep it CASH ONLY, DEPTH 2 (never a 3rd level), agent-excluded at every
  level, once ever per recruit. The founder green-lit it under the blanket "proceed with the
  architecture" directive; do NOT deepen the tree or convert the fee to a percentage.
- **The RWA tickers are REAL tokenized stocks trading on Uniswap** (ERC-20s, `stocks` category,
  Arbitrum / Robinhood Chain) — founder clarification 2026-07-19. Implications: R2's buy-bot swaps
  ETH → the actual stock-token into the reserve (backing price = the live Uniswap TWAP, the oracle the
  Vig bot already reads); R3's delivery hands that real token to the player's wallet — **the one gated
  event in the project**. **R1's in-game price stays the deterministic §7.11 hash proxy — NOT the live
  Uniswap price — on purpose** (a price tracking a real asset weakens the "pure status" posture that
  keeps R1 shippable everywhere; the real oracle appears only in R2, behind the gate). **The
  eligibility gate is HARD:** the issuer restricts who may hold these, so R3 delivery must check
  eligibility — a barred account plays, earns and holds the status fully but can never extract; R1
  (status only) ships to everyone. And **never distribute the token by chance** (RNG/loot/casino stay
  in cash/$OMR) — *RETIRED as a binding rule by the founder 2026-08-21 (see THE TWO RULES RETIRED,
  end of this log): chance-based products in $OMR or real assets are now designable. What survives
  the retirement is FACT, not preference — a random-for-real-money product is a regulated shape, so
  any such build publishes its odds and goes through the launch checklist's counsel rows; every
  shipped surface (the deterministic rarity upgrade, the deterministic broker weights) keeps its
  current behavior until a specific product decision changes it.*
