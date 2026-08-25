import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONSTANTS, MASTERY, PATHS, PATH_FX, PATH_SWITCH_CD_MS, PATH_XP_HOME, PATH_XP_RIVAL } from '../src/rules.js';
import {
  PATH_IDS,
  PATH_MANIFEST,
  PATH_QUIZ_QUESTIONS,
  PATH_SELECTION_RULES,
  scorePathQuiz,
} from '../src/path-funnel.js';
import { renderPathQuizPage, renderPathResultPage } from '../src/path-pages.js';
import { buildServer } from '../src/server.js';

const EXPECTED_IDS = ['gun', 'ledger', 'kitchen', 'wheel', 'shadow', 'ring'];

assert.deepEqual(PATH_IDS, EXPECTED_IDS, 'the funnel exposes the six code-owned Paths in stable tie-break order');
assert.equal(PATH_MANIFEST.length, EXPECTED_IDS.length, 'every Path gets exactly one result manifest');
assert.equal(new Set(PATH_MANIFEST.map((path) => path.id)).size, EXPECTED_IDS.length, 'Path ids are unique');

assert.deepEqual(PATH_SELECTION_RULES, {
  unlockLevel: 5,
  firstPickCash: CONSTANTS.PATH_FIRST_COST,
  switchOmr: CONSTANTS.PATH_SWITCH_OMR,
  switchCooldownMs: PATH_SWITCH_CD_MS,
  homeMasteryMultiplier: PATH_XP_HOME,
  rivalMasteryMultiplier: PATH_XP_RIVAL,
}, 'selection terms come from the server rules instead of marketing literals');

const masteryNames = new Map(MASTERY.TRACKS.map((track) => [track.id, track.name]));
for (const path of PATH_MANIFEST) {
  const catalog = PATHS.find((entry) => entry.id === path.id);
  const fx = PATH_FX[path.id];
  assert(catalog, `${path.id} exists in the machine-owned PATHS catalog`);
  assert(fx, `${path.id} exists in the handwritten PATH_FX matrix`);
  assert.equal(path.name, catalog.name, `${path.id} uses the code-owned name`);
  assert.equal(path.catalogDescription, catalog.desc, `${path.id} preserves the exact code-owned description`);
  assert.deepEqual(path.mastery.home.map(({ id, name }) => ({ id, name })),
    fx.home.map((id) => ({ id, name: masteryNames.get(id) })), `${path.id} home mastery is exact`);
  assert.deepEqual(path.mastery.rival.map(({ id, name }) => ({ id, name })),
    fx.rival.map((id) => ({ id, name: masteryNames.get(id) })), `${path.id} rival mastery is exact`);
  assert.equal(path.mastery.homeMultiplier, PATH_XP_HOME, `${path.id} home multiplier is exact`);
  assert.equal(path.mastery.rivalMultiplier, PATH_XP_RIVAL, `${path.id} rival multiplier is exact`);
  assert.deepEqual(Object.fromEntries(path.effects.filter((effect) => effect.kind === 'multiplier').map((effect) => [effect.key, effect.value])),
    fx.fx || {}, `${path.id} represents every multiplier and invents none`);
  assert.deepEqual(Object.fromEntries(path.effects.filter((effect) => effect.kind === 'additive').map((effect) => [effect.key, effect.value])),
    fx.add || {}, `${path.id} represents every additive effect and invents none`);
  assert.equal(path.effects.filter((effect) => effect.impact === 'cost').length, 1,
    `${path.id} states its one structural handicap`);
  assert.ok(path.copy.resultTitle && path.copy.resultDeck && path.copy.shareLine,
    `${path.id} carries complete result and distribution copy`);
  assert.equal(path.links.codex, '/wiki#paths', `${path.id} links back to the complete rules`);
  assert.equal(path.links.play, '/#enter-city', `${path.id} links to the guest-play CTA`);
  assert.match(path.shareCard, new RegExp(`^/art/path-${path.id}-1200x630\\.png\\?v=[a-f0-9]{12}$`),
    `${path.id} has a content-versioned OG-card contract`);
  assert.match(path.socialCards.portrait,
    new RegExp(`^/art/path-${path.id}-1080x1350\\.png\\?v=[a-f0-9]{12}$`),
    `${path.id} has a content-versioned portrait-card contract`);
  assert.match(path.socialCards.vertical,
    new RegExp(`^/art/path-${path.id}-1080x1920\\.png\\?v=[a-f0-9]{12}$`),
    `${path.id} has a content-versioned vertical-card contract`);
}

