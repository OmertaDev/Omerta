import {Video} from '@remotion/media';
import {CanvasImage, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp, localPath, type Asset, type Beat, type Focus} from './types';

const easing = Easing.bezier(0.65, 0, 0.35, 1);

export const cameraAt = (beat: Beat, progress: number): Required<Focus> => {
  const start = {x: 0.5, y: 0.5, scale: 1.08, ...beat.focus};
  const finish = {...start, scale: start.scale * 1.06, ...beat.endFocus};
  const keys = beat.camera?.length ? beat.camera.map(key => ({...start, ...key})) : [{...start, at: 0}, {...start, at: 0.14}, {...finish, at: 0.68}, {...finish, at: 1}];
  if (keys.length === 1) return keys[0];
  const points = keys.map(key => key.at);
  const opts = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing};
  return {x: interpolate(progress, points, keys.map(key => key.x), opts), y: interpolate(progress, points, keys.map(key => key.y), opts), scale: interpolate(progress, points, keys.map(key => key.scale), opts)};
};

export const mediaRect = (asset: Asset, focus: Required<Focus>, width = 1920, height = 1080) => {
  const scale = Math.max(width / asset.width, height / asset.height) * focus.scale;
  const w = asset.width * scale; const h = asset.height * scale;
  return {width: w, height: h, left: Math.max(width - w, Math.min(0, width / 2 - w * focus.x)), top: Math.max(height - h, Math.min(0, height / 2 - h * focus.y))};
};

export const Media = ({asset, beat}: {asset: Asset; beat: Beat}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const duration = beat.end - beat.start;
  const style: React.CSSProperties = {position: 'absolute', ...mediaRect(asset, cameraAt(beat, clamp(frame / (duration * fps)))), maxWidth: 'none'};
  if (asset.type === 'video') {
    if (!(asset.duration && asset.duration > (asset.trimStart || 0))) throw new Error(`Missing video duration: ${asset.src}`);
    const rate = Math.min(1, (asset.duration - (asset.trimStart || 0) - 2 / fps) / duration);
    return <Video src={staticFile(localPath(asset.src))} muted playbackRate={Math.max(0.05, rate)} trimBefore={Math.round((asset.trimStart || 0) * fps)} style={style} />;
  }
  return <CanvasImage src={staticFile(localPath(asset.src))} style={style} />;
};
