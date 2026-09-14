import {Interactive, interpolate, useCurrentFrame} from 'remotion';
import type {Shot} from '../copy';

export const Ledger = ({shot}: {shot: Shot}) => {
  const frame = useCurrentFrame();
  return <div style={{position: 'absolute', left: 88, right: 88, top: 310}}>
    <div style={{fontSize: 28, letterSpacing: 4, color: '#c7af79', marginBottom: 38}}>{shot.tag}</div>
    <Interactive.Div name="Ledger headline" style={{fontFamily: 'Omerta Display', fontSize: 98, lineHeight: 1.04, whiteSpace: 'pre-line'}}>{shot.title}</Interactive.Div>
    <div style={{fontSize: 44, lineHeight: 1.3, marginTop: 34, minHeight: 140}}>{shot.detail}</div>
    <div style={{marginTop: 52}}>{shot.items?.map((item, i) => <div key={item} style={{display: 'flex', alignItems: 'center', minHeight: 135, borderTop: '1px solid #c7af7955', gap: 28, opacity: interpolate(frame, [18 + i * 10, 32 + i * 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), translate: `${interpolate(frame, [18 + i * 10, 36 + i * 10], [24, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px 0`}}>
      <span style={{fontSize: 26, color: '#c7af79', minWidth: 42}}>0{i + 1}</span><span style={{fontSize: 44, lineHeight: 1.2}}>{item}</span>
    </div>)}</div>
    <div style={{marginTop: 38, fontSize: 31, lineHeight: 1.4, color: '#c7af79'}}>{shot.note}</div>
  </div>;
};
