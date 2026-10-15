import {useCurrentFrame} from 'remotion';
import {Arrow, Label, motion, Vessel} from './Primitives';
import {C, clamp, FPS, type SceneProps} from './types';

export const RangeScene = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const state = beat.state || 'overview';
  const travel = motion(frame, 8, Math.min(85, (beat.end - beat.start) * FPS * 0.7));
  const reversal = motion(frame, Math.min(48, (beat.end - beat.start) * FPS * 0.36), Math.min(110, (beat.end - beat.start) * FPS * 0.8));
  const selling = state === 'selling';
  const buying = state === 'buying';
  const turning = state === 'reversal';
  const position = turning ? 250 + 310 * reversal : selling ? 525 - 230 * travel : buying ? 525 + 230 * travel : state === 'depleted' ? 120 : 525;
  // Inventory changes only while price traverses the active range; outside it,
  // the completed conversion remains unchanged until actual removal.
  const downsideConversion = clamp((440 - position) / 295);
  const upsideConversion = clamp((position - 610) / 295);
  const ethFill = turning || selling ? 0.78 - downsideConversion * 0.55 : buying ? 0.2 + upsideConversion * 0.55 : 0.5;
  const omrFill = turning || selling ? 0.2 + downsideConversion * 0.55 : buying ? 0.78 - upsideConversion * 0.55 : 0.5;
  const sentence = state === 'selling' ? 'ETH swaps into OMR.' : state === 'buying' ? 'OMR swaps into ETH.' : state === 'reversal' ? 'Reversible before withdrawal.' : state === 'finalize' ? 'Withdraw actual inventory.' : state === 'depleted' ? 'Finite capacity. No infinite refill.' : 'Finite ranges. Two directions.';
  if (state === 'overview') return <>
    <div style={{position: 'absolute', left: 90, top: 505, width: 840, height: 130, border: `1px solid ${C.ivory}`, background: '#F2ECE109'}}><Label text="Core · two-sided liquidity" left={24} top={38} width={785} size={48} align="center" /></div>
    {['Lower Cushion', 'Garrison', 'Upper Cushion', 'Desk'].map((name, index) => {
      const downside = index < 2;
      const column = downside ? 90 : 550;
      const y = 680 + index % 2 * 150;
      const color = downside ? C.blue : C.copper;
      return <div key={name} style={{position: 'absolute', left: column, top: y, width: 380, height: 118, border: `1px solid ${color}`, background: `${color}0E`}}><div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${motion(frame, index * 6, 50 + index * 6) * 100}%`, background: `${color}1C`}} /><Label text={name} left={15} top={34} width={350} size={44} align="center" /></div>;
    })}
    <Label text="Downside" left={90} top={985} width={380} align="center" color={C.blue} />
    <Label text="Upside" left={550} top={985} width={380} align="center" color={C.copper} />
    <div style={{position: 'absolute', left: 90, top: 1080, width: 840, height: 115, border: `1px solid ${C.line}`}}><Label text="War Chest · idle reserves" left={20} top={34} width={800} align="center" /></div>
  </>;
  if (state === 'finalize') return <>
    <Label text="PRICE · ETH PER OMR" left={90} top={490} width={840} align="center" color={C.muted} />
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}><rect x={250} y={595} width={510} height={62} fill={`${C.blue}20`} stroke={C.blue} strokeWidth={2} opacity={1 - motion(frame, 45, 83) * 0.85} /><path d="M140 679H900" stroke={C.line} strokeWidth={2} /><line x1={195} x2={195} y1={570} y2={690} stroke={C.ivory} strokeWidth={3} /><circle cx={195} cy={570} r={8} fill={C.ivory} /></svg>
    <Label text="Fully crossed · later-block removal" left={90} top={730} width={840} align="center" />
    <div style={{position: 'absolute', left: 312, top: 832, width: 400, height: 125, border: `1px solid ${C.copper}`, background: '#C3835610'}}><Label text="Actual withdrawal" left={20} top={35} width={360} align="center" /></div>
    <Arrow x1={448} x2={300} y1={993} y2={1121} progress={motion(frame, 45, 105)} color={C.blue} />
    <Arrow x1={591} x2={740} y1={993} y2={1121} progress={motion(frame, 45, 105)} />
    <Label text="Principal" left={135} top={1141} width={330} align="center" color={C.blue} />
    <Label text="Fees" left={575} top={1141} width={330} align="center" color={C.copper} />
  </>;
  return <>
    <Label text="PRICE · ETH PER OMR" left={135} top={486} width={750} align="center" color={C.muted} />
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <rect x={145} y={610} width={295} height={70} fill={`${C.blue}20`} stroke={C.blue} strokeWidth={2} />
      <rect x={610} y={610} width={295} height={70} fill={`${C.copper}20`} stroke={C.copper} strokeWidth={2} />
      <path d="M145 696H905M145 686v20M525 686v20M905 686v20" stroke={C.line} strokeWidth={2} />
      <path d="M895 688l10 8-10 8" fill="none" stroke={C.muted} strokeWidth={2} />
      <line x1={position} x2={position} y1={574} y2={706} stroke={C.ivory} strokeWidth={3} opacity={state === 'finalize' ? 1 - travel * 0.7 : 1} />
      <circle cx={position} cy={574} r={9} fill={C.ivory} />
      {state === 'depleted' ? <path d="M145 615l295 60M145 675l295-60" stroke={C.red} strokeWidth={3} opacity={travel} /> : null}
    </svg>
    <Label text="Downside" left={145} top={548} width={295} color={C.blue} />
    <Label text="Upside" left={610} top={548} width={295} color={C.copper} align="right" />
    <Label text="ETH → OMR" left={145} top={722} width={330} />
    <Label text="OMR → ETH" left={575} top={722} width={330} align="right" />
    <Vessel x={160} y={820} width={235} height={165} fill={clamp(ethFill)} label="ETH inventory" color={C.blue} />
    <Vessel x={655} y={820} width={235} height={165} fill={clamp(omrFill)} label="OMR inventory" color={C.copper} />
    {state !== 'depleted' ? <Arrow x1={buying || turning ? 630 : 420} x2={buying || turning ? 420 : 630} y1={903} y2={903} progress={turning ? clamp((clamp((440 - 250) / 295) - downsideConversion) / clamp((440 - 250) / 295)) : buying ? upsideConversion : downsideConversion} color={buying || turning ? C.blue : C.copper} /> : null}
    <Label text={beat.nodes?.[0] || sentence} left={90} top={1140} width={840} align="center" />
    <Label text="Illustrative inventory · no price or quantity scale" left={135} top={1198} width={750} size={23} align="center" color={C.muted} />
  </>;
};
