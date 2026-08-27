// ENGAGEMENT + RETENTION test (the 55th suite) — guards src/engagement.js.
//
// The thing that would quietly break this report is catalog drift: someone adds a system, its
// `track()` events are not in SYSTEMS, and the dashboard reports the new system as DEAD forever
// while its events pile up unread. That is worse than no report, because "nobody uses this" is a
// claim the founder would act on. So the first and most important assertion here is TOTAL COVERAGE
// of every track() event name in src/ — the KNOWN_REASONS discipline.
process.env.MOD_KEY = 'test-mod-key';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { buildServer } from '../src/server.js';
import { opsEngagement, SYSTEMS, NON_ENGAGEMENT } from '../src/engagement.js';
import { PATH_QUIZ_QUESTIONS } from '../src/path-funnel.js';

// ── (1) the catalog covers src/, exactly ────────────────────────────────────────────────────────
// Read the real track() call sites rather than a hand-list, so this cannot drift from the code.
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out); else if (f.endsWith('.js')) out.push(f);
  }
  return out;
};
const emitted = new Set();
for (const f of walk('src')) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/track\([^,]+,[^,]+,\s*'([a-z_]+)'/g)) emitted.add(m[1]);
}
assert(emitted.size >= 130, `expected 130+ distinct track() events in src/, found ${emitted.size} — the reader regex broke`);

const claimed = new Map();
for (const [sys, evs] of Object.entries(SYSTEMS)) {
  for (const e of evs) {
    assert(!claimed.has(e), `event '${e}' is claimed by two systems: ${claimed.get(e)} and ${sys}`);
    claimed.set(e, sys);
  }
}
for (const e of NON_ENGAGEMENT) {
  assert(!claimed.has(e), `'${e}' is both a system event and declared non-engagement`);
  claimed.set(e, '(non-engagement)');
}

const unclaimed = [...emitted].filter((e) => !claimed.has(e)).sort();
assert.equal(unclaimed.length, 0,
  `${unclaimed.length} telemetry events are emitted by src/ but claimed by no system, so they would be `
  + `invisible in the engagement report and their systems would read as DEAD: ${unclaimed.join(', ')}\n`
  + '  → add each to SYSTEMS in src/engagement.js, or to NON_ENGAGEMENT if it is not player engagement.');

const phantom = [...claimed.keys()].filter((e) => !emitted.has(e)).sort();
assert.equal(phantom.length, 0,
  `${phantom.length} catalogued events are emitted nowhere in src/ — a rename left the catalog `
  + `pointing at nothing, so that system will read as dead forever: ${phantom.join(', ')}`);
console.log(`✓ catalog: all ${emitted.size} track() events in src/ are claimed by exactly one of `
  + `${Object.keys(SYSTEMS).length} systems (or declared non-engagement); no phantoms`);

