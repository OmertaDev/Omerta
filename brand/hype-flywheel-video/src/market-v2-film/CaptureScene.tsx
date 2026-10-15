import {AbsoluteFill, CanvasImage, staticFile, useCurrentFrame} from 'remotion';
import {Label, motion} from './Primitives';
import {C, clamp, FPS, localPath, type SceneProps} from './types';

export const CaptureScene = ({beat, capture}: SceneProps) => {
  const frame = useCurrentFrame();
  if (!capture) throw new Error(`Missing actual Market V2 screenshot: ${beat.screen}`);
  const width = 840;
  const height = beat.kind === 'hero' ? 610 : 650;
  const progress = clamp(frame / ((beat.end - beat.start) * FPS));
  const scale = Math.max(width / capture.width, height / capture.height) * (1.035 + progress * 0.045);
  const imageWidth = capture.width * scale;
  const imageHeight = capture.height * scale;
  return <>
    <div style={{position: 'absolute', left: 90, top: 510, width, height, overflow: 'hidden', border: `1px solid ${C.copper}80`}}>
      <CanvasImage src={staticFile(localPath(capture.src))} style={{position: 'absolute', left: (width - imageWidth) / 2 + (progress - 0.5) * 18, top: (height - imageHeight) / 2, width: imageWidth, height: imageHeight}} />
      <div style={{position: 'absolute', left: 0, top: 0, width: '100%', height: 2, background: C.copper}} />
    </div>
    <Label text={capture.caption || 'Actual game interface · local preview build'} left={90} top={1177} width={840} size={24} color={C.muted} />
    {beat.kind === 'hero' ? <div style={{position: 'absolute', left: 90, top: 1139, height: 3, width: 840, background: C.line}}><div style={{height: 3, width: `${(1 - motion(frame, 5, 115) * 0.7) * 100}%`, background: C.copper}} /></div> : null}
  </>;
};

export const EndScene = ({beat, capture}: SceneProps) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: C.black}}>
    {capture ? <CanvasImage src={staticFile(localPath(capture.src))} style={{width: 1080, height: 1920, objectFit: 'cover', opacity: 0.12, scale: 1.05 + motion(frame, 0, 150) * 0.04}} /> : null}
    <div style={{position: 'absolute', left: 90, top: 550, width: 840, height: 2, background: C.copper}} />
    <Label text="OMERTÀ" left={90} top={613} width={840} size={118} />
    <Label text={beat.headline} left={90} top={821} width={840} size={68} color={C.copper} />
    <Label text="MARKET V2" left={90} top={1090} width={840} size={30} color={C.muted} />
  </AbsoluteFill>;
};
