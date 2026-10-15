import {Headline} from './Frame';
import {Media} from './Media';
import {C, FONT, type SceneProps} from './types';

export const GameplayScene = ({beat, manifest}: SceneProps) => {
  const asset = manifest.assets[beat.capture || beat.asset || ''];
  if (!asset) throw new Error(`Gameplay scene requires an actual capture: ${beat.id}`);
  return <>
    <Headline text={beat.headline} size={80} top={150} width={1710} />
    <div style={{position: 'absolute', left: 88, top: 280, width: 1240, height: 600, overflow: 'hidden', border: `1px solid ${C.line}`, boxShadow: '0 24px 42px #0006'}}><Media asset={asset} duration={beat.end - beat.start} width={1240} height={600} focus={beat.focus} /></div>
    <div style={{position: 'absolute', left: 1382, top: 295, width: 410, color: C.gold, textTransform: 'uppercase', letterSpacing: 2, fontSize: 23}}>In the interface</div>
    <div style={{position: 'absolute', left: 1382, top: 344, width: 410, height: 500}}>{(beat.labels || []).slice(0, 4).map((label, index) => <div key={label} style={{marginBottom: 29, paddingTop: 18, borderTop: `1px solid ${C.line}`, color: index ? C.muted : C.bone, fontSize: label.length > 60 ? 30 : 37, lineHeight: 1.15}}><span style={{color: C.gold, fontFamily: FONT.mono, fontSize: 19, marginRight: 13}}>{String(index + 1).padStart(2, '0')}</span>{label}</div>)}</div>
    {beat.captureLabel || beat.note ? <div style={{position: 'absolute', left: 91, top: 890, width: 1240, color: C.muted, fontSize: 22}}>{beat.captureLabel || beat.note}</div> : null}
  </>;
};
