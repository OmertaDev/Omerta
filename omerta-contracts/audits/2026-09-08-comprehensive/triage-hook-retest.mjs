import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const directory = 'omerta-contracts/audits/2026-09-08-comprehensive';
const rawDirectory = 'output/comprehensive-audit';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const pin = path => ({path, sha256: hash(fs.readFileSync(path))});
const read = path => JSON.parse(fs.readFileSync(path));
const beforePath = `${rawDirectory}/slither-OmertaHook-full.json`;
const afterPath = `${rawDirectory}/slither-OmertaHook-after.json`;
const before = read(beforePath);
const after = read(afterPath);
const sharedPath = `${directory}/shared-static-triage.json`;
const shared = read(sharedPath);
const selectionPath = `${directory}/static-run-selection.json`;
const baselineSourcePath = `${directory}/source-before.json`;
const sourcePath = 'omerta-contracts/src/OmertaHook.sol';
const source = fs.readFileSync(sourcePath, 'utf8');
const sourceLines = source.split(/\r?\n/);
const nativeCompiler = 'omerta-contracts/cache/verify/solc-0.8.26.exe';
assert(before.success && after.success, 'Static scan did not successfully complete');
assert.equal(pin(beforePath).sha256, shared.inputs.find(input => input.path === beforePath).sha256,
  'The selected pre-fix Hook output was changed');
assert.equal(pin(selectionPath).sha256, shared.inputs.find(input => input.path === selectionPath).sha256,
  'The original global selected-run inventory was changed');
const beforeDiagnostics = before.results.detectors;
const afterDiagnostics = after.results.detectors;
const semanticKey = d => `${d.check}\n${d.description.replace(/(src\/OmertaHook\.sol)#\d+(?:-\d+)?/g, '$1#LINE')}`;
const bySemanticKey = new Map();
for (const d of beforeDiagnostics) {
  const key = semanticKey(d);
  assert(!bySemanticKey.has(key), `Ambiguous normalized baseline diagnostic: ${d.id}`);
  bySemanticKey.set(key, d);
}
const direct = new Map();
const inputs = [pin(beforePath), pin(afterPath), pin(`${rawDirectory}/slither-OmertaHook-after.log`),
  pin(`${rawDirectory}/slither-OmertaHook-after.exit`), pin(`${rawDirectory}/slither-OmertaHook-after-run.json`),
  pin(sharedPath), pin(selectionPath), pin(baselineSourcePath)];
