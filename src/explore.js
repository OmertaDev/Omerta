// DEEP CITY COVERAGE — one read-only recommendation over the exact engagement vocabulary.
//
// Coverage is account-level: classified telemetry survives character death, while the ownership,
// mastery and legend signals from the former featured Explore board supplement old accounts whose
// actions predate telemetry. Eligibility is current-character truth. The two are intentionally
// separate so a veteran heir keeps the bloodline's history without inheriting stale actionability.
import { SYSTEM_IDS, SYSTEMS as ENGAGEMENT_SYSTEMS } from './engagement.js';
import {
  AUCTION, auctionLotsOf, BOXING, CASINO, CONVOY, DISTRICTS, ESTATE, KITCHENS, LANDMARKS, LOAN, MADE,
  MEGAPROJECT, PORT, RACKETS, RARITY, RACES, SKILLS, SPEAKEASY, STABLE,
  hospitalized, isMade, jailed, levelOf, rarityIdx, weekOf,
} from './rules.js';
import { seatedGangs } from './commission.js';

const num = (value) => Number(value || 0);
const mastery = (owned, id) => num(owned?.mastery?.[id]);
const has = (items) => Array.isArray(items) && items.length > 0;
const nowActive = (value) => !!value && new Date(value).getTime() > Date.now();
const state = (source, predicate) => (ctx) => { try { return predicate(ctx) ? source : null; } catch { return null; } };

