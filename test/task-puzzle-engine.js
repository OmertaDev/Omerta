import assert from 'node:assert/strict';
import fs from 'node:fs';
assert(fs.existsSync(new URL('../src/task-puzzle-engine.js', import.meta.url)), 'versioned task-puzzle engine must exist');
const { generateTaskPuzzle, publicTaskPuzzle, verifyTaskPuzzle } = await import('../src/task-puzzle-engine.js');
const kinds = ['patrol', 'route', 'matching', 'evidence'];
function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, i) => permutations(items.filter((_, j) => i !== j)).map(rest => [item, ...rest]));
}
// Enumerate from public constraints only, deliberately not from the private answer or verifier.
function solutions(p) {
  const c = p.constraints;
  if (p.kind === 'patrol') return c.startOptions.filter(start => start + c.duration <= c.deadline &&
    c.blocked.every(block => start + c.duration <= block.start || start >= block.end)).map(start => ({ start }));
  if (p.kind === 'route') {
    const paths = [];
    const walk = (path, cost) => {
      const last = path.at(-1);
      if (last === c.end) { if (cost <= c.budget && c.required.every(id => path.includes(id))) paths.push({ path }); return; }
      for (const edge of c.edges.filter(edge => edge.from === last && !path.includes(edge.to))) walk([...path, edge.to], cost + edge.cost);
    };
    walk([c.start], 0); return paths;
  }
  if (p.kind === 'matching') return permutations(c.right.map(row => row.id)).filter(rights =>
    c.left.every((row, i) => c.allowed.find(rule => rule.left === row.id).rights.includes(rights[i])))
    .map(rights => ({ pairs: c.left.map((row, i) => ({ left: row.id, right: rights[i] })) }));
  return c.suspects.filter(person => c.statements.filter(statement =>
    statement.op === 'in' ? statement.suspects.includes(person.id) : !statement.suspects.includes(person.id)).length === c.trueCount)
    .map(person => ({ suspect: person.id }));
}
function structure(p) {
  const c = p.constraints;
  if (p.kind === 'patrol') { const offset = c.startOptions[0]; return JSON.stringify([c.duration, c.startOptions.map(x => x - offset), c.deadline - offset, c.blocked.map(x => [x.start - offset, x.end - offset])]); }
  if (p.kind === 'route') return JSON.stringify([c.start, c.end, [...c.required].sort(), [...c.edges].sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to)), c.budget]);
  if (p.kind === 'matching') return JSON.stringify(c.allowed.map(row => [row.left, [...row.rights].sort()]).sort());
  return JSON.stringify([c.trueCount, c.statements.map(row => [row.op, [...row.suspects].sort()]).sort()]);
}
for (const kind of kinds) {
  const patterns = new Set(), signatures = new Set(), answers = new Set();
  for (let index = 0; index < 500; index++) {
    const seed = `independent-${kind}-${index}`, puzzle = generateTaskPuzzle({ seed, kind });
    assert.deepEqual(generateTaskPuzzle({ seed, kind }), puzzle, 'same version and seed retain exact generation');
    const view = publicTaskPuzzle(puzzle), candidates = solutions(view);
    assert.equal(candidates.length, 1, `${kind} seed ${index} has exactly one independently enumerated legal answer`);
    assert(verifyTaskPuzzle(puzzle, candidates[0]), 'the independently legal answer is accepted');
    if (kind === 'matching') assert(verifyTaskPuzzle(puzzle, { pairs: [...candidates[0].pairs].reverse() }), 'pair order is immaterial');
    assert.deepEqual(Object.keys(view).sort(), ['version', 'kind', 'title', 'instructions', 'constraints', 'controls', 'hint'].sort());
    assert.equal(view.version, 1); assert.equal(view.kind, kind); assert(view.hint && view.instructions && view.title);
    if (kind === 'evidence') {
      const truthSets = view.constraints.statements.map(statement => view.constraints.suspects.filter(person =>
        statement.op === 'in' ? statement.suspects.includes(person.id) : !statement.suspects.includes(person.id)).map(person => person.id).sort().join(','));
      assert.equal(new Set(truthSets).size, truthSets.length, 'evidence clues do not repeat the same claim under cosmetic wording');
    }
    assert.doesNotMatch(JSON.stringify(view), /"(?:answer|answerId|solution|seed|structuralSignature)"\s*:/);
    assert(!JSON.stringify(view).includes(seed), 'public projection never leaks the generator seed');
    for (const bad of [undefined, null, true, 1, 'solved', [], {}, { ...candidates[0], completed: true }])
      assert.equal(verifyTaskPuzzle(puzzle, bad), false, `${kind} refuses malformed or surplus answer fields`);
    const wrong = kind === 'patrol' ? { start: -1 } : kind === 'route' ? { path: [view.constraints.end] } :
      kind === 'matching' ? { pairs: candidates[0].pairs.map(row => ({ ...row, right: candidates[0].pairs[0].right })) } : { suspect: 'nobody' };
    assert.equal(verifyTaskPuzzle(puzzle, wrong), false, 'incorrect answers cannot complete a task');
    patterns.add(structure(view)); signatures.add(puzzle.structuralSignature); answers.add(JSON.stringify(candidates[0]));
    const mutatedView = publicTaskPuzzle(puzzle); mutatedView.constraints.injected = true;
    assert.equal(puzzle.constraints.injected, undefined, 'public constraints are detached from private state');
  }
  assert(patterns.size >= 100, `${kind} has material constraint variety, got ${patterns.size}`);
  assert(signatures.size >= 100, `${kind} recent avoidance has real structural signatures`);
  assert(answers.size >= (kind === 'evidence' ? 4 : 10), `${kind} solutions vary`);
}
const routeBoundary = generateTaskPuzzle({ seed: 'sparse-route-boundary', kind: 'route' });
assert.equal(verifyTaskPuzzle(routeBoundary, { path: new Array(routeBoundary.answer.path.length) }), false, 'sparse route arrays cannot skip answer validation');
const p = generateTaskPuzzle({ seed: 'version-boundary', kind: 'patrol' });
assert.equal(verifyTaskPuzzle({ ...p, version: 99 }, { start: p.answer.start }), false, 'unsupported issuance versions never silently upgrade');
assert.throws(() => publicTaskPuzzle({ ...p, version: 99 }), /version/i);
assert.throws(() => generateTaskPuzzle({ seed: 'bad-kind', kind: 'constructor' }), /kind/i);
assert.throws(() => generateTaskPuzzle({ seed: '' }), /seed/i);
assert.throws(() => generateTaskPuzzle({ seed: 's', injected: true }), /terms/i);
assert.equal(new Set(Array.from({ length: 50 }, (_, index) => generateTaskPuzzle({ seed: `default-${index}` }).kind)).size, 4);
console.log('Task-puzzle engine PASS: 500 independent seeds per mechanic, unique solutions, structural variety, strict answers and private projection.');
