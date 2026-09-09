#!/usr/bin/env node
// Deterministic, unsigned CCA/LBP configuration builder. It prints reviewed calldata to stdout and
// never sends a transaction, reads a private key, or writes a configuration file.
import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, http } from 'viem';
import { buildGenesisLaunchArtifacts, buildGenesisAuctionBinding } from '../src/genesiscca.js';

const file = process.argv[2];
const bindAuction = process.argv[3] === '--bind-auction';
if (!file || (process.argv.length !== 3 && !(process.argv.length === 4 && bindAuction))) {
  console.error(`Usage: node tools/genesis-launch-config.js <validated-input.json> [--bind-auction]

Required JSON fields:
  token, treasury, vigRecipient, founderRecipient, proceedsSplitter,
  positionRecipient, hook, salt,
  startBlock, auctionBlocks, claimDelayBlocks, permit2Expiration

Optional fields:
  launchOwner (defaults to treasury), prebidBlocks (default 0),
  requiredCurrencyRaised (default 10 ETH in wei)

Automated Genesis additionally requires:
  launchMode: "automated", lifecycleController, oracle, liquidityKeeper,
  positionRecipient equal to the ProtocolLiquidityVault,
  runtimeCodeHashes for token, hook, proceedsSplitter, lifecycleController,
  positionRecipient, and oracle (deployed runtime hashes, including immutables).

--bind-auction reads CHAIN_RPC_URL (HTTPS), discovers the already created CCA,
checks its exact factory prediction and controller/vault/oracle bindings,
and simulates the unsigned bindAuction Safe call before the auction starts.
The default command is offline. Neither mode reads a signer or broadcasts.

All integer values may be JSON numbers (within the safe integer range) or decimal strings.
Output is unsigned Safe calldata on stdout; this tool never broadcasts or writes files.`);
  process.exit(1);
}

const inputPath = path.resolve(file);
const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const artifacts = buildGenesisLaunchArtifacts(parsed);
let rpcUrl;
try {
  let result = artifacts;
  if (bindAuction) {
    rpcUrl = process.env.CHAIN_RPC_URL;
    let endpoint;
    try { endpoint = new URL(rpcUrl); } catch { throw new Error('CHAIN_RPC_URL must be a valid HTTPS URL'); }
    if (endpoint.protocol !== 'https:') throw new Error('CHAIN_RPC_URL must use HTTPS');
    const client = createPublicClient({ transport: http(rpcUrl, { retryCount: 1, timeout: 15_000 }) });
    result = await buildGenesisAuctionBinding(client, artifacts);
  }
  console.log(JSON.stringify(result, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
} catch (error) {
  const message = String(error?.shortMessage || error?.message || error);
  console.error(`Genesis configuration failed: ${rpcUrl ? message.replaceAll(rpcUrl, '<redacted-rpc>') : message}`);
  process.exitCode = 1;
}
