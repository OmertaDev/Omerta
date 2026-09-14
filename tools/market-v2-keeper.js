#!/usr/bin/env node
import fs from 'node:fs';
import { validateMarketV2Manifest, makeMarketV2Clients, runMarketV2 } from '../src/marketv2keeper.js';

const [command = 'plan', manifestPath, ...extra] = process.argv.slice(2);
let pool;
try {
  if (!['plan', 'run'].includes(command) || !manifestPath || extra.length) throw new Error('usage');
  const m = validateMarketV2Manifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  const signing = command === 'run';
  if (signing && !process.env.DATABASE_URL) throw Object.assign(new Error(), { keeperCode: 'postgres_required' });
  const clients = makeMarketV2Clients(m, { rpcUrl: process.env.MARKET_V2_RPC_URL, signing, privateKey: signing ? process.env.MARKET_V2_KEEPER_KEY : undefined });
  if (signing) pool = await (await import('../src/db.js')).makeDb();
  const result = await runMarketV2(pool, m, clients, { dryRun: !signing });
  console.log(JSON.stringify(result, (_k, v) => typeof v === 'bigint' ? String(v) : v, 2));
  if (result.alert) process.exitCode = 2;
} catch (e) {
  console.error(JSON.stringify({ state: 'blocked', reason: e.keeperCode || 'invalid_input_or_unavailable', usage: 'node tools/market-v2-keeper.js [plan|run] manifest.json' }));
  process.exitCode = 2;
} finally { await pool?.end(); }
