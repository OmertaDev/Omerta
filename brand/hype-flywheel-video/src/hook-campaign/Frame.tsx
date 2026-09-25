import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import type {ReactNode} from 'react';
import {Video} from '@remotion/media';
import {motionPlates} from './media';

export const Frame = ({art, index, total, category, status, children}: {art: string; index: number; total: number; category?: string; status?: string; children: ReactNode}) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{backgroundColor: '#090d0e', color: '#f1e9d7', fontFamily: 'Arial, sans-serif'}}>
    <Video src={staticFile(motionPlates.includes(art) ? `art/hook-campaign/${art}.mp4` : 'art/hype/hero-backdrop.mp4')} muted loop objectFit="cover" style={{position: 'absolute', width: '100%', height: '100%', opacity: index === 0 || index === total - 1 ? 0.8 : 0.18}} />
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(5,10,11,.28), rgba(5,10,11,.3) 30%, #090d0e 88%)'}} />
    <div style={{position: 'absolute', inset: 46, border: '1px solid #bca46c55'}} />
    <div style={{position: 'absolute', left: 88, top: 106, fontFamily: 'Omerta Display', fontSize: 58, letterSpacing: 8}}>OMERTÀ<span style={{fontFamily: 'Arial', fontSize: 22, letterSpacing: 3, color: '#c7af79', marginLeft: 28}}>{category ?? 'MARKET'}</span></div>
    {children}
    <div style={{position: 'absolute', left: 88, right: 88, bottom: 180, height: 2, background: '#bca46c35'}}>
      <div style={{height: 2, background: '#c7af79', width: `${((index + Math.min(frame / 240, 1)) / total) * 100}%`}} />
    </div>
    <div style={{position: 'absolute', left: 88, bottom: 106, fontSize: 26, lineHeight: 1.45, letterSpacing: 1, color: '#dbd3c3', whiteSpace: 'pre-line'}}>{status ?? 'IMPLEMENTATION CANDIDATE\nV2 is not deployed or funded.'}</div>
    <div style={{position: 'absolute', right: 88, bottom: 118, fontSize: 25, color: '#c7af79'}}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
  </AbsoluteFill>;
};
