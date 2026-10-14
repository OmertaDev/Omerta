import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, type SceneProps} from './types';

export const Frame = ({beat, children}: SceneProps & {children?: React.ReactNode}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{background: C.black, color: C.bone, fontFamily: FONT.body}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 21% 13%,#B29A6810,transparent 60%)'}} />
    <div style={{position: 'absolute', left: 86, top: 61, right: 86, height: 1, background: C.line}} />
    <div style={{position: 'absolute', left: 87, top: 81, fontSize: 25, letterSpacing: 3, textTransform: 'uppercase', color: C.gold}}>{beat.chapter}</div>
    <div style={{position: 'absolute', right: 87, top: 81, fontSize: 22, letterSpacing: 1.6, color: C.muted}}>EDIT PREVIEW</div>
    {children}
    <div style={{position: 'absolute', left: 87, bottom: 34, right: 87, borderTop: `1px solid ${C.line}`, paddingTop: 15, display: 'flex', gap: 28, alignItems: 'center', fontSize: 25, color: C.muted}}>
      <span style={{color: C.gold, fontSize: 23, letterSpacing: 1.5}}>OMERTÀ · TRUST IS THE GAME</span>
    </div>
    <div style={{position: 'absolute', left: 87, bottom: 24, height: 2, width: 1746 * interpolate(frame, [0, Math.max(1, (beat.end - beat.start) * fps)], [0, 1], {extrapolateRight: 'clamp'}), background: C.gold, opacity: 0.4}} />
  </AbsoluteFill>;
};

export const Headline = ({text, left = 88, top = 148, width = 1710, size = 86}: {text: string; left?: number; top?: number; width?: number; size?: number}) => <div style={{position: 'absolute', left, top, width, fontFamily: FONT.title, fontSize: size, fontWeight: 400, lineHeight: 1.04, letterSpacing: -2, whiteSpace: 'pre-line', textWrap: 'balance', color: C.bone}}>{text}</div>;

export const Envelope = ({left = 1070, top = 654, width = 350, rotate = -5}: {left?: number; top?: number; width?: number; rotate?: number}) => <div style={{position: 'absolute', left, top, width, height: width * 0.57, rotate: `${rotate}deg`, boxShadow: '0 18px 38px #0007'}}>
  <svg viewBox="0 0 600 342" width="100%" height="100%"><path d="M1 1H599V341H1Z" fill={C.paper} stroke="#A89470" strokeWidth="2" /><path d="M1 341L300 113L599 341M1 1L300 208L599 1" fill="none" stroke="#87775A" strokeWidth="2" /><circle cx="300" cy="212" r="27" fill="#743C35" /><circle cx="300" cy="212" r="20" fill="none" stroke="#A16355" strokeWidth="1.5" /></svg>
</div>;
