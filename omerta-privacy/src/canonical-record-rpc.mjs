// Read-only RPC reconciliation. RPC canonicality/finality and approval admission remain trust boundaries.
import {decodeEventLog} from 'viem';
import {createCanonicalRecordIndexer} from './canonical-record-indexer.mjs';
import {RULES_COMMITMENT,fail,data,array,member,uint,field,hash,address,freeze,header,deployment,runtimeHash,ownedRecord,nullifierOf,kernelAbi,isCurrentKernel} from './canonical-record-format.mjs';
import {recordCommitment} from '../experiments/private-account-record/record.mjs';
const ZERO='0x'+'0'.repeat(64);
const rpcHeader=b=>header({number:member(b,'number'),hash:member(b,'hash'),parentHash:member(b,'parentHash'),timestamp:member(b,'timestamp')});
const boolean=value=>{if(typeof value!=='boolean')fail('invalid_rpc_boolean');return value;};
function stateTuple(value){const a=array(value,2);if(a.length!==2)fail('invalid_nullifier_state');return{spent:boolean(a[0]),reservation:hash(a[1],true)};}
function codePin(value){const p=data(value,['dependency','runtimeHash']);return{address:address(p.dependency),runtimeHash:hash(p.runtimeHash)};}
export function createCanonicalRecordRpc(options){
 const p=data(options,['client','deployment','requiredConfirmations']),config=deployment(p.deployment),confirmations=uint(p.requiredConfirmations,100000n),client=p.client;
 if(!confirmations)fail('invalid_confirmation_policy');
 const abi=kernelAbi(config);
 for(const method of ['getChainId','getBlock','getTransactionReceipt','getLogs','getCode','readContract'])if(typeof client?.[method]!=='function')fail('invalid_rpc_client');
 let indexer=null,history=[],busy=false,attestation=null;const anchorRecords=new WeakMap();
 const at=(name,args,blockNumber)=>client.readContract({address:config.kernel,abi,functionName:name,args,blockNumber});
 async function block(number){return rpcHeader(await client.getBlock({blockNumber:number}));}
 async function canonical(h){const actual=await block(h.number);if(actual.hash!==h.hash)fail('canonical_block_changed');return actual;}
 async function attest(h){
  if(field(await client.getChainId())!==config.chainId)fail('wrong_chain');
  const receipt=await client.getTransactionReceipt({hash:config.deploymentTransactionHash});
  if(member(receipt,'status')!=='success'||hash(member(receipt,'transactionHash'))!==config.deploymentTransactionHash||uint(member(receipt,'blockNumber'))!==config.deploymentBlock||address(member(receipt,'contractAddress'))!==config.kernel)fail('wrong_deployment_receipt');
  const deployBlock=await block(config.deploymentBlock);if(hash(member(receipt,'blockHash'))!==deployBlock.hash||deployBlock.number>h.number)fail('noncanonical_deployment');
  for(const pin of [{address:config.kernel,runtimeHash:config.kernelRuntimeHash},config.verifier,config.poseidon,...config.closure]){
   const code=await client.getCode({address:pin.address,blockNumber:h.number});if(runtimeHash(code)!==pin.runtimeHash)fail('dependency_runtime_changed');
  }
  const expected=[['deploymentChainId',config.chainId],['domain',config.domain],['approvedSnapshotRoot',config.approvedSnapshotRoot],['maxValiditySeconds',config.maxValiditySeconds],['closureCount',BigInt(config.closure.length)]];
  for(const[name,n]of expected)if(uint(await at(name,[],h.number))!==n)fail('immutable_configuration_changed');
  if(isCurrentKernel(config)&&uint(await at('CURRENT_INDEX_SCHEMA',[],h.number))!==2036000n)fail('unexpected_current_index_schema');
  for(const[name,v]of [['manifestHash',config.manifestHash],['RULES_COMMITMENT',RULES_COMMITMENT],['verifierRuntimeHash',config.verifier.runtimeHash],['poseidonRuntimeHash',config.poseidon.runtimeHash]])if(hash(await at(name,[],h.number))!==v)fail('immutable_configuration_changed');
  if(address(await at('verifier',[],h.number))!==config.verifier.address)fail('immutable_configuration_changed');
  for(let i=0;i<config.closure.length;i++){const actual=codePin(await at('closurePin',[BigInt(i)],h.number)),expected=config.closure[i];if(actual.address!==expected.address||actual.runtimeHash!==expected.runtimeHash)fail('incomplete_code_closure');}
  await canonical(h);return freeze({block:h,domain:config.domain,manifestHash:config.manifestHash,codeClosureChecked:true,constructorClosureCompleteness:'deployment-compiler admission; exact supplied pins and onchain list checked'});
 }
 function captureReceipt(receipt,h,transactionHash){
  if(hash(member(receipt,'transactionHash'))!==transactionHash||hash(member(receipt,'blockHash'))!==h.hash||uint(member(receipt,'blockNumber'))!==h.number||member(receipt,'status')!=='success')fail('noncanonical_receipt');
  const txIndex=uint(member(receipt,'transactionIndex'),(1n<<32n)-1n),logs=[];
  for(const input of array(member(receipt,'logs'),65536)){
   if(address(member(input,'address'))!==config.kernel)continue;
   if(member(input,'removed')===true)fail('removed_log');
   if(hash(member(input,'transactionHash'))!==transactionHash||hash(member(input,'blockHash'))!==h.hash||uint(member(input,'blockNumber'))!==h.number||uint(member(input,'transactionIndex'))!==txIndex)fail('mismatched_receipt_log');
   const topics=array(member(input,'topics'),4).map(x=>hash(x,true)),raw=member(input,'data');
   if(typeof raw!=='string'||raw.length>32768||!/^0x(?:[0-9a-f]{2})*$/.test(raw))fail('invalid_log_data');
   const decoded=decodeEventLog({abi,topics,data:raw,strict:true});
   logs.push({index:uint(member(input,'logIndex'),(1n<<32n)-1n),event:decoded.eventName,args:decoded.args});
  }
  return freeze({hash:transactionHash,index:txIndex,status:'success',logs});
 }
 async function fetchBlock(h){
  const found=array(await client.getLogs({address:config.kernel,fromBlock:h.number,toBlock:h.number}),8192),txs=new Map(),advertised=new Set();
  for(const log of found){
   if(address(member(log,'address'))!==config.kernel||member(log,'removed')===true||hash(member(log,'blockHash'))!==h.hash||uint(member(log,'blockNumber'))!==h.number)fail('noncanonical_log');
   const txHash=hash(member(log,'transactionHash')),key=txHash+':'+uint(member(log,'logIndex'));if(advertised.has(key))fail('duplicate_rpc_log');advertised.add(key);txs.set(txHash,null);
  }
  const transactions=[];
  for(const txHash of txs.keys()){
   const receipt=await client.getTransactionReceipt({hash:txHash}),tx=captureReceipt(receipt,h,txHash);
   for(const log of tx.logs)if(!advertised.has(txHash+':'+log.index))fail('incomplete_rpc_logs');
   if(tx.logs.length===0)fail('missing_receipt_logs');transactions.push(tx);
  }
  transactions.sort((a,b)=>a.index<b.index?-1:a.index>b.index?1:0);
  await canonical(h);return freeze({header:h,transactions});
 }
 async function compareProjection(snapshot,fromIndex){
  const n=snapshot.tip.number,count=uint(await at('recordCount',[],n)),root=uint(await at('recordRoot',[],n));
  if(count!==snapshot.recordCount||root!==snapshot.recordRoot)fail('incomplete_record_projection');
  if(root!==0n&&!boolean(await at('isKnownRoot',[root],n)))fail('unaccepted_record_root');
  if(isCurrentKernel(config)){
   if(field(await at('currentNullifierRoot',[],n))!==snapshot.currentNullifiers.root||uint(await at('currentNullifierCount',[],n))!==snapshot.currentNullifiers.count)fail('mismatched_current_status_projection');
   if(field(await at('transitionContextRoot',[],n))!==snapshot.transitionContexts.root||uint(await at('transitionContextCount',[],n))!==snapshot.transitionContexts.count||!boolean(await at('isKnownTransitionContextRoot',[snapshot.transitionContexts.root],n)))fail('mismatched_transition_context_projection');
  }
  for(const r of snapshot.publications.slice(fromIndex)){
   if(!boolean(await at('commitmentUsed',[r.commitment],n))||!boolean(await at('packetUsed',[r.packetDigest],n)))fail('unpublished_record');
   if(r.kind===0&&!boolean(await at('sourceImported',[r.sourceImportId],n)))fail('unimported_source');
   if(r.kind===1){const nf=stateTuple(await at('nullifierState',[r.nullifier],n));if(!nf.spent||nf.reservation!==ZERO)fail('inconsistent_nullifier_map');}
   if(r.transitionContext){const context=array(await at('transitionContext',[r.nullifier],n),4);if(context.length!==4||context[0]!==true||field(context[1])!==r.commitment||uint(context[2])!==r.blockTimestamp||uint(context[3])!==r.transitionContext.index)fail('mismatched_transition_context_mapping');}
  }
  await canonical(snapshot.tip);
 }
 async function project(base,kept,target){
  const candidate=createCanonicalRecordIndexer({deployment:config,baseHeader:base});
  for(let i=0;i<kept.length;i+=512)candidate.applyBatch(kept.slice(i,i+512));
  const retainedCount=Number(candidate.snapshot().recordCount),added=[];let number=candidate.snapshot().tip.number+1n,page=[];
  while(number<=target.number){const b=await fetchBlock(await block(number));added.push(b);page.push(b);number++;if(page.length===512||number>target.number){candidate.applyBatch(page);page=[];}}
  const view=candidate.snapshot();await compareProjection(view,retainedCount);await canonical(target);return{indexer:candidate,snapshot:view,history:[...kept,...added]};
 }
 async function sync(){
  if(busy)fail('reconciliation_busy');busy=true;
  try{
   const latest=rpcHeader(await client.getBlock({blockTag:'latest'}));
   if(latest.number+1n<confirmations||latest.number-confirmations+1n<config.deploymentBlock)fail('deployment_not_confirmed');
   const target=await block(latest.number-confirmations+1n),checked=await attest(target);
   const base=await block(config.deploymentBlock-1n);let kept=history;
   if(indexer){
    const prior=indexer.snapshot();let ancestor=prior.tip;
    while(ancestor.number>target.number||(await block(ancestor.number)).hash!==ancestor.hash){
     if(prior.tip.number-ancestor.number>=128n||ancestor.number===base.number)fail('reorg_requires_full_rebuild');
     const previous=history.find(b=>b.header.number===ancestor.number-1n)?.header;ancestor=previous||prior.baseHeader;
    }
    if((await block(ancestor.number)).hash!==ancestor.hash||base.hash!==prior.baseHeader.hash)fail('deployment_base_reorg');
    kept=history.filter(b=>b.header.number<=ancestor.number);
   }
   const projected=await project(base,kept,target);history=projected.history;indexer=projected.indexer;attestation=checked;return projected.snapshot;
  }finally{busy=false;}
 }
 function snapshot(){if(!indexer||!attestation)fail('reconciliation_required');return indexer.snapshot();}
 async function anchor(input){
  const p=data(input,['record']),canonicalRecord=ownedRecord(p.record),commitment=recordCommitment(config.domain,canonicalRecord),nullifier=nullifierOf(config.domain,canonicalRecord,commitment),view=snapshot(),confirmedIndexer=indexer,confirmedHistory=[...history];
  const record=view.publications.find(r=>r.commitment===commitment);if(!record)fail('unknown_head_record');
  // Selection is local BEFORE any async read. A future NF is private until an
  // accepted public write; never send this derived C/NF pair to the provider.
  if(view.publications.some(r=>r.kind===1&&r.nullifier===nullifier))fail('head_not_unspent');
  await attest(view.tip);
  const tip=rpcHeader(await client.getBlock({blockTag:'latest'}));
  if(tip.number<view.tip.number||tip.number-view.tip.number+1n<confirmations)fail('insufficient_confirmations');
  await attest(tip);
  const observed=tip.number===view.tip.number?{indexer:confirmedIndexer,snapshot:view}:await project(view.baseHeader,confirmedHistory,tip),tipView=observed.snapshot;
  if(tipView.publications.some(r=>r.kind===1&&r.nullifier===nullifier))fail('head_spent_at_tip');
  let currentStatus=null,transitionContexts=null;
  if(isCurrentKernel(config)){
   const witness=confirmedIndexer.currentWitness(nullifier),observedTipWitness=observed.indexer.currentWitness(nullifier);if(witness.exists||observedTipWitness.exists||witness.root!==view.currentNullifiers.root||witness.count!==view.currentNullifiers.count)fail('inconsistent_current_head_status');
   const tipRoot=tipView.currentNullifiers.root,tipCount=tipView.currentNullifiers.count;
   currentStatus=freeze({confirmedRoot:witness.root,confirmedCount:witness.count,witness,observedTipRoot:tipRoot,observedTipCount:tipCount,observedTipWitness,sameRootAsObservedTip:tipRoot===witness.root&&tipCount===witness.count,privateReadProofVerified:false});
   transitionContexts=freeze({confirmedRoot:view.transitionContexts.root,confirmedCount:view.transitionContexts.count,observedTipRoot:tipView.transitionContexts.root,observedTipCount:tipView.transitionContexts.count});
  }
  await canonical(tip);await canonical(view.tip);
  const result=freeze({format:'omerta:canonical26:head-anchor:v1',chainId:config.chainId,kernel:config.kernel,manifestHash:config.manifestHash,domain:config.domain,commitment,nullifier,recordIndex:record.index,confirmedBlock:view.tip,observedTip:tip,requiredConfirmations:confirmations,recordRoot:view.recordRoot,recordCount:view.recordCount,rpcTrustRequired:true,currentStatus,transitionContexts});
  anchorRecords.set(result,canonicalRecord);return result;
 }
 async function recheck(input){
  if(!input||!anchorRecords.has(input))fail('unissued_head_anchor');
  const p=data(input,['format','chainId','kernel','manifestHash','domain','commitment','nullifier','recordIndex','confirmedBlock','observedTip','requiredConfirmations','recordRoot','recordCount','rpcTrustRequired','currentStatus','transitionContexts']);
  if(p.format!=='omerta:canonical26:head-anchor:v1'||field(p.chainId)!==config.chainId||address(p.kernel)!==config.kernel||hash(p.manifestHash)!==config.manifestHash||field(p.domain)!==config.domain||uint(p.requiredConfirmations)!==confirmations||p.rpcTrustRequired!==true)fail('wrong_head_anchor');
  const blockSnapshot=header(p.confirmedBlock);await canonical(blockSnapshot);
  const current=await anchor({record:anchorRecords.get(input)});
  if(current.recordIndex!==uint(p.recordIndex)||current.confirmedBlock.hash!==blockSnapshot.hash||current.recordRoot!==uint(p.recordRoot)||current.recordCount!==uint(p.recordCount))fail('head_anchor_changed');return current;
 }
 return Object.freeze({sync,snapshot,anchor,recheck});
}
