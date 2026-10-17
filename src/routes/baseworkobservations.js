import { trainingWorkHash } from '../fundedworkescrowadapter.js';

const path='/v1/company/external-work/base-observation';
const unavailable=Object.freeze({error:'base_work_observation_unavailable',observationOnly:true,financialActivation:false,executableWorkGrant:false});
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const hash=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/.test(v)&&v!=='0x'+'0'.repeat(64);
const address=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/.test(v)&&v!=='0x'+'0'.repeat(40);
const integer=v=>typeof v==='string'&&/^[1-9][0-9]{0,77}$/.test(v)&&BigInt(v)<2n**256n;
const blockNumber=v=>typeof v==='string'&&/^(?:0|[1-9][0-9]{0,77})$/.test(v)&&BigInt(v)<2n**256n;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys;
const reference=v=>exact(v,'logIndex,transactionHash')&&hash(v.transactionHash)&&Number.isSafeInteger(v.logIndex)&&v.logIndex>=0&&v.logIndex<=100000;
const signature=v=>typeof v==='string'&&/^0x(?:[0-9a-fA-F]{2}){64,65}$/.test(v);
const approved=o=>o?.approved===true&&o.chainId==='8453'&&o.observationOnly===true&&o.financialActivation===false&&o.executableWorkGrant===false&&typeof o.observe==='function';
const input=v=>exact(v,'amountAtoms,asset,consent,courseId,deadline,events,nonce,ordinal')&&id(v.courseId)&&['ETH','USDC'].includes(v.asset)&&integer(v.amountAtoms)&&integer(v.nonce)&&Number.isSafeInteger(v.deadline)&&v.deadline>0&&Number.isSafeInteger(v.ordinal)&&v.ordinal>=1&&v.ordinal<=8&&exact(v.consent,'funderSignature,payeeSignature')&&signature(v.consent.funderSignature)&&signature(v.consent.payeeSignature)&&exact(v.events,'allocation,current,funding')&&reference(v.events.funding)&&reference(v.events.current)&&reference(v.events.allocation);

function observationDTO(value,terms,workHash){
 if(!exact(value,'allocationVerified,amountAtoms,asset,blockHash,blockNumber,canonicalOutcomeHash,chainId,contract,executableWorkGrant,financialActivation,kind,paidVerified,recoveryVerified,reserveMeaning,reserveVerified,state,trust,workHash,workId'))return null;
 const state=['Funded','Accepted','Allocated','Settled','Refunded'].indexOf(value.state),allocated=state===2||state===3;
 if(state<0||value.kind!=='authoritative_base_work_escrow_observation'||value.chainId!=='8453'||value.financialActivation!==false||value.executableWorkGrant!==false||value.reserveMeaning!=='custody_at_finalized_block_only'||value.trust!=='configured_finalized_rpc_and_canonical_game_source'||value.workHash!==workHash||value.amountAtoms!==terms.amountAtoms||value.asset!==terms.asset||!hash(value.workId)||!address(value.contract)||!hash(value.blockHash)||!blockNumber(value.blockNumber)||value.reserveVerified!==(state<=2)||value.allocationVerified!==allocated||value.paidVerified!==(state===3)||value.recoveryVerified!==(state===4)||(allocated?!hash(value.canonicalOutcomeHash):value.canonicalOutcomeHash!==null))return null;
 return {kind:value.kind,state:value.state,workHash:value.workHash,workId:value.workId,amountAtoms:value.amountAtoms,asset:value.asset,chainId:value.chainId,contract:value.contract,blockHash:value.blockHash,blockNumber:value.blockNumber,reserveVerified:value.reserveVerified,allocationVerified:value.allocationVerified,paidVerified:value.paidVerified,recoveryVerified:value.recoveryVerified,canonicalOutcomeHash:value.canonicalOutcomeHash,trust:value.trust,financialActivation:false,executableWorkGrant:false,reserveMeaning:value.reserveMeaning};
}

