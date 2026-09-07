// THE GRAPH PLANE test (the 54th suite) — guards tools/graph.js, the project's work-and-knowledge
// graph (see GRAPH.md).
//
// The failure mode this file exists to prevent is the one that has bitten twice in a row now: a
// coverage tool that silently extracts nothing, passes every invariant vacuously, and gets read as
// proof. `test/client.js` shipped green while missing a third of the client's request bodies;
// `tools/mobile.js` shipped with a dead MIN_TAP constant and an i18n-fragile selector that would
// have walked zero screens in another locale. So every assertion here is either a NON-TRIVIALITY
// floor (the extractor really found the things we know are there) or a MECHANISM check on a
// synthetic graph (the query really fires when the condition it looks for is true).
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  build,
  checkGraph,
  QUERIES,
  census,
  NODE_TYPES,
  EDGE_TYPES,
  isMainModule,
  normalizeText,
} from '../tools/graph.js';

// The graph is a developer-facing CLI as well as an importable module. Pin the two Windows failure
// modes explicitly: CRLF must not change the parser's language, and a drive-letter argv path must
// still be recognized as the entry module.
assert.equal(normalizeText('one\r\ntwo\rthree\n'), 'one\ntwo\nthree\n');
const graphPath = fileURLToPath(new URL('../tools/graph.js', import.meta.url));
assert(isMainModule(new URL('../tools/graph.js', import.meta.url).href, graphPath));
assert(!isMainModule(import.meta.url, graphPath));

const g = build();
const c = census(g);

// ── the graph is not empty ───────────────────────────────────────────────────────────────────────
// Floors, not exact counts: this repo grows every session and a guard that nags on unrelated work
// gets deleted. But each floor is far enough above zero that a broken extractor cannot clear it.
assert(c.byNode.Module >= 90, `expected ~100 modules, extracted ${c.byNode.Module}`);
assert(c.byNode.Suite >= 50, `expected ~53 suites, extracted ${c.byNode.Suite}`);
assert(c.byNode.Lever >= 500, `expected 500+ levers from the rules tail, extracted ${c.byNode.Lever}`);
assert(c.byNode.Reason >= 200, `expected 200+ ledger reasons, extracted ${c.byNode.Reason}`);
assert(c.byNode.Check >= 20, `expected 21 invariant checks, extracted ${c.byNode.Check}`);
assert(c.byNode.Pattern >= 50, `expected 50+ named precedents cited in src, extracted ${c.byNode.Pattern}`);
for (const t of ['DEFINES', 'READS', 'PINS', 'EMITS', 'RECONCILES', 'COVERS', 'CITES', 'MENTIONS']) {
  assert(c.byEdge[t] > 0, `no ${t} edges — that extractor is dead`);
}
console.log(`✓ census: ${c.nodes} nodes / ${c.edges} edges across ${NODE_TYPES.length} node and ${EDGE_TYPES.length} edge types`);

// ── the graph's own write invariants (paper §Appendix) ───────────────────────────────────────────
const inv = checkGraph(g);
assert(inv.ok, `graph invariants failed:\n  ${inv.problems.join('\n  ')}`);
// Only the genuinely computed-term checks may reconcile no literal reason. If another appears,
// the term extractor has regressed and the coverage query below has quietly gone blind.
// `desk inventory backed` joins them for a different and honest reason: it reconciles a bucket
// against its OWN books (balance vs lifetime_in − lifetime_sold) and names no ledger reason at all.
// Its sibling `desk inventory ledgered` is the one that reconciles desk:recycle, and the parser can
// read that one — which is why the literal lives in its SQL.
assert.deepEqual(inv.mute.sort(), [
  'agent acquisition budget accounting',
  'character cash',
  'desk inventory backed',
  'reason vocabulary',
  'world graph salvage car audit',
  'world graph stack conservation',
  'world graph unique custody and provenance',
],
  `unexpected checks reconcile no reason — the SQL term parser missed a shape: ${inv.mute.join(', ')}`);
const NON_CURRENCY_WORLD_GRAPH_CHECKS = new Map([
  ['world graph salvage car audit', 'authoritative noncurrency salvage sink'],
  ['world graph stack conservation', 'custody conservation'],
  ['world graph unique custody and provenance', 'unique custody/provenance'],
]);
for (const [name, taxonomy] of NON_CURRENCY_WORLD_GRAPH_CHECKS) {
  assert(g.nodes.has(`Check:${name}`), `${taxonomy} check disappeared from the invariant graph`);
  assert.equal(g.edges.some((edge) => (
    edge.type === 'RECONCILES' && edge.from === `Check:${name}`
  )), false, `${taxonomy} SQL must not be misclassified as a transaction currency/reason term`);
}
console.log('✓ write invariants: provenance, authoring run, content hash, named rubrics, no dangling edges');

