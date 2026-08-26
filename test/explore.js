// DEEP CITY COVERAGE — one canonical recommendation over engagement's exact 40-system vocabulary.
//
// Each assertion protects an observable contract: catalog drift, recommendation grids, per-system
// telemetry reads, lost account-history evidence, dishonest eligibility, or a read that moves value.
import assert from 'node:assert';
import { buildServer } from '../src/server.js';
import * as Engagement from '../src/engagement.js';
import * as Explore from '../src/explore.js';
import { convoyBoard as liveConvoyBoard } from '../src/convoy.js';
import { cornerBoard as liveCornerBoard } from '../src/corner.js';
import { favorBoard } from '../src/favors.js';
import { heistBoard as liveHeistBoard } from '../src/heists.js';
import { upgradeRarity } from '../src/nft.js';
import { vouchBoard } from '../src/vouch.js';
import {
  auctionLotsOf, BOXING, CARS, CASINO, CLUES, CONVOY, CORNER, CRIMES, DISTRICTS, ESTATE, HEIST_JOBS, KITCHENS,
  LANDMARKS, levelOf, LOAN, MADE, MEGAPROJECT, PORT, RACKETS, RACES, SKILLS, SPEAKEASY, STABLE,
  VANITY, VOUCH, WIRE, weekOf,
} from '../src/rules.js';

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
  cash: 0, nerve: 10, energy: 50, ammo: 10, health: 100, loc: 'brick', lab: null,
  jail_until: null, wanted_until: null, indicted_at: null, ...extra });
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
      if (/FROM crew_heists|FROM crew_heist_members/i.test(sql)) return { rows: [] };
      if (/SELECT c\.heist_loot/i.test(sql)) return { rows: [{ heist_loot: 0, heists_pulled: 0 }] };
      if (/FROM loans l/i.test(sql)) return { rows: [] };
      if (/FROM loan_house/i.test(sql)) return { rows: [{ pool: 0 }] };
      if (/FROM loans WHERE borrower_character/i.test(sql)) return { rows: [] };
      if (/FROM market_listings l/i.test(sql)) return { rows: [] };
      if (/FROM cars WHERE listed/i.test(sql)) return { rows: [] };
      if (/FROM market_listings/i.test(sql)) return { rows: [] };
      throw new Error(`unexpected live coverage query: ${sql}`);
    },
  };
};

// A blank account gets exactly one solo recommendation. The literal expected card catches a second
// choice, an executable/EV field leaking in, or drift from the published canonical sample.
let db = fakeDb();
let coverage = await Explore.systemCoverage(db, ch(3, { cash: 12500 }), acct(), owned());
assert.deepEqual(coverage.catalog, { scope: 'engagement_systems', version: 1, count: 40 });
assert.deepEqual(coverage.progress, { visited: 0, eligible: 3, remaining: 40 });
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
assert.equal(coverage.next, null, 'family membership alone is not an actionable territory operation');
assert.equal(coverage.blocked.resource, 1);
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('territory')), ch(30), acct(),
  owned({ gangId: 'gang-1', gangRole: 'soldier' }), {
    live: { territoryBoard: { own: [{ district: 'brick', pending: 1, cold: false }], rival: null } },
  });
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

const commonCar = { kind: 'car', id: 'car-1', model_id: CARS[0].id, rarity: 'common', minted_onchain: false,
  listed: false, pledged: false, run_until: null };
const commonBoat = { kind: 'boat', id: 'boat-1', kind_id: PORT.BOATS[0].id, rarity: 'common',
  minted_onchain: false, listed: false, pledged: false, run_until: null };
for (const [message, item] of [
  ['a listed and pledged car remains upgradeable at the rarity desk', { ...commonCar, listed: true, pledged: true }],
  ['a boat on an active run remains upgradeable at the rarity desk',
    { ...commonBoat, run_until: new Date(Date.now() + 60_000) }],
]) {
  coverage = await Explore.exploreBoard(liveDb('the collection', { collectionItems: [item] }),
    ch(30), acct({ omr: 150 }), owned());
  assert.equal(coverage.next?.systemId, 'collection', message);
}
for (const [message, item, omr] of [
  ['an extracted item is not upgradeable', { ...commonCar, minted_onchain: true }, 5000],
  ['a max-rarity item is not upgradeable', { ...commonBoat, rarity: 'epic' }, 5000],
  ['the exact next-tier price is required', commonCar, 149],
]) {
  coverage = await Explore.exploreBoard(liveDb('the collection', { collectionItems: [item] }),
    ch(30), acct({ omr }), owned());
  assert.equal(coverage.next, null, message);
}

// The three market-shaped systems use their authoritative boards, not ownership/balance stand-ins.
// Each case isolates the target as the sole unvisited row so a fallback card cannot hide a mismatch.
const loanBoard = (overrides = {}) => ({
  offers: [], active: [], paper: [],
  house: { min: LOAN.HOUSE_MIN, minLevel: LOAN.HOUSE_MIN_LVL, cap: LOAN.HOUSE_MAX,
    available: 0, eligible: true, yourMarker: null },
  terms: { min: LOAN.MIN },
  ...overrides,
});

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('loan sharking')), ch(30), acct(), owned(), {
  live: { loanBoard: loanBoard({ house: { min: LOAN.HOUSE_MIN, minLevel: LOAN.HOUSE_MIN_LVL,
    cap: LOAN.HOUSE_MAX, available: LOAN.HOUSE_MIN, eligible: true, yourMarker: null } }) },
});
assert.equal(coverage.next?.systemId, 'loan-sharking',
  'a qualified human can use a funded Loan House window without already holding lender cash');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('loan sharking')), ch(30), acct(), owned(), {
  live: { loanBoard: loanBoard({ offers: [{ id: 'offer', mine: false, principal: LOAN.MIN,
    directed: false, forMe: false, collateralMin: 0, collateralOmr: 0 }] }) },
});
assert.equal(coverage.next?.systemId, 'loan-sharking',
  'a human with no active debt can take an open unsecured player offer without lender cash');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('loan sharking')), ch(30, { cash: 900 }),
  acct({ agent_flag: true }), owned(), {
    live: { loanBoard: loanBoard({ active: [{ id: 'mine', role: 'borrower', owed: 900 }] }) },
  });
assert.equal(coverage.next?.systemId, 'loan-sharking',
  'an agent may square an existing marker even below the lending minimum');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('loan sharking')),
  ch(30, { cash: LOAN.MIN, safe_until: new Date(Date.now() + 60_000) }), acct({ agent_flag: true }), owned(), {
    live: { loanBoard: loanBoard({ house: { min: LOAN.HOUSE_MIN, minLevel: LOAN.HOUSE_MIN_LVL,
      cap: LOAN.HOUSE_MAX, available: LOAN.HOUSE_MIN, eligible: true, yourMarker: null } }) },
  });
assert.equal(coverage.next, null,
  'an agent never receives borrowing as Explore readiness, and a safehouse blocks creating a loan offer');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('vanity')), ch(30), acct({ omr: VANITY.TITLE_OMR }), owned());
assert.equal(coverage.next?.systemId, 'vanity',
  'a living character can buy a title with the published $OMR price and no car, family, or deed');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('vanity')), ch(30), acct({ omr: VANITY.NAME_CHANGE_OMR }), owned());
assert.equal(coverage.next?.systemId, 'vanity',
  'a living character can change their name with the published $OMR price and no renameable holding');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('vanity')), ch(30), acct(),
  owned({ cars: [{ id: 'pledged', listed: true, pledged: true }] }));
assert.equal(coverage.next, null, 'a holding with no affordable vanity operation is not a readiness proxy');

const marketBoard = (listings = []) => ({
  levers: { minPrice: 50, listFeeBps: 100, maxListings: 3 }, listings,
});
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('the black market')), ch(30), acct(),
  owned({ cars: [{ id: 'locked-iron', listed: true, pledged: true }] }), {
    live: { marketBoard: marketBoard(), marketOwn: [] },
  });
assert.equal(coverage.next, null,
  'broke inventory that is listed and pledged cannot be offered as a valid Black Market operation');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('the black market')), ch(30, { loc: 'brick' }), acct(),
  owned({ cargo: { booze: 2 } }), {
    live: { marketBoard: marketBoard([{ id: 'wtb', kind: 'order', sellerId: 'other', good: 'booze',
      wanted: 2, unitPrice: 100, district: 'brick', expiresSeconds: 600 }]), marketOwn: [] },
  });
assert.equal(coverage.next?.systemId, 'black-market',
  'matching cargo at a live buy-order dock is fillable with no cash or listing fee');

const heistBoard = (overrides = {}) => ({
  jobs: HEIST_JOBS.map((job) => ({ ...job, locked: false })), open: [], mine: null,
  you: { pulled: 0 }, ...overrides,
});
const firstHeist = HEIST_JOBS.find((job) => !job.rateBps);
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('crew heists')),
  ch(30, { cash: firstHeist.stake }), acct(), owned(), { live: { heistBoard: heistBoard() } });
assert.equal(coverage.next?.systemId, 'crew-heists',
  'planning an eligible score uses the heist stake/status gates and does not require social-crew membership');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('crew heists')), ch(30), acct(), owned(), {
  live: { heistBoard: heistBoard({ open: [{ id: 'open-score', job: firstHeist.id, lvl: firstHeist.lvl,
    crewNeeded: 1, rolesOpen: [firstHeist.roles[0]] }] }) },
});
assert.equal(coverage.next?.systemId, 'crew-heists',
  'an open role-matched heist can be joined without stake cash or social-crew membership');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('crew heists')), ch(30), acct(), owned(), {
  live: { heistBoard: heistBoard({ open: [{ id: 'own-mark-score', job: firstHeist.id, lvl: firstHeist.lvl,
    crewNeeded: 1, rolesOpen: [firstHeist.roles[0]], canJoin: false }] }) },
});
assert.equal(coverage.next, null,
  'an open inside-job row is not joinable by the character who owns its business mark');

