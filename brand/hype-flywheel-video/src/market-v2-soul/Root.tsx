import {useEffect, useState} from 'react';
import {cancelRender, Composition, continueRender, delayRender, staticFile} from 'remotion';
import {SoulFilm} from './SoulFilm';
import {FPS, type Production} from './types';

export const SoulRoot = () => {
  const [data, setData] = useState<Production | null>(null);
  const [handle] = useState(() => delayRender('Loading Market V2 editorial timeline'));
  useEffect(() => {
    fetch(staticFile('art/market-v2-soul/production-data.json')).then(async response => {
      if (!response.ok) throw new Error('Market V2 production data is missing');
      return response.json() as Promise<Production>;
    }).then(value => {setData(value); continueRender(handle);}).catch(cancelRender);
  }, [handle]);
  return data ? <Composition id="Omerta-Market-V2-Soul" component={SoulFilm} defaultProps={{production: data}} width={1080} height={1920} fps={FPS} durationInFrames={Math.round(data.film.duration * FPS)} /> : null;
};
