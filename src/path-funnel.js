// The public Path funnel's single content contract. Mechanical values are inherited from rules.js;
// this file owns only interpretation, comparison language, and the noir marketing voice. Result
// pages, the quiz, share cards, and telemetry all consume these stable ids instead of restating the
// game rules in four places.
import {
  CONSTANTS,
  MASTERY,
  PATHS,
  PATH_FX,
  PATH_SWITCH_CD_MS,
  PATH_XP_HOME,
  PATH_XP_RIVAL,
} from './rules.js';

export const PATH_IDS = Object.freeze(['gun', 'ledger', 'kitchen', 'wheel', 'shadow', 'ring']);

export const PATH_SELECTION_RULES = Object.freeze({
  unlockLevel: 5,
  firstPickCash: CONSTANTS.PATH_FIRST_COST,
  switchOmr: CONSTANTS.PATH_SWITCH_OMR,
  switchCooldownMs: PATH_SWITCH_CD_MS,
  homeMasteryMultiplier: PATH_XP_HOME,
  rivalMasteryMultiplier: PATH_XP_RIVAL,
});

const CONTENT = {
  gun: {
    accent: '#c14f5b',
    shareHash: '5422339430cc',
    portraitHash: 'c67bb87c2bb4',
    verticalHash: '86096b6b05a5',
    icon: 'CROSSHAIRS',
    archetype: 'THE ENFORCER',
    promise: 'Settle it on the street.',
    fit: 'You prefer a direct fight when negotiations fail.',
    notFit: 'Trade-good sales pay 5% less. Commerce and The Cook gain mastery more slowly.',
    role: 'Street pressure and contract force',
    loops: ['Street fights', 'Hit contracts', 'Protection work', 'Wet Work mastery'],
    playbook: [
      'Create openings through street fights and protection work.',
      'Use what you learn about a target to carry out hit contracts.',
      'Let a Ledger or Kitchen ally handle trade and production.',
    ],
    effects: [
      { key: 'jumpAtk', kind: 'multiplier', impact: 'edge', label: 'Street-fight power', display: '+10%' },
      { key: 'hitEff', kind: 'multiplier', impact: 'edge', label: 'Hit-contract effectiveness', display: '+15%' },
      { key: 'goodsSell', kind: 'multiplier', impact: 'cost', label: 'Trade-good sale value', display: '−5%' },
    ],
    copy: {
      resultTitle: 'You are the Gun',
      resultDeck: 'You handle trouble directly. Street fights and hit contracts suit you, though force comes at a cost.',
      shareLine: 'My OMERTÀ Path is the Gun: +10% street-fight power, +15% hit-contract effectiveness, and 5% less from trade-good sales. Which Path suits you?',
      metaDescription: 'The Gun is OMERTÀ’s force Path: stronger street fights and hit contracts, weaker trade-good margins, with Wet Work and Protection as home masteries.',
    },
  },
  ledger: {
    accent: '#54a174',
    shareHash: '8ed287f841aa',
    portraitHash: '7477b66abac7',
    verticalHash: 'c245c51f5ff5',
    icon: 'LEDGER',
    archetype: 'THE OPERATOR',
    promise: 'Keep the business paying.',
    fit: 'You prefer steady income and deals where the risk is worth the return.',
    notFit: 'Street-fight power falls 5%. Wet Work and Protection gain mastery more slowly.',
    role: 'Income and market deals',
    loops: ['Rackets and fronts', 'Trade goods', 'Black Market commerce', 'Big Scores mastery'],
    playbook: [
      'Build recurring racket and front income.',
      'Work trade-good spreads and market relationships for better exits.',
      'Hire allies when a job calls for force.',
    ],
    effects: [
      { key: 'racketIncome', kind: 'multiplier', impact: 'edge', label: 'Racket income', display: '+10%' },
      { key: 'frontIncome', kind: 'multiplier', impact: 'edge', label: 'Front income', display: '+10%' },
      { key: 'goodsSell', kind: 'multiplier', impact: 'edge', label: 'Trade-good sale value', display: '+5%' },
      { key: 'jumpAtk', kind: 'multiplier', impact: 'cost', label: 'Street-fight power', display: '−5%' },
    ],
    copy: {
      resultTitle: 'You are the Ledger',
      resultDeck: 'You keep an eye on the books. Rackets, fronts, and trade pay better for you, but a street fight puts you at a disadvantage.',
      shareLine: 'My OMERTÀ Path is the Ledger: +10% racket and front income, +5% trade-good sales, and 5% less street-fight power. Which Path suits you?',
      metaDescription: 'The Ledger is OMERTÀ’s operator Path: stronger rackets, fronts, and trade-good sales, weaker street fights, with Commerce and Big Scores as home masteries.',
    },
  },
  kitchen: {
    accent: '#d18a45',
    shareHash: '8d5a9ee075a1',
    portraitHash: '7adb66d08f8b',
    verticalHash: '4f2a72e0ce78',
    icon: 'BURNER',
    archetype: 'THE CHEMIST',
    promise: 'Make better product with less heat.',
    fit: 'You like to control production and get more value from each batch.',
    notFit: 'Jail stints run 10% longer. The Gambler and Fisticuffs gain mastery more slowly.',
    role: 'Production quality and heat control',
    loops: ['Cooking batches', 'Dealing product', 'Kitchen crews', 'Larceny mastery'],
    playbook: [
      'Use your quality bonus to get more from each batch.',
      'Move product with 25% less dealing heat.',
      'Plan for a longer sentence if the Bureau catches you.',
    ],
    effects: [
      { key: 'dealHeat', kind: 'multiplier', impact: 'edge', label: 'Heat from dealing', display: '−25%' },
      { key: 'jailStint', kind: 'multiplier', impact: 'cost', label: 'Jail-stint duration', display: '+10%' },
      { key: 'cookQuality', kind: 'additive', impact: 'edge', label: 'Cook quality', display: '+15%' },
    ],
    copy: {
      resultTitle: 'You are the Kitchen',
      resultDeck: 'You would rather run the supply. Your product has higher quality and dealing brings less heat, but getting caught means a longer sentence.',
      shareLine: 'My OMERTÀ Path is the Kitchen: +15% cook quality, 25% less dealing heat, and 10% longer jail stints. Which Path suits you?',
      metaDescription: 'The Kitchen is OMERTÀ’s production Path: higher cook quality and less dealing heat, longer jail stints, with The Cook and Larceny as home masteries.',
    },
  },
  wheel: {
    accent: '#4e8eb8',
    shareHash: 'c8f8115203ee',
    portraitHash: '5bb30d4b0d93',
    verticalHash: '10cf9ad68b25',
    icon: 'ROUTE',
    archetype: 'THE COURIER',
    promise: 'Get the shipment there sooner.',
    fit: 'You care about routes, timing, and a job that arrives on schedule.',
    notFit: 'Cook time runs 15% longer. The Cook and The Gambler gain mastery more slowly.',
    role: 'Logistics, convoys, and route control',
    loops: ['Convoy running', 'Port operations', 'Vehicle work', 'Seamanship mastery'],
    playbook: [
      'Use faster convoys to keep deliveries on schedule.',
      'Build Wheels and Seamanship for road and water routes.',
      'Get product from a Kitchen ally to avoid your longer cook times.',
    ],
    effects: [
      { key: 'convoyTime', kind: 'multiplier', impact: 'edge', label: 'Convoy travel time', display: '−10%' },
      { key: 'cookTime', kind: 'multiplier', impact: 'cost', label: 'Cook time', display: '+15%' },
    ],
    copy: {
      resultTitle: 'You are the Wheel',
      resultDeck: 'You keep shipments moving. Convoys take less time, giving you room to work the routes. Cooking is slower work for you.',
      shareLine: 'My OMERTÀ Path is the Wheel: convoy travel takes 10% less time, while batches take 15% longer to cook. Which Path suits you?',
      metaDescription: 'The Wheel is OMERTÀ’s logistics Path: faster convoys and slower cooking, with Wheels and Seamanship as home masteries.',
    },
  },
  shadow: {
    accent: '#8b73bd',
    shareHash: 'f561a0eefa70',
    portraitHash: 'ac651b07c9d3',
    verticalHash: 'c15162f16ca4',
    icon: 'SILHOUETTE',
    archetype: 'THE GHOST',
    promise: 'Win before the fight starts.',
    fit: 'You prefer to learn about a target and choose your moment.',
    notFit: 'Duel and bout power falls 5%. Fisticuffs and Commerce gain mastery more slowly.',
    role: 'Searches, theft, and target preparation',
    loops: ['Searching marks', 'Larceny', 'Wet Work setup', 'Intel-driven play'],
    playbook: [
      'Finish searches 15% sooner and act while the information is useful.',
      'Build Larceny and Wet Work through jobs that suit your strengths.',
      'Leave public duels to a Ring ally.',
    ],
    effects: [
      { key: 'searchClock', kind: 'multiplier', impact: 'edge', label: 'Search-clock duration', display: '−15%' },
      { key: 'contest', kind: 'multiplier', impact: 'cost', label: 'Duel and bout power', display: '−5%' },
    ],
    copy: {
      resultTitle: 'You are the Shadow',
      resultDeck: 'You find the mark sooner and choose your moment to act. That preparation is your strength; open duels and bouts put you at a disadvantage.',
      shareLine: 'My OMERTÀ Path is the Shadow: searches finish 15% sooner, with 5% less power in duels and bouts. Which Path suits you?',
      metaDescription: 'The Shadow is OMERTÀ’s search and theft Path: faster searches and weaker duels or bouts, with Larceny and Wet Work as home masteries.',
    },
  },
  ring: {
    accent: '#c66491',
    shareHash: '4771d4accfef',
    portraitHash: '4411cd4ad2af',
    verticalHash: '38ef5e263065',
    icon: 'BELL',
    archetype: 'THE CONTENDER',
    promise: 'Answer the bell.',
    fit: 'You like a public contest where you can prove yourself.',
    notFit: 'The Doc costs 15% more. Seamanship and Big Scores gain mastery more slowly.',
    role: 'Duels, bouts, and gambling',
    loops: ['Duels and bouts', 'Boxing', 'The tables', 'Fisticuffs mastery'],
    playbook: [
      'Use your 5% power bonus in duels and bouts.',
      'Build Fisticuffs and The Gambler through bouts and table play.',
      'Keep extra cash for treatment. The Doc charges you 15% more.',
    ],
    effects: [
      { key: 'contest', kind: 'multiplier', impact: 'edge', label: 'Duel and bout power', display: '+5%' },
      { key: 'healCost', kind: 'multiplier', impact: 'cost', label: 'Doc cost', display: '+15%' },
    ],
    copy: {
      resultTitle: 'You are the Ring',
      resultDeck: 'You are at home in the ring. You have more power in duels and bouts, though treating the damage costs you more.',
      shareLine: 'My OMERTÀ Path is the Ring: +5% power in duels and bouts, with a 15% higher Doc bill. Which Path suits you?',
      metaDescription: 'The Ring is OMERTÀ’s contest Path: stronger duels and bouts and higher Doc costs, with Fisticuffs and The Gambler as home masteries.',
    },
  },
};

