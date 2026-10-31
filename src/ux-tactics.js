// Read-only decision aids. No projection grants authority or samples an outcome.
import {
  CRIMES, M3, PACING, MARKET, ASSETS, SKILLS, SOLDIERS, PORT, NOTORIETY, COMMISSION, CONSUMABLES,
  effStat, levelOf, rankIdxOf, gangLevelOf, roleMultOf, cityEventOf, dayOf, pathFx,
  soldierFxOf, coolLeft, boatOf, effHold, effSpeed, interdictChance, cityHourOf,
  smuggleRepPerks, smugglerTierOf, notorietyNow, jailed, hospitalized, safeHoused,
} from './rules.js';
import { GameError, view, healCostOf, masteryFx, assignedSoldier, doCrime } from './game.js';
import { skillsBoard } from './skills.js';
import { portBoard } from './port.js';
import { activeDecree } from './commission.js';
import { accrue } from './accrual.js';
import { itemEffectPreview } from './economy.js';

const amount = (value) => Number(value || 0);
const remaining = (value, now = Date.now()) => value ? Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000)) : 0;
export const MASTERY_TRIALS = Object.freeze([
  Object.freeze({ id: 'light-touch', name: 'Light touch', target: 2, nerveBudget: 12,
    rule: 'Complete two successful jobs within 12 listed job nerve. Unsuccessful jobs also count toward the budget.',
    stamp: 'Light touch practice' }),
  Object.freeze({ id: 'three-approaches', name: 'Three ways through', target: 3,
    approaches: Object.freeze(Object.keys(M3.CRIME_APPROACHES)),
    rule: 'Complete a successful job using each approach: quiet, standard and loud. Ordinary costs, heat and failure risks apply.',
    stamp: 'Three approaches practice' }),
  Object.freeze({ id: 'measured-risk', name: 'Measured risk', target: 2, minimumChance: 0.85,
    rule: 'Complete two different jobs successfully, each with at least an 85% success projection immediately before the attempt.',
    stamp: 'Measured risk practice' }),
]);
function ids(value, valid, fallback) {
  if (value == null) return [...fallback];
  if (typeof value !== 'string' || value.length > 3000) throw new GameError('preview', 'Invalid preview selection.');
  const result = value === 'none' || value === '' ? [] : [...new Set(value.split(','))];
  if (result.length > valid.length || result.some(id => !valid.includes(id))) throw new GameError('preview', 'Choose entries from the current catalog.');
  return result;
}
export function previewSkillAllocation(ch, h, proposed) {
  const selected = new Set(proposed);
  const board = skillsBoard(ch, { ...h, owned: { ...h.owned, skills: selected } });
  const conflicts = [];
  if (board.points.spent > board.points.total) conflicts.push(`Uses ${board.points.spent} points; current budget is ${board.points.total}.`);
  for (const skill of board.tree.filter(s => selected.has(s.id) && s.tier > 1)) {
    const prereq = board.tree.find(s => s.branch === skill.branch && s.tier === skill.tier - 1);
    if (prereq && !selected.has(prereq.id)) conflicts.push(`${skill.name} requires ${prereq.name}.`);
  }
  return { ...board, conflicts, hypothetical: true };
}

