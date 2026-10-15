import {CanvasImage, staticFile, useCurrentFrame} from 'remotion';
import {C, clamp, FPS, localPath, type SceneProps} from './types';

export const ScreenCloseup = ({beat, capture}: SceneProps) => {
  const frame = useCurrentFrame();
  if (!capture) throw new Error(`Missing actual UI close-up: ${beat.screen}`);
  const progress = clamp(frame / ((beat.end - beat.start) * FPS));
  const number = Number(beat.id.match(/\d+$/)?.[0] || 0);
  const detail = number % 3 === 0;
  const width = detail ? 1160 : 910;
  const height = detail ? 754 : 674;
  const scale = Math.max(width / capture.width, height / capture.height) * (1.025 + progress * 0.055);
  return <>
    <div style={{position: 'absolute', left: detail ? -115 : 68, top: detail ? 455 : 537, width, height, overflow: 'hidden', rotate: `${detail ? 0.6 - progress * 0.5 : -2.2 + progress * 1.3}deg`, boxShadow: '0 35px 80px #0009', border: `1px solid ${C.copper}90`, background: '#191512'}}>
      <CanvasImage src={staticFile(localPath(capture.src))} style={{position: 'absolute', width: capture.width * scale, height: capture.height * scale, left: (width - capture.width * scale) / 2 - progress * 24, top: (height - capture.height * scale) / 2}} />
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(145deg,#F2D89A12,transparent 50%)'}} />
    </div>
    <div style={{position: 'absolute', left: 104, top: 1240, width: 815, fontFamily: 'Arial, sans-serif', fontSize: beat.captureLabel ? 30 : 25, lineHeight: 1.12, letterSpacing: beat.captureLabel ? 0 : 1.4, color: C.muted}}>{beat.captureLabel || capture.caption || 'OMERTÀ · actual interface capture'}</div>
  </>;
};
