// THE COMMISSION (design: omerta-commission-design.md). The top-SEATS families by standing vote
// weekly on a city decree; the majority of week W−1's votes governs week W, tallied LAZILY by
// whoever asks (no ticks). One family one vote, changeable all week, and votes are PUBLIC — the
// politics is the content. Step two (audit-hardened): a ballot stamps the family's STANDING at
// cast time (re-casting refreshes it); the tally ranks the week's FROZEN ballots by that stamp,
// counts only the top SEATS of them, and derives the weights (head = SEATS … last = 1) from the
// rank — so the electorate is bounded at the seat count no matter how many families transited
// the table mid-week, stale "I held the head seat for a minute" ballots rank where they belong,
// and the result never moves once the week freezes. A dissolved family's ballots die with it
// (social.js removeMember). The head seat's BOSS may VETO the sitting decree once per week, on
// the public record. No decree moves money: effects are bounded one-week modifiers applied at
// exactly one touchpoint each (safehouse / declareWar / laylow / convoy defense).
import { GameError, bus, ledger } from './game.js';
import { COMMISSION, decreeOf, weekOf, dayOf, statesmanRankOf, TICKER_BALLOT, usd } from './rules.js';
import { approvedStockTokenCatalog } from './stockcatalog.js';
import { encodeAbiParameters, getAddress, keccak256, toBytes } from 'viem';
import { dbCaps } from './db.js';
import { finalizedStockCatalogForBallotV2 } from './stockcatalogv2.js';

// THE STATESMAN (Tier-4) — bump the account's lifetime political-capital legend by DIRECT SQL (additive,
// NUMERIC → pg-mem-safe; OFF persistAccount's positional list → clobber-safe, the hitman_rep precedent).
const bumpStatecraft = (client, accountId, n) =>
  client.query('UPDATE account_persistent SET statecraft = statecraft + $2 WHERE account_id=$1', [accountId, n]);

// THE OVERRIDE — the CURRENT seated FLOOR (non-head) families' summed seat-weight that voted to override
// the head veto this week. Uses live seats (a family that overrode then lost its seat contributes 0).
async function overrideWeightOf(db, week) {
  const seats = await seatedGangs(db);
  // gang_id is TEXT here vs the gangs UUID column — coerce both to strings so the set lookup is exact
  const ov = new Set((await db.query('SELECT gang_id FROM commission_overrides WHERE week=$1', [week])).rows.map((r) => String(r.gang_id)));
  let w = 0;
  for (let i = 1; i < seats.length; i++) if (ov.has(String(seats[i].id))) w += (COMMISSION.SEATS - i); // exclude the head seat (i=0)
  return w;
}

// the CHAMBER's ladder — THIS SEASON's showing (tribute since rollover + 10k per war won this
// season). Econ pass (flagged in three audits: purchasable standing): lifetime tribute never
// decayed, so a parked whale owned the head seat + veto forever at ~zero net cost — the chamber
// now re-contests every season (the hitman legend/season precedent; season_tribute/season_wars
// reset in runSeasonRollover). Buying a seat still works — but it must be re-bought each season,
// and the parked treasury is war-lootable all the while. The buyback family split keeps the
// LIFETIME formula (a different, signed surface — worker.js).
// Deterministic tiebreak on id: tied families must not flap seats (or the head chair) per read.
export async function seatedGangs(db) {
  return (await db.query(
    // NPC FAMILIES: never seated, EXPLICITLY. A resident-run family cannot vote, and a silent
    // ballot is not neutral — it shrinks the effective electorate and makes deadlock likelier, on a
    // chamber whose decrees modify signed surfaces (safehouse cost, war cost, laylow, convoy
    // defence, the loot rate). Today it is also true by accident, since the `standing > 0` filter
    // below excludes a family that neither pays tribute nor wins a war; the flag is what makes it a
    // promise a test can pin, and what stops a later step (residents paying tribute) re-opening it
    // in silence. NOTE the invariants deliberately do NOT exclude them — their treasuries are real
    // §10.4 buckets, and filtering there would manufacture the drift the check exists to catch.
    `SELECT id, name, tag, season_tribute + 10000 * season_wars AS standing FROM gangs
      WHERE NOT npc_flag AND season_tribute + 10000 * season_wars > 0
      ORDER BY season_tribute + 10000 * season_wars DESC, id ASC LIMIT ${COMMISSION.SEATS}`)).rows;
}

// rank week-`week` ballots by stamped standing and derive seat weights — the frozen electorate
async function rankedBallots(db, week) {
  const rows = (await db.query('SELECT gang_id, decree, standing FROM commission_votes WHERE week=$1', [week])).rows;
  return rows
    .map((r) => ({ gang_id: r.gang_id, decree: r.decree, standing: Number(r.standing) }))
    .sort((a, b) => b.standing - a.standing || (a.gang_id < b.gang_id ? -1 : 1))
    .slice(0, COMMISSION.SEATS)
    .map((r, i) => ({ ...r, weight: COMMISSION.SEATS - i }));
}

// step three — the TALLY winner of voting-week `week` (the decree its ballots enact). When any
// PROPOSALS exist for that week, only votes for PROPOSED decrees count (skin in the game sets the
// ballot — omerta-deep-deferred-design.md §B); with none, the chamber votes freely (backward-
// compatible). Tie or silence → deadlock (null). Shared by activeDecree (which adds the veto) and
// settleProposals (which pays on the TALLY — a veto kills the decree, not the vote).
export async function tallyWinner(db, week) {
  let ballots = await rankedBallots(db, week);
  const proposed = new Set((await db.query('SELECT decree FROM commission_proposals WHERE week=$1', [week])).rows.map((r) => r.decree));
  if (proposed.size) ballots = ballots.filter((b) => proposed.has(b.decree));
  if (!ballots.length) return null;
  const tally = {};
  for (const b of ballots) tally[b.decree] = (tally[b.decree] || 0) + b.weight;
  const sorted = Object.entries(tally).map(([decree, n]) => ({ decree, n })).sort((a, b) => b.n - a.n);
  if (sorted.length > 1 && sorted[0].n === sorted[1].n) return null; // the Commission deadlocked
  return decreeOf(sorted[0].decree);
}

// the decree in force for `week` = the weighted majority of week−1's top-ranked ballots (tie or
// silence → deadlock) — unless the head of the table killed it (the veto keys the governed week)
export async function activeDecree(db, week = weekOf()) {
  const winner = await tallyWinner(db, week - 1);
  if (!winner) return null;
  if ((await db.query('SELECT 1 FROM commission_vetoes WHERE week=$1', [week])).rows[0]) {
    // killed at the table — UNLESS the floor mustered a supermajority OVERRIDE (Tier-4), which restores it
    if ((await overrideWeightOf(db, week)) < COMMISSION.OVERRIDE_WEIGHT) return null;
  }
  return winner;
}

// cast (or change) the family's vote — boss/underboss of a SEATED family only. The ballot stamps
// the family's CURRENT standing (re-casting refreshes it); the returned weight is the seat the
// family speaks from today — the tally derives the final weights when the week freezes.
export async function castVote(ch, decreeId, client, h) {
  if (h.owned.gangRole !== 'boss' && h.owned.gangRole !== 'underboss')
    throw new GameError('rank', 'Only the boss or underboss speaks for the family.');
  if (!decreeOf(decreeId)) throw new GameError('bad_decree', 'No such motion before the Commission.');
  const seats = await seatedGangs(client);
  const seatIdx = seats.findIndex((s) => s.id === h.owned.gangId);
  if (seatIdx < 0)
    throw new GameError('no_seat', `The Commission seats the top ${COMMISSION.SEATS} families. Earn the standing.`);
  const standing = Number(seats[seatIdx].standing);
  const week = weekOf();
  // UPDATE-first, INSERT on zero rows; a concurrent first-cast race (boss + underboss) loses
  // cleanly on the (week, gang_id) PK instead of surfacing a raw 500
  const upd = await client.query('UPDATE commission_votes SET decree=$3, standing=$4 WHERE week=$1 AND gang_id=$2',
    [week, h.owned.gangId, decreeId, standing]);
  if (!upd.rowCount) {
    try {
      await client.query('INSERT INTO commission_votes (week, gang_id, decree, standing) VALUES ($1,$2,$3,$4)',
        [week, h.owned.gangId, decreeId, standing]);
      // THE STATESMAN — the FIRST cast of the week earns political capital (only the INSERT branch, so a
      // boss can't farm by re-casting — the earn is once/week/family, seat-gated). Own account, no cross-lock.
      await bumpStatecraft(client, ch.account_id, COMMISSION.STATECRAFT_VOTE);
    } catch { throw new GameError('again', 'The family just spoke — cast again to change the vote.'); }
  }
  bus.emit(`gang:${h.owned.gangId}`, { type: 'commission_vote', decree: decreeId });
  await h.track(client, ch.account_id, 'commission_vote', { decree: decreeId, week, standing });
  return { ok: true, week, decree: decreeId, weight: COMMISSION.SEATS - seatIdx, takesEffectWeek: week + 1 };
}

