/** Reversible re-edit of an existing project score; no paid generation. */
import {fs,path,here,root,audioDir,RATE,amp,db,clamp,round,samples,seconds,hash,relative,ff,decode,stats,biquad,writeStem,master} from './audio-lib.mjs';
const report=JSON.parse(fs.readFileSync(path.join(here,'audio-narration-report.json')));
const timing=JSON.parse(fs.readFileSync(path.join(audioDir,'utterance-timing.json')));
const duration=390,sourceFile=path.join(root,'public/art/market-v2-soul/audio/SOUL-SCORE.mp3');
const sourceHash=hash(fs.readFileSync(sourceFile));
const renderSource=path.join(audioDir,'score-source-processed.wav');
const scoreFilter={highpassHz:40,lowpassHz:11500,compressor:{thresholdDbfs:-22,ratio:2.2,attackMs:18,releaseMs:260,kneeDb:3,stereoLinked:true,makeupDb:0}};
const source=decode(sourceFile,2),music=new Float32Array(samples(duration)*2),dialogue=decode(path.join(audioDir,'rebuild-dialogue.wav'),2);
for(let ch=0;ch<2;ch++){
  const mono=new Float32Array(source.length/2);for(let i=0;i<mono.length;i++)mono[i]=source[i*2+ch];
  biquad(mono,40,true);biquad(mono,11500);for(let i=0;i<mono.length;i++)source[i*2+ch]=mono[i];
}
let gainReduction=0;
for(let i=0;i<source.length;i+=2){
  const over=db(Math.max(Math.abs(source[i]),Math.abs(source[i+1])))-scoreFilter.compressor.thresholdDbfs,knee=scoreFilter.compressor.kneeDb;
  const reduction=over<=-knee/2?0:over>=knee/2?(1-1/2.2)*over:(1-1/2.2)*(over+knee/2)**2/(2*knee);
  const tau=reduction>gainReduction?0.018:0.260,coefficient=Math.exp(-1/(RATE*tau));
  gainReduction=coefficient*gainReduction+(1-coefficient)*reduction;
  const gain=amp(-gainReduction);source[i]*=gain;source[i+1]*=gain;
}
writeStem(renderSource,source);
const segments=[
  {id:'arrival-and-preparation',at:0,sourceStart:0,length:125,fadeIn:1.8,fadeOut:4,reason:'Keep the original motif and gradual ensemble entrance for the opening, player choices and preparation.'},
  {id:'heist-tightening',at:121,sourceStart:91,length:38,fadeIn:4,fadeOut:0.12,reason:'Revisit the denser middle passage for heist momentum; the measured betrayal drop gates the last two seconds.'},
  {id:'aftermath-return',at:165,sourceStart:0,length:87,fadeIn:4,fadeOut:6,reason:'Return to the sparse opening motif after the betrayal, then rebuild through investigation.'},
  {id:'city-and-money',at:246,sourceStart:60,length:109,fadeIn:6,fadeOut:5,reason:'Sustain the ensemble through agent play and the economics explanation, with a shared theme.'},
  {id:'closing-cadence',at:350,sourceStart:140,length:40,fadeIn:5,fadeOut:3.2,reason:'Use the source score’s original final forty seconds and resolution for the invitation and CTA.'},
];
for(const segment of segments){
  const offset=samples(segment.at),from=samples(segment.sourceStart),count=samples(segment.length);
  if((from+count)*2>source.length||offset+count>samples(duration))throw new Error(`Invalid score edit ${segment.id}`);
  for(let n=0;n<count;n++){
    const t=seconds(n),fadeIn=clamp(t/segment.fadeIn,0,1),fadeOut=clamp((segment.length-t)/segment.fadeOut,0,1);
    // Complementary cosine fades keep a repeated acoustic passage from creating a large swell at a join.
    const envelope=(0.5-0.5*Math.cos(Math.PI*fadeIn))*(0.5-0.5*Math.cos(Math.PI*fadeOut));
    music[(offset+n)*2]+=source[(from+n)*2]*envelope;
    music[(offset+n)*2+1]+=source[(from+n)*2+1]*envelope;
  }
}
const points=[[0,-4],[15,-1],[51,-2],[90,0],[122,0],[130,1],[151,2.5],[165,-5],[178,-3],[212,-1],[252,-1],[280,-2],[345,-2],[355,0],[372,1],[383,4],[388,3],[390,-10]];
function automation(t){
  const index=points.findIndex(p=>p[0]>t);
  if(index<1)return amp(points[Math.max(0,index)][1]);
  const a=points[index-1],b=points[index],f=(t-a[0])/(b[0]-a[0]);return amp(a[1]+(b[1]-a[1])*f);
}
const phrases=[];
for(const cue of timing){
  const prev=phrases.at(-1);
  if(prev&&cue.start-prev.end<=0.65)prev.end=cue.end;
  else phrases.push({start:cue.start,end:cue.end});
}
const dropStart=report.cues.betrayalDrop-0.045,dropEnd=report.cues.jailResultEnd+2;
function silenceGate(t){
  if(t<dropStart-0.055||t>=dropEnd+1.8)return 1;
  if(t<dropStart)return clamp((dropStart-t)/0.055,0,1);
  if(t<=dropEnd)return 0;
  const f=(t-dropEnd)/1.8;return 0.5-0.5*Math.cos(Math.PI*f);
}
const musicStats=stats(music),musicGain=amp(-30)/musicStats.rms,duckAmount=amp(-8);let phraseIndex=0;
for(let frame=0;frame<samples(duration);frame++){
  const t=seconds(frame);
  while(phraseIndex<phrases.length-1&&phrases[phraseIndex].end+0.65<t)phraseIndex++;
  let duck=1;
  for(let i=Math.max(0,phraseIndex-1);i<Math.min(phrases.length,phraseIndex+2);i++){
    const p=phrases[i];
    if(t<p.start-0.14||t>p.end+0.65)continue;
    const depth=t<p.start?(t-p.start+0.14)/0.14:t>p.end?1-(t-p.end)/0.65:1;
    duck=Math.min(duck,1-(1-duckAmount)*clamp(depth,0,1));
  }
  const gain=musicGain*duck*automation(t)*silenceGate(t);
  music[frame*2]*=gain;music[frame*2+1]*=gain;
}
writeStem(path.join(audioDir,'rebuild-music.wav'),music);
const mix=new Float32Array(dialogue.length);for(let i=0;i<mix.length;i++)mix[i]=dialogue[i]+music[i];
const masterFile=path.join(audioDir,'rebuild-mix.wav'),masterReport=master(masterFile,mix,duration);
const windows=[{name:'opening',start:0,end:15},{name:'heist-build',start:145,end:156},{name:'betrayal-silence',start:dropStart,end:dropEnd},{name:'economics',start:280,end:345},{name:'CTA-hold',start:384,end:390}].map(w=>{
  const begin=samples(w.start)*2,end=samples(w.end)*2,d=stats(dialogue.subarray(begin,end)),m=stats(music.subarray(begin,end));
  return{...w,dialogueRmsDbfs:d.rmsDbfs,musicRmsDbfs:m.rmsDbfs,dialogueAboveMusicDb:round(d.rmsDbfs-m.rmsDbfs,2),musicSamplePeakDbfs:m.samplePeakDbfs};
});
let speechSquare=0,bedSquare=0,activeSamples=0;
for(const cue of timing){
  const start=samples(Math.max(145,cue.start)),end=samples(Math.min(156,cue.end));
  for(let frame=start;frame<end;frame++){
    speechSquare+=dialogue[frame*2]**2+dialogue[frame*2+1]**2;
    bedSquare+=music[frame*2]**2+music[frame*2+1]**2;activeSamples+=2;
  }
}
const speechActiveBalance={region:'heist145–156s',method:'RMS over measured audible caption spans only, excluding purposeful speech rests',activeSeconds:activeSamples/(RATE*2),voiceRmsDbfs:round(db(Math.sqrt(speechSquare/activeSamples)),2),musicRmsDbfs:round(db(Math.sqrt(bedSquare/activeSamples)),2),voiceAboveMusicDb:round(10*Math.log10(speechSquare/bedSquare),2)};
const mixed=decode(masterFile,2);
const silenceChecks=[];
for(const [name,start,end]of [
  ['before-betrayal',dropStart,report.cues.betrayalDrop],
  ['after-informant-reveal',report.cues.betrayalSpokenEnd+0.08,report.cues.jailResultStart-0.08],
  ['after-jail-result',report.cues.jailResultEnd+0.08,Math.min(report.cues.jailResultEnd+1.8,timing.find(t=>t.start>report.cues.jailResultEnd)?.start-0.08)],
])if(end>start)silenceChecks.push({name,start,end,duration:round(end-start),...stats(mixed.subarray(samples(start)*2,samples(end)*2))});
const output={status:masterReport.valid?'SCRATCH MIX VERIFIED':'OUT OF SPEC',createdAt:new Date().toISOString(),duration,voice:report.voice,costs:report.costs,narrationSource:report.source,narrationSourceSha256:report.sourceSha256,narrationReport:'brand/flagship-rebuild/audio-narration-report.json',music:{source:relative(sourceFile),sourceSha256:sourceHash,originalGenerationRequest:'brand/market-v2-soul/generation-requests/score.json',originalProviderModel:'elevenlabs/music/v2.5 (existing project asset)',newGeneration:false,originalSourceDuration:source.length/(RATE*2),mode:'Reversible arrangement of selected existing acoustic score sections; some passages recur, no time stretching or pitch shifting.',stereoPreserved:true,processing:scoreFilter,sourceGainDb:round(db(musicGain),3),phraseDuckingDb:-8,lookaheadSeconds:0.14,releaseSeconds:0.65,levelAutomationDb:points,segments,drop:{start:round(dropStart),end:round(dropEnd),length:round(dropEnd-dropStart),fadeOutSeconds:0.055,returnFadeSeconds:1.8,trigger:'Measured start of “The law was waiting.”; returns two seconds after the audible jail result.'}},master:masterReport,windows,silenceChecks,validation:{...report.validation,sourceScoreUnchanged:hash(fs.readFileSync(sourceFile))===sourceHash,masterValid:masterReport.valid,scoreIsExactlySilentDuringBetrayal:windows.find(w=>w.name==='betrayal-silence').musicRmsDbfs<=-120},selfCritique:{improved:['Replaced separately generated short fragments and redistributed gaps with connected chapter performances.','Used speech-engine event timestamps at a verified16 kHz clock, then tightened captions to actual audio.','Rebuilt an existing instrumental around five broad dramatic passages rather than an automatic390-second loop.','Applied mild score compression and phrase ducking to reduce piano-transient competition with speech.','Self-review of the first mix found only1.57dB average voice/music separation in the heist buildup; reduced the base score2dB and deepened speech ducking from4.2to8dB before delivery.','Cut the score at the measured betrayal reveal and kept it absent through the jail consequence.','Kept the CTA quiet enough to hear and used the score’s original closing cadence.'],remaining:['David Desktop is still an audible local scratch voice; these changes improve connection and timing, not emotional acting.','Repeated musical passages are intentionally reused and documented; a newly commissioned or generated final score could develop motifs further.','No complete human listening review is claimed. Automated measurements establish timing and levels, not subjective musical quality.']}};
output.speechActiveBalance=speechActiveBalance;
fs.writeFileSync(path.join(here,'audio-report.json'),JSON.stringify(output,null,2)+'\n');
fs.writeFileSync(path.join(audioDir,'SCRATCH-ONLY.txt'),'LOCAL SCRATCH / RE-EDIT REVIEW\nMicrosoft David Desktop connected narration. This is not the selected final Voice A.\nExisting SOUL-SCORE music is re-edited; no new paid generation or asset purchases.\nNew spend: $0.\nSee brand/flagship-rebuild/audio-report.json.\n');
for(const [name,start,length]of [['opening',0,20],['betrayal',148,25],['ending',365,25]])ff(['-v','error','-y','-ss',String(start),'-i',masterFile,'-t',String(length),'-c:a','libmp3lame','-b:a','192k',path.join(audioDir,`review-${name}.mp3`)]);
console.log(JSON.stringify({status:output.status,master:masterReport,drop:output.music.drop,windows,validation:output.validation},null,2));
if(!masterReport.valid||!output.validation.scoreIsExactlySilentDuringBetrayal)process.exitCode=2;
