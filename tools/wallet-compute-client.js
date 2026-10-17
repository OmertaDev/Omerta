// Opt-in agent-owned x402 client. No CLI auto-run, environment, wallet keys or platform funds.
import {createHash, randomBytes as cryptoRandomBytes} from 'node:crypto';
import {getAddress, hashTypedData, recoverTypedDataAddress} from 'viem';

export const WALLET_COMPUTE_NETWORK = 'eip155:8453';
export const WALLET_COMPUTE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const UINT256 = (1n << 256n) - 1n, MAX_BODY = 65536, MAX_RESPONSE = 1048576;
const CALL_MS = 60000, HTTP_MS = 15000, MAX_ATTEMPTS = 1000;
const LOCAL_ERROR = Symbol('wallet-compute-client-error');
const TYPES = Object.freeze({TransferWithAuthorization: Object.freeze([
  {name:'from',type:'address'}, {name:'to',type:'address'}, {name:'value',type:'uint256'},
  {name:'validAfter',type:'uint256'}, {name:'validBefore',type:'uint256'}, {name:'nonce',type:'bytes32'},
])});
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? '['+value.map(canonical).join(',')+']'
  : value && typeof value === 'object' ? '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}'
  : JSON.stringify(value);
const freeze = value => { if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
const clone = value => structuredClone(value);
function clientError(code){const error=new Error(code);error.code=code;error[LOCAL_ERROR]=true;return error;}
function fail(code){throw clientError(code);}
function check(ok,code='UNSUPPORTED_INPUT'){if(!ok)fail(code);}
function object(value,keys,optional=[]){
  check(value && typeof value==='object' && !Array.isArray(value));
  check([Object.prototype,null].includes(Object.getPrototypeOf(value)));
  const descriptors=Object.getOwnPropertyDescriptors(value);
  check(Reflect.ownKeys(value).every(k=>typeof k==='string' && Object.hasOwn(descriptors[k],'value')));
  check(keys.every(k=>Object.hasOwn(value,k)) && Object.keys(value).every(k=>keys.includes(k)||optional.includes(k)));
}
function address(value){try{check(typeof value==='string'&&/^0x[\da-fA-F]{40}$/.test(value));return getAddress(value).toLowerCase();}catch{fail('INVALID_ADDRESS');}}
function atoms(value,zero=false){check(typeof value==='string'&&/^(0|[1-9]\d{0,77})$/.test(value),'INVALID_AMOUNT');const n=BigInt(value);check(n<=UINT256&&(zero?n>=0n:n>0n),'INVALID_AMOUNT');return n;}
function integer(value,min,max,code='INVALID_INTEGER'){check(Number.isSafeInteger(value)&&value>=min&&value<=max,code);return value;}
function url(value){try{const u=new URL(value);check(u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.search&&u.href===value);return u.href;}catch{fail('INVALID_RESOURCE');}}
function digest(value){check(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),'INVALID_DIGEST');return value;}
const day = ms => new Date(ms).toISOString().slice(0,10);
const domain = () => ({name:'USD Coin',version:'2',chainId:8453,verifyingContract:WALLET_COMPUTE_USDC});
function decodeHeader(value){
  check(typeof value==='string'&&value.length>0&&value.length<=32768&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'INVALID_PAYMENT_HEADER');
  const bytes=Buffer.from(value,'base64');check(bytes.toString('base64')===value,'INVALID_PAYMENT_HEADER');
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('INVALID_PAYMENT_HEADER');}
}
function policyInput(value){
  object(value,['perCallAtoms','dailyAtoms','totalAtoms','authorizationSeconds','resources']);
  const perCall=atoms(value.perCallAtoms),daily=atoms(value.dailyAtoms),total=atoms(value.totalAtoms);
  check(perCall<=daily&&daily<=total,'INVALID_BUDGET');integer(value.authorizationSeconds,2,300);
  check(Array.isArray(value.resources)&&value.resources.length>0&&value.resources.length<=16,'INVALID_RESOURCES');
  const resources=value.resources.map(r=>{object(r,['url','payTo','models']);const endpoint=url(r.url),payTo=address(r.payTo);
    check(Array.isArray(r.models)&&r.models.length>0&&r.models.length<=64&&r.models.every(m=>typeof m==='string'&&/^[\w./:-]{1,128}$/.test(m))&&new Set(r.models).size===r.models.length,'INVALID_MODELS');
    return {url:endpoint,payTo,models:[...r.models]};});
  check(new Set(resources.map(r=>r.url)).size===resources.length,'DUPLICATE_RESOURCE');
  return freeze({...value,resources});
}
function requestInput(value,policy){
  object(value,['attemptId','resourceUrl','body']);check(typeof value.attemptId==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(value.attemptId),'INVALID_ATTEMPT_ID');
  const endpoint=url(value.resourceUrl),resource=policy.resources.find(r=>r.url===endpoint);check(resource,'RESOURCE_NOT_ALLOWED');
  object(value.body,['model','messages','max_tokens'],['temperature','stream']);check(resource.models.includes(value.body.model),'MODEL_NOT_ALLOWED');
  integer(value.body.max_tokens,1,16384);check(value.body.stream===undefined||value.body.stream===false,'STREAM_UNSUPPORTED');
  if(value.body.temperature!==undefined)check(typeof value.body.temperature==='number'&&Number.isFinite(value.body.temperature)&&value.body.temperature>=0&&value.body.temperature<=2);
  check(Array.isArray(value.body.messages)&&value.body.messages.length>0&&value.body.messages.length<=64);
  const messages=value.body.messages.map(m=>{object(m,['role','content']);check(['system','user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.length<=16384);return {role:m.role,content:m.content};});
  const body={model:value.body.model,messages,max_tokens:value.body.max_tokens,stream:false};if(value.body.temperature!==undefined)body.temperature=value.body.temperature;
  const serialized=canonical(body);check(Buffer.byteLength(serialized)<=MAX_BODY,'BODY_TOO_LARGE');
  return freeze({attemptId:value.attemptId,resourceUrl:endpoint,body,serialized,resource,bodyDigest:hash(serialized),requestDigest:hash(canonical({method:'POST',url:endpoint,bodyDigest:hash(serialized)}))});
}
function quoteInput(encoded,request){
  const q=decodeHeader(encoded);object(q,['x402Version','resource','accepts'],['error','extensions']);check(q.x402Version===2,'X402_VERSION_UNSUPPORTED');
  object(q.resource,['url'],['description','mimeType']);check(q.resource.url===request.resourceUrl,'RESOURCE_QUOTE_MISMATCH');
  if(q.resource.description!==undefined)check(typeof q.resource.description==='string'&&q.resource.description.length<=1024);
  if(q.resource.mimeType!==undefined)check(q.resource.mimeType==='application/json');
  check(Array.isArray(q.accepts)&&q.accepts.length>0&&q.accepts.length<=16,'INVALID_ACCEPTS');
  const choices=[];for(const r of q.accepts){
    check(r&&typeof r==='object'&&!Array.isArray(r),'INVALID_REQUIREMENTS');
    if(r.scheme!=='exact'||r.network!==WALLET_COMPUTE_NETWORK)continue;
    object(r,['scheme','network','amount','asset','payTo','maxTimeoutSeconds','extra']);
    object(r.extra,['name','version'],['assetTransferMethod','paymentFlow']);
    if(r.extra.assetTransferMethod!==undefined&&r.extra.assetTransferMethod!=='eip3009')continue;
    if(r.extra.paymentFlow!==undefined&&r.extra.paymentFlow!=='authorization')continue;
    check(address(r.asset)===WALLET_COMPUTE_USDC.toLowerCase(),'ASSET_UNSUPPORTED');check(address(r.payTo)===request.resource.payTo,'MERCHANT_NOT_ALLOWED');
    check(r.extra.name==='USD Coin'&&r.extra.version==='2','DOMAIN_UNSUPPORTED');atoms(r.amount);integer(r.maxTimeoutSeconds,2,300);
    choices.push(clone(r));
  }
  check(choices.length===1,'EXACT_QUOTE_AMBIGUOUS_OR_UNSUPPORTED');
  const accepted=choices[0],resource=clone(q.resource),quoteDigest=hash(canonical({x402Version:2,resource,accepted}));
  // Challenge extensions, including Permit2 suggestions, are inert and never echoed or signed.
  return freeze({accepted,resource,quoteDigest});
}
function settlementHeader(header,attempt){
  if(header===null||header===undefined)return {status:'missing',value:null};
  try{const r=decodeHeader(header);object(r,['success','transaction','network'],['payer','amount','errorReason']);
    check(typeof r.success==='boolean'&&r.network===WALLET_COMPUTE_NETWORK);
    check(typeof r.transaction==='string'&&(r.success?/^0x[\da-fA-F]{64}$/.test(r.transaction):r.transaction===''||/^0x[\da-fA-F]{64}$/.test(r.transaction)));
    if(r.payer!==undefined)check(address(r.payer)===attempt.wallet);if(r.amount!==undefined)check(atoms(r.amount)===atoms(attempt.amountAtoms));
    if(r.errorReason!==undefined)check(typeof r.errorReason==='string'&&r.errorReason.length<=256);
    return {status:'declared',value:clone(r)};
  }catch{return {status:'malformed',value:null};}
}
const ENTRY_KEYS=['id','url','model','requestDigest','bodyDigest','startedAtMs','updatedAtMs','dayUTC','state','amountAtoms','merchant','quoteDigest','typedDataHash','nonceHash','validAfter','validBefore','signatureHash'];
function validateState(state,scope,policyDigest,now){
  object(state,['version','scope','policyDigest','revision','lastNowMs','attempts']);check(state.version===1&&canonical(state.scope)===canonical(scope)&&state.policyDigest===policyDigest,'JOURNAL_SCOPE_OR_POLICY_MISMATCH');
  integer(state.revision,0,Number.MAX_SAFE_INTEGER-1);integer(state.lastNowMs,0,now,'CLOCK_OR_JOURNAL_INVALID');check(Array.isArray(state.attempts)&&state.attempts.length<=MAX_ATTEMPTS,'JOURNAL_FULL_OR_INVALID');
  const ids=new Set();for(const e of state.attempts){object(e,ENTRY_KEYS);check(typeof e.id==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(e.id)&&!ids.has(e.id),'JOURNAL_CORRUPT');ids.add(e.id);
    url(e.url);check(typeof e.model==='string'&&e.model.length<=128);digest(e.requestDigest);digest(e.bodyDigest);integer(e.startedAtMs,1,state.lastNowMs);integer(e.updatedAtMs,e.startedAtMs,state.lastNowMs);check(e.dayUTC===day(e.startedAtMs));
    check(['quoting','refused','reserved','authorized','ambiguous','response'].includes(e.state),'JOURNAL_CORRUPT');const amount=atoms(e.amountAtoms,true);
    if(amount===0n){check(['quoting','refused'].includes(e.state));for(const k of ['merchant','quoteDigest','typedDataHash','nonceHash','validAfter','validBefore','signatureHash'])check(e[k]===null,'JOURNAL_CORRUPT');}
    else{check(['reserved','authorized','ambiguous','response'].includes(e.state));address(e.merchant);for(const k of ['quoteDigest','typedDataHash','nonceHash'])digest(e[k]);atoms(e.validAfter,true);atoms(e.validBefore);check(BigInt(e.validBefore)>BigInt(e.validAfter));if(e.signatureHash!==null)digest(e.signatureHash);if(['authorized','response'].includes(e.state))check(e.signatureHash!==null);}
  }
}

// Explicit owner initialization only. A missing/reset journal is never initialized by compute().
export function createWalletComputeJournalState(input){
  object(input,['enabled','walletAddress','policy']);check(input.enabled===true,'NOT_OPTED_IN');
  const wallet=address(input.walletAddress),policy=policyInput(clone(input.policy));
  return freeze({version:1,scope:{version:1,wallet,network:WALLET_COMPUTE_NETWORK,asset:WALLET_COMPUTE_USDC.toLowerCase()},policyDigest:hash(canonical(policy)),revision:0,lastNowMs:0,attempts:[]});
}

/**
 * The caller owns the wallet and durable journal. journal.transact(scope, update) must serialize
 * ALL clients of that wallet/network/asset, call update exactly once, atomically fsync/commit its
 * returned state, then return {committed:true,durable:true,state}. No in-memory fallback exists.
 * These adapter guarantees are trusted runtime responsibilities, not established by flags.
 * Every nonzero reservation remains charged to total AND subsequent daily caps; this MVP never
 * releases ambiguity or gives day-rollover credit without a separately reviewed reconciliation.
 */
export function createWalletComputeClient(config){
  object(config,['enabled','walletAddress','signer','policy','journal','authorize'],['fetchImpl','now','randomBytes']);check(config.enabled===true,'NOT_OPTED_IN');
  const wallet=address(config.walletAddress),signer=config.signer;check(signer&&typeof signer.signTypedData==='function','SIGNER_REQUIRED');
  check(address(signer.address??signer.account?.address)===wallet,'SIGNER_ADDRESS_MISMATCH');
  if(signer.chain?.id!==undefined)check(signer.chain.id===8453,'SIGNER_CHAIN_MISMATCH');
  const policy=policyInput(clone(config.policy)),policyDigest=hash(canonical(policy)),journal=config.journal;
  check(journal&&journal.version===1&&journal.atomic===true&&journal.durable===true&&typeof journal.transact==='function','DURABLE_ATOMIC_JOURNAL_REQUIRED');
  check(typeof config.authorize==='function','OWNER_AUTHORIZATION_REQUIRED');const authorize=config.authorize,transact=journal.transact.bind(journal),signTypedData=signer.signTypedData.bind(signer);
  const fetchImpl=config.fetchImpl??globalThis.fetch,now=config.now??Date.now,random=config.randomBytes??cryptoRandomBytes;
  check(typeof fetchImpl==='function'&&typeof now==='function'&&typeof random==='function');
  const scope=freeze({version:1,wallet,network:WALLET_COMPUTE_NETWORK,asset:WALLET_COMPUTE_USDC.toLowerCase()});
  async function compute(input){
    const request=requestInput(input,policy);let lastClock=0;
    const clock=()=>{const n=now();integer(n,10000,8640000000000000,'INVALID_CLOCK');check(n>=lastClock,'CLOCK_MOVED_BACKWARD');lastClock=n;return n;};
    const began=clock(),deadline=began+CALL_MS;let phase='not-started',held='0',journalUncertain=false,providerResult=null,declaredSettlement={status:'missing',value:null};
    const bounded=async(operation,limit=deadline)=>{const target=Math.min(deadline,limit),remaining=target-clock();check(remaining>0,'CALL_DEADLINE');let timer;try{const task=Promise.resolve().then(()=>{check(clock()<target,'CALL_DEADLINE');return operation();});const result=await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(clientError('CALL_DEADLINE')),remaining);})]);check(clock()<target,'CALL_DEADLINE');return result;}finally{clearTimeout(timer);}};
    async function transaction(update){
      let calls=0,expected,invoked=false;let result;try{result=await bounded(()=>{invoked=true;return transact(clone(scope),state=>{
        check(++calls===1,'JOURNAL_MUTATOR_REPEATED');const at=clock();check(at<deadline,'CALL_DEADLINE');check(state!==null,'JOURNAL_NOT_INITIALIZED');
        validateState(state,scope,policyDigest,at);const next=clone(state);update(next,at);next.revision++;next.lastNowMs=at;validateState(next,scope,policyDigest,at);expected=clone(next);return freeze(next);
      });});
      check(calls===1&&expected,'JOURNAL_MUTATOR_NOT_CALLED');object(result,['committed','durable','state']);check(result.committed===true&&result.durable===true&&canonical(result.state)===canonical(expected),'JOURNAL_COMMIT_UNCERTAIN');return expected;
      }catch(error){if(expected||(invoked&&(!error?.[LOCAL_ERROR]||error.code==='CALL_DEADLINE')))journalUncertain=true;throw error;}
    }
    async function http(payment){
      const controller=new AbortController(),httpDeadline=Math.min(deadline,clock()+HTTP_MS),timer=setTimeout(()=>controller.abort(),Math.max(1,httpDeadline-clock()));
      try{const headers={'content-type':'application/json'};if(payment)headers['PAYMENT-SIGNATURE']=payment;
        const response=await bounded(()=>fetchImpl(request.resourceUrl,{method:'POST',headers,body:request.serialized,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal}),httpDeadline);
        check(response&&Number.isInteger(response.status)&&response.status>=100&&response.status<=599&&response.headers&&typeof response.headers.get==='function','INVALID_HTTP_RESPONSE');
        check(response.redirected!==true&&(!response.url||response.url===request.resourceUrl),'REDIRECT_OR_RESOURCE_MISMATCH');
        const length=response.headers.get('content-length');if(length!==null)check(/^\d+$/.test(length)&&Number(length)<=MAX_RESPONSE,'RESPONSE_TOO_LARGE');
        const reader=response.body?.getReader?.();check(reader&&typeof reader.read==='function','STREAMING_RESPONSE_REQUIRED');let size=0;const parts=[];
        try{for(;;){const row=await bounded(()=>reader.read(),httpDeadline);if(row.done)break;check(row.value instanceof Uint8Array,'INVALID_HTTP_BODY');size+=row.value.byteLength;check(size<=MAX_RESPONSE,'RESPONSE_TOO_LARGE');parts.push(Buffer.from(row.value));}}catch(error){controller.abort();try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}throw error;}finally{reader.releaseLock?.();}
        return {response,body:Buffer.concat(parts)};
      }finally{clearTimeout(timer);controller.abort();}
    }
    try{
      await transaction((state,at)=>{check(!state.attempts.some(e=>e.id===request.attemptId),'ATTEMPT_ALREADY_RECORDED');check(!state.attempts.some(e=>e.requestDigest===request.requestDigest&&['quoting','reserved','authorized','ambiguous'].includes(e.state)),'REQUEST_HAS_UNRESOLVED_ATTEMPT');check(state.attempts.length<MAX_ATTEMPTS,'JOURNAL_FULL');
        state.attempts.push({id:request.attemptId,url:request.resourceUrl,model:request.body.model,requestDigest:request.requestDigest,bodyDigest:request.bodyDigest,startedAtMs:at,updatedAtMs:at,dayUTC:day(at),state:'quoting',amountAtoms:'0',merchant:null,quoteDigest:null,typedDataHash:null,nonceHash:null,validAfter:null,validBefore:null,signatureHash:null});});phase='quoting';
      const initial=await http(null);check(initial.response.status===402,'UNPAID_402_REQUIRED');const quote=quoteInput(initial.response.headers.get('PAYMENT-REQUIRED'),request);
      const seconds=Math.floor(clock()/1000),nonceBytes=Buffer.from(random(32));check(nonceBytes.length===32&&!nonceBytes.every(b=>b===0),'INVALID_NONCE');
      const authorization=freeze({from:wallet,to:quote.accepted.payTo,value:quote.accepted.amount,validAfter:String(seconds-5),validBefore:String(seconds+Math.min(policy.authorizationSeconds,quote.accepted.maxTimeoutSeconds)),nonce:'0x'+nonceBytes.toString('hex')});
      // EIP-3009 signs only token-transfer fields. URL/model/body stay local policy/journal bindings.
      const typed=()=>({domain:domain(),types:clone(TYPES),primaryType:'TransferWithAuthorization',message:{...authorization,value:BigInt(authorization.value),validAfter:BigInt(authorization.validAfter),validBefore:BigInt(authorization.validBefore)}}),typedDataHash=hashTypedData(typed()),nonceHash=hash(nonceBytes);
      const proposal={attemptId:request.attemptId,wallet,network:WALLET_COMPUTE_NETWORK,asset:WALLET_COMPUTE_USDC,resourceUrl:request.resourceUrl,model:request.body.model,bodyDigest:request.bodyDigest,requestDigest:request.requestDigest,payTo:address(quote.accepted.payTo),amountAtoms:quote.accepted.amount,validAfter:authorization.validAfter,validBefore:authorization.validBefore,quoteDigest:quote.quoteDigest,typedDataHash};
      const approvalDigest=hash(canonical(proposal)),approval=await bounded(()=>authorize(freeze(clone({...proposal,approvalDigest}))));object(approval,['approved','approvalDigest']);check(approval.approved===true&&approval.approvalDigest===approvalDigest,'OWNER_AUTHORIZATION_REFUSED');
      await transaction((state,at)=>{const entry=state.attempts.find(e=>e.id===request.attemptId);check(entry?.state==='quoting','JOURNAL_STATE_CHANGED');check(Math.floor(at/1000)<Number(authorization.validBefore)-1,'AUTHORIZATION_EXPIRED');
        const amount=atoms(quote.accepted.amount),spent=state.attempts.reduce((sum,e)=>sum+atoms(e.amountAtoms,true),0n);
        check(amount<=atoms(policy.perCallAtoms),'PER_CALL_BUDGET');check(spent+amount<=atoms(policy.dailyAtoms),'DAILY_BUDGET_OR_PENDING_HOLDS');check(spent+amount<=atoms(policy.totalAtoms),'TOTAL_BUDGET');check(!state.attempts.some(e=>e.nonceHash===nonceHash),'NONCE_ALREADY_RECORDED');
        Object.assign(entry,{state:'reserved',amountAtoms:quote.accepted.amount,merchant:address(quote.accepted.payTo),quoteDigest:quote.quoteDigest,typedDataHash:typedDataHash.slice(2),nonceHash,validAfter:authorization.validAfter,validBefore:authorization.validBefore,updatedAtMs:at});});held=quote.accepted.amount;phase='reserved';
      const signature=await bounded(()=>signTypedData(freeze(clone(typed()))));
      check(typeof signature==='string'&&/^0x[\da-fA-F]{130}$/.test(signature),'UNSUPPORTED_SIGNATURE');
      let recovered;try{recovered=await bounded(()=>recoverTypedDataAddress({...typed(),signature}));}catch{fail('SIGNATURE_VERIFICATION_FAILED');}check(address(recovered)===wallet,'SIGNATURE_WALLET_MISMATCH');
      await transaction((state,at)=>{const entry=state.attempts.find(e=>e.id===request.attemptId);check(entry?.state==='reserved'&&entry.typedDataHash===typedDataHash.slice(2),'JOURNAL_STATE_CHANGED');check(Math.floor(at/1000)<Number(authorization.validBefore)-1,'AUTHORIZATION_EXPIRED');Object.assign(entry,{state:'authorized',signatureHash:hash(signature),updatedAtMs:at});});phase='authorized';
      const payment=Buffer.from(JSON.stringify({x402Version:2,resource:quote.resource,accepted:quote.accepted,payload:{signature,authorization}})).toString('base64');
      check(Math.floor(clock()/1000)<Number(authorization.validBefore)-1,'AUTHORIZATION_EXPIRED');
      const paid=await http(payment);let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(paid.body));}catch{fail('INVALID_PROVIDER_JSON');}
      providerResult=freeze({status:paid.response.status,body,bodyDigest:hash(paid.body)});declaredSettlement=freeze(settlementHeader(paid.response.headers.get('PAYMENT-RESPONSE'),{wallet,amountAtoms:held}));
      const successful=paid.response.status===200&&declaredSettlement.status==='declared'&&declaredSettlement.value.success===true;
      await transaction((state,at)=>{const entry=state.attempts.find(e=>e.id===request.attemptId);check(entry?.state==='authorized','JOURNAL_STATE_CHANGED');entry.state=successful?'response':'ambiguous';entry.updatedAtMs=at;});phase=successful?'response':'ambiguous';
      return freeze({attemptId:request.attemptId,state:phase,amountHeldAtoms:held,providerResult,declaredSettlement,verifiedOnChainReceipt:null,settlementVerified:false,inferenceQualityVerified:false,gameOutcomeVerified:false,automaticRetry:false});
    }catch(error){
      const code=error?.[LOCAL_ERROR]===true?error.code:'EXTERNAL_OPERATION_FAILED';
      // An uncertain commit or signer may have produced an authorization. Never refund/resume it.
      if(phase!=='not-started')try{await transaction((state,at)=>{const entry=state.attempts.find(e=>e.id===request.attemptId);check(entry,'JOURNAL_STATE_CHANGED');held=entry.amountAtoms;entry.state=atoms(held,true)>0n?'ambiguous':'refused';entry.updatedAtMs=at;});}catch{}
      return freeze({attemptId:request.attemptId,state:journalUncertain||atoms(held,true)>0n||['reserved','authorized'].includes(phase)?'ambiguous':'refused',error:{code},amountHeldAtoms:journalUncertain?null:held,journalCommitUncertain:journalUncertain,providerResult,declaredSettlement,verifiedOnChainReceipt:null,settlementVerified:false,inferenceQualityVerified:false,gameOutcomeVerified:false,automaticRetry:false});
    }
  }
  return Object.freeze({scope,compute});
}
