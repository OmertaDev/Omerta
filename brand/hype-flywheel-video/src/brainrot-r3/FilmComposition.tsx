import {Audio} from '@remotion/media';
import {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, Sequence, staticFile} from 'remotion';
import {emptyManifest, parseManifest} from './manifest';
import {BeatScene} from './scenes/BeatScene';
import {planTimeline} from './timeline';
import type {Film, Manifest, ProductionData} from './types';

export type FilmProps = {
  film: Film;
  assetWindows?: ProductionData['assetWindows'];
  manifestPath: string;
};

export const FilmComposition = ({film, assetWindows, manifestPath}: FilmProps) => {
  const [manifest, setManifest] = useState<Manifest>(emptyManifest);
  const [handle] = useState(() => delayRender('Loading local R3 asset manifest'));
  useEffect(() => {
    let cancelled = false;
    fetch(staticFile(manifestPath))
      .then(async response => response.ok ? parseManifest(await response.json()) : emptyManifest)
      .catch(() => emptyManifest)
      .then(result => {
        if (!cancelled) setManifest(result);
        continueRender(handle);
      });
    return () => {cancelled = true; continueRender(handle);};
  }, [manifestPath, handle]);
  const planned = useMemo(() => planTimeline(film, manifest, assetWindows), [film, manifest, assetWindows]);
  return <AbsoluteFill>
    {planned.map(plan => <Sequence key={`${plan.startFrame}-${plan.beat.asset}`} name={`${plan.beat.asset} / ${plan.beat.speaker}`} from={plan.startFrame} durationInFrames={plan.durationFrames}>
      <BeatScene plan={plan} />
    </Sequence>)}
    {manifest.audio[film.id] ? <Audio src={staticFile(manifest.audio[film.id])} /> : null}
    <div style={{position:'absolute',top:184,left:96,right:180,fontFamily:'Arial, sans-serif',fontSize:25,fontWeight:900,letterSpacing:1,color:'#f5f2e7',background:'#0a0a0a',padding:'9px 12px',textAlign:'center'}}>PRODUCTION DRAFT / GENERATED SCENES</div>
  </AbsoluteFill>;
};
