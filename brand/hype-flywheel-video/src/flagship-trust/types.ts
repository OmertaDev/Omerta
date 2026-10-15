import type {Caption} from '@remotion/captions';

export type Asset = {
  src: string;
  width: number;
  height: number;
  type: 'image' | 'video';
  provenance?: string;
  duration?: number;
  trimStart?: number;
};
export type Beat = {
  id: string;
  start: number;
  end: number;
  chapter: string;
  kind: 'dossier' | 'gameplay' | 'diagram' | 'end';
  headline: string;
  narration: string;
  statusLabel: string;
  composite: boolean;
  asset?: string;
  capture?: string;
  captureLabel?: string;
  claimIds?: string[];
  diagram?: string;
  diagramVariant?: 'fees' | 'participation' | 'rights';
  labels?: string[];
  caption?: string;
  note?: string;
  character?: string;
  path?: string;
  focus?: {x?: number; y?: number; scale?: number};
};
export type Production = {
  film: {title: string; duration: number; fps?: number; beats: Beat[]};
  captions?: Caption[];
};
export type Manifest = {
  assets: Record<string, Asset>;
  audio?: {src: string; label?: string; scratch?: boolean};
  brandLogo?: string | {src: string};
  fonts?: {family: string; src: string; weight?: number}[];
};
export type SceneProps = {beat: Beat; manifest: Manifest};
export const FPS = 24;
export const C = {black: '#101115', charcoal: '#191A1E', bone: '#E9E3D6', muted: '#AFA898', gold: '#B29A68', line: '#665A45', red: '#A95D54', paper: '#CEBE9D'};
export const FONT = {title: 'Georgia, serif', body: 'Arial, sans-serif', mono: 'Consolas, monospace'};
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const localPath = (value: string) => {
  if (!value.startsWith('art/flagship-trust/') || value.includes('..') || value.includes(':')) throw new Error(`Flagship media must remain isolated: ${value}`);
  return value;
};
