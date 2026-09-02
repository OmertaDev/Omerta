// tools/arena.js — THE ARENA: a POPULATION of EV-optimizing agents against the live economy.
//
// WHY THIS EXISTS. Every economic proof in this repository is about ONE player or about CONSERVATION.
// tools/sim.js sizes each faucet in isolation and proves §10.4; tools/playthrough.js measures what a
// plausible person experiences; tools/scale.js asks whether a market has a counterparty. None of them
// can see the thing a live economy is actually made of: MANY players each doing whatever pays best,
// against each other, at once. The 80-odd audit reports are single-lens by construction — a lens over
// the kill economy cannot see that a lender feeds the whale-hunter's ammo, and a lens over the Shylock
// cannot see that a gambler's default is what pays the lender. An emergent exploit is a CHAIN across
// systems, and a chain is exactly what a per-system audit is structurally blind to.
//
// So this drives a town of scripted STRATEGIES — each a greedy policy over its own sheet and the public
// boards — through a warped month on REAL Postgres, and measures what a person cannot see from any
// single seat: who ends up rich, whether killing actually paid, which sinks each strategy paid and which
// it never touched, and the value chains that ran BETWEEN strategies. §10.4 is asserted as a DELTA
// (seeding creates baseline drift by construction — the scale/loadtest posture) and every claim is a
// COUNT the harness can fail on, because a strategy that never acts reads on a summary line exactly like
// one that acted and lost.
//
// REAL POSTGRES ONLY. pg-mem's ROLLBACK is a no-op, so an accrual row written before a refused action
// survives there and MANUFACTURES §10.4 drift — the run would fail on its own harness. It is also a
// different planner, and a month of accrual is what this measures.
//
// HONEST SCOPE, stated up front: the strategies are GREEDY, not optimal — a hunter picks the highest-
// respect mark it can see rather than the richest (wealth is banded everywhere, which is the game's own
// anti-precise-kill-EV rule working); nobody here plays the long social game (families, contracts on
// each other, the Commission). What this measures is the STRUCTURAL shape of the economy under pressure
// from several simple predators at once — which is enough to see a dominant strategy, a dead one, or a
// chain — not the equilibrium a real population of humans would find.
//
//   DATABASE_URL='postgres://postgres@/arena?host=/tmp&port=5433' npm run arena
//   ARENA_DAYS=30 ARENA_ROUNDS=3 ARENA_DEFENDED=on|off
//
// STEP TWO — THE DEFENDED MONTH (ARENA_DEFENDED=on, the default; `off` reproduces step one). Step one
// measured a town with NO defence: six hunters killed 50 times in 30 days and `death:estate` burned
// ~93% of the town's starting wealth. That is either the design or a balance defect, and the only way
// to tell is to hand every prey the full defensive toolkit the game already ships — a bodyguard
// market, a safehouse cadence, respawn insurance, contracts on the hunters, a family that puts a
// price on its members' killers, and vendettas the hunters can settle — and see whether the same
// six predators still empty the town. Plus ADAPTIVE agents: eight seats that switch between the
// passive/active policies on their own realized P&L (an ε-greedy bandit over daily net-worth
// gain), because a fixed-strategy town cannot tell you what a population would actually CONVERGE to.
process.env.MOD_KEY = process.env.MOD_KEY || 'arena-mod-key';
process.env.MARKET_SEED = process.env.MARKET_SEED || 'arena-harness-seed-000000000000';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.RATE_LIMIT = 'off';          // a real DATABASE_URL ARMS the limiter (ratelimit.js) — this is a stress run, not a throttle test
// A real DATABASE_URL makes preflight treat this as PRODUCTION (isHardened), so JWT_SECRET must be
// stated and the TEST_ONLY pins (SEASON_MOD/SEASON_PHASE) refuse the boot. The season twist is
// instead disarmed through its production kill switch (SEASON_MODS=off → vanilla, read per call), and
// the phase pin is set AFTER boot (the boardcost/STANDING_CACHE_MS pattern — seasonPhaseOf reads it
// per call, so a post-boot set works and never trips preflight). Loot depth and the turf floor are
// therefore date-INDEPENDENT here, which is what makes two runs comparable.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'arena-harness-jwt-secret-not-for-production';
process.env.SEASON_MODS = 'off';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
if (!process.env.DATABASE_URL) {
  console.error('arena: real Postgres only — set DATABASE_URL (pg-mem ROLLBACK is a no-op, which would manufacture §10.4 drift; see the header).');
  process.exit(1);
}
import assert from 'node:assert';
import { buildServer } from '../src/server.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { runPopulation, runResidentBehaviour } from '../src/population.js';
import { sweepExpiredBounties } from '../src/social.js';
import { sweepLoans } from '../src/loans.js';
import { sweepMarket } from '../src/market.js';
import { runBuyback } from '../src/worker.js';
import { GUNS, GOODS, BUSINESSES, RACKETS, CRIMES, DISTRICTS, EXCHANGE, LOAN, CASINO, BROKERS, M3, levelOf } from '../src/rules.js';

const DAYS = Number(process.env.ARENA_DAYS || 30);
const ROUNDS = Number(process.env.ARENA_ROUNDS || 3);
const DEFENDED = process.env.ARENA_DEFENDED !== 'off';
// The cast. Counts are levers; the SHAPE is the point — several predators, several prey, one ring.
// The ADAPTIVE seats exist only in the defended month, so `off` is byte-comparable with step one.
const CAST = { hunter: 6, landlord: 8, arb: 8, ringboss: 1, alt: 8, lender: 6, broker: 6, gambler: 4, turtle: 4, grinder: 6, ...(DEFENDED ? { adaptive: 8 } : {}) };
// PREY = the strategies that hold wealth in a body a hunter can reach. They get the toolkit.
const PREY = new Set(['landlord', 'lender', 'broker', 'adaptive']);
const ADAPTIVE_POLICIES = ['landlord', 'arb', 'grinder', 'lender', 'turtle'];
const EPSILON = 0.2;   // the bandit's explore rate — a lever, not a finding
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const pct = (num, den) => (den ? `${Math.round((num / den) * 100)}%` : '—');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const gini = (xs) => { const s = [...xs].map((x) => Math.max(0, x)).sort((a, b) => a - b); const n = s.length; const sum = s.reduce((a, b) => a + b, 0); if (!n || !sum) return 0; let acc = 0; s.forEach((x, i) => { acc += (2 * (i + 1) - n - 1) * x; }); return acc / (n * sum); };

const app = await buildServer();
const pool = app.pool;
process.env.SEASON_PHASE = process.env.SEASON_PHASE || 'long_game'; // TEST_ONLY — set post-boot on purpose (see the env block)
const call = async (method, url, token, body) => {
  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  let json = null; try { json = res.json(); } catch { /* empty */ }
  return { code: res.statusCode, body: json || {} };
};

