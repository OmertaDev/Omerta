import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeFunctionData,keccak256,toHex} from 'viem';
import {loadEthReadinessCandidate,checkEthRewardsReadiness,ethConversionFloor} from '../tools/eth-rewards-readiness.js';
const CODE='0x60006000',H=keccak256(CODE),A=n=>`0x${n.toString(16).padStart(40,'0')}`,T=1800000005n;
const base=JSON.parse(fs.readFileSync('test/fixtures/eth-readiness-candidate.json'));
const clone=x=>structuredClone(x),low=x=>String(x).toLowerCase();
const artifact=n=>JSON.parse(fs.readFileSync(`omerta-contracts/out/${n}.sol/${n}.json`)).abi;
function fixture(o={}){
  const c=clone(base),a=c.addresses,reads=[],simulations=[],writes=[];
  c.deployments.forEach(x=>{x.runtimeHash=H;});Object.keys(c.runtimeHashes).forEach(k=>{c.runtimeHashes[k]=H;});
  for(const k of ['runtimeHash','singletonRuntimeHash','fallbackHandlerRuntimeHash'])c.governance[k]=H;
  const policy=Object.fromEntries(Object.entries(c.eth.policy).map(([k,v])=>[k,BigInt(v)]));
  const state={active:false,paused:true,since:0n,until:0n,...o};
  const healthy=state.since>0n&&T<state.until&&T>=state.since+policy.recoveryGrace;
  let clock=1800000000000,heads=0;
  const roles=Object.fromEntries(c.deployments.map(x=>[low(x.address),x.role]));
  const client={getChainId:async()=>o.wrongChain?1:4663,
    getBlock:async q=>q?.blockNumber!==undefined?{number:101n,timestamp:T,hash:o.reorg?`0x${'cd'.repeat(32)}`:`0x${'ab'.repeat(32)}`}:
      {number:++heads===1?100n:o.stalled?100n:101n,timestamp:(heads===1?T-5n:T)+(o.future?1000n:o.stale?-1000n:0n),hash:`0x${'ab'.repeat(32)}`},
    getCode:async q=>o.absent&&roles[low(q.address)]?'0x':o.badRuntime&&roles[low(q.address)]?'0x6001':CODE,
    getBalance:async q=>low(q.address)===low(a.ethRewards)&&o.noFunds?0n:10n**18n,
    getTransactionCount:async()=>58,
    getStorageAt:async q=>BigInt(q.slot)===0n?`0x${(o.badSingleton?A(42):c.governance.singleton).slice(2).padStart(64,'0')}`:
      q.slot===keccak256(`0x${Buffer.from('guard_manager.guard.address').toString('hex')}`)?toHex(o.guard?1n:0n,{size:32}):`0x${(o.badHandler?A(42):c.governance.fallbackHandler).slice(2).padStart(64,'0')}`,
    readContract:async q=>{
      reads.push(q);assert(q.abi.some(x=>x.type==='function'&&x.name===q.functionName),`Compiled ABI missing ${q.functionName}`);
      if(q.blockNumber!==undefined)assert.equal(q.blockNumber,101n);
      const addr=low(q.address),fn=q.functionName;
      if(addr===low(c.roles.safe)){
        if(fn==='getOwners')return o.badOwners?[A(41),A(42),A(43)]:c.governance.owners;
        if(fn==='getThreshold')return o.badThreshold?1n:2n;
        if(fn==='nonce')return o.nonceChanged&&q.blockNumber===undefined?124n:123n;
        if(fn==='VERSION')return '1.4.1';
        if(fn==='getModulesPaginated')return o.module?[[A(42)],A(1)]:[[],A(1)];
        if(fn==='getTransactionHash')return keccak256(toHex(JSON.stringify(q.args,(_k,v)=>typeof v==='bigint'?String(v):v)));
      }
      if(addr===low(a.ethRewards))return({safe:c.roles.safe,keeper:o.badKeeper?A(42):c.eth.keeper,omr:a.omr,rewardVault:a.ethStaking,
        manager:a.poolManager,canonicalRouter:a.router,marketState:a.marketState,canonicalPoolId:c.canonicalPool.poolId,
        omrRuntimeHash:H,rewardVaultRuntimeHash:H,managerRuntimeHash:H,canonicalRouterRuntimeHash:H,marketStateRuntimeHash:H,canonicalHookRuntimeHash:H,
        active:state.active,paused:state.paused,healthReady:o.healthLie?!healthy:healthy,healthySince:state.since,healthValidUntil:state.until,
        policy,nativeFundedOnDay:o.capSpent?policy.maxNativePerDay:0n,poolKey:c.canonicalPool})[fn];
      if(addr===low(a.ethStaking))return({owner:c.roles.safe,governanceSafe:c.roles.safe,omr:a.omr,distributor:o.badDistributor?A(42):a.ethRewards,distributorRuntimeHash:H,active:!o.vaultInactive,EPOCH_DURATION:o.badEpoch?86400n:2592000n,LOCK_DURATION:o.badLock?0n:2592000n})[fn];
      if(addr===low(a.omr))return({policySealed:true,settlementManager:a.poolManager,isOperator:true,operatorRole:low(q.args[0])===low(a.ethStaking)?2:0,
        isRecipient:true,contractHolderRuntimeHash:H,owner:c.roles.safe,genesisTreasury:c.roles.safe})[fn];
      if(addr===low(a.poolManager))return({owner:c.roles.safe,omr:a.omr,rewardsRecipient:o.badRecipient?A(42):a.ethRewards,
        developerRecipient:c.roles.dev,rwaRecipient:c.roles.rwa,communityRecipient:c.roles.community,polRecipient:a.polFunding,
        revenuePolicyId:keccak256(toHex('OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_ETH_STAKERS_BOTH_DIRECTIONS')),TRADE_FEE_BPS:400})[fn];
      if(addr===low(a.coordinator)&&fn==='playerClaimsOpen')return !o.gameClosed;
      if(addr===low(a.marketState)&&fn==='snapshot')return{valid:!o.marketInvalid,epoch:1n,minLiquidity:1n,omrPerEth:10n**22n,
        observedAt:o.marketStale?T-10000n:o.marketFuture?T+1n:T,stressBps:o.marketStress?10001n:0n};
      throw Error(`Unexpected read ${addr}.${fn}`);
    },
    simulateContract:async q=>{simulations.push(q);assert.equal(q.blockNumber,101n);
      if(q.functionName==='fundRewards'){assert.equal(q.account,c.eth.keeper);if(o.fundSimulationFail)throw Error('Synthetic funding rejection');}
      else{assert.equal(q.account,c.roles.safe);assert(['confirmHealthyUntil','activate','unpause'].includes(q.functionName));if(o.safeSimulationFail)throw Error('Synthetic Safe call rejection');}
      return{};},
  };
  for(const n of ['sendTransaction','sendRawTransaction','signTransaction','writeContract','request'])client[n]=()=>{writes.push(n);throw Error('Forbidden write RPC');};
  return{c,client,reads,simulations,writes,options:{nowMs:()=>clock,sleep:async ms=>{assert.equal(ms,5000);clock+=o.skipWait?0:ms;}}};
}
let groups=0;
const test=async(n,fn)=>{await fn();groups++;console.log(`PASS ${n}`);};
const run=async(o={},mutate)=>{const f=fixture(o);mutate?.(f);const result=await checkEthRewardsReadiness(f.c,f.client,f.options);assert.equal(f.writes.length,0);return{...f,result};};

