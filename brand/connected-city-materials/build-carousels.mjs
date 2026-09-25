import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';
const here=path.dirname(fileURLToPath(import.meta.url));
const dir=path.join(here,'carousels');
fs.mkdirSync(dir,{recursive:true});
const sets=[
 {id:'hook',name:'Every cut has a job',status:'MARKET CANDIDATE · NOT DEPLOYED OR FUNDED',post:'Every cut has a job. Explore the 9% base sell-fee split, bounded surge and finite reserve design in Omertà Market. Implementation candidate; not deployed or funded. LP fees are additional. Follow @OmertaOnRH.',slides:[
  {title:['EVERY CUT','HAS A JOB.'],sub:'Follow the canonical market’s fee flow.',kind:'hero',items:['9% BASE SELL FEE','FOUR FIXED DESTINATIONS'],note:'ETH / OMR · Uniswap v4 · Market'},
  {title:['FOUR ORDERS.','ONE BASE FEE.'],sub:'9% is the total base sell fee.',kind:'fee',items:['2% Developer','1.6% RWA recipient','2.4% Community','3% Protocol liquidity'],note:'LP fees are additional. Other pools have their own policies.'},
  {title:['PRESSURE','LEAVES A TRACE.'],sub:'Extra sell pressure can add a bounded charge.',kind:'steps',items:['Tick pressure accumulates','Surge adds 0–1%','Surge receipts go to stability'],note:'Pressure decays over time. Buys cannot instantly reset it.'},
  {title:['FUNDING','HAS A DESTINATION.'],sub:'Actual receipts enter defined compartments.',kind:'steps',items:['3% POL bucket → Core','Surge + bonds → War Chest','Arbitrage reserve share → War Chest'],note:'Funding does not reset lifetime deployment limits.'},
  {title:['NO BOTTOMLESS','VAULT.'],sub:'Reserves use finite inventory and explicit limits.',kind:'steps',items:['Capacity + cooldowns','Spot + liquidity checks','Funded partial recovery'],note:'No guaranteed floor, promised yield or MEV immunity.'},
  {title:['THE CITY','KEEPS ACCOUNTS.'],sub:'See the whole system in the film.',kind:'hero',items:['EXPLORE OMERTA.FUN','FOLLOW @OMERTAONRH'],note:'Hook rules and companion contracts have separate responsibilities.'},
 ]},
 {id:'world-graph',name:'The wreck is a beginning',status:'PHASE 1 IMPLEMENTED · PHASE 2A IN DEVELOPMENT',post:'The wreck is a beginning. Omertà’s World Graph connects salvage, conserved materials, crafting and item history. Phase 1 is implemented and OMR-neutral. Phase 2A remains in development; NFT export is not live.',slides:[
  {title:['THE WRECK IS','A BEGINNING.'],sub:'An object can be the start of another story.',kind:'hero',items:['SALVAGE → MATERIALS','MATERIALS → CRAFTING'],note:'World Graph · Phase 1'},
  {title:['START WITH','WHAT EXISTS.'],sub:'Salvage consumes an eligible car once.',kind:'steps',items:['Car enters the salvage action','The car is consumed','Materials enter the inventory ledger'],note:'This is a conceptual flow, not a universal yield recipe.'},
  {title:['KEEP TRACK','OF THE MATERIAL.'],sub:'The item ledger is inventory authority.',kind:'steps',items:['Conserved quantities','Recorded material quality','Replay-safe mutation records'],note:'Collection status is separate from actual inventory.'},
  {title:['CRAFT FROM','REAL INPUTS.'],sub:'Graph-defined recipes declare what they consume.',kind:'steps',items:['Required materials','Validated recipe','Recorded crafting result'],note:'Phase 1 is OMR-neutral. Hardened steel has a $300 game-cash sink.'},
  {title:['THE OBJECT','KEEPS ITS HISTORY.'],sub:'Unique identity and custody remain recorded.',kind:'steps',items:['Permanent unique item identity','Ordered custody transitions','Mystery + four-account Crew gates'],note:'Default inventory is off-chain. NFT export is not live.'},
  {title:['FOLLOW','THE CONNECTIONS.'],sub:'Next: a deeper materials and salvage system.',kind:'hero',items:['PHASE 2A: IN DEVELOPMENT','EXPLORE OMERTA.FUN'],note:'Immutable definitions, material lots and expanded salvage are next.'},
 ]},
 {id:'coordination',name:'No one has the whole story',status:'PHASES 00–01 IMPLEMENTED · API PILOTS DEFAULT OFF',post:'No one has the whole story. The Split Ledger needs original evidence from two different accounts. Share deliberately; copies cannot manufacture independence. Coordination Phases 00–01 are implemented for review. Value-neutral API pilots default off.',slides:[
  {title:['NO ONE HAS','THE WHOLE STORY.'],sub:'Meet the Omerta Coordination Engine.',kind:'hero',items:['PRIVATE PROGRESS','SHARED EVIDENCE'],note:'The Dead Letter + The Split Ledger'},
  {title:['THE DOCKS','HAS ONE HALF.'],sub:'One investigator discovers a local source.',kind:'steps',items:['Investigator A','Required district: the Docks','Original source: manifest'],note:'The Split Ledger uses server-required district sources.'},
  {title:['THE FOUNDRY','HAS THE OTHER.'],sub:'A different account discovers the second source.',kind:'steps',items:['Investigator B','Required district: the Foundry','Original source: impression'],note:'One account collecting both sources does not supply independence.'},
  {title:['SHARE','DELIBERATELY.'],sub:'Evidence moves through live permissions.',kind:'steps',items:['Choose an account, Crew or Family','Current membership is checked','Revocation blocks future access'],note:'Permissions are rechecked when evidence is read or used.'},
  {title:['TWO SOURCES.','ONE CONCLUSION.'],sub:'Independent original evidence unlocks the gate.',kind:'evidence',items:['DOCKS / ACCOUNT A','FOUNDRY / ACCOUNT B','MATCHING ORIGINAL SOURCES','CONCLUSION UNLOCKS'],note:'Copies, personal archives and player assertions add no new source.'},
  {title:['CONNECT','THE EVIDENCE.'],sub:'Explore what is built. Follow what comes next.',kind:'hero',items:['VALUE-NEUTRAL API PILOTS','FOLLOW @OMERTAONRH'],note:'Delegation, economic adapters and AI generation remain planned.'},
 ]},
];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fonts=['C:/Windows/Fonts/ARIALN.TTF','C:/Windows/Fonts/ARIALNB.TTF','C:/Windows/Fonts/arial.ttf','C:/Windows/Fonts/arialbd.ttf','C:/Windows/Fonts/georgia.ttf'];
const opts={font:{fontFiles:fonts,loadSystemFonts:false,defaultFontFamily:'Arial'}};
const txt=(s,x,y,size=35,color='#eee8db',family='Arial')=>`<text x="${x}" y="${y}" font-size="${size}" font-family="${family}" fill="${color}">${esc(s)}</text>`;
const line=(x,y,x2,y2,color='#56615b')=>`<path d="M${x} ${y}L${x2} ${y2}" stroke="${color}" fill="none" stroke-width="2"/>`;
const wrap=(s,max=48)=>{const out=[];for(const w of s.split(' ')){if(!out.length||out.at(-1).length+w.length+1>max)out.push(w);else out[out.length-1]+=' '+w;}return out;};
const body=(s,y,size=35,max=48,color='#eee8db')=>wrap(s,max).map((s,i)=>txt(s,78,y+i*(size*1.35),size,color)).join('');
const fit=s=>{const box=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="200">${txt(s,0,110,100,'#eee8db','Arial Narrow')}</svg>`,opts).getBBox();return Math.min(100,100*924/(box?.width||924));};
function art(slide,index,set){
 let content='';
 if(slide.kind==='fee'){
  const widths=[2,1.6,2.4,3],colors=['#c7af79','#b4af9e','#eee8db','#aacac0'];let x=78;
  content=txt('9%',78,690,180,'#c7af79','Arial Narrow');
  widths.forEach((v,i)=>{const w=924*v/9;content+=`<rect x="${x}" y="755" width="${w-3}" height="115" fill="${colors[i]}"/>`+txt(`${v}%`,x+20,829,48,'#101616','Arial Narrow');x+=w;});
  content+=slide.items.map((s,i)=>txt(s,78+(i%2)*462,945+Math.floor(i/2)*64,36)).join('');
 }else if(slide.kind==='hero'){
  content=`<circle cx="795" cy="780" r="180" fill="none" stroke="#c7af7940" stroke-width="2"/><circle cx="795" cy="780" r="140" fill="none" stroke="#c7af7940" stroke-width="2"/>`+line(78,660,1000,660,'#c7af79');
  content+=slide.items.map((s,i)=>body(s,770+i*115,46,35,i?'#eee8db':'#c7af79')).join('');
 }else if(slide.kind==='evidence'){
  content=line(285,700,540,850,'#aacac0')+line(780,700,540,850,'#aacac0')+line(540,850,540,1010,'#aacac0');
  content+=txt(slide.items[0],78,675,30,'#aacac0')+txt(slide.items[1],565,675,30,'#aacac0');
  content+=`<rect x="155" y="820" width="770" height="75" fill="#101616" stroke="#aacac0"/>`+txt(slide.items[2],190,869,33)+txt(slide.items[3],335,1050,36,'#c7af79');
 }else{
  content=line(105,630,105,1025,'#aacac0');
  content+=slide.items.map((s,i)=>`<circle cx="105" cy="${665+i*155}" r="26" fill="#101616" stroke="#aacac0" stroke-width="2"/>`+txt(i+1,96,674+i*155,26,'#aacac0')+wrap(s,38).map((v,j)=>txt(v,155,678+i*155+j*48,38)).join('')).join('');
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><title>${esc(slide.title.join(' '))}</title><desc>${esc(slide.sub+' '+slide.items.join('. ')+'. '+slide.note+' '+set.status)}</desc><rect width="1080" height="1350" fill="#101616"/><rect x="35" y="35" width="1010" height="1280" fill="none" stroke="#c7af7940"/>${txt('OMERTÀ',78,113,42,'#eee8db','Georgia')}${txt(`${String(index+1).padStart(2,'0')} / 06`,875,108,24,'#c7af79')}${line(78,150,1002,150)}${txt(set.id.toUpperCase(),78,215,24,'#c7af79')}${slide.title.map((t,i)=>txt(t,78,340+i*105,fit(t),'#eee8db','Arial Narrow')).join('')}${body(slide.sub,515,34,50)}${content}${body(slide.note,1135,28,66,'#c7af79')}${line(78,1215,1002,1215)}${txt(set.status,78,1260,20,'#bcbdb3')}</svg>`;
}
for(const set of sets){
 const entries=[];
 for(const [i,slide] of set.slides.entries()){
  const filename=`${set.id}-${String(i+1).padStart(2,'0')}`;const source=art(slide,i,set);const renderer=new Resvg(source,opts);
  fs.writeFileSync(path.join(dir,`${filename}.svg`),renderer.toString());
  fs.writeFileSync(path.join(dir,`${filename}.png`),renderer.render().asPng());
  entries.push({file:`${filename}.png`,alt:slide.title.join(' ')+'. '+slide.sub+' '+slide.items.join('. ')+'. '+slide.note+' '+set.status});
 }
 fs.writeFileSync(path.join(dir,`${set.id}.html`),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(set.name)} — Omertà carousel</title><link rel="stylesheet" href="../style.css"><main class="shell" style="padding-block:50px"><a href="../index.html">← The connected city</a><p class="eyebrow" style="margin-top:40px">Six-slide carousel · 1080 × 1350</p><h1 style="font-size:64px">${esc(set.name)}</h1><p>${esc(set.post)}</p><p><a href="${set.id}-copy.txt" download>Download post copy and alt text</a></p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:25px">${entries.map(e=>`<figure style="margin:0"><img src="${e.file}" alt="${esc(e.alt)}" style="width:100%" loading="lazy"><figcaption><a href="${e.file}" download>Download PNG</a> · <a href="${e.file.replace('.png','.svg')}" download>SVG</a></figcaption></figure>`).join('')}</div></main></html>`);
 fs.writeFileSync(path.join(dir,`${set.id}-copy.txt`),`${set.name}\n\nPOST COPY\n${set.post}\n\nPOSTING ORDER + ALT TEXT\n${entries.map((e,i)=>`${i+1}. ${e.file}\n${e.alt}`).join('\n\n')}\n\nUse the six PNGs in numbered order. Add the matching alt text to each image. Status language is part of the copy. No posting or scheduling has been performed.\n`);
}
fs.writeFileSync(path.join(dir,'source-copy.json'),JSON.stringify(sets,null,2));
console.log('Created 18 PNGs, 18 outlined SVGs, three carousel galleries and three copy/alt-text files.');
