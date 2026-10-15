import React from 'react';
import {AbsoluteFill, CanvasImage, Easing, interpolate, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {StoryShot} from './story-types';
export type {StoryShot} from './story-types';

const P = {ink: '#071012', paper: '#dcc99f', bone: '#f4e8d0', gold: '#d9a754', blue: '#8bbbc4', red: '#a74736', green: '#8fa17d'};
const W = 1920;
const H = 1080;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = {...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1)};
const ramp = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], ease);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const src = (key: string) => {
  const path = key.startsWith('art/flagship-animation/') ? key : `art/flagship-animation/${key}${/\.(png|jpe?g|webp)$/.test(key) ? '' : '.png'}`;
  if (path.includes('..') || path.includes(':')) throw new Error(`Unexpected story asset: ${key}`);
  return staticFile(path);
};

const Art = ({name, style}: {name: string; style?: React.CSSProperties}) => <CanvasImage src={src(name)} style={{position: 'absolute', objectFit: 'contain', ...style}} />;
const InkText = ({children, x, y, size = 39, color = P.bone, width, style}: {children: React.ReactNode; x: number; y: number; size?: number; color?: string; width?: number; style?: React.CSSProperties}) => <div style={{position: 'absolute', zIndex:2, left: x, top: y, width, fontFamily: 'Georgia, serif', fontSize: size, color, lineHeight: 1.12, ...style}}>{children}</div>;
const SoftLabel = ({children,x,y,width,size=39,color=P.bone,opacity=1,align='left'}:{children:React.ReactNode;x:number;y:number;width:number;size?:number;color?:string;opacity?:number;align?:'left'|'center'|'right'}) => <div style={{position:'absolute',zIndex:2,left:x,top:y,width,padding:'15px 22px 17px',boxSizing:'border-box',fontFamily:'Georgia, serif',fontSize:size,lineHeight:1.12,color,opacity,textAlign:align,textShadow:'0 3px 13px #000,0 1px 3px #000',background:'linear-gradient(90deg,#02080c00,#02080cb8 7%,#02080cbd 88%,#02080c00)',boxShadow:'0 8px 23px #02080c44'}}>{children}</div>;
const Stamp = ({children, x, y, color = P.red, rotate = -6, opacity = 1, size = 28}: {children: React.ReactNode; x: number; y: number; color?: string; rotate?: number; opacity?: number; size?: number}) => <div style={{position: 'absolute', left: x, top: y, padding: '13px 22px 10px', border: `3px solid ${color}`, color, rotate: `${rotate}deg`, opacity, fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: size, letterSpacing: 3, textTransform: 'uppercase'}}>{children}</div>;

const Background = ({name, t, duration, dark = 0.12, close = false}: {name: string; t: number; duration: number; dark?: number; close?: boolean}) => <>
  <Art name={name} style={{inset: -65, width: W + 130, height: H + 130, objectFit: 'cover', scale: interpolate(t, [0, duration], close ? [1.09, 1.02] : [1, 1.055], clamp), translate: `${interpolate(t, [0, duration], [-19, 19], clamp)}px ${interpolate(t, [0, duration], [9, -12], clamp)}px`}} />
  <AbsoluteFill style={{background: `linear-gradient(90deg,rgba(2,8,10,${dark + 0.1}),rgba(2,8,10,${dark * 0.5}) 60%,rgba(2,8,10,${dark}))`}} />
</>;

const Weather = ({t, rain = true, intensity = 1}: {t: number; rain?: boolean; intensity?: number}) => <>
  <svg viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, width: W, height: H, pointerEvents: 'none'}}>
    {Array.from({length: rain ? 96 : 26}, (_, i) => {
      const x = random(`story-particle-x-${i}`) * 2160 - 120;
      const speed = rain ? 310 + random(`story-particle-v-${i}`) * 470 : 8 + random(`story-particle-v-${i}`) * 14;
      const y = (random(`story-particle-y-${i}`) * 1300 + t * speed) % 1300 - 100;
      return rain ? <line key={i} x1={x} x2={x - 8} y1={y} y2={y + 29} stroke={P.blue} strokeWidth={i % 4 ? 1 : 2} opacity={intensity * (i % 4 ? 0.12 : 0.19)} /> : <circle key={i} cx={x + Math.sin(t * 0.3 + i) * 30} cy={y} r={1.2 + (i % 3)} fill={P.paper} opacity={0.09 + 0.06 * Math.sin(t + i)} />;
    })}
    {rain && Array.from({length: 23}, (_, i) => <ellipse key={`puddle-${i}`} cx={80 + random(`puddle-x${i}`) * 1780} cy={760 + random(`puddle-y${i}`) * 230} rx={6 + ((t * 21 + i * 4) % 39)} ry={1 + ((t * 3 + i) % 5)} fill="none" stroke={P.blue} strokeWidth={0.8} opacity={(1 - ((t * 21 + i * 4) % 39) / 39) * 0.16 * intensity} />)}
  </svg>
  <div style={{position: 'absolute', left: -500 + ((t * 29) % 600), top: 680, width: 2550, height: 430, opacity: 0.12 * intensity, background: 'radial-gradient(ellipse,#90b1b8 0%,transparent 65%)', filter: 'blur(32px)', pointerEvents: 'none'}} />
</>;

const Person = ({who = 'nico', x, bottom = 92, height = 885, t, entrance = 0, opacity = 1, facing = 1}: {who?: 'nico'|'mara'; x: number; bottom?: number; height?: number; t: number; entrance?: number; opacity?: number; facing?: number}) => {
  const arrival = ramp(t, entrance, entrance + 1.15);
  return <>
    <div style={{position: 'absolute', left: x + 105, bottom: bottom - 25, width: height * 0.39, height: 51, borderRadius: '50%', background: '#010507', opacity: opacity * arrival * 0.7, filter: 'blur(18px)', scale: `${arrival} 1`}} />
    <Art name={`${who}-standing`} style={{left: x, bottom, width: height * 0.68, height, opacity: opacity * arrival, rotate: `${Math.sin(t * 0.56) * 0.25}deg`, scale: `${facing} ${1 + Math.sin(t * 1.1) * 0.0025}`, transformOrigin: '50% 96%', filter: 'drop-shadow(7px 20px 15px #0009)'}} />
  </>;
};

