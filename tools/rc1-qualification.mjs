// Release evidence is input to review, never a substitute for native or human execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateScenarioManifest } from './rc1-native-proof.js';

export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
export const REQUIRED_PROOFS = Object.freeze([
  'source-reconciliation', 'serial-replay', 'concurrent-replay', 'checkpoint-restart',
  'failure-injection', 'resource-conservation', 'world-matrix', 'realtime-soak',
  'authority-replay', 'browser-journeys', 'physical-devices', 'deployment',
  'recovery', 'real-cohort', 'final-regression',
]);
export const RECOVERY_CASES = Object.freeze(['fresh-bootstrap', 'existing-schema', 'partial-migration',
  'retry', 'restart', 'connection-loss', 'worker-interruption', 'transaction-rollback',
  'linux-sigterm', 'receipt-replay', 'state-reconstruction', 'code-rollback', 'backup-restore',
  'stuck-campaign', 'stuck-operation', 'bad-content', 'bad-world-mutation']);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const noExclusions = (proof) => Array.isArray(proof.coverageExclusions) && proof.coverageExclusions.length === 0;
export const CANONICAL_GATE_REGISTRY = 'docs/release/readiness-work/gate-registry.json';
const sourcePath = (file) => /^(src\/|public\/|content\/|tools\/|test\/|\.github\/workflows\/|omerta-contracts\/(src\/|test\/|foundry.toml)|schema.sql$|package(-lock)?\.json$|render.yaml$)/.test(file)
  || file === CANONICAL_GATE_REGISTRY;
const gitBytes = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const gitText = (...args) => gitBytes(...args).toString('utf8').trim();
const validSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export function sourceInventory(source) {
  assert(validSha(source), 'Invalid source revision');
  assert.equal(gitText('rev-parse', `${source}^{commit}`), source, 'Source is not a commit');
  const entries = gitBytes('ls-tree', '-rz', '--full-tree', source).toString('utf8').split('\0').filter(Boolean).map((line) => {
    const at = line.indexOf('\t'), [mode, type, blob] = line.slice(0, at).split(' ');
    return { path: line.slice(at + 1), mode, type, blob };
  }).filter((entry) => sourcePath(entry.path)).sort((a, b) => a.path.localeCompare(b.path));
  assert(entries.length > 0, 'No selected source files');
  assert(entries.every((entry) => entry.type === 'blob' && ['100644', '100755'].includes(entry.mode)), 'Source links are not supported');
  const objects = [...new Set(entries.map((entry) => entry.blob))];
  const sizes = execFileSync('git', ['cat-file', '--batch-check'], { input: `${objects.join('\n')}\n`, encoding: 'utf8' })
    .trim().split('\n').map((line) => { const [oid, type, bytes] = line.split(' '); assert.equal(type, 'blob'); return { oid, bytes: Number(bytes) }; });
  const hashes = new Map();
  for (let start = 0; start < sizes.length;) {
    const group = []; let budget = 0;
    do { const entry = sizes[start++]; group.push(entry); budget += entry.bytes + 100; }
    while (start < sizes.length && budget + sizes[start].bytes < 16 * 1024 * 1024);
    const output = execFileSync('git', ['cat-file', '--batch'], { input: `${group.map((entry) => entry.oid).join('\n')}\n`, maxBuffer: budget + 1024 });
    let offset = 0;
    for (const entry of group) {
      const end = output.indexOf(10, offset), header = output.subarray(offset, end).toString();
      assert.equal(header, `${entry.oid} blob ${entry.bytes}`);
      const bytes = output.subarray(end + 1, end + 1 + entry.bytes); offset = end + 2 + entry.bytes;
      const accepted = new Set([sha256(bytes)]), text = bytes.toString('utf8');
      if (!bytes.includes(0) && Buffer.from(text, 'utf8').equals(bytes)) {
        const lf = text.replaceAll('\r\n', '\n'); accepted.add(sha256(lf)); accepted.add(sha256(lf.replaceAll('\n', '\r\n')));
      }
      hashes.set(entry.oid, { gitSha256: sha256(bytes), accepted: [...accepted] });
    }
  }
  return { tree: gitText('rev-parse', `${source}^{tree}`), files: entries.map(({ path, blob }) => ({ path, blob, ...hashes.get(blob) })) };
}