const insideHeist = HEIST_JOBS.find((job) => job.rateBps);
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('crew heists')), ch(30), acct({ agent_flag: true }), owned(), {
  live: { heistBoard: heistBoard({ jobs: [{ ...insideHeist, locked: false }], open: [{
    id: 'inside-score', job: insideHeist.id, lvl: insideHeist.lvl, crewNeeded: 1,
    rolesOpen: [insideHeist.roles[0]], canJoin: true,
  }] }) },
});
assert.equal(coverage.next, null, 'agent policy never joins a player-targeted inside-job heist');
assert.equal(coverage.blocked.policy, 1, 'an otherwise joinable inside job is policy-blocked for an agent');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('crew heists')), ch(30), acct({ agent_flag: true }), owned(), {
  live: { heistBoard: heistBoard({ jobs: [{ ...firstHeist, locked: false }], open: [{
    id: 'ordinary-score', job: firstHeist.id, lvl: firstHeist.lvl, crewNeeded: 1,
    rolesOpen: [firstHeist.roles[0]], canJoin: true,
  }] }) },
});
assert.equal(coverage.next?.systemId, 'crew-heists', 'agent policy preserves ordinary co-op heist joins');

// Shared boards must close the less-obvious proxy gaps too: a family badge, an apparently open
// corner, warehouse slots, or stale dirt cannot stand in for an operation that the mutation accepts.
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('territory')), ch(30), acct(),
  owned({ gangId: 'gang-1', gangRole: 'soldier' }), { live: { territoryBoard: { own: [], rival: null } } });
assert.equal(coverage.next, null, 'family membership alone is not an actionable territory operation');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('territory')), ch(30), acct(),
  owned({ gangId: 'gang-1', gangRole: 'soldier' }), { live: { territoryBoard: {
    own: [{ district: 'brick', pending: 1, cold: false }], rival: null,
  } } });
assert.equal(coverage.next?.systemId, 'territory', 'a warm family operation with a real pending take is collectible');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('territory')), ch(30, {
  energy: 100, ammo: 100,
}), acct({ agent_flag: true }), owned({ gangId: 'gang-1', gangRole: 'soldier' }), { live: {
  territoryBoard: { own: [], rival: { district: 'brick', pending: 1000, raidable: true } },
} });
assert.equal(coverage.next, null, 'agent policy never turns a rival territory raid into an autonomous operation');
assert.equal(coverage.blocked.policy, 1, 'an otherwise executable territory raid is classified as policy-blocked for agents');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('territory')), ch(30), acct({ agent_flag: true }),
  owned({ gangId: 'gang-1', gangRole: 'soldier' }), { live: { territoryBoard: {
    own: [{ district: 'brick', pending: 1, cold: false }], rival: null,
  } } });
assert.equal(coverage.next?.systemId, 'territory', 'agent policy preserves non-PvP family territory collection');

const mintedBoat = { ...commonBoat, id: 'on-chain-boat', minted_onchain: true };
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('the port')), ch(30, {
  loc: PORT.DISTRICT, cash: Math.min(...PORT.BOATS.map((boat) => boat.cost)),
}), acct(), owned(), { live: {
  collectionItems: [mintedBoat],
  portBoard: { atDocks: true, fleet: [{ ...mintedBoat, status: 'docked' }], catalog: PORT.BOATS, fleetMax: 1,
    contraband: { book: 0 } },
} });
assert.equal(coverage.next?.systemId, 'port',
  'an extracted trophy boat does not consume the in-game berth counted by the buy mutation');

const arrivedBoat = { ...commonBoat, id: 'arrived-boat', run_until: new Date(Date.now() - 60_000) };
const arrivedPortWitness = Explore.systemEligibility(SYSTEMS.find((entry) => entry.systemId === 'port'), {
  ch: ch(30, { loc: PORT.DISTRICT }), acct: acct(), owned: owned(), level: 30, onlineAccounts: [], live: {
    collectionItems: [arrivedBoat],
    portBoard: { atDocks: true, fleet: [{ ...arrivedBoat, status: 'arrived' }], catalog: PORT.BOATS,
      fleetMax: 1, contraband: { book: 0 } },
  },
});
assert.equal(arrivedPortWitness.operation, 'port:collect',
  'an uncollected arrival is still at sea and must witness collection, never the rejecting boat-sale route');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('the black market')), ch(30, { cash: 100 }), acct(),
  owned({ cargo: { booze: 1 } }), { live: { marketBoard: marketBoard(), marketOwn: [0, 1, 2].map((n) => ({
    kind: 'order', status: 'cancelled', seller_character: 'char-me', filled_qty: 1, district: 'neon', id: `warehouse-${n}`,
  })) } });
assert.equal(coverage.next, null, 'unclaimed order warehouses consume every market slot just like the mutation count');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('loan sharking')), ch(30, { cash: 1 }), acct(), owned(), {
  live: { loanBoard: loanBoard({ paper: [{ id: 'own-marker', mine: false, borrowerMe: true, price: 1 }] }) },
});
assert.equal(coverage.next, null, 'a borrower cannot buy the paper on their own debt');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('secrets')), ch(30), acct(), owned(), {
  live: { secretsBoard: { held: [{ id: 'stale', exposable: false }], onMe: [] } },
});
assert.equal(coverage.next, null, 'stale dirt with no living target is not an exposable secret operation');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('the wire')), ch(30), acct({ omr: WIRE.TAP_OMR }), owned(), {
  live: { wireBoard: { costs: { tap: WIRE.TAP_OMR }, watches: [],
    taps: [{ target: 'live-target' }], tapMax: 1, informants: [], informantMax: 1,
    bugsOnYou: 0, subTiers: [] } },
});
assert.equal(coverage.next?.systemId, 'wire',
  'a live tap can be refreshed at the slot cap without rediscovering its target on a social board');

const cappedVouchDb = {
  async query(sql) {
    if (/SELECT v\.target_account/i.test(sql) || /SELECT v\.voucher_account/i.test(sql)) return { rows: [] };
    if (/COUNT\(\*\).*voucher_account/i.test(sql)) return { rows: [{ n: VOUCH.MAX_OUT }] };
    if (/COUNT\(\*\).*target_account/i.test(sql)) return { rows: [{ n: 0 }] };
    throw new Error(`unexpected vouch board query: ${sql}`);
  },
};
const cappedVouches = await vouchBoard(cappedVouchDb, ch(30));
assert.equal(cappedVouches.slotsLeft, 0,
  'vouch capacity counts durable outbound rows even when their current streets are no longer living');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('growth / social')), ch(30), acct(), owned(), {
  onlineAccounts: [{ accountId: 'other', characterId: 'target' }], live: { vouchBoard: cappedVouches },
});
assert.equal(coverage.next, null, 'a hidden dead-street vouch cannot manufacture a free growth/social slot');

const expiredFavor = {
  id: 'expired-open', good_id: 'booze', qty: 1, pay: 600, district: 'brick', note: null,
  expires_at: new Date(Date.now() - 60_000),
};
const expiredFavors = Array.from({ length: 3 }, (_, index) => ({ ...expiredFavor, id: `expired-open-${index}` }));
const expiredFavorDb = {
  async query(sql) {
    if (/SELECT account_id FROM characters/i.test(sql)) return { rows: [{ account_id: 'acct-me' }] };
    if (/JOIN contacts/i.test(sql)) return { rows: [] };
    if (/FROM favors WHERE poster_character/i.test(sql)) {
      return { rows: /expires_at\s*>\s*now\(\)/i.test(sql) ? [] : expiredFavors };
    }
    throw new Error(`unexpected favor board query: ${sql}`);
  },
};
const expiredFavorBoard = await favorBoard(ch(30, { cash: 10_000 }), expiredFavorDb, {
  owned: owned(),
});
assert.equal(expiredFavorBoard.canPost, false,
  'an expired-but-unswept open favor still consumes the authoritative posting cap');
assert.deepEqual(expiredFavorBoard.mine.map((row) => row.id), expiredFavors.map((row) => row.id),
  'the board preserves an expired open favor because the cancellation mutation can still refund it');

// The personalized can* fields are rendered by the human UI as well as consumed by Explore. They
// must include actor gates, or the card advertises a mutation guaranteed to refuse. Each fixture
// supplies an otherwise valid target behind one actor blocker.
const jailedUntil = new Date(Date.now() + 60_000);
const runnableFavorDb = {
  async query(sql) {
    if (/SELECT account_id FROM characters/i.test(sql)) return { rows: [{ account_id: 'acct-me' }] };
    if (/JOIN contacts/i.test(sql)) return { rows: [{
      id: 'favor-live', poster_character: 'poster', poster_name: 'Poster', poster_loc: 'brick',
      good_id: 'booze', qty: 1, pay: 600, district: 'brick', expires_at: new Date(Date.now() + 60_000),
    }] };
    if (/FROM favors WHERE poster_character/i.test(sql)) return { rows: [] };
    if (/FROM character_cargo/i.test(sql)) return { rows: [{ character_id: 'poster', n: 0 }] };
    if (/FROM character_assets|FROM character_skills/i.test(sql)) return { rows: [] };
    throw new Error(`unexpected runnable-favor query: ${sql}`);
  },
};
const jailedFavorBoard = await favorBoard(ch(30, { jail_until: jailedUntil }), runnableFavorDb, {
  owned: owned({ cargo: { booze: 1 } }),
});
assert.equal(jailedFavorBoard.open[0].canRun, false,
  'a jailed runner never receives an enabled favor operation');
assert.equal(Object.hasOwn(jailedFavorBoard.open[0], 'posterHere'), false,
  'the favor board exposes only the action boolean, not a separate poster-location predicate');