// step three — PROPOSE a decree for the week being voted, staking a treasury CASH deposit
// (`commission:proposal` — treasury → escrow, character_id NULL + counterparty=gang, the
// family-contract ledger pattern). One proposal per family per week; proposing sets the ballot
// (see tallyWinner). Settlement is the worker's settleProposals once the voting week freezes.
export async function proposeDecree(ch, decreeId, client, h) {
  if (h.owned.gangRole !== 'boss' && h.owned.gangRole !== 'underboss')
    throw new GameError('rank', 'Only the boss or underboss moves a motion for the family.');
  if (!decreeOf(decreeId)) throw new GameError('bad_decree', 'No such motion before the Commission.');
  const seats = await seatedGangs(client);
  if (!seats.some((s) => s.id === h.owned.gangId))
    throw new GameError('no_seat', `The Commission seats the top ${COMMISSION.SEATS} families. Earn the standing.`);
  const week = weekOf();
  const deposit = COMMISSION.PROPOSAL_DEPOSIT;
  // THE STATESMAN — bump the mover's political capital BEFORE the gang FOR UPDATE (keeps the canonical
  // accounts-before-gangs order; a failed propose rolls the whole withCharacter txn back, so no free earn).
  await bumpStatecraft(client, ch.account_id, COMMISSION.STATECRAFT_PROPOSE);
  // lock the family row (the postFamilyContract order: char → account → gang; no other locks follow)
  const g = (await client.query('SELECT id, treasury FROM gangs WHERE id=$1 FOR UPDATE', [h.owned.gangId])).rows[0];
  if (!g) throw new GameError('no_gang', 'The family is gone.');
  if (Number(g.treasury) < deposit)
    throw new GameError('treasury', `A motion takes a ${usd(deposit)} deposit from the treasury.`);
  try {
    await client.query('INSERT INTO commission_proposals (week, gang_id, decree, deposit, proposer_account) VALUES ($1,$2,$3,$4,$5)',
      [week, h.owned.gangId, decreeId, deposit, ch.account_id]);
  } catch { throw new GameError('proposed', 'The family already has a motion on the table this week.'); }
  await client.query('UPDATE gangs SET treasury = treasury - $2 WHERE id=$1', [h.owned.gangId, deposit]);
  await h.ledger(client, { currency: 'cash', amount: -deposit, reason: 'commission:proposal', counterparty: h.owned.gangId });
  bus.emit('streets', { type: 'commission_proposal', family: seats.find((s) => s.id === h.owned.gangId)?.name, decree: decreeId, name: decreeOf(decreeId)?.name });
  await h.track(client, ch.account_id, 'commission_proposal', { decree: decreeId, week, deposit });
  return { ok: true, week, decree: decreeId, deposit, takesEffectWeek: week + 1 };
}

// worker sweep — settle every proposal whose voting week has FROZEN: the proposal matching the
// TALLY-enacted decree refunds to its treasury (`commission:refund`); every other — including a
// deadlocked week's and a dissolved family's (dead-funder precedent) — FORFEITS to the street-tax
// pool (`commission:forfeit`, the confiscation pattern). Per-week txn; lock order gangs (sorted) →
// street_tax singleton (the canonical gangs→singletons order).
export async function settleProposals(pool, opts = {}) {
  const now = opts.week ?? weekOf();
  const dueWeeks = [...new Set((await pool.query(
    "SELECT week FROM commission_proposals WHERE status='open' AND week < $1", [now])).rows.map((r) => Number(r.week)))].sort();
  let refunded = 0, forfeited = 0;
  const enacted = []; // proposer accounts of motions that ENACTED — bonused POST-COMMIT (own-txn) below
  for (const week of dueWeeks) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // SINGLE-SOURCE the outcome through activeDecree(week+1): it computes the tally of `week` AND
      // applies the head veto AND the floor override on the GOVERNED week (week+1). So a vetoed-then-
      // overridden motion correctly ENACTS (refunds), a vetoed-not-overridden week hangs (all forfeit),
      // and a plain tally winner refunds — one code path, no drift vs the veto/override the players saw.
      const winner = await activeDecree(client, week + 1);
      const rows = (await client.query(
        "SELECT p.week, p.gang_id, p.decree, p.deposit, p.proposer_account FROM commission_proposals p WHERE p.status='open' AND p.week=$1", [week])).rows;
      // lock every proposer gang under FOR UPDATE and record which still EXIST — a dissolved winner
      // can't be refunded (the UPDATE would affect 0 rows while commission:refund credits a ghost →
      // treasury §10.4 drift); its deposit forfeits instead (the dead-funder precedent, matching the doc).
      const liveGang = new Set();
      for (const gid of rows.map((r) => r.gang_id).sort())
        if ((await client.query('SELECT 1 FROM gangs WHERE id=$1 FOR UPDATE', [gid])).rows[0]) liveGang.add(gid);
      await client.query('SELECT 1 FROM street_tax WHERE id=1 FOR UPDATE');
      for (const p of rows) {
        const dep = Number(p.deposit);
        const won = liveGang.has(p.gang_id) && winner && p.decree === winner.id;
        if (won) {
          await client.query('UPDATE gangs SET treasury = treasury + $2 WHERE id=$1', [p.gang_id, dep]);
          await ledger(client, { currency: 'cash', amount: dep, reason: 'commission:refund', counterparty: p.gang_id });
          if (p.proposer_account) enacted.push(p.proposer_account); // political capital, paid post-commit
          refunded++;
        } else {
          await client.query('UPDATE street_tax SET pool = pool + $1 WHERE id=1', [dep]);
          await ledger(client, { currency: 'cash', amount: -dep, reason: 'commission:forfeit', counterparty: p.gang_id });
          forfeited++;
        }
        await client.query("UPDATE commission_proposals SET status=$3 WHERE week=$1 AND gang_id=$2",
          [p.week, p.gang_id, won ? 'refunded' : 'forfeited']);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); console.error('[settleProposals]', week, e?.code || e?.message || e); }
    finally { client.release(); }
  }
  // THE STATESMAN — the proposer whose motion ENACTED earns the big political-capital prize. POST-COMMIT,
  // own-txn: an in-txn account bump under the held gangs+street_tax locks would invert accounts-before-gangs
  // (a real deadlock risk). A missed bump on a crash is a lost status point, not a §10.4 event — safe to retry-less.
  for (const acct of enacted) {
    try { await pool.query('UPDATE account_persistent SET statecraft = statecraft + $2 WHERE account_id=$1', [acct, COMMISSION.STATECRAFT_ENACTED]); }
    catch (e) { console.error('[settleProposals enacted]', acct, e?.message || e); }
  }
  return { refunded, forfeited };
}

// THE VETO — the head of the table (seat 1's BOSS, and nobody else) kills the decree in force,
// once per week, on the public record. Pure politics: no money, no lock beyond the row insert.
export async function vetoDecree(ch, client, h) {
  if (h.owned.gangRole !== 'boss') throw new GameError('rank', 'The veto is the boss chair speaking — nobody speaks for it.');
  const seats = await seatedGangs(client);
  if (!seats.length || seats[0].id !== h.owned.gangId)
    throw new GameError('head', 'Only the head of the table kills a decree.');
  const week = weekOf();
  if ((await client.query('SELECT 1 FROM commission_vetoes WHERE week=$1', [week])).rows[0])
    throw new GameError('vetoed', 'The table already heard a veto this week.');
  const decree = await activeDecree(client, week);
  if (!decree) throw new GameError('no_decree', 'There is nothing in force to kill.');
  try {
    await client.query('INSERT INTO commission_vetoes (week, gang_id, decree) VALUES ($1,$2,$3)', [week, h.owned.gangId, decree.id]);
  } catch { throw new GameError('vetoed', 'The table already heard a veto this week.'); } // race loses cleanly on the week PK
  await bumpStatecraft(client, ch.account_id, COMMISSION.STATECRAFT_VETO); // wielding the veto is political capital
  bus.emit('streets', { type: 'commission_veto', family: seats[0].name, decree: decree.id });
  await h.track(client, ch.account_id, 'commission_veto', { decree: decree.id, week });
  return { ok: true, vetoed: decree.id, name: decree.name, week };
}

// THE OVERRIDE (Tier-4) — the parliamentary check on the head veto. A SEATED FLOOR family (any seat
// but the head) moves to override; when the floor's summed seat-weight reaches OVERRIDE_WEIGHT the
// killed decree is RESTORED for the week (activeDecree reads this). Pure politics — no money, no lock
// beyond the row insert. One override per family per week; earns political capital either way.
export async function overrideVeto(ch, client, h) {
  if (h.owned.gangRole !== 'boss' && h.owned.gangRole !== 'underboss')
    throw new GameError('rank', 'Only the boss or underboss moves the family to override.');
  const week = weekOf();
  const seats = await seatedGangs(client);
  const seatIdx = seats.findIndex((s) => s.id === h.owned.gangId);
  if (seatIdx < 0)
    throw new GameError('no_seat', `The Commission seats the top ${COMMISSION.SEATS} families. Earn the standing.`);
  if (seatIdx === 0) throw new GameError('head', 'The head chair cast the veto — it cannot vote to override itself.');
  if (!(await client.query('SELECT 1 FROM commission_vetoes WHERE week=$1', [week])).rows[0])
    throw new GameError('no_veto', 'There is no veto on the record to override.');
  try {
    await client.query('INSERT INTO commission_overrides (week, gang_id) VALUES ($1,$2)', [week, h.owned.gangId]);
  } catch { throw new GameError('again', 'The family has already moved to override this week.'); } // race loses cleanly on the PK
  await bumpStatecraft(client, ch.account_id, COMMISSION.STATECRAFT_OVERRIDE);
  const weight = await overrideWeightOf(client, week);
  const restored = weight >= COMMISSION.OVERRIDE_WEIGHT;
  bus.emit('streets', { type: 'commission_override', family: seats[seatIdx].name, restored });
  await h.track(client, ch.account_id, 'commission_override', { week, weight, restored });
  return { ok: true, week, weight, need: COMMISSION.OVERRIDE_WEIGHT, restored };
}

