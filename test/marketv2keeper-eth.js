import assert from 'node:assert/strict';
import {decodeFunctionData,keccak256,zeroAddress} from 'viem';
import {planMarketV2,validateMarketV2Manifest,marketV2Abi,runMarketV2} from '../src/marketv2keeper.js';
const A=n=>`0x${n.toString(16).padStart(40,'0')}`,code='0x60006000',hash=keccak256(code),now=1800000300;
const block={number:100n,timestamp:BigInt(now),hash:`0x${'ab'.repeat(32)}`};
const raw={schemaVersion:2,chainId:31337,keeper:A(1),governanceSafe:A(2),ethAutomation:{enabled:true,productionEnabled:false},
  contracts:{rewards:{address:A(9),runtimeHash:hash,artifact:'OmertaEthRewardsV2'},vault:{address:A(10),runtimeHash:hash,artifact:'OmertaEthStakingV2'},manager:{address:A(8),runtimeHash:hash,artifact:'OmertaPoolManagerV2'},market:{address:A(4),runtimeHash:hash,artifact:'OmertaMarketStateV2'}},
  gas:{maxGas:'1000000',maxFeePerGas:'1000000000',maxPriorityFeePerGas:'0',dailyBudget:'10000000000000000',confirmations:2,maxSnapshotAgeSeconds:60},
  jobs:[{id:'collect',kind:'eth_collect',target:'rewards',minimumAmount:'100',intervalSeconds:60},
    {id:'convert',kind:'eth_convert',target:'rewards',minimumAmount:'100',intervalSeconds:60},
    {id:'buy',kind:'eth_fund',target:'rewards',minimumAmount:'100',intervalSeconds:60},
    {id:'finalize',kind:'eth_finalize',target:'vault',epochId:'0',intervalSeconds:60}]};