for (const group of ['core', 'market', 'acquisition']) {
  const file = `${directory}/${group}-static-triage.json`;
  inputs.push(pin(file));
  for (const [diagnosticIndex, d] of read(file).diagnostics.entries()) {
    if (d.sourceRun === 'OmertaHook') {
      assert(!direct.has(d.id), `Duplicate direct assignment ${d.id}`);
      direct.set(d.id, {group, file, diagnosticIndex, disposition: d.disposition});
    }
  }
}
const sharedById = new Map(shared.diagnostics.map(d => [d.id, d]));
const usedBaselineIds = new Set();
const mappings = afterDiagnostics.map((d, postDiagnosticIndex) => {
  const previous = bySemanticKey.get(semanticKey(d));
  assert(previous, `New unmatched post-fix diagnostic requires triage: ${d.id}`);
  assert.equal(d.impact, previous.impact, `Impact changed: ${d.id}`);
  assert.equal(d.confidence, previous.confidence, `Confidence changed: ${d.id}`);
  assert(!usedBaselineIds.has(previous.id), `Baseline diagnostic matched twice: ${previous.id}`);
  usedBaselineIds.add(previous.id);
  const existing = direct.get(previous.id);
  const imported = sharedById.get(previous.id);
  assert(existing || imported, `Missing baseline disposition: ${previous.id}`);
  return {
    id: d.id,
    sourceRun: 'OmertaHook-after',
    rawFile: afterPath,
    postDiagnosticIndex,
    check: d.check,
    reportedImpact: d.impact,
    reportedConfidence: d.confidence,
    description: d.description,
    elements: d.elements,
    baselineId: previous.id,
    baselineRawFile: beforePath,
    baselineDescription: previous.description,
    comparison: d.id === previous.id ? 'identical-diagnostic-id' : 'same-diagnostic-relocated-by-source-line-shift',
    deltaDisposition: d.id === previous.id
      ? 'Same rule, diagnostic ID, description, severity and confidence; no new static concern from this row.'
      : 'The new ID differs only because the source locations shifted. The rule, description after line normalization, severity and confidence match one unique baseline diagnostic; this is neither an added nor a resolved vulnerability.',
    baselineDispositionReference: existing
      ? {group: existing.group, path: existing.file, diagnosticIndex: existing.diagnosticIndex, id: previous.id}
      : {group: 'shared', path: sharedPath, id: previous.id},
    disposition: existing ? {rationale: existing.disposition, reviewDepth: 'Existing direct contract review'} : imported.disposition,
  };
});
assert.equal(usedBaselineIds.size, beforeDiagnostics.length, 'A baseline diagnostic was not matched in the retest');
const line = marker => {
  const index = sourceLines.findIndex(value => value.includes(marker));
  assert(index >= 0, `Missing source marker ${marker}`);
  return index + 1;
};
const guardLine = line('if (dev == address(this)');
assert(source.includes('if (dev == address(this) || rwa == address(this) || community == address(this) || lp == address(this))'));
assert(source.indexOf('if (dev == address(this)') < source.indexOf('devRecipient = dev;'));
const run = read(`${rawDirectory}/slither-OmertaHook-after-run.json`);
assert.equal(run.success, true);
assert.equal(run.diagnostics, afterDiagnostics.length);
assert.equal(run.viaIR, false);
assert.equal(run.solcArgs, '--optimize --optimize-runs 800 --evm-version cancun');
const countsByRule = {};
for (const d of mappings) countsByRule[d.check] = (countsByRule[d.check] ?? 0) + 1;
const result = {
  date: '2026-09-08',
  scope: 'Post-remediation direct-solc Slither retest of OmertaHook recipient self-address guard. Separate from the pre-fix global 1,616-diagnostic baseline.',
  source: {
    ...pin(sourcePath),
    baselineSha256: read(baselineSourcePath).files.find(file => file.path === sourcePath).sha256,
    change: 'Adds InvalidRecipient and rejects address(this) independently for each of dev/rwa/community/lp in the owner-only setRecipients, before any assignment. Other changes are explanatory comments.',
  },
  tools: {slither: '0.11.6', solc: '0.8.26+commit.8a97fa7a.Windows.msvc', compiler: pin(nativeCompiler), node: process.version},
  scan: {
    ...run,
    command: "slither src/OmertaHook.sol --compile-force-framework solc --solc cache/verify/solc-0.8.26.exe --solc-remaps '@openzeppelin/=lib/openzeppelin-contracts/ v4-core/=lib/v4-core/src/ solmate/=lib/v4-core/lib/solmate/' --solc-args '--optimize --optimize-runs 800 --evm-version cancun' --exclude-dependencies --json ../output/comprehensive-audit/slither-OmertaHook-after.json",
    environment: {PATHPrefix: 'C:/Users/Jorge/.foundry/bin', FOUNDRY_VIA_IR: 'false'},
    exitInterpretation: 'Exit -1 is retained alongside success=true and the complete 82-detector JSON. It is a diagnostic-result exit, not represented as a clean zero-exit scan.',
  },
  inputs,
  comparison: {
    baselineOccurrences: beforeDiagnostics.length,
    retestOccurrences: afterDiagnostics.length,
    identicalIds: mappings.filter(d => d.comparison === 'identical-diagnostic-id').length,
    relocatedIds: mappings.filter(d => d.comparison !== 'identical-diagnostic-id').length,
    semanticallyAddedDiagnostics: 0,
    semanticallyRemovedDiagnostics: 0,
    unassignedRetestDiagnostics: 0,
    ruleImpactConfidenceChanges: 0,
    matchingRule: 'Exact check plus exact description after normalizing only src/OmertaHook.sol#line or #start-end source-location fragments. Dependency locations remain exact. One-to-one mapping and equal severity/confidence are asserted.',
    relocatedDiagnosticMap: mappings.filter(d => d.comparison !== 'identical-diagnostic-id')
      .map(d => ({beforeId: d.baselineId, afterId: d.id, check: d.check, disposition: d.deltaDisposition})),
    originalGlobalBaselinePreserved: true,
    originalGlobalRawCount: shared.summary.rawDiagnosticOccurrences,
  },
  countsByRule,
  recipientLivenessReview: {
    method: 'Manual control/data-flow comparison of the changed setter, all four recipient assignment sites, fee enabling checks, sweep, inherited onlyOwner, and native/ERC20 transfer behavior. No additional dynamic test or compiler build in this subtask.',
    sourceLocations: {setter: line('function setRecipients('), selfGuard: guardLine, firstStorageWrite: line('devRecipient = dev;'), sweep: line('function sweep('), nativeReceiver: line('receive() external payable')},
    conclusion: 'The added guard introduces no new external call, recipient callback dependency, or swap/sweep execution branch. It rejects only a self-recipient configuration that would consume owed accounting while retaining the paid asset. All nonzero, nonself recipients remain eligible, including EOAs, contracts and repeated recipient addresses.',
    atomicity: 'onlyOwner and the existing zero-address guard execute first. All four self checks precede every recipient assignment and the RecipientsSet event, so a rejection preserves the complete previous recipient tuple. Existing ZeroAddress precedence is preserved when inputs contain both zero and self.',
    recovery: 'A receiver that rejects a native/ERC20 transfer can still fail the all-or-nothing sweep; its revert restores owed accounting. The owner can replace that recipient with another nonzero, nonself address and retry. The guard neither adds this existing receiver-liveness risk nor removes the recovery setter.',
    reachability: 'Each recipient storage variable is assigned only by this setter and starts at zero; no constructor or alternative setter introduces self. Fee arming still refuses an unset recipient. The correction prevents configuring self for the corrected immutable implementation.',
    limits: 'The guard does not recover previously trapped balances, patch already deployed immutable bytecode, verify recipients are controlled/live, prohibit duplicate recipients, or prevent a receiver from deliberately sending assets back. Those limitations are unchanged by this correction.',
  },
  diagnostics: mappings,
};
const output = `${directory}/hook-retest-static.json`;
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({output, sourceSha256: result.source.sha256, scanSuccess: run.success, exitCode: run.exitCode, comparison: result.comparison}));