// THE STATESMEN — the survives-death political-capital board (account-level; the hitman-rep/world-hunter
// leaderboard twin: scan the legend, JOIN a living street for the name, agents excluded, status only).
export async function statesmenLeaderboard(pool) {
  const rows = (await pool.query(
    `SELECT a.statecraft, c.name FROM account_persistent a JOIN characters c ON c.account_id = a.account_id AND c.alive
      WHERE a.statecraft > 0 AND NOT a.agent_flag AND NOT c.is_npc ORDER BY a.statecraft DESC LIMIT 25`)).rows;
  return { statesmen: rows.map((r) => ({ name: r.name, statecraft: Number(r.statecraft), rank: statesmanRankOf(r.statecraft).name })) };
}

// THE RECORD — the chamber's recent history (the last RECORD_WEEKS governed weeks): what decree held
// (or deadlock/vetoed), read-derived per week (no stored column — the read is cheap, Family-tab-cached).
async function chamberRecord(pool) {
  const cur = weekOf();
  const out = [];
  for (let w = cur; w > cur - COMMISSION.RECORD_WEEKS && w > 0; w--) {
    const decree = await activeDecree(pool, w);
    const vetoed = !!(await pool.query('SELECT 1 FROM commission_vetoes WHERE week=$1', [w])).rows[0];
    out.push({ week: w, decree: decree ? decree.id : null, name: decree ? decree.name : (vetoed ? 'Vetoed' : 'Deadlock'), vetoed });
  }
  return out;
}

// the chamber: seats, this week's public votes (stamped standing + provisional rank-derived
// weight), the decree in force, any veto on the record, and the book. The veto row LEFT JOINs
// gangs — a family that vetoed and then dissolved stays on the record (the decree stayed dead).
export async function commissionBoard(pool) {
  const week = weekOf();
  const seats = await seatedGangs(pool);
  const ballots = await rankedBallots(pool, week); // provisional — more casts may still land this week
  const votes = (await pool.query(
    `SELECT v.decree, v.standing, v.gang_id, g.name, g.tag FROM commission_votes v JOIN gangs g ON g.id = v.gang_id WHERE v.week=$1`, [week])).rows;
  const provisional = Object.fromEntries(ballots.map((b) => [b.gang_id, b.weight]));
  const decree = await activeDecree(pool, week);
  const vetoRow = (await pool.query(
    'SELECT x.decree, g.name FROM commission_vetoes x LEFT JOIN gangs g ON g.id = x.gang_id WHERE x.week=$1', [week])).rows[0] || null;
  // step three — the week's motions on the table (public; when any exist, ONLY they are votable)
  const proposals = (await pool.query(
    // `::text` because `commission_proposals.gang_id` is the ONE gang_id in this schema declared UUID —
    // every sibling (commission_votes, commission_vetoes) is TEXT, like `gangs.id` itself. `text = uuid`
    // has no operator, so this whole board 500'd from the day proposals shipped and nobody noticed,
    // because pg-mem compares the two happily. Cast the proposals side: `gangs.id` is the PK doing the
    // lookup, and the proposals row set is already narrowed to one week. (`tools/pgquery.js` found this.)
    `SELECT p.decree, p.deposit, g.name, g.tag FROM commission_proposals p LEFT JOIN gangs g ON g.id = p.gang_id::text
      WHERE p.week=$1 ORDER BY p.at`, [week])).rows
    .map((p) => ({ family: p.name || '(a family now dissolved)', tag: p.tag || null, decree: p.decree, deposit: Number(p.deposit) }));
  // Tier-4 — the OVERRIDE state (only meaningful while a veto sits on the record), the RECORD (chamber
  // history), and the top STATESMEN (the survives-death political legend, public on the board)
  const ovWeight = vetoRow ? await overrideWeightOf(pool, week) : 0;
  const record = await chamberRecord(pool);
  const statesmenTop = (await statesmenLeaderboard(pool)).statesmen.slice(0, 5);
  // the decree lapses when the week does (weeks are 7-day windows off the day epoch)
  const lapsesMs = (week + 1) * 7 * 86400000 - dayOf() * 86400000 - (Date.now() % 86400000);
  return {
    seats: seats.map((s, i) => ({ name: s.name, tag: s.tag, standing: Number(s.standing), weight: COMMISSION.SEATS - i })),
    votes: votes.map((v) => ({ family: v.name, tag: v.tag, decree: v.decree, standing: Number(v.standing),
      weight: provisional[v.gang_id] || 0 })), // public — politics is the content
    decree: decree ? { ...decree, lapsesSeconds: Math.max(0, Math.ceil(lapsesMs / 1000)) } : null,
    veto: vetoRow ? { family: vetoRow.name || '(a family now dissolved)', decree: vetoRow.decree } : null,
    override: vetoRow ? { weight: ovWeight, need: COMMISSION.OVERRIDE_WEIGHT, restored: ovWeight >= COMMISSION.OVERRIDE_WEIGHT } : null,
    proposals, proposalDeposit: COMMISSION.PROPOSAL_DEPOSIT,
    record, statesmenTop, statesmanRanks: COMMISSION.STATESMAN_RANKS,
    book: COMMISSION.DECREES, seatsCount: COMMISSION.SEATS, week,
  };
}

// ── THE TICKER BALLOT — the Commission's daily stock vote (the Stock Machine, Phase A) ────────────
// The seated families vote DAILY on which stock token the treasury's RWA slice buys. Chain-dormant:
// the ballot runs and resolves NOW (the daily beat + the public record); the Phase-B buy keeper
// consumes ticker_ballot_results when it ships. The vote chooses WHICH — never whether/how-much/
// to-whom — so a captured chamber can only pick a stock the town disagrees with, which is the
// Commission working (design §3). Zero §10.4 surface: a vote moves nothing, the result is a record.

// cast (or change) the family's ticker vote — boss/underboss of a SEATED family, the castVote
// discipline verbatim: standing stamped at cast, UPDATE-then-INSERT (pg-mem), changeable all day.
export async function castTickerVote(ch, ticker, client, h) {
  if (h.owned.gangRole !== 'boss' && h.owned.gangRole !== 'underboss')
    throw new GameError('rank', 'Only the boss or underboss speaks for the family.');
  const t = String(ticker || '').toUpperCase();
  const catalog = await approvedStockTokenCatalog(client);
  if (!catalog.tickers.length)
    throw new GameError('no_tickers', 'The approved Stock Token catalog is temporarily empty. No family pick can be recorded.');
  if (!catalog.tickers.includes(t))
    throw new GameError('bad_ticker', `The chamber buys from its approved list: ${catalog.tickers.join(', ')}.`);
  const seats = await seatedGangs(client);
  const seatIdx = seats.findIndex((s) => s.id === h.owned.gangId);
  if (seatIdx < 0)
    throw new GameError('no_seat', `The Commission seats the top ${COMMISSION.SEATS} families. Earn the standing.`);
  const standing = Number(seats[seatIdx].standing);
  const day = dayOf();
  const upd = await client.query('UPDATE commission_ticker_votes SET ticker=$3, standing=$4 WHERE day=$1 AND gang_id=$2',
    [day, h.owned.gangId, t, standing]);
  if (!upd.rowCount) {
    try {
      await client.query('INSERT INTO commission_ticker_votes (day, gang_id, ticker, standing) VALUES ($1,$2,$3,$4)',
        [day, h.owned.gangId, t, standing]);
    } catch { throw new GameError('again', 'The family just spoke — cast again to change the pick.'); }
  }
  bus.emit(`gang:${h.owned.gangId}`, { type: 'ticker_vote', ticker: t });
  await h.track(client, ch.account_id, 'ticker_vote', { ticker: t, day, standing });
  return { ok: true, day, ticker: t, buysOnDay: day + 1 };
}

// the day's tally — the rankedBallots discipline at daily cadence: standing-ranked, electorate
// bounded at the seat count, weights SEATS..1 by rank. Tie → null (the sweep resolves to DEFAULT).
export async function tallyTickerDay(db, day) {
  const rows = (await db.query('SELECT gang_id, ticker, standing FROM commission_ticker_votes WHERE day=$1', [day])).rows;
  const ranked = rows
    .map((r) => ({ gang_id: r.gang_id, ticker: r.ticker, standing: Number(r.standing) }))
    .sort((a, b) => b.standing - a.standing || (a.gang_id < b.gang_id ? -1 : 1))
    .slice(0, COMMISSION.SEATS)
    .map((r, i) => ({ ...r, weight: COMMISSION.SEATS - i }));
  if (!ranked.length) return null;
  const tally = {};
  for (const b of ranked) tally[b.ticker] = (tally[b.ticker] || 0) + b.weight;
  const sorted = Object.entries(tally).map(([ticker, n]) => ({ ticker, n })).sort((a, b) => b.n - a.n);
  if (sorted.length > 1 && sorted[0].n === sorted[1].n) return null; // the chamber deadlocked
  return { ticker: sorted[0].ticker, votes: ranked.length, weighted: sorted[0].n };
}

