import fs from 'node:fs';
const file='public/index.html';let html=fs.readFileSync(file,'utf8');
if(html.includes('id="district-atlas"'))throw new Error('District refresh already applied.');
fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/art-refresh-index-before.html',html);
const css=`<style id="district-refresh-style">
.landing .hero h1{color:#eee8db;letter-spacing:clamp(6px,1.1vw,12px)}
.district-atlas{margin:64px 0;padding:34px 0;border-block:1px solid var(--line)}
.district-atlas .atlas-kicker{color:#c7af79;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px}
.district-atlas h2{font-family:var(--display);font-size:clamp(34px,5vw,54px);line-height:1.08;letter-spacing:1px;color:#eee8db;margin:0 0 14px}
.district-atlas .atlas-intro{max-width:540px;color:var(--dim);font-size:15px;line-height:1.6;margin-bottom:28px}
.district-atlas .atlas-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.district-atlas article{position:relative;min-height:365px;overflow:hidden;background:#101616;border:1px solid #45463d}
.district-atlas picture{position:absolute;inset:0;display:block}.district-atlas img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 500ms ease}
.district-atlas article:hover img{transform:scale(1.035)}
.district-atlas .atlas-caption{position:absolute;inset:auto 0 0;padding:70px 20px 22px;background:linear-gradient(transparent,#0b1111 60%)}
.district-atlas .atlas-number{font-size:10px;letter-spacing:2px;color:#aacac0}
.district-atlas h3{font-family:var(--display);font-size:34px;color:#eee8db;line-height:1.1;margin:8px 0}
.district-atlas .atlas-caption p{font-size:13px;color:#d0d1c5;line-height:1.5;margin:0}
.district-atlas .atlas-footer{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:18px;font-size:12px}.district-atlas .atlas-footer span{color:var(--dim)}
.district-atlas a{color:#c7af79;text-underline-offset:5px}.district-atlas a:focus-visible{outline:2px solid #aacac0;outline-offset:5px}
@media(max-width:640px){.district-atlas{margin:40px 0}.district-atlas .atlas-grid{grid-template-columns:1fr}.district-atlas article{min-height:300px}.district-atlas .atlas-footer{display:block}.district-atlas .atlas-footer span{display:block;margin-bottom:12px}}
@media(prefers-reduced-motion:reduce){.district-atlas img{transition:none}.district-atlas article:hover img{transform:none}}
</style>`;
html=html.replace('</head>',css+'\n</head>');
const districts=[['foundry','Foundry','Iron, rain, and the furnace glow.'],['docks','Docks','Sea mist. Dark water. A light on the quay.'],['neon-interior','Neon','Velvet booths beneath the late-night lights.']];
const section=`<section id="district-atlas" class="district-atlas" aria-labelledby="district-atlas-title"><p class="atlas-kicker">A city with a thousand stories</p><h2 id="district-atlas-title">Every district has a mood.</h2><p class="atlas-intro">The furnace, the waterfront, the room behind the velvet curtain. Find your place in Omertà.</p><div class="atlas-grid">${districts.map(([id,name,copy],i)=>`<article><picture><source type="image/webp" sizes="(max-width:640px) calc(100vw - 32px), 320px" srcset="/art/district-v2-${id}-480.webp 480w, /art/district-v2-${id}-960.webp 960w, /art/district-v2-${id}-1280.webp 1280w"><img src="/art/district-v2-${id}.jpg" width="1280" height="720" loading="lazy" decoding="async" alt="${name==='Neon'?'Atmospheric art of a velvet and brass nightlife lounge':name==='Foundry'?'Atmospheric art of a brick foundry beside a canal':'Atmospheric art of a fogbound cargo quay'}"></picture><div class="atlas-caption"><span class="atlas-number">0${i+1} / THE CITY</span><h3>${name}</h3><p>${copy}</p></div></article>`).join('')}</div><div class="atlas-footer"><span>Atmospheric world art · Three views of a six-district city</span><a href="/wiki#city">Explore the city guide ↗</a></div></section>`;
const anchor='<div class="artifact-deck landing-routes"';if(!html.includes(anchor))throw Error('Landing insertion point missing');html=html.replace(anchor,section+'\n\n  '+anchor);
html=html.replace('src="/art/hype/hero-poster.mp4" muted loop','src="/art/hero-ambient-v2.mp4" muted loop');
html=html.replace("docks: 'district-docks', neon: 'district-neon', cathedral: 'district-cathedral',","docks: 'district-v2-docks', neon: 'district-v2-neon-interior', cathedral: 'district-cathedral',").replace("foundry: 'district-foundry', canal: 'district-canal', brick: 'district-brick',","foundry: 'district-v2-foundry', canal: 'district-canal', brick: 'district-brick',");
// Refreshed stills have no matching motion clip; do not request a nonexistent or visually mismatched video.
html=html.replace('data-mkey="${DISTRICT_ART[d]}"','${DISTRICT_ART[d].startsWith(\'district-v2-\') ? \'\' : `data-mkey="${DISTRICT_ART[d]}"`}');
fs.writeFileSync(file,html);console.log('Homepage district atlas, hero treatment and in-game district stills updated.');