// ── bookkeeping ─────────────────────────────────────────────────────────────────────────────────
// Every 4xx is COUNTED by strategy and code — a refusal is the game working, and the distribution of
// refusals is itself a finding (a strategy that mostly hears `cash` is starving; one that mostly hears
// `safe` is being turtled against). `acted` counts SUCCESSFUL actions per strategy: the anti-vacuity
// floor, because a strategy whose every call failed reads on the summary line like one that played.
const refused = {};   // strat -> code -> n
const acted = {};     // strat -> n
const note = (p, r) => {
  if (r.code === 200) acted[p.strat] = (acted[p.strat] || 0) + 1;
  else if (r.body?.error) { const m = (refused[p.strat] ||= {}); m[r.body.error] = (m[r.body.error] || 0) + 1; }
  return r;
};
const ev = { missSample: [], search: 0, fire: 0, kill: 0, miss: 0, absorbed: 0, revived: 0, calledOff: 0, hunterDeaths: 0 };
const chain = { funnelFills: 0, funnelCash: 0, loansPosted: 0, loansTaken: 0, loansRepaid: 0, loansCollected: 0, redeemed: 0, redeemedOmr: 0, safehouses: 0, dice: 0, diceStakes: [] };
// THE DEFENCES — every count here is something a prey did to NOT die, and the assertions at the end
// require each to have happened, because a toolkit nobody used reads exactly like a toolkit that failed.
const def = { guardHires: 0, guardCash: 0, preyShelters: 0, shelterCash: 0, playerContracts: 0, playerContractCash: 0, familyContracts: 0, familyContractCash: 0, tributes: 0,
  vendettaShots: 0, vendettaKills: 0, contractShots: 0, contractKills: 0, boardShots: 0, adaptiveSwitches: 0, insured: 0,
  guardedShots: 0, guardJailed: 0, guardHosp: 0, guardDead: 0, guardLapsed: 0, guardShotRows: [] };
const bandit = {};   // policy -> { n, sum } of DAILY net-worth gain, shared across every adaptive seat
const syn = { gid: null, hits: new Set(), hitNames: new Set() };   // the prey family and the killers it has marked
let roundNow = 0, dayNow = 0;

// ── the cast ────────────────────────────────────────────────────────────────────────────────────
const players = [];
let i = 0;
for (const [strat, n] of Object.entries(CAST)) {
  for (let k = 0; k < n; k++, i++) {
    const { body: { token } } = await call('POST', '/v1/auth/guest');
    const name = `${strat[0].toUpperCase()}${strat.slice(1)} ${k}${i}`;
    await call('POST', '/v1/character', token, { name });
    const me = (await call('GET', '/v1/me', token)).body.character;
    if (!me) continue;
    players.push({ token, id: me.id, acct: null, name, strat, k, loc: me.loc, st: {} });
  }
}
assert(players.length >= i * 0.95, `only ${players.length}/${i} characters were created`);
const by = (s) => players.filter((p) => p.strat === s);
for (const p of players) p.acct = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [p.id])).rows[0].account_id;

// SEEDING is reachability, never outcome, and it is what the §10.4 DELTA absorbs. Established players
// (level ~51, $4M, trained) can reach every market; the ring's ALTS are cheap identities (level ~15,
// $50k) because the whole question about a ring is what cheap identities can funnel. Brokers hold
// $OMR because the severance means nobody else can (the token has no faucet — a broker is a BUYER).
const est = players.filter((p) => p.strat !== 'alt').map((p) => `'${p.id}'`).join(',');
const alts = by('alt').map((p) => `'${p.id}'`).join(',');
await pool.query(`UPDATE characters SET respect=25000, cash=4000000, energy=100, nerve=50, muscle=60, cunning=60, speed=60 WHERE id IN (${est})`);
await pool.query(`UPDATE characters SET respect=2000, cash=50000, energy=100, nerve=50 WHERE id IN (${alts})`);
await pool.query(`UPDATE account_persistent SET made_until = now() + interval '90 days' WHERE account_id IN (SELECT account_id FROM characters WHERE id IN (${est}))`);
await pool.query(`UPDATE account_persistent SET omr = 3000 WHERE account_id IN (${by('broker').map((p) => `'${p.acct}'`).join(',')})`);
await pool.query(`UPDATE characters SET cb = 200 WHERE id IN (${by('hunter').map((p) => `'${p.id}'`).join(',')})`);   // crates for the iron
for (const p of players) await call('POST', '/v1/path', p.token, { path: p.strat === 'hunter' ? 'gun' : p.strat === 'landlord' ? 'ledger' : pick(['gun', 'ledger', 'kitchen']) });
if (DEFENDED) {
  // RESPAWN INSURANCE: half the prey arrive insured (two tokens each — the real-ETH entitlement the
  // fees.js rail credits; an out-of-band entitlement, so seeding it is not a §10.4 event). The other
  // half are the control: same strategy, same wealth, no insurance.
  const insured = players.filter((p) => PREY.has(p.strat) && p.k % 2 === 0);
  for (const p of insured) p.st.insured = true;
  def.insured = insured.length;
  await pool.query(`UPDATE account_persistent SET respawn_tokens = 2 WHERE account_id IN (${insured.map((p) => `'${p.acct}'`).join(',')})`);
  // THE SYNDICATE: the landlords are a FAMILY, so omertà covers them from each other, the treasury can
  // put a price on a member's killer, and the heir of a murdered landlord is sworn against the
  // killer's bloodline. Landlord 0 is the boss; the rest join (a heir rejoins in the policy).
  const boss = by('landlord')[0];
  const g = await call('POST', '/v1/gangs', boss.token, { name: 'The Syndicate', tag: 'SYN' });
  if (g.code === 200) {
    syn.gid = (await call('GET', '/v1/gangs', boss.token)).body?.gangs?.find((x) => x.tag === 'SYN')?.id;
    for (const l of by('landlord').slice(1)) await call('POST', `/v1/gangs/${syn.gid}/join`, l.token);
  }
}
// The ring is ONE family (so alts and boss are omertà-safe from each other — the only family here, so
// every other pair is fair game and the hunters' targeting is unconstrained).
{
  const boss = by('ringboss')[0];
  const g = await call('POST', '/v1/gangs', boss.token, { name: 'The Ring', tag: 'RNG' });
  if (g.code === 200) { const gid = (await call('GET', '/v1/gangs', boss.token)).body?.gangs?.find((x) => x.tag === 'RNG')?.id; for (const a of by('alt')) await call('POST', `/v1/gangs/${gid}/join`, a.token); }
}

