import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createEthRewardsWorker,ethRewardsWorkerConfig} from '../src/ethrewardsworker.js';
const source=JSON.parse(fs.readFileSync('test/fixtures/eth-upkeep-disabled.json'));
const manifest={...source,ethAutomation:{enabled:true,productionEnabled:true}},bytes=m=>Buffer.from(JSON.stringify(m));
const sha=data=>createHash('sha256').update(data).digest('hex');
const names=['ETH_REWARDS_AUTOMATION_ENABLED','ETH_REWARDS_MANIFEST_PATH','ETH_REWARDS_MANIFEST_SHA256','DATABASE_URL'];
const settings=data=>({ETH_REWARDS_AUTOMATION_ENABLED:'on',ETH_REWARDS_MANIFEST_PATH:'public.json',ETH_REWARDS_MANIFEST_SHA256:sha(data),DATABASE_URL:'postgres://unused.invalid/test'});
async function env(values,run){const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));try{for(const k of names)if(values[k]===undefined)delete process.env[k];else process.env[k]=values[k];return await run();}finally{for(const k of names)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
const pool={query:async()=>({rows:[]}),connect:async()=>({query:async()=>({rows:[]}),release(){}})};
function harness(extra={}){
  const counts={credentials:0,clients:0,runs:0,schedules:0,cancelled:0},reports=[];let callback;
  const deps={config:()=>({enabled:true,manifest}),credentials:()=>{counts.credentials++;return{rpcUrl:'https://unused.invalid',privateKey:'synthetic'};},
    makeClients:()=>{counts.clients++;return{};},run:async()=>{counts.runs++;return{state:'idle',alert:false};},postgres:()=>true,
    schedule:(fn,ms)=>{assert.equal(ms,60000);counts.schedules++;callback=fn;return 1;},cancel:()=>counts.cancelled++,report:r=>reports.push(r),...extra};
  return{worker:createEthRewardsWorker(pool,deps),counts,reports,callback:()=>callback};
}
let groups=0;const test=async(n,fn)=>{await fn();groups++;console.log(`PASS ${n}`);};
await test('off means no manifest read, credentials, clients, RPC or timer',async()=>env({},async()=>{
  let reads=0;const h=harness({config:()=>ethRewardsWorkerConfig({readFile:()=>{reads++;throw Error('Unexpected read');}})});
  assert.equal(h.worker.start().state,'disabled');assert.equal((await h.worker.tick()).state,'disabled');assert.equal(reads,0);assert.equal(h.counts.credentials,0);assert.equal(h.counts.clients,0);assert.equal(h.counts.schedules,0);
}));
await test('both manifest production flags precede credentials and RPC',async()=>{
  for(const flags of [{enabled:false,productionEnabled:true},{enabled:true,productionEnabled:false}]){const data=bytes({...manifest,ethAutomation:flags});await env(settings(data),async()=>{
    const h=harness({config:()=>ethRewardsWorkerConfig({readFile:()=>data})});assert.equal((await h.worker.tick()).reason,'eth_manifest_disabled');assert.equal(h.counts.credentials,0);assert.equal(h.counts.clients,0);
  });}
});
await test('hash schema chain and ETH-only domain mismatches block before credentials',async()=>{
  const variants=[{data:bytes(manifest),digest:'0'.repeat(64),reason:'eth_manifest_sha_mismatch'},{data:Buffer.from('{bad'),reason:'eth_manifest_invalid'},
    {data:bytes({...manifest,chainId:31337}),reason:'eth_manifest_domain_mismatch'},{data:bytes({...manifest,jobs:[{id:'generic',kind:'refresh',target:'market',intervalSeconds:60}]}),reason:'eth_manifest_domain_mismatch'}];
  for(const v of variants)await env({...settings(v.data),...(v.digest?{ETH_REWARDS_MANIFEST_SHA256:v.digest}:{})},async()=>{
    const h=harness({config:()=>ethRewardsWorkerConfig({readFile:()=>v.data})});assert.equal((await h.worker.tick()).reason,v.reason);assert.equal(h.counts.credentials,0);assert.equal(h.counts.clients,0);
  });
});
await test('database URL and real PostgreSQL capability precede credentials',async()=>{
  const data=bytes(manifest);await env({...settings(data),DATABASE_URL:undefined},async()=>{const h=harness({config:()=>ethRewardsWorkerConfig({readFile:()=>data})});assert.equal((await h.worker.tick()).reason,'postgres_required');assert.equal(h.counts.credentials,0);});
  const h=harness({postgres:()=>false});assert.equal((await h.worker.tick()).reason,'postgres_required');assert.equal(h.counts.credentials,0);
});
await test('enabled work uses shared production journal runner and signing clients',async()=>{
  const h=harness({makeClients:(m,o)=>{assert.equal(m,manifest);assert.equal(o.signing,true);return{test:true};},run:async(db,m,clients,o)=>{assert.equal(db,pool);assert.equal(m,manifest);assert(clients.test);assert.deepEqual(o,{dryRun:false});return{state:'idle',alert:false};}});
  assert.equal((await h.worker.tick()).state,'idle');assert.equal(h.counts.credentials,1);
});
await test('in-flight work cannot overlap and completion releases the guard',async()=>{
  let release,runs=0;const held=new Promise(resolve=>{release=resolve;}),h=harness({run:async()=>++runs===1?held:{state:'idle',alert:false}});
  const first=h.worker.tick();assert.equal((await h.worker.tick()).state,'busy');assert.equal(runs,1);release({state:'settled',alert:false});assert.equal((await first).state,'settled');assert.equal((await h.worker.tick()).state,'idle');assert.equal(runs,2);
});
await test('provider errors expose no secrets and later work recovers',async()=>{
  let fail=true;const secret='provider-token/key/connection-string',h=harness({run:async()=>{if(fail)throw Object.assign(Error(secret),{keeperCode:secret});return{state:'idle',alert:false};}});
  assert.equal((await h.worker.tick()).reason,'eth_upkeep_unavailable');fail=false;assert.equal((await h.worker.tick()).state,'idle');assert.equal(JSON.stringify(h.reports).includes(secret),false);assert.equal(h.reports.length,2);
});
await test('configuration failures recover without stranding the timer',async()=>{
  let fail=true;const h=harness({enabled:()=>true,config:()=>{if(fail)throw Object.assign(Error('secret-path'),{keeperCode:'eth_manifest_unavailable'});return{enabled:true,manifest};}});
  assert.equal(h.worker.start().state,'scheduled');await Promise.resolve();assert.equal(h.counts.schedules,1);assert.equal(h.counts.credentials,0);fail=false;h.callback()();await Promise.resolve();await Promise.resolve();assert.equal(h.counts.runs,1);h.worker.stop();assert.equal(h.counts.cancelled,1);assert.equal((await h.worker.tick()).state,'disabled');
});
await test('start is idempotent and logging emits bounded state transitions',async()=>{
  const h=harness({enabled:()=>true});h.worker.start();h.worker.start();await Promise.resolve();await Promise.resolve();assert.equal(h.counts.schedules,1);await h.worker.tick();assert.equal(h.reports.length,1);h.worker.stop();
});
await test('existing worker registers ETH before unrelated watcher startup RPC',async()=>{
  const text=fs.readFileSync('src/worker.js','utf8'),start=text.indexOf('  startEthRewardsWorker(pool);'),rpc=text.indexOf('else source = await makeViemSource();');assert(start>0&&rpc>start);assert(text.includes("import { startEthRewardsWorker } from './ethrewardsworker.js';"));
});
console.log(JSON.stringify({pass:true,groups,syntheticOnly:true,productionWrites:false,productionSigning:false}));