// Canonical metadata follows Object.keys(engagement.SYSTEMS), row-for-row. `eligibility` is an
// internal predicate key, not a second public catalog. The display fields are the one shared copy
// consumed by Agent Turn, standalone Explore, Home, and operator evidence.
const COVERAGE_SYSTEMS = [
  { system: 'streets / crime', systemId: 'streets-crime', name: 'The Streets', at: 1, tab: 'streets', mode: 'solo', eligibility: 'always',
    hook: 'Work a street crime — the city\'s first cash-and-respect loop.' },
  { system: 'the kitchen', systemId: 'kitchen', name: 'The Kitchen', at: 8, tab: 'kitchen', mode: 'solo', eligibility: 'kitchen',
    hook: 'Cook and move product — the deepest earner in the city, and the one they can raid.',
    state: state('ownership', (c) => !!c.ch.lab || mastery(c.owned, 'chemistry') > 0) },
  { system: 'wet work', systemId: 'wet-work', name: 'Wet Work', at: 22, tab: 'pvp', mode: 'social', eligibility: 'counterparty', agentPolicy: true,
    hook: 'Work a live mark only when another reachable player makes the risk real.',
    state: state('mastery', (c) => mastery(c.owned, 'wetwork') > 0 || num(c.acct.kills) > 0) },
  { system: 'contracts', systemId: 'contracts', name: 'Contracts', at: 22, tab: 'pvp', mode: 'social', eligibility: 'counterparty', agentPolicy: true,
    hook: 'Read the contract board and work a live bounty with a real counterparty.' },
  { system: 'the dueling ladder', systemId: 'dueling-ladder', name: 'The Dueling Ladder', at: 22, tab: 'pvp', mode: 'social', eligibility: 'counterparty', agentPolicy: true,
    hook: 'Challenge a reachable rival and put your build on the ladder.' },
  { system: 'crew heists', systemId: 'crew-heists', name: 'Crew Heists', at: 9, tab: 'scores', mode: 'organization', eligibility: 'crew',
    hook: 'Plan a big score or join one with a live crew.',
    state: state('organization', (c) => !!c.owned.crewId || num(c.acct.heists_pulled) > 0 || mastery(c.owned, 'scores') > 0) },
  { system: 'clue scrolls', systemId: 'clue-scrolls', name: 'Clue Scrolls', at: 3, tab: 'streets', mode: 'solo', eligibility: 'clue',
    hook: 'Follow the active clue in your pocket to its next district.' },
  { system: 'the family', systemId: 'family', name: 'A Family', at: 3, tab: 'family', mode: 'organization', eligibility: 'reachableFamily',
    hook: 'Join a reachable family — turf, tribute, wars, and men at your back.',
    state: state('ownership', (c) => !!c.owned.gangId) },
  { system: 'the commission', systemId: 'commission', name: 'The Commission', at: 20, tab: 'family', mode: 'organization', eligibility: 'familySeat',
    hook: 'Use your family seat to shape the city decree.' },
  { system: 'territory', systemId: 'territory', name: 'Territory', at: 15, tab: 'map', mode: 'organization', eligibility: 'family',
    hook: 'Put your family to work on a district operation.' },
  { system: 'the world', systemId: 'world', name: 'The World', at: 18, tab: 'family', mode: 'organization', eligibility: 'family',
    hook: 'Rally the family against a rival outfit in the living world.' },
  { system: 'the blood war', systemId: 'blood-war', name: 'The Blood War', at: 20, tab: 'family', mode: 'organization', eligibility: 'family',
    hook: 'Take the family into the city\'s ongoing blood war.' },
  { system: 'business empire', systemId: 'business-empire', name: 'The Empire', at: 3, tab: 'empire', mode: 'solo', eligibility: 'empire',
    hook: 'Buy a racket — passive income that pays while you sleep.',
    state: state('ownership', (c) => has(c.owned.rackets) || has(c.owned.assets) || has(c.owned.businesses)) },
  { system: 'convoys', systemId: 'convoys', name: 'Convoys', at: 24, tab: 'scores', mode: 'solo', eligibility: 'convoy',
    hook: 'Send bulk trade goods across the map on a real clock.',
    state: state('legend', (c) => num(c.acct.freight_delivered) > 0) },
  { system: 'the port', systemId: 'port', name: 'The Port', at: 16, tab: 'port', mode: 'solo', eligibility: 'port',
    hook: 'Buy a boat and run contraband in from offshore.',
    state: state('legend', (c) => num(c.acct.smuggled) > 0 || mastery(c.owned, 'seamanship') > 0) },
  { system: 'the black market', systemId: 'black-market', name: 'The Black Market', at: 7, tab: 'market', mode: 'solo', eligibility: 'market',
    hook: 'Turn tradable inventory into a listing or fill a live order.',
    state: state('mastery', (c) => mastery(c.owned, 'commerce') > 0) },
  { system: 'loan sharking', systemId: 'loan-sharking', name: 'Loan Sharking', at: 10, tab: 'loans', mode: 'solo', eligibility: 'loan',
    hook: 'Price credit, fund a marker, or square a debt; agents never borrow.' },
  { system: 'the casino', systemId: 'casino', name: 'The Den', at: 10, tab: 'den', mode: 'solo', eligibility: 'casino',
    hook: 'Take a published minimum stake to the Neon Mile.',
    state: state('mastery', (c) => mastery(c.owned, 'gambling') > 0) },
  { system: 'the speakeasy', systemId: 'speakeasy', name: 'The Speakeasy', at: 26, tab: 'speakeasy', mode: 'solo', eligibility: 'speakeasy',
    hook: 'Open a nightclub in a free district once you are made.',
    state: state('ownership', (c) => !!c.owned.speakeasy) },
  { system: 'boxing', systemId: 'boxing', name: 'The Fights', at: 12, tab: 'boxing', mode: 'solo', eligibility: 'boxing',
    hook: 'Sign a contender and put a fighter under management.',
    state: state('ownership', (c) => has(c.owned.fighters) || num(c.acct.boxing_wins) > 0 || mastery(c.owned, 'fists') > 0) },
  { system: 'street races', systemId: 'street-races', name: 'Street Races', at: 14, tab: 'races', mode: 'solo', eligibility: 'car',
    hook: 'Put usable iron on the circuit and make speed pay.',
    state: state('legend', (c) => num(c.acct.race_wins) > 0 || mastery(c.owned, 'wheels') > 0) },
  { system: 'the stable', systemId: 'stable', name: 'The Stable', at: 25, tab: 'stable', mode: 'solo', eligibility: 'stable',
    hook: 'Buy a racer, train its legs, and run the daily card.',
    state: state('legend', (c) => num(c.acct.racer_wins) > 0) },
  { system: 'the law', systemId: 'law', name: 'The Law', at: 18, tab: 'law', mode: 'solo', eligibility: 'law',
    hook: 'Answer the case the Bureau is actively building against you.' },
  { system: 'the pen', systemId: 'pen', name: 'The Pen', at: 1, tab: 'pen', mode: 'solo', eligibility: 'jailed',
    hook: 'Work the prison systems while your street is serving time.' },
  { system: 'the wire', systemId: 'wire', name: 'The Wire', at: 18, tab: 'wire', mode: 'social', eligibility: 'wire', agentPolicy: true,
    hook: 'Spend intelligence money only against a live, reachable rival.',
    state: state('legend', (c) => num(c.acct.intel_ops) > 0) },
  { system: 'secrets', systemId: 'secrets', name: 'Secrets', at: 18, tab: 'wire', mode: 'social', eligibility: 'intel', agentPolicy: true,
    hook: 'Use live rival context to turn information into leverage.' },
  { system: 'skills', systemId: 'skills', name: 'Skills', at: 4, tab: 'life', mode: 'solo', eligibility: 'skills',
    hook: 'Spend an earned point on an unfinished branch of your build.',
    state: state('ownership', (c) => (c.owned.skills?.size || 0) > 0) },
  { system: 'the underworld', systemId: 'underworld', name: 'The Underworld', at: 3, tab: 'life', mode: 'solo', eligibility: 'underworld',
    hook: 'Work a known fixture and deepen a relationship that already exists.' },
  { system: 'the estate', systemId: 'estate', name: 'The Estate', at: 30, tab: 'estate', mode: 'solo', eligibility: 'estate',
    hook: 'Turn earned $OMR into a compound that survives death.',
    state: state('ownership', (c) => !!c.owned.estate) },
  { system: 'the made man', systemId: 'made-man', name: 'The Made Man', at: 26, tab: 'portfolio', mode: 'solo', eligibility: 'made',
    hook: 'Pay the published dues and take your place on the Made ladder.' },
  { system: 'the auction house', systemId: 'auction-house', name: 'The Auction House', at: 30, tab: 'estate', mode: 'solo', eligibility: 'auction',
    hook: 'Bid on a live lot only when your earned $OMR covers its floor.' },
  { system: 'the collection', systemId: 'collection', name: 'The Collection', at: 20, tab: 'estate', mode: 'solo', eligibility: 'collection',
    hook: 'Advance the rarity of eligible iron or gear you already own.' },
  { system: 'going legit', systemId: 'going-legit', name: 'Going Legit', at: 15, tab: 'portfolio', mode: 'solo', eligibility: 'legit',
    hook: 'Put earned $OMR, stake, or a mint credit toward lasting account readiness.',
    state: state('legend', (c) => num(c.acct.staked) > 0 || !!c.acct.minted || isMade(c.acct)) },
  { system: 'the megaproject', systemId: 'megaproject', name: 'The Megaproject', at: 28, tab: 'city', mode: 'solo', eligibility: 'megaproject',
    hook: 'Lay an affordable brick in the monument the whole city is building.' },
  { system: 'street life', systemId: 'street-life', name: 'Street Life', at: 3, tab: 'streets', mode: 'solo', eligibility: 'streetLife',
    hook: 'Work a live corner, contact call, or player favor.' },
  { system: 'landmarks', systemId: 'landmarks', name: 'Landmarks', at: 12, tab: 'city', mode: 'solo', eligibility: 'landmark',
    hook: 'Take an affordable live dedication at the landmark in front of you.' },
  { system: 'street deeds', systemId: 'street-deeds', name: 'Street Deeds', at: 15, tab: 'deeds', mode: 'solo', eligibility: 'deed',
    hook: 'Claim an open street or buy one when a real sale is in reach.' },
  { system: 'vanity', systemId: 'vanity', name: 'Vanity', at: 5, tab: 'profile', mode: 'solo', eligibility: 'vanity',
    hook: 'Rename or mark something you already own.' },
  { system: 'the store / pass', systemId: 'store-pass', name: 'The Store and Pass', at: 1, tab: 'store', mode: 'solo', eligibility: 'policy', policy: true,
    hook: 'The store is never a proactive gameplay recommendation.' },
  { system: 'growth / social', systemId: 'growth-social', name: 'Growth and Social', at: 3, tab: 'discover', mode: 'social', eligibility: 'counterparty', agentPolicy: true,
    hook: 'Human social proof stays a human-only discovery surface.' },
];

