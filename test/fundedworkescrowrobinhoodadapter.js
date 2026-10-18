import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { encodeEventTopics,encodeAbiParameters,decodeFunctionData,decodeFunctionResult,decodeEventLog,encodeFunctionResult,keccak256 } from 'viem';
import { canonicalTrainingWorkOutcome,trainingWorkHash,workEscrowConsent } from '../src/fundedworkescrowadapter.js';
import { baseWorkEscrowConsent as oldBaseConsent } from '../src/fundedworkescrowbaseadapter.js';
import { observeRobinhoodWorkEscrowSource,observeRobinhoodWorkEscrowOutcomeSource,robinhoodWorkEscrowConsent,ROBINHOOD_USDG } from '../src/fundedworkescrowrobinhoodadapter.js';
import { ROBINHOOD_WORK_ESCROW_COMPILER,ROBINHOOD_WORK_ESCROW_ABI,ROBINHOOD_WORK_ESCROW_RUNTIME_KECCAK,ROBINHOOD_WORK_ESCROW_CREATION_KECCAK,ROBINHOOD_WORK_ESCROW_SOURCE_SHA256 } from '../src/fundedworkescrowrobinhoodartifact.js';
for(const name of Object.keys(process.env))assert(!/DATABASE_URL$|^PG|^RC1|^P2_TEST|^ENTERPRISE_NATIVE_/i.test(name),'Reject ambient backend/native selector '+name);
assert.deepEqual(process.argv.slice(2),[],'This focused observer test admits memory source only');
const artifact=JSON.parse(fs.readFileSync('omerta-contracts/out/OmertaWorkEscrowRobinhood.sol/OmertaWorkEscrowRobinhood.json'));
assert.deepEqual(ROBINHOOD_WORK_ESCROW_COMPILER,{version:artifact.metadata.compiler.version,optimizerRuns:artifact.metadata.settings.optimizer.runs,viaIR:artifact.metadata.settings.viaIR,evmVersion:artifact.metadata.settings.evmVersion});
assert.deepEqual(ROBINHOOD_WORK_ESCROW_ABI,artifact.abi);assert.equal(keccak256(artifact.deployedBytecode.object),ROBINHOOD_WORK_ESCROW_RUNTIME_KECCAK);assert.equal(keccak256(artifact.bytecode.object),ROBINHOOD_WORK_ESCROW_CREATION_KECCAK);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('omerta-contracts/src/market-v2/OmertaWorkEscrowRobinhood.sol','utf8').replaceAll('\r\n','\n')).digest('hex'),ROBINHOOD_WORK_ESCROW_SOURCE_SHA256);
const forbidden=new Proxy({}, {get(){throw Error('Missing deployment must not access provider');}});
assert.equal((await observeRobinhoodWorkEscrowSource(forbidden,null,forbidden,forbidden,forbidden,forbidden)).available,false);
assert.equal((await observeRobinhoodWorkEscrowOutcomeSource(forbidden,null,forbidden,forbidden,forbidden,forbidden)).available,false);
Object.assign(process.env,{CHAIN_ENABLED:'off',RESOURCE_ECONOMY:'off',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',INVITE_MODE:'off',DEPOT_PILOT:'on',JWT_SECRET:'funded-work-source-fixture',MARKET_SEED:'funded-work-source-fixture',MOD_KEY:'funded-work-source-fixture-mod'});
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
const deployment={address:contract,chainId:'4663',creationTransactionHash:deploymentHash,runtimeKeccak:ROBINHOOD_WORK_ESCROW_RUNTIME_KECCAK,sourceSha256:ROBINHOOD_WORK_ESCROW_SOURCE_SHA256};
let t,consent,outcome;const earnedHash='0x'+'7'.repeat(64),blockHash=n=>'0x'+n.slice(-1).repeat(64);
function rpcReader(state,asset,change=(_q,v)=>v){const calls=[];const workHash=trainingWorkHash(t),token=ROBINHOOD_USDG;
 const event=(name,args,transactionHash)=>{const abi=ROBINHOOD_WORK_ESCROW_ABI.find(a=>a.type==='event'&&a.name===name);const blockNumber=name==='Funded'?'0x64':name==='Allocated'?'0x65':'0x66';return{address:contract,removed:false,logIndex:'0x0',transactionHash,blockHash:blockHash(blockNumber),blockNumber,topics:encodeEventTopics({abi:ROBINHOOD_WORK_ESCROW_ABI,eventName:name,args}),data:encodeAbiParameters(abi.inputs.filter(i=>!i.indexed),abi.inputs.filter(i=>!i.indexed).map(i=>args[i.name]))};};
 const fundArgs={id,funder:t.funderWallet,payee:t.payeeWallet,asset:token,amount:100n,workHash,deadline:BigInt(t.deadline),nonce:1n};
 const names=[null,'Funded','Accepted','Allocated','Settled','Refunded'],args=state===2?{id,payee:t.payeeWallet}:state===3?{id,funder:t.funderWallet,payee:t.payeeWallet,outcomeHash:outcome.outcomeHash,amount:100n}:state===4?{id,payee:t.payeeWallet,asset:token,amount:100n}:{id,funder:t.funderWallet,asset:token,amount:100n};
 return{calls,request:async q=>{calls.push(q);let v;
 if(q.method==='eth_chainId')v='0x1237';else if(q.method==='eth_getBlockByNumber')v={number:q.params[0]==='finalized'?'0x67':q.params[0],hash:blockHash(q.params[0]==='finalized'?'0x67':q.params[0]),timestamp:'0x'+BigInt(t.deadline-(q.params[0]==='0x64'?180:q.params[0]==='0x63'?200:100)).toString(16)};
 else if(q.method==='eth_getCode')v=artifact.deployedBytecode.object;
 else if(q.method==='eth_getTransactionByHash')v={hash:deploymentHash,to:null,input:artifact.bytecode.object,blockHash:blockHash('0x63'),blockNumber:'0x63'};
 else if(q.method==='eth_getTransactionReceipt')v=q.params[0]===deploymentHash?{transactionHash:deploymentHash,contractAddress:contract,status:'0x1',blockNumber:'0x63',blockHash:blockHash('0x63'),logs:[]}:(()=>{const log=q.params[0]===h?event('Funded',fundArgs,h):q.params[0]===earnedHash?event('Allocated',{id,funder:t.funderWallet,payee:t.payeeWallet,outcomeHash:outcome.outcomeHash,amount:100n},earnedHash):event(names[state],args,allocationHash);return{transactionHash:q.params[0],status:'0x1',blockNumber:log.blockNumber,blockHash:log.blockHash,logs:[log]};})();
 else if(q.method==='eth_call'){if(q.params[0].to===ROBINHOOD_USDG)v='0x'+(state<=3?'64':'0').padStart(64,'0');else{const f=decodeFunctionData({abi:ROBINHOOD_WORK_ESCROW_ABI,data:q.params[0].data});v=encodeFunctionResult({abi:ROBINHOOD_WORK_ESCROW_ABI,functionName:f.functionName,result:f.functionName==='liability'?(state<=3?100n:0n):{funder:t.funderWallet,payee:t.payeeWallet,asset:token,deadline:BigInt(t.deadline),amount:100n,workHash,outcomeHash:state===3||state===4?outcome.outcomeHash:'0x'+'0'.repeat(64),state}});}}
 else throw Error('Unexpected RPC '+q.method);return change(q,v,calls.length);}};
}
let extraRefusals=0;
let outcomeChecks=0,outcomeRefusals=0;
const events={allocation:{transactionHash:earnedHash,logIndex:0},funding:{transactionHash:h,logIndex:0},current:{transactionHash:allocationHash,logIndex:0}};
const outcomeEvents={funding:events.funding,acceptance:events.current};
function preallocationReader(asset,change=(_q,v)=>v,state=2){
 const completed=Math.floor(+new Date(outcome.trainedAt)/1000);
 return rpcReader(state,asset,(q,v,calls)=>{
  if(q.method==='eth_getBlockByNumber')v.timestamp='0x'+BigInt(completed-(q.params[0]==='0x63'?10:q.params[0]==='0x64'?5:q.params[0]==='0x66'?1:0)).toString(16);
  if(q.method==='eth_getTransactionReceipt'&&q.params[0]!==deploymentHash){v.transactionIndex='0x0';for(const log of v.logs)log.transactionIndex='0x0';}
  return change(q,v,calls);
 });
}
// buildServer installs the canonical training schema; require it instead of replaying component DDL.
try{await pool.query('SELECT id FROM worker_training_courses LIMIT 0');const employer=await player(signers[0]),worker=await player(signers[1]);
 const course=await G.withCharacter(pool,employer.account,(ch,c,helpers)=>T.createWorkerTraining(ch,{depotId:employer.depot,stat:'cunning',sessions:1,wageCash:100,durationSeconds:600},'source-course',c,helpers));
 await G.withTwoCharacters(pool,worker.account,employer.id,(ch,e,c,helpers)=>T.acceptWorkerTraining(ch,e,{courseId:course.courseId,consent:true},'source-accept',c,helpers),{meet:false});
 t={amountAtoms:'100',asset:'USDG',businessId:employer.depot,courseId:course.courseId,deadline:Math.floor(Date.now()/1000)+120,funderWallet:signers[0].address.toLowerCase(),nonce:'1',ordinal:1,ownerAccount:employer.account,ownerCharacter:employer.id,payeeWallet:signers[1].address.toLowerCase(),stat:'cunning',workerAccount:worker.account,workerCharacter:worker.id};
 await assert.rejects(canonicalTrainingWorkOutcome(pool,t),e=>e.code==='funded_work_canonical_outcome_missing');
 const trained=await G.withTwoCharacters(pool,worker.account,employer.id,(ch,e,c,helpers)=>T.trainWorker(ch,e,{courseId:course.courseId},'source-train',c,helpers),{meet:false});
 outcome=await canonicalTrainingWorkOutcome(pool,t);assert.equal(outcome.wageTransaction,trained.wageTransaction);assert.equal(outcome.statAfter-outcome.statBefore,trained.canonicalTrain.gain);assert(outcome.energyAfter<outcome.energyBefore);assert.deepEqual(await T.collectWorkerTrainingIssues(pool),[]);
 for(const asset of ['USDG']){t={...t,asset};consent={funderSignature:await signers[0].signTypedData(robinhoodWorkEscrowConsent(contract,trainingWorkHash(t),0)),payeeSignature:await signers[1].signTypedData(robinhoodWorkEscrowConsent(contract,trainingWorkHash(t),1))};
  for(const state of [1,2,3,4,5]){const r=rpcReader(state,asset),proof=await observeRobinhoodWorkEscrowSource(r,deployment,t,consent,events,pool);assert.equal(proof.paidVerified,state===4);assert.equal(proof.reserveVerified,state<=3);assert.equal(proof.allocationVerified,state===3||state===4);assert.equal(proof.recoveryVerified,state===5);assert.equal(proof.financialActivation,false);assert.equal(proof.executableWorkGrant,false);assert.equal(proof.reserveMeaning,'custody_at_finalized_block_only');assert.equal(proof.chainId,'4663');assert(r.calls.length<=18);}
  const negatives=[(q,v)=>q.method==='eth_chainId'?'0x2':v,(q,v)=>q.method==='eth_getCode'?'0x6000':v,(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===h)v.status='0x0';return v;},(q,v)=>{if(q.method==='eth_getTransactionByHash')v.input='0x6000';return v;}];
  for(const mutation of negatives){await assert.rejects(observeRobinhoodWorkEscrowSource(rpcReader(3,asset,mutation),deployment,t,consent,events,pool));}
  for(const rejectedAsset of ['ETH','USDC','HOOD','usdg']){const reader=rpcReader(3,asset);await assert.rejects(observeRobinhoodWorkEscrowSource(reader,deployment,{...t,asset:rejectedAsset},consent,events,forbidden),e=>e.code==='funded_work_terms');assert.equal(reader.calls.length,0);}
  const noCalls=rpcReader(3,asset);await assert.rejects(observeRobinhoodWorkEscrowSource(noCalls,{...deployment,runtimeKeccak:'0x'+'9'.repeat(64)},t,consent,events,pool));assert.equal(noCalls.calls.length,0);
  await assert.rejects(observeRobinhoodWorkEscrowSource(rpcReader(3,asset),deployment,{...t,amountAtoms:'101'},consent,events,pool),/original_job_consent/);
  await assert.rejects(observeRobinhoodWorkEscrowSource(rpcReader(3,asset,(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='0x64')v.timestamp='0x'+BigInt(t.deadline).toString(16);return v;}),deployment,t,consent,events,pool),e=>e.code==='funded_work_prospective_outcome_order');
  await assert.rejects(observeRobinhoodWorkEscrowSource(rpcReader(3,asset,(q,v)=>q.method==='eth_call'&&q.params[0].to===ROBINHOOD_USDG?'0x'+'0'.repeat(64):v),deployment,t,consent,events,pool),e=>e.code==='funded_work_custody_shortfall');
  await assert.rejects(observeRobinhoodWorkEscrowSource(rpcReader(4,asset),deployment,t,consent,{...events,allocation:events.funding},pool),e=>e.code==='funded_work_event_kind');
  const replaceLog=(receipt,name,patch)=>{const log=receipt.logs[0],abi=ROBINHOOD_WORK_ESCROW_ABI.find(a=>a.type==='event'&&a.name===name),decoded=decodeEventLog({abi:ROBINHOOD_WORK_ESCROW_ABI,data:log.data,topics:log.topics,strict:true}),args={...decoded.args,...patch};log.topics=encodeEventTopics({abi:ROBINHOOD_WORK_ESCROW_ABI,eventName:name,args});log.data=encodeAbiParameters(abi.inputs.filter(i=>!i.indexed),abi.inputs.filter(i=>!i.indexed).map(i=>args[i.name]));return receipt;};
  const patchWork=(q,value,patch)=>{if(q.method!=='eth_call'||q.params[0].to!==contract)return value;const call=decodeFunctionData({abi:ROBINHOOD_WORK_ESCROW_ABI,data:q.params[0].data});if(call.functionName!=='work')return value;const w=decodeFunctionResult({abi:ROBINHOOD_WORK_ESCROW_ABI,functionName:'work',data:value});return encodeFunctionResult({abi:ROBINHOOD_WORK_ESCROW_ABI,functionName:'work',result:{...w,...patch}});};
  const fundReceipt=(q,value,patch)=>q.method==='eth_getTransactionReceipt'&&q.params[0]===h?replaceLog(value,'Funded',patch):value;
  const allocateReceipt=(q,value,patch)=>q.method==='eth_getTransactionReceipt'&&q.params[0]===allocationHash?replaceLog(value,'Allocated',patch):value;
  let chainReads=0;
  const extraVectors=[
   ['Ethereum chain',q=>q.method==='eth_chainId'?'0x1':undefined],
   ['Base testnet chain',q=>q.method==='eth_chainId'?'0x14a34':undefined],
   ['missing finalized head',(q,v)=>q.method==='eth_getBlockByNumber'&&q.params[0]==='finalized'?null:v],
   ['zero finalized hash',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='finalized')v.hash='0x'+'0'.repeat(64);return v;}],
   ['noncanonical finalized quantity',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='finalized')v.number='0x00';return v;}],
   ['Base mainnet chain',q=>q.method==='eth_chainId'?'0x2105':undefined],
   ['funding not finalized',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===h)v.blockNumber='0x68';return v;}],
   ['funding reverted',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===h)v.status='0x0';return v;}],
   ['funding canonical reorg',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='0x64')v.hash='0x'+'9'.repeat(64);return v;}],
   ['removed funding log',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===h)v.logs[0].removed=true;return v;}],
   ['foreign contract log',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===h)v.logs[0].address='0x'+'9'.repeat(40);return v;}],
   ['duplicate funding log index',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===h)v.logs.push({...v.logs[0]});return v;}],
   ['foreign funding wallet',(q,v)=>fundReceipt(q,v,{funder:'0x'+'9'.repeat(40)})],
   ['wrong-chain token',(q,v)=>fundReceipt(q,v,{asset:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'})],
   ['foreign funding nonce',(q,v)=>fundReceipt(q,v,{nonce:2n})],
   ['foreign creation address',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===deploymentHash)v.contractAddress='0x'+'9'.repeat(40);return v;}],
   ['Base USDC funding asset',(q,v)=>fundReceipt(q,v,{asset:'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'})],
   ['factory deployment forbidden',(q,v)=>{if(q.method==='eth_getTransactionByHash')v.to='0x'+'9'.repeat(40);return v;}],
   ['creation canonical reorg',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='0x63')v.hash='0x'+'9'.repeat(64);return v;}],
   ['chain changes at final recheck',(q,v)=>q.method==='eth_chainId'&&++chainReads===2?'0x1':v],
   ['finalized snapshot changes',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='0x67')v.hash='0x'+'9'.repeat(64);return v;}],
   ['state amount differs',(q,v)=>patchWork(q,v,{amount:101n})],
   ['unknown work state',(q,v)=>patchWork(q,v,{state:0})],
   ['missing liability',(q,v)=>q.method==='eth_call'&&q.params[0].to===contract&&decodeFunctionData({abi:ROBINHOOD_WORK_ESCROW_ABI,data:q.params[0].data}).functionName==='liability'?'0x'+'0'.repeat(64):v],
   ['custody missing',(q,v)=>q.method==='eth_call'&&q.params[0].to===ROBINHOOD_USDG?'0x'+'0'.repeat(64):v],
   ['allocation different work',(q,v)=>allocateReceipt(q,v,{id:'0x'+'9'.repeat(64)})],
   ['allocation different outcome',(q,v)=>allocateReceipt(q,v,{outcomeHash:'0x'+'9'.repeat(64)})],
   ['allocation different amount',(q,v)=>allocateReceipt(q,v,{amount:101n})],
   ['current event before funding',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===allocationHash){v.blockNumber='0x63';v.blockHash=blockHash('0x63');v.logs[0].blockNumber='0x63';v.logs[0].blockHash=blockHash('0x63');}return v;}],
   ['funding different work hash',(q,v)=>fundReceipt(q,v,{workHash:'0x'+'9'.repeat(64)})],
   ['unbounded funding logs',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===h)v.logs=Array(257).fill(v.logs[0]);return v;}],
   ['receipt different transaction',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===h)v.transactionHash='0x'+'9'.repeat(64);return v;}]
  ];
  for(const[name,mutate]of extraVectors){const reader=rpcReader(3,asset,(q,v,i)=>{const next=mutate(q,v,i);return next===undefined?v:next;});await assert.rejects(observeRobinhoodWorkEscrowSource(reader,deployment,t,consent,events,pool),undefined,name);extraRefusals++;}
  const oldDeployment=rpcReader(3,asset);await assert.rejects(observeRobinhoodWorkEscrowSource(oldDeployment,{...deployment,chainId:'1'},t,consent,events,pool),e=>e.code==='funded_work_deployment_unreviewed');assert.equal(oldDeployment.calls.length,0);extraRefusals++;
  const wrongBase={funderSignature:await signers[0].signTypedData(oldBaseConsent(contract,trainingWorkHash(t),0)),payeeSignature:await signers[1].signTypedData(oldBaseConsent(contract,trainingWorkHash(t),1))},wrongBaseReader=rpcReader(3,asset);await assert.rejects(observeRobinhoodWorkEscrowSource(wrongBaseReader,deployment,t,wrongBase,events,pool),e=>e.code==='funded_work_original_job_consent');assert.equal(wrongBaseReader.calls.length,0);
  const oldDomain={funderSignature:await signers[0].signTypedData(workEscrowConsent(contract,trainingWorkHash(t),0)),payeeSignature:await signers[1].signTypedData(workEscrowConsent(contract,trainingWorkHash(t),1))},oldDomainReader=rpcReader(3,asset);await assert.rejects(observeRobinhoodWorkEscrowSource(oldDomainReader,deployment,t,oldDomain,events,pool),e=>e.code==='funded_work_original_job_consent');assert.equal(oldDomainReader.calls.length,0);extraRefusals++;
  const pinned=rpcReader(3,asset);const pinnedProof=await observeRobinhoodWorkEscrowSource(pinned,deployment,t,consent,events,pool);assert.equal(pinnedProof.executableWorkGrant,false);for(const q of pinned.calls){assert(!q.method.startsWith('eth_send'));if(['eth_getCode','eth_getBalance','eth_call'].includes(q.method))assert.deepEqual(q.params[1],{blockHash:blockHash('0x67'),requireCanonical:true});}

  const beforeRows=(await pool.query('SELECT course_id,ordinal,wage_transaction,trained_at FROM worker_training_sessions ORDER BY course_id,ordinal')).rows;
  const read=preallocationReader(asset),earned=await observeRobinhoodWorkEscrowOutcomeSource(read,deployment,t,consent,outcomeEvents,pool);
  assert.equal(earned.outcome.canonicalOutcomeHash,outcome.outcomeHash);assert.equal(earned.outcome.trainedAt,outcome.trainedAt);assert.equal(earned.outcome.courseId,t.courseId);assert.equal(earned.outcome.ordinal,1);assert.equal(earned.outcome.ordering,'acceptance_before_recorded_completion');assert.equal(earned.outcome.acceptance.transactionHash,outcomeEvents.acceptance.transactionHash);assert.equal(earned.outcome.acceptance.blockNumber,'102');assert(+new Date(earned.outcome.acceptance.acceptedAt)<+new Date(earned.outcome.trainedAt));
  assert.equal(earned.observation.state,'Accepted');assert.equal(earned.observation.canonicalOutcomeHash,null);assert.equal(earned.observation.paidVerified,false);assert.equal(earned.financialActivation,false);assert.equal(earned.executableWorkGrant,false);assert.equal(earned.observationOnly,true);assert(Object.isFrozen(earned)&&Object.isFrozen(earned.outcome)&&Object.isFrozen(earned.outcome.acceptance));assert(!read.calls.some(q=>q.method.startsWith('eth_send')||q.method==='eth_getTransactionReceipt'&&q.params[0]===earnedHash));
  for(const q of read.calls)if(['eth_getCode','eth_getBalance','eth_call'].includes(q.method))assert.deepEqual(q.params[1],{blockHash:blockHash('0x67'),requireCanonical:true});
  const repeated=await observeRobinhoodWorkEscrowOutcomeSource(preallocationReader(asset),deployment,t,consent,outcomeEvents,pool);assert.deepEqual(repeated,earned);assert.deepEqual((await pool.query('SELECT course_id,ordinal,wage_transaction,trained_at FROM worker_training_sessions ORDER BY course_id,ordinal')).rows,beforeRows);outcomeChecks++;
  const legacyAccepted=await observeRobinhoodWorkEscrowSource(preallocationReader(asset),deployment,t,consent,{...events,allocation:null},pool);assert.equal(legacyAccepted.canonicalOutcomeHash,null);assert.equal(legacyAccepted.state,'Accepted');outcomeChecks++;
  const sameBlockEvents={...outcomeEvents,acceptance:{...outcomeEvents.acceptance,logIndex:1}},sameBlockReader=preallocationReader(asset,(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===allocationHash){v.blockNumber='0x64';v.blockHash=blockHash('0x64');v.transactionIndex='0x1';Object.assign(v.logs[0],{blockNumber:'0x64',blockHash:blockHash('0x64'),transactionIndex:'0x1',logIndex:'0x1'});}return v;});assert.equal((await observeRobinhoodWorkEscrowOutcomeSource(sameBlockReader,deployment,t,consent,sameBlockEvents,pool)).outcome.acceptance.transactionIndex,'1');outcomeChecks++;
  const outcomeVectors=[
   ['missing exact receipt index',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===allocationHash)delete v.transactionIndex;return v;}],
   ['inconsistent accepted log index',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===allocationHash)v.logs[0].transactionIndex='0x1';return v;}],
   ['acceptance before funding',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='0x66')v.timestamp='0x'+BigInt(Math.floor(+new Date(outcome.trainedAt)/1000)-6).toString(16);return v;}],
   ['no ceil promotion of completion',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='0x66')v.timestamp='0x'+BigInt(Math.ceil(+new Date(outcome.trainedAt)/1000)).toString(16);return v;}],
   ['same-block log precedes funding',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===allocationHash){v.blockNumber='0x64';v.blockHash=blockHash('0x64');v.logs[0].blockNumber='0x64';v.logs[0].blockHash=blockHash('0x64');}return v;}],
   ['final reorg',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='0x67')v.hash='0x'+'9'.repeat(64);return v;}],
   ['second chain disagreement',(q,v,calls)=>q.method==='eth_chainId'&&calls>1?'0x1':v],
   ['creation input mismatch',(q,v)=>{if(q.method==='eth_getTransactionByHash')v.input='0x6000';return v;}],
   ['runtime mismatch',(q,v)=>q.method==='eth_getCode'?'0x6000':v],
   ['accepted event not finalized',(q,v)=>{if(q.method==='eth_getTransactionReceipt'&&q.params[0]===allocationHash)v.blockNumber='0x68';return v;}],
   ['custody shortfall',(q,v)=>q.method==='eth_getBalance'?'0x0':q.method==='eth_call'&&q.params[0].to===ROBINHOOD_USDG?'0x'+'0'.repeat(64):v]
  ];
  for(const[name,mutate]of outcomeVectors){await assert.rejects(observeRobinhoodWorkEscrowOutcomeSource(preallocationReader(asset,mutate),deployment,t,consent,outcomeEvents,pool),undefined,name);outcomeRefusals++;}
  for(const state of[1,3,4,5]){await assert.rejects(observeRobinhoodWorkEscrowOutcomeSource(preallocationReader(asset,undefined,state),deployment,t,consent,outcomeEvents,pool),e=>e.code==='funded_work_accepted_outcome_state');outcomeRefusals++;}
  for(const refs of[{...outcomeEvents,allocation:events.allocation},{...outcomeEvents,acceptance:events.funding},{...outcomeEvents,acceptance:null}]){await assert.rejects(observeRobinhoodWorkEscrowOutcomeSource(preallocationReader(asset),deployment,t,consent,refs,pool));outcomeRefusals++;}
  await assert.rejects(observeRobinhoodWorkEscrowOutcomeSource(preallocationReader(asset),deployment,t,{...consent,payeeSignature:consent.funderSignature},outcomeEvents,pool));outcomeRefusals++;
  const savedTerms=t;t={...t,ordinal:2};const missingConsent={funderSignature:await signers[0].signTypedData(robinhoodWorkEscrowConsent(contract,trainingWorkHash(t),0)),payeeSignature:await signers[1].signTypedData(robinhoodWorkEscrowConsent(contract,trainingWorkHash(t),1))};await assert.rejects(observeRobinhoodWorkEscrowOutcomeSource(preallocationReader(asset),deployment,t,missingConsent,outcomeEvents,pool),e=>e.code==='funded_work_canonical_outcome_missing');t=savedTerms;outcomeRefusals++;
  t={...t,deadline:Math.floor(+new Date(outcome.trainedAt)/1000)};const expiredConsent={funderSignature:await signers[0].signTypedData(robinhoodWorkEscrowConsent(contract,trainingWorkHash(t),0)),payeeSignature:await signers[1].signTypedData(robinhoodWorkEscrowConsent(contract,trainingWorkHash(t),1))};await assert.rejects(observeRobinhoodWorkEscrowOutcomeSource(preallocationReader(asset),deployment,t,expiredConsent,outcomeEvents,pool),e=>e.code==='funded_work_accepted_completion_order');t=savedTerms;outcomeRefusals++;

  await assert.rejects(observeRobinhoodWorkEscrowSource(rpcReader(3,asset),deployment,t,{...consent,payeeSignature:consent.funderSignature},events,pool),/original_job_consent/);
 }
 await pool.query('UPDATE transactions SET amount=amount + 1 WHERE id=$1',[trained.wageTransaction]);await assert.rejects(canonicalTrainingWorkOutcome(pool,t),e=>e.code==='funded_work_canonical_outcome');await assert.rejects(observeRobinhoodWorkEscrowOutcomeSource(preallocationReader(t.asset),deployment,t,consent,outcomeEvents,pool),e=>e.code==='funded_work_canonical_outcome');outcomeRefusals++;await pool.query('UPDATE transactions SET amount=amount - 1 WHERE id=$1',[trained.wageTransaction]);
 await assert.rejects(canonicalTrainingWorkOutcome(pool,{...t,workerCharacter:employer.id}),e=>e.code==='funded_work_canonical_source');
 assert.equal(extraRefusals,34);
 console.log('robinhood observer extra refused vectors',JSON.stringify({extraRefusals,unsupportedAssets:4,BaseDomain:1}));
 console.log('robinhood preallocation outcome',JSON.stringify({checks:outcomeChecks,refusals:outcomeRefusals,ordering:'acceptance_before_recorded_completion',sessionStartProof:false,allocationRequired:false,gameWritesByObserver:0,financialActivation:false,executableWorkGrant:false}));
 console.log('fundedworkescrowrobinhoodadapter','memory canonical game source','PASS: honest offline authoritative-RPC vectors for five USDG lifecycle states + actual canonical F11 paid train and actual JWT wallet challenge signatures; source/consent/code/creation/outcome/custody negatives. No deployed source, real funding, payment or public activation claim.');
}finally{await app.close();}
