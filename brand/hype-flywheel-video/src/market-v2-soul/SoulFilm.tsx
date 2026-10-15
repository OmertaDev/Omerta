import {Audio} from '@remotion/media';
import {useEffect, useState} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender, Sequence, staticFile} from 'remotion';
import {Captions} from './Captions';
import {CinemaStage} from './CinemaStage';
import {MechanismScene} from './MechanismScene';
import {RangeScene} from './RangeScene';
import {ReservesScene} from './ReservesScene';
import {ScreenCloseup} from './ScreenCloseup';
import {C, FPS, localPath, type Manifest, type Production} from './types';

export const SoulFilm = ({production}: {production: Production}) => {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [handle] = useState(() => delayRender('Loading Soul cinema assets'));
  useEffect(() => {
    fetch(staticFile('art/market-v2-soul/manifest.json')).then(async response => {
      if (!response.ok) throw new Error('Soul manifest is missing');
      return response.json() as Promise<Manifest>;
    }).then(value => {setManifest(value); continueRender(handle);}).catch(cancelRender);
  }, [handle]);
  if (!manifest) return null;
  return <AbsoluteFill style={{background: C.black}}>
    {production.film.beats.map(beat => {
      const from = Math.round(beat.start * FPS);
      const duration = Math.round(beat.end * FPS) - from;
      const capture = beat.screen ? manifest.captures[beat.screen] : undefined;
      const insertCapture = beat.captureInsert ? manifest.captures[beat.captureInsert.screen] : undefined;
      const insertFrom = beat.captureInsert ? Math.round(duration * (beat.captureInsert.startFraction ?? 0.65)) : duration;
      const Diagram = beat.kind === 'range' ? RangeScene : beat.kind === 'reserves' ? ReservesScene : MechanismScene;
      return <Sequence key={beat.id} from={from} durationInFrames={duration} name={`${beat.id} / ${beat.layout || 'cinema'} / ${beat.plate}`}>
        <CinemaStage beat={beat} manifest={manifest}>
          {beat.kind === 'end' ? <div style={{position: 'absolute', left: 90, top: 605, width: 840, color: C.ivory}}><div style={{fontFamily: 'Georgia, serif', fontSize: 119, fontWeight: 400, letterSpacing: 5}}>OMERTÀ</div><div style={{fontFamily: 'Georgia, serif', fontSize: 74, lineHeight: 1.05, fontStyle: 'italic', color: C.copper, marginTop: 55, whiteSpace: 'pre-line'}}>{beat.headline}</div></div> : beat.layout === 'capture' ? <ScreenCloseup beat={beat} capture={capture} /> : beat.layout === 'diagram' ? <Sequence from={0} durationInFrames={insertFrom}><AbsoluteFill style={{translate: '0 34px'}}><Diagram beat={beat} capture={capture} /></AbsoluteFill></Sequence> : null}
          {beat.captureInsert && insertCapture ? <Sequence from={insertFrom} durationInFrames={duration - insertFrom}><ScreenCloseup beat={{...beat, start: 0, end: (duration - insertFrom) / FPS, captureLabel: beat.captureInsert.label}} capture={insertCapture} /></Sequence> : null}
        </CinemaStage>
      </Sequence>;
    })}
    <Captions production={production} />
    {manifest.audio?.src ? <Audio src={staticFile(localPath(manifest.audio.src))} /> : null}
  </AbsoluteFill>;
};
