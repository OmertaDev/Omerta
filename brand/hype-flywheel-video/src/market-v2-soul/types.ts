import type {Caption} from '@remotion/captions';

export type Beat = {
  id: string;
  start: number;
  end: number;
  chapter?: string;
  headline: string;
  narration?: string;
  tags?: string[];
  kind: 'hero' | 'range' | 'reserves' | 'flow' | 'allocation' | 'observations' | 'turf' | 'bond' | 'commitment' | 'solver' | 'capture' | 'end';
  state?: string;
  nodes?: string[];
  screen?: string;
  captureLabel?: string;
  captureInsert?: {screen: string; startFraction?: number; label?: string};
  showTags?: boolean;
  plate: string;
  secondPlate?: string;
  layout?: 'cinema' | 'diagram' | 'capture';
  transition?: 'pan' | 'scope' | 'spin' | 'snap';
};
export type Film = {id: string; title: string; duration: number; beats: Beat[]; captions?: Caption[]};
export type Production = {film: Film; captions?: Caption[]};
export type Capture = {src: string; width: number; height: number; caption?: string};
export type Plate = {src: string; width: number; height: number; type?: 'image' | 'video'; duration?: number; trimStart?: number};
export type Manifest = {captures: Record<string, Capture>; plates: Record<string, Plate>; audio?: {src: string}};
export type SceneProps = {beat: Beat; capture?: Capture};
export const FPS = 30;
export const C = {black: '#15120E', ivory: '#FFF0D5', copper: '#D5A968', blue: '#A1AD78', muted: '#CABDA1', line: '#8B8060', red: '#B05B54'};
export const clamp = (number: number, low = 0, high = 1) => Math.min(high, Math.max(low, number));
export const localPath = (src: string) => {
  if (!src.startsWith('art/market-v2-soul/') || src.includes(':') || src.split(/[\\/]/).includes('..')) throw new Error('Soul film requires local isolated assets');
  return src;
};