export const SYSTEMS = COVERAGE_SYSTEMS.map(({ systemId: _legacySystemId, ...entry }) =>
  Object.freeze({ ...entry, systemId: SYSTEM_IDS[entry.system] }));

const vocabulary = Object.keys(ENGAGEMENT_SYSTEMS);
if (SYSTEMS.length !== 40 || SYSTEMS.some((entry, index) => entry.system !== vocabulary[index]))
  throw new Error('Explore coverage must match engagement.SYSTEMS exactly and in order.');

const onlineRows = (ctx) => (ctx.onlineAccounts || []).filter((row) => {
  if (typeof row === 'string') return row !== ctx.ch.account_id;
  if (!row || (row.accountId || row.account_id) === ctx.ch.account_id) return false;
  return !(row.agent || row.agentFlag || row.agent_flag || row.npc || row.npcFlag || row.npc_flag || row.isNpc || row.is_npc);
});
const hasCounterparty = (ctx) => onlineRows(ctx).length > 0;
const resource = (condition) => condition ? null : 'resource';
const social = (condition) => condition ? null : 'social';
const eligibilityBlocker = (entry, ctx) => {
  const cash = num(ctx.ch.cash), omr = num(ctx.acct.omr);
  const cargo = Object.values(ctx.owned.cargo || {}).reduce((sum, qty) => sum + num(qty), 0);
  const online = onlineRows(ctx);
  switch (entry.eligibility) {
    case 'always': return null;
    case 'policy': return 'policy';
    case 'kitchen': return resource(!!ctx.ch.lab || cash >= num(KITCHENS[0]?.cost));
    case 'counterparty': return social(hasCounterparty(ctx));
    case 'crew': return social(!!ctx.owned.crewId);
    case 'clue': return ctx.owned.work?.clue ? null : 'status';
    case 'reachableFamily': return social(online.some((row) => typeof row === 'object' && (row.gangId || row.gang_id || row.gangTag)));
    case 'familySeat': return social(!!ctx.owned.gangId && ['boss', 'underboss'].includes(ctx.owned.gangRole)
      && ctx.live.commissionSeatGangIds.includes(ctx.owned.gangId));
    case 'family': return social(!!ctx.owned.gangId);
    case 'empire': {
      const open = RACKETS.filter((racket) => racket.lvl <= ctx.level).sort((a, b) => a.cost - b.cost)[0];
      return resource(!!open && cash >= num(open.cost));
    }
    case 'convoy': return resource(cargo >= CONVOY.MIN_QTY && cash >= 0);
    case 'port': return resource(cash >= Math.min(...PORT.BOATS.map((boat) => num(boat.cost))));
    case 'market': return resource(cargo > 0 || has(ctx.owned.cars));
    case 'loan': return resource(cash >= LOAN.MIN);
    case 'casino': return resource(cash >= CASINO.MIN_BET);
    case 'speakeasy': return !isMade(ctx.acct) ? 'status'
      : !ctx.live.freeSpeakeasyDistricts.length ? 'status' : resource(cash >= SPEAKEASY.OPEN_COST);
    case 'boxing': return resource(cash >= BOXING.RECRUIT_COST);
    case 'car': {
      if (jailed(ctx.ch) || hospitalized(ctx.ch) || nowActive(ctx.ch.race_at)) return 'status';
      const tier = RACES.TIERS.filter((race) => race.minLvl <= ctx.level).sort((a, b) => a.fee - b.fee)[0];
      return resource(!!tier && ctx.owned.cars.some((car) => !car.listed && !car.pledged) && cash >= num(tier.fee));
    }
    case 'stable': return resource(cash >= Math.min(...Object.values(STABLE.KINDS).map((kind) => num(kind.cost))));
    case 'law': return nowActive(ctx.ch.wanted_until) || !!ctx.ch.indicted_at || num(ctx.ch.heat_exposure) > 0 ? null : 'status';
    case 'jailed': return jailed(ctx.ch) ? null : 'status';
    case 'wire': return !hasCounterparty(ctx) ? 'social' : resource(omr > 0);
    case 'intel': return !hasCounterparty(ctx) ? 'social'
      : (ctx.owned.hunt || num(ctx.owned.recentRivals) > 0 ? null : 'status');
    case 'skills': {
      const earned = Math.floor(Math.max(0, ctx.level - 1) / SKILLS.LVL_PER_POINT);
      const spent = [...(ctx.owned.skills || [])].reduce((sum, id) => sum + num(SKILLS.TREE.find((skill) => skill.id === id)?.cost), 0);
      return earned > spent && (ctx.owned.skills?.size || 0) < SKILLS.TREE.length ? null : 'status';
    }
    case 'underworld': return Object.values(ctx.owned.npc || {}).some((standing) => num(standing) > 0) ? null : 'status';
    case 'estate': return resource(omr >= num(ESTATE.TIERS[0]?.omr));
    case 'made': return isMade(ctx.acct) ? 'status' : resource(omr >= MADE.OMR);
    case 'auction': return ctx.live.auctionMinBid == null ? 'status' : resource(omr >= ctx.live.auctionMinBid);
    case 'collection': return resource(ctx.live.collectionItems.some((item) => {
      if (item.minted_onchain) return false;
      const next = RARITY.TIERS[rarityIdx(String(item.rarity || 'common')) + 1];
      return !!next && omr >= num(RARITY.UPGRADE_OMR[rarityIdx(next.id)]);
    }));
    case 'legit': return resource(omr > 0 || num(ctx.acct.staked) > 0 || num(ctx.acct.mint_credits) > 0);
    case 'megaproject': return resource(cash >= MEGAPROJECT.MIN_CASH || omr >= MEGAPROJECT.MIN_OMR);
    case 'streetLife': return ctx.owned.work?.cornerOpen?.length || ctx.owned.contactCall || ctx.owned.openFavor ? null : 'status';
    case 'landmark': return resource(omr >= ctx.live.landmarkMinDedicate);
    case 'deed': return ctx.owned.deed ? 'status' : null;
    case 'vanity': return has(ctx.owned.cars) || !!ctx.owned.gangId || !!ctx.owned.deed ? null : 'status';
    default: return 'status';
  }
};

