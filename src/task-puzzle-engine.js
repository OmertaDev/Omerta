// Version 1 is immutable: retain its generator/verifier when adding future versions.
// These are gameplay puzzles, not bot-proof human verification.
import crypto from 'node:crypto';

export const TASK_PUZZLE_VERSION = 1;
export const TASK_PUZZLE_KINDS = Object.freeze(['patrol', 'route', 'matching', 'evidence']);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const copy = value => JSON.parse(JSON.stringify(value));
function random(seed) {
  let counter = 0;
  const int = count => parseInt(hash(`${seed}:${counter++}`).slice(0, 12), 16) % count;
  const shuffle = items => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) { const j = int(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  };
  return { int, shuffle };
}
function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, i) => permutations(items.filter((_, j) => i !== j)).map(rest => [item, ...rest]));
}
// Small relational puzzles can be canonicalized over every relabeling. Neither
// labels nor presentation order count as novelty for recent-pattern avoidance.
function canonical(size, describe) {
  let best;
  for (const order of permutations(Array.from({ length: size }, (_, i) => i))) {
    const text = JSON.stringify(describe(order));
    if (best === undefined || text < best) best = text;
  }
  return best;
}
const places = ['Rope Shed', 'Tram Depot', 'Lock House', 'Kiln Door', 'Weighbridge', 'Stage Door', 'Bell Gate'];
const names = ['Lookout', 'Courier', 'Clerk', 'Driver', 'Broker', 'Keeper'];
const parcels = ['Ledger', 'Key', 'Envelope', 'Map', 'Token', 'Seal'];
function patrol(rng) {
  for (let attempt = 0; attempt < 256; attempt++) {
    const count = 8 + rng.int(7), duration = 2 + rng.int(4), length = count + duration - 1;
    const chosen = rng.int(count), deadline = length - rng.int(3);
    if (chosen + duration > deadline) continue;
    const occupied = Array.from({ length }, () => rng.int(2) === 0);
    for (let t = chosen; t < chosen + duration; t++) occupied[t] = false;
    if (chosen > 0) occupied[chosen - 1] = true;
    if (chosen + duration < length) occupied[chosen + duration] = true;
    const starts = Array.from({ length: count }, (_, i) => i);
    const legal = starts.filter(start => start + duration <= deadline && !occupied.slice(start, start + duration).some(Boolean));
    if (legal.length !== 1) continue;
    const blocked = [];
    for (let t = 0; t < length; t++) if (occupied[t]) {
      const start = t; while (t + 1 < length && occupied[t + 1]) t++;
      blocked.push({ start, end: t + 1 });
    }
    const offset = 5 + rng.int(85);
    return { title: 'Patrol timing', instructions: 'Choose a listed start minute. The crossing must finish by the deadline and never overlap a blocked patrol interval. Intervals include their start and exclude their end.',
      constraints: { startOptions: starts.map(t => t + offset), duration, deadline: deadline + offset,
        blocked: blocked.map(({ start, end }) => ({ start: start + offset, end: end + offset })) },
      controls: { type: 'start', options: starts.map(t => t + offset) },
      hint: 'Look for an uninterrupted gap at least as long as the crossing. Finishing exactly when a patrol starts is safe.',
      answer: { start: chosen + offset }, structure: [count, duration, deadline, blocked] };
  }
  throw new Error('Unable to generate patrol puzzle');
}
function route(rng) {
  for (let attempt = 0; attempt < 256; attempt++) {
    const count = 5 + rng.int(3), ids = rng.shuffle(Array.from({ length: count }, (_, i) => `n${i}`));
    const labels = rng.shuffle(places), edges = [];
    for (let from = 0; from < count - 1; from++) for (let to = from + 1; to < count; to++)
      if (to === from + 1 || rng.int(2) === 0) edges.push({ from: ids[from], to: ids[to], cost: 1 + rng.int(12) });
    const required = rng.shuffle(ids.slice(1, -1)).slice(0, 1 + rng.int(Math.min(3, count - 2)));
    const paths = [];
    const walk = (path, cost) => {
      const last = path.at(-1);
      if (last === ids.at(-1)) { if (required.every(id => path.includes(id))) paths.push({ path, cost }); return; }
      for (const edge of edges.filter(edge => edge.from === last)) walk([...path, edge.to], cost + edge.cost);
    };
    walk([ids[0]], 0); paths.sort((a, b) => a.cost - b.cost);
    if (paths.length > 1 && paths[0].cost === paths[1].cost) continue;
    const budget = paths[0].cost;
    return { title: 'Courier route', instructions: 'Build a directed route from the start to the finish, visiting every required stop. Add the edge costs and stay within the budget. Do not visit a stop twice.',
      constraints: { nodes: rng.shuffle(ids.map((id, i) => ({ id, label: labels[i] }))), edges: rng.shuffle(edges), start: ids[0], end: ids.at(-1), required: rng.shuffle(required), budget },
      controls: { type: 'path', nodeIds: rng.shuffle(ids) },
      hint: 'Trace the arrows, include the required stops, and compare the total costs of the possible routes.',
      answer: { path: paths[0].path },
      // The chain edges give this DAG a unique topological order, independent of IDs.
      structure: [count, edges.map(edge => [ids.indexOf(edge.from), ids.indexOf(edge.to), edge.cost]), required.map(id => ids.indexOf(id)).sort((a, b) => a - b), budget] };
  }
  throw new Error('Unable to generate route puzzle');
}
function matching(rng) {
  const count = 4 + rng.int(3), leftIds = rng.shuffle(Array.from({ length: count }, (_, i) => `l${i}`));
  const rightIds = rng.shuffle(Array.from({ length: count }, (_, i) => `r${i}`));
  const leftNames = rng.shuffle(names), rightNames = rng.shuffle(parcels);
  const matrix = Array.from({ length: count }, (_, i) => Array.from({ length: count }, (_, j) => j === i || (j < i && rng.int(2) === 0)));
  const allowed = leftIds.map((left, i) => ({ left, rights: rng.shuffle(rightIds.filter((_, j) => matrix[i][j])) }));
  return { title: 'One-to-one matching', instructions: 'Assign exactly one parcel to each contact using only that contact\'s allowed parcels. Every parcel must be used exactly once.',
    constraints: { left: rng.shuffle(leftIds.map((id, i) => ({ id, label: leftNames[i] }))),
      right: rng.shuffle(rightIds.map((id, i) => ({ id, label: rightNames[i] }))), allowed: rng.shuffle(allowed) },
    controls: { type: 'pairs', leftIds: rng.shuffle(leftIds), rightIds: rng.shuffle(rightIds) },
    hint: 'Start with a contact who has only one possible parcel, then remove that parcel from the remaining choices.',
    answer: { pairs: leftIds.map((left, i) => ({ left, right: rightIds[i] })) },
    structure: canonical(count, order => order.map(i => order.map(j => matrix[i][j] ? 1 : 0))) };
}
function evidence(rng) {
  for (let attempt = 0; attempt < 256; attempt++) {
    const count = 4 + rng.int(3), ids = Array.from({ length: count }, (_, i) => `s${i}`), labels = rng.shuffle(names);
    const chosen = rng.int(count), total = 4 + rng.int(5), statements = [], truthSets = [];
    const claims = new Set();
    for (let sample = 0; sample < 128 && statements.length < total; sample++) {
      const subset = rng.shuffle(ids).slice(0, 1 + rng.int(count - 1)), op = rng.int(2) ? 'in' : 'not-in';
      const truthSet = ids.filter(id => op === 'in' ? subset.includes(id) : !subset.includes(id));
      const claim = truthSet.join(',');
      if (claims.has(claim)) continue;
      claims.add(claim);
      statements.push({ id: `e${statements.length}`, op, suspects: rng.shuffle(subset) });
      truthSets.push(truthSet);
    }
    if (statements.length !== total) continue;
    const counts = ids.map(id => truthSets.filter(set => set.includes(id)).length), trueCount = counts[chosen];
    if (!trueCount || trueCount === total || counts.filter(value => value === trueCount).length !== 1) continue;
    return { title: 'Evidence deduction', instructions: 'Exactly one listed suspect carried the envelope. A statement marked in claims the carrier is in its list; not-in claims the carrier is outside its list. Choose the only suspect that makes exactly the stated number of statements true.',
      constraints: { suspects: rng.shuffle(ids.map((id, i) => ({ id, label: labels[i] }))), statements: rng.shuffle(statements), trueCount },
      controls: { type: 'choice', options: rng.shuffle(ids.map((id, i) => ({ id, label: labels[i] }))) },
      hint: 'Try each suspect as the carrier. Count true statements for that suspect, including the not-in statements.',
      answer: { suspect: ids[chosen] },
      structure: [trueCount, canonical(count, order => truthSets.map(set => order.map(i => set.includes(ids[i]) ? 1 : 0).join('')).sort())] };
  }
  throw new Error('Unable to generate evidence puzzle');
}
const generators = { patrol, route, matching, evidence };
export function generateTaskPuzzle(terms) {
  if (!exact(terms, ['seed']) && !exact(terms, ['seed', 'kind'])) throw new TypeError('Invalid task-puzzle terms');
  const { seed } = terms;
  if (typeof seed !== 'string' || seed.length < 1 || seed.length > 512) throw new TypeError('Invalid task-puzzle seed');
  const rng = random(seed), kind = terms.kind ?? TASK_PUZZLE_KINDS[rng.int(TASK_PUZZLE_KINDS.length)];
  if (!TASK_PUZZLE_KINDS.includes(kind)) throw new TypeError('Unknown task-puzzle kind');
  const { structure, ...puzzle } = generators[kind](rng);
  return { version: TASK_PUZZLE_VERSION, kind, ...puzzle, structuralSignature: hash(JSON.stringify([TASK_PUZZLE_VERSION, kind, structure])) };
}
function supported(puzzle) { return puzzle?.version === 1 && TASK_PUZZLE_KINDS.includes(puzzle.kind); }
export function publicTaskPuzzle(puzzle) {
  if (!supported(puzzle)) throw new TypeError('Unsupported task-puzzle version or kind');
  const { version, kind, title, instructions, constraints, controls, hint } = puzzle;
  return copy({ version, kind, title, instructions, constraints, controls, hint });
}
export function verifyTaskPuzzle(puzzle, answer) {
  if (!supported(puzzle)) return false;
  if (puzzle.kind === 'patrol') return exact(answer, ['start']) && Number.isSafeInteger(answer.start) && answer.start === puzzle.answer.start;
  if (puzzle.kind === 'route') return exact(answer, ['path']) && Array.isArray(answer.path) &&
    answer.path.length === puzzle.answer.path.length && Array.from(answer.path).every((id, i) => typeof id === 'string' && id === puzzle.answer.path[i]);
  if (puzzle.kind === 'matching') {
    if (!exact(answer, ['pairs']) || !Array.isArray(answer.pairs) || answer.pairs.length !== puzzle.answer.pairs.length ||
      !answer.pairs.every(pair => exact(pair, ['left', 'right']) && typeof pair.left === 'string' && typeof pair.right === 'string') ||
      new Set(answer.pairs.map(pair => pair.left)).size !== answer.pairs.length || new Set(answer.pairs.map(pair => pair.right)).size !== answer.pairs.length) return false;
    return puzzle.answer.pairs.every(expected => answer.pairs.some(pair => pair.left === expected.left && pair.right === expected.right));
  }
  return exact(answer, ['suspect']) && typeof answer.suspect === 'string' && answer.suspect === puzzle.answer.suspect;
}
