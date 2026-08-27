#!/usr/bin/env node
// Read-only, post-preparation launch preflight. It validates the pinned Uniswap stack, live protocol
// fee, OMERTÀ launch contracts, tax state, balances, and exact one-shot allowances. It never signs,
// sends, or writes a transaction.
import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, http } from 'viem';
import {
  buildGenesisLaunchArtifacts,
  verifyGenesisLaunchReadiness,
  verifyRobinhoodGenesisStack,
} from '../src/genesiscca.js';

function usage() {
  console.error(`Usage: CHAIN_RPC_URL=https://... node tools/genesis-launch-preflight.js <validated-input.json>

Run this after the three preparation Safe calls and immediately before signing/executing the atomic
launch multicall. The input is the same JSON consumed by genesis-launch-config.js. CHAIN_RPC_URL must
be an HTTPS Robinhood Chain mainnet endpoint. The RPC URL is never printed.`);
}

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  usage();
  process.exit(1);
}

const rpcUrl = process.env.CHAIN_RPC_URL;
let parsedRpc;
try { parsedRpc = new URL(rpcUrl); } catch {
  console.error('CHAIN_RPC_URL must be a valid HTTPS URL.');
  process.exit(1);
}
if (parsedRpc.protocol !== 'https:') {
  console.error('CHAIN_RPC_URL must use HTTPS.');
  process.exit(1);
}

const inputPath = path.resolve(file);
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const artifacts = buildGenesisLaunchArtifacts(input);
const client = createPublicClient({ transport: http(rpcUrl, { retryCount: 1, timeout: 15_000 }) });

try {
  const stack = await verifyRobinhoodGenesisStack(client, {
    representativeRaise: artifacts.graduation.requiredCurrencyRaised,
  });
  const readiness = await verifyGenesisLaunchReadiness(client, artifacts);
  console.log(JSON.stringify({ ok: true, stack, readiness }, (_key, value) => (
    typeof value === 'bigint' ? value.toString() : value
  ), 2));
} catch (error) {
  const raw = String(error?.shortMessage || error?.message || error);
  const redacted = raw.replaceAll(rpcUrl, '<redacted-rpc>');
  console.error(`Genesis launch preflight failed: ${redacted}`);
  process.exit(1);
}
