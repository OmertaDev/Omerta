// Read-only, bounded discovery for the owner-committed GenesisLifecycleController.
// Auction cadence uses ArbSys block numbers; log discovery uses only explicit L2 block bounds.
import { decodeEventLog, encodeAbiParameters, getAddress, keccak256, parseAbi, parseAbiParameters, zeroAddress } from 'viem';

const lower=(v)=>String(v||'').toLowerCase();
const fail=(code)=>Object.assign(new Error(code),{keeperCode:code});
const same=(a,b)=>{if(lower(a)!==lower(b))throw fail('genesis_binding_mismatch');};
const abi=(s)=>parseAbi([`function ${s}`]);
const OBSERVED=parseAbi(['event MigrationObserved(bool succeeded)'])[0];
const MIGRATED=parseAbi(['event Migrated(address indexed initializer,(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) indexed key,uint160 initialSqrtPriceX96,bytes plan)'])[0];
const TRANSFER=parseAbi(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)']);

export async function readGenesisKeeperState(m,pub,block,read) {
  const r=(s,args=[])=>read('genesisController',s,args),g=m.genesis;
  const names=['strategy','splitter','foundation','oracle','omr'];
  const boundNames=['strategy','splitter','polVault','oracle','omr'];
  const bindings=await Promise.all(names.map(name=>r(`${name}() view returns (address)`)));
  bindings.forEach((v,i)=>same(v,m.contracts[boundNames[i]].address));
  const [owner,treasury,pool,chainId,auction,phase,stopped,failed,current,migration,start,end,unsold,registered,initialized,position,emergency] = await Promise.all([
    r('owner() view returns (address)'),r('treasury() view returns (address)'),r('poolId() view returns (bytes32)'),r('chainId() view returns (uint256)'),
    r('auction() view returns (address)'),r('phase() view returns (uint8)'),r('stopped() view returns (bool)'),r('failed() view returns (bool)'),
    r('currentBlock() view returns (uint256)'),r('migrationBlock() view returns (uint256)'),
    read('auction','startBlock() view returns (uint64)'),read('auction','endBlock() view returns (uint64)'),read('auction','sweepUnsoldTokensBlock() view returns (uint256)'),
    read('strategy','registeredPoolIds(bytes32) view returns (address)',[m.poolId]),read('splitter','canonicalPoolInitialized() view returns (bool)'),
    read('polVault','positionId() view returns (uint256)'),read('polVault','emergencyLatched() view returns (bool)'),
  ]);
  same(owner,m.governanceSafe);same(treasury,g.treasuryRecipient);same(pool,m.poolId);
  if(Number(chainId)!==m.chainId || ![0,1,2,3,4,5].includes(Number(phase)))throw fail('genesis_binding_mismatch');
  if(lower(auction)!==zeroAddress)same(auction,m.contracts.auction.address);
  for(const [getter,target] of [['strategyCodeHash','strategy'],['splitterCodeHash','splitter'],['foundationCodeHash','polVault'],['oracleCodeHash','oracle'],['omrCodeHash','omr'],['poolManagerCodeHash','poolManager']]) {
    same(await r(`${getter}() view returns (bytes32)`),m.contracts[target].runtimeHash);
  }
  if(await r('usesArbSys() view returns (bool)')!==true)throw fail('genesis_block_domain_mismatch');
  if(lower(auction)!==zeroAddress)same(await r('auctionCodeHash() view returns (bytes32)'),m.contracts.auction.runtimeHash);
  const comparisons=[
    ['auction','token() view returns (address)',m.contracts.omr.address],['auction','currency() view returns (address)',zeroAddress],
    ['auction','fundsRecipient() view returns (address)',m.contracts.strategy.address],['auction','tokensRecipient() view returns (address)',m.contracts.genesisController.address],
    ['polVault','genesisController() view returns (address)',m.contracts.genesisController.address],
    ['polVault','genesisControllerCodeHash() view returns (bytes32)',m.contracts.genesisController.runtimeHash],
    ['polVault','positionManager() view returns (address)',m.contracts.positionManager.address],
    ['splitter','poolManager() view returns (address)',m.contracts.poolManager.address],['splitter','canonicalPoolId() view returns (bytes32)',m.poolId],
    ['splitter','treasuryRecipient() view returns (address)',g.treasuryRecipient],['splitter','vigRecipient() view returns (address)',g.vigRecipient],
    ['splitter','founderRecipient() view returns (address)',g.founderRecipient],
  ];
  await Promise.all(comparisons.map(async([target,getter,expected])=>same(await read(target,getter),expected)));
  const bound=lower(auction)!==zeroAddress;
  if(bound && (BigInt(end)<BigInt(start) || BigInt(migration)!==BigInt(end)+1n))throw fail('genesis_cadence_mismatch');
  const matured=bound && BigInt(current)>=BigInt(migration);
  const registeredCleared=lower(registered)===zeroAddress;
  const provenMigrated=matured && initialized && registeredCleared && !failed;
  const failedRecoverable=matured && !initialized && (failed || registeredCleared);
  const [controllerOmr,splitterOmr,splitterNative]=await Promise.all([
    read('omr','balanceOf(address) view returns (uint256)',[getAddress(m.contracts.genesisController.address)]),
    read('omr','balanceOf(address) view returns (uint256)',[getAddress(m.contracts.splitter.address)]),
    pub.getBalance({address:getAddress(m.contracts.splitter.address),blockNumber:block.number}),
  ]);
  return {phase:Number(phase),bound,stopped:!!stopped,failed:!!failed,emergencyLatched:!!emergency,currentBlock:String(current),
    startBlock:String(start),endBlock:String(end),migrationBlock:String(migration),provenMigrated,failedRecoverable,
    registered:lower(registered),canonicalPoolInitialized:!!initialized,positionId:String(position),unsoldSwept:String(unsold),
    controllerOmr:String(controllerOmr),splitterOmr:String(splitterOmr),splitterNative:String(splitterNative)};
}

