#!/usr/bin/env node
// The requested work graph ties each proposal to code, acceptance checks and bounded runs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graphPath = path.join(root, 'docs', 'questing-workgraph.json');
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const command = process.argv[2] || 'status';
const absolute = relative => {
  const resolved = path.resolve(root, relative), checked = path.relative(root, resolved);
  if (!checked || checked.startsWith('..') || path.isAbsolute(checked)) throw new Error(`Invalid graph artifact: ${relative}`);
  return resolved;
};
// Git checks text out as CRLF on Windows and LF in CI; both represent the same source.
const hash = relative => crypto.createHash('sha256').update(fs.readFileSync(absolute(relative), 'utf8').replace(/\r\n?/g, '\n')).digest('hex');
const save = () => fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2) + '\n');
const sourceHashes = () => Object.fromEntries(graph.sourcePaths.map(source => [source, hash(source)]));
function validate() {
  if (graph.features.length !== 40) throw new Error('The graph must retain all forty approved improvements.');
  const ids = new Set(graph.features.map(feature => feature.id));
  if (ids.size !== 40) throw new Error('Duplicate feature id.');
  const visited = new Set(), active = new Set();
  function visit(feature) {
    if (active.has(feature.id)) throw new Error(`Dependency cycle at ${feature.id}`);
    if (visited.has(feature.id)) return;
    active.add(feature.id);
    for (const dependency of feature.dependsOn) {
      if (!ids.has(dependency)) throw new Error(`${feature.id} has missing dependency ${dependency}`);
      visit(graph.features.find(item => item.id === dependency));
    }
    active.delete(feature.id); visited.add(feature.id);
  }
  for (const feature of graph.features) {
    if (!feature.acceptance || !['planned', 'implemented', 'verified'].includes(feature.status)) throw new Error(`Invalid acceptance/state: ${feature.id}`);
    if (feature.status !== 'planned' && (!feature.artifacts.length || !feature.evaluations.length)) throw new Error(`${feature.id} has no implementation/evaluator trace`);
    for (const file of [...feature.artifacts, ...feature.evaluations]) if (!fs.existsSync(absolute(file))) throw new Error(`${feature.id} references missing ${file}`);
    visit(feature);
  }
}
function currentPass(suite, hashes) {
  const latest = [...graph.executions].reverse().find(run => run.evaluator === suite && run.sourceStable !== false
    && run.evaluatorHash === hash(suite)
    && graph.sourcePaths.every(source => run.sourceHashes?.[source] === hashes[source]));
  return latest?.exitCode === 0 ? latest : null;
}
function refresh(hashes) {
  for (const feature of graph.features) {
    if (feature.status === 'planned') continue;
    const runs = feature.evaluations.map(suite => currentPass(suite, hashes));
    feature.status = runs.every(Boolean) ? 'verified' : 'implemented';
    feature.executionIds = runs.filter(Boolean).map(run => run.id);
  }
}
validate();
if (command === 'verify') {
  const requested = process.argv[3];
  const suites = [...new Set(graph.features.flatMap(feature => feature.evaluations))];
  if (requested && !suites.includes(requested)) throw new Error('Only graph-declared evaluators may execute.');
  const runSuites = requested ? [requested] : suites;
  const directory = path.join(root, 'output', 'questing-verification'); fs.mkdirSync(directory, { recursive: true });
  let failed = false;
  for (const suite of runSuites) {
    const hashes = sourceHashes();
    console.log(`Running ${suite}`);
    const started = Date.now();
    const result = spawnSync(process.execPath, [absolute(suite)], { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
    const output = `${result.stdout || ''}${result.stderr || ''}${result.error ? '\n' + result.error.message : ''}`;
    const id = `quest-${started.toString(36)}-${path.basename(suite, '.js')}`;
    const logPath = `output/questing-verification/${id}.log`;
    fs.writeFileSync(absolute(logPath), output);
    const endingHashes = sourceHashes();
    const sourceStable = graph.sourcePaths.every(source => hashes[source] === endingHashes[source]);
    const exitCode = result.status ?? -1;
    graph.executions.push({ id, evaluator: suite, command: `node ${suite}`, startedAt: new Date(started).toISOString(),
      elapsedMs: Date.now() - started, exitCode, baselineRevision: graph.baselineRevision, evaluatorHash: hash(suite),
      sourceHashes: hashes, sourceStable, outputPath: logPath, outputHash: crypto.createHash('sha256').update(output).digest('hex') });
    refresh(endingHashes); save();
    console.log(`${exitCode === 0 ? 'PASS' : 'FAIL'} ${suite} (${Date.now() - started}ms)`);
    if (exitCode !== 0) { failed = true; console.error(output.slice(-6000)); }
    if (!sourceStable) { failed = true; console.error(`Source changed during ${suite}; its result cannot verify a pinned revision.`); }
  }
  refresh(sourceHashes()); save();
  if (failed) process.exitCode = 1;
} else if (command === 'check') {
  const hashes = sourceHashes();
  for (const feature of graph.features.filter(feature => feature.status === 'verified')) {
    if (feature.evaluations.some(suite => !currentPass(suite, hashes))) throw new Error(`${feature.id} verification is stale for the current source`);
  }
  console.log(`Quest work graph valid: ${graph.features.filter(feature => feature.status === 'verified').length}/40 verified; every implementation has artifact/evaluator provenance.`);
  if (process.argv.includes('--complete') && graph.features.some(feature => feature.status !== 'verified')) process.exitCode = 1;
} else if (command === 'status' || command === 'next') {
  const features = command === 'next' ? graph.features.filter(feature => feature.status !== 'verified'
    && feature.dependsOn.every(dependency => graph.features.find(item => item.id === dependency).status === 'verified')) : graph.features;
  for (const feature of features) console.log(`${feature.id} ${feature.status.padEnd(11)} ${feature.title}`);
} else throw new Error('usage: questing-workgraph.js status|next|check [--complete]|verify [test/file.js]');
