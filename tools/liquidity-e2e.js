#!/usr/bin/env node
// LOCAL ONLY: actual contract bytecode -> typed keeper -> durable PostgreSQL journal -> ledger.
// Run after `forge build`: LIQUIDITY_E2E_DATABASE_URL=postgres://.../omerta_liquidity_e2e_test
// node tools/liquidity-e2e.js. The database must be empty and its name must end in _e2e_test.
// This uses an administered GenesisOracle and an EOA governance stand-in. It does not prove
// deployed Safe configuration, production TWAP liveness, LBP migration, or production readiness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, getAddress,
  getContractAddress, encodeAbiParameters, decodeEventLog, keccak256, zeroAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import pg from 'pg';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dbUrl=new URL(process.env.LIQUIDITY_E2E_DATABASE_URL||'postgres://omerta_audit@127.0.0.1:55439/omerta_liquidity_e2e_test');
assert(['127.0.0.1','localhost','[::1]'].includes(dbUrl.hostname),'E2E database must be loopback');
assert(/^\/omerta_liquidity_[a-z0-9_]*e2e_test$/.test(dbUrl.pathname),'Use a dedicated omerta_liquidity_*e2e_test database');
const probe=new pg.Pool({connectionString:dbUrl.href});
assert.equal(Number((await probe.query("SELECT count(*) n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n),0,'E2E database must be empty');
await probe.end();
process.env.DATABASE_URL=dbUrl.href;
process.env.VIG_BPS='2500';process.env.FEE_RWA_BPS='1000';process.env.FEE_COMMUNITY_BPS='1500';
const {makeDb}=await import('../src/db.js');
const {recordFeePayment}=await import('../src/fees.js');
const {readLiquiditySnapshot,runLiquidityKeeper,validateLiquidityManifest}=await import('../src/liquiditykeeper.js');
const {bookConfirmedLiquidityAction}=await import('../src/liquidityaccounting.js');
const {syncLiquidityFlows}=await import('../src/liquidityindexer.js');
const {buildLiquidityPlanningContext}=await import('../src/liquiditypolicy.js');
const {runLiquidityAutomationCycle}=await import('../src/liquidityautomation.js');
const pool=await makeDb();
const PORT=Number(process.env.LIQUIDITY_E2E_PORT||8559);
assert(Number.isInteger(PORT)&&PORT>=1024&&PORT<=65535);
const RPC=`http://127.0.0.1:${PORT}`;
try {await fetch(RPC,{signal:AbortSignal.timeout(500)});assert.fail('Refusing an occupied RPC port');}
catch(error){if(error.code==='ERR_ASSERTION')throw error;}
const bin=process.env.ANVIL_BIN||path.join(os.homedir(),'.foundry','bin',process.platform==='win32'?'anvil.exe':'anvil');
assert(fs.existsSync(bin),'Set ANVIL_BIN to an installed Anvil executable');
const anvil=spawn(bin,['--host','127.0.0.1','--port',String(PORT),'--chain-id','4663','--base-fee','0','--order','fifo','--timestamp',String(Math.floor(Date.now()/1000)-600),'--silent'],{stdio:'ignore',windowsHide:true});
process.on('exit',()=>{try{anvil.kill();}catch{}});
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const chain={id:4663,name:'local liquidity rehearsal',nativeCurrency:{name:'ETH',symbol:'ETH',decimals:18},rpcUrls:{default:{http:[RPC]}}};
const publicClient=createPublicClient({chain,transport:http(RPC,{retryCount:0}),cacheTime:0});
const account=privateKeyToAccount(generatePrivateKey());
const walletClient=createWalletClient({chain,account,transport:http(RPC,{retryCount:0})});
const clients={publicClient,walletClient,account};
const deployer=createWalletClient({chain,transport:http(RPC),account:privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')});
const SAFE=deployer.account.address,E=10n**18n,PERMIT2='0x000000000022D473030F116dDEE9F6B43aC78BA3';
const addresses={},artifacts={},steps=[],txs=[];
const json=(v)=>JSON.stringify(v,(_k,x)=>typeof x==='bigint'?x.toString():x,2);
const step=(name,detail={})=>{steps.push({name,...detail});console.log(`PASS ${name}`);};
const rpc=(method,params=[])=>publicClient.request({method,params});
const art=(name)=>artifacts[name]||=(JSON.parse(fs.readFileSync(path.join(ROOT,'omerta-contracts','out',`${name}.sol`,`${name}.json`),'utf8')));
const read=(name,fn,args=[])=>publicClient.readContract({address:addresses[name],abi:art(name).abi,functionName:fn,args});
async function send(name,fn,args=[],opts={}) {
  const hash=await deployer.writeContract({address:addresses[name],abi:art(name).abi,functionName:fn,args,...opts});
  const receipt=await publicClient.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success',`${name}.${fn}`);txs.push({name:`${name}.${fn}`,hash});return receipt;
}
async function deploy(name,args=[],wallet=deployer) {
  const a=art(name),hash=await wallet.deployContract({abi:a.abi,bytecode:a.bytecode.object,args});
  const receipt=await publicClient.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success',name);
  addresses[name]=getAddress(receipt.contractAddress);txs.push({name:`deploy ${name}`,hash});return addresses[name];
}
async function transferNative(to,value){const hash=await deployer.sendTransaction({to,value});assert.equal((await publicClient.waitForTransactionReceipt({hash})).status,'success');}
function event(receipt,name,abi){return receipt.logs.map(log=>{try{return decodeEventLog({abi,topics:log.topics,data:log.data,strict:true});}catch{return null;}}).find(e=>e?.eventName===name)?.args;}
async function currentClock(){const block=await publicClient.getBlock();const wall=Math.floor(Date.now()/1000);if(block.timestamp<BigInt(wall))await rpc('evm_setNextBlockTimestamp',[wall]);else if(block.timestamp>BigInt(wall+10))await sleep(Number(block.timestamp-BigInt(wall+10))*1000);await rpc('evm_mine');}
let manifest;
async function runJob(id,{onConfirmed=bookConfirmedLiquidityAction}={}) {
  await currentClock();
  const selected={...manifest,jobs:manifest.jobs.filter(j=>j.id===id)};
  let result=await runLiquidityKeeper(pool,{config:{enabled:true,manifest:selected,rpcUrl:RPC},clients,onConfirmed,planningContext:(p,m,s)=>buildLiquidityPlanningContext(p,m,s,{persist:false})});
  for(let i=0;i<3&&['submitted','mined','confirmed','ambiguous'].includes(result.state);i++)result=await runLiquidityKeeper(pool,{config:{enabled:true,manifest:selected,rpcUrl:RPC},clients,onConfirmed});
  assert.equal(result.state,'settled',`${id}: ${json(result)}`);step(`typed keeper ${id}`,{transactionHash:result.txHash});return result;
}
try {
  for(let i=0;i<80;i++){try{if(await publicClient.getChainId()===4663)break;}catch{}await sleep(100);}
  assert.equal(await publicClient.getChainId(),4663);assert.match(await rpc('web3_clientVersion'),/anvil/i);
  await rpc('anvil_setBalance',[account.address,'0x'+parseEther('0.1').toString(16)]);
  const permitSource=fs.readFileSync(path.join(ROOT,'omerta-contracts','lib','permit2','test','utils','DeployPermit2.sol'),'utf8');
  const runtime=permitSource.match(/hex"([a-fA-F0-9]+)"/)?.[1];assert(runtime,'Permit2 runtime missing');
  await rpc('anvil_setCode',[PERMIT2,`0x${runtime}`]);
  await deploy('PoolManager',[SAFE]);await deploy('OMR',[SAFE]);
  await deploy('PositionManager',[addresses.PoolManager,PERMIT2,100000n,zeroAddress,zeroAddress]);
  await deploy('PoolSwapTest',[addresses.PoolManager]);
  await deploy('GenesisOracle',[SAFE,E,BigInt(Math.floor(Date.now()/1000)+86400)]);
  await deploy('VoucherClaim',[SAFE,SAFE,addresses.OMR,zeroAddress,1000n*E]);
  let hookWallet,expectedHook;
  for(let i=0;i<300000;i++){
    const a=privateKeyToAccount(generatePrivateKey()),candidate=getContractAddress({from:a.address,nonce:0n});
    if((BigInt(candidate)&0x3fffn)===0x30ccn){hookWallet=createWalletClient({chain,account:a,transport:http(RPC)});expectedHook=candidate;break;}
  }
  assert(hookWallet,'Could not mine Hook address');await rpc('anvil_setBalance',[hookWallet.account.address,'0x'+(10n*E).toString(16)]);
  await deploy('OmertaHook',[addresses.PoolManager,addresses.OMR,SAFE,SAFE],hookWallet);assert.equal(addresses.OmertaHook,expectedHook);
  await send('OmertaHook','setAllowedQuote',[zeroAddress,true]);
  const key={currency0:zeroAddress,currency1:addresses.OMR,fee:3000,tickSpacing:60,hooks:addresses.OmertaHook};
  const poolId=keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}],Object.values(key)));
  await send('PoolManager','initialize',[key,1n<<96n]);
  const nonce=await publicClient.getTransactionCount({address:SAFE});
  const predictedVig=getContractAddress({from:SAFE,nonce:BigInt(nonce+1)}),predictedDesk=getContractAddress({from:SAFE,nonce:BigInt(nonce+2)});
  await deploy('ProtocolLiquidityVault',[{safe:SAFE,keeper:account.address,positionManager:addresses.PositionManager,permit2:PERMIT2,oracle:addresses.GenesisOracle,key,
    deskRecipient:predictedDesk,vigRecipient:predictedVig,minLiquidity:100n*E,warmup:2,maxOracleAge:1,maxDeviationBps:500,budgetWindow:86400,
    maxNativePerAction:1000n*E,maxNativePerWindow:2000n*E,maxOmrPerAction:1000n*E,maxOmrPerWindow:2000n*E}]);
  const recipients={dev:privateKeyToAccount(generatePrivateKey()).address,treasury:privateKeyToAccount(generatePrivateKey()).address,community:privateKeyToAccount(generatePrivateKey()).address};
  const policy={perAction:E,perDay:10n*E,minInterval:1,maxOracleAge:300,slippageBps:500};
  for(const [name,stream,dest]of [['vig',0,addresses.VoucherClaim],['desk',1,addresses.VoucherClaim],['community',2,recipients.community],['pol',3,addresses.ProtocolLiquidityVault]]){
    const addr=await deploy('LiquidityBuybackExecutor',[SAFE,addresses.PoolManager,key,addresses.GenesisOracle,addresses.ProtocolLiquidityVault,stream,dest,stream===0?dest:zeroAddress,policy]);addresses[`${name}Executor`]=addr;
  }
  assert.equal(addresses.vigExecutor,predictedVig);assert.equal(addresses.deskExecutor,predictedDesk);
  for(const name of ['vig','desk','community','pol']){addresses.LiquidityBuybackExecutor=addresses[`${name}Executor`];await send('LiquidityBuybackExecutor','setKeeper',[account.address,true]);}
  await send('ProtocolLiquidityVault','setInventoryExecutor',[addresses.polExecutor]);
  await send('OmertaHook','setRecipients',[recipients.dev,recipients.treasury,addresses.communityExecutor,addresses.ProtocolLiquidityVault]);
  await send('OmertaHook','setSellTax',[400n,100n,100n,100n]);
  await transferNative(addresses.ProtocolLiquidityVault,1000n*E);await send('OMR','transfer',[addresses.ProtocolLiquidityVault,1000n*E]);
  await send('ProtocolLiquidityVault','mintFoundation',[1000n*E,1000n*E,999n*E,BigInt(Math.floor(Date.now()/1000))]);
  const positionId=await read('ProtocolLiquidityVault','positionId');assert.equal(await read('PositionManager','ownerOf',[positionId]),addresses.ProtocolLiquidityVault);
  assert.equal(await read('OMR','allowance',[addresses.ProtocolLiquidityVault,PERMIT2]),0n);
  step('actual v4 full-range foundation held by the fixed vault; approvals reset',{positionId:String(positionId)});
  await deploy('OmertaFees',[SAFE,recipients.dev,addresses.vigExecutor,2500n,E,4n*E]);
  await deploy('FeeRevenueRouter',[addresses.OmertaFees,recipients.dev,addresses.vigExecutor,recipients.treasury,addresses.communityExecutor]);
  await send('OmertaFees','setNonMintRouter',[addresses.FeeRevenueRouter]);
  const before=await Promise.all([recipients.dev,addresses.vigExecutor,recipients.treasury,addresses.communityExecutor].map(address=>publicClient.getBalance({address})));
  const mint=await send('OmertaFees','payMintFee',[],{value:E});
  const afterMint=await Promise.all([recipients.dev,addresses.vigExecutor,recipients.treasury,addresses.communityExecutor].map(address=>publicClient.getBalance({address})));
  assert.deepEqual(afterMint.map((v,i)=>v-before[i]),[E,0n,0n,0n]);
  const respawn=await send('OmertaFees','payRespawnFee',[],{value:4n*E});
  const afterRespawn=await Promise.all([recipients.dev,addresses.vigExecutor,recipients.treasury,addresses.communityExecutor].map(address=>publicClient.getBalance({address})));
  assert.deepEqual(afterRespawn.map((v,i)=>v-afterMint[i]),[2n*E,E,4n*E/10n,6n*E/10n]);
  for(const [receipt,kind,eventName]of [[mint,'mint','MintFeePaid'],[respawn,'respawn','RespawnFeePaid']]){
    const paid=event(receipt,eventName,art('OmertaFees').abi);assert(paid);await recordFeePayment(pool,{nonce:Number(paid.nonce),kind,payer:paid.payer,amountWei:String(paid.amount),txHash:receipt.transactionHash});
  }
  assert.equal(Number((await pool.query('SELECT sum(vig_eth) n FROM vig_revenue')).rows[0].n),1);
  step('mint pays 100% DEV; actual non-mint routing is 50/25/10/15; ledger excludes mint');
  await deploy('KeeperGasVault',[SAFE,E,parseEther('0.2'),parseEther('0.5'),3600n]);
  await send('KeeperGasVault','setKeeperAllowed',[account.address,true]);await transferNative(addresses.KeeperGasVault,E);
  await currentClock();assert.equal(await read('ProtocolLiquidityVault','healthy'),true);
  const names={omr:'OMR',poolManager:'PoolManager',oracle:'GenesisOracle',polVault:'ProtocolLiquidityVault',claim:'VoucherClaim',hook:'OmertaHook',gasVault:'KeeperGasVault',vig:'vigExecutor',desk:'deskExecutor',community:'communityExecutor',pol:'polExecutor'};
  const contracts=Object.fromEntries(await Promise.all(Object.entries(names).map(async([name,key])=>[name,{address:addresses[key],runtimeHash:keccak256(await publicClient.getCode({address:addresses[key]}))}])));
  // Keep the finite rehearsal inside one approved job interval even across a UTC hour boundary.
  const fixtureTimestamp=Number((await publicClient.getBlock()).timestamp);
  let intervalSeconds=3600;
  for(let candidate=3601;candidate<=7200;candidate++)
    if(candidate-fixtureTimestamp%candidate>intervalSeconds-fixtureTimestamp%intervalSeconds)intervalSeconds=candidate;
  assert(intervalSeconds-fixtureTimestamp%intervalSeconds>1800,'Fixture needs time to finish its interval');
  const common={intervalSeconds,minNativeValue:'30000000000000'};
  const buy=(id,target,stream,dest)=>({id,kind:'buyback',target,...common,stream,primaryRecipient:dest,secondaryRecipient:stream===0?dest:zeroAddress,maxAmount:parseEther('0.1').toString(),dailyBudget:E.toString()});
  const token=(id,target,stream,dest)=>({id,kind:'token_revenue',target,...common,stream,primaryRecipient:dest,secondaryRecipient:stream===0?dest:zeroAddress});
  const indexStart=await publicClient.getBlockNumber();
  manifest=validateLiquidityManifest({schemaVersion:1,chainId:4663,governanceSafe:SAFE,keeper:account.address,poolId,contracts,indexing:{startL2Block:String(indexStart),maxBlocks:2000},
    gas:{maxGas:'2000000',maxFeePerGas:'10000000',maxPriorityFeePerGas:'1000000',dailyBudget:parseEther('0.01').toString(),confirmations:1,maxSnapshotAgeSeconds:300},jobs:[
      {id:'gas',kind:'gas_topup',target:'gasVault',...common,recipient:account.address,maxAmount:parseEther('0.2').toString(),dailyBudget:E.toString()},
      buy('vig-buy','vig',0,addresses.VoucherClaim),buy('community-buy','community',2,recipients.community),buy('pol-buy','pol',3,addresses.ProtocolLiquidityVault),
      ...['native','omr'].map(asset=>({id:`hook-${asset}`,kind:'hook_sweep',target:'hook',...common,asset,recipients:{dev:recipients.dev,rwa:recipients.treasury,community:addresses.communityExecutor,lp:addresses.ProtocolLiquidityVault}})),
      {id:'pol-collect',kind:'pol_collect',target:'polVault',...common,deskRecipient:addresses.deskExecutor,vigRecipient:addresses.vigExecutor},
      token('vig-token','vig',0,addresses.VoucherClaim),token('desk-token','desk',1,addresses.VoucherClaim),
      {id:'pol-fund',kind:'pol_fund_inventory',target:'polVault',...common,executor:'pol',maxNative:E.toString(),dailyNativeBudget:(2n*E).toString()},
      {id:'pol-increase',kind:'pol_increase',target:'polVault',...common,maxNative:E.toString(),maxOmr:E.toString(),dailyNativeBudget:(2n*E).toString(),dailyOmrBudget:(2n*E).toString(),slippageBps:100},
    ]});
  await runJob('gas');assert.equal(await read('KeeperGasVault','totalRefilled'),parseEther('0.2'));
  const reserveBefore=Number((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr);
  await runJob('vig-buy');await runJob('community-buy');
  const balanceClaim=await read('OMR','balanceOf',[addresses.VoucherClaim]);assert(balanceClaim>0n);
  const reserveAfter=Number((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr);
  const prize=Number((await pool.query('SELECT balance FROM vig_prize_pool WHERE id=1')).rows[0].balance);
  assert(reserveAfter>reserveBefore&&prize>0&&Math.abs(reserveAfter-reserveBefore-prize)<0.000002);
  assert(BigInt(Math.round((reserveAfter-reserveBefore+prize)*1e6))*10n**12n<=balanceClaim);
  step('confirmed purchases deliver real OMR; reserve and prize claims remain physically backed');
  await send('OMR','approve',[addresses.PoolSwapTest,(1n<<256n)-1n]);
  await send('PoolSwapTest','swap',[key,{zeroForOne:false,amountSpecified:-2n*E,sqrtPriceLimitX96:1461446703485210103287273052203988822378723970341n},{takeClaims:false,settleUsingBurn:false},'0x']);
  await send('PoolSwapTest','swap',[key,{zeroForOne:false,amountSpecified:E/2n,sqrtPriceLimitX96:1461446703485210103287273052203988822378723970341n},{takeClaims:false,settleUsingBurn:false},'0x']);
  await runJob('hook-native');await runJob('hook-omr');await runJob('pol-collect');await runJob('vig-token');await runJob('desk-token');
  step('actual exact-input and exact-output sells; both Hook currencies and 75/25 LP fees delivered');
  await transferNative(addresses.ProtocolLiquidityVault,2n*E);await runJob('pol-fund');await runJob('pol-buy');
  const liquidityBefore=await read('PositionManager','getPositionLiquidity',[positionId]);await runJob('pol-increase');
  assert((await read('PositionManager','getPositionLiquidity',[positionId]))>liquidityBefore);
  assert.equal(await read('PositionManager','ownerOf',[positionId]),addresses.ProtocolLiquidityVault);
  assert.equal(await read('OMR','allowance',[addresses.ProtocolLiquidityVault,PERMIT2]),0n);
  step('prefunded POL inventory purchased and reinvested into the same protected NFT');
  const rows=(await pool.query('SELECT nonce,status,tx_hash,raw_tx FROM keeper_transactions ORDER BY nonce')).rows;
  assert(rows.length>=11&&rows.every((row,i)=>row.status==='settled'&&Number(row.nonce)===i&&keccak256(row.raw_tx)===row.tx_hash));
  const sums=()=>pool.query('SELECT (SELECT count(*) FROM liquidity_settlements) settlements,(SELECT count(*) FROM liquidity_flow_receipts) flows,(SELECT funded_omr FROM chain_reserve WHERE id=1) reserve');
  const once=(await sums()).rows[0];
  const indexed=await syncLiquidityFlows(pool,{manifest,clients});assert(!indexed.alert,json(indexed));
  const twice=(await sums()).rows[0];assert.deepEqual(twice,once,'log recovery must not book keeper receipts twice');
  step('all keeper nonces are signed, durable and settled; public-log recovery does not double-book');
  // Exercise the actual worker wrapper after every approved job has settled in this interval.
  // This is a live local cycle: indexing and queue checks must precede its persisted heartbeat.
  assert(!process.env.VOUCHER_SIGNER_PK,'This E2E requires dormant voucher signing');
  assert(!process.env.BOND_AUTOMATION_DAILY_OMR,'This E2E requires an unset daily bond policy');
  const manifestHash=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
  const nonceBeforeCycle=await publicClient.getTransactionCount({address:account.address,blockTag:'pending'});
  const offeringsBeforeCycle=(await pool.query('SELECT count(*) n FROM bond_offerings')).rows[0].n;
  assert.equal((await pool.query('SELECT count(*) n FROM liquidity_market_status WHERE chain_id=$1 AND manifest_hash=$2',[manifest.chainId,manifestHash])).rows[0].n,'0');
  const automationCycle=await runLiquidityAutomationCycle(pool,{config:{enabled:true,manifest,rpcUrl:RPC},clients});
  assert.equal(automationCycle.state,'idle',json(automationCycle));
  assert.equal(automationCycle.alert,false,json(automationCycle));
  assert.equal(automationCycle.indexed.caughtUp,true);
  assert(!automationCycle.indexed.alert);
  assert.deepEqual(automationCycle.queue,{enabled:false,signed:0,reason:'voucher_signing_dormant'});
  assert.deepEqual(automationCycle.offering,{created:false,reason:'daily_policy_unset'});
  assert.equal(automationCycle.plan.actions.length,0);
  assert.equal(automationCycle.plan.blocked.length,manifest.jobs.length);
  assert(automationCycle.plan.blocked.every(job=>job.reason==='interval_already_attempted'));
  const heartbeat=(await pool.query('SELECT phase,ready,block_number,block_hash,observed_at,expires_at,bond_ready,bond_daily_cap_wei FROM liquidity_market_status WHERE chain_id=$1 AND manifest_hash=$2',[manifest.chainId,manifestHash])).rows[0];
  assert(heartbeat,'Live wrapper must persist deployment-bound health');
  assert.equal(heartbeat.phase,'live');assert.equal(heartbeat.ready,true);
  assert.equal(heartbeat.bond_ready,false);assert.equal(heartbeat.bond_daily_cap_wei,'0');
  assert.equal(String(heartbeat.block_number),automationCycle.plan.blockNumber);
  assert.equal(heartbeat.block_hash,automationCycle.plan.blockHash);
  assert(new Date(heartbeat.observed_at).getTime()<=Date.now());
  assert(new Date(heartbeat.expires_at).getTime()>Date.now());
  assert.equal(new Date(heartbeat.expires_at)-new Date(heartbeat.observed_at),90000);
  assert.equal(await publicClient.getTransactionCount({address:account.address,blockTag:'pending'}),nonceBeforeCycle);
  assert.deepEqual((await pool.query('SELECT nonce,status,tx_hash,raw_tx FROM keeper_transactions ORDER BY nonce')).rows,rows);
  assert.deepEqual((await sums()).rows[0],twice,'live wrapper must not duplicate confirmed accounting');
  assert.equal((await pool.query('SELECT count(*) n FROM bond_offerings')).rows[0].n,offeringsBeforeCycle);
  step('live worker cycle catches up, keeps claims dormant, persists health and remains idle without duplicate accounting',{state:automationCycle.state,indexed:automationCycle.indexed,queue:automationCycle.queue,offering:automationCycle.offering,heartbeat});
  // A different local keeper wallet isolates the deliberate hold from the completed flow.
  // Rotate -> sweep -> restore in one actual block: end-of-block getters look approved, but
  // the native ETH went to a different recipient. Neither settlement lane may book it.
  await send('PoolSwapTest','swap',[key,{zeroForOne:false,amountSpecified:-E,sqrtPriceLimitX96:1461446703485210103287273052203988822378723970341n},{takeClaims:false,settleUsingBurn:false},'0x']);
  await currentClock();
  const probeAccount=privateKeyToAccount(generatePrivateKey());
  const probeClients={publicClient,account:probeAccount,walletClient:createWalletClient({chain,account:probeAccount,transport:http(RPC)})};
  await rpc('anvil_setBalance',[probeAccount.address,'0x'+E.toString(16)]);
  const probeManifest=validateLiquidityManifest({...manifest,keeper:probeAccount.address,jobs:manifest.jobs.filter(j=>j.id==='hook-native')});
  const original=[recipients.dev,recipients.treasury,addresses.communityExecutor,addresses.ProtocolLiquidityVault];
  const changed=[recipients.dev,recipients.dev,addresses.communityExecutor,addresses.ProtocolLiquidityVault];
  const ownerNonce=await publicClient.getTransactionCount({address:SAFE});
  const direct={address:addresses.OmertaHook,abi:art('OmertaHook').abi,functionName:'setRecipients',gas:200000n,maxFeePerGas:10000000n,maxPriorityFeePerGas:1000000n};
  await rpc('evm_setAutomine',[false]);
  const rotatedHash=await deployer.writeContract({...direct,args:changed,nonce:ownerNonce});
  const pending=await runLiquidityKeeper(pool,{config:{enabled:true,manifest:probeManifest,rpcUrl:RPC},clients:probeClients,onConfirmed:bookConfirmedLiquidityAction});
  assert.equal(pending.state,'submitted',json(pending));
  const restoredHash=await deployer.writeContract({...direct,args:original,nonce:ownerNonce+1});
  await rpc('evm_mine');await rpc('evm_setAutomine',[true]);
  const receipts=await Promise.all([rotatedHash,pending.txHash,restoredHash].map(hash=>publicClient.getTransactionReceipt({hash})));
  assert(receipts.every(r=>r.status==='success'&&r.blockHash===receipts[0].blockHash));
  assert.deepEqual(receipts.map(r=>r.transactionIndex),[0,1,2]);
  const held=await runLiquidityKeeper(pool,{config:{enabled:true,manifest:probeManifest,rpcUrl:RPC},clients:probeClients,onConfirmed:bookConfirmedLiquidityAction});
  assert.equal(held.state,'confirmed');assert.equal(held.reason,'hook_recipients_changed_in_sweep_block');
  assert.deepEqual((await sums()).rows[0],twice,'unproven native recipient must not create revenue');
  await assert.rejects(()=>syncLiquidityFlows(pool,{manifest,clients}),error=>error.keeperCode==='hook_recipients_changed_in_sweep_block');
  assert.deepEqual((await sums()).rows[0],twice,'indexer must hold the same unproven delivery');
  const rejected=(await pool.query('SELECT status,tx_hash,broadcast_attempts FROM keeper_transactions WHERE wallet=$1',[probeAccount.address.toLowerCase()])).rows;
  assert.equal(rejected.length,1);assert.equal(rejected[0].status,'confirmed');assert.equal(rejected[0].broadcast_attempts,1);
  step('actual same-block recipient rotation and restoration is held before accounting by keeper and indexer',{heldTransaction:pending.txHash});
  const out=path.join(ROOT,'output','liquidity-automation');fs.mkdirSync(out,{recursive:true});
  const report={scope:'local actual-contract E2E; no production transactions',chainId:4663,steps,transactions:txs,keeperTransactions:rows.map(({raw_tx,...rest})=>rest),automationCycle,heldHookTransaction:rejected[0],ledger:twice,manifest,
    boundaries:['GenesisOracle administered price','EOA governance stand-in','Permit2 upstream runtime etched on disposable Anvil','Fresh loopback PostgreSQL database','No LBP/GenesisController, Bank or daily offering integration in this script'],
    artifacts:Object.fromEntries(Object.keys(artifacts).map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(ROOT,'omerta-contracts','out',`${name}.sol`,`${name}.json`))).digest('hex')]))};
  fs.writeFileSync(path.join(out,'e2e-report.json'),json(report)+'\n');console.log(`PASS ${steps.length} E2E assertions; ${rows.length} actual keeper transactions`);
} finally {await pool.end();anvil.kill();}