assert.equal(PATH_QUIZ_QUESTIONS.length, 7, 'the quiz is a focused seven decisions, not an endless personality test');
assert.equal(new Set(PATH_QUIZ_QUESTIONS.map((question) => question.id)).size, PATH_QUIZ_QUESTIONS.length,
  'question ids are unique and telemetry-safe');
for (const question of PATH_QUIZ_QUESTIONS) {
  assert.equal(question.options.length, PATH_IDS.length, `${question.id} gives every Path a first-class answer`);
  assert.deepEqual([...question.options.map((option) => option.lead)].sort(), [...PATH_IDS].sort(),
    `${question.id} has one and only one lead answer per Path`);
  assert.equal(new Set(question.options.map((option) => option.id)).size, question.options.length,
    `${question.id} option ids are unique`);
  for (const option of question.options) {
    assert(option.label.length >= 18, `${question.id}/${option.id} is real decision copy, not a Path-name giveaway`);
    assert.equal(option.weights[option.lead], 3, `${question.id}/${option.id} gives its lead Path three points`);
    for (const [id, weight] of Object.entries(option.weights)) {
      assert(PATH_IDS.includes(id), `${question.id}/${option.id} cannot score unknown Path ${id}`);
      assert(Number.isInteger(weight) && weight > 0 && weight <= 3,
        `${question.id}/${option.id}/${id} uses a small positive integer weight`);
    }
  }
}

assert.deepEqual(scorePathQuiz({}), {
  answered: 0,
  complete: false,
  primary: null,
  secondary: null,
  margin: 0,
  scores: Object.fromEntries(PATH_IDS.map((id) => [id, 0])),
}, 'an empty quiz produces no fake identity');

for (const id of PATH_IDS) {
  const answers = Object.fromEntries(PATH_QUIZ_QUESTIONS.map((question) => [
    question.id,
    question.options.find((option) => option.lead === id).id,
  ]));
  const result = scorePathQuiz(answers);
  assert.equal(result.primary, id, `seven ${id}-led decisions resolve to ${id}`);
  assert.equal(result.answered, PATH_QUIZ_QUESTIONS.length, `${id} result counts all answers`);
  assert.equal(result.complete, true, `${id} result is complete`);
  assert.notEqual(result.secondary, id, `${id} result names a distinct secondary Path`);
  assert(result.scores[id] > result.scores[result.secondary], `${id} wins on published integer points`);
}