const before = await runLedgerInvariants(pool, { alert: false });
const baseline = Object.fromEntries(before.checks.map((c) => [c.name, c.drift]));
const t0 = Date.now();

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────
const me = async (p) => { const r = await call('GET', '/v1/me', p.token); const c = r.body?.character; if (c) { p.loc = c.loc; p.id = c.id; } return c; };
const goTo = async (p, d) => { if (p.loc === d) return true; const r = note(p, await call('POST', `/v1/travel/${d}`, p.token)); if (r.code === 200) p.loc = d; return r.code === 200; };
const bestCrime = (c) => { const lvl = levelOf(Number(c.respect)); const ok = CRIMES.filter((x) => x.lvl <= lvl && x.nerve <= c.nerve); return ok.length ? ok[ok.length - 1] : null; };
const crime = async (p, c) => { const x = bestCrime(c); if (!x) return null; return note(p, await call('POST', `/v1/crimes/${x.id}`, p.token, {})); };
const bank = async (p, amount) => amount >= 1 && note(p, await call('POST', '/v1/bank/deposit', p.token, { amount: Math.floor(amount) }));
const roster = async (p) => ((await call('GET', '/v1/streets', p.token)).body?.streets || []);
// ── the defensive toolkit (every prey runs these around its own policy when DEFENDED) ──────────────
// HIRE A GUARD: the cheapest listed bodyguard on the roster. One lethal shot is absorbed (the guard is
// hospitalized in the principal's place) and the contract is consumed, so this is bought again the
// day after it fires. The grinders are the guards — they list once, at the floor.
const hireGuard = async (p, c) => {
  if (c.guardedBy) return;
  const guards = (await roster(p)).filter((m) => !m.npc && m.id !== p.id && m.guardPrice && !m.jailed && !m.hospitalized).sort((a, b) => a.guardPrice - b.guardPrice);
  const g = guards[0]; if (!g || c.cash < g.guardPrice * 2) return;
  const r = note(p, await call('POST', `/v1/bodyguard/hire/${g.id}`, p.token));
  if (r.code === 200) { def.guardHires++; def.guardCash += Number(r.body?.price || g.guardPrice); }
};
// SHELTER: go to ground AFTER acting in the first round of the day — a safehouse blocks collection,
// banking and offence (the signed "shield, not bunker" rule), so the prey collects, banks, then hides
// for the rest of the day. The cost is 1% of cash+bank from POCKET, so the policy's own banking floor
// is what keeps the door open. This is the cadence a careful player would run; whether it holds
// against six hunters who all act FIRST in the round order is the measurement.
const shelter = async (p, c) => {
  if (roundNow !== 0) return;
  const c2 = await me(p); if (!c2 || c2.safeSeconds > 0) return;
  const r = note(p, await call('POST', '/v1/safehouse', p.token));
  if (r.code === 200) { def.preyShelters++; def.shelterCash += Number(r.body?.cost || 0); }
};
// RETALIATE: the heir of a murdered prey reads its own notifications — `vendetta` names the killer —
// resolves the name on the roster, and puts a price on their head: a personal kill contract from the
// pocket, and (for the Syndicate) a family contract from the treasury posted by the boss/underboss.
// The hunters read the SAME board, so a contract on a hunter is a hunter's own prey pointed at him.
const retaliate = async (p, c) => {
  const notes = (await call('GET', '/v1/notifications', p.token)).body?.notifications || [];
  for (const n of notes) {
    if (n.type !== 'vendetta' || !n.payload?.against) continue;
    if (syn.hitNames.has(n.payload.against)) continue;
    syn.hitNames.add(n.payload.against);
    const k = (await roster(p)).find((m) => m.name === n.payload.against);
    if (!k) continue;
    syn.hits.add(k.id);
  }
  // THE TOWN'S PRICE: every prey puts $100k on every killer it knows of, once per killer. The vendetta notice
  // reaches only the HEIR — who inherits a few thousand dollars, so the victim's own bloodline can never
  // afford the board; the first run measured exactly 0 personal contracts for that reason. The price is
  // paid from the pocket, so a banked prey pulls it out first (the board wants cash on the counter).
  for (const kid of syn.hits) {
    if (kid === p.id || (p.st.posted ||= new Set()).has(kid)) continue;
    if (c.cash < 150000 && (c.bank || 0) >= 200000) {
      const w = note(p, await call('POST', '/v1/bank/withdraw', p.token, { amount: 200000 }));
      if (w.code === 200) c.cash += 200000;
    }
    if (c.cash < 150000) break;
    const r = note(p, await call('POST', `/v1/streets/${kid}/bounty`, p.token, { amount: 100000, kind: 'kill', reason: 'the town remembers', hours: 168 }));
    if (r.code === 200) { def.playerContracts++; def.playerContractCash += 100000; c.cash -= 100000; }
    if (r.code === 200 || r.body?.error !== 'cash') p.st.posted.add(kid);
  }
  // the family's price: whoever holds the chair posts it, once per killer, from the treasury
  const role = c.gang?.role;
  if (c.gang?.tag === 'SYN' && (role === 'boss' || role === 'underboss')) {
    for (const kid of syn.hits) {
      if ((p.st.familyPosted ||= new Set()).has(kid)) continue;
      const r = note(p, await call('POST', `/v1/gangs/contract/${kid}`, p.token, { amount: 200000, kind: 'kill', reason: 'the Syndicate remembers', hours: 168 }));
      if (r.code === 200) { def.familyContracts++; def.familyContractCash += 200000; }
      if (r.code === 200 || ['cash', 'treasury'].includes(r.body?.error) === false) p.st.familyPosted.add(kid);
    }
  }
};
// THE FAMILY: a landlord heir who woke up gangless rejoins; every member tithes 5% of pocket a day so
// the treasury can afford the price it puts on a killer.
const family = async (p, c) => {
  if (!syn.gid) return;
  if (!c.gang) { note(p, await call('POST', `/v1/gangs/${syn.gid}/join`, p.token)); return; }
  if (roundNow === 0 && c.cash > 200000) { const r = note(p, await call('POST', '/v1/gangs/tribute', p.token, { amount: Math.floor(c.cash * 0.05) })); if (r.code === 200) def.tributes++; }
};
// ROUNDS: the first smoke fired 600 rounds and read `effective 1311 vs btk 5050` — a lvl-51 mark with
// trained stats wants ~2,300 effective, so the magazine is sized off the LAST miss's btk (rounds are
// spent whether or not they were needed, the recorded fire term) and starts at 2,500 for a cold mark.
const ROUNDS_COLD = 2500;
const roundsFor = (p) => (p.st.btk ? Math.ceil(p.st.btk * 1.25 / 2.2) : ROUNDS_COLD);
const arm = async (p, c, want) => {   // ammo boxes are a fixed 50 rounds; fire() spends every round you name
  let bought = 0;
  while ((c.ammo || 0) + bought * 50 < want && bought < 80) { const r = note(p, await call('POST', '/v1/armory/ammo', p.token)); if (r.code !== 200) break; bought++; }
};

