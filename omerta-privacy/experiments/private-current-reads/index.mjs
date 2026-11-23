// Deterministic public WRITE replay and private lookup/write witness builder.
// No permission, source/head uniqueness, current-world fact or pending policy.
import {H,field} from '../private-character-eligibility/values.mjs';
export const FIELD=21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const DEPTH=32,CAPACITY=2**32;
export const TAG=Object.freeze({leaf:2036001n,empty:2036002n,root:2036003n});
export const ZERO_RESERVATION='0x'+'0'.repeat(64);
const need=(ok,message)=>{if(!ok)throw new TypeError(message);};
const key=v=>field(v,true),word=v=>field(v),u32=v=>{need(Number.isSafeInteger(v)&&v>=0&&v<2**32,'Canonical u32 required');return v;};
const reservation=v=>{need(typeof v==='string'&&/^0x[0-9a-f]{64}$/.test(v),'Canonical bytes32 reservation required');return BigInt(v);};
const hex=v=>'0x'+v.toString(16).padStart(64,'0');
export const wrappedRoot=(domain,count,merkle)=>{domain=key(domain);need(Number.isSafeInteger(count)&&count>=1&&count<=CAPACITY,'Canonical tree count required');return H(TAG.root,H(domain,H(BigInt(count),word(merkle))));};
export function leafHash(domain,node){
 const nf=word(node.nullifier),next=word(node.nextNullifier),nextIndex=u32(node.nextIndex),r=reservation(node.reservation);need(typeof node.spent==='boolean','Explicit spent flag required');
 need(!node.spent||r===0n,'Spent leaf cannot remain reserved');need((next===0n)===(nextIndex===0),'Terminal pointer mismatch');need(next===0n||nf<next,'Nonascending pointer');
 need(nf!==0n||!node.spent&&r===0n,'Sentinel status must be free');
 return[nf,BigInt(nextIndex),next,node.spent?1n:0n,r>>128n,r&((1n<<128n)-1n)].reduce((n,v)=>H(n,v),H(TAG.leaf,key(domain)));
}
function emptyLayers(domain){const result=[H(TAG.empty,domain)];for(let i=0;i<DEPTH;i++)result.push(H(result[i],result[i]));return result;}
function update(nodes,empty,index,value){let cursor=index;nodes[0].set(cursor,value);for(let level=0;level<DEPTH;level++){
 const pair=cursor%2===0?cursor+1:cursor-1,left=(cursor&1)?(nodes[level].get(pair)??empty[level]):(nodes[level].get(cursor)??empty[level]),right=(cursor&1)?(nodes[level].get(cursor)??empty[level]):(nodes[level].get(pair)??empty[level]);
 cursor=Math.floor(cursor/2);nodes[level+1].set(cursor,H(left,right));}}
