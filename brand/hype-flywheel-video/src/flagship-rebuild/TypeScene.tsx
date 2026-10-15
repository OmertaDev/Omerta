import {AbsoluteFill, CanvasImage, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, localPath, type SceneProps} from './types';

export const TypeScene = ({beat, manifest}: SceneProps) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const lines = beat.headline.split('\n'); const end = beat.kind === 'end';
  const logo = typeof manifest.brandLogo === 'string' ? manifest.brandLogo : manifest.brandLogo?.src;
  return <AbsoluteFill style={{backgroundColor: end ? C.ink : C.bone, color: end ? C.bone : C.ink, overflow: 'hidden', justifyContent: 'center', padding: '100px 110px 170px'}}>
    <div style={{position: 'absolute', top: 120, left: 110, width: interpolate(frame, [0, fps * 1.2], [0, 190], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)}), height: 5, backgroundColor: C.amber}} />
    {end && logo ? <CanvasImage src={staticFile(localPath(logo))} style={{width: 650, height: 160, objectFit: 'contain', objectPosition: 'left center', marginBottom: 28}} /> : null}
    {lines.map((line, index) => <div key={index} style={{overflow: 'hidden', paddingBottom: 10}}><div style={{fontFamily: FONT.title, fontSize: line.length > 30 ? 102 : line.length > 22 ? 130 : 158, lineHeight: 1.06, letterSpacing: -4, translate: `0 ${interpolate(frame, [index * fps * 0.2 + 4, index * fps * 0.2 + fps * 0.95], [175, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1)})}px`}}>{line}</div></div>)}
    {beat.labels?.length ? <div style={{display: 'flex', flexDirection: end ? 'column' : 'row', gap: 24, marginTop: 34, fontFamily: FONT.body, fontSize: end ? 42 : 35, color: end ? C.amber : '#715422'}}>{beat.labels.map((label, index) => <div key={index} style={{fontSize: end && /\.[a-z]{2,}/i.test(label) ? 76 : undefined, fontWeight: end && /\.[a-z]{2,}/i.test(label) ? 600 : 400, opacity: interpolate(frame, [fps * (1.2 + index * 0.2), fps * (1.65 + index * 0.2)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>{label}</div>)}</div> : null}
    {beat.note ? <div style={{position: 'absolute', left: 110, bottom: 173, maxWidth: 1590, fontFamily: FONT.body, fontSize: 30, lineHeight: 1.25}}>{beat.note}</div> : null}
  </AbsoluteFill>;
};
