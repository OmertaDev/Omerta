import {Audio} from '@remotion/media';
import {useEffect, useState} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender, Sequence, staticFile} from 'remotion';
import {Captions} from './Captions';
import {CaptureScene, EndScene} from './CaptureScene';
import {MechanismScene} from './MechanismScene';
import {SceneStage} from './Primitives';
import {RangeScene} from './RangeScene';
import {ReservesScene} from './ReservesScene';
import {C, FPS, localPath, type Manifest, type Production} from './types';

export const MarketFilm = ({production}: {production: Production}) => {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [handle] = useState(() => delayRender('Loading Market V2 media manifest'));
  useEffect(() => {
    fetch(staticFile('art/market-v2-film/manifest.json')).then(async response => {
      if (!response.ok) throw new Error('Market V2 manifest missing');
      return response.json() as Promise<Manifest>;
    }).then(value => {setManifest(value); continueRender(handle);}).catch(cancelRender);
  }, [handle]);
  if (!manifest) return null;
  return <AbsoluteFill style={{background: C.black}}>
    {production.film.beats.map(beat => {
      const from = Math.round(beat.start * FPS);
      const duration = Math.round(beat.end * FPS) - from;
      const capture = beat.screen ? manifest.captures[beat.screen] : undefined;
      const Scene = beat.kind === 'range' ? RangeScene : beat.kind === 'reserves' ? ReservesScene : beat.kind === 'capture' || beat.kind === 'hero' ? CaptureScene : MechanismScene;
      return <Sequence key={beat.id} from={from} durationInFrames={duration} name={`${beat.id} / ${beat.kind} / ${beat.state || ''}`}>
        {beat.kind === 'end' ? <EndScene beat={beat} capture={capture} /> : <SceneStage beat={beat}><Scene beat={beat} capture={capture} /></SceneStage>}
      </Sequence>;
    })}
    <Captions production={production} />
    {manifest.audio?.src ? <Audio src={staticFile(localPath(manifest.audio.src))} /> : null}
  </AbsoluteFill>;
};
