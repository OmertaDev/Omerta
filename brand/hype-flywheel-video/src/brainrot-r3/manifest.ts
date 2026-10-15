import type {Manifest, MediaAsset} from './types';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

/** Media stays inside the local public directory; this loader never embeds remote URLs. */
const localPath = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const path = value.replace(/\\/g, '/').replace(/^\/+/, '');
  if (path.includes(':') || path.split('/').includes('..')) return undefined;
  return path.startsWith('art/') ? path : `art/brainrot-r3/${path}`;
};

export const emptyManifest: Manifest = {assets: {}, audio: {}};

export const parseManifest = (value: unknown): Manifest => {
  const raw = record(value);
  const source = raw.assets ? record(raw.assets) : raw;
  const assets: Record<string, MediaAsset> = {};
  for (const [id, input] of Object.entries(source)) {
    const details = record(input);
    if (details.status === 'pending' || details.status === 'failed') continue;
    const src = localPath(typeof input === 'string' ? input : details.src);
    if (!src || !/\.(mp4|mov|webm|png|jpg|jpeg|webp|avif)$/i.test(src)) continue;
    const duration = Number(details.duration ?? details.durationSeconds ?? 5);
    assets[id] = {
      src,
      kind: /\.(png|jpg|jpeg|webp|avif)$/i.test(src) ? 'image' : 'video',
      duration: Number.isFinite(duration) && duration > 0 ? duration : 5,
      muted: details.muted !== false,
    };
  }
  const audio: Record<string, string> = {};
  for (const [id, input] of Object.entries(record(raw.audio))) {
    const src = localPath(typeof input === 'string' ? input : record(input).src);
    if (src) audio[id] = src;
  }
  return {assets, audio};
};
