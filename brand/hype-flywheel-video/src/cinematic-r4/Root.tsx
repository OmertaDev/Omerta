import {useEffect, useState} from 'react';
import {cancelRender, Composition, continueRender, delayRender, Folder, staticFile} from 'remotion';
import {FilmComposition} from './FilmComposition';
import {FPS, type ProductionData} from './types';

export const CinematicR4Root = () => {
  const [data, setData] = useState<ProductionData | null>(null);
  const [handle] = useState(() => delayRender('Loading cinematic production data'));
  useEffect(() => {
    fetch(staticFile('art/cinematic-r4/production-data.json'))
      .then(async response => {
        if (!response.ok) throw new Error('The cinematic production data is missing');
        return response.json() as Promise<ProductionData>;
      })
      .then(value => {setData(value); continueRender(handle);})
      .catch(cancelRender);
  }, [handle]);
  return <Folder name="OMERTA-Cinematic-R4">
    {data?.films.map(film => <Composition
      key={film.id}
      id={`Omerta-Cinematic-${film.id}`}
      component={FilmComposition}
      defaultProps={{film}}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={Math.round(film.duration * FPS)}
    />)}
  </Folder>;
};
