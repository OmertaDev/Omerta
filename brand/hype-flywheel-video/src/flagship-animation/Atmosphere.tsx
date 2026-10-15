import {interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, H, W} from './types';

export const Rain = ({near = false}: {near?: boolean}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig(); const now = frame / fps;
  return <svg width={W} height={H} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    <defs><clipPath id={near ? 'rain-near' : 'rain-far'}><path d="M 892 0 L 1910 0 L 1910 539 L 890 559 Z" /></clipPath></defs>
    <g clipPath={`url(#${near ? 'rain-near' : 'rain-far'})`}>
      {Array.from({length: near ? 34 : 84}, (_, i) => {
        const seed = `${near ? 'glass' : 'harbor'}-${i}`;
        const speed = near ? 15 + random(seed + 'v') * 33 : 245 + random(seed + 'v') * 215;
        const y = ((random(seed + 'y') * 660 + now * speed) % 660) - 60;
        const x = 850 + random(seed + 'x') * 1130;
        const length = near ? 7 + random(seed + 'l') * 31 : 10 + random(seed + 'l') * 22;
        return <line key={i} x1={x} x2={x + (near ? -0.8 : -7)} y1={y} y2={y + length} stroke={C.blue} strokeWidth={near ? 1.4 : 0.85} opacity={near ? 0.16 + random(seed + 'a') * 0.13 : 0.11 + random(seed + 'a') * 0.17} />;
      })}
    </g>
  </svg>;
};

export const Light = () => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig(); const now = frame / fps;
  const passing = interpolate(now, [4.15, 5.3, 6.5, 7.7, 8.6], [0, 0.16, 0.2, 0.11, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <>
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 630px 620px at 9% 28%, #ECA34D26, #BA722309 47%, transparent 69%)', opacity: 0.73 + 0.075 * Math.sin(now * 2.4) + 0.02 * Math.sin(now * 16.4), mixBlendMode: 'screen'}} />
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 740px 480px at ${83 + Math.sin(now * 0.32)}% 64%, #8fdbe218, transparent 72%)`, mixBlendMode: 'screen'}} />
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 240px 340px at ${interpolate(now, [4.15, 8.6], [58, 96], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}% 60%, #b3e6ea99, transparent 74%)`, opacity: passing, mixBlendMode: 'screen'}} />
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: passing * 1.8}}><g transform={`translate(${interpolate(now, [4.15, 8.6], [-130, 70], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}, 0)`}><path d="M 1490 420 L 1532 410 L 1419 853 L 1375 850 Z M 1610 416 L 1650 410 L 1538 863 L 1490 857 Z M 1738 420 L 1778 410 L 1651 889 L 1606 877 Z" fill="#030b10" /></g></svg>
  </>;
};

export const TableReflection = () => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig(); const now = frame / fps;
  return <svg width={W} height={H} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen', pointerEvents: 'none'}}>
    {Array.from({length: 20}, (_, i) => <path key={i} d={`M ${1140 + random(`reflection-x${i}`) * 680} ${708 + i * 7.2} l ${15 + random(`reflection-w${i}`) * 90} 1.5`} stroke={i % 5 === 0 ? '#DEB76C' : '#9FCBD3'} strokeWidth={0.8 + (i % 3) * 0.3} opacity={0.06 + 0.045 * Math.sin(now * 1.1 + i * 0.4)} />)}
  </svg>;
};
