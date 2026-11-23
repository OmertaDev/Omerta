// Synthetic owner17 and model RPC only. These events carry no proof/state authority.
import {encodeAbiParameters,encodeEventTopics,keccak256,toHex} from 'viem';
import {LeanIMT} from '@zk-kit/lean-imt';
import {createRecordEncryptionRuntime} from '../experiments/private-account-record/encryption.mjs';
import {syntheticRecord} from '../experiments/private-account-record/fixtures.mjs';
import {deploymentDomain,recordCommitment,recordFields,rolloverStatement} from '../experiments/private-account-record/record.mjs';
import {KERNEL_SOURCE_SHA256,RULES_COMMITMENT,H,nullifierOf,runtimeHash,kernelAbi,deployment} from '../src/canonical-record-format.mjs';
import {createCanonicalRecordIndexer} from '../src/canonical-record-indexer.mjs';
import {createCanonicalCurrentStatus} from '../src/canonical-record-current-status.mjs';
const hash=label=>keccak256(toHex(label)),hex=bytes=>toHex(bytes),zero='0x'+'0'.repeat(64);
export async function syntheticFixture(){
 const config={chainId:4663n,kernel:'0x'+'12'.repeat(20),kernelSourceSha256:KERNEL_SOURCE_SHA256,kernelRuntimeHash:runtimeHash('0x6001600055'),manifestHash:hash('canonical-record-fixture'),domain:0n,approvedSnapshotRoot:71n,maxValiditySeconds:3600n,deploymentBlock:1n,deploymentTransactionHash:hash('deploy'),
  verifier:{address:'0x'+'23'.repeat(20),runtimeHash:runtimeHash('0x6002600055')},poseidon:{address:'0x'+'34'.repeat(20),runtimeHash:runtimeHash('0x6003600055')},closure:[{address:'0x'+'45'.repeat(20),runtimeHash:runtimeHash('0x6004600055')}]};
 config.domain=deploymentDomain(config.chainId,config.kernel,config.manifestHash);
 const encryption=await createRecordEncryptionRuntime();
 try{
  const owner={authorizationPublicKey:await encryption.publicKey(11n),viewingPublicKey:await encryption.publicKey(17n)},old=syntheticRecord(config.domain,owner,{accountScope:101n,lifeScope:202n,noteSeed:303n,noteBlind:404n});
  const c0=recordCommitment(config.domain,old),s1=rolloverStatement({domain:config.domain,oldRoot:H(4004003n,H(config.domain,c0)),oldRecord:old,expiry:1800000000n,newSeed:501n,newBlind:601n});
  const s2=rolloverStatement({domain:config.domain,oldRoot:H(4004003n,H(config.domain,s1.outputCommitment)),oldRecord:s1.next,expiry:1800000000n,newSeed:502n,newBlind:602n});
  const alt=rolloverStatement({domain:config.domain,oldRoot:H(4004003n,H(config.domain,s1.outputCommitment)),oldRecord:s1.next,expiry:1800000000n,newSeed:503n,newBlind:603n});
  const s3=rolloverStatement({domain:config.domain,oldRoot:H(4004003n,H(config.domain,s2.outputCommitment)),oldRecord:s2.next,expiry:1800000000n,newSeed:504n,newBlind:604n});
  const snapshot=await encryption.encryptFields({domain:config.domain,purpose:'snapshot',recipientKey:owner.viewingPublicKey,fields:recordFields(old),ephemeralScalar:71n});
  const delta=async(s,k)=>encryption.encryptFields({domain:config.domain,purpose:'delta',recipientKey:owner.viewingPublicKey,fields:s.plaintext,ephemeralScalar:k});
  const d1=await delta(s1,81n),d2=await delta(s2,82n),da=await delta(alt,83n),d3=await delta(s3,84n);
  const base={number:0n,hash:hash('genesis'),parentHash:zero,timestamp:1799999900n};
  const makeHeader=(number,parent,label='a')=>({number:BigInt(number),hash:hash('block-'+number+'-'+label),parentHash:parent.hash,timestamp:base.timestamp+BigInt(number)});
  const h1=makeHeader(1,base),h2=makeHeader(2,h1),h3=makeHeader(3,h2),h4=makeHeader(4,h3),h5=makeHeader(5,h4),h6=makeHeader(6,h5);
  const indexer=createCanonicalRecordIndexer({deployment:config,baseHeader:base});indexer.applyBatch([{header:h1,transactions:[]}]);
  const publication=(header,index,commitment,encrypted,kind,marker,tag)=>{
   const leaf=H(4004003n,H(config.domain,commitment)),leaves=indexer.snapshot().publications.map(p=>p.leaf);leaves.push(leaf);
   // Use the actual pinned tree implementation through a separate scratch instance.
   const tree=indexer.snapshot().recordCount===0n?leaf:H(leaves[0],leaves[1]);
   return{header,transactions:[{hash:hash('transaction-'+tag),index:0n,status:'success',logs:[{index:0n,event:'RecordAppended',args:{index,commitment,packetDigest:encrypted.digest,leaf,root:tree,kind,packet:hex(encrypted.packet)}},{index:1n,event:kind===0?'SourceImported':'RecordRewrapped',args:marker}]}]};
  };
  const b1={header:h1,transactions:[]},b2=publication(h2,0n,c0,snapshot,0,{sourceImportId:9001n,commitment:c0},'snapshot');indexer.applyBatch([b2]);
  const b3=publication(h3,1n,s1.outputCommitment,d1,1,{nullifier:s1.nullifier,commitment:s1.outputCommitment,exclusiveExpirySeconds:s1.expiry},'first');indexer.applyBatch([b3]);
  const third=(header,s,encrypted,tag)=>{const b=publication(header,2n,s.outputCommitment,encrypted,1,{nullifier:s.nullifier,commitment:s.outputCommitment,exclusiveExpirySeconds:s.expiry},tag),tree=new LeanIMT(H,indexer.snapshot().publications.map(p=>p.leaf));tree.insert(b.transactions[0].logs[0].args.leaf);b.transactions[0].logs[0].args.root=tree.root;return b;};
  const b4=third(h4,s2,d2,'second'),a4=third(makeHeader(4,h3,'fork'),alt,da,'alternate'),a5={header:makeHeader(5,a4.header,'fork'),transactions:[]};
  const a6={header:makeHeader(6,a5.header,'fork'),transactions:[]};
  const p5=publication(makeHeader(5,h4,'pending'),3n,s3.outputCommitment,d3,1,{nullifier:s3.nullifier,commitment:s3.outputCommitment,exclusiveExpirySeconds:s3.expiry},'unconfirmed-third'),pendingTree=new LeanIMT(H,[...indexer.snapshot().publications.map(p=>p.leaf),b4.transactions[0].logs[0].args.leaf]);pendingTree.insert(p5.transactions[0].logs[0].args.leaf);p5.transactions[0].logs[0].args.root=pendingTree.root;
  return{config,base,blocks:[b1,b2,b3,b4,{header:h5,transactions:[]},{header:h6,transactions:[]}],pendingBlocks:[b1,b2,b3,b4,p5,{header:makeHeader(6,p5.header,'pending'),transactions:[]}],fork:[b1,b2,b3,a4,a5,a6],old,first:s1.next,second:s2.next,third:s3.next,alternate:alt.next,sourceImportId:9001n,finalNullifier:nullifierOf(config.domain,s2.next,s2.outputCommitment)};
 }finally{await encryption.destroy();}
}
export function modelRpc(fixture){
 let selected=fixture.blocks,blocks=selected,omit=false,receiptMismatch=false,chainId=fixture.config.chainId;const codeOverrides=new Map();
 const config=deployment(fixture.config),code=new Map([[config.kernel,'0x6001600055'],[config.verifier.address,'0x6002600055'],[config.poseidon.address,'0x6003600055'],[config.closure[0].address,'0x6004600055']]);
 let views,receipts,logs;function rebuild(){
  views=new Map();receipts=new Map();logs=[];const i=createCanonicalRecordIndexer({deployment:config,baseHeader:fixture.base});
  for(const b of blocks){i.applyBatch([b]);views.set(b.header.number,i.snapshot());for(const t of b.transactions){
   const abi=kernelAbi(config),raw=t.logs.map(l=>{const event=abi.find(e=>e.type==='event'&&e.name===l.event),plain=event.inputs.filter(e=>!e.indexed);return{address:config.kernel,blockNumber:b.header.number,blockHash:b.header.hash,transactionHash:t.hash,transactionIndex:t.index,logIndex:l.index,removed:false,topics:encodeEventTopics({abi,eventName:l.event,args:l.args}),data:encodeAbiParameters(plain,plain.map(e=>l.args[e.name]))};});
   logs.push(...raw);receipts.set(t.hash,{transactionHash:t.hash,transactionIndex:t.index,blockNumber:b.header.number,blockHash:b.header.hash,status:'success',logs:raw});
  }}
  receipts.set(config.deploymentTransactionHash,{transactionHash:config.deploymentTransactionHash,contractAddress:config.kernel,blockNumber:1n,blockHash:blocks[0].header.hash,status:'success',logs:[]});
 }rebuild();
 const client={async getChainId(){return Number(chainId);},async getBlock({blockNumber,blockTag}){if(blockTag==='latest')return structuredClone(blocks.at(-1).header);if(blockNumber===0n)return structuredClone(fixture.base);const b=blocks.find(b=>b.header.number===blockNumber);if(!b)throw new Error('Missing synthetic block');return structuredClone(b.header);},
  async getCode({address}){return codeOverrides.get(address)||code.get(address);},
  async getLogs({fromBlock,toBlock}){const found=logs.filter(l=>l.blockNumber>=fromBlock&&l.blockNumber<=toBlock);return structuredClone(omit?found.slice(0,-1):found);},
  async getTransactionReceipt({hash}){const r=structuredClone(receipts.get(hash));if(!r)throw new Error('Missing synthetic receipt');if(receiptMismatch&&hash!==config.deploymentTransactionHash)r.blockHash=hashLabel('wrong-block');return r;},
  async readContract({functionName:name,args=[],blockNumber}){
   const s=views.get(blockNumber);if(!s)throw new Error('Missing synthetic view');
   const fixed={deploymentChainId:config.chainId,manifestHash:config.manifestHash,domain:config.domain,RULES_COMMITMENT,CURRENT_INDEX_SCHEMA:2036000n,approvedSnapshotRoot:config.approvedSnapshotRoot,maxValiditySeconds:config.maxValiditySeconds,verifier:config.verifier.address,verifierRuntimeHash:config.verifier.runtimeHash,poseidonRuntimeHash:config.poseidon.runtimeHash,closureCount:BigInt(config.closure.length),recordCount:s.recordCount,recordRoot:s.recordRoot};if(Object.hasOwn(fixed,name))return fixed[name];
   if(name==='currentNullifierRoot')return s.currentNullifiers.root;if(name==='currentNullifierCount')return s.currentNullifiers.count;
   if(name==='transitionContextRoot')return s.transitionContexts.root;if(name==='transitionContextCount')return s.transitionContexts.count;
   if(name==='isKnownTransitionContextRoot')return args[0]===s.transitionContexts.root||s.publications.some(p=>p.transitionContext?.root===args[0]);
   if(name==='transitionContext'){const r=s.publications.find(p=>p.nullifier===args[0]&&p.transitionContext);return r?[true,r.commitment,r.blockTimestamp,r.transitionContext.index]:[false,0n,0n,0n];}
   if(name==='closurePin')return{dependency:config.closure[Number(args[0])].address,runtimeHash:config.closure[Number(args[0])].runtimeHash};
   if(name==='isKnownRoot')return s.publications.some(p=>p.root===args[0]);
   if(name==='commitmentUsed')return s.publications.some(p=>p.commitment===args[0]);if(name==='packetUsed')return s.publications.some(p=>p.packetDigest===args[0]);if(name==='sourceImported')return s.publications.some(p=>p.sourceImportId===args[0]);
   if(name==='nullifierState')return[s.publications.some(p=>p.nullifier===args[0]),zero];throw new Error('Unknown synthetic call '+name);
  }};
 return{client,setFork(){selected=fixture.fork;blocks=selected;rebuild();},omitLogs(v){omit=v;},mismatchReceipt(v){receiptMismatch=v;},wrongChain(v){chainId=v;},changeCode(a,c){if(c===null)codeOverrides.delete(a);else codeOverrides.set(a,c);},spendAtTip(nf){if(nf!==fixture.finalNullifier)throw new Error('Unsupported synthetic pending spend');blocks=fixture.pendingBlocks;rebuild();},clearTipSpend(){blocks=selected;rebuild();}};
}
const hashLabel=hash;
export function currentFixture(fixture){
 const f=structuredClone(fixture),source=hash('SYNTHETIC-current-kernel-model-not-actual-contract').slice(2);f.config.kernelSourceSha256=source;f.config.kernelProfile={id:'canonical26-current-v1',kernelSourceSha256:source};
 const extend=blocks=>{const status=createCanonicalCurrentStatus(f.config.domain),contextLeaves=[];for(const b of blocks)for(const t of b.transactions){const marker=t.logs.at(-1);if(marker.event!=='RecordRewrapped')continue;const m=marker.args,s=status.candidate(m.nullifier);status.consume(s);let leaf=H(2037000n,f.config.domain);for(const v of [BigInt(contextLeaves.length),m.nullifier,m.commitment,b.header.timestamp])leaf=H(leaf,v);contextLeaves.push(leaf);const raw=new LeanIMT(H,contextLeaves).root;let root=H(2037001n,f.config.domain);root=H(root,BigInt(contextLeaves.length));root=H(root,raw);
  const append=t.logs[0];append.index=2n;marker.index=3n;t.logs=[{index:0n,event:'CurrentNullifierUpdated',args:s},{index:1n,event:'TransitionContextRecorded',args:{nullifier:m.nullifier,outputCommitment:m.commitment,acceptedAtSeconds:b.header.timestamp,index:BigInt(contextLeaves.length-1),leaf,root}},append,marker];}return blocks;};
 f.blocks=extend(structuredClone(fixture.blocks));f.fork=extend(structuredClone(fixture.fork));f.pendingBlocks=extend(structuredClone(fixture.pendingBlocks));return f;
}
