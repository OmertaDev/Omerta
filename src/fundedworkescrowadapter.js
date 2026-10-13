import crypto from 'node:crypto';
import { encodeFunctionData, decodeFunctionResult, decodeEventLog, keccak256, verifyTypedData } from 'viem';
import { ETHEREUM_USDC, FUNDED_WORK_ADAPTER_STATUS } from './fundedworkchainobservations.js';
import { WORK_ESCROW_ABI, WORK_ESCROW_RUNTIME_KECCAK, WORK_ESCROW_CREATION_KECCAK, WORK_ESCROW_SOURCE_SHA256 } from './fundedworkescrowartifact.js';
import { withItemRead } from './items.js';

const zero='0x'+'0'.repeat(40),hash=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/.test(v)&&v!=='0x'+'0'.repeat(64);
const addr=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/.test(v)&&v!==zero;
const fail=r=>{const e=new Error(r);e.code='funded_work_'+r;throw e;};
const equal=(a,b,r)=>{if(a!==b)fail(r);};
const uint=v=>{if(typeof v!=='string'||!/^[1-9][0-9]{0,77}$/.test(v)||BigInt(v)>=2n**256n)fail('integer');return BigInt(v);};
const quantity=v=>{if(typeof v!=='string'||!/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(v)||v.length>66)fail('rpc_quantity');return BigInt(v);};
const lower=v=>{if(typeof v!=='string')fail('rpc_identity');return v.toLowerCase();};
const exact=(o,keys)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join(',')!==keys)fail('terms');};
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const trainingWorkHash=terms=>'0x'+crypto.createHash('sha256').update(canonical(terms)).digest('hex');
export function workEscrowConsent(escrowAddress,workHash,role){return{domain:{name:'OmertaWorkEscrowV2',version:'1',chainId:1,verifyingContract:escrowAddress},types:{WorkConsent:[{name:'workHash',type:'bytes32'},{name:'role',type:'uint8'}]},primaryType:'WorkConsent',message:{workHash,role}};}
export async function canonicalTrainingWorkOutcome(client,t){
 return withItemRead(client,async client=>{
 const rows=(await client.query('SELECT c.id,c.depot_id,c.employer_account,c.employer_character,c.apprentice_account,c.apprentice_character,c.stat,c.wage_cash,c.total_cash,c.reserve_transaction,s.ordinal,s.stat AS session_stat,s.apprentice_character AS session_worker,s.stat_before,s.stat_after,s.energy_before,s.energy_after,s.canonical_result,s.wage_transaction,s.trained_at,s.next_train_at,w.character_id AS wage_character,w.account_id AS wage_account,wc.account_id AS wage_original_account,rc.account_id AS reserve_original_account,w.currency AS wage_currency,w.amount AS wage_amount,w.reason AS wage_reason,w.counterparty AS wage_course,r.character_id AS reserve_character,r.currency AS reserve_currency,r.amount AS reserve_amount,r.reason AS reserve_reason,r.counterparty AS reserve_course FROM worker_training_courses c JOIN worker_training_sessions s ON s.course_id=c.id JOIN transactions w ON w.id=s.wage_transaction JOIN transactions r ON r.id=c.reserve_transaction JOIN characters wc ON wc.id=w.character_id JOIN characters rc ON rc.id=r.character_id WHERE c.id=$1 AND s.ordinal=$2 LIMIT 2',[t.courseId,t.ordinal])).rows;
 if(rows.length!==1)fail('canonical_outcome_missing');const r=rows[0];
 for(const[a,b]of [[r.depot_id,t.businessId],[r.employer_account,t.ownerAccount],[r.employer_character,t.ownerCharacter],[r.apprentice_account,t.workerAccount],[r.apprentice_character,t.workerCharacter],[r.session_worker,t.workerCharacter],[r.stat,t.stat],[r.session_stat,t.stat],[r.wage_character,t.workerCharacter],[r.wage_original_account,t.workerAccount],[r.reserve_original_account,t.ownerAccount],[r.wage_currency,'cash'],[r.wage_reason,'worker_training:wage'],[r.wage_course,t.courseId],[r.reserve_character,t.ownerCharacter],[r.reserve_currency,'cash'],[r.reserve_reason,'worker_training:reserve'],[r.reserve_course,t.courseId]])equal(a,b,'canonical_source');
 if(r.wage_account!==null&&r.wage_account!==t.workerAccount)fail('canonical_source');
 const numbers=[r.stat_before,r.stat_after,r.energy_before,r.energy_after,r.wage_cash,r.wage_amount,r.total_cash,r.reserve_amount].map(Number);
 if(!numbers.every(Number.isSafeInteger)||Number(r.stat_after)<=Number(r.stat_before)||Number(r.energy_after)>=Number(r.energy_before)||Number(r.wage_amount)!==Number(r.wage_cash)||Number(r.reserve_amount)!==-Number(r.total_cash)
   ||r.canonical_result?.ok!==true||r.canonical_result.stat!==t.stat||Number(r.canonical_result.gain)!==Number(r.stat_after)-Number(r.stat_before))fail('canonical_outcome');
 const trainedAt=new Date(r.trained_at),nextAt=new Date(r.next_train_at);if(!Number.isFinite(+trainedAt)||!Number.isFinite(+nextAt)||+nextAt<+trainedAt)fail('canonical_clock');
 const proof={kind:'worker_training_session',courseId:t.courseId,ordinal:t.ordinal,ownerAccount:t.ownerAccount,ownerCharacter:t.ownerCharacter,workerAccount:t.workerAccount,workerCharacter:t.workerCharacter,businessId:t.businessId,stat:t.stat,statBefore:Number(r.stat_before),statAfter:Number(r.stat_after),energyBefore:Number(r.energy_before),energyAfter:Number(r.energy_after),wageTransaction:r.wage_transaction,reserveTransaction:r.reserve_transaction,wageCash:Number(r.wage_amount),trainedAt:trainedAt.toISOString(),nextTrainAt:nextAt.toISOString()};
 return Object.freeze({...proof,outcomeHash:trainingWorkHash(proof),gameplayProofIsNotCryptoFunding:true});
 });
}
// Internal source reader only. Missing approved deployment cannot be made available by a flag.
export async function observeWorkEscrowSource(client,deployment,t,consent,events,gameClient){
 if(deployment===null||deployment===undefined)return FUNDED_WORK_ADAPTER_STATUS;
 exact(deployment,'address,chainId,creationTransactionHash,runtimeKeccak,sourceSha256');
 if(deployment.chainId!=='1'||!addr(deployment.address)||!hash(deployment.creationTransactionHash)||deployment.runtimeKeccak!==WORK_ESCROW_RUNTIME_KECCAK||deployment.sourceSha256!==WORK_ESCROW_SOURCE_SHA256)fail('deployment_unreviewed');
 exact(t,'amountAtoms,asset,businessId,courseId,deadline,funderWallet,nonce,ordinal,ownerAccount,ownerCharacter,payeeWallet,stat,workerAccount,workerCharacter');
 if(!['ETH','USDC'].includes(t.asset)||!addr(t.funderWallet)||!addr(t.payeeWallet)||t.funderWallet===t.payeeWallet||t.ownerAccount===t.workerAccount||!['muscle','cunning','speed'].includes(t.stat)||!Number.isSafeInteger(t.ordinal)||t.ordinal<1||t.ordinal>8||!Number.isSafeInteger(t.deadline)||t.deadline<=0)fail('terms');
 uint(t.amountAtoms);uint(t.nonce);for(const id of[t.businessId,t.courseId,t.ownerAccount,t.ownerCharacter,t.workerAccount,t.workerCharacter])if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id))fail('identity');
 exact(consent,'funderSignature,payeeSignature');const workHash=trainingWorkHash(t);
 for(const[wallet,signature,role]of[[t.funderWallet,consent.funderSignature,0],[t.payeeWallet,consent.payeeSignature,1]]){
  let valid=false;try{valid=await verifyTypedData({address:wallet,...workEscrowConsent(deployment.address,workHash,role),signature});}catch{}if(!valid)fail('original_job_consent');
 }
 if(!gameClient||typeof gameClient.query!=='function')fail('canonical_game_source_missing');
 return withItemRead(gameClient,async gameClient=>{
 const linked=(await gameClient.query('SELECT c.depot_id,c.employer_account,c.employer_character,c.apprentice_account,c.apprentice_character,c.stat,e.wallet_address AS funder_wallet,w.wallet_address AS payee_wallet FROM worker_training_courses c JOIN account_persistent e ON e.account_id=c.employer_account JOIN account_persistent w ON w.account_id=c.apprentice_account WHERE c.id=$1 LIMIT 2',[t.courseId])).rows;
 if(linked.length!==1)fail('canonical_course');const link=linked[0];for(const[a,b]of[[link.depot_id,t.businessId],[link.employer_account,t.ownerAccount],[link.employer_character,t.ownerCharacter],[link.apprentice_account,t.workerAccount],[link.apprentice_character,t.workerCharacter],[link.stat,t.stat],[link.funder_wallet?.toLowerCase(),t.funderWallet],[link.payee_wallet?.toLowerCase(),t.payeeWallet]])equal(a,b,'original_game_wallet_binding');
 if(!client||typeof client.request!=='function')fail('reader');const rpc=(method,params)=>client.request({method,params});
 equal(await rpc('eth_chainId',[]),'0x1','chain');const finalized=await rpc('eth_getBlockByNumber',['finalized',false]);
 if(!finalized||!hash(lower(finalized.hash)))fail('finalized');const finalNumber=quantity(finalized.number),at={blockHash:lower(finalized.hash),requireCanonical:true};
 const code=await rpc('eth_getCode',[deployment.address,at]);equal(keccak256(code),WORK_ESCROW_RUNTIME_KECCAK,'runtime');
 async function receiptEvent(reference,name){
  exact(reference,'logIndex,transactionHash');if(!hash(reference.transactionHash)||!Number.isSafeInteger(reference.logIndex)||reference.logIndex<0||reference.logIndex>100000)fail('event_reference');
  const receipt=await rpc('eth_getTransactionReceipt',[reference.transactionHash]);if(!receipt||receipt.status!=='0x1'||!Array.isArray(receipt.logs)||receipt.logs.length>256||lower(receipt.transactionHash)!==reference.transactionHash||!hash(lower(receipt.blockHash))||quantity(receipt.blockNumber)>finalNumber)fail('event_receipt');
  const block=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);equal(lower(block.hash),lower(receipt.blockHash),'reorg');equal(block.number,receipt.blockNumber,'block');
  const matches=receipt.logs.filter(l=>quantity(l.logIndex)===BigInt(reference.logIndex));if(matches.length!==1)fail('event_count');const log=matches[0];if(log.removed!==false||lower(log.address)!==deployment.address||lower(log.blockHash)!==lower(receipt.blockHash)||lower(log.transactionHash)!==reference.transactionHash||log.blockNumber!==receipt.blockNumber)fail('event_source');
  let decoded;try{decoded=decodeEventLog({abi:WORK_ESCROW_ABI,data:log.data,topics:log.topics,strict:true});}catch{fail('event_abi');}if(decoded.eventName!==name)fail('event_kind');return{args:decoded.args,blockNumber:quantity(receipt.blockNumber),timestamp:quantity(block.timestamp)};
 }
 const creation=await rpc('eth_getTransactionReceipt',[deployment.creationTransactionHash]);if(!creation||creation.status!=='0x1'||lower(creation.transactionHash)!==deployment.creationTransactionHash||lower(creation.contractAddress)!==deployment.address||quantity(creation.blockNumber)>finalNumber)fail('creation');
 const creationBlock=await rpc('eth_getBlockByNumber',[creation.blockNumber,false]);equal(lower(creationBlock.hash),lower(creation.blockHash),'creation_reorg');
 const creationTx=await rpc('eth_getTransactionByHash',[deployment.creationTransactionHash]);if(!creationTx||creationTx.to!==null||lower(creationTx.hash)!==deployment.creationTransactionHash||lower(creationTx.blockHash)!==lower(creation.blockHash)||creationTx.blockNumber!==creation.blockNumber||keccak256(creationTx.input)!==WORK_ESCROW_CREATION_KECCAK)fail('creation_bytecode');
 exact(events,'allocation,current,funding');const funding=await receiptEvent(events.funding,'Funded'),f=funding.args;
 if(funding.blockNumber<quantity(creation.blockNumber))fail('deployment_order');
 const asset=t.asset==='ETH'?zero:ETHEREUM_USDC;
 for(const[a,b]of[[lower(f.funder),t.funderWallet],[lower(f.payee),t.payeeWallet],[lower(f.asset),asset],[f.amount.toString(),t.amountAtoms],[lower(f.workHash),workHash],[Number(f.deadline),t.deadline],[f.nonce.toString(),t.nonce]])equal(a,b,'funding_terms');
 const read=async(name,args=[])=>decodeFunctionResult({abi:WORK_ESCROW_ABI,functionName:name,data:await rpc('eth_call',[{to:deployment.address,data:encodeFunctionData({abi:WORK_ESCROW_ABI,functionName:name,args})},at])});
 const w=await read('work',[f.id]);for(const[a,b]of[[lower(w.funder),t.funderWallet],[lower(w.payee),t.payeeWallet],[lower(w.asset),asset],[w.amount.toString(),t.amountAtoms],[lower(w.workHash),workHash],[Number(w.deadline),t.deadline]])equal(a,b,'state_terms');
 const names=[null,'Funded','Accepted','Allocated','Settled','Refunded'];if(!Number.isInteger(w.state)||!names[w.state])fail('state');const current=w.state===1?funding:await receiptEvent(events.current,names[w.state]);
 equal(lower(current.args.id),lower(f.id),'event_work');if(current.blockNumber<funding.blockNumber)fail('event_order');
 let outcome=null;if(w.state===3||w.state===4){outcome=await canonicalTrainingWorkOutcome(gameClient,t);equal(lower(w.outcomeHash),outcome.outcomeHash,'canonical_outcome_hash');const allocated=w.state===3?current:await receiptEvent(events.allocation,'Allocated');equal(lower(allocated.args.id),lower(f.id),'allocation_work');equal(lower(allocated.args.outcomeHash),outcome.outcomeHash,'allocation_outcome');equal(lower(allocated.args.funder),t.funderWallet,'allocation_funder');equal(lower(allocated.args.payee),t.payeeWallet,'allocation_payee');equal(allocated.args.amount.toString(),t.amountAtoms,'allocation_amount');
  const trained=BigInt(Math.ceil(+new Date(outcome.trainedAt)/1000));if(trained<funding.timestamp||trained>allocated.timestamp||trained>BigInt(t.deadline)||allocated.blockNumber<funding.blockNumber||current.blockNumber<allocated.blockNumber)fail('prospective_outcome_order');equal(lower(current.args.payee),t.payeeWallet,'payee');equal(current.args.amount.toString(),t.amountAtoms,'allocation_amount');}
 if(w.state===2)equal(lower(current.args.payee),t.payeeWallet,'accepted_payee');
 if(w.state===5){equal(lower(current.args.funder),t.funderWallet,'recovery_funder');equal(current.args.amount.toString(),t.amountAtoms,'recovery_amount');equal(lower(current.args.asset),asset,'recovery_asset');}
 if(w.state===4)equal(lower(current.args.asset),asset,'settled_asset');
 const liability=await read('liability',[asset]);let balance;
 if(asset===zero)balance=quantity(await rpc('eth_getBalance',[deployment.address,at]));
 else {const erc=[{type:'function',name:'balanceOf',stateMutability:'view',inputs:[{name:'owner',type:'address'}],outputs:[{name:'balance',type:'uint256'}]}];balance=decodeFunctionResult({abi:erc,functionName:'balanceOf',data:await rpc('eth_call',[{to:asset,data:encodeFunctionData({abi:erc,functionName:'balanceOf',args:[deployment.address]})},at])});}
 if(balance<liability||(w.state<=3&&liability<w.amount))fail('custody_shortfall');
 const finalAgain=await rpc('eth_getBlockByNumber',[finalized.number,false]);equal(lower(finalAgain.hash),lower(finalized.hash),'finalized_reorg');equal(await rpc('eth_chainId',[]),'0x1','chain');
 return Object.freeze({kind:'authoritative_work_escrow_observation',state:names[w.state],workHash,workId:lower(f.id),amountAtoms:t.amountAtoms,asset:t.asset,chainId:'1',contract:deployment.address,blockHash:lower(finalized.hash),blockNumber:finalNumber.toString(),reserveVerified:w.state<=3,allocationVerified:w.state===3||w.state===4,paidVerified:w.state===4,recoveryVerified:w.state===5,canonicalOutcomeHash:outcome?.outcomeHash??null,trust:'configured_finalized_rpc_and_canonical_game_source',financialActivation:false});
 });
}