const masteryById = new Map(MASTERY.TRACKS.map((track) => [track.id, track]));

function rulesEffects(id, content) {
  const rules = PATH_FX[id];
  return content.effects.map((effect) => {
    const source = effect.kind === 'additive' ? rules.add : rules.fx;
    if (!source || !(effect.key in source)) throw new Error(`Path content ${id} names unknown ${effect.kind} effect ${effect.key}`);
    return Object.freeze({ ...effect, value: source[effect.key] });
  });
}

function masteryLanes(id) {
  const rules = PATH_FX[id];
  const lane = (ids) => ids.map((trackId) => {
    const track = masteryById.get(trackId);
    if (!track) throw new Error(`Path ${id} names unknown mastery ${trackId}`);
    return Object.freeze({ id: track.id, name: track.name, description: track.desc });
  });
  return Object.freeze({
    home: Object.freeze(lane(rules.home)),
    rival: Object.freeze(lane(rules.rival)),
    homeMultiplier: PATH_XP_HOME,
    rivalMultiplier: PATH_XP_RIVAL,
  });
}

export const PATH_MANIFEST = Object.freeze(PATH_IDS.map((id) => {
  const catalog = PATHS.find((path) => path.id === id);
  const content = CONTENT[id];
  if (!catalog || !content) throw new Error(`Incomplete Path funnel content for ${id}`);
  return Object.freeze({
    id,
    slug: id,
    name: catalog.name,
    catalogDescription: catalog.desc,
    accent: content.accent,
    icon: content.icon,
    archetype: content.archetype,
    promise: content.promise,
    fit: content.fit,
    notFit: content.notFit,
    role: content.role,
    loops: Object.freeze([...content.loops]),
    playbook: Object.freeze([...content.playbook]),
    effects: Object.freeze(rulesEffects(id, content)),
    mastery: masteryLanes(id),
    copy: Object.freeze({ ...content.copy }),
    links: Object.freeze({ codex: '/wiki#paths', play: '/#enter-city' }),
    resultUrl: `/path/${id}`,
    shareCard: `/art/path-${id}-1200x630.png?v=${content.shareHash}`,
    socialCards: Object.freeze({
      portrait: `/art/path-${id}-1080x1350.png?v=${content.portraitHash}`,
      vertical: `/art/path-${id}-1080x1920.png?v=${content.verticalHash}`,
    }),
  });
}));

