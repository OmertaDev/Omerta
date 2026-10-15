import {Composition, Folder} from 'remotion';
import rawData from '../../../brainrot-video-system/production-data.json';
import {FilmComposition} from './FilmComposition';
import {FPS} from './timeline';
import type {ProductionData} from './types';

const production = rawData as ProductionData;

export const BrainrotR3Root = () => <Folder name="OMERTA-Brainrot-R3">
  {production.films.map(film => <Composition
    key={film.id}
    id={`Omerta-R3-${film.id}`}
    component={FilmComposition}
    defaultProps={{film, assetWindows: production.assetWindows, manifestPath: 'art/brainrot-r3/manifest.json'}}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={Math.round(film.duration * FPS)}
  />)}
</Folder>;
