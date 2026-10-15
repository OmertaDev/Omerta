import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {PALETTE, type SceneProps} from './types';

export const SceneHeading = ({film, beat, index}: SceneProps) => {
  const frame = useCurrentFrame();
  const accent = film.accent || PALETTE.gold;
  return <div style={{position: 'absolute', left: 90, top: 166, width: 810, color: PALETTE.ivory, opacity: interpolate(frame, [0, 7], [0, 1], {extrapolateRight: 'clamp'}), translate: `0 ${interpolate(frame, [0, 12], [12, 0], {extrapolateRight: 'clamp'})}px`}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22, color: accent, fontFamily: 'Arial, sans-serif', fontSize: 27, fontWeight: 600, letterSpacing: 3.5, textTransform: 'uppercase'}}>
      <span style={{width: 32, height: 2, background: accent}} />
      <span>{beat.kicker || film.subtitle || `Chapter ${String(index + 1).padStart(2, '0')}`}</span>
    </div>
    <div style={{fontFamily: film.id === '03' ? 'Georgia, serif' : 'Arial, sans-serif', fontSize: beat.headline.length > 42 ? 74 : 84, fontWeight: film.id === '03' ? 400 : 700, lineHeight: 1.04, letterSpacing: film.id === '03' ? -2.1 : -3, whiteSpace: 'pre-line', textWrap: 'balance'}}>{beat.headline}</div>
  </div>;
};

export const SystemRibbon = ({film, beat}: {film: SceneProps['film']; beat: SceneProps['beat']}) => {
  if (!beat.tags?.length) return null;
  const accent = film.accent || PALETTE.gold;
  return <div style={{position: 'absolute', left: 90, top: 1221, width: 810, height: 98, paddingTop: 10, boxSizing: 'border-box', borderTop: `1px solid ${accent}50`, display: 'flex', flexWrap: 'wrap', alignContent: 'center', columnGap: 23, rowGap: 3, color: PALETTE.ivory, fontFamily: 'Arial, sans-serif', fontSize: 41, fontWeight: 400, lineHeight: 1.11}}>
    {beat.tags.map((tag, index) => <span key={`${index}-${tag}`} style={{display: 'inline-flex', gap: 10, alignItems: 'center', whiteSpace: 'nowrap'}}>
      <span style={{width: 5, height: 5, flexShrink: 0, background: accent, opacity: 0.85}} />{tag}
    </span>)}
  </div>;
};

export const FilmAtmosphere = ({film}: {film: SceneProps['film']}) => {
  const frame = useCurrentFrame();
  return <>
    <AbsoluteFill style={{pointerEvents: 'none', boxShadow: 'inset 0 0 180px 60px rgba(0,0,0,0.42)'}} />
    <AbsoluteFill style={{pointerEvents: 'none', opacity: 0.015, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #ddd 3px, transparent 4px)', backgroundPosition: `0 ${Math.floor(frame / 3) % 4}px`}} />
    <div style={{position: 'absolute', left: 90, top: 1520, width: 810, height: 1, background: '#ffffff16'}}>
      <div style={{height: 1, width: `${Math.min(100, frame / (film.duration * 30) * 100)}%`, background: film.accent || PALETTE.gold, opacity: 0.5}} />
    </div>
  </>;
};

export const Impact = ({type, accent}: {type?: SceneProps['beat']['transition']; accent: string}) => {
  const frame = useCurrentFrame();
  if (type !== 'scope' && type !== 'spin' && type !== 'snap') return null;
  return <>
    {type === 'scope' && frame < 16 ? <svg width={1080} height={1920} style={{position: 'absolute', top: 0, left: 0, opacity: interpolate(frame, [0, 5, 10, 16], [0, 0.9, 0.9, 0], {extrapolateRight: 'clamp'})}}>
      <circle cx={522} cy={800} r={interpolate(frame, [0, 9], [210, 76], {extrapolateRight: 'clamp'})} fill="none" stroke={accent} strokeWidth={2} />
      <path d="M522 680v70 M522 850v70 M402 800h70 M572 800h70" stroke={accent} strokeWidth={3} />
    </svg> : null}
    {frame >= 9 && frame <= 11 ? <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, opacity: frame === 10 ? 0.9 : 0.35}}>
      <path d="M501 779l12 12 M543 779l-12 12 M501 821l12-12 M543 821l-12-12" fill="none" stroke={PALETTE.ivory} strokeWidth={4} />
    </svg> : null}
    {frame === 9 ? <AbsoluteFill style={{background: PALETTE.ivory, opacity: 0.12}} /> : null}
  </>;
};
