// DEEP CITY COVERAGE — one canonical recommendation over engagement's exact 40-system vocabulary.
//
// Each assertion protects an observable contract: catalog drift, recommendation grids, per-system
// telemetry reads, lost account-history evidence, dishonest eligibility, or a read that moves value.
import assert from 'node:assert';
import { buildServer } from '../src/server.js';
import * as Engagement from '../src/engagement.js';
import * as Explore from '../src/explore.js';
import { auctionLotsOf, DISTRICTS, levelOf, weekOf } from '../src/rules.js';

const { SYSTEMS } = Explore;
const ENGAGEMENT_SYSTEMS = Engagement.SYSTEMS;

const expectedCatalog = [
  ['streets / crime', 'streets-crime', 1, 'streets'],
  ['the kitchen', 'kitchen', 8, 'kitchen'],
  ['wet work', 'wet-work', 22, 'pvp'],
  ['contracts', 'contracts', 22, 'pvp'],
  ['the dueling ladder', 'dueling-ladder', 22, 'pvp'],
  ['crew heists', 'crew-heists', 9, 'scores'],
  ['clue scrolls', 'clue-scrolls', 3, 'streets'],
  ['the family', 'family', 3, 'family'],
  ['the commission', 'commission', 20, 'family'],
  ['territory', 'territory', 15, 'map'],
  ['the world', 'world', 18, 'family'],
  ['the blood war', 'blood-war', 20, 'family'],
  ['business empire', 'business-empire', 3, 'empire'],
  ['convoys', 'convoys', 24, 'scores'],
  ['the port', 'port', 16, 'port'],
  ['the black market', 'black-market', 7, 'market'],
  ['loan sharking', 'loan-sharking', 10, 'loans'],
  ['the casino', 'casino', 10, 'den'],
  ['the speakeasy', 'speakeasy', 26, 'speakeasy'],
  ['boxing', 'boxing', 12, 'boxing'],
  ['street races', 'street-races', 14, 'races'],
  ['the stable', 'stable', 25, 'stable'],
  ['the law', 'law', 18, 'law'],
  ['the pen', 'pen', 1, 'pen'],
  ['the wire', 'wire', 18, 'wire'],
  ['secrets', 'secrets', 18, 'wire'],
  ['skills', 'skills', 4, 'life'],
  ['the underworld', 'underworld', 3, 'life'],
  ['the estate', 'estate', 30, 'estate'],
  ['the made man', 'made-man', 26, 'portfolio'],
  ['the auction house', 'auction-house', 30, 'estate'],
  ['the collection', 'collection', 20, 'estate'],
  ['going legit', 'going-legit', 15, 'portfolio'],
  ['the megaproject', 'megaproject', 28, 'city'],
  ['street life', 'street-life', 3, 'streets'],
  ['landmarks', 'landmarks', 12, 'city'],
  ['street deeds', 'street-deeds', 15, 'deeds'],
  ['vanity', 'vanity', 5, 'profile'],
  ['the store / pass', 'store-pass', 1, 'store'],
  ['growth / social', 'growth-social', 3, 'discover'],
];

assert.deepEqual(Object.keys(ENGAGEMENT_SYSTEMS), expectedCatalog.map(([system]) => system),
  'the engagement vocabulary remains the exact ordered 40-system source of truth');
assert.deepEqual(Object.entries(Engagement.SYSTEM_IDS || {}), expectedCatalog.map(([system, systemId]) => [system, systemId]),
  'the shared canonical system-id map has exact ordered parity with coverage metadata');
assert.equal(typeof Explore.systemCoverage, 'function', 'coverage exposes the canonical async resolver');
assert.deepEqual(SYSTEMS.map(({ system, systemId, at, tab }) => [system, systemId, at, tab]), expectedCatalog,
  'coverage metadata maps every engagement system to the exact canonical id, gate, and destination');
assert.equal(new Set(SYSTEMS.map((entry) => entry.systemId)).size, 40,
  'every coverage system id is unique');

const respectForLevel = (level) => { let respect = 0; while (levelOf(respect) < level) respect += 25; return respect; };
const ch = (level, extra = {}) => ({ id: 'char-me', account_id: 'acct-me', respect: respectForLevel(level),
  cash: 0, loc: 'brick', lab: null, jail_until: null, wanted_until: null, indicted_at: null, ...extra });
const owned = (extra = {}) => ({ rackets: [], assets: [], businesses: [], fighters: [], cars: [], cargo: {},
  skills: new Set(), mastery: {}, npc: {}, work: {}, held: [], ...extra });
