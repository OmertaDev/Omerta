// Public projection for consume-only CurrentNullifierIndex; not a private-read proof.
import {H,fail,data,uint,field,hash,freeze} from './canonical-record-format.mjs';
const ZERO='0x'+'0'.repeat(64),MAX=1n<<32n;
const fold=(tag,domain,values)=>{let x=H(tag,domain);for(const v of values)x=H(x,v);return x;};
export function createCanonicalCurrentStatus(domainInput){
 const domain=field(domainInput),empty=H(2036002n,domain),zeroes=[empty];for(let i=0;i<32;i++)zeroes.push(H(zeroes[i],zeroes[i]));
 let count=1n,entries=new Map([['0',{index:0n,nullifier:0n,nextIndex:0n,nextNullifier:0n,spent:false,reservation:ZERO}]]),nodes=new Map();
 const leaf=e=>fold(2036001n,domain,[e.nullifier,e.nextIndex,e.nextNullifier,e.spent?1n:0n,BigInt(e.reservation)>>128n,BigInt(e.reservation)&((1n<<128n)-1n)]);
 const get=(map,level,index)=>map.get(level+':'+index)??zeroes[level];
 function write(map,entry){let index=entry.index,value=leaf(entry);map.set('0:'+index,value);for(let level=0;level<32;level++){value=index&1n?H(get(map,level,index-1n),value):H(value,get(map,level,index+1n));index>>=1n;map.set((level+1)+':'+index,value);}}
 write(nodes,entries.get('0'));
 const wrap=(n,map)=>H(2036003n,H(domain,H(n,get(map,32,0n))));
 function consume(input){
  const p=data(input,['nullifier','spent','reservation','index','root','count']),nf=field(p.nullifier),index=uint(p.index,MAX-1n),newCount=uint(p.count,MAX),expectedRoot=field(p.root);
  if(p.spent!==true||hash(p.reservation,true)!==ZERO||entries.has(String(nf))||index!==count||newCount!==count+1n||count>=MAX)fail('invalid_current_nullifier_write');
  let predecessor=entries.get('0');for(const e of entries.values())if(e.nullifier<nf&&e.nullifier>predecessor.nullifier)predecessor=e;
  if(predecessor.nextNullifier!==0n&&predecessor.nextNullifier<=nf)fail('invalid_current_nullifier_order');
  const updated={...predecessor,nextIndex:index,nextNullifier:nf},added={index,nullifier:nf,nextIndex:predecessor.nextIndex,nextNullifier:predecessor.nextNullifier,spent:true,reservation:ZERO},newNodes=new Map(nodes);
  write(newNodes,updated);write(newNodes,added);if(wrap(newCount,newNodes)!==expectedRoot)fail('mismatched_current_nullifier_root');
  entries=new Map(entries);entries.set(String(updated.nullifier),updated);entries.set(String(nf),added);nodes=newNodes;count=newCount;return snapshot();
 }
 function candidate(nullifier){const nf=field(nullifier);if(entries.has(String(nf))||count>=MAX)fail('invalid_current_nullifier_write');let predecessor=entries.get('0');for(const e of entries.values())if(e.nullifier<nf&&e.nullifier>predecessor.nullifier)predecessor=e;const map=new Map(nodes),index=count;write(map,{...predecessor,nextIndex:index,nextNullifier:nf});write(map,{index,nullifier:nf,nextIndex:predecessor.nextIndex,nextNullifier:predecessor.nextNullifier,spent:true,reservation:ZERO});return freeze({nullifier:nf,spent:true,reservation:ZERO,index,root:wrap(count+1n,map),count:count+1n});}
 function witness(nullifier){const nf=field(nullifier);let entry=entries.get(String(nf));const exists=!!entry;if(!entry){entry=entries.get('0');for(const e of entries.values())if(e.nullifier<nf&&e.nullifier>entry.nullifier)entry=e;if(entry.nextNullifier!==0n&&entry.nextNullifier<=nf)fail('invalid_current_nullifier_order');}let index=entry.index;const siblings=[];for(let level=0;level<32;level++){siblings.push(get(nodes,level,index^1n));index>>=1n;}return freeze({domain,root:wrap(count,nodes),count,nullifier:nf,exists,entry:{...entry},siblings});}
 function snapshot(){return freeze({domain,root:wrap(count,nodes),count,entries:[...entries.values()].map(e=>({...e}))});}
 return Object.freeze({consume,candidate,witness,snapshot});
}