// the worker sweep: once the day has ROLLED, resolve YESTERDAY's ballot into the permanent record
// the Phase-B keeper consumes — idempotent on the day PK (SELECT-then-INSERT; pg-mem's ON CONFLICT
// is unreliable — the recordReckoning lesson), deadlock/silence recorded as the DEFAULT ticker so
// the record has a row for every day the ballot has run and the keeper never guesses.
export async function sweepTickerBallot(pool) {
  const day = dayOf() - 1;
  if (day < 0) return { resolved: false };
  if ((await pool.query('SELECT 1 FROM ticker_ballot_results WHERE day=$1', [day])).rows[0]) return { resolved: false };
  // only record once the ballot has ever been USED (a day with no votes before the feature shipped
  // should not backfill a wall of DEFAULT rows) — the first vote ever starts the daily record.
  const everVoted = (await pool.query('SELECT 1 FROM commission_ticker_votes LIMIT 1')).rows[0];
  if (!everVoted) return { resolved: false };
  const won = await tallyTickerDay(pool, day);
  const catalog = await approvedStockTokenCatalog(pool);
  if (!catalog.defaultTicker) return { resolved: false, reason: 'no_tickers' };
  // A Stock Token can be emergency-deactivated after votes were cast. Never freeze a result the
  // on-chain buyer must reject: fall back to the currently approved default and say who decided.
  const chamberWon = !!won && catalog.tickers.includes(won.ticker);
  const ticker = chamberWon ? won.ticker : catalog.defaultTicker;
  try {
    await pool.query('INSERT INTO ticker_ballot_results (day, ticker, votes, weighted, decided_by) VALUES ($1,$2,$3,$4,$5)',
      [day, ticker, chamberWon ? won.votes : 0, chamberWon ? won.weighted : 0, chamberWon ? 'chamber' : 'default']);
  } catch { return { resolved: false }; } // a concurrent worker won the PK race — theirs is the record
  bus.emit('streets', { type: 'ticker_ballot', ticker, decidedBy: chamberWon ? 'chamber' : 'default', votes: chamberWon ? won.votes : 0 });
  return { resolved: true, day, ticker, decidedBy: chamberWon ? 'chamber' : 'default' };
}

// the public board half — today's open ballot + the standing record (KEYLESS via /v1/city + the
// chamber's own screen). Family names resolved for display; a dissolved family's ballots are
// deleted with it (the removeMember cleanup), so board and tally always agree.
export async function tickerBallotBoard(db) {
  const day = dayOf();
  const catalog = await approvedStockTokenCatalog(db);
  const votes = (await db.query(
    `SELECT v.ticker, v.standing, g.name, g.tag FROM commission_ticker_votes v
       LEFT JOIN gangs g ON g.id = v.gang_id WHERE v.day=$1`, [day])).rows
    .map((r) => ({ ticker: r.ticker, family: r.name || '(a family now dissolved)', tag: r.tag || null, standing: Number(r.standing) }))
    .sort((a, b) => b.standing - a.standing);
  const live = await tallyTickerDay(db, day);
  const last = (await db.query('SELECT day, ticker, decided_by FROM ticker_ballot_results ORDER BY day DESC LIMIT 1')).rows[0];
  return {
    day, tickers: catalog.tickers, defaultTicker: catalog.defaultTicker,
    candidates: catalog.assets,
    catalog: { source: catalog.source, chainId: catalog.chainId, registryAddress: catalog.registryAddress,
      syncedAt: catalog.syncedAt },
    votes, leading: live ? live.ticker : null,
    lastResult: last ? { day: Number(last.day), ticker: last.ticker, decidedBy: last.decided_by } : null,
    // honest state: the buy keeper is Phase B — the record accrues now, nothing is bought yet
    buying: false,
  };
}

// ── VERSION-SNAPSHOT TICKER BALLOT V2 ──────────────────────────────────────────────────────────
// Task 5 is database-authoritative preparation only. The existing player/public ticker routes stay
// legacy until health and AcquisitionVault authority can cut every consumer over atomically.
const BALLOT_CHAIN_ID_V2 = '4663';
const BALLOT_ZERO_HASH = `0x${'00'.repeat(32)}`;
const BALLOT_ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
// Day 99,999,999 closes exactly at JavaScript Date's positive limit
// (+275760-09-13T00:00:00Z) and remains inside PostgreSQL's timestamp range.
const MAX_DAY_V2 = 99999999n;
const UINT256_LIMIT = 1n << 256n;
const BALLOT_DECISION_V2 = Object.freeze({
  chamber: 1,
  default_silence: 2,
  default_tie: 3,
  skipped_catalog_unavailable: 4,
  skipped_catalog_empty: 5,
  skipped_no_valid_candidate: 6,
});
const BALLOT_TALLY_TYPES_V2 = [
  { type: 'uint256' },
  { type: 'uint256' },
  { type: 'uint256' },
  { type: 'bytes32' },
  { type: 'uint256' },
  { type: 'tuple[]', components: [
    { name: 'familyIdHash', type: 'bytes32' },
    { name: 'assetVersionKey', type: 'bytes32' },
    { name: 'standing', type: 'uint256' },
    { name: 'weight', type: 'uint8' },
  ] },
  { type: 'uint8' },
  { type: 'bytes32' },
];

function ballotFail(code, message) {
  throw new GameError(code, message);
}

