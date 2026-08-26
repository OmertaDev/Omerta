// DEEP CITY COVERAGE — one read-only recommendation over the exact engagement vocabulary.
//
// Coverage is account-level: classified telemetry survives character death, while the ownership,
// mastery and legend signals from the former featured Explore board supplement old accounts whose
// actions predate telemetry. Eligibility is current-character truth. The two are intentionally
// separate so a veteran heir keeps the bloodline's history without inheriting stale actionability.
import { SYSTEM_IDS, SYSTEMS as ENGAGEMENT_SYSTEMS } from './engagement.js';
import {
  AUCTION, auctionLotsOf, BOXING, CASINO, CLUES, CONVOY, CRIMES, DISTRICTS, DUELS, ESTATE,
  FAMILY_WAR, GOODS, KITCHENS, LANDMARKS, LAW, LOAN, M3, MADE, MEGAPROJECT, PORT, RACKETS,
  RARITY, RACES, SECRETS, SKILLS, SPEAKEASY, STABLE, UNDERWORLD, VANITY, VOUCH, WIRE,
  WORLD, WORLD_NPCS, bribeCostOf, hospitalized, inHole, intelCost, isMade, jailed, levelOf,
  opSlotsOf, penSafe, rarityIdx, safeHoused, weekOf, witproActive,
} from './rules.js';
import { npcTier, trunkCap } from './game.js';
import { seatedGangs } from './commission.js';
import { convoyBoard } from './convoy.js';
import { clueBoard } from './clues.js';
import { cornerBoard } from './corner.js';
import { contactsBoard } from './contacts.js';
import { favorBoard } from './favors.js';
import { heistAvailability, heistBoard } from './heists.js';
import { lawBoard } from './law.js';
import { loanAvailability, loanBoard } from './loans.js';
import { marketAvailability, marketBoard } from './market.js';
import { megaBoard } from './megaproject.js';
import { warBoard } from './npcwar.js';
import { portBoard } from './port.js';
import { secretsBoard } from './secrets.js';
import { skillsBoard } from './skills.js';
import { stableBoard } from './stable.js';
import { territoryAvailability, territoryExploreBoard } from './territory.js';
import { underworldBoard } from './underworld.js';
import { vouchBoard } from './vouch.js';
import { wireBoard } from './wire.js';
import { worldBoard } from './world.js';

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
    hook: 'Put a paid name, title, or mark on the identity you bring to the city.' },
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
// An authoritative query can legitimately return an empty slice (the visible socket just died,
// became an agent, or otherwise ceased to be eligible). Preserve that empty answer. Raw presence is
// only the compatibility fallback for callers that did not load an authoritative slice at all.
const socialRows = (ctx) => Array.isArray(ctx.live.socialTargets) ? ctx.live.socialTargets : onlineRows(ctx);
const targetId = (row) => row?.characterId || row?.character_id || row?.id || null;
const targetAccount = (row) => row?.accountId || row?.account_id || null;
const targetGang = (row) => row?.gangId || row?.gang_id || null;
const targetCrew = (row) => row?.crewId || row?.crew_id || null;
const activeAt = (row, ...keys) => keys.some((key) => nowActive(row?.[key]));
const op = (operation) => ({ operation, blocker: null });
const stop = (blocker) => ({ operation: null, blocker });
const gate = (condition, operation, blocker = 'resource') => condition ? op(operation) : stop(blocker);
const cargoCount = (cargo = {}) => Object.values(cargo).reduce((sum, qty) => sum + num(qty), 0);
const actorBlocked = (ch, { safe = false, hospital = false, witpro = false } = {}) =>
  jailed(ch) || (safe && safeHoused(ch)) || (hospital && hospitalized(ch)) || (witpro && witproActive(ch));
const sameProtectedGroup = (ctx, row) => {
  const wanted = activeAt(row, 'wanted_until', 'wantedUntil');
  const waived = !!row.rat || wanted;
  return !waived && ((ctx.owned.gangId && targetGang(row) === ctx.owned.gangId)
    || (ctx.owned.crewId && targetCrew(row) === ctx.owned.crewId));
};
const reachableJumpTarget = (ctx, row) => !!targetId(row)
  && !activeAt(row, 'jail_until', 'jailUntil', 'hosp_until', 'hospUntil', 'witpro_until', 'witproUntil',
    'pen_safe_until', 'penSafeUntil', 'hole_until', 'holeUntil')
  && !sameProtectedGroup(ctx, row);
const reachableContractTarget = (ctx, row) => !!targetId(row) && !sameProtectedGroup(ctx, row);
const reachableDuelTarget = (ctx, row) => {
  const level = row.level != null ? num(row.level) : levelOf(num(row.respect));
  const limit = num(row.duelLimit ?? row.duel_limit);
  return !!targetId(row) && !activeAt(row, 'jail_until', 'jailUntil', 'hosp_until', 'hospUntil')
    && !(ctx.owned.gangId && targetGang(row) === ctx.owned.gangId)
    && level >= DUELS.MIN_LVL && limit >= DUELS.STAKE_MIN
    && num(row.cash) >= DUELS.STAKE_MIN;
};

