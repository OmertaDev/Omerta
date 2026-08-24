import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, validate, render } from './knowledge.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const model = build();
const result = validate(model);
assert.equal(result.ok, true, result.problems.join('\n'));

const { graph } = model;
const keys = new Set(graph.nodes.map((n) => n.key));
assert(keys.has('Repository:omerta'));
assert(graph.census.byNodeType.Artifact >= 1000, 'the repository inventory unexpectedly collapsed');
assert(graph.census.byNodeType.Route >= 700, 'the HTTP surface unexpectedly collapsed');
assert(graph.census.byNodeType.Table >= 240, 'the schema inventory unexpectedly collapsed');
assert(graph.census.byNodeType.Contract >= 18, 'the contract inventory unexpectedly collapsed');
assert(graph.census.byNodeType.Commit >= 800, 'the Git lineage unexpectedly collapsed');
assert(graph.census.byNodeType.PullRequest >= 120, 'the GitHub snapshot unexpectedly collapsed');

for (const artifact of graph.nodes.filter((n) => n.type === 'Artifact')) {
  assert(artifact.version, `${artifact.key} has no version`);
  assert(graph.edges.some((e) => e.type === 'CONTAINS' && e.to === artifact.key), `${artifact.key} has no subsystem`);
}
for (const edge of graph.edges) {
  assert(keys.has(edge.from), `dangling edge source ${edge.from}`);
  assert(keys.has(edge.to), `dangling edge target ${edge.to}`);
}

const outputs = render(model);
for (const [name, expected] of Object.entries(outputs)) {
  const file = path.join(root, 'knowledge', 'generated', name);
  assert(fs.existsSync(file), `generated knowledge artifact missing: ${name}`);
  assert.equal(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'), expected, `${name} drifted; run npm run knowledge`);
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
