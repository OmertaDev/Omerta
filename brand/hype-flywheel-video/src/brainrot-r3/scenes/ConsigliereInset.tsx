import {CanvasImage, interpolate, staticFile, useCurrentFrame} from 'remotion';

/** An editorial portrayal of the speaker, with no implied real call or transcript. */
export const ConsigliereInset = () => {
  const frame = useCurrentFrame();
  return <div style={{position: 'absolute', top: 550, right: 180, width: 260, backgroundColor: '#1642ff', color: '#ecebdb', border: '6px solid #1642ff', boxSizing: 'border-box', boxShadow: '7px 7px 0 #11110f'}}>
    <div style={{padding: '8px 8px 10px', fontSize: 26, lineHeight: 1, fontWeight: 900, whiteSpace: 'nowrap'}}>AI CONSIGLIERE</div>
    <div style={{position: 'relative', height: 245, overflow: 'hidden', backgroundColor: '#6a797e'}}>
      <CanvasImage src={staticFile('art/brainrot-r3/refs/R3-C03-poly.png')} style={{position: 'absolute', width: 710, height: 1262, maxWidth: 'none', left: -230, top: -275}} />
      <div style={{position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 5, alignItems: 'end', height: 23}}>
        {[0, 1, 2].map(i => <div key={i} style={{width: 6, height: 23, backgroundColor: '#cbff00', transformOrigin: 'bottom', scale: `1 ${interpolate((frame + i * 4) % 16, [0, 8, 16], [.35, 1, .35])}`}} />)}
      </div>
    </div>
    <div style={{padding: '8px', fontSize: 22, lineHeight: 1.03, fontWeight: 800}}>EDITORIAL<br />PORTRAYAL</div>
  </div>;
};
