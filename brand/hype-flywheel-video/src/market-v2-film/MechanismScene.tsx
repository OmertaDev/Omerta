import {useCurrentFrame} from 'remotion';
import {Arrow, Label, motion} from './Primitives';
import {C, FPS, type SceneProps} from './types';

const Flow = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const nodes = beat.nodes || [];
  const height = Math.min(172, 675 / Math.max(1, nodes.length));
  const step = Math.min(26, (beat.end - beat.start) * FPS * 0.45 / Math.max(1, nodes.length));
  if (beat.state === 'funding') return <>
    {nodes.slice(0, 2).map((node, index) => <div key={node} style={{position: 'absolute', left: 90, top: 545 + index * 240, width: 840, height: 170, borderLeft: `3px solid ${index ? C.blue : C.copper}`, background: index ? '#4278940D' : '#C383560D', opacity: 0.35 + 0.65 * motion(frame, index * 8, 35 + index * 8)}}><Label text={node} left={27} top={50} width={780} size={48} /></div>)}
    <Label text={nodes[2] || ''} left={90} top={1090} width={840} color={C.muted} />
  </>;
  return <>{nodes.map((text, index) => {
    const y = 510 + height * index;
    const on = motion(frame, index * step, index * step + 16);
    return <div key={`${index}-${text}`} style={{position: 'absolute', left: 90, top: y, width: 840, height: height - 16, opacity: 0.3 + on * 0.7}}>
      <div style={{position: 'absolute', left: 2, top: 13, width: 10, height: 10, border: `1px solid ${C.copper}`, background: on > 0.5 ? C.copper : 'transparent', rotate: '45deg'}} />
      <Label text={text} left={55} top={0} width={770} size={44} />
      {index < nodes.length - 1 ? <div style={{position: 'absolute', left: 6, top: 37, height: height - 32, width: 1, background: C.line}}><div style={{height: `${on * 100}%`, width: 2, background: C.copper}} /></div> : null}
      <div style={{position: 'absolute', left: 55, bottom: 7, width: 770, height: 1, background: `${C.line}80`}} />
    </div>;
  })}</>;
};

const Allocation = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const nodes = beat.nodes || [];
  const pitch = Math.min(154, 670 / Math.max(1, nodes.length));
  return <>{nodes.map((node, index) => {
    const percent = node.match(/\d+(?:\.\d+)?\s*%/)?.[0];
    const label = percent ? node.replace(percent, '').replace(/^[\s·:—–-]+|[\s·:—–-]+$/g, '') : node;
    return <div key={`${index}-${node}`} style={{position: 'absolute', left: 90, top: 505 + index * pitch, width: 840, height: pitch - 20, borderLeft: `3px solid ${index % 2 ? C.blue : C.copper}`, background: 'linear-gradient(90deg,#C3835610,transparent)'}}>
      <Label text={label} left={24} top={25} width={percent ? 574 : 765} />
      {percent ? <Label text={percent} left={623} top={15} width={193} size={64} align="right" color={C.copper} /> : null}
      <div style={{position: 'absolute', left: 23, bottom: 9, width: `${motion(frame, index * 4, index * 4 + 35) * 94}%`, height: 1, background: C.line}} />
    </div>;
  })}</>;
};

const Observations = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const nodes = beat.nodes || [];
  const points = [190, 380, 570, 760];
  const sweep = motion(frame, 0, 100);
  if (beat.state === 'gate') return <Flow beat={beat} />;
  if (beat.state === 'opening') return <Timelock beat={beat} />;
  return <>
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <path d="M110 800H930" fill="none" stroke={C.line} strokeWidth={2} />
      <path d="M140 744L290 692L430 760L580 625L730 686L890 610" fill="none" stroke={C.blue} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - sweep} />
      {points.map((x, index) => <g key={x} opacity={motion(frame, index * 16, index * 16 + 15)}><line x1={x} x2={x} y1={595} y2={816} stroke={C.line} strokeDasharray="5 8" /><circle cx={x} cy={800} r={8} fill={C.copper} /></g>)}
    </svg>
    <Label text="Observation history" left={90} top={520} width={840} color={C.muted} />
    <Label text="TIME →" left={700} top={834} width={230} size={30} align="right" color={C.muted} />
    {nodes.slice(0, 3).map((node, index) => <Label key={`${index}-${node}`} text={node} left={90} top={921 + index * 86} width={840} />)}
    <Label text="Illustrative observations · no market-price scale" left={90} top={1195} width={840} size={23} color={C.muted} />
  </>;
};

const SplitCustody = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const nodes = beat.nodes || [];
  return <>
    {nodes.map((node, index) => <div key={`${index}-${node}`} style={{position: 'absolute', left: 90, top: 506 + index * 176, width: 840, height: 118, borderLeft: `2px solid ${C.copper}`, paddingLeft: 22, boxSizing: 'border-box', opacity: 0.35 + 0.65 * motion(frame, index * 12, index * 12 + 18)}}><Label text={node} left={25} top={12} width={785} />{index < nodes.length - 1 ? <div style={{position: 'absolute', left: 415, top: 131, width: 1, height: 35, background: C.copper}} /> : null}</div>)}
    <div style={{position: 'absolute', left: 90, top: 1090, width: 840, height: 112, border: `1px solid ${C.blue}`, background: '#42789410'}}><Label text="LP principal remains protocol-owned" left={22} top={28} width={795} size={44} /></div>
  </>;
};