function canonicalUnsignedV2(value, field, { positive = false, max = UINT256_LIMIT - 1n } = {}) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${field} must be a canonical unsigned decimal string`);
  }
  const parsed = BigInt(value);
  if ((positive && parsed === 0n) || parsed > max) throw new Error(`${field} is outside its range`);
  return value;
}

function ballotDayV2(value) {
  try { return canonicalUnsignedV2(value, 'day', { max: MAX_DAY_V2 }); }
  catch { ballotFail('bad_ballot_open', 'Ballot day must be a canonical nonnegative decimal string.'); }
}

function ballotBudgetV2(value) {
  try { return canonicalUnsignedV2(value, 'maxEthWei', { positive: true }); }
  catch { ballotFail('bad_ballot_open', 'maxEthWei must be a positive canonical uint256 decimal string.'); }
}

function ballotHashV2(value, field, { nonzero = false } = {}) {
  const raw = String(value ?? '');
  if (!/^0x[0-9a-f]{64}$/.test(raw) || (nonzero && raw === BALLOT_ZERO_HASH)) {
    throw new Error(`${field} must be a canonical${nonzero ? ' nonzero' : ''} bytes32`);
  }
  return raw;
}

function ballotAssetKeyV2(value) {
  try { return ballotHashV2(value, 'assetVersionKey', { nonzero: true }); }
  catch { ballotFail('bad_candidate', 'The ballot requires an exact canonical assetVersionKey.'); }
}

function ballotActorV2(value) {
  const actor = typeof value === 'string' ? value.trim() : '';
  if (!actor || actor !== value || actor.length > 200 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(actor)) {
    ballotFail('bad_ballot_open', 'The server-derived ballot actor is invalid.');
  }
  return actor;
}

function ballotDetailsHashV2(value) {
  try { return ballotHashV2(value, 'detailsHash', { nonzero: true }); }
  catch { ballotFail('bad_ballot_open', 'detailsHash must be a canonical nonzero bytes32.'); }
}

function exactStandingV2(value) {
  const raw = typeof value === 'string' ? value : String(value);
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw)) throw new Error('invalid standing');
  return { text: raw, bigint: BigInt(raw) };
}

function exactEpochSecondsV2(value, field = 'database epoch') {
  const raw = typeof value === 'string' ? value : String(value ?? '');
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(raw)) throw new Error(`invalid ${field}`);
  return raw;
}

function compareEpochSecondsV2(leftValue, rightValue) {
  const left = exactEpochSecondsV2(leftValue, 'left database epoch').split('.');
  const right = exactEpochSecondsV2(rightValue, 'right database epoch').split('.');
  const leftWhole = BigInt(left[0]), rightWhole = BigInt(right[0]);
  if (leftWhole !== rightWhole) return leftWhole < rightWhole ? -1 : 1;
  const places = Math.max(left[1]?.length ?? 0, right[1]?.length ?? 0);
  const leftFraction = BigInt((left[1] ?? '').padEnd(places, '0') || '0');
  const rightFraction = BigInt((right[1] ?? '').padEnd(places, '0') || '0');
  return leftFraction < rightFraction ? -1 : leftFraction > rightFraction ? 1 : 0;
}

const familyBytesCompareV2 = (left, right) => Buffer.compare(
  Buffer.from(String(left)), Buffer.from(String(right)),
);

function rankVoteTuplesV2(votes) {
  if (!Array.isArray(votes)) throw new Error('votes must be an array');
  return votes.map((vote) => {
    const familyId = String(vote?.familyId ?? '');
    if (!familyId) throw new Error('familyId is required');
    const standing = exactStandingV2(vote?.standing);
    const weight = vote?.weight;
    if (!Number.isInteger(weight) || weight < 1 || weight > 5) throw new Error('weight must be 1 through 5');
    return {
      familyId,
      familyIdHash: keccak256(toBytes(familyId)),
      assetVersionKey: ballotHashV2(vote?.assetVersionKey, 'assetVersionKey', { nonzero: true }),
      standing: standing.bigint,
      weight,
    };
  }).sort((left, right) => (left.standing > right.standing ? -1 : left.standing < right.standing ? 1
    : familyBytesCompareV2(left.familyId, right.familyId)));
}

export function canonicalTickerBallotTallyHashV2({
  chainId, day, catalogVersion, catalogSnapshotHash, maxEthWei, votes,
  decidedByCode, resultAssetVersionKey,
}) {
  if (chainId !== BALLOT_CHAIN_ID_V2) throw new Error(`ticker ballot chain must be ${BALLOT_CHAIN_ID_V2}`);
  const canonicalDay = canonicalUnsignedV2(day, 'day', { max: MAX_DAY_V2 });
  const canonicalCatalogVersion = canonicalUnsignedV2(catalogVersion, 'catalogVersion');
  const snapshotHash = ballotHashV2(catalogSnapshotHash, 'catalogSnapshotHash');
  const budget = canonicalUnsignedV2(maxEthWei, 'maxEthWei', { positive: true });
  if (!Number.isInteger(decidedByCode) || decidedByCode < 1 || decidedByCode > 6) {
    throw new Error('invalid decidedByCode');
  }
  const resultKey = resultAssetVersionKey == null
    ? BALLOT_ZERO_HASH
    : ballotHashV2(resultAssetVersionKey, 'resultAssetVersionKey', { nonzero: true });
  const tuples = rankVoteTuplesV2(votes).map((vote) => ({
    familyIdHash: vote.familyIdHash,
    assetVersionKey: vote.assetVersionKey,
    standing: vote.standing,
    weight: vote.weight,
  }));
  return keccak256(encodeAbiParameters(BALLOT_TALLY_TYPES_V2, [
    BigInt(chainId), BigInt(canonicalDay), BigInt(canonicalCatalogVersion), snapshotHash,
    BigInt(budget), tuples, decidedByCode, resultKey,
  ]));
}

function isoBallotTimeV2(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('invalid stored ballot timestamp');
  return date.toISOString();
}

async function ballotClockV2(client, day) {
  const fn = dbCaps.skipLocked ? 'clock_timestamp()' : 'now()';
  const row = (await client.query(
    `SELECT wall_now,
            EXTRACT(EPOCH FROM wall_now)::text AS epoch_seconds,
            TIMESTAMPTZ '1970-01-01T00:00:00Z'
              + (($1::text || ' days')::interval) + interval '1 day' AS closes_at
       FROM (SELECT ${fn} AS wall_now) ballot_clock
       /* ticker_ballot_v2_clock */`,
    [day],
  )).rows[0];
  const wall = new Date(row?.wall_now);
  const close = new Date(row?.closes_at);
  const suppliedDay = row?.current_day == null ? null : String(row.current_day);
  const epoch = row?.epoch_seconds == null ? null : String(row.epoch_seconds);
  const epochMatch = epoch?.match(/^([0-9]+)(?:\.[0-9]+)?$/);
  const currentDay = suppliedDay ?? (epochMatch ? (BigInt(epochMatch[1]) / 86400n).toString() : '');
  if (!Number.isFinite(wall.getTime()) || !Number.isFinite(close.getTime())
      || !/^(?:0|[1-9][0-9]*)$/.test(currentDay) || !epochMatch) {
    throw new Error('database ballot clock returned invalid authority');
  }
  return {
    wall,
    currentDay,
    close,
    epochSeconds: exactEpochSecondsV2(epoch),
    closeEpochSeconds: String(close.getTime() / 1000),
  };
}

async function ballotTransactionV2(db, fn, { isolation } = {}) {
  if (typeof db?.connect !== 'function' || typeof db?.release === 'function') return fn(db);
  const retriable = new Set(['40001', '40P01']);
  for (let attempt = 0; attempt < 3; attempt++) {
    const client = await db.connect();
    try {
      await client.query(isolation ? `BEGIN ISOLATION LEVEL ${isolation}` : 'BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (!retriable.has(error?.code) || attempt === 2) throw error;
    } finally { client.release(); }
  }
  throw new Error('unreachable ballot transaction retry state');
}

function candidateViewV2(row, currentKeys) {
  const key = String(row.asset_version_key).toLowerCase();
  return {
    assetVersionKey: key,
    ticker: String(row.ticker),
    tokenAddress: getAddress(row.token_address),
    tokenDecimals: Number(row.token_decimals),
    registryIndex: String(row.registry_index),
    activatedAt: isoBallotTimeV2(row.activated_at),
    ...(currentKeys ? { valid: currentKeys.has(key) } : {}),
  };
}

function catalogViewV2(row) {
  const available = row.state !== 'skipped_catalog_unavailable';
  return {
    available,
    source: available ? 'robinhood_chain_registry_v2' : 'registry_unavailable',
    finality: available ? 'finalized' : null,
    chainId: String(row.chain_id),
    registryAddress: available ? getAddress(row.registry_address) : null,
    catalogVersion: available ? String(row.catalog_version) : null,
    snapshotHash: available ? String(row.catalog_snapshot_hash).toLowerCase() : null,
  };
}

function resultViewV2(row) {
  if (!row) return null;
  const catalogAvailable = row.status !== 'skipped_catalog_unavailable';
  return {
    day: String(row.day),
    status: row.status,
    assetVersionKey: row.asset_version_key ? String(row.asset_version_key).toLowerCase() : null,
    ticker: row.ticker ?? null,
    tokenAddress: row.token_address ? getAddress(row.token_address) : null,
    tokenDecimals: row.token_decimals == null ? null : Number(row.token_decimals),
    registryIndex: row.registry_index == null ? null : String(row.registry_index),
    catalogAvailable,
    catalogVersion: catalogAvailable ? String(row.catalog_version) : null,
    catalogSnapshotHash: catalogAvailable ? String(row.catalog_snapshot_hash).toLowerCase() : null,
    maxEthWei: String(row.max_eth_wei),
    votes: Number(row.votes),
    weighted: Number(row.weighted),
    decidedBy: row.decided_by,
    decidedByCode: Number(row.decided_by_code),
    skipReason: row.skip_reason ?? null,
    tallyHash: String(row.tally_hash).toLowerCase(),
    closedAt: isoBallotTimeV2(row.closed_at),
    purchaseUntil: isoBallotTimeV2(row.purchase_until),
    publicationStatus: row.publication_status,
    registryTxHash: row.registry_tx_hash ?? null,
    finalizedBlockNumber: row.finalized_block_number == null ? null : String(row.finalized_block_number),
    finalizedBlockHash: row.finalized_block_hash ?? null,
    finalizedAt: isoBallotTimeV2(row.finalized_at),
  };
}

async function ballotDayViewV2(client, row) {
  const candidates = (await client.query(
    `SELECT day,asset_version_key,ticker,token_address,token_decimals,
            registry_index::text AS registry_index,activated_at
       FROM ticker_ballot_candidates_v2 WHERE day=$1
      ORDER BY registry_index ASC,asset_version_key ASC`,
    [row.day],
  )).rows.map((candidate) => candidateViewV2(candidate));
  const result = (await client.query(
    'SELECT * FROM ticker_ballot_results_v2 WHERE day=$1', [row.day],
  )).rows[0];
  return {
    day: String(row.day),
    state: row.state,
    closesAt: isoBallotTimeV2(row.closes_at),
    maxEthWei: String(row.max_eth_wei),
    openedBy: row.opened_by,
    openDetailsHash: String(row.open_details_hash).toLowerCase(),
    openedAt: isoBallotTimeV2(row.opened_at),
    catalog: catalogViewV2(row),
    candidates,
    result: resultViewV2(result),
  };
}

function exactOpenMatchesV2(row, { day, maxEthWei, detailsHash, actorId }) {
  return String(row.day) === day
    && String(row.max_eth_wei) === maxEthWei
    && String(row.open_details_hash).toLowerCase() === detailsHash
    && row.opened_by === actorId;
}

async function insertSkippedResultV2(client, dayRow, status, decisionCode, reason) {
  const tallyHash = canonicalTickerBallotTallyHashV2({
    chainId: BALLOT_CHAIN_ID_V2,
    day: String(dayRow.day),
    catalogVersion: String(dayRow.catalog_version),
    catalogSnapshotHash: String(dayRow.catalog_snapshot_hash).toLowerCase(),
    maxEthWei: String(dayRow.max_eth_wei),
    votes: [],
    decidedByCode: decisionCode,
    resultAssetVersionKey: null,
  });
  await client.query(
    `INSERT INTO ticker_ballot_results_v2
      (day,status,catalog_version,catalog_snapshot_hash,max_eth_wei,votes,weighted,
       decided_by,decided_by_code,skip_reason,tally_hash,closed_at,publication_status)
     VALUES ($1,$2,$3,$4,$5,0,0,'skipped',$6,$7,$8,$9,'not_submitted')`,
    [dayRow.day, status, String(dayRow.catalog_version), dayRow.catalog_snapshot_hash,
      String(dayRow.max_eth_wei), decisionCode, reason, tallyHash, dayRow.closes_at],
  );
}

export async function openTickerBallotV2(db, input = {}) {
  const day = ballotDayV2(input.day);
  const maxEthWei = ballotBudgetV2(input.maxEthWei);
  const detailsHash = ballotDetailsHashV2(input.detailsHash);
  const actorId = ballotActorV2(input.actorId);
  return ballotTransactionV2(db, async (client) => {
    const clock = await ballotClockV2(client, day);
    let existing = (await client.query(
      'SELECT * FROM ticker_ballot_days_v2 WHERE day=$1 FOR UPDATE', [day],
    )).rows[0];
    if (existing) {
      if (!exactOpenMatchesV2(existing, { day, maxEthWei, detailsHash, actorId })) {
        ballotFail('ballot_conflict', 'That day already has different immutable ballot preparation.');
      }
      return ballotDayViewV2(client, existing);
    }
    if (BigInt(day) < BigInt(clock.currentDay)) ballotFail('past_day', 'A past ballot day cannot be opened.');

    const catalog = await finalizedStockCatalogForBallotV2(client, {
      canonicalClose: clock.close,
      observedEpochSeconds: clock.epochSeconds,
    });
    const state = !catalog.available
      ? 'skipped_catalog_unavailable'
      : catalog.activeAssets.length ? 'open' : 'skipped_catalog_empty';
    const inserted = (await client.query(
      `INSERT INTO ticker_ballot_days_v2
        (day,state,chain_id,registry_address,catalog_version,catalog_snapshot_hash,
         max_eth_wei,opened_by,open_details_hash,opened_at,closes_at,closed_at,purchase_until)
       VALUES ($1,$2,4663,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL)
       ON CONFLICT (day) DO NOTHING RETURNING *`,
      [day, state, catalog.registryAddress ?? BALLOT_ZERO_ADDRESS, catalog.catalogVersion,
        catalog.snapshotHash, maxEthWei, actorId, detailsHash, clock.wall, clock.close,
        state === 'open' ? null : clock.close],
    )).rows[0];
    if (!inserted) {
      existing = (await client.query(
        'SELECT * FROM ticker_ballot_days_v2 WHERE day=$1 FOR UPDATE', [day],
      )).rows[0];
      if (!existing || !exactOpenMatchesV2(existing, { day, maxEthWei, detailsHash, actorId })) {
        ballotFail('ballot_conflict', 'That day already has different immutable ballot preparation.');
      }
      return ballotDayViewV2(client, existing);
    }
    if (state === 'open') {
      for (const asset of catalog.activeAssets) {
        await client.query(
          `INSERT INTO ticker_ballot_candidates_v2
            (day,asset_version_key,ticker,token_address,token_decimals,registry_index,activated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [day, asset.assetVersionKey, asset.ticker, asset.tokenAddress,
            asset.tokenDecimals, asset.registryIndex, asset.activatedAt],
        );
      }
    } else {
      const decision = state === 'skipped_catalog_unavailable'
        ? BALLOT_DECISION_V2.skipped_catalog_unavailable
        : BALLOT_DECISION_V2.skipped_catalog_empty;
      await insertSkippedResultV2(
        client, inserted, state, decision,
        state === 'skipped_catalog_unavailable' ? 'catalog_unavailable' : 'catalog_empty',
      );
    }
    return ballotDayViewV2(client, inserted);
  }, { isolation: 'REPEATABLE READ' });
}

