#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const location = path.join(root, 'docs/quest-quality-workgraph.json');
const graph = JSON.parse(fs.readFileSync(location, 'utf8'));
const resolve = relative => {
  if (typeof relative !== 'string') throw new Error('Graph paths must be strings.');
  const target = path.resolve(root, relative), checked = path.relative(root, target);
  if (!checked || checked.startsWith('..') || path.isAbsolute(checked)) throw new Error('Graph artifacts must remain inside the repository.');
  return target;
};
const hash = relative => crypto.createHash('sha256').update(fs.readFileSync(resolve(relative), 'utf8').replace(/\r\n?/g, '\n')).digest('hex');
const hashes = () => Object.fromEntries(graph.sourcePaths.map(file => [file, hash(file)]));
const save = () => fs.writeFileSync(location, JSON.stringify(graph, null, 2) + '\n');
function validate() {
  if (graph.version !== 1 || graph.features.length !== 50 || new Set(graph.features.map(feature => feature.id)).size !== 50) throw new Error('Retain exactly fifty uniquely numbered improvements.');
  const byId = new Map(graph.features.map(feature => [feature.id, feature])), done = new Set(), active = new Set();
  function visit(feature) {
    if (active.has(feature.id)) throw new Error(`Dependency cycle at ${feature.id}.`);
    if (done.has(feature.id)) return;
    active.add(feature.id);
    for (const id of feature.dependsOn) { if (!byId.has(id)) throw new Error(`Unknown dependency ${id}.`); visit(byId.get(id)); }
    active.delete(feature.id); done.add(feature.id);
  }
  for (const [index, feature] of graph.features.entries()) {
    if (feature.number !== index + 1 || feature.id !== `QQ${String(index + 1).padStart(2, '0')}` || !feature.acceptance
      || !['planned', 'implemented', 'verified'].includes(feature.status)) throw new Error(`Invalid acceptance/state ${feature.id}.`);
    if (feature.status !== 'planned' && (!feature.artifacts.length || !feature.evaluations.length)) throw new Error(`Missing implementation/evaluator trace ${feature.id}.`);
    for (const file of [...feature.artifacts, ...feature.evaluations]) if (!fs.existsSync(resolve(file))) throw new Error(`Missing artifact ${file}.`);
    if ([46, 50].includes(feature.number) && !feature.researchStatus) throw new Error('Study implementation and human evidence must be reported separately.');
    visit(feature);
  }
}
function refresh(sourceHashes) {
  for (const feature of graph.features) {
    if (feature.status === 'planned') continue;
    const runs = feature.evaluations.map(suite => [...graph.executions].reverse().find(run => run.evaluator === suite
      && run.exitCode === 0 && run.sourceStable === true && run.evaluatorHash === hash(suite)
      && graph.sourcePaths.every(source => run.sourceHashes?.[source] === sourceHashes[source])));
    feature.status = runs.every(Boolean) ? 'verified' : 'implemented';
    feature.executionIds = runs.filter(Boolean).map(run => run.id);
  }
}
validate();
const command = process.argv[2] || 'status';
if (command === 'verify') {
  if (!graph.sourcePaths.length) throw new Error('Declare the actual implementation sources before verification.');
  const suites = [...new Set(graph.features.flatMap(feature => feature.evaluations))];
  const requested = process.argv[3];
  if (requested && !suites.includes(requested)) throw new Error('Only graph-declared evaluators may run.');
  const outputDir = path.join(root, 'output', 'quest-quality-verification'); fs.mkdirSync(outputDir, { recursive: true });
  let failed = false;
  for (const suite of requested ? [requested] : suites) {
    const sourceHashes = hashes(), started = Date.now();
    console.log(`Verifying ${suite}`);
    const result = spawnSync(process.execPath, [resolve(suite)], { cwd: root, encoding: 'utf8', timeout: suite.includes('browser') ? 600000 : 180000,
      maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    const id = `quality-${started.toString(36)}-${path.basename(suite, '.js')}`;
    const log = `output/quest-quality-verification/${id}.log`;
    fs.writeFileSync(resolve(log), `${result.stdout || ''}${result.stderr || ''}${result.error ? '\n' + result.error.message : ''}`);
    const ending = hashes(), sourceStable = graph.sourcePaths.every(source => sourceHashes[source] === ending[source]);
    graph.executions.push({ id, evaluator: suite, evaluatorHash: hash(suite), sourceHashes, sourceStable,
      startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started,
      exitCode: result.status ?? 1, log, evidenceType: 'automated_implementation_check' });
    failed ||= result.status !== 0 || !sourceStable;
    refresh(ending); save();
    console.log(`${suite}: ${result.status === 0 && sourceStable ? 'PASS' : 'FAIL'} (${log})`);
  }
  process.exitCode = failed ? 1 : 0;
} else if (['status', 'check'].includes(command)) {
  refresh(hashes());
  const counts = Object.fromEntries(['planned', 'implemented', 'verified'].map(state => [state, graph.features.filter(feature => feature.status === state).length]));
  console.log(JSON.stringify({ improvements: 50, implementation: counts,
    humanResearch: graph.features.filter(feature => [46, 50].includes(feature.number)).map(feature => ({ id: feature.id, status: feature.researchStatus })) }, null, 2));
  if (command === 'check' && counts.verified !== 50) process.exitCode = 1;
} else throw new Error('Usage: node tools/quest-quality-workgraph.js status | check | verify [test/file.js]');
