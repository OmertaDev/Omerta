import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CRIMES, M3, MARKET, ASSETS, CONSUMABLES, SKILLS, PORT, NOTORIETY, interdictChance, PACING, effStat } from '../src/rules.js';
import { quoteCrime, tacticsBoard, previewSkillAllocation, recoveryOptions, registerTacticsRoutes, crimeWithDecisionContext, seaComparisons, MASTERY_TRIALS } from '../src/ux-tactics.js';
import { doCrime } from '../src/game.js';
import { itemEffectPreview, useItem, buyAsset } from '../src/economy.js';
import { collectRun } from '../src/port.js';

process.env.CLUE_DROP_P = '0';
const character = () => ({ id: 'tactics-character', account_id: 'tactics-account', name: 'Decision Reader', generation: 1,
  respect: 1960, muscle: 10, cunning: 8, speed: 7, cash: 500000, bank: 0, health: 72.5, energy: 40, nerve: 40,
  heat: 12, lc_crime: 0, trade_rep: 0, cb: 0, loc: 'docks', path: 'kitchen', last_accrued_at: new Date(),
  train_at: null, heist_at: null, street_action_at: null, hosp_until: null, jail_until: null });
const handle = () => ({ acct: { prestige: 0, omr: 0, staked: 0, unbonding: 0, kills: 0, smuggled: 0 },
  owned: { assets: [], gear: ['lockpick', 'blade'], gearOnchain: [], skills: new Set(['pack_mule', 'getaway']), npc: {}, disciplines: {},
    mastery: { larceny: 0 }, makings: {}, items: { espresso: 2, flaskitem: 1, getaway: 1 }, held: ['brick', 'canal'], deedPerk: ['brick'],
    gang: { treasury: 120000 }, gangRole: 'capo', rackets: [], stash: [], cargo: {}, guns: [], cars: [] },
  ledger: async () => {}, rngLog: async () => {}, track: async () => {}, bumpDaily: async () => {}, notify: async () => {} });
