import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, clamp, FPS, type Beat} from './types';

export const motion = (frame: number, start = 0, end = 35) => interpolate(frame, [start, end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.18, 0.75, 0.25, 1)});
export const Label = ({text, left, top, width = 840, size = 44, color = C.ivory, align = 'left'}: {text: string; left: number; top: number; width?: number; size?: number; color?: string; align?: 'left' | 'center' | 'right'}) => <div style={{position: 'absolute', left, top, width, color, fontFamily: 'Arial, sans-serif', fontSize: size, lineHeight: 1.13, whiteSpace: 'pre-line', textAlign: align, textWrap: 'balance'}}>{text}</div>;

export const Heading = ({beat}: {beat: Beat}) => <>
  <Label text={beat.chapter || 'OMERTÀ / MARKET V2'} left={90} top={140} size={27} color={C.copper} />
  <div style={{position: 'absolute', left: 90, top: 206, width: 840, fontFamily: 'Arial, sans-serif', fontSize: 84, fontWeight: 600, letterSpacing: -3.4, color: C.ivory, lineHeight: 1.02, whiteSpace: 'pre-line', textWrap: 'balance'}}>{beat.headline}</div>
</>;

export const Tags = ({beat}: {beat: Beat}) => <div style={{position: 'absolute', left: 90, top: 1248, width: 840, minHeight: 112, borderTop: `1px solid ${C.line}`, paddingTop: 18, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: '7px 23px', fontFamily: 'Arial, sans-serif', color: C.ivory, fontSize: 44, lineHeight: 1.12}}>
  {beat.tags?.map((tag, index) => <span key={`${index}-${tag}`} style={{display: 'inline-flex', gap: 11, alignItems: 'center', whiteSpace: 'nowrap'}}><span style={{width: 5, height: 5, background: C.copper, flexShrink: 0}} />{tag}</span>)}
</div>;

export const Arrow = ({x1, y1, x2, y2, progress = 1, color = C.copper}: {x1: number; y1: number; x2: number; y2: number; progress?: number; color?: string}) => <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
  <path d={`M${x1} ${y1}L${x2} ${y2}`} stroke={C.line} strokeWidth={2} fill="none" />
  <path d={`M${x1} ${y1}L${x2} ${y2}`} stroke={color} strokeWidth={3} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp(progress)} />
  <g style={{opacity: clamp((progress - 0.8) * 5)}} transform={`translate(${x2} ${y2}) rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI})`}><path d="M-12 -7L0 0L-12 7" stroke={color} strokeWidth={3} fill="none" /></g>
</svg>;

export const Vessel = ({x, y, width = 245, height = 200, fill, label, color = C.blue}: {x: number; y: number; width?: number; height?: number; fill: number; label: string; color?: string}) => <>
  <div style={{position: 'absolute', left: x, top: y, width, height, border: `1px solid ${color}`, boxSizing: 'border-box', overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${clamp(fill) * 100}%`, background: `linear-gradient(180deg,${color}80,${color}25)`, borderTop: `2px solid ${color}`}} />
    {[0.25, 0.5, 0.75].map(tick => <div key={tick} style={{position: 'absolute', width: 16, height: 1, left: 0, top: height * tick, background: `${color}90`}} />)}
  </div>
  <Label text={label} left={x - 15} top={y + height + 17} width={width + 30} align="center" />
</>;

export const SceneStage = ({beat, children}: {beat: Beat; children: React.ReactNode}) => {
  const frame = useCurrentFrame();
  const transient = beat.transition === 'spin' ? interpolate(frame, [0, 10], [-360, 0], {extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1)}) : 0;
  return <AbsoluteFill style={{background: C.black, color: C.ivory}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 70% 44%,#15232A 0%,#080B0D 64%)'}} />
    <AbsoluteFill style={{rotate: `${transient}deg`, scale: beat.transition === 'snap' || beat.transition === 'scope' ? interpolate(frame, [0, 10], [1.06, 1], {extrapolateRight: 'clamp'}) : 1}}>{children}</AbsoluteFill>
    <Heading beat={beat} />
    <Tags beat={beat} />
    {beat.transition === 'scope' && frame < 14 ? <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: interpolate(frame, [0, 4, 9, 14], [0, 0.7, 0.7, 0], {extrapolateRight: 'clamp'})}}><circle cx={510} cy={810} r={interpolate(frame, [0, 9], [200, 64], {extrapolateRight: 'clamp'})} fill="none" stroke={C.copper} strokeWidth={2} /><path d="M510 710v45 M510 865v45 M410 810h45 M565 810h45" stroke={C.copper} strokeWidth={2} /></svg> : null}
    {(beat.transition === 'scope' || beat.transition === 'spin') && frame === 10 ? <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}><path d="M492 792l11 11 M528 792l-11 11 M492 828l11-11 M528 828l-11-11" stroke={C.ivory} strokeWidth={3} /></svg> : null}
    <div style={{position: 'absolute', top: 1590, left: 90, height: 1, width: 840, background: C.line}}><div style={{height: 1, background: C.copper, width: `${clamp(frame / ((beat.end - beat.start) * FPS)) * 100}%`}} /></div>
  </AbsoluteFill>;
};
