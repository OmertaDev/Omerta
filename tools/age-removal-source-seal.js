// Explicit maintainer generation only; never invoked by runtime or a source guard.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ageRemovalSourceDataBytes } from './age-removal-source-transfer.js';

const predecessor = '35913ec1b448275b227019ede2a2ef8047be55aa';
const metadata = 'tools/age-removal-source-data.js';
// Independently generated data is verified by its existing knowledge/native gates.
// None receives historical qualification or inherited execution results here.
const generated = new Set([metadata, 'tools/enterprise-native-questing-inputs.js',
  'knowledge/generated/documents.md', 'knowledge/generated/github-history.md',
  'knowledge/generated/graph-summary.md', 'knowledge/generated/graph.json',
  'knowledge/generated/graph.mmd', 'knowledge/generated/inventory.md',
  'knowledge/generated/modules.md', 'knowledge/generated/routes.md',
  'docs/questing-workgraph.json',
  'docs/quest-quality-workgraph.json',
  'output/quest-quality-verification/quality-mw8vf9xg-quest-quality-content.log',
  'output/quest-quality-verification/quality-mw8vfgz6-quest-quality-rules.log',
  'output/quest-quality-verification/quality-mw8vfhcd-quest-quality-studio.log',
  'output/quest-quality-verification/quality-mw8vfif6-quest-quality-runtime.log',
  'output/quest-quality-verification/quality-mw8vfmcd-quest-quality-api.log',
  'output/quest-quality-verification/quality-mw8vfpu0-quest-quality-browser.log',
  'output/quest-quality-verification/quality-mw8vg4l8-quest-quality-postgres.log',
  'output/quest-quality-verification/quality-mw8vgahb-quest-quality-stateful.log',
  'output/quest-quality-verification/quality-mw8vgb95-quest-quality-social.log',
  'output/quest-quality-verification/quality-mw8vgevf-quest-quality-spoilers.log',
  'output/quest-quality-verification/quality-mw8vghub-quest-quality-study.log',
  'output/questing-verification/quest-mw8vef9e-quest-saga.log',
  'output/questing-verification/quest-mw8veko0-content-narrative-security.log',
  'output/questing-verification/quest-mw8velju-quest-specialist.log',
  'output/questing-verification/quest-mw8veqlj-clue-puzzles.log',
  'output/questing-verification/quest-mw8veuzj-clue-puzzles-browser.log',
  'output/questing-verification/quest-mw8vf1am-content-narrative.log',
  'output/questing-verification/quest-mw8vf4r5-quest-experience-browser.log',
  'output/questing-verification/quest-mw8vfj0s-content-api.log',
  'output/questing-verification/quest-mw8vfk8n-quest-saga-social.log',
  'output/questing-verification/quest-mw8vfoh3-content-casework.log',
  'output/questing-verification/quest-mw8vfry3-quest-workshop.log',
  // Retained UI evidence is historical only; combined execution is verified afresh.
  "output/quest-quality-verification/quality-mw8t5267-quest-quality-content.log",
  "output/quest-quality-verification/quality-mw8t59jg-quest-quality-rules.log",
  "output/quest-quality-verification/quality-mw8t59yz-quest-quality-studio.log",
  "output/quest-quality-verification/quality-mw8t5b1g-quest-quality-runtime.log",
  "output/quest-quality-verification/quality-mw8t5ewy-quest-quality-api.log",
  "output/quest-quality-verification/quality-mw8t5i9u-quest-quality-browser.log",
  "output/quest-quality-verification/quality-mw8t5xh4-quest-quality-postgres.log",
  "output/quest-quality-verification/quality-mw8t63je-quest-quality-stateful.log",
  "output/quest-quality-verification/quality-mw8t64dc-quest-quality-social.log",
  "output/quest-quality-verification/quality-mw8t68am-quest-quality-spoilers.log",
  "output/quest-quality-verification/quality-mw8t6bdw-quest-quality-study.log",
  "output/questing-verification/quest-mw8t3sas-quest-saga.log",
  "output/questing-verification/quest-mw8t3y65-content-narrative-security.log",
  "output/questing-verification/quest-mw8t3z9b-quest-specialist.log",
  "output/questing-verification/quest-mw8t44wz-clue-puzzles.log",
  "output/questing-verification/quest-mw8t49lu-clue-puzzles-browser.log",
  "output/questing-verification/quest-mw8t4gez-content-narrative.log",
  "output/questing-verification/quest-mw8t4k51-quest-experience-browser.log",
  "output/questing-verification/quest-mw8t4yze-content-api.log",
  "output/questing-verification/quest-mw8t507p-quest-saga-social.log",
  "output/questing-verification/quest-mw8t54fa-content-casework.log",
  "output/questing-verification/quest-mw8t587k-quest-workshop.log",
  // Fresh combined-source executions; results remain independently verified.
  "output/questing-verification/quest-mw94kkne-quest-saga.log",
  "output/questing-verification/quest-mw94kqf9-content-narrative-security.log",
  "output/questing-verification/quest-mw94kre8-quest-specialist.log",
  "output/questing-verification/quest-mw94kx86-clue-puzzles.log",
  "output/questing-verification/quest-mw94l2gh-clue-puzzles-browser.log",
  "output/questing-verification/quest-mw94l9yw-content-narrative.log",
  "output/questing-verification/quest-mw94ldtx-quest-experience-browser.log",
  "output/questing-verification/quest-mw94lul9-content-api.log",
  "output/questing-verification/quest-mw94lw0f-quest-saga-social.log",
  "output/questing-verification/quest-mw94m13d-content-casework.log",
  "output/questing-verification/quest-mw94m4xu-quest-workshop.log",
  "output/quest-quality-verification/quality-mw94kwb4-quest-quality-content.log",
  "output/quest-quality-verification/quality-mw94l3nq-quest-quality-rules.log",
  "output/quest-quality-verification/quality-mw94l42g-quest-quality-studio.log",
  "output/quest-quality-verification/quality-mw94l51q-quest-quality-runtime.log",
  "output/quest-quality-verification/quality-mw94l9co-quest-quality-api.log",
  "output/quest-quality-verification/quality-mw94lcx8-quest-quality-browser.log",
  "output/quest-quality-verification/quality-mw94luls-quest-quality-postgres.log",
  "output/quest-quality-verification/quality-mw94m217-quest-quality-stateful.log",
  "output/quest-quality-verification/quality-mw94m33l-quest-quality-social.log",
  "output/quest-quality-verification/quality-mw94m79t-quest-quality-spoilers.log",
  "output/quest-quality-verification/quality-mw94mag6-quest-quality-study.log",
  // Re-executed after the quest disclosure race repair; no inherited runtime results.
  "output/questing-verification/quest-mw95fvn8-quest-saga.log",
  "output/questing-verification/quest-mw95g1vy-content-narrative-security.log",
  "output/questing-verification/quest-mw95g2ym-quest-specialist.log",
  "output/questing-verification/quest-mw95g8gp-clue-puzzles.log",
  "output/questing-verification/quest-mw95gd8w-clue-puzzles-browser.log",
  "output/questing-verification/quest-mw95gkbe-content-narrative.log",
  "output/questing-verification/quest-mw95go95-quest-experience-browser.log",
  "output/questing-verification/quest-mw95h4c7-content-api.log",
  "output/questing-verification/quest-mw95h5mq-quest-saga-social.log",
  "output/questing-verification/quest-mw95h9vw-content-casework.log",
  "output/questing-verification/quest-mw95hdcd-quest-workshop.log",
  "output/quest-quality-verification/quality-mw95fwdp-quest-quality-content.log",
  "output/quest-quality-verification/quality-mw95g3m2-quest-quality-rules.log",
  "output/quest-quality-verification/quality-mw95g3zd-quest-quality-studio.log",
  "output/quest-quality-verification/quality-mw95g4wk-quest-quality-runtime.log",
  "output/quest-quality-verification/quality-mw95g8q0-quest-quality-api.log",
  "output/quest-quality-verification/quality-mw95gc3d-quest-quality-browser.log",
  "output/quest-quality-verification/quality-mw95grhg-quest-quality-postgres.log",
  "output/quest-quality-verification/quality-mw95gyfv-quest-quality-stateful.log",
  "output/quest-quality-verification/quality-mw95gzjg-quest-quality-social.log",
  "output/quest-quality-verification/quality-mw95h410-quest-quality-spoilers.log",
  "output/quest-quality-verification/quality-mw95h79m-quest-quality-study.log",
]);
const allowed = new Set([
  // Release-gate regression repair: native quest disclosure state survives refetch repaint.
  'public/ux-quests.js', 'test/quest-experience-browser.js',
  // The approved combined release includes the complete noir UI source and build inputs.
  "package-lock.json",
  "package.json",
  "public/noir-landing.css",
  "public/noir-shell.js",
  "public/noir-ui.css",
  "public/strategy-command.css",
  "public/strategy-command.js",
  "public/sw.js",
  "public/vendor/strategy-city-renderer.LICENSE.txt",
  "public/vendor/strategy-city-renderer.js",
  "public/vendor/strategy-city-renderer.js.LEGAL.txt",
  "src/client-shell.js",
  "test/lib/city-afterword-browser.js",
  "test/lib/ux-disclosure-browser.js",
  "test/lib/ux-opening-live-browser.js",
  "test/noir-shell-browser.js",
  "test/player-intel-browser.js",
  "test/strategy-command-browser.js",
  "test/ux-community-browser.js",
  "test/ux-coordination-browser.js",
  "test/ux-expanded-browser.js",
  "test/ux-experience-browser.js",
  "test/ux-personality-browser.js",
  "test/ux-shell-browser.js",
  "test/ux-story-browser.js",
  "test/ux-tactics-browser.js",
  "tools/build-strategy-city.mjs",
  "tools/strategy-city-scene.mjs",
  'AGENTS.md', 'SPEC.md', 'docs/legal-security-setup.md', 'omerta-mcp/README.md', 'omerta-mcp/index.js',
  'public/index.html', 'public/invite.html', 'src/agentgateway.js', 'src/auth.js', 'src/legal.js', 'src/server.js',
  'test/age.js', 'test/agent-onboarding.js', 'test/auth-fixture.js', 'test/client-shell-browser.js',
  'test/customerlayaway-integration.js',
  'test/gates.js', 'test/hardening.js', 'test/launch-invites-browser.js', 'test/legal-security.js',
  'test/genesis-fee-readiness-source-transfer.js',
  'test/rc1-mobile-postgres.js', 'test/routes.js', 'test/server-fixture.js', 'test/site-entry-browser.js',
  'tools/agent-alpha.js', 'tools/mobile.js', 'tools/public-ui.js', 'tools/rc1-mobile-journeys.js',
  'tools/site-basics-source-transfer.js', 'test/site-basics-source-transfer.js',
  'tools/quest-quality-source-transfer.js', 'test/quest-quality-source-transfer.js', 'test/lib/ux-journeys.js',
  'test/lib/rc1-historical-source-fixture.js',
  'tools/age-removal-source-transfer.js', 'tools/age-removal-source-seal.js', 'test/lib/age-removal-source-transfer-proof.js',
]);
const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = text => createHash('sha256').update(text).digest('hex');
function regular(revision, file) {
  const match = git('ls-tree', revision, '--', file).trim().match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(match && match[3] === file, 'Regular committed source required: ' + file);
  const text = git('show', revision + ':' + file);
  assert(!/[\r\0\ufeff]/.test(text), 'Whole committed LF UTF-8 source required');
  return { text, pin: { mode: match[1], blob: match[2], sha256: sha(text), bytes: Buffer.byteLength(text) } };
}
function inverses(current, diff) {
  const rows = [], starts = [0]; let row;
  for (let at = 0; at < current.length; at++) if (current[at] === '\n') starts.push(at + 1);
  for (const line of diff.split('\n')) {
    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (match) { row = { at: starts[Number(match[1]) - 1] ?? 0, current: '', baseline: '' }; rows.push(row); }
    else if (row && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') row.current += line.slice(1) + '\n';
      if (line[0] !== '+') row.baseline += line.slice(1) + '\n';
    }
  }
  assert(rows.length); return rows;
}
assert.equal(process.argv.length, 3, 'Usage: node tools/age-removal-source-seal.js <clean-reviewed-commit>');
const revision = process.argv[2]; assert.match(revision || '', /^[a-f0-9]{40}$/);
assert.equal(git('rev-parse', 'HEAD').trim(), revision);
assert.equal(git('status', '--porcelain', '--untracked-files=all').trim(), '', 'Commit all reviewed age-removal source before sealing');
git('merge-base', '--is-ancestor', predecessor, revision);
const changed = git('diff', '--name-status', '--no-renames', predecessor, revision).trim().split('\n')
  .filter(Boolean).map(line => line.split('\t')).filter(([, file]) => !generated.has(file));
