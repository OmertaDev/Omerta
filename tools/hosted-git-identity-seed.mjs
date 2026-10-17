import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
export function packageIdentity(text){
  const fields=text.trim().split(String.fromCharCode(9));
  assert.equal(fields.length,3);assert.equal(fields[0],'git');
  assert.match(fields[1],/^[0-9A-Za-z:.+~_-]{1,160}$/);assert.equal(fields[2],'amd64');
  return {name:fields[0],version:fields[1],architecture:fields[2]};
}
if(process.argv[2]==='--self-test'){
  assert.equal(process.argv.length,3);let positive=0,refusal=0;
  for(const version of ['1:2.43.0-1ubuntu7.3','1:2.51.1-0ppa1~ubuntu24.04.1']){assert.equal(packageIdentity(['git',version,'amd64'].join(String.fromCharCode(9))).version,version);positive++;}
  for(const value of ['git','git\tbad version\tamd64','git\t2.1/evil\tamd64','bash\t2.1\tamd64','git\t2.1\tarm64']){assert.throws(()=>packageIdentity(value));refusal++;}
  console.log(JSON.stringify({phase:'CAPTURE_ONLY_PACKAGE_IDENTITY_CONTROLS',positive,refusal,PG:false,network:false,approval:false}));
}else{
  assert.equal(process.argv.length,2);assert.deepEqual(process.execArgv,[]);
  assert.equal(process.platform,'linux');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'OmertaDev/Omerta');
  for(const name of ['NODE_OPTIONS','NODE_PATH'])assert(!Object.hasOwn(process.env,name));
  assert.match(process.env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
  const workspace=fs.realpathSync(process.env.GITHUB_WORKSPACE),parent=fs.realpathSync(process.env.RUNNER_TEMP);
  const output=fs.mkdtempSync(path.join(parent,'omerta-public-git-seed-'));assert(!output.includes(String.fromCharCode(10)));
  fs.appendFileSync(process.env.GITHUB_OUTPUT,'artifactPath='+output+String.fromCharCode(10));
  const records=[];
  function command(file,args,cwd=workspace,timeout=30000){const r=spawnSync(file,args,{cwd,encoding:'utf8',shell:false,timeout,maxBuffer:2*1024*1024});const entry={file,args,code:r.status,signal:r.signal,error:r.error?.code??null,stdout:r.stdout??'',stderr:r.stderr??''};records.push(entry);return entry;}
  const lookup=command('/usr/bin/which',['git']);assert.equal(lookup.code,0);assert.equal(lookup.error,null);
  const gitPath=fs.realpathSync(lookup.stdout.trim());assert(path.isAbsolute(gitPath));assert(fs.statSync(gitPath).isFile());
  const version=command(gitPath,['--version','--build-options']);assert.equal(version.code,0);
  const source=command(gitPath,['--no-replace-objects','rev-parse','HEAD']);assert.equal(source.code,0);assert.equal(source.stdout.trim(),process.env.GITHUB_SHA);
  const dirty=command(gitPath,['status','--porcelain']);assert.equal(dirty.code,0);assert.equal(dirty.stdout,'');
  const identityResult=command('/usr/bin/dpkg-query',['-W','-f=${Package}\t${Version}\t${Architecture}\n','git']);assert.equal(identityResult.code,0);
  const pkg=packageIdentity(identityResult.stdout);
  command('/usr/bin/dpkg-query',['-S',gitPath]);
  command('/usr/bin/apt-cache',['policy','git']);
  command('/usr/bin/apt-cache',['show','git='+pkg.version]);
  const debs=path.join(output,'debs');fs.mkdirSync(debs);
  const packageDownload=command('/usr/bin/apt-get',['download','git='+pkg.version],debs,120000);
  const packages=fs.readdirSync(debs).sort().map(name=>{assert(name.endsWith('.deb'));const file=path.join(debs,name);assert(fs.lstatSync(file).isFile());const b=fs.readFileSync(file);return {file:'debs/'+name,bytes:b.length,sha256:hash(b)};});
  const publicNames=['ImageOS','ImageVersion','RUNNER_ARCH','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_SHA','GITHUB_WORKFLOW_REF','GITHUB_WORKFLOW_SHA'];
  const gitBytes=fs.readFileSync(gitPath);fs.writeFileSync(path.join(output,'observed-git.bin'),gitBytes,{flag:'wx'});
  const ownSource=fs.readFileSync(fileURLToPath(import.meta.url));fs.writeFileSync(path.join(output,'capture-source.mjs'),ownSource,{flag:'wx'});
  const workflow=fs.readFileSync(path.join(workspace,'.github/workflows/rc1-recovery.yml'));fs.writeFileSync(path.join(output,'capture-workflow.yml'),workflow,{flag:'wx'});
  const receipt={phase:'PUBLIC_RUNTIME_CAPTURE_ONLY_NOT_PROOF_OR_APPROVAL',captureComplete:true,capturedAt:new Date().toISOString(),source:process.env.GITHUB_SHA,runner:Object.fromEntries(publicNames.map(n=>[n,process.env[n]??null])),os:{platform:os.platform(),release:os.release(),architecture:os.arch()},node:{version:process.version,path:fs.realpathSync(process.execPath),sha256:hash(fs.readFileSync(process.execPath))},git:{path:gitPath,sha256:hash(gitBytes),bytes:gitBytes.length,package:pkg},packageDownloadSucceeded:packageDownload.code===0&&packageDownload.signal===null&&packageDownload.error===null,packages,commands:records,runtimeApproved:false,independentDistributionVerified:false,PG:false,Docker:false,sourcePair:false,financialTransactions:0,secretsIncluded:false};
  fs.writeFileSync(path.join(output,'capture.json'),JSON.stringify(receipt,null,2)+String.fromCharCode(10),{flag:'wx'});
  const files=fs.readdirSync(output,{recursive:true,withFileTypes:true}).filter(d=>d.isFile()).map(d=>{const file=path.join(d.parentPath??d.path,d.name),bytes=fs.readFileSync(file);return {file:path.relative(output,file).split(path.sep).join('/'),sha256:hash(bytes),bytes:bytes.length};}).sort((a,b)=>a.file.localeCompare(b.file));
  fs.writeFileSync(path.join(output,'sha256-index.json'),JSON.stringify({phase:receipt.phase,files},null,2)+String.fromCharCode(10),{flag:'wx'});
  console.log(JSON.stringify({phase:receipt.phase,source:receipt.source,git:receipt.git,packageDownloadSucceeded:receipt.packageDownloadSucceeded,artifactPath:output,runtimeApproved:false,sourcePair:false}));
}