// ── extraction really found the things we know are in the tree ───────────────────────────────────
// Named specifically, because a floor can be cleared by garbage. These are facts about this repo.
const has = (k) => g.nodes.has(k);
assert(has('Lever:CASH_LOOT_RATE'), 'the P1.1 loot rate is a lever in the rules tail');
assert(has('Reason:whack:loot'), 'whack:loot is a ledger reason');
assert(has('Check:ring poker escrow'), 'the ring poker escrow check was extracted');
assert(has('Module:src/invariants.js') && has('Suite:test/ring.js'), 'modules and suites resolve');

// CITES is the query CLAUDE.md exists to serve by hand. The whack:loot precedent is invoked from
// three separate modules; if the pattern extractor breaks, this is what notices.
const whack = g.edges.filter((e) => e.type === 'CITES' && e.to === 'Pattern:whack:loot precedent');
assert(whack.length >= 3, `expected the whack:loot precedent cited from 3+ sites, got ${whack.length}`);
assert(new Set(whack.map((e) => e.from)).size >= 3, 'and from 3+ distinct modules');
console.log(`✓ precedent lookup: "whack:loot precedent" resolves to ${whack.length} sites in ${new Set(whack.map((e) => e.from)).size} modules`);

// ── the coverage query fires (mechanism, on a synthetic graph) ───────────────────────────────────
// Against the real tree this returns 0 — every NULL-character cash reason is inside some check's
// terms. A zero that means "correct" and a zero that means "broken" look identical, so the mechanism
// is exercised directly: a NULL-character cash reason that no check covers MUST be reported, and the
// three exemptions (character-scoped, non-cash, covered-by-prefix) MUST each suppress it.
{
  const fake = {
    nodes: new Map([['Reason:x', {}]]),
    edges: [
      { type: 'EMITS', to: 'Reason:hole', currency: 'cash', scoped: false, prov: { file: 'f', line: 1 } },
      { type: 'EMITS', to: 'Reason:scoped', currency: 'cash', scoped: true, prov: { file: 'f', line: 2 } },
      { type: 'EMITS', to: 'Reason:omr:thing', currency: 'omr', scoped: false, prov: { file: 'f', line: 3 } },
      { type: 'EMITS', to: 'Reason:pre:fixed', currency: 'cash', scoped: false, prov: { file: 'f', line: 4 } },
      { type: 'RECONCILES', to: 'Reason:pre:%' },
    ],
    unparsed: [],
  };
  const out = QUERIES['unreconciled-reasons'](fake);
  assert.equal(out.length, 1, `the query should report exactly the one real hole, got ${out.length}: ${out}`);
  assert(out[0].startsWith('hole'), `it should be the unscoped uncovered cash reason, got ${out[0]}`);
}
// And on the real tree it is clean — asserted so a regression that opens a §10.4 blind spot fails CI.
assert.equal(QUERIES['unreconciled-reasons'](g).length, 0,
  'a NULL-character cash reason is written that no invariant check accounts for — see GRAPH.md');
console.log('✓ reason coverage: mechanism fires on a synthetic hole; the real tree is clean');

// ── the honesty rule: unparsed input is counted, never silently dropped ──────────────────────────
// Two shapes are genuinely unresolvable statically (interpolated reasons, runtime currencies). They
// are allowed but must stay bounded and must stay VISIBLE — a growing blind spot has to be seen.
const kinds = new Set(g.unparsed.map((u) => u.kind));
assert(kinds.has('interpolated-reason'), 'interpolated reasons must be counted, not silently skipped');
assert(g.unparsed.length < c.byEdge.EMITS * 0.25,
  `${g.unparsed.length} unparsed vs ${c.byEdge.EMITS} parsed — extraction has gone too lossy to trust`);
assert.equal(QUERIES.unparsed(g).length, g.unparsed.length, 'every unparsed construct is reportable');
console.log(`✓ honesty rule: ${g.unparsed.length} unresolvable constructs counted and listed (${[...kinds].join(', ')})`);

