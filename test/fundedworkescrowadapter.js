import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeEventTopics,encodeAbiParameters,decodeFunctionData,encodeFunctionResult,keccak256 } from 'viem';
import { observeWorkEscrowSource,canonicalTrainingWorkOutcome,trainingWorkHash,workEscrowConsent } from '../src/fundedworkescrowadapter.js';
import { WORK_ESCROW_ABI,WORK_ESCROW_RUNTIME_KECCAK,WORK_ESCROW_CREATION_KECCAK,WORK_ESCROW_SOURCE_SHA256 } from '../src/fundedworkescrowartifact.js';
import { ETHEREUM_USDC } from '../src/fundedworkchainobservations.js';
assert(!process.env.DATABASE_URL,'Reject ambient endpoint');
const native=process.argv.includes('--postgres');
if(native){const u=new URL(process.env.FUNDED_WORK_ADAPTER_TEST_DATABASE_URL);assert(['postgres:','postgresql:'].includes(u.protocol));assert.equal(u.hostname,'127.0.0.1');assert.match(u.pathname,/^\/funded_work_adapter_test_[a-z0-9_]+$/);assert(!u.search&&!u.hash);
 const local=['35439','35449'].includes(u.port)&&u.username==='pilot_runner'&&!u.password,ci=u.port==='5432'&&u.username==='postgres'&&u.password==='pgcheck';assert(local||ci);
 const{default:pg}=await import('pg'),p=new pg.Pool({connectionString:u.href});try{const v=(await p.query('SHOW server_version')).rows[0].server_version;assert.match(v,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);assert.equal((await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);assert.equal((await p.query('SELECT current_user AS role')).rows[0].role,local?'pilot_runner':'postgres');console.log('Owned empty canonical game source fixture',u.pathname,v);}finally{await p.end();}process.env.DATABASE_URL=u.href;}
const artifact=JSON.parse(fs.readFileSync('omerta-contracts/out/OmertaWorkEscrowV2.sol/OmertaWorkEscrowV2.json'));
assert.deepEqual(WORK_ESCROW_ABI,artifact.abi);assert.equal(keccak256(artifact.deployedBytecode.object),WORK_ESCROW_RUNTIME_KECCAK);assert.equal(keccak256(artifact.bytecode.object),WORK_ESCROW_CREATION_KECCAK);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('omerta-contracts/src/market-v2/OmertaWorkEscrowV2.sol','utf8').replaceAll('\r\n','\n')).digest('hex'),WORK_ESCROW_SOURCE_SHA256);
const forbidden=new Proxy({}, {get(){throw Error('Missing deployment must not access provider');}});
assert.equal((await observeWorkEscrowSource(forbidden,null,forbidden,forbidden,forbidden,forbidden)).available,false);
Object.assign(process.env,{RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',INVITE_MODE:'off',DEPOT_PILOT:'on',JWT_SECRET:'funded-work-source-fixture',MARKET_SEED:'funded-work-source-fixture',MOD_KEY:'funded-work-source-fixture-mod'});
const{buildServer}=await import('./server-fixture.js'),G=await import('../src/game.js'),T=await import('../src/workertraining.js');
const app=await buildServer(),pool=app.pool;let serial=0;
const ok=async(p,method,url,payload)=>{const r=await app.inject({method,url,payload,headers:p?{authorization:'Bearer '+p.token,'idempotency-key':'funded-work-fixture-'+(++serial)}:{}});assert.equal(r.statusCode,200,r.body);return r.json();};
// Public deterministic test accounts only; no actual wallet/key/RPC is used.
const signers=[privateKeyToAccount('0x'+'11'.repeat(32)),privateKeyToAccount('0x'+'22'.repeat(32))];
async function player(signer){const p={token:(await ok(null,'POST','/v1/auth/guest')).token};await ok(p,'POST','/v1/character',{name:'Work Source '+(++serial)});p.account=app.jwt.verify(p.token).sub;p.id=(await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive',[p.account])).rows[0].id;
 const old=Number((await pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);await pool.query("UPDATE characters SET cash=10000,energy=100,loc='foundry',respect=10000 WHERE id=$1",[p.id]);await G.ledger(pool,{characterId:p.id,currency:'cash',amount:10000-old,reason:'crime:funded-work-source-fixture'});
 const challenge=await ok(p,'POST','/v1/wallet/challenge');await ok(p,'POST','/v1/wallet/verify',{address:signer.address,signature:await signer.signMessage({message:challenge.message})});
 await ok(p,'POST','/v1/resources/company',{expectedRevision:0,name:'Work Source '+serial,published:false,premises:null});p.depot=(await ok(p,'POST','/v1/depot',{salePrice:1000,bidPrice:500,targetStock:2,reorderAt:0,restockBudget:2000})).id;return p;}
const h='0x'+'1'.repeat(64),bh='0x'+'2'.repeat(64),deploymentHash='0x'+'3'.repeat(64),allocationHash='0x'+'4'.repeat(64),contract='0x'+'5'.repeat(40),id='0x'+'6'.repeat(64),zero='0x'+'0'.repeat(40);
const deployment={address:contract,chainId:'1',creationTransactionHash:deploymentHash,runtimeKeccak:WORK_ESCROW_RUNTIME_KECCAK,sourceSha256:WORK_ESCROW_SOURCE_SHA256};
let t,consent,outcome;const earnedHash='0x'+'7'.repeat(64),blockHash=n=>'0x'+n.slice(-1).repeat(64);
function rpcReader(state,asset,change=(_q,v)=>v){const calls=[];const workHash=trainingWorkHash(t),token=asset==='ETH'?zero:ETHEREUM_USDC;
 const event=(name,args,transactionHash)=>{const abi=WORK_ESCROW_ABI.find(a=>a.type==='event'&&a.name===name);const blockNumber=name==='Funded'?'0x64':name==='Allocated'?'0x65':'0x66';return{address:contract,removed:false,logIndex:'0x0',transactionHash,blockHash:blockHash(blockNumber),blockNumber,topics:encodeEventTopics({abi:WORK_ESCROW_ABI,eventName:name,args}),data:encodeAbiParameters(abi.inputs.filter(i=>!i.indexed),abi.inputs.filter(i=>!i.indexed).map(i=>args[i.name]))};};
 const fundArgs={id,funder:t.funderWallet,payee:t.payeeWallet,asset:token,amount:100n,workHash,deadline:BigInt(t.deadline),nonce:1n};
 const names=[null,'Funded','Accepted','Allocated','Settled','Refunded'],args=state===2?{id,payee:t.payeeWallet}:state===3?{id,funder:t.funderWallet,payee:t.payeeWallet,outcomeHash:outcome.outcomeHash,amount:100n}:state===4?{id,payee:t.payeeWallet,asset:token,amount:100n}:{id,funder:t.funderWallet,asset:token,amount:100n};
 return{calls,request:async q=>{calls.push(q);let v;
 if(q.method==='eth_chainId')v='0x1';else if(q.method==='eth_getBlockByNumber')v={number:q.params[0]==='finalized'?'0x67':q.params[0],hash:blockHash(q.params[0]==='finalized'?'0x67':q.params[0]),timestamp:'0x'+BigInt(t.deadline-(q.params[0]==='0x64'?180:q.params[0]==='0x63'?200:100)).toString(16)};
 else if(q.method==='eth_getCode')v=artifact.deployedBytecode.object;
 else if(q.method==='eth_getTransactionByHash')v={hash:deploymentHash,to:null,input:artifact.bytecode.object,blockHash:blockHash('0x63'),blockNumber:'0x63'};
 else if(q.method==='eth_getTransactionReceipt')v=q.params[0]===deploymentHash?{transactionHash:deploymentHash,contractAddress:contract,status:'0x1',blockNumber:'0x63',blockHash:blockHash('0x63'),logs:[]}:(()=>{const log=q.params[0]===h?event('Funded',fundArgs,h):q.params[0]===earnedHash?event('Allocated',{id,funder:t.funderWallet,payee:t.payeeWallet,outcomeHash:outcome.outcomeHash,amount:100n},earnedHash):event(names[state],args,allocationHash);return{transactionHash:q.params[0],status:'0x1',blockNumber:log.blockNumber,blockHash:log.blockHash,logs:[log]};})();
 else if(q.method==='eth_getBalance')v=state<=3?'0x64':'0x0';
 else if(q.method==='eth_call'){if(q.params[0].to===ETHEREUM_USDC)v='0x'+(state<=3?'64':'0').padStart(64,'0');else{const f=decodeFunctionData({abi:WORK_ESCROW_ABI,data:q.params[0].data});v=encodeFunctionResult({abi:WORK_ESCROW_ABI,functionName:f.functionName,result:f.functionName==='liability'?(state<=3?100n:0n):{funder:t.funderWallet,payee:t.payeeWallet,asset:token,deadline:BigInt(t.deadline),amount:100n,workHash,outcomeHash:state===3||state===4?outcome.outcomeHash:'0x'+'0'.repeat(64),state}});}}
 else throw Error('Unexpected RPC '+q.method);return change(q,v,calls.length);}};
}
const events={allocation:{transactionHash:earnedHash,logIndex:0},funding:{transactionHash:h,logIndex:0},current:{transactionHash:allocationHash,logIndex:0}};
// buildServer installs the canonical training schema; require it instead of replaying component DDL.
try{await pool.query('SELECT id FROM worker_training_courses LIMIT 0');const employer=await player(signers[0]),worker=await player(signers[1]);
 const course=await G.withCharacter(pool,employer.account,(ch,c,helpers)=>T.createWorkerTraining(ch,{depotId:employer.depot,stat:'cunning',sessions:1,wageCash:100,durationSeconds:600},'source-course',c,helpers));
 await G.withTwoCharacters(pool,worker.account,employer.id,(ch,e,c,helpers)=>T.acceptWorkerTraining(ch,e,{courseId:course.courseId,consent:true},'source-accept',c,helpers),{meet:false});
 t={amountAtoms:'100',asset:'ETH',businessId:employer.depot,courseId:course.courseId,deadline:Math.floor(Date.now()/1000)+120,funderWallet:signers[0].address.toLowerCase(),nonce:'1',ordinal:1,ownerAccount:employer.account,ownerCharacter:employer.id,payeeWallet:signers[1].address.toLowerCase(),stat:'cunning',workerAccount:worker.account,workerCharacter:worker.id};
 await assert.rejects(canonicalTrainingWorkOutcome(pool,t),e=>e.code==='funded_work_canonical_outcome_missing');
 const trained=await G.withTwoCharacters(pool,worker.account,employer.id,(ch,e,c,helpers)=>T.trainWorker(ch,e,{courseId:course.courseId},'source-train',c,helpers),{meet:false});
 outcome=await canonicalTrainingWorkOutcome(pool,t);assert.equal(outcome.wageTransaction,trained.wageTransaction);assert.equal(outcome.statAfter-outcome.statBefore,trained.canonicalTrain.gain);assert(outcome.energyAfter<outcome.energyBefore);assert.deepEqual(await T.collectWorkerTrainingIssues(pool),[]);
 for(const asset of ['ETH','USDC']){t={...t,asset};consent={funderSignature:await signers[0].signTypedData(workEscrowConsent(contract,trainingWorkHash(t),0)),payeeSignature:await signers[1].signTypedData(workEscrowConsent(contract,trainingWorkHash(t),1))};
  for(const state of [1,2,3,4,5]){const r=rpcReader(state,asset),proof=await observeWorkEscrowSource(r,deployment,t,consent,events,pool);assert.equal(proof.paidVerified,state===4);assert.equal(proof.reserveVerified,state<=3);assert.equal(proof.allocationVerified,state===3||state===4);assert.equal(proof.recoveryVerified,state===5);assert.equal(proof.financialActivation,false);assert(r.calls.length<=18);}
  const negatives=[(q,v)=>q.method==='eth_chainId'?'0x2':v,(q,v)=>q.method==='eth_getCode'?'0x6000':v,(q,v)=>q.method==='eth_getBalance'?'0x0':v,(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===h)v.status='0x0';return v;},(q,v)=>{if(q.method==='eth_getTransactionByHash')v.input='0x6000';return v;}];
  for(const mutation of negatives){if(asset==='USDC'&&mutation===negatives[2])continue;await assert.rejects(observeWorkEscrowSource(rpcReader(3,asset,mutation),deployment,t,consent,events,pool));}
  const noCalls=rpcReader(3,asset);await assert.rejects(observeWorkEscrowSource(noCalls,{...deployment,runtimeKeccak:'0x'+'9'.repeat(64)},t,consent,events,pool));assert.equal(noCalls.calls.length,0);
  await assert.rejects(observeWorkEscrowSource(rpcReader(3,asset),deployment,{...t,amountAtoms:'101'},consent,events,pool),/original_job_consent/);
  await assert.rejects(observeWorkEscrowSource(rpcReader(3,asset,(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='0x64')v.timestamp='0x'+BigInt(t.deadline).toString(16);return v;}),deployment,t,consent,events,pool),e=>e.code==='funded_work_prospective_outcome_order');
  await assert.rejects(observeWorkEscrowSource(rpcReader(3,asset,(q,v)=>q.method==='eth_getBalance'||q.method==='eth_call'&&q.params[0].to===ETHEREUM_USDC?(q.method==='eth_getBalance'?'0x0':'0x'+'0'.repeat(64)):v),deployment,t,consent,events,pool),e=>e.code==='funded_work_custody_shortfall');
  await assert.rejects(observeWorkEscrowSource(rpcReader(4,asset),deployment,t,consent,{...events,allocation:events.funding},pool),e=>e.code==='funded_work_event_kind');
  await assert.rejects(observeWorkEscrowSource(rpcReader(3,asset),deployment,t,{...consent,payeeSignature:consent.funderSignature},events,pool),/original_job_consent/);
 }
 await pool.query('UPDATE transactions SET amount=amount + 1 WHERE id=$1',[trained.wageTransaction]);await assert.rejects(canonicalTrainingWorkOutcome(pool,t),e=>e.code==='funded_work_canonical_outcome');await pool.query('UPDATE transactions SET amount=amount - 1 WHERE id=$1',[trained.wageTransaction]);
 await assert.rejects(canonicalTrainingWorkOutcome(pool,{...t,workerCharacter:employer.id}),e=>e.code==='funded_work_canonical_source');
 console.log('fundedworkescrowadapter',native?'native canonical game source':'memory canonical game source','PASS: honest offline authoritative-RPC vectors for ten ETH/USDC lifecycle states + actual canonical F11 paid train and actual JWT wallet challenge signatures; source/consent/code/creation/outcome/custody negatives. No deployed source, real funding, payment or public activation claim.');
}finally{await app.close();}

