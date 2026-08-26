import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as knowledge from './knowledge.js';

const { buildForCheck, sourceRevisionForSnapshot, validate, render } = knowledge;
assert.equal(typeof knowledge.finalCallbackCall, 'function',
  'the final-callback parser must be directly regression-testable with controlled callback inputs');
const finalCallbackCases = [
  ['async () => arenaBoard(pool, { baseUrl })', 'arenaBoard', 'complete expression delegation'],
  ['async () => (arenaBoard(pool, { baseUrl }))', 'arenaBoard', 'parenthesized expression delegation'],
  ['async () => arenaBoard(pool) // final delegation', 'arenaBoard', 'expression trailing comment'],
  [`async (req) => {
    const ch = await loadCharacter(req);
    return (opportunityBoard(pool, ch)); // final delegation
  }`, 'opportunityBoard', 'parenthesized final top-level return with trailing comment'],
  [`async () => {
    if (!ready) return null;
    return arenaBoard(pool);
  }`, 'arenaBoard', 'final top-level return after an earlier guard'],
  [`async () => {
    if (ready) return arenaBoard(pool);
  }`, null, 'conditional return is not a final top-level delegation'],
  [`async () => {
    while (ready) return arenaBoard(pool);
  }`, null, 'loop return is not a final top-level delegation'],
  [`async () => {
    const nested = () => { return arenaBoard(pool); };
  }`, null, 'nested return is not a callback delegation'],
  [`async () => {
    const arenaBoard = () => fallback;
    return arenaBoard(pool);
  }`, null, 'callback-local declaration shadows the imported identifier'],
  ['async (arenaBoard) => arenaBoard(pool)', null,
    'callback parameter shadows the imported identifier'],
];
for (const [source, expected, label] of finalCallbackCases) {
  assert.equal(knowledge.finalCallbackCall(source), expected, label);
}

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const generatedFiles = fs.readdirSync(path.join(root, 'knowledge', 'generated'))
  .map((name) => `knowledge/generated/${name}`).sort();
const generatedAttributes = execFileSync('git', [
  'check-attr', 'text', 'eol', '--', ...generatedFiles,
], { cwd: root, encoding: 'utf8' });
for (const file of generatedFiles) {
  assert(generatedAttributes.includes(`${file}: text: set`),
    `${file} must be normalized as text in every checkout`);
  assert(generatedAttributes.includes(`${file}: eol: lf`),
    `${file} must check out as LF so an ordinary build cannot manufacture dirty status`);
}
assert.equal(sourceRevisionForSnapshot({
  head: 'snapshot-commit', parent: 'authored-parent', worktreeDirty: false,
  changedPaths: ['knowledge/generated/graph.json', 'knowledge/generated/routes.md'],
}), 'authored-parent', 'a clean generated-only snapshot must describe its authored parent');
assert.equal(sourceRevisionForSnapshot({
  head: 'mixed-commit', parent: 'parent', worktreeDirty: false,
  changedPaths: ['knowledge/generated/graph.json', 'tools/knowledge.js'],
}), 'mixed-commit', 'a mixed authored/generated commit is not a reproducible snapshot commit');
assert.equal(sourceRevisionForSnapshot({
  head: 'dirty-checkout', parent: 'parent', worktreeDirty: true,
  changedPaths: ['knowledge/generated/graph.json'],
}), 'dirty-checkout', 'dirty worktrees must report the checked-out revision rather than hiding changes');
const model = buildForCheck();
const result = validate(model);
assert.equal(result.ok, true, result.problems.join('\n'));

const { graph } = model;
const keys = new Set(graph.nodes.map((n) => n.key));
assert(keys.has('Repository:omerta'));
const storedGraph = JSON.parse(fs.readFileSync(path.join(root, 'knowledge', 'generated', 'graph.json'), 'utf8'));
const storedRepository = storedGraph.nodes.find((n) => n.key === 'Repository:omerta');
const repository = graph.nodes.find((n) => n.key === 'Repository:omerta');
assert(graph.census.byNodeType.Artifact >= 1000, 'the repository inventory unexpectedly collapsed');
assert(graph.census.byNodeType.Route >= 700, 'the HTTP surface unexpectedly collapsed');
assert(graph.census.byNodeType.Table >= 240, 'the schema inventory unexpectedly collapsed');
assert(graph.census.byNodeType.Contract >= 18, 'the contract inventory unexpectedly collapsed');
assert(graph.census.byNodeType.Commit >= 800, 'the Git lineage unexpectedly collapsed');
assert(graph.census.byNodeType.PullRequest >= 120, 'the GitHub snapshot unexpectedly collapsed');

const routeById = new Map(model.routes.map((route) => [`${route.method} ${route.url}`, route]));
const namedImportProvenance = [
  {
    id: 'GET /v1/arena', handler: 'arenaBoard', handlerFile: 'src/arena.js',
    definitionFile: 'src/server.js', domain: 'engagement-growth',
  },
  {
    id: 'GET /v1/opportunities', handler: 'opportunityBoard', handlerFile: 'src/opportunities.js',
    definitionFile: 'src/server.js', domain: 'engagement-growth',
  },
];
for (const expected of namedImportProvenance) {
  const route = routeById.get(expected.id);
  assert.deepEqual({
    handler: route?.handler,
    handlerFile: route?.handlerFile,
    definitionFile: route?.file,
    domain: route?.domain,
  }, {
    handler: expected.handler,
    handlerFile: expected.handlerFile,
    definitionFile: expected.definitionFile,
    domain: expected.domain,
  }, `${expected.id} must resolve its final named-import delegation exactly`);
  const handledBy = graph.edges.filter((edge) => edge.type === 'HANDLED_BY'
    && edge.from === `Route:${expected.id}`);
  assert.deepEqual(handledBy.map((edge) => ({ to: edge.to, symbol: edge.symbol })), [{
    to: `Artifact:${expected.handlerFile}`,
    symbol: expected.handler,
  }], `${expected.id} must have exactly one HANDLED_BY edge to its named-import handler`);
}
assert.equal(routeById.get('GET /v1/agent/turn')?.handler, 'readAgentTurn',
  'Agent Turn reads must resolve to their local readAgentTurn handler, not a later helper body');
