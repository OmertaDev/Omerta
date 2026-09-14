import {AbsoluteFill,Audio,Composition,Sequence,interpolate,registerRoot,staticFile,useCurrentFrame} from 'remotion';
import '../fonts';
import scenes from './walkthrough-data.json';
const Scene=({index}:{index:number})=>{
 const frame=useCurrentFrame();const s=scenes[index];
 const excerpt=index===1||index===2?JSON.stringify(Object.fromEntries((s.display.stacks??[]).map(v=>[v.templateId,`${v.qty} / ${v.quality}`])),null,2):JSON.stringify(s.display,null,2);
 return <AbsoluteFill style={{padding:'65px 85px',opacity:interpolate(frame,[0,12],[0,1],{extrapolateRight:'clamp'})}}>
  <Audio src={staticFile(`art/marketing-walkthrough/voice-${index}.mp3`)}/>
  <div style={{display:'flex',justifyContent:'space-between',fontSize:25,letterSpacing:4,color:'#c7af79'}}><span>OMERTÀ / FIELD NOTES</span><span>0{index+1} / 07</span></div>
  <div style={{display:'grid',gridTemplateColumns:'0.9fr 1.2fr',gap:75,marginTop:95}}>
   <div><p style={{fontSize:22,letterSpacing:3,color:'#aacac0'}}>{s.label}</p><h1 style={{fontFamily:'Omerta Display',fontWeight:700,fontSize:100,lineHeight:1.06,margin:'35px 0'}}>{s.title}</h1><p style={{fontSize:26,lineHeight:1.5,color:'#c7af79'}}>Real handlers · Synthetic accounts<br/>Local demonstration · September 2026</p></div>
   <div style={{background:'#192323',border:'1px solid #53605b',padding:35,borderRadius:8}}><div style={{fontSize:19,color:'#aacac0',borderBottom:'1px solid #53605b',paddingBottom:20,overflowWrap:'anywhere'}}>{'endpoint' in s?s.endpoint:'DEMONSTRATION NOTES / VERIFIED CAPTURE'}</div><pre style={{fontFamily:'Consolas,monospace',fontSize:index===4?23:27,lineHeight:1.4,whiteSpace:'pre-wrap',marginBottom:0}}>{excerpt}</pre></div>
  </div>
  <div style={{position:'absolute',bottom:65,left:85,right:85,borderTop:'1px solid #53605b',paddingTop:25,fontSize:29,lineHeight:1.45}}>{s.text}</div>
 </AbsoluteFill>;
};
const Film=()=>{let start=0;return <AbsoluteFill style={{background:'#101616',color:'#eee8db',fontFamily:'Arial'}}>{scenes.map((s,i)=>{const from=start;start+=s.frames;return <Sequence key={s.title} from={from} durationInFrames={s.frames}><Scene index={i}/></Sequence>;})}</AbsoluteFill>;};
registerRoot(()=><Composition id="Inside-Omerta" component={Film} width={1920} height={1080} fps={30} durationInFrames={scenes.reduce((sum,s)=>sum+s.frames,0)}/>);
