import {AbsoluteFill, Interactive, interpolate, useCurrentFrame} from 'remotion';
import type {PlannedBeat} from '../types';

const editorialCopy = (id: string): {heading: string; rows: string[]; footer: string} => {
  if (/-END$/.test(id)) return {heading: 'OMERTÀ', rows: [], footer: 'WELCOME TO THE FAMILY'};
  if (/-PRINCIPAL$/.test(id)) return {heading: 'CUSTODY', rows: ['PRINCIPAL → PROTOCOL', 'TURF FEE RIGHTS → FAMILY'], footer: 'FEE RIGHTS ≠ PRINCIPAL'};
  if (/-APPROVAL$/.test(id)) return {heading: 'HUMANS\nDECIDE.', rows: ['BOSS APPROVAL', 'PLAYER REVIEW', 'PLAYER EXECUTES'], footer: 'NO AUTOMATIC ACTION'};
  if (/-PERMISSION$/.test(id)) return {heading: 'HIS.\nNOT YOURS.', rows: ['OWN', 'SHARED', 'PUBLIC'], footer: 'PRIVATE CONTENTS ARE NOT SHOWN'};
  if (/-HISTORY$/.test(id)) return {heading: 'THE CITY\nKEEPS IT.', rows: ['ACTION', 'CONSEQUENCE', 'HISTORY'], footer: 'EDITORIAL HISTORY DIAGRAM'};
  if (/-PRIOR$/.test(id)) return {heading: 'EARLIER.', rows: ['EXPOSED ROUTE', 'PUBLIC CONSEQUENCE'], footer: 'EDITORIAL CONTEXT'};
  if (/-SWAP$/.test(id)) return {heading: 'YOUR\nCALL.', rows: ['QUOTE', 'HUMAN CONFIRMATION', 'SETTLEMENT'], footer: 'NO QUOTE OR TRANSACTION SHOWN'};
  return {heading: 'FOLLOW\nTHE CLUE.', rows: ['ORIGINAL SOURCE A', 'ORIGINAL SOURCE B'], footer: 'DISCLOSURE ≠ GUILT'};
};

/** Original editorial typography only. These panels are never represented as gameplay. */
export const EditorialPlate = ({plan}: {plan: PlannedBeat}) => {
  const frame = useCurrentFrame();
  const {beat, index, capture, captureRequired} = plan;
  const end = /-END$/.test(beat.asset);
  const copy = editorialCopy(beat.asset);
  return <AbsoluteFill style={{backgroundColor: end ? '#cbff00' : '#ecebdb', color: '#11110f', overflow: 'hidden'}}>
    <div style={{position: 'absolute', left: -170, top: end ? 300 : 380, width: 1510, height: end ? 420 : 110, backgroundColor: '#1642ff', rotate: index % 2 ? '-8deg' : '9deg'}} />
    <div style={{position: 'absolute', top: 96, left: 88, right: 180, color: '#1642ff', fontSize: 28, fontWeight: 900, letterSpacing: 2}}>
      {end ? 'OMERTÀ / CRIME TABLOID' : captureRequired && !capture ? 'EDITORIAL STUDY · CAPTURE PENDING' : 'EDITORIAL DIAGRAM'}
    </div>
    <Interactive.Div name="Editorial headline" style={{position: 'absolute', left: 100, right: 180, top: end ? 345 : 280, fontFamily: 'Impact, Arial Black, sans-serif', fontWeight: 950, fontSize: end ? 165 : 126, lineHeight: 0.92, letterSpacing: -7, whiteSpace: 'pre-line', color: end ? '#ecebdb' : '#11110f', scale: interpolate(frame, [0, 4, 9], [0.96, 1, 1], {extrapolateRight: 'clamp'}), rotate: end ? '-1deg' : '0deg'}}>
      {copy.heading}
    </Interactive.Div>
    {!capture ? <div style={{position: 'absolute', left: 88, right: 180, top: end ? 790 : 620}}>
      {copy.rows.map((row, i) => <Interactive.Div key={row} name="Editorial diagram row" style={{display: 'flex', alignItems: 'center', minHeight: 86, borderBottom: '5px solid #11110f', marginBottom: 10, fontSize: 43, fontWeight: 900, letterSpacing: -1, translate: interpolate(frame, [i * 2, i * 2 + 5], ['15px 0px', '0px 0px'], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
        <span style={{backgroundColor: i % 2 ? '#1642ff' : '#11110f', color: '#ecebdb', width: 52, height: 52, marginRight: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 32}}>{i + 1}</span>{row}
      </Interactive.Div>)}
      {end ? <div style={{display: 'flex', gap: 18, marginBottom: 40}}>{[0, 1, 2, 3].map(i => <div key={i} style={{width: 38, height: 38, backgroundColor: i === index % 4 ? '#ef2429' : '#11110f', borderRadius: '50%', scale: interpolate(frame, [0, 15, 30, 44], [1, i % 2 ? 1.25 : 0.85, 1.1, 1], {extrapolateRight: 'clamp'})}} />)}</div> : null}
      <div style={{marginTop: 25, color: '#1642ff', fontSize: 30, fontWeight: 900, letterSpacing: 1}}>{copy.footer}</div>
    </div> : null}
  </AbsoluteFill>;
};