assert.equal(routeById.get('POST /v1/agent/act')?.handler, 'executeAgentAction',
  'Agent Turn actions must resolve to their local executor, not a later namespaced call');
assert.equal(routeById.get('GET /u/:name')?.handler, 'Cards.publicDossier',
  'public profiles must keep their domain handler rather than promoting the incidental clip helper');
assert.equal(routeById.get('GET /card/:type/:name')?.handler, 'Cards.publicDossier',
  'card routes must not promote the incidental named-import renderPng call over their domain handler');
assert.equal(routeById.get('GET /v1/auth/x/callback')?.handler, 'A.xOAuthCallback',
  'X callbacks must keep their domain handler rather than promoting the incidental cookie parser');
for (const route of ['GET /', 'GET /admin', 'GET /wiki', 'GET /arena', 'GET /play', 'GET /path']) {
  assert.equal(routeById.get(route)?.handler, 'servePage',
    `${route} must resolve its direct callback-factory handler argument`);
}
for (const route of ['POST /v1/auth/x', 'POST /v1/auth/privy']) {
  assert.equal(routeById.get(route)?.handler, 'providerLogin',
    `${route} must resolve its direct callback-factory handler argument`);
}
assert.equal(model.routes.filter((route) => route.method === 'GET' && route.url === '/').length, 1,
  'dynamic route concatenations must not be coerced into an additional literal GET / registration');
assert.equal(repository.currentBranch, storedRepository.currentBranch,
  'knowledge checks must not drift when the same revision is checked from a named or detached branch');

for (const artifact of graph.nodes.filter((n) => n.type === 'Artifact')) {
  assert(artifact.version, `${artifact.key} has no version`);
  assert(graph.edges.some((e) => e.type === 'CONTAINS' && e.to === artifact.key), `${artifact.key} has no subsystem`);
  if (artifact.text) {
    const normalized = fs.readFileSync(path.join(root, artifact.path), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(artifact.bytes, Buffer.byteLength(normalized, 'utf8'),
      `${artifact.key} byte count must not vary with checkout line endings`);
  }
}
for (const extension of ['.dot', '.example', '.excalidraw', '.geojson', '.ps1', '.ts', '.tsx']) {
  const artifacts = graph.nodes.filter((n) => n.type === 'Artifact' && n.extension === extension);
  assert(artifacts.length > 0, `text fixture extension disappeared: ${extension}`);
  assert(artifacts.every((artifact) => artifact.text), `${extension} artifacts must use normalized text accounting`);
}
const trackedPaths = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean).map((file) => file.replaceAll('\\', '/')));
const binaryArtifact = graph.nodes.find((n) => n.type === 'Artifact' && !n.text && trackedPaths.has(n.path));
assert(binaryArtifact, 'tracked binary artifact fixture disappeared');
const binaryBlobBytes = Number(execFileSync('git', ['cat-file', '-s', `:${binaryArtifact.path}`], {
  cwd: root,
  encoding: 'utf8',
}).trim());
assert.equal(binaryArtifact.bytes, binaryBlobBytes,
  `${binaryArtifact.key} byte count must come from checkout-stable Git blob metadata`);
for (const edge of graph.edges) {
  assert(keys.has(edge.from), `dangling edge source ${edge.from}`);
  assert(keys.has(edge.to), `dangling edge target ${edge.to}`);
}

const outputs = render(model);
for (const [name, expected] of Object.entries(outputs)) {
  const file = path.join(root, 'knowledge', 'generated', name);
  assert(fs.existsSync(file), `generated knowledge artifact missing: ${name}`);
  const actual = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  if (actual !== expected) {
    const actualLines = actual.split('\n');
    const expectedLines = expected.split('\n');
    let line = 0;
    while (actualLines[line] === expectedLines[line] && line < Math.max(actualLines.length, expectedLines.length)) line += 1;
    assert.fail(`${name} drifted; run npm run knowledge; first difference at line ${line + 1}\n`
      + `committed: ${JSON.stringify(actualLines[line] ?? '<EOF>')}\n`
      + `generated: ${JSON.stringify(expectedLines[line] ?? '<EOF>')}`);
  }
}

const knowledgeRoot = path.join(root, 'knowledge');
const markdown = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.md')) markdown.push(file);
  }
};
walk(knowledgeRoot);
for (const file of markdown) {
  const body = fs.readFileSync(file, 'utf8');
  for (const match of body.matchAll(/\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, '');
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    target = decodeURIComponent(target.split('#')[0]);
    assert(fs.existsSync(path.resolve(path.dirname(file), target)), `${path.relative(root, file)} has a broken link: ${match[1]}`);
  }
}

console.log(`✓ repository knowledge plane: ${graph.census.nodes} nodes, ${graph.census.edges} edges; provenance, endpoints, links and generated artifacts valid`);
