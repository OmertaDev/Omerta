import {useCurrentFrame} from 'remotion';
import {Arrow, Label, motion, Vessel} from './Primitives';
import {C, type SceneProps} from './types';

export const ReservesScene = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const empty = beat.state === 'empty';
  const open = empty ? 0 : motion(frame, 20, 60);
  const move = empty ? 0 : motion(frame, 50, 105);
  if (beat.state === 'fund') return <>
    <Label text={beat.nodes?.[0] || ''} left={90} top={510} width={840} align="center" />
    <Arrow x1={510} x2={510} y1={621} y2={710} progress={motion(frame, 0, 40)} />
    <Label text={beat.nodes?.[1] || ''} left={90} top={740} width={840} align="center" />
    <Vessel x={325} y={852} width={370} height={270} fill={0.15 + motion(frame, 30, 105) * 0.55} label={beat.nodes?.[2] || 'War Chest'} color={C.blue} />
  </>;
  return <>
    <Label text={empty ? 'No assets created by a price recovery.' : beat.nodes?.[0] || 'Funded assets. Bounded capacity.'} left={90} top={500} width={840} align="center" />
    <Label text="War Chest" left={90} top={595} width={285} align="center" />
    <Label text="Partial refill" left={645} top={595} width={285} align="center" />
    <Vessel x={110} y={650} width={240} height={270} fill={empty ? 0 : 0.82 - move * 0.34} label="Idle assets" color={C.blue} />
    <Vessel x={675} y={650} width={240} height={270} fill={0.14 + move * 0.34} label="Eligible range" color={C.copper} />
    <Arrow x1={367} y1={795} x2={657} y2={795} progress={move} />
    <div style={{position: 'absolute', left: 441, top: 648, width: 144, height: 214, borderLeft: `3px solid ${C.line}`, borderRight: `3px solid ${C.line}`}}>
      <div style={{position: 'absolute', width: 144, height: 4, top: 106 - open * 52, background: C.ivory, rotate: `${-open * 42}deg`}} />
    </div>
    <Label text={empty ? 'No refill' : 'Conditional\ngate'} left={385} top={893} width={254} align="center" />
    <Label text="Lifetime capacity already consumed" left={90} top={1060} width={840} size={44} />
    <div style={{position: 'absolute', left: 90, top: 1123, width: 840, height: 34, border: `1px solid ${C.line}`, boxSizing: 'border-box'}}>
      <div style={{width: '62%', height: '100%', background: `repeating-linear-gradient(135deg,${C.copper}90 0px,${C.copper}90 3px,transparent 3px,transparent 10px)`}} />
    </div>
    <Label text="Lifetime usage remains consumed." left={90} top={1180} width={840} size={44} color={C.muted} />
  </>;
};
