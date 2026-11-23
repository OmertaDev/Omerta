// Owner-only canonical26 recovery. RPC receives public C/NF only, never records or view secrets.
import {decryptOwnedRecordSnapshot,decryptOwnedRecordDelta,recoverOwnedPublishedRecords} from '../experiments/private-record-recovery-ownership/guarded.mjs';
import {recordCommitment} from '../experiments/private-account-record/record.mjs';
import {fail,data,array,field,hash,address,uint,freeze,ownedRecord,ownedPublication,deployment,packetBytes,nullifierOf} from './canonical-record-format.mjs';
const FORMAT='omerta:canonical26:vault-head:v1';
function vaultEntry(input){const p=data(input,['id','revision']);if(typeof p.id!=='string'||!p.id.length||p.id.length>256||typeof p.revision!=='string'||!p.revision.length||p.revision.length>200000)fail('invalid_vault_entry');return freeze({id:p.id,revision:p.revision});}
const jsonCopy=value=>JSON.parse(JSON.stringify(value,(_,v)=>typeof v==='bigint'?String(v):v));
export function createCanonicalRecordRecovery(options){
 const p=data(options,['reconciler','vault']),rpc=p.reconciler,vault=p.vault;
 for(const m of ['sync','snapshot','anchor','recheck'])if(typeof rpc?.[m]!=='function')fail('invalid_reconciler');
 for(const m of ['put','get'])if(typeof vault?.[m]!=='function')fail('invalid_local_vault');
 let busy=false;
 function capture(input){const p=data(input,['sourceImportId','recipientSecret'],['vaultEntry']);return{sourceImportId:field(p.sourceImportId),recipientSecret:field(p.recipientSecret),vaultEntry:p.vaultEntry===undefined?null:vaultEntry(p.vaultEntry)};}
 async function recoverCaptured(captured){
  const view=await rpc.sync(),config=deployment(view.deployment);
  // Indexer snapshots are recursively frozen and encode packets as immutable hex.
  // Capture all public publication references before any owner-side crypto await.
  const publications=array(view.publications,2**32).map(ownedPublication),source=publications.find(r=>r.kind===0&&r.sourceImportId===captured.sourceImportId);
  if(!source)fail('unknown_source_import');
  const nextByNf=new Map(publications.filter(r=>r.kind===1).map(r=>[String(r.nullifier),r]));
  const chain=[source];let current=source;
  let record=ownedRecord(await decryptOwnedRecordSnapshot({domain:config.domain,packet:packetBytes(source.packet),recipientSecret:captured.recipientSecret,expectedDigest:source.packetDigest,expectedCommitment:source.commitment}));
  while(true){
   const c=recordCommitment(config.domain,record);if(c!==current.commitment)fail('recovery_record_mismatch');
   const nf=nullifierOf(config.domain,record,c),next=nextByNf.get(String(nf));if(!next)break;
   if(next.index<=current.index)fail('invalid_owner_publication_order');
   record=ownedRecord(await decryptOwnedRecordDelta({domain:config.domain,oldRecord:record,packet:packetBytes(next.packet),recipientSecret:captured.recipientSecret,expectedDigest:next.packetDigest,expectedCommitment:next.commitment}));
   chain.push(next);current=next;
  }
  const commitment=recordCommitment(config.domain,record),nullifier=nullifierOf(config.domain,record,commitment);
  const anchor=await rpc.anchor({record});
  if(anchor.commitment!==current.commitment||anchor.domain!==config.domain||anchor.manifestHash!==config.manifestHash)fail('wrong_recovery_anchor');
  const ownedPublications=chain.map(r=>({kind:r.kind,packet:packetBytes(r.packet),digest:r.packetDigest,commitment:r.commitment}));
  // The expected tail comes from the reconciled publication and unspent-map anchor,
  // not caller-supplied history length or the historical helper's returned C.
  const qualified=await recoverOwnedPublishedRecords({domain:config.domain,recipientSecret:captured.recipientSecret,publications:ownedPublications,expectedFinalCommitment:anchor.commitment});
  const recovered=ownedRecord(qualified.record);if(recordCommitment(config.domain,recovered)!==anchor.commitment||nullifierOf(config.domain,recovered,anchor.commitment)!==anchor.nullifier)fail('wrong_recovered_head');
  await rpc.recheck(anchor);
  const body=freeze(jsonCopy({format:FORMAT,chainId:config.chainId,kernel:config.kernel,manifestHash:config.manifestHash,domain:config.domain,sourceImportId:captured.sourceImportId,commitment:anchor.commitment,nullifier:anchor.nullifier,record:recovered,anchor}));
  const saved=await vault.put(body,captured.vaultEntry||{});
  // Chain and local storage cannot commit atomically. A later race leaves only an
  // encrypted cache entry; every restore reconciles again before returning a head.
  await rpc.recheck(anchor);
  return freeze({record:recovered,commitment:anchor.commitment,nullifier:anchor.nullifier,anchor,vaultEntry:vaultEntry(saved),publicationCount:chain.length,authority:'confirmed RPC view with tip-unspent recheck; not absolute finality or future spend permission'});
 }
 async function recover(input){const captured=capture(input);if(busy)fail('recovery_busy');busy=true;try{return await recoverCaptured(captured);}finally{busy=false;}}
 async function restore(input){
  const p=data(input,['id','recipientSecret']),recipientSecret=field(p.recipientSecret);
  if(typeof p.id!=='string'||p.id.length<1||p.id.length>256)fail('invalid_vault_entry');const id=p.id;
  if(busy)fail('recovery_busy');busy=true;
  try{
   const stored=await vault.get(id);if(!stored)fail('unknown_vault_entry');
   const s=data(stored,['id','body','revision']),body=data(s.body,['format','chainId','kernel','manifestHash','domain','sourceImportId','commitment','nullifier','record','anchor']);
   if(s.id!==id||body.format!==FORMAT)fail('wrong_vault_record');
   const binding={chainId:field(body.chainId),kernel:address(body.kernel),manifestHash:hash(body.manifestHash),domain:field(body.domain)},sourceImportId=field(body.sourceImportId),entry=vaultEntry({id,revision:s.revision});
   const config=(await rpc.sync()).deployment;
   if(binding.chainId!==config.chainId||binding.kernel!==config.kernel||binding.manifestHash!==config.manifestHash||binding.domain!==config.domain)fail('wrong_vault_domain');
   // Cached plaintext/header/anchor is never accepted as fresh state.
   // Re-read public history and decrypt from the admitted source snapshot.
   return await recoverCaptured({sourceImportId,recipientSecret,vaultEntry:entry});
  }finally{busy=false;}
 }
 return Object.freeze({recover,restore});
}
