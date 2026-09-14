import {Composition, Folder, registerRoot, Sequence, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {Fragment} from 'react';
import '../fonts';
import {films, type Film} from './copy';
import {Frame} from './Frame';
import {Hero} from './scenes/Hero';
import {Ledger} from './scenes/Ledger';
import {Flow} from './scenes/Flow';
import {voiceEnabled, voiceRates} from './voice';

const FilmComposition = ({film}: {film: Film}) => <TransitionSeries>
  {film.shots.map((shot, index) => <Fragment key={shot.tag}>
    {index > 0 ? <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 10})} /> : null}
    <TransitionSeries.Sequence durationInFrames={240} name={shot.tag}>
      <Frame art={shot.art ?? film.art} index={index} total={film.shots.length} category={film.category} status={shot.status ?? film.status}>
        {shot.kind === 'hero' ? <Hero shot={shot}/> : shot.kind === 'ledger' ? <Ledger shot={shot}/> : <Flow shot={shot}/>}
      </Frame>
      {voiceEnabled && film.id === 'Omerta-ConnectedCity' ? <Sequence from={12} durationInFrames={215}><Audio src={staticFile(`art/hook-campaign/voice-${index}.mp3`)} playbackRate={voiceRates[index] ?? 1} /></Sequence> : null}
    </TransitionSeries.Sequence>
  </Fragment>)}
</TransitionSeries>;

const Root = () => <Folder name="Omerta-Hook-Campaign">
  {films.map(film => <Composition key={film.id} id={film.id} component={FilmComposition} defaultProps={{film}} width={1080} height={1920} fps={30} durationInFrames={film.shots.length * 240 - (film.shots.length - 1) * 10}/>)}
</Folder>;
registerRoot(Root);
