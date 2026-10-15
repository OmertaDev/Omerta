import {AbsoluteFill, Interactive, interpolate, useCurrentFrame} from 'remotion';
import type {PlannedBeat} from '../types';
import {MediaPlate} from './MediaPlate';
import {PendingPlate} from './PendingPlate';
import {EditorialPlate} from './EditorialPlate';
import {CaptureOverlay} from './CaptureOverlay';
import {ConsigliereInset} from './ConsigliereInset';

export const BeatScene = ({plan}: {plan: PlannedBeat}) => {
  const frame = useCurrentFrame();
  const {beat, index, durationFrames, asset} = plan;
  const caption = beat.caption || beat.speech;
  const words = caption.split(/\s+/);
  const longestWord = Math.max(...words.map(word => word.length));
  const rawTertiary = beat.tertiaryCaption || beat.editorial || beat.tertiary;
  const tertiary = rawTertiary.length > 64 ? `${rawTertiary.slice(0, 61).replace(/\s+\S*$/, '')}…` : rawTertiary;
  const reveal = /omert[aà]/i.test(caption);
  const editorial = beat.asset.startsWith('EDIT-');
  const capturePending = plan.captureRequired && !plan.capture;
  return <AbsoluteFill style={{fontFamily: 'Arial, sans-serif', background: '#11110f', overflow: 'hidden'}}>
    {asset ? <MediaPlate plan={plan} /> : editorial ? <EditorialPlate plan={plan} /> : <PendingPlate beat={beat} index={index} capturePending={capturePending} />}
    <CaptureOverlay plan={plan} />
    {beat.speaker === 'Consigliere' ? <ConsigliereInset /> : null}
    {asset && capturePending ? <div style={{position: 'absolute', left: 88, right: 180, top: 98, backgroundColor: '#ef2429', color: '#fff', padding: '12px 16px', fontSize: 30, lineHeight: 1.1, fontWeight: 900}}>INTERNAL DRAFT · CAPTURE PENDING</div> : null}
    <Interactive.Div name="Caption" style={{
      position: 'absolute', left: 100, right: 184, top: 1040,
      fontSize: caption.length > 56 ? 74 : longestWord > 13 ? 78 : 88, lineHeight: 1.01, fontWeight: 950, letterSpacing: -3,
      color: asset ? '#ecebdb' : '#11110f', textTransform: 'uppercase',
      rotate: index % 3 === 1 ? '-0.4deg' : index % 3 === 2 ? '0.4deg' : '0deg',
      scale: interpolate(frame, [0, 3, 7], [0.96, 1, 1], {extrapolateRight: 'clamp'}),
      textShadow: asset ? '4px 4px 0 #11110f, -3px -3px 0 #11110f, 3px -3px 0 #11110f, -3px 3px 0 #11110f' : 'none',
    }}>
      {words.map((word, wordIndex) => <span key={`${word}-${wordIndex}`} style={{
        display: 'inline-block', marginRight: 16, whiteSpace: 'nowrap',
        color: reveal || (/^[A-ZÀ0-9?!’]+$/.test(word) && word.length > 2) ? asset ? '#cbff00' : '#1642ff' : asset ? '#ecebdb' : '#11110f',
        translate: interpolate(frame, [wordIndex * 1.3, wordIndex * 1.3 + 3], ['0px 8px', '0px 0px'], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
      }}>{word}</span>)}
    </Interactive.Div>
    <Interactive.Div name="Editorial context strip" style={{position: 'absolute', left: 96, right: 180, top: 1340, height: 130, boxSizing: 'border-box', padding: '14px 18px 18px', backgroundColor: index % 2 ? '#1642ff' : '#11110f', color: '#ecebdb', borderLeft: '8px solid #cbff00'}}>
      <div style={{fontSize: 22, letterSpacing: 3, marginBottom: 9, color: '#cbff00', fontWeight: 900}}>EDITORIAL / {String(index + 1).padStart(2, '0')}</div>
      <div style={{fontSize: 44, lineHeight: 1.12, fontWeight: 700}}>{tertiary}</div>
      <div style={{position: 'absolute', left: 0, bottom: 0, height: 4, width: interpolate(frame, [0, durationFrames - 1], [0, 100], {extrapolateRight: 'clamp'}) + '%', backgroundColor: '#cbff00'}} />
    </Interactive.Div>
    <AbsoluteFill style={{pointerEvents: 'none', opacity: interpolate(frame, [0, 2], [0.12, 0], {extrapolateRight: 'clamp'}), backgroundColor: '#fff'}} />
  </AbsoluteFill>;
};