// ── (2) the report reads a real database ────────────────────────────────────────────────────────
const app = await buildServer();
const pool = app.pool;
const call = async (method, url, { token, mod, body } = {}) => {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (mod) headers['x-mod-key'] = 'test-mod-key';
  const res = await app.inject({ method, url, headers, payload: body });
  return { code: res.statusCode, body: res.json() };
};
const mk = async (name) => {
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  await app.inject({ method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${token}` }, payload: { name } });
  const me = (await call('GET', '/v1/me', { token })).body.character;
  // /v1/me deliberately does not expose the account id, so read it off the character row. A first
  // cut used `me.accountId` (undefined), the UPDATE below matched nothing, and the retention
  // assertion failed against a fixture that had never actually aged anything.
  const acct = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [me.id])).rows[0].account_id;
  return { token, id: me.id, account: acct };
};

const a = await mk('Engage Ann');
const b = await mk('Engage Bob');
// A real action, through the public API, so the event is written the way the game writes it.
await call('POST', '/v1/crimes/pick', { token: a.token });
await app.inject({ method: 'POST', url: '/v1/crimes/pick', headers: { authorization: `Bearer ${a.token}` } });

const pathPost = async (payload) => {
  const response = await app.inject({ method: 'POST', url: '/v1/path-quiz',
    payload: { source: 'direct', ...payload } });
  assert.equal(response.statusCode, 200, `${payload.event} fixture should reach Path telemetry: ${response.body}`);
  return response;
};
const gunAnswers = Object.fromEntries(PATH_QUIZ_QUESTIONS.map((question) => [
  question.id, question.options.find((option) => option.lead === 'gun').id,
]));
await pathPost({ event: 'start', session: 'funnel-session-one' });
await pathPost({ event: 'complete', session: 'funnel-session-one', answers: gunAnswers });
await pathPost({ event: 'result_view', session: 'funnel-session-one', path: 'gun', secondary: 'ring' });
await pathPost({ event: 'cta_click', session: 'funnel-session-one', path: 'gun', cta: 'play' });
await pathPost({ event: 'cta_click', session: 'funnel-session-one', path: 'gun', cta: 'download_portrait' });
await pathPost({ event: 'cta_click', session: 'funnel-session-one', path: 'gun', cta: 'download_vertical' });
await pathPost({ event: 'share', session: 'funnel-session-one', path: 'gun', channel: 'native' });
await pathPost({ event: 'start', session: 'funnel-session-two' });
await pathPost({ event: 'result_view', session: 'funnel-social-view', path: 'ledger', secondary: null, source: 'social' });

// The economy report must observe real player interaction, not a fixture that inserts telemetry
// directly. Supply and a completed trade are separate signals: two people list/buy contraband.
const marketSeller = await mk('Engage Market Seller');
const marketBuyer = await mk('Engage Market Buyer');
await pool.query("UPDATE characters SET cash=100000, loc='docks' WHERE id=$1", [marketSeller.id]);
await pool.query("UPDATE characters SET cash=100000, loc='docks' WHERE id=$1", [marketBuyer.id]);
assert.equal((await call('POST', '/v1/goods/buy', { token: marketSeller.token, body: { goodId: 'gin', qty: 2 } })).code, 200,
  'the seller stocks real goods before listing them');
const marketListing = await call('POST', '/v1/market', { token: marketSeller.token,
  body: { goodId: 'gin', qty: 2, price: 500 } });
assert.equal(marketListing.code, 200, 'the seller lists goods through the public market route');
assert.equal((await call('POST', `/v1/market/${marketListing.body.id}/buy`, { token: marketBuyer.token,
  body: { qty: 2 } })).code, 200, 'the buyer completes the listed trade through the public market route');

// Likewise, a peer loan actually changes hands and is squared through the public routes.
const lender = await mk('Engage Lender');
const borrower = await mk('Engage Borrower');
await pool.query('UPDATE characters SET cash=100000 WHERE id=$1 OR id=$2', [lender.id, borrower.id]);
const offer = await call('POST', '/v1/loans', { token: lender.token,
  body: { amount: 10000, rate: 0.1, hours: 24 } });
assert.equal(offer.code, 200, 'the lender posts a peer offer');
assert.equal((await call('POST', `/v1/loans/${offer.body.id}/take`, { token: borrower.token })).code, 200,
  'the borrower takes the offer');
assert.equal((await call('POST', `/v1/loans/${offer.body.id}/repay`, { token: borrower.token })).code, 200,
  'the borrower repays the peer loan');

// A personal contract is a distinct supply signal from family contracts.
const contractor = await mk('Engage Contractor');
const mark = await mk('Engage Mark');
await pool.query('UPDATE characters SET cash=100000 WHERE id=$1', [contractor.id]);
assert.equal((await call('POST', `/v1/streets/${mark.id}/bounty`, { token: contractor.token,
  body: { amount: 1000, kind: 'hospitalize' } })).code, 200, 'a player posts a personal contract');

let r = await opsEngagement(pool, 14);
assert(r.players.humans >= 2, `both guests counted as humans, got ${r.players.humans}`);
const streets = r.systems.find((s) => s.system === 'streets / crime');
assert(streets.accounts >= 1, 'the crime a player actually pulled shows up under streets / crime');
assert(streets.events >= 1, 'and its events are counted');
const blackMarket = r.systems.find((s) => s.system === 'the black market');
assert(blackMarket.accounts >= 2 && blackMarket.events >= 2,
  'a real market list and completed buy are attributed to black-market adoption');
const loans = r.systems.find((s) => s.system === 'loan sharking');
assert(loans.accounts >= 2 && loans.events >= 3,
  'a real peer offer/take/repay lifecycle is attributed to loan-sharking adoption');
const contracts = r.systems.find((s) => s.system === 'contracts');
assert(contracts.accounts >= 1 && contracts.events >= 1,
  'a personal contract post is attributed to contract adoption');
assert(!r.untracked.includes('the black market'), 'instrumented market adoption is no longer reported as untracked');
assert.equal(r.uncatalogued.length, 0, `uncatalogued events present: ${JSON.stringify(r.uncatalogued)}`);
assert.deepEqual(r.funnels.pathQuiz, {
  starts: 2,
  answerEvents: 0,
  completions: 1,
  resultViews: 2,
  playClicks: 1,
  codexClicks: 0,
  portraitDownloads: 1,
  verticalDownloads: 1,
  shares: 1,
  startToCompletePct: 50,
  resultToPlayPct: 50,
  completionPaths: { gun: 1, ledger: 0, kitchen: 0, wheel: 0, shadow: 0, ring: 0 },
  viewedPaths: { gun: 1, ledger: 1, kitchen: 0, wheel: 0, shadow: 0, ring: 0 },
}, 'the mod report exposes the privacy-safe Path acquisition funnel and both conversion denominators');
console.log(`✓ live read: ${r.players.humans} humans, streets/crime shows ${streets.accounts} account(s) / ${streets.events} event(s)`);

// ── (3) THE DEAD LIST — the whole point ─────────────────────────────────────────────────────────
// Nobody in this fixture has opened boxing, so it must appear as dead. If the dead list were empty
// here the report would be incapable of ever telling the founder a system is unused.
assert(r.dead.includes('boxing'), 'a system nobody touched must appear on the dead list');
assert(!r.dead.includes('streets / crime'), 'a system someone used must NOT appear on the dead list');
assert(r.dead.length > 20, `most systems are untouched in this fixture; dead list has only ${r.dead.length}`);
// The market has declared lifecycle events, so it is eligible for the same dead-list diagnosis as
// every other instrumented system. This fixture exercised it, so it is neither untracked nor dead.
assert(!r.untracked.includes('the black market'), 'the instrumented market is no longer reported untracked');
assert(!r.dead.includes('the black market'), 'a market with real adoption is kept off the dead list');
console.log(`✓ dead list: ${r.dead.length} systems with zero distinct players; ${r.untracked.length} untracked (no events declared)`);

// ── (4) distinct-humans, not event volume ───────────────────────────────────────────────────────
// One player hammering a system is not adoption. Ann pulled two crimes; the system must show one
// account, not two.
assert.equal(streets.accounts, 1, `one player pulling two jobs is ONE adopting account, got ${streets.accounts}`);
assert(streets.events >= 2, 'while the event count reflects both actions');
console.log('✓ adoption is distinct accounts, not event volume');

// ── (5) retention cohorts are honest about young accounts ───────────────────────────────────────
// Both accounts were created seconds ago, so the D1 and D7 windows have not elapsed. They must be
// PENDING, not counted as churned — the classic way a young alpha's retention looks fake-terrible.
assert.equal(r.retention.d1.eligible, 0, 'accounts younger than the window are not yet eligible');
assert(r.retention.d1.pending >= 2, 'they are reported pending instead');
assert.equal(r.retention.d1.rate, null, 'and the rate is null rather than a misleading 0%');
// Age one account past the D1 window without it returning → eligible, not returned, 0%.
await pool.query("UPDATE accounts SET created_at = now() - interval '3 days' WHERE id=$1", [b.account]);
r = await opsEngagement(pool, 14);
assert.equal(r.retention.d1.eligible, 1, 'an aged account becomes eligible for D1');
assert.equal(r.retention.d1.returned, 0, 'it never came back, so it did not retain');
assert.equal(r.retention.d1.rate, 0, 'and the rate is a real 0%, not null');
assert.equal(r.retention.daily.length, 14, 'DAU series covers the window');
console.log(`✓ retention: young accounts pending (not churned); an aged no-show reports a real 0% D1`);

// ── (6) agents and NPC residents are excluded from "do humans come back" ────────────────────────
await pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [b.account]);
await pool.query(`INSERT INTO telemetry (id,account_id,event,props) VALUES
  ('agent-op-1',$1,'agent_turn_action',$2),
  ('agent-op-2',$1,'agent_turn_action',$3),
  ('agent-op-3',$1,'agent_turn_action',$4),
  ('human-op-ignored',$5,'agent_turn_action',$6)`, [
  b.account,
  JSON.stringify({ actionKind: 'crime', recommended: true, explorationSystemId: 'business-empire',
    visited: 1, remaining: 39, blockerCodes: ['cash', 'nerve'] }),
  JSON.stringify({ actionKind: 'market_fill', recommended: false, explorationSystemId: 'business-empire',
    visited: 2, remaining: 38, blockerCodes: ['nerve'] }),
  JSON.stringify({ actionKind: 'loan_repay', recommended: true, explorationSystemId: 'kitchen',
    visited: 3, remaining: 37, blockerCodes: ['cooking'] }),
  a.account,
  JSON.stringify({ actionKind: 'human-authored', recommended: true, explorationSystemId: 'streets-crime',
    visited: 40, remaining: 0, blockerCodes: ['human'] }),
]);
await pool.query(
  "INSERT INTO telemetry (id,account_id,event,props,at) VALUES ('agent-classified',$1,'crime_attempt','{}',now()+interval '1 minute')",
  [b.account]);
const withAgent = await opsEngagement(pool, 14);
assert.equal(withAgent.players.agents, 1, 'the agent is counted separately');
assert.equal(withAgent.players.humans, r.players.humans - 1, 'and removed from the human population');
assert.deepEqual(withAgent.agentActions, [
  { actionKind: 'crime', events: 1, recommended: 1 },
  { actionKind: 'loan_repay', events: 1, recommended: 1 },
  { actionKind: 'market_fill', events: 1, recommended: 0 },
], 'operator evidence summarizes only agent action kinds and recommendation counts');
assert.deepEqual(withAgent.agentBlockers, [
  { code: 'nerve', events: 2 }, { code: 'cash', events: 1 }, { code: 'cooking', events: 1 },
], 'operator evidence summarizes server-authored blocker codes without payloads or IDs');
const agentEmpire = withAgent.systems.find((system) => system.system === 'business empire');
const agentKitchen = withAgent.systems.find((system) => system.system === 'the kitchen');
const agentStreets = withAgent.systems.find((system) => system.system === 'streets / crime');
assert.deepEqual({ accounts: agentEmpire.agentAccounts, events: agentEmpire.agentEvents }, { accounts: 1, events: 2 },
  'per-system evidence counts distinct acting agents and activation events');
assert.deepEqual({ accounts: agentKitchen.agentAccounts, events: agentKitchen.agentEvents }, { accounts: 1, events: 1 },
  'a second exploration system receives its own bounded aggregate');
assert.equal(agentEmpire.systemId, 'business-empire',
  'operator per-system evidence carries the shared canonical coverage system id');
assert.deepEqual({ accounts: agentStreets.agentAccounts, events: agentStreets.agentEvents }, { accounts: 0, events: 0 },
  'operational rows authored under a human account are excluded from agent evidence');
assert.deepEqual({ accounts: agentStreets.accounts, events: agentStreets.events },
  { accounts: streets.accounts, events: streets.events + 1 },
  'legacy event volume still includes classified agent play while distinct adoption remains human-only');
assert(new Date(agentStreets.last) > new Date(streets.last),
  'legacy last-use time still advances for classified agent play');
assert.equal(JSON.stringify({ actions: withAgent.agentActions, blockers: withAgent.agentBlockers,
  systems: withAgent.systems }).includes(b.account), false,
  'operator aggregates expose no account IDs or raw authored telemetry');
console.log('✓ agents counted separately — an agent returning says nothing about whether the game is fun');

// ── (7) the route is mod-gated ──────────────────────────────────────────────────────────────────
assert.equal((await call('GET', '/v1/mod/engagement')).code, 401, 'the endpoint refuses a keyless caller');
assert.equal((await call('GET', '/v1/mod/engagement', { token: a.token })).code, 401, 'and a player token');
const ok = await call('GET', '/v1/mod/engagement', { mod: true });
assert.equal(ok.code, 200, 'and serves the mod key');
assert(Array.isArray(ok.body.systems) && ok.body.dead, 'returning the systems table and the dead list');
console.log('✓ GET /v1/mod/engagement is mod-gated and serves the report');

await app.close();
console.log('✅ ENGAGEMENT test passed — the system catalog claims every one of '
  + `${emitted.size} track() events in src/ exactly once (so a new system cannot silently read as dead, `
  + 'and a renamed event cannot leave a phantom), the report reads real telemetry through the public API, '
  + 'THE DEAD LIST names systems with zero distinct players while keeping untracked systems separate from '
  + 'unused ones, adoption counts distinct humans rather than event volume, retention reports young cohorts '
  + 'as pending instead of churned, agents and NPC residents are excluded from the human population, and the '
  + 'endpoint is mod-gated');