const acct = (extra = {}) => ({ agent_flag: false, omr: 0, ...extra });

const eventsExcept = (...systems) => Object.entries(ENGAGEMENT_SYSTEMS)
  .filter(([system]) => !systems.includes(system))
  .map(([, events]) => ({ event: events[0], count: 1 }));
const fakeDb = (rows = []) => {
  const queries = [];
  return {
    queries,
    async query(sql, params) { queries.push({ sql, params }); return { rows }; },
  };
};

const liveDb = (target, live = {}) => {
  const queries = [];
  const events = eventsExcept(target);
  return {
    queries,
    async query(sql, params) {
      queries.push({ sql, params });
      if (/FROM telemetry/i.test(sql)) return { rows: events };
      if (/FROM gangs/i.test(sql)) return { rows: live.seats || [] };
      if (/FROM speakeasies/i.test(sql)) return { rows: (live.occupiedSpeakeasies || []).map((district_id) => ({ district_id })) };
      if (/FROM auctions/i.test(sql)) return { rows: live.auctions || [] };
      if (/FROM cars/i.test(sql) && /FROM boats/i.test(sql)) return { rows: live.collectionItems || [] };
      if (/FROM landmarks/i.test(sql)) return { rows: live.landmarks || [] };
      throw new Error(`unexpected live coverage query: ${sql}`);
    },
  };
};

// A blank account gets exactly one solo recommendation. The literal expected card catches a second
// choice, an executable/EV field leaking in, or drift from the published canonical sample.
let db = fakeDb();
let coverage = await Explore.systemCoverage(db, ch(3, { cash: 12500 }), acct(), owned());
assert.deepEqual(coverage.catalog, { scope: 'engagement_systems', version: 1, count: 40 });
assert.deepEqual(coverage.progress, { visited: 0, eligible: 2, remaining: 40 });
assert.deepEqual(coverage.next, {
  systemId: 'streets-crime', system: 'streets / crime', name: 'The Streets', tab: 'streets',
  hook: 'Work a street crime — the city\'s first cash-and-respect loop.', at: 1, mode: 'solo',
  reason: 'earliest_overdue_unlock', evidence: { visited: false, source: null },
});
assert.deepEqual(Object.keys(coverage.blocked).sort(), ['level', 'policy', 'resource', 'social', 'status']);
assert.equal(Object.values(coverage.blocked).reduce((sum, count) => sum + count) + coverage.progress.eligible,
  coverage.progress.remaining, 'every unvisited system is classified exactly once as ready or blocked');
assert.equal(db.queries.length, 1, 'coverage reads account telemetry in one query, not once per system');
assert.match(db.queries[0].sql, /GROUP BY event/i, 'the sole telemetry read is grouped by event');
assert.deepEqual(db.queries[0].params, ['acct-me'], 'telemetry is scoped to the current account');

// Telemetry survives character death and takes precedence as account-level visit evidence. Once the
// streets event exists, the ready solo Empire card beats same-level social/organization work.
db = fakeDb([{ event: 'crime_attempt', count: 7 }]);
coverage = await Explore.systemCoverage(db, ch(3, { cash: 12500 }), acct(), owned(), {
  onlineAccounts: [{ accountId: 'other', gangId: 'family-1' }],
});
assert.equal(coverage.progress.visited, 1);
assert.equal(coverage.next.systemId, 'business-empire');
assert.deepEqual(coverage.next.evidence, { visited: false, source: null });

// The old Explore ownership/mastery/legend predicates remain valid durable evidence, even without a
// telemetry row. These two state signals cover the old Empire and Kitchen predicates.
db = fakeDb(eventsExcept('business empire', 'the kitchen', 'crew heists'));
coverage = await Explore.systemCoverage(db, ch(30, { cash: 10_000_000, lab: 'bathtub' }), acct({ smuggled: 1 }),
  owned({ rackets: ['laundro'], crewId: 'crew-1', mastery: { chemistry: 40 } }));
assert.equal(coverage.progress.visited, 40, 'durable state evidence supplements telemetry without replacing it');
assert.equal(coverage.progress.remaining, 0);
assert.equal(coverage.next, null);

