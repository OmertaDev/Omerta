// Closed planner and pinned RPC read-model proofs; all addresses/keys/RPC answers are synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { decodeFunctionData, keccak256, parseAbi, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { liquidityKeeperConfig, makeLiquidityKeeperClients, planLiquidityActions, readLiquiditySnapshot,
  runLiquidityKeeper, validateLiquidityManifest } from '../src/liquiditykeeper.js';

const address=(n)=>`0x${n.toString(16).padStart(40,'0')}`;
const CODE='0x60006000', RUNTIME=keccak256(CODE), ETH=10n**18n;
const PK=`0x${'1'.padStart(64,'0')}`, KEEPER=privateKeyToAccount(PK).address.toLowerCase();
const base={schemaVersion:1,chainId:4663,governanceSafe:address(1),keeper:KEEPER,poolId:`0x${'ab'.repeat(32)}`,
  indexing:{startL2Block:'1',maxBlocks:2000},
  contracts:{...Object.fromEntries(['omr','poolManager','oracle','polVault','hook','gasVault','vig','desk','community','polBuyback'].map((name,i)=>[name,{address:address(i+10),runtimeHash:RUNTIME}])),claim:{address:address(30),runtimeHash:RUNTIME}},
  gas:{maxGas:'100000',maxFeePerGas:'1000',maxPriorityFeePerGas:'100',dailyBudget:String(ETH),confirmations:2,maxSnapshotAgeSeconds:60},jobs:[]};
const jobs=[
  {id:'hookNative',kind:'hook_sweep',target:'hook',asset:'native',recipients:{dev:address(31),rwa:address(32),community:base.contracts.community.address,lp:base.contracts.polVault.address}},
  {id:'hookOmr',kind:'hook_sweep',target:'hook',asset:'omr',recipients:{dev:address(31),rwa:address(32),community:base.contracts.community.address,lp:base.contracts.polVault.address}},
  {id:'vigBuy',kind:'buyback',target:'vig',stream:0,primaryRecipient:address(30),secondaryRecipient:address(30),maxAmount:String(ETH),dailyBudget:String(ETH*2n)},
  {id:'vigToken',kind:'token_revenue',target:'vig',stream:0,primaryRecipient:address(30),secondaryRecipient:address(30)},
  {id:'polCollect',kind:'pol_collect',target:'polVault',deskRecipient:base.contracts.desk.address,vigRecipient:base.contracts.vig.address},
  {id:'polIncrease',kind:'pol_increase',target:'polVault',maxNative:String(ETH),maxOmr:String(ETH*100n),dailyNativeBudget:String(ETH*2n),dailyOmrBudget:String(ETH*200n),slippageBps:300},
  {id:'polInventory',kind:'pol_fund_inventory',target:'polVault',executor:'polBuyback',maxNative:String(ETH),dailyNativeBudget:String(ETH*2n)},
  {id:'gasRefill',kind:'gas_topup',target:'gasVault',recipient:KEEPER,maxAmount:String(ETH),dailyBudget:String(ETH*2n)},
].map(j=>({...j,intervalSeconds:300,minNativeValue:String(ETH/1000n)}));
const manifest=()=>structuredClone({...base,jobs});
let passed=0;
const check=(name)=>{passed++;console.log(`PASS ${name}`);};