// A readiness result always carries an internal operation witness. The witness never enters the UI
// payload or Agent Turn authority; it exists so each catalog row can be audited against a real route
// rather than inferred from an unrelated ownership or balance bit.
export function systemEligibility(entry, ctx) {
  const cash = num(ctx.ch.cash), omr = num(ctx.acct.omr);
  const cargo = cargoCount(ctx.owned.cargo);
  const online = onlineRows(ctx);
  switch (entry.eligibility) {
    case 'always': {
      if (jailed(ctx.ch)) return stop('status');
      const crime = CRIMES.find((candidate) => candidate.lvl <= ctx.level && num(ctx.ch.nerve) >= candidate.nerve);
      return crime ? op(`crime:${crime.id}`) : stop('resource');
    }
    case 'policy': return stop('policy');
    case 'kitchen': {
      const current = ctx.ch.lab ? KITCHENS.findIndex((kitchen) => kitchen.id === ctx.ch.lab) : -1;
      const next = KITCHENS[current + 1];
      if (!next) return stop('status');
      return gate(cash >= num(next.cost) && omr >= num(next.omr), `kitchen:lab:${next.id}`);
    }
    case 'counterparty': {
      const targets = socialRows(ctx);
      if (entry.systemId === 'wet-work') {
        if (actorBlocked(ctx.ch, { safe: true, hospital: true, witpro: true })
            || num(ctx.ch.health) < M3.JUMP_MIN_HEALTH) return stop('status');
        if (num(ctx.ch.energy) < M3.JUMP_ENERGY || num(ctx.ch.ammo) < M3.JUMP_AMMO) return stop('resource');
        const target = targets.find((row) => reachableJumpTarget(ctx, row));
        return target ? op(`jump:${targetId(target)}`) : stop('social');
      }
      if (entry.systemId === 'contracts') {
        const fixerFee = npcTier({ owned: ctx.owned }, 'fixer') >= 2 ? 0 : Math.ceil(M3.BOUNTY_MIN * 0.01);
        const price = M3.BOUNTY_MIN + fixerFee + Math.ceil(M3.BOUNTY_MIN * 0.01);
        if (cash < price) return stop('resource');
        const target = targets.find((row) => reachableContractTarget(ctx, row));
        return target ? op(`contract:${targetId(target)}`) : stop('social');
      }
      if (entry.systemId === 'dueling-ladder') {
        if (jailed(ctx.ch) || hospitalized(ctx.ch) || nowActive(ctx.ch.duel_at)) return stop('status');
        if (cash < DUELS.STAKE_MIN) return stop('resource');
        const target = targets.find((row) => reachableDuelTarget(ctx, row));
        return target ? op(`duel:${targetId(target)}`) : stop('social');
      }
      if (entry.systemId === 'growth-social') {
        const board = ctx.live.vouchBoard;
        if (num(board.slotsLeft) <= 0) return stop('status');
        const given = new Set((board.given || []).map((row) => targetId(row)));
        const target = targets.find((row) => targetId(row) && !given.has(targetId(row)));
        return target ? op(`vouch:${targetId(target)}`) : stop('social');
      }
      return stop('social');
    }
    case 'crew': {
      const available = heistAvailability(ctx.ch, ctx.live.heistBoard, { agent: !!ctx.acct.agent_flag });
      if (available.canLeave) return op('heist:leave');
      if (available.canPlan) return op('heist:plan');
      if (available.canJoin) return op('heist:join');
      return stop(available.blocker);
    }
    case 'clue': {
      if (jailed(ctx.ch) || safeHoused(ctx.ch)) return stop('status');
      const scroll = ctx.live.clueBoard?.scroll || ctx.owned.work?.clue;
      return gate(!!scroll && num(ctx.ch.energy) >= CLUES.DIG_ENERGY, 'clue:dig', scroll ? 'resource' : 'status');
    }
    case 'reachableFamily': {
      if (ctx.owned.gangId) return stop('status');
      const candidates = new Set(ctx.live.joinableFamilyIds || []);
      const row = online.find((candidate) => typeof candidate === 'object'
        && candidates.has(candidate.gangId || candidate.gang_id));
      return row ? op(`family:join:${row.gangId || row.gang_id}`) : stop('social');
    }
    case 'familySeat': return gate(!!ctx.owned.gangId && ['boss', 'underboss'].includes(ctx.owned.gangRole)
      && ctx.live.commissionSeatGangIds.includes(ctx.owned.gangId), 'commission:vote', 'social');
    case 'family': {
      if (entry.systemId === 'territory') {
        const available = territoryAvailability(ctx.ch, { acct: ctx.acct, owned: ctx.owned }, ctx.live.territoryBoard);
        const witness = ['canCollect', 'canUpkeep', 'canEstablish', 'canUpgrade', 'canFortify', 'canOperate', 'canUnassign', 'canRaid']
          .find((key) => available[key]);
        if (!witness) return stop(available.blocker);
        if (witness === 'canRaid' && ctx.acct.agent_flag) return stop('policy');
        return op(witness === 'canRaid' ? `territory:raid:${available.raidDistrict}`
          : `territory:${witness.slice(3).toLowerCase()}`);
      }
      if (entry.systemId === 'world') {
        if (actorBlocked(ctx.ch, { safe: true, hospital: true }) || nowActive(ctx.ch.world_raid_at)) return stop('status');
        if (num(ctx.ch.energy) < WORLD.RAID_ENERGY || num(ctx.ch.ammo) < WORLD.RAID_AMMO) return stop('resource');
        const target = (ctx.live.worldBoard?.npcs || []).find((npc) => npc.canRaid && !npc.coop);
        return target ? op(`world:raid:${target.id}`) : stop('status');
      }
      if (entry.systemId === 'blood-war') {
        if (actorBlocked(ctx.ch, { safe: true, hospital: true }) || nowActive(ctx.ch.family_raid_at)) return stop('status');
        if (num(ctx.ch.energy) < FAMILY_WAR.RAID_ENERGY || num(ctx.ch.ammo) < FAMILY_WAR.RAID_AMMO) return stop('resource');
        const target = (ctx.live.warBoard?.families || []).find((family) => family.canRaid
          && !family.heldBy?.mine && !family.pact?.active);
        return target ? op(`family-war:raid:${target.id}`) : stop('status');
      }
      return stop('social');
    }
    case 'empire': {
      const used = (ctx.owned.rackets || []).length;
      const slots = opSlotsOf(ctx.level, !!ctx.owned.deedSeat);
      const open = used < slots && RACKETS.filter((racket) => racket.lvl <= ctx.level
        && !(ctx.owned.rackets || []).includes(racket.id)).sort((a, b) => a.cost - b.cost)[0];
      return open && cash >= num(open.cost) ? op(`racket:buy:${open.id}`) : stop('resource');
    }
    case 'convoy': {
      const board = ctx.live.convoyBoard || {};
      const mine = board.mine;
      const road = (board.inTransit || []).find((candidate) => candidate.canAmbush === true);
      const roadFallback = (blocker) => {
        if (!road) return stop(blocker);
        if (actorBlocked(ctx.ch, { safe: true, hospital: true })) return stop('status');
        if (num(ctx.ch.energy) < CONVOY.AMBUSH_ENERGY || num(ctx.ch.ammo) < CONVOY.AMBUSH_AMMO)
          return stop('resource');
        return ctx.acct.agent_flag ? stop('policy') : op(`convoy:ambush:${road.id}`);
      };
      if (!mine) {
        const good = Object.entries(ctx.owned.cargo || {}).find(([, qty]) => num(qty) > 0);
        if (!jailed(ctx.ch) && good) return op(`convoy:open:${good[0]}`);
        return roadFallback(jailed(ctx.ch) ? 'status' : 'resource');
      }
      const units = (mine.manifest || []).reduce((sum, item) => sum + num(item.qty), 0);
      if (mine.status === 'loading') {
        const cap = trunkCap({ owned: ctx.owned });
        if (cargo + units <= cap) return op('convoy:cancel');
        if (!jailed(ctx.ch) && mine.from === ctx.ch.loc
            && Object.values(ctx.owned.cargo || {}).some((qty) => num(qty) > 0)) return op('convoy:load');
        if (!jailed(ctx.ch) && units >= CONVOY.MIN_QTY) return op('convoy:depart');
        return roadFallback(jailed(ctx.ch) ? 'status' : 'resource');
      }
      if (mine.status === 'arrived') {
        if (!jailed(ctx.ch) && !safeHoused(ctx.ch) && ctx.ch.loc === mine.to) {
          const space = trunkCap({ owned: ctx.owned }) - cargo;
          if (units === 0 || space > 0) return op('convoy:collect');
        }
        return roadFallback(jailed(ctx.ch) || safeHoused(ctx.ch) || ctx.ch.loc !== mine.to ? 'status' : 'resource');
      }
      return roadFallback('status');
    }
    case 'port': {
      const board = ctx.live.portBoard || {};
      const working = (ctx.live.collectionItems || []).filter((item) => item.kind === 'boat' && !item.minted_onchain);
      // Port treats any run_until as afloat until collection clears it, including an ETA already
      // in the past. A merely elapsed clock is therefore collectable, not sellable.
      const canSell = working.some((boat) => !boat.run_until);
      if (canSell) return op('port:sell');
      const arrived = (board.fleet || []).some((boat) => boat.status === 'arrived');
      if (arrived && !actorBlocked(ctx.ch, { safe: true, hospital: true }) && board.atDocks) return op('port:collect');
      if (num(board.contraband?.book) > 0 && !actorBlocked(ctx.ch, { safe: true, hospital: true }) && board.atDocks)
        return op('port:fence');
      const catalog = board.catalog || PORT.BOATS;
      const cheapest = [...catalog].sort((a, b) => num(a.cost) - num(b.cost))[0];
      // Extracted boats are trophies, not working inventory: buyBoat's authoritative berth count
      // explicitly excludes them, and collectionItems is the same unabridged ownership read.
      const fleetCount = working.length;
      return gate(!jailed(ctx.ch) && !!board.atDocks && fleetCount < num(board.fleetMax) && !!cheapest
        && cash >= num(cheapest.cost), `port:buy:${cheapest?.id}`, jailed(ctx.ch) || !board.atDocks ? 'status' : 'resource');
    }
    case 'market': {
      const available = marketAvailability(ctx.ch, { acct: ctx.acct, owned: ctx.owned },
        ctx.live.marketBoard, ctx.live.marketOwn);
      const witness = ['canCancel', 'canClaim', 'canList', 'canPostOrder', 'canFillOrder', 'canBuyGood', 'canBuyCar', 'canBidCar']
        .find((key) => available[key]);
      return witness ? op(`market:${witness.slice(3).toLowerCase()}`) : stop(available.blocker);
    }
    case 'loan': {
      const available = loanAvailability(ctx.ch, ctx.acct, ctx.owned, ctx.live.loanBoard,
        { agent: !!ctx.acct.agent_flag });
      const witness = ['canRepay', 'canLend', ...(!ctx.acct.agent_flag
        ? ['canTakeHouse', 'canTakeOffer', 'canBuyPaper'] : [])].find((key) => available[key]);
      return witness ? op(`loan:${witness.slice(3).toLowerCase()}`) : stop(available.blocker);
    }
    case 'casino': {
      if (jailed(ctx.ch) || ctx.ch.loc !== CASINO.DISTRICT) return stop('status');
      const needsNerve = npcTier({ owned: ctx.owned }, 'madame') < 1;
      return gate(cash >= CASINO.MIN_BET && (!needsNerve || num(ctx.ch.nerve) >= CASINO.DICE_NERVE), 'casino:dice');
    }
    case 'speakeasy': return !isMade(ctx.acct) || jailed(ctx.ch) ? stop('status')
      : !ctx.live.freeSpeakeasyDistricts.length ? stop('status')
        : gate(cash >= SPEAKEASY.OPEN_COST, 'speakeasy:open');
    case 'boxing': return jailed(ctx.ch) ? stop('status')
      : gate((ctx.owned.fighters || []).length < BOXING.STABLE_MAX && cash >= BOXING.RECRUIT_COST, 'boxing:recruit');
    case 'car': {
      if (jailed(ctx.ch) || hospitalized(ctx.ch) || nowActive(ctx.ch.race_at)) return stop('status');
      const tier = RACES.TIERS.filter((race) => race.minLvl <= ctx.level).sort((a, b) => a.fee - b.fee)[0];
      return gate(!!tier && ctx.owned.cars.some((car) => !car.listed && !car.pledged) && cash >= num(tier.fee), 'race:npc');
    }
    case 'stable': {
      const board = ctx.live.stableBoard || {};
      if ((board.stable || []).length > 0) return op('stable:list');
      const cheapest = Math.min(...Object.values(board.kinds || STABLE.KINDS).map((kind) => num(kind.cost)));
      return jailed(ctx.ch) ? stop('status')
        : gate((board.stable || []).length < num(board.stableMax ?? STABLE.STABLE_MAX) && cash >= cheapest, 'stable:buy');
    }
    case 'law': {
      const board = ctx.live.lawBoard || lawBoard(ctx.ch, { acct: ctx.acct, owned: ctx.owned });
      if (board.indicted) return op('law:trial');
      if (cash >= LAW.RETAINER_COST) return op('law:retainer');
      if (!jailed(ctx.ch) && omr >= num(board.envelope?.cost ?? LAW.ENVELOPE_OMR)) return op('law:envelope');
      if (!jailed(ctx.ch) && !safeHoused(ctx.ch) && num(board.exposure) >= LAW.WATCH
          && cash >= num(board.bribeCost ?? bribeCostOf(board.exposure))) return op('law:bribe');
      if (ctx.acct.rat && !jailed(ctx.ch) && !ctx.ch.witpro_until) return op('law:witpro');
      return stop('status');
    }
    case 'jailed': return jailed(ctx.ch) && !inHole(ctx.ch) ? op('pen:faction') : stop('status');
    case 'wire': {
      const board = ctx.live.wireBoard || {};
      if ((board.watches || []).length) return op('wire:cancel-watch');
      const cheapestSub = Math.min(...(board.subTiers || []).map((tier) => num(tier.omr)).filter((price) => price > 0),
        num(board.costs?.sub) || Infinity);
      if (omr >= cheapestSub) return op('wire:subscribe');
      if (omr >= num(board.costs?.disinfo || Infinity)) return op('wire:disinfo');
      if (num(board.bugsOnYou) > 0 && omr >= Math.min(num(board.costs?.sweep || Infinity), num(board.costs?.trace || Infinity)))
        return op('wire:sweep');
      const targets = socialRows(ctx);
      const taps = board.taps || [];
      const tapTarget = taps.map((tap) => tap.target || targetId(tap)).find(Boolean);
      if (tapTarget && omr >= num(board.costs?.tap || Infinity)) return op(`wire:tap:${tapTarget}`);
      if (targets.length && taps.length < num(board.tapMax) && omr >= num(board.costs?.tap || Infinity))
        return op(`wire:tap:${targetId(targets[0])}`);
      const informants = board.informants || [];
      const informantTarget = informants.map((informant) => informant.target || targetId(informant)).find(Boolean);
      if (informantTarget && omr >= num(board.costs?.informant || Infinity))
        return op(`wire:informant:${informantTarget}`);
      if (targets.length && informants.length < num(board.informantMax)
          && omr >= num(board.costs?.informant || Infinity)) return op(`wire:informant:${targetId(targets[0])}`);
      return stop(targets.length ? 'resource' : 'social');
    }
    case 'intel': {
      const board = ctx.live.secretsBoard || {};
      if ((board.held || []).some((secret) => secret.exposable !== false)) return op('secret:expose');
      const payable = (board.onMe || []).find((secret) => cash >= num(secret.demand));
      if (payable) return op(`secret:pay:${payable.id}`);
      const cost = intelCost(num(board.digOmr || SECRETS.DIG_OMR), num(ctx.acct.intel_ops));
      const digTarget = socialRows(ctx).find((row) => !row.secretHeld && !row.secretCooling);
      return gate((board.held || []).length < num(board.maxHeld ?? SECRETS.MAX_HELD)
        && !!digTarget && omr >= cost, `secret:dig:${targetId(digTarget)}`, digTarget ? 'resource' : 'social');
    }
    case 'skills': {
      const board = skillsBoard(ctx.ch, { acct: ctx.acct, owned: ctx.owned });
      const known = ctx.owned.skills || new Set();
      const canLearn = board.tree.some((skill) => !skill.known && skill.cost <= board.points.available
        && (skill.tier === 1 || known.has(SKILLS.TREE.find((candidate) =>
          candidate.branch === skill.branch && candidate.tier === skill.tier - 1)?.id)));
      return canLearn ? op('skills:learn') : stop('status');
    }
    case 'underworld': {
      if (jailed(ctx.ch)) return stop('status');
      const board = ctx.live.underworldBoard || {};
      const npcs = board.npcs || UNDERWORLD.NPCS.map((npc) => ({ id: npc.id,
        standing: num(ctx.owned.npc?.[npc.id]), grudge: num(ctx.owned.grudges?.[npc.id]) }));
      const penance = npcs.find((npc) => num(npc.grudge) > 0 && cash >= num(board.penance ?? UNDERWORLD.STEP4.PENANCE_COST));
      if (penance) return op(`underworld:penance:${penance.id}`);
      const errand = npcs.find((npc) => num(npc.standing) >= UNDERWORLD.THRESHOLDS[0]);
      if (errand) return op(`underworld:errand:${errand.id}`);
      const gift = npcs.find((npc) => num(npc.standing) < num(board.gift?.cap ?? UNDERWORLD.GIFT_CAP));
      return gate(!!gift && cash >= num(board.gift?.cost ?? UNDERWORLD.GIFT_COST), `underworld:gift:${gift?.id}`);
    }
    case 'estate': return gate(omr >= num(ESTATE.TIERS[0]?.omr), 'estate:tier');
    case 'made': return isMade(ctx.acct) ? stop('status')
      : jailed(ctx.ch) ? stop('status') : gate(omr >= MADE.OMR, 'made:dues');
    case 'auction': return ctx.live.auctionMinBid == null ? stop('status')
      : gate(omr >= ctx.live.auctionMinBid, 'auction:bid');
    case 'collection': return gate(ctx.live.collectionItems.some((item) => {
      if (item.minted_onchain) return false;
      const next = RARITY.TIERS[rarityIdx(String(item.rarity || 'common')) + 1];
      return !!next && omr >= num(RARITY.UPGRADE_OMR[rarityIdx(next.id)]);
    }), 'collection:rarity');
    case 'legit': {
      if (omr > 0) return op('stake');
      if (num(ctx.acct.staked) > 0 && !nowActive(ctx.acct.stake_lock_until)) return op('unstake');
      return num(ctx.acct.mint_credits) > 0 ? op('character:mint-credit') : stop('resource');
    }
    case 'megaproject': {
      if (jailed(ctx.ch) || !ctx.live.megaBoard?.current) return stop('status');
      if (cash >= MEGAPROJECT.MIN_CASH) return op('megaproject:cash');
      if (omr >= MEGAPROJECT.MIN_OMR) return op('megaproject:omr');
      const freight = Object.entries(ctx.owned.cargo || {}).find(([id, qty]) => {
        const good = GOODS.find((candidate) => candidate.id === id);
        return good && num(ctx.live.megaBoard.current.remaining) >= MEGAPROJECT.MIN_CASH
          && num(qty) * num(good.base) >= MEGAPROJECT.MIN_CASH;
      });
      return freight ? op(`megaproject:goods:${freight[0]}`) : stop('resource');
    }
    case 'streetLife': {
      // Pulling your own favor has no location/status gate and returns escrow; keep that reversible
      // operation visible even when every new Street Life action is blocked by lockup.
      if ((ctx.live.favorBoard?.mine || []).length) return op('favor:cancel');
      if (jailed(ctx.ch)) return stop('status');
      const corner = ctx.live.cornerBoard || {};
      const claim = (corner.tasks || []).find((candidate) => candidate.canClaim === true);
      if (claim) return op(`corner:claim:${claim.slot}`);
      const task = (corner.tasks || []).find((candidate) => candidate.canAccept === true);
      if (task) return op(`corner:accept:${task.slot}`);
      const call = ctx.live.contactsBoard?.call;
      if (call && call.district === ctx.ch.loc
          && (call.kind !== 'freight' || num(ctx.owned.cargo?.[call.good]) >= num(call.qty))) return op('contact:fulfill');
      const favor = (ctx.live.favorBoard?.open || []).find((candidate) => candidate.canRun === true);
      if (favor) return op(`favor:run:${favor.id}`);
      if (ctx.live.favorBoard?.canPost) return op('favor:post');
      return stop('status');
    }
    case 'landmark': return gate(omr >= ctx.live.landmarkMinDedicate, 'landmark:dedicate');
    case 'deed': return ctx.owned.deed ? stop('status') : op('deed:claim');
    case 'vanity': {
      const paidIdentity = omr >= Math.min(VANITY.NAME_CHANGE_OMR, VANITY.TITLE_OMR);
      const paidPlate = has(ctx.owned.cars) && omr >= VANITY.PLATE_OMR;
      return gate(paidIdentity || paidPlate || !!ctx.ch.title, paidIdentity ? 'vanity:name' : paidPlate ? 'vanity:plate' : 'vanity:clear-title');
    }
    default: return stop('status');
  }
}

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
 * Coverage history is always one grouped telemetry query. Standalone callers may additionally pass
 * a read-only live loader; it is evaluated once, after level/policy/visit filtering, for route state.
 */
