import type {Caption} from '@remotion/captions';

export type Focus = {x: number; y: number; scale?: number; fit?: 'cover' | 'contain'};
export type Beat = {
  id: string;
  start: number;
  end: number;
  headline: string;
  kicker?: string;
  narration?: string;
  caption?: string;
  screen?: string;
  screens?: string[];
  focus?: Focus;
  transition?: 'pan' | 'snap' | 'spin' | 'scope';
  tags?: string[];
  flow?: string[];
  flowMode?: 'sequence' | 'allocation';
  note?: string;
  kind?: 'capture' | 'flow' | 'end';
};
export type Film = {
  id: string;
  title: string;
  subtitle?: string;
  duration: number;
  accent?: string;
  beats: Beat[];
  captions?: Caption[];
};
export type ProductionData = {films: Film[]};
export type Capture = {src: string; width: number; height: number; source: string; caption?: string};
export type Manifest = {
  captures: Record<string, Capture>;
  audio: Record<string, {src: string} | string>;
};
export type SceneProps = {film: Film; beat: Beat; capture?: Capture; captures?: Capture[]; index: number};

export const FPS = 30;
export const PALETTE = {black: '#080909', ivory: '#EFEADD', gold: '#B99C60', red: '#AC382D', muted: '#98958B'};
export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export const localAsset = (value: string): string => {
  const normalized = value.replace(/\\/g, '/');
  if (!normalized.startsWith('art/cinematic-r4/') || normalized.includes(':') || normalized.split('/').includes('..')) {
    throw new Error(`Cinematic assets must use local art/cinematic-r4 paths: ${normalized}`);
  }
  return normalized;
};
