// Synthetic metadata boundary checks; no compilation, deployment or RPC.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { keccak256, toHex } from 'viem';
import { loadPlayerGenesisArtifact } from '../tools/player-genesis-deployment-plan.js';
import { loadMarketV2Artifact } from '../tools/market-v2-deployment-plan.js';

const parent = fs.realpathSync(os.tmpdir());
const root = fs.mkdtempSync(path.join(parent, 'omerta-genesis-artifact-'));
let accepted = 0, refused = 0;
try {
  for (const [contract, target, viaIR, load] of [
    ['PositionManager', 'lib/v4-periphery/src/PositionManager.sol', true, loadPlayerGenesisArtifact],
    ['OmertaPoolManagerV2', 'src/market-v2/core/OmertaPoolManagerV2.sol', false, loadPlayerGenesisArtifact],
    ['OmertaGameSettlementV2', 'src/market-v2/OmertaGameSettlementV2.sol', true, loadMarketV2Artifact],
  ]) {
    const source = '// Synthetic loader fixture\n';
    fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
    fs.writeFileSync(path.join(root, target), source);
    const file = path.join(root, 'out', `${contract}.sol`, `${contract}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const baseline = {
      compiler: { version: '0.8.38+commit.1835a70c' },
      settings: { compilationTarget: { [target]: contract }, optimizer: { enabled: true, runs: 800 },
        evmVersion: 'cancun', viaIR },
      sources: { [target]: { keccak256: keccak256(toHex(source)) } },
      output: { abi: [] },
    };
    for (const raw of [false, true]) {
      const write = metadata => fs.writeFileSync(file, JSON.stringify({ abi: [],
        ...(raw ? { rawMetadata: JSON.stringify(metadata) } : { metadata }),
        bytecode: { object: '0x00', linkReferences: {} },
        deployedBytecode: { object: '0x00', linkReferences: {} } }));
      const valid = () => { write(baseline); assert.equal(load(contract, { contractsRoot: root }).evidence.settings.viaIR, viaIR); accepted++; };
      valid();
      for (const value of ['true', 'false', 1, 0, null, {}, []]) {
        const changed = structuredClone(baseline); changed.settings.viaIR = value;
        write(changed); assert.throws(() => load(contract, { contractsRoot: root }), /compiler\/ABI metadata mismatch/); refused++;
      }
      const omitted = structuredClone(baseline); delete omitted.settings.viaIR; write(omitted);
      if (viaIR) { assert.throws(() => load(contract, { contractsRoot: root }), /compiler\/ABI metadata mismatch/); refused++; }
      else { assert.equal(load(contract, { contractsRoot: root }).evidence.settings.viaIR, undefined); accepted++; }
      for (const value of ['true', 1, {}, null, false]) {
        const changed = structuredClone(baseline); changed.settings.optimizer.enabled = value;
        write(changed); assert.throws(() => load(contract, { contractsRoot: root }), /compiler\/ABI metadata mismatch/); refused++;
      }
      valid();
    }
  }
  assert.equal(accepted, 14);
  assert.equal(refused, 76);
  console.log(`player-genesis-artifact-metadata: ${accepted} valid controls, ${refused} malformed profile refusals`);
} finally {
  assert.equal(path.dirname(root), parent);
  assert(path.basename(root).startsWith('omerta-genesis-artifact-'));
  assert.equal(fs.realpathSync(root), root);
  fs.rmSync(root, { recursive: true, force: true });
}
