// Execute the actual worker safe wrapper and custody/stock/unrelated-job source block.
// Injected jobs model failures without starting the worker, a database or an RPC sender.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const safe = source.match(/const safe = async \(label, fn\) => \{[\s\S]*?\n  \};/)?.[0];
assert(safe,'Actual per-job safe wrapper must remain discoverable');
const start = source.indexOf("let custodyReady = process.env.CHARACTER_DEED_CUSTODY_ENABLED");
const end = source.indexOf('// THE TWO DEX BOTS',start);
assert(start>=0 && end>start,'Actual custody, stock and subsequent identity-job block must remain discoverable');
const block = source.slice(start,end);
assert(block.includes('syncDynastyMintEvents'),'An actual unrelated following job is in the executed block');
const run = async (options={})=>{
  const {active=true,syncThrows=false,keeperThrows=false}=options;
  const syncResult=Object.hasOwn(options,'syncResult')?options.syncResult:{processed:0};
  const keeperResult=Object.hasOwn(options,'keeperResult')?options.keeperResult:{state:'idle'};
  const calls=[],errors=[];
  const job=(name,result,throws=false)=>async()=>{calls.push(name);if(throws)throw new Error(`${name} unavailable`);return result;};
  const context={process:{env:{CHARACTER_DEED_CUSTODY_ENABLED:active?'true':'false',STOCK_VAULT_ADDRESS:'stock',DYNASTY_NFT_ADDRESS:'identity'}},
    pool:{},source:{},startBlock:1,console:{log(){},error(...args){errors.push(args[0]);}},log(){},
    syncCharacterDeedEvents:job('custody sync',syncResult,syncThrows),runCharacterDeedKeeper:job('custody keeper',keeperResult,keeperThrows),
    syncStockDeliveredEvents:job('stock sync',{}),deliveryKeeperReady:()=>true,runStockDeliveryKeeper:job('stock keeper',{}),
    syncDynastyMintEvents:job('identity sync',{}),syncDynastyTransferEvents:job('identity transfer',{})};
  await vm.runInNewContext(`(async()=>{let currentJob=null;${safe}\n${block}})()`,context);
  return {calls,errors};
};
const following=['identity sync','identity transfer'];
let result=await run({syncThrows:true});
assert.deepEqual(result.calls,['custody sync',...following],'Sync failure skips keeper and stock, preserving unrelated jobs');
assert.equal(result.errors.length,1);
result=await run({keeperThrows:true});
assert.deepEqual(result.calls,['custody sync','custody keeper',...following],'Keeper failure skips stock, preserving unrelated jobs');
assert.equal(result.errors.length,1);
for(const syncResult of [null,undefined,{dormant:true}]){
  result=await run({syncResult});
  assert.deepEqual(result.calls,['custody sync',...following],'Missing/dormant sync cannot imply readiness');
}
for(const keeperResult of [null,undefined,{}, {dormant:true},{state:'blocked',alert:true},{state:'reverted'},
  {state:'awaiting_indexer'},{state:'submitted'},{state:'idle',alert:true}]){
  result=await run({keeperResult});
  assert.deepEqual(result.calls,['custody sync','custody keeper',...following],'Only explicit healthy keeper completion admits dependent stock work');
}
for(const state of ['idle','settled']){
  result=await run({keeperResult:{state}});
  assert.deepEqual(result.calls,['custody sync','custody keeper','stock sync','stock keeper',...following]);
}
result=await run({active:false,syncThrows:true,keeperThrows:true});
assert.deepEqual(result.calls,['stock sync','stock keeper',...following],'Inactive custody preserves the existing stock rail and unrelated jobs');
console.log('deedcustody-worker: PASS (actual source safe isolation, sync/keeper failures, explicit readiness, fail-closed stock dependencies, healthy completion, inactive legacy path and following unrelated jobs)');
