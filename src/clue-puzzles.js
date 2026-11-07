// Structured trails are opt-in by salt version. Existing scrolls retain their exact
// derivation and dig interaction; no reward, timing, drop, or cooldown rule changes.
import crypto from 'node:crypto';
import { CLUES, clueStepOf } from './rules.js';

const PREFIX = 'trail-v2:';
const KINDS = ['surveillance', 'route', 'landmark', 'witness'];
const PEOPLE = ['The Lookout', 'The Messenger', 'The Clerk'];
const MARKS = {
  docks: ['The Rope Shed', 'The North Gantry', 'The Weighbridge'],
  canal: ['The Toll Arch', 'The Towpath Gate', 'The Lock House'],
  brick: ['The Clay Store', 'The Kiln Door', 'The Loading Yard'],
  neon: ['The Stage Door', 'The Tram Shelter', 'The Ticket Booth'],
  cathedral: ['The Bell Gate', 'The Choir Door', 'The Stone Stair'],
  foundry: ['The Slag Ramp', 'The Furnace Gate', 'The Pattern Store'],
};
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');
const number = (seed, count) => parseInt(hash(seed).slice(0, 8), 16) % count;
const shuffled = (items, seed) => [...items].map((value, index) => ({ value, sort: hash(`${seed}:${index}`) }))
  .sort((a, b) => a.sort.localeCompare(b.sort)).map((entry) => entry.value);

export const newClueSalt = () => PREFIX + crypto.randomUUID();
export const isStructuredClueSalt = (salt) => typeof salt === 'string' && salt.startsWith(PREFIX);

function choicesFor(seed, labels, correctLabel) {
  const choices = shuffled(labels.map((label, index) => ({ id: hash(`${seed}:choice:${index}`).slice(0, 20), label })), `${seed}:order`);
  return { choices, answerId: choices.find((choice) => choice.label === correctLabel).id };
}

export function cluePuzzleOf(salt, step) {
  const base = clueStepOf(salt, step);
  if (!isStructuredClueSalt(salt)) return base;
  const seed = `${salt}:${step}`;
  // Rotate instead of independently rolling: any four-step trail encounters all
  // four mechanics, without turning old stored salts into different puzzles.
  const kind = KINDS[(number(`${salt}:kind-offset`, KINDS.length) + step - 1) % KINDS.length];
  const people = shuffled(PEOPLE, `${seed}:people`);
  let prompt, hint, observations, choices, answerId;
  if (kind === 'surveillance') {
    const hour = 8 + number(`${seed}:hour`, 13);
    const time = (minute) => `${String(hour).padStart(2, '0')}:${minute}`;
    prompt = `The exchange lasted from ${time('20')} to ${time('30')}. Who was present for the entire exchange?`;
    observations = shuffled([
      `${people[0]} arrived at ${time('10')} and left at ${time('40')}.`,
      `${people[1]} arrived at ${time('00')} and left at ${time('15')}.`,
      `${people[2]} arrived at ${time('35')} and left at ${time('55')}.`,
    ], `${seed}:observations`);
    ({ choices, answerId } = choicesFor(seed, people, people[0]));
    hint = 'A useful witness must have arrived before the exchange began and left after it ended.';
  } else if (kind === 'route') {
    const route = shuffled(['the warehouse', 'the bridge', 'the tram depot'], `${seed}:route`);
    const line = (items) => items.join(' → ');
    prompt = 'Reconstruct the courier’s route from the order of the receipts.';
    observations = shuffled([
      `The receipt from ${route[0]} was issued before the receipt from ${route[1]}.`,
      `The receipt from ${route[1]} was issued before the receipt from ${route[2]}.`,
    ], `${seed}:observations`);
    const correct = line(route);
    ({ choices, answerId } = choicesFor(seed, [correct, line([route[1], route[0], route[2]]), line([...route].reverse())], correct));
    hint = 'Find the stop that precedes both others, then follow the remaining before-and-after statement.';
  } else if (kind === 'landmark') {
    const names = shuffled(MARKS[base.district], `${seed}:marks`);
    const colors = shuffled(['blue', 'red', 'green'], `${seed}:colors`);
    const symbols = shuffled(['anchor', 'bell', 'wheel'], `${seed}:symbols`);
    const correct = `${names[0]} — ${colors[0]} paint, ${symbols[0]} mark`;
    prompt = 'Which landmark matches both details in the survey sketch?';
    observations = [`The sketch records ${colors[0]} paint and a ${symbols[0]} mark. Both details must match.`];
    ({ choices, answerId } = choicesFor(seed, [correct,
      `${names[1]} — ${colors[1]} paint, ${symbols[0]} mark`,
      `${names[2]} — ${colors[0]} paint, ${symbols[1]} mark`], correct));
    hint = 'One landmark shares only the color and another shares only the mark. You need both.';
  } else {
    prompt = 'Exactly one of these three statements is true. Only these three people could have carried the envelope. Who carried it?';
    observations = shuffled([
      `${people[0]} says: “${people[0]} carried the envelope.”`,
      `${people[1]} says: “${people[0]} carried the envelope.”`,
      `${people[2]} says: “${people[1]} carried the envelope.”`,
    ], `${seed}:observations`);
    ({ choices, answerId } = choicesFor(seed, people, people[1]));
    hint = 'Try each possible carrier and count true statements. Only one possibility makes exactly one statement true.';
  }
  const location = (CLUES.RIDDLES[base.district] || base.riddle).replace(/^Dig\b/, 'Investigate');
  return { ...base, version: 2, kind, riddle: location + (base.window ? ` Come ${base.window.text}.` : ''),
    prompt, observations, choices, hint, answerId };
}

// The salt, derived district, and correct choice stay behind the authority boundary.
export function publicCluePuzzle(puzzle) {
  if (puzzle.version !== 2) return null;
  return { version: 2, kind: puzzle.kind, prompt: puzzle.prompt, observations: [...puzzle.observations],
    choices: puzzle.choices.map(({ id, label }) => ({ id, label })), hint: puzzle.hint,
    actionLabel: 'Submit deduction', endpoint: '/v1/clues/answer' };
}
