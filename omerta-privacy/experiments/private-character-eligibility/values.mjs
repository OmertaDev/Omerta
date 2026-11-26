// Exact typed representation only. Host Number projection is not a Noir proof.
import {poseidon2} from 'poseidon-lite';
import {parseDecimal,canonicalDecimal,decimalText} from '../private-book-codec/decimal.mjs';
import {FIELD,TAG,TYPE,MAX_TEXT_BYTES,PG_TIMESTAMP,SOURCE_DATE_PROJECTION} from './registry.mjs';

const requireValue=(condition,message='Invalid typed source value')=>{if(!condition)throw new TypeError(message);};
export function shape(value,keys){requireValue(value&&Object.getPrototypeOf(value)===Object.prototype);requireValue(Object.keys(value).sort().join(',')===[...keys].sort().join(','),'Unexpected/missing source attribute');}
export function field(value,nonzero=false){
 requireValue(typeof value==='bigint'||typeof value==='string'&&value.length<=77&&/^(0|[1-9][0-9]*)$/.test(value));
 const n=BigInt(value);requireValue(n>=0n&&n<FIELD&&(!nonzero||n>0n),'Noncanonical field');return n;
}
export const H=(left,right)=>poseidon2([field(left),field(right)]);
export const fold=(tag,domain,values)=>values.reduce((node,x)=>H(node,field(x)),H(tag,domain));
function signed(value,bits){
 requireValue(typeof value==='string'&&value.length<=(bits===32?11:20)&&/^-?(0|[1-9][0-9]*)$/.test(value)||typeof value==='bigint'||typeof value==='number'&&Number.isSafeInteger(value),'Exact bounded source integer required');
 const n=BigInt(value),limit=1n<<BigInt(bits-1);requireValue(n>=-limit&&n<limit,'Source integer outside SQL type');return n;
}
function textBytes(value){
 requireValue(typeof value==='string'&&value.length<=MAX_TEXT_BYTES&&!value.includes('\0'),'Bounded PostgreSQL UTF8 text required');
 const bytes=new TextEncoder().encode(value);requireValue(bytes.length<=MAX_TEXT_BYTES,'Text outside admitted representation budget');
 requireValue(new TextDecoder('utf-8',{fatal:true}).decode(bytes)===value,'Invalid Unicode source text');return bytes;
}
export function pgTimestamp(micros){const n=signed(micros,64);return{pgBinaryHex:BigInt.asUintN(64,n).toString(16).padStart(16,'0')};}
export function pgMicros(value){
 shape(value,['pgBinaryHex']);requireValue(typeof value.pgBinaryHex==='string'&&/^[0-9a-f]{16}$/.test(value.pgBinaryHex),'Exact timestamptz_send8bytes required; JSDate is lossy');
 const n=BigInt.asIntN(64,BigInt('0x'+value.pgBinaryHex));
 requireValue(n===BigInt(PG_TIMESTAMP.negativeInfinity)||n===BigInt(PG_TIMESTAMP.positiveInfinity)||n>=BigInt(PG_TIMESTAMP.minimumFinite)&&n<BigInt(PG_TIMESTAMP.endFiniteExclusive),'Invalid PostgreSQL timestamp');return n;
}
export function canonicalValue(descriptor,input){
 const type=descriptor.type;requireValue(Number.isInteger(type)&&type>=1&&type<=6);
 if(input===null){requireValue(descriptor.nullable,'Unexpected SQLNULL');return{type,isNull:true,payload:[]};}
 let payload;
 if(type===TYPE.BOOLEAN){requireValue(typeof input==='boolean');payload=[input?'1':'0'];}
 else if(type===TYPE.INT||type===TYPE.BIGINT){const width=type===TYPE.INT?32:64;payload=[String(BigInt.asUintN(width,signed(input,width)))];}
 else if(type===TYPE.NUMERIC){
  const d=parseDecimal(input),limbs=[];for(let i=0;i<8;i++)limbs.push(String(d.coefficient>>BigInt(i*32)&0xffffffffn));
  payload=[d.negative?'1':'0',...limbs,String(d.scale+512)];
 }else if(type===TYPE.TIMESTAMPTZ){pgMicros(input);payload=[String(BigInt('0x'+input.pgBinaryHex))];}
 else{
  const bytes=textBytes(input),chunks=[];
  for(let offset=0;offset<bytes.length;offset+=16){let word=0n;for(let i=0;i<16;i++)word=(word<<8n)|BigInt(bytes[offset+i]??0);chunks.push(String(word));}
  payload=[String(bytes.length),String(chunks.length),...chunks];
 }
 return{type,isNull:false,payload};
}
export function recoverValue(descriptor,value){
 shape(value,['type','isNull','payload']);requireValue(value.type===descriptor.type&&typeof value.isNull==='boolean'&&Array.isArray(value.payload));
 const p=value.payload.map(v=>field(v));let output;
 if(value.isNull){requireValue(descriptor.nullable&&p.length===0);output=null;}
 else if(value.type===TYPE.BOOLEAN){requireValue(p.length===1&&p[0]<=1n);output=p[0]===1n;}
 else if(value.type===TYPE.INT||value.type===TYPE.BIGINT){const width=value.type===TYPE.INT?32:64;requireValue(p.length===1&&p[0]<(1n<<BigInt(width)));output=String(BigInt.asIntN(width,p[0]));}
 else if(value.type===TYPE.TIMESTAMPTZ){requireValue(p.length===1&&p[0]<(1n<<64n));output={pgBinaryHex:p[0].toString(16).padStart(16,'0')};pgMicros(output);}
 else if(value.type===TYPE.NUMERIC){
  requireValue(p.length===10&&p[0]<=1n&&p[9]<=1024n);let coefficient=0n;
  for(let i=0;i<8;i++){requireValue(p[i+1]<(1n<<32n));coefficient|=p[i+1]<<BigInt(i*32);}
  output=decimalText(canonicalDecimal({negative:p[0]===1n,coefficient,scale:Number(p[9])-512}));
 }else{
  requireValue(p.length>=2&&p[0]<=BigInt(MAX_TEXT_BYTES)&&p[1]===BigInt(Math.ceil(Number(p[0])/16))&&p.length===Number(p[1])+2);
  const all=new Uint8Array(Number(p[1])*16);
  for(let i=0;i<Number(p[1]);i++){requireValue(p[i+2]<(1n<<128n));let word=p[i+2];for(let j=15;j>=0;j--){all[i*16+j]=Number(word&255n);word>>=8n;}}
  for(let i=Number(p[0]);i<all.length;i++)requireValue(all[i]===0,'Noncanonical UTF8 padding');
  output=new TextDecoder('utf-8',{fatal:true}).decode(all.subarray(0,Number(p[0])));textBytes(output);
 }
 const recoded=canonicalValue(descriptor,output);requireValue(JSON.stringify(recoded)===JSON.stringify(value),'Noncanonical typed payload');return output;
}
export function valueCommitment(domain,value){
 field(domain,true);requireValue(value&&Array.isArray(value.payload));recoverValue({type:value.type,nullable:true},value);
 return field(fold(TAG.value,domain,[BigInt(value.type),value.isNull?1n:0n,BigInt(value.payload.length),...value.payload.map(v=>field(v))]));
}
export function sourceNumberBits(decimalTextValue){
 const d=parseDecimal(decimalTextValue),number=Number(decimalText(d));requireValue(Number.isFinite(number)&&number>=0&&!Object.is(number,-0),'Unsupported header resource projection');
 const bytes=new DataView(new ArrayBuffer(8));bytes.setFloat64(0,number,false);return bytes.getBigUint64(0,false);
}
export function sourceUnixMsProjection(timestamp){
 if(timestamp===null)return null;const pg=pgMicros(timestamp);
 requireValue(pg!==BigInt(PG_TIMESTAMP.negativeInfinity)&&pg!==BigInt(PG_TIMESTAMP.positiveInfinity),'Infinite timestamp cannot project to a finite header/book clock');
 requireValue(pg>=BigInt(SOURCE_DATE_PROJECTION.minimumPgMicros)&&pg<BigInt(SOURCE_DATE_PROJECTION.endPgMicrosExclusive),'Unsupported qualified source-pg8 ISO date projection range; raw value retained');
 const unix=pg+946684800000000n;
 const ms=unix>=0n?unix/1000n:-((-unix+999n)/1000n);
 requireValue(ms>=-8640000000000000n&&ms<=8640000000000000n,'Invalid source JSDate projection');return ms;
}
