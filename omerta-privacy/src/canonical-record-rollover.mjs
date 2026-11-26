// Inert owner-side preparation for the existing preservation-only current kernel.
// The contract verifies the proof. This does not authorize mutable game actions.
import {encodeFunctionData,parseAbi} from 'viem';
import {decryptOwnedRecordDelta} from '../experiments/private-record-recovery-ownership/guarded.mjs';
import {recordCommitment} from '../experiments/private-account-record/record.mjs';
import {PublicNullifierIndex,ZERO_RESERVATION} from '../experiments/private-current-reads/index.mjs';
import {fail,data,array,uint,field,freeze,deployment,isCurrentKernel,ownedRecord,ownedPublication,packetHex,packetBytes,packetDigest,nullifierOf} from './canonical-record-format.mjs';

export const CANONICAL_ROLLOVER_ABI=parseAbi([
 'function rollover(bytes proof,uint256[6] inputs,bytes packet,(bool exists,uint256 predecessor,(uint32 index,uint32 nextIndex,uint256 nextNullifier,uint256[32] siblings) path,uint256[32] appendSiblings) statusWitness)'
]);
function proofBytes(value){
 if(typeof value!=='string'||value.length<66||value.length>65538||!/^0x[0-9a-f]+$/.test(value)||(value.length-2)%64)fail('invalid_rollover_proof');
 return value;
}
function timeWindow(inputs,anchor,config){
 const now=uint(anchor.observedTip.timestamp,(1n<<64n)-1n),expiry=uint(inputs[5],(1n<<64n)-1n);
 if(expiry<=now||expiry-now>config.maxValiditySeconds)fail('invalid_rollover_expiry');
}
function currentRoot(anchor,domain){
 const c=anchor.currentStatus;
 if(!c||c.sameRootAsObservedTip!==true||c.privateReadProofVerified!==false||field(c.witness.domain)!==domain||c.witness.exists!==false)fail('stale_rollover_status');
 const root=field(c.confirmedRoot),count=uint(c.confirmedCount,1n<<32n);
 if(root!==field(c.observedTipRoot)||count!==uint(c.observedTipCount,1n<<32n)||c.witness.root!==root||c.witness.count!==count)fail('stale_rollover_status');
 return{root,count};
}

export function createCanonicalRecordRollover(options){
 const p=data(options,['reconciler']),rpc=p.reconciler;
 for(const name of ['sync','snapshot','recheck'])if(typeof rpc?.[name]!=='function')fail('invalid_reconciler');
 let busy=false;
 async function prepare(input){
  // Own caller data before the first await. Never accept a caller-selected target,
  // value, status witness, output hash or local "proof verified" flag.
  const p=data(input,['record','anchor','proof','inputs','packet','recipientSecret']);
  const record=ownedRecord(p.record),anchor=p.anchor,proof=proofBytes(p.proof),packet=packetHex(1,p.packet),recipientSecret=field(p.recipientSecret),inputs=array(p.inputs,6).map(field);
  if(inputs.length!==6)fail('invalid_rollover_inputs');
  if(busy)fail('rollover_busy');busy=true;
  try{
   await rpc.sync();
   const view=rpc.snapshot(),config=deployment(view.deployment),publications=array(view.publications,2**32).map(ownedPublication),recordRoot=field(view.recordRoot);
   if(!isCurrentKernel(config))fail('unsupported_rollover_profile');
   const checked=await rpc.recheck(anchor),oldC=recordCommitment(config.domain,record),nf=nullifierOf(config.domain,record,oldC);
   if(checked.domain!==config.domain||checked.chainId!==config.chainId||checked.kernel!==config.kernel||checked.manifestHash!==config.manifestHash||checked.commitment!==oldC||checked.nullifier!==nf)fail('wrong_rollover_anchor');
   if(inputs[0]!==config.domain||inputs[1]!==checked.recordRoot||inputs[1]!==recordRoot||inputs[2]!==nf)fail('wrong_rollover_context');
   if(!publications.some(r=>r.commitment===oldC))fail('unknown_rollover_input');
   if(publications.some(r=>r.commitment===inputs[3]||r.packetDigest===inputs[4]))fail('reused_rollover_output');
   if(packetDigest(config.domain,1,packet)!==inputs[4])fail('wrong_rollover_packet');
   const status=currentRoot(checked,config.domain);
   timeWindow(inputs,checked,config);
   // Rebuild the exact public consume-only history; the append path must be
   // AFTER predecessor update, not a copied absence path from an older root.
   const replay=new PublicNullifierIndex(config.domain);
   for(const publication of publications){
    if(publication.kind!==1)continue;
    const s=publication.currentStatus;
    if(!s)fail('missing_rollover_status');
    replay.applyConsumedEvent({nullifier:publication.nullifier,spent:true,reservation:ZERO_RESERVATION,index:Number(s.index),root:s.root,count:Number(s.count)});
   }
   if(replay.root!==status.root||BigInt(replay.count)!==status.count)fail('wrong_rollover_status_root');
   if(replay.entries.has(String(nf)))fail('rollover_input_spent');
   const witness=replay.writeProof(nf);
   // The exact published bytes must decrypt for the old record's authenticated
   // view key and preserve every state root/resource/clock, with a new sequence.
   // Neither a caller-provided digest nor matching calldata alone proves this.
   await decryptOwnedRecordDelta({domain:config.domain,oldRecord:record,packet:packetBytes(packet),recipientSecret,expectedDigest:inputs[4],expectedCommitment:inputs[3]});
   const final=await rpc.recheck(anchor),fresh=currentRoot(final,config.domain);
   if(fresh.root!==status.root||fresh.count!==status.count||final.commitment!==oldC||final.nullifier!==nf||final.recordRoot!==inputs[1])fail('rollover_context_changed');
   timeWindow(inputs,final,config);
   const calldata=encodeFunctionData({abi:CANONICAL_ROLLOVER_ABI,functionName:'rollover',args:[proof,inputs,packet,witness]});
   return freeze({chainId:config.chainId,call:{to:config.kernel,data:calldata,value:'0x0'},inputs:[...inputs],expectedOutputCommitment:inputs[3],observedBlock:final.observedTip,scope:'preservation-only unsigned rollover; no mutable gameplay or backing authority',gasPayer:'player',proofVerifiedLocally:false});
  }finally{busy=false;}
 }
 return Object.freeze({prepare});
}
