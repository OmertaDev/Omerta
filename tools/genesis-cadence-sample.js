#!/usr/bin/env node
// Read-only Robinhood Chain BlockNumberish sampler. It never signs, broadcasts, or prints the RPC URL.
import { performance } from 'node:perf_hooks';
import { createPublicClient, http } from 'viem';
import { buildGenesisCadenceEvidence } from '../src/genesiscadence.js';

const ARBSYS = '0x0000000000000000000000000000000000000064';
const ARBSYS_ABI = [{
  type: 'function', name: 'arbBlockNumber', stateMutability: 'view', inputs: [],
  outputs: [{ name: '', type: 'uint256' }],
}];

function usage() {
  console.error(`Usage: CHAIN_RPC_URL=https://... node tools/genesis-cadence-sample.js [options]

Options:
  --duration-seconds <180-900>  Total observation window (default 180)
  --interval-seconds <5-60>     Delay between samples (default 30)
  --rpc-class <public|private|archive>  Evidence label (default public)

The command reads ArbSys BlockNumberish plus latest/finalized blocks and prints hash-bound JSON.
It never signs, broadcasts, writes a file, or prints CHAIN_RPC_URL.`);
}

const options = { durationSeconds: 180, intervalSeconds: 30, rpcClass: 'public' };
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index];
  const value = process.argv[++index];
  if (flag === '--duration-seconds') options.durationSeconds = Number(value);
  else if (flag === '--interval-seconds') options.intervalSeconds = Number(value);
  else if (flag === '--rpc-class') options.rpcClass = value;
  else { usage(); process.exit(1); }
}
if (!Number.isInteger(options.durationSeconds) || options.durationSeconds < 180 || options.durationSeconds > 900
  || !Number.isInteger(options.intervalSeconds) || options.intervalSeconds < 5 || options.intervalSeconds > 60
  || options.intervalSeconds >= options.durationSeconds
  || !['public', 'private', 'archive'].includes(options.rpcClass)) {
  usage();
  process.exit(1);
}

const rpcUrl = process.env.CHAIN_RPC_URL;
let parsedRpc;
try { parsedRpc = new URL(rpcUrl); } catch { /* handled below */ }
if (!parsedRpc || parsedRpc.protocol !== 'https:') {
  console.error('CHAIN_RPC_URL must be a valid HTTPS URL.');
  process.exit(1);
}

const client = createPublicClient({ transport: http(rpcUrl, { retryCount: 1, timeout: 15_000 }) });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const started = performance.now();
const samples = [];

try {
  const chainId = await client.getChainId();
  if (chainId !== 4663) throw new Error(`RPC chain ${chainId} does not match Robinhood mainnet 4663`);
  for (let targetMs = 0; targetMs <= options.durationSeconds * 1000; targetMs += options.intervalSeconds * 1000) {
    const remaining = targetMs - (performance.now() - started);
    if (remaining > 0) await sleep(remaining);
    const [blockNumberish, latest, finalized] = await Promise.all([
      client.readContract({ address: ARBSYS, abi: ARBSYS_ABI, functionName: 'arbBlockNumber' }),
      client.getBlock({ blockTag: 'latest' }),
      client.getBlock({ blockTag: 'finalized' }),
    ]);
    samples.push({
      elapsedMs: samples.length === 0 ? 0 : Math.round(performance.now() - started),
      observedAt: new Date().toISOString(),
      blockNumberish,
      latestBlock: latest.number,
      latestTimestamp: latest.timestamp,
      finalizedBlock: finalized.number,
    });
  }
  const evidence = buildGenesisCadenceEvidence({
    chainId, rpcClass: options.rpcClass, generatedAt: new Date().toISOString(), samples,
  });
  console.log(JSON.stringify(evidence, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
} catch (error) {
  const raw = String(error?.shortMessage || error?.message || error);
  console.error(`Genesis cadence sampling failed: ${raw.replaceAll(rpcUrl, '<redacted-rpc>')}`);
  process.exit(1);
}
