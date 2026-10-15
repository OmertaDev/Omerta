import {CanvasImage, staticFile} from 'remotion';
import {H, localPath, W, type LayerAsset, type Point} from './types';

export const Layer = ({asset, translate = [0, 0], rotate = 0, scale = 1, opacity = 1, style}: {asset: LayerAsset; translate?: Point; rotate?: number; scale?: number | string; opacity?: number; style?: React.CSSProperties}) => {
  const rect = asset.rect || [0, 0, 1, 1];
  const pivot = asset.pivot || [rect[0] + rect[2] / 2, rect[1] + rect[3] / 2];
  return <CanvasImage src={staticFile(localPath(asset.src))} style={{position: 'absolute', left: rect[0] * W, top: rect[1] * H, width: rect[2] * W, height: rect[3] * H, objectFit: 'fill', translate: `${translate[0]}px ${translate[1]}px`, rotate: `${rotate}deg`, scale, transformOrigin: `${(pivot[0] - rect[0]) / rect[2] * 100}% ${(pivot[1] - rect[1]) / rect[3] * 100}%`, opacity, ...style}} />;
};