const PATH_RELEVANCE = {
  gun: new Set(['wet-work', 'contracts', 'dueling-ladder']),
  ledger: new Set(['business-empire', 'black-market', 'loan-sharking', 'going-legit']),
  kitchen: new Set(['kitchen', 'street-life']),
  wheel: new Set(['convoys', 'port', 'street-races', 'stable']),
  shadow: new Set(['streets-crime', 'clue-scrolls', 'wet-work', 'secrets']),
  ring: new Set(['dueling-ladder', 'casino', 'boxing']),
};
const relevant = (entry, ctx) => PATH_RELEVANCE[ctx.ch.path]?.has(entry.systemId)
  || (entry.systemId === 'port' && ctx.ch.loc === PORT.DISTRICT)
  || (entry.systemId === 'casino' && ctx.ch.loc === CASINO.DISTRICT)
  || (entry.systemId === 'landmarks' && Object.hasOwn(LANDMARKS.PLACES, ctx.ch.loc));
const readyOrder = (ctx) => (left, right) => {
  const mode = (entry) => entry.mode === 'solo' ? 0 : 1;
  return mode(left) - mode(right)
    || Number(relevant(right, ctx)) - Number(relevant(left, ctx))
    || left.at - right.at
    || left.systemId.localeCompare(right.systemId);
};

