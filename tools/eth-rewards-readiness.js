#!/usr/bin/env node
// Public reads and unsigned calls only. Funding ETH does not depend on conversion health.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createPublicClient,http,parseAbi,encodeFunctionData,keccak256,zeroAddress} from 'viem';
import {buildPlayerGenesisDeploymentPlan} from './player-genesis-deployment-plan.js';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const H=/^0x[\da-f]{64}$/i;
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=x=>JSON.stringify(x,(_k,v)=>typeof v==='bigint'?String(v):v,2)+'\n';
const low=x=>String(x).toLowerCase();
const requireThat=(value,code)=>{if(!value)throw Object.assign(Error(code),{readinessCode:code});};
const uint=v=>{requireThat(/^(0|[1-9]\d*)$/.test(String(v??'')),'invalid_amount');const n=BigInt(v);requireThat(n>0n&&n<1n<<256n,'invalid_amount');return n;};
const norm=v=>typeof v==='bigint'?String(v):Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,norm(v[k])])):typeof v==='string'?low(v):v;
const equal=(a,b)=>json(norm(a))===json(norm(b));
const abi=n=>JSON.parse(fs.readFileSync(path.join(ROOT,`omerta-contracts/out/${n}.sol/${n}.json`))).abi;
const safeAbi=parseAbi(['function getOwners() view returns(address[])','function getThreshold() view returns(uint256)','function nonce() view returns(uint256)',
  'function VERSION() view returns(string)','function getModulesPaginated(address,uint256) view returns(address[] array,address next)',
  'function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns(bytes32)']);
const tokenAbi=parseAbi(['function balanceOf(address) view returns(uint256)']);

export function loadEthReadinessCandidate(resultPath,expectedSha256){
  requireThat(typeof resultPath==='string'&&/^[\da-f]{64}$/i.test(expectedSha256),'explicit_reviewed_candidate_required');
  const file=path.resolve(ROOT,resultPath),bytes=fs.readFileSync(file),r=JSON.parse(bytes);
  requireThat(sha(bytes)===low(expectedSha256),'candidate_sha_mismatch');
  requireThat(r.status==='PASS'&&r.chainId===4663&&r.deployments.length===36,'candidate_scope_invalid');
  const input=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'prepared-input.json'))),p=buildPlayerGenesisDeploymentPlan(input);
  requireThat(p.manifestSha256===r.prepared.manifestSha256,'candidate_manifest_mismatch');
  requireThat(p.ethRewards?.rewardAsset==='native ETH','candidate_not_native_eth');
  return{chainId:4663,resultSha256:sha(bytes),deployments:r.deployments.map(({role,address,runtimeHash})=>({role,address,runtimeHash})),
    addresses:r.addresses,roles:p.roles,governance:p.governance,runtimeHashes:p.runtimeHashes,canonicalPool:p.canonicalPool,eth:p.ethRewards};
}

export function ethConversionFloor(amount,omrPerEth,lpFee,slippage){
  let quoted=amount*10n**18n/omrPerEth;
  quoted=quoted*(1000000n-lpFee)/1000000n;
  quoted=quoted*(10000n-450n)/10000n;
  const minimum=quoted*(10000n-slippage)/10000n;
  requireThat(minimum>0n,'zero_conversion_minimum');return minimum;
}

