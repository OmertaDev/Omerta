// Canonical26 kernel formats only. No wallet, plaintext upload or chain authority.
import {parseAbi,keccak256} from 'viem';
import {FIELD,H,HEADER_FIELDS,RULES_COMMITMENT,deploymentDomain,canonicalRecord} from '../experiments/private-account-record/record.mjs';
import {recordPacketDigest} from '../experiments/private-account-record/encryption.mjs';
import {parseOwnedRecordPacket} from '../experiments/private-record-recovery-ownership/guarded.mjs';
export {FIELD,H,HEADER_FIELDS,RULES_COMMITMENT};
export const KERNEL_SOURCE_SHA256='cdd2d6ee7f7b2d8fc867010d8c74a986f25c6259fca2567cd8124d011506e8c3';
export const KERNEL_ABI=parseAbi([
 'event SourceImported(uint256 indexed sourceImportId,uint256 indexed commitment)',
 'event RecordRewrapped(uint256 indexed nullifier,uint256 indexed commitment,uint64 exclusiveExpirySeconds)',
 'event RecordAppended(uint256 indexed index,uint256 indexed commitment,uint256 indexed packetDigest,uint256 leaf,uint256 root,uint8 kind,bytes packet)',
 'function deploymentChainId() view returns (uint256)','function manifestHash() view returns (bytes32)',
 'function domain() view returns (uint256)','function RULES_COMMITMENT() view returns (bytes32)',
 'function approvedSnapshotRoot() view returns (uint256)','function maxValiditySeconds() view returns (uint32)',
 'function verifier() view returns (address)','function verifierRuntimeHash() view returns (bytes32)',
 'function poseidonRuntimeHash() view returns (bytes32)','function closureCount() view returns (uint256)',
 'function closurePin(uint256) view returns ((address dependency,bytes32 runtimeHash))',
 'function recordRoot() view returns (uint256)','function recordCount() view returns (uint256)',
 'function isKnownRoot(uint256) view returns (bool)','function sourceImported(uint256) view returns (bool)',
 'function commitmentUsed(uint256) view returns (bool)','function packetUsed(uint256) view returns (bool)',
 'function nullifierState(uint256) view returns (bool spent,bytes32 reservation)'
]);
export const CURRENT_KERNEL_ABI=[...KERNEL_ABI,...parseAbi([
 'event CurrentNullifierUpdated(uint256 indexed nullifier,bool spent,bytes32 reservation,uint32 index,uint256 root,uint64 count)',
 'event TransitionContextRecorded(uint256 indexed nullifier,uint256 indexed outputCommitment,uint64 acceptedAtSeconds,uint64 index,uint256 leaf,uint256 root)',
 'function CURRENT_INDEX_SCHEMA() view returns (uint256)',
 'function currentNullifierRoot() view returns (uint256)','function currentNullifierCount() view returns (uint64)',
 'function transitionContext(uint256) view returns (bool exists,uint256 newC,uint64 acceptedAtSeconds,uint64 index)',
 'function transitionContextRoot() view returns (uint256)','function transitionContextCount() view returns (uint256)',
 'function isKnownTransitionContextRoot(uint256) view returns (bool)'
])];
export const isCurrentKernel=config=>config.kernelProfile.id==='canonical26-current-v1';
export const kernelAbi=config=>isCurrentKernel(config)?CURRENT_KERNEL_ABI:KERNEL_ABI;
export class CanonicalRecordError extends Error {
 constructor(code){super(code);this.name='CanonicalRecordError';this.code=code;}
}
export const fail=code=>{throw new CanonicalRecordError(code);};
export function data(value,required,optional=[]){
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('invalid_data');
 const ds=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(ds);
 if(!required.every(k=>Object.hasOwn(ds,k))||keys.some(k=>typeof k!=='string'||![...required,...optional].includes(k)))fail('invalid_data');
 const copy={};for(const k of keys){const d=ds[k];if(!d.enumerable||!Object.hasOwn(d,'value'))fail('invalid_data');copy[k]=d.value;}return copy;
}
export function member(value,key){
 if(!value||typeof value!=='object')fail('invalid_rpc_data');
 const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))fail('invalid_rpc_data');return d.value;
}
export function array(value,max=Number.MAX_SAFE_INTEGER){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max)fail('invalid_array');
 if(Reflect.ownKeys(value).length!==value.length+1)fail('invalid_array');
 const copy=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))fail('invalid_array');copy.push(d.value);}return copy;
}
export function uint(value,max=FIELD-1n){
 if(typeof value==='string'){if(value.length<1||value.length>77||!/^(0|[1-9][0-9]*)$/.test(value))fail('invalid_integer');value=BigInt(value);}
 else if(typeof value==='number'){if(!Number.isSafeInteger(value)||value<0||Object.is(value,-0))fail('invalid_integer');value=BigInt(value);}
 if(typeof value!=='bigint'||value<0n||value>max)fail('invalid_integer');return value;
}
export function field(value){const n=uint(value);if(n===0n)fail('zero_field');return n;}
export function hash(value,allowZero=false){if(typeof value!=='string'||!/^0x[0-9a-f]{64}$/.test(value)||!allowZero&&/^0x0{64}$/.test(value))fail('invalid_hash');return value;}
export function address(value){if(typeof value!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(value)||/^0x0{40}$/i.test(value))fail('invalid_address');return value.toLowerCase();}
export function freeze(value){if(value&&typeof value==='object'){for(const x of Object.values(value))freeze(x);Object.freeze(value);}return value;}
export function packetHex(kind,value){
 const size=kind===0?912:kind===1?336:fail('invalid_kind');
 if(typeof value!=='string'||value.length!==2+size*2||!/^0x[0-9a-f]+$/.test(value))fail('invalid_packet');
 const bytes=Uint8Array.from(value.slice(2).match(/../g),x=>parseInt(x,16));
 parseOwnedRecordPacket(kind===0?'snapshot':'delta',bytes);return value;
}
export const packetBytes=hex=>Uint8Array.from(hex.slice(2).match(/../g),x=>parseInt(x,16));
export function packetDigest(domain,kind,hex){return recordPacketDigest(field(domain),kind===0?'snapshot':'delta',packetBytes(packetHex(kind,hex)));}
export function header(input){const p=data(input,['number','hash','parentHash','timestamp']),number=uint(p.number,(1n<<64n)-1n);return freeze({number,hash:hash(p.hash),parentHash:hash(p.parentHash,number===0n),timestamp:uint(p.timestamp,(1n<<64n)-1n)});}
export function deployment(input){
 const p=data(input,['chainId','kernel','kernelSourceSha256','kernelRuntimeHash','manifestHash','domain','approvedSnapshotRoot','maxValiditySeconds','deploymentBlock','deploymentTransactionHash','verifier','poseidon','closure'],['kernelProfile']);
 const profile=p.kernelProfile===undefined?{id:'canonical26-preservation-v1',kernelSourceSha256:KERNEL_SOURCE_SHA256}:data(p.kernelProfile,['id','kernelSourceSha256']);
 if(!['canonical26-preservation-v1','canonical26-current-v1'].includes(profile.id)||typeof profile.kernelSourceSha256!=='string'||!/^([0-9a-f]{64})$/.test(profile.kernelSourceSha256)||/^0{64}$/.test(profile.kernelSourceSha256)||p.kernelSourceSha256!==profile.kernelSourceSha256||profile.id==='canonical26-preservation-v1'&&profile.kernelSourceSha256!==KERNEL_SOURCE_SHA256)fail('unexpected_kernel_source');
 const pin=input=>{const x=data(input,['address','runtimeHash']);return{address:address(x.address),runtimeHash:hash(x.runtimeHash)};};
 const r={chainId:field(p.chainId),kernel:address(p.kernel),kernelProfile:{...profile},kernelSourceSha256:p.kernelSourceSha256,kernelRuntimeHash:hash(p.kernelRuntimeHash),manifestHash:hash(p.manifestHash),domain:field(p.domain),approvedSnapshotRoot:field(p.approvedSnapshotRoot),maxValiditySeconds:uint(p.maxValiditySeconds,86400n),deploymentBlock:uint(p.deploymentBlock,(1n<<64n)-1n),deploymentTransactionHash:hash(p.deploymentTransactionHash),verifier:pin(p.verifier),poseidon:pin(p.poseidon),closure:array(p.closure,16).map(pin)};
 if(!r.maxValiditySeconds||!r.deploymentBlock||!r.closure.length||deploymentDomain(r.chainId,r.kernel,r.manifestHash)!==r.domain)fail('invalid_deployment');
 const pins=[{address:r.kernel,runtimeHash:r.kernelRuntimeHash},r.verifier,r.poseidon,...r.closure];
 if(new Set(pins.map(p=>p.address)).size!==pins.length)fail('duplicate_code_pin');return freeze(r);
}
export function ownedRecord(input){const p=data(input,HEADER_FIELDS);return freeze(canonicalRecord(Object.fromEntries(HEADER_FIELDS.map(k=>[k,uint(p[k])]))));}
export function ownedPublication(input){
 const p=data(input,['index','commitment','packetDigest','leaf','root','kind','packet','sourceImportId','nullifier','exclusiveExpirySeconds','blockNumber','blockHash','blockTimestamp','transactionHash','transactionIndex','logIndex','currentStatus','transitionContext']);
 const kind=Number(uint(p.kind,1n));
 if(kind===0&&(p.nullifier!==null||p.exclusiveExpirySeconds!==null)||kind===1&&p.sourceImportId!==null)fail('invalid_publication_marker');
 let currentStatus=null,transitionContext=null;if(p.currentStatus!==null){const s=data(p.currentStatus,['index','root','count']);currentStatus={index:uint(s.index,(1n<<32n)-1n),root:field(s.root),count:uint(s.count,1n<<32n)};}if(p.transitionContext!==null){const c=data(p.transitionContext,['index','acceptedAtSeconds','leaf','root']);transitionContext={index:uint(c.index,(1n<<64n)-1n),acceptedAtSeconds:uint(c.acceptedAtSeconds,(1n<<64n)-1n),leaf:field(c.leaf),root:field(c.root)};}
 if((currentStatus===null)!==(transitionContext===null)||kind===0&&currentStatus!==null)fail('invalid_context_metadata');
 return freeze({index:uint(p.index,(1n<<32n)-1n),commitment:field(p.commitment),packetDigest:field(p.packetDigest),leaf:field(p.leaf),root:field(p.root),kind,packet:packetHex(kind,p.packet),sourceImportId:kind===0?field(p.sourceImportId):null,nullifier:kind===1?field(p.nullifier):null,exclusiveExpirySeconds:kind===1?field(p.exclusiveExpirySeconds):null,blockNumber:uint(p.blockNumber,(1n<<64n)-1n),blockHash:hash(p.blockHash),blockTimestamp:uint(p.blockTimestamp,(1n<<64n)-1n),transactionHash:hash(p.transactionHash),transactionIndex:uint(p.transactionIndex,(1n<<32n)-1n),logIndex:uint(p.logIndex,(1n<<32n)-1n),currentStatus,transitionContext});
}
export const nullifierOf=(domain,record,commitment)=>field(H(4004004n,H(field(domain),H(field(record.noteSeed),field(commitment)))));
export function runtimeHash(code){if(typeof code!=='string'||code.length<4||code.length%2||!/^0x[0-9a-f]+$/.test(code))fail('missing_runtime');return keccak256(code);}
