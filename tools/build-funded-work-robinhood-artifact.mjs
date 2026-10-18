import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { keccak256 } from 'viem';
import { ROBINHOOD_WORK_ESCROW_ABI, ROBINHOOD_WORK_ESCROW_COMPILER, ROBINHOOD_WORK_ESCROW_RUNTIME_KECCAK,
  ROBINHOOD_WORK_ESCROW_CREATION_KECCAK, ROBINHOOD_WORK_ESCROW_SOURCE_SHA256 } from '../src/fundedworkescrowrobinhoodartifact.js';

assert.equal(process.argv.length, 2, 'The Robinhood USDG build has one fixed source and artifact target.');
const root = fileURLToPath(new URL('..', import.meta.url));
const source = fs.readFileSync(new URL('../omerta-contracts/src/market-v2/OmertaWorkEscrowRobinhood.sol', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'), ROBINHOOD_WORK_ESCROW_SOURCE_SHA256);
execFileSync('forge', ['build', '--root', 'omerta-contracts', 'src/market-v2/OmertaWorkEscrowRobinhood.sol'], { cwd: root, stdio: 'inherit' });
const artifact = JSON.parse(fs.readFileSync(new URL('../omerta-contracts/out/OmertaWorkEscrowRobinhood.sol/OmertaWorkEscrowRobinhood.json', import.meta.url), 'utf8'));
assert.deepEqual(ROBINHOOD_WORK_ESCROW_COMPILER, {
  version: artifact.metadata.compiler.version,
  optimizerRuns: artifact.metadata.settings.optimizer.runs,
  viaIR: artifact.metadata.settings.viaIR,
  evmVersion: artifact.metadata.settings.evmVersion,
});
assert.deepEqual(ROBINHOOD_WORK_ESCROW_ABI, artifact.abi);
assert.equal(keccak256(artifact.deployedBytecode.object), ROBINHOOD_WORK_ESCROW_RUNTIME_KECCAK);
assert.equal(keccak256(artifact.bytecode.object), ROBINHOOD_WORK_ESCROW_CREATION_KECCAK);
console.log(JSON.stringify({ phase: 'PASS_PINNED_ROBINHOOD_WORK_BUILD_ARTIFACT_ONLY', compiler: ROBINHOOD_WORK_ESCROW_COMPILER,
  sourceSha256: ROBINHOOD_WORK_ESCROW_SOURCE_SHA256, runtimeKeccak: ROBINHOOD_WORK_ESCROW_RUNTIME_KECCAK,
  creationKeccak: ROBINHOOD_WORK_ESCROW_CREATION_KECCAK, deploymentVerified: false,
  financialActivation: false, executableWorkGrant: false }));
