import {useEffect, useState} from 'react';
import {cancelRender, Composition, continueRender, delayRender, staticFile} from 'remotion';
import {Film} from './Film';
import type {Manifest, Production} from './types';

export const Root = () => {
  const [inputs, setInputs] = useState<{production: Production; manifest: Manifest} | null>(null);
  const [handle] = useState(() => delayRender('Loading the OMERTA motion edit'));
  useEffect(() => {
    Promise.all(['production-data.json', 'manifest.json'].map(file => fetch(staticFile(`art/flagship-rebuild/${file}`)).then(async response => {
      if (!response.ok) throw new Error(`Missing film source: ${file}`);
      return response.json();
    }))).then(values => {const [production, manifest] = values as [Production, Manifest]; setInputs({production, manifest}); continueRender(handle);}).catch(cancelRender);
  }, [handle]);
  return inputs ? <Composition id="Omerta-Flagship-Rebuild" component={Film} defaultProps={{...inputs, clean: false, muteAudio: false}} width={1920} height={1080} fps={inputs.production.film.fps} durationInFrames={Math.round(inputs.production.film.duration * inputs.production.film.fps)} /> : null;
};