function fixture(options={}) {
  const m=manifest(),block={number:100n,hash:`0x${'cd'.repeat(32)}`,timestamp:BigInt(Math.floor(Date.now()/1000))-(options.staleHead?301n:0n)};
  const readCalls=[];
  let blockReads=0;
  const names=Object.fromEntries(Object.entries(m.contracts).map(([n,t])=>[t.address,n]));
  const pub={
    getChainId:async()=>options.wrongChain?1:4663,
    getBlock:async()=>{blockReads++;return options.reorg&&blockReads>1?{...block,hash:`0x${'ee'.repeat(32)}`}:{...block};},
    getCode:async()=>options.wrongCode?'0x6001':CODE,
    getBalance:async()=>options.noGas?0n:ETH*5n,
    simulateContract:async()=>({result:options.emptyCollection?[0n,0n]:[ETH,ETH*100n]}),
    readContract:async({address:target,functionName:f,args,blockNumber})=>{
      assert.equal(blockNumber,100n,'every read pins the same chain block');readCalls.push(f);
      const name=names[target.toLowerCase()];
      if(options.failRead===f) throw new Error('RPC unavailable');
      if(f==='owner')return options.wrongOwner?address(99):m.governanceSafe;
      if(f==='authorized')return m.contracts.poolManager.address; // initializer is deliberately not the Safe owner
      if(f==='healthy')return !options.unhealthy;
      if(f==='consult')return options.staleOracle?[100n*ETH,1n]:[100n*ETH,block.timestamp];
      if(f==='balanceOf')return ETH*100n;
      if(f==='omr')return m.contracts.omr.address;
      if(f==='poolManager')return m.contracts.poolManager.address;
      if(f==='poolId')return m.poolId;
      if(f==='oracle')return m.contracts.oracle.address;
      if(f==='healthGuard')return m.contracts.polVault.address;
      if(f==='paused')return !!options.paused;
      if(f==='emergencyLatched')return !!options.emergency;
      if(f==='keeper')return name==='polVault'?KEEPER:!options.unauthorized;
      if(f==='allowedKeeper')return !options.unauthorized;
      if(f==='refillAmount')return options.excessRefill?ETH*2n:ETH/2n;
      if(f==='perRefillCap')return options.excessRefillCap?ETH*2n:ETH;
      if(f==='positionId')return 123n;
      if(f==='pendingFees')return [ETH,ETH*100n];
      if(f==='budgetAvailable')return [ETH,ETH*100n];
      if(f==='quoteLiquidity')return 1000000n;
      if(f==='inventoryExecutor')return m.contracts.polBuyback.address;
      if(f==='inventoryExecutorCodeHash')return RUNTIME;
      if(f==='stream')return 0;
      if(f==='primaryRecipient'||f==='secondaryRecipient')return options.wrongRecipient?address(99):address(30);
      if(f==='sequence')return 5n;
      if(f==='perAction')return ETH;
      if(f==='perDay')return ETH*5n;
      if(f==='spentInDay')return ETH;
      if(f==='nextExecutionAt')return options.cooldown?block.timestamp+1n:0n;
      if(f==='quoteFloor')return 97n*ETH;
      if(f==='owed')return options.dust?[1n,0n,0n,0n]:[ETH/10n,ETH/10n,ETH/10n,ETH/10n];
      if(f==='deskRecipient')return m.contracts.desk.address;
      if(f==='vigRecipient')return m.contracts.vig.address;
      const hookRecipient={devRecipient:address(31),rwaRecipient:address(32),communityRecipient:m.contracts.community.address,lpRecipient:m.contracts.polVault.address};
      if(hookRecipient[f])return hookRecipient[f];
      throw new Error(`Unsupported synthetic getter ${name}.${f}`);
    },
  };
  return {m,clients:{publicClient:pub},readCalls};
}

function bankFixture(options={}) {
  const f=fixture();
  for (const [i,name] of ['bankAlchemist','bankAsset','bankVault','bankTransmuter','bankDebt'].entries()) {
    f.m.contracts[name]={address:address(40+i),runtimeHash:RUNTIME};
  }
  const common={target:'bankAlchemist',asset:'bankAsset',vault:'bankVault',transmuter:'bankTransmuter',debtToken:'bankDebt',
    assetDecimals:6,minAssetAmount:'10000',feeRecipient:address(50),intervalSeconds:600};
  f.m.jobs=[{...common,id:'bankHarvestOwner',kind:'bank_harvest',user:address(51)},{...common,id:'bankSweep',kind:'bank_sweep'}];
  const original=f.clients.publicClient.readContract;
  f.clients.publicClient.readContract=async(q)=>{
    const target=q.address.toLowerCase(),fn=q.functionName;
    if (fn==='asset' && [address(40),address(42),address(43)].includes(target)) return options.wrongAsset?address(99):address(41);
    if(fn==='decimals' && target===address(41))return options.wrongDecimals?18:6;
    if(fn==='decimals' && target===address(44))return 18;
    if(fn==='debtToken' && [address(40),address(43)].includes(target))return address(44);
    if(fn==='funder' && target===address(43))return !options.notFunder;
    if(target===address(40)) {
      const values={vault:address(42),transmuter:address(43),feeRecipient:address(50),scale:10n**12n,accruedFees:options.noFees?0n:100000n,
        principalOf:1000000n,collateralOf:2000000n,debtOf:options.noDebt?0n:ETH/2n,harvestFeeBps:2000};
      if(fn in values)return values[fn];
    }
    return original(q);
  };
  return f;
}