const actionClient = { async query(sql) {
  if (/^\s*select/i.test(sql)) return { rows: [], rowCount: 0 };
  return { rows: [], rowCount: 1 };
} };
const originalRandom = Math.random;
try {
  const crime = CRIMES.find(c => c.lvl <= 15 && c.jail > 0);
  assert(crime);
  for (const path of [null, 'kitchen', 'gun']) for (const approach of Object.keys(M3.CRIME_APPROACHES)) {
    const ch = character(); ch.path = path;
    const h = handle(), quote = quoteCrime(ch, h, crime, approach);
    for (const success of [true, false]) {
      let call = 0;
      const roll = quote.probability + (success ? -1e-9 : 1e-9);
      Math.random = () => call++ === 0 ? Math.max(0, roll) : 0.5;
      const result = await doCrime(structuredClone(ch), crime.id, actionClient, { ...h, acct: structuredClone(h.acct), owned: structuredClone(h.owned) }, approach);
      assert.equal(result.success, success, `${path}/${approach}: quote matches actual doCrime at each side of the success threshold`);
      if (success) assert(result.take >= quote.cashRange.min && result.take <= quote.cashRange.upperBound);
      else assert.equal(result.jailSeconds, quote.jailSeconds, `${path}/${approach}: jail projection matches actual failure`);
    }
  }
  Math.random = originalRandom;
  const baseline = quoteCrime(character(), handle(), crime, 'standard');
  const without = handle(); without.owned.gear = [];
  assert(baseline.probability > quoteCrime(character(), without, crime, 'standard').probability, 'Actual gear changes the quote through the existing effective-stat helper.');
  const overlappingTurf = handle(); overlappingTurf.owned.deedPerk = [];
  assert.equal(baseline.probability, quoteCrime(character(), overlappingTurf, crime, 'standard').probability, 'Family and controlled-corner turf never double-count the same perk.');
  const blocked = character(); blocked.nerve = 0; blocked.jail_until = new Date(Date.now() + 30000);
  blocked.street_action_at = new Date(Date.now() + PACING.STREET_ACTION_CD_MS);
  const blockedQuote = quoteCrime(blocked, handle(), crime, 'quiet');
  assert.equal(blockedQuote.blockers.length, 3);
  assert(blockedQuote.blockers.some(text => /street clock/i.test(text)), 'the live shared street blocker is visible');
  assert.equal(baseline.cooldown.group, 'street');
  assert.equal(baseline.cooldown.seconds, PACING.STREET_ACTION_CD_MS / 1000,
    'crime planning uses the same shared cooldown duration as the mutation');
  const invalidBuild = previewSkillAllocation(character(), handle(), ['getaway', 'made_man']);
  assert(invalidBuild.conflicts.some(c => c.includes('requires')));
  assert(invalidBuild.conflicts.some(c => c.includes('point')));
  assert.equal(previewSkillAllocation(character(), handle(), ['pack_mule', 'getaway']).conflicts.length, 0);

  // Every owned consumable uses the exact same pure helper as its mutation, including
  // fractional pools, near caps, the legacy use caps, heat clamps and lockup clearing.
  for (const item of CONSUMABLES) for (const pools of [{ energy: 1.25, nerve: 1.75, health: 9.5, heat: 7 }, { energy: 500, nerve: 100, health: 99.75, heat: 100 }]) {
    const ch = { ...character(), ...pools, jail_until: new Date(Date.now() + 120000) }, h = handle();
    h.owned.items = { [item.id]: 2 };
    const before = structuredClone(ch), ownedBefore = structuredClone(h.owned);
    const preview = itemEffectPreview(ch, item.id, h.owned);
    assert.deepEqual(ch, before, 'A preview never mutates the character.');
    assert.deepEqual(h.owned, ownedBefore, 'A preview never consumes an item.');
    const live = structuredClone(ch), liveHandle = { ...h, owned: structuredClone(h.owned) };
    const result = await useItem(live, item.id, actionClient, liveHandle);
    for (const field of Object.keys(preview.next)) assert.deepEqual(live[field], preview.next[field], `${item.id} ${field}: preview equals actual use`);
    assert.equal(liveHandle.owned.items[item.id], 1);
    assert.equal(result.effect, preview.effect);
  }
  assert.throws(() => itemEffectPreview(character(), 'missing', handle().owned), error => error.code === 'bad_item');
  assert.throws(() => itemEffectPreview(character(), 'benz', handle().owned), error => error.code === 'none');
  const recoveryCharacter = character(), recoveryHandle = handle();
  const beforeRecovery = structuredClone(recoveryCharacter), beforeHandle = structuredClone(recoveryHandle.owned);
  const recovery = recoveryOptions(recoveryCharacter, recoveryHandle);
  assert(recovery.rates.energy > 0 && recovery.rates.nerve > 0 && recovery.rates.health > 0);
  assert(recovery.options.find(o => o.id === 'doc').cost.startsWith('$'));
  assert(recovery.options.find(o => o.id === 'item-espresso').preview);
  assert.deepEqual(recoveryCharacter, beforeRecovery);
  assert.deepEqual(recoveryHandle.owned, beforeHandle);

  const queries = [], readonlyClient = { async query(sql) {
    queries.push(sql);
    assert(!/\b(insert|update|delete|truncate)\b/i.test(sql), 'Projection code must never write or take a mutation lock.');
    return { rows: [], rowCount: 0 };
  } };
  const projectedCharacter = character(), projectedHandle = handle();
  const beforeCharacter = structuredClone(projectedCharacter), beforeOwned = structuredClone(projectedHandle.owned);
  const result = await tacticsBoard(projectedCharacter, readonlyClient, projectedHandle, { gear: 'lockpick', skills: 'pack_mule,getaway' });
  assert.equal(result.tactics.jobs.length, CRIMES.length);
  assert.deepEqual(result.tactics.trials, MASTERY_TRIALS, 'Practice rules arrive through the authenticated read-only board.');
  assert(result.tactics.openingUpgrades.length > 0);
  for (const upgrade of result.tactics.openingUpgrades) {
    const asset = ASSETS.find(asset => asset.id === upgrade.id), ch = character(), h = handle();
    ch.cash = upgrade.cost.total;
    const before = effStat(ch[upgrade.stat], upgrade.stat, h.owned.assets, h.owned.gear);
    const bought = await buyAsset(ch, asset.id, actionClient, h);
    assert.equal(bought.spent, upgrade.cost.total, 'An opening-upgrade quote includes the exact price, fee and tax charged by buyAsset.');
    assert.equal(ch.cash, 0); assert(h.owned.assets.includes(asset.id));
    assert(effStat(ch[upgrade.stat], upgrade.stat, h.owned.assets, h.owned.gear) > before,
      'Every suggested opening purchase improves its named effective capability.');
    assert.equal(upgrade.affordable, projectedCharacter.cash >= upgrade.cost.total);
  }
  const alreadyOwned = handle(); alreadyOwned.owned.assets = [result.tactics.openingUpgrades[0].id];
  assert(!(await tacticsBoard(character(), readonlyClient, alreadyOwned)).tactics.openingUpgrades
    .some(upgrade => alreadyOwned.owned.assets.includes(upgrade.id)), 'Owned upgrades are excluded from the opening loop.');
  assert.equal(result.tactics.jobs[0].actual.length, 3);
  const finite = (value) => { if (typeof value === 'number') assert(Number.isFinite(value), 'Every numeric projection field must be finite.'); else if (value && typeof value === 'object') Object.values(value).forEach(finite); };
  finite(result);
  for (const job of result.tactics.jobs) for (const quote of [...job.actual, ...job.proposed]) {
    assert.equal(quote.cooldown.group, 'street');
    assert.equal(quote.cooldown.seconds, PACING.STREET_ACTION_CD_MS / 1000);
  }
  assert.equal(result.tactics.loadout.proposedStats.speed - result.tactics.loadout.actualStats.speed, -MARKET.find(g => g.id === 'blade').boost);
  assert.equal(result.tactics.skills.hypothetical, true);
  assert.deepEqual(projectedCharacter, beforeCharacter); assert.deepEqual(projectedHandle.owned, beforeOwned);
  assert(queries.every(sql => /^\s*SELECT/i.test(sql)));
  await assert.rejects(tacticsBoard(character(), readonlyClient, handle(), { gear: 'not-a-catalog-id' }), error => error.code === 'preview');

  const nowForSea = Date.now(), realNow = Date.now;
  const ownBoat = { id: 'working-boat', character_id: 'tactics-character', kind: 'dinghy', rarity: 'common', hull: 0, engine: 0, run_until: null };
  const seaReadClient = { async query(sql) {
    assert(!/\b(insert|update|delete|truncate)\b/i.test(sql));
    if (sql.includes('SELECT * FROM boats WHERE character_id=')) return { rows: [ownBoat, { ...ownBoat, id: 'extracted-boat', minted_onchain: true }], rowCount: 2 };
    return { rows: [], rowCount: 0 };
  } };
  Date.now = () => nowForSea;
  try {
    const sea = await seaComparisons(character(), seaReadClient, handle());
    assert.equal(sea.quotes.length, PORT.ROUTES.length * 2);
    assert(sea.quotes.every(q => q.boatId === ownBoat.id), 'Extracted boats never appear as working tactical options.');
    const unescorted = sea.quotes.find(q => q.routeId === PORT.ROUTES[0].id && !q.escorted);
    const escorted = sea.quotes.find(q => q.routeId === PORT.ROUTES[0].id && q.escorted);
    assert.equal(escorted.totalCost - unescorted.totalCost, PORT.ESCORT_COST);
    assert(escorted.interceptionProbability <= unescorted.interceptionProbability);
    assert.equal(escorted.cleanMargin, escorted.proceeds - escorted.totalCost - escorted.toll);
    for (const quote of [unescorted, escorted]) for (const interdicted of [true, false]) {
      const boat = { ...ownBoat, run_until: new Date(nowForSea - 1000), run_route: quote.routeId, run_hold: quote.hold, run_cost: quote.cost, run_escort: quote.escorted };
      const collectionClient = { async query(sql) {
        if (sql.includes('SELECT * FROM boats WHERE id=')) return { rows: [boat], rowCount: 1 };
        if (sql.includes('SELECT notoriety, noted_at FROM route_notoriety')) return { rows: [{ notoriety: NOTORIETY.GAIN, noted_at: new Date(nowForSea) }], rowCount: 1 };
        if (/^\s*select/i.test(sql)) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 1 };
      } };
      let rolls = 0; Math.random = () => rolls++ === 0 ? quote.interceptionProbability + (interdicted ? -1e-9 : 1e-9) : 0.99;
      const collected = await collectRun(character(), boat.id, false, collectionClient, handle());
      assert.equal(collected.interdicted, interdicted, 'Sea quote matches actual collection at each side of the roll threshold under its stated conditions.');
      if (!interdicted) assert.equal(collected.net, quote.cleanMargin);
    }
  } finally { Date.now = realNow; Math.random = originalRandom; }

  let registered;
  registerTacticsRoutes({ get(path, options, handler) { registered = { path, options, handler }; } }, {
    pool: 'pool', auth: 'authenticated', readCharacter: async (...args) => args.slice(0, 2),
  });
  assert.equal(registered.path, '/v1/ux/tactics'); assert.equal(registered.options.preHandler, 'authenticated');
  assert.deepEqual(await registered.handler({ user: { sub: 'only-current-account' }, query: {} }), ['pool', 'only-current-account']);

  const context = vm.createContext({ window: {}, Date });
  vm.runInContext(readFileSync(new URL('../public/ux-tactics.js', import.meta.url), 'utf8'), context);
  const { evaluateFormula, analyzePlan, advanceTrial, normalizeTrials, trialProgress } = context.window.createOmertaTactics;
  assert.equal(evaluateFormula(baseline.formula.expression, baseline.formula.inputs), baseline.threshold, 'The interactive explorer evaluates exactly the server-published AST.');
  const now = Date.now(), move = { id: 'a', cost: { energy: 0, nerve: 5 }, blockers: [], cooldown: { group: 'gym', seconds: 30, readyAt: now } };
  const analysis = analyzePlan([{ id: 'a', wait: 0 }, { id: 'a', wait: 0 }], [move], { energy: 10, nerve: 7, cash: 0 }, now);
  assert(analysis[1].conflicts.some(text => text.startsWith('nerve:')));
  assert(analysis[1].conflicts.some(text => text.startsWith('gym clock')));
  assert.equal(analyzePlan([{ id: 'a', wait: 0 }, { id: 'a', wait: 30 }], [move], { energy: 10, nerve: 10, cash: 0 }, now)[1].conflicts.length, 0);
  assert.equal(analyzePlan([{ id: 'removed', wait: 0 }], [], {}, now)[0].conflicts.length, 1);
  const repeatedCrime = analyzePlan([{ id: baseline.id, wait: 0 }, { id: baseline.id, wait: 0 }], [baseline], { energy: 100, nerve: 100, cash: 10000 }, now);
  assert.equal(repeatedCrime[0].conflicts.length, 0);
  assert(repeatedCrime[1].conflicts.some(text => text.startsWith('street clock')),
    'the planner refuses an impossible back-to-back crime on the shared street clock');
  assert.equal(analyzePlan([{ id: baseline.id, wait: 0 }, { id: baseline.id, wait: PACING.STREET_ACTION_CD_MS / 1000 }],
    [baseline], { energy: 100, nerve: 100, cash: 10000 }, now)[1].conflicts.length, 0,
  'waiting out the shared street cooldown makes the second crime schedulable');
  assert(interdictChance(PORT.ROUTES[0], { speed: 0 }, true, 15) <= interdictChance(PORT.ROUTES[0], { speed: 0 }, false, 15));
  let calls = 0; Math.random = () => calls++ === 0 ? 0.99999 : 0.5;
  const contextual = await crimeWithDecisionContext(character(), crime.id, actionClient, handle(), 'standard');
  assert.equal(contextual.success, false); assert.equal(contextual.decisionContext.probability, baseline.probability);
  assert.equal(contextual.decisionContext.crimeId, crime.id);
  assert.deepEqual(contextual.decisionContext.cost, baseline.cost, 'Practice observes the actual pre-action listed costs, including unsuccessful jobs.');
  assert(contextual.decisionContext.modifiers.some(m => m.label === 'Path'));

  const actor = 'practice-character:1', account = 'practice-account', startedAt = Date.now();
  const freshRun = () => ({ actor, startedAt, status: 'active', successes: 0, attempts: 0, nerveSpent: 0,
    approaches: [], jobs: [], seen: [], last: '' });
  const snapshot = { identity: actor, accountId: account };
  const trialOf = id => MASTERY_TRIALS.find(trial => trial.id === id);
  let receiptSequence = 0;
  const observation = (run, trial, override = {}) => {
    const id = override.job || 'pickpocket';
    const receipt = { actor, method: 'POST', path: '/v1/crimes/' + id, feedbackId: 'practice-' + ++receiptSequence,
      feedbackState: 'confirmed', ...override.receipt };
    const result = { code: 200, body: { ok: true, success: true, approach: override.approach || 'standard',
      decisionContext: { crimeId: id, cost: { nerve: override.nerve ?? 6 }, probability: override.probability ?? 0.9,
        projectedAt: new Date(startedAt + 1).toISOString(), ...override.context }, ...override.body }, ...override.result };
    return advanceTrial(run, trial, receipt, override.before || snapshot, override.after || snapshot, result, actor, account);
  };
  const light = trialOf('light-touch');
  let run = observation(freshRun(), light, { receipt: { feedbackId: 'stable-retry' } });
  assert.equal(run.status, 'active'); assert.equal(run.successes, 1); assert.equal(run.nerveSpent, 6);
  assert.equal(observation(run, light, { receipt: { feedbackId: 'stable-retry' } }), run, 'An idempotent replay cannot count twice.');
  run = observation(run, light);
  assert.equal(run.status, 'complete'); assert.equal(trialProgress(run, light), 2); assert.equal(run.nerveSpent, 12);
  assert.equal(observation(run, light), run, 'A completed personal stamp is stable until deliberately reset.');
  run = observation(freshRun(), light, { nerve: 10, body: { success: false } });
  run = observation(run, light, { nerve: 3 });
  assert.equal(run.status, 'over-budget'); assert.equal(run.attempts, 2); assert.equal(run.successes, 1);
  assert.equal(run.nerveSpent, 13, 'Failed rolls still consume the listed practice budget.');
  for (const override of [
    { receipt: { actor: 'practice-character:2' } }, { before: { ...snapshot, identity: 'practice-character:2' } },
    { after: { ...snapshot, identity: 'practice-character:2' } }, { before: { ...snapshot, accountId: 'foreign' } },
    { after: { ...snapshot, accountId: 'foreign' } }, { receipt: { isCurrent: () => false } },
    { receipt: { feedbackState: 'unknown' } }, { receipt: { feedbackId: null } }, { receipt: { method: 'GET' } },
    { result: { code: 400 } }, { result: { code: 499 } }, { body: { success: undefined } },
    { context: { probability: NaN } }, { context: { cost: { nerve: -1 } } },
    { context: { crimeId: 'different-job' } }, { context: { projectedAt: new Date(startedAt - 1).toISOString() } },
    { body: { decisionContext: null } },
  ]) {
    const unchanged = freshRun();
    assert.equal(observation(unchanged, light, override), unchanged, 'Unknown, stale, refused, mismatched and pre-start observations cannot advance practice.');
  }
  const ways = trialOf('three-approaches');
  run = freshRun();
  for (const approach of ['quiet', 'quiet', 'standard', 'loud']) run = observation(run, ways, { approach });
  assert.equal(run.status, 'complete'); assert.equal(trialProgress(run, ways), 3);
  const measured = trialOf('measured-risk');
  run = observation(freshRun(), measured, { probability: 0.84 });
  assert.equal(trialProgress(run, measured), 0);
  run = observation(run, measured, { job: 'first', probability: 0.85 });
  run = observation(run, measured, { job: 'first', probability: 0.99 });
  assert.equal(trialProgress(run, measured), 1, 'Repeated easy jobs do not satisfy distinct-job mastery.');
  run = observation(run, measured, { job: 'second', probability: 0.9 });
  assert.equal(run.status, 'complete');
  assert.equal(Object.keys(normalizeTrials({ 'measured-risk': run }, 'practice-character:2')).length, 0,
    'Saved practice never transfers to another character or generation.');
  assert.equal(normalizeTrials({ unknown: run, 'measured-risk': run }, actor)['measured-risk'].status, 'complete');
  console.log('Tactics projections passed: actual crime threshold/jail/payout parity, exact item-use parity without preview writes, loadouts, budgets, prerequisites, formula AST, planner conflicts, authenticated current-account registration, and pre-action setback context.');
} finally { Math.random = originalRandom; }