const Cash = ({x, y, scale = 1, rotate = 0, opacity = 1}: {x: number; y: number; scale?: number; rotate?: number; opacity?: number}) => <svg viewBox="0 0 200 104" style={{position: 'absolute', left: x, top: y, width: 200, height: 104, scale, rotate: `${rotate}deg`, opacity, filter: 'drop-shadow(4px 8px 4px #0007)'}}>
  <path d="M 0 12 L 185 0 L 199 84 L 12 102 Z" fill="#8c9474" stroke="#293b31" strokeWidth="4" />
  <path d="M 16 24 L 171 14 L 183 72 L 26 88 Z" fill="none" stroke="#34493c" strokeWidth="2" />
  <ellipse cx="98" cy="52" rx="28" ry="33" fill="#667657" stroke="#354838" strokeWidth="2" />
  <path d="M 34 41 h 31 m -29 12 h 26 m 51 -13 h 31 m -28 12 h 30" stroke="#3e523e" strokeWidth="4" />
  <path d="M 72 82 L 64 9 L 96 7 L 106 80 Z" fill="#cdb781" opacity="0.92" />
</svg>;

const Coin = ({x, y, size = 125, t = 0, opacity = 1, label}: {x: number; y: number; size?: number; t?: number; opacity?: number; label?: string}) => <div style={{position: 'absolute', left: x, top: y, width: size, height: size, opacity}}>
  <Art name="token" style={{inset: 0, width: size, height: size, rotate: `${Math.sin(t * 0.8) * 7}deg`, filter: 'drop-shadow(4px 8px 6px #0008)'}} />
  {label && <InkText x={-100} y={size + 11} size={27} width={size + 200} style={{textAlign: 'center', letterSpacing: 1}}>{label}</InkText>}
</div>;

const Envelope = ({x,y,rotate=-7,scale=1,opacity=1}:{x:number;y:number;rotate?:number;scale?:number;opacity?:number}) => <Art name="envelope" style={{left:x,top:y,width:390,height:230,rotate:`${rotate}deg`,scale,opacity,filter:'drop-shadow(10px 20px 12px #0008)'}}/>;
const Car = ({t, x, y = 577, width = 1180, opacity = 1, lights = false, direction = 1}: {t: number; x: number; y?: number; width?: number; opacity?: number; lights?: boolean; direction?: number}) => <div style={{position: 'absolute', left: x, top: y, width, height: width * 0.47, opacity, scale: `${direction} 1`}}>
  {lights && <svg viewBox="0 0 1600 800" style={{position: 'absolute', left: width * 0.63, top: width * 0.09, width: width * 1.25, height: width * 0.6, opacity: 0.14 + Math.sin(t * 1.9) * 0.02, mixBlendMode: 'screen',filter:'blur(20px)'}}><path d="M 0 270 L 1450 0 L 1600 660 L 0 370 Z" fill="#eae1bb" /></svg>}
  <div style={{position: 'absolute', left: '12%', top: '72%', width: '80%', height: '11%', borderRadius: '50%', background: '#010407', filter: 'blur(16px)'}} />
  <Art name="car" style={{inset: 0, width: '100%', height: '100%', translate: `0 ${Math.sin(t * 18) * 1.4}px`, filter: 'drop-shadow(0 18px 9px #0008)'}} />
</div>;

const Paper = ({x, y, width = 500, height = 400, rotate = -4, children, style}: {x: number; y: number; width?: number; height?: number; rotate?: number; children?: React.ReactNode; style?: React.CSSProperties}) => <div style={{position: 'absolute', left: x, top: y, width, height, rotate: `${rotate}deg`, background: 'linear-gradient(114deg,#e4d3aa,#c9b180 90%)', border: '1px solid #695738', boxShadow: '12px 22px 25px #0008, inset 0 0 52px #896e3536', color: P.ink, ...style}}>
  <div style={{position: 'absolute', inset: 22, border: '1px solid #7e70463b'}} />{children}
</div>;

const HeroHeadline = ({shot,t}:{shot:StoryShot;t:number}) => {
  if(!shot.headline) return null;
  const recruitment=shot.scene==='recruitment';
  const personLeft=shot.scene==='street'||(shot.scene==='closing'&&!['finance-background','opening-background'].includes(shot.asset||''));
  const placement=recruitment ? {left:674,top:220,width:568,fontSize:57,textAlign:'center' as const} : personLeft ? {left:shot.scene==='street'?994:994,top:shot.scene==='street'?230:270,width:768,fontSize:67,textAlign:'left' as const} : {left:126,top:103,width:1530,fontSize:64,textAlign:'left' as const};
  return <div style={{position:'absolute',zIndex:3,...placement,fontFamily:'Georgia, serif',color:P.bone,lineHeight:1.1,textShadow:'0 4px 19px #000,0 1px 5px #000',opacity:ramp(t,.08,.52),translate:`0 ${(1-ramp(t,.08,.52))*18}px`}}>{shot.headline}</div>;
};

