// New stories must be admitted without rewriting any previously released package.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import { loadAndValidatePhase1WorldGraph } from '../src/content/phase1-validation.js';
import { cityQuestPresentation } from '../src/content/city-quest-presentation.js';

const additions = ['first-errand-case-v2', 'crew-crosscurrent-v1'];
for (const id of additions) assert(PHASE1_WORLD_GRAPH_PACKAGES.some(pkg => pkg.id === id),
  'The production catalogue must admit ' + id);
const { report } = loadAndValidatePhase1WorldGraph();
assert.equal(report.packages, 27);
assert.equal(report.nodes, 229);
assert.equal(report.recipes, 5);
assert.equal(cityQuestPresentation('first-errand-case-v2')?.title, 'Parcel 47',
  'The current journal discovers the authored case presentation.');
const previousFiles = ['automotive-salvage.js', 'belladonna.js', 'city-world-opportunities.js',
  'company-production-quality.js', 'core-materials.js', 'district-story-arcs.js', 'equipment-recovery.js',
  'neighborhood-afterword.js', 'neighborhood-broadcast.js', 'neighborhood-initiation.js',
  'neighborhood-initiation.json', 'property-investigation.js', 'staged-crew-missions.js'];
const fs = await import('node:fs');
for (const file of previousFiles) {
  const old = execFileSync('git', ['--no-replace-objects', 'show', '0a45705bb34acb5a0a9b620802e042eaa4609259:src/content/' + file], { encoding: 'utf8', windowsHide: true });
  const current = fs.readFileSync(new URL('../src/content/' + file, import.meta.url), 'utf8');
  assert.equal(current.replaceAll('\r\n', '\n'), old, 'Released package source remains exact: ' + file);
}
console.log('city-cooperative-content PASS: both new packages admitted; all 25 previous packages retained; five recipes unchanged');
