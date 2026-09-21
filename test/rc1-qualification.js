// Negative evidence tests use synthetic records only; these are never release proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REQUIRED_PROOFS, evidencePath, indexEvidence, verifyIndex, qualify, sha256 } from '../tools/rc1-qualification.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-rc1-evidence-test-'));
const write = (relative, value) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const source = 'a'.repeat(40), config = { test: 'synthetic-verifier-test-only' };
let assertions = 0;
const check = (fn) => { fn(); assertions++; };
try {
  write('configuration.json', config);
  write('gate-registry.json', { gates: [{ id: 'synthetic', command: ['node', 'test-only'] }] });
  const manifest = { format: 1, source, predecessor: 'b'.repeat(40), cleanTree: true,
    configurationSha256: sha256(fs.readFileSync(path.join(root, 'configuration.json'))),
    gateRegistrySha256: sha256(fs.readFileSync(path.join(root, 'gate-registry.json'))),
    requiredProofs: REQUIRED_PROOFS, sourceFiles: [{ path: 'test-only', sha256: 'a'.repeat(64) }] };
  write('candidate.json', manifest);
  write('run.json', { synthetic: true });
  indexEvidence(root);
  check(() => assert.equal(verifyIndex(root).size, 4));
  check(() => assert.equal(qualify(root).state, 'NOT RELEASE READY'));
  check(() => assert.equal(qualify(root).open.length, REQUIRED_PROOFS.length));
  fs.appendFileSync(path.join(root, 'run.json'), ' ');
  check(() => assert.throws(() => verifyIndex(root), /mismatch/));
  check(() => assert.equal(qualify(root).open[0].id, 'evidence-integrity'));
  indexEvidence(root);
  for (const name of ['../run.json', '/run.json', 'C:/run.json', 'proofs/../run.json', 'proofs\\run.json']) {
    check(() => assert.throws(() => evidencePath(root, name), /Invalid evidence path/));
  }
  const proof = { id: 'serial-replay', source, configurationSha256: manifest.configurationSha256,
    status: 'PASS', scope: 'full', coverageExclusions: [], owner: 'synthetic-test', reviewedBy: 'synthetic-test',
    artifacts: ['run.json'], measurements: { executed: true, assertionsPassed: true } };
  const serial = (value) => { write('proofs/serial-replay.json', value); indexEvidence(root); return qualify(root).open.some((o) => o.id === 'serial-replay'); };
  check(() => assert.equal(serial(proof), false));
  check(() => assert.equal(qualify(root).state, 'NOT RELEASE READY', 'One scoped family cannot release the game'));
  for (const change of [{ source: 'c'.repeat(40) }, { status: 'PASS_SCOPED' }, { status: 'BLOCKED' },
    { scope: 'fixture' }, { coverageExclusions: ['natural-entry'] }, { artifacts: ['missing.json'] },
    { artifacts: ['proofs/serial-replay.json'] }, { reviewedBy: '' }, { measurements: {} },
    { configurationSha256: 'd'.repeat(64) }]) check(() => assert.equal(serial({ ...proof, ...change }), true));

  write('proofs/real-cohort.json', { ...proof, id: 'real-cohort', measurements: {
    participantKind: 'bots', participants: 3000, unfamiliarPlayers: 2000, consecutiveDays: 90 } });
  indexEvidence(root);
  check(() => assert(qualify(root).open.some((o) => o.id === 'real-cohort')));
  write('proofs/physical-devices.json', { ...proof, id: 'physical-devices', measurements: {
    devices: [{ physical: false, os: 'iOS', browser: 'Safari', criticalPathsPassed: true }] } });
  indexEvidence(root);
  check(() => assert(qualify(root).open.some((o) => o.id === 'physical-devices')));
  write('proofs/resource-conservation.json', { ...proof, id: 'resource-conservation', measurements: {
    resourceCategories: 13, openGaps: 0, unexplainedDrift: '0', duplicateValue: '0', missingDispositions: 0,
    allTransitionsNativeAndSimulation: true, allRequiredNonzeroCasesRan: false, contractScopeAttested: true } });
  indexEvidence(root);
  check(() => assert(qualify(root).open.some((o) => o.id === 'resource-conservation')));
  write('proofs/realtime-soak.json', { ...proof, id: 'realtime-soak', measurements: { durationHours: 0.1 } });
  indexEvidence(root);
  check(() => assert(qualify(root).open.some((o) => o.id === 'realtime-soak')));
  write('gate-registry.json', { gates: [] });
  indexEvidence(root);
  check(() => assert.equal(qualify(root).open[0].id, 'candidate'));
  console.log(`rc1-qualification: ${assertions} integrity, provenance, missing-proof and false-clearance assertions passed`);
} finally {
  // Only the uniquely-created OS temporary fixture is removed.
  fs.rmSync(root, { recursive: true });
}
