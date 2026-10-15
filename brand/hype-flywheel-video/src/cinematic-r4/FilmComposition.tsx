import {Audio} from '@remotion/media';
import {useEffect, useState} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender, Sequence, staticFile} from 'remotion';
import {Captions} from './Captions';
import {FilmAtmosphere, SystemRibbon} from './SceneFurniture';
import {CaptureScene} from './scenes/CaptureScene';
import {EndScene} from './scenes/EndScene';
import {FlowScene} from './scenes/FlowScene';
import {FPS, localAsset, PALETTE, type Film, type Manifest} from './types';

export const FilmComposition = ({film}: {film: Film}) => {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [handle] = useState(() => delayRender('Loading verified cinematic screenshot manifest'));
  useEffect(() => {
    fetch(staticFile('art/cinematic-r4/manifest.json'))
      .then(async response => {
        if (!response.ok) throw new Error('The cinematic capture manifest is missing');
        return response.json() as Promise<Manifest>;
      })
      .then(value => {setManifest(value); continueRender(handle);})
      .catch(cancelRender);
  }, [handle]);
  if (!manifest) return null;
  const track = manifest.audio?.[film.id];
  return <AbsoluteFill style={{background: PALETTE.black}}>
    {film.beats.map((beat, index) => {
      const Scene = beat.kind === 'flow' ? FlowScene : beat.kind === 'end' ? EndScene : CaptureScene;
      const start = Math.round(beat.start * FPS);
      const duration = Math.round(beat.end * FPS) - start;
      if (duration < 1) return null;
      const screenIds = beat.screens?.length ? beat.screens : beat.screen ? [beat.screen] : [];
      const captures = screenIds.map(id => {
        const capture = manifest.captures[id];
        if (!capture) throw new Error(`Missing real screenshot: ${id}`);
        return capture;
      });
      return <Sequence key={beat.id} name={`${beat.id} / ${beat.headline.replace(/\n/g, ' ')}`} from={start} durationInFrames={duration}>
        <Scene film={film} beat={beat} capture={captures[0]} captures={captures} index={index} />
        {beat.kind !== 'end' ? <SystemRibbon film={film} beat={beat} /> : null}
      </Sequence>;
    })}
    <FilmAtmosphere film={film} />
    <Captions film={film} />
    {track ? <Audio src={staticFile(localAsset(typeof track === 'string' ? track : track.src))} /> : null}
  </AbsoluteFill>;
};
