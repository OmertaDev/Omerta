// Public canonical26 publications only. Caller supplies canonical confirmed receipt data.
import {LeanIMT} from '@zk-kit/lean-imt';
import {H,fail,data,array,uint,field,hash,freeze,header,deployment,packetHex,packetDigest,isCurrentKernel} from './canonical-record-format.mjs';
import {createCanonicalCurrentStatus} from './canonical-record-current-status.mjs';
const MAX_LEAVES=1n<<32n;
const U32=(1n<<32n)-1n;
function captureLog(input){
 const p=data(input,['index','event','args']);const index=uint(p.index,U32);
 if(p.event==='RecordAppended'){
  const a=data(p.args,['index','commitment','packetDigest','leaf','root','kind','packet']),kind=Number(uint(a.kind,1n));
  return freeze({index,event:p.event,args:{index:uint(a.index,MAX_LEAVES-1n),commitment:field(a.commitment),packetDigest:field(a.packetDigest),leaf:field(a.leaf),root:field(a.root),kind,packet:packetHex(kind,a.packet)}});
 }
 if(p.event==='SourceImported'){const a=data(p.args,['sourceImportId','commitment']);return freeze({index,event:p.event,args:{sourceImportId:field(a.sourceImportId),commitment:field(a.commitment)}});}
 if(p.event==='RecordRewrapped'){const a=data(p.args,['nullifier','commitment','exclusiveExpirySeconds']);return freeze({index,event:p.event,args:{nullifier:field(a.nullifier),commitment:field(a.commitment),exclusiveExpirySeconds:field(a.exclusiveExpirySeconds)}});}
 if(p.event==='CurrentNullifierUpdated'){const a=data(p.args,['nullifier','spent','reservation','index','root','count']);if(typeof a.spent!=='boolean')fail('invalid_current_nullifier_write');return freeze({index,event:p.event,args:{nullifier:field(a.nullifier),spent:a.spent,reservation:hash(a.reservation,true),index:uint(a.index,U32),root:field(a.root),count:uint(a.count,MAX_LEAVES)}});}
 if(p.event==='TransitionContextRecorded'){const a=data(p.args,['nullifier','outputCommitment','acceptedAtSeconds','index','leaf','root']);return freeze({index,event:p.event,args:{nullifier:field(a.nullifier),outputCommitment:field(a.outputCommitment),acceptedAtSeconds:uint(a.acceptedAtSeconds,(1n<<64n)-1n),index:uint(a.index,MAX_LEAVES-1n),leaf:field(a.leaf),root:field(a.root)}});}
 fail('unknown_kernel_event');
}
function captureBlock(input){
 const p=data(input,['header','transactions']);const h=header(p.header),transactions=array(p.transactions,4096).map(input=>{
  const t=data(input,['hash','index','status','logs']);if(t.status!=='success')fail('unconfirmed_receipt');
  return freeze({hash:hash(t.hash),index:uint(t.index,U32),status:'success',logs:array(t.logs,8192).map(captureLog)});
 });return freeze({header:h,transactions});
}
function replay(config,base,blocks){
 const tree=new LeanIMT(H),publications=[],roots=new Set(),sources=new Map(),rewraps=new Map(),commitments=new Map(),packets=new Set(),txs=new Set();let previous=base;
 const current=isCurrentKernel(config)?createCanonicalCurrentStatus(config.domain):null,contexts=new LeanIMT(H);
 const fold=(tag,values)=>{let n=H(tag,config.domain);for(const v of values)n=H(n,v);return n;};
 const contextRoot=()=>fold(2037001n,[BigInt(contexts.size),contexts.root||0n]);
 for(const b of blocks){
  const h=b.header;if(h.number!==previous.number+1n||h.parentHash!==previous.hash||h.timestamp<previous.timestamp)fail('noncanonical_block_chain');
  let lastTx=-1n,lastLog=-1n;
  for(const t of b.transactions){
   if(t.index<=lastTx||txs.has(t.hash)||t.logs.length===0||t.logs.length%2)fail('invalid_transaction_order');lastTx=t.index;txs.add(t.hash);
   for(let i=0;i<t.logs.length;){
    const extended=current&&t.logs[i].event==='CurrentNullifierUpdated',length=extended?4:2,group=t.logs.slice(i,i+length);
    if(group.length!==length)fail('invalid_event_pair');for(const log of group){if(log.index<=lastLog)fail('invalid_event_pair');lastLog=log.index;}
    const append=group[length-2],marker=group[length-1];if(append.event!=='RecordAppended')fail('invalid_event_pair');i+=length;
    const a=append.args;if(a.index!==BigInt(publications.length)||a.index>=MAX_LEAVES||commitments.has(String(a.commitment))||packets.has(String(a.packetDigest)))fail('duplicate_or_missing_record');
    if(packetDigest(config.domain,a.kind,a.packet)!==a.packetDigest||H(4004003n,H(config.domain,a.commitment))!==a.leaf)fail('invalid_publication_digest');
    const m=marker.args;if(m.commitment!==a.commitment)fail('mismatched_event_pair');
    let currentStatus=null,transitionContext=null;
    if(a.kind===0){if(extended||marker.event!=='SourceImported'||sources.has(String(m.sourceImportId)))fail('duplicate_source_marker');sources.set(String(m.sourceImportId),publications.length);}
    else{
     if(marker.event!=='RecordRewrapped'||rewraps.has(String(m.nullifier)))fail('duplicate_nullifier');
     if(current&&!extended)fail('missing_current_context_pair');
     if(m.exclusiveExpirySeconds>(1n<<64n)-1n||m.exclusiveExpirySeconds<=h.timestamp||m.exclusiveExpirySeconds-h.timestamp>config.maxValiditySeconds)fail('invalid_seconds_expiry');
     if(extended){
      const status=group[0].args,c=group[1].args;if(group[1].event!=='TransitionContextRecorded'||status.nullifier!==m.nullifier||c.nullifier!==m.nullifier||c.outputCommitment!==a.commitment||c.acceptedAtSeconds!==h.timestamp||c.index!==BigInt(contexts.size))fail('mismatched_transition_context');
      const leaf=fold(2037000n,[c.index,m.nullifier,a.commitment,h.timestamp]);if(c.leaf!==leaf)fail('mismatched_transition_leaf');
      current.consume(status);contexts.insert(leaf);if(c.root!==contextRoot())fail('mismatched_transition_root');
      currentStatus={index:status.index,root:status.root,count:status.count};transitionContext={index:c.index,acceptedAtSeconds:c.acceptedAtSeconds,leaf:c.leaf,root:c.root};
     }
     rewraps.set(String(m.nullifier),publications.length);
    }
    tree.insert(a.leaf);if(tree.root!==a.root)fail('mismatched_record_root');roots.add(String(a.root));packets.add(String(a.packetDigest));commitments.set(String(a.commitment),publications.length);
    publications.push(freeze({...a,sourceImportId:a.kind===0?m.sourceImportId:null,nullifier:a.kind===1?m.nullifier:null,exclusiveExpirySeconds:a.kind===1?m.exclusiveExpirySeconds:null,blockNumber:h.number,blockHash:h.hash,blockTimestamp:h.timestamp,transactionHash:t.hash,transactionIndex:t.index,logIndex:append.index,currentStatus,transitionContext}));
   }
  }previous=h;
 }
 return{tree,publications,roots,sources,rewraps,commitments,tip:previous,current,transitionContexts:current?freeze({root:contextRoot(),count:BigInt(contexts.size)}):null};
}
export function createCanonicalRecordIndexer(configuration){
 const p=data(configuration,['deployment','baseHeader']);const config=deployment(p.deployment),base=header(p.baseHeader);
 if(base.number+1n!==config.deploymentBlock)fail('invalid_deployment_base');
 let blocks=[],state=replay(config,base,blocks),revision=0;
 function captureBatch(value){return array(value,512).map(captureBlock);}
 function commit(next){const checked=replay(config,base,next);blocks=next;state=checked;revision++;return snapshot();}
 function applyBatch(value){const added=captureBatch(value);if(!added.length)fail('empty_batch');return commit([...blocks,...added]);}
 function reconcileBatch(input){
  const p=data(input,['ancestor','blocks']),a=data(p.ancestor,['number','hash']),number=uint(a.number,(1n<<64n)-1n),blockHash=hash(a.hash),added=captureBatch(p.blocks);
  const at=number===base.number?base:blocks.find(b=>b.header.number===number)?.header;
  if(!at||at.hash!==blockHash||state.tip.number-number>128n)fail('unknown_reorg_ancestor');
  return commit([...blocks.filter(b=>b.header.number<=number),...added]);
 }
 function snapshot(){return freeze({format:'omerta:canonical26:public-index:v1',deployment:config,baseHeader:base,tip:state.tip,revision,recordRoot:state.tree.root||0n,recordCount:BigInt(state.publications.length),publications:[...state.publications],headers:blocks.map(b=>b.header),currentNullifiers:state.current?state.current.snapshot():null,transitionContexts:state.transitionContexts});}
 function publication(index){const i=uint(index,MAX_LEAVES-1n);const p=state.publications[Number(i)];if(!p)fail('unknown_publication');return p;}
 function source(sourceImportId){const index=state.sources.get(String(field(sourceImportId)));if(index===undefined)fail('unknown_source_import');return publication(index);}
 function successor(nullifier){const index=state.rewraps.get(String(field(nullifier)));return index===undefined?null:publication(index);}
 function witness(index){const i=uint(index,MAX_LEAVES-1n);publication(i);const proof=state.tree.generateProof(Number(i));return freeze({root:proof.root,index:proof.index,siblings:[...proof.siblings]});}
 function currentWitness(nullifier){if(!state.current)fail('current_status_not_applicable');return state.current.witness(nullifier);}
 return Object.freeze({applyBatch,reconcileBatch,snapshot,publication,source,successor,witness,currentWitness});
}
