import {interpolate, useCurrentFrame} from 'remotion';
import {Headline} from './Frame';
import {C, FONT, type SceneProps} from './types';

const BalanceDiagram = () => <>
  {[
    {x: 94, title: 'Game cash', detail: 'Game currency\nPays for city life', footer: 'Not US dollars'},
    {x: 664, title: 'In-game OMR', detail: 'Internal game balance\nSelected game utility', footer: 'Internal credits ≠ onchain tokens'},
    {x: 1234, title: 'Wallet OMR', detail: 'Onchain token balance\nSeparate custody', footer: 'No automatic wallet payout'},
  ].map(item => <div key={item.title} style={{position: 'absolute', left: item.x, top: 350, width: 530, height: 300, borderTop: `2px solid ${C.gold}`, background: C.charcoal, padding: '30px 32px', boxSizing: 'border-box'}}><div style={{fontFamily: FONT.title, fontSize: 54, color: C.bone}}>{item.title}</div><div style={{fontSize: 31, lineHeight: 1.3, color: C.muted, whiteSpace: 'pre-line', marginTop: 24}}>{item.detail}</div><div style={{fontSize: 27, color: C.gold, marginTop: 25}}>{item.footer}</div></div>)}
  <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}><path d="M929 666V768H359V666M349 680L359 666L369 680" fill="none" stroke={C.gold} strokeWidth={3} /><path d="M1199 340V839" stroke={C.line} strokeWidth={1} strokeDasharray="5 11" /></svg>
  <div style={{position: 'absolute', left: 448, top: 683, width: 395, textAlign: 'center', fontSize: 32, color: C.bone}}>Funded Window</div>
  <div style={{position: 'absolute', left: 360, top: 796, width: 700, fontSize: 29, color: C.gold}}>One way. No cash → OMR conversion.</div>
  <div style={{position: 'absolute', left: 1265, top: 716, width: 480, color: C.muted, fontSize: 31, lineHeight: 1.3}}>Not a merged balance.<br />Not an automatic withdrawal.</div>
</>;

const FeeDiagram = () => <>
  <div style={{position: 'absolute', left: 96, top: 356, width: 290, height: 221, borderTop: `2px solid ${C.gold}`, paddingTop: 21}}><div style={{color: C.gold, fontSize: 23, letterSpacing: 1.5}}>CANONICAL HOOK SELL</div><div style={{fontFamily: FONT.title, fontSize: 108, color: C.bone, marginTop: 11}}>9%</div></div>
  <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}><path d="M383 465H418V320H1642" fill="none" stroke={C.line} strokeWidth={2} />{[615, 957, 1299, 1641].map(x => <path key={x} d={`M${x} 320V350`} stroke={C.gold} strokeWidth={2} />)}</svg>
  {[
    {pct: '2%', label: 'Developer'}, {pct: '2.4%', label: 'Community'}, {pct: '1.6%', label: 'RWA recipient'}, {pct: '3%', label: 'POL → Core'},
  ].map((item, index) => <div key={item.label} style={{position: 'absolute', left: 466 + index * 342, top: 350, width: 306, height: 230, background: C.charcoal, borderTop: `2px solid ${C.gold}`, padding: '27px 25px', boxSizing: 'border-box'}}><div style={{fontFamily: FONT.title, fontSize: 69, color: C.bone}}>{item.pct}</div><div style={{fontSize: 33, color: C.muted, marginTop: 27}}>{item.label}</div></div>)}
  <div style={{position: 'absolute', left: 98, top: 648, width: 823, borderTop: `1px solid ${C.line}`, paddingTop: 27, fontSize: 35, color: C.gold}}>Extra 0–1% surge → War Chest<div style={{marginTop: 20, fontSize: 29, color: C.muted}}>A separate reserve budget.</div></div>
  <div style={{position: 'absolute', left: 1004, top: 648, width: 774, borderTop: `1px solid ${C.line}`, paddingTop: 26, fontSize: 32, color: C.bone}}>Pool LP fees are additional.<div style={{marginTop: 16, color: C.gold}}>Families: designated LP fee rights.</div><div style={{marginTop: 14, color: C.muted}}>Designated principal stays protocol-controlled.</div></div>
</>;

const MarketParticipation = ({rights = false}: {rights?: boolean}) => <>
  {(rights ? [
    ['Protocol liquidity', 'Designated principal stays protocol-controlled'],
    ['Family fee rights', 'Actual designated trading fees'],
    ['Funded claims', 'Specific recipients and permissions'],
  ] : [
    ['Inventory bonds', 'Buy existing OMR.\nRelease over time.'],
    ['Liquidity rewards', 'Qualifying positions.\nFunded campaigns.'],
    ['Arbitrage reserves', 'A share of actual realized profit.'],
  ]).map((item, index) => <div key={item[0]} style={{position: 'absolute', left: 96 + index * 570, top: 352, width: 530, height: 359, borderTop: `2px solid ${C.gold}`, background: C.charcoal, padding: '39px 32px', boxSizing: 'border-box'}}><div style={{fontFamily: FONT.title, color: C.bone, fontSize: 51, lineHeight: 1.1}}>{item[0]}</div><div style={{marginTop: 43, color: C.muted, fontSize: 34, lineHeight: 1.3, whiteSpace: 'pre-line'}}>{item[1]}</div></div>)}
  <div style={{position: 'absolute', left: 99, top: 766, color: C.gold, fontSize: 34}}>Specific rights. Qualification and funding still matter.</div>
</>;

