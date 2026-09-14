import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

// Original vector campaign artwork. No network, generated imagery, or live chain data.
// Exported SVG text is outlined by Resvg, making each deliverable self-contained.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const W = 1080, H = 1350, M = 76;
const C = { ink:'#08090a', paper:'#f2eadb', gold:'#cba65c', teal:'#6eafc8', muted:'#b4ab9c', line:'#45433e', brown:'#aa9781' };
const fontFiles = [
  path.join(root,'public/art/display.woff2'),
  'C:/Windows/Fonts/ARIALNB.TTF', 'C:/Windows/Fonts/ARIALN.TTF',
  'C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/arialbd.ttf',
  'C:/Windows/Fonts/georgia.ttf', 'C:/Windows/Fonts/georgiab.ttf',
].filter(f => fs.existsSync(f));
if (!fontFiles.some(f => /ARIALNB\.TTF$/i.test(f))) throw new Error('Arial Narrow Bold is required to reproduce these layouts.');
const renderOptions = { font:{fontFiles,loadSystemFonts:false,defaultFontFamily:'Arial',sansSerifFamily:'Arial',serifFamily:'Georgia'} };
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const n = v => Number(v.toFixed(3));
const line = (x1,y1,x2,y2,color=C.line,width=1) => `<path d="M${n(x1)} ${n(y1)}H${n(x2)}" fill="none" stroke="${color}" stroke-width="${width}"/>`.replace(`H${n(x2)}`,y1===y2?`H${n(x2)}`:`L${n(x2)} ${n(y2)}`);
const rect = (x,y,w,h,fill,stroke='none',sw=1) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const circle = (x,y,r,fill,stroke='none',sw=1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const text = (value,x,y,size=28,color=C.paper,opt={}) => `<text x="${x}" y="${y}" font-family="${opt.family??'Arial'}" font-size="${size}" font-weight="${opt.bold?'700':'400'}" letter-spacing="${opt.spacing??0}" text-anchor="${opt.anchor??'start'}" fill="${color}">${esc(value)}</text>`;
const display = (value,x,y,size,color=C.paper,opt={}) => text(value,x,y,size,color,{family:'Arial Narrow',bold:true,...opt});
const serif = (value,x,y,size=28,color=C.paper,opt={}) => text(value,x,y,size,color,{family:'Georgia',...opt});
const arrow = (x1,y1,x2,y2,color=C.gold,width=2.5) => {
  const angle=Math.atan2(y2-y1,x2-x1),len=11;
  const a=[x2-len*Math.cos(angle-.48),y2-len*Math.sin(angle-.48)];
  const b=[x2-len*Math.cos(angle+.48),y2-len*Math.sin(angle+.48)];
  return line(x1,y1,x2,y2,color,width)+`<path d="M${n(a[0])} ${n(a[1])}L${x2} ${y2}L${n(b[0])} ${n(b[1])}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
};
const number = (v,x,y,color=C.gold) => text(v,x,y,22,color,{spacing:1});
function headline(value,y,max=132) {
  const measure=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="250">${display(value,10,170,max)}</svg>`,renderOptions).getBBox();
  const size=measure?.width>W-2*M ? max*(W-2*M)/measure.width : max;
  return display(value,M,y,n(size));
}
function brand() {
  return `<g transform="translate(90 82) scale(.58)"><path d="M0 22 C1 -3 14 -18 37 -18 C60 -18 73 -3 74 22Z" fill="${C.gold}"/><ellipse cx="37" cy="22" rx="58" ry="10" fill="${C.gold}"/><rect x="0" y="11" width="74" height="8" fill="${C.ink}"/>${serif('OMERTÀ',92,27,34,C.gold,{spacing:8})}</g>`;
}
function canvas(index,eyebrow,title,subtitle,body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title.join(' '))}">
    <title>${esc(title.join(' '))}</title><desc>${esc(subtitle)} Built and tested implementation candidate; not deployed.</desc>
    ${rect(0,0,W,H,C.ink)}${brand()}
    ${text('BUILT & TESTED · NOT DEPLOYED',1004,96,18,C.paper,{anchor:'end',spacing:1})}
    ${line(M,136,W-M,136,C.line)}
    ${text(`${index} / ${eyebrow}`,M,189,22,C.gold,{spacing:2})}
    ${headline(title[0],296)}${headline(title[1],401)}
    ${serif(subtitle,M,460,27,C.muted)}
    ${body}
    ${line(M,1251,W-M,1251,C.line)}
    ${text('OMERTÀ  /  MARKET V2',M,1293,20,C.paper,{spacing:1.4})}
    ${text('THE LEDGER REMEMBERS.',1004,1293,18,C.muted,{anchor:'end',spacing:1.3})}
  </svg>`;
}

function tax() {
  const buckets=[['DEVELOPER',2,C.paper],['RWA',1.6,C.brown],['COMMUNITY',2.4,C.gold],['PROTOCOL',3,C.teal]];
  let x=M;
  const bar=buckets.map(([label,percentage,color])=>{
    const width=(W-2*M)*percentage/9,mid=x+width/2;
    const s=rect(x,720,width,116,color)+display(`${percentage}%`,mid,800,58,C.ink,{anchor:'middle'})+
      text(label,mid,881,24,C.paper,{anchor:'middle',bold:true})+
      (label==='PROTOCOL'?text('LIQUIDITY',mid,915,23,C.paper,{anchor:'middle'}):'');
    x+=width;return s;
  }).join('');
  return canvas('01','THE CANONICAL SELL TAX',['EVERY CUT','HAS A JOB.'],'Four destinations. One fixed base allocation.',
    display('9%',M,677,198,C.paper)+text('BASE SELL TAX',365,600,33,C.paper,{bold:true,spacing:1})+
    serif('Every part has an assigned destination.',365,647,26,C.muted)+
    bar+line(M,968,1004,968,C.line)+
    display('+0–1%',M,1071,88,C.gold)+text('BOUNDED SURGE',383,1015,29,C.gold,{bold:true,spacing:1})+
    serif('Separately credited to the reserve.',383,1058,27,C.paper)+
    text('Canonical pool sells only. LP fees are additional.',M,1164,26,C.paper)+
    text('Base allocation widths are proportional to their share.',M,1205,22,C.muted));
}
function ledgers() {
  const branches=`<path d="M540 612V638M277 638H803M277 638V671M803 638V671" fill="none" stroke="${C.line}" stroke-width="2"/>`;
  const row=(num,label,x,y,color,size=45)=>number(num,x,y-5,color)+display(label,x+48,y,size,C.paper);
  return canvas('02','BOUNDED RESERVE POLICY',['SEVEN LEDGERS.','ONE CITY.'],'Liquidity moves through named, finite compartments.',
    circle(124,568,46,'none',C.gold,2)+number('01',111,577,C.gold)+display('CORE',205,580,59,C.paper)+
    text('TWO-SIDED PROTOCOL LIQUIDITY',471,576,24,C.gold,{spacing:1})+branches+
    text('DOWNSIDE / ETH',M,709,27,C.gold,{bold:true})+text('UPSIDE / OMR',604,709,27,C.teal,{bold:true})+
    row('02','LOWER CUSHION',M,777,C.gold,39)+row('03','GARRISON',M,837,C.gold,39)+
    row('04','UPPER CUSHION',604,777,C.teal,39)+row('05','DESK',604,837,C.teal,39)+
    line(539,700,539,888,C.line)+
    text('ABSORBS OMR SELLING',M+48,888,21,C.gold,{spacing:1})+text('SUPPLIES OMR BUYING',652,888,21,C.teal,{spacing:1})+
    line(M,931,1004,931,C.line)+
    row('06','WAR CHEST',M,997,C.gold)+serif('Idle funds. Bounded regeneration.',493,995,27,C.muted)+
    line(M,1040,1004,1040,C.line)+
    row('07','TURF',M,1109,C.gold)+serif('Seasonal range. Family fee rights.',493,1107,27,C.muted)+
    text('Capacity, cooldowns and stress gates bound deployment.',M,1205,24,C.paper));
}
function bonds() {
  const step=(num,y,title,l1,l2,color=C.gold)=>circle(112,y-17,35,C.ink,color,2)+number(num,99,y-9,color)+display(title,186,y,49,C.paper)+serif(l1,186,y+45,27,C.muted)+(l2?serif(l2,186,y+84,27,C.muted):'');
  return canvas('03','FUNDED INVENTORY BONDS',['INVENTORY','BEFORE PROMISES.'],'Bond claims begin with OMR already in custody.',
    line(112,608,112,1004,C.line,2)+
    step('01',584,'FUND OMR','Existing tokens enter the bond inventory.','No mint authority. Inventory sets the limit.')+
    step('02',790,'PURCHASE & RESERVE','A purchase with ETH reserves the full OMR claim.','ETH proceeds flow to the reserve.')+
    step('03',996,'VEST LINEARLY','The funded note unlocks over its fixed term.','Vested claims remain independently claimable.',C.teal)+
    line(190,1157,956,1157,C.line,2)+line(190,1157,190,1103,C.line,2)+
    `<path d="M190 1157L956 1096" fill="none" stroke="${C.teal}" stroke-width="3"/>`+
    circle(190,1157,4,C.teal)+circle(956,1096,4,C.teal)+
    text('PURCHASE',190,1205,20,C.muted,{spacing:1})+text('FULL VESTING',956,1205,20,C.teal,{anchor:'end',spacing:1}));
}
function arbitrage() {
  const xs=[M,316,556,796],labels=['QUOTE','COMMIT','EXECUTE','SHARE'];
  const row=xs.map((x,i)=>number(`0${i+1}`,x,552)+display(labels[i],x,605,45)+
    (i<3?arrow(x+142,544,x+202,544,C.line,2):'')).join('');
  const steps=[['Taxes + LP fees','in the quote.'],['Exact plan bound','to its solver.'],['One atomic','two-pool cycle.'],['Trading profit.','Fixed reserve cut.']];
  const captions=steps.map((ls,i)=>ls.map((s,j)=>text(s,xs[i],647+j*33,23,C.muted)).join('')).join('');
  return canvas('04','SOLVER-FUNDED ARBITRAGE',['THE MACHINES','WORK THE SPREAD.'],'The execution checks what the quote can only estimate.',
    row+captions+
    `<path d="M341 826C440 724 640 724 739 826" fill="none" stroke="${C.gold}" stroke-width="2.5"/><path d="M730 809L739 826L719 824" fill="none" stroke="${C.gold}" stroke-width="2.5"/>
     <path d="M739 942C640 1044 440 1044 341 942" fill="none" stroke="${C.teal}" stroke-width="2.5"/><path d="M360 944L341 942L350 959" fill="none" stroke="${C.teal}" stroke-width="2.5"/>`+
    circle(285,884,98,'none',C.gold,2)+circle(795,884,98,'none',C.teal,2)+
    display('OMERTÀ',285,874,38,C.paper,{anchor:'middle'})+text('CANONICAL',285,912,21,C.gold,{anchor:'middle',spacing:1})+
    display('ALT POOL',795,874,37,C.paper,{anchor:'middle'})+text('APPROVED',795,912,21,C.teal,{anchor:'middle',spacing:1})+
    text('ETH / OMR',540,870,25,C.paper,{anchor:'middle',spacing:1})+text('ATOMIC CYCLE',540,915,18,C.muted,{anchor:'middle',spacing:1.4})+
    line(M,1064,1004,1064,C.line)+
    text('RESERVE SHARE',M,1113,28,C.gold,{bold:true})+text('SOLVER REMAINDER',1004,1113,28,C.teal,{bold:true,anchor:'end'})+
    serif('Trading profit: after swap fees, before gas.',M,1163,29,C.paper)+
    text('Solver budgets gas separately. Competition remains.',M,1205,24,C.muted));
}
function feeRights() {
  const vault=`<path d="M154 630H340V758H154Z M164 619H330V630 M180 758V774 M314 758V774" fill="none" stroke="${C.gold}" stroke-width="2"/>${circle(247,694,34,'none',C.gold,2)}${line(247,660,247,728,C.gold,1.5)}${line(213,694,281,694,C.gold,1.5)}`;
  const stream=`<path d="M585 644H650C700 644 700 694 750 694H920M585 694H920M585 744H650C700 744 700 694 750 694" fill="none" stroke="${C.teal}" stroke-width="2.5"/><path d="M905 680L920 694L905 708" fill="none" stroke="${C.teal}" stroke-width="2.5"/>`;
  return canvas('05','TURF OWNERSHIP & ACCOUNTING',['THE FAMILY','GETS THE FEES.'],'Fee rights change hands. Principal keeps its custody.',
    text('PROTOCOL PRINCIPAL',M,560,27,C.gold,{bold:true})+text('FAMILY FEE RIGHTS',589,560,27,C.teal,{bold:true})+
    vault+stream+line(499,546,499,826,C.line)+
    text('Custody stays in the controller.',M,812,23,C.paper)+text('Funded LP fee credits',589,812,24,C.paper)+
    line(M,866,1004,866,C.line)+
    text('HISTORICAL CREDITS',M,935,27,C.gold,{bold:true})+text('FUTURE OWNERSHIP',1004,935,27,C.teal,{bold:true,anchor:'end'})+
    serif('Stay with the recorded owner.',M,978,24,C.muted)+serif('Applies after the checkpoint.',1004,978,24,C.muted,{anchor:'end'})+
    line(M,1034,510,1034,C.gold,4)+line(570,1034,1004,1034,C.teal,4)+
    `<path d="M540 1005L569 1034L540 1063L511 1034Z" fill="${C.ink}" stroke="${C.paper}" stroke-width="2"/>`+
    line(540,1018,540,1050,C.paper,2)+
    text('ATOMIC CHECKPOINT',540,1122,29,C.paper,{bold:true,anchor:'middle',spacing:1})+
    serif('Accrued fees are credited before ownership changes.',540,1170,28,C.paper,{anchor:'middle'})+
    text('Entitlements follow funded fees, never a fixed return.',540,1210,23,C.muted,{anchor:'middle'}));
}

const artwork=[
  ['04-tax-map',tax()],['05-seven-compartments',ledgers()],['06-inventory-bonds',bonds()],
  ['07-arbitrage',arbitrage()],['08-fee-rights',feeRights()],
];
for(const dir of ['svg','png','previews']) fs.mkdirSync(path.join(here,dir),{recursive:true});
const manifest=[];
for(const [name,source] of artwork) {
  const parsed=new Resvg(source,renderOptions);
  let portable=parsed.toString();
  if(/<(text|image)\b|(?:href|src)\s*=\s*["'](?:https?:|file:)/i.test(portable)) throw new Error(`${name}: unexpected text or external dependency in outlined export.`);
  // Retain a human-readable source title even though all visible letters are paths.
  portable=portable.replace(/(<svg[^>]*>)/,`$1\n<title>${esc(name.replace(/^\d+-/, '').replaceAll('-',' '))}</title>\n<desc>OMERTÀ Market V2. Built and tested; not deployed. Original outlined vector infographic.</desc>`);
  const svgPath=path.join(here,'svg',`${name}.svg`),pngPath=path.join(here,'png',`${name}.png`);
  fs.writeFileSync(svgPath,portable);
  const render=new Resvg(portable,renderOptions).render();
  if(render.width!==W||render.height!==H) throw new Error(`${name}: wrong dimensions.`);
  fs.writeFileSync(pngPath,render.asPng());
  manifest.push({name,svg:`svg/${name}.svg`,png:`png/${name}.png`,width:W,height:H,portable:true,textOutlined:true});
}

// The preview is composed from our own vector exports; no raster editing is used.
const thumbW=432,thumbH=540,gap=26,pad=36,cols=3;
const sheetW=pad*2+cols*thumbW+(cols-1)*gap,sheetH=pad*2+thumbH*2+gap+32;
const panels=artwork.map(([name],i)=>{
  const x=pad+(i%cols)*(thumbW+gap),y=pad+Math.floor(i/cols)*(thumbH+gap+32);
  const svg=fs.readFileSync(path.join(here,'svg',`${name}.svg`),'utf8').replace(/^<svg[^>]*>/,`<svg x="${x}" y="${y}" width="${thumbW}" height="${thumbH}" viewBox="0 0 ${W} ${H}">`);
  return svg+text(name,x,y+thumbH+21,16,C.paper);
}).join('');
const sheet=`<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">${rect(0,0,sheetW,sheetH,'#242525')}${panels}</svg>`;
const preview=new Resvg(sheet,renderOptions);
fs.writeFileSync(path.join(here,'previews','infographics-contact-sheet.svg'),preview.toString());
fs.writeFileSync(path.join(here,'previews','infographics-contact-sheet.png'),preview.render().asPng());
fs.writeFileSync(path.join(here,'infographics-manifest.json'),JSON.stringify({format:'Original outlined SVG + PNG',dimensions:{width:W,height:H},status:'BUILT & TESTED · NOT DEPLOYED',sourceOfTruth:'omerta-contracts/docs/market-v2/DESIGN.md',artwork:manifest},null,2)+'\n');
console.log(`Rendered ${artwork.length} portable SVGs and ${artwork.length} PNGs (${W} × ${H}), plus a vector contact sheet.`);