const emptyCornerDb = {
  async query(sql) {
    if (/FROM corner_jobs/i.test(sql) || /FROM corner_chains/i.test(sql)
        || /FROM daily_progress/i.test(sql)) return { rows: [] };
    throw new Error(`unexpected corner-gate query: ${sql}`);
  },
};
const jailedCornerBoard = await liveCornerBoard(ch(30, { jail_until: jailedUntil }), emptyCornerDb);
assert.equal(jailedCornerBoard.tasks.some((task) => task.canAccept || task.canClaim), false,
  'a jailed street never receives an enabled corner operation');
const fullCornerDb = {
  async query(sql) {
    if (/FROM corner_jobs/i.test(sql)) return { rows: Array.from({ length: CORNER.MAX_DAY }, (_, index) => ({
      district: 'canal', slot: 90 + index, claimed: true, baseline: '{}',
    })) };
    if (/FROM corner_chains/i.test(sql) || /FROM daily_progress/i.test(sql)) return { rows: [] };
    throw new Error(`unexpected full-corner query: ${sql}`);
  },
};
const fullCornerBoard = await liveCornerBoard(ch(30), fullCornerDb);
assert.equal(fullCornerBoard.tasks.some((task) => task.canAccept), true,
  'accept remains enabled after the claim allowance is spent because acceptCorner still commits');

const actorBlockedConvoyDb = {
  async query(sql) {
    if (/NOT c\.is_npc/i.test(sql)) return { rows: [{
      id: 'road', owner_character: 'other', owner_gang: null, owner: 'Other', is_npc: false,
      origin: 'docks', destination: 'brick', status: 'transit', ambushes: 0,
      arrives_at: new Date(Date.now() + 60_000),
    }] };
    if (/is_npc AND status='transit'/i.test(sql) || /FROM convoy_cargo/i.test(sql)
        || /FROM gang_members/i.test(sql) || /FROM convoy_ambushes/i.test(sql)
        || /WHERE owner_character/i.test(sql) || /FROM rigs/i.test(sql)
        || /FROM convoy_hauls/i.test(sql)) return { rows: [] };
    if (/freight_delivered/i.test(sql)) return { rows: [] };
    throw new Error(`unexpected convoy-gate query: ${sql}`);
  },
};
const blockedConvoys = await liveConvoyBoard(actorBlockedConvoyDb, 'char-me',
  ch(30, { jail_until: jailedUntil, energy: 0, ammo: 0 }));
assert.equal(blockedConvoys.inTransit[0].canAmbush, false,
  'the personalized road board includes actor status and resource gates');

const boardHeist = HEIST_JOBS.find((job) => !job.rateBps);
const actorBlockedHeistDb = {
  async query(sql) {
    if (/FROM crew_heists ch JOIN characters c/i.test(sql)) return { rows: [{
      id: 'open-job', job: boardHeist.id, created_at: new Date(), target_business: null,
      target_character: null, leader: 'Leader',
    }] };
    if (/SELECT m\.heist_id, m\.role/i.test(sql)) return { rows: [{ heist_id: 'open-job', role: boardHeist.roles[0] }] };
    if (/WHERE m\.character_id/i.test(sql)) return { rows: [] };
    if (/SELECT c\.heist_loot/i.test(sql)) return { rows: [{
      heist_loot: 0, heists_pulled: 100, respect: respectForLevel(30), cash: 100_000,
      jail_until: jailedUntil, hosp_until: null, safe_until: null, heist_at: null,
    }] };
    throw new Error(`unexpected heist-gate query: ${sql}`);
  },
};
const blockedHeists = await liveHeistBoard(actorBlockedHeistDb, 'char-me');
assert.equal(blockedHeists.open[0].canJoin, false,
  'the personalized heist board includes actor status and notoriety gates');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('street life')), ch(30), acct(), owned(), {
  live: { cornerBoard: { tasks: [], leftToday: 0 }, favorBoard: expiredFavorBoard },
});
assert.equal(coverage.next?.systemId, 'street-life',
  'an expired-but-unswept own favor exposes the valid cancellation operation');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('street life')), ch(30), acct(), owned(), {
  live: { cornerBoard: { leftToday: 0, tasks: [{ slot: 0, accepted: false, canAccept: false, canClaim: false }] },
    contactsBoard: { call: null }, favorBoard: { open: [], mine: [], canPost: false } },
});
assert.equal(coverage.next, null, 'an exhausted daily corner cannot accept an envelope that can never be claimed');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('street life')), ch(30), acct(), owned(), {
  live: { cornerBoard: { leftToday: 1, tasks: [{ slot: 0, accepted: true, canAccept: false, canClaim: true }] },
    contactsBoard: { call: null }, favorBoard: { open: [], mine: [], canPost: false } },
});
assert.equal(coverage.next?.systemId, 'street-life', 'completed accepted corner work is a live claim operation');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('street life')), ch(30), acct(), owned(), {
  live: { cornerBoard: { leftToday: 0, tasks: [] }, contactsBoard: { call: null },
    favorBoard: { open: [{ id: 'away', good: 'booze', qty: 1, here: true, canRun: false }], mine: [], canPost: false } },
});
assert.equal(coverage.next, null, 'a favor whose poster is away or full is not a runnable handoff');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('street life')), ch(30, { cash: 1000 }), acct(), owned(), {
  live: { cornerBoard: { leftToday: 0, tasks: [] }, contactsBoard: { call: null },
    favorBoard: { open: [], mine: [], canPost: true } },
});
assert.equal(coverage.next?.systemId, 'street-life', 'a board-proved favor post is a live Street Life operation');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('street life')),
  ch(30, { jail_until: new Date(Date.now() + 60_000) }), acct(), owned(), {
    live: { cornerBoard: { leftToday: 0, tasks: [] }, contactsBoard: { call: null },
      favorBoard: { open: [], mine: [{ id: 'mine' }], canPost: false } },
  });
assert.equal(coverage.next?.systemId, 'street-life',
  'a jailed poster can still cancel an open favor and reclaim its escrow');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('the megaproject')), ch(30), acct(),
  owned({ cargo: { booze: Math.ceil(MEGAPROJECT.MIN_CASH / 40) } }), {
    live: { megaBoard: { current: { remaining: 1 } } },
  });
assert.equal(coverage.next, null, 'freight cannot satisfy the contribution floor when only sub-floor wall dust remains');

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('convoys')),
  ch(30, { energy: CONVOY.AMBUSH_ENERGY, ammo: CONVOY.AMBUSH_AMMO }), acct(), owned(), {
    live: { convoyBoard: { mine: null, inTransit: [{ id: 'live-road', canAmbush: true }] } },
  });
assert.equal(coverage.next?.systemId, 'convoys',
  'a board-authorized live road ambush is a human Convoy operation without owning cargo or a shipment');
coverage = await Explore.systemCoverage(fakeDb(eventsExcept('convoys')),
  ch(30, { energy: CONVOY.AMBUSH_ENERGY, ammo: CONVOY.AMBUSH_AMMO }), acct({ agent_flag: true }), owned(), {
    live: { convoyBoard: { mine: null, inTransit: [{ id: 'live-road', canAmbush: true }] } },
  });
assert.equal(coverage.next, null, 'the same live road is not an autonomous PvP recommendation for an agent');
assert.equal(coverage.blocked.policy, 1, 'an otherwise executable agent road ambush is classified as policy');

