#!/usr/bin/env node
import fs from 'node:fs';
import { makeMarketV2Clients } from '../src/marketv2keeper.js';
import { validateMarketV2SolverManifest, quoteMarketV2Solver, runMarketV2Solver } from '../src/marketv2solver.js';

const [command = 'quote', manifestFile, planFile, ...extra] = process.argv.slice(2);
let pool;
try {
  if (!['quote', 'commit', 'execute'].includes(command) || !manifestFile || extra.length
      || (command === 'quote' && planFile) || (command !== 'quote' && !planFile)) throw new Error('usage');
  const manifest = validateMarketV2SolverManifest(JSON.parse(fs.readFileSync(manifestFile, 'utf8')));
  const signing = command !== 'quote';
  if (signing && !process.env.DATABASE_URL) throw Object.assign(new Error(), { keeperCode: 'postgres_required' });
  const clients = makeMarketV2Clients(manifest.upkeep, { rpcUrl: process.env.MARKET_V2_RPC_URL, signing,
    privateKey: signing ? process.env.MARKET_V2_KEEPER_KEY : undefined });
  if (signing) pool = await (await import('../src/db.js')).makeDb();
  const result = signing ? await runMarketV2Solver(pool, manifest, clients, { phase: command, planFile })
    : await quoteMarketV2Solver(manifest, clients);
  console.log(JSON.stringify(result, (_k, x) => typeof x === 'bigint' ? String(x) : x, 2));
  if (result.alert) process.exitCode = 2;
} catch (error) {
  console.error(JSON.stringify({ state: 'blocked', reason: error.keeperCode || 'invalid_input_or_unavailable',
    usage: 'node tools/market-v2-solver.js quote manifest.json | [commit|execute] manifest.json persisted-plan.json' }));
  process.exitCode = 2;
} finally { await pool?.end(); }
