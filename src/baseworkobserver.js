import { createPublicClient, http } from 'viem';
import { observeBaseWorkEscrowSource, observeBaseWorkEscrowOutcomeSource, BASE_WORK_ESCROW_OBSERVER_STATUS } from './fundedworkescrowbaseadapter.js';
import { BASE_WORK_ESCROW_RUNTIME_KECCAK, BASE_WORK_ESCROW_SOURCE_SHA256 } from './fundedworkescrowbaseartifact.js';

const methods=Object.freeze(['eth_call','eth_chainId','eth_getBalance','eth_getBlockByNumber','eth_getCode','eth_getTransactionByHash','eth_getTransactionReceipt']);
const requestMs=5000,observationMs=30000;
const unavailable=Object.freeze({...BASE_WORK_ESCROW_OBSERVER_STATUS,approved:false});
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys;
const failure=()=>{const error=new Error('Base work observation unavailable.');error.code='base_work_observer_unavailable';return error;};

// A budget bounds the returned observation and aborts its RPC reads. It cannot cancel a DB query.
async function withinBudget(ms,parent,operation){
 const controller=new AbortController(),signal=parent?AbortSignal.any([parent,controller.signal]):controller.signal,started=performance.now();let timer,abort;
 try{
  const deadline=new Promise((_,reject)=>{abort=()=>reject(failure());signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>controller.abort(),ms);});
  if(signal.aborted)throw failure();
  const value=await Promise.race([deadline,operation(signal)]);
  if(signal.aborted||performance.now()-started>=ms)throw failure();
  return value;
 }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);controller.abort();}
}

// SERVER-OWNED configuration only. "approved" selects a reader; each call still verifies deployment.
export function createBaseWorkObserver(config){
 let deployment,rpcUrl;
 try{
  if(!exact(config,'address,chainId,creationTransactionHash,rpcUrl')||config.chainId!=='8453'||typeof config.address!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(config.address)||/^0x0{40}$/.test(config.address)||typeof config.creationTransactionHash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(config.creationTransactionHash)||/^0x0{64}$/.test(config.creationTransactionHash)||typeof config.rpcUrl!=='string'||config.rpcUrl.length>2048||config.rpcUrl.trim()!==config.rpcUrl)return unavailable;
  const url=new URL(config.rpcUrl);if(url.protocol!=='https:'||!url.hostname||url.username||url.password||url.hash||url.search)return unavailable;
  rpcUrl=url.href;deployment=Object.freeze({chainId:'8453',address:config.address.toLowerCase(),creationTransactionHash:config.creationTransactionHash.toLowerCase(),runtimeKeccak:BASE_WORK_ESCROW_RUNTIME_KECCAK,sourceSha256:BASE_WORK_ESCROW_SOURCE_SHA256});
 }catch{return unavailable;}
 const observe=operation=>async(input,gameClient)=>{
  try{
   if(!exact(input,'consent,events,terms'))throw failure();
   return await withinBudget(observationMs,null,async signal=>{
    const client=createPublicClient({transport:http(rpcUrl,{batch:false,retryCount:0,timeout:requestMs,maxResponseBodySize:1048576,methods:{include:methods},fetchOptions:{redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'}})});
    const reader=Object.freeze({request:async request=>{
     if(!exact(request,'method,params')||!methods.includes(request.method)||!Array.isArray(request.params)||signal.aborted)throw failure();
     return withinBudget(requestMs,signal,requestSignal=>client.request(request,{signal:requestSignal,retryCount:0}));
    }});
    return operation(reader,deployment,input.terms,input.consent,input.events,gameClient);
   });
  }catch{throw failure();}
 };
 return Object.freeze({approved:true,chainId:'8453',observationOnly:true,financialActivation:false,executableWorkGrant:false,deploymentVerified:false,observe:observe(observeBaseWorkEscrowSource),observeOutcome:observe(observeBaseWorkEscrowOutcomeSource)});
}