assert(changed.length && changed.every(([status, file]) => ['M', 'A'].includes(status) && allowed.has(file)),
  'Only the reviewed closed age-removal source scope; no deletions or unrelated changes');
const value = { status: 'SEALED', phase: 'EXACT_AGE_REMOVAL_SOURCE_COMPARISON_ONLY', revision,
  tree: git('rev-parse', revision + '^{tree}').trim(), predecessor,
  predecessorTree: git('rev-parse', predecessor + '^{tree}').trim(), files: {}, additions: {} };
for (const [status, file] of changed) {
  const after = regular(revision, file);
  if (status === 'A') { value.additions[file] = after.pin; continue; }
  const before = regular(predecessor, file), rows = inverses(after.text,
    git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file));
  let restored = after.text;
  for (const row of rows.toReversed()) {
    assert.equal(restored.slice(row.at, row.at + row.current.length), row.current, file);
    restored = restored.slice(0, row.at) + row.baseline + restored.slice(row.at + row.current.length);
  }
  assert.equal(restored, before.text, 'Whole reviewed predecessor reconstruction: ' + file);
  value.files[file] = { current: after.pin, baseline: before.pin, inverses: rows };
}
fs.writeFileSync(new URL('./age-removal-source-data.js', import.meta.url), ageRemovalSourceDataBytes(value));
console.log(JSON.stringify({ authoredRevision: revision, comparisonDomains: Object.keys(value.files).length,
  additions: Object.keys(value.additions).length, sourceOnly: true, nativeExecution: false, priorResultsTransferred: false }));
