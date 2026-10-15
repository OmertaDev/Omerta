import {useEffect, useState} from 'react';
import {cancelRender, Composition, continueRender, delayRender, staticFile} from 'remotion';
import {FlagshipFilm} from './FlagshipFilm';
import {FPS, type Manifest, type Production} from './types';

export const FlagshipRoot = () => {
  const [inputs, setInputs] = useState<{production: Production; manifest: Manifest} | null>(null);
  const [handle] = useState(() => delayRender('Loading the Trust Is the Game animatic'));
  useEffect(() => {
    Promise.all(['production-data.json', 'manifest.json'].map(file => fetch(staticFile(`art/flagship-trust/${file}`)).then(async result => {
      if (!result.ok) throw new Error(`Flagship source is missing: ${file}`);
      return result.json();
    }))).then(async values => {
      const [production, manifest] = values as [Production, Manifest];
      if (manifest.fonts?.length) await Promise.all(manifest.fonts.map(async font => {
        const face = new FontFace(font.family, `url("${staticFile(font.src)}")`, {weight: String(font.weight || 400)});
        await face.load(); document.fonts.add(face);
      }));
      setInputs({production, manifest}); continueRender(handle);
    }).catch(cancelRender);
  }, [handle]);
  return inputs ? <Composition id="Omerta-Trust-Is-The-Game" component={FlagshipFilm} defaultProps={{...inputs, clean: false, muteAudio: false}} width={1920} height={1080} fps={inputs.production.film.fps || FPS} durationInFrames={Math.round(inputs.production.film.duration * (inputs.production.film.fps || FPS))} /> : null;
};