// ── the strategies ──────────────────────────────────────────────────────────────────────────────
const STRAT = {
  // THE WHALE-HUNTER: the best iron in the catalog, a belt full of rounds, a search on the highest-
  // respect non-family human it can see, and a shot the moment the clock says so.
  async hunter(p, c) {
    if (!p.st.gun) { const r = note(p, await call('POST', '/v1/armory/gun/undertaker/buy', p.token)); if (r.code === 200 || r.body?.error === 'owned') p.st.gun = true; }
    const rounds = roundsFor(p);
    await arm(p, c, rounds + 100);
    if (p.st.mark) {
      // fire is district-pinned (the first smoke: `district` ×6) — go stand where the mark stands
      const where = (await roster(p)).find((m) => m.id === p.st.mark)?.loc;
      if (where && !(await goTo(p, where))) return;
      // WHY a guard did or did not step in: read the mark's contract from the DATABASE before the shot
      // (the hunter cannot see it — which is the point of the market — but the harness can), so the
      // 'absorbed' figure comes with the reason when it is 0: no guard, a lapsed contract, or a guard
      // who was in lockup / the infirmary / the ground at the moment it mattered.
      // Read BEFORE the shot (the estate clears `guarded_by` on a kill), tally AFTER it — and only for a
      // shot that LANDED (code 200). A refused attempt (`cooldown`, `search` not ready) keeps the mark
      // and comes back next round, so tallying at the read counted the same mark several times over: the
      // third defended month reported 26 classified 'shots' against 17 fired, i.e. a diagnostic that
      // could not have explained anything. Per-shot rows are kept so the report can name each one.
      const v = (await pool.query('SELECT g.alive, g.jail_until, g.hosp_until, g.name AS gname, c.guarded_until FROM characters c LEFT JOIN characters g ON g.id=c.guarded_by WHERE c.id=$1', [p.st.mark])).rows[0];
      const r = note(p, await call('POST', `/v1/streets/${p.st.mark}/fire`, p.token, { rounds }));
      if (r.code === 200) {
        ev.fire++;
        if (v && v.guarded_until) {
          const now = new Date();
          let state = 'available';
          if (new Date(v.guarded_until) <= now) { def.guardLapsed++; state = 'lapsed'; }
          else { def.guardedShots++; if (v.alive === false) { def.guardDead++; state = 'dead'; } else if (v.jail_until && new Date(v.jail_until) > now) { def.guardJailed++; state = 'jailed'; } else if (v.hosp_until && new Date(v.hosp_until) > now) { def.guardHosp++; state = 'hospital'; } }
          const outcome = r.body.kill ? 'kill' : r.body.absorbed ? 'absorbed' : r.body.revived ? 'revived' : r.body.calledOff ? 'calledOff' : 'miss';
          def.guardShotRows.push({ day: dayNow, mark: p.st.mark, guard: v.gname, state, outcome });
        }
        if (p.st.markSrc === 'vendetta') { def.vendettaShots++; if (r.body.kill && r.body.vendetta) def.vendettaKills++; }
        else if (p.st.markSrc === 'contract') { def.contractShots++; if (r.body.kill) def.contractKills++; }
        else def.boardShots++;
        if (r.body.kill) ev.kill++; else if (r.body.absorbed) ev.absorbed++; else if (r.body.revived) ev.revived++; else if (r.body.calledOff) ev.calledOff++;
        else { ev.miss++; if (r.body.btk) p.st.btk = Number(r.body.btk); if (ev.missSample.length < 4) ev.missSample.push({ eff: r.body.effective, btk: r.body.btk, keys: Object.keys(r.body).join(',') }); }
        p.st.mark = null;
      }
      else if (['no_search', 'no_target', 'gone', 'safe', 'witpro', 'family'].includes(r.body?.error)) p.st.mark = null;
      // `cooldown`/`search` (not ready yet) keep the mark — the day warp brings the clock forward.
      return;
    }
    const board = (await roster(p)).filter((m) => !m.npc && m.id !== p.id && !m.jailed && !m.hospitalized);
    const alive = new Set(board.map((m) => m.id));
    // TARGETING, in the order a hunter with a memory would use: (1) a VENDETTA target — a bloodline
    // that killed this hunter's last street pays double feared-rep to settle; (2) the biggest OPEN
    // CONTRACT on the board that is not on him (a contract is the one thing that makes a kill +EV
    // against a mid mark — the econ pass's own finding); (3) the respect board, spread across the
    // top so six hunters do not all find the same corpse. Step one filtered `!m.tag` — a field the
    // roster never sends (it is `gangTag`) — so the family gate was never applied; it is now, on the
    // hunter's OWN family only, which is what omertà actually refuses.
    let mark = null, src = 'board';
    const v = (c.vendettas || []).find((x) => x.targetId && alive.has(x.targetId));
    if (v) { mark = board.find((m) => m.id === v.targetId); src = 'vendetta'; }
    if (!mark) {
      const pots = ((await call('GET', '/v1/contracts', p.token)).body?.contracts || []).filter((x) => x.kind === 'kill' && x.target?.id !== p.id && alive.has(x.target?.id) && !x.directedTo).sort((a, b) => b.pot - a.pot);
      if (pots[0]) { mark = board.find((m) => m.id === pots[0].target.id); src = 'contract'; }
    }
    if (!mark) {
      const marks = board.filter((m) => !(c.gang?.tag && m.gangTag === c.gang.tag));
      mark = marks[p.k % Math.min(marks.length, CAST.hunter)];
    }
    if (!mark) return;
    const r = note(p, await call('POST', `/v1/streets/${mark.id}/search`, p.token));
    if (r.code === 200) { ev.search++; p.st.mark = mark.id; p.st.markSrc = src; }
  },
  // THE PASSIVE LANDLORD: every front the level allows, cheapest first; collect; pay the pad; buy
  // rackets with the surplus; bank the rest. Never fights, never hides.
  async landlord(p, c) {
    const lvl = levelOf(Number(c.respect));
    const owned = new Set(((await call('GET', '/v1/business', p.token)).body?.businesses || []).map((b) => b.kind));
    const want = BUSINESSES.filter((b) => b.lvl <= lvl && !owned.has(b.kind) && b.tiers[0].cost * 1.2 < c.cash)[0];
    if (want) note(p, await call('POST', `/v1/business/${want.kind}/buy`, p.token));
    note(p, await call('POST', '/v1/business/collect', p.token));
    note(p, await call('POST', '/v1/business/upkeep', p.token));
    const rk = RACKETS.filter((r) => r.lvl <= lvl && r.cost * 3 < c.cash);
    if (rk.length && Math.random() < 0.5) note(p, await call('POST', `/v1/rackets/${pick(rk).id}/buy`, p.token));
    const c2 = await me(p); if (c2 && c2.cash > 600000) await bank(p, c2.cash - 500000);
  },
  // THE ARBITRAGEUR: read the price board, buy the widest spread where it is cheapest, haul it to
  // where it is richest. The one strategy that is pure information + movement.
  async arb(p, c) {
    const prices = (await call('GET', '/v1/market/prices')).body?.goods || {};
    if (p.st.hold) {
      const { good, to, qty } = p.st.hold;
      if (await goTo(p, to)) { const r = note(p, await call('POST', '/v1/goods/sell', p.token, { goodId: good, qty })); if (r.code === 200 || r.body?.error === 'qty' || r.body?.error === 'none') p.st.hold = null; }
      return;
    }
    let best = null;
    for (const g of GOODS) for (const a of DISTRICTS) for (const b of DISTRICTS) {
      if (a.id === b.id) continue; const buy = prices[a.id]?.[g.id], sell = prices[b.id]?.[g.id];
      if (buy && sell && (!best || sell / buy > best.ratio)) best = { good: g.id, from: a.id, to: b.id, buy, ratio: sell / buy };
    }
    if (!best || best.ratio < 1.08) return;   // the 2% take each way eats anything under ~4%; be greedy but not blind
    if (!(await goTo(p, best.from))) return;
    const cap = Number(c.cargoCap || 10) - Object.values(c.cargo || {}).reduce((a, q) => a + Number(q || 0), 0);
    const qty = Math.max(0, Math.min(cap, Math.floor((c.cash * 0.4) / best.buy)));
    if (qty < 1) return;
    const r = note(p, await call('POST', '/v1/goods/buy', p.token, { goodId: best.good, qty }));
    if (r.code === 200) p.st.hold = { good: best.good, to: best.to, qty };
  },
  // THE RING: eight cheap alts grind crimes; every so often one posts a BUY ORDER for gin at its dock
  // priced at (nearly) its whole pocket, and the boss — who bought gin at market — fills it. That is
  // the textbook funnel: an ordinary market fill that moves an alt's whole take to one account for
  // the 1%+2% the house keeps. The harness measures what it MOVES, and what the alts could earn.
  async alt(p, c) {
    await crime(p, c);
    if (c.cash < 60000 && Math.random() < 0.5) {
      const offers = ((await call('GET', '/v1/loans', p.token)).body?.offers || []).filter((o) => !o.mine).sort((a, b) => a.owed - b.owed);
      if (offers[0]) { const r = note(p, await call('POST', `/v1/loans/${offers[0].id}/take`, p.token, {})); if (r.code === 200) chain.loansTaken++; }
    }
    if (c.cash > 30000 && Math.random() < 0.4) {
      const price = Math.floor((c.cash * 0.85) / 10);
      const r = note(p, await call('POST', '/v1/market/order', p.token, { goodId: 'gin', qty: 10, price }));
      if (r.code === 200) ring.orders.push({ id: r.body?.id, district: p.loc, alt: p });
    }
  },
  async ringboss(p, c) {
    const o = ring.orders.shift();
    if (!o) { await crime(p, c); return; }
    if (Number((c.cargo || {}).gin || 0) < 10) {   // `/v1/me` ships cargo as a {goodId: qty} map, not a list
      const r = note(p, await call('POST', '/v1/goods/buy', p.token, { goodId: 'gin', qty: 10 }));
      if (r.code !== 200) { ring.orders.unshift(o); return; }
    }
    if (!(await goTo(p, o.district))) { ring.orders.unshift(o); return; }
    const r = note(p, await call('POST', `/v1/market/${o.id}/fill`, p.token, { qty: 10 }));
    if (r.code === 200) { chain.funnelFills++; chain.funnelCash += Number(r.body?.paid || r.body?.earned || 0); }
  },
  // THE LENDER: one usurious offer standing at all times; collect the moment a debt is overdue.
  async lender(p, c) {
    const b = (await call('GET', '/v1/loans', p.token)).body || {};
    for (const l of (b.active || []).filter((l) => l.role === 'lender' && l.overdue)) { const r = note(p, await call('POST', `/v1/loans/${l.id}/collect`, p.token)); if (r.code === 200) chain.loansCollected++; }
    if (!(b.offers || []).some((o) => o.mine) && c.cash > 300000) {
      const r = note(p, await call('POST', '/v1/loans', p.token, { amount: 200000, rate: LOAN.RATE_MAX, hours: 24 }));
      if (r.code === 200) chain.loansPosted++;
    }
    if (c.cash > 2000000) await bank(p, c.cash - 1500000);
  },
  // THE BROKER: the only strategy holding the token. Stake most of it, lock it for the ladder, buy a
  // broker window, and redeem the daily cap at the Window — the one $OMR→cash rail that exists.
  async broker(p, c) {
    if (!p.st.staked && c.omr >= 1500) { const r = note(p, await call('POST', '/v1/stake', p.token, { amount: 1200 })); if (r.code === 200) p.st.staked = true; }
    if (p.st.staked && !p.st.locked) { const r = note(p, await call('POST', '/v1/stake/lock', p.token, { tier: 'month' })); if (r.code === 200) p.st.locked = true; }
    if (!p.st.broker) { const r = note(p, await call('POST', '/v1/brokers/activate', p.token, { tier: 1 })); if (r.code === 200 || r.body?.error === 'active') p.st.broker = true; }
    if (c.omr >= 50) { const r = note(p, await call('POST', '/v1/window/redeem', p.token, { amount: 50 })); if (r.code === 200) { chain.redeemed++; chain.redeemedOmr += 50; } }
    await crime(p, c);
    if (c.cash > 600000) await bank(p, c.cash - 500000);
  },
  // THE GAMBLER: dice at the Neon Mile with a tenth of the pocket; when broke, borrow and never repay.
  async gambler(p, c) {
    if (c.cash < 500000) {
      const offers = ((await call('GET', '/v1/loans', p.token)).body?.offers || []).filter((o) => !o.mine).sort((a, b) => a.owed - b.owed);
      if (offers[0]) { const r = note(p, await call('POST', `/v1/loans/${offers[0].id}/take`, p.token, {})); if (r.code === 200) chain.loansTaken++; }
      await crime(p, c); return;
    }
    if (!(await goTo(p, CASINO.DISTRICT))) return;
    const amount = Math.max(CASINO.MIN_BET, Math.min(CASINO.MAX_BET, Math.floor(c.cash * 0.1)));
    const r = note(p, await call('POST', '/v1/casino/dice', p.token, { amount })); if (r.code === 200) { chain.dice++; chain.diceStakes.push(amount); }
  },
  // THE TURTLE: bank everything, go to ground every day, pull one job. The strategy that tests whether
  // the shields are a bunker.
  async turtle(p, c) {
    note(p, await call('POST', '/v1/checkin', p.token));
    // shelter BEFORE banking: the wealth-scaled cost (1% of cash+bank) is charged from POCKET cash, so a
    // turtle that banks first arrives at the safehouse door broke (the first smoke: `cash` ×23, 0 stays).
    const r = note(p, await call('POST', '/v1/safehouse', p.token)); if (r.code === 200) chain.safehouses++;
    const c2 = await me(p); if (c2 && c2.cash > 120000) await bank(p, c2.cash - 100000);
    await crime(p, c);
  },
  // THE GRINDER: the control. Crimes, the Doc, the daily check-in, bank the surplus, repay what it owes.
  async grinder(p, c) {
    note(p, await call('POST', '/v1/checkin', p.token));
    if (c.health < 40) note(p, await call('POST', '/v1/heal', p.token));
    await crime(p, c); await crime(p, c);
    const b = (await call('GET', '/v1/loans', p.token)).body || {};
    for (const l of (b.active || []).filter((l) => l.role === 'borrower')) if (c.cash > l.owed) { const r = note(p, await call('POST', `/v1/loans/${l.id}/repay`, p.token)); if (r.code === 200) chain.loansRepaid++; }
    if (c.cash < 20000) { const offers = (b.offers || []).filter((o) => !o.mine); if (offers[0]) { const r = note(p, await call('POST', `/v1/loans/${offers[0].id}/take`, p.token, {})); if (r.code === 200) chain.loansTaken++; } }
    if (c.cash > 300000) await bank(p, c.cash - 200000);
  },
  // THE ADAPTIVE SEAT: an ε-greedy bandit over the five non-predator policies, rewarded on its OWN
  // realized daily net-worth gain (cash + bank + in-transit off the sheet — $OMR is not in play for
  // these seats). Eight seats share one reward table, so a policy that pays one of them pulls the
  // others toward it: the closest thing this harness has to "what a population converges to".
  async adaptive(p, c) {
    p.st.policy ||= ADAPTIVE_POLICIES[p.k % ADAPTIVE_POLICIES.length];
    const worth = Number(c.cash || 0) + Number(c.bank || 0) + Number(c.bank_intransit || 0);
    if (roundNow === 0) {
      if (p.st.lastWorth != null) { const b = (bandit[p.st.policy] ||= { n: 0, sum: 0 }); b.n++; b.sum += worth - p.st.lastWorth; }
      p.st.lastWorth = worth;
      const tried = ADAPTIVE_POLICIES.filter((x) => bandit[x]?.n);
      let next = p.st.policy;
      if (Math.random() < EPSILON || tried.length < ADAPTIVE_POLICIES.length) next = pick(ADAPTIVE_POLICIES.filter((x) => !bandit[x]?.n).concat(tried.length === ADAPTIVE_POLICIES.length ? ADAPTIVE_POLICIES : []));
      else next = tried.sort((a, b) => bandit[b].sum / bandit[b].n - bandit[a].sum / bandit[a].n)[0];
      if (next !== p.st.policy) { def.adaptiveSwitches++; p.st.policy = next; p.st.hold = null; }
    }
    await STRAT[p.st.policy](p, c);
  },
};
const ring = { orders: [] };