function normalizeTickerSelectionV2(value) {
  const ticker = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z0-9._-]{1,24}$/.test(ticker)) ballotFail('bad_candidate', 'Invalid ballot ticker.');
  return ticker;
}

async function currentMemberV2(ch, client) {
  return (await client.query(
    'SELECT gang_id,role FROM gang_members WHERE character_id=$1', [ch.id],
  )).rows[0];
}

export async function castTickerVoteV2(ch, selection, client, h) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)
      || Object.keys(selection).some((key) => !['assetVersionKey', 'ticker'].includes(key))) {
    ballotFail('bad_candidate', 'Choose one exact frozen ballot candidate.');
  }
  const member = await currentMemberV2(ch, client);
  if (!member || !['boss', 'underboss'].includes(member.role)
      || member.gang_id !== h?.owned?.gangId || member.role !== h?.owned?.gangRole) {
    ballotFail('rank', 'Only the current boss or underboss speaks for the family.');
  }
  const clockProbe = await ballotClockV2(client, '0');
  const day = clockProbe.currentDay;
  const dayRow = (await client.query(
    `SELECT *,EXTRACT(EPOCH FROM closes_at)::text AS closes_epoch_seconds
       FROM ticker_ballot_days_v2 WHERE day=$1 FOR UPDATE`, [day],
  )).rows[0];
  if (!dayRow) ballotFail('ballot_unopened', 'No exact-version ballot is open for this UTC day.');
  if (dayRow.state !== 'open'
      || compareEpochSecondsV2(clockProbe.epochSeconds, dayRow.closes_epoch_seconds) >= 0) {
    ballotFail('ballot_closed', 'The exact-version ballot is closed.');
  }
  const seats = await seatedGangs(client);
  const seatIndex = seats.findIndex((seat) => String(seat.id) === String(member.gang_id));
  if (seatIndex < 0) {
    ballotFail('no_seat', `The Commission seats the top ${COMMISSION.SEATS} families. Earn the standing.`);
  }
  let standing;
  try { standing = exactStandingV2(seats[seatIndex].standing).text; }
  catch { throw new Error('database returned a non-integer Commission standing'); }

  const suppliedKey = selection.assetVersionKey == null ? null : ballotAssetKeyV2(selection.assetVersionKey);
  const suppliedTicker = selection.ticker == null ? null : normalizeTickerSelectionV2(selection.ticker);
  if (!suppliedKey && !suppliedTicker) ballotFail('bad_candidate', 'Choose one exact frozen ballot candidate.');
  let candidates;
  if (suppliedTicker) {
    candidates = (await client.query(
      `SELECT day,asset_version_key,ticker,token_address,token_decimals,
              registry_index::text AS registry_index
         FROM ticker_ballot_candidates_v2 WHERE day=$1 AND ticker=$2
        ORDER BY registry_index ASC,asset_version_key ASC`,
      [day, suppliedTicker],
    )).rows;
    if (candidates.length > 1) ballotFail('ambiguous_ticker', 'That ticker identifies more than one frozen candidate.');
  } else candidates = [];
  let candidate;
  if (suppliedKey) candidate = (await client.query(
    `SELECT day,asset_version_key,ticker,token_address,token_decimals,
            registry_index::text AS registry_index
       FROM ticker_ballot_candidates_v2 WHERE day=$1 AND asset_version_key=$2`,
    [day, suppliedKey],
  )).rows[0];
  else candidate = candidates[0];
  if (!candidate) ballotFail('bad_candidate', 'That asset is not in the frozen day-local ballot.');
  if (suppliedTicker && candidate.ticker !== suppliedTicker) {
    ballotFail('candidate_mismatch', 'Ticker and assetVersionKey identify different candidates.');
  }
  if (suppliedTicker && suppliedKey && candidates[0]?.asset_version_key !== suppliedKey) {
    ballotFail('candidate_mismatch', 'Ticker and assetVersionKey identify different candidates.');
  }

  const current = await finalizedStockCatalogForBallotV2(client, {
    canonicalClose: dayRow.closes_at,
    observedEpochSeconds: clockProbe.epochSeconds,
  });
  if (!current.available) ballotFail('catalog_unavailable', 'The finalized catalog is unavailable.');
  const live = current.activeAssets.find((asset) => asset.assetVersionKey === candidate.asset_version_key);
  if (!live) ballotFail('candidate_inactive', 'That frozen candidate is no longer a current active head.');

  const updated = await client.query(
    `UPDATE commission_ticker_votes_v2
        SET asset_version_key=$3,ticker=$4,standing=$5,updated_at=$6
      WHERE day=$1 AND family_id=$2`,
    [day, member.gang_id, candidate.asset_version_key, candidate.ticker, standing, clockProbe.wall],
  );
  if (!updated.rowCount) {
    try {
      await client.query(
        `INSERT INTO commission_ticker_votes_v2
          (day,family_id,asset_version_key,ticker,standing,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6)`,
        [day, member.gang_id, candidate.asset_version_key, candidate.ticker, standing, clockProbe.wall],
      );
    } catch { ballotFail('again', 'The family just spoke; cast again to change its exact-version vote.'); }
  }
  bus.emit(`gang:${member.gang_id}`, {
    type: 'ticker_vote_v2', ticker: candidate.ticker, assetVersionKey: candidate.asset_version_key,
  });
  await h.track(client, ch.account_id, 'ticker_vote', {
    ticker: candidate.ticker,
    assetVersionKey: candidate.asset_version_key,
    day,
    standing,
  });
  return {
    ok: true,
    day,
    assetVersionKey: candidate.asset_version_key,
    ticker: candidate.ticker,
    tokenAddress: getAddress(candidate.token_address),
    tokenDecimals: Number(candidate.token_decimals),
    standing,
    weight: COMMISSION.SEATS - seatIndex,
    buysOnDay: (BigInt(day) + 1n).toString(),
  };
}

