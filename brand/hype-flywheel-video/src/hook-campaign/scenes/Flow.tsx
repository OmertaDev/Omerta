import {Interactive, interpolate, useCurrentFrame} from 'remotion';
import type {Shot} from '../copy';

export const Flow = ({shot}: {shot: Shot}) => {
  const frame = useCurrentFrame();
  return <div style={{position: 'absolute', left: 88, right: 88, top: 310}}>
    <div style={{fontSize: 28, letterSpacing: 4, color: '#c7af79', marginBottom: 38}}>{shot.tag}</div>
    <Interactive.Div name="Flow headline" style={{fontFamily: 'Omerta Display', fontSize: 98, lineHeight: 1.04, whiteSpace: 'pre-line'}}>{shot.title}</Interactive.Div>
    <div style={{fontSize: 44, lineHeight: 1.3, marginTop: 34, minHeight: 176}}>{shot.detail}</div>
    <div style={{marginTop: 40, position: 'relative'}}>
      <div style={{position: 'absolute', left: 24, top: 45, width: 2, height: interpolate(frame, [20, 85], [0, 380], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), backgroundColor: '#7caaa0'}} />
      {shot.items?.map((item, i) => <div key={item} style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 34, minHeight: 160, opacity: interpolate(frame, [15 + i * 17, 32 + i * 17], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
        <div style={{width: 50, height: 50, flexShrink: 0, border: '2px solid #7caaa0', borderRadius: 50, background: '#122021', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#b0d0c5'}}>{i + 1}</div>
        <div style={{fontSize: 44, lineHeight: 1.25}}>{item}</div>
      </div>)}
    </div>
    <div style={{marginTop: 34, fontSize: 31, lineHeight: 1.4, color: '#c7af79'}}>{shot.note}</div>
  </div>;
};