const StreetScene = ({shot, t, duration}: SceneProps) => {
  const banking=shot.variant==='banking';
  const training=shot.variant==='training';
  const closeDecision=shot.id==='A03'||shot.id==='A04';
  const portrait=banking ? {x:115,height:825,bottom:146} : training ? {x:-78,height:1170,bottom:-276} : closeDecision ? {x:shot.id==='A04'?-235:-154,height:shot.id==='A04'?1720:1570,bottom:shot.id==='A04'?-734:-590} : {x:-62,height:1280,bottom:-376};
  const textX=training?1100:1000;
  return <>
    <Background name={shot.asset || 'street-background'} t={t} duration={duration} dark={0.14} close={closeDecision}/>
    <AbsoluteFill style={{background:'linear-gradient(90deg,transparent 38%,#03101342 62%,#031013b5)'}}/>
    <Person {...portrait} t={t+1.5}/>
    {!shot.headline && <InkText x={textX} y={banking?278:301} size={55} width={720} color={P.bone} style={{textShadow:'0 5px 17px #000'}}>{shot.labels?.[0] || (training?'Training':banking?'The bank run':'One more job?')}</InkText>}
    <SoftLabel x={textX-22} y={banking?415:493} width={training?630:765} size={46} color={P.paper} opacity={ramp(t,.12,.45)}>{shot.labels?.[1] || (training?'Energy spent':banking?'Exposed in transit':'Nerve spent')}</SoftLabel>
    <SoftLabel x={textX-22} y={banking?525:606} width={training?630:765} size={51} color={P.bone} opacity={ramp(t,.55,1.0)}>{shot.labels?.[2] || (training?'Stats improve':banking?'Protected on arrival':'Cash + respect')}</SoftLabel>
    {!training && Array.from({length:3},(_,i)=>{
      const p=ramp(t,.4+i*.2,Math.min(duration-.2,1.7+i*.2));
      return <Cash key={i} x={lerp(banking?610:1150,banking?1500:1202+i*44,p)} y={lerp(748,banking?800:779+i*11,p)-Math.sin(p*Math.PI)*(banking?130:52)} scale={banking?.67:.82} rotate={lerp(-17,4+i*4,p)} opacity={ramp(t,.2,.6)}/>;
    })}
    {training && <svg width="205" height="535" style={{position:'absolute',left:776,top:195,rotate:`${Math.sin(t*2.2)*7}deg`,transformOrigin:'50% 0',filter:'drop-shadow(12px 18px 14px #0009)'}}><path d="M 100 0 V 151" stroke="#897c65" strokeWidth="7"/><rect x="34" y="146" width="132" height="327" rx="54" fill="#452f22" stroke="#bf915f" strokeWidth="6"/><path d="M 47 181 H 151 M 49 439 H 151" stroke="#795136" strokeWidth="8"/></svg>}
    <Weather t={t}/>
  </>;
};
const PathsScene = ({shot, t, duration}: SceneProps) => {
  const pathNames = ['The Gun','The Ledger','The Kitchen','The Wheel','The Shadow','The Ring'];
  const benefits = ['Street combat','Fronts + trade','Better cooking','Faster convoys','Quicker searches','Duels + bouts'];
  const cycle = duration / 6;
  const index = shot.focus === undefined ? Math.min(5, Math.floor(t / cycle)) : Math.max(0, Math.min(5, shot.focus));
  const beat = shot.focus === undefined ? t % cycle : t;
  const entry = ramp(beat, 0, 0.28);
  const cx = [0.18,0.49,0.81][index%3] * W;
  const cy = (index<3 ? 0.27 : 0.70) * H;
  const zoom = interpolate(beat,[0,Math.max(1,shot.focus===undefined?cycle:duration)],[1.48,1.62],clamp);
  if(shot.variant==='overview') return <>
    <Background name={shot.asset || 'paths-background'} t={t} duration={duration} dark={0.13}/>
    <AbsoluteFill style={{background:`radial-gradient(ellipse at ${28+t*9}% 52%,transparent,#03090c3d)`}}/>
    {pathNames.map((name,i)=><InkText key={name} x={[200,820,1420][i%3]} y={i<3?442:879} size={35} color={P.bone} style={{textShadow:'0 3px 9px #000'}}>{name}</InkText>)}
    <Weather t={t} rain={false}/>
  </>;
  return <>
    <AbsoluteFill style={{background:'#061012'}}/>
    <Art name={shot.asset || 'paths-background'} style={{left:1080-cx*zoom,top:505-cy*zoom,width:W*zoom,height:H*zoom,objectFit:'cover'}}/>
    <AbsoluteFill style={{background:'linear-gradient(90deg,#020708f0 0%,#020708a8 29%,transparent 63%,#02070888)'}}/>
    <AbsoluteFill style={{background:'radial-gradient(ellipse 480px 385px at 1080px 510px,transparent 33%,#02070950 78%,#02070985)'}}/>
    <div style={{position:'absolute',left:764,top:184,width:650,height:650,borderRadius:'50%',background:'radial-gradient(ellipse,#edb46418,transparent 67%)',opacity:0.7+Math.sin(t*1.1)*0.12}}/>
    <div style={{position:'absolute',zIndex:2,left:129,top:(shot.labels?.[0]?.length||0)>23?472:535,width:675,fontFamily:'Georgia, serif',textShadow:'0 4px 14px #000'}}>
      <div style={{fontSize:(shot.labels?.[0]?.length||0)>23?69:81,lineHeight:1.08,color:P.bone,opacity:entry,translate:`0 ${(1-entry)*24}px`}}>{shot.labels?.[0] || pathNames[index]}</div>
      <div style={{marginTop:28,fontSize:35,lineHeight:1.2,color:P.gold,opacity:ramp(beat,.1,.35)}}>{shot.labels?.[1] || benefits[index]}</div>
      {shot.labels?.[2] && <div style={{marginTop:20,fontSize:29,lineHeight:1.2,color:P.paper}}>{shot.labels[2]}</div>}
    </div>
    <div style={{position:'absolute',left:139,top:835,display:'flex',gap:18}}>{pathNames.map((name,i)=><div key={name} style={{width:i===index?74:23,height:3,background:i===index?P.gold:'#73808055'}}/>)}</div>
    <Weather t={t} rain={false}/>
  </>;
};
const DriveScene = ({shot, t, duration}: SceneProps) => {
  if(shot.variant==='sea') return <>
    <Background name={shot.asset || 'dock-background'} t={t} duration={duration} dark={0.13}/>
    <Art name="boat" style={{left:interpolate(t,[0,duration],[931,1124],clamp),top:466+Math.sin(t*2.4)*2,width:480,height:269,rotate:`${Math.sin(t*1.8)*0.65}deg`}}/>
    <svg width={W} height={H} style={{position:'absolute',inset:0}}>{[0,1,2].map(i=><path key={i} d={`M ${903+t*54-i*21} ${707+i*5} Q ${1108+t*43} ${713+i*5} ${1348+t*34} ${708+i*5}`} fill="none" stroke={P.blue} strokeWidth="2" opacity={0.19-i*.035}/>)}</svg>
    <Weather t={t}/>
    <InkText x={128} y={842} size={39}>{shot.labels?.[0] || 'Sea runs. Different risks.'}</InkText>
  </>;
  const across = shot.variant === 'cross' || shot.scene === 'drive';
  const x = shot.variant==='waiting' ? 350 : shot.variant==='commit' ? interpolate(t,[0,duration],[350,770],clamp) : across ? interpolate(t, [0, duration * 0.35, duration * 0.73, duration], [-1100, 195, 605, 2020], clamp) : interpolate(t, [0, Math.min(3.2, duration * 0.4)], [-580, 350], ease);
  return <>
    <Background name={shot.asset || (shot.scene === 'approach' ? 'payroll-background' : 'dock-background')} t={t} duration={duration} dark={0.22} />
    <Car t={t} x={x} y={543} width={1320} lights />
    <Weather t={t} />
    <div style={{position: 'absolute', left: 1450 - t * 310, top: -80, width: 98, height: 1400, background: 'linear-gradient(90deg,#03090b,#1b2829,#04090b)', opacity: 0.89, filter: 'blur(3px)'}} />
    {shot.labels?.[0] && <InkText x={128} y={831} size={37} style={{letterSpacing: 2, opacity: ramp(t, 0.6, 1.6)}}>{shot.labels[0]}</InkText>}
  </>;
};