// ── the lever trace answers the paper's tracing question for one number ──────────────────────────
const trace = QUERIES.lever(g, 'CASH_LOOT_RATE');
assert(trace.some((l) => l.includes('rules.tail.js')), 'the trace names where the lever is declared');
assert(trace.some((l) => l.startsWith('read by') && l.includes('src/')), 'and which modules read it');
assert(trace.some((l) => l.startsWith('decided in') && l.includes('.md')), 'and which documents decided it');
console.log('✓ lever trace: declaration, readers, pins and deciding documents resolve for a real lever');

// ── open-findings: it reports, and it must never quietly stop reporting ──────────────────────────
// GRAPH.md §5 increment 2. Three registers — SIGN-OFF.md (founder decisions), BALANCE.md (economy
// sign-off) and SPEC.md (technical debt) — share the D1–D15 id namespace, so `D1` names three
// unrelated things and a bare mention cannot be attributed. The query therefore REPORTS: it prints
// each row's own state with outside evidence beside it, and flags the collision. These assertions
// pin the parts that would make it useless if they broke silently.
{
  const claims = [...g.nodes.values()].filter((n) => n.type === 'Claim');
  const rows = claims.filter((n) => n.register !== 'AUDIT');
  // per-register FIRST, so a broken parser names the register it lost rather than only the total
  for (const reg of ['SIGN-OFF', 'BALANCE', 'SPEC']) {
    assert(rows.some((n) => n.register === reg), `no rows extracted from ${reg} — a register that `
      + 'stops parsing silently drops every decision it holds');
  }
  assert(rows.length >= 30, `only ${rows.length} register rows extracted — with a broken register `
    + 'parser this query reports an empty sheet, which reads exactly like a clean one');

  // The collision is the whole reason this reports rather than concludes. If it stopped being
  // detected the query would start attributing one register's evidence to another's decision.
  assert(rows.some((n) => n.ambiguous), 'the shared D1–D15 namespace is no longer detected as '
    + 'ambiguous — evidence would now be attributed to whichever register parsed first');

  const out = QUERIES['open-findings'](g);
  const text = out.join('\n');
  assert(/AMBIGUOUS/.test(text), 'the query must SAY when an id is carried by more than one register');
  assert(/COVERAGE, not a census/.test(text), 'the audit-corpus figure must be stated as coverage — '
    + 'read as a census it is a count of findings nobody can check');
  assert(g.auditCoverage.reports > g.auditCoverage.withMarker,
    `coverage claims ${g.auditCoverage.withMarker} of ${g.auditCoverage.reports} reports carry a `
    + 'marker; if every report matched, the scan would be a census and the caveat would be false');

  // The sheet's own answer table is the authority on whether a decision is closed. A word scan over
  // row bodies read 12 of 15 as resolved — "it is already built that way" inside an argument FOR an
  // option is not a closure — so the answer must come from the table or not at all.
  const sheet = rows.filter((n) => n.register === 'SIGN-OFF');
  assert(sheet.length >= 10 && sheet.every((n) => n.answer),
    'every sheet row must resolve to an answer in SIGN-OFF.md\'s own answer table; a row with no '
    + 'entry is genuinely unanswered and the query says so');
  console.log(`✓ open-findings: ${rows.length} register rows across three D-namespace registers, `
    + `${rows.filter((n) => n.ambiguous).length} flagged ambiguous, audit coverage stated as `
    + `${g.auditCoverage.withMarker} of ${g.auditCoverage.reports} reports`);
}

// Exercise the actual executable boundary. This caught the silent-success regression where direct
// commands returned status 0 but printed nothing on Windows because the entry-point guard was false.
{
  const cli = spawnSync(process.execPath, [graphPath, 'query', 'open-findings'], {
    cwd: path.dirname(path.dirname(graphPath)),
    encoding: 'utf8',
  });
  assert.equal(cli.status, 0, `graph CLI failed: ${cli.stderr}`);
  assert(cli.stdout.includes('# open-findings'), 'graph CLI printed no open-findings query header');
  assert(cli.stdout.includes('SIGN-OFF.md'), 'graph CLI silently lost the founder decision register');
  console.log('✓ CLI boundary: direct queries execute and CRLF registers parse on this host');
}

console.log('✅ THE GRAPH PLANE test passed — the work-and-knowledge graph builds from the tree with '
  + `${c.nodes} nodes and ${c.edges} edges, every node carries provenance + an authoring run + a content hash, `
  + 'every invariant check names what it reconciles, precedent lookup resolves a named pattern to its call sites, '
  + 'the §10.4 coverage query fires on a synthetic hole and reports the real tree clean, the lever trace answers '
  + "the paper's tracing question end to end, and everything the extractor cannot read is counted and listed "
  + 'rather than skipped in silence');