export async function checkEthRewardsReadiness(c,client,{amountWei,maxHeadAgeSeconds=60,
  nowMs=()=>Date.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  const out={schemaVersion:1,chainId:4663,status:'BLOCKED',fundingReady:false,conversionReady:false,proposalOnly:true,
    productionWrites:false,productionSigning:false,candidateSha256:c.resultSha256,toolSourceSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    fundingRequiresHealth:false,conversionRequiresHealth:true,safeCalls:[],fundingCall:null,blockers:[],observations:{},
    caveats:['Native ETH funding does not require conversion health.','Advancing headers do not prove sequencer uptime.',
      'Safe health leases are manual operational attestations; unsigned calls do not set health.','Recheck state and nonce before signing; report expiry is not an onchain deadline.']};
  let block;
  const read=(address,contractAbi,functionName,args=[])=>client.readContract({address,abi:contractAbi,functionName,args,blockNumber:block.number});
  const fields=async(address,contractAbi,names)=>Object.fromEntries(await Promise.all(names.map(async n=>[n,await read(address,contractAbi,n)])));
  const code=async(label,address,expected)=>{const value=await client.getCode({address,blockNumber:block.number})||'0x';
    const row={label,address,codeBytes:(value.length-2)/2,runtimeHash:keccak256(value),expected};(out.observations.code??=[]).push(row);
    return{present:value!=='0x',matches:value!=='0x'&&low(row.runtimeHash)===low(expected)};};
  const fresh=b=>H.test(b?.hash)&&b.number!==null&&b.timestamp<=BigInt(Math.floor(nowMs()/1000))+5n&&BigInt(Math.floor(nowMs()/1000))-b.timestamp<=BigInt(maxHeadAgeSeconds);
  try{
    requireThat(c.chainId===4663&&await client.getChainId()===4663,'wrong_chain');
    requireThat(Number.isInteger(maxHeadAgeSeconds)&&maxHeadAgeSeconds>=5&&maxHeadAgeSeconds<=300,'invalid_freshness_limit');
    const first=await client.getBlock({blockTag:'latest'}),started=nowMs();requireThat(fresh(first),'first_head_stale_or_future');
    await sleep(5000);block=await client.getBlock({blockTag:'latest'});requireThat(nowMs()-started>=5000,'insufficient_head_observation');
    requireThat(fresh(block),'second_head_stale_or_future');requireThat(block.number>first.number&&block.timestamp>first.timestamp,'heads_not_advancing');
    out.observations.heads=[first,block];requireThat(c.deployments.length===36,'candidate_scope_invalid');
    const missing=[],mismatch=[];
    for(let i=0;i<36;i+=6)await Promise.all(c.deployments.slice(i,i+6).map(async d=>{const x=await code(d.role,d.address,d.runtimeHash);if(!x.present)missing.push(d.role);else if(!x.matches)mismatch.push(d.role);}));
    out.observations.undeployedRoles=missing;out.observations.mismatchedRoles=mismatch;
    requireThat((await code('governanceSafe',c.roles.safe,c.governance.runtimeHash)).matches,'safe_runtime_mismatch');
    const safe=await fields(c.roles.safe,safeAbi,['getOwners','getThreshold','nonce','VERSION']);out.observations.safe=safe;
    out.observations.deployer={address:c.roles.deployer,nonce:await client.getTransactionCount({address:c.roles.deployer,blockNumber:block.number}),
      pendingNonce:await client.getTransactionCount({address:c.roles.deployer,blockTag:'pending'}),balanceWei:await client.getBalance({address:c.roles.deployer,blockNumber:block.number})};
    requireThat(safe.getThreshold===2n&&safe.getOwners.length===3&&c.governance.threshold===2,'safe_not_two_of_three');
    requireThat(equal(safe.getOwners.map(low).sort(),c.governance.owners.map(low).sort())&&safe.VERSION==='1.4.1','safe_identity_mismatch');
    if(missing.length)out.blockers.push('contracts_undeployed');if(mismatch.length)out.blockers.push('deployment_runtime_mismatch');
    requireThat(!missing.length&&!mismatch.length,'contracts_not_ready');
    for(const[name,address,hash]of[['singleton',c.governance.singleton,c.governance.singletonRuntimeHash],['fallbackHandler',c.governance.fallbackHandler,c.governance.fallbackHandlerRuntimeHash]])requireThat((await code(name,address,hash)).matches,`safe_${name}_runtime_mismatch`);
    const slot=async text=>client.getStorageAt({address:c.roles.safe,slot:text==='singleton'?`0x${'00'.repeat(32)}`:keccak256(`0x${Buffer.from(text).toString('hex')}`),blockNumber:block.number});
    requireThat(low((await slot('singleton')).slice(-40))===low(c.governance.singleton.slice(2)),'safe_singleton_storage_mismatch');
    requireThat(BigInt(await slot('guard_manager.guard.address'))===0n,'safe_guard_present');
    requireThat(low((await slot('fallback_manager.handler.address')).slice(-40))===low(c.governance.fallbackHandler.slice(2)),'safe_fallback_storage_mismatch');
    const sentinel='0x0000000000000000000000000000000000000001',[modules,next]=await read(c.roles.safe,safeAbi,'getModulesPaginated',[sentinel,1n]);
    requireThat(modules.length===0&&low(next)===sentinel,'safe_module_present');
    const a=c.addresses,rewardsAbi=abi('OmertaEthRewardsV2'),vaultAbi=abi('OmertaEthStakingV2');
    const d=await fields(a.ethRewards,rewardsAbi,['safe','keeper','omr','rewardVault','manager','canonicalRouter','marketState','omrRuntimeHash',
      'rewardVaultRuntimeHash','managerRuntimeHash','canonicalRouterRuntimeHash','marketStateRuntimeHash','canonicalHookRuntimeHash','active','paused','healthReady','healthySince','healthValidUntil','canonicalPoolId','policy']);
    const v=await fields(a.ethStaking,vaultAbi,['owner','governanceSafe','omr','distributor','distributorRuntimeHash','active','EPOCH_DURATION','LOCK_DURATION']);
    requireThat(BigInt(v.EPOCH_DURATION)===2592000n&&BigInt(v.LOCK_DURATION)===2592000n,'staking_terms_mismatch');
    out.observations.distributor=d;out.observations.vault=v;
    for(const[k,expected]of Object.entries({safe:c.roles.safe,keeper:c.eth.keeper,omr:a.omr,rewardVault:a.ethStaking,manager:a.poolManager,
      canonicalRouter:a.router,marketState:a.marketState,canonicalPoolId:c.canonicalPool.poolId,omrRuntimeHash:c.runtimeHashes.omr,
      rewardVaultRuntimeHash:c.runtimeHashes.ethStaking,managerRuntimeHash:c.runtimeHashes.poolManager,canonicalRouterRuntimeHash:c.runtimeHashes.router,marketStateRuntimeHash:c.runtimeHashes.marketState,canonicalHookRuntimeHash:c.runtimeHashes.hook}))requireThat(low(d[k])===low(expected),`distributor_${k}_mismatch`);
    for(const[k,expected]of Object.entries({owner:c.roles.safe,governanceSafe:c.roles.safe,omr:a.omr,distributor:a.ethRewards,distributorRuntimeHash:c.runtimeHashes.ethRewards}))requireThat(low(v[k])===low(expected),`vault_${k}_mismatch`);
    requireThat(v.active===true,'vault_inactive');requireThat(equal(d.policy,c.eth.policy),'distributor_policy_mismatch');
    const omrAbi=abi('OmertaRestrictedOMRV2'),managerAbi=abi('OmertaPoolManagerV2');
    requireThat(await read(a.omr,omrAbi,'policySealed'),'omr_policy_unsealed');
    requireThat(low(await read(a.omr,omrAbi,'settlementManager'))===low(a.poolManager),'omr_manager_mismatch');
    requireThat(await read(a.omr,omrAbi,'isOperator',[a.ethStaking])&&Number(await read(a.omr,omrAbi,'operatorRole',[a.ethStaking]))===2,'vault_role_invalid');
    requireThat(await read(a.omr,omrAbi,'isRecipient',[a.ethRewards])&&Number(await read(a.omr,omrAbi,'operatorRole',[a.ethRewards]))===0,'distributor_receiving_role_invalid');
    requireThat(low(await read(a.omr,omrAbi,'contractHolderRuntimeHash',[a.ethRewards]))===low(c.runtimeHashes.ethRewards),'distributor_holder_runtime_mismatch');
    requireThat(low(await read(a.omr,omrAbi,'owner'))===low(c.roles.safe)&&low(await read(a.omr,omrAbi,'genesisTreasury'))===low(c.roles.safe),'token_governance_mismatch');
    const m=await fields(a.poolManager,managerAbi,['owner','omr','rewardsRecipient','developerRecipient','rwaRecipient','communityRecipient','polRecipient','revenuePolicyId','TRADE_FEE_BPS']);
    requireThat(low(m.owner)===low(c.roles.safe)&&low(m.omr)===low(a.omr)&&low(m.rewardsRecipient)===low(a.ethRewards),'manager_binding_mismatch');
    requireThat(low(m.revenuePolicyId)===low(keccak256('0x'+Buffer.from('OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_ETH_STAKERS_BOTH_DIRECTIONS').toString('hex')))&&Number(m.TRADE_FEE_BPS)===400,'manager_policy_mismatch');
    requireThat(low(m.developerRecipient)===low(c.roles.dev)&&low(m.rwaRecipient)===low(c.roles.rwa)&&low(m.communityRecipient)===low(c.roles.community)&&low(m.polRecipient)===low(a.polFunding),'original_revenue_recipient_mismatch');
    const key=await read(a.ethRewards,rewardsAbi,'poolKey');for(const k of ['currency0','currency1','fee','tickSpacing','hooks'])requireThat(low(key[k])===low(c.canonicalPool[k]),'canonical_pool_key_mismatch');
    out.safeNonce=String(safe.nonce);out.expiresAt=String(block.timestamp+BigInt(maxHeadAgeSeconds));out.expiryIsOffchainReviewMetadata=true;
    const p=d.policy,day=block.timestamp/86400n,nativeFunded=BigInt(await read(a.ethRewards,rewardsAbi,'nativeFundedOnDay',[day]));
    const nativeBalance=BigInt(await client.getBalance({address:a.ethRewards,blockNumber:block.number})),remaining=BigInt(p.maxNativePerDay)-nativeFunded;
    const capacity=[nativeBalance,BigInt(p.maxNativePerCall),remaining].reduce((x,y)=>x<y?x:y);
    const fundingAmount=amountWei===undefined?capacity:uint(amountWei);out.observations.funding={nativeBalance,nativeFunded,remaining,capacity,requested:fundingAmount};
    if(fundingAmount>0n&&fundingAmount<=capacity){
      await client.simulateContract({address:a.ethRewards,abi:rewardsAbi,functionName:'fundRewards',args:[fundingAmount],account:c.eth.keeper,blockNumber:block.number});
      out.fundingReady=true;out.fundingCall={from:c.eth.keeper,to:a.ethRewards,value:'0',data:encodeFunctionData({abi:rewardsAbi,functionName:'fundRewards',args:[fundingAmount]}),method:'fundRewards',args:[fundingAmount],expiresAt:out.expiresAt,permissionless:true,proposalOnly:true};
    }else out.observations.funding.reason=fundingAmount>capacity?'funding_cap_or_balance_exceeded':'no_native_inventory_or_remaining_cap';
    requireThat(await read(a.coordinator,abi('OmertaGenesisCoordinatorV2'),'playerClaimsOpen'),'game_launch_gate_closed');
    const market=await read(a.marketState,abi('OmertaMarketStateV2'),'snapshot');out.observations.market=market;
    requireThat(market.valid&&BigInt(market.epoch)>0n&&BigInt(market.minLiquidity)>0n&&BigInt(market.omrPerEth)>0n,'market_invalid');
    requireThat(BigInt(market.observedAt)>0n&&BigInt(market.observedAt)<=block.timestamp&&block.timestamp-BigInt(market.observedAt)<=BigInt(p.maxMarketAge),'market_stale_or_future');
    requireThat(BigInt(market.stressBps)<=BigInt(p.maxStressBps),'market_stress_exceeded');
    const since=BigInt(d.healthySince),until=BigInt(d.healthValidUntil),grace=BigInt(p.recoveryGrace),lease=BigInt(p.maxHealthLease);
    requireThat(grace>0n&&lease>grace&&lease<=3600n&&BigInt(p.maxDeadlineDelay)>0n&&BigInt(p.maxDeadlineDelay)<=3600n,'invalid_live_policy');
    requireThat(since<=block.timestamp&&until<=block.timestamp+lease,'invalid_live_health_state');
    const health=since>0n&&block.timestamp<until&&block.timestamp>=since+grace;
    requireThat(Boolean(d.healthReady)===health,'health_getter_inconsistent');requireThat(d.active||d.paused,'conversion_state_inconsistent');
    const propose=async(method,args)=>{const nonce=BigInt(safe.nonce)+BigInt(out.safeCalls.length),data=encodeFunctionData({abi:rewardsAbi,functionName:method,args});
      await client.simulateContract({address:a.ethRewards,abi:rewardsAbi,functionName:method,args,account:c.roles.safe,blockNumber:block.number});
      const safeTransactionHash=await read(c.roles.safe,safeAbi,'getTransactionHash',[a.ethRewards,0n,data,0,0n,0n,0n,zeroAddress,zeroAddress,nonce]);requireThat(H.test(safeTransactionHash),'safe_transaction_hash_invalid');
      out.safeCalls.push({method,args,from:c.roles.safe,to:a.ethRewards,value:'0',operation:0,data,safeNonce:String(nonce),safeTransactionHash,expiresAt:out.expiresAt,proposalOnly:true,signaturesProduced:false});};
    if(!health&&(!since||until<=block.timestamp)){await propose('confirmHealthyUntil',[block.timestamp+lease]);out.status='HEALTH_LEASE_PROPOSAL';out.nextStep=`After actual Safe execution wait at least ${grace} seconds, refresh the OMR market, then rerun. Native funding remains independent.`;}
    else if(!health){out.status='WAITING_RECOVERY_GRACE';out.blockers.push('recovery_grace_not_elapsed');out.reobserveAt=String(since+grace);}
    else if(!d.active){await propose('activate',[]);out.status='CONVERSION_ACTIVATION_PROPOSAL';}
    else if(d.paused){await propose('unpause',[]);out.status='CONVERSION_UNPAUSE_PROPOSAL';}
    else{out.status='CONVERSION_READY';out.conversionReady=true;out.conversionReadinessScope='Observed activation, pause, health and market state; each actual amount, minimum output, remaining cap and deadline still requires keeper simulation.';}
  }catch(e){if(!out.blockers.length)out.blockers.push(e.readinessCode||'read_or_proof_rejected');out.error=e.message;out.safeCalls=[];if(out.fundingReady)out.status='FUNDING_ONLY';}
  if(block)try{requireThat((await client.getBlock({blockNumber:block.number})).hash===block.hash,'snapshot_reorg');requireThat(fresh(block),'snapshot_expired');
    if(out.observations.safe)requireThat(BigInt(await client.readContract({address:c.roles.safe,abi:safeAbi,functionName:'nonce'}))===BigInt(out.observations.safe.nonce),'safe_nonce_changed');}
    catch(e){out.status='BLOCKED';out.fundingReady=false;out.conversionReady=false;out.fundingCall=null;out.safeCalls=[];out.blockers.push(e.readinessCode||'snapshot_recheck_failed');}
  out.readEvidenceSha256=sha(json(out.observations));for(const call of [...out.safeCalls,...(out.fundingCall?[out.fundingCall]:[])])call.readEvidenceSha256=out.readEvidenceSha256;
  out.observedAt=new Date(nowMs()).toISOString();return out;
}

async function main(){
  const options={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i],v=process.argv[i+1];requireThat(['--candidate','--expected-sha','--amount-wei','--output'].includes(k)&&v&&!options[k],'invalid_cli_arguments');options[k]=v;}
  const candidate=loadEthReadinessCandidate(options['--candidate'],options['--expected-sha']);
  const client=createPublicClient({transport:http('https://rpc.mainnet.chain.robinhood.com',{timeout:15000,retryCount:1}),cacheTime:0});
  const report=await checkEthRewardsReadiness(candidate,client,{amountWei:options['--amount-wei']});
  if(options['--output'])fs.writeFileSync(path.resolve(options['--output']),json(report),{flag:'wx'});console.log(json(report));
  if(report.status==='BLOCKED'||report.status==='WAITING_RECOVERY_GRACE')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(json({status:'BLOCKED',reason:e.readinessCode||e.message,productionWrites:false}));process.exitCode=2;});
