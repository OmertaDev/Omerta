import {Video} from '@remotion/media';
import {AbsoluteFill, CanvasImage, Easing, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {motion} from './Primitives';
import {C, clamp, FPS, localPath, type Beat, type Manifest, type Plate} from './types';

const Photo = ({plate, beat, reversed = false, remainingFrames}: {plate: Plate; beat: Beat; reversed?: boolean; remainingFrames?: number}) => {
  const frame = useCurrentFrame();
  const targetFrames = remainingFrames || Math.max(1, Math.round((beat.end - beat.start) * FPS));
  const progress = clamp(frame / targetFrames);
  const trimStart = Math.max(0, plate.trimStart || 0);
  const sourceDuration = (plate.duration || 0) - trimStart;
  if (plate.type === 'video' && !(sourceDuration > 0)) throw new Error(`Video duration is required for a single-pass plate: ${plate.src}`);
  const playbackRate = plate.type === 'video' ? Math.min(1, Math.max(0.05, (sourceDuration - 2 / FPS) / (targetFrames / FPS))) : 1;
  const direction = reversed ? -1 : 1;
  const whip = beat.transition === 'snap' ? interpolate(frame, [0, 9], [210 * direction, 0], {extrapolateRight: 'clamp', easing: Easing.bezier(0.12, 0.8, 0.2, 1)}) : 0;
  const spin = beat.transition === 'spin' ? interpolate(frame, [0, 11], [-360, 0], {extrapolateRight: 'clamp', easing: Easing.bezier(0.12, 0.85, 0.22, 1)}) : 0;
  return <AbsoluteFill style={{scale: 1.065 + progress * 0.075, translate: `${(progress - 0.5) * 52 * direction + whip}px ${(progress - 0.5) * -38}px`, rotate: `${spin + (progress - 0.5) * 0.65 * direction}deg`, transformOrigin: '50% 54%'}}>
    {plate.type === 'video' ? <Video src={staticFile(localPath(plate.src))} muted playbackRate={playbackRate} trimBefore={Math.round(trimStart * FPS)} objectFit="cover" style={{width: '100%', height: '100%'}} /> : <CanvasImage src={staticFile(localPath(plate.src))} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
  </AbsoluteFill>;
};

export const CinemaStage = ({beat, manifest, children}: {beat: Beat; manifest: Manifest; children?: React.ReactNode}) => {
  const frame = useCurrentFrame();
  const duration = (beat.end - beat.start) * FPS;
  const plate = manifest.plates[beat.plate];
  if (!plate) throw new Error(`Missing Soul cinema plate: ${beat.plate}`);
  const secondPlate = beat.secondPlate ? manifest.plates[beat.secondPlate] : undefined;
  const secondStart = Math.round(duration * 0.53);
  const secondFade = motion(frame, secondStart, secondStart + 7);
  const diagram = beat.layout === 'diagram';
  const capture = beat.layout === 'capture';
  const number = Number(beat.id.match(/\d+$/)?.[0] || 0);
  const bottomTitle = !diagram && !capture && beat.kind !== 'hero' && number % 3 === 0;
  const rightTitle = !diagram && !capture && number % 3 === 2;
  const titleSize = diagram || capture ? 95 : beat.headline.length < 26 ? 118 : 108;
  return <AbsoluteFill style={{background: C.black, color: C.ivory}}>
    <Photo plate={plate} beat={beat} />
    {secondPlate ? <Sequence from={secondStart} durationInFrames={Math.max(1, Math.round(duration) - secondStart)}><AbsoluteFill style={{opacity: secondFade}}><Photo plate={secondPlate} beat={{...beat, transition: 'pan'}} remainingFrames={Math.max(1, Math.round(duration) - secondStart)} reversed /></AbsoluteFill></Sequence> : null}
    <AbsoluteFill style={{background: diagram ? 'linear-gradient(180deg,#110D08A6 0%,#110D0852 20%,#110D08B3 41%,#110D08A8 65%,#110D08E6 85%,#110D08 100%)' : 'linear-gradient(180deg,#110D0870 0%,transparent 30%,transparent 50%,#110D0866 66%,#110D08DC 82%,#110D08 100%)'}} />
    <AbsoluteFill style={{background: 'linear-gradient(90deg,#1B0D0880,transparent 54%,#240C0D20)', boxShadow: 'inset 0 0 95px #100C0860'}} />
    <AbsoluteFill style={{background: `radial-gradient(ellipse at ${12 + frame % 160 * 0.025}% 17%,#D2A45416,transparent 38%)`, mixBlendMode: 'screen'}} />
    {children}
    {beat.kind !== 'end' ? <>
      <div style={{position: 'absolute', left: 96, top: 151, fontFamily: 'Arial, sans-serif', fontSize: 24, fontWeight: 500, color: C.copper, textTransform: 'uppercase', letterSpacing: 3.6, opacity: 0.95}}>{beat.chapter?.replace(/^\d+\s*\/\s*/, '') || 'OMERTÀ'}</div>
      <div style={{position: 'absolute', left: rightTitle ? 150 : 90, top: bottomTitle ? 917 : 205, width: rightTitle ? 770 : 835, fontFamily: 'Georgia, serif', fontStyle: number % 2 ? 'italic' : 'normal', fontWeight: 400, fontSize: titleSize, letterSpacing: -5, lineHeight: 0.98, textWrap: 'balance', whiteSpace: 'pre-line', textAlign: rightTitle ? 'right' : 'left', textShadow: '0 3px 23px #0007', opacity: interpolate(frame, [0, 8], [0.7, 1], {extrapolateRight: 'clamp'}), translate: `0 ${interpolate(frame, [0, 17], [18, 0], {extrapolateRight: 'clamp', easing: Easing.bezier(0.12, 0.75, 0.2, 1)})}px`}}>{beat.headline}</div>
      {(diagram || beat.showTags) && beat.tags?.length ? <div style={{position: 'absolute', left: 96, top: 1300, width: 822, fontFamily: 'Arial, sans-serif', color: C.muted, fontSize: 32, lineHeight: 1.13, display: 'flex', flexDirection: 'column', gap: 5}}>{beat.tags.slice(0, 2).map(tag => <div key={tag}>{tag}</div>)}</div> : null}
    </> : null}
    {beat.transition === 'scope' && frame < 14 ? <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: interpolate(frame, [0, 5, 10, 14], [0, 0.8, 0.8, 0], {extrapolateRight: 'clamp'})}}><path d="M434 760h-33v33 M615 760h33v33 M434 973h-33v-33 M615 973h33v-33" fill="none" stroke={C.ivory} strokeWidth={2} /><circle cx={524} cy={866} r={5} fill={C.copper} /></svg> : null}
    {(beat.transition === 'spin' || beat.transition === 'snap') && frame === 9 ? <AbsoluteFill style={{background: '#FFE2B2', opacity: 0.17}} /> : null}
    <div style={{position: 'absolute', left: 34, top: 74, width: 1, height: 74, background: '#FFF0D534'}} />
    <div style={{position: 'absolute', right: 38, bottom: 80, width: 55, height: 1, background: '#FFF0D534'}} />
  </AbsoluteFill>;
};