const CargoScene = ({shot, t, duration}: SceneProps) => {
  const load = ramp(t, 1.7, 4.2);
  const equipment=shot.variant==='equipment';
  const repair=shot.variant==='repair';
  return <>
    <Background name={shot.asset || 'dock-background'} t={t} duration={duration} dark={0.15} />
    <Car t={t} x={665} y={540} width={1130} />
    <Person x={94} bottom={81} height={806} t={t} />
    {equipment ? <Art name="equipment" style={{left:716,top:563-ramp(t,0,0.5)*33,width:647,height:364,rotate:'-4deg',filter:'drop-shadow(10px 18px 13px #0009)'}}/> : repair ? <svg width="360" height="450" style={{position:'absolute',left:979,top:442,rotate:`${-31+Math.sin(t*3.0)*12}deg`,filter:'drop-shadow(8px 15px 8px #0008)'}}><path d="M 200 63 Q 256 41 270 99 L 238 138 L 269 169 L 311 128 Q 330 194 264 208 L 113 398 Q 69 423 54 378 L 210 190 Q 145 150 168 96 L 193 137 L 227 107 Z" fill="#aab5af" stroke="#455358" strokeWidth="7"/><circle cx="85" cy="381" r="14" fill="#263839"/></svg> : <Art name="goods" style={{left: lerp(611, 900, load), top: lerp(600, 652, load) - Math.sin(load * Math.PI) * 270, width: lerp(331, 240, load), height: lerp(370, 270, load), rotate: `${Math.sin(load * Math.PI) * -16}deg`, opacity: interpolate(load, [0, 0.83, 1], [1, 1, 0], clamp), filter: 'drop-shadow(12px 18px 11px #0008)'}} />}
    {!repair && Array.from({length: 3}, (_,i) => <Cash key={i} x={lerp(550, 292, ramp(t, 0.2+i*0.14, 1.4+i*0.14))} y={730-i*11} scale={0.55} rotate={-12+i*7} opacity={1-ramp(t, 0.8+i*0.14, 1.5+i*0.14)} />)}
    <InkText x={129} y={867} size={40} color={P.bone}>{shot.labels?.[0] || 'Coffee. Paid for. In the trunk.'}</InkText>
    <Weather t={t} />
  </>;
};

const RecruitmentScene = ({shot, t, duration}: SceneProps) => {
  const empty = shot.variant === 'empty';
  const maraAt = shot.variant === 'joined' ? 0 : 1.55;
  return <>
    <Background name={shot.asset || 'payroll-background'} t={t} duration={duration} dark={0.39} />
    <Person x={116} bottom={228} height={790} t={t} />
    {!empty && <Person who="mara" x={1255} bottom={228} height={790} t={t} entrance={maraAt} facing={1} />}
    {empty && <svg width="550" height="650" style={{position:'absolute',left:1185,top:340,opacity:0.55}}><path d="M 131 347 L 358 343 L 377 491 L 113 495 Z M 148 180 L 347 180 L 353 336 L 139 340 Z" fill="#1c2527" stroke="#8e7549" strokeWidth="6" /><path d="M 132 491 L 119 616 M 356 491 L 369 616" stroke="#977c50" strokeWidth="13" /></svg>}
    <Envelope x={761} y={interpolate(t,[0,1.6],[1001,650],ease)} scale={0.82} rotate={-6} />
    <SoftLabel x={116} y={850} width={570} size={39} align="center">{shot.labels?.[0] || 'Nico · Wheelman'}</SoftLabel>
    <SoftLabel x={1234} y={850} width={570} size={39} align="center" opacity={empty?1:ramp(t,maraAt+.1,maraAt+.6)}>{shot.labels?.[1] || (empty ? 'One empty seat' : 'Mara · Muscle')}</SoftLabel>
    <SoftLabel x={697} y={518} width={530} size={35} align="center" color={P.bone} opacity={ramp(t,.3,.8)}>{shot.labels?.[2] || 'Stake committed'}</SoftLabel>
    <Weather t={t} intensity={0.62} />
  </>;
};

const AmbushScene = ({shot,t,duration}:SceneProps) => {
  const flash = ramp(t,0.8,1.05);
  const sweep = Math.sin(t * 0.92) * 37;
  return <>
    <Background name={shot.asset || 'payroll-background'} t={t} duration={duration} dark={0.3} />
    <Car t={t} x={interpolate(t,[0,1.7],[-280,190],ease)} y={549} width={1260} lights />
    <svg viewBox="0 0 1920 1080" style={{position:'absolute',inset:0,width:W,height:H,mixBlendMode:'screen',opacity:flash}}><defs><filter id="soft-searchlight" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="28"/></filter></defs><g filter="url(#soft-searchlight)" transform={`rotate(${sweep} 1660 155)`}><path d="M 1620 141 L 1690 143 L 1130 1080 L 330 1000 Z" fill="#c2dbe51f"/><path d="M 1639 148 L 1670 149 L 982 1080 L 565 1050 Z" fill="#e3e7da12"/></g><g filter="url(#soft-searchlight)" transform={`rotate(${-sweep*.55} 180 150)`}><path d="M 178 142 L 213 169 L 1720 946 L 1060 1080 Z" fill="#d9dfcf16"/></g></svg>
    <AbsoluteFill style={{background: `linear-gradient(90deg,rgba(172,37,27,${flash*(0.08+0.16*Math.max(0,Math.sin(t*4.3)))}),transparent 63%,rgba(56,119,180,${flash*(0.1+0.18*Math.max(0,-Math.sin(t*4.3)))}))`}} />
    <Weather t={t} intensity={1.4} />
    <InkText x={122} y={830} size={63} style={{opacity:ramp(t,1.3,2.0)}}>{shot.labels?.[0] || 'The law was waiting.'}</InkText>
    {shot.labels?.[1] && <InkText x={127} y={913} size={33} color={P.paper} style={{opacity:ramp(t,2.2,3.0)}}>{shot.labels[1]}</InkText>}
  </>;
};

const PrisonScene = ({shot,t,duration}:SceneProps) => {
  const closing = shot.variant==='hold' ? 1 : ramp(t,0.25,1.2);
  return <>
    <Background name={shot.asset || 'prison-background'} t={t} duration={duration} dark={0.35} close />
    <Person x={310} height={770} bottom={110} t={shot.variant==='hold'?t+2:t} opacity={0.57} />
    <Person who="mara" x={1030} height={770} bottom={110} t={shot.variant==='hold'?t+2:t} opacity={0.48} facing={1} />
    <svg width={W} height={H} style={{position:'absolute',inset:0,translate:`${(1-closing)*1940}px 0`,filter:'drop-shadow(-8px 8px 9px #000b)'}}><defs><linearGradient id="story-bars"><stop stopColor="#101c20"/><stop offset=".45" stopColor="#62747a"/><stop offset=".6" stopColor="#293a41"/><stop offset="1" stopColor="#080f13"/></linearGradient></defs>{Array.from({length:12},(_,i)=><rect key={i} x={-30+i*174} y={0} width={37} height={H} fill="url(#story-bars)"/>)}<rect x="0" y="147" width={W} height="34" fill="#17262c"/><rect x="0" y="866" width={W} height="42" fill="#17262c"/></svg>
    <AbsoluteFill style={{background:'linear-gradient(0deg,#02080df0,transparent 48%)'}} />
    <InkText x={126} y={862} size={43} color={P.bone} style={{opacity:ramp(t,0.4,1.3)}}>{shot.labels?.[0] || 'Both arrested. No informant named.'}</InkText>
    <Weather t={t} rain={false} />
  </>;
};

