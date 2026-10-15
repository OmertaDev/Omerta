import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions,renderMedia,renderStill} from '@remotion/renderer';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const root=path.resolve(project,'../..');
const output=path.join(root,'output/brainrot-r3');fs.mkdirSync(output,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/art/brainrot-r3/manifest.json'),'utf8'));
// Bundle only selected local production inputs, not the whole game's media library.
const stage=path.join(output,'render-public');fs.mkdirSync(path.join(stage,'art/brainrot-r3/refs'),{recursive:true});
const inputs=new Set(['art/brainrot-r3/manifest.json','art/brainrot-r3/refs/R3-C03-poly.png',...Object.values(manifest.assets).map(a=>a.src),...Object.values(manifest.audio).map(a=>typeof a==='string'?a:a.src)]);
for(const src of inputs){if(!src||src.includes('..')||src.includes(':'))throw new Error('Unexpected local asset path');const target=path.join(stage,src);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,'public',src),target);}
const serveUrl=await bundle({entryPoint:path.join(project,'src/brainrot-r3/index.ts'),publicDir:stage,rspack:false});
const compositions=await getCompositions(serveUrl);
const selected=process.argv.find(a=>a.startsWith('--id='))?.slice(5);
const full=process.argv.includes('--full');const stillsOnly=process.argv.includes('--stills');const scale=full?1:0.5;
for(const c of compositions.filter(c=>!selected||c.id===selected)){
 const prefix=`${c.id}${full?'-1080':'-draft'}`;
 for(const frame of [10,230,550,814].filter(n=>n<c.durationInFrames))await renderStill({serveUrl,composition:c,frame,output:path.join(output,`${prefix}-${frame}.png`),imageFormat:'png',scale:0.5});
 if(!stillsOnly){let last=0;await renderMedia({serveUrl,composition:c,outputLocation:path.join(output,`${prefix}.mp4`),codec:'h264',crf:full?18:22,scale,pixelFormat:'yuv420p',audioBitrate:'256k',colorSpace:'bt709',concurrency:4,overwrite:true,onProgress:({progress})=>{if(Date.now()-last>15000){console.log(`${prefix}: ${Math.round(progress*100)}%`);last=Date.now();}}});console.log(`${prefix}: rendered ${c.durationInFrames/c.fps}s`);}
}