// Full catalog parity: every row is isolated as the sole unvisited system. Each positive fixture names
// one representative authoritative mutation whose published gates the fixture satisfies. The two
// intentionally non-proactive rows are proved policy-blocked instead of being given a fake operation.
const minRacket = RACKETS.filter((racket) => racket.lvl <= 30).sort((a, b) => a.cost - b.cost)[0];
const minRace = RACES.TIERS.filter((tier) => tier.minLvl <= 30).sort((a, b) => a.fee - b.fee)[0];
const minRacer = Math.min(...Object.values(STABLE.KINDS).map((kind) => kind.cost));
const baseReady = () => ({ ch: ch(30), acct: acct(), owned: owned(), options: {} });
const operationCases = [
  ['streets / crime', 'streets-crime', 'POST /v1/crimes/:id', { ch: ch(30, { nerve: 2 }) }],
  ['the kitchen', 'kitchen', 'POST /v1/kitchen/lab', { ch: ch(30, { cash: KITCHENS[0].cost }) }],
  ['wet work', 'wet-work', 'POST /v1/jump/:targetId', { ch: ch(30, { health: 100, energy: 30, ammo: 10 }),
    options: { onlineAccounts: [{ accountId: 'other', characterId: 'target', loc: 'brick' }] } }],
  ['contracts', 'contracts', 'POST /v1/contracts/:targetId', { ch: ch(30, { cash: 1000 }),
    options: { onlineAccounts: [{ accountId: 'other', characterId: 'target', loc: 'brick' }] } }],
  ['the dueling ladder', 'dueling-ladder', 'POST /v1/duels/:targetId', { ch: ch(30, { cash: 2000 }),
    options: { onlineAccounts: [{ accountId: 'other', characterId: 'target', loc: 'brick',
      respect: respectForLevel(30), cash: 2000, duelLimit: 2000 }] } }],
  ['crew heists', 'crew-heists', 'POST /v1/heists/plan', { ch: ch(30, { cash: firstHeist.stake }),
    options: { live: { heistBoard: heistBoard() } } }],
  ['clue scrolls', 'clue-scrolls', 'POST /v1/clues/dig', { ch: ch(30, { energy: CLUES.DIG_ENERGY }),
    owned: owned({ work: { clue: { step: 0, steps: 3 } } }) }],
  ['the family', 'family', 'POST /v1/gangs/:id/join', { options: { onlineAccounts: [{ accountId: 'other', gangId: 'gang-1' }] } }],
  ['the commission', 'commission', 'POST /v1/commission/vote', { owned: owned({ gangId: 'gang-1', gangRole: 'boss' }),
    options: { live: { commissionSeatGangIds: ['gang-1'] } } }],
  ['territory', 'territory', 'POST /v1/territory/collect', { owned: owned({ gangId: 'gang-1' }),
    options: { live: { territoryBoard: { own: [{ district: 'brick', pending: 1, cold: false }], rival: null } } } }],
  ['the world', 'world', 'POST /v1/world/:npcId/raid', { ch: ch(30, { energy: 100, ammo: 100 }) }],
  ['the blood war', 'blood-war', 'POST /v1/family-war/:gangId/raid', { ch: ch(30, { energy: 100, ammo: 100 }),
    options: { live: { warBoard: { families: [{ id: 'npc-family', canRaid: true, heldBy: null, pact: null }] } } } }],
  ['business empire', 'business-empire', 'POST /v1/rackets/:id', { ch: ch(30, { cash: minRacket.cost }) }],
  ['convoys', 'convoys', 'POST /v1/convoy', { owned: owned({ cargo: { booze: CONVOY.MIN_QTY } }) }],
  ['the port', 'port', 'POST /v1/port/boat/:kind', { ch: ch(30, { loc: PORT.DISTRICT,
    cash: Math.min(...PORT.BOATS.map((boat) => boat.cost)) }) }],
  ['the black market', 'black-market', 'POST /v1/market/orders/:id/fill', { ch: ch(30, { loc: 'brick' }),
    owned: owned({ cargo: { booze: 2 } }), options: { live: { marketBoard: marketBoard([{
      id: 'wtb', kind: 'order', sellerId: 'other', good: 'booze', wanted: 2, unitPrice: 100, district: 'brick',
    }]) } } }],
  ['loan sharking', 'loan-sharking', 'POST /v1/loans/house', { options: { live: { loanBoard: loanBoard({
    house: { min: LOAN.HOUSE_MIN, available: LOAN.HOUSE_MIN, eligible: true, yourMarker: null },
  }) } } }],
  ['the casino', 'casino', 'POST /v1/casino/dice', { ch: ch(30, { loc: CASINO.DISTRICT,
    cash: CASINO.MIN_BET, nerve: CASINO.DICE_NERVE }) }],
  ['the speakeasy', 'speakeasy', 'POST /v1/speakeasy', { ch: ch(30, { cash: SPEAKEASY.OPEN_COST }),
    acct: acct({ made_until: new Date(Date.now() + 60_000) }), options: { live: { freeSpeakeasyDistricts: ['brick'] } } }],
  ['boxing', 'boxing', 'POST /v1/boxing/fighters', { ch: ch(30, { cash: BOXING.RECRUIT_COST }) }],
  ['street races', 'street-races', 'POST /v1/races/npc', { ch: ch(30, { cash: minRace.fee }),
    owned: owned({ cars: [raceCar()] }) }],
  ['the stable', 'stable', 'POST /v1/stable/racers', { ch: ch(30, { cash: minRacer }) }],
  ['the law', 'law', 'POST /v1/law/bribe', { ch: ch(30, { heat_exposure: 100, cash: 1_000_000 }) }],
  ['the pen', 'pen', 'POST /v1/pen/faction/:id', { ch: ch(30, { jail_until: new Date(Date.now() + 60_000) }) }],
  ['the wire', 'wire', 'POST /v1/wire/tap/:targetId', { acct: acct({ omr: WIRE.TAP_OMR }),
    options: { onlineAccounts: [{ accountId: 'other', characterId: 'target' }] } }],
  ['secrets', 'secrets', 'POST /v1/secrets/:id/expose', {
    options: { live: { secretsBoard: { held: [{ id: 'secret', on: 'target' }], onMe: [] } } } }],
  ['skills', 'skills', 'POST /v1/skills/:id', { ch: ch(4) }],
  ['the underworld', 'underworld', 'POST /v1/underworld/:npcId/errand', { owned: owned({ npc: { doc: 25 } }) }],
  ['the estate', 'estate', 'POST /v1/estate/tier', { acct: acct({ omr: ESTATE.TIERS[0].omr }) }],
  ['the made man', 'made-man', 'POST /v1/made/dues', { acct: acct({ omr: MADE.OMR }) }],
  ['the auction house', 'auction-house', 'POST /v1/auction/:lotId/bid', { acct: acct({ omr: 100 }),
    options: { live: { auctionMinBid: 100 } } }],
  ['the collection', 'collection', 'POST /v1/collection/:kind/:id/rarity', { acct: acct({ omr: 150 }),
    options: { live: { collectionItems: [commonCar] } } }],
  ['going legit', 'going-legit', 'POST /v1/stake', { acct: acct({ omr: 1 }) }],
  ['the megaproject', 'megaproject', 'POST /v1/megaproject/cash', { ch: ch(30, { cash: MEGAPROJECT.MIN_CASH }),
    options: { live: { megaBoard: { current: { remaining: 1000 } } } } }],
  ['street life', 'street-life', 'POST /v1/corner/:slot', {
    options: { live: { cornerBoard: { tasks: [{ slot: 0, accepted: false, canAccept: true }] } } } }],
  ['landmarks', 'landmarks', 'POST /v1/landmarks/:districtId', { acct: acct({ omr: LANDMARKS.MIN_DEDICATE }),
    options: { live: { landmarkMinDedicate: LANDMARKS.MIN_DEDICATE } } }],
  ['street deeds', 'street-deeds', 'POST /v1/deeds/claim', {}],
  ['vanity', 'vanity', 'POST /v1/vanity/name', { acct: acct({ omr: VANITY.NAME_CHANGE_OMR }) }],
  ['the store / pass', null, 'policy: never proactive', {}],
  ['growth / social', 'growth-social', 'POST /v1/vouch/:characterId', {
    options: { onlineAccounts: [{ accountId: 'other', characterId: 'target' }] } }],
];
assert.equal(operationCases.length, 40, 'the operation-parity table covers every canonical system exactly once');
assert.deepEqual(operationCases.map(([system]) => system), Object.keys(ENGAGEMENT_SYSTEMS),
  'the operation-parity table follows the canonical 40-system order');
for (const [system, expectedId, operation, patch] of operationCases) {
  const base = baseReady();
  const input = { ...base, ...patch, options: { ...base.options, ...(patch.options || {}) } };
  const result = await Explore.systemCoverage(fakeDb(eventsExcept(system)), input.ch, input.acct, input.owned, input.options);
  assert.equal(result.next?.systemId || null, expectedId, `${system}: ${operation} parity`);
  if (!expectedId) assert.equal(result.blocked.policy, 1, `${system}: the sole row is policy-blocked`);
}

// Reverse parity: each fixture deliberately leaves the target as the sole unvisited row but gives
// the character no operation that can pass the corresponding authoritative mutation. These are the
// coarse-proxy failures most likely to create a one-card dead end. A later system cannot hide one,
// because account telemetry marks every sibling visited.
const noOperationCases = [
  ['streets / crime', ch(30, { nerve: Math.min(...CRIMES.map((crime) => crime.nerve)) - 1 }), acct(), owned(), {},
    'no crime is executable without the cheapest nerve cost'],
  ['clue scrolls', ch(30, { energy: CLUES.DIG_ENERGY, jail_until: new Date(Date.now() + 60_000) }), acct(),
    owned({ work: { clue: { step: 0, steps: 3 } } }), {}, 'a scroll cannot be dug from lockup'],
  ['territory', ch(30, { safe_until: new Date(Date.now() + 60_000) }), acct(), owned({ gangId: 'gang-1' }), {},
    'family membership is not a usable territory operation while collection is safehouse-blocked'],
  ['convoys', ch(30, { jail_until: new Date(Date.now() + 60_000) }), acct(),
    owned({ cargo: { booze: CONVOY.MIN_QTY } }), {}, 'freight cannot be opened or loaded from lockup'],
  ['the port', ch(30, { loc: 'brick', cash: Math.min(...PORT.BOATS.map((boat) => boat.cost)) }), acct(), owned(),
    { live: { portBoard: { atDocks: false, fleet: [], catalog: PORT.BOATS, fleetMax: 1 } } },
    'cash alone does not move the boatyard out of the docks'],
  ['the casino', ch(30, { loc: 'brick', cash: CASINO.MIN_BET, nerve: CASINO.DICE_NERVE }), acct(), owned(), {},
    'the table is only actionable in the casino district'],
  ['the speakeasy', ch(30, { cash: SPEAKEASY.OPEN_COST, jail_until: new Date(Date.now() + 60_000) }),
    acct({ made_until: new Date(Date.now() + 60_000) }), owned(), { live: { freeSpeakeasyDistricts: ['brick'] } },
    'a made player cannot open a club from lockup'],
  ['boxing', ch(30, { cash: BOXING.RECRUIT_COST, jail_until: new Date(Date.now() + 60_000) }), acct(), owned(), {},
    'fighter cash is not an executable signing from lockup'],
  ['the stable', ch(30, { cash: minRacer, jail_until: new Date(Date.now() + 60_000) }), acct(), owned(),
    { live: { stableBoard: { stable: [], stableMax: STABLE.STABLE_MAX, kinds: STABLE.KINDS } } },
    'racing stock cannot be bought from lockup'],
  ['the law', ch(30, { wanted_until: new Date(Date.now() + 60_000) }), acct(), owned(), {},
    'wanted status is not itself a Law-board operation'],
  ['the pen', ch(30, { jail_until: new Date(Date.now() + 60_000), hole_until: new Date(Date.now() + 60_000) }),
    acct(), owned(), {}, 'the hole blocks every Pen operation'],
  ['the wire', ch(30), acct({ omr: 1 }), owned(),
    { onlineAccounts: [{ accountId: 'other', characterId: 'target' }], live: { wireBoard: {
      costs: { tap: WIRE.TAP_OMR, sub: WIRE.SUB_OMR, disinfo: WIRE.DISINFO_OMR }, watches: [],
      taps: [], informants: [], bugsOnYou: 0, subTiers: [],
    } } }, 'a token below every live Wire quote buys no operation'],
  ['secrets', ch(30), acct(), owned({ hunt: { target: 'target' } }),
    { onlineAccounts: [{ accountId: 'other', characterId: 'target' }], live: { secretsBoard: { held: [], onMe: [] } } },
    'an unrelated active search is not a Secrets operation'],
  ['the underworld', ch(30), acct(), owned({ npc: { doc: 1 } }),
    { live: { underworldBoard: { errand: null, gift: { cost: 5000, cap: 50 }, penance: 5000,
      npcs: [{ id: 'doc', standing: 1, grudge: 0 }] } } }, 'standing with no affordable or unlocked action is not readiness'],
  ['the made man', ch(30, { jail_until: new Date(Date.now() + 60_000) }), acct({ omr: MADE.OMR }), owned(), {},
    'dues cannot be paid from lockup'],
  ['the megaproject', ch(30, { cash: MEGAPROJECT.MIN_CASH, jail_until: new Date(Date.now() + 60_000) }), acct(), owned(),
    { live: { megaBoard: { current: { remaining: 1000 } } } }, 'no monument contribution leaves lockup'],
  ['street life', ch(30, { jail_until: new Date(Date.now() + 60_000) }), acct(),
    owned({ work: { cornerOpen: [{ slot: 0 }] } }),
    { live: { cornerBoard: { leftToday: 1, tasks: [{ slot: 0, accepted: false, claimed: false }] },
      contactsBoard: { call: null }, favorBoard: { open: [], mine: [] } } }, 'corner work cannot be accepted from lockup'],
  ['growth / social', ch(30), acct(), owned(), {
    onlineAccounts: [{ accountId: 'other', characterId: 'target' }],
    live: { vouchBoard: { slotsLeft: 0, given: [] } },
  }, 'an online player does not create a vouch slot'],
];
for (const [system, character, account, holdings, options, message] of noOperationCases) {
  const result = await Explore.systemCoverage(fakeDb(eventsExcept(system)), character, account, holdings, options);
  assert.equal(result.next, null, `${system}: ${message}`);
  assert.equal(result.progress.eligible, 0, `${system}: no authoritative operation means no ready row`);
}

