import {Audio} from '@remotion/media';
import {AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Opening} from './Opening';
import {StoryScene} from './StoryScene';
import type {StoryShot} from './story-types';
import {C, localPath, type OpeningScene} from './types';

type SpecialShot = {id: string; start: number; end: number; variant?: string; headline?: string; labels?: string[]} & ({scene: 'opening'} | {scene: 'end'});
export type FilmShot = StoryShot | SpecialShot;
export type FilmData = {
  duration: number; fps: number; shots: FilmShot[]; opening: OpeningScene;
  captions: {text: string; startMs: number; endMs: number}[];
  audio: {src: string};
};

const EndCard = ({opening}: {opening: OpeningScene}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  return <AbsoluteFill style={{backgroundColor: C.ink}}>
    <div style={{position: 'absolute', inset: 0, opacity: 0.35}}><Opening scene={opening} clean muteAudio showTitle={false} frameOffset={12} /></div>
    <AbsoluteFill style={{background: 'linear-gradient(90deg, #060b0d20 22%, #060b0da8 64%, #060b0dbf)'}} />
    <div style={{position: 'absolute', left: 985, top: 190, right: 100, color: C.bone, translate: `0 ${interpolate(frame, [0, fps * 0.8], [18, 0], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)})}px`, opacity: interpolate(frame, [0, fps * 0.55], [0, 1], {extrapolateRight: 'clamp'})}}>
      <div style={{fontFamily: 'Georgia, serif', fontSize: 49, letterSpacing: 8, color: C.amber, marginBottom: 44}}>OMERTÀ</div>
      <div style={{fontFamily: 'Georgia, serif', fontSize: 98, lineHeight: 1.04, letterSpacing: -2}}>Who will<br />you bring?</div>
      <div style={{width: 95, height: 3, backgroundColor: C.amber, marginTop: 41, marginBottom: 38}} />
      <div style={{fontFamily: 'Arial, sans-serif', fontSize: 77, lineHeight: 1, fontWeight: 600, color: C.amber}}>omerta.fun</div>
      <div style={{fontFamily: 'Arial, sans-serif', fontSize: 42, marginTop: 30}}>Play now.</div>
    </div>
  </AbsoluteFill>;
};

const CaptionTrack = ({film}: {film: FilmData}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig(); const ms = frame / fps * 1000;
  const caption = film.captions.find(cue => ms >= cue.startMs && ms < cue.endMs);
  return caption ? <div style={{position: 'absolute', left: 140, right: 140, bottom: 47, display: 'flex', justifyContent: 'center'}}><div style={{fontFamily: 'Arial, sans-serif', fontSize: 33, lineHeight: 1.22, padding: '11px 21px 13px', backgroundColor: '#050a0ce5', color: C.bone, textAlign: 'center', maxWidth: 1630, whiteSpace: 'pre-line'}}>{caption.text.trim()}</div></div> : null;
};

export const Film = ({film, clean = false, muteAudio = false}: {film: FilmData; clean: boolean; muteAudio: boolean}) => {
  const {fps} = useVideoConfig();
  const hasOpening = film.shots[0]?.start === 0;
  const last = film.shots[film.shots.length - 1];
  return <AbsoluteFill style={{backgroundColor: C.ink}}>
    {!hasOpening ? <Sequence from={0} durationInFrames={15 * fps} name="Opening"><Opening scene={film.opening} clean muteAudio /></Sequence> : null}
    {film.shots.map(shot => <Sequence key={shot.id} name={shot.id} from={Math.round(shot.start * fps)} durationInFrames={Math.round(shot.end * fps) - Math.round(shot.start * fps)}>
      {shot.scene === 'opening' ? <Opening scene={film.opening} clean muteAudio showTitle={shot.start === 0} frameOffset={shot.variant === 'after' || shot.variant === 'aftermath' ? 6 : 0} /> : shot.scene === 'end' ? <EndCard opening={film.opening} /> : <StoryScene shot={shot} />}
    </Sequence>)}
    {last && last.end < film.duration ? <Sequence from={Math.round(last.end * fps)} durationInFrames={Math.round((film.duration - last.end) * fps)} name="Invitation"><EndCard opening={film.opening} /></Sequence> : null}
    {!clean ? <CaptionTrack film={film} /> : null}
    {!muteAudio && film.audio?.src ? <Audio src={staticFile(localPath(film.audio.src))} /> : null}
  </AbsoluteFill>;
};
