import {AbsoluteFill, CanvasImage, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Impact, SceneHeading} from '../SceneFurniture';
import {clamp, localAsset, PALETTE, type SceneProps} from '../types';

export const CaptureScene = ({film, beat, capture: primaryCapture, captures, index}: SceneProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const duration = Math.max(1, (beat.end - beat.start) * fps);
  const shots = captures?.length ? captures : primaryCapture ? [primaryCapture] : [];
  const shotIndex = Math.min(shots.length - 1, Math.floor(frame / duration * shots.length));
  const capture = shots[shotIndex];
  if (!capture) throw new Error(`Missing real screenshot: ${beat.screen || beat.id}`);
  const shotDuration = duration / shots.length;
  const shotFrame = frame - Math.floor(shotIndex * shotDuration);
  const progress = clamp(shotFrame / shotDuration, 0, 1);
  const accent = film.accent || PALETTE.gold;
  const focus = beat.focus || {x: 0.5, y: 0.5, scale: 1.08};
  const windowWidth = 910;
  const windowHeight = 744;
  const baseScale = (focus.fit === 'contain' ? Math.min : Math.max)(windowWidth / capture.width, windowHeight / capture.height);
  const imageScale = baseScale * (focus.scale || 1.08) * (1 + progress * (film.id === '02' ? 0.025 : 0.045));
  const width = capture.width * imageScale;
  const height = capture.height * imageScale;
  const direction = (index + shotIndex) % 2 ? -1 : 1;
  const panX = (progress - 0.5) * (film.id === '02' ? 14 : 32) * direction;
  const panY = (progress - 0.5) * (film.id === '03' ? -44 : 18);
  const left = width > windowWidth ? clamp(windowWidth / 2 - width * focus.x + panX, windowWidth - width, 0) : (windowWidth - width) / 2;
  const top = height > windowHeight ? clamp(windowHeight / 2 - height * focus.y + panY, windowHeight - height, 0) : (windowHeight - height) / 2;
  return <AbsoluteFill style={{background: PALETTE.black}}>
    <CanvasImage src={staticFile(localAsset(capture.src))} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.13, filter: 'blur(28px) saturate(0.7)', scale: 1.12}} />
    <AbsoluteFill style={{background: 'linear-gradient(180deg, #080909 4%, #080909d9 22%, transparent 46%, #080909 83%)'}} />
    <div style={{position: 'absolute', left: 62, top: 436, width: windowWidth, height: windowHeight, perspective: 2000}}>
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: '#10110F', border: `1px solid ${accent}60`, boxShadow: '0 26px 85px #000c', rotate: beat.transition === 'spin' ? `${interpolate(frame, [0, 11], [-360, 0], {extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 0.8, 0.16, 1)})}deg` : `${interpolate(progress, [0, 1], film.id === '02' ? [0, 0] : [-0.35 * direction, 0.35 * direction])}deg`, scale: interpolate(frame, [0, 11], [beat.transition === 'spin' ? 1.22 : beat.transition === 'scope' ? 1.18 : beat.transition === 'snap' ? 1.09 : 1, 1], {extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1)})}}>
        <CanvasImage src={staticFile(localAsset(capture.src))} style={{position: 'absolute', left, top, width, height, maxWidth: 'none'}} />
        <AbsoluteFill style={{pointerEvents: 'none', boxShadow: 'inset 0 0 70px #0004'}} />
        <div style={{position: 'absolute', left: 0, right: 0, height: 2, top: 0, background: accent, opacity: 0.65}} />
      </div>
    </div>
    <SceneHeading film={film} beat={beat} index={index} />
    <Impact type={beat.transition} accent={accent} />
    <div style={{position: 'absolute', left: 90, top: 1188, width: 810, display: 'flex', alignItems: 'center', gap: 12, color: PALETTE.muted, fontFamily: 'Arial, sans-serif', fontSize: 21, letterSpacing: 1.1, textTransform: 'uppercase'}}>
      <span style={{height: 5, width: 5, background: accent}} />
      <span>{capture.caption || 'OMERTÀ · game interface'}</span>
    </div>
  </AbsoluteFill>;
};