const clone=x=>structuredClone(x);
function fixture(overrides={}){
  const reads=[],simulations=[];
  const settings={chainId:31337,keeper:A(1),safe:A(2),active:true,paused:false,routeConfigured:true,healthReady:true,vaultActive:true,
    native:900n,omr:900n,omrSpent:400n,nativeSpent:600n,currentEpoch:2n,finalized:false,owed:1000n,quoteNative:10n,recipient:A(9),distributor:A(9),code,...overrides};
  const policy={maxOmrPerCall:700n,maxOmrPerDay:1000n,maxNativePerCall:600n,maxNativePerDay:1000n,maxDeadlineDelay:300n};
  return{reads,simulations,publicClient:{
    getChainId:async()=>settings.chainId,getBlock:async()=>block,getCode:async()=>settings.code,
    getBalance:async req=>{assert.equal(req.blockNumber,block.number);assert.equal(req.address,A(9));return settings.native;},
    readContract:async req=>{
      assert.equal(req.blockNumber,block.number);reads.push(req);
      assert(req.abi.some(x=>x.type==='function'&&x.name===req.functionName),`Current compiled ABI lacks ${req.functionName}`);
      const at=req.address.toLowerCase(),fn=req.functionName;
      if(at===A(10))return({owner:settings.safe,governanceSafe:settings.safe,distributor:settings.distributor,distributorRuntimeHash:hash,active:settings.vaultActive,currentEpoch:settings.currentEpoch,epoch:{finalized:settings.finalized}})[fn];
      if(at===A(8))return fn==='owed'?settings.owed:fn==='rewardsRecipient'?settings.recipient:undefined;
      if(at===A(13)&&fn==='balanceOf')return settings.omr;
      const values={safe:settings.safe,keeper:settings.keeper,manager:A(8),rewardVault:A(10),marketState:A(4),omr:A(13),
        active:settings.active,paused:settings.paused,routeConfigured:settings.routeConfigured,healthReady:settings.healthReady,policy,
        omrConvertedOnDay:settings.omrSpent,nativeFundedOnDay:settings.nativeSpent,minimumNativeFor:settings.quoteNative};
      assert(fn in values,`Unexpected read ${at}.${fn}`);return values[fn];
    },
    simulateContract:async req=>{assert.equal(req.account,A(1));assert.equal(req.blockNumber,block.number);simulations.push(req);return{result:undefined};},
  }};
}
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log(`PASS ${name}`);};
await check('ETH jobs use conversion quote, remaining caps and zero-value typed funding calls',async()=>{
  const f=fixture(),p=await planMarketV2(raw,f,{now});
  assert.deepEqual(p.actions.map(x=>x.functionName),['collectTax','convertOmr','fundRewards','finalizeEpoch']);
  assert.deepEqual(p.actions[1].args,[600n,10n,block.timestamp+300n]);
  assert.deepEqual(p.actions[2].args,[400n]);
  assert.deepEqual(p.actions[3].args,[0n]);
  for(const row of p.actions){assert.equal(row.request.value,'0');assert.equal(row.gasBudget.limit,raw.gas.dailyBudget);
    const name=row.target===A(10)?'OmertaEthStakingV2':'OmertaEthRewardsV2';
    assert.equal(decodeFunctionData({abi:marketV2Abi(name),data:row.request.data}).functionName,row.functionName);}
  assert(f.reads.some(r=>r.functionName==='minimumNativeFor'&&r.args[0]===600n));
  assert.equal(f.reads.some(r=>['minimumBtcFor','routeConfigured','btcToken'].includes(r.functionName)),false);
});
await check('ETH automation and production are disabled unless explicitly enabled',async()=>{
  const absent=clone(raw);delete absent.ethAutomation;
  assert.equal((await planMarketV2(absent,fixture(),{now})).actions.length,0);
  const production=clone(raw);production.chainId=4663;
  assert.equal((await planMarketV2(production,fixture({chainId:4663}),{now})).actions.length,0);
  production.ethAutomation.productionEnabled=true;
  assert.equal((await planMarketV2(production,fixture({chainId:4663}),{now})).actions.length,4);
});
await check('conversion pause missing health and inactive conversion preserve native ETH funding and closed-epoch finalization',async()=>{
  for(const state of[{paused:true},{healthReady:false},{active:false}]){
    const p=await planMarketV2(raw,fixture(state),{now});assert.deepEqual(p.actions.map(a=>a.functionName),['collectTax','fundRewards','finalizeEpoch']);
  }
});
await check('empty inventory and exhausted caps prevent conversion/funding; zero quote blocks conversion alone',async()=>{
  for(const state of[{native:0n,omr:0n},{omrSpent:1000n,nativeSpent:1000n},{omrSpent:1001n,nativeSpent:1001n}]){
    assert.deepEqual((await planMarketV2(raw,fixture(state),{now})).actions.map(a=>a.functionName),['collectTax','finalizeEpoch']);
  }
  assert.deepEqual((await planMarketV2(raw,fixture({quoteNative:0n}),{now})).actions.map(a=>a.functionName),['collectTax','fundRewards','finalizeEpoch']);
  assert.equal((await planMarketV2(raw,fixture({owed:0n}),{now})).actions.some(a=>a.functionName==='collectTax'),false);
});
await check('keeper, governance, chain and runtime identity are mandatory',async()=>{
  await assert.rejects(()=>planMarketV2(raw,fixture({chainId:4663}),{now}),/wrong_chain/);
  await assert.rejects(()=>planMarketV2(raw,fixture({code:'0x6001'}),{now}),/runtime_mismatch/);
  assert.deepEqual((await planMarketV2(raw,fixture({keeper:A(3)}),{now})).actions.map(a=>a.functionName),['finalizeEpoch']);
  assert.equal((await planMarketV2(raw,fixture({safe:A(3)}),{now})).actions.length,0);
  for(const state of[{recipient:A(3)},{distributor:A(3)}])assert.deepEqual((await planMarketV2(raw,fixture(state),{now})).actions.map(a=>a.functionName),['finalizeEpoch']);
});
await check('native funding does not read conversion health market state or quote dependencies',async()=>{
  const onlyFunding=clone(raw);onlyFunding.jobs=[raw.jobs[2]];
  const f=fixture({active:false,paused:true,healthReady:false,quoteNative:0n});
  const p=await planMarketV2(onlyFunding,f,{now});assert.deepEqual(p.actions.map(a=>a.functionName),['fundRewards']);
  assert.equal(f.reads.some(r=>['healthReady','marketState','minimumNativeFor','snapshot','routeConfigured'].includes(r.functionName)),false);
  assert.equal((await planMarketV2(onlyFunding,fixture({vaultActive:false}),{now})).actions.length,0);
});
await check('finalization names one closed epoch and skips finalized/open/inactive vaults',async()=>{
  for(const state of[{currentEpoch:0n},{finalized:true},{vaultActive:false}]){
    assert.equal((await planMarketV2(raw,fixture(state),{now})).actions.some(a=>a.functionName==='finalizeEpoch'),false);
  }
  const invalid=clone(raw);invalid.jobs[3].epochId=String(1n<<64n);
  assert.throws(()=>validateMarketV2Manifest(invalid),/invalid_epoch/);
});
await check('omitted epoch automatically advances latest closed0→1→2 with no unbounded recovery scan',async()=>{
  const automatic=clone(raw);delete automatic.jobs[3].epochId;
  for(const currentEpoch of [1n,2n,3n]){
    const f=fixture({currentEpoch}),p=await planMarketV2(automatic,f,{now});
    assert.deepEqual(p.actions.find(a=>a.functionName==='finalizeEpoch').args,[currentEpoch-1n]);
    assert.equal(f.reads.filter(r=>r.functionName==='epoch').length,1);
  }
  for(const state of[{currentEpoch:0n},{currentEpoch:3n,finalized:true}])assert.equal((await planMarketV2(automatic,fixture(state),{now})).actions.some(a=>a.functionName==='finalizeEpoch'),false);
  assert.deepEqual((await planMarketV2(raw,fixture({currentEpoch:3n}),{now})).actions.find(a=>a.functionName==='finalizeEpoch').args,[0n],'Explicit older epoch remains bounded recovery');
});
await check('deadlines are positive, policy-bounded and cannot be smuggled into other jobs',async()=>{
  const invalid=clone(raw);invalid.jobs[1].deadlineSeconds=301;
  assert.equal((await planMarketV2(invalid,fixture(),{now})).actions.some(a=>a.functionName==='convertOmr'),false);
  invalid.jobs[1].deadlineSeconds=0;assert.throws(()=>validateMarketV2Manifest(invalid),/invalid_integer/);
  invalid.jobs[1].deadlineSeconds=3601;assert.throws(()=>validateMarketV2Manifest(invalid),/invalid_integer/);
  delete invalid.jobs[1].deadlineSeconds;invalid.jobs[0].deadlineSeconds=60;
  assert.throws(()=>validateMarketV2Manifest(invalid),/unexpected_deadline/);
});
await check('Safe-only configuration and health renewal are outside the keeper allowlist',async()=>{
  for(const kind of['activate','configureRoute','confirmHealthyUntil','unpause','setDistributor','setKeeper','transfer','approve','btc_collect','btc_purchase']){
    const invalid=clone(raw);invalid.jobs[0].kind=kind;assert.throws(()=>validateMarketV2Manifest(invalid),/invalid_job/);
  }
});
await check('disabled ETH flags prevent rebroadcast of a previously journaled ETH transaction',async()=>{
  const disabled=clone(raw);delete disabled.ethAutomation;
  let broadcasts=0;
  const row={id:'synthetic-pending',chain_id:31337,wallet:A(1),target:A(9),target_code_hash:hash,job_key:'eth:pending',status:'prepared',tx_hash:hash,nonce:0,
    request_json:'{}',budget_json:'[]',metadata_json:'{}',confirmations:2,accounting_required:false,broadcast_attempts:0};
  const connection={query:async sql=>({rows:sql.includes('pg_try_advisory_lock')?[{acquired:true}]:sql.includes('FROM keeper_transactions')?[row]:[]}),release(){}};
  const f=fixture();f.account={address:A(1)};f.walletClient={};
  f.publicClient.sendRawTransaction=async()=>{broadcasts++;throw Error('Synthetic pending transaction must never broadcast');};
  const previousDatabase=process.env.DATABASE_URL;process.env.DATABASE_URL='postgres://unused.invalid/eth-keeper-test';
  try{const result=await runMarketV2({connect:async()=>connection},disabled,f,{dryRun:false});
    assert.equal(result.reason,'pending_target_not_approved');assert.equal(broadcasts,0);
  }finally{if(previousDatabase===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousDatabase;}
});
console.log(JSON.stringify({pass:true,groups:checks,broadcast:false,syntheticOnly:true}));