export function validateSourceManifest(manifest) {
  assert(validSha(manifest.predecessor), 'Invalid predecessor');
  assert.equal(gitText('rev-parse', `${manifest.predecessor}^{commit}`), manifest.predecessor, 'Predecessor is not a commit');
  const expected = sourceInventory(manifest.source);
  assert.equal(manifest.tree, expected.tree, 'Source tree differs from commit');
  assert(Array.isArray(manifest.sourceFiles), 'Missing source inventory');
  const supplied = [...manifest.sourceFiles].sort((a, b) => String(a.path).localeCompare(String(b.path)));
  assert.deepEqual(supplied.map((file) => file.path), expected.files.map((file) => file.path), 'Source inventory differs from commit');
  supplied.forEach((file, index) => {
    const actual = expected.files[index];
    assert.equal(file.blob, actual.blob, `Source blob differs: ${file.path}`);
    assert.equal(file.gitSha256, actual.gitSha256, `Source blob hash differs: ${file.path}`);
    assert(actual.accepted.includes(file.sha256), `Source bytes differ from Git blob: ${file.path}`);
  });
  return expected;
}

export function validateGateRegistry(source, supplied) {
  assert(validSha(source));
  const expected = JSON.parse(gitBytes('show', `${source}:${CANONICAL_GATE_REGISTRY}`).toString('utf8'));
  assert.deepEqual(supplied, expected, 'Gate registry differs from the source-pinned canonical inventory');
  assert(Array.isArray(expected.gates) && expected.gates.length > 0);
  assert.equal(new Set(expected.gates.map((gate) => gate.id)).size, expected.gates.length, 'Duplicate gate ID');
  for (const gate of expected.gates) {
    assert(/^[a-z0-9-]+$/.test(gate.id));
    assert(Array.isArray(gate.command) && gate.command.length && gate.command.every((part) => typeof part === 'string'));
    assert(Number.isSafeInteger(gate.timeoutMs) && gate.timeoutMs > 0);
    assert(typeof (gate.cwd || '.') === 'string' && !path.isAbsolute(gate.cwd || '.') && !/^[a-z]:/i.test(gate.cwd || '.')
      && !(gate.cwd || '.').replaceAll('\\', '/').split('/').includes('..'), 'Gate cwd must stay inside source');
  }
  return expected;
}

export function validateExecutionRecord(record, id, manifest) {
  assert.equal(record.format, 1); assert.equal(record.proofId, id);
  assert.equal(record.source, manifest.source); assert.equal(record.configurationSha256, manifest.configurationSha256);
  assert.equal(record.status, 'PASS'); assert.equal(record.scope, 'full'); assert(noExclusions(record));
  assert.notEqual(record.synthetic, true, 'Synthetic records cannot qualify');
  const requiredKind = id === 'real-cohort' || id === 'physical-devices' ? 'human'
    : id === 'deployment' ? 'deployed' : 'native';
  assert.equal(record.kind, requiredKind, 'Wrong execution record kind');
  assert(Array.isArray(record.command) && record.command.length && record.command.every((part) => typeof part === 'string' && part.length));
  assert(Array.isArray(record.assertions) && record.assertions.length && record.assertions.every((item) =>
    typeof item.id === 'string' && item.id.length && item.status === 'PASS'), 'Missing passing named assertions');
  assert(Number.isFinite(Date.parse(record.startedAt)) && Number.isFinite(Date.parse(record.endedAt))
    && Date.parse(record.endedAt) >= Date.parse(record.startedAt), 'Invalid execution timestamps');
  if (requiredKind === 'native') {
    assert.equal(record.exitCode, 0); assert.equal(record.database, 'postgresql');
    assert.equal(record.timedOut, false); assert.equal(record.signal, null); assert.equal(record.launchError, null);
  }
  // Schema validation cannot independently establish human identities or the truth
  // of operator attestations; review and retained primary artifacts remain required.
}

