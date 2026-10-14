export type Rect = [number, number, number, number];
export type Point = [number, number];
export type LayerAsset = {src: string; rect?: Rect; pivot?: Point};
export type OpeningScene = {
  duration: number; fps: number; canvas: {width: number; height: number};
  layers: {background: LayerAsset; nico: LayerAsset; hand: LayerAsset; envelope: LayerAsset; foreground?: LayerAsset};
  audio?: {src: string; offsetSeconds?: number};
  captions?: {text: string; startMs: number; endMs: number}[];
  action?: {envelopeTravel?: Point; handTravel?: Point; elbow?: Point; envelopeShadow?: Rect};
};
export const W = 1920;
export const H = 1080;
export const C = {ink: '#060b0d', bone: '#F2E7D0', amber: '#DEAE62', blue: '#77B7C6'};
export const localPath = (src: string) => {
  if (!src.startsWith('art/flagship-animation/') || src.includes('..') || src.includes(':')) throw new Error(`Unexpected animation asset: ${src}`);
  return src;
};