export const PATH_BY_ID = Object.freeze(Object.fromEntries(PATH_MANIFEST.map((path) => [path.id, path])));

const quizOption = (id, lead, label, support) => Object.freeze({
  id,
  lead,
  label,
  weights: Object.freeze({ [lead]: 3, ...(support ? { [support]: 1 } : {}) }),
});

const quizQuestion = (id, eyebrow, prompt, options) => Object.freeze({
  id,
  eyebrow,
  prompt,
  options: Object.freeze(options),
});

// Every question has one lead answer for every Path. The smaller cross-Path point captures a real
// adjacent instinct without allowing a secondary association to overpower the answer selected.
export const PATH_QUIZ_QUESTIONS = Object.freeze([
  quizQuestion('instinct', '01 / INSTINCT', 'There is trouble in the city. What do you do first?', [
    quizOption('force_the_opening', 'gun', 'Force an opening before the other crew acts.', 'ring'),
    quizOption('price_the_problem', 'ledger', 'Work out the risk and find a way to profit.', 'kitchen'),
    quizOption('control_the_process', 'kitchen', 'Get the process under control so the work can continue.', 'ledger'),
    quizOption('move_before_reply', 'wheel', 'Change the route and move before anyone can stop you.', 'shadow'),
    quizOption('learn_then_act', 'shadow', 'Find out who is exposed before choosing a target.', 'gun'),
    quizOption('call_for_the_bell', 'ring', 'Call for a public contest and see who can hold their nerve.', 'gun'),
  ]),
  quizQuestion('win', '02 / THE WIN', 'Which kind of victory stays with you?', [
    quizOption('decisive_end', 'gun', 'You settle the problem and make sure the other crew understands.', 'ring'),
    quizOption('compounding_book', 'ledger', 'A deal keeps paying long after you made it.', 'wheel'),
    quizOption('clean_batch', 'kitchen', 'A better batch brings more value and less attention from the Bureau.', 'ledger'),
    quizOption('clock_owned', 'wheel', 'Your shipment arrives before the others have planned their route.', 'shadow'),
    quizOption('unseen_result', 'shadow', 'The result is obvious; your part in arranging it is not.', 'ledger'),
    quizOption('public_answer', 'ring', 'You win in front of a crowd after a difficult round.', 'gun'),
  ]),
  quizQuestion('shift', '03 / THE SHIFT', 'You get one uninterrupted night. Where do you spend it?', [
    quizOption('contracts_and_pressure', 'gun', 'Working the streets and taking hit contracts.', 'shadow'),
    quizOption('books_and_markets', 'ledger', 'Checking the rackets and fronts, then looking for profitable trades.', 'wheel'),
    quizOption('burner_and_corner', 'kitchen', 'At the burner and the corner, improving product before moving it.', 'ledger'),
    quizOption('roads_and_water', 'wheel', 'Between the road and the water, making every handoff arrive on time.', 'shadow'),
    quizOption('marks_and_angles', 'shadow', 'Finding marks and choosing jobs where the odds favor you.', 'gun'),
    quizOption('canvas_and_tables', 'ring', 'In the ring or at the tables, testing your nerve.', 'kitchen'),
  ]),
  quizQuestion('pressure', '04 / UNDER PRESSURE', 'The plan is turning against you. What is your recovery move?', [
    quizOption('hit_back_now', 'gun', 'Hit back before the crew starts to panic.', 'ring'),
    quizOption('protect_cashflow', 'ledger', 'Protect the income and pay for the help you need.', 'wheel'),
    quizOption('reduce_heat', 'kitchen', 'Reduce heat and keep only the work you can finish well.', 'shadow'),
    quizOption('reroute_fast', 'wheel', 'Reroute the job while there is still time.', 'shadow'),
    quizOption('disappear_and_watch', 'shadow', 'Step out of sight and watch who makes the next move.', 'ledger'),
    quizOption('stay_in_the_round', 'ring', 'Stay in the round and outlast the pressure.', 'gun'),
  ]),
  quizQuestion('price', '05 / THE PRICE', 'Which disadvantage could you work around?', [
    quizOption('merchant_margin', 'gun', 'Earn less from trade if it means more power on the street.', 'shadow'),
    quizOption('soft_hands', 'ledger', 'Lose some street-fight power for better business income.', 'kitchen'),
    quizOption('longer_sentence', 'kitchen', 'Risk a longer sentence if quality rises and dealing heat falls.', 'ledger'),
    quizOption('slow_burner', 'wheel', 'Cook more slowly if convoys arrive sooner.', 'shadow'),
    quizOption('weaker_spotlight', 'shadow', 'Lose power in duels and bouts for faster searches.', 'wheel'),
    quizOption('doctor_bill', 'ring', 'Pay more for treatment in return for stronger duels and bouts.', 'gun'),
  ]),
  quizQuestion('crew', '06 / YOUR SEAT', 'A crew is forming. What would they count on you for?', [
    quizOption('credible_force', 'gun', 'Force when a contract or a street dispute turns violent.', 'ring'),
    quizOption('capital_and_terms', 'ledger', 'Funding the work and knowing which jobs will pay.', 'kitchen'),
    quizOption('reliable_supply', 'kitchen', 'Good product and reliable supply with less heat.', 'ledger'),
    quizOption('route_and_timing', 'wheel', 'The vehicles and routes that keep deliveries on time.', 'shadow'),
    quizOption('intel_and_access', 'shadow', 'Information and a way into the job.', 'gun'),
    quizOption('nerve_and_presence', 'ring', 'Someone who holds their nerve in a public contest.', 'gun'),
  ]),
  quizQuestion('legacy', '07 / THE REPUTATION', 'What would you like the city to remember about you?', [
    quizOption('argument_ended', 'gun', 'You settled the fights that talking could not.', 'ring'),
    quizOption('money_never_slept', 'ledger', 'You knew how to keep a business paying.', 'wheel'),
    quizOption('city_was_fed', 'kitchen', 'You kept the city supplied.', 'ledger'),
    quizOption('everything_moved', 'wheel', 'You knew the roads and always found time to deliver.', 'shadow'),
    quizOption('no_face_remembered', 'shadow', 'People remembered your work without knowing your face.', 'gun'),
    quizOption('answered_every_bell', 'ring', 'You answered every bell and earned your reputation in the ring.', 'gun'),
  ]),
]);

