import {useMemo} from 'react';
import type {Caption} from '@remotion/captions';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {PALETTE, type Film} from './types';

// This is a deterministic line-page fallback, not a claim of word alignment.
// Audio-aligned Caption JSON from production takes precedence when supplied.
const pages = (text: string): string[] => {
  const result: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    if (line && (line.length + word.length > 54 || line.split(' ').length >= 9)) {
      result.push(line); line = '';
    }
    line += `${line ? ' ' : ''}${word}`;
  }
  if (line) result.push(line);
  return result;
};
export const buildCaptions = (film: Film): Caption[] => {
  if (film.captions?.length) return film.captions;
  return film.beats.flatMap(beat => {
    const chunks = pages(beat.caption || beat.narration || '');
    const weight = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    let cursor = beat.start * 1000;
    return chunks.map(text => {
      const startMs = cursor;
      cursor += (beat.end - beat.start) * 1000 * text.length / Math.max(1, weight);
      return {text, startMs, endMs: cursor, timestampMs: null, confidence: null};
    });
  });
};
export const Captions = ({film}: {film: Film}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const captions = useMemo(() => buildCaptions(film), [film]);
  const now = frame / fps * 1000;
  const current = captions.find(caption => now >= caption.startMs && now < caption.endMs);
  if (!current?.text.trim()) return null;
  return <div style={{position: 'absolute', left: 90, width: 810, top: 1330, minHeight: 142, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 15px', boxSizing: 'border-box', background: 'linear-gradient(90deg, transparent, rgba(8,9,9,0.92) 12%, rgba(8,9,9,0.92) 88%, transparent)', color: PALETTE.ivory, fontFamily: 'Arial, sans-serif', fontSize: 46, fontWeight: 500, lineHeight: 1.22, textAlign: 'center', textShadow: '0 2px 12px #000', opacity: interpolate(now - current.startMs, [0, 80], [0.15, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
    {current.text.trim()}
  </div>;
};