const candidateOrderV2 = (left, right) => {
  const li = BigInt(String(left.registry_index)), ri = BigInt(String(right.registry_index));
  return li < ri ? -1 : li > ri ? 1
    : Buffer.compare(Buffer.from(String(left.asset_version_key).slice(2), 'hex'),
      Buffer.from(String(right.asset_version_key).slice(2), 'hex'));
};

function rankedVotesV2(votes, include) {
  return votes.filter(include).sort((left, right) => (
    left.standingBigInt > right.standingBigInt ? -1
      : left.standingBigInt < right.standingBigInt ? 1
        : familyBytesCompareV2(left.familyId, right.familyId)
  )).slice(0, COMMISSION.SEATS).map((vote, index) => ({
    ...vote,
    weight: COMMISSION.SEATS - index,
  }));
}

function resolvedBallotDecisionV2(candidates, counted, candidateByKey) {
  if (!candidates.length) return {
    selected: null, decidedBy: 'skipped',
    decidedByCode: BALLOT_DECISION_V2.skipped_no_valid_candidate, votesCount: 0, weighted: 0,
  };
  if (!counted.length) return {
    selected: candidates[0], decidedBy: 'default_silence',
    decidedByCode: BALLOT_DECISION_V2.default_silence, votesCount: 0, weighted: 0,
  };
  const aggregates = new Map();
  for (const vote of counted) {
    const aggregate = aggregates.get(vote.assetVersionKey) ?? { weighted: 0, votes: 0 };
    aggregate.weighted += vote.weight;
    aggregate.votes += 1;
    aggregates.set(vote.assetVersionKey, aggregate);
  }
  const rankedResults = [...aggregates].map(([key, aggregate]) => ({
    key, candidate: candidateByKey.get(key), ...aggregate,
  })).sort((left, right) => right.weighted - left.weighted || right.votes - left.votes
    || candidateOrderV2(left.candidate, right.candidate));
  const tied = rankedResults.length > 1
    && rankedResults[0].weighted === rankedResults[1].weighted
    && rankedResults[0].votes === rankedResults[1].votes;
  if (tied) return {
    selected: candidates[0], decidedBy: 'default_tie',
    decidedByCode: BALLOT_DECISION_V2.default_tie, votesCount: 0, weighted: 0,
  };
  return {
    selected: rankedResults[0].candidate, decidedBy: 'chamber',
    decidedByCode: BALLOT_DECISION_V2.chamber,
    votesCount: rankedResults[0].votes, weighted: rankedResults[0].weighted,
  };
}

async function ballotTallyClientV2(client, day, suppliedClock) {
  const dayRow = (await client.query(
    `SELECT *,EXTRACT(EPOCH FROM closes_at)::text AS closes_epoch_seconds
       FROM ticker_ballot_days_v2 WHERE day=$1`, [day],
  )).rows[0];
  if (!dayRow) ballotFail('ballot_unopened', 'No exact-version ballot exists for that UTC day.');
  const clock = suppliedClock ?? await ballotClockV2(client, day);
  const atOrAfterCutoff = compareEpochSecondsV2(
    clock.epochSeconds, dayRow.closes_epoch_seconds,
  ) >= 0;
  const candidates = (await client.query(
    `SELECT day,asset_version_key,ticker,token_address,token_decimals,
            registry_index::text AS registry_index,activated_at,
            EXTRACT(EPOCH FROM activated_at)::text AS activated_epoch_seconds
       FROM ticker_ballot_candidates_v2 WHERE day=$1
      ORDER BY registry_index ASC,asset_version_key ASC`,
    [day],
  )).rows;
  const candidateByKey = new Map(candidates.map((candidate) => [String(candidate.asset_version_key), candidate]));
  const current = await finalizedStockCatalogForBallotV2(client, {
    canonicalClose: dayRow.closes_at,
    observedEpochSeconds: clock.epochSeconds,
  });
  const currentKeys = new Set(current.activeAssets.map((asset) => asset.assetVersionKey));
  const eligibility = new Map();
  if (current.available && atOrAfterCutoff) {
    const lifecycleRows = (await client.query(
      `SELECT c.asset_version_key,a.active,
              EXTRACT(EPOCH FROM a.activated_at)::text AS activated_epoch_seconds,
              EXTRACT(EPOCH FROM a.deactivated_at)::text AS deactivated_epoch_seconds
         FROM ticker_ballot_candidates_v2 c
         LEFT JOIN stock_asset_versions_v2 a ON a.asset_version_key=c.asset_version_key
        WHERE c.day=$1 /* ticker_ballot_v2_cutoff_lifecycle */`,
      [day],
    )).rows;
    const lifecycleByKey = new Map(lifecycleRows.map((row) => [String(row.asset_version_key), row]));
    for (const candidate of candidates) {
      const key = String(candidate.asset_version_key);
      const lifecycle = lifecycleByKey.get(key);
      let state = 'unprovable';
      if (lifecycle?.activated_epoch_seconds != null
          && compareEpochSecondsV2(
            lifecycle.activated_epoch_seconds, candidate.activated_epoch_seconds,
          ) === 0) {
        if (lifecycle.active === true) state = currentKeys.has(key) ? 'eligible' : 'unprovable';
        else if (lifecycle.deactivated_epoch_seconds != null) {
          state = compareEpochSecondsV2(
            lifecycle.deactivated_epoch_seconds, dayRow.closes_epoch_seconds,
          ) >= 0 ? 'eligible' : 'inactive';
        }
      }
      eligibility.set(key, state);
    }
  } else {
    for (const candidate of candidates) {
      const key = String(candidate.asset_version_key);
      eligibility.set(key, current.available && currentKeys.has(key) ? 'eligible' : 'inactive');
    }
  }

  const rows = (await client.query(
    `SELECT v.day,v.family_id,v.asset_version_key,v.ticker,v.standing::text AS standing,
            v.created_at,v.updated_at,g.name,g.tag
       FROM commission_ticker_votes_v2 v LEFT JOIN gangs g ON g.id=v.family_id
      WHERE v.day=$1 ORDER BY v.family_id ASC`,
    [day],
  )).rows;
  const votes = rows.map((row) => {
    const key = String(row.asset_version_key);
    const candidateState = eligibility.get(key);
    let exclusionReason = null;
    if (!atOrAfterCutoff && !row.name) exclusionReason = 'family_dissolved';
    else if (!current.available) exclusionReason = 'catalog_unavailable';
    else if (!candidateByKey.has(key)) exclusionReason = 'candidate_missing';
    else if (candidateState === 'unprovable') exclusionReason = 'candidate_history_unprovable';
    else if (candidateState !== 'eligible') {
      exclusionReason = atOrAfterCutoff ? 'candidate_inactive_at_cutoff' : 'candidate_inactive';
    }
    const standing = exactStandingV2(row.standing);
    return {
      familyId: String(row.family_id),
      family: row.name || '(a family now dissolved)',
      tag: row.tag || null,
      assetVersionKey: key,
      ticker: String(row.ticker),
      standing: standing.text,
      standingBigInt: standing.bigint,
      candidateState,
      valid: exclusionReason === null,
      counted: false,
      weight: 0,
      exclusionReason,
      createdAt: isoBallotTimeV2(row.created_at),
      updatedAt: isoBallotTimeV2(row.updated_at),
    };
  });
  const counted = rankedVotesV2(votes, (vote) => vote.valid);
  const countedByFamily = new Map(counted.map((vote) => [vote.familyId, vote]));
  for (const vote of votes) {
    const ranked = countedByFamily.get(vote.familyId);
    if (ranked) {
      vote.counted = true;
      vote.weight = ranked.weight;
    } else if (vote.valid) vote.exclusionReason = 'outside_top_five';
  }
  const eligibleCandidates = candidates.filter(
    (candidate) => eligibility.get(String(candidate.asset_version_key)) === 'eligible',
  ).sort(candidateOrderV2);
  let decision;
  if (!current.available) decision = {
    selected: null, decidedBy: 'skipped',
    decidedByCode: BALLOT_DECISION_V2.skipped_catalog_unavailable, votesCount: 0, weighted: 0,
  };
  else {
    decision = resolvedBallotDecisionV2(eligibleCandidates, counted, candidateByKey);
    if (atOrAfterCutoff) {
      const potentialCandidates = candidates.filter(
        (candidate) => eligibility.get(String(candidate.asset_version_key)) !== 'inactive',
      ).sort(candidateOrderV2);
      const potentialCounted = rankedVotesV2(votes, (vote) => (
        vote.candidateState === 'eligible' || vote.candidateState === 'unprovable'
      ));
      const potential = resolvedBallotDecisionV2(
        potentialCandidates, potentialCounted, candidateByKey,
      );
      const ambiguousAuthority = potentialCounted.some(
        (vote) => vote.candidateState === 'unprovable',
      ) || (potential.selected
        && eligibility.get(String(potential.selected.asset_version_key)) === 'unprovable');
      if (ambiguousAuthority) decision = {
        selected: null, decidedBy: 'skipped',
        decidedByCode: BALLOT_DECISION_V2.skipped_no_valid_candidate,
        votesCount: 0, weighted: 0,
      };
    }
  }
  const resultAssetVersionKey = decision.selected ? String(decision.selected.asset_version_key) : null;
  const tallyHash = canonicalTickerBallotTallyHashV2({
    chainId: BALLOT_CHAIN_ID_V2,
    day: String(dayRow.day),
    catalogVersion: String(dayRow.catalog_version),
    catalogSnapshotHash: String(dayRow.catalog_snapshot_hash).toLowerCase(),
    maxEthWei: String(dayRow.max_eth_wei),
    votes: counted.map((vote) => ({
      familyId: vote.familyId,
      assetVersionKey: vote.assetVersionKey,
      standing: vote.standing,
      weight: vote.weight,
    })),
    decidedByCode: decision.decidedByCode,
    resultAssetVersionKey,
  });
  return {
    day: String(dayRow.day),
    state: dayRow.state,
    catalogAvailable: current.available,
    catalogReason: current.reason,
    candidates: candidates.map((candidate) => ({
      ...candidateViewV2(candidate),
      valid: eligibility.get(String(candidate.asset_version_key)) === 'eligible',
    })),
    votes: votes.map(({ standingBigInt, candidateState, ...vote }) => vote),
    resultAssetVersionKey,
    ticker: decision.selected?.ticker ?? null,
    decidedBy: decision.decidedBy,
    decidedByCode: decision.decidedByCode,
    votesCount: decision.votesCount,
    weighted: decision.weighted,
    tallyHash,
  };
}