export async function systemCoverage(db, ch, acct = {}, owned = {}, options = {}) {
  const { onlineAccounts = [] } = options;
  const rows = (await db.query(
    'SELECT event, COUNT(*) AS count FROM telemetry WHERE account_id=$1 GROUP BY event', [ch.account_id])).rows;
  const telemetry = new Set(rows.filter((row) => num(row.count) > 0).map((row) => row.event));
  const ctx = { ch, acct, owned, onlineAccounts, level: levelOf(num(ch.respect)), live: {} };
  const visited = new Map();
  for (const entry of SYSTEMS) {
    const event = ENGAGEMENT_SYSTEMS[entry.system].find((candidate) => telemetry.has(candidate));
    if (event) visited.set(entry.systemId, { visited: true, source: 'telemetry' });
    else {
      const source = entry.state?.(ctx) || null;
      if (source) visited.set(entry.systemId, { visited: true, source });
    }
  }

  const needsLive = new Set(SYSTEMS.filter((entry) => !visited.has(entry.systemId)
    && ctx.level >= entry.at && !entry.policy && !(acct.agent_flag && entry.agentPolicy))
    .map((entry) => entry.eligibility));
  const suppliedLive = options.live || {};
  const loadedLive = options.liveLoader ? await options.liveLoader(needsLive) : {};
  const live = { ...loadedLive, ...suppliedLive };
  const fallbackFamilies = onlineRows(ctx).map((row) => typeof row === 'object' && (row.gangId || row.gang_id)).filter(Boolean);
  ctx.live = {
    commissionSeatGangIds: live.commissionSeatGangIds || [],
    freeSpeakeasyDistricts: live.freeSpeakeasyDistricts || [],
    auctionMinBid: live.auctionMinBid ?? null,
    collectionItems: live.collectionItems || [],
    landmarkMinDedicate: live.landmarkMinDedicate ?? LANDMARKS.MIN_DEDICATE,
    heistBoard: live.heistBoard || { jobs: [], open: [], mine: null, you: { pulled: 0 } },
    loanBoard: live.loanBoard || { offers: [], active: [], paper: [], house: {}, terms: { min: LOAN.MIN } },
    marketBoard: live.marketBoard || { listings: [], levers: {} },
    marketOwn: live.marketOwn || [],
    socialTargets: Object.hasOwn(live, 'socialTargets') ? live.socialTargets : undefined,
    joinableFamilyIds: live.joinableFamilyIds || fallbackFamilies,
    convoyBoard: live.convoyBoard || { mine: null, inTransit: [] },
    portBoard: live.portBoard || { atDocks: ch.loc === PORT.DISTRICT, catalog: PORT.BOATS, fleet: [],
      fleetMax: PORT.FLEET_MAX + num(ch.berths), contraband: { book: num(ch.contraband) } },
    stableBoard: live.stableBoard || { stable: [], stableMax: STABLE.STABLE_MAX, kinds: STABLE.KINDS },
    lawBoard: live.lawBoard || lawBoard(ch, { acct, owned }),
    wireBoard: live.wireBoard || { costs: { tap: WIRE.TAP_OMR, sweep: WIRE.SWEEP_OMR,
      sub: WIRE.SUB_OMR, trace: WIRE.TRACE_OMR, dossier: WIRE.DOSSIER_OMR,
      disinfo: WIRE.DISINFO_OMR, informant: WIRE.INFORMANT_OMR }, subTiers: WIRE.SUB_TIERS,
      watches: [], taps: [], informants: [], bugsOnYou: 0, tapMax: WIRE.TAP_MAX,
      informantMax: WIRE.INFORMANT_MAX },
    secretsBoard: live.secretsBoard || { held: [], onMe: [], digOmr: SECRETS.DIG_OMR, maxHeld: SECRETS.MAX_HELD },
    underworldBoard: live.underworldBoard || { errand: null, gift: { cost: UNDERWORLD.GIFT_COST,
      cap: UNDERWORLD.GIFT_CAP }, penance: UNDERWORLD.STEP4.PENANCE_COST,
      npcs: UNDERWORLD.NPCS.map((npc) => ({ id: npc.id, standing: num(owned.npc?.[npc.id]),
        grudge: num(owned.grudges?.[npc.id]) })) },
    megaBoard: live.megaBoard || { current: null },
    cornerBoard: live.cornerBoard || { tasks: [] },
    contactsBoard: live.contactsBoard || { call: null },
    favorBoard: live.favorBoard || { open: [], mine: [] },
    vouchBoard: live.vouchBoard || { slotsLeft: VOUCH.MAX_OUT, given: [] },
    clueBoard: live.clueBoard || { scroll: null },
    worldBoard: live.worldBoard || { npcs: WORLD_NPCS.map((npc) => ({ id: npc.id, coop: !!npc.coop,
      canRaid: ctx.level >= npc.minLvl })) },
    warBoard: live.warBoard || { families: [] },
    territoryBoard: live.territoryBoard || { own: [], rival: null },
  };

  const blocked = { level: 0, resource: 0, status: 0, social: 0, policy: 0 };
  const ready = [];
  for (const entry of SYSTEMS) {
    if (visited.has(entry.systemId)) continue;
    let blocker = null;
    if (ctx.level < entry.at) blocker = 'level';
    else if (entry.policy || (acct.agent_flag && entry.agentPolicy)) blocker = 'policy';
    else {
      const eligibility = systemEligibility(entry, ctx);
      blocker = eligibility.blocker;
      if (!blocker && !eligibility.operation)
        throw new Error(`Explore readiness for ${entry.systemId} has no authoritative operation witness.`);
    }
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

async function scopedSocialContext(db, ch, onlineAccounts) {
  const visible = onlineRows({ ch, onlineAccounts });
  // Presence is already a server-owned, authenticated socket registry. Evaluate every distinct hint:
  // truncating here made eligibility depend on Map insertion order and hid a real operation whenever
  // its player happened to be #101. Privacy stays bounded at the projection/output boundary below:
  // only living human rows are enriched, and no target row or operation witness leaves Explore.
  const charIds = [...new Set(visible.map((row) => typeof row === 'object' && targetId(row)).filter(Boolean))];
  const accountIds = [...new Set(visible.map((row) => typeof row === 'string' ? row : targetAccount(row)).filter(Boolean))];
  if (!charIds.length && !accountIds.length) return { socialTargets: [], joinableFamilyIds: [] };

  const params = [];
  const clause = [];
  if (charIds.length) {
    const slots = charIds.map((id) => { params.push(id); return `$${params.length}`; });
    clause.push(`c.id IN (${slots.join(',')})`);
  }
  if (accountIds.length) {
    const slots = accountIds.map((id) => { params.push(id); return `$${params.length}`; });
    clause.push(`c.account_id IN (${slots.join(',')})`);
  }
  const characters = (await db.query(
    `SELECT c.id, c.account_id, c.respect, c.cash, c.jail_until, c.hosp_until, c.witpro_until,
            c.pen_safe_until, c.hole_until, c.duel_limit, c.wanted_until, ap.rat
       FROM characters c JOIN account_persistent ap ON ap.account_id=c.account_id
      WHERE c.alive AND NOT c.is_npc AND NOT ap.agent_flag AND (${clause.join(' OR ')})`, params)).rows;
  if (!characters.length) return { socialTargets: [], joinableFamilyIds: [] };
  const ids = characters.map((row) => row.id);
  const accounts = characters.map((row) => row.account_id);
  const idSlots = ids.map((_, index) => `$${index + 1}`).join(',');
  const accountSlots = accounts.map((_, index) => `$${index + 1}`).join(',');
  const [gangRows, crewRows, heldRows, digRows] = await Promise.all([
    db.query(`SELECT character_id, gang_id FROM gang_members WHERE character_id IN (${idSlots})`, ids),
    db.query(`SELECT account_id, crew_id FROM crew_members WHERE account_id IN (${accountSlots})`, accounts),
    db.query('SELECT target_account FROM secrets WHERE holder_character=$1 AND expires_at > now()', [ch.id]),
    db.query(`SELECT target_account, at FROM digs WHERE character_id=$1 AND target_account IN (${accounts
      .map((_, index) => `$${index + 2}`).join(',')})`, [ch.id, ...accounts]),
  ]);
  const gangByCharacter = new Map(gangRows.rows.map((row) => [row.character_id, row.gang_id]));
  const crewByAccount = new Map(crewRows.rows.map((row) => [row.account_id, row.crew_id]));
  const held = new Set(heldRows.rows.map((row) => row.target_account));
  const dug = new Map(digRows.rows.map((row) => [row.target_account, row.at]));
  const gangIds = [...new Set(gangRows.rows.map((row) => row.gang_id).filter(Boolean))];
  let joinableFamilyIds = [];
  if (gangIds.length) {
    const slots = gangIds.map((_, index) => `$${index + 1}`).join(',');
    const counts = (await db.query(
      `SELECT gang_id, COUNT(*) n FROM gang_members WHERE gang_id IN (${slots}) GROUP BY gang_id`, gangIds)).rows;
    const byGang = new Map(counts.map((row) => [row.gang_id, num(row.n)]));
    joinableFamilyIds = gangIds.filter((id) => num(byGang.get(id)) < M3.GANG_MAX_MEMBERS);
  }
  return {
    socialTargets: characters.map((row) => ({
      ...row,
      characterId: row.id,
      accountId: row.account_id,
      gangId: gangByCharacter.get(row.id) || null,
      crewId: crewByAccount.get(row.account_id) || null,
      level: levelOf(num(row.respect)),
      secretHeld: held.has(row.account_id),
      secretCooling: !!dug.get(row.account_id)
        && Date.now() - new Date(dug.get(row.account_id)).getTime() < SECRETS.DIG_CD_MS,
    })),
    joinableFamilyIds,
  };
}

async function coverageLiveContext(db, ch, acct, owned, onlineAccounts, needs) {
  const week = weekOf();
  const wants = (...keys) => keys.some((key) => needs.has(key));
  const tasks = {};
  if (wants('familySeat')) tasks.seats = seatedGangs(db);
  if (wants('speakeasy')) tasks.speakeasies = db.query('SELECT district_id FROM speakeasies');
  if (wants('auction')) tasks.auctions = db.query(
    'SELECT lot_id, current_bid, bidder, status FROM auctions WHERE week=$1', [week]);
  if (wants('collection', 'port')) tasks.collection = db.query(
    `SELECT 'car' AS kind, id, rarity, minted_onchain, listed, pledged,
            NULL::text AS kind_id, NULL::timestamptz AS run_until FROM cars WHERE character_id=$1
      UNION ALL
      SELECT 'boat' AS kind, id, rarity, minted_onchain, false AS listed, false AS pledged,
            kind AS kind_id, run_until FROM boats WHERE character_id=$1`, [ch.id]);
  if (wants('landmark')) tasks.landmarks = db.query('SELECT district_id, amount FROM landmarks');
  if (wants('crew')) tasks.heists = heistBoard(db, ch.id);
  if (wants('loan')) tasks.loans = loanBoard(db, ch);
  if (wants('market')) {
    tasks.market = marketBoard(db);
    tasks.marketOwn = db.query(
      `SELECT seller_character, kind, status, filled_qty, district, good_id, qty, price,
              bidder, bid, reserve
         FROM market_listings
        WHERE seller_character=$1
          AND (status IN ('live','expired') OR (kind='order' AND filled_qty > 0))`, [ch.id]);
  }
  if (wants('convoy')) tasks.convoy = convoyBoard(db, ch.id);
  if (wants('port')) tasks.port = portBoard(ch, db, { acct, owned });
  if (wants('stable')) tasks.stable = stableBoard(db, ch.id);
  if (wants('wire')) tasks.wire = wireBoard(ch, db, { acct, owned });
  if (wants('intel')) tasks.secrets = secretsBoard(ch, db);
  if (wants('underworld')) tasks.underworld = underworldBoard(ch, db, { acct, owned });
  if (wants('megaproject')) tasks.mega = megaBoard(db, ch.account_id);
  if (wants('streetLife')) {
    tasks.corner = cornerBoard(ch, db);
    tasks.contacts = contactsBoard(db, ch.account_id);
    tasks.favors = favorBoard(ch, db, { acct, owned });
  }
  if (wants('clue')) tasks.clue = clueBoard(db, ch, acct);
  if (wants('family')) {
    tasks.territory = territoryExploreBoard(db, ch, owned.gangId);
    tasks.world = worldBoard(db, ch, { acct, owned });
    tasks.war = warBoard(db, ch);
  }
  if (wants('counterparty')) tasks.vouches = vouchBoard(db, ch);
  if (wants('counterparty', 'reachableFamily', 'wire', 'intel'))
    tasks.social = scopedSocialContext(db, ch, onlineAccounts);
  const keys = Object.keys(tasks);
  const values = await Promise.all(Object.values(tasks));
  const loaded = Object.fromEntries(keys.map((key, index) => [key, values[index]]));
  const seats = loaded.seats || [];
  const speakeasies = loaded.speakeasies || { rows: [] };
  const auctionRows = loaded.auctions || { rows: [] };
  const collectionRows = loaded.collection || { rows: [] };
  const landmarkRows = loaded.landmarks || { rows: [] };
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
    heistBoard: loaded.heists,
    loanBoard: loaded.loans,
    marketBoard: loaded.market,
    marketOwn: loaded.marketOwn?.rows,
    convoyBoard: loaded.convoy,
    portBoard: loaded.port,
    stableBoard: loaded.stable,
    lawBoard: lawBoard(ch, { acct, owned }),
    wireBoard: loaded.wire,
    secretsBoard: loaded.secrets,
    underworldBoard: loaded.underworld,
    megaBoard: loaded.mega,
    cornerBoard: loaded.corner,
    contactsBoard: loaded.contacts,
    favorBoard: loaded.favors,
    vouchBoard: loaded.vouches,
    clueBoard: loaded.clue,
    worldBoard: loaded.world,
    warBoard: loaded.war,
    territoryBoard: loaded.territory,
    ...(loaded.social || {}),
  };
}

// Standalone Explore loads shared live context, then delegates to the one resolver/catalog.
export async function exploreBoard(db, ch, acct = {}, owned = {}, options = {}) {
  if (options.live) return systemCoverage(db, ch, acct, owned, options);
  return systemCoverage(db, ch, acct, owned, { ...options,
    liveLoader: (needs) => coverageLiveContext(db, ch, acct, owned, options.onlineAccounts || [], needs) });
}