const QUESTION_BY_ID = new Map(PATH_QUIZ_QUESTIONS.map((question) => [question.id, question]));

/**
 * Deterministic, auditable Path scoring. Ties use PATH_IDS order, which is exported and tested so a
 * copy edit or object-key reorder cannot change a result. Partial answers are supported for the UI's
 * progress state, but only a seven-answer result is marked complete.
 */
export function scorePathQuiz(answers = {}) {
  const input = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  for (const id of Object.keys(input)) {
    if (!QUESTION_BY_ID.has(id)) throw new Error(`Unknown quiz question: ${id}`);
  }

  const scores = Object.fromEntries(PATH_IDS.map((id) => [id, 0]));
  let answered = 0;
  for (const question of PATH_QUIZ_QUESTIONS) {
    const answerId = input[question.id];
    if (answerId === undefined || answerId === null || answerId === '') continue;
    const option = question.options.find((entry) => entry.id === answerId);
    if (!option) throw new Error(`Unknown quiz option for ${question.id}: ${answerId}`);
    answered++;
    for (const [id, points] of Object.entries(option.weights)) scores[id] += points;
  }

  if (!answered) return {
    answered: 0,
    complete: false,
    primary: null,
    secondary: null,
    margin: 0,
    scores,
  };

  const ranked = PATH_IDS.map((id, order) => ({ id, order, score: scores[id] }))
    .sort((a, b) => b.score - a.score || a.order - b.order);
  return {
    answered,
    complete: answered === PATH_QUIZ_QUESTIONS.length,
    primary: ranked[0].id,
    secondary: ranked[1].id,
    margin: ranked[0].score - ranked[1].score,
    scores,
  };
}
