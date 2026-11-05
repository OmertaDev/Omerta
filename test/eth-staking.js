// No chain sends or real RPC: public pins, linked-wallet ownership and browser intent are synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {decodeFunctionData,encodeFunctionData,getAddress,keccak256,parseAbi} from 'viem';
import Fastify from 'fastify';
import {ethStakingBoard,prepareEthStakingTransaction} from '../src/ethstaking.js';
import {marketV2Abi} from '../src/marketv2keeper.js';
import {register} from '../src/routes/ethstaking.js';
const token=getAddress('0x'+'11'.repeat(20)),vault=getAddress('0x'+'22'.repeat(20)),rewards=getAddress('0x'+'33'.repeat(20));
const player=getAddress('0x'+'44'.repeat(20)),other=getAddress('0x'+'55'.repeat(20));
const codes={[token]:'0x6001',[vault]:'0x6002',[rewards]:'0x6003'};
const H=n=>'0x'+BigInt(n).toString(16).padStart(64,'0'),ZERO=H(0),E=10n**18n,D=2592000n;
const digest=b=>createHash('sha256').update(b).digest('hex');
const base=JSON.parse(fs.readFileSync('test/fixtures/eth-upkeep-disabled.json'));
function fixture(){
  const m=structuredClone(base);m.contracts.vault.address=vault.toLowerCase();m.contracts.vault.runtimeHash=keccak256(codes[vault]);
  m.contracts.rewards.address=rewards.toLowerCase();m.contracts.rewards.runtimeHash=keccak256(codes[rewards]);
  const bytes=Buffer.from(JSON.stringify(m));
  const values={ETH_STAKING_UI_ENABLED:'on',ETH_REWARDS_MANIFEST_PATH:'public-policy.json',ETH_REWARDS_MANIFEST_SHA256:digest(bytes),
    OMR_GAME_TOKEN_ADDRESS:token,OMR_GAME_TOKEN_RUNTIME_HASH:keccak256(codes[token]),CHAIN_RPC_URL:'https://rpc-secret.invalid/private-path',CHAIN_CONFIRMATIONS:'5',NODE_ENV:'test'};
  const env=new Proxy(values,{get(o,k){assert(!/KEEPER_KEY|SIGNER_PK|OPERATOR_PK/.test(String(k)),'player rail must never read transaction credentials');return o[k];}});
  const state={wallet:player,paused:false,active:true,recipient:true,role:0,holder:ZERO,allowance:100n*E,balance:10000n*E,
    now:BigInt(Math.floor(Date.now()/1000)),codeWrong:false,wrongChain:false,wrongNumber:false,wrongDuration:false,wrongOwner:false,
    simulationFailure:false,reorg:false,calls:[],simulations:[],afterSimulation:null,held:1000n*E,locked:400n*E,count:20n};
  const pool={async query(sql,args){assert.equal(sql,'SELECT wallet_address FROM account_persistent WHERE account_id=$1');assert.deepEqual(args,['account']);return{rows:[{wallet_address:state.wallet}]};}};
  const pub={
    async getChainId(){state.calls.push('chain');return state.wrongChain?1:4663;},
    async getBlock({blockNumber}){return{number:state.wrongNumber?94n:blockNumber??100n,hash:state.reorg?H(999):H(blockNumber??100n),timestamp:state.now};},
    async getCode({address}){state.calls.push('code');return state.codeWrong?'0x6000':codes[getAddress(address)]??'0x';},
    async readContract({address,functionName:f,args=[]}){
      state.calls.push(f);address=getAddress(address);
      if(address===token){switch(f){case'decimals':return 18;case'policySealed':case'isOperator':return true;
        case'balanceOf':return state.balance;case'allowance':return state.allowance;case'isRecipient':return state.recipient;
        case'operatorRole':return getAddress(args[0])===vault?2:state.role;case'contractHolderRuntimeHash':return state.holder;}}
      if(address===rewards){if(f==='rewardVault')return vault;if(f==='omr')return token;}
      if(address===vault){switch(f){case'omr':return token;case'owner':return state.wrongOwner?other:m.governanceSafe;
        case'governanceSafe':return m.governanceSafe;case'distributor':return rewards;case'distributorRuntimeHash':return keccak256(codes[rewards]);
        case'LOCK_DURATION':case'EPOCH_DURATION':return state.wrongDuration?D+1n:D;case'active':return state.active;case'paused':return state.paused;
        case'currentEpoch':return 3n;case'stakedBalance':return state.held;case'lockedBalance':return state.locked;case'lockCount':return state.count;
        case'lockPosition':{const id=BigInt(args[1]),start=state.now-(id<12n?D+100n:D/2n);return{amount:50n*E,lockedAt:start,unlocksAt:start+D};}
        case'epoch':return{budget:E,totalStakeSeconds:1000n,finalized:true};case'claimed':return false;
        case'claimable':return (BigInt(args[1])+1n)*10n**15n;}}
      throw Error('Unexpected fixture read '+f);
    },
    async simulateContract(request){state.simulations.push(request);if(state.simulationFailure)throw Error('private-rpc-error');await state.afterSimulation?.();return{};},
  };
  return{state,pool,pub,env,values,bytes,m,options:{env,readFile:()=>bytes,publicClient:pub}};
}
const rejected=(p,code)=>assert.rejects(p,e=>e.code===code);
let groups=0;
async function test(name,fn){await fn();groups++;console.log('PASS '+name);}
await test('disabled player rail reads no manifest, account, RPC or credential',async()=>{
  const options={env:{ETH_STAKING_UI_ENABLED:'off'},readFile(){throw Error('No file read while off');}};
  const pool={query(){throw Error('No DB read while off');}};
  assert.equal((await ethStakingBoard(pool,'account',{},options)).available,false);
  await rejected(prepareEthStakingTransaction(pool,'account',{action:'stake',amount:'1'},options),'eth_staking_unavailable');
});
await test('linked-wallet read is independent of character, paid mint and game custody activation',async()=>{
  const f=fixture();f.state.wallet=null;
  assert.equal((await ethStakingBoard(f.pool,'account',{},f.options)).needsWallet,true);assert.equal(f.state.calls.length,0);
  f.state.wallet=player;const b=await ethStakingBoard(f.pool,'account',{},f.options);
  assert.equal(b.wallet,player);assert.equal(b.stakedWei,String(1000n*E));assert.equal(b.lockedWei,String(400n*E));
  assert.equal(b.withdrawableWei,String(600n*E));assert.equal(b.rewardsContinueAfterMaturity,true);
  assert.equal(b.positions.length,16);assert.equal(b.nextPositionsOffset,'16');assert.equal(b.epochs.length,3);
  assert(!JSON.stringify(b).includes('private-path'));assert(!JSON.stringify(b).includes('public-policy.json'));
  const old=await ethStakingBoard(f.pool,'account',{positions:'16',epochs:'999999999999999999999'},f.options);
  assert.equal(old.positions.length,4);assert.equal(old.positions.at(-1).id,'0');assert.equal(old.epochs.length,0);
});
await test('exact approval and stake calldata bind token, vault, amount, account and native chain',async()=>{
  const f=fixture(),a='1.000000000000000001';
  const approval=await prepareEthStakingTransaction(f.pool,'account',{action:'approve',amount:a},f.options);
  assert.equal(approval.to,token);assert.equal(approval.from,player);assert.equal(approval.value,'0x0');assert.equal(approval.chainId,4663);
  const decoded=decodeFunctionData({abi:parseAbi(['function approve(address,uint256)']),data:approval.data});
  assert.equal(decoded.functionName,'approve');assert.equal(getAddress(decoded.args[0]),vault);assert.equal(decoded.args[1],E+1n);
  const stake=await prepareEthStakingTransaction(f.pool,'account',{action:'stake',amount:a},f.options);
  assert.equal(stake.to,vault);assert.deepEqual(decodeFunctionData({abi:marketV2Abi('OmertaEthStakingV2'),data:stake.data}).args,[E+1n]);
  f.state.allowance=0n;await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'stake',amount:'1'},f.options),'eth_staking_approval');
});
await test('registration is explicit and protocol/contract holders cannot open stakes',async()=>{
  const f=fixture();f.state.recipient=false;
  const b=await ethStakingBoard(f.pool,'account',{},f.options);assert.equal(b.canRegister,true);assert.equal(b.canStake,false);
  const tx=await prepareEthStakingTransaction(f.pool,'account',{action:'register'},f.options);
  assert.equal(tx.to,token);assert.deepEqual(decodeFunctionData({abi:parseAbi(['function registerWallet(address)']),data:tx.data}).args,[player]);
  await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'stake',amount:'1'},f.options),'eth_staking_wallet');
  f.state.recipient=true;f.state.role=2;
  await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'approve',amount:'1'},f.options),'eth_staking_wallet');
  f.state.role=0;f.state.holder=H(1);assert.equal((await ethStakingBoard(f.pool,'account',{},f.options)).eligible,false);
});
await test('mature self withdrawals remain usable during pause and never touch reward eligibility on the server',async()=>{
  const f=fixture();f.state.paused=true;f.state.locked=0n;
  const board=await ethStakingBoard(f.pool,'account',{},f.options);assert.equal(board.canStake,false);assert.equal(board.stakedWei,String(1000n*E));
  const tx=await prepareEthStakingTransaction(f.pool,'account',{action:'withdraw',lockId:'0',amount:'2.000000000000000001'},f.options);
  assert.deepEqual(decodeFunctionData({abi:marketV2Abi('OmertaEthStakingV2'),data:tx.data}).args,[0n,2n*E+1n,player]);
  await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'withdraw',lockId:'19',amount:'1'},f.options),'eth_staking_locked');
  await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'withdraw',lockId:'20',amount:'1'},f.options),'eth_staking_position');
  await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'withdraw',lockId:'0',amount:'51'},f.options),'eth_staking_balance');
  await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'stake',amount:'1'},f.options),'eth_staking_paused');
});
await test('claims are bounded closed ascending periods and pay only the linked wallet while paused',async()=>{
  const f=fixture();f.state.paused=true;
  const tx=await prepareEthStakingTransaction(f.pool,'account',{action:'claim',epochs:['0','2']},f.options);
  assert.deepEqual(decodeFunctionData({abi:marketV2Abi('OmertaEthStakingV2'),data:tx.data}).args,[[0n,2n],player]);
  for(const epochs of [[],['0','0'],['2','0'],['3'],Array.from({length:25},(_,i)=>String(i))])
    await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'claim',epochs},f.options),'eth_staking_epochs');
});
await test('malformed amounts, unsafe numeric indices and arbitrary transaction fields reject',async()=>{
  const f=fixture();
  for(const a of ['-1','0','NaN','Infinity','1e3','0.0000000000000000001','9'.repeat(99),1])
    await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'approve',amount:a},f.options),'eth_staking_input');
  await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'withdraw',lockId:Number.MAX_SAFE_INTEGER+1,amount:'1'},f.options),'eth_staking_input');
  await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'approve',amount:'1',to:other},f.options),'eth_staking_input');
  await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'transfer',amount:'1'},f.options),'eth_staking_input');
  await rejected(ethStakingBoard(f.pool,'account',{positions:Number.MAX_SAFE_INTEGER+1},f.options),'eth_staking_input');
  await rejected(ethStakingBoard(f.pool,'account',{positions:'9'.repeat(1000)},f.options),'eth_staking_input');
  assert.equal(f.state.calls.length,0,'invalid input rejects before spending RPC quota');
});
await test('runtime, chain, confirmation block, duration and owner pins reject before simulation',async()=>{
  for(const flag of ['codeWrong','wrongChain','wrongNumber','wrongDuration','wrongOwner']){
    const f=fixture();f.state[flag]=true;
    await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'approve',amount:'1'},f.options),'eth_staking_unavailable');
    assert.equal(f.state.simulations.length,0);
  }
  const f=fixture();f.values.ETH_REWARDS_MANIFEST_SHA256='0'.repeat(64);
  await rejected(ethStakingBoard(f.pool,'account',{},f.options),'eth_staking_unavailable');assert.equal(f.state.calls.length,0);
  const p=fixture();p.values.NODE_ENV='production';p.values.CHAIN_RPC_URL='http://127.0.0.1:8545';
  await rejected(ethStakingBoard(p.pool,'account',{},p.options),'eth_staking_unavailable');
});
await test('simulation, reorg, linked-wallet and public-config drift invalidate prepared calls',async()=>{
  for(const mutate of [f=>{f.state.simulationFailure=true;},f=>{f.state.afterSimulation=()=>{f.state.reorg=true;};},
    f=>{f.state.afterSimulation=()=>{f.state.wallet=other;};},f=>{f.state.afterSimulation=()=>{f.values.ETH_STAKING_UI_ENABLED='off';};},
    f=>{f.state.afterSimulation=()=>{f.state.wrongChain=true;};}]){
    const f=fixture();mutate(f);await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'approve',amount:'1'},f.options),'eth_staking_unavailable');
  }
  const f=fixture(),original=Date.now;f.state.afterSimulation=()=>{Date.now=()=>original()+61000;};
  try{await rejected(prepareEthStakingTransaction(f.pool,'account',{action:'approve',amount:'1'},f.options),'eth_staking_unavailable');}
  finally{Date.now=original;}
});
await test('player routes require authentication and off mode exposes no chain target',async()=>{
  const previous=process.env.ETH_STAKING_UI_ENABLED;process.env.ETH_STAKING_UI_ENABLED='off';
  const app=Fastify();register(app,{pool:{query(){throw Error('Off mode has no DB read');}},auth:async req=>{
    if(req.headers.authorization!=='fixture')throw Object.assign(Error('unauthorized'),{statusCode:401});req.user={sub:'account'};
  }});
  try{
    assert.equal((await app.inject({url:'/v1/eth-staking'})).statusCode,401);
    assert.equal((await app.inject({method:'POST',url:'/v1/eth-staking/transaction',payload:{action:'stake',amount:'1'}})).statusCode,401);
    const r=await app.inject({url:'/v1/eth-staking',headers:{authorization:'fixture'}});assert.equal(r.statusCode,200);
    assert.deepEqual(r.json(),{available:false,reason:'ETH staking is not active in this deployment.'});
  }finally{await app.close();if(previous===undefined)delete process.env.ETH_STAKING_UI_ENABLED;else process.env.ETH_STAKING_UI_ENABLED=previous;}
});
await test('browser amounts retain exact18-decimal units and reject unbounded input',async()=>{
  const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('public/eth-staking.js','utf8'),sandbox);
  const client=sandbox.window.OmertaEthStaking;
  assert.equal(client.parseAmount('1.000000000000000001'),E+1n);assert.equal(client.formatUnits(E+1n),'1.000000000000000001');
  for(const value of ['1e3','-1','0','9'.repeat(99),'0.0000000000000000001'])assert.equal(client.parseAmount(value),null);
});
await test('fixed browser ABI intent matches independent viem encoding for every allowed action',async()=>{
  const sandbox={window:{}};vm.runInNewContext(fs.readFileSync('public/eth-staking.js','utf8'),sandbox);
  const encode=sandbox.window.OmertaEthStaking.intentCalldata;
  const cases=[
    [{action:'register'},parseAbi(['function registerWallet(address)']),'registerWallet',[player]],
    [{action:'approve',amount:'1.000000000000000001'},parseAbi(['function approve(address,uint256)']),'approve',[vault,E+1n]],
    [{action:'stake',amount:'1.000000000000000001'},marketV2Abi('OmertaEthStakingV2'),'stake',[E+1n]],
    [{action:'withdraw',lockId:'19',amount:'2'},marketV2Abi('OmertaEthStakingV2'),'withdraw',[19n,2n*E,player]],
    [{action:'claim',epochs:['0','2','9007199254740993']},marketV2Abi('OmertaEthStakingV2'),'claim',[[0n,2n,9007199254740993n],player]],
  ];
  for(const [intent,abi,functionName,args] of cases)assert.equal(encode(intent,player,vault),encodeFunctionData({abi,functionName,args}));
  assert.throws(()=>encode({action:'transfer',amount:'1'},player,vault),/Unsupported/);
  assert.throws(()=>encode({action:'claim',epochs:['1','1']},player,vault),/unique/);
});
console.log(JSON.stringify({pass:true,groups,publicRpc:'synthetic',mainnetBroadcast:false,databaseWrites:false}));
if(process.argv.includes('--browser')){
  const {chromium}=await import('playwright-core');
  const executable=[process.env.CHROMIUM_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/chromium-browser'].find(p=>p&&fs.existsSync(p));
  assert(executable,'Set CHROMIUM_PATH for this explicit local browser check.');
  const browser=await chromium.launch({executablePath:executable,headless:true});
  const f=fixture(),b=await ethStakingBoard(f.pool,'account',{},f.options);
  b.positions=[b.positions.at(-1),b.positions[0]];b.allowanceWei='0';
  async function pageFor(mode='normal',paused=false){
    const page=await browser.newPage({viewport:{width:390,height:1200}});await page.route('**/*',route=>route.abort());
    await page.setContent('<!doctype html><html><head></head><body><section id="staking"></section></body></html>');
    const html=fs.readFileSync('public/index.html','utf8'),css=html.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1]||'';
    await page.addStyleTag({content:css+'\nbody{display:block;padding:16px}#staking{max-width:900px;margin:auto}#staking input{max-width:100%}'});
    await page.addScriptTag({content:fs.readFileSync('public/eth-staking.js','utf8')});
    await page.evaluate(async({initial,mode,paused,player,other})=>{
      const data=structuredClone(initial);data.paused=paused;data.canStake=!paused;
      let selected=player,chain='0x1237',intent=null;const sent=[],calls=[],notices=[];
      window.test={sent,calls,notices};
      const provider={async request(r){calls.push(r);
        if(r.method==='eth_requestAccounts'||r.method==='eth_accounts')return[selected];
        if(r.method==='wallet_switchEthereumChain')return null;
        if(r.method==='eth_chainId')return chain;
        if(r.method==='eth_getBlockByNumber')return{hash:'0x'+BigInt(95).toString(16).padStart(64,'0')};
        if(r.method==='eth_call'){
          if(mode==='account')selected=other;if(mode==='chain')chain='0x1';
          if(mode==='expiry'){const now=Date.now();Date.now=()=>now+120000;}return'0x';
        }
        if(r.method==='eth_sendTransaction'){sent.push(r.params[0]);return'0x'+'ab'.repeat(32);}
        if(r.method==='eth_getTransactionReceipt'){
          if(intent.action==='approve')data.allowanceWei=String(window.OmertaEthStaking.parseAmount(intent.amount));
          return{status:'0x1'};
        }
        throw Error('Unexpected wallet method '+r.method);
      }};
      const api=async(method,url,body)=>{
        if(method==='GET')return{code:200,body:structuredClone(data)};
        intent=body;window.test.lastIntent=body;
        let calldata=window.OmertaEthStaking.intentCalldata(body,player,data.vault);
        if(mode==='spender')calldata=window.OmertaEthStaking.intentCalldata(body,player,other);
        if(mode==='amount')calldata=window.OmertaEthStaking.intentCalldata({...body,amount:'3'},player,data.vault);
        if(mode==='method')calldata=window.OmertaEthStaking.intentCalldata({action:'stake',amount:'1'},player,data.vault);
        if(mode==='claimRecipient')calldata=window.OmertaEthStaking.intentCalldata(body,other,data.vault);
        return{code:200,body:{action:body.action,chainId:4663,from:player,to:body.action==='approve'||body.action==='register'?data.token:data.vault,
          value:'0x0',data:calldata,blockNumber:'95',blockHash:'0x'+BigInt(95).toString(16).padStart(64,'0'),expiresAt:String(Math.floor(Date.now()/1000)+60)}};
      };
      await window.OmertaEthStaking.mount(document.querySelector('#staking'),{api,pickProvider:async()=>provider,toast:t=>notices.push(t),linkWallet:async()=>{}});
    },{initial:b,mode,paused,player,other});
    return page;
  }
  try{
    await test('browser approval is finite and stake requires a new user action and fresh preparation',async()=>{
      const page=await pageFor();
      await page.locator('[data-eth-amount]').fill('2.000000000000000001');
      assert.equal(await page.locator('[data-eth-approve]').isEnabled(),true);assert.equal(await page.locator('[data-eth-stake]').isDisabled(),true);
      await page.locator('[data-eth-approve]').click();
      await page.waitForFunction(()=>window.test.sent.length===1&&window.test.notices.length>0);
      assert.equal(await page.evaluate(()=>window.test.lastIntent.amount),'2.000000000000000001');
      assert.equal(await page.evaluate(()=>window.test.sent.length),1,'approval must never automatically send a stake');
      await page.locator('[data-eth-amount]').fill('2.000000000000000001');await page.locator('[data-eth-stake]').click();
      await page.waitForFunction(()=>window.test.sent.length===2);
      assert.equal(await page.evaluate(()=>window.test.lastIntent.action),'stake');
      assert.equal(await page.evaluate(()=>window.test.sent.every(tx=>tx.chainId==='0x1237'&&tx.value==='0x0')),true);
      await page.close();
    });
    await test('browser refuses account chain and expiry changes during wallet simulation',async()=>{
      for(const mode of ['account','chain','expiry']){
        const page=await pageFor(mode);await page.locator('[data-eth-amount]').fill('1');await page.locator('[data-eth-approve]').click();
        await page.waitForFunction(()=>window.test.notices.length>0);
        assert.equal(await page.evaluate(()=>window.test.sent.length),0,mode+' must prevent wallet send');
        assert.match(await page.locator('[data-eth-status]').textContent(),/wallet, chain or prepared call changed/);await page.close();
      }
    });
    await test('browser refuses changed spender amount method and claim recipient calldata',async()=>{
      for(const mode of ['spender','amount','method','claimRecipient']){
        const page=await pageFor(mode);
        if(mode==='claimRecipient')await page.locator('[data-eth-claim]').click();
        else{await page.locator('[data-eth-amount]').fill('1');await page.locator('[data-eth-approve]').click();}
        await page.waitForFunction(()=>window.test.notices.length>0);
        assert.equal(await page.evaluate(()=>window.test.sent.length),0,mode+' must not send');
        assert.equal(await page.evaluate(()=>window.test.calls.some(c=>c.method==='eth_call')),false,'mismatch rejects before wallet simulation');
        assert.match(await page.locator('[data-eth-status]').textContent(),/does not match your staking request/);await page.close();
      }
    });
    await test('browser paused mature withdrawal and ETH claim stay visible without a renewal action',async()=>{
      const page=await pageFor('normal',true);
      assert.match(await page.locator('#staking').innerText(),/After day 30 it keeps earning until you withdraw/);
      assert.equal(await page.locator('[data-eth-stake]').isDisabled(),true);
      const withdraw=page.locator('[data-eth-withdraw]').first();assert.equal(await withdraw.isEnabled(),true);
      await withdraw.click();await page.waitForFunction(()=>window.test.sent.length===1&&window.test.notices.length>0);
      assert.equal(await page.evaluate(()=>window.test.lastIntent.action),'withdraw');
      await page.locator('[data-eth-claim]').click();await page.waitForFunction(()=>window.test.sent.length===2);
      assert.deepEqual(await page.evaluate(()=>window.test.lastIntent.epochs),['0','1','2']);
      await page.screenshot({path:'output/pr310-native-eth/eth-staking-player-mobile.png',fullPage:true});await page.close();
    });
  }finally{await browser.close();}
  console.log(JSON.stringify({pass:true,groups,browser:'synthetic EIP-1193',externalRequestsBlocked:true,mainnetBroadcast:false}));
}
