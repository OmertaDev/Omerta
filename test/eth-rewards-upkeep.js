import assert from 'node:assert/strict';
import fs from 'node:fs';
import {keccak256} from 'viem';
import {buildEthRewardsKeeperManifest} from '../tools/eth-rewards-keeper-plan.js';
import {planMarketV2,runMarketV2,prioritizeEthUpkeepActions,validateMarketV2Manifest} from '../src/marketv2keeper.js';
const code='0x60006000',hash=keccak256(code),clone=x=>structuredClone(x),low=x=>String(x).toLowerCase();
const c=JSON.parse(fs.readFileSync('test/fixtures/eth-readiness-candidate.json'));Object.keys(c.runtimeHashes).forEach(k=>{c.runtimeHashes[k]=hash;});
const profile={gas:{maxGas:'1000000',maxFeePerGas:'1000000000',maxPriorityFeePerGas:'0',dailyBudget:'10000000000000000',confirmations:2,maxSnapshotAgeSeconds:60},minimumNativeAmount:'100',minimumOmrAmount:'100',intervalSeconds:60};
const generated=buildEthRewardsKeeperManifest(c,profile),m=clone(generated);m.ethAutomation={enabled:true,productionEnabled:true};
let groups=0;const test=async(n,fn)=>{await fn();groups++;console.log(`PASS ${n}`);};
function fixture({timestamp=1800000300,age=600,valid=true,snapshotEpoch,epochDuration=300n}={}){
  const calls=[],reads=[],block={number:101n,timestamp:BigInt(timestamp),hash:`0x${'ab'.repeat(32)}`};
  const a=c.addresses,p=Object.fromEntries(Object.entries(c.eth.policy).map(([k,v])=>[k,BigInt(v)]));
  return{calls,reads,block,publicClient:{getChainId:async()=>4663,getBlock:async()=>block,getCode:async()=>code,getBalance:async()=>10n**18n,
    readContract:async req=>{reads.push(req);assert.equal(req.blockNumber,101n);assert(req.abi.some(f=>f.type==='function'&&f.name===req.functionName));
      const at=low(req.address),fn=req.functionName;
      if(at===low(a.ethRewards))return({marketState:a.marketState,safe:c.roles.safe,keeper:c.eth.keeper,policy:p,manager:a.poolManager,rewardVault:a.ethStaking,
        omr:a.omr,active:true,paused:false,healthReady:true,omrConvertedOnDay:0n,nativeFundedOnDay:0n,minimumNativeFor:1000n})[fn];
      if(at===low(a.ethStaking))return({owner:c.roles.safe,governanceSafe:c.roles.safe,distributor:a.ethRewards,distributorRuntimeHash:hash,active:true,currentEpoch:2n,epoch:{finalized:false}})[fn];
      if(at===low(a.poolManager))return fn==='owed'?1000n:a.ethRewards;
      if(at===low(a.omr)&&fn==='balanceOf')return 10n**22n;
      if(at===low(a.marketState))return fn==='source'?a.hook:{valid,observedAt:block.timestamp-BigInt(age),epoch:snapshotEpoch??block.timestamp/epochDuration-2n};
      if(at===low(a.hook)&&fn==='epochDuration')return epochDuration;
      throw Error(`Unexpected read ${at}.${fn}`);},
    simulateContract:async req=>{calls.push(req.functionName);return{};},
  }};
}
const actionRows=m.jobs.map(j=>({target:m.contracts[j.target].address,metadata:{kind:j.kind,jobId:j.id}}));
await test('generator pins a dedicated ETH manifest and disables every production job by default',async()=>{
  assert.deepEqual(generated.ethAutomation,{enabled:false,productionEnabled:false});assert.deepEqual(generated.jobs.map(x=>x.kind),['eth_finalize','eth_fund','eth_refresh','eth_convert','eth_collect']);
  assert.deepEqual(validateMarketV2Manifest(generated),generated);assert.equal(generated.contracts.rewards.runtimeHash,hash);
  const f=fixture(),p=await planMarketV2(generated,f,{now:Number(f.block.timestamp)});assert.equal(p.actions.length,0);assert.equal(p.blocked.every(x=>x.reason==='eth_automation_disabled'),true);
});
await test('gas thresholds cadence unknown options and limits cannot silently become unusable upkeep',async()=>{
  for(const p of [{...profile,minimumNativeAmount:'0'},{...profile,minimumOmrAmount:'999999999999999999999999999'},
    {...profile,intervalSeconds:300},{...profile,enabled:true},{...profile,gas:{...profile.gas,dailyBudget:'1'}}])assert.throws(()=>buildEthRewardsKeeperManifest(c,p));
});
await test('all continuously ready jobs receive bounded service even across process restarts and reverted attempts',async()=>{
  const history=[],served=[];
  for(let i=0;i<100;i++){
    const next=prioritizeEthUpkeepActions(actionRows,JSON.parse(JSON.stringify(history.slice(-100))))[0];served.push(next.metadata.kind);
    history.push({...next,nonce:i,state:i%7===0?'reverted':'settled'});
    if(i>=4)assert.equal(new Set(served.slice(-5)).size,5,'No ready job can be starved by continuous collection/funding');
  }
  assert.deepEqual(served.slice(0,5),['eth_finalize','eth_fund','eth_refresh','eth_convert','eth_collect']);
});
await test('unready jobs do not consume turns and older ready conversion beats newly recurring fees',async()=>{
  const history=actionRows.map((a,i)=>({...a,nonce:i}));
  const justFees=actionRows.filter(a=>['eth_fund','eth_convert','eth_collect'].includes(a.metadata.kind));
  const ordered=prioritizeEthUpkeepActions(justFees,[...history,{...justFees[0],nonce:90},{...justFees[2],nonce:91}]);
  assert.equal(ordered[0].metadata.kind,'eth_convert');
  assert.throws(()=>prioritizeEthUpkeepActions(actionRows,[{...actionRows[0],nonce:NaN}]),/invalid_upkeep_history/);
});
await test('generic job positions and ordering are preserved when ETH jobs are serviced fairly',async()=>{
  const genericA={target:'generic-a',metadata:{kind:'refresh'}},genericB={target:'generic-b',metadata:{kind:'manager_claim'}};
  const mixed=[genericA,...actionRows.slice(0,2),genericB,...actionRows.slice(2)],result=prioritizeEthUpkeepActions(mixed,actionRows.map((a,i)=>({...a,nonce:100-i})));
  assert.equal(result[0],genericA);assert.equal(result[3],genericB);assert.deepEqual(prioritizeEthUpkeepActions([genericA,genericB]),[genericA,genericB]);
});
await test('ETH refresh runs only for an invalid or near-stale snapshot with a newer finalized epoch',async()=>{
  const refresh=clone(m);refresh.jobs=[m.jobs.find(j=>j.kind==='eth_refresh')];
  for(const state of [{age:0},{age:239},{age:100,valid:false,snapshotEpoch:6000000n}]){
    const f=fixture(state),p=await planMarketV2(refresh,f,{now:Number(f.block.timestamp)});assert.equal(p.actions.length,0,JSON.stringify(state,(_k,v)=>typeof v==='bigint'?String(v):v));
  }
  for(const state of [{age:240},{age:600},{age:0,valid:false}]){
    const f=fixture(state),p=await planMarketV2(refresh,f,{now:Number(f.block.timestamp)});assert.deepEqual(p.actions.map(a=>a.functionName),['refresh']);
  }
});
await test('single-shot runner consults persisted service history instead of resetting first-job priority',async()=>{
  const f=fixture({timestamp:Math.floor(Date.now()/1000)}),queries=[];
  const order=['eth_fund','eth_refresh','eth_collect','eth_finalize','eth_convert'];
  const rows=order.map((kind,i)=>{const a=actionRows.find(x=>x.metadata.kind===kind);return{id:`row-${i}`,chain_id:4663,wallet:m.keeper,target:a.target,target_code_hash:hash,
    job_key:`marketv2:${a.metadata.jobId}:old`,status:'settled',nonce:100+i,request_json:'{}',budget_json:'[]',metadata_json:JSON.stringify(a.metadata),confirmations:2,broadcast_attempts:1,accounting_required:false};});
  const pool={query:async sql=>{queries.push(sql);return{rows:sql.includes('job_key IN')?[]:rows};}};
  const result=await runMarketV2(pool,m,f,{dryRun:true});assert.equal(result.plan.actions[0].metadata.kind,'eth_fund');assert.equal(result.plan.ethScheduling.journalHistoryAvailable,true);
  assert.equal(queries.length,2);assert.equal(result.plan.ethScheduling.boundedHistoryRows,5);
});
await test('disabled ETH-only upkeep also blocks replay of a pending market-refresh transaction',async()=>{
  const previous=process.env.DATABASE_URL;process.env.DATABASE_URL='postgres://unused.invalid/eth-upkeep-test';
  let broadcasts=0;
  const row={id:'pending-refresh',chain_id:4663,wallet:generated.keeper,target:generated.contracts.market.address,target_code_hash:hash,job_key:'marketv2:eth-refresh:old',
    status:'prepared',tx_hash:hash,nonce:0,request_json:'{}',budget_json:'[]',metadata_json:'{}',confirmations:2,accounting_required:false,broadcast_attempts:0};
  const connection={query:async sql=>({rows:sql.includes('pg_try_advisory_lock')?[{acquired:true}]:sql.includes('FROM keeper_transactions')?[row]:[]}),release(){}};
  const f=fixture();f.account={address:generated.keeper};f.walletClient={};f.publicClient.sendRawTransaction=async()=>{broadcasts++;throw Error('Must not broadcast');};
  try{const result=await runMarketV2({connect:async()=>connection},generated,f,{dryRun:false});assert.equal(result.reason,'pending_target_not_approved');assert.equal(broadcasts,0);}
  finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
});
console.log(JSON.stringify({pass:true,groups,syntheticOnly:true,productionWrites:false,productionSigning:false}));
