#!/usr/bin/env node
// Offline generation/check only. Runtime consumes the tracked pack and requires no compiler output.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {keccak256,toHex} from 'viem';
import {MARKET_V2_ETH_ABI_NAMES,MARKET_V2_ETH_ABI_DIGEST,ethAbiPackDigest} from '../src/marketv2abi.js';
const repo=fileURLToPath(new URL('../',import.meta.url)),root=path.join(repo,'omerta-contracts');
const dataFile=path.join(repo,'src/data/market-v2-eth-abis.json'),loaderFile=path.join(repo,'src/marketv2abi.js');
const sources=Object.fromEntries(MARKET_V2_ETH_ABI_NAMES.map(name=>[name,`src/market-v2/${name==='OmertaPoolManagerV2'?'core/':''}${name}.sol`]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const abiIdentity=abi=>JSON.stringify(abi.map(item=>JSON.stringify(canonical(item))).sort());
const within=(base,file)=>{const rel=path.relative(base,file);return rel!==''&&!rel.startsWith(`..${path.sep}`)&&rel!=='..'&&!path.isAbsolute(rel);};
function atomicWrite(file,text){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const prior=fs.existsSync(file)?fs.readFileSync(file):undefined,temp=`${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp,text,{flag:'wx'});
  assert(prior?fs.readFileSync(file).equals(prior):!fs.existsSync(file),'Concurrent ABI pack edit');
  fs.renameSync(temp,file);
}
export function buildEthAbiPack({contractsRoot=root}={}){
  const base=fs.realpathSync(contractsRoot),pack={schemaVersion:1,kind:'native-eth-keeper-abis',contracts:{},sources:{}};
  for(const name of MARKET_V2_ETH_ABI_NAMES){
    const artifactFile=path.join(base,`out/${name}.sol/${name}.json`),bytes=fs.readFileSync(artifactFile),a=JSON.parse(bytes);
    const m=typeof a.rawMetadata==='string'?JSON.parse(a.rawMetadata):a.metadata;
    assert(m?.settings?.compilationTarget?.[sources[name]]===name,`${name}: wrong compilation target`);
    assert(m.compiler.version.startsWith('0.8.38+')&&m.settings.optimizer.enabled&&m.settings.optimizer.runs===800
      &&m.settings.evmVersion==='cancun'&&Boolean(m.settings.viaIR)===(name!=='OmertaPoolManagerV2'),`${name}: compiler settings mismatch`);
    assert(Array.isArray(a.abi)&&abiIdentity(a.abi)===abiIdentity(m.output.abi),`${name}: ABI/metadata mismatch`);
    for(const field of ['bytecode','deployedBytecode'])assert(/^0x(?:[\da-f]{2})+$/i.test(a[field]?.object||'')
      &&!Object.keys(a[field].linkReferences||{}).length,`${name}: unresolved bytecode`);
    const sourcePins={};
    for(const[file,pin]of Object.entries(m.sources)){
      const target=path.resolve(base,file),dependency=/^lib\/(openzeppelin-contracts|v4-core|v4-periphery|permit2)\//.exec(file);
      const mount=dependency?fs.realpathSync(path.join(base,'lib',dependency[1])):base;
      assert(within(base,target)&&within(mount,fs.realpathSync(target)),`${name}: source escaped approved contracts/dependency mount`);
      const raw=fs.readFileSync(target),lf=raw.toString('utf8').replace(/\r\n/g,'\n');
      assert([keccak256(toHex(raw)),keccak256(toHex(lf))].includes(pin.keccak256),`${name}: stale artifact for ${file}`);
      const normalized={sha256Lf:sha(lf)};
      if(pack.sources[file])assert.deepEqual(pack.sources[file],normalized,`${name}: conflicting source pin`);
      pack.sources[file]=normalized;sourcePins[file]=pin.keccak256;
    }
    pack.contracts[name]={source:sources[name],artifactSha256:sha(bytes),
      creationBytecodeHash:keccak256(a.bytecode.object),runtimeTemplateHash:keccak256(a.deployedBytecode.object),
      compiler:{version:m.compiler.version,optimizer:true,runs:800,evmVersion:'cancun',viaIr:Boolean(m.settings.viaIR)},sourcePins,abi:a.abi};
  }
  return canonical(pack);
}
export function assertEthAbiPackMatchesCompilation(published,compiled){
  const digest=ethAbiPackDigest(published);
  assert.equal(digest,MARKET_V2_ETH_ABI_DIGEST,'Published bundled ABI integrity mismatch');
  // The published digest retains its original raw artifact provenance. Fresh
  // compiler JSON containers may differ while the complete contract tuple agrees.
  const current=compiled===undefined?buildEthAbiPack():compiled,contracts={...published.contracts},artifactContainerDifferences=[];
  for(const name of MARKET_V2_ETH_ABI_NAMES){
    const currentSha256=current?.contracts?.[name]?.artifactSha256;
    assert.equal(typeof currentSha256,'string',`${name}: current artifact container hash required`);
    assert.match(currentSha256,/^[\da-f]{64}$/,`${name}: invalid current artifact container hash`);
    const publishedSha256=published.contracts[name].artifactSha256;
    if(currentSha256!==publishedSha256)artifactContainerDifferences.push({name,publishedSha256,currentSha256});
    contracts[name]={...published.contracts[name],artifactSha256:currentSha256};
  }
  assert.deepEqual(current,{...published,contracts},'Bundled ABI data differs from current compiled source');
  return{semanticDigest:digest,artifactContainerDifferences};
}
async function main(){
  const args=process.argv.slice(2);assert(args.length===1&&['--check','--write'].includes(args[0]),'Usage: node tools/eth-rewards-abi-pack.js --check|--write');
  let digest,sourcePins,artifactContainerDifferences=[];
  if(args[0]==='--write'){
    const pack=buildEthAbiPack();digest=ethAbiPackDigest(pack);sourcePins=Object.keys(pack.sources).length;
    const old=fs.readFileSync(loaderFile,'utf8'),next=old.replace(/(export const MARKET_V2_ETH_ABI_DIGEST=')[\da-f]{64}(';)/,`$1${digest}$2`);
    assert(next!==old||MARKET_V2_ETH_ABI_DIGEST===digest,'ABI integrity literal not found');
    atomicWrite(dataFile,JSON.stringify(pack,null,2)+'\n');if(next!==old)atomicWrite(loaderFile,next);
  }else{
    const published=JSON.parse(fs.readFileSync(dataFile,'utf8'));
    ({semanticDigest:digest,artifactContainerDifferences}=assertEthAbiPackMatchesCompilation(published));
    sourcePins=Object.keys(published.sources).length;
  }
  console.log(JSON.stringify({status:'PASS',mode:args[0],contracts:MARKET_V2_ETH_ABI_NAMES.length,
    sourcePins,semanticDigest:digest,
    artifactContainerDifferences,productionWrites:false,productionSigning:false}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