// Check both lexical and real paths: a symlink or junction may escape an evidence root.
export function evidencePath(root, relative) {
  assert(typeof relative === 'string' && relative.length && !relative.includes('\\')
    && !path.isAbsolute(relative) && !/^[a-z]:/i.test(relative), 'Invalid evidence path');
  assert(relative.split('/').every((part) => part && part !== '.' && part !== '..'), 'Invalid evidence path');
  const base = fs.realpathSync(root);
  const full = fs.realpathSync(path.resolve(base, relative));
  assert(full.startsWith(base + path.sep), 'Evidence reference escapes its root');
  assert(fs.statSync(full).isFile(), 'Evidence reference must be a file');
  return full;
}

export function validateGateResult(result, gate, manifest, root, index) {
  assert.equal(result.format, 1); assert.equal(result.id, gate.id);
  assert.equal(result.source, manifest.source); assert.equal(result.configurationSha256, manifest.configurationSha256);
  assert.equal(result.status, 'PASS'); assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false); assert.equal(result.launchError, null); assert.equal(result.signal, null);
  assert.equal(result.sourceUnchanged, true); assert.equal(result.sourceError, null);
  assert.deepEqual(result.command, gate.command); assert.equal(result.cwd, gate.cwd || '.');
  assert.equal(result.scope, gate.scope || 'regression'); assert.deepEqual(result.coverageExclusions, gate.coverageExclusions || []);
  assert.equal(result.log, `gates/${gate.id}/output.txt`); assert(index.has(result.log));
  assert.equal(sha256(fs.readFileSync(evidencePath(root, result.log))), result.logSha256, 'Gate log differs from captured hash');
}

export function verifyIndex(root) {
  const index = readJson(evidencePath(root, 'SHA256SUMS.json'));
  assert.equal(index.format, 1);
  assert(Array.isArray(index.files) && index.files.length > 0, 'Empty evidence index');
  const files = new Map();
  for (const entry of index.files) {
    assert(!files.has(entry.path), `Duplicate evidence path: ${entry.path}`);
    assert(entry.path !== 'SHA256SUMS.json', 'Index cannot hash itself');
    assert(/^[a-f0-9]{64}$/.test(entry.sha256), 'Invalid SHA256');
    const bytes = fs.readFileSync(evidencePath(root, entry.path));
    assert.equal(bytes.length, entry.bytes, `Size mismatch: ${entry.path}`);
    assert.equal(sha256(bytes), entry.sha256, `Hash mismatch: ${entry.path}`);
    files.set(entry.path, entry);
  }
  return files;
}

export function indexEvidence(root) {
  const files = [];
  const walk = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, item.name);
      assert(!item.isSymbolicLink(), 'Do not package symbolic links');
      if (item.isDirectory()) walk(absolute);
      else {
        const relative = path.relative(root, absolute).replaceAll('\\', '/');
        if (relative === 'SHA256SUMS.json') continue;
        const bytes = fs.readFileSync(evidencePath(root, relative));
        files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
      }
    }
  };
  walk(root);
  assert(files.length, 'Cannot seal an empty evidence package');
  const index = { format: 1, algorithm: 'SHA256', files: files.sort((a, b) => a.path.localeCompare(b.path)) };
  fs.writeFileSync(path.join(root, 'SHA256SUMS.json'), JSON.stringify(index, null, 2) + '\n');
  return index;
}

