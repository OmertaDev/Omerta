import {Video} from '@remotion/media';
import {CanvasImage, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp, localPath, type Asset} from './types';

export const Media = ({asset, duration, width, height, focus, opacity = 1}: {asset: Asset; duration: number; width: number; height: number; focus?: {x?: number; y?: number; scale?: number}; opacity?: number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = clamp(frame / Math.max(1, duration * fps));
  const scale = Math.max(width / asset.width, height / asset.height) * (focus?.scale || 1) * (1.015 + progress * 0.035);
  const imageWidth = asset.width * scale;
  const imageHeight = asset.height * scale;
  const style: React.CSSProperties = {position: 'absolute', width: imageWidth, height: imageHeight, left: Math.max(width - imageWidth, Math.min(0, width / 2 - imageWidth * (focus?.x ?? 0.5) - progress * 9)), top: Math.max(height - imageHeight, Math.min(0, height / 2 - imageHeight * (focus?.y ?? 0.5))), opacity};
  if (asset.type === 'video') {
    if (!(asset.duration && asset.duration > (asset.trimStart || 0))) throw new Error(`Video needs a duration for a single-pass edit: ${asset.src}`);
    const available = asset.duration - (asset.trimStart || 0) - 2 / fps;
    return <Video src={staticFile(localPath(asset.src))} muted playbackRate={Math.min(1, Math.max(0.05, available / duration))} trimBefore={Math.round((asset.trimStart || 0) * fps)} style={style} />;
  }
  return <CanvasImage src={staticFile(localPath(asset.src))} style={style} />;
};
