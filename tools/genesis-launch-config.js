#!/usr/bin/env node
// Deterministic, unsigned CCA/LBP configuration builder. It prints reviewed calldata to stdout and
// never sends a transaction, reads a private key, or writes a configuration file.
import fs from 'node:fs';
import path from 'node:path';
import { buildGenesisLaunchArtifacts } from '../src/genesiscca.js';

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  console.error(`Usage: node tools/genesis-launch-config.js <validated-input.json>

Required JSON fields:
  token, treasury, vigRecipient, founderRecipient, proceedsSplitter,
  positionRecipient, hook, salt,
  startBlock, auctionBlocks, claimDelayBlocks, permit2Expiration

Optional fields:
  launchOwner (defaults to treasury), prebidBlocks (default 0),
  requiredCurrencyRaised (default 10 ETH in wei)

All integer values may be JSON numbers (within the safe integer range) or decimal strings.
Output is unsigned Safe calldata on stdout; this tool never broadcasts or writes files.`);
  process.exit(1);
}

const inputPath = path.resolve(file);
const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const result = buildGenesisLaunchArtifacts(parsed);
console.log(JSON.stringify(result, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
