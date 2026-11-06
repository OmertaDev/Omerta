// Reviewed native ETH keeper ABIs travel with the Node deployment; Forge is not a runtime dependency.
import fs from 'node:fs';
import {createHash} from 'node:crypto';

export const MARKET_V2_ETH_ABI_NAMES=Object.freeze([
  'OmertaEthRewardsV2','OmertaEthStakingV2','OmertaMarketStateV2','OmertaHookV2','OmertaPoolManagerV2',
]);
export const MARKET_V2_ETH_ABI_DIGEST='ed64becb0cd97f18f34638892c3b67223e8373bc1bb40be38e57383a576611ad';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const ethAbiPackDigest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const reject=reason=>{throw Object.assign(new Error(reason),{keeperCode:reason});};
const requireThat=(value,reason)=>{if(!value)reject(reason);};
const hash=/^[\da-f]{64}$/i,codeHash=/^0x[\da-f]{64}$/i;
const sourceName=value=>typeof value==='string'&&!value.startsWith('/')&&!value.includes('\\')
  &&!value.split('/').includes('..')&&/^(src|lib)\/.+\.sol$/.test(value);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function parameter(p){
  requireThat(object(p)&&typeof p.type==='string'
    &&/^(?:u?int(?:[0-9]{1,3})?|bytes(?:[0-9]{1,2})?|bool|string|address|tuple)(?:\[[0-9]*\])*$/.test(p.type),'invalid_bundled_abi_parameter');
  if(p.type.startsWith('tuple')){requireThat(Array.isArray(p.components),'invalid_bundled_abi_tuple');p.components.forEach(parameter);}
}
function checkAbi(abi){
  requireThat(Array.isArray(abi)&&abi.length>0&&abi.length<500,'invalid_bundled_abi');
  for(const item of abi){
    requireThat(object(item)&&['function','event','error','constructor','fallback','receive'].includes(item.type),'invalid_bundled_abi_entry');
    if(['function','event','error'].includes(item.type))requireThat(/^[A-Za-z_$][\w$]*$/.test(item.name||''),'invalid_bundled_abi_name');
    if(['function','event','error','constructor'].includes(item.type)){requireThat(Array.isArray(item.inputs),'invalid_bundled_abi_inputs');item.inputs.forEach(parameter);}
    if(item.type==='function'){
      requireThat(Array.isArray(item.outputs)&&['pure','view','nonpayable','payable'].includes(item.stateMutability),'invalid_bundled_abi_function');
      item.outputs.forEach(parameter);
    }
  }
}
function validate(pack){
  requireThat(object(pack)&&pack.schemaVersion===1&&pack.kind==='native-eth-keeper-abis','invalid_bundled_abi_schema');
  requireThat(object(pack.contracts)&&Object.keys(pack.contracts).length===MARKET_V2_ETH_ABI_NAMES.length
    &&MARKET_V2_ETH_ABI_NAMES.every(name=>Object.hasOwn(pack.contracts,name)),'invalid_bundled_abi_contracts');
  requireThat(object(pack.sources)&&Object.keys(pack.sources).length>0,'invalid_bundled_abi_sources');
  for(const[file,pin]of Object.entries(pack.sources))requireThat(sourceName(file)&&object(pin)&&hash.test(pin.sha256Lf),'invalid_bundled_abi_source_pin');
  for(const name of MARKET_V2_ETH_ABI_NAMES){
    const c=pack.contracts[name];
    requireThat(object(c)&&sourceName(c.source)&&hash.test(c.artifactSha256)&&codeHash.test(c.creationBytecodeHash)
      &&codeHash.test(c.runtimeTemplateHash)&&object(c.compiler),'invalid_bundled_abi_contract_pin');
    requireThat(/^0\.8\.38\+/.test(c.compiler.version)&&c.compiler.optimizer===true&&c.compiler.runs===800
      &&c.compiler.evmVersion==='cancun'&&c.compiler.viaIr===(name!=='OmertaPoolManagerV2'),'invalid_bundled_abi_compiler');
    requireThat(object(c.sourcePins)&&Object.hasOwn(c.sourcePins,c.source),'invalid_bundled_abi_source_pin');
    for(const[file,pin]of Object.entries(c.sourcePins))requireThat(Object.hasOwn(pack.sources,file)&&codeHash.test(pin),'invalid_bundled_abi_source_pin');
    checkAbi(c.abi);
  }
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
let bundle;
export function loadBundledMarketV2Abi(name){
  if(!MARKET_V2_ETH_ABI_NAMES.includes(name))return undefined;
  if(!bundle){
    let parsed;
    try{parsed=JSON.parse(fs.readFileSync(new URL('./data/market-v2-eth-abis.json',import.meta.url),'utf8'));}
    catch{reject('bundled_abi_unavailable');}
    requireThat(ethAbiPackDigest(parsed)===MARKET_V2_ETH_ABI_DIGEST,'bundled_abi_integrity_mismatch');
    validate(parsed);bundle=freeze(parsed);
  }
  return bundle.contracts[name].abi;
}