// doCrime currently keeps this expression inside its mutation. This named mirror is
// parity-tested at real doCrime roll boundaries, payouts and jail terms in ux-tactics.js.
// Levers and all stat/perk helpers come from their authoritative implementations.
export function quoteCrime(ch, h, crime, approach, second = null) {
  const ap = M3.CRIME_APPROACHES[approach] || M3.CRIME_APPROACHES.standard;
  const lvl = levelOf(amount(ch.respect)), rank = rankIdxOf(lvl), ev = cityEventOf(dayOf());
  const held = new Set([...(h.owned.held || []), ...(h.owned.deedPerk || [])]);
  const stats = Object.fromEntries(['muscle', 'cunning', 'speed'].map(stat => [stat, effStat(amount(ch[stat]), stat, h.owned.assets || [], h.owned.gear || [])]));
  const gang = h.owned.gang ? gangLevelOf(h.owned.gang.treasury) * 0.02 : 0;
  const turf = held.has('brick') ? 0.02 : 0, rankBonus = rank >= 9 ? 0.02 : 0;
  const threshold = Math.min(0.97, (crime.base + stats.cunning * M3.CRIME_STAT.CUN + stats.speed * M3.CRIME_STAT.SPD - M3.CRIME_STAT.OFFSET + gang + turf + rankBonus) * ap.successMult);
  const payMult = (held.has('canal') ? 1.1 : 1) * (rank >= 1 ? 1.05 : 1) * (rank >= 8 ? 1.10 : 1)
    * roleMultOf(h.owned.gangRole) * (ev.jobPay || 1) * ap.payMult * (ap.id === 'loud' ? (M3.CRIME_LOUD_CASH_PREMIUM ?? 1) : 1);
  const netTake = raw => { const gross = Math.floor(raw * payMult); return gross - (second ? Math.floor(gross * SOLDIERS.CUT_BPS / 10000) : 0); };
  const jailSeconds = Math.round(crime.jail * (ev.jailMult || 1) * (rank >= 5 ? 0.8 : 1) * ap.jailMult
    * (h.owned.skills?.has('getaway') ? SKILLS.FX.JAIL_MULT : 1) * masteryFx(h, 'larceny') * pathFx(ch, 'jailStint')
    * (second?.trait === 'wheelman' ? Math.max(0, 1 - soldierFxOf(second)) : 1));
  const blockers = [];
  const streetSeconds = coolLeft(ch.street_action_at);
  if (jailed(ch)) blockers.push('In lockup.');
  if (lvl < crime.lvl) blockers.push(`Requires level ${crime.lvl}.`);
  if (amount(ch.nerve) < crime.nerve) blockers.push(`Requires ${crime.nerve} nerve.`);
  if (streetSeconds) blockers.push('Street clock active.');
  return {
    id: `${crime.id}:${ap.id}`, crimeId: crime.id, name: crime.name, approach: ap.id, approachName: ap.name,
    path: `/v1/crimes/${crime.id}`, body: { approach: ap.id }, tab: 'streets', minLevel: crime.lvl,
    cost: { nerve: crime.nerve, energy: 0, cash: 0 }, probability: Math.max(0, threshold), threshold,
    cooldown: { group: 'street', seconds: PACING.STREET_ACTION_CD_MS / 1000,
      readyAt: Date.now() + streetSeconds * 1000 },
    cashRange: { min: netTake(crime.cash[0]), upperBound: netTake(crime.cash[1]), conditional: 'Only on success; upper bound, not a guaranteed reward.' },
    heat: Math.min(100, amount(ch.heat) + ap.heat) - amount(ch.heat), jailSeconds, blockers,
    formula: { source: 'src/game.js · doCrime', inputs: { base: crime.base, cunning: stats.cunning, speed: stats.speed, gang, turf, rank: rankBonus, successMult: ap.successMult },
      expression: { op: 'min', args: [0.97, { op: 'mul', args: [{ op: 'add', args: [{ input: 'base' }, { op: 'mul', args: [{ input: 'cunning' }, M3.CRIME_STAT.CUN] }, { op: 'mul', args: [{ input: 'speed' }, M3.CRIME_STAT.SPD] }, -M3.CRIME_STAT.OFFSET, { input: 'gang' }, { input: 'turf' }, { input: 'rank' }] }, { input: 'successMult' }] }] },
      coefficients: { cunning: M3.CRIME_STAT.CUN, speed: M3.CRIME_STAT.SPD, offset: M3.CRIME_STAT.OFFSET },
    },
    modifiers: [
      { label: 'Effective cunning', value: stats.cunning, effect: `+${(stats.cunning * M3.CRIME_STAT.CUN * 100).toFixed(1)} percentage points before approach` },
      { label: 'Effective speed', value: stats.speed, effect: `+${(stats.speed * M3.CRIME_STAT.SPD * 100).toFixed(1)} percentage points before approach` },
      { label: 'Family level', value: gang, effect: 'Added before approach' }, { label: 'Brick turf', value: turf, effect: 'Added once before approach' },
      { label: 'Street rank', value: rankBonus, effect: 'Added before approach' }, { label: 'Approach', value: ap.successMult, effect: 'Multiplier before 97% ceiling' },
      { label: 'Path', value: pathFx(ch, 'jailStint'), effect: 'Jail duration multiplier; no job success-roll modifier' },
      { label: 'Getaway skill', value: h.owned.skills?.has('getaway') ? SKILLS.FX.JAIL_MULT : 1, effect: 'Jail duration multiplier; no job success-roll modifier' },
      { label: 'Health / law heat', value: null, effect: 'Not inputs to the job success roll. Lockup separately blocks attempts.' },
    ],
  };
}

