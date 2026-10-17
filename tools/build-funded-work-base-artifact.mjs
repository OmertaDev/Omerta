import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { keccak256 } from 'viem';
import { BASE_WORK_ESCROW_ABI, BASE_WORK_ESCROW_COMPILER, BASE_WORK_ESCROW_RUNTIME_KECCAK,
  BASE_WORK_ESCROW_CREATION_KECCAK, BASE_WORK_ESCROW_SOURCE_SHA256 } from '../src/fundedworkescrowbaseartifact.js';

assert.equal(process.argv.length, 2, 'The Base build has one fixed source and artifact target.');
const root = fileURLToPath(new URL('..', import.meta.url));
const source = fs.readFileSync(new URL('../omerta-contracts/src/market-v2/OmertaWorkEscrowBase.sol', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'), BASE_WORK_ESCROW_SOURCE_SHA256);
execFileSync('forge', ['build', '--root', 'omerta-contracts', 'src/market-v2/OmertaWorkEscrowBase.sol'], { cwd: root, stdio: 'inherit' });
const artifact = JSON.parse(fs.readFileSync(new URL('../omerta-contracts/out/OmertaWorkEscrowBase.sol/OmertaWorkEscrowBase.json', import.meta.url), 'utf8'));
assert.deepEqual(BASE_WORK_ESCROW_COMPILER, {
  version: artifact.metadata.compiler.version,
  optimizerRuns: artifact.metadata.settings.optimizer.runs,
  viaIR: artifact.metadata.settings.viaIR,
  evmVersion: artifact.metadata.settings.evmVersion,
});
assert.deepEqual(BASE_WORK_ESCROW_ABI, artifact.abi);
assert.equal(keccak256(artifact.deployedBytecode.object), BASE_WORK_ESCROW_RUNTIME_KECCAK);
assert.equal(keccak256(artifact.bytecode.object), BASE_WORK_ESCROW_CREATION_KECCAK);
console.log(JSON.stringify({ phase: 'PASS_PINNED_BASE_WORK_BUILD_ARTIFACT_ONLY', compiler: BASE_WORK_ESCROW_COMPILER,
  sourceSha256: BASE_WORK_ESCROW_SOURCE_SHA256, runtimeKeccak: BASE_WORK_ESCROW_RUNTIME_KECCAK,
  creationKeccak: BASE_WORK_ESCROW_CREATION_KECCAK, deploymentVerified: false,
  financialActivation: false, executableWorkGrant: false }));