function bankBufferFixture(options={}) {
  const f=bankFixture(options);
  f.m.contracts.bankBuffer={address:address(45),runtimeHash:RUNTIME};
  f.m.jobs=[{id:'bankBufferRepair',kind:'bank_fund_buffer',target:'bankBuffer',asset:'bankAsset',transmuter:'bankTransmuter',debtToken:'bankDebt',
    assetDecimals:6,minAssetAmount:'10000',maxAssetAmount:'200000',dailyAssetBudget:'400000',intervalSeconds:600}];
  const original=f.clients.publicClient.readContract;
  f.clients.publicClient.readContract=async(q)=>{
    if(q.functionName==='allowance' && q.address.toLowerCase()===address(41))return options.residualAllowance?1n:0n;
    if(q.address.toLowerCase()===address(45)) {
      const values={asset:address(41),transmuter:address(43),assetCodeHash:options.changedDependency?`0x${'00'.repeat(32)}`:RUNTIME,
        transmuterCodeHash:RUNTIME,paused:!!options.paused,fundingAmount:options.noDeficit?0n:50000n,perActionCap:options.highCap?300000n:100000n};
      if(q.functionName in values)return values[q.functionName];
    }
    return original(q);
  };
  f.clients.publicClient.simulateContract=async()=>({result:options.noDeficit?0n:50000n});
  return f;
}

