import {AbsoluteFill, Interactive, interpolate, useCurrentFrame} from 'remotion';
import type {Beat} from '../types';

/** Explicit planning graphic, never a substitute presented as captured gameplay. */
export const PendingPlate = ({beat, index, capturePending}: {beat: Beat; index: number; capturePending: boolean}) => {
  const frame = useCurrentFrame();
  const hasPortrait = beat.speaker === 'Consigliere';
  const descriptionLimit = hasPortrait ? 110 : 170;
  return <AbsoluteFill style={{backgroundColor: '#ecebdb', color: '#11110f', overflow: 'hidden'}}>
    <Interactive.Div name="Acid circle" style={{position: 'absolute', width: 1070, height: 1070, borderRadius: '50%', backgroundColor: '#cbff00', left: -400, top: 50, scale: interpolate(frame, [0, 45], [1, 1.1], {extrapolateRight: 'clamp'})}} />
    <Interactive.Div name="Cobalt slash" style={{position: 'absolute', width: 1600, height: 150, backgroundColor: '#1642ff', left: -220, top: 450, rotate: index % 2 ? '-20deg' : '17deg'}} />
    <Interactive.Div name="Source pending" style={{position: 'absolute', left: 88, top: 90, right: 88, background: '#ef2429', color: '#fff', padding: '16px 20px', fontFamily: 'Arial, sans-serif', fontSize: 35, fontWeight: 900}}>
      INTERNAL TIMING ANIMATIC<br />{capturePending ? 'PLATES + CAPTURE PENDING' : 'PLATES PENDING'}
    </Interactive.Div>
    <Interactive.Div name="Beat counter" style={{position: 'absolute', top: 268, left: 88, fontFamily: 'Impact, Arial Black, sans-serif', fontSize: 170, letterSpacing: -8, color: '#11110f'}}>
      {String(index + 1).padStart(2, '0')}
    </Interactive.Div>
    <Interactive.Div name="Plate direction" style={{position: 'absolute', left: 96, right: hasPortrait ? 474 : 180, top: 670, fontFamily: 'Arial, sans-serif', fontSize: hasPortrait ? 42 : 45, lineHeight: 1.14, fontWeight: 800}}>
      {beat.primary.length > descriptionLimit ? `${beat.primary.slice(0, descriptionLimit - 3)}…` : beat.primary}
    </Interactive.Div>
    <Interactive.Div name="Asset identifier" style={{position: 'absolute', left: 96, top: 975, fontSize: 24, fontFamily: 'monospace', color: '#1642ff'}}>
      PLATE: {beat.asset}
    </Interactive.Div>
  </AbsoluteFill>;
};