function siblings(nodes,empty,index){let cursor=index;const result=[];for(let level=0;level<DEPTH;level++){result.push(String(nodes[level].get(cursor%2===0?cursor+1:cursor-1)??empty[level]));cursor=Math.floor(cursor/2);}return result;}
export class PublicNullifierIndex {
 constructor(domain){this.domain=key(domain);this.count=1;this.empty=emptyLayers(this.domain);this.nodes=Array.from({length:DEPTH+1},()=>new Map());
  this.entries=new Map([['0',{index:0,nullifier:0n,nextIndex:0,nextNullifier:0n,spent:false,reservation:ZERO_RESERVATION}]]);update(this.nodes,this.empty,0,leafHash(this.domain,this.entries.get('0')));}
 get root(){return wrappedRoot(this.domain,this.count,this.nodes[DEPTH].get(0)??this.empty[DEPTH]);}
 clone(){const result=Object.create(PublicNullifierIndex.prototype);result.domain=this.domain;result.count=this.count;result.empty=[...this.empty];result.nodes=this.nodes.map(n=>new Map(n));result.entries=new Map([...this.entries].map(([k,v])=>[k,{...v}]));return result;}
 state(nf){nf=key(nf);const e=this.entries.get(String(nf));return e?{spent:e.spent,reservation:e.reservation}:{spent:false,reservation:ZERO_RESERVATION};}
 lower(nf){nf=key(nf);let low=this.entries.get('0');for(const n of this.entries.values())if(n.nullifier<nf&&n.nullifier>low.nullifier)low=n;return low;}
 path(node){return{index:node.index,nextIndex:node.nextIndex,nextNullifier:String(node.nextNullifier),siblings:siblings(this.nodes,this.empty,node.index)};}
 writeProof(nf){nf=key(nf);const node=this.entries.get(String(nf));if(node)return{exists:true,predecessor:'0',path:this.path(node),appendSiblings:Array(DEPTH).fill('0')};
  need(this.count<CAPACITY,'Index full');const low=this.lower(nf),changed={...low,nextIndex:this.count,nextNullifier:nf},nodes=this.nodes.map(n=>new Map(n));update(nodes,this.empty,low.index,leafHash(this.domain,changed));
  return{exists:false,predecessor:String(low.nullifier),path:this.path(low),appendSiblings:siblings(nodes,this.empty,this.count)};}
 lookup(nf){nf=key(nf);const own=this.entries.get(String(nf)),node=own??this.lower(nf);return{domain:String(this.domain),currentRoot:String(this.root),count:this.count,query:String(nf),exists:!!own,
  node:{nullifier:String(node.nullifier),nextIndex:node.nextIndex,nextNullifier:String(node.nextNullifier),spent:node.spent,reservation:node.reservation},path:this.path(node)};}
 apply(operation,nf,reservationId=ZERO_RESERVATION){
  nf=key(nf);const r=reservation(reservationId),old=this.state(nf);let spent=old.spent,nextReservation=old.reservation;
  if(operation==='consume'||operation==='reserve'){need(!old.spent&&old.reservation===ZERO_RESERVATION,'Nullifier unavailable');
   if(operation==='reserve'){need(r!==0n,'Zero reservation');nextReservation=hex(r);}else{need(r===0n,'Direct consume takes no reservation');spent=true;}}
  else if(operation==='consumeReserved'||operation==='releaseReserved'){need(r!==0n&&!old.spent&&old.reservation===hex(r),'Reservation mismatch');nextReservation=ZERO_RESERVATION;spent=operation==='consumeReserved';}
  else throw new TypeError('Unknown operation');
  let node=this.entries.get(String(nf));if(!node){need(this.count<CAPACITY,'Index full');const low=this.lower(nf);node={index:this.count,nullifier:nf,nextIndex:low.nextIndex,nextNullifier:low.nextNullifier,spent,reservation:nextReservation};
   low.nextIndex=node.index;low.nextNullifier=nf;update(this.nodes,this.empty,low.index,leafHash(this.domain,low));this.entries.set(String(nf),node);this.count++;}
  else{node.spent=spent;node.reservation=nextReservation;}
  update(this.nodes,this.empty,node.index,leafHash(this.domain,node));return{nullifier:String(nf),spent,reservation:nextReservation,index:node.index,root:String(this.root),count:this.count};
 }
 // Strict consume-only event replay for the new preservation-only consumer.
 applyConsumedEvent(event){need(event.spent===true&&event.reservation===ZERO_RESERVATION,'Non-consume event in preservation profile');need(!this.entries.has(String(key(event.nullifier))),'Duplicate NF event');
  const draft=this.clone(),result=draft.apply('consume',event.nullifier);for(const k of ['index','count'])need(result[k]===event[k],'Event '+k+' mismatch');need(result.root===String(word(event.root)),'Event root mismatch');
  this.count=draft.count;this.nodes=draft.nodes;this.entries=draft.entries;return result;}
}
export function verifyLookup(w,{requireAvailable=false}={}){
 const domain=key(w.domain),query=key(w.query),count=w.count,n=w.node,p=w.path;need(typeof w.exists==='boolean','Explicit lookup mode required');need(count>=1&&count<=CAPACITY&&Number.isSafeInteger(count),'Tree count');
 const nf=word(n.nullifier),next=word(n.nextNullifier);u32(p.index);need(p.index<count&&((nf===0n)===(p.index===0)),'Leaf index');need(n.nextIndex<count,'Next index');need(p.nextIndex===n.nextIndex&&word(p.nextNullifier)===next,'Path metadata mismatch');
 need(Array.isArray(p.siblings)&&p.siblings.length===DEPTH,'Exact depth32');let node=leafHash(domain,n),cursor=p.index;
 for(const s of p.siblings){const sibling=word(s);node=(cursor&1)?H(sibling,node):H(node,sibling);cursor=Math.floor(cursor/2);}need(wrappedRoot(domain,count,node)===word(w.currentRoot),'Lookup root mismatch');
 if(w.exists){need(nf===query&&!n.spent,'Spent/wrong member');if(requireAvailable)need(n.reservation===ZERO_RESERVATION,'Reserved input');}
 else need(nf<query&&(next===0n||query<next),'False absence');
 return true;
}
const splitKey=v=>{const x=word(v);return{hi:String(x>>128n),lo:String(x&((1n<<128n)-1n))};};
export function noirLookup(w){verifyLookup(w);const r=reservation(w.node.reservation);return{exists:w.exists,index:w.path.index,key:splitKey(w.node.nullifier),next_index:w.node.nextIndex,next:splitKey(w.node.nextNullifier),spent:w.node.spent,
 reservation_hi:String(r>>128n),reservation_lo:String(r&((1n<<128n)-1n)),siblings:[...w.path.siblings]};}
export const noirKey=splitKey;
