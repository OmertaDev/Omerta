import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions,renderMedia,renderStill} from '@remotion/renderer';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const phase=process.argv.includes('--walkthrough')?'walkthrough':'teasers';
const output=path.resolve(project,`../connected-city-materials/${phase}`);
fs.mkdirSync(output,{recursive:true});
const serveUrl=await bundle({entryPoint:path.join(project,`src/marketing-extension/${phase}.tsx`),publicDir:path.resolve(project,'../../public'),rspack:false});
const compositions=await getCompositions(serveUrl);
for(const composition of compositions){
 await renderStill({serveUrl,composition,frame:75,imageFormat:'png',output:path.join(output,`${composition.id}.png`)});
 let last=0;console.log(`Rendering ${composition.id}`);
 await renderMedia({serveUrl,composition,codec:'h264',outputLocation:path.join(output,`${composition.id}.mp4`),crf:20,pixelFormat:'yuv420p',concurrency:4,onProgress:({progress})=>{if(Date.now()-last>20000){console.log(`${composition.id}: ${Math.round(progress*100)}%`);last=Date.now();}}});
}
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Omertà ${phase}</title><link rel="stylesheet" href="../style.css"><main class="shell" style="padding-block:50px"><a href="../index.html">← The connected city</a><p class="eyebrow" style="margin-top:40px">${phase==='teasers'?'Three 15-second ideas · silent':'Actual local implementation · narrated demonstration'}</p><h1 style="font-size:70px">${phase==='teasers'?'Make the connection.':'Inside the implementation.'}</h1><p>${phase==='teasers'?'Noir motion, one mechanism and a clear invitation.':'Captured from the repository’s real local interface and API handlers using synthetic demo accounts. No production state is used.'}</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:30px">${compositions.map(c=>`<figure style="margin:0"><video controls preload="none" poster="${c.id}.png" src="${c.id}.mp4" aria-label="${esc(c.id)}" style="width:100%"></video><figcaption><h2 style="font-size:32px">${esc(c.props.data?.title??'Inside Omertà')}</h2><a href="${c.id}.mp4" download>Download MP4 ↓</a></figcaption></figure>`).join('')}</div></main></html>`);
console.log(`${phase} complete`);
