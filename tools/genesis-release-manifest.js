#!/usr/bin/env node
// Final unsigned Genesis release gate. It hashes evidence, source, compiler config, and bytecode, but
// never signs, broadcasts, writes a file, or reads a credential.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { keccak256 } from 'viem';
import {
  GENESIS_RELEASE_ARTIFACTS,
  GENESIS_RELEASE_SCOPE_FILES,
  buildGenesisReleaseManifest,
} from '../src/genesisrelease.js';
import { canonicalJson, sha256Hex } from '../src/genesiscadence.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  console.error(`Usage:
  node tools/genesis-release-manifest.js --inventory
  node tools/genesis-release-manifest.js <release-review.json>

--inventory prints the deterministic clean-commit source/compiler/artifact inventory for auditors.

The review file is public metadata and must live outside the repository. It contains:
  launch, audit, governance, cadenceEvidencePath, timingApproval,
  forkRehearsal, and safeCeremony.

Evidence path fields are read and replaced by SHA-256 digests. The command refuses a dirty tree,
credentials, stale/mismatched cadence, incomplete audit scope, placeholder governance, or Safe
preflight/simulation/decoder records that do not bind the exact launch calldata. It prints one
unsigned, hash-bound manifest to stdout and never writes or broadcasts anything.`);
}

function readRegularFile(label, file) {
  const resolved = path.resolve(String(file || ''));
  let stat;
  try { stat = fs.lstatSync(resolved); } catch { throw new Error(`${label} does not exist`); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular non-symlink file`);
  const bytes = fs.readFileSync(resolved);
  const after = fs.lstatSync(resolved);
  if (stat.size !== after.size || stat.mtimeMs !== after.mtimeMs) throw new Error(`${label} changed while hashing`);
  return bytes;
}

function digestPath(parent, pathKey, digestKey, label) {
  const bytes = readRegularFile(label, parent?.[pathKey]);
  parent[digestKey] = sha256Hex(bytes);
  delete parent[pathKey];
}

function hydrateEvidence(parsed) {
  const input = structuredClone(parsed);
  const cadenceBytes = readRegularFile('cadenceEvidencePath', input.cadenceEvidencePath);
  input.cadence = JSON.parse(cadenceBytes.toString('utf8'));
  delete input.cadenceEvidencePath;
  digestPath(input.audit, 'reportPath', 'reportSha256', 'audit.reportPath');
  digestPath(input.governance, 'recipientDecisionPath', 'recipientDecisionSha256',
    'governance.recipientDecisionPath');
  digestPath(input.governance, 'treasuryAllocationPath', 'treasuryAllocationSha256',
    'governance.treasuryAllocationPath');
  digestPath(input.governance?.lpCustody, 'reviewPath', 'reviewSha256', 'governance.lpCustody.reviewPath');
  digestPath(input.governance?.lpCustody, 'recoverySimulationPath', 'recoverySimulationSha256',
    'governance.lpCustody.recoverySimulationPath');
  digestPath(input.timingApproval, 'approvalPath', 'approvalSha256', 'timingApproval.approvalPath');
  digestPath(input.forkRehearsal, 'archivePath', 'archiveSha256', 'forkRehearsal.archivePath');
  digestPath(input.safeCeremony?.preflight, 'evidencePath', 'evidenceSha256',
    'safeCeremony.preflight.evidencePath');
  digestPath(input.safeCeremony?.simulation, 'evidencePath', 'evidenceSha256',
    'safeCeremony.simulation.evidencePath');
  digestPath(input.safeCeremony, 'approvalsPath', 'approvalsSha256', 'safeCeremony.approvalsPath');
  if (!Array.isArray(input.safeCeremony?.decoders)) throw new Error('safeCeremony.decoders is required');
  input.safeCeremony.decoders.forEach((decoder, index) => digestPath(
    decoder, 'evidencePath', 'evidenceSha256', `safeCeremony.decoders[${index}].evidencePath`,
  ));
  return input;
}

function repositoryInventory() {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    cwd: root, encoding: 'utf8',
  }).trim();
  const files = GENESIS_RELEASE_SCOPE_FILES.map((relative) => ({
    path: relative,
    sha256: sha256Hex(readRegularFile(relative, path.join(root, relative))),
  }));
  const artifacts = GENESIS_RELEASE_ARTIFACTS.map((contract) => {
    const file = path.join(root, 'omerta-contracts', 'out', `${contract}.sol`, `${contract}.json`);
    const bytes = readRegularFile(`${contract} Foundry artifact`, file);
    const parsed = JSON.parse(bytes.toString('utf8'));
    const creation = parsed.bytecode?.object;
    const runtime = parsed.deployedBytecode?.object;
    if (!/^0x[0-9a-f]+$/i.test(creation) || !/^0x[0-9a-f]+$/i.test(runtime)) {
      throw new Error(`${contract} Foundry artifact has missing or unlinked bytecode`);
    }
    return {
      contract,
      artifactSha256: sha256Hex(bytes),
      creationBytecodeKeccak256: keccak256(creation),
      runtimeBytecodeKeccak256: keccak256(runtime),
    };
  });
  return { commit, clean: status === '', nodeVersion: process.version, files, artifacts };
}

const reviewFile = process.argv[2];
if (!reviewFile || process.argv.length !== 3) {
  usage();
  process.exit(1);
}

try {
  if (reviewFile === '--inventory') {
    const repository = repositoryInventory();
    if (!repository.clean) throw new Error('repository tree must be clean before freezing the audit inventory');
    const body = { schemaVersion: 1, status: 'audit_inventory', repository };
    console.log(JSON.stringify({ ...body, inventorySha256: sha256Hex(canonicalJson(body)) }, null, 2));
    process.exit(0);
  }
  const parsed = JSON.parse(readRegularFile('release-review.json', reviewFile).toString('utf8'));
  const manifest = buildGenesisReleaseManifest(hydrateEvidence(parsed), {
    createdAt: new Date().toISOString(), repository: repositoryInventory(),
  });
  console.log(JSON.stringify(manifest, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
} catch (error) {
  console.error(`Genesis release gate failed: ${String(error?.message || error)}`);
  process.exit(1);
}
