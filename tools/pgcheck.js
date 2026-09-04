// THE REAL-POSTGRES GATE — everything the pg-mem suites are structurally blind to.
//
// All 48 suites run on pg-mem. That has earned its keep (it caught the INT-arithmetic quirk, the
// correlated-subquery gap, the missing random()), but it is by construction blind to node-pg's own
// contract and to Postgres's real concurrency — and production runs both. On 2026-07-25 that blind
// spot produced, in one night:
//
//   • the API process DYING on every database restart (an unhandled Pool 'error' event)
//   • `loadOwned` issuing 16 overlapping queries on one pooled client (deprecated; removed in pg@9)
//
// Neither was reachable from any pg-mem test. A tester reporting "Internal on every crime" was the
// only signal, and it pointed at the wrong file.
//
// So: boot the real server against real Postgres and assert the things only real Postgres can show.
// Each block below exists because of a specific bug or a specific property that cannot be faked.
// Exits non-zero, so CI fails on regression.
//
//   createdb omerta_check
//   DATABASE_URL=postgres://localhost/omerta_check JWT_SECRET=x MOD_KEY=yyyyyyyyyyyy \
//     MARKET_SEED='<32 random chars>' SOCIAL_VERIFY_MODE=off node tools/pgcheck.js
import crypto from 'node:crypto';
import fs from 'node:fs';
import { SHIPMENT, TREASURY } from '../src/rules.js'; // read live prices/floors, never restate them

if (!process.env.DATABASE_URL) {
  console.error('pgcheck needs DATABASE_URL pointed at a real (throwaway) Postgres — that is the whole point.');
  process.exit(2);
}

// The throttle switches itself on whenever DATABASE_URL is set — correct for production, but it
// answers 429 before a request ever reaches the row lock, which is the one thing section 4 exists to
// measure. The buckets themselves are covered by the pg-mem suites; here they would only hide things.
process.env.RATE_LIMIT = 'off';

