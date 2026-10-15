import {Easing, interpolate} from 'remotion';
import {C, clamp} from './types';

export const motion = (frame: number, start = 0, end = 35) => interpolate(frame, [start, end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.18, 0.75, 0.25, 1)});
export const Label = ({text, left, top, width = 840, size = 44, color = C.ivory, align = 'left'}: {text: string; left: number; top: number; width?: number; size?: number; color?: string; align?: 'left' | 'center' | 'right'}) => <div style={{position: 'absolute', left, top, width, color, fontFamily: 'Arial, sans-serif', fontSize: size, lineHeight: 1.13, whiteSpace: 'pre-line', textAlign: align, textWrap: 'balance', textShadow: '0 2px 10px #000b'}}>{text}</div>;

export const Arrow = ({x1, y1, x2, y2, progress = 1, color = C.copper}: {x1: number; y1: number; x2: number; y2: number; progress?: number; color?: string}) => <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
  <path d={`M${x1} ${y1}L${x2} ${y2}`} stroke={C.line} strokeWidth={1} fill="none" />
  <path d={`M${x1} ${y1}L${x2} ${y2}`} stroke={color} strokeWidth={2} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - clamp(progress)} />
  <g style={{opacity: clamp((progress - 0.8) * 5)}} transform={`translate(${x2} ${y2}) rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI})`}><path d="M-12 -7L0 0L-12 7" stroke={color} strokeWidth={2} fill="none" /></g>
</svg>;

export const Vessel = ({x, y, width = 245, height = 200, fill, label, color = C.blue}: {x: number; y: number; width?: number; height?: number; fill: number; label: string; color?: string}) => <>
  <div style={{position: 'absolute', left: x, top: y, width, height, border: `1px solid ${color}A0`, borderRadius: '3px 3px 28px 28px', boxSizing: 'border-box', overflow: 'hidden', background: 'linear-gradient(115deg,#F9E9C812,transparent 28%,transparent 65%,#F9E9C815)'}}>
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${clamp(fill) * 100}%`, background: `linear-gradient(180deg,${color}95,${color}20)`, borderTop: `1px solid ${color}`}} />
    <div style={{position: 'absolute', left: 13, top: 10, bottom: 20, width: 1, background: '#FFF0D550'}} />
    {[0.25, 0.5, 0.75].map(tick => <div key={tick} style={{position: 'absolute', width: 11, height: 1, right: 0, top: height * tick, background: `${color}90`}} />)}
  </div>
  <Label text={label} left={x - 15} top={y + height + 17} width={width + 30} align="center" />
</>;