export async function discoverGenesisFoundation(m,pub,block,read) {
  const from=BigInt(m.genesis.genesisStartL2Block),head=BigInt(block.number);
  if(from>head || head-from+1n>BigInt(m.genesis.maxLogScanBlocks))throw fail('genesis_discovery_checkpoint_required');
  const started=Date.now();
  let migrationLog=null;
  // Search recent, narrowly indexed migration events first. Never query a million-block PM
  // Transfer stream or confuse an auction's ArbSys number with an execution-layer block.
  for(let end=head;end>=from;) {
    if(Date.now()-started>Math.min(20000,m.gas.maxSnapshotAgeSeconds*500))throw fail('genesis_discovery_checkpoint_required');
    const begin=end-from>=1999n?end-1999n:from;
    const [observed,migrated]=await Promise.all([
      pub.getLogs({address:getAddress(m.contracts.genesisController.address),event:OBSERVED,fromBlock:begin,toBlock:end}),
      pub.getLogs({address:getAddress(m.contracts.strategy.address),event:MIGRATED,args:{initializer:getAddress(m.contracts.auction.address)},fromBlock:begin,toBlock:end}),
    ]);
    const good=[...observed.filter(l=>l.args?.succeeded===true),...migrated.filter(l=>lower(l.args?.initializer)===m.contracts.auction.address)]
      .filter(l=>!l.removed && l.blockNumber!=null && BigInt(l.blockNumber)>=begin && BigInt(l.blockNumber)<=end);
    const hashes=new Set(good.map(l=>lower(l.transactionHash)));
    if(hashes.size>1)throw fail('genesis_migration_receipt_ambiguous');
    if(good.length){migrationLog=good[0];break;}
    if(begin===from)break;end=begin-1n;
  }
  if(!migrationLog)throw fail('genesis_migration_receipt_not_found');
  const receipt=await pub.getTransactionReceipt({hash:migrationLog.transactionHash});
  if(receipt.status!=='success' || lower(receipt.transactionHash)!==lower(migrationLog.transactionHash)
    || lower(receipt.blockHash)!==lower(migrationLog.blockHash) || String(receipt.blockNumber)!==String(migrationLog.blockNumber)) throw fail('genesis_migration_receipt_mismatch');
  same((await pub.getBlock({blockNumber:BigInt(receipt.blockNumber)})).hash,receipt.blockHash);
  let migrationProven=false;
  for(const log of receipt.logs||[]) {
    if(log.removed)continue;
    try {
      if(lower(log.address)===m.contracts.genesisController.address) {
        const e=decodeEventLog({abi:[OBSERVED],data:log.data,topics:log.topics,strict:true});
        if(e.args.succeeded===true)migrationProven=true;
      }
      if(lower(log.address)===m.contracts.strategy.address) {
        const e=decodeEventLog({abi:[MIGRATED],data:log.data,topics:log.topics,strict:true});
        if(lower(e.args.initializer)===m.contracts.auction.address)migrationProven=true;
      }
    }catch{/* Only the pinned launch's successful migration event is authority. */}
  }
  if(!migrationProven)throw fail('genesis_migration_receipt_mismatch');
  const ids=new Set();
  for(const log of receipt.logs||[]) {
    if(log.removed || lower(log.address)!==m.contracts.positionManager.address)continue;
    let event;try{event=decodeEventLog({abi:TRANSFER,data:log.data,topics:log.topics,strict:true});}catch{continue;}
    if(lower(event.args.to)===m.contracts.polVault.address)ids.add(String(event.args.tokenId));
  }
  if(!ids.size || ids.size>m.genesis.maxCandidatePositions)throw fail('genesis_foundation_discovery_bound');
  const [floor,tickLower,tickUpper]=await Promise.all([read('polVault','minLiquidity() view returns (uint128)'),
    read('polVault','tickLower() view returns (int24)'),read('polVault','tickUpper() view returns (int24)')]);
  const candidates=[];
  for(const id of ids) {
    try {
      const tokenId=BigInt(id),[owner,liquidity,position]=await Promise.all([
        read('positionManager','ownerOf(uint256) view returns (address)',[tokenId]),read('positionManager','getPositionLiquidity(uint256) view returns (uint128)',[tokenId]),
        read('positionManager','getPoolAndPositionInfo(uint256) view returns ((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),uint256)',[tokenId]),
      ]);
      if(lower(owner)!==m.contracts.polVault.address || BigInt(liquidity)<BigInt(floor))continue;
      const [key,packed]=position,info=BigInt(packed);
      const poolId=keccak256(encodeAbiParameters(parseAbiParameters('address,address,uint24,int24,address'),[key.currency0,key.currency1,key.fee,key.tickSpacing,key.hooks]));
      if(lower(poolId)!==lower(m.poolId) || BigInt.asIntN(24,info>>8n)!==BigInt(tickLower)
        || BigInt.asIntN(24,info>>32n)!==BigInt(tickUpper) || (info&255n)!==0n)continue;
      await pub.simulateContract({account:getAddress(m.keeper),address:getAddress(m.contracts.genesisController.address),
        abi:abi('acceptFoundation(uint256 positionId)'),functionName:'acceptFoundation',args:[tokenId],blockNumber:block.number});
      candidates.push(id);
    }catch{ /* An unproven candidate never grants adoption authority. */ }
  }
  if(candidates.length!==1)throw fail(candidates.length?'genesis_foundation_candidate_ambiguous':'genesis_foundation_candidate_unavailable');
  return {positionId:candidates[0],migrationTxHash:lower(receipt.transactionHash),migrationL2Block:String(receipt.blockNumber)};
}
