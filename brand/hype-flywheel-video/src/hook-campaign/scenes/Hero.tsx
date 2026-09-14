import {Interactive, interpolate, useCurrentFrame} from 'remotion';
import type {Shot} from '../copy';

export const Hero = ({shot}: {shot: Shot}) => {
  const frame = useCurrentFrame();
  return <>
    <Interactive.Div name="Hero rule" style={{position: 'absolute', left: 88, top: 770, height: 6, width: interpolate(frame, [0, 28], [0, 120], {extrapolateRight: 'clamp'}), backgroundColor: '#c7af79'}} />
    <Interactive.Div name="Hero copy" style={{position: 'absolute', left: 88, right: 88, top: 830, opacity: interpolate(frame, [4, 24], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), translate: `0 ${interpolate(frame, [0, 30], [30, 0], {extrapolateRight: 'clamp'})}px`}}>
      <div style={{color: '#c7af79', fontSize: 28, letterSpacing: 4, marginBottom: 35}}>{shot.tag}</div>
      <div style={{fontFamily: 'Omerta Display', fontSize: 112, lineHeight: 1.02, whiteSpace: 'pre-line', letterSpacing: 1}}>{shot.title}</div>
      <div style={{fontSize: 46, lineHeight: 1.3, marginTop: 38, maxWidth: 860}}>{shot.detail}</div>
      <div style={{fontSize: 31, lineHeight: 1.4, color: '#c7af79', marginTop: 46}}>{shot.note}</div>
    </Interactive.Div>
  </>;
};