/**
 * Return account-level system coverage and exactly one presently actionable discovery, or null.
 * The only database access is one grouped telemetry query scoped to the account.
 */
export async function systemCoverage(db, ch, acct = {}, owned = {}, { onlineAccounts = [], live = {} } = {}) {
  const rows = (await db.query(
    'SELECT event, COUNT(*) AS count FROM telemetry WHERE account_id=$1 GROUP BY event', [ch.account_id])).rows;
  const telemetry = new Set(rows.filter((row) => num(row.count) > 0).map((row) => row.event));
  const ctx = { ch, acct, owned, onlineAccounts, level: levelOf(num(ch.respect)), live: {
    commissionSeatGangIds: live.commissionSeatGangIds || [],
    freeSpeakeasyDistricts: live.freeSpeakeasyDistricts || [],
    auctionMinBid: live.auctionMinBid ?? null,
    collectionItems: live.collectionItems || [],
    landmarkMinDedicate: live.landmarkMinDedicate ?? LANDMARKS.MIN_DEDICATE,
  } };
  const visited = new Map();
  for (const entry of SYSTEMS) {
    const event = ENGAGEMENT_SYSTEMS[entry.system].find((candidate) => telemetry.has(candidate));
    if (event) visited.set(entry.systemId, { visited: true, source: 'telemetry' });
    else {
      const source = entry.state?.(ctx) || null;
      if (source) visited.set(entry.systemId, { visited: true, source });
    }
  }

  const blocked = { level: 0, resource: 0, status: 0, social: 0, policy: 0 };
  const ready = [];
  for (const entry of SYSTEMS) {
    if (visited.has(entry.systemId)) continue;
    let blocker = null;
    if (ctx.level < entry.at) blocker = 'level';
    else if (entry.policy || (acct.agent_flag && entry.agentPolicy)) blocker = 'policy';
    else blocker = eligibilityBlocker(entry, ctx);
    if (blocker) blocked[blocker]++;
    else ready.push(entry);
  }
  ready.sort(readyOrder(ctx));
  const entry = ready[0] || null;
  const next = entry ? {
    systemId: entry.systemId, system: entry.system, name: entry.name, tab: entry.tab, hook: entry.hook,
    at: entry.at, mode: entry.mode, reason: 'earliest_overdue_unlock',
    evidence: { visited: false, source: null },
  } : null;
  return {
    catalog: { scope: 'engagement_systems', version: 1, count: SYSTEMS.length },
    progress: { visited: visited.size, eligible: ready.length, remaining: SYSTEMS.length - visited.size },
    next,
    blocked,
  };
}