const LossScene = ({shot,t,duration}:SceneProps) => {
  const extraction = shot.variant === 'extraction';
  const loss = ramp(t,1.2,Math.min(4.8,duration*0.7));
  if(extraction) return <>
    <Background name={shot.asset||'street-background'} t={t} duration={duration} dark={0.23}/>
    <Car t={t} x={lerp(670,2100,ramp(t,1.3,4.8))} y={500} width={1140}/>
    <Art name="equipment" style={{left:lerp(810,2130,ramp(t,.8,4.0)),top:650,width:546,height:307,rotate:'-5deg',filter:'drop-shadow(8px 15px 12px #0007)'}}/>
    <Person x={64} height={830} bottom={98} t={t}/>
    <InkText x={736} y={449} size={43} width={967} color={P.gold}>{shot.labels?.[0]||'Extracted items leave play.'}</InkText>
    <Weather t={t}/>
  </>;
  return <>
    <Background name={shot.asset || 'opening-background'} t={t} duration={duration} dark={0.38} />
    {!extraction && <Person x={143} height={888} bottom={70} t={t} opacity={1-loss*0.91} />}
    <div style={{position:'absolute',left:extraction?566:771,top:638,width:938,height:257,background:'linear-gradient(180deg,#463a2866,#1b1711)',rotate:'-2deg',boxShadow:'0 22px 28px #0008'}} />
    {Array.from({length:5},(_,i) => <Cash key={i} x={lerp(780+i*113,2100+i*95,Math.max(0,(loss-i*0.07)/(1-i*0.07)))} y={lerp(700+i*6,390-i*63,loss)} rotate={-10+i*8+loss*20} scale={0.62} opacity={1-loss*0.9} />)}
    <Envelope x={lerp(934,1122,loss)} y={726} rotate={-9+loss*6} scale={0.76} />
    <InkText x={952} y={834} size={36} width={768} color={P.gold} style={{opacity:ramp(t,0.5,1.3)}}>{shot.labels?.[0] || (extraction?'Extracted items leave play':'A limited legacy')}</InkText>
    {extraction && <div style={{position:'absolute',left:1100,top:180,width:460,height:660,borderLeft:'10px solid #665844',borderRight:'10px solid #665844',borderTop:'16px solid #8c7448',background:'#02090b55',opacity:ramp(t,0,1)}}><Stamp x={25} y={235} size={31} opacity={ramp(t,2.4,3.4)}>Outside the game</Stamp></div>}
    <Weather t={t} rain={false} />
  </>;
};

const EvidenceScene = ({shot,t,duration}:SceneProps) => {
  const left = ramp(t,0.2,1.3);
  const right = ramp(t,1.5,2.7);
  if(shot.variant==='permission') return <>
    <Background name={shot.asset || 'evidence-background'} t={t} duration={duration} dark={0.21}/>
    <Art name="evidence-file" style={{left:lerp(430,982,ramp(t,1.6,3.7)),top:348,width:526,height:478,rotate:`${lerp(-9,5,ramp(t,1.6,3.7))}deg`,filter:'drop-shadow(9px 18px 14px #0009)'}}/>
    <SoftLabel x={174} y={209} width={620} size={45}>{shot.labels?.[0] || 'Private discovery'}</SoftLabel>
    <SoftLabel x={1040} y={209} width={710} size={43} opacity={ramp(t,1.6,2.3)}>{shot.labels?.[1] || 'Shared with permission'}</SoftLabel>
    <Stamp x={778} y={573} rotate={-7} opacity={ramp(t,1.2,1.5)}>Permission given</Stamp>
    <SoftLabel x={555} y={829} width={810} size={41} align="center" color={P.bone}>{shot.labels?.[2] || 'Choose who knows.'}</SoftLabel>
    <Weather t={t} rain={false}/>
  </>;
  if(shot.variant==='craft') return <>
    <Background name={shot.asset || 'evidence-background'} t={t} duration={duration} dark={0.19}/>
    <Art name="goods" style={{left:321,top:377,width:351,height:395,opacity:1-ramp(t,2,3.4),translate:`${ramp(t,1.2,3)*300}px 0`}}/>
    <Paper x={769} y={344} width={402} height={410} rotate={-5}><InkText x={36} y={41} size={32} width={340} color="#374131">{shot.labels?.[1] || 'Eligible recipe'}</InkText><svg width="402" height="410"><path d="M 45 133 H 338 M 45 163 H 284 M 45 193 H 310 M 45 244 H 341 M 45 274 H 290" stroke="#6f7658" strokeWidth="3"/></svg><Stamp x={45} y={316} size={23} color="#824d36" opacity={ramp(t,2,2.5)}>Traceable</Stamp></Paper>
    <Art name="equipment" style={{left:1160,top:471,width:576,height:324,opacity:ramp(t,2.4,3.3),scale:lerp(.89,1,ramp(t,2.4,3.3)),filter:'drop-shadow(9px 18px 12px #0008)'}}/>
    <InkText x={228} y={808} size={35} width={513}>{shot.labels?.[0] || 'Salvage + materials'}</InkText>
    <InkText x={1128} y={826} size={35} width={616} color={P.gold}>{shot.labels?.[2] || 'A traceable item history'}</InkText>
    <Weather t={t} rain={false}/>
  </>;
  return <>
    <Background name={shot.asset || 'evidence-background'} t={t} duration={duration} dark={0.26} close />
    <Art name="evidence-file" style={{left:lerp(-610,285,left),top:286,width:555,height:572,rotate:`${lerp(-17,-8,left)}deg`,filter:'drop-shadow(12px 20px 14px #0008)'}} />
    <Art name="evidence-file" style={{left:lerp(1920,1072,right),top:245,width:555,height:572,rotate:`${lerp(22,6,right)}deg`,filter:'drop-shadow(12px 20px 14px #0008)'}} />
    <Paper x={390} y={490} width={324} height={188} rotate={-8} style={{opacity:left}}><InkText x={27} y={27} size={25} color="#29342e">{shot.labels?.[0] || 'First discovery'}</InkText><svg width="320" height="180"><path d="M 43 140 L 53 81 L 112 73 L 127 140 Z M 77 96 H 108" fill="none" stroke="#445046" strokeWidth="4"/><path d="M 170 94 H 268 M 172 114 H 249 M 172 134 H 256" stroke="#5e644e" strokeWidth="3" /></svg></Paper>
    <Paper x={1190} y={452} width={324} height={188} rotate={6} style={{opacity:right}}><InkText x={24} y={26} size={25} color="#29342e">{shot.labels?.[1] || 'Independent evidence'}</InkText><svg width="320" height="180"><circle cx="82" cy="112" r="34" fill="none" stroke="#445046" strokeWidth="4"/><path d="M 64 112 L 82 93 L 105 120 M 168 94 H 272 M 167 113 H 254 M 166 135 H 258" fill="none" stroke="#5e644e" strokeWidth="3"/></svg></Paper>
    <svg width={W} height={H} style={{position:'absolute',inset:0}}><path d="M 720 457 Q 932 590 1210 416" stroke="#a6513f" strokeWidth="5" fill="none" pathLength="1" strokeDasharray="1" strokeDashoffset={1-ramp(t,2.8,4.1)} /><circle cx="720" cy="457" r="9" fill="#b8563f" opacity={left}/><circle cx="1210" cy="416" r="9" fill="#b8563f" opacity={right}/></svg>
    <InkText x={480} y={885} size={40} width={980} style={{textAlign:'center',opacity:ramp(t,3.3,4.4)}}>{shot.labels?.[2] || 'A copied clue is not another witness.'}</InkText>
    <Weather t={t} rain={false} />
  </>;
};