const Timelock = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const nodes = beat.nodes || [];
  const progress = motion(frame, 10, Math.min(110, (beat.end - beat.start) * FPS * 0.72));
  return <>
    <Label text={nodes[0] || ''} left={90} top={500} width={840} />
    <div style={{position: 'absolute', left: 120, top: 650, width: 210, height: 240, border: `1px solid ${C.copper}`, background: '#C3835610'}}><div style={{position: 'absolute', top: 21, left: 21, right: 21, bottom: 21, border: `1px solid ${C.line}`}} /></div>
    <Arrow x1={355} y1={770} x2={685} y2={770} progress={progress} />
    <div style={{position: 'absolute', left: 710, top: 700, width: 190, height: 150, border: `1px solid ${C.blue}`, opacity: 0.3 + 0.7 * progress}} />
    <Label text={nodes[1] || ''} left={90} top={951} width={840} />
    <div style={{position: 'absolute', left: 90, top: 1060, width: 840, height: 18, border: `1px solid ${C.line}`}}><div style={{height: '100%', width: `${progress * 100}%`, background: `linear-gradient(90deg,${C.copper},${C.blue})`}} /></div>
    <Label text={nodes[2] || ''} left={90} top={1110} width={840} />
  </>;
};

const Commitment = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const nodes = beat.nodes || [];
  const exit = beat.state === 'exit';
  if (exit) return <>
    <Label text={nodes[0] || 'Prefunded campaign'} left={90} top={515} width={840} color={C.muted} />
    <Label text="Available funds" left={90} top={632} width={350} />
    <Arrow x1={444} x2={595} y1={665} y2={665} progress={motion(frame, 0, 45)} />
    <Label text="Reward claim" left={620} top={632} width={310} align="right" />
    <div style={{position: 'absolute', left: 90, top: 816, width: 840, height: 1, background: C.line}} />
    <Label text="Separate exit path" left={90} top={864} width={840} color={C.blue} />
    <Label text="Position NFT" left={90} top={973} width={350} />
    <Arrow x1={420} x2={594} y1={1004} y2={1004} progress={motion(frame, 28, 83)} color={C.blue} />
    <Label text="Mature exit" left={620} top={973} width={310} align="right" />
    <Label text={nodes[2] || 'Mature NFT exit: independent'} left={90} top={1145} width={840} />
  </>;
  return <>
    <Label text={nodes[0] || 'Canonical LP position'} left={90} top={510} width={840} />
    <div style={{position: 'absolute', left: 123, top: 665, width: 228, height: 275, border: `1px solid ${C.copper}`, rotate: '-4deg'}} />
    <div style={{position: 'absolute', left: 145, top: 682, width: 228, height: 275, border: `1px solid ${C.copper}`, background: C.black}}><Label text="NFT" left={15} top={110} width={198} size={58} align="center" /></div>
    <Arrow x1={397} x2={591} y1={822} y2={822} progress={motion(frame, 15, 85)} />
    <div style={{position: 'absolute', left: 615, top: 711, width: 290, height: 220, border: `1px solid ${C.blue}`}}><Label text={nodes[1] || 'Finite lock term'} left={20} top={63} width={250} align="center" /></div>
    <Label text={nodes[2] || 'Qualifying depth samples'} left={90} top={1100} width={840} />
  </>;
};

const Solver = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const nodes = beat.nodes || [];
  const phase = motion(frame, 15, 80);
  return <>
    <Label text={nodes[0] || ''} left={90} top={505} width={840} />
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}><path d="M510 675L730 850L510 1025L290 850Z" fill="#42789412" stroke={C.blue} strokeWidth={2} /><path d="M200 850H290M730 850H860" stroke={C.line} strokeWidth={2} /><circle cx={200 + phase * 660} cy={850} r={8} fill={C.copper} /></svg>
    <Label text={nodes[1] || 'Bounded decision'} left={365} top={789} width={290} align="center" />
    <Label text={nodes[2] || ''} left={90} top={1085} width={840} />
    {nodes[3] ? <Label text={nodes[3]} left={90} top={1163} width={840} color={C.muted} /> : null}
  </>;
};

export const MechanismScene = (props: SceneProps) => {
  switch (props.beat.kind) {
    case 'allocation': return <Allocation {...props} />;
    case 'observations': return <Observations {...props} />;
    case 'turf': return <SplitCustody {...props} />;
    case 'bond': return <Timelock {...props} />;
    case 'commitment': return <Commitment {...props} />;
    case 'solver': return <Solver {...props} />;
    default: return <Flow {...props} />;
  }
};