const mixed = Object.fromEntries(PATH_QUIZ_QUESTIONS.map((question, index) => [
  question.id,
  question.options.find((option) => option.lead === PATH_IDS[index % PATH_IDS.length]).id,
]));
assert.deepEqual(scorePathQuiz(mixed), scorePathQuiz({ ...mixed }), 'the same answers always produce the same result');
assert.doesNotMatch(String(scorePathQuiz), /Math\.random|Date\s*\(/, 'the scoring model has no random or time-dependent branch');
assert.throws(() => scorePathQuiz({ not_a_question: 'anything' }), /Unknown quiz question/,
  'unknown question ids fail closed instead of silently changing the sample');
assert.throws(() => scorePathQuiz({ [PATH_QUIZ_QUESTIONS[0].id]: 'not_an_option' }), /Unknown quiz option/,
  'unknown option ids fail closed instead of receiving zero points');

const origin = 'https://www.omerta.fun';
const quizPage = renderPathQuizPage({ baseUrl: origin });
assert.match(quizPage, /<title>Which OMERTÀ Path Are You\?/, 'the quiz has an indexable, human title');
assert.match(quizPage, /<form[^>]+id="path-quiz"/, 'the seven decisions use a semantic form');
assert.match(quizPage, /data-question-host/, 'the progressive question host is explicit');
assert.match(quizPage, /\/v1\/path-quiz/, 'quiz completion goes back through the shared server scorer');
assert.match(quizPage, /\/wiki#paths/, 'the quiz links to the exact mechanics before asking for a decision');
for (const question of PATH_QUIZ_QUESTIONS) {
  assert(quizPage.includes(`\"id\":\"${question.id}\"`), `quiz payload contains ${question.id}`);
  assert(quizPage.includes(question.prompt), `quiz page contains ${question.id} decision copy`);
}

for (const path of PATH_MANIFEST) {
  const html = renderPathResultPage(path.id, { baseUrl: origin });
  assert.match(html, new RegExp(`<title>${path.copy.resultTitle} \\| OMERTÀ Path</title>`),
    `${path.id} has result-specific title metadata`);
  assert(html.includes(`<meta property="og:image" content="${origin}${path.shareCard}">`),
    `${path.id} owns its absolute OG image`);
  assert(html.includes('<meta property="og:image:width" content="1200">'), `${path.id} declares OG width`);
  assert(html.includes('<meta property="og:image:height" content="630">'), `${path.id} declares OG height`);
  assert(html.includes(`<link rel="canonical" href="${origin}${path.resultUrl}">`), `${path.id} is canonical`);
  assert(html.includes(`data-path="${path.id}"`), `${path.id} exposes a stable telemetry id`);
  assert(html.includes('href="/#enter-city"'), `${path.id} reaches the one-tap guest CTA`);
  assert(html.includes('href="/wiki#paths"'), `${path.id} reaches the complete Codex rules`);
  assert(html.includes('data-share-result'), `${path.id} has a first-class share action`);
  assert(html.includes(`href="${path.socialCards.portrait}"`), `${path.id} exposes its portrait field card`);
  assert(html.includes(`href="${path.socialCards.vertical}"`), `${path.id} exposes its vertical field card`);
  assert(html.includes(`download="omerta-path-${path.id}-portrait.png"`), `${path.id} names its portrait download`);
  assert(html.includes(`download="omerta-path-${path.id}-story.png"`), `${path.id} names its story download`);
  assert(html.includes('width="1080" height="1350" loading="lazy"'), `${path.id} reserves portrait layout space`);
  assert(html.includes('width="1080" height="1920" loading="lazy"'), `${path.id} reserves story layout space`);
  for (const effect of path.effects) {
    assert(html.includes(effect.label), `${path.id} result states ${effect.key}`);
    assert(html.includes(effect.display), `${path.id} result states the exact display value for ${effect.key}`);
  }
  for (const lane of [...path.mastery.home, ...path.mastery.rival])
    assert(html.includes(lane.name), `${path.id} result states the ${lane.id} mastery lane`);
  for (const other of PATH_MANIFEST.filter((entry) => entry.id !== path.id))
    assert(html.includes(`href="${other.resultUrl}"`), `${path.id} lets a visitor compare ${other.id}`);
}
assert.equal(renderPathResultPage('not-a-path', { baseUrl: origin }), null,
  'unknown result slugs fail closed for a real 404');
for (const inheritedKey of ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty']) {
  assert.equal(renderPathResultPage(inheritedKey, { baseUrl: origin }), null,
    `prototype key ${inheritedKey} cannot resolve as a Path`);
}

const landingSource = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const codexSource = readFileSync(new URL('../public/wiki.html', import.meta.url), 'utf8');
assert.match(landingSource, /href="\/path\?source=landing"/, 'the landing Path field guide opens the quiz funnel');
assert.match(codexSource, /href="\/path\?source=wiki"/, 'the Codex Path rules open the quiz funnel');

const server = await buildServer();
try {
  const quizRoute = await server.inject({ method: 'GET', url: '/path' });
  assert.equal(quizRoute.statusCode, 200, 'the quiz is mounted as a public indexable page');
  assert.match(quizRoute.headers['content-type'], /text\/html/, 'the quiz responds as HTML');
  const gunRoute = await server.inject({ method: 'GET', url: '/path/gun' });
  assert.equal(gunRoute.statusCode, 200, 'each known Path result is mounted');
  assert.match(gunRoute.body, /YOU ARE THE GUN/, 'the Path route renders the requested server-owned dossier');
  const unknownRoute = await server.inject({ method: 'GET', url: '/path/not-a-path' });
  assert.equal(unknownRoute.statusCode, 404, 'unknown Path slugs stay a real 404');

  const start = await server.inject({
    method: 'POST', url: '/v1/path-quiz',
    payload: { event: 'start', session: 'path-test-session', source: 'direct' },
  });
  assert.deepEqual(start.json(), { ok: true }, 'anonymous funnel starts are accepted without inventing an account');

  const gunAnswers = Object.fromEntries(PATH_QUIZ_QUESTIONS.map((question) => [
    question.id, question.options.find((option) => option.lead === 'gun').id,
  ]));
  const complete = await server.inject({
    method: 'POST', url: '/v1/path-quiz',
    payload: { event: 'complete', session: 'path-test-session', source: 'quiz', answers: gunAnswers },
  });
  assert.equal(complete.statusCode, 200, 'a complete answer set reaches the shared scorer');
  assert.deepEqual(complete.json(), {
    ok: true, primary: 'gun', secondary: 'ring', url: '/path/gun?secondary=ring',
  }, 'the API exposes only stable result ids and a same-origin result URL');

  for (const payload of [
    { event: 'answer', question: 'instinct', option: 'force_the_opening', step: 1 },
    { event: 'result_view', path: 'gun', secondary: 'ring', source: 'result' },
    { event: 'cta_click', path: 'gun', cta: 'play', source: 'result' },
    { event: 'cta_click', path: 'gun', cta: 'download_portrait', source: 'result' },
    { event: 'cta_click', path: 'gun', cta: 'download_vertical', source: 'result' },
    { event: 'share', path: 'gun', channel: 'clipboard', source: 'result' },
  ]) {
    const response = await server.inject({
      method: 'POST', url: '/v1/path-quiz', payload: { ...payload, session: 'path-test-session' },
    });
    assert.deepEqual(response.json(), { ok: true }, `${payload.event} is accepted through its bounded branch`);
  }
  const telemetry = (await server.pool.query(
    "SELECT account_id, event, props FROM telemetry WHERE event LIKE 'path_%' ORDER BY at",
  )).rows;
  assert.equal(telemetry.length, 8, 'the complete funnel has one anonymous row per explicit event');
  for (const row of telemetry) {
    const props = JSON.parse(row.props);
    assert.equal(row.account_id, null, `${row.event} does not invent or infer an account`);
    assert.equal(props.session, 'path-test-session', `${row.event} joins only on the random browser session`);
    assert.equal('ip' in props || 'userAgent' in props || 'fingerprint' in props, false,
      `${row.event} stores no IP, user agent, or fingerprint`);
  }

  const incomplete = await server.inject({
    method: 'POST', url: '/v1/path-quiz',
    payload: { event: 'complete', session: 'path-test-session', answers: { instinct: 'force_the_opening' } },
  });
  assert.equal(incomplete.statusCode, 400, 'the public scorer refuses an incomplete final sample');
  assert.equal(incomplete.json().error, 'quiz_incomplete', 'incomplete samples have a stable error code');

  const badSession = await server.inject({
    method: 'POST', url: '/v1/path-quiz', payload: { event: 'start', session: '../raw-ip' },
  });
  assert.equal(badSession.statusCode, 400, 'session ids are bounded opaque values, not arbitrary analytics input');
  assert.equal(badSession.json().error, 'quiz_session', 'invalid session ids have a stable error code');

  const inventedEvent = await server.inject({
    method: 'POST', url: '/v1/path-quiz', payload: { event: 'buy_tokens', session: 'path-test-session' },
  });
  assert.equal(inventedEvent.statusCode, 400, 'the telemetry endpoint is an event allowlist, not a generic write surface');
  assert.equal(inventedEvent.json().error, 'quiz_event', 'unknown events have a stable error code');

  const inventedCta = await server.inject({
    method: 'POST', url: '/v1/path-quiz',
    payload: { event: 'cta_click', session: 'path-test-session', path: 'gun', cta: 'download_wallet' },
  });
  assert.equal(inventedCta.statusCode, 400, 'download telemetry remains a bounded CTA allowlist');
  assert.equal(inventedCta.json().error, 'quiz_cta', 'unknown CTA values have a stable error code');
} finally {
  await server.close();
}

console.log('✅ Path funnel contract passed — six complete dossiers inherit every signed rule, and seven deterministic decisions resolve all six Paths with inspectable integer scoring and stable ties');