await test('explicit reviewed ETH candidate and SHA are required, with no fallback to older setup',async()=>{
  assert.throws(()=>loadEthReadinessCandidate(),/explicit_reviewed_candidate_required/);
  assert.throws(()=>loadEthReadinessCandidate('test/fixtures/eth-readiness-candidate.json','0'.repeat(64)),/candidate_sha_mismatch/);
});
await test('ETH funding is an unsigned permissionless zero-value call while conversion waits for Safe lease',async()=>{
  const f=await run();assert.equal(f.result.status,'HEALTH_LEASE_PROPOSAL');assert.equal(f.result.fundingReady,true);assert.equal(f.result.conversionReady,false);
  assert.equal(f.result.safeCalls.length,1);assert.equal(f.result.safeCalls[0].method,'confirmHealthyUntil');assert.equal(f.result.safeCalls[0].safeNonce,'123');
  assert.equal(f.result.safeCalls[0].value,'0');assert.equal(f.result.safeCalls[0].operation,0);assert.equal(f.result.safeCalls[0].to,f.c.addresses.ethRewards);
  assert.equal(f.result.fundingCall.method,'fundRewards');assert.equal(f.result.fundingCall.value,'0');assert.equal(f.result.fundingCall.permissionless,true);
  assert(f.simulations.some(x=>x.functionName==='confirmHealthyUntil'&&x.account===f.c.roles.safe));
  assert.equal(decodeFunctionData({abi:artifact('OmertaEthRewardsV2'),data:f.result.fundingCall.data}).functionName,'fundRewards');
});
await test('native funding survives stale missing or stressed market and the launch conversion gate',async()=>{
  for(const key of ['marketInvalid','marketStale','marketFuture','marketStress','gameClosed']){
    const {result}=await run({[key]:true});assert.equal(result.fundingReady,true,key);assert.equal(result.status,'FUNDING_ONLY',key);assert.equal(result.safeCalls.length,0);
    assert.equal(result.fundingCall.expiresAt,String(T+60n));assert.equal(result.expiryIsOffchainReviewMetadata,true);
  }
});
await test('failed Safe-call simulation clears conversion proposals and preserves valid native funding',async()=>{
  for(const state of [{},{since:T-700n,until:T+1000n},{active:true,since:T-700n,until:T+1000n}]){
    const{result}=await run({...state,safeSimulationFail:true});assert.equal(result.status,'FUNDING_ONLY');assert.equal(result.fundingReady,true);assert.equal(result.conversionReady,false);assert.equal(result.safeCalls.length,0);assert.equal(result.fundingCall.expiresAt,String(T+60n));
  }
});
await test('funding uses actual balance and bounded remaining native caps without WBTC or quote reads',async()=>{
  for(const key of ['noFunds','capSpent']){const{result}=await run({[key]:true});assert.equal(result.fundingReady,false);assert.equal(result.fundingCall,null);assert.equal(result.status,'HEALTH_LEASE_PROPOSAL');}
  const f=await run();assert.equal(f.reads.some(r=>/btc|routeConfigured|^route$|feed|quoter/i.test(r.functionName)),false);
  const tooLarge=await run({},f=>{f.options.amountWei='999999999999999999999999';});assert.equal(tooLarge.result.fundingReady,false);assert.equal(tooLarge.result.fundingCall,null);
});
await test('recovery grace requires actual later health state and never batches activation with initial lease',async()=>{
  const wait=await run({since:T-100n,until:T+1000n});assert.equal(wait.result.status,'WAITING_RECOVERY_GRACE');assert.equal(wait.result.safeCalls.length,0);assert.equal(wait.result.fundingReady,true);
  const activation=await run({since:T-700n,until:T+1000n});assert.equal(activation.result.status,'CONVERSION_ACTIVATION_PROPOSAL');assert.equal(activation.result.safeCalls[0].method,'activate');
  const resume=await run({active:true,since:T-700n,until:T+1000n});assert.equal(resume.result.status,'CONVERSION_UNPAUSE_PROPOSAL');assert.equal(resume.result.safeCalls[0].method,'unpause');
  const healthy=await run({active:true,paused:false,since:T-700n,until:T+1000n});assert.equal(healthy.result.conversionReady,true);assert.equal(healthy.result.safeCalls.length,0);
  const expired=await run({active:true,paused:false,since:T-700n,until:T-1n});assert.equal(expired.result.status,'HEALTH_LEASE_PROPOSAL');assert.equal(expired.result.safeCalls[0].method,'confirmHealthyUntil');
});
await test('missing or wrong runtime deployments block calls before querying missing contracts',async()=>{
  const f=await run({absent:true});assert.equal(f.result.status,'BLOCKED');assert.equal(f.result.observations.undeployedRoles.length,36);assert.equal(f.result.fundingCall,null);assert.equal(f.result.safeCalls.length,0);
  const missing=new Set(f.c.deployments.map(x=>low(x.address)));assert.equal(f.reads.some(r=>missing.has(low(r.address))),false);
  const wrong=await run({badRuntime:true});assert.equal(wrong.result.observations.mismatchedRoles.length,36);assert.equal(wrong.result.fundingReady,false);
});
await test('Safe owners threshold singleton guard fallback modules and nonce drift remain pinned',async()=>{
  for(const key of ['badOwners','badThreshold','badSingleton','guard','badHandler','module','nonceChanged']){
    const {result}=await run({[key]:true});assert.equal(result.status,'BLOCKED',key);assert.equal(result.fundingReady,false,key);assert.equal(result.safeCalls.length,0);assert.equal(result.fundingCall,null);
  }
});
await test('vault distributor collector recipient and keeper mismatches reject all funding proposals',async()=>{
  for(const key of ['vaultInactive','badDistributor','badRecipient','badKeeper','badEpoch','badLock','fundSimulationFail']){
    const{result}=await run({[key]:true});assert.equal(result.status,'BLOCKED',key);assert.equal(result.fundingReady,false);assert.equal(result.fundingCall,null);assert.equal(result.safeCalls.length,0);
  }
});
await test('wrong chain stalled stale future insufficient wait and reorg invalidate evidence',async()=>{
  for(const key of ['wrongChain','stalled','stale','future','skipWait','reorg']){const{result}=await run({[key]:true});assert.equal(result.status,'BLOCKED',key);assert.equal(result.fundingReady,false);assert.equal(result.fundingCall,null);assert.equal(result.safeCalls.length,0);}
});
await test('conversion floor includes canonical LP fee full450bps protocol ceiling and slippage',async()=>{
  const amount=10n**22n,price=10n**22n,fee=3000n,slip=500n;
  assert.equal(ethConversionFloor(amount,price,fee,slip),((10n**18n*997000n/1000000n)*9550n/10000n)*9500n/10000n);
  assert.throws(()=>ethConversionFloor(1n,price,fee,slip),/zero_conversion_minimum/);
});
console.log(JSON.stringify({pass:true,groups,syntheticOnly:true,productionWrites:false,productionSigning:false}));