// Pin coverage to the authoritative mutation itself: unlike NFT extraction, rarity upgrades do not
// reject market/collateral or at-sea state. Both encumbered rows must pass the real upgrade function.
const assertAuthoritativeUpgrade = async (kind, row) => {
  let updatedTo = null;
  const ledger = [];
  const events = [];
  const routeDb = {
    async query(sql, params) {
      if (/^SELECT \*/i.test(sql)) return { rows: [row] };
      if (/^UPDATE /i.test(sql)) { updatedTo = params[1]; return { rows: [] }; }
      throw new Error(`unexpected rarity-upgrade query: ${sql}`);
    },
  };
  const h = {
    accountId: 'acct-me', acct: { omr: 150 }, owned: { cars: kind === 'car' ? [row] : [] },
    ledger: async (_client, entry) => ledger.push(entry),
    track: async (_client, _accountId, event) => events.push(event),
  };
  const result = await upgradeRarity(ch(30), kind, row.id, routeDb, h);
  assert.equal(result.rarity, 'rare');
  assert.equal(updatedTo, 'rare');
  assert.equal(h.acct.omr, 0);
  assert.deepEqual(ledger.map(({ amount, reason }) => ({ amount, reason })),
    [{ amount: -150, reason: 'rarity:upgrade' }]);
  assert.deepEqual(events, ['rarity_upgrade']);
};
await assertAuthoritativeUpgrade('car', { ...commonCar, listed: true, pledged: true });
await assertAuthoritativeUpgrade('boat', {
  ...commonBoat, kind: PORT.BOATS[0].id, run_until: new Date(Date.now() + 60_000),
});

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

coverage = await Explore.systemCoverage(fakeDb(eventsExcept('contracts')), ch(30, { cash: 10_000 }), acct(), owned(), {
  onlineAccounts: [{ accountId: 'dead-presence', characterId: 'dead-target' }],
  live: { socialTargets: [] },
});
assert.equal(coverage.next, null,
  'an authoritative empty social slice never falls back to stale raw websocket presence');
assert.equal(coverage.blocked.social, 1, 'a just-dead presence is classified as no reachable counterparty');

// Presence is an internal routing hint, not an eligibility budget. A city can have more than one
// screenful online; the authoritative character query must still reach a valid operation after any
// number of stale/dead presence entries without returning those identities in the Explore payload.
const crowdedPresence = Array.from({ length: 100 }, (_, index) => ({
  accountId: `stale-account-${index}`,
  characterId: `stale-character-${index}`,
}));
crowdedPresence.push({ accountId: 'reachable-account', characterId: 'reachable-character' });
const crowdedSocialDb = {
  async query(sql, params = []) {
    if (/FROM telemetry/i.test(sql)) return { rows: eventsExcept('contracts') };
    if (/FROM vouches v/i.test(sql)) return { rows: [] };
    if (/COUNT\(\*\).*FROM vouches/i.test(sql)) return { rows: [{ n: 0 }] };
    if (/FROM characters c JOIN account_persistent ap/i.test(sql)) return {
      rows: params.some((value) => String(value).includes('reachable-account')
        || String(value).includes('reachable-character')) ? [{
        id: 'reachable-character', account_id: 'reachable-account', respect: respectForLevel(30),
        cash: 10_000, jail_until: null, hosp_until: null, witpro_until: null, pen_safe_until: null,
        hole_until: null, duel_limit: 10_000, wanted_until: null, rat: false,
      }] : [],
    };
    if (/SELECT character_id, gang_id FROM gang_members/i.test(sql)
        || /SELECT account_id, crew_id FROM crew_members/i.test(sql)
        || /FROM secrets WHERE holder_character/i.test(sql)
        || /FROM digs WHERE character_id/i.test(sql)) return { rows: [] };
    throw new Error(`unexpected crowded-social query: ${sql}`);
  },
};
coverage = await Explore.exploreBoard(crowdedSocialDb, ch(30, { cash: 10_000 }), acct(), owned(), {
  onlineAccounts: crowdedPresence,
});
assert.equal(coverage.next?.systemId, 'contracts',
  'an authoritative operation after the first 100 presence hints remains exactly discoverable');

// Global socket coverage is a set-valued query input, not a reason to issue one SQL round trip per
// screenful. Exercise both edges of the accepted scale finding: 101 human rows without gangs used
// to cost 13 social queries, while 4,350 rows in distinct gangs cost 436. The fake is only the SQL
// boundary; eligibility, deduplication, privacy, and the query orchestration are the real Explore code.
const scaledSocialDb = (size, { gangs = false, injectionHint = null } = {}) => {
  const characters = Array.from({ length: size }, (_, index) => ({
    id: `scale-character-${index}`, account_id: `scale-account-${index}`,
    respect: respectForLevel(30), cash: 10_000, jail_until: null, hosp_until: null,
    witpro_until: null, pen_safe_until: null, hole_until: null, duel_limit: 10_000,
    wanted_until: null, rat: false,
  }));
  const queries = [];
  const valuesOf = (params) => new Set(params.flatMap((value) =>
    typeof value === 'string' ? value.match(/scale-(?:character|account|gang)-\d+/g) || [] : []));
  const db = {
    queries,
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/FROM telemetry/i.test(sql)) return { rows: eventsExcept('contracts') };
      if (/FROM vouches v/i.test(sql)) return { rows: [] };
      if (/COUNT\(\*\).*FROM vouches/i.test(sql)) return { rows: [{ n: 0 }] };
      if (/FROM characters c JOIN account_persistent ap/i.test(sql)) {
        const values = valuesOf(params);
        return { rows: characters.filter((row) => values.has(row.id) || values.has(row.account_id)) };
      }
      if (/SELECT character_id, gang_id FROM gang_members/i.test(sql)) {
        if (!gangs) return { rows: [] };
        const values = valuesOf(params);
        return { rows: characters.filter((row) => values.has(row.id))
          .map((row) => ({ character_id: row.id, gang_id: row.id.replace('character', 'gang') })) };
      }
      if (/SELECT account_id, crew_id FROM crew_members/i.test(sql)
          || /FROM secrets WHERE holder_character/i.test(sql)
          || /FROM digs WHERE character_id/i.test(sql)) return { rows: [] };
      if (/SELECT gang_id, COUNT\(\*\) n FROM gang_members/i.test(sql)) {
        const values = valuesOf(params);
        return { rows: [...values].filter((value) => value.startsWith('scale-gang-'))
          .map((gang_id) => ({ gang_id, n: 1 })) };
      }
      throw new Error(`unexpected scaled-social query: ${sql}`);
    },
  };
  const onlineAccounts = characters.map((row) => ({ accountId: row.account_id, characterId: row.id }));
  if (onlineAccounts.length) onlineAccounts.push(onlineAccounts[0], { ...onlineAccounts[0] });
  if (injectionHint) onlineAccounts.push({ accountId: injectionHint, characterId: injectionHint });
  return { db, onlineAccounts, socialQueries: () => queries.filter(({ sql }) =>
    /FROM characters c JOIN account_persistent ap|SELECT character_id, gang_id FROM gang_members|SELECT account_id, crew_id FROM crew_members|FROM secrets WHERE holder_character|FROM digs WHERE character_id|SELECT gang_id, COUNT\(\*\) n FROM gang_members/i.test(sql)) };
};