// The server-owned descriptor binds its approved deployment and read-only RPC outside this route.
// No request can select a contract/provider, create a job, sign, spend, allocate or settle funds.
export function registerBaseWorkObservations(app,{pool,auth,observer}={}){
 if(typeof auth!=='function')throw Error('Base work observations require authentication.');
 app.post(path,{preHandler:auth,bodyLimit:4096},async(req,reply)=>{
  if(!id(req.user?.sub))return reply.code(401).send({...unavailable,error:'auth'});
  if(!approved(observer)||typeof pool?.query!=='function')return reply.code(503).send({...unavailable});
  if(Object.keys(req.query||{}).length||!input(req.body))return reply.code(400).send({...unavailable,error:'base_work_observation_terms'});
  const body=req.body;let rows;
  try{rows=(await pool.query(`SELECT c.id,c.depot_id,c.employer_account,c.employer_character,c.apprentice_account,c.apprentice_character,c.stat,
   e.wallet_address AS funder_wallet,w.wallet_address AS payee_wallet
   FROM worker_training_courses c
   JOIN characters employer ON employer.id=c.employer_character AND employer.account_id=c.employer_account
   JOIN characters apprentice ON apprentice.id=c.apprentice_character AND apprentice.account_id=c.apprentice_account
   JOIN account_persistent e ON e.account_id=c.employer_account
   JOIN account_persistent w ON w.account_id=c.apprentice_account
   WHERE c.id=$1 AND (c.employer_account=$2 OR c.apprentice_account=$2) LIMIT 2`,[body.courseId,req.user.sub])).rows;}catch{return reply.code(503).send({...unavailable});}
  if(!Array.isArray(rows)||rows.length!==1)return reply.code(404).send({...unavailable,error:'base_work_observation_not_found'});
  const row=rows[0];if(!row||typeof row!=='object'||Array.isArray(row))return reply.code(503).send({...unavailable});
  const funderWallet=typeof row.funder_wallet==='string'?row.funder_wallet.toLowerCase():null,payeeWallet=typeof row.payee_wallet==='string'?row.payee_wallet.toLowerCase():null;
  if(row.id!==body.courseId||![row.employer_account,row.apprentice_account].includes(req.user.sub))return reply.code(404).send({...unavailable,error:'base_work_observation_not_found'});
  if(![row.id,row.depot_id,row.employer_account,row.employer_character,row.apprentice_account,row.apprentice_character].every(id)||row.employer_account===row.apprentice_account||!['muscle','cunning','speed'].includes(row.stat)||!address(funderWallet)||!address(payeeWallet)||funderWallet===payeeWallet)return reply.code(503).send({...unavailable});
  const terms=Object.freeze({amountAtoms:body.amountAtoms,asset:body.asset,businessId:row.depot_id,courseId:row.id,deadline:body.deadline,funderWallet,nonce:body.nonce,ordinal:body.ordinal,ownerAccount:row.employer_account,ownerCharacter:row.employer_character,payeeWallet,stat:row.stat,workerAccount:row.apprentice_account,workerCharacter:row.apprentice_character});
  const consent=Object.freeze({funderSignature:body.consent.funderSignature,payeeSignature:body.consent.payeeSignature}),events=Object.freeze(Object.fromEntries(['allocation','current','funding'].map(name=>[name,Object.freeze({transactionHash:body.events[name].transactionHash,logIndex:body.events[name].logIndex})]))),workHash=trainingWorkHash(terms);
  try{
   if(!approved(observer))return reply.code(503).send({...unavailable});
   const value=await observer.observe(Object.freeze({terms,consent,events}),pool),observation=observationDTO(value,terms,workHash);
   if(!approved(observer)||!observation)return reply.code(503).send({...unavailable});
   return {observationOnly:true,financialActivation:false,executableWorkGrant:false,observation};
  }catch{return reply.code(503).send({...unavailable});}
 });
}