// Resource, status, and organization contexts are blockers until their real condition is true.
db = fakeDb(eventsExcept('the kitchen'));
coverage = await Explore.systemCoverage(db, ch(8), acct(), owned());
assert.equal(coverage.next, null);
assert.deepEqual(coverage.blocked, { level: 0, resource: 1, status: 0, social: 0, policy: 0 });
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('the kitchen')), ch(8, { cash: 20000 }), acct(), owned());
assert.equal(coverage.next.systemId, 'kitchen');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('the pen')), ch(30), acct(), owned());
assert.equal(coverage.next, null);
assert.equal(coverage.blocked.status, 1);
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('the pen')),
  ch(30, { jail_until: new Date(Date.now() + 60_000) }), acct(), owned());
assert.equal(coverage.next.systemId, 'pen');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('territory')), ch(30), acct(), owned());
assert.equal(coverage.next, null);
assert.equal(coverage.blocked.social, 1);
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('territory')), ch(30), acct(), owned({ gangId: 'gang-1' }));
assert.equal(coverage.next.systemId, 'territory');
assert.equal(coverage.next.mode, 'organization');

// Dynamic gates use the same live state as their authoritative mutations. These go through the
// production wrapper so a caller that forgets to load/pass context fails the test too.
let live = liveDb('the commission');
coverage = await Explore.exploreBoard(live, ch(30), acct(), owned({ gangId: 'gang-1', gangRole: 'boss' }));
assert.equal(coverage.next, null, 'a boss outside the current Commission seats is not eligible to vote');
assert.equal(coverage.blocked.social, 1);
live = liveDb('the commission', { seats: [{ id: 'gang-1', standing: 10000 }] });
coverage = await Explore.exploreBoard(live, ch(30), acct(), owned({ gangId: 'gang-1', gangRole: 'boss' }));
assert.equal(coverage.next.systemId, 'commission', 'a current seated boss can use the Commission now');

const made = acct({ made_until: new Date(Date.now() + 864e5).toISOString() });
const districts = DISTRICTS.map((district) => district.id);
live = liveDb('the speakeasy', { occupiedSpeakeasies: districts });
coverage = await Explore.exploreBoard(live, ch(30, { cash: 750000 }), made, owned());
assert.equal(coverage.next, null, 'an otherwise qualified made player cannot open in an occupied city');
live = liveDb('the speakeasy', { occupiedSpeakeasies: districts.slice(1) });
coverage = await Explore.exploreBoard(live, ch(30, { cash: 750000 }), made, owned());
assert.equal(coverage.next.systemId, 'speakeasy', 'one live free district makes the Speakeasy usable now');

const raceCar = (extra = {}) => ({ id: 'race-car', model_id: 'model', trim_id: 'stock', listed: false, pledged: false, ...extra });
live = liveDb('street races');
coverage = await Explore.exploreBoard(live, ch(30, { cash: 2000 }), acct(), owned({ cars: [raceCar({ listed: true })] }));
assert.equal(coverage.next, null, 'a listed car is not raceable');
coverage = await Explore.exploreBoard(liveDb('street races'), ch(30, { cash: 2000 }), acct(),
  owned({ cars: [raceCar({ pledged: true })] }));
assert.equal(coverage.next, null, 'a pledged car is not raceable');
coverage = await Explore.exploreBoard(liveDb('street races'),
  ch(30, { cash: 2000, race_at: new Date(Date.now() + 60_000) }), acct(), owned({ cars: [raceCar()] }));
assert.equal(coverage.next, null, 'the authoritative driver cooldown blocks a fresh circuit run');
coverage = await Explore.exploreBoard(liveDb('street races'), ch(30, { cash: 1999 }), acct(), owned({ cars: [raceCar()] }));
assert.equal(coverage.next, null, 'the cheapest currently unlocked race still requires its live fee');
coverage = await Explore.exploreBoard(liveDb('street races'), ch(30, { cash: 2000 }), acct(), owned({ cars: [raceCar()] }));
assert.equal(coverage.next.systemId, 'street-races', 'an available car, driver, and fee make racing usable now');

const liveLots = auctionLotsOf(weekOf()).map((lot) => ({ lot_id: lot.id, current_bid: 2000, bidder: 'other', status: 'live' }));
coverage = await Explore.exploreBoard(liveDb('the auction house', { auctions: liveLots }), ch(30), acct({ omr: 2099 }), owned());
assert.equal(coverage.next, null, 'auction affordability uses the live 5% raise, not an archetype floor');
coverage = await Explore.exploreBoard(liveDb('the auction house', { auctions: liveLots }), ch(30), acct({ omr: 2100 }), owned());
assert.equal(coverage.next.systemId, 'auction-house', 'meeting the live current-bid minimum makes a lot usable');

