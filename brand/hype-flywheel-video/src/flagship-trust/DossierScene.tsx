import {CanvasImage, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Envelope, Headline} from './Frame';
import {Media} from './Media';
import {C, FONT, localPath, type SceneProps} from './types';

export const DossierScene = ({beat, manifest}: SceneProps) => {
  const frame = useCurrentFrame();
  const art = beat.asset ? manifest.assets[beat.asset] : undefined;
  const capture = beat.capture ? manifest.assets[beat.capture] : undefined;
  const logo = typeof manifest.brandLogo === 'string' ? manifest.brandLogo : manifest.brandLogo?.src;
  if (beat.kind === 'end') return <>
    <Headline text={beat.headline} left={112} top={260} width={1010} size={114} />
    {(beat.labels || []).map((label, i) => <div key={label} style={{position: 'absolute', left: 118, top: 578 + i * 66, width: 940, color: i ? C.muted : C.gold, fontSize: i ? 35 : 52, lineHeight: 1.12}}>{label}</div>)}
    {logo ? <CanvasImage src={staticFile(localPath(logo))} style={{position: 'absolute', left: 1250, top: 250, width: 470, height: 470, objectFit: 'contain'}} /> : null}
    <Envelope left={1244} top={717} width={306} rotate={-4} />
  </>;
  return <>
    {art ? <div style={{position: 'absolute', left: 1120, top: 135, width: 640, height: 735, overflow: 'hidden', opacity: 0.86}}><Media asset={art} duration={beat.end - beat.start} width={640} height={735} focus={beat.focus} /><div style={{position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#10111550,transparent 35%),linear-gradient(0deg,#10111566,transparent 30%)'}} /></div> : null}
    <div style={{position: 'absolute', left: 102, top: 180, width: 872, height: 653, borderTop: `1px solid ${C.gold}`, background: '#1B1B1BE0', rotate: '-0.4deg', boxShadow: '0 12px 50px #0005'}} />
    <div style={{position: 'absolute', left: 130, top: 201, color: C.gold, fontFamily: FONT.mono, fontSize: 22, letterSpacing: 3}}>CITY DOSSIER / {beat.id}</div>
    <Headline text={beat.headline} left={128} top={270} width={790} size={92} />
    <div style={{position: 'absolute', left: 136, top: 535, width: 750, fontSize: 34, lineHeight: 1.35, color: C.muted}}>{beat.character ? <div style={{fontFamily: FONT.title, fontSize: 48, color: C.bone}}>{beat.character}<span style={{fontFamily: FONT.body, fontSize: 29, color: C.gold, marginLeft: 30}}>{beat.path}</span></div> : null}{(beat.labels || []).slice(0, 3).map((label, i) => <div key={label} style={{marginTop: 16, opacity: interpolate(frame, [i * 12, i * 12 + 20], [0.4, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>{label}</div>)}</div>
    {capture ? <div style={{position: 'absolute', left: 1090, top: 340, width: 730, height: 430, overflow: 'hidden', border: `1px solid ${C.gold}`, boxShadow: '0 20px 44px #0008'}}><Media asset={capture} duration={beat.end - beat.start} width={730} height={430} focus={{x: 0.5, y: 0.5, scale: 1}} /></div> : <Envelope left={936} top={642} width={426} rotate={-7} />}
    {beat.note ? <div style={{position: 'absolute', left: 130, top: 837, width: 830, color: C.muted, fontSize: 26}}>{beat.note}</div> : null}
  </>;
};