const FamilyScene = ({shot,t,duration}:SceneProps) => {
  const route=ramp(t,0.8,Math.max(2.3,duration-1));
  const convoyX=lerp(427,1436,route);
  const convoyY=lerp(896,779,route)-Math.sin(route*Math.PI)*67;
  return <>
    <Background name={shot.asset || 'family-background'} t={t} duration={duration} dark={0.13}/>
    <svg width={W} height={H} style={{position:'absolute',inset:0}}><path d="M 456 914 Q 922 647 1465 797" fill="none" stroke="#75372c" strokeWidth="7" strokeDasharray="15 11"/><path d="M 456 914 Q 922 647 1465 797" fill="none" stroke="#e4b469" strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset={1-route}/>{[{x:456,y:914},{x:973,y:759},{x:1465,y:797}].map((p,i)=><g key={i}><ellipse cx={p.x} cy={p.y+10} rx="20" ry="8" fill="#090e09bb"/><path d={`M ${p.x} ${p.y+5} V ${p.y-49}`} stroke="#343b31" strokeWidth="5"/><circle cx={p.x} cy={p.y-52} r="13" fill={i===2?'#823b30':'#bb8b4c'} stroke="#f0cd80" strokeWidth="2"/></g>)}</svg>
    <div style={{position:'absolute',left:convoyX,top:convoyY,width:66,height:33,background:'#243438',border:'3px solid #cdb077',borderRadius:7,rotate:`${-17+route*18}deg`,boxShadow:'6px 8px 5px #0009'}}><div style={{position:'absolute',left:17,top:4,width:31,height:11,background:'#749493',border:'2px solid #172c31'}}/></div>
    {[0,1,2].map(i=><Coin key={i} x={343+i*56} y={646+i*10-ramp(t,0.4+i*0.2,1.6+i*0.2)*29} size={98} t={t+i}/>)}
    <SoftLabel x={110} y={274} width={815} size={54}>{shot.labels?.[0] || 'Territory'}</SoftLabel>
    <SoftLabel x={1080} y={367} width={718} size={46}>{shot.labels?.[1] || 'Shared operations'}</SoftLabel>
    <SoftLabel x={112} y={399} width={788} size={40} color={P.paper} opacity={ramp(t,.35,.9)}>{shot.labels?.[2] || 'Contribute · Approve'}</SoftLabel>
    <Weather t={t} rain={false}/>
  </>;
};
const Telegraph = ({t}: {t:number}) => <svg viewBox="0 0 600 350" style={{position:'absolute',left:1040,top:558,width:653,height:381,filter:'drop-shadow(10px 23px 12px #000b)'}}><path d="M 48 174 L 509 146 L 573 279 L 87 326 Z" fill="#493321" stroke="#8f7244" strokeWidth="7"/><ellipse cx="162" cy="212" rx="64" ry="25" fill="#9b7f49"/><ellipse cx="438" cy="202" rx="50" ry="19" fill="#9b7f49"/><path d="M 164 205 L 167 97 M 438 194 L 430 81" stroke="#af965f" strokeWidth="23"/><g transform={`rotate(${Math.sin(t*5)>0?3:-5} 330 98)`}><path d="M 164 99 L 457 83" stroke="#d6b477" strokeWidth="24"/><ellipse cx="418" cy="71" rx="66" ry="23" fill="#161c1c" stroke="#aa8d53" strokeWidth="5"/></g><path d="M 492 216 Q 583 86 554 50 Q 518 10 521 128" fill="none" stroke="#262522" strokeWidth="10"/></svg>;

const AgentScene = ({shot,t,duration}:SceneProps) => {
  const state = shot.variant==='result' ? 2 : shot.variant==='action' ? (t<duration*.62?1:2) : t < duration*0.34 ? 0 : t < duration*0.67 ? 1 : 2;
  return <>
    <Background name={shot.asset || 'evidence-background'} t={t} duration={duration} dark={0.35} />
    <Telegraph t={t} />
    <Paper x={252} y={300-ramp(t,0,1.2)*32} width={694} height={530} rotate={-6}>
      <InkText x={46} y={40} size={31} color="#2c382e">{shot.labels?.[0] || 'An agent’s street job'}</InkText>
      <div style={{position:'absolute',left:46,right:46,top:102,borderTop:'2px solid #66593866'}} />
      {['READ AVAILABLE ACTIONS','TAKE THE JOB','READ THE NEW STATE'].map((label,i)=><div key={label} style={{position:'absolute',left:49,top:153+i*111,fontFamily:'Arial, sans-serif',fontSize:29,letterSpacing:1,color:'#303c31',opacity:state>=i?1:0.15}}><span style={{marginRight:21,color:'#8a4a31'}}>0{i+1}</span>{label}<div style={{width:interpolate(t,[duration*(i/3)+0.2,duration*(i/3)+1.3],[0,510],clamp),height:2,background:'#8b6240',marginTop:16}}/></div>)}
    </Paper>
    <div style={{position:'absolute',left:1050,top:388,width:591,height:110,background:'#cebc8f',rotate:'-3deg',boxShadow:'4px 10px 15px #0007',overflow:'hidden'}}><div style={{position:'absolute',left:28-ramp(t,1,Math.max(2,duration))*94,top:24,fontFamily:'Arial, sans-serif',fontSize:26,color:'#433e2c',whiteSpace:'nowrap',letterSpacing:7}}>{state===2?'NERVE ↓   CASH ↑   RESPECT ↑':'•  —  • •   — •  —   • •  — •'}</div></div>
    <InkText x={295} y={894} size={35} color={P.paper}>{shot.labels?.[1] || 'Permissions and resources still apply.'}</InkText>
    <Weather t={t} rain={false} />
  </>;
};