// ── the month ───────────────────────────────────────────────────────────────────────────────────
// A DAY = ROUNDS rounds of every agent acting once, then the worker's sweeps (contracts expire, loans
// default, listings lapse), the residents act, and the clock warps a day: every timestamptz on the
// tables that carry a player's clocks moves back 24h, which is the same trick tools/sim.js uses on one
// character, applied to the town. Regen is refilled because a real day regenerates it.
const WARP_TABLES = ['characters', 'account_persistent', 'searches', 'loans', 'businesses', 'bounties', 'market_listings', 'brokers_activations', 'racers', 'fighters'];
const warpCols = {};
for (const t of WARP_TABLES) {
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND data_type='timestamp with time zone'`, [t]);
  if (r.rows.length) warpCols[t] = r.rows.map((x) => x.column_name);
}
const warpDay = async () => {
  for (const [t, cols] of Object.entries(warpCols)) {
    await pool.query(`UPDATE ${t} SET ${cols.map((c) => `${c} = ${c} - interval '1 day'`).join(', ')}`);
  }
  await pool.query('UPDATE characters SET energy=100, nerve=50 WHERE NOT is_npc');
};

const deathsAt = async () => Number((await pool.query('SELECT COALESCE(SUM(deaths),0) n FROM account_persistent')).rows[0].n);
const deaths0 = await deathsAt();
for (let day = 1; day <= DAYS; day++) {
  for (let r = 0; r < ROUNDS; r++) {
    roundNow = r; dayNow = day;
    // ROUND ORDER: a deterministic shuffle per (day, round), so no strategy systematically acts first.
    // The first defended run had the hunters at the head of `players` every round — and warpDay pulls
    // every characters timestamp back a day, so a 24h guard contract and a 4h shelter both LAPSE at the
    // day boundary; the hunters then fired before any prey re-bought either. 491 guards hired, 0 absorbed,
    // was that ordering, not the game. A seeded LCG keeps the run reproducible.
    let seed = (day * 7919 + r * 104729 + 12345) >>> 0;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const order = [...players];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    for (const p of order) {
      const c = await me(p); if (!c) continue;
      try {
        const prey = DEFENDED && PREY.has(p.strat);
        if (prey) { await retaliate(p, c); if (p.strat === 'landlord') await family(p, c); await hireGuard(p, c); }
        if (DEFENDED && (p.strat === 'grinder' || p.strat === 'turtle') && !p.st.offered) { const g = note(p, await call('POST', '/v1/bodyguard/offer', p.token, { price: M3.BODYGUARD_MIN_PRICE })); if (g.code === 200) p.st.offered = true; }
        await STRAT[p.strat](p, c);
        if (prey && !(p.strat === 'adaptive' && p.st.policy === 'turtle')) await shelter(p, c);
      } catch (e) { (refused[p.strat] ||= {})[`THREW:${e.message}`] = 1 + ((refused[p.strat] || {})[`THREW:${e.message}`] || 0); }
    }
  }
  await sweepExpiredBounties(pool); await sweepLoans(pool); await sweepMarket(pool);
  await runBuyback(pool, { force: true }); await runBuyback(pool, { force: true });   // two 12h carves a day → the Window's till (else every redemption reads `dry`)
  await runPopulation(pool); await runResidentBehaviour(pool);
  await warpDay();
  if (day % 5 === 0) process.stdout.write(`  day ${day}/${DAYS} · kills ${ev.kill} · funnel ${money(chain.funnelCash)} · ${Math.round((Date.now() - t0) / 1000)}s\n`);
}

// ── the measurement ─────────────────────────────────────────────────────────────────────────────
const after = await runLedgerInvariants(pool, { alert: false });
const RATE = EXCHANGE.RATE;   // the one $OMR→cash rail prices the token for net worth; nothing else can
const sheet = async (p) => {
  const a = (await pool.query('SELECT omr, staked, unbonding, deaths FROM account_persistent WHERE account_id=$1', [p.acct])).rows[0];
  const c = (await pool.query('SELECT cash, bank, bank_intransit, respect, alive FROM characters WHERE account_id=$1 AND alive', [p.acct])).rows[0] || {};
  const cash = Number(c.cash || 0) + Number(c.bank || 0) + Number(c.bank_intransit || 0);
  const omr = Number(a.omr) + Number(a.staked) + Number(a.unbonding);
  return { cash, omr, worth: cash + omr * RATE, deaths: Number(a.deaths), level: levelOf(Number(c.respect || 0)) };
};
const sheets = await Promise.all(players.map(async (p) => ({ p, ...(await sheet(p)) })));
const start = (p) => (p.strat === 'alt' ? 50000 : p.strat === 'broker' ? 4000000 + 3000 * RATE : 4000000);
// per-strategy ledger: what each strategy PAID (sinks) and what it was PAID (faucets/transfers)
const flows = {};   // strat -> reason -> net cash
for (const p of players) {
  // cash rows are character-keyed; $OMR rows account-keyed. Both, or a $OMR sink (window:burn) reads as
  // "routed around" when it was paid — the first smoke's false positive on the broker.
  const rows = (await pool.query(`SELECT reason, currency, SUM(amount) s FROM transactions WHERE (currency='cash' AND character_id IN (SELECT id FROM characters WHERE account_id=$1)) OR (currency='omr' AND account_id=$1) GROUP BY reason, currency`, [p.acct])).rows;
  const f = (flows[p.strat] ||= {});
  for (const r of rows) { const k = r.currency === 'omr' ? `${r.reason} [$OMR]` : r.reason; f[k] = (f[k] || 0) + Number(r.s); }
}
const hunterAccts = by('hunter').map((p) => p.acct);
const kills = Number((await pool.query(`SELECT COUNT(*) n FROM kill_log WHERE killer_account IN (${hunterAccts.map((_, k) => `$${k + 1}`).join(',')})`, hunterAccts)).rows[0].n);
const hf = flows.hunter || {};
const lootCash = hf['whack:loot'] || 0;
const lootOmr = Number((await pool.query(`SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE currency='omr' AND reason='whack:loot' AND amount>0 AND account_id IN (${hunterAccts.map((_, k) => `$${k + 1}`).join(',')})`, hunterAccts)).rows[0].s);
const bountyIn = Object.entries(hf).filter(([r]) => r.startsWith('bounty:')).reduce((a, [, v]) => a + Math.max(0, v), 0);
const ammoOut = -(hf['ammo:buy'] || 0);
const gunOut = -(Object.entries(hf).filter(([r]) => r.startsWith('gun:') || r === 'armory:gun').reduce((a, [, v]) => a + v, 0));
const deaths = await deathsAt() - deaths0;

console.log(`\n════ THE ARENA — ${DEFENDED ? 'THE DEFENDED MONTH' : 'THE UNDEFENDED MONTH'} — ${players.length} agents · ${DAYS} warped days × ${ROUNDS} rounds · real Postgres · ${Math.round((Date.now() - t0) / 1000)}s ════\n`);
console.log('  WHO WON — net worth ($ + $OMR at the Window rate), by strategy:');
console.log(`  ${'strategy'.padEnd(10)}${'n'.padStart(3)}${'start'.padStart(13)}${'median'.padStart(13)}${'mean'.padStart(13)}${'max'.padStart(13)}${'Δ median'.padStart(11)}${'deaths'.padStart(8)}  top refusal`);
const rows = [];
for (const s of Object.keys(CAST)) {
  const xs = sheets.filter((x) => x.p.strat === s);
  const w = xs.map((x) => x.worth); const st = start(xs[0].p);
  const dead = xs.reduce((a, x) => a + x.deaths, 0);
  const ref = Object.entries(refused[s] || {}).sort((a, b) => b[1] - a[1])[0];
  rows.push({ s, med: median(w), mean: w.reduce((a, b) => a + b, 0) / w.length, max: Math.max(...w), st, dead, n: xs.length });
  console.log(`  ${s.padEnd(10)}${String(xs.length).padStart(3)}${money(st).padStart(13)}${money(median(w)).padStart(13)}${money(w.reduce((a, b) => a + b, 0) / w.length).padStart(13)}${money(Math.max(...w)).padStart(13)}${pct(median(w) - st, st).padStart(11)}${String(dead).padStart(8)}  ${ref ? `${ref[0]}×${ref[1]}` : '—'}`);
}
const allW = sheets.map((x) => x.worth).sort((a, b) => b - a);
const total = allW.reduce((a, b) => a + b, 0);
const top10 = allW.slice(0, Math.max(1, Math.floor(allW.length / 10))).reduce((a, b) => a + b, 0);
const winner = [...rows].sort((a, b) => b.med - a.med)[0];
console.log(`\n  CONCENTRATION: Gini ${gini(allW).toFixed(3)} · top 10% hold ${pct(top10, total)} of ${money(total)} · the median ${winner.s} is the richest seat`);

console.log('\n  DID KILLING PAY — the whale-hunters, realized:');
if (ev.missSample.length) console.log(`    miss readings (effective vs btk): ${ev.missSample.map((m) => `${m.eff}/${m.btk}`).join(' ')} [keys: ${ev.missSample[0].keys}]`);
console.log(`    searches ${ev.search} · shots ${ev.fire} · kills ${kills} · misses ${ev.miss} · absorbed ${ev.absorbed} · revived ${ev.revived} · hunters died ${sheets.filter((x) => x.p.strat === 'hunter').reduce((a, x) => a + x.deaths, 0)}`);
console.log(`    loot ${money(lootCash)} cash + ${lootOmr.toFixed(2)} $OMR (${money(lootOmr * RATE)}) · contracts ${money(bountyIn)} · iron ${money(gunOut)} · ammo ${money(ammoOut)}`);
const evPerKill = kills ? (lootCash + lootOmr * RATE + bountyIn - ammoOut - gunOut) / kills : null;
console.log(`    realized EV per kill ${evPerKill == null ? 'n/a (no kill landed)' : money(evPerKill)} · per SHOT ${ev.fire ? money((lootCash + lootOmr * RATE + bountyIn - ammoOut - gunOut) / ev.fire) : 'n/a'}`);

console.log('\n  THE CHAINS BETWEEN STRATEGIES:');
console.log(`    the ring: ${chain.funnelFills} fills moved ${money(chain.funnelCash)} alt→boss through the market (house keeps ~3%)`);
console.log(`    the shylock: ${chain.loansPosted} offers · ${chain.loansTaken} taken · ${chain.loansRepaid} repaid · ${chain.loansCollected} collected by force`);
console.log(`    the window: ${chain.redeemed} redemptions · ${chain.redeemedOmr} $OMR → ${money((flows.broker || {})['window:payout'] || 0)} cash`);
console.log(`    the den: ${chain.dice} rolls · gamblers net ${money(((flows.gambler || {})['casino:win:dice'] || 0) + ((flows.gambler || {})['casino:bet:dice'] || 0))}`);
console.log(`    shelters: ${chain.safehouses} safehouse stays bought by turtles · deaths town-wide ${deaths}`);
// THE DEN'S VARIANCE: with 1:1 pays the standard deviation of the house's take over N rolls is
// ≈ √(Σ stake²), and the edge only equals its own noise past N* = (1/0.0141)² ≈ 5,030 equal rolls —
// so a month of a few gamblers is a coin flip against the edge, and the realized figure is REPORTED
// as a z-score rather than compared to 1.41% as if it were a rate. (sim.js P9.40 prints the analytic.)
{
  const stakes = chain.diceStakes; const sum = stakes.reduce((a, b) => a + b, 0);
  const sigma = Math.sqrt(stakes.reduce((a, b) => a + b * b, 0));
  const expected = -0.0141 * sum;
  const realized = ((flows.gambler || {})['casino:win:dice'] || 0) + ((flows.gambler || {})['casino:bet:dice'] || 0);
  const z = sigma ? (realized - expected) / sigma : 0;
  console.log(`    den variance: ${stakes.length} rolls · staked ${money(sum)} · expected ${money(expected)} (1.41%) · realized ${money(realized)} (${sum ? (100 * -realized / sum).toFixed(1) : '—'}%) · σ ${money(sigma)} · z ${z.toFixed(2)} — the edge equals its noise only past ~${Math.round(1 / 0.0141 ** 2).toLocaleString('en-US')} rolls`);
}
const estateBurn = -Number((await pool.query(`SELECT COALESCE(SUM(amount),0) s FROM transactions WHERE reason='death:estate' AND currency='cash'`)).rows[0].s);
const startTotal = players.reduce((a, p) => a + start(p), 0);
console.log(`    the estate: ${money(estateBurn)} burned at death town-wide = ${pct(estateBurn, startTotal)} of the ${money(startTotal)} the town started with`);
if (DEFENDED) {
  console.log('\n  THE DEFENCES — what the prey bought to stay alive, and whether it worked:');
  for (const g of def.guardShotRows.filter((x) => x.state === 'available' && x.outcome !== 'absorbed' && x.outcome !== 'miss')) console.log(`      ⚠ day ${g.day}: a lethal shot at a mark with a LIVE, AVAILABLE guard (${g.guard}) was NOT absorbed — outcome ${g.outcome}`);
  console.log(`    bodyguards: ${def.guardHires} hires (${money(def.guardCash)}) · shots ABSORBED by a guard ${ev.absorbed} · shots at a GUARDED mark ${def.guardedShots} (guard in lockup ${def.guardJailed} / infirmary ${def.guardHosp} / dead ${def.guardDead}) · contract lapsed at the shot ${def.guardLapsed}`);
  console.log(`    insurance: ${def.insured} prey arrived with 2 respawn tokens · shots REVIVED ${ev.revived}`);
  console.log(`    shelter: ${def.preyShelters} prey safehouse stays (${money(def.shelterCash)}) — a 4h stay lapses at the day warp, so the acting order inside a day decides what it covers`);
  console.log(`    contracts on hunters: ${def.playerContracts} personal (${money(def.playerContractCash)}) + ${def.familyContracts} family (${money(def.familyContractCash)}, ${def.tributes} tributes) · marked killers ${syn.hits.size}`);
  console.log(`    the hunters' own targeting: vendetta ${def.vendettaShots} shots / ${def.vendettaKills} settled · contract ${def.contractShots} shots / ${def.contractKills} kills · board ${def.boardShots} shots`);
  const preyDeaths = (s) => sheets.filter((x) => x.p.strat === s).reduce((a, x) => a + x.deaths, 0);
  const ins = sheets.filter((x) => PREY.has(x.p.strat) && x.p.st.insured), unins = sheets.filter((x) => PREY.has(x.p.strat) && !x.p.st.insured);
  console.log(`    insured prey died ${ins.reduce((a, x) => a + x.deaths, 0)}× (median worth ${money(median(ins.map((x) => x.worth)))}) · uninsured prey died ${unins.reduce((a, x) => a + x.deaths, 0)}× (median ${money(median(unins.map((x) => x.worth)))}) · landlord/lender/broker/adaptive deaths ${['landlord', 'lender', 'broker', 'adaptive'].map((s) => `${s} ${preyDeaths(s)}`).join(', ')}`);
  const dist = {}; for (const p of by('adaptive')) dist[p.st.policy] = (dist[p.st.policy] || 0) + 1;
  console.log(`    the adaptive seats: ${def.adaptiveSwitches} switches · ended as ${Object.entries(dist).map(([k, v]) => `${k}×${v}`).join(' ')} · mean daily gain by policy: ${ADAPTIVE_POLICIES.map((x) => `${x} ${bandit[x]?.n ? money(bandit[x].sum / bandit[x].n) : '—'}${bandit[x]?.n ? ` (n=${bandit[x].n})` : ''}`).join(', ')}`);
}