export function recoveryOptions(ch, h, now = Date.now()) {
  // Sample the existing accrual function on detached copies at zero resources to
  // read actual regeneration rates without duplicating its rank/turf formula.
  const sample = { ...structuredClone(ch), energy: 0, nerve: 0, health: 0, last_accrued_at: new Date(now) };
  accrue(sample, structuredClone(h.acct || {}), { preview: true, assets: h.owned.assets || [], held: h.owned.held || [],
    deedHeld: h.owned.deedPerk || [], deedActiveFrom: h.owned.deedActiveFrom, disciplines: h.owned.disciplines || {} }, new Date(now + 1000));
  const current = view(ch, h.acct, h.owned);
  const rates = { energy: amount(sample.energy) * 60, nerve: amount(sample.nerve) * 60, health: amount(sample.health) * 60 };
  const waits = ['energy', 'nerve', 'health'].map(resource => {
    const target = resource === 'health' ? 100 : current[resource === 'energy' ? 'maxEnergy' : 'maxNerve'];
    const missing = Math.max(0, target - amount(ch[resource]));
    return { id: `wait-${resource}`, name: `Let ${resource} recover`, cost: 'No cash or items', seconds: rates[resource] ? Math.ceil(missing / rates[resource] * 60) : null,
      effect: `Restore toward ${target} ${resource}`, restrictions: ['Time estimate assumes current regeneration modifiers remain in place.', 'Waiting does not clear independent activity cooldowns.'], tab: 'life' };
  });
  const healCost = healCostOf(ch, h.owned);
  const heal = { id: 'doc', name: 'Visit the Doc', cost: `$${healCost} cash`, seconds: 0, effect: `Restore ${100 - Math.floor(amount(ch.health))} health`,
    restrictions: [...(healCost <= 0 ? ['Already healthy.'] : []), ...(amount(ch.cash) < healCost ? ['Insufficient cash.'] : []), 'Healing health does not end hospital protection or an activity cooldown.'], tab: 'life' };
  const items = CONSUMABLES.filter(item => amount(h.owned.items?.[item.id]) > 0).map(item => {
    const preview = itemEffectPreview(ch, item.id, h.owned);
    const changes = Object.entries(preview.deltas).filter(([, delta]) => delta).map(([resource, delta]) => `${delta > 0 ? '+' : ''}${Math.round(delta * 100) / 100} ${resource}`);
    if (preview.clearsLockup) changes.push('Clears lockup');
    return { id: `item-${item.id}`, name: item.name, cost: `1 owned item (${preview.held} held)`, seconds: 0,
      effect: changes.join(' · ') || 'No resource change at the current caps', preview,
      restrictions: ['Exact current-state effect from the same helper used by the live item route.', 'Independent activity cooldowns remain in place.', 'Use the existing inventory control after reviewing.'], tab: 'garage' };
  });
  const jailSeconds = remaining(ch.jail_until, now);
  if (jailSeconds) waits.push({ id: 'wait-lockup', name: 'Serve the remaining sentence', cost: 'No cash or items', seconds: jailSeconds, effect: 'Leave lockup when the current sentence expires', restrictions: ['Yard events or actions can change the sentence.'], tab: 'pen' });
  const hospitalSeconds = remaining(ch.hosp_until, now);
  if (hospitalSeconds) waits.push({ id: 'wait-hospital', name: 'Wait for hospital protection to end', cost: 'No cash or items', seconds: hospitalSeconds, effect: 'Hospital clock expires', restrictions: ['Healing health does not shorten this clock.'], tab: 'life' });
  return { rates, options: [...waits, heal, ...items] };
}