const Tray = ({x,y,width=440,label,color=P.gold}: {x:number;y:number;width?:number;label:string;color?:string}) => <div style={{position:'absolute',left:x,top:y,width,height:259,background:'linear-gradient(160deg,#322a1a,#121b1b)',border:'8px solid #665334',boxShadow:'11px 20px 19px #0009,inset 0 0 30px #000a',rotate:'-3deg'}}><div style={{position:'absolute',left:29,right:29,bottom:25,fontFamily:'Georgia, serif',fontSize:34,color,textAlign:'center'}}>{label}</div></div>;

const BalanceScene = ({shot,t,duration}:SceneProps) => {
  const windowMode=shot.variant==='window';
  const recycle=shot.variant==='recycle';
  return <>
    <Background name={shot.asset || 'finance-background'} t={t} duration={duration} dark={0.12}/>
    {windowMode ? <>
      {[0,1,2].map(i=>{const p=ramp(t,0.5+i*0.34,2.5+i*0.34);return <Coin key={i} x={lerp(892+i*30,603,p)} y={lerp(493+i*17,507,p)-Math.sin(p*Math.PI)*174} size={111} t={t+i} opacity={1-ramp(p,0.8,1)}/>;})}
      {[0,1,2].map(i=>{const p=ramp(t,2.2+i*0.32,4.3+i*0.32);return <Cash key={i} x={lerp(601,242+i*29,p)} y={lerp(494,461+i*22,p)-Math.sin(p*Math.PI)*124} scale={0.81} rotate={-6+p*7} opacity={ramp(p,0,0.15)}/>;})}
      <InkText x={221} y={801} size={39} color={P.green}>Game cash</InkText>
      <InkText x={837} y={801} size={39} color={P.gold}>In-game OMR</InkText>
      <InkText x={1310} y={801} size={37} color={P.blue}>Wallet OMR · separate</InkText>
      <svg width={W} height={H} style={{position:'absolute',inset:0}}><path d="M 919 354 Q 582 223 396 341" fill="none" stroke={P.gold} strokeWidth="4" pathLength="1" strokeDasharray="1" strokeDashoffset={1-ramp(t,0.5,2)}/><path d="M 396 341 L 415 303 L 438 334 Z" fill={P.gold} opacity={ramp(t,1.7,2)}/></svg>
      <InkText x={429} y={211} size={31} color={P.gold}>Funded Window · one way</InkText>
      {shot.labels?.[2] && <InkText x={128} y={887} size={31} color={P.paper}>{shot.labels[2]}</InkText>}
    </> : <>
      {[0,1,2,3].map(i=><Cash key={i} x={227+(i%2)*108+i*12} y={interpolate(t,[0.2+i*0.15,1.3+i*0.15],[180,412+Math.floor(i/2)*88],ease)} scale={0.76} rotate={-7+i*5}/>)}
      {[0,1,2,3,4].map(i=><Coin key={i} x={841+(i%3)*57} y={interpolate(t,[0.5+i*0.13,1.6+i*0.13],[150,421+Math.floor(i/3)*70],ease)} size={121} t={t+i}/>)}
      <Coin x={1478} y={431} size={151} t={t}/>
      <InkText x={211} y={799} size={40} color={P.green}>{shot.labels?.[0] || 'Game cash'}</InkText>
      <InkText x={841} y={799} size={40} color={P.gold}>{shot.labels?.[1] || 'In-game OMR'}</InkText>
      <InkText x={1417} y={799} size={40} color={P.blue}>{shot.labels?.[2] || 'Wallet OMR'}</InkText>
      <InkText x={1401} y={863} size={29} color={P.blue}>Separate. Onchain.</InkText>
      {recycle && <svg width={W} height={H} style={{position:'absolute',inset:0}}><path d="M 913 428 C 647 233 1283 233 1022 423" fill="none" stroke={P.gold} strokeWidth="4" pathLength="1" strokeDasharray="1" strokeDashoffset={1-ramp(t,1.5,3.8)}/><path d="M 1022 423 L 1027 384 L 1056 402 Z" fill={P.gold} opacity={ramp(t,3.5,3.8)}/></svg>}
    </>}
    <Weather t={t} rain={false}/>
  </>;
};
const FeesScene = ({shot,t,duration}:SceneProps) => {
  const targets=[{x:280,y:663,label:'Developer'},{x:700,y:663,label:'Community'},{x:1120,y:663,label:'Assets'},{x:1540,y:663,label:'Liquidity'}];
  return <>
    <Background name={shot.asset||'finance-background'} t={t} duration={duration} dark={0.3}/>
    <Envelope x={775} y={257} rotate={-3} scale={0.9}/>
    <InkText x={788} y={240} size={36} color={P.gold}>Trading fees</InkText>
    {targets.map((item,i)=><React.Fragment key={item.label}>
      <Paper x={item.x-145} y={622} width={305} height={241} rotate={i%2?4:-4}><InkText x={16} y={155} size={29} width={272} color="#393d2f" style={{textAlign:'center'}}>{shot.labels?.[i]||item.label}</InkText></Paper>
      {[0,1,2].map(j=>{const p=ramp(t,0.65+i*0.45+j*0.2,2.2+i*0.45+j*0.2);return <Coin key={j} x={lerp(900,item.x-24+j*11,p)} y={lerp(382,item.y-20+j*6,p)-Math.sin(p*Math.PI)*130} size={88} t={t+i} opacity={ramp(p,0,0.12)}/>;})}
    </React.Fragment>)}
    <Weather t={t} rain={false}/>
  </>;
};

const BondsScene = ({shot,t,duration}:SceneProps) => {
  const release=ramp(t,1.5,Math.max(3.5,duration-1.0));
  return <>
    <Background name={shot.asset||'finance-background'} t={t} duration={duration} dark={0.3} close/>
    <Paper x={287} y={307} width={669} height={552} rotate={-7}>
      <InkText x={49} y={44} size={43} color="#36402e">{shot.labels?.[0]||'Inventory bond'}</InkText>
      <InkText x={52} y={115} size={27} color="#4d503a">{shot.labels?.[1]||'Existing OMR · released over time'}</InkText>
      <svg width="669" height="552"><path d="M 62 428 H 606" stroke="#827049" strokeWidth="3"/>{[0,1,2,3,4].map(i=><g key={i}><path d={`M ${80+i*125} 412 V 446`} stroke="#827049" strokeWidth="3"/><circle cx={80+i*125} cy="428" r={9} fill={release>=i/4?'#8b4f35':'#ada07d'}/></g>)}</svg>
      <Stamp x={100} y={245} size={29} rotate={-7} color="#7c4934">Inventory, then release</Stamp>
    </Paper>
    <Tray x={1124} y={558} width={541} label={shot.labels?.[2]||'Released OMR'}/>
    {[0,1,2,3,4].map(i=>{const p=ramp(t,1.5+i*0.52,3+i*0.52);return <Coin key={i} x={lerp(660+i*13,1260+(i%3)*51,p)} y={lerp(572+i*7,582+Math.floor(i/3)*35,p)-Math.sin(p*Math.PI)*158} size={114} t={t+i}/>;})}
    <Weather t={t} rain={false}/>
  </>;
};

