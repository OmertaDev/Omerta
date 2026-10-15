import {useEffect, useState} from 'react';
import {cancelRender, Composition, continueRender, delayRender, staticFile} from 'remotion';
import {Opening} from './Opening';
import {Film, type FilmData} from './Film';
import type {OpeningScene} from './types';

export const Root = () => {
  const [scene, setScene] = useState<OpeningScene | null>(null);
  const [film, setFilm] = useState<FilmData | null>(null);
  const [handle] = useState(() => delayRender('Loading the layered noir scene'));
  useEffect(() => {
    Promise.all([
      fetch(staticFile('art/flagship-animation/opening-scene.json')).then(async response => {
        if (!response.ok) throw new Error('Opening scene data is missing.');
        return response.json() as Promise<OpeningScene>;
      }),
      fetch(staticFile('art/flagship-animation/film.json')).then(response => response.ok ? response.json() as Promise<FilmData> : null),
    ]).then(([opening, filmData]) => {setScene(opening); setFilm(filmData); continueRender(handle);}).catch(cancelRender);
  }, [handle]);
  return scene ? <>
    <Composition id="Omerta-Animated-Noir-Opening" component={Opening} defaultProps={{scene, clean: false, muteAudio: false}} width={1920} height={1080} fps={scene.fps} durationInFrames={Math.round(scene.duration * scene.fps)} />
    {film ? <Composition id="Omerta-Animated-Noir-Film" component={Film} defaultProps={{film, clean: false, muteAudio: false}} width={1920} height={1080} fps={film.fps} durationInFrames={Math.round(film.duration * film.fps)} /> : null}
  </> : null;
};
