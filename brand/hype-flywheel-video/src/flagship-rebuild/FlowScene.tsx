import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, clamp, FONT, type SceneProps} from './types';

export const FlowScene = ({beat}: SceneProps) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const duration = beat.end - beat.start; const p = clamp(frame / (duration * fps));
  const labels = beat.labels || []; const mode = beat.mode || 'sequence';
  const light = mode === 'balances' || mode === 'resources';
  const ink = light ? C.ink : C.bone;
  const active = Math.min(labels.length - 1, Math.floor(p * labels.length));
  const reveal = (index: number) => interpolate(frame, [fps * (0.4 + index * 0.28), fps * (1.1 + index * 0.28)], [0, 1], {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: Easing.bezier(0.16, 1, 0.3, 1)});
  return <AbsoluteFill style={{backgroundColor: light ? C.bone : C.ink, color: ink, overflow: 'hidden'}}>
    <div style={{position: 'absolute', top: 95, left: 105, right: 105, fontFamily: FONT.title, fontSize: beat.headline.length > 35 ? 82 : 98, lineHeight: 1.06, letterSpacing: -2, whiteSpace: 'pre-line'}}>{beat.headline}</div>
    {mode === 'fees' ? <>
      <div style={{position: 'absolute', left: 108, top: 443, fontFamily: FONT.title, fontSize: 130, color: C.amber, lineHeight: 1.04, opacity: reveal(0)}}>Fees</div>
      <div style={{position: 'absolute', left: 450, top: 348, width: 3, height: 440, backgroundColor: '#6d593d'}} />
      {labels.map((label, i) => <div key={i} style={{position: 'absolute', left: 450, right: 100, top: 331 + i * (440 / Math.max(1, labels.length - 1)), display: 'flex', alignItems: 'center', gap: 30, opacity: reveal(i), translate: `${(1 - reveal(i)) * 60}px 0`}}><div style={{width: 110 + clamp(p * 2 - i * 0.15) * 60, height: 3, backgroundColor: C.amber}} /><div style={{fontFamily: FONT.body, fontSize: 45, lineHeight: 1.1}}>{label}</div></div>)}
    </> : mode === 'balances' ? <>
      <div style={{position: 'absolute', top: 343, left: 110, width: 1700, height: 3, backgroundColor: '#c1b49b'}}><div style={{width: `${p * 100}%`, height: 3, backgroundColor: '#876126'}} /></div>
      {labels.map((label, i) => {const local = p * labels.length - i; const parts = label.split(' / '); const opacity = interpolate(local, [-0.08, 0.05, 0.88, 1], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); return <div key={i} style={{position: 'absolute', left: 110, right: 110, top: 410, opacity, translate: `${interpolate(local, [-0.08, 0.15], [200, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)})}px 0`}}><div style={{font: `28px ${FONT.mono}`, color: '#876126', marginBottom: 36}}>{String(i + 1).padStart(2, '0')} / {String(labels.length).padStart(2, '0')}</div><div style={{font: `126px ${FONT.title}`, lineHeight: 1.1}}>{parts[0]}</div>{parts[1] ? <div style={{font: `53px ${FONT.body}`, marginTop: 24, color: '#655848'}}>{parts.slice(1).join(' / ')}</div> : null}</div>;})}
    </> : mode === 'route' ? <>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}><path d="M 190 700 C 520 420, 680 820, 945 570 S 1450 330, 1710 640" stroke="#4b4438" strokeWidth={3} fill="none" /><path d="M 190 700 C 520 420, 680 820, 945 570 S 1450 330, 1710 640" stroke={C.amber} strokeWidth={5} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp(p * 1.5)} /></svg>
      {labels.map((label, i) => <div key={i} style={{position: 'absolute', left: 135 + i * (1300 / Math.max(1, labels.length - 1)), top: 585 + Math.sin(i * 2.2) * 105, width: 350, opacity: reveal(i)}}><div style={{width: 20, height: 20, borderRadius: 20, border: `3px solid ${C.amber}`, marginBottom: 30, backgroundColor: C.ink}} /><div style={{font: `42px ${FONT.title}`, lineHeight: 1.15}}>{label}</div></div>)}
    </> : mode === 'roster' ? <>
      {labels.map((label, i) => <div key={i} style={{position: 'absolute', left: 107, right: 107, top: 318 + i * (484 / Math.max(1, labels.length)), height: 484 / Math.max(1, labels.length), display: 'flex', gap: 54, alignItems: 'center', borderBottom: '1px solid #534a3a', opacity: reveal(i), translate: `${(1 - reveal(i)) * 170}px 0`}}><div style={{font: `29px ${FONT.mono}`, color: C.amber}}>{String(i + 1).padStart(2, '0')}</div><div style={{font: `52px ${FONT.title}`}}>{label}</div></div>)}
    </> : mode === 'resources' ? <>
      {labels.map((label, i) => <div key={i} style={{position: 'absolute', left: 110, top: 315 + i * (490 / Math.max(1, labels.length)), width: 1660, display: 'flex', gap: 37, alignItems: 'center', opacity: reveal(i)}}><div style={{font: `28px ${FONT.mono}`, color: '#876126'}}>0{i + 1}</div><div style={{height: 3, width: 70 + clamp(p * 2 - i * 0.2) * 120, backgroundColor: '#876126'}} /><div style={{font: `65px ${FONT.title}`, lineHeight: 1.1}}>{label}</div></div>)}
    </> : <>
      <div style={{position: 'absolute', left: 105, top: 338, color: C.amber, font: `29px ${FONT.mono}`}}>{String(active + 1).padStart(2, '0')} / {String(labels.length).padStart(2, '0')}</div>
      {labels.map((label, i) => {const local = p * labels.length - i; const parts = label.split(' / '); const opacity = interpolate(local, [-0.12, 0, 0.82, 1], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}); return <div key={i} style={{position: 'absolute', left: 103, right: 135, top: 420, opacity, translate: `0 ${interpolate(local, [-0.12, 0.16], [65, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px`}}><div style={{font: `${parts[0].length > 35 ? 92 : 123}px ${FONT.title}`, lineHeight: 1.1}}>{parts[0]}</div>{parts[1] ? <div style={{font: `48px ${FONT.body}`, color: C.amber, marginTop: 30}}>{parts.slice(1).join(' / ')}</div> : null}</div>;})}
      <div style={{position: 'absolute', left: 110, top: 790, width: 1690, height: 3, backgroundColor: '#4f4534'}}><div style={{width: `${p * 100}%`, height: 3, backgroundColor: C.amber}} /></div>
    </>}
    {beat.note ? <div style={{position: 'absolute', left: 108, right: 108, bottom: 169, font: `30px ${FONT.body}`, lineHeight: 1.2, color: light ? '#655848' : C.muted}}>{beat.note}</div> : null}
  </AbsoluteFill>;
};
