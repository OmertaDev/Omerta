import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Media} from './Media';
import {C, FONT, type SceneProps} from './types';

export const CinemaScene = ({beat, manifest}: SceneProps) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const asset = manifest.assets[beat.asset || ''];
  if (!asset) throw new Error(`Missing cinematic media for ${beat.id}`);
  const lines = beat.headline.split('\n');
  return <AbsoluteFill style={{backgroundColor: C.ink, overflow: 'hidden'}}>
    <Media asset={asset} beat={beat} />
    <AbsoluteFill style={{background: 'linear-gradient(90deg, #090d0fc2 0%, #090d0f1a 75%), linear-gradient(0deg, #090d0f88, transparent 60%)'}} />
    <div style={{position: 'absolute', left: 100, right: 100, bottom: 216}}>
      {lines.map((line, index) => <div key={index} style={{overflow: 'hidden'}}><div style={{fontFamily: FONT.title, color: C.bone, fontSize: line.length > 31 ? 94 : 116, lineHeight: 1.04, letterSpacing: -3, textShadow: '0 2px 14px #0007', translate: `0 ${interpolate(frame, [fps * (0.2 + index * 0.14), fps * (0.9 + index * 0.14)], [130, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1)})}px`}}>{line}</div></div>)}
      {beat.labels?.length ? <div style={{fontFamily: FONT.body, color: C.amber, fontSize: 28, letterSpacing: 3, marginTop: 30, opacity: interpolate(frame, [fps, fps * 1.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>{beat.labels.join('  /  ')}</div> : null}
    </div>
    {beat.note ? <div style={{position: 'absolute', left: 105, bottom: 158, color: C.bone, font: `26px ${FONT.body}`}}>{beat.note}</div> : null}
  </AbsoluteFill>;
};