const injectionHint = "scale-probe-'); DROP TABLE accounts; --";
const assertIndexedSocialSql = (queries) => {
  const query = (pattern) => queries.find(({ sql }) => pattern.test(sql));
  const membership = [
    [query(/FROM characters c JOIN account_persistent ap/i), [
      [/c\.id\s*=\s*ANY\(\$1::text\[\]\)/i, 0],
      [/c\.account_id\s*=\s*ANY\(\$2::text\[\]\)/i, 1],
    ]],
    [query(/SELECT character_id, gang_id FROM gang_members/i), [
      [/character_id\s*=\s*ANY\(\$1::text\[\]\)/i, 0],
    ]],
    [query(/SELECT account_id, crew_id FROM crew_members/i), [
      [/account_id\s*=\s*ANY\(\$1::text\[\]\)/i, 0],
    ]],
    [query(/FROM digs WHERE character_id/i), [
      [/target_account\s*=\s*ANY\(\$2::text\[\]\)/i, 1],
    ]],
  ];
  const gangCount = query(/SELECT gang_id, COUNT\(\*\) n FROM gang_members/i);
  if (gangCount) membership.push([gangCount, [[/gang_id\s*=\s*ANY\(\$1::text\[\]\)/i, 0]]]);
  for (const { sql } of queries) {
    assert.doesNotMatch(sql, /\$\d+::text\[\]\s*&&\s*ARRAY\s*\[/i,
      'set-valued Explore filters never put the indexed column inside an array-overlap expression');
  }
  for (const [entry, predicates] of membership) {
    assert.ok(entry, 'every set-valued social enrichment query remains present');
    for (const [predicate, paramIndex] of predicates) {
      assert.match(entry.sql, predicate,
        'set-valued Explore filters use scalar-array membership on the indexed column');
      assert.equal(Array.isArray(entry.params[paramIndex]), false,
        'ANY receives an escaped scalar Postgres array literal, never a JavaScript array');
      assert.match(entry.params[paramIndex], /^\{.*\}$/s,
        'ANY receives a bound Postgres array literal rather than interpolated SQL');
    }
  }
};
const scaleCases = [
  { size: 101, gangs: false, expectedSocialQueries: 5, injectionHint },
  { size: 4_350, gangs: true, expectedSocialQueries: 6, injectionHint: null },
];
const scaleResults = [];
for (const fixture of scaleCases) {
  const scaled = scaledSocialDb(fixture.size, fixture);
  const board = await Explore.exploreBoard(scaled.db, ch(30, { cash: 10_000 }), acct(), owned(), {
    onlineAccounts: scaled.onlineAccounts,
  });
  const socialQueries = scaled.socialQueries();
  assertIndexedSocialSql(socialQueries);
  scaleResults.push(socialQueries.length);
  assert.equal(board.next?.systemId, 'contracts',
    `${fixture.size} visible humans preserve the authoritative social operation`);
  assert.equal(Object.hasOwn(board, 'socialTargets'), false,
    'internal social target enrichment never enters the Explore payload');
  assert.equal(Object.hasOwn(board, 'joinableFamilyIds'), false,
    'internal family reachability never enters the Explore payload');
  if (fixture.injectionHint) {
    assert.ok(socialQueries.every(({ sql }) => !sql.includes(fixture.injectionHint)),
      'presence identifiers remain bound data, never SQL text');
    assert.ok(socialQueries.some(({ params }) => params.some((value) => String(value).includes(fixture.injectionHint))),
      'the injection-shaped hint reaches the database only through a bound parameter');
  }
}
assert.deepEqual(scaleResults, scaleCases.map((fixture) => fixture.expectedSocialQueries),
  'social eligibility SQL stays set-oriented and constant-round-trip at 101 and 4,350 visible users');

const emptyScaled = scaledSocialDb(0);
const emptyScaleBoard = await Explore.exploreBoard(emptyScaled.db, ch(30, { cash: 10_000 }), acct(), owned(), {
  onlineAccounts: [],
});
assert.equal(emptyScaleBoard.next, null, 'empty presence preserves an empty authoritative social slice');
assert.equal(emptyScaled.socialQueries().length, 0, 'empty presence performs no social enrichment SQL');

// Route integration: account telemetry changes the recommendation, the response never becomes a grid,
// and repeated reads append no economic ledger rows.
const app = await buildServer();
const pool = app.pool;
const call = async (method, url, { token, body, idempotencyKey } = {}) => {
  const res = await app.inject({ method, url, headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  }, payload: body });
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

// Route parity for the two Finding-3 seams: the real board makes the sole unvisited row ready, then
// the exact mutation named by the fixture succeeds. These use the in-memory test database only.
const markVisitedExcept = async (targetSystem, targetAccountId, prefix) => {
  let n = 0;
  for (const [system, events] of Object.entries(ENGAGEMENT_SYSTEMS)) {
    if (system === targetSystem) continue;
    await pool.query('INSERT INTO telemetry (id,account_id,event,props) VALUES ($1,$2,$3,$4)',
      [`${prefix}-${n++}`, targetAccountId, events[0], '{}']);
  }
};

const { body: { token: loanToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: loanToken, body: { name: 'Window Lou' } });
const loanMe = (await call('GET', '/v1/me', { token: loanToken })).body.character;
const loanAccountId = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [loanMe.id])).rows[0].account_id;
await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [loanMe.id, respectForLevel(30)]);
await pool.query('UPDATE loan_house SET pool=$1 WHERE id=1', [LOAN.HOUSE_MIN]);
await markVisitedExcept('loan sharking', loanAccountId, 'coverage-loan');
routeBoard = (await call('GET', '/v1/explore', { token: loanToken })).body;
assert.equal(routeBoard.next?.systemId, 'loan-sharking',
  'the production Loan House board makes borrowing the sole unvisited ready system for a human');
const routeLoan = await call('POST', '/v1/loans/house', { token: loanToken, body: { amount: LOAN.HOUSE_MIN } });
assert.equal(routeLoan.code, 200, 'the human borrowing operation witnessed by Explore passes the authoritative mutation');

const { body: { token: vanityToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: vanityToken, body: { name: 'Vanity Vera' } });
const vanityMe = (await call('GET', '/v1/me', { token: vanityToken })).body.character;
const vanityAccountId = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [vanityMe.id])).rows[0].account_id;
await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [vanityMe.id, respectForLevel(30)]);
await pool.query('UPDATE account_persistent SET omr=$2 WHERE account_id=$1', [vanityAccountId, VANITY.TITLE_OMR]);
await markVisitedExcept('vanity', vanityAccountId, 'coverage-vanity');
routeBoard = (await call('GET', '/v1/explore', { token: vanityToken })).body;
assert.equal(routeBoard.next?.systemId, 'vanity',
  'published identity-shop $OMR alone makes Vanity the sole unvisited ready system');
const routeTitle = await call('POST', '/v1/vanity/title', {
  token: vanityToken, body: { title: 'The Exacting' },
});
assert.equal(routeTitle.code, 200, 'the title operation witnessed by the Vanity price passes its authoritative mutation');
await pool.query('UPDATE account_persistent SET omr=$2 WHERE account_id=$1', [vanityAccountId, VANITY.NAME_CHANGE_OMR]);
const routeName = await call('POST', '/v1/vanity/name', {
  token: vanityToken, body: { name: 'Vera Exacting' },
});
assert.equal(routeName.code, 200, 'the name operation witnessed by the Vanity price passes its authoritative mutation');

// Presentation caps may bound a public board, but they may never become an eligibility cap. One
// hundred expired-but-unswept orders sort ahead of the live row here: the UI remains bounded and
// empty after expiry filtering, while Explore must still find the actor-scoped fill operation.
const { body: { token: cappedMarketToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: cappedMarketToken, body: { name: 'Market Marcy' } });
const cappedMarketMe = (await call('GET', '/v1/me', { token: cappedMarketToken })).body.character;
const cappedMarketAccount = (await pool.query(
  'SELECT account_id FROM characters WHERE id=$1', [cappedMarketMe.id])).rows[0].account_id;
await pool.query('UPDATE characters SET respect=$2, cash=0, loc=$3 WHERE id=$1',
  [cappedMarketMe.id, respectForLevel(30), 'brick']);
await pool.query('INSERT INTO character_cargo (character_id,good_id,qty) VALUES ($1,$2,$3)',
  [cappedMarketMe.id, 'booze', 1]);
const { body: { token: marketBuyerToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: marketBuyerToken, body: { name: 'Buyer Bruno' } });
const marketBuyer = (await call('GET', '/v1/me', { token: marketBuyerToken })).body.character;
for (let index = 0; index < 100; index++) {
  await pool.query(
    `INSERT INTO market_listings
       (id,seller_character,kind,good_id,qty,district,price,status,expires_at)
     VALUES ($1,$2,'order','booze',1,'brick',100,'live',$3)`,
    [`capped-expired-order-${index}`, marketBuyer.id, new Date(Date.now() - (200 - index) * 1000)]);
}
const cappedMarketOrder = 'capped-live-order-101';
await pool.query(
  `INSERT INTO market_listings
     (id,seller_character,kind,good_id,qty,district,price,status,expires_at)
   VALUES ($1,$2,'order','booze',1,'brick',100,'live',$3)`,
  [cappedMarketOrder, marketBuyer.id, new Date(Date.now() + 3600_000)]);
const cappedMarketBoard = (await call('GET', '/v1/market')).body;
assert.equal(cappedMarketBoard.listings.length, 0,
  'the ordinary Market UI stays capped and filters its first 100 expired rows');
await markVisitedExcept('the black market', cappedMarketAccount, 'coverage-market-cap');
routeBoard = (await call('GET', '/v1/explore', { token: cappedMarketToken })).body;
assert.equal(routeBoard.next?.systemId, 'black-market',
  'a fillable order after the presentation cap remains exactly eligible');
const cappedMarketFill = await call('POST', `/v1/market/${cappedMarketOrder}/fill`, {
  token: cappedMarketToken, body: { qty: 1 },
});
assert.equal(cappedMarketFill.code, 200,
  'the beyond-cap Market fill witnessed by Explore passes the authoritative mutation');