export async function tallyTickerBallotV2(db, dayValue) {
  const day = ballotDayV2(dayValue);
  return ballotTransactionV2(db, (client) => ballotTallyClientV2(client, day), {
    isolation: 'REPEATABLE READ',
  });
}

export async function closeTickerBallotV2(db, dayValue) {
  const day = ballotDayV2(dayValue);
  return ballotTransactionV2(db, async (client) => {
    const dayRow = (await client.query(
      `SELECT *,EXTRACT(EPOCH FROM closes_at)::text AS closes_epoch_seconds
         FROM ticker_ballot_days_v2 WHERE day=$1 FOR UPDATE`, [day],
    )).rows[0];
    if (!dayRow) ballotFail('ballot_unopened', 'No exact-version ballot exists for that UTC day.');
    const existing = (await client.query(
      'SELECT * FROM ticker_ballot_results_v2 WHERE day=$1', [day],
    )).rows[0];
    if (existing) return resultViewV2(existing);
    const clock = await ballotClockV2(client, day);
    if (compareEpochSecondsV2(clock.epochSeconds, dayRow.closes_epoch_seconds) < 0) {
      ballotFail('ballot_open', 'The canonical UTC ballot cutoff has not arrived.');
    }
    const tally = await ballotTallyClientV2(client, day, clock);
    for (const vote of tally.votes) {
      await client.query(
        `UPDATE commission_ticker_votes_v2
            SET closed_valid=$3,closed_counted=$4,closed_weight=$5,closed_exclusion_reason=$6
          WHERE day=$1 AND family_id=$2
            AND closed_valid IS NULL AND closed_counted IS NULL AND closed_weight IS NULL`,
        [day, vote.familyId, vote.valid, vote.counted, vote.weight, vote.exclusionReason],
      );
    }
    const ready = tally.resultAssetVersionKey !== null && tally.decidedByCode <= BALLOT_DECISION_V2.default_tie;
    const status = ready ? 'closed_ready'
      : tally.decidedByCode === BALLOT_DECISION_V2.skipped_catalog_unavailable
        ? 'skipped_catalog_unavailable' : 'skipped_no_valid_candidate';
    const selected = ready ? (await client.query(
      `SELECT asset_version_key,ticker,token_address,token_decimals,
              registry_index::text AS registry_index
         FROM ticker_ballot_candidates_v2 WHERE day=$1 AND asset_version_key=$2`,
      [day, tally.resultAssetVersionKey],
    )).rows[0] : null;
    const purchaseUntil = ready ? (await client.query(
      "SELECT $1::timestamptz + interval '7200 seconds' AS purchase_until",
      [dayRow.closes_at],
    )).rows[0].purchase_until : null;
    const inserted = (await client.query(
      `INSERT INTO ticker_ballot_results_v2
        (day,status,asset_version_key,ticker,token_address,token_decimals,registry_index,
         catalog_version,catalog_snapshot_hash,max_eth_wei,votes,weighted,decided_by,
         decided_by_code,skip_reason,tally_hash,closed_at,purchase_until,publication_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'not_submitted')
       ON CONFLICT (day) DO NOTHING RETURNING *`,
      [day, status, selected?.asset_version_key ?? null, selected?.ticker ?? null,
        selected?.token_address ?? null, selected?.token_decimals ?? null,
        selected?.registry_index ?? null, String(dayRow.catalog_version), dayRow.catalog_snapshot_hash,
        String(dayRow.max_eth_wei), ready ? tally.votesCount : 0, ready ? tally.weighted : 0,
        ready ? tally.decidedBy : 'skipped', tally.decidedByCode,
        ready ? null : status.replace(/^skipped_/, ''), tally.tallyHash,
        dayRow.closes_at, purchaseUntil],
    )).rows[0];
    const result = inserted ?? (await client.query(
      'SELECT * FROM ticker_ballot_results_v2 WHERE day=$1', [day],
    )).rows[0];
    await client.query(
      `UPDATE ticker_ballot_days_v2
          SET state=$2,closed_at=closes_at,purchase_until=$3
        WHERE day=$1 AND state='open'`,
      [day, status, purchaseUntil],
    );
    return resultViewV2(result);
  }, { isolation: 'REPEATABLE READ' });
}

async function closedVoteViewsV2(client, day) {
  return (await client.query(
    `SELECT v.family_id,v.asset_version_key,v.ticker,v.standing::text AS standing,
            v.created_at,v.updated_at,v.closed_valid,v.closed_counted,v.closed_weight,
            v.closed_exclusion_reason,g.name,g.tag
       FROM commission_ticker_votes_v2 v LEFT JOIN gangs g ON g.id=v.family_id
      WHERE v.day=$1 ORDER BY v.standing DESC,v.family_id ASC`,
    [day],
  )).rows.map((row) => ({
    familyId: String(row.family_id),
    family: row.name || '(a family now dissolved)',
    tag: row.tag || null,
    assetVersionKey: String(row.asset_version_key),
    ticker: String(row.ticker),
    standing: String(row.standing),
    valid: row.closed_valid === true,
    counted: row.closed_counted === true,
    weight: Number(row.closed_weight ?? 0),
    exclusionReason: row.closed_exclusion_reason ?? null,
    createdAt: isoBallotTimeV2(row.created_at),
    updatedAt: isoBallotTimeV2(row.updated_at),
  }));
}

export async function tickerBallotBoardV2(db) {
  return ballotTransactionV2(db, async (client) => {
    const clock = await ballotClockV2(client, '0');
    const day = clock.currentDay;
    const dayRow = (await client.query(
      'SELECT * FROM ticker_ballot_days_v2 WHERE day=$1', [day],
    )).rows[0];
    const lastRow = (await client.query(
      'SELECT * FROM ticker_ballot_results_v2 ORDER BY day DESC LIMIT 1',
    )).rows[0];
    const lastResult = resultViewV2(lastRow);
    if (lastResult) lastResult.voteEvidence = await closedVoteViewsV2(client, String(lastRow.day));
    if (!dayRow) {
      return {
        day,
        state: 'unopened',
        tickers: [],
        defaultTicker: null,
        candidates: [],
        catalog: null,
        maxEthWei: null,
        closesAt: null,
        votes: [],
        leading: null,
        lastResult,
        result: null,
        buying: false,
      };
    }
    const resultRow = (await client.query(
      'SELECT * FROM ticker_ballot_results_v2 WHERE day=$1', [day],
    )).rows[0];
    const tally = dayRow.state === 'open'
      ? await ballotTallyClientV2(client, day, clock)
      : null;
    const candidates = tally?.candidates ?? (await client.query(
      `SELECT day,asset_version_key,ticker,token_address,token_decimals,
              registry_index::text AS registry_index,activated_at
         FROM ticker_ballot_candidates_v2 WHERE day=$1
        ORDER BY registry_index ASC,asset_version_key ASC`,
      [day],
    )).rows.map((candidate) => candidateViewV2(candidate));
    return {
      day,
      state: dayRow.state,
      tickers: candidates.map((candidate) => candidate.ticker),
      defaultTicker: tally?.candidates.find((candidate) => candidate.valid)?.ticker ?? null,
      candidates,
      catalog: catalogViewV2(dayRow),
      maxEthWei: String(dayRow.max_eth_wei),
      closesAt: isoBallotTimeV2(dayRow.closes_at),
      votes: tally?.votes ?? await closedVoteViewsV2(client, day),
      leading: tally?.ticker ?? resultRow?.ticker ?? null,
      lastResult,
      result: resultViewV2(resultRow),
      buying: false,
    };
  }, { isolation: 'REPEATABLE READ' });
}