console.log('\n  WHERE THE MONEY WENT — per strategy, the top sinks paid and faucets drawn (net cash, whole run):');
for (const s of Object.keys(CAST)) {
  const f = flows[s] || {};
  const out = Object.entries(f).filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([r, v]) => `${r} ${money(v)}`);
  const inn = Object.entries(f).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r, v]) => `${r} +${money(v)}`);
  console.log(`    ${s.padEnd(9)} paid: ${out.join(', ') || '—'}`);
  console.log(`    ${''.padEnd(9)} drew: ${inn.join(', ') || '—'}`);
}
// SINKS ROUTED AROUND: a recurring sink the game expects a strategy to pay, that it never paid.
const EXPECT = { landlord: ['business:upkeep'], hunter: ['ammo:buy'], turtle: ['safehouse'], broker: ['window:burn [$OMR]'] };
const dodged = [];
for (const [s, rs] of Object.entries(EXPECT)) for (const r of rs) { const f = flows[s] || {}; const paid = Object.keys(f).some((k) => k === r || k.startsWith(r)); if (!paid) dodged.push(`${s} never paid ${r}`); }
console.log(`\n  SINKS ROUTED AROUND: ${dodged.length ? dodged.join('; ') : 'none — every strategy paid the sink its loop is priced by'}`);

