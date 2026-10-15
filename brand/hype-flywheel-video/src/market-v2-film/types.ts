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
  transition?: 'pan' | 'scope' | 'spin' | 'snap';
};
export type Film = {id: string; title: string; duration: number; beats: Beat[]};
export type Production = {film: Film; captions?: Caption[]};
export type Capture = {src: string; width: number; height: number; caption?: string};
export type Manifest = {captures: Record<string, Capture>; audio?: {src: string}};
export type SceneProps = {beat: Beat; capture?: Capture};
export const FPS = 30;
export const C = {black: '#080B0D', ivory: '#F2ECE1', copper: '#C38356', blue: '#427894', muted: '#AAA99F', line: '#3B4246', red: '#B75347'};
export const clamp = (number: number, low = 0, high = 1) => Math.min(high, Math.max(low, number));
export const localPath = (src: string) => {
  if (!src.startsWith('art/market-v2-film/') || src.includes(':') || src.split(/[\\/]/).includes('..')) throw new Error('Market V2 requires local isolated assets');
  return src;
};
