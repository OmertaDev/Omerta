import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const dir=path.join(root,'public/art/cinematic-r4');
const dimensions=JSON.parse(execFileSync('C:/Users/Jorge/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-c','import json,sys; from PIL import Image; from pathlib import Path; print(json.dumps({p.name: {"width":Image.open(p).width,"height":Image.open(p).height,"format":Image.open(p).format} for p in Path(sys.argv[1]).glob("*.png")}))',path.join(dir,'captures')],{encoding:'utf8'}));
const world=new Set(['cases','case-detail','evidence','coordination','roles','knowledge','consigliere','approval','history']);
const captures={};
for(const file of fs.readdirSync(path.join(dir,'captures')).filter(f=>f.endsWith('.png'))){
 const bytes=fs.readFileSync(path.join(dir,'captures',file));const id=file.replace(/\.png$/,'');
 captures[id]={src:`art/cinematic-r4/captures/${file}`,...dimensions[file],sha256:crypto.createHash('sha256').update(bytes).digest('hex'),source:`http://127.0.0.1:${world.has(id)?8825:8824}/${['consigliere','approval','knowledge'].includes(id)?'consigliere':''}`,caption:'OMERTÀ · local preview build',provenance:'Screenshot of actual repository UI with synthetic local accounts; no production balance or activation claim.',capturedAt:fs.statSync(path.join(dir,'captures',file)).mtime.toISOString()};
}
const manifestPath=path.join(dir,'manifest.json');const existing=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{};
const manifest={version:4,createdAt:new Date().toISOString(),sourceRevision:'32859cf7d198d2a003160b2bb1ef005991697d73 (fact audit); current dirty local checkout for captures',captures,audio:existing.audio||{}};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const production=JSON.parse(fs.readFileSync(path.join(root,'brand/cinematic-video-system/production-data.json'),'utf8'));
const missing=[...new Set(production.films.flatMap(f=>f.beats.flatMap(b=>b.screens?.length?b.screens:b.screen?[b.screen]:[])))].filter(id=>!captures[id]);
console.log(JSON.stringify({captures:Object.keys(captures).length,missing},null,2));if(missing.length)process.exitCode=1;