const LiquidityScene = ({shot,t,duration}:SceneProps) => {
  const rights=shot.variant==='rights';
  const profit=shot.variant==='profit';
  return <>
    <Background name={shot.asset||'finance-background'} t={t} duration={duration} dark={0.17}/>
    {[0,1,2,3,4,5].map(i=><Coin key={i} x={837+(i%3)*56} y={417+Math.floor(i/3)*65} size={118} t={t+i}/>)}
    <Envelope x={1320} y={422} rotate={7} scale={0.74}/>
    <Envelope x={199} y={465} rotate={-7} scale={0.79}/>
    {Array.from({length:3},(_,i)=>{const p=ramp(t,1.0+i*0.6,3.8+i*0.6);return <Coin key={`reward${i}`} x={lerp(1474,342+i*22,p)} y={lerp(480,501+i*13,p)-Math.sin(p*Math.PI)*232} size={87} t={t} opacity={ramp(p,0,0.1)}/>;})}
    <InkText x={163} y={800} size={35} width={521} color={P.gold}>{shot.labels?.[rights||profit?0:1]||(rights?'Designated fee rights':'Eligible positions')}</InkText>
    <InkText x={847} y={800} size={38} color={P.blue}>Pool principal</InkText>
    <InkText x={846} y={858} size={27} color={P.paper}>Stays in the pool</InkText>
    <InkText x={1322} y={800} size={33} width={478} color={P.gold}>{shot.labels?.[rights||profit?1:2]||(rights?'Trading fees':'Funded campaigns')}</InkText>
    {shot.labels?.[0] && <InkText x={123} y={285} size={43} color={P.paper}>{shot.labels[0]}</InkText>}
    <Weather t={t} rain={false}/>
  </>;
};
const RwaScene = ({shot,t,duration}:SceneProps) => {
  return <>
    <Background name={shot.asset||'finance-background'} t={t} duration={duration} dark={0.34}/>
    <Paper x={315} y={287} width={818} height={607} rotate={-5}>
      <div style={{position:'absolute',inset:35,border:'5px double #78633f'}}/>
      <InkText x={75} y={60} size={55} color="#343e31">{shot.labels?.[0]||'Stock Tokens'}</InkText>
      <InkText x={77} y={142} size={29} color="#4d513a">{shot.labels?.[1]||'Exposure beyond the game'}</InkText>
      <svg width="818" height="607" style={{position:'absolute',inset:0}}><g fill="#5b644f" stroke="#263e35" strokeWidth="2"><path d="M 109 401 V 258 L 201 230 L 201 401 Z M 226 401 V 282 L 319 282 V 401 Z M 355 401 V 218 L 445 252 V 401 Z M 493 401 V 269 L 677 220 V 401 Z"/>{Array.from({length:9},(_,i)=><path key={i} d={`M ${126+i*61} 313 h 17 v 25 h -17 Z M ${126+i*61} 360 h 17 v 25 h -17 Z`} fill="#cab885" stroke="none"/>)}</g><path d="M 96 438 H 708 M 110 500 H 294 M 489 498 H 688" stroke="#8c774d" strokeWidth="3"/></svg>
      <Stamp x={390} y={477} size={26} rotate={-4} opacity={ramp(t,1.6,2.7)}>Eligibility applies</Stamp>
    </Paper>
    <Envelope x={1279} y={607} rotate={10} scale={0.9}/>
    <Coin x={1390} y={383} size={200} t={t}/>
    <InkText x={1261} y={845} size={30} width={448} color={P.paper}>{shot.labels?.[2]||'Acquisition · custody · eligibility'}</InkText>
    <Weather t={t} rain={false}/>
  </>;
};

type SceneProps = {shot:StoryShot;t:number;duration:number};

const ClosingScene = ({shot,t,duration}:SceneProps) => {
  const plate=shot.asset||'street-background';
  const indoors=plate==='finance-background'||plate==='opening-background';
  return <>
    <Background name={plate} t={t} duration={duration} dark={0.25} close/>
    {!indoors && <Person x={210} height={928} bottom={37} t={t+2}/>}
    {plate==='finance-background' && <Coin x={878} y={415} size={202} t={t}/>}
    {shot.labels?.[0] && <InkText x={985} y={645} width={712} size={48} color={P.gold} style={{opacity:ramp(t,.1,.6)}}>{shot.labels[0]}</InkText>}
    <Weather t={t} rain={!indoors} intensity={0.6}/>
  </>;
};

/** All animation is derived from the local Sequence frame; no browser timers or CSS animations. */
export const StoryScene = ({shot}: {shot:StoryShot}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const t=frame/fps;
  const duration=Math.max(1,shot.end-shot.start);
  const props={shot,t,duration};
  const scenes:Record<StoryShot['scene'],React.FC<SceneProps>>={street:StreetScene,paths:PathsScene,drive:DriveScene,cargo:CargoScene,recruitment:RecruitmentScene,approach:DriveScene,ambush:AmbushScene,prison:PrisonScene,loss:LossScene,evidence:EvidenceScene,family:FamilyScene,agent:AgentScene,balances:BalanceScene,fees:FeesScene,bonds:BondsScene,liquidity:LiquidityScene,rwa:RwaScene,closing:ClosingScene};
  const Scene=scenes[shot.scene];
  return <AbsoluteFill style={{background:P.ink,overflow:'hidden',isolation:'isolate'}}>
    <Scene {...props}/>
    <AbsoluteFill style={{zIndex:1,background:'radial-gradient(ellipse at 50% 43%,transparent 38%,#0106086b 100%)',pointerEvents:'none'}}/>
    <AbsoluteFill style={{zIndex:1,background:'linear-gradient(180deg,#020608c9 0%,transparent 25%,transparent 74%,#020608c2 100%)',pointerEvents:'none'}}/>
    <HeroHeadline shot={shot} t={t}/>
    <div style={{position:'absolute',zIndex:4,left:0,right:0,top:0,height:44,background:'#030709'}}/>
    <div style={{position:'absolute',zIndex:4,left:0,right:0,bottom:0,height:44,background:'#030709'}}/>
  </AbsoluteFill>;
};
