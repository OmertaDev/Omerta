import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, staticFile, useVideoConfig} from 'remotion';
import {Captions} from './Captions';
import {DiagramScene} from './DiagramScene';
import {DossierScene} from './DossierScene';
import {Frame} from './Frame';
import {GameplayScene} from './GameplayScene';
import {C, localPath, type Manifest, type Production} from './types';

export const FlagshipFilm = ({production, manifest, clean = false, muteAudio = false}: {production: Production; manifest: Manifest; clean?: boolean; muteAudio?: boolean}) => {
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{background: C.black}}>
    {production.film.beats.map(beat => {
      const from = Math.round(beat.start * fps);
      const durationInFrames = Math.round(beat.end * fps) - from;
      const Scene = beat.kind === 'gameplay' ? GameplayScene : beat.kind === 'diagram' ? DiagramScene : DossierScene;
      return <Sequence key={beat.id} from={from} durationInFrames={durationInFrames} name={`${beat.id} / ${beat.chapter}`}><Frame beat={beat} manifest={manifest}><Scene beat={beat} manifest={manifest} /></Frame></Sequence>;
    })}
    <Captions production={production} clean={clean} />
    {!muteAudio && manifest.audio?.src ? <Audio src={staticFile(localPath(manifest.audio.src))} /> : null}
  </AbsoluteFill>;
};