{
  const m=validateLiquidityManifest(manifest());
  assert.equal(m.jobs.length,8);
  for(const mutate of [m=>m.chainId=1,m=>m.jobs[0].calldata='0x1234',m=>m.jobs[0].kind='arbitrary',m=>m.contracts.omr.runtimeHash='0x',
    m=>m.jobs[2].primaryRecipient=address(99),m=>m.jobs[7].recipient=address(99),m=>m.jobs[5].slippageBps=1001,
    m=>m.jobs.push({...m.jobs[0],id:'duplicate'}),m=>m.jobs[0].minNativeValue='1',m=>m.keeper=m.governanceSafe]) {
    const changed=manifest();mutate(changed);assert.throws(()=>validateLiquidityManifest(changed));
  }
  check('manifest rejects arbitrary calls, wrong chain, unpinned targets, custody drift, duplicate lanes, gas dust and excessive slippage');
}
{
  const f=fixture(),snapshot=await readLiquiditySnapshot(f.m,f.clients),plan=planLiquidityActions(f.m,snapshot);
  assert.equal(plan.actions.length,8);assert.equal(plan.actions[0].kind,'gas_topup');
  const buy=plan.actions.find(a=>a.kind==='buyback');
  assert.deepEqual(decodeFunctionData({abi:parseAbi(['function execute(uint256,uint256,uint256)']),data:buy.request.data}).args,[ETH,97n*ETH,BigInt(snapshot.timestamp)+180n]);
  assert.equal(buy.metadata.claimRecipient,address(30));assert.equal(buy.accountingRequired,true);
  const increase=plan.actions.find(a=>a.kind==='pol_increase');
  assert.deepEqual(decodeFunctionData({abi:parseAbi(['function increase(uint128,uint128,uint128,uint256)']),data:increase.request.data}).args,[ETH,100n*ETH,970000n,BigInt(snapshot.timestamp)+180n]);
  assert.equal(increase.request.value,'0','POL adds spend vault inventory, never attached keeper funds');
  assert.equal(increase.budgets.length,2);
  const repeated=planLiquidityActions(f.m,snapshot,{completedJobKeys:plan.actions.map(a=>a.jobKey)});
  assert.equal(repeated.actions.length,0);
  const fair=planLiquidityActions(f.m,snapshot,{lastAttemptByJob:{hookNative:99,hookOmr:98,vigBuy:97,vigToken:96,polCollect:95,polIncrease:94,polInventory:93,gasRefill:92}});
  assert.equal(fair.actions[0].kind,'gas_topup');assert.equal(fair.actions[1].jobId,'polInventory');
  check('typed calldata pins recipients, oracle floor, fixed POL position and zero keeper value with bounded asset budgets');
}
{
  for(const option of ['wrongChain','wrongCode','reorg','staleHead']) {const f=fixture({[option]:true});await assert.rejects(()=>readLiquiditySnapshot(f.m,f.clients));}
  const owner=fixture({wrongOwner:true});await assert.rejects(()=>readLiquiditySnapshot(owner.m,owner.clients));
  const recipient=fixture({wrongRecipient:true});const plan=planLiquidityActions(recipient.m,await readLiquiditySnapshot(recipient.m,recipient.clients));
  assert.equal(plan.actions.some(a=>['buyback','token_revenue'].includes(a.kind)),false);
  const initializer=fixture();initializer.m.jobs[0].initializer='poolManager';
  assert.equal(planLiquidityActions(initializer.m,await readLiquiditySnapshot(initializer.m,initializer.clients)).actions.some(a=>a.jobId==='hookNative'),true);
  initializer.m.jobs[0].initializer='oracle';
  assert.equal(planLiquidityActions(initializer.m,await readLiquiditySnapshot(initializer.m,initializer.clients)).actions.some(a=>a.jobId==='hookNative'),false);
  check('RPC domain/code/reorg failures reject observations and owner/recipient binding failures cannot authorize jobs');
}
{
  for(const option of ['unhealthy','emergency','paused']) {
    const f=fixture({[option]:true}),plan=planLiquidityActions(f.m,await readLiquiditySnapshot(f.m,f.clients));
    assert.equal(plan.actions.some(a=>a.kind==='pol_increase'||a.kind==='pol_fund_inventory'),false);
    if(option!=='emergency')assert.equal(plan.actions.some(a=>a.kind==='buyback'),false);
  }
  const f=fixture({cooldown:true});assert.equal(planLiquidityActions(f.m,await readLiquiditySnapshot(f.m,f.clients)).actions.some(a=>a.kind==='buyback'),false);
  check('unhealthy foundation, emergency latch, pause and executor cooldown stop dependent asset spending');
}
{
  const f=fixture(),snapshot=await readLiquiditySnapshot(f.m,f.clients);
  assert.throws(()=>planLiquidityActions(f.m,snapshot,{nowMs:snapshot.readAt+60001}),/stale_snapshot/);
  const empty=fixture({noGas:true});assert.equal(planLiquidityActions(empty.m,await readLiquiditySnapshot(empty.m,empty.clients)).actions.length,0);
  const dust=fixture({dust:true});assert.equal(planLiquidityActions(dust.m,await readLiquiditySnapshot(dust.m,dust.clients)).actions.some(a=>a.kind==='hook_sweep'),false);
  const excessive=fixture({excessRefill:true});assert.equal(planLiquidityActions(excessive.m,await readLiquiditySnapshot(excessive.m,excessive.clients)).actions.some(a=>a.kind==='gas_topup'),false);
  const refillCap=fixture({excessRefillCap:true});assert.equal(planLiquidityActions(refillCap.m,await readLiquiditySnapshot(refillCap.m,refillCap.clients)).actions.some(a=>a.kind==='gas_topup'),false);
  const stale=fixture({staleOracle:true});assert.equal(planLiquidityActions(stale.m,await readLiquiditySnapshot(stale.m,stale.clients)).actions.some(a=>a.kind==='token_revenue'),false);
  const emptyCollection=fixture({emptyCollection:true});assert.equal(planLiquidityActions(emptyCollection.m,await readLiquiditySnapshot(emptyCollection.m,emptyCollection.clients)).actions.some(a=>a.kind==='pol_collect'),false);
  check('stale observations, unseeded keeper gas, uneconomic sweeps, over-cap refills and stale token valuation fail closed');
}
{
  const f=fixture(),snapshot=await readLiquiditySnapshot(f.m,f.clients);
  f.m.jobs=f.m.jobs.filter(j=>j.kind==='buyback');
  Object.assign(f.m.jobs[0],{id:'deskBuy',stream:1,target:'desk',secondaryRecipient:zeroAddress});
  snapshot.jobs.deskBuy={...snapshot.jobs.vigBuy};
  assert.equal(planLiquidityActions(f.m,snapshot).actions.length,0);
  assert.equal(planLiquidityActions(f.m,snapshot,{planningContext:{desk:{deskBuy:{buyAllowed:false,anchorEthPerOmr:0.01}}}}).actions.length,0);
  const allowed=planLiquidityActions(f.m,snapshot,{planningContext:{desk:{deskBuy:{buyAllowed:true,anchorEthPerOmr:0.012,minOutWei:String(101n*ETH)}}}});
  assert.equal(allowed.actions.length,1);assert.equal(allowed.actions[0].metadata.anchorEthPerOmr,0.012);
  assert.equal(decodeFunctionData({abi:parseAbi(['function execute(uint256,uint256,uint256)']),data:allowed.actions[0].request.data}).args[1],101n*ETH);
  check('Desk requires explicit database band strategy and preserves its approved anchor in receipt metadata');
}
{
  const f=bankFixture(),plan=planLiquidityActions(f.m,await readLiquiditySnapshot(f.m,f.clients));
  assert.equal(plan.actions.length,2);
  const harvest=plan.actions.find(a=>a.kind==='bank_harvest');
  assert.deepEqual(decodeFunctionData({abi:parseAbi(['function harvest(address)']),data:harvest.request.data}).args,[address(51)]);
  assert.equal(harvest.metadata.previewAssetAmount,'500000');
  assert.equal(harvest.economicNativeValue,null,'maintenance does not invent a USD/ETH conversion');
  assert.equal(harvest.metadata.serviceBudget,true);
  assert.equal(harvest.accountingRequired,true);
  for(const key of ['wrongAsset','wrongDecimals','notFunder']) {
    const denied=bankFixture({[key]:true}),p=planLiquidityActions(denied.m,await readLiquiditySnapshot(denied.m,denied.clients));
    assert.equal(p.actions.some(a=>a.kind==='bank_harvest'),false);
  }
  const empty=bankFixture({noDebt:true,noFees:true});assert.equal(planLiquidityActions(empty.m,await readLiquiditySnapshot(empty.m,empty.clients)).actions.length,0);
  const arbitrary=bankFixture();arbitrary.m.jobs[0].kind='bank_fund';assert.throws(()=>validateLiquidityManifest(arbitrary.m),/unsupported_job_kind/);
  check('Bank service jobs use predeclared borrower/market/asset bindings, positive debt service and accrued-fee floors without a fictional asset price');
}
{
  const f=bankBufferFixture(),plan=planLiquidityActions(f.m,await readLiquiditySnapshot(f.m,f.clients));
  assert.equal(plan.actions.length,1);
  const fund=plan.actions[0];
  assert.equal(decodeFunctionData({abi:parseAbi(['function fundDeficit() returns (uint256)']),data:fund.request.data}).functionName,'fundDeficit');
  assert.equal(fund.request.value,'0');assert.equal(fund.budgets[0].amount,'100000');
  assert.equal(fund.metadata.transmuter,address(43));assert.equal(fund.accountingRequired,true);
  for(const key of ['highCap','noDeficit','residualAllowance','changedDependency','notFunder','paused']) {
    const denied=bankBufferFixture({[key]:true});assert.equal(planLiquidityActions(denied.m,await readLiquiditySnapshot(denied.m,denied.clients)).actions.length,0);
  }
  check('Bank buffer funding uses the prefunded fixed-market vault with no caller amount, full action-cap reservation and zero residual allowance');
}
{
  for(const scenario of [
    {mode:'ready',expected:true},
    {mode:'ready',policy:'capped',expected:true},
    {mode:'paused',reason:'bond_paused'},
    {mode:'uncapped',reason:'bond_daily_policy_mismatch'},
    {mode:'wrongMinter',reason:'deployment_binding_mismatch'},
    {mode:'uncapped',policy:'unlimited',expected:true},
    {mode:'ready',policy:'unlimited',reason:'bond_daily_policy_mismatch'},
    ...['paused','unhealthy','wrongMinter','wrongBondOwner','wrongBondToken','wrongBondGuard','wrongBondOracle',
      'zeroMaxPrice','zeroCeiling','zeroOraclePrice','oracleFailure'].map(mode=>({mode,policy:'unlimited'})),
  ]) {
    const {mode,policy}=scenario;
    const f=fixture({unhealthy:mode==='unhealthy'});f.m.contracts.bond={address:address(70),runtimeHash:RUNTIME};
    if(policy!==undefined)f.m.bondDailyIssuance=policy;
    const original=f.clients.publicClient.readContract;
    f.clients.publicClient.readContract=async(q)=>{
      if(q.functionName==='minter')return mode==='wrongMinter'?address(71):address(70);
      if(q.address.toLowerCase()===address(70)) {
        if(mode==='oracleFailure'&&q.functionName==='priceCeiling')throw new Error('oracle unavailable');
        const values={owner:mode==='wrongBondOwner'?address(71):f.m.governanceSafe,
          omr:mode==='wrongBondToken'?address(71):f.m.contracts.omr.address,
          liquidityHealthGuard:mode==='wrongBondGuard'?address(71):f.m.contracts.polVault.address,
          oracle:mode==='wrongBondOracle'?address(71):f.m.contracts.oracle.address,
          paused:mode==='paused',dailyCapOMR:mode==='uncapped'||policy==='unlimited'&&mode!=='ready'?0n:ETH*1000n,
          maxOmrPerEth:mode==='zeroMaxPrice'?0n:ETH*200n,
          priceCeiling:[mode==='zeroCeiling'?0n:ETH*100n,mode==='zeroOraclePrice'?0n:ETH*90n]};
        if(q.functionName in values)return values[q.functionName];
      }
      return original(q);
    };
    const snapshot=await readLiquiditySnapshot(f.m,f.clients);
    assert.equal(snapshot.bond.ready,scenario.expected===true,`${policy??'default'}/${mode}`);
    assert.equal(snapshot.bond.dailyIssuancePolicy,policy??'capped');
    if(scenario.reason)assert.equal(snapshot.bond.reason,scenario.reason);
    assert.equal(snapshot.health,mode!=='unhealthy');
    if(mode!=='unhealthy')assert(planLiquidityActions(f.m,snapshot).actions.some(a=>a.kind==='buyback'),'A paused or mismatched Bond must not disable independent ready revenue jobs');
  }
  const absent=fixture();assert.equal((await readLiquiditySnapshot(absent.m,absent.clients)).bond.reason,'bond_not_configured');
  assert.equal(Object.hasOwn(validateLiquidityManifest(absent.m),'bondDailyIssuance'),false,'default behavior must not insert a field into existing manifest hashes');
  for(const invalid of [null,'','UNLIMITED','unbounded',0,false,{}]) {
    const m=manifest();m.bondDailyIssuance=invalid;
    assert.throws(()=>validateLiquidityManifest(m),/invalid_bond_daily_issuance_policy/);
  }
  const missing=manifest();missing.bondDailyIssuance='unlimited';
  assert.throws(()=>validateLiquidityManifest(missing),/missing_bond_dependency_pin/);
  const badRuntime=fixture({wrongCode:true});badRuntime.m.bondDailyIssuance='unlimited';
  badRuntime.m.contracts.bond={address:address(70),runtimeHash:RUNTIME};
  await assert.rejects(()=>readLiquiditySnapshot(badRuntime.m,badRuntime.clients),/target_code_mismatch/);
  check('Bond daily issuance requires exact manifest/cap parity; unlimited preserves owner/token/minter/health/oracle/price/pause/runtime guards and existing manifest hashes');
}
{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omerta-liquidity-policy-'));
  const file=path.join(dir,'manifest.json'),bytes=JSON.stringify(manifest());fs.writeFileSync(file,bytes);
  const env={LIQUIDITY_AUTOMATION_ENABLED:'on',LIQUIDITY_AUTOMATION_MANIFEST_PATH:file,LIQUIDITY_AUTOMATION_MANIFEST_SHA256:createHash('sha256').update(bytes).digest('hex'),CHAIN_ID:'4663',CHAIN_RPC_URL:'https://example.invalid',LIQUIDITY_KEEPER_PK:PK};
  try {
    assert.equal(liquidityKeeperConfig({}).enabled,false);
    const config=liquidityKeeperConfig(env);assert.equal(config.enabled,true);
    assert.equal(makeLiquidityKeeperClients(config,{env}).account,undefined);
    assert.equal(makeLiquidityKeeperClients(config,{env,signing:true}).account.address.toLowerCase(),KEEPER);
    assert.throws(()=>liquidityKeeperConfig({...env,LIQUIDITY_AUTOMATION_MANIFEST_SHA256:'0'.repeat(64)}),/manifest_digest_mismatch/);
    assert.throws(()=>liquidityKeeperConfig({...env,DEX_BOT_ENABLED:'on'}),/legacy_dex_bot_conflict/);
    assert.throws(()=>liquidityKeeperConfig({...env,DEX_BOT_PK:PK}),/legacy_dex_bot_conflict/);
    assert.throws(()=>makeLiquidityKeeperClients(config,{env:{...env,V4_ORACLE_KEEPER_PK:PK},signing:true}),/shared_privileged_key/);
    assert.throws(()=>makeLiquidityKeeperClients(config,{env:{...env,VOUCHER_SIGNER_PK:PK.slice(2)},signing:true}),/shared_privileged_key/);
    const f=fixture(),result=await runLiquidityKeeper(null,{config:{enabled:true,manifest:f.m},clients:f.clients,dryRun:true});
    assert.equal(result.state,'planned');assert.equal(result.plan.actions.length,8);
    assert.equal((await runLiquidityKeeper(null,{config:{enabled:false,reason:'off'}})).state,'disabled');
  }finally{fs.unlinkSync(file);fs.rmdirSync(dir);}
  check('read-only default needs no signer, manifest byte digest and dedicated signer are enforced, disabled mode is inert');
}
if(process.env.DATABASE_URL) {
  const {default:pg}=await import('pg');
  const {buildLiquidityPlanningContext}=await import('../src/liquiditypolicy.js');
  const readonly=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,options:'-c default_transaction_read_only=on'});
  try {
    assert.equal((await readonly.query("SELECT current_setting('default_transaction_read_only') AS value")).rows[0].value,'on');
    const before=(await readonly.query('SELECT COUNT(*) AS n FROM liquidity_market_status')).rows[0].n;
    const f=fixture(),snapshot=await readLiquiditySnapshot(f.m,f.clients);
    await buildLiquidityPlanningContext(readonly,f.m,snapshot,{persist:false});
    assert.equal((await readonly.query('SELECT COUNT(*) AS n FROM liquidity_market_status')).rows[0].n,before);
    check('read-only PostgreSQL planning context computes policy without writing a heartbeat or running schema migrations');
  }finally{await readonly.end();}
}
console.log(`PASS liquidity keeper: ${passed} cases; no live transactions`);