const commonCar = { kind: 'car', id: 'car-1', rarity: 'common', minted_onchain: false, listed: false, pledged: false, run_until: null };
const blockedCollection = [
  { ...commonCar, listed: true },
  { ...commonCar, id: 'car-2', pledged: true },
  { ...commonCar, id: 'car-3', rarity: 'epic' },
  { ...commonCar, id: 'car-4', minted_onchain: true },
  { kind: 'boat', id: 'boat-1', rarity: 'common', minted_onchain: false, listed: false, pledged: false,
    run_until: new Date(Date.now() + 60_000) },
  { kind: 'boat', id: 'boat-2', rarity: 'epic', minted_onchain: false, listed: false, pledged: false, run_until: null },
];
coverage = await Explore.exploreBoard(liveDb('the collection', { collectionItems: blockedCollection }),
  ch(30), acct({ omr: 5000 }), owned({ cars: [raceCar({ listed: true })], gear: ['pistol'] }));
assert.equal(coverage.next, null, 'only a real, in-play, non-max, unencumbered car or boat is upgradeable');
coverage = await Explore.exploreBoard(liveDb('the collection', { collectionItems: [
  { kind: 'boat', id: 'boat-free', rarity: 'common', minted_onchain: false, listed: false, pledged: false, run_until: null },
] }), ch(30), acct({ omr: 150 }), owned());
assert.equal(coverage.next.systemId, 'collection', 'a docked boat at the exact next-tier price is eligible');

const heldLandmarks = districts.map((district_id) => ({ district_id, amount: 500 }));
coverage = await Explore.exploreBoard(liveDb('landmarks', { landmarks: heldLandmarks }), ch(30), acct({ omr: 500 }), owned());
assert.equal(coverage.next, null, 'a held landmark requires the live holder amount plus one');
coverage = await Explore.exploreBoard(liveDb('landmarks', { landmarks: heldLandmarks }), ch(30), acct({ omr: 501 }), owned());
assert.equal(coverage.next.systemId, 'landmarks', 'meeting the lowest live holder-plus-one makes a landmark usable');

// Agent policy is conservative and exhaustive: a human with a live counterparty can receive wet work;
// an agent with the same state cannot, and receives no fallback choice.
const liveCounterparty = { onlineAccounts: [{ accountId: 'other', characterId: 'target', loc: 'brick' }] };
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('wet work')), ch(30, { cash: 10_000_000 }), acct(), owned(), liveCounterparty);
assert.equal(coverage.next.systemId, 'wet-work');
assert.equal(coverage.next.mode, 'social');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('wet work')), ch(30, { cash: 10_000_000 }),
  acct({ agent_flag: true }), owned(), liveCounterparty);
assert.equal(coverage.next, null, 'agent policy never substitutes a forbidden proactive system');
assert.deepEqual(coverage.blocked, { level: 0, resource: 0, status: 0, social: 0, policy: 1 });

// Route integration: account telemetry changes the recommendation, the response never becomes a grid,
// and repeated reads append no economic ledger rows.
const app = await buildServer();
const pool = app.pool;
const call = async (method, url, { token, body } = {}) => {
  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  return { code: res.statusCode, body: res.json() };
};
const { body: { token } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token, body: { name: 'Coverage Connie' } });
const me = (await call('GET', '/v1/me', { token })).body.character;
await pool.query('UPDATE characters SET respect=$2, cash=$3 WHERE id=$1', [me.id, respectForLevel(3), 12500]);
let routeBoard = (await call('GET', '/v1/explore', { token })).body;
assert.equal(routeBoard.next.systemId, 'streets-crime');
assert.ok(!('untapped' in routeBoard), 'coverage returns one next recommendation, never the old choice grid');
const accountId = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [me.id])).rows[0].account_id;
await pool.query("INSERT INTO telemetry (id,account_id,event,props) VALUES ('coverage-crime',$1,'crime_attempt','{}')", [accountId]);
routeBoard = (await call('GET', '/v1/explore', { token })).body;
assert.equal(routeBoard.next.systemId, 'business-empire', 'account telemetry changes the next recommendation');
const before = Number((await pool.query('SELECT count(*) c FROM transactions')).rows[0].c);
await call('GET', '/v1/explore', { token });
await call('GET', '/v1/explore', { token });
const after = Number((await pool.query('SELECT count(*) c FROM transactions')).rows[0].c);
assert.equal(after, before, 'reading coverage writes zero ledger rows');

console.log('explore: canonical 40-system coverage ok');
await app.close();
process.exit(0);