// The loan market's 50 rows are likewise presentation, not authority. Newer self-authored offers
// occupy the screen while an older public offer remains genuinely takeable.
const { body: { token: cappedLoanToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: cappedLoanToken, body: { name: 'Loan Lenny' } });
const cappedLoanMe = (await call('GET', '/v1/me', { token: cappedLoanToken })).body.character;
const cappedLoanAccount = (await pool.query(
  'SELECT account_id FROM characters WHERE id=$1', [cappedLoanMe.id])).rows[0].account_id;
await pool.query('UPDATE characters SET respect=$2, cash=0 WHERE id=$1',
  [cappedLoanMe.id, respectForLevel(30)]);
for (let index = 0; index < 50; index++) {
  await pool.query(
    `INSERT INTO loans (id,lender_character,principal,rate,hours,status,offered_at)
     VALUES ($1,$2,$3,$4,24,'open',$5)`,
    [`capped-own-offer-${index}`, cappedLoanMe.id, LOAN.MIN, 0.1,
      new Date(Date.now() - index * 1000)]);
}
const cappedLoanOffer = 'capped-public-offer-51';
await pool.query(
  `INSERT INTO loans (id,lender_character,principal,rate,hours,status,offered_at)
   VALUES ($1,$2,$3,$4,24,'open',$5)`,
  [cappedLoanOffer, marketBuyer.id, LOAN.MIN, 0.1, new Date(Date.now() - 60_000)]);
const cappedLoanBoard = (await call('GET', '/v1/loans', { token: cappedLoanToken })).body;
assert.equal(cappedLoanBoard.offers.length, 50, 'the ordinary Loan UI keeps its 50-offer cap');
assert.ok(cappedLoanBoard.offers.every((offer) => offer.mine),
  'the takeable 51st offer does not leak into the capped UI board');
await markVisitedExcept('loan sharking', cappedLoanAccount, 'coverage-loan-offer-cap');
routeBoard = (await call('GET', '/v1/explore', { token: cappedLoanToken })).body;
assert.equal(routeBoard.next?.systemId, 'loan-sharking',
  'a takeable loan offer after the presentation cap remains exactly eligible');
const cappedLoanTake = await call('POST', `/v1/loans/${cappedLoanOffer}/take`, { token: cappedLoanToken });
assert.equal(cappedLoanTake.code, 200,
  'the beyond-cap loan take witnessed by Explore passes the authoritative mutation');

// Paper has an independent 50-row window. The first fifty asks are the actor's own paper (invalid
// by buyPaper), followed by one affordable receivable from two other living players.
await pool.query("UPDATE loans SET status='cancelled' WHERE status='open'");
const { body: { token: cappedPaperToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: cappedPaperToken, body: { name: 'Paper Penny' } });
const cappedPaperMe = (await call('GET', '/v1/me', { token: cappedPaperToken })).body.character;
const cappedPaperAccount = (await pool.query(
  'SELECT account_id FROM characters WHERE id=$1', [cappedPaperMe.id])).rows[0].account_id;
await pool.query('UPDATE characters SET respect=$2, cash=2 WHERE id=$1',
  [cappedPaperMe.id, respectForLevel(30)]);
for (let index = 0; index < 50; index++) {
  await pool.query(
    `INSERT INTO loans
       (id,lender_character,borrower_character,principal,rate,hours,status,due_at,for_sale)
     VALUES ($1,$2,$3,$4,$5,24,'active',$6,1)`,
    [`capped-own-paper-${index}`, cappedPaperMe.id, marketBuyer.id, LOAN.MIN, 0.1,
      new Date(Date.now() + 3600_000)]);
}
const cappedLoanPaper = 'capped-public-paper-51';
await pool.query(
  `INSERT INTO loans
     (id,lender_character,borrower_character,principal,rate,hours,status,due_at,for_sale)
   VALUES ($1,$2,$3,$4,$5,24,'active',$6,2)`,
  [cappedLoanPaper, marketBuyer.id, cappedLoanMe.id, LOAN.MIN, 0.1,
    new Date(Date.now() + 3600_000)]);
const cappedPaperBoard = (await call('GET', '/v1/loans', { token: cappedPaperToken })).body;
assert.equal(cappedPaperBoard.paper.length, 50, 'the ordinary Loan UI keeps its 50-paper cap');
assert.ok(!cappedPaperBoard.paper.some((paper) => paper.id === cappedLoanPaper),
  'the affordable 51st receivable does not leak into the capped UI board');
assert.ok(cappedPaperBoard.paper.every((paper) => paper.mine),
  'the capped rows are all paper the actor already owns');
await markVisitedExcept('loan sharking', cappedPaperAccount, 'coverage-loan-paper-cap');
routeBoard = (await call('GET', '/v1/explore', { token: cappedPaperToken })).body;
assert.equal(routeBoard.next?.systemId, 'loan-sharking',
  'an affordable loan paper after the presentation cap remains exactly eligible');
const cappedPaperBuy = await call('POST', `/v1/loans/${cappedLoanPaper}/buy`, { token: cappedPaperToken });
assert.equal(cappedPaperBuy.code, 200,
  'the beyond-cap paper purchase witnessed by Explore passes the authoritative mutation');

// Crew Heists shows thirty newest plans. Fill those seats completely, then put one ordinary PvE
// plan at row 31 with a real open role: eligibility must search the authoritative planning set.
const { body: { token: cappedHeistToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: cappedHeistToken, body: { name: 'Heist Hattie' } });
const cappedHeistMe = (await call('GET', '/v1/me', { token: cappedHeistToken })).body.character;
const cappedHeistAccount = (await pool.query(
  'SELECT account_id FROM characters WHERE id=$1', [cappedHeistMe.id])).rows[0].account_id;
await pool.query('UPDATE characters SET respect=$2, cash=0 WHERE id=$1',
  [cappedHeistMe.id, respectForLevel(30)]);
for (let index = 0; index < 30; index++) {
  const id = `capped-full-heist-${index}`;
  await pool.query(
    `INSERT INTO crew_heists (id,job,leader_character,status,created_at)
     VALUES ($1,'corner',$2,'planning',$3)`,
    [id, marketBuyer.id, new Date(Date.now() - index * 1000)]);
  await pool.query(
    `INSERT INTO crew_heist_members (heist_id,character_id,role) VALUES
      ($1,$2,'muscle'),($1,$3,'wheelman')`, [id, marketBuyer.id, cappedLoanMe.id]);
}
const cappedHeistPlan = 'capped-open-heist-31';
await pool.query(
  `INSERT INTO crew_heists (id,job,leader_character,status,created_at)
   VALUES ($1,'corner',$2,'planning',$3)`,
  [cappedHeistPlan, marketBuyer.id, new Date(Date.now() - 60_000)]);
await pool.query(
  `INSERT INTO crew_heist_members (heist_id,character_id,role) VALUES ($1,$2,'muscle')`,
  [cappedHeistPlan, marketBuyer.id]);
const cappedHeistBoard = (await call('GET', '/v1/heists', { token: cappedHeistToken })).body;
assert.equal(cappedHeistBoard.open.length, 30, 'the ordinary Heist UI keeps its 30-plan cap');
assert.ok(!cappedHeistBoard.open.some((plan) => plan.id === cappedHeistPlan),
  'the joinable 31st plan does not leak into the capped UI board');
await markVisitedExcept('crew heists', cappedHeistAccount, 'coverage-heist-cap');
routeBoard = (await call('GET', '/v1/explore', { token: cappedHeistToken })).body;
assert.equal(routeBoard.next?.systemId, 'crew-heists',
  'a joinable PvE heist after the presentation cap remains exactly eligible');
const cappedHeistJoin = await call('POST', `/v1/heists/${cappedHeistPlan}/join`, {
  token: cappedHeistToken, body: { role: 'wheelman' },
});
assert.equal(cappedHeistJoin.code, 200,
  'the beyond-cap heist join witnessed by Explore passes the authoritative mutation');

// The exact scan retains the same conservative agent policy as the capped board: ordinary PvE
// co-op remains discoverable, while a player-front inside job is policy-only, never executable.
const { body: { token: agentGuestToken } } = await call('POST', '/v1/auth/guest');
const { body: { token: cappedHeistAgentToken } } = await call('POST', '/v1/auth/agent-key', {
  token: agentGuestToken,
});
await call('POST', '/v1/character', { token: cappedHeistAgentToken, body: { name: 'Agent Angie' } });
const cappedHeistAgent = (await call('GET', '/v1/me', { token: cappedHeistAgentToken })).body.character;
const cappedHeistAgentAccount = (await pool.query(
  'SELECT account_id FROM characters WHERE id=$1', [cappedHeistAgent.id])).rows[0].account_id;
await pool.query('UPDATE characters SET respect=$2, cash=0 WHERE id=$1',
  [cappedHeistAgent.id, respectForLevel(30)]);
const cappedAgentPvePlan = 'capped-agent-pve-heist';
await pool.query(
  `INSERT INTO crew_heists (id,job,leader_character,status,created_at)
   VALUES ($1,'corner',$2,'planning',$3)`,
  [cappedAgentPvePlan, marketBuyer.id, new Date(Date.now() - 70_000)]);
await pool.query(
  `INSERT INTO crew_heist_members (heist_id,character_id,role) VALUES ($1,$2,'muscle')`,
  [cappedAgentPvePlan, marketBuyer.id]);
await markVisitedExcept('crew heists', cappedHeistAgentAccount, 'coverage-agent-heist-cap');
routeBoard = (await call('GET', '/v1/explore', { token: cappedHeistAgentToken })).body;
assert.equal(routeBoard.next?.systemId, 'crew-heists',
  'agent exact eligibility preserves an ordinary beyond-cap PvE heist join');
