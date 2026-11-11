// Independent solver for public constraints. Never reads stored answers or seeds.
export function solveTaskPuzzle(puzzle) {
  const c = puzzle.constraints;
  let answers = [];
  if (puzzle.kind === 'patrol') answers = c.startOptions.filter(start => start + c.duration <= c.deadline &&
    c.blocked.every(block => start + c.duration <= block.start || start >= block.end)).map(start => ({ start }));
  if (puzzle.kind === 'route') {
    const walk = (path, cost) => {
      const last = path.at(-1);
      if (cost > c.budget) return;
      if (last === c.end) {
        if (c.required.every(id => path.includes(id))) answers.push({ path });
        return;
      }
      for (const edge of c.edges.filter(edge => edge.from === last && !path.includes(edge.to)))
        walk([...path, edge.to], cost + edge.cost);
    };
    walk([c.start], 0);
  }
  if (puzzle.kind === 'matching') {
    const walk = pairs => {
      if (pairs.length === c.left.length) { answers.push({ pairs }); return; }
      const left = c.left[pairs.length].id;
      for (const right of c.allowed.find(row => row.left === left).rights)
        if (!pairs.some(pair => pair.right === right)) walk([...pairs, { left, right }]);
    };
    walk([]);
  }
  if (puzzle.kind === 'evidence') answers = c.suspects.filter(suspect => c.statements.filter(statement =>
    statement.op === 'in' ? statement.suspects.includes(suspect.id) : !statement.suspects.includes(suspect.id)).length === c.trueCount)
    .map(suspect => ({ suspect: suspect.id }));
  if (answers.length !== 1) throw new Error(`Expected one public solution for ${puzzle.kind}, got ${answers.length}`);
  return { id: puzzle.id, answer: answers[0] };
}
