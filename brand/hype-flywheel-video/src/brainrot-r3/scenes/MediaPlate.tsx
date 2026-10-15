import {Video} from '@remotion/media';
import {AbsoluteFill, CanvasImage, Freeze, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import type {PlannedBeat} from '../types';

export const MediaPlate = ({plan}: {plan: PlannedBeat}) => {
  const frame = useCurrentFrame();
  const {asset, sourceStartFrame, sourceDurationFrames, durationFrames, index} = plan;
  if (!asset) return null;
  const plate = asset.kind === 'image'
    ? <CanvasImage src={staticFile(asset.src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    : <Video src={staticFile(asset.src)} trimBefore={sourceStartFrame} muted={asset.muted} objectFit="cover" style={{width: '100%', height: '100%'}} />;

  return <AbsoluteFill style={{overflow: 'hidden', background: '#11110f'}}>
    <AbsoluteFill style={{
      scale: interpolate(frame, [0, 3, durationFrames - 1], [1.055, 1.01, 1.045], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      translate: interpolate(frame, [0, 3, durationFrames - 1], [index % 2 ? '-5px 6px' : '5px -6px', '0px 0px', index % 2 ? '7px 0px' : '-7px 0px'], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    }}>
      <Sequence durationInFrames={sourceDurationFrames}>{plate}</Sequence>
      {sourceDurationFrames < durationFrames ? <Sequence from={sourceDurationFrames} durationInFrames={durationFrames - sourceDurationFrames}>
        <Freeze frame={sourceDurationFrames - 1}>{plate}</Freeze>
      </Sequence> : null}
    </AbsoluteFill>
    <AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,.20) 59%, rgba(0,0,0,.80) 93%)', pointerEvents: 'none'}} />
  </AbsoluteFill>;
};
