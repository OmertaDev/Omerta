export type Asset = {src: string; width: number; height: number; type: 'image' | 'video'; duration?: number; trimStart?: number};
export type Focus = {x?: number; y?: number; scale?: number};
export type CameraKey = Focus & {at: number};
export type Beat = {
  id: string; start: number; end: number;
  kind: 'gameplay' | 'cinema' | 'type' | 'flow' | 'end';
  headline: string; asset?: string; capture?: string; labels?: string[]; note?: string;
  focus?: Focus; endFocus?: Focus; camera?: CameraKey[];
  highlights?: {x: number; y: number; w: number; h: number; label?: string; at?: number; until?: number}[];
  mode?: 'route' | 'roster' | 'resources' | 'balances' | 'fees' | 'sequence';
  transition?: 'cut' | 'push' | 'flash';
  titleAt?: number; titleDuration?: number; titlePosition?: 'top' | 'bottom';
};
export type Production = {film: {title: string; duration: number; fps: number; beats: Beat[]}; captions?: {text: string; startMs: number; endMs: number}[]};
export type Manifest = {assets: Record<string, Asset>; audio?: {src: string}; brandLogo?: string | {src: string}};
export type SceneProps = {beat: Beat; manifest: Manifest};
export const C = {ink: '#090D0F', bone: '#F2ECD9', amber: '#D7AC65', muted: '#B7B1A5', red: '#A95039'};
export const FONT = {title: 'Georgia, serif', body: 'Arial, sans-serif', mono: 'Consolas, monospace'};
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const localPath = (src: string) => {
  if (!src.startsWith('art/flagship-rebuild/') || src.includes('..') || src.includes(':')) throw new Error(`Unexpected media path: ${src}`);
  return src;
};
