import {useMemo} from 'react';
import type {Caption} from '@remotion/captions';
import {useCurrentFrame} from 'remotion';
import {C, FPS, type Production} from './types';

const fallback = (production: Production): Caption[] => production.film.beats.flatMap(beat => {
  const words = (beat.narration || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length > 53) {lines.push(current); current = '';}
    current += `${current ? ' ' : ''}${word}`;
  }
  if (current) lines.push(current);
  const length = lines.reduce((sum, line) => sum + line.length, 0);
  let cursor = beat.start * 1000;
  return lines.map(text => {
    const startMs = cursor;
    cursor += (beat.end - beat.start) * 1000 * text.length / Math.max(1, length);
    return {text, startMs, endMs: cursor, timestampMs: null, confidence: null};
  });
});
export const Captions = ({production}: {production: Production}) => {
  const frame = useCurrentFrame();
  const lines = useMemo(() => production.film.captions?.length ? production.film.captions : production.captions?.length ? production.captions : fallback(production), [production]);
  const line = lines.find(item => frame / FPS * 1000 >= item.startMs && frame / FPS * 1000 < item.endMs);
  if (!line) return null;
  return <div style={{position: 'absolute', top: 1405, left: 96, width: 826, height: 146, display: 'flex', alignItems: 'center', color: C.ivory, fontFamily: 'Arial, sans-serif', fontSize: 48, fontWeight: 400, lineHeight: 1.18, textAlign: 'left', textShadow: '0 2px 12px #000c', whiteSpace: 'pre-line'}}>{line.text.trim()}</div>;
};