const fails = [];
const pass = [];
const check = (ok, label, detail = '') => {
  if (ok) { pass.push(label); console.log(`  ✓ ${label}`); }
  else { fails.push(`${label}${detail ? ` — ${detail}` : ''}`); console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};

// A pg deprecation is a FAILURE here, not a log line: it means we are using the driver in a way the
// next major removes, and pg-mem will never tell us.
const deprecations = [];
process.on('warning', (w) => { if (/pg|client\.query/i.test(w.message)) deprecations.push(w.message); });

const { buildServer } = await import('../src/server.js');
const app = await buildServer();
const pool = app.pool;
// WAS THIS DATABASE ALREADY IN USE? Read before this harness creates anything, so it is a fact about
// what it was handed rather than about what it did. Only §6 cares: unlike the other harnesses, which
// SQL-seed and therefore assert a before/after DELTA, §6 asserts the ledger identities ABSOLUTELY —
// which is only meaningful on a database nothing has seeded value into behind its back.
const preExistingChars = Number((await pool.query('SELECT count(*) n FROM characters')).rows[0].n);
const call = async (method, url, { token, body } = {}) => {
  const res = await app.inject({ method, url,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': crypto.randomUUID() },
    payload: body });
  let json = null; try { json = res.json(); } catch {}
  return { code: res.statusCode, body: json };
};

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n1. THE SAFETY VALVES actually reach the server');
// Set in db.js as connection `options`. If a future refactor drops them, nothing else notices until
// a stuck query pins a connection — or a row lock freezes a character — in production.
{
  const s = (await pool.query(`SELECT current_setting('statement_timeout') a,
                                      current_setting('lock_timeout') b,
                                      current_setting('idle_in_transaction_session_timeout') c`)).rows[0];
  check(s.a !== '0', 'statement_timeout is set', `got ${s.a}`);
  check(s.b !== '0', 'lock_timeout is set', `got ${s.b}`);
  check(s.c !== '0', 'idle_in_transaction_session_timeout is set', `got ${s.c}`);

  // …and lock_timeout genuinely FIRES rather than queueing forever. pg-mem has no row locks at all,
  // so this property is invisible to every suite.
  // Deliberately NOT `SET lock_timeout` here: setting our own would prove only that Postgres has the
  // feature, while the thing that matters is that OUR pooled connection carries it. So we block on a
  // real row and wait out the configured value — which costs a few seconds and is worth them.
  // pg_settings.setting, not current_setting: the latter renders "8s" and any unit-stripping parse of
  // that reads as 8ms, which would make the deadline assertion below fail against a healthy config.
  const budget = Number((await pool.query(
    "SELECT setting FROM pg_settings WHERE name='lock_timeout'")).rows[0]?.setting) || 0;
  let code = 'none', waited = 0;
  if (budget <= 0) {
    // Never actually block here without a timeout to end it: the query would queue forever and CI
    // would burn its whole job budget on a hang. A hang is a worse failure signal than a failure.
    check(false, "the pool's own lock_timeout aborts a blocked lock", 'lock_timeout is 0 — not probing, that would hang');
  } else {
    const a = await pool.connect(), b = await pool.connect();
    try {
      await a.query('BEGIN');
      await a.query('SELECT * FROM street_tax WHERE id=1 FOR UPDATE');
      const t0 = Date.now();
      try { await b.query('BEGIN'); await b.query('SELECT * FROM street_tax WHERE id=1 FOR UPDATE'); }
      catch (e) { code = e.code; }
      waited = Date.now() - t0;
    } finally {
      await a.query('ROLLBACK').catch(() => {}); await b.query('ROLLBACK').catch(() => {});
      a.release(); b.release();
    }
    check(code === '55P03', "the pool's own lock_timeout aborts a blocked lock", `waited ${waited}ms, code ${code}`);
    check(waited < budget * 2, 'it gives up on schedule', `waited ${waited}ms against a ${budget}ms budget`);
  }
  const { deadlockToRetry } = await import('../src/game.js');
  check(deadlockToRetry({ code: '55P03' })?.code === 'contention', 'lock_timeout maps to a retryable error');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. THE PROCESS SURVIVES ITS CONNECTIONS BEING KILLED');
// The 2026-07-25 crash: node-pg emits 'error' on the Pool when an IDLE connection dies (a database
// restart, a failover, an idle reaper). An EventEmitter with no 'error' listener THROWS, and an
// uncaught exception kills Node — so the whole API died on every database bounce.
//
// Killing our own idle backends reproduces exactly that event. If the handler in db.js is ever
// removed, THIS PROCESS DIES HERE and CI goes red, which is the entire point.
{
  await pool.query('SELECT 1');                              // ensure at least one pooled connection exists
  const killed = (await pool.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid() AND state = 'idle'`)).rowCount;
  await new Promise((r) => setTimeout(r, 300));              // let the 'error' events land
  let recovered = false;
  for (let i = 0; i < 3 && !recovered; i++) {                // node-pg discards dead clients on checkout
    try { await pool.query('SELECT 1'); recovered = true; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  check(recovered, 'the pool recovers after its connections are killed', `terminated ${killed} backend(s)`);
  const me = await call('GET', '/v1/session');
  check(me.code < 500, 'the server still serves after a connection kill', `got ${me.code}`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. THE CORE LOOP, on real Postgres');
const { body: { token } } = await call('POST', '/v1/auth/guest');
{
  const c = await call('POST', '/v1/character', { token, body: { name: `PgCheck ${Date.now() % 100000}` } });
  check(c.code < 500, 'character creation', `${c.code} ${JSON.stringify(c.body).slice(0, 120)}`);

  const rules = (await call('GET', '/v1/rules')).body;
  let bad = null;
  for (const crime of rules.crimes.filter((x) => x.lvl <= 1)) {
    for (const approach of [undefined, 'quiet', 'standard', 'loud']) {
      const r = await call('POST', `/v1/crimes/${crime.id}`, { token, body: approach ? { approach } : undefined });
      if (r.code >= 500) bad ||= `${crime.id}/${approach || 'none'} → ${r.code} ${JSON.stringify(r.body)}`;
    }
  }
  check(!bad, 'every crime, every approach, no 500', bad || '');

  // every read a fresh client fires on load — these run withCharacter, so they exercise the row lock,
  // the accrual, three persists and a commit against real Postgres
  bad = null;
  for (const url of ['/v1/me', '/v1/streets', '/v1/city', '/v1/onboard', '/v1/casino', '/v1/law', '/v1/wire',
                     '/v1/boxing', '/v1/races', '/v1/port', '/v1/market', '/v1/loans', '/v1/business',
                     '/v1/skills', '/v1/underworld', '/v1/estate', '/v1/portfolio', '/v1/pen', '/v1/world']) {
    const r = await call('GET', url, { token });
    if (r.code >= 500) bad ||= `${url} → ${r.code} ${JSON.stringify(r.body)}`;
  }
  check(!bad, 'every board read, no 500', bad || '');

  bad = null;
  for (const [url, body] of [['/v1/train', { stat: 'muscle' }], ['/v1/bank/deposit', { amount: 10 }],
                             ['/v1/travel/neon', undefined]]) {
    const r = await call('POST', url, { token, body });
    if (r.code >= 500) bad ||= `${url} → ${r.code} ${JSON.stringify(r.body)}`;
  }
  check(!bad, 'write actions, no 500', bad || '');
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4. THE ROW LOCK ACTUALLY SERIALIZES (no lost update)');
// pg-mem's locking is effectively a no-op, so a lost update is INVISIBLE to every suite. Here,
// concurrent same-account deposits must serialize on `SELECT … FOR UPDATE` and sum exactly. If the
// lock were ever weakened, or a read-modify-write slipped outside it, this is where it shows.
{
  const cid = (await call('GET', '/v1/me', { token })).body.character.id;
  // Cash is EARNED, never SQL-injected. Seeding it unledgered would break §10.4 in section 5 below —
  // the codebase's own rule, and this probe has to live by it. Jail/energy are not currency, so those
  // are fair to set; lockup would just make every deposit refuse and pass the check vacuously.
  for (let i = 0; i < 40; i++) {
    await pool.query("UPDATE characters SET nerve=60, energy=200, jail_until=NULL, health=100 WHERE id=$1", [cid]);
    await call('POST', '/v1/crimes/pick', { token });
    if (Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [cid])).rows[0].cash) > 5000) break;
  }
  // Measure the DELTA, never a zeroed balance: `SET bank=0` would silently destroy ledgered value
  // and drift §10.4 in section 5 — which is exactly what the first draft of this probe did.
  await pool.query("UPDATE characters SET jail_until=NULL WHERE id=$1", [cid]);
  const bankOf = async () => Number((await pool.query('SELECT bank FROM characters WHERE id=$1', [cid])).rows[0].bank);
  const before = await bankOf();
  const cash = Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [cid])).rows[0].cash);
  const N = 8, AMT = Math.floor(cash / (N + 1));
  check(AMT > 0, 'earned enough cash to test concurrent deposits', `cash ${cash}`);
  const results = await Promise.all(Array.from({ length: N }, () =>
    call('POST', '/v1/bank/deposit', { token, body: { amount: AMT } })));
  const ok = results.filter((r) => r.code === 200).length;
  const moved = (await bankOf()) - before;
  // ok MUST be non-zero, or this check passes by doing nothing — the failure mode of the first draft
  check(ok === N, `all ${N} concurrent deposits landed`, `${ok}/${N}: ${results.filter((r) => r.code !== 200).map((r) => JSON.stringify(r.body)).join(' ')}`);
  // Bank interest accrues fractionally on every touch, so the delta carries sub-dollar dust — and
  // `moved` is a float subtraction of two interest-bearing balances, so the dust lands on EITHER side
  // of the sum. A bare `moved >= ok * AMT` therefore fails on a delta of 3383.9999999999995 against
  // an expected 3384, which is a rounding artifact and not a lost update. The thing being detected is
  // off by a WHOLE DEPOSIT (hundreds or thousands), so a cent of tolerance keeps the check exact in
  // every sense that matters while giving the float arithmetic room to be itself.
  const dust = 0.01;
  check(ok > 0 && moved >= ok * AMT - dust && moved < (ok + 1) * AMT,
    `${ok} concurrent deposits summed exactly (no lost update)`, `bank moved ${moved}, expected ${ok * AMT}`);
  check(results.every((r) => r.code < 500), 'concurrency produced no 500s',
    results.filter((r) => r.code >= 500).map((r) => JSON.stringify(r.body)).join(' '));
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n5. A REFUSED ACTION LEAVES NO TRACE');
// **pg-mem's ROLLBACK is a no-op.** Measured: BEGIN, INSERT, ROLLBACK, and the row is still there.
// So every "the action was refused, therefore nothing changed" assertion across all 47 suites is
// vacuous — they pass whether or not the transaction actually unwinds. That is not a small gap: the
// entire economy rests on one-transaction-per-action, and until this check existed, nothing anywhere
// verified that an action which throws mid-flight takes its partial writes with it.
{
  const cid = (await call('GET', '/v1/me', { token })).body.character.id;
  const rows = async (t) => Number((await pool.query(`SELECT COUNT(*) n FROM ${t} WHERE character_id=$1`, [cid])).rows[0].n);
  const cashOf = async () => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [cid])).rows[0].cash);

  // Jail them, then attempt a crime. The gate throws AFTER §7.1 accrual has already run and written
  // its ledger rows inside the same transaction — so if the rollback were not real, those rows (and
  // any partial mutation) would survive a refusal.
  await pool.query(`UPDATE characters SET jail_until = now() + interval '10 minutes',
    last_accrued_at = now() - interval '6 hours' WHERE id=$1`, [cid]);
  const [txBefore, cashBefore] = [await rows('transactions'), await cashOf()];
  const refused = await call('POST', '/v1/crimes/pick', { token });
  check(refused.code === 400, 'a jailed crime is refused', `${refused.code} ${JSON.stringify(refused.body)}`);
  check(await rows('transactions') === txBefore, 'the refusal wrote no ledger rows',
    `${await rows('transactions')} vs ${txBefore}`);
  check(await cashOf() === cashBefore, 'the refusal moved no money', `${await cashOf()} vs ${cashBefore}`);

  // and the clock did not advance either — the accrual is deferred, not consumed
  const stale = (await pool.query(
    "SELECT last_accrued_at < now() - interval '5 hours' old FROM characters WHERE id=$1", [cid])).rows[0].old;
  check(stale === true, 'the accrual clock is untouched, so the window is re-accrued on the next touch');
  await pool.query('UPDATE characters SET jail_until=NULL WHERE id=$1', [cid]);
}

console.log('\n6. §10.4 HOLDS on real Postgres');
// The suites prove this on pg-mem, where NUMERIC is JavaScript arithmetic. Real Postgres uses true
// arbitrary-precision NUMERIC with different rounding — so the conservation identities deserve to be
// re-asserted on the engine that actually stores the money.
{
  const { runLedgerInvariants } = await import('../src/invariants.js');
  // SKIPPED, LOUDLY, on a database that was already in use — never quietly reported as a bug.
  //
  // This leg asserts the identities ABSOLUTELY, so it only means anything on a database nothing has
  // seeded into. Point it at one `loadtest` or `chaos` has run against and it reports a nine-figure
  // "ledger failure" that is entirely their SQL seeding. That happened during this session and cost
  // real time chasing it — a false bug report is worse than no report.
  //
  // Detecting it by guessing at the drift was the first cut, and it was worse than useless: the
  // heuristic would have fired on a GENUINE drift too, printing "probably just seeding, ignore" over
  // the exact finding this harness exists to surface. Skipping on a fact known before the run starts
  // — the database was not empty — can't misclassify anything.
  if (preExistingChars > 0) {
    console.log(`  ⃠ SKIPPED — this database already held ${preExistingChars} character(s) when pgcheck`
      + ' started, so the absolute ledger identities are not meaningful here (another harness seeds by'
      + ' SQL). Run `createdb omerta_check` and point pgcheck at a FRESH database to exercise this.');
  } else {
    const inv = await runLedgerInvariants(pool, { alert: false });
    const broken = (inv.checks || []).filter((c) => !c.ok);
    check(inv.ok, `all ${(inv.checks || []).length} ledger identities hold`,
      broken.map((c) => `${c.name} drift ${c.drift}`).join('; '));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n6b. loadOwned's UNION returns what the fourteen queries did");
// loadOwned fetches fourteen small result sets in ONE round trip, as a UNION ALL over a shared
// narrow shape with hand-written casts, demultiplexed in JS. It runs on every authed request, so it
// is the single most-executed query in the game — and it is exactly the kind of change pg-mem cannot
// police:
//
//   * pg-mem returns `numeric` as a NUMBER; node-pg returns it as a STRING. Every branch that
//     carries a number now goes through an explicit `Number()`, and whether that is right can only
//     be checked here.
//   * a branch whose typed NULLs are wrong fails at PARSE time on Postgres ("UNION types … cannot
//     be matched") — a 500 on every request — and pg-mem's pairwise left-to-right unification
//     accepts shapes Postgres rejects, and vice versa.
//   * the suites drive characters who own almost nothing, so twelve of the fourteen branches are
//     EMPTY in every existing test. An empty branch proves nothing about a populated one.
//
// So: seed a row in every branch and compare the demultiplexed output against the ORIGINAL query
// for that branch, field by field, INCLUDING the JS type. A future fifteenth branch that forgets a
// cast, or a field read raw where it used to be coerced, fails here.
{
  // its own character, made through the API like a player's — nothing here touches §6's fixtures
  const { body: { token: uTok } } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', { token: uTok, body: { name: `Union Uli ${Date.now() % 100000}` } });
  const A = { id: (await call('GET', '/v1/me', { token: uTok })).body.character.id };
  const accOf = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [A.id])).rows[0].account_id;
  const gId = 'g-union-' + Date.now();
  await pool.query('INSERT INTO gangs (id, name, tag) VALUES ($1,$2,$3)', [gId, 'Union Family ' + Date.now(), 'UNI']);
  for (const [sql, params] of [
    ["INSERT INTO character_rackets (character_id, racket_id, level) VALUES ($1,'numbers',3)", [A.id]],
    ["INSERT INTO character_assets (character_id, asset_id) VALUES ($1,'watch')", [A.id]],
    ["INSERT INTO character_cargo (character_id, good_id, qty) VALUES ($1,'cigs',7)", [A.id]],
    ["INSERT INTO character_items (character_id, item_id, qty) VALUES ($1,'ammo',42)", [A.id]],
    ["INSERT INTO account_gear (account_id, gear_id) VALUES ($1,'ring')", [accOf]],
    ["INSERT INTO character_guns (character_id, gun_id) VALUES ($1,'pistol')", [A.id]],
    ['INSERT INTO gang_members (gang_id, character_id, role) VALUES ($1,$2,$3)', [gId, A.id, 'boss']],
    ["INSERT INTO makings (character_id, drug_id, qty) VALUES ($1,'weed',12)", [A.id]],
    // two rows here, so a single-row group cannot hide a demultiplexing bug
    ["INSERT INTO stash (character_id, drug_id, qty, quality) VALUES ($1,'weed',5,73)", [A.id]],
    ["INSERT INTO stash (character_id, drug_id, qty, quality) VALUES ($1,'coke',3,88)", [A.id]],
    ["INSERT INTO character_skills (character_id, skill_id) VALUES ($1,'bruiser')", [A.id]],
    ["INSERT INTO npc_standing (character_id, npc_id, standing) VALUES ($1,'doc',44)", [A.id]],
    ["INSERT INTO npc_standing (character_id, npc_id, standing) VALUES ($1,'armorer',61)", [A.id]],
    ["INSERT INTO npc_grudges (character_id, npc_id, count) VALUES ($1,'doc',2)", [A.id]],
    // (D11 2026-08-05: the 'pf' UNION branch left loadOwned with the Portfolio — no seed, no count)
    ["INSERT INTO estates (account_id, name, tier, spent_omr) VALUES ($1,'The Villa',3,915.234567)", [accOf]],
  ]) await pool.query(sql, params);

  // the ORIGINAL per-branch queries, kept here deliberately: this section is a DIFFERENTIAL test,
  // so it needs the thing being differed against. If a branch's source table or filter changes, the
  // line below changes with it — which is the review moment the round-trip collapse should have.
  const originals = {
    rk: ['SELECT racket_id, level FROM character_rackets WHERE character_id=$1', A.id],
    as: ['SELECT asset_id FROM character_assets WHERE character_id=$1', A.id],
    cargo: ['SELECT good_id, qty FROM character_cargo WHERE character_id=$1 AND qty>0', A.id],
    items: ['SELECT item_id, qty FROM character_items WHERE character_id=$1 AND qty>0', A.id],
    gear: ['SELECT gear_id FROM account_gear WHERE account_id=$1', accOf],
    guns: ['SELECT gun_id FROM character_guns WHERE character_id=$1', A.id],
    gm: ['SELECT gang_id, role, joined_at FROM gang_members WHERE character_id=$1', A.id],
    mk: ['SELECT drug_id, qty FROM makings WHERE character_id=$1 AND qty>0', A.id],
    st: ['SELECT drug_id, qty, quality FROM stash WHERE character_id=$1', A.id],
    sk: ['SELECT skill_id FROM character_skills WHERE character_id=$1', A.id],
    npc: ['SELECT npc_id, standing, touched_at FROM npc_standing WHERE character_id=$1', A.id],
    grudge: ['SELECT npc_id, count, since FROM npc_grudges WHERE character_id=$1 AND count > 0', A.id],
    est: ['SELECT name, tier, spent_omr FROM estates WHERE account_id=$1', accOf],
  };

  const { loadOwned } = await import('../src/game.js');
  const ch = (await pool.query('SELECT * FROM characters WHERE id=$1', [A.id])).rows[0];
  const c = await pool.connect();
  let owned = null, boom = '';
  try { owned = await loadOwned(c, ch); } catch (e) { boom = e.message; }
  check(!!owned, 'the union PARSES and runs on real Postgres with every branch populated', boom);

  if (owned) {
    // each branch's rows survived the round trip, in the right numbers
    const counts = {
      rk: owned.rackets.length, as: owned.assets.length,
      cargo: Object.keys(owned.cargo).length, items: Object.keys(owned.items).length,
      gear: owned.gear.length, guns: owned.guns.length, gm: owned.gangId ? 1 : 0,
      mk: Object.keys(owned.makings).length, st: owned.stash.length, sk: owned.skills.size,
      npc: Object.keys(owned.npc).length, grudge: Object.keys(owned.grudges).length,
      est: owned.estate ? 1 : 0,
    };
    const wrong = [];
    for (const [g, [sql, param]] of Object.entries(originals)) {
      const want = (await pool.query(sql, [param])).rows.length;
      if (counts[g] !== want) wrong.push(`${g}: union ${counts[g]} vs original ${want}`);
    }
    check(wrong.length === 0, 'every branch returns the same rows the original query did', wrong.join('; '));

    // …and each VALUE came out of the right slot. This is the check that earns the section: the
    // union packs fourteen different row shapes into six generic columns, so a branch reading `n2`
    // where it means `n` silently swaps two fields — here, a stash line's quantity and its purity.
    // Row counts still match, no error is raised, and every existing suite passes, because they all
    // drive characters whose stash is EMPTY. Verified by mutation: swapping those two slots fails
    // exactly this line and nothing else in the tree.
    const slots = [
      ['cargo.cigs', owned.cargo.cigs, 7], ['items.ammo', owned.items.ammo, 42],
      ['makings.weed', owned.makings.weed, 12], ['racketLevels.numbers', owned.racketLevels.numbers, 3],
      ['stash[].qty', owned.stash.find((s) => s.drug_id === 'weed')?.qty, 5],
      ['stash[].quality', owned.stash.find((s) => s.drug_id === 'weed')?.quality, 73],
      ['grudges.doc', owned.grudges.doc, 2], ['estate.tier', Number(owned.estate?.tier), 3],
    ];
    const wrongSlot = slots.filter(([, v, want]) => v !== want).map(([k, v, want]) => `${k}=${v} (want ${want})`);
    check(wrongSlot.length === 0, 'every populated branch demultiplexes from the right slot', wrongSlot.join(', '));
    // (D11: the fractional-precision probe rode the retired 'pf' branch — the estate's spent_omr
    // is the same numeric slot through the same union, so the property is still exercised)
    check(Math.abs(Number(owned.estate?.spent_omr) - 915.234567) < 1e-9,
      'a fractional numeric keeps its precision through numeric→Number', `${owned.estate?.spent_omr}`);

    // THE FIELDS NOTHING DOWNSTREAM RE-WRAPS. Worth being precise about what this proves: node-pg
    // returns `numeric` as a STRING and pg-mem returns a number, so the union coerces — but every
    // map/reduce consumer of those branches ALSO wraps in Number(), so that coercion is currently
    // belt-and-braces, and asserting the type of a re-wrapped field proves nothing (checked by
    // mutation: dropping a coercion changes no observable value today).
    //
    // These three are the exceptions — raw pass-throughs with no second coercion behind them. A
    // timestamp arriving as a string would still compare truthy in `new Date(x) > y` while breaking
    // arithmetic on it, which is the quiet kind of wrong.
    check(owned.gangJoinedAt instanceof Date, 'gangJoinedAt is a Date, not a string', `${typeof owned.gangJoinedAt}`);
    check(owned.gangRole === 'boss', 'the text field riding a second generic column survives', `${owned.gangRole}`);
    check(typeof owned.estate?.tier === 'number', 'the estate row is handed over already coerced',
      `${typeof owned.estate?.tier}`);
  }
  c.release();
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n6c. SHARED COLLECTIBLE SERIALS ACTUALLY SERIALIZE');
// withCharacter locks the ACTOR, not the collectible kind shared by every account. pg-mem has no
// row locks, so the old COUNT(*) + 1 allocator looked correct there while two real transactions could
// choose the same number and make one valid commission roll back. A temporary BEFORE INSERT pause
// makes the overlap deterministic: both requests reach the shared counter before either can finish.
{
  const piece = SHIPMENT.COMMISSIONS[0];
  const stamp = `${Date.now() % 100000}-${process.pid}`;
  const make = async (suffix) => {
    const { body: { token: t } } = await call('POST', '/v1/auth/guest');
    await call('POST', '/v1/character', { token: t, body: { name: `Serial ${suffix} ${stamp}` } });
    const id = (await call('GET', '/v1/me', { token: t })).body.character.id;
    return { id, token: t };
  };
  const [a, b] = await Promise.all([make('A'), make('B')]);
  await pool.query('UPDATE characters SET shipment=$3, cash=cash+$4 WHERE id IN ($1,$2)',
    [a.id, b.id, piece.units, piece.cash]);
  const before = Number((await pool.query(
    'SELECT COALESCE(MAX(serial),0) n FROM bespoke_pieces WHERE commission_id=$1', [piece.id])).rows[0].n);
  let results = [];
  try {
    await pool.query(`CREATE OR REPLACE FUNCTION pgcheck_pause_bespoke() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(0.2); RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER pgcheck_pause_bespoke BEFORE INSERT ON bespoke_serials
      FOR EACH ROW EXECUTE FUNCTION pgcheck_pause_bespoke()`);
    results = await Promise.all([
      call('POST', `/v1/shipment/commission/${piece.id}`, { token: a.token }),
      call('POST', `/v1/shipment/commission/${piece.id}`, { token: b.token }),
    ]);
  } finally {
    await pool.query('DROP TRIGGER IF EXISTS pgcheck_pause_bespoke ON bespoke_serials');
    await pool.query('DROP FUNCTION IF EXISTS pgcheck_pause_bespoke()');
  }
  const serials = results.filter((r) => r.code === 200).map((r) => Number(r.body.piece.serial)).sort((x, y) => x - y);
  check(results.length === 2 && results.every((r) => r.code === 200),
    'both cross-account commissions land under a forced overlap',
    results.map((r) => `${r.code} ${JSON.stringify(r.body)}`).join(' | '));
  check(serials.length === 2 && serials[0] === before + 1 && serials[1] === before + 2,
    'the overlapped commissions receive consecutive unique serials',
    `before ${before}; got ${serials.join(', ')}`);
  // The harness SQL-funded exactly the cash each route burned. Remove those two debit rows so the
  // probe leaves the global ledger identity where it found it if later sections add another sweep.
  await pool.query("DELETE FROM transactions WHERE character_id IN ($1,$2) AND reason='shipment:commission'",
    [a.id, b.id]);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n7. THE SCHEMA IS RE-APPLIABLE (in-place upgrade)');
// Boot applies schema.sql then a derived ADD COLUMN IF NOT EXISTS pass. A second boot against the
// SAME database must be a clean no-op — that is what makes deploying a new build to a live database
// safe. pg-mem always starts empty, so it can never exercise the second boot.
{
  const { makeDb } = await import('../src/db.js');
  let ok = true, err = '';
  try { const p2 = await makeDb(); await p2.query('SELECT 1'); await p2.end(); }
  catch (e) { ok = false; err = e.message; }
  check(ok, 'schema + column migration re-apply cleanly to an existing database', err);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n7a. ITEM CONSERVATION CONSTRAINTS ARE REAL DATABASE AUTHORITY');
// pg-mem proves the runtime behavior but cannot prove that production PostgreSQL accepted every
// constraint with native semantics. Keep this probe small and self-cleaning: table presence, a valid
// row, a rejected negative mutation, and a rejected impossible consumed-instance state.
{
  const tables = ['item_stacks', 'item_instances', 'item_events',
    'item_mutation_guards', 'operation_escrow',
    'mystery_instances', 'mystery_node_state', 'mystery_choices', 'world_operations',
    'world_operation_roles', 'world_operation_node_state', 'world_operation_contributions'];
  const present = (await pool.query(
    `SELECT relname FROM pg_class
      WHERE relkind='r' AND relname = ANY($1::text[])`, [tables],
  )).rows.map((row) => row.relname);
  check(tables.every((table) => present.includes(table)),
    'all 12 Phase 1 item, mystery, and operation authority tables exist on real PostgreSQL',
    `present: ${present.sort().join(', ')}`);

  const mysteryProbe = `pgcheck-mystery-constraint-${process.pid}-${Date.now()}`;
  await pool.query(
    `INSERT INTO mystery_instances
       (id,owner_scope,owner_id,authority_account_id,graph_id,graph_version)
     VALUES ($1,'account','pgcheck-account','pgcheck-account','pgcheck-graph',1)`,
    [mysteryProbe],
  );
  await pool.query(
    `INSERT INTO mystery_node_state (instance_id,node_id,state,discovered_at)
     VALUES ($1,'pgcheck-node','discovered',now())`,
    [mysteryProbe],
  );
  await pool.query(
    `INSERT INTO mystery_choices (instance_id,node_id,choice_id,result_json)
     VALUES ($1,'pgcheck-choice','left','{}')`,
    [mysteryProbe],
  );
  let mysteryTupleCode = '';
  try {
    await pool.query("UPDATE mystery_instances SET status='completed' WHERE id=$1", [mysteryProbe]);
  } catch (error) { mysteryTupleCode = error.code; }
  check(mysteryTupleCode === '23514',
    'PostgreSQL rejects a completed mystery without its terminal timestamp tuple',
    `error ${mysteryTupleCode || 'none'}`);
  await pool.query('DELETE FROM mystery_choices WHERE instance_id=$1', [mysteryProbe]);
  await pool.query('DELETE FROM mystery_node_state WHERE instance_id=$1', [mysteryProbe]);
  await pool.query('DELETE FROM mystery_instances WHERE id=$1', [mysteryProbe]);

  const operationProbe = `pgcheck-world-operation-${process.pid}-${Date.now()}`;
  await pool.query(
    `INSERT INTO world_operations
       (id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id)
     VALUES ($1,'pgcheck-graph',1,'pgcheck-operation','pgcheck-crew','pgcheck-account-a')`,
    [operationProbe],
  );
  await pool.query(
    `INSERT INTO world_operation_roles (operation_id,role_id,account_id,character_id)
     VALUES ($1,'investigator','pgcheck-account-a','pgcheck-character-a')`,
    [operationProbe],
  );
  let distinctAccountCode = '';
  try {
    await pool.query(
      `INSERT INTO world_operation_roles (operation_id,role_id,account_id,character_id)
       VALUES ($1,'driver','pgcheck-account-a','pgcheck-character-a')`,
      [operationProbe],
    );
  } catch (error) { distinctAccountCode = error.code; }
  check(distinctAccountCode === '23505',
    'PostgreSQL enforces one account per world-operation role assignment',
    `error ${distinctAccountCode || 'none'}`);
  let operationTupleCode = '';
  try {
    await pool.query("UPDATE world_operations SET status='completed' WHERE id=$1", [operationProbe]);
  } catch (error) { operationTupleCode = error.code; }
  const operationStatus = (await pool.query(
    'SELECT status FROM world_operations WHERE id=$1', [operationProbe],
  )).rows[0]?.status;
  check(operationTupleCode === '23514' && operationStatus === 'forming',
    'PostgreSQL rejects a closed operation without its matching terminal timestamp tuple',
    `error ${operationTupleCode || 'none'}, status ${operationStatus || 'missing'}`);
  await pool.query('DELETE FROM world_operation_roles WHERE operation_id=$1', [operationProbe]);
  await pool.query('DELETE FROM world_operations WHERE id=$1', [operationProbe]);

  const ownerId = `pgcheck-item-${process.pid}`;
  await pool.query(
    `INSERT INTO item_stacks (owner_scope, owner_id, template_id, quality, quantity)
     VALUES ('account',$1,'mat:pgcheck','standard',1)`, [ownerId],
  );
  let negativeCode = '';
  try {
    await pool.query(
      `UPDATE item_stacks SET quantity=-1
        WHERE owner_scope='account' AND owner_id=$1
          AND template_id='mat:pgcheck' AND quality='standard'`,
      [ownerId],
    );
  } catch (error) { negativeCode = error.code; }
  const quantity = Number((await pool.query(
    `SELECT quantity FROM item_stacks
      WHERE owner_scope='account' AND owner_id=$1
        AND template_id='mat:pgcheck' AND quality='standard'`, [ownerId],
  )).rows[0]?.quantity);
  check(negativeCode === '23514' && quantity === 1,
    'PostgreSQL rejects a negative stack without changing its conserved value',
    `error ${negativeCode || 'none'}, quantity ${quantity}`);
  await pool.query(
    `DELETE FROM item_stacks
      WHERE owner_scope='account' AND owner_id=$1
        AND template_id='mat:pgcheck' AND quality='standard'`, [ownerId],
  );

  let stateCode = '';
  try {
    await pool.query(
      `INSERT INTO item_instances (id, template_id, owner_scope, owner_id, state)
       VALUES ($1,'item:pgcheck','account',$2,'consumed')`,
      [`pgcheck-impossible-${process.pid}`, ownerId],
    );
  } catch (error) { stateCode = error.code; }
  check(stateCode === '23514',
    'PostgreSQL rejects a consumed item without its permanent consumption timestamp',
    `error ${stateCode || 'none'}`);
  await pool.query('DELETE FROM item_instances WHERE id=$1', [`pgcheck-impossible-${process.pid}`]);

  const parityId = `pgcheck-escrow-parity-${process.pid}`;
  await pool.query(
    `INSERT INTO item_instances (id,template_id,owner_scope,owner_id)
     VALUES ($1,'item:pgcheck-parity','account',$2)`, [parityId, ownerId],
  );
  let parityCode = '';
  try {
    await pool.query(
      `INSERT INTO operation_escrow (item_id,operation_id,depositor_scope,depositor_id)
       VALUES ($1,'pgcheck-operation','account',$2)`, [parityId, ownerId],
    );
  } catch (error) { parityCode = error.code; }
  check(parityCode === '23503',
    'operation escrow must match the item authoritative operation owner and escrowed state',
    `error ${parityCode || 'none'}`);
  await pool.query('DELETE FROM operation_escrow WHERE item_id=$1', [parityId]);
  await pool.query('DELETE FROM item_instances WHERE id=$1', [parityId]);

  const {
    consumeStack, createItem, grantStack, transferItem, withItemTransaction,
  } = await import('../src/items.js');
  const tx = (action) => withItemTransaction(pool, action);
  const prefix = `pgcheck-item-${process.pid}-`;
  const actor = { scope: 'account', id: `${prefix}actor` };
  const rivalA = { scope: 'account', id: `${prefix}rival-a` };
  const rivalB = { scope: 'account', id: `${prefix}rival-b` };
  const keys = [
    `${prefix}autocommit`, `${prefix}seed`, `${prefix}decrement-a`, `${prefix}decrement-b`,
    `${prefix}replay`, `${prefix}create`, `${prefix}transfer-a`, `${prefix}transfer-b`,
  ];

  const autocommitClient = await pool.connect();
  let autocommitCode = '';
  try {
    await grantStack(
      autocommitClient, actor, 'mat:pgcheck-concurrency', 1,
      'standard', 'autocommit', keys[0],
    );
  } catch (error) { autocommitCode = error.code; }
  finally { autocommitClient.release(); }
  check(autocommitCode === 'item_transaction_required',
    'a checked-out PostgreSQL client without BEGIN cannot mutate inventory',
    `error ${autocommitCode || 'none'}`);

  await tx((client) => grantStack(
    client, actor, 'mat:pgcheck-concurrency', 10, 'standard', 'seed', keys[1],
  ));
  const decrements = await Promise.allSettled([
    tx((client) => consumeStack(
      client, actor, 'mat:pgcheck-concurrency', 7, 'standard', 'decrement', keys[2],
    )),
    tx((client) => consumeStack(
      client, actor, 'mat:pgcheck-concurrency', 7, 'standard', 'decrement', keys[3],
    )),
  ]);
  const afterDecrement = Number((await pool.query(
    `SELECT quantity FROM item_stacks
      WHERE owner_scope='account' AND owner_id=$1
        AND template_id='mat:pgcheck-concurrency' AND quality='standard'`, [actor.id],
  )).rows[0]?.quantity);
  check(decrements.filter((result) => result.status === 'fulfilled').length === 1
      && decrements.filter((result) => result.status === 'rejected'
        && result.reason?.code === 'materials').length === 1
      && afterDecrement === 3,
  'competing decrements serialize and cannot drive a stack negative',
  `outcomes ${decrements.map((result) => result.status === 'fulfilled'
    ? 'ok' : result.reason?.code).join(', ')}, quantity ${afterDecrement}`);

  const replayed = await Promise.all([
    tx((client) => grantStack(
      client, actor, 'mat:pgcheck-concurrency', 2, 'standard', 'replay', keys[4],
    )),
    tx((client) => grantStack(
      client, actor, 'mat:pgcheck-concurrency', 2, 'standard', 'replay', keys[4],
    )),
  ]);
  const afterReplay = Number((await pool.query(
    `SELECT quantity FROM item_stacks
      WHERE owner_scope='account' AND owner_id=$1
        AND template_id='mat:pgcheck-concurrency' AND quality='standard'`, [actor.id],
  )).rows[0]?.quantity);
  check(afterReplay === 5 && JSON.stringify(replayed[0]) === JSON.stringify(replayed[1]),
    'concurrent same-key grants apply once and return the same replay result',
    `quantity ${afterReplay}`);
  let collisionCode = '';
  try {
    await tx((client) => grantStack(
      client, rivalA, 'mat:pgcheck-concurrency', 2, 'standard', 'replay', keys[4],
    ));
  } catch (error) { collisionCode = error.code; }
  check(collisionCode === 'idempotency_conflict',
    'the same key cannot silently replay for another owner',
    `error ${collisionCode || 'none'}`);

  const item = await tx((client) => createItem(
    client, actor, 'item:pgcheck-concurrency', 'awarded', keys[5],
  ));
  const transfers = await Promise.allSettled([
    tx((client) => transferItem(client, actor, rivalA, item.id, 'race', keys[6])),
    tx((client) => transferItem(client, actor, rivalB, item.id, 'race', keys[7])),
  ]);
  const itemRow = (await pool.query(
    'SELECT owner_scope, owner_id, state FROM item_instances WHERE id=$1', [item.id],
  )).rows[0];
  const transferEvents = (await pool.query(
    `SELECT from_owner_scope, from_owner_id, to_owner_scope, to_owner_id
       FROM item_events WHERE item_id=$1 AND event_kind='transferred'`, [item.id],
  )).rows;
  check(transfers.filter((result) => result.status === 'fulfilled').length === 1
      && transfers.filter((result) => result.status === 'rejected'
        && result.reason?.code === 'item_unavailable').length === 1
      && itemRow?.owner_scope === 'account' && itemRow?.state === 'active'
      && [rivalA.id, rivalB.id].includes(itemRow?.owner_id),
  'competing transfers leave one authoritative owner and one provenance transition',
  `outcomes ${transfers.map((result) => result.status === 'fulfilled'
    ? 'ok' : result.reason?.code).join(', ')}, owner ${itemRow?.owner_id || 'none'}`);
  check(transferEvents.length === 1
      && transferEvents[0].from_owner_scope === actor.scope
      && transferEvents[0].from_owner_id === actor.id
      && transferEvents[0].to_owner_scope === itemRow?.owner_scope
      && transferEvents[0].to_owner_id === itemRow?.owner_id,
  'the winning concurrent transfer writes exactly one correct provenance event',
  `${transferEvents.length} event(s), ${transferEvents[0]?.from_owner_id || 'none'} → ${transferEvents[0]?.to_owner_id || 'none'}`);

  await pool.query('DELETE FROM item_events WHERE idempotency_key = ANY($1::text[])', [keys]);
  await pool.query('DELETE FROM item_mutation_guards WHERE idempotency_key = ANY($1::text[])', [keys]);
  await pool.query('DELETE FROM item_instances WHERE id=$1', [item.id]);
  await pool.query(
    `DELETE FROM item_stacks WHERE owner_scope='account' AND owner_id=$1
      AND template_id='mat:pgcheck-concurrency' AND quality='standard'`, [actor.id],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n7a2. GRAPH CRAFTING AND SALVAGE HOLD UNDER REAL ROW LOCKS');
// pg-mem needs an inverse log because its ROLLBACK is cosmetic, and it serializes item transactions
// because it has no row locks. This probe reaches the production half of the contract: native
// rollback, concurrent same/different logical keys, one car deletion, and one cash ledger debit.
{
  const { craft, salvageCar } = await import('../src/crafting.js');
  const { grantStack, inventoryBoard, withItemTransaction } = await import('../src/items.js');
  const tx = (action) => withItemTransaction(pool, action);
  const prefix = `pgcheck-crafting-${process.pid}-${Date.now()}`;
  const craftAccount = `${prefix}-cash-account`;
  const craftCharacter = `${prefix}-cash-character`;
  const salvageAccount = `${prefix}-car-account`;
  const salvageCharacter = `${prefix}-car-character`;
  const craftH = { accountId: craftAccount, owned: { cars: [] } };
  const salvageH = { accountId: salvageAccount, owned: { cars: [] } };
  const craftOwner = { scope: 'account', id: craftAccount };
  const salvageOwner = { scope: 'account', id: salvageAccount };
  const sameCar = `${prefix}-same-car`;
  const differentCar = `${prefix}-different-car`;
  const rollbackCar = `${prefix}-rollback-car`;
  const keys = [
    `${prefix}-craft-seed`, `${prefix}-craft-cap`, `${prefix}-craft-fail`,
    `${prefix}-craft-same`, `${prefix}-salvage-same`, `${prefix}-salvage-a`,
    `${prefix}-salvage-b`, `${prefix}-salvage-rollback`,
  ];
  const stackQty = (board, templateId) => Number(
    board.stacks.find((stack) => stack.templateId === templateId)?.qty || 0,
  );

  await pool.query(
    `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
     VALUES ($1,$2,$3,1,'foundry',10000,1000),
            ($4,$5,$6,1,'foundry',10000,1000)`,
    [craftCharacter, craftAccount, `${prefix}-cash`,
      salvageCharacter, salvageAccount, `${prefix}-car`],
  );
  await pool.query(
    `INSERT INTO cars (id,character_id,model_id,trim_id,dmg)
     VALUES ($1,$4,'junker','stock',10),
            ($2,$4,'junker','stock',20),
            ($3,$4,'junker','stock',30)`,
    [sameCar, differentCar, rollbackCar, salvageCharacter],
  );

  await tx((client) => grantStack(
    client, craftOwner, 'mat:scrap_steel', 4, 'standard', 'pgcheck craft seed', keys[0],
  ));
  await tx((client) => grantStack(
    client, craftOwner, 'mat:hardened_steel', 2147483647, 'standard',
    'pgcheck craft cap', keys[1],
  ));
  let lateCraftCode = '';
  try {
    await tx((client) => craft(
      client, craftH, 'recipe:hardened_steel', keys[2],
    ));
  } catch (error) { lateCraftCode = error.code; }
  let craftBoard = await inventoryBoard(pool, craftOwner);
  const failedCraftCash = Number((await pool.query(
    'SELECT cash FROM characters WHERE id=$1', [craftCharacter],
  )).rows[0].cash);
  const failedCraftLedger = Number((await pool.query(
    "SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1 AND reason='craft:recipe:hardened_steel'",
    [craftCharacter],
  )).rows[0].n);
  check(lateCraftCode === 'inventory_cap' && failedCraftCash === 1000
      && stackQty(craftBoard, 'mat:scrap_steel') === 4
      && stackQty(craftBoard, 'mat:hardened_steel') === 2147483647
      && failedCraftLedger === 0,
  'native rollback restores cash, input, capped output, and exact ledger state after late failure',
  `error ${lateCraftCode || 'none'}, cash ${failedCraftCash}, ledger ${failedCraftLedger}`);

  // Remove only the fixture cap so two real clients can contend on one character and logical key.
  await pool.query(
    `DELETE FROM item_stacks WHERE owner_scope='account' AND owner_id=$1
      AND template_id='mat:hardened_steel' AND quality='standard'`, [craftAccount],
  );
  const sameCraft = await Promise.all([
    tx((client) => craft(client, craftH, 'recipe:hardened_steel', keys[3])),
    tx((client) => craft(client, craftH, 'recipe:hardened_steel', keys[3])),
  ]);
  craftBoard = await inventoryBoard(pool, craftOwner);
  const craftCash = Number((await pool.query(
    'SELECT cash FROM characters WHERE id=$1', [craftCharacter],
  )).rows[0].cash);
  const craftLedger = Number((await pool.query(
    "SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1 AND currency='cash'"
      + " AND amount=-300 AND reason='craft:recipe:hardened_steel'",
    [craftCharacter],
  )).rows[0].n);
  check(JSON.stringify(sameCraft[0]) === JSON.stringify(sameCraft[1])
      && craftCash === 700 && craftLedger === 1
      && stackQty(craftBoard, 'mat:scrap_steel') === 0
      && stackQty(craftBoard, 'mat:hardened_steel') === 1,
  'competing same-key cash craft applies one debit, one ledger row, and one output',
  `cash ${craftCash}, ledger ${craftLedger}, hardened ${stackQty(craftBoard, 'mat:hardened_steel')}`);

  const sameSalvage = await Promise.all([
    tx((client) => salvageCar(
      client, salvageH, sameCar, 'recipe:car_salvage_basic', keys[4],
    )),
    tx((client) => salvageCar(
      client, salvageH, sameCar, 'recipe:car_salvage_basic', keys[4],
    )),
  ]);
  const differentSalvage = await Promise.allSettled([
    tx((client) => salvageCar(
      client, salvageH, differentCar, 'recipe:car_salvage_basic', keys[5],
    )),
    tx((client) => salvageCar(
      client, salvageH, differentCar, 'recipe:car_salvage_basic', keys[6],
    )),
  ]);
  let salvageBoard = await inventoryBoard(pool, salvageOwner);
  check(JSON.stringify(sameSalvage[0]) === JSON.stringify(sameSalvage[1])
      && Number((await pool.query('SELECT COUNT(*) AS n FROM cars WHERE id=$1', [sameCar])).rows[0].n) === 0,
  'competing same-key salvage deletes the locked car once and replays the exact result');
  check(differentSalvage.filter((result) => result.status === 'fulfilled').length === 1
      && differentSalvage.filter((result) => result.status === 'rejected'
        && result.reason?.code === 'no_car').length === 1
      && Number((await pool.query(
        'SELECT COUNT(*) AS n FROM cars WHERE id=$1', [differentCar],
      )).rows[0].n) === 0
      && stackQty(salvageBoard, 'mat:scrap_steel') === 12,
  'competing different-key salvage serializes on authority and cannot double-consume the car',
  `outcomes ${differentSalvage.map((result) => result.status === 'fulfilled'
    ? 'ok' : result.reason?.code).join(', ')}, scrap ${stackQty(salvageBoard, 'mat:scrap_steel')}`);

  // Force the second graph output to fail. Native PostgreSQL must put back both the car row and the
  // preceding scrap grant without relying on the pg-mem inverse log.
  await pool.query(
    `UPDATE item_stacks SET quantity=2147483647
      WHERE owner_scope='account' AND owner_id=$1
        AND template_id='mat:wire' AND quality='standard'`, [salvageAccount],
  );
  let rollbackCode = '';
  try {
    await tx((client) => salvageCar(
      client, salvageH, rollbackCar, 'recipe:car_salvage_basic', keys[7],
    ));
  } catch (error) { rollbackCode = error.code; }
  salvageBoard = await inventoryBoard(pool, salvageOwner);
  const rollbackGuard = Number((await pool.query(
    'SELECT COUNT(*) AS n FROM item_mutation_guards WHERE idempotency_key=$1', [keys[7]],
  )).rows[0].n);
  check(rollbackCode === 'inventory_cap'
      && Number((await pool.query('SELECT COUNT(*) AS n FROM cars WHERE id=$1', [rollbackCar])).rows[0].n) === 1
      && stackQty(salvageBoard, 'mat:scrap_steel') === 12
      && stackQty(salvageBoard, 'mat:wire') === 2147483647
      && rollbackGuard === 0,
  'native salvage rollback restores the car and every preceding output with no stranded guard',
  `error ${rollbackCode || 'none'}, scrap ${stackQty(salvageBoard, 'mat:scrap_steel')}, guard ${rollbackGuard}`);

  await pool.query('DELETE FROM item_events WHERE idempotency_key = ANY($1::text[])', [keys]);
  await pool.query('DELETE FROM item_mutation_guards WHERE idempotency_key = ANY($1::text[])', [keys]);
  await pool.query(
    `DELETE FROM item_stacks WHERE owner_scope='account' AND owner_id = ANY($1::text[])`,
    [[craftAccount, salvageAccount]],
  );
  await pool.query('DELETE FROM transactions WHERE character_id = ANY($1::text[])',
    [[craftCharacter, salvageCharacter]]);
  await pool.query('DELETE FROM cars WHERE id = ANY($1::text[])',
    [[sameCar, differentCar, rollbackCar]]);
  await pool.query('DELETE FROM characters WHERE id = ANY($1::text[])',
    [[craftCharacter, salvageCharacter]]);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n7a3. WORLD-GRAPH MYSTERIES HOLD UNDER REAL ROW LOCKS');
{
  const { runMysteryPgChecks } = await import('./pgcheck-mysteries.js');
  await runMysteryPgChecks({ pool, check });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n7a4. WORLD-GRAPH OPERATIONS HOLD UNDER REAL ROW LOCKS');
{
  const { runOperationPgChecks } = await import('./pgcheck-operations.js');
  await runOperationPgChecks({ pool, check });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n7a5. BELLADONNA VERTICAL SLICE HOLDS ON REAL POSTGRESQL');
{
  const { runBelladonnaPgChecks } = await import('./pgcheck-belladonna.js');
  await runBelladonnaPgChecks({ pool, check, nativePostgres: true });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n7b. THE BUILD BOOTS AGAINST A DATABASE OLDER THAN ITSELF');
// THE OUTAGE THIS PINS (2026-08-06): `CREATE TABLE IF NOT EXISTS` is a NO-OP on a live database, so
// three columns added INLINE to the already-existing `gang_members` never landed — and the very next
// statement, an index over one of them, crash-looped the container at boot. Every suite was green:
// they run on pg-mem, which always starts EMPTY, so the table is created WITH the new columns and
// the class is structurally invisible. §7 above cannot see it either, for the same reason one step
// removed — re-applying the CURRENT schema twice means the FIRST application already made the table
// right.
//
// TWO mechanisms stand between us and a repeat, and the mutation pair below establishes which is
// actually doing the work. schema.sql carries HAND-WRITTEN `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
// blocks per the discipline that outage taught; db.js then runs a DERIVED pass emitting one for
// every column of every CREATE TABLE, trusting nobody to remember. Measured: disable the deriver
// entirely and this check still passes — 0 statements, every column present — because the
// hand-written blocks currently cover the lot. So the deriver is not today's load-bearing half; it
// is the belt to that discipline's braces, and its whole value is the day somebody forgets.
//
// Which is exactly what this check is for, and it is guarded on that: add an inline-only column to a
// pre-existing table and, with the deriver intact, it lands (the deriver caught the omission); with
// the deriver removed the check FAILS naming `gang_members.zzprobe_only` and the outage class. Note
// what that pair means for the assertion's shape — it can only ever fire on the FUTURE forgotten
// ALTER, never on today's tree, so a green here is not "the deriver ran" but "nothing has been
// forgotten yet".
//
// So: apply the OLDEST schema.sql in the history — the shape a database that has existed since M1
// really has — and then boot the CURRENT build on top of it, which is what a deploy does.
{
  const { execSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const oldDb = `pgcheck_old_${process.pid}`;
  const swap = (u) => u.replace(/\/[^/?]+(\?|$)/, `/${oldDb}$1`);
  let ok = true; let err = ''; let added = 0;
  try {
    const first = execSync('git log --format=%H -- schema.sql', { cwd: ROOT }).toString().trim().split('\n').pop();
    const oldSchema = execSync(`git show ${first}:schema.sql`, { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }).toString();
    // CREATE DATABASE cannot run inside a transaction, so it goes through the live pool directly
    await pool.query(`DROP DATABASE IF EXISTS ${oldDb}`);
    await pool.query(`CREATE DATABASE ${oldDb}`);
    // now boot the current build against it, exactly as a deploy would
    const before = process.env.DATABASE_URL;
    process.env.DATABASE_URL = swap(before);
    // the database as it stood at the first commit — applied raw, so it is genuinely the OLD shape
    // and not something the current build has already had a chance to fix
    const { default: pg } = await import('pg');
    const legacy = new pg.Pool({ connectionString: swap(before) });
    await legacy.query(oldSchema);
    await legacy.end();
    const mod = await import(`../src/db.js?old=${process.pid}`);
    const p3 = await mod.makeDb();
    // THE ASSERTION, and why it is shaped this way. Not "the outage column is present": this
    // repository's history begins AFTER that fix, so `gang_members.post` is in every historical
    // schema and naming it is an assertion that cannot fail. And not a hand-parse of schema.sql
    // either — the first attempt did exactly that and reported 17 phantom missing columns, because
    // a one-line table (`stakes_state`) has no `\n);` terminator so the match ran on into its
    // neighbour and stole its columns.
    //
    // So compare two DATABASES, and parse nothing: whatever this build produces on an EMPTY database
    // is the reference, and an UPGRADED one must be a superset of it. Independent of any parser, and
    // it cannot be satisfied by the deriver and the check making the same mistake together — the
    // reference is produced by CREATE TABLE, the subject by ALTER, so they share no code path.
    const COLS = "SELECT table_name||'.'||column_name k FROM information_schema.columns WHERE table_schema='public'";
    const fresh = new Set((await pool.query(COLS)).rows.map((r) => r.k));       // this build, on the pgcheck db
    const upgraded = new Set((await p3.query(COLS)).rows.map((r) => r.k));      // this build, on the OLD db
    const missing = [...fresh].filter((k) => !upgraded.has(k)).sort();
    added = upgraded.size;
    if (missing.length) {
      ok = false;
      err = `${missing.length} declared column(s) never landed on the upgraded database — the 2026-08-06 `
        + `outage class is live again: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''}`;
    }
    await p3.end();
    process.env.DATABASE_URL = before;
  } catch (e) { ok = false; err = e.message; }
  try { await pool.query(`DROP DATABASE IF EXISTS ${oldDb}`); } catch { /* best effort */ }
  check(ok, `the current build boots against the ORIGINAL schema (${added} columns present after migration)`, err);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n8. A READ DOES NOT WAIT FOR THE WRITE LOCK (D1)');
// The whole point of the lock-free read path, and a property pg-mem cannot express: it has no real
// row locks, so on the suites a read "not blocking" is true whether or not the code takes the lock.
// Here a second session holds SELECT … FOR UPDATE on the player's own character row — exactly what a
// concurrent action does — and the read must still answer. Before D1 it would have queued behind it
// (production measured 1.0s/2.1s/2.3s/4.3s waits) and, past the pool's lock_timeout, failed outright.
{
  const cid = (await call('GET', '/v1/me', { token })).body.character.id;
  // section 5 left them in a cell; the write below must be refused by the LOCK, not by the jail gate
  await pool.query('UPDATE characters SET jail_until = NULL, nerve = 20 WHERE id=$1', [cid]);
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [cid]);

    const t0 = Date.now();
    const me = await call('GET', '/v1/me', { token });
    const ms = Date.now() - t0;
    check(me.code === 200, 'a read answers while another session holds the row lock', `got ${me.code}`);
    // the pool's lock_timeout is the floor a blocked read would have hit; well under it means it
    // never queued at all rather than merely getting lucky.
    const lockMs = Number((await pool.query("SELECT setting FROM pg_settings WHERE name='lock_timeout'")).rows[0].setting);
    check(ms < Math.max(500, lockMs / 4), 'and answers promptly — it never queued on the lock',
      `took ${ms}ms, lock_timeout ${lockMs}ms`);

    // The board routes moved onto the same path, and answering at all while the row is locked is
    // itself the proof that the lock-free branch is the one being taken — a delegated read would be
    // sitting in the queue behind this holder, not returning.
    for (const url of ['/v1/skills', '/v1/law', '/v1/wire', '/v1/estate', '/v1/world']) {
      const t = Date.now();
      const r = await call('GET', url, { token });
      check(r.code === 200 && Date.now() - t < Math.max(500, lockMs / 4),
        `${url} answers without the lock`, `got ${r.code} in ${Date.now() - t}ms`);
    }

    // the contrast that proves the lock is genuinely held: a WRITE against the same row does wait,
    // and gives up on the pool's own lock_timeout rather than hanging forever.
    const t1 = Date.now();
    const act = await call('POST', '/v1/crimes/pick', { token, body: {} });
    const actMs = Date.now() - t1;
    check(act.code !== 200, 'a write against the same locked row is refused, not served', `got ${act.code}`);
    check(actMs >= lockMs * 0.5, 'and it waited on the lock before giving up', `waited ${actMs}ms`);
  } finally {
    await holder.query('ROLLBACK').catch(() => {});
    holder.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE VAULT (src/treasury.js) is the only rail that allocates REAL ETH, and its wall —
// `allocated <= held` — rests on a txn-scoped advisory lock, because two claims must not both read
// the same `available` and together allocate past what the treasury holds. pg-mem is single-caller,
// so the suite can only exercise the arithmetic; this is the serialization half.
//
// It is tested by HOLDING the lock, not by racing two requests. A first attempt did fire two
// concurrent claims and assert the wall held — and it passed with the lock DELETED, because two
// in-process injects simply never overlapped in the tiny read→write window. Timing luck reads
// exactly like a proof. Holding the lock from outside tests the actual claim, on demand.
console.log('\n9. THE VAULT SERIALIZES ON ITS ADVISORY LOCK');
{
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', { token, body: { name: `Vault ${Date.now() % 100000}` } });
  const me = (await call('GET', '/v1/me', { token })).body.character;
  const acct = (await pool.query('SELECT account_id a FROM characters WHERE id=$1', [me.id])).rows[0].a;
  await pool.query('UPDATE account_persistent SET minted=true, omr=100000 WHERE account_id=$1', [acct]);
  await pool.query("INSERT INTO rwa_revenue (source, ref, rwa_eth) VALUES ('tax',$1,1.0)", [`pgcheck-${Date.now()}`]);
  await pool.query(`INSERT INTO vig_buyback (id, eth_spent, omr_bought, price_omr_per_eth, to_reserve, to_prize)
    VALUES ($1, 0, 0, 5000, 0, 0)`, [`pgcheck-price-${Date.now()}`]);
  const lockMs = Number((await pool.query("SELECT setting FROM pg_settings WHERE name='lock_timeout'")).rows[0].setting);
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT pg_advisory_xact_lock($1)', [0x45544856]); // 'ETHV' — the vault's key
    const t0 = Date.now();
    const blocked = await call('POST', '/v1/vault/claim', { token, body: { omr: TREASURY.CLAIM_MIN_OMR } });
    const ms = Date.now() - t0;
    check(blocked.code !== 200, 'a claim is NOT served while another holds the vault lock', `got ${blocked.code}`);
    check(ms >= lockMs * 0.5, 'and it waited on the lock rather than failing instantly', `waited ${ms}ms`);
  } finally { await holder.query('ROLLBACK').catch(() => {}); holder.release(); }
  const served = await call('POST', '/v1/vault/claim', { token, body: { omr: TREASURY.CLAIM_MIN_OMR } });
  check(served.code === 200, 'and the claim goes through once the lock is released', `got ${served.code} ${served.body?.error || ''}`);
  const held = Number((await pool.query('SELECT COALESCE(SUM(rwa_eth),0) s FROM rwa_revenue')).rows[0].s);
  const alloc = Number((await pool.query('SELECT COALESCE(SUM(eth),0) s FROM eth_vault')).rows[0].s);
  check(alloc <= held + 1e-9, 'allocated <= held (ETH) — the vault never owes what it does not hold',
    `allocated ${alloc} vs held ${held}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DEATH RACE. Found by playing: get killed with the tab open and the very next request comes
// back `400 no_character — "Create a character first."` to a player whose heir is standing there.
// It is READ COMMITTED, not logic: a `SELECT … AND alive FOR UPDATE` that BLOCKS on the dying row
// re-evaluates its WHERE against the NEW row version when the killer commits — `alive` is now false
// so the row drops out — and the heir INSERTed by that same commit is not in this statement's
// snapshot either. Zero rows. It lies in the way this codebase has corrected three times already
// (db_down, the blanket 4xx→500, this): an ordinary game state reported as a broken one, on the one
// path where the client renders any non-2xx as THE LINE'S DEAD.
//
// pg-mem is single-caller, so no suite can reach this — which is exactly why it belongs here. And
// like §9 it is driven by HOLDING the row rather than by racing a real kill: a race would depend on
// two in-process injects overlapping inside a millisecond-wide window, and timing luck reads exactly
// like a proof. The holder does what runEstate does — alive=false plus the heir, one atomic commit —
// while the victim's own request sits blocked on that row.
console.log('\n9b. A REQUEST IN FLIGHT WHEN THE STREET ENDS IS SERVED THE HEIR');
{
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', { token, body: { name: `Racer ${Date.now() % 100000}` } });
  const me = (await call('GET', '/v1/me', { token })).body.character;
  const acct = (await pool.query('SELECT account_id a FROM characters WHERE id=$1', [me.id])).rows[0].a;
  // force the read down the LOCKING path: readCharacter only falls through to withCharacter when
  // accrual moved, and withCharacterRead's single unlocked statement is atomic by construction.
  await pool.query("UPDATE characters SET last_accrued_at = now() - interval '2 hours' WHERE id=$1", [me.id]);

  const holder = await pool.connect();
  let inflight;
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [me.id]);
    inflight = call('GET', '/v1/me', { token });          // blocks on the row the holder owns
    await new Promise((r) => setTimeout(r, 400));
    await holder.query('UPDATE characters SET alive=false WHERE id=$1', [me.id]);
    await holder.query(
      `INSERT INTO characters (id, account_id, name, generation, season, cash, minted, honor, is_npc, npc_seed)
       SELECT $2, account_id, name, generation+1, season, 4400, minted, 0, is_npc, npc_seed
       FROM characters WHERE id=$1`, [me.id, `pgcheck-heir-${Date.now()}`]);
    await holder.query('COMMIT');
  } catch (e) { await holder.query('ROLLBACK').catch(() => {}); throw e; } finally { holder.release(); }

  const r = await inflight;
  const living = Number((await pool.query('SELECT count(*) n FROM characters WHERE account_id=$1 AND alive', [acct])).rows[0].n);
  check(living === 1, 'the heir really is standing there', `${living} living characters`);
  check(r.code === 200, 'a request that blocked on the dying row is NOT told to create a character',
    `got ${r.code} ${r.body?.error || ''} — "${r.body?.message || ''}"`);
  check(r.body?.character?.generation === me.generation + 1, 'and it is served the HEIR, not a corpse',
    `generation ${r.body?.character?.generation} (was ${me.generation})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE QUERY EVERY AUTHED REQUEST RUNS. `withCharacter`/`readCharacter` open with
// `WHERE account_id = $1 AND alive` — §7.1 lazy accrual makes even a READ take it — and 78 further
// sites in src/ look a character up by account. It was a SEQUENTIAL SCAN: measured on real Postgres,
// 0.62ms and 144 buffers at 3,000 players, 16.9ms and 2,382 buffers at 50,000, paid PER REQUEST, so
// the server-wide total is quadratic in the playerbase exactly like the standing scan was.
//
// THIS HAS TO BE BEHAVIOURAL AND IT HAS TO BE HERE. A text check that schema.sql contains the CREATE
// INDEX line proves nothing about the planner, and pg-mem has a different one — the same reason
// tools/boardcost.js refuses to run without real Postgres.
//
// AND IT HAS TO BE SEEDED, or it is vacuous in the worst way: on a small table a sequential scan is
// the CORRECT plan, so on pgcheck's own handful of rows the check would fail with the index present
// and "pass" for reasons that have nothing to do with the index existing. So it seeds past the point
// where the planner would ever choose one, and ASSERTS that it did — a guard that cannot tell a
// present index from an absent one reads exactly like a clean bill of health.
console.log('\n9c. THE REQUEST WRAPPER DOES NOT SCAN');
{
  await pool.query(`INSERT INTO accounts (id, auth_provider, auth_subject)
    SELECT gen_random_uuid(), 'guest', 'pgcheck-scan-' || g FROM generate_series(1, 5000) g`);
  await pool.query(`INSERT INTO characters (id, account_id, name, respect, cash, loc, season)
    SELECT gen_random_uuid(), id, 'ScanProbe ' || substr(id::text, 1, 12), 0, 0, 'docks', 1
      FROM accounts WHERE auth_subject LIKE 'pgcheck-scan-%'`);
  await pool.query('ANALYZE characters');

  const n = Number((await pool.query('SELECT count(*) n FROM characters')).rows[0].n);
  const one = (await pool.query('SELECT account_id FROM characters LIMIT 1')).rows[0].account_id;
  const plan = (await pool.query(
    'EXPLAIN SELECT * FROM characters WHERE account_id = $1 AND alive', [one]))
    .rows.map((r) => r['QUERY PLAN']).join('\n');

  // the non-vacuity half: with too few rows a seq scan is right and the check below means nothing.
  check(n >= 5000, 'the table is big enough that a scan would be the WRONG plan', `only ${n} characters`);
  check(!/Seq Scan on characters/.test(plan),
    'the per-request character lookup uses an index, not a full scan',
    `the planner chose a sequential scan:\n      ${plan.replace(/\n/g, '\n      ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// The tick prunes nine growing tables on a wall-clock window, hourly, forever. Eight of the nine had no
// index leading with the filtered column, so each sweep read the WHOLE table to delete a constant small
// tail — 186ms against 1.1ms at a million telemetry rows, and the gap widens for the life of the server.
// Behavioural on purpose, for §9c's reason: a text check that schema.sql contains the CREATE INDEX line
// proves nothing about the planner, and pg-mem has a different one. Seeded first, because on a small
// table a sequential scan is the CORRECT plan and the check would then pass for reasons having nothing
// to do with the index. The three bounded-by-construction tables (oauth_states, vendettas, gala_guests)
// are deliberately absent — see schema.sql at the indexes for why an index there would cost writes for
// nothing.
console.log('\n9d. THE RETENTION SWEEPS DO NOT SCAN');
{
  const RETENTION = [
    ['telemetry', 'at', `INSERT INTO telemetry (id, event, props, at)
       SELECT md5('pgr'||g::text), 'crime', '{}', now() - (random() * interval '3 days') FROM generate_series(1,5000) g`],
    ['chat_messages', 'at', `INSERT INTO chat_messages (id, channel, character_id, name, body, at)
       SELECT md5('pgr'||g::text), 'city', (SELECT id FROM characters LIMIT 1), 'n', 'b',
              now() - (random() * interval '3 days') FROM generate_series(1,5000) g`],
    ['dm_messages', 'at', `INSERT INTO dm_messages (id, from_account, to_account, from_name, to_name, body, at)
       SELECT md5('pgr'||g::text), gen_random_uuid(), gen_random_uuid(), 'a', 'b', 'c',
              now() - (random() * interval '3 days') FROM generate_series(1,5000) g`],
    ['duels', 'at', `INSERT INTO duels (id, account_a, account_b, winner_account, day, at)
       SELECT md5('pgr'||g::text), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1,
              now() - (random() * interval '3 days') FROM generate_series(1,5000) g`],
    ['idempotency', 'created_at', `INSERT INTO idempotency (account_id, key, status, body_hash, response, created_at)
       SELECT 'pgr', md5('pgr'||g::text), 1, 'h', '{}', now() - (random() * interval '3 days') FROM generate_series(1,5000) g`],
    ['event_results', 'resolved_at', `INSERT INTO event_results (id, kind, icon, headline, resolved_at)
       SELECT md5('pgr'||g::text), 'k', 'i', 'h', now() - (random() * interval '3 days') FROM generate_series(1,5000) g`],
  ];
  for (const [table, col, seed] of RETENTION) {
    await pool.query(seed);
    await pool.query(`ANALYZE ${table}`);
    const n = Number((await pool.query(`SELECT count(*) n FROM ${table}`)).rows[0].n);
    // the cutoff is PAST every seeded row on purpose: a sweep in its steady state deletes a small tail,
    // and a filter matching most of the table would make a seq scan the right plan again.
    const plan = (await pool.query(
      `EXPLAIN DELETE FROM ${table} WHERE ${col} < now() - interval '30 days'`))
      .rows.map((r) => r['QUERY PLAN']).join('\n');
    check(n >= 5000, `${table} is big enough that a scan would be the WRONG plan`, `only ${n} rows`);
    check(!new RegExp(`Seq Scan on ${table}`).test(plan),
      `the ${table} retention sweep uses an index on ${col}, not a full scan`,
      `the planner chose a sequential scan:\n      ${plan.replace(/\n/g, '\n      ')}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ESTATE AND THE SWEEP TAKE THE SAME TWO ROWS IN OPPOSITE ORDERS. Two comments in
// src/social/contracts.js describe the lock order and they contradict each other:
//
//   refundPot            "The caller must already hold the pot row lock; everyone locks the
//                         pot BEFORE funder rows (stable order)."
//   sweepExpiredBounties "funder character rows locked in sorted order BEFORE the pot row — the
//                         global lock order every player path follows (characters → pots → gangs)."
//
// The sweep's claim is false for FUNDER rows specifically: a player path holds the ACTOR's row
// before the pot, then takes the FUNDERS after it. So `postBounty` on a lapsed pot holds the pot
// and wants a funder while `sweepExpiredBounties` (and `runEstate`, which reaches third-party
// character rows through refundPot while holding a bounty row) holds that funder and wants the pot.
// A real cycle, and the whole point is that THE LOCK LEDGER cannot see it: the acquisition lives
// inside a function the transaction CALLS, and the distinguishing feature is WHOSE row, not which
// table — so a green ledger is compatible with this being live, which is why it is measured here.
//
// The remedy has been asserted and never driven: 40P01 → a retryable `contention`, the sweep's per-pot
// catch leaving the pot for the next tick, and the aborted transaction rolling back whole so the escrow
// cannot half-resolve. pg-mem is single-caller, so no suite can reach any of it.
//
// The remedy is DOUBLE-NETTED, which is measured rather than assumed and is not what the first cut of
// this comment claimed. `withCharacter`'s own catch (game.js:1105) maps it, AND server.js's error
// handler maps whatever escapes; neutering EITHER one alone leaves every assertion below green, so the
// only honest mutation for the two lines under it is to take both down at once. That survival is a
// claim about the test before it is a claim about the code — here it corrected the layer this very
// comment named — and it is also the property worth knowing: the route is covered twice over.
//
// Driven by HOLDING the funder row rather than by racing a real sweep — §9's reason: a race depends
// on two backends overlapping inside a millisecond-wide window and timing luck reads exactly like a
// proof. The victim IS deterministic: Postgres aborts the backend whose deadlock_timeout (1s) expires
// first, which is whoever started waiting first, and the player is made to wait a full second before
// the holder closes the cycle.
console.log('\n9e. THE POT/FUNDER CYCLE LANDS AS CONTENTION, NEVER A 500');
{
  const { sweepExpiredBounties } = await import('../src/social/contracts.js');
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const { M3 } = await import('../src/rules.js');
  const escrowDrift = async () => {
    const inv = await runLedgerInvariants(pool, { alert: false });
    return inv.checks.find((c) => c.name === 'bounty escrow')?.drift;
  };

  const mk = async (label) => {
    const { body: { token } } = await call('POST', '/v1/auth/guest');
    await call('POST', '/v1/character', { token, body: { name: `${label} ${Date.now() % 1000000}` } });
    const me = (await call('GET', '/v1/me', { token })).body.character;
    await pool.query('UPDATE characters SET cash=$2 WHERE id=$1', [me.id, 5_000_000]);
    return { token, id: me.id };
  };
  const mark = await mk('Mark');
  const funder = await mk('Funder');
  const poster = await mk('Poster');
  const cashOf = async (id) => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash);

  const stake = M3.BOUNTY_MIN * 4;
  const drift0 = await escrowDrift();
  // pg_stat_database.deadlocks is the ONLY place a real deadlock is visible — the codebase maps 40P01
  // to `contention` deliberately, and so is `lock_timeout` (55P03, the 8s pool valve), so the 400
  // alone cannot tell a deadlock from a slow queue. This section's whole claim is about the CYCLE, so
  // the mechanism is asserted rather than inferred from the elapsed time.
  const deadlockCount = async () => Number((await pool.query(
    'SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()')).rows[0]?.deadlocks || 0);
  const deadlocks0 = await deadlockCount();
  const posted = await call('POST', `/v1/streets/${mark.id}/bounty`, { token: funder.token, body: { amount: stake, kind: 'kill' } });
  check(posted.code === 200, 'a pot with a third-party funder is on the board',
    `got ${posted.code} ${posted.body?.error || ''}`);
  // lapse it: an EXPIRED-but-unswept pot is what sends postBounty down the refundPot path, and it is
  // the same pot the sweep is coming for — the two paths meeting on one row is the whole cycle.
  await pool.query("UPDATE bounties SET expires_at = now() - interval '1 hour' WHERE target_character=$1 AND kind='kill'", [mark.id]);
  const funderCashBefore = await cashOf(funder.id);

  const holder = await pool.connect();
  let inflight, holderTook = null, raced = null;
  try {
    await holder.query('BEGIN');
    // exactly what sweepExpiredBounties (and runEstate, through refundPot) does first: the funder's row.
    await holder.query('SELECT 1 FROM characters WHERE id=$1 FOR UPDATE', [funder.id]);
    // the poster takes the pot, then blocks reaching the funder inside refundPot.
    inflight = call('POST', `/v1/streets/${mark.id}/bounty`, { token: poster.token, body: { amount: stake, kind: 'kill' } });
    await new Promise((r) => setTimeout(r, 1000));   // > deadlock_timeout, so the player's timer fires first
    // close the cycle: we hold the funder and now want the pot the player is holding.
    holderTook = holder.query('SELECT 1 FROM bounties WHERE target_character=$1 AND kind=$2 FOR UPDATE', [mark.id, 'kill'])
      .then(() => null, (e) => e);
    raced = await inflight;
    await holderTook;
  } finally { await holder.query('ROLLBACK').catch(() => {}); holder.release(); }

  check(raced.code !== 500, 'the player is NOT told the server broke',
    `got ${raced.code} ${raced.body?.error || ''} — "${raced.body?.message || ''}"`);
  check(raced.code === 400 && raced.body?.error === 'contention',
    'a deadlocked contract post comes back as a retryable contention',
    `got ${raced.code} ${raced.body?.error || ''}`);
  check((await deadlockCount()) > deadlocks0, 'and it was the CYCLE, not the lock_timeout valve',
    'pg_stat_database.deadlocks did not move — a 55P03 maps to `contention` too, so this ran but proved'
    + ' nothing about the pot/funder cycle');

  // the aborted transaction rolled back WHOLE: the escrow is untouched, so the pot cannot have
  // half-resolved (a partial refund with the pot still standing is the drift this guards).
  const stillThere = (await pool.query("SELECT amount FROM bounties WHERE target_character=$1 AND kind='kill'", [mark.id])).rows[0];
  check(!!stillThere && Number(stillThere.amount) === stake, 'the pot survived the deadlock intact',
    stillThere ? `amount ${stillThere.amount} vs ${stake}` : 'the pot is gone');
  check((await cashOf(funder.id)) === funderCashBefore, 'and the funder was not part-refunded',
    `cash moved by ${(await cashOf(funder.id)) - funderCashBefore}`);

  // the worker side self-heals on its next tick — the pot the deadlock left standing is settled.
  const swept = await sweepExpiredBounties(pool);
  check(Number(swept?.refunded || 0) === stake, 'the next sweep tick settles the pot the deadlock left',
    `refunded ${swept?.refunded}`);
  const gone = (await pool.query("SELECT 1 FROM bounties WHERE target_character=$1 AND kind='kill'", [mark.id])).rowCount;
  check(gone === 0 && (await cashOf(funder.id)) === funderCashBefore + stake,
    'and the funder is made whole exactly once', `pot rows ${gone}, cash +${(await cashOf(funder.id)) - funderCashBefore}`);
  const resolutions = (await pool.query(
    "SELECT reason FROM transactions WHERE counterparty=$1 AND reason IN ('bounty:refund','death:bounty')", [mark.id])).rows;
  check(resolutions.length === 1 && resolutions[0].reason === 'bounty:refund',
    'the pot resolved ONCE — it cannot both refund and burn',
    resolutions.map((r) => r.reason).join(', ') || 'nothing resolved it');
  check((await escrowDrift()) === drift0, 'the bounty escrow identity is where it started',
    `drift ${await escrowDrift()} vs ${drift0}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// §9e proved ONE instance of the class THE LOCK LEDGER structurally cannot see: a helper that
// acquires a THIRD-PARTY `characters` row while its caller already holds an escrow row. The ledger
// is blind to it twice over — the acquisition lives inside a function the transaction CALLS (a
// per-transaction text scan never reaches it), and the distinguishing feature is WHOSE row rather
// than which table. So a green ledger is compatible with the cycle being live, which is why it has
// to be driven.
//
// Enumerating the class across `src/` (every function holding an escrow row FOR UPDATE, split on
// whether the escrow lock or the character acquisition comes first) turned up six candidate tables.
// Four DISSOLVED on reading: residentEnterTournament/residentEnterStakes/residentEnterGrandPrix/
// residentNominateFuturity all write `r.id` — the resident's OWN row, which runResidentBehaviour
// already holds FOR UPDATE before calling them (population.js:815). Not third-party acquisitions.
//
// Two survived, and MARKET_LISTINGS is the one driven here because its inverted holder is reachable
// from a PLAYER ROUTE rather than only from the estate:
//   ESCROW→chars   cancelListing (market.js:336, POST /v1/market/:id/cancel) — holds the listing
//                  FOR UPDATE, then `UPDATE characters SET cash` on l.bidder (a third party)
//                  voidListingsAtDeath (market.js:599, runEstate) — same shape, estate-only
//   chars→ESCROW   bidListing (118) / buyListing (262) / sweepMarket (514) — every one locks the
//                  counterparty character rows FIRST, sorted, then the listing. sweepMarket says so
//                  in its own header: "counterparty characters sorted FOR UPDATE → the listing".
// The other survivor is BOXING_BOUTS (cancelBout 441 ↔ resolveMainEvent 479), whose inverted holder
// is reachable ONLY through runEstate — resolveMainEvent's own comment claims no AB-BA and is right
// about a live bettor and wrong about the estate path, the same "right about itself, wrong about its
// sibling" shape as refundPot/sweepExpiredBounties. Same remedy, same double net; not driven twice.
console.log('\n9f. THE LISTING/BIDDER CYCLE LANDS AS CONTENTION, NEVER A 500');
{
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const { BLACK_MARKET } = await import('../src/rules.js');
  const escrowDrift = async () => {
    const inv = await runLedgerInvariants(pool, { alert: false });
    return inv.checks.find((c) => c.name === 'market escrow')?.drift;
  };
  const mkm = async (label) => {
    const { body: { token } } = await call('POST', '/v1/auth/guest');
    await call('POST', '/v1/character', { token, body: { name: `${label} ${Date.now() % 1000000}` } });
    const me = (await call('GET', '/v1/me', { token })).body.character;
    await pool.query('UPDATE characters SET cash=$2 WHERE id=$1', [me.id, 5_000_000]);
    return { token, id: me.id };
  };
  const seller = await mkm('Seller');
  const bidder = await mkm('Bidder');
  const cashOfM = async (id) => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash);

  const carId = 'pgcheck9f-' + Date.now();
  await pool.query('INSERT INTO cars (id, character_id, model_id, trim_id) VALUES ($1,$2,$3,$4)',
    [carId, seller.id, 'junker', 'stock']);

  const drift0m = await escrowDrift();
  const bid = BLACK_MARKET.MIN_PRICE * 10;
  // A standing bid normally BLOCKS a cancel — the hammer decides. The one exception (audit #5) is a
  // bid that can never clear an unmet hidden reserve, which was only ever a lock on the seller's
  // iron: that one the seller may pull out from under, refunding the bidder. That refund is the
  // third-party character acquisition, so a reserved lot is what puts cancelListing on this path.
  const listed = await call('POST', '/v1/market', { token: seller.token,
    body: { carId, minBid: BLACK_MARKET.MIN_PRICE, reserve: bid * 10 } });
  const listingId = listed.body?.id;
  const placed = listingId
    ? await call('POST', `/v1/market/${listingId}/bid`, { token: bidder.token, body: { amount: bid } })
    : { code: 0 };
  check(listed.code === 200 && placed.code === 200,
    'a lot with a third-party bid under an unmet reserve is on the block',
    `list ${listed.code} ${listed.body?.error || ''} / bid ${placed.code} ${placed.body?.error || ''}`);

  const bidderCashBefore = await cashOfM(bidder.id);
  const deadlockCountM = async () => Number((await pool.query(
    'SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()')).rows[0]?.deadlocks || 0);
  const deadlocks0m = await deadlockCountM();

  const holderM = await pool.connect();
  let inflightM, raced2 = null, holderTook2 = null;
  try {
    await holderM.query('BEGIN');
    // exactly what bidListing/buyListing/sweepMarket do FIRST: the counterparty's character row.
    await holderM.query('SELECT 1 FROM characters WHERE id=$1 FOR UPDATE', [bidder.id]);
    // the seller takes the listing, then blocks reaching the bidder to refund them.
    inflightM = call('POST', `/v1/market/${listingId}/cancel`, { token: seller.token });
    await new Promise((r) => setTimeout(r, 1000));   // > deadlock_timeout, so the player's timer fires first
    // close the cycle: we hold the bidder and now want the listing the player is holding.
    holderTook2 = holderM.query('SELECT 1 FROM market_listings WHERE id=$1 FOR UPDATE', [listingId])
      .then(() => null, (e) => e);
    raced2 = await inflightM;
    await holderTook2;
  } finally { await holderM.query('ROLLBACK').catch(() => {}); holderM.release(); }

  check(raced2.code !== 500, 'the seller is NOT told the server broke',
    `got ${raced2.code} ${raced2.body?.error || ''} — "${raced2.body?.message || ''}"`);
  check(raced2.code === 400 && raced2.body?.error === 'contention',
    'a deadlocked cancel comes back as a retryable contention',
    `got ${raced2.code} ${raced2.body?.error || ''}`);
  check((await deadlockCountM()) > deadlocks0m, 'and it was the CYCLE, not the lock_timeout valve',
    'pg_stat_database.deadlocks did not move — a 55P03 maps to `contention` too, so this ran but proved'
    + ' nothing about the listing/bidder cycle');

  // the aborted transaction rolled back WHOLE: a half-cancelled lot (bidder refunded, listing still
  // live) is the drift this guards, and an unlisted car under a live listing is the ownership half.
  const still = (await pool.query('SELECT status, bidder, bid FROM market_listings WHERE id=$1', [listingId])).rows[0];
  check(still && still.status === 'live' && still.bidder === bidder.id && Number(still.bid) === bid,
    'the lot survived the deadlock intact',
    still ? `status ${still.status}, bid ${still.bid}` : 'the listing is gone');
  check((await cashOfM(bidder.id)) === bidderCashBefore, 'and the bidder was not part-refunded',
    `cash moved by ${(await cashOfM(bidder.id)) - bidderCashBefore}`);
  const carRow = (await pool.query('SELECT listed FROM cars WHERE id=$1', [carId])).rows[0];
  check(carRow?.listed === true, 'and the iron is still on the block',
    `cars.listed = ${carRow?.listed}`);

  // the player's own remedy works: `contention` says retry, so retrying must actually settle it.
  const retry = await call('POST', `/v1/market/${listingId}/cancel`, { token: seller.token });
  check(retry.code === 200, 'the retry the contention asked for goes through',
    `got ${retry.code} ${retry.body?.error || ''}`);
  const refunds = (await pool.query(
    "SELECT amount FROM transactions WHERE character_id=$1 AND reason='market:refund'", [bidder.id])).rows;
  check(refunds.length === 1 && Number(refunds[0].amount) === bid
    && (await cashOfM(bidder.id)) === bidderCashBefore + bid,
    'and the bidder is made whole exactly once',
    `${refunds.length} refund rows, cash +${(await cashOfM(bidder.id)) - bidderCashBefore}`);
  check((await escrowDrift()) === drift0m, 'the market escrow identity is where it started',
    `drift ${await escrowDrift()} vs ${drift0m}`);
}
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n10. NO node-pg DEPRECATIONS');
await app.close();
await new Promise((r) => setTimeout(r, 200));                // let any late warning land
check(deprecations.length === 0, 'no deprecated driver usage',
  [...new Set(deprecations)].join(' | '));

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${pass.length} passed, ${fails.length} failed`);
if (fails.length) {
  console.error('\nreal-Postgres failures (invisible to the pg-mem suites):');
  for (const f of fails) console.error('  • ' + f);
  process.exit(1);
}
// The summary must not claim what was skipped. Saying "the ledger holds" after §6 declined to run is
// exactly the overclaim this harness keeps catching elsewhere.
console.log(`✅ pgcheck passed — the loop, the locks, the safety valves, ${preExistingChars > 0
  ? 'the migration and the lock-free read path hold on real Postgres. THE LEDGER LEG WAS SKIPPED (this database was not fresh) — re-run against an empty database to check it'
  : 'the ledger, the migration and the lock-free read path all hold on real Postgres'}.`);
process.exit(0);