export function qualify(root) {
  const open = [];
  let index;
  try { index = verifyIndex(root); }
  catch (error) { return { state: 'NOT RELEASE READY', open: [{ id: 'evidence-integrity', reason: error.message }] }; }
  const get = (relative) => {
    assert(index.has(relative), `Unindexed evidence: ${relative}`);
    return readJson(evidencePath(root, relative));
  };
  let manifest;
  try {
    manifest = get('candidate.json');
    assert.equal(manifest.format, 1);
    assert.match(manifest.source, /^[a-f0-9]{40}$/);
    assert.match(manifest.predecessor, /^[a-f0-9]{40}$/);
    assert.equal(manifest.cleanTree, true, 'Candidate must be frozen from a clean checkout');
    assert.match(manifest.configurationSha256, /^[a-f0-9]{64}$/);
    assert.equal(sha256(fs.readFileSync(evidencePath(root, 'configuration.json'))), manifest.configurationSha256);
    assert(index.has('configuration.json'));
    assert.equal(sha256(fs.readFileSync(evidencePath(root, 'gate-registry.json'))), manifest.gateRegistrySha256,
      'Gate registry does not match frozen candidate');
    validateSourceManifest(manifest);
    validateGateRegistry(manifest.source, get('gate-registry.json'));
    assert(manifest.requiredProofs?.length === REQUIRED_PROOFS.length
      && REQUIRED_PROOFS.every((id) => manifest.requiredProofs.includes(id)), 'Required proof inventory changed');
  } catch (error) { return { state: 'NOT RELEASE READY', open: [{ id: 'candidate', reason: error.message }] }; }

  for (const id of REQUIRED_PROOFS) {
    try {
      const proof = get(`proofs/${id}.json`);
      assert.equal(proof.id, id);
      assert.equal(proof.source, manifest.source, 'Proof source differs from candidate');
      assert.equal(proof.configurationSha256, manifest.configurationSha256, 'Proof configuration differs');
      assert.equal(proof.status, 'PASS', 'Required proof has not passed');
      assert.equal(proof.scope, 'full', 'Scoped evidence cannot clear a full gate');
      assert(noExclusions(proof), 'Required proof has coverage exclusions');
      assert(typeof proof.owner === 'string' && proof.owner.trim(), 'Missing responsible owner');
      assert(typeof proof.reviewedBy === 'string' && proof.reviewedBy.trim(), 'Missing evidence review');
      assert(Array.isArray(proof.artifacts) && proof.artifacts.length, 'Missing execution artifacts');
      for (const artifact of proof.artifacts) {
        assert(!artifact.startsWith('proofs/'), 'A proof declaration is not execution evidence');
        assert(index.has(artifact), `Missing execution artifact: ${artifact}`);
      }
      const executionRecords = proof.artifacts.filter((artifact) => typeof artifact === 'string'
        && artifact.startsWith(`runs/${id}/`) && artifact.endsWith('.json'));
      assert(executionRecords.length > 0, 'Missing typed execution record under runs/<proof-id>/');
      for (const artifact of executionRecords) validateExecutionRecord(get(artifact), id, manifest);
      const m = proof.measurements;
      assert(m && typeof m === 'object', 'Missing observed measurements');
      if (id === 'world-matrix') {
        const scenarios = get('scenario-manifest.json');
        validateScenarioManifest(scenarios);
        assert.equal(sha256(fs.readFileSync(evidencePath(root, 'scenario-manifest.json'))), manifest.scenarioManifestSha256);
        assert.equal(scenarios.requiredRuns, 225);
        assert.equal(scenarios.cells.length, 225);
        const key = (r) => `${r.scenarioId}/${r.population}/${r.seed}`;
        const expected = new Set(scenarios.cells.map(key));
        assert.equal(expected.size, 225);
        assert.deepEqual([...new Set(scenarios.cells.map((r) => r.population))].sort((a, b) => a - b), [25, 100, 250, 500, 1000]);
        assert.equal(new Set(scenarios.cells.map((r) => r.scenarioId)).size, 15);
        assert.equal(new Set(scenarios.cells.map((r) => r.seed)).size, 3);
        assert.equal(m.runs?.length, 225);
        assert.equal(new Set(m.runs.map(key)).size, 225, 'Duplicate matrix run');
        for (const run of m.runs) {
          assert(expected.has(key(run)), 'Unexpected matrix cell');
          assert.equal(run.database, 'postgresql');
          assert.equal(run.status, 'PASS');
          assert.equal(run.source, manifest.source);
          assert.equal(run.configurationSha256, manifest.configurationSha256);
          assert(noExclusions(run));
          assert(finite(run.logicalDays) && run.logicalDays >= 90);
          assert(run.seasonalRollovers >= 2 && run.longestLifecycleExecutions >= 2);
          assert.equal(run.conservationFailures, 0);
          assert.equal(run.authorizationFailures, 0);
          assert.equal(run.invariantFailures, 0);
          assert.equal(run.unresolvedDeadWorlds, 0);
          assert.equal(run.metricsComplete, true);
          assert(index.has(run.artifact), 'Missing matrix execution record');
        }
      } else if (id === 'realtime-soak') {
        assert(finite(m.durationHours) && m.durationHours >= 12);
        assert(m.distinctActors >= 1000 && m.participatingActors >= 1000 && m.minActiveActorsPerHour >= 250);
        assert(m.maxInflight >= 100);
        assert(finite(m.readP95Ms) && m.readP95Ms <= 500);
        assert(finite(m.commandP95Ms) && m.commandP95Ms <= 1500);
        assert(finite(m.commandP99Ms) && m.commandP99Ms <= 3000);
        assert(finite(m.unexpectedFailureRate) && m.unexpectedFailureRate < 0.001);
        for (const field of ['arrivalRate', 'queueTime', 'completedRate', 'resourceEnvelope']) assert(m[field] != null);
        assert.equal(m.faultCasesComplete, true);
        assert.equal(m.backlogRecoveryPassed, true);
      } else if (id === 'resource-conservation') {
        assert.equal(m.resourceCategories, 13);
        assert.equal(m.openGaps, 0);
        assert.equal(m.unexplainedDrift, '0');
        assert.equal(m.duplicateValue, '0');
        assert.equal(m.missingDispositions, 0);
        assert.equal(m.allTransitionsNativeAndSimulation, true);
        assert.equal(m.allRequiredNonzeroCasesRan, true);
        assert.equal(m.contractScopeAttested, true);
      } else if (id === 'physical-devices') {
        for (const [os, browser] of [['iOS', 'Safari'], ['Android', 'Chrome']]) {
          assert(m.devices?.some((d) => d.physical === true && d.os === os && d.browser === browser
            && d.device && d.osVersion && d.browserVersion && d.providerVersions
            && d.criticalPathsPassed === true), `Missing physical ${os}/${browser}`);
        }
      } else if (id === 'browser-journeys') {
        assert([320, 360, 390, 430].every((width) => m.widths?.includes(width)));
        assert(['A', 'B', 'C', 'D', 'E'].every((journey) => m.journeys?.includes(journey)));
        for (const field of ['naturalEntry', 'interveningChanges', 'normalSocialEntry', 'stressAndPagination',
          'failureStates', 'visibleConsequences', 'touchTargets44px', 'lostCommittedResponse']) assert.equal(m[field], true);
      } else if (id === 'deployment') {
        assert.equal(m.apiSource, manifest.source);
        assert.equal(m.workerSource, manifest.source);
        assert.equal(m.configurationSha256, manifest.configurationSha256);
        for (const field of ['isolated', 'uninvitedApiDenied', 'migrationsVerified', 'flagsVerified',
          'integrationsVerified', 'alertsDelivered', 'diagnosticPrivacyVerified']) assert.equal(m[field], true);
        assert(m.workspace && m.services && m.database && m.operator);
      } else if (id === 'recovery') {
        assert.equal(m.predecessor, manifest.predecessor, 'Rollback predecessor differs');
        assert.equal(m.platform, 'linux');
        assert(RECOVERY_CASES.every((name) => m.cases?.some((c) => c.name === name && c.status === 'PASS'
          && c.conservationPassed === true && index.has(c.artifact))));
        assert(finite(m.restoreMinutes) && m.restoreMinutes <= 30);
        assert.equal(m.acknowledgedWritesLostOnRestartOrCodeRollback, 0);
        assert(finite(m.backupRecoveryPointSeconds) && m.backupRecoveryPointSeconds >= 0);
        assert.equal(m.separateRestoreDatabase, true);
      } else if (id === 'real-cohort') {
        assert.equal(m.participantKind, 'real-consenting-humans');
        assert(m.participants >= 30 && m.unfamiliarPlayers >= 20 && m.mobileFirst >= 10);
        assert(m.consecutiveDays >= 7 && m.competingFamiliesWithFiveRealMembers >= 2);
        assert.equal(m.observedUnfamiliarDenominator, 20);
        assert(m.uncoachedActionWithin5Minutes >= 16 && m.uncoachedActionWithin15Minutes >= 18);
        assert(m.consequenceAndNextObjective >= 18 && m.voluntaryLaterDayReturns >= 10);
        assert(['A', 'B', 'C', 'D', 'E'].every((j) => m.independentJourneyCompletions?.[j] >= 3));
        assert(m.finalCandidateHours >= 72);
        assert.equal(m.unresolvedP0, 0);
        assert.equal(m.unresolvedP1, 0);
        for (const rate of ['dayOneReturn', 'daySevenReturn']) {
          assert(finite(m[rate]?.denominator) && m[rate].denominator > 0);
          assert(finite(m[rate]?.numerator) && m[rate].numerator >= 0 && m[rate].numerator <= m[rate].denominator);
          assert.equal(m[rate].observationWindowComplete, true);
        }
      } else if (id === 'authority-replay') {
        assert.equal(m.uncoveredRoutes, 0);
        assert.equal(m.uncoveredCommandFamilies, 0);
        assert.equal(m.unresolvedCriticalOrHigh, 0);
        assert.equal(m.roleCommandMatrixComplete, true);
        assert.equal(m.securityPolicyReviewComplete, true);
      } else if (id === 'final-regression') {
        const registry = get('gate-registry.json');
        assert(registry.gates?.length > 0);
        for (const gate of registry.gates) {
          const result = get(`gates/${gate.id}/result.json`);
          validateGateResult(result, gate, manifest, root, index);
        }
        assert.equal(m.fullFoundryBudget, true);
        assert.equal(m.allRequiredLanesComplete, true);
      } else {
        assert.equal(m.executed, true);
        assert.equal(m.assertionsPassed, true);
      }
    } catch (error) { open.push({ id, reason: error.message }); }
  }
  return { source: manifest.source, state: open.length ? 'NOT RELEASE READY' : 'RELEASE READY', open };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [mode, destination] = process.argv.slice(2);
  assert(destination, `Usage: node ${path.basename(fileURLToPath(import.meta.url))} <index|verify|qualify> <directory>`);
  const root = path.resolve(destination);
  if (mode === 'index') console.log(JSON.stringify({ files: indexEvidence(root).files.length }));
  else if (mode === 'verify') console.log(JSON.stringify({ status: 'PASS_INTEGRITY_ONLY', files: verifyIndex(root).size }));
  else if (mode === 'qualify') {
    const result = qualify(root);
    console.log(JSON.stringify(result, null, 2));
    if (result.state !== 'RELEASE READY') process.exitCode = 1;
  } else throw new Error('Unknown mode');
}