const RwaDiagram = ({overview}: {overview: boolean}) => overview ? <>
  {[
    ['Real-world assets', 'Interests tied to assets outside the game.'],
    ['Stock Tokens', 'Tokenized exposure; eligibility applies.'],
    ['Commission', 'Choices within supported authority.'],
  ].map((item, index) => <div key={item[0]} style={{position: 'absolute', left: 96 + index * 570, top: 352, width: 530, height: 359, borderTop: `2px solid ${C.gold}`, background: C.charcoal, padding: '39px 32px', boxSizing: 'border-box'}}><div style={{fontFamily: FONT.title, color: C.bone, fontSize: 51, lineHeight: 1.1}}>{item[0]}</div><div style={{marginTop: 43, color: C.muted, fontSize: 34, lineHeight: 1.3}}>{item[1]}</div></div>)}
  <div style={{position: 'absolute', left: 99, top: 766, color: C.gold, fontSize: 34}}>Holding OMR does not grant everyone a payout.</div>
</> : <>
  <div style={{position: 'absolute', left: 100, top: 353, width: 490, height: 300, borderTop: `2px solid ${C.gold}`, padding: '28px 30px', background: C.charcoal, boxSizing: 'border-box'}}><div style={{fontFamily: FONT.title, color: C.bone, fontSize: 54}}>Fee allocation</div><div style={{color: C.muted, fontSize: 34, marginTop: 37, lineHeight: 1.25}}>Dedicated budgets.<br />Eligible asset purchases.</div></div>
  <div style={{position: 'absolute', left: 645, top: 361, fontFamily: FONT.title, fontSize: 105, color: C.gold}}>→</div>
  <div style={{position: 'absolute', left: 810, top: 356, width: 924, color: C.gold, fontSize: 27, letterSpacing: 2}}>ASSET WORKFLOW</div>
  {['Purchase', 'Custody', 'Eligibility', 'Delivery'].map((label, index) => <div key={label} style={{position: 'absolute', left: 810 + index % 2 * 495, top: 421 + Math.floor(index / 2) * 111, width: 445, borderBottom: `1px solid ${C.line}`, paddingBottom: 22, color: C.bone, fontSize: 40}}>{label}</div>)}
  <div style={{position: 'absolute', left: 105, top: 766, width: 1630, color: C.gold, fontSize: 34}}>Holding OMR does not grant everyone a payout.</div>
</>;

export const DiagramScene = ({beat}: SceneProps) => {
  const frame = useCurrentFrame();
  const mode = beat.diagram || 'sequence';
  const labels = (beat.labels || []).slice(0, 6);
  const columns = mode === 'balances' ? 3 : labels.length <= 3 ? labels.length || 1 : mode === 'paths' ? 3 : 2;
  const rows = Math.ceil(labels.length / columns);
  const cellWidth = (1700 - (columns - 1) * 34) / columns;
  const cellHeight = rows > 2 ? 147 : rows > 1 ? 222 : 390;
  const connected = ['sequence', 'coordination'].includes(mode) || (mode === 'agents' && labels[0]?.startsWith('Read'));
  const custom = mode === 'balances' || mode === 'market' || mode === 'rwa';
  return <>
    <Headline text={beat.headline} top={150} size={84} />
    <div style={{position: 'absolute', left: 94, top: 279, color: C.gold, fontSize: 23, letterSpacing: 2, textTransform: 'uppercase'}}>How the city works</div>
    {mode === 'balances' ? <BalanceDiagram /> : mode === 'market' ? beat.diagramVariant === 'participation' || beat.diagramVariant === 'rights' ? <MarketParticipation rights={beat.diagramVariant === 'rights'} /> : <FeeDiagram /> : mode === 'rwa' ? <RwaDiagram overview={labels.some(label => label.includes('Stock Token'))} /> : null}
    {!custom ? labels.map((label, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const opacity = interpolate(frame, [index * 9, index * 9 + 25], [0.42, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      const lines = label.split('\n');
      return <div key={`${label}-${index}`} style={{position: 'absolute', left: 94 + col * (cellWidth + 34), top: 344 + row * (cellHeight + 27), width: cellWidth, height: cellHeight, background: index === 0 ? '#27251F' : '#191A1E', borderTop: `2px solid ${index === 0 ? C.gold : C.line}`, padding: rows > 2 ? '20px 28px' : '28px 32px', boxSizing: 'border-box', opacity}}>
        <div style={{fontFamily: FONT.mono, fontSize: 20, color: C.gold, letterSpacing: 2, marginBottom: rows > 2 ? 12 : 23}}>{connected ? `STEP ${String(index + 1).padStart(2, '0')}` : `0${index + 1}`}</div>
        <div style={{fontFamily: FONT.title, fontSize: rows > 2 ? 37 : label.length > 80 ? 40 : 47, lineHeight: 1.15, whiteSpace: 'pre-line', color: C.bone}}>{lines[0]}</div>
        {lines.length > 1 ? <div style={{fontSize: rows > 2 ? 27 : 32, color: C.muted, lineHeight: 1.25, marginTop: 17, whiteSpace: 'pre-line'}}>{lines.slice(1).join('\n')}</div> : null}
        {connected && col < columns - 1 ? <svg width={34} height={30} viewBox="0 0 34 30" style={{position: 'absolute', left: cellWidth, top: cellHeight / 2 - 15}}><path d="M3 15H28M22 9L28 15L22 21" fill="none" stroke={C.gold} strokeWidth="2" /></svg> : null}
      </div>;
    }) : null}
    {beat.note ? <div style={{position: 'absolute', left: 99, top: 832, width: 1690, color: C.muted, fontSize: 31, lineHeight: 1.15}}>{beat.note}</div> : null}
  </>;
};
