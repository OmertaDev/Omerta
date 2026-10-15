import {Audio} from '@remotion/media';
import {AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Light, Rain, TableReflection} from './Atmosphere';
import {Layer} from './Layer';
import {C, H, localPath, W, type OpeningScene, type Point} from './types';

const hold = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = {...hold, easing: Easing.bezier(0.22, 1, 0.36, 1)};
const cameraOffset = (focus: number, size: number, scale: number) => Math.max(size - size * scale, Math.min(0, size / 2 - size * scale * focus));

export const Opening = ({scene, clean = false, muteAudio = false, showTitle = true, frameOffset = 0}: {scene: OpeningScene; clean: boolean; muteAudio: boolean; showTitle?: boolean; frameOffset?: number}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig(); const now = frame / fps + frameOffset;
  const push = interpolate(now, [0.7, 1.8, 2.8, 3.4], [0, 0.25, 0.94, 1], {...hold, easing: [Easing.in(Easing.cubic), Easing.out(Easing.quad), Easing.out(Easing.quad)]});
  const reach = interpolate(now, [0.52, 1.4, 1.8, 2.05, 2.7, 3.4], [0, 0.74, 1, 1, 0.21, 0], {...hold, easing: Easing.bezier(0.45, 0, 0.3, 1)});
  const lean = interpolate(now, [0.35, 1.8, 2.2, 4.2], [0, 1, 0.95, 0], ease);
  const handTravel = scene.action?.handTravel || [0.067, 0.002];
  const envelopeTravel = scene.action?.envelopeTravel || [0.205, 0.018];
  const envelopeMove: Point = [push * envelopeTravel[0] * W, push * envelopeTravel[1] * H];
  const breath = Math.sin(now * 1.55) * 0.00085;
  const envelopeAngle = interpolate(now, [0.7, 1.8, 2.7, 3.4], [0, 1.4, -1.7, -2.1], ease);
  const shadow = scene.action?.envelopeShadow || [0.346, 0.641, 0.164, 0.024];
  const zoom = interpolate(now, [0, 1.8, 3.8, 6.6, 8.7, 11.3, 15], [1.025, 1.025, 1.105, 1.155, 1.155, 1.045, 1.03], {...hold, easing: Easing.bezier(0.5, 0, 0.5, 1)});
  const focusX = interpolate(now, [0, 1.8, 3.8, 6.6, 8.7, 11.3], [0.5, 0.5, 0.55, 0.615, 0.615, 0.5], {...hold, easing: Easing.bezier(0.5, 0, 0.5, 1)});
  const focusY = interpolate(now, [0, 2, 4, 8.7, 11.3], [0.5, 0.5, 0.46, 0.46, 0.5], ease);
  const caption = scene.captions?.find(cue => now * 1000 >= cue.startMs && now * 1000 < cue.endMs);
  const titleOpacity = interpolate(now, [9.2, 10.5, Math.max(10.6, scene.duration - 0.6), scene.duration], [0, 1, 1, 0], hold);
  return <AbsoluteFill style={{backgroundColor: C.ink, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, width: W, height: H, scale: zoom, translate: `${cameraOffset(focusX, W, zoom)}px ${cameraOffset(focusY, H, zoom)}px`, transformOrigin: '0 0'}}>
      <Layer asset={scene.layers.background} />
      <Rain />
      <Rain near />
      <Layer asset={scene.layers.nico} translate={[lean * 26, lean * 4 + Math.sin(now * 1.55) * 1.4]} rotate={lean * 0.7} scale={1 + breath} style={{filter: 'brightness(0.8) saturate(0.88)'}} />
      <Layer asset={scene.layers.background} style={{clipPath: 'polygon(0% 61.7%, 23% 60.8%, 48% 61.5%, 74% 63.6%, 100% 70.5%, 100% 100%, 0% 100%)'}} />
      <TableReflection />
      <div style={{position: 'absolute', left: shadow[0] * W, top: shadow[1] * H, width: shadow[2] * W, height: shadow[3] * H, backgroundColor: '#010406', borderRadius: '43%', filter: 'blur(4px)', opacity: 0.35 + push * 0.09, translate: `${envelopeMove[0] + 4}px ${envelopeMove[1] + 7}px`, rotate: `${envelopeAngle}deg`, scale: `${1 + reach * 0.04} ${1 - reach * 0.13}`}} />
      <Layer asset={scene.layers.envelope} translate={envelopeMove} rotate={envelopeAngle} style={{filter: 'brightness(0.86) saturate(0.88)'}} />
      <Layer asset={scene.layers.hand} translate={[lean * 26, reach * handTravel[1] * H + lean * 4]} rotate={reach * -0.3 + lean * 0.7} scale={`${1 + reach * handTravel[0] * 3.5} 1`} style={{filter: 'brightness(0.8) saturate(0.88)'}} />
      <Light />
      {scene.layers.foreground ? <Layer asset={scene.layers.foreground} translate={[-(zoom - 1) * 25, (zoom - 1) * 15]} /> : null}
    </div>
    <AbsoluteFill style={{background: 'linear-gradient(0deg, #03090daa, transparent 27%)', pointerEvents: 'none'}} />
    {showTitle ? <div style={{position: 'absolute', left: 1130, top: 108, opacity: titleOpacity, translate: `0 ${interpolate(now, [9.2, 10.5], [13, 0], ease)}px`, color: C.bone, textShadow: '0 2px 12px #000b'}}>
      <div style={{fontFamily: 'Georgia, serif', fontSize: 102, letterSpacing: 12, lineHeight: 1}}>OMERTÀ</div>
      <div style={{fontFamily: 'Arial, sans-serif', fontSize: 23, letterSpacing: 7.5, color: C.amber, marginTop: 20}}>TRUST IS THE GAME</div>
    </div> : null}
    {!clean && caption ? <div style={{position: 'absolute', left: 160, right: 160, bottom: 47, display: 'flex', justifyContent: 'center'}}><div style={{fontFamily: 'Arial, sans-serif', fontSize: 33, lineHeight: 1.22, padding: '11px 21px 13px', backgroundColor: '#050a0ce5', color: C.bone, textAlign: 'center', maxWidth: 1590}}>{caption.text}</div></div> : null}
    {!muteAudio && scene.audio ? <Audio src={staticFile(localPath(scene.audio.src))} trimBefore={Math.round((scene.audio.offsetSeconds || 0) * fps)} /> : null}
  </AbsoluteFill>;
};
