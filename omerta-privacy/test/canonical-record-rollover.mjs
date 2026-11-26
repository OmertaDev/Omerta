// Synthetic chain/proof bytes; actual owner encryption and recovery. No proof or EVM execution.
import assert from 'node:assert/strict';
import {decodeFunctionData,toHex} from 'viem';
import {createCanonicalRecordRpc} from '../src/canonical-record-rpc.mjs';
import {createCanonicalRecordRecovery} from '../src/canonical-record-recovery.mjs';
import {createCanonicalRecordRollover,CANONICAL_ROLLOVER_ABI} from '../src/canonical-record-rollover.mjs';
import {createNoteVault} from '../src/note-vault.mjs';
import {MemoryNoteStorage} from './note-vault-fixtures.mjs';
import {syntheticFixture,currentFixture,modelRpc} from './canonical-record-fixtures.mjs';
import {createRecordEncryptionRuntime} from '../experiments/private-account-record/encryption.mjs';
import {rolloverStatement,deploymentDomain,RULES_COMMITMENT} from '../experiments/private-account-record/record.mjs';
import {CanonicalRecordError} from '../src/canonical-record-format.mjs';

assert(!process.env.DATABASE_URL&&process.env.NODE_ENV!=='production');
const clone=structuredClone,groups=[];
const check=name=>{groups.push(name);console.log('PASS '+name);};
const refuses=(code,fn)=>assert.rejects(fn,e=>e instanceof CanonicalRecordError&&e.code===code);
const base=await syntheticFixture(),f=currentFixture(base),model=modelRpc(f);
const rpc=createCanonicalRecordRpc({client:model.client,deployment:f.config,requiredConfirmations:3});
const vault=await createNoteVault({domain:{version:1,chainId:String(f.config.chainId),gameAddress:f.config.kernel,programId:RULES_COMMITMENT},recoveryKey:new Uint8Array(32).fill(29),storage:new MemoryNoteStorage()});
let encryption;
try{
 const recovery=createCanonicalRecordRecovery({reconciler:rpc,vault});
 const recovered=await recovery.recover({sourceImportId:f.sourceImportId,recipientSecret:17n});
 assert.deepEqual(recovered.record,f.second);
 const now=recovered.anchor.observedTip.timestamp,statement=rolloverStatement({domain:f.config.domain,oldRoot:recovered.anchor.recordRoot,oldRecord:recovered.record,expiry:now+120n,newSeed:701n,newBlind:801n});
 encryption=await createRecordEncryptionRuntime();
 const encrypted=await encryption.encryptFields({domain:f.config.domain,purpose:'delta',recipientKey:{x:f.second.viewPkX,y:f.second.viewPkY},fields:statement.plaintext,ephemeralScalar:91n});
 const maliciousFields=[...statement.plaintext];maliciousFields[3]+=1n;
 const malicious=await encryption.encryptFields({domain:f.config.domain,purpose:'delta',recipientKey:{x:f.second.viewPkX,y:f.second.viewPkY},fields:maliciousFields,ephemeralScalar:92n});
 await encryption.destroy();encryption=null;
 const proof='0x'+'01'.repeat(32),inputs=[f.config.domain,statement.root,statement.nullifier,statement.outputCommitment,encrypted.digest,statement.expiry];
 const args=()=>({record:recovered.record,anchor:recovered.anchor,proof,inputs:[...inputs],packet:toHex(encrypted.packet),recipientSecret:17n});
 const adapter=createCanonicalRecordRollover({reconciler:rpc}),prepared=await adapter.prepare(args());
 const decoded=decodeFunctionData({abi:CANONICAL_ROLLOVER_ABI,data:prepared.call.data});
 assert.equal(decoded.functionName,'rollover');assert.equal(decoded.args[0],proof);assert.deepEqual(decoded.args[1],inputs);assert.equal(decoded.args[2],toHex(encrypted.packet));
 assert.equal(decoded.args[3].exists,false);assert.equal(decoded.args[3].path.siblings.length,32);assert.equal(decoded.args[3].appendSiblings.length,32);
 assert.equal(prepared.call.to,f.config.kernel);assert.equal(prepared.call.value,'0x0');assert.equal(prepared.gasPayer,'player');assert.equal(prepared.proofVerifiedLocally,false);assert(Object.isFrozen(prepared.call));
 assert.deepEqual(Object.keys(adapter),['prepare']);assert(!JSON.stringify(prepared,(_,v)=>typeof v==='bigint'?String(v):v).includes('recipientSecret'));
 check('real owner recovery and encrypted delta compose exact unsigned contract calldata; no send/sign/sponsor path');

 for(const index of [0,1,2]){const a=args();a.inputs[index]+=1n;await refuses('wrong_rollover_context',()=>adapter.prepare(a));}
 check('deployment domain, accepted NOTE root and derived input nullifier substitutions rejected');
 const substituted=args();substituted.packet=toHex(encrypted.packet).slice(0,-2)+(toHex(encrypted.packet).endsWith('00')?'01':'00');
 await refuses('wrong_rollover_packet',()=>adapter.prepare(substituted));check('packet substitution rejected independently of caller-provided digest');

 const output=args();output.inputs[3]+=1n;await assert.rejects(()=>adapter.prepare(output),/Recovered record differs/);
 const key=args();key.recipientSecret=19n;await assert.rejects(()=>adapter.prepare(key),/Wrong old-record viewing key/);
 check('matching packet shape cannot substitute output commitment or authenticated recipient');

 const changed=args();changed.packet=toHex(malicious.packet);changed.inputs[4]=malicious.digest;
 await assert.rejects(()=>adapter.prepare(changed),/Rewrap changes resources\/shared clock/);
 check('self-consistent ciphertext/digest still rejected when plaintext mutates resources or shared clock');

 for(const expiry of [now,now-1n,now+f.config.maxValiditySeconds+1n,now*1000n]){const a=args();a.inputs[5]=expiry;await refuses('invalid_rollover_expiry',()=>adapter.prepare(a));}
 check('exclusive expiry, maximum validity and milliseconds confusion fail before calldata release');
 const reused=args();reused.inputs[3]=recovered.commitment;await refuses('reused_rollover_output',()=>adapter.prepare(reused));
 const reusedPacket=args();reusedPacket.inputs[4]=rpc.snapshot().publications[0].packetDigest;await refuses('reused_rollover_output',()=>adapter.prepare(reusedPacket));
 check('existing output commitments and publication digests cannot be reused');
 const forged=args();forged.anchor=clone(recovered.anchor);await refuses('unissued_head_anchor',()=>adapter.prepare(forged));
 check('serialized matching anchor is not accepted as reconciler authority');

 const wrongConfig=clone(f.config);wrongConfig.kernel='0x'+'98'.repeat(20);wrongConfig.domain=deploymentDomain(wrongConfig.chainId,wrongConfig.kernel,wrongConfig.manifestHash);
 const wrong=createCanonicalRecordRollover({reconciler:{...rpc,snapshot(){return{...rpc.snapshot(),deployment:wrongConfig};}}});
 await refuses('wrong_rollover_anchor',()=>wrong.prepare(args()));check('validly formed different deployment cannot reuse an owner head anchor');

 const unrelated=clone(base);unrelated.pendingBlocks[4].transactions[0].logs.at(-1).args.nullifier=12345n;
 const unrelatedFixture=currentFixture(unrelated),unrelatedModel=modelRpc(unrelatedFixture),unrelatedRpc=createCanonicalRecordRpc({client:unrelatedModel.client,deployment:unrelatedFixture.config,requiredConfirmations:3});
 await unrelatedRpc.sync();const unrelatedAnchor=await unrelatedRpc.anchor({record:f.second});unrelatedModel.spendAtTip(unrelatedFixture.finalNullifier);
 const staleArgs=args();staleArgs.anchor=unrelatedAnchor;
 await refuses('stale_rollover_status',()=>createCanonicalRecordRollover({reconciler:unrelatedRpc}).prepare(staleArgs));
 check('unrelated unconfirmed status write refuses stale append witness even though owner input remains unspent');

 model.spendAtTip(f.finalNullifier);await refuses('head_spent_at_tip',()=>adapter.prepare(args()));model.clearTipSpend();
 check('input spent at unconfirmed tip rejects replay preparation');
 let checks=0;
 const raced=createCanonicalRecordRollover({reconciler:{...rpc,async recheck(anchor){if(++checks===2)model.spendAtTip(f.finalNullifier);return rpc.recheck(anchor);}}});
 await refuses('head_spent_at_tip',()=>raced.prepare(args()));model.clearTipSpend();
 check('spend between private output validation and final context recheck releases no call');

 let release;const held=new Promise(resolve=>{release=resolve;});
 const delayed=createCanonicalRecordRollover({reconciler:{...rpc,async sync(){await held;return rpc.sync();}}});
 const mutable=args(),pending=delayed.prepare(mutable);mutable.inputs[0]=1n;mutable.record=clone(f.old);mutable.packet='0x';mutable.proof='0x';
 await refuses('rollover_busy',()=>delayed.prepare(args()));release();assert.equal((await pending).call.data,prepared.call.data);
 check('inputs owned before async work and duplicate preparation serialized');
 for(const badProof of ['0x','0x01','0x'+'01'.repeat(32769)]){const a=args();a.proof=badProof;await refuses('invalid_rollover_proof',()=>adapter.prepare(a));}
 const getter=args();Object.defineProperty(getter,'proof',{enumerable:true,get(){throw new Error('getter executed');}});await refuses('invalid_data',()=>adapter.prepare(getter));
 const extra=args();extra.paymaster='0x'+'11'.repeat(20);await refuses('invalid_data',()=>adapter.prepare(extra));
 check('invalid proof framing, accessor inputs and extra fee/sponsor fields rejected');

 console.log(JSON.stringify({complete:true,groups:groups.length,scope:'Owner-side preservation-only unsigned call composition; synthetic RPC and proof bytes, actual encryption/recovery',proofsGenerated:0,srsAllocated:false,contractTransactions:0,productionReady:false}));
}finally{await encryption?.destroy();vault.close();}
