import crypto from 'node:crypto';

// Prospective description only. This module owns no source verification, SQL, locks or action callback.
export const BASE_WORK_EXECUTION_ADMISSION_STATUS=Object.freeze({available:false,financialActivation:false,executableWorkGrant:false,reason:'base_work_execution_admission_unconfigured'});
const USDC='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',MAX_MS=86400000,MAX_UINT=2n**256n-1n;
const fail=reason=>{const error=new Error('Base work prospective admission refused: '+reason);error.code='base_work_execution_admission';error.reason=reason;throw error;};
const insist=(condition,reason)=>{if(!condition)fail(reason);};
function exact(value,keys){
  insist(value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),'shape');
  insist(Reflect.ownKeys(value).length===keys.length&&Object.keys(value).sort().join(',')===[...keys].sort().join(','),'shape');
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);insist(d&&Object.hasOwn(d,'value')&&d.enumerable,'shape');}
  return value;
}
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const address=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/.test(v)&&v!=='0x'+'0'.repeat(40);
const hash=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/.test(v)&&v!=='0x'+'0'.repeat(64);
const integer=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const atoms=v=>typeof v==='string'&&/^[1-9][0-9]{0,77}$/.test(v)&&BigInt(v)<=MAX_UINT;
const block=v=>typeof v==='string'&&/^[1-9][0-9]{0,77}$/.test(v)&&BigInt(v)<=MAX_UINT;
const same=(a,b)=>insist(a===b,'canonical_identity');
const freeze=value=>{if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;};
const digest=value=>'0x'+crypto.createHash('sha256').update(JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)).digest('hex');
function copy(value,keys){exact(value,keys);return Object.fromEntries(keys.map(key=>[key,value[key]]));}
function policyValue(input){
  const p=copy(input,['approved','kind','id','workBudgetMs','allocationBudgetMs','clockSafetyMs','maxReadDurationMs','maxEvidenceAgeMs','maxFinalizedAgeMs']);
  insist(p.approved===true&&p.kind==='base_work_prospective_timing_v1'&&id(p.id),'unavailable');
  for(const k of['workBudgetMs','allocationBudgetMs','clockSafetyMs','maxReadDurationMs','maxEvidenceAgeMs','maxFinalizedAgeMs'])insist(integer(p[k],1,MAX_MS),'unavailable');
  insist(p.workBudgetMs+p.allocationBudgetMs+p.clockSafetyMs<=MAX_MS,'unavailable');return freeze(p);
}
function eventValue(input){const e=copy(input,['transactionHash','logIndex','transactionIndex','blockHash','blockNumber','timestampMs']);insist(hash(e.transactionHash)&&hash(e.blockHash)&&block(e.blockNumber)&&integer(e.logIndex,0,100000)&&integer(e.transactionIndex,0,100000)&&integer(e.timestampMs,1000)&&e.timestampMs%1000===0,'source');return e;}

