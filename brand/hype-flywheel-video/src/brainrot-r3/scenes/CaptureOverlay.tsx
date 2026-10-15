import {Video} from '@remotion/media';
import {CanvasImage, Freeze, Sequence, staticFile} from 'remotion';
import type {PlannedBeat} from '../types';

export const CaptureOverlay = ({plan}: {plan: PlannedBeat}) => {
  if (!plan.capture) return null;
  const {capture} = plan;
  const availableFrames = Math.max(1, Math.min(plan.durationFrames, Math.floor(capture.duration * 30)));
  const media = capture.kind === 'image'
    ? <CanvasImage src={staticFile(capture.src)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
    : <Video src={staticFile(capture.src)} muted objectFit="contain" style={{width: '100%', height: '100%'}} />;
  return <div style={{position: 'absolute', left: 102, right: plan.beat.speaker === 'Consigliere' ? 474 : 186, top: 625, height: 360, background: '#11110f', outline: '6px solid #cbff00'}}>
    <div style={{position: 'absolute', left: 0, top: -48, fontSize: 25, fontWeight: 900, color: '#cbff00', background: '#11110f', padding: '8px 12px'}}>AUTHORIZED GAME CAPTURE</div>
    <Sequence layout="none" durationInFrames={availableFrames}>{media}</Sequence>
    {availableFrames < plan.durationFrames ? <Sequence layout="none" from={availableFrames} durationInFrames={plan.durationFrames - availableFrames}><Freeze frame={availableFrames - 1}>{media}</Freeze></Sequence> : null}
  </div>;
};
