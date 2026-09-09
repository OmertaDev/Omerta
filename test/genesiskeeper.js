// Synthetic RPC evidence only: distinct ArbSys and L2 domains, true/failed migration receipts,
// bounded discovery, actual NFT custody and the closed controller calls.
import assert from 'node:assert/strict';
import { decodeEventLog, decodeFunctionData, encodeAbiParameters, encodeEventTopics, keccak256, parseAbi, parseAbiParameters, zeroAddress } from 'viem';
import { planLiquidityActions, readLiquiditySnapshot, validateLiquidityManifest } from '../src/liquiditykeeper.js';

const a=(n)=>`0x${n.toString(16).padStart(40,'0')}`;
const CODE='0x60006000',HASH=keccak256(CODE),BLOCK=`0x${'ab'.repeat(32)}`,TX=`0x${'cd'.repeat(32)}`,ETH=10n**18n;
const EVENT=parseAbi(['event MigrationObserved(bool succeeded)']);
const STRATEGY=parseAbi(['event Migrated(address indexed initializer,(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) indexed key,uint160 initialSqrtPriceX96,bytes plan)']);
const NFT=parseAbi(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)']);
let passed=0;const check=(s)=>{passed++;console.log(`PASS ${s}`);};

function fixture(o={}) {
  const phase=o.phase??4,head=o.largeScan?5000n:100n,now=BigInt(Math.floor(Date.now()/1000));
  const contractNames=['omr','poolManager','oracle','polVault','genesisController','auction','strategy','splitter','positionManager','gasVault'];
  const contracts=Object.fromEntries(contractNames.map((n,i)=>[n,{address:a(10+i),runtimeHash:HASH}]));
  const key={currency0:zeroAddress,currency1:contracts.omr.address,fee:3000,tickSpacing:60,hooks:a(60)};
  const poolId=keccak256(encodeAbiParameters(parseAbiParameters('address,address,uint24,int24,address'),Object.values(key)));
  const m={schemaVersion:1,chainId:4663,governanceSafe:a(1),keeper:a(2),poolId,contracts,indexing:{startL2Block:'1',maxBlocks:2000},
    genesis:{treasuryRecipient:a(3),vigRecipient:a(4),founderRecipient:a(5),genesisStartL2Block:'50',maxLogScanBlocks:1000000,maxCandidatePositions:32},
    gas:{maxGas:'100000',maxFeePerGas:'1000',maxPriorityFeePerGas:'100',dailyBudget:String(ETH),confirmations:2,maxSnapshotAgeSeconds:60},
    jobs:['genesis_checkpoint','genesis_migrate','genesis_accept_foundation','genesis_sweep_unsold','genesis_distribute'].map(kind=>({id:kind,kind,target:'genesisController',intervalSeconds:60}))};
  const names=Object.fromEntries(Object.entries(contracts).map(([name,c])=>[c.address,name]));
  const scans=[],simulated=[];
  const initialized=[4,5].includes(phase)&&!o.notMigrated,positionId=phase===5||o.adopted?99n:0n;
  const registered=[1,2].includes(phase)||o.uncleared?contracts.auction.address:zeroAddress;
  const tokenIds=o.ambiguous?[99n,100n]:[99n];
  const receiptLogs=[];
  if(!o.missingMigrationEvent) {
    if(o.externalMigration)receiptLogs.push({address:contracts.strategy.address,
      topics:[...encodeEventTopics({abi:STRATEGY,eventName:'Migrated',args:{initializer:contracts.auction.address}}).slice(0,2),poolId],
      data:encodeAbiParameters(parseAbiParameters('uint160,bytes'),[1n,'0x'])});
    else receiptLogs.push({address:contracts.genesisController.address,topics:encodeEventTopics({abi:EVENT,eventName:'MigrationObserved'}),
      data:encodeAbiParameters(parseAbiParameters('bool'),[!o.failedEvent])});
  }
  for(const id of tokenIds)receiptLogs.push({address:contracts.positionManager.address,
    topics:encodeEventTopics({abi:NFT,eventName:'Transfer',args:{from:zeroAddress,to:contracts.polVault.address,tokenId:id}}),data:'0x'});
  if(o.externalMigration)decodeEventLog({abi:STRATEGY,...receiptLogs[0],strict:true});
  const receipt={status:'success',transactionHash:TX,blockHash:BLOCK,blockNumber:90n,from:a(2),to:contracts.genesisController.address,logs:receiptLogs};
  const pub={
    getChainId:async()=>4663,getCode:async()=>CODE,getBalance:async()=>ETH,
    getBlock:async({blockNumber}={})=>({number:blockNumber??head,hash:o.receiptReorg&&blockNumber===90n?`0x${'ef'.repeat(32)}`:BLOCK,timestamp:now}),
    getTransactionReceipt:async()=>receipt,
    getLogs:async(q)=>{
      assert(q.toBlock-q.fromBlock<2000n);assert(q.toBlock<=head);scans.push(q);
      if(o.noLogs||q.fromBlock>90n||q.toBlock<90n)return[];
      const common={blockNumber:90n,blockHash:BLOCK,transactionHash:TX,removed:false};
      if(q.address.toLowerCase()===contracts.genesisController.address)return o.externalMigration?[]:[{...common,address:q.address,args:{succeeded:true}}];
      return o.externalMigration?[{...common,address:q.address,args:{initializer:contracts.auction.address}}]:[];
    },
    simulateContract:async(q)=>{simulated.push(q.functionName);if(o.simulationFails&&q.functionName==='acceptFoundation')throw new Error('invalid custody');return{result:undefined};},
    readContract:async(q)=>{
      assert.equal(q.blockNumber,head);const target=names[q.address.toLowerCase()],f=q.functionName;
      if(f==='owner')return a(1);
      if(f==='omr'||f==='token')return contracts.omr.address;
      if(f==='poolManager')return contracts.poolManager.address;
      if(f==='poolId'||f==='canonicalPoolId')return poolId;
      if(f==='oracle')return contracts.oracle.address;
      if(f==='emergencyLatched')return !!o.emergency;
      if(f==='balanceOf')return o.noResidual?0n:100n;
      if(target==='oracle'&&f==='consult')return[100n*ETH,now];
      if(target==='polVault') {
        const values={healthy:phase===5&&!o.emergency,positionId,genesisController:contracts.genesisController.address,genesisControllerCodeHash:HASH,
          positionManager:contracts.positionManager.address,minLiquidity:100n,tickLower:-887220,tickUpper:887220};
        if(f in values)return values[f];
      }
      if(target==='genesisController') {
        const values={strategy:contracts.strategy.address,splitter:contracts.splitter.address,foundation:contracts.polVault.address,
          treasury:a(3),chainId:4663n,auction:phase===0?zeroAddress:contracts.auction.address,phase,stopped:!!o.stopped,failed:phase===3,
          currentBlock:phase===1?45000n:50000n,migrationBlock:phase===0?0n:50000n,
          strategyCodeHash:HASH,splitterCodeHash:HASH,foundationCodeHash:HASH,oracleCodeHash:HASH,auctionCodeHash:HASH,omrCodeHash:HASH,poolManagerCodeHash:HASH,usesArbSys:true};
        if(f in values)return values[f];
      }
      if(target==='auction') {
        const values={startBlock:40000n,endBlock:49999n,sweepUnsoldTokensBlock:o.swept?50000n:0n,currency:zeroAddress,
          fundsRecipient:contracts.strategy.address,tokensRecipient:contracts.genesisController.address};
        if(f in values)return values[f];
      }
      if(target==='strategy'&&f==='registeredPoolIds')return registered;
      if(target==='splitter') {
        const values={canonicalPoolInitialized:initialized,treasuryRecipient:a(3),vigRecipient:a(4),founderRecipient:a(5)};
        if(f in values)return values[f];
      }
      if(target==='positionManager') {
        if(f==='ownerOf')return o.wrongCustody?a(88):contracts.polVault.address;
        if(f==='getPositionLiquidity')return o.belowFloor?1n:1000n;
        if(f==='getPoolAndPositionInfo')return[o.wrongPool?{...key,fee:500}:key,
          (BigInt.asUintN(24,BigInt(o.wrongTicks?-60:-887220))<<8n)|(887220n<<32n)|(o.subscribed?1n:0n)];
      }
      if(target==='gasVault') {
        const values={paused:false,allowedKeeper:true,refillAmount:ETH/2n,perRefillCap:ETH};if(f in values)return values[f];
      }
      throw new Error(`Unhandled synthetic getter ${target}.${f}`);
    },
  };
  return{m,clients:{publicClient:pub},scans,simulated,receipt};
}

