// Copy the explicitly inventoried public source and evidence into an immutable archive staging tree.
// No environment files, private keys, PostgreSQL data directory, node_modules or compiler cache.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(), dir='omerta-contracts/audits/2026-09-08-comprehensive';
const stage='output/comprehensive-audit/review-package';
if(fs.existsSync(stage))throw Error('Refusing to overwrite existing package staging tree');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=new Set();
for(const f of read(dir+'/source-manifest.json').files)files.add(f.path);
const evidence=read(dir+'/evidence-manifest.json');
for(const f of [...evidence.files,...evidence.forkEvidence])files.add(f.path);
for(const f of read(dir+'/external-integration-source-hashes.json').entries)files.add(f.path);
for(const f of read(dir+'/launcher-source-manifest.json').files)files.add(f.path);
for(const name of fs.readdirSync(dir))if(fs.statSync(dir+'/'+name).isFile()&&name!=='package-manifest.json')files.add(dir+'/'+name);
const records=[];
for(const file of [...files].sort()) {
  const source=path.resolve(root,file);
  if(!source.startsWith(root+path.sep))throw Error('Source outside workspace '+file);
  if(/(^|\/)\.env(?:[.\/]|$)|pg-data|node_modules|\.git\//.test(file))throw Error('Excluded file '+file);
  const data=fs.readFileSync(source), destination=path.resolve(root,stage,file);
  if(!destination.startsWith(path.resolve(root,stage)+path.sep))throw Error('Destination escaped staging tree');
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,data);
  records.push({path:file,bytes:data.length,sha256:sha(data)});
}
const manifest={generatedAt:new Date().toISOString(),chainId:4663,sourceTreeSha256:evidence.sourceTreeSha256,
  note:'Content inventory for bundled public source/evidence. The manifest excludes itself to avoid a circular hash. Native binaries and dependency package installs are not bundled.',files:records};
const text=JSON.stringify(manifest,null,2)+'\n';
fs.writeFileSync(dir+'/package-manifest.json',text);
fs.writeFileSync(stage+'/package-manifest.json',text);
console.log(JSON.stringify({stage,files:records.length,bytes:records.reduce((n,f)=>n+f.bytes,0),packageManifestSha256:sha(text)}));