// Root constructs this once with approved pure comparator closures. HTTP input never selects these dependencies.
// The closures must bind the original objects to the complete frozen expected frame; true is not signature verification here.
export function createBaseWorkExecutionAdmission({policy=null,provenance=null}={}){
  let fixedPolicy=null,sourceMatches=null,consentsMatch=null;
  try{
    fixedPolicy=policyValue(policy);exact(provenance,['approved','kind','chainId','observationOnly','financialActivation','executableWorkGrant','sourceEvidenceMatches','originalConsentsMatch']);
    insist(provenance.approved===true&&provenance.kind==='base_work_verified_provenance_v1'&&provenance.chainId==='8453'&&provenance.observationOnly===true&&provenance.financialActivation===false&&provenance.executableWorkGrant===false&&typeof provenance.sourceEvidenceMatches==='function'&&typeof provenance.originalConsentsMatch==='function','unavailable');
    sourceMatches=provenance.sourceEvidenceMatches;consentsMatch=provenance.originalConsentsMatch;
  }catch{fixedPolicy=null;sourceMatches=null;consentsMatch=null;}
  return function assessProspectiveBaseTraining(input){
    insist(fixedPolicy&&sourceMatches&&consentsMatch,'unavailable');
    exact(input,['terms','course','owner','worker','business','observation','source','consent','replay','dbNowMs','requestKey']);
    const t=copy(input.terms,['amountAtoms','asset','businessId','courseId','deadline','funderWallet','nonce','ordinal','ownerAccount','ownerCharacter','payeeWallet','stat','workerAccount','workerCharacter']);
    insist(t.asset==='USDC'&&atoms(t.amountAtoms)&&atoms(t.nonce)&&integer(t.deadline,1,Math.floor(Number.MAX_SAFE_INTEGER/1000))&&integer(t.ordinal,1,8)&&address(t.funderWallet)&&address(t.payeeWallet)&&t.funderWallet!==t.payeeWallet&&t.ownerAccount!==t.workerAccount&&['muscle','cunning','speed'].includes(t.stat),'terms');
    for(const k of['businessId','courseId','ownerAccount','ownerCharacter','workerAccount','workerCharacter'])insist(id(t[k]),'terms');
    const c=copy(input.course,['id','depotId','employerAccount','employerCharacter','apprenticeAccount','apprenticeCharacter','stat','state','sessions','completedSessions','wageCash','escrowCash','expiresAtMs']);
    const partyKeys=['accountId','characterId','walletAddress','alive','isNpc','accountStatus'],owner=copy(input.owner,partyKeys),worker=copy(input.worker,[...partyKeys,'energy','readyAtMs','jailed']),business=copy(input.business,['id','ownerCharacter','status']);
    for(const p of[owner,worker]){insist(id(p.accountId)&&id(p.characterId)&&address(p.walletAddress)&&p.alive===true&&p.isNpc===false&&p.accountStatus==='active','actor');}
    for(const[a,b]of[[c.id,t.courseId],[c.depotId,t.businessId],[c.employerAccount,t.ownerAccount],[c.employerCharacter,t.ownerCharacter],[c.apprenticeAccount,t.workerAccount],[c.apprenticeCharacter,t.workerCharacter],[c.stat,t.stat],[owner.accountId,t.ownerAccount],[owner.characterId,t.ownerCharacter],[worker.accountId,t.workerAccount],[worker.characterId,t.workerCharacter],[owner.walletAddress,t.funderWallet],[worker.walletAddress,t.payeeWallet],[business.id,t.businessId],[business.ownerCharacter,t.ownerCharacter]])same(a,b);
    insist(business.status==='open'&&c.state==='active'&&integer(c.sessions,1,8)&&integer(c.completedSessions,0,c.sessions-1)&&t.ordinal===c.completedSessions+1&&integer(c.wageCash,1,10000)&&integer(c.escrowCash,c.wageCash,80000)&&integer(c.expiresAtMs,1),'course');
    // Current reviewed canonical training costs10 energy. The canonical action remains authoritative and rechecks it.
    insist(worker.jailed===false&&typeof worker.energy==='number'&&Number.isFinite(worker.energy)&&worker.energy>=10&&integer(worker.readyAtMs)&&integer(input.dbNowMs,1),'readiness');
    insist(typeof input.requestKey==='string'&&/^[!-~]{1,128}$/.test(input.requestKey),'request');
    const replay=copy(input.replay,['state','sessionExists','workConsumed','requestConflict']);insist(replay.state==='none'&&replay.sessionExists===false&&replay.workConsumed===false&&replay.requestConflict===false,'replay');
    const o=copy(input.observation,['kind','state','workHash','workId','amountAtoms','asset','chainId','contract','blockHash','blockNumber','reserveVerified','allocationVerified','paidVerified','recoveryVerified','canonicalOutcomeHash','trust','financialActivation','executableWorkGrant','reserveMeaning']),workHash=digest(t);
    insist(o.kind==='authoritative_base_work_escrow_observation'&&o.state==='Accepted'&&o.workHash===workHash&&hash(o.workId)&&o.chainId==='8453'&&address(o.contract)&&o.asset==='USDC'&&o.amountAtoms===t.amountAtoms&&hash(o.blockHash)&&block(o.blockNumber)&&o.reserveVerified===true&&o.allocationVerified===false&&o.paidVerified===false&&o.recoveryVerified===false&&o.canonicalOutcomeHash===null&&o.trust==='configured_finalized_rpc_and_canonical_game_source'&&o.financialActivation===false&&o.executableWorkGrant===false&&o.reserveMeaning==='custody_at_finalized_block_only','observation');
    const s=copy(input.source,['chainId','contract','workId','workHash','funding','acceptance','finalized','readStartedAtMs','readFinishedAtMs']);s.funding=eventValue(s.funding);s.acceptance=eventValue(s.acceptance);s.finalized=copy(s.finalized,['blockHash','blockNumber','timestampMs']);
    const f=s.finalized,now=input.dbNowMs,p=fixedPolicy;
    insist(s.chainId==='8453'&&s.contract===o.contract&&s.workId===o.workId&&s.workHash===workHash&&f.blockHash===o.blockHash&&f.blockNumber===o.blockNumber&&hash(f.blockHash)&&block(f.blockNumber)&&integer(f.timestampMs,1000)&&f.timestampMs%1000===0&&integer(s.readStartedAtMs,1)&&integer(s.readFinishedAtMs,s.readStartedAtMs),'source');
    insist(BigInt(s.funding.blockNumber)<=BigInt(s.acceptance.blockNumber)&&BigInt(s.acceptance.blockNumber)<=BigInt(f.blockNumber)&&s.funding.timestampMs<=s.acceptance.timestampMs&&s.acceptance.timestampMs<=f.timestampMs&&s.acceptance.timestampMs<=now,'source_order');
    if(s.funding.blockNumber===s.acceptance.blockNumber){same(s.funding.blockHash,s.acceptance.blockHash);insist(s.funding.transactionIndex<s.acceptance.transactionIndex||(s.funding.transactionIndex===s.acceptance.transactionIndex&&s.funding.logIndex<s.acceptance.logIndex),'source_order');}
    if(s.acceptance.blockNumber===f.blockNumber)same(s.acceptance.blockHash,f.blockHash);
    insist(s.readFinishedAtMs-s.readStartedAtMs<=p.maxReadDurationMs&&now-s.readFinishedAtMs<=p.maxEvidenceAgeMs&&BigInt(s.readFinishedAtMs)<=BigInt(now)+BigInt(p.clockSafetyMs)&&now-f.timestampMs<=p.maxFinalizedAgeMs&&BigInt(f.timestampMs)<=BigInt(s.readFinishedAtMs)+BigInt(p.clockSafetyMs),'stale_source');
    const deadline=t.deadline*1000;insist(deadline-s.funding.timestampMs>=60000&&deadline-s.funding.timestampMs<=MAX_MS&&s.acceptance.timestampMs<deadline,'source_deadline');
    const start=Math.max(now,worker.readyAtMs),end=Math.min(deadline,c.expiresAtMs),required=p.workBudgetMs+p.allocationBudgetMs+p.clockSafetyMs;
    insist(end-start>required,'insufficient_budget');
    const consent=copy(input.consent,['funderSignature','payeeSignature']);for(const signature of Object.values(consent))insist(typeof signature==='string'&&/^0x[0-9a-fA-F]{128}(?:[0-9a-fA-F]{2})?$/.test(signature),'consent');
    const expected=freeze({terms:t,course:c,owner,worker,business,observation:o,source:s,consent,workHash,nativeUsdc:USDC,policyId:p.id});
    try{insist(sourceMatches(input.source,expected)===true,'unverified_source');insist(consentsMatch(input.consent,expected)===true,'unverified_consent');}catch{fail('unverified_provenance');}
    const identity=digest({kind:'base_work_training_request_v1',workerAccount:t.workerAccount,requestKey:input.requestKey,workHash,chainId:'8453',contract:o.contract,workId:o.workId,funding:{transactionHash:s.funding.transactionHash,logIndex:s.funding.logIndex},acceptance:{transactionHash:s.acceptance.transactionHash,logIndex:s.acceptance.logIndex}});
    return Object.freeze({kind:'base_work_prospective_execution_candidate',candidateOnly:true,courseId:t.courseId,ordinal:t.ordinal,workId:o.workId,workHash,chainId:'8453',contract:o.contract,asset:'USDC',amountAtoms:t.amountAtoms,requestIdentityHash:identity,policyId:p.id,sourceFinalizedBlockHash:f.blockHash,sourceFinalizedBlockNumber:f.blockNumber,effectiveStartMs:start,effectiveDeadlineMs:end,usableBudgetMs:end-start,requiredBudgetMs:required,atomicLockedRevalidationRequired:true,durableReceiptRequired:true,financialActivation:false,executableWorkGrant:false});
  };
}
