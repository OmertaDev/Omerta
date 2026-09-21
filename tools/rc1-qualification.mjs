// Release evidence is input to review, never a substitute for native or human execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

export function verifyIndex(root) {
  const index = readJson(path.join(root, 'SHA256SUMS.json'));
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
    assert(Array.isArray(manifest.sourceFiles) && manifest.sourceFiles.length > 0);
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
      const m = proof.measurements;
      assert(m && typeof m === 'object', 'Missing observed measurements');
      if (id === 'world-matrix') {
        const scenarios = get('scenario-manifest.json');
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
          assert.equal(result.source, manifest.source);
          assert.equal(result.configurationSha256, manifest.configurationSha256);
          assert.equal(result.status, 'PASS');
          assert.equal(result.exitCode, 0);
          assert.equal(result.sourceUnchanged, true);
          assert.deepEqual(result.command, gate.command);
          assert(index.has(result.log));
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
