// Experimental pure byte codec only. It verifies no proof, encryption or action.
import {keccak_256} from '@noble/hashes/sha3';
import {ownBytes} from './bytes.mjs';
export const FIELD=21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const HEADER_BYTES=320, PACKET_BYTES=912, OWNER_OFFSET=1232;
export const MAGIC=Object.freeze([79,77,69,82,84,65,77,80]); // OMERTAMP
export const FULL_PREFIX=Object.freeze([...new TextEncoder().encode('OMERTA_MUTABLE_PRECISION_ENV_V1'),0]);
const POLICY=['schemaHash','privacyClass','ownerPolicyHash','controllerPolicyHash','ownerCipherBytes','controllerCipherBytes'];
const HEADER=['domain','spentNF','outputLeaf','suiteC','headerDigestFr'];
const fail=message=>{throw new TypeError(message);};
function data(x,keys){
 if(!x||![Object.prototype,null].includes(Object.getPrototypeOf(x)))fail('OWN_DATA');
 const ds=Object.getOwnPropertyDescriptors(x),actual=Reflect.ownKeys(ds);
 if(actual.length!==keys.length||keys.some(k=>!actual.includes(k)))fail('EXACT_FIELDS');
 const out={};for(const k of keys){const d=ds[k];if(!d.enumerable||!Object.hasOwn(d,'value'))fail('OWN_DATA');out[k]=d.value;}return out;
}
function uint(x,max){
 if(typeof x==='number'){if(!Number.isSafeInteger(x)||x<0||Object.is(x,-0))fail('UINT');x=String(x);}
 if(typeof x==='string'){if(x.length>78||!/^(0|[1-9][0-9]*)$/.test(x))fail('UINT');x=BigInt(x);}
 if(typeof x!=='bigint'||x<0n||x>max)fail('UINT');return x;
}
const fr=x=>uint(x,FIELD-1n);
function hash32(x){if(typeof x!=='string'||!/^0x[0-9a-f]{64}$/.test(x))fail('BYTES32');return x;}
const hex=bytes=>'0x'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const unhex=x=>Uint8Array.from(hash32(x).slice(2).match(/../g),b=>parseInt(b,16));
function get(bytes,at,count){let n=0n;for(let i=0;i<count;i++)n=(n<<8n)+BigInt(bytes[at+i]);return n;}
function put(bytes,at,count,n){for(let i=count-1;i>=0;i--){bytes[at+i]=Number(n&255n);n>>=8n;}if(n!==0n)fail('UINT');}
function policy(input){
 const p=data(input,POLICY);for(const k of POLICY.slice(0,4))p[k]=hash32(p[k]);
 for(const k of POLICY.slice(4)){const n=uint(p[k],0xffffffffn);if(n<80n||(n-64n)%16n!==0n)fail('CIPHER_SHAPE');p[k]=Number(n);}
 return Object.freeze(p);
}
function header(input){const h=data(input,HEADER);for(const k of HEADER)h[k]=fr(h[k]);if(h.domain===0n||h.spentNF===0n)fail('NONZERO_DOMAIN_NF');return Object.freeze(h);}
function own(input,size){return ownBytes(input,size);}
function opaqueDigest(bytes){
 const value=hex(keccak_256(bytes));return Object.freeze({kind:'opaque-keccak256-bytes32',hex:value,...digestLimbs(value)});
}
export function digestLimbs(value){const n=BigInt(hash32(value));return Object.freeze({hi128:n>>128n,lo128:n&((1n<<128n)-1n)});}
export function digestFromLimbs(hi,lo){return '0x'+((uint(hi,(1n<<128n)-1n)<<128n)+uint(lo,(1n<<128n)-1n)).toString(16).padStart(64,'0');}
export function encodeEnvelope(input){
 const p=data(input,['policy','header','headerPacket','ownerCipher','controllerCipher']),cfg=policy(p.policy),h=header(p.header);
 const packet=own(p.headerPacket,PACKET_BYTES),owner=own(p.ownerCipher,cfg.ownerCipherBytes),controller=own(p.controllerCipher,cfg.controllerCipherBytes);
 const out=new Uint8Array(OWNER_OFFSET+owner.length+controller.length);out.set(MAGIC);put(out,8,2,1n);
 for(const [at,key] of [[12,'schemaHash'],[44,'privacyClass'],[236,'ownerPolicyHash'],[268,'controllerPolicyHash']])out.set(unhex(cfg[key]),at);
 for(const [at,key] of [[76,'domain'],[108,'spentNF'],[140,'outputLeaf'],[172,'suiteC'],[204,'headerDigestFr']])put(out,at,32,h[key]);
 put(out,300,4,BigInt(owner.length));put(out,304,4,BigInt(controller.length));
 out.set(packet,HEADER_BYTES);out.set(owner,OWNER_OFFSET);out.set(controller,OWNER_OFFSET+owner.length);return out;
}
export function decodeEnvelope(input){
 const p=data(input,['policy','envelope']),cfg=policy(p.policy),size=OWNER_OFFSET+cfg.ownerCipherBytes+cfg.controllerCipherBytes;
 // Exact immutable policy lengths precede the owning copy/hash; no production capacity is inferred.
 const bytes=own(p.envelope,size);
 if(MAGIC.some((b,i)=>bytes[i]!==b))fail('MAGIC');
 if(get(bytes,8,2)!==1n)fail('VERSION');if(get(bytes,10,2)!==0n)fail('FLAGS');
 for(let i=308;i<320;i++)if(bytes[i]!==0)fail('RESERVED');
 for(const [at,key] of [[12,'schemaHash'],[44,'privacyClass'],[236,'ownerPolicyHash'],[268,'controllerPolicyHash']])
  if(hex(bytes.subarray(at,at+32))!==cfg[key])fail('POLICY_'+key);
 if(get(bytes,300,4)!==BigInt(cfg.ownerCipherBytes)||get(bytes,304,4)!==BigInt(cfg.controllerCipherBytes))fail('POLICY_LENGTH');
 const h=header(Object.fromEntries([[76,'domain'],[108,'spentNF'],[140,'outputLeaf'],[172,'suiteC'],[204,'headerDigestFr']].map(([at,k])=>[k,get(bytes,at,32)])));
 const packet=bytes.subarray(HEADER_BYTES,OWNER_OFFSET),owner=bytes.subarray(OWNER_OFFSET,OWNER_OFFSET+cfg.ownerCipherBytes),controller=bytes.subarray(OWNER_OFFSET+cfg.ownerCipherBytes);
 const preimage=new Uint8Array(40+size);preimage.set(FULL_PREFIX);put(preimage,32,8,BigInt(size));preimage.set(bytes,40);
 return Object.freeze({version:1,policy:cfg,header:h,totalBytes:size,headerPacketHex:hex(packet),ownerCipherHex:hex(owner),controllerCipherHex:hex(controller),
  fullEnvelopeDigest:opaqueDigest(preimage),ownerSectionDigest:opaqueDigest(owner),controllerSectionDigest:opaqueDigest(controller),
  assurance:Object.freeze({framingOnly:true,proofVerified:false,header2053DigestVerified:false,encryptionVerified:false,
   archiveComplete:false,recipientAuthorized:false,replayChecked:false,NOTEPolicyApplied:false,actionAccepted:false,production:false})});
}