console.log('\n  REFUSALS (the gates that bit each strategy):');
for (const s of Object.keys(CAST)) {
  const top = Object.entries(refused[s] || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}×${v}`);
  console.log(`    ${s.padEnd(9)} acted ${String(acted[s] || 0).padStart(5)} · refused ${top.join(' ') || '—'}`);
}

// ── assertions LAST, so the report always prints ─────────────────────────────────────────────────
const moved = after.checks.filter((c) => Math.abs(c.drift - (baseline[c.name] ?? 0)) > 0.01).map((c) => `${c.name}: ${baseline[c.name] ?? 0} → ${c.drift}`);
assert.equal(moved.length, 0, `§10.4 MOVED during the run — a population of predators found a leak the sim cannot see:\n  ${moved.join('\n  ')}`);
console.log(`\n✓ §10.4 held: ${after.checks.length} checks, drift delta 0 across a month of ${players.length} agents`);
for (const s of Object.keys(CAST)) assert((acted[s] || 0) >= DAYS, `strategy ${s} acted only ${acted[s] || 0} times in ${DAYS} days — a strategy that never plays is not measured, it is missing`);
// The floor is on SHOTS, not searches, and the reason is the defended month itself: the retaliation
// rail KILLS hunters (run 4: three of six, $12.1M of hunter wealth burned at the estate) and a dead
// hunter's heir cannot re-arm, so searches FALL with the retaliation working — a search floor read a
// successful defence as an unexercised kill economy. A shot per hunter seat is the vacuity line: below
// it no lethal roll ran and nothing about kills was measured.
assert(ev.fire >= CAST.hunter, `the hunters fired only ${ev.fire} lethal shots in ${DAYS} days (${CAST.hunter} seats) — the kill economy was not exercised`);
assert(chain.loansTaken >= 1, 'nobody ever took a loan — the shylock chain was not exercised');
assert(chain.funnelFills >= 1, 'the ring never funnelled — the alt chain was not exercised');
assert(chain.redeemed >= 1, 'no broker ever redeemed at the window — the $OMR chain was not exercised');
if (DEFENDED) {
  // ANTI-VACUITY for the toolkit: a defence nobody bought reads on the summary line exactly like a
  // defence that failed, and the whole point of this month is the difference between the two.
  assert(def.guardHires >= 1, 'no prey ever hired a bodyguard — the guard market was not exercised');
  assert(def.preyShelters >= DAYS, `prey bought only ${def.preyShelters} safehouse stays in ${DAYS} days — the shelter cadence was not exercised`);
  assert(def.playerContracts + def.familyContracts >= 1 || syn.hits.size === 0, 'killers were marked but no contract was ever posted on one — retaliation was not exercised');
  assert(ev.absorbed + ev.revived + def.preyShelters > 0, 'not one shot was absorbed, revived or sheltered against');
}
console.log('✓ every strategy played, every chain ran' + (DEFENDED ? ', every defence was bought' : ''));
await app.close();
console.log('\n✅ arena complete.');