{
  const f=fixture();validateLiquidityManifest(f.m);
  const snapshot=await readLiquiditySnapshot(f.m,f.clients),plan=planLiquidityActions(f.m,snapshot);
  assert.equal(snapshot.genesisPhase,4);assert.equal(snapshot.emergencyLatched,false);
  const accept=plan.actions.find(a=>a.kind==='genesis_accept_foundation');assert(accept);
  assert.deepEqual(decodeFunctionData({abi:parseAbi(['function acceptFoundation(uint256)']),data:accept.request.data}).args,[99n]);
  assert.equal(accept.metadata.migrationTxHash,TX);assert.equal(accept.metadata.migrationL2Block,'90');
  assert.equal(accept.request.value,'0');assert.equal(accept.accountingRequired,true);
  assert(f.scans.every(q=>q.fromBlock>=50n&&q.toBlock<=100n),'ArbSys 40000/50000 must never become log bounds');
  check('successful migration discovers and simulates only the actual full-range foundation NFT using distinct L2 log bounds');
}
{
  for(const option of ['wrongCustody','belowFloor','wrongPool','wrongTicks','subscribed','simulationFails','ambiguous','missingMigrationEvent','failedEvent','receiptReorg','noLogs','uncleared','notMigrated']) {
    const f=fixture({[option]:true}),plan=planLiquidityActions(f.m,await readLiquiditySnapshot(f.m,f.clients));
    assert.equal(plan.actions.some(a=>a.kind==='genesis_accept_foundation'),false,option);
  }
  check('wrong custody/pool/range/floor/subscription, ambiguous candidates and absent or failed migration proof never authorize foundation adoption');
}
{
  const f=fixture({externalMigration:true,largeScan:true});
  const plan=planLiquidityActions(f.m,await readLiquiditySnapshot(f.m,f.clients));
  assert.equal(plan.actions.some(a=>a.kind==='genesis_accept_foundation'),true,JSON.stringify(plan.blocked));
  assert(f.scans.length>=6);assert(f.scans.every(q=>q.toBlock-q.fromBlock<2000n));
  const old=fixture();old.m.genesis.maxLogScanBlocks=20;
  old.m.jobs.push({id:'gas',kind:'gas_topup',target:'gasVault',recipient:old.m.keeper,maxAmount:String(ETH),dailyBudget:String(ETH*2n),minNativeValue:String(ETH/100n),intervalSeconds:60});
  const p=planLiquidityActions(old.m,await readLiquiditySnapshot(old.m,old.clients));
  assert(p.actions.some(a=>a.kind==='gas_topup'));
  assert(p.blocked.some(b=>b.reason==='genesis_discovery_checkpoint_required'));
  check('permissionless external migration works through indexed strategy receipt, paged scans remain bounded, stale discovery does not block gas work');
}
{
  for(const phase of [0,1,2,3,5]) {
    const f=fixture({phase}),snapshot=await readLiquiditySnapshot(f.m,f.clients),plan=planLiquidityActions(f.m,snapshot);
    assert.equal(snapshot.genesisPhase,phase);
    if(phase===0)assert.equal(plan.actions.length,0);
    if(phase===1)assert.deepEqual(plan.actions.map(a=>a.kind),['genesis_checkpoint']);
    if(phase===2)assert.equal(plan.actions[0].kind,'genesis_migrate');
    if(phase===3){assert(!plan.actions.some(a=>a.kind==='genesis_migrate'||a.kind==='genesis_accept_foundation'));assert(plan.actions.some(a=>a.kind==='genesis_distribute'));}
    if(phase===5)assert(!plan.actions.some(a=>a.kind==='genesis_accept_foundation'));
  }
  const stopped=fixture({stopped:true});assert.equal(planLiquidityActions(stopped.m,await readLiquiditySnapshot(stopped.m,stopped.clients)).actions.length,0);
  const noJobs=fixture({phase:5});noJobs.m.jobs=[];assert.equal((await readLiquiditySnapshot(noJobs.m,noJobs.clients)).genesisPhase,5);
  check('phase progression is permissionless only after owner binding, migration failure exposes fixed recovery, stopped launches stay stopped and phase remains observable without jobs');
}
console.log(`PASS genesis keeper: ${passed} cases; no live transactions`);
