import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = 'omerta-contracts', audit = `${root}/audits/2026-10-01-red-team`;
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const save = (name, value) => fs.writeFileSync(`${audit}/${name}.json`, JSON.stringify(value, null, 2)+'\n');
const sources = walk(`${root}/src`).filter(f=>f.endsWith('.sol')).sort();
save('final-source-hashes', sources.map(f=>({path:f,sha256:hash(f)})));
save('final-test-hashes', walk(`${root}/test`).filter(f=>f.endsWith('.sol')).sort().map(f=>({path:f,sha256:hash(f)})));
const artifacts = [], settings = [], dependencies = {};
for (const f of walk(`${root}/out`).filter(f=>f.endsWith('.json')&&!f.includes('/build-info/'))) {
  const artifact = JSON.parse(fs.readFileSync(f,'utf8'));
  const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
  if (!metadata || !Object.keys(metadata.settings.compilationTarget ?? {}).some(p=>p.startsWith('src/'))) continue;
  const runtime = (artifact.deployedBytecode?.object ?? '').replace(/^0x/,'');
  const creation = (artifact.bytecode?.object ?? '').replace(/^0x/,'');
  artifacts.push({path:f,sha256:hash(f),runtimeBytes:runtime.length/2,creationBytes:creation.length/2});
  settings.push({artifact:f,compiler:metadata.compiler.version,settings:metadata.settings});
  for (const [source, value] of Object.entries(metadata.sources)) dependencies[source]=value.keccak256;
}
save('final-artifact-hashes',artifacts); save('final-compiler-settings',settings); save('final-dependency-hashes',dependencies);
console.log(JSON.stringify({sourceFiles:sources.length,artifacts:artifacts.length,maxRuntime:Math.max(...artifacts.map(a=>a.runtimeBytes)),maxCreation:Math.max(...artifacts.map(a=>a.creationBytes))}));
