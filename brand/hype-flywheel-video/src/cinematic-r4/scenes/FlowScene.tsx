import {AbsoluteFill, CanvasImage, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Impact, SceneHeading} from '../SceneFurniture';
import {clamp, localAsset, PALETTE, type SceneProps} from '../types';

export const FlowScene = ({film, beat, capture, index}: SceneProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = film.accent || PALETTE.gold;
  const nodes = beat.flow?.length ? beat.flow : beat.tags || [];
  const allocation = beat.flowMode === 'allocation';
  const area = 646;
  const gap = 28;
  const nodeHeight = Math.min(168, (area - gap * (nodes.length - 1)) / Math.max(1, nodes.length));
  const stepFrames = Math.max(8, ((beat.end - beat.start) * fps - 20) * 0.68 / Math.max(1, nodes.length));
  return <AbsoluteFill style={{background: PALETTE.black}}>
    {capture ? <CanvasImage src={staticFile(localAsset(capture.src))} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.095, filter: 'blur(5px) saturate(0.3)'}} /> : null}
    <AbsoluteFill style={{background: 'linear-gradient(90deg,#080909f5,#08090999)'}} />
    <SceneHeading film={film} beat={beat} index={index} />
    <div style={{position: 'absolute', left: 90, top: 431, color: PALETTE.muted, fontFamily: 'Arial, sans-serif', fontSize: 24, letterSpacing: 2.5, textTransform: 'uppercase'}}>{allocation ? 'Fee allocation · editorial' : 'System flow · editorial'}</div>
    {nodes.map((node, nodeIndex) => {
      const elapsed = frame - nodeIndex * (allocation ? 2 : stepFrames);
      const on = elapsed >= 0;
      const y = 486 + nodeIndex * (nodeHeight + gap);
      if (allocation) {
        const percentage = node.match(/\d+(?:\.\d+)?\s*%/)?.[0];
        const label = percentage ? node.replace(percentage, '').replace(/^[\s:·—–-]+|[\s:·—–-]+$/g, '') : node;
        return <div key={`${nodeIndex}-${node}`} style={{position: 'absolute', left: 90, top: y, width: 810, height: nodeHeight, boxSizing: 'border-box', border: `1px solid ${accent}45`, background: `linear-gradient(90deg,${accent}12,transparent)`, opacity: interpolate(elapsed, [0, 10], [0.25, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
          <div style={{position: 'absolute', left: 22, top: 0, width: percentage ? 555 : 765, height: nodeHeight, display: 'flex', alignItems: 'center', fontFamily: 'Arial, sans-serif', color: PALETTE.ivory, fontSize: 44, lineHeight: 1.1}}>{label}</div>
          {percentage ? <div style={{position: 'absolute', right: 22, top: 0, width: 180, height: nodeHeight, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', fontFamily: 'Arial, sans-serif', color: accent, fontSize: 58, fontWeight: 500}}>{percentage}</div> : null}
          <div style={{position: 'absolute', left: 0, bottom: 0, width: `${interpolate(elapsed, [0, 16], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}%`, height: 2, background: accent, opacity: 0.6}} />
        </div>;
      }
      return <div key={`${nodeIndex}-${node}`} style={{position: 'absolute', left: 90, top: y, width: 810, height: nodeHeight, opacity: interpolate(elapsed, [-8, 0, 8], [0.23, 0.23, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), translate: `${interpolate(elapsed, [0, 10], [16, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px 0`}}>
        <div style={{position: 'absolute', left: 0, top: nodeHeight / 2 - 22, width: 44, height: 44, boxSizing: 'border-box', border: `1px solid ${on ? accent : '#514D42'}`, borderRadius: '50%', color: on ? accent : PALETTE.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', fontSize: 22}}>{String(nodeIndex + 1).padStart(2, '0')}</div>
        {nodeIndex < nodes.length - 1 ? <div style={{position: 'absolute', left: 21, top: nodeHeight / 2 + 28, width: 2, height: nodeHeight / 2 + gap - 7, background: '#ffffff12'}}>
          <div style={{width: 2, height: `${clamp((elapsed - 6) / stepFrames, 0, 1) * 100}%`, background: accent}} />
        </div> : null}
        <div style={{position: 'absolute', left: 72, width: 738, top: 0, height: nodeHeight, boxSizing: 'border-box', borderBottom: `1px solid ${on ? `${accent}60` : '#ffffff14'}`, background: on ? `linear-gradient(90deg,${accent}16,transparent)` : 'transparent', padding: '15px 22px', display: 'flex', alignItems: 'center', color: PALETTE.ivory, fontFamily: 'Arial, sans-serif', fontSize: node.length > 48 ? 38 : 44, fontWeight: 500, lineHeight: 1.14}}>{node}</div>
      </div>;
    })}
    {beat.note ? <div style={{position: 'absolute', left: 162, top: 1148, width: 738, color: PALETTE.muted, fontFamily: 'Arial, sans-serif', fontSize: 25, lineHeight: 1.25}}>{beat.note}</div> : null}
    <Impact type={beat.transition} accent={accent} />
  </AbsoluteFill>;
};