export async function seaComparisons(ch, client, h) {
  const board = await portBoard(ch, client, h);
  const boats = (await client.query('SELECT * FROM boats WHERE character_id=$1 ORDER BY created_at', [ch.id])).rows.filter(b => !b.minted_onchain);
  const rep = smuggleRepPerks(smugglerTierOf(amount(h.acct?.smuggled)));
  const notoriety = (await client.query("SELECT route_key, notoriety, noted_at FROM route_notoriety WHERE character_id=$1 AND route_key LIKE 'port:%'", [ch.id])).rows;
  const decree = await activeDecree(client), patrol = cityHourOf().patrol ? 15 : -10;
  const quotes = [];
  for (const boat of boats) for (const route of PORT.ROUTES) for (const escorted of [false, true]) {
    const spec = boatOf(boat.kind), hold = effHold(boat, spec), speed = effSpeed(boat, spec);
    const row = notoriety.find(r => r.route_key === `port:${route.id}`);
    const currentHeat = row ? notorietyNow(row.notoriety, row.noted_at, rep.decayMult) : 0;
    const launchHeat = Math.min(NOTORIETY.MAX, currentHeat + NOTORIETY.GAIN * rep.gainMult);
    const base = interdictChance(route, { speed }, escorted, patrol);
    const chance = process.env.PORT_INTERDICT_P != null ? Number(process.env.PORT_INTERDICT_P)
      : Math.min(PORT.INTERDICT_MAX, base * (decree?.id === 'smugglers_moon' ? COMMISSION.PORT_INTERDICT_MULT : 1) + Math.min(NOTORIETY.PORT_P_CAP, launchHeat * NOTORIETY.PORT_P_PER));
    const cost = hold * route.buy, escortCost = escorted ? PORT.ESCORT_COST : 0, proceeds = hold * route.sell;
    const toll = board.harbormaster.tolled ? Math.floor(proceeds * PORT.STEP3.TOLL_BPS / 10000 * rep.tollMult) : 0;
    const blockers = [];
    if (jailed(ch)) blockers.push('In lockup.'); if (hospitalized(ch)) blockers.push('Under hospital care.'); if (safeHoused(ch)) blockers.push('In a safehouse.');
    if (ch.loc !== PORT.DISTRICT) blockers.push(`Launch at ${PORT.DISTRICT}.`);
    if (boat.run_until) blockers.push('Boat already committed to a run.');
    if (levelOf(amount(ch.respect)) < route.minLvl) blockers.push(`Requires level ${route.minLvl}.`);
    if (speed < route.minSpeed) blockers.push(`Requires ${route.minSpeed} knots.`);
    if (cost > board.supplyLeft) blockers.push('Daily supply allowance is too small.');
    if (amount(ch.cash) < cost + escortCost) blockers.push('Insufficient cash for cargo and escort.');
    quotes.push({ id: `${boat.id}:${route.id}:${escorted}`, boatId: boat.id, boatName: spec.name, routeId: route.id, routeName: route.name,
      hold, speed, escorted, cost, escortCost, totalCost: cost + escortCost, proceeds, toll, cleanMargin: proceeds - cost - escortCost - toll,
      interceptionProbability: chance, seconds: Math.ceil(Number(process.env.PORT_RUN_MS ?? route.ms) / 1000), blockers,
      source: 'src/port.js · launchRun / collectRun; shared interdictChance',
      assumption: 'If collected under the current patrol, decree and post-launch lane heat. Heat can decay; conditions, toll holder, piracy and boat survival can change before collection.',
    });
  }
  return { quotes, fleet: board.fleet.filter(b => boats.some(raw => raw.id === b.id)), escort: board.escort, atDocks: board.atDocks, supplyLeft: board.supplyLeft, district: board.district };
}

