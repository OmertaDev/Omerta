import {AbsoluteFill, CanvasImage, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {localAsset, PALETTE, type SceneProps} from '../types';

export const EndScene = ({film, beat, capture}: SceneProps) => {
  const frame = useCurrentFrame();
  const accent = film.accent || PALETTE.gold;
  return <AbsoluteFill style={{background: PALETTE.black, color: PALETTE.ivory}}>
    {capture ? <CanvasImage src={staticFile(localAsset(capture.src))} style={{width: 1080, height: 1920, objectFit: 'cover', opacity: 0.18, scale: interpolate(frame, [0, 180], [1.15, 1.22], {extrapolateRight: 'clamp'}), filter: 'saturate(0.45)'}} /> : null}
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 48% 40%,transparent,#080909 76%)'}} />
    <div style={{position: 'absolute', top: 525, left: 90, width: 810, opacity: interpolate(frame, [0, 9], [0, 1], {extrapolateRight: 'clamp'})}}>
      <div style={{width: 75, height: 2, background: accent, marginBottom: 45}} />
      <div style={{fontFamily: 'Georgia, serif', fontSize: 117, fontWeight: 400, letterSpacing: 9}}>OMERTÀ</div>
      <div style={{fontFamily: 'Arial, sans-serif', fontSize: 45, lineHeight: 1.25, marginTop: 35, color: accent, maxWidth: 780, whiteSpace: 'pre-line'}}>{beat.headline}</div>
      {beat.kicker ? <div style={{fontFamily: 'Arial, sans-serif', fontSize: 28, letterSpacing: 2, marginTop: 36, color: PALETTE.muted, textTransform: 'uppercase'}}>{beat.kicker}</div> : null}
    </div>
  </AbsoluteFill>;
};
