import assert from 'node:assert/strict';
import { publicFundedWorkBacking, observeFinalizedWorkTransfer, ETHEREUM_USDC } from '../src/fundedworkchainobservations.js';
const h='0x'+'1'.repeat(64),bh='0x'+'2'.repeat(64),from='0x'+'3'.repeat(40),to='0x'+'4'.repeat(40);
const request={asset:'ETH',chainId:'1',from,to,amountAtoms:'100',transactionHash:h,logIndex:null};
const transfer='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const topic=a=>'0x'+'0'.repeat(24)+a.slice(2),data=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
function reader(mutator=()=>{},symbol='ETH'){
 const calls=[];const receipt={transactionHash:h,status:'0x1',blockNumber:'0x64',blockHash:bh,from,to,logs:symbol==='ETH'?[]:[{address:ETHEREUM_USDC,transactionHash:h,blockNumber:'0x64',blockHash:bh,removed:false,logIndex:'0x0',topics:[transfer,topic(from),topic(to)],data:data(100)}]};
 const tx={hash:h,from,to,blockHash:bh,blockNumber:'0x64',value:'0x64'};let blockReads=0;
 return {calls,request:async q=>{calls.push(q);let v;
  if(q.method==='eth_chainId')v='0x1';else if(q.method==='eth_getTransactionReceipt')v=structuredClone(receipt);
  else if(q.method==='eth_getTransactionByHash')v=structuredClone(tx);
  else if(q.method==='eth_getBlockByNumber'){blockReads++;v={number:q.params[0]==='finalized'?'0x65':'0x64',hash:bh};}
  else if(q.method==='eth_getCode')v='0x6000';else if(q.method==='eth_call')v=data(6);else throw Error('Unexpected write/read '+q.method);
  const changed=mutator(q,v,blockReads,calls.length);return changed===undefined?v:changed;
 }};
}
const forbidden=new Proxy({}, {get(){throw Error('OFF must not inspect provider');}});
assert.equal(publicFundedWorkBacking(forbidden,forbidden).financialActivation,false);
for(const symbol of ['ETH','USDC']){
 const r=reader(()=>{},symbol),p={...request,asset:symbol,logIndex:symbol==='ETH'?null:0};
 const observed=await observeFinalizedWorkTransfer(r,p);
 assert.equal(observed.amountAtoms,'100');assert.equal(observed.encumbranceVerified,false);assert.equal(observed.workBackingVerified,false);assert.equal(observed.allocationVerified,false);assert.equal(observed.recoveryVerified,false);
 assert.equal(observed.tokenAddress,symbol==='ETH'?null:ETHEREUM_USDC);assert(Object.isFrozen(observed));assert.match(observed.observationHash,/^[a-f0-9]{64}$/);
 assert.equal(r.calls.length,symbol==='ETH'?7:8);
 for(const q of r.calls)assert(!/send|sign|write/i.test(q.method));
}
const negatives=[
 ['wrongchain',(q,v)=>q.method==='eth_chainId'?'0x2':v],
 ['reverted',(q,v)=>{if(q.method==='eth_getTransactionReceipt')v.status='0x0';return v;}],
 ['pending',(q,v)=>q.method==='eth_getTransactionReceipt'?null:v],
 ['unfinalized',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]==='finalized')v.number='0x63';return v;}],
 ['headerdrift',(q,v)=>{if(q.method==='eth_getBlockByNumber'&&q.params[0]!=='finalized')v.hash='0x'+'5'.repeat(64);return v;}],
 ['recipient',(q,v)=>{if(q.method==='eth_getTransactionByHash')v.to=from;return v;}],
 ['amount',(q,v)=>{if(q.method==='eth_getTransactionByHash')v.value='0x63';return v;}],
 ['latechain',(q,v,b,n)=>q.method==='eth_chainId'&&n>1?'0x2':v],
 ['lateheader',(q,v,b)=>{if(q.method==='eth_getBlockByNumber'&&b===3)v.hash='0x'+'5'.repeat(64);return v;}],
];
for(const [name,mutate]of negatives)await assert.rejects(observeFinalizedWorkTransfer(reader(mutate),request),undefined,name);
for(const [name,mutate]of [
 ['token',(q,v)=>{if(q.method==='eth_getTransactionReceipt')v.logs[0].address=to;return v;}],
 ['duplicate',(q,v)=>{if(q.method==='eth_getTransactionReceipt')v.logs.push(v.logs[0]);return v;}],
 ['removed',(q,v)=>{if(q.method==='eth_getTransactionReceipt')v.logs[0].removed=true;return v;}],
 ['tokenamount',(q,v)=>{if(q.method==='eth_getTransactionReceipt')v.logs[0].data=data(99);return v;}],
 ['decimals',(q,v)=>q.method==='eth_call'?data(18):v],
 ['nocode',(q,v)=>q.method==='eth_getCode'?'0x':v],
 ['mint',(q,v)=>{if(q.method==='eth_getTransactionReceipt')v.logs[0].topics[1]=topic('0x'+'0'.repeat(40));return v;}],
])await assert.rejects(observeFinalizedWorkTransfer(reader(mutate,'USDC'),{...request,asset:'USDC',logIndex:0}),undefined,name);
for(const bad of [{...request,asset:'HOOD'},{...request,chainId:'4663'},{...request,verified:true},{...request,amountAtoms:'0'},{...request,amountAtoms:'1e3'},{...request,logIndex:0}]){
 const r=reader();await assert.rejects(observeFinalizedWorkTransfer(r,bad));assert.equal(r.calls.length,0);
}
console.log('fundedworkchainobservations PASS: honest offline RPC fixtures; finalized native/issuer-USDC observations, 22 negatives, OFF zero provider calls; no real backing/encumbrance/payment claim');
