import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {cameraAt, Media, mediaRect} from './Media';
import {C, clamp, FONT, type SceneProps} from './types';

export const GameplayScene = ({beat, manifest}: SceneProps) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const duration = beat.end - beat.start; const now = frame / fps;
  const asset = manifest.assets[beat.capture || beat.asset || ''];
  if (!asset) throw new Error(`Missing gameplay evidence for ${beat.id}`);
  const rect = mediaRect(asset, cameraAt(beat, clamp(now / duration)));
  const titleAt = beat.titleAt ?? 0.12; const titleEnd = titleAt + (beat.titleDuration ?? Math.min(2.8, duration * 0.38));
  const titleOpacity = interpolate(now, [titleAt, titleAt + 0.22, titleEnd - 0.22, titleEnd], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{backgroundColor: C.ink, overflow: 'hidden'}}>
    <Media asset={asset} beat={beat} />
    {beat.highlights?.map((highlight, index) => {
      const at = highlight.at ?? index / Math.max(1, beat.highlights!.length);
      const until = highlight.until ?? (index + 1) / Math.max(1, beat.highlights!.length);
      const reveal = interpolate(now / duration, [at, Math.min(until, at + 0.04)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      const opacity = now / duration < until ? reveal : 0;
      return <div key={index} style={{position: 'absolute', left: rect.left + highlight.x * rect.width, top: rect.top + highlight.y * rect.height, width: highlight.w * rect.width, height: highlight.h * rect.height, border: `3px solid ${C.amber}`, boxSizing: 'border-box', opacity, clipPath: `inset(0 ${100 * (1 - reveal)}% 0 0)`}}>
        {highlight.label ? <div style={{position: 'absolute', top: -44, left: -3, padding: '6px 12px', backgroundColor: C.ink, color: C.bone, fontFamily: FONT.body, fontSize: 25, whiteSpace: 'nowrap'}}>{highlight.label}</div> : null}
      </div>;
    })}
    {beat.headline && titleOpacity > 0 ? <div style={{position: 'absolute', left: 0, right: 0, ...(beat.titlePosition === 'top' ? {top: 0, padding: '55px 100px 75px', background: 'linear-gradient(#090d0ff5, #090d0fcf 70%, transparent)'} : {bottom: 110, padding: '90px 100px 30px', background: 'linear-gradient(transparent, #090d0fed 60%)'}), opacity: titleOpacity}}>
      <div style={{fontFamily: FONT.title, fontWeight: 400, color: C.bone, fontSize: beat.headline.length > 44 ? 65 : 80, maxWidth: 1650, lineHeight: 1.08, translate: `0 ${interpolate(now, [titleAt, titleAt + 0.45], [20, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)})}px`}}>{beat.headline}</div>
    </div> : null}
    {beat.labels?.length && now > titleEnd ? <div style={{position: 'absolute', left: 96, top: 62, maxWidth: 1680, padding: '14px 22px', color: C.bone, backgroundColor: '#090d0fed', font: `34px ${FONT.body}`, lineHeight: 1.2, opacity: interpolate(now, [titleEnd, titleEnd + 0.3, Math.max(titleEnd + 0.4, duration - 0.3), duration], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>{beat.labels.join('     /     ')}</div> : null}
    {beat.note ? <div style={{position: 'absolute', right: 85, bottom: 166, maxWidth: 840, padding: '10px 18px', backgroundColor: '#090d0feb', color: C.bone, font: `26px ${FONT.body}`, lineHeight: 1.25}}>{beat.note}</div> : null}
  </AbsoluteFill>;
};
