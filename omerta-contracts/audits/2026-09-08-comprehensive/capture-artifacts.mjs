// Run from repository root after canonical build. Templates are not deployed runtime bytecode.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { keccak256 } from 'viem';
const root='omerta-contracts', output=root+'/audits/2026-09-08-comprehensive/artifact-manifest.json';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hex=b=>'0x'+Buffer.from(b).toString('hex');
const entries=[];
for(const name of fs.readdirSync(root+'/src').filter(x=>x.endsWith('.sol')&&x!=='IOmrOracle.sol').map(x=>x.slice(0,-4)).sort()) {
  const file=`${root}/out/${name}.sol/${name}.json`, raw=fs.readFileSync(file), artifact=JSON.parse(raw);
  const metadata=typeof artifact.rawMetadata==='string'?JSON.parse(artifact.rawMetadata):artifact.metadata;
  const source=fs.readFileSync(`${root}/src/${name}.sol`), sourceLF=Buffer.from(source.toString('utf8').replaceAll('\r\n','\n'));
  const sourceKeccak=metadata.sources[`src/${name}.sol`].keccak256;
  const sourceMatches=sourceKeccak===keccak256(hex(source))?'exact bytes':sourceKeccak===keccak256(hex(sourceLF))?'CRLF-to-LF equivalent':null;
  if(!sourceMatches)throw Error('Artifact source drift '+name);
  const bytecode=artifact.bytecode.object, runtime=artifact.deployedBytecode.object;
  if(!/^0x[0-9a-fA-F]*$/.test(bytecode)||!/^0x[0-9a-fA-F]*$/.test(runtime))throw Error('Unresolved link '+name);
  const runtimeBytes=(runtime.length-2)/2, initcodeBytes=(bytecode.length-2)/2;
  if(runtimeBytes>24576||initcodeBytes>49152)throw Error('Production template exceeds size limit '+name);
  entries.push({name,path:file,artifactSha256:sha(raw),sourceSha256:sha(source),compiledSourceKeccak256:sourceKeccak,sourceMatches,
    compiler:metadata.compiler.version,settings:metadata.settings,runtimeBytes,initcodeBytes,
    runtimeTemplateKeccak256:keccak256(runtime),initcodeTemplateKeccak256:keccak256(bytecode),
    immutableReferences:artifact.deployedBytecode.immutableReferences??{},linkReferences:artifact.bytecode.linkReferences??{}});
}
fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),note:'Canonical local artifacts, including abstract FlashGuard (zero bytecode). Constructor arguments and immutable values must be applied for deployment verification. Sizes do not include constructor arguments; check final transaction initcode separately.',entries},null,2)+'\n');
console.log(JSON.stringify({entries:entries.length,concrete:entries.filter(e=>e.runtimeBytes>0).length,largestRuntime:entries.reduce((a,b)=>a.runtimeBytes>b.runtimeBytes?a:b).name,output}));
