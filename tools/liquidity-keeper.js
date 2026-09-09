#!/usr/bin/env node
// Public manifest + environment-only signer. The default command never asks for a key.
import { makeDb } from '../src/db.js';
import pg from 'pg';
import { liquidityKeeperConfig, makeLiquidityKeeperClients, runLiquidityKeeper } from '../src/liquiditykeeper.js';
import { keeperTransactionStatus } from '../src/keepertransactions.js';
import { bookConfirmedLiquidityAction } from '../src/liquidityaccounting.js';
import { buildLiquidityPlanningContext } from '../src/liquiditypolicy.js';
import { runLiquidityAutomationCycle } from '../src/liquidityautomation.js';

const command = process.argv[2] || 'plan';
if (!['plan','status','run'].includes(command) || process.argv.length > 3) {
  console.error('Usage: node tools/liquidity-keeper.js [plan|status|run]');
  process.exit(1);
}
let pool;
try {
  const config=liquidityKeeperConfig();
  if (!config.enabled) { console.log(JSON.stringify({state:'disabled',reason:config.reason})); }
  else {
    // A live run never uses an in-memory journal, even outside NODE_ENV=production.
    if (['run','status'].includes(command) && !process.env.DATABASE_URL) throw Object.assign(new Error('PostgreSQL journal required'),{keeperCode:'postgres_required'});
    if(command==='run')pool=await makeDb();
    else if(process.env.DATABASE_URL) {
      // makeDb performs schema migrations. Plan/status instead use an explicitly read-only
      // session, so even an accidental future callback write cannot mutate production state.
      pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,
        options:'-c default_transaction_read_only=on -c statement_timeout=15000'});
      pool.on('error',()=>{});
    }
    let output;
    if (command==='status') output={state:'status',transactions:await keeperTransactionStatus(pool,{chainId:config.manifest.chainId,wallet:config.manifest.keeper})};
    else if(command==='run')output=await runLiquidityAutomationCycle(pool,{config,clients:makeLiquidityKeeperClients(config,{signing:true})});
    else output=await runLiquidityKeeper(pool,{config,clients:makeLiquidityKeeperClients(config),dryRun:true,onConfirmed:bookConfirmedLiquidityAction,
      planningContext:(p,m,s)=>buildLiquidityPlanningContext(p,m,s,{persist:false})});
    console.log(JSON.stringify(output,(_key,value)=>typeof value==='bigint'?String(value):value,2));
    if (output.alert) process.exitCode=2;
  }
} catch(error) {
  // Never print arbitrary RPC, environment, key or driver error text.
  console.error(JSON.stringify({state:'blocked',reason:error.keeperCode||'liquidity_keeper_unavailable'}));
  process.exitCode=2;
} finally { await pool?.end(); }
