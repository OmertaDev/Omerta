// The video provider rejected realistic human faces. This creates visibly nonreal
// game artwork from new text-only character designs, without the rejected images.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const out=path.resolve(here,'../../public/art/brainrot-r3');
const d=JSON.parse(fs.readFileSync(path.join(here,'production-source.json'),'utf8'));
const requests=path.join(here,'generation-requests');fs.mkdirSync(requests,{recursive:true});
const style='Visibly stylized low-poly video-game render, coarse angular polygon mesh, flat vertex colors, hard planar shading, chunky mitten hands, abstract geometric faces with flat rectangular eyes. Clearly fictional digital avatars, not photos or real human likenesses. Full-size in-game environment, not a toy or miniature. Original 2000s mod-scene visual language without copying any actual game, franchise character, map, logo or UI. Acid-lime, cobalt, bone, black and sparse red. Ugly direct-flash-like vertex lighting, fisheye game camera. Vertical 9:16. Blank screens and notices, all typography added in edit. No photoreal skin, facial texture, photographic human face, human scan, celebrity, live-action footage, pores, realistic eyes, fine hair strands, motion blur, cinematic haze or neon skyline.';
const designs=[
 'Adult female avatar with an angular wedge head, flat tan vertex color, a short pale-yellow polygon cap for buzzcut hair, one simple diagonal eyebrow line. Oversized silver faceted windbreaker, deep-violet mitten-shaped gloves, black blocky cargo trousers. Slouching, puzzled stance.',
 'Adult male avatar with a broad hexagonal head, flat dark-brown vertex color, tiny rectangular eyes and a plain black low-poly fisherman hat. Bright-orange blocky raincoat, one simple white earpiece line. Upright, unimpressed stance.',
 'Adult female adviser avatar with a long faceted rectangular head, flat neutral-tan vertex color, black angular swept-back hair shape crossed by one solid white stripe. Bone-gray sharp-shouldered suit, one thin silver earpiece line, black mitten fingertips. Dry unimpressed stance.',
 'Adult female avatar with a triangular faceted head, flat neutral-brown vertex color, chunky black pixie-hair wedges, oversized solid-teal square glasses. Black angular poncho and hot-pink square wristwatch. Precise impatient stance.'
];
const chars=d.characters.map((c,i)=>({...c,polyId:`${c.id}-poly`,polyDescription:designs[i],polyPrompt:`${style} Single full-body character reference on a plain cold-gray background. ${designs[i]} One front three-quarter standing pose. Both blocky hands visible, whole feet visible. No contact sheet, no other people.`}));
fs.writeFileSync(path.join(requests,'poly-characters.json'),JSON.stringify(chars.map(c=>({id:c.polyId,model:'bytedance/seedream/v5/pro/text-to-image',input:{prompt:c.polyPrompt,image_size:{width:1080,height:1920},num_images:1,output_format:'png',enable_safety_checker:true},folder:'refs',ext:'png'})),null,2)+'\n');
const ledger=JSON.parse(fs.readFileSync(path.join(out,'generation-ledger.json'),'utf8'));
if(chars.every(c=>ledger.jobs[c.polyId]?.status==='downloaded')){
 const jobs=[];
 for(const f of d.films)for(const s of f.shots){
  const cast=chars.filter(c=>s.characters.includes(c.id));
  const prompt=`${style} Match only the supplied clearly polygonal game-avatar designs. ${cast.map(c=>c.polyDescription).join(' ')} Compose this new in-game scene: ${s.visual} Location: ${s.environment}. Camera: ${s.camera}. Lighting must remain coarse game-engine vertex lighting, never photographic. Everything is built from obvious flat-shaded polygons. Main action visible immediately, caption region below center. No text.`;
  const refs=cast.map(c=>ledger.jobs[c.polyId].url);
  jobs.push({id:`${s.id}-poly-first`,model:refs.length?'bytedance/seedream/v5/pro/edit':'bytedance/seedream/v5/pro/text-to-image',input:{prompt,...(refs.length?{image_urls:refs}:{}),image_size:{width:1080,height:1920},num_images:1,output_format:'png',enable_safety_checker:true},folder:'frames',ext:'png'});
  s.firstFramePrompt=prompt;s.generationPrompt=`${style} Animate this visibly polygonal game scene without changing mesh shapes, identities or props. ${s.action} Camera: ${s.camera}. Keep all faces abstract and low-poly, all surfaces flat-shaded. One coherent five-second in-engine shot. No dialogue, no music. No text or GUI. Shot-specific failure conditions: ${s.negativePromptAndFailureConditions.split('Shot-specific:').at(-1)}`;
  s.referenceAssets=[...cast.map(c=>c.polyId),`frames/${s.id}-poly-first.png`,'Authorized release captures specified in timeline'];
  s.visualTreatment='Visibly stylized low-poly game scene; never a photorealistic person';
 }
 const hookLines=[['The key needs a raid.','My guild is a locksmith.','This key needs management.'],['My cargo got political.','My delivery has enemies.','The box needs accountants.'],['Interrogate the wall.','Your spy needs permission.','Bro submitted screenshots.']];
 for(const [i,f] of d.films.entries())for(const [j,v] of f.variants.entries()){
  v.speech=hookLines[i][j];v.caption=v.speech.toUpperCase();
  v.firstFramePrompt=`${style} Use only the new polygonal avatar references. Compose this in-game shot: ${v.visual} Leave caption space below. No text.`;
  v.generationPrompt=`${style} Animate the approved clearly nonreal polygonal first frame. One small deadpan glance or hand gesture, no major action change. Keep props and identities rigidly consistent. Scene: ${v.visual} No dialogue or music. Four-second single shot.`;
  v.referenceAssets=['Relevant R3-C01-poly / R3-C02-poly / R3-C03-poly / R3-C04-poly original avatar references',`frames/${v.id}-poly-first.png`,'Original opening SFX stem'];
 }
 d.characters=chars;d.creativeDirection='DIRTY WEB / LOW-POLY CRIME TABLOID';
 d.productionNote='Photorealistic first-frame motion requests failed the provider likeness rule. Motion production uses new text-origin, visibly polygonal characters and newly rendered scenes; rejected photographic references are not video inputs.';
 fs.writeFileSync(path.join(here,'production-source.json'),JSON.stringify(d,null,2)+'\n');
 fs.writeFileSync(path.join(requests,'poly-frames.json'),JSON.stringify(jobs,null,2)+'\n');
 console.log(`Prepared ${jobs.length} compliant stylized scene requests; no photoreal reference used.`);
}else console.log('Prepared four text-origin, unmistakably low-poly character references.');
