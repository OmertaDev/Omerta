import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {loadBundledMarketV2Abi,MARKET_V2_ETH_ABI_NAMES,MARKET_V2_ETH_ABI_DIGEST,ethAbiPackDigest} from '../src/marketv2abi.js';
import {buildEthAbiPack} from '../tools/eth-rewards-abi-pack.js';
const loader=fs.readFileSync('src/marketv2abi.js','utf8'),data=fs.readFileSync('src/data/market-v2-eth-abis.json','utf8'),pack=JSON.parse(data);
let groups=0;
const test=(name,fn)=>{fn();groups++;console.log(`PASS ${name}`);};
function removeFixture(dir){
  const target=fs.realpathSync(dir),parent=fs.realpathSync(os.tmpdir());
  assert.equal(path.dirname(target).toLowerCase(),parent.toLowerCase());
  assert(path.basename(target).startsWith('omerta-eth-abi-')&&target!==parent);
  fs.rmSync(target,{recursive:true,force:true});
}
function isolated({text=data,includeData=true,script}={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omerta-eth-abi-'));
  try{
    fs.mkdirSync(path.join(dir,'src/data'),{recursive:true});
    fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({type:'module'}));
    fs.writeFileSync(path.join(dir,'src/marketv2abi.js'),loader);
    if(includeData)fs.writeFileSync(path.join(dir,'src/data/market-v2-eth-abis.json'),text);
    const file=pathToFileURL(path.join(dir,'src/marketv2abi.js')).href;
    const body=`import assert from 'node:assert/strict';import fs from 'node:fs';import {loadBundledMarketV2Abi,MARKET_V2_ETH_ABI_NAMES} from ${JSON.stringify(file)};\n`
      +(script||`assert.equal(fs.existsSync('omerta-contracts/out'),false);assert.equal(fs.existsSync('node_modules'),false);for(const name of MARKET_V2_ETH_ABI_NAMES)assert(loadBundledMarketV2Abi(name).length>0);console.log('runtime-without-artifacts');`);
    return spawnSync(process.execPath,['--input-type=module','-e',body],{cwd:dir,encoding:'utf8',windowsHide:true,timeout:15000});
  }finally{removeFixture(dir);}
}
test('five bundled ABIs match current native compiler outputs and all dependency source pins',()=>{
  assert.equal(MARKET_V2_ETH_ABI_NAMES.length,5);assert.deepEqual(buildEthAbiPack(),pack);
  for(const name of MARKET_V2_ETH_ABI_NAMES){
    const artifact=JSON.parse(fs.readFileSync(`omerta-contracts/out/${name}.sol/${name}.json`));
    assert.deepEqual(loadBundledMarketV2Abi(name),artifact.abi);
  }
});
test('runtime loads all native ETH jobs in an isolated checkout without out or node_modules',()=>{
  const run=isolated();assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/runtime-without-artifacts/);
});
test('current keeper resolves native ETH signing ABIs without compiler output and rejects tampering',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omerta-eth-abi-keeper-'));
  try{
    fs.mkdirSync(path.join(dir,'src/data'),{recursive:true});
    fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({type:'module'}));
    for(const name of ['marketv2keeper.js','keepertransactions.js','marketv2abi.js'])fs.copyFileSync(`src/${name}`,path.join(dir,'src',name));
    const dataPath=path.join(dir,'src/data/market-v2-eth-abis.json');fs.writeFileSync(dataPath,data);
    const dependencies=Object.fromEntries(['viem','viem/accounts'].map(name=>[name,import.meta.resolve(name)]));
    fs.writeFileSync(path.join(dir,'resolve.mjs'),`const dependencies=${JSON.stringify(dependencies)};export async function resolve(name,context,next){return Object.hasOwn(dependencies,name)?{url:dependencies[name],shortCircuit:true}:next(name,context);}`);
    const keeperUrl=pathToFileURL(path.join(dir,'src/marketv2keeper.js')).href,resolverUrl=pathToFileURL(path.join(dir,'resolve.mjs')).href;
    const prefix=`import assert from 'node:assert/strict';import fs from 'node:fs';import {register} from 'node:module';register(${JSON.stringify(resolverUrl)});const {marketV2Abi}=await import(${JSON.stringify(keeperUrl)});assert.equal(fs.existsSync('omerta-contracts/out'),false);`;
    const run=script=>spawnSync(process.execPath,['--input-type=module','-e',prefix+script],{cwd:dir,encoding:'utf8',windowsHide:true,timeout:15000});
    const clean=run(`for(const name of ${JSON.stringify(MARKET_V2_ETH_ABI_NAMES)})assert(marketV2Abi(name).length>0);assert.throws(()=>marketV2Abi('../../secret'),e=>e.keeperCode==='invalid_artifact');`);
    assert.equal(clean.status,0,clean.stderr);
    const tampered=structuredClone(pack);tampered.contracts.OmertaEthRewardsV2.abi.find(x=>x.type==='function'&&x.name==='fundRewards').name='tamperedFundRewards';
    fs.writeFileSync(dataPath,JSON.stringify(tampered));
    const blocked=run(`assert.throws(()=>marketV2Abi('OmertaEthRewardsV2'),e=>e.keeperCode==='bundled_abi_integrity_mismatch');`);
    assert.equal(blocked.status,0,blocked.stderr);
  }finally{removeFixture(dir);}
});
test('line endings and JSON key order cannot invalidate the published semantic pin',()=>{
  const reordered=Object.fromEntries(Object.entries(pack).reverse());
  assert.equal(ethAbiPackDigest(reordered),MARKET_V2_ETH_ABI_DIGEST);
  const run=isolated({text:JSON.stringify(reordered,null,2).replace(/\n/g,'\r\n')});assert.equal(run.status,0,run.stderr);
});
test('tampered signing ABI fails closed before returning a native ABI',()=>{
  const tampered=structuredClone(pack),fn=tampered.contracts.OmertaEthRewardsV2.abi.find(x=>x.type==='function'&&x.name==='fundRewards');
  fn.inputs[0].type='address';const run=isolated({text:JSON.stringify(tampered)});
  assert.notEqual(run.status,0);assert.match(run.stderr,/bundled_abi_integrity_mismatch/);
});
test('missing and malformed production packs are explicit blocked states',()=>{
  for(const options of[{includeData:false},{text:'{not-json'}]){
    const run=isolated(options);assert.notEqual(run.status,0);assert.match(run.stderr,/bundled_abi_unavailable/);
  }
});
test('unsupported names never select paths and leave generic fallback available',()=>{
  for(const name of['OmertaStabilityControllerV2','../../secret','__proto__','',undefined])assert.equal(loadBundledMarketV2Abi(name),undefined);
  const run=isolated({includeData:false,script:`assert.equal(loadBundledMarketV2Abi('../../secret'),undefined);assert.equal(loadBundledMarketV2Abi('OmertaStabilityControllerV2'),undefined);`});
  assert.equal(run.status,0,run.stderr);
});
test('returned ABIs cannot be mutated between planning and signing',()=>{
  const abi=loadBundledMarketV2Abi('OmertaEthRewardsV2');assert(Object.isFrozen(abi));assert(Object.isFrozen(abi[0]));
  assert.throws(()=>{abi.push({type:'function',name:'arbitraryCall'});},TypeError);
  const fn=abi.find(x=>x.type==='function'&&x.inputs.length);assert(Object.isFrozen(fn.inputs[0]));
  assert.throws(()=>{fn.inputs[0].type='address';},TypeError);
});
test('offline pack check verifies the exact current build without rewriting runtime files',()=>{
  const run=spawnSync(process.execPath,['tools/eth-rewards-abi-pack.js','--check'],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).contracts,5);
  assert.equal(fs.readFileSync('src/marketv2abi.js','utf8'),loader);assert.equal(fs.readFileSync('src/data/market-v2-eth-abis.json','utf8'),data);
});
test('offline regeneration rejects stale source even when an artifact declares the right compiler',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'omerta-eth-abi-stale-'));
  try{
    const name=MARKET_V2_ETH_ABI_NAMES[0],artifact=fs.readFileSync(`omerta-contracts/out/${name}.sol/${name}.json`),parsed=JSON.parse(artifact);
    const metadata=JSON.parse(parsed.rawMetadata);
    fs.mkdirSync(path.join(dir,`out/${name}.sol`),{recursive:true});fs.writeFileSync(path.join(dir,`out/${name}.sol/${name}.json`),artifact);
    for(const file of Object.keys(metadata.sources)){const dest=path.join(dir,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join('omerta-contracts',file),dest);}
    fs.appendFileSync(path.join(dir,`src/market-v2/${name}.sol`),'\n// stale source probe\n');
    assert.throws(()=>buildEthAbiPack({contractsRoot:dir}),/stale artifact/);
  }finally{removeFixture(dir);}
});
console.log(JSON.stringify({pass:true,groups,contracts:5,semanticDigest:MARKET_V2_ETH_ABI_DIGEST,network:false,productionWrites:false,productionSigning:false}));
