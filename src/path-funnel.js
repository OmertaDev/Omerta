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
    icon: 'CROSSHAIRS',
    archetype: 'THE ENFORCER',
    promise: 'Make the opening. Take the contract.',
    fit: 'You value decisive pressure, direct contests, and being the answer when diplomacy is over.',
    notFit: 'Your force costs margin: trade-good sales pay 5% less, and Commerce plus The Cook school slowly.',
    role: 'Street pressure and contract force',
    loops: ['Street fights', 'Hit contracts', 'Protection work', 'Wet Work mastery'],
    playbook: [
      'Create openings through street fights and protection work.',
      'Convert information into hit-contract efficiency.',
      'Let a Ledger or Kitchen ally handle the margins you surrender.',
    ],
    effects: [
      { key: 'jumpAtk', kind: 'multiplier', impact: 'edge', label: 'Street-fight power', display: '+10%' },
      { key: 'hitEff', kind: 'multiplier', impact: 'edge', label: 'Hit-contract effectiveness', display: '+15%' },
      { key: 'goodsSell', kind: 'multiplier', impact: 'cost', label: 'Trade-good sale value', display: '−5%' },
    ],
    copy: {
      resultTitle: 'YOU ARE THE GUN',
      resultDeck: 'The city gives you a problem and you turn it into an opening. Your best work is direct, costly, and difficult to ignore.',
      shareLine: 'I drew THE GUN: +10% street-fight power, +15% hit-contract effectiveness, and no merchant’s margin. Which OMERTÀ Path are you?',
      metaDescription: 'The Gun is OMERTÀ’s force Path: stronger street fights and hit contracts, weaker trade-good margins, with Wet Work and Protection as home masteries.',
    },
  },
  ledger: {
    accent: '#54a174',
    shareHash: '8ed287f841aa',
    icon: 'LEDGER',
    archetype: 'THE OPERATOR',
    promise: 'Turn movement into margin.',
    fit: 'You would rather own the cashflow, price the risk, and let the city work while you are elsewhere.',
    notFit: 'Soft hands cost 5% in a street fight, and Wet Work plus Protection school slowly.',
    role: 'Compounding income and market leverage',
    loops: ['Rackets and fronts', 'Trade goods', 'Black Market commerce', 'Big Scores mastery'],
    playbook: [
      'Build recurring racket and front income before chasing spectacle.',
      'Work trade-good spreads and market relationships for better exits.',
      'Buy force from allies instead of pretending the books win every fight.',
    ],
    effects: [
      { key: 'racketIncome', kind: 'multiplier', impact: 'edge', label: 'Racket income', display: '+10%' },
      { key: 'frontIncome', kind: 'multiplier', impact: 'edge', label: 'Front income', display: '+10%' },
      { key: 'goodsSell', kind: 'multiplier', impact: 'edge', label: 'Trade-good sale value', display: '+5%' },
      { key: 'jumpAtk', kind: 'multiplier', impact: 'cost', label: 'Street-fight power', display: '−5%' },
    ],
    copy: {
      resultTitle: 'YOU ARE THE LEDGER',
      resultDeck: 'You see the city as a balance sheet with grudges. Your edge compounds quietly; your weakness begins when the argument becomes physical.',
      shareLine: 'I drew THE LEDGER: +10% racket and front income, +5% trade-good sales, and soft hands in a street fight. Which OMERTÀ Path are you?',
      metaDescription: 'The Ledger is OMERTÀ’s operator Path: stronger rackets, fronts, and trade-good sales, weaker street fights, with Commerce and Big Scores as home masteries.',
    },
  },
  kitchen: {
    accent: '#d18a45',
    shareHash: '8d5a9ee075a1',
    icon: 'BURNER',
    archetype: 'THE CHEMIST',
    promise: 'Quality up. Heat down. Keep the batch moving.',
    fit: 'You like controlled production, repeatable quality, and extracting more value from a dangerous process.',
    notFit: 'The Bureau knows a cook: jail stints run 10% longer, and The Gambler plus Fisticuffs school slowly.',
    role: 'Production quality and heat control',
    loops: ['Cooking batches', 'Dealing product', 'Kitchen crews', 'Larceny mastery'],
    playbook: [
      'Use the quality edge to make each completed batch matter more.',
      'Move product with 25% less dealing heat.',
      'Plan for the longer sentence when the Bureau finally lands a case.',
    ],
    effects: [
      { key: 'dealHeat', kind: 'multiplier', impact: 'edge', label: 'Heat from dealing', display: '−25%' },
      { key: 'jailStint', kind: 'multiplier', impact: 'cost', label: 'Jail-stint duration', display: '+10%' },
      { key: 'cookQuality', kind: 'additive', impact: 'edge', label: 'Cook quality', display: '+15%' },
    ],
    copy: {
      resultTitle: 'YOU ARE THE KITCHEN',
      resultDeck: 'The city has an appetite and you prefer owning the supply. You make cleaner product under less heat, knowing the sentence is worse if the doors come off.',
      shareLine: 'I drew THE KITCHEN: +15% cook quality, 25% less dealing heat, and 10% longer jail stints. Which OMERTÀ Path are you?',
      metaDescription: 'The Kitchen is OMERTÀ’s production Path: higher cook quality and less dealing heat, longer jail stints, with The Cook and Larceny as home masteries.',
    },
  },
  wheel: {
    accent: '#4e8eb8',
    shareHash: 'c8f8115203ee',
    icon: 'ROUTE',
    archetype: 'THE COURIER',
    promise: 'Own the clock. Move before the city can answer.',
    fit: 'You see travel time, routing, and clean execution as weapons in their own right.',
    notFit: 'You have no patience for the burner: cook time runs 15% longer, and The Cook plus The Gambler school slowly.',
    role: 'Logistics, convoys, and route control',
    loops: ['Convoy running', 'Port operations', 'Vehicle work', 'Seamanship mastery'],
    playbook: [
      'Turn 10% faster convoys into more reliable logistics windows.',
      'Pair Wheels with Seamanship to own both road and water routes.',
      'Source product from a Kitchen ally instead of fighting your slow burner.',
    ],
    effects: [
      { key: 'convoyTime', kind: 'multiplier', impact: 'edge', label: 'Convoy travel time', display: '−10%' },
      { key: 'cookTime', kind: 'multiplier', impact: 'cost', label: 'Cook time', display: '+15%' },
    ],
    copy: {
      resultTitle: 'YOU ARE THE WHEEL',
      resultDeck: 'Everything moves because you do. You win through routing and tempo, but a burner feels like a prison sentence before the actual sentence begins.',
      shareLine: 'I drew THE WHEEL: convoys run 10% faster, while batches take 15% longer to cook. Which OMERTÀ Path are you?',
      metaDescription: 'The Wheel is OMERTÀ’s logistics Path: faster convoys and slower cooking, with Wheels and Seamanship as home masteries.',
    },
  },
  shadow: {
    accent: '#8b73bd',
    shareHash: 'f561a0eefa70',
    icon: 'SILHOUETTE',
    archetype: 'THE GHOST',
    promise: 'Win before the fight starts.',
    fit: 'You prefer information, timing, and unseen leverage to public contests.',
    notFit: 'You avoid the open fight: duel and bout power falls 5%, and Fisticuffs plus Commerce school slowly.',
    role: 'Search tempo, theft, and asymmetric pressure',
    loops: ['Searching marks', 'Larceny', 'Wet Work setup', 'Intel-driven play'],
    playbook: [
      'Find marks 15% sooner and act while information is still useful.',
      'Build Larceny and Wet Work through asymmetric jobs.',
      'Leave public duels to the Ring; your advantage exists before the bell.',
    ],
    effects: [
      { key: 'searchClock', kind: 'multiplier', impact: 'edge', label: 'Search-clock duration', display: '−15%' },
      { key: 'contest', kind: 'multiplier', impact: 'cost', label: 'Duel and bout power', display: '−5%' },
    ],
    copy: {
      resultTitle: 'YOU ARE THE SHADOW',
      resultDeck: 'You do not need the room to know you won. You locate the mark sooner, choose the angle, and surrender power only when someone drags you under the lights.',
      shareLine: 'I drew THE SHADOW: searches finish 15% sooner, but open duels and bouts cost 5% power. Which OMERTÀ Path are you?',
      metaDescription: 'The Shadow is OMERTÀ’s asymmetric Path: faster searches and weaker duels or bouts, with Larceny and Wet Work as home masteries.',
    },
  },
  ring: {
    accent: '#c66491',
    shareHash: '4771d4accfef',
    icon: 'BELL',
    archetype: 'THE CONTENDER',
    promise: 'Make pressure pay.',
    fit: 'You want visible contests, repeatable nerve, and a city that watches you answer the bell.',
    notFit: 'A brawler pays for damage: the Doc costs 15% more, and Seamanship plus Big Scores school slowly.',
    role: 'Duels, bouts, and pressure under lights',
    loops: ['Duels and bouts', 'Boxing', 'The tables', 'Fisticuffs mastery'],
    playbook: [
      'Use 5% more contest power wherever duels and bouts resolve.',
      'School Fisticuffs and The Gambler through public, repeatable pressure.',
      'Carry a deeper medical reserve: the Doc charges your Path 15% more.',
    ],
    effects: [
      { key: 'contest', kind: 'multiplier', impact: 'edge', label: 'Duel and bout power', display: '+5%' },
      { key: 'healCost', kind: 'multiplier', impact: 'cost', label: 'Doc cost', display: '+15%' },
    ],
    copy: {
      resultTitle: 'YOU ARE THE RING',
      resultDeck: 'You want the bell, the crowd, and the consequence. You gain power in open contests and pay for every bruise when the Doc sends the bill.',
      shareLine: 'I drew THE RING: +5% power in duels and bouts, with a 15% higher Doc bill. Which OMERTÀ Path are you?',
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
  quizQuestion('instinct', '01 / INSTINCT', 'The city puts a problem on your desk. What happens first?', [
    quizOption('force_the_opening', 'gun', 'Make the opening yourself. Hesitation belongs to the other crew.', 'ring'),
    quizOption('price_the_problem', 'ledger', 'Price the risk, find the margin, and make the problem finance its answer.', 'kitchen'),
    quizOption('control_the_process', 'kitchen', 'Control the inputs. Better process turns danger into repeatable output.', 'ledger'),
    quizOption('move_before_reply', 'wheel', 'Change the route and move before the city can organize a reply.', 'shadow'),
    quizOption('learn_then_act', 'shadow', 'Learn who is exposed, choose the angle, and act once instead of twice.', 'gun'),
    quizOption('call_for_the_bell', 'ring', 'Put it under the lights. Pressure reveals who can actually answer.', 'gun'),
  ]),
  quizQuestion('win', '02 / THE WIN', 'Which kind of victory stays with you?', [
    quizOption('decisive_end', 'gun', 'The problem ends decisively and everyone understands why it ended.', 'ring'),
    quizOption('compounding_book', 'ledger', 'The book keeps paying after the room has forgotten the deal.', 'wheel'),
    quizOption('clean_batch', 'kitchen', 'The batch lands cleaner, hotter in value, and colder on the Bureau’s board.', 'ledger'),
    quizOption('clock_owned', 'wheel', 'The shipment arrives while everybody else is still discussing the road.', 'shadow'),
    quizOption('unseen_result', 'shadow', 'The result is obvious; your part in arranging it is not.', 'ledger'),
    quizOption('public_answer', 'ring', 'You answer the bell in public and make the pressure belong to you.', 'gun'),
  ]),
  quizQuestion('shift', '03 / THE SHIFT', 'You get one uninterrupted night. Where do you spend it?', [
    quizOption('contracts_and_pressure', 'gun', 'On street pressure and contract work where force creates the next window.', 'shadow'),
    quizOption('books_and_markets', 'ledger', 'On rackets, fronts, trade routes, and every spread hiding in the books.', 'wheel'),
    quizOption('burner_and_corner', 'kitchen', 'At the burner and the corner, improving product before moving it.', 'ledger'),
    quizOption('roads_and_water', 'wheel', 'Between the road and the water, making every handoff arrive on time.', 'shadow'),
    quizOption('marks_and_angles', 'shadow', 'Finding marks, reading exposure, and choosing jobs with asymmetric odds.', 'gun'),
    quizOption('canvas_and_tables', 'ring', 'Between the canvas and the tables, wherever nerve becomes visible.', 'kitchen'),
  ]),
  quizQuestion('pressure', '04 / UNDER PRESSURE', 'The plan is turning against you. What is your recovery move?', [
    quizOption('hit_back_now', 'gun', 'Hit back hard enough to create a new decision before panic spreads.', 'ring'),
    quizOption('protect_cashflow', 'ledger', 'Protect cashflow, reprice exposure, and buy the missing capability.', 'wheel'),
    quizOption('reduce_heat', 'kitchen', 'Reduce heat, protect the process, and finish only what still clears quality.', 'shadow'),
    quizOption('reroute_fast', 'wheel', 'Reroute the operation and save the clock before saving anyone’s pride.', 'shadow'),
    quizOption('disappear_and_watch', 'shadow', 'Disappear from the obvious angle and watch who moves into the vacancy.', 'ledger'),
    quizOption('stay_in_the_round', 'ring', 'Stay in the round, absorb the pressure, and make endurance the advantage.', 'gun'),
  ]),
  quizQuestion('price', '05 / THE PRICE', 'Every edge carries a handicap. Which cost can you plan around?', [
    quizOption('merchant_margin', 'gun', 'Give up a little merchant margin if decisive force remains available.', 'shadow'),
    quizOption('soft_hands', 'ledger', 'Give up a little street-fight power if the operation compounds.', 'kitchen'),
    quizOption('longer_sentence', 'kitchen', 'Risk a longer sentence if quality rises and dealing heat falls.', 'ledger'),
    quizOption('slow_burner', 'wheel', 'Accept a slower burner if every convoy reaches its window sooner.', 'shadow'),
    quizOption('weaker_spotlight', 'shadow', 'Surrender power under the lights if the search finishes sooner.', 'wheel'),
    quizOption('doctor_bill', 'ring', 'Carry the larger medical bill if open contests break your way.', 'gun'),
  ]),
  quizQuestion('crew', '06 / YOUR SEAT', 'A crew is forming. What do they need you to own?', [
    quizOption('credible_force', 'gun', 'Credible force when a contract, target, or street argument turns real.', 'ring'),
    quizOption('capital_and_terms', 'ledger', 'Capital, terms, and the discipline to know which jobs actually pay.', 'kitchen'),
    quizOption('reliable_supply', 'kitchen', 'Reliable supply, controlled quality, and less heat on the handoff.', 'ledger'),
    quizOption('route_and_timing', 'wheel', 'The route, the timing, and the vehicles that keep the operation moving.', 'shadow'),
    quizOption('intel_and_access', 'shadow', 'Intel, access, and the angle nobody sees until the job is finished.', 'gun'),
    quizOption('nerve_and_presence', 'ring', 'Nerve, presence, and someone willing to carry pressure in public.', 'gun'),
  ]),
  quizQuestion('legacy', '07 / THE REPUTATION', 'When the city tells your story, what should the line be?', [
    quizOption('argument_ended', 'gun', 'When talking ended, this was the argument that remained.', 'ring'),
    quizOption('money_never_slept', 'ledger', 'The money never slept because this operator never stopped reading it.', 'wheel'),
    quizOption('city_was_fed', 'kitchen', 'The city had an appetite, and this was the hand that fed it.', 'ledger'),
    quizOption('everything_moved', 'wheel', 'Everything moved because this driver knew the clock and the road.', 'shadow'),
    quizOption('no_face_remembered', 'shadow', 'Nobody remembered the face, but everybody remembered the result.', 'gun'),
    quizOption('answered_every_bell', 'ring', 'Every bell was answered, and every round made the reputation harder.', 'gun'),
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