await pool.query("UPDATE crew_heists SET status='abandoned' WHERE id=$1", [cappedAgentPvePlan]);
const cappedAgentTargetBusiness = 'capped-agent-inside-target';
await pool.query(
  `INSERT INTO businesses (id,character_id,kind) VALUES ($1,$2,'laundromat')`,
  [cappedAgentTargetBusiness, marketBuyer.id]);
const cappedAgentInsidePlan = 'capped-agent-inside-heist';
await pool.query(
  `INSERT INTO crew_heists (id,job,leader_character,target_business,status,created_at)
   VALUES ($1,'inside',$2,$3,'planning',$4)`,
  [cappedAgentInsidePlan, cappedLoanMe.id, cappedAgentTargetBusiness,
    new Date(Date.now() - 80_000)]);
await pool.query(
  `INSERT INTO crew_heist_members (heist_id,character_id,role) VALUES ($1,$2,'brains')`,
  [cappedAgentInsidePlan, cappedLoanMe.id]);
routeBoard = (await call('GET', '/v1/explore', { token: cappedHeistAgentToken })).body;
assert.equal(routeBoard.next, null,
  'agent exact eligibility excludes a beyond-cap player-front inside-job join');
assert.equal(routeBoard.blocked.policy, 1,
  'an otherwise joinable exact inside-job witness is classified as agent policy');

// Street Life's Favor board presents the forty richest reachable asks. Keep all forty invalid by
// moving their poster away, then put a face-to-face, cargo-backed favor at row 41. Corner work is
// already accepted (not completed) so the favor is the sole Street Life operation in this fixture.
const { body: { token: cappedFavorToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: cappedFavorToken, body: { name: 'Favor Fiona' } });
const cappedFavorMe = (await call('GET', '/v1/me', { token: cappedFavorToken })).body.character;
const cappedFavorAccount = (await pool.query(
  'SELECT account_id FROM characters WHERE id=$1', [cappedFavorMe.id])).rows[0].account_id;
await pool.query('UPDATE characters SET respect=$2, cash=0, loc=$3 WHERE id=$1',
  [cappedFavorMe.id, respectForLevel(30), 'brick']);
await pool.query('INSERT INTO character_cargo (character_id,good_id,qty) VALUES ($1,$2,1)',
  [cappedFavorMe.id, 'booze']);
for (let slot = 0; slot < CORNER.PER_DAY; slot++) {
  await pool.query(
    `INSERT INTO corner_jobs (character_id,day,district,slot,baseline)
     VALUES ($1,$2,'brick',$3,'{}')`,
    [cappedFavorMe.id, Math.floor(Date.now() / 86400000), slot]);
}
const { body: { token: awayPosterToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: awayPosterToken, body: { name: 'Away Arnie' } });
const awayPoster = (await call('GET', '/v1/me', { token: awayPosterToken })).body.character;
const awayPosterAccount = (await pool.query(
  'SELECT account_id FROM characters WHERE id=$1', [awayPoster.id])).rows[0].account_id;
await pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [awayPoster.id]);
const { body: { token: herePosterToken } } = await call('POST', '/v1/auth/guest');
await call('POST', '/v1/character', { token: herePosterToken, body: { name: 'Here Harry' } });
const herePoster = (await call('GET', '/v1/me', { token: herePosterToken })).body.character;
const herePosterAccount = (await pool.query(
  'SELECT account_id FROM characters WHERE id=$1', [herePoster.id])).rows[0].account_id;
await pool.query("UPDATE characters SET loc='brick' WHERE id=$1", [herePoster.id]);
await pool.query(
  `INSERT INTO contacts (owner_account,contact_account,how) VALUES
    ($1,$2,'met'),($1,$3,'met')`, [cappedFavorAccount, awayPosterAccount, herePosterAccount]);
for (let index = 0; index < 40; index++) {
  await pool.query(
    `INSERT INTO favors (id,poster_character,good_id,qty,pay,district,status,expires_at)
     VALUES ($1,$2,'booze',1,$3,'brick','open',$4)`,
    [`capped-away-favor-${index}`, awayPoster.id, 1000 + index,
      new Date(Date.now() + 3600_000)]);
}
const cappedFavor = 'capped-runnable-favor-41';
await pool.query(
  `INSERT INTO favors (id,poster_character,good_id,qty,pay,district,status,expires_at)
   VALUES ($1,$2,'booze',1,500,'brick','open',$3)`,
  [cappedFavor, herePoster.id, new Date(Date.now() + 3600_000)]);
const cappedFavorBoard = (await call('GET', '/v1/favors', { token: cappedFavorToken })).body;
assert.equal(cappedFavorBoard.open.length, 40, 'the ordinary Favor UI keeps its 40-row cap');
assert.ok(cappedFavorBoard.open.every((favor) => !favor.canRun),
  'all presented favors remain authoritatively unrunnable');
assert.ok(!cappedFavorBoard.open.some((favor) => favor.id === cappedFavor),
  'the runnable 41st favor does not leak into the capped UI board');
await markVisitedExcept('street life', cappedFavorAccount, 'coverage-favor-cap');
routeBoard = (await call('GET', '/v1/explore', { token: cappedFavorToken })).body;
assert.equal(routeBoard.next?.systemId, 'street-life',
  'a runnable favor after the presentation cap remains exactly eligible');
const cappedFavorRun = await call('POST', `/v1/favors/${cappedFavor}/run`, { token: cappedFavorToken });
assert.equal(cappedFavorRun.code, 200,
  'the beyond-cap favor run witnessed by Explore passes the authoritative mutation');

// A request/transaction client is one wire: pg@9 refuses a second query while the first is in
// flight. Delay each checked-out client's query by one turn so already-started sibling promises
// overlap deterministically instead of relying on pg-mem's normally immediate resolution. Exercise
// every route that can hand Explore that shared handle: standalone Explore, Home's aggregate, and
// the locked authorization phase of Agent Turn (the ordinary GET uses the pool intentionally).
{
  const { body: { token: strictHuman } } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', { token: strictHuman, body: { name: 'Serial Serena' } });
  const strictHumanCharacter = (await call('GET', '/v1/me', { token: strictHuman })).body.character;
  await pool.query('UPDATE characters SET respect=$2, cash=15000 WHERE id=$1',
    [strictHumanCharacter.id, respectForLevel(30)]);
  const strictBaseline = (await call('GET', '/v1/explore', { token: strictHuman })).body;
  const rawConnect = pool.connect;
  const wrapped = new Map();
  let overlaps = 0;
  pool.connect = async (...args) => {
    const client = await rawConnect.call(pool, ...args);
    if (wrapped.has(client)) return client;
    const rawQuery = client.query;
    wrapped.set(client, rawQuery);
    let active = false;
    client.query = (...queryArgs) => {
      const callback = typeof queryArgs.at(-1) === 'function' ? queryArgs.pop() : null;
      const run = (async () => {
        if (active) {
          overlaps++;
          const error = new Error('strict single-client wrapper rejected overlapping queries');
          error.code = 'strict_single_client_overlap';
          throw error;
        }
        active = true;
        try {
          await new Promise((resolve) => setImmediate(resolve));
          return await rawQuery.apply(client, queryArgs);
        } finally { active = false; }
      })();
      if (callback) { run.then((result) => callback(null, result), callback); return undefined; }
      return run;
    };
    return client;
  };
  try {
    const strictExplore = await call('GET', '/v1/explore', { token: strictHuman });
    assert.equal(strictExplore.code, 200,
      'standalone Explore never overlaps queries on its request-scoped read client');
    assert.deepEqual({ catalog: strictExplore.body.catalog, progress: strictExplore.body.progress,
      next: strictExplore.body.next, blocked: strictExplore.body.blocked },
    { catalog: strictBaseline.catalog, progress: strictBaseline.progress,
      next: strictBaseline.next, blocked: strictBaseline.blocked },
    'standalone Explore preserves its exact recommendation under a strict single client');

    const strictHome = await call('GET', '/v1/home', { token: strictHuman });
    assert.equal(strictHome.code, 200, 'Home answers under a strict single request client');
    assert.equal(strictHome.body.failed.includes('explore'), false,
      'Home does not hide a shared-client Explore failure behind per-board isolation');
    assert.deepEqual(strictHome.body.explore, {
      catalog: strictBaseline.catalog, progress: strictBaseline.progress,
      next: strictBaseline.next, blocked: strictBaseline.blocked,
    }, 'Home preserves the canonical Explore payload under a strict single client');

    const { body: { token: strictGuest } } = await call('POST', '/v1/auth/guest');
    const { body: { token: strictAgent } } = await call('POST', '/v1/auth/agent-key', { token: strictGuest });
    await call('POST', '/v1/character', { token: strictAgent, body: { name: 'Serial Sally' } });
    const strictTurn = (await call('GET', '/v1/agent/turn', { token: strictAgent })).body;
    const strictCrime = strictTurn.actions.find((action) => action.kind === 'crime');
    assert.ok(strictCrime, 'the strict-client Agent Turn fixture has one executable mutation');
    const strictAct = await call('POST', '/v1/agent/act', {
      token: strictAgent, idempotencyKey: 'explore-strict-client-agent-act',
      body: { turnId: strictTurn.turnId, actionId: strictCrime.id },
    });
    assert.equal(strictAct.code, 200,
      'Agent Turn authorization and its post-action response never overlap one transaction client');
    assert.ok(strictAct.body.turn?.turnId,
      'Agent Turn still returns its fresh post-action snapshot under the strict wrapper');
    assert.equal(overlaps, 0,
      'all Explore consumers issue at most one in-flight query per checked-out request client');
  } finally {
    pool.connect = rawConnect;
    for (const [client, rawQuery] of wrapped) client.query = rawQuery;
  }
}

console.log('explore: canonical 40-system coverage ok');
await app.close();
process.exit(0);
