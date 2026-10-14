import {Audio} from '@remotion/media';
import {AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CinemaScene} from './CinemaScene';
import {GameplayScene} from './GameplayScene';
import {FlowScene} from './FlowScene';
import {TypeScene} from './TypeScene';
import {C, FONT, localPath, type Manifest, type Production, type SceneProps} from './types';

const Scene = (props: SceneProps) => {
  const frame = useCurrentFrame();
  const {beat} = props;
  const flash = beat.transition === 'flash' ? interpolate(frame, [0, 2, 7], [0.82, 0.16, 0], {extrapolateRight: 'clamp'}) : 0;
  return <AbsoluteFill style={{overflow: 'hidden', clipPath: beat.transition === 'push' ? `inset(0 ${interpolate(frame, [0, 9], [100, 0], {extrapolateRight: 'clamp'})}% 0 0)` : undefined}}>
    {beat.kind === 'gameplay' ? <GameplayScene {...props} /> : beat.kind === 'cinema' ? <CinemaScene {...props} /> : beat.kind === 'flow' ? <FlowScene {...props} /> : <TypeScene {...props} />}
    {flash ? <AbsoluteFill style={{backgroundColor: C.bone, opacity: flash}} /> : null}
  </AbsoluteFill>;
};

const Captions = ({production}: {production: Production}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const caption = production.captions?.find(cue => frame / fps * 1000 >= cue.startMs && frame / fps * 1000 < cue.endMs);
  return caption ? <div style={{position: 'absolute', bottom: 49, left: 125, right: 125, display: 'flex', justifyContent: 'center'}}><div style={{padding: '12px 23px 14px', backgroundColor: '#090d0fec', color: C.bone, font: `34px ${FONT.body}`, lineHeight: 1.22, textAlign: 'center', whiteSpace: 'pre-line', maxWidth: 1660}}>{caption.text.trim()}</div></div> : null;
};

export const Film = ({production, manifest, clean, muteAudio}: {production: Production; manifest: Manifest; clean: boolean; muteAudio: boolean}) => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{backgroundColor: C.ink}}>
    {production.film.beats.map(beat => <Sequence key={beat.id} name={beat.id} from={Math.round(beat.start * fps)} durationInFrames={Math.round(beat.end * fps) - Math.round(beat.start * fps)} premountFor={fps}><Scene beat={beat} manifest={manifest} /></Sequence>)}
    {!muteAudio && manifest.audio?.src ? <Audio src={staticFile(localPath(manifest.audio.src))} /> : null}
    {!clean ? <Captions production={production} /> : null}
  </AbsoluteFill>;
};