export async function tacticsBoard(ch, client, h, query = {}) {
  const current = view(ch, h.acct, h.owned), known = [...(h.owned.skills || [])];
  const selectedGear = ids(query.gear, MARKET.map(g => g.id), h.owned.gear || []);
  const selectedSkills = ids(query.skills, SKILLS.TREE.map(s => s.id), known);
  const hypothetical = query.gear != null || query.skills != null;
  const proposed = { ...h, owned: { ...h.owned, gear: selectedGear, skills: new Set(selectedSkills) } };
  const second = await assignedSoldier(client, ch.id);
  const jobs = CRIMES.map(crime => ({ id: crime.id, name: crime.name, minLevel: crime.lvl,
    actual: Object.keys(M3.CRIME_APPROACHES).map(ap => quoteCrime(ch, h, crime, ap, second)),
    proposed: Object.keys(M3.CRIME_APPROACHES).map(ap => quoteCrime(ch, proposed, crime, ap, second)),
  }));
  const actualStats = Object.fromEntries(['muscle', 'cunning', 'speed'].map(s => [s, effStat(amount(ch[s]), s, h.owned.assets || [], h.owned.gear || [])]));
  const proposedStats = Object.fromEntries(['muscle', 'cunning', 'speed'].map(s => [s, effStat(amount(ch[s]), s, h.owned.assets || [], selectedGear)]));
  const planner = jobs.map(job => ({ ...job.actual.find(q => q.approach === 'standard'), name: `${job.name} · standard` }));
  for (const stat of ['muscle', 'cunning', 'speed']) planner.push({ id: `train:${stat}`, name: `Train ${stat}`, tab: 'life', path: `/v1/train/${stat}`, body: {},
    cost: { cash: 0, nerve: 0, energy: PACING.TRAIN_ENERGY }, blockers: [...(jailed(ch) ? ['In lockup.'] : []), ...(amount(ch.energy) < PACING.TRAIN_ENERGY ? ['Insufficient energy.'] : []), ...(coolLeft(ch.train_at) ? ['Gym cooldown active.'] : [])],
    cooldown: { group: 'gym', seconds: Math.max(0, Number(process.env.TRAIN_CD_MS ?? PACING.TRAIN_CD_MS)) / 1000, readyAt: Date.now() + coolLeft(ch.train_at) * 1000 } });
  const result = { tactics: { generatedAt: new Date().toISOString(), characterId: ch.id, hypothetical, jobs, planner,
    trials: MASTERY_TRIALS,
    openingUpgrades: ASSETS.filter(asset => ['muscle', 'cunning', 'speed'].includes(asset.stat) && asset.boost > 0
      && !(h.owned.assets || []).includes(asset.id)).map(asset => {
      const fee = Math.ceil(asset.price * 0.01), tax = Math.ceil(asset.price * 0.01), total = asset.price + fee + tax;
      return { id: asset.id, name: asset.name, stat: asset.stat, boost: asset.boost,
        cost: { price: asset.price, fee, tax, total }, affordable: amount(ch.cash) >= total };
    }).sort((a, b) => a.cost.total - b.cost.total),
    loadout: { actual: h.owned.gear || [], proposed: selectedGear, actualStats, proposedStats,
      catalog: MARKET.map(g => ({ id: g.id, name: g.name, stat: g.stat, boost: g.boost, owned: (h.owned.gear || []).includes(g.id), extracted: (h.owned.gearOnchain || []).includes(g.id) })),
      note: 'All owned, in-play gear applies automatically. This bench is a hypothetical inclusion preview; it does not equip, buy, extract, or remove gear.' },
    skills: { ...previewSkillAllocation(ch, h, selectedSkills), known, selected: selectedSkills }, recovery: recoveryOptions(ch, h),
    coach: current.coach ? { ...current.coach, resources: { energy: current.energy, nerve: current.nerve, cash: current.cash, level: current.level },
      eligibility: planner.filter(p => p.tab === current.coach.tab).slice(0, 3).map(p => ({ name: p.name, blockers: p.blockers })),
      explanation: 'The city ranked this move from the current character state. Its own reason follows; the resource and eligibility checks are shown separately.' } : null,
    note: 'Read-only snapshot. Live actions recheck current state; forecasts are conditional, not promises.',
  } };
  if (query.sea === '1') result.tactics.sea = await seaComparisons(ch, client, h);
  return result;
}

export function registerTacticsRoutes(app, { pool, auth, readCharacter }) {
  app.get('/v1/ux/tactics', { preHandler: auth }, req => readCharacter(pool, req.user.sub, (ch, client, h) => tacticsBoard(ch, client, h, req.query)));
}

export async function crimeWithDecisionContext(ch, crimeId, client, h, approach) {
  const crime = CRIMES.find(entry => entry.id === crimeId);
  // Preserve the original validation/error contract for unknown actions.
  if (!crime) return doCrime(ch, crimeId, client, h, approach);
  const projection = quoteCrime(ch, h, crime, approach, await assignedSoldier(client, ch.id));
  const projectedAt = new Date().toISOString();
  const result = await doCrime(ch, crimeId, client, h, approach);
  return { ...result, decisionContext: { crimeId: crime.id, cost: { ...projection.cost },
    probability: projection.probability, modifiers: projection.modifiers,
    jailSecondsOnFailure: projection.jailSeconds, projectedAt, source: projection.formula.source,
    note: 'Projection immediately before this attempt; a failed roll does not identify one modifier as its cause.' } };
}
