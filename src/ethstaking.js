// Public read/unsigned-call rail. User wallets send their own transactions; no server key is read.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createPublicClient, encodeFunctionData, getAddress, http, isAddress, keccak256, parseAbi, parseUnits} from 'viem';
import {GameError} from './game.js';
import {validateMarketV2Manifest, marketV2Abi} from './marketv2keeper.js';

const CHAIN_ID=4663, DURATION=2592000n, POSITION_PAGE=16n, EPOCH_PAGE=8n;
const HASH=/^0x[0-9a-f]{64}$/i, ZERO_HASH='0x'+'0'.repeat(64);
const tokenAbi=parseAbi(['function balanceOf(address) view returns(uint256)','function allowance(address,address) view returns(uint256)',
  'function decimals() view returns(uint8)','function isRecipient(address) view returns(bool)',
  'function isOperator(address) view returns(bool)','function operatorRole(address) view returns(uint8)',
  'function policySealed() view returns(bool)','function contractHolderRuntimeHash(address) view returns(bytes32)',
  'function registerWallet(address)','function approve(address,uint256) returns(bool)']);
const error=(code,message)=>{throw new GameError(code,message);};
const unavailable=()=>error('eth_staking_unavailable','ETH staking cannot be verified right now. No transaction was prepared.');
const address=value=>isAddress(value||'')?getAddress(value):unavailable();
const lower=value=>String(value||'').toLowerCase();
const hex=value=>'0x'+BigInt(value).toString(16);
const uint=(value,limit=(1n<<256n)-1n)=>{
  if(typeof value==='number'&&!Number.isSafeInteger(value))error('eth_staking_input','Use an exact whole position or epoch number.');
  if((typeof value!=='string'&&typeof value!=='number')||String(value).length>78||!/^(0|[1-9]\d*)$/.test(String(value)))
    error('eth_staking_input','Use a non-negative whole position or epoch number.');
  const n=BigInt(value);if(n>limit)error('eth_staking_input','That position or epoch number is too large.');return n;
};
const amount=value=>{
  if(typeof value!=='string'||!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value)||value.length>98)
    error('eth_staking_input','Enter a positive OMR amount with at most 18 decimal places.');
  const n=parseUnits(value,18);if(n<=0n||n>=(1n<<256n))error('eth_staking_input','Enter a positive OMR amount.');return n;
};
function config(env,readFile=fs.readFileSync){
  if(env.ETH_STAKING_UI_ENABLED!=='on')return null;
  const filename=env.ETH_REWARDS_MANIFEST_PATH,expected=env.ETH_REWARDS_MANIFEST_SHA256;
  if(!filename||!/^[a-f0-9]{64}$/i.test(expected||''))unavailable();
  const bytes=readFile(filename),digest=createHash('sha256').update(bytes).digest('hex');
  if(digest!==expected.toLowerCase())unavailable();
  const m=validateMarketV2Manifest(JSON.parse(bytes.toString()));
  if(m.chainId!==CHAIN_ID||m.contracts.vault?.artifact!=='OmertaEthStakingV2'
    ||m.contracts.rewards?.artifact!=='OmertaEthRewardsV2')unavailable();
  const token=address(env.OMR_GAME_TOKEN_ADDRESS),tokenHash=lower(env.OMR_GAME_TOKEN_RUNTIME_HASH);
  if(!HASH.test(tokenHash)||tokenHash===ZERO_HASH)unavailable();
  const endpoint=new URL(env.CHAIN_RPC_URL);
  if(endpoint.protocol!=='https:'&&!(env.NODE_ENV!=='production'&&endpoint.protocol==='http:'
    &&['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)))unavailable();
  const confirmations=Number(env.CHAIN_CONFIRMATIONS??5);
  if(!Number.isSafeInteger(confirmations)||confirmations<1||confirmations>100)unavailable();
  const fingerprint=JSON.stringify([filename,digest,token,tokenHash,endpoint.href,confirmations,m.governanceSafe]);
  return {manifest:m,token,tokenHash,endpoint:endpoint.href,confirmations,fingerprint};
}
async function wallet(pool,accountId){
  const row=(await pool.query('SELECT wallet_address FROM account_persistent WHERE account_id=$1',[accountId])).rows[0];
  return isAddress(row?.wallet_address||'')?getAddress(row.wallet_address):null;
}
const valueAt=(value,key,index)=>value?.[key]??value?.[index];
async function snapshot(cfg,account,{publicClient,env,readFile}){
  const pub=publicClient??createPublicClient({transport:http(cfg.endpoint,{retryCount:0,timeout:10000}),cacheTime:0});
  if(Number(await pub.getChainId())!==CHAIN_ID)unavailable();
  const head=await pub.getBlock({blockTag:'latest'});
  if(head.number==null||BigInt(head.number)<BigInt(cfg.confirmations))unavailable();
  const confirmedNumber=BigInt(head.number)-BigInt(cfg.confirmations);
  const block=await pub.getBlock({blockNumber:confirmedNumber});
  if(block.number!==confirmedNumber)unavailable();
  const age=()=>{
    const now=BigInt(Math.floor(Date.now()/1000));
    if(block.number==null||!HASH.test(block.hash||'')||typeof block.timestamp!=='bigint'
      ||block.timestamp>now+5n||now-block.timestamp>BigInt(cfg.manifest.gas.maxSnapshotAgeSeconds))unavailable();
  };
  age();
  const vault=cfg.manifest.contracts.vault,rewards=cfg.manifest.contracts.rewards;
  for(const pin of [vault,rewards,{address:cfg.token,runtimeHash:cfg.tokenHash}]){
    const code=await pub.getCode({address:getAddress(pin.address),blockNumber:block.number});
    if(!code||code==='0x'||lower(keccak256(code))!==pin.runtimeHash)unavailable();
  }
  const abi=marketV2Abi('OmertaEthStakingV2'),rewardAbi=marketV2Abi('OmertaEthRewardsV2');
  const expires=Date.now()+20000;
  const read=(target,functionName,args=[],targetAbi=abi)=>{
    if(Date.now()>expires)unavailable();
    return pub.readContract({address:getAddress(target),abi:targetAbi,functionName,args,blockNumber:block.number});
  };
  const binding=[
    ['omr',cfg.token],['owner',cfg.manifest.governanceSafe],['governanceSafe',cfg.manifest.governanceSafe],
    ['distributor',rewards.address],['distributorRuntimeHash',rewards.runtimeHash],
  ];
  for(const [name,expected] of binding)if(lower(await read(vault.address,name))!==lower(expected))unavailable();
  if(lower(await read(rewards.address,'rewardVault',[],rewardAbi))!==lower(vault.address)
    ||lower(await read(rewards.address,'omr',[],rewardAbi))!==lower(cfg.token)
    ||BigInt(await read(vault.address,'LOCK_DURATION'))!==DURATION
    ||BigInt(await read(vault.address,'EPOCH_DURATION'))!==DURATION
    ||Number(await read(cfg.token,'decimals',[],tokenAbi))!==18
    ||!await read(cfg.token,'policySealed',[],tokenAbi)
    ||!await read(cfg.token,'isOperator',[vault.address],tokenAbi)
    ||Number(await read(cfg.token,'operatorRole',[vault.address],tokenAbi))!==2)unavailable();
  const active=Boolean(await read(vault.address,'active')),paused=Boolean(await read(vault.address,'paused'));
  const balance=BigInt(await read(cfg.token,'balanceOf',[account],tokenAbi));
  const allowance=BigInt(await read(cfg.token,'allowance',[account,vault.address],tokenAbi));
  const recipient=Boolean(await read(cfg.token,'isRecipient',[account],tokenAbi));
  const role=Number(await read(cfg.token,'operatorRole',[account],tokenAbi));
  const holder=lower(await read(cfg.token,'contractHolderRuntimeHash',[account],tokenAbi));
  const eligible=role===0&&holder===ZERO_HASH&&lower(account)!==lower(cfg.manifest.governanceSafe)
    &&lower(account)!==lower(rewards.address);
  const userCode=recipient?'0x':await pub.getCode({address:account,blockNumber:block.number});
  const currentEpoch=active?BigInt(await read(vault.address,'currentEpoch')):0n;
  const assertFresh=async()=>{
    age();
    const latest=config(env,readFile);
    if(!latest||latest.fingerprint!==cfg.fingerprint||Number(await pub.getChainId())!==CHAIN_ID
      ||(await pub.getBlock({blockNumber:block.number})).hash!==block.hash)unavailable();
  };
  return {pub,read,assertFresh,abi,vault,block,active,paused,balance,allowance,recipient,eligible,
    canRegister:eligible&&!recipient&&(!userCode||userCode==='0x'),currentEpoch};
}
async function guarded(work){try{return await work();}catch(e){if(e instanceof GameError)throw e;unavailable();}}

export async function ethStakingBoard(pool,accountId,query={},options={}){
  return guarded(async()=>{
    const env=options.env??process.env,cfg=config(env,options.readFile);
    if(!cfg)return {available:false,reason:'ETH staking is not active in this deployment.'};
    const positionOffset=uint(query.positions??'0'),epochOffset=uint(query.epochs??'0');
    const account=await wallet(pool,accountId);
    if(!account)return {available:false,needsWallet:true,reason:'Link your wallet to view ETH staking.'};
    const s=await snapshot(cfg,account,{...options,env});
    const count=BigInt(await s.read(s.vault.address,'lockCount',[account]));
    const end=count>positionOffset?count-positionOffset:0n,start=end>POSITION_PAGE?end-POSITION_PAGE:0n;
    const positions=[];
    for(let id=end;id>start;){id--;const p=await s.read(s.vault.address,'lockPosition',[account,id]);
      const principal=BigInt(valueAt(p,'amount',0)),unlocksAt=BigInt(valueAt(p,'unlocksAt',2));
      positions.push({id:String(id),amountWei:String(principal),lockedAt:String(valueAt(p,'lockedAt',1)),unlocksAt:String(unlocksAt),
        matured:s.block.timestamp>=unlocksAt,canWithdraw:principal>0n&&s.block.timestamp>=unlocksAt});
    }
    const epochEnd=s.currentEpoch>epochOffset?s.currentEpoch-epochOffset:0n,epochStart=epochEnd>EPOCH_PAGE?epochEnd-EPOCH_PAGE:0n;
    const epochs=[];let claimable=0n;
    for(let id=epochEnd;id>epochStart;){id--;const e=await s.read(s.vault.address,'epoch',[id]);
      const finalized=Boolean(valueAt(e,'finalized',2)),reward=BigInt(await s.read(s.vault.address,'claimable',[account,id]));
      claimable+=reward;epochs.push({id:String(id),finalized,claimableWei:String(reward)});
    }
    const held=BigInt(await s.read(s.vault.address,'stakedBalance',[account]));
    const locked=BigInt(await s.read(s.vault.address,'lockedBalance',[account]));
    await s.assertFresh();if(await wallet(pool,accountId)!==account)unavailable();
    return {available:true,chainId:CHAIN_ID,wallet:account,token:getAddress(cfg.token),vault:getAddress(s.vault.address),
      active:s.active,paused:s.paused,canStake:s.active&&!s.paused&&s.eligible&&s.recipient,canRegister:s.active&&!s.paused&&s.canRegister,
      eligible:s.eligible,recipient:s.recipient,balanceWei:String(s.balance),allowanceWei:String(s.allowance),stakedWei:String(held),
      lockedWei:String(locked),withdrawableWei:String(held-locked),claimableOnPageWei:String(claimable),
      minimumLockSeconds:String(DURATION),rewardsContinueAfterMaturity:true,currentEpoch:String(s.currentEpoch),positions,epochs,
      positionCount:String(count),positionOffset:String(positionOffset),epochOffset:String(epochOffset),
      nextPositionsOffset:start>0n?String(positionOffset+POSITION_PAGE):null,previousPositionsOffset:positionOffset>0n?String(positionOffset>POSITION_PAGE?positionOffset-POSITION_PAGE:0n):null,
      nextEpochsOffset:epochStart>0n?String(epochOffset+EPOCH_PAGE):null,previousEpochsOffset:epochOffset>0n?String(epochOffset>EPOCH_PAGE?epochOffset-EPOCH_PAGE:0n):null,
      observedAt:String(s.block.timestamp),blockNumber:String(s.block.number)};
  });
}

export async function prepareEthStakingTransaction(pool,accountId,body={},options={}){
  return guarded(async()=>{
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['action','amount','lockId','epochs'].includes(k)))
      error('eth_staking_input','Use a supported staking action.');
    if(!['register','approve','stake','withdraw','claim'].includes(body.action))error('eth_staking_input','Use a supported staking action.');
    const requestedAmount=['approve','stake','withdraw'].includes(body.action)?amount(body.amount):null;
    const requestedLock=body.action==='withdraw'?uint(body.lockId):null;
    let requestedEpochs;
    if(body.action==='claim'){
      if(!Array.isArray(body.epochs)||!body.epochs.length||body.epochs.length>24)error('eth_staking_epochs','Select between 1 and 24 closed reward periods.');
      requestedEpochs=body.epochs.map(id=>uint(id,(1n<<64n)-1n));
      if(requestedEpochs.some((id,i)=>i>0&&id<=requestedEpochs[i-1]))error('eth_staking_epochs','Reward periods must be closed, unique and ascending.');
    }
    const env=options.env??process.env,cfg=config(env,options.readFile);if(!cfg)unavailable();
    const account=await wallet(pool,accountId);if(!account)error('eth_staking_wallet','Link your wallet first.');
    const s=await snapshot(cfg,account,{...options,env});
    let target=s.vault.address,abi=s.abi,functionName,args;
    if(['register','approve','stake'].includes(body.action)){
      if(!s.active||s.paused)error('eth_staking_paused','New stakes are paused. Mature withdrawals and earned claims remain available.');
      if(!s.eligible)error('eth_staking_wallet','This wallet is not eligible for staking in this deployment.');
      if(body.action==='register'){
        if(!s.canRegister)error('eth_staking_wallet','This wallet cannot register for staking or is already registered.');
        target=cfg.token;abi=tokenAbi;functionName='registerWallet';args=[account];
      }else{
        const n=requestedAmount;
        if(!s.recipient)error('eth_staking_wallet','Register this wallet for OMR first.');
        if(n>s.balance)error('eth_staking_balance','The linked wallet does not hold that much OMR.');
        if(body.action==='approve'){target=cfg.token;abi=tokenAbi;functionName='approve';args=[s.vault.address,n];}
        else{if(n>s.allowance)error('eth_staking_approval','Approve this OMR amount first, then wait for confirmation.');functionName='stake';args=[n];}
      }
    }else if(body.action==='withdraw'){
      const id=requestedLock,n=requestedAmount,count=BigInt(await s.read(s.vault.address,'lockCount',[account]));
      if(id>=count)error('eth_staking_position','That position does not belong to this wallet.');
      const p=await s.read(s.vault.address,'lockPosition',[account,id]);
      if(n>BigInt(valueAt(p,'amount',0)))error('eth_staking_balance','That position does not hold that much OMR.');
      if(s.block.timestamp<BigInt(valueAt(p,'unlocksAt',2)))error('eth_staking_locked','That deposit has not reached its 30-day withdrawal date.');
      functionName='withdraw';args=[id,n,account];
    }else if(body.action==='claim'){
      const ids=requestedEpochs;let total=0n;
      for(let i=0;i<ids.length;i++){
        if(ids[i]>=s.currentEpoch||(i&&ids[i]<=ids[i-1]))error('eth_staking_epochs','Reward periods must be closed, unique and ascending.');
        const e=await s.read(s.vault.address,'epoch',[ids[i]]);
        if(!valueAt(e,'finalized',2)||await s.read(s.vault.address,'claimed',[ids[i],account]))error('eth_staking_epochs','A selected reward period is not finalized or was already claimed.');
        total+=BigInt(await s.read(s.vault.address,'claimable',[account,ids[i]]));
      }
      if(total===0n)error('eth_staking_epochs','There is no earned ETH to claim for these periods.');
      functionName='claim';args=[ids,account];
    }else error('eth_staking_input','Use a supported staking action.');
    await s.pub.simulateContract({address:getAddress(target),abi,functionName,args,account,blockNumber:s.block.number});
    await s.assertFresh();if(await wallet(pool,accountId)!==account)unavailable();
    return {action:body.action,chainId:CHAIN_ID,from:account,to:getAddress(target),value:'0x0',
      data:encodeFunctionData({abi,functionName,args}),blockNumber:String(s.block.number),blockHash:s.block.hash,
      expiresAt:String(s.block.timestamp+BigInt(cfg.manifest.gas.maxSnapshotAgeSeconds))};
  });
}
