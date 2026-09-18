// Local rehearsal fixture artifacts only; no deployment-plan artifact policy changes.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function loadLiquidityE2EArtifact(contractsRoot, name) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) throw new Error('Invalid E2E artifact name');
  const directory = path.join(contractsRoot, 'out', `${name}.sol`);
  let filename = `${name}.json`;
  if (name === 'PoolSwapTest') {
    // Forge 1.7.1 emits BOTH .default.json and .constellation-via-ir.json when
    // this upstream fixture is imported by tests in both compiler profiles.
    // Select the declared IR profile explicitly, never whichever glob sorts first.
    const profiled = `${name}.constellation-via-ir.json`;
    if (fs.existsSync(path.join(directory, profiled))) filename = profiled;
  }
  const file = path.join(directory, filename), bytes = fs.readFileSync(file);
  const artifact = JSON.parse(bytes.toString('utf8'));
  if (name === 'PoolSwapTest') {
    const metadata = typeof artifact.rawMetadata === 'string' ? JSON.parse(artifact.rawMetadata)
      : typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
    const target = metadata?.settings?.compilationTarget;
    if (!target || Object.keys(target).length !== 1
      || target['lib/v4-core/src/test/PoolSwapTest.sol'] !== name
      || !/^0\.8\.26\+/.test(metadata.compiler?.version || '')
      || metadata.settings.optimizer?.enabled !== true || metadata.settings.optimizer.runs !== 800
      || metadata.settings.evmVersion !== 'cancun' || metadata.settings.viaIR !== true
      || !Array.isArray(artifact.abi) || !/^0x(?:[a-fA-F0-9]{2})+$/.test(artifact.bytecode?.object || '')
      || Object.keys(artifact.bytecode.linkReferences || {}).length) {
      throw new Error('PoolSwapTest must use its pinned Solidity 0.8.26 Cancun IR fixture artifact');
    }
  }
  // Evidence binds the exact bytes selected above, including a profile suffix.
  return { artifact, sha256: createHash('sha256').update(bytes).digest('hex') };
}