async function coverageLiveContext(db, ch) {
  const week = weekOf();
  const [seats, speakeasies, auctionRows, collectionRows, landmarkRows] = await Promise.all([
    seatedGangs(db),
    db.query('SELECT district_id FROM speakeasies'),
    db.query('SELECT lot_id, current_bid, bidder, status FROM auctions WHERE week=$1', [week]),
    db.query(`SELECT 'car' AS kind, id, rarity, minted_onchain, listed, pledged,
                    NULL::timestamptz AS run_until FROM cars WHERE character_id=$1
              UNION ALL
              SELECT 'boat' AS kind, id, rarity, minted_onchain, false AS listed, false AS pledged,
                    run_until FROM boats WHERE character_id=$1`, [ch.id]),
    db.query('SELECT district_id, amount FROM landmarks'),
  ]);
  const occupied = new Set(speakeasies.rows.map((row) => row.district_id));
  const byLot = new Map(auctionRows.rows.map((row) => [row.lot_id, row]));
  const auctionMins = [];
  for (const lot of auctionLotsOf(week)) {
    const row = byLot.get(lot.id);
    if (row && row.status !== 'live') continue;
    const current = num(row?.current_bid);
    auctionMins.push(row?.bidder ? Math.ceil(current * (1 + AUCTION.MIN_RAISE_BPS / 10000)) : num(lot.min));
  }
  const landmarkByDistrict = new Map(landmarkRows.rows.map((row) => [row.district_id, num(row.amount)]));
  return {
    commissionSeatGangIds: seats.map((seat) => seat.id),
    freeSpeakeasyDistricts: DISTRICTS.map((district) => district.id).filter((id) => !occupied.has(id)),
    auctionMinBid: auctionMins.length ? Math.min(...auctionMins) : null,
    collectionItems: collectionRows.rows,
    landmarkMinDedicate: Math.min(...Object.keys(LANDMARKS.PLACES).map((district) =>
      landmarkByDistrict.has(district) ? landmarkByDistrict.get(district) + 1 : LANDMARKS.MIN_DEDICATE)),
  };
}

// Standalone Explore loads shared live context, then delegates to the one resolver/catalog.
export async function exploreBoard(db, ch, acct = {}, owned = {}, options = {}) {
  const live = options.live || await coverageLiveContext(db, ch);
  return systemCoverage(db, ch, acct, owned, { ...options, live });
}